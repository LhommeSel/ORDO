import type { CountryId, CountryState, GoldCountryStock, WorldState } from './types';

/**
 * Réserves géologiques calibrées au 1er janvier 2000.
 *
 * Les chiffres sont en tonnes d'or contenu. `identified` correspond au stock
 * déjà documenté et techniquement repérable ; `probable` couvre les extensions
 * encore incertaines ; `frontier` désigne un potentiel qui exige de nouvelles
 * campagnes d'exploration. Il ne s'agit ni d'une production annuelle ni des
 * réserves officielles des banques centrales.
 *
 * La base est volontairement arrondie : elle sert à créer des contraintes de
 * jeu et des écarts de capacité, pas à afficher une précision statistique
 * artificielle. Références de calibration : USGS Mineral Commodity Summaries,
 * British Geological Survey et séries historiques World Gold Council, autour
 * de 2000.
 */
type GoldStockInput = Omit<GoldCountryStock, 'countryId' | 'lastUpdatedAt'>;

const explicitGoldStocks: Record<CountryId, GoldStockInput> = {
  ZAF: { identifiedReservesTonnes: 19000, probableReservesTonnes: 6000, frontierPotentialTonnes: 4500, confidence: 'high', source: 'USGS/BGS · grands bassins aurifères sud-africains' },
  AUS: { identifiedReservesTonnes: 6100, probableReservesTonnes: 2600, frontierPotentialTonnes: 2500, confidence: 'high', source: 'USGS/BGS · Australie occidentale et Territoire du Nord' },
  USA: { identifiedReservesTonnes: 5600, probableReservesTonnes: 2300, frontierPotentialTonnes: 1800, confidence: 'high', source: 'USGS · Nevada, Alaska et autres districts' },
  CHN: { identifiedReservesTonnes: 4000, probableReservesTonnes: 2200, frontierPotentialTonnes: 2500, confidence: 'medium', source: 'USGS/BGS · provinces aurifères chinoises' },
  RUS: { identifiedReservesTonnes: 3500, probableReservesTonnes: 2600, frontierPotentialTonnes: 3000, confidence: 'medium', source: 'USGS/BGS · Sibérie orientale et Extrême-Orient' },
  CAN: { identifiedReservesTonnes: 1500, probableReservesTonnes: 1100, frontierPotentialTonnes: 1200, confidence: 'high', source: 'USGS · Ontario, Québec, Colombie-Britannique et Nunavut' },
  PER: { identifiedReservesTonnes: 3500, probableReservesTonnes: 1800, frontierPotentialTonnes: 1300, confidence: 'medium', source: 'USGS/BGS · Andes et ceinture minière péruvienne' },
  IDN: { identifiedReservesTonnes: 3000, probableReservesTonnes: 1800, frontierPotentialTonnes: 1600, confidence: 'medium', source: 'USGS · Papouasie et arcs volcaniques indonésiens' },
  UZB: { identifiedReservesTonnes: 1800, probableReservesTonnes: 1000, frontierPotentialTonnes: 700, confidence: 'medium', source: 'USGS · complexe de Muruntau et Kyzylkum' },
  GHA: { identifiedReservesTonnes: 1500, probableReservesTonnes: 900, frontierPotentialTonnes: 850, confidence: 'high', source: 'USGS · Ashanti et ceinture birimienne' },
  BRA: { identifiedReservesTonnes: 1600, probableReservesTonnes: 1300, frontierPotentialTonnes: 1500, confidence: 'medium', source: 'USGS · Minas Gerais, Amazonie et Pará' },
  MEX: { identifiedReservesTonnes: 1400, probableReservesTonnes: 900, frontierPotentialTonnes: 1000, confidence: 'medium', source: 'USGS · Sonora, Zacatecas et Guerrero' },
  PNG: { identifiedReservesTonnes: 1500, probableReservesTonnes: 1100, frontierPotentialTonnes: 1000, confidence: 'medium', source: 'USGS · Bougainville, Highlands et Morobe' },
  ARG: { identifiedReservesTonnes: 1200, probableReservesTonnes: 1000, frontierPotentialTonnes: 1400, confidence: 'medium', source: 'USGS · Andes argentines et Patagonie' },
  CHL: { identifiedReservesTonnes: 1300, probableReservesTonnes: 900, frontierPotentialTonnes: 1000, confidence: 'medium', source: 'USGS · Andes et districts du nord chilien' },
  TZA: { identifiedReservesTonnes: 1000, probableReservesTonnes: 800, frontierPotentialTonnes: 900, confidence: 'medium', source: 'USGS · ceinture du Lac Victoria' },
  MLI: { identifiedReservesTonnes: 800, probableReservesTonnes: 700, frontierPotentialTonnes: 800, confidence: 'medium', source: 'USGS · Birimien malien' },
  COL: { identifiedReservesTonnes: 600, probableReservesTonnes: 500, frontierPotentialTonnes: 700, confidence: 'medium', source: 'USGS · Antioquia et Chocó' },
  KAZ: { identifiedReservesTonnes: 600, probableReservesTonnes: 500, frontierPotentialTonnes: 700, confidence: 'medium', source: 'USGS · Kazakhstan oriental et central' },
  KGZ: { identifiedReservesTonnes: 500, probableReservesTonnes: 300, frontierPotentialTonnes: 300, confidence: 'medium', source: 'USGS · Kumtor et Tian Shan' },
  PHL: { identifiedReservesTonnes: 800, probableReservesTonnes: 700, frontierPotentialTonnes: 900, confidence: 'low', source: 'USGS · archipel aurifère philippin' },
  MMR: { identifiedReservesTonnes: 500, probableReservesTonnes: 450, frontierPotentialTonnes: 700, confidence: 'low', source: 'BGS/USGS · provinces aurifères birmanes' },
  MNG: { identifiedReservesTonnes: 200, probableReservesTonnes: 300, frontierPotentialTonnes: 500, confidence: 'low', source: 'USGS · ceinture de l’Altaï et Gobi' },
  LAO: { identifiedReservesTonnes: 200, probableReservesTonnes: 250, frontierPotentialTonnes: 350, confidence: 'low', source: 'USGS · provinces aurifères du Laos' },
  VNM: { identifiedReservesTonnes: 100, probableReservesTonnes: 180, frontierPotentialTonnes: 250, confidence: 'low', source: 'USGS/BGS · districts aurifères vietnamiens' },
  NZL: { identifiedReservesTonnes: 250, probableReservesTonnes: 180, frontierPotentialTonnes: 180, confidence: 'medium', source: 'USGS · île du Sud et Waihi' },
  TUR: { identifiedReservesTonnes: 300, probableReservesTonnes: 250, frontierPotentialTonnes: 400, confidence: 'low', source: 'USGS · Anatolie occidentale' },
  IRN: { identifiedReservesTonnes: 250, probableReservesTonnes: 300, frontierPotentialTonnes: 500, confidence: 'low', source: 'USGS · zones métallogéniques iraniennes' },
  COD: { identifiedReservesTonnes: 600, probableReservesTonnes: 800, frontierPotentialTonnes: 1200, confidence: 'low', source: 'USGS/BGS · stocks très incertains et accès limité' },
  ZWE: { identifiedReservesTonnes: 500, probableReservesTonnes: 450, frontierPotentialTonnes: 600, confidence: 'low', source: 'USGS · ceinture de roches vertes du Zimbabwe' },
  FRA: { identifiedReservesTonnes: 120, probableReservesTonnes: 220, frontierPotentialTonnes: 350, confidence: 'low', source: 'USGS/BGS · Guyane et petits districts métropolitains' },
  GBR: { identifiedReservesTonnes: 300, probableReservesTonnes: 220, frontierPotentialTonnes: 250, confidence: 'low', source: 'BGS · potentiel historique et filons gallois' },
  DEU: { identifiedReservesTonnes: 50, probableReservesTonnes: 80, frontierPotentialTonnes: 120, confidence: 'low', source: 'BGS · potentiel métallogénique allemand' },
  ESP: { identifiedReservesTonnes: 30, probableReservesTonnes: 70, frontierPotentialTonnes: 120, confidence: 'low', source: 'BGS · districts ibériques' },
  POL: { identifiedReservesTonnes: 60, probableReservesTonnes: 100, frontierPotentialTonnes: 150, confidence: 'low', source: 'BGS · Sudètes et districts polonais' },
  SWE: { identifiedReservesTonnes: 60, probableReservesTonnes: 80, frontierPotentialTonnes: 140, confidence: 'low', source: 'BGS · bouclier fenno-scandien' },
  FIN: { identifiedReservesTonnes: 20, probableReservesTonnes: 60, frontierPotentialTonnes: 100, confidence: 'low', source: 'BGS · bouclier finlandais' },
  JPN: { identifiedReservesTonnes: 8, probableReservesTonnes: 20, frontierPotentialTonnes: 30, confidence: 'high', source: 'BGS · districts historiques japonais' },
  KOR: { identifiedReservesTonnes: 50, probableReservesTonnes: 80, frontierPotentialTonnes: 120, confidence: 'low', source: 'BGS · provinces métallogéniques coréennes' },
  SAU: { identifiedReservesTonnes: 15, probableReservesTonnes: 60, frontierPotentialTonnes: 120, confidence: 'low', source: 'USGS/BGS · bouclier arabique' },
};

function fallbackStock(country: CountryState): GoldStockInput {
  const mineralSignal = country.strategy.vulnerabilities.some((item) => /\bmin\w*|\bressource\w*|\baurif\w*|\bmétal\w*/i.test(item));
  return {
    identifiedReservesTonnes: mineralSignal ? 25 : 0,
    probableReservesTonnes: mineralSignal ? 45 : 5,
    frontierPotentialTonnes: mineralSignal ? 80 : 10,
    confidence: 'low',
    source: 'Calibration de couverture mondiale · stock aurifère non documenté au niveau pays',
  };
}

export function createGoldStocks2000(countries: Record<CountryId, CountryState>, date: GoldCountryStock['lastUpdatedAt'] = '2000-01-01') {
  return Object.fromEntries(Object.values(countries).map((country) => {
    const input = explicitGoldStocks[country.id] ?? fallbackStock(country);
    return [country.id, { countryId: country.id, ...input, lastUpdatedAt: date } satisfies GoldCountryStock];
  })) as Record<CountryId, GoldCountryStock>;
}

export function goldStockForCountry(state: WorldState, countryId: CountryId) {
  return state.goldStocks?.[countryId] ?? createGoldStocks2000(state.countries, state.currentDate)[countryId];
}

export function goldReserveTotals(state: WorldState) {
  return Object.values(state.goldStocks ?? createGoldStocks2000(state.countries, state.currentDate)).reduce((total, stock) => ({
    identifiedReservesTonnes: total.identifiedReservesTonnes + stock.identifiedReservesTonnes,
    probableReservesTonnes: total.probableReservesTonnes + stock.probableReservesTonnes,
    frontierPotentialTonnes: total.frontierPotentialTonnes + stock.frontierPotentialTonnes,
  }), { identifiedReservesTonnes: 0, probableReservesTonnes: 0, frontierPotentialTonnes: 0 });
}
