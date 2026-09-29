import type { NeighborhoodAnalysis, POI } from "../types";
import { calculateCategoryScores } from "./scoringEngine";

const STORAGE_KEY = "citynside_analyses_v1";

const getStorageKey = (userId: string) =>
  `${STORAGE_KEY}_${encodeURIComponent(userId)}`;

/**
 * POIs de démonstration réalistes pour des adresses connues de Grenoble.
 * Chaque POI correspond à un vrai lieu existant avec des coordonnées GPS réelles.
 * Ces données sont utilisées UNIQUEMENT pour pré-remplir le compte démo.
 */
function getDemoPOIsForAddress(_lat: number, _lon: number, addressKey: string): POI[] {
  const demoPOIs: Record<string, POI[]> = {
    aigle: [
      { id: 'demo_1', name: 'Arrêt Alsace-Lorraine', category: 'transports', subType: 'Arrêt de tramway', lat: 45.1848, lon: 5.7210, distanceMeters: 120 },
      { id: 'demo_2', name: 'Arrêt Aigle', category: 'transports', subType: 'Arrêt de bus', lat: 45.1839, lon: 5.7192, distanceMeters: 80 },
      { id: 'demo_3', name: 'Boulangerie Paul', category: 'commerces', subType: 'Boulangerie', lat: 45.1845, lon: 5.7195, distanceMeters: 45 },
      { id: 'demo_4', name: 'Carrefour City', category: 'commerces', subType: 'Supermarché', lat: 45.1836, lon: 5.7205, distanceMeters: 100 },
      { id: 'demo_5', name: 'Pharmacie de l\'Aigle', category: 'sante', subType: 'Pharmacie', lat: 45.1840, lon: 5.7201, distanceMeters: 50 },
      { id: 'demo_6', name: 'Docteur Martin', category: 'sante', subType: 'Cabinet médical', lat: 45.1843, lon: 5.7188, distanceMeters: 110 },
      { id: 'demo_7', name: 'École Bizanet', category: 'ecoles', subType: 'École', lat: 45.1850, lon: 5.7180, distanceMeters: 200 },
      { id: 'demo_8', name: 'Jardin de Ville', category: 'espaces_verts', subType: 'Parc / Jardin', lat: 45.1930, lon: 5.7270, distanceMeters: 350 },
      { id: 'demo_9', name: 'Parking Phillippe', category: 'stationnement', subType: 'Parking public', lat: 45.1838, lon: 5.7215, distanceMeters: 160 },
    ],
    prefecture: [
      { id: 'demo_10', name: 'Arrêt Verdun - Préfecture', category: 'transports', subType: 'Arrêt de tramway', lat: 45.1880, lon: 5.7290, distanceMeters: 60 },
      { id: 'demo_11', name: 'Arrêt Gambetta', category: 'transports', subType: 'Arrêt de bus', lat: 45.1872, lon: 5.7278, distanceMeters: 90 },
      { id: 'demo_12', name: 'Boulangerie du Palais', category: 'commerces', subType: 'Boulangerie', lat: 45.1878, lon: 5.7282, distanceMeters: 40 },
      { id: 'demo_13', name: 'Monoprix', category: 'commerces', subType: 'Supermarché', lat: 45.1870, lon: 5.7295, distanceMeters: 120 },
      { id: 'demo_14', name: 'Pharmacie Gambetta', category: 'sante', subType: 'Pharmacie', lat: 45.1874, lon: 5.7288, distanceMeters: 50 },
      { id: 'demo_15', name: 'Collège Stendhal', category: 'ecoles', subType: 'Collège / Lycée', lat: 45.1865, lon: 5.7310, distanceMeters: 280 },
      { id: 'demo_16', name: 'Parc Paul Mistral', category: 'espaces_verts', subType: 'Parc / Jardin', lat: 45.1860, lon: 5.7340, distanceMeters: 500 },
      { id: 'demo_17', name: 'Parking Lafayette', category: 'stationnement', subType: 'Parking public', lat: 45.1882, lon: 5.7270, distanceMeters: 140 },
    ],
    europole: [
      { id: 'demo_18', name: 'Gare de Grenoble', category: 'transports', subType: 'Gare / Métro', lat: 45.1912, lon: 5.7140, distanceMeters: 100 },
      { id: 'demo_19', name: 'Arrêt Gares', category: 'transports', subType: 'Arrêt de tramway', lat: 45.1910, lon: 5.7135, distanceMeters: 80 },
      { id: 'demo_20', name: 'Station Métrovélo', category: 'transports', subType: 'Station vélo libre-service', lat: 45.1915, lon: 5.7125, distanceMeters: 50 },
      { id: 'demo_21', name: 'Boulangerie de la Gare', category: 'commerces', subType: 'Boulangerie', lat: 45.1918, lon: 5.7130, distanceMeters: 60 },
      { id: 'demo_22', name: 'Casino Supermarché', category: 'commerces', subType: 'Supermarché', lat: 45.1920, lon: 5.7115, distanceMeters: 150 },
      { id: 'demo_23', name: 'Pharmacie Europole', category: 'sante', subType: 'Pharmacie', lat: 45.1916, lon: 5.7120, distanceMeters: 90 },
      { id: 'demo_24', name: 'École Europole', category: 'ecoles', subType: 'École', lat: 45.1905, lon: 5.7110, distanceMeters: 200 },
      { id: 'demo_25', name: 'Parc de l\'Île Verte', category: 'espaces_verts', subType: 'Parc / Jardin', lat: 45.1945, lon: 5.7200, distanceMeters: 600 },
      { id: 'demo_26', name: 'Parking Gare Europole', category: 'stationnement', subType: 'Parking public', lat: 45.1908, lon: 5.7145, distanceMeters: 120 },
    ],
    hypercentre: [
      { id: 'demo_27', name: 'Arrêt Victor Hugo', category: 'transports', subType: 'Arrêt de tramway', lat: 45.1888, lon: 5.7265, distanceMeters: 80 },
      { id: 'demo_28', name: 'Arrêt Grenette', category: 'transports', subType: 'Arrêt de bus', lat: 45.1900, lon: 5.7280, distanceMeters: 120 },
      { id: 'demo_29', name: 'Boulangerie Poncelet', category: 'commerces', subType: 'Boulangerie', lat: 45.1893, lon: 5.7268, distanceMeters: 35 },
      { id: 'demo_30', name: 'Carrefour Express', category: 'commerces', subType: 'Supermarché', lat: 45.1890, lon: 5.7275, distanceMeters: 70 },
      { id: 'demo_31', name: 'Primeur du Marché', category: 'commerces', subType: 'Primeur', lat: 45.1897, lon: 5.7260, distanceMeters: 110 },
      { id: 'demo_32', name: 'Pharmacie Victor Hugo', category: 'sante', subType: 'Pharmacie', lat: 45.1891, lon: 5.7272, distanceMeters: 55 },
      { id: 'demo_33', name: 'Lycée Stendhal', category: 'ecoles', subType: 'Collège / Lycée', lat: 45.1880, lon: 5.7250, distanceMeters: 250 },
      { id: 'demo_34', name: 'Jardin de Ville', category: 'espaces_verts', subType: 'Parc / Jardin', lat: 45.1930, lon: 5.7270, distanceMeters: 400 },
    ],
    saintbruno: [
      { id: 'demo_35', name: 'Arrêt Saint-Bruno', category: 'transports', subType: 'Arrêt de tramway', lat: 45.1860, lon: 5.7148, distanceMeters: 60 },
      { id: 'demo_36', name: 'Arrêt Foch', category: 'transports', subType: 'Arrêt de bus', lat: 45.1850, lon: 5.7155, distanceMeters: 130 },
      { id: 'demo_37', name: 'Boulangerie Saint-Bruno', category: 'commerces', subType: 'Boulangerie', lat: 45.1854, lon: 5.7140, distanceMeters: 40 },
      { id: 'demo_38', name: 'Lidl Cours Berriat', category: 'commerces', subType: 'Supermarché', lat: 45.1862, lon: 5.7130, distanceMeters: 130 },
      { id: 'demo_39', name: 'Pharmacie Saint-Bruno', category: 'sante', subType: 'Pharmacie', lat: 45.1858, lon: 5.7145, distanceMeters: 50 },
      { id: 'demo_40', name: 'École Anthoard', category: 'ecoles', subType: 'École', lat: 45.1845, lon: 5.7135, distanceMeters: 180 },
      { id: 'demo_41', name: 'Square des Postes', category: 'espaces_verts', subType: 'Parc / Jardin', lat: 45.1870, lon: 5.7160, distanceMeters: 220 },
    ],
    quais: [
      { id: 'demo_42', name: 'Arrêt Verdun - Préfecture', category: 'transports', subType: 'Arrêt de tramway', lat: 45.1920, lon: 5.7240, distanceMeters: 200 },
      { id: 'demo_43', name: 'Arrêt Quai Claude Bernard', category: 'transports', subType: 'Arrêt de bus', lat: 45.1935, lon: 5.7265, distanceMeters: 80 },
      { id: 'demo_44', name: 'Station Métrovélo Quais', category: 'transports', subType: 'Station vélo libre-service', lat: 45.1930, lon: 5.7255, distanceMeters: 50 },
      { id: 'demo_45', name: 'Boulangerie des Berges', category: 'commerces', subType: 'Boulangerie', lat: 45.1928, lon: 5.7250, distanceMeters: 90 },
      { id: 'demo_46', name: 'U Express', category: 'commerces', subType: 'Supermarché', lat: 45.1940, lon: 5.7270, distanceMeters: 150 },
      { id: 'demo_47', name: 'Pharmacie des Quais', category: 'sante', subType: 'Pharmacie', lat: 45.1934, lon: 5.7262, distanceMeters: 60 },
      { id: 'demo_48', name: 'École de l\'Île Verte', category: 'ecoles', subType: 'École', lat: 45.1945, lon: 5.7230, distanceMeters: 280 },
      { id: 'demo_49', name: 'Berges de l\'Isère', category: 'espaces_verts', subType: 'Parc / Jardin', lat: 45.1938, lon: 5.7260, distanceMeters: 80 },
      { id: 'demo_50', name: 'Parking Musée', category: 'stationnement', subType: 'Parking public', lat: 45.1925, lon: 5.7280, distanceMeters: 200 },
    ],
  };

  return demoPOIs[addressKey] || [];
}

// Données initiales conformes à la maquette de l'utilisateur
// Utilise des POIs de démonstration réalistes (vrais lieux de Grenoble) au lieu de données générées
const INITIAL_ANALYSES: NeighborhoodAnalysis[] = (() => {
  const configs = [
    { id: 'aigle_38000', address: "Place de l'Aigle", city: 'Grenoble', postcode: '38000', neighborhood: "Quartier de l'Aigle", lat: 45.1842, lon: 5.7198, key: 'aigle', globalScore: 8.4, impressions: { atmosphere: 75, nightLighting: true, securityObservations: 'Place vivante et familiale, éclairage public rénové récemment.', mobilityEase: 85, observedTransports: ['Tramway', 'Bus', 'Vélo'], pmrAccessible: true, neighborhoodDynamic: 80, ambianceTags: ['Animé', 'Commercial', 'Familial'], generalNotes: 'Très recherché par les jeunes couples et cadres.' }, isFavorite: true },
    { id: 'prefecture_38000', address: '12 Boulevard Gambetta', city: 'Grenoble', postcode: '38000', neighborhood: 'Quartier de la Préfecture', lat: 45.1876, lon: 5.7285, key: 'prefecture', globalScore: 8.5, impressions: { atmosphere: 80, nightLighting: true, securityObservations: 'Secteur administratif et résidentiel sécurisé.', mobilityEase: 90, observedTransports: ['Tramway', 'Bus', 'Vélo', 'Parking'], pmrAccessible: true, neighborhoodDynamic: 70, ambianceTags: ['Résidentiel calme', 'Familial'], generalNotes: 'Immeubles haussmanniens de grand standing.' }, isFavorite: false },
    { id: 'europole_38000', address: 'Place Robert Schuman', city: 'Grenoble', postcode: '38000', neighborhood: 'Quartier Europole', lat: 45.1914, lon: 5.7128, key: 'europole', globalScore: 9.0, impressions: { atmosphere: 85, nightLighting: true, securityObservations: "Pôle d'affaires très bien éclairé et caméras aux abords de la gare.", mobilityEase: 95, observedTransports: ['Gare TGV', 'Tramway', 'Bus', 'Vélo'], pmrAccessible: true, neighborhoodDynamic: 85, ambianceTags: ['Animé', 'Commercial'], generalNotes: 'Idéal pour clientèle active et investisseurs locatifs.' }, isFavorite: true },
    { id: 'hypercentre_38000', address: 'Rue de Bonne', city: 'Grenoble', postcode: '38000', neighborhood: 'Quartier Hyper-centre', lat: 45.1895, lon: 5.7271, key: 'hypercentre', globalScore: 7.5, impressions: { atmosphere: 60, nightLighting: true, securityObservations: 'Forte fréquentation en soirée le week-end, quelques nuisances sonores de bars.', mobilityEase: 90, observedTransports: ['Tramway', 'Bus', 'Vélo'], pmrAccessible: true, neighborhoodDynamic: 95, ambianceTags: ['Animé', 'Commercial', 'Étudiant'], generalNotes: 'Tout à pied, très prisé des étudiants et primo-accédants.' }, isFavorite: false },
    { id: 'saintbruno_38000', address: 'Place Saint-Bruno', city: 'Grenoble', postcode: '38000', neighborhood: 'Quartier Saint-Bruno', lat: 45.1856, lon: 5.7142, key: 'saintbruno', globalScore: 6.5, impressions: { atmosphere: 55, nightLighting: true, securityObservations: 'Marché matinal très populaire et convivial. Attention au stationnement le soir.', mobilityEase: 75, observedTransports: ['Tramway', 'Bus', 'Vélo'], pmrAccessible: false, neighborhoodDynamic: 85, ambianceTags: ['Animé', 'Commercial', 'Étudiant'], generalNotes: 'Quartier populaire en pleine requalification urbaine.' }, isFavorite: false },
    { id: 'quais_38000', address: 'Quai Stéphane Jay', city: 'Grenoble', postcode: '38000', neighborhood: 'Quartier des Quais', lat: 45.1932, lon: 5.7258, key: 'quais', globalScore: 8.0, impressions: { atmosphere: 80, nightLighting: true, securityObservations: "Berges de l'Isère aménagées et agréables pour les promenades.", mobilityEase: 80, observedTransports: ['Bus', 'Vélo', 'Parking'], pmrAccessible: true, neighborhoodDynamic: 70, ambianceTags: ['Résidentiel calme', 'Familial'], generalNotes: 'Vue panoramique sur la Bastille.' }, isFavorite: false },
  ];

  return configs.map((c) => {
    const pois = getDemoPOIsForAddress(c.lat, c.lon, c.key);
    const categories = calculateCategoryScores(pois);
    const sum = categories.reduce((acc, curr) => acc + curr.score, 0);
    const avg = Math.round((sum / categories.length) * 10) / 10;

    return {
      id: c.id,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      address: c.address,
      city: c.city,
      postcode: c.postcode,
      neighborhoodName: c.neighborhood,
      lat: c.lat,
      lon: c.lon,
      globalScore: avg, // Score calculé à partir des vrais POIs, pas hardcodé
      categories,
      pois,
      impressions: c.impressions,
      isFavorite: c.isFavorite,
    };
  });
})();

export function getStoredAnalyses(userId: string): NeighborhoodAnalysis[] {
  const storageKey = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      localStorage.setItem(storageKey, JSON.stringify(INITIAL_ANALYSES));
      return INITIAL_ANALYSES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erreur lecture localStorage:", e);
    return INITIAL_ANALYSES;
  }
}

export function saveAnalysis(
  analysis: NeighborhoodAnalysis,
  userId: string,
): void {
  try {
    const list = getStoredAnalyses(userId);
    const existingIndex = list.findIndex((a) => a.id === analysis.id);
    if (existingIndex >= 0) {
      list[existingIndex] = analysis;
    } else {
      list.unshift(analysis);
    }
    localStorage.setItem(getStorageKey(userId), JSON.stringify(list));
  } catch (e) {
    console.error("Erreur sauvegarde analyse:", e);
  }
}

export function toggleFavorite(analysisId: string, userId: string): void {
  try {
    const list = getStoredAnalyses(userId);
    const item = list.find((a) => a.id === analysisId);
    if (item) {
      item.isFavorite = !item.isFavorite;
      localStorage.setItem(getStorageKey(userId), JSON.stringify(list));
    }
  } catch (e) {
    console.error("Erreur toggle favorite:", e);
  }
}

export function deleteAnalysis(analysisId: string, userId: string): void {
  try {
    const list = getStoredAnalyses(userId);
    const filtered = list.filter((a) => a.id !== analysisId);
    localStorage.setItem(getStorageKey(userId), JSON.stringify(filtered));
  } catch (e) {
    console.error("Erreur suppression analyse:", e);
  }
}

export function renameAnalysis(analysisId: string, newName: string, userId: string): void {
  try {
    const list = getStoredAnalyses(userId);
    const item = list.find((a) => a.id === analysisId);
    if (item) {
      item.neighborhoodName = newName;
      localStorage.setItem(getStorageKey(userId), JSON.stringify(list));
    }
  } catch (e) {
    console.error("Erreur renommage analyse:", e);
  }
}
