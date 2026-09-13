import raw from './data/europe-regions-2000.json';
import type { TerritorialAsset, TerritoryDataset, TerritorySeed } from './territory-types';
import { europeMacroTerritoryDatasets } from './territory-data-europe-macro';

type RawRegion = { id: string; name: string; code: string; population: number; economicWeight: number; populationBasis: string; economicBasis: string; anchor: [number, number] };
const data = raw as unknown as { countries: Record<string, RawRegion[]> };
const populationSource = 'eurostat-population-2000';
const gdpSource = 'eurostat-gdp-2000';
const geometrySource = 'gisco-nuts-2021';

const mapGroup = (countryId: string) => countryId === 'GBR' ? 'national' : 'national';
const regionSeeds = (countryId: string): TerritorySeed[] => (data.countries[countryId] ?? []).map((region) => ({
  id: region.id, name: region.name, kind: 'region', referencePopulation: region.population, referenceYear: 2000,
  economicWeight: region.economicWeight, inNationalAccounts: true, mapGroup: mapGroup(countryId), anchor: region.anchor,
  sourceIds: [populationSource, gdpSource, geometrySource],
  note: `${region.populationBasis === 'observed_2000' ? 'Population Eurostat 2000.' : 'Population calibrée.'} ${region.economicBasis === 'observed_2000' ? 'PIB régional Eurostat 2000.' : 'PIB calibré.'} Les contours sont un fond NUTS contemporain utilisé comme approximation historique.`,
}));

const sourceFor = (kind: TerritorialAsset['kind']) => kind === 'nuclear' ? 'iaea-pris' : kind === 'lng_terminal' ? 'energy-national' : 'major-infrastructure-inventory';
const names: Record<string, [string, string, string, TerritorialAsset['kind']][]> = {
  DEU: [
    ['hamburg', 'Port de Hambourg', 'DE6', 'port'], ['bremerhaven', 'Port de Bremerhaven', 'DE9', 'port'], ['duisburg', 'Port fluvial de Duisbourg', 'DEA', 'logistics'], ['kiel', 'Canal de Kiel', 'DEF', 'passage'], ['frankfurt-airport', 'Aéroport de Francfort', 'DE7', 'airport'], ['wolfsburg', 'Complexe Volkswagen de Wolfsburg', 'DE9', 'industrial'], ['ludwigshafen', 'Complexe chimique de Ludwigshafen', 'DEB', 'industrial'], ['dresden-micro', 'Pôle microélectronique de Dresde', 'DED', 'industrial'], ['kiel-naval', 'Chantiers navals de Kiel', 'DEF', 'industrial'], ['wilhelmshaven-naval', 'Base navale de Wilhelmshaven', 'DE9', 'naval_base'],
    ['biblis', 'Centrale nucléaire de Biblis', 'DE7', 'nuclear'], ['brokdorf', 'Centrale nucléaire de Brokdorf', 'DEF', 'nuclear'], ['brunsbuttel', 'Centrale nucléaire de Brunsbüttel', 'DEF', 'nuclear'], ['emsland', 'Centrale nucléaire d’Emsland', 'DE9', 'nuclear'], ['grafenrheinfeld', 'Centrale nucléaire de Grafenrheinfeld', 'DE2', 'nuclear'], ['grohnde', 'Centrale nucléaire de Grohnde', 'DE9', 'nuclear'], ['gundremmingen', 'Centrale nucléaire de Gundremmingen', 'DE1', 'nuclear'], ['isar', 'Centrale nucléaire d’Isar', 'DE2', 'nuclear'], ['kruemmel', 'Centrale nucléaire de Krümmel', 'DEF', 'nuclear'], ['neckarwestheim', 'Centrale nucléaire de Neckarwestheim', 'DE1', 'nuclear'], ['obrigheim', 'Centrale nucléaire d’Obrigheim', 'DE1', 'nuclear'], ['philippsburg', 'Centrale nucléaire de Philippsburg', 'DE1', 'nuclear'], ['stade', 'Centrale nucléaire de Stade', 'DE9', 'nuclear'], ['unterweser', 'Centrale nucléaire d’Unterweser', 'DE9', 'nuclear'],
  ],
  ESP: [
    ['algeciras', 'Port d’Algésiras', 'ES61', 'port'], ['valencia', 'Port de Valence', 'ES52', 'port'], ['barcelona', 'Port de Barcelone', 'ES51', 'port'], ['bilbao', 'Port de Bilbao', 'ES21', 'port'], ['barajas', 'Aéroport de Madrid-Barajas', 'ES30', 'airport'], ['irun', 'Passage d’Irún–Hendaye', 'ES21', 'passage'], ['jonquera', 'Passage de La Jonquera–Le Perthus', 'ES51', 'passage'], ['martorell', 'Complexe automobile de Martorell', 'ES51', 'industrial'], ['ferrol', 'Chantiers navals de Ferrol', 'ES11', 'industrial'], ['rota', 'Base navale de Rota', 'ES61', 'naval_base'],
    ['almaraz', 'Centrale nucléaire d’Almaraz', 'ES43', 'nuclear'], ['asco', 'Centrale nucléaire d’Ascó', 'ES51', 'nuclear'], ['cofrentes', 'Centrale nucléaire de Cofrentes', 'ES52', 'nuclear'], ['trillo', 'Centrale nucléaire de Trillo', 'ES30', 'nuclear'], ['vandellos', 'Centrale nucléaire de Vandellòs II', 'ES51', 'nuclear'], ['garona', 'Centrale nucléaire de Santa María de Garoña', 'ES41', 'nuclear'], ['jose-cabrera', 'Centrale nucléaire José Cabrera', 'ES30', 'nuclear'],
    ['lng-barcelona', 'Terminal méthanier de Barcelone', 'ES51', 'lng_terminal'], ['lng-huelva', 'Terminal méthanier de Huelva', 'ES61', 'lng_terminal'], ['lng-cartagena', 'Terminal méthanier de Carthagène', 'ES62', 'lng_terminal'], ['tarragona-refinery', 'Raffinerie de Tarragone', 'ES51', 'refinery'], ['algeciras-refinery', 'Raffinerie d’Algésiras–San Roque', 'ES61', 'refinery'],
  ],
  ITA: [
    ['genoa', 'Port de Gênes', 'ITC3', 'port'], ['trieste', 'Port de Trieste', 'ITH4', 'port'], ['gioia-tauro', 'Port de Gioia Tauro', 'ITF6', 'port'], ['brenner', 'Passage du Brenner', 'ITH12', 'passage'], ['frejus-ita', 'Passage du Fréjus', 'ITC1', 'passage'], ['malpensa', 'Aéroport de Milan-Malpensa', 'ITC4', 'airport'], ['rome-airport', 'Aéroport de Rome-Fiumicino', 'ITI4', 'airport'], ['mirafiori', 'Complexe automobile de Mirafiori', 'ITC1', 'industrial'], ['monfalcone', 'Chantiers navals de Monfalcone', 'ITH4', 'industrial'], ['taranto-naval', 'Base navale de Tarente', 'ITF4', 'naval_base'], ['sarroch', 'Raffinerie de Sarroch', 'ITG2', 'refinery'], ['augusta', 'Complexe de raffinage Augusta–Priolo', 'ITG1', 'refinery'], ['panigaglia', 'Terminal méthanier de Panigaglia', 'ITC3', 'lng_terminal'],
    ['caorso', 'Ancienne centrale nucléaire de Caorso', 'ITF3', 'nuclear'], ['trino', 'Ancienne centrale nucléaire de Trino', 'ITC1', 'nuclear'], ['latina', 'Ancienne centrale nucléaire de Latina', 'ITI4', 'nuclear'], ['garigliano', 'Ancienne centrale nucléaire du Garigliano', 'ITF3', 'nuclear'],
  ],
  GBR: [
    ['felixstowe', 'Port de Felixstowe', 'UKH', 'port'], ['southampton', 'Port de Southampton', 'UKJ', 'port'], ['dover', 'Port de Douvres', 'UKJ', 'port'], ['channel-tunnel-uk', 'Tunnel sous la Manche', 'UKJ', 'passage'], ['heathrow', 'Aéroport de Londres-Heathrow', 'UKI', 'airport'], ['filton', 'Complexe aéronautique de Filton', 'UKK', 'industrial'], ['barrow', 'Chantiers de sous-marins de Barrow-in-Furness', 'UKD', 'industrial'], ['portsmouth-naval', 'Base navale de Portsmouth', 'UKJ', 'naval_base'], ['devonport', 'Base navale de Devonport', 'UKK', 'naval_base'], ['faslane', 'Base de Faslane–Clyde', 'UKM', 'naval_base'],
    ['calder-hall', 'Centrale nucléaire de Calder Hall', 'UKD', 'nuclear'], ['chapelcross', 'Centrale nucléaire de Chapelcross', 'UKM', 'nuclear'], ['bradwell', 'Centrale nucléaire de Bradwell', 'UKH', 'nuclear'], ['dungeness', 'Centrale nucléaire de Dungeness', 'UKJ', 'nuclear'], ['hinkley-a', 'Centrale nucléaire de Hinkley Point A', 'UKK', 'nuclear'], ['sizewell-a', 'Centrale nucléaire de Sizewell A', 'UKH', 'nuclear'], ['oldbury', 'Centrale nucléaire d’Oldbury', 'UKK', 'nuclear'], ['wylfa', 'Centrale nucléaire de Wylfa', 'UKL', 'nuclear'], ['hinkley-b', 'Centrale nucléaire de Hinkley Point B', 'UKK', 'nuclear'], ['hunterston-b', 'Centrale nucléaire de Hunterston B', 'UKM', 'nuclear'], ['hartlepool', 'Centrale nucléaire de Hartlepool', 'UKC', 'nuclear'], ['heysham', 'Centrale nucléaire de Heysham', 'UKD', 'nuclear'], ['torness', 'Centrale nucléaire de Torness', 'UKM', 'nuclear'], ['sizewell-b', 'Centrale nucléaire de Sizewell B', 'UKH', 'nuclear'],
    ['sullom-voe', 'Terminal pétrolier de Sullom Voe', 'UKM', 'oil_field'], ['bacton', 'Point gazier de Bacton', 'UKH', 'gas_field'], ['fawley', 'Raffinerie de Fawley', 'UKJ', 'refinery'], ['grangemouth', 'Raffinerie de Grangemouth', 'UKM', 'refinery'], ['drax', 'Centrale thermique de Drax', 'UKE', 'thermal'], ['dinorwig', 'Station hydroélectrique de Dinorwig', 'UKL', 'hydro'],
  ],
};

function assetsFor(countryId: string, regions: TerritorySeed[]): TerritorialAsset[] {
  const anchors = new Map(regions.map((region) => [region.id.split(':').at(-1), region.anchor ?? [0, 0] as [number, number]]));
  return (names[countryId] ?? []).map(([id, name, region, kind]) => {
    const anchor = anchors.get(region) ?? [0, 0] as [number, number];
    return { id: `asset:${countryId}:${id}`, name, territoryId: `${countryId}:${region}`, kind, ownerEntityId: null, operatorEntityId: null,
      anchor, status: kind === 'nuclear' && countryId === 'ITA' ? 'closed' : 'operating', capacity: null, integration: 'inventory_only', sourceIds: [sourceFor(kind)],
      note: kind === 'nuclear' ? 'Site nucléaire suivi séparément du registre logistique ; capacité et disponibilité au 1er janvier 2000 à calibrer dans le registre énergétique.' : 'Installation majeure retenue dans l’inventaire réduit ; capacité et état historique détaillés à calibrer.',
    } satisfies TerritorialAsset;
  });
}

const europeNutsTerritoryDatasets: Record<string, TerritoryDataset> = Object.fromEntries(['DEU', 'ITA', 'ESP', 'GBR'].map((countryId) => {
  const territories = regionSeeds(countryId);
  return [countryId, { countryId, territories, assets: assetsFor(countryId, territories), entities: [] } satisfies TerritoryDataset];
}));

/** NUTS détaillé quand il existe, sinon la maille macro-régionale ORDO. */
export const europeTerritoryDatasets: Record<string, TerritoryDataset> = {
  ...europeMacroTerritoryDatasets,
  ...europeNutsTerritoryDatasets,
};
