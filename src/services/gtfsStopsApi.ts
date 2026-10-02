import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

// API expérimentale de la carte consolidée GTFS du PAN. Elle interroge les
// arrêts côté serveur, sans télécharger le CSV national de plusieurs centaines
// de Mo dans le navigateur.
// Requête locale/proxy Netlify pour éviter le CORS du PAN.
const GTFS_API = "/api/gtfs-stops";
const TIMEOUT_MS = 1800;

export async function fetchNationalTransitStops(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<POI[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const latDelta = radiusMeters / 111_320;
  const lonDelta = latDelta / Math.max(Math.cos(lat * Math.PI / 180), 0.1);
  const params = new URLSearchParams({
    south: String(lat - latDelta), north: String(lat + latDelta),
    west: String(lon - lonDelta), east: String(lon + lonDelta),
  });
  const urls = [`${GTFS_API}?${params}`];

  try {
    for (const url of urls) {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) continue;
        const body = await response.json();
        const rows = Array.isArray(body) ? body : body.data || body.results || body.features || body.stops || [];
        const pois = rows.map((row: any) => {
          const props = row.properties || row;
          const coords = row.geometry?.coordinates;
          const pLat = Number(props.stop_lat ?? props.latitude ?? (coords ? coords[1] : NaN));
          const pLon = Number(props.stop_lon ?? props.longitude ?? (coords ? coords[0] : NaN));
          const distanceMeters = calculateDistanceMeters(lat, lon, pLat, pLon);
          if (!Number.isFinite(pLat) || !Number.isFinite(pLon) || distanceMeters > radiusMeters) return null;
          const name = String(props.stop_name || props.name || "").trim();
          if (!name) return null;
          const source = String(props.dataset_title || props.d_title || props.agency_name || "").trim();
          const modeText = `${source} ${name}`.toLowerCase();
          const sourceText = source.toLowerCase();
          const stopText = name.toLowerCase();
          const isGareRoutiere = /\bgare routi[èe]re\b/.test(stopText);
          const hasStreetAddress = /\b(rue|avenue|av|boulevard|bd|bvd|place|pl|route|pont|chemin)\b.*(\bgare\b|\bsncf\b|\bter\b)/.test(stopText);
          const isBusOrCar = /\b(bus|car|cars|autocar|autocars)\b/.test(modeText);
          const explicitRail = !isGareRoutiere && !hasStreetAddress && !isBusOrCar && (
            /(\bgare\b|\bsncf\b|\bter\b|ferroviaire)/.test(stopText) ||
            /(\bsncf\b|\bter\b|ferroviaire)/.test(sourceText)
          );
          const subType = /tram|light rail|métro|metro/.test(modeText)
            ? "Arrêt de tramway / métro"
            : explicitRail
              ? "Gare / arrêt ferroviaire"
              : isBusOrCar
                ? "Arrêt de car"
                : "Arrêt de transport";
          return { id: `gtfs_${props.di_id || props.stop_id || `${pLat}_${pLon}`}`, name, category: "transports" as const, subType, lat: pLat, lon: pLon, distanceMeters };
        }).filter(Boolean) as POI[];
        if (pois.length) return pois;
      } catch { /* repli Mapbox */ }
    }
  } finally {
    clearTimeout(timeout);
  }
  return [];
}
