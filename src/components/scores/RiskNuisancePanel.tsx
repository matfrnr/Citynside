import { AlertTriangle, ExternalLink, LoaderCircle, ShieldCheck, Volume2 } from "lucide-react";
import type { CategoryScore, RiskAssessment } from "../../types";

interface RiskNuisancePanelProps {
  assessment?: RiskAssessment;
  tranquility?: CategoryScore;
}

const isPositiveStatus = (status: string) => !/pas de risque connu|non concern|aucun risque|absence de risque|non expose|non exposé/i.test(status);

export const RiskNuisancePanel: React.FC<RiskNuisancePanelProps> = ({ assessment, tranquility }) => {
  const positiveFindings = assessment?.findings.filter((finding) => isPositiveStatus(finding.addressStatus)) ?? [];
  const naturalFindings = positiveFindings.filter((finding) => finding.group === "natural");
  const technologicalFindings = positiveFindings.filter((finding) => finding.group === "technological");

  return <section className="risk-nuisance-panel" aria-labelledby="risk-nuisance-title">
    <header className="risk-nuisance-heading">
      <div><span className="risk-kicker">POINTS DE VIGILANCE</span><h2 id="risk-nuisance-title">Risques et nuisances</h2><p>Informations séparées des scores de qualité de vie.</p></div>
      <AlertTriangle size={23} />
    </header>
    <div className="risk-nuisance-grid">
      <article className="risk-info-card">
        <div className="risk-card-title"><ShieldCheck size={18}/><h3>Risques recensés</h3></div>
        {assessment?.status === "loading" && <p className="risk-loading"><LoaderCircle size={16} className="risk-spin"/> Consultation de Géorisques…</p>}
        {assessment?.status === "unavailable" && <p className="risk-muted">Géorisques n’a pas répondu pour cette analyse. Le rapport officiel reste consultable ci-dessous.</p>}
        {assessment?.status === "available" && positiveFindings.length === 0 && <p className="risk-muted">Aucun risque positif n’a été renvoyé à cette adresse. Cela ne remplace pas la consultation du rapport réglementaire.</p>}
        {naturalFindings.length > 0 && <div className="risk-group"><strong>Risques naturels</strong>{naturalFindings.map((finding) => <div className="risk-finding" key={finding.id}><span>{finding.label}</span><b>{finding.addressStatus}</b></div>)}</div>}
        {technologicalFindings.length > 0 && <div className="risk-group"><strong>Risques technologiques</strong>{technologicalFindings.map((finding) => <div className="risk-finding" key={finding.id}><span>{finding.label}</span><b>{finding.addressStatus}</b></div>)}</div>}
        {!assessment && <p className="risk-muted">Cette ancienne analyse ne contient pas de relevé Géorisques. Relancez-la pour obtenir les données à jour.</p>}
        {assessment?.reportUrl && <a className="risk-source-link" href={assessment.reportUrl} target="_blank" rel="noreferrer">Rapport officiel Géorisques <ExternalLink size={13}/></a>}
      </article>
      <article className="risk-info-card nuisance-card">
        <div className="risk-card-title"><Volume2 size={18}/><h3>Bruit et qualité de l’air</h3></div>
        {tranquility ? <>
          <div className="nuisance-score"><strong>{tranquility.score.toFixed(1)}</strong><span>/10 · {tranquility.score >= 7 ? "plutôt favorable" : tranquility.score >= 5 ? "intermédiaire" : "vigilance"}</span></div>
          <p className="risk-muted">{tranquility.highlightText}</p>
          <p className="risk-method-note">Le bruit est estimé à partir de la proximité des infrastructures et des commerces ; ce n’est pas une mesure acoustique à l’adresse.</p>
        </> : <p className="risk-muted">Aucune estimation des nuisances n’est disponible pour cette analyse.</p>}
      </article>
    </div>
    <style>{`.risk-nuisance-panel{display:flex;flex-direction:column;gap:14px}.risk-nuisance-heading{display:flex;align-items:center;justify-content:space-between;color:#8b5415}.risk-kicker{font-size:.67rem;font-weight:750;letter-spacing:.09em}.risk-nuisance-heading h2{margin-top:4px;color:var(--color-primary);font-family:var(--font-family-heading);font-size:1.2rem}.risk-nuisance-heading p{margin-top:4px;color:var(--color-text-muted);font-size:.8rem}.risk-nuisance-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}.risk-info-card{display:flex;flex-direction:column;gap:12px;padding:18px;background:#fff;border:1px solid var(--color-border);border-radius:12px;box-shadow:var(--shadow-card)}.risk-card-title{display:flex;align-items:center;gap:8px;color:#8b5415}.risk-card-title h3{color:var(--color-primary);font-size:.92rem}.risk-group{display:flex;flex-direction:column;gap:8px}.risk-group>strong{color:var(--color-text-muted);font-size:.73rem;text-transform:uppercase;letter-spacing:.04em}.risk-finding{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-top:8px;border-top:1px solid #edf0ec;font-size:.78rem;color:var(--color-primary)}.risk-finding b{flex:0 0 auto;color:#9a5a16;font-size:.73rem;text-align:right}.risk-muted,.risk-method-note{color:var(--color-text-muted);font-size:.8rem;line-height:1.5}.risk-method-note{padding:10px;border-radius:8px;background:#f7f8f4;font-size:.72rem}.risk-source-link{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;color:#426e4d;font-size:.76rem;font-weight:650;text-decoration:none}.risk-source-link:hover{text-decoration:underline}.risk-loading{display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:.8rem}.risk-spin{animation:risk-spin 1s linear infinite}@keyframes risk-spin{to{transform:rotate(360deg)}}.nuisance-score{display:flex;align-items:baseline;gap:7px;color:var(--color-primary)}.nuisance-score strong{font-size:1.8rem}.nuisance-score span{font-size:.76rem;color:var(--color-text-muted)}@media(max-width:700px){.risk-nuisance-grid{grid-template-columns:1fr}.risk-finding{flex-direction:column;gap:3px}.risk-finding b{text-align:left}}`}</style>
  </section>;
};
