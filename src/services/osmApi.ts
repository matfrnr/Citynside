import type { POI, POICategory } from "../types";

/**
 * Calcul de la distance haversine en mètres entre deux coordonnées géographiques
 */
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
  return `cyt_pois_mapbox_${roundedLat}_${roundedLon}_${radius}`;
}

function getCachedPOIs(key: string): POI[] | null {
  const memEntry = poisMemoryCache.get(key);
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
    return memEntry.pois;
  }
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
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {}
  if (poisMemoryCache.size > 80) {
    const oldestKey = poisMemoryCache.keys().next().value;
    if (oldestKey) poisMemoryCache.delete(oldestKey);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapbox API Integration
// ─────────────────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoiYnJhZGxleWJhcmNvbGExMjMiLCJhIjoiY211cW5vaWZoMDl5MDJ3cXJ0ZDA1d2x0MyJ9.n9X52WtZlPQjBY_4aA0A5g";

const MAPBOX_QUERIES = [
  { group: "transports", categories: "bus,train_station,subway,tram" },
  { group: "commerces", categories: "bakery,supermarket,grocery,butcher" },
  { group: "sante", categories: "pharmacy,hospital,doctor,dentist" },
  { group: "ecoles", categories: "school,kindergarten,college,university" },
  { group: "espaces_verts", categories: "park,playground" },
  { group: "stationnement", categories: "parking" },
  { group: "loisirs", categories: "museum,cinema,theater,sports" }
];

export async function fetchPOIsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number = 800,
  signal?: AbortSignal,
): Promise<POI[]> {
  const cacheKey = getCacheKey(lat, lon, radiusMeters);
  const cached = getCachedPOIs(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const fetchPromises = MAPBOX_QUERIES.map(async (queryConfig) => {
      const url = `https://api.mapbox.com/search/searchbox/v1/category/${queryConfig.categories}?access_token=${MAPBOX_TOKEN}&proximity=${lon},${lat}&limit=25`;
      
      const response = await fetch(url, { signal });
      if (!response.ok) return [];
      
      const data = await response.json();
      if (!data.features) return [];
      
      return parseMapboxFeatures(data.features, queryConfig.group as POICategory, lat, lon, radiusMeters);
    });

    const results = await Promise.all(fetchPromises);
    const allPois = results.flat();
    
    const cleanPois = deduplicatePOIs(allPois);
    cleanPois.sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (cleanPois.length > 0) {
      setCachedPOIs(cacheKey, cleanPois);
    }
    
    return cleanPois;
  } catch (error) {
    if (signal?.aborted) return [];
    console.error("Mapbox API Error:", error);
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
    const pLon = f.geometry?.coordinates?.[0];
    const pLat = f.geometry?.coordinates?.[1];
    
    if (!pLat || !pLon) continue;

    const dist = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);
    if (dist > radiusMeters) continue;

    const name = f.properties?.name || "";
    const poiTypes = f.properties?.poi_category_ids || [];
    
    const { category, subType } = mapboxTypeToCytinside(poiTypes, name, baseCategory);
    
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
  fallbackCategory: POICategory
): { category: POICategory | null; subType: string } {
  const tSet = new Set(types);
  const nameLower = name.toLowerCase();

  // Transports
  if (tSet.has("subway") || tSet.has("subway_station") || nameLower.includes("métro") || nameLower.includes("metro")) 
    return { category: "transports", subType: "Station de métro" };
  if (tSet.has("tram") || tSet.has("tram_stop") || nameLower.includes("tramway") || nameLower.includes("tram")) 
    return { category: "transports", subType: "Arrêt de tramway" };
  if (tSet.has("train_station") || nameLower.includes("gare")) 
    return { category: "transports", subType: "Gare ferroviaire" };
  if (tSet.has("bus") || tSet.has("bus_station")) 
    return { category: "transports", subType: "Arrêt de bus" };
  
  // Commerces
  if (tSet.has("bakery") || nameLower.includes("boulangerie")) return { category: "commerces", subType: "Boulangerie" };
  if (tSet.has("grocery") || tSet.has("supermarket") || nameLower.includes("carrefour") || nameLower.includes("franprix")) 
    return { category: "commerces", subType: "Supermarché" };
  if (tSet.has("butcher") || nameLower.includes("boucherie")) return { category: "commerces", subType: "Boucherie" };

  // Santé
  if (tSet.has("pharmacy") || nameLower.includes("pharmacie")) return { category: "sante", subType: "Pharmacie" };
  if (tSet.has("hospital") || nameLower.includes("hôpital") || nameLower.includes("hopital") || nameLower.includes("clinique")) 
    return { category: "sante", subType: "Hôpital" };
  if (tSet.has("dentist") || nameLower.includes("dentiste")) return { category: "sante", subType: "Dentiste" };
  if (tSet.has("doctor") || tSet.has("health_services") || nameLower.includes("médecin")) return { category: "sante", subType: "Cabinet médical" };

  // Ecoles
  if (tSet.has("kindergarten") || nameLower.includes("maternelle") || nameLower.includes("crèche")) 
    return { category: "ecoles", subType: "Maternelle" };
  if (tSet.has("middle_school") || nameLower.includes("collège") || nameLower.includes("college")) 
    return { category: "ecoles", subType: "Collège" };
  if (tSet.has("high_school") || nameLower.includes("lycée") || nameLower.includes("lycee")) 
    return { category: "ecoles", subType: "Lycée" };
  if (tSet.has("elementary_school") || nameLower.includes("primaire") || nameLower.includes("élémentaire") || nameLower.includes("elementaire")) 
    return { category: "ecoles", subType: "École primaire" };
  if (tSet.has("university") || tSet.has("college") || nameLower.includes("université") || nameLower.includes("institut")) 
    return { category: "ecoles", subType: "École supérieure" };
  if (tSet.has("school") || tSet.has("education") || nameLower.includes("école") || nameLower.includes("ecole")) return { category: "ecoles", subType: "École" };

  // Espaces verts
  if (tSet.has("playground") || nameLower.includes("jeux")) return { category: "espaces_verts", subType: "Aire de jeux" };
  if (tSet.has("park") || tSet.has("outdoors") || nameLower.includes("parc") || nameLower.includes("jardin") || nameLower.includes("square")) 
    return { category: "espaces_verts", subType: "Parc / Jardin" };

  // Stationnement
  if (tSet.has("parking") || nameLower.includes("parking")) return { category: "stationnement", subType: "Parking public" };

  // Loisirs
  if (tSet.has("swimming_pool") || nameLower.includes("piscine")) return { category: "loisirs", subType: "Piscine" };
  if (tSet.has("sports_club") || tSet.has("fitness_center") || tSet.has("sports") || nameLower.includes("gym") || nameLower.includes("sport")) return { category: "loisirs", subType: "Centre sportif" };
  if (tSet.has("museum") || nameLower.includes("musée") || nameLower.includes("musee")) return { category: "loisirs", subType: "Musée" };
  if (tSet.has("cinema") || tSet.has("movie_theater") || nameLower.includes("cinéma") || nameLower.includes("cinema")) return { category: "loisirs", subType: "Cinéma" };
  if (tSet.has("theater") || nameLower.includes("théâtre") || nameLower.includes("theatre")) return { category: "loisirs", subType: "Théâtre" };
  if (tSet.has("library") || nameLower.includes("bibliothèque") || nameLower.includes("mediatheque")) return { category: "loisirs", subType: "Bibliothèque" };

  const fallbackMap: Record<POICategory, string> = {
    transports: "Arrêt de transport",
    commerces: "Commerce",
    sante: "Professionnel de santé",
    ecoles: "Établissement scolaire",
    espaces_verts: "Espace vert",
    stationnement: "Parking",
    loisirs: "Loisir"
  };

  return { category: fallbackCategory, subType: fallbackMap[fallbackCategory] };
}

function deduplicatePOIs(pois: POI[]): POI[] {
  const result: POI[] = [];

  for (const poi of pois) {
    const isDuplicate = result.some((existing) => {
      if (existing.category !== poi.category) return false;
      const dist = calculateDistanceMeters(
        existing.lat,
        existing.lon,
        poi.lat,
        poi.lon,
      );

      if (existing.subType === poi.subType && dist <= 20) {
        return true;
      }

      if (existing.name && poi.name) {
        const eName = existing.name.toLowerCase().trim();
        const pName = poi.name.toLowerCase().trim();
        if ((eName === pName || eName.includes(pName) || pName.includes(eName)) && dist <= 50) {
          return true;
        }
      }

      return false;
    });

    if (!isDuplicate) {
      result.push(poi);
    }
  }

  return result;
}
