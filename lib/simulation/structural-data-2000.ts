import type { CountryId, CountryStructuralProfile } from './types';

type ProfileInput = Omit<CountryStructuralProfile, 'countryId' | 'source'> & {
  confidence: number;
};

const profiles: Record<CountryId, ProfileInput> = {
  FRA: { industrialDepth: 76, economicDiversification: 82, innovationCapacity: 78, infrastructureQuality: 84, financialResilience: 70, socialStabilizers: 86, exportConcentration: 36, resourceRentDependency: 5, demographicPressure: 38, productivityCatchUp: 12, monetaryRegime: 'currency_union', workforceTrend: 'stable', confidence: 84 },
  DEU: { industrialDepth: 88, economicDiversification: 80, innovationCapacity: 84, infrastructureQuality: 88, financialResilience: 74, socialStabilizers: 82, exportConcentration: 48, resourceRentDependency: 4, demographicPressure: 62, productivityCatchUp: 10, monetaryRegime: 'currency_union', workforceTrend: 'decline', confidence: 87 },
  ITA: { industrialDepth: 72, economicDiversification: 78, innovationCapacity: 66, infrastructureQuality: 72, financialResilience: 53, socialStabilizers: 78, exportConcentration: 44, resourceRentDependency: 4, demographicPressure: 66, productivityCatchUp: 18, monetaryRegime: 'currency_union', workforceTrend: 'decline', confidence: 80 },
  POL: { industrialDepth: 58, economicDiversification: 65, innovationCapacity: 49, infrastructureQuality: 54, financialResilience: 52, socialStabilizers: 55, exportConcentration: 57, resourceRentDependency: 18, demographicPressure: 42, productivityCatchUp: 84, monetaryRegime: 'sovereign_floating', workforceTrend: 'decline', confidence: 72 },
  USA: { industrialDepth: 83, economicDiversification: 92, innovationCapacity: 94, infrastructureQuality: 82, financialResilience: 63, socialStabilizers: 48, exportConcentration: 42, resourceRentDependency: 9, demographicPressure: 34, productivityCatchUp: 4, monetaryRegime: 'sovereign_floating', workforceTrend: 'growth', confidence: 86 },
  GBR: { industrialDepth: 66, economicDiversification: 88, innovationCapacity: 84, infrastructureQuality: 82, financialResilience: 58, socialStabilizers: 68, exportConcentration: 45, resourceRentDependency: 11, demographicPressure: 48, productivityCatchUp: 8, monetaryRegime: 'sovereign_floating', workforceTrend: 'stable', confidence: 84 },
  RUS: { industrialDepth: 63, economicDiversification: 44, innovationCapacity: 57, infrastructureQuality: 52, financialResilience: 31, socialStabilizers: 44, exportConcentration: 79, resourceRentDependency: 82, demographicPressure: 72, productivityCatchUp: 73, monetaryRegime: 'sovereign_managed', workforceTrend: 'strong_decline', confidence: 56 },
  CHN: { industrialDepth: 72, economicDiversification: 68, innovationCapacity: 48, infrastructureQuality: 50, financialResilience: 47, socialStabilizers: 31, exportConcentration: 58, resourceRentDependency: 16, demographicPressure: 40, productivityCatchUp: 96, monetaryRegime: 'pegged', workforceTrend: 'growth', confidence: 54 },
  NOR: { industrialDepth: 64, economicDiversification: 52, innovationCapacity: 80, infrastructureQuality: 92, financialResilience: 90, socialStabilizers: 94, exportConcentration: 76, resourceRentDependency: 86, demographicPressure: 44, productivityCatchUp: 8, monetaryRegime: 'sovereign_floating', workforceTrend: 'stable', confidence: 90 },
  DZA: { industrialDepth: 36, economicDiversification: 24, innovationCapacity: 29, infrastructureQuality: 43, financialResilience: 37, socialStabilizers: 46, exportConcentration: 91, resourceRentDependency: 93, demographicPressure: 46, productivityCatchUp: 86, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 57 },
  LBY: { industrialDepth: 28, economicDiversification: 16, innovationCapacity: 22, infrastructureQuality: 39, financialResilience: 24, socialStabilizers: 38, exportConcentration: 96, resourceRentDependency: 97, demographicPressure: 44, productivityCatchUp: 89, monetaryRegime: 'sovereign_managed', workforceTrend: 'growth', confidence: 36 },
  SAU: { industrialDepth: 43, economicDiversification: 22, innovationCapacity: 37, infrastructureQuality: 66, financialResilience: 78, socialStabilizers: 45, exportConcentration: 94, resourceRentDependency: 97, demographicPressure: 32, productivityCatchUp: 82, monetaryRegime: 'pegged', workforceTrend: 'strong_growth', confidence: 52 },
};

export function createStructuralProfiles2000(): Record<CountryId, CountryStructuralProfile> {
  return Object.fromEntries(Object.entries(profiles).map(([countryId, profile]) => {
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
  }));
}
