export interface AddressResult {
  id: string;
  label: string;
  name: string;
  postcode: string;
  citycode: string;
  city: string;
  context: string;
  type: string;
  coordinates: [number, number]; // [lon, lat] as returned by BAN (we will also provide [lat, lon] for Leaflet)
  lat: number;
  lon: number;
}

export type POICategory =
  | 'transports'
  | 'commerces'
  | 'ecoles'
  | 'sante'
  | 'espaces_verts'
  | 'stationnement';

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  subType: string;
  lat: number;
  lon: number;
  distanceMeters: number;
}

export interface CategoryScore {
  category: string;
  label: string;
  score: number; // sur 10
  maxScore: number;
  iconName: string;
  highlightText: string;
  poisFoundCount: number;
  details: string[];
  calculationExplanation: string;
  sources: {
    name: string;
    description: string;
    url?: string;
    lastUpdated?: string;
  }[];
}

export interface FieldImpressions {
  atmosphere: number; // 0 à 100 (0 = Agité, 100 = Calme)
  nightLighting: boolean; // Éclairage nocturne correct
  securityObservations: string;
  mobilityEase: number; // 0 à 100 (0 = Difficile, 100 = Facile)
  observedTransports: string[]; // ['Métro', 'Bus', 'Vélo', 'Parking']
  pmrAccessible: boolean;
  neighborhoodDynamic: number; // 0 à 100 (0 = Peu dynamique, 100 = Très dynamique)
  ambianceTags: string[]; // ['Résidentiel calme', 'Animé', 'Commercial', 'Familial', 'Étudiant']
  generalNotes: string;
}

export interface NeighborhoodAnalysis {
  id: string;
  createdAt: string;
  address: string;
  city: string;
  postcode: string;
  neighborhoodName: string;
  lat: number;
  lon: number;
  globalScore: number; // Moyenne pondérée sur 10
  categories: CategoryScore[];
  pois: POI[];
  impressions?: FieldImpressions;
  isFavorite?: boolean;
}

export type AppView = 'home' | 'new-analysis' | 'impressions' | 'report' | 'enregistrements' | 'notifications';
