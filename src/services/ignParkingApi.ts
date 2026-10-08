import type { POI } from "../types";
import { calculateDistanceMeters } from "./osmApi";

const IGN_WFS = "https://data.geopf.fr/wfs/ows";

/** Complément léger BD TOPO : parkings nommés/publics autour du point. */
export async function fetchIGNParkingPOIs(lat: number, lon: number, radiusMeters: number): Promise<POI[]> {
  const delta = radiusMeters / 111320;
  const lonDelta = delta / Math.max(Math.cos(lat * Math.PI / 180), 0.1);
  const params = new URLSearchParams({
    SERVICE: "WFS", VERSION: "2.0.0", REQUEST: "GetFeature",
    TYPENAMES: "BDTOPO_V3:zone_d_activite_ou_d_interet",
    OUTPUTFORMAT: "application/json", COUNT: "50",
    SRSNAME: "EPSG:4326",
    BBOX: `${lon - lonDelta},${lat - delta},${lon + lonDelta},${lat + delta},EPSG:4326`,
  });
  try {
    const response = await fetch(`${IGN_WFS}?${params}`);
    if (!response.ok) return [];
    const body = await response.json();
    return (Array.isArray(body.features) ? body.features : []).map((feature: any) => {
      const coords = feature.geometry?.coordinates;
      const p = feature.properties || {};
      const lonValue = Number(coords?.[0]);
      const latValue = Number(coords?.[1]);
      const nature = String(p.nature || p.nature_detaillee || "").toLowerCase();
      if (!Number.isFinite(latValue) || !Number.isFinite(lonValue) || !/parking|stationnement|aire de stationnement/.test(nature)) return null;
      const distanceMeters = calculateDistanceMeters(lat, lon, latValue, lonValue);
      if (distanceMeters > radiusMeters) return null;
      return { id: `ign_parking_${p.id || `${latValue}_${lonValue}`}`, name: String(p.nom || p.toponyme || "Parking public"), category: "stationnement", subType: "Parking public", lat: latValue, lon: lonValue, distanceMeters } as POI;
    }).filter(Boolean) as POI[];
  } catch { return []; }
}
