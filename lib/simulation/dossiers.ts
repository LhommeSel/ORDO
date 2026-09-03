import { commitWorldAction } from './ledger';
import type {
  ActionOrigin, CountryId, DossierEntry, StrategicDossier, Visibility, WorldState,
} from './types';

const importanceRank = { minor: 0, moderate: 1, major: 2, critical: 3 } as const;

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
