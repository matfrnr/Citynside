import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import type { NeighborhoodAnalysis } from "../../types";
import { askNeighborhoodAssistant } from "../../services/assistantApi";
import { FormattedAssistantMessage } from "./FormattedAssistantMessage";

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const starterQuestions = [
  "Quels sont les principaux atouts de ce quartier ?",
  "Quels points de vigilance dois-je expliquer ?",
  "Résume cette analyse en quelques phrases.",
];

const offTopicReply = "Je peux vous aider à lire cette analyse de quartier : ses scores, ses équipements, ses atouts et ses points de vigilance. Les questions générales ne sont pas envoyées au modèle.";

function isNeighborhoodQuestion(question: string, history: ConversationTurn[], analysis: NeighborhoodAnalysis): boolean {
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b\d+\s*(?:\+|\-|\*|\/|plus|moins|fois|divise par)\s*\d+\b/.test(normalized)
    || /\b(calcul|calcule|resous|recette|meteo|ecris un mail|redige un mail|traduis|programme en|code en|blague|poeme|president|capitale de)\b/.test(normalized)) return false;
  if (/\b(quartier|analyse|note|score|indicateur|critere|atout|avantage|points? forts?|points? de vigilance|reserve|proximite|environnement|ecole|maternelle|college|lycee|universite|transport|gare|bus|tram|commerce|sante|medecin|pharmacie|parc|espace vert|securite|risque|air|bruit|accessibilite|pmr|famille|enfant|senior|etudiant|immobilier|bien|logement|rapport|resultat|equipement|service|marche|sport|culture|synthese|resume|profil|comparaison|comparer|marche a pied|temps de trajet)\b/.test(normalized)) return true;
  const analysisText = analysis.categories.flatMap((category) => [
    category.label,
    category.highlightText,
    ...category.positiveFactors.map(({ label }) => label),
    ...category.negativeFactors.map(({ label }) => label),
  ]).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const stopWords = new Set(["quartier", "analyse", "indicateur", "services", "service", "points", "point", "score", "acces", "proximite", "accessible", "marche"]);
  const analysisTerms = analysisText.match(/[a-z]{6,}/g) || [];
  if (analysisTerms.some((term) => !stopWords.has(term) && normalized.includes(term))) return true;
  const previousAnswer = [...history].reverse().find((turn) => turn.role === "assistant")?.content || "";
  const isShortFollowUp = history.some((turn) => turn.role === "assistant")
    && normalized.length <= 120
    && /\b(et|cela|ca|ce|cette|pourquoi|comment|lequel|laquelle|eux|elle|ils|elles|davantage|plus)\b/.test(normalized);
  return isShortFollowUp && !previousAnswer.startsWith("Je peux vous aider à lire cette analyse");
}

export function NeighborhoodAssistant({ analysis }: { analysis: NeighborhoodAnalysis }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotaWarning, setQuotaWarning] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [turns, isLoading]);

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    setQuestion("");
    setError("");
    setQuotaWarning("");
    if (!isNeighborhoodQuestion(trimmed, turns, analysis)) {
      setTurns((current) => ([...current, { role: "user", content: trimmed }, { role: "assistant", content: offTopicReply }] as ConversationTurn[]).slice(-20));
      return;
    }
    setTurns((current) => ([...current, { role: "user", content: trimmed }] as ConversationTurn[]).slice(-20));
    setIsLoading(true);
    try {
      const result = await askNeighborhoodAssistant(trimmed, analysis, turns.slice(-6));
      setTurns((current) => ([...current, { role: "assistant", content: result.answer }] as ConversationTurn[]).slice(-20));
      setQuotaWarning(result.quotaWarning || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  return <section className="neighborhood-assistant cyt-card">
    <button className="neighborhood-assistant-toggle" type="button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
      <span className="neighborhood-assistant-mark"><Sparkles size={18} /></span>
      <span className="neighborhood-assistant-toggle-copy"><strong>Assistant Citynside <em>Bêta</em></strong><small>Comprendre les résultats de cette analyse</small></span>
      <span className="neighborhood-assistant-toggle-action">{isOpen ? "Fermer" : "Poser une question"}</span>
      {isOpen ? <X size={18} /> : <Bot size={19} />}
    </button>
    {isOpen && <div className="neighborhood-assistant-body">
      <p className="neighborhood-assistant-notice">L’IA reçoit les indicateurs et leurs résumés, sans adresse précise ni coordonnées. Vérifiez les réponses avant de les reprendre auprès d’un client.</p>
      {turns.length === 0 && <div className="neighborhood-assistant-welcome"><div><span className="neighborhood-assistant-welcome-icon"><Bot size={20} /></span><span><strong>Que souhaitez-vous éclaircir ?</strong><small>Je réponds uniquement à propos de cette analyse.</small></span></div><div className="neighborhood-assistant-starters">
        {starterQuestions.map((starter) => <button type="button" key={starter} disabled={isLoading} onClick={() => void ask(starter)}>{starter}</button>)}
      </div></div>}
      {turns.length > 0 && <div className="neighborhood-assistant-conversation" ref={conversationRef} aria-live="polite">
        {turns.map((turn, index) => <article key={`${index}-${turn.role}`} className={`neighborhood-assistant-turn is-${turn.role}`}>
          <strong>{turn.role === "user" ? "Vous" : "Assistant Citynside"}</strong>
          {turn.role === "assistant" ? <FormattedAssistantMessage content={turn.content} /> : <p>{turn.content}</p>}
        </article>)}
        {isLoading && <div className="neighborhood-assistant-pending"><LoaderCircle size={16} className="neighborhood-assistant-spinner" /> Je relis les indicateurs…</div>}
      </div>}
      {error && <p className="neighborhood-assistant-error" role="alert">{error}</p>}
      {quotaWarning && <p className="neighborhood-assistant-quota-warning" role="status">{quotaWarning}</p>}
      <form className="neighborhood-assistant-form" onSubmit={handleSubmit}>
        <label className="neighborhood-assistant-sr-only" htmlFor="neighborhood-assistant-question">Votre question sur cette analyse</label>
        <input id="neighborhood-assistant-question" type="text" value={question} maxLength={600} placeholder="Votre question sur cette analyse…" onChange={(event) => setQuestion(event.target.value)} disabled={isLoading} />
        <button type="submit" disabled={isLoading || !question.trim()} aria-label="Envoyer la question">{isLoading ? <LoaderCircle size={17} className="neighborhood-assistant-spinner" /> : <Send size={17} />}</button>
      </form>
      <small className="neighborhood-assistant-quota">L’utilisation de l’assistant est limitée. Si le quota disponible est atteint, vous pourrez poser de nouvelles questions après son renouvellement.</small>
    </div>}
    <style>{`
      .neighborhood-assistant { overflow: hidden; border: 1px solid #dce8df; background: #fff; box-shadow: 0 8px 24px rgba(32,67,49,.06); }
      .neighborhood-assistant-toggle { display:flex; align-items:center; gap:12px; width:100%; min-height:70px; padding:14px 18px; border:0; background:linear-gradient(100deg,#fbfdfb,#f4f8f3); color:var(--color-primary); text-align:left; cursor:pointer; }
      .neighborhood-assistant-mark { display:grid; place-items:center; width:42px; height:42px; flex:0 0 auto; border-radius:13px; background:#e5f0e5; }
      .neighborhood-assistant-toggle-copy { display:grid; gap:4px; flex:1; }
      .neighborhood-assistant-toggle-copy strong { display:flex; align-items:center; gap:7px; font-size:.92rem; }
      .neighborhood-assistant-toggle-copy em { padding:2px 6px; border-radius:99px; background:#eaf1e9; color:#55735b; font-size:.59rem; font-style:normal; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
      .neighborhood-assistant-toggle-copy small { color:var(--color-text-muted); font-size:.76rem; }
      .neighborhood-assistant-toggle-action { color:#54725a; font-size:.74rem; font-weight:650; }
      .neighborhood-assistant-body { display:grid; gap:13px; padding:15px 18px 17px; }
      .neighborhood-assistant-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      .neighborhood-assistant-notice,.neighborhood-assistant-quota { color:var(--color-text-muted); font-size:.71rem; line-height:1.5; }
      .neighborhood-assistant-notice { padding:9px 11px; border-left:3px solid #b9cfb9; border-radius:4px 8px 8px 4px; background:#f7f9f6; }
      .neighborhood-assistant-welcome { display:grid; gap:13px; min-height:155px; align-content:center; padding:18px; border:1px solid #e8eee7; border-radius:13px; background:#fcfdfb; }
      .neighborhood-assistant-welcome > div:first-child { display:flex; align-items:center; gap:10px; }
      .neighborhood-assistant-welcome-icon { display:grid; place-items:center; width:36px; height:36px; flex:0 0 auto; border-radius:50%; background:#eaf2e9; color:var(--color-primary); }
      .neighborhood-assistant-welcome > div:first-child > span:last-child { display:grid; gap:3px; }
      .neighborhood-assistant-welcome strong { color:var(--color-primary); font-size:.84rem; }
      .neighborhood-assistant-welcome small { color:var(--color-text-muted); font-size:.73rem; }
      .neighborhood-assistant-starters { display:flex; flex-wrap:wrap; gap:7px; }
      .neighborhood-assistant-starters button { padding:8px 10px; border:1px solid #dfe8dd; border-radius:9px; background:#fff; color:#345a3d; font:inherit; font-size:.73rem; text-align:left; cursor:pointer; transition:background .15s,border-color .15s; }
      .neighborhood-assistant-starters button:hover { border-color:var(--color-green); background:#f0f6ee; }
      .neighborhood-assistant-starters button:disabled { opacity:.55; cursor:wait; }
      .neighborhood-assistant-conversation { display:flex; flex-direction:column; gap:10px; min-height:155px; max-height:340px; overflow:auto; padding:12px; border:1px solid #e8eee7; border-radius:13px; background:#fcfdfb; overflow-anchor:none; overscroll-behavior:contain; scrollbar-gutter:stable; }
      .neighborhood-assistant-turn { width:fit-content; max-width:min(88%,620px); padding:10px 13px; border-radius:13px; }
      .neighborhood-assistant-turn.is-user { align-self:flex-end; background:#eaf2e9; border-bottom-right-radius:4px; }
      .neighborhood-assistant-turn.is-assistant { align-self:flex-start; background:#f1f3f0; border-bottom-left-radius:4px; }
      .neighborhood-assistant-turn strong { display:block; margin-bottom:4px; color:var(--color-primary); font-size:.69rem; }
      .neighborhood-assistant-turn p { color:var(--color-text-main); font-size:.81rem; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
      .assistant-message-content { display:grid; gap:9px; color:var(--color-text-main); font-size:.81rem; line-height:1.55; overflow-wrap:anywhere; }
      .assistant-message-content p { margin:0; white-space:pre-wrap; }
      .assistant-message-content h4 { margin:0; color:var(--color-primary); font-size:.86rem; line-height:1.4; }
      .assistant-message-content ul,.assistant-message-content ol { display:grid; gap:6px; margin:0; padding-left:19px; }
      .assistant-message-content li { padding-left:2px; }
      .assistant-message-content li::marker { color:#62846a; }
      .assistant-message-table-wrap { max-width:100%; overflow:auto; border:1px solid #dfe8dd; border-radius:9px; scrollbar-gutter:stable; }
      .assistant-message-table { width:100%; min-width:440px; border-collapse:collapse; background:#fff; font-size:.74rem; line-height:1.45; }
      .assistant-message-table th { padding:8px 10px; background:#edf4ec; color:#294b32; font-weight:700; text-align:left; }
      .assistant-message-table td { padding:8px 10px; border-top:1px solid #e8eee7; vertical-align:top; }
      .assistant-message-table tr:nth-child(even) td { background:#fafcf9; }
      .neighborhood-assistant-form { display:flex; align-items:center; gap:9px; }
      .neighborhood-assistant-form input { flex:1; width:0; height:48px; padding:0 15px; border:1px solid #d7e2d7; border-radius:12px; background:#fff; color:var(--color-text-main); font:inherit; font-size:.84rem; transition:border-color .15s,box-shadow .15s; }
      .neighborhood-assistant-form input::placeholder { color:#89958c; }
      .neighborhood-assistant-form input:focus { outline:none; border-color:#668c6c; box-shadow:0 0 0 3px rgba(77,119,83,.12); }
      .neighborhood-assistant-form button { display:grid; place-items:center; width:48px; height:48px; flex:0 0 auto; border:0; border-radius:12px; background:#244f37; color:#fff; cursor:pointer; transition:background .15s,opacity .15s; }
      .neighborhood-assistant-form button:not(:disabled):hover { background:#193f2b; }
      .neighborhood-assistant-form button:disabled { background:#aebbb1; cursor:not-allowed; }
      .neighborhood-assistant-error { padding:9px 11px; border-radius:9px; background:#fff4f2; color:#a5352f; font-size:.77rem; line-height:1.45; }
      .neighborhood-assistant-quota-warning { padding:9px 11px; border:1px solid #f1d69a; border-radius:9px; background:#fff9e9; color:#795711; font-size:.77rem; line-height:1.45; }
      .neighborhood-assistant-pending { display:flex; align-items:center; gap:8px; width:fit-content; padding:9px 12px; border-radius:12px; background:#f1f3f0; color:var(--color-text-muted); font-size:.76rem; }
      .neighborhood-assistant-spinner { animation:neighborhood-assistant-pulse 1.2s ease-in-out infinite; }
      @keyframes neighborhood-assistant-pulse { 50% { opacity:.38; } }
      @media (max-width:620px) { .neighborhood-assistant-toggle { min-height:64px; padding:12px; gap:9px; } .neighborhood-assistant-toggle-action { display:none; } .neighborhood-assistant-body { padding:12px; } .neighborhood-assistant-welcome { padding:13px; } .neighborhood-assistant-starters { display:grid; } .neighborhood-assistant-starters button { width:100%; } .neighborhood-assistant-turn { max-width:95%; } .assistant-message-table { min-width:380px; } }
    `}</style>
  </section>;
}
