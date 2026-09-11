import type { DossierImportance, ISODate, StrategicDossier, WorldAction, WorldState } from '../types';

const importanceRank: Record<DossierImportance, number> = { minor: 0, moderate: 1, major: 2, critical: 3 };

export type StrategicDossierReview = {
  dossierId: string;
  importance: Extract<DossierImportance, 'major' | 'critical'>;
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

function touchesDossier(action: WorldAction, dossier: StrategicDossier) {
  const actors = new Set(dossier.actorIds);
  return actors.has(action.actorId) || (action.targetIds ?? []).some((id) => actors.has(id));
}

/**
 * Évite que les petites écritures mensuelles du moteur fassent artificiellement
 * progresser un dossier. On ne retient que les choix, crises et actions de
 * projection ayant une portée politique, diplomatique, énergétique ou militaire.
 */
function actionSignal(action: WorldAction, dossier: StrategicDossier): number {
  if (!touchesDossier(action, dossier) || action.kind === 'time_advance' || action.metadata?.minorEvent === true) return 0;
  if (action.metadata?.worldPulse === true) return 0;
  if (action.origin === 'player') return 34;
  if (action.origin === 'historical' || action.kind === 'historical') return 28;
  if (['diplomatic', 'energy', 'defense', 'intelligence', 'industrial'].includes(action.kind)) return 14;
  return 0;
}

function meaningfulSignalsSince(state: WorldState, dossier: StrategicDossier, since: ISODate) {
  const actions = typeof dossier.lastAutonomousReviewActionCount === 'number'
    ? state.actions.slice(Math.max(0, dossier.lastAutonomousReviewActionCount))
    : state.actions.filter((action) => hasDateAfter(action.createdAt, since));
  return actions
    .map((action) => actionSignal(action, dossier))
    .filter((signal) => signal > 0);
}

function reviewScheduleFor(state: WorldState, dossier: StrategicDossier): DossierReviewSchedule {
  const lastReview = dossier.lastAutonomousReviewAt ?? dossier.updatedAt;
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
  const due = !dossier.lastAutonomousReviewAt || requiresImmediateReview || state.currentDate >= nextReviewAt;
  const reasons = [
    ...(hasPendingDecision ? ['décision en attente'] : []),
    ...(strongestSignal >= 28 ? ['action ou choc directement lié'] : []),
    ...(strongestSignal > 0 && strongestSignal < 28 ? ['mouvement concret des acteurs'] : []),
    ...(!requiresImmediateReview && !dossier.lastAutonomousReviewAt ? ['première revue à planifier'] : []),
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
        dossierId: dossier.id,
        importance: dossier.importance,
        urgency,
        requiresImmediateReview: hasPendingDecision || strongestSignal >= 28 || (dossier.importance === 'critical' && strongestSignal > 0),
        reasons,
        actorIds: dossier.actorIds.filter((id) => Boolean(state.countries[id])).slice(0, 6),
      };
    })
    // Un dossier calme n'est pas supprimé : il est seulement retiré de la voie
    // IA du mois. Il reste consultable dans l'interface et peut être épinglé.
    .filter((review) => review.reasons.length > 0 && !(
      monthsSince(state.strategicDossiers[review.dossierId].lastAutonomousReviewAt ?? state.strategicDossiers[review.dossierId].updatedAt, state.currentDate) < 2
      && !review.requiresImmediateReview
    ))
    .sort((left, right) => right.urgency - left.urgency || left.dossierId.localeCompare(right.dossierId))
    .slice(0, limit);
}

export const activeMajorDossierCount = (state: WorldState) => Object.values(state.strategicDossiers ?? {})
  .filter((dossier) => dossier.status !== 'resolved' && importanceRank[dossier.importance] >= importanceRank.major)
  .length;

export const dossierImportanceValue = (importance: DossierImportance) => importanceRank[importance];
