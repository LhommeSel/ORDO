import { commitWorldAction } from './ledger';
import { capacityLoad } from './capacity-system';
import type {
  CommonActionCategory,
  CountryId,
  CountryState,
  GovernmentCapacityDimensionId,
  ISODate,
  StrategicDossier,
  StructuralModifierEffects,
  StructuralModifierState,
  StructuralSignalId,
  StructuralModifierTrigger,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export type StructuralModifierActionImpact = {
  durationPct: number;
  budgetPct: number;
  successModifier: number;
  capacityDeltas: Partial<Record<GovernmentCapacityDimensionId, number>>;
  modifierIds: string[];
  explanations: string[];
};

const emptyImpact = (): StructuralModifierActionImpact => ({
  durationPct: 0,
  budgetPct: 0,
  successModifier: 0,
  capacityDeltas: {},
  modifierIds: [],
  explanations: [],
});

function countryEnergyImportDependency(state: WorldState, countryId: CountryId) {
  const energy = state.countryEnergy[countryId];
  if (!energy) return 0;
  const demand = energy.annualDemand.oil + energy.annualDemand.gas;
  if (demand <= 0) return 0;
  const imports = Math.max(0, energy.annualDemand.oil - energy.domesticProduction.oil)
    + Math.max(0, energy.annualDemand.gas - energy.domesticProduction.gas);
  return clamp(imports / demand * 100);
}

function logisticsPressure(state: WorldState, countryId: CountryId) {
  const industrialInputs = Object.values(state.sectors).find((sector) => (
    sector.countryId === countryId && sector.sector === 'industrial_inputs'
  ));
  if (!industrialInputs) return 0;
  const workload = clamp(industrialInputs.workloadMonths / 36 * 100);
  return round(clamp(
    (100 - industrialInputs.health) * 0.45
    + industrialInputs.utilization * 0.3
    + workload * 0.25,
  ));
}

function energySupplyPressure(state: WorldState, countryId: CountryId) {
  const dependency = countryEnergyImportDependency(state, countryId);
  const oil = state.worldEconomy.oilMarket;
  const marketStress = Math.max(0, oil.priceIndex - 112) * 0.8
    + oil.disruptionRisk * 0.7
    + state.worldEconomy.activeShocks
      .filter((shock) => shock.channel === 'energy')
      .reduce((sum, shock) => sum + shock.intensity * 0.4, 0);
  return round(clamp(dependency * 0.2 + marketStress));
}

/**
 * Les signaux restent des lectures déterministes de l'état existant. Un seuil
 * ne crée donc jamais une ressource ni une crise par magie : il ne fait que
 * rendre plus visible une contrainte déjà présente.
 */
export function structuralSignalValue(state: WorldState, countryId: CountryId, signal: StructuralSignalId) {
  const country = state.countries[countryId];
  if (!country) return 0;
  const macro = state.macroEconomies[countryId];
  if (signal === 'public_approval') return clamp(country.politics.publicApproval);
  if (signal === 'unemployment') return clamp(macro?.unemploymentPct ?? 0);
  if (signal === 'inflation') return clamp(macro?.inflationAnnualPct ?? 0);
  if (signal === 'financial_stress') return clamp(macro?.financialStress ?? 0);
  if (signal === 'energy_import_dependency') return countryEnergyImportDependency(state, countryId);
  if (signal === 'energy_supply_pressure') return energySupplyPressure(state, countryId);
  if (signal === 'logistics_pressure') return logisticsPressure(state, countryId);
  if (signal === 'security') return clamp(country.metrics.security);
  if (signal === 'stability') return clamp(country.metrics.stability);
  if (signal === 'administrative_load') {
    const capacity = country.capacities.administration;
    return capacity.maximum > 0 ? clamp(capacity.committed / capacity.maximum * 100) : 100;
  }
  const loads = ['government', 'administration', 'economy'].map((domain) => {
    const entry = country.capacities[domain as 'government' | 'administration' | 'economy'];
    return capacityLoad(entry).efficiencyPct;
  });
  return clamp(loads.reduce((sum, value) => sum + value, 0) / loads.length);
}

function triggerActive(state: WorldState, countryId: CountryId, trigger: StructuralModifierTrigger) {
  const signal = structuralSignalValue(state, countryId, trigger.signal);
  return trigger.operator === 'above' ? signal >= trigger.threshold : signal <= trigger.threshold;
}

function transitionFor(previous: StructuralModifierState, intensity: number, active: boolean): StructuralModifierState['lastTransition'] {
  if (!previous.active && active) return 'activated';
  if (previous.active && !active) return 'deactivated';
  if (active && intensity > previous.intensity + 1) return 'intensified';
  if (active && intensity < previous.intensity - 1) return 'eased';
  return undefined;
}

export function evaluateStructuralModifier(state: WorldState, modifier: StructuralModifierState) {
  const activeTriggers = modifier.triggers.filter((trigger) => triggerActive(state, modifier.countryId, trigger));
  const intensity = round(clamp(modifier.baselineIntensity + activeTriggers.reduce((sum, trigger) => sum + trigger.adjustment, 0)));
  // Hystérésis légère pour ne pas faire clignoter un seuil autour de sa valeur.
  const activationFloor = modifier.active ? 18 : 20;
  const active = intensity >= activationFloor;
  return { intensity, active, activeTriggers };
}

export function structuralModifiersFor(state: WorldState, countryId = state.playerCountryId) {
  return state.structuralModifiers?.[countryId] ?? [];
}

export function activeStructuralModifiers(state: WorldState, countryId = state.playerCountryId) {
  return structuralModifiersFor(state, countryId).filter((modifier) => modifier.active);
}

export function structuralCapacityDeltas(state: WorldState, countryId = state.playerCountryId) {
  const deltas: Partial<Record<GovernmentCapacityDimensionId, number>> = {};
  for (const modifier of activeStructuralModifiers(state, countryId)) {
    const scale = modifier.intensity / 100;
    for (const [dimension, value] of Object.entries(modifier.effects.capacityDeltas ?? {})) {
      const key = dimension as GovernmentCapacityDimensionId;
      deltas[key] = (deltas[key] ?? 0) + (value ?? 0) * scale;
    }
  }
  return Object.fromEntries(Object.entries(deltas).map(([key, value]) => [key, round(value ?? 0)])) as Partial<Record<GovernmentCapacityDimensionId, number>>;
}

export function structuralModifierActionImpact(
  state: WorldState,
  countryId: CountryId,
  category: CommonActionCategory,
): StructuralModifierActionImpact {
  const impact = emptyImpact();
  for (const modifier of activeStructuralModifiers(state, countryId)) {
    if (!modifier.appliesTo.includes(category)) continue;
    const scale = modifier.intensity / 100;
    impact.modifierIds.push(modifier.id);
    impact.durationPct += (modifier.effects.actionDurationPct ?? 0) * scale;
    impact.budgetPct += (modifier.effects.actionBudgetPct ?? 0) * scale;
    impact.successModifier += (modifier.effects.actionSuccessModifier ?? 0) * scale;
    for (const [dimension, value] of Object.entries(modifier.effects.capacityDeltas ?? {})) {
      const key = dimension as GovernmentCapacityDimensionId;
      impact.capacityDeltas[key] = (impact.capacityDeltas[key] ?? 0) + (value ?? 0) * scale;
    }
    impact.explanations.push(`${modifier.label} (${Math.round(modifier.intensity)}/100) : ${modifier.summary}`);
  }
  impact.durationPct = round(clamp(impact.durationPct, -15, 35));
  impact.budgetPct = round(clamp(impact.budgetPct, -10, 30));
  impact.successModifier = round(clamp(impact.successModifier, -15, 12));
  return impact;
}

export function structuralModifierTriggerLabels(state: WorldState, modifier: StructuralModifierState) {
  return modifier.triggers.map((trigger) => `${trigger.label} · seuil ${trigger.operator === 'above' ? '≥' : '≤'} ${trigger.threshold}`
    + ` · actuel ${round(structuralSignalValue(state, modifier.countryId, trigger.signal))}`);
}

const crisisDossierId = (countryId: CountryId, modifierId: string) => `national-crisis-${countryId.toLowerCase()}-${modifierId}`;

function crisisTitle(modifier: StructuralModifierState, country: CountryState) {
  const label = modifier.id.startsWith('social-tension')
    ? 'Crise sociale'
    : modifier.id.startsWith('financial-instability')
      ? 'Instabilité financière'
      : modifier.id.startsWith('logistics-disruption')
        ? 'Dysfonctionnement logistique'
        : 'Tension d’approvisionnement énergétique';
  return `${label} · ${country.name}`;
}

function canOpenCrisisDossier(state: WorldState, countryId: CountryId, intensity: number) {
  const country = state.countries[countryId];
  return countryId === state.playerCountryId || country.weight >= 70 || intensity >= 75;
}

function crisisDossier(
  state: WorldState,
  countryId: CountryId,
  modifier: StructuralModifierState,
  intensity: number,
): StrategicDossier {
  const country = state.countries[countryId];
  const importance = intensity >= 75 ? 'major' as const : 'moderate' as const;
  const visibility = countryId === state.playerCountryId ? 'player' as const : 'public' as const;
  const title = crisisTitle(modifier, country);
  return {
    id: crisisDossierId(countryId, modifier.id),
    title,
    kind: modifier.category === 'social' ? 'political_transition' : 'economic',
    status: 'active',
    importance,
    scope: countryId === state.playerCountryId ? 'national' : 'world',
    actorIds: [countryId],
    regionTags: [],
    startedAt: state.currentDate,
    updatedAt: state.currentDate,
    phase: 'Crise déclarée · réponse à déterminer',
    trend: 'escalating',
    publicSummary: `${modifier.label} atteint un niveau de crise. ${modifier.summary}`,
    followed: countryId === state.playerCountryId,
    autoTracked: countryId === state.playerCountryId,
    commitments: [],
    pendingDecisions: [],
    relatedCurrentIds: [],
    relatedActionIds: [],
    entries: [{
      id: `${crisisDossierId(countryId, modifier.id)}-opening`,
      date: state.currentDate,
      title: 'Seuil de crise franchi',
      summary: `${modifier.label} passe d’une tension surveillée à une crise. ${modifier.summary}`,
      importance,
      actorIds: [countryId],
      requiresDecision: countryId === state.playerCountryId,
      visibility,
    }],
  };
}

function crisisDossierEffects(
  state: WorldState,
  countryId: CountryId,
  modifier: StructuralModifierState,
  intensity: number,
): WorldEffect[] {
  const dossierId = crisisDossierId(countryId, modifier.id);
  const existing = state.strategicDossiers[dossierId];
  const isCrisis = intensity >= 50;
  const enteredCrisis = modifier.intensity < 50 && isCrisis;
  const leftCrisis = modifier.intensity >= 50 && !isCrisis;
  const visibility = countryId === state.playerCountryId ? 'player' as const : 'public' as const;
  const importance = intensity >= 75 ? 'major' as const : 'moderate' as const;
  if (enteredCrisis && !existing && canOpenCrisisDossier(state, countryId, intensity)) return [{
    kind: 'dossier_add', dossier: crisisDossier(state, countryId, modifier, intensity),
    reason: `Une tension nationale franchit le niveau de crise dans ${state.countries[countryId].name}.`, visibility,
  }];
  if (isCrisis && existing) return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { status: 'active', importance, phase: 'Crise en cours · réponse à déterminer', trend: 'escalating', updatedAt: state.currentDate },
      reason: `La crise nationale reste active dans ${state.countries[countryId].name}.`, visibility,
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${dossierId}-${state.currentDate}-${intensity}`,
        date: state.currentDate,
        title: 'Situation réévaluée',
        summary: `${modifier.label} demeure au niveau de crise. Les autorités doivent mesurer les effets sur les décisions en cours.`,
        importance, actorIds: [countryId], requiresDecision: false, visibility,
      },
      reason: 'La chronologie conserve l’évolution significative de la crise.', visibility,
    },
  ];
  if (leftCrisis && existing && existing.status === 'active') return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { status: 'deescalating', phase: 'Tension retombée · surveillance', trend: 'deescalating', updatedAt: state.currentDate },
      reason: `Les facteurs de crise se relâchent dans ${state.countries[countryId].name}.`, visibility,
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${dossierId}-easing-${state.currentDate}`,
        date: state.currentDate,
        title: 'Retour sous le seuil de crise',
        summary: `${modifier.label} demeure surveillée, mais ne constitue plus une crise ouverte.`,
        importance: existing.importance, actorIds: [countryId], requiresDecision: false, visibility,
      },
      reason: 'La baisse de la tension est inscrite dans la chronologie du dossier.', visibility,
    },
  ];
  return [];
}

/** Met à jour les tensions nationales à partir des signaux déjà simulés.
 * Une tension ne devient un dossier qu’au stade de crise : les signaux faibles
 * restent lisibles sans encombrer la carte ni la liste des dossiers. */
export function advanceStructuralModifiers(state: WorldState): WorldState {
  if (!state.structuralModifiers) return state;
  const effects: WorldEffect[] = [];
  const changedCountries = new Set<CountryId>();
  for (const [countryId, modifiers] of Object.entries(state.structuralModifiers)) {
    for (const modifier of modifiers) {
      const evaluated = evaluateStructuralModifier(state, modifier);
      const transition = transitionFor(modifier, evaluated.intensity, evaluated.active);
      if (Math.abs(evaluated.intensity - modifier.intensity) < 3 && evaluated.active === modifier.active) continue;
      const reason = transition === 'activated'
        ? `Une tension nationale s’active : « ${modifier.label} ».`
        : transition === 'deactivated'
          ? `La tension nationale « ${modifier.label} » retombe sous le niveau de surveillance.`
          : `La situation nationale fait évoluer « ${modifier.label} ».`;
      effects.push({
        kind: 'structural_modifier_patch',
        countryId,
        modifierId: modifier.id,
        patch: { intensity: evaluated.intensity, active: evaluated.active, lastUpdatedAt: state.currentDate, lastTransition: transition },
        reason,
        visibility: countryId === state.playerCountryId ? 'player' : 'public',
      });
      effects.push(...crisisDossierEffects(state, countryId, modifier, evaluated.intensity));
      changedCountries.add(countryId);
    }
  }
  return effects.length ? commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId, targetIds: [...changedCountries], origin: 'time', visibility: 'public',
    intent: 'Réévaluer les tensions nationales et les seuils de crise', effects,
  }) : state;
}

type NationalRiskDefinition = {
  id: string;
  label: string;
  category: StructuralModifierState['category'];
  summary: string;
  triggers: Array<Omit<StructuralModifierTrigger, 'id'>>;
  effects: StructuralModifierEffects;
  appliesTo: CommonActionCategory[];
};

const nationalRiskDefinitions: NationalRiskDefinition[] = [
  {
    id: 'social-tension', label: 'Tension sociale', category: 'social',
    summary: 'La combinaison du chômage, de l’inflation et de la défiance publique peut ralentir les réformes et, à un niveau élevé, ouvrir une crise sociale.',
    triggers: [
      { signal: 'unemployment', operator: 'above', threshold: 12, adjustment: 30, label: 'Chômage élevé', explanation: 'Le chômage fragilise les revenus et élargit le mécontentement.' },
      { signal: 'unemployment', operator: 'above', threshold: 18, adjustment: 25, label: 'Chômage très élevé', explanation: 'Un chômage durablement très élevé peut faire basculer une tension en crise ouverte.' },
      { signal: 'inflation', operator: 'above', threshold: 10, adjustment: 24, label: 'Inflation élevée', explanation: 'La hausse durable des prix fragilise le pouvoir d’achat.' },
      { signal: 'public_approval', operator: 'below', threshold: 40, adjustment: 24, label: 'Confiance publique basse', explanation: 'Une confiance politique dégradée réduit la capacité à faire accepter les arbitrages.' },
    ],
    effects: { capacityDeltas: { executiveSteering: -2, administrativeDelivery: -1 }, actionDurationPct: 6, actionSuccessModifier: -3 },
    appliesTo: ['economic', 'institutional'],
  },
  {
    id: 'financial-instability', label: 'Instabilité financière', category: 'economic',
    summary: 'Une tension de refinancement et de crédit réduit la marge budgétaire et peut devenir une crise financière nationale.',
    triggers: [
      { signal: 'financial_stress', operator: 'above', threshold: 65, adjustment: 30, label: 'Stress financier élevé', explanation: 'Le crédit et le refinancement deviennent plus difficiles.' },
      { signal: 'financial_stress', operator: 'above', threshold: 80, adjustment: 25, label: 'Stress financier critique', explanation: 'Le système financier entre dans une zone de forte instabilité.' },
    ],
    effects: { capacityDeltas: { fiscalCapacity: -5 }, actionBudgetPct: 8, actionSuccessModifier: -3 },
    appliesTo: ['economic', 'institutional'],
  },
  {
    id: 'logistics-disruption', label: 'Dysfonctionnement logistique', category: 'economic',
    summary: 'La saturation des intrants, la charge industrielle et la fragilité des chaînes d’approvisionnement peuvent ralentir les opérations économiques et militaires.',
    triggers: [
      { signal: 'logistics_pressure', operator: 'above', threshold: 65, adjustment: 30, label: 'Chaînes d’approvisionnement sous tension', explanation: 'La capacité des filières et leur charge ne permettent plus d’absorber facilement de nouveaux engagements.' },
      { signal: 'logistics_pressure', operator: 'above', threshold: 82, adjustment: 25, label: 'Saturation logistique critique', explanation: 'La désorganisation matérielle risque d’affecter les opérations en cours.' },
    ],
    effects: { capacityDeltas: { administrativeDelivery: -2, territorialReach: -2 }, actionDurationPct: 10, actionBudgetPct: 5, actionSuccessModifier: -2 },
    appliesTo: ['economic', 'defense'],
  },
  {
    id: 'energy-supply', label: 'Tension d’approvisionnement énergétique', category: 'strategic',
    summary: 'La dépendance aux importations devient une contrainte de crise lorsque le marché énergétique mondial se tend ou qu’une rupture d’offre apparaît.',
    triggers: [
      { signal: 'energy_supply_pressure', operator: 'above', threshold: 55, adjustment: 30, label: 'Marché énergétique sous tension', explanation: 'Les importateurs exposés subissent davantage la hausse des prix et le risque de rupture.' },
      { signal: 'energy_supply_pressure', operator: 'above', threshold: 75, adjustment: 25, label: 'Risque de rupture énergétique', explanation: 'La contrainte d’approvisionnement peut désormais perturber l’activité économique et militaire.' },
    ],
    effects: { capacityDeltas: { fiscalCapacity: -2, territorialReach: -1 }, actionBudgetPct: 4, actionSuccessModifier: -2 },
    appliesTo: ['economic', 'defense'],
  },
];

function nationalRiskModifier(country: CountryState, definition: NationalRiskDefinition, now: ISODate): StructuralModifierState {
  return {
    id: `${definition.id}-${country.id.toLowerCase()}`,
    countryId: country.id,
    label: definition.label,
    category: definition.category,
    summary: definition.summary,
    baselineIntensity: 0,
    intensity: 0,
    active: false,
    triggers: definition.triggers.map((trigger, index) => ({ ...trigger, id: `${definition.id}-${country.id.toLowerCase()}-${index + 1}` })),
    effects: definition.effects,
    appliesTo: definition.appliesTo,
    source: `Tension nationale calculée depuis les données économiques, politiques et matérielles de ${country.id}`,
    lastUpdatedAt: now,
  };
}

/** Les mêmes risques existent dans chaque pays. Les différences viennent des
 * données et de leur évolution, pas d’un bonus culturel arbitraire. */
export function createStructuralModifiers2000(
  countries: Record<CountryId, CountryState>,
  now: ISODate = '2000-01-01',
) {
  return Object.fromEntries(Object.values(countries).map((country) => [country.id,
    nationalRiskDefinitions.map((definition) => nationalRiskModifier(country, definition, now)),
  ])) as Record<CountryId, StructuralModifierState[]>;
}

/** Initialise les tensions sans créer de dossier rétroactif au lancement.
 * Seule une aggravation ultérieure au niveau de crise devient une actualité. */
export function initializeStructuralModifiers(state: WorldState): WorldState {
  const templates = createStructuralModifiers2000(state.countries, state.currentDate);
  const draft = { ...state, structuralModifiers: templates };
  return {
    ...draft,
    structuralModifiers: Object.fromEntries(Object.entries(templates).map(([countryId, modifiers]) => [countryId,
      modifiers.map((modifier) => {
        const evaluated = evaluateStructuralModifier(draft, modifier);
        return { ...modifier, intensity: evaluated.intensity, active: evaluated.active };
      }),
    ])) as Record<CountryId, StructuralModifierState[]>,
  };
}
