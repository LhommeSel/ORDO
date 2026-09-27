import { capacityLoad } from './capacity-system';
import type {
  ActionGovernmentCapacityAssessment,
  CommonActionCategory,
  CountryId,
  GovernmentCapacityDimensionId,
  WorldState,
} from './types';
import { activeStructuralModifiers, structuralCapacityDeltas, structuralModifierActionImpact } from './structural-modifiers';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export type GovernmentCapacityBand = 'fragile' | 'limited' | 'functional' | 'strong' | 'very_strong';

export type GovernmentCapacityDimension = {
  id: GovernmentCapacityDimensionId;
  label: string;
  score: number;
  summary: string;
  drivers: string[];
  improvementLevers: string[];
};

export type GovernmentCapacitySnapshot = {
  countryId: CountryId;
  score: number;
  band: GovernmentCapacityBand;
  dimensions: Record<GovernmentCapacityDimensionId, GovernmentCapacityDimension>;
};

const dimensionMeta: Record<GovernmentCapacityDimensionId, Pick<GovernmentCapacityDimension, 'label' | 'summary' | 'improvementLevers'>> = {
  executiveSteering: {
    label: 'Coordination gouvernementale',
    summary: 'Capacité à fixer des priorités cohérentes et à arbitrer rapidement entre services.',
    improvementLevers: ['Réorganiser le gouvernement', 'Réduire la surcharge de pilotage', 'Stabiliser la majorité'],
  },
  administrativeDelivery: {
    label: 'Exécution administrative',
    summary: 'Capacité des administrations à transformer une décision en mesures appliquées.',
    improvementLevers: ['Moderniser l’administration', 'Former et équiper les services', 'Limiter les programmes simultanés'],
  },
  fiscalCapacity: {
    label: 'Capacité fiscale',
    summary: 'Capacité à lever, sécuriser et engager durablement des ressources publiques.',
    improvementLevers: ['Renforcer les recettes', 'Restaurer la crédibilité budgétaire', 'Réduire le stress financier'],
  },
  territorialReach: {
    label: 'Maîtrise territoriale',
    summary: 'Capacité à faire appliquer une politique sur le territoire et à y acheminer des moyens.',
    improvementLevers: ['Investir dans les infrastructures', 'Renforcer les services déconcentrés', 'Sécuriser les zones fragiles'],
  },
  informationExpertise: {
    label: 'Information et expertise',
    summary: 'Qualité de l’information, des compétences et de l’anticipation disponibles pour décider.',
    improvementLevers: ['Développer l’expertise publique', 'Améliorer les systèmes d’information', 'Renforcer le renseignement'],
  },
  integrityControl: {
    label: 'Intégrité et contrôle',
    summary: 'Capacité à limiter détournements, capture locale et pertes entre la décision et son effet.',
    improvementLevers: ['Renforcer les contrôles internes', 'Auditer les nœuds à risque', 'Lutter contre la corruption'],
  },
};

const actionWeights: Record<CommonActionCategory, Record<GovernmentCapacityDimensionId, number>> = {
  diplomacy: { executiveSteering: 0.34, administrativeDelivery: 0.12, fiscalCapacity: 0.05, territorialReach: 0.04, informationExpertise: 0.34, integrityControl: 0.11 },
  economic: { executiveSteering: 0.16, administrativeDelivery: 0.25, fiscalCapacity: 0.28, territorialReach: 0.15, informationExpertise: 0.11, integrityControl: 0.05 },
  institutional: { executiveSteering: 0.23, administrativeDelivery: 0.29, fiscalCapacity: 0.08, territorialReach: 0.16, informationExpertise: 0.08, integrityControl: 0.16 },
  defense: { executiveSteering: 0.22, administrativeDelivery: 0.18, fiscalCapacity: 0.17, territorialReach: 0.20, informationExpertise: 0.16, integrityControl: 0.07 },
  intelligence: { executiveSteering: 0.12, administrativeDelivery: 0.15, fiscalCapacity: 0.07, territorialReach: 0.14, informationExpertise: 0.42, integrityControl: 0.10 },
};

function weighted(values: Array<[number, number]>) {
  const total = values.reduce((sum, [, weight]) => sum + weight, 0);
  return total ? values.reduce((sum, [value, weight]) => sum + value * weight, 0) / total : 50;
}

function bandFor(score: number): GovernmentCapacityBand {
  if (score < 35) return 'fragile';
  if (score < 50) return 'limited';
  if (score < 65) return 'functional';
  if (score < 80) return 'strong';
  return 'very_strong';
}

function dimension(id: GovernmentCapacityDimensionId, score: number, drivers: string[]): GovernmentCapacityDimension {
  return { id, ...dimensionMeta[id], score: round(clamp(score)), drivers };
}

/**
 * Produit une lecture structurelle à partir des données déjà souveraines du
 * moteur. Rien n'est persisté : une réforme, une crise ou une surcharge se
 * répercute donc sans dupliquer 196 fiches ni faire diverger les sauvegardes.
 */
export function governmentCapacitySnapshot(state: WorldState, countryId = state.playerCountryId): GovernmentCapacitySnapshot {
  const country = state.countries[countryId];
  if (!country) throw new Error(`État inconnu pour les capacités gouvernementales : ${countryId}`);
  const macro = state.macroEconomies[countryId];
  const structural = state.structuralProfiles[countryId];
  const leadership = state.leadership[countryId];

  const stability = clamp(country.metrics.stability);
  const security = clamp(country.metrics.security);
  const compliance = clamp(country.politics.administrativeCompliance);
  const approval = clamp(country.politics.publicApproval);
  const governmentEfficiency = capacityLoad(country.capacities.government).efficiencyPct;
  const administrationEfficiency = capacityLoad(country.capacities.administration).efficiencyPct;
  const economyEfficiency = capacityLoad(country.capacities.economy).efficiencyPct;
  const intelligenceEfficiency = capacityLoad(country.capacities.intelligence).efficiencyPct;
  const majorityRatio = country.politics.legislatureSeats > 0
    ? clamp(country.politics.governingSeats / country.politics.legislatureSeats * 100)
    : 55;

  const sovereignPorts = Object.values(state.territorial?.assets ?? {}).filter((asset) => {
    const territory = state.territorial.territories[asset.territoryId];
    return asset.kind === 'port' && Boolean(asset.portProfile) && territory?.sovereignCountryId === countryId;
  });
  const portReach = sovereignPorts.length
    ? sovereignPorts.reduce((sum, asset) => sum + (asset.portProfile?.nationalReach ?? 5) * 10, 0) / sovereignPorts.length
    : structural?.infrastructureQuality ?? 50;
  const portIntegrity = sovereignPorts.length
    ? 100 - sovereignPorts.reduce((sum, asset) => sum + (asset.portProfile?.governanceRisk ?? 5) * 10, 0) / sovereignPorts.length
    : compliance;

  const agencies = Object.values(state.intelligenceServices?.[countryId]?.agencies ?? {});
  const intelligenceQuality = agencies.length
    ? agencies.reduce((sum, agency) => sum + agency.technicalLevel * 0.55 + agency.readiness * 0.45, 0) / agencies.length
    : intelligenceEfficiency * 0.7 + country.statisticalReliability * 0.3;
  const structuralDeltas = structuralCapacityDeltas(state, countryId);
  const structuralDrivers = activeStructuralModifiers(state, countryId).map((modifier) => `${modifier.label} · ${Math.round(modifier.intensity)}/100`);

  const executiveScore = weighted([
    [leadership?.executiveCoordination ?? compliance, 0.28], [governmentEfficiency, 0.22],
    [stability, 0.18], [majorityRatio, 0.17], [approval, 0.15],
  ]) + (structuralDeltas.executiveSteering ?? 0);
  const administrativeScore = weighted([
    [compliance, 0.35], [administrationEfficiency, 0.25],
    [structural?.infrastructureQuality ?? 50, 0.20], [macro?.humanCapitalIndex ?? 50, 0.20],
  ]) + (structuralDeltas.administrativeDelivery ?? 0);
  const fiscalScore = weighted([
    [macro?.sovereignDebt.fiscalCredibilityPct ?? 50, 0.25],
    [clamp(((macro?.publicRevenuePctGdp ?? 25) - 10) * 2.5), 0.18],
    [structural?.financialResilience ?? 50, 0.18], [100 - (macro?.financialStress ?? 50), 0.14],
    [macro?.confidenceIndex ?? 50, 0.13], [economyEfficiency, 0.12],
  ]) + (structuralDeltas.fiscalCapacity ?? 0);
  const reachScore = weighted([
    [structural?.infrastructureQuality ?? 50, 0.34], [compliance, 0.22], [portReach, 0.14],
    [security, 0.16], [stability, 0.14],
  ]) + (structuralDeltas.territorialReach ?? 0);
  const informationScore = weighted([
    [country.statisticalReliability, 0.27], [macro?.humanCapitalIndex ?? 50, 0.23],
    [structural?.innovationCapacity ?? 50, 0.17], [intelligenceQuality, 0.23], [intelligenceEfficiency, 0.10],
  ]) + (structuralDeltas.informationExpertise ?? 0);
  const integrityScore = weighted([
    [compliance, 0.34], [portIntegrity, 0.18], [stability, 0.16], [security, 0.14],
    [country.statisticalReliability, 0.08], [administrationEfficiency, 0.10],
  ]) + (structuralDeltas.integrityControl ?? 0);

  const dimensions = {
    executiveSteering: dimension('executiveSteering', executiveScore, [
      `Coordination exécutive ${Math.round(leadership?.executiveCoordination ?? compliance)}/100`,
      `Majorité ou assise institutionnelle ${Math.round(majorityRatio)}/100`,
      `Charge de coordination : efficacité ${Math.round(governmentEfficiency)} %`,
      ...structuralDrivers,
    ]),
    administrativeDelivery: dimension('administrativeDelivery', administrativeScore, [
      `Conformité administrative ${Math.round(compliance)}/100`,
      `Infrastructures ${Math.round(structural?.infrastructureQuality ?? 50)}/100`,
      `Charge administrative : efficacité ${Math.round(administrationEfficiency)} %`,
      ...structuralDrivers,
    ]),
    fiscalCapacity: dimension('fiscalCapacity', fiscalScore, [
      `Recettes publiques ${round(macro?.publicRevenuePctGdp ?? 0)} % du PIB`,
      `Crédibilité budgétaire ${Math.round(macro?.sovereignDebt.fiscalCredibilityPct ?? 50)}/100`,
      `Stress financier ${Math.round(macro?.financialStress ?? 50)}/100`,
      ...structuralDrivers,
    ]),
    territorialReach: dimension('territorialReach', reachScore, [
      `Qualité des infrastructures ${Math.round(structural?.infrastructureQuality ?? 50)}/100`,
      `Sécurité intérieure ${Math.round(security)}/100`,
      sovereignPorts.length ? `Desserte moyenne des ports ${round(portReach / 10)}/10` : 'Desserte estimée depuis le profil national',
      ...structuralDrivers,
    ]),
    informationExpertise: dimension('informationExpertise', informationScore, [
      `Capital humain ${Math.round(macro?.humanCapitalIndex ?? 50)}/100`,
      `Qualité des systèmes d’information ${Math.round(country.statisticalReliability)}/100`,
      `Renseignement et anticipation ${Math.round(intelligenceQuality)}/100`,
      ...structuralDrivers,
    ]),
    integrityControl: dimension('integrityControl', integrityScore, [
      `Conformité des services ${Math.round(compliance)}/100`,
      sovereignPorts.length ? `Intégrité moyenne des ports ${Math.round(portIntegrity)}/100` : 'Contrôle territorial estimé depuis l’administration',
      `Stabilité institutionnelle ${Math.round(stability)}/100`,
      ...structuralDrivers,
    ]),
  } satisfies Record<GovernmentCapacityDimensionId, GovernmentCapacityDimension>;

  const score = round(weighted([
    [dimensions.executiveSteering.score, 0.20], [dimensions.administrativeDelivery.score, 0.21],
    [dimensions.fiscalCapacity.score, 0.17], [dimensions.territorialReach.score, 0.16],
    [dimensions.informationExpertise.score, 0.15], [dimensions.integrityControl.score, 0.11],
  ]));
  return { countryId, score, band: bandFor(score), dimensions };
}

/** Calibre une action sans jamais l'interdire : la faiblesse produit du délai, du coût et du risque. */
export function assessGovernmentCapacityForAction(
  state: WorldState,
  countryId: CountryId,
  category: CommonActionCategory,
  administrativeComplexity = 50,
): ActionGovernmentCapacityAssessment {
  const snapshot = governmentCapacitySnapshot(state, countryId);
  const weights = actionWeights[category];
  const entries = Object.entries(weights) as Array<[GovernmentCapacityDimensionId, number]>;
  const score = round(weighted(entries.map(([id, weight]) => [snapshot.dimensions[id].score, weight])));
  const complexityFactor = 0.72 + clamp(administrativeComplexity) / 210;
  const pressure = (60 - score) / 100;
  const structuralImpact = structuralModifierActionImpact(state, countryId, category);
  const durationMultiplier = round(clamp((1 + pressure * 0.72 * complexityFactor) * (1 + structuralImpact.durationPct / 100), 0.82, 1.5), 2);
  const budgetMultiplier = round(clamp((1 + pressure * 0.42 * complexityFactor) * (1 + structuralImpact.budgetPct / 100), 0.88, 1.35), 2);
  const successModifier = round(clamp((score - 60) * 0.24 * complexityFactor + structuralImpact.successModifier, -15, 10), 1);
  const limitingDimension = entries.filter(([, weight]) => weight >= 0.12)
    .sort(([a], [b]) => snapshot.dimensions[a].score - snapshot.dimensions[b].score)[0]?.[0];
  return {
    evaluatedAt: state.currentDate,
    score,
    dimensions: Object.fromEntries(entries.map(([id]) => [id, snapshot.dimensions[id].score])),
    durationMultiplier,
    budgetMultiplier,
    successModifier,
    limitingDimension,
    structuralModifierIds: structuralImpact.modifierIds,
    structuralModifierEffects: {
      durationPct: structuralImpact.durationPct,
      budgetPct: structuralImpact.budgetPct,
      successModifier: structuralImpact.successModifier,
    },
  };
}

export function governmentCapacityDimensionLabel(id: GovernmentCapacityDimensionId) {
  return dimensionMeta[id].label;
}
