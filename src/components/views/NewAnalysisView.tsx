import { ArrowRight, FileText, Star, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchAirQuality } from "../../services/airQualityApi";
import { reverseGeocode } from "../../services/banApi";
import {
  fetchEducationPOIsInRadius,
  mergeEducationPOIs,
} from "../../services/educationApi";
import { ANALYSIS_RADIUS_METERS, EXTENDED_TRANSIT_RADIUS_METERS, fetchPOIsInRadius, calculateDistanceMeters } from "../../services/osmApi";
import { calculateCategoryScores } from "../../services/scoringEngine";
import { fetchSNCFStationsInRadius } from "../../services/sncfApi";
import type { AddressResult, NeighborhoodAnalysis, POI, RiskAssessment } from "../../types";
import { fetchRiskAssessment } from "../../services/georisquesApi";
import { InteractiveMap } from "../map/InteractiveMap";
import { ScoresList } from "../scores/ScoresList";
import { RiskNuisancePanel } from "../scores/RiskNuisancePanel";
import { AddressSearchBar } from "../search/AddressSearchBar";

const demoAnalysisRequests = new Map<string, Promise<{ pois: POI[]; categories: NeighborhoodAnalysis["categories"]; avg: number }>>();

interface NewAnalysisViewProps {
  isDemo: boolean;
  currentAnalysis: NeighborhoodAnalysis | null;
  onUpdateAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onUpdateRiskAssessment: (analysisId: string, assessment: RiskAssessment) => void;
  onToggleFavorite: (id: string) => void;
  onGoToReport: () => void;
  onGoToImpressions: () => void;
}

export const NewAnalysisView: React.FC<NewAnalysisViewProps> = ({
  isDemo,
  currentAnalysis,
  onUpdateAnalysis,
  onUpdateRiskAssessment,
  onToggleFavorite,
  onGoToReport,
  onGoToImpressions,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const latestSearchId = useRef(0);

  // Fonction résiliente et accélérée d'agrégation multi-API
  const runParallelAnalysis = async (lat: number, lon: number) => {
    const [osmRes, eduRes, sncfRes, airRes] = await Promise.allSettled([
      fetchPOIsInRadius(lat, lon, ANALYSIS_RADIUS_METERS),
      fetchEducationPOIsInRadius(lat, lon, ANALYSIS_RADIUS_METERS),
      fetchSNCFStationsInRadius(lat, lon, EXTENDED_TRANSIT_RADIUS_METERS),
      fetchAirQuality(lat, lon),
    ]);

    const osmPOIs: POI[] = osmRes.status === "fulfilled" ? osmRes.value : [];
    const eduPOIs: POI[] = eduRes.status === "fulfilled" ? eduRes.value : [];
    const sncfPOIs: POI[] = sncfRes.status === "fulfilled" ? sncfRes.value : [];
    const airQuality = airRes.status === "fulfilled" ? airRes.value : null;

    // Fusionner et dédupliquer les POIs officiels SNCF + Éducation + OSM
    const mergedSchools = mergeEducationPOIs(osmPOIs, eduPOIs);
    const allPOIs = [...mergedSchools];

    // Ajouter les gares SNCF si pas déjà présentes à < 50m
    for (const sncf of sncfPOIs) {
      const alreadyHasStation = allPOIs.some(
        (p) =>
          p.category === "transports" &&
          Math.abs(p.lat - sncf.lat) < 0.0006 &&
          Math.abs(p.lon - sncf.lon) < 0.0006,
      );
      if (!alreadyHasStation) {
        allPOIs.push(sncf);
      }
    }

    // Déduplication finale de sécurité sur l'ensemble des POIs combinés (OSM + Éducation + SNCF)
    const finalPOIs: POI[] = [];
    for (const p of allPOIs) {
      const isDup = finalPOIs.some((existing) => {
        if (existing.category !== p.category) return false;
        const d = calculateDistanceMeters(existing.lat, existing.lon, p.lat, p.lon);
        if (p.category === "ecoles") {
          // Deux écoles à moins de 45m sont le même site
          if (d <= 45) return true;
          // Même nom patronymique à moins de 90m
          if (
            existing.name &&
            p.name &&
            existing.name.toLowerCase().trim() === p.name.toLowerCase().trim() &&
            d <= 90
          ) {
            return true;
          }
          return false;
        }
        // Pour les autres catégories : même sous-type à moins de 25m
        return existing.subType === p.subType && d <= 25;
      });

      if (!isDup) {
        finalPOIs.push(p);
      }
    }

    finalPOIs.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const categories = calculateCategoryScores(finalPOIs, airQuality);

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
    request.then(({ pois, categories, avg }) => {
      if (cancelled || pois.length === 0) return;
      onUpdateAnalysis({ ...currentAnalysis, pois, categories, globalScore: avg });
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
    const searchId = ++latestSearchId.current;
    setIsLoading(true);
    try {
      const { pois, categories, avg } = await runParallelAnalysis(
        addr.lat,
        addr.lon,
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
        impressions: currentAnalysis?.impressions,
        riskAssessment: { status: "loading", findings: [], reportUrl: `https://georisques.gouv.fr/api/v1/rapport_pdf?latlon=${encodeURIComponent(`${addr.lon},${addr.lat}`)}` },
      };

      onUpdateAnalysis(updated);
      void fetchRiskAssessment(addr.lat, addr.lon).then((assessment) => onUpdateRiskAssessment(updated.id, assessment));
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
    setSelectedCategory(null);
    setIsLoading(true);
    try {
      const [rev, analysisData] = await Promise.all([
        reverseGeocode(lat, lon),
        runParallelAnalysis(lat, lon),
      ]);
      if (searchId !== latestSearchId.current) return;

      const { pois, categories, avg } = analysisData;

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
        impressions: currentAnalysis?.impressions,
        riskAssessment: { status: "loading", findings: [], reportUrl: `https://georisques.gouv.fr/api/v1/rapport_pdf?latlon=${encodeURIComponent(`${lon},${lat}`)}` },
      };

      onUpdateAnalysis(updated);
      void fetchRiskAssessment(lat, lon).then((assessment) => onUpdateRiskAssessment(updated.id, assessment));
    } catch (e) {
      console.error("Erreur lors de la sélection de position:", e);
    } finally {
      if (searchId === latestSearchId.current) setIsLoading(false);
    }
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
                onSelectCategory={setSelectedCategory}
                onSelectLocation={isDemo ? undefined : handleMapLocationSelect}
                height="420px"
              />
            </div>
          </section>

          <section className="analysis-scores-section">
            <ScoresList
              categories={currentAnalysis.categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              addressName={`${currentAnalysis.address}, ${currentAnalysis.city}`}
            />
          </section>

          <section className="analysis-risk-section">
            <RiskNuisancePanel
              assessment={currentAnalysis.riskAssessment}
              tranquility={currentAnalysis.categories.find((category) => category.category === "tranquillite")}
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
