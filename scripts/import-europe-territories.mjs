// Public statistical/geographic data only; no LLM or credentials.
import { mkdir, writeFile } from 'node:fs/promises';
import { geoCentroid } from 'd3-geo';
const api = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/';
const sources = {
  population: `${api}demo_r_d2jan?unit=NR&sex=T&age=TOTAL&time=2000&lang=EN`,
  gdp: `${api}nama_10r_2gdp?unit=MIO_EUR&time=2000&lang=EN`,
  geometry: 'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2021_4326.geojson',
};
async function json(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url}`); return response.json(); }
const [population, gdp, geography] = await Promise.all(Object.values(sources).map(json));
const value = (dataset, code) => dataset.value[dataset.dimension.geo.category.index[code]] ?? null;
const countries = { DEU: /^DE[0-9A-G]$/, ITA: /^IT[CFGIH][0-9]$/, ESP: /^ES[0-9][0-9]$/, GBR: /^UK[C-N]$/ };
// Rounded fallback only for missing values, never marked observed.
const fallbackPopulation = { ITH5: 3970000, ITI3: 1460000 };
const ukGdpPerHeadWeights = { UKC: .78, UKD: .87, UKE: .84, UKF: .88, UKG: .87, UKH: 1.02, UKI: 1.55, UKJ: 1.1, UKK: .9, UKL: .75, UKM: .97, UKN: .77 };
const result = { sources, retrieved: new Date().toISOString(), countries: {} };
const output = new URL('../public/maps/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [countryId, pattern] of Object.entries(countries)) {
  const codes = Object.keys(population.dimension.geo.category.index).filter((code) => pattern.test(code));
  const regions = [];
  const features = [];
  for (const code of codes) {
    const f = geography.features.find((feature) => feature.properties.NUTS_ID === code);
    if (!f) throw new Error(`Geometry missing: ${code}`);
    const observedPop = value(population, code);
    const pop = observedPop ?? fallbackPopulation[code];
    if (!pop) throw new Error(`Population missing: ${code}`);
    const observedGdp = value(gdp, code);
    const weight = observedGdp ?? pop * ukGdpPerHeadWeights[code];
    if (!Number.isFinite(weight) || weight <= 0) throw new Error(`GDP weight missing: ${code}`);
    const name = population.dimension.geo.category.label[code].replace(/ \(NUTS 2021\)/g, '');
    // GISCO is clockwise for d3. Anchors are calculated, not hand-entered settlement coordinates.
    const anchor = geoCentroid(f);
    regions.push({ id: `${countryId}:${code}`, name, code, population: pop, economicWeight: weight,
      populationBasis: observedPop === null ? 'calibrated' : 'observed_2000',
      economicBasis: observedGdp === null ? 'calibrated' : 'observed_2000', anchor });
    features.push({ type: 'Feature', properties: { id: `${countryId}:${code}`, name }, geometry: f.geometry });
  }
  // Italy: two autonomous provinces make one region; keep one permanent territorial unit.
  if (countryId === 'ITA') {
    const parts = regions.filter((r) => ['ITH1', 'ITH2'].includes(r.code));
    const polygons = features.filter((f) => /:ITH[12]$/.test(f.properties.id)).flatMap((f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
    const merged = { type: 'Feature', properties: { id: 'ITA:ITH12', name: 'Trentino-Alto Adige / Südtirol' }, geometry: { type: 'MultiPolygon', coordinates: polygons } };
    regions.splice(0, regions.length, ...regions.filter((r) => !['ITH1', 'ITH2'].includes(r.code)), {
      id: 'ITA:ITH12', code: 'ITH12', name: merged.properties.name,
      population: parts.reduce((sum, r) => sum + r.population, 0), economicWeight: parts.reduce((sum, r) => sum + r.economicWeight, 0),
      populationBasis: 'observed_2000', economicBasis: 'observed_2000', anchor: geoCentroid(merged),
    });
    features.splice(0, features.length, ...features.filter((f) => !/:ITH[12]$/.test(f.properties.id)), merged);
  }
  result.countries[countryId] = regions;
  await writeFile(new URL(`${countryId.toLowerCase()}-regions.geojson`, output), JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`${countryId}: ${regions.length} territoires, ${regions.filter((r) => r.populationBasis === 'calibrated' || r.economicBasis === 'calibrated').length} avec calibration partielle.`);
}
await mkdir(new URL('../lib/simulation/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/simulation/data/europe-regions-2000.json', import.meta.url), JSON.stringify(result, null, 2));
await writeFile(new URL('europe-regions.source.json', output), JSON.stringify({ sources, attribution: '© EuroGeographics pour les limites administratives — Eurostat/GISCO',
  terms: 'https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units/territorial-units-statistics',
  note: 'Fond NUTS 2021, valeurs rétrospectives 2000 : frontières régionales approchées pour le scénario, pas une reconstitution cadastrale de 2000.' }, null, 2));
