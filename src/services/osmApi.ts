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
  return `cyt_mapbox_v24_${roundedLat}_${roundedLon}_${radius}`;
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
  // Les résultats de /category sont plafonnés à 10. Une requête combinée
  // faisait remonter surtout les squares/aires de jeux et masquait les parcs.
  { id: "park", baseCategory: "espaces_verts" },
  { id: "garden", baseCategory: "espaces_verts" },
  { id: "playground", baseCategory: "espaces_verts" },
  // Une seule requête Searchbox est limitée à 25 résultats. Séparer les
  // familles évite que les boulangeries/supérettes masquent les boucheries,
  // primeurs ou traiteurs.
  { id: "bakery,supermarket,grocery,convenience", baseCategory: "commerces" },
  { id: "butcher", baseCategory: "commerces" },
  { id: "greengrocer", baseCategory: "commerces" },
  { id: "deli", baseCategory: "commerces" },
  { id: "seafood", baseCategory: "commerces" },
  { id: "market,florist", baseCategory: "commerces" },
  { id: "pharmacy,hospital,clinic,doctor,dentist,optician,physiotherapist,osteopath,laboratory,urgent_care", baseCategory: "sante" },
  { id: "police,fire_station", baseCategory: "tranquillite" },
  { id: "school,kindergarten,college,university", baseCategory: "ecoles" },
  { id: "parking", baseCategory: "stationnement" },
  { id: "museum,cinema,theater,theatre,performing_arts,arts_centre,sports,fitness_center,swimming_pool,stadium", baseCategory: "loisirs" },
  { id: "library", baseCategory: "loisirs" },
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
    let hasErrors = false;
    const BATCH_SIZE = 1;

    for (let i = 0; i < MAPBOX_CATEGORIES.length; i += BATCH_SIZE) {
      if (signal?.aborted) { const e = new Error("Aborted"); e.name = "AbortError"; throw e; }
      const batch = MAPBOX_CATEGORIES.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (queryConfig) => {
        const url = `https://api.mapbox.com/search/searchbox/v1/category/${queryConfig.id}?access_token=${MAPBOX_TOKEN}&proximity=${lon},${lat}&limit=25`;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, { signal });
            if (response.status === 429 && attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
              continue;
            }
            if (!response.ok) {
              hasErrors = true;
              return [];
            }
            const data = await response.json();
            if (!data.features) return [];
            const queryRadius = queryConfig.baseCategory === "transports"
              ? Math.max(radiusMeters, EXTENDED_TRANSIT_RADIUS_METERS)
              : radiusMeters;
            const parsed = parseMapboxFeatures(data.features, queryConfig.baseCategory, lat, lon, queryRadius);
            // Les transports sont interrogés sur un rayon élargi pour trouver
            // les gares, mais les arrêts ordinaires restent dans le cercle.
            return parsed.filter((poi) =>
              poi.category !== "transports" ||
              poi.distanceMeters <= radiusMeters ||
              /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType)
            );
          } catch (e: any) {
            if (e?.name === "AbortError") throw e;
            if (attempt === 2) {
              hasErrors = true;
              return [];
            }
          }
        }
        hasErrors = true;
        return [];
      });

      const batchResults = await Promise.all(batchPromises);
      allPois.push(...batchResults.flat());

      // Petite pause entre chaque lot pour laisser respirer l'API Mapbox
      if (i + BATCH_SIZE < MAPBOX_CATEGORIES.length) {
      await new Promise(resolve => setTimeout(resolve, 350));
      }
    }

    // Les grands parcs nommés apparaissent parfois comme lieux/POI textuels
    // dans Mapbox, sans appartenir à la catégorie `park` (ex. « Parc des
    // Bains »). Deux recherches ciblées complètent donc la recherche de
    // catégorie sans dépendre des libellés visibles du fond de carte.
    const forwardSearches = [
      { term: "parc", category: "espaces_verts" as POICategory },
      { term: "jardin", category: "espaces_verts" as POICategory },
      { term: "commissariat", category: "tranquillite" as POICategory },
      { term: "police", category: "tranquillite" as POICategory },
      { term: "gendarmerie", category: "tranquillite" as POICategory }
    ];

    for (const search of forwardSearches) {
      if (signal?.aborted) { const e = new Error("Aborted"); e.name = "AbortError"; throw e; }
      const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(search.term)}&access_token=${MAPBOX_TOKEN}&proximity=${lon},${lat}&types=poi&limit=25`;
      try {
        const response = await fetch(url, { signal });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.features)) {
            let features = data.features;
            if (search.category === "tranquillite") {
              features = features.map((f: any) => ({
                ...f,
                properties: { ...f.properties, poi_category_ids: ["police"] }
              }));
            }
            allPois.push(...parseMapboxFeatures(features, search.category, lat, lon, radiusMeters));
          }
        } else {
          hasErrors = true;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        hasErrors = true;
      }
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    // Les parcs polygonaux sont parfois absents de Searchbox mais présents
    // dans la couche vectorielle `poi_label`/`landuse` du fond Streets.
    try {
      if (signal?.aborted) { const e = new Error("Aborted"); e.name = "AbortError"; throw e; }
      const tileUrl = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lon},${lat}.json?radius=${Math.min(radiusMeters, 1000)}&layers=poi_label,landuse&limit=50&access_token=${MAPBOX_TOKEN}`;
      let data: any = null;
      for (let attempt = 0; attempt < 3 && !data; attempt++) {
        const response = await fetch(tileUrl, { signal });
        if (response.ok) {
          data = await response.json();
        } else if (response.status === 429 && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
        }
      }
      if (data) {
        const parkFeatures = (Array.isArray(data.features) ? data.features : []).filter((feature: any) => {
          const p = feature.properties || {};
          const text = `${p.name || ""} ${p.name_fr || ""} ${p.type || ""} ${p.class || ""} ${p.category_en || ""}`.toLowerCase();
          return /\b(parc|park|jardin|garden|square|nature reserve|réserve naturelle)\b/.test(text);
        }).map((feature: any) => ({
          ...feature,
          properties: { ...feature.properties, poi_category_ids: ["park"] },
        }));
        allPois.push(...parseMapboxFeatures(parkFeatures, "espaces_verts", lat, lon, radiusMeters));

        const securityFeatures = (Array.isArray(data.features) ? data.features : []).filter((feature: any) => {
          const p = feature.properties || {};
          const text = `${p.name || ""} ${p.name_fr || ""} ${p.type || ""} ${p.class || ""} ${p.category_en || ""}`.toLowerCase();
          return /police|commissariat|gendarmerie|fire station|caserne|pompiers/.test(text);
        }).map((feature: any) => ({
          ...feature,
          properties: { ...feature.properties, poi_category_ids: ["police"] },
        }));
        allPois.push(...parseMapboxFeatures(securityFeatures, "tranquillite", lat, lon, radiusMeters));
      }
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      hasErrors = true;
      /* les catégories Searchbox restent disponibles */
    }

    const deduped = deduplicatePOIs(allPois);
    deduped.sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (deduped.length > 0 && !hasErrors) {
      setCachedPOIs(cacheKey, deduped);
    }
    return deduped;

  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.error("Mapbox POI fetch failed:", err);
    }
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

    let pLon: number, pLat: number;
    if (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiLineString") {
      pLon = coords[0][0][0];
      pLat = coords[0][0][1];
    } else if (f.geometry?.type === "MultiPolygon") {
      pLon = coords[0][0][0][0];
      pLat = coords[0][0][0][1];
    } else if (f.geometry?.type === "LineString") {
      pLon = coords[0][0];
      pLat = coords[0][1];
    } else {
      pLon = coords[0];
      pLat = coords[1];
    }

    if (typeof pLon !== "number" || typeof pLat !== "number") continue;

    const dist = calculateDistanceMeters(centerLat, centerLon, pLat, pLon);
    if (dist > radiusMeters) continue;

    const name = String(f.properties?.name || f.properties?.full_address || "").trim();
    if (!name) continue;
    const poiTypes = [
      ...(Array.isArray(f.properties?.poi_category_ids) ? f.properties.poi_category_ids : []),
      ...(Array.isArray(f.properties?.poi_category) ? f.properties.poi_category : []),
    ];

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
  if (tSet.has("train_station") || tSet.has("train") || tSet.has("commuter_train"))
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
  if (tSet.has("greengrocer") || tSet.has("fruit") || tSet.has("produce") || nameLower.includes("primeur")) return { category: "commerces", subType: "Primeur" };
  if (tSet.has("deli") || tSet.has("delicatessen") || tSet.has("caterer") || nameLower.includes("traiteur")) return { category: "commerces", subType: "Traiteur" };
  if (tSet.has("seafood") || nameLower.includes("poissonnerie")) return { category: "commerces", subType: "Poissonnerie" };
  if (tSet.has("market") || nameLower.includes("marché")) return { category: "commerces", subType: "Marché" };
  if (tSet.has("florist") || nameLower.includes("fleuriste")) return { category: "commerces", subType: "Fleuriste" };

  if (tSet.has("pharmacy") || nameLower.includes("pharmacie")) return { category: "sante", subType: "Pharmacie" };
  if (/(maison médicale|maison medicale|centre médical|centre medical|centre de santé|centre de sante|pôle santé|pole sante|cabinet pluridisciplinaire)/.test(nameLower)) return { category: "sante", subType: "Maison / centre de santé" };
  if (tSet.has("hospital") || tSet.has("clinic") || tSet.has("medical_clinic") || nameLower.includes("hôpital") || nameLower.includes("clinique")) return { category: "sante", subType: "Hôpital / Clinique" };
  if (tSet.has("dentist") || tSet.has("dental") || nameLower.includes("dentiste") || nameLower.includes("dentaire")) {
    // Searchbox renvoie parfois le nom du praticien qui exerce dans une
    // maison médicale (ex. « Godini Irene Jeannine Sylviane ») au lieu du
    // nom de l'établissement. Éviter alors de présenter ce point comme une
    // clinique dentaire : il reste compté comme service de santé générique.
    const providerName = /^(dr\.?|docteur\b)/i.test(name.trim()) ||
      (/^[A-ZÀ-ÖØ-Þ][\p{L}'-]+(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'-]+){1,4}$/u.test(name.trim()) &&
        !/(cabinet|centre|maison|clinique|pôle|pole|groupe|selarl|sarl|scm)\b/i.test(name));
    return providerName
      ? { category: "sante", subType: "Professionnel de santé" }
      : { category: "sante", subType: "Dentiste" };
  }
  if (tSet.has("optician") || nameLower.includes("opticien") || nameLower.includes("optique")) return { category: "sante", subType: "Opticien" };
  if (tSet.has("physiotherapist") || nameLower.includes("kiné") || nameLower.includes("kinésithérapeute") || nameLower.includes("physiothérapeute")) return { category: "sante", subType: "Kinésithérapeute" };
  if (tSet.has("osteopath") || nameLower.includes("ostéopathe") || nameLower.includes("osteopathe")) return { category: "sante", subType: "Ostéopathe" };
  if (tSet.has("laboratory") || nameLower.includes("laboratoire")) return { category: "sante", subType: "Laboratoire d'analyses" };
  if (tSet.has("urgent_care") || nameLower.includes("urgences")) return { category: "sante", subType: "Soins urgents" };
  if (tSet.has("doctor") || tSet.has("medical") || tSet.has("health") || nameLower.includes("médecin") || nameLower.includes("cabinet médical")) return { category: "sante", subType: "Cabinet médical" };

  if (tSet.has("police") || tSet.has("police_station") || nameLower.includes("commissariat")) return { category: "tranquillite", subType: "Commissariat" };
  if (tSet.has("fire_station") || nameLower.includes("gendarmerie")) return { category: "tranquillite", subType: "Gendarmerie / Caserne" };

  if (tSet.has("kindergarten") || nameLower.includes("maternelle") || nameLower.includes("crèche")) return { category: "ecoles", subType: "Maternelle / Crèche" };
  if (tSet.has("college") || tSet.has("university") || nameLower.includes("université") || nameLower.includes("campus") || nameLower.includes("lycée")) return { category: "ecoles", subType: "École supérieure / Lycée" };
  if (tSet.has("school") || nameLower.includes("école")) return { category: "ecoles", subType: "École" };

  if (tSet.has("park") || tSet.has("garden") || nameLower.includes("parc") || nameLower.includes("jardin") || nameLower.includes("square")) return { category: "espaces_verts", subType: "Parc / Jardin" };
  if (tSet.has("playground")) return { category: "espaces_verts", subType: "Aire de jeux" };

  if (tSet.has("swimming_pool") || nameLower.includes("piscine")) return { category: "loisirs", subType: "Piscine" };
  if (tSet.has("theater") || tSet.has("theatre") || tSet.has("performing_arts") || tSet.has("arts_centre") || nameLower.includes("théâtre") || nameLower.includes("theatre") || nameLower.includes("scène nationale") || nameLower.includes("spectacle")) return { category: "loisirs", subType: "Théâtre / Spectacle" };
  if (tSet.has("cinema") || nameLower.includes("cinéma")) return { category: "loisirs", subType: "Cinéma" };
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
    tranquillite: "Sécurité",
  };
  return { category: fallbackCategory, subType: fallbackLabels[fallbackCategory] };
}

function deduplicatePOIs(pois: POI[]): POI[] {
  const result: POI[] = [];
  for (const poi of pois) {
    const isDuplicate = result.some((existing) => {
      if (existing.category !== poi.category) return false;
      const dist = calculateDistanceMeters(existing.lat, existing.lon, poi.lat, poi.lon);
      const existingRail = /gare ferroviaire|arrêt ferroviaire/i.test(existing.subType);
      const poiRail = /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType);
      if (existing.category === "transports" && existingRail && poiRail && dist <= 120) return true;
      if (existing.name && poi.name) {
        const eName = existing.name.toLowerCase().trim();
        const pName = poi.name.toLowerCase().trim();
        if (eName === pName && dist <= 30) return true;
      }
      return false;
    });

    if (!isDuplicate) {
      result.push(poi);
    } else {
      const existingIndex = result.findIndex(existing => {
        const d = calculateDistanceMeters(existing.lat, existing.lon, poi.lat, poi.lon);
        const sameRail = existing.category === "transports" &&
          /gare ferroviaire|arrêt ferroviaire/i.test(existing.subType) &&
          /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType);
        return existing.category === poi.category &&
          ((sameRail && d <= 120) || (existing.name?.trim().toLowerCase() === poi.name?.trim().toLowerCase() && d <= 30));
      });
      if (existingIndex >= 0 && (!result[existingIndex].name || result[existingIndex].name.length < poi.name.length)) {
        result[existingIndex] = poi;
      }
    }
  }
  return result;
}
