import assert from 'node:assert/strict';
import test from 'node:test';

import { compileContextForAIJob } from './ai/context';
import { createWorld2000 } from './scenario-2000';
import { deriveDiplomaticFeasibility, enforceDiplomaticMove } from './diplomatic-feasibility';
import { evaluateHistoricalChronology } from './historical-chronology';
import { applyDiplomaticDialogueAIAnswer, openDiplomaticDialogue, requestDiplomaticDialogueAI } from './diplomacy-dialogue';
import type { AIGenericDiplomaticMove } from '../ai/job-contracts';
import type { GeneralAIJob } from './types';

const acceptedMove: AIGenericDiplomaticMove = {
  scope: 'general_dialogue', kind: 'accept', agreementType: 'mediation',
  position: 'Nous acceptons.', concessions: [], guaranteesRequested: [], conditions: [], redLines: [], timeline: 'Immédiat',
};

function diplomacyJob(inputText: string, requestingCountryId: string, respondingCountryId: string, participantIds: string[]): GeneralAIJob {
  return {
    id: `test-diplomacy-${respondingCountryId}`,
    kind: 'diplomacy', schemaVersion: 1, priority: 'normal', budgetTier: 'standard', status: 'pending', requestedAt: '2000-01-01', attempts: 0,
    inputText, purpose: 'Tester la cohérence diplomatique', actorId: requestingCountryId,
    reasons: ['Test des lignes rouges et du contrôle chronologique.'],
    context: { respondingCountryId, participantIds, playerIntent: inputText },
  };
}

test('refuse une acceptation anachronique Russie–Ukraine en 2000', () => {
  const state = createWorld2000('FRA');
  const feasibility = deriveDiplomaticFeasibility(state, 'RUS', ['UKR'], 'Proposer un cessez-le-feu mutuel immédiat entre la Russie et l’Ukraine.');
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'chronology.no-active-conflict'));
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'chronology.rus-ukr-pre-2014'));
  const constrained = enforceDiplomaticMove(state, 'RUS', ['UKR'], 'Proposer un cessez-le-feu mutuel immédiat entre la Russie et l’Ukraine.', acceptedMove, 'Nous acceptons le cessez-le-feu.');
  assert.equal(constrained.overridden, true);
  assert.equal(constrained.move.kind, 'counter');
  assert.match(constrained.publicMessage, /contre-proposition/i);
  assert.match(constrained.move.conditions.join(' '), /préventif|sécurité|anachronique/i);
});

test('bloque une alliance stratégique trilatérale de containment contre la Chine', () => {
  const state = createWorld2000('FRA');
  const text = 'Proposer une coopération stratégique et une alliance militaire USA-France-Chine pour contenir la Chine.';
  const feasibility = deriveDiplomaticFeasibility(state, 'CHN', ['USA', 'FRA'], text);
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'red-line:chn-anti-coalition'));
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'red-line:chn-trilateral-containment'));
  const constrained = enforceDiplomaticMove(state, 'CHN', ['USA', 'FRA'], text, acceptedMove, 'La Chine accepte.');
  assert.equal(constrained.move.kind, 'counter');
  assert.match(constrained.move.redLines.join(' '), /coalition|trilatérale|containment/i);
});

test('ne bloque pas une formulation qui protège explicitement la ligne rouge', () => {
  const state = createWorld2000('FRA');
  const feasibility = deriveDiplomaticFeasibility(state, 'RUS', ['FRA'], 'Nous refusons l’extension de l’OTAN et voulons prévenir toute occupation.');
  assert.equal(feasibility.matchedRules.some((item) => item.id === 'rus-post-soviet-space'), false);
  assert.equal(feasibility.blockingIssues.length, 0);
});

test('injecte les garde-fous privés dans le contexte diplomatique sans les rendre publics', () => {
  const state = createWorld2000('FRA');
  const job = diplomacyJob('Proposer un cessez-le-feu mutuel avec l’Ukraine.', 'FRA', 'RUS', ['FRA', 'RUS', 'UKR']);
  const packet = compileContextForAIJob(state, job);
  const guardrail = packet.privateDecisionFacts.find((item) => item.id.startsWith('diplomacy:guardrails:RUS:'));
  assert.ok(guardrail);
  assert.match(guardrail.statement, /chronologie|conflit actif|BLOQUANT/i);
  assert.equal(packet.knownFacts.some((item) => item.id === guardrail?.id), false);
});

test('applique le garde-fou au moment de résoudre un dialogue, même si le modèle accepte', () => {
  const opened = openDiplomaticDialogue(createWorld2000('FRA'), ['RUS'], 'Proposer un cessez-le-feu mutuel avec la Russie.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Accord', assessment: 'La Russie accepte.', publicMessage: 'Nous acceptons le cessez-le-feu.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, acceptedMove);
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  assert.equal(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.kind, 'counter');
  assert.match(answered.state.diplomaticDialogues[opened.dialogueId].turns.at(-1)?.publicMessage ?? '', /contre-proposition/i);
  assert.ok(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.rejectedTerms?.length);
  assert.ok(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.conditionalTerms?.length);
  assert.equal(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.decisionScope, 'principle');
});

test('registre chronologique : une invasion de l’Irak avant 2003 devient une prévention', () => {
  const findings = evaluateHistoricalChronology('2000-01-01', 'Préparer une intervention en Irak avec les États-Unis.', ['USA', 'IRQ']);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.id, 'chronology.iraq-invasion-pre-2003');
});

test('le registre chronologique ne confond pas une prévention avec un fait déjà réalisé', () => {
  const findings = evaluateHistoricalChronology('2000-01-01', 'Prévenir une intervention en Irak et éviter une invasion.', ['USA', 'IRQ']);
  assert.equal(findings.length, 0);
});

test('cinq scénarios diplomatiques restent différenciés par leurs lignes rouges et leur calendrier', () => {
  const state = createWorld2000('FRA');
  const scenarios = [
    {
      name: 'Russie–Ukraine', actorId: 'RUS', participants: ['UKR'],
      text: 'Signer un cessez-le-feu mutuel immédiat.', expected: 'counter',
    },
    {
      name: 'Chine–États-Unis–France', actorId: 'CHN', participants: ['USA', 'FRA'],
      text: 'Former une alliance militaire USA-France-Chine pour contenir la Chine.', expected: 'counter',
    },
    {
      name: 'Gaz Grèce–Turquie', actorId: 'TUR', participants: ['GRC'],
      text: 'Exploiter le gaz en mer Égée ; les zones disputées restent contestées et chaque partie garde ses droits.', expected: 'accept',
    },
    {
      name: 'Vente d’armes à l’Inde', actorId: 'IND', participants: ['FRA'],
      text: 'Acheter des avions français avec formation et maintenance locale.', expected: 'accept',
    },
    {
      name: 'Dette allemande', actorId: 'DEU', participants: ['FRA'],
      text: 'Accepter une mutualisation durable des dettes sans discipline commune.', expected: 'counter',
    },
  ];
  const results = scenarios.map((scenario) => {
    const feasibility = deriveDiplomaticFeasibility(state, scenario.actorId, scenario.participants, scenario.text);
    const constrained = enforceDiplomaticMove(state, scenario.actorId, scenario.participants, scenario.text, acceptedMove, 'Nous acceptons cette proposition.');
    return { scenario, feasibility, constrained };
  });
  assert.deepEqual(results.map(({ constrained }) => constrained.move.kind), ['counter', 'counter', 'accept', 'accept', 'counter']);
  assert.equal(results[0]?.feasibility.blockingIssues.some((item) => item.id === 'chronology.no-active-conflict'), true);
  assert.equal(results[1]?.feasibility.blockingIssues.some((item) => item.id === 'red-line:chn-trilateral-containment'), true);
  assert.equal(results[2]?.feasibility.issues.length, 0);
  assert.equal(results[3]?.feasibility.issues.length, 0);
  assert.equal(results[4]?.feasibility.blockingIssues.some((item) => item.id === 'red-line:deu-debt-mutualization'), true);
  assert.ok(results[0]?.constrained.move.rejectedTerms?.length);
  assert.ok(results[4]?.constrained.move.conditionalTerms?.length);
});
