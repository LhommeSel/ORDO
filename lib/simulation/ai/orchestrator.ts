import { commitWorldAction } from '../ledger';
import type {
  AIJob,
  AIJobPatch,
  AIJobKind,
  ActionOrigin,
  CountryId,
  PowerStruggleAIJob,
  Visibility,
  WorldEffect,
  WorldState,
} from '../types';

export function aiJobAddEffect(job: AIJob, reason: string, visibility: Visibility = 'debug'): WorldEffect {
  return { kind: 'ai_job_add', job, reason, visibility };
}

export function aiJobPatchEffect(
  jobId: string,
  patch: AIJobPatch,
  reason = 'La tâche IA change d’état.',
  visibility: Visibility = 'debug',
): WorldEffect {
  return { kind: 'ai_job_patch', jobId, patch, reason, visibility };
}

export function enqueueAIJob(
  state: WorldState,
  job: AIJob,
  actorId: CountryId = state.playerCountryId,
  origin: ActionOrigin = 'local_rule',
) {
  if (state.aiJobs?.[job.id]) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId, origin, visibility: 'debug',
    intent: `Mettre en attente une tâche IA « ${job.kind} »`,
    effects: [aiJobAddEffect(job, 'Un domaine demande un arbitrage au service IA.')],
  });
}

export function pendingAIJobs(state: WorldState): AIJob[];
export function pendingAIJobs(state: WorldState, kind: 'power_struggle'): PowerStruggleAIJob[];
export function pendingAIJobs(state: WorldState, kind: AIJobKind): AIJob[];
export function pendingAIJobs(state: WorldState, kind?: AIJobKind) {
  return Object.values(state.aiJobs ?? {})
    .filter((job) => job.status === 'pending' && (!kind || job.kind === kind))
    .sort((a, b) => {
      const priority = { background: 0, normal: 1, urgent: 2 } as const;
      return priority[b.priority] - priority[a.priority]
        || a.requestedAt.localeCompare(b.requestedAt)
        || a.id.localeCompare(b.id);
    });
}

export function estimateAIJobSize(job: AIJob) {
  const characters = JSON.stringify(job).length;
  return { characters, approximateInputTokens: Math.ceil(characters / 3.6) };
}

function jobActorId(state: WorldState, job: AIJob): CountryId {
  const candidate = job.kind === 'power_struggle' ? job.countryId : job.actorId;
  return state.countries[candidate] ? candidate : state.playerCountryId;
}

/** Marque une exécution sans réponse exploitable. Aucun effet métier n'est
 * appliqué : la tâche reste consultable et pourra être relancée explicitement. */
export function failAIJob(state: WorldState, jobId: string, message: string) {
  const job = state.aiJobs?.[jobId];
  if (!job || job.status !== 'pending') return state;
  return commitWorldAction(state, {
    kind: 'political', actorId: jobActorId(state, job), origin: 'ai', visibility: 'debug',
    intent: `Échec de la tâche IA « ${job.purpose} »`,
    effects: [aiJobPatchEffect(jobId, {
      status: 'failed', attempts: job.attempts + 1, error: message.slice(0, 500),
    }, 'La tâche IA est marquée en échec sans modifier le monde.', 'debug')],
  });
}

/** Remet une tâche échouée ou annulée en attente, uniquement après une action
 * explicite du joueur. */
export function retryAIJob(state: WorldState, jobId: string): { ok: true; state: WorldState } | { ok: false; state: WorldState; error: string } {
  const job = state.aiJobs?.[jobId];
  if (!job) return { ok: false, state, error: 'Cette tâche IA est introuvable.' };
  if (!['failed', 'cancelled'].includes(job.status)) return { ok: false, state, error: 'Cette tâche est déjà en attente ou résolue.' };
  return {
    ok: true,
    state: commitWorldAction(state, {
      kind: 'political', actorId: jobActorId(state, job), origin: 'player', visibility: 'debug',
      intent: `Relancer la tâche IA « ${job.purpose} »`,
      effects: [aiJobPatchEffect(jobId, {
        status: 'pending', requestedAt: state.currentDate, error: undefined, resolvedAt: undefined,
      }, 'Le joueur demande explicitement une nouvelle tentative IA.', 'debug')],
    }),
  };
}

/** Annule une tâche en attente sans toucher aux dossiers, aux acteurs ou aux
 * indicateurs. Le joueur peut ensuite la relancer si elle redevient utile. */
export function cancelAIJob(state: WorldState, jobId: string): { ok: true; state: WorldState } | { ok: false; state: WorldState; error: string } {
  const job = state.aiJobs?.[jobId];
  if (!job) return { ok: false, state, error: 'Cette tâche IA est introuvable.' };
  if (job.status !== 'pending') return { ok: false, state, error: 'Cette tâche n’est plus en attente.' };
  return {
    ok: true,
    state: commitWorldAction(state, {
      kind: 'political', actorId: jobActorId(state, job), origin: 'player', visibility: 'debug',
      intent: `Annuler la tâche IA « ${job.purpose} »`,
      effects: [aiJobPatchEffect(jobId, { status: 'cancelled', error: 'Annulée par le joueur.' }, 'Le joueur choisit de ne pas engager cet appel IA.', 'debug')],
    }),
  };
}
