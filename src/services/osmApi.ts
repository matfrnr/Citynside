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
  // Arrondir à ~11m de précision (0.0001°) pour éviter de mélanger les résultats de deux adresses proches
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;
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
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
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

  // Requête optimisée combinée — utilise `out center qt` pour obtenir les coordonnées du centre
  // des ways (bâtiments) plutôt que d'avoir besoin de résoudre les nœuds constitutifs
  const overpassQuery = `
    [out:json][timeout:12];
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
      way(around:${radiusMeters},${lat},${lon})["amenity"~"parking|pharmacy|hospital|clinic|school|college|university"];
      way(around:${radiusMeters},${lat},${lon})["shop"~"bakery|supermarket|convenience"];
      way(around:${radiusMeters},${lat},${lon})["leisure"~"park|garden|playground"];
    );
    out center qt 200;
  `;

  const pois = await fetchFastFromOverpass(overpassQuery, lat, lon);

  if (pois.length > 0) {
    setCachedPOIs(cacheKey, pois);
    return pois;
  }

  // Si Overpass ne retourne rien, on ne génère PAS de faux POIs.
  // Les résultats des autres APIs (Éducation Nationale, SNCF) complètent le tableau.
  console.warn("Overpass n'a retourné aucun résultat pour cette zone. Les marqueurs carte seront limités aux données officielles (Éducation Nationale, SNCF).");
  return [];
}

// SUPPRIMÉ : l'ancien générateur de POIs fictifs de repli (generateLocalizedFallbackPOIs)
// qui créait des lieux inventés avec des coordonnées approximatives.
// Désormais, seules les données réelles (APIs Overpass, Éducation Nationale, SNCF) sont utilisées.

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
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout (Overpass peut être lent)

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

    // Vérifier que le POI est bien dans un rayon raisonnable (2x le rayon demandé, car Overpass peut déborder)
    const distCheck = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);
    if (distCheck > 2000) continue; // Ignorer les résultats aberrants à >2km

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

  // Dédupliquer : si deux POIs de la même catégorie et du même sous-type sont à < 20m,
  // garder celui avec un nom (ou le plus proche). Seuil réduit à 20m pour éviter de fusionner
  // deux commerces distincts qui sont proches (ex: 2 boulangeries dans la même rue).
  const deduped = deduplicatePOIs(rawPois);

  // Tri par distance croissante
  deduped.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return deduped;
}

function cleanNameForDedup(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(
      /\b(ecole|primaire|elementaire|maternelle|college|lycee|groupe|scolaire|public|publique|prive|privee|de|du|des|la|le|les|d|l)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Déduplique les POIs identiques ou très proches.
 * Souvent un même équipement est cartographié à la fois comme node ET way dans OSM (ex: porte d'entrée + polygone toit).
 */
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

      // Pour les écoles : un campus ou bâtiment s'étend sur 30-70m
      if (poi.category === "ecoles") {
        if (dist <= 45) return true;
        const n1 = cleanNameForDedup(existing.name);
        const n2 = cleanNameForDedup(poi.name);
        if (
          n1.length >= 3 &&
          n2.length >= 3 &&
          (n1 === n2 || n1.includes(n2) || n2.includes(n1))
        ) {
          return dist <= 120;
        }
        return false;
      }

      // Même sous-type à moins de 28m
      if (existing.subType === poi.subType && dist <= 28) {
        return true;
      }

      // Même nom exact ou très approchant à moins de 40m
      if (existing.name && poi.name) {
        const eName = existing.name.toLowerCase().trim();
        const pName = poi.name.toLowerCase().trim();
        if (eName === pName && dist <= 40) {
          return true;
        }
      }

      return false;
    });

    if (!isDuplicate) {
      result.push(poi);
    } else {
      // Si le doublon a un nom plus informatif, le conserver
      const existingIndex = result.findIndex(
        (existing) =>
          existing.category === poi.category &&
          calculateDistanceMeters(
            existing.lat,
            existing.lon,
            poi.lat,
            poi.lon,
          ) <= 50,
      );
      if (
        existingIndex >= 0 &&
        (!result[existingIndex].name ||
          result[existingIndex].name.length < poi.name.length)
      ) {
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

  // Écoles & Enseignement
  if (tags.amenity === "kindergarten") {
    return { category: "ecoles", subType: "Maternelle / Crèche", name };
  }

  const nameLower = name.toLowerCase();
  const isHigherEd =
    tags.amenity === "university" ||
    nameLower.includes("supérieur") ||
    nameLower.includes("supérieure") ||
    nameLower.includes("institut") ||
    nameLower.includes("campus") ||
    nameLower.includes("faculté") ||
    nameLower.includes("iut") ||
    nameLower.includes("bts") ||
    nameLower.includes("ingénieur") ||
    nameLower.includes("business") ||
    nameLower.includes("management") ||
    nameLower.includes("ens") ||
    nameLower.includes("polytech") ||
    nameLower.includes("université");

  if (isHigherEd) {
    return { category: "ecoles", subType: "École supérieure", name };
  }

  if (tags.amenity === "college") {
    if (nameLower.includes("collège") || nameLower.includes("college")) {
      return { category: "ecoles", subType: "Collège", name };
    }
    if (nameLower.includes("lycée") || nameLower.includes("lycee")) {
      return { category: "ecoles", subType: "Lycée", name };
    }
    // Dans OSM, "college" signifie un établissement post-secondaire (higher education)
    return { category: "ecoles", subType: "École supérieure", name };
  }

  if (tags.amenity === "school") {
    if (nameLower.includes("collège") || nameLower.includes("college")) {
      return { category: "ecoles", subType: "Collège", name };
    }
    if (nameLower.includes("lycée") || nameLower.includes("lycee")) {
      return { category: "ecoles", subType: "Lycée", name };
    }
    if (nameLower.includes("maternelle") || nameLower.includes("crèche")) {
      return { category: "ecoles", subType: "Maternelle", name };
    }
    return { category: "ecoles", subType: "École primaire", name };
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
