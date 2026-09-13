import { createMacroEconomies2000 } from './macro-data-2000';
import { worldBankWdi2000Source } from './macro-observations-2000';
import type { TerritoryDataset, TerritorySeed } from './territory-types';

type MacroRegionDefinition = {
  suffix: string;
  name: string;
  populationShare: number;
  productivity: number;
  anchor: [number, number];
};

const r = (suffix: string, name: string, populationShare: number, productivity: number, lon: number, lat: number): MacroRegionDefinition => ({
  suffix, name, populationShare, productivity, anchor: [lon, lat],
});

/**
 * Extension de la maille américaine : les quatre économies déjà documentées
 * restent dans territory-data-americas-macro.ts. Ici, on couvre les autres
 * pays présents dans le registre mondial avec des zones de jeu stables.
 *
 * Ce ne sont pas des comptes régionaux observés : les totaux nationaux restent
 * ceux du macro-moteur, puis sont ventilés par poids pour les chocs, les
 * transferts de contrôle et l'affichage de la carte.
 */
const definitions: Record<string, MacroRegionDefinition[]> = {
  ARG: [r('pampas', 'Pampas et Buenos Aires', .42, 1.35, -58.4, -34.6), r('northwest', 'Nord-Ouest et Andes', .22, .8, -65.5, -26.5), r('northeast', 'Nord-Est subtropical', .18, .78, -58.0, -27.5), r('patagonia', 'Patagonie et Sud', .18, .9, -68.0, -43.0)],
  BOL: [r('la-paz', 'Altiplano et La Paz', .32, 1.05, -68.1, -16.5), r('valleys', 'Vallées et Cochabamba', .28, 1.0, -66.2, -17.4), r('lowlands', 'Plaines orientales et Santa Cruz', .4, .9, -63.2, -17.8)],
  CHL: [r('central', 'Santiago et vallée centrale', .52, 1.35, -70.7, -33.4), r('north-mining', 'Nord minier et Atacama', .18, 1.1, -69.0, -23.5), r('south', 'Sud forestier et austral', .3, .85, -72.5, -40.5)],
  COL: [r('andean', 'Bogotá et cordillères', .45, 1.2, -74.1, 4.7), r('caribbean', 'Caraïbes et façade nord', .22, .95, -74.8, 10.5), r('pacific-west', 'Pacifique et vallées occidentales', .15, .82, -76.5, 4.0), r('orinoquia-amazon', 'Orénoquie et Amazonie', .18, .7, -70.0, 2.5)],
  ECU: [r('quito-highlands', 'Quito et Andes septentrionales', .38, 1.15, -78.5, -.2), r('guayaquil-coast', 'Guayaquil et côte pacifique', .4, 1.05, -79.9, -2.2), r('amazon', 'Oriente amazonien et Galápagos', .22, .7, -76.0, -1.5)],
  PER: [r('lima-coast', 'Lima et côte centrale', .36, 1.3, -77.0, -12.0), r('north-coast', 'Côte nord et Piura', .22, 1.0, -79.0, -5.2), r('andes', 'Andes centrales et méridionales', .27, .82, -72.0, -14.0), r('amazon', 'Amazonie péruvienne', .15, .65, -73.0, -5.0)],
  PRY: [r('asuncion', 'Asunción et axe oriental', .38, 1.15, -57.6, -25.3), r('paraguay-east', 'Paraguay oriental agricole', .4, .95, -55.5, -25.5), r('chaco', 'Chaco occidental', .22, .65, -59.5, -22.5)],
  URY: [r('montevideo', 'Montevideo et littoral sud', .48, 1.25, -56.2, -34.9), r('litoral', 'Littoral du Río Uruguay', .28, 1.0, -57.0, -32.0), r('interior', 'Intérieur rural et nord', .24, .8, -55.0, -31.0)],
  VEN: [r('caracas-coast', 'Caracas et façade caraïbe', .35, 1.25, -66.9, 10.5), r('maracaibo', 'Zulia et bassin pétrolier occidental', .2, 1.0, -71.7, 10.5), r('llanos', 'Llanos et centre', .25, .82, -67.5, 8.5), r('guayana', 'Guyana vénézuélien et Orénoque', .2, .75, -63.0, 6.5)],
  CRI: [r('central-valley', 'Vallée centrale et San José', .55, 1.3, -84.1, 9.9), r('pacific', 'Pacifique nord et central', .25, .95, -85.5, 10.2), r('caribbean-south', 'Caraïbes et Sud', .2, .82, -83.0, 9.3)],
  GTM: [r('guatemala-city', 'Guatemala central et capitale', .38, 1.2, -90.5, 14.6), r('pacific-highlands', 'Hautes terres et façade pacifique', .32, .9, -91.2, 14.0), r('caribbean-petén', 'Caraïbes, Petén et Nord', .3, .72, -89.5, 16.0)],
  HND: [r('tegucigalpa', 'Tegucigalpa et hautes terres', .35, 1.05, -87.2, 14.1), r('north-coast', 'Côte caraïbe et San Pedro Sula', .4, .95, -87.9, 15.5), r('pacific-east', 'Sud et golfe de Fonseca', .25, .75, -87.0, 13.4)],
  NIC: [r('managua', 'Managua et lacs du centre', .38, 1.1, -86.3, 12.1), r('pacific-west', 'Côte pacifique et volcans', .3, .95, -86.8, 11.7), r('caribbean-east', 'Caraïbes et côte atlantique', .32, .65, -83.5, 13.0)],
  PAN: [r('canal-capital', 'Panama et zone du canal', .5, 1.45, -79.5, 9.0), r('caribbean', 'Caraïbes et Colón', .2, 1.0, -79.9, 9.4), r('interior-pacific', 'Intérieur et Pacifique', .3, .82, -80.5, 8.0)],
  SLV: [r('san-salvador', 'San Salvador et centre', .5, 1.2, -89.2, 13.7), r('west-pacific', 'Ouest et côte pacifique', .28, .95, -89.6, 13.8), r('east-highlands', 'Est et hauts plateaux', .22, .78, -88.1, 13.5)],
  BLZ: [r('belize-city', 'Belize City et littoral', .5, 1.05, -88.2, 17.5), r('inland-north', 'Nord intérieur', .25, .75, -88.7, 18.2), r('south', 'Districts du Sud', .25, .72, -88.4, 16.8)],
  CUB: [r('havana-west', 'La Havane et Ouest', .4, 1.2, -82.4, 23.1), r('central', 'Centre sucrier et Camagüey', .3, .85, -77.9, 21.4), r('east', 'Oriente et Santiago', .3, .82, -75.8, 20.0)],
  DOM: [r('santo-domingo', 'Santo Domingo et Sud-Est', .45, 1.2, -69.9, 18.5), r('cibao', 'Cibao et Santiago', .35, 1.0, -70.7, 19.4), r('east-west', 'Est touristique et Ouest', .2, .82, -68.8, 18.8)],
  HTI: [r('port-au-prince', 'Port-au-Prince et Ouest', .42, .95, -72.3, 18.6), r('north', 'Nord et Cap-Haïtien', .28, .75, -72.2, 19.7), r('south', 'Sud et péninsule', .3, .7, -73.0, 18.2)],
  JAM: [r('kingston', 'Kingston et Sud-Est', .42, 1.25, -76.8, 18.0), r('north-coast', 'Côte nord touristique', .35, 1.0, -77.3, 18.4), r('interior-west', 'Intérieur et Ouest', .23, .78, -77.8, 18.2)],
  GUY: [r('georgetown', 'Georgetown et côte est', .55, 1.15, -58.2, 6.8), r('coast-west', 'Côte occidentale agricole', .2, .9, -58.7, 7.2), r('interior', 'Intérieur forestier et minier', .25, .68, -59.5, 5.5)],
  SUR: [r('paramaribo', 'Paramaribo et littoral', .65, 1.15, -55.2, 5.8), r('east-coast', 'Maroni et Est frontalier', .15, .8, -54.0, 5.7), r('interior', 'Intérieur forestier et minier', .2, .65, -56.0, 4.5)],
  TTO: [r('trinidad', 'Trinité et Port of Spain', .85, 1.25, -61.5, 10.6), r('tobago', 'Tobago', .15, .9, -60.7, 11.2)],
  BHS: [r('new-providence', 'New Providence et Nassau', .7, 1.25, -77.4, 25.0), r('grand-bahama', 'Grand Bahama', .15, 1.0, -78.0, 26.6), r('outer-islands', 'Îles extérieures', .15, .7, -74.0, 23.0)],
  BRB: [r('bridgetown', 'Bridgetown et Sud-Ouest', .65, 1.2, -59.6, 13.1), r('central-east', 'Centre et Est', .35, .9, -59.5, 13.2)],
  ATG: [r('antigua', 'Antigua et Saint John’s', .8, 1.15, -61.8, 17.1), r('barbuda', 'Barbuda et dépendances', .2, .7, -61.8, 17.6)],
  DMA: [r('roseau', 'Roseau et côte ouest', .6, 1.05, -61.4, 15.3), r('interior-east', 'Massif intérieur et côte est', .4, .75, -61.3, 15.4)],
  GRD: [r('st-georges', 'Saint-Georges et Sud-Ouest', .65, 1.15, -61.75, 12.05), r('north-east', 'Nord et intérieur', .35, .78, -61.65, 12.15)],
  KNA: [r('st-kitts', 'Saint-Christophe et Basseterre', .75, 1.15, -62.72, 17.3), r('nevis', 'Nevis', .25, .8, -62.58, 17.15)],
  LCA: [r('castries', 'Castries et Nord-Ouest', .55, 1.15, -60.99, 14.0), r('south-east', 'Sud et côte orientale', .45, .82, -60.9, 13.8)],
  VCT: [r('st-vincent', 'Saint-Vincent et Kingstown', .75, 1.1, -61.2, 13.15), r('grenadines', 'Grenadines', .25, .78, -61.25, 12.9)],
};

const macroEconomies = createMacroEconomies2000();

const regionSeeds = (countryId: string): TerritorySeed[] => {
  const economy = macroEconomies[countryId];
  const regions = definitions[countryId] ?? [];
  if (!economy || !regions.length) return [];
  const populationWeightTotal = regions.reduce((sum, region) => sum + region.populationShare, 0);
  return regions.map((region) => ({
    id: `${countryId}:macro-${region.suffix}`,
    name: region.name,
    kind: 'region' as const,
    referencePopulation: economy.populationMillions * 1e6 * region.populationShare / populationWeightTotal,
    referenceYear: 2000,
    economicWeight: region.populationShare * region.productivity,
    inNationalAccounts: true,
    mapGroup: 'national',
    anchor: region.anchor,
    sourceIds: [worldBankWdi2000Source.id],
    note: 'Maille macro-régionale ORDO : répartition normalisée sur les totaux nationaux 2000. Les frontières administratives détaillées ne sont pas encore chargées.',
  }));
};

export const extendedAmericasTerritoryDatasets: Record<string, TerritoryDataset> = Object.fromEntries(
  Object.keys(definitions).map((countryId) => [countryId, {
    countryId,
    territories: regionSeeds(countryId),
    assets: [],
    entities: [],
  } satisfies TerritoryDataset]),
);
