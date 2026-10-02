import type { POI, POICategory } from "../types";

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache multi-niveaux (Mémoire + SessionStorage)
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry {
  pois: POI[];
  timestamp: number;
}

const poisMemoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20 * 60 * 1000;
export const ANALYSIS_RADIUS_METERS = 850;
export const EXTENDED_TRANSIT_RADIUS_METERS = 1200;

function getCacheKey(lat: number, lon: number, radius: number): string {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;
  return `cyt_mapbox_v5_${roundedLat}_${roundedLon}_${radius}`;
}

function getCachedPOIs(key: string): POI[] | null {
  const memEntry = poisMemoryCache.get(key);
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) return memEntry.pois;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed: CacheEntry = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        poisMemoryCache.set(key, parsed);
        return parsed.pois;
      }
      sessionStorage.removeItem(key);
    }
  } catch {}
  return null;
}

function setCachedPOIs(key: string, pois: POI[]): void {
  const entry: CacheEntry = { pois, timestamp: Date.now() };
  poisMemoryCache.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapbox API Integration - Requêtes éclatées avec "Batching" (Évite l'erreur 429)
// ─────────────────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MAPBOX_CATEGORIES: { id: string; baseCategory: POICategory }[] = [
  { id: "bus_stop,bus_station", baseCategory: "transports" },
  { id: "tram,tram_stop,tram_station,light_rail", baseCategory: "transports" },
  { id: "train_station,train,commuter_train", baseCategory: "transports" },
  { id: "subway_station,subway", baseCategory: "transports" },
  { id: "ferry_terminal,bicycle_rental", baseCategory: "transports" },
  { id: "bakery,supermarket,grocery,butcher", baseCategory: "commerces" },
  { id: "pharmacy,hospital,doctor,dentist", baseCategory: "sante" },
  { id: "school,kindergarten,college,university", baseCategory: "ecoles" },
  { id: "park,playground,garden", baseCategory: "espaces_verts" },
  { id: "parking", baseCategory: "stationnement" },
  { id: "museum,cinema,theater,theatre,performing_arts,arts_centre,sports,fitness_center,swimming_pool,library,stadium", baseCategory: "loisirs" },
];

export async function fetchPOIsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number = 800,
  signal?: AbortSignal,
): Promise<POI[]> {
  const cacheKey = getCacheKey(lat, lon, radiusMeters);
  const cached = getCachedPOIs(cacheKey);
  if (cached) return cached;

  if (!MAPBOX_TOKEN) {
    console.error("VITE_MAPBOX_TOKEN is missing!");
    return [];
  }

  try {
    const allPois: POI[] = [];
    const BATCH_SIZE = 1;

    for (let i = 0; i < MAPBOX_CATEGORIES.length; i += BATCH_SIZE) {
      if (signal?.aborted) break;
      const batch = MAPBOX_CATEGORIES.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (queryConfig) => {
        const url = `https://api.mapbox.com/search/searchbox/v1/category/${queryConfig.id}?access_token=${MAPBOX_TOKEN}&proximity=${lon},${lat}&limit=25`;
        try {
          const response = await fetch(url, { signal });
          if (!response.ok) return [];
          const data = await response.json();
          if (!data.features) return [];
          const queryRadius = queryConfig.baseCategory === "transports"
            ? Math.max(radiusMeters, EXTENDED_TRANSIT_RADIUS_METERS)
            : radiusMeters;
          return parseMapboxFeatures(data.features, queryConfig.baseCategory, lat, lon, queryRadius);
        } catch {
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allPois.push(...batchResults.flat());

      // Petite pause entre chaque lot pour laisser respirer l'API Mapbox
      if (i + BATCH_SIZE < MAPBOX_CATEGORIES.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const deduped = deduplicatePOIs(allPois);
    deduped.sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (deduped.length > 0) {
      setCachedPOIs(cacheKey, deduped);
    }
    return deduped;

  } catch (err) {
    console.error("Mapbox POI fetch failed:", err);
    return [];
  }
}

function parseMapboxFeatures(
  features: any[],
  baseCategory: POICategory,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): POI[] {
  const parsedPois: POI[] = [];

  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    const pLon = coords[0];
    const pLat = coords[1];

    const dist = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);
    if (dist > radiusMeters) continue;

    const name = String(f.properties?.name || f.properties?.full_address || "").trim();
    if (!name) continue;
    const poiTypes = f.properties?.poi_category_ids || [];

    // Mapbox peut renvoyer des résultats de catégorie trop larges (et parfois
    // sans type). Pour les écoles et transports, l'identifiant de catégorie est
    // obligatoire : un simple nom ressemblant à une école/une ligne de bus ne
    // suffit pas à créer un point fiable.
    if ((baseCategory === "ecoles" || baseCategory === "transports") && poiTypes.length === 0) {
      continue;
    }

    const { category, subType } = mapboxTypeToCytinside(poiTypes, name, baseCategory, f.properties?.maki);
    if (!category) continue;

    parsedPois.push({
      id: `mapbox_${f.properties?.mapbox_id || Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      subType,
      lat: pLat,
      lon: pLon,
      distanceMeters: dist
    });
  }
  return parsedPois;
}

function mapboxTypeToCytinside(
  types: string[],
  name: string,
  fallbackCategory: POICategory,
  maki?: string
): { category: POICategory | null; subType: string } {
  const tSet = new Set([...types, maki].filter(Boolean));
  const nameLower = name.toLowerCase();

  // Ne jamais laisser le nom d'un résultat changer la famille demandée.
  // Exemple : « Parking du Bus » reste un parking, pas un arrêt de bus.
  if (fallbackCategory === "stationnement") {
    return tSet.has("parking") || nameLower.includes("parking")
      ? { category: "stationnement", subType: "Parking public" }
      : { category: null, subType: "" };
  }

  if (tSet.has("subway") || tSet.has("subway_station") || nameLower.includes("métro") || nameLower.includes("metro"))
    return { category: "transports", subType: "Station de métro" };
  if (tSet.has("tram") || tSet.has("tram_stop") || nameLower.includes("tramway") || nameLower.includes("tram") || tSet.has("light_rail"))
    return { category: "transports", subType: "Arrêt de tramway" };
  if (tSet.has("train_station") || tSet.has("train") || tSet.has("commuter_train") || nameLower.includes("gare"))
    return { category: "transports", subType: "Gare ferroviaire" };
  if (tSet.has("bus") || tSet.has("bus_stop") || tSet.has("bus_station") || tSet.has("transportation") || nameLower.includes("bus") || nameLower.includes("arrêt"))
    return { category: "transports", subType: "Arrêt de bus" };
  if (tSet.has("ferry_terminal") || nameLower.includes("port") || nameLower.includes("ferry"))
    return { category: "transports", subType: "Ferry / Port" };
  if (tSet.has("bicycle_rental") || nameLower.includes("vélo") || nameLower.includes("velov") || nameLower.includes("metrovélo"))
    return { category: "transports", subType: "Station vélo" };

  if (fallbackCategory === "transports") return { category: null, subType: "" };

  if (tSet.has("bakery") || nameLower.includes("boulangerie")) return { category: "commerces", subType: "Boulangerie" };
  if (tSet.has("grocery") || tSet.has("convenience") || nameLower.includes("épicerie")) return { category: "commerces", subType: "Épicerie / Supérette" };
  if (tSet.has("supermarket") || nameLower.includes("supermarché") || nameLower.includes("carrefour") || nameLower.includes("franprix") || nameLower.includes("auchan")) return { category: "commerces", subType: "Supermarché" };
  if (tSet.has("butcher") || nameLower.includes("boucherie")) return { category: "commerces", subType: "Boucherie" };
  if (tSet.has("greengrocer")) return { category: "commerces", subType: "Primeur" };

  if (tSet.has("pharmacy") || nameLower.includes("pharmacie")) return { category: "sante", subType: "Pharmacie" };
  if (tSet.has("hospital") || tSet.has("clinic") || nameLower.includes("hôpital") || nameLower.includes("clinique")) return { category: "sante", subType: "Hôpital / Clinique" };
  if (tSet.has("dentist") || nameLower.includes("dentiste")) return { category: "sante", subType: "Dentiste" };
  if (tSet.has("doctor") || tSet.has("medical") || nameLower.includes("médecin")) return { category: "sante", subType: "Cabinet médical" };

  if (tSet.has("kindergarten") || nameLower.includes("maternelle") || nameLower.includes("crèche")) return { category: "ecoles", subType: "Maternelle / Crèche" };
  if (tSet.has("college") || tSet.has("university") || nameLower.includes("université") || nameLower.includes("campus") || nameLower.includes("lycée")) return { category: "ecoles", subType: "École supérieure / Lycée" };
  if (tSet.has("school") || nameLower.includes("école")) return { category: "ecoles", subType: "École" };

  if (tSet.has("park") || tSet.has("garden") || nameLower.includes("parc") || nameLower.includes("jardin") || nameLower.includes("square")) return { category: "espaces_verts", subType: "Parc / Jardin" };
  if (tSet.has("playground")) return { category: "espaces_verts", subType: "Aire de jeux" };

  if (tSet.has("swimming_pool") || nameLower.includes("piscine")) return { category: "loisirs", subType: "Piscine" };
  if (tSet.has("cinema") || nameLower.includes("cinéma")) return { category: "loisirs", subType: "Cinéma" };
  if (tSet.has("theater") || tSet.has("theatre") || tSet.has("performing_arts") || tSet.has("arts_centre") || nameLower.includes("théâtre") || nameLower.includes("theatre") || nameLower.includes("scène nationale") || nameLower.includes("spectacle")) return { category: "loisirs", subType: "Théâtre / Spectacle" };
  if (tSet.has("museum") || nameLower.includes("musée")) return { category: "loisirs", subType: "Musée" };
  if (tSet.has("library") || nameLower.includes("bibliothèque")) return { category: "loisirs", subType: "Bibliothèque" };
  if (tSet.has("fitness_center") || tSet.has("sports") || tSet.has("stadium") || nameLower.includes("stade") || nameLower.includes("gym")) return { category: "loisirs", subType: "Centre sportif" };

  if (tSet.has("parking") || nameLower.includes("parking")) return { category: "stationnement", subType: "Parking" };

  // Category searches can omit `poi_category_ids`; keep the result with a
  // human label, never with a raw provider type such as an internal ID.
  const fallbackLabels: Record<POICategory, string> = {
    transports: "Arrêt de transport",
    commerces: "Commerce",
    sante: "Professionnel de santé",
    ecoles: "Établissement scolaire",
    espaces_verts: "Parc / Jardin",
    stationnement: "Parking",
    loisirs: "Lieu de loisirs",
  };
  return { category: fallbackCategory, subType: fallbackLabels[fallbackCategory] };
}

function deduplicatePOIs(pois: POI[]): POI[] {
  const result: POI[] = [];
  for (const poi of pois) {
    const isDuplicate = result.some((existing) => {
      if (existing.category !== poi.category) return false;
      const dist = calculateDistanceMeters(existing.lat, existing.lon, poi.lat, poi.lon);
      if (existing.subType === poi.subType && dist <= 28) return true;
      if (existing.name && poi.name) {
        const eName = existing.name.toLowerCase().trim();
        const pName = poi.name.toLowerCase().trim();
        if (eName === pName && dist <= 40) return true;
      }
      return false;
    });

    if (!isDuplicate) {
      result.push(poi);
    } else {
      const existingIndex = result.findIndex(existing => existing.category === poi.category && calculateDistanceMeters(existing.lat, existing.lon, poi.lat, poi.lon) <= 50);
      if (existingIndex >= 0 && (!result[existingIndex].name || result[existingIndex].name.length < poi.name.length)) {
        result[existingIndex] = poi;
      }
    }
  }
  return result;
}
