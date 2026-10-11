import { LOCAL_DEMO_USER_ID } from "../types";
import { supabase } from "./supabase";

export interface AssistantConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const localKey = (userId: string, analysisId: string) =>
  `citynside_assistant_${encodeURIComponent(userId)}_${encodeURIComponent(analysisId)}`;
const saveQueues = new Map<string, Promise<void>>();

function normalizeTurns(value: unknown): AssistantConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((turn): turn is AssistantConversationTurn => Boolean(
      turn && typeof turn === "object"
      && ((turn as AssistantConversationTurn).role === "user" || (turn as AssistantConversationTurn).role === "assistant")
      && typeof (turn as AssistantConversationTurn).content === "string",
    ))
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 12000) }));
}

function cacheTurns(userId: string, analysisId: string, turns: AssistantConversationTurn[]): void {
  try { localStorage.setItem(localKey(userId, analysisId), JSON.stringify(turns)); } catch { /* Le stockage Supabase reste prioritaire. */ }
}

export function loadLocalAssistantConversation(userId: string, analysisId: string): AssistantConversationTurn[] {
  try {
    const saved = localStorage.getItem(localKey(userId, analysisId));
    return saved ? normalizeTurns(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

export async function fetchAssistantConversation(userId: string, analysisId: string): Promise<AssistantConversationTurn[]> {
  if (userId === LOCAL_DEMO_USER_ID) return loadLocalAssistantConversation(userId, analysisId);

  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("turns")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .maybeSingle();
  if (error) throw error;

  const remoteTurns = normalizeTurns(data?.turns);
  if (remoteTurns.length) {
    cacheTurns(userId, analysisId, remoteTurns);
    return remoteTurns;
  }

  const localTurns = loadLocalAssistantConversation(userId, analysisId);
  if (localTurns.length) await saveAssistantConversation(userId, analysisId, localTurns);
  return localTurns;
}

export async function saveAssistantConversation(
  userId: string,
  analysisId: string,
  turns: AssistantConversationTurn[],
): Promise<void> {
  const normalized = normalizeTurns(turns);
  cacheTurns(userId, analysisId, normalized);
  if (userId === LOCAL_DEMO_USER_ID) return;

  const queueKey = `${userId}:${analysisId}`;
  const previous = saveQueues.get(queueKey) ?? Promise.resolve();
  const save = previous.catch(() => undefined).then(async () => {
    const { error } = await supabase.from("assistant_conversations").upsert({
      user_id: userId,
      analysis_id: analysisId,
      turns: normalized,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,analysis_id" });
    if (error) throw error;
  });
  saveQueues.set(queueKey, save);
  try {
    await save;
  } finally {
    if (saveQueues.get(queueKey) === save) saveQueues.delete(queueKey);
  }
}
