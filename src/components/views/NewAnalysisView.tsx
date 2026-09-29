import { ArrowRight, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { fetchAirQuality } from "../../services/airQualityApi";
import { reverseGeocode } from "../../services/banApi";
import {
  fetchEducationPOIsInRadius,
  mergeEducationPOIs,
} from "../../services/educationApi";
import { fetchPOIsInRadius } from "../../services/osmApi";
import { calculateCategoryScores } from "../../services/scoringEngine";
import { fetchSNCFStationsInRadius } from "../../services/sncfApi";
import type { AddressResult, NeighborhoodAnalysis, POI } from "../../types";
import { InteractiveMap } from "../map/InteractiveMap";
import { ScoresList } from "../scores/ScoresList";
import { AddressSearchBar } from "../search/AddressSearchBar";

/**
 * Extrait le nom de rue à partir du nom d'adresse BAN.
 * Supprime le numéro de voirie pour ne garder que le nom de la voie.
 * Ex: "7 Avenue Coubertin" → "Avenue Coubertin"
 */
function extractNeighborhoodName(rawName: string, city: string): string {
  if (!rawName) return city || "Adresse inconnue";

  // Supprimer le numéro de voirie en début (ex: "7 ", "12 bis ", "3-5 ")
  const streetName = rawName.replace(/^\d[\d\s\-/]*(?:bis|ter|quater)?\s+/i, "").trim();

  return streetName || city || "Adresse inconnue";
}

interface NewAnalysisViewProps {
  currentAnalysis: NeighborhoodAnalysis | null;
  onUpdateAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onGoToImpressions: () => void;
}

export const NewAnalysisView: React.FC<NewAnalysisViewProps> = ({
  currentAnalysis,
  onUpdateAnalysis,
  onGoToImpressions,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fonction résiliente et accélérée d'agrégation multi-API
  const runParallelAnalysis = async (lat: number, lon: number) => {
    const [osmRes, eduRes, sncfRes, airRes] = await Promise.allSettled([
      fetchPOIsInRadius(lat, lon, 850),
      fetchEducationPOIsInRadius(lat, lon, 850),
      fetchSNCFStationsInRadius(lat, lon, 1200),
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

    allPOIs.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const categories = calculateCategoryScores(allPOIs, airQuality);

    const sum = categories.reduce((acc, curr) => acc + curr.score, 0);
    const avg = Math.round((sum / categories.length) * 10) / 10;

    return { pois: allPOIs, categories, avg, airQuality };
  };

  // When user selects an address in autocomplete or hits Analyser
  const handleSelectAddress = async (addr: AddressResult) => {
    setIsLoading(true);
    try {
      const { pois, categories, avg } = await runParallelAnalysis(
        addr.lat,
        addr.lon,
      );

      const updated: NeighborhoodAnalysis = {
        id: `analysis_${Date.now()}`,
        createdAt: new Date().toISOString(),
        address: addr.name || addr.label,
        city: addr.city,
        postcode: addr.postcode,
        neighborhoodName: extractNeighborhoodName(addr.name, addr.city),
        lat: addr.lat,
        lon: addr.lon,
        globalScore: avg,
        categories,
        pois,
        impressions: currentAnalysis?.impressions,
      };

      onUpdateAnalysis(updated);
    } catch (e) {
      console.error("Erreur analyse:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // When user clicks anywhere on map
  const handleMapLocationSelect = async (lat: number, lon: number) => {
    setSelectedCategory(null); // Réinitialise le filtre pour afficher tous les équipements du nouvel emplacement
    setIsLoading(true);
    try {
      const [rev, analysisData] = await Promise.all([
        reverseGeocode(lat, lon),
        runParallelAnalysis(lat, lon),
      ]);

      const { pois, categories, avg } = analysisData;

      const updated: NeighborhoodAnalysis = {
        id: `analysis_${Date.now()}`,
        createdAt: new Date().toISOString(),
        address: rev ? rev.name : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: rev ? rev.city : (currentAnalysis?.city ?? ""),
        postcode: rev ? rev.postcode : (currentAnalysis?.postcode ?? ""),
        neighborhoodName: rev
          ? extractNeighborhoodName(rev.name, rev.city)
          : (currentAnalysis?.neighborhoodName ?? "Zone sélectionnée"),
        lat,
        lon,
        globalScore: avg,
        categories,
        pois,
        impressions: currentAnalysis?.impressions,
      };

      onUpdateAnalysis(updated);
    } catch (e) {
      console.error("Erreur lors de la sélection de position:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="new-analysis-container">
      {/* Header section matching Mockup 2 */}
      <div className="analysis-page-header">
        <h1 className="header-main-title">Nouveau quartier</h1>
        <p className="header-main-subtitle">
          Recherchez et définissez une nouvelle zone à analyser
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
        />
      </div>

      {currentAnalysis ? (
        <div className="analysis-results-content">
          <section className="analysis-map-section">
            <div className="map-card-wrapper cyt-card">
              <InteractiveMap
                lat={currentAnalysis.lat}
                lon={currentAnalysis.lon}
                neighborhoodName={currentAnalysis.neighborhoodName}
                pois={currentAnalysis.pois}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectLocation={handleMapLocationSelect}
                height="420px"
              />
              <div className="map-caption-bar">
                <span className="map-caption-text">
                  <MapPin
                    size={13}
                    style={{ display: "inline", marginRight: "4px" }}
                  />
                  Navigation libre : glissez et zoomez sans risque • Bouton « Déplacer l'adresse » (ou double-clic) pour repositionner
                </span>
              </div>
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
        </div>
      ) : (
        <div className="analysis-empty-state" role="status">
          <span className="empty-search-icon">
            <Search size={24} />
          </span>
          <div>
            <h2>Commencez par une adresse</h2>
            <p>
              La carte et les scores s’affichent après le lancement de
              l’analyse.
            </p>
          </div>
        </div>
      )}

      {/* Bottom CTA Button matching Mockup 2 */}
      {currentAnalysis && (
        <div className="analysis-bottom-cta-wrap">
          <button
            className="btn-primary cta-impressions-btn"
            onClick={onGoToImpressions}
          >
            <span>Renseigner mes impressions</span>
            <ArrowRight size={20} strokeWidth={2.4} />
          </button>
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

        /* CTA en bas — Jaune #f1e850 */
        .analysis-bottom-cta-wrap {
          display: flex;
          justify-content: center;
          margin-top: 14px;
        }

        .cta-impressions-btn {
          width: 100%;
          max-width: 640px;
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
      `}</style>
    </div>
  );
};
