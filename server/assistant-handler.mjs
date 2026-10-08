const MAX_BODY_BYTES = 32_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function cleanText(value, maxLength = 500) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, maxLength) : "";
}

function sanitizeAnalysis(value) {
  if (!value || typeof value !== "object") return null;
  const categories = Array.isArray(value.categories) ? value.categories.slice(0, 14).map((category) => ({
    name: cleanText(category?.label, 80),
    score: Number.isFinite(category?.score) ? Math.max(0, Math.min(10, Number(category.score))) : null,
    summary: cleanText(category?.highlightText, 350),
    positives: Array.isArray(category?.positiveFactors) ? category.positiveFactors.slice(0, 3).map((item) => cleanText(typeof item === "string" ? item : item?.label, 160)) : [],
    cautions: Array.isArray(category?.negativeFactors) ? category.negativeFactors.slice(0, 3).map((item) => cleanText(typeof item === "string" ? item : item?.label, 160)) : [],
  })) : [];
  const risks = Array.isArray(value.risks) ? value.risks.slice(0, 12).map((risk) => cleanText(risk?.label, 120)) : [];
  return {
    city: cleanText(value.city, 80),
    globalScore: Number.isFinite(value.globalScore) ? Math.max(0, Math.min(10, Number(value.globalScore))) : null,
    globalGrade: cleanText(value.globalGrade, 4),
    categories,
    airQuality: cleanText(value.airQuality, 180),
    risks,
  };
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).flatMap((turn) => {
    const role = turn?.role === "assistant" ? "assistant" : turn?.role === "user" ? "user" : null;
    const content = cleanText(turn?.content, 1200);
    return role && content ? [{ role, content }] : [];
  });
}

function isInScope(question, history) {
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b\d+\s*(?:\+|\-|\*|\/|plus|moins|fois|divise par)\s*\d+\b/.test(normalized)) return false;
  const topics = /\b(quartier|analyse|note|score|indicateur|critere|atout|avantage|point fort|point de vigilance|reserve|proximite|environnement|ecole|maternelle|college|lycee|universite|transport|gare|bus|tram|commerce|sante|medecin|pharmacie|parc|espace vert|securite|risque|air|bruit|accessibilite|pmr|famille|enfant|senior|etudiant|immobilier|bien|logement|rapport|resultat|equipement|service|marche|sport|culture|synthese|resume|profil|comparaison|comparer|marche a pied|temps de trajet)\b/;
  if (topics.test(normalized)) return true;
  const isShortFollowUp = history.some((turn) => turn.role === "assistant")
    && normalized.length <= 120
    && /\b(et|cela|ca|ce|cette|pourquoi|comment|lequel|laquelle|eux|elle|ils|elles|davantage|plus)\b/.test(normalized);
  return isShortFollowUp;
}

export async function handleAssistantRequest(request) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json({ error: "L’assistant n’est pas encore configuré. Ajoutez GROQ_API_KEY dans les variables serveur." }, 503);

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !supabaseAnonKey || !accessToken) return json({ error: "Connectez-vous pour utiliser l’assistant." }, 401);

  let authenticatedUser;
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!authResponse.ok) return json({ error: "Votre session a expiré. Reconnectez-vous." }, 401);
    authenticatedUser = await authResponse.json();
  } catch {
    return json({ error: "Vérification de la session impossible. Réessayez dans un instant." }, 503);
  }
  if (!authenticatedUser?.id) return json({ error: "Session invalide." }, 401);

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "La demande est trop volumineuse." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "La demande est invalide." }, 400);
  }

  const question = cleanText(body?.question, 600);
  const analysis = sanitizeAnalysis(body?.analysis);
  const history = sanitizeHistory(body?.history);
  if (!question || !analysis || analysis.categories.length === 0) return json({ error: "Une question et une analyse valide sont nécessaires." }, 400);
  if (!isInScope(question, history)) return json({ error: "Je peux répondre uniquement aux questions sur cette analyse de quartier : ses scores, ses équipements et ses points de vigilance." }, 400);

  let quota;
  try {
    const quotaResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_assistant_quota`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!quotaResponse.ok) {
      console.error("Assistant quota check failed:", quotaResponse.status, (await quotaResponse.text()).slice(0, 400));
      return json({ error: "Le compteur de quotas n’est pas disponible. Réessayez plus tard." }, 503);
    }
    const quotaPayload = await quotaResponse.json();
    quota = Array.isArray(quotaPayload) ? quotaPayload[0] : quotaPayload;
  } catch (error) {
    console.error("Assistant quota check failed:", error);
    return json({ error: "Le compteur de quotas n’est pas disponible. Réessayez plus tard." }, 503);
  }

  if (!quota || typeof quota.allowed !== "boolean") return json({ error: "Réponse de quota invalide. Réessayez plus tard." }, 503);
  if (!quota.allowed) {
    const errors = {
      global_daily: "Le quota partagé de 50 questions pour aujourd’hui est atteint. Il sera réinitialisé demain.",
      account_hourly: "Vous avez atteint votre limite de 20 questions sur une heure. Réessayez un peu plus tard.",
      account_ten_minutes: "Vous avez atteint votre limite de 5 questions sur 10 minutes. Réessayez un peu plus tard.",
    };
    const message = errors[quota.limit_code] || "Une limite de questions est atteinte. Réessayez plus tard.";
    return json({ error: message, quotaWarning: message }, 429);
  }

  const systemPrompt = [
    "Tu es l’assistant de Citynside, un outil d’aide à la lecture d’analyses de quartier destiné à des agents immobiliers en France.",
    "Réponds en français, de façon claire, concise et nuancée.",
    "Utilise uniquement les données de l’analyse fournies. N’invente aucun fait, équipement, trajet, risque ou source.",
    "Distingue les données observées des interprétations. Précise quand une information manque ou reste indicative.",
    "Ne présente jamais le score comme une recommandation immobilière ou une garantie. Ne déduis rien sur les habitants.",
    "Réponds en moins de 100 mots. N’utilise jamais de tableau ni de caractère |. Pour une question sur les points forts, cite au maximum quatre vrais atouts appuyés par les facteurs positifs; ne présente jamais un manque ou un score faible comme un atout. Utilise un titre bref puis trois ou quatre puces maximum. Écris du Markdown normal sans échapper les astérisques.",
  ].join(" ");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        temperature: 0.35,
        max_completion_tokens: 420,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyse de quartier (résumé anonymisé) :\n${JSON.stringify(analysis)}` },
          ...history,
          { role: "user", content: question },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (response.status === 429) return json({ error: "Le quota gratuit de l’assistant est momentanément atteint. Réessayez un peu plus tard." }, 429);
    if (!response.ok) {
      console.error("Groq assistant error:", response.status, (await response.text()).slice(0, 500));
      return json({ error: "L’assistant ne peut pas répondre pour le moment. Réessayez plus tard." }, 502);
    }
    const result = await response.json();
    const rawAnswer = result?.choices?.[0]?.message?.content;
    const answer = typeof rawAnswer === "string"
      ? rawAnswer.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim().slice(0, 3000)
      : "";
    if (!answer) return json({ error: "L’assistant n’a pas produit de réponse. Réessayez." }, 502);
    return json({ answer, quotaWarning: typeof quota.warning === "string" ? quota.warning : null });
  } catch (error) {
    console.error("Groq assistant request failed:", error);
    return json({ error: "Impossible de joindre l’assistant. Vérifiez votre connexion puis réessayez." }, 502);
  }
}
