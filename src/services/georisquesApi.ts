import type { RiskAssessment, RiskFinding } from "../types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { assessment: RiskAssessment; timestamp: number }>();

const readText = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "boolean") return value ? "Concerné" : "Non concerné";
  }
  return undefined;
};

function prettifyRiskKey(key: string): string {
  const normalized = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^(risque|risk)\s+/i, "").trim();
  return normalized ? normalized[0].toLocaleUpperCase("fr") + normalized.slice(1) : "Risque signalé";
}

function prettifyRiskStatus(status: string): string {
  const value = status.trim().replace(/\s+/g, " ");
  if (/^(inconnu|non connu|risque inconnu)$/i.test(value)) return "Information indisponible";
  if (/non\s+concern[ée]e?/i.test(value)) return "Aucun signalement";
  if (/concern[ée]e?/i.test(value)) return "Zone concernée";
  if (/^risque\s+existant\s*[-–—:]\s*/i.test(value)) return `Risque ${value.replace(/^risque\s+existant\s*[-–—:]\s*/i, "")}`;
  return value;
}

function parseFindings(payload: unknown): RiskFinding[] {
  const findings: RiskFinding[] = [];
  const seen = new Set<string>();

  const visit = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const label = readText(record, ["libelleRisque", "libelle_risque", "nomRisque", "nom_risque", "libelle", "label", "nom", "risque"])
      || [...path].reverse().find((part) => part && !/^\d+$/.test(part) && !/^(risques?|naturels?|technologiques?|resultats?|donnees?)$/i.test(part));
    const addressStatus = readText(record, ["libelleStatutAdresse", "libelle_statut_adresse", "statutAdresse", "statut_adresse", "niveauAdresse", "present"]);
    const communeStatus = readText(record, ["libelleStatutCommune", "libelle_statut_commune", "statutCommune", "statut_commune", "niveauCommune"]);

    if (label && addressStatus) {
      const group = /technolog|industri|pollution|canalis|icpe|seveso/i.test([...path, label].join(" ")) ? "technological" : "natural";
      const id = `${group}:${label.toLocaleLowerCase("fr")}`;
      if (!seen.has(id)) {
        seen.add(id);
        findings.push({ id, label: prettifyRiskKey(label), group, addressStatus: prettifyRiskStatus(addressStatus), communeStatus: communeStatus ? prettifyRiskStatus(communeStatus) : communeStatus });
      }
    }

    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === "object") visit(child, [...path, key]);
    }
  };

  visit(payload, []);
  return findings;
}

/**
 * Fallback direct vers les données communales officielles GASPAR + Radon + Sismicité
 * en cas d'indisponibilité ou lenteur excessive du calcul par adresse exacte.
 */
async function fetchCommunalFallbackClient(insee: string): Promise<RiskFinding[]> {
  try {
    const [gasparRes, radonRes, seismeRes] = await Promise.allSettled([
      fetch(`https://georisques.gouv.fr/api/v1/gaspar/risques?code_insee=${encodeURIComponent(insee)}`, {
        signal: AbortSignal.timeout(6000),
        headers: { accept: "application/json" },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://georisques.gouv.fr/api/v1/radon?code_insee=${encodeURIComponent(insee)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { accept: "application/json" },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://georisques.gouv.fr/api/v1/zonage_sismique?code_insee=${encodeURIComponent(insee)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { accept: "application/json" },
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const findings: RiskFinding[] = [];
    const gasparData = gasparRes.status === "fulfilled" ? gasparRes.value as Record<string, unknown> | null : null;
    const details = Array.isArray((gasparData as any)?.data?.[0]?.risques_detail)
      ? (gasparData as any).data[0].risques_detail
      : [];
    const mainRisks = details.filter((r: any) => typeof r.num_risque === "string" && r.num_risque.length <= 2);

    for (const r of mainRisks) {
      const sub = details
        .filter((s: any) => typeof s.num_risque === "string" && s.num_risque.startsWith(r.num_risque) && s.num_risque !== r.num_risque)
        .map((s: any) => s.libelle_risque_long)
        .filter(Boolean);
      const isTech = /industri|canalis|pollut|barrage|marchandis|nucl|seveso/i.test(r.libelle_risque_long);
      findings.push({
        id: (isTech ? "technological:" : "natural:") + r.num_risque,
        label: r.libelle_risque_long,
        group: isTech ? "technological" : "natural",
        addressStatus: "Zone communale concernée",
        communeStatus: sub.length > 0 ? sub.slice(0, 2).join(", ") : "Arrêté préfectoral en vigueur",
      });
    }

    const radonData = radonRes.status === "fulfilled" ? radonRes.value as Record<string, unknown> | null : null;
    const classeRadon = (radonData as any)?.data?.[0]?.classe_potentiel;
    if (classeRadon === "3" || classeRadon === "2") {
      findings.push({
        id: "natural:radon",
        label: "Radon",
        group: "natural",
        addressStatus: classeRadon === "3" ? "Potentiel significatif (zone 3)" : "Potentiel modéré (zone 2)",
        communeStatus: "Zone à potentiel radon réglementée",
      });
    }

    const seismeData = seismeRes.status === "fulfilled" ? seismeRes.value as Record<string, unknown> | null : null;
    const zoneSeisme = (seismeData as any)?.data?.[0]?.zone_sismicite;
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

    return findings;
  } catch {
    return [];
  }
}

export async function fetchRiskAssessment(lat: number, lon: number, insee?: string): Promise<RiskAssessment> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}${insee ? `_${insee}` : ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.assessment;

  const reportUrl = `https://georisques.gouv.fr/api/v1/rapport_pdf?latlon=${encodeURIComponent(`${lon},${lat}`)}`;

  try {
    // 1. Tenter la requête principale (proxy applicatif avec support latlon + insee)
    const inseeParam = insee ? `&insee=${encodeURIComponent(insee)}` : "";
    const endpoint = `/api/georisques?latlon=${encodeURIComponent(`${lon},${lat}`)}${inseeParam}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });

    if (response.ok) {
      const payload: any = await response.json();
      
      // Cas 1.1 : Le proxy a renvoyé un fallback communal déjà structuré
      if (payload && payload.isCommunalFallback && Array.isArray(payload.findings) && payload.findings.length > 0) {
        const assessment: RiskAssessment = {
          status: "available",
          findings: payload.findings,
          scope: "commune",
          reportUrl,
          checkedAt: new Date().toISOString(),
        };
        cache.set(cacheKey, { assessment, timestamp: Date.now() });
        return assessment;
      }

      // Cas 1.2 : Réponse standard par adresse
      if (payload && typeof payload === "object" && !payload.unavailable) {
        const parsedFindings = parseFindings(payload);
        if (parsedFindings.length > 0 || !insee) {
          const assessment: RiskAssessment = {
            status: "available",
            findings: parsedFindings,
            scope: "address",
            reportUrl,
            checkedAt: new Date().toISOString(),
          };
          cache.set(cacheKey, { assessment, timestamp: Date.now() });
          return assessment;
        }
      }
    }
  } catch {
    // Si l'appel proxy échoue ou timeout, on continue vers le fallback client direct
  }

  // 2. Si le proxy ou l'API d'adresse n'a pas répondu, déclencher le fallback communal direct
  if (insee) {
    const fallbackFindings = await fetchCommunalFallbackClient(insee);
    if (fallbackFindings.length > 0) {
      const assessment: RiskAssessment = {
        status: "available",
        findings: fallbackFindings,
        scope: "commune",
        reportUrl,
        checkedAt: new Date().toISOString(),
      };
      cache.set(cacheKey, { assessment, timestamp: Date.now() });
      return assessment;
    }
  }

  // 3. Si aucun résultat n'a pu être obtenu
  return { status: "unavailable", findings: [], reportUrl };
}
