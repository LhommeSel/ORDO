import type { TerritoryDataset, TerritorySeed, TerritorialAsset } from './territory-types';

export const territorySources: Record<string, { label: string; url: string }> = {
  'insee-rp1999': { label: 'Insee — RP 1999, tableau des régions, p. 19', url: 'https://www.insee.fr/fr/statistiques/fichier/1378738/Tot_complet.pdf' },
  'insee-gdp2000': { label: 'Insee — PIB par habitant 2000, p. 4', url: 'https://www.insee.fr/fr/statistiques/fichier/1293427/ici155.pdf' },
  elengy: { label: 'Elengy — historique des terminaux', url: 'https://www.elengy.com/en/about-us/our-history' },
  edf: { label: 'EDF — document de référence 2011, dates de mise en service', url: 'https://www.edf.fr/sites/groupe/files/uploads/edf_ddr2011_interactif_vf.pdf' },
  ports: { label: 'SDES — repérage des principaux ports (source postérieure à 2000, sans reprise des tonnages)', url: 'https://www.statistiques.developpement-durable.gouv.fr/publicationweb/349' },
  'eurostat-population-2000': { label: 'Eurostat — population régionale (série historique)', url: 'https://ec.europa.eu/eurostat/web/products-datasets/-/tgs00096' },
  'eurostat-gdp-2000': { label: 'Eurostat — comptes économiques régionaux', url: 'https://ec.europa.eu/eurostat/web/national-accounts/methodology/regional-accounts' },
  'gisco-nuts-2021': { label: 'Eurostat GISCO — contours NUTS (fond cartographique)', url: 'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2021_4326.geojson' },
  'iaea-pris': { label: 'AIEA PRIS — réacteur et centrale nucléaire', url: 'https://pris.iaea.org/pris/WorldStatistics/WorldStatisticsLandingPage.aspx' },
};

// Population sans doubles comptes RP1999; GDP/head in current EUR in 2000.
// Products of these two series are allocation WEIGHTS, NOT observed regional GDP.
const rows: [string, string, number, number, number, number][] = [
  ['11', 'Île-de-France', 10952011, 37167, 2.5, 48.7],
  ['21', 'Champagne-Ardenne', 1342363, 22426, 4.4, 48.8],
  ['22', 'Picardie', 1857481, 19399, 2.8, 49.6],
  ['23', 'Haute-Normandie', 1780192, 21864, 1, 49.5],
  ['24', 'Centre', 2440329, 21259, 1.7, 47.5],
  ['25', 'Basse-Normandie', 1422193, 19620, -0.5, 49],
  ['26', 'Bourgogne', 1610067, 21008, 4.5, 47.1],
  ['31', 'Nord-Pas-de-Calais', 3996588, 18523, 2.7, 50.5],
  ['41', 'Lorraine', 2310376, 19580, 6.2, 48.9],
  ['42', 'Alsace', 1734145, 23630, 7.5, 48.3],
  ['43', 'Franche-Comté', 1117059, 21006, 6.3, 47.2],
  ['52', 'Pays de la Loire', 3222061, 21448, -0.8, 47.5],
  ['53', 'Bretagne', 2906197, 20454, -2.8, 48.2],
  ['54', 'Poitou-Charentes', 1640068, 19597, 0.2, 46.1],
  ['72', 'Aquitaine', 2908359, 21173, -0.6, 44.5],
  ['73', 'Midi-Pyrénées', 2551687, 20745, 1.7, 43.9],
  ['74', 'Limousin', 710939, 19401, 1.8, 45.8],
  ['82', 'Rhône-Alpes', 5645407, 24094, 5.2, 45.7],
  ['83', 'Auvergne', 1308878, 19900, 3, 45.5],
  ['91', 'Languedoc-Roussillon', 2295648, 18335, 3, 43.6],
  ['93', "Provence-Alpes-Côte d’Azur", 4506151, 21858, 6.1, 43.9],
  ['94', 'Corse', 260196, 17943, 9, 42.2],
];

const territories: TerritorySeed[] = rows.map(([code, name, pop, gdp, lon, lat]) => ({
  id: `FRA-r${code}`, name, kind: 'region', referencePopulation: pop, referenceYear: 1999,
  economicWeight: pop * gdp, inNationalAccounts: true, mapGroup: 'metropole', anchor: [lon, lat],
  sourceIds: ['insee-rp1999', 'insee-gdp2000'],
  note: 'Répartition calibrée sur le total national ORDO : population RP1999 × PIB/habitant 2000. Ce n’est pas un PIB régional observé.',
}));

const dom: [string, string, number, number, number][] = [
  ['01', 'Guadeloupe (avec Saint-Martin et Saint-Barthélemy en 2000)', 422496, -61.55, 16.2],
  ['02', 'Martinique', 381427, -61, 14.6],
  ['03', 'Guyane', 157213, -53.2, 4],
  ['04', 'La Réunion', 706300, 55.5, -21.1],
];
territories.push(...dom.map(([code, name, pop, lon, lat]): TerritorySeed => ({
  id: `FRA-r${code}`, name, kind: 'overseas', referencePopulation: pop, referenceYear: 1999,
  economicWeight: pop * 12853, inNationalAccounts: true, mapGroup: 'overseas', anchor: [lon, lat],
  sourceIds: ['insee-rp1999', 'insee-gdp2000'],
  note: 'Population RP1999. Ventilation économique provisoire : moyenne PIB/habitant des quatre DOM, faute de série individuelle. Localisateur sans contour historique.',
})));

// Separate accounting perimeters. Unknown is not zero; no fabricated GDP/population.
const external: [string, string, number, number, boolean][] = [
  ['MYT', 'Mayotte', 45.15, -12.8, false],
  ['SPM', 'Saint-Pierre-et-Miquelon', -56.3, 46.9, false],
  ['NCL', 'Nouvelle-Calédonie', 165.5, -21.5, false],
  ['PYF', 'Polynésie française', -149.4, -17.7, false],
  ['WLF', 'Wallis-et-Futuna', -176.2, -13.3, false],
  ['ATF', 'Terres australes françaises (hors Terre Adélie)', 69.3, -49.3, true],
  ['EPR', 'Îles Éparses', 43, -17, true],
  ['CPT', 'Clipperton', -109.2, 10.3, true],
];
territories.push(...external.map(([code, name, lon, lat, uninhabited]): TerritorySeed => ({
  id: `FRA-${code}`, name, kind: 'overseas', referencePopulation: uninhabited ? 0 : null,
  referenceYear: null, economicWeight: 0, inNationalAccounts: false, mapGroup: 'overseas', anchor: [lon, lat],
  sourceIds: [], note: uninhabited
    ? 'Pas de population permanente modélisée ; personnels temporaires et revendications antarctiques hors périmètre de ce premier lot.'
    : 'Périmètre statistique séparé dans ce prototype. Population et économie à documenter ; ne pas les confondre avec une absence d’activité.',
})));

const assets: TerritorialAsset[] = [];
const operatorByKind: Partial<Record<TerritorialAsset['kind'], string>> = {
  nuclear: 'operator:EDF',
  hydro: 'operator:EDF',
  lng_terminal: 'operator:GDF',
  storage: 'operator:GDF',
  gas_field: 'operator:GDF',
};
const sourceByKind: Partial<Record<TerritorialAsset['kind'], string>> = {
  port: 'ports', nuclear: 'edf', hydro: 'edf', lng_terminal: 'elengy', storage: 'elengy', gas_field: 'elengy',
};
const add = (id: string, name: string, code: string, kind: TerritorialAsset['kind'], lon: number, lat: number) => {
  const operator = operatorByKind[kind] ?? null;
  assets.push({
  id: `asset:FRA:${id}`, name, territoryId: `FRA-r${code}`, kind, anchor: [lon, lat],
  ownerEntityId: operator,
  operatorEntityId: operator,
  status: 'operating', capacity: null, integration: 'inventory_only',
  sourceIds: sourceByKind[kind] ? [sourceByKind[kind]!] : [],
  note: sourceByKind[kind]
    ? 'Site présent en 2000 ; position indicative. Capacité historique et contraintes de flux à raccorder, sans production ajoutée au registre national.'
    : 'Site majeur présent dans le scénario 2000 ; position indicative. Opérateur et capacité restent à documenter avant toute utilisation quantitative.',
  });
};
add('dunkerque', 'Port de Dunkerque', '31', 'port', 2.3, 51.05);
add('calais', 'Port de Calais', '31', 'port', 1.85, 50.97);
add('le-havre', 'Port du Havre', '23', 'port', 0.12, 49.49);
add('rouen', 'Port de Rouen', '23', 'port', 1.03, 49.43);
add('nantes', 'Port de Nantes–Saint-Nazaire', '52', 'port', -2.18, 47.28);
add('la-rochelle', 'Port de La Rochelle', '54', 'port', -1.22, 46.16);
add('bordeaux', 'Port de Bordeaux', '72', 'port', -0.55, 44.88);
add('marseille', 'Port de Marseille–Fos', '93', 'port', 4.9, 43.42);
add('gravelines', 'Centrale de Gravelines', '31', 'nuclear', 2.14, 51.01);
add('paluel', 'Centrale de Paluel', '23', 'nuclear', 0.64, 49.86);
add('flamanville', 'Flamanville — tranches 1 et 2', '25', 'nuclear', -1.88, 49.54);
add('cattenom', 'Centrale de Cattenom', '41', 'nuclear', 6.22, 49.42);
add('fessenheim', 'Centrale de Fessenheim', '42', 'nuclear', 7.56, 47.9);
add('bugey', 'Centrale du Bugey — tranches 2 à 5', '82', 'nuclear', 5.27, 45.8);
add('tricastin', 'Centrale du Tricastin', '82', 'nuclear', 4.73, 44.33);
add('blayais', 'Centrale du Blayais', '72', 'nuclear', -0.69, 45.25);
add('penly', 'Centrale de Penly', '23', 'nuclear', 0.06, 49.98);
add('chooz', 'Centrale de Chooz', '21', 'nuclear', 4.79, 50.09);
add('nogent', 'Centrale de Nogent-sur-Seine', '21', 'nuclear', 3.57, 48.52);
add('belleville', 'Centrale de Belleville', '24', 'nuclear', 2.88, 47.5);
add('dampierre', 'Centrale de Dampierre-en-Burly', '24', 'nuclear', 2.52, 47.62);
add('saint-laurent', 'Centrale de Saint-Laurent', '24', 'nuclear', 1.62, 47.72);
add('chinon', 'Centrale de Chinon', '24', 'nuclear', 0.17, 47.23);
add('civaux', 'Centrale de Civaux', '54', 'nuclear', 0.65, 46.45);
add('saint-alban', 'Centrale de Saint-Alban', '82', 'nuclear', 4.76, 45.4);
add('cruas', 'Centrale de Cruas-Meysse', '82', 'nuclear', 4.76, 44.63);
add('golfech', 'Centrale de Golfech', '73', 'nuclear', 1.1, 44.11);
add('montoir', 'Terminal méthanier de Montoir-de-Bretagne', '52', 'lng_terminal', -2.15, 47.29);
add('fos-tonkin', 'Terminal méthanier de Fos Tonkin', '93', 'lng_terminal', 4.89, 43.46);
add('cordemais', 'Centrale thermique de Cordemais', '52', 'thermal', -1.88, 47.29);
add('le-havre-thermal', 'Centrale thermique du Havre', '23', 'thermal', 0.18, 49.5);
add('porcheville', 'Centrale thermique de Porcheville', '11', 'thermal', 1.88, 48.97);
add('emile-huchet', 'Centrale Émile-Huchet', '41', 'thermal', 6.7, 49.15);
add('gardanne', 'Centrale de Gardanne', '93', 'thermal', 5.47, 43.45);
add('grand-maison', 'Complexe hydroélectrique de Grand’Maison', '82', 'hydro', 6.08, 45.18);
add('serre-poncon', 'Barrage et aménagement de Serre-Ponçon', '93', 'hydro', 6.33, 44.53);
add('durance', 'Aménagement hydroélectrique de la Durance', '93', 'hydro', 5.75, 43.9);
add('gonfreville', 'Raffinerie de Gonfreville-l’Orcher', '23', 'refinery', 0.24, 49.5);
add('donges', 'Raffinerie de Donges', '52', 'refinery', -2.08, 47.32);
add('feyzin', 'Raffinerie de Feyzin', '82', 'refinery', 4.85, 45.67);
add('lavera', 'Raffinerie de Lavéra', '93', 'refinery', 4.99, 43.4);
add('lacq', 'Bassin gazier de Lacq', '72', 'gas_field', -0.62, 43.4);
add('paris-basin', 'Bassin pétrolier du Bassin parisien', '11', 'oil_field', 2.7, 48.6);
add('chemery', 'Stockage souterrain de gaz de Chémery', '24', 'storage', 1.45, 47.45);
add('lussagnet', 'Stockage souterrain de gaz de Lussagnet', '72', 'storage', -0.18, 43.68);
add('manosque', 'Stockage souterrain de Manosque', '93', 'storage', 5.78, 43.83);
add('cdg', 'Aéroport de Paris–Charles-de-Gaulle', '11', 'airport', 2.55, 49.01);
add('channel-tunnel-fr', 'Tunnel sous la Manche — accès français', '31', 'passage', 1.75, 50.92);
add('frejus', 'Tunnel routier du Fréjus', '82', 'passage', 6.67, 45.12);
add('toulon-naval', 'Base navale de Toulon', '93', 'naval_base', 5.93, 43.12);
add('brest-naval', 'Base navale de Brest', '53', 'naval_base', -4.5, 48.38);
add('saint-nazaire-industry', 'Chantiers navals de Saint-Nazaire', '52', 'industrial', -2.2, 47.28);
add('toulouse-aero', 'Pôle aéronautique de Toulouse', '73', 'industrial', 1.44, 43.6);
add('crolles-micro', 'Pôle microélectronique de Crolles', '82', 'industrial', 5.88, 45.25);
add('kourou', 'Centre spatial guyanais de Kourou', '03', 'spaceport', -52.65, 5.16);

export const franceTerritoryDataset: TerritoryDataset = {
  countryId: 'FRA', territories, assets,
  entities: [
    { id: 'operator:EDF', name: 'Électricité de France (2000)', kind: 'public_operator' },
    { id: 'operator:GDF', name: 'Gaz de France (2000)', kind: 'public_operator' },
  ],
};
