import type { DossierDecision, DossierDecisionChannel, DossierDecisionSourceKind, StrategicDossier } from './types';

/** Canaux toujours proposés à une décision structurée de dossier. */
export const dossierDecisionChannels: DossierDecisionChannel[] = ['local_action', 'dialogue', 'delegation', 'explicit_silence'];

function decisionUrgency(importance: StrategicDossier['importance']): DossierDecision['urgency'] {
  return importance === 'critical' ? 'critical' : importance === 'major' ? 'high' : importance === 'moderate' ? 'medium' : 'low';
}

/** Crée une décision persistante sans dépendre du cycle de vie des dossiers. */
export function makeDossierDecision(input: {
  id: string;
  prompt: string;
  createdAt: `${number}-${number}-${number}`;
  importance: StrategicDossier['importance'];
  actorIds: string[];
  sourceKind: DossierDecisionSourceKind;
  sourceId?: string;
  sourceLabel?: string;
}): DossierDecision {
  return {
    id: input.id, prompt: input.prompt, createdAt: input.createdAt,
    urgency: decisionUrgency(input.importance), sourceKind: input.sourceKind,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {}),
    actorIds: [...new Set(input.actorIds)], availableChannels: [...dossierDecisionChannels], status: 'pending',
  };
}
