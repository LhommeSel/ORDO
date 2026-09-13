import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrance2000World } from './scenario-2000';
import { createIntelligenceServices2000, intelligenceAgencyName, registerIntelligenceMission, syncIntelligenceMissions } from './intelligence-services';
import { answerAdvisorQuestion } from './advisor';
import { prepareCommonAction, launchCommonAction } from './action-programs';

test('le référentiel France respecte la chronologie DST → DGSI', () => {
  const world = createFrance2000World();
  const france = world.intelligenceServices?.FRA;
  assert.ok(france);
  assert.equal(france.agencies.dst.name, 'DST');
  assert.equal(intelligenceAgencyName(france.agencies.dst, '2013-12-31'), 'DST');
  assert.equal(intelligenceAgencyName(france.agencies.dst, '2014-05-12'), 'DGSI');
  assert.equal(france.agencies.dgse.name, 'DGSE');
  assert.equal(france.agencies.dgse.coverage.Maghreb, 'profonde');
});

test('les autres pays reçoivent un socle générique sans inventaire hypertrophié', () => {
  const world = createFrance2000World();
  const services = createIntelligenceServices2000(world.countries);
  assert.equal(Object.keys(services).length, Object.keys(world.countries).length);
  assert.ok(Object.values(services).every((service) => Object.keys(service.agencies).length === 2));
});

test('une mission suit le statut du programme moteur', () => {
  const world = createFrance2000World();
  const program = {
    id: 'program-intelligence-test', category: 'intelligence' as const, actorId: 'FRA', targetIds: ['DEU'],
    title: 'Surveillance ciblée avec Allemagne', intent: 'Évaluer les intentions de l’Allemagne', startedAt: '2000-01-01' as const,
    expectedCompletionAt: '2000-04-01' as const, durationMonths: 3, progressMonths: 0, status: 'active' as const,
    requiredCapacities: [{ domain: 'intelligence' as const, commitment: 3 }], budgetCost: 1, successProbability: 70, risks: [],
    successEffects: [], partialEffects: [],
  };
  const withMission = registerIntelligenceMission({ ...world, actionPrograms: { [program.id]: program } }, program, 'surveillance', 'Évaluer les intentions de l’Allemagne', 'dgse');
  assert.equal(Object.keys(withMission.intelligenceServices?.FRA?.missions ?? {}).length, 1);
  const resolved = { ...withMission, actionPrograms: { [program.id]: { ...program, status: 'succeeded' as const } } };
  assert.equal(Object.values(syncIntelligenceMissions(resolved).intelligenceServices?.FRA?.missions ?? {})[0]?.status, 'completed');
});

test('le conseiller reçoit les capacités de renseignement pour une question dédiée', () => {
  const answer = answerAdvisorQuestion(createFrance2000World(), 'Quelles sont les capacités de renseignement et de surveillance de la France ?', { questionKind: 'fact' });
  assert.ok(answer.facts.some((fact) => fact.id === 'player-intelligence-capacity'));
  assert.ok(answer.facts.some((fact) => fact.id === 'player-intelligence-coverage'));
});

test('une mission intérieure DGSI/DST peut être préparée sans cible étrangère', () => {
  const world = createFrance2000World();
  const prepared = prepareCommonAction(world, 'Renseignement surveillance sur France : prévenir les réseaux terroristes', { category: 'intelligence' });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(prepared.action.targetIds, ['FRA']);
  const launched = launchCommonAction(world, prepared.action);
  assert.equal(launched.ok, true);
  if (launched.ok) assert.ok(Object.values(launched.state.actionPrograms).some((program) => program.category === 'intelligence'));
});
