const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const responseCache = new Map();

const jsonResponse = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders
    },
  });

export default async (request) => {
  if (request.method !== "GET" && request.method !== "OPTIONS") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      }
    });
  }

  const url = new URL(request.url);
  const latlon = url.searchParams.get("latlon");
  
  if (!latlon || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(latlon)) {
    return jsonResponse({ error: "Paramètre latlon invalide." }, 400);
  }

  const cached = responseCache.get(latlon);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return jsonResponse(cached.body, 200, { "cache-control": "public, max-age=21600" });
  }

  try {
    const response = await fetch(`https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=${encodeURIComponent(latlon)}`, {
      signal: AbortSignal.timeout(8000), // 8s max
    });

    if (!response.ok) {
      throw new Error(`Géorisques API returned ${response.status}`);
    }

    const payload = await response.json();
    responseCache.set(latlon, { body: payload, timestamp: Date.now() });
    
    if (responseCache.size > 200) {
      responseCache.delete(responseCache.keys().next().value);
    }

    return jsonResponse(payload, 200, { "cache-control": "public, max-age=21600" });
  } catch (error) {
    console.error("Georisques Proxy Error:", error);
    return jsonResponse({ error: "Géorisques API indisponible." }, 502);
  }
};
