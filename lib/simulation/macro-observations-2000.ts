import type { CountryId } from './types';

/**
 * Observations macroéconomiques brutes, séparées de la calibration ORDO.
 *
 * Une valeur présente ici est une série internationale comparable. Les taux
 * budgétaires, financiers et les indices de produit restent, eux, des
 * paramètres explicites de simulation dans `macro-data-2000.ts`.
 */
export type MacroObservation2000 = {
  realGdpBillion2000Usd: number;
  realGrowthAnnualPct: number;
  populationMillions: number;
  populationGrowthAnnualPct: number;
  inflationAnnualPct: number;
  unemploymentPct: number;
  fixedInvestmentSharePctGdp: number;
  exportSharePctGdp: number;
  importSharePctGdp: number;
  industrySharePctGdp: number;
};

export const worldBankWdi2000Source = {
  id: 'world-bank-wdi-2000',
  provider: 'Banque mondiale — World Development Indicators (WDI)',
  observationYear: 2000,
  retrievedAt: '2026-09-13',
  indicatorCodes: [
    'NY.GDP.MKTP.CD', 'NY.GDP.MKTP.KD.ZG', 'SP.POP.TOTL', 'SP.POP.GROW',
    'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'NE.GDI.FTOT.ZS', 'NE.EXP.GNFS.ZS',
    'NE.IMP.GNFS.ZS', 'NV.IND.TOTL.ZS',
  ],
} as const;

/**
 * Premier lot normalisé : Amériques. Valeurs WDI révisées récupérées via
 * l'API, avec PIB en milliards de dollars courants et population en millions.
 */
export const americasWdi2000: Record<'USA' | 'CAN' | 'MEX' | 'BRA', MacroObservation2000> = {
  USA: { realGdpBillion2000Usd: 10250.952, realGrowthAnnualPct: 4.078, populationMillions: 282.162411, populationGrowthAnnualPct: 1.113, inflationAnnualPct: 3.377, unemploymentPct: 3.992, fixedInvestmentSharePctGdp: 23.146, exportSharePctGdp: 10.693, importSharePctGdp: 14.410, industrySharePctGdp: 22.452 },
  CAN: { realGdpBillion2000Usd: 744.773, realGrowthAnnualPct: 5.139, populationMillions: 30.685730, populationGrowthAnnualPct: 0.931, inflationAnnualPct: 2.719, unemploymentPct: 6.829, fixedInvestmentSharePctGdp: 19.599, exportSharePctGdp: 44.209, importSharePctGdp: 38.556, industrySharePctGdp: 29.757 },
  MEX: { realGdpBillion2000Usd: 742.061, realGrowthAnnualPct: 5.029, populationMillions: 98.625552, populationGrowthAnnualPct: 1.543, inflationAnnualPct: 9.492, unemploymentPct: 2.646, fixedInvestmentSharePctGdp: 21.230, exportSharePctGdp: 24.231, importSharePctGdp: 25.679, industrySharePctGdp: 34.387 },
  BRA: { realGdpBillion2000Usd: 655.448, realGrowthAnnualPct: 4.388, populationMillions: 174.018282, populationGrowthAnnualPct: 1.375, inflationAnnualPct: 7.044, unemploymentPct: 10.889, fixedInvestmentSharePctGdp: 18.304, exportSharePctGdp: 10.188, importSharePctGdp: 12.452, industrySharePctGdp: 23.007 },
};

export const wdiObservedCountryIds = Object.keys(americasWdi2000) as CountryId[];
