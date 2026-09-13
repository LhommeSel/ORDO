import type { ISODate, WorldState } from '../types';

/**
 * Résumé de la résolution locale d'un tour.
 *
 * Le résumé est volontairement éphémère : il ne duplique pas l'état du monde
 * dans la sauvegarde. Il donne à l'interface et aux futurs services (pouls IA,
 * journal, tests) un contrat unique pour comprendre ce qu'une avance a produit.
 */
export type TurnResolutionSummary = {
  id: string;
  from: ISODate;
  requestedDate: ISODate;
  to: ISODate;
  isNoop: boolean;
  phasesCompleted: string[];
  actionsAdded: number;
  changesAdded: number;
  autonomousActions: number;
  dossiersCreatedOrUpdated: number;
  programsCompleted: number;
  aiJobsQueued: number;
  aiJobsPending: number;
  aiJobsFailed: number;
};

function dossierChanged(before: WorldState['strategicDossiers'][string] | undefined, after: WorldState['strategicDossiers'][string]) {
  if (!before) return true;
  return before.status !== after.status
    || before.importance !== after.importance
    || before.phase !== after.phase
    || before.trend !== after.trend
    || before.updatedAt !== after.updatedAt
    || before.entries.length !== after.entries.length
    || before.pendingDecisions.length !== after.pendingDecisions.length;
}

/** Produit le bilan commun d'une avance, sans effet de bord. */
export function summarizeTurnResolution(
  before: WorldState,
  after: WorldState,
  requestedDate: ISODate,
  reachedDate: ISODate,
  phasesCompleted: readonly string[],
): TurnResolutionSummary {
  const beforeActionIds = new Set(before.actions.map((action) => action.id));
  const addedActions = after.actions.filter((action) => !beforeActionIds.has(action.id));
  const beforeChangeIds = new Set(before.ledger.map((change) => change.id));
  const addedChanges = after.ledger.filter((change) => !beforeChangeIds.has(change.id));
  const dossiersCreatedOrUpdated = Object.values(after.strategicDossiers).filter((dossier) => dossierChanged(before.strategicDossiers[dossier.id], dossier)).length;
  const programsCompleted = Object.values(after.actionPrograms).filter((program) => {
    const previous = before.actionPrograms[program.id];
    return previous?.status === 'active' && program.status !== 'active';
  }).length;
  const beforeJobIds = new Set(Object.keys(before.aiJobs ?? {}));
  const aiJobsQueued = Object.values(after.aiJobs ?? {}).filter((job) => !beforeJobIds.has(job.id)).length;
  const aiJobsPending = Object.values(after.aiJobs ?? {}).filter((job) => job.status === 'pending').length;
  const aiJobsFailed = Object.values(after.aiJobs ?? {}).filter((job) => job.status === 'failed').length;
  const id = `turn:${before.currentDate}:${reachedDate}:${before.sequence}`;
  return {
    id,
    from: before.currentDate,
    requestedDate,
    to: reachedDate,
    isNoop: reachedDate <= before.currentDate,
    phasesCompleted: [...new Set(phasesCompleted)],
    actionsAdded: addedActions.length,
    changesAdded: addedChanges.length,
    autonomousActions: addedActions.filter((action) => action.actorId !== after.playerCountryId).length,
    dossiersCreatedOrUpdated,
    programsCompleted,
    aiJobsQueued,
    aiJobsPending,
    aiJobsFailed,
  };
}
