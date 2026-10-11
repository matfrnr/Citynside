import { LOCAL_DEMO_USER_ID } from "../types";
import { supabase } from "./supabase";

export interface ReportCustomization {
  includedSections: { scores: boolean; sources: boolean; impressions: boolean; risks: boolean };
  strengths: string;
  reservations: string;
}

export const DEFAULT_REPORT_CUSTOMIZATION: ReportCustomization = {
  includedSections: { scores: true, sources: true, impressions: true, risks: false },
  strengths: "",
  reservations: "",
};

function isDefaultCustomization(customization: ReportCustomization): boolean {
  return JSON.stringify(customization) === JSON.stringify(DEFAULT_REPORT_CUSTOMIZATION);
}

const defaultCustomizationKey = (userId: string) => `citynside_report_defaults_${userId}`;
const pendingCustomizationKey = (userId: string) => `citynside_report_defaults_pending_${userId}`;
const migratedCustomizationKey = (userId: string) => `citynside_report_defaults_migrated_${userId}`;
const defaultCustomizationSaveQueues = new Map<string, Promise<void>>();

function normalizeCustomization(value: unknown): ReportCustomization {
  const parsed = value && typeof value === "object" ? value as Partial<ReportCustomization> : {};
  return {
    ...DEFAULT_REPORT_CUSTOMIZATION,
    ...parsed,
    includedSections: { ...DEFAULT_REPORT_CUSTOMIZATION.includedSections, ...parsed.includedSections },
    strengths: typeof parsed.strengths === "string" ? parsed.strengths : "",
    reservations: typeof parsed.reservations === "string" ? parsed.reservations : "",
  };
}

export function cacheDefaultReportCustomization(userId: string, customization: ReportCustomization): void {
  try { localStorage.setItem(defaultCustomizationKey(userId), JSON.stringify(customization)); } catch { /* Supabase reste la source de vérité. */ }
}

export function loadDefaultReportCustomization(userId: string): ReportCustomization {
  try {
    const saved = localStorage.getItem(defaultCustomizationKey(userId));
    if (!saved) return DEFAULT_REPORT_CUSTOMIZATION;
    return normalizeCustomization(JSON.parse(saved));
  } catch {
    return DEFAULT_REPORT_CUSTOMIZATION;
  }
}

export async function fetchDefaultReportCustomization(userId: string): Promise<ReportCustomization> {
  if (userId === LOCAL_DEMO_USER_ID) return loadDefaultReportCustomization(userId);

  const { data, error } = await supabase.from("profiles").select("default_report_customization").eq("id", userId).maybeSingle();
  if (error) throw error;

  let localPending = false;
  let alreadyMigrated = false;
  let localSaved: string | null = null;
  try {
    localPending = localStorage.getItem(pendingCustomizationKey(userId)) === "true";
    alreadyMigrated = localStorage.getItem(migratedCustomizationKey(userId)) === "true";
    localSaved = localStorage.getItem(defaultCustomizationKey(userId));
  } catch { /* Le profil Supabase reste lisible sans cache local. */ }
  if (localPending && localSaved) {
    const localCustomization = loadDefaultReportCustomization(userId);
    await saveDefaultReportCustomization(userId, localCustomization);
    return localCustomization;
  }

  if (data?.default_report_customization && typeof data.default_report_customization === "object") {
    const customization = normalizeCustomization(data.default_report_customization);
    // Préserver les réglages enregistrés localement avant l’ajout de la colonne.
    if (!alreadyMigrated && localSaved && isDefaultCustomization(customization)) {
      const localCustomization = loadDefaultReportCustomization(userId);
      if (!isDefaultCustomization(localCustomization)) {
        await saveDefaultReportCustomization(userId, localCustomization);
        return localCustomization;
      }
    }
    cacheDefaultReportCustomization(userId, customization);
    try { localStorage.setItem(migratedCustomizationKey(userId), "true"); } catch { /* Le chargement distant reste valide. */ }
    return customization;
  }

  if (localSaved) {
    const localCustomization = loadDefaultReportCustomization(userId);
    await saveDefaultReportCustomization(userId, localCustomization);
    return localCustomization;
  }
  try { localStorage.setItem(migratedCustomizationKey(userId), "true"); } catch { /* Le modèle distant reste la source de vérité. */ }
  return DEFAULT_REPORT_CUSTOMIZATION;
}

export async function saveDefaultReportCustomization(userId: string, customization: ReportCustomization): Promise<void> {
  const normalized = normalizeCustomization(customization);
  cacheDefaultReportCustomization(userId, normalized);
  if (userId === LOCAL_DEMO_USER_ID) return;

  try { localStorage.setItem(pendingCustomizationKey(userId), "true"); } catch { /* Le statut local n'empêche pas la sauvegarde distante. */ }
  const previous = defaultCustomizationSaveQueues.get(userId) ?? Promise.resolve();
  const save = previous.catch(() => undefined).then(async () => {
    const { error } = await supabase.from("profiles").upsert(
      { id: userId, default_report_customization: normalized, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (error) throw error;
  });
  defaultCustomizationSaveQueues.set(userId, save);
  let succeeded = false;
  try {
    await save;
    succeeded = true;
  } finally {
    if (defaultCustomizationSaveQueues.get(userId) === save) {
      defaultCustomizationSaveQueues.delete(userId);
      if (succeeded) {
        try { localStorage.removeItem(pendingCustomizationKey(userId)); } catch { /* Ignore local cache cleanup errors. */ }
        try { localStorage.setItem(migratedCustomizationKey(userId), "true"); } catch { /* Le modèle distant reste enregistré. */ }
      }
    }
  }
}

const mapRow = (row: Record<string, unknown>): ReportCustomization => {
  const sections = row.included_sections && typeof row.included_sections === "object"
    ? row.included_sections as Partial<ReportCustomization["includedSections"]>
    : {};
  return {
    includedSections: { ...DEFAULT_REPORT_CUSTOMIZATION.includedSections, ...sections },
    strengths: typeof row.strengths === "string" ? row.strengths : "",
    reservations: typeof row.reservations === "string" ? row.reservations : "",
  };
};

export async function fetchReportCustomization(userId: string, analysisId: string): Promise<ReportCustomization | null> {
  const { data, error } = await supabase
    .from("report_customizations")
    .select("included_sections, strengths, reservations")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function saveReportCustomization(userId: string, analysisId: string, customization: ReportCustomization): Promise<void> {
  const { error } = await supabase.from("report_customizations").upsert({
    user_id: userId,
    analysis_id: analysisId,
    included_sections: customization.includedSections,
    strengths: customization.strengths,
    reservations: customization.reservations,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,analysis_id" });
  if (error) throw error;
}
