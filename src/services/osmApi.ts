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
  return `cyt_mapbox_v73_${roundedLat}_${roundedLon}_${radius}`;
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

function getCategoryCacheKey(id: string, lat: number, lon: number, radius: number): string {
  return `cyt_category_v15_${id}_${Math.round(lat * 1000)}_${Math.round(lon * 1000)}_${radius}`;
}

function readCategoryCache(key: string): POI[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as POI[];
    }
  } catch {}
  return [];
}

function writeCategoryCache(key: string, pois: POI[]): void {
  if (!pois.length) return;
  try { sessionStorage.setItem(key, JSON.stringify(pois)); } catch {}
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
  { id: "cheese", baseCategory: "commerces" },
  { id: "market,florist", baseCategory: "commerces" },
  { id: "pharmacy,hospital,clinic,doctor,dentist,optician,physiotherapist,osteopath,laboratory,urgent_care", baseCategory: "sante" },
  { id: "police,fire_station", baseCategory: "tranquillite" },
  { id: "school,kindergarten,college,university", baseCategory: "ecoles" },
  { id: "parking", baseCategory: "stationnement" },
  { id: "museum,cinema,theater,theatre,performing_arts,arts_centre", baseCategory: "loisirs" },
  { id: "music_venue,concert_hall,event_venue", baseCategory: "loisirs" },
  // Les catégories Searchbox sont plafonnées : séparer les équipements
  // sportifs évite que les salles de fitness masquent stades et gymnases.
  { id: "sports", baseCategory: "loisirs" },
  { id: "fitness_center", baseCategory: "loisirs" },
  { id: "stadium", baseCategory: "loisirs" },
  { id: "swimming_pool", baseCategory: "loisirs" },
  { id: "library", baseCategory: "loisirs" },
  { id: "post_office,city_hall,courthouse,government", baseCategory: "services_publics" },
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
        const queryRadius = queryConfig.baseCategory === "transports"
          ? Math.max(radiusMeters, EXTENDED_TRANSIT_RADIUS_METERS)
          : radiusMeters;
        const categoryCacheKey = getCategoryCacheKey(queryConfig.id, lat, lon, queryRadius);
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
            const parsed = parseMapboxFeatures(data.features, queryConfig.baseCategory, lat, lon, queryRadius);
            // Les transports sont interrogés sur un rayon élargi pour trouver
            // les gares, mais les arrêts ordinaires restent dans le cercle.
            const filtered = parsed.filter((poi) =>
              poi.category !== "transports" ||
              poi.distanceMeters <= radiusMeters ||
              /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType)
            );
            writeCategoryCache(categoryCacheKey, filtered);
            return filtered;
          } catch (e: any) {
            if (e?.name === "AbortError") throw e;
            if (attempt === 2) {
              hasErrors = true;
              return readCategoryCache(categoryCacheKey);
            }
          }
        }
        hasErrors = true;
        return readCategoryCache(categoryCacheKey);
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
      { term: "gendarmerie", category: "tranquillite" as POICategory },
      { term: "maternelle", category: "ecoles" as POICategory },
      { term: "crèche", category: "ecoles" as POICategory }
      ,{ term: "fromagerie", category: "commerces" as POICategory },
      { term: "université", category: "ecoles" as POICategory },
      { term: "IUT", category: "ecoles" as POICategory },
      { term: "faculté", category: "ecoles" as POICategory },
      { term: "campus", category: "ecoles" as POICategory },
      { term: "institut", category: "ecoles" as POICategory },
      { term: "gymnase", category: "loisirs" as POICategory },
      { term: "stade", category: "loisirs" as POICategory },
      { term: "complexe sportif", category: "loisirs" as POICategory },
      { term: "salle de sport", category: "loisirs" as POICategory }
    ];

    for (const search of forwardSearches) {
      if (signal?.aborted) { const e = new Error("Aborted"); e.name = "AbortError"; throw e; }
      const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(search.term)}&access_token=${MAPBOX_TOKEN}&proximity=${lon},${lat}&types=poi&limit=10`;
      try {
        const response = await fetch(url, { signal });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.features)) {
            let features = data.features;
            if (search.category === "tranquillite") {
              features = features.map((f: any) => ({
                ...f,
                properties: {
                  ...f.properties,
                  poi_category_ids: /gendarmerie/i.test(String(f.properties?.name || ""))
                    ? ["gendarmerie"]
                    : /pompiers|caserne|fire station/i.test(String(f.properties?.name || ""))
                      ? ["fire_station"]
                      : ["police"],
                }
              }));
            }
            if (search.category === "ecoles") {
              // Une recherche textuelle « maternelle » ou « université » peut
              // retourner les commerces voisins. On ne force plus leur type :
              // le nom doit lui-même confirmer qu'il s'agit d'un établissement.
              const termPattern = search.term === "maternelle"
                ? /maternelle/i
                : search.term === "crèche"
                  ? /crèche|creche/i
                  : /école|ecole|maternelle|crèche|creche|collège|college|lycée|lycee|université|universite|campus|ufr|faculté|faculte|institut/i;
              features = features.filter((f: any) => {
                const text = String(f.properties?.name || f.properties?.full_address || "");
                return termPattern.test(text) && !/caisse d['’]?epargne|caisse d['’]?épargne|banque|cabinet infirmier|parking|tacos|restaurant|centre laser|laser|hôtel|hotel/i.test(text);
              });
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
          properties: {
            ...feature.properties,
            poi_category_ids: /gendarmerie/i.test(String(feature.properties?.name || ""))
              ? ["gendarmerie"]
              : /pompiers|caserne|fire station/i.test(String(feature.properties?.name || ""))
                ? ["fire_station"]
                : ["police"],
          },
        }));
        allPois.push(...parseMapboxFeatures(securityFeatures, "tranquillite", lat, lon, radiusMeters));

        const earlyEducationFeatures = (Array.isArray(data.features) ? data.features : []).filter((feature: any) => {
          const p = feature.properties || {};
          const text = `${p.name || ""} ${p.name_fr || ""} ${p.type || ""} ${p.class || ""} ${p.category_en || ""}`.toLowerCase();
          return /école maternelle|ecole maternelle|kindergarten|crèche|creche|halte-garderie|multi.?accueil/.test(text);
        }).map((feature: any) => ({
          ...feature,
          properties: { ...feature.properties, poi_category_ids: ["kindergarten"] },
        }));
        allPois.push(...parseMapboxFeatures(earlyEducationFeatures, "ecoles", lat, lon, radiusMeters));

        const libraryFeatures = (Array.isArray(data.features) ? data.features : []).filter((feature: any) => {
          const p = feature.properties || {};
          const text = `${p.name || ""} ${p.name_fr || ""} ${p.type || ""} ${p.class || ""} ${p.category_en || ""}`.toLowerCase();
          return /biblioth[eè]que|médiath[eè]que|library|mediatek/.test(text);
        }).map((feature: any) => ({
          ...feature,
          properties: { ...feature.properties, poi_category_ids: ["library"] },
        }));
        allPois.push(...parseMapboxFeatures(libraryFeatures, "loisirs", lat, lon, radiusMeters));

        const parkingFeatures = (Array.isArray(data.features) ? data.features : []).filter((feature: any) => {
          const p = feature.properties || {};
          const text = `${p.name || ""} ${p.name_fr || ""} ${p.type || ""} ${p.class || ""} ${p.category_en || ""}`.toLowerCase();
          return /\b(parking|car park|aire de stationnement|stationnement)\b/.test(text) &&
            !/parking privé|parking prive|entreprise|centre commercial|supermarché|supermarche|hôtel|hotel/.test(text);
        }).map((feature: any) => ({
          ...feature,
          properties: { ...feature.properties, poi_category_ids: ["parking"] },
        }));
        allPois.push(...parseMapboxFeatures(parkingFeatures, "stationnement", lat, lon, radiusMeters));
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
    // Certains POI Mapbox portent « square » ou « parc » dans leur nom sans
    // être des espaces verts (bar Beer Square, toilettes du square, etc.).
    // Bloquer ces faux positifs avant toute conversion de catégorie.
    if (baseCategory === "espaces_verts" && /toilettes?|wc\b|toilette publique|\bbar\b|café|cafe|restaurant|alimentation|beer|brasserie/i.test(name)) {
      continue;
    }
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

    const mapped = mapboxTypeToCytinside(poiTypes, name, baseCategory, f.properties?.maki);
    const publicPost = /^(la\s+poste|bureau\s+de\s+poste|post\s+office|agence\s+postale|poste\s+communale)/i.test(name.trim());
    const category = publicPost ? "services_publics" : mapped.category;
    const subType = publicPost
      ? "Bureau de poste"
      : category === "services_publics" && /post\s+office|postal|communal|city\s+hall|courthouse|government/i.test(mapped.subType)
      ? (/post\s+office|postal/i.test(mapped.subType) ? "Bureau de poste" : /city\s+hall/i.test(mapped.subType) ? "Mairie" : /courthouse/i.test(mapped.subType) ? "Tribunal" : "Service administratif")
      : mapped.subType;
    if (!category) continue;

    const englishHospital = /^(hospital\s+center|hospital\s+centre|medical\s+center|health\s+center)$/i.test(name);
    const englishPrefecture = /^prefecture\s+of\s+(.+)$/i.exec(name);
    const displayName = publicPost
      ? "Bureau de poste"
      : englishHospital
        ? "Centre hospitalier"
        : englishPrefecture
          ? `Préfecture du ${englishPrefecture[1].trim()}`
      : /^(enfants?|children(?:'s)?|kids?)\s+(garden|playground)$/i.test(name)
      ? "Jardin pour enfants"
      : category === "services_publics"
        ? name.replace(/\s+\d{5}\s*$/, "").trim()
        : name;
    parsedPois.push({
      id: `mapbox_${f.properties?.mapbox_id || Math.random().toString(36).substr(2, 9)}`,
      name: displayName,
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
  const normalizedName = nameLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const beautyBusiness = /institut de beaut[eé]|esth[eé]ticien|[ée]pilation|head spa|salon de beaut[eé]|coiffure|onglerie|nail salon/.test(nameLower);

  // Un centre de PMI est un service de santé, pas une école maternelle.
  if (fallbackCategory === "ecoles" && /\b(pmi|protection maternelle et infantile)\b/.test(normalizedName)) {
    return { category: "sante", subType: "Protection maternelle et infantile (PMI)" };
  }

  // Ne jamais laisser le nom d'un résultat changer la famille demandée.
  // Exemple : « Parking du Bus » reste un parking, pas un arrêt de bus.
  if (fallbackCategory === "stationnement") {
    if (/yespark|parclick|effia|indigo|saemes|q-park|zenpark|parking privé|parking prive/i.test(nameLower)) {
      return { category: null, subType: "" };
    }
    return tSet.has("parking") || nameLower.includes("parking")
      ? { category: "stationnement", subType: "Parking public" }
      : { category: null, subType: "" };
  }

  if (fallbackCategory === "transports" && (tSet.has("subway_station") || nameLower.includes("métro") || nameLower.includes("metro")))
    return { category: "transports", subType: "Station de métro" };
  if (fallbackCategory === "transports" && (tSet.has("tram_stop") || nameLower.includes("tramway") || /\btram\b/.test(nameLower)))
    return { category: "transports", subType: "Arrêt de tramway" };
  if (fallbackCategory === "transports" && (tSet.has("train_station") || tSet.has("train") || tSet.has("commuter_train")))
    return { category: "transports", subType: "Gare ferroviaire" };
  if (fallbackCategory === "transports" && (tSet.has("bus_stop") || tSet.has("bus_station") || nameLower.includes("bus")))
    return { category: "transports", subType: "Arrêt de bus" };
  if ((fallbackCategory === "transports" || nameLower.includes("port") || nameLower.includes("ferry")) &&
    (tSet.has("ferry_terminal") || nameLower.includes("port") || nameLower.includes("ferry")) &&
    !/\bsport\w*\b|omnisports?|union sportive|club sportif|événements?|evenements?|demonstrations?|discovery|cultural events?|\bsalle\b/.test(nameLower))
    return { category: "transports", subType: "Ferry / Port" };
  if (fallbackCategory === "transports" && (tSet.has("bicycle_rental") || nameLower.includes("vélo") || nameLower.includes("velov") || nameLower.includes("metrovélo")))
    return { category: "transports", subType: "Station vélo" };

  if (fallbackCategory === "transports") return { category: null, subType: "" };

  if (fallbackCategory === "sante" && /\b(mediation|formation|organisme de formation)\b/.test(normalizedName) && tSet.has("physiotherapist")) {
    return { category: null, subType: "" };
  }

  // Les catégories de loisirs de Mapbox sont parfois trop larges : garder les
  // monuments avec leur type propre plutôt que de les afficher comme musées.
  if (fallbackCategory === "loisirs" && /\b(statue|monument|memorial)\b/.test(normalizedName)) {
    return { category: "loisirs", subType: "Monument" };
  }
  if (fallbackCategory === "loisirs" && /^place\s+(de\s+|du\s+|des\s+|de la\s+|de l['’])/.test(normalizedName)) {
    return { category: null, subType: "" };
  }
  if (fallbackCategory === "loisirs" && /\busine\b/.test(normalizedName) && !/theatre|spectacle|concert|salle de concert/.test(normalizedName)) {
    return { category: null, subType: "" };
  }

  if (tSet.has("cheese") || nameLower.includes("fromagerie")) return { category: "commerces", subType: "Fromagerie" };
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
  if (/\bchu\b|centre hospitalier|centre hospitalier universitaire|hôpital|hopital|hospital\s+center|hospital\s+centre/.test(nameLower)) return { category: "sante", subType: "Hôpital / Clinique" };
  if (tSet.has("dentist") || tSet.has("dental") || nameLower.includes("dentiste") || nameLower.includes("dentaire")) return { category: "sante", subType: "Dentiste" };
  if (/^(?:dr\.?\s+|docteur\s+|médecin\b|medecin\b)/i.test(name.trim())) return { category: "sante", subType: "Médecin" };
  if (tSet.has("physiotherapist") || /\bkin[ée]\b|kinésithérapeute|kinesitherapeute|physiothérapeute|physiotherapeute/.test(nameLower)) return { category: "sante", subType: "Kinésithérapeute" };
  const looksLikeHealthProfessional = /^[A-ZÀ-ÖØ-Þ][\p{L}'-]+(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'-]+){1,4}$/u.test(name.trim()) &&
    !/(hôpital|hopital|clinique|cabinet|centre|maison|pôle|pole|groupe|selarl|sarl|scm)/i.test(name);
  if (looksLikeHealthProfessional && (tSet.has("doctor") || tSet.has("medical"))) return { category: "sante", subType: "Médecin" };
  if (looksLikeHealthProfessional && (tSet.has("hospital") || tSet.has("clinic") || tSet.has("medical_clinic"))) return { category: "sante", subType: "Professionnel de santé" };
  if (tSet.has("hospital") || tSet.has("clinic") || tSet.has("medical_clinic") || /\bchu\b|hôpital|hopital|clinique|hospital\s+center|hospital\s+centre|medical\s+center|health\s+center/.test(nameLower)) return { category: "sante", subType: "Hôpital / Clinique" };
  if (tSet.has("optician") || nameLower.includes("opticien") || nameLower.includes("optique")) return { category: "sante", subType: "Opticien" };
  if (tSet.has("osteopath") || nameLower.includes("ostéopathe") || nameLower.includes("osteopathe")) return { category: "sante", subType: "Ostéopathe" };
  if (tSet.has("laboratory") || nameLower.includes("laboratoire")) return { category: "sante", subType: "Laboratoire d'analyses" };
  if (tSet.has("urgent_care") || nameLower.includes("urgences")) return { category: "sante", subType: "Soins urgents" };
  if (tSet.has("doctor") || tSet.has("medical") || tSet.has("health") || nameLower.includes("médecin") || nameLower.includes("cabinet médical")) return { category: "sante", subType: "Cabinet médical" };
  if (tSet.has("dermatologist") || nameLower.includes("dermatologue") || nameLower.includes("dermatologie")) return { category: "sante", subType: "Dermatologue" };

  if (tSet.has("fire_station") || /pompiers|caserne|fire station/.test(nameLower)) return { category: "tranquillite", subType: "Caserne de pompiers" };
  if (tSet.has("gendarmerie") || nameLower.includes("gendarmerie")) return { category: "tranquillite", subType: "Gendarmerie" };
  if (tSet.has("police") || tSet.has("police_station") || nameLower.includes("commissariat")) return { category: "tranquillite", subType: "Commissariat" };

  if (fallbackCategory === "ecoles" && (beautyBusiness || /caisse d['’]?epargne|caisse d['’]?épargne|banque|cabinet infirmier|parking|tacos|restaurant|centre laser|laser|hôtel|hotel|résidence|residence/i.test(nameLower))) return { category: null, subType: "" };
  // Le nom explicite prime sur une catégorie fournisseur générique, qui peut
  // par exemple étiqueter un lycée comme école maternelle.
  if (fallbackCategory === "ecoles" && /\blycee\b/.test(normalizedName)) return { category: "ecoles", subType: "Lycée" };
  if (tSet.has("kindergarten") || nameLower.includes("maternelle") || nameLower.includes("crèche")) return { category: "ecoles", subType: "Maternelle / Crèche" };
  const looksLikePersonName = /^[A-ZÀ-ÖØ-Þ][\p{L}'-]+(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'-]+){1,3}$/u.test(name.trim());
  if (fallbackCategory === "ecoles" && looksLikePersonName && !/ufr|universit|facult|campus|institut|école|ecole|lycée|college|collège/i.test(nameLower)) return { category: null, subType: "" };
  if (tSet.has("college") || tSet.has("university") || nameLower.includes("université") || nameLower.includes("universite") || nameLower.includes("campus") || nameLower.includes("ufr") || nameLower.includes("faculté") || nameLower.includes("faculte") || nameLower.includes("institut") || nameLower.includes("école supérieure") || nameLower.includes("ecole superieure") || nameLower.includes("lycée")) return { category: "ecoles", subType: "Enseignement supérieur" };
  if (tSet.has("school") || nameLower.includes("école")) return { category: "ecoles", subType: "École" };

  if (tSet.has("swimming_pool") || nameLower.includes("piscine") || nameLower.includes("centre nautique") || nameLower.includes("stade nautique") || nameLower.includes("centre aquatique")) return { category: "loisirs", subType: "Piscine" };

  const likelyFoodBusiness = /alimentation|restaurant|bar\b|brasserie|boulangerie|boucherie|traiteur|primeur|épicerie|epicerie/.test(nameLower);
  if (fallbackCategory === "loisirs" && !likelyFoodBusiness && (tSet.has("theater") || tSet.has("theatre") || tSet.has("performing_arts") || nameLower.includes("théâtre") || nameLower.includes("theatre") || nameLower.includes("scène nationale") || nameLower.includes("spectacle") || nameLower.includes("concert"))) return { category: "loisirs", subType: "Théâtre / Spectacle" };
  if (fallbackCategory === "loisirs" && !likelyFoodBusiness && (tSet.has("music_venue") || tSet.has("concert_hall") || tSet.has("event_venue") || tSet.has("arts_centre"))) return { category: "loisirs", subType: "Salle de concert / spectacle" };
  if (fallbackCategory === "loisirs" && (tSet.has("cinema") || nameLower.includes("cinéma"))) return { category: "loisirs", subType: "Cinéma" };
  if (fallbackCategory === "loisirs" && (tSet.has("museum") || nameLower.includes("musée"))) return { category: "loisirs", subType: "Musée" };
  if (fallbackCategory === "loisirs" && (tSet.has("library") || nameLower.includes("bibliothèque") || nameLower.includes("médiathèque") || nameLower.includes("mediateque"))) return { category: "loisirs", subType: "Bibliothèque" };
  if (fallbackCategory === "loisirs" && (tSet.has("stadium") || nameLower.includes("stade") || nameLower.includes("aréna") || nameLower.includes("arena"))) return { category: "loisirs", subType: "Stade / Complexe sportif" };
  if (fallbackCategory === "loisirs" && /\bgymnase\b/.test(normalizedName)) return { category: "loisirs", subType: "Gymnase" };
  const explicitFitnessName = /salle de sport|fitness|gymnase|basic.?fit|keep.?cool|crossfit|musculation|club sportif|club de sport/.test(nameLower);
  if (fallbackCategory === "loisirs" && explicitFitnessName) return { category: "loisirs", subType: "Salle de sport" };
  // Le type fournisseur seul est insuffisant : il est parfois appliqué à un
  // musée, une association ou un lieu portant un nom incomplet.
  if (fallbackCategory === "loisirs" && tSet.has("fitness_center") && !explicitFitnessName) return { category: null, subType: "" };
  if (fallbackCategory === "loisirs" && tSet.has("sports") && /sport|complexe|terrain|stade|gymnase/.test(nameLower)) return { category: "loisirs", subType: "Équipement sportif" };

  if (fallbackCategory === "espaces_verts" && !/toilettes?|wc\b|bar\b|café|cafe|restaurant|alimentation|beer|brasserie|toilette publique/i.test(nameLower) && (tSet.has("park") || tSet.has("garden") || nameLower.includes("parc") || nameLower.includes("jardin") || nameLower.includes("square"))) return { category: "espaces_verts", subType: "Parc / Jardin" };
  if (fallbackCategory === "espaces_verts" && (tSet.has("playground") || /\b(enfants?|children(?:'s)?|kids?)\s+(garden|playground)\b/i.test(nameLower))) return { category: "espaces_verts", subType: "Aire de jeux pour enfants" };

  if (tSet.has("parking") || nameLower.includes("parking")) return { category: "stationnement", subType: "Parking" };

  if (nameLower.includes("poste") || nameLower.includes("bureau de poste") || nameLower.includes("post office") || (tSet.has("post_office") && /la\s+poste|agence\s+postale|poste\s+communale/i.test(nameLower))) return { category: "services_publics", subType: "Bureau de poste" };
  if (tSet.has("city_hall") || nameLower.includes("mairie") || nameLower.includes("hôtel de ville") || nameLower.includes("hotel de ville")) return { category: "services_publics", subType: "Mairie" };
  if (tSet.has("courthouse") || nameLower.includes("tribunal")) return { category: "services_publics", subType: "Tribunal" };
  if (nameLower.includes("préfecture") || nameLower.includes("prefecture") || nameLower.includes("administration") || nameLower.includes("service public") || nameLower.includes("impôt") || nameLower.includes("impot") || nameLower.includes("centre des finances publiques")) return { category: "services_publics", subType: nameLower.includes("préfecture") || nameLower.includes("prefecture") ? "Préfecture" : "Service administratif" };
  // La catégorie government de Mapbox peut contenir des fiches privées sans
  // rapport avec l'administration. Sans indice explicite, on rejette le point.
  if (fallbackCategory === "services_publics") return { category: null, subType: "" };

  // Category searches can omit `poi_category_ids`; keep the result with a
  // human label, never with a raw provider type such as an internal ID.
  // Pour les loisirs, ne pas conserver un résultat sans type reconnu : cette
  // requête renvoie parfois des commerces ou des lieux sans rapport.
  if (fallbackCategory === "loisirs") return { category: null, subType: "" };

  const fallbackLabels: Record<POICategory, string> = {
    transports: "Arrêt de transport",
    commerces: "Commerce",
    sante: "Professionnel de santé",
    ecoles: "Établissement scolaire",
    espaces_verts: "Parc / Jardin",
    stationnement: "Parking",
    loisirs: "Lieu de loisirs",
    services_publics: "Service public",
    tranquillite: "Sécurité",
  };
  return { category: fallbackCategory, subType: fallbackLabels[fallbackCategory] };
}

function areEquivalentStopNames(a: string, b: string): boolean {
  const prepare = (value: string) => value
    .split(/\s+/)
    .filter((token) => token && !/^(le|la|les|de|du|des)$/.test(token))
    .map((token) => token.length > 4 && !token.endsWith("bus") ? token.replace(/s$/, "") : token)
    .join("");
  const compactA = prepare(a);
  const compactB = prepare(b);
  if (compactA === compactB) return true;
  // Tolère une faute/pluriel/lettre finale différente sur un nom assez long,
  // sans fusionner des arrêts courts portant seulement un mot en commun.
  if (compactA.length < 8 || compactB.length < 8) return false;
  const prev = Array.from({ length: compactB.length + 1 }, (_, i) => i);
  for (let i = 1; i <= compactA.length; i++) {
    const next = [i];
    for (let j = 1; j <= compactB.length; j++) {
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (compactA[i - 1] === compactB[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j < next.length; j++) prev[j] = next[j];
  }
  return prev[compactB.length] <= 2;
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
      // Plusieurs flux peuvent décrire le même quai avec des noms différents.
      // À moins de 10 m, on fusionne uniquement les arrêts du même type.
      if (existing.category === "transports" && existing.subType === poi.subType && dist <= 10) return true;
      if (existing.name && poi.name) {
        const normalizeStopName = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^[^,]+,\s*/, "").replace(/[-_–—]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        const eName = normalizeStopName(existing.name);
        const pName = normalizeStopName(poi.name);
        const eTokens = new Set(eName.split(" ").filter((t) => t.length >= 3));
        const pTokens = new Set(pName.split(" ").filter((t) => t.length >= 3));
        const commonTokens = [...eTokens].filter((t) => pTokens.has(t));
        const equivalentName = areEquivalentStopNames(eName, pName) || (commonTokens.length >= 2 && commonTokens.length >= Math.min(eTokens.size, pTokens.size));
        const genericVsBus =
          (existing.subType === "Arrêt de transport" && poi.subType === "Arrêt de bus") ||
          (poi.subType === "Arrêt de transport" && existing.subType === "Arrêt de bus");
        if (existing.category === "transports" && dist <= 100 &&
          (existing.subType === poi.subType || genericVsBus) &&
          (equivalentName || genericVsBus)) return true;
        if (eName === pName && dist <= 30) return true;
      }
      return false;
    });

    if (!isDuplicate) {
      result.push(poi);
    } else {
      const existingIndex = result.findIndex(existing => {
        const d = calculateDistanceMeters(existing.lat, existing.lon, poi.lat, poi.lon);
        const normalizeStopName = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^[^,]+,\s*/, "").replace(/[-_–—]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        const ea = existing.name ? normalizeStopName(existing.name) : "";
        const pa = poi.name ? normalizeStopName(poi.name) : "";
        const et = new Set(ea.split(" ").filter((t) => t.length >= 3));
        const pt = new Set(pa.split(" ").filter((t) => t.length >= 3));
        const equivalentName = areEquivalentStopNames(ea, pa) || ([...et].filter((t) => pt.has(t)).length >= 2 && [...et].filter((t) => pt.has(t)).length >= Math.min(et.size, pt.size));
        const sameRail = existing.category === "transports" &&
          /gare ferroviaire|arrêt ferroviaire/i.test(existing.subType) &&
          /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType);
        const genericVsBus =
          (existing.subType === "Arrêt de transport" && poi.subType === "Arrêt de bus") ||
          (poi.subType === "Arrêt de transport" && existing.subType === "Arrêt de bus");
        return existing.category === poi.category &&
          ((sameRail && d <= 120) || (existing.category === "transports" && existing.subType === poi.subType && d <= 10) || (existing.category === "transports" && (existing.subType === poi.subType || genericVsBus) && (equivalentName || genericVsBus) && d <= 100) || (equivalentName && d <= 30));
      });
      if (existingIndex >= 0 && (!result[existingIndex].name || result[existingIndex].name.length < poi.name.length)) {
        result[existingIndex] = poi;
      }
    }
  }
  return result;
}
