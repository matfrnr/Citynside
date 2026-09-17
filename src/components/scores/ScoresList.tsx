import React, { useState } from 'react';
import {
  Bus,
  ShoppingBag,
  GraduationCap,
  HeartPulse,
  TreePine,
  Car,
  Volume2,
  Accessibility,
  Info,
  ChevronRight,
  X,
} from 'lucide-react';
import type { CategoryScore } from '../../types';

interface ScoresListProps {
  categories: CategoryScore[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  addressName?: string;
}

export const ScoresList: React.FC<ScoresListProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  addressName,
}) => {
  const [modalCategory, setModalCategory] = useState<CategoryScore | null>(null);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Bus':
        return <Bus size={18} />;
      case 'ShoppingBag':
        return <ShoppingBag size={18} />;
      case 'GraduationCap':
        return <GraduationCap size={18} />;
      case 'HeartPulse':
        return <HeartPulse size={18} />;
      case 'TreePine':
        return <TreePine size={18} />;
      case 'Car':
        return <Car size={18} />;
      case 'Volume2':
        return <Volume2 size={18} />;
      case 'Accessibility':
        return <Accessibility size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return '#2e7d32';
    if (score >= 6.5) return '#437356';
    if (score >= 5) return '#d97706';
    return '#dc2626';
  };

  return (
    <div className="scores-list-container">
      <div className="scores-header">
        <div className="scores-header-top">
          <h3 className="scores-title">Scores & Indicateurs d'environnement</h3>
          {addressName && (
            <span className="address-live-badge">
              📍 {addressName}
            </span>
          )}
        </div>
        <p className="scores-subtitle">Données calculées en temps réel • Cliquez pour filtrer</p>
      </div>

      {/* Filter Tabs */}
      <div className="categories-filter-bar">
        <button
          className={`filter-pill ${selectedCategory === null ? 'active' : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          Tous ({categories.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            className={`filter-pill ${selectedCategory === c.category ? 'active' : ''}`}
            onClick={() => onSelectCategory(selectedCategory === c.category ? null : c.category)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Category Cards List */}
      <div className="scores-cards-grid">
        {categories
          .filter((c) => !selectedCategory || selectedCategory === c.category)
          .map((cat) => {
            const scoreColor = getScoreColor(cat.score);
            return (
              <div key={cat.category} className="score-card-item cyt-card">
                <div className="card-top-row">
                  <div className="card-icon-title">
                    <span className="cat-icon-badge">{getIcon(cat.iconName)}</span>
                    <span className="cat-label">{cat.label}</span>
                  </div>
                  <div className="score-badge" style={{ color: scoreColor, borderColor: scoreColor }}>
                    <span className="score-val">{cat.score.toFixed(1)}</span>
                    <span className="score-max">/10</span>
                  </div>
                </div>

                <p className="highlight-text">{cat.highlightText}</p>

                {/* Score Progress Bar */}
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(cat.score / 10) * 100}%`,
                      backgroundColor: scoreColor,
                    }}
                  />
                </div>

                {/* Key Points - up to 3 details */}
                <ul className="details-list">
                  {cat.details.slice(0, 3).map((det, i) => (
                    <li key={i} className="detail-item">
                      <span className="bullet">•</span>
                      <span>{det}</span>
                    </li>
                  ))}
                </ul>

                {/* Explainability button */}
                <div className="card-footer-action">
                  <button
                    className="explain-btn"
                    onClick={() => setModalCategory(cat)}
                  >
                    <Info size={14} />
                    <span>Comment c'est calculé ? ({cat.sources.length} sources)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Transparency & Methodology Modal */}
      {modalCategory && (
        <div className="methodology-modal-overlay" onClick={() => setModalCategory(null)}>
          <div className="methodology-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-cat-icon">{getIcon(modalCategory.iconName)}</span>
                <div>
                  <h4 className="modal-title">{modalCategory.label}</h4>
                  <span className="modal-score-sub">
                    Note obtenue : <b>{modalCategory.score.toFixed(1)} / 10</b>
                  </span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setModalCategory(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <section className="modal-section">
                <h5 className="section-label">Méthodologie de calcul</h5>
                <p className="section-text">{modalCategory.calculationExplanation}</p>
              </section>

              <section className="modal-section">
                <h5 className="section-label">Éléments pris en compte</h5>
                <ul className="modal-details-list">
                  {modalCategory.details.map((item, idx) => (
                    <li key={idx} className="modal-detail-item">
                      <span className="badge-ok">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="modal-section">
                <h5 className="section-label">Sources officielles & Open Data</h5>
                <div className="sources-list">
                  {modalCategory.sources.map((src, idx) => (
                    <div key={idx} className="source-item">
                      <div>
                        <span className="src-name">{src.name}</span>
                        <p className="src-desc">{src.description}</p>
                      </div>
                      {src.lastUpdated && (
                        <span className="src-date">Maj {src.lastUpdated}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setModalCategory(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ScoresList — Charte Citynside V1 */
        .scores-list-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .scores-header {
          margin-bottom: 2px;
        }

        .scores-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* Badge adresse en vert de la charte */
        .address-live-badge {
          background: var(--color-green-light);
          color: var(--color-primary);
          font-family: var(--font-family-body);
          font-size: 0.73rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: var(--radius-full);
          border: 1px solid #c5dcc2;
          white-space: nowrap;
        }

        .scores-title {
          font-family: var(--font-family-heading);
          font-size: 1.1rem;
          color: var(--color-primary);
          font-weight: 700;
        }

        .scores-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-muted);
          margin-top: 2px;
          font-weight: 400;
        }

        /* Filtre chips */
        .categories-filter-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
        }

        .filter-pill {
          padding: 5px 12px;
          border-radius: var(--radius-full);
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          font-weight: 500;
          background: #ffffff;
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          white-space: nowrap;
          transition: var(--transition-fast);
        }

        /* Pill actif en vert #9dc599 */
        .filter-pill.active, .filter-pill:hover {
          background: var(--color-green);
          color: var(--color-primary-dark);
          border-color: var(--color-green);
          font-weight: 700;
        }

        .scores-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }

        .score-card-item {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-icon-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Icône en fond vert clair */
        .cat-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cat-label {
          font-family: var(--font-family-body);
          font-weight: 600;
          font-size: 0.90rem;
          color: var(--color-primary);
        }

        .score-badge {
          display: flex;
          align-items: baseline;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid;
          background: #fdfdfd;
        }

        .score-val {
          font-family: var(--font-family-heading);
          font-size: 1.05rem;
          font-weight: 700;
        }

        .score-max {
          font-family: var(--font-family-body);
          font-size: 0.70rem;
          opacity: 0.7;
          margin-left: 2px;
        }

        .highlight-text {
          font-family: var(--font-family-body);
          font-size: 0.81rem;
          font-weight: 500;
          color: var(--color-text-muted);
        }

        .progress-track {
          width: 100%;
          height: 5px;
          background: #ddeedd;
          border-radius: 99px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.4s ease;
        }

        .details-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-item {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-family: var(--font-family-body);
          font-size: 0.77rem;
          color: var(--color-text-muted);
          line-height: 1.3;
        }

        /* Bullet en vert */
        .bullet {
          color: var(--color-green);
          font-size: 1.1rem;
          line-height: 0.8;
        }

        .card-footer-action {
          margin-top: auto;
          padding-top: 6px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .explain-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-family-body);
          font-size: 0.74rem;
          font-weight: 500;
          color: var(--color-text-muted);
          padding: 4px 0;
          transition: color 0.15s ease;
        }

        .explain-btn:hover {
          color: var(--color-primary);
        }

        /* Modal méthodologie */
        .methodology-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(21, 58, 61, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 16px;
          animation: fadeIn 0.15s ease-out;
        }

        .methodology-modal {
          background: #ffffff;
          border-radius: var(--radius-lg);
          max-width: 520px;
          width: 100%;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: scaleUp 0.18s ease-out;
        }

        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        /* En-tête modal en bleu-vert #153a3d */
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-app);
        }

        .modal-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .modal-cat-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-title {
          font-family: var(--font-family-heading);
          font-size: 1.05rem;
          color: var(--color-primary);
          font-weight: 700;
        }

        .modal-score-sub {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-muted);
        }

        .modal-close-btn {
          color: var(--color-text-muted);
          padding: 6px;
          border-radius: 50%;
          transition: background 0.15s ease;
        }

        .modal-close-btn:hover {
          background: rgba(0,0,0,0.06);
        }

        .modal-body {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-height: 65vh;
          overflow-y: auto;
        }

        .modal-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-label {
          font-family: var(--font-family-body);
          font-size: 0.70rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-subtle);
        }

        .section-text {
          font-family: var(--font-family-body);
          font-size: 0.86rem;
          line-height: 1.45;
          color: var(--color-text-main);
          background: var(--color-bg-app);
          padding: 12px 14px;
          border-radius: var(--radius-sm);
        }

        .modal-details-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modal-detail-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-family-body);
          font-size: 0.83rem;
        }

        .badge-ok {
          color: var(--color-success);
          font-weight: 800;
        }

        .sources-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .source-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--color-bg-app);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }

        .src-name {
          font-family: var(--font-family-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .src-desc {
          font-family: var(--font-family-body);
          font-size: 0.73rem;
          color: var(--color-text-muted);
        }

        /* Date badge en vert */
        .src-date {
          font-family: var(--font-family-body);
          font-size: 0.68rem;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--color-green-light);
          color: var(--color-primary);
          font-weight: 600;
        }

        .modal-footer {
          padding: 14px 22px;
          border-top: 1px solid var(--color-border);
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
};
