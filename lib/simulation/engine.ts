import { runAutonomyCycle } from './autonomy';
import { advanceCommonActionPrograms } from './action-programs';
import { runSimulationPipeline, type SimulationPhase } from './core';
import { advanceEnergySystem } from './energy';
import { advanceHistoricalAnchors, advanceHistoricalCurrents, type HistoricalManifestation } from './history';
import { advanceIndustrySystem } from './industry';
import { commitWorldAction } from './ledger';
import { advanceMacroeconomy } from './macro-economy';
import { advancePowerStruggles, detectPowerStruggleOpportunities } from './power-struggles';
import { advanceStakeholderReactions } from './stakeholders';
import { runMinorEventCycle } from './minor-events';
import { advanceDossierEscalation, advanceDossierLifecycle, advanceDossierReviewQueue } from './dossiers';
import { reactivateDossiersOnWorldSignals } from './dossiers';
import { advanceDossierEffects } from './dossier-effects';
import { compactWorldForSave } from './persistence';
import { advancePoliticalCycles } from './political-cycles';
import { advanceMilitaryTheaterAccess } from './military-theaters';
import { advanceWarZones } from './war-zones';
import { advanceOperationalCapacities } from './capacity-system';
import { summarizeTurnResolution, type TurnResolutionSummary } from './core/turn-orchestrator';
import type { ISODate, SimulationStop, WorldEffect, WorldState } from './types';

export type SimulationPhaseAudit = {
  id: string;
  chunkStart: ISODate;
  chunkEnd: ISODate;
  actionsBefore: number;
  actionsAfter: number;
  changesBefore: number;
  changesAfter: number;
};

export type SimulationAudit = {
  from: ISODate;
  to: ISODate;
  chunks: number;
  phases: SimulationPhaseAudit[];
  issues: string[];
  ok: boolean;
};

export type AdvanceResult = {
  state: WorldState;
  requestedDate: ISODate;
  reachedDate: ISODate;
  elapsedDays: number;
  elapsedMonths: number;
  stop?: SimulationStop;
  manifestations: HistoricalManifestation[];
  reviewedCountryIds: string[];
  audit: SimulationAudit;
  /** Bilan unique de la résolution locale de cette avance. */
  resolution: TurnResolutionSummary;
};

const elapsedDaysBetween = (start: ISODate, end: ISODate) => Math.max(0, Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000));
const RUNTIME_HISTORY_COMPACTION_THRESHOLD = 5_000;

function nextMonthBoundary(date: ISODate): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  return `${value.getUTCMonth() === 11 ? value.getUTCFullYear() + 1 : value.getUTCFullYear()}-${String((value.getUTCMonth() + 1) % 12 + 1).padStart(2, '0')}-01` as ISODate;
}

const implementationPhase = (progressPct: number): NonNullable<WorldState['treaties'][string]['implementation']>['phase'] =>
  progressPct >= 100 ? 'complete' : progressPct >= 50 ? 'operational' : progressPct >= 25 ? 'pilot' : 'exploration';

/** Fait progresser le volet matériel d'un traité sans créer d'actif fictif. */
function treatyImplementationEffects(state: WorldState, treaty: WorldState['treaties'][string], elapsedMonths: number): WorldEffect[] {
  const implementation = treaty.implementation;
  if (!implementation || elapsedMonths <= 0 || implementation.progressPct >= 100) return [];
  const previousProgress = implementation.progressPct;
  const progressPct = Math.min(100, Number((previousProgress + implementation.monthlyProgressPct * elapsedMonths).toFixed(1)));
  const previousMilestones = implementation.completedMilestones ?? [];
  const crossedMilestones = implementation.milestonePcts.filter((milestone) => milestone > previousProgress && milestone <= progressPct && !previousMilestones.includes(milestone));
  const completedMilestones = [...previousMilestones, ...crossedMilestones];
  const nextImplementation = { ...implementation, progressPct, phase: implementationPhase(progressPct), completedMilestones };
  const effects: WorldEffect[] = [{
    kind: 'treaty_patch', treatyId: treaty.id, patch: { implementation: nextImplementation },
    reason: `Mise en œuvre de « ${treaty.label} » : ${progressPct}% (${nextImplementation.phase}).`, visibility: 'player',
  }];

  if (implementation.kind === 'energy_framework' && progressPct >= 25) {
    for (const nodeId of implementation.energyNodeIds) {
      const node = state.energyNodes[nodeId];
      if (!node || !(previousProgress < 50 && progressPct >= 50)) continue;
      effects.push({
        kind: 'energy_node_patch', nodeId,
        patch: {
          annualCapacity: Number(Math.min(node.provenReserves, node.annualCapacity + Math.max(0.01, node.annualCapacity * 0.005)).toFixed(3)),
          infrastructure: [...node.infrastructure, `cadre-cooperation:${treaty.id}`],
        },
        reason: `Le volet énergétique de « ${treaty.label} » ouvre une capacité déjà identifiée dans le registre.`, visibility: 'player',
      });
    }
  }
  if (implementation.kind === 'industrial_transfer' && progressPct >= 25) {
    for (const sectorId of implementation.sectorIds) if (state.sectors[sectorId]) effects.push({
      kind: 'sector_delta', sectorId,
      delta: { health: 0.06 * elapsedMonths, technology: 0.04 * elapsedMonths, foreignDependency: -0.03 * elapsedMonths },
      reason: `Le transfert industriel de « ${treaty.label} » consolide progressivement une filière existante.`, visibility: 'player',
    });
  }
  if (implementation.kind === 'maritime_security' && progressPct >= 25) {
    for (const theaterId of implementation.militaryTheaterIds) {
      const theater = state.militaryTheaters[theaterId];
      if (!theater) continue;
      effects.push({
        kind: 'military_theater_patch', theaterId,
        patch: { readiness: theater.readiness + 0.15 * elapsedMonths, supplyCoverageMonths: theater.supplyCoverageMonths + 0.01 * elapsedMonths },
        reason: `La coopération de sécurité de « ${treaty.label} » améliore la préparation du théâtre existant.`, visibility: 'player',
      });
    }
  }
  if (implementation.kind === 'defense_support' && progressPct >= 25) {
    for (const productId of implementation.armamentProductIds) {
      const product = state.armamentProducts[productId];
      if (!product) continue;
      effects.push({
        kind: 'armament_patch', productId,
        patch: { industrialHealth: Math.min(100, Number((product.industrialHealth + 0.1 * elapsedMonths).toFixed(2))) },
        reason: `Le soutien de défense de « ${treaty.label} » sécurise le carnet d'un produit existant.`, visibility: 'player',
      });
    }
  }
  if (implementation.dossierId && state.strategicDossiers[implementation.dossierId]) {
    const dossier = state.strategicDossiers[implementation.dossierId];
    for (const milestone of crossedMilestones) effects.push({
      kind: 'dossier_entry_add', dossierId: dossier.id,
      entry: {
        id: `treaty-milestone-${treaty.id}-${milestone}`,
        date: state.currentDate,
        title: `Jalon de mise en œuvre atteint · ${milestone}%`,
        summary: `Le volet ${implementation.kind.replaceAll('_', ' ')} de l’accord « ${treaty.label} » atteint ${milestone}%. ${implementation.note}`,
        importance: dossier.importance, actorIds: treaty.parties, requiresDecision: false, visibility: 'player',
      },
      reason: 'Un jalon matériel de l’accord est ajouté à la chronologie du dossier.', visibility: 'player',
    });
  }
  return effects;
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
    effects.push(...treatyImplementationEffects(next, treaty, elapsedMonths));
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
    { id: 'military-access', advance: (state, context) => context.reachedMonthBoundary ? advanceMilitaryTheaterAccess(state) : state },
    { id: 'institutions', advance: (state, context) => advanceInstitutions(state, context.elapsedMonths) },
    { id: 'common-actions', advance: (state, context) => advanceCommonActionPrograms(state, context.elapsedMonths) },
    // La charge institutionnelle est recalculée après les programmes : elle
    // prend en compte les engagements du mois avant la mise à jour macro.
    { id: 'operational-capacities', advance: (state, context) => context.reachedMonthBoundary ? advanceOperationalCapacities(state, context.elapsedMonths) : state },
    { id: 'political-cycles', advance: (state, context) => context.reachedMonthBoundary ? advancePoliticalCycles(state) : state },
    { id: 'dossier-escalation', advance: (state, context) => context.reachedMonthBoundary ? advanceDossierEscalation(state) : state },
    { id: 'dossier-lifecycle', advance: (state, context) => context.reachedMonthBoundary ? advanceDossierLifecycle(state) : state },
    { id: 'dossier-review-queue', advance: (state, context) => context.reachedMonthBoundary ? advanceDossierReviewQueue(state) : state },
    { id: 'stakeholders', advance: (state, context) => advanceStakeholderReactions(state, context.elapsedMonths) },
    { id: 'power-opportunities', advance: (state) => detectPowerStruggleOpportunities(state) },
    { id: 'power-struggles', advance: (state, context) => advancePowerStruggles(state, context.elapsedMonths) },
    { id: 'energy', advance: (state, context) => advanceEnergySystem(state, context.elapsedMonths) },
    { id: 'industry', advance: (state, context) => advanceIndustrySystem(state, context.elapsedMonths) },
    {
      id: 'historical-anchors',
      advance: (state, context) => {
        const anchors = advanceHistoricalAnchors(state, context.elapsedMonths, context.chunkEnd);
        // Les candidats sont persistés dans les ancrages et exposés au pouls
        // IA via collectFacts. Aucune manifestation n’est forcée localement.
        return anchors.state;
      },
    },
    {
      id: 'history',
      advance: (state, context) => {
        const historical = advanceHistoricalCurrents(state, context.elapsedMonths, context.chunkEnd);
        manifestations.push(...historical.manifestations);
        return historical.state;
      },
    },
    // Les dossiers actifs alimentent d'abord les canaux de transmission ; le
    // macro-modèle les absorbe ensuite pendant la même frontière mensuelle.
    { id: 'dossier-effects', advance: (state, context) => context.reachedMonthBoundary ? advanceDossierEffects(state) : state },
    // Les conflits actifs disposent d'une maille dédiée : ils ne sont pas
    // relégués derrière la rotation des événements secondaires.
    { id: 'war-zones', advance: (state, context) => context.reachedMonthBoundary ? advanceWarZones(state) : state },
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
    {
      id: 'dossier-signals',
      advance: (state, context) => reactivateDossiersOnWorldSignals(state, context.actionStartIndex ?? state.actions.length),
    },
  ];
}

export function advanceWorld(
  state: WorldState,
  requestedDate: ISODate,
  stops: SimulationStop[] = [],
): AdvanceResult {
  if (requestedDate <= state.currentDate) {
    return {
      state, requestedDate, reachedDate: state.currentDate, elapsedDays: 0, elapsedMonths: 0, manifestations: [], reviewedCountryIds: [],
      audit: { from: state.currentDate, to: state.currentDate, chunks: 0, phases: [], issues: [], ok: true },
      resolution: summarizeTurnResolution(state, state, requestedDate, state.currentDate, []),
    };
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
  // Les actions du joueur écrites avant le clic d’avance doivent pouvoir
  // réveiller un dossier endormi. Les frontières mensuelles suivantes ne
  // réutilisent pas ce segment initial pour éviter une double activation.
  const preAdvanceActionStartIndex = state.actions.map((action) => action.kind).lastIndexOf('time_advance') + 1;
  const phaseAudit: SimulationPhaseAudit[] = [];
  const auditedPhases = phases.map((phase) => ({
    id: phase.id,
    advance: (phaseState: WorldState, context: Parameters<typeof phase.advance>[1]) => {
      const actionsBefore = phaseState.actions.length;
      const changesBefore = phaseState.ledger.length;
      const nextState = phase.advance(phaseState, context);
      phaseAudit.push({ id: phase.id, chunkStart: context.chunkStart, chunkEnd: context.chunkEnd, actionsBefore, actionsAfter: nextState.actions.length, changesBefore, changesAfter: nextState.ledger.length });
      return nextState;
    },
  }));
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
      actionStartIndex: cursor === state.currentDate ? preAdvanceActionStartIndex : next.actions.length,
    }, auditedPhases);
    // Une longue avance ne doit pas recopier plusieurs dizaines de milliers
    // d’écritures techniques à chaque action. Les décisions, événements et
    // une queue technique restent conservés ; seul l’historique froid est
    // compacté, comme lors d’une sauvegarde manuelle.
    if (next.actions.length > RUNTIME_HISTORY_COMPACTION_THRESHOLD) next = compactWorldForSave(next);
    cursor = chunkEnd;
  }
  const issues: string[] = [];
  if (next.currentDate !== reachedDate) issues.push(`La date atteinte (${next.currentDate}) ne correspond pas à la date de fin attendue (${reachedDate}).`);
  if (next.actions.some((action, index) => next.actions.findIndex((candidate) => candidate.id === action.id) !== index)) issues.push('Le journal contient un identifiant d’action dupliqué.');
  if (next.ledger.some((change, index) => next.ledger.findIndex((candidate) => candidate.id === change.id) !== index)) issues.push('Le registre causal contient un identifiant dupliqué.');
  if (next.actions.some((action) => action.status !== 'applied')) issues.push('Une action de la simulation n’est pas dans l’état appliqué.');
  if (Object.values(next.actionPrograms).some((program) => program.progressMonths < 0 || program.progressMonths > program.durationMonths)) issues.push('Un programme sort de ses bornes de progression.');
  const audit: SimulationAudit = { from: state.currentDate, to: reachedDate, chunks: phaseAudit.length ? new Set(phaseAudit.map((item) => `${item.chunkStart}:${item.chunkEnd}`)).size : 0, phases: phaseAudit, issues, ok: issues.length === 0 };
  return {
    state: next, requestedDate, reachedDate, elapsedDays, elapsedMonths, stop,
    manifestations,
    reviewedCountryIds,
    audit,
    resolution: summarizeTurnResolution(state, next, requestedDate, reachedDate, phaseAudit.map((phase) => phase.id)),
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
