export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  const query = new URLSearchParams();
  for (const key of ["lat", "lon", "radius", "bbox", "limit"]) {
    if (req.query?.[key]) query.set(key, String(req.query[key]));
  }
  try {
    const response = await fetch(`https://transport.data.gouv.fr/api/gtfs/stops?${query}`);
    const text = await response.text();
    res.status(response.status).setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (error) {
    return res.status(502).json({ error: "GTFS indisponible" });
  }
}
