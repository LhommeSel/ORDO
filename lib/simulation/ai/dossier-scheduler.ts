import type { DossierImportance, ISODate, StrategicDossier, WorldAction, WorldState } from '../types';
import { dossierScopeFor, type DossierScope } from '../dossier-scope';

const importanceRank: Record<DossierImportance, number> = { minor: 0, moderate: 1, major: 2, critical: 3 };

export type StrategicDossierReview = {
  dossierId: string;
  importance: Extract<DossierImportance, 'major' | 'critical'>;
  scope: DossierScope;
  urgency: number;
  requiresImmediateReview: boolean;
  reasons: string[];
  actorIds: string[];
};

export type DossierReviewLane = 'major' | 'moderate' | 'minor';

/** Cadence locale affichable pour tous les dossiers, sans déclencher d'appel IA. */
export type DossierReviewSchedule = {
  dossierId: string;
  importance: DossierImportance;
  lane: DossierReviewLane;
  nextReviewAt: ISODate;
  intervalMonths: number;
  due: boolean;
  requiresImmediateReview: boolean;
  signalScore: number;
  reasons: string[];
};

const hasDateAfter = (date: ISODate, reference: ISODate) => date > reference;

/**
 * Ordre de rotation déterministe pour les dossiers ex æquo.
 *
 * La file stratégique est volontairement plafonnée : lorsque plusieurs
 * dossiers majeurs réclament une revue en même temps, un simple tri par
 * urgence pouvait laisser les derniers de la liste hors contexte indéfiniment
 * si l'IA ne produisait pas de proposition sur les premiers. On fait donc
 * tourner les ex æquo chaque mois, sans ajouter de curseur dans la sauvegarde
 * ni introduire d'aléa non rejouable.
 */
function rotationRank(month: string, dossierId: string) {
  let hash = 2166136261;
  for (const character of `${month}:${dossierId}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Nombre de frontières mensuelles écoulées entre deux dates ISO. */
function monthsSince(reference: ISODate, current: ISODate) {
  const [referenceYear, referenceMonth] = reference.slice(0, 7).split('-').map(Number);
  const [currentYear, currentMonth] = current.slice(0, 7).split('-').map(Number);
  return Math.max(0, (currentYear - referenceYear) * 12 + (currentMonth - referenceMonth));
}

function addMonths(date: ISODate, months: number): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
}

function latestReviewAt(dossier: StrategicDossier): ISODate {
  return [dossier.updatedAt, dossier.lastAutonomousReviewAt, dossier.lastLocalReviewAt]
    .filter((value): value is ISODate => Boolean(value))
    .sort()
    .at(-1) ?? dossier.updatedAt;
}

function latestReviewActionCount(dossier: StrategicDossier): number | undefined {
  const counts = [dossier.lastAutonomousReviewActionCount, dossier.lastLocalReviewActionCount]
    .filter((value): value is number => typeof value === 'number');
  return counts.length ? Math.max(...counts) : undefined;
}

function touchesDossier(action: WorldAction, dossier: StrategicDossier) {
  const actors = new Set(dossier.actorIds);
  const metadata = action.metadata as Record<string, unknown> | undefined;
  if (metadata?.dossierId === dossier.id || metadata?.linkedDossierId === dossier.id) return true;
  if (metadata?.historicalAnchorId && metadata.historicalAnchorId === dossier.relatedAnchorId) return true;
  if ((action.targetIds ?? []).some((id) => actors.has(id))) return true;
  // Une action du joueur sans cible explicite peut néanmoins concerner son
  // propre dossier ; les écritures autonomes restent ciblées par leurs
  // destinataires pour ne pas réveiller tous les dossiers partageant un acteur.
  return action.origin === 'player' && actors.has(action.actorId);
}

/**
 * Évite que les petites écritures mensuelles du moteur fassent artificiellement
 * progresser un dossier. On ne retient que les choix, crises et actions de
 * projection ayant une portée politique, diplomatique, énergétique ou militaire.
 */
function actionSignal(action: WorldAction, dossier: StrategicDossier): number {
  if (!touchesDossier(action, dossier) || action.kind === 'time_advance' || action.metadata?.minorEvent === true) return 0;
  if (action.metadata?.worldPulse === true) return 0;
  if (action.metadata?.dossierReview === true) return 0;
  if (action.origin === 'player') return 34;
  if (action.origin === 'historical' || action.kind === 'historical') return 28;
  if (['diplomatic', 'energy', 'defense', 'intelligence', 'industrial'].includes(action.kind)) return 14;
  return 0;
}

function meaningfulSignalsSince(state: WorldState, dossier: StrategicDossier, since: ISODate) {
  const reviewActionCount = latestReviewActionCount(dossier);
  const actions = reviewActionCount !== undefined
    ? state.actions.slice(Math.min(state.actions.length, reviewActionCount))
    : state.actions.filter((action) => hasDateAfter(action.createdAt, since));
  return actions
    .map((action) => actionSignal(action, dossier))
    .filter((signal) => signal > 0);
}

function reviewScheduleFor(state: WorldState, dossier: StrategicDossier): DossierReviewSchedule {
  const lastReview = latestReviewAt(dossier);
  const signals = meaningfulSignalsSince(state, dossier, lastReview);
  const signalScore = signals.reduce((sum, signal) => sum + signal, 0);
  const strongestSignal = Math.max(0, ...signals);
  const hasPendingDecision = dossier.pendingDecisions.length > 0
    || dossier.entries.some((entry) => entry.requiresDecision && hasDateAfter(entry.date, lastReview));
  const requiresImmediateReview = hasPendingDecision
    || strongestSignal >= 28
    || (dossier.importance === 'critical' && signalScore > 0);
  const lane: DossierReviewLane = dossier.importance === 'minor' ? 'minor' : dossier.importance === 'moderate' ? 'moderate' : 'major';
  // Les dossiers calmes ralentissent ; un signal ou une décision ramène la
  // cadence à la fréquence normale, sans imposer une progression artificielle.
  const intervalMonths = requiresImmediateReview ? 0
    : lane === 'major' ? (dossier.importance === 'critical' ? 1 : 2)
      : lane === 'moderate' ? (signalScore > 0 ? 3 : 6)
        : (signalScore > 0 ? 6 : 12);
  const nextReviewAt = requiresImmediateReview ? state.currentDate : addMonths(lastReview, intervalMonths);
  // Une première revue secondaire reste planifiée : l'absence d'historique ne
  // doit pas la rendre due dès qu'un ancien état est consulté à une date
  // ultérieure. Seule une décision/signal urgent ou l'échéance la libère.
  const due = requiresImmediateReview || state.currentDate >= nextReviewAt;
  const reasons = [
    ...(hasPendingDecision ? ['décision en attente'] : []),
    ...(strongestSignal >= 28 ? ['action ou choc directement lié'] : []),
    ...(strongestSignal > 0 && strongestSignal < 28 ? ['mouvement concret des acteurs'] : []),
    ...(!requiresImmediateReview && !dossier.lastAutonomousReviewAt && !dossier.lastLocalReviewAt ? ['première revue à planifier'] : []),
    ...(!requiresImmediateReview && !signals.length ? [`cadence calme : ${intervalMonths} mois`] : []),
  ];
  return { dossierId: dossier.id, importance: dossier.importance, lane, nextReviewAt, intervalMonths, due, requiresImmediateReview, signalScore, reasons };
}

/**
 * Planifie les trois voies de suivi sans faire progresser les dossiers.
 * La voie majeure alimente le pouls IA via rankStrategicDossierReviews ; les
 * voies modérée et mineure servent au moteur local et à l'interface pour éviter
 * qu'un dossier calme monopolise la priorité.
 */
export function rankDossierReviews(state: WorldState, limit = 24): DossierReviewSchedule[] {
  return Object.values(state.strategicDossiers ?? {})
    .filter((dossier) => dossier.status !== 'resolved' && (!dossier.sleepingAt || dossier.followed || dossier.reactivatedAt))
    .map((dossier) => reviewScheduleFor(state, dossier))
    .sort((left, right) => Number(right.due) - Number(left.due)
      || Number(right.requiresImmediateReview) - Number(left.requiresImmediateReview)
      || importanceRank[right.importance] - importanceRank[left.importance]
      || left.nextReviewAt.localeCompare(right.nextReviewAt)
      || left.dossierId.localeCompare(right.dossierId))
    .slice(0, limit);
}

/**
 * File stratégique indépendante de la rotation régionale. Un dossier majeur ne
 * « parle » au modèle que si le monde lui fournit réellement quelque chose de
 * nouveau, sauf sa toute première mise en place ou une décision pendante.
 */
export function rankStrategicDossierReviews(state: WorldState, limit = 4): StrategicDossierReview[] {
  return Object.values(state.strategicDossiers ?? {})
    .filter((dossier): dossier is StrategicDossier & { importance: 'major' | 'critical' } =>
      dossier.status !== 'resolved' && !dossier.sleepingAt && importanceRank[dossier.importance] >= importanceRank.major,
    )
    .map((dossier) => {
      const lastReview = dossier.lastAutonomousReviewAt ?? dossier.updatedAt;
      const signals = meaningfulSignalsSince(state, dossier, lastReview);
      const isUnreviewed = !dossier.lastAutonomousReviewAt;
      const hasPendingDecision = dossier.pendingDecisions.length > 0 || dossier.entries.some((entry) => entry.requiresDecision && hasDateAfter(entry.date, lastReview));
      const strongestSignal = Math.max(0, ...signals);
      const totalSignals = signals.reduce<number>((sum, signal) => sum + signal, 0);
      const escalating = dossier.trend === 'escalating';
      const urgency = Math.min(100,
        (dossier.importance === 'critical' ? 42 : 24)
        + (hasPendingDecision ? 42 : 0)
        + (isUnreviewed ? 28 : 0)
        + Math.min(32, totalSignals)
        + (escalating && strongestSignal > 0 ? 12 : 0),
      );
      const reasons = [
        ...(hasPendingDecision ? ['décision du joueur en attente'] : []),
        ...(isUnreviewed ? ['dossier majeur encore jamais réévalué par le pouls'] : []),
        ...(strongestSignal >= 28 ? ['action ou choc directement lié aux acteurs du dossier'] : []),
        ...(strongestSignal > 0 && strongestSignal < 28 ? ['mouvement concret des acteurs concernés'] : []),
        ...(escalating && strongestSignal > 0 ? ['tendance d’escalade confirmée par un changement récent'] : []),
      ];
      return {
        review: {
          dossierId: dossier.id,
          importance: dossier.importance,
          scope: dossierScopeFor(state, dossier),
          urgency,
          requiresImmediateReview: hasPendingDecision || strongestSignal >= 28 || (dossier.importance === 'critical' && strongestSignal > 0),
          reasons,
          actorIds: dossier.actorIds.filter((id) => Boolean(state.countries[id])).slice(0, 6),
        },
        rotation: rotationRank(state.currentDate.slice(0, 7), dossier.id),
      };
    })
    // Un dossier calme n'est pas supprimé : il est seulement retiré de la voie
    // IA du mois. Il reste consultable dans l'interface et peut être épinglé.
    .filter(({ review }) => review.scope === 'player_involved' && review.reasons.length > 0 && !(
      monthsSince(state.strategicDossiers[review.dossierId].lastAutonomousReviewAt ?? state.strategicDossiers[review.dossierId].updatedAt, state.currentDate) < 2
      && !review.requiresImmediateReview
    ))
    .sort((left, right) => Number(right.review.requiresImmediateReview) - Number(left.review.requiresImmediateReview)
      || right.review.urgency - left.review.urgency
      || left.rotation - right.rotation
      || left.review.dossierId.localeCompare(right.review.dossierId))
    .map(({ review }) => review)
    .slice(0, limit);
}

/** File autonome des dossiers majeurs sans lien direct avec le pays joué. */
export function rankWorldDossierReviews(state: WorldState, limit = 4): StrategicDossierReview[] {
  return Object.values(state.strategicDossiers ?? {})
    .filter((dossier): dossier is StrategicDossier & { importance: 'major' | 'critical' } =>
      dossier.status !== 'resolved' && !dossier.sleepingAt && importanceRank[dossier.importance] >= importanceRank.major,
    )
    .map((dossier) => {
      const lastReview = dossier.lastAutonomousReviewAt ?? dossier.updatedAt;
      const signals = meaningfulSignalsSince(state, dossier, lastReview);
      const scope = dossierScopeFor(state, dossier);
      const isUnreviewed = !dossier.lastAutonomousReviewAt;
      const hasPendingDecision = dossier.pendingDecisions.length > 0 || dossier.entries.some((entry) => entry.requiresDecision && hasDateAfter(entry.date, lastReview));
      const strongestSignal = Math.max(0, ...signals);
      const totalSignals = signals.reduce<number>((sum, signal) => sum + signal, 0);
      const escalating = dossier.trend === 'escalating';
      const urgency = Math.min(100,
        (dossier.importance === 'critical' ? 42 : 24)
        + (hasPendingDecision ? 42 : 0)
        + (isUnreviewed ? 28 : 0)
        + Math.min(32, totalSignals)
        + (escalating && strongestSignal > 0 ? 12 : 0),
      );
      const reasons = [
        ...(hasPendingDecision ? ['décision autonome à suivre'] : []),
        ...(isUnreviewed ? ['dossier mondial encore jamais réévalué par le pouls'] : []),
        ...(strongestSignal >= 28 ? ['action ou choc directement lié aux acteurs du dossier'] : []),
        ...(strongestSignal > 0 && strongestSignal < 28 ? ['mouvement concret des acteurs concernés'] : []),
        ...(escalating && strongestSignal > 0 ? ['tendance d’escalade confirmée par un changement récent'] : []),
      ];
      return {
        review: {
          dossierId: dossier.id,
          importance: dossier.importance,
          scope,
          urgency,
          requiresImmediateReview: hasPendingDecision || strongestSignal >= 28 || (dossier.importance === 'critical' && strongestSignal > 0),
          reasons,
          actorIds: dossier.actorIds.filter((id) => Boolean(state.countries[id])).slice(0, 6),
        },
        rotation: rotationRank(state.currentDate.slice(0, 7), dossier.id),
      };
    })
    .filter(({ review }) => review.scope !== 'player_involved' && review.reasons.length > 0 && !(
      monthsSince(state.strategicDossiers[review.dossierId].lastAutonomousReviewAt ?? state.strategicDossiers[review.dossierId].updatedAt, state.currentDate) < 2
      && !review.requiresImmediateReview
    ))
    .sort((left, right) => Number(right.review.requiresImmediateReview) - Number(left.review.requiresImmediateReview)
      || right.review.urgency - left.review.urgency
      || left.rotation - right.rotation
      || left.review.dossierId.localeCompare(right.review.dossierId))
    .map(({ review }) => review)
    .slice(0, limit);
}

export const activeMajorDossierCount = (state: WorldState) => Object.values(state.strategicDossiers ?? {})
  .filter((dossier) => dossier.status !== 'resolved' && importanceRank[dossier.importance] >= importanceRank.major)
  .length;

export const dossierImportanceValue = (importance: DossierImportance) => importanceRank[importance];
