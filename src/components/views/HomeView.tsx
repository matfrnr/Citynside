import React from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import type { NeighborhoodAnalysis } from '../../types';

interface HomeViewProps {
  analyses: NeighborhoodAnalysis[];
  onSelectAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onStartNewAnalysis: () => void;
  onToggleFavorite: (id: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  analyses,
  onSelectAnalysis,
  onStartNewAnalysis,
}) => {
  return (
    <div className="home-view-container">
      {/* Welcome Header */}
      <div className="home-hero-header">
        <h1 className="hero-title">Bienvenue sur Cytinside</h1>
        <p className="hero-subtitle">
          Renseignez vos impressions sur un quartier pour aider vos futurs clients
        </p>
      </div>

      {/* Recent Analyses Section */}
      <section className="recent-analyses-section">
        <div className="section-top-bar">
          <h2 className="section-heading">Analyses Récente</h2>
        </div>

        {/* 3-column Grid matching Mockup 1 */}
        <div className="analyses-cards-grid">
          {analyses.map((item) => (
            <div key={item.id} className="analysis-card cyt-card">
              {/* Top Row: Building Icon + Quarter Name */}
              <div className="card-top-row">
                <div className="card-building-icon">
                  <Building2 size={19} strokeWidth={2.4} />
                </div>
                <h3 className="card-quarter-name">{item.neighborhoodName}</h3>
              </div>

              {/* Middle Row: Ville + Score */}
              <div className="card-meta-row">
                <div className="meta-col">
                  <span className="meta-label">Ville</span>
                  <span className="meta-value">{item.city}</span>
                </div>
                <div className="meta-col text-right">
                  <span className="meta-label">Score</span>
                  <span className="meta-score">
                    <b>{item.globalScore.toFixed(1)}</b>/10
                  </span>
                </div>
              </div>

              {/* Bottom Row: Voir le rapport button */}
              <div className="card-action-wrap">
                <button
                  className="btn-outline btn-report-pill"
                  onClick={() => onSelectAnalysis(item)}
                >
                  Voir le rapport
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Big CTA button matching Mockup 1 */}
        <div className="home-cta-wrap">
          <button className="btn-primary home-big-cta" onClick={onStartNewAnalysis}>
            <span>Analyser un quartier</span>
            <ArrowRight size={20} strokeWidth={2.4} />
          </button>
        </div>
      </section>

      <style>{`
        .home-view-container {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 36px;
          padding: 8px 12px 48px;
        }

        .home-hero-header {
          text-align: center;
          margin-top: 12px;
        }

        .hero-title {
          font-size: 2.35rem;
          color: #122c25;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .hero-subtitle {
          font-size: 1rem;
          color: #647a70;
          margin-top: 10px;
          font-weight: 500;
        }

        .recent-analyses-section {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .section-top-bar {
          display: flex;
          align-items: center;
        }

        .section-heading {
          font-size: 1.35rem;
          font-weight: 800;
          color: #122c25;
          letter-spacing: -0.02em;
        }

        .analyses-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        @media (max-width: 940px) {
          .analyses-cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 620px) {
          .analyses-cards-grid {
            grid-template-columns: 1fr;
          }
        }

        .analysis-card {
          padding: 24px 22px 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: #ffffff;
          border-radius: var(--radius-md);
          border: 1px solid #e5ede3;
          box-shadow: 0 4px 16px rgba(18, 44, 37, 0.04);
          transition: var(--transition-smooth);
        }

        .analysis-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(18, 44, 37, 0.08);
          border-color: #d1e2cf;
        }

        .card-top-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .card-building-icon {
          color: #122c25;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .card-quarter-name {
          font-size: 1.05rem;
          font-weight: 800;
          color: #122c25;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        .card-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 0 4px;
        }

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .meta-col.text-right {
          text-align: right;
        }

        .meta-label {
          font-size: 0.72rem;
          color: #8c9e96;
          font-weight: 500;
        }

        .meta-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: #122c25;
        }

        .meta-score {
          font-size: 0.95rem;
          color: #122c25;
        }

        .meta-score b {
          font-size: 1.15rem;
          font-weight: 800;
          color: #122c25;
        }

        .card-action-wrap {
          margin-top: auto;
          display: flex;
        }

        .btn-report-pill {
          width: 100%;
          border-color: #9cbca4;
          color: #1b453a;
          font-weight: 700;
          font-size: 0.88rem;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          transition: var(--transition-fast);
        }

        .btn-report-pill:hover {
          background: #edf5eb;
          border-color: #89b392;
          color: #102d25;
        }

        .home-cta-wrap {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }

        .home-big-cta {
          width: 100%;
          max-width: 660px;
          background-color: #9cbca4;
          color: #102b23;
          font-weight: 700;
          font-size: 1.08rem;
          padding: 16px 32px;
          border-radius: var(--radius-full);
          box-shadow: 0 6px 20px rgba(156, 188, 164, 0.45);
        }

        .home-big-cta:hover {
          background-color: #add0b6;
          box-shadow: 0 8px 24px rgba(156, 188, 164, 0.6);
        }
      `}</style>
    </div>
  );
};
