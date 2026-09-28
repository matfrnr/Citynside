import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AuthUser } from "../../types";

interface AuthViewProps {
  onAuthenticated: (user: AuthUser) => void;
}

type AuthMode = "login" | "register";

interface AuthFields {
  name: string;
  email: string;
  password: string;
  invitation: string;
}

const LOCAL_DEMO_USER: AuthUser = {
  id: "local-demo-user",
  name: "Compte de démonstration",
  email: "demo@citynside.local",
};

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fields, setFields] = useState<AuthFields>({
    name: "",
    email: "",
    password: "",
    invitation: "",
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
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Impossible de valider la demande.");
        return;
      }
      onAuthenticated(result.user as AuthUser);
    } catch {
      setError(
        "Le service de connexion est indisponible. Réessayez dans un instant.",
      );
    } finally {
      setBusy(false);
    }
  };

  const isRegistering = mode === "register";
  const enterDemoMode = () => onAuthenticated(LOCAL_DEMO_USER);

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <a className="auth-brand" href="/" aria-label="Citynside, accueil">
          <img src="/logo-citynside.svg" alt="" />
          <span>Citynside</span>
        </a>

        <div className="auth-content">
          <p className="auth-eyebrow">ESPACE PROFESSIONNEL</p>
          <h1>
            {isRegistering ? "Rejoignez Citynside" : "Content de vous revoir"}
          </h1>
          <p className="auth-intro">
            {isRegistering
              ? "Activez votre accès professionnel avec la clé remise par votre administrateur."
              : "Connectez-vous à votre espace d’analyse de quartier."}
          </p>

          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Accès au compte"
          >
            <button
              id="login-tab"
              type="button"
              role="tab"
              aria-selected={!isRegistering}
              aria-controls="auth-form"
              className={!isRegistering ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Connexion
            </button>
            <button
              id="register-tab"
              type="button"
              role="tab"
              aria-selected={isRegistering}
              aria-controls="auth-form"
              className={isRegistering ? "selected" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Inscription
            </button>
          </div>

          <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
            {isRegistering && (
              <label className="auth-field">
                <span>Nom complet</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  required
                  value={fields.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </label>
            )}

            <label className="auth-field">
              <span>Adresse e-mail professionnelle</span>
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={fields.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            {isRegistering && (
              <label className="auth-field">
                <span>Clé d’activation</span>
                <span className="auth-input-wrap">
                  <KeyRound size={17} aria-hidden="true" />
                  <input
                    autoComplete="off"
                    maxLength={128}
                    required
                    value={fields.invitation}
                    onChange={(event) =>
                      updateField("invitation", event.target.value)
                    }
                  />
                </span>
                <small>
                  Une clé personnelle est nécessaire pour créer un compte.
                </small>
              </label>
            )}

            <label className="auth-field">
              <span>Mot de passe</span>
              <span className="auth-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type="password"
                  autoComplete={
                    isRegistering ? "new-password" : "current-password"
                  }
                  minLength={isRegistering ? 12 : undefined}
                  maxLength={256}
                  required
                  value={fields.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                />
              </span>
              {isRegistering && <small>12 caractères minimum.</small>}
            </label>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy
                ? "Vérification…"
                : isRegistering
                  ? "Activer mon compte"
                  : "Se connecter"}
              {!busy && <ArrowRight size={18} aria-hidden="true" />}
            </button>

            <div className="auth-demo-separator" aria-hidden="true">
              <span>ou</span>
            </div>
            <button className="auth-demo" type="button" onClick={enterDemoMode}>
              Essayer le compte de démonstration
            </button>
          </form>

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
          width: fit-content;
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-size: 1.35rem;
          font-weight: 700;
          text-decoration: none;
        }

        .auth-brand img { width: 38px; height: 38px; object-fit: contain; }

        .auth-content {
          width: 100%;
          max-width: 430px;
          margin: 48px auto;
          padding: 34px;
          border: 1px solid #e0e9df;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 14px 40px rgba(21, 58, 61, 0.07);
          animation: auth-appear 0.4s ease both;
        }

        .auth-eyebrow {
          color: #587d5d;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .auth-content h1 {
          margin-top: 9px;
          color: var(--color-primary);
          font-family: var(--font-family-heading);
          font-size: 1.8rem;
          line-height: 1.2;
        }

        .auth-intro {
          margin-top: 9px;
          color: #647a78;
          font-size: 0.82rem;
          line-height: 1.55;
        }

        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-top: 25px;
          padding: 4px;
          border-radius: 6px;
          background: #f0f5ef;
        }

        .auth-tabs button {
          min-height: 38px;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: #647a78;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
        }

        .auth-tabs button.selected {
          background: #fff;
          color: var(--color-primary);
          box-shadow: 0 1px 4px rgba(21, 58, 61, 0.11);
        }

        .auth-form { display: flex; flex-direction: column; gap: 16px; margin-top: 21px; }
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
        .auth-field small { color: #748582; font-size: 0.67rem; font-weight: 400; line-height: 1.4; }

        .auth-error {
          padding: 10px 12px;
          border-left: 3px solid #bd594b;
          background: #fbefed;
          color: #8a382f;
          font-size: 0.75rem;
          line-height: 1.45;
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
        .auth-submit:focus-visible, .auth-tabs button:focus-visible { outline: 3px solid #9dc599; outline-offset: 2px; }

        .auth-demo-separator { display: flex; align-items: center; gap: 10px; color: #9aaba4; font-size: 0.67rem; }
        .auth-demo-separator::before, .auth-demo-separator::after { height: 1px; flex: 1; background: #e5ece5; content: ""; }
        .auth-demo { min-height: 40px; border: 1px solid #b8cfb4; border-radius: 5px; color: #315557; font: inherit; font-size: 0.74rem; font-weight: 600; cursor: pointer; }
        .auth-demo:hover { background: #f0f7ee; border-color: #8ab887; }
        .auth-demo:focus-visible { outline: 3px solid #9dc599; outline-offset: 2px; }

        .auth-privacy { margin-top: 18px; color: #728581; font-size: 0.68rem; line-height: 1.5; text-align: center; }
        .auth-footer { color: #879894; font-size: 0.67rem; }

        .auth-visual {
          position: sticky;
          top: 0;
          display: flex;
          align-self: start;
          height: 100vh;
          min-height: 0;
          overflow: hidden;
          align-items: center;
          padding: 10%;
          background-color: #153a3d;
          background-image:
            linear-gradient(28deg, transparent 48%, rgba(157, 197, 153, 0.12) 49%, transparent 50%),
            linear-gradient(118deg, transparent 48%, rgba(255, 255, 255, 0.08) 49%, transparent 50%);
          background-size: 92px 92px, 128px 128px;
        }

        .auth-visual::after {
          position: absolute;
          right: -18%;
          bottom: -16%;
          width: 72%;
          aspect-ratio: 1;
          border: 1px solid rgba(196, 218, 154, 0.28);
          border-radius: 50%;
          box-shadow: 0 0 0 42px rgba(196, 218, 154, 0.08), 0 0 0 84px rgba(196, 218, 154, 0.05);
          content: "";
        }

        .auth-image-caption { position: relative; z-index: 1; max-width: 430px; color: #fff; }
        .auth-location { display: inline-flex; color: #c4da9a; font-size: 0.76rem; font-weight: 600; letter-spacing: 0.04em; }
        .auth-image-caption > p { margin-top: 18px; font-family: var(--font-family-heading); font-size: clamp(2rem, 3.3vw, 3.5rem); font-weight: 600; line-height: 1.08; }
        .auth-image-rule { display: block; width: 46px; height: 3px; margin-top: 26px; background: #c4da9a; }

        .auth-checking { display: grid; place-items: center; min-height: 100vh; background: #f5f8f3; }
        .auth-checking-mark { display: grid; place-items: center; width: 44px; aspect-ratio: 1; border-radius: 50%; background: #153a3d; color: #fff; font-family: var(--font-family-heading); font-size: 1.35rem; animation: auth-pulse 1s ease-in-out infinite alternate; }

        @keyframes auth-appear { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes auth-pulse { to { opacity: 0.55; transform: scale(0.94); } }

        @media (max-width: 900px) {
          .auth-screen { grid-template-columns: minmax(400px, 1fr) minmax(260px, 0.75fr); }
          .auth-panel { padding-right: 28px; padding-left: 28px; }
          .auth-content { padding: 28px 24px; }
        }

        @media (max-width: 680px) {
          .auth-screen { display: block; }
          .auth-panel { min-height: 100vh; padding: 21px 20px 16px; }
          .auth-content { margin: 34px auto; padding: 26px 22px; }
          .auth-visual { display: none; }
        }

        @media (max-width: 380px) {
          .auth-content { padding: 24px 18px; }
          .auth-content h1 { font-size: 1.55rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-content, .auth-checking-mark { animation: none; }
        }
      `}</style>
    </main>
  );
};
