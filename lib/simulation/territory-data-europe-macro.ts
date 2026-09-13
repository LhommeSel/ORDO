import { createMacroEconomies2000 } from './macro-data-2000';
import type { TerritoryDataset, TerritorySeed } from './territory-types';

/**
 * Périmètre européen du premier lot territorial.
 *
 * Les quatre pays déjà couverts par les contours NUTS (DEU, ESP, GBR, ITA)
 * ainsi que la France sont inclus dans le périmètre, mais ne sont pas générés
 * ici. ARM, AZE, GEO, KAZ, RUS et TUR sont conservés car le scénario les traite
 * comme des puissances ou des interfaces européennes ; leurs mailles couvrent
 * le territoire national entier, pas seulement la partie géographiquement
 * européenne.
 */
export const europeanTerritorialCountryIds = [
  'ALB', 'AND', 'ARM', 'AUT', 'AZE', 'BEL', 'BLR', 'BIH', 'BGR', 'CHE', 'CYP', 'CZE',
  'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GBR', 'GEO', 'GRC', 'HRV', 'HUN', 'IRL',
  'ISL', 'ITA', 'KAZ', 'LIE', 'LTU', 'LUX', 'LVA', 'MDA', 'MCO', 'MKD', 'MLT', 'MNE',
  'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'RUS', 'SMR', 'SRB', 'SVK', 'SVN', 'SWE', 'TUR',
  'UKR', 'VAT',
] as const;

export type MacroRegionDefinition = {
  suffix: string;
  name: string;
  /** Relative population weight; normalized before it enters the accounts. */
  populationShare: number;
  /** Relative productivity multiplier used only to allocate national GDP. */
  productivity: number;
  anchor: [number, number];
};

const r = (suffix: string, name: string, populationShare: number, productivity: number, lon: number, lat: number): MacroRegionDefinition => ({
  suffix, name, populationShare, productivity, anchor: [lon, lat],
});

/**
 * Zones macro-économiques, volontairement peu nombreuses : elles donnent au
 * moteur une maille stable pour les chocs et transferts sans inventer des
 * statistiques régionales pour les pays qui n'ont pas encore été documentés.
 */
const definitions: Record<string, MacroRegionDefinition[]> = {
  ALB: [r('tirana', 'Tirana et centre urbain', .32, 1.25, 19.82, 41.33), r('north', 'Albanie du Nord', .33, .82, 19.7, 42.2), r('south', 'Albanie du Sud', .35, .9, 20.1, 40.4)],
  AND: [r('valleys', 'Vallées urbanisées', .65, 1.1, 1.52, 42.51), r('mountains', 'Massifs et communes d’altitude', .35, .8, 1.58, 42.56)],
  ARM: [r('yerevan', 'Erevan et plaine de l’Ararat', .36, 1.3, 44.52, 40.18), r('north', 'Nord industriel', .25, .9, 44.5, 40.95), r('south', 'Sud et Syunik', .2, .8, 45.2, 39.3), r('highlands', 'Hauts plateaux centraux', .19, .75, 44.1, 40.6)],
  AUT: [r('vienna', 'Vienne et bassin viennois', .24, 1.35, 16.37, 48.21), r('east', 'Basse-Autriche et Burgenland', .24, 1.05, 15.9, 48.1), r('alps', 'Tyrol et Vorarlberg', .25, .95, 11.4, 47.25), r('south', 'Styrie et Carinthie', .17, .9, 14.3, 46.8), r('west', 'Haute-Autriche et Salzbourg', .1, .98, 13.2, 48.1)],
  AZE: [r('baku', 'Bakou et péninsule d’Absheron', .32, 1.4, 49.87, 40.4), r('caspian', 'Littoral caspien et sud', .2, 1.0, 48.8, 39.1), r('north', 'Nord du Caucase', .2, .82, 47.2, 41.1), r('west', 'Ouest montagneux', .16, .85, 46.4, 40.7), r('nakhchivan', 'Nakhitchevan', .12, .65, 45.4, 39.2)],
  BEL: [r('brussels', 'Bruxelles et Brabant', .14, 1.6, 4.35, 50.85), r('flanders', 'Flandre', .42, 1.25, 4.2, 51.1), r('wallonia', 'Wallonie industrielle', .37, .95, 5.5, 50.5), r('ardennes', 'Ardenne et Luxembourg belge', .07, .75, 5.5, 50.0)],
  BLR: [r('minsk', 'Minsk et axe central', .2, 1.35, 27.56, 53.9), r('west', 'Ouest biélorusse', .23, .9, 25.3, 53.7), r('center', 'Centre agricole', .2, .95, 28.2, 53.2), r('east', 'Est industriel', .2, .9, 30.4, 53.7), r('polesie', 'Polésie méridionale', .17, .8, 28.3, 52.0)],
  BIH: [r('sarajevo', 'Sarajevo et centre montagneux', .25, 1.25, 18.4, 43.85), r('north', 'Nord et vallée de la Save', .32, .95, 18.0, 44.8), r('west', 'Ouest bosnien', .2, .8, 16.8, 44.2), r('east', 'Est et vallée de la Drina', .13, .75, 19.1, 44.2), r('herzegovina', 'Herzégovine', .1, .9, 17.8, 43.1)],
  BGR: [r('sofia', 'Sofia et bassin occidental', .18, 1.35, 23.32, 42.7), r('north', 'Plaine du Danube', .28, .9, 25.4, 43.6), r('south', 'Thrace et Rhodopes', .25, 1.0, 24.8, 42.1), r('black-sea', 'Littoral de la mer Noire', .17, 1.05, 27.5, 42.7), r('southwest', 'Sud-Ouest montagneux', .12, .8, 23.0, 42.2)],
  CHE: [r('zurich', 'Zurich et nord-est alémanique', .22, 1.45, 8.54, 47.38), r('geneva', 'Arc lémanique', .15, 1.4, 6.15, 46.2), r('basel', 'Bâle et couloir rhénan', .12, 1.35, 7.6, 47.55), r('plateau', 'Plateau central', .27, 1.05, 7.4, 46.9), r('alps', 'Alpes et Grisons', .24, .8, 8.1, 46.7)],
  CYP: [r('nicosia', 'Nicosie et intérieur', .38, 1.2, 33.38, 35.17), r('south-west', 'Côtes sud et ouest', .38, 1.1, 32.7, 34.8), r('east-north', 'Est et péninsule de Karpas', .24, .8, 33.9, 35.3)],
  CZE: [r('prague', 'Prague et Bohême centrale', .12, 1.55, 14.44, 50.08), r('bohemia', 'Bohême occidentale et méridionale', .25, 1.1, 13.3, 49.8), r('moravia', 'Moravie', .34, 1.0, 16.6, 49.2), r('north', 'Bohême du Nord', .17, .9, 14.1, 50.7), r('silesia', 'Silésie', .12, .95, 18.0, 49.9)],
  DNK: [r('copenhagen', 'Copenhague et capitale', .26, 1.45, 12.57, 55.68), r('zealand', 'Sjælland hors capitale', .12, 1.15, 11.8, 55.4), r('jutland-east', 'Jutland oriental', .28, 1.05, 10.2, 56.1), r('jutland-west', 'Jutland occidental', .24, .95, 8.7, 56.2), r('islands', 'Fionie et îles périphériques', .1, .8, 10.2, 55.3)],
  EST: [r('tallinn', 'Tallinn et axe nord', .3, 1.4, 24.75, 59.44), r('north-coast', 'Littoral nord-est', .22, 1.1, 27.3, 59.4), r('east', 'Ida-Viru et frontière orientale', .2, .8, 27.3, 59.2), r('south', 'Sud et îles', .28, .85, 26.0, 58.5)],
  FIN: [r('helsinki', 'Helsinki et Uusimaa', .2, 1.45, 24.94, 60.17), r('southwest', 'Finlande du Sud-Ouest', .22, 1.1, 22.3, 60.45), r('west', 'Ouest et Tampere', .25, 1.0, 23.8, 61.5), r('east', 'Lacs et frontière orientale', .15, .8, 28.0, 62.2), r('north', 'Ostrobotnie et Laponie', .18, .7, 26.0, 66.0)],
  GEO: [r('tbilisi', 'Tbilissi et vallée de la Koura', .25, 1.35, 44.8, 41.7), r('black-sea', 'Littoral de la mer Noire', .25, .95, 41.7, 42.0), r('east', 'Kakhétie et est', .2, .9, 45.9, 41.8), r('mountains', 'Grand Caucase et hauts plateaux', .15, .7, 43.2, 42.4), r('adjara', 'Adjarie', .15, .9, 41.6, 41.6)],
  GRC: [r('attica', 'Athènes et Attique', .34, 1.35, 23.72, 38.0), r('macedonia', 'Macédoine et Thrace', .2, .95, 22.9, 40.7), r('central-thessaly', 'Grèce centrale et Thessalie', .18, .95, 22.3, 39.5), r('peloponnese', 'Péloponnèse et Grèce occidentale', .16, .85, 21.6, 37.6), r('islands', 'Îles et Crète', .12, .9, 25.1, 35.2)],
  HRV: [r('zagreb', 'Zagreb et nord-ouest', .2, 1.4, 15.98, 45.81), r('north', 'Slavonie du Nord', .24, 1.05, 18.0, 46.0), r('adriatic-north', 'Istrie et littoral nord', .22, 1.15, 14.5, 45.3), r('dalmatia', 'Dalmatie', .22, .95, 16.4, 43.5), r('slavonia', 'Slavonie orientale et arrière-pays', .12, .8, 18.7, 45.4)],
  HUN: [r('budapest', 'Budapest et aire métropolitaine', .2, 1.5, 19.04, 47.5), r('transdanubia', 'Transdanubie centrale', .25, 1.05, 18.0, 47.2), r('west', 'Ouest transdanubien', .2, 1.1, 17.1, 47.6), r('plain', 'Grande Plaine', .23, .85, 20.5, 47.1), r('north', 'Nord et massif du Bükk', .12, .8, 20.3, 48.1)],
  IRL: [r('dublin', 'Dublin et Est', .37, 1.4, -6.26, 53.35), r('south', 'Munster et côte sud', .23, 1.1, -8.5, 52.1), r('west', 'Connacht et côte ouest', .17, .85, -9.0, 53.3), r('midlands-north', 'Midlands et Nord-Ouest', .23, .8, -7.8, 53.7)],
  ISL: [r('capital', 'Région de la capitale', .65, 1.35, -21.9, 64.15), r('north', 'Nord et fjords de l’Ouest', .15, .9, -19.0, 65.5), r('south', 'Sud et Est islandais', .2, .85, -18.5, 63.8)],
  KAZ: [r('almaty', 'Almaty et Sud', .28, 1.05, 76.9, 43.2), r('astana', 'Astana et centre', .17, 1.1, 71.4, 51.2), r('caspian', 'Ouest caspien et hydrocarbures', .22, 1.35, 51.4, 47.1), r('north', 'Nord céréalier', .2, .95, 69.0, 53.3), r('east', 'Est et Altaï', .13, .9, 82.6, 49.9)],
  LIE: [r('rhine', 'Vallée du Rhin et Vaduz', .65, 1.2, 9.52, 47.14), r('alps', 'Communes alpines', .35, .9, 9.55, 47.2)],
  LTU: [r('vilnius', 'Vilnius et Sud-Est', .2, 1.35, 25.28, 54.69), r('kaunas', 'Kaunas et centre', .22, 1.15, 23.9, 54.9), r('klaipeda', 'Klaipėda et littoral occidental', .2, 1.1, 21.1, 55.7), r('north', 'Nord', .18, .85, 24.0, 56.0), r('south', 'Sud et Dzūkija', .2, .8, 24.2, 54.2)],
  LUX: [r('city', 'Luxembourg-ville et centre', .5, 1.4, 6.13, 49.61), r('south', 'Bassin industriel du Sud', .3, 1.1, 6.0, 49.5), r('north-east', 'Nord et Est rural', .2, .8, 6.2, 49.8)],
  LVA: [r('riga', 'Riga et golfe de Riga', .32, 1.4, 24.1, 56.95), r('coast', 'Littoral ouest', .2, 1.1, 21.5, 57.3), r('vidzeme', 'Vidzeme', .18, .85, 25.4, 57.3), r('kurzeme', 'Kurzeme', .15, .8, 22.8, 56.8), r('latgale', 'Latgale', .15, .75, 27.0, 56.5)],
  MDA: [r('chisinau', 'Chişinău et centre', .25, 1.3, 28.83, 47.0), r('north', 'Nord', .27, .9, 27.8, 47.8), r('center', 'Centre viticole', .2, .95, 28.4, 47.3), r('south', 'Sud et Gagaouzie', .16, .8, 28.6, 46.3), r('dniestr', 'Rive du Dniestr', .12, .85, 29.4, 47.4)],
  MCO: [r('urban', 'Principauté urbaine', .84, 1.25, 7.42, 43.73), r('port-heights', 'Quartiers portuaires et hauteurs', .16, 1.0, 7.42, 43.74)],
  MKD: [r('skopje', 'Skopje et bassin central', .32, 1.35, 21.43, 42.0), r('west', 'Ouest montagneux', .25, .9, 20.8, 41.5), r('east', 'Est industriel et agricole', .2, .85, 22.3, 41.8), r('south', 'Sud et Pélagonie', .23, .8, 21.3, 41.2)],
  MLT: [r('grand-harbour', 'Grand Harbour et agglomération', .42, 1.35, 14.51, 35.89), r('north', 'Nord de Malte', .25, 1.05, 14.35, 36.0), r('south-gozo', 'Sud de Malte et Gozo', .33, .8, 14.25, 35.85)],
  MNE: [r('podgorica', 'Podgorica et plaine du Zeta', .3, 1.25, 19.26, 42.44), r('coast', 'Littoral adriatique', .3, 1.1, 18.8, 42.2), r('north', 'Montagnes du Nord', .25, .8, 19.7, 43.0), r('central', 'Karst et centre', .15, .85, 19.1, 42.7)],
  NLD: [r('randstad-north', 'Randstad nord et Amsterdam', .28, 1.45, 4.9, 52.35), r('randstad-south', 'Randstad sud et Rotterdam', .25, 1.4, 4.5, 51.9), r('east', 'Est et Gelderland', .22, .95, 6.0, 52.2), r('south', 'Brabant et Limbourg', .15, 1.05, 5.3, 51.5), r('north', 'Frise et Nord', .1, .85, 5.8, 53.1)],
  NOR: [r('oslofjord', 'Oslofjord et capitale', .25, 1.35, 10.75, 59.9), r('west', 'Côte occidentale et industrie maritime', .25, 1.15, 5.3, 60.4), r('central', 'Trøndelag', .2, .95, 10.4, 63.4), r('north', 'Nordland et Troms-Finnmark', .17, .8, 18.9, 68.5), r('inland', 'Vallées et intérieur', .13, .75, 9.2, 61.2)],
  POL: [r('mazovia', 'Mazovie et Varsovie', .18, 1.5, 21.0, 52.2), r('south', 'Silésie et Sud industriel', .23, 1.1, 19.0, 50.2), r('west', 'Ouest et corridor Oder', .2, 1.05, 16.5, 52.1), r('north', 'Poméranie et Baltique', .18, .9, 18.5, 54.2), r('east', 'Est et frontière orientale', .21, .75, 23.0, 52.8)],
  PRT: [r('lisbon', 'Lisbonne et vallée du Tage', .28, 1.45, -9.14, 38.72), r('north-coast', 'Nord littoral', .29, 1.05, -8.4, 41.3), r('center', 'Centre', .18, .9, -8.0, 40.2), r('alentejo', 'Alentejo', .12, .8, -7.9, 38.4), r('algarve-islands', 'Algarve, Açores et Madère', .13, .95, -7.9, 37.1)],
  ROU: [r('bucharest', 'Bucarest et Ilfov', .18, 1.45, 26.1, 44.4), r('transylvania', 'Transylvanie et arc carpatique', .22, 1.05, 24.8, 46.0), r('wallachia', 'Valachie', .25, .9, 25.5, 44.8), r('moldova', 'Moldavie roumaine', .2, .8, 27.5, 47.2), r('dobrogea', 'Dobrogée et mer Noire', .15, .9, 28.5, 44.5)],
  RUS: [r('moscow-central', 'Moscou et Russie centrale', .2, 1.45, 37.6, 55.7), r('northwest', 'Nord-Ouest et Saint-Pétersbourg', .12, 1.15, 30.3, 59.9), r('volga', 'Volga et centre-sud', .18, 1.0, 49.1, 55.2), r('south-caucasus', 'Sud et Caucase du Nord', .16, .9, 43.5, 47.2), r('urals', 'Oural', .12, 1.2, 60.6, 56.8), r('siberia', 'Sibérie', .15, .85, 82.9, 55.0), r('far-east', 'Extrême-Orient', .07, .8, 135.0, 48.5)],
  SMR: [r('city', 'Città et centre historique', .45, 1.2, 12.45, 43.94), r('serravalle', 'Serravalle et Borgo Maggiore', .35, 1.0, 12.45, 43.96), r('south', 'Faetano et Montegiardino', .2, .8, 12.48, 43.91)],
  SRB: [r('belgrade', 'Belgrade et axe du Danube', .22, 1.4, 20.46, 44.8), r('vojvodina', 'Voïvodine', .25, 1.05, 19.7, 45.3), r('west', 'Ouest', .18, .8, 19.4, 43.8), r('central', 'Serbie centrale', .2, .85, 21.0, 43.7), r('south', 'Sud et vallée de la Morava', .15, .75, 21.9, 43.1)],
  SVK: [r('bratislava', 'Bratislava et Danube occidental', .16, 1.45, 17.1, 48.15), r('west', 'Ouest', .24, 1.1, 17.5, 48.8), r('central', 'Centre montagneux', .2, .9, 19.0, 48.8), r('east', 'Est', .23, .8, 21.3, 48.7), r('north', 'Tatras et nord', .17, .85, 19.7, 49.2)],
  SVN: [r('ljubljana', 'Ljubljana et centre', .2, 1.4, 14.5, 46.05), r('north-east', 'Nord-Est et Drava', .3, .95, 15.6, 46.5), r('alpine', 'Alpes et Nord-Ouest', .23, 1.1, 13.9, 46.3), r('littoral', 'Littoral adriatique', .17, 1.15, 13.7, 45.6), r('south-east', 'Sud-Est et Dolenjska', .1, .8, 15.1, 45.8)],
  SWE: [r('stockholm', 'Stockholm et Mälardalen', .24, 1.45, 18.1, 59.3), r('gothenburg-west', 'Göteborg et côte occidentale', .19, 1.2, 12.0, 57.7), r('skane-south', 'Scanie et Sud', .22, 1.1, 13.0, 55.9), r('central', 'Centre forestier et lacs', .2, .9, 15.0, 61.0), r('north', 'Norrland', .15, .8, 18.0, 65.5)],
  TUR: [r('marmara', 'Istanbul et Marmara', .25, 1.45, 29.0, 41.0), r('aegean', 'Égée et côte occidentale', .15, 1.1, 27.0, 38.5), r('central-anatolia', 'Anatolie centrale', .2, 1.0, 33.0, 39.5), r('mediterranean-southeast', 'Méditerranée et Sud-Est', .2, .9, 36.5, 37.0), r('black-sea-east', 'Mer Noire et Anatolie orientale', .2, .8, 37.5, 40.5)],
  UKR: [r('kyiv', 'Kyiv et centre-nord', .17, 1.35, 30.5, 50.4), r('east-industrial', 'Donbass et Est industriel', .25, 1.1, 37.8, 48.5), r('dnipro-central', 'Dniepr et centre', .2, .95, 34.9, 48.5), r('west', 'Ouest carpatique', .2, .85, 24.5, 49.2), r('south-black-sea', 'Sud et littoral de la mer Noire', .18, .9, 31.0, 46.8)],
  VAT: [r('vatican-city', 'Cité du Vatican', .7, 1.2, 12.45, 41.9), r('institutions', 'Institutions et emprises extraterritoriales', .3, .9, 12.48, 41.9)],
};

const macroEconomies = createMacroEconomies2000();

const regionSeeds = (countryId: string): TerritorySeed[] => {
  const economy = macroEconomies[countryId];
  const countryRegions = definitions[countryId] ?? [];
  if (!economy || !countryRegions.length) return [];
  const populationTotal = countryRegions.reduce((sum, region) => sum + region.populationShare, 0);
  return countryRegions.map((region) => ({
    id: `${countryId}:macro-${region.suffix}`, name: region.name, kind: 'region',
    referencePopulation: economy.populationMillions * 1e6 * region.populationShare / populationTotal,
    referenceYear: 2000, economicWeight: region.populationShare * region.productivity,
    inNationalAccounts: true, mapGroup: 'national', anchor: region.anchor, sourceIds: [],
    note: 'Maille macro-régionale ORDO : allocation de scénario 2000 normalisée sur la population et le PIB nationaux. Ce découpage n’est pas un compte régional observé ni une frontière administrative.',
  }));
};

export const europeMacroTerritoryDatasets: Record<string, TerritoryDataset> = Object.fromEntries(
  Object.keys(definitions).map((countryId) => [countryId, {
    countryId, territories: regionSeeds(countryId), assets: [], entities: [],
  } satisfies TerritoryDataset]),
);

