const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testGet() {
  console.log("Testing GET...");
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });
  console.log(`GET status: ${res.status}`);
  if (res.status === 200) {
     const text = await res.text();
     console.log(`GET size: ${text.length}`);
  } else {
     console.log(await res.text());
  }
}
testGet();
