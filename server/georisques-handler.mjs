const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const responseCache = new Map();

const jsonResponse = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });

async function fetchCommunalRisks(insee) {
  if (!insee || !/^\d[0-9AB]\d{3}$/i.test(insee)) return null;
  try {
    const [gasparRes, radonRes, seismeRes] = await Promise.allSettled([
      fetch(`https://georisques.gouv.fr/api/v1/gaspar/risques?code_insee=${encodeURIComponent(insee)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { accept: "application/json", "user-agent": "Citynside/1.0" },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://georisques.gouv.fr/api/v1/radon?code_insee=${encodeURIComponent(insee)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { accept: "application/json", "user-agent": "Citynside/1.0" },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://georisques.gouv.fr/api/v1/zonage_sismique?code_insee=${encodeURIComponent(insee)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { accept: "application/json", "user-agent": "Citynside/1.0" },
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const findings = [];
    const gasparData = gasparRes.status === "fulfilled" ? gasparRes.value : null;
    const details = gasparData?.data?.[0]?.risques_detail || [];
    const mainRisks = details.filter((r) => r.num_risque && r.num_risque.length <= 2);

    for (const r of mainRisks) {
      const sub = details
        .filter((s) => s.num_risque.startsWith(r.num_risque) && s.num_risque !== r.num_risque)
        .map((s) => s.libelle_risque_long);
      const isTech = /industri|canalis|pollut|barrage|marchandis|nucl|seveso/i.test(r.libelle_risque_long);
      findings.push({
        id: (isTech ? "technological:" : "natural:") + r.num_risque,
        label: r.libelle_risque_long,
        group: isTech ? "technological" : "natural",
        addressStatus: "Zone communale concernée",
        communeStatus: sub.length > 0 ? sub.slice(0, 2).join(", ") : "Arrêté préfectoral en vigueur",
      });
    }

    const radonData = radonRes.status === "fulfilled" ? radonRes.value : null;
    const classeRadon = radonData?.data?.[0]?.classe_potentiel;
    const alreadyHasRadon = findings.some((f) => f.id === "natural:radon" || /radon/i.test(f.label));
    if ((classeRadon === "3" || classeRadon === "2") && !alreadyHasRadon) {
      findings.push({
        id: "natural:radon",
        label: "Radon",
        group: "natural",
        addressStatus: classeRadon === "3" ? "Potentiel significatif (zone 3)" : "Potentiel modéré (zone 2)",
        communeStatus: "Zone à potentiel radon réglementée",
      });
    } else if (classeRadon && alreadyHasRadon) {
      // Enrichir l'entrée GASPAR existante avec la classe précise
      const existing = findings.find((f) => f.id === "natural:radon" || /radon/i.test(f.label));
      if (existing) existing.addressStatus = classeRadon === "3" ? "Potentiel significatif (zone 3)" : "Potentiel modéré (zone 2)";
    }

    const seismeData = seismeRes.status === "fulfilled" ? seismeRes.value : null;
    const rawZone = seismeData?.data?.[0]?.zone_sismicite;
    const zoneSeisme = rawZone
      ? rawZone.replace(/([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ]+)/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      : null;
    if (zoneSeisme) {
      const existing = findings.find((f) => f.label.toLowerCase().includes("séisme"));
      if (existing) {
        existing.addressStatus = `Zone de sismicité ${zoneSeisme}`;
      } else if (zoneSeisme !== "1") {
        findings.push({
          id: "natural:seisme",
          label: "Séisme",
          group: "natural",
          addressStatus: `Zone de sismicité ${zoneSeisme}`,
          communeStatus: "Zonage réglementaire national",
        });
      }
    }

    return findings.length > 0 ? { isCommunalFallback: true, findings } : null;
  } catch (err) {
    console.warn("Échec fallback communal GASPAR:", err);
    return null;
  }
}

export async function handleGeorisquesRequest(request) {
  if (request.method !== "GET" && request.method !== "OPTIONS") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      },
    });
  }

  const url = new URL(request.url);
  const latlon = url.searchParams.get("latlon");
  const insee = url.searchParams.get("insee");

  if (!latlon && !insee) {
    return jsonResponse({ error: "Paramètre latlon ou insee requis." }, 400);
  }

  if (latlon && !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(latlon)) {
    return jsonResponse({ error: "Paramètre latlon invalide." }, 400);
  }

  const cacheKey = latlon || `insee:${insee}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return jsonResponse(cached.body, 200, { "cache-control": "public, max-age=21600" });
  }

  try {
    let payload;
    let lastError;

    // 1. Si latlon est fourni, tenter l'API d'adresse précise
    if (latlon) {
      const upstreamUrl = `https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=${encodeURIComponent(latlon)}`;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(upstreamUrl, {
            signal: AbortSignal.timeout(6000),
            headers: {
              accept: "application/json",
              "user-agent": "Citynside/1.0",
            },
            cache: "no-store",
          });
          if (!response.ok) {
            lastError = new Error(`Géorisques API returned ${response.status}`);
            continue;
          }

          const data = await response.json();
          if (data && typeof data === "object" && data.unavailable === true) {
            lastError = new Error("Géorisques API returned an unavailable payload");
            continue;
          }

          payload = data;
          break;
        } catch (error) {
          lastError = error;
        }
      }
    }

    // 2. Si l'API par adresse échoue ou n'est pas disponible, basculer sur le fallback communal GASPAR
    if (!payload && insee) {
      console.warn("Bascule vers le fallback communal GASPAR (insee:", insee, ")");
      const communalFallback = await fetchCommunalRisks(insee);
      if (communalFallback) {
        payload = communalFallback;
      }
    }

    // 3. Si aucun résultat n'a pu être obtenu
    if (!payload) {
      console.warn("Géorisques temporairement indisponible :", lastError);
      return jsonResponse({ unavailable: true, findings: [] }, 200, { "cache-control": "no-store" });
    }

    responseCache.set(cacheKey, { body: payload, timestamp: Date.now() });
    if (responseCache.size > 200) {
      responseCache.delete(responseCache.keys().next().value);
    }

    return jsonResponse(payload, 200, { "cache-control": "public, max-age=21600" });
  } catch (error) {
    console.error("Georisques Proxy Error:", error);
    // Dernier recours : tenter le fallback communal même en cas d'erreur inattendue
    if (insee) {
      try {
        const fallback = await fetchCommunalRisks(insee);
        if (fallback) return jsonResponse(fallback, 200, { "cache-control": "public, max-age=21600" });
      } catch {
        // Ignorer
      }
    }
    return jsonResponse({ error: "Géorisques API indisponible." }, 502);
  }
}
