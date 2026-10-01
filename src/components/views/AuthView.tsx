import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Train,
  Trees,
  ShoppingBag,
  GraduationCap,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { mapSupabaseUser, supabase } from "../../services/supabase";
import { type AuthUser, LOCAL_DEMO_USER_ID } from "../../types";

interface AuthViewProps {
  onAuthenticated: (user: AuthUser) => void;
}

interface AuthFields {
  email: string;
  password: string;
}

const LOCAL_DEMO_USER: AuthUser = {
  id: LOCAL_DEMO_USER_ID,
  name: "Compte de démonstration",
  email: "demo@citynside.local",
};

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
  const [fields, setFields] = useState<AuthFields>({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal / popover mot de passe oublié
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const updateField = (field: keyof AuthFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: fields.email.trim(),
          password: fields.password,
        });

      if (authError) {
        if (
          authError.message.includes("Invalid login credentials") ||
          authError.message.includes("invalid_grant")
        ) {
          setError("Adresse e-mail ou mot de passe incorrect.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError(
            "Votre compte n’a pas encore été activé. Veuillez cliquer sur le lien reçu dans votre e-mail d'invitation.",
          );
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        onAuthenticated(mapSupabaseUser(data.user));
      }
    } catch {
      setError(
        "Le service d'authentification est indisponible. Veuillez vérifier votre connexion.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotError("");
    setForgotSuccess(false);

    if (!forgotEmail.trim()) {
      setForgotError("Veuillez renseigner votre adresse e-mail professionnelle.");
      return;
    }

    setForgotBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim(),
        {
          redirectTo: window.location.origin,
        },
      );

      if (resetError) {
        setForgotError(resetError.message);
      } else {
        setForgotSuccess(true);
      }
    } catch {
      setForgotError("Impossible d'envoyer l'e-mail de réinitialisation.");
    } finally {
      setForgotBusy(false);
    }
  };

  const enterDemoMode = () => onAuthenticated(LOCAL_DEMO_USER);

  return (
    <main className="auth-container">
      {/* Colonne gauche : Formulaire moderne & épuré */}
      <section className="auth-form-panel">
        <header className="auth-header">
          <a className="auth-brand" href="/" aria-label="Citynside, accueil">
            <div className="auth-brand-logo-wrap">
              <img src="/logo-citynside.svg" alt="" width={32} height={32} />
            </div>
            <div className="auth-brand-text">
              <span className="auth-brand-name">Citynside</span>
              <span className="auth-brand-badge">PRO</span>
            </div>
          </a>

          <div className="auth-status-pill">
            <span className="auth-status-dot" />
            <span className="auth-status-text">Plateforme opérationnelle</span>
          </div>
        </header>

        <div className="auth-body">
          <div className="auth-title-group">
            <div className="auth-badge">
              <KeyRound size={13} className="auth-badge-icon" aria-hidden="true" />
              <span>ESPACE PROFESSIONNEL SÉCURISÉ</span>
            </div>
            <h1>Bienvenue</h1>
            <p className="auth-subtitle">
              Connectez-vous pour évaluer vos quartiers, générer vos fiches d'estimation et convaincre vos acquéreurs.
            </p>
          </div>

          <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="auth-email">Adresse e-mail professionnelle</label>
              <div className="auth-input-container">
                <Mail size={18} className="auth-input-icon" aria-hidden="true" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="agent@cabinet-immobilier.fr"
                  value={fields.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field-header">
                <label htmlFor="auth-password">Mot de passe</label>
                <button
                  type="button"
                  className="auth-link-forgot"
                  onClick={() => {
                    setForgotEmail(fields.email);
                    setForgotError("");
                    setForgotSuccess(false);
                    setShowForgotModal(true);
                  }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="auth-input-container">
                <LockKeyhole size={18} className="auth-input-icon" aria-hidden="true" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={256}
                  required
                  placeholder="••••••••••••"
                  value={fields.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error-card" role="alert">
                <span className="auth-error-indicator" />
                <p>{error}</p>
              </div>
            )}

            <button className="auth-submit-btn" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={18} className="auth-spinner" aria-hidden="true" />
                  <span>Connexion en cours…</span>
                </>
              ) : (
                <>
                  <span>Accéder à mon espace</span>
                  <div className="auth-submit-arrow">
                    <ArrowRight size={17} aria-hidden="true" />
                  </div>
                </>
              )}
            </button>

            <div className="auth-divider">
              <span>ou</span>
            </div>

            <button
              className="auth-demo-btn"
              type="button"
              onClick={enterDemoMode}
            >
              <div className="auth-demo-icon">
                <Sparkles size={16} />
              </div>
              <div className="auth-demo-content">
                <span className="auth-demo-title">Explorer le compte Démo</span>
                <span className="auth-demo-hint">Accès instantané sans identifiants</span>
              </div>
              <ArrowRight size={15} className="auth-demo-chevron" />
            </button>
          </form>

          {/* Carte d'accès sur invitation */}
          <div className="auth-invitation-card">
            <div className="auth-invitation-icon-wrapper">
              <ShieldCheck size={20} className="auth-invitation-icon" />
            </div>
            <div className="auth-invitation-info">
              <h4>Accès privé réservé aux agents partenaires</h4>
              <p>
                Citynside fonctionne sur invitation nominale. Pour activer votre accès agence, contactez le référent de votre réseau.
              </p>
            </div>
          </div>
        </div>

        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} Citynside Inc.</span>
          <span className="auth-footer-dot">•</span>
          <span>Données géographiques certifiées</span>
          <span className="auth-footer-dot">•</span>
          <span>Connexion chiffrée SSL</span>
        </footer>
      </section>

      {/* Colonne droite : Vitrine visuelle moderne & élégante */}
      <aside className="auth-showcase-panel" aria-label="Présentation Citynside">
        {/* Cercles de lumière d'ambiance */}
        <div className="auth-mesh-glow auth-mesh-glow-1" />
        <div className="auth-mesh-glow auth-mesh-glow-2" />

        {/* Motif géométrique discret */}
        <div className="auth-grid-overlay" />

        <div className="auth-showcase-inner">
          {/* Badge en haut à droite */}
          <div className="auth-showcase-top">
            <div className="auth-data-badge">
              <Building2 size={15} />
              <span>Plus de 12 000 adresses analysées en France</span>
            </div>
          </div>

          {/* Carte de simulation Citynside interactive et flottante */}
          <div className="auth-preview-card">
            <div className="auth-preview-header">
              <div className="auth-preview-location">
                <div className="auth-pin-circle">
                  <MapPin size={16} />
                </div>
                <div>
                  <span className="auth-preview-tag">ANALYSE EN DIRECT</span>
                  <h3>14 Rue de la Paix, 75002 Paris</h3>
                </div>
              </div>
              <div className="auth-preview-global-score">
                <div className="auth-score-circle">
                  <span className="auth-score-number">8.9</span>
                  <span className="auth-score-max">/10</span>
                </div>
                <span className="auth-score-label">Zone premium</span>
              </div>
            </div>

            <div className="auth-preview-stats">
              <div className="auth-stat-tile">
                <div className="auth-stat-icon-wrap" style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                  <Train size={16} />
                </div>
                <div className="auth-stat-details">
                  <span className="auth-stat-name">Transports</span>
                  <div className="auth-stat-bar-bg">
                    <div className="auth-stat-bar-fill" style={{ width: "95%", background: "#4caf50" }} />
                  </div>
                </div>
                <span className="auth-stat-val">9.5</span>
              </div>

              <div className="auth-stat-tile">
                <div className="auth-stat-icon-wrap" style={{ background: "#fff8e1", color: "#f57f17" }}>
                  <ShoppingBag size={16} />
                </div>
                <div className="auth-stat-details">
                  <span className="auth-stat-name">Commerces & Services</span>
                  <div className="auth-stat-bar-bg">
                    <div className="auth-stat-bar-fill" style={{ width: "91%", background: "#ffb300" }} />
                  </div>
                </div>
                <span className="auth-stat-val">9.1</span>
              </div>

              <div className="auth-stat-tile">
                <div className="auth-stat-icon-wrap" style={{ background: "#e0f2f1", color: "#00796b" }}>
                  <Trees size={16} />
                </div>
                <div className="auth-stat-details">
                  <span className="auth-stat-name">Cadre de vie & Calme</span>
                  <div className="auth-stat-bar-bg">
                    <div className="auth-stat-bar-fill" style={{ width: "82%", background: "#26a69a" }} />
                  </div>
                </div>
                <span className="auth-stat-val">8.2</span>
              </div>

              <div className="auth-stat-tile">
                <div className="auth-stat-icon-wrap" style={{ background: "#ede7f6", color: "#512da8" }}>
                  <GraduationCap size={16} />
                </div>
                <div className="auth-stat-details">
                  <span className="auth-stat-name">Écoles & Crèches</span>
                  <div className="auth-stat-bar-bg">
                    <div className="auth-stat-bar-fill" style={{ width: "88%", background: "#7e57c2" }} />
                  </div>
                </div>
                <span className="auth-stat-val">8.8</span>
              </div>
            </div>

            <div className="auth-preview-quote">
              <CheckCircle2 size={16} className="auth-quote-icon" />
              <p>Rapport instantané téléchargeable et prêt pour signature en visite.</p>
            </div>
          </div>

          {/* Slogan en bas du panneau vitrine */}
          <div className="auth-showcase-bottom">
            <h2>L’intelligence de quartier au service de vos mandats</h2>
            <p>
              Donnez des réponses précises, objectives et chiffrées à chaque interrogation de vos clients acquéreurs et vendeurs.
            </p>
          </div>
        </div>
      </aside>

      {/* Modal / Dialog Mot de passe oublié */}
      {showForgotModal && (
        <div className="auth-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div
            className="auth-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <div className="auth-modal-header">
              <div className="auth-modal-title-wrap">
                <HelpCircle size={22} className="auth-modal-icon" />
                <h3 id="forgot-modal-title">Réinitialisation d'accès</h3>
              </div>
              <button
                type="button"
                className="auth-modal-close"
                onClick={() => setShowForgotModal(false)}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="auth-modal-success">
                <CheckCircle2 size={44} className="auth-modal-success-icon" />
                <h4>E-mail de récupération envoyé !</h4>
                <p>
                  Si un compte est associé à <strong>{forgotEmail}</strong>, vous recevrez un lien sécurisé permettant de définir un nouveau mot de passe.
                </p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => setShowForgotModal(false)}
                >
                  Revenir à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="auth-modal-form">
                <p className="auth-modal-desc">
                  Saisissez l'adresse e-mail professionnelle liée à votre compte Citynside. Nous vous transmettrons un lien de réinitialisation sécurisé.
                </p>

                <div className="auth-field">
                  <label htmlFor="forgot-email">Adresse e-mail</label>
                  <div className="auth-input-container">
                    <Mail size={18} className="auth-input-icon" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="agent@cabinet-immobilier.fr"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                </div>

                {forgotError && (
                  <div className="auth-error-card" role="alert">
                    <span className="auth-error-indicator" />
                    <p>{forgotError}</p>
                  </div>
                )}

                <div className="auth-modal-actions">
                  <button
                    type="button"
                    className="auth-modal-cancel"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={forgotBusy}
                  >
                    {forgotBusy ? (
                      <>
                        <Loader2 size={16} className="auth-spinner" />
                        <span>Envoi…</span>
                      </>
                    ) : (
                      <span>Envoyer le lien</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Styles CSS modernes et soignés */}
      <style>{`
        /* =========================================================
           CONTENEUR PRINCIPAL & LAYOUT SPLIT
           ========================================================= */
        .auth-container {
          display: grid;
          grid-template-columns: minmax(460px, 46%) 1fr;
          min-height: 100vh;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #ffffff;
          font-family: var(--font-family-body, 'Poppins', sans-serif);
          color: #0e2325;
        }

        /* =========================================================
           COLONNE GAUCHE (FORMULAIRE)
           ========================================================= */
        .auth-form-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100vh;
          overflow-y: auto;
          padding: 36px clamp(28px, 5vw, 68px) 24px;
          background: #ffffff;
          position: relative;
          z-index: 2;
          box-shadow: 10px 0 40px rgba(14, 35, 37, 0.04);
        }

        /* En-tête */
        .auth-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 20px;
        }

        .auth-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .auth-brand-logo-wrap {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f7f1;
          border-radius: 10px;
          border: 1px solid #dce9dc;
          box-shadow: 0 2px 6px rgba(21, 58, 61, 0.06);
          transition: transform 0.2s ease;
        }

        .auth-brand:hover .auth-brand-logo-wrap {
          transform: scale(1.04);
        }

        .auth-brand-text {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .auth-brand-name {
          font-family: var(--font-family-heading, 'Fira Sans', sans-serif);
          font-size: 1.25rem;
          font-weight: 800;
          color: #153a3d;
          letter-spacing: -0.02em;
        }

        .auth-brand-badge {
          background: #153a3d;
          color: #f1e850;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .auth-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #f4f8f4;
          border: 1px solid #e1ebe1;
          padding: 5px 11px;
          border-radius: 9999px;
        }

        .auth-status-dot {
          width: 7px;
          height: 7px;
          background: #2ea55f;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(46, 165, 95, 0.2);
          animation: pulseDot 2.2s infinite;
        }

        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 2px rgba(46, 165, 95, 0.2); }
          50% { box-shadow: 0 0 0 5px rgba(46, 165, 95, 0.35); }
        }

        .auth-status-text {
          font-size: 0.72rem;
          color: #4b6863;
          font-weight: 500;
        }

        /* Corps central */
        .auth-body {
          width: 100%;
          max-width: 430px;
          margin: 20px auto;
        }

        .auth-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(157, 197, 153, 0.18);
          border: 1px solid rgba(157, 197, 153, 0.45);
          border-radius: 9999px;
          color: #215e2e;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .auth-badge-icon {
          color: #2e7d32;
        }

        .auth-title-group h1 {
          font-family: var(--font-family-heading, 'Fira Sans', sans-serif);
          font-size: 2.1rem;
          font-weight: 700;
          color: #102d2f;
          margin: 0;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }

        .auth-subtitle {
          margin: 10px 0 0;
          color: #55726e;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        /* Formulaire */
        .auth-form {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .auth-field label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #1a4244;
          letter-spacing: -0.01em;
        }

        .auth-field-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .auth-link-forgot {
          background: transparent;
          border: none;
          color: #386d52;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s ease, text-decoration 0.15s ease;
        }

        .auth-link-forgot:hover {
          color: #153a3d;
          text-decoration: underline;
        }

        .auth-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .auth-input-icon {
          position: absolute;
          left: 14px;
          color: #8aa39f;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .auth-input-container input {
          width: 100%;
          height: 48px;
          padding: 0 42px 0 44px;
          border: 1.5px solid #dbe6de;
          border-radius: 10px;
          background: #fdfefe;
          color: #0e2325;
          font-size: 0.88rem;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .auth-input-container input:hover {
          border-color: #bcd1c1;
        }

        .auth-input-container input:focus {
          border-color: #153a3d;
          background: #ffffff;
          box-shadow: 0 0 0 3.5px rgba(21, 58, 61, 0.12), 0 2px 4px rgba(0, 0, 0, 0.02);
          outline: none;
        }

        .auth-input-container:focus-within .auth-input-icon {
          color: #153a3d;
        }

        .auth-password-toggle {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          padding: 6px;
          color: #7b9490;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .auth-password-toggle:hover {
          color: #153a3d;
          background: #f0f5f1;
        }

        /* Erreur */
        .auth-error-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fdf2f0;
          border: 1px solid #f6cfc9;
          border-radius: 9px;
          padding: 11px 14px;
          animation: shakeIn 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shakeIn {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }

        .auth-error-indicator {
          width: 5px;
          height: 18px;
          background: #d32f2f;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .auth-error-card p {
          margin: 0;
          color: #a82424;
          font-size: 0.8rem;
          font-weight: 500;
          line-height: 1.4;
        }

        /* Bouton Soumettre */
        .auth-submit-btn {
          width: 100%;
          height: 50px;
          background: linear-gradient(135deg, #153a3d 0%, #1e4e52 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(21, 58, 61, 0.22);
          transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
          margin-top: 4px;
        }

        .auth-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #102e30 0%, #174246 100%);
          box-shadow: 0 6px 20px rgba(21, 58, 61, 0.32);
          transform: translateY(-1.5px);
        }

        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(21, 58, 61, 0.2);
        }

        .auth-submit-btn:disabled {
          opacity: 0.75;
          cursor: wait;
        }

        .auth-submit-arrow {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }

        .auth-submit-btn:hover:not(:disabled) .auth-submit-arrow {
          transform: translateX(3px);
          background: rgba(255, 255, 255, 0.25);
        }

        .auth-spinner {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Séparateur */
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 6px 0;
          color: #a4b5b1;
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: "";
          flex: 1;
          border-bottom: 1px solid #e7efe9;
        }

        .auth-divider span {
          padding: 0 14px;
        }

        /* Bouton Démo */
        .auth-demo-btn {
          width: 100%;
          padding: 11px 16px;
          background: #f8fbf7;
          border: 1.5px solid #d7e7d5;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 14px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .auth-demo-btn:hover {
          background: #eff7ee;
          border-color: #9dc599;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(157, 197, 153, 0.15);
        }

        .auth-demo-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #9dc599;
          color: #102e30;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .auth-demo-btn:hover .auth-demo-icon {
          transform: scale(1.08) rotate(5deg);
        }

        .auth-demo-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .auth-demo-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: #173b3c;
        }

        .auth-demo-hint {
          font-size: 0.71rem;
          color: #6a827c;
        }

        .auth-demo-chevron {
          color: #809c95;
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .auth-demo-btn:hover .auth-demo-chevron {
          transform: translateX(3px);
          color: #173b3c;
        }

        /* Carte d'information d'invitation */
        .auth-invitation-card {
          margin-top: 26px;
          background: #fbfdfa;
          border: 1px solid #e3ede3;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .auth-invitation-icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #eef6ed;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2e7d32;
        }

        .auth-invitation-info h4 {
          margin: 0;
          font-size: 0.8rem;
          font-weight: 600;
          color: #1e443c;
          letter-spacing: -0.01em;
        }

        .auth-invitation-info p {
          margin: 4px 0 0;
          font-size: 0.73rem;
          color: #5c756f;
          line-height: 1.45;
        }

        /* Footer */
        .auth-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 0.71rem;
          color: #8c9e9b;
          padding-top: 20px;
          border-top: 1px solid #f0f4f1;
        }

        .auth-footer-dot {
          opacity: 0.5;
        }

        /* =========================================================
           COLONNE DROITE (VITRINE / SHOWCASE)
           ========================================================= */
        .auth-showcase-panel {
          position: relative;
          background-color: #0e2624;
          background-image:
            radial-gradient(ellipse at 85% 15%, rgba(157, 197, 153, 0.22), transparent 50%),
            radial-gradient(ellipse at 20% 80%, rgba(241, 232, 80, 0.12), transparent 45%),
            linear-gradient(155deg, rgba(14, 38, 36, 0.92) 0%, rgba(21, 58, 61, 0.94) 100%),
            url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80');
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px clamp(28px, 4vw, 56px);
          overflow: hidden;
        }

        /* Grille décorative */
        .auth-grid-overlay {
          position: absolute;
          inset: 0;
          background-size: 40px 40px;
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          pointer-events: none;
        }

        .auth-mesh-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }

        .auth-mesh-glow-1 {
          width: 380px;
          height: 380px;
          background: rgba(157, 197, 153, 0.25);
          top: 10%;
          right: -10%;
        }

        .auth-mesh-glow-2 {
          width: 320px;
          height: 320px;
          background: rgba(241, 232, 80, 0.16);
          bottom: 5%;
          left: 5%;
        }

        .auth-showcase-inner {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 520px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .auth-showcase-top {
          display: flex;
          justify-content: flex-start;
        }

        .auth-data-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #e2f4df;
          font-size: 0.74rem;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 9999px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
        }

        /* Carte de simulation flottante */
        .auth-preview-card {
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 20px;
          padding: 24px;
          box-shadow:
            0 24px 48px -12px rgba(8, 22, 21, 0.45),
            0 4px 12px rgba(0, 0, 0, 0.08);
          animation: floatCard 6s ease-in-out infinite;
        }

        @keyframes floatCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        .auth-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 18px;
          border-bottom: 1px solid #edf2ed;
        }

        .auth-preview-location {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .auth-pin-circle {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #153a3d;
          color: #9dc599;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .auth-preview-tag {
          display: block;
          font-size: 0.63rem;
          font-weight: 700;
          color: #438258;
          letter-spacing: 0.08em;
        }

        .auth-preview-location h3 {
          margin: 2px 0 0;
          font-size: 0.92rem;
          font-weight: 700;
          color: #102d2f;
        }

        .auth-preview-global-score {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .auth-score-circle {
          display: flex;
          align-items: baseline;
          gap: 2px;
          background: #153a3d;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 8px;
        }

        .auth-score-number {
          font-family: var(--font-family-heading, 'Fira Sans', sans-serif);
          font-size: 1.15rem;
          font-weight: 800;
          color: #f1e850;
        }

        .auth-score-max {
          font-size: 0.68rem;
          opacity: 0.75;
        }

        .auth-score-label {
          font-size: 0.66rem;
          font-weight: 600;
          color: #2e7d32;
          margin-top: 3px;
        }

        .auth-preview-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 18px 0;
        }

        .auth-stat-tile {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f7faf7;
          border: 1px solid #e7eee7;
          border-radius: 10px;
          padding: 8px 10px;
        }

        .auth-stat-icon-wrap {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .auth-stat-details {
          flex: 1;
          min-width: 0;
        }

        .auth-stat-name {
          display: block;
          font-size: 0.68rem;
          font-weight: 600;
          color: #274542;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .auth-stat-bar-bg {
          width: 100%;
          height: 4px;
          background: #e2ede2;
          border-radius: 2px;
          margin-top: 4px;
          overflow: hidden;
        }

        .auth-stat-bar-fill {
          height: 100%;
          border-radius: 2px;
        }

        .auth-stat-val {
          font-size: 0.75rem;
          font-weight: 700;
          color: #173b3c;
        }

        .auth-preview-quote {
          display: flex;
          align-items: center;
          gap: 9px;
          background: #edf6ec;
          border-left: 3px solid #2e7d32;
          padding: 8px 12px;
          border-radius: 0 8px 8px 0;
        }

        .auth-quote-icon {
          color: #2e7d32;
          flex-shrink: 0;
        }

        .auth-preview-quote p {
          margin: 0;
          font-size: 0.72rem;
          font-weight: 500;
          color: #254a37;
        }

        .auth-showcase-bottom h2 {
          font-family: var(--font-family-heading, 'Fira Sans', sans-serif);
          font-size: 1.6rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.25;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .auth-showcase-bottom p {
          margin: 10px 0 0;
          font-size: 0.85rem;
          color: #c0ded9;
          line-height: 1.6;
        }

        /* =========================================================
           MODALE MOT DE PASSE OUBLIÉ
           ========================================================= */
        .auth-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(14, 35, 37, 0.6);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .auth-modal-content {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          padding: 26px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }

        .auth-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .auth-modal-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .auth-modal-icon {
          color: #153a3d;
        }

        .auth-modal-header h3 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #102d2f;
        }

        .auth-modal-close {
          background: #f0f5f1;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #637b75;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .auth-modal-close:hover {
          background: #e3ede5;
          color: #102d2f;
        }

        .auth-modal-desc {
          font-size: 0.82rem;
          color: #55726e;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .auth-modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 10px;
        }

        .auth-modal-cancel {
          padding: 10px 18px;
          border: 1px solid #d4e0d7;
          background: #ffffff;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #4b6762;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .auth-modal-cancel:hover {
          background: #f5f8f5;
        }

        .auth-modal-success {
          text-align: center;
          padding: 14px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .auth-modal-success-icon {
          color: #2e7d32;
        }

        .auth-modal-success h4 {
          margin: 0;
          font-size: 1.05rem;
          color: #102d2f;
        }

        .auth-modal-success p {
          margin: 0;
          font-size: 0.82rem;
          color: #56706c;
          line-height: 1.5;
          max-width: 360px;
        }

        .auth-modal-success .auth-submit-btn {
          margin-top: 12px;
        }

        /* =========================================================
           RESPONSIVE (TABLETTES & MOBILES)
           ========================================================= */
        @media (max-width: 1024px) {
          .auth-container {
            grid-template-columns: 1fr;
          }

          .auth-showcase-panel {
            display: none;
          }

          .auth-form-panel {
            min-height: 100vh;
            padding: 28px 24px 20px;
            box-shadow: none;
          }

          .auth-body {
            max-width: 440px;
            margin: 16px auto;
          }
        }

        /* Présentation dédiée aux tablettes : deux panneaux pleine hauteur */
        @media (min-width: 768px) and (max-width: 1024px) {
          .auth-container {
            display: grid;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
            min-height: 100dvh;
            height: auto;
            overflow-x: clip;
            overflow-y: auto;
            background: #fff;
          }

          .auth-form-panel {
            box-sizing: border-box;
            width: 100%;
            min-height: 100dvh;
            height: auto;
            margin: 0;
            padding: 28px clamp(28px, 4vw, 48px) 20px;
            justify-content: space-between;
            gap: 12px;
            border: 0;
            border-radius: 0;
            box-shadow: 8px 0 32px rgba(14, 35, 37, 0.06);
          }

          .auth-body {
            max-width: 440px;
            margin: 12px auto;
          }

          .auth-showcase-panel {
            display: flex;
            min-width: 0;
            min-height: 100dvh;
            padding: 28px clamp(16px, 2.4vw, 24px);
          }

          .auth-showcase-inner {
            width: 100%;
            min-width: 0;
          }

          .auth-preview-card {
            padding: 20px;
          }

          .auth-preview-header {
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 12px;
          }

          .auth-preview-location {
            flex: 1 1 100%;
            min-width: 0;
          }

          .auth-preview-location > div:last-child {
            min-width: 0;
          }

          .auth-preview-location h3 {
            overflow-wrap: anywhere;
          }

          .auth-preview-global-score {
            flex-direction: row;
            align-items: center;
            gap: 8px;
          }

          .auth-score-label {
            margin-top: 0;
            text-align: left;
          }

          .auth-preview-stats {
            grid-template-columns: minmax(0, 1fr);
          }

          .auth-stat-name {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
          }

          .auth-showcase-bottom h2 {
            font-size: clamp(1.45rem, 2.7vw, 2rem);
          }

          .auth-showcase-bottom p {
            font-size: 0.84rem;
          }

          .auth-footer {
            justify-content: center;
            margin-top: auto;
            padding-top: 12px;
          }
        }

        @media (min-width: 768px) and (max-width: 850px) {
          .auth-container {
            grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
          }

          .auth-preview-header {
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 10px;
          }

          .auth-preview-location {
            min-width: 0;
            gap: 8px;
          }

          .auth-preview-location h3 {
            font-size: 0.78rem;
            overflow-wrap: anywhere;
          }

          .auth-preview-global-score {
            flex-direction: row;
            align-items: center;
            gap: 8px;
          }

          .auth-score-label {
            max-width: 72px;
            text-align: right;
          }

        }

        @media (min-width: 768px) and (max-width: 1024px) and (max-height: 760px) {
          .auth-form-panel {
            min-height: 760px;
          }

          .auth-body {
            margin-top: 0;
            margin-bottom: 0;
          }

          .auth-form {
            margin-top: 20px;
            gap: 14px;
          }

          .auth-showcase-panel {
            min-height: 760px;
          }
        }

        @media (max-width: 480px) {
          .auth-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .auth-title-group h1 {
            font-size: 1.75rem;
          }

          .auth-form-panel {
            padding: 20px 16px 16px;
          }
        }
      `}</style>
    </main>
  );
};
