import { LOCAL_DEMO_USER_ID } from "../types";
import { supabase } from "./supabase";

export type UserStartView = "home" | "new-analysis";
export type MapZoomPreference = 12 | 13 | 14 | 15;
export type DefaultScoreProfile = "none" | "family" | "student" | "senior" | "investor";
export type DefaultCategoryFilter = "transports" | "commerces" | "ecoles" | "sante" | "espaces_verts" | "stationnement" | "services_publics" | "tranquillite" | "loisirs" | null;
export type DistanceUnit = "meters" | "walking-minutes";

export interface UserPreferences {
  startView: UserStartView;
  sidebarCollapsed: boolean;
  showNotificationCount: boolean;
  showAnalysisNotifications: boolean;
  showReportNotifications: boolean;
  showTerritoryNotifications: boolean;
  showSystemNotifications: boolean;
  hideMapControlsByDefault: boolean;
  mapZoom: MapZoomPreference;
  reduceMotion: boolean;
  defaultScoreProfile: DefaultScoreProfile;
  defaultCategoryFilter: DefaultCategoryFilter;
  distanceUnit: DistanceUnit;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  startView: "home",
  sidebarCollapsed: false,
  showNotificationCount: true,
  showAnalysisNotifications: true,
  showReportNotifications: true,
  showTerritoryNotifications: true,
  showSystemNotifications: true,
  hideMapControlsByDefault: true,
  mapZoom: 13,
  reduceMotion: false,
  defaultScoreProfile: "none",
  defaultCategoryFilter: null,
  distanceUnit: "meters",
};

function isDefaultUserPreferences(preferences: UserPreferences): boolean {
  return JSON.stringify(preferences) === JSON.stringify(DEFAULT_USER_PREFERENCES);
}

const preferencesKey = (userId: string) => `citynside_preferences_${userId}`;
const pendingPreferencesKey = (userId: string) => `citynside_preferences_pending_${userId}`;
const migratedPreferencesKey = (userId: string) => `citynside_preferences_migrated_${userId}`;
const legacySidebarCollapsedKey = "citynside_sidebar_collapsed";
const preferenceSaveQueues = new Map<string, Promise<void>>();

function normalizeUserPreferences(value: unknown): UserPreferences {
  const parsed = value && typeof value === "object" ? value as Partial<UserPreferences> : {};
  return {
    startView: parsed.startView === "new-analysis" ? "new-analysis" : "home",
    sidebarCollapsed: typeof parsed.sidebarCollapsed === "boolean"
      ? parsed.sidebarCollapsed
      : DEFAULT_USER_PREFERENCES.sidebarCollapsed,
    showNotificationCount: typeof parsed.showNotificationCount === "boolean"
      ? parsed.showNotificationCount
      : DEFAULT_USER_PREFERENCES.showNotificationCount,
    showAnalysisNotifications: typeof parsed.showAnalysisNotifications === "boolean"
      ? parsed.showAnalysisNotifications
      : DEFAULT_USER_PREFERENCES.showAnalysisNotifications,
    showReportNotifications: typeof parsed.showReportNotifications === "boolean"
      ? parsed.showReportNotifications
      : DEFAULT_USER_PREFERENCES.showReportNotifications,
    showTerritoryNotifications: typeof parsed.showTerritoryNotifications === "boolean"
      ? parsed.showTerritoryNotifications
      : DEFAULT_USER_PREFERENCES.showTerritoryNotifications,
    showSystemNotifications: typeof parsed.showSystemNotifications === "boolean"
      ? parsed.showSystemNotifications
      : DEFAULT_USER_PREFERENCES.showSystemNotifications,
    hideMapControlsByDefault: typeof parsed.hideMapControlsByDefault === "boolean"
      ? parsed.hideMapControlsByDefault
      : DEFAULT_USER_PREFERENCES.hideMapControlsByDefault,
    mapZoom: [12, 13, 14, 15].includes(parsed.mapZoom as number)
      ? parsed.mapZoom as MapZoomPreference
      : DEFAULT_USER_PREFERENCES.mapZoom,
    reduceMotion: typeof parsed.reduceMotion === "boolean"
      ? parsed.reduceMotion
      : DEFAULT_USER_PREFERENCES.reduceMotion,
    defaultScoreProfile: ["none", "family", "student", "senior", "investor"].includes(parsed.defaultScoreProfile as string)
      ? parsed.defaultScoreProfile as DefaultScoreProfile
      : DEFAULT_USER_PREFERENCES.defaultScoreProfile,
    defaultCategoryFilter: ["transports", "commerces", "ecoles", "sante", "espaces_verts", "stationnement", "services_publics", "tranquillite", "loisirs"].includes(parsed.defaultCategoryFilter as string)
      ? parsed.defaultCategoryFilter as DefaultCategoryFilter
      : null,
    distanceUnit: parsed.distanceUnit === "walking-minutes" ? "walking-minutes" : "meters",
  };
}

function cacheUserPreferences(userId: string, preferences: UserPreferences): void {
  try { localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences)); } catch { /* Supabase reste la source de vérité. */ }
}

export function loadUserPreferences(userId: string): UserPreferences {
  try {
    const saved = localStorage.getItem(preferencesKey(userId));
    const parsed = saved ? JSON.parse(saved) as Partial<UserPreferences> : {};
    const preferences = normalizeUserPreferences(parsed);
    if (typeof parsed.sidebarCollapsed !== "boolean") {
      preferences.sidebarCollapsed = localStorage.getItem(legacySidebarCollapsedKey) === "true";
    }
    return preferences;
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  if (userId === LOCAL_DEMO_USER_ID) return loadUserPreferences(userId);

  const { data, error } = await supabase.from("profiles").select("user_preferences").eq("id", userId).maybeSingle();
  if (error) throw error;

  let localPending = false;
  let alreadyMigrated = false;
  let hasLegacySidebarSetting = false;
  let localSaved: string | null = null;
  try {
    localPending = localStorage.getItem(pendingPreferencesKey(userId)) === "true";
    alreadyMigrated = localStorage.getItem(migratedPreferencesKey(userId)) === "true";
    hasLegacySidebarSetting = localStorage.getItem(legacySidebarCollapsedKey) !== null;
    localSaved = localStorage.getItem(preferencesKey(userId));
  } catch { /* Le profil Supabase reste lisible sans cache local. */ }
  if (localPending && localSaved) {
    const localPreferences = loadUserPreferences(userId);
    await saveUserPreferences(userId, localPreferences);
    return localPreferences;
  }

  if (data?.user_preferences && typeof data.user_preferences === "object") {
    const preferences = normalizeUserPreferences(data.user_preferences);
    // Importer les anciennes options locales lors de l’ajout de la colonne,
    // dont la valeur par défaut ne permet pas de distinguer un nouveau profil.
    if (!alreadyMigrated && (localSaved || hasLegacySidebarSetting) && isDefaultUserPreferences(preferences)) {
      const localPreferences = loadUserPreferences(userId);
      if (!isDefaultUserPreferences(localPreferences)) {
        await saveUserPreferences(userId, localPreferences);
        return localPreferences;
      }
    }
    cacheUserPreferences(userId, preferences);
    try { localStorage.setItem(migratedPreferencesKey(userId), "true"); } catch { /* Le chargement distant reste valide. */ }
    return preferences;
  }

  if (localSaved) {
    const localPreferences = loadUserPreferences(userId);
    await saveUserPreferences(userId, localPreferences);
    return localPreferences;
  }
  try { localStorage.setItem(migratedPreferencesKey(userId), "true"); } catch { /* Le profil distant reste la source de vérité. */ }
  return DEFAULT_USER_PREFERENCES;
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
  const normalized = normalizeUserPreferences(preferences);
  cacheUserPreferences(userId, normalized);
  if (userId === LOCAL_DEMO_USER_ID) return;

  try { localStorage.setItem(pendingPreferencesKey(userId), "true"); } catch { /* Le statut local n'empêche pas la sauvegarde distante. */ }
  const previous = preferenceSaveQueues.get(userId) ?? Promise.resolve();
  const save = previous.catch(() => undefined).then(async () => {
    const { error } = await supabase.from("profiles").upsert(
      { id: userId, user_preferences: normalized, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (error) throw error;
  });
  preferenceSaveQueues.set(userId, save);
  let succeeded = false;
  try {
    await save;
    succeeded = true;
  } finally {
    if (preferenceSaveQueues.get(userId) === save) {
      preferenceSaveQueues.delete(userId);
      if (succeeded) {
        try { localStorage.removeItem(pendingPreferencesKey(userId)); } catch { /* Ignore local cache cleanup errors. */ }
        try { localStorage.setItem(migratedPreferencesKey(userId), "true"); } catch { /* La préférence distante reste enregistrée. */ }
      }
    }
  }
}
