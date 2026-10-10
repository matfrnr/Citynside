import { useCallback, useEffect, useState } from "react";
import {
  getProfileAvatarStorageKey,
  getSavedProfileAvatar,
  PROFILE_AVATAR_CHANGED_EVENT,
  saveProfileAvatar,
  type ProfileAvatarId,
} from "../../services/profileAvatar";

export function useProfileAvatar(userId: string) {
  const [savedSelection, setSavedSelection] = useState(() => ({
    userId,
    avatarId: getSavedProfileAvatar(userId),
  }));
  const avatarId = savedSelection.userId === userId
    ? savedSelection.avatarId
    : getSavedProfileAvatar(userId);

  useEffect(() => {
    const syncAvatar = () => setSavedSelection({ userId, avatarId: getSavedProfileAvatar(userId) });
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getProfileAvatarStorageKey(userId) || event.key === null) {
        syncAvatar();
      }
    };

    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, syncAvatar);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, syncAvatar);
      window.removeEventListener("storage", handleStorage);
    };
  }, [userId]);

  const selectAvatar = useCallback((nextAvatarId: ProfileAvatarId) => {
    setSavedSelection({ userId, avatarId: nextAvatarId });
    saveProfileAvatar(userId, nextAvatarId);
  }, [userId]);

  return { avatarId, selectAvatar };
}
