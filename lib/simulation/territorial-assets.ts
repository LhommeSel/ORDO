import type { ActionProgram, EnergyNode, WorldEffect, WorldState } from './types';
import type { CommonActionPreparation, PreparedCommonAction } from './action-programs';
import type { TerritorialAsset, TerritorialAssetOperation, TerritorialState } from './territory-types';
import { commitWorldAction } from './ledger';
import { stakeholderReactionEffects } from './stakeholders';
import { actionLeverPolitics } from './action-levers';
import { assessGovernmentCapacityForAction } from './government-capacity';
import { fiscalBudgetAvailable } from './fiscal';
import { effectivePortGoodsCapacity } from './territory-data-americas-ports';

/**
 * Raccords explicites entre l’inventaire localisé et le registre énergétique.
 * Une installation qui n’est pas dans cette table reste un inventaire visible,
 * sans effet quantitatif sur les flux.
 */
export const territorialEnergyAssetNodeLinks: Record<string, string> = {
  'asset:FRA:paris-basin': 'fra-oil',
  'asset:FRA:lacq': 'fra-gas',
  'asset:GBR:sullom-voe': 'gbr-oil',
  'asset:GBR:bacton': 'gbr-gas',
  'asset:DNK:tyra': 'dnk-gas',
  'asset:NLD:groningen': 'nld-gas',
  'asset:NOR:ekofisk': 'nor-oil',
  'asset:NOR:troll': 'nor-gas',
  'asset:NOR:karsto': 'nor-gas',
  'asset:RUS:samotlor': 'rus-oil',
  'asset:RUS:urengoy': 'rus-gas',
  'asset:RUS:yamal-gas': 'rus-gas',
};

/** Parts de production utilisées uniquement pour ventiler un nœud agrégé. */
const territorialEnergyAssetShares: Record<string, number> = {
  'asset:NOR:troll': 0.88,
  'asset:NOR:karsto': 0.12,
  'asset:RUS:urengoy': 0.78,
  'asset:RUS:yamal-gas': 0.22,
};

/**
 * Premiers nœuds explicitement détaillés parce qu’un actif territorial existe.
 * Les volumes sont l’enveloppe de scénario 2000 déjà utilisée par `countryEnergy`;
 * ils ne changent donc pas les totaux nationaux au moment de l’activation.
 */
export const territorialEnergyNodeAdditions: Record<string, EnergyNode> = {
  'fra-oil': { id: 'fra-oil', countryId: 'FRA', resource: 'oil', label: 'Bassins pétroliers français', provenReserves: 20, probableReserves: 10, annualProduction: 2, annualCapacity: 3, domesticConsumption: 2, storageCapacity: 0, stocks: 0, extractionCost: 32, declineRate: 0.015, developmentLeadMonths: 36, infrastructure: ['Bassin parisien'] },
  'fra-gas': { id: 'fra-gas', countryId: 'FRA', resource: 'gas', label: 'Bassin gazier de Lacq', provenReserves: 25, probableReserves: 10, annualProduction: 3, annualCapacity: 4, domesticConsumption: 3, storageCapacity: 0, stocks: 0, extractionCost: 28, declineRate: 0.03, developmentLeadMonths: 30, infrastructure: ['Lacq'] },
  'gbr-oil': { id: 'gbr-oil', countryId: 'GBR', resource: 'oil', label: 'Plateau continental britannique', provenReserves: 2500, probableReserves: 900, annualProduction: 128, annualCapacity: 160, domesticConsumption: 82, storageCapacity: 20, stocks: 11, extractionCost: 18, declineRate: 0.025, developmentLeadMonths: 36, infrastructure: ['Sullom Voe', 'Terminaux de la mer du Nord'] },
  'gbr-gas': { id: 'gbr-gas', countryId: 'GBR', resource: 'gas', label: 'Système gazier britannique', provenReserves: 900, probableReserves: 320, annualProduction: 96, annualCapacity: 112, domesticConsumption: 88, storageCapacity: 8, stocks: 2, extractionCost: 16, declineRate: 0.03, developmentLeadMonths: 36, infrastructure: ['Bacton', 'Mer du Nord'] },
  'dnk-gas': { id: 'dnk-gas', countryId: 'DNK', resource: 'gas', label: 'Gisement de Tyra', provenReserves: 70, probableReserves: 25, annualProduction: 1.115, annualCapacity: 2, domesticConsumption: 1.115, storageCapacity: 0, stocks: 0, extractionCost: 22, declineRate: 0.025, developmentLeadMonths: 36, infrastructure: ['Tyra'] },
  'nld-gas': { id: 'nld-gas', countryId: 'NLD', resource: 'gas', label: 'Gisement de Groningue', provenReserves: 2800, probableReserves: 650, annualProduction: 1.296, annualCapacity: 3, domesticConsumption: 1.296, storageCapacity: 0, stocks: 0, extractionCost: 12, declineRate: 0.02, developmentLeadMonths: 30, infrastructure: ['Groningue'] },
};

const energyKinds = new Set<TerritorialAsset['kind']>([
  'nuclear', 'thermal', 'hydro', 'refinery', 'lng_terminal', 'storage', 'oil_field', 'gas_field',
]);

const fallbackProfile: Record<TerritorialAsset['kind'], { maximum: number; unit: TerritorialAssetOperation['unit']; availabilityPct: number }> = {
  nuclear: { maximum: 1_200, unit: 'MW', availabilityPct: 91 },
  thermal: { maximum: 900, unit: 'MW', availabilityPct: 86 },
  hydro: { maximum: 650, unit: 'MW', availabilityPct: 94 },
  refinery: { maximum: 8, unit: 'million_tonnes_per_year', availabilityPct: 88 },
  lng_terminal: { maximum: 10, unit: 'bcm_per_year', availabilityPct: 90 },
  storage: { maximum: 8, unit: 'bcm_per_year', availabilityPct: 92 },
  oil_field: { maximum: 8, unit: 'million_tonnes_per_year', availabilityPct: 94 },
  gas_field: { maximum: 8, unit: 'bcm_per_year', availabilityPct: 94 },
  port: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
  airport: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
  passage: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
  logistics: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
  industrial: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
  naval_base: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
  spaceport: { maximum: 0, unit: 'million_tonnes_per_year', availabilityPct: 0 },
};

function statusAvailability(asset: TerritorialAsset, baseline: number) {
  if (asset.status === 'closed') return 0;
  if (asset.status === 'damaged') return Math.min(baseline, 45);
  return baseline;
}

function linkedOperation(asset: TerritorialAsset, node: EnergyNode, share: number): TerritorialAssetOperation {
  const availabilityPct = statusAvailability(asset, 98);
  const maximum = node.annualCapacity * share;
  // Le déploiement est ajusté pour que production = déploiement × disponibilité
  // au lancement ; cela conserve le registre existant tout en rendant les
  // indisponibilités visibles et calculables.
  const deployed = Math.min(maximum, node.annualProduction * share / Math.max(0.01, availabilityPct / 100));
  return { maximum, deployed, availabilityPct, unit: node.resource === 'gas' ? 'bcm_per_year' : 'million_tonnes_per_year', resource: node.resource, ledgerNodeId: node.id };
}

function fallbackOperation(asset: TerritorialAsset): TerritorialAssetOperation | undefined {
  if (!energyKinds.has(asset.kind)) return undefined;
  const profile = fallbackProfile[asset.kind];
  if (profile.maximum <= 0) return undefined;
  const availabilityPct = statusAvailability(asset, profile.availabilityPct);
  const deployed = asset.status === 'closed' ? 0 : profile.maximum * (asset.kind === 'nuclear' ? 0.86 : 0.82);
  return {
    maximum: profile.maximum,
    deployed,
    availabilityPct,
    unit: profile.unit,
    ...(asset.kind === 'oil_field' ? { resource: 'oil' as const } : {}),
    ...(asset.kind === 'gas_field' || asset.kind === 'lng_terminal' || asset.kind === 'storage' ? { resource: 'gas' as const } : {}),
  };
}

function operationForAsset(asset: TerritorialAsset, energyNodes: Record<string, EnergyNode>): TerritorialAssetOperation | undefined {
  const nodeId = territorialEnergyAssetNodeLinks[asset.id];
  if (nodeId && energyNodes[nodeId]) return linkedOperation(asset, energyNodes[nodeId], territorialEnergyAssetShares[asset.id] ?? 1);
  return fallbackOperation(asset);
}

/** Ajoute la couche opérationnelle et les raccords de nœuds à un état initial. */
export function initializeTerritorialAssetOperations(
  territorial: TerritorialState,
  energyNodes: Record<string, EnergyNode>,
) {
  const assets = Object.fromEntries(Object.values(territorial.assets).map((asset) => {
    const operation = operationForAsset(asset, energyNodes);
    return [asset.id, operation
      ? { ...asset, capacity: { value: operation.maximum, unit: operation.unit }, operation }
      : asset];
  }));
  const linkedAssetsByNode: Record<string, string[]> = {};
  for (const asset of Object.values(assets)) {
    if (asset.operation?.ledgerNodeId) (linkedAssetsByNode[asset.operation.ledgerNodeId] ??= []).push(asset.id);
  }
  const nextEnergyNodes = Object.fromEntries(Object.entries(energyNodes).map(([id, node]) => [id, {
    ...node,
    ...(linkedAssetsByNode[id]?.length ? { territorialAssetIds: linkedAssetsByNode[id] } : {}),
  }]));
  return { territorial: { ...territorial, assets }, energyNodes: nextEnergyNodes };
}

function statusFactor(status: TerritorialAsset['status']) {
  return status === 'operating' ? 1 : status === 'damaged' ? 0.35 : 0;
}

/** Débit annuel effectif de l’actif, après disponibilité et état. */
export function assetOperationalOutput(asset: TerritorialAsset) {
  const operation = asset.operation;
  if (!operation) return 0;
  return Math.max(0, Math.min(operation.maximum, operation.deployed)) * Math.max(0, Math.min(100, operation.availabilityPct)) / 100 * statusFactor(asset.status);
}

/** Débit mensuel dérivé affichable dans l’interface. */
export function assetMonthlyOutput(asset: TerritorialAsset) {
  return assetOperationalOutput(asset) / 12;
}

/** Production effective d’un nœud : les actifs liés détaillent le nœud sans double compte. */
export function nodeOperationalProduction(state: WorldState, nodeId: string) {
  const node = state.energyNodes[nodeId];
  if (!node) return 0;
  const linked = (node.territorialAssetIds ?? []).map((id) => state.territorial.assets[id]).filter((asset): asset is TerritorialAsset => Boolean(asset));
  if (!linked.length) return Math.max(0, Math.min(node.annualProduction, node.annualCapacity));
  const detailed = linked.reduce((sum, asset) => sum + assetOperationalOutput(asset), 0);
  return Math.max(0, Math.min(node.annualProduction, node.annualCapacity, detailed));
}

export function territorialAssetSummary(state: WorldState, countryId: string) {
  const assets = Object.values(state.territorial.assets).filter((asset) => state.territorial.territories[asset.territoryId]?.sovereignCountryId === countryId && asset.operation && asset.kind !== 'port');
  const byUnit = Object.fromEntries([...new Set(assets.map((asset) => asset.operation!.unit))].map((unit) => {
    const selected = assets.filter((asset) => asset.operation!.unit === unit);
    return [unit, {
      annualOutput: selected.reduce((sum, asset) => sum + assetOperationalOutput(asset), 0),
      monthlyOutput: selected.reduce((sum, asset) => sum + assetMonthlyOutput(asset), 0),
      assetIds: selected.map((asset) => asset.id),
    }];
  }));
  return {
    assets,
    /** Les unités ne sont jamais additionnées entre MW, gaz et tonnages. */
    byUnit,
  };
}

export type TerritorialAssetActionKind = 'invest' | 'mobilize' | 'maintain' | 'close' | 'repair' | 'audit' | 'equip_lng' | 'decongest';

const assetActionLabels: Record<TerritorialAssetActionKind, string> = {
  invest: 'Étendre', mobilize: 'Mobiliser', maintain: 'Entretenir', close: 'Suspendre', repair: 'Réparer', audit: 'Auditer', equip_lng: 'Équiper GNL', decongest: 'Désengorger',
};

const assetActionCosts: Record<TerritorialAssetActionKind, number> = {
  invest: 1.5, mobilize: 0.4, maintain: 0.5, close: 0, repair: 2.5, audit: 1.2, equip_lng: 4.5, decongest: 0.9,
};

export type PortActionKind = 'audit' | 'invest' | 'equip_lng' | 'decongest' | 'maintain' | 'repair';

/** Les programmes nationaux évitent de réduire une stratégie portuaire à un
 * unique quai choisi arbitrairement par l'IA. */
export type NationalPortProgramTier = 'light' | 'medium' | 'heavy';

const nationalPortProgramSpecs: Record<
  NationalPortProgramTier,
  {
    label: string;
    portCount: number;
    investmentCount: number;
    baseDurationMonths: number;
    minimumDurationMonths: number;
    coordinationCost: number;
    requiredCapacities: PreparedCommonAction['requiredCapacities'];
    probability: number;
    gravity: number;
  }
> = {
  light: {
    label: 'Léger',
    portCount: 2,
    investmentCount: 0,
    baseDurationMonths: 9,
    minimumDurationMonths: 6,
    coordinationCost: 1.5,
    requiredCapacities: [
      { domain: 'administration', commitment: 4 },
      { domain: 'economy', commitment: 3 },
      { domain: 'government', commitment: 2 },
      { domain: 'intelligence', commitment: 1 },
    ],
    probability: 84,
    gravity: 2.4,
  },
  medium: {
    label: 'Moyen',
    portCount: 4,
    investmentCount: 2,
    baseDurationMonths: 24,
    minimumDurationMonths: 18,
    coordinationCost: 4.5,
    requiredCapacities: [
      { domain: 'administration', commitment: 7 },
      { domain: 'economy', commitment: 8 },
      { domain: 'government', commitment: 4 },
      { domain: 'intelligence', commitment: 2 },
    ],
    probability: 76,
    gravity: 3.6,
  },
  heavy: {
    label: 'Lourd',
    portCount: 8,
    investmentCount: 4,
    baseDurationMonths: 42,
    minimumDurationMonths: 36,
    coordinationCost: 9,
    requiredCapacities: [
      { domain: 'administration', commitment: 10 },
      { domain: 'economy', commitment: 12 },
      { domain: 'government', commitment: 6 },
      { domain: 'intelligence', commitment: 3 },
    ],
    probability: 67,
    gravity: 4.7,
  },
};

export function nationalPortProgramTierForText(
  text: string,
): NationalPortProgramTier | undefined {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
  if (/\b(leger|legere|light)\b/.test(normalized)) return 'light';
  if (/\b(moyen|moyenne|medium)\b/.test(normalized)) return 'medium';
  if (/\b(lourd|lourde|heavy)\b/.test(normalized)) return 'heavy';
  return undefined;
}

const portActionLabels: Record<PortActionKind, string> = {
  audit: 'Auditer', invest: 'Étendre', equip_lng: 'Équiper GNL',
  decongest: 'Désengorger', maintain: 'Entretenir', repair: 'Réparer',
};

const portActionCosts: Record<PortActionKind, number> = {
  audit: 1.2, invest: 2.8, equip_lng: 4.5, decongest: 0.9, maintain: 0.7, repair: 2.5,
};

const portActionDurationMonths: Record<PortActionKind, number> = {
  audit: 6, invest: 18, equip_lng: 24, decongest: 3, maintain: 2, repair: 6,
};

function portDossierId(assetId: string) {
  return `port-${assetId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

/** Effets qui rendent chaque action portuaire visible dans un dossier persistant. */
export function portDossierEffects(state: WorldState, program: Pick<ActionProgram, 'id' | 'actorId' | 'targetIds' | 'title' | 'territorialAssetId' | 'linkedDossierId'>): WorldState['actions'][number]['effects'] {
  if (!program.territorialAssetId || !program.linkedDossierId) return [];
  const asset = state.territorial.assets[program.territorialAssetId];
  if (!asset?.portProfile) return [];
  const existing = state.strategicDossiers[program.linkedDossierId];
  const entry = {
    id: `${program.id}-start`, date: state.currentDate, title: 'Opération portuaire engagée',
    summary: `${program.title} est engagée sur ${asset.name}. Les effets physiques et administratifs seront évalués à l’échéance.`,
    importance: 'moderate' as const, actorIds: [program.actorId, ...program.targetIds], requiresDecision: false, visibility: 'player' as const,
  };
  if (existing) return [
    { kind: 'dossier_patch' as const, dossierId: program.linkedDossierId, patch: { phase: 'Opération en cours', status: 'active' as const, updatedAt: state.currentDate, relatedActionIds: [...new Set([...existing.relatedActionIds, program.id])] }, reason: 'Le programme portuaire rejoint son dossier persistant.', visibility: 'player' as const },
    { kind: 'dossier_entry_add' as const, dossierId: program.linkedDossierId, entry, reason: 'Le lancement est conservé dans la chronologie du port.', visibility: 'player' as const },
  ];
  return [{
    kind: 'dossier_add' as const,
    dossier: {
      id: program.linkedDossierId, title: `Port stratégique · ${asset.name}`, kind: 'economic' as const, status: 'active' as const,
      importance: 'moderate' as const, scope: 'national' as const, actorIds: [program.actorId], regionTags: [`port:${asset.id}`],
      startedAt: state.currentDate, updatedAt: state.currentDate, phase: 'Opération engagée', trend: 'stable' as const,
      publicSummary: `Le port ${asset.name} fait l’objet d’une opération suivie par le moteur : capacités, gouvernance et état opérationnel seront réévalués à son échéance.`,
      followed: true, autoTracked: false, commitments: [program.title], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [program.id], entries: [entry],
    }, reason: 'Une opération portuaire ouvre un dossier de suivi persistant.', visibility: 'player' as const,
  }];
}

function portClassFor(goodsCapacity: number, nationalReach: number) {
  const score = goodsCapacity * 0.7 + nationalReach * 0.3;
  if (score >= 9.2) return 'megahub' as const;
  if (score >= 7.6) return 'global_hub' as const;
  if (score >= 6.2) return 'major' as const;
  if (score >= 4.4) return 'national' as const;
  if (score >= 2.5) return 'regional' as const;
  return 'local' as const;
}

function portActionEffects(asset: TerritorialAsset, kind: PortActionKind) {
  const profile = asset.portProfile!;
  const infrastructureDelta = kind === 'invest' ? Math.min(1.4, Math.max(0.4, profile.developmentPotential * 0.35)) : 0;
  const goodsDelta = kind === 'invest' ? Math.min(1.1, Math.max(0.3, infrastructureDelta * 0.8)) : 0;
  const successProfile = kind === 'audit'
    ? { governanceRisk: Math.max(0, Number((profile.governanceRisk - 2).toFixed(1))), laborFriction: Math.max(0, Number((profile.laborFriction - 0.3).toFixed(1))) }
    : kind === 'invest'
      ? (() => {
        const infrastructureCapacity = Math.min(10, Number((profile.infrastructureCapacity + infrastructureDelta).toFixed(1)));
        const goodsCapacity = Math.min(infrastructureCapacity, Number((profile.goodsCapacity + goodsDelta).toFixed(1)));
        return { infrastructureCapacity, goodsCapacity, developmentPotential: Math.max(0, Number((profile.developmentPotential - 1).toFixed(1))), classification: portClassFor(goodsCapacity, profile.nationalReach) };
      })()
      : kind === 'equip_lng'
        ? { capabilities: [...new Set([...profile.capabilities, 'lng' as const])], infrastructureCapacity: Math.min(10, Number((profile.infrastructureCapacity + 0.4).toFixed(1))) }
        : kind === 'decongest'
          ? { operationalState: 'operating' as const, laborFriction: Math.max(0, Number((profile.laborFriction - 0.2).toFixed(1))) }
          : kind === 'maintain'
            ? { operationalState: 'operating' as const, governanceRisk: Math.max(0, Number((profile.governanceRisk - 0.5).toFixed(1))) }
            : { operationalState: 'operating' as const };
  const partialProfile = kind === 'audit'
    ? { governanceRisk: Math.max(0, Number((profile.governanceRisk - 0.8).toFixed(1))) }
    : kind === 'invest'
      ? { infrastructureCapacity: Math.min(10, Number((profile.infrastructureCapacity + infrastructureDelta * 0.5).toFixed(1))), goodsCapacity: Math.min(profile.infrastructureCapacity, Number((profile.goodsCapacity + goodsDelta * 0.4).toFixed(1))) }
      : kind === 'equip_lng'
        ? { infrastructureCapacity: Math.min(10, Number((profile.infrastructureCapacity + 0.2).toFixed(1))) }
        : kind === 'decongest'
          ? { operationalState: 'congested' as const }
          : kind === 'maintain'
            ? { operationalState: profile.operationalState }
            : { operationalState: profile.operationalState };
  const success = [{ kind: 'territorial_asset_patch' as const, assetId: asset.id, patch: { ...(kind === 'repair' ? { status: 'operating' as const } : {}), portProfile: successProfile }, reason: `Le programme « ${portActionLabels[kind]} » de « ${asset.name} » aboutit.` }];
  const partial = [{ kind: 'territorial_asset_patch' as const, assetId: asset.id, patch: { ...(kind === 'repair' && asset.status !== 'closed' ? { status: 'damaged' as const } : {}), portProfile: partialProfile }, reason: `Le programme « ${portActionLabels[kind]} » de « ${asset.name} » aboutit partiellement.` }];
  return { success, partial };
}

/**
 * Prépare un programme transversal sur les principaux ports du pays joué.
 * L'IA peut proposer le périmètre (léger, moyen, lourd), mais le moteur choisit
 * les sites, les coûts et les effets à partir de l'inventaire réel. Ainsi, une
 * réforme de plusieurs ports ne dépend jamais d'un faux identifiant de port.
 */
export function prepareNationalPortProgram(
  state: WorldState,
  tier: NationalPortProgramTier,
  objective: string,
  actorId: string = state.playerCountryId,
): CommonActionPreparation {
  const country = state.countries[actorId];
  if (!country) return { ok: false, error: 'État acteur introuvable.' };
  const spec = nationalPortProgramSpecs[tier];
  const ports = Object.values(state.territorial.assets)
    .filter((asset) =>
      asset.kind === 'port' &&
      Boolean(asset.portProfile) &&
      state.territorial.territories[asset.territoryId]?.sovereignCountryId ===
        actorId,
    )
    .sort(
      (left, right) =>
        effectivePortGoodsCapacity(right.portProfile!) -
        effectivePortGoodsCapacity(left.portProfile!),
    )
    .slice(0, spec.portCount);
  if (ports.length < 2) {
    return {
      ok: false,
      error:
        'Le pays ne dispose pas d’assez de ports documentés pour un programme national.',
    };
  }

  const auditPorts = ports.filter(
    (asset) => (asset.portProfile?.governanceRisk ?? 0) > 0,
  );
  const investmentPorts = ports
    .filter((asset) => {
      const profile = asset.portProfile!;
      return (
        profile.developmentPotential > 0 &&
        profile.goodsCapacity < profile.infrastructureCapacity - 0.01 &&
        profile.infrastructureCapacity < 10
      );
    })
    .slice(0, spec.investmentCount);
  if (auditPorts.length === 0 && investmentPorts.length === 0) {
    return {
      ok: false,
      error:
        'Les principaux ports documentés n’ont actuellement ni risque de gouvernance ni capacité d’extension mobilisable.',
    };
  }

  const operationsCost =
    auditPorts.length * portActionCosts.audit +
    investmentPorts.length * portActionCosts.invest +
    spec.coordinationCost;
  const capacityAssessment = assessGovernmentCapacityForAction(
    state,
    actorId,
    'economic',
    actionLeverPolitics.industrial_capacity.administrativeComplexity,
  );
  const budgetCost = Number(
    (operationsCost * capacityAssessment.budgetMultiplier).toFixed(1),
  );
  if (fiscalBudgetAvailable(country, 'discretionary') < budgetCost) {
    return {
      ok: false,
      error: `Marge discrétionnaire insuffisante : ${budgetCost.toFixed(1)} crédits sont nécessaires au programme portuaire national.`,
    };
  }
  const durationMonths = Math.max(
    spec.minimumDurationMonths,
    Math.round(spec.baseDurationMonths * capacityAssessment.durationMultiplier),
  );
  const successEffects: WorldEffect[] = [
    ...auditPorts.flatMap((asset) => portActionEffects(asset, 'audit').success),
    ...investmentPorts.flatMap((asset) =>
      portActionEffects(asset, 'invest').success,
    ),
    {
      kind: 'macro_policy_delta',
      countryId: actorId,
      patch: {
        publicInvestmentPctGdp:
          tier === 'light' ? 0.03 : tier === 'medium' ? 0.1 : 0.18,
        industrialSupport: tier === 'light' ? 0.5 : tier === 'medium' ? 1.5 : 2.5,
      },
      reason:
        'Le programme national coordonne l’intégrité et la modernisation des principaux ports.',
    },
  ];
  const partialEffects: WorldEffect[] = [
    ...auditPorts.flatMap((asset) => portActionEffects(asset, 'audit').partial),
    ...investmentPorts.flatMap((asset) =>
      portActionEffects(asset, 'invest').partial,
    ),
    {
      kind: 'macro_policy_delta',
      countryId: actorId,
      patch: {
        publicInvestmentPctGdp:
          tier === 'light' ? 0.01 : tier === 'medium' ? 0.04 : 0.08,
        industrialSupport: tier === 'light' ? 0.2 : tier === 'medium' ? 0.6 : 1,
      },
      reason:
        'La coordination portuaire nationale aboutit partiellement.',
    },
  ];
  const names = (assets: TerritorialAsset[]) => assets.map((asset) => asset.name).join(', ');
  const successProbability = Math.round(
    Math.max(
      12,
      Math.min(
        92,
        spec.probability + capacityAssessment.successModifier,
      ),
    ),
  );
  const warnings = [
    'Les autorités locales, opérateurs, salariés et concessionnaires peuvent ralentir l’harmonisation nationale.',
    ...(investmentPorts.length < spec.investmentCount
      ? [
          'Une partie des ports du périmètre ne possède pas de capacité d’extension immédiate ; le programme concentre la modernisation sur les sites éligibles.',
        ]
      : []),
  ];
  return {
    ok: true,
    warnings,
    action: {
      category: 'economic',
      lever: 'industrial_capacity',
      actorId,
      targetIds: [actorId],
      linkedDossierId: `national-port-program-${actorId.toLocaleLowerCase('fr')}`,
      title: `Programme portuaire national · ${spec.label}`,
      intent: objective.trim() || `Renforcer l’intégrité et moderniser les principaux ports de ${country.name}.`,
      durationMonths,
      requiredCapacities: spec.requiredCapacities,
      budgetCost,
      successProbability,
      risks: warnings,
      policySignals: [
        { signal: 'port_governance', weight: 1 },
        { signal: 'port_capacity_investment', weight: tier === 'light' ? 0.25 : tier === 'medium' ? 0.7 : 1 },
      ],
      gravity: spec.gravity,
      successEffects,
      partialEffects,
      impactPreview: {
        national: [
          `Contrôles d’intégrité renforcés sur ${names(auditPorts)}.`,
          ...(investmentPorts.length
            ? [`Modernisation coordonnée de ${names(investmentPorts)}.`]
            : []),
        ],
        international: [],
        appliesAt: `Effets appliqués à la résolution, après ${durationMonths} mois.`,
      },
      governmentCapacityAssessment: capacityAssessment,
      decisionRoute: state.nationalPolitics?.[actorId]
        ? 'parliament'
        : 'executive',
      scope: 'national',
    },
  };
}

export function resolvePortProgramEffects(state: WorldState, program: ActionProgram, outcome: 'succeeded' | 'partially_succeeded' | 'failed') {
  const asset = program.territorialAssetId ? state.territorial.assets[program.territorialAssetId] : undefined;
  if (!program.portOperation || !asset?.portProfile) return null;
  if (outcome === 'failed') return [];
  const current = portActionEffects(asset, program.portOperation);
  return outcome === 'succeeded' ? current.success : current.partial;
}

/** Prépare une opération portuaire sans l’engager. La confirmation passe par
 * le même circuit que les autres programmes du jeu. */
export function preparePortAction(state: WorldState, assetId: string, kind: PortActionKind, actorId: string = state.playerCountryId): CommonActionPreparation {
  const asset = state.territorial.assets[assetId];
  if (!asset?.portProfile || asset.kind !== 'port') return { ok: false, error: 'Port documenté introuvable.' };
  const territory = state.territorial.territories[asset.territoryId];
  if (!territory || territory.sovereignCountryId !== actorId) return { ok: false, error: 'Seul le pays souverain peut engager ce port.' };
  const country = state.countries[actorId];
  const cost = portActionCosts[kind];
  if (!country || fiscalBudgetAvailable(country, 'discretionary') < cost) return { ok: false, error: `Marge discrétionnaire insuffisante pour ${portActionLabels[kind].toLowerCase()} ce port.` };
  const pendingProgram = Object.values(state.actionPrograms ?? {}).find((program) => program.status === 'active' && program.territorialAssetId === asset.id);
  if (pendingProgram) return { ok: false, error: `Une opération est déjà en cours sur ce port (résolution prévue le ${pendingProgram.expectedCompletionAt}).` };
  const profile = asset.portProfile;
  if (kind === 'audit' && profile.governanceRisk <= 0) return { ok: false, error: 'Le risque de gouvernance de ce port est déjà au minimum.' };
  if (kind === 'invest' && (profile.developmentPotential <= 0 || profile.goodsCapacity >= profile.infrastructureCapacity - 0.01 || profile.infrastructureCapacity >= 10)) return { ok: false, error: 'Ce port n’a pas de capacité d’extension immédiate dans le modèle.' };
  if (kind === 'equip_lng' && profile.capabilities.includes('lng')) return { ok: false, error: 'Ce port dispose déjà d’un terminal GNL documenté.' };
  if (kind === 'decongest' && profile.operationalState !== 'congested') return { ok: false, error: 'Ce port n’est pas actuellement congestionné.' };
  if (kind === 'repair' && !['damaged', 'closed'].includes(profile.operationalState) && asset.status !== 'damaged' && asset.status !== 'closed') return { ok: false, error: 'Ce port ne présente pas de dommage nécessitant une réparation.' };
  const title = `${portActionLabels[kind]} · ${asset.name}`;
  const intent = `${portActionLabels[kind]} ${asset.name} : ${kind === 'audit' ? 'contrôles douaniers et lutte contre les détournements' : kind === 'equip_lng' ? 'installer une capacité d’accueil de GNL' : kind === 'invest' ? 'augmenter la capacité de marchandises et les infrastructures' : kind === 'decongest' ? 'rétablir le débit nominal' : kind === 'maintain' ? 'entretenir la gouvernance et les flux' : 'remettre le port en état'}.`;
  const policySignals = kind === 'audit'
    ? [{ signal: 'port_governance' as const, weight: 1 }]
    : kind === 'invest' || kind === 'equip_lng'
      ? [{ signal: 'port_capacity_investment' as const, weight: 1 }]
      : [{ signal: 'port_governance' as const, weight: 0.25 }];
  const gravity = kind === 'audit'
    ? Math.min(5, Number((1.8 + profile.governanceRisk * 0.3).toFixed(2)))
    : kind === 'invest' || kind === 'equip_lng'
      ? Math.min(5, Number((1.3 + profile.laborFriction * 0.25).toFixed(2)))
      : 1;
  const effects = portActionEffects(asset, kind);
  const category = kind === 'audit' ? 'institutional' as const : 'economic' as const;
  const lever = kind === 'audit' ? 'anti_corruption' as const : kind === 'equip_lng' ? 'energy_resilience' as const : kind === 'invest' ? 'industrial_capacity' as const : 'economic_general' as const;
  const governmentCapacityAssessment = assessGovernmentCapacityForAction(state, actorId, category, actionLeverPolitics[lever].administrativeComplexity);
  const durationMonths = Math.max(1, Math.round(portActionDurationMonths[kind] * governmentCapacityAssessment.durationMultiplier));
  const budgetCost = Number((cost * governmentCapacityAssessment.budgetMultiplier).toFixed(1));
  if (fiscalBudgetAvailable(country, 'discretionary') < budgetCost) return { ok: false, error: `Marge discrétionnaire insuffisante pour ${portActionLabels[kind].toLowerCase()} ce port après prise en compte des capacités de l’État.` };
  const action: PreparedCommonAction = {
    category, lever,
    actorId, targetIds: [actorId], territorialAssetId: asset.id, portOperation: kind, linkedDossierId: portDossierId(asset.id), title, intent,
    durationMonths, requiredCapacities: kind === 'audit'
      ? [{ domain: 'administration', commitment: 3 }, { domain: 'intelligence', commitment: 2 }, { domain: 'government', commitment: 1 }]
      : kind === 'equip_lng' ? [{ domain: 'economy', commitment: 5 }, { domain: 'administration', commitment: 3 }]
        : kind === 'invest' ? [{ domain: 'economy', commitment: 4 }, { domain: 'administration', commitment: 2 }]
          : [{ domain: 'administration', commitment: 2 }, { domain: 'economy', commitment: 1 }],
    budgetCost, successProbability: Math.round(Math.max(12, Math.min(92, (kind === 'audit' ? 78 : kind === 'equip_lng' ? 76 : kind === 'invest' ? 82 : 88) + governmentCapacityAssessment.successModifier))),
    risks: kind === 'audit' ? ['Les contrôles peuvent provoquer une friction sociale ou ralentir temporairement les formalités.', 'Les détournements organisés peuvent déplacer leurs circuits.']
      : ['Les retards de chantier, la congestion ou les oppositions locales peuvent réduire le résultat.'],
    policySignals, successEffects: effects.success, partialEffects: effects.partial,
    impactPreview: { national: [`Le profil opérationnel de ${asset.name} sera mis à jour à l’échéance.`], international: kind === 'equip_lng' ? ['Une capacité d’importation GNL pourra ensuite être reliée à un contrat énergétique distinct.'] : [], appliesAt: `Effets appliqués à la résolution, après ${durationMonths} mois.` },
    governmentCapacityAssessment,
    gravity,
    decisionRoute: 'executive', scope: 'national',
  };
  return { ok: true, action, warnings: kind === 'equip_lng' ? ['L’équipement du terminal ne crée aucun contrat ni flux importé automatiquement.'] : [] };
}

function launchPreparedPortAction(state: WorldState, prepared: PreparedCommonAction) {
  const program: ActionProgram = {
    ...prepared, id: `program-port-${String(state.sequence + 1).padStart(6, '0')}`,
    startedAt: state.currentDate, expectedCompletionAt: addMonths(state.currentDate, prepared.durationMonths), progressMonths: 0,
    status: 'active', confirmedAt: state.currentDate, budgetStatus: 'consumed', budgetConsumedAt: state.currentDate,
    resourceStatus: 'committed', resourcesCommittedAt: state.currentDate,
  };
  const effects: WorldState['actions'][number]['effects'] = [
    { kind: 'action_program_add', program, reason: 'Le gouvernement engage une opération portuaire ciblée.' },
    { kind: 'fiscal_delta', countryId: program.actorId, bucket: 'discretionary', delta: -program.budgetCost, reason: `Marge discrétionnaire engagée pour « ${program.title} ».` },
    ...program.requiredCapacities.map(({ domain, commitment }) => ({ kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: commitment, reason: `Moyens mobilisés pour « ${program.title} » jusqu’à sa résolution.` })),
    ...(program.policySignals?.length ? stakeholderReactionEffects(state, {
      id: `measure-${program.id}`,
      countryId: program.actorId,
      title: program.title,
      subjectId: program.linkedDossierId ?? `program:${program.lever ?? program.category}`,
      intensity: Math.min(100, 42 + program.budgetCost * 2),
      gravity: program.gravity,
      territorialAssetId: program.territorialAssetId,
      signals: program.policySignals,
      effects: [],
    }) : []),
    ...portDossierEffects(state, program),
  ];
  return {
    ok: true as const,
    state: commitWorldAction(state, { kind: program.category === 'institutional' ? 'institutional' : 'economic', actorId: program.actorId, targetIds: program.targetIds, origin: 'player', intent: `Lancer : ${program.title}`, effects, assumptions: [`Confirmation joueur le ${state.currentDate}.`, `Effets appliqués uniquement à la résolution vers le ${program.expectedCompletionAt}.`] }),
    programId: program.id,
  };
}

const addMonths = (date: string, months: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as `${number}-${number}-${number}`;
};

function scheduleAssetOperation(state: WorldState, asset: TerritorialAsset, kind: Exclude<TerritorialAssetActionKind, 'close'>, actorId: string, cost: number) {
  const operation = asset.operation!;
  const durationMonths = kind === 'invest' ? 12 : kind === 'mobilize' ? 2 : kind === 'maintain' ? 1 : 6;
  const maximumDelta = kind === 'invest' ? Math.max(0.1, operation.maximum * 0.08) : 0;
  const deployedTarget = kind === 'mobilize' ? Math.min(operation.maximum, operation.deployed + Math.max(0.1, operation.maximum * 0.1)) : operation.deployed;
  const availabilityTarget = kind === 'maintain' ? Math.min(100, operation.availabilityPct + 5) : kind === 'repair' ? Math.min(100, Math.max(80, operation.availabilityPct + 30)) : operation.availabilityPct;
  const successPatch = kind === 'invest'
    ? { operation: { maximum: Number((operation.maximum + maximumDelta).toFixed(3)) } }
    : kind === 'mobilize'
      ? { operation: { deployed: Number(deployedTarget.toFixed(3)) } }
      : kind === 'maintain'
        ? { operation: { availabilityPct: Number(availabilityTarget.toFixed(2)) } }
        : { status: 'operating' as const, operation: { availabilityPct: Number(availabilityTarget.toFixed(2)) } };
  const partialPatch = kind === 'invest'
    ? { operation: { maximum: Number((operation.maximum + maximumDelta * 0.5).toFixed(3)) } }
    : kind === 'mobilize'
      ? { operation: { deployed: Number((operation.deployed + (deployedTarget - operation.deployed) * 0.5).toFixed(3)) } }
      : kind === 'maintain'
        ? { operation: { availabilityPct: Number(Math.min(100, operation.availabilityPct + 2).toFixed(2)) } }
        : { status: 'operating' as const, operation: { availabilityPct: Number(Math.min(100, Math.max(65, operation.availabilityPct + 15)).toFixed(2)) } };
  const node = operation.ledgerNodeId ? state.energyNodes[operation.ledgerNodeId] : undefined;
  const nodeDelta = kind === 'invest' && node
    ? [{ kind: 'energy_node_patch' as const, nodeId: node.id, patch: { annualCapacity: Number((node.annualCapacity + maximumDelta).toFixed(3)) }, reason: `Le registre ouvre une capacité supplémentaire correspondant à l’extension de « ${asset.name} ».` }]
    : [];
  const partialNodeDelta = kind === 'invest' && node
    ? [{ kind: 'energy_node_patch' as const, nodeId: node.id, patch: { annualCapacity: Number((node.annualCapacity + maximumDelta * 0.5).toFixed(3)) }, reason: `Le registre n’ouvre qu’une partie de la capacité prévue pour « ${asset.name} ».` }]
    : [];
  const actionProgram: ActionProgram = {
    id: `program-asset-${kind}-${String(state.sequence + 1).padStart(6, '0')}`,
    category: 'economic', lever: 'energy_resilience', actorId, targetIds: [actorId], territorialAssetId: asset.id,
    title: `${assetActionLabels[kind]} · ${asset.name}`, intent: `${assetActionLabels[kind]} ${asset.name}`,
    startedAt: state.currentDate, expectedCompletionAt: addMonths(state.currentDate, durationMonths), durationMonths, progressMonths: 0, status: 'active',
    requiredCapacities: [{ domain: 'economy', commitment: kind === 'repair' ? 3 : kind === 'invest' || kind === 'mobilize' ? 2 : 1 }],
    budgetCost: cost, successProbability: kind === 'repair' ? 80 : kind === 'invest' ? 85 : kind === 'mobilize' ? 92 : 95,
    risks: kind === 'invest' ? ['Le chantier peut ouvrir moins de capacité que prévu.', 'La mobilisation future reste nécessaire pour produire davantage.'] : ['Une indisponibilité ou un retard logistique peut réduire le résultat.'],
    successEffects: [{ kind: 'territorial_asset_patch', assetId: asset.id, patch: successPatch, reason: `Le programme « ${assetActionLabels[kind]} » de « ${asset.name} » aboutit.` }, ...nodeDelta],
    partialEffects: [{ kind: 'territorial_asset_patch', assetId: asset.id, patch: partialPatch, reason: `Le programme « ${assetActionLabels[kind]} » de « ${asset.name} » aboutit partiellement.` }, ...partialNodeDelta],
  };
  const effects: WorldState['actions'][number]['effects'] = [
    { kind: 'action_program_add', program: actionProgram, reason: 'Le gouvernement engage le programme d’exploitation de l’actif.' },
    ...(cost > 0 ? [{ kind: 'fiscal_delta' as const, countryId: actorId, bucket: 'discretionary' as const, delta: -cost, reason: `Marge discrétionnaire engagée pour l’action « ${assetActionLabels[kind]} » sur « ${asset.name} ».` }] : []),
    { kind: 'capacity_commitment', countryId: actorId, domain: 'economy', delta: actionProgram.requiredCapacities[0].commitment, reason: `Moyens mobilisés pour « ${actionProgram.title} » jusqu’à sa résolution.` },
  ];
  const next = commitWorldAction(state, {
    kind: operation.resource ? 'energy' : 'economic', actorId, targetIds: [actorId], origin: 'player', intent: `Lancer : ${actionProgram.title}`,
    effects, metadata: { territorialAssetAction: kind, assetId: asset.id },
  });
  return { ok: true as const, state: next, message: `${assetActionLabels[kind]} engagée sur ${asset.name} : résolution prévue le ${actionProgram.expectedCompletionAt}.` };
}

/**
 * Action locale jouable sur un actif du pays dirigé.
 * Les investissements restent volontairement simples : ils ouvrent une
 * capacité identifiable, sans créer une chaîne de production détaillée.
 */
export function operateTerritorialAsset(
  state: WorldState,
  assetId: string,
  kind: TerritorialAssetActionKind,
  actorId: string = state.playerCountryId,
) {
  const asset = state.territorial.assets[assetId];
  if (asset?.kind === 'port' && asset.portProfile) {
    if (kind === 'mobilize') return { ok: false as const, state, error: 'Un port se gère par audit, extension, équipement ou désengorgement.' };
    const pendingPortProgram = Object.values(state.actionPrograms ?? {}).find((program) => program.status === 'active' && program.territorialAssetId === asset.id);
    if (pendingPortProgram) return { ok: false as const, state, error: `Une opération est déjà en cours sur ce port (résolution prévue le ${pendingPortProgram.expectedCompletionAt}).` };
    if (kind === 'close') {
      const territory = state.territorial.territories[asset.territoryId];
      if (!territory || territory.sovereignCountryId !== actorId) return { ok: false as const, state, error: 'Seul le pays souverain peut suspendre ce port.' };
      if (asset.portProfile.operationalState === 'closed') return { ok: false as const, state, error: 'Ce port est déjà fermé.' };
      return {
        ok: true as const,
        state: commitWorldAction(state, { kind: 'economic', actorId, targetIds: [actorId], origin: 'player', intent: `Suspendre ${asset.name}`, effects: [{ kind: 'territorial_asset_patch', assetId, patch: { status: 'closed', portProfile: { operationalState: 'closed' } }, reason: `Suspension de « ${asset.name} » : sa capacité portuaire devient nulle.` }] }),
        message: `${asset.name} est suspendu : ses flux de marchandises sont interrompus jusqu’à réouverture.`,
      };
    }
    const prepared = preparePortAction(state, assetId, kind as PortActionKind, actorId);
    if (!prepared.ok) return { ok: false as const, state, error: prepared.error };
    const launched = launchPreparedPortAction(state, prepared.action);
    return { ok: true as const, state: launched.state, message: `${portActionLabels[kind as PortActionKind]} engagée sur ${asset.name} : résolution prévue le ${addMonths(state.currentDate, prepared.action.durationMonths)}.` };
  }
  if (!asset?.operation) return { ok: false as const, state, error: 'Cet actif ne possède pas encore de couche opérationnelle.' };
  const territory = state.territorial.territories[asset.territoryId];
  if (!territory || territory.sovereignCountryId !== actorId) return { ok: false as const, state, error: 'Seul le pays souverain peut engager cet actif.' };
  const country = state.countries[actorId];
  const cost = assetActionCosts[kind];
  if (!country || fiscalBudgetAvailable(country, 'discretionary') < cost) return { ok: false as const, state, error: `Marge discrétionnaire insuffisante pour ${assetActionLabels[kind].toLowerCase()} cet actif.` };
  const pendingProgram = Object.values(state.actionPrograms ?? {}).find((program) => program.status === 'active' && program.territorialAssetId === asset.id);
  if (pendingProgram) return { ok: false as const, state, error: `Une opération est déjà en cours sur cet actif (résolution prévue le ${pendingProgram.expectedCompletionAt}).` };
  const operation = asset.operation;
  if (kind !== 'close') {
    if (kind === 'mobilize' && asset.status === 'closed') return { ok: false as const, state, error: 'Un actif suspendu doit d’abord être réparé.' };
    if (kind === 'maintain' && asset.status === 'closed') return { ok: false as const, state, error: 'Un actif suspendu doit d’abord être réparé.' };
    if (kind === 'mobilize' && operation.deployed >= operation.maximum - 0.001) return { ok: false as const, state, error: 'Cet actif est déjà entièrement déployé.' };
    if (kind === 'maintain' && operation.availabilityPct >= 99.9) return { ok: false as const, state, error: 'La disponibilité de cet actif est déjà au maximum.' };
    if (kind === 'repair' && asset.status === 'operating' && operation.availabilityPct >= 95) return { ok: false as const, state, error: 'Cet actif ne nécessite pas de réparation immédiate.' };
    return scheduleAssetOperation(state, asset, kind, actorId, cost);
  }
  const effects: WorldState['actions'][number]['effects'] = [];
  const targetIds = [actorId];
  if (asset.status === 'closed') return { ok: false as const, state, error: 'Cet actif est déjà suspendu.' };
  effects.push({ kind: 'territorial_asset_patch', assetId, patch: { status: 'closed' }, reason: `Suspension de « ${asset.name} » : son débit devient nul tant qu’il reste fermé.` });
  const message = `${asset.name} est suspendu : ses flux effectifs sont interrompus jusqu’à réparation.`;
  if (cost > 0) effects.push({ kind: 'fiscal_delta', countryId: actorId, bucket: 'discretionary', delta: -cost, reason: `Marge discrétionnaire engagée pour l’action « ${assetActionLabels[kind]} » sur « ${asset.name} ».` });
  const next = commitWorldAction(state, {
    kind: operation.resource ? 'energy' : 'economic', actorId, targetIds, origin: 'player', intent: `${assetActionLabels[kind]} ${asset.name}`,
    effects, metadata: { territorialAssetAction: kind, assetId },
  });
  return { ok: true as const, state: next, message };
}
