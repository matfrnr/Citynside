const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const responseCache = new Map();

const jsonResponse = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders
    },
  });

async function handleGeorisquesRequest(request) {
  if (request.method !== "GET" && request.method !== "OPTIONS") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      }
    });
  }

  const url = new URL(request.url);
  const latlon = url.searchParams.get("latlon");
  
  if (!latlon || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(latlon)) {
    return jsonResponse({ error: "Paramètre latlon invalide." }, 400);
  }

  const cached = responseCache.get(latlon);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return jsonResponse(cached.body, 200, { "cache-control": "public, max-age=21600" });
  }

  try {
    const upstreamUrl = `https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=${encodeURIComponent(latlon)}`;
    let response;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(upstreamUrl, {
          signal: AbortSignal.timeout(12000),
          headers: {
            accept: "application/json",
            "user-agent": "Citynside/1.0",
          },
          cache: "no-store",
        });
        if (response.ok) break;
        lastError = new Error(`Géorisques API returned ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    if (!response || !response.ok) {
      console.warn("Géorisques temporairement indisponible :", lastError);
      return jsonResponse({ unavailable: true, findings: [] }, 200, { "cache-control": "no-store" });
    }

    const payload = await response.json();
    responseCache.set(latlon, { body: payload, timestamp: Date.now() });
    
    if (responseCache.size > 200) {
      responseCache.delete(responseCache.keys().next().value);
    }

    return jsonResponse(payload, 200, { "cache-control": "public, max-age=21600" });
  } catch (error) {
    console.error("Georisques Proxy Error:", error);
    return jsonResponse({ error: "Géorisques API indisponible." }, 502);
  }
}

// Vercel Node.js Web Handler signature. A bare default function is interpreted
// as the legacy (req, res) signature and can fail before this handler runs.
export default {
  fetch: handleGeorisquesRequest,
};
