const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function testIsolate1() {
  console.log("Testing URLSearchParams + Citynside UserAgent...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Citynside/1.0"
    },
    body: new URLSearchParams({ data: query })
  });
  console.log(`testIsolate1 status: ${res.status}`);
}

async function testIsolate2() {
  console.log("Testing URLSearchParams + Mozilla UserAgent...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    },
    body: new URLSearchParams({ data: query })
  });
  console.log(`testIsolate2 status: ${res.status}`);
}

async function testIsolate3() {
  console.log("Testing encodeURIComponent + Citynside UserAgent...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "User-Agent": "Citynside/1.0"
    },
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`testIsolate3 status: ${res.status}`);
}

async function runAll() {
  await testIsolate1();
  await testIsolate2();
  await testIsolate3();
}
runAll();
