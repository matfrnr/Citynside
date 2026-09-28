import type { NeighborhoodAnalysis } from '../types';
import { calculateCategoryScores } from './scoringEngine';
import { generateRealisticPOIs } from './osmApi';

const STORAGE_KEY = 'citynside_analyses_v1';

// Données initiales conformes à la maquette de l'utilisateur
const INITIAL_ANALYSES: NeighborhoodAnalysis[] = [
  {
    id: 'aigle_38000',
    createdAt: '2026-09-15T14:30:00Z',
    address: 'Place de l’Aigle',
    city: 'Grenoble',
    postcode: '38000',
    neighborhoodName: 'Quartier de l’Aigle',
    lat: 45.1842,
    lon: 5.7198,
    globalScore: 8.4,
    categories: calculateCategoryScores(generateRealisticPOIs(45.1842, 5.7198)),
    pois: generateRealisticPOIs(45.1842, 5.7198),
    impressions: {
      atmosphere: 75,
      nightLighting: true,
      securityObservations: 'Place vivante et familiale, éclairage public rénové récemment.',
      mobilityEase: 85,
      observedTransports: ['Tramway', 'Bus', 'Vélo'],
      pmrAccessible: true,
      neighborhoodDynamic: 80,
      ambianceTags: ['Animé', 'Commercial', 'Familial'],
      generalNotes: 'Très recherché par les jeunes couples et cadres.',
    },
    isFavorite: true,
  },
  {
    id: 'prefecture_38000',
    createdAt: '2026-09-14T10:15:00Z',
    address: '12 Boulevard Gambetta',
    city: 'Grenoble',
    postcode: '38000',
    neighborhoodName: 'Quartier de la Préfecture',
    lat: 45.1876,
    lon: 5.7285,
    globalScore: 8.5,
    categories: calculateCategoryScores(generateRealisticPOIs(45.1876, 5.7285)),
    pois: generateRealisticPOIs(45.1876, 5.7285),
    impressions: {
      atmosphere: 80,
      nightLighting: true,
      securityObservations: 'Secteur administratif et résidentiel sécurisé.',
      mobilityEase: 90,
      observedTransports: ['Tramway', 'Bus', 'Vélo', 'Parking'],
      pmrAccessible: true,
      neighborhoodDynamic: 70,
      ambianceTags: ['Résidentiel calme', 'Familial'],
      generalNotes: 'Immeubles haussmanniens de grand standing.',
    },
    isFavorite: false,
  },
  {
    id: 'europole_38000',
    createdAt: '2026-09-13T16:45:00Z',
    address: 'Place Robert Schuman',
    city: 'Grenoble',
    postcode: '38000',
    neighborhoodName: 'Quartier Europole',
    lat: 45.1914,
    lon: 5.7128,
    globalScore: 9.0,
    categories: calculateCategoryScores(generateRealisticPOIs(45.1914, 5.7128)),
    pois: generateRealisticPOIs(45.1914, 5.7128),
    impressions: {
      atmosphere: 85,
      nightLighting: true,
      securityObservations: 'Pôle d’affaires très bien éclairé et caméras aux abords de la gare.',
      mobilityEase: 95,
      observedTransports: ['Gare TGV', 'Tramway', 'Bus', 'Vélo'],
      pmrAccessible: true,
      neighborhoodDynamic: 85,
      ambianceTags: ['Animé', 'Commercial'],
      generalNotes: 'Idéal pour clientèle active et investisseurs locatifs.',
    },
    isFavorite: true,
  },
  {
    id: 'hypercentre_38000',
    createdAt: '2026-09-12T11:20:00Z',
    address: 'Rue de Bonne',
    city: 'Grenoble',
    postcode: '38000',
    neighborhoodName: 'Quartier Hyper-centre',
    lat: 45.1895,
    lon: 5.7271,
    globalScore: 7.5,
    categories: calculateCategoryScores(generateRealisticPOIs(45.1895, 5.7271)),
    pois: generateRealisticPOIs(45.1895, 5.7271),
    impressions: {
      atmosphere: 60,
      nightLighting: true,
      securityObservations: 'Forte fréquentation en soirée le week-end, quelques nuisances sonores de bars.',
      mobilityEase: 90,
      observedTransports: ['Tramway', 'Bus', 'Vélo'],
      pmrAccessible: true,
      neighborhoodDynamic: 95,
      ambianceTags: ['Animé', 'Commercial', 'Étudiant'],
      generalNotes: 'Tout à pied, très prisé des étudiants et primo-accédants.',
    },
    isFavorite: false,
  },
  {
    id: 'saintbruno_38000',
    createdAt: '2026-09-11T09:00:00Z',
    address: 'Place Saint-Bruno',
    city: 'Grenoble',
    postcode: '38000',
    neighborhoodName: 'Quartier Saint-Bruno',
    lat: 45.1856,
    lon: 5.7142,
    globalScore: 6.5,
    categories: calculateCategoryScores(generateRealisticPOIs(45.1856, 5.7142)),
    pois: generateRealisticPOIs(45.1856, 5.7142),
    impressions: {
      atmosphere: 55,
      nightLighting: true,
      securityObservations: 'Marché matinal très populaire et convivial. Attention au stationnement le soir.',
      mobilityEase: 75,
      observedTransports: ['Tramway', 'Bus', 'Vélo'],
      pmrAccessible: false,
      neighborhoodDynamic: 85,
      ambianceTags: ['Animé', 'Commercial', 'Étudiant'],
      generalNotes: 'Quartier populaire en pleine requalification urbaine.',
    },
    isFavorite: false,
  },
  {
    id: 'quais_38000',
    createdAt: '2026-09-10T17:30:00Z',
    address: 'Quai Stéphane Jay',
    city: 'Grenoble',
    postcode: '38000',
    neighborhoodName: 'Quartier des Quais',
    lat: 45.1932,
    lon: 5.7258,
    globalScore: 8.0,
    categories: calculateCategoryScores(generateRealisticPOIs(45.1932, 5.7258)),
    pois: generateRealisticPOIs(45.1932, 5.7258),
    impressions: {
      atmosphere: 80,
      nightLighting: true,
      securityObservations: 'Berges de l’Isère aménagées et agréables pour les promenades.',
      mobilityEase: 80,
      observedTransports: ['Bus', 'Vélo', 'Parking'],
      pmrAccessible: true,
      neighborhoodDynamic: 70,
      ambianceTags: ['Résidentiel calme', 'Familial'],
      generalNotes: 'Vue panoramique sur la Bastille.',
    },
    isFavorite: false,
  },
];

export function getStoredAnalyses(): NeighborhoodAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ANALYSES));
      return INITIAL_ANALYSES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erreur lecture localStorage:', e);
    return INITIAL_ANALYSES;
  }
}

export function saveAnalysis(analysis: NeighborhoodAnalysis): void {
  try {
    const list = getStoredAnalyses();
    const existingIndex = list.findIndex((a) => a.id === analysis.id);
    if (existingIndex >= 0) {
      list[existingIndex] = analysis;
    } else {
      list.unshift(analysis);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Erreur sauvegarde analyse:', e);
  }
}

export function toggleFavorite(analysisId: string): void {
  try {
    const list = getStoredAnalyses();
    const item = list.find((a) => a.id === analysisId);
    if (item) {
      item.isFavorite = !item.isFavorite;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Erreur toggle favorite:', e);
  }
}
