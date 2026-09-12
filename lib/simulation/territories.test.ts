import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createFrance2000World } from './scenario-2000';
import { advanceWorld } from './engine';
import { deserializeWorld, serializeWorld } from './persistence';
import { regionalizeCountry, territorySummary } from './territories';
import type { WorldState } from './types';

test('parcours territorial : France, carte, 12 mois, sauvegarde et extension à un autre pays', async () => {
  const start = performance.now();
  const initial = createFrance2000World();
  const checkTotals = (state: WorldState) => {
    for (const id of Object.keys(state.countries)) {
      const macro = state.macroEconomies[id];
      if (!macro) continue;
      const total = territorySummary(state.territorial, id);
      assert.ok(Math.abs(total.population - macro.populationMillions * 1e6) < 0.001, `${id}: population`);
      assert.ok(Math.abs(total.realGdpBillion2000Usd - macro.realGdpBillion2000Usd) < 1e-8, `${id}: PIB`);
    }
  };
  const french = Object.values(initial.territorial.territories).filter((t) => t.sovereignCountryId === 'FRA');
  assert.equal(french.length, 34);
  assert.equal(french.filter((t) => t.kind === 'region').length, 22);
  assert.equal(territorySummary(initial.territorial, 'FRA').count, 26);
  assert.ok(Object.keys(initial.territorial.assets).length >= 18);
  checkTotals(initial);
  const map = JSON.parse(await readFile(new URL('../../public/maps/fra-regions-2000.geojson', import.meta.url), 'utf8'));
  assert.equal(map.features.length, 22);
  assert.equal(new Set(map.features.map((f: { properties: { id: string } }) => f.properties.id)).size, 22);
  for (const feature of map.features) {
    assert.equal(initial.territorial.territories[feature.properties.id]?.kind, 'region');
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
  }
  for (const asset of Object.values(initial.territorial.assets)) assert.ok(initial.territorial.territories[asset.territoryId]);

  const advanced = advanceWorld(initial, '2001-01-01').state;
  assert.equal(advanced.currentDate, '2001-01-01');
  checkTotals(advanced);
  assert.notEqual(advanced.territorial.territories['FRA-r11'].population, initial.territorial.territories['FRA-r11'].population);
  const restored = deserializeWorld(serializeWorld(advanced));
  assert.deepEqual(restored.territorial, advanced.territorial);
  checkTotals(restored);
  const oldSave = JSON.parse(serializeWorld(advanced));
  delete oldSave.state.territorial;
  const migrated = deserializeWorld(JSON.stringify(oldSave));
  assert.equal(migrated.currentDate, advanced.currentDate);
  assert.deepEqual(migrated.macroEconomies.FRA, advanced.macroEconomies.FRA);
  checkTotals(migrated);

  const expanded = regionalizeCountry(initial.territorial, {
    countryId: 'JPN', assets: [], entities: [],
    territories: [1, 2].map((n) => ({
      id: `JPN:test-${n}`, name: `Région de test ${n}`, kind: 'region',
      referencePopulation: n, referenceYear: 2000, economicWeight: 3 - n,
      inNationalAccounts: true, mapGroup: 'national', anchor: null, sourceIds: [], note: 'Fixture synthétique, jamais donnée historique.',
    })),
  }, initial);
  assert.equal(expanded.territories['JPN:aggregate'], undefined);
  assert.equal(expanded.accountingTerritoryIds.JPN.length, 2);
  checkTotals({ ...initial, territorial: expanded });
  const seconds = (performance.now() - start) / 1000;
  const detailedAssets = Object.values(initial.territorial.assets).filter((asset) => asset.territoryId.startsWith('FRA-')).length;
  console.log(`Parcours validé : 34 territoires français, ${detailedAssets} actifs français (${Object.keys(initial.territorial.assets).length} actifs détaillés au total), 22 contours, 12 mois, conservation sur ${Object.keys(initial.countries).length} pays, sauvegarde et migration, régionalisation étrangère. ${seconds.toFixed(2)} s. Aucun appel IA.`);
});

test('les actifs français conservent une attribution d’opérateur compatible avec leur catégorie', () => {
  const state = createFrance2000World();
  const assets = Object.values(state.territorial.assets);
  const asset = (id: string) => assets.find((item) => item.id === `asset:FRA:${id}`);
  assert.equal(asset('gravelines')?.operatorEntityId, 'operator:EDF');
  assert.equal(asset('montoir')?.operatorEntityId, 'operator:GDF');
  assert.equal(asset('porcheville')?.operatorEntityId, null);
  assert.equal(asset('paris-basin')?.operatorEntityId, null);
  assert.equal(asset('cdg')?.operatorEntityId, null);
  assert.deepEqual(asset('porcheville')?.sourceIds, []);
});
