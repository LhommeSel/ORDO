import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createFrance2000World } from './scenario-2000';
import { advanceWorld } from './engine';
import { deserializeWorld, serializeWorld } from './persistence';
import { regionalizeCountry, territorySummary } from './territories';
import type { WorldState } from './types';
import { europeMacroTerritoryDatasets, europeanTerritorialCountryIds } from './territory-data-europe-macro';
import { europePriorityAssetCountryIds } from './territory-data-europe';
import { assetMonthlyOutput, assetOperationalOutput, nodeOperationalProduction, operateTerritorialAsset } from './territorial-assets';
import { energyBalance, nodePhysicalExportCapacity } from './energy';

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

test('les macro-régions couvrent l’Europe du scénario sans double compte', () => {
  const world = createFrance2000World();
  const missing: string[] = [];
  for (const countryId of europeanTerritorialCountryIds) {
    const territories = Object.values(world.territorial.territories).filter((territory) => territory.sovereignCountryId === countryId);
    const accounting = territories.filter((territory) => territory.accountingCountryId === countryId);
    const macro = world.macroEconomies[countryId];
    const summary = territorySummary(world.territorial, countryId);
    if (!macro || accounting.length < 2
      || Math.abs(summary.population - macro.populationMillions * 1e6) > 0.01
      || Math.abs(summary.realGdpBillion2000Usd - macro.realGdpBillion2000Usd) > 1e-7) missing.push(countryId);
  }
  assert.deepEqual(missing, []);
  for (const countryId of Object.keys(europeMacroTerritoryDatasets)) {
    for (const territory of Object.values(world.territorial.territories).filter((item) => item.sovereignCountryId === countryId)) {
      assert.equal(territory.kind, 'region');
      assert.equal(territory.provenance, 'calibrated');
      assert.ok(territory.anchor, `${countryId}: ancre macro-régionale manquante`);
      assert.match(territory.note, /allocation de scénario/);
    }
  }
  console.log(`Couverture européenne validée : ${europeanTerritorialCountryIds.length} pays, ${europeanTerritorialCountryIds.reduce((sum, id) => sum + Object.values(world.territorial.territories).filter((territory) => territory.sovereignCountryId === id && territory.kind !== 'aggregate').length, 0)} mailles régionales, totaux population/PIB conservés. Aucun appel IA.`);
});

test('les actifs européens prioritaires restent localisés et séparés par filière', () => {
  const world = createFrance2000World();
  const assets = Object.values(world.territorial.assets);
  const energyKinds = new Set(['nuclear', 'lng_terminal', 'thermal', 'hydro', 'refinery', 'oil_field', 'gas_field', 'storage']);
  for (const countryId of europePriorityAssetCountryIds) {
    const countryAssets = assets.filter((asset) => asset.id.startsWith(`asset:${countryId}:`));
    assert.ok(countryAssets.length >= 5, `${countryId}: inventaire prioritaire trop court`);
    assert.ok(countryAssets.some((asset) => energyKinds.has(asset.kind)), `${countryId}: aucun actif énergétique`);
    assert.ok(countryAssets.some((asset) => ['port', 'airport', 'passage', 'logistics', 'industrial', 'naval_base'].includes(asset.kind)), `${countryId}: aucune infrastructure stratégique`);
    for (const asset of countryAssets) {
      assert.ok(world.territorial.territories[asset.territoryId], `${asset.id}: territoire absent`);
      assert.notDeepEqual(asset.anchor, [0, 0], `${asset.id}: ancre par défaut`);
      assert.equal(asset.integration, 'inventory_only');
    }
  }
  console.log(`Inventaire énergétique/infrastructure validé : ${europePriorityAssetCountryIds.length} pays, ${assets.filter((asset) => europePriorityAssetCountryIds.some((id) => asset.id.startsWith(`asset:${id}:`))).length} actifs prioritaires localisés. Capacités opérationnelles ajoutées séparément de l’inventaire.`);
});

test('les actifs énergétiques ont une capacité dérivée et raccordent les nœuds sans double compte', () => {
  const world = createFrance2000World();
  const energyAssets = Object.values(world.territorial.assets).filter((asset) => asset.operation);
  assert.ok(energyAssets.length >= 70, `couche énergétique trop courte : ${energyAssets.length}`);
  for (const asset of energyAssets) {
    const operation = asset.operation!;
    assert.ok(operation.maximum > 0, `${asset.id}: capacité maximale absente`);
    assert.ok(operation.deployed >= 0 && operation.deployed <= operation.maximum + 1e-8, `${asset.id}: déploiement hors enveloppe`);
    assert.ok(operation.availabilityPct >= 0 && operation.availabilityPct <= 100, `${asset.id}: disponibilité invalide`);
    assert.ok(Math.abs(assetMonthlyOutput(asset) - assetOperationalOutput(asset) / 12) < 1e-10, `${asset.id}: débit mensuel incohérent`);
    assert.deepEqual(asset.capacity, { value: operation.maximum, unit: operation.unit });
  }
  const linked = energyAssets.filter((asset) => asset.operation?.ledgerNodeId);
  assert.ok(linked.length >= 10, 'trop peu d’actifs raccordés au registre énergétique');
  for (const node of Object.values(world.energyNodes).filter((item) => item.territorialAssetIds?.length)) {
    const detailed = node.territorialAssetIds!.reduce((sum, id) => sum + assetOperationalOutput(world.territorial.assets[id]), 0);
    assert.ok(Math.abs(nodeOperationalProduction(world, node.id) - Math.min(node.annualProduction, node.annualCapacity, detailed)) < 1e-8, `${node.id}: double compte ou débit incohérent`);
  }
  assert.ok(Math.abs(nodePhysicalExportCapacity(world, 'nor-oil') - 140) < 0.1, 'le nœud norvégien a changé de capacité exportable');
  assert.ok(Math.abs(energyBalance(world, 'FRA', 'oil')!.available - 92) < 0.1, 'le raccord français modifie le bilan de départ');
  assert.ok(Math.abs(energyBalance(world, 'FRA', 'gas')!.available - 46) < 0.1, 'le raccord gazier français modifie le bilan de départ');
  console.log(`Couche opérationnelle validée : ${energyAssets.length} actifs énergétiques, ${linked.length} raccords au registre, débit mensuel dérivé et bilans France conservés. Aucun appel IA.`);
});

test('les actions d’actifs modifient la disponibilité et restent limitées au pays joué', () => {
  const world = createFrance2000World();
  const baseline = energyBalance(world, 'FRA', 'gas')!.available;
  const closed = operateTerritorialAsset(world, 'asset:FRA:lacq', 'close');
  assert.equal(closed.ok, true);
  assert.equal(closed.state.territorial.assets['asset:FRA:lacq'].status, 'closed');
  assert.ok(energyBalance(closed.state, 'FRA', 'gas')!.available < baseline, 'la fermeture ne réduit pas le bilan gazier');
  const repaired = operateTerritorialAsset(closed.state, 'asset:FRA:lacq', 'repair');
  assert.equal(repaired.ok, true);
  assert.equal(repaired.state.territorial.assets['asset:FRA:lacq'].status, 'closed', 'la réparation doit rester en attente pendant le délai');
  const repairProgram = Object.values(repaired.state.actionPrograms).find((program) => program.territorialAssetId === 'asset:FRA:lacq');
  assert.ok(repairProgram, 'programme de réparation absent');
  assert.equal(repairProgram?.status, 'active');
  assert.equal(repairProgram?.durationMonths, 6);
  const conflicting = operateTerritorialAsset(repaired.state, 'asset:FRA:lacq', 'maintain');
  assert.equal(conflicting.ok, false, 'une seconde opération ne doit pas se superposer');
  assert.match(conflicting.error, /déjà en cours/i);
  const repairedAdvanced = advanceWorld(repaired.state, '2000-07-01').state;
  const repairedResult = Object.values(repairedAdvanced.actionPrograms).find((program) => program.id === repairProgram?.id);
  assert.ok(repairedResult && repairedResult.status !== 'active', 'la réparation doit se résoudre à son échéance');
  if (repairedResult?.status !== 'failed') {
    assert.equal(repairedAdvanced.territorial.assets['asset:FRA:lacq'].status, 'operating');
    assert.ok(energyBalance(repairedAdvanced, 'FRA', 'gas')!.available > energyBalance(closed.state, 'FRA', 'gas')!.available, 'la réparation ne restaure pas de débit');
  }
  const beforeExpansion = repairedAdvanced.energyNodes['fra-gas'].annualCapacity;
  const expanded = operateTerritorialAsset(repairedAdvanced, 'asset:FRA:lacq', 'invest');
  assert.equal(expanded.ok, true);
  const expansionProgram = Object.values(expanded.state.actionPrograms).find((program) => program.territorialAssetId === 'asset:FRA:lacq' && program.id !== repairProgram?.id);
  assert.ok(expansionProgram, 'programme d’extension absent');
  assert.equal(expansionProgram?.durationMonths, 12);
  const expandedAdvanced = advanceWorld(expanded.state, '2001-07-01').state;
  const expansionResult = Object.values(expandedAdvanced.actionPrograms).find((program) => program.id === expansionProgram?.id);
  assert.ok(expansionResult && expansionResult.status !== 'active', 'l’extension doit se résoudre à son échéance');
  if (expansionResult?.status !== 'failed') assert.ok(expandedAdvanced.energyNodes['fra-gas'].annualCapacity > beforeExpansion, 'l’extension ne progresse pas dans le registre');
  const foreign = operateTerritorialAsset(world, 'asset:GBR:bacton', 'maintain');
  assert.equal(foreign.ok, false);
  assert.match(foreign.error, /souverain/i);
  console.log('Actions d’actifs validées : fermeture immédiate, réparation/extension différées et contrôle de souveraineté actif.');
});
