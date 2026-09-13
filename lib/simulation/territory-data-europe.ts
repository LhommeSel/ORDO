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
/** Pays de la première tranche d’actifs majeurs ; les autres restent inventaire-territoire seulement. */
export const europePriorityAssetCountryIds = [
  'AUT', 'BEL', 'CHE', 'DNK', 'FIN', 'GRC', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'RUS', 'SWE', 'TUR', 'UKR',
] as const;
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
  AUT: [
    ['vienna-airport', 'Aéroport de Vienne-Schwechat', 'macro-vienna', 'airport'], ['vienna-port', 'Port fluvial de Vienne', 'macro-east', 'logistics'], ['linz-steel', 'Complexe sidérurgique de Linz', 'macro-west', 'industrial'], ['kaprun', 'Aménagement hydroélectrique de Kaprun', 'macro-alps', 'hydro'], ['freudenau', 'Barrage hydroélectrique de Freudenau', 'macro-east', 'hydro'], ['mellach', 'Centrale thermique de Mellach', 'macro-south', 'thermal'],
  ],
  BEL: [
    ['antwerp', 'Port d’Anvers', 'macro-flanders', 'port'], ['zeebrugge', 'Port et terminal méthanier de Zeebruges', 'macro-flanders', 'lng_terminal'], ['brussels-airport', 'Aéroport de Bruxelles-National', 'macro-brussels', 'airport'], ['doel', 'Centrale nucléaire de Doel', 'macro-flanders', 'nuclear'], ['tihange', 'Centrale nucléaire de Tihange', 'macro-wallonia', 'nuclear'], ['liege-logistics', 'Pôle logistique de Liège', 'macro-wallonia', 'logistics'], ['charleroi-industry', 'Pôle industriel de Charleroi', 'macro-wallonia', 'industrial'],
  ],
  CHE: [
    ['basel-rhine', 'Port rhénan de Bâle', 'macro-basel', 'logistics'], ['zurich-airport', 'Aéroport de Zurich', 'macro-zurich', 'airport'], ['geneva-airport', 'Aéroport de Genève', 'macro-geneva', 'airport'], ['beznau', 'Centrale nucléaire de Beznau', 'macro-plateau', 'nuclear'], ['goesgen', 'Centrale nucléaire de Gösgen', 'macro-plateau', 'nuclear'], ['leibstadt', 'Centrale nucléaire de Leibstadt', 'macro-zurich', 'nuclear'], ['grand-dixence', 'Aménagement hydroélectrique de la Grande Dixence', 'macro-alps', 'hydro'], ['gotthard', 'Tunnel routier du Saint-Gothard', 'macro-alps', 'passage'],
  ],
  DNK: [
    ['copenhagen-port', 'Port de Copenhague', 'macro-copenhagen', 'port'], ['aarhus-port', 'Port d’Aarhus', 'macro-jutland-east', 'port'], ['copenhagen-airport', 'Aéroport de Copenhague-Kastrup', 'macro-copenhagen', 'airport'], ['great-belt', 'Pont et liaison du Grand Belt', 'macro-zealand', 'passage'], ['oresund', 'Liaison fixe de l’Øresund', 'macro-zealand', 'passage'], ['fredericia', 'Raffinerie et terminal de Fredericia', 'macro-jutland-west', 'refinery'], ['tyra', 'Gisement gazier de Tyra', 'macro-jutland-west', 'gas_field'], ['avedore', 'Centrale thermique d’Avedøre', 'macro-copenhagen', 'thermal'],
  ],
  FIN: [
    ['helsinki-port', 'Port de Helsinki', 'macro-helsinki', 'port'], ['hamina-kotka', 'Ports de Hamina-Kotka', 'macro-southwest', 'port'], ['helsinki-airport', 'Aéroport d’Helsinki-Vantaa', 'macro-helsinki', 'airport'], ['loviisa', 'Centrale nucléaire de Loviisa', 'macro-helsinki', 'nuclear'], ['olkiluoto', 'Centrale nucléaire d’Olkiluoto', 'macro-west', 'nuclear'], ['porvoo-refinery', 'Raffinerie de Porvoo', 'macro-helsinki', 'refinery'], ['oulu-industry', 'Pôle industriel et portuaire d’Oulu', 'macro-north', 'industrial'],
  ],
  GRC: [
    ['piraeus', 'Port du Pirée', 'macro-attica', 'port'], ['thessaloniki', 'Port de Thessalonique', 'macro-macedonia', 'port'], ['athens-airport', 'Aéroport international d’Athènes', 'macro-attica', 'airport'], ['revithoussa', 'Terminal méthanier de Revithoussa', 'macro-attica', 'lng_terminal'], ['ptolemaida', 'Bassin lignitifère et centrales de Ptolémaïde', 'macro-macedonia', 'thermal'], ['kardia', 'Centrale thermique de Kardia', 'macro-macedonia', 'thermal'], ['megalopolis', 'Centrale thermique de Mégalopolis', 'macro-peloponnese', 'thermal'],
  ],
  NLD: [
    ['rotterdam', 'Port de Rotterdam–Europoort', 'macro-randstad-south', 'port'], ['amsterdam-port', 'Port d’Amsterdam', 'macro-randstad-north', 'port'], ['schiphol', 'Aéroport d’Amsterdam-Schiphol', 'macro-randstad-north', 'airport'], ['groningen', 'Gisement gazier de Groningue', 'macro-north', 'gas_field'], ['borssele', 'Centrale nucléaire de Borssele', 'macro-south', 'nuclear'], ['rotterdam-refinery', 'Raffineries et pétrochimie de Rotterdam', 'macro-randstad-south', 'refinery'], ['maasvlakte', 'Centrale thermique de Maasvlakte', 'macro-randstad-south', 'thermal'], ['ijmuiden-steel', 'Complexe sidérurgique d’IJmuiden', 'macro-randstad-north', 'industrial'],
  ],
  NOR: [
    ['oslo-port', 'Port d’Oslo', 'macro-oslofjord', 'port'], ['bergen-port', 'Port de Bergen', 'macro-west', 'port'], ['stavanger-port', 'Port et base pétrolière de Stavanger', 'macro-west', 'port'], ['oslo-airport', 'Aéroport d’Oslo-Gardermoen', 'macro-oslofjord', 'airport'], ['troll', 'Gisement gazier de Troll', 'macro-west', 'gas_field'], ['ekofisk', 'Gisement pétrolier d’Ekofisk', 'macro-west', 'oil_field'], ['karsto', 'Complexe gazier de Kårstø', 'macro-west', 'gas_field'], ['mongstad', 'Raffinerie de Mongstad', 'macro-west', 'refinery'], ['alta-hydro', 'Aménagement hydroélectrique d’Alta', 'macro-north', 'hydro'],
  ],
  POL: [
    ['gdansk', 'Port de Gdańsk', 'macro-north', 'port'], ['gdynia', 'Port de Gdynia', 'macro-north', 'port'], ['szczecin', 'Ports de Szczecin–Świnoujście', 'macro-west', 'port'], ['warsaw-airport', 'Aéroport de Varsovie-Okęcie', 'macro-mazovia', 'airport'], ['belchatow', 'Complexe lignite-thermique de Bełchatów', 'macro-west', 'thermal'], ['kozienice', 'Centrale thermique de Kozienice', 'macro-mazovia', 'thermal'], ['turow', 'Centrale thermique de Turów', 'macro-south', 'thermal'], ['plock-refinery', 'Raffinerie de Płock', 'macro-mazovia', 'refinery'], ['silesia-industry', 'Bassin industriel de Haute-Silésie', 'macro-south', 'industrial'], ['gdynia-naval', 'Base navale de Gdynia', 'macro-north', 'naval_base'],
  ],
  PRT: [
    ['sines', 'Port et zone énergétique de Sines', 'macro-lisbon', 'port'], ['leixoes', 'Port de Leixões', 'macro-north-coast', 'port'], ['lisbon-port', 'Port de Lisbonne', 'macro-lisbon', 'port'], ['lisbon-airport', 'Aéroport de Lisbonne', 'macro-lisbon', 'airport'], ['sines-refinery', 'Raffinerie de Sines', 'macro-lisbon', 'refinery'], ['alto-lindoso', 'Aménagement hydroélectrique d’Alto Lindoso', 'macro-north-coast', 'hydro'], ['tapada', 'Centrale thermique de Tapada do Outeiro', 'macro-north-coast', 'thermal'], ['setubal-industry', 'Pôle industriel de Setúbal', 'macro-lisbon', 'industrial'],
  ],
  ROU: [
    ['constanta', 'Port de Constanța', 'macro-dobrogea', 'port'], ['bucharest-airport', 'Aéroport de Bucarest-Otopeni', 'macro-bucharest', 'airport'], ['cernavoda', 'Centrale nucléaire de Cernavodă', 'macro-dobrogea', 'nuclear'], ['turceni', 'Centrale thermique de Turceni', 'macro-wallachia', 'thermal'], ['rovinari', 'Centrale thermique de Rovinari', 'macro-wallachia', 'thermal'], ['ploiesti', 'Raffineries de Ploiești', 'macro-transylvania', 'refinery'], ['midia', 'Raffinerie et terminal de Midia', 'macro-dobrogea', 'refinery'], ['galati-steel', 'Complexe sidérurgique de Galați', 'macro-moldova', 'industrial'],
  ],
  RUS: [
    ['st-petersburg-port', 'Port de Saint-Pétersbourg', 'macro-northwest', 'port'], ['novorossiysk', 'Port de Novorossiïsk', 'macro-south-caucasus', 'port'], ['murmansk', 'Port de Mourmansk', 'macro-northwest', 'port'], ['sheremetyevo', 'Aéroport de Moscou-Cheremetievo', 'macro-moscow-central', 'airport'], ['urengoy', 'Gisement gazier d’Ourengoï', 'macro-siberia', 'gas_field'], ['yamal-gas', 'Province gazière de Yamal', 'macro-siberia', 'gas_field'], ['samotlor', 'Gisement pétrolier de Samotlor', 'macro-urals', 'oil_field'], ['balakovo', 'Centrale nucléaire de Balakovo', 'macro-volga', 'nuclear'], ['kursk', 'Centrale nucléaire de Koursk', 'macro-moscow-central', 'nuclear'], ['leningrad', 'Centrale nucléaire de Leningrad', 'macro-northwest', 'nuclear'], ['novovoronezh', 'Centrale nucléaire de Novovoronej', 'macro-moscow-central', 'nuclear'], ['kola', 'Centrale nucléaire de Kola', 'macro-northwest', 'nuclear'], ['volgograd-thermal', 'Centrale thermique de Volgograd', 'macro-volga', 'thermal'], ['sevmash', 'Complexe naval de Severodvinsk', 'macro-northwest', 'industrial'], ['vladivostok-naval', 'Base navale de Vladivostok', 'macro-far-east', 'naval_base'],
  ],
  SWE: [
    ['gothenburg', 'Port de Göteborg', 'macro-gothenburg-west', 'port'], ['trelleborg', 'Port de Trelleborg', 'macro-skane-south', 'port'], ['stockholm-port', 'Port de Stockholm', 'macro-stockholm', 'port'], ['arlanda', 'Aéroport de Stockholm-Arlanda', 'macro-stockholm', 'airport'], ['forsmark', 'Centrale nucléaire de Forsmark', 'macro-stockholm', 'nuclear'], ['oskarshamn', 'Centrale nucléaire d’Oskarshamn', 'macro-skane-south', 'nuclear'], ['ringhals', 'Centrale nucléaire de Ringhals', 'macro-gothenburg-west', 'nuclear'], ['lysekil', 'Raffinerie de Lysekil', 'macro-gothenburg-west', 'refinery'], ['lulea-industry', 'Pôle sidérurgique de Luleå', 'macro-north', 'industrial'], ['harspranget', 'Aménagement hydroélectrique de Harsprånget', 'macro-north', 'hydro'],
  ],
  TUR: [
    ['istanbul-port', 'Ports d’Istanbul', 'macro-marmara', 'port'], ['izmir', 'Port d’Izmir', 'macro-aegean', 'port'], ['mersin', 'Port de Mersin', 'macro-mediterranean-southeast', 'port'], ['ataturk', 'Aéroport d’Istanbul-Atatürk', 'macro-marmara', 'airport'], ['marmara-lng', 'Terminal méthanier de Marmara Ereğlisi', 'macro-marmara', 'lng_terminal'], ['ceyhan', 'Terminal pétrolier de Ceyhan', 'macro-mediterranean-southeast', 'oil_field'], ['izmit-refinery', 'Raffinerie d’İzmit', 'macro-marmara', 'refinery'], ['aliaga-refinery', 'Raffinerie d’Aliağa', 'macro-aegean', 'refinery'], ['soma', 'Bassin lignitifère et centrales de Soma', 'macro-aegean', 'thermal'], ['zonguldak', 'Bassin houiller et centrales de Zonguldak', 'macro-black-sea-east', 'thermal'],
  ],
  UKR: [
    ['odesa', 'Port d’Odessa', 'macro-south-black-sea', 'port'], ['chornomorsk', 'Port de Tchornomorsk', 'macro-south-black-sea', 'port'], ['kyiv-airport', 'Aéroport de Kyiv-Boryspil', 'macro-kyiv', 'airport'], ['zaporizhzhia', 'Centrale nucléaire de Zaporijjia', 'macro-dnipro-central', 'nuclear'], ['south-ukraine', 'Centrale nucléaire d’Ukraine du Sud', 'macro-south-black-sea', 'nuclear'], ['rivne', 'Centrale nucléaire de Rivne', 'macro-west', 'nuclear'], ['khmelnytskyi', 'Centrale nucléaire de Khmelnytskyï', 'macro-west', 'nuclear'], ['kremenchuk', 'Raffinerie de Krementchouk', 'macro-dnipro-central', 'refinery'], ['lysychansk', 'Raffinerie de Lyssytchansk', 'macro-east-industrial', 'refinery'], ['trypilska', 'Centrale thermique de Trypilska', 'macro-kyiv', 'thermal'], ['donbas-industry', 'Bassin industriel du Donbass', 'macro-east-industrial', 'industrial'], ['yuzhne', 'Port de Pivdennyï', 'macro-south-black-sea', 'port'],
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

const europeMacroDatasetsWithAssets: Record<string, TerritoryDataset> = Object.fromEntries(
  Object.entries(europeMacroTerritoryDatasets).map(([countryId, dataset]) => [countryId, {
    ...dataset, assets: assetsFor(countryId, dataset.territories),
  } satisfies TerritoryDataset]),
);

/** NUTS détaillé quand il existe, sinon la maille macro-régionale ORDO. */
export const europeTerritoryDatasets: Record<string, TerritoryDataset> = {
  ...europeMacroDatasetsWithAssets,
  ...europeNutsTerritoryDatasets,
};
