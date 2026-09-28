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

export function mergeEducationPOIs(
  osmPOIs: POI[],
  educationPOIs: POI[],
): POI[] {
  const unmatchedOSMSchools = osmPOIs.filter(
    (osmPOI) =>
      osmPOI.category !== "ecoles" ||
      !educationPOIs.some(
        (educationPOI) =>
          educationPOI.category === "ecoles" &&
          calculateDistanceMeters(
            osmPOI.lat,
            osmPOI.lon,
            educationPOI.lat,
            educationPOI.lon,
          ) <= 35,
      ),
  );

  return [...unmatchedOSMSchools, ...educationPOIs].sort(
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
  if (nature.startsWith("ECOLE MATERNELLE")) {
    subType = "Maternelle";
  } else if (
    nature.startsWith("ECOLE DE NIVEAU") ||
    nature.startsWith("ECOLE ELEMENTAIRE") ||
    nature.startsWith("ECOLE PRIMAIRE")
  ) {
    subType = "École";
  } else if (nature.startsWith("COLLEGE") || nature.startsWith("LYCEE")) {
    subType = "Collège / Lycée";
  } else {
    return null;
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
