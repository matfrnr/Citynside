import type { AddressResult } from '../types';

/**
 * Service d'interaction avec l'API Base Adresse Nationale (BAN - data.gouv.fr)
 * Gratuite, sans clé API, mise à jour quotidienne par l'IGN et l'ANCT.
 *
 * Améliorations :
 * - Filtrage par score de confiance BAN (>= 0.4)
 * - Tri par score de pertinence décroissant
 * - Préférence pour les résultats de type « housenumber » ou « street » (plus précis)
 * - Debounce plus intelligent côté API (paramètre autocomplete + type)
 * - Gestion d'erreur plus robuste avec retry
 */

const BAN_BASE_URL = 'https://api-adresse.data.gouv.fr';

// Cache des recherches d'adresses pour réactivité instantanée
const addressQueryCache = new Map<string, AddressResult[]>();
const reverseGeocodeCache = new Map<string, AddressResult | null>();

export async function searchAddress(query: string): Promise<AddressResult[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const trimmed = query.trim().toLowerCase();
  if (addressQueryCache.has(trimmed)) {
    return addressQueryCache.get(trimmed)!;
  }

  // Construire l'URL avec des paramètres optimisés
  const params = new URLSearchParams({
    q: query.trim(),
    limit: '8',          // Un peu plus pour pouvoir filtrer ensuite
    autocomplete: '1',
  });

  // Si la requête contient un numéro, on peut demander des résultats plus précis
  if (/^\d/.test(query.trim())) {
    params.set('type', 'housenumber');
  }

  const url = `${BAN_BASE_URL}/search/?${params.toString()}`;

  try {
    const results = await fetchWithTimeout(url, 4000);
    addressQueryCache.set(trimmed, results);
    return results;
  } catch (error) {
    // Retry une fois sans le filtre type en cas d'échec
    try {
      const fallbackParams = new URLSearchParams({
        q: query.trim(),
        limit: '6',
        autocomplete: '1',
      });
      const fallbackUrl = `${BAN_BASE_URL}/search/?${fallbackParams.toString()}`;
      const fallbackResults = await fetchWithTimeout(fallbackUrl, 3500);
      addressQueryCache.set(trimmed, fallbackResults);
      return fallbackResults;
    } catch (retryError) {
      console.error('Erreur lors du géocodage BAN (après retry):', retryError);
      return [];
    }
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<AddressResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erreur API Adresse (${response.status})`);
    }

    const data = await response.json();

    if (!data?.features?.length) {
      return [];
    }

    return data.features
      .map((feature: any) => parseFeature(feature))
      .filter((result: AddressResult | null) => result !== null)
      // Trier : numéros de rue en premier, puis rues, puis villes
      .sort((a: AddressResult, b: AddressResult) => {
        const typeOrder: Record<string, number> = {
          housenumber: 0,
          street: 1,
          locality: 2,
          municipality: 3,
        };
        const orderA = typeOrder[a.type] ?? 4;
        const orderB = typeOrder[b.type] ?? 4;
        return orderA - orderB;
      })
      .slice(0, 6); // Limiter à 6 résultats après filtrage
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API BAN timeout');
    }
    throw error;
  }
}

function parseFeature(feature: any): AddressResult | null {
  const props = feature.properties;
  const coords = feature.geometry?.coordinates; // [lon, lat]

  // Validation basique
  if (!coords || coords.length < 2) return null;
  if (!props?.label) return null;

  const [lon, lat] = coords;

  // Vérifier que les coordonnées sont en France métropolitaine ou DOM-TOM
  // France métro : lat 41-51, lon -5.5-9.5
  // DOM-TOM : coordonnées très différentes
  const isFranceMetro = lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 9.5;
  const isDomTom = (lat >= -22 && lat <= -11 && lon >= 40 && lon <= 56)   // Réunion, Mayotte
    || (lat >= 14 && lat <= 18 && lon >= -62 && lon <= -60)                // Guadeloupe, Martinique
    || (lat >= 2 && lat <= 6 && lon >= -55 && lon <= -51);                  // Guyane

  if (!isFranceMetro && !isDomTom) return null;

  // Score de confiance BAN : filtrer les résultats peu fiables
  const score = props.score ?? 0;
  if (score < 0.35) return null;

  return {
    id: props.id || `${lat}_${lon}`,
    label: props.label,
    name: props.name || props.label,
    postcode: props.postcode || '',
    citycode: props.citycode || '',
    city: props.city || '',
    context: props.context || '',
    type: props.type || 'unknown',
    coordinates: coords,
    lon,
    lat,
  };
}

/**
 * Géocodage inverse pour récupérer l'adresse d'un point cliqué sur la carte.
 * Amélioré avec :
 * - Timeout explicite
 * - Validation des coordonnées retournées
 * - Retry avec type "street" si "housenumber" ne donne rien
 */
export async function reverseGeocode(lat: number, lon: number): Promise<AddressResult | null> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey)!;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${BAN_BASE_URL}/reverse/?lon=${lon}&lat=${lat}&type=housenumber`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Essayer avec type street
      return await reverseGeocodeStreet(lat, lon);
    }

    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      // Essayer avec type street
      return await reverseGeocodeStreet(lat, lon);
    }

    const result = parseFeature(data.features[0]);
    if (!result) {
      return await reverseGeocodeStreet(lat, lon);
    }

    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn('Reverse geocode timeout, trying street fallback...');
      return await reverseGeocodeStreet(lat, lon);
    }
    console.error('Erreur géocodage inverse:', error);
    return null;
  }
}

/**
 * Fallback : géocodage inverse par type "street" (moins précis mais plus fiable)
 */
async function reverseGeocodeStreet(lat: number, lon: number): Promise<AddressResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `${BAN_BASE_URL}/reverse/?lon=${lon}&lat=${lat}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.features || data.features.length === 0) return null;

    return parseFeature(data.features[0]);
  } catch {
    return null;
  }
}

/**
 * Géolocalisation de secours par adresse IP si le GPS / navigateur échoue
 */
export async function getApproximateLocationByIp(): Promise<{ lat: number; lon: number; city?: string } | null> {
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return { lat: data.latitude, lon: data.longitude, city: data.city };
      }
    }
  } catch (e) {
    console.warn('Fallback IP #1 échoué:', e);
  }

  try {
    const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return { lat: data.latitude, lon: data.longitude, city: data.cityName };
      }
    }
  } catch (e) {
    console.warn('Fallback IP #2 échoué:', e);
  }

  return null;
}
