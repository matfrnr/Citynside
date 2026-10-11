import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Megaphone, X } from "lucide-react";
import { CURRENT_RELEASE_NOTES, releaseNotesContinueKey } from "../../config/releaseNotes";
import { supabase } from "../../services/supabase";
import { LOCAL_DEMO_USER_ID } from "../../types";

interface ReleaseNotesModalProps {
  userId: string;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSavingDismissal, setIsSavingDismissal] = useState(false);
  const [dismissalError, setDismissalError] = useState("");
  const isDemo = userId === LOCAL_DEMO_USER_ID;
  const dismissedVersionKey = `citynside_release_notes_dismissed_version_${userId}`;
  const continueKey = releaseNotesContinueKey(userId);
  const releaseItems = CURRENT_RELEASE_NOTES.items.filter((item) => item.title.trim() && item.description.trim());
  const hasReleaseNotes = releaseItems.length > 0;

  useEffect(() => {
    if (!hasReleaseNotes) {
      return;
    }
    const checkDismissed = async () => {
      try {
        const localDismissed = localStorage.getItem(dismissedVersionKey) === CURRENT_RELEASE_NOTES.version;
        const temporaryDismissed = sessionStorage.getItem(continueKey) === CURRENT_RELEASE_NOTES.version;
        if (temporaryDismissed) {
          setIsOpen(false);
          return;
        }
        if (isDemo) {
          setIsOpen(!localDismissed);
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (data.user?.id !== userId) throw new Error("Session utilisateur indisponible.");
        const accountDismissed = data.user.user_metadata?.citynside_release_notes_dismissed_version === CURRENT_RELEASE_NOTES.version;
        if (accountDismissed) {
          try { localStorage.setItem(dismissedVersionKey, CURRENT_RELEASE_NOTES.version); } catch { /* La valeur distante suffit. */ }
          setIsOpen(false);
          return;
        }

        // Synchroniser l’acquittement local historique vers le compte, une fois.
        if (localDismissed) {
          const { data: updated, error: updateError } = await supabase.auth.updateUser({
            data: { citynside_release_notes_dismissed_version: CURRENT_RELEASE_NOTES.version },
          });
          if (updateError || updated.user?.user_metadata?.citynside_release_notes_dismissed_version !== CURRENT_RELEASE_NOTES.version) {
            throw updateError ?? new Error("La confirmation des notes de version n’a pas été enregistrée.");
          }
          setIsOpen(false);
          return;
        }
      } catch {
        setDismissalError("La préférence d’affichage n’a pas pu être vérifiée avec votre compte. Vérifiez la connexion puis réessayez.");
      }
      setIsOpen(true);
    };
    void checkDismissed();
  }, [continueKey, dismissedVersionKey, hasReleaseNotes, isDemo, userId]);

  const dismissVersion = async () => {
    setDismissalError("");
    if (!isDemo) {
      setIsSavingDismissal(true);
      try {
        const { data, error } = await supabase.auth.updateUser({
          data: { citynside_release_notes_dismissed_version: CURRENT_RELEASE_NOTES.version },
        });
        if (error || data.user?.user_metadata?.citynside_release_notes_dismissed_version !== CURRENT_RELEASE_NOTES.version) {
          throw error ?? new Error("La confirmation des notes de version n’a pas été enregistrée.");
        }
      } catch (error) {
        console.error("Synchronisation de l’acquittement des notes de version impossible :", error);
        setDismissalError("Impossible d’enregistrer ce choix sur votre compte. Vérifiez la connexion puis réessayez.");
        setIsSavingDismissal(false);
        return;
      }
      setIsSavingDismissal(false);
    }
    try { localStorage.setItem(dismissedVersionKey, CURRENT_RELEASE_NOTES.version); } catch { /* Le compte conserve la valeur distante. */ }
    setIsOpen(false);
  };

  const continueUntilNextLogin = useCallback(() => {
    try { sessionStorage.setItem(continueKey, CURRENT_RELEASE_NOTES.version); } catch { /* Fermeture temporaire jusqu'au prochain rendu. */ }
    setIsOpen(false);
  }, [continueKey]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") continueUntilNextLogin();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, continueUntilNextLogin]);

  if (!hasReleaseNotes || !isOpen) return null;

  return (
    <div className="release-modal-backdrop" onClick={continueUntilNextLogin}>
      <section
        className="release-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="release-modal-close" type="button" onClick={continueUntilNextLogin} aria-label="Fermer">
          <X size={18} />
        </button>
        <div className="release-modal-icon"><Megaphone size={23} /></div>
        <p className="release-modal-eyebrow">Nouveautés · {CURRENT_RELEASE_NOTES.date}</p>
        <h2 id="release-modal-title">{CURRENT_RELEASE_NOTES.title}</h2>
        <p className="release-modal-intro">{CURRENT_RELEASE_NOTES.introduction}</p>

        <ul className="release-modal-list">
          {releaseItems.map((item) => (
            <li key={item.title}>
              <span className="release-modal-bullet" aria-hidden="true"><ArrowRight size={14} /></span>
              <div><strong>{item.title}</strong><p>{item.description}</p></div>
            </li>
          ))}
        </ul>

        <div className="release-modal-actions">
          <button className="release-dismiss-button" type="button" onClick={() => void dismissVersion()} disabled={isSavingDismissal}>
            {isSavingDismissal ? "Enregistrement…" : "Ne plus afficher cette version"}
          </button>
          <button className="release-later-button" type="button" onClick={continueUntilNextLogin} disabled={isSavingDismissal}>
            Continuer
          </button>
        </div>
        {dismissalError && <p className="release-dismiss-error" role="alert">{dismissalError}</p>}
      </section>

      <style>{`
        .release-modal-backdrop { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; padding: 24px; background: rgba(15, 30, 25, .52); backdrop-filter: blur(4px); }
        .release-modal { position: relative; width: min(100%, 600px); max-height: min(90vh, 760px); overflow-y: auto; padding: 34px; border: 1px solid rgba(25, 56, 50, .1); border-radius: 24px; background: radial-gradient(ellipse at 100% 0, rgba(218, 237, 220, .72), transparent 38%), linear-gradient(180deg, #f8fbf7 0, #fff 210px); box-shadow: 0 24px 80px rgba(9, 27, 22, .24); color: var(--color-text-main, #243630); }
        .release-modal-close { position: absolute; top: 18px; right: 18px; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--color-border, #e1e9e2); border-radius: 50%; background: #fff; color: #52665b; cursor: pointer; }
        .release-modal-icon { width: 50px; height: 50px; display: grid; place-items: center; border: 1px solid rgba(53, 108, 75, .12); border-radius: 16px; background: linear-gradient(145deg, #e2f1e3, #f1f7ee); color: #285c43; box-shadow: 0 5px 14px rgba(40, 92, 67, .08); }
        .release-modal-eyebrow { display: flex; align-items: center; gap: 8px; margin: 20px 0 8px; color: #548162; font-size: .72rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
        .release-modal h2 { margin: 0; color: #193832; font-size: 1.65rem; line-height: 1.2; }
        .release-modal-intro { margin: 10px 0 22px; color: #64736b; font-size: .92rem; line-height: 1.5; }
        .release-modal-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
        .release-modal-list li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 11px; align-items: start; padding: 12px 13px; border: 1px solid #e8eee8; border-radius: 14px; background: rgba(255, 255, 255, .82); box-shadow: 0 2px 7px rgba(27, 57, 43, .025); }
        .release-modal-bullet { display: grid; place-items: center; width: 25px; height: 25px; margin-top: 1px; border-radius: 50%; background: #edf5ee; color: #356c4b; }
        .release-modal-list strong { color: #263b32; font-size: .9rem; }
        .release-modal-list p { margin: 3px 0 0; color: #68776f; font-size: .83rem; line-height: 1.45; }
        .release-modal-actions { display: flex; justify-content: space-between; gap: 12px; margin-top: 26px; padding-top: 18px; border-top: 1px solid #edf0ed; }
        .release-dismiss-button, .release-later-button { min-height: 42px; padding: 0 17px; border-radius: 999px; font: inherit; font-size: .85rem; font-weight: 650; cursor: pointer; }
        .release-dismiss-button { border: 1px solid #dce5dd; background: #fff; color: #53655a; }
        .release-later-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #193832; background: #193832; color: #fff; }
        .release-dismiss-button:disabled, .release-later-button:disabled { opacity: .65; cursor: wait; }
        .release-dismiss-error { margin: 12px 0 0; color: #a12d27; font-size: .78rem; line-height: 1.45; }
        @media (max-width: 520px) {
          .release-modal-backdrop { padding: 12px; }
          .release-modal { padding: 20px 16px 16px; border-radius: 16px; max-height: calc(100dvh - 24px); }
          .release-modal-icon { width: 40px; height: 40px; border-radius: 12px; }
          .release-modal-eyebrow { margin: 14px 0 5px; font-size: .65rem; }
          .release-modal h2 { padding-right: 24px; font-size: 1.16rem; line-height: 1.25; }
          .release-modal-intro { margin: 8px 0 16px; font-size: .78rem; line-height: 1.45; }
          .release-modal-list { gap: 8px; }
          .release-modal-list li { grid-template-columns: 22px minmax(0, 1fr); gap: 8px; padding: 10px; border-radius: 11px; }
          .release-modal-bullet { width: 21px; height: 21px; }
          .release-modal-bullet svg { width: 12px; height: 12px; }
          .release-modal-list strong { font-size: .78rem; line-height: 1.3; }
          .release-modal-list p { font-size: .73rem; line-height: 1.4; }
          .release-modal-actions { flex-direction: column-reverse; gap: 8px; margin-top: 18px; padding-top: 13px; }
          .release-dismiss-button, .release-later-button { width: 100%; min-height: 40px; padding: 0 10px; font-size: .75rem; }
          .release-modal-close { top: 12px; right: 12px; width: 32px; height: 32px; }
        }
      `}</style>
    </div>
  );
};
