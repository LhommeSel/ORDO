import { commitWorldAction } from './ledger';
import { historicalAnchorChannelEffects } from './history';
import { makeDossierDecision } from './dossier-decisions';
import { rankDossierReviews } from './ai/dossier-scheduler';
import type {
  ActionOrigin, CountryId, DossierDecision, DossierDecisionChannel, DossierEntry, StrategicDossier, Visibility, WorldState,
} from './types';

const importanceRank = { minor: 0, moderate: 1, major: 2, critical: 3 } as const;
const decisionDelayMonths: Record<DossierDecision['urgency'], number> = { low: 4, medium: 3, high: 2, critical: 1 };
const importanceByRank: StrategicDossier['importance'][] = ['minor', 'moderate', 'major', 'critical'];
const resolutionQuietMonths: Record<StrategicDossier['importance'], number> = { minor: 3, moderate: 4, major: 6, critical: 9 };

export type DossierResolutionAssessment = {
  /** Une crise se stabilise ; une coopération se met en œuvre dans la durée. */
  mode: 'stabilization' | 'implementation';
  stage: 'active' | 'stabilising' | 'blocked' | 'resolved';
  canResolve: boolean;
  quietMonths: number;
  requiredQuietMonths: number;
  positiveSignals: string[];
  blockers: string[];
  nextMilestone: string;
};

const entryVisibleToPlayer = (state: WorldState, entry: DossierEntry) =>
  entry.visibility === 'public'
  || entry.visibility === 'player'
  || (entry.visibility === 'secret' && entry.actorIds.includes(state.playerCountryId));

/**
 * « Désescalade » ne décrit que la sortie d'une crise ou d'un choc. Une
 * coopération, un accord politique ou une réforme n'est pas une crise que le
 * joueur chercherait à faire disparaître : elle doit rester active et suivie.
 */
export function dossierNeedsStabilization(dossier: StrategicDossier) {
  return dossier.kind === 'conflict'
    || dossier.kind === 'diplomatic_crisis'
    // Une crise économique peut précéder le choc macroéconomique qu'elle
    // transmet (bulle, fuite des capitaux, rupture d'approvisionnement). Une
    // réponse réussie doit donc pouvoir amorcer sa désescalade ; exiger un
    // sourceShockId rendait ces dossiers impossibles à calmer avant que les
    // dégâts aient déjà été matérialisés.
    || dossier.kind === 'economic';
}

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

/** Un dossier peut être mis de côté tant qu’il n’attend pas une décision explicite du joueur. */
export function dossierRequiresPlayerIntervention(state: WorldState, dossier: StrategicDossier) {
  return dossier.pendingDecisions.length > 0
    || (dossier.decisionRecords ?? []).some((record) => record.status === 'pending');
}

export function setDossierIgnored(state: WorldState, dossierId: string, ignored: boolean) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier || (ignored && dossierRequiresPlayerIntervention(state, dossier))) return state;
  if (Boolean(dossier.ignoredAt) === ignored) return state;
  return {
    ...state,
    strategicDossiers: {
      ...state.strategicDossiers,
      [dossierId]: { ...dossier, ...(ignored ? { ignoredAt: state.currentDate } : { ignoredAt: undefined }) },
    },
  };
}

export type DossierActivityStatus = {
  unreadCount: number;
  /** Le joueur a-t-il consulté toutes les évolutions actuellement visibles ? */
  consultedSinceLastChange: boolean;
  /** Une action du joueur est-elle postérieure à la dernière évolution extérieure ? */
  playerDecisionSinceLastChange: boolean;
};

const isPlayerDecisionEntry = (state: WorldState, entry: DossierEntry) =>
  entry.origin === 'player'
  || entry.actorId === state.playerCountryId
  || /^(Directive du gouvernement|Décision du gouvernement|Réponse du gouvernement|Message du gouvernement)$/i.test(entry.title);

/**
 * Deux questions distinctes évitent le badge ambigu « nouveau » : le joueur a
 * pu lire une évolution sans encore agir, ou agir après le dernier fait du monde.
 * Les anciennes sauvegardes sont reconnues par les titres historiques connus.
 */
export function dossierActivityStatus(state: WorldState, dossierId: string): DossierActivityStatus {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier) return { unreadCount: 0, consultedSinceLastChange: false, playerDecisionSinceLastChange: false };
  const visible = dossier.entries.filter((entry) => entryVisibleToPlayer(state, entry));
  // La propre décision du joueur est déjà connue : elle ne doit pas recréer
  // artificiellement une pastille « à consulter » dans la liste.
  const unreadCount = dossierUpdatesSinceView(state, dossierId)
    .filter((entry) => !isPlayerDecisionEntry(state, entry)).length;
  const hasExternalChange = visible.some((entry) => !isPlayerDecisionEntry(state, entry));
  const lastExternalChangeIndex = visible.reduce(
    (latest, entry, index) => isPlayerDecisionEntry(state, entry) ? latest : index,
    -1,
  );
  return {
    unreadCount,
    consultedSinceLastChange: hasExternalChange && unreadCount === 0,
    playerDecisionSinceLastChange: visible.slice(lastExternalChangeIndex + 1).some((entry) => isPlayerDecisionEntry(state, entry)),
  };
}

/**
 * Explique la sortie possible d'un dossier avec des faits déjà présents dans
 * le monde. Il n'ajoute aucune jauge arbitraire à la sauvegarde.
 */
export function assessDossierResolution(state: WorldState, dossier: StrategicDossier): DossierResolutionAssessment {
  const requiredQuietMonths = resolutionQuietMonths[dossier.importance];
  const quietMonths = monthsBetween(dossier.updatedAt, state.currentDate);
  const mode = dossierNeedsStabilization(dossier) ? 'stabilization' as const : 'implementation' as const;
  if (dossier.status === 'resolved') return {
    mode, stage: 'resolved', canResolve: false, quietMonths, requiredQuietMonths,
    positiveSignals: ['La situation est stabilisée et sa chronologie reste archivée.'], blockers: [],
    nextMilestone: 'Le dossier ne sera rouvert que par un nouveau signal matériel.',
  };
  const programs = Object.values(state.actionPrograms ?? {}).filter((program) => program.linkedDossierId === dossier.id);
  const recentPrograms = programs.filter((program) => program.status === 'active' || monthsBetween(program.expectedCompletionAt, state.currentDate) <= 18);
  const hasActiveProgram = programs.some((program) => program.status === 'active');
  const hasOpenDialogue = Object.values(state.diplomaticDialogues ?? {}).some((dialogue) => dialogue.linkedDossierId === dossier.id && dialogue.status !== 'closed');
  const hasOpenSession = Object.values(state.diplomaticSessions ?? {}).some((session) => session.linkedDossierId === dossier.id && !['refused', 'closed', 'active'].includes(session.status));
  const anchor = dossier.relatedAnchorId ? state.historicalAnchors?.[dossier.relatedAnchorId] : undefined;
  const historicalPressureContinues = Boolean(anchor && ['proposed', 'active'].includes(anchor.status));
  const positiveSignals = [
    ...(dossier.commitments.length ? [`${dossier.commitments.length} engagement(s) formalisé(s)`] : []),
    ...recentPrograms.filter((program) => program.status === 'succeeded').slice(-2).map((program) => `Résultat obtenu : ${program.title}`),
    ...(dossier.trend === 'deescalating' ? ['La trajectoire observée est en désescalade.'] : []),
  ];
  if (mode === 'implementation') {
    const nextMilestone = dossier.pendingDecisions.length
      ? 'Traiter les décisions en attente avant de modifier ou d’élargir l’engagement.'
      : hasActiveProgram ? 'Suivre l’exécution du programme engagé.'
        : hasOpenDialogue || hasOpenSession ? 'Lire la réponse des partenaires puis décider de la suite.'
          : dossier.commitments.length ? 'Suivre les engagements actifs et leurs effets dans le temps.'
            : 'Aucun engagement n’est encore conclu : poursuivre la consultation ou formuler une nouvelle proposition.';
    return {
      mode, stage: dossier.pendingDecisions.length ? 'blocked' : 'active', canResolve: false,
      quietMonths, requiredQuietMonths, positiveSignals, blockers: [], nextMilestone,
    };
  }
  const blockers = [
    ...(dossier.pendingDecisions.length ? [`${dossier.pendingDecisions.length} décision(s) encore attendue(s)`] : []),
    ...(hasActiveProgram ? ['Un programme lié est encore en cours.'] : []),
    ...(hasOpenDialogue || hasOpenSession ? ['Une négociation liée reste ouverte.'] : []),
    ...(historicalPressureContinues ? ['La tendance historique sous-jacente reste active.'] : []),
    ...(recentPrograms.some((program) => program.status === 'failed') ? ['Un programme récent a échoué et entretient la pression.'] : []),
    ...(dossier.status !== 'deescalating' || dossier.trend !== 'deescalating' ? ['La situation n’est pas encore dans une désescalade vérifiable.'] : []),
    ...(quietMonths < requiredQuietMonths ? [`Il manque ${requiredQuietMonths - quietMonths} mois calme(s) avant stabilisation.`] : []),
  ];
  const canResolve = dossier.status === 'deescalating' && dossier.trend === 'deescalating'
    && dossier.pendingDecisions.length === 0 && !hasActiveProgram && !hasOpenDialogue && !hasOpenSession
    && !historicalPressureContinues && quietMonths >= requiredQuietMonths;
  const nextMilestone = dossier.pendingDecisions.length ? 'Traiter ou assumer explicitement les décisions en attente.'
    : hasActiveProgram ? 'Attendre la résolution du programme engagé.'
      : hasOpenDialogue || hasOpenSession ? 'Faire aboutir ou fermer la négociation en cours.'
        : historicalPressureContinues ? 'Infléchir la tendance de fond ou attendre sa manifestation.'
          : dossier.status !== 'deescalating' || dossier.trend !== 'deescalating' ? 'Obtenir un résultat concret capable d’amorcer la désescalade.'
            : quietMonths < requiredQuietMonths ? `Maintenir la désescalade encore ${requiredQuietMonths - quietMonths} mois.`
              : 'La clôture interviendra à la prochaine frontière mensuelle.';
  return { mode, stage: canResolve ? 'stabilising' : blockers.length ? 'blocked' : 'active', canResolve, quietMonths, requiredQuietMonths, positiveSignals, blockers, nextMilestone };
}

export function dossiersRequiringAttention(state: WorldState) {
  return Object.values(state.strategicDossiers ?? {})
    .filter((dossier) => dossier.status !== 'resolved' && (dossier.followed || dossier.autoTracked))
    .concat(Object.values(state.strategicDossiers ?? {}).filter((dossier) => {
      if (dossier.status === 'resolved' || dossier.followed || dossier.autoTracked || !dossier.reactivatedAt) return false;
      return monthsBetween(dossier.reactivatedAt, state.currentDate) <= 1;
    }))
    .filter((dossier, index, all) => all.findIndex((candidate) => candidate.id === dossier.id) === index)
    .filter((dossier) => !dossier.ignoredAt || dossierRequiresPlayerIntervention(state, dossier))
    .filter((dossier) => !dossier.sleepingAt || dossier.followed)
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
      [dossierId]: { ...dossier, lastViewedEntryId, reactivatedAt: undefined },
    },
  };
}

export type { DossierDecisionChannel } from './types';

export { dossierDecisionChannels, makeDossierDecision } from './dossier-decisions';

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
    if (dossier.status === 'resolved' || dossier.sleepingAt || dossier.pendingDecisions.length === 0) continue;
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

/**
 * Met en sommeil les arbitrages secondaires réellement abandonnés. Cela ne
 * s’applique ni aux dossiers majeurs/critique, ni aux dossiers épinglés, et ne
 * supprime jamais l’historique : les décisions passent simplement à expired.
 */
export function advanceDossierLifecycle(state: WorldState) {
  let next = state;
  // Les dossiers ouverts par un choc suivent désormais son cycle causal :
  // tant que le choc existe, ils restent actifs ; dès sa disparition, ils
  // entrent en désescalade puis peuvent se clore après une période calme.
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    if (!dossier.sourceShockId || dossier.status === 'resolved') continue;
    const shockStillActive = next.worldEconomy.activeShocks.some((shock) => shock.id === dossier.sourceShockId);
    if (shockStillActive || dossier.sourceShockEndedAt) continue;
    next = commitWorldAction(next, {
      kind: 'economic', actorId: next.playerCountryId,
      targetIds: dossier.actorIds.filter((id) => id !== next.playerCountryId), origin: 'time', visibility: 'player',
      intent: `Mettre en désescalade le dossier « ${dossier.title} »`,
      effects: [
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: { status: 'deescalating', trend: 'deescalating', phase: 'Choc dissipé · surveillance', updatedAt: next.currentDate, sourceShockEndedAt: next.currentDate },
          reason: 'Le choc source a disparu du registre économique ; le dossier reste surveillé avant sa clôture.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `dossier-shock-ended-${dossier.id}-${next.currentDate}`, date: next.currentDate, title: 'Choc source dissipé',
            summary: 'Le moteur ne détecte plus le choc économique d’origine. Les effets résiduels sont suivis pendant la période de stabilisation.',
            importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: dossier.pendingDecisions.length > 0, visibility: 'player',
          },
          reason: 'La disparition du choc est conservée dans la chronologie causale du dossier.', visibility: 'player',
        },
      ],
    });
  }
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    if (dossier.status === 'resolved' || dossier.sleepingAt || dossier.followed || dossier.autoTracked) continue;
    if (dossier.importance === 'major' || dossier.importance === 'critical' || dossier.pendingDecisions.length === 0) continue;
    const records = dossierDecisionRecords(dossier);
    const stale = records.length > 0 && records.every((record) => record.urgency === 'low' || record.urgency === 'medium')
      && records.every((record) => monthsBetween(record.createdAt, state.currentDate) >= 6);
    if (!stale) continue;
    const expiredPrompts = new Set(dossier.pendingDecisions);
    const decisionRecords = [
      ...(dossier.decisionRecords ?? []).filter((record) => !expiredPrompts.has(record.prompt)),
      ...records.map((record) => ({ ...record, status: 'expired' as const, expiredAt: state.currentDate })),
    ];
    next = commitWorldAction(next, {
      kind: 'political', actorId: state.playerCountryId,
      targetIds: dossier.actorIds.filter((id) => id !== state.playerCountryId), origin: 'time', visibility: 'player',
      intent: `Mettre en sommeil le dossier « ${dossier.title} »`,
      effects: [
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: { pendingDecisions: [], decisionRecords, sleepingAt: state.currentDate, status: 'deescalating', trend: 'deescalating', phase: 'Mise en sommeil' },
          reason: 'Une décision secondaire trop ancienne est mise en sommeil sans effacer l’historique.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `dossier-sleep-${dossier.id}-${state.currentDate}`,
            date: state.currentDate, title: 'Dossier mis en sommeil',
            summary: 'Aucun arbitrage récent ne justifie de maintenir ce dossier dans les alertes actives. Il reste réactivable à tout moment.',
            importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player',
          },
          reason: 'Le cycle de vie réduit le bruit des dossiers secondaires inactifs.', visibility: 'player',
        },
      ],
    });
  }
  // Un dossier ne disparaît pas dès qu'une action réussit : il entre en
  // désescalade, reste observable plusieurs mois, puis se clôt seulement si
  // aucune décision, négociation, action ou tendance historique ne le maintient.
  for (const dossier of Object.values(next.strategicDossiers ?? {})) {
    const assessment = assessDossierResolution(next, dossier);
    if (!assessment.canResolve) continue;
    next = commitWorldAction(next, {
      kind: dossier.kind === 'economic' ? 'economic' : dossier.kind === 'historical' ? 'historical' : 'diplomatic',
      actorId: next.playerCountryId,
      targetIds: dossier.actorIds.filter((id) => id !== next.playerCountryId),
      origin: 'time', visibility: 'player',
      intent: `Clore le dossier « ${dossier.title} » après désescalade`,
      effects: [
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: { status: 'resolved', phase: 'Situation stabilisée', autoTracked: false }, clear: ['sleepingAt'],
          reason: 'La désescalade s’est maintenue sans nouveau signal, décision ou programme actif.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `dossier-resolved-${dossier.id}-${next.currentDate}`,
            date: next.currentDate, title: 'Situation stabilisée',
            summary: `Aucun élément matériel n’a relancé la situation pendant ${resolutionQuietMonths[dossier.importance]} mois. Le dossier est clos, mais sa chronologie reste consultable.`,
            importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player',
          },
          reason: 'La clôture est conservée comme une étape explicite de la chronologie.', visibility: 'player',
        },
      ],
    });
  }
  return next;
}

/**
 * Résout la file locale des dossiers secondaires. Une revue ne fait pas
 * avancer artificiellement la situation : elle produit seulement un point de
 * situation traçable et décale la prochaine échéance. Les dossiers majeurs
 * restent exclusivement dans la file stratégique/pouls IA.
 */
export function advanceDossierReviewQueue(state: WorldState, limit = 4) {
  const schedules = rankDossierReviews(state, 64)
    .filter((review) => review.due && (review.lane === 'moderate' || review.lane === 'minor'))
    .slice(0, limit);
  let next = state;
  for (const schedule of schedules) {
    const dossier = next.strategicDossiers[schedule.dossierId];
    if (!dossier || dossier.status === 'resolved' || dossier.sleepingAt) continue;
    const signalText = schedule.signalScore > 0
      ? ` ${schedule.signalScore} points de signaux récents justifient ce contrôle.`
      : ' Aucun signal causal nouveau n’impose une escalade.';
    next = commitWorldAction(next, {
      kind: 'political', actorId: next.playerCountryId,
      targetIds: dossier.actorIds.filter((id) => id !== next.playerCountryId),
      origin: 'local_rule', visibility: 'player',
      intent: `Revue locale du dossier « ${dossier.title} »`,
      metadata: { dossierReview: true, dossierReviewLane: schedule.lane },
      effects: [
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: {
            updatedAt: next.currentDate,
            lastLocalReviewAt: next.currentDate,
            // L'action de revue est ajoutée juste après l'état courant.
            lastLocalReviewActionCount: next.actions.length + 1,
          },
          reason: `Le calendrier ${schedule.lane} déclenche une revue locale sans modifier la trajectoire.`, visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `dossier-local-review-${dossier.id}-${next.currentDate}`,
            date: next.currentDate,
            title: `Revue locale · ${schedule.lane}`,
            summary: `Le moteur reprend le dossier à son échéance.${signalText} La situation reste consultable ; aucune décision n’est imposée par cette revue.`,
            importance: dossier.importance,
            actorIds: dossier.actorIds,
            requiresDecision: false,
            visibility: 'player',
          },
          reason: 'Le point de situation est conservé dans la chronologie du dossier.', visibility: 'player',
        },
      ],
    });
  }
  return next;
}

export function reactivateDossier(state: WorldState, dossierId: string) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier?.sleepingAt) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId,
    targetIds: dossier.actorIds.filter((id) => id !== state.playerCountryId), origin: 'player', visibility: 'player',
    intent: `Réactiver le dossier « ${dossier.title} »`,
    effects: [
      { kind: 'dossier_patch', dossierId, patch: { reactivatedAt: state.currentDate, status: 'active', trend: 'stable', phase: 'Réactivé par le joueur' }, clear: ['sleepingAt'], reason: 'Le joueur remet un dossier secondaire dans le suivi actif.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId, entry: { id: `dossier-reactivate-${dossierId}-${state.sequence + 1}`, date: state.currentDate, title: 'Dossier réactivé', summary: 'Le joueur demande à reprendre le suivi actif de cette situation.', importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player' }, reason: 'La réactivation est conservée dans la chronologie.', visibility: 'player' },
    ],
  });
}

const nonSignalEffects = new Set([
  'date_set', 'processed_stop_add', 'ai_job_add', 'ai_job_patch',
  'dossier_add', 'dossier_patch', 'dossier_entry_add',
]);

/**
 * Réveille un dossier secondaire lorsqu’un changement externe pertinent touche
 * l’un de ses acteurs. Les événements mineurs et les écritures purement
 * techniques sont volontairement ignorés pour ne pas recréer du bruit.
 */
export function reactivateDossiersOnWorldSignals(state: WorldState, actionStartIndex = 0) {
  let next = state;
  const signals = state.actions.slice(Math.max(0, actionStartIndex)).filter((action) => {
    if (action.origin === 'time' || action.metadata?.minorEvent === true) return false;
    // Les initiatives générées par les règles locales (contrat de ressource,
    // maintenance, écriture politique...) font vivre le monde, mais ne sont
    // pas en elles-mêmes une information nouvelle sur tous les dossiers dont
    // elles recoupent les acteurs. Seul un pouls mondial explicitement marqué
    // peut les faire remonter comme signal.
    if (action.origin === 'local_rule' && action.metadata?.worldPulse !== true) return false;
    if (!action.effects.some((effect) => !nonSignalEffects.has(effect.kind))) return false;
    return true;
  });
  if (!signals.length) return next;
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    if (!dossier.sleepingAt || dossier.status === 'resolved') continue;
    // Un dossier relié à un processus encore latent ne peut pas être réveillé
    // par les effets généraux du moteur : sa manifestation est la seule
    // transition qui le rend observable par le joueur.
    const actorSet = new Set(dossier.actorIds);
    const signal = signals.find((action) => {
      const touchesActor = [action.actorId, ...(action.targetIds ?? [])].some((id) => actorSet.has(id));
      // Une action générale du joueur ne doit pas réveiller tous les dossiers
      // partageant son pays ; seules les actions explicitement liées au dossier
      // ont cette propriété. Les signaux extérieurs restent plus ouverts.
      if (action.actorId === state.playerCountryId && action.origin === 'player'
        && action.metadata?.linkedDossierId !== dossier.id) return false;
      const remainsLatent = dossier.relatedCurrentIds.some((currentId) => Object.values(state.latentProcesses ?? {})
        .some((process) => process.currentId === currentId && process.status === 'preparing'));
      // Une écriture structurelle interne ne révèle pas à elle seule une
      // veille : la bulle technologique ne doit pas surgir dès le premier
      // calcul mensuel. En revanche, un geste extérieur adressé à l'un des
      // acteurs du dossier est un signal matériel et le réactive sans attendre
      // la manifestation du processus latent.
      const directExternalSignal = action.actorId !== state.playerCountryId
        && (action.targetIds ?? []).some((id) => actorSet.has(id));
      if (remainsLatent && !directExternalSignal && action.metadata?.linkedDossierId !== dossier.id) return false;
      return touchesActor;
    });
    if (!signal) continue;
    next = commitWorldAction(next, {
      kind: 'political', actorId: state.playerCountryId,
      targetIds: dossier.actorIds.filter((id) => id !== state.playerCountryId), origin: 'local_rule', visibility: 'player',
      intent: `Réactiver le dossier « ${dossier.title} » après un signal externe`,
      effects: [
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: { reactivatedAt: state.currentDate, status: 'active', trend: 'stable', phase: 'Réactivé par signal externe' }, clear: ['sleepingAt'],
          reason: 'Un changement significatif touche un acteur du dossier endormi.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `dossier-signal-${dossier.id}-${state.currentDate}-${signal.id}`,
            date: state.currentDate, title: 'Signal externe : reprise du suivi',
            summary: `Le dossier est réveillé par « ${signal.intent.slice(0, 220)} ». Aucun arbitrage n’est imposé sans nouvelle décision explicite.`,
            importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player', sourceActionId: signal.id,
          },
          reason: 'Le signal externe est rattaché à la chronologie du dossier sans supprimer son historique.', visibility: 'player',
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
      ...(channel === 'explicit_silence' && selectedRecord?.sourceKind === 'historical'
        ? historicalAnchorChannelEffects(state, dossierId, { sourceId: selectedRecord.id, resolution: 'explicit_silence' })
        : []),
    ],
  });
}

/**
 * Enregistre une orientation politique sans la déguiser en « programme »
 * chiffré. Les programmes restent pertinents pour ce qui est matériellement
 * mesurable (troupes, mission de renseignement, chantier), mais une ligne
 * diplomatique, économique ou historique est d'abord une directive : elle
 * devient la posture officielle du joueur et nourrit les réponses des acteurs.
 */
export function adoptDossierDirective(
  state: WorldState,
  dossierId: string,
  input: {
    directive: string;
    execution: string;
    decisionPrompt?: string;
    phase?: string;
  },
) {
  const initial = state.strategicDossiers?.[dossierId];
  const directive = input.directive.trim();
  if (!initial || directive.length < 12) return state;
  const afterDecision = input.decisionPrompt && initial.pendingDecisions.includes(input.decisionPrompt)
    ? resolveDossierDecision(state, dossierId, input.decisionPrompt, 'local_action')
    : state;
  const dossier = afterDecision.strategicDossiers?.[dossierId];
  if (!dossier) return afterDecision;
  const phase = input.phase
    ?? (dossier.kind === 'cooperation'
      ? 'Directive gouvernementale · réponse des partenaires attendue'
      : dossier.kind === 'historical'
        ? 'Orientation nationale déclarée'
        : 'Directive gouvernementale engagée');
  const execution = input.execution.trim() || 'Les modalités concrètes seront précisées par les acteurs concernés et les prochaines échéances du dossier.';
  return recordDossierUpdate(afterDecision, dossierId, {
    id: `directive-${dossierId}-${afterDecision.sequence + 1}`,
    title: 'Directive du gouvernement',
    summary: `Ordre adopté : ${directive}\n\nMise en œuvre annoncée : ${execution}`,
    importance: dossier.importance,
    actorIds: dossier.actorIds,
    actorId: afterDecision.playerCountryId,
    origin: 'player',
    patch: {
      playerStance: directive,
      phase,
      status: dossier.status === 'resolved' ? 'active' : dossier.status,
      trend: dossier.kind === 'cooperation' ? 'stable' : dossier.trend,
      updatedAt: afterDecision.currentDate,
    },
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
