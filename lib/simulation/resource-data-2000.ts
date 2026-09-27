import type {
  CountryId,
  GoldCountryStock,
  ResourceBasin,
  ResourceDefinition,
  ResourceDeposit,
  ResourceCountryStock,
  ResourceState,
} from './types';
import type { CountryState } from './types';
import type { TerritorialState } from './territory-types';
import { createGoldStocks2000 } from './gold-stocks-2000';

export const resourceDefinitions2000: Record<string, ResourceDefinition> = {
  oil: { id: 'oil', name: 'Pétrole', category: 'energy', unit: 'barrels', strategicImportance: 98, marketEnabled: false, note: 'Registre énergétique existant ; raccordement au catalogue commun progressif.' },
  gas: { id: 'gas', name: 'Gaz naturel', category: 'energy', unit: 'bcm', strategicImportance: 94, marketEnabled: false, note: 'Registre énergétique existant ; raccordement au catalogue commun progressif.' },
  or: { id: 'or', name: 'Or', category: 'precious', unit: 'tonnes', strategicImportance: 88, marketEnabled: false, note: 'Stock géologique, hors réserves monétaires et production.' },
  cuivre: { id: 'cuivre', name: 'Cuivre', category: 'metal', unit: 'tonnes', strategicImportance: 82, marketEnabled: false, note: 'Intrant industriel et électrique.' },
  fer: { id: 'fer', name: 'Minerai de fer', category: 'metal', unit: 'tonnes', strategicImportance: 74, marketEnabled: false, note: 'Base sidérurgique et industrielle.' },
  bauxite: { id: 'bauxite', name: 'Bauxite', category: 'metal', unit: 'tonnes', strategicImportance: 76, marketEnabled: false, note: 'Minerai de l’aluminium.' },
  nickel: { id: 'nickel', name: 'Nickel', category: 'metal', unit: 'tonnes', strategicImportance: 84, marketEnabled: false, note: 'Acier allié et batteries.' },
  cobalt: { id: 'cobalt', name: 'Cobalt', category: 'strategic', unit: 'tonnes', strategicImportance: 94, marketEnabled: false, note: 'Ressource critique à forte concentration géographique.' },
  lithium: { id: 'lithium', name: 'Lithium', category: 'strategic', unit: 'tonnes', strategicImportance: 91, marketEnabled: false, note: 'Ressource de stockage électrochimique.' },
  uranium: { id: 'uranium', name: 'Uranium', category: 'strategic', unit: 'tonnes', strategicImportance: 96, marketEnabled: false, note: 'Ressource énergétique et de souveraineté.' },
  manganese: { id: 'manganese', name: 'Manganèse', category: 'metal', unit: 'tonnes', strategicImportance: 73, marketEnabled: false, note: 'Alliage et chimie industrielle.' },
  phosphates: { id: 'phosphates', name: 'Phosphates', category: 'fertilizer', unit: 'tonnes', strategicImportance: 86, marketEnabled: false, note: 'Engrais et sécurité alimentaire.' },
  potasse: { id: 'potasse', name: 'Potasse', category: 'fertilizer', unit: 'tonnes', strategicImportance: 79, marketEnabled: false, note: 'Engrais et dépendance agricole.' },
  'terres-rares': { id: 'terres-rares', name: 'Terres rares', category: 'strategic', unit: 'tonnes', strategicImportance: 93, marketEnabled: false, note: 'Aimants, électronique et défense.' },
};

type BasinSeed = Omit<ResourceBasin, 'territoryIds' | 'countryIds'> & { countryIds: CountryId[]; territoryHints: Array<[CountryId, string?]> };
type DepositSeed = Omit<ResourceDeposit, 'territoryShares' | 'controllerEntityIds' | 'claimantEntityIds' | 'accessAssetIds' | 'lastUpdatedAt'> & {
  territoryHints: Array<[CountryId, number, string?]>;
  claimantEntityIds?: string[];
  accessAssetIds?: string[];
};

const basinSeeds: BasinSeed[] = [
  { id: 'gold-guiana-shield', resourceId: 'or', name: 'Bouclier guyanais', countryIds: ['FRA', 'GUY', 'SUR', 'BRA'], territoryHints: [['FRA', 'FRA-r03'], ['GUY', 'GUY:macro-interior'], ['SUR', 'SUR:macro-interior'], ['BRA', 'BRA:macro-north-amazon']], geologicalContinuity: 88, sharedStatus: 'cross_border', sourceIds: ['USGS-gold-2000', 'BGS-guyana-shield'] },
  { id: 'gold-birimian', resourceId: 'or', name: 'Ceinture birimienne ouest-africaine', countryIds: ['GHA', 'MLI', 'GIN', 'CIV', 'BFA'], territoryHints: [['GHA'], ['MLI'], ['GIN'], ['CIV'], ['BFA']], geologicalContinuity: 84, sharedStatus: 'cross_border', sourceIds: ['USGS-gold-2000'] },
  { id: 'andes-copper-belt', resourceId: 'cuivre', name: 'Ceinture cuprifère des Andes', countryIds: ['CHL', 'PER', 'ARG', 'BOL'], territoryHints: [['CHL', 'CHL:macro-north-mining'], ['PER', 'PER:macro-andes'], ['ARG', 'ARG:macro-northwest'], ['BOL', 'BOL:macro-la-paz']], geologicalContinuity: 92, sharedStatus: 'cross_border', sourceIds: ['USGS-copper-2000'] },
  { id: 'great-lakes-copper-cobalt', resourceId: 'cobalt', name: 'Cuivre-cobalt des Grands Lacs', countryIds: ['COD', 'ZMB'], territoryHints: [['COD'], ['ZMB']], geologicalContinuity: 90, sharedStatus: 'cross_border', sourceIds: ['USGS-cobalt-2000'] },
  { id: 'central-asian-uranium', resourceId: 'uranium', name: 'Province uranifère d’Asie centrale', countryIds: ['KAZ', 'UZB', 'KGZ'], territoryHints: [['KAZ', 'KAZ:macro-east'], ['UZB'], ['KGZ']], geologicalContinuity: 77, sharedStatus: 'cross_border', sourceIds: ['IAEA-uranium-2000'] },
  { id: 'andean-lithium-salars', resourceId: 'lithium', name: 'Triangle des salars andins', countryIds: ['CHL', 'ARG', 'BOL'], territoryHints: [['CHL', 'CHL:macro-north-mining'], ['ARG', 'ARG:macro-northwest'], ['BOL', 'BOL:macro-highlands']], geologicalContinuity: 86, sharedStatus: 'transboundary_system', sourceIds: ['USGS-lithium-2000'] },
  { id: 'west-africa-bauxite', resourceId: 'bauxite', name: 'Arc bauxitique ouest-africain', countryIds: ['GIN', 'GHA', 'SLE', 'GNB'], territoryHints: [['GIN'], ['GHA'], ['SLE'], ['GNB']], geologicalContinuity: 79, sharedStatus: 'cross_border', sourceIds: ['USGS-bauxite-2000'] },
  { id: 'southern-africa-platinum', resourceId: 'nickel', name: 'Complexe minier d’Afrique australe', countryIds: ['ZAF', 'ZWE', 'BWA'], territoryHints: [['ZAF'], ['ZWE'], ['BWA']], geologicalContinuity: 75, sharedStatus: 'cross_border', sourceIds: ['USGS-nickel-2000'] },
  { id: 'china-rare-earths', resourceId: 'terres-rares', name: 'Provinces de terres rares chinoises', countryIds: ['CHN', 'MNG'], territoryHints: [['CHN'], ['MNG']], geologicalContinuity: 70, sharedStatus: 'cross_border', sourceIds: ['USGS-rare-earths-2000'] },
  { id: 'north-africa-phosphate', resourceId: 'phosphates', name: 'Plateau phosphatier nord-africain', countryIds: ['MAR', 'DZA', 'TUN'], territoryHints: [['MAR'], ['DZA'], ['TUN']], geologicalContinuity: 82, sharedStatus: 'cross_border', sourceIds: ['USGS-phosphate-2000'] },
  { id: 'australia-iron', resourceId: 'fer', name: 'Pilbara et bassins australiens', countryIds: ['AUS'], territoryHints: [['AUS']], geologicalContinuity: 94, sharedStatus: 'national', sourceIds: ['USGS-iron-2000'] },
  { id: 'north-america-uranium', resourceId: 'uranium', name: 'Provinces uranifères nord-américaines', countryIds: ['CAN', 'USA'], territoryHints: [['CAN'], ['USA']], geologicalContinuity: 74, sharedStatus: 'cross_border', sourceIds: ['IAEA-uranium-2000'] },
];

const depositSeeds: DepositSeed[] = [
  { id: 'copper-andes-north', basinId: 'andes-copper-belt', resourceId: 'cuivre', territoryHints: [['CHL', 55, 'CHL:macro-north-mining'], ['PER', 45, 'PER:macro-andes']], identifiedStock: 62000000, probableStock: 48000000, frontierPotential: 35000000, quality: 72, depth: 61, extractionDifficulty: 63, environmentalRisk: 68, logisticsDifficulty: 54, legalStatus: 'shared', claimantEntityIds: ['CHL', 'PER'], confidence: 'high', sourceIds: ['USGS-copper-2000'] },
  { id: 'copper-andes-south', basinId: 'andes-copper-belt', resourceId: 'cuivre', territoryHints: [['CHL', 60, 'CHL:macro-north-mining'], ['ARG', 40, 'ARG:macro-northwest']], identifiedStock: 38000000, probableStock: 26000000, frontierPotential: 30000000, quality: 68, depth: 67, extractionDifficulty: 70, environmentalRisk: 61, logisticsDifficulty: 66, legalStatus: 'contested', claimantEntityIds: ['CHL', 'ARG'], confidence: 'medium', sourceIds: ['USGS-copper-2000'] },
  { id: 'cobalt-katanga', basinId: 'great-lakes-copper-cobalt', resourceId: 'cobalt', territoryHints: [['COD', 72, 'COD:aggregate'], ['ZMB', 28, 'ZMB:aggregate']], identifiedStock: 3400000, probableStock: 2700000, frontierPotential: 3100000, quality: 76, depth: 52, extractionDifficulty: 74, environmentalRisk: 71, logisticsDifficulty: 78, legalStatus: 'shared', claimantEntityIds: ['COD', 'ZMB'], confidence: 'medium', sourceIds: ['USGS-cobalt-2000'] },
  { id: 'lithium-salar-uyuni-atacama', basinId: 'andean-lithium-salars', resourceId: 'lithium', territoryHints: [['BOL', 46, 'BOL:macro-highlands'], ['CHL', 34, 'CHL:macro-north-mining'], ['ARG', 20, 'ARG:macro-northwest']], identifiedStock: 12000000, probableStock: 26000000, frontierPotential: 40000000, quality: 64, depth: 34, extractionDifficulty: 58, environmentalRisk: 76, logisticsDifficulty: 64, legalStatus: 'shared', claimantEntityIds: ['BOL', 'CHL', 'ARG'], confidence: 'medium', sourceIds: ['USGS-lithium-2000'] },
  { id: 'uranium-central-steppe', basinId: 'central-asian-uranium', resourceId: 'uranium', territoryHints: [['KAZ', 58, 'KAZ:macro-east'], ['UZB', 34, 'UZB:aggregate'], ['KGZ', 8, 'KGZ:aggregate']], identifiedStock: 1800000, probableStock: 1300000, frontierPotential: 1900000, quality: 56, depth: 48, extractionDifficulty: 61, environmentalRisk: 55, logisticsDifficulty: 70, legalStatus: 'shared', claimantEntityIds: ['KAZ', 'UZB', 'KGZ'], confidence: 'medium', sourceIds: ['IAEA-uranium-2000'] },
  { id: 'bauxite-guinea-fouta', basinId: 'west-africa-bauxite', resourceId: 'bauxite', territoryHints: [['GIN', 75, 'GIN:aggregate'], ['SLE', 25, 'SLE:aggregate']], identifiedStock: 1800000000, probableStock: 1100000000, frontierPotential: 1500000000, quality: 68, depth: 24, extractionDifficulty: 47, environmentalRisk: 59, logisticsDifficulty: 72, legalStatus: 'shared', claimantEntityIds: ['GIN', 'SLE'], confidence: 'medium', sourceIds: ['USGS-bauxite-2000'] },
  { id: 'rare-earth-inner-mongolia', basinId: 'china-rare-earths', resourceId: 'terres-rares', territoryHints: [['CHN', 82], ['MNG', 18]], identifiedStock: 42000000, probableStock: 34000000, frontierPotential: 52000000, quality: 74, depth: 31, extractionDifficulty: 52, environmentalRisk: 74, logisticsDifficulty: 42, legalStatus: 'shared', claimantEntityIds: ['CHN', 'MNG'], confidence: 'medium', sourceIds: ['USGS-rare-earths-2000'] },
  { id: 'phosphate-sahara-magreb', basinId: 'north-africa-phosphate', resourceId: 'phosphates', territoryHints: [['MAR', 62], ['DZA', 25], ['TUN', 13]], identifiedStock: 9000000000, probableStock: 4200000000, frontierPotential: 6000000000, quality: 71, depth: 22, extractionDifficulty: 35, environmentalRisk: 48, logisticsDifficulty: 50, legalStatus: 'contested', claimantEntityIds: ['MAR', 'DZA'], confidence: 'medium', sourceIds: ['USGS-phosphate-2000'] },
  { id: 'iron-pilbara', basinId: 'australia-iron', resourceId: 'fer', territoryHints: [['AUS', 100]], identifiedStock: 24000000000, probableStock: 19000000000, frontierPotential: 30000000000, quality: 79, depth: 18, extractionDifficulty: 28, environmentalRisk: 46, logisticsDifficulty: 38, legalStatus: 'undisputed', confidence: 'high', sourceIds: ['USGS-iron-2000'] },
  { id: 'uranium-athabasca-colorado', basinId: 'north-america-uranium', resourceId: 'uranium', territoryHints: [['CAN', 66], ['USA', 34]], identifiedStock: 1100000, probableStock: 850000, frontierPotential: 1200000, quality: 61, depth: 44, extractionDifficulty: 48, environmentalRisk: 43, logisticsDifficulty: 45, legalStatus: 'shared', claimantEntityIds: ['CAN', 'USA'], confidence: 'medium', sourceIds: ['IAEA-uranium-2000'] },
];

function territoryFor(territorial: TerritorialState, countryId: CountryId, hint?: string) {
  if (hint && territorial.territories[hint]) return territorial.territories[hint];
  return Object.values(territorial.territories).find((territory) => territory.sovereignCountryId === countryId)
    ?? Object.values(territorial.territories).find((territory) => territory.accountingCountryId === countryId);
}

function buildBasin(territorial: TerritorialState, seed: BasinSeed): ResourceBasin {
  const { territoryHints, ...base } = seed;
  const territoryIds = territoryHints.map(([countryId, hint]) => territoryFor(territorial, countryId, hint)?.id).filter((id): id is string => Boolean(id));
  return { ...base, territoryIds, countryIds: base.countryIds.filter((id) => territoryIds.some((territoryId) => territorial.territories[territoryId]?.sovereignCountryId === id || territorial.territories[territoryId]?.accountingCountryId === id)) };
}

function buildDeposit(territorial: TerritorialState, seed: DepositSeed, date: ResourceDeposit['lastUpdatedAt']): ResourceDeposit {
  const { territoryHints, claimantEntityIds: requestedClaimants, accessAssetIds: requestedAccess, ...base } = seed;
  const territoryShares = territoryHints.map(([countryId, sharePct, hint]) => territoryFor(territorial, countryId, hint) ? ({ territoryId: territoryFor(territorial, countryId, hint)!.id, sharePct }) : undefined).filter((item): item is { territoryId: string; sharePct: number } => Boolean(item));
  const controllers = [...new Set(territoryShares.map((share) => territorial.territories[share.territoryId]?.controllerEntityId).filter((id): id is string => Boolean(id)))];
  const claimantEntityIds = requestedClaimants ?? (seed.legalStatus === 'contested' || seed.legalStatus === 'shared'
    ? [...new Set(territoryShares.map((share) => territorial.territories[share.territoryId]?.sovereignCountryId).filter((id): id is string => Boolean(id)))]
    : []);
  const accessAssetIds = requestedAccess ?? Object.values(territorial.assets)
    .filter((asset) => territoryShares.some((share) => share.territoryId === asset.territoryId))
    .filter((asset) => ['port', 'airport', 'logistics', 'passage'].includes(asset.kind))
    .map((asset) => asset.id);
  return { ...base, territoryShares, controllerEntityIds: controllers, claimantEntityIds, accessAssetIds, lastUpdatedAt: date };
}

function confidenceFor(values: Array<ResourceDeposit['confidence']>): ResourceCountryStock['confidence'] {
  if (values.includes('low')) return 'low';
  if (values.includes('medium')) return 'medium';
  return 'high';
}

export function createResourceState2000(
  countries: Record<CountryId, CountryState>,
  territorial: TerritorialState,
  date: ResourceDeposit['lastUpdatedAt'] = '2000-01-01',
  goldStocks: Record<CountryId, GoldCountryStock> = createGoldStocks2000(countries, date),
): ResourceState {
  const basins = Object.fromEntries(basinSeeds.map((seed) => [seed.id, buildBasin(territorial, seed)]));
  const deposits: Record<string, ResourceDeposit> = {};
  for (const seed of depositSeeds) deposits[seed.id] = buildDeposit(territorial, seed, date);

  // Le stock d'or existant devient une projection territorialisée du registre
  // commun. Les pays non documentés restent présents, mais explicitement avec
  // une confiance faible : ils ne disparaissent pas du monde simulé.
  for (const [countryId, stock] of Object.entries(goldStocks)) {
    const preferredHint = countryId === 'FRA' ? 'FRA-r03' : countryId === 'BRA' ? 'BRA:macro-north-amazon' : undefined;
    const territory = territoryFor(territorial, countryId, preferredHint);
    if (!territory) continue;
    const basinId = countryId === 'FRA' || countryId === 'GUY' || countryId === 'SUR' || countryId === 'BRA' ? 'gold-guiana-shield' : countryId === 'GHA' || countryId === 'MLI' || countryId === 'GIN' || countryId === 'CIV' || countryId === 'BFA' ? 'gold-birimian' : `gold-national-${countryId.toLowerCase()}`;
    if (!basins[basinId]) basins[basinId] = { id: basinId, resourceId: 'or', name: `District aurifère de ${countries[countryId]?.name ?? countryId}`, territoryIds: [territory.id], countryIds: [countryId], geologicalContinuity: 50, sharedStatus: 'national', sourceIds: [stock.source] };
    const depositId = `gold-${countryId.toLowerCase()}-stock`;
    if (deposits[depositId]) continue;
    deposits[depositId] = buildDeposit(territorial, {
      id: depositId, basinId, resourceId: 'or', territoryHints: [[countryId, 100, territory.id]],
      identifiedStock: stock.identifiedReservesTonnes, probableStock: stock.probableReservesTonnes, frontierPotential: stock.frontierPotentialTonnes,
      quality: 50, depth: 50, extractionDifficulty: 55, environmentalRisk: 50, logisticsDifficulty: 50,
      legalStatus: 'undisputed', confidence: stock.confidence, sourceIds: [stock.source],
    }, date);
  }

  const countryStocks: ResourceState['countryStocks'] = Object.fromEntries(Object.keys(countries).map((countryId) => [countryId, {}]));
  for (const deposit of Object.values(deposits)) {
    for (const share of deposit.territoryShares) {
      const territory = territorial.territories[share.territoryId];
      const countryId = territory?.accountingCountryId ?? territory?.sovereignCountryId;
      if (!countryId || !countryStocks[countryId]) continue;
      const current = countryStocks[countryId][deposit.resourceId] ?? {
        countryId, resourceId: deposit.resourceId, identifiedStock: 0, probableStock: 0, frontierPotential: 0, depositIds: [], confidence: 'high' as const, lastUpdatedAt: date,
      };
      countryStocks[countryId][deposit.resourceId] = {
        ...current,
        identifiedStock: current.identifiedStock + deposit.identifiedStock * share.sharePct / 100,
        probableStock: current.probableStock + deposit.probableStock * share.sharePct / 100,
        frontierPotential: current.frontierPotential + deposit.frontierPotential * share.sharePct / 100,
        depositIds: [...new Set([...current.depositIds, deposit.id])],
        confidence: confidenceFor([...current.depositIds.map((id) => deposits[id]?.confidence).filter((value): value is ResourceDeposit['confidence'] => Boolean(value)), deposit.confidence]),
      };
    }
  }
  return { definitions: structuredClone(resourceDefinitions2000), basins, deposits, countryStocks, lastUpdatedAt: date };
}

export function resourceDepositsForTerritory(state: ResourceState, territoryId: string) {
  return Object.values(state.deposits).filter((deposit) => deposit.territoryShares.some((share) => share.territoryId === territoryId));
}

/** Vue de compatibilité pour les anciennes sauvegardes : le stock d'or exposé
 * au reste du moteur est maintenant reconstruit depuis les parts de gisements. */
export function goldStocksFromResourceState(state: ResourceState): Record<CountryId, GoldCountryStock> {
  return Object.fromEntries(Object.entries(state.countryStocks).flatMap(([countryId, stocks]) => {
    const gold = stocks.or;
    return gold ? [[countryId, {
      countryId,
      identifiedReservesTonnes: gold.identifiedStock,
      probableReservesTonnes: gold.probableStock,
      frontierPotentialTonnes: gold.frontierPotential,
      confidence: gold.confidence,
      source: 'Registre commun des gisements aurifères · agrégation territoriale',
      lastUpdatedAt: state.lastUpdatedAt,
    } satisfies GoldCountryStock]] : [];
  })) as Record<CountryId, GoldCountryStock>;
}

export function contestedResourceDeposits(state: ResourceState) {
  return Object.values(state.deposits).filter((deposit) => deposit.legalStatus !== 'undisputed' || deposit.claimantEntityIds.length > 1);
}
