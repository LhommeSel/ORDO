import type { ActionLifecycleStage, ActionProgramStatus } from './types';

/**
 * Transitions autorisées pour un programme d'action.
 *
 * Les effets du moteur passent tous par le ledger ; cette table constitue la
 * dernière barrière contre une réouverture accidentelle d'une action terminée
 * ou un lancement matériel avant la validation parlementaire.
 */
const allowedTransitions: Record<ActionProgramStatus, readonly ActionProgramStatus[]> = {
  pending_parliament: ['active', 'failed', 'cancelled'],
  active: ['succeeded', 'partially_succeeded', 'failed', 'cancelled'],
  succeeded: [],
  partially_succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionActionProgramStatus(
  from: ActionProgramStatus,
  to: ActionProgramStatus,
) {
  return from === to || allowedTransitions[from].includes(to);
}

/** Projection unique de l'état persistant pour les vues de suivi. */
export function actionLifecycleStageForStatus(status: ActionProgramStatus): ActionLifecycleStage {
  if (status === 'pending_parliament') return 'under_review';
  if (status === 'active') return 'in_progress';
  if (status === 'succeeded') return 'resolved';
  if (status === 'partially_succeeded') return 'partially_succeeded';
  if (status === 'failed') return 'failed';
  return 'cancelled';
}
