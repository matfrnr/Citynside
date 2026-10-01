/**
 * Service pour la qualité de l'air via l'API Open-Meteo Air Quality
 * 100% gratuite, sans clé API, ultra-rapide (<150ms).
 * Fournit l'indice européen AQI (0 = excellent, 100+ = très mauvais), PM2.5, PM10 et NO2.
 */

export interface AirQualityData {
  europeanAqi: number; // 0-20: Bon, 20-40: Moyen, 40-60: Dégradé, 60-80: Mauvais, 80+: Très mauvais
  pm25: number;        // µg/m³
  pm10: number;        // µg/m³
  no2: number;         // µg/m³
  label: string;       // "Très bonne", "Bonne", "Moyenne", "Dégradée", etc.
  scoreImpact: number; // Bonus/malus pour le score de tranquillité/environnement (-1.5 à +1.5)
}

const cache = new Map<string, { data: AirQualityData; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityData | null> {
  const roundedKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(roundedKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s max timeout

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,nitrogen_dioxide`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Air Quality API error: ${response.status}`);
    }

    const json = await response.json();
    const current = json.current;
    if (!current) return null;

    const aqi = Math.round(current.european_aqi ?? 25);
    const pm25 = Math.round((current.pm2_5 ?? 10) * 10) / 10;
    const pm10 = Math.round((current.pm10 ?? 15) * 10) / 10;
    const no2 = Math.round((current.nitrogen_dioxide ?? 15) * 10) / 10;

    let label = "Bonne";
    let scoreImpact = 1.0;

    if (aqi <= 20) {
      label = "Excellente pureté de l'air";
      scoreImpact = 1.5;
    } else if (aqi <= 40) {
      label = "Bonne qualité de l'air";
      scoreImpact = 0.8;
    } else if (aqi <= 60) {
      label = "Qualité de l'air moyenne";
      scoreImpact = 0;
    } else if (aqi <= 80) {
      label = "Qualité de l'air dégradée";
      scoreImpact = -0.8;
    } else {
      label = "Pollution notable";
      scoreImpact = -1.5;
    }

    const result: AirQualityData = {
      europeanAqi: aqi,
      pm25,
      pm10,
      no2,
      label,
      scoreImpact,
    };

    cache.set(roundedKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.warn("Qualité de l'air indisponible:", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
