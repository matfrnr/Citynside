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

export async function fetchRiskAssessment(lat: number, lon: number): Promise<RiskAssessment> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.assessment;

  const reportUrl = `https://georisques.gouv.fr/api/v1/rapport_pdf?latlon=${encodeURIComponent(`${lon},${lat}`)}`;
  try {
    // Toujours passer par le proxy same-origin : l'API Géorisques ferme
    // parfois la connexion HTTP/2 du navigateur et ne gère pas le CORS.
    const endpoint = `/api/georisques?latlon=${encodeURIComponent(`${lon},${lat}`)}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Géorisques indisponible (${response.status})`);
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && (payload as { unavailable?: boolean }).unavailable) {
      return { status: "unavailable", findings: [], reportUrl };
    }
    const assessment: RiskAssessment = {
      status: "available",
      findings: parseFindings(payload),
      reportUrl,
      checkedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { assessment, timestamp: Date.now() });
    return assessment;
  } catch (error) {
    // Géorisques peut interrompre ses connexions pendant une maintenance.
    // Cette consultation reste optionnelle et ne doit pas polluer la console.
    return { status: "unavailable", findings: [], reportUrl };
  }
}
