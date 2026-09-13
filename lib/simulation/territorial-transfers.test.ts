import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrance2000World } from './scenario-2000';
import { transferTerritory } from './territorial-transfers';

test('une cession déplace les comptes, une occupation ne les déplace pas', () => {
  const initial = createFrance2000World();
  const territory = Object.values(initial.territorial.territories).find((item) => item.sovereignCountryId === 'FRA' && item.kind === 'region' && (item.realGdpBillion2000Usd ?? 0) > 0)!;
  const initialFranceGdp = initial.macroEconomies.FRA.realGdpBillion2000Usd;
  const initialItalyGdp = initial.macroEconomies.ITA.realGdpBillion2000Usd;
  const occupied = transferTerritory(initial, territory.id, 'ITA', 'occupation');
  assert.equal(occupied.ok, true);
  assert.equal(occupied.state.territorial.territories[territory.id].sovereignCountryId, 'FRA');
  assert.equal(occupied.state.territorial.territories[territory.id].controllerEntityId, 'ITA');
  assert.equal(occupied.state.macroEconomies.FRA.realGdpBillion2000Usd, initialFranceGdp);
  const ceded = transferTerritory(initial, territory.id, 'ITA', 'cession');
  assert.equal(ceded.ok, true);
  assert.equal(ceded.state.territorial.territories[territory.id].sovereignCountryId, 'ITA');
  assert.ok(ceded.state.macroEconomies.FRA.realGdpBillion2000Usd < initialFranceGdp);
  assert.ok(ceded.state.macroEconomies.ITA.realGdpBillion2000Usd > initialItalyGdp);
});
