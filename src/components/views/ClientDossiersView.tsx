import { useCallback, useEffect, useMemo, useState, type FC, type FormEvent } from "react";
import { FileText, FolderOpen, Mail, MapPin, Phone, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import type { NeighborhoodAnalysis } from "../../types";
import { deleteClientDossier, fetchClientDossiers, saveClientDossier, type ClientDossier, type ClientDossierInput } from "../../services/clientDossiers";

interface ClientDossiersViewProps {
  userId: string;
  isDemo: boolean;
  analyses: NeighborhoodAnalysis[];
}

const emptyForm = (userId: string): ClientDossierInput => ({
  id: "",
  userId,
  clientName: "",
  email: "",
  phone: "",
  project: "",
  priorities: "",
  notes: "",
  analysisIds: [],
});

export const ClientDossiersView: FC<ClientDossiersViewProps> = ({ userId, isDemo, analyses }) => {
  const [dossierState, setDossierState] = useState({ userId, items: [] as ClientDossier[] });
  const dossiers = dossierState.userId === userId ? dossierState.items : [];
  const [form, setForm] = useState<ClientDossierInput>(() => emptyForm(userId));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ClientDossier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [errorState, setErrorState] = useState({ userId, message: "" });
  const error = errorState.userId === userId ? errorState.message : "";
  const loading = loadedUserId !== userId;

  const setError = (message: string) => setErrorState({ userId, message });
  const setDossiers = useCallback((update: ClientDossier[] | ((current: ClientDossier[]) => ClientDossier[])) => {
    setDossierState((current) => {
      const currentItems = current.userId === userId ? current.items : [];
      return { userId, items: typeof update === "function" ? update(currentItems) : update };
    });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void fetchClientDossiers(userId)
      .then((items) => { if (!cancelled) setDossiers(items); })
      .catch((loadError) => {
        console.error("Chargement des dossiers clients impossible :", loadError);
        if (!cancelled) setErrorState({ userId, message: "Impossible de charger les dossiers. Vérifiez la connexion Supabase et appliquez la migration client_dossiers si nécessaire." });
      })
      .finally(() => { if (!cancelled) setLoadedUserId(userId); });
    return () => { cancelled = true; };
  }, [setDossiers, userId]);

  const analysesById = useMemo(() => new Map(analyses.map((analysis) => [analysis.id, analysis])), [analyses]);

  const openNewDossier = () => {
    setForm(emptyForm(userId));
    setError("");
    setIsFormOpen(true);
  };

  const openDossier = (dossier: ClientDossier) => {
    setForm({
      id: dossier.id,
      userId: dossier.userId,
      clientName: dossier.clientName,
      email: dossier.email,
      phone: dossier.phone,
      project: dossier.project,
      priorities: dossier.priorities,
      notes: dossier.notes,
      analysisIds: dossier.analysisIds.filter((id) => analysesById.has(id)),
    });
    setError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setForm(emptyForm(userId));
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.clientName.trim()) {
      setError("Indiquez le nom du client pour créer son dossier.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const saved = await saveClientDossier({
        ...form,
        clientName: form.clientName.trim(),
        analysisIds: form.analysisIds.filter((id) => analysesById.has(id)),
      });
      setDossiers((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      closeForm();
    } catch (saveError) {
      console.error("Enregistrement du dossier client impossible :", saveError);
      setError("Le dossier n’a pas pu être enregistré. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemoveDossier = async () => {
    if (!deleteCandidate || deleteBusy) return;
    const dossier = deleteCandidate;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteClientDossier(userId, dossier.id);
      setDossiers((current) => current.filter((item) => item.id !== dossier.id));
      if (form.id === dossier.id) closeForm();
      setDeleteCandidate(null);
    } catch (deleteError) {
      console.error("Suppression du dossier client impossible :", deleteError);
      setDeleteError("Le dossier n’a pas pu être supprimé. Réessayez dans un instant.");
    } finally {
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    if (!deleteCandidate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteBusy) setDeleteCandidate(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteCandidate, deleteBusy]);

  const toggleAnalysis = (analysisId: string) => {
    setForm((current) => ({
      ...current,
      analysisIds: current.analysisIds.includes(analysisId)
        ? current.analysisIds.filter((id) => id !== analysisId)
        : [...current.analysisIds, analysisId],
    }));
  };

  return <div className="client-dossiers-page">
    <header className="client-dossiers-header">
      <div className="client-dossiers-heading-icon"><FolderOpen size={22} aria-hidden="true" /></div>
      <div className="client-dossiers-heading-copy">
        <h1>Dossiers clients</h1>
        <p>Rassemblez les besoins de votre client et les analyses de quartiers utiles à son projet.</p>
      </div>
      {!isFormOpen && <button className="client-dossiers-primary" type="button" onClick={openNewDossier}><Plus size={17} />Nouveau dossier</button>}
    </header>

    {isDemo && <p className="client-dossiers-demo-note">Les dossiers du compte démo sont enregistrés dans ce navigateur.</p>}
    {error && <p className="client-dossiers-error" role="alert">{error}</p>}

    {isFormOpen && <form className="client-dossier-form cyt-card" onSubmit={(event) => void submitForm(event)}>
      <div className="client-dossier-form-heading">
        <div><h2>{form.id ? "Modifier le dossier" : "Créer un dossier client"}</h2><p>Les informations servent à préparer un échange et à retrouver les quartiers proposés à ce client.</p></div>
        <button className="client-dossiers-icon-button" type="button" title="Fermer le formulaire" aria-label="Fermer le formulaire" onClick={closeForm}><X size={18} /></button>
      </div>

      <div className="client-dossier-fields">
        <label className="client-dossier-field"><span>Nom du client <b aria-hidden="true">*</b></span><input autoFocus required maxLength={120} value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} placeholder="Ex. Camille Martin" /></label>
        <label className="client-dossier-field"><span>Adresse e-mail</span><input type="email" maxLength={254} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="camille@example.fr" /></label>
        <label className="client-dossier-field"><span>Téléphone</span><input type="tel" maxLength={40} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="06 00 00 00 00" /></label>
        <label className="client-dossier-field client-dossier-field-wide"><span>Projet immobilier</span><input maxLength={180} value={form.project} onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))} placeholder="Ex. Achat d’une résidence principale à Lyon" /></label>
        <label className="client-dossier-field client-dossier-field-wide"><span>Ses critères et priorités</span><textarea rows={3} maxLength={2000} value={form.priorities} onChange={(event) => setForm((current) => ({ ...current, priorities: event.target.value }))} placeholder="Budget, transports, écoles, accessibilité, commerces…" /></label>
        <label className="client-dossier-field client-dossier-field-wide"><span>Notes de suivi</span><textarea rows={3} maxLength={4000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Questions à revoir, prochaines étapes, éléments à confirmer…" /></label>
      </div>

      <fieldset className="client-dossier-analysis-picker">
        <legend><FileText size={16} aria-hidden="true" />Analyses à présenter</legend>
        {analyses.length === 0 ? <p>Aucune analyse enregistrée. Vous pourrez associer des analyses après en avoir créé.</p> : <div className="client-dossier-analysis-list">{analyses.map((analysis) => <label className="client-dossier-analysis-option" key={analysis.id}>
          <input type="checkbox" checked={form.analysisIds.includes(analysis.id)} onChange={() => toggleAnalysis(analysis.id)} />
          <span><strong>{analysis.address}</strong><small>{[analysis.postcode, analysis.city].filter(Boolean).join(" ")} · Score {analysis.globalScore.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/10</small></span>
        </label>)}</div>}
      </fieldset>

      <div className="client-dossier-form-actions"><button className="client-dossiers-secondary" type="button" onClick={closeForm}>Annuler</button><button className="client-dossiers-primary" type="submit" disabled={busy}><Save size={16} />{busy ? "Enregistrement…" : form.id ? "Enregistrer les modifications" : "Créer le dossier"}</button></div>
    </form>}

    <section className="client-dossiers-list" aria-label="Dossiers clients enregistrés">
      <div className="client-dossiers-list-heading"><h2>Vos dossiers</h2><span>{dossiers.length}</span></div>
      {loading ? <p className="client-dossiers-empty">Chargement des dossiers…</p> : dossiers.length === 0 ? <div className="client-dossiers-empty"><span><UserRound size={22} /></span><strong>Pas encore de dossier client</strong><p>Créez un dossier pour noter les attentes d’un client et regrouper les analyses adaptées à son projet.</p>{!isFormOpen && <button className="client-dossiers-secondary" type="button" onClick={openNewDossier}><Plus size={16} />Créer un premier dossier</button>}</div> : <div className="client-dossier-cards">{dossiers.map((dossier) => <article className="client-dossier-card cyt-card" key={dossier.id}>
        <div className="client-dossier-card-main">
          <div className="client-dossier-avatar"><UserRound size={18} aria-hidden="true" /></div>
          <div className="client-dossier-card-title"><h3>{dossier.clientName}</h3><p>{dossier.project || "Projet à préciser"}</p></div>
          <div className="client-dossier-card-actions"><button type="button" className="client-dossiers-secondary" onClick={() => openDossier(dossier)}>Ouvrir le dossier</button><button type="button" className="client-dossiers-icon-button danger" title={`Supprimer le dossier de ${dossier.clientName}`} aria-label={`Supprimer le dossier de ${dossier.clientName}`} onClick={() => { setDeleteError(""); setDeleteCandidate(dossier); }}><Trash2 size={16} /></button></div>
        </div>
        <div className="client-dossier-contact">{dossier.email && <span><Mail size={14} />{dossier.email}</span>}{dossier.phone && <span><Phone size={14} />{dossier.phone}</span>}{dossier.analysisIds.filter((id) => analysesById.has(id)).length > 0 && <span><MapPin size={14} />{dossier.analysisIds.filter((id) => analysesById.has(id)).length} analyse{dossier.analysisIds.filter((id) => analysesById.has(id)).length > 1 ? "s" : ""} associée{dossier.analysisIds.filter((id) => analysesById.has(id)).length > 1 ? "s" : ""}</span>}</div>
        {dossier.priorities && <p className="client-dossier-priorities">{dossier.priorities}</p>}
        {dossier.analysisIds.length > 0 && <ul className="client-dossier-linked-analyses">{dossier.analysisIds.map((id) => {
          const analysis = analysesById.get(id);
          return analysis ? <li key={id}><MapPin size={13} />{analysis.address}, {analysis.city}</li> : null;
        })}</ul>}
      </article>)}</div>}
    </section>

    {deleteCandidate && <div className="client-dossier-delete-overlay" onClick={() => { if (!deleteBusy) setDeleteCandidate(null); }}>
      <section className="client-dossier-delete-modal" role="dialog" aria-modal="true" aria-labelledby="client-dossier-delete-title" onClick={(event) => event.stopPropagation()}>
        <span className="client-dossier-delete-icon"><Trash2 size={24} aria-hidden="true" /></span>
        <h2 id="client-dossier-delete-title">Supprimer ce dossier ?</h2>
        <p>Le dossier de <strong>{deleteCandidate.clientName}</strong> et ses notes seront supprimés. Les analyses associées resteront disponibles.</p>
        {deleteError && <p className="client-dossier-delete-error" role="alert">{deleteError}</p>}
        <div className="client-dossier-delete-actions">
          <button type="button" className="client-dossier-delete-cancel" autoFocus disabled={deleteBusy} onClick={() => setDeleteCandidate(null)}>Annuler</button>
          <button type="button" className="client-dossier-delete-confirm" disabled={deleteBusy} onClick={() => void confirmRemoveDossier()}>{deleteBusy ? "Suppression…" : "Supprimer le dossier"}</button>
        </div>
      </section>
    </div>}

    <style>{`
      .client-dossiers-page{max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:22px;padding-bottom:28px}
      .client-dossiers-header{display:flex;align-items:center;gap:14px}
      .client-dossiers-heading-icon,.client-dossier-avatar{display:grid;place-items:center;flex:0 0 46px;width:46px;height:46px;border-radius:12px;background:#eaf3e8;color:#315d46}
      .client-dossiers-heading-copy{flex:1;min-width:0}
      .client-dossiers-heading-copy h1{margin:0;color:var(--color-primary);font-size:1.8rem;font-weight:700}
      .client-dossiers-heading-copy p,.client-dossier-form-heading p{margin:5px 0 0;color:var(--color-text-muted);font-size:.86rem;line-height:1.5}
      .client-dossiers-primary,.client-dossiers-secondary,.client-dossiers-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--color-border);border-radius:8px;background:#fff;padding:9px 12px;color:var(--color-primary);font:inherit;font-size:.8rem;font-weight:600;text-decoration:none;cursor:pointer;transition:background .16s ease,border-color .16s ease}
      .client-dossiers-primary{background:var(--color-primary);border-color:var(--color-primary);color:#fff}
      .client-dossiers-primary:hover{background:#244e45}
      .client-dossiers-primary:disabled{opacity:.65;cursor:wait}
      .client-dossiers-secondary:hover,.client-dossiers-icon-button:hover{background:#f2f7f1;border-color:#c4d7c3}
      .client-dossiers-icon-button{width:36px;height:36px;padding:0;flex:0 0 36px}
      .client-dossiers-icon-button.danger{color:#a12d27}
      .client-dossiers-demo-note,.client-dossiers-error{margin:0;padding:10px 13px;border-radius:7px;background:#f4f7f2;color:#5c756f;font-size:.78rem}
      .client-dossiers-error{background:#fff2f0;color:#9f2d26}
      .client-dossier-form{padding:22px;background:#fff;display:flex;flex-direction:column;gap:20px}
      .client-dossier-form-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      .client-dossier-form-heading h2,.client-dossiers-list-heading h2{margin:0;color:var(--color-primary);font-size:1.05rem;font-weight:700}
      .client-dossier-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .client-dossier-field{display:flex;flex-direction:column;gap:7px;min-width:0;color:#284a43;font-size:.8rem;font-weight:600}
      .client-dossier-field b{color:#b34238}
      .client-dossier-field-wide{grid-column:1/-1}
      .client-dossier-field input,.client-dossier-field textarea{width:100%;box-sizing:border-box;border:1px solid #d8e3da;border-radius:7px;padding:10px 11px;background:#fff;color:#1b3735;font:inherit;font-size:.83rem;font-weight:400;outline:none}
      .client-dossier-field textarea{resize:vertical;line-height:1.5}
      .client-dossier-field input:focus,.client-dossier-field textarea:focus{border-color:#6b9a76;box-shadow:0 0 0 3px rgba(107,154,118,.13)}
      .client-dossier-analysis-picker{margin:0;padding:14px;border:1px solid #e1e9e2;border-radius:8px;min-width:0}
      .client-dossier-analysis-picker legend{display:flex;align-items:center;gap:8px;padding:0 5px;color:#284a43;font-size:.82rem;font-weight:700}
      .client-dossier-analysis-picker>p{margin:4px;color:var(--color-text-muted);font-size:.78rem}
      .client-dossier-analysis-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:220px;overflow:auto}
      .client-dossier-analysis-option{display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid #e5ece6;border-radius:7px;cursor:pointer}
      .client-dossier-analysis-option input{margin:3px 0 0;accent-color:#315d46}
      .client-dossier-analysis-option span{display:flex;flex-direction:column;gap:4px;min-width:0}
      .client-dossier-analysis-option strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#284a43;font-size:.77rem}
      .client-dossier-analysis-option small{color:var(--color-text-muted);font-size:.7rem}
      .client-dossier-form-actions{display:flex;justify-content:flex-end;gap:9px}
      .client-dossiers-list{display:flex;flex-direction:column;gap:13px}
      .client-dossiers-list-heading{display:flex;align-items:center;gap:9px}
      .client-dossiers-list-heading span{display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:99px;background:#edf4eb;color:#315d46;font-size:.7rem;font-weight:700}
      .client-dossiers-empty{display:flex;flex-direction:column;align-items:center;gap:9px;margin:0;padding:34px 20px;border:1px dashed #cbd9ce;border-radius:10px;background:#fff;text-align:center;color:var(--color-text-muted);font-size:.82rem;line-height:1.5}
      .client-dossiers-empty>span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#eff5ed;color:#527d5d}
      .client-dossiers-empty strong{color:var(--color-primary);font-size:.92rem}
      .client-dossiers-empty p{max-width:480px;margin:0 0 5px}
      .client-dossier-cards{display:flex;flex-direction:column;gap:10px}
      .client-dossier-card{padding:16px 18px;background:#fff;display:flex;flex-direction:column;gap:12px}
      .client-dossier-card-main{display:flex;align-items:center;gap:12px;min-width:0}
      .client-dossier-avatar{width:40px;height:40px;flex-basis:40px;border-radius:50%}
      .client-dossier-card-title{flex:1;min-width:0}
      .client-dossier-card-title h3{margin:0;color:#24463f;font-size:.93rem;font-weight:700}
      .client-dossier-card-title p{margin:4px 0 0;color:var(--color-text-muted);font-size:.76rem;overflow-wrap:anywhere}
      .client-dossier-card-actions{display:flex;align-items:center;gap:7px}
      .client-dossier-contact{display:flex;flex-wrap:wrap;gap:7px 16px;color:#59726b;font-size:.75rem}
      .client-dossier-contact span,.client-dossier-linked-analyses li{display:inline-flex;align-items:center;gap:6px;min-width:0}
      .client-dossier-contact svg,.client-dossier-linked-analyses svg{flex-shrink:0;color:#678d70}
      .client-dossier-priorities{margin:0;padding:10px 12px;border-radius:6px;background:#f7faf6;color:#4e675f;font-size:.78rem;line-height:1.5;white-space:pre-wrap}
      .client-dossier-linked-analyses{display:flex;flex-wrap:wrap;gap:7px 14px;margin:0;padding:0;list-style:none;color:#567063;font-size:.73rem}
      .client-dossier-delete-overlay{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(18,34,30,.48);animation:clientDossierFadeIn .15s ease}
      .client-dossier-delete-modal{width:min(100%,390px);box-sizing:border-box;padding:30px 28px 24px;border:1px solid rgba(221,231,222,.9);border-radius:18px;background:#fff;text-align:center;box-shadow:0 22px 65px rgba(13,35,28,.23);animation:clientDossierSlideUp .2s ease}
      .client-dossier-delete-icon{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 15px;border-radius:50%;background:#fff0ed;color:#bd4136}
      .client-dossier-delete-modal h2{margin:0 0 9px;color:#24463f;font-size:1.12rem;font-weight:700}
      .client-dossier-delete-modal>p{margin:0 0 23px;color:#60736d;font-size:.85rem;line-height:1.55}
      .client-dossier-delete-modal>p strong{color:#284a43;font-weight:700}
      .client-dossier-delete-modal .client-dossier-delete-error{margin:-8px 0 17px;color:#a12d27;font-size:.78rem}
      .client-dossier-delete-actions{display:flex;justify-content:center;gap:10px}
      .client-dossier-delete-cancel,.client-dossier-delete-confirm{min-height:40px;padding:9px 17px;border:1px solid var(--color-border);border-radius:999px;font:inherit;font-size:.82rem;font-weight:650;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
      .client-dossier-delete-cancel{background:#fff;color:#526760}
      .client-dossier-delete-cancel:hover{background:#f2f7f1;border-color:#c4d7c3}
      .client-dossier-delete-confirm{border-color:#bd4136;background:#bd4136;color:#fff}
      .client-dossier-delete-confirm:hover{border-color:#a8332b;background:#a8332b}
      .client-dossier-delete-cancel:disabled,.client-dossier-delete-confirm:disabled{opacity:.65;cursor:wait}
      @keyframes clientDossierFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes clientDossierSlideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
      @media(max-width:700px){.client-dossiers-header{align-items:flex-start;flex-wrap:wrap}.client-dossiers-heading-copy{flex-basis:calc(100% - 65px)}.client-dossiers-header>.client-dossiers-primary{margin-left:60px}.client-dossier-fields,.client-dossier-analysis-list{grid-template-columns:1fr}.client-dossier-field-wide{grid-column:auto}.client-dossier-card-main{align-items:flex-start;flex-wrap:wrap}.client-dossier-card-actions{box-sizing:border-box;width:calc(100% - 52px);margin-left:52px;flex-wrap:wrap}.client-dossier-card-actions>.client-dossiers-secondary{flex:1 1 150px}.client-dossier-form{padding:16px}.client-dossier-form-actions{flex-wrap:wrap}.client-dossier-form-actions>*{flex:1 1 140px}}
      @media(max-width:440px){.client-dossier-delete-modal{padding:26px 20px 20px}.client-dossier-delete-actions{flex-direction:column-reverse}.client-dossier-delete-cancel,.client-dossier-delete-confirm{width:100%}}
    `}</style>
  </div>;
};
