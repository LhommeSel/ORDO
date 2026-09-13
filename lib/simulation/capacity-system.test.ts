import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceOperationalCapacities, capacityLoad } from './capacity-system';
import { createFrance2000World } from './scenario-2000';
import { advanceWorld } from './engine';

test('la surcharge opérationnelle est progressive et réversible', () => {
  const initial = createFrance2000World();
  const overloaded = { ...initial, countries: { ...initial.countries, FRA: {
    ...initial.countries.FRA,
    capacities: { ...initial.countries.FRA.capacities, diplomacy: { maximum: 10, committed: 14 } },
  } } };
  const stressed = advanceOperationalCapacities(overloaded, 1);
  const capacity = stressed.countries.FRA.capacities.diplomacy;
  assert.equal(capacity.overloadMonths, 1);
  assert.ok((capacity.efficiencyPct ?? 100) < 100);
  assert.ok(stressed.countries.FRA.metrics.stability < initial.countries.FRA.metrics.stability);
  const recovered = advanceOperationalCapacities({ ...stressed, countries: { ...stressed.countries, FRA: {
    ...stressed.countries.FRA,
    capacities: { ...stressed.countries.FRA.capacities, diplomacy: { ...capacity, committed: 2 } },
  } } }, 1);
  assert.equal(recovered.countries.FRA.capacities.diplomacy.overloadMonths, 0);
  assert.equal(capacityLoad(recovered.countries.FRA.capacities.diplomacy).level, 'available');
});

test('la boucle mensuelle exécute la revue des capacités avant le macro-modèle', () => {
  const initial = createFrance2000World();
  const state = { ...initial, countries: { ...initial.countries, FRA: {
    ...initial.countries.FRA,
    capacities: { ...initial.countries.FRA.capacities, economy: { maximum: 10, committed: 13 } },
  } } };
  const result = advanceWorld(state, '2000-02-01');
  assert.equal(result.audit.ok, true);
  assert.ok(result.resolution.phasesCompleted.includes('operational-capacities'));
  assert.ok(result.state.countries.FRA.capacities.economy.overloadMonths! > 0);
});
