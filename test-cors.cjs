const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testCors(origin, name) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Origin": origin,
      "Referer": origin + "/",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Mode": "cors"
    },
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`[${name}] status: ${res.status}`);
}

async function runAll() {
  await testCors("https://overpass-turbo.eu", "Overpass Turbo");
  await testCors("https://citynside.vercel.app", "Vercel App");
  await testCors("http://localhost:5173", "Localhost");
}
runAll();
