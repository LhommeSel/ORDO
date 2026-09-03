import type { CountryId, MacroeconomicState, WorldEconomyState } from './types';

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

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function potentialGrowth(item: Baseline) {
  const gdpPerCapita = item.gdp * 1000 / item.population;
  const catchup = clamp((25_000 - gdpPerCapita) / 9_000, 0, 2.8);
  return Number(clamp(0.5 + item.investment * 0.065 + item.populationGrowth * 0.25 + catchup + Math.max(0, item.industry - 25) * 0.015, -1, 8).toFixed(3));
}

export function createMacroEconomies2000(): Record<CountryId, MacroeconomicState> {
  return Object.fromEntries(Object.entries(baseline).map(([countryId, item]) => [countryId, {
    countryId,
    realGdpBillion2000Usd: item.gdp,
    realGrowthAnnualPct: item.growth,
    potentialGrowthAnnualPct: potentialGrowth(item),
    populationMillions: item.population,
    populationGrowthAnnualPct: item.populationGrowth,
    inflationAnnualPct: item.inflation,
    unemploymentPct: item.unemployment,
    investmentSharePctGdp: item.investment,
    exportSharePctGdp: item.exports,
    importSharePctGdp: item.imports,
    tradeBalancePctGdp: Number((item.exports - item.imports).toFixed(3)),
    industrySharePctGdp: item.industry,
    productivityIndex: 100,
    source: {
      provider: 'World Bank — World Development Indicators', observationYear: 2000,
      indicatorCodes: ['NY.GDP.MKTP.CD', 'NY.GDP.MKTP.KD.ZG', 'SP.POP.TOTL', 'SP.POP.GROW', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'NE.GDI.TOTL.ZS', 'NE.EXP.GNFS.ZS', 'NE.IMP.GNFS.ZS', 'NV.IND.TOTL.ZS'],
      ...(countryId === 'LBY' ? { estimatedIndicatorCodes: ['NV.IND.TOTL.ZS'] } : {}),
      confidence: item.confidence,
    },
    lastUpdatedAt: '2000-01-01',
  }]));
}

export const worldEconomy2000: WorldEconomyState = {
  globalGrowthAnnualPct: 4.567,
  globalInflationAnnualPct: 3.434,
  demandIndex: 100,
  cycle: 'expansion',
  lastUpdatedAt: '2000-01-01',
};
