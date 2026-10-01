const fs = require('fs');
let c = fs.readFileSync('src/services/osmApi.ts', 'utf8');

const s1 = '  const overpassQuery = `';
const s2 = '    out center qt 200;\n  `;';

let idx1 = c.indexOf(s1);
let idx2 = c.lastIndexOf('    out center qt 200;\r\n  `;');
if (idx2 === -1) idx2 = c.lastIndexOf(s2);

if (idx1 !== -1 && idx2 !== -1) {
    const replace = `  const overpassQuery = \`
    [out:json][timeout:15];
    (
      node(around:\${radiusMeters},\${lat},\${lon})["highway"="bus_stop"];
      node(around:\${radiusMeters},\${lat},\${lon})["railway"~"^(tram_stop|station|halt)$"];
      node(around:\${radiusMeters},\${lat},\${lon})["station"="subway"];
      node(around:\${radiusMeters},\${lat},\${lon})["amenity"~"^(bicycle_rental|parking|pharmacy|doctors|clinic|hospital|dentist|school|kindergarten|college|university|library|arts_centre|cinema|theatre|community_centre)$"];
      node(around:\${radiusMeters},\${lat},\${lon})["shop"~"^(bakery|supermarket|convenience|butcher|greengrocer)$"];
      node(around:\${radiusMeters},\${lat},\${lon})["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|swimming_pool|pitch|stadium|ice_rink|golf_course)$"];
      node(around:\${radiusMeters},\${lat},\${lon})["tourism"="museum"];

      way(around:\${radiusMeters},\${lat},\${lon})["highway"="bus_stop"];
      way(around:\${radiusMeters},\${lat},\${lon})["railway"~"^(tram_stop|station|halt)$"];
      way(around:\${radiusMeters},\${lat},\${lon})["station"="subway"];
      way(around:\${radiusMeters},\${lat},\${lon})["amenity"~"^(bicycle_rental|parking|pharmacy|doctors|clinic|hospital|dentist|school|kindergarten|college|university|library|arts_centre|cinema|theatre|community_centre)$"];
      way(around:\${radiusMeters},\${lat},\${lon})["shop"~"^(bakery|supermarket|convenience|butcher|greengrocer)$"];
      way(around:\${radiusMeters},\${lat},\${lon})["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|swimming_pool|pitch|stadium|ice_rink|golf_course)$"];
      way(around:\${radiusMeters},\${lat},\${lon})["tourism"="museum"];
    );
    out center qt 200;
  \`;`;
    c = c.substring(0, idx1) + replace + c.substring(idx2 + '    out center qt 200;\r\n  `;'.length);
    fs.writeFileSync('src/services/osmApi.ts', c);
    console.log('Fixed nwr back to node/way');
} else {
    console.log('Not found bounds', idx1, idx2);
}
