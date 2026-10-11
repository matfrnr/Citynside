import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProfileAvatar,
  getProfileAvatarStorageKey,
  getSavedProfileAvatar,
  PROFILE_AVATAR_CHANGED_EVENT,
  saveProfileAvatar,
  type ProfileAvatarId,
} from "../../services/profileAvatar";
import { LOCAL_DEMO_USER_ID } from "../../types";
import { supabase } from "../../services/supabase";

export function useProfileAvatar(userId: string) {
  const selectionRevision = useRef(0);
  const [savedSelection, setSavedSelection] = useState(() => ({
    userId,
    avatarId: getSavedProfileAvatar(userId),
  }));
  const [syncError, setSyncError] = useState({ userId, message: "" });
  const avatarId = savedSelection.userId === userId
    ? savedSelection.avatarId
    : getSavedProfileAvatar(userId);
  const avatarSyncError = syncError.userId === userId ? syncError.message : "";

  useEffect(() => {
    let cancelled = false;
    const syncLocalAvatar = () => setSavedSelection({ userId, avatarId: getSavedProfileAvatar(userId) });
    const syncRemoteAvatar = async () => {
      const revisionAtRequest = selectionRevision.current;
      try {
        const nextAvatarId = await fetchProfileAvatar(userId);
        if (cancelled || selectionRevision.current !== revisionAtRequest) return;
        setSavedSelection({ userId, avatarId: nextAvatarId });
        setSyncError({ userId, message: "" });
      } catch (error) {
        console.warn("Synchronisation de l’avatar avec Supabase impossible :", error);
        if (cancelled || selectionRevision.current !== revisionAtRequest) return;
        setSavedSelection({ userId, avatarId: getSavedProfileAvatar(userId) });
        setSyncError({ userId, message: "L’avatar n’a pas pu être synchronisé avec Supabase. Vérifiez la connexion et appliquez la migration des avatars." });
      }
    };
    const handleAvatarChanged = (event: Event) => {
      const changedUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!changedUserId || changedUserId === userId) syncLocalAvatar();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getProfileAvatarStorageKey(userId) || event.key === null) {
        selectionRevision.current += 1;
        syncLocalAvatar();
      }
    };

    if (userId !== LOCAL_DEMO_USER_ID) void syncRemoteAvatar();
    else setSyncError({ userId, message: "" });

    const channel = userId === LOCAL_DEMO_USER_ID ? null : supabase
      .channel(`profile-avatar-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => {
        void syncRemoteAvatar();
      })
      .subscribe();

    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, handleAvatarChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, handleAvatarChanged);
      window.removeEventListener("storage", handleStorage);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  const selectAvatar = useCallback((nextAvatarId: ProfileAvatarId) => {
    selectionRevision.current += 1;
    const revisionAtSave = selectionRevision.current;
    setSavedSelection({ userId, avatarId: nextAvatarId });
    setSyncError({ userId, message: "" });
    void saveProfileAvatar(userId, nextAvatarId).then(() => {
      if (selectionRevision.current === revisionAtSave) setSyncError({ userId, message: "" });
    }).catch((error) => {
      console.error("Enregistrement de l’avatar dans Supabase impossible :", error);
      if (selectionRevision.current === revisionAtSave) {
        setSyncError({ userId, message: "L’avatar reste visible sur cet appareil, mais n’a pas pu être enregistré dans Supabase. Vérifiez la connexion et appliquez la migration des avatars." });
      }
    });
  }, [userId]);

  return { avatarId, selectAvatar, avatarSyncError };
}
