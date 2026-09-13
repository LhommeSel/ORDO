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
 * Lots normalisés : Amériques puis noyau européen. Les valeurs WDI révisées
 * sont converties en PIB en milliards de dollars courants et population en
 * millions pour être consommées directement par le moteur.
 */
export const americasWdi2000: Record<'USA' | 'CAN' | 'MEX' | 'BRA', MacroObservation2000> = {
  USA: { realGdpBillion2000Usd: 10250.952, realGrowthAnnualPct: 4.078, populationMillions: 282.162411, populationGrowthAnnualPct: 1.113, inflationAnnualPct: 3.377, unemploymentPct: 3.992, fixedInvestmentSharePctGdp: 23.146, exportSharePctGdp: 10.693, importSharePctGdp: 14.410, industrySharePctGdp: 22.452 },
  CAN: { realGdpBillion2000Usd: 744.773, realGrowthAnnualPct: 5.139, populationMillions: 30.685730, populationGrowthAnnualPct: 0.931, inflationAnnualPct: 2.719, unemploymentPct: 6.829, fixedInvestmentSharePctGdp: 19.599, exportSharePctGdp: 44.209, importSharePctGdp: 38.556, industrySharePctGdp: 29.757 },
  MEX: { realGdpBillion2000Usd: 742.061, realGrowthAnnualPct: 5.029, populationMillions: 98.625552, populationGrowthAnnualPct: 1.543, inflationAnnualPct: 9.492, unemploymentPct: 2.646, fixedInvestmentSharePctGdp: 21.230, exportSharePctGdp: 24.231, importSharePctGdp: 25.679, industrySharePctGdp: 34.387 },
  BRA: { realGdpBillion2000Usd: 655.448, realGrowthAnnualPct: 4.388, populationMillions: 174.018282, populationGrowthAnnualPct: 1.375, inflationAnnualPct: 7.044, unemploymentPct: 10.889, fixedInvestmentSharePctGdp: 18.304, exportSharePctGdp: 10.188, importSharePctGdp: 12.452, industrySharePctGdp: 23.007 },
};

/**
 * Deuxième lot normalisé : noyau européen ORDO. Les valeurs proviennent des
 * mêmes indicateurs WDI et de la même année que le lot américain ; les unités
 * sont déjà converties en milliards de dollars et millions d'habitants pour
 * rester directement compatibles avec le moteur macro.
 */
export const europeWdi2000: Record<'FRA' | 'DEU' | 'ITA' | 'ESP' | 'POL' | 'GBR' | 'NOR' | 'AUT' | 'GRC', MacroObservation2000> = {
  FRA: { realGdpBillion2000Usd: 1360.959, realGrowthAnnualPct: 4.141, populationMillions: 60.918661, populationGrowthAnnualPct: 0.686, inflationAnnualPct: 1.676, unemploymentPct: 10.218, fixedInvestmentSharePctGdp: 20.881, exportSharePctGdp: 29.758, importSharePctGdp: 28.028, industrySharePctGdp: 21.129 },
  DEU: { realGdpBillion2000Usd: 1966.981, realGrowthAnnualPct: 2.877, populationMillions: 82.211508, populationGrowthAnnualPct: 0.135, inflationAnnualPct: 1.440, unemploymentPct: 7.917, fixedInvestmentSharePctGdp: 22.883, exportSharePctGdp: 29.681, importSharePctGdp: 29.515, industrySharePctGdp: 27.254 },
  ITA: { realGdpBillion2000Usd: 1149.661, realGrowthAnnualPct: 3.882, populationMillions: 56.942108, populationGrowthAnnualPct: 0.045, inflationAnnualPct: 2.538, unemploymentPct: 10.834, fixedInvestmentSharePctGdp: 21.226, exportSharePctGdp: 25.561, importSharePctGdp: 24.714, industrySharePctGdp: 24.102 },
  ESP: { realGdpBillion2000Usd: 598.103, realGrowthAnnualPct: 5.201, populationMillions: 40.567864, populationGrowthAnnualPct: 0.447, inflationAnnualPct: 3.434, unemploymentPct: 13.785, fixedInvestmentSharePctGdp: 25.973, exportSharePctGdp: 28.589, importSharePctGdp: 31.533, industrySharePctGdp: 28.021 },
  POL: { realGdpBillion2000Usd: 172.954, realGrowthAnnualPct: 4.656, populationMillions: 38.258629, populationGrowthAnnualPct: -1.044, inflationAnnualPct: 9.900, unemploymentPct: 14.928, fixedInvestmentSharePctGdp: 23.813, exportSharePctGdp: 27.073, importSharePctGdp: 33.538, industrySharePctGdp: 28.772 },
  GBR: { realGdpBillion2000Usd: 1671.598, realGrowthAnnualPct: 4.524, populationMillions: 58.892514, populationGrowthAnnualPct: 0.357, inflationAnnualPct: 1.183, unemploymentPct: 5.558, fixedInvestmentSharePctGdp: 18.227, exportSharePctGdp: 25.556, importSharePctGdp: 26.782, industrySharePctGdp: 22.681 },
  NOR: { realGdpBillion2000Usd: 170.620, realGrowthAnnualPct: 3.443, populationMillions: 4.490967, populationGrowthAnnualPct: 0.649, inflationAnnualPct: 3.086, unemploymentPct: 3.458, fixedInvestmentSharePctGdp: 19.960, exportSharePctGdp: 45.837, importSharePctGdp: 28.948, industrySharePctGdp: 36.980 },
  AUT: { realGdpBillion2000Usd: 196.182, realGrowthAnnualPct: 3.190, populationMillions: 8.011566, populationGrowthAnnualPct: 0.240, inflationAnnualPct: 2.345, unemploymentPct: 4.687, fixedInvestmentSharePctGdp: 25.706, exportSharePctGdp: 43.591, importSharePctGdp: 42.252, industrySharePctGdp: 28.612 },
  GRC: { realGdpBillion2000Usd: 125.760, realGrowthAnnualPct: 4.138, populationMillions: 10.805808, populationGrowthAnnualPct: 0.409, inflationAnnualPct: 3.151, unemploymentPct: 11.345, fixedInvestmentSharePctGdp: 25.937, exportSharePctGdp: 24.011, importSharePctGdp: 35.101, industrySharePctGdp: 18.713 },
};

/**
 * Troisième lot normalisé : Afrique et Moyen-Orient du noyau ORDO. Le WDI ne
 * publie pas trois séries 2000 pour le Nigeria (investissement, exportations,
 * importations) ; ces trois champs conservent donc une calibration ORDO
 * explicite, tandis que les autres indicateurs restent observés dans le WDI.
 */
export const africaMiddleEastWdi2000: Record<'ZAF' | 'DZA' | 'EGY' | 'MLI' | 'NGA' | 'IRN' | 'SAU' | 'TUR', MacroObservation2000> = {
  ZAF: { realGdpBillion2000Usd: 151.753, realGrowthAnnualPct: 4.200, populationMillions: 47.159719, populationGrowthAnnualPct: 0.915, inflationAnnualPct: 5.339, unemploymentPct: 22.788, fixedInvestmentSharePctGdp: 14.387, exportSharePctGdp: 24.404, importSharePctGdp: 21.816, industrySharePctGdp: 28.230 },
  DZA: { realGdpBillion2000Usd: 54.790, realGrowthAnnualPct: 3.800, populationMillions: 30.903893, populationGrowthAnnualPct: 1.400, inflationAnnualPct: 0.339, unemploymentPct: 29.770, fixedInvestmentSharePctGdp: 20.677, exportSharePctGdp: 42.070, importSharePctGdp: 20.789, industrySharePctGdp: 53.331 },
  EGY: { realGdpBillion2000Usd: 99.839, realGrowthAnnualPct: 6.370, populationMillions: 73.083284, populationGrowthAnnualPct: 2.161, inflationAnnualPct: 2.684, unemploymentPct: 8.980, fixedInvestmentSharePctGdp: 18.950, exportSharePctGdp: 16.201, importSharePctGdp: 22.817, industrySharePctGdp: 30.752 },
  MLI: { realGdpBillion2000Usd: 3.522, realGrowthAnnualPct: -0.736, populationMillions: 11.559290, populationGrowthAnnualPct: 2.913, inflationAnnualPct: -0.678, unemploymentPct: 1.412, fixedInvestmentSharePctGdp: 17.819, exportSharePctGdp: 18.308, importSharePctGdp: 26.357, industrySharePctGdp: 16.198 },
  NGA: { realGdpBillion2000Usd: 69.172, realGrowthAnnualPct: 5.016, populationMillions: 126.382494, populationGrowthAnnualPct: 2.674, inflationAnnualPct: 6.933, unemploymentPct: 3.953, fixedInvestmentSharePctGdp: 23.160, exportSharePctGdp: 19.320, importSharePctGdp: 20.580, industrySharePctGdp: 33.823 },
  IRN: { realGdpBillion2000Usd: 109.592, realGrowthAnnualPct: 5.846, populationMillions: 66.418659, populationGrowthAnnualPct: 1.476, inflationAnnualPct: 14.477, unemploymentPct: 11.698, fixedInvestmentSharePctGdp: 31.305, exportSharePctGdp: 21.467, importSharePctGdp: 19.790, industrySharePctGdp: 40.306 },
  SAU: { realGdpBillion2000Usd: 189.515, realGrowthAnnualPct: 4.718, populationMillions: 16.177722, populationGrowthAnnualPct: 4.460, inflationAnnualPct: -1.125, unemploymentPct: 4.570, fixedInvestmentSharePctGdp: 17.353, exportSharePctGdp: 43.405, importSharePctGdp: 24.761, industrySharePctGdp: 53.450 },
  TUR: { realGdpBillion2000Usd: 274.748, realGrowthAnnualPct: 6.985, populationMillions: 65.425961, populationGrowthAnnualPct: 1.283, inflationAnnualPct: 54.915, unemploymentPct: 6.495, fixedInvestmentSharePctGdp: 22.311, exportSharePctGdp: 19.933, importSharePctGdp: 22.441, industrySharePctGdp: 26.804 },
};

/**
 * Quatrième lot normalisé : Asie–Pacifique du noyau ORDO. Les valeurs sont
 * les mêmes séries WDI 2000 que les lots précédents, converties dans les
 * unités attendues par le moteur (milliards de dollars et millions
 * d'habitants). La Corée du Nord reste sur sa fiche de scénario : le WDI ne
 * fournit pas de PIB comparable pour ce pays en 2000.
 */
export const asiaPacificWdi2000: Record<'RUS' | 'CHN' | 'IND' | 'JPN' | 'KOR' | 'UKR' | 'IDN' | 'AUS' | 'VNM', MacroObservation2000> = {
  RUS: { realGdpBillion2000Usd: 259.710, realGrowthAnnualPct: 10.000, populationMillions: 146.596869, populationGrowthAnnualPct: -0.421, inflationAnnualPct: 20.799, unemploymentPct: 10.581, fixedInvestmentSharePctGdp: 16.864, exportSharePctGdp: 44.060, importSharePctGdp: 24.033, industrySharePctGdp: 33.919 },
  CHN: { realGdpBillion2000Usd: 1223.755, realGrowthAnnualPct: 8.574, populationMillions: 1262.645000, populationGrowthAnnualPct: 0.788, inflationAnnualPct: 0.348, unemploymentPct: 3.260, fixedInvestmentSharePctGdp: 32.647, exportSharePctGdp: 20.682, importSharePctGdp: 18.329, industrySharePctGdp: 45.074 },
  IND: { realGdpBillion2000Usd: 468.396, realGrowthAnnualPct: 3.841, populationMillions: 1057.922733, populationGrowthAnnualPct: 1.879, inflationAnnualPct: 4.009, unemploymentPct: 7.589, fixedInvestmentSharePctGdp: 26.022, exportSharePctGdp: 12.997, importSharePctGdp: 13.904, industrySharePctGdp: 27.326 },
  JPN: { realGdpBillion2000Usd: 5042.382, realGrowthAnnualPct: 2.978, populationMillions: 126.843000, populationGrowthAnnualPct: 0.167, inflationAnnualPct: -0.677, unemploymentPct: 4.748, fixedInvestmentSharePctGdp: 29.720, exportSharePctGdp: 10.310, importSharePctGdp: 8.965, industrySharePctGdp: 32.485 },
  KOR: { realGdpBillion2000Usd: 597.487, realGrowthAnnualPct: 9.202, populationMillions: 47.008111, populationGrowthAnnualPct: 0.836, inflationAnnualPct: 2.259, unemploymentPct: 4.063, fixedInvestmentSharePctGdp: 31.495, exportSharePctGdp: 32.864, importSharePctGdp: 31.195, industrySharePctGdp: 34.423 },
  UKR: { realGdpBillion2000Usd: 32.375, realGrowthAnnualPct: 5.900, populationMillions: 49.556660, populationGrowthAnnualPct: -0.844, inflationAnnualPct: 28.203, unemploymentPct: 11.707, fixedInvestmentSharePctGdp: 19.745, exportSharePctGdp: 60.297, importSharePctGdp: 55.439, industrySharePctGdp: 31.650 },
  IDN: { realGdpBillion2000Usd: 165.021, realGrowthAnnualPct: 4.920, populationMillions: 216.077790, populationGrowthAnnualPct: 1.432, inflationAnnualPct: 3.689, unemploymentPct: 6.077, fixedInvestmentSharePctGdp: 19.851, exportSharePctGdp: 40.977, importSharePctGdp: 30.460, industrySharePctGdp: 41.969 },
  AUS: { realGdpBillion2000Usd: 416.902, realGrowthAnnualPct: 3.916, populationMillions: 19.028802, populationGrowthAnnualPct: 1.144, inflationAnnualPct: 4.457, unemploymentPct: 6.288, fixedInvestmentSharePctGdp: 25.892, exportSharePctGdp: 19.356, importSharePctGdp: 21.507, industrySharePctGdp: 24.532 },
  VNM: { realGdpBillion2000Usd: 31.173, realGrowthAnnualPct: 6.787, populationMillions: 77.154011, populationGrowthAnnualPct: 1.130, inflationAnnualPct: -1.710, unemploymentPct: 2.260, fixedInvestmentSharePctGdp: 27.647, exportSharePctGdp: 53.921, importSharePctGdp: 57.496, industrySharePctGdp: 36.731 },
};

/**
 * Dernier lot du noyau de 37 : Pays-Bas, Pakistan, Israël, Libye et Niger.
 * La part industrielle libyenne n'est pas publiée par le WDI en 2000 et
 * conserve donc la calibration de scénario déjà utilisée par ORDO ; Taïwan
 * et la Corée du Nord restent également sur leurs fiches de scénario, faute
 * de série WDI complète et comparable.
 */
export const remainingCoreWdi2000: Record<'NLD' | 'PAK' | 'ISR' | 'LBY' | 'NER', MacroObservation2000> = {
  NLD: { realGdpBillion2000Usd: 417.649, realGrowthAnnualPct: 4.220, populationMillions: 15.925513, populationGrowthAnnualPct: 0.715, inflationAnnualPct: 2.361, unemploymentPct: 2.725, fixedInvestmentSharePctGdp: 22.528, exportSharePctGdp: 66.443, importSharePctGdp: 59.224, industrySharePctGdp: 21.100 },
  PAK: { realGdpBillion2000Usd: 99.485, realGrowthAnnualPct: 4.260, populationMillions: 154.879127, populationGrowthAnnualPct: 2.825, inflationAnnualPct: 4.367, unemploymentPct: 0.614, fixedInvestmentSharePctGdp: 14.601, exportSharePctGdp: 9.630, importSharePctGdp: 11.830, industrySharePctGdp: 17.184 },
  ISR: { realGdpBillion2000Usd: 136.410, realGrowthAnnualPct: 8.592, populationMillions: 6.289000, populationGrowthAnnualPct: 2.642, inflationAnnualPct: 1.033, unemploymentPct: 11.102, fixedInvestmentSharePctGdp: 24.167, exportSharePctGdp: 33.796, importSharePctGdp: 34.602, industrySharePctGdp: 23.047 },
  LBY: { realGdpBillion2000Usd: 38.271, realGrowthAnnualPct: 3.679, populationMillions: 5.305021, populationGrowthAnnualPct: 1.653, inflationAnnualPct: -2.900, unemploymentPct: 19.275, fixedInvestmentSharePctGdp: 11.637, exportSharePctGdp: 31.558, importSharePctGdp: 13.723, industrySharePctGdp: 58.000 },
  NER: { realGdpBillion2000Usd: 2.242, realGrowthAnnualPct: -1.208, populationMillions: 11.509630, populationGrowthAnnualPct: 3.467, inflationAnnualPct: 2.900, unemploymentPct: 1.427, fixedInvestmentSharePctGdp: 12.899, exportSharePctGdp: 14.340, importSharePctGdp: 20.373, industrySharePctGdp: 18.098 },
};

/** Séries WDI absentes en 2000 et remplacées par une calibration ORDO. */
export const wdiCalibratedIndicatorCodes: Record<string, string[]> = {
  NGA: ['NE.GDI.FTOT.ZS', 'NE.EXP.GNFS.ZS', 'NE.IMP.GNFS.ZS'],
  LBY: ['NV.IND.TOTL.ZS'],
};

export const wdiObservedCountryIds = Object.keys({ ...americasWdi2000, ...europeWdi2000, ...africaMiddleEastWdi2000, ...asiaPacificWdi2000, ...remainingCoreWdi2000 }) as CountryId[];
