import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

/**
 * Service pour les gares ferroviaires SNCF Open Data
 * Dataset officiel national des gares de voyageurs en France.
 * 100% gratuit, sans clé, très rapide (~200ms).
 */

const SNCF_API_URL =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/referentiel-gares-voyageurs/records";
const REQUEST_TIMEOUT_MS = 4000;

interface SNCFRecord {
  code_uic?: string;
  alias_libelle_noncontraint?: string;
  commune?: string;
  position_geographique?: {
    lat: number;
    lon: number;
  };
}

export async function fetchSNCFStationsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number = 1200,
): Promise<POI[]> {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    latitudeDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);

  const whereClause = [
    `position_geographique.lat >= ${lat - latitudeDelta}`,
    `position_geographique.lat <= ${lat + latitudeDelta}`,
    `position_geographique.lon >= ${lon - longitudeDelta}`,
    `position_geographique.lon <= ${lon + longitudeDelta}`,
  ].join(" AND ");

  const params = new URLSearchParams({
    where: whereClause,
    limit: "15",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SNCF_API_URL}?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SNCF API status: ${response.status}`);
    }

    const data: { results?: SNCFRecord[] } = await response.json();
    const records = data.results ?? [];

    const pois: POI[] = [];
    for (const rec of records) {
      if (!rec.position_geographique) continue;
      const rLat = rec.position_geographique.lat;
      const rLon = rec.position_geographique.lon;
      const dist = calculateDistanceMeters(lat, lon, rLat, rLon);

      if (dist <= radiusMeters) {
        pois.push({
          id: `sncf_${rec.code_uic || `${rLat}_${rLon}`}`,
          name: rec.alias_libelle_noncontraint || `Gare de ${rec.commune || ""}`,
          category: "transports",
          subType: "Gare ferroviaire SNCF",
          lat: rLat,
          lon: rLon,
          distanceMeters: dist,
        });
      }
    }

    return pois.sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn("SNCF Gares API indisponible ou hors secteur:", error);
    return [];
  }
}
