const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testNetlify() {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Origin": "https://citynside-app.netlify.app",
      "Referer": "https://citynside-app.netlify.app/"
    },
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`[Netlify App] status: ${res.status}`);
}
testNetlify();
