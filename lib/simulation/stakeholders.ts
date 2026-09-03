import { commitWorldAction } from './ledger';
import type {
  GovernmentMeasure,
  ReactionLevel,
  ReactionTrend,
  StakeholderInfluenceChannel,
  StakeholderReaction,
  WorldEffect,
  WorldState,
} from './types';

export type PrototypeMeasureId = 'defense_cuts' | 'labor_restrictions' | 'capital_controls';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(2));

export const reactionLevelLabels: Record<ReactionLevel, string> = {
  low: 'faible', moderate: 'modérée', important: 'importante', critical: 'critique',
};

export const reactionTrendLabels: Record<ReactionTrend, string> = {
  falling: 'en diminution', stable: 'stable', rising: 'en augmentation', rising_fast: 'en augmentation rapide',
};

/** Les marges évitent qu'un niveau clignote autour d'un seuil. */
export function qualitativeReactionLevel(value: number, previous?: ReactionLevel): ReactionLevel {
  if (previous === 'critical' && value >= 70) return 'critical';
  if (previous === 'important' && value >= 46 && value < 79) return 'important';
  if (previous === 'moderate' && value >= 21 && value < 54) return 'moderate';
  if (previous === 'low' && value < 29) return 'low';
  return value >= 75 ? 'critical' : value >= 50 ? 'important' : value >= 25 ? 'moderate' : 'low';
}

function trendForDelta(delta: number): ReactionTrend {
  return delta >= 14 ? 'rising_fast' : delta >= 4 ? 'rising' : delta <= -4 ? 'falling' : 'stable';
}

function consequenceCount(level: ReactionLevel) {
  return level === 'critical' ? 3 : level === 'important' ? 2 : 1;
}

function reactionEffects(state: WorldState, measure: GovernmentMeasure): WorldEffect[] {
  const effects: WorldEffect[] = [];
  for (const group of Object.values(state.stakeholderGroups).filter((item) => item.countryId === measure.countryId)) {
    const sensitivity = measure.signals.reduce((total, item) =>
      total + (group.sensitivities[item.signal] ?? 0) * item.weight, 0);
    const delta = round(measure.intensity * sensitivity * 0.45);
    if (Math.abs(delta) < 2) continue;

    const reactionId = `${group.id}:${measure.subjectId}`;
    const current = state.stakeholderReactions[reactionId];
    if (!current && delta <= 0) continue;
    const defiance = round(clamp((current?.defiance ?? group.baselineDefiance) + delta));
    const mobilization = round(clamp((current?.mobilization ?? 18) + delta * 0.62));
    const level = qualitativeReactionLevel(defiance, current?.level);
    const causes = [...new Set([measure.title, ...(current?.causes ?? [])])].slice(0, 4);
    const likelyConsequences = group.possibleResponses.slice(0, consequenceCount(level));
    if (current) {
      effects.push({
        kind: 'stakeholder_reaction_patch', reactionId,
        patch: {
          defiance, mobilization, level, trend: trendForDelta(delta), causes, likelyConsequences,
          relatedMeasureIds: [...new Set([...current.relatedMeasureIds, measure.id])],
          updatedAt: state.currentDate, status: 'active',
        },
        reason: `${group.label} réévalue sa position après « ${measure.title} ».`, visibility: 'player',
      });
    } else {
      const reaction: StakeholderReaction = {
        id: reactionId, countryId: measure.countryId, groupId: group.id,
        targetId: measure.countryId, subjectId: measure.subjectId,
        label: `Défiance de ${group.label.toLocaleLowerCase('fr')}`,
        defiance, mobilization, level, trend: trendForDelta(delta), causes, likelyConsequences,
        relatedMeasureIds: [measure.id], createdAt: state.currentDate, updatedAt: state.currentDate,
        decayPerMonth: group.category === 'military' ? 0.7 : group.category === 'administration' ? 1.1 : 1.5,
        status: 'active', visibility: group.category === 'military' || group.category === 'administration' ? 'internal' : 'public',
      };
      effects.push({
        kind: 'stakeholder_reaction_add', reaction,
        reason: `Une réaction organisée apparaît après « ${measure.title} ».`, visibility: 'player',
      });
    }
  }
  return effects;
}

export function prototypeGovernmentMeasure(state: WorldState, measureId: PrototypeMeasureId): GovernmentMeasure {
  const countryId = state.playerCountryId;
  const id = `${measureId}-${state.currentDate}-${state.sequence + 1}`;
  if (measureId === 'defense_cuts') return {
    id, countryId, title: 'Réduction accélérée des crédits militaires',
    subjectId: 'government-course', intensity: 72,
    signals: [{ signal: 'defense_cuts', weight: 1 }, { signal: 'austerity', weight: 0.25 }],
    effects: [
      { kind: 'metric_delta', countryId, metric: 'budget', delta: 3, reason: 'Les crédits militaires libèrent une marge budgétaire immédiate.' },
      { kind: 'metric_delta', countryId, metric: 'security', delta: -1, reason: 'La préparation militaire absorbe la réduction des crédits.' },
    ],
  };
  if (measureId === 'labor_restrictions') return {
    id, countryId, title: 'Encadrement renforcé du droit de grève',
    subjectId: 'government-course', intensity: 68,
    signals: [{ signal: 'labor_deregulation', weight: 1 }, { signal: 'administrative_reorganization', weight: 0.15 }],
    effects: [{ kind: 'metric_delta', countryId, metric: 'stability', delta: -0.8, reason: 'La réforme accroît temporairement la conflictualité sociale.' }],
  };
  return {
    id, countryId, title: 'Encadrement administratif des sorties de capitaux',
    subjectId: 'government-course', intensity: 66,
    signals: [{ signal: 'capital_controls', weight: 1 }, { signal: 'administrative_reorganization', weight: 0.2 }],
    effects: [{ kind: 'metric_delta', countryId, metric: 'budget', delta: -0.5, reason: 'Le nouveau contrôle mobilise des moyens administratifs et financiers.' }],
  };
}

export function enactPrototypeGovernmentMeasure(state: WorldState, measureId: PrototypeMeasureId) {
  const measure = prototypeGovernmentMeasure(state, measureId);
  return commitWorldAction(state, {
    kind: 'political', actorId: measure.countryId, origin: 'player',
    intent: measure.title,
    effects: [...measure.effects, ...reactionEffects(state, measure)],
    metadata: { measureId: measure.id, subjectId: measure.subjectId, signals: measure.signals },
  });
}

export function advanceStakeholderReactions(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  const effects: WorldEffect[] = [];
  for (const reaction of Object.values(state.stakeholderReactions)) {
    if (reaction.status === 'resolved') continue;
    const group = state.stakeholderGroups[reaction.groupId];
    if (!group) continue;
    const defiance = round(Math.max(group.baselineDefiance, reaction.defiance - reaction.decayPerMonth * elapsedMonths));
    const mobilization = round(Math.max(10, reaction.mobilization - reaction.decayPerMonth * 0.7 * elapsedMonths));
    const level = qualitativeReactionLevel(defiance, reaction.level);
    const resolved = defiance <= group.baselineDefiance + 0.5 && mobilization <= 10.5;
    effects.push({
      kind: 'stakeholder_reaction_patch', reactionId: reaction.id,
      patch: {
        defiance, mobilization, level, trend: defiance < reaction.defiance ? 'falling' : 'stable',
        updatedAt: state.currentDate, status: resolved ? 'resolved' : level === 'low' ? 'subsiding' : 'active',
      },
      reason: resolved ? 'La réaction organisée est revenue à son niveau ordinaire.' : 'Sans nouveau déclencheur, la réaction s’use progressivement.',
      visibility: 'debug',
    });
  }
  if (!effects.length) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId, origin: 'local_rule',
    intent: 'Actualiser les réactions des corps organisés', visibility: 'debug', effects,
  });
}

export function stakeholderPressureByChannel(
  state: WorldState,
  countryId: string,
  channel: StakeholderInfluenceChannel,
) {
  let pressure = 0;
  for (const reaction of Object.values(state.stakeholderReactions)) {
    if (reaction.countryId !== countryId || reaction.status === 'resolved') continue;
    const group = state.stakeholderGroups[reaction.groupId];
    if (!group?.influenceChannels.includes(channel)) continue;
    pressure += reaction.defiance
      * (0.35 + reaction.mobilization / 180)
      * (0.4 + group.influence / 170)
      * (0.5 + group.cohesion / 220);
  }
  return round(clamp(pressure));
}

export function visibleStakeholderReactions(state: WorldState, countryId = state.playerCountryId) {
  return Object.values(state.stakeholderReactions)
    .filter((reaction) => reaction.countryId === countryId && reaction.status !== 'resolved')
    .sort((a, b) => {
      const order: Record<ReactionLevel, number> = { low: 0, moderate: 1, important: 2, critical: 3 };
      return order[b.level] - order[a.level] || b.updatedAt.localeCompare(a.updatedAt);
    });
}
