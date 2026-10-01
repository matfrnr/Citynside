import { LOCAL_DEMO_USER_ID } from "../types";
import { supabase } from "./supabase";

export type NotificationKind = "analysis" | "report" | "territory" | "system";
export type NotificationImportance = "normal" | "attention" | "important";
export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  description: string;
  kind: NotificationKind;
  importance: NotificationImportance;
  createdAt: string;
  read: boolean;
  sourceUrl?: string;
}

const localKey = (userId: string) => `citynside_notifications_${userId}`;
const fromRow = (row: Record<string, any>): AppNotification => ({
  id: row.id, userId: row.user_id, title: row.title,
  description: row.description, kind: row.kind,
  importance: row.importance || (row.kind === "territory" ? "attention" : /profil modifié/i.test(row.title || "") ? "important" : "normal"),
  createdAt: row.created_at,
  read: row.is_read, sourceUrl: row.source_url || undefined,
});

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  if (userId === LOCAL_DEMO_USER_ID) {
    try { return JSON.parse(localStorage.getItem(localKey(userId)) || "[]"); } catch { return []; }
  }
  const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createNotification(userId: string, item: Omit<AppNotification, "id" | "userId" | "createdAt" | "read" | "importance"> & { id?: string; importance?: NotificationImportance }): Promise<AppNotification> {
  const notification: AppNotification = {
    id: item.id || `${item.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId, title: item.title, description: item.description, kind: item.kind,
    importance: item.importance || (item.kind === "territory" ? "attention" : "normal"),
    createdAt: new Date().toISOString(), read: false, sourceUrl: item.sourceUrl,
  };
  if (userId === LOCAL_DEMO_USER_ID) {
    const list = await fetchNotifications(userId);
    if (list.some((n) => n.id === notification.id)) return list.find((n) => n.id === notification.id)!;
    localStorage.setItem(localKey(userId), JSON.stringify([notification, ...list].slice(0, 100)));
    return notification;
  }
  const row = {
    id: notification.id, user_id: userId, title: notification.title,
    description: notification.description, kind: notification.kind, importance: notification.importance,
    created_at: notification.createdAt, is_read: false, source_url: notification.sourceUrl || null,
  };
  let { error } = await supabase.from("notifications").upsert(row, {
    onConflict: "id",
    ignoreDuplicates: true,
  });
  // Older Supabase schemas may not have received the importance migration yet.
  // Omit that column so notifications still persist; the UI infers importance from kind/title.
  if (error?.code === "PGRST204" && error.message.includes("importance")) {
    const { importance: _importance, ...compatibleRow } = row;
    void _importance;
    ({ error } = await supabase.from("notifications").upsert(compatibleRow, {
      onConflict: "id",
      ignoreDuplicates: true,
    }));
  }
  if (error && error.code !== "23505") throw error;
  return notification;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  if (userId === LOCAL_DEMO_USER_ID) {
    const list = await fetchNotifications(userId);
    localStorage.setItem(localKey(userId), JSON.stringify(list.map((item) => ({ ...item, read: true }))));
    return;
  }
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  if (error) throw error;
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  if (userId === LOCAL_DEMO_USER_ID) {
    const list = await fetchNotifications(userId);
    localStorage.setItem(localKey(userId), JSON.stringify(list.filter((item) => item.id !== notificationId)));
    return;
  }
  const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("id", notificationId);
  if (error) throw error;
}

export async function deleteNotifications(userId: string, kind?: NotificationKind): Promise<void> {
  if (userId === LOCAL_DEMO_USER_ID) {
    const list = await fetchNotifications(userId);
    localStorage.setItem(localKey(userId), JSON.stringify(kind ? list.filter((item) => item.kind !== kind) : []));
    return;
  }
  let query = supabase.from("notifications").delete().eq("user_id", userId);
  if (kind) query = query.eq("kind", kind);
  const { error } = await query;
  if (error) throw error;
}
