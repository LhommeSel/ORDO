import { energyBalance } from './energy';
import { commitWorldAction } from './ledger';
import { stakeholderPressureByChannel } from './stakeholders';
import { debtCrisisEffects, projectDebtAndBanking } from './sovereign-debt';
import type {
  AggregateSectorId,
  CountryId,
  EconomicPolicyState,
  EconomicProductFamily,
  EconomicShock,
  EconomicShockChannel,
  MacroeconomicState,
  ProductFamilyState,
  StrategicDossier,
  WorldEffect,
  WorldProductMarket,
  WorldState,
} from './types';

const productFamilies: EconomicProductFamily[] = ['food', 'energy', 'raw_materials', 'industrial_inputs', 'manufactured_goods', 'strategic_technology'];
const aggregateSectors: AggregateSectorId[] = ['agriculture', 'extractive', 'manufacturing', 'construction', 'market_services', 'public_services'];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const transition = (speedPerYear: number, elapsedMonths: number) => 1 - Math.exp(-speedPerYear * elapsedMonths / 12);
const cycleFor = (growth: number): WorldState['worldEconomy']['cycle'] =>
  growth < 0 ? 'recession' : growth < 2 ? 'slowdown' : growth < 3.6 ? 'balanced' : growth < 5 ? 'expansion' : 'overheating';

/** Un choc léger reste dans le registre macro ; un choc persistant mérite une mémoire jouable. */
const DOSSIER_SHOCK_THRESHOLD = 20;
const shockChannelLabels: Record<EconomicShockChannel, string> = {
  demand: 'demande', supply: 'offre', financial: 'financier', trade: 'commercial', energy: 'énergétique', confidence: 'confiance',
};

function shockDossier(state: WorldState, shock: EconomicShock): StrategicDossier | null {
  const actorIds = [...new Set(shock.affectedCountryIds)].filter((countryId) => Boolean(state.countries[countryId] && state.macroEconomies[countryId]));
  if (Math.abs(shock.intensity) < DOSSIER_SHOCK_THRESHOLD || actorIds.length === 0) return null;
  const playerInvolved = actorIds.includes(state.playerCountryId);
  const importance = Math.abs(shock.intensity) >= 60 ? 'major' : 'moderate' as const;
  const dossierId = `economic-shock-${shock.id}`;
  const existing = state.strategicDossiers?.[dossierId];
  const entryId = `${dossierId}-${state.currentDate}`;
  const summary = `Le choc ${shockChannelLabels[shock.channel]} « ${shock.label} » atteint ${actorIds.length} pays et son intensité actuelle est de ${Math.abs(shock.intensity).toFixed(0)}.`;
  if (existing) return {
    ...existing,
    status: 'active', importance: importance === 'major' || existing.importance === 'major' ? 'major' : existing.importance,
    scope: playerInvolved ? 'player_involved' : existing.scope ?? 'world',
    actorIds,
    updatedAt: state.currentDate,
    phase: 'Propagation et réponses',
    trend: shock.remainingMonths > 6 ? 'escalating' : 'stable',
    publicSummary: summary,
    followed: playerInvolved || existing.followed,
    autoTracked: true,
    sleepingAt: undefined,
    pendingDecisions: playerInvolved && Math.abs(shock.intensity) >= 60
      ? (existing.pendingDecisions.length ? existing.pendingDecisions : ['Choisir une réponse au choc économique et à ses effets de propagation.'])
      : existing.pendingDecisions,
    entries: existing.entries.some((entry) => entry.id === entryId) ? existing.entries : [...existing.entries, {
      id: entryId, date: state.currentDate, title: 'Propagation actualisée', summary, importance, actorIds,
      requiresDecision: playerInvolved && Math.abs(shock.intensity) >= 60, visibility: 'player',
    }],
  };
  return {
    id: dossierId,
    title: `Choc ${shockChannelLabels[shock.channel]} — ${shock.label}`,
    kind: 'economic', status: 'active', importance,
    scope: playerInvolved ? 'player_involved' : 'world', actorIds, regionTags: [],
    startedAt: state.currentDate, updatedAt: state.currentDate, phase: 'Propagation initiale',
    trend: 'escalating', publicSummary: summary, followed: playerInvolved, autoTracked: true,
    commitments: [],
    pendingDecisions: playerInvolved && Math.abs(shock.intensity) >= 60 ? ['Choisir une réponse au choc économique et à ses effets de propagation.'] : [],
    relatedCurrentIds: [], relatedActionIds: [], entries: [{
      id: entryId, date: state.currentDate, title: 'Choc enregistré', summary, importance, actorIds,
      requiresDecision: playerInvolved && Math.abs(shock.intensity) >= 60, visibility: 'player',
    }],
  };
}

function affectedBy(shock: EconomicShock, countryId?: CountryId) {
  return !countryId || shock.affectedCountryIds.length === 0 || shock.affectedCountryIds.includes(countryId);
}

function shockPressure(state: WorldState, channel: EconomicShockChannel, countryId?: CountryId, family?: EconomicProductFamily) {
  const totalGdp = Object.values(state.macroEconomies).reduce((sum, economy) => sum + economy.realGdpBillion2000Usd, 0) || 1;
  return state.worldEconomy.activeShocks
    .filter((shock) => shock.channel === channel && affectedBy(shock, countryId) && (!family || !shock.productFamily || shock.productFamily === family))
    .reduce((sum, shock) => {
      if (countryId || shock.affectedCountryIds.length === 0) return sum + shock.intensity;
      const affectedGdp = shock.affectedCountryIds.reduce((value, id) => value + (state.macroEconomies[id]?.realGdpBillion2000Usd ?? 0), 0);
      return sum + shock.intensity * affectedGdp / totalGdp;
    }, 0);
}

function decayedShocks(state: WorldState, elapsedMonths: number) {
  return state.worldEconomy.activeShocks.flatMap((shock) => {
    const remainingMonths = Math.max(0, shock.remainingMonths - elapsedMonths);
    if (remainingMonths <= 0) return [];
    const intensity = shock.intensity * Math.pow(Math.max(0, 1 - shock.decayPerMonth), elapsedMonths);
    return Math.abs(intensity) < 0.1 ? [] : [{ ...shock, remainingMonths: round(remainingMonths), intensity: round(intensity) }];
  });
}

function weightedWorldValue(state: WorldState, selector: (economy: MacroeconomicState) => number) {
  const economies = Object.values(state.macroEconomies);
  const totalGdp = economies.reduce((sum, economy) => sum + economy.realGdpBillion2000Usd, 0) || 1;
  return economies.reduce((sum, economy) => sum + selector(economy) * economy.realGdpBillion2000Usd / totalGdp, 0);
}

function tradePartnerImpulse(state: WorldState, countryId: CountryId) {
  const exports = Object.values(state.tradeFlows).filter((flow) => flow.exporterId === countryId);
  const total = exports.reduce((sum, flow) => sum + flow.annualValueBillion2000Usd * flow.reliability / 100, 0);
  if (!total) return 0;
  return exports.reduce((sum, flow) => {
    const partner = state.macroEconomies[flow.importerId];
    if (!partner) return sum;
    const weight = flow.annualValueBillion2000Usd * flow.reliability / 100 / total;
    return sum + (partner.realGrowthAnnualPct - state.worldEconomy.globalGrowthAnnualPct) * weight;
  }, 0);
}

function evolveWorldMarket(state: WorldState, family: EconomicProductFamily, elapsedMonths: number): WorldProductMarket {
  const current = state.worldEconomy.productMarkets[family];
  const demandShock = shockPressure(state, 'demand', undefined, family);
  const tradeShock = shockPressure(state, 'trade', undefined, family);
  const supplyShock = shockPressure(state, 'supply', undefined, family) + (family === 'energy' ? shockPressure(state, 'energy') : 0);
  const weightedDemand = weightedWorldValue(state, (economy) => economy.products[family].demandIndex);
  const weightedSupply = weightedWorldValue(state, (economy) => {
    const product = economy.products[family];
    return product.productionIndex + product.importDependencyPct - product.exportOrientationPct;
  });
  const demandTarget = clamp(weightedDemand * (1 - demandShock / 250), 45, 180);
  const supplyTarget = clamp(weightedSupply * (1 - supplyShock / 220), 35, 150);
  const shortage = (demandTarget - supplyTarget) / 100;
  const inventoryTarget = clamp(current.inventoryMonths - shortage * elapsedMonths * 0.8, 0.15, 8);
  const scarcityPremium = shortage * current.volatility + supplyShock * 0.22 - demandShock * 0.12 + tradeShock * 0.08;
  const priceTarget = clamp(100 + scarcityPremium, 35, 300);
  const priceIndex = current.priceIndex + (priceTarget - current.priceIndex) * transition(3.2, elapsedMonths);
  return {
    ...current,
    priceIndex: round(priceIndex), demandIndex: round(demandTarget), supplyIndex: round(supplyTarget),
    inventoryMonths: round(inventoryTarget),
  };
}

function energyConstraint(state: WorldState, economy: MacroeconomicState) {
  let stress = 0;
  for (const resource of ['oil', 'gas'] as const) {
    const balance = energyBalance(state, economy.countryId, resource);
    const demand = state.countryEnergy[economy.countryId]?.annualDemand[resource] ?? 0;
    if (!balance || demand <= 0 || balance.deficit <= 0) continue;
    const uncoveredShare = balance.deficit / demand;
    const stockCushion = clamp(balance.coverageMonths / 3, 0, 1);
    stress += uncoveredShare * (1 - stockCushion * 0.8);
  }
  return clamp(stress / 2, 0, 1);
}

function productConstraint(economy: MacroeconomicState) {
  return productFamilies.reduce((worst, family) => {
    const product = economy.products[family];
    const available = product.productionIndex + product.importDependencyPct - product.exportOrientationPct + product.inventoryMonths * 4;
    const shortage = Math.max(0, product.demandIndex - available) / Math.max(1, product.demandIndex);
    const strategicWeight = family === 'energy' || family === 'industrial_inputs' || family === 'strategic_technology' ? 1.25 : 0.8;
    return Math.max(worst, shortage * strategicWeight);
  }, 0);
}

function strategicIndustryConstraint(state: WorldState, countryId: CountryId) {
  const sectors = Object.values(state.sectors).filter((sector) => sector.countryId === countryId);
  if (!sectors.length) return 0;
  return sectors.reduce((worst, sector) => {
    const fragility = (100 - sector.health) / 100;
    const dependency = sector.foreignDependency / 100;
    const overload = Math.max(0, sector.utilization - 92) / 100;
    return Math.max(worst, fragility * dependency * 0.55 + overload);
  }, 0);
}

function resourceExposure(economy: MacroeconomicState) {
  const energy = economy.products.energy;
  const materials = economy.products.raw_materials;
  return clamp((energy.exportOrientationPct - energy.importDependencyPct + materials.exportOrientationPct - materials.importDependencyPct) / 200, -1, 1);
}

function nextProducts(
  state: WorldState,
  economy: MacroeconomicState,
  growth: number,
  investmentGrowth: number,
  elapsedMonths: number,
) {
  return Object.fromEntries(productFamilies.map((family) => {
    const product = economy.products[family];
    const market = state.worldEconomy.productMarkets[family];
    const demandSensitivity = family === 'strategic_technology' ? 1.35 : family === 'industrial_inputs' ? 1.2 : family === 'food' ? 0.35 : 0.8;
    const demandGrowth = growth * demandSensitivity + (family === 'industrial_inputs' || family === 'strategic_technology' ? investmentGrowth * 0.18 : 0);
    const demandIndex = product.demandIndex * Math.pow(Math.max(0.2, 1 + demandGrowth / 100), elapsedMonths / 12);
    const domesticProductionDemand = Math.max(5, demandIndex - product.importDependencyPct + product.exportOrientationPct);
    const utilization = clamp(domesticProductionDemand / Math.max(1, product.capacityIndex) * 100, 35, 108);
    const productionGrowth = clamp(growth * 0.45 + (utilization - 75) * 0.08, -15, 15);
    const capacityGrowth = clamp((economy.investmentSharePctGdp - 18) * 0.075 + economy.policy.industrialSupport * 0.007 - 0.2, -2, 4);
    const capacityIndex = product.capacityIndex * Math.pow(1 + capacityGrowth / 100, elapsedMonths / 12);
    const productionIndex = clamp(product.productionIndex * Math.pow(Math.max(0.2, 1 + productionGrowth / 100), elapsedMonths / 12), 5, capacityIndex * 1.08);
    const inventoryFlow = (productionIndex + product.importDependencyPct - product.exportOrientationPct - demandIndex) / Math.max(20, demandIndex);
    const inventoryMonths = clamp(product.inventoryMonths + inventoryFlow * elapsedMonths * 0.35, 0.1, 12);
    const domesticPriceTarget = market.priceIndex * product.importDependencyPct / 100 + 100 * (1 - product.importDependencyPct / 100)
      + Math.max(0, 1.2 - inventoryMonths) * 8;
    const domesticPriceIndex = product.domesticPriceIndex + (domesticPriceTarget - product.domesticPriceIndex) * transition(2.5, elapsedMonths);
    return [family, {
      ...product, productionIndex: round(productionIndex), capacityIndex: round(capacityIndex), demandIndex: round(demandIndex),
      inventoryMonths: round(inventoryMonths), domesticPriceIndex: round(domesticPriceIndex),
    } satisfies ProductFamilyState];
  })) as MacroeconomicState['products'];
}

function nextSectors(economy: MacroeconomicState, growth: number, potentialGrowth: number, investmentGrowth: number, elapsedMonths: number) {
  return Object.fromEntries(aggregateSectors.map((sectorId) => {
    const sector = economy.sectors[sectorId];
    const cyclicalSensitivity = sectorId === 'construction' ? 1.6 : sectorId === 'manufacturing' ? 1.25 : sectorId === 'public_services' ? 0.25 : 0.75;
    const utilizationTarget = clamp(78 + economy.outputGapPct * 1.6 + (growth - potentialGrowth) * cyclicalSensitivity, 45, 98);
    const utilizationPct = sector.utilizationPct + (utilizationTarget - sector.utilizationPct) * transition(2.0, elapsedMonths);
    const capacityGrowth = clamp((economy.investmentSharePctGdp - 17) * 0.1 + (sectorId === 'construction' ? investmentGrowth * 0.06 : 0), -2, 6);
    const capacityIndex = sector.capacityIndex * Math.pow(1 + capacityGrowth / 100, elapsedMonths / 12);
    const productivityGrowth = clamp((economy.potentialGrowthAnnualPct - economy.populationGrowthAnnualPct) * 0.5, -1, 5);
    const productivityIndex = sector.productivityIndex * Math.pow(1 + productivityGrowth / 100, elapsedMonths / 12);
    return [sectorId, { ...sector, utilizationPct: round(utilizationPct), capacityIndex: round(capacityIndex), productivityIndex: round(productivityIndex) }];
  })) as MacroeconomicState['sectors'];
}

function nextCountryEconomy(
  state: WorldState,
  economy: MacroeconomicState,
  elapsedMonths: number,
  globalGrowth: number,
  globalFinancialStress: number,
  euroPolicyRate: number,
) {
  const profile = state.structuralProfiles[economy.countryId];
  const country = state.countries[economy.countryId];
  const years = elapsedMonths / 12;
  const demandShock = shockPressure(state, 'demand', economy.countryId) / 12;
  const supplyShock = shockPressure(state, 'supply', economy.countryId) / 15;
  const financialShock = shockPressure(state, 'financial', economy.countryId) / 10;
  const tradeShock = shockPressure(state, 'trade', economy.countryId) / 13;
  const energyShock = shockPressure(state, 'energy', economy.countryId) / 12;
  const confidenceShock = shockPressure(state, 'confidence', economy.countryId) / 10;
  const physicalEnergyStress = energyConstraint(state, economy);
  const bottleneck = productConstraint(economy);
  const strategicBottleneck = strategicIndustryConstraint(state, economy.countryId);
  const stakeholderDrag = stakeholderPressureByChannel(state, economy.countryId, 'economic_confidence') * 0.018;
  const sovereignStatusDrag: Record<MacroeconomicState['sovereignDebt']['status'], number> = {
    // Une tension de refinancement renchérit le crédit et ralentit
    // l'investissement, mais elle ne met pas mécaniquement toute l'économie
    // en récession. L'effet devient franchement récessif seulement lorsqu'un
    // défaut est constaté.
    stable: 0, watch: 0.04, stressed: 0.18, refinancing_crisis: 0.6, default: 2.2, restructuring: 1.4,
  };
  const sovereignDrag = sovereignStatusDrag[economy.sovereignDebt.status];
  const bankingDrag = Math.max(0, 62 - economy.bankingSystem.creditAvailability) * 0.035;
  const stabilityDrag = Math.max(0, 55 - (country?.metrics.stability ?? 55)) * 0.025;
  const resilience = (profile?.financialResilience ?? 50) / 100;
  const localFinancialTarget = clamp(
    globalFinancialStress * (1.2 - resilience * 0.55) + financialShock + stakeholderDrag * 3
      + Math.max(0, economy.privateDebtPctGdp - 120) * 0.08 + Math.max(0, economy.publicDebtPctGdp - 100) * 0.05
      + economy.bankingSystem.liquidityStress * 0.12 + sovereignDrag * 3,
    2, 100,
  );
  const financialStress = economy.financialStress + (localFinancialTarget - economy.financialStress) * transition(3.0, elapsedMonths);
  const confidenceTarget = clamp(
    75 + (country?.metrics.stability ?? 55) * 0.2 + (profile?.financialResilience ?? 50) * 0.08
      - financialStress * 0.35 - confidenceShock - stakeholderDrag * 1.8 - sovereignDrag * 2.5 - bankingDrag,
    10, 110,
  );
  const confidence = economy.confidenceIndex + (confidenceTarget - economy.confidenceIndex) * transition(2.2, elapsedMonths);
  const realRate = economy.policyRatePct - economy.inflationAnnualPct;
  const fiscalImpulse = economy.policy.fiscalStance * 0.018;
  const publicInvestmentImpulse = (economy.policy.publicInvestmentPctGdp - 3) * 0.22;
  const opennessImpulse = (economy.policy.tradeOpenness - 50) * 0.012;
  const partnerImpulse = tradePartnerImpulse(state, economy.countryId);
  const termsOfTrade = resourceExposure(economy) * (state.worldEconomy.productMarkets.energy.priceIndex - 100) * 0.035;
  const energyImportExposure = clamp((economy.products.energy.importDependencyPct - economy.products.energy.exportOrientationPct) / 100, -0.8, 0.9);
  const energyShockDrag = energyShock * energyImportExposure;
  const realWageGrowth = economy.wageGrowthAnnualPct - economy.inflationAnnualPct;
  const consumptionGrowth = clamp(
    economy.potentialGrowthAnnualPct * 0.9 + realWageGrowth * 0.35 + fiscalImpulse * 0.35
      + (confidence - 75) * 0.025 - financialStress * 0.025 - demandShock * 0.75 - energyShockDrag * 0.3,
    -15, 15,
  );
  const investmentGrowth = clamp(
    economy.potentialGrowthAnnualPct * 1.3 + economy.outputGapPct * 0.55 + publicInvestmentImpulse
      + (confidence - 75) * 0.04 - Math.max(0, realRate) * 0.25 - financialStress * 0.06
      - financialShock * 0.9 - supplyShock * 0.35 - energyShockDrag * 0.45 - sovereignDrag - bankingDrag,
    -30, 30,
  );
  const governmentGrowth = clamp(economy.potentialGrowthAnnualPct * 0.8 + fiscalImpulse - Math.max(0, economy.publicDebtPctGdp - 100) * 0.012, -8, 10);
  const exportGrowth = clamp(globalGrowth + partnerImpulse * 0.7 + termsOfTrade + opennessImpulse - tradeShock * 0.8, -20, 20);
  const importGrowth = clamp(consumptionGrowth * 0.45 + investmentGrowth * 0.32 + economy.importSharePctGdp / 100 + opennessImpulse * 0.5 - tradeShock * 0.25, -18, 22);
  const demandGrowth =
    consumptionGrowth * economy.householdConsumptionSharePctGdp / 100
    + investmentGrowth * economy.investmentSharePctGdp / 100
    + governmentGrowth * economy.governmentConsumptionSharePctGdp / 100
    + exportGrowth * economy.exportSharePctGdp / 100
    - importGrowth * economy.importSharePctGdp / 100;
  const catchUpRoom = -economy.outputGapPct * 0.38;
  const supplyCompatibleGrowth = economy.potentialGrowthAnnualPct + catchUpRoom - physicalEnergyStress * 8 - bottleneck * 5
    - strategicBottleneck * 2.5 - supplyShock * 0.65 - energyShockDrag * 0.85;
  const constrainedDemand = demandGrowth > supplyCompatibleGrowth
    ? supplyCompatibleGrowth + (demandGrowth - supplyCompatibleGrowth) * 0.28
    : demandGrowth;
  const growthTarget = clamp(constrainedDemand - stabilityDrag - stakeholderDrag - sovereignDrag - bankingDrag, -18, 16);
  const growth = economy.realGrowthAnnualPct + (growthTarget - economy.realGrowthAnnualPct) * transition(4.0, elapsedMonths);
  const averageGrowth = (economy.realGrowthAnnualPct + growth) / 2;
  const gdp = economy.realGdpBillion2000Usd * Math.pow(Math.max(0.05, 1 + averageGrowth / 100), years);

  const workforceShift: Record<string, number> = { strong_growth: 0.18, growth: 0.08, stable: -0.03, decline: -0.16, strong_decline: -0.28 };
  const workingAgeAnnualDelta = (workforceShift[profile?.workforceTrend ?? 'stable'] ?? 0) + economy.netMigrationRatePerThousand * 0.008;
  const workingAge = clamp(economy.workingAgeSharePct + workingAgeAnnualDelta * years, 48, 72);
  const populationGrowth = clamp(economy.populationGrowthAnnualPct + economy.netMigrationRatePerThousand * 0.005 * years, -3, 6);
  const population = economy.populationMillions * Math.pow(Math.max(0.8, 1 + populationGrowth / 100), years);
  const dependencyRatio = (100 - workingAge) / workingAge * 100;
  const laborForceParticipation = clamp(
    economy.laborForceParticipationPct + (economy.policy.laborFlexibility - 50) * 0.004 * years - Math.max(0, dependencyRatio - economy.dependencyRatioPct) * 0.02,
    35, 88,
  );
  const capitalGrowth = clamp(economy.investmentSharePctGdp * 0.17 - 3.2 - financialStress * 0.008, -3, 5.5);
  const capitalStock = economy.capitalStockIndex * Math.pow(1 + capitalGrowth / 100, years);
  const innovation = (profile?.innovationCapacity ?? 50) / 100;
  const catchup = (profile?.productivityCatchUp ?? 20) / 100;
  const productivityGrowth = clamp(0.35 + innovation * 1.25 + catchup * 1.4 + economy.policy.industrialSupport * 0.006 - bottleneck * 1.2, -1, 5.5);
  const productivity = economy.productivityIndex * Math.pow(1 + productivityGrowth / 100, years);
  const humanCapitalGrowth = clamp(0.15 + (profile?.innovationCapacity ?? 50) * 0.006 - Math.max(0, economy.unemploymentPct - 12) * 0.015, -0.5, 1.2);
  const humanCapital = economy.humanCapitalIndex * Math.pow(1 + humanCapitalGrowth / 100, years);
  const laborContribution = populationGrowth * 0.45 + workingAgeAnnualDelta * 0.35;
  const potentialTarget = clamp(productivityGrowth * 0.58 + capitalGrowth * 0.28 + laborContribution + catchup * 0.8, -2, 9);
  const potentialGrowth = economy.potentialGrowthAnnualPct + (potentialTarget - economy.potentialGrowthAnnualPct) * transition(0.65, elapsedMonths);
  const potentialGdp = economy.potentialGdpBillion2000Usd * Math.pow(Math.max(0.2, 1 + potentialGrowth / 100), years);
  const outputGap = clamp((gdp / Math.max(1, potentialGdp) - 1) * 100, -25, 20);

  const importedInflation = productFamilies.reduce((sum, family) => {
    const product = economy.products[family];
    return sum + (state.worldEconomy.productMarkets[family].priceIndex - product.domesticPriceIndex) * product.importDependencyPct / 100;
  }, 0) / productFamilies.length;
  const inflationTarget = clamp(2 + Math.max(0, outputGap) * 0.35 + importedInflation * 0.08 + physicalEnergyStress * 10 + supplyShock * 0.8, -5, 45);
  const inflation = economy.inflationAnnualPct + (inflationTarget - economy.inflationAnnualPct) * transition(1.25, elapsedMonths);
  const unemployment = clamp(economy.unemploymentPct - 0.42 * (growth - potentialGrowth) * years + Math.max(0, financialShock) * 0.025 * years, 1.5, 45);
  const wageTarget = inflation + clamp((growth - potentialGrowth) * 0.45 - (unemployment - 6) * 0.08 + productivityGrowth * 0.35, -5, 6);
  const wageGrowth = economy.wageGrowthAnnualPct + (wageTarget - economy.wageGrowthAnnualPct) * transition(1.6, elapsedMonths);

  const cyclicalShortfall = Math.max(0, potentialGrowth - growth);
  const automaticStabilizers = cyclicalShortfall * economy.policy.socialProtection / 100 * 0.55;
  // Les stabilisateurs sont un niveau contracyclique, pas une écriture qui
  // s'additionne indéfiniment à chaque frontière mensuelle. On fait converger
  // recettes et dépenses vers une cible temporaire ; lorsque l'écart de
  // production se referme, la cible revient progressivement vers le socle.
  const revenueTarget = clamp(economy.publicRevenuePctGdp - cyclicalShortfall * 0.16, 5, 70);
  const revenue = economy.publicRevenuePctGdp + (revenueTarget - economy.publicRevenuePctGdp) * transition(0.65, elapsedMonths);
  const spendingTarget = clamp(
    economy.publicSpendingPctGdp + clamp(automaticStabilizers, 0, 3) + economy.policy.fiscalStance * 0.02,
    5, 80,
  );
  const spending = economy.publicSpendingPctGdp + (spendingTarget - economy.publicSpendingPctGdp) * transition(0.8, elapsedMonths);
  const fiscalBalance = clamp(revenue - spending, -25, 20);
  const nominalGrowth = growth + inflation;
  const publicDebt = clamp(economy.publicDebtPctGdp - fiscalBalance * years - nominalGrowth * economy.publicDebtPctGdp / 100 * years, 0, 350);
  const currentAccount = clamp(economy.currentAccountPctGdp + (exportGrowth - importGrowth) * 0.08 * years + termsOfTrade * 0.12 * years, -35, 35);
  const tradeBalance = clamp(economy.tradeBalancePctGdp + (exportGrowth - importGrowth) * 0.1 * years + termsOfTrade * 0.1 * years, -40, 40);
  const relativeShare = (share: number, componentGrowth: number) => clamp(
    share * Math.pow(Math.max(0.2, 1 + componentGrowth / 100) / Math.max(0.2, 1 + averageGrowth / 100), years),
    1, 80,
  );
  const householdConsumptionShare = relativeShare(economy.householdConsumptionSharePctGdp, consumptionGrowth);
  const governmentConsumptionShare = relativeShare(economy.governmentConsumptionSharePctGdp, governmentGrowth);
  const investmentShare = relativeShare(economy.investmentSharePctGdp, investmentGrowth);
  const exportShare = relativeShare(economy.exportSharePctGdp, exportGrowth);
  const importShare = relativeShare(economy.importSharePctGdp, importGrowth);
  const independentRateTarget = clamp(2 + inflation * 0.65 + outputGap * 0.22 + financialStress * 0.025, 0, 35);
  const policyRateTarget = profile?.monetaryRegime === 'currency_union' ? euroPolicyRate
    : profile?.monetaryRegime === 'pegged' ? state.worldEconomy.neutralInterestRatePct + 2.2
      : independentRateTarget;
  const policyRate = economy.policyRatePct + (policyRateTarget - economy.policyRatePct) * transition(1.8, elapsedMonths);
  const creditTarget = clamp(growth + inflation - realRate * 0.35 - financialStress * 0.08, -15, 30);
  const creditGrowth = economy.creditGrowthAnnualPct + (creditTarget - economy.creditGrowthAnnualPct) * transition(2.3, elapsedMonths);
  const privateDebt = clamp(economy.privateDebtPctGdp + (creditGrowth - nominalGrowth) * economy.privateDebtPctGdp / 100 * years, 5, 350);
  const floating = profile?.monetaryRegime === 'sovereign_floating';
  const exchangeMove = floating ? (currentAccount * 0.025 + (policyRate - state.worldEconomy.neutralInterestRatePct) * 0.08 - financialStress * 0.018) : 0;
  const exchangeRate = clamp(economy.exchangeRateIndex * Math.pow(Math.max(0.6, 1 + exchangeMove / 100), years), 35, 220);
  const reserves = clamp(economy.foreignReserveMonthsImports + currentAccount * 0.025 * years + economy.policy.capitalControls * 0.001 * years, 0.1, 48);
  const products = nextProducts(state, economy, growth, investmentGrowth, elapsedMonths);
  const sectors = nextSectors(economy, growth, potentialGrowth, investmentGrowth, elapsedMonths);
  const debtAndBanking = projectDebtAndBanking(state, economy, {
    publicDebtPctGdp: publicDebt, fiscalBalancePctGdp: fiscalBalance, policyRatePct: policyRate,
    inflationAnnualPct: inflation, realGrowthAnnualPct: growth, currentAccountPctGdp: currentAccount,
    foreignReserveMonthsImports: reserves, financialStress, unemploymentPct: unemployment,
  }, elapsedMonths);
  return {
    realGdpBillion2000Usd: round(gdp), potentialGdpBillion2000Usd: round(potentialGdp),
    realGrowthAnnualPct: round(growth), potentialGrowthAnnualPct: round(potentialGrowth), outputGapPct: round(outputGap),
    populationMillions: round(population), populationGrowthAnnualPct: round(populationGrowth), workingAgeSharePct: round(workingAge),
    laborForceParticipationPct: round(laborForceParticipation), dependencyRatioPct: round(dependencyRatio),
    inflationAnnualPct: round(inflation), unemploymentPct: round(unemployment), wageGrowthAnnualPct: round(wageGrowth),
    investmentSharePctGdp: round(investmentShare), householdConsumptionSharePctGdp: round(householdConsumptionShare),
    governmentConsumptionSharePctGdp: round(governmentConsumptionShare), exportSharePctGdp: round(exportShare), importSharePctGdp: round(importShare),
    domesticDemandGrowthAnnualPct: round(demandGrowth), tradeBalancePctGdp: round(tradeBalance), currentAccountPctGdp: round(currentAccount),
    publicRevenuePctGdp: round(revenue), publicSpendingPctGdp: round(spending), fiscalBalancePctGdp: round(fiscalBalance), publicDebtPctGdp: round(publicDebt),
    policyRatePct: round(policyRate), creditGrowthAnnualPct: round(creditGrowth), privateDebtPctGdp: round(privateDebt), financialStress: round(financialStress),
    exchangeRateIndex: round(exchangeRate), foreignReserveMonthsImports: round(reserves), productivityIndex: round(productivity),
    capitalStockIndex: round(capitalStock), humanCapitalIndex: round(humanCapital), confidenceIndex: round(confidence),
    sovereignDebt: debtAndBanking.sovereignDebt, bankingSystem: debtAndBanking.bankingSystem,
    products, sectors, lastUpdatedAt: state.currentDate,
  } satisfies Partial<MacroeconomicState>;
}

export function advanceMacroeconomy(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  const weightedPotential = weightedWorldValue(state, (economy) => economy.potentialGrowthAnnualPct);
  const observedGrowth = weightedWorldValue(state, (economy) => economy.realGrowthAnnualPct);
  const dotcom = state.historicalCurrents['dotcom-exuberance'];
  const dotcomPressure = dotcom?.pressure ?? 0;
  const dotcomInWindow = Boolean(dotcom && state.currentDate <= dotcom.probableWindow.end && dotcom.status === 'active');
  const dotcomFinancialRisk = dotcomInWindow ? Math.max(0, dotcomPressure - 82) * 1.15 : 0;
  const demandShock = shockPressure(state, 'demand') / 14;
  const tradeShock = shockPressure(state, 'trade') / 18;
  const energyShock = shockPressure(state, 'energy') / 25;
  const financialShock = shockPressure(state, 'financial');
  const globalTarget = clamp(weightedPotential + (observedGrowth - weightedPotential) * 0.28 - demandShock - tradeShock - energyShock - dotcomFinancialRisk * 0.035, -7, 8);
  const globalGrowth = state.worldEconomy.globalGrowthAnnualPct + (globalTarget - state.worldEconomy.globalGrowthAnnualPct) * transition(2.5, elapsedMonths);
  const financialTarget = clamp(12 + financialShock * 0.85 + dotcomFinancialRisk, 3, 100);
  const globalFinancialStress = state.worldEconomy.financialStress + (financialTarget - state.worldEconomy.financialStress) * transition(3.0, elapsedMonths);
  const productMarkets = Object.fromEntries(productFamilies.map((family) => [family, evolveWorldMarket(state, family, elapsedMonths)])) as WorldState['worldEconomy']['productMarkets'];
  const priceImpulse = productFamilies.reduce((sum, family) => sum + (productMarkets[family].priceIndex - state.worldEconomy.productMarkets[family].priceIndex), 0) / productFamilies.length;
  const globalInflationTarget = clamp(2.2 + Math.max(0, globalGrowth - weightedPotential) * 0.3 + priceImpulse * 0.22, -2, 20);
  const globalInflation = state.worldEconomy.globalInflationAnnualPct + (globalInflationTarget - state.worldEconomy.globalInflationAnnualPct) * transition(1.0, elapsedMonths);
  const demandIndex = state.worldEconomy.demandIndex * Math.pow(Math.max(0.2, 1 + globalGrowth / 100), elapsedMonths / 12);
  const tradeGrowth = clamp(globalGrowth * 1.35 - tradeShock - globalFinancialStress * 0.015, -15, 15);
  const tradeVolumeIndex = state.worldEconomy.tradeVolumeIndex * Math.pow(Math.max(0.2, 1 + tradeGrowth / 100), elapsedMonths / 12);
  const euroMembers = ['FRA', 'DEU', 'ITA'].map((id) => state.macroEconomies[id]).filter(Boolean);
  const euroInflation = euroMembers.reduce((sum, economy) => sum + economy.inflationAnnualPct, 0) / Math.max(1, euroMembers.length);
  const euroGap = euroMembers.reduce((sum, economy) => sum + economy.outputGapPct, 0) / Math.max(1, euroMembers.length);
  const euroPolicyRate = clamp(2 + euroInflation * 0.62 + euroGap * 0.18, 0, 20);
  const effects: WorldEffect[] = [{
    kind: 'world_economy_patch',
    patch: {
      globalGrowthAnnualPct: round(globalGrowth), globalInflationAnnualPct: round(globalInflation), demandIndex: round(demandIndex),
      tradeVolumeIndex: round(tradeVolumeIndex), financialStress: round(globalFinancialStress), productMarkets,
      activeShocks: decayedShocks(state, elapsedMonths), cycle: cycleFor(globalGrowth), lastUpdatedAt: state.currentDate,
    },
    reason: 'La conjoncture mondiale agrège demande, commerce, marchés physiques, finance et chocs actifs.', visibility: 'debug',
  }];
  for (const economy of Object.values(state.macroEconomies)) {
    let patch = nextCountryEconomy(state, economy, elapsedMonths, globalGrowth, globalFinancialStress, euroPolicyRate);
    // Un État non joueur ne reste pas figé dans un défaut pendant toute la
    // partie : après une période d'arriérés, les créanciers et les bailleurs
    // imposent généralement un reprofilage. Cela conserve la gravité du
    // défaut, mais évite qu'un signal de départ ne condamne mécaniquement un
    // pays pour les vingt années suivantes.
    const automaticStandstill = economy.countryId !== state.playerCountryId
      && economy.sovereignDebt.status === 'default'
      && economy.sovereignDebt.monthsUnderStress >= 24;
    if (automaticStandstill) {
      patch = {
        ...patch,
        publicDebtPctGdp: round(patch.publicDebtPctGdp * 0.82),
        confidenceIndex: clamp(patch.confidenceIndex - 5, 0, 110),
        sovereignDebt: {
          ...patch.sovereignDebt,
          status: 'restructuring', marketAccess: Math.min(35, patch.sovereignDebt.marketAccess),
          fundingGapPctGdp: round(patch.sovereignDebt.fundingGapPctGdp * 0.35),
          missedPaymentsPctGdp: 0, monthsUnderStress: 0,
          sovereignSpreadBps: Math.max(900, patch.sovereignDebt.sovereignSpreadBps),
        },
      };
    }
    effects.push({
      kind: 'macro_patch', countryId: economy.countryId, patch,
      reason: automaticStandstill
        ? 'Après des arriérés persistants, les créanciers imposent un reprofilage automatique de la dette ; les pertes restent visibles dans l’économie et le dossier souverain.'
        : 'L’économie nationale équilibre demande, capacité productive, emploi, prix, budget, crédit, commerce, dette et démographie.',
      visibility: 'debug',
    });
    effects.push(...debtCrisisEffects(state, economy.countryId, economy.sovereignDebt.status, patch.sovereignDebt.status, patch.sovereignDebt));
  }
  return commitWorldAction(state, {
    kind: 'economic', actorId: state.playerCountryId, origin: 'time',
    intent: 'Résoudre le cycle économique mensuel unifié', visibility: 'debug', effects,
  });
}

/** Une intensité positive est défavorable (contraction, pénurie ou stress) ; une intensité négative est favorable. */
export function addEconomicShock(state: WorldState, shock: EconomicShock) {
  const activeShocks = [...state.worldEconomy.activeShocks.filter((item) => item.id !== shock.id), shock];
  const dossier = shockDossier(state, shock);
  const existingDossier = dossier && state.strategicDossiers?.[dossier.id];
  const effects: WorldEffect[] = [{ kind: 'world_economy_patch', patch: { activeShocks }, reason: 'Le choc entre dans les canaux de transmission du modèle.' }];
  if (dossier && existingDossier) effects.push({ kind: 'dossier_patch', dossierId: dossier.id, patch: {
    status: dossier.status, importance: dossier.importance, scope: dossier.scope, actorIds: dossier.actorIds,
    updatedAt: dossier.updatedAt, phase: dossier.phase, trend: dossier.trend, publicSummary: dossier.publicSummary,
    followed: dossier.followed, autoTracked: dossier.autoTracked, sleepingAt: undefined, pendingDecisions: dossier.pendingDecisions,
  }, reason: 'Un nouveau choc actualise le dossier économique persistant.' });
  if (dossier && !existingDossier) effects.push({ kind: 'dossier_add', dossier, reason: 'Un choc économique suffisamment intense devient un dossier de suivi.' });
  if (dossier && existingDossier) {
    const entry = dossier.entries[dossier.entries.length - 1];
    if (entry && !existingDossier.entries.some((candidate) => candidate.id === entry.id)) effects.push({ kind: 'dossier_entry_add', dossierId: dossier.id, entry, reason: 'La nouvelle propagation est ajoutée à la chronologie du dossier.' });
  }
  return commitWorldAction(state, {
    kind: 'economic', actorId: state.playerCountryId, origin: shock.source,
    intent: `Enregistrer le choc économique « ${shock.label} »`,
    effects,
  });
}

export function setEconomicPolicy(state: WorldState, countryId: CountryId, patch: Partial<EconomicPolicyState>) {
  const economy = state.macroEconomies[countryId];
  if (!economy) return { ok: false as const, state, error: 'Économie nationale inconnue.' };
  const policy: EconomicPolicyState = {
    ...economy.policy, ...patch,
    fiscalStance: clamp(patch.fiscalStance ?? economy.policy.fiscalStance, -100, 100),
    publicInvestmentPctGdp: clamp(patch.publicInvestmentPctGdp ?? economy.policy.publicInvestmentPctGdp, 0, 20),
    socialProtection: clamp(patch.socialProtection ?? economy.policy.socialProtection, 0, 100),
    industrialSupport: clamp(patch.industrialSupport ?? economy.policy.industrialSupport, 0, 100),
    tradeOpenness: clamp(patch.tradeOpenness ?? economy.policy.tradeOpenness, 0, 100),
    capitalControls: clamp(patch.capitalControls ?? economy.policy.capitalControls, 0, 100),
    laborFlexibility: clamp(patch.laborFlexibility ?? economy.policy.laborFlexibility, 0, 100),
  };
  const next = commitWorldAction(state, {
    kind: 'economic', actorId: countryId, origin: 'player', intent: 'Modifier l’orientation de la politique économique',
    effects: [{ kind: 'macro_patch', countryId, patch: { policy }, reason: 'Les nouveaux réglages infléchiront progressivement les flux économiques.' }],
  });
  return { ok: true as const, state: next };
}

export function economicSnapshot(state: WorldState, countryId: CountryId) {
  const economy = state.macroEconomies[countryId];
  if (!economy) return null;
  return {
    growth: economy.realGrowthAnnualPct, potentialGrowth: economy.potentialGrowthAnnualPct, outputGap: economy.outputGapPct,
    inflation: economy.inflationAnnualPct, unemployment: economy.unemploymentPct,
    fiscalBalance: economy.fiscalBalancePctGdp, publicDebt: economy.publicDebtPctGdp,
    financialStress: economy.financialStress, currentAccount: economy.currentAccountPctGdp,
    bindingConstraints: [
      ...(energyConstraint(state, economy) > 0.08 ? ['energy'] : []),
      ...(productConstraint(economy) > 0.08 ? ['productive_bottleneck'] : []),
      ...(economy.financialStress >= 50 ? ['finance'] : []),
      ...(!['stable', 'watch'].includes(economy.sovereignDebt.status) ? ['sovereign_debt'] : []),
      ...(economy.bankingSystem.liquidityStress >= 55 ? ['banking_system'] : []),
      ...(economy.outputGapPct >= 4 ? ['productive_capacity'] : []),
      ...(economy.publicDebtPctGdp >= 120 ? ['public_debt'] : []),
    ],
  };
}
