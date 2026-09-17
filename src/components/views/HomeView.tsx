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
        /* HomeView — Charte Citynside V1 */
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

        /* Fira Sans via la règle globale h1 */
        .hero-title {
          font-size: 2.3rem;
          color: var(--color-primary);
          font-weight: 700;
          letter-spacing: -0.025em;
        }

        .hero-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.98rem;
          color: var(--color-text-muted);
          margin-top: 10px;
          font-weight: 400;
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

        /* Fira Sans via la règle globale h2 */
        .section-heading {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.015em;
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
          padding: 22px 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          background: #ffffff;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-card);
          transition: var(--transition-smooth);
        }

        .analysis-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-hover);
          border-color: var(--color-green);
        }

        .card-top-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Icône bâtiment en couleur primaire */
        .card-building-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-xs);
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .card-quarter-name {
          font-family: var(--font-family-heading);
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-primary);
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        .card-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 10px 12px;
          background: var(--color-bg-app);
          border-radius: var(--radius-xs);
        }

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .meta-col.text-right {
          text-align: right;
        }

        .meta-label {
          font-size: 0.68rem;
          color: var(--color-text-subtle);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .meta-value {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .meta-score {
          font-size: 0.92rem;
          color: var(--color-primary);
        }

        .meta-score b {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .card-action-wrap {
          margin-top: auto;
          display: flex;
        }

        /* Bouton secondaire sur les cartes — vert */
        .btn-report-pill {
          width: 100%;
          border-color: var(--color-green);
          color: var(--color-primary);
          font-weight: 600;
          font-size: 0.86rem;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          transition: var(--transition-fast);
        }

        .btn-report-pill:hover {
          background: var(--color-green-light);
          border-color: var(--color-green-hover);
          color: var(--color-primary-dark);
        }

        .home-cta-wrap {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }

        /* CTA principal — Jaune #f1e850 (accent charte V1) */
        .home-big-cta {
          width: 100%;
          max-width: 660px;
          background-color: var(--color-yellow);
          color: var(--color-text-on-yellow);
          font-weight: 700;
          font-size: 1.05rem;
          padding: 16px 32px;
          border-radius: var(--radius-full);
          box-shadow: var(--shadow-cta-yellow);
          transition: var(--transition-smooth);
        }

        .home-big-cta:hover {
          background-color: var(--color-yellow-hover);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(241, 232, 80, 0.52);
        }

        .home-big-cta:active {
          transform: translateY(0);
          box-shadow: var(--shadow-cta-yellow);
        }
      `}</style>
    </div>
  );
};
