import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

/**
 * Service pour les gares ferroviaires SNCF Open Data
 * Dataset officiel national des gares de voyageurs en France.
 * 100% gratuit, sans clé, très rapide (~200ms).
 */

const SNCF_API_URL =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/records";
const REQUEST_TIMEOUT_MS = 9000;
// Compatibilité avec un module Vite déjà chargé pendant le développement.
// La valeur reste le rayon normal des gares affichées.
export const SNCF_DISPLAY_RADIUS_METERS = 1200;
const stationCache = new Map<string, POI[]>();

interface SNCFRecord {
  codes_uic?: string;
  nom?: string;
  commune?: string;
  libellecourt?: string;
  // Explore API can serialize geo_point_2d as [latitude, longitude];
  // other responses expose it as an object. Accept both formats.
  position_geographique?: { lat: number; lon: number } | [number, number];
  geopoint?: { lat: number; lon: number } | [number, number];
  nom_gare?: string;
}

export async function fetchSNCFStationsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number = SNCF_DISPLAY_RADIUS_METERS,
): Promise<POI[]> {
  const cacheKey = `${lat.toFixed(5)}:${lon.toFixed(5)}:${radiusMeters}`;
  const cached = stationCache.get(cacheKey);
  if (cached?.length) return cached;
  // Purger également les entrées vides déjà présentes en mémoire avant le
  // correctif, notamment pendant une session de développement encore ouverte.
  if (cached) stationCache.delete(cacheKey);
  const params = new URLSearchParams({
    where: `within_distance(position_geographique, geom'POINT(${lon} ${lat})', ${radiusMeters}m)`,
    limit: "100",
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${SNCF_API_URL}?${params}`, {
        signal: controller.signal,
        cache: "no-store",
      });

    if (!response.ok) {
      throw new Error(`SNCF API status: ${response.status}`);
    }

    const data: { results?: SNCFRecord[] } = await response.json();
    const records = data.results ?? [];

    const pois: POI[] = [];
    for (const rec of records) {
      const position = rec.position_geographique || rec.geopoint;
      if (!position) continue;
      const [rLat, rLon] = Array.isArray(position)
        ? position
        : [position.lat, position.lon];
      if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) continue;
      const dist = calculateDistanceMeters(lat, lon, rLat, rLon);

      if (dist <= radiusMeters) {
        pois.push({
          id: `sncf_${rec.codes_uic || `${rLat}_${rLon}`}`,
          name: rec.nom || rec.nom_gare || rec.libellecourt || `Gare de ${rec.commune || ""}`,
          category: "transports",
          subType: "Gare ferroviaire SNCF",
          lat: rLat,
          lon: rLon,
          distanceMeters: dist,
        });
      }
    }

      const result = pois.sort((a, b) => a.distanceMeters - b.distanceMeters);
      // Une réponse vide peut être transitoire (index SNCF incomplet ou
      // incident côté API). Ne pas la conserver indéfiniment pour ces
      // coordonnées : une analyse ultérieure doit pouvoir retenter la requête.
      if (result.length > 0) stationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (attempt === 1) console.warn("SNCF Gares API indisponible ou hors secteur:", error);
      else await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return [];
}
