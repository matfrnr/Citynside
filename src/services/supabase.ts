import { createClient } from "@supabase/supabase-js";
import type { AuthUser } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase n'est pas encore configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre fichier .env.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function mapSupabaseUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  const metadata = user.user_metadata ?? {};

  // Try reading cached local profile if any
  let cached: Partial<AuthUser> = {};
  try {
    const raw = localStorage.getItem(`citynside-profile-${encodeURIComponent(user.id)}`);
    if (raw) cached = JSON.parse(raw);
  } catch {
    // ignore
  }

  const firstName =
    (metadata.first_name as string) ||
    (metadata.firstName as string) ||
    cached.firstName ||
    "";
  const lastName =
    (metadata.last_name as string) ||
    (metadata.lastName as string) ||
    cached.lastName ||
    "";
  const combinedName = `${firstName} ${lastName}`.trim();

  const name =
    (metadata.name as string) ||
    (metadata.full_name as string) ||
    (combinedName || "") ||
    (cached.name as string) ||
    user.email?.split("@")[0] ||
    "Agent Citynside";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
    firstName: firstName || name.split(" ")[0] || "",
    lastName: lastName || name.split(" ").slice(1).join(" ") || "",
    phone: (metadata.phone as string) || cached.phone || "",
    agency: (metadata.agency as string) || cached.agency || "Agence immobilière",
    role: (metadata.role as string) || cached.role || "Agent immobilier",
  };
}
