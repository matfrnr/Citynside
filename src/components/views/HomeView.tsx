import React, { useEffect, useState } from 'react';
import { Building2, ArrowRight, Map, Bell, FileText, Calendar, MapPin, History, Star, GitCompareArrows, Pencil, X, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LOCAL_DEMO_USER_ID, type AppView, type NeighborhoodAnalysis } from '../../types';
import { DEFAULT_QUICK_ACCESS, fetchHomeQuickAccess, getLocalHomeQuickAccess, saveHomeQuickAccess, type QuickAccessId } from '../../services/homeQuickAccess';
import { supabase } from '../../services/supabase';

const MAX_RECENT = 3;
const QUICK_ACCESS_OPTIONS: { id: QuickAccessId; label: string; description: string; icon: LucideIcon; iconClass: string; view?: AppView }[] = [
  { id: 'new-analysis', label: 'Nouvelle analyse', description: 'Lancer une recherche de quartier', icon: Map, iconClass: 'quick-icon--map' },
  { id: 'history', label: 'Historique', description: 'Retrouver les dernières analyses', icon: History, iconClass: 'quick-icon--fav', view: 'enregistrements' },
  { id: 'favorites', label: 'Favoris', description: 'Accéder aux analyses étoilées', icon: Star, iconClass: 'quick-icon--fav', view: 'favoris' },
  { id: 'comparison', label: 'Comparer', description: 'Mettre deux quartiers côte à côte', icon: GitCompareArrows, iconClass: 'quick-icon--map', view: 'comparison' },
  { id: 'notifications', label: 'Notifications', description: 'Voir les dernières notifications', icon: Bell, iconClass: 'quick-icon--notif', view: 'notifications' },
  { id: 'profile', label: 'Mon profil', description: 'Gérer vos informations personnelles', icon: FileText, iconClass: 'quick-icon--profile', view: 'profile' },
];

interface HomeViewProps {
  analyses: NeighborhoodAnalysis[];
  onSelectAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onStartNewAnalysis: () => void;
  onNavigate: (view: AppView) => void;
  userName: string;
  userId: string;
}

export const HomeView: React.FC<HomeViewProps> = ({
  analyses,
  onSelectAnalysis,
  onStartNewAnalysis,
  onNavigate,
  userName,
  userId,
}) => {
  const [quickAccess, setQuickAccess] = useState<QuickAccessId[]>(() => getLocalHomeQuickAccess(userId) ?? DEFAULT_QUICK_ACCESS);
  const [isEditingQuickAccess, setIsEditingQuickAccess] = useState(false);
  const [draftQuickAccess, setDraftQuickAccess] = useState<QuickAccessId[]>(quickAccess);
  const [quickAccessSaveError, setQuickAccessSaveError] = useState('');
  const [isSavingQuickAccess, setIsSavingQuickAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const choices = await fetchHomeQuickAccess(userId);
        if (!cancelled) {
          setQuickAccess(choices);
        }
      } catch (error) {
        console.warn('Chargement des accès rapides synchronisés impossible :', error);
      }
    };
    void load();

    if (userId === LOCAL_DEMO_USER_ID) return () => { cancelled = true; };
    const channel = supabase.channel(`home-quick-access-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, async () => {
        try {
          const choices = await fetchHomeQuickAccess(userId);
          if (!cancelled) {
            setQuickAccess(choices);
          }
        } catch (error) {
          console.warn('Synchronisation des accès rapides impossible :', error);
        }
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);
  const firstName = userName.split(/\s+/)[0] || 'Agent';
  const recentAnalyses = [...analyses]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_RECENT);

  // Determine greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const handleSaveQuickAccess = async () => {
    setIsSavingQuickAccess(true);
    setQuickAccessSaveError('');
    setQuickAccess(draftQuickAccess);
    try {
      await saveHomeQuickAccess(userId, draftQuickAccess);
      setIsEditingQuickAccess(false);
    } catch (error) {
      console.error('Enregistrement des accès rapides synchronisés impossible :', error);
      setQuickAccessSaveError('Les raccourcis sont gardés sur cet appareil, mais la synchronisation a échoué. Réessayez plus tard.');
    } finally {
      setIsSavingQuickAccess(false);
    }
  };

  return (
    <div className="home-container">
      {/* Hero welcome */}
      <section className="home-hero">
        <div className="hero-text">
          <h1 className="hero-greeting">{greeting}, {firstName}</h1>
          <p className="hero-tagline">
            {userId === LOCAL_DEMO_USER_ID
              ? 'Découvrez Citynside avec trois exemples de quartiers. La recherche est réservée aux comptes connectés.'
              : "Évaluez l'environnement d'un bien, enrichissez vos mandats avec des données terrain fiables."}
          </p>
        </div>
        <button className="hero-cta" onClick={onStartNewAnalysis}>
          <Map size={20} strokeWidth={2.2} />
          <span>{userId === LOCAL_DEMO_USER_ID ? 'Explorer un exemple' : 'Nouvelle analyse'}</span>
          <ArrowRight size={18} />
        </button>
      </section>

      {/* Quick access cards */}
      <section className="home-quick-access">
        <div className="quick-access-heading">
          <h2 className="section-title">Accès rapides</h2>
          {userId !== LOCAL_DEMO_USER_ID && <button className="edit-quick-access" onClick={() => { setDraftQuickAccess(quickAccess); setQuickAccessSaveError(''); setIsEditingQuickAccess(true); }}>
            <Pencil size={14} /> Modifier
          </button>}
        </div>
        <div className="quick-grid">
          {quickAccess.map((id) => {
            const item = QUICK_ACCESS_OPTIONS.find((option) => option.id === id)!;
            const Icon = item.icon;
            return <button key={id} className="quick-card" onClick={id === 'new-analysis' ? onStartNewAnalysis : () => item.view && onNavigate(item.view)}>
              <div className={`quick-icon ${item.iconClass}`}><Icon size={22} /></div>
              <span className="quick-label">{userId === LOCAL_DEMO_USER_ID && id === 'new-analysis' ? 'Carte exemple' : item.label}</span>
            </button>;
          })}
        </div>
      </section>

      {isEditingQuickAccess && <div className="quick-edit-backdrop" onClick={() => setIsEditingQuickAccess(false)}>
        <section className="quick-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-edit-title" onClick={(event) => event.stopPropagation()}>
          <header className="quick-edit-header">
            <div><h2 id="quick-edit-title">Personnaliser les accès rapides</h2><p>Choisissez les quatre raccourcis qui vous servent le plus.</p></div>
            <button className="quick-edit-close" aria-label="Fermer" onClick={() => setIsEditingQuickAccess(false)}><X size={18} /></button>
          </header>
          <div className="quick-edit-options">
            {QUICK_ACCESS_OPTIONS.map((option) => {
              const selected = draftQuickAccess.includes(option.id);
              const Icon = option.icon;
              return <label key={option.id} className={`quick-edit-option ${selected ? 'selected' : ''}`}>
                <input type="checkbox" checked={selected} disabled={!selected && draftQuickAccess.length >= 4} onChange={() => setDraftQuickAccess((current) => selected ? current.filter((id) => id !== option.id) : [...current, option.id])} />
                <span className={`quick-icon ${option.iconClass}`}><Icon size={20} /></span>
                <span className="quick-edit-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                {selected && <Check size={17} className="quick-edit-check" />}
              </label>;
            })}
          </div>
          <footer className="quick-edit-footer">
            <span>{draftQuickAccess.length}/4 sélectionnés</span>
            <div><button className="quick-edit-cancel" disabled={isSavingQuickAccess} onClick={() => setIsEditingQuickAccess(false)}>Annuler</button><button className="quick-edit-save" disabled={draftQuickAccess.length !== 4 || isSavingQuickAccess} onClick={() => void handleSaveQuickAccess()}>{isSavingQuickAccess ? 'Synchronisation…' : 'Enregistrer'}</button></div>
          </footer>
          {quickAccessSaveError && <p className="quick-edit-error" role="alert">{quickAccessSaveError}</p>}
        </section>
      </div>}

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
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .quick-access-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .edit-quick-access { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--color-text-muted); font: inherit; font-size: .8rem; font-weight: 650; cursor: pointer; }
        .edit-quick-access:hover { color: var(--color-primary); }
        .quick-edit-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15, 35, 31, .48); }
        .quick-edit-dialog { width: min(100%, 520px); max-height: min(90vh, 720px); overflow-y: auto; padding: 24px; border: 1px solid var(--color-border); border-radius: 16px; background: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.22); }
        .quick-edit-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
        .quick-edit-header h2 { color: var(--color-primary); font-size: 1.15rem; }
        .quick-edit-header p { margin-top: 5px; color: var(--color-text-muted); font-size: .82rem; }
        .quick-edit-close { display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 auto; border: 0; border-radius: 50%; background: #f2f5f1; color: var(--color-primary); cursor: pointer; }
        .quick-edit-options { display: grid; gap: 9px; }
        .quick-edit-option { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border: 1px solid var(--color-border); border-radius: 10px; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
        .quick-edit-option.selected { border-color: var(--color-green); background: #f4f8f2; }
        .quick-edit-option input { width: 17px; height: 17px; accent-color: var(--color-primary); }
        .quick-edit-option .quick-icon { width: 38px; height: 38px; flex: 0 0 auto; }
        .quick-edit-copy { display: grid; gap: 3px; flex: 1; }
        .quick-edit-copy strong { color: var(--color-primary); font-size: .86rem; }
        .quick-edit-copy small { color: var(--color-text-muted); font-size: .74rem; }
        .quick-edit-check { color: var(--color-green); }
        .quick-edit-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 20px; color: var(--color-text-muted); font-size: .78rem; }
        .quick-edit-footer > div { display: flex; gap: 8px; }
        .quick-edit-cancel,.quick-edit-save { padding: 9px 14px; border-radius: 8px; font: inherit; font-size: .8rem; font-weight: 650; cursor: pointer; }
        .quick-edit-cancel { border: 1px solid var(--color-border); background: #fff; color: var(--color-primary); }
        .quick-edit-cancel:disabled { opacity: .5; cursor: not-allowed; }
        .quick-edit-save { border: 1px solid var(--color-primary); background: var(--color-primary); color: #fff; }
        .quick-edit-save:disabled { opacity: .45; cursor: not-allowed; }
        .quick-edit-error { margin-top: 12px; color: #ad493e; font-size: .78rem; line-height: 1.4; }

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
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
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

        .home-empty .hero-cta {
          align-self: center;
          margin-top: 16px;
        }

        /* ── Responsive ── */
        @media (max-width: 820px) {
          .quick-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 540px) {
          .quick-grid {
            grid-template-columns: repeat(2, 1fr);
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
