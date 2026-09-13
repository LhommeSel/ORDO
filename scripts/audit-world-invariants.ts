import assert from 'node:assert/strict';

import { advanceWorld } from '../lib/simulation/engine';
import { createFrance2000World, createWorld2000 } from '../lib/simulation/scenario-2000';
import { validateCountryRegistry } from '../lib/simulation/data-validator';

const representativePlayers = ['FRA', 'USA', 'CHN', 'RUS', 'IND', 'JPN', 'BRA', 'ZAF', 'NGA', 'SAU', 'TUR', 'AUS'];

function assertFiniteTree(value: unknown, path: string): void {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} doit être un nombre fini`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteTree(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) assertFiniteTree(item, `${path}.${key}`);
}

const baseline = createFrance2000World();
assert.equal(Object.keys(baseline.countries).length, 196);
assert.equal(validateCountryRegistry(baseline.countries, baseline.macroEconomies).filter((issue) => issue.severity === 'error').length, 0);
assertFiniteTree(baseline, 'world');

for (const playerCountryId of representativePlayers) {
  const initial = createWorld2000(playerCountryId);
  const result = advanceWorld(initial, '2002-01-01');
  assert.equal(result.state.playerCountryId, playerCountryId);
  assert.equal(result.reachedDate, '2002-01-01');
  assert.equal(result.audit.ok, true, `${playerCountryId}: ${result.audit.issues.join(' · ')}`);
  assert.equal(Object.keys(result.state.countries).length, 196);
  assertFiniteTree(result.state, `${playerCountryId}.world`);
  for (const economy of Object.values(result.state.macroEconomies)) {
    assert.ok(economy.realGdpBillion2000Usd > 0, `${playerCountryId}/${economy.countryId}: PIB non positif`);
    assert.ok(economy.populationMillions > 0, `${playerCountryId}/${economy.countryId}: population non positive`);
    assert.ok(economy.unemploymentPct >= 0 && economy.unemploymentPct <= 100, `${playerCountryId}/${economy.countryId}: chômage hors bornes`);
    assert.ok(economy.publicDebtPctGdp >= 0 && economy.publicDebtPctGdp <= 500, `${playerCountryId}/${economy.countryId}: dette hors bornes`);
  }
  for (const relation of Object.values(result.state.relations)) {
    assert.ok(relation.relation >= 0 && relation.relation <= 100, `${playerCountryId}: relation hors bornes`);
    assert.ok(relation.trust >= 0 && relation.trust <= 100, `${playerCountryId}: confiance hors bornes`);
  }
}

console.log(`Audit mondial validé : 196 fiches chargées (195 États et Taïwan) et ${representativePlayers.length} pays joueurs simulés pendant 24 mois, sans NaN, valeur infinie ni invariant rompu. Aucun appel IA.`);
