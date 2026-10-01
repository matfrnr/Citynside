import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, MapPin } from "lucide-react";
import type { CategoryScore, NeighborhoodAnalysis } from "../../types";

interface ComparisonViewProps { analyses: NeighborhoodAnalysis[]; }
const labelFor = (analysis: NeighborhoodAnalysis) => analysis.neighborhoodName || analysis.address;
const scoreLabel = (value: number) => `${value.toFixed(1)}/10`;

export const ComparisonView: React.FC<ComparisonViewProps> = ({ analyses }) => {
  const [leftId, setLeftId] = useState(analyses[0]?.id || "");
  const [rightId, setRightId] = useState(analyses[1]?.id || "");
  useEffect(() => {
    if (!analyses.some((item) => item.id === leftId)) setLeftId(analyses.find((item) => item.id !== rightId)?.id || analyses[0]?.id || "");
    if (!analyses.some((item) => item.id === rightId)) setRightId(analyses.find((item) => item.id !== leftId)?.id || analyses[1]?.id || "");
  }, [analyses, leftId, rightId]);

  const left = analyses.find((item) => item.id === leftId);
  const right = analyses.find((item) => item.id === rightId);
  const categories = useMemo(() => {
    const rows = new Map<string, { label: string; left?: CategoryScore; right?: CategoryScore }>();
    for (const score of left?.categories || []) rows.set(score.category, { label: score.label, left: score });
    for (const score of right?.categories || []) {
      const previous = rows.get(score.category);
      rows.set(score.category, { label: previous?.label || score.label, left: previous?.left, right: score });
    }
    return [...rows.entries()].map(([id, value]) => ({ id, ...value }));
  }, [left, right]);

  const scoreSummary = (a: number | undefined, b: number | undefined, short = false) => {
    if (a === undefined || b === undefined || Math.abs(a - b) < 0.05) return "Notes équivalentes";
    const side = a > b ? "A" : "B";
    const amount = Math.abs(a - b).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return short ? `${side} +${amount} pt` : `Le quartier ${side} est mieux noté de ${amount} point${amount === "1,0" ? "" : "s"}.`;
  };
  const countSummary = (a: number, b: number) => {
    const delta = Math.abs(a - b);
    if (!delta) return "À égalité";
    return `+${delta} côté ${a > b ? "A" : "B"}`;
  };
  const counts = left && right ? [
    ...[
      { category: "commerces", label: "Commerces", singular: "commerce", plural: "commerces" },
      { category: "ecoles", label: "Écoles", singular: "école", plural: "écoles" },
      { category: "sante", label: "Santé", singular: "service de santé", plural: "services de santé" },
      { category: "espaces_verts", label: "Espaces verts", singular: "espace vert", plural: "espaces verts" },
      { category: "transports", label: "Transports", singular: "transport", plural: "transports" },
      { category: "stationnement", label: "Stationnement", singular: "place de stationnement", plural: "places de stationnement" },
      { category: "loisirs", label: "Sport, culture & loisirs", singular: "équipement de sport, culture ou loisir", plural: "équipements de sport, culture ou loisir" },
    ].map((type) => ({
      id: type.category, label: type.label, singular: type.singular, plural: type.plural,
      a: left.pois.filter((poi) => poi.category === type.category).length,
      b: right.pois.filter((poi) => poi.category === type.category).length,
    })),
    { id: "nearby", label: "Équipements à moins de 500 m", singular: "équipement", plural: "équipements", a: left.pois.filter((poi) => poi.distanceMeters <= 500).length, b: right.pois.filter((poi) => poi.distanceMeters <= 500).length },
  ] : [];
  const accessRows = left && right ? [
    { id: "transports", label: "Transport le plus proche", a: left.pois.filter((poi) => poi.category === "transports").sort((x, y) => x.distanceMeters - y.distanceMeters)[0], b: right.pois.filter((poi) => poi.category === "transports").sort((x, y) => x.distanceMeters - y.distanceMeters)[0] },
    { id: "commerces", label: "Commerce le plus proche", a: left.pois.filter((poi) => poi.category === "commerces").sort((x, y) => x.distanceMeters - y.distanceMeters)[0], b: right.pois.filter((poi) => poi.category === "commerces").sort((x, y) => x.distanceMeters - y.distanceMeters)[0] },
    { id: "ecoles", label: "École la plus proche", a: left.pois.filter((poi) => poi.category === "ecoles").sort((x, y) => x.distanceMeters - y.distanceMeters)[0], b: right.pois.filter((poi) => poi.category === "ecoles").sort((x, y) => x.distanceMeters - y.distanceMeters)[0] },
  ] : [];
  const accessLabel = (poi?: NeighborhoodAnalysis["pois"][number]) => poi ? `≈ ${Math.max(1, Math.ceil(poi.distanceMeters * 1.25 / 75))} min à pied · ${Math.round(poi.distanceMeters)} m` : "Aucun repère";

  return <section className="comparison-page">
    <header className="comparison-heading"><div><p className="comparison-eyebrow">AIDE À LA DÉCISION</p><h1>Comparer deux quartiers</h1><p>Comparez les analyses enregistrées, leurs scores et les équipements à proximité.</p></div><span className="comparison-mark"><GitCompareArrows size={23}/></span></header>
    {analyses.length < 2 ? <div className="comparison-empty"><GitCompareArrows size={34}/><h2>Deux analyses sont nécessaires</h2><p>Enregistrez au moins deux analyses pour comparer leurs scores et leurs équipements.</p></div> : <>
      <div className="comparison-selectors">{[{ side: "A", value: leftId, set: setLeftId, selected: rightId }, { side: "B", value: rightId, set: setRightId, selected: leftId }].map(({ side, value, set, selected }) => {
        const analysis = analyses.find((item) => item.id === value);
        return <label className="comparison-select-card" key={side}><span className="comparison-side">Quartier {side}</span><select value={value} onChange={(event) => set(event.target.value)}>{analyses.map((item) => <option key={item.id} value={item.id} disabled={item.id === selected}>{labelFor(item)} · {item.city}</option>)}</select>{analysis && <small>{analysis.address}, {analysis.postcode}</small>}</label>;
      })}</div>
      {left && right && <>
        <div className="comparison-score-grid">{[left, right].map((item, index) => <article key={item.id} className={`comparison-score-card ${index === 0 ? "side-a" : "side-b"}`}><span className="comparison-score-caption">{index === 0 ? "Quartier A" : "Quartier B"}</span><h2>{labelFor(item)}</h2><p><MapPin size={14}/>{item.city} {item.postcode}</p><strong>{scoreLabel(item.globalScore)}</strong><small>Score global</small></article>)}</div>
        <div className="comparison-result"><strong>À retenir</strong><span>{scoreSummary(left.globalScore, right.globalScore)}</span></div>
        <section className="comparison-section"><div className="comparison-section-heading"><h2>Scores par catégorie</h2><p>Les catégories absentes d’une analyse sont signalées par un tiret.</p></div><div className="comparison-table"><div className="comparison-table-head"><span>Indicateur</span><span>{labelFor(left)}</span><span>{labelFor(right)}</span><span>Différence</span></div>{categories.map((row) => <div className="comparison-table-row" key={row.id}><strong>{row.label}</strong><span>{row.left ? scoreLabel(row.left.score) : "—"}</span><span>{row.right ? scoreLabel(row.right.score) : "—"}</span><span>{scoreSummary(row.left?.score, row.right?.score, true)}</span></div>)}{categories.length === 0 && <p className="comparison-note">Aucun score par catégorie disponible.</p>}</div></section>
        <section className="comparison-section"><div className="comparison-section-heading"><h2>Temps d’accès estimé</h2><p>À pied vers le repère le plus proche.</p></div><div className="comparison-table"><div className="comparison-table-head comparison-access-head"><span>Destination</span><span>{labelFor(left)}</span><span>{labelFor(right)}</span></div>{accessRows.map((row) => <div className="comparison-table-row comparison-access-row" key={row.id}><strong>{row.label}</strong><span>{accessLabel(row.a)}</span><span>{accessLabel(row.b)}</span></div>)}</div><div className="comparison-source-note">Estimations indicatives calculées à partir de la distance directe (marche estimée à 4,5 km/h avec marge de trajet). Ce ne sont pas des itinéraires routés.</div></section>
        <section className="comparison-section"><div className="comparison-section-heading"><h2>Équipements à proximité</h2><p>Comptage des points d’intérêt enregistrés lors de chaque analyse.</p></div><div className="comparison-table"><div className="comparison-table-head"><span>Indicateur</span><span>{labelFor(left)}</span><span>{labelFor(right)}</span><span>Différence</span></div>{counts.map((row) => <div className="comparison-table-row" key={row.id}><strong>{row.label}</strong><span>{row.a}</span><span>{row.b}</span><span>{countSummary(row.a, row.b)}</span></div>)}</div><div className="comparison-source-note">Les analyses peuvent avoir été réalisées à des dates différentes. Les équipements reflètent les données récupérées lors de chaque analyse.</div></section>
      </>}
    </>}
    <style>{`.comparison-page{max-width:1050px;margin:0 auto;color:var(--color-text-main);display:flex;flex-direction:column;gap:22px}.comparison-heading{display:flex;justify-content:space-between;align-items:center}.comparison-eyebrow{color:#527f5e;font-size:.7rem;font-weight:700;letter-spacing:.08em}.comparison-heading h1{margin-top:4px;color:var(--color-primary);font-family:var(--font-family-heading);font-size:2rem}.comparison-heading p{margin-top:7px;color:var(--color-text-muted);font-size:.87rem}.comparison-mark{display:grid;place-items:center;width:48px;height:48px;border-radius:12px;background:#eaf3e7;color:#416b4c}.comparison-selectors,.comparison-score-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.comparison-select-card,.comparison-score-card,.comparison-section,.comparison-empty{background:#fff;border:1px solid var(--color-border);border-radius:9px;box-shadow:var(--shadow-subtle)}.comparison-select-card{display:flex;flex-direction:column;gap:9px;padding:16px}.comparison-side,.comparison-score-caption{color:#527f5e;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.comparison-select-card select{width:100%;padding:11px 12px;border:1px solid var(--color-border);border-radius:6px;background:#fff;color:var(--color-primary);font:inherit;font-size:.85rem}.comparison-select-card small{color:var(--color-text-muted);font-size:.76rem}.comparison-score-card{padding:18px 20px}.comparison-score-card h2{margin-top:8px;color:var(--color-primary);font-size:1rem}.comparison-score-card p{display:flex;align-items:center;gap:5px;margin-top:6px;color:var(--color-text-muted);font-size:.77rem}.comparison-score-card>strong{display:block;margin-top:16px;color:var(--color-primary);font-size:2rem}.comparison-score-card>small{color:var(--color-text-muted);font-size:.74rem}.comparison-score-card.side-a{border-top:3px solid #5c8a65}.comparison-score-card.side-b{border-top:3px solid #6284a1}.comparison-result{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-radius:7px;background:#edf4e9;color:var(--color-primary);font-size:.84rem}.comparison-section{overflow:hidden}.comparison-section-heading{padding:18px 20px;border-bottom:1px solid var(--color-border-subtle)}.comparison-section-heading h2{font-size:1rem;color:var(--color-primary)}.comparison-section-heading p{margin-top:4px;color:var(--color-text-muted);font-size:.75rem}.comparison-table-head,.comparison-table-row{display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(110px,1fr) minmax(110px,1fr) minmax(105px,.9fr);gap:12px;align-items:center;padding:12px 16px}.comparison-access-head,.comparison-access-row{grid-template-columns:minmax(150px,1.3fr) minmax(110px,1fr) minmax(110px,1fr)}.comparison-table-head{background:#f5f8f3;color:var(--color-text-muted);font-size:.69rem;font-weight:650}.comparison-table-row{border-top:1px solid #edf0ec;color:var(--color-text-muted);font-size:.78rem}.comparison-table-row strong{color:var(--color-primary);font-weight:600}.comparison-note{padding:15px;color:var(--color-text-muted);font-size:.8rem}.comparison-source-note{padding:13px 16px;background:#f8faf7;color:var(--color-text-muted);font-size:.72rem;line-height:1.5}.comparison-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:42px 20px;text-align:center;color:#527f5e}.comparison-empty h2{color:var(--color-primary);font-size:1rem}.comparison-empty p{max-width:400px;color:var(--color-text-muted);font-size:.82rem;line-height:1.5}@media(max-width:700px){.comparison-selectors,.comparison-score-grid{grid-template-columns:1fr}.comparison-table{overflow-x:auto}.comparison-table-head,.comparison-table-row{min-width:620px}.comparison-heading h1{font-size:1.6rem}.comparison-result{align-items:flex-start;flex-direction:column;gap:4px}}`}</style>
  </section>;
};
