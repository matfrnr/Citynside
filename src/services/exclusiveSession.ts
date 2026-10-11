import { supabase } from "./supabase";

const TABLE = "citynside_active_sessions";
const HEARTBEAT_INTERVAL_MS = 20_000;

export interface ExclusiveSession {
  userId: string;
  sessionId: string;
}

export function getSupabaseSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { session_id?: unknown };
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

/** A successful fresh login takes ownership and replaces the previous app session. */
export async function claimNewAppSession(
  userId: string,
  accessToken: string,
): Promise<ExclusiveSession> {
  const sessionId = getSupabaseSessionId(accessToken);
  if (!sessionId) throw new Error("L’identifiant de session est absent du jeton d’authentification.");

  const { error } = await supabase.from(TABLE).upsert(
    { user_id: userId, session_id: sessionId, heartbeat_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return { userId, sessionId };
}

/** A restored session continues only if it still owns the account lock. */
export async function restoreAppSession(
  userId: string,
  accessToken: string,
): Promise<ExclusiveSession | null> {
  const sessionId = getSupabaseSessionId(accessToken);
  if (!sessionId) throw new Error("L’identifiant de session est absent du jeton d’authentification.");

  const { data, error } = await supabase
    .from(TABLE)
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .select("session_id");
  if (error) throw error;
  if (data?.length) return { userId, sessionId };

  const { error: insertError } = await supabase.from(TABLE).insert({
    user_id: userId,
    session_id: sessionId,
    heartbeat_at: new Date().toISOString(),
  });
  if (!insertError) return { userId, sessionId };
  if (insertError.code === "23505") return null;
  throw insertError;
}

export async function releaseAppSession({ userId, sessionId }: ExclusiveSession): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  if (error) throw error;
}

export function watchAppSession(
  lock: ExclusiveSession,
  onReplaced: (replacement?: ExclusiveSession) => void,
): () => void {
  let stopped = false;
  let checking = false;
  let intervalId: number | undefined;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let checkLock: () => void = () => {};
  let handleVisibilityChange: () => void = () => {};

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (intervalId !== undefined) window.clearInterval(intervalId);
    window.removeEventListener("focus", checkLock);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (channel) void supabase.removeChannel(channel);
  };

  const loseSession = () => {
    if (stopped) return;
    stop();
    onReplaced();
  };

  checkLock = async () => {
    if (stopped || checking) return;
    checking = true;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn("Lecture de la session active impossible :", sessionError);
        if (!session) {
          loseSession();
          return;
        }
      }
      if (!session) {
        loseSession();
        return;
      }

      // Les onglets d'un même navigateur partagent la session Supabase. Une
      // nouvelle connexion dans un de ces onglets met donc aussi à jour le
      // jeton de celui-ci : il doit suivre ce nouveau verrou au lieu de fermer
      // la session que le nouvel onglet vient d'ouvrir.
      if (session.user.id !== lock.userId) {
        stop();
        return;
      }
      const currentSessionId = getSupabaseSessionId(session.access_token);
      if (!currentSessionId) {
        loseSession();
        return;
      }

      const { data: owner, error: ownerError } = await supabase
        .from(TABLE)
        .select("session_id")
        .eq("user_id", lock.userId)
        .maybeSingle();
      if (ownerError) {
        console.warn("Lecture du verrou de session impossible :", ownerError);
        return;
      }
      if (!owner) {
        loseSession();
        return;
      }
      if (owner.session_id !== lock.sessionId) {
        if (owner.session_id === currentSessionId) {
          stop();
          onReplaced({ userId: lock.userId, sessionId: currentSessionId });
        } else {
          loseSession();
        }
        return;
      }
      if (currentSessionId !== lock.sessionId) {
        loseSession();
        return;
      }

      const { data, error } = await supabase
        .from(TABLE)
        .update({ heartbeat_at: new Date().toISOString() })
        .eq("user_id", lock.userId)
        .eq("session_id", lock.sessionId)
        .select("session_id");
      if (error) {
        console.warn("Vérification de la session active impossible :", error);
      } else if (!data?.length) {
        loseSession();
      }
    } finally {
      checking = false;
    }
  };

  handleVisibilityChange = () => {
    if (!document.hidden) void checkLock();
  };

  channel = supabase
    .channel(`citynside-session-${lock.userId}-${lock.sessionId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: TABLE, filter: `user_id=eq.${lock.userId}` },
      (payload) => {
        const updatedSessionId = (payload.new as { session_id?: unknown }).session_id;
        if (typeof updatedSessionId === "string" && updatedSessionId !== lock.sessionId) void checkLock();
      },
    )
    .subscribe();
  intervalId = window.setInterval(() => void checkLock(), HEARTBEAT_INTERVAL_MS);
  window.addEventListener("focus", checkLock);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return stop;
}
