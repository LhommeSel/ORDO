import { commitWorldAction } from './ledger';
import type {
  ActionOrigin, CountryId, DossierDecision, DossierDecisionChannel, DossierEntry, DossierDecisionSourceKind, StrategicDossier, Visibility, WorldState,
} from './types';

const importanceRank = { minor: 0, moderate: 1, major: 2, critical: 3 } as const;
const decisionDelayMonths: Record<DossierDecision['urgency'], number> = { low: 4, medium: 3, high: 2, critical: 1 };
const importanceByRank: StrategicDossier['importance'][] = ['minor', 'moderate', 'major', 'critical'];

const entryVisibleToPlayer = (state: WorldState, entry: DossierEntry) =>
  entry.visibility === 'public'
  || entry.visibility === 'player'
  || (entry.visibility === 'secret' && entry.actorIds.includes(state.playerCountryId));

export function dossierUpdatesSinceView(state: WorldState, dossierId: string) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier) return [];
  const visible = dossier.entries.filter((entry) => entryVisibleToPlayer(state, entry));
  if (!dossier.lastViewedEntryId) return visible;
  const lastIndex = visible.findIndex((entry) => entry.id === dossier.lastViewedEntryId);
  return lastIndex < 0 ? visible : visible.slice(lastIndex + 1);
}

export function dossierUnreadCount(state: WorldState, dossierId: string) {
  return dossierUpdatesSinceView(state, dossierId).length;
}

export function dossiersRequiringAttention(state: WorldState) {
  return Object.values(state.strategicDossiers ?? {})
    .filter((dossier) => dossier.status !== 'resolved' && (dossier.followed || dossier.autoTracked))
    .filter((dossier) => dossier.pendingDecisions.length > 0 || dossierUnreadCount(state, dossier.id) > 0)
    .sort((a, b) =>
      Number(b.pendingDecisions.length > 0) - Number(a.pendingDecisions.length > 0)
      || importanceRank[b.importance] - importanceRank[a.importance]
      || b.updatedAt.localeCompare(a.updatedAt),
    );
}

export function setDossierFollowed(state: WorldState, dossierId: string, followed: boolean) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier || dossier.followed === followed) return state;
  return {
    ...state,
    strategicDossiers: {
      ...state.strategicDossiers,
      [dossierId]: { ...dossier, followed },
    },
  };
}

export function markDossierViewed(state: WorldState, dossierId: string) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier) return state;
  const visible = dossier.entries.filter((entry) => entryVisibleToPlayer(state, entry));
  const lastViewedEntryId = visible.at(-1)?.id;
  if (!lastViewedEntryId || dossier.lastViewedEntryId === lastViewedEntryId) return state;
  return {
    ...state,
    strategicDossiers: {
      ...state.strategicDossiers,
      [dossierId]: { ...dossier, lastViewedEntryId },
    },
  };
}

export type { DossierDecisionChannel } from './types';

export const dossierDecisionChannels: DossierDecisionChannel[] = ['local_action', 'dialogue', 'delegation', 'explicit_silence'];

function decisionUrgency(importance: StrategicDossier['importance']): DossierDecision['urgency'] {
  return importance === 'critical' ? 'critical' : importance === 'major' ? 'high' : importance === 'moderate' ? 'medium' : 'low';
}

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

/** Convertit à la volée les anciennes chaînes en décisions enrichies. */
export function dossierDecisionRecords(dossier: StrategicDossier): DossierDecision[] {
  const records = dossier.decisionRecords ?? [];
  return dossier.pendingDecisions.map((prompt, index) => records.find((record) => record.prompt === prompt && record.status === 'pending')
    ?? makeDossierDecision({
      id: `legacy-${dossier.id}-${index + 1}`, prompt, createdAt: dossier.updatedAt,
      importance: dossier.importance, actorIds: dossier.actorIds, sourceKind: 'legacy', sourceLabel: 'Décision héritée de la sauvegarde',
    }));
}

function monthsBetween(start: `${number}-${number}-${number}`, end: `${number}-${number}-${number}`) {
  const [startYear, startMonth] = start.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth);
}

/**
 * Relance les décisions réellement en attente sans faire avancer tous les
 * dossiers chaque mois. Les délais dépendent de l’urgence, puis les relances
 * sont espacées de deux mois pour éviter le spam. Une deuxième relance peut
 * faire monter un dossier modéré à majeur, puis un majeur à critique.
 */
export function advanceDossierEscalation(state: WorldState) {
  let next = state;
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    if (dossier.status === 'resolved' || dossier.pendingDecisions.length === 0) continue;
    const records = dossierDecisionRecords(dossier);
    const overdue = records.some((record) => monthsBetween(record.createdAt, state.currentDate) >= decisionDelayMonths[record.urgency]);
    if (!overdue) continue;
    if (dossier.lastEscalatedAt && monthsBetween(dossier.lastEscalatedAt, state.currentDate) < 2) continue;
    const escalationCount = (dossier.escalationCount ?? 0) + 1;
    const currentRank = importanceRank[dossier.importance];
    const nextImportance = escalationCount >= 2
      ? importanceByRank[Math.min(importanceByRank.length - 1, currentRank + 1)]
      : dossier.importance;
    const importanceChanged = nextImportance !== dossier.importance;
    const title = escalationCount === 1 ? 'Relance faute d’arbitrage' : 'Escalade faute d’arbitrage';
    const summary = importanceChanged
      ? `Une décision reste sans réponse depuis plusieurs mois. Le dossier passe de « ${dossier.importance} » à « ${nextImportance} » et revient dans la file prioritaire.`
      : 'Une décision reste sans réponse malgré une première relance. Le moteur augmente la pression de suivi sans appliquer d’action à la place du joueur.';
    next = commitWorldAction(next, {
      kind: 'political', actorId: state.playerCountryId,
      targetIds: dossier.actorIds.filter((id) => id !== state.playerCountryId), origin: 'time', visibility: 'player',
      intent: `Relancer le dossier « ${dossier.title} »`,
      effects: [
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: {
            escalationCount, lastEscalatedAt: state.currentDate, trend: 'escalating',
            ...(importanceChanged ? { importance: nextImportance } : {}),
          },
          reason: 'Le délai d’une décision importante déclenche une relance graduée.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `dossier-escalation-${dossier.id}-${state.currentDate}-${escalationCount}`,
            date: state.currentDate, title, summary, importance: nextImportance,
            actorIds: dossier.actorIds, requiresDecision: true, visibility: 'player',
          },
          reason: 'La relance est conservée dans la chronologie du dossier.', visibility: 'player',
        },
      ],
    });
  }
  return next;
}

const dossierDecisionLabels: Record<DossierDecisionChannel, string> = {
  local_action: 'Décision gouvernementale engagée',
  dialogue: 'Ouverture d’un canal diplomatique',
  delegation: 'Dossier délégué à l’administration',
  explicit_silence: 'Silence explicite du gouvernement',
};

/**
 * Résout une décision en conservant le choix dans le dossier et le registre.
 * Le dialogue et la délégation sont branchés par leurs workflows dédiés ; le
 * silence explicite peut en plus dégrader la relation selon l’urgence.
 */
export function resolveDossierDecision(
  state: WorldState,
  dossierId: string,
  decision: string,
  channel: DossierDecisionChannel,
) {
  const dossier = state.strategicDossiers?.[dossierId];
  const normalized = decision.trim();
  if (!dossier || !normalized || dossier.pendingDecisions.length === 0) return state;
  const remaining = dossier.pendingDecisions.filter((item) => item !== normalized);
  const selectedRecord = dossierDecisionRecords(dossier).find((record) => record.prompt === normalized);
  const decisionRecords = [
    ...(dossier.decisionRecords ?? []).filter((record) => record.prompt !== normalized),
    ...(selectedRecord ? [{ ...selectedRecord, status: 'resolved' as const, resolvedAt: state.currentDate, resolutionChannel: channel }] : []),
  ];
  const label = dossierDecisionLabels[channel];
  const silencePenalty: Record<DossierDecision['urgency'], number> = { low: 0, medium: -1, high: -3, critical: -5 };
  const penalty = selectedRecord && channel === 'explicit_silence' ? silencePenalty[selectedRecord.urgency] : 0;
  const counterpartIds = dossier.actorIds.filter((id) => id !== state.playerCountryId && Boolean(state.countries[id]));
  const entry: DossierEntry = {
    id: `decision-${dossierId}-${state.sequence + 1}`,
    date: state.currentDate,
    title: label,
    summary: `${normalized} · canal choisi : ${channel.replace('_', ' ')}.`,
    importance: dossier.importance,
    actorIds: dossier.actorIds,
    requiresDecision: false,
    visibility: 'player',
  };
  return commitWorldAction(state, {
    kind: channel === 'dialogue' ? 'diplomatic' : 'political',
    actorId: state.playerCountryId,
    targetIds: dossier.actorIds,
    origin: 'player',
    intent: `${label} dans « ${dossier.title} »`,
    visibility: 'player',
    effects: [
      { kind: 'dossier_patch', dossierId, patch: {
        pendingDecisions: remaining, decisionRecords, playerStance: normalized,
        ...(channel === 'explicit_silence' && selectedRecord && ['high', 'critical'].includes(selectedRecord.urgency) ? { trend: 'escalating' as const } : {}),
      }, reason: 'Le joueur tranche une décision en attente dans le dossier.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId, entry, reason: 'Le choix du joueur est conservé dans la chronologie du dossier.', visibility: 'player' },
      ...(penalty !== 0 ? counterpartIds.map((targetId) => ({
        kind: 'relation_delta' as const, from: state.playerCountryId, to: targetId,
        relation: penalty, trust: Math.round(penalty * 0.7),
        reason: 'Le silence explicite est perçu comme un désengagement par les autres acteurs du dossier.', visibility: 'player' as const,
      })) : []),
    ],
  });
}

export function createDossier(
  state: WorldState,
  dossier: StrategicDossier,
  actorId: CountryId = state.playerCountryId,
  origin: ActionOrigin = 'local_rule',
) {
  if (state.strategicDossiers?.[dossier.id]) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId, origin,
    intent: `Ouvrir le dossier stratégique « ${dossier.title} »`,
    visibility: 'debug',
    effects: [{ kind: 'dossier_add', dossier, reason: 'Une situation durable nécessite une mémoire distincte des événements ponctuels.', visibility: 'debug' }],
  });
}

export function recordDossierUpdate(
  state: WorldState,
  dossierId: string,
  input: {
    id: string;
    title: string;
    summary: string;
    importance: DossierEntry['importance'];
    actorIds: string[];
    requiresDecision?: boolean;
    visibility?: Visibility;
    patch?: Partial<StrategicDossier>;
    actorId?: CountryId;
    origin?: ActionOrigin;
  },
) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier) return state;
  const entry: DossierEntry = {
    id: input.id, date: state.currentDate, title: input.title, summary: input.summary,
    importance: input.importance, actorIds: input.actorIds,
    requiresDecision: input.requiresDecision ?? false,
    visibility: input.visibility ?? 'player',
  };
  return commitWorldAction(state, {
    kind: dossier.kind === 'historical' ? 'historical' : dossier.kind === 'economic' ? 'economic' : 'diplomatic',
    actorId: input.actorId ?? state.playerCountryId,
    targetIds: input.actorIds,
    origin: input.origin ?? 'local_rule',
    intent: `Actualiser le dossier « ${dossier.title} » : ${input.title}`,
    visibility: input.visibility ?? 'player',
    effects: [
      ...(input.patch ? [{ kind: 'dossier_patch' as const, dossierId, patch: input.patch, reason: 'L’état synthétique du dossier évolue avec la situation.', visibility: input.visibility ?? 'player' }] : []),
      { kind: 'dossier_entry_add', dossierId, entry, reason: 'Le changement est rattaché au dossier permanent plutôt que traité comme un événement isolé.', visibility: input.visibility ?? 'player' },
    ],
  });
}
