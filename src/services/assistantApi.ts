import type { NeighborhoodAnalysis } from "../types";
import { supabase } from "./supabase";

interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAnswer {
  answer: string;
  quotaWarning: string | null;
}

export async function askNeighborhoodAssistant(question: string, analysis: NeighborhoodAnalysis, history: AssistantTurn[] = []): Promise<AssistantAnswer> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("Connectez-vous pour utiliser l’assistant.");

  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      question,
      history,
      analysis: {
        globalScore: analysis.globalScore,
        globalGrade: analysis.globalScore >= 8.5 ? "A+" : analysis.globalScore >= 7.5 ? "A" : analysis.globalScore >= 6.5 ? "B" : "C",
        categories: analysis.categories.map((category) => ({
          label: category.label,
          score: category.score,
          highlightText: category.highlightText,
          positiveFactors: category.positiveFactors.map(({ label }) => label),
          negativeFactors: category.negativeFactors.map(({ label }) => label),
        })),
        airQuality: analysis.airQuality?.label || "Indisponible",
        risks: analysis.riskAssessment?.findings?.map(({ label }) => ({ label })) || [],
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "L’assistant ne peut pas répondre pour le moment.");
  if (typeof result.answer !== "string" || !result.answer.trim()) throw new Error("L’assistant n’a pas produit de réponse.");
  return {
    answer: result.answer,
    quotaWarning: typeof result.quotaWarning === "string" ? result.quotaWarning : null,
  };
}
