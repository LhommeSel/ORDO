import { commitWorldAction } from '../ledger';
import { actionIntentFromProgram } from '../action-intents';
import { actionLeverPolitics, actionLeverProfile, actionLeverProfiles } from '../action-levers';
import { evaluateStrategicAction } from '../decision-making';
import { evaluatePoliticalPathway } from '../politics';
import { stakeholderReactionEffects } from '../stakeholders';
import type { ActionProgram, CommonActionCategory, CommonActionLever, CountryId, WorldEffect, WorldState } from '../types';

export type AutonomousProgramInput = {
  actorId: CountryId;
  targetIds: CountryId[];
  linkedDossierId?: string;
  category: CommonActionCategory;
  lever?: CommonActionLever;
  objective: string;
  operation?: 'contact' | 'cooperation' | 'defense_pact' | 'mediation' | 'information_sharing';
};

export type QueuedAutonomousProgram = {
  state: WorldState;
  program: ActionProgram;
  overloaded: boolean;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function addMonths(date: `${number}-${number}-${number}`, months: number): `${number}-${number}-${number}` {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as `${number}-${number}-${number}`;
}

function leverFor(input: AutonomousProgramInput): CommonActionLever {
  if (input.category !== 'diplomacy' || !input.operation) return input.lever ?? actionLeverProfile(input.category, input.objective).lever;
  const byOperation: Record<NonNullable<AutonomousProgramInput['operation']>, CommonActionLever> = {
    contact: 'diplomatic_contact', cooperation: 'diplomatic_cooperation', defense_pact: 'defense_pact',
    mediation: 'mediation', information_sharing: 'information_sharing',
  };
  return byOperation[input.operation];
}

function effectsFor(state: WorldState, input: AutonomousProgramInput, lever: CommonActionLever): { success: WorldEffect[]; partial: WorldEffect[] } {
  const targetId = input.targetIds[0];
  const success: WorldEffect[] = [];
  const partial: WorldEffect[] = [];
  if (input.category === 'diplomacy' && targetId) {
    success.push({ kind: 'relation_delta', from: input.actorId, to: targetId, relation: 4, trust: 3, reason: 'Le programme autonome améliore progressivement le canal bilatéral.' });
    partial.push({ kind: 'relation_delta', from: input.actorId, to: targetId, relation: 1, trust: 1, reason: 'Le programme autonome établit un contact limité.' });
  } else if (input.category === 'economic') {
    if (lever === 'fiscal_stimulus') {
      success.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { fiscalStance: 9, publicInvestmentPctGdp: 0.2 }, reason: 'Le gouvernement étranger engage une relance budgétaire.' });
      partial.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { fiscalStance: 3 }, reason: 'La relance étrangère reste limitée.' });
    } else if (lever === 'fiscal_consolidation') {
      success.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { fiscalStance: -9 }, reason: 'Le gouvernement étranger resserre sa politique budgétaire.' });
      partial.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { fiscalStance: -3 }, reason: 'La consolidation étrangère reste limitée.' });
    } else if (lever === 'trade_promotion') {
      success.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { tradeOpenness: 2 }, reason: 'Le dispositif autonome améliore les débouchés commerciaux.' });
      partial.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { tradeOpenness: 0.6 }, reason: 'Quelques débouchés commerciaux sont ouverts.' });
      if (targetId) success.push({ kind: 'relation_delta', from: input.actorId, to: targetId, relation: 2, trust: 1, reason: 'Le rapprochement commercial soutient le canal bilatéral.' });
    } else if (lever === 'energy_resilience') {
      success.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { publicInvestmentPctGdp: 0.12, industrialSupport: 1 }, reason: 'Le pays investit dans sa résilience énergétique sans créer artificiellement de stock.' });
      partial.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { publicInvestmentPctGdp: 0.04 }, reason: 'Une partie des infrastructures énergétiques est engagée.' });
    } else if (lever === 'strategic_sector') {
      const objective = input.objective.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
      const sectorName = /semi.?conduct|puce/.test(objective) ? 'semiconductors'
        : /nucleaire/.test(objective) ? 'nuclear'
          : /armement|defense/.test(objective) ? 'defense' : undefined;
      const sector = sectorName && Object.values(state.sectors).find((candidate) => candidate.countryId === input.actorId && candidate.sector === sectorName);
      success.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { industrialSupport: 2 }, reason: 'Le pays concentre son soutien sur une filière stratégique.' });
      partial.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { industrialSupport: 0.6 }, reason: 'La politique de filière reste incomplète.' });
      if (sector) success.push({ kind: 'sector_delta', sectorId: sector.id, delta: { capacity: 3, health: 2, technology: 1 }, reason: `La filière ${sector.sector} gagne en capacité.` });
    } else if (lever === 'industrial_capacity') {
      success.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'industry', delta: 1.2, reason: 'Le programme autonome développe l’activité productive.' });
      partial.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'industry', delta: 0.35, reason: 'Le programme autonome produit un soutien industriel partiel.' });
    } else {
      success.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { fiscalStance: 2 }, reason: 'Le programme économique autonome produit une impulsion modérée.' });
      partial.push({ kind: 'macro_policy_delta', countryId: input.actorId, patch: { fiscalStance: 0.5 }, reason: 'L’impulsion économique reste marginale.' });
    }
  } else if (input.category === 'institutional') {
    const domain = lever === 'government_reorganization' ? 'government' : 'administration';
    success.push({ kind: 'capacity_maximum', countryId: input.actorId, domain, delta: lever === 'anti_corruption' ? 1.2 : 2, reason: 'La réforme autonome augmente une capacité institutionnelle concrète.' });
    partial.push({ kind: 'capacity_maximum', countryId: input.actorId, domain, delta: 0.5, reason: 'La réforme autonome reste partielle.' });
  } else if (input.category === 'defense') {
    const defenseSector = Object.values(state.sectors).find((candidate) => candidate.countryId === input.actorId && candidate.sector === 'defense');
    if (lever === 'defense_industry' && defenseSector) {
      success.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { capacity: 3, health: 2 }, reason: 'Le pays renforce sa base industrielle de défense.' });
      partial.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { health: 0.7 }, reason: 'La filière de défense est légèrement consolidée.' });
    } else {
      success.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'security', delta: lever === 'force_readiness' ? 2 : 1.2, reason: 'Le programme autonome améliore une composante de la préparation militaire.' });
      partial.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'security', delta: 0.4, reason: 'La préparation de défense progresse partiellement.' });
      if (lever === 'defense_procurement' && defenseSector) success.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { workloadMonths: 8 }, reason: 'La commande alimente le carnet industriel national.' });
    }
  } else if (input.category === 'intelligence' && targetId) {
    success.push({ kind: 'intelligence_delta', observerId: input.actorId, targetId, delta: 6, reason: 'Le programme autonome améliore la connaissance de l’interlocuteur.' });
    partial.push({ kind: 'intelligence_delta', observerId: input.actorId, targetId, delta: 2, reason: 'Le recueil autonome fournit quelques indications.' });
  }
  return { success, partial };
}

/** Construit un programme autonome sans laisser le modèle injecter d’effets. */
export function queueAutonomousProgram(state: WorldState, input: AutonomousProgramInput, id: string): QueuedAutonomousProgram | null {
  const actor = state.countries[input.actorId];
  if (!actor || input.actorId === state.playerCountryId || !input.objective.trim()) return null;
  const targetIds = [...new Set(input.targetIds)].filter((id) => Boolean(state.countries[id]) && id !== input.actorId).slice(0, 3);
  if ((input.category === 'diplomacy' || input.category === 'intelligence') && targetIds.length === 0) return null;
  const lever = leverFor(input);
  const profile = actionLeverProfiles[lever];
  if (profile.category !== input.category) return null;
  const politicalProfile = actionLeverPolitics[lever];
  const actionKind = input.category === 'diplomacy' ? 'diplomatic' : input.category === 'defense' ? 'defense' : input.category === 'intelligence' ? 'intelligence' : input.category === 'institutional' ? 'institutional' : 'economic';
  const pathway = evaluatePoliticalPathway(state, input.actorId, {
    requiredAuthority: politicalProfile.requiredAuthority,
    doctrine: politicalProfile.doctrine,
    publicSalience: politicalProfile.publicSalience,
    administrativeComplexity: politicalProfile.administrativeComplexity,
  });
  const evaluation = evaluateStrategicAction(state, {
    id: `${id}-political-evaluation`, actorId: input.actorId, label: profile.label, kind: actionKind,
    outcomes: politicalProfile.outcomes, signals: politicalProfile.decisionSignals, doctrine: politicalProfile.doctrine,
    requiredAuthority: politicalProfile.requiredAuthority, publicSalience: politicalProfile.publicSalience,
    administrativeComplexity: politicalProfile.administrativeComplexity, urgency: politicalProfile.urgency,
    risk: politicalProfile.risk, resourceCost: clamp(profile.budgetCost * 5),
    metadata: { timeHorizonYears: profile.durationMonths / 12 },
  });
  // Le LLM propose ; l'appareil d'État décide si cette proposition est même
  // exécutable. Une ligne rouge nationale ne devient pas caduque parce que le
  // modèle a formulé une idée matériellement avantageuse.
  if (evaluation.blocked || evaluation.finalScore < state.decisionProfiles[input.actorId].satisficingThreshold) return null;
  const requiredCapacities = profile.requiredCapacities.map(({ domain, commitment }) => ({ domain, commitment: Math.max(1, Math.round(commitment * 0.7)) }));
  const overloaded = requiredCapacities.some(({ domain, commitment }) => actor.capacities[domain].committed + commitment > actor.capacities[domain].maximum);
  const politicalModifier = (evaluation.leaderDisposition - 50) * 0.08
    + (evaluation.apparatusSupport - 50) * 0.1
    + (evaluation.institutionalFeasibility - 50) * 0.12;
  const probability = Math.round(clamp(66 + profile.difficultyModifier + politicalModifier + (actor.politics.administrativeCompliance - 50) * 0.2 - (overloaded ? 18 : 0), 20, 88));
  const effects = effectsFor(state, { ...input, targetIds }, lever);
  const durationMonths = profile.durationMonths;
  const budgetCost = Number((profile.budgetCost * 0.75).toFixed(1));
  const program: ActionProgram = {
    id,
    category: input.category,
    lever,
    actorId: input.actorId,
    targetIds,
    ...(input.linkedDossierId ? { linkedDossierId: input.linkedDossierId } : {}),
    title: `${profile.label} · ${actor.name}`,
    intent: input.objective.trim().slice(0, 600),
    startedAt: state.currentDate,
    expectedCompletionAt: addMonths(state.currentDate, durationMonths),
    durationMonths,
    progressMonths: 0,
    status: 'active',
    requiredCapacities,
    budgetCost,
    successProbability: probability,
    risks: [overloaded ? 'Les capacités engagées dépassent temporairement les moyens disponibles.' : 'Les oppositions internes et les aléas extérieurs peuvent ralentir le programme.'],
    policySignals: [
      ...politicalProfile.policySignals,
      ...(lever === 'energy_resilience' && /\b(gaz|pétrole|petrole|fossile)\b/i.test(input.objective)
        ? [{ signal: 'fossil_expansion' as const, weight: 0.65 }] : []),
    ],
    politicalAssessment: {
      pathwayStatus: pathway.status,
      doctrineCompatibility: evaluation.doctrineCompatibility,
      institutionalFeasibility: evaluation.institutionalFeasibility,
      leaderDisposition: evaluation.leaderDisposition,
      apparatusSupport: evaluation.apparatusSupport,
      finalScore: evaluation.finalScore,
      blocked: evaluation.blocked,
      reasons: evaluation.reasons.slice(0, 6),
    },
    successEffects: effects.success,
    partialEffects: effects.partial,
    intentSpec: actionIntentFromProgram({ actorId: input.actorId, targetIds, category: input.category, lever, intent: input.objective }, 'ai', input.operation),
  };
  return {
    state: commitWorldAction(state, {
      kind: actionKind,
      actorId: input.actorId,
      targetIds,
      origin: 'ai',
      visibility: 'player',
      intent: `Mettre en file : ${program.title}`,
      effects: [
        { kind: 'action_program_add', program, reason: 'Une intention autonome validée par le moteur devient un programme suivi.' },
        { kind: 'metric_delta', countryId: input.actorId, metric: 'budget', delta: -budgetCost, reason: 'Le gouvernement réserve les crédits du programme autonome.' },
        ...requiredCapacities.map(({ domain, commitment }) => ({ kind: 'capacity_commitment' as const, countryId: input.actorId, domain, delta: commitment, reason: `Moyens mobilisés pour « ${program.title} ».` })),
        ...(program.policySignals?.length ? stakeholderReactionEffects(state, {
          id: `measure-${program.id}`, countryId: input.actorId, title: program.title,
          subjectId: input.linkedDossierId ?? `program:${lever}`,
          intensity: clamp(42 + budgetCost * 2, 35, 88), signals: program.policySignals, effects: [],
        }) : []),
      ],
    }),
    program,
    overloaded,
  };
}
