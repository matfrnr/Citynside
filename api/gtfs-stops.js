export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ unavailable: true });
  }
  try {
    const incoming = new URL(req.url || "/api/gtfs-stops", "http://localhost");
    const query = new URLSearchParams();
    for (const key of ["south", "north", "west", "east", "width_pixels", "height_pixels", "zoom_level"]) {
      const value = incoming.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const response = await fetch(`https://transport.data.gouv.fr/api/gtfs-stops?${query}`, {
      signal: AbortSignal.timeout(6_000),
    });
    const text = await response.text();
    if (!response.ok) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ unavailable: true });
    }
    res.status(200).setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({ unavailable: true });
  }
}
