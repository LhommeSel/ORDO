import assert from 'node:assert/strict';
import test from 'node:test';
import { createAIJobAIRequest, parseAIJobAIRequest, type AIJobAIResponse } from './job-contracts';
import { advisorAnswerGroundingIssues } from './contracts';
import { compileContextForAIJob, selectSupplementalFacts } from '../simulation/ai/context';
import { executeAIJob } from '../simulation/ai/executor';
import { createFrance2000World } from '../simulation/scenario-2000';
import { createAdministrativeEnergyOffer, startEnergyNegotiationAI } from '../simulation/energy-negotiation';
import type { GeneralAIJob } from '../simulation/types';

test('le pipeline IA compile un contexte visible, valide le contrat et conserve une réponse sans effet libre', async () => {
  const initial = createFrance2000World();
  const longIntent = `Négocier un contrat gazier de long terme avec l’Algérie.\n${'Clause détaillée à examiner avec prudence. '.repeat(450)}`;
  const draft = createAdministrativeEnergyOffer(initial, 'DZA', 'gas');
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const started = startEnergyNegotiationAI(initial, draft.offer);
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const baseJob = started.state.aiJobs[started.jobId] as GeneralAIJob;
  const job: GeneralAIJob = { ...baseJob, budgetTier: 'economy', inputText: longIntent };
  const world = { ...started.state, aiJobs: { ...started.state.aiJobs, [job.id]: job } };
  const context = compileContextForAIJob(world, job);
  const visible = [...context.knownFacts, ...context.privateDecisionFacts];
  assert.ok(context.knownFacts.some((item) => item.id === 'country:FRA:strategy'));
  assert.ok(context.knownFacts.some((item) => item.id === 'country:DZA:energy'));
  assert.ok(!context.knownFacts.some((item) => item.id === 'country:DZA:strategy'));
  assert.ok(context.privateDecisionFacts.some((item) => item.id === 'country:DZA:strategy'));
  assert.ok(!visible.some((item) => item.domain === 'military'));
  assert.ok(context.approximateInputTokens <= context.query.tokenBudget);
  assert.equal(context.query.tokenBudget, 10_000, 'une commande proche de 5 000 jetons doit élargir automatiquement le budget');

  const request = createAIJobAIRequest(job, context, 'session-ordo-123456');
  assert.equal(parseAIJobAIRequest(request)?.job.kind, 'diplomacy');
  assert.equal(parseAIJobAIRequest(request)?.job.playerIntent, longIntent);
  const supplement = selectSupplementalFacts(context, [{ concepts: ['military.armament'], entityIds: ['FRA'], reason: 'Une garantie militaire est finalement envisagée.' }], 1_200);
  assert.ok(supplement.knownFacts.some((item) => item.domain === 'military'));

  const successful: AIJobAIResponse = {
    ok: true,
    answer: {
      headline: 'Un accord gazier progressif est plausible',
      assessment: 'Alger peut accepter un engagement stable si Paris respecte ses capacités exportatrices.',
      publicMessage: 'L’Algérie est disposée à ouvrir une négociation sur un accord gazier durable.',
      proposals: [{
        label: 'Mandat exploratoire',
        action: 'Ouvrir une négociation sur un volume soutenable et une durée standard.',
        rationale: 'La proposition reste compatible avec les données physiques disponibles.',
        likelyReactions: ['DZA demandera de la visibilité sur la durée.'],
        uncertainties: ['La capacité de transit doit être confirmée.'],
        effectHints: [{ kind: 'relation_shift', targetIds: ['FRA', 'DZA'], magnitude: 'minor', direction: 'positive', reason: 'L’ouverture du dialogue crée un signal favorable.' }],
      }],
      requestedFacts: ['Capacité ferme de transit vers la France'],
      powerStrugglePlan: null,
      diplomaticMove: {
        kind: 'counter', annualVolume: draft.offer.annualVolume * 0.9,
        durationYears: 15, pricePosture: 'supplier_premium', clauses: ['infrastructure_investment'],
      },
    },
    usage: {
      model: 'gpt-5.6-luna', inputTokens: 800, cachedInputTokens: 0, outputTokens: 180,
      estimatedCostUsd: 0.000376, latencyMs: 1_200, remainingSessionRequestsToday: 19,
    },
  };
  const fakeFetch = (async () => new Response(JSON.stringify(successful), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  const result = await executeAIJob(world, job.id, 'session-ordo-123456', fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.state.aiJobs[job.id].status, 'resolved');
  assert.equal(result.state.aiJobs[job.id].outcome?.headline, successful.answer.headline);
  assert.equal(result.state.diplomaticSessions[draft.offer.id].status, 'countered');
  assert.equal(result.state.diplomaticSessions[draft.offer.id].turns.length, 2);
  assert.match(result.state.diplomaticSessions[draft.offer.id].terms.priceSummary, /prime de sécurité/);
  assert.equal(result.state.relations['FRA:DZA'], undefined, 'un effectHint ne doit jamais modifier directement le monde');
});

test('une intention d’action IA doit cibler un acteur effectivement transmis', () => {
  const issues = advisorAnswerGroundingIssues({
    options: [{ factIds: ['fact-1'], actionIntent: { kind: 'energy_contract', targetCountryId: 'DZA', resource: 'gas', objective: 'Diversifier' } }],
    claims: [],
  }, new Set(['fact-1']), new Set(['FRA', 'DEU']));
  assert.deepEqual(issues, ['option0.actionIntent.acteur absent du contexte']);
});
