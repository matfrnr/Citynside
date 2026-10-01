import type { AuthUser } from "../types";
import { mapProfileRowToAuthUser, mapSupabaseUser, supabase } from "./supabase";

export interface ProfileDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  agency: string;
  agencyCity: string;
  role: string;
}

/**
 * Valide un numéro de téléphone (format français 10 chiffres ou format international avec indicatif)
 * Rejette catégoriquement les numéros incomplets ou faux tels que "1234", "0123", "0000", etc.
 */
export function isValidPhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true; // Facultatif si vide

  // Format français standard : 0[1-9] suivi de 8 chiffres (séparateurs autorisés : espaces, points, tirets)
  // ou avec indicatif français +33 / 0033
  const frenchRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

  // Format international générique avec indicatif (+32, +41, etc. : entre 9 et 15 chiffres)
  const internationalRegex = /^\+(?:[0-9][\s.-]?){9,15}$/;

  return frenchRegex.test(trimmed) || internationalRegex.test(trimmed);
}

/**
 * Récupère le profil d'un utilisateur depuis Supabase (table profiles ou auth.metadata)
 * Sans AUCUNE dépendance au localStorage pour éviter que deux navigateurs divergent.
 */
export async function fetchUserProfile(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<AuthUser> {
  const defaultUser = mapSupabaseUser(user);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      return mapProfileRowToAuthUser(data, user.email);
    }
  } catch (e) {
    console.warn("Échec lecture table profiles (fallback auth metadata) :", e);
  }

  return defaultUser;
}

/**
 * Sauvegarde le profil directement en BDD (table profiles) et dans Supabase Auth
 * Répercute la mise à jour pour tous les appareils connectés.
 */
export async function saveUserProfile(
  user: AuthUser,
  details: ProfileDetails,
): Promise<AuthUser> {
  const cleanPhone = details.phone.trim();
  if (cleanPhone && !isValidPhoneNumber(cleanPhone)) {
    throw new Error(
      "Numéro de téléphone invalide. Veuillez renseigner un numéro à 10 chiffres (ex : 06 12 34 56 78) ou international (+33...).",
    );
  }

  const fullName = `${details.firstName} ${details.lastName}`.trim() || user.name;

  const updated: AuthUser = {
    ...user,
    name: fullName,
    firstName: details.firstName,
    lastName: details.lastName,
    phone: cleanPhone,
    agency: details.agency,
    agencyCity: details.agencyCity,
    role: details.role,
  };

  // 1. Sauvegarde dans Supabase Auth
  try {
    const { error: authErr } = await supabase.auth.updateUser({
      data: {
        first_name: details.firstName,
        last_name: details.lastName,
        name: fullName,
        full_name: fullName,
        phone: details.phone,
        agency: details.agency,
        agency_city: details.agencyCity,
        role: details.role,
      },
    });
    if (authErr) {
      console.warn("Erreur updateUser Supabase Auth:", authErr.message);
    }
  } catch (e) {
    console.warn("Exception updateUser Supabase Auth:", e);
  }

  // 2. Sauvegarde dans la table 'profiles' de Supabase (pour Realtime multi-appareils)
  try {
    const { error: dbErr } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        first_name: details.firstName,
        last_name: details.lastName,
        full_name: fullName,
        phone: details.phone,
        agency: details.agency,
        agency_city: details.agencyCity,
        role: details.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (dbErr) {
      console.warn("Erreur upsert table profiles:", dbErr.message);
    }
  } catch (e) {
    console.warn("Exception upsert table profiles:", e);
  }

  return updated;
}

export async function changeUserPassword(newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
