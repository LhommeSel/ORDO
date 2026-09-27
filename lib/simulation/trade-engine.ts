import { commitWorldAction } from './ledger';
import { effectivePortGoodsCapacity } from './territory-data-americas-ports';
import type { BilateralTradeFlow, CountryId, EconomicProductFamily, WorldEffect, WorldState } from './types';

const productFamilies: EconomicProductFamily[] = ['food', 'energy', 'raw_materials', 'industrial_inputs', 'manufactured_goods', 'strategic_technology'];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

/**
 * Les ports ne sont pas des compteurs de tonnes : leur profil limite toutefois
 * la qualité effective d'une route commerciale. Les pays enclavés reçoivent un
 * plancher terrestre afin de ne pas rendre impossible tout commerce régional.
 */
function logisticsReadiness(state: WorldState, countryId: CountryId) {
  const ports = Object.values(state.territorial.assets)
    .filter((asset) => asset.kind === 'port' && asset.portProfile && state.territorial.territories[asset.territoryId]?.sovereignCountryId === countryId);
  if (!ports.length) return 46;
  const effective = ports.map((asset) => effectivePortGoodsCapacity(asset.portProfile!));
  const averageGoods = effective.reduce((sum, value) => sum + value, 0) / effective.length;
  const averageReach = ports.reduce((sum, asset) => sum + (asset.portProfile?.nationalReach ?? 5), 0) / ports.length;
  const averageGovernance = ports.reduce((sum, asset) => sum + (asset.portProfile?.governanceRisk ?? 5), 0) / ports.length;
  const averageFriction = ports.reduce((sum, asset) => sum + (asset.portProfile?.laborFriction ?? 2), 0) / ports.length;
  return clamp(averageGoods * 7.5 + averageReach * 4.5 - averageGovernance * 2.8 - averageFriction * 2, 24, 96);
}

function weightedIndex(flow: BilateralTradeFlow, state: WorldState, countryId: CountryId, key: 'productionIndex' | 'demandIndex') {
  const economy = state.macroEconomies[countryId];
  if (!economy) return 100;
  return productFamilies.reduce((sum, family) => sum + economy.products[family][key] * flow.productMix[family], 0);
}

function normalizedChinaExportMix(mix: BilateralTradeFlow['productMix'], elapsedMonths: number) {
  const targetManufactured = 0.64;
  const targetIndustrial = 0.24;
  const targetTechnology = 0.09;
  const step = Math.min(1, elapsedMonths / 12) * 0.18;
  const manufactured_goods = mix.manufactured_goods + (targetManufactured - mix.manufactured_goods) * step;
  const industrial_inputs = mix.industrial_inputs + (targetIndustrial - mix.industrial_inputs) * step;
  const strategic_technology = mix.strategic_technology + (targetTechnology - mix.strategic_technology) * step;
  const residualFamilies = ['food', 'energy', 'raw_materials'] as const;
  const residualCurrent = residualFamilies.reduce((sum, family) => sum + mix[family], 0) || 1;
  const residualTarget = Math.max(0, 1 - manufactured_goods - industrial_inputs - strategic_technology);
  return {
    ...mix,
    manufactured_goods: round(manufactured_goods), industrial_inputs: round(industrial_inputs), strategic_technology: round(strategic_technology),
    ...Object.fromEntries(residualFamilies.map((family) => [family, round(residualTarget * mix[family] / residualCurrent)])),
  } as BilateralTradeFlow['productMix'];
}

function chinaOpeningIsActive(state: WorldState) {
  // L'adhésion est très difficile à éviter depuis le point de départ 2000 :
  // les décisions du joueur peuvent modifier ses effets et la relation avec
  // Pékin, mais ne peuvent pas annuler par défaut l'ouverture déjà engagée.
  return state.currentDate >= '2001-01-01';
}

function chinaOpeningBonus(state: WorldState) {
  const interventionBalance = state.historicalAnchors['china-wto-integration']?.interventionBalance ?? 0;
  // Une politique de protection ou de coopération ne supprime pas l'entrée à
  // l'OMC ; elle modifie l'ampleur et la vitesse des débouchés étrangers.
  return clamp(7.5 + interventionBalance * 0.08, 4.5, 11);
}

function nextFlow(state: WorldState, flow: BilateralTradeFlow, elapsedMonths: number) {
  const exporter = state.macroEconomies[flow.exporterId];
  const importer = state.macroEconomies[flow.importerId];
  if (!exporter || !importer) return null;
  const exporterLogistics = logisticsReadiness(state, flow.exporterId);
  const importerLogistics = logisticsReadiness(state, flow.importerId);
  const routeCapacityIndex = Math.min(exporterLogistics, importerLogistics);
  const exportCapacity = weightedIndex(flow, state, flow.exporterId, 'productionIndex');
  const importDemand = weightedIndex(flow, state, flow.importerId, 'demandIndex');
  const chinaIndustrialRoute = flow.exporterId === 'CHN' && flow.productMix.manufactured_goods + flow.productMix.industrial_inputs >= 0.55;
  const openingBonus = chinaIndustrialRoute && chinaOpeningIsActive(state) ? chinaOpeningBonus(state) : 0;
  const annualGrowth = clamp(
    exporter.realGrowthAnnualPct * 0.28
      + importer.realGrowthAnnualPct * 0.2
      + exporter.productiveSystem.productiveRelocationBalanceAnnualPct * 0.55
      + (exporter.productiveSystem.globalValueChainIntegration - 50) * 0.025
      + (importer.productiveSystem.globalValueChainIntegration - 50) * 0.012
      + (exportCapacity - 100) * 0.025
      + (importDemand - 100) * 0.018
      + openingBonus
      - flow.friction * 0.08
      - Math.max(0, 55 - routeCapacityIndex) * 0.055,
    -18, 22,
  );
  const annualValueBillion2000Usd = round(flow.annualValueBillion2000Usd * Math.pow(Math.max(0.55, 1 + annualGrowth / 100), elapsedMonths / 12));
  const governanceDrag = Math.max(0, 65 - routeCapacityIndex) * 0.12;
  const reliabilityTarget = clamp(92 - flow.friction * 0.42 - governanceDrag, 35, 96);
  const reliability = round(flow.reliability + (reliabilityTarget - flow.reliability) * Math.min(1, elapsedMonths / 18));
  const frictionTarget = clamp(8 + Math.max(0, 70 - routeCapacityIndex) * 0.12, 4, 32);
  const friction = round(flow.friction + (frictionTarget - flow.friction) * Math.min(1, elapsedMonths / 24));
  const productMix = chinaIndustrialRoute && chinaOpeningIsActive(state)
    ? normalizedChinaExportMix(flow.productMix, elapsedMonths)
    : flow.productMix;
  return { annualValueBillion2000Usd, routeCapacityIndex: round(routeCapacityIndex), reliability, friction, productMix, lastUpdatedAt: state.currentDate } satisfies Partial<BilateralTradeFlow>;
}

function chinaIntegrationDossierEffects(state: WorldState): WorldEffect[] {
  const anchor = state.historicalAnchors['china-wto-integration'];
  const dossierId = anchor?.dossierId ?? 'historical-china-wto-integration';
  const dossier = state.strategicDossiers[dossierId];
  const china = state.macroEconomies.CHN;
  if (!china || !chinaOpeningIsActive(state)) return [];
  const effects: WorldEffect[] = [];
  const year = state.currentDate.slice(0, 4);
  const entryId = `${dossierId}-productive-shift-${year}`;
  if (dossier && !dossier.entries.some((entry) => entry.id === entryId)) {
    effects.push({
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: entryId, date: state.currentDate, title: 'Extension des chaînes productives chinoises',
        summary: `L’ouverture commerciale accélère l’intégration chinoise (${china.productiveSystem.globalValueChainIntegration.toFixed(0)}/100) et son solde d’implantation productive (${china.productiveSystem.productiveRelocationBalanceAnnualPct >= 0 ? '+' : ''}${china.productiveSystem.productiveRelocationBalanceAnnualPct.toFixed(1)} %/an). La dépendance aux intrants étrangers demeure élevée (${china.productiveSystem.foreignIndustrialDependency.toFixed(0)}/100), tandis que la demande d’énergie et de matières premières devient un enjeu stratégique.`,
        importance: 'major', actorIds: ['CHN', 'USA', 'FRA', 'DEU', 'JPN'], requiresDecision: false, visibility: 'player',
      },
      reason: 'La progression des flux commerciaux matérialise la montée industrielle chinoise dans le dossier historique.', visibility: 'player',
    });
  }

  // L'adhésion à l'OMC ne décide pas à elle seule les fournisseurs chinois.
  // Elle rend cependant cette recherche de routes, d'énergie et de matières plus
  // pressante à mesure que l'appareil productif s'insère dans le monde.
  const energyDossierId = 'china-energy-material-security';
  const openingMatured = state.currentDate >= '2002-01-01'
    && china.productiveSystem.globalValueChainIntegration >= 52;
  if (openingMatured && !state.strategicDossiers[energyDossierId]) {
    effects.push({
      kind: 'dossier_add',
      dossier: {
        id: energyDossierId,
        title: 'Sécurisation énergétique et matérielle de la Chine',
        kind: 'economic', status: 'emerging', importance: 'major', scope: 'world',
        actorIds: ['CHN', 'RUS', 'SAU', 'AUS', 'USA'],
        regionTags: ['Asie de l’Est', 'Eurasie', 'Moyen-Orient', 'Pacifique'],
        startedAt: state.currentDate, updatedAt: state.currentDate,
        phase: 'Recherche de fournisseurs et de routes fiables', trend: 'escalating',
        publicSummary: 'L’industrialisation chinoise accroît durablement la demande d’hydrocarbures et de matières premières. Pékin cherche à sécuriser ses fournisseurs, ses routes et sa marge de négociation sans que le résultat soit déterminé à l’avance.',
        followed: false, autoTracked: true, commitments: [], pendingDecisions: [], relatedCurrentIds: [],
        relatedAnchorId: 'china-wto-integration', relatedActionIds: [],
        entries: [{
          id: `${energyDossierId}-opening`, date: state.currentDate, title: 'La sécurité des approvisionnements devient stratégique',
          summary: `Avec une intégration aux chaînes mondiales de ${china.productiveSystem.globalValueChainIntegration.toFixed(0)}/100 et une exposition aux intrants critiques de ${china.productiveSystem.criticalInputExposure.toFixed(0)}/100, la Chine doit arbitrer entre diversification, contrats, investissements et contrôle des routes.`,
          importance: 'major', actorIds: ['CHN', 'RUS', 'SAU', 'AUS', 'USA'], requiresDecision: false, visibility: 'player',
        }],
      },
      reason: 'La montée productive chinoise ouvre un dossier mondial sur ses approvisionnements énergétiques et matériels.', visibility: 'player',
    });
  }
  return effects;
}

/** Met à jour les routes existantes, sans inventer de nouvelles entreprises. */
export function advanceTradeFlows(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  const effects: WorldEffect[] = Object.values(state.tradeFlows).flatMap((flow) => {
    const patch = nextFlow(state, flow, elapsedMonths);
    return patch ? [{ kind: 'trade_flow_patch' as const, flowId: flow.id, patch, reason: 'La route commerciale évolue selon production, demande, capacité logistique et rapports de dépendance.', visibility: 'debug' as const }] : [];
  });
  effects.push(...chinaIntegrationDossierEffects(state));
  if (!effects.length) return state;
  return commitWorldAction(state, {
    kind: 'economic', actorId: state.playerCountryId, origin: 'time', visibility: 'debug',
    intent: 'Faire évoluer les flux productifs et commerciaux mondiaux', effects,
  });
}
