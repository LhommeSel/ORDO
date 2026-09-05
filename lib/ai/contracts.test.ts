import assert from 'node:assert/strict';
import test from 'node:test';
import { createAIJobAIRequest, parseAIJobAIRequest, type AIJobAIResponse } from './job-contracts';
import { compileContextForAIJob } from '../simulation/ai/context';
import { executeAIJob } from '../simulation/ai/executor';
import { createFrance2000World } from '../simulation/scenario-2000';
import type { GeneralAIJob } from '../simulation/types';

test('le pipeline IA compile un contexte visible, valide le contrat et conserve une réponse sans effet libre', async () => {
  const initial = createFrance2000World();
  const job: GeneralAIJob = {
    id: 'diplomacy:test-algeria-gas',
    kind: 'diplomacy',
    schemaVersion: 1,
    priority: 'normal',
    budgetTier: 'economy',
    status: 'pending',
    requestedAt: initial.currentDate,
    attempts: 0,
    purpose: 'Négocier un contrat gazier avec DZA',
    actorId: 'FRA',
    reasons: ['Diversifier les approvisionnements français.'],
    context: { targetCountryId: 'DZA', resource: 'gas' },
  };
  const world = { ...initial, aiJobs: { ...initial.aiJobs, [job.id]: job } };
  const context = compileContextForAIJob(world, job);
  assert.ok(context.facts.some((item) => item.id === 'country:FRA:strategy'));
  assert.ok(context.facts.some((item) => item.id === 'country:DZA:energy'));
  assert.ok(!context.facts.some((item) => item.id === 'country:DEU:strategy'));
  assert.ok(context.approximateInputTokens <= context.query.tokenBudget);

  const request = createAIJobAIRequest(job, context, 'session-ordo-123456');
  assert.equal(parseAIJobAIRequest(request)?.job.kind, 'diplomacy');

  const successful: AIJobAIResponse = {
    ok: true,
    answer: {
      headline: 'Un accord gazier progressif est plausible',
      assessment: 'Alger peut accepter un engagement stable si Paris respecte ses capacités exportatrices.',
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
    },
    usage: { model: 'gpt-5.6-luna', inputTokens: 800, outputTokens: 180, estimatedCostUsd: 0.000376, remainingSessionRequestsToday: 19 },
  };
  const fakeFetch = (async () => new Response(JSON.stringify(successful), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  const result = await executeAIJob(world, job.id, 'session-ordo-123456', fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.state.aiJobs[job.id].status, 'resolved');
  assert.equal(result.state.aiJobs[job.id].outcome?.headline, successful.answer.headline);
  assert.equal(result.state.relations['FRA:DZA'], undefined, 'un effectHint ne doit jamais modifier directement le monde');
});
