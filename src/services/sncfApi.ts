import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

/**
 * Service pour les gares ferroviaires SNCF Open Data
 * Dataset officiel national des gares de voyageurs en France.
 * 100% gratuit, sans clé, très rapide (~200ms).
 */

const SNCF_API_URL =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/records";
const REQUEST_TIMEOUT_MS = 4000;

interface SNCFRecord {
  codes_uic?: string;
  nom?: string;
  commune?: string;
  libellecourt?: string;
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
  const params = new URLSearchParams({
    where: `within_distance(position_geographique, geom'POINT(${lon} ${lat})', ${radiusMeters}m)`,
    limit: "15",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SNCF_API_URL}?${params}`, {
      signal: controller.signal,
    });

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
          id: `sncf_${rec.codes_uic || `${rLat}_${rLon}`}`,
          name: rec.nom || `Gare de ${rec.commune || ""}`,
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
    console.warn("SNCF Gares API indisponible ou hors secteur:", error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
