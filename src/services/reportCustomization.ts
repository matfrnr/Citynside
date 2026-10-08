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

const defaultCustomizationKey = (userId: string) => `citynside_report_defaults_${userId}`;

export function loadDefaultReportCustomization(userId: string): ReportCustomization {
  try {
    const saved = localStorage.getItem(defaultCustomizationKey(userId));
    if (!saved) return DEFAULT_REPORT_CUSTOMIZATION;
    const parsed = JSON.parse(saved) as Partial<ReportCustomization>;
    return {
      ...DEFAULT_REPORT_CUSTOMIZATION,
      ...parsed,
      includedSections: { ...DEFAULT_REPORT_CUSTOMIZATION.includedSections, ...parsed.includedSections },
    };
  } catch {
    return DEFAULT_REPORT_CUSTOMIZATION;
  }
}

export function saveDefaultReportCustomization(userId: string, customization: ReportCustomization): void {
  try {
    localStorage.setItem(defaultCustomizationKey(userId), JSON.stringify(customization));
  } catch {
    // Les préférences restent utilisables pendant la session si le stockage local est indisponible.
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
