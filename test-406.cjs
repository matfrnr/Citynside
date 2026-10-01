const query = `
[out:json][timeout:25];
(
  node(around:800,48.8566,2.3522)["amenity"="parking"];
);
out qt;
`;

async function test1() {
  console.log("Testing encodeURIComponent...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json"
    },
    body: "data=" + encodeURIComponent(query)
  });
  console.log(`test1 status: ${res.status}`);
}

async function test2() {
  console.log("Testing URLSearchParams...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json"
    },
    body: new URLSearchParams({ data: query })
  });
  console.log(`test2 status: ${res.status}`);
}

async function test3() {
  console.log("Testing URLSearchParams without manual headers...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: query })
  });
  console.log(`test3 status: ${res.status}`);
}

async function runAll() {
  await test1();
  await test2();
  await test3();
}
runAll();
