import { LOCAL_DEMO_USER_ID } from "../types";
import { supabase } from "./supabase";

export type QuickAccessId = "new-analysis" | "history" | "favorites" | "comparison" | "notifications" | "profile" | "client-dossiers" | "personalisation";

export const DEFAULT_QUICK_ACCESS: QuickAccessId[] = ["new-analysis", "comparison", "client-dossiers", "favorites"];
const LEGACY_DEFAULT_QUICK_ACCESS: QuickAccessId[] = ["new-analysis", "history", "favorites", "comparison"];
const STORAGE_KEY = "citynside_home_quick_access";
const VALID_IDS = new Set<QuickAccessId>(["new-analysis", "history", "favorites", "comparison", "notifications", "profile", "client-dossiers", "personalisation"]);

export function isQuickAccessList(value: unknown): value is QuickAccessId[] {
  return Array.isArray(value) && value.length === 4 && new Set(value).size === 4 && value.every((id) => typeof id === "string" && VALID_IDS.has(id as QuickAccessId));
}

function matchesQuickAccess(left: readonly QuickAccessId[], right: readonly QuickAccessId[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function getLocalHomeQuickAccess(userId: string): QuickAccessId[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${encodeURIComponent(userId)}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isQuickAccessList(parsed)) return null;
    if (matchesQuickAccess(parsed, LEGACY_DEFAULT_QUICK_ACCESS)) {
      cacheHomeQuickAccess(userId, DEFAULT_QUICK_ACCESS);
      return DEFAULT_QUICK_ACCESS;
    }
    return parsed;
  } catch {
    return null;
  }
}

function cacheHomeQuickAccess(userId: string, choices: QuickAccessId[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${encodeURIComponent(userId)}`, JSON.stringify(choices));
  } catch {
    // Le serveur reste la source de vérité pour les comptes réels.
  }
}

export async function fetchHomeQuickAccess(userId: string): Promise<QuickAccessId[]> {
  if (userId === LOCAL_DEMO_USER_ID) return getLocalHomeQuickAccess(userId) ?? DEFAULT_QUICK_ACCESS;

  const { data, error } = await supabase
    .from("profiles")
    .select("home_quick_access")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const stored = data?.home_quick_access;
  const localChoices = getLocalHomeQuickAccess(userId);
  if (isQuickAccessList(stored) && matchesQuickAccess(stored, LEGACY_DEFAULT_QUICK_ACCESS)) {
    const localIsCustomized = localChoices && !matchesQuickAccess(localChoices, DEFAULT_QUICK_ACCESS);
    const migratedChoices = localIsCustomized ? localChoices : DEFAULT_QUICK_ACCESS;
    await saveHomeQuickAccess(userId, migratedChoices);
    return migratedChoices;
  }

  const choices = isQuickAccessList(stored) ? stored : localChoices ?? DEFAULT_QUICK_ACCESS;
  cacheHomeQuickAccess(userId, choices);
  return choices;
}

export async function saveHomeQuickAccess(userId: string, choices: QuickAccessId[]): Promise<void> {
  if (!isQuickAccessList(choices)) throw new Error("Sélectionnez exactement quatre raccourcis différents.");
  cacheHomeQuickAccess(userId, choices);
  if (userId === LOCAL_DEMO_USER_ID) return;

  const { error } = await supabase.from("profiles").upsert(
    { id: userId, home_quick_access: choices, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw error;
}
