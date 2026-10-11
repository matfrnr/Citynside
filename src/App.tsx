import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { Sidebar } from "./components/layout/Sidebar";
import { AuthView } from "./components/views/AuthView";
import { ClientDossiersView } from "./components/views/ClientDossiersView";
import { EnregistrementsView } from "./components/views/EnregistrementsView";
import { ComparisonView } from "./components/views/ComparisonView";
import { HomeView } from "./components/views/HomeView";
import { ImpressionsView } from "./components/views/ImpressionsView";
import { NewAnalysisView } from "./components/views/NewAnalysisView";
import { NotificationsView } from "./components/views/NotificationsView";
import { ProfileView } from "./components/views/ProfileView";
import { PersonalisationView } from "./components/views/PersonalisationView";
import { ProfileSetupModal } from "./components/profile/ProfileSetupModal";
import { needsProfileSetup } from "./services/profileSetup";
import { ReportView } from "./components/views/ReportView";
import { ReleaseNotesModal } from "./components/release/ReleaseNotesModal";
import { clearReleaseNotesContinueState } from "./config/releaseNotes";
import { fetchUserProfile } from "./services/profile";
import { DEFAULT_USER_PREFERENCES, fetchUserPreferences, loadUserPreferences, saveUserPreferences, type UserPreferences } from "./services/userPreferences";
import { createNotification, fetchNotifications } from "./services/notifications";
import { registerCurrentDevice } from "./services/deviceSession";
import {
  claimNewAppSession,
  releaseAppSession,
  restoreAppSession,
  watchAppSession,
  type ExclusiveSession,
} from "./services/exclusiveSession";
import {
  deleteAnalysis,
  fetchAnalyses,
  getStoredAnalyses,
  renameAnalysis,
  saveDemoAirQuality,
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
  "home", "new-analysis", "client-dossiers", "impressions", "report", "enregistrements",
  "favoris", "comparison", "notifications", "personalisation", "profile",
];

const readViewFromUrl = (): AppView => {
  const requested = new URLSearchParams(window.location.search).get("view");
  return APP_VIEWS.includes(requested as AppView) ? requested as AppView : "home";
};

const resetUrlToHome = () => {
  const url = new URL(window.location.href);
  // L'application ne route pas par chemin : /analyse est un ancien chemin
  // direct et doit aussi disparaître à la déconnexion.
  url.pathname = "/";
  url.searchParams.delete("view");
  url.searchParams.delete("analysis");
  window.history.replaceState(window.history.state, "", url);
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
  const [authNotice, setAuthNotice] = useState("");
  const [dataSyncError, setDataSyncError] = useState("");
  const [importantNotificationsSnapshot, setImportantNotificationsSnapshot] = useState({ userId: null as string | null, count: 0 });
  const [isDemoInfoOpen, setIsDemoInfoOpen] = useState(false);
  const [isProfileSetupOpen, setIsProfileSetupOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const userPreferencesRevisionRef = useRef(0);
  const userNavigationRef = useRef<{ view: AppView; analysisId: string | null } | null>(null);
  const authUserRef = useRef<AuthUser | null>(null);
  const exclusiveSessionRef = useRef<ExclusiveSession | null>(null);
  const stopSessionWatchRef = useRef<(() => void) | null>(null);
  const authUserId = authUser?.id ?? null;
  const handleUserPreferencesChange = useCallback((preferences: UserPreferences) => {
    userPreferencesRevisionRef.current += 1;
    setUserPreferences(preferences);
  }, []);
  const activeAnalysisId = activeAnalysis?.id ?? null;
  const importantNotificationsCount = authUserId === importantNotificationsSnapshot.userId
    ? importantNotificationsSnapshot.count
    : 0;
  const navigateTo = (view: AppView, analysisId: string | null = null) => {
    userNavigationRef.current = { view, analysisId };
    setCurrentView(view);
  };

  const reportDataSyncError = (error: unknown) => {
    console.error("Enregistrement des données du compte impossible :", error);
    setDataSyncError("Une modification n’a pas pu être enregistrée sur votre compte. Vérifiez votre connexion puis réessayez.");
  };

  const handleSidebarCollapsedChange = (sidebarCollapsed: boolean) => {
    const nextPreferences = { ...userPreferences, sidebarCollapsed };
    handleUserPreferencesChange(nextPreferences);
    if (!authUser) return;
    void saveUserPreferences(authUser.id, nextPreferences).then(() => setDataSyncError("")).catch(reportDataSyncError);
  };

  useEffect(() => { authUserRef.current = authUser; }, [authUser]);

  const stopSessionWatch = useCallback(() => {
    stopSessionWatchRef.current?.();
    stopSessionWatchRef.current = null;
    exclusiveSessionRef.current = null;
  }, []);

  const watchExclusiveSession = useCallback((lock: ExclusiveSession) => {
    const startWatching = (currentLock: ExclusiveSession) => {
      if (exclusiveSessionRef.current?.sessionId === currentLock.sessionId) return;
      stopSessionWatch();
      exclusiveSessionRef.current = currentLock;
      stopSessionWatchRef.current = watchAppSession(currentLock, (replacement) => {
        if (replacement) {
          startWatching(replacement);
          return;
        }
        setAuthNotice("Votre compte a été connecté sur un autre appareil. Cette session a été fermée.");
        resetUrlToHome();
        userNavigationRef.current = null;
        void supabase.auth.signOut({ scope: "local" }).catch(() => {
          setAuthUser(null);
          setAuthChecking(false);
        });
      });
    };
    startWatching(lock);
  }, [stopSessionWatch]);

  useEffect(() => {
    if (authChecking) return;
    if (!authUserId) {
      resetUrlToHome();
      return;
    }
    const url = new URL(window.location.href);
    if (currentView === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", currentView);

    if (["report", "impressions", "new-analysis"].includes(currentView) && activeAnalysisId) {
      url.searchParams.set("analysis", activeAnalysisId);
    } else {
      url.searchParams.delete("analysis");
    }
    window.history.replaceState(window.history.state, "", url);
  }, [activeAnalysisId, authChecking, authUserId, currentView]);

  const refreshImportantNotificationsCount = async (userId: string) => {
    try {
      const items = await fetchNotifications(userId);
      setImportantNotificationsSnapshot({
        userId,
        count: items.filter((item) => item.importance === "important" && !item.read).length,
      });
    } catch (error) {
      console.warn("Compteur de notifications indisponible :", error);
    }
  };

  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    void fetchNotifications(authUserId).then((items) => {
      if (cancelled) return;
      setImportantNotificationsSnapshot({
        userId: authUserId,
        count: items.filter((item) => item.importance === "important" && !item.read).length,
      });
    }).catch((error) => {
      if (!cancelled) console.warn("Compteur de notifications indisponible :", error);
    });
    return () => { cancelled = true; };
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId || authUserId === LOCAL_DEMO_USER_ID) return;
    let cancelled = false;
    const revisionAtLoad = userPreferencesRevisionRef.current;
    void fetchUserPreferences(authUserId).then((preferences) => {
      if (cancelled || userPreferencesRevisionRef.current !== revisionAtLoad) return;
      setUserPreferences(preferences);
      if (!userNavigationRef.current && !new URLSearchParams(window.location.search).has("view")) {
        setCurrentView(preferences.startView);
      }
    }).catch((error) => {
      if (!cancelled) console.warn("Chargement des préférences Supabase impossible :", error);
    });
    return () => { cancelled = true; };
  }, [authUserId]);

  const loadUserAnalyses = async (
    userId: string,
    isInitial = false,
    navigationOverride?: { view: AppView; analysisId: string | null },
  ) => {
    // 1. Instatané depuis le cache local (vide pour un nouveau compte réel)
    const cached = getStoredAnalyses(userId);
    setAnalyses(cached);
    const requestedAnalysisId = navigationOverride
      ? navigationOverride.analysisId
      : new URLSearchParams(window.location.search).get("analysis");
    const requestedView = navigationOverride?.view ?? readViewFromUrl();
    if (isInitial) {
      const blankNewAnalysis = userId !== LOCAL_DEMO_USER_ID && requestedView === "new-analysis" && !requestedAnalysisId;
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
          // Une navigation peut avoir lieu pendant le chargement distant.
          // Elle prévaut sur la vue et l'analyse lues au début de la requête.
          const latestNavigation = userNavigationRef.current ?? navigationOverride;
          const latestRequestedAnalysisId = latestNavigation
            ? latestNavigation.analysisId
            : requestedAnalysisId;
          const latestRequestedView = latestNavigation?.view ?? requestedView;
          const blankNewAnalysis = userId !== LOCAL_DEMO_USER_ID && latestRequestedView === "new-analysis" && !latestRequestedAnalysisId;
          setActiveAnalysis((prev) => blankNewAnalysis
            ? null
            : fresh.find((analysis) => analysis.id === latestRequestedAnalysisId) ??
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
          let lock: ExclusiveSession | null;
          try {
            lock = await restoreAppSession(session.user.id, session.access_token);
          } catch (lockError) {
            if (cancelled) return;
            console.error("Impossible de vérifier la session active :", lockError);
            setAuthNotice("La vérification de session est indisponible. Appliquez la migration Supabase avant de vous reconnecter.");
            resetUrlToHome();
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            setAuthChecking(false);
            return;
          }
          if (cancelled) return;
          if (!lock) {
            setAuthNotice("Votre compte a été connecté sur un autre appareil. Connectez-vous à nouveau pour reprendre la session.");
            resetUrlToHome();
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            setAuthChecking(false);
            return;
          }
          setAuthNotice("");
          watchExclusiveSession(lock);

          // Afficher tout de suite l'application avec les informations déjà
          // disponibles dans la session. Les appels Supabase secondaires ne
          // doivent pas bloquer le premier affichage après un rechargement.
          const user = mapSupabaseUser(session.user);
          const preferences = loadUserPreferences(user.id);
          setUserPreferences(preferences);
          if (!userNavigationRef.current && !new URLSearchParams(window.location.search).has("view")) {
            setCurrentView(preferences.startView);
          }
          setAuthUser(user);
          void loadUserAnalyses(user.id, true, userNavigationRef.current ?? undefined);
          setAuthChecking(false);

          void Promise.allSettled([
            fetchUserProfile(session.user).then((profile) => {
              if (!cancelled) {
                setAuthUser(profile);
                setIsProfileSetupOpen(needsProfileSetup(profile));
              }
            }),
            notifyAccountActivated(user.id),
            registerCurrentDevice(user.id),
          ]);
          return;
        }
        // Une session absente (par exemple après l'effacement des données du
        // navigateur) doit aussi effacer la vue privée conservée en mémoire.
        resetUrlToHome();
        userNavigationRef.current = null;
        setCurrentView("home");
        setAuthChecking(false);
      })
      .catch((sessionError) => {
        if (!cancelled) {
          console.error("Impossible de restaurer la session :", sessionError);
          setAuthNotice("La vérification de session est indisponible. Réessayez après avoir vérifié votre connexion.");
          setAuthChecking(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      // Laisser le verrou interne d’authentification Supabase se libérer avant
      // d’effectuer des requêtes depuis ses événements.
      window.setTimeout(() => {
        if (cancelled) return;
        void (async () => {
          if (localStorage.getItem(LOCAL_DEMO_SESSION_KEY) === "active") return;

          // Ne jamais écraser l'écran ou l'analyse en cours lors d'un simple rafraîchissement de token (ex: Alt+Tab)
          if (event === "TOKEN_REFRESHED") return;
          // La restauration initiale est gérée par getSession ci-dessus, sans
          // bloquer l'affichage sur les appels de profil et d'historique.
          if (event === "INITIAL_SESSION") return;
          if (event === "SIGNED_IN" && session?.user) {
            try {
              const lock = await claimNewAppSession(session.user.id, session.access_token);
              watchExclusiveSession(lock);
              try {
                await supabase.auth.signOut({ scope: "others" });
              } catch (revokeError) {
                console.warn("La révocation des autres sessions a échoué :", revokeError);
              }

              const user = await fetchUserProfile(session.user);
              const accountChanged = authUserRef.current?.id !== user.id;
              authUserRef.current = user;
              if (accountChanged) {
                resetUrlToHome();
                userNavigationRef.current = null;
                setActiveAnalysis(null);
                const preferences = loadUserPreferences(user.id);
                setUserPreferences(preferences);
                setCurrentView(preferences.startView);
              }
              setAuthUser(user);
              setIsProfileSetupOpen(needsProfileSetup(user));
              await loadUserAnalyses(user.id, accountChanged);
            } catch (sessionError) {
              console.error("Impossible d’activer la session après connexion :", sessionError);
              setAuthNotice("La vérification de session est indisponible. Vérifiez la configuration Supabase avant de vous reconnecter.");
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            }
            return;
          }

          if (session?.user) {
            try {
              const lock = await restoreAppSession(session.user.id, session.access_token);
              if (!lock) {
                setAuthNotice("Votre compte a été connecté sur un autre appareil. Cette session a été fermée.");
                await supabase.auth.signOut({ scope: "local" });
                return;
              }
              watchExclusiveSession(lock);
              const user = await fetchUserProfile(session.user);
              setAuthUser(user);
              await loadUserAnalyses(user.id, false);
            } catch (sessionError) {
              console.error("Impossible de maintenir la session active :", sessionError);
              setAuthNotice("La vérification de session est indisponible. Connectez-vous à nouveau après vérification de la configuration Supabase.");
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            }
          } else {
            stopSessionWatch();
            if (event === "SIGNED_OUT") {
              resetUrlToHome();
              setCurrentView("home");
            }
            userNavigationRef.current = null;
            clearReleaseNotesContinueState();
            setAuthUser(null);
            setIsProfileSetupOpen(false);
            setUserPreferences(DEFAULT_USER_PREFERENCES);
            setAnalyses([]);
            setActiveAnalysis(null);
          }
        })();
      }, 0);
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
      stopSessionWatch();
    };
  }, [stopSessionWatch, watchExclusiveSession]);

  const handleAuthenticated = async (user: AuthUser, lock?: ExclusiveSession) => {
    setAuthNotice("");
    if (lock) watchExclusiveSession(lock);
    const userNavigation = userNavigationRef.current;
    if (userNavigation) {
      setCurrentView(userNavigation.view);
    } else {
      resetUrlToHome();
      setCurrentView("home");
    }
    setActiveAnalysis(null);
    if (user.id === LOCAL_DEMO_USER_ID) {
      localStorage.setItem(LOCAL_DEMO_SESSION_KEY, "active");
      setUserPreferences(DEFAULT_USER_PREFERENCES);
      setAuthUser(user);
    } else {
      const preferences = loadUserPreferences(user.id);
      setUserPreferences(preferences);
      if (!userNavigation) setCurrentView(preferences.startView);
      const freshUser = await fetchUserProfile(user);
      setAuthUser(freshUser);
      setIsProfileSetupOpen(needsProfileSetup(freshUser));
      await notifyAccountActivated(freshUser.id).catch((err) => console.warn("Notification d’activation non enregistrée :", err));
      await registerCurrentDevice(freshUser.id).catch((err) => console.warn("Vérification du nouvel appareil impossible :", err));
      await refreshImportantNotificationsCount(freshUser.id);
    }
    const latestNavigation = userNavigationRef.current ?? userNavigation;
    await loadUserAnalyses(user.id, true, latestNavigation ?? undefined);
    if (userNavigationRef.current === latestNavigation) userNavigationRef.current = null;
    // setCurrentView removed to avoid overriding

  };

  const handleLogout = async () => {
    // Nettoyer synchroniquement l'URL avant signOut : une reconnexion rapide
    // ne pourra pas relire la vue privée précédente avant l'effet React.
    resetUrlToHome();
    userNavigationRef.current = null;
    setCurrentView("home");
    setActiveAnalysis(null);
    if (authUser) clearReleaseNotesContinueState(authUser.id);
    if (authUser?.id === LOCAL_DEMO_USER_ID) {
      localStorage.removeItem(LOCAL_DEMO_SESSION_KEY);
    } else {
      try {
        if (exclusiveSessionRef.current) await releaseAppSession(exclusiveSessionRef.current);
      } catch {
        // La session locale est fermée même si Supabase est indisponible.
      } finally {
        stopSessionWatch();
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
    }
    setAuthUser(null);
    setUserPreferences(DEFAULT_USER_PREFERENCES);
    setIsProfileSetupOpen(false);
    setAnalyses([]);
    setActiveAnalysis(null);
  };

  const handleSelectAnalysis = (analysis: NeighborhoodAnalysis) => {
    setActiveAnalysis(analysis);
    navigateTo("report", analysis.id);
  };

  const handleStartNewAnalysis = () => {
    let selectedAnalysisId: string | null = null;
    if (authUser?.id === LOCAL_DEMO_USER_ID) {
      const demoExamples = analyses.length ? analyses : getStoredAnalyses(LOCAL_DEMO_USER_ID);
      const currentExample = activeAnalysis && demoExamples.some((item) => item.id === activeAnalysis.id)
        ? activeAnalysis
        : null;
      const defaultExample = demoExamples.find((item) => item.id === "aigle_38000") ?? demoExamples[0] ?? null;
      const selectedExample = currentExample ?? defaultExample;
      setActiveAnalysis(selectedExample);
      selectedAnalysisId = selectedExample?.id ?? null;
    } else {
      // A new search must start from a genuinely blank state.
      setActiveAnalysis(null);
    }
    navigateTo("new-analysis", selectedAnalysisId);
  };

  // Chaque recherche terminée devient immédiatement une entrée d'historique.
  const handleUpdateAnalysis = (updated: NeighborhoodAnalysis) => {
    if (authUser?.id === LOCAL_DEMO_USER_ID) {
      // Demo examples may be enriched from the same public sources as a live
      // analysis. Keep the air-quality snapshot across page refreshes too.
      saveDemoAirQuality(updated.id, updated.airQuality);
      setActiveAnalysis(updated);
      return;
    }
    setActiveAnalysis(updated);
    if (authUser) {
      void saveAnalysis(updated, authUser.id).then(() => {
        setAnalyses(getStoredAnalyses(authUser.id));
        setDataSyncError("");
      }).catch(reportDataSyncError);
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

  const handleUpdateRiskAssessment = async (
    analysisId: string,
    riskAssessment: RiskAssessment,
    airQuality?: import("./services/airQualityApi").AirQualityData | null,
    analysisSnapshot?: NeighborhoodAnalysis,
  ) => {
    setActiveAnalysis((current) => {
      if (current && current.id === analysisId) {
        return {
          ...current,
          riskAssessment,
          airQuality: airQuality ?? current.airQuality,
        };
      }
      return current;
    });

    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;

    const storedList = getStoredAnalyses(authUser.id);
    const stored = storedList.find((analysis) => analysis.id === analysisId);
    const base = analysisSnapshot?.id === analysisId
      ? analysisSnapshot
      : (stored ?? activeAnalysis);

    if (base && base.id === analysisId) {
      const updated = { ...base, riskAssessment, airQuality: airQuality ?? base.airQuality };
      try {
        await saveAnalysis(updated, authUser.id);
        setAnalyses(getStoredAnalyses(authUser.id));
        setDataSyncError("");
      } catch (error) {
        reportDataSyncError(error);
      }
    }
  };

  // Renommer une analyse existante
  const handleRenameAnalysis = async (id: string, newName: string) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    try {
      await renameAnalysis(id, newName, authUser.id);
      const updatedList = getStoredAnalyses(authUser.id);
      setAnalyses(updatedList);
      if (activeAnalysis?.id === id) {
        setActiveAnalysis({ ...activeAnalysis, neighborhoodName: newName });
      }
      setDataSyncError("");
    } catch (error) {
      reportDataSyncError(error);
    }
  };

  const handleGoToImpressions = () => {
    navigateTo("impressions", activeAnalysis?.id ?? null);
  };

  const handleSaveImpressions = async (impressions: FieldImpressions) => {
    if (!activeAnalysis || !authUser || authUser.id === LOCAL_DEMO_USER_ID) return;

    const updated: NeighborhoodAnalysis = {
      ...activeAnalysis,
      impressions,
    };

    setActiveAnalysis(updated);
    try {
      await saveAnalysis(updated, authUser.id);
      setAnalyses(getStoredAnalyses(authUser.id));
      setDataSyncError("");
      navigateTo("report", updated.id);
    } catch (error) {
      reportDataSyncError(error);
    }
  };

  const handleToggleFav = async (id: string) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    try {
      await toggleFavorite(id, authUser.id);
      const updatedList = getStoredAnalyses(authUser.id);
      setAnalyses(updatedList);
      const updatedActive = updatedList.find((analysis) => analysis.id === id);
      if (activeAnalysis?.id === id && updatedActive) setActiveAnalysis(updatedActive);
      setDataSyncError("");
    } catch (error) {
      reportDataSyncError(error);
    }
  };

  const handleDeleteAnalysis = async (id: string) => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    try {
      await deleteAnalysis(id, authUser.id);
      const updatedList = getStoredAnalyses(authUser.id);
      setAnalyses(updatedList);
      if (activeAnalysis?.id === id) setActiveAnalysis(null);
      setDataSyncError("");
    } catch (error) {
      reportDataSyncError(error);
    }
  };

  const handleClearSavedTab = async (ids: string[], tab: "history" | "favorites") => {
    if (!authUser || authUser.id === LOCAL_DEMO_USER_ID) return;
    try {
      if (tab === "history") {
        await Promise.all(ids.map((id) => deleteAnalysis(id, authUser.id)));
        if (activeAnalysis && ids.includes(activeAnalysis.id)) setActiveAnalysis(null);
      } else {
        await Promise.all(ids.map((id) => toggleFavorite(id, authUser.id)));
        if (activeAnalysis && ids.includes(activeAnalysis.id)) {
          setActiveAnalysis({ ...activeAnalysis, isFavorite: false });
        }
      }
      setAnalyses(getStoredAnalyses(authUser.id));
      setDataSyncError("");
    } catch (error) {
      setAnalyses(getStoredAnalyses(authUser.id));
      reportDataSyncError(error);
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

  if (!authUser) return <AuthView onAuthenticated={handleAuthenticated} notice={authNotice} />;

  return (
    <div className={`cyt-app-layout${userPreferences.reduceMotion ? " reduce-motion" : ""}`}>
      {/* Fixed Sidebar */}
      <Sidebar
        currentView={currentView}
        displayName={authUser.name}
        userId={authUser.id}
        isCollapsed={userPreferences.sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsedChange}
        onNavigate={(view) => {
          if (view === "new-analysis") {
            handleStartNewAnalysis();
            return;
          }
          navigateTo(view);
        }}
        favoritesCount={favoritesCount}
        importantNotificationsCount={importantNotificationsCount}
        showNotificationCount={userPreferences.showNotificationCount}
      />

      {/* Main Tablet Content Area */}
      <main className="cyt-main-viewport">
        <div className="main-scroll-inner">
          {dataSyncError && <div className="data-sync-error" role="alert"><span>{dataSyncError}</span><button type="button" onClick={() => setDataSyncError("")} aria-label="Fermer le message"><X size={17} /></button></div>}
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
              onNavigate={navigateTo}
              userName={authUser.name}
              userId={authUser.id}
            />
          )}

          {currentView === "new-analysis" && (
            <NewAnalysisView
              userId={authUser.id}
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              mapControlsHiddenByDefault={userPreferences.hideMapControlsByDefault}
              mapZoom={userPreferences.mapZoom}
              reduceMotion={userPreferences.reduceMotion}
              defaultScoreProfile={userPreferences.defaultScoreProfile}
              defaultCategoryFilter={userPreferences.defaultCategoryFilter}
              distanceUnit={userPreferences.distanceUnit}
              currentAnalysis={activeAnalysis}
              onUpdateAnalysis={handleUpdateAnalysis}
              onUpdateRiskAssessment={handleUpdateRiskAssessment}
              onToggleFavorite={handleToggleFav}
              onGoToReport={() => navigateTo("report", activeAnalysis?.id ?? null)}
              onGoToImpressions={handleGoToImpressions}
            />
          )}

          {currentView === "client-dossiers" && (
            <ClientDossiersView
              key={authUser.id}
              userId={authUser.id}
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analyses={analyses}
            />
          )}

          {currentView === "impressions" && activeAnalysis && (
            <ImpressionsView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analysis={activeAnalysis}
              onSaveImpressions={handleSaveImpressions}
              onBack={() => navigateTo("new-analysis", activeAnalysis?.id ?? null)}
            />
          )}

          {currentView === "report" && activeAnalysis && (
            <ReportView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analysis={activeAnalysis}
              user={authUser}
              distanceUnit={userPreferences.distanceUnit}
              onReportGenerated={() => {
                void createNotification(authUser.id, {
                  id: `report_${activeAnalysis.id}_${Date.now()}`,
                  title: "Rapport PDF généré",
                  description: `Le rapport pour ${activeAnalysis.address}, ${activeAnalysis.city} a été téléchargé.`,
                  kind: "report",
                }).catch((error) => console.warn("Notification de rapport non enregistrée :", error));
              }}
              onBackToEdit={() => navigateTo("new-analysis", activeAnalysis?.id ?? null)}
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
              onClearAll={handleClearSavedTab}
            />
          )}

          {currentView === "comparison" && <ComparisonView analyses={analyses} />}

          {currentView === "notifications" && <NotificationsView isDemo={authUser.id === LOCAL_DEMO_USER_ID} user={authUser} preferences={userPreferences} onImportantUnreadChange={(count) => setImportantNotificationsSnapshot({ userId: authUser.id, count })} />}

          {currentView === "personalisation" && <PersonalisationView userId={authUser.id} onUserPreferencesChange={handleUserPreferencesChange} />}

          {currentView === "profile" && (
            <ProfileView
              isDemo={authUser.id === LOCAL_DEMO_USER_ID}
              analysesCount={analyses.length}
              favoritesCount={favoritesCount}
              user={authUser}
              preferences={userPreferences}
              onUserPreferencesChange={(preferences) => {
                handleUserPreferencesChange(preferences);
                void saveUserPreferences(authUser.id, preferences).catch(reportDataSyncError);
              }}
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

      {isProfileSetupOpen && <ProfileSetupModal
        user={authUser}
        onComplete={(updatedUser) => { setAuthUser(updatedUser); setIsProfileSetupOpen(false); }}
        onDismiss={() => setIsProfileSetupOpen(false)}
      />}

      <style>{`
        .cyt-app-layout.reduce-motion *,
        .cyt-app-layout.reduce-motion *::before,
        .cyt-app-layout.reduce-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
        }

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

        .data-sync-error{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 18px;padding:11px 14px;border:1px solid #f0c8c3;border-radius:9px;background:#fff3f1;color:#922c25;font-size:.82rem;line-height:1.45}
        .data-sync-error span{min-width:0;overflow-wrap:anywhere}
        .data-sync-error button{display:grid;place-items:center;flex:0 0 auto;width:28px;height:28px;margin:-4px -5px 0 0;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer}
        .data-sync-error button:hover{background:rgba(146,44,37,.08)}

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
