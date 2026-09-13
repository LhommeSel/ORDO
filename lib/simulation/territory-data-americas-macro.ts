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
 * Mailles de jeu stables, sans prétendre reconstituer les comptes régionaux
 * historiques. Les totaux sont toujours ceux des observations nationales WDI.
 */
const definitions: Record<'USA' | 'CAN' | 'MEX' | 'BRA', MacroRegionDefinition[]> = {
  USA: [
    r('northeast', 'Nord-Est et corridor atlantique', .18, 1.35, -74, 40.7),
    r('great-lakes', 'Grands Lacs et Midwest industriel', .22, 1.05, -87, 42.0),
    r('south-gulf', 'Sud et golfe du Mexique', .23, 1.0, -90, 32.0),
    r('mountain-plains', 'Grandes Plaines et Rocheuses', .15, .85, -104, 40.0),
    r('pacific', 'Ouest pacifique et Californie', .22, 1.45, -119, 36.0),
  ],
  CAN: [
    r('ontario', 'Ontario et corridor des Grands Lacs', .38, 1.35, -79, 44.0),
    r('quebec', 'Québec et Saint-Laurent', .24, 1.05, -71, 46.0),
    r('prairies', 'Prairies et Alberta', .18, 1.1, -111, 53.0),
    r('pacific', 'Colombie-Britannique et Pacifique', .12, 1.15, -123, 49.0),
    r('atlantic-north', 'Atlantique et Nord', .08, .7, -65, 47.0),
  ],
  MEX: [
    r('central', 'Vallée de Mexico et centre', .30, 1.3, -99, 19.5),
    r('north-border', 'Nord frontalier et industriels exportateurs', .23, 1.2, -105, 27.5),
    r('west-bajio', 'Bajío et façade pacifique', .20, 1.0, -103, 21.5),
    r('gulf-southeast', 'Golfe, péninsule du Yucatán et Sud-Est', .15, .85, -91, 19.0),
    r('south', 'Sud montagneux et Chiapas', .12, .68, -96, 17.0),
  ],
  BRA: [
    r('southeast', 'Sud-Est industriel et financier', .42, 1.4, -46, -23.0),
    r('south', 'Sud agro-industriel', .15, 1.1, -52, -29.0),
    r('northeast', 'Nord-Est littoral et intérieur', .20, .85, -39, -9.0),
    r('center-west', 'Centre-Ouest et Cerrado', .12, .9, -56, -15.0),
    r('north-amazon', 'Nord amazonien', .11, .7, -60, -3.0),
  ],
};

const macroEconomies = createMacroEconomies2000();

function seeds(countryId: keyof typeof definitions): TerritorySeed[] {
  const economy = macroEconomies[countryId];
  const regions = definitions[countryId];
  const totalPopulationWeight = regions.reduce((sum, region) => sum + region.populationShare, 0);
  return regions.map((region) => ({
    id: `${countryId}:macro-${region.suffix}`,
    name: region.name,
    kind: 'region',
    referencePopulation: economy.populationMillions * 1e6 * region.populationShare / totalPopulationWeight,
    referenceYear: 2000,
    economicWeight: region.populationShare * region.productivity,
    inNationalAccounts: true,
    mapGroup: 'national',
    anchor: region.anchor,
    sourceIds: [worldBankWdi2000Source.id],
    note: 'Maille macro-régionale ORDO : répartition normalisée sur les totaux nationaux WDI 2000. Elle sert aux chocs territoriaux et ne prétend pas être une statistique régionale observée.',
  }));
}

export const americasMacroTerritoryDatasets: Record<string, TerritoryDataset> = Object.fromEntries(
  Object.keys(definitions).map((countryId) => [countryId, {
    countryId,
    territories: seeds(countryId as keyof typeof definitions),
    assets: [],
    entities: [],
  } satisfies TerritoryDataset]),
);
