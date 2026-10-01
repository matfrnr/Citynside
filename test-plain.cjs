const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testPlain1() {
  console.log("Testing text/plain with Mozilla...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    body: query
  });
  console.log(`testPlain1 status: ${res.status}`);
  if (res.status === 200) console.log((await res.text()).slice(0, 50));
}
testPlain1();
