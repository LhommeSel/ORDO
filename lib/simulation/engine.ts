import { runAutonomyCycle } from './autonomy';
import { advanceCommonActionPrograms } from './action-programs';
import { runSimulationPipeline, type SimulationPhase } from './core';
import { advanceEnergySystem } from './energy';
import { advanceHistoricalCurrents, type HistoricalManifestation } from './history';
import { advanceIndustrySystem } from './industry';
import { commitWorldAction } from './ledger';
import { advanceMacroeconomy } from './macro-economy';
import { advancePowerStruggles, detectPowerStruggleOpportunities } from './power-struggles';
import { advanceStakeholderReactions } from './stakeholders';
import { runMinorEventCycle } from './minor-events';
import type { ISODate, SimulationStop, WorldEffect, WorldState } from './types';

export type AdvanceResult = {
  state: WorldState;
  requestedDate: ISODate;
  reachedDate: ISODate;
  elapsedDays: number;
  elapsedMonths: number;
  stop?: SimulationStop;
  manifestations: HistoricalManifestation[];
  reviewedCountryIds: string[];
};

const elapsedDaysBetween = (start: ISODate, end: ISODate) => Math.max(0, Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000));

function nextMonthBoundary(date: ISODate): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  return `${value.getUTCMonth() === 11 ? value.getUTCFullYear() + 1 : value.getUTCFullYear()}-${String((value.getUTCMonth() + 1) % 12 + 1).padStart(2, '0')}-01` as ISODate;
}

function advanceTreaties(state: WorldState, elapsedMonths: number) {
  let next = state;
  for (const treaty of Object.values(state.treaties)) {
    if (treaty.status !== 'active') continue;
    if (treaty.endDate && treaty.endDate <= state.currentDate) {
      next = commitWorldAction(next, {
        kind: 'diplomatic', actorId: treaty.parties[0], targetIds: treaty.parties.slice(1), origin: 'time',
        intent: `Échoir l’accord ${treaty.label}`,
        effects: [{ kind: 'treaty_patch', treatyId: treaty.id, patch: { status: 'expired' }, reason: 'La durée prévue de l’accord est arrivée à échéance.', visibility: 'player' }],
      });
      continue;
    }
    const effects: WorldEffect[] = treaty.monthlyEffects.map((effect) => ({
      kind: 'metric_delta', countryId: effect.countryId, metric: effect.metric,
      delta: effect.delta * elapsedMonths,
      reason: `Effet continu du traité « ${treaty.label} ».`,
    }));
    if (effects.length) next = commitWorldAction(next, {
      kind: 'economic', actorId: treaty.parties[0], targetIds: treaty.parties.slice(1), origin: 'time',
      intent: `Appliquer les effets continus de ${treaty.label}`, effects,
    });
  }
  return next;
}

function advanceInstitutions(state: WorldState, elapsedMonths: number) {
  let next = state;
  for (const institution of Object.values(state.institutions)) {
    if (!['building', 'partial'].includes(institution.stage)) continue;
    const previous = institution.progressMonths;
    const progress = Math.min(institution.durationMonths, previous + elapsedMonths);
    const effects: WorldEffect[] = [
      { kind: 'institution_patch', institutionId: institution.id, patch: { progressMonths: progress }, reason: 'La mise en place institutionnelle progresse avec le temps.' },
      { kind: 'metric_delta', countryId: institution.countryId, metric: 'budget', delta: -0.02 * elapsedMonths, reason: 'Coût de fonctionnement pendant la montée en puissance.' },
    ];
    if (institution.id === 'prosperity-ministry' && previous < 3 && progress >= 3) {
      effects.push(
        { kind: 'institution_patch', institutionId: institution.id, patch: { stage: 'partial' }, reason: 'Le premier échelon administratif devient opérationnel.' },
        { kind: 'capacity_maximum', countryId: institution.countryId, domain: 'economy', delta: 4, reason: 'Premiers services économiques fonctionnels.' },
      );
    }
    if (institution.id === 'prosperity-ministry' && previous < 7 && progress >= 7) {
      effects.push(
        { kind: 'institution_patch', institutionId: institution.id, patch: { stage: 'operational' }, reason: 'La nouvelle institution atteint sa pleine capacité.' },
        { kind: 'capacity_maximum', countryId: institution.countryId, domain: 'economy', delta: 5, reason: 'Achèvement des recrutements et transferts de compétences.' },
        { kind: 'capacity_commitment', countryId: institution.countryId, domain: 'government', delta: -4, reason: 'La charge de transition du gouvernement est libérée.' },
        { kind: 'capacity_commitment', countryId: institution.countryId, domain: 'administration', delta: -8, reason: 'La charge administrative de transition est libérée.' },
        { kind: 'capacity_commitment', countryId: institution.countryId, domain: 'economy', delta: -3, reason: 'La charge temporaire de conception est libérée.' },
      );
    }
    next = commitWorldAction(next, {
      kind: 'institutional', actorId: institution.countryId, origin: 'time',
      intent: `Faire progresser ${institution.label}`, effects,
    });
  }
  return next;
}

function simulationPhases(
  manifestations: HistoricalManifestation[],
  reviewedCountryIds: string[],
): SimulationPhase[] {
  return [
    { id: 'treaties', advance: (state, context) => advanceTreaties(state, context.elapsedMonths) },
    { id: 'institutions', advance: (state, context) => advanceInstitutions(state, context.elapsedMonths) },
    { id: 'common-actions', advance: (state, context) => advanceCommonActionPrograms(state, context.elapsedMonths) },
    { id: 'stakeholders', advance: (state, context) => advanceStakeholderReactions(state, context.elapsedMonths) },
    { id: 'power-opportunities', advance: (state) => detectPowerStruggleOpportunities(state) },
    { id: 'power-struggles', advance: (state, context) => advancePowerStruggles(state, context.elapsedMonths) },
    { id: 'energy', advance: (state, context) => advanceEnergySystem(state, context.elapsedMonths) },
    { id: 'industry', advance: (state, context) => advanceIndustrySystem(state, context.elapsedMonths) },
    {
      id: 'history',
      advance: (state, context) => {
        const historical = advanceHistoricalCurrents(state, context.elapsedMonths, context.chunkEnd);
        manifestations.push(...historical.manifestations);
        return historical.state;
      },
    },
    { id: 'macroeconomy', advance: (state, context) => advanceMacroeconomy(state, context.elapsedMonths) },
    {
      id: 'country-autonomy',
      advance: (state, context) => {
        if (!context.reachedMonthBoundary) return state;
        const autonomy = runAutonomyCycle(state, 2);
        reviewedCountryIds.push(...autonomy.reviewedCountryIds);
        return autonomy.state;
      },
    },
    {
      id: 'minor-events',
      advance: (state, context) => {
        if (!context.reachedMonthBoundary) return state;
        return runMinorEventCycle(state, 3).state;
      },
    },
  ];
}

export function advanceWorld(
  state: WorldState,
  requestedDate: ISODate,
  stops: SimulationStop[] = [],
): AdvanceResult {
  if (requestedDate <= state.currentDate) {
    return { state, requestedDate, reachedDate: state.currentDate, elapsedDays: 0, elapsedMonths: 0, manifestations: [], reviewedCountryIds: [] };
  }
  const stop = stops
    .filter((candidate) => !state.processedStopIds.includes(candidate.id) && candidate.date > state.currentDate && candidate.date <= requestedDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const reachedDate = stop?.date ?? requestedDate;
  const elapsedDays = elapsedDaysBetween(state.currentDate, reachedDate);
  const elapsedMonths = elapsedDays / 30.4375;
  const manifestations: HistoricalManifestation[] = [];
  const reviewedCountryIds: string[] = [];
  const phases = simulationPhases(manifestations, reviewedCountryIds);
  let next = state;
  let cursor = state.currentDate;

  // Le moteur avance par frontières mensuelles. Une avance d'un an et douze
  // avances d'un mois donnent ainsi le même nombre de décisions autonomes.
  while (cursor < reachedDate) {
    const boundary = nextMonthBoundary(cursor);
    const chunkEnd = boundary < reachedDate ? boundary : reachedDate;
    const chunkDays = elapsedDaysBetween(cursor, chunkEnd);
    const chunkMonths = chunkDays / 30.4375;
    const isFinalChunk = chunkEnd === reachedDate;
    const dateEffects: WorldEffect[] = [{ kind: 'date_set', date: chunkEnd, reason: `La simulation avance de ${chunkDays} jours.` }];
    if (stop && isFinalChunk) dateEffects.push({ kind: 'processed_stop_add', stopId: stop.id, reason: `La simulation atteint le point d’arrêt « ${stop.title} ».` });
    next = commitWorldAction(next, {
      kind: 'time_advance', actorId: state.playerCountryId, origin: 'time',
      intent: `Avancer la simulation jusqu’au ${chunkEnd}`, effects: dateEffects,
    });
    next = runSimulationPipeline(next, {
      chunkStart: cursor,
      chunkEnd,
      elapsedMonths: chunkMonths,
      reachedMonthBoundary: chunkEnd === boundary,
    }, phases);
    cursor = chunkEnd;
  }
  return {
    state: next, requestedDate, reachedDate, elapsedDays, elapsedMonths, stop,
    manifestations,
    reviewedCountryIds,
  };
}

export function replayWorld(initial: WorldState, actions: WorldState['actions']) {
  return actions.reduce((state, action) => commitWorldAction(state, {
    kind: action.kind, actorId: action.actorId, targetIds: action.targetIds,
    intent: action.intent, origin: action.origin, effects: action.effects,
    ...(action.assumptions ? { assumptions: action.assumptions } : {}),
    ...(action.visibility ? { visibility: action.visibility } : {}),
    ...(action.metadata ? { metadata: action.metadata } : {}),
  }), initial);
}
