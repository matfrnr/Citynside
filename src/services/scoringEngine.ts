import type { CategoryScore, POI, ScoreFactor } from "../types";
import type { AirQualityData } from "./airQualityApi";

/**
 * Moteur de calcul des scores d'environnement Citynside.
 * Fournit une explication transparente, vérifiable et reproductible de chaque note.
 *
 * Décompose précisément :
 * - Le score de base
 * - Tout ce qui fait GAGNER des points (points forts / atouts)
 * - Tout ce qui fait PERDRE des points (points de vigilance / manques)
 */
export function calculateCategoryScores(
  pois: POI[],
  airQuality?: AirQualityData | null,
): CategoryScore[] {
  // Regroupement des POI par catégorie
  const transports = pois.filter((p) => p.category === "transports");
  const commerces = pois.filter((p) => p.category === "commerces");
  const ecoles = pois.filter((p) => p.category === "ecoles");
  const sante = pois.filter((p) => p.category === "sante");
  const espacesVerts = pois.filter((p) => p.category === "espaces_verts");
  const stationnement = pois.filter((p) => p.category === "stationnement");
  const loisirs = pois.filter((p) => p.category === "loisirs");

  // =========================================================================
  // 1. TRANSPORTS (Sur 10)
  // =========================================================================
  const baseTransport = 3.0;
  let transportScore = baseTransport;
  const transportPositive: ScoreFactor[] = [];
  const transportNegative: ScoreFactor[] = [];

  const closestHeavy = transports.find(
    (p) =>
      p.subType.toLowerCase().includes("tram") ||
      p.subType.toLowerCase().includes("gare") ||
      p.subType.toLowerCase().includes("métro"),
  );
  const closestBus = transports.find((p) =>
    p.subType.toLowerCase().includes("bus"),
  );
  const bikeRental = transports.find((p) =>
    p.subType.toLowerCase().includes("vélo"),
  );

  if (closestHeavy) {
    if (closestHeavy.distanceMeters <= 300) {
      transportScore += 3.5;
      transportPositive.push({
        label: `${closestHeavy.name || closestHeavy.subType} à ${closestHeavy.distanceMeters}m`,
        points: 3.5,
        impact: "positive",
        detail: "Accès piéton immédiat (< 4 min) à un transport lourd et rapide.",
      });
    } else if (closestHeavy.distanceMeters <= 600) {
      transportScore += 2.5;
      transportPositive.push({
        label: `${closestHeavy.name || closestHeavy.subType} à ${closestHeavy.distanceMeters}m`,
        points: 2.5,
        impact: "positive",
        detail: "Accès à pied confortable (< 8 min).",
      });
    } else {
      transportScore += 1.2;
      transportPositive.push({
        label: `${closestHeavy.name || closestHeavy.subType} à ${closestHeavy.distanceMeters}m`,
        points: 1.2,
        impact: "positive",
        detail: "Ligne structurante accessible à pied bien qu'un peu éloignée.",
      });
    }
  } else {
    transportScore -= 1.5;
    transportNegative.push({
      label: "Pas de métro, tramway ni gare à moins de 800m",
      points: -1.5,
      impact: "negative",
      detail: "Dépendance accrue au bus ou à la voiture pour les liaisons rapides.",
    });
  }

  if (closestBus) {
    if (closestBus.distanceMeters <= 200) {
      transportScore += 2.0;
      transportPositive.push({
        label: `${closestBus.name || "Arrêt de bus"} à ${closestBus.distanceMeters}m`,
        points: 2.0,
        impact: "positive",
        detail: "Arrêt au pied de l'adresse ou à moins de 3 min.",
      });
    } else if (closestBus.distanceMeters <= 450) {
      transportScore += 1.4;
      transportPositive.push({
        label: `${closestBus.name || "Arrêt de bus"} à ${closestBus.distanceMeters}m`,
        points: 1.4,
        impact: "positive",
        detail: "Desserte de quartier accessible.",
      });
    }
  } else {
    transportScore -= 1.0;
    transportNegative.push({
      label: "Aucun arrêt de bus à moins de 450m",
      points: -1.0,
      impact: "negative",
      detail: "Manque de desserte locale directe.",
    });
  }

  if (bikeRental) {
    transportScore += 0.8;
    transportPositive.push({
      label: `${bikeRental.name || "Station vélo"} à ${bikeRental.distanceMeters}m`,
      points: 0.8,
      impact: "positive",
      detail: "Disponibilité de mobilités douces en libre-service.",
    });
  }

  const busCount = transports.filter((p) =>
    p.subType.toLowerCase().includes("bus"),
  ).length;
  if (busCount >= 3) {
    transportScore += 0.7;
    transportPositive.push({
      label: `Réseau dense de bus (${busCount} arrêts)`,
      points: 0.7,
      impact: "positive",
      detail: "Multiples lignes alternatives disponibles.",
    });
  }

  const finalTransportScore = Math.max(
    1,
    Math.min(10, Math.round(transportScore * 10) / 10),
  );

  // =========================================================================
  // 2. COMMERCES & SERVICES (Sur 10)
  // =========================================================================
  const baseCommerce = 3.0;
  let commerceScore = baseCommerce;
  const commercePositive: ScoreFactor[] = [];
  const commerceNegative: ScoreFactor[] = [];

  const bakery = commerces.find((p) =>
    p.subType.toLowerCase().includes("boulangerie"),
  );
  const grocery = commerces.find(
    (p) =>
      p.subType.toLowerCase().includes("supermarché") ||
      p.subType.toLowerCase().includes("épicerie") ||
      p.subType.toLowerCase().includes("supérette"),
  );
  const butcherOrGreengrocer = commerces.find(
    (p) =>
      p.subType.toLowerCase().includes("boucherie") ||
      p.subType.toLowerCase().includes("primeur"),
  );

  if (bakery) {
    if (bakery.distanceMeters <= 300) {
      commerceScore += 2.5;
      commercePositive.push({
        label: `${bakery.name || "Boulangerie"} à ${bakery.distanceMeters}m`,
        points: 2.5,
        impact: "positive",
        detail: "Pain frais et viennoiseries à moins de 4 min à pied.",
      });
    } else {
      commerceScore += 1.5;
      commercePositive.push({
        label: `${bakery.name || "Boulangerie"} à ${bakery.distanceMeters}m`,
        points: 1.5,
        impact: "positive",
        detail: "Boulangerie accessible dans le quartier.",
      });
    }
  } else {
    commerceScore -= 1.2;
    commerceNegative.push({
      label: "Pas de boulangerie à proximité immédiate (<800m)",
      points: -1.2,
      impact: "negative",
      detail: "Obligation de se déplacer plus loin pour le quotidien.",
    });
  }

  if (grocery) {
    if (grocery.distanceMeters <= 400) {
      commerceScore += 3.0;
      commercePositive.push({
        label: `${grocery.name || "Commerce alimentaire"} à ${grocery.distanceMeters}m`,
        points: 3.0,
        impact: "positive",
        detail: "Courses alimentaires du quotidien faisables intégralement à pied.",
      });
    } else {
      commerceScore += 1.8;
      commercePositive.push({
        label: `${grocery.name || "Commerce alimentaire"} à ${grocery.distanceMeters}m`,
        points: 1.8,
        impact: "positive",
        detail: "Magasin alimentaire accessible à pied mais à plus de 5 min.",
      });
    }
  } else {
    commerceScore -= 1.5;
    commerceNegative.push({
      label: "Aucun supermarché ou supérette dans un rayon de 400m",
      points: -1.5,
      impact: "negative",
      detail: "Nécessite de faire ses courses alimentaires plus loin.",
    });
  }

  if (butcherOrGreengrocer) {
    commerceScore += 0.8;
    commercePositive.push({
      label: `${butcherOrGreengrocer.name || butcherOrGreengrocer.subType} à ${butcherOrGreengrocer.distanceMeters}m`,
      points: 0.8,
      impact: "positive",
      detail: "Commerces de bouche spécialisés de proximité.",
    });
  }

  if (commerces.length >= 4) {
    commerceScore += 0.9;
    commercePositive.push({
      label: `Grande variété commerciale (${commerces.length} commerces)`,
      points: 0.9,
      impact: "positive",
      detail: "Quartier vivant et commerçant.",
    });
  } else if (commerces.length <= 1) {
    commerceScore -= 0.8;
    commerceNegative.push({
      label: "Faible densité commerciale globale dans la zone",
      points: -0.8,
      impact: "negative",
      detail: "Offre de services restreinte au strict minimum.",
    });
  }

  const finalCommerceScore = Math.max(
    1,
    Math.min(10, Math.round(commerceScore * 10) / 10),
  );

  // =========================================================================
  // 3. ÉCOLES & ÉDUCATION (Sur 10)
  // =========================================================================
  const baseEcole = 3.5;
  let ecoleScore = baseEcole;
  const ecolePositive: ScoreFactor[] = [];
  const ecoleNegative: ScoreFactor[] = [];

  const closestSchool = ecoles[0];
  const maternelle = ecoles.find(
    (e) =>
      e.subType.toLowerCase().includes("maternelle") ||
      e.subType.toLowerCase().includes("crèche") ||
      e.name.toLowerCase().includes("maternelle"),
  );
  const elementaire = ecoles.find(
    (e) =>
      e.subType.toLowerCase().includes("école") ||
      e.name.toLowerCase().includes("primaire") ||
      e.name.toLowerCase().includes("élémentaire"),
  );
  const secondaire = ecoles.find(
    (e) =>
      e.subType.toLowerCase().includes("collège") ||
      e.subType.toLowerCase().includes("lycée") ||
      e.name.toLowerCase().includes("collège") ||
      e.name.toLowerCase().includes("lycée"),
  );

  if (closestSchool) {
    if (closestSchool.distanceMeters <= 350) {
      ecoleScore += 3.5;
      ecolePositive.push({
        label: `${closestSchool.name || closestSchool.subType} à ${closestSchool.distanceMeters}m`,
        points: 3.5,
        impact: "positive",
        detail: "Trajet scolaire ultra court et sécurisé pour les enfants.",
      });
    } else if (closestSchool.distanceMeters <= 650) {
      ecoleScore += 2.2;
      ecolePositive.push({
        label: `${closestSchool.name || closestSchool.subType} à ${closestSchool.distanceMeters}m`,
        points: 2.2,
        impact: "positive",
        detail: "Établissement accessible à pied facilement.",
      });
    } else {
      ecoleScore += 1.0;
      ecolePositive.push({
        label: `${closestSchool.name} à ${closestSchool.distanceMeters}m`,
        points: 1.0,
        impact: "positive",
        detail: "Établissement recensé dans le secteur élargi.",
      });
    }
  } else {
    ecoleScore -= 2.0;
    ecoleNegative.push({
      label: "Aucun établissement scolaire dans les 800m",
      points: -2.0,
      impact: "negative",
      detail: "Déplacement véhiculé ou transport requis pour la scolarité.",
    });
  }

  if (maternelle && elementaire) {
    ecoleScore += 1.5;
    ecolePositive.push({
      label: "Parcours complet Maternelle + Élémentaire à pied",
      points: 1.5,
      impact: "positive",
      detail: "Idéal pour les familles avec jeunes enfants.",
    });
  } else if (!maternelle) {
    ecoleScore -= 0.8;
    ecoleNegative.push({
      label: "Pas d'école maternelle ou crèche identifiée à pied",
      points: -0.8,
      impact: "negative",
      detail: "Garde de la petite enfance potentiellement plus complexe.",
    });
  }

  if (secondaire) {
    ecoleScore += 0.8;
    ecolePositive.push({
      label: `${secondaire.name || secondaire.subType} à ${secondaire.distanceMeters}m`,
      points: 0.8,
      impact: "positive",
      detail: "Collège ou lycée accessible pour les adolescents.",
    });
  }

  const finalEcoleScore = Math.max(
    1,
    Math.min(10, Math.round(ecoleScore * 10) / 10),
  );

  // =========================================================================
  // 4. SERVICES DE SANTÉ (Sur 10)
  // =========================================================================
  const baseSante = 3.5;
  let santeScore = baseSante;
  const santePositive: ScoreFactor[] = [];
  const santeNegative: ScoreFactor[] = [];

  const pharmacy = sante.find((p) =>
    p.subType.toLowerCase().includes("pharmacie"),
  );
  const doctor = sante.find(
    (p) =>
      p.subType.toLowerCase().includes("médecin") ||
      p.subType.toLowerCase().includes("cabinet") ||
      p.subType.toLowerCase().includes("clinique") ||
      p.subType.toLowerCase().includes("dentiste"),
  );
  const hospital = sante.find((p) =>
    p.subType.toLowerCase().includes("hôpital"),
  );

  if (pharmacy) {
    if (pharmacy.distanceMeters <= 350) {
      santeScore += 2.8;
      santePositive.push({
        label: `${pharmacy.name || "Pharmacie"} à ${pharmacy.distanceMeters}m`,
        points: 2.8,
        impact: "positive",
        detail: "Médicaments et soins de première urgence immédiats.",
      });
    } else {
      santeScore += 1.6;
      santePositive.push({
        label: `${pharmacy.name || "Pharmacie"} à ${pharmacy.distanceMeters}m`,
        points: 1.6,
        impact: "positive",
        detail: "Pharmacie accessible à distance de marche raisonnable.",
      });
    }
  } else {
    santeScore -= 1.5;
    santeNegative.push({
      label: "Aucune pharmacie dans un rayon de 800m",
      points: -1.5,
      impact: "negative",
      detail: "Indisponibilité d'officine pharmaceutique à pied.",
    });
  }

  if (doctor) {
    if (doctor.distanceMeters <= 500) {
      santeScore += 2.5;
      santePositive.push({
        label: `${doctor.name || doctor.subType} à ${doctor.distanceMeters}m`,
        points: 2.5,
        impact: "positive",
        detail: "Consultations médicales et praticiens dans le quartier.",
      });
    } else {
      santeScore += 1.2;
      santePositive.push({
        label: `${doctor.name || doctor.subType} à ${doctor.distanceMeters}m`,
        points: 1.2,
        impact: "positive",
        detail: "Professionnel de santé accessible.",
      });
    }
  } else {
    santeScore -= 1.2;
    santeNegative.push({
      label: "Pas de cabinet médical ou médecin répertorié à proximité",
      points: -1.2,
      impact: "negative",
      detail: "Densité médicale faible dans le quartier immédiat.",
    });
  }

  if (hospital) {
    santeScore += 1.0;
    santePositive.push({
      label: `${hospital.name || "Établissement hospitalier"} à ${hospital.distanceMeters}m`,
      points: 1.0,
      impact: "positive",
      detail: "Pôle de soins complet et urgences à portée.",
    });
  }

  const finalSanteScore = Math.max(
    1,
    Math.min(10, Math.round(santeScore * 10) / 10),
  );

  // =========================================================================
  // 5. ESPACES VERTS & BIODIVERSITÉ (Sur 10)
  // =========================================================================
  const baseGreen = 3.0;
  let greenScore = baseGreen;
  const greenPositive: ScoreFactor[] = [];
  const greenNegative: ScoreFactor[] = [];

  const closestPark = espacesVerts[0];
  const playground = espacesVerts.find((p) =>
    p.subType.toLowerCase().includes("jeux"),
  );

  if (closestPark) {
    if (closestPark.distanceMeters <= 300) {
      greenScore += 4.0;
      greenPositive.push({
        label: `${closestPark.name || closestPark.subType} à ${closestPark.distanceMeters}m`,
        points: 4.0,
        impact: "positive",
        detail: "Poumon vert et promenade accessible en moins de 4 minutes.",
      });
    } else if (closestPark.distanceMeters <= 600) {
      greenScore += 2.5;
      greenPositive.push({
        label: `${closestPark.name || closestPark.subType} à ${closestPark.distanceMeters}m`,
        points: 2.5,
        impact: "positive",
        detail: "Espace vert accessible pour les sorties quotidiennes.",
      });
    } else {
      greenScore += 1.2;
      greenPositive.push({
        label: `${closestPark.name || closestPark.subType} à ${closestPark.distanceMeters}m`,
        points: 1.2,
        impact: "positive",
        detail: "Parc accessible mais demandant plus de 10 min de marche.",
      });
    }
  } else {
    greenScore -= 2.0;
    greenNegative.push({
      label: "Aucun parc, jardin public ou aire naturelle à moins de 800m",
      points: -2.0,
      impact: "negative",
      detail: "Environnement très minéral sans espace de détente vert.",
    });
  }

  if (espacesVerts.length >= 2) {
    greenScore += 1.3;
    greenPositive.push({
      label: `${espacesVerts.length} espaces verts dans le secteur`,
      points: 1.3,
      impact: "positive",
      detail: "Choix varié d'espaces arborés et de promenades.",
    });
  }

  if (playground) {
    greenScore += 0.7;
    greenPositive.push({
      label: `Aire de jeux enfants à ${playground.distanceMeters}m`,
      points: 0.7,
      impact: "positive",
      detail: "Équipement ludique et familial.",
    });
  }

  const finalGreenScore = Math.max(
    1,
    Math.min(10, Math.round(greenScore * 10) / 10),
  );

  // =========================================================================
  // 6. STATIONNEMENT & PARKINGS (Sur 10)
  // =========================================================================
  const basePark = 4.5;
  let parkScore = basePark;
  const parkPositive: ScoreFactor[] = [];
  const parkNegative: ScoreFactor[] = [];

  const closestParking = stationnement[0];

  if (closestParking) {
    if (closestParking.distanceMeters <= 300) {
      parkScore += 3.5;
      parkPositive.push({
        label: `${closestParking.name || "Parking public"} à ${closestParking.distanceMeters}m`,
        points: 3.5,
        impact: "positive",
        detail: "Stationnement sécurisé ou public au plus près du bien.",
      });
    } else if (closestParking.distanceMeters <= 600) {
      parkScore += 2.3;
      parkPositive.push({
        label: `${closestParking.name || "Parking public"} à ${closestParking.distanceMeters}m`,
        points: 2.3,
        impact: "positive",
        detail: "Offre de stationnement aménagée dans le secteur.",
      });
    }
  } else {
    parkScore -= 1.0;
    parkNegative.push({
      label: "Pas de parking public aménagé identifié (<800m)",
      points: -1.0,
      impact: "negative",
      detail: "Stationnement principalement tributaire de la voirie publique.",
    });
  }

  if (stationnement.length >= 2) {
    parkScore += 0.8;
    parkPositive.push({
      label: `Multiples parkings (${stationnement.length} répertoriés)`,
      points: 0.8,
      impact: "positive",
      detail: "Capacité d'accueil véhicules satisfaisante.",
    });
  }

  const finalParkScore = Math.max(
    1,
    Math.min(10, Math.round(parkScore * 10) / 10),
  );

  // =========================================================================
  // 7. TRANQUILLITÉ & NUISANCES SONORES (Sur 10)
  // =========================================================================
  const baseTranquility = 6.5;
  let tranquilityScore = baseTranquility;
  const tranquilityPositive: ScoreFactor[] = [];
  const tranquilityNegative: ScoreFactor[] = [];

  if (closestPark && closestPark.distanceMeters <= 350) {
    tranquilityScore += 1.5;
    tranquilityPositive.push({
      label: `Tampon végétal : parc à ${closestPark.distanceMeters}m`,
      points: 1.5,
      impact: "positive",
      detail: "La proximité des arbres et espaces verts absorbe le bruit ambiant.",
    });
  }

  if (closestHeavy && closestHeavy.distanceMeters <= 120) {
    tranquilityScore -= 2.0;
    tranquilityNegative.push({
      label: `Proximité immédiate transport lourd (${closestHeavy.distanceMeters}m)`,
      points: -2.0,
      impact: "negative",
      detail: "Passage régulier de tramway/train susceptible de générer des vibrations sonores.",
    });
  } else if (closestHeavy && closestHeavy.distanceMeters <= 300) {
    tranquilityScore -= 0.8;
    tranquilityNegative.push({
      label: `Axe de transport à ${closestHeavy.distanceMeters}m`,
      points: -0.8,
      impact: "negative",
      detail: "Activité de circulation modérée à proximité.",
    });
  } else {
    tranquilityScore += 0.8;
    tranquilityPositive.push({
      label: "Absence de voies ferrées ou tramway en bas d'immeuble",
      points: 0.8,
      impact: "positive",
      detail: "Pas de nuisance de roulement lourd directe.",
    });
  }

  if (commerces.length >= 6) {
    tranquilityScore -= 0.8;
    tranquilityNegative.push({
      label: `Zone commerçante très active (${commerces.length} commerces)`,
      points: -0.8,
      impact: "negative",
      detail: "Livraisons matinales et passage piéton soutenu.",
    });
  } else if (commerces.length <= 2) {
    tranquilityScore += 0.8;
    tranquilityPositive.push({
      label: "Environnement résidentiel peu passant",
      points: 0.8,
      impact: "positive",
      detail: "Flux de clientèle et de véhicules réduit.",
    });
  }

  // Prise en compte de la qualité de l'air réelle si disponible
  if (airQuality) {
    if (airQuality.scoreImpact > 0) {
      tranquilityScore += airQuality.scoreImpact;
      tranquilityPositive.push({
        label: `${airQuality.label} (Indice AQI: ${airQuality.europeanAqi})`,
        points: airQuality.scoreImpact,
        impact: "positive",
        detail: "Faibles concentrations en particules fines PM2.5 et dioxyde d'azote.",
      });
    } else if (airQuality.scoreImpact < 0) {
      tranquilityScore += airQuality.scoreImpact;
      tranquilityNegative.push({
        label: `${airQuality.label} (Indice AQI: ${airQuality.europeanAqi})`,
        points: airQuality.scoreImpact,
        impact: "negative",
        detail: "Niveau de particules atmosphériques nécessitant vigilance.",
      });
    }
  }

  const finalTranquilityScore = Math.max(
    2.5,
    Math.min(10, Math.round(tranquilityScore * 10) / 10),
  );

  // =========================================================================
  // 9. SPORTS, CULTURE & LOISIRS (Sur 10)
  // =========================================================================
  const leisurePositive: ScoreFactor[] = [];
  let leisureScore = 5.5; // score neutre en l'absence de données OSM suffisantes
  const sportsPlaces = loisirs.filter((poi) => /sport|piscine|stade|terrain|golf|patinoire/i.test(poi.subType));
  const culturePlaces = loisirs.filter((poi) => /bibliothèque|médiathèque|culturel|cinéma|théâtre|musée|socioculturel/i.test(poi.subType));
  const closestLeisure = [...loisirs].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

  if (sportsPlaces.length > 0) {
    const closestSport = sportsPlaces[0];
    const points = closestSport.distanceMeters <= 450 ? 1.7 : 1.0;
    leisureScore += points;
    leisurePositive.push({ label: `${closestSport.subType} à ${closestSport.distanceMeters}m`, points, impact: "positive", detail: "Équipement sportif ou de loisirs accessible à pied." });
  }
  if (culturePlaces.length > 0) {
    const closestCulture = culturePlaces[0];
    const points = closestCulture.distanceMeters <= 600 ? 1.7 : 1.0;
    leisureScore += points;
    leisurePositive.push({ label: `${closestCulture.subType} à ${closestCulture.distanceMeters}m`, points, impact: "positive", detail: "Équipement culturel ou de proximité présent dans le secteur." });
  }
  const leisureVariety = new Set(loisirs.map((poi) => poi.subType)).size;
  if (leisureVariety >= 3) {
    const points = Math.min(1.1, (leisureVariety - 2) * 0.35);
    leisureScore += points;
    leisurePositive.push({ label: `${leisureVariety} types d'équipements de loisirs`, points, impact: "positive", detail: "Plusieurs types d'activités sont recensés à proximité." });
  }
  const finalLeisureScore = Math.min(10, Math.round(leisureScore * 10) / 10);

  // =========================================================================
  // 8. ACCESSIBILITÉ PMR & PIÉTONS (Sur 10)
  // =========================================================================
  const basePmr = 5.0;
  let pmrScore = basePmr;
  const pmrPositive: ScoreFactor[] = [];
  const pmrNegative: ScoreFactor[] = [];

  if (closestHeavy) {
    pmrScore += 1.8;
    pmrPositive.push({
      label: `Station structurante PMR à ${closestHeavy.distanceMeters}m`,
      points: 1.8,
      impact: "positive",
      detail: "Les stations modernes de tramway/métro offrent un accès de plain-pied garanti.",
    });
  } else {
    pmrScore -= 1.0;
    pmrNegative.push({
      label: "Pas de transport accessible de plain-pied à proximité",
      points: -1.0,
      impact: "negative",
      detail: "Mobilité réduite tributaire de voiries parfois inégales.",
    });
  }

  if (pharmacy && pharmacy.distanceMeters <= 350) {
    pmrScore += 1.2;
    pmrPositive.push({
      label: `Pharmacie accessible en courte distance (${pharmacy.distanceMeters}m)`,
      points: 1.2,
      impact: "positive",
      detail: "Soins accessibles sans franchissement de longs trajets.",
    });
  }

  if (closestBus && closestBus.distanceMeters <= 250) {
    pmrScore += 0.8;
    pmrPositive.push({
      label: `Arrêt de bus proche (${closestBus.distanceMeters}m)`,
      points: 0.8,
      impact: "positive",
      detail: "Réduction des distances de marche à pied.",
    });
  }

  const finalPmrScore = Math.max(
    2,
    Math.min(10, Math.round(pmrScore * 10) / 10),
  );

  return [
    {
      category: "transports",
      label: "Transports en commun",
      score: finalTransportScore,
      maxScore: 10,
      baseScore: baseTransport,
      iconName: "Bus",
      highlightText: closestHeavy
        ? `${closestHeavy.name || closestHeavy.subType} (${closestHeavy.distanceMeters}m)`
        : closestBus
          ? `${closestBus.name || "Bus"} (${closestBus.distanceMeters}m)`
          : "Aucun transport à proximité",
      poisFoundCount: transports.length,
      positiveFactors: transportPositive,
      negativeFactors: transportNegative,
      details: [
        ...transportPositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...transportNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Score calculé sur l'accessibilité piétonne (distance au mètre près) d'un transport lourd en site propre (tram/métro/gare SNCF), le maillage des lignes de bus et la présence de stations vélo.",
      sources: [
        {
          name: "SNCF Gares & Connexions",
          description: "Référentiel officiel national des gares voyageurs",
          url: "https://ressources.data.sncf.com",
          lastUpdated: "2026",
        },
        {
          name: "OpenStreetMap",
          description: "Arrêts de bus, tramway, métro et stations vélo",
          url: "https://www.openstreetmap.org",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "commerces",
      label: "Commerces et services",
      score: finalCommerceScore,
      maxScore: 10,
      baseScore: baseCommerce,
      iconName: "ShoppingBag",
      highlightText:
        commerces.length > 0
          ? `${commerces.length} commerce${commerces.length > 1 ? "s" : ""} de proximité`
          : "Aucun commerce à proximité",
      poisFoundCount: commerces.length,
      positiveFactors: commercePositive,
      negativeFactors: commerceNegative,
      details: [
        ...commercePositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...commerceNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Score mesurant la capacité à réaliser ses courses du quotidien à pied : boulangeries, supérettes, supermarchés, boucheries et primeurs dans un rayon piétonnier de 800m.",
      sources: [
        {
          name: "OpenStreetMap",
          description: "Recensement cartographique des commerces de proximité",
          url: "https://www.openstreetmap.org",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "ecoles",
      label: "Écoles et petite enfance",
      score: finalEcoleScore,
      maxScore: 10,
      baseScore: baseEcole,
      iconName: "GraduationCap",
      highlightText: closestSchool
        ? `${closestSchool.name || closestSchool.subType} (${closestSchool.distanceMeters}m)`
        : "Aucun établissement à proximité",
      poisFoundCount: ecoles.length,
      positiveFactors: ecolePositive,
      negativeFactors: ecoleNegative,
      details: [
        ...ecolePositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...ecoleNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Évalué à partir du fichier national officiel des établissements scolaires ouverts du Ministère de l'Éducation Nationale complété par OpenStreetMap pour la petite enfance.",
      sources: [
        {
          name: "Ministère de l’Éducation nationale",
          description: "Base géolocalisée officielle des écoles ouvertes (Premier et Second degré)",
          url: "https://data.education.gouv.fr",
          lastUpdated: "2026",
        },
        {
          name: "OpenStreetMap",
          description: "Crèches et structures petite enfance",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "sante",
      label: "Services de santé",
      score: finalSanteScore,
      maxScore: 10,
      baseScore: baseSante,
      iconName: "HeartPulse",
      highlightText: pharmacy
        ? `${pharmacy.name || "Pharmacie"} (${pharmacy.distanceMeters}m)`
        : sante.length > 0
          ? `${sante[0].name || sante[0].subType} (${sante[0].distanceMeters}m)`
          : "Aucun service de santé à proximité",
      poisFoundCount: sante.length,
      positiveFactors: santePositive,
      negativeFactors: santeNegative,
      details: [
        ...santePositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...santeNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Score calculé sur la disponibilité et la distance pédestre des officines pharmaceutiques, cabinets de médecins généralistes, dentistes et hôpitaux.",
      sources: [
        {
          name: "OpenStreetMap Santé",
          description: "Pharmacies, cabinets médicaux, cliniques et hôpitaux",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "espaces_verts",
      label: "Espaces verts & parcs",
      score: finalGreenScore,
      maxScore: 10,
      baseScore: baseGreen,
      iconName: "TreePine",
      highlightText: closestPark
        ? `${closestPark.name || closestPark.subType} (${closestPark.distanceMeters}m)`
        : "Aucun espace vert à proximité",
      poisFoundCount: espacesVerts.length,
      positiveFactors: greenPositive,
      negativeFactors: greenNegative,
      details: [
        ...greenPositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...greenNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Score mesurant l'accessibilité à des zones arborées, parcs publics, squares et aires de jeux extérieures dans un rayon de marche direct.",
      sources: [
        {
          name: "OpenStreetMap Espaces Verts",
          description: "Parcs, jardins publics et équipements de loisirs",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "stationnement",
      label: "Parkings et stationnement",
      score: finalParkScore,
      maxScore: 10,
      baseScore: basePark,
      iconName: "Car",
      highlightText: closestParking
        ? `${closestParking.name || "Parking"} (${closestParking.distanceMeters}m)`
        : "Stationnement en voirie",
      poisFoundCount: stationnement.length,
      positiveFactors: parkPositive,
      negativeFactors: parkNegative,
      details: [
        ...parkPositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...parkNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Score fondé sur la présence, la distance et le nombre d'aménagements de stationnement publics ou d'ouvrages dédiés dans la zone.",
      sources: [
        {
          name: "OpenStreetMap",
          description: "Parkings publics et aires de stationnement",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "tranquillite",
      label: "Tranquillité & Environnement",
      score: finalTranquilityScore,
      maxScore: 10,
      baseScore: baseTranquility,
      iconName: "Volume2",
      highlightText:
        airQuality
          ? `${airQuality.label} • ${finalTranquilityScore >= 7.5 ? "Calme" : "Modéré"}`
          : finalTranquilityScore >= 7.5
            ? "Environnement calme estimé"
            : "Ambiance modérée",
      poisFoundCount: 0,
      positiveFactors: tranquilityPositive,
      negativeFactors: tranquilityNegative,
      details: [
        ...tranquilityPositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...tranquilityNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Indicateur combiné : exposition sonore estimée selon la proximité des axes de transports lourds et densité commerciale, croisée aux mesures réelles de qualité de l'air Open-Meteo.",
      sources: [
        {
          name: "Open-Meteo Air Quality",
          description: "Indice européen de la qualité de l'air (AQI, PM2.5, PM10, NO2)",
          url: "https://open-meteo.com/en/docs/air-quality-api",
          lastUpdated: "Temps réel",
        },
        {
          name: "Modèle Citynside",
          description: "Analyse acoustique algorithmique de proximité",
          lastUpdated: "2026",
        },
      ],
    },
    {
      category: "loisirs",
      label: "Sports, culture & loisirs",
      score: finalLeisureScore,
      maxScore: 10,
      baseScore: 5.5,
      iconName: "Sparkles",
      highlightText: closestLeisure ? `${closestLeisure.name || closestLeisure.subType} (${closestLeisure.distanceMeters}m)` : "Aucun équipement recensé dans ce secteur",
      poisFoundCount: loisirs.length,
      positiveFactors: leisurePositive,
      negativeFactors: [],
      details: leisurePositive.map((factor) => `+${factor.points.toFixed(1)} pt : ${factor.label}`),
      calculationExplanation: "Indicateur de proximité des équipements sportifs, culturels et socioculturels recensés dans OpenStreetMap. En l'absence de résultats, la note reste neutre car la couverture cartographique varie selon les communes.",
      sources: [{ name: "OpenStreetMap", description: "Équipements sportifs, bibliothèques, cinémas, théâtres, musées et centres culturels", url: "https://www.openstreetmap.org/", lastUpdated: "Données collaboratives" }],
    },
    {
      category: "pmr",
      label: "Accessibilité PMR & Trottoirs",
      score: finalPmrScore,
      maxScore: 10,
      baseScore: basePmr,
      iconName: "Accessibility",
      highlightText:
        finalPmrScore >= 7.0
          ? "Bonne accessibilité de plain-pied"
          : "Accessibilité moyenne estimée",
      poisFoundCount: 0,
      positiveFactors: pmrPositive,
      negativeFactors: pmrNegative,
      details: [
        ...pmrPositive.map((f) => `+${f.points.toFixed(1)} pt : ${f.label}`),
        ...pmrNegative.map((f) => `${f.points.toFixed(1)} pt : ${f.label}`),
      ],
      calculationExplanation:
        "Estimation de la praticabilité piétonne et personnes à mobilité réduite basée sur l'existence de quais de transport adaptés et de services essentiels à courte distance.",
      sources: [
        {
          name: "OpenStreetMap & RATP/SNCF",
          description: "Aménagements d'accessibilité des stations et trottoirs",
          lastUpdated: "2026",
        },
      ],
    },
  ];
}
