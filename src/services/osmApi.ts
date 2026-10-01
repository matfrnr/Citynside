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
export const ANALYSIS_RADIUS_METERS = 850;
export const EXTENDED_TRANSIT_RADIUS_METERS = 1200;

function getCacheKey(lat: number, lon: number, radius: number): string {
  // Arrondir à ~11m de précision (0.0001°) pour éviter de mélanger les résultats de deux adresses proches
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;
  return `cyt_pois_v3_${roundedLat}_${roundedLon}_${radius}`;
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
  ...(import.meta.env.PROD
    ? [
        "/.netlify/functions/overpass",
      ]
    : [
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
      ]),
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
  signal?: AbortSignal,
): Promise<POI[]> {
  const cacheKey = getCacheKey(lat, lon, radiusMeters);
  const cached = getCachedPOIs(cacheKey);
  if (cached) {
    return cached;
  }

  const overpassQuery = `
    [out:json][timeout:8];
    (
      nwr(around:${radiusMeters},${lat},${lon})["highway"="bus_stop"];
      nwr(around:${radiusMeters},${lat},${lon})["railway"~"^(tram_stop|station|halt)$"];
      nwr(around:${radiusMeters},${lat},${lon})["station"="subway"];
      nwr(around:${radiusMeters},${lat},${lon})["amenity"~"^(bicycle_rental|parking|pharmacy|doctors|clinic|hospital|dentist|school|kindergarten|college|university|library|arts_centre|cinema|theatre|community_centre)$"];
      nwr(around:${radiusMeters},${lat},${lon})["shop"~"^(bakery|supermarket|convenience|butcher|greengrocer)$"];
      nwr(around:${radiusMeters},${lat},${lon})["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|swimming_pool|pitch|stadium|ice_rink|golf_course)$"];
      nwr(around:${radiusMeters},${lat},${lon})["tourism"="museum"];
    );
    out center qt 200;
  `;

  const pois = await fetchFastFromOverpass(overpassQuery, lat, lon, radiusMeters, signal);

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
  radiusMeters: number,
  externalSignal?: AbortSignal,
): Promise<POI[]> {
  const mirrorsPerBatch = 3;
  const requestTimeoutMs = import.meta.env.PROD ? 12000 : 10000;

  // Les miroirs Overpass servent la même base. Les interroger par petits groupes
  // évite d'attendre plusieurs délais de 10 s en série si un serveur est lent.
  for (let start = 0; start < OVERPASS_MIRRORS.length; start += mirrorsPerBatch) {
    if (externalSignal?.aborted) return [];
    const mirrors = OVERPASS_MIRRORS.slice(start, start + mirrorsPerBatch);
    const controllers = mirrors.map(() => new AbortController());
    const attempts = mirrors.map(async (mirrorUrl, index) => {
      const controller = controllers[index];
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      const abortFromSearch = () => controller.abort();
      externalSignal?.addEventListener("abort", abortFromSearch, { once: true });
      try {
        const response = await fetch(mirrorUrl, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
          signal: controller.signal,
        });
        if (!response.ok) {
          const details = (await response.clone().text()).slice(0, 300);
          throw new Error(`Overpass indisponible (${response.status})${details ? ` : ${details}` : ""}`);
        }
        const data = await response.json();
        const results = parseOverpassResponse(data, centerLat, centerLon, radiusMeters);
        if (results.length === 0) throw new Error("Aucun résultat sur ce miroir Overpass");
        return results;
      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener("abort", abortFromSearch);
      }
    });

    try {
      const results = await Promise.any(attempts);
      controllers.forEach((controller) => controller.abort());
      return results;
    } catch (error) {
      controllers.forEach((controller) => controller.abort());
      if (externalSignal?.aborted) return [];
      if (import.meta.env.PROD) {
        const reasons = error instanceof AggregateError
          ? error.errors.map((item) => item instanceof Error ? item.message : String(item)).join(" | ")
          : error instanceof Error ? error.message : String(error);
        console.warn("Relais Overpass en échec :", reasons);
      }
      // Si les trois serveurs sont indisponibles, le groupe suivant est essayé.
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
  radiusMeters: number,
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

    // Les ways peuvent être sélectionnés via un nœud proche alors que leur centre est plus loin.
    // On conserve seulement ceux dont le point réellement affiché reste dans le rayon demandé.
    const distCheck = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);
    if (distCheck > radiusMeters) continue;

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

  // Sports, culture et équipements de loisirs
  if (tags.leisure === "swimming_pool") {
    const access = String(tags.access ?? "").toLowerCase();
    const restrictedAccess = ["private", "no"].includes(access) || /^(private|no)(\s|$)/i.test(String(tags["access:conditional"] ?? ""));
    const publicEvidence = ["yes", "permissive", "designated"].includes(access) || Boolean(name) || Boolean(tags.operator) || tags.sport === "swimming";
    // Les piscines de jardin sont souvent cartographiées comme leisure=swimming_pool.
    // Ne garder que celles qui ne sont pas explicitement privées et ont un indice d'usage collectif.
    if (restrictedAccess || !publicEvidence) return { category: null, subType: "", name };
  }
  const leisureTypes: Record<string, string> = {
    sports_centre: "Centre sportif",
    fitness_centre: "Salle de sport",
    swimming_pool: "Piscine",
    pitch: "Terrain de sport",
    stadium: "Stade",
    ice_rink: "Patinoire",
    golf_course: "Golf",
  };
  if (leisureTypes[tags.leisure]) return { category: "loisirs", subType: leisureTypes[tags.leisure], name };
  const cultureTypes: Record<string, string> = {
    library: "Bibliothèque / médiathèque",
    arts_centre: "Centre culturel",
    cinema: "Cinéma",
    theatre: "Théâtre",
    community_centre: "Centre socioculturel",
  };
  if (cultureTypes[tags.amenity]) return { category: "loisirs", subType: cultureTypes[tags.amenity], name };
  if (tags.tourism === "museum") return { category: "loisirs", subType: "Musée", name };

  return { category: null, subType: "", name: "" };
}
