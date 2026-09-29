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

  const firstName =
    (metadata.first_name as string) ||
    (metadata.firstName as string) ||
    "";
  const lastName =
    (metadata.last_name as string) ||
    (metadata.lastName as string) ||
    "";
  const combinedName = `${firstName} ${lastName}`.trim();

  const name =
    (metadata.name as string) ||
    (metadata.full_name as string) ||
    (combinedName || "") ||
    user.email?.split("@")[0] ||
    "Agent Citynside";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
    firstName: firstName || name.split(" ")[0] || "",
    lastName: lastName || name.split(" ").slice(1).join(" ") || "",
    phone: (metadata.phone as string) || "",
    agency: (metadata.agency as string) || "Agence immobilière",
    role: (metadata.role as string) || "Agent immobilier",
  };
}

export function mapProfileRowToAuthUser(
  row: Record<string, any>,
  fallbackEmail = "",
): AuthUser {
  const firstName = (row.first_name as string) || "";
  const lastName = (row.last_name as string) || "";
  const combined = `${firstName} ${lastName}`.trim();
  const name =
    (row.full_name as string) ||
    combined ||
    (row.email as string)?.split("@")[0] ||
    "Agent Citynside";

  return {
    id: row.id,
    email: (row.email as string) || fallbackEmail,
    name,
    firstName: firstName || name.split(" ")[0] || "",
    lastName: lastName || name.split(" ").slice(1).join(" ") || "",
    phone: (row.phone as string) || "",
    agency: (row.agency as string) || "Agence immobilière",
    role: (row.role as string) || "Agent immobilier",
  };
}
