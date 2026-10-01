const fs = require('fs');
let c = fs.readFileSync('src/services/osmApi.ts', 'utf8');

const s1 = '/**\r\n * Requête Overpass API optimisée pour la vitesse et la robustesse.\r\n * - Ciblage des `node` et `way` (sans les relations  const overpassQuery = `';
const s2 = '    out center qt 200;\r\n  `;';

let idx1 = c.indexOf(s1);
if (idx1 === -1) {
    // try with \n
    const s1_n = '/**\n * Requête Overpass API optimisée pour la vitesse et la robustesse.\n * - Ciblage des `node` et `way` (sans les relations  const overpassQuery = `';
    idx1 = c.indexOf(s1_n);
}

let idx2 = c.lastIndexOf(s2);
if (idx2 === -1) {
    // try with \n
    const s2_n = '    out center qt 200;\n  `;';
    idx2 = c.lastIndexOf(s2_n);
}

if (idx1 !== -1 && idx2 !== -1) {
    const replace = `/**
 * Requête Overpass API optimisée pour la vitesse et la robustesse.
 * - Ciblage des \`node\` et \`way\` (sans les relations lourdes qui causent des timeouts)
 * - Timeout calibré (9s serveur, 7.5s client)
 * - Bascule rapide sur les miroirs officiels
 * - Cache persistant en sessionStorage
 */
export async function fetchPOIsInRadius(
  lat: number,
  lon: number,
  radiusMeters: number = 800,
  signal?: AbortSignal,
): Promise<POI[]> {
  const cacheKey = getCacheKey(lat, lon, radiusMeters);
  const cached = getCachedPOIs(cacheKey);
  if (cached) {
    return cached;
  }

  const overpassQuery = \`
    [out:json][timeout:8];
    (
      nwr(around:\${radiusMeters},\${lat},\${lon})["highway"="bus_stop"];
      nwr(around:\${radiusMeters},\${lat},\${lon})["railway"~"^(tram_stop|station|halt)$"];
      nwr(around:\${radiusMeters},\${lat},\${lon})["station"="subway"];
      nwr(around:\${radiusMeters},\${lat},\${lon})["amenity"~"^(bicycle_rental|parking|pharmacy|doctors|clinic|hospital|dentist|school|kindergarten|college|university|library|arts_centre|cinema|theatre|community_centre)$"];
      nwr(around:\${radiusMeters},\${lat},\${lon})["shop"~"^(bakery|supermarket|convenience|butcher|greengrocer)$"];
      nwr(around:\${radiusMeters},\${lat},\${lon})["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|swimming_pool|pitch|stadium|ice_rink|golf_course)$"];
      nwr(around:\${radiusMeters},\${lat},\${lon})["tourism"="museum"];
    );
    out center qt 200;
  \`;`;
    c = c.substring(0, idx1) + replace + c.substring(idx2 + s2.length);
    fs.writeFileSync('src/services/osmApi.ts', c);
    console.log('Fixed successfully');
} else {
    console.log('Not found:', idx1, idx2);
}
