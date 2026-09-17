import type { AddressResult } from '../types';

/**
 * Service d'interaction avec l'API Base Adresse Nationale (BAN - data.gouv.fr)
 * Gratuite, sans clé API, mise à jour quotidienne par l'IGN et l'ANCT.
 */
export async function searchAddress(query: string): Promise<AddressResult[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&autocomplete=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur API Adresse (${response.status})`);
    }

    const data = await response.json();

    if (!data || !data.features) {
      return [];
    }

    return data.features.map((feature: any) => {
      const coords = feature.geometry.coordinates; // [lon, lat]
      return {
        id: feature.properties.id || `${coords[1]}_${coords[0]}`,
        label: feature.properties.label,
        name: feature.properties.name,
        postcode: feature.properties.postcode,
        citycode: feature.properties.citycode,
        city: feature.properties.city,
        context: feature.properties.context,
        type: feature.properties.type,
        coordinates: coords,
        lon: coords[0],
        lat: coords[1],
      };
    });
  } catch (error) {
    console.error('Erreur lors du géocodage BAN:', error);
    return [];
  }
}

/**
 * Géocodage inverse pour récupérer l'adresse d'un point cliqué sur la carte
 */
export async function reverseGeocode(lat: number, lon: number): Promise<AddressResult | null> {
  const url = `https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const coords = feature.geometry.coordinates;

    return {
      id: feature.properties.id,
      label: feature.properties.label,
      name: feature.properties.name,
      postcode: feature.properties.postcode,
      citycode: feature.properties.citycode,
      city: feature.properties.city,
      context: feature.properties.context,
      type: feature.properties.type,
      coordinates: coords,
      lon: coords[0],
      lat: coords[1],
    };
  } catch (error) {
    console.error('Erreur géocodage inverse:', error);
    return null;
  }
}
