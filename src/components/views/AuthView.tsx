import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { mapSupabaseUser, supabase } from "../../services/supabase";
import type { AuthUser } from "../../types";

interface AuthViewProps {
  onAuthenticated: (user: AuthUser) => void;
}

interface AuthFields {
  email: string;
  password: string;
}

const LOCAL_DEMO_USER: AuthUser = {
  id: "local-demo-user",
  name: "Compte de démonstration",
  email: "demo@citynside.local",
};

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
  const [fields, setFields] = useState<AuthFields>({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const enterDemoMode = () => onAuthenticated(LOCAL_DEMO_USER);

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <a className="auth-brand" href="/" aria-label="Citynside, accueil">
          <img src="/logo-citynside.svg" alt="" />
          <span>Citynside</span>
        </a>

        <div className="auth-content">
          <p className="auth-eyebrow">ESPACE PROFESSIONNEL SÉCURISÉ</p>
          <h1>Content de vous revoir</h1>
          <p className="auth-intro">
            Connectez-vous à votre espace d’analyse de quartier et d'évaluation immobilière.
          </p>

          <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Adresse e-mail professionnelle</span>
              <span className="auth-input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="nom@agence.immo"
                  value={fields.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </span>
            </label>

            <label className="auth-field">
              <span>Mot de passe</span>
              <span className="auth-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                  required
                  placeholder="••••••••••••"
                  value={fields.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                />
              </span>
            </label>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Connexion en cours…" : "Se connecter"}
              {!busy && <ArrowRight size={18} aria-hidden="true" />}
            </button>

            <div className="auth-demo-separator" aria-hidden="true">
              <span>ou</span>
            </div>
            <button className="auth-demo" type="button" onClick={enterDemoMode}>
              Essayer le compte de démonstration
            </button>
          </form>

          {/* Bloc d'explication d'accès restreint */}
          <div className="auth-notice-card">
            <div className="auth-notice-header">
              <ShieldCheck size={18} className="auth-notice-icon" aria-hidden="true" />
              <strong>Accès restreint sur invitation</strong>
            </div>
            <p className="auth-notice-body">
              L'accès à la plateforme est strictement réservé aux agents agréés. Chaque accès est nominatif et nécessite un lien d'invitation sécurisé unique généré par l'administrateur.
            </p>
            <p className="auth-notice-footer">
              Vous n'avez pas de compte ou vous avez perdu vos accès ? Contactez le responsable de votre agence pour recevoir une invitation personnelle par e-mail.
            </p>
          </div>

          <p className="auth-privacy">
            Le compte de démonstration utilise uniquement les données de cet appareil.
          </p>
        </div>

        <footer className="auth-footer">© Citynside · Espace sécurisé</footer>
      </section>

      <aside className="auth-visual" aria-label="À propos de Citynside">
        <div className="auth-image-caption">
          <span className="auth-location">
            L’immobilier, à l’échelle du quartier
          </span>
          <p>
            Chaque adresse raconte
            <br />
            un quartier différent.
          </p>
          <span className="auth-image-rule" />
        </div>
      </aside>

      <style>{`
        .auth-screen {
          display: grid;
          grid-template-columns: minmax(460px, 0.92fr) minmax(0, 1.08fr);
          height: 100vh;
          min-height: 100vh;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          background: #f5f8f3;
          color: #173b3c;
          font-family: var(--font-family-body);
        }

        .auth-screen::-webkit-scrollbar { display: none; }

        .auth-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 100vh;
          padding: 28px clamp(28px, 6vw, 88px) 22px;
          background-image: radial-gradient(#dce9dc 0.7px, transparent 0.7px);
          background-size: 19px 19px;
          background-color: #f8faf6;
        }

        .auth-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: inherit;
          text-decoration: none;
        }

        .auth-brand img { width: 34px; height: 34px; border-radius: 8px; }
        .auth-brand span { font-size: 1.06rem; font-weight: 700; letter-spacing: -0.02em; color: var(--color-primary); }

        .auth-content {
          width: 100%;
          max-width: 420px;
          margin: 18px 0 28px;
        }

        .auth-eyebrow {
          margin: 0;
          color: #4b7454;
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.14em;
        }

        .auth-content h1 {
          margin: 8px 0 0;
          color: #102d2f;
          font-size: clamp(1.45rem, 2.3vw, 1.9rem);
          font-weight: 600;
          letter-spacing: -0.03em;
        }

        .auth-intro {
          margin-top: 9px;
          color: #647a78;
          font-size: 0.82rem;
          line-height: 1.55;
        }

        .auth-form { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
        .auth-field { display: flex; flex-direction: column; gap: 7px; color: #315557; font-size: 0.74rem; font-weight: 600; }

        .auth-field input {
          width: 100%;
          height: 43px;
          min-width: 0;
          padding: 0 12px;
          border: 1px solid #d8e3dc;
          border-radius: 5px;
          outline: none;
          background: #fff;
          color: #142e30;
          font: inherit;
          font-size: 0.83rem;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .auth-field input:focus { border-color: #79a67c; box-shadow: 0 0 0 3px rgba(121, 166, 124, 0.16); }
        .auth-input-wrap { position: relative; display: flex; align-items: center; color: #78918a; }
        .auth-input-wrap > svg { position: absolute; left: 12px; pointer-events: none; }
        .auth-input-wrap input { padding-left: 39px; }

        .auth-error {
          padding: 10px 12px;
          border-left: 3px solid #bd594b;
          background: #fbefed;
          color: #8a382f;
          font-size: 0.75rem;
          line-height: 1.45;
          border-radius: 3px;
        }

        .auth-submit {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 46px;
          margin-top: 2px;
          padding: 0 16px;
          border: 0;
          border-radius: 5px;
          background: #153a3d;
          color: #fff;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .auth-submit:hover:not(:disabled) { background: #1e4e52; transform: translateY(-1px); }
        .auth-submit:disabled { cursor: wait; opacity: 0.72; }
        .auth-submit:focus-visible { outline: 3px solid #9dc599; outline-offset: 2px; }

        .auth-demo-separator { display: flex; align-items: center; gap: 10px; color: #9aaba4; font-size: 0.67rem; }
        .auth-demo-separator::before, .auth-demo-separator::after { height: 1px; flex: 1; background: #e5ece5; content: ""; }
        .auth-demo { min-height: 40px; border: 1px solid #b8cfb4; border-radius: 5px; color: #315557; font: inherit; font-size: 0.74rem; font-weight: 600; cursor: pointer; }
        .auth-demo:hover { background: #f0f7ee; border-color: #8ab887; }
        .auth-demo:focus-visible { outline: 3px solid #9dc599; outline-offset: 2px; }

        /* Notice d'accès restreint */
        .auth-notice-card {
          margin-top: 24px;
          padding: 14px 16px;
          border-radius: 8px;
          background: #edf5ee;
          border: 1px solid #cfe2d2;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auth-notice-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #215e2e;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .auth-notice-icon {
          color: #3b874b;
          flex-shrink: 0;
        }

        .auth-notice-body {
          margin: 0;
          color: #3f6155;
          font-size: 0.73rem;
          line-height: 1.45;
        }

        .auth-notice-contact {
          margin: 0;
          color: #2c5144;
          font-size: 0.71rem;
          line-height: 1.4;
          font-weight: 500;
        }

        .auth-notice-footer {
          margin: 0;
          padding-top: 6px;
          border-top: 1px solid #dbead9;
          color: #557268;
          font-size: 0.70rem;
          line-height: 1.4;
        }

        .auth-privacy { margin-top: 18px; color: #728581; font-size: 0.68rem; line-height: 1.5; text-align: center; }
        .auth-footer { color: #879894; font-size: 0.67rem; }

        .auth-visual {
          position: sticky;
          top: 0;
          display: flex;
          align-self: start;
          height: 100vh;
          min-height: 100vh;
          overflow: hidden;
          background-color: #244b44;
          background-image:
            linear-gradient(rgba(14, 38, 35, 0.42), rgba(12, 32, 29, 0.68)),
            url("https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80");
          background-position: center;
          background-size: cover;
        }

        .auth-image-caption {
          position: absolute;
          right: clamp(24px, 4vw, 44px);
          bottom: clamp(24px, 4vw, 40px);
          left: clamp(24px, 4vw, 44px);
          z-index: 1;
          color: #f6faf5;
        }

        .auth-location {
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c9e4c5;
        }

        .auth-image-caption p {
          margin: 9px 0 0;
          font-family: var(--font-family-display);
          font-size: clamp(1.4rem, 2.2vw, 2.05rem);
          line-height: 1.25;
          letter-spacing: -0.025em;
        }

        .auth-image-rule {
          display: block;
          width: 44px;
          height: 2px;
          margin-top: 18px;
          background: #75a777;
        }

        @media (max-width: 980px) {
          .auth-screen { grid-template-columns: 1fr; }
          .auth-visual { display: none; }
          .auth-panel { min-height: 100vh; padding: 24px 20px 18px; }
        }
      `}</style>
    </main>
  );
};
