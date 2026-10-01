import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

const EDUCATION_API_URL =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre/records";
const REQUEST_TIMEOUT_MS = 8000;

interface EducationRecord {
  numero_uai?: string;
  appellation_officielle?: string;
  nature_uai_libe?: string;
  etat_etablissement_libe?: string;
  latitude?: number;
  longitude?: number;
}

export async function fetchEducationPOIsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<POI[]> {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    latitudeDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);
  const params = new URLSearchParams({
    select:
      "numero_uai,appellation_officielle,nature_uai_libe,etat_etablissement_libe,latitude,longitude",
    where: [
      `latitude >= ${lat - latitudeDelta}`,
      `latitude <= ${lat + latitudeDelta}`,
      `longitude >= ${lon - longitudeDelta}`,
      `longitude <= ${lon + longitudeDelta}`,
      'etat_etablissement_libe = "OUVERT"',
    ].join(" AND "),
    limit: "100",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${EDUCATION_API_URL}?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`API Éducation indisponible (${response.status})`);
    }

    const data: { results?: EducationRecord[] } = await response.json();
    return (data.results ?? [])
      .filter(
        (record) => record.etat_etablissement_libe?.toUpperCase() === "OUVERT",
      )
      .map((record) => toPOI(record, lat, lon))
      .filter((poi): poi is POI => poi !== null)
      .filter((poi) => poi.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (error) {
    console.warn(
      "Impossible de récupérer les établissements scolaires officiels:",
      error,
    );
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function cleanSchoolName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(
      /\b(ecole|primaire|elementaire|maternelle|college|lycee|groupe|scolaire|public|publique|prive|privee|de|du|des|la|le|les|d|l)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isSameSchool(osmPOI: POI, eduPOI: POI): boolean {
  if (osmPOI.category !== "ecoles" || eduPOI.category !== "ecoles") return false;

  const dist = calculateDistanceMeters(
    osmPOI.lat,
    osmPOI.lon,
    eduPOI.lat,
    eduPOI.lon,
  );

  // 1. Distance rapprochée (un campus scolaire ou bâtiment fait 30-70m de large)
  // L'adresse officielle BAN et le portail OSM sont très souvent distants de 20 à 50m.
  if (dist <= 60) {
    return true;
  }

  // 2. Distance moyenne (jusqu'à 140m) si les noms patronymiques correspondent
  const n1 = cleanSchoolName(osmPOI.name);
  const n2 = cleanSchoolName(eduPOI.name);
  if (n1.length >= 3 && n2.length >= 3) {
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) {
      return dist <= 140;
    }
  }

  return false;
}

export function mergeEducationPOIs(
  osmPOIs: POI[],
  educationPOIs: POI[],
): POI[] {
  // Conserver les POIs non-écoles d'OSM, et les écoles OSM qui ne correspondent à aucune école officielle
  const unmatchedOSM = osmPOIs.filter(
    (osmPOI) =>
      osmPOI.category !== "ecoles" ||
      !educationPOIs.some((eduPOI) => isSameSchool(osmPOI, eduPOI)),
  );

  return [...unmatchedOSM, ...educationPOIs].sort(
    (a, b) => a.distanceMeters - b.distanceMeters,
  );
}

function toPOI(
  record: EducationRecord,
  centerLat: number,
  centerLon: number,
): POI | null {
  const lat = Number(record.latitude);
  const lon = Number(record.longitude);
  const nature = record.nature_uai_libe?.toUpperCase() ?? "";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let subType: string;
  const nameUpper = (record.appellation_officielle ?? "").toUpperCase();

  const isHigherEd =
    nameUpper.includes("SUPERIEUR") ||
    nameUpper.includes("UNIVERSIT") ||
    nameUpper.includes("INSTITUT") ||
    nameUpper.includes("CAMPUS") ||
    nameUpper.includes("FACULTE") ||
    nameUpper.includes("IUT") ||
    nameUpper.includes("BTS") ||
    nameUpper.includes("CPGE") ||
    nameUpper.includes("INGENIEUR") ||
    nameUpper.includes("BUSINESS") ||
    nameUpper.includes("MANAGEMENT") ||
    nameUpper.includes("ENS") ||
    nature.includes("SUPERIEUR") ||
    nature.includes("UNIVERSIT");

  if (isHigherEd) {
    subType = "École supérieure";
  } else if (nature.startsWith("ECOLE MATERNELLE")) {
    subType = "Maternelle";
  } else if (
    nature.startsWith("ECOLE DE NIVEAU") ||
    nature.startsWith("ECOLE ELEMENTAIRE") ||
    nature.startsWith("ECOLE PRIMAIRE")
  ) {
    subType = "École primaire";
  } else if (nature.startsWith("COLLEGE")) {
    subType = "Collège";
  } else if (nature.startsWith("LYCEE")) {
    subType = "Lycée";
  } else {
    subType = "Établissement scolaire";
  }

  return {
    id: `education_${record.numero_uai ?? `${lat}_${lon}`}`,
    name: record.appellation_officielle?.trim() || subType,
    category: "ecoles",
    subType,
    lat,
    lon,
    distanceMeters: calculateDistanceMeters(centerLat, centerLon, lat, lon),
  };
}
