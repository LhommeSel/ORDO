import type { CountryId, CountryState, CountryStructuralProfile } from './types';

type ProfileInput = Omit<CountryStructuralProfile, 'countryId' | 'source'> & {
  confidence: number;
};

const profiles: Record<CountryId, ProfileInput> = {
  FRA: { industrialDepth: 76, economicDiversification: 82, innovationCapacity: 78, infrastructureQuality: 84, financialResilience: 70, socialStabilizers: 86, exportConcentration: 36, resourceRentDependency: 5, demographicPressure: 38, productivityCatchUp: 12, monetaryRegime: 'currency_union', workforceTrend: 'stable', confidence: 84 },
  DEU: { industrialDepth: 88, economicDiversification: 80, innovationCapacity: 84, infrastructureQuality: 88, financialResilience: 74, socialStabilizers: 82, exportConcentration: 48, resourceRentDependency: 4, demographicPressure: 62, productivityCatchUp: 10, monetaryRegime: 'currency_union', workforceTrend: 'decline', confidence: 87 },
  ITA: { industrialDepth: 72, economicDiversification: 78, innovationCapacity: 66, infrastructureQuality: 72, financialResilience: 53, socialStabilizers: 78, exportConcentration: 44, resourceRentDependency: 4, demographicPressure: 66, productivityCatchUp: 18, monetaryRegime: 'currency_union', workforceTrend: 'decline', confidence: 80 },
  ESP: { industrialDepth: 68, economicDiversification: 78, innovationCapacity: 64, infrastructureQuality: 72, financialResilience: 61, socialStabilizers: 60, exportConcentration: 45, resourceRentDependency: 7, demographicPressure: 58, productivityCatchUp: 24, monetaryRegime: 'currency_union', workforceTrend: 'stable', confidence: 82 },
  POL: { industrialDepth: 58, economicDiversification: 65, innovationCapacity: 49, infrastructureQuality: 54, financialResilience: 52, socialStabilizers: 55, exportConcentration: 57, resourceRentDependency: 18, demographicPressure: 42, productivityCatchUp: 84, monetaryRegime: 'sovereign_floating', workforceTrend: 'decline', confidence: 72 },
  USA: { industrialDepth: 83, economicDiversification: 92, innovationCapacity: 94, infrastructureQuality: 82, financialResilience: 63, socialStabilizers: 48, exportConcentration: 42, resourceRentDependency: 9, demographicPressure: 34, productivityCatchUp: 4, monetaryRegime: 'sovereign_floating', workforceTrend: 'growth', confidence: 86 },
  CAN: { industrialDepth: 72, economicDiversification: 87, innovationCapacity: 81, infrastructureQuality: 88, financialResilience: 74, socialStabilizers: 83, exportConcentration: 46, resourceRentDependency: 33, demographicPressure: 38, productivityCatchUp: 10, monetaryRegime: 'sovereign_floating', workforceTrend: 'stable', confidence: 86 },
  MEX: { industrialDepth: 62, economicDiversification: 68, innovationCapacity: 45, infrastructureQuality: 53, financialResilience: 47, socialStabilizers: 48, exportConcentration: 56, resourceRentDependency: 25, demographicPressure: 50, productivityCatchUp: 62, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 72 },
  GBR: { industrialDepth: 66, economicDiversification: 88, innovationCapacity: 84, infrastructureQuality: 82, financialResilience: 58, socialStabilizers: 68, exportConcentration: 45, resourceRentDependency: 11, demographicPressure: 48, productivityCatchUp: 8, monetaryRegime: 'sovereign_floating', workforceTrend: 'stable', confidence: 84 },
  RUS: { industrialDepth: 63, economicDiversification: 44, innovationCapacity: 57, infrastructureQuality: 52, financialResilience: 31, socialStabilizers: 44, exportConcentration: 79, resourceRentDependency: 82, demographicPressure: 72, productivityCatchUp: 73, monetaryRegime: 'sovereign_managed', workforceTrend: 'strong_decline', confidence: 56 },
  CHN: { industrialDepth: 72, economicDiversification: 68, innovationCapacity: 48, infrastructureQuality: 50, financialResilience: 47, socialStabilizers: 31, exportConcentration: 58, resourceRentDependency: 16, demographicPressure: 40, productivityCatchUp: 96, monetaryRegime: 'pegged', workforceTrend: 'growth', confidence: 54 },
  NOR: { industrialDepth: 64, economicDiversification: 52, innovationCapacity: 80, infrastructureQuality: 92, financialResilience: 90, socialStabilizers: 94, exportConcentration: 76, resourceRentDependency: 86, demographicPressure: 44, productivityCatchUp: 8, monetaryRegime: 'sovereign_floating', workforceTrend: 'stable', confidence: 90 },
  DZA: { industrialDepth: 36, economicDiversification: 24, innovationCapacity: 29, infrastructureQuality: 43, financialResilience: 37, socialStabilizers: 46, exportConcentration: 91, resourceRentDependency: 93, demographicPressure: 46, productivityCatchUp: 86, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 57 },
  LBY: { industrialDepth: 28, economicDiversification: 16, innovationCapacity: 22, infrastructureQuality: 39, financialResilience: 24, socialStabilizers: 38, exportConcentration: 96, resourceRentDependency: 97, demographicPressure: 44, productivityCatchUp: 89, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 36 },
  SAU: { industrialDepth: 43, economicDiversification: 22, innovationCapacity: 37, infrastructureQuality: 66, financialResilience: 78, socialStabilizers: 45, exportConcentration: 94, resourceRentDependency: 97, demographicPressure: 32, productivityCatchUp: 82, monetaryRegime: 'pegged', workforceTrend: 'strong_growth', confidence: 52 },
  BRA: { industrialDepth: 67, economicDiversification: 76, innovationCapacity: 55, infrastructureQuality: 57, financialResilience: 42, socialStabilizers: 52, exportConcentration: 38, resourceRentDependency: 26, demographicPressure: 44, productivityCatchUp: 56, monetaryRegime: 'sovereign_floating', workforceTrend: 'growth', confidence: 74 },
  ZAF: { industrialDepth: 55, economicDiversification: 62, innovationCapacity: 48, infrastructureQuality: 61, financialResilience: 51, socialStabilizers: 47, exportConcentration: 69, resourceRentDependency: 57, demographicPressure: 58, productivityCatchUp: 61, monetaryRegime: 'sovereign_floating', workforceTrend: 'growth', confidence: 70 },
  AUS: { industrialDepth: 55, economicDiversification: 72, innovationCapacity: 74, infrastructureQuality: 86, financialResilience: 82, socialStabilizers: 77, exportConcentration: 72, resourceRentDependency: 54, demographicPressure: 39, productivityCatchUp: 14, monetaryRegime: 'sovereign_floating', workforceTrend: 'growth', confidence: 88 },
  IND: { industrialDepth: 58, economicDiversification: 70, innovationCapacity: 55, infrastructureQuality: 43, financialResilience: 49, socialStabilizers: 42, exportConcentration: 41, resourceRentDependency: 14, demographicPressure: 66, productivityCatchUp: 94, monetaryRegime: 'sovereign_managed', workforceTrend: 'strong_growth', confidence: 68 },
  JPN: { industrialDepth: 92, economicDiversification: 83, innovationCapacity: 94, infrastructureQuality: 92, financialResilience: 63, socialStabilizers: 80, exportConcentration: 43, resourceRentDependency: 3, demographicPressure: 70, productivityCatchUp: 8, monetaryRegime: 'sovereign_floating', workforceTrend: 'decline', confidence: 92 },
  TUR: { industrialDepth: 61, economicDiversification: 68, innovationCapacity: 45, infrastructureQuality: 54, financialResilience: 30, socialStabilizers: 43, exportConcentration: 43, resourceRentDependency: 8, demographicPressure: 53, productivityCatchUp: 75, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 64 },
  VNM: { industrialDepth: 43, economicDiversification: 52, innovationCapacity: 32, infrastructureQuality: 39, financialResilience: 43, socialStabilizers: 46, exportConcentration: 61, resourceRentDependency: 22, demographicPressure: 48, productivityCatchUp: 96, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 56 },
};

export function createStructuralProfiles2000(countries?: Record<CountryId, CountryState>): Record<CountryId, CountryStructuralProfile> {
  const result = Object.fromEntries(Object.entries(profiles).map(([countryId, profile]) => {
    const { confidence, ...values } = profile;
    return [countryId, {
      countryId,
      ...values,
      source: {
        basis: 'Profil structurel ORDO établi à partir de la situation connue en 2000 ; indices à calibrer sur des séries internationales.',
        observationYear: 2000,
        confidence,
        estimated: true,
      },
    }];
  })) as Record<CountryId, CountryStructuralProfile>;
  if (!countries) return result;
  for (const country of Object.values(countries)) {
    if (result[country.id]) continue;
    const controlled = /parti unique|autoritaire|junte|islamique|monarchie absolue/i.test(country.politics.regime);
    result[country.id] = {
      countryId: country.id,
      industrialDepth: Math.min(92, Math.max(12, country.metrics.industry)),
      economicDiversification: Math.min(92, Math.max(12, 100 - country.strategy.vulnerabilities.length * 12)),
      innovationCapacity: Math.min(92, Math.max(10, country.metrics.industry * 0.8)),
      infrastructureQuality: Math.min(92, Math.max(12, country.metrics.industry * 0.9)),
      financialResilience: Math.min(92, Math.max(10, country.metrics.stability + 10)),
      socialStabilizers: Math.min(92, Math.max(12, country.metrics.stability)),
      exportConcentration: Math.min(96, Math.max(12, country.strategy.vulnerabilities.some((v) => /pétrol|hydrocarb|miner|matière/i.test(v)) ? 78 : 42)),
      resourceRentDependency: Math.min(97, Math.max(3, country.strategy.vulnerabilities.some((v) => /pétrol|hydrocarb|miner/i.test(v)) ? 72 : 15)),
      demographicPressure: Math.min(92, Math.max(12, country.strategy.vulnerabilities.some((v) => /démograph|pauvreté|chômage/i.test(v)) ? 62 : 38)),
      productivityCatchUp: Math.min(96, Math.max(4, 100 - country.metrics.industry)),
      monetaryRegime: controlled ? 'sovereign_managed' : 'sovereign_floating',
      workforceTrend: 'stable',
      source: {
        basis: 'Profil structurel ORDO généré à partir de la fiche nationale compacte du scénario 2000 ; valeurs de gameplay à calibrer.',
        observationYear: 2000, confidence: country.statisticalReliability, estimated: true,
      },
    };
  }
  return result;
}
