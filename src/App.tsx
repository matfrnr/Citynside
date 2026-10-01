import React, { useEffect, useState } from "react";
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
import { mapProfileRowToAuthUser, supabase } from "./services/supabase";
import {
  type AppView,
  type AuthUser,
  type FieldImpressions,
  LOCAL_DEMO_USER_ID,
  type NeighborhoodAnalysis,
} from "./types";

const LOCAL_DEMO_SESSION_KEY = "citynside_demo_session";

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
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [activeAnalysis, setActiveAnalysis] =
    useState<NeighborhoodAnalysis | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [importantNotificationsCount, setImportantNotificationsCount] = useState(0);

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
      setActiveAnalysis(cached[0] ?? null);
    }

    // 2. Récupération distante depuis Supabase BDD
    if (userId !== LOCAL_DEMO_USER_ID) {
      try {
        const fresh = await fetchAnalyses(userId);
        setAnalyses(fresh);
        if (isInitial) {
          setActiveAnalysis((prev) => prev ?? (fresh[0] ?? null));
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
          const user = await fetchUserProfile(session.user);
          setAuthUser(user);
          await notifyAccountActivated(user.id).catch((err) => console.warn("Notification d’activation non enregistrée :", err));
          await registerCurrentDevice(user.id).catch((err) => console.warn("Vérification du nouvel appareil impossible :", err));
          await refreshImportantNotificationsCount(user.id);
          await loadUserAnalyses(user.id, true);
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
    await loadUserAnalyses(user.id, true);
    setCurrentView("home");
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
    // A new search must start from a genuinely blank state.
    setActiveAnalysis(null);
    setCurrentView("new-analysis");
  };

  // Chaque recherche terminée devient immédiatement une entrée d'historique.
  const handleUpdateAnalysis = (updated: NeighborhoodAnalysis) => {
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

  // Renommer une analyse existante
  const handleRenameAnalysis = async (id: string, newName: string) => {
    if (!authUser) return;
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
    if (!activeAnalysis || !authUser) return;

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
    if (!authUser) return;
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
    if (!authUser) return;
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
              onToggleFavorite={handleToggleFav}
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
              analyses={analyses}
              activeTab={currentView === "favoris" ? "favorites" : "history"}
              onSelectAnalysis={handleSelectAnalysis}
              onToggleFavorite={handleToggleFav}
              onDeleteAnalysis={handleDeleteAnalysis}
              onRenameAnalysis={handleRenameAnalysis}
            />
          )}

          {currentView === "comparison" && <ComparisonView analyses={analyses} />}

          {currentView === "notifications" && <NotificationsView user={authUser} onImportantUnreadChange={setImportantNotificationsCount} />}

          {currentView === "profile" && (
            <ProfileView
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
