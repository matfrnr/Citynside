import { useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { AddressSearchBar } from '../search/AddressSearchBar';
import { InteractiveMap } from '../map/InteractiveMap';
import { ScoresList } from '../scores/ScoresList';
import type { NeighborhoodAnalysis, AddressResult } from '../../types';
import { fetchPOIsInRadius } from '../../services/osmApi';
import { calculateCategoryScores } from '../../services/scoringEngine';
import { reverseGeocode } from '../../services/banApi';

interface NewAnalysisViewProps {
  currentAnalysis: NeighborhoodAnalysis;
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

  // When user selects an address in autocomplete or hits Analyser
  const handleSelectAddress = async (addr: AddressResult) => {
    setIsLoading(true);
    try {
      const pois = await fetchPOIsInRadius(addr.lat, addr.lon, 900);
      const categories = calculateCategoryScores(pois);

      const sum = categories.reduce((acc, curr) => acc + curr.score, 0);
      const avg = Math.round((sum / categories.length) * 10) / 10;

      const updated: NeighborhoodAnalysis = {
        id: `analysis_${Date.now()}`,
        createdAt: new Date().toISOString(),
        address: addr.name || addr.label,
        city: addr.city,
        postcode: addr.postcode,
        neighborhoodName: `Quartier ${addr.name.split(' ')[0] || addr.city}`,
        lat: addr.lat,
        lon: addr.lon,
        globalScore: avg,
        categories,
        pois,
        impressions: currentAnalysis.impressions,
      };

      onUpdateAnalysis(updated);
    } catch (e) {
      console.error('Erreur analyse:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // When user clicks anywhere on map
  const handleMapLocationSelect = async (lat: number, lon: number) => {
    setIsLoading(true);
    try {
      const rev = await reverseGeocode(lat, lon);
      const pois = await fetchPOIsInRadius(lat, lon, 900);
      const categories = calculateCategoryScores(pois);
      const sum = categories.reduce((acc, curr) => acc + curr.score, 0);
      const avg = Math.round((sum / categories.length) * 10) / 10;

      const updated: NeighborhoodAnalysis = {
        id: `analysis_${Date.now()}`,
        createdAt: new Date().toISOString(),
        address: rev ? rev.name : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: rev ? rev.city : currentAnalysis.city,
        postcode: rev ? rev.postcode : currentAnalysis.postcode,
        neighborhoodName: rev ? `Quartier ${rev.name}` : currentAnalysis.neighborhoodName,
        lat,
        lon,
        globalScore: avg,
        categories,
        pois,
        impressions: currentAnalysis.impressions,
      };

      onUpdateAnalysis(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="new-analysis-container">
      {/* Header section matching Mockup 2 */}
      <div className="analysis-page-header">
        <h1 className="header-main-title">Nouveau quartier</h1>
        <p className="header-main-subtitle">Recherchez et définissez une nouvelle zone à analyser</p>
      </div>

      {/* Dark Search Bar matching Mockup 2 */}
      <div className="search-bar-row">
        <AddressSearchBar
          initialValue={currentAnalysis.address ? `${currentAnalysis.address}, ${currentAnalysis.city}` : ''}
          onSelectAddress={handleSelectAddress}
          onTriggerAnalysis={() => {}}
          isLoading={isLoading}
        />
      </div>

      {/* Tablet Layout Split (Left: Map, Right: Scores) */}
      <div className="analysis-split-content">
        {/* Left column: Interactive Map with refined frame */}
        <section className="split-col-map">
          <div className="map-card-wrapper cyt-card">
            <InteractiveMap
              lat={currentAnalysis.lat}
              lon={currentAnalysis.lon}
              neighborhoodName={currentAnalysis.neighborhoodName}
              pois={currentAnalysis.pois}
              selectedCategory={selectedCategory}
              onSelectLocation={handleMapLocationSelect}
              height="510px"
            />
            <div className="map-caption-bar">
              <span className="map-caption-text">
                <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Cliquez n'importe où sur la carte pour déplacer l'analyse
              </span>
            </div>
          </div>
        </section>

        {/* Right column: Objective Indicators & Scores */}
        <section className="split-col-scores">
          <ScoresList
            categories={currentAnalysis.categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            addressName={`${currentAnalysis.address}, ${currentAnalysis.city}`}
          />
        </section>
      </div>

      {/* Bottom CTA Button matching Mockup 2 */}
      <div className="analysis-bottom-cta-wrap">
        <button className="btn-primary cta-impressions-btn" onClick={onGoToImpressions}>
          <span>Renseigner mes impressions</span>
          <ArrowRight size={20} strokeWidth={2.4} />
        </button>
      </div>

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

        /* Disposition en deux colonnes */
        .analysis-split-content {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 26px;
          align-items: start;
        }

        @media (max-width: 980px) {
          .analysis-split-content {
            grid-template-columns: 1fr;
          }
        }

        .split-col-map {
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

        .split-col-scores {
          display: flex;
          flex-direction: column;
          gap: 14px;
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
