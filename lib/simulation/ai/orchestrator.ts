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
