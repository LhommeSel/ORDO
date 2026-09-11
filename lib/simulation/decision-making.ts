import { evaluatePoliticalPathway } from './politics';
import { seededUnit } from './random';
import type {
  DecisionCriterion,
  GovernmentDoctrine,
  StrategicActionCandidate,
  StrategicActionEvaluation,
  WorldState,
} from './types';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const nationalWeights: Partial<Record<DecisionCriterion, number>> = {
  growth: 1, employment: 0.9, price_stability: 0.8, fiscal_sustainability: 0.8,
  strategic_autonomy: 0.7, alliance_cohesion: 0.35, social_cohesion: 0.75,
  redistribution: 0.15, regime_survival: 0.1, elite_support: 0.05, international_prestige: 0.25,
};

function weightedOutcome(
  candidate: StrategicActionCandidate,
  weights: Partial<Record<DecisionCriterion, number>>,
) {
  const entries = Object.entries(candidate.outcomes) as Array<[DecisionCriterion, number]>;
  let totalWeight = 0;
  let total = 0;
  for (const [criterion, value] of entries) {
    const weight = weights[criterion] ?? 0;
    totalWeight += weight;
    total += clamp(value, -100, 100) * weight;
  }
  return totalWeight > 0 ? total / totalWeight : 0;
}

function doctrineCompatibility(government: GovernmentDoctrine, requested?: Partial<GovernmentDoctrine>) {
  const entries = Object.entries(requested ?? {}) as Array<[keyof GovernmentDoctrine, number]>;
  if (!entries.length) return 70;
  const distance = entries.reduce((sum, [criterion, value]) => sum + Math.abs(government[criterion] - value), 0) / entries.length;
  return clamp(100 - distance, 0, 100);
}

function leadershipDisposition(state: WorldState, candidate: StrategicActionCandidate, doctrineCompatibilityScore: number) {
  const leadership = state.leadership?.[candidate.actorId];
  if (!leadership?.figures.length) return 50;
  const totalAuthority = leadership.figures.reduce((sum, figure) => sum + figure.authorityShare, 0) || 1;
  const horizonYears = typeof candidate.metadata?.timeHorizonYears === 'number' ? candidate.metadata.timeHorizonYears : 1;
  const disposition = leadership.figures.reduce((sum, figure) => {
    const traits = figure.traits;
    let score = 50;
    score += (traits.riskAppetite - 50) * candidate.risk / 230;
    if (candidate.signals.includes('military_escalation')) score += (traits.belligerence - 50) * 0.32;
    if (candidate.signals.includes('commercial_deal')) score += (traits.transactionality - 50) * 0.28;
    if (candidate.signals.includes('alliance_cooperation')) score += (traits.reliability - 50) * 0.18;
    if (candidate.signals.includes('alliance_breach')) score -= (traits.reliability - 50) * 0.3;
    score += (traits.patience - 50) * Math.min(1, horizonYears / 10) * 0.18;
    score += (doctrineCompatibilityScore - 50) * traits.ideologicalCommitment / 500;
    score += (traits.flexibility - 50) * candidate.urgency / 500;
    return sum + clamp(score, 0, 100) * figure.authorityShare;
  }, 0) / totalAuthority;
  const coordinationPenalty = (100 - leadership.executiveCoordination) * Math.max(0, candidate.publicSalience - 35) / 260;
  return clamp(disposition - coordinationPenalty, 0, 100);
}

function apparatusSupport(state: WorldState, candidate: StrategicActionCandidate) {
  const apparatus = state.politicalApparatus?.[candidate.actorId];
  if (!apparatus?.currents.length) return 50;
  const totalWeight = apparatus.currents.reduce((sum, current) => sum + current.weight, 0) || 1;
  const support = apparatus.currents.reduce((sum, current) => {
    const supported = candidate.signals.filter((signal) => current.supportedSignals.includes(signal)).length;
    const opposed = candidate.signals.filter((signal) => current.opposedSignals.includes(signal)).length;
    const criterionEntries = Object.entries(candidate.outcomes) as Array<[DecisionCriterion, number]>;
    let criterionScore = 0;
    let criterionWeight = 0;
    for (const [criterion, outcome] of criterionEntries) {
      const preference = current.criterionPreferences[criterion] ?? 0;
      criterionScore += clamp(outcome, -100, 100) * preference;
      criterionWeight += preference;
    }
    const material = criterionWeight ? criterionScore / criterionWeight : 0;
    const reach = current.institutionalReach / 100;
    const score = 50 + supported * 11 - opposed * 18 + material * 0.22 * reach;
    return sum + clamp(score, 0, 100) * current.weight;
  }, 0) / totalWeight;
  const inertiaPenalty = candidate.signals.some((signal) => apparatus.currents.some((current) => current.opposedSignals.includes(signal)))
    ? apparatus.inertia * 0.08
    : 0;
  return clamp(support - inertiaPenalty, 0, 100);
}

export function evaluateStrategicAction(state: WorldState, candidate: StrategicActionCandidate): StrategicActionEvaluation {
  const country = state.countries[candidate.actorId];
  const profile = state.decisionProfiles[candidate.actorId];
  if (!country || !profile) throw new Error(`Profil décisionnel manquant pour ${candidate.actorId}.`);
  const objectiveScore = weightedOutcome(candidate, nationalWeights);
  const governingScore = weightedOutcome(candidate, profile.criterionWeights);
  const compatibility = doctrineCompatibility(country.politics.doctrine, candidate.doctrine);
  const leaderScore = leadershipDisposition(state, candidate, compatibility);
  const apparatusScore = apparatusSupport(state, candidate);
  const pathway = evaluatePoliticalPathway(state, candidate.actorId, {
    requiredAuthority: candidate.requiredAuthority, doctrine: candidate.doctrine ?? {},
    publicSalience: candidate.publicSalience, administrativeComplexity: candidate.administrativeComplexity,
  });
  const pathwayBase = { direct: 100, legislative: 78, negotiable: 58, blocked: 24, rupture: 8 }[pathway.status];
  const institutionalFeasibility = clamp(pathwayBase * 0.58 + pathway.administrativeFeasibility * 0.42, 0, 100);
  const reasons: string[] = [
    `Intérêt matériel estimé : ${round(objectiveScore)}`,
    `Compatibilité avec les priorités du pouvoir : ${round(governingScore)}`,
    `Disposition de la direction effective : ${round(leaderScore)}`,
    `Soutien de l’appareil politique : ${round(apparatusScore)}`,
  ];
  const constraintResults: StrategicActionEvaluation['constraints'] = [];
  let constraintPenalty = 0;
  let blocked = pathway.status === 'blocked';
  if (pathway.status === 'blocked') reasons.push('Les institutions ne permettent pas actuellement de mettre en œuvre cette action.');
  if (pathway.status === 'rupture' && !candidate.metadata?.allowRupture) {
    blocked = true;
    reasons.push('L’action supposerait une rupture politique non assumée par le gouvernement.');
  }
  for (const constraint of profile.constraints) {
    if (!constraint.active || !constraint.signals.some((signal) => candidate.signals.includes(signal))) continue;
    let overridden = false;
    let appliedPenalty = constraint.penalty;
    if (constraint.level === 'preference') appliedPenalty *= 1 - candidate.urgency / 250;
    if (constraint.level === 'taboo' && candidate.urgency >= constraint.overridePressure) {
      overridden = true;
      appliedPenalty *= 0.3;
      reasons.push(`Le tabou « ${constraint.label} » est partiellement levé par l’urgence.`);
    } else if (constraint.level === 'taboo') {
      reasons.push(`Tabou politique actif : ${constraint.label}.`);
    }
    if (constraint.level === 'red_line') {
      const ruptureAccepted = candidate.metadata?.allowRupture === true;
      blocked = blocked || !ruptureAccepted;
      overridden = ruptureAccepted;
      if (ruptureAccepted) appliedPenalty *= 0.65;
      reasons.push(ruptureAccepted
        ? `La ligne rouge « ${constraint.label} » ne peut être franchie qu’au prix d’une rupture assumée.`
        : `Ligne rouge : ${constraint.label}.`);
    }
    constraintPenalty += appliedPenalty;
    constraintResults.push({ id: constraint.id, level: constraint.level, appliedPenalty: round(appliedPenalty), overridden });
  }
  const riskPenalty = candidate.risk * (100 - profile.riskTolerance) / 100 * 0.38;
  const capacityPenalty = candidate.resourceCost * (110 - profile.adaptability) / 100 * 0.2;
  const doctrineContribution = (compatibility - 50) * 0.18;
  const institutionContribution = (institutionalFeasibility - 50) * 0.22;
  const finalScore = governingScore * 0.34 + objectiveScore * 0.16 + leaderScore * 0.14 + apparatusScore * 0.12
    + doctrineContribution + institutionContribution
    + candidate.urgency * 0.13 - riskPenalty - capacityPenalty - constraintPenalty;
  if (riskPenalty >= 12) reasons.push('Le risque dépasse la tolérance habituelle du pouvoir.');
  if (constraintPenalty > 0) reasons.push(`Coût politique des préférences et interdits : ${round(constraintPenalty)}.`);
  return {
    candidateId: candidate.id, objectiveScore: round(objectiveScore), governingScore: round(governingScore),
    doctrineCompatibility: round(compatibility), institutionalFeasibility: round(institutionalFeasibility),
    leaderDisposition: round(leaderScore), apparatusSupport: round(apparatusScore),
    finalScore: round(finalScore), blocked, reasons, constraints: constraintResults,
  };
}

export function rankStrategicActions(state: WorldState, candidates: StrategicActionCandidate[]) {
  return candidates
    .map((candidate) => ({ candidate, evaluation: evaluateStrategicAction(state, candidate) }))
    .sort((a, b) => b.evaluation.finalScore - a.evaluation.finalScore);
}

/**
 * Le pouvoir choisit parmi les solutions qu’il juge suffisantes. Le tirage est
 * déterministe pour la sauvegarde, mais évite que tous les États prennent toujours
 * l’option mathématiquement première.
 */
export function selectStrategicAction(state: WorldState, candidates: StrategicActionCandidate[], salt: string = state.currentDate) {
  if (!candidates.length) return null;
  const profile = state.decisionProfiles[candidates[0].actorId];
  const ranked = rankStrategicActions(state, candidates);
  const eligible = ranked.filter((item) => !item.evaluation.blocked && item.evaluation.finalScore >= profile.satisficingThreshold);
  if (!eligible.length) return null;
  const best = eligible[0].evaluation.finalScore;
  const shortlist = eligible.filter((item) => item.evaluation.finalScore >= best - 22).slice(0, 4);
  const temperature = Math.max(2, profile.choiceNoise);
  const weighted = shortlist.map((item) => ({ item, weight: Math.exp((item.evaluation.finalScore - best) / temperature) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = seededUnit(state.seed, `${salt}:${candidates[0].actorId}:${candidates.map((item) => item.id).join('|')}`) * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.item;
  }
  return weighted[weighted.length - 1].item;
}
