const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testOrigin() {
  console.log("Testing Mozilla UserAgent with Origin and Referer...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Origin": "https://citynside-5hiz173u1-barcola.vercel.app",
      "Referer": "https://citynside-5hiz173u1-barcola.vercel.app/"
    },
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`testOrigin status: ${res.status}`);
}
testOrigin();
