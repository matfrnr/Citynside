const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

const encodedQuery = `
    [out:json][timeout:15];
    (
      node(around:800,48.8566,2.3522)["highway"="bus_stop"];
      node(around:800,48.8566,2.3522)["railway"~"^(tram_stop|station|halt)$"];
      node(around:800,48.8566,2.3522)["station"="subway"];
      node(around:800,48.8566,2.3522)["amenity"~"^(bicycle_rental|parking|pharmacy|doctors|clinic|hospital|dentist|school|kindergarten|college|university|library|arts_centre|cinema|theatre|community_centre)$"];
      node(around:800,48.8566,2.3522)["shop"~"^(bakery|supermarket|convenience|butcher|greengrocer)$"];
      node(around:800,48.8566,2.3522)["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|swimming_pool|pitch|stadium|ice_rink|golf_course)$"];
      node(around:800,48.8566,2.3522)["tourism"="museum"];

      way(around:800,48.8566,2.3522)["highway"="bus_stop"];
      way(around:800,48.8566,2.3522)["railway"~"^(tram_stop|station|halt)$"];
      way(around:800,48.8566,2.3522)["station"="subway"];
      way(around:800,48.8566,2.3522)["amenity"~"^(bicycle_rental|parking|pharmacy|doctors|clinic|hospital|dentist|school|kindergarten|college|university|library|arts_centre|cinema|theatre|community_centre)$"];
      way(around:800,48.8566,2.3522)["shop"~"^(bakery|supermarket|convenience|butcher|greengrocer)$"];
      way(around:800,48.8566,2.3522)["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|swimming_pool|pitch|stadium|ice_rink|golf_course)$"];
      way(around:800,48.8566,2.3522)["tourism"="museum"];
    );
    out center qt 200;
`;

async function test() {
  const globalDeadline = Date.now() + 15000;
  const batches = [
    OVERPASS_ENDPOINTS.slice(0, 3),
    OVERPASS_ENDPOINTS.slice(3, 6)
  ];
  const failures = [];

  for (const batch of batches) {
    const remainingMs = globalDeadline - Date.now();
    if (remainingMs < 500) break;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);

    console.log(`Starting batch of ${batch.length}...`);
    try {
      const attempts = batch.map(async (endpoint) => {
        const start = Date.now();
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
              accept: "application/json",
              "user-agent": "Citynside/1.0 (+https://citynside-app.netlify.app)",
            },
            body: new URLSearchParams({ data: encodedQuery }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);

          const responseBody = await response.text();
          console.log(`Success from ${endpoint} in ${Date.now() - start}ms, size: ${responseBody.length}`);
          return responseBody;
        } catch (e) {
          console.log(`Failed ${endpoint} in ${Date.now() - start}ms: ${e.message}`);
          throw e;
        }
      });

      const result = await Promise.any(attempts);
      console.log('Got result!');
      return;
    } catch (error) {
      if (error.name === "AggregateError") {
        console.log(`Batch failed (${error.errors.map(e => e.message).join(', ')})`);
      } else {
        console.log(`Timeout or error: ${error.message}`);
      }
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
}

test();
