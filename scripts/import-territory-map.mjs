// Data acquisition only. No simulation or provider call. Pin the upstream revision in the manifest.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const repo = 'gregoiredavid/france-geojson';
const commitResponse = await fetch(`https://api.github.com/repos/${repo}/commits/master`);
if (!commitResponse.ok) throw new Error(`GitHub: ${commitResponse.status}`);
const { sha } = await commitResponse.json();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid source revision');
const source = `https://raw.githubusercontent.com/${repo}/${sha}/regions-avant-redecoupage-2015.geojson`;
const response = await fetch(source);
if (!response.ok) throw new Error(`Geometry: ${response.status}`);
const raw = await response.text();
const data = JSON.parse(raw);
if (data.type !== 'FeatureCollection' || data.features.length !== 22) throw new Error('Unexpected source geography');
data.features = data.features.map((feature) => ({
  type: 'Feature', properties: { id: `FRA-r${feature.properties.code}`, name: feature.properties.nom }, geometry: feature.geometry,
}));
const output = new URL('../public/maps/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('fra-regions-2000.geojson', output), JSON.stringify(data));
await writeFile(new URL('fra-regions-2000.source.json', output), JSON.stringify({
  source, revision: sha, sha256: createHash('sha256').update(raw).digest('hex'),
  attribution: 'IGN / Admin Express, INSEE, Grégoire David — France GeoJSON',
  license: 'Licence ouverte / Open Licence', licenseUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
  note: 'Anciennes régions avant 2015 ; contours généralisés, pas un relevé cadastral au 1er janvier 2000. Outre-mer : localisateurs séparés.',
}, null, 2));
console.log(`Carte enregistrée : ${data.features.length} régions, ${Buffer.byteLength(JSON.stringify(data))} octets, révision ${sha}.`);
