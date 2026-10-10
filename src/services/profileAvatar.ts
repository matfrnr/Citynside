export const PROFILE_AVATARS = [
  { id: "sage", label: "Titouan", background: "#e1eee2", skin: "#d49a78", hair: "#3d302d", shirt: "#4f795e", style: "short" },
  { id: "coral", label: "Paul", background: "#f6e2dc", skin: "#9b6048", hair: "#292322", shirt: "#bb6555", style: "beard" },
  { id: "sky", label: "Jeremy", background: "#dfeef5", skin: "#efc39e", hair: "#61432d", shirt: "#4f83a1", style: "shortCurly" },
  { id: "lilac", label: "Léa", background: "#eee7f5", skin: "#754a3e", hair: "#302631", shirt: "#80659f", style: "curly" },
  { id: "honey", label: "Fiona", background: "#f7edcf", skin: "#e6ad82", hair: "#493229", shirt: "#b88536", style: "wave" },
  { id: "lagoon", label: "Audrey", background: "#dcefed", skin: "#bd795d", hair: "#362824", shirt: "#37817d", style: "bun" },
] as const;

export type ProfileAvatarId = (typeof PROFILE_AVATARS)[number]["id"];

export const PROFILE_AVATAR_CHANGED_EVENT = "citynside:profile-avatar-changed";

export const getProfileAvatarStorageKey = (userId: string) =>
  `citynside_profile_avatar_${userId}`;

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return PROFILE_AVATARS.some((avatar) => avatar.id === value);
}

export function getSavedProfileAvatar(userId: string): ProfileAvatarId | null {
  if (!userId) return null;

  try {
    if (typeof localStorage === "undefined") return null;
    const saved = localStorage.getItem(getProfileAvatarStorageKey(userId));
    return isProfileAvatarId(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function saveProfileAvatar(userId: string, avatarId: ProfileAvatarId): void {
  try {
    localStorage.setItem(getProfileAvatarStorageKey(userId), avatarId);
  } catch {
    // Le changement reste visible dans l’interface même si le stockage est désactivé.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROFILE_AVATAR_CHANGED_EVENT, { detail: { userId } }),
    );
  }
}
