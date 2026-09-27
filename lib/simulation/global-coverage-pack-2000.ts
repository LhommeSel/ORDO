import type {
  BilateralTradeFlow,
  CountryId,
  EconomicProductFamily,
  EnergyNode,
  WorldState,
} from './types';

/**
 * Couche de couverture finale du registre mondial.
 *
 * Les fiches génériques restent volontairement compactes, mais aucune ne doit
 * être une île dans le moteur. Cette couche rattache chaque pays qui n'a pas
 * encore de lien à un corridor régional, lui donne un objectif lisible et,
 * lorsque c'est pertinent, une ressource énergétique ou une zone de tension.
 */

type CoverageRule = {
  ids: CountryId[];
  anchor: CountryId;
  label: string;
  vulnerability: string;
  redLine: string;
  mix: Partial<Record<EconomicProductFamily, number>>;
  exportOriented?: boolean;
};

const coverageRules: CoverageRule[] = [
  { ids: 'ALB AND BGR BIH CYP EST IRL ISL LVA LTU LUX MDA MKD MNE NOR SVK SVN VAT LIE MCO SMR MLT'.split(' '), anchor: 'DEU', label: 'les corridors européens', vulnerability: 'Dépendance aux marchés européens', redLine: 'Isolement du marché européen', mix: { manufactured_goods: 0.45, industrial_inputs: 0.3, food: 0.25 } },
  { ids: 'ARM AZE GEO BLR KGZ TJK TKM'.split(' '), anchor: 'RUS', label: 'les équilibres de l’espace post-soviétique', vulnerability: 'Enclavement et dépendance aux corridors terrestres', redLine: 'Perte du contrôle des frontières ou des corridors', mix: { energy: 0.25, raw_materials: 0.35, industrial_inputs: 0.2, manufactured_goods: 0.2 }, exportOriented: true },
  { ids: 'AGO BEN BWA BDI BFA CAF TCD COM COG CPV ERI SWZ GAB GMB GIN GNB LSO LBR MDG MWI MLI MRT MUS NAM NER RWA STP SYC SLE SOM SSD SDN TGO ZMB MOZ TZA SEN CIV CMR UGA COD ETH GHA GNQ ZWE'.split(' '), anchor: 'ZAF', label: 'les routes régionales africaines', vulnerability: 'Infrastructures et débouchés régionaux limités', redLine: 'Débordement d’une crise transfrontalière', mix: { raw_materials: 0.35, food: 0.3, manufactured_goods: 0.2, energy: 0.15 }, exportOriented: true },
  { ids: 'DJI DZA EGY IRQ JOR LBN LBY OMN PSE SYR YEM'.split(' '), anchor: 'EGY', label: 'les corridors de la mer Rouge et du Levant', vulnerability: 'Exposition aux crises de transit et de sécurité', redLine: 'Blocage d’un corridor maritime ou frontalier', mix: { energy: 0.3, raw_materials: 0.2, manufactured_goods: 0.3, food: 0.2 } },
  { ids: 'BHR BRN KWT'.split(' '), anchor: 'SAU', label: 'la sécurité du Golfe', vulnerability: 'Vulnérabilité des routes énergétiques du Golfe', redLine: 'Blocage du détroit ou attaque d’une infrastructure', mix: { energy: 0.48, manufactured_goods: 0.3, food: 0.22 } },
  { ids: 'AFG BGD BTN LKA MDV MNG NPL'.split(' '), anchor: 'IND', label: 'les équilibres de l’Asie du Sud', vulnerability: 'Pression démographique et dépendance aux importations', redLine: 'Crise frontalière ou rupture des approvisionnements', mix: { food: 0.3, manufactured_goods: 0.35, raw_materials: 0.2, energy: 0.15 } },
  { ids: 'KHM LAO MMR PHL TLS VNM'.split(' '), anchor: 'CHN', label: 'les chaînes d’Asie du Sud-Est', vulnerability: 'Dépendance aux chaînes maritimes et industrielles', redLine: 'Blocage des détroits ou basculement d’un voisin', mix: { manufactured_goods: 0.45, industrial_inputs: 0.3, food: 0.15, energy: 0.1 } },
  { ids: 'ATG BHS BRB BLZ DMA GRD SLV GUY HTI HND JAM KNA LCA TTO VCT'.split(' '), anchor: 'USA', label: 'les routes caribéennes', vulnerability: 'Petite échelle et dépendance aux flux extérieurs', redLine: 'Rupture des routes maritimes ou crise sociale prolongée', mix: { food: 0.3, manufactured_goods: 0.35, energy: 0.2, raw_materials: 0.15 } },
  { ids: 'BOL CRI CUB DOM ECU NIC PAN PER PRY SUR URY VEN'.split(' '), anchor: 'BRA', label: 'les marchés sud-américains', vulnerability: 'Dépendance aux matières premières et aux capitaux', redLine: 'Fermeture des débouchés régionaux', mix: { raw_materials: 0.35, food: 0.3, manufactured_goods: 0.2, energy: 0.15 }, exportOriented: true },
  { ids: 'FJI KIR MHL FSM NRU PLW PNG WSM SLB TON TUV VUT'.split(' '), anchor: 'AUS', label: 'les routes du Pacifique', vulnerability: 'Isolement logistique et vulnérabilité climatique', redLine: 'Rupture de l’accès maritime', mix: { food: 0.35, raw_materials: 0.15, manufactured_goods: 0.35, energy: 0.15 } },
  { ids: 'GTM'.split(' '), anchor: 'MEX', label: 'les chaînes méso-américaines', vulnerability: 'Dépendance aux remises et aux routes nord-américaines', redLine: 'Débordement d’une crise centro-américaine', mix: { food: 0.3, manufactured_goods: 0.4, industrial_inputs: 0.3 } },
  { ids: 'NZL'.split(' '), anchor: 'AUS', label: 'les équilibres de l’ANZAC', vulnerability: 'Éloignement des grands marchés', redLine: 'Crise des routes du Pacifique', mix: { food: 0.4, raw_materials: 0.25, manufactured_goods: 0.35 }, exportOriented: true },
];

const resourceNodes: Record<string, EnergyNode> = {
  'aze-oil': { id: 'aze-oil', countryId: 'AZE', resource: 'oil', label: 'Caspienne · péninsule d’Apchéron', provenReserves: 7000, probableReserves: 2500, annualProduction: 27, annualCapacity: 38, domesticConsumption: 7, storageCapacity: 8, stocks: 3, extractionCost: 17, declineRate: 0.018, developmentLeadMonths: 42, infrastructure: ['Terminal de Bakou', 'Oléoduc vers la mer Noire'] },
  'ago-oil': { id: 'ago-oil', countryId: 'AGO', resource: 'oil', label: 'Cabinda et offshore angolais', provenReserves: 8000, probableReserves: 3800, annualProduction: 36, annualCapacity: 50, domesticConsumption: 5, storageCapacity: 8, stocks: 3, extractionCost: 20, declineRate: 0.022, developmentLeadMonths: 48, infrastructure: ['Cabinda', 'Terminaux de Luanda'] },
  'bhr-oil': { id: 'bhr-oil', countryId: 'BHR', resource: 'oil', label: 'Bassin de Bahreïn', provenReserves: 120, probableReserves: 90, annualProduction: 4, annualCapacity: 6, domesticConsumption: 2, storageCapacity: 2, stocks: 1, extractionCost: 22, declineRate: 0.03, developmentLeadMonths: 36, infrastructure: ['Sitra'] },
  'brn-oil': { id: 'brn-oil', countryId: 'BRN', resource: 'oil', label: 'Offshore de Brunei', provenReserves: 1100, probableReserves: 500, annualProduction: 15, annualCapacity: 20, domesticConsumption: 2, storageCapacity: 4, stocks: 2, extractionCost: 15, declineRate: 0.02, developmentLeadMonths: 36, infrastructure: ['Lumut', 'Muara'] },
  'cog-oil': { id: 'cog-oil', countryId: 'COG', resource: 'oil', label: 'Offshore de Pointe-Noire', provenReserves: 1800, probableReserves: 700, annualProduction: 12, annualCapacity: 17, domesticConsumption: 2, storageCapacity: 3, stocks: 1, extractionCost: 21, declineRate: 0.024, developmentLeadMonths: 42, infrastructure: ['Pointe-Noire'] },
  'gab-oil': { id: 'gab-oil', countryId: 'GAB', resource: 'oil', label: 'Bassin côtier gabonais', provenReserves: 2000, probableReserves: 800, annualProduction: 14, annualCapacity: 20, domesticConsumption: 2, storageCapacity: 4, stocks: 2, extractionCost: 20, declineRate: 0.023, developmentLeadMonths: 42, infrastructure: ['Port-Gentil'] },
  'gnq-oil': { id: 'gnq-oil', countryId: 'GNQ', resource: 'oil', label: 'Offshore du golfe de Guinée', provenReserves: 1200, probableReserves: 700, annualProduction: 8, annualCapacity: 14, domesticConsumption: 1, storageCapacity: 2, stocks: 1, extractionCost: 22, declineRate: 0.025, developmentLeadMonths: 48, infrastructure: ['Malabo'] },
  'omn-oil': { id: 'omn-oil', countryId: 'OMN', resource: 'oil', label: 'Bassins d’Oman', provenReserves: 5500, probableReserves: 1800, annualProduction: 36, annualCapacity: 45, domesticConsumption: 9, storageCapacity: 9, stocks: 4, extractionCost: 14, declineRate: 0.02, developmentLeadMonths: 36, infrastructure: ['Mina al-Fahal', 'Duqm'] },
  'tto-gas': { id: 'tto-gas', countryId: 'TTO', resource: 'gas', label: 'Offshore de Trinité-et-Tobago', provenReserves: 850, probableReserves: 420, annualProduction: 24, annualCapacity: 32, domesticConsumption: 7, storageCapacity: 4, stocks: 2, extractionCost: 16, declineRate: 0.02, developmentLeadMonths: 42, infrastructure: ['Point Lisas', 'Atlantic LNG'] },
  'tkm-gas': { id: 'tkm-gas', countryId: 'TKM', resource: 'gas', label: 'Bassin gazier de l’Amou-Daria', provenReserves: 2900, probableReserves: 1800, annualProduction: 30, annualCapacity: 45, domesticConsumption: 18, storageCapacity: 7, stocks: 3, extractionCost: 12, declineRate: 0.014, developmentLeadMonths: 48, infrastructure: ['Réseau turkmène', 'Corridor vers l’Ouzbékistan'] },
  'bgd-gas': { id: 'bgd-gas', countryId: 'BGD', resource: 'gas', label: 'Bassins gaziers du Bengale', provenReserves: 350, probableReserves: 220, annualProduction: 12, annualCapacity: 17, domesticConsumption: 18, storageCapacity: 3, stocks: 1, extractionCost: 15, declineRate: 0.018, developmentLeadMonths: 36, infrastructure: ['Chittagong', 'Réseau national'] },
  'mmr-gas': { id: 'mmr-gas', countryId: 'MMR', resource: 'gas', label: 'Yadana et golfe de Martaban', provenReserves: 420, probableReserves: 250, annualProduction: 15, annualCapacity: 22, domesticConsumption: 7, storageCapacity: 4, stocks: 2, extractionCost: 18, declineRate: 0.02, developmentLeadMonths: 42, infrastructure: ['Yadana', 'Réseau côtier'] },
  'yem-oil': { id: 'yem-oil', countryId: 'YEM', resource: 'oil', label: 'Marib et bassin de Masila', provenReserves: 4000, probableReserves: 1500, annualProduction: 18, annualCapacity: 26, domesticConsumption: 5, storageCapacity: 5, stocks: 2, extractionCost: 21, declineRate: 0.028, developmentLeadMonths: 42, infrastructure: ['Aden', 'Masila'] },
};

const strategicDepthLabels: Record<CountryId, string> = {
  DEU: 'Stabiliser la base industrielle européenne',
  ITA: 'Préserver la base industrielle et méditerranéenne',
  POL: 'Ancrer la sécurité de la façade orientale',
  USA: 'Maintenir les alliances et l’avance technologique',
  GBR: 'Préserver les accès maritimes et financiers',
  RUS: 'Maintenir la cohésion et la profondeur stratégique',
  CHN: 'Sécuriser l’intégration industrielle et énergétique',
  SAU: 'Protéger les routes pétrolières et la succession',
  NOR: 'Convertir la rente énergétique en influence nordique',
  DZA: 'Stabiliser la rente et le voisinage maghrébin',
  LBY: 'Maintenir les exportations et l’équilibre régional',
};

const hasCountries = (state: WorldState, ids: CountryId[]) => ids.every((id) => Boolean(state.countries[id]));

type RelationValues = { relation: number; trust: number; tradeIntensity: number; securityAlignment: number; memories?: string[] };

function addRelationPair(relations: WorldState['relations'], state: WorldState, from: CountryId, to: CountryId, values: RelationValues) {
  if (!hasCountries(state, [from, to]) || from === to) return;
  const memories = values.memories ?? [];
  relations[`${from}:${to}`] ??= { from, to, ...values, memories: [...memories] };
  relations[`${to}:${from}`] ??= { from: to, to: from, ...values, memories: [...memories] };
}

const emptyProductMix = (): Record<EconomicProductFamily, number> => ({ food: 0, energy: 0, raw_materials: 0, industrial_inputs: 0, manufactured_goods: 0, strategic_technology: 0 });

function flow(exporterId: CountryId, importerId: CountryId, value: number, mix: Partial<Record<EconomicProductFamily, number>>, friction: number, reliability: number, capacity: number): BilateralTradeFlow {
  const productMix = { ...emptyProductMix(), ...mix };
  const total = Object.values(productMix).reduce((sum, share) => sum + share, 0) || 1;
  for (const family of Object.keys(productMix) as EconomicProductFamily[]) productMix[family] /= total;
  return { id: `${exporterId}-${importerId}`, exporterId, importerId, annualValueBillion2000Usd: value, productMix, friction, reliability, routeCapacityIndex: capacity, lastUpdatedAt: '2000-01-01' };
}

function ruleFor(countryId: CountryId): CoverageRule | undefined {
  return coverageRules.find((rule) => rule.ids.includes(countryId));
}

function applyCoverageStrategies(state: WorldState, countryIds: CountryId[], anchors: Record<CountryId, CountryId>): WorldState['countries'] {
  const countries = { ...state.countries };
  for (const countryId of countryIds) {
    const current = countries[countryId];
    const rule = ruleFor(countryId);
    const anchor = anchors[countryId];
    if (!current || !rule || !anchor || !state.countries[anchor]) continue;
    const goalId = `coverage-${countryId.toLowerCase()}`;
    if (!current.strategy.goals.some((goal) => goal.id === goalId)) {
      countries[countryId] = {
        ...current,
        strategy: {
          ...current.strategy,
          goals: [...current.strategy.goals, { id: goalId, label: `Sécuriser ${rule.label}`, priority: 58, progress: 18, status: 'active' }],
          vulnerabilities: Array.from(new Set([...current.strategy.vulnerabilities, rule.vulnerability])).slice(0, 5),
          redLines: Array.from(new Set([...current.strategy.redLines, rule.redLine])).slice(0, 5),
          partners: Array.from(new Set([...current.strategy.partners, anchor])),
          lastReviewDate: '2000-01-01',
        },
      };
    }
  }
  for (const [countryId, label] of Object.entries(strategicDepthLabels)) {
    const current = countries[countryId];
    if (!current || current.strategy.goals.length >= 2) continue;
    const goals = [...current.strategy.goals];
    if (!goals.some((goal) => goal.id === `depth-${countryId.toLowerCase()}`)) {
      goals.push({ id: `depth-${countryId.toLowerCase()}`, label, priority: 64, progress: 26, status: 'active' });
    }
    if (goals.length < 2) {
      goals.push({ id: `stability-${countryId.toLowerCase()}`, label: 'Préserver la continuité de l’État', priority: 52, progress: 24, status: 'active' });
    }
    countries[countryId] = {
      ...current,
      strategy: {
        ...current.strategy,
        goals,
        lastReviewDate: '2000-01-01',
      },
    };
  }
  return countries;
}

/**
 * Ajoute un premier lien à chaque pays encore absent du graphe. Le moteur
 * reste léger : un corridor par pays suffit pour produire des dossiers,
 * réactions et propositions sans transformer la carte en annuaire illisible.
 */
export function applyGlobalCoveragePack2000(state: WorldState): WorldState {
  const relations = { ...state.relations };
  const tradeFlows = { ...state.tradeFlows };
  const anchors: Record<CountryId, CountryId> = {};
  const countriesNeedingFocus: CountryId[] = [];
  const relationPresent = (id: CountryId) => Object.values(relations).some((relation) => relation.from === id);
  const tradePresent = (id: CountryId) => Object.values(tradeFlows).some((trade) => trade.exporterId === id || trade.importerId === id);

  for (const countryId of Object.keys(state.countries)) {
    const rule = ruleFor(countryId);
    if (!rule || countryId === rule.anchor) continue;
    const anchor = rule.anchor;
    anchors[countryId] = anchor;
    const country = state.countries[countryId];
    if (!relationPresent(countryId)) {
      const relation = Math.max(28, Math.min(72, 38 + country.weight * 0.2));
      addRelationPair(relations, state, countryId, anchor, {
        relation,
        trust: Math.max(18, relation - 7),
        tradeIntensity: Math.max(24, Math.min(70, relation + 4)),
        securityAlignment: Math.max(18, Math.min(65, relation - 3)),
        memories: [`Interdépendance régionale : ${rule.label}`],
      });
    }
    if (!tradePresent(countryId) && hasCountries(state, [countryId, anchor])) {
      const value = Math.max(1.2, Math.min(10, country.weight * 0.14));
      const exporterId = rule.exportOriented ? countryId : anchor;
      const importerId = rule.exportOriented ? anchor : countryId;
      const route = flow(exporterId, importerId, value, rule.mix, 18 + (country.weight % 8), 64 + Math.min(22, country.statisticalReliability * 0.2), 36 + Math.min(34, country.weight * 0.35));
      tradeFlows[route.id] ??= route;
    }
    if (country.strategy.goals.length < 2 || !country.strategy.goals.some((goal) => goal.id.startsWith('secondary-'))) countriesNeedingFocus.push(countryId);
  }

  const energyNodes = { ...state.energyNodes };
  for (const [id, node] of Object.entries(resourceNodes)) if (hasCountries(state, [node.countryId])) energyNodes[id] ??= node;

  return {
    ...state,
    countries: applyCoverageStrategies(state, countriesNeedingFocus, anchors),
    relations,
    tradeFlows,
    energyNodes,
  };
}
