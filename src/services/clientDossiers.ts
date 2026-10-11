import { LOCAL_DEMO_USER_ID } from "../types";
import { supabase } from "./supabase";

const TABLE = "client_dossiers";
const DEMO_STORAGE_KEY = "citynside_demo_client_dossiers";

export interface ClientDossier {
  id: string;
  userId: string;
  clientName: string;
  email: string;
  phone: string;
  project: string;
  priorities: string;
  notes: string;
  analysisIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ClientDossierInput = Omit<ClientDossier, "createdAt" | "updatedAt">;

interface ClientDossierRow {
  id: string;
  user_id: string;
  client_name: string;
  email: string;
  phone: string;
  project: string;
  priorities: string;
  notes: string;
  analysis_ids: string[];
  created_at: string;
  updated_at: string;
}

const fromRow = (row: ClientDossierRow): ClientDossier => ({
  id: row.id,
  userId: row.user_id,
  clientName: row.client_name,
  email: row.email ?? "",
  phone: row.phone ?? "",
  project: row.project ?? "",
  priorities: row.priorities ?? "",
  notes: row.notes ?? "",
  analysisIds: row.analysis_ids ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const readDemoDossiers = (): ClientDossier[] => {
  try {
    const serialized = localStorage.getItem(DEMO_STORAGE_KEY);
    const parsed: unknown = serialized ? JSON.parse(serialized) : [];
    return Array.isArray(parsed) ? parsed as ClientDossier[] : [];
  } catch {
    return [];
  }
};

const createId = () => globalThis.crypto?.randomUUID?.() ?? `dossier-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function fetchClientDossiers(userId: string): Promise<ClientDossier[]> {
  if (userId === LOCAL_DEMO_USER_ID) {
    return readDemoDossiers().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ClientDossierRow[]).map(fromRow);
}

export async function saveClientDossier(input: ClientDossierInput): Promise<ClientDossier> {
  const now = new Date().toISOString();
  const id = input.id || createId();
  const dossier: ClientDossier = { ...input, id, createdAt: now, updatedAt: now };

  if (input.userId === LOCAL_DEMO_USER_ID) {
    const existing = readDemoDossiers();
    const previous = existing.find((item) => item.id === id);
    dossier.createdAt = previous?.createdAt ?? now;
    const next = [dossier, ...existing.filter((item) => item.id !== id)];
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
    return dossier;
  }

  const row = {
    id,
    user_id: input.userId,
    client_name: input.clientName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    project: input.project.trim(),
    priorities: input.priorities.trim(),
    notes: input.notes.trim(),
    analysis_ids: input.analysisIds,
    updated_at: now,
  };
  const { data, error } = await supabase.from(TABLE).upsert(row, { onConflict: "id" }).select("*").single();
  if (error) throw error;
  return fromRow(data as ClientDossierRow);
}

export async function deleteClientDossier(userId: string, dossierId: string): Promise<void> {
  if (userId === LOCAL_DEMO_USER_ID) {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(readDemoDossiers().filter((item) => item.id !== dossierId)));
    return;
  }

  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("id", dossierId);
  if (error) throw error;
}
