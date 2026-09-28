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
  const R = 6371e3; // Rayon de la Terre en mètres
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
// Cache multi-niveaux (Mémoire + SessionStorage) pour éliminer les latences
// Clé = coordonnées arrondies + rayon
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry {
  pois: POI[];
  timestamp: number;
}

const poisMemoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

function getCacheKey(lat: number, lon: number, radius: number): string {
  // Arrondir à ~20m de précision pour regrouper les requêtes proches
  const roundedLat = Math.round(lat * 500) / 500;
  const roundedLon = Math.round(lon * 500) / 500;
  return `cyt_pois_${roundedLat}_${roundedLon}_${radius}`;
}

function getCachedPOIs(key: string): POI[] | null {
  // 1. Vérifier la mémoire
  const memEntry = poisMemoryCache.get(key);
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
    return memEntry.pois;
  }

  // 2. Vérifier sessionStorage
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
  } catch {
    // Ignore sessionStorage errors
  }

  return null;
}

function setCachedPOIs(key: string, pois: POI[]): void {
  const entry: CacheEntry = { pois, timestamp: Date.now() };
  poisMemoryCache.set(key, entry);

  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // SessionStorage full or unavailable
  }

  // Nettoyage si le cache mémoire grandit trop
  if (poisMemoryCache.size > 80) {
    const oldestKey = poisMemoryCache.keys().next().value;
    if (oldestKey) poisMemoryCache.delete(oldestKey);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Miroirs Overpass fiables et performants
// ─────────────────────────────────────────────────────────────────────────────
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Requête Overpass API optimisée pour la vitesse et la robustesse.
 * - Ciblage des `node` et `way` (sans les relations lourdes qui causent des timeouts)
 * - Timeout calibré (9s serveur, 7.5s client)
 * - Bascule rapide sur les miroirs officiels
 * - Cache persistant en sessionStorage
 */
export async function fetchPOIsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number = 800,
): Promise<POI[]> {
  const cacheKey = getCacheKey(lat, lon, radiusMeters);
  const cached = getCachedPOIs(cacheKey);
  if (cached) {
    return cached;
  }

  // Requête optimisée combinée
  const overpassQuery = `
    [out:json][timeout:9];
    (
      node(around:${radiusMeters},${lat},${lon})["highway"="bus_stop"];
      node(around:${radiusMeters},${lat},${lon})["railway"~"tram_stop|station|halt"];
      node(around:${radiusMeters},${lat},${lon})["station"="subway"];
      node(around:${radiusMeters},${lat},${lon})["amenity"="bicycle_rental"];
      node(around:${radiusMeters},${lat},${lon})["amenity"="parking"];
      node(around:${radiusMeters},${lat},${lon})["shop"~"bakery|supermarket|convenience|butcher|greengrocer"];
      node(around:${radiusMeters},${lat},${lon})["amenity"~"pharmacy|doctors|clinic|hospital|dentist"];
      node(around:${radiusMeters},${lat},${lon})["amenity"~"school|kindergarten|college|university"];
      node(around:${radiusMeters},${lat},${lon})["leisure"~"park|garden|playground"];
      way(around:${radiusMeters},${lat},${lon})["amenity"~"parking|pharmacy|hospital|clinic|school|college"];
      way(around:${radiusMeters},${lat},${lon})["shop"~"bakery|supermarket"];
      way(around:${radiusMeters},${lat},${lon})["leisure"~"park|garden"];
    );
    out center body 160;
  `;

  const pois = await fetchFastFromOverpass(overpassQuery, lat, lon);

  if (pois.length > 0) {
    setCachedPOIs(cacheKey, pois);
  }

  return pois;
}

/**
 * Tente la requête Overpass avec bascule rapide sur les miroirs performants
 */
async function fetchFastFromOverpass(
  query: string,
  centerLat: number,
  centerLon: number,
): Promise<POI[]> {
  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    const mirrorUrl = OVERPASS_MIRRORS[i];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s timeout

      const response = await fetch(mirrorUrl, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const results = parseOverpassResponse(data, centerLat, centerLon);
      if (results.length > 0) {
        return results;
      }
    } catch {
      // Passer au miroir suivant
      continue;
    }
  }

  return [];
}

/**
 * Parse la réponse Overpass et extrait les POIs avec leurs coordonnées précises.
 * Gère correctement les nodes (lat/lon directement) et les ways/relations (via center).
 * Déduplique les résultats par proximité (même POI cartographié plusieurs fois).
 */
function parseOverpassResponse(
  data: any,
  centerLat: number,
  centerLon: number,
): POI[] {
  if (!data?.elements?.length) {
    return [];
  }

  const rawPois: POI[] = [];

  for (const el of data.elements) {
    // Les nodes ont lat/lon directement ; les ways/relations ont un champ center
    const pLat = el.type === "node" ? el.lat : el.center?.lat;
    const pLon = el.type === "node" ? el.lon : el.center?.lon;

    if (pLat == null || pLon == null) continue;

    // Validation basique des coordonnées : elles doivent être dans un rayon raisonnable
    if (Math.abs(pLat) > 90 || Math.abs(pLon) > 180) continue;

    const tags = el.tags || {};
    const { category, subType, name } = classifyOSMElement(tags);

    if (!category) continue;

    const dist = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);

    rawPois.push({
      id: `osm_${el.type}_${el.id}`,
      name: name || `${subType}`,
      category,
      subType,
      lat: pLat,
      lon: pLon,
      distanceMeters: dist,
    });
  }

  // Dédupliquer : si deux POIs de la même catégorie et du même sous-type sont à < 30m,
  // garder celui avec un nom (ou le plus proche)
  const deduped = deduplicatePOIs(rawPois);

  // Tri par distance croissante
  deduped.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return deduped;
}

/**
 * Déduplique les POIs identiques ou très proches.
 * Souvent un même équipement est cartographié à la fois comme node ET way dans OSM.
 */
function deduplicatePOIs(pois: POI[]): POI[] {
  const result: POI[] = [];

  for (const poi of pois) {
    const isDuplicate = result.some(
      (existing) =>
        existing.category === poi.category &&
        existing.subType === poi.subType &&
        calculateDistanceMeters(existing.lat, existing.lon, poi.lat, poi.lon) <
          30,
    );

    if (!isDuplicate) {
      result.push(poi);
    } else {
      // Si le doublon a un nom et pas l'existant, remplacer
      const existingIndex = result.findIndex(
        (existing) =>
          existing.category === poi.category &&
          existing.subType === poi.subType &&
          calculateDistanceMeters(
            existing.lat,
            existing.lon,
            poi.lat,
            poi.lon,
          ) < 30,
      );
      if (existingIndex >= 0 && !result[existingIndex].name && poi.name) {
        result[existingIndex] = poi;
      }
    }
  }

  return result;
}

function classifyOSMElement(tags: Record<string, string>): {
  category: POICategory | null;
  subType: string;
  name: string;
} {
  const name = tags.name || "";

  // Transports
  if (tags.station === "subway" || tags.subway === "yes") {
    return { category: "transports", subType: "Station de métro", name };
  }
  if (tags.railway === "tram_stop" || tags.tram === "yes") {
    return { category: "transports", subType: "Arrêt de tramway", name };
  }
  if (
    tags.railway === "station" ||
    tags.railway === "halt" ||
    tags.train === "yes"
  ) {
    return { category: "transports", subType: "Gare ferroviaire", name };
  }
  if (tags.highway === "bus_stop" || tags.bus === "yes") {
    return { category: "transports", subType: "Arrêt de bus", name };
  }
  if (tags.amenity === "bicycle_rental") {
    return {
      category: "transports",
      subType: "Station vélo libre-service",
      name,
    };
  }

  // Stationnement
  if (tags.amenity === "parking") {
    return { category: "stationnement", subType: "Parking public", name };
  }

  // Commerces
  if (tags.shop === "bakery") {
    return { category: "commerces", subType: "Boulangerie", name };
  }
  if (tags.shop === "supermarket") {
    return { category: "commerces", subType: "Supermarché", name };
  }
  if (tags.shop === "convenience") {
    return { category: "commerces", subType: "Épicerie / Supérette", name };
  }
  if (tags.shop === "butcher") {
    return { category: "commerces", subType: "Boucherie", name };
  }
  if (tags.shop === "greengrocer") {
    return { category: "commerces", subType: "Primeur", name };
  }

  // Santé
  if (tags.amenity === "pharmacy") {
    return { category: "sante", subType: "Pharmacie", name };
  }
  if (tags.amenity === "hospital") {
    return { category: "sante", subType: "Hôpital", name };
  }
  if (tags.amenity === "clinic") {
    return { category: "sante", subType: "Clinique", name };
  }
  if (tags.amenity === "doctors") {
    return { category: "sante", subType: "Cabinet médical", name };
  }
  if (tags.amenity === "dentist") {
    return { category: "sante", subType: "Dentiste", name };
  }

  // Écoles
  if (tags.amenity === "kindergarten") {
    return { category: "ecoles", subType: "Maternelle / Crèche", name };
  }
  if (tags.amenity === "school") {
    return { category: "ecoles", subType: "École", name };
  }
  if (tags.amenity === "college") {
    // Attention : dans OSM, "college" = établissement d'enseignement supérieur court,
    // pas "collège" français. Mais en France c'est souvent utilisé pour les collèges.
    return { category: "ecoles", subType: "Collège / Lycée", name };
  }
  if (tags.amenity === "university") {
    return { category: "ecoles", subType: "Université", name };
  }

  // Espaces verts
  if (tags.leisure === "park" || tags.leisure === "garden") {
    return { category: "espaces_verts", subType: "Parc / Jardin", name };
  }
  if (tags.leisure === "playground") {
    return { category: "espaces_verts", subType: "Aire de jeux", name };
  }
  if (tags.landuse === "recreation_ground") {
    return { category: "espaces_verts", subType: "Terrain de loisirs", name };
  }

  return { category: null, subType: "", name: "" };
}
