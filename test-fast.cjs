const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;
async function test() {
  const start = Date.now();
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`Status: ${res.status} in ${Date.now() - start}ms`);
  console.log((await res.text()).slice(0, 200));
}
test();
