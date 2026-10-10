import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

// API expérimentale de la carte consolidée GTFS du PAN. Elle complète les
// résultats Mapbox, qui ne renvoie qu'un nombre plafonné d'arrêts.
const GTFS_API = "/api/gtfs-stops";
const TIMEOUT_MS = 5_000;
const NEARBY_QUERY_PADDING_METERS = 250;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 40;

interface TransitStopsCacheEntry {
  pois: POI[];
  savedAt: number;
  centerLat: number;
  centerLon: number;
  queryRadiusMeters: number;
}

const transitStopsCache = new Map<string, TransitStopsCacheEntry>();

function getCacheKey(lat: number, lon: number, radiusMeters: number): string {
  return `${lat.toFixed(6)}:${lon.toFixed(6)}:${radiusMeters}`;
}

function readReusableCache(lat: number, lon: number, radiusMeters: number): POI[] | null {
  const now = Date.now();
  for (const [key, entry] of [...transitStopsCache.entries()].reverse()) {
    if (now - entry.savedAt >= CACHE_TTL_MS) {
      transitStopsCache.delete(key);
      continue;
    }
    const offsetFromCachedCenter = calculateDistanceMeters(lat, lon, entry.centerLat, entry.centerLon);
    // Réutiliser les mêmes arrêts quand une adresse voisine est couverte par
    // la marge de la requête précédente, puis recalculer toutes les distances.
    if (offsetFromCachedCenter + radiusMeters + 2 > entry.queryRadiusMeters) continue;
    transitStopsCache.delete(key);
    transitStopsCache.set(key, entry);
    return entry.pois
      .map((poi) => ({ ...poi, distanceMeters: calculateDistanceMeters(lat, lon, poi.lat, poi.lon) }))
      .filter((poi) => poi.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
  return null;
}

function writeCache(key: string, pois: POI[], lat: number, lon: number, queryRadiusMeters: number): void {
  transitStopsCache.delete(key);
  transitStopsCache.set(key, { pois, savedAt: Date.now(), centerLat: lat, centerLon: lon, queryRadiusMeters });
  while (transitStopsCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = transitStopsCache.keys().next().value;
    if (!oldestKey) break;
    transitStopsCache.delete(oldestKey);
  }
}

function extractRows(body: any): any[] {
  if (Array.isArray(body)) return body;
  for (const value of [body?.data, body?.results, body?.features, body?.stops]) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function parseStops(rows: any[], centerLat: number, centerLon: number, queryRadiusMeters: number): POI[] {
  return rows.flatMap((row: any) => {
    const props = row?.properties || row || {};
    const coords = row?.geometry?.coordinates;
    const pLat = Number(props.stop_lat ?? props.latitude ?? (coords ? coords[1] : NaN));
    const pLon = Number(props.stop_lon ?? props.longitude ?? (coords ? coords[0] : NaN));
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon) || Math.abs(pLat) > 90 || Math.abs(pLon) > 180) return [];
    const distanceMeters = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);
    if (distanceMeters > queryRadiusMeters) return [];
    const name = String(props.stop_name || props.name || "").trim();
    if (!name) return [];

    const source = String(props.dataset_title || props.dataset_custom_title || props.d_title || props.agency_name || "").trim();
    // Ne pas déduire le mode du nom du réseau (un réseau peut desservir
    // bus et tram) : utiliser uniquement les champs de mode de l'arrêt.
    const modeText = `${props.route_type_name || ""} ${props.route_type || ""} ${props.vehicle_type || ""} ${props.mode || ""} ${name}`.toLowerCase();
    const stopText = name.toLowerCase();
    const isGareRoutiere = /\bgare routi[èe]re\b/.test(stopText);
    const hasStreetAddress = /\b(rue|avenue|av|boulevard|bd|bvd|place|pl|route|pont|chemin)\b.*(\bgare\b|\bsncf\b|\bter\b)/.test(stopText);
    const isBusOrCar = /\b(bus|car|cars|autocar|autocars)\b/.test(modeText);
    const explicitRail = !isGareRoutiere && !/parking|parkings|stationnement/.test(stopText) && !hasStreetAddress && !isBusOrCar && (
      /\b(sncf|ter|tgv|train|ferroviaire)\b/.test(stopText) ||
      /\b(sncf|ter|tgv|ferroviaire)\b/.test(source.toLowerCase())
    );
    const routeType = String(props.route_type ?? props.routeType ?? "").trim();
    const subType = /\b(tram|tramway|light rail)\b/.test(modeText) || routeType === "0"
      ? "Arrêt de tramway / métro"
      : /\b(métro|metro|subway)\b/.test(modeText) || routeType === "1"
        ? "Arrêt de tramway / métro"
        : explicitRail
          ? "Gare / arrêt ferroviaire"
          : isBusOrCar
            ? "Arrêt de car"
            : "Arrêt de transport";

    return [{
      id: `gtfs_${props.di_id || props.stop_id || `${pLat}_${pLon}`}`,
      name,
      category: "transports" as const,
      subType,
      lat: pLat,
      lon: pLon,
      distanceMeters,
    }];
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchNationalTransitStops(
  lat: number,
  lon: number,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<POI[]> {
  const cacheKey = getCacheKey(lat, lon, radiusMeters);
  const cached = readReusableCache(lat, lon, radiusMeters);
  if (cached) return cached;

  // Une requête couvre aussi les environs immédiats pour que deux adresses
  // proches réutilisent la même liste de candidats, sans modifier le rayon
  // réellement évalué ni les distances affichées.
  const queryRadiusMeters = radiusMeters + NEARBY_QUERY_PADDING_METERS;
  const latDelta = queryRadiusMeters / 111_320;
  const lonDelta = latDelta / Math.max(Math.cos(lat * Math.PI / 180), 0.1);
  const params = new URLSearchParams({
    south: String(lat - latDelta), north: String(lat + latDelta),
    west: String(lon - lonDelta), east: String(lon + lonDelta),
  });
  const url = `${GTFS_API}?${params}`;
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) return [];
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          if (attempt === 0 && (response.status >= 500 || response.status === 429)) {
            await delay(250);
            continue;
          }
          return [];
        }

        const body = await response.json();
        const pois = parseStops(extractRows(body), lat, lon, queryRadiusMeters);
        if (pois.length > 0) writeCache(cacheKey, pois, lat, lon, queryRadiusMeters);
        return pois
          .map((poi) => ({ ...poi, distanceMeters: calculateDistanceMeters(lat, lon, poi.lat, poi.lon) }))
          .filter((poi) => poi.distanceMeters <= radiusMeters)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);
      } catch (error: any) {
        if (signal?.aborted || error?.name === "AbortError") return [];
        if (attempt === 1) return [];
        await delay(250);
      }
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onParentAbort);
  }
  return [];
}
