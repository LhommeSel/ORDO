import type { EnergyNode, WorldState } from './types';
import type { TerritorialAsset, TerritorialAssetOperation, TerritorialState } from './territory-types';

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
  const assets = Object.values(state.territorial.assets).filter((asset) => state.territorial.territories[asset.territoryId]?.sovereignCountryId === countryId && asset.operation);
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
