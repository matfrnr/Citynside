import React, { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { Sidebar } from "./components/layout/Sidebar";
import { AuthView } from "./components/views/AuthView";
import { EnregistrementsView } from "./components/views/EnregistrementsView";
import { ComparisonView } from "./components/views/ComparisonView";
import { HomeView } from "./components/views/HomeView";
import { ImpressionsView } from "./components/views/ImpressionsView";
import { NewAnalysisView } from "./components/views/NewAnalysisView";
import { NotificationsView } from "./components/views/NotificationsView";
import { ProfileView } from "./components/views/ProfileView";
import { ReportView } from "./components/views/ReportView";
import { ReleaseNotesModal } from "./components/release/ReleaseNotesModal";
import { clearReleaseNotesContinueState } from "./config/releaseNotes";
import { fetchUserProfile } from "./services/profile";
import { createNotification, fetchNotifications } from "./services/notifications";
import { registerCurrentDevice } from "./services/deviceSession";
import {
  deleteAnalysis,
  fetchAnalyses,
  getStoredAnalyses,
  renameAnalysis,
  saveAnalysis,
  toggleFavorite,
} from "./services/storage";
import { mapProfileRowToAuthUser, mapSupabaseUser, supabase } from "./services/supabase";
import {
  type AppView,
  type AuthUser,
  type FieldImpressions,
  LOCAL_DEMO_USER_ID,
  type NeighborhoodAnalysis,
  type RiskAssessment,
} from "./types";

const LOCAL_DEMO_SESSION_KEY = "citynside_demo_session";
const APP_VIEWS: AppView[] = [
  "home", "new-analysis", "impressions", "report", "enregistrements",
  "favoris", "comparison", "notifications", "profile",
];

const readViewFromUrl = (): AppView => {
  const requested = new URLSearchParams(window.location.search).get("view");
  return APP_VIEWS.includes(requested as AppView) ? requested as AppView : "home";
};

const notifyAccountActivated = async (userId: string) => {
  if (userId === LOCAL_DEMO_USER_ID) return;
  const fallbackKey = `citynside_activation_notified_${userId}`;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("activation_notification_sent")
    .eq("id", userId)
    .maybeSingle();

  if (profileError?.code === "PGRST204") {
    if (localStorage.getItem(fallbackKey) === "true") return;
  } else if (profileError) {
    throw profileError;
  } else if (profile?.activation_notification_sent) {
    return;
  }

  const activatedAt = new Date();
  await createNotification(userId, {
    id: `account_activated_${userId}`,
    title: "Votre compte a bien été activé",
    description: `Activation confirmée le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(activatedAt)}.`,
    kind: "system",
    importance: "important",
  });

  if (profileError?.code === "PGRST204") {
    localStorage.setItem(fallbackKey, "true");
    return;
  }
  const { error: saveError } = await supabase.from("profiles").upsert(
    { id: userId, activation_notification_sent: true },
    { onConflict: "id" },
  );
  if (saveError) throw saveError;
};

export const App: React.FC = () => {
  const [analyses, setAnalyses] = useState<NeighborhoodAnalysis[]>([]);
  const [currentView, setCurrentView] = useState<AppView>(readViewFromUrl);
  const [activeAnalysis, setActiveAnalysis] =
    useState<NeighborhoodAnalysis | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [importantNotificationsCount, setImportantNotificationsCount] = useState(0);
  const [isDemoInfoOpen, setIsDemoInfoOpen] = useState(false);

  useEffect(() => {
    if (authChecking) return;
    const url = new URL(window.location.href);
    if (currentView === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", currentView);

    if (["report", "impressions", "new-analysis"].includes(currentView) && activeAnalysis) {
      url.searchParams.set("analysis", activeAnalysis.id);
    } else {
      url.searchParams.delete("analysis");
    }
    window.history.replaceState(window.history.state, "", url);
  }, [activeAnalysis?.id, authChecking, currentView]);

  const refreshImportantNotificationsCount = async (userId: string) => {
    try {
      const items = await fetchNotifications(userId);
      setImportantNotificationsCount(items.filter((item) => item.importance === "important" && !item.read).length);
    } catch (error) {
      console.warn("Compteur de notifications indisponible :", error);
    }
  };

  useEffect(() => {
    if (!authUser) { setImportantNotificationsCount(0); return; }
    void refreshImportantNotificationsCount(authUser.id);
  }, [authUser?.id]);

  const loadUserAnalyses = async (userId: string, isInitial = false) => {
    // 1. Instatané depuis le cache local (vide pour un nouveau compte réel)
    const cached = getStoredAnalyses(userId);
    setAnalyses(cached);
    if (isInitial) {
      const requestedAnalysisId = new URLSearchParams(window.location.search).get("analysis");
      const blankNewAnalysis = userId !== LOCAL_DEMO_USER_ID && readViewFromUrl() === "new-analysis" && !requestedAnalysisId;
      setActiveAnalysis(blankNewAnalysis
        ? null
        : cached.find((analysis) => analysis.id === requestedAnalysisId) ?? cached[0] ?? null);
    }

    // 2. Récupération distante depuis Supabase BDD
    if (userId !== LOCAL_DEMO_USER_ID) {
      try {
        const fresh = await fetchAnalyses(userId);
        setAnalyses(fresh);
        if (isInitial) {
          const requestedAnalysisId = new URLSearchParams(window.location.search).get("analysis");
          const blankNewAnalysis = userId !== LOCAL_DEMO_USER_ID && readViewFromUrl() === "new-analysis" && !requestedAnalysisId;
          setActiveAnalysis((prev) => blankNewAnalysis
            ? null
            : fresh.find((analysis) => analysis.id === requestedAnalysisId) ??
              fresh.find((analysis) => analysis.id === prev?.id) ??
              prev ??
              fresh[0] ??
              null);
        } else {
          setActiveAnalysis((prev) => {
            if (!prev) return null;
            // Si l'utilisateur est sur une nouvelle recherche en cours (non encore en base), la préserver absolument
            if (!fresh.some((a) => a.id === prev.id)) {
              return prev;
            }
            return fresh.find((a) => a.id === prev.id) || prev;
          });
        }
      } catch (err) {
        console.warn("Erreur chargement Supabase:", err);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (localStorage.getItem(LOCAL_DEMO_SESSION_KEY) === "active") {
      const demoUser: AuthUser = {
        id: LOCAL_DEMO_USER_ID,
        name: "Compte de démonstration",
        email: "demo@citynside.local",
      };
      setAuthUser(demoUser);
      loadUserAnalyses(demoUser.id, true);
      setAuthChecking(false);
      return () => {
        cancelled = true;
      };
    }

    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (cancelled) return;
        if (session?.user && !error) {
          // Afficher tout de suite l'application avec les informations déjà
          // disponibles dans la session. Les appels Supabase secondaires ne
          // doivent pas bloquer le premier affichage après un rechargement.
          const user = mapSupabaseUser(session.user);
          setAuthUser(user);
          void loadUserAnalyses(user.id, true);
          setAuthChecking(false);

          void Promise.allSettled([
            fetchUserProfile(session.user).then((profile) => {
              if (!cancelled) setAuthUser(profile);
            }),
            notifyAccountActivated(user.id),
            registerCurrentDevice(user.id),
          ]);
          return;
        }
        setAuthChecking(false);
      })
      .catch(() => {
        if (!cancelled) setAuthChecking(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (localStorage.getItem(LOCAL_DEMO_SESSION_KEY) === "active") return;

      // Ne jamais écraser l'écran ou l'analyse en cours lors d'un simple rafraîchissement de token (ex: Alt+Tab)
      if (event === "TOKEN_REFRESHED") return;
      // La restauration initiale est gérée par getSession ci-dessus, sans
      // bloquer l'affichage sur les appels de profil et d'historique.
      if (event === "INITIAL_SESSION") return;

      if (session?.user) {
        const user = await fetchUserProfile(session.user);
        setAuthUser(user);
        await loadUserAnalyses(user.id, false);
      } else {
        clearReleaseNotesContinueState();
        setAuthUser(null);
        setAnalyses([]);
        setActiveAnalysis(null);
      }
    });

    // 3. Synchronisation Realtime : répercute les créations/modifications faites sur d'autres appareils
    const realtimeChannel = supabase
      .channel("cytinside-db-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "analyses" },
        async () => {
          if (cancelled) return;
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const fresh = await fetchAnalyses(session.user.id);
            setAnalyses(fresh);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        async (payload) => {
          if (cancelled) return;
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id && payload.new && (payload.new as any).id === session.user.id) {
            const freshProfile = mapProfileRowToAuthUser(payload.new as any, session.user.email);
            setAuthUser(freshProfile);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const handleAuthenticated = async (user: AuthUser) => {
    if (user.id === LOCAL_DEMO_USER_ID) {
      localStorage.setItem(LOCAL_DEMO_SESSION_KEY, "active");
      setAuthUser(user);
    } else {
      const freshUser = await fetchUserProfile(user);
      setAuthUser(freshUser);
      await notifyAccountActivated(freshUser.id).catch((err) => console.warn("Notification d’activation non enregistrée :", err));
      await registerCurrentDevice(freshUser.id).catch((err) => console.warn("Vérification du nouvel appareil impossible :", err));
      await refreshImportantNotificationsCount(freshUser.id);
    }
    setCurrentView("home");
    await loadUserAnalyses(user.id, true);
    // setCurrentView removed to avoid overriding

  };

  const handleLogout = async () => {
    if (authUser) clearReleaseNotesContinueState(authUser.id);
    if (authUser?.id === LOCAL_DEMO_USER_ID) {
      localStorage.removeItem(LOCAL_DEMO_SESSION_KEY);
    } else {
      try {
        await supabase.auth.signOut();
      } catch {
        // La session locale est fermée même si Supabase est indisponible.
      }
    }
    setAuthUser(null);
    setAnalyses([]);
    setActiveAnalysis(null);
    setCurrentView("home");
  };

  const handleSelectAnalysis = (analysis: NeighborhoodAnalysis) => {
    setActiveAnalysis(analysis);
    setCurrentView("report");
  };

  const handleStartNewAnalysis = () => {
    if (authUser?.id === LOCAL_DEMO_USER_ID) {
      const demoExamples = analyses.length ? analyses : getStoredAnalyses(LOCAL_DEMO_USER_ID);
      const currentExample = activeAnalysis && demoExamples.some((item) => item.id === activeAnalysis.id)
        ? activeAnalysis
        : null;
      const defaultExample = demoExamples.find((item) => item.id === "aigle_38000") ?? demoExamples[0] ?? null;
      setActiveAnalysis(currentExample ?? defaultExample);
    } else {
      // A new search must start from a genuinely blank state.
      setActiveAnalysis(null);
    }
    setCurrentView("new-analysis");
  };

  // Chaque recherche terminée devient immédiatement une entrée d'historique.
  const handleUpdateAnalysis = (updated: NeighborhoodAnalysis) => {
    if (authUser?.id === LOCAL_DEMO_USER_ID) {
      // Demo examples may be enriched from the same public sources as a live
      // analysis, but those refreshed details stay in memory only.
      setActiveAnalysis(updated);
      return;
    }
    setActiveAnalysis(updated);
    if (authUser) {
      void saveAnalysis(updated, authUser.id).then(() => {
        setAnalyses(getStoredAnalyses(authUser.id));
      });
    }
    if (authUser) {
      void createNotification(authUser.id, {
        id: `analysis_${updated.id}`,
        title: "Analyse terminée · sources consultées",
        description: `L’analyse de ${updated.address}, ${updated.city} vient d’être calculée à partir des sources disponibles.`,
        kind: "analysis",
      }).catch((error) => console.warn("Notification d’analyse non enregistrée :", error));
    }
  };

  const handleUpdateRiskAssessment = async (analysisId: string, riskAssessment: RiskAssessment) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    const stored = getStoredAnalyses(authUser.id).find((analysis) => analysis.id === analysisId);
    if (!stored) return;
    const base = activeAnalysis?.id === analysisId ? activeAnalysis : stored;
    const updated = { ...base, riskAssessment };
    if (activeAnalysis?.id === analysisId) setActiveAnalysis(updated);
    await saveAnalysis(updated, authUser.id);
    setAnalyses(getStoredAnalyses(authUser.id));
  };

  // Renommer une analyse existante
  const handleRenameAnalysis = async (id: string, newName: string) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    await renameAnalysis(id, newName, authUser.id);
    const updatedList = getStoredAnalyses(authUser.id);
    setAnalyses(updatedList);
    if (activeAnalysis?.id === id) {
      setActiveAnalysis({ ...activeAnalysis, neighborhoodName: newName });
    }
  };

  const handleGoToImpressions = () => {
    setCurrentView("impressions");
  };

  const handleSaveImpressions = async (impressions: FieldImpressions) => {
    if (!activeAnalysis || !authUser || authUser.id === LOCAL_DEMO_USER_ID) return;

    const updated: NeighborhoodAnalysis = {
      ...activeAnalysis,
      impressions,
    };

    setActiveAnalysis(updated);
    await saveAnalysis(updated, authUser.id);
    setAnalyses(getStoredAnalyses(authUser.id));
    setCurrentView("report");
  };

  const handleToggleFav = async (id: string) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    await toggleFavorite(id, authUser.id);
    const updatedList = getStoredAnalyses(authUser.id);
    setAnalyses(updatedList);
    if (activeAnalysis && activeAnalysis.id === id) {
      setActiveAnalysis({
        ...activeAnalysis,
        isFavorite: !activeAnalysis.isFavorite,
      });
    }
  };

  const handleDeleteAnalysis = async (id: string) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    await deleteAnalysis(id, authUser.id);
    const updatedList = getStoredAnalyses(authUser.id);
    setAnalyses(updatedList);
    if (activeAnalysis?.id === id) {
      setActiveAnalysis(null);
    }
  };

  const favoritesCount = analyses.filter((a) => a.isFavorite).length;

  if (authChecking) {
    return (
      <div
        role="status"
        aria-label="Vérification de la session"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          backgroundColor: "var(--color-bg-app, #f6f9f6)",
        }}
      >
        <img
          src="/logo-citynside.svg"
          alt="Chargement Citynside..."
          style={{ width: "72px", height: "72px", animation: "cyt-auth-pulse 1.5s ease-in-out infinite" }}
        />
        <style>{`
          @keyframes cyt-auth-pulse {
            0% { transform: scale(0.95); opacity: 0.6; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  if (!authUser) return <AuthView onAuthenticated={handleAuthenticated} />;

  return (
    <div className="cyt-app-layout">
      {/* Fixed Sidebar */}
      <Sidebar
        currentView={currentView}
        displayName={authUser.name}
        onNavigate={(view) => {
          if (view === "new-analysis") {
            handleStartNewAnalysis();
            return;
          }
          setCurrentView(view);
        }}
        favoritesCount={favoritesCount}
        importantNotificationsCount={importantNotificationsCount}
      />

      {/* Main Tablet Content Area */}
      <main className="cyt-main-viewport">
        <div className="main-scroll-inner">
          {authUser.id === LOCAL_DEMO_USER_ID && <button className="demo-warning-banner" type="button" onClick={() => setIsDemoInfoOpen(true)}>
            <AlertTriangle size={19} aria-hidden="true" />
            <span><strong>Compte démo</strong><small>Fonctionnalités limitées · Cliquez pour en savoir plus</small></span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>}

          {currentView === "home" && (
            <HomeView
              analyses={analyses}
              onSelectAnalysis={handleSelectAnalysis}
              onStartNewAnalysis={handleStartNewAnalysis}
              onNavigate={setCurrentView}
              userName={authUser.name}
              userId={authUser.id}
            />
          )}

          {currentView === "new-analysis" && (
            <NewAnalysisView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              currentAnalysis={activeAnalysis}
              onUpdateAnalysis={handleUpdateAnalysis}
              onUpdateRiskAssessment={handleUpdateRiskAssessment}
              onToggleFavorite={handleToggleFav}
              onGoToReport={() => setCurrentView("report")}
              onGoToImpressions={handleGoToImpressions}
            />
          )}

          {currentView === "impressions" && activeAnalysis && (
            <ImpressionsView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analysis={activeAnalysis}
              onSaveImpressions={handleSaveImpressions}
              onBack={() => setCurrentView("new-analysis")}
            />
          )}

          {currentView === "report" && activeAnalysis && (
            <ReportView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analysis={activeAnalysis}
              user={authUser}
              onReportGenerated={() => {
                void createNotification(authUser.id, {
                  id: `report_${activeAnalysis.id}_${Date.now()}`,
                  title: "Rapport PDF généré",
                  description: `Le rapport pour ${activeAnalysis.address}, ${activeAnalysis.city} a été téléchargé.`,
                  kind: "report",
                }).catch((error) => console.warn("Notification de rapport non enregistrée :", error));
              }}
              onBackToEdit={() => setCurrentView("new-analysis")}
            />
          )}

          {(currentView === "enregistrements" || currentView === "favoris") && (
            <EnregistrementsView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analyses={analyses}
              activeTab={currentView === "favoris" ? "favorites" : "history"}
              onSelectAnalysis={handleSelectAnalysis}
              onToggleFavorite={handleToggleFav}
              onDeleteAnalysis={handleDeleteAnalysis}
              onRenameAnalysis={handleRenameAnalysis}
            />
          )}

          {currentView === "comparison" && <ComparisonView analyses={analyses} />}

          {currentView === "notifications" && <NotificationsView isDemo={authUser.id === LOCAL_DEMO_USER_ID} user={authUser} onImportantUnreadChange={setImportantNotificationsCount} />}

          {currentView === "profile" && (
            <ProfileView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analysesCount={analyses.length}
              favoritesCount={favoritesCount}
              user={authUser}
              onLogout={handleLogout}
              onUpdateUser={(updated) => setAuthUser(updated)}
              onProfileSaved={() => {
                void createNotification(authUser.id, {
                  id: `profile_${authUser.id}_${Date.now()}`,
                  title: "Profil modifié",
                  description: "Les informations de votre profil ont été enregistrées.",
                  kind: "system",
                  importance: "important",
                }).then(() => refreshImportantNotificationsCount(authUser.id)).catch((error) => console.warn("Notification de profil non enregistrée :", error));
              }}
              onPasswordChanged={() => {
                const changedAt = new Date();
                void createNotification(authUser.id, {
                  id: `password_changed_${authUser.id}_${changedAt.getTime()}`,
                  title: "Mot de passe modifié",
                  description: `Votre mot de passe a été modifié le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(changedAt)}.`,
                  kind: "system",
                  importance: "important",
                }).then(() => refreshImportantNotificationsCount(authUser.id)).catch((error) => console.warn("Notification de sécurité non enregistrée :", error));
              }}
            />
          )}
        </div>
      </main>

      {isDemoInfoOpen && <div className="demo-info-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDemoInfoOpen(false); }}>
        <section className="demo-info-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-info-title">
          <button className="demo-info-close" type="button" onClick={() => setIsDemoInfoOpen(false)} aria-label="Fermer"><X size={19} /></button>
          <span className="demo-info-icon"><AlertTriangle size={23} /></span>
          <p className="demo-info-eyebrow">MODE DÉCOUVERTE</p>
          <h2 id="demo-info-title">Vous utilisez un compte démo</h2>
          <p className="demo-info-copy">Ce compte permet de découvrir Citynside en parcourant trois exemples de quartiers et leurs données, scores et rapports.</p>
          <div className="demo-info-limits"><strong>Les actions sont limitées</strong><ul><li>La recherche d’une nouvelle adresse est désactivée.</li><li>Le profil, les favoris et les impressions ne peuvent pas être modifiés.</li><li>Les données consultées dans la démo ne sont pas enregistrées.</li></ul></div>
          <button className="demo-info-confirm" type="button" onClick={() => setIsDemoInfoOpen(false)}>Continuer la découverte</button>
        </section>
      </div>}

      <ReleaseNotesModal userId={authUser.id} />

      <style>{`
        .cyt-app-layout {
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-color: var(--color-bg-app);
        }

        .cyt-main-viewport {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          position: relative;
        }

        .main-scroll-inner {
          padding: 32px 36px 48px;
          min-height: 100%;
        }

        .demo-warning-banner{width:100%;display:flex;align-items:center;gap:12px;padding:11px 16px;margin:0 0 22px;border:1px solid #f3b1ad;border-radius:12px;background:#fff0ef;color:#a62b26;text-align:left;cursor:pointer;box-shadow:0 4px 16px rgba(130,35,30,.08)}
        .demo-warning-banner>span{display:flex;flex:1;flex-direction:column;gap:2px}.demo-warning-banner strong{font-size:.84rem}.demo-warning-banner small{font-size:.76rem;color:#9c514a}.demo-warning-banner:hover{background:#ffe8e6;border-color:#e98c86}
        .demo-info-overlay{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:20px;background:rgba(20,35,33,.56);backdrop-filter:blur(3px)}
        .demo-info-dialog{position:relative;width:min(100%,480px);padding:32px;border:1px solid #f1d0cd;border-radius:20px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.2);color:#29433d}
        .demo-info-close{position:absolute;top:14px;right:14px;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;background:#f5f5f4;color:#53635d;cursor:pointer}
        .demo-info-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#fff0ef;color:#bd3932}.demo-info-eyebrow{margin-top:20px;color:#ba3932;font-size:.7rem;font-weight:750;letter-spacing:.1em}.demo-info-dialog h2{margin-top:6px;color:#183b39;font-size:1.55rem;line-height:1.2}.demo-info-copy{margin-top:12px;color:#60716c;font-size:.9rem;line-height:1.6}
        .demo-info-limits{margin-top:20px;padding:16px 18px;border:1px solid #f1e2df;border-radius:12px;background:#fff9f8;font-size:.84rem}.demo-info-limits strong{color:#85332e}.demo-info-limits ul{display:grid;gap:8px;margin:10px 0 0;padding-left:19px;color:#5f6b66;line-height:1.45}
        .demo-info-confirm{width:100%;margin-top:22px;padding:12px 16px;border:0;border-radius:10px;background:#ad342e;color:#fff;font:inherit;font-weight:650;cursor:pointer}.demo-info-confirm:hover{background:#912923}

        @media (min-width: 769px) and (max-width: 1024px) {
          .main-scroll-inner { padding: 24px 22px 40px; }
          .profile-layout { grid-template-columns: 1fr; }
          .risk-nuisance-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .cyt-app-layout { display: block; width: 100%; height: 100dvh; }
          .cyt-main-viewport { width: 100%; height: calc(100dvh - 72px - env(safe-area-inset-bottom)); }
          .main-scroll-inner {
            padding: 18px 14px 28px;
          }
          .demo-warning-banner{margin-bottom:16px}
          .demo-info-dialog{padding:26px 22px}
          .main-scroll-inner > * { min-width: 0; max-width: 100%; }
          .enreg-title, .notif-title, .impressions-title, .comparison-heading h1, .profile-heading h1, .header-main-title { font-size: clamp(1.3rem, 5.4vw, 1.58rem) !important; line-height: 1.18; }
          .comparison-section-heading h2, .comparison-score-card h2, .comparison-empty h2, .risk-nuisance-heading h2, .watch-heading h2, .analysis-empty-state h2 { font-size: clamp(1rem, 4.4vw, 1.2rem) !important; line-height: 1.25; }
          .hero-greeting { font-size: clamp(1.25rem, 5vw, 1.45rem) !important; }
          .section-title { font-size: 1.08rem !important; }
          .enreg-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .enreg-card { min-width: 0; padding: 14px; }
          .notif-card { padding: 13px 14px; gap: 10px; }
          .scores-title { font-size: 1rem !important; }
          .methodology-modal { max-height: calc(100dvh - 28px); overflow-y: auto; }
          .balance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .report-view-wrapper { align-items: flex-start; padding-bottom: 32px; }
          .report-actions-bar { flex-wrap: wrap; gap: 8px; padding: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
