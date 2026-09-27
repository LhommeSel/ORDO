import type {
  BilateralTradeFlow,
  CountryEnergyState,
  CountryId,
  EconomicProductFamily,
  EnergyContract,
  EnergyNode,
  MilitaryBase,
  MilitaryTheater,
  TreatyState,
  WorldState,
} from './types';

/**
 * Périmètre des puissances dont les interdépendances doivent être lisibles
 * dès l'ouverture de la partie. Les autres pays restent jouables grâce au
 * registre mondial, mais ne reçoivent pas tous les liens de second niveau.
 *
 * Les valeurs de cette couche sont un calibrage de scénario au 1er janvier
 * 2000. Elles servent à produire des choix et des réactions cohérents, pas à
 * remplacer une base statistique historienne pays par pays.
 */
export const MAJOR_COUNTRY_IDS: CountryId[] = [
  'USA', 'CHN', 'JPN', 'DEU', 'FRA', 'GBR', 'ITA', 'RUS', 'IND', 'BRA',
  'CAN', 'MEX', 'AUS', 'KOR', 'ESP', 'TUR', 'SAU', 'ZAF', 'IDN', 'IRN',
];

const hasCountries = (state: WorldState, ids: CountryId[]) => ids.every((id) => Boolean(state.countries[id]));

type RelationValues = {
  relation: number;
  trust: number;
  tradeIntensity: number;
  securityAlignment: number;
  memories?: string[];
};

function addRelationPair(
  relations: WorldState['relations'],
  state: WorldState,
  from: CountryId,
  to: CountryId,
  values: RelationValues,
) {
  if (!hasCountries(state, [from, to])) return;
  const memories = values.memories ?? [];
  const forward = `${from}:${to}`;
  const reverse = `${to}:${from}`;
  if (!relations[forward]) relations[forward] = { from, to, ...values, memories: [...memories] };
  if (!relations[reverse]) relations[reverse] = { from: to, to: from, ...values, memories: [...memories] };
}

/** Relations structurantes : elles donnent une géographie politique aux dossiers et aux organisations. */
function majorRelations2000(state: WorldState): WorldState['relations'] {
  const relations = { ...state.relations };
  const pair = (from: CountryId, to: CountryId, values: RelationValues) => addRelationPair(relations, state, from, to, values);
  pair('USA', 'CHN', { relation: 25, trust: 21, tradeIntensity: 55, securityAlignment: 24, memories: ['Rivalité stratégique en Asie-Pacifique', 'Relations commerciales en forte croissance'] });
  pair('USA', 'RUS', { relation: 31, trust: 26, tradeIntensity: 18, securityAlignment: 16, memories: ['Après-guerre froide encore indécise', 'Désaccord sur les élargissements de sécurité'] });
  pair('USA', 'JPN', { relation: 78, trust: 75, tradeIntensity: 78, securityAlignment: 90, memories: ['Alliance bilatérale structurante'] });
  pair('USA', 'KOR', { relation: 72, trust: 69, tradeIntensity: 62, securityAlignment: 84, memories: ['Présence américaine dans la péninsule'] });
  pair('USA', 'IND', { relation: 56, trust: 51, tradeIntensity: 31, securityAlignment: 39, memories: ['Rapprochement prudent après les sanctions nucléaires'] });
  pair('USA', 'SAU', { relation: 67, trust: 61, tradeIntensity: 38, securityAlignment: 70, memories: ['Partenariat pétrole-sécurité', 'Divergences sur les droits politiques'] });
  pair('USA', 'TUR', { relation: 52, trust: 46, tradeIntensity: 31, securityAlignment: 61, memories: ['Alliés de l’OTAN, intérêts régionaux divergents'] });
  pair('USA', 'IRN', { relation: 8, trust: 5, tradeIntensity: 2, securityAlignment: 4, memories: ['Sanctions et contentieux depuis 1979'] });
  pair('USA', 'IDN', { relation: 51, trust: 47, tradeIntensity: 27, securityAlignment: 35 });
  pair('USA', 'AUS', { relation: 83, trust: 81, tradeIntensity: 59, securityAlignment: 88, memories: ['Alliance ANZUS'] });
  pair('CHN', 'RUS', { relation: 62, trust: 56, tradeIntensity: 34, securityAlignment: 55, memories: ['Partenariat continental prudent', 'Héritage de la rivalité sino-soviétique'] });
  pair('CHN', 'JPN', { relation: 27, trust: 20, tradeIntensity: 65, securityAlignment: 25, memories: ['Contentieux historiques et maritimes'] });
  pair('CHN', 'KOR', { relation: 52, trust: 46, tradeIntensity: 68, securityAlignment: 28 });
  pair('CHN', 'IND', { relation: 37, trust: 32, tradeIntensity: 43, securityAlignment: 23, memories: ['Contentieux frontalier non résolu'] });
  pair('CHN', 'IDN', { relation: 59, trust: 53, tradeIntensity: 39, securityAlignment: 31 });
  pair('CHN', 'IRN', { relation: 68, trust: 63, tradeIntensity: 24, securityAlignment: 54, memories: ['Coopération énergétique et stratégique'] });
  pair('CHN', 'SAU', { relation: 56, trust: 51, tradeIntensity: 32, securityAlignment: 42 });
  pair('CHN', 'AUS', { relation: 38, trust: 33, tradeIntensity: 35, securityAlignment: 26, memories: ['Dépendance commerciale et inquiétude stratégique'] });
  pair('RUS', 'DEU', { relation: 55, trust: 50, tradeIntensity: 46, securityAlignment: 34, memories: ['Interdépendance gazière en construction'] });
  pair('RUS', 'FRA', { relation: 49, trust: 44, tradeIntensity: 29, securityAlignment: 41 });
  pair('RUS', 'JPN', { relation: 34, trust: 28, tradeIntensity: 18, securityAlignment: 20, memories: ['Contentieux des Kouriles'] });
  pair('RUS', 'IND', { relation: 68, trust: 64, tradeIntensity: 27, securityAlignment: 60, memories: ['Coopération militaire et nucléaire civile'] });
  pair('RUS', 'IRN', { relation: 69, trust: 64, tradeIntensity: 18, securityAlignment: 61 });
  pair('RUS', 'TUR', { relation: 43, trust: 37, tradeIntensity: 33, securityAlignment: 31 });
  pair('RUS', 'SAU', { relation: 35, trust: 29, tradeIntensity: 19, securityAlignment: 27 });
  pair('FRA', 'GBR', { relation: 71, trust: 64, tradeIntensity: 54, securityAlignment: 70, memories: ['Coopération européenne et rivalité de puissance'] });
  pair('FRA', 'ESP', { relation: 72, trust: 67, tradeIntensity: 59, securityAlignment: 66 });
  pair('FRA', 'KOR', { relation: 50, trust: 45, tradeIntensity: 21, securityAlignment: 43 });
  pair('DEU', 'ESP', { relation: 68, trust: 63, tradeIntensity: 65, securityAlignment: 69 });
  pair('DEU', 'POL', { relation: 62, trust: 55, tradeIntensity: 52, securityAlignment: 65, memories: ['Élargissement oriental en préparation'] });
  pair('DEU', 'KOR', { relation: 57, trust: 52, tradeIntensity: 28, securityAlignment: 38 });
  pair('GBR', 'JPN', { relation: 61, trust: 56, tradeIntensity: 35, securityAlignment: 53 });
  pair('GBR', 'SAU', { relation: 56, trust: 50, tradeIntensity: 24, securityAlignment: 57 });
  pair('ITA', 'TUR', { relation: 55, trust: 49, tradeIntensity: 35, securityAlignment: 47 });
  pair('ITA', 'SAU', { relation: 48, trust: 42, tradeIntensity: 26, securityAlignment: 42 });
  pair('IND', 'JPN', { relation: 57, trust: 52, tradeIntensity: 37, securityAlignment: 47 });
  pair('IND', 'IRN', { relation: 55, trust: 50, tradeIntensity: 19, securityAlignment: 52 });
  pair('IND', 'SAU', { relation: 53, trust: 48, tradeIntensity: 43, securityAlignment: 40 });
  pair('IND', 'IDN', { relation: 54, trust: 49, tradeIntensity: 29, securityAlignment: 36 });
  pair('KOR', 'JPN', { relation: 42, trust: 36, tradeIntensity: 57, securityAlignment: 40, memories: ['Contentieux historiques et commerciaux'] });
  pair('KOR', 'IDN', { relation: 57, trust: 51, tradeIntensity: 28, securityAlignment: 38 });
  pair('KOR', 'AUS', { relation: 64, trust: 59, tradeIntensity: 33, securityAlignment: 54 });
  pair('AUS', 'IDN', { relation: 51, trust: 45, tradeIntensity: 31, securityAlignment: 46 });
  pair('AUS', 'SAU', { relation: 44, trust: 38, tradeIntensity: 19, securityAlignment: 39 });
  pair('SAU', 'IRN', { relation: 12, trust: 9, tradeIntensity: 7, securityAlignment: 10, memories: ['Rivalité du Golfe'] });
  pair('SAU', 'TUR', { relation: 39, trust: 33, tradeIntensity: 18, securityAlignment: 29 });
  pair('IRN', 'TUR', { relation: 54, trust: 47, tradeIntensity: 24, securityAlignment: 42 });
  pair('IRN', 'IDN', { relation: 50, trust: 45, tradeIntensity: 16, securityAlignment: 31 });
  pair('BRA', 'CHN', { relation: 55, trust: 50, tradeIntensity: 29, securityAlignment: 25 });
  pair('BRA', 'EU', { relation: 48, trust: 43, tradeIntensity: 34, securityAlignment: 20 });
  pair('ZAF', 'CHN', { relation: 51, trust: 46, tradeIntensity: 25, securityAlignment: 24 });
  pair('CAN', 'MEX', { relation: 74, trust: 68, tradeIntensity: 43, securityAlignment: 51 });
  pair('CAN', 'CHN', { relation: 36, trust: 31, tradeIntensity: 27, securityAlignment: 18 });
  return relations;
}

const emptyProductMix = (): Record<EconomicProductFamily, number> => ({
  food: 0, energy: 0, raw_materials: 0, industrial_inputs: 0,
  manufactured_goods: 0, strategic_technology: 0,
});

function flow(
  exporterId: CountryId,
  importerId: CountryId,
  annualValueBillion2000Usd: number,
  mix: Partial<Record<EconomicProductFamily, number>>,
  friction: number,
  reliability: number,
  routeCapacityIndex: number,
): BilateralTradeFlow {
  const productMix = { ...emptyProductMix(), ...mix };
  const total = Object.values(productMix).reduce((sum, share) => sum + share, 0) || 1;
  for (const family of Object.keys(productMix) as EconomicProductFamily[]) productMix[family] /= total;
  return {
    id: `${exporterId}-${importerId}`,
    exporterId,
    importerId,
    annualValueBillion2000Usd,
    productMix,
    friction,
    reliability,
    routeCapacityIndex,
    lastUpdatedAt: '2000-01-01',
  };
}

/** Routes manquantes dans le réseau initial, concentrées sur les dix pays non occidentaux du pack. */
function majorTradeFlows2000(state: WorldState): WorldState['tradeFlows'] {
  const flows = { ...state.tradeFlows };
  const industrial = { industrial_inputs: 0.35, manufactured_goods: 0.45, strategic_technology: 0.2 };
  const energy = { energy: 0.82, raw_materials: 0.12, industrial_inputs: 0.06 };
  const mixed = { food: 0.12, raw_materials: 0.16, industrial_inputs: 0.24, manufactured_goods: 0.33, strategic_technology: 0.15 };
  const add = (exporterId: CountryId, importerId: CountryId, value: number, mix: Partial<Record<EconomicProductFamily, number>>, friction: number, reliability: number, capacity: number) => {
    if (hasCountries(state, [exporterId, importerId])) {
      const item = flow(exporterId, importerId, value, mix, friction, reliability, capacity);
      if (!flows[item.id]) flows[item.id] = item;
    }
  };
  add('KOR', 'CHN', 26, industrial, 15, 82, 76); add('CHN', 'KOR', 4, mixed, 15, 83, 76);
  add('KOR', 'USA', 29, { manufactured_goods: 0.5, strategic_technology: 0.3, industrial_inputs: 0.2 }, 14, 86, 72); add('USA', 'KOR', 18, industrial, 14, 86, 72);
  add('KOR', 'JPN', 18, industrial, 15, 82, 70); add('JPN', 'KOR', 21, industrial, 15, 84, 70);
  add('IDN', 'JPN', 17, { energy: 0.28, raw_materials: 0.34, food: 0.2, manufactured_goods: 0.18 }, 16, 81, 66); add('JPN', 'IDN', 10, industrial, 16, 82, 66);
  add('IDN', 'CHN', 13, { raw_materials: 0.3, energy: 0.18, food: 0.2, manufactured_goods: 0.32 }, 17, 78, 62); add('CHN', 'IDN', 3, mixed, 17, 80, 62);
  add('IDN', 'USA', 8, mixed, 18, 76, 53); add('USA', 'IDN', 7, industrial, 18, 78, 53);
  add('IRN', 'CHN', 16, energy, 22, 68, 48); add('CHN', 'IRN', 2, industrial, 22, 70, 48);
  add('IRN', 'IND', 8, energy, 23, 66, 42); add('IND', 'IRN', 4, industrial, 23, 68, 42);
  add('IRN', 'TUR', 9, energy, 18, 71, 55); add('TUR', 'IRN', 6, mixed, 18, 72, 55);
  add('SAU', 'CHN', 24, energy, 16, 83, 66); add('CHN', 'SAU', 2, industrial, 16, 80, 66);
  add('SAU', 'IND', 20, energy, 17, 82, 61); add('IND', 'SAU', 7, industrial, 17, 79, 61);
  add('SAU', 'JPN', 19, energy, 15, 87, 68); add('JPN', 'SAU', 6, industrial, 15, 83, 68);
  add('TUR', 'RUS', 12, mixed, 18, 75, 58); add('RUS', 'TUR', 14, energy, 18, 73, 58);
  add('TUR', 'ITA', 14, mixed, 13, 83, 73); add('ITA', 'TUR', 11, industrial, 13, 82, 73);
  add('IND', 'CHN', 12, { raw_materials: 0.18, food: 0.16, industrial_inputs: 0.24, manufactured_goods: 0.32, strategic_technology: 0.1 }, 19, 73, 54);
  add('IND', 'DEU', 9, industrial, 19, 76, 50); add('DEU', 'IND', 8, industrial, 19, 78, 50);
  add('AUS', 'CHN', 30, { energy: 0.28, raw_materials: 0.48, food: 0.15, industrial_inputs: 0.09 }, 16, 86, 72); add('CHN', 'AUS', 2, industrial, 16, 83, 72);
  add('AUS', 'IND', 7, { energy: 0.2, raw_materials: 0.35, food: 0.2, manufactured_goods: 0.25 }, 18, 81, 55); add('IND', 'AUS', 4, industrial, 18, 78, 55);
  add('BRA', 'CHN', 19, { food: 0.34, raw_materials: 0.32, energy: 0.15, industrial_inputs: 0.19 }, 17, 78, 58);
  add('MEX', 'CHN', 6, mixed, 21, 72, 45); add('CHN', 'MEX', 1, industrial, 21, 75, 45);
  add('ZAF', 'CHN', 10, { raw_materials: 0.52, energy: 0.18, food: 0.18, industrial_inputs: 0.12 }, 20, 75, 47);
  return flows;
}

const majorEnergyProfiles: Record<string, CountryEnergyState> = {
  KOR: { countryId: 'KOR', annualDemand: { oil: 105, gas: 26 }, domesticProduction: { oil: 1, gas: 0.5 }, legacyImports: { oil: 104, gas: 25.5 }, strategicStocks: { oil: 23, gas: 1.5 }, storageCapacity: { oil: 31, gas: 3 }, desiredCoverageMonths: { oil: 2.5, gas: 1 } },
  IDN: { countryId: 'IDN', annualDemand: { oil: 54, gas: 28 }, domesticProduction: { oil: 44, gas: 43 }, legacyImports: { oil: 10, gas: 0 }, strategicStocks: { oil: 7, gas: 3 }, storageCapacity: { oil: 13, gas: 8 }, desiredCoverageMonths: { oil: 1.5, gas: 1.5 } },
  IRN: { countryId: 'IRN', annualDemand: { oil: 68, gas: 92 }, domesticProduction: { oil: 190, gas: 115 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 20, gas: 13 }, storageCapacity: { oil: 34, gas: 25 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
};

const additionalEnergyNodes2000: Record<string, EnergyNode> = {
  'idn-oil': { id: 'idn-oil', countryId: 'IDN', resource: 'oil', label: 'Bassins de Sumatra et de Kalimantan', provenReserves: 510, probableReserves: 300, annualProduction: 44, annualCapacity: 52, domesticConsumption: 54, storageCapacity: 13, stocks: 7, extractionCost: 15, declineRate: 0.018, developmentLeadMonths: 36, infrastructure: ['Terminaux de Dumai', 'Réseau de Sumatra'] },
  'idn-gas': { id: 'idn-gas', countryId: 'IDN', resource: 'gas', label: 'Natuna et Kalimantan oriental', provenReserves: 1850, probableReserves: 720, annualProduction: 43, annualCapacity: 55, domesticConsumption: 28, storageCapacity: 8, stocks: 3, extractionCost: 12, declineRate: 0.012, developmentLeadMonths: 48, infrastructure: ['Bontang GNL', 'Réseau de Kalimantan'] },
  'irn-oil': { id: 'irn-oil', countryId: 'IRN', resource: 'oil', label: 'Sud-ouest iranien et golfe Persique', provenReserves: 12500, probableReserves: 4100, annualProduction: 190, annualCapacity: 225, domesticConsumption: 68, storageCapacity: 34, stocks: 20, extractionCost: 8, declineRate: 0.012, developmentLeadMonths: 30, infrastructure: ['Kharg', 'Terminaux du golfe Persique'] },
  'irn-gas': { id: 'irn-gas', countryId: 'IRN', resource: 'gas', label: 'South Pars et réseaux iraniens', provenReserves: 10000, probableReserves: 4200, annualProduction: 115, annualCapacity: 145, domesticConsumption: 92, storageCapacity: 25, stocks: 13, extractionCost: 7, declineRate: 0.01, developmentLeadMonths: 48, infrastructure: ['South Pars', 'Réseau national iranien'] },
};

function majorEnergyContracts2000(state: WorldState, energyNodes: Record<string, EnergyNode>): Record<string, EnergyContract> {
  const contracts = { ...state.energyContracts };
  const add = (id: string, sellerId: CountryId, buyerId: CountryId, nodeId: string, resource: 'oil' | 'gas', annualVolume: number, route: string, priority: number, clauses: string[]) => {
    if (!hasCountries(state, [sellerId, buyerId]) || !energyNodes[nodeId] || contracts[id]) return;
    contracts[id] = { id, sellerId, buyerId, nodeId, resource, annualVolume, startDate: '2000-01-01', endDate: '2025-12-31', priceFormula: 'référence internationale + transport et risque politique', route, priority, politicalClauses: clauses, breachPenalty: priority >= 70 ? 28 : 18, status: 'active' };
  };
  // Les flux historiques restent dans `baselineEnergyFlows` : ils décrivent
  // la dépendance de départ, mais ne sont pas des contrats négociables déjà
  // signés dans la partie. Les matérialiser ici bloquerait les premières
  // négociations du joueur en consommant la capacité physique des nœuds.
  add('major-irn-oil-chn', 'IRN', 'CHN', 'irn-oil', 'oil', 16, 'Golfe Persique · mer de Chine', 64, ['Paiement en devises ou mécanisme compensatoire', 'Risque de sanctions extraterritoriales']);
  add('major-irn-gas-tur', 'IRN', 'TUR', 'irn-gas', 'gas', 8, 'Réseau iranien · Anatolie', 61, ['Garantie de transit', 'Révision annuelle du prix']);
  add('major-idn-oil-kor', 'IDN', 'KOR', 'idn-oil', 'oil', 5, 'Détroit de Malacca', 55, ['Priorité aux cargaisons contractuelles']);
  add('major-idn-gas-jpn', 'IDN', 'JPN', 'idn-gas', 'gas', 4, 'GNL · Asie orientale', 56, ['Engagement de livraison GNL']);
  return contracts;
}

const theater = (id: string, countryId: CountryId, location: string, hostCountryIds: CountryId[], personnelThousands: number, mission: string, status: MilitaryTheater['status'], readiness: number, supplyCoverageMonths: number, access: MilitaryTheater['access']): MilitaryTheater => ({
  id, countryId, location, hostCountryIds, personnelThousands, availablePersonnelThousands: personnelThousands, inTransitPersonnelThousands: 0, mission, status, readiness, supplyCoverageMonths, access,
});

const base = (id: string, ownerCountryId: CountryId, hostCountryId: CountryId, location: string, type: MilitaryBase['type'], capacityThousands: number, assignedPersonnelThousands: number, mission: string, access: MilitaryBase['access'] = 'host_consent'): MilitaryBase => ({
  id, ownerCountryId, hostCountryId, location, type, capacityThousands, assignedPersonnelThousands, status: 'active', access, mission, agreementStartAt: '2000-01-01',
});

function majorMilitaryPostures2000(state: WorldState): Pick<WorldState, 'militaryTheaters' | 'militaryBases'> {
  const militaryTheaters = { ...state.militaryTheaters };
  const militaryBases = { ...state.militaryBases };
  const theaters: MilitaryTheater[] = [
    theater('theater-USA-north-america', 'USA', 'Amérique du Nord', [], 660, 'Défense du territoire et réserve stratégique', 'home', 82, 12, 'national'),
    theater('theater-USA-europe', 'USA', 'Europe · OTAN', ['DEU', 'GBR', 'ITA', 'TUR'], 105, 'Dissuasion et renfort allié', 'active', 76, 5, 'allied'),
    theater('theater-USA-pacific', 'USA', 'Pacifique occidental', ['JPN', 'KOR'], 85, 'Stabilité maritime et défense des alliances', 'active', 74, 4, 'allied'),
    theater('theater-CHN-east-asia', 'CHN', 'Façade maritime orientale', [], 370, 'Dissuasion régionale et contrôle côtier', 'home', 69, 9, 'national'),
    theater('theater-CHN-western-frontier', 'CHN', 'Frontières continentales', ['IND', 'RUS'], 310, 'Surveillance et contrôle des frontières', 'active', 63, 5, 'national'),
    theater('theater-RUS-west', 'RUS', 'Russie européenne', [], 420, 'Défense du territoire européen', 'home', 64, 9, 'national'),
    theater('theater-RUS-caucasus', 'RUS', 'Caucase et Asie centrale', ['KAZ', 'ARM', 'GEO'], 95, 'Présence régionale et contrôle des accès', 'active', 60, 3, 'host_consent'),
    theater('theater-IND-northern', 'IND', 'Frontière himalayenne', ['CHN', 'PAK'], 235, 'Défense terrestre et surveillance frontalière', 'active', 62, 4, 'national'),
    theater('theater-IND-indian-ocean', 'IND', 'Océan Indien', [], 90, 'Sécurisation des voies maritimes', 'active', 67, 4, 'national'),
    theater('theater-JPN-home', 'JPN', 'Archipel japonais', [], 240, 'Défense territoriale et protection maritime', 'home', 78, 10, 'national'),
    theater('theater-KOR-peninsula', 'KOR', 'Péninsule coréenne', [], 190, 'Dissuasion et défense de la ligne de démarcation', 'active', 72, 6, 'national'),
    theater('theater-TUR-southeast', 'TUR', 'Anatolie orientale', [], 180, 'Sécurité des frontières et lutte contre les insurrections', 'active', 65, 5, 'national'),
    theater('theater-SAU-gulf', 'SAU', 'Golfe et péninsule Arabique', [], 75, 'Protection des installations énergétiques', 'active', 58, 4, 'national'),
    theater('theater-IRN-gulf', 'IRN', 'Golfe Persique et détroit d’Ormuz', [], 120, 'Dissuasion côtière et contrôle des approches', 'active', 61, 4, 'national'),
    theater('theater-IDN-archipelago', 'IDN', 'Archipel indonésien', [], 105, 'Contrôle maritime et souveraineté insulaire', 'active', 54, 3, 'national'),
    theater('theater-GBR-atlantic', 'GBR', 'Atlantique Nord', [], 55, 'Surveillance maritime et contribution OTAN', 'active', 73, 5, 'national'),
  ];
  for (const item of theaters) if (hasCountries(state, [item.countryId, ...item.hostCountryIds])) militaryTheaters[item.id] ??= item;
  const bases: MilitaryBase[] = [
    base('base-USA-RAMSTEIN', 'USA', 'DEU', 'Ramstein · Allemagne', 'permanent', 24, 16, 'Commandement aérien et logistique OTAN', 'allied'),
    base('base-USA-YOKOSUKA', 'USA', 'JPN', 'Yokosuka · Japon', 'permanent', 18, 11, 'Flotte du Pacifique occidental', 'allied'),
    base('base-USA-OSAN', 'USA', 'KOR', 'Osan · Corée du Sud', 'permanent', 16, 9, 'Alerte aérienne et dissuasion', 'allied'),
    base('base-GBR-AKROTIRI', 'GBR', 'CYP', 'Akrotiri · Chypre', 'permanent', 8, 3.5, 'Projection et renseignement en Méditerranée', 'host_consent'),
    base('base-RUS-GYUMRI', 'RUS', 'ARM', 'Gyumri · Arménie', 'prepositioned', 7, 3, 'Présence terrestre dans le Caucase', 'host_consent'),
  ];
  for (const item of bases) if (hasCountries(state, [item.ownerCountryId, item.hostCountryId])) militaryBases[item.id] ??= item;
  return { militaryTheaters, militaryBases };
}

function majorTreaties2000(state: WorldState): WorldState['treaties'] {
  const treaties = { ...state.treaties };
  const add = (treaty: TreatyState) => {
    if (hasCountries(state, treaty.parties)) treaties[treaty.id] ??= treaty;
  };
  // Les accords historiques sont référencés comme des cadres disponibles,
  // sans être des traités nouvellement signés par le joueur. Le module des
  // organisations internationales porte leur vie politique et leurs votes.
  add({ id: 'treaty-nato-washington', parties: ['USA', 'CAN', 'GBR', 'FRA', 'DEU', 'ITA', 'ESP', 'POL', 'TUR', 'NOR', 'BEL', 'NLD', 'PRT', 'GRC'], label: 'Alliance atlantique · traité de Washington', status: 'draft', startDate: '1949-04-04', monthlyEffects: [] });
  add({ id: 'treaty-nafta', parties: ['USA', 'CAN', 'MEX'], label: 'ALENA · zone de libre-échange nord-américaine', status: 'draft', startDate: '1994-01-01', monthlyEffects: [] });
  add({ id: 'treaty-us-japan-security', parties: ['USA', 'JPN'], label: 'Traité de sécurité États-Unis–Japon', status: 'draft', startDate: '1960-06-23', monthlyEffects: [] });
  add({ id: 'treaty-us-korea-defense', parties: ['USA', 'KOR'], label: 'Accord de défense États-Unis–Corée du Sud', status: 'draft', startDate: '1953-10-01', monthlyEffects: [] });
  add({ id: 'treaty-anzus', parties: ['USA', 'AUS'], label: 'ANZUS · pacte de sécurité du Pacifique', status: 'draft', startDate: '1952-04-29', monthlyEffects: [] });
  add({ id: 'treaty-european-single-market', parties: ['FRA', 'DEU', 'ITA', 'ESP', 'GBR', 'POL', 'BEL', 'NLD', 'PRT', 'GRC', 'IRL', 'DNK', 'SWE', 'AUT', 'FIN'], label: 'Marché unique européen', status: 'draft', startDate: '1993-01-01', monthlyEffects: [] });
  add({ id: 'treaty-shanghai-five', parties: ['CHN', 'RUS', 'KAZ', 'KGZ', 'TJK'], label: 'Groupe de Shanghai · confiance et sécurité frontalière', status: 'draft', startDate: '1996-04-26', monthlyEffects: [] });
  return treaties;
}

/**
 * Applique le pack de profondeur sans remplacer les données déjà présentes.
 * Cette propriété est utile aux sauvegardes : réexécuter la fonction ne double
 * ni les routes, ni les contrats, ni les traités.
 */
export function applyMajorCountryPack2000(state: WorldState): WorldState {
  const energyNodes = { ...state.energyNodes, ...Object.fromEntries(Object.entries(additionalEnergyNodes2000).filter(([_, node]) => hasCountries(state, [node.countryId]))) };
  const countryEnergy = { ...state.countryEnergy };
  for (const [countryId, profile] of Object.entries(majorEnergyProfiles)) {
    if (state.countries[countryId]) countryEnergy[countryId] ??= profile;
  }
  const military = majorMilitaryPostures2000(state);
  return {
    ...state,
    relations: majorRelations2000(state),
    tradeFlows: majorTradeFlows2000(state),
    energyNodes,
    countryEnergy,
    energyContracts: majorEnergyContracts2000({ ...state, energyNodes }, energyNodes),
    militaryTheaters: military.militaryTheaters,
    militaryBases: military.militaryBases,
    treaties: majorTreaties2000(state),
  };
}
