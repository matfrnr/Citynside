import React, { useEffect, useRef, useState } from "react";
import { Check, FileText, Home, Map, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_REPORT_CUSTOMIZATION,
  cacheDefaultReportCustomization,
  fetchDefaultReportCustomization,
  loadDefaultReportCustomization,
  saveDefaultReportCustomization,
  type ReportCustomization,
} from "../../services/reportCustomization";
import {
  DEFAULT_USER_PREFERENCES,
  fetchUserPreferences,
  loadUserPreferences,
  saveUserPreferences,
  type DefaultCategoryFilter,
  type DefaultScoreProfile,
  type UserPreferences,
} from "../../services/userPreferences";
import { LOCAL_DEMO_USER_ID } from "../../types";

interface PersonalisationViewProps {
  userId: string;
  onUserPreferencesChange: (preferences: UserPreferences) => void;
}

const reportSections: { key: keyof ReportCustomization["includedSections"]; label: string; description: string }[] = [
  { key: "scores", label: "Scores par catégorie", description: "Détail des indicateurs du quartier" },
  { key: "sources", label: "Transparence et méthodologie", description: "Sources et explications des calculs" },
  { key: "impressions", label: "Observations terrain", description: "Informations saisies sur le quartier" },
  { key: "risks", label: "Risques et nuisances", description: "Éléments de vigilance recensés" },
];

export const PersonalisationView: React.FC<PersonalisationViewProps> = ({ userId, onUserPreferencesChange }) => {
  const [customizationSnapshot, setCustomizationSnapshot] = useState(() => ({
    userId,
    value: loadDefaultReportCustomization(userId),
  }));
  const [preferencesSnapshot, setPreferencesSnapshot] = useState(() => ({
    userId,
    value: loadUserPreferences(userId),
  }));
  const customization = customizationSnapshot.userId === userId
    ? customizationSnapshot.value
    : loadDefaultReportCustomization(userId);
  const preferences = preferencesSnapshot.userId === userId
    ? preferencesSnapshot.value
    : loadUserPreferences(userId);
  const [interfaceResetNotice, setInterfaceResetNotice] = useState(false);
  const [preferencesSyncError, setPreferencesSyncError] = useState("");
  const [reportSyncError, setReportSyncError] = useState("");
  const [reportSavePending, setReportSavePending] = useState(false);
  const preferencesRevision = useRef(0);
  const customizationRevision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const preferencesAtLoad = preferencesRevision.current;
    const customizationAtLoad = customizationRevision.current;

    void fetchUserPreferences(userId).then((remotePreferences) => {
      if (cancelled || preferencesRevision.current !== preferencesAtLoad) return;
      setPreferencesSnapshot({ userId, value: remotePreferences });
      onUserPreferencesChange(remotePreferences);
      setPreferencesSyncError("");
    }).catch((error) => {
      console.warn("Chargement des préférences synchronisées impossible :", error);
      if (!cancelled && preferencesRevision.current === preferencesAtLoad) {
        setPreferencesSyncError("Les réglages n’ont pas pu être synchronisés avec Supabase. Vérifiez la connexion et appliquez la migration des préférences.");
      }
    });

    void fetchDefaultReportCustomization(userId).then((remoteCustomization) => {
      if (cancelled || customizationRevision.current !== customizationAtLoad) return;
      setCustomizationSnapshot({ userId, value: remoteCustomization });
      setReportSyncError("");
    }).catch((error) => {
      console.warn("Chargement des modèles de rapport synchronisés impossible :", error);
      if (!cancelled && customizationRevision.current === customizationAtLoad) {
        setReportSyncError("Le modèle de rapport n’a pas pu être synchronisé avec Supabase. Vérifiez la connexion et appliquez la migration des préférences.");
      }
    });

    return () => { cancelled = true; };
  }, [onUserPreferencesChange, userId]);

  useEffect(() => {
    if (!reportSavePending || customizationSnapshot.userId !== userId) return;
    const revision = customizationRevision.current;
    const timer = window.setTimeout(() => {
      void saveDefaultReportCustomization(userId, customizationSnapshot.value).then(() => {
        if (customizationRevision.current === revision) {
          setReportSavePending(false);
          setReportSyncError("");
        }
      }).catch((error) => {
        console.error("Enregistrement du modèle de rapport dans Supabase impossible :", error);
        if (customizationRevision.current === revision) {
          setReportSavePending(false);
          setReportSyncError("Le modèle reste disponible sur cet appareil, mais n’a pas été synchronisé avec Supabase. Vérifiez la connexion et appliquez la migration des préférences.");
        }
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [customizationSnapshot, reportSavePending, userId]);

  const updatePreferences = (update: Partial<UserPreferences>) => {
    const revision = ++preferencesRevision.current;
    const next = { ...preferences, ...update };
    setPreferencesSnapshot({ userId, value: next });
    setInterfaceResetNotice(false);
    setPreferencesSyncError("");
    onUserPreferencesChange(next);
    void saveUserPreferences(userId, next).then(() => {
      if (preferencesRevision.current === revision) setPreferencesSyncError("");
    }).catch((error) => {
      console.error("Enregistrement des préférences dans Supabase impossible :", error);
      if (preferencesRevision.current === revision) {
        setPreferencesSyncError("Les réglages restent visibles sur cet appareil, mais n’ont pas été synchronisés avec Supabase. Vérifiez la connexion et appliquez la migration des préférences.");
      }
    });
  };

  const resetPreferences = () => {
    const revision = ++preferencesRevision.current;
    const defaults = { ...DEFAULT_USER_PREFERENCES };
    setPreferencesSnapshot({ userId, value: defaults });
    onUserPreferencesChange(defaults);
    setInterfaceResetNotice(true);
    setPreferencesSyncError("");
    void saveUserPreferences(userId, defaults).then(() => {
      if (preferencesRevision.current === revision) setPreferencesSyncError("");
    }).catch((error) => {
      console.error("Réinitialisation des préférences dans Supabase impossible :", error);
      if (preferencesRevision.current === revision) setPreferencesSyncError("Les réglages réinitialisés restent sur cet appareil, mais n’ont pas été synchronisés avec Supabase.");
    });
  };

  const updateCustomization = (update: Partial<ReportCustomization>) => {
    customizationRevision.current += 1;
    const next = {
      ...customization,
      ...update,
      includedSections: update.includedSections
        ? { ...customization.includedSections, ...update.includedSections }
        : customization.includedSections,
    };
    setCustomizationSnapshot({ userId, value: next });
    cacheDefaultReportCustomization(userId, next);
    setReportSavePending(true);
    setReportSyncError("");
  };

  const resetDefaults = () => {
    customizationRevision.current += 1;
    setCustomizationSnapshot({ userId, value: DEFAULT_REPORT_CUSTOMIZATION });
    cacheDefaultReportCustomization(userId, DEFAULT_REPORT_CUSTOMIZATION);
    setReportSavePending(true);
    setReportSyncError("");
  };

  return (
    <div className="personalisation-page">
      <header className="personalisation-heading">
        <div>
          <p className="personalisation-eyebrow">VOTRE ESPACE</p>
          <h1>Personnalisation</h1>
          <p>Réglez votre interface et la présentation de vos rapports.</p>
        </div>
        <span className="personalisation-heading-icon"><SlidersHorizontal size={22} /></span>
      </header>

      {preferencesSyncError && <p className="personalisation-sync-error" role="alert">{preferencesSyncError}</p>}
      {reportSyncError && <p className="personalisation-sync-error" role="alert">{reportSyncError}</p>}

      <section className="personalisation-card">
        <div className="personalisation-card-heading">
          <span className="personalisation-section-icon"><Map size={18} /></span>
          <div><h2>Carte et interface</h2><p>Ces réglages sont synchronisés avec votre compte.</p></div>
        </div>
        <div className="personalisation-options">
          <label className="personalisation-option">
            <span><strong>Masquer les commandes de la carte au départ</strong><small>Réaffichez-les avec l’œil quand vous en avez besoin. Le mobile les masque toujours au départ.</small></span>
            <input type="checkbox" checked={preferences.hideMapControlsByDefault} onChange={(event) => updatePreferences({ hideMapControlsByDefault: event.target.checked })} />
          </label>
          <label className="personalisation-option">
            <span><strong>Réduire les animations</strong><small>Limite les mouvements et transitions de l’interface.</small></span>
            <input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => updatePreferences({ reduceMotion: event.target.checked })} />
          </label>
          <label className="personalisation-option">
            <span><strong>Afficher le nombre de notifications</strong><small>Affiche le compteur sur la cloche du menu quand des notifications importantes sont non lues.</small></span>
            <input type="checkbox" checked={preferences.showNotificationCount} onChange={(event) => updatePreferences({ showNotificationCount: event.target.checked })} />
          </label>
          <label className="personalisation-option">
            <span><strong>Menu replié par défaut</strong><small>Réduit le menu latéral sur ordinateur et tablette. Sur mobile, la barre de navigation reste affichée.</small></span>
            <input type="checkbox" checked={preferences.sidebarCollapsed} onChange={(event) => updatePreferences({ sidebarCollapsed: event.target.checked })} />
          </label>
          <label className="personalisation-select-option">
            <span><strong>Page affichée à l’ouverture</strong><small>Choisissez votre point de départ après connexion.</small></span>
            <select value={preferences.startView} onChange={(event) => updatePreferences({ startView: event.target.value as UserPreferences["startView"] })}>
              <option value="home">Accueil</option>
              <option value="new-analysis">Carte</option>
            </select>
          </label>
          <label className="personalisation-select-option">
            <span><strong>Zoom initial de la carte</strong><small>Un zoom plus faible montre une zone plus large.</small></span>
            <select value={preferences.mapZoom} onChange={(event) => updatePreferences({ mapZoom: Number(event.target.value) as UserPreferences["mapZoom"] })}>
              <option value={12}>Vue large</option>
              <option value={13}>Équilibrée</option>
              <option value={14}>Rapprochée</option>
              <option value={15}>Très rapprochée</option>
            </select>
          </label>
          <label className="personalisation-select-option">
            <span><strong>Unité des distances</strong><small>Choisissez comment les distances sont présentées sur la carte et dans les indicateurs.</small></span>
            <select value={preferences.distanceUnit} onChange={(event) => updatePreferences({ distanceUnit: event.target.value as UserPreferences["distanceUnit"] })}>
              <option value="meters">Mètres</option>
              <option value="walking-minutes">A pied</option>
            </select>
          </label>
          <label className="personalisation-select-option">
            <span><strong>Profil de score par défaut</strong><small>Ce profil sera sélectionné automatiquement dans une analyse.</small></span>
            <select value={preferences.defaultScoreProfile} onChange={(event) => updatePreferences({ defaultScoreProfile: event.target.value as DefaultScoreProfile })}>
              <option value="none">Aucun profil</option>
              <option value="family">Famille</option>
              <option value="student">Étudiant</option>
              <option value="senior">Senior</option>
              <option value="investor">Investisseur</option>
            </select>
          </label>
          <label className="personalisation-select-option">
            <span><strong>Catégorie affichée par défaut sur la carte</strong><small>La carte s’ouvrira directement sur cette catégorie. Le rapport conserve toutes les catégories.</small></span>
            <select value={preferences.defaultCategoryFilter ?? ""} onChange={(event) => updatePreferences({ defaultCategoryFilter: (event.target.value || null) as DefaultCategoryFilter })}>
              <option value="">Toutes</option>
              <option value="transports">Transports</option>
              <option value="commerces">Commerces et services</option>
              <option value="ecoles">Écoles et petite enfance</option>
              <option value="sante">Santé</option>
              <option value="espaces_verts">Espaces verts</option>
              <option value="stationnement">Stationnement</option>
              <option value="services_publics">Services publics</option>
              <option value="tranquillite">Tranquillité</option>
              <option value="loisirs">Sports, culture et loisirs</option>
            </select>
          </label>
        </div>
        <div className="personalisation-settings-note"><span role="status" aria-live="polite">{interfaceResetNotice ? <><Check size={14} /> Interface réinitialisée</> : <><Home size={14} /> Modifiez ces choix à tout moment depuis ce menu.</>}</span><button type="button" onClick={resetPreferences}>Réinitialiser l’interface</button></div>
      </section>

      <section className="personalisation-card">
        <div className="personalisation-card-heading">
          <span className="personalisation-section-icon"><FileText size={18} /></span>
          <div><h2>Rapports par défaut</h2><p>Chaque rapport peut ensuite être ajusté individuellement.</p></div>
        </div>

        <div className="personalisation-options">
          {reportSections.map((section) => (
            <label className="personalisation-option" key={section.key}>
              <span><strong>{section.label}</strong><small>{section.description}</small></span>
              <input
                type="checkbox"
                checked={customization.includedSections[section.key]}
                onChange={(event) => updateCustomization({ includedSections: { ...customization.includedSections, [section.key]: event.target.checked } })}
              />
            </label>
          ))}
        </div>

        <div className="personalisation-notes">
          <label>Points forts à proposer<textarea maxLength={160} value={customization.strengths} onChange={(event) => updateCustomization({ strengths: event.target.value })} placeholder="Ex. Commerces accessibles, espaces verts à proximité…" /></label>
          <label>Réserves à proposer<textarea maxLength={160} value={customization.reservations} onChange={(event) => updateCustomization({ reservations: event.target.value })} placeholder="Ex. Peu de stationnement, rue passante…" /></label>
        </div>

        <footer className="personalisation-footer">
          <span aria-live="polite"><Check size={15} /> {reportSavePending ? "Synchronisation…" : userId === LOCAL_DEMO_USER_ID ? "Préférences enregistrées sur cet appareil" : "Préférences synchronisées avec votre compte"}</span>
          <button type="button" onClick={resetDefaults}><RotateCcw size={15} /> Réinitialiser les réglages de rapport</button>
        </footer>
      </section>

      <style>{`
        .personalisation-page { max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; color: var(--color-text-main); }
        .personalisation-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .personalisation-eyebrow { color: #527f5e; font-size: .7rem; font-weight: 700; letter-spacing: .08em; }
        .personalisation-heading h1 { margin-top: 4px; color: var(--color-primary); font-family: var(--font-family-heading); font-size: 2rem; }
        .personalisation-heading p:last-child { margin-top: 7px; color: var(--color-text-muted); font-size: .87rem; }
        .personalisation-heading-icon,.personalisation-section-icon { display: grid; place-items: center; flex: 0 0 auto; width: 46px; height: 46px; border-radius: 12px; background: #eaf3e7; color: #416b4c; }
        .personalisation-card { overflow: hidden; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; box-shadow: var(--shadow-subtle); }
        .personalisation-card-heading { display: flex; align-items: center; gap: 12px; padding: 20px; border-bottom: 1px solid #e9eee9; }
        .personalisation-card-heading h2 { color: var(--color-primary); font-size: 1rem; }
        .personalisation-card-heading p { margin-top: 4px; color: var(--color-text-muted); font-size: .77rem; }
        .personalisation-section-icon { width: 38px; height: 38px; border-radius: 10px; }
        .personalisation-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; padding: 4px 20px; }
        .personalisation-option { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 70px; border-bottom: 1px solid #eef1ed; cursor: pointer; }
        .personalisation-option>span { display: grid; gap: 4px; }
        .personalisation-option strong { color: #29443a; font-size: .82rem; }
        .personalisation-option small { color: #73817a; font-size: .72rem; }
        .personalisation-option input { width: 18px; height: 18px; accent-color: #376a4d; cursor: pointer; }
        .personalisation-select-option { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 70px; border-bottom: 1px solid #eef1ed; }
        .personalisation-select-option>span { display: grid; gap: 4px; }
        .personalisation-select-option strong { color: #29443a; font-size: .82rem; }
        .personalisation-select-option small { color: #73817a; font-size: .72rem; }
        .personalisation-select-option select { min-width: 128px; padding: 8px 9px; border: 1px solid #d8e2d8; border-radius: 7px; background: #fff; color: #29443a; font: inherit; font-size: .76rem; }
        .personalisation-settings-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 20px 15px; color: #71817a; font-size: .72rem; }
        .personalisation-settings-note span { display: inline-flex; align-items: center; gap: 6px; }
        .personalisation-settings-note button { padding: 6px 8px; border: 1px solid #d8e2d8; border-radius: 7px; background: #fff; color: #547064; font: inherit; cursor: pointer; }
        .personalisation-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 18px 20px; }
        .personalisation-notes label { display: grid; gap: 7px; color: #39554b; font-size: .78rem; font-weight: 650; }
        .personalisation-notes textarea { min-height: 82px; resize: vertical; padding: 10px 11px; border: 1px solid #d7e1d8; border-radius: 8px; color: #29443a; font: inherit; font-size: .78rem; line-height: 1.45; }
        .personalisation-notes textarea:focus { outline: 2px solid rgba(91, 140, 101, .22); border-color: #5b8c65; }
        .personalisation-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 20px; border-top: 1px solid #e9eee9; background: #fafbf9; }
        .personalisation-footer span,.personalisation-footer button { display: inline-flex; align-items: center; gap: 6px; color: #63806a; font-size: .74rem; }
        .personalisation-footer button { padding: 7px 9px; border: 1px solid #d8e2d8; border-radius: 7px; background: #fff; cursor: pointer; }
        .personalisation-footer button:hover { background: #f1f6f0; }
        .personalisation-sync-error { margin: 0; padding: 10px 13px; border-radius: 8px; background: #fff1ef; color: #9f2d26; font-size: .78rem; line-height: 1.45; }
        @media (max-width: 700px) { .personalisation-heading h1 { font-size: 1.6rem; } .personalisation-options,.personalisation-notes { grid-template-columns: 1fr; } .personalisation-card-heading,.personalisation-options,.personalisation-notes { padding-left: 15px; padding-right: 15px; } .personalisation-settings-note { align-items: flex-start; flex-direction: column; padding-left: 15px; padding-right: 15px; } .personalisation-footer { align-items: flex-start; flex-direction: column; padding-left: 15px; padding-right: 15px; } }
      `}</style>
    </div>
  );
};
