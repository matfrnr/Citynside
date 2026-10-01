const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
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

      const failures = [];
      // Netlify's synchronous function limit on the FREE tier is strictly 10 seconds.
      // If we take longer, AWS Lambda kills the process, resulting in a 502 with "An unknown error has occurred".
      // We set a global deadline of 8.5s to ensure we can catch the timeout and return a proper JSON error.
      // We use batches with Promise.any to allow up to 8.5s per mirror (since 2.2s is too short for Overpass).
      const globalDeadline = Date.now() + 8500;
      
      const batches = [
        OVERPASS_ENDPOINTS.slice(0, 3),
        OVERPASS_ENDPOINTS.slice(3, 6)
      ];

      for (const batch of batches) {
        const remainingMs = globalDeadline - Date.now();
        if (remainingMs < 500) break;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), remainingMs);

        try {
          const attempts = batch.map(async (endpoint) => {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                accept: "application/json",
                "user-agent": "Citynside/1.0 (+https://citynside-app.netlify.app)",
                referer: "https://citynside-app.netlify.app/",
              },
              body: new URLSearchParams({ data: encodedQuery }),
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);

            const responseBody = await response.text();
            const parsed = JSON.parse(responseBody);
            if (!parsed || !Array.isArray(parsed.elements)) throw new Error(`Réponse JSON invalide de ${endpoint}`);
            
            return { body: responseBody, endpoint };
          });

          // Wait for the first successful mirror in this batch
          const result = await Promise.any(attempts);
          
          responseCache.set(encodedQuery, { body: result.body, timestamp: Date.now() });
          if (responseCache.size > 80) responseCache.delete(responseCache.keys().next().value);
          return result.body;
        } catch (error) {
          if (error.name === "AggregateError") {
            failures.push(`Batch failed (${error.errors.map(e => e.message).join(', ')})`);
          } else {
            failures.push(`Timeout or error: ${error.message}`);
          }
        } finally {
          clearTimeout(timeout);
          // Cancel other pending requests in this batch since we either succeeded or failed
          controller.abort();
        }
      }

      const unavailable = new Error("Aucun serveur Overpass n'a répondu dans le délai strict de 8.5s.");
        unavailable.overpassAttempts = failures;
      throw unavailable;
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
