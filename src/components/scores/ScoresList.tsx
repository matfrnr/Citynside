import {
  Accessibility,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bus,
  Building2,
  Car,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  HeartPulse,
  Info,
  MapPin,
  MinusCircle,
  PlusCircle,
  ShoppingBag,
  Sparkles,
  TreePine,
  Volume2,
  X,
} from "lucide-react";
import React, { useState } from "react";
import type { CategoryScore, POI, ScoreFactor } from "../../types";
import type { DefaultScoreProfile, DistanceUnit } from "../../services/userPreferences";
import { formatDistanceText } from "../../services/distanceFormat";

interface ScoresListProps {
  categories: CategoryScore[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  addressName?: string;
  globalScore: number;
  pois: POI[];
  onLocatePoi: (poi: POI) => void;
  defaultScoreProfile: DefaultScoreProfile;
  distanceUnit: DistanceUnit;
}

export const ScoresList: React.FC<ScoresListProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  addressName,
  globalScore,
  pois,
  onLocatePoi,
  defaultScoreProfile,
  distanceUnit,
}) => {
  const [modalCategory, setModalCategory] = useState<CategoryScore | null>(
    null,
  );
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [showProfileOptions, setShowProfileOptions] = useState(false);
  const [scoreProfile, setScoreProfile] = useState<string | null>(defaultScoreProfile === "none" ? null : defaultScoreProfile);
  const scoreProfiles: { id: string; label: string; weights: Record<string, number> }[] = [
    { id: "family", label: "Famille", weights: { ecoles: 3.5, sante: 2.5, espaces_verts: 2., tranquillite: 1, loisirs: 0.5, commerces: 0.5, transports: 0, pmr: 0 } },
    { id: "student", label: "Étudiant", weights: { transports: 4, commerces: 2, loisirs: 0, sante: 0, espaces_verts: 0, tranquillite: 1, ecoles: 3 } },
    { id: "senior", label: "Senior", weights: { sante: 4, pmr: 3, commerces: 2.5, transports: 1, espaces_verts: 1, tranquillite: 2, loisirs: 0 } },
    { id: "investor", label: "Investisseur", weights: { transports: 2, commerces: 3, ecoles: 2, sante: 2, loisirs: 0, espaces_verts: 0, tranquillite: 0, pmr: 0, stationnement: 1 } },
  ];
  const activeProfile = scoreProfiles.find((profile) => profile.id === scoreProfile) || null;
  const profileEntries = activeProfile ? categories.flatMap((category) => {
    const weight = activeProfile.weights[category.category];
    return weight ? [{ score: category.score, weight }] : [];
  }) : [];
  const profileScore = profileEntries.length
    ? profileEntries.reduce((sum, item) => sum + item.score * item.weight, 0) / profileEntries.reduce((sum, item) => sum + item.weight, 0)
    : null;
  const globalGrade = globalScore >= 8.5 ? "A+" : globalScore >= 7.5 ? "A" : globalScore >= 6.5 ? "B" : "C";

  const findFactorPoi = (factor: ScoreFactor): POI | null => {
    const distance = factor.label.match(/\b(\d{1,4})\s*m\b/i)?.[1];
    if (!distance) return null;
    const factorDistance = Number(distance);
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const label = normalize(factor.label);
    const candidates = pois.filter((poi) => Math.abs(poi.distanceMeters - factorDistance) <= 1);
    const namedMatches = candidates.filter((poi) => [poi.name, poi.subType].some((term) => {
      const normalizedTerm = normalize(term);
      return normalizedTerm.length >= 4 && label.includes(normalizedTerm);
    }));
    if (namedMatches.length === 1) return namedMatches[0];
    if (namedMatches.length > 1) return null;
    return candidates.length === 1 ? candidates[0] : null;
  };

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
      case "Sparkles":
        return <Sparkles size={18} />;
      case "Building2":
        return <Building2 size={18} />;
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

      <section className="profile-score-panel" aria-label="Note globale et profils indicatifs">
        <div className="profile-score-heading">
          <div><strong>Note globale</strong><span>Moyenne des 10 indicateurs.</span></div>
          <div className="global-score-result">
            <b>{globalScore.toFixed(1)}<small>/10</small></b>
            <span className={`global-score-grade grade-${globalGrade.toLowerCase().replace("+", "plus")}`}>{globalGrade}</span>
          </div>
        </div>
        <div className="profile-inline-row" aria-label="Profils indicatifs">
          <div className="profile-inline-heading">
            <span>Lecture indicative</span>
            <button
              type="button"
              className="profile-info-button"
              aria-label="Comprendre les profils et leur pondération"
              title="Comprendre les profils"
              onClick={() => setShowProfileInfo(true)}
            ><Info size={13} /></button>
          </div>
          <div className="profile-inline-actions">
            {profileScore !== null && <b className="profile-inline-score">{profileScore.toFixed(1)}<small>/10</small></b>}
            <div className="profile-picker">
              <button
                type="button"
                className={`profile-picker-trigger${activeProfile ? " has-profile" : ""}`}
                aria-expanded={showProfileOptions}
                aria-haspopup="listbox"
                onClick={() => setShowProfileOptions((open) => !open)}
              >
                <span>{activeProfile ? `Profil : ${activeProfile.label}` : "Ajouter un profil"}</span>
                <ChevronRight size={16} className={showProfileOptions ? "profile-picker-chevron is-open" : "profile-picker-chevron"} />
              </button>
              {showProfileOptions && (
                <div className="profile-picker-menu" role="listbox" aria-label="Choisir un profil indicatif">
                  {scoreProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      role="option"
                      aria-selected={scoreProfile === profile.id}
                      className={scoreProfile === profile.id ? "selected" : ""}
                      onClick={() => { setScoreProfile(profile.id); setShowProfileOptions(false); }}
                    >
                      <span>{profile.label}</span>
                      {scoreProfile === profile.id && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              )}
              {activeProfile && (
                <button
                  type="button"
                  className="profile-remove-button"
                  onClick={() => { setScoreProfile(null); setShowProfileOptions(false); }}
                >Retirer le profil</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {showProfileInfo && (
        <div className="methodology-modal-overlay" role="dialog" aria-modal="true" aria-label="Explication des profils indicatifs" onClick={() => setShowProfileInfo(false)}>
          <div className="methodology-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-cat-icon"><Info size={18} /></span>
                <div>
                  <h4 className="modal-title">Profils indicatifs</h4>
                  <span className="modal-score-sub">Une lecture adaptée à votre projet</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowProfileInfo(false)} aria-label="Fermer">×</button>
            </div>
            <div className="modal-body">
              <p className="section-text">La note globale est la moyenne simple des 10 catégories. Les profils appliquent ensuite des coefficients différents pour montrer ce qui compte le plus selon votre situation. Ils servent de repère et ne remplacent pas la note globale.</p>
              <div className="modal-section">
                <h5 className="section-label">Pondérations</h5>
                <ul className="modal-factor-list">
                  <li className="modal-factor-card"><strong style={{ fontSize: "1em" }}>Famille</strong><br/><span style={{ fontSize: "0.8em" }}>Surpondération des indicateurs Écoles · Santé · Espaces verts</span></li>
                  <li className="modal-factor-card"><strong style={{ fontSize: "1em" }}>Étudiant</strong><br/><span style={{ fontSize: "0.8em" }}>Surpondération des indicateurs Transports · Écoles · Commerces</span></li>
                  <li className="modal-factor-card"><strong style={{ fontSize: "1em" }}>Senior</strong><br/><span style={{ fontSize: "0.8em" }}>Surpondération des indicateurs Santé · PMR · Commerces</span></li>
                  <li className="modal-factor-card"><strong style={{ fontSize: "1em" }}>Investisseur</strong><br/><span style={{ fontSize: "0.8em" }}>Surpondération des indicateurs Transports · Commerces · Écoles</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

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

                <p className="highlight-text">{formatDistanceText(cat.highlightText, distanceUnit)}</p>

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
                {(cat.positiveFactors?.length || cat.negativeFactors?.length) ? <div className="factors-preview-list">
                  {(cat.positiveFactors || []).slice(0, 2).map((pos, idx) => (
                    <div key={`pos_${idx}`} className="preview-factor-item pos">
                      <PlusCircle size={14} className="factor-icon pos" />
                      <span className="factor-text">{formatDistanceText(pos.label, distanceUnit)}</span>
                      <span className="factor-pts">+{pos.points.toFixed(1)}</span>
                    </div>
                  ))}
                  {(cat.negativeFactors || []).slice(0, 1).map((neg, idx) => (
                    <div key={`neg_${idx}`} className="preview-factor-item neg">
                      <MinusCircle size={14} className="factor-icon neg" />
                      <span className="factor-text">{formatDistanceText(neg.label, distanceUnit)}</span>
                      <span className="factor-pts">{neg.points.toFixed(1)}</span>
                    </div>
                  ))}
                </div> : null}

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
                    <span className="balance-sub">Points gagnés</span>
                    <span className="balance-val pos">
                      +
                      {(modalCategory.positiveFactors || [])
                        .reduce((a, b) => a + b.points, 0)
                        .toFixed(1)}
                    </span>
                  </div>
                  <div className="balance-col">
                    <span className="balance-sub">Points perdus</span>
                    <span className="balance-val neg">
                      {(modalCategory.negativeFactors || [])
                        .reduce((a, b) => a + b.points, 0)
                        .toFixed(1)}
                    </span>
                  </div>
                  <div className="balance-col total">
                    <span className="balance-sub">Note finale</span>
                    <span className="balance-val score">
                      {modalCategory.score.toFixed(1)} / 10
                    </span>
                  </div>
                </div>
                <p className="section-text" style={{ marginTop: '8px' }}>
                  {modalCategory.calculationExplanation}
                </p>
              </section>

              {/* SECTION 1: Facteurs positifs */}
              <section className="modal-section factors-detail-section">
                <div className="factors-header pos">
                  <CheckCircle2 size={17} />
                  <h5>Points gagnés</h5>
                </div>
                {(modalCategory.positiveFactors || []).length > 0 ? (
                  <ul className="modal-factor-list">
                    {(modalCategory.positiveFactors || []).map((factor, idx) => (
                      (() => {
                        const relatedPoi = findFactorPoi(factor);
                        return <li key={idx} className="modal-factor-card pos">
                          <div className="factor-main-info">
                            <span className="factor-badge-score pos">
                              +{factor.points.toFixed(1)} pt
                            </span>
                            <strong className="factor-name">{formatDistanceText(factor.label, distanceUnit)}</strong>
                          </div>
                          {factor.detail && <p className="factor-explanation">{factor.detail}</p>}
                          {relatedPoi && <button type="button" className="factor-locate-btn" onClick={() => { setModalCategory(null); onLocatePoi(relatedPoi); }}>
                            <MapPin size={14} /> Voir sur la carte
                          </button>}
                        </li>;
                      })()
                    ))}
                  </ul>
                ) : (
                  <p className="empty-factors-note">
                    Aucun bonus significatif identifié sur ce critère dans le rayon d'analyse.
                  </p>
                )}
              </section>

              {/* SECTION 2: Facteurs de vigilance */}
              <section className="modal-section factors-detail-section">
                <div className="factors-header neg">
                  <AlertTriangle size={17} />
                  <h5>Points de vigilance</h5>
                </div>
                {(modalCategory.negativeFactors || []).length > 0 ? (
                  <ul className="modal-factor-list">
                    {(modalCategory.negativeFactors || []).map((factor, idx) => (
                      (() => {
                        const relatedPoi = findFactorPoi(factor);
                        return <li key={idx} className="modal-factor-card neg">
                          <div className="factor-main-info">
                            <span className="factor-badge-score neg">
                              {factor.points.toFixed(1)} pt
                            </span>
                            <strong className="factor-name">{formatDistanceText(factor.label, distanceUnit)}</strong>
                          </div>
                          {factor.detail && <p className="factor-explanation">{factor.detail}</p>}
                          {relatedPoi && <button type="button" className="factor-locate-btn" onClick={() => { setModalCategory(null); onLocatePoi(relatedPoi); }}>
                            <MapPin size={14} /> Voir sur la carte
                          </button>}
                        </li>;
                      })()
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
        .factor-locate-btn { display: inline-flex; align-items: center; gap: 5px; margin: 6px 0 0 2px; padding: 4px 7px; border: 0; border-radius: 6px; background: #eef5ef; color: #315f42; font: inherit; font-size: .72rem; font-weight: 650; cursor: pointer; }
        .factor-locate-btn:hover { background: #deebdf; }

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
        .profile-score-panel{margin:14px 0;padding:15px 17px;border:1px solid #dce8dd;border-radius:12px;background:#f7faf6}.profile-score-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.profile-score-heading>div{display:flex;flex-direction:column;gap:3px}.profile-score-heading strong{color:#173d36;font-size:.9rem}.profile-score-heading span,.profile-score-panel>p{color:#667c78;font-size:.75rem}.profile-score-heading>b{color:#2e6846;font-size:1.45rem}.profile-score-heading b small{font-size:.75rem}.profile-score-options{display:flex;flex-wrap:wrap;gap:7px;margin:11px 0 8px}.profile-score-options button{padding:6px 12px;border:1px solid #d2dfd3;border-radius:999px;background:#fff;color:#38554e;font:inherit;font-size:.76rem;cursor:pointer}.profile-score-options button.active{border-color:#376a4d;background:#376a4d;color:#fff}.profile-score-panel>p{margin:0;line-height:1.45}
        .profile-score-heading>.global-score-result { display: flex; flex-direction: row; align-items: center; gap: 8px; }
        .profile-score-heading .global-score-result>b { color: #2e6846; font-size: 1.45rem; }
        .global-score-grade { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 5px; border-radius: 8px; background: #e8f2e8; color: #2e7d32; font-size: .82rem; font-weight: 750; }
        .global-score-grade.grade-aplus { background: #e2f1e8; color: #1b633e; }
        .global-score-grade.grade-b { background: #e9f1eb; color: #437356; }
        .global-score-grade.grade-c { background: #fff3df; color: #d97706; }

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

        .profile-title-with-info { display: flex; align-items: center; gap: 7px; }
        .profile-info-button {
          display: inline-grid;
          place-items: center;
          width: 21px;
          height: 21px;
          padding: 0;
          border: 1px solid #cbd8ce;
          border-radius: 50%;
          background: #fff;
          color: #557368;
          cursor: pointer;
        }
        .profile-info-button:hover { background: #edf5ee; color: #28543f; }
        .profile-inline-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e4ece4; }
        .profile-inline-heading { display: flex; align-items: center; gap: 6px; color: #73847e; font-size: .73rem; font-weight: 600; }
        .profile-inline-heading .profile-info-button { width: 18px; height: 18px; }
        .profile-inline-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-left: auto; }
        .profile-inline-score { color: #4b735b; font-size: .95rem; }
        .profile-inline-score small { font-size: .68rem; }
        @media (max-width: 480px) {
          .profile-score-panel { padding: 13px; }
          .profile-score-heading { align-items: flex-start; }
          .profile-score-heading>div { min-width: 0; }
          .profile-inline-row { align-items: flex-start; }
          .profile-inline-actions { margin-left: 0; }
          .profile-picker-menu { max-width: calc(100vw - 48px); }
        }
        .profile-picker { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .profile-inline-row .profile-picker { margin-top: 0; }
        .profile-picker-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 32px;
          padding: 0 9px;
          border: 1px solid #cbdccd;
          border-radius: 9px;
          background: #fff;
          color: #28543f;
          font: inherit;
          font-size: .74rem;
          font-weight: 650;
          cursor: pointer;
        }
        .profile-picker-trigger:hover { border-color: #83a98b; background: #fbfdfb; }
        .profile-picker-trigger.has-profile { background: #eef6ef; }
        .profile-picker-chevron { transition: transform .15s ease; }
        .profile-picker-chevron.is-open { transform: rotate(90deg); }
        .profile-picker-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 30;
          display: grid;
          min-width: 210px;
          padding: 5px;
          border: 1px solid #d9e5da;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 10px 28px rgba(24, 53, 39, .16);
        }
        .profile-picker-menu button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 38px;
          padding: 0 10px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #38554e;
          font: inherit;
          font-size: .78rem;
          text-align: left;
          cursor: pointer;
        }
        .profile-picker-menu button:hover,
        .profile-picker-menu button.selected { background: #eef6ef; color: #28543f; }
        .profile-remove-button {
          padding: 5px 8px;
          border: 0;
          background: transparent;
          color: #73847e;
          font: inherit;
          font-size: .72rem;
          cursor: pointer;
        }
        .profile-remove-button:hover { color: #9f2d26; text-decoration: underline; }

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
