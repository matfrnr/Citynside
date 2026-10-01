const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testCorsProxy() {
  const targetUrl = "https://overpass-api.de/api/interpreter";
  const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
  
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Origin": "https://citynside.vercel.app", // Send this to corsproxy
    },
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`[CorsProxy] status: ${res.status}`);
  if (res.status === 200) console.log("Success!");
}
testCorsProxy();
