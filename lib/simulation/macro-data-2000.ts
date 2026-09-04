import type {
  AggregateSectorId,
  AggregateSectorState,
  BankingSystemState,
  CountryId,
  EconomicPolicyState,
  EconomicProductFamily,
  MacroeconomicState,
  ProductFamilyState,
  SovereignDebtState,
  WorldEconomyState,
  WorldProductMarket,
} from './types';

type Baseline = {
  gdp: number; growth: number; population: number; populationGrowth: number;
  inflation: number; unemployment: number; investment: number;
  exports: number; imports: number; industry: number; confidence: number;
};

const baseline: Record<CountryId, Baseline> = {
  FRA: { gdp: 1360.959, growth: 4.141, population: 60.919, populationGrowth: 0.686, inflation: 1.676, unemployment: 10.218, investment: 21.858, exports: 29.758, imports: 28.028, industry: 21.129, confidence: 96 },
  DEU: { gdp: 1966.981, growth: 2.877, population: 82.212, populationGrowth: 0.135, inflation: 1.440, unemployment: 7.917, investment: 23.964, exports: 29.681, imports: 29.515, industry: 27.254, confidence: 97 },
  ITA: { gdp: 1149.661, growth: 3.882, population: 56.942, populationGrowth: 0.045, inflation: 2.538, unemployment: 10.834, investment: 21.324, exports: 25.561, imports: 24.714, industry: 24.102, confidence: 94 },
  POL: { gdp: 172.954, growth: 4.656, population: 38.259, populationGrowth: -1.044, inflation: 9.900, unemployment: 14.928, investment: 24.700, exports: 27.073, imports: 33.538, industry: 28.772, confidence: 88 },
  USA: { gdp: 10250.952, growth: 4.078, population: 282.162, populationGrowth: 1.113, inflation: 3.377, unemployment: 3.992, investment: 23.678, exports: 10.693, imports: 14.410, industry: 22.452, confidence: 97 },
  GBR: { gdp: 1671.598, growth: 4.524, population: 58.893, populationGrowth: 0.357, inflation: 1.183, unemployment: 5.558, investment: 18.947, exports: 25.556, imports: 26.782, industry: 22.681, confidence: 96 },
  RUS: { gdp: 259.710, growth: 10.000, population: 146.597, populationGrowth: -0.421, inflation: 20.799, unemployment: 10.581, investment: 18.694, exports: 44.060, imports: 24.033, industry: 33.919, confidence: 78 },
  CHN: { gdp: 1223.755, growth: 8.574, population: 1262.645, populationGrowth: 0.788, inflation: 0.348, unemployment: 3.260, investment: 33.633, exports: 20.682, imports: 18.329, industry: 45.074, confidence: 75 },
  NOR: { gdp: 170.620, growth: 3.443, population: 4.491, populationGrowth: 0.649, inflation: 3.086, unemployment: 3.458, investment: 21.126, exports: 45.837, imports: 28.948, industry: 36.980, confidence: 98 },
  DZA: { gdp: 54.790, growth: 3.800, population: 30.904, populationGrowth: 1.400, inflation: 0.339, unemployment: 29.770, investment: 23.564, exports: 42.070, imports: 20.789, industry: 53.331, confidence: 67 },
  LBY: { gdp: 38.271, growth: 3.679, population: 5.305, populationGrowth: 1.653, inflation: -2.900, unemployment: 19.275, investment: 11.841, exports: 31.558, imports: 13.723, industry: 58.000, confidence: 48 },
  SAU: { gdp: 189.515, growth: 4.718, population: 16.178, populationGrowth: 4.460, inflation: -1.125, unemployment: 4.570, investment: 19.317, exports: 43.405, imports: 24.761, industry: 53.450, confidence: 62 },
};

type Calibration = {
  workingAge: number; participation: number; migration: number; debt: number;
  revenue: number; spending: number; rate: number; privateDebt: number; reserves: number;
  agriculture: number; extractive: number; publicServices: number;
};

/** Valeurs de départ arrondies : elles servent au modèle, pas à afficher une fausse précision statistique. */
const calibration: Record<CountryId, Calibration> = {
  FRA: { workingAge: 65.2, participation: 68, migration: 1.1, debt: 58, revenue: 49.5, spending: 51, rate: 3.0, privateDebt: 94, reserves: 2.8, agriculture: 2.5, extractive: 0.8, publicServices: 22 },
  DEU: { workingAge: 67.0, participation: 71, migration: 2.0, debt: 60, revenue: 45, spending: 46.5, rate: 3.0, privateDebt: 110, reserves: 3.0, agriculture: 1.3, extractive: 0.7, publicServices: 19 },
  ITA: { workingAge: 67.1, participation: 61, migration: 1.8, debt: 109, revenue: 44, spending: 45.5, rate: 3.0, privateDebt: 82, reserves: 3.0, agriculture: 3.1, extractive: 0.5, publicServices: 20 },
  POL: { workingAge: 67.5, participation: 65, migration: -0.6, debt: 37, revenue: 38, spending: 41, rate: 19, privateDebt: 42, reserves: 5.0, agriculture: 5.0, extractive: 3.1, publicServices: 16 },
  USA: { workingAge: 66.2, participation: 77, migration: 4.5, debt: 55, revenue: 32, spending: 31, rate: 6.5, privateDebt: 132, reserves: 1.5, agriculture: 1.2, extractive: 1.8, publicServices: 15 },
  GBR: { workingAge: 65.4, participation: 76, migration: 2.6, debt: 37, revenue: 37, spending: 38, rate: 6.0, privateDebt: 132, reserves: 2.0, agriculture: 1.0, extractive: 2.3, publicServices: 18 },
  RUS: { workingAge: 67.0, participation: 72, migration: 1.8, debt: 56, revenue: 31, spending: 34, rate: 28, privateDebt: 25, reserves: 3.0, agriculture: 6.4, extractive: 13, publicServices: 15 },
  CHN: { workingAge: 66.7, participation: 79, migration: -0.3, debt: 23, revenue: 14, spending: 17, rate: 5.9, privateDebt: 91, reserves: 7.0, agriculture: 14.7, extractive: 5.5, publicServices: 10 },
  NOR: { workingAge: 64.8, participation: 80, migration: 4.0, debt: 29, revenue: 55, spending: 45, rate: 5.5, privateDebt: 128, reserves: 18, agriculture: 2.0, extractive: 22, publicServices: 21 },
  DZA: { workingAge: 60.2, participation: 43, migration: -0.9, debt: 46, revenue: 36, spending: 40, rate: 8.5, privateDebt: 29, reserves: 12, agriculture: 10.2, extractive: 39, publicServices: 14 },
  LBY: { workingAge: 59.8, participation: 52, migration: 2.0, debt: 35, revenue: 48, spending: 52, rate: 5.0, privateDebt: 24, reserves: 20, agriculture: 4.1, extractive: 47, publicServices: 15 },
  SAU: { workingAge: 62.0, participation: 55, migration: 12, debt: 87, revenue: 35, spending: 42, rate: 6.5, privateDebt: 55, reserves: 14, agriculture: 5.0, extractive: 41, publicServices: 14 },
};

const productEndowments: Record<CountryId, [number, number, number, number, number, number]> = {
  FRA: [86, 22, 42, 79, 88, 82], DEU: [76, 18, 48, 94, 100, 91], ITA: [73, 15, 42, 82, 86, 70],
  POL: [72, 35, 58, 68, 65, 42], USA: [100, 55, 100, 100, 100, 100], GBR: [63, 76, 48, 71, 78, 89],
  RUS: [84, 100, 100, 58, 48, 54], CHN: [88, 53, 83, 100, 92, 51], NOR: [46, 100, 88, 42, 54, 72],
  DZA: [57, 100, 91, 28, 20, 22], LBY: [31, 94, 79, 18, 13, 17], SAU: [43, 100, 94, 33, 24, 28],
};

const debtCalibration: Record<CountryId, {
  effectiveRate: number; spread: number; maturity: number; foreignHeld: number;
  foreignCurrency: number; bankExposure: number; backstop: number; marketAccess: number;
  bankCapital: number; badLoans: number;
}> = {
  FRA: { effectiveRate: 5.4, spread: 28, maturity: 6.2, foreignHeld: 24, foreignCurrency: 0, bankExposure: 12, backstop: 58, marketAccess: 91, bankCapital: 11.5, badLoans: 4.2 },
  DEU: { effectiveRate: 5.2, spread: 18, maturity: 6.8, foreignHeld: 25, foreignCurrency: 0, bankExposure: 14, backstop: 58, marketAccess: 94, bankCapital: 11.2, badLoans: 3.8 },
  ITA: { effectiveRate: 6.2, spread: 105, maturity: 5.7, foreignHeld: 19, foreignCurrency: 0, bankExposure: 19, backstop: 55, marketAccess: 78, bankCapital: 10.4, badLoans: 8.5 },
  POL: { effectiveRate: 12.5, spread: 310, maturity: 3.8, foreignHeld: 34, foreignCurrency: 18, bankExposure: 15, backstop: 54, marketAccess: 66, bankCapital: 12.0, badLoans: 12.5 },
  USA: { effectiveRate: 6.1, spread: 10, maturity: 5.9, foreignHeld: 29, foreignCurrency: 0, bankExposure: 8, backstop: 98, marketAccess: 100, bankCapital: 12.2, badLoans: 2.2 },
  GBR: { effectiveRate: 5.5, spread: 22, maturity: 7.1, foreignHeld: 23, foreignCurrency: 0, bankExposure: 10, backstop: 91, marketAccess: 95, bankCapital: 12.4, badLoans: 2.6 },
  RUS: { effectiveRate: 10.0, spread: 350, maturity: 4.5, foreignHeld: 18, foreignCurrency: 30, bankExposure: 24, backstop: 55, marketAccess: 55, bankCapital: 9.2, badLoans: 18.0 },
  CHN: { effectiveRate: 5.1, spread: 95, maturity: 5.0, foreignHeld: 8, foreignCurrency: 6, bankExposure: 28, backstop: 90, marketAccess: 82, bankCapital: 9.0, badLoans: 20.0 },
  NOR: { effectiveRate: 5.3, spread: 20, maturity: 7.8, foreignHeld: 28, foreignCurrency: 0, bankExposure: 7, backstop: 92, marketAccess: 98, bankCapital: 12.8, badLoans: 2.1 },
  DZA: { effectiveRate: 7.2, spread: 390, maturity: 4.0, foreignHeld: 20, foreignCurrency: 32, bankExposure: 18, backstop: 42, marketAccess: 52, bankCapital: 10.0, badLoans: 14.0 },
  LBY: { effectiveRate: 6.0, spread: 580, maturity: 3.5, foreignHeld: 8, foreignCurrency: 35, bankExposure: 21, backstop: 28, marketAccess: 45, bankCapital: 8.5, badLoans: 22.0 },
  SAU: { effectiveRate: 6.0, spread: 180, maturity: 5.0, foreignHeld: 12, foreignCurrency: 22, bankExposure: 16, backstop: 65, marketAccess: 68, bankCapital: 11.0, badLoans: 9.0 },
};

const families: EconomicProductFamily[] = ['food', 'energy', 'raw_materials', 'industrial_inputs', 'manufactured_goods', 'strategic_technology'];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function potentialGrowth(item: Baseline) {
  const gdpPerCapita = item.gdp * 1000 / item.population;
  const catchup = clamp((25_000 - gdpPerCapita) / 9_000, 0, 2.8);
  return round(clamp(0.5 + item.investment * 0.065 + item.populationGrowth * 0.25 + catchup + Math.max(0, item.industry - 25) * 0.015, -1, 8));
}

function createPolicy(countryId: CountryId, item: Baseline): EconomicPolicyState {
  const publicInvestment = countryId === 'CHN' ? 6.5 : countryId === 'POL' ? 5.2 : countryId === 'DZA' || countryId === 'SAU' ? 4.8 : 3.2;
  return {
    fiscalStance: 0,
    publicInvestmentPctGdp: publicInvestment,
    socialProtection: ['FRA', 'DEU', 'ITA', 'NOR'].includes(countryId) ? 78 : countryId === 'USA' ? 42 : 48,
    industrialSupport: clamp(item.industry * 1.4, 20, 90),
    tradeOpenness: clamp((item.exports + item.imports) * 1.2, 25, 95),
    capitalControls: ['CHN', 'DZA', 'LBY'].includes(countryId) ? 72 : ['RUS', 'SAU'].includes(countryId) ? 48 : 12,
    laborFlexibility: ['USA', 'GBR'].includes(countryId) ? 76 : ['FRA', 'ITA'].includes(countryId) ? 42 : 58,
  };
}

function createSectors(countryId: CountryId, item: Baseline): Record<AggregateSectorId, AggregateSectorState> {
  const c = calibration[countryId];
  const construction = 6;
  const manufacturing = Math.max(4, item.industry - c.extractive - construction);
  const marketServices = Math.max(8, 100 - c.agriculture - c.extractive - manufacturing - construction - c.publicServices);
  const shares: Record<AggregateSectorId, number> = {
    agriculture: c.agriculture, extractive: c.extractive, manufacturing, construction,
    market_services: marketServices, public_services: c.publicServices,
  };
  const employmentBias: Record<AggregateSectorId, number> = {
    agriculture: countryId === 'CHN' || countryId === 'DZA' ? 2.1 : 1.25,
    extractive: 0.45, manufacturing: 1.05, construction: 1.2, market_services: 1.05, public_services: 1.1,
  };
  const rawEmployment = Object.fromEntries(Object.entries(shares).map(([id, share]) => [id, share * employmentBias[id as AggregateSectorId]])) as Record<AggregateSectorId, number>;
  const totalEmployment = Object.values(rawEmployment).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(shares).map(([id, share]) => [id, {
    valueAddedSharePct: round(share),
    capacityIndex: round(92 + Math.min(16, item.investment / 2) + (id === 'manufacturing' ? item.industry / 8 : 0)),
    utilizationPct: round(clamp(76 + (item.growth - potentialGrowth(item)) * 1.8, 55, 94)),
    productivityIndex: round(clamp(100 + (item.confidence - 80) * 0.25 - (id === 'agriculture' && ['CHN', 'DZA'].includes(countryId) ? 20 : 0), 55, 120)),
    employmentSharePct: round(rawEmployment[id as AggregateSectorId] / totalEmployment * 100),
  }])) as Record<AggregateSectorId, AggregateSectorState>;
}

function createProducts(countryId: CountryId, item: Baseline): Record<EconomicProductFamily, ProductFamilyState> {
  const endowments = productEndowments[countryId];
  return Object.fromEntries(families.map((family, index) => {
    const capacity = endowments[index];
    const importer = capacity < 65;
    const exportOrientation = clamp((capacity - 45) * 0.7 + item.exports * 0.35, 3, 70);
    const importDependency = clamp((78 - capacity) * 1.15 + (importer ? 12 : 0), 3, 92);
    const production = clamp(100 - importDependency + exportOrientation, 15, 165);
    return [family, {
      productionIndex: round(production), capacityIndex: round(production * 1.2), demandIndex: 100,
      inventoryMonths: family === 'food' ? 2.2 : family === 'energy' ? 1.8 : family === 'strategic_technology' ? 1.1 : 1.6,
      importDependencyPct: round(importDependency),
      exportOrientationPct: round(exportOrientation), domesticPriceIndex: 100,
    } satisfies ProductFamilyState];
  })) as Record<EconomicProductFamily, ProductFamilyState>;
}

function createDebtState(countryId: CountryId, debtPctGdp: number, revenuePctGdp: number): SovereignDebtState {
  const item = debtCalibration[countryId];
  const annualMaturingDebt = debtPctGdp / item.maturity;
  const debtServicePctRevenue = debtPctGdp * item.effectiveRate / 100 / Math.max(1, revenuePctGdp) * 100;
  return {
    effectiveInterestRatePct: item.effectiveRate, sovereignSpreadBps: item.spread,
    averageMaturityYears: item.maturity, annualMaturingDebtPctGdp: round(annualMaturingDebt),
    foreignHeldSharePct: item.foreignHeld, foreignCurrencySharePct: item.foreignCurrency,
    domesticBankExposurePctAssets: item.bankExposure, centralBankBackstop: item.backstop,
    marketAccess: item.marketAccess, refinancingNeedPctGdp: round(annualMaturingDebt + Math.max(0, calibration[countryId].spending - calibration[countryId].revenue)),
    fundingGapPctGdp: 0, debtServicePctRevenue: round(debtServicePctRevenue),
    missedPaymentsPctGdp: 0, monthsUnderStress: 0,
    status: item.marketAccess < 50 ? 'watch' : 'stable',
  };
}

function createBankingSystem(countryId: CountryId): BankingSystemState {
  const item = debtCalibration[countryId];
  return {
    capitalAdequacyPct: item.bankCapital, nonPerformingLoansPct: item.badLoans,
    liquidityStress: clamp((12 - item.bankCapital) * 2 + item.badLoans * 0.35, 3, 55),
    sovereignExposureStress: 0, creditAvailability: clamp(94 - item.badLoans * 1.4, 35, 95),
  };
}

export function createMacroEconomies2000(): Record<CountryId, MacroeconomicState> {
  return Object.fromEntries(Object.entries(baseline).map(([countryId, item]) => {
    const c = calibration[countryId];
    const potential = potentialGrowth(item);
    const outputGap = clamp((item.growth - potential) * 0.35, -2.5, 2.5);
    const governmentConsumption = Math.max(8, c.spending - (['FRA', 'DEU', 'ITA'].includes(countryId) ? 27 : 20));
    const householdConsumption = Math.max(28, 100 - item.investment - governmentConsumption - item.exports + item.imports);
    const dependencyRatio = (100 - c.workingAge) / c.workingAge * 100;
    return [countryId, {
      countryId, realGdpBillion2000Usd: item.gdp,
      potentialGdpBillion2000Usd: round(item.gdp / (1 + outputGap / 100)),
      realGrowthAnnualPct: item.growth, potentialGrowthAnnualPct: potential, outputGapPct: round(outputGap),
      populationMillions: item.population, populationGrowthAnnualPct: item.populationGrowth,
      workingAgeSharePct: c.workingAge, laborForceParticipationPct: c.participation,
      dependencyRatioPct: round(dependencyRatio), netMigrationRatePerThousand: c.migration,
      inflationAnnualPct: item.inflation, unemploymentPct: item.unemployment,
      wageGrowthAnnualPct: round(item.inflation + Math.max(0, item.growth - potential) * 0.4 + 1.2),
      investmentSharePctGdp: item.investment, householdConsumptionSharePctGdp: round(householdConsumption),
      governmentConsumptionSharePctGdp: round(governmentConsumption),
      domesticDemandGrowthAnnualPct: round(item.growth - (item.exports - item.imports) * 0.04),
      exportSharePctGdp: item.exports, importSharePctGdp: item.imports,
      tradeBalancePctGdp: round(item.exports - item.imports), currentAccountPctGdp: round((item.exports - item.imports) * 0.72),
      publicRevenuePctGdp: c.revenue, publicSpendingPctGdp: c.spending,
      fiscalBalancePctGdp: round(c.revenue - c.spending), publicDebtPctGdp: c.debt,
      policyRatePct: c.rate, creditGrowthAnnualPct: round(clamp(item.growth * 1.35 + item.inflation * 0.25, -5, 25)),
      privateDebtPctGdp: c.privateDebt,
      financialStress: round(clamp((100 - item.confidence) * 0.65 + Math.max(0, item.inflation - 8) * 0.7, 3, 85)),
      exchangeRateIndex: 100, foreignReserveMonthsImports: c.reserves,
      industrySharePctGdp: item.industry, productivityIndex: 100, capitalStockIndex: 100,
      humanCapitalIndex: round(clamp(68 + item.confidence * 0.2 - Math.max(0, item.unemployment - 8) * 0.25, 45, 95)),
      confidenceIndex: item.confidence,
      sovereignDebt: createDebtState(countryId, c.debt, c.revenue), bankingSystem: createBankingSystem(countryId),
      policy: createPolicy(countryId, item),
      sectors: createSectors(countryId, item), products: createProducts(countryId, item),
      source: {
        provider: 'World Bank — WDI pour le socle ; calibration ORDO pour les stocks non directement observés', observationYear: 2000,
        indicatorCodes: ['NY.GDP.MKTP.CD', 'NY.GDP.MKTP.KD.ZG', 'SP.POP.TOTL', 'SP.POP.GROW', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'NE.GDI.TOTL.ZS', 'NE.EXP.GNFS.ZS', 'NE.IMP.GNFS.ZS', 'NV.IND.TOTL.ZS'],
        estimatedIndicatorCodes: ['ORDO_OUTPUT_GAP', 'ORDO_SECTOR_CAPACITY', 'ORDO_PRODUCT_BALANCE', 'ORDO_FINANCIAL_STRESS'],
        confidence: item.confidence,
      },
      lastUpdatedAt: '2000-01-01',
    } satisfies MacroeconomicState];
  }));
}

function market(family: EconomicProductFamily, inventoryMonths: number, volatility: number): WorldProductMarket {
  return { family, priceIndex: 100, demandIndex: 100, supplyIndex: 100, inventoryMonths, volatility };
}

export const worldEconomy2000: WorldEconomyState = {
  globalGrowthAnnualPct: 4.567, globalInflationAnnualPct: 3.434, demandIndex: 100,
  tradeVolumeIndex: 100, financialStress: 14, neutralInterestRatePct: 2.5,
  productMarkets: {
    food: market('food', 2.4, 16), energy: market('energy', 2.1, 32), raw_materials: market('raw_materials', 2.3, 25),
    industrial_inputs: market('industrial_inputs', 1.7, 22), manufactured_goods: market('manufactured_goods', 1.5, 14),
    strategic_technology: market('strategic_technology', 1.0, 28),
  },
  activeShocks: [], cycle: 'expansion', lastUpdatedAt: '2000-01-01',
};
