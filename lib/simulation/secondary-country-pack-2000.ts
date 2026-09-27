import type {
  BilateralTradeFlow,
  CountryEnergyState,
  CountryId,
  EconomicProductFamily,
  EnergyNode,
  MilitaryBase,
  MilitaryTheater,
  WorldState,
} from './types';

/**
 * Deuxième niveau de profondeur du scénario 2000.
 *
 * Le registre mondial fournit déjà une fiche jouable à tous les États. Ce
 * pack ajoute les pays-pivots qui manquaient entre les vingt grandes
 * puissances et l'archétype générique : voisins, routes, énergie et posture
 * de sécurité. Les valeurs sont des repères de scénario, pas une base
 * statistique exhaustive.
 */
export const SECONDARY_COUNTRY_IDS: CountryId[] = [
  'AUT', 'BEL', 'NLD', 'CHE', 'DNK', 'SWE', 'FIN', 'PRT', 'GRC', 'CZE', 'HUN',
  'ROU', 'UKR', 'HRV', 'SRB', 'EGY', 'ISR', 'ARE', 'QAT', 'KWT', 'MAR', 'TUN',
  'NGA', 'KEN', 'KAZ', 'UZB', 'PAK', 'THA', 'MYS', 'SGP', 'PRK', 'TWN', 'ARG',
  'CHL', 'COL',
];

type StrategyPatch = {
  goals: Array<[string, number, number]>;
  vulnerabilities: string[];
  redLines: string[];
  partners: CountryId[];
  rivals: CountryId[];
};

const strategyPatches: Record<string, StrategyPatch> = {
  AUT: { goals: [['Ancrer l’Autriche dans l’Europe élargie', 78, 35], ['Préserver la compétitivité alpine', 64, 42]], vulnerabilities: ['Dépendance commerciale à l’Allemagne', 'Neutralité militaire'], redLines: ['Exclusion du marché européen', 'Déstabilisation des Balkans'], partners: ['DEU', 'ITA', 'CZE'], rivals: [] },
  BEL: { goals: [['Consolider le marché unique', 82, 48], ['Maintenir le compromis communautaire', 67, 39]], vulnerabilities: ['Coalition linguistique fragile', 'Dépendance aux échanges européens'], redLines: ['Blocage européen', 'Crise communautaire ouverte'], partners: ['FRA', 'DEU', 'NLD'], rivals: [] },
  NLD: { goals: [['Protéger la porte d’entrée commerciale européenne', 84, 51], ['Défendre le libre-échange', 72, 44]], vulnerabilities: ['Exposition au commerce mondial', 'Dépendance énergétique extérieure'], redLines: ['Entrave aux routes maritimes', 'Protectionnisme européen'], partners: ['DEU', 'GBR', 'BEL'], rivals: [] },
  CHE: { goals: [['Préserver la place financière et la neutralité', 76, 45], ['Sécuriser les échanges alpins', 63, 31]], vulnerabilities: ['Pression internationale sur le secret bancaire', 'Enclavement logistique'], redLines: ['Sanctions extraterritoriales', 'Violation de la neutralité'], partners: ['DEU', 'FRA', 'ITA'], rivals: [] },
  DNK: { goals: [['Sécuriser la Baltique et les détroits', 74, 38], ['Renforcer l’intégration nordique', 65, 36]], vulnerabilities: ['Petite profondeur stratégique', 'Dépendance aux routes maritimes'], redLines: ['Militarisation hostile de la Baltique'], partners: ['DEU', 'SWE', 'GBR'], rivals: [] },
  SWE: { goals: [['Préserver l’autonomie industrielle nordique', 77, 46], ['Surveiller la Baltique', 69, 33]], vulnerabilities: ['Neutralité sous pression', 'Dépendance aux exportations industrielles'], redLines: ['Extension d’une crise baltique'], partners: ['FIN', 'DNK', 'DEU'], rivals: [] },
  FIN: { goals: [['Consolider la résilience face à la Russie', 83, 42], ['Moderniser l’industrie exportatrice', 64, 38]], vulnerabilities: ['Frontière longue avec la Russie', 'Dépendance au commerce régional'], redLines: ['Violation de la frontière', 'Coupure des routes baltiques'], partners: ['SWE', 'DEU', 'RUS'], rivals: ['RUS'] },
  PRT: { goals: [['Valoriser la façade atlantique', 67, 35], ['Maintenir l’ancrage européen et atlantique', 74, 49]], vulnerabilities: ['Faible profondeur industrielle', 'Dépendance énergétique'], redLines: ['Isolement européen', 'Crise des routes atlantiques'], partners: ['ESP', 'GBR', 'USA'], rivals: [] },
  GRC: { goals: [['Contenir la rivalité égéenne', 82, 31], ['Moderniser l’économie maritime', 63, 37]], vulnerabilities: ['Dette et faiblesse administrative', 'Tensions avec la Turquie'], redLines: ['Atteinte aux îles ou aux eaux territoriales'], partners: ['FRA', 'CYP', 'USA'], rivals: ['TUR'] },
  CZE: { goals: [['Développer la base industrielle centre-européenne', 79, 47], ['Préparer l’ancrage européen', 71, 39]], vulnerabilities: ['Dépendance aux chaînes allemandes', 'Transition institutionnelle'], redLines: ['Désindustrialisation forcée'], partners: ['DEU', 'AUT', 'POL'], rivals: [] },
  HUN: { goals: [['Préserver la marge de manœuvre centre-européenne', 72, 34], ['Attirer les investissements industriels', 68, 43]], vulnerabilities: ['Dépendance énergétique russe', 'Polarisation politique'], redLines: ['Pression sur la souveraineté budgétaire'], partners: ['DEU', 'AUT', 'RUS'], rivals: [] },
  ROU: { goals: [['Ancrer la mer Noire dans les structures occidentales', 80, 29], ['Réformer l’appareil d’État', 76, 33]], vulnerabilities: ['Transition institutionnelle inachevée', 'Infrastructures déficientes'], redLines: ['Déstabilisation moldave ou mer Noire'], partners: ['USA', 'FRA', 'UKR'], rivals: [] },
  UKR: { goals: [['Préserver l’intégrité territoriale', 92, 28], ['Diversifier les débouchés énergétiques et industriels', 81, 26]], vulnerabilities: ['Pression russe', 'État et infrastructures fragiles'], redLines: ['Perte de contrôle territorial', 'Coupure des ports de la mer Noire'], partners: ['POL', 'USA', 'DEU'], rivals: ['RUS'] },
  HRV: { goals: [['Stabiliser l’Adriatique après la guerre', 83, 36], ['Relancer le tourisme et les ports', 66, 41]], vulnerabilities: ['Reconstruction inachevée', 'Dépendance au tourisme'], redLines: ['Retour d’une crise balkanique'], partners: ['ITA', 'DEU', 'AUT'], rivals: [] },
  SRB: { goals: [['Rétablir une marge diplomatique dans les Balkans', 86, 25], ['Réparer les infrastructures nationales', 74, 30]], vulnerabilities: ['Isolement et sanctions résiduelles', 'Question du Kosovo'], redLines: ['Perte de contrôle au Kosovo'], partners: ['RUS', 'GRC', 'HUN'], rivals: ['USA'] },
  EGY: { goals: [['Sécuriser le canal de Suez', 88, 45], ['Maintenir un rôle arabe central', 77, 38]], vulnerabilities: ['Pression démographique', 'Dépendance aux recettes extérieures'], redLines: ['Atteinte au canal ou au Sinaï'], partners: ['USA', 'SAU', 'FRA'], rivals: ['ISR'] },
  ISR: { goals: [['Préserver la supériorité de sécurité', 93, 52], ['Éviter l’isolement diplomatique', 76, 35]], vulnerabilities: ['Conflit non résolu', 'Dépendance à l’appui américain'], redLines: ['Attaque contre le territoire', 'Perte de la liberté d’action'], partners: ['USA', 'TUR', 'DEU'], rivals: ['IRN', 'SYR'] },
  ARE: { goals: [['Devenir une plateforme commerciale du Golfe', 80, 43], ['Sécuriser les exportations d’hydrocarbures', 86, 47]], vulnerabilities: ['Dépendance au pétrole', 'Vulnérabilité maritime du détroit'], redLines: ['Blocage d’Ormuz', 'Attaque des infrastructures'], partners: ['USA', 'GBR', 'SAU'], rivals: ['IRN'] },
  QAT: { goals: [['Transformer la rente gazière en influence', 84, 39], ['Diversifier les partenariats de sécurité', 75, 27]], vulnerabilities: ['Très petite profondeur démographique', 'Dépendance aux routes du Golfe'], redLines: ['Pression sur la souveraineté de la péninsule'], partners: ['USA', 'GBR', 'IRN'], rivals: [] },
  KWT: { goals: [['Garantir la sécurité du Koweït', 91, 34], ['Reconstituer la capacité financière après 1991', 70, 48]], vulnerabilities: ['Profondeur stratégique limitée', 'Dépendance au pétrole'], redLines: ['Nouvelle occupation du territoire'], partners: ['USA', 'GBR', 'SAU'], rivals: ['IRQ'] },
  MAR: { goals: [['Consolider le rôle de carrefour euro-méditerranéen', 74, 39], ['Moderniser les infrastructures et l’administration', 71, 34]], vulnerabilities: ['Question du Sahara occidental', 'Chômage urbain'], redLines: ['Remise en cause du Sahara'], partners: ['FRA', 'ESP', 'USA'], rivals: [] },
  TUN: { goals: [['Préserver la stabilité intérieure', 77, 46], ['Attirer les chaînes industrielles européennes', 68, 37]], vulnerabilities: ['Chômage des diplômés', 'Dépendance au tourisme'], redLines: ['Déstabilisation sociale prolongée'], partners: ['FRA', 'ITA', 'DZA'], rivals: [] },
  NGA: { goals: [['Maintenir l’unité fédérale', 89, 30], ['Convertir la rente pétrolière en infrastructures', 82, 24]], vulnerabilities: ['Tensions communautaires', 'Dépendance au pétrole et faiblesse logistique'], redLines: ['Sécession ou blocage du delta du Niger'], partners: ['USA', 'GBR', 'FRA'], rivals: [] },
  KEN: { goals: [['Faire de Mombasa une porte d’Afrique orientale', 73, 41], ['Stabiliser la région des Grands Lacs', 68, 29]], vulnerabilities: ['Inégalités régionales', 'Dépendance aux routes et aux importations'], redLines: ['Débordement d’une crise somalienne'], partners: ['GBR', 'USA', 'UGA'], rivals: [] },
  KAZ: { goals: [['Monétiser les hydrocarbures de la Caspienne', 88, 33], ['Équilibrer Russie, Chine et Occident', 85, 28]], vulnerabilities: ['Enclavement énergétique', 'Dépendance aux corridors russes'], redLines: ['Perte de souveraineté sur les corridors'], partners: ['RUS', 'CHN', 'TUR'], rivals: [] },
  UZB: { goals: [['Consolider l’autorité en Asie centrale', 83, 42], ['Contrôler l’eau et les frontières régionales', 78, 31]], vulnerabilities: ['Enclavement', 'Tensions hydriques et afghanes'], redLines: ['Infiltration armée ou perte du contrôle frontalier'], partners: ['RUS', 'KAZ', 'TUR'], rivals: ['TJK'] },
  PAK: { goals: [['Contenir l’Inde et sécuriser la profondeur occidentale', 91, 36], ['Stabiliser l’économie après les sanctions', 69, 25]], vulnerabilities: ['Rivalité avec l’Inde', 'Pression afghane'], redLines: ['Perte du Cachemire ou encerclement stratégique'], partners: ['CHN', 'USA', 'SAU'], rivals: ['IND'] },
  THA: { goals: [['Préserver la centralité de Bangkok en Asie du Sud-Est', 72, 40], ['Moderniser l’industrie exportatrice', 67, 44]], vulnerabilities: ['Instabilité politique', 'Dépendance aux routes maritimes'], redLines: ['Blocage du détroit de Malacca'], partners: ['USA', 'JPN', 'CHN'], rivals: [] },
  MYS: { goals: [['Sécuriser les détroits et l’industrialisation', 81, 45], ['Maintenir un équilibre entre Chine et États-Unis', 78, 32]], vulnerabilities: ['Tensions communautaires', 'Dépendance au commerce maritime'], redLines: ['Contrôle hostile des détroits'], partners: ['SGP', 'JPN', 'USA'], rivals: [] },
  SGP: { goals: [['Préserver la liberté du détroit de Malacca', 94, 55], ['Monter en gamme dans la finance et l’électronique', 82, 48]], vulnerabilities: ['Absence de profondeur stratégique', 'Dépendance au commerce mondial'], redLines: ['Blocage maritime ou intimidation régionale'], partners: ['USA', 'MYS', 'JPN'], rivals: [] },
  PRK: { goals: [['Garantir la survie du régime', 97, 41], ['Obtenir des concessions économiques', 83, 22]], vulnerabilities: ['Isolement et pénuries', 'Dépendance à la Chine'], redLines: ['Changement de régime imposé', 'Perte de la capacité de dissuasion'], partners: ['CHN', 'RUS'], rivals: ['USA', 'KOR', 'JPN'] },
  TWN: { goals: [['Préserver l’autonomie de fait', 97, 45], ['Maintenir les chaînes technologiques', 91, 57]], vulnerabilities: ['Pression militaire chinoise', 'Dépendance aux exportations'], redLines: ['Blocus ou renoncement forcé à l’autonomie'], partners: ['USA', 'JPN', 'SGP'], rivals: ['CHN'] },
  ARG: { goals: [['Sortir de la crise de la dette', 89, 21], ['Préserver le marché sud-américain', 75, 32]], vulnerabilities: ['Instabilité monétaire', 'Dette et chômage'], redLines: ['Perte de souveraineté financière'], partners: ['BRA', 'USA', 'CHL'], rivals: [] },
  CHL: { goals: [['Consolider l’ouverture commerciale', 76, 54], ['Sécuriser les exportations minières', 73, 42]], vulnerabilities: ['Dépendance aux matières premières', 'Inégalités sociales'], redLines: ['Blocage des ports du Pacifique'], partners: ['USA', 'ARG', 'JPN'], rivals: [] },
  COL: { goals: [['Réduire l’emprise des groupes armés', 92, 23], ['Moderniser les infrastructures andines', 72, 28]], vulnerabilities: ['Conflit intérieur', 'Dépendance aux matières premières'], redLines: ['Extension du conflit aux centres urbains'], partners: ['USA', 'FRA', 'BRA'], rivals: [] },
};

function hasCountries(state: WorldState, ids: CountryId[]) {
  return ids.every((id) => Boolean(state.countries[id]));
}

type RelationValues = { relation: number; trust: number; tradeIntensity: number; securityAlignment: number; memories?: string[] };

function addRelationPair(relations: WorldState['relations'], state: WorldState, from: CountryId, to: CountryId, values: RelationValues) {
  if (!hasCountries(state, [from, to])) return;
  const memories = values.memories ?? [];
  const forward = `${from}:${to}`;
  const reverse = `${to}:${from}`;
  relations[forward] ??= { from, to, ...values, memories: [...memories] };
  relations[reverse] ??= { from: to, to: from, ...values, memories: [...memories] };
}

function secondaryRelations2000(state: WorldState): WorldState['relations'] {
  const relations = { ...state.relations };
  const pair = (from: CountryId, to: CountryId, values: RelationValues) => addRelationPair(relations, state, from, to, values);
  const eu = { relation: 72, trust: 66, tradeIntensity: 74, securityAlignment: 58 };
  pair('AUT', 'DEU', eu); pair('BEL', 'FRA', eu); pair('NLD', 'DEU', { ...eu, tradeIntensity: 88 });
  pair('CHE', 'DEU', { relation: 74, trust: 70, tradeIntensity: 77, securityAlignment: 43 });
  pair('DNK', 'DEU', { relation: 70, trust: 65, tradeIntensity: 72, securityAlignment: 60 });
  pair('SWE', 'DEU', { relation: 67, trust: 61, tradeIntensity: 58, securityAlignment: 45 });
  pair('FIN', 'SWE', { relation: 78, trust: 73, tradeIntensity: 68, securityAlignment: 52 });
  pair('PRT', 'ESP', { relation: 79, trust: 74, tradeIntensity: 70, securityAlignment: 63 });
  pair('CZE', 'DEU', { ...eu, tradeIntensity: 82 }); pair('HUN', 'DEU', { ...eu, tradeIntensity: 70 });
  pair('ROU', 'FRA', { relation: 51, trust: 44, tradeIntensity: 39, securityAlignment: 47 });
  pair('UKR', 'RUS', { relation: 24, trust: 19, tradeIntensity: 46, securityAlignment: 18, memories: ['Frontières, flotte de la mer Noire et dépendance énergétique'] });
  pair('UKR', 'POL', { relation: 62, trust: 55, tradeIntensity: 36, securityAlignment: 43 });
  pair('GRC', 'TUR', { relation: 18, trust: 14, tradeIntensity: 36, securityAlignment: 42, memories: ['Contentieux égéens et rivalité autour de Chypre'] });
  pair('HRV', 'ITA', { relation: 69, trust: 62, tradeIntensity: 53, securityAlignment: 47 });
  pair('SRB', 'RUS', { relation: 58, trust: 50, tradeIntensity: 20, securityAlignment: 43 });
  pair('EGY', 'USA', { relation: 61, trust: 54, tradeIntensity: 26, securityAlignment: 67 });
  pair('EGY', 'ISR', { relation: 32, trust: 26, tradeIntensity: 18, securityAlignment: 20, memories: ['Paix froide et question palestinienne'] });
  pair('ISR', 'USA', { relation: 82, trust: 78, tradeIntensity: 38, securityAlignment: 90 });
  pair('ARE', 'SAU', { relation: 63, trust: 56, tradeIntensity: 42, securityAlignment: 61 });
  pair('QAT', 'USA', { relation: 55, trust: 49, tradeIntensity: 23, securityAlignment: 52 });
  pair('KWT', 'USA', { relation: 76, trust: 71, tradeIntensity: 24, securityAlignment: 84, memories: ['Protection américaine après 1991'] });
  pair('MAR', 'FRA', { relation: 69, trust: 62, tradeIntensity: 54, securityAlignment: 53 });
  pair('TUN', 'FRA', { relation: 67, trust: 59, tradeIntensity: 47, securityAlignment: 48 });
  pair('NGA', 'USA', { relation: 57, trust: 49, tradeIntensity: 35, securityAlignment: 30 });
  pair('KEN', 'GBR', { relation: 58, trust: 51, tradeIntensity: 23, securityAlignment: 35 });
  pair('KAZ', 'RUS', { relation: 66, trust: 58, tradeIntensity: 43, securityAlignment: 55 });
  pair('KAZ', 'CHN', { relation: 57, trust: 50, tradeIntensity: 31, securityAlignment: 42 });
  pair('UZB', 'KAZ', { relation: 45, trust: 38, tradeIntensity: 29, securityAlignment: 31, memories: ['Rivalités de frontière et partage de l’eau'] });
  pair('PAK', 'CHN', { relation: 76, trust: 69, tradeIntensity: 28, securityAlignment: 71 });
  pair('PAK', 'IND', { relation: 11, trust: 8, tradeIntensity: 12, securityAlignment: 9, memories: ['Cachemire et dissuasion nucléaire'] });
  pair('THA', 'USA', { relation: 67, trust: 60, tradeIntensity: 37, securityAlignment: 57 });
  pair('MYS', 'SGP', { relation: 71, trust: 64, tradeIntensity: 76, securityAlignment: 39 });
  pair('SGP', 'USA', { relation: 75, trust: 69, tradeIntensity: 42, securityAlignment: 73 });
  pair('PRK', 'CHN', { relation: 65, trust: 55, tradeIntensity: 22, securityAlignment: 51 });
  pair('TWN', 'USA', { relation: 72, trust: 65, tradeIntensity: 64, securityAlignment: 62 });
  pair('TWN', 'CHN', { relation: 18, trust: 13, tradeIntensity: 58, securityAlignment: 8, memories: ['Détroit de Taïwan et ambiguïté stratégique'] });
  pair('ARG', 'BRA', { relation: 68, trust: 62, tradeIntensity: 62, securityAlignment: 38 });
  pair('CHL', 'ARG', { relation: 54, trust: 47, tradeIntensity: 35, securityAlignment: 29 });
  pair('COL', 'USA', { relation: 73, trust: 65, tradeIntensity: 27, securityAlignment: 55 });
  return relations;
}

const emptyProductMix = (): Record<EconomicProductFamily, number> => ({ food: 0, energy: 0, raw_materials: 0, industrial_inputs: 0, manufactured_goods: 0, strategic_technology: 0 });

function flow(exporterId: CountryId, importerId: CountryId, annualValueBillion2000Usd: number, mix: Partial<Record<EconomicProductFamily, number>>, friction: number, reliability: number, routeCapacityIndex: number): BilateralTradeFlow {
  const productMix = { ...emptyProductMix(), ...mix };
  const total = Object.values(productMix).reduce((sum, share) => sum + share, 0) || 1;
  for (const family of Object.keys(productMix) as EconomicProductFamily[]) productMix[family] /= total;
  return { id: `${exporterId}-${importerId}`, exporterId, importerId, annualValueBillion2000Usd, productMix, friction, reliability, routeCapacityIndex, lastUpdatedAt: '2000-01-01' };
}

function secondaryTradeFlows2000(state: WorldState): WorldState['tradeFlows'] {
  const flows = { ...state.tradeFlows };
  const industry = { industrial_inputs: 0.35, manufactured_goods: 0.48, strategic_technology: 0.17 };
  const energy = { energy: 0.82, raw_materials: 0.12, industrial_inputs: 0.06 };
  const raw = { raw_materials: 0.54, energy: 0.2, food: 0.16, industrial_inputs: 0.1 };
  const add = (exporterId: CountryId, importerId: CountryId, value: number, mix: Partial<Record<EconomicProductFamily, number>>, friction: number, reliability: number, capacity: number) => {
    if (!hasCountries(state, [exporterId, importerId])) return;
    const item = flow(exporterId, importerId, value, mix, friction, reliability, capacity);
    flows[item.id] ??= item;
  };
  add('NLD', 'DEU', 43, industry, 8, 92, 88); add('DEU', 'NLD', 51, industry, 8, 93, 88);
  add('BEL', 'FRA', 39, industry, 9, 91, 86); add('CZE', 'DEU', 25, industry, 11, 89, 74);
  add('AUT', 'DEU', 20, industry, 10, 90, 76); add('SWE', 'DEU', 18, { raw_materials: 0.3, industrial_inputs: 0.28, manufactured_goods: 0.42 }, 12, 88, 69);
  add('CHE', 'DEU', 28, { strategic_technology: 0.3, manufactured_goods: 0.4, industrial_inputs: 0.3 }, 10, 92, 78);
  add('DNK', 'DEU', 17, { food: 0.28, industrial_inputs: 0.3, manufactured_goods: 0.42 }, 11, 90, 70);
  add('FIN', 'SWE', 12, { raw_materials: 0.34, industrial_inputs: 0.35, manufactured_goods: 0.31 }, 13, 88, 63);
  add('PRT', 'ESP', 16, { food: 0.22, manufactured_goods: 0.48, industrial_inputs: 0.3 }, 12, 88, 68);
  add('GRC', 'ITA', 11, { food: 0.28, manufactured_goods: 0.36, industrial_inputs: 0.36 }, 16, 79, 55);
  add('HUN', 'DEU', 22, industry, 11, 87, 69);
  add('ROU', 'DEU', 13, { food: 0.25, raw_materials: 0.25, industrial_inputs: 0.25, manufactured_goods: 0.25 }, 16, 78, 54);
  add('HRV', 'ITA', 8, { food: 0.25, manufactured_goods: 0.42, industrial_inputs: 0.33 }, 15, 82, 51);
  add('SRB', 'HUN', 6, { food: 0.3, raw_materials: 0.25, industrial_inputs: 0.25, manufactured_goods: 0.2 }, 20, 69, 41);
  add('UKR', 'RUS', 9, raw, 23, 65, 42); add('UKR', 'DEU', 7, { food: 0.4, raw_materials: 0.26, industrial_inputs: 0.34 }, 21, 66, 41);
  add('MAR', 'FRA', 13, { food: 0.25, industrial_inputs: 0.28, manufactured_goods: 0.47 }, 15, 82, 58);
  add('TUN', 'ITA', 9, industry, 14, 81, 52); add('EGY', 'ITA', 8, energy, 18, 73, 46);
  add('EGY', 'USA', 5, { raw_materials: 0.3, manufactured_goods: 0.28, food: 0.2, energy: 0.22 }, 20, 70, 43);
  add('NGA', 'USA', 16, energy, 19, 76, 52); add('NGA', 'GBR', 9, energy, 18, 77, 48);
  add('KEN', 'GBR', 5, { food: 0.35, raw_materials: 0.2, manufactured_goods: 0.45 }, 19, 75, 42);
  add('KAZ', 'RUS', 14, energy, 21, 74, 49); add('KAZ', 'CHN', 7, raw, 25, 66, 37);
  add('UZB', 'RUS', 6, { energy: 0.35, raw_materials: 0.3, food: 0.2, manufactured_goods: 0.15 }, 23, 68, 39);
  add('PAK', 'CHN', 5, { food: 0.3, raw_materials: 0.25, manufactured_goods: 0.3, industrial_inputs: 0.15 }, 25, 65, 34);
  add('QAT', 'JPN', 10, energy, 17, 86, 61); add('QAT', 'KOR', 7, energy, 17, 85, 57);
  add('ARE', 'JPN', 12, energy, 15, 87, 66); add('KWT', 'USA', 9, energy, 16, 84, 57);
  add('ISR', 'USA', 11, { strategic_technology: 0.48, manufactured_goods: 0.32, industrial_inputs: 0.2 }, 17, 86, 54);
  add('THA', 'JPN', 20, industry, 15, 84, 71); add('MYS', 'JPN', 18, industry, 14, 85, 73);
  add('MYS', 'CHN', 13, { energy: 0.18, raw_materials: 0.25, industrial_inputs: 0.22, manufactured_goods: 0.35 }, 16, 80, 61);
  add('SGP', 'USA', 16, { strategic_technology: 0.35, manufactured_goods: 0.45, industrial_inputs: 0.2 }, 13, 91, 82);
  add('PRK', 'CHN', 4, { raw_materials: 0.3, manufactured_goods: 0.4, food: 0.3 }, 28, 53, 28);
  add('TWN', 'USA', 22, { strategic_technology: 0.58, manufactured_goods: 0.31, industrial_inputs: 0.11 }, 19, 88, 64);
  add('TWN', 'CHN', 17, industry, 18, 77, 60);
  add('ARG', 'BRA', 12, { food: 0.42, raw_materials: 0.2, industrial_inputs: 0.2, manufactured_goods: 0.18 }, 17, 79, 55);
  add('CHL', 'JPN', 13, raw, 20, 81, 57); add('COL', 'USA', 11, energy, 19, 75, 50);
  return flows;
}

const secondaryEnergyProfiles: Record<string, CountryEnergyState> = {
  EGY: { countryId: 'EGY', annualDemand: { oil: 62, gas: 28 }, domesticProduction: { oil: 34, gas: 18 }, legacyImports: { oil: 28, gas: 10 }, strategicStocks: { oil: 8, gas: 3 }, storageCapacity: { oil: 14, gas: 6 }, desiredCoverageMonths: { oil: 1.7, gas: 1.3 } },
  ARE: { countryId: 'ARE', annualDemand: { oil: 36, gas: 48 }, domesticProduction: { oil: 112, gas: 48 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 17, gas: 4 }, storageCapacity: { oil: 29, gas: 10 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
  QAT: { countryId: 'QAT', annualDemand: { oil: 8, gas: 14 }, domesticProduction: { oil: 18, gas: 28 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 4, gas: 3 }, storageCapacity: { oil: 7, gas: 7 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
  KWT: { countryId: 'KWT', annualDemand: { oil: 14, gas: 10 }, domesticProduction: { oil: 98, gas: 12 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 13, gas: 2 }, storageCapacity: { oil: 25, gas: 5 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
  NGA: { countryId: 'NGA', annualDemand: { oil: 28, gas: 14 }, domesticProduction: { oil: 105, gas: 18 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 12, gas: 3 }, storageCapacity: { oil: 22, gas: 7 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
  KAZ: { countryId: 'KAZ', annualDemand: { oil: 16, gas: 15 }, domesticProduction: { oil: 40, gas: 25 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 5, gas: 3 }, storageCapacity: { oil: 10, gas: 6 }, desiredCoverageMonths: { oil: 2, gas: 1.5 } },
  UKR: { countryId: 'UKR', annualDemand: { oil: 32, gas: 70 }, domesticProduction: { oil: 3, gas: 18 }, legacyImports: { oil: 29, gas: 52 }, strategicStocks: { oil: 7, gas: 9 }, storageCapacity: { oil: 14, gas: 20 }, desiredCoverageMonths: { oil: 2, gas: 1.5 } },
  PAK: { countryId: 'PAK', annualDemand: { oil: 20, gas: 25 }, domesticProduction: { oil: 6, gas: 18 }, legacyImports: { oil: 14, gas: 7 }, strategicStocks: { oil: 2, gas: 2 }, storageCapacity: { oil: 5, gas: 5 }, desiredCoverageMonths: { oil: 1.5, gas: 1 } },
  MYS: { countryId: 'MYS', annualDemand: { oil: 24, gas: 34 }, domesticProduction: { oil: 35, gas: 55 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 5, gas: 5 }, storageCapacity: { oil: 11, gas: 12 }, desiredCoverageMonths: { oil: 2, gas: 1.5 } },
};

const secondaryEnergyNodes: Record<string, EnergyNode> = {
  'egy-gas': { id: 'egy-gas', countryId: 'EGY', resource: 'gas', label: 'Delta du Nil et Méditerranée orientale', provenReserves: 1850, probableReserves: 900, annualProduction: 18, annualCapacity: 24, domesticConsumption: 28, storageCapacity: 6, stocks: 3, extractionCost: 13, declineRate: 0.016, developmentLeadMonths: 36, infrastructure: ['Réseau du delta', 'Terminaux méditerranéens'] },
  'are-oil': { id: 'are-oil', countryId: 'ARE', resource: 'oil', label: 'Abou Dhabi · Murban', provenReserves: 9800, probableReserves: 2400, annualProduction: 112, annualCapacity: 135, domesticConsumption: 36, storageCapacity: 29, stocks: 17, extractionCost: 9, declineRate: 0.012, developmentLeadMonths: 30, infrastructure: ['Jebel Dhanna', 'Fujairah'] },
  'qat-gas': { id: 'qat-gas', countryId: 'QAT', resource: 'gas', label: 'North Field · Golfe', provenReserves: 14000, probableReserves: 4300, annualProduction: 28, annualCapacity: 36, domesticConsumption: 14, storageCapacity: 7, stocks: 3, extractionCost: 6, declineRate: 0.008, developmentLeadMonths: 48, infrastructure: ['Ras Laffan', 'Chaîne GNL'] },
  'kwt-oil': { id: 'kwt-oil', countryId: 'KWT', resource: 'oil', label: 'Bassin du Koweït', provenReserves: 9600, probableReserves: 2000, annualProduction: 98, annualCapacity: 120, domesticConsumption: 14, storageCapacity: 25, stocks: 13, extractionCost: 8, declineRate: 0.012, developmentLeadMonths: 30, infrastructure: ['Al-Ahmadi', 'Mina Abdullah'] },
  'nga-oil': { id: 'nga-oil', countryId: 'NGA', resource: 'oil', label: 'Delta du Niger', provenReserves: 2200, probableReserves: 1100, annualProduction: 105, annualCapacity: 125, domesticConsumption: 28, storageCapacity: 22, stocks: 12, extractionCost: 18, declineRate: 0.02, developmentLeadMonths: 36, infrastructure: ['Bonny', 'Terminaux du delta'] },
  'kaz-oil': { id: 'kaz-oil', countryId: 'KAZ', resource: 'oil', label: 'Caspienne · Tengiz et Karachaganak', provenReserves: 9000, probableReserves: 4200, annualProduction: 40, annualCapacity: 58, domesticConsumption: 16, storageCapacity: 10, stocks: 5, extractionCost: 17, declineRate: 0.018, developmentLeadMonths: 48, infrastructure: ['Atyraou', 'Corridor CPC'] },
};

const theater = (id: string, countryId: CountryId, location: string, hostCountryIds: CountryId[], personnelThousands: number, mission: string, status: MilitaryTheater['status'], readiness: number, supplyCoverageMonths: number, access: MilitaryTheater['access']): MilitaryTheater => ({ id, countryId, location, hostCountryIds, personnelThousands, availablePersonnelThousands: personnelThousands, inTransitPersonnelThousands: 0, mission, status, readiness, supplyCoverageMonths, access });
const base = (id: string, ownerCountryId: CountryId, hostCountryId: CountryId, location: string, type: MilitaryBase['type'], capacityThousands: number, assignedPersonnelThousands: number, mission: string, access: MilitaryBase['access']): MilitaryBase => ({ id, ownerCountryId, hostCountryId, location, type, capacityThousands, assignedPersonnelThousands, status: 'active', access, mission, agreementStartAt: '2000-01-01' });

function secondaryMilitaryPostures2000(state: WorldState): Pick<WorldState, 'militaryTheaters' | 'militaryBases'> {
  const militaryTheaters = { ...state.militaryTheaters };
  const militaryBases = { ...state.militaryBases };
  const theaters = [
    theater('theater-UKR-black-sea', 'UKR', 'Mer Noire et frontières orientales', ['RUS'], 120, 'Surveillance territoriale et protection des ports', 'active', 48, 3, 'national'),
    theater('theater-PAK-kashmir', 'PAK', 'Cachemire et frontière indienne', ['IND'], 210, 'Dissuasion terrestre et contrôle de la frontière', 'active', 59, 4, 'national'),
    theater('theater-ISR-levant', 'ISR', 'Levant et frontières nationales', ['PSE', 'LBN', 'SYR'], 175, 'Alerte avancée et protection du territoire', 'active', 82, 5, 'national'),
    theater('theater-EGY-sinai', 'EGY', 'Sinaï et mer Rouge', [], 95, 'Contrôle du canal et sécurité des approches', 'active', 64, 4, 'national'),
    theater('theater-GRC-aegean', 'GRC', 'Mer Égée', ['TUR'], 34, 'Surveillance maritime et souveraineté insulaire', 'active', 61, 3, 'national'),
    theater('theater-PRK-peninsula', 'PRK', 'Péninsule coréenne', ['KOR'], 950, 'Survie du régime et dissuasion conventionnelle', 'active', 69, 5, 'national'),
    theater('theater-TWN-strait', 'TWN', 'Détroit de Taïwan', ['CHN'], 180, 'Alerte maritime et défense de l’autonomie de fait', 'active', 76, 4, 'national'),
    theater('theater-SGP-malacca', 'SGP', 'Détroit de Malacca', ['MYS'], 28, 'Protection des routes commerciales', 'active', 84, 6, 'national'),
    theater('theater-NGA-delta', 'NGA', 'Delta du Niger', [], 42, 'Protection des installations pétrolières', 'active', 45, 2, 'national'),
  ];
  for (const item of theaters) if (hasCountries(state, [item.countryId, ...item.hostCountryIds])) militaryTheaters[item.id] ??= item;
  const bases = [
    base('base-RUS-sevastopol', 'RUS', 'UKR', 'Sébastopol · mer Noire', 'permanent', 24, 13, 'Flotte de la mer Noire', 'host_consent'),
    base('base-USA-negev', 'USA', 'ISR', 'Néguev · Israël', 'support', 5, 1.5, 'Coopération de renseignement et prépositionnement', 'host_consent'),
    base('base-USA-sigonella-egypt', 'USA', 'EGY', 'Accès logistique · mer Rouge', 'support', 4, 1, 'Soutien maritime et canal de Suez', 'host_consent'),
    base('base-SGP-changi', 'SGP', 'SGP', 'Changi · Singapour', 'permanent', 10, 6, 'Aviation et contrôle des détroits', 'national'),
  ];
  for (const item of bases) if (hasCountries(state, [item.ownerCountryId, item.hostCountryId])) militaryBases[item.id] ??= item;
  return { militaryTheaters, militaryBases };
}

function applyStrategyPatches(state: WorldState): Record<CountryId, WorldState['countries'][CountryId]> {
  const countries = { ...state.countries };
  for (const [countryId, patch] of Object.entries(strategyPatches)) {
    const current = countries[countryId];
    if (!current) continue;
    countries[countryId] = {
      ...current,
      strategy: {
        goals: patch.goals.map(([label, priority, progress], index) => ({ id: `secondary-${countryId.toLowerCase()}-${index + 1}`, label, priority, progress, status: 'active' as const })),
        vulnerabilities: [...patch.vulnerabilities],
        redLines: [...patch.redLines],
        partners: patch.partners.filter((id) => Boolean(state.countries[id])),
        rivals: patch.rivals.filter((id) => Boolean(state.countries[id])),
        lastReviewDate: '2000-01-01',
      },
    };
  }
  return countries;
}

/** Applique le complément régional sans doubler les liens lors d'une réhydratation. */
export function applySecondaryCountryPack2000(state: WorldState): WorldState {
  const energyNodes = { ...state.energyNodes };
  for (const [id, node] of Object.entries(secondaryEnergyNodes)) if (hasCountries(state, [node.countryId])) energyNodes[id] ??= node;
  const countryEnergy = { ...state.countryEnergy };
  for (const [countryId, profile] of Object.entries(secondaryEnergyProfiles)) {
    if (state.countries[countryId] && (!countryEnergy[countryId] || state.sequence === 0)) countryEnergy[countryId] = profile;
  }
  const military = secondaryMilitaryPostures2000(state);
  return {
    ...state,
    countries: applyStrategyPatches(state),
    relations: secondaryRelations2000(state),
    tradeFlows: secondaryTradeFlows2000(state),
    energyNodes,
    countryEnergy,
    militaryTheaters: military.militaryTheaters,
    militaryBases: military.militaryBases,
  };
}
