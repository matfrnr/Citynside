import React from 'react';
import { Building2, ArrowRight, Map, Star, Bell, FileText, Calendar, MapPin } from 'lucide-react';
import type { AppView, NeighborhoodAnalysis } from '../../types';

const MAX_RECENT = 3;

interface HomeViewProps {
  analyses: NeighborhoodAnalysis[];
  onSelectAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onStartNewAnalysis: () => void;
  onToggleFavorite: (id: string) => void;
  onNavigate: (view: AppView) => void;
  userName: string;
}

export const HomeView: React.FC<HomeViewProps> = ({
  analyses,
  onSelectAnalysis,
  onStartNewAnalysis,
  onNavigate,
  userName,
}) => {
  const firstName = userName.split(/\s+/)[0] || 'Agent';
  const recentAnalyses = analyses.slice(0, MAX_RECENT);
  const favoritesCount = analyses.filter((a) => a.isFavorite).length;

  // Determine greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="home-container">
      {/* Hero welcome */}
      <section className="home-hero">
        <div className="hero-text">
          <h1 className="hero-greeting">{greeting}, {firstName}</h1>
          <p className="hero-tagline">
            Évaluez l'environnement d'un bien, enrichissez vos mandats avec des données terrain fiables.
          </p>
        </div>
        <button className="hero-cta" onClick={onStartNewAnalysis}>
          <Map size={20} strokeWidth={2.2} />
          <span>Nouvelle analyse</span>
          <ArrowRight size={18} />
        </button>
      </section>

      {/* Quick access cards */}
      <section className="home-quick-access">
        <h2 className="section-title">Accès rapides</h2>
        <div className="quick-grid">
          <button className="quick-card" onClick={onStartNewAnalysis}>
            <div className="quick-icon quick-icon--map"><Map size={22} /></div>
            <span className="quick-label">Analyser un quartier</span>
          </button>
          <button className="quick-card" onClick={() => onNavigate('enregistrements')}>
            <div className="quick-icon quick-icon--fav"><Star size={22} /></div>
            <div className="quick-label-group">
              <span className="quick-label">Historique & Favoris</span>
            </div>
          </button>
          <button className="quick-card" onClick={() => onNavigate('notifications')}>
            <div className="quick-icon quick-icon--notif"><Bell size={22} /></div>
            <span className="quick-label">Notifications</span>
          </button>
          <button className="quick-card" onClick={() => onNavigate('profile')}>
            <div className="quick-icon quick-icon--profile"><FileText size={22} /></div>
            <span className="quick-label">Mon profil</span>
          </button>
        </div>
      </section>

      {/* Recent analyses */}
      {recentAnalyses.length > 0 && (
        <section className="home-recent">
          <div className="section-header">
            <h2 className="section-title">Analyses récentes</h2>
            {analyses.length > MAX_RECENT && (
              <button className="see-all-link" onClick={() => onNavigate('enregistrements')}>
                Tout voir ({analyses.length})
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          <div className="recent-grid">
            {recentAnalyses.map((item) => (
              <button
                key={item.id}
                className="recent-card cyt-card"
                onClick={() => onSelectAnalysis(item)}
              >
                <div className="rc-top">
                  <div className="rc-icon-wrap">
                    <Building2 size={18} strokeWidth={2.2} />
                  </div>
                  <div className="rc-info">
                    <h3 className="rc-name">{item.neighborhoodName || item.address}</h3>
                    <span className="rc-address">
                      <MapPin size={11} />
                      {item.address}, {item.city}
                    </span>
                  </div>
                </div>

                <div className="rc-meta">
                  <div className="rc-score-badge">
                    <span className="rc-score-val">{item.globalScore.toFixed(1)}</span>
                    <span className="rc-score-unit">/10</span>
                  </div>
                  <div className="rc-pills">
                    {item.categories.slice(0, 2).map((c) => (
                      <span key={c.category} className="rc-pill">
                        {c.label.split(' ')[0]} {c.score.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rc-footer">
                  <span className="rc-date">
                    <Calendar size={11} />
                    {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                  <span className="rc-cta">
                    Voir le rapport <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {recentAnalyses.length === 0 && (
        <section className="home-empty">
          <div className="empty-icon"><Map size={40} strokeWidth={1.3} /></div>
          <h3>Aucune analyse pour le moment</h3>
          <p>Lancez votre première analyse de quartier pour commencer à enrichir vos mandats.</p>
          <button className="hero-cta hero-cta--small" onClick={onStartNewAnalysis}>
            <Map size={18} />
            <span>Lancer une analyse</span>
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      <style>{`
        .home-container {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 36px;
          padding: 4px 8px 56px;
        }

        /* ── Hero ── */
        .home-hero {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
          border-radius: var(--radius-md);
          padding: 32px 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hero-greeting {
          font-size: 1.65rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .hero-tagline {
          font-family: var(--font-family-body);
          font-size: 0.92rem;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.5;
          max-width: 520px;
        }

        .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          align-self: flex-start;
          background: var(--color-yellow);
          color: var(--color-text-on-yellow);
          font-family: var(--font-family-heading);
          font-size: 0.95rem;
          font-weight: 700;
          padding: 12px 26px;
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(241, 232, 80, 0.35);
          transition: var(--transition-smooth);
        }

        .hero-cta:hover {
          background: var(--color-yellow-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(241, 232, 80, 0.45);
        }

        .hero-cta:active {
          transform: translateY(0);
        }

        .hero-cta--small {
          font-size: 0.88rem;
          padding: 10px 22px;
        }

        /* ── Section titles ── */
        .section-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.01em;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .see-all-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-family-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-text-muted);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .see-all-link:hover {
          color: var(--color-primary);
        }

        /* ── Quick access ── */
        .quick-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 14px;
        }

        .quick-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px 12px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: var(--shadow-card);
        }

        .quick-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-hover);
          border-color: var(--color-green);
        }

        .quick-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .quick-icon--map {
          background: var(--color-green-light);
          color: var(--color-primary);
        }
        .quick-icon--fav {
          background: var(--color-yellow-light);
          color: #b8a200;
        }
        .quick-icon--notif {
          background: #eef2ff;
          color: #4f6aca;
        }
        .quick-icon--profile {
          background: #fdf2f8;
          color: #b45281;
        }

        .quick-label {
          font-family: var(--font-family-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-text-main);
          text-align: center;
          line-height: 1.3;
        }

        .quick-label-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .quick-badge {
          font-family: var(--font-family-body);
          font-size: 0.68rem;
          font-weight: 700;
          color: #ffffff;
          background: var(--color-primary);
          padding: 1px 7px;
          border-radius: 10px;
          line-height: 1.4;
        }

        /* ── Recent analyses ── */
        .recent-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 14px;
        }

        .recent-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px 16px 14px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          cursor: pointer;
          text-align: left;
          transition: var(--transition-smooth);
        }

        .recent-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-hover);
          border-color: var(--color-green);
        }

        .rc-top {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .rc-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .rc-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .rc-name {
          font-family: var(--font-family-heading);
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--color-primary);
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rc-address {
          font-family: var(--font-family-body);
          font-size: 0.72rem;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rc-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-green-subtle);
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--color-border-subtle);
        }

        .rc-score-badge {
          display: flex;
          align-items: baseline;
          gap: 1px;
        }

        .rc-score-val {
          font-family: var(--font-family-heading);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-primary);
          line-height: 1;
        }

        .rc-score-unit {
          font-family: var(--font-family-body);
          font-size: 0.7rem;
          color: var(--color-text-subtle);
          font-weight: 500;
        }

        .rc-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .rc-pill {
          font-family: var(--font-family-body);
          font-size: 0.66rem;
          background: #ffffff;
          border: 1px solid var(--color-border);
          padding: 2px 7px;
          border-radius: 4px;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .rc-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 2px;
        }

        .rc-date {
          font-family: var(--font-family-body);
          font-size: 0.68rem;
          color: var(--color-text-subtle);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .rc-cta {
          font-family: var(--font-family-body);
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--color-primary);
          display: flex;
          align-items: center;
          gap: 4px;
          opacity: 0.7;
          transition: opacity 0.15s ease;
        }

        .recent-card:hover .rc-cta {
          opacity: 1;
        }

        /* ── Empty state ── */
        .home-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 48px 24px;
          text-align: center;
        }

        .empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .home-empty h3 {
          font-family: var(--font-family-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .home-empty p {
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          color: var(--color-text-muted);
          max-width: 380px;
          line-height: 1.5;
        }

        /* ── Responsive ── */
        @media (max-width: 820px) {
          .quick-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .recent-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 540px) {
          .quick-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .recent-grid {
            grid-template-columns: 1fr;
          }
          .home-hero {
            padding: 24px 20px;
          }
          .hero-greeting {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </div>
  );
};
