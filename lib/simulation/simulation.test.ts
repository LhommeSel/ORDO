import assert from 'node:assert/strict';
import test from 'node:test';

import { answerAdvisorQuestion, assessStrategicPlan } from './advisor';
import { energyBalance, nodeAvailableExport, proposeEnergyContract } from './energy';
import {
  acceptEnergyOffer, adjustEnergyOffer, createAdministrativeEnergyOffer, sendEnergyOffer,
} from './energy-negotiation';
import { advanceWorld, replayWorld } from './engine';
import { deserializeWorld, serializeWorld } from './persistence';
import { evaluatePoliticalPathway } from './politics';
import { createFrance2000World } from './scenario-2000';
import { interpretPlayerIntent, rankEnergySuppliers } from './intent';

test('le scénario 2000 charge un monde cohérent et jouable', () => {
  const state = createFrance2000World();
  assert.equal(state.currentDate, '2000-01-01');
  assert.equal(state.playerCountryId, 'FRA');
  assert.ok(Object.keys(state.countries).length >= 10);
  assert.ok(Object.keys(state.historicalCurrents).length >= 3);
  assert.ok(Object.keys(state.armamentProducts).length >= 6);
});

test('un contrat énergétique ne peut pas dépasser la capacité physique restante', () => {
  const state = createFrance2000World();
  const nodeId = 'nor-oil';
  const available = nodeAvailableExport(state, nodeId);
  const result = proposeEnergyContract(state, {
    id: 'impossible-contract', nodeId, buyerId: 'FRA', annualVolume: available + 1,
    startDate: state.currentDate, endDate: '2005-01-01', priceFormula: 'Brent', route: 'Mer du Nord',
  });
  assert.equal(result.ok, false);
  assert.equal(result.state.actions.length, 0);
});

test('une demande simple produit une proposition gazière administrativement réaliste', () => {
  const state = createFrance2000World();
  const result = createAdministrativeEnergyOffer(state, 'DZA', 'gas');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.offer.diplomaticEffort, 'faible');
  assert.equal(result.offer.durationYears, 12);
  assert.ok(result.offer.coverageShare > 0 && result.offer.coverageShare <= 20);
  assert.ok(result.offer.annualVolume <= nodeAvailableExport(state, result.offer.nodeId));
});

test('une négociation acceptée devient un contrat physique actif', () => {
  const initial = createFrance2000World();
  const draft = createAdministrativeEnergyOffer(initial, 'DZA', 'gas');
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const sent = sendEnergyOffer(initial, draft.offer);
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  assert.equal(sent.response.status, 'accepted');
  const signed = acceptEnergyOffer(sent.state, sent.response.offer);
  assert.equal(signed.ok, true);
  if (!signed.ok) return;
  assert.equal(signed.state.energyContracts[signed.contractId].status, 'active');
  assert.ok(signed.state.actions.some((action) => action.origin === 'player' && action.intent.includes(signed.contractId)));
  assert.ok((energyBalance(signed.state, 'FRA', 'gas')?.imports ?? 0) > (energyBalance(initial, 'FRA', 'gas')?.imports ?? 0));
});

test('durcir une offre reste facultatif et provoque une vraie contre-réaction', () => {
  const initial = createFrance2000World();
  const draft = createAdministrativeEnergyOffer(initial, 'DZA', 'gas');
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const volume = adjustEnergyOffer(initial, draft.offer, 'more_volume');
  const price = adjustEnergyOffer(initial, volume, 'better_price');
  assert.equal(price.diplomaticEffort, 'modérée');
  const sent = sendEnergyOffer(initial, price);
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  assert.ok(['countered', 'refused'].includes(sent.response.status));
});

test('une rupture idéologique est un chemin politique coûteux, pas une action gratuite', () => {
  const state = createFrance2000World();
  const pathway = evaluatePoliticalPathway(state, 'FRA', {
    requiredAuthority: 'constitutional', doctrine: { economic: 0, sovereignty: 95 },
    publicSalience: 95, administrativeComplexity: 90,
  });
  assert.ok(['blocked', 'rupture'].includes(pathway.status));
  assert.ok(pathway.obstacles.length >= 2);
  assert.ok(pathway.routes.length >= 1);
});

test('la cadence autonome dépend du calendrier, pas du nombre de clics', () => {
  const initialA = createFrance2000World();
  const oneJump = advanceWorld(initialA, '2000-04-01').state;

  let monthly = createFrance2000World();
  monthly = advanceWorld(monthly, '2000-02-01').state;
  monthly = advanceWorld(monthly, '2000-03-01').state;
  monthly = advanceWorld(monthly, '2000-04-01').state;

  const nonPlayerReviews = (state: typeof monthly) => state.actions.filter((action) =>
    action.intent === 'Révision périodique de la stratégie nationale' && action.actorId !== state.playerCountryId,
  ).map((action) => `${action.createdAt}:${action.actorId}`);
  assert.deepEqual(nonPlayerReviews(oneJump), nonPlayerReviews(monthly));
});

test('le monde agit sans attendre le joueur', () => {
  const result = advanceWorld(createFrance2000World(), '2001-01-01');
  const autonomousActors = new Set(result.state.actions
    .filter((action) => action.intent === 'Révision périodique de la stratégie nationale')
    .map((action) => action.actorId));
  assert.ok(autonomousActors.size >= 4);
  assert.ok(!autonomousActors.has('FRA'));
});

test('le conseiller local produit des options situées et auditables', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Que pouvons-nous proposer à l’Allemagne avant le prochain conseil ?', { focusCountryId: 'DEU' });
  assert.equal(answer.mode, 'options');
  assert.equal(answer.generatedBy, 'local_rules');
  assert.ok(answer.plans.length >= 2);
  const diplomatic = answer.plans.find((plan) => plan.id.startsWith('plan-diplomacy-'))!;
  assert.ok(diplomatic);
  assert.ok(diplomatic.measures.length >= 3);
  assert.ok(diplomatic.factsUsed.some((fact) => fact.includes('Relation')));
  assert.ok(assessStrategicPlan(state, diplomatic).capabilityPressure.length >= 1);
});

test('une demande libre identifie le pays et la ressource sans sélecteur', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Je veux négocier un contrat gazier de long terme avec l’Algérie.');
  assert.equal(answer.interpretation.kind, 'energy_contract');
  assert.equal(answer.interpretation.resource, 'gas');
  assert.equal(answer.interpretation.targetId, 'DZA');
  assert.equal(answer.plans.length, 1);
  assert.equal(answer.plans[0].execution?.supplierId, 'DZA');
});

test('sans partenaire imposé, le moteur classe plusieurs fournisseurs réels', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Je veux sécuriser un contrat gazier de long terme.');
  const ranked = rankEnergySuppliers(state, 'gas');
  assert.equal(answer.interpretation.targetStatus, 'unspecified');
  assert.ok(answer.plans.length >= 2);
  assert.equal(answer.plans[0].execution?.supplierId, ranked[0].countryId);
  assert.equal(new Set(answer.plans.map((plan) => plan.execution?.supplierId)).size, answer.plans.length);
});

test('un pays absent est identifié sans inventer de capacité', () => {
  const state = createFrance2000World();
  const intent = interpretPlayerIntent(state, 'Négocier un contrat gazier avec le Kazakhstan.');
  const answer = answerAdvisorQuestion(state, 'Négocier un contrat gazier avec le Kazakhstan.');
  assert.equal(intent.targetLabel, 'Kazakhstan');
  assert.equal(intent.targetStatus, 'unmodeled');
  assert.equal(answer.plans.length, 0);
  assert.ok(answer.synthesis.includes('ne fabrique donc pas'));
});

test('la sauvegarde et le registre permettent de reconstruire exactement un état', () => {
  const initial = createFrance2000World();
  const advanced = advanceWorld(initial, '2000-03-01').state;
  const restored = deserializeWorld(serializeWorld(advanced));
  assert.deepEqual(restored, advanced);

  const replayed = replayWorld(createFrance2000World(), advanced.actions);
  assert.deepEqual(replayed, advanced);
});
