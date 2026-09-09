import { mkdir, writeFile } from 'node:fs/promises';

import { createWorldPulseRequest, applyWorldPulseAnswer } from '../lib/simulation/ai/world-pulse';
import { launchCommonAction, prepareCommonAction } from '../lib/simulation/action-programs';
import { advanceWorld } from '../lib/simulation/engine';
import { createFrance2000World } from '../lib/simulation/scenario-2000';
import type { WorldPulseResponse } from '../lib/ai/world-pulse-contracts';

const origin = process.env.ORDO_TEST_ORIGIN ?? 'http://localhost:3000';
const sessionId = `world-pulse-quality-${Date.now()}`;

const turns = [
  'Ouvrir une coopération technologique avec l’Allemagne.',
  'Proposer une coopération technologique avec le Japon.',
  'Négocier une alliance défensive avec l’Italie.',
  'Lancer un programme industriel de semi-conducteurs.',
  'Renforcer la coopération militaire avec le Royaume-Uni.',
  'Lancer une opération de renseignement sur la Russie.',
];
const selectedTurns = turns.slice(0, Math.max(1, Math.min(
  turns.length,
  Number.parseInt(process.env.ORDO_TEST_LIMIT ?? String(turns.length), 10) || turns.length,
)));

let state = createFrance2000World();
const results: unknown[] = [];

for (const [index, intent] of selectedTurns.entries()) {
  const prepared = prepareCommonAction(state, intent);
  let action: Record<string, unknown> = { intent, prepared: prepared.ok, warnings: prepared.ok ? prepared.warnings : [], error: prepared.ok ? undefined : prepared.error };
  if (prepared.ok) {
    const launched = launchCommonAction(state, prepared.action);
    action = { ...action, launched: launched.ok, programId: launched.ok ? launched.programId : undefined, error: launched.ok ? undefined : launched.error };
    if (launched.ok) state = launched.state;
  }

  const previousDate = state.currentDate;
  const actionStartIndex = state.actions.map((entry) => entry.kind).lastIndexOf('time_advance') + 1;
  const local = advanceWorld(state, new Date(new Date(`${state.currentDate}T12:00:00Z`).setUTCMonth(new Date(`${state.currentDate}T12:00:00Z`).getUTCMonth() + 1)).toISOString().slice(0, 10) as typeof state.currentDate);
  state = local.state;
  const request = createWorldPulseRequest(state, actionStartIndex, local.elapsedMonths, sessionId);
  const startedAt = performance.now();
  const response = await fetch(`${origin}/api/ai/world-pulse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'cf-connecting-ip': `ordo-world-pulse-quality-${index + 1}`,
    },
    body: JSON.stringify(request),
  });
  const payload = await response.json() as WorldPulseResponse;
  let applied = { createdDossiers: [] as string[], updatedDossiers: [] as string[], relationChanges: 0, playerDecisions: 0 };
  if (payload.ok) {
    for (const item of request.pulses) {
      const itemResult = payload.results.find((candidate) => candidate.id === item.id);
      if (!itemResult?.ok) continue;
      const change = applyWorldPulseAnswer(state, item, itemResult.answer);
      state = change.state;
      applied = {
        createdDossiers: [...applied.createdDossiers, ...change.createdDossierIds],
        updatedDossiers: [...applied.updatedDossiers, ...change.updatedDossierIds],
        relationChanges: applied.relationChanges + change.relationChanges,
        playerDecisions: applied.playerDecisions + change.playerDecisions,
      };
    }
  }
  const durationMs = Math.round(performance.now() - startedAt);
  results.push({
    turn: index + 1,
    previousDate,
    reachedDate: local.reachedDate,
    action,
    local: { reviewedCountryIds: local.reviewedCountryIds, manifestations: local.manifestations },
    httpStatus: response.status,
    durationMs,
    request: request.pulses.map((item) => ({
      kind: item.kind,
      recentPlayerActions: item.context.recentPlayerActions,
      factCount: item.context.facts.length,
      omittedFactCount: item.context.omittedFactCount,
      approximateInputTokens: item.context.approximateInputTokens,
    })),
    response: payload,
    applied,
  });
  console.log(`${index + 1}/${selectedTurns.length} status=${response.status} durationMs=${durationMs} date=${state.currentDate}`);
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-world-pulse-test-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify({ sessionId, results, final: { date: state.currentDate, dossierCount: Object.keys(state.strategicDossiers).length, actionCount: state.actions.length } }, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
