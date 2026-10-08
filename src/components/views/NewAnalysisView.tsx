import { ArrowRight, FileText, Star, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchAirQuality } from "../../services/airQualityApi";
import type { AirQualityData } from "../../services/airQualityApi";
import { reverseGeocode } from "../../services/banApi";
import {
  fetchEducationPOIsInRadius,
  mergeEducationPOIs,
} from "../../services/educationApi";
import { ANALYSIS_RADIUS_METERS, EXTENDED_TRANSIT_RADIUS_METERS, fetchPOIsInRadius, calculateDistanceMeters } from "../../services/osmApi";
import { calculateCategoryScores } from "../../services/scoringEngine";
import { fetchSNCFStationsInRadius } from "../../services/sncfApi";
import { fetchNationalTransitStops } from "../../services/gtfsStopsApi";
import { fetchIGNParkingPOIs } from "../../services/ignParkingApi";
import type { AddressResult, NeighborhoodAnalysis, POI, RiskAssessment } from "../../types";
import { fetchRiskAssessment } from "../../services/georisquesApi";
import { InteractiveMap } from "../map/InteractiveMap";
import { ScoresList } from "../scores/ScoresList";
import { RiskNuisancePanel } from "../scores/RiskNuisancePanel";
import { AddressSearchBar } from "../search/AddressSearchBar";
import type { DefaultCategoryFilter, DefaultScoreProfile, DistanceUnit } from "../../services/userPreferences";

const demoAnalysisRequests = new Map<string, Promise<{ pois: POI[]; categories: NeighborhoodAnalysis["categories"]; avg: number; airQuality: AirQualityData | null }>>();

interface NewAnalysisViewProps {
  isDemo: boolean;
  mapControlsHiddenByDefault: boolean;
  mapZoom: number;
  reduceMotion: boolean;
  defaultScoreProfile: DefaultScoreProfile;
  defaultCategoryFilter: DefaultCategoryFilter;
  distanceUnit: DistanceUnit;
  currentAnalysis: NeighborhoodAnalysis | null;
  onUpdateAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onUpdateRiskAssessment: (analysisId: string, assessment: RiskAssessment, airQuality?: import("../../services/airQualityApi").AirQualityData | null, analysisSnapshot?: NeighborhoodAnalysis) => void;
  onToggleFavorite: (id: string) => void;
  onGoToReport: () => void;
  onGoToImpressions: () => void;
}

export const NewAnalysisView: React.FC<NewAnalysisViewProps> = ({
  isDemo,
  mapControlsHiddenByDefault,
  mapZoom,
  reduceMotion,
  defaultScoreProfile,
  defaultCategoryFilter,
  distanceUnit,
  currentAnalysis,
  onUpdateAnalysis,
  onUpdateRiskAssessment,
  onToggleFavorite,
  onGoToReport,
  onGoToImpressions,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(defaultCategoryFilter);
  const [poiToLocate, setPoiToLocate] = useState<POI | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAirQuality, setLastAirQuality] = useState<AirQualityData | null>(null);
  const latestSearchId = useRef(0);
  const activeOsmRequest = useRef<AbortController | null>(null);

  // Fonction résiliente et accélérée d'agrégation multi-API
  const runParallelAnalysis = async (lat: number, lon: number, osmSignal?: AbortSignal) => {
    const [osmRes, eduRes, sncfRes, gtfsRes, airRes, ignParkingRes] = await Promise.allSettled([
      fetchPOIsInRadius(lat, lon, ANALYSIS_RADIUS_METERS, osmSignal),
      fetchEducationPOIsInRadius(lat, lon, ANALYSIS_RADIUS_METERS),
      fetchSNCFStationsInRadius(lat, lon, EXTENDED_TRANSIT_RADIUS_METERS),
      fetchNationalTransitStops(lat, lon, EXTENDED_TRANSIT_RADIUS_METERS),
      fetchAirQuality(lat, lon),
      fetchIGNParkingPOIs(lat, lon, ANALYSIS_RADIUS_METERS),
    ]);

    const osmPOIs: POI[] = osmRes.status === "fulfilled" ? osmRes.value : [];
    const eduPOIs: POI[] = eduRes.status === "fulfilled" ? eduRes.value : [];
    const sncfPOIs: POI[] = sncfRes.status === "fulfilled" ? sncfRes.value : [];
    const gtfsPOIs: POI[] = gtfsRes.status === "fulfilled" ? gtfsRes.value : [];
    const airQuality = airRes.status === "fulfilled" ? airRes.value : null;
    const ignParkingPOIs: POI[] = ignParkingRes.status === "fulfilled" ? ignParkingRes.value : [];

    // Fusionner et dédupliquer les POIs officiels SNCF + Éducation + OSM
    const mergedSchools = mergeEducationPOIs(osmPOIs, eduPOIs);
    // Les gares ferroviaires viennent exclusivement du référentiel officiel
    // SNCF. On retire les faux ferroviaires issus de Mapbox/GTFS (parkings,
    // arrêts routiers portant « gare » dans leur nom).
    const nonRailPOIs = [...mergedSchools, ...gtfsPOIs].filter((p) =>
      !(p.category === "transports" && /gare ferroviaire|arrêt ferroviaire/i.test(p.subType))
    );
    const allPOIs = [...nonRailPOIs, ...ignParkingPOIs];

    // Ajouter les gares officielles SNCF
    for (const sncf of sncfPOIs) {
      allPOIs.push(sncf);
    }

    // Déduplication finale de sécurité sur l'ensemble des POIs combinés (OSM + Éducation + SNCF)
    const finalPOIs: POI[] = [];
    const similarStopName = (a: string, b: string) => {
      const compact = (value: string) => value.split(/\s+/)
        .filter((token) => token && !/^(le|la|les|de|du|des)$/.test(token))
        .map((token) => token.length > 4 && !token.endsWith("bus") ? token.replace(/s$/, "") : token)
        .join("");
      const left = compact(a);
      const right = compact(b);
      if (!left || !right) return false;
      if (left === right) return true;
      if (left.length < 6 || right.length < 6) return false;
      if (left.startsWith(right) || right.startsWith(left)) return true;
      const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
      for (let i = 1; i <= left.length; i++) {
        const current = [i];
        for (let j = 1; j <= right.length; j++) {
          current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
        }
        for (let j = 0; j < current.length; j++) previous[j] = current[j];
      }
      return previous[right.length] <= 2;
    };
    for (const p of allPOIs) {
      const isDup = finalPOIs.some((existing) => {
        if (existing.category !== p.category) return false;
        const d = calculateDistanceMeters(existing.lat, existing.lon, p.lat, p.lon);
        if (p.category === "ecoles") {
          // Une primaire, une maternelle et une crèche peuvent partager la
          // même adresse : on ne fusionne que le même sous-type, ou le même
          // établissement exactement nommé.
          const sameSubtype = existing.subType.trim().toLowerCase() === p.subType.trim().toLowerCase();
          const sameName = existing.name && p.name && existing.name.trim().toLowerCase() === p.name.trim().toLowerCase();
          return sameSubtype && ((d <= 45) || (sameName && d <= 90));
        }
        // Deux arrêts proches ne sont fusionnés que si leur nom est
        // strictement identique : deux arrêts différents peuvent partager le
        // même type et se trouver sur le même quai ou dans la même rue.
        if (p.category === "transports") {
          const pIsOfficialStation = /gare ferroviaire sncf/i.test(p.subType);
          const existingIsOfficialStation = /gare ferroviaire sncf/i.test(existing.subType);
          // Un arrêt générique (p. ex. « Grenoble, gares ») ne doit jamais
          // absorber la fiche officielle de la gare située au même endroit.
          if (pIsOfficialStation !== existingIsOfficialStation) return false;
          const sameRail = /gare ferroviaire|arrêt ferroviaire/i.test(existing.subType) &&
            /gare ferroviaire|arrêt ferroviaire/i.test(p.subType);
          if (sameRail && d <= 120) return true;
          // On nettoie le nom pour enlever le "Ville, " ajouté par GTFS et uniformiser tous les types de tirets (tiret cadratin, demi-cadratin, etc.)
          const cleanName = (n: string) => n.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/^[^,]+,\s*/, "").replace(/[-_–—]+/g, " ")
            .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
          const nameA = existing.name ? cleanName(existing.name) : "";
          const nameB = p.name ? cleanName(p.name) : "";
          const tokensA = new Set(nameA.split(" ").filter((t) => t.length >= 3));
          const tokensB = new Set(nameB.split(" ").filter((t) => t.length >= 3));
          const commonTokens = [...tokensA].filter((t) => tokensB.has(t));
          const sameName = Boolean(nameA && nameB) &&
            (nameA === nameB || (commonTokens.length >= 2 &&
              commonTokens.length >= Math.min(tokensA.size, tokensB.size)));
          const similarName = Boolean(nameA && nameB) && similarStopName(nameA, nameB);
            
          const genericVsBus =
            (existing.subType === "Arrêt de transport" && p.subType === "Arrêt de bus") ||
            (p.subType === "Arrêt de transport" && existing.subType === "Arrêt de bus");
          // Deux sources peuvent donner des noms différents au même quai.
          // À moins de 10 m, le même sous-type suffit pour fusionner ; au-delà,
          // on conserve l'exigence d'un nom équivalent. Ne jamais fusionner
          // bus et tram.
          // Conflit de sources sur le même arrêt : si le nom est identique et
          // les coordonnées sont très proches, on fusionne avant de choisir
          // l'étiquette la plus conservative (bus plutôt que tram/métro).
          if ((sameName || similarName) && d <= 30) return true;
          if (existing.subType === p.subType && d <= 10) return true;
          if ((sameName || genericVsBus) && (existing.subType === p.subType || genericVsBus) && d <= 100) return true;
          return false;
        }
        // Pour les autres catégories : même sous-type à moins de 25m
        return existing.subType === p.subType && d <= 25;
      });

      if (isDup && p.category === "transports") {
        // La fiche SNCF est la source de référence : elle doit remplacer un
        // éventuel point GTFS générique au même endroit (sinon la gare peut
        // rester étiquetée comme simple arrêt de transport).
        if (/gare ferroviaire sncf/i.test(p.subType)) {
          const sncfIndex = finalPOIs.findIndex((existing) =>
            existing.category === "transports" &&
            calculateDistanceMeters(existing.lat, existing.lon, p.lat, p.lon) <= 120 &&
            /gare ferroviaire|arrêt ferroviaire|arrêt de transport/i.test(existing.subType),
          );
          if (sncfIndex >= 0) finalPOIs[sncfIndex] = p;
        }
        const existingIndex = finalPOIs.findIndex((existing) =>
          existing.category === "transports" &&
          existing.name && p.name &&
          similarStopName(existing.name, p.name) &&
          calculateDistanceMeters(existing.lat, existing.lon, p.lat, p.lon) <= 30
        );
        if (existingIndex >= 0 && /arrêt de bus/i.test(p.subType) && /tramway|métro/i.test(finalPOIs[existingIndex].subType)) {
          finalPOIs[existingIndex] = p;
        }
      }
      if (isDup && p.category === "ecoles") {
        const existingIndex = finalPOIs.findIndex((existing) =>
          existing.category === "ecoles" && calculateDistanceMeters(existing.lat, existing.lon, p.lat, p.lon) <= 45
        );
        const specificity = (school: POI) => /maternelle|crèche|creche|collège|lycée|primaire|élémentaire|superieure|supérieure/i.test(`${school.subType} ${school.name}`) ? 2 : 1;
        if (existingIndex >= 0 && specificity(p) > specificity(finalPOIs[existingIndex])) {
          finalPOIs[existingIndex] = p;
        }
      }
      if (!isDup) {
        finalPOIs.push(p);
      }
    }

    finalPOIs.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const categories = calculateCategoryScores(finalPOIs, airQuality, { lat, lon });

    const sum = categories.reduce((acc, curr) => acc + curr.score, 0);
    const avg = Math.round((sum / categories.length) * 10) / 10;

    return { pois: finalPOIs, categories, avg, airQuality };
  };

  // Enrich each fixed demo example with the same public datasets used for a
  // real analysis. The address stays fixed and App keeps this update in memory.
  useEffect(() => {
    if (!isDemo || !currentAnalysis) return;
    let cancelled = false;
    let request = demoAnalysisRequests.get(currentAnalysis.id);
    if (!request) {
      request = runParallelAnalysis(currentAnalysis.lat, currentAnalysis.lon);
      demoAnalysisRequests.set(currentAnalysis.id, request);
    }
    setIsLoading(true);
    request.then(({ pois, categories, avg, airQuality }) => {
      if (cancelled || pois.length === 0) return;
      onUpdateAnalysis({ ...currentAnalysis, pois, categories, globalScore: avg, airQuality });
    }).catch((error) => {
      console.warn("Enrichissement des données de démonstration indisponible :", error);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [isDemo, currentAnalysis?.id]);

  // When user selects an address in autocomplete or hits Analyser
  const handleSelectAddress = async (addr: AddressResult) => {
    if (isDemo) return;
    setSelectedCategory(defaultCategoryFilter);
    setPoiToLocate(null);
    const searchId = ++latestSearchId.current;
    activeOsmRequest.current?.abort();
    const osmController = new AbortController();
    activeOsmRequest.current = osmController;
    setIsLoading(true);
    try {
      const { pois, categories, avg, airQuality } = await runParallelAnalysis(
        addr.lat,
        addr.lon,
        osmController.signal,
      );
      if (searchId !== latestSearchId.current) return;

      const updated: NeighborhoodAnalysis = {
        id: `analysis_${Date.now()}`,
        createdAt: new Date().toISOString(),
        address: addr.name || addr.label,
        city: addr.city,
        postcode: addr.postcode,
        neighborhoodName: "", // sera défini par l'utilisateur à l'enregistrement
        lat: addr.lat,
        lon: addr.lon,
        globalScore: avg,
        categories,
        pois,
        airQuality,
        impressions: currentAnalysis?.impressions,
        riskAssessment: { status: "loading", findings: [], reportUrl: `https://georisques.gouv.fr/api/v1/rapport_pdf?latlon=${encodeURIComponent(`${addr.lon},${addr.lat}`)}` },
      };

      setLastAirQuality(airQuality);
      onUpdateAnalysis(updated);
      void fetchRiskAssessment(addr.lat, addr.lon).then((assessment) => onUpdateRiskAssessment(updated.id, assessment, updated.airQuality, updated));
    } catch (e) {
      console.error("Erreur analyse:", e);
    } finally {
      if (searchId === latestSearchId.current) setIsLoading(false);
    }
  };

  // When user clicks anywhere on map
  const handleMapLocationSelect = async (lat: number, lon: number) => {
    if (isDemo) return;
    const searchId = ++latestSearchId.current;
    activeOsmRequest.current?.abort();
    const osmController = new AbortController();
    activeOsmRequest.current = osmController;
    setSelectedCategory(defaultCategoryFilter);
    setPoiToLocate(null);
    setIsLoading(true);
    try {
      const [rev, analysisData] = await Promise.all([
        reverseGeocode(lat, lon),
        runParallelAnalysis(lat, lon, osmController.signal),
      ]);
      if (searchId !== latestSearchId.current) return;

      const { pois, categories, avg, airQuality } = analysisData;

      const updated: NeighborhoodAnalysis = {
        id: `analysis_${Date.now()}`,
        createdAt: new Date().toISOString(),
        address: rev ? rev.name : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: rev ? rev.city : (currentAnalysis?.city ?? ""),
        postcode: rev ? rev.postcode : (currentAnalysis?.postcode ?? ""),
        neighborhoodName: "", // sera défini par l'utilisateur à l'enregistrement
        lat,
        lon,
        globalScore: avg,
        categories,
        pois,
        airQuality,
        impressions: currentAnalysis?.impressions,
        riskAssessment: { status: "loading", findings: [], reportUrl: `https://georisques.gouv.fr/api/v1/rapport_pdf?latlon=${encodeURIComponent(`${lon},${lat}`)}` },
      };

      setLastAirQuality(airQuality);
      onUpdateAnalysis(updated);
      void fetchRiskAssessment(lat, lon).then((assessment) => onUpdateRiskAssessment(updated.id, assessment, updated.airQuality, updated));
    } catch (e) {
      console.error("Erreur lors de la sélection de position:", e);
    } finally {
      if (searchId === latestSearchId.current) setIsLoading(false);
    }
  };

  const handleLocatePoi = (poi: POI) => {
    setSelectedCategory(poi.category);
    setPoiToLocate({ ...poi });
    window.requestAnimationFrame(() => {
      document.querySelector(".analysis-map-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleSelectCategory = (category: string | null) => {
    setSelectedCategory(category);
    setPoiToLocate(null);
  };

  return (
    <div className="new-analysis-container">
      {/* Header section matching Mockup 2 */}
      <div className="analysis-page-header">
        <h1 className="header-main-title">{isDemo ? "Exemple de quartier" : "Nouvelle analyse"}</h1>
        <p className="header-main-subtitle">
          {isDemo ? "Explorez les données de démonstration de ce quartier." : "Recherchez et définissez une nouvelle zone à analyser"}
        </p>
      </div>

      {/* Dark Search Bar matching Mockup 2 */}
      <div className="search-bar-row">
        <AddressSearchBar
          initialValue={
            currentAnalysis
              ? `${currentAnalysis.address}, ${currentAnalysis.city}`
              : ""
          }
          onSelectAddress={handleSelectAddress}
          autoFocus={!isDemo && !currentAnalysis}
          onTriggerAnalysis={() => {}}
          isLoading={isLoading}
          readOnly={isDemo}
        />
      </div>

      {currentAnalysis ? (
        <div className="analysis-results-content">
          <section className="analysis-map-section">
            <div className="map-card-wrapper cyt-card">
              <InteractiveMap
                lat={currentAnalysis.lat}
                lon={currentAnalysis.lon}
                neighborhoodName={currentAnalysis.address}
                pois={currentAnalysis.pois}
                selectedCategory={selectedCategory}
                focusPoi={poiToLocate}
                controlsVisibleByDefault={!mapControlsHiddenByDefault}
                zoom={mapZoom}
                reduceMotion={reduceMotion}
                distanceUnit={distanceUnit}
                onSelectCategory={handleSelectCategory}
                onSelectLocation={isDemo ? undefined : handleMapLocationSelect}
                height="420px"
              />
            </div>
          </section>

          <section className="analysis-scores-section">
            <ScoresList
              categories={currentAnalysis.categories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              addressName={`${currentAnalysis.address}, ${currentAnalysis.city}`}
              globalScore={currentAnalysis.globalScore}
              pois={currentAnalysis.pois}
              onLocatePoi={handleLocatePoi}
              defaultScoreProfile={defaultScoreProfile}
              distanceUnit={distanceUnit}
            />
          </section>

          <section className="analysis-risk-section">
            <RiskNuisancePanel
              assessment={currentAnalysis.riskAssessment}
              tranquility={currentAnalysis.categories.find((category) => category.category === "tranquillite")}
              airQuality={currentAnalysis.airQuality ?? lastAirQuality}
            />
          </section>
        </div>
      ) : (
        <div className="analysis-empty-state" role="status">
          <span className="empty-search-icon">
            <Search size={24} />
          </span>
          <div>
            <h2>Commencez par une adresse</h2>
            <p>
              La carte et les scores s'affichent après le lancement de
              l'analyse.
            </p>
          </div>
        </div>
      )}

      {/* Bottom CTA Buttons */}
      {currentAnalysis && (
        <div className="analysis-bottom-cta-wrap">
          <button className="btn-view-report" onClick={onGoToReport}>
            <FileText size={18} />
            <span>Voir le rapport</span>
          </button>
          {!isDemo && <button
            className={`btn-save-analysis ${currentAnalysis.isFavorite ? 'is-favorite' : ''}`}
            onClick={() => onToggleFavorite(currentAnalysis.id)}
          >
            <Star size={18} fill={currentAnalysis.isFavorite ? 'currentColor' : 'none'} />
            <span>{currentAnalysis.isFavorite ? 'Retirer des favoris' : 'Mettre en favori'}</span>
          </button>}
          {!isDemo && <button
            className="btn-primary cta-impressions-btn"
            onClick={onGoToImpressions}
          >
            <span>Renseigner mes impressions</span>
            <ArrowRight size={20} strokeWidth={2.4} />
          </button>}
        </div>
      )}

      <style>{`
        /* NewAnalysisView — Charte Citynside V1 */
        .new-analysis-container {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding: 8px 12px 60px;
        }

        .analysis-page-header {
          text-align: center;
          margin-top: 8px;
        }

        .header-main-title {
          font-size: 2.3rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.025em;
        }

        .header-main-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.97rem;
          color: var(--color-text-muted);
          margin-top: 6px;
          font-weight: 400;
        }

        .search-bar-row {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .analysis-results-content {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .analysis-map-section,
        .analysis-scores-section {
          display: flex;
          flex-direction: column;
        }

        .map-card-wrapper {
          border-radius: 20px;
          overflow: hidden;
          background: #ffffff;
          padding: 7px;
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-card);
        }

        .map-caption-bar {
          padding: 8px 12px 4px;
          text-align: center;
        }

        .map-caption-text {
          font-family: var(--font-family-body);
          font-size: 0.72rem;
          color: var(--color-text-subtle);
          font-weight: 500;
        }

        .analysis-empty-state {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 36px;
          text-align: left;
          background: rgba(255, 255, 255, 0.55);
          border: 1px dashed var(--color-border);
          border-radius: 20px;
          color: var(--color-text-muted);
        }

        .empty-search-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--color-green-light);
          color: var(--color-primary);
        }

        .analysis-empty-state h2 {
          margin: 0 0 5px;
          font-size: 1.05rem;
          color: var(--color-primary);
        }

        .analysis-empty-state p {
          margin: 0;
          font-size: 0.88rem;
        }

        @media (max-width: 620px) {
          .new-analysis-container { gap: 21px; padding: 4px 0 28px; }
          .analysis-page-header { margin-top: 2px; }
          .header-main-title { font-size: 1.75rem; line-height: 1.15; }
          .header-main-subtitle { font-size: .85rem; line-height: 1.45; }
          .map-card-wrapper { padding: 4px; border-radius: 15px; }
          .analysis-bottom-cta-wrap { flex-direction: column; align-items: stretch; gap: 9px; }
          .analysis-bottom-cta-wrap button { width: 100%; justify-content: center; }
          .analysis-empty-state {
            flex-direction: column;
            text-align: center;
          }
        }

        /* CTA en bas */
        .analysis-bottom-cta-wrap {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .btn-save-analysis {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--color-green);
          background: #ffffff;
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-save-analysis:hover {
          background: var(--color-green-light);
          border-color: var(--color-green-hover);
          transform: translateY(-2px);
        }

        .btn-view-report {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--color-border);
          background: #ffffff;
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .btn-view-report:hover {
          background: var(--color-green-light);
          border-color: var(--color-green);
          transform: translateY(-2px);
        }

        .cta-impressions-btn {
          flex: 1;
          max-width: 480px;
          background-color: var(--color-yellow);
          color: var(--color-text-on-yellow);
          font-weight: 700;
          font-size: 1.05rem;
          padding: 16px 32px;
          border-radius: var(--radius-full);
          box-shadow: var(--shadow-cta-yellow);
          transition: var(--transition-smooth);
        }

        .cta-impressions-btn:hover {
          background-color: var(--color-yellow-hover);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(241, 232, 80, 0.52);
        }

        .cta-impressions-btn:active {
          transform: translateY(0);
        }

        /* Save Modal */
        .save-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }

        .save-modal {
          background: #ffffff;
          border-radius: 20px;
          padding: 32px;
          max-width: 420px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          animation: slideUp 0.2s ease;
          position: relative;
        }

        .save-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          color: var(--color-text-subtle);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.15s ease;
        }
        .save-modal-close:hover {
          color: var(--color-text-main);
        }

        .save-modal-icon {
          color: var(--color-primary);
          margin-bottom: 12px;
        }

        .save-modal h3 {
          font-family: var(--font-family-heading);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-text-main);
          margin-bottom: 6px;
        }

        .save-modal p {
          font-family: var(--font-family-body);
          font-size: 0.85rem;
          color: var(--color-text-muted);
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .save-modal-field {
          text-align: left;
          margin-bottom: 14px;
        }

        .save-modal-field label {
          display: block;
          font-family: var(--font-family-body);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .save-modal-field input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid var(--color-border);
          border-radius: 10px;
          font-family: var(--font-family-body);
          font-size: 0.92rem;
          color: var(--color-text-main);
          transition: border-color 0.15s ease;
          box-sizing: border-box;
        }

        .save-modal-field input:focus {
          outline: none;
          border-color: var(--color-green);
        }

        .save-modal-info {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-subtle);
          margin-bottom: 22px;
          padding: 8px 12px;
          background: var(--color-green-subtle);
          border-radius: 8px;
        }

        .save-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-cancel {
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          font-weight: 600;
          padding: 10px 24px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: #ffffff;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-cancel:hover {
          background: var(--color-green-subtle);
        }

        .btn-confirm-save {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          font-weight: 700;
          padding: 10px 24px;
          border-radius: var(--radius-full);
          border: none;
          background: var(--color-primary);
          color: #ffffff;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-confirm-save:hover {
          background: var(--color-primary-light);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
