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
  const delta = radiusMeters / 111_320;
  const urls = [
    `${GTFS_API}?lat=${lat}&lon=${lon}&radius=${radiusMeters}`,
    `${GTFS_API}?bbox=${encodeURIComponent(`${lon - delta},${lat - delta},${lon + delta},${lat + delta}`)}&limit=500`,
    `${GTFS_API}?min_lat=${lat - delta}&min_lon=${lon - delta}&max_lat=${lat + delta}&max_lon=${lon + delta}&limit=500`,
  ];

  try {
    for (const url of urls) {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) continue;
        const body = await response.json();
        const rows = Array.isArray(body) ? body : body.data || body.results || body.features || [];
        const pois = rows.map((row: any) => {
          const props = row.properties || row;
          const coords = row.geometry?.coordinates;
          const pLat = Number(props.stop_lat ?? props.latitude ?? (coords ? coords[1] : NaN));
          const pLon = Number(props.stop_lon ?? props.longitude ?? (coords ? coords[0] : NaN));
          const distanceMeters = calculateDistanceMeters(lat, lon, pLat, pLon);
          if (!Number.isFinite(pLat) || !Number.isFinite(pLon) || distanceMeters > radiusMeters) return null;
          const name = String(props.stop_name || props.name || "").trim();
          if (!name) return null;
          const agency = String(props.agency_name || props.dataset_organisation || "").trim();
          return { id: `gtfs_${props.di_id || props.stop_id || `${pLat}_${pLon}`}`, name, category: "transports" as const, subType: agency ? `Arrêt de transport · ${agency}` : "Arrêt de transport", lat: pLat, lon: pLon, distanceMeters };
        }).filter(Boolean) as POI[];
        if (pois.length) return pois;
      } catch { /* repli Mapbox */ }
    }
  } finally {
    clearTimeout(timeout);
  }
  return [];
}
