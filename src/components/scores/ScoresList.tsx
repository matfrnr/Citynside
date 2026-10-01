import {
  Accessibility,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bus,
  Car,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  HeartPulse,
  Info,
  MinusCircle,
  PlusCircle,
  ShoppingBag,
  TreePine,
  Volume2,
  X,
} from "lucide-react";
import React, { useState } from "react";
import type { CategoryScore } from "../../types";

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
  const [modalCategory, setModalCategory] = useState<CategoryScore | null>(
    null,
  );

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Bus":
        return <Bus size={18} />;
      case "ShoppingBag":
        return <ShoppingBag size={18} />;
      case "GraduationCap":
        return <GraduationCap size={18} />;
      case "HeartPulse":
        return <HeartPulse size={18} />;
      case "TreePine":
        return <TreePine size={18} />;
      case "Car":
        return <Car size={18} />;
      case "Volume2":
        return <Volume2 size={18} />;
      case "Accessibility":
        return <Accessibility size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "#2e7d32";
    if (score >= 6.5) return "#437356";
    if (score >= 5) return "#d97706";
    return "#dc2626";
  };

  const getScoreLevel = (score: number) => {
    if (score >= 9) return "Très favorable";
    if (score >= 7) return "Favorable";
    if (score >= 5) return "À améliorer";
    return "Point de vigilance";
  };

  return (
    <div className="scores-list-container">
      <div className="scores-header">
        <div className="scores-header-top">
          <h3 className="scores-title">Scores & Indicateurs d'environnement</h3>
          {addressName && (
            <span className="address-live-badge">📍 {addressName}</span>
          )}
        </div>
        <p className="scores-subtitle">
          Chaque note sur 10 est accompagnée d’un repère clair : très favorable, favorable, à améliorer ou point de vigilance.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="categories-filter-bar">
        <button
          className={`filter-pill ${selectedCategory === null ? "active" : ""}`}
          onClick={() => onSelectCategory(null)}
        >
          Tous ({categories.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            className={`filter-pill ${selectedCategory === c.category ? "active" : ""}`}
            onClick={() =>
              onSelectCategory(
                selectedCategory === c.category ? null : c.category,
              )
            }
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
            const totalPos = (cat.positiveFactors || []).reduce(
              (acc, f) => acc + f.points,
              0,
            );
            const totalNeg = Math.abs(
              (cat.negativeFactors || []).reduce((acc, f) => acc + f.points, 0),
            );

            return (
              <div key={cat.category} className="score-card-item cyt-card">
                <div className="card-top-row">
                  <div className="card-icon-title">
                    <span className="cat-icon-badge">
                      {getIcon(cat.iconName)}
                    </span>
                    <span className="cat-label">{cat.label}</span>
                  </div>
                  <div
                    className="score-badge"
                    style={{ color: scoreColor, borderColor: scoreColor }}
                    aria-label={`Note ${cat.score.toFixed(1)} sur 10, ${getScoreLevel(cat.score)}`}
                  >
                    <span className="score-val">{cat.score.toFixed(1)}</span>
                    <span className="score-max">/10</span>
                  </div>
                </div>
                <span className="score-level" style={{ color: scoreColor }}>{getScoreLevel(cat.score)}</span>

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

                {/* Score balance pills : Ce qui rapporte et ce qui coûte */}
                <div className="card-score-factors-summary">
                  {totalPos > 0 && (
                    <span className="factor-pill pill-pos">
                      <ArrowUpRight size={13} />
                      +{totalPos.toFixed(1)} pts gagnés
                    </span>
                  )}
                  {totalNeg > 0 && (
                    <span className="factor-pill pill-neg">
                      <ArrowDownRight size={13} />
                      -{totalNeg.toFixed(1)} pts pénalisés
                    </span>
                  )}
                </div>

                {/* Highlights List: Top Positive & Top Negative */}
                <div className="factors-preview-list">
                  {(cat.positiveFactors || []).slice(0, 2).map((pos, idx) => (
                    <div key={`pos_${idx}`} className="preview-factor-item pos">
                      <PlusCircle size={14} className="factor-icon pos" />
                      <span className="factor-text">{pos.label}</span>
                      <span className="factor-pts">+{pos.points.toFixed(1)}</span>
                    </div>
                  ))}
                  {(cat.negativeFactors || []).slice(0, 1).map((neg, idx) => (
                    <div key={`neg_${idx}`} className="preview-factor-item neg">
                      <MinusCircle size={14} className="factor-icon neg" />
                      <span className="factor-text">{neg.label}</span>
                      <span className="factor-pts">{neg.points.toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Explainability button */}
                <div className="card-footer-action">
                  <button
                    className="explain-btn"
                    onClick={() => setModalCategory(cat)}
                  >
                    <Info size={14} />
                    <span>Détail complet du calcul & sources</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Transparency & Detailed Points Breakdown Modal */}
      {modalCategory && (
        <div
          className="methodology-modal-overlay"
          onClick={() => setModalCategory(null)}
        >
          <div
            className="methodology-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-cat-icon">
                  {getIcon(modalCategory.iconName)}
                </span>
                <div>
                  <h4 className="modal-title">{modalCategory.label}</h4>
                  <span className="modal-score-sub">
                    Note obtenue : <b>{modalCategory.score.toFixed(1)} / 10</b>
                  </span>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalCategory(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Formula & Summary */}
              <section className="modal-section balance-summary-box">
                <h5 className="section-label">Barème & Décomposition de la note</h5>
                <div className="balance-grid">
                  <div className="balance-col">
                    <span className="balance-sub">Score de base</span>
                    <span className="balance-val neutral">
                      {(modalCategory.baseScore ?? 3.0).toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="balance-col">
                    <span className="balance-sub">Points Gagnés</span>
                    <span className="balance-val pos">
                      +
                      {(modalCategory.positiveFactors || [])
                        .reduce((a, b) => a + b.points, 0)
                        .toFixed(1)}
                    </span>
                  </div>
                  <div className="balance-col">
                    <span className="balance-sub">Points Perdus</span>
                    <span className="balance-val neg">
                      {(modalCategory.negativeFactors || [])
                        .reduce((a, b) => a + b.points, 0)
                        .toFixed(1)}
                    </span>
                  </div>
                  <div className="balance-col total">
                    <span className="balance-sub">Note Finale</span>
                    <span className="balance-val score">
                      {modalCategory.score.toFixed(1)} / 10
                    </span>
                  </div>
                </div>
                <p className="section-text" style={{ marginTop: '8px' }}>
                  {modalCategory.calculationExplanation}
                </p>
              </section>

              {/* SECTION 1: Tout ce qui fait GAGNER des points */}
              <section className="modal-section factors-detail-section">
                <div className="factors-header pos">
                  <CheckCircle2 size={17} />
                  <h5>Ce qui fait GAGNER des points (Atouts & Proximité)</h5>
                </div>
                {(modalCategory.positiveFactors || []).length > 0 ? (
                  <ul className="modal-factor-list">
                    {(modalCategory.positiveFactors || []).map((factor, idx) => (
                      <li key={idx} className="modal-factor-card pos">
                        <div className="factor-main-info">
                          <span className="factor-badge-score pos">
                            +{factor.points.toFixed(1)} pt
                          </span>
                          <strong className="factor-name">{factor.label}</strong>
                        </div>
                        {factor.detail && (
                          <p className="factor-explanation">{factor.detail}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-factors-note">
                    Aucun bonus significatif identifié sur ce critère dans le rayon d'analyse.
                  </p>
                )}
              </section>

              {/* SECTION 2: Tout ce qui fait PERDRE des points */}
              <section className="modal-section factors-detail-section">
                <div className="factors-header neg">
                  <AlertTriangle size={17} />
                  <h5>Ce qui fait PERDRE des points (Points de vigilance & Manques)</h5>
                </div>
                {(modalCategory.negativeFactors || []).length > 0 ? (
                  <ul className="modal-factor-list">
                    {(modalCategory.negativeFactors || []).map((factor, idx) => (
                      <li key={idx} className="modal-factor-card neg">
                        <div className="factor-main-info">
                          <span className="factor-badge-score neg">
                            {factor.points.toFixed(1)} pt
                          </span>
                          <strong className="factor-name">{factor.label}</strong>
                        </div>
                        {factor.detail && (
                          <p className="factor-explanation">{factor.detail}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-factors-note">
                    Aucune pénalité majeure relevée pour ce quartier sur ce critère.
                  </p>
                )}
              </section>

              {/* SECTION 3: Sources Officielles */}
              <section className="modal-section">
                <h5 className="section-label">
                  Sources officielles & Open Data ({modalCategory.sources.length})
                </h5>
                <div className="sources-list">
                  {modalCategory.sources.map((src, idx) => (
                    <div key={idx} className="source-item">
                      <div>
                        {src.url ? (
                          <a
                            className="src-name src-link"
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {src.name} ↗
                          </a>
                        ) : (
                          <span className="src-name">{src.name}</span>
                        )}
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
              <button
                className="btn-primary"
                onClick={() => setModalCategory(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ScoresList — Charte Citynside V1 */
        .card-score-factors-summary {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .factor-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .factor-pill.pill-pos {
          background: #eaf6ec;
          color: #236c3b;
          border: 1px solid #cbe9cf;
        }

        .factor-pill.pill-neg {
          background: #fdf2f2;
          color: #c53030;
          border: 1px solid #fad2d2;
        }

        .factors-preview-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: 6px 0 10px 0;
          background: #f8faf8;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #e8efe8;
        }

        .preview-factor-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          line-height: 1.25;
        }

        .preview-factor-item.pos .factor-icon {
          color: #2a7a52;
          flex-shrink: 0;
        }

        .preview-factor-item.neg .factor-icon {
          color: #c53030;
          flex-shrink: 0;
        }

        .preview-factor-item .factor-text {
          flex: 1;
          color: #2c4244;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview-factor-item .factor-pts {
          font-weight: 700;
          font-size: 0.72rem;
        }

        .preview-factor-item.pos .factor-pts {
          color: #2a7a52;
        }

        .preview-factor-item.neg .factor-pts {
          color: #c53030;
        }

        /* Modal styling enhancements */
        .balance-summary-box {
          background: #f4f8f4;
          border: 1px solid #dce8dd;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }

        .balance-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 8px;
        }

        .balance-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 8px;
          background: #ffffff;
          border-radius: 8px;
          border: 1px solid #e1ebe2;
        }

        .balance-col.total {
          background: #153a3d;
          border-color: #153a3d;
        }

        .balance-col.total .balance-sub {
          color: #a3c2be;
        }

        .balance-sub {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #6a8284;
          margin-bottom: 2px;
        }

        .balance-val {
          font-size: 1.05rem;
          font-weight: 800;
        }

        .balance-val.pos { color: #2e7d32; }
        .balance-val.neg { color: #dc2626; }
        .balance-val.neutral { color: #4b6365; }
        .balance-val.score { color: #ffffff; }

        .factors-detail-section {
          margin-bottom: 16px;
        }

        .factors-header {
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 700;
          font-size: 0.88rem;
          margin-bottom: 8px;
        }

        .factors-header.pos { color: #236c3b; }
        .factors-header.neg { color: #c53030; }

        .modal-factor-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .modal-factor-card {
          padding: 8px 12px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2ece3;
        }

        .modal-factor-card.pos {
          border-left: 4px solid #2e7d32;
        }

        .modal-factor-card.neg {
          border-left: 4px solid #dc2626;
        }

        .factor-main-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .factor-badge-score {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .factor-badge-score.pos {
          background: #eaf6ec;
          color: #236c3b;
        }

        .factor-badge-score.neg {
          background: #fdf2f2;
          color: #c53030;
        }

        .factor-name {
          font-size: 0.84rem;
          color: #122c25;
        }

        .factor-explanation {
          font-size: 0.75rem;
          color: #637a7d;
          margin: 3px 0 0 0;
          padding-left: 2px;
        }

        .empty-factors-note {
          font-size: 0.78rem;
          font-style: italic;
          color: #799395;
          margin: 4px 0 8px;
        }

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

        .score-level {
          display: block;
          margin-top: -6px;
          font-size: .72rem;
          font-weight: 700;
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

        .src-link {
          text-decoration: none;
        }

        .src-link:hover,
        .src-link:focus-visible {
          text-decoration: underline;
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
