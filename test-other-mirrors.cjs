const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

async function testOther() {
  for (const endpoint of MIRRORS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Origin": "https://citynside-app.vercel.app",
          "Referer": "https://citynside-app.vercel.app/"
        },
        body: "data=" + encodeURIComponent(query)
      });
      console.log(`[${endpoint}] status: ${res.status}`);
    } catch (e) {
      console.log(`[${endpoint}] error: ${e.message}`);
    }
  }
}
testOther();
