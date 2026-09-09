import { commitWorldAction } from '../ledger';
import { actionIntentFromProgram } from '../action-intents';
import type { ActionProgram, CapacityDomainId, CommonActionCategory, CountryId, WorldEffect, WorldState } from '../types';

export type AutonomousProgramInput = {
  actorId: CountryId;
  targetIds: CountryId[];
  category: CommonActionCategory;
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

function commitments(category: CommonActionCategory): Array<{ domain: CapacityDomainId; commitment: number }> {
  if (category === 'diplomacy') return [{ domain: 'diplomacy', commitment: 4 }, { domain: 'government', commitment: 2 }];
  if (category === 'economic') return [{ domain: 'economy', commitment: 5 }, { domain: 'administration', commitment: 3 }];
  if (category === 'institutional') return [{ domain: 'administration', commitment: 6 }, { domain: 'government', commitment: 4 }];
  if (category === 'defense') return [{ domain: 'defense', commitment: 6 }, { domain: 'administration', commitment: 2 }];
  return [{ domain: 'intelligence', commitment: 5 }, { domain: 'diplomacy', commitment: 2 }];
}

function duration(category: CommonActionCategory) {
  return category === 'institutional' ? 6 : category === 'economic' ? 4 : category === 'defense' ? 3 : 2;
}

function cost(category: CommonActionCategory) {
  return category === 'institutional' ? 3.2 : category === 'economic' ? 2.8 : category === 'defense' ? 3.2 : category === 'intelligence' ? 1.1 : 0.6;
}

function effectsFor(state: WorldState, input: AutonomousProgramInput): { success: WorldEffect[]; partial: WorldEffect[] } {
  const targetId = input.targetIds[0];
  const success: WorldEffect[] = [];
  const partial: WorldEffect[] = [];
  if (input.category === 'diplomacy' && targetId) {
    success.push({ kind: 'relation_delta', from: input.actorId, to: targetId, relation: 4, trust: 3, reason: 'Le programme autonome améliore progressivement le canal bilatéral.' });
    partial.push({ kind: 'relation_delta', from: input.actorId, to: targetId, relation: 1, trust: 1, reason: 'Le programme autonome établit un contact limité.' });
  } else if (input.category === 'economic') {
    success.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'industry', delta: 1.2, reason: 'Le programme autonome soutient l’activité productive.' });
    partial.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'industry', delta: 0.35, reason: 'Le programme autonome produit un soutien industriel partiel.' });
  } else if (input.category === 'institutional') {
    success.push({ kind: 'capacity_maximum', countryId: input.actorId, domain: 'administration', delta: 2, reason: 'La réforme autonome augmente la capacité administrative.' });
    partial.push({ kind: 'capacity_maximum', countryId: input.actorId, domain: 'administration', delta: 0.6, reason: 'La réforme autonome reste partielle.' });
  } else if (input.category === 'defense') {
    success.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'security', delta: 1.5, reason: 'Le programme autonome améliore la préparation de défense.' });
    partial.push({ kind: 'metric_delta', countryId: input.actorId, metric: 'security', delta: 0.4, reason: 'La préparation de défense progresse partiellement.' });
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
  const requiredCapacities = commitments(input.category);
  const overloaded = requiredCapacities.some(({ domain, commitment }) => actor.capacities[domain].committed + commitment > actor.capacities[domain].maximum);
  const probability = Math.round(clamp(66 + (actor.politics.administrativeCompliance - 50) * 0.2 - (overloaded ? 18 : 0), 25, 88));
  const effects = effectsFor(state, { ...input, targetIds });
  const durationMonths = duration(input.category);
  const budgetCost = cost(input.category);
  const program: ActionProgram = {
    id,
    category: input.category,
    actorId: input.actorId,
    targetIds,
    title: `Initiative autonome · ${input.objective.trim().slice(0, 120)}`,
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
    successEffects: effects.success,
    partialEffects: effects.partial,
    intentSpec: actionIntentFromProgram({ actorId: input.actorId, targetIds, category: input.category, intent: input.objective }, 'ai', input.operation),
  };
  return {
    state: commitWorldAction(state, {
      kind: input.category === 'diplomacy' ? 'diplomatic' : input.category === 'defense' ? 'defense' : input.category === 'intelligence' ? 'intelligence' : input.category === 'institutional' ? 'institutional' : 'economic',
      actorId: input.actorId,
      targetIds,
      origin: 'ai',
      visibility: 'player',
      intent: `Mettre en file : ${program.title}`,
      effects: [
        { kind: 'action_program_add', program, reason: 'Une intention autonome validée par le moteur devient un programme suivi.' },
        { kind: 'metric_delta', countryId: input.actorId, metric: 'budget', delta: -budgetCost, reason: 'Le gouvernement réserve les crédits du programme autonome.' },
        ...requiredCapacities.map(({ domain, commitment }) => ({ kind: 'capacity_commitment' as const, countryId: input.actorId, domain, delta: commitment, reason: `Moyens mobilisés pour « ${program.title} ».` })),
      ],
    }),
    program,
    overloaded,
  };
}
