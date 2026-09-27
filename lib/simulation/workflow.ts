import { assessDossierResolution } from './dossiers';
import type { ActionProgram, CapacityDomainId, DossierImportance, StrategicDossier, WorldState } from './types';

/**
 * Étape lisible du parcours décisionnel. Ces étapes sont dérivées de l'état
 * existant : elles ne dupliquent pas la sauvegarde et restent compatibles avec
 * les anciennes parties.
 */
export type WorkflowStage =
  | 'prepared'
  | 'awaiting_decision'
  | 'active'
  | 'blocked'
  | 'resolved'
  | 'failed'
  | 'cancelled';

export type WorkflowItem = {
  id: string;
  title: string;
  stage: WorkflowStage;
  category: string;
  updatedAt: string;
  importance?: DossierImportance;
  targetIds?: string[];
  detail?: string;
};

export type WorkflowCapacityLoad = {
  domain: CapacityDomainId;
  committed: number;
  maximum: number;
  ratio: number;
  level: 'available' | 'saturated' | 'overloaded';
};

export type WorkflowSummary = {
  pendingDecisions: WorkflowItem[];
  activeDossiers: WorkflowItem[];
  activePrograms: WorkflowItem[];
  pendingPrograms: WorkflowItem[];
  openDialogues: WorkflowItem[];
  activeMissions: WorkflowItem[];
  capacityLoads: WorkflowCapacityLoad[];
  counts: {
    pendingDecisions: number;
    activeDossiers: number;
    activePrograms: number;
    pendingPrograms: number;
    openDialogues: number;
    activeMissions: number;
    overloadedCapacities: number;
  };
};

const importanceRank: Record<DossierImportance, number> = { minor: 0, moderate: 1, major: 2, critical: 3 };

/** Étape d'un programme commun, sans transformer son statut persistant. */
export function actionProgramWorkflowStage(program: ActionProgram): WorkflowStage {
  if (program.status === 'pending_parliament') return 'awaiting_decision';
  if (program.status === 'succeeded' || program.status === 'partially_succeeded') return 'resolved';
  if (program.status === 'failed') return 'failed';
  if (program.status === 'cancelled') return 'cancelled';
  // Un programme déjà engagé est actif, même si aucun mois n'a encore été
  // consommé. « prepared » est réservé aux propositions non engagées de l'IA.
  return 'active';
}

function dossierWorkflowStage(state: WorldState, dossier: StrategicDossier): WorkflowStage {
  if (dossier.status === 'resolved') return 'resolved';
  if (dossier.pendingDecisions.length > 0) return 'awaiting_decision';
  const assessment = assessDossierResolution(state, dossier);
  const hasActiveProgram = Object.values(state.actionPrograms ?? {}).some((program) => program.linkedDossierId === dossier.id && program.status === 'active');
  const hasOpenDialogue = Object.values(state.diplomaticDialogues ?? {}).some((dialogue) => dialogue.linkedDossierId === dossier.id && dialogue.status !== 'closed');
  if (assessment.stage === 'blocked' && !hasActiveProgram && !hasOpenDialogue && dossier.trend === 'stable') return 'blocked';
  return 'active';
}

function dossierItem(state: WorldState, dossier: StrategicDossier): WorkflowItem {
  const stage = dossierWorkflowStage(state, dossier);
  return {
    id: dossier.id,
    title: dossier.title,
    stage,
    category: dossier.kind,
    updatedAt: dossier.updatedAt,
    importance: dossier.importance,
    targetIds: dossier.actorIds,
    detail: dossier.pendingDecisions[0] ?? dossier.phase,
  };
}

/**
 * Vue de pilotage commune aux modules. Le moteur reste la source de vérité ;
 * l'interface n'a besoin que de cette projection compacte pour montrer ce qui
 * attend un arbitrage et ce qui consomme effectivement les moyens.
 */
export function workflowSummary(state: WorldState): WorkflowSummary {
  const allDossiers = Object.values(state.strategicDossiers ?? {});
  const dossierItems = allDossiers
    .filter((dossier) => dossier.status !== 'resolved')
    .map((dossier) => dossierItem(state, dossier))
    .sort((a, b) => importanceRank[b.importance ?? 'minor'] - importanceRank[a.importance ?? 'minor'] || b.updatedAt.localeCompare(a.updatedAt));
  const pendingDecisions = dossierItems.filter((item) => item.stage === 'awaiting_decision');
  const activeDossiers = dossierItems.filter((item) => item.stage !== 'awaiting_decision');
  const playerPrograms = Object.values(state.actionPrograms ?? [])
    .filter((program) => program.actorId === state.playerCountryId && ['active', 'pending_parliament'].includes(program.status));
  const toWorkflowItem = (program: ActionProgram) => ({
    id: program.id, title: program.title, stage: actionProgramWorkflowStage(program), category: program.category,
    updatedAt: program.startedAt, targetIds: program.targetIds,
    detail: program.status === 'pending_parliament'
      ? `vote attendu ${program.expectedCompletionAt} · crédits non engagés`
      : `échéance ${program.expectedCompletionAt} · ${Math.round(Math.min(100, program.durationMonths ? program.progressMonths / program.durationMonths * 100 : 100))}%`,
  });
  const activePrograms = playerPrograms
    .filter((program) => program.status === 'active')
    .map(toWorkflowItem)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const pendingPrograms = playerPrograms
    .filter((program) => program.status === 'pending_parliament')
    .map(toWorkflowItem)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const openDialogues = Object.values(state.diplomaticDialogues ?? [])
    .filter((dialogue) => dialogue.participantIds.includes(state.playerCountryId) && dialogue.status !== 'closed')
    .map((dialogue) => ({
      id: dialogue.id, title: dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((id) => state.countries[id]?.name ?? id).join(', ') || 'Canal diplomatique',
      stage: dialogue.status === 'awaiting_player' ? 'awaiting_decision' as const : 'active' as const,
      category: dialogue.kind === 'multilateral_dialogue' ? 'multilatéral' : 'bilatéral', updatedAt: dialogue.updatedAt,
      targetIds: dialogue.participantIds, detail: dialogue.status === 'awaiting_player' ? 'réponse du joueur attendue' : 'réponse IA à demander',
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeMissions = Object.values(state.intelligenceServices?.[state.playerCountryId]?.missions ?? [])
    .filter((mission) => mission.status === 'active')
    .map((mission) => ({
      id: mission.id, title: mission.objective, stage: 'active' as const, category: 'renseignement',
      updatedAt: mission.startedAt ?? state.currentDate,
      targetIds: mission.targetCountryId ? [mission.targetCountryId] : [],
      detail: `${mission.kind} · échéance ${mission.expectedCompletionAt ?? 'à définir'}`,
    }));
  const capacityLoads = Object.entries(state.countries[state.playerCountryId]?.capacities ?? {}).map(([domain, value]) => {
    const ratio = value.maximum > 0 ? value.committed / value.maximum : 0;
    return {
      domain: domain as CapacityDomainId, committed: value.committed, maximum: value.maximum, ratio,
      level: ratio > 1 ? 'overloaded' as const : ratio >= 0.82 ? 'saturated' as const : 'available' as const,
    };
  });
  return {
    pendingDecisions, activeDossiers, activePrograms, pendingPrograms, openDialogues, activeMissions, capacityLoads,
    counts: {
      pendingDecisions: pendingDecisions.length,
      activeDossiers: activeDossiers.length,
      activePrograms: activePrograms.length,
      pendingPrograms: pendingPrograms.length,
      openDialogues: openDialogues.length,
      activeMissions: activeMissions.length,
      overloadedCapacities: capacityLoads.filter((load) => load.level === 'overloaded').length,
    },
  };
}
