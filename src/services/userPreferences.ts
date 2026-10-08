export type UserStartView = "home" | "new-analysis";
export type MapZoomPreference = 12 | 13 | 14 | 15;
export type DefaultScoreProfile = "none" | "family" | "student" | "senior" | "investor";
export type DefaultCategoryFilter = "transports" | "commerces" | "ecoles" | "sante" | "espaces_verts" | "stationnement" | "services_publics" | "tranquillite" | "loisirs" | null;
export type DistanceUnit = "meters" | "walking-minutes";

export interface UserPreferences {
  startView: UserStartView;
  hideMapControlsByDefault: boolean;
  mapZoom: MapZoomPreference;
  reduceMotion: boolean;
  defaultScoreProfile: DefaultScoreProfile;
  defaultCategoryFilter: DefaultCategoryFilter;
  distanceUnit: DistanceUnit;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  startView: "home",
  hideMapControlsByDefault: true,
  mapZoom: 13,
  reduceMotion: false,
  defaultScoreProfile: "none",
  defaultCategoryFilter: null,
  distanceUnit: "meters",
};

const preferencesKey = (userId: string) => `citynside_preferences_${userId}`;

export function loadUserPreferences(userId: string): UserPreferences {
  try {
    const saved = localStorage.getItem(preferencesKey(userId));
    if (!saved) return DEFAULT_USER_PREFERENCES;
    const parsed = JSON.parse(saved) as Partial<UserPreferences>;
    return {
      startView: parsed.startView === "new-analysis" ? "new-analysis" : "home",
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
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function saveUserPreferences(userId: string, preferences: UserPreferences): void {
  try {
    localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences));
  } catch {
    // L’application continue de fonctionner même si le stockage local est indisponible.
  }
}
