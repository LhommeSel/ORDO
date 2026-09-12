import { createAIJobAIRequest, toAIJobOutcome, type AIJobAIResponse } from '../../ai/job-contracts';
import { commitWorldAction } from '../ledger';
import { applyPowerStruggleAIProposal } from '../power-struggles';
import { applyEnergyDiplomacyAIAnswer } from '../energy-negotiation';
import { applyDiplomaticDialogueAIAnswer } from '../diplomacy-dialogue';
import { applyDiplomaticMeetingAIAnswer } from '../diplomatic-negotiation';
import type { AIJob, ActionKind, WorldState } from '../types';
import { compileContextForAIJob } from './context';

const actionKindByJob: Record<AIJob['kind'], ActionKind> = {
  power_struggle: 'political',
  diplomacy: 'diplomatic',
  historical_interpretation: 'historical',
  advisor: 'political',
  free_action_interpretation: 'political',
};

export type AIJobExecutionResult =
  | { ok: true; state: WorldState; response: Extract<AIJobAIResponse, { ok: true }> }
  | { ok: false; state: WorldState; response: Extract<AIJobAIResponse, { ok: false }> };

/**
 * Exécuteur unique côté client. Il compile le contexte, appelle la route serveur,
 * puis passe obligatoirement par un adaptateur métier avant d'écrire dans le monde.
 */
export async function executeAIJob(
  state: WorldState,
  jobId: string,
  sessionId: string,
  fetcher: typeof fetch = fetch,
): Promise<AIJobExecutionResult> {
  const job = state.aiJobs[jobId];
  if (!job || job.status !== 'pending') return {
    ok: false,
    state,
    response: { ok: false, code: 'invalid_request', message: 'Cette tâche IA est introuvable ou déjà traitée.' },
  };
  const context = compileContextForAIJob(state, job);
  let response: Response;
  try {
    response = await fetcher('/api/ai/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createAIJobAIRequest(job, context, sessionId)),
    });
  } catch {
    return { ok: false, state, response: { ok: false, code: 'upstream_error', message: 'Le service IA est momentanément inaccessible.' } };
  }
  let payload: AIJobAIResponse;
  try {
    payload = await response.json() as AIJobAIResponse;
  } catch {
    return { ok: false, state, response: { ok: false, code: 'upstream_error', message: 'Le service IA a renvoyé une réponse illisible. Aucun effet n’a été appliqué.' } };
  }
  if (!payload || typeof payload !== 'object' || typeof (payload as { ok?: unknown }).ok !== 'boolean') {
    return { ok: false, state, response: { ok: false, code: 'upstream_error', message: 'Le service IA a renvoyé un format inattendu. Aucun effet n’a été appliqué.' } };
  }
  if (!response.ok && payload.ok) {
    return { ok: false, state, response: { ok: false, code: 'upstream_error', message: 'Le service IA a signalé une erreur de transport. Aucun effet n’a été appliqué.' } };
  }
  if (!payload.ok) return { ok: false, state, response: payload };
  if (job.kind === 'power_struggle') {
    const plan = payload.answer.powerStrugglePlan;
    if (!plan) return { ok: false, state, response: { ok: false, code: 'upstream_error', message: 'Luna n’a pas fourni le plan politique attendu.' } };
    const applied = applyPowerStruggleAIProposal(state, job.id, plan);
    if (!applied.ok) return { ok: false, state, response: { ok: false, code: 'upstream_error', message: `Le moteur a refusé la proposition : ${applied.errors.join(' ')}` } };
    return { ok: true, state: applied.state, response: payload };
  }
  const outcome = toAIJobOutcome(payload.answer, context);
  if (job.kind === 'diplomacy') {
    if (typeof job.context.meetingId === 'string') {
      const applied = applyDiplomaticMeetingAIAnswer(state, job.id, outcome, payload.answer.diplomaticMove);
      if (!applied.ok) return { ok: false, state, response: { ok: false, code: 'upstream_error', message: `Le moteur de la rencontre a refusé la réponse : ${applied.error}` } };
      return { ok: true, state: applied.state, response: payload };
    }
    if (typeof job.context.dialogueId === 'string') {
      const applied = applyDiplomaticDialogueAIAnswer(state, job.id, outcome, payload.answer.diplomaticMove);
      if (!applied.ok) return { ok: false, state, response: { ok: false, code: 'upstream_error', message: `Le moteur du dialogue a refusé la réponse : ${applied.error}` } };
      return { ok: true, state: applied.state, response: payload };
    }
    const applied = applyEnergyDiplomacyAIAnswer(state, job.id, payload.answer, outcome);
    if (!applied.ok) return { ok: false, state, response: { ok: false, code: 'upstream_error', message: `Le moteur diplomatique a refusé la réponse : ${applied.errors.join(' ')}` } };
    return { ok: true, state: applied.state, response: payload };
  }
  const next = commitWorldAction(state, {
    kind: actionKindByJob[job.kind],
    actorId: state.countries[job.actorId] ? job.actorId : state.playerCountryId,
    origin: 'ai',
    intent: `Résoudre la tâche IA « ${job.purpose} »`,
    visibility: 'debug',
    effects: [{
      kind: 'ai_job_patch',
      jobId: job.id,
      patch: { status: 'resolved', resolvedAt: state.currentDate, attempts: job.attempts + 1, outcome, error: undefined },
      reason: 'La réponse structurée est conservée pour que le domaine décide ensuite de ses effets.',
      visibility: 'debug',
    }],
  });
  return { ok: true, state: next, response: payload };
}
