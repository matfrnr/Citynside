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
          font-size: 2.35rem;
          font-weight: 800;
          color: #122c25;
          letter-spacing: -0.03em;
        }

        .header-main-subtitle {
          font-size: 1rem;
          color: #647a70;
          margin-top: 6px;
          font-weight: 500;
        }

        .search-bar-row {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        /* Dual Column Split Layout */
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
          border-radius: 22px;
          overflow: hidden;
          background: #ffffff;
          padding: 8px;
          border: 1px solid #e0ebe0;
          box-shadow: 0 6px 24px rgba(18, 44, 37, 0.05);
        }

        .map-caption-bar {
          padding: 8px 12px 4px;
          text-align: center;
        }

        .map-caption-text {
          font-size: 0.74rem;
          color: #789085;
          font-weight: 600;
        }

        .split-col-scores {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Bottom CTA */
        .analysis-bottom-cta-wrap {
          display: flex;
          justify-content: center;
          margin-top: 14px;
        }

        .cta-impressions-btn {
          width: 100%;
          max-width: 640px;
          background-color: #9cbca4;
          color: #102b23;
          font-weight: 700;
          font-size: 1.08rem;
          padding: 16px 32px;
          border-radius: var(--radius-full);
          box-shadow: 0 6px 20px rgba(156, 188, 164, 0.45);
        }

        .cta-impressions-btn:hover {
          background-color: #add0b6;
          box-shadow: 0 8px 24px rgba(156, 188, 164, 0.6);
        }
      `}</style>
    </div>
  );
};
