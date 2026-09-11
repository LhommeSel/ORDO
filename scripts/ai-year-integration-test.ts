import { mkdir, writeFile } from 'node:fs/promises';

import { createAdvisorAIRequest } from '../lib/ai/contracts';
import { answerAdvisorQuestion } from '../lib/simulation/advisor';
import { createWorldPulseRequest, applyWorldPulseAnswer } from '../lib/simulation/ai/world-pulse';
import { launchCommonAction, prepareCommonAction } from '../lib/simulation/action-programs';
import { advanceWorld } from '../lib/simulation/engine';
import { openDiplomaticDialogue, requestDiplomaticDialogueAI, sendDiplomaticDialogueMessage, resolveDiplomaticDialogueResponse } from '../lib/simulation/diplomacy-dialogue';
import { executeAIJob } from '../lib/simulation/ai/executor';
import { createFrance2000World } from '../lib/simulation/scenario-2000';
import type { WorldPulseResponse } from '../lib/ai/world-pulse-contracts';
import type { AdvisorAIResponse } from '../lib/ai/contracts';

const origin = process.env.ORDO_TEST_ORIGIN ?? 'https://ordo-geopolitique.lhommesel.chatgpt.site';
const sessionId = `ai-year-integration-${Date.now()}`;
const monthlyIntents = [
  'Ouvrir une coopération technologique avec l’Allemagne.',
  'Lancer un programme industriel de semi-conducteurs.',
  'Renforcer la coopération militaire avec le Royaume-Uni.',
  'Proposer une coopération technologique avec le Japon.',
  'Lancer une opération de renseignement sur la Russie.',
  'Négocier une alliance défensive avec l’Italie.',
];

const nextMonth = (date: string) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10) as `${number}-${number}-${number}`;
};

const requestToOrigin = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = typeof input === 'string' && input.startsWith('/') ? input : String(input);
  const headers = new Headers(init.headers);
  headers.set('Origin', origin);
  headers.set('cf-connecting-ip', `ordo-year-integration-${sessionId}`);
  return fetch(path.startsWith('/') ? `${origin}${path}` : path, { ...init, headers });
};

let state = createFrance2000World();
const pulses: unknown[] = [];

for (let month = 0; month < 12; month += 1) {
  const intent = monthlyIntents[month % monthlyIntents.length];
  const prepared = prepareCommonAction(state, intent);
  let action: Record<string, unknown> = { intent, prepared: prepared.ok };
  if (prepared.ok) {
    const launched = launchCommonAction(state, { ...prepared.action, successProbability: 100 });
    action = { ...action, launched: launched.ok, programId: launched.ok ? launched.programId : undefined, error: launched.ok ? undefined : launched.error };
    if (launched.ok) state = launched.state;
  } else action = { ...action, error: prepared.error };

  const previousDate = state.currentDate;
  const actionStartIndex = state.actions.map((entry) => entry.kind).lastIndexOf('time_advance') + 1;
  const local = advanceWorld(state, nextMonth(state.currentDate));
  state = local.state;
  const request = createWorldPulseRequest(state, actionStartIndex, local.elapsedMonths, sessionId);
  const started = performance.now();
  const response = await requestToOrigin('/api/ai/world-pulse', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  });
  const payload = await response.json() as WorldPulseResponse;
  const applied = { createdDossiers: [] as string[], updatedDossiers: [] as string[], relationChanges: 0, playerDecisions: 0, queuedPrograms: 0 };
  if (payload.ok) {
    for (const item of request.pulses) {
      const result = payload.results.find((candidate) => candidate.id === item.id);
      if (!result?.ok) continue;
      const change = applyWorldPulseAnswer(state, item, result.answer);
      state = change.state;
      applied.createdDossiers.push(...change.createdDossierIds);
      applied.updatedDossiers.push(...change.updatedDossierIds);
      applied.relationChanges += change.relationChanges;
      applied.playerDecisions += change.playerDecisions;
      applied.queuedPrograms += change.queuedAutonomousPrograms;
    }
  }
  pulses.push({
    month: month + 1, previousDate, reachedDate: local.reachedDate, action,
    httpStatus: response.status, latencyMs: Math.round(performance.now() - started),
    local: { reviewedCountryIds: local.reviewedCountryIds, manifestations: local.manifestations },
    request: request.pulses.map((item) => ({
      id: item.id, kind: item.kind, factCount: item.context.facts.length,
      omittedFactCount: item.context.omittedFactCount, approximateInputTokens: item.context.approximateInputTokens,
      recentPlayerActions: item.context.recentPlayerActions,
    })),
    response: payload,
    applied,
  });
  console.log(`pulse ${month + 1}/12 status=${response.status} latencyMs=${Math.round(performance.now() - started)} date=${state.currentDate}`);
}

const advisorQuestion = 'La France doit-elle prioriser une coopération industrielle avec l’Allemagne ou renforcer son autonomie énergétique en 2001 ? Compare les effets sur le PIB, la dette, l’industrie, les stocks et les relations européennes.';
const localAdvisor = answerAdvisorQuestion(state, advisorQuestion);
const advisorRequest = createAdvisorAIRequest(state, advisorQuestion, localAdvisor, sessionId);
const advisorStarted = performance.now();
const advisorHttp = await requestToOrigin('/api/ai/advisor', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(advisorRequest),
});
const advisorPayload = await advisorHttp.json() as AdvisorAIResponse;
const advisor = { httpStatus: advisorHttp.status, latencyMs: Math.round(performance.now() - advisorStarted), local: { questionKind: localAdvisor.questionKind, dimensions: localAdvisor.dimensions, factCount: localAdvisor.facts.length }, response: advisorPayload };
console.log(`advisor status=${advisorHttp.status} latencyMs=${advisor.latencyMs}`);

let dialogueResult: Record<string, unknown>;
const opened = openDiplomaticDialogue(state, ['DEU'], 'La France souhaite discuter d’une coopération industrielle européenne et des garanties nécessaires pour préserver l’autonomie de chaque partenaire.');
if (!opened.ok) {
  dialogueResult = { ok: false, stage: 'open', error: opened.error };
} else {
  state = opened.state;
  const sent = sendDiplomaticDialogueMessage(state, opened.dialogueId, 'Nous proposons de préciser les secteurs concernés, les garanties politiques et les conditions de réciprocité.');
  if (!sent.ok) dialogueResult = { ok: false, stage: 'send', error: sent.error };
  else {
    state = sent.state;
    const queued = requestDiplomaticDialogueAI(state, opened.dialogueId);
    if (!queued.ok) dialogueResult = { ok: false, stage: 'queue', error: queued.error };
    else {
      state = queued.state;
      const started = performance.now();
      const executed = await executeAIJob(state, queued.jobId, sessionId, requestToOrigin);
      state = executed.state;
      const move = executed.ok ? executed.response.answer.diplomaticMove : null;
      const finalDialogue = state.diplomaticDialogues[opened.dialogueId];
      let resolution: Record<string, unknown> = { attempted: false };
      if (executed.ok && finalDialogue?.lastResponse && finalDialogue.status === 'awaiting_player') {
        const decision = move?.kind === 'accept' || move?.kind === 'counter' ? 'accept' : 'acknowledge';
        const resolved = resolveDiplomaticDialogueResponse(state, opened.dialogueId, decision);
        state = resolved.state;
        resolution = { attempted: true, decision, ok: resolved.ok, error: resolved.ok ? undefined : resolved.error };
      }
      dialogueResult = { ok: executed.ok, httpStatus: executed.response.ok ? 200 : 502, latencyMs: Math.round(performance.now() - started), response: executed.response, resolution, move, dialogue: state.diplomaticDialogues[opened.dialogueId] };
    }
  }
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-year-integration-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify({ sessionId, origin, pulses, advisor, dialogue: dialogueResult, final: {
  date: state.currentDate, dossierCount: Object.keys(state.strategicDossiers).length,
  treatyCount: Object.values(state.treaties).filter((treaty) => treaty.status === 'active').length,
  actionCount: state.actions.length, countries: Object.keys(state.countries).length,
} }, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
