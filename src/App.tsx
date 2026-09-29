import React, { useEffect, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { AuthView } from "./components/views/AuthView";
import { EnregistrementsView } from "./components/views/EnregistrementsView";
import { HomeView } from "./components/views/HomeView";
import { ImpressionsView } from "./components/views/ImpressionsView";
import { NewAnalysisView } from "./components/views/NewAnalysisView";
import { NotificationsView } from "./components/views/NotificationsView";
import { ProfileView } from "./components/views/ProfileView";
import { ReportView } from "./components/views/ReportView";
import {
  deleteAnalysis,
  getStoredAnalyses,
  saveAnalysis,
  toggleFavorite,
} from "./services/storage";
import { mapSupabaseUser, supabase } from "./services/supabase";
import {
  type AppView,
  type AuthUser,
  type FieldImpressions,
  LOCAL_DEMO_USER_ID,
  type NeighborhoodAnalysis,
} from "./types";

const LOCAL_DEMO_SESSION_KEY = "citynside_demo_session";

export const App: React.FC = () => {
  const [analyses, setAnalyses] = useState<NeighborhoodAnalysis[]>([]);
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [activeAnalysis, setActiveAnalysis] =
    useState<NeighborhoodAnalysis | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (localStorage.getItem(LOCAL_DEMO_SESSION_KEY) === "active") {
      const demoUser: AuthUser = {
        id: LOCAL_DEMO_USER_ID,
        name: "Compte de démonstration",
        email: "demo@citynside.local",
      };
      setAuthUser(demoUser);
      const loaded = getStoredAnalyses(demoUser.id);
      setAnalyses(loaded);
      setActiveAnalysis(loaded[0] ?? null);
      setAuthChecking(false);
      return () => {
        cancelled = true;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (cancelled) return;
        if (session?.user && !error) {
          const user = mapSupabaseUser(session.user);
          setAuthUser(user);
          const loaded = getStoredAnalyses(user.id);
          setAnalyses(loaded);
          setActiveAnalysis(loaded[0] ?? null);
        }
        setAuthChecking(false);
      })
      .catch(() => {
        if (!cancelled) setAuthChecking(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (localStorage.getItem(LOCAL_DEMO_SESSION_KEY) === "active") return;
      if (session?.user) {
        const user = mapSupabaseUser(session.user);
        setAuthUser(user);
        const loaded = getStoredAnalyses(user.id);
        setAnalyses(loaded);
        setActiveAnalysis(loaded[0] ?? null);
      } else {
        setAuthUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthenticated = (user: AuthUser) => {
    if (user.id === LOCAL_DEMO_USER_ID) {
      localStorage.setItem(LOCAL_DEMO_SESSION_KEY, "active");
    }
    setAuthUser(user);
    const loaded = getStoredAnalyses(user.id);
    setAnalyses(loaded);
    setActiveAnalysis(loaded[0] ?? null);
    setCurrentView("home");
  };

  const handleLogout = async () => {
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
    // A new search must start from a genuinely blank state.
    setActiveAnalysis(null);
    setCurrentView("new-analysis");
  };

  const handleUpdateAnalysis = (updated: NeighborhoodAnalysis) => {
    if (!authUser) return;
    setActiveAnalysis(updated);
    saveAnalysis(updated, authUser.id);
    setAnalyses(getStoredAnalyses(authUser.id));
  };

  const handleGoToImpressions = () => {
    setCurrentView("impressions");
  };

  const handleSaveImpressions = (impressions: FieldImpressions) => {
    if (!activeAnalysis || !authUser) return;

    const updated: NeighborhoodAnalysis = {
      ...activeAnalysis,
      impressions,
    };

    setActiveAnalysis(updated);
    saveAnalysis(updated, authUser.id);
    setAnalyses(getStoredAnalyses(authUser.id));
    setCurrentView("report");
  };

  const handleToggleFav = (id: string) => {
    if (!authUser) return;
    toggleFavorite(id, authUser.id);
    const updatedList = getStoredAnalyses(authUser.id);
    setAnalyses(updatedList);
    if (activeAnalysis && activeAnalysis.id === id) {
      setActiveAnalysis({
        ...activeAnalysis,
        isFavorite: !activeAnalysis.isFavorite,
      });
    }
  };

  const handleDeleteAnalysis = (id: string) => {
    if (!authUser) return;
    deleteAnalysis(id, authUser.id);
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
        className="auth-checking"
        role="status"
        aria-label="Vérification de la session"
      >
        <span className="auth-checking-mark">C</span>
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
      />

      {/* Main Tablet Content Area */}
      <main className="cyt-main-viewport">
        <div className="main-scroll-inner">
          {currentView === "home" && (
            <HomeView
              analyses={analyses}
              onSelectAnalysis={handleSelectAnalysis}
              onStartNewAnalysis={handleStartNewAnalysis}
              onToggleFavorite={handleToggleFav}
              onNavigate={setCurrentView}
              userName={authUser.name}
            />
          )}

          {currentView === "new-analysis" && (
            <NewAnalysisView
              currentAnalysis={activeAnalysis}
              onUpdateAnalysis={handleUpdateAnalysis}
              onGoToImpressions={handleGoToImpressions}
            />
          )}

          {currentView === "impressions" && activeAnalysis && (
            <ImpressionsView
              analysis={activeAnalysis}
              onSaveImpressions={handleSaveImpressions}
              onBack={() => setCurrentView("new-analysis")}
            />
          )}

          {currentView === "report" && activeAnalysis && (
            <ReportView
              analysis={activeAnalysis}
              onBackToEdit={() => setCurrentView("new-analysis")}
            />
          )}

          {currentView === "enregistrements" && (
            <EnregistrementsView
              analyses={analyses}
              onSelectAnalysis={handleSelectAnalysis}
              onToggleFavorite={handleToggleFav}
              onDeleteAnalysis={handleDeleteAnalysis}
            />
          )}

          {currentView === "notifications" && <NotificationsView />}

          {currentView === "profile" && (
            <ProfileView
              analysesCount={analyses.length}
              favoritesCount={favoritesCount}
              user={authUser}
              onLogout={handleLogout}
              onUpdateUser={(updated) => setAuthUser(updated)}
            />
          )}
        </div>
      </main>

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

        @media (max-width: 768px) {
          .main-scroll-inner {
            padding: 20px 16px 36px;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
