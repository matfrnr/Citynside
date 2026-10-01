import { useEffect, useState } from "react";
import { ArrowRight, Megaphone, X } from "lucide-react";
import { CURRENT_RELEASE_NOTES, releaseNotesContinueKey } from "../../config/releaseNotes";

interface ReleaseNotesModalProps {
  userId: string;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dismissedVersionKey = `citynside_release_notes_dismissed_version_${userId}`;
  const continueKey = releaseNotesContinueKey(userId);
  const releaseItems = CURRENT_RELEASE_NOTES.items.filter((item) => item.title.trim() && item.description.trim());
  const hasReleaseNotes = releaseItems.length > 0;

  useEffect(() => {
    if (!hasReleaseNotes) {
      setIsOpen(false);
      return;
    }
    try {
      if (localStorage.getItem(dismissedVersionKey) === CURRENT_RELEASE_NOTES.version ||
          sessionStorage.getItem(continueKey) === CURRENT_RELEASE_NOTES.version) {
        setIsOpen(false);
        return;
      }
    } catch {
      // L'annonce reste affichable si le navigateur bloque le stockage.
    }
    setIsOpen(true);
  }, [continueKey, dismissedVersionKey, hasReleaseNotes]);

  const dismissVersion = () => {
    try {
      localStorage.setItem(dismissedVersionKey, CURRENT_RELEASE_NOTES.version);
    } catch {
      // La fenêtre reste fermée pour cette session si le stockage est indisponible.
    }
    setIsOpen(false);
  };

  const continueUntilNextLogin = () => {
    try { sessionStorage.setItem(continueKey, CURRENT_RELEASE_NOTES.version); } catch { /* Fermeture temporaire jusqu'au prochain rendu. */ }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") continueUntilNextLogin();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, continueKey]);

  if (!isOpen) return null;

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
          <button className="release-dismiss-button" type="button" onClick={dismissVersion}>
            Ne plus afficher cette version
          </button>
          <button className="release-later-button" type="button" onClick={continueUntilNextLogin}>
            Continuer
          </button>
        </div>
      </section>

      <style>{`
        .release-modal-backdrop { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; padding: 24px; background: rgba(15, 30, 25, .52); backdrop-filter: blur(4px); }
        .release-modal { position: relative; width: min(100%, 560px); max-height: min(90vh, 760px); overflow-y: auto; padding: 34px; border: 1px solid rgba(25, 56, 50, .1); border-radius: 22px; background: #fff; box-shadow: 0 24px 80px rgba(9, 27, 22, .24); color: var(--color-text-main, #243630); }
        .release-modal-close { position: absolute; top: 18px; right: 18px; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--color-border, #e1e9e2); border-radius: 50%; background: #fff; color: #52665b; cursor: pointer; }
        .release-modal-icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 15px; background: #eef5ef; color: #285c43; }
        .release-modal-eyebrow { margin: 20px 0 7px; color: #548162; font-size: .75rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
        .release-modal h2 { margin: 0; color: #193832; font-size: 1.65rem; line-height: 1.2; }
        .release-modal-intro { margin: 10px 0 22px; color: #64736b; font-size: .92rem; line-height: 1.5; }
        .release-modal-list { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
        .release-modal-list li { display: grid; grid-template-columns: 26px 1fr; gap: 11px; align-items: start; }
        .release-modal-bullet { display: grid; place-items: center; width: 25px; height: 25px; margin-top: 1px; border-radius: 50%; background: #edf5ee; color: #356c4b; }
        .release-modal-list strong { color: #263b32; font-size: .9rem; }
        .release-modal-list p { margin: 3px 0 0; color: #68776f; font-size: .83rem; line-height: 1.45; }
        .release-modal-actions { display: flex; justify-content: space-between; gap: 12px; margin-top: 26px; padding-top: 18px; border-top: 1px solid #edf0ed; }
        .release-dismiss-button, .release-later-button { min-height: 42px; padding: 0 17px; border-radius: 999px; font: inherit; font-size: .85rem; font-weight: 650; cursor: pointer; }
        .release-dismiss-button { border: 1px solid #dce5dd; background: #fff; color: #53655a; }
        .release-later-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #193832; background: #193832; color: #fff; }
        @media (max-width: 520px) { .release-modal { padding: 26px 21px 21px; border-radius: 18px; } .release-modal h2 { font-size: 1.4rem; } }
      `}</style>
    </div>
  );
};
