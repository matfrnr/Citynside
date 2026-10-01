import {
  BadgeCheck,
  Star,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesColumnIncreasing,
  LogOut,
  KeyRound,
  Mail,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  type ProfileDetails,
  isValidPhoneNumber,
  saveUserProfile,
  changeUserPassword,
} from "../../services/profile";
import { type AuthUser, LOCAL_DEMO_USER_ID } from "../../types";

interface ProfileViewProps {
  analysesCount: number;
  favoritesCount: number;
  user: AuthUser;
  onLogout: () => void;
  onUpdateUser?: (updated: AuthUser) => void;
  onProfileSaved?: () => void;
  onPasswordChanged?: () => void;
}

const loadProfile = (user: AuthUser): ProfileDetails => {
  const [defaultFirstName = user.name, ...lastNameParts] = user.name.split(" ");
  return {
    firstName: user.firstName || defaultFirstName,
    lastName:
      user.lastName !== undefined ? user.lastName : lastNameParts.join(" "),
    email: user.email,
    phone: user.phone || "",
    agency: user.agency || "Agence immobilière",
    agencyCity: user.agencyCity || "",
    role: user.role || "Agent immobilier",
  };
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  analysesCount,
  favoritesCount,
  user,
  onLogout,
  onUpdateUser,
  onProfileSaved,
  onPasswordChanged,
}) => {
  const [profile, setProfile] = useState<ProfileDetails>(() =>
    loadProfile(user),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Re-synchronise si user change (ex: modification reçue en direct depuis un autre appareil)
  useEffect(() => {
    setProfile(loadProfile(user));
  }, [user]);

  const updateField = (field: keyof ProfileDetails, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setSaveError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setSaved(false);

    const cleanPhone = profile.phone.trim();
    if (cleanPhone && !isValidPhoneNumber(cleanPhone)) {
      setSaveError(
        "Numéro de téléphone invalide : 10 chiffres requis (ex : 06 12 34 56 78) ou format international (+33...). Les valeurs partielles comme 1234 sont refusées.",
      );
      setIsSaving(false);
      return;
    }

    const fullName =
      `${profile.firstName} ${profile.lastName}`.trim() || user.name;

    const updatedUser: AuthUser = {
      ...user,
      name: fullName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: cleanPhone,
      agency: profile.agency,
      agencyCity: profile.agencyCity,
      role: profile.role,
    };
    const profileChanged =
      updatedUser.firstName !== user.firstName ||
      updatedUser.lastName !== user.lastName ||
      updatedUser.phone !== (user.phone || "") ||
      updatedUser.agency !== (user.agency || "Agence immobilière") ||
      updatedUser.role !== (user.role || "Agent immobilier") ||
      updatedUser.agencyCity !== (user.agencyCity || "");

    try {
      if (user.id !== LOCAL_DEMO_USER_ID) {
        const freshUser = await saveUserProfile(user, {
          ...profile,
          phone: cleanPhone,
        });
        onUpdateUser?.(freshUser);
      } else {
        onUpdateUser?.(updatedUser);
      }

      if (profileChanged) onProfileSaved?.();
      setSaved(true);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const initials =
    `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();

  return (
    <section className="profile-page">
      <header className="profile-heading">
        <div>
          <p className="profile-eyebrow">MON ESPACE</p>
          <h1>Profil</h1>
          <p className="profile-subtitle">
            Gérez vos informations et votre activité Citynside.
          </p>
        </div>
        <span className="profile-status">
          <BadgeCheck size={17} /> Compte actif
        </span>
        <button type="button" className="profile-logout" onClick={onLogout}>
          <LogOut size={16} /> Déconnexion
        </button>
      </header>

      <div className="profile-layout">
        <aside className="profile-summary">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              {initials}
            </div>
            <h2>
              {profile.firstName} {profile.lastName}
            </h2>
            <p>{profile.role}</p>
            <span className="profile-agency">
              <Building2 size={15} /> {profile.agency}
            </span>
          </div>

          <div className="profile-stats" aria-label="Votre activité">
            <div className="profile-stat">
              <span className="stat-icon">
                <ChartNoAxesColumnIncreasing size={18} />
              </span>
              <span className="stat-value">{analysesCount}</span>
              <span className="stat-label">Analyses réalisées</span>
            </div>
            <div className="profile-stat">
              <span className="stat-icon">
                <Star size={18} />
              </span>
              <span className="stat-value">{favoritesCount}</span>
              <span className="stat-label">Adresses favorites</span>
            </div>
          </div>
        </aside>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <div>
              <h2>Informations personnelles</h2>
              <p>
                Ces informations vous permettent de personnaliser votre espace.
              </p>
            </div>
            <UserRound size={21} aria-hidden="true" />
          </div>

          <div className="profile-fields">
            <label className="profile-field">
              <span>Prénom</span>
              <input
                required
                value={profile.firstName}
                onChange={(event) =>
                  updateField("firstName", event.target.value)
                }
              />
            </label>
            <label className="profile-field">
              <span>Nom</span>
              <input
                required
                value={profile.lastName}
                onChange={(event) =>
                  updateField("lastName", event.target.value)
                }
              />
            </label>
            <label className="profile-field field-with-icon">
              <span>Adresse e-mail</span>
              <span className="input-wrap">
                <Mail size={17} />
                <input
                  required
                  type="email"
                  value={profile.email}
                  readOnly
                  aria-describedby="profile-email-note"
                />
              </span>
              <span id="profile-email-note" className="profile-field-note">
                Adresse utilisée pour la connexion
              </span>
            </label>
            <label
              className={`profile-field field-with-icon ${
                profile.phone.trim() && !isValidPhoneNumber(profile.phone)
                  ? "field-error"
                  : ""
              }`}
            >
              <span>Téléphone</span>
              <span className="input-wrap">
                <Phone size={17} />
                <input
                  type="tel"
                  value={profile.phone}
                  placeholder="06 12 34 56 78 ou +33 6 12 34 56 78"
                  pattern="^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$|^\+(?:[0-9][\s.-]?){9,15}$"
                  title="Numéro valide à 10 chiffres (ex: 06 12 34 56 78) ou international (+33...)"
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </span>
              {Boolean(
                profile.phone.trim() && !isValidPhoneNumber(profile.phone),
              ) ? (
                <span className="profile-field-error">
                  Numéro invalide : 10 chiffres requis (ex : 06 12 34 56 78)
                </span>
              ) : (
                <span className="profile-field-note">
                  Format standard : 06 12 34 56 78 ou international (+33...)
                </span>
              )}
            </label>
            <label className="profile-field field-with-icon">
              <span>Agence</span>
              <span className="input-wrap">
                <Building2 size={17} />
                <input
                  value={profile.agency}
                  onChange={(event) =>
                    updateField("agency", event.target.value)
                  }
                />
              </span>
            </label>
            <label className="profile-field field-with-icon">
              <span>Fonction</span>
              <span className="input-wrap">
                <BriefcaseBusiness size={17} />
                <input
                  value={profile.role}
                  onChange={(event) => updateField("role", event.target.value)}
                />
              </span>
            </label>
            <label className="profile-field field-with-icon">
              <span>Ville de l’agence</span>
              <span className="input-wrap">
                <Building2 size={17} />
                <input
                  value={profile.agencyCity}
                  placeholder="Grenoble"
                  onChange={(event) => updateField("agencyCity", event.target.value)}
                />
              </span>
              <span className="profile-field-note">Utilisée pour la veille des projets et évolutions locales.</span>
            </label>
          </div>

          <div className="profile-form-footer">
            <span
              className={`save-feedback ${saved ? "is-saved" : ""} ${saveError ? "is-error" : ""}`}
              aria-live="polite"
            >
              {saveError
                ? saveError
                : saved
                  ? "Modifications enregistrées sur votre compte"
                  : isSaving
                    ? "Enregistrement en cours..."
                    : "Vos modifications sont synchronisées avec votre compte."}
            </span>
            <button
              type="submit"
              className="save-profile"
              disabled={isSaving}
            >
              <Save size={17} /> {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>

      <form className="password-form" onSubmit={async (event) => {
        event.preventDefault();
        setPasswordError(""); setPasswordMessage("");
        if (user.id === LOCAL_DEMO_USER_ID) { setPasswordError("Le compte de démonstration ne possède pas de mot de passe modifiable."); return; }
        if (newPassword !== confirmPassword) { setPasswordError("Les deux mots de passe ne correspondent pas."); return; }
        setIsChangingPassword(true);
        try {
          await changeUserPassword(newPassword);
          setNewPassword(""); setConfirmPassword("");
          setPasswordMessage("Votre mot de passe a été modifié.");
          onPasswordChanged?.();
        } catch (err) {
          setPasswordError(err instanceof Error ? err.message : "Impossible de modifier le mot de passe.");
        } finally { setIsChangingPassword(false); }
      }}>
        <div className="form-heading">
          <div><h2>Mot de passe</h2><p>Une notification de sécurité sera ajoutée après chaque modification.</p></div>
          <KeyRound size={21} aria-hidden="true" />
        </div>
        <div className="password-fields">
          <label className="profile-field"><span>Nouveau mot de passe</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="8 caractères minimum" /></label>
          <label className="profile-field"><span>Confirmer le mot de passe</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        </div>
        <div className="password-footer"><span className={passwordError ? "password-error" : "password-success"} role="status">{passwordError || passwordMessage}</span><button className="save-profile" type="submit" disabled={isChangingPassword}><KeyRound size={16}/>{isChangingPassword ? "Modification…" : "Modifier le mot de passe"}</button></div>
      </form>

      <style>{`
        .profile-page {
          max-width: 1040px;
          margin: 0 auto;
          color: var(--color-text-main);
          animation: profile-enter 0.35s ease both;
        }

        .profile-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .profile-logout {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 11px;
          border: 1px solid var(--color-border);
          border-radius: 5px;
          background: #fff;
          color: var(--color-primary);
          font: inherit;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .profile-logout:hover { background: #f5f8f3; }

        .profile-eyebrow {
          color: #527f5e;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 5px;
        }

        .profile-heading h1 {
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-size: 2rem;
          line-height: 1.15;
        }

        .profile-subtitle {
          color: var(--color-text-muted);
          font-size: 0.88rem;
          margin-top: 7px;
        }

        .profile-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #276646;
          background: #e7f3e8;
          padding: 8px 12px;
          border-radius: 7px;
          font-size: 0.78rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .profile-layout {
          display: grid;
          grid-template-columns: minmax(235px, 0.78fr) minmax(0, 1.8fr);
          gap: 22px;
          align-items: start;
        }

        .profile-summary, .profile-form {
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          box-shadow: var(--shadow-subtle);
        }

        .profile-summary { overflow: hidden; }

        .profile-identity {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 28px 20px 24px;
          text-align: center;
          background: linear-gradient(145deg, #f0f7ef, #fff 78%);
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .profile-avatar {
          display: grid;
          place-items: center;
          width: 82px;
          aspect-ratio: 1;
          border-radius: 50%;
          border: 3px solid #fff;
          background: #d8e9d2;
          color: var(--color-primary);
          box-shadow: 0 0 0 1px #c5ddc1;
          font-family: var(--font-family-heading);
          font-size: 1.65rem;
          font-weight: 700;
        }

        .profile-identity h2 {
          margin-top: 14px;
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-size: 1.15rem;
        }

        .profile-identity > p {
          margin-top: 4px;
          color: var(--color-text-muted);
          font-size: 0.8rem;
        }

        .profile-agency {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 13px;
          color: #456c54;
          font-size: 0.76rem;
        }

        .profile-stats { padding: 4px 20px; }

        .profile-stat {
          display: grid;
          grid-template-columns: 36px 1fr;
          grid-template-rows: auto auto;
          column-gap: 11px;
          align-items: center;
          padding: 17px 0;
        }

        .profile-stat + .profile-stat { border-top: 1px solid var(--color-border-subtle); }

        .stat-icon {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          grid-row: 1 / 3;
          border-radius: 7px;
          background: #f1f6e8;
          color: #527f5e;
        }

        .stat-value { color: var(--color-primary); font-size: 1.08rem; font-weight: 700; }
        .stat-label { color: var(--color-text-muted); font-size: 0.72rem; }

        .profile-form { padding: 24px 26px 20px; }

        .password-form { margin-top: 20px; padding: 24px 26px 20px; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; box-shadow: var(--shadow-subtle); }
        .password-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 17px 18px; padding: 22px 0; }
        .password-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .password-error { color: #a12d27; font-size: .78rem; }
        .password-success { color: #276646; font-size: .78rem; }

        .form-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 19px;
          border-bottom: 1px solid var(--color-border-subtle);
          color: #63856a;
        }

        .form-heading h2 {
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-size: 1.14rem;
        }

        .form-heading p { margin-top: 5px; color: var(--color-text-muted); font-size: 0.78rem; }
        .profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 17px 18px; padding: 22px 0; }

        .profile-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
        .profile-field-note { color: var(--color-text-muted); font-size: 0.68rem; }
        .profile-field > span:first-child { color: #375457; font-size: 0.76rem; font-weight: 600; }

        .profile-field input {
          width: 100%;
          min-width: 0;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #dce7df;
          border-radius: 5px;
          outline: none;
          background: #fff;
          color: var(--color-text-main);
          font: inherit;
          font-size: 0.82rem;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .profile-field input:focus { border-color: #76a77a; box-shadow: 0 0 0 3px rgba(118, 167, 122, 0.14); }
        .profile-field input:read-only { background: #f5f8f5; color: var(--color-text-muted); }
        .input-wrap { position: relative; display: flex; align-items: center; color: #7e9990; }
        .input-wrap > svg { position: absolute; left: 11px; pointer-events: none; }
        .input-wrap input { padding-left: 36px; }

        .profile-field-error {
          font-size: 0.72rem;
          color: #c93b2b;
          font-weight: 500;
        }

        .profile-field.field-error input {
          border-color: #c93b2b !important;
          background: #fff8f7;
        }
        .profile-field.field-error input:focus {
          box-shadow: 0 0 0 3px rgba(201, 59, 43, 0.15) !important;
        }

        .profile-form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding-top: 17px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .save-feedback { color: var(--color-text-muted); font-size: 0.72rem; }
        .save-feedback.is-saved { color: #287149; }
        .save-feedback.is-error { color: #c93b2b; }

        .save-profile {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 0;
          border-radius: 5px;
          background: var(--color-primary);
          color: #fff;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .save-profile:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none !important;
        }

        .save-profile:hover:not(:disabled) { background: var(--color-primary-light); transform: translateY(-1px); }
        .save-profile:focus-visible { outline: 3px solid #9dc599; outline-offset: 2px; }

        @keyframes profile-enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 760px) {
          .profile-layout { grid-template-columns: 1fr; }
          .profile-summary { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(180px, 0.9fr); }
          .profile-identity { justify-content: center; border-right: 1px solid var(--color-border-subtle); border-bottom: 0; }
          .profile-stats { align-self: center; }
        }

        @media (max-width: 520px) {
          .profile-heading { align-items: flex-start; flex-direction: row; flex-wrap: wrap; margin-bottom: 20px; }
          .profile-layout { gap: 14px; }
          .profile-summary { grid-template-columns: 1fr; }
          .profile-identity { border-right: 0; border-bottom: 1px solid var(--color-border-subtle); }
          .profile-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .profile-stat { grid-template-columns: 30px 1fr; column-gap: 7px; }
          .stat-icon { width: 30px; height: 30px; }
          .profile-form { padding: 20px 16px 16px; }
          .profile-fields { grid-template-columns: 1fr; gap: 14px; padding: 18px 0; }
          .password-fields { grid-template-columns: 1fr; gap: 14px; padding: 18px 0; }
          .password-footer { align-items: flex-start; flex-direction: column; }
          .profile-form-footer { align-items: stretch; flex-direction: column; }
          .save-profile { width: 100%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-page { animation: none; }
        }
      `}</style>
    </section>
  );
};
