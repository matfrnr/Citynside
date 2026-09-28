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
  const name =
    (metadata.name as string) ||
    (metadata.full_name as string) ||
    user.email?.split("@")[0] ||
    "Agent Citynside";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
  };
}
