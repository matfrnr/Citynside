import React, { useState } from "react";
import { MapPin, UserRound, X } from "lucide-react";
import { saveUserProfile } from "../../services/profile";
import type { AuthUser } from "../../types";

interface ProfileSetupModalProps {
  user: AuthUser;
  onComplete: (user: AuthUser) => void;
  onDismiss: () => void;
}

export const needsProfileSetup = (user: AuthUser): boolean =>
  user.id !== "local-demo-user" &&
  (!user.firstName?.trim() || !user.lastName?.trim());

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ user, onComplete, onDismiss }) => {
  const [firstName, setFirstName] = useState(user.firstName?.trim() || "Agent");
  const [lastName, setLastName] = useState(user.lastName?.trim() || "Citynside");
  const [city, setCity] = useState(user.agencyCity || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const updated = await saveUserProfile(user, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: user.email,
        phone: user.phone || "",
        agency: user.agency || "Agence immobilière",
        agencyCity: city.trim(),
        role: user.role || "Agent immobilier",
      });
      onComplete(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer ces informations.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-setup-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
      <section className="profile-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-setup-title">
        <button type="button" className="profile-setup-close" onClick={onDismiss} aria-label="Compléter plus tard"><X size={18} /></button>
        <span className="profile-setup-icon"><UserRound size={22} /></span>
        <p className="profile-setup-eyebrow">VOTRE PROFIL</p>
        <h2 id="profile-setup-title">Bienvenue sur Citynside</h2>
        <p className="profile-setup-intro">Pour personnaliser votre espace et vos rapports, indiquez votre nom et votre ville.</p>
        <form onSubmit={handleSubmit}>
          <label>Prénom<input autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
          <label>Nom<input autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          <label className="profile-setup-city-label"><span><MapPin size={15} /> Ville (facultatif)</span><input autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Grenoble" /></label>
          {error && <p className="profile-setup-error" role="alert">{error}</p>}
          <button className="profile-setup-submit" type="submit" disabled={isSaving}>{isSaving ? "Enregistrement…" : "Enregistrer mon profil"}</button>
        </form>
        <button type="button" className="profile-setup-later" onClick={onDismiss}>Je le ferai plus tard</button>
      </section>
      <style>{`
        .profile-setup-overlay { position: fixed; inset: 0; z-index: 12000; display: grid; place-items: center; padding: 18px; background: rgba(13, 31, 26, .58); backdrop-filter: blur(4px); }
        .profile-setup-dialog { position: relative; width: min(100%, 430px); max-height: calc(100dvh - 36px); overflow-y: auto; padding: 30px; border: 1px solid #e2eae2; border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(0, 0, 0, .24); color: #173830; }
        .profile-setup-close { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 10px; background: #f3f6f2; color: #587068; cursor: pointer; }
        .profile-setup-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 13px; background: #eaf3e7; color: #416b4c; }
        .profile-setup-eyebrow { margin-top: 20px; color: #548162; font-size: .68rem; font-weight: 750; letter-spacing: .1em; }
        .profile-setup-dialog h2 { margin-top: 5px; font-size: 1.45rem; line-height: 1.2; }
        .profile-setup-intro { margin: 9px 0 20px; color: #667872; font-size: .85rem; line-height: 1.5; }
        .profile-setup-dialog form { display: grid; gap: 12px; }
        .profile-setup-dialog label { display: grid; gap: 6px; color: #39554b; font-size: .77rem; font-weight: 650; }
        .profile-setup-dialog label>span { display: inline-flex; align-items: center; gap: 6px; }
        .profile-setup-dialog input { width: 100%; min-height: 43px; padding: 0 12px; border: 1px solid #d7e1d8; border-radius: 9px; outline: none; background: #fff; color: #173830; font: inherit; font-size: .87rem; }
        .profile-setup-dialog input:focus { border-color: #5b8c65; box-shadow: 0 0 0 3px rgba(91, 140, 101, .14); }
        .profile-setup-submit { min-height: 45px; margin-top: 4px; border: 0; border-radius: 9px; background: #28543f; color: #fff; font: inherit; font-size: .86rem; font-weight: 700; cursor: pointer; }
        .profile-setup-submit:hover { background: #1f4534; }
        .profile-setup-submit:disabled { opacity: .65; cursor: wait; }
        .profile-setup-later { display: block; margin: 11px auto 0; padding: 7px; border: 0; background: transparent; color: #71817a; font: inherit; font-size: .76rem; cursor: pointer; }
        .profile-setup-later:hover { color: #28543f; text-decoration: underline; }
        .profile-setup-error { margin: 0; color: #b42318; font-size: .78rem; line-height: 1.4; }
        @media (max-width: 480px) { .profile-setup-dialog { padding: 25px 21px 20px; border-radius: 15px; } }
      `}</style>
    </div>
  );
};
