const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Les instances publiques limitent les requêtes concurrentes. On sérialise les
// recherches dans une instance Netlify chaude et on réutilise les réponses.
const responseCache = new Map();
const inFlight = new Map();
let queueTail = Promise.resolve();
const CACHE_TTL_MS = 20 * 60 * 1000;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  let encodedQuery;
  try {
    const body = await request.text();
    if (body.length > 20_000) return jsonResponse({ error: "Requête trop volumineuse." }, 413);
    encodedQuery = new URLSearchParams(body).get("data");
  } catch {
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  if (
    !encodedQuery ||
    encodedQuery.length > 16_000 ||
    !/^\s*\[out:json\]/i.test(encodedQuery) ||
    !/around:\d{1,4},-?\d{1,2}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?/i.test(encodedQuery)
  ) {
    return jsonResponse({ error: "Requête Overpass invalide." }, 400);
  }

  const cached = responseCache.get(encodedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return new Response(cached.body, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  }

  let pending = inFlight.get(encodedQuery);
  if (!pending) {
    const run = queueTail.then(async () => {
      const recent = responseCache.get(encodedQuery);
      if (recent && Date.now() - recent.timestamp < CACHE_TTL_MS) return recent.body;

      let lastError;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7_500);
      const failures = [];
      try {
        const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
              body: new URLSearchParams({ data: encodedQuery }),
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const responseBody = await response.text();
            const parsed = JSON.parse(responseBody);
            if (!parsed || !Array.isArray(parsed.elements)) throw new Error("Réponse JSON invalide");
            return responseBody;
          } catch (error) {
            const reason = error?.name === "AbortError" ? "timeout" : String(error?.message ?? error);
            failures.push(`${new URL(endpoint).hostname}: ${reason}`);
            throw error;
          }
        });

        const responseBody = await Promise.any(attempts);
        responseCache.set(encodedQuery, { body: responseBody, timestamp: Date.now() });
        if (responseCache.size > 80) responseCache.delete(responseCache.keys().next().value);
        return responseBody;
      } catch (error) {
        lastError = error ?? new Error("Aucun serveur Overpass disponible.");
        lastError.overpassAttempts = failures;
        throw lastError;
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    });

    pending = run.finally(() => inFlight.delete(encodedQuery));
    inFlight.set(encodedQuery, pending);
    queueTail = pending.then(() => undefined, () => undefined);
  }

  try {
    const result = await pending;
    return new Response(result, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    return jsonResponse({
      error: "Les serveurs Overpass sont temporairement indisponibles après plusieurs tentatives.",
      attempts: error?.overpassAttempts ?? [],
    }, 502);
  }
};
