import type { CountryId, WorldState } from './types';

export type RetirementProjection = {
  countryId: CountryId;
  baselineYear: number;
  horizonYear: number;
  baselineSharePctGdp: number;
  horizonSharePctGdp: number;
  baselineAnnualBillion2000Usd: number;
  horizonGdpBillion2000Usd: number;
  horizonAnnualBillion2000Usd: number;
  annualIncreaseBillion2000Usd: number;
  demographicIncreasePoints: number;
  realGrowthAssumptionPct: number;
};

const knownBaselineShares: Partial<Record<CountryId, number>> = {
  FRA: 12.6,
  DEU: 11.8,
  ITA: 13.8,
  ESP: 9.4,
  GBR: 10.2,
  USA: 9.8,
  JPN: 13.5,
  SWE: 11.3,
  NOR: 10.8,
};

/**
 * Projection de scénario, exprimée en dollars constants de l'année 2000.
 * Elle décrit une trajectoire de dépense, pas un effet automatique du jeu.
 */
export function retirementProjectionFor(state: WorldState, countryId: CountryId, horizonYear = 2025): RetirementProjection | undefined {
  const macro = state.macroEconomies[countryId];
  const structural = state.structuralProfiles[countryId];
  if (!macro) return undefined;
  const years = Math.max(1, horizonYear - 2000);
  const baselineSharePctGdp = knownBaselineShares[countryId]
    ?? Math.max(6.5, Math.min(15.5, 7.4 + macro.dependencyRatioPct * 0.07 + macro.policy.socialProtection * 0.018));
  const pressure = structural?.demographicPressure ?? Math.max(20, Math.min(90, macro.dependencyRatioPct * 1.15));
  const demographicIncreasePoints = countryId === 'FRA'
    ? 1.9
    : Math.max(0.8, Math.min(3.4, 0.7 + pressure * 0.026 + Math.max(0, -macro.populationGrowthAnnualPct) * 0.18));
  const horizonSharePctGdp = Number((baselineSharePctGdp + demographicIncreasePoints).toFixed(1));
  const realGrowthAssumptionPct = Number(Math.max(0.8, Math.min(1.8, macro.potentialGrowthAnnualPct * 0.65)).toFixed(2));
  const horizonGdpBillion2000Usd = Number((macro.realGdpBillion2000Usd * ((1 + realGrowthAssumptionPct / 100) ** years)).toFixed(1));
  const baselineAnnualBillion2000Usd = Number((macro.realGdpBillion2000Usd * baselineSharePctGdp / 100).toFixed(1));
  const horizonAnnualBillion2000Usd = Number((horizonGdpBillion2000Usd * horizonSharePctGdp / 100).toFixed(1));
  return {
    countryId,
    baselineYear: 2000,
    horizonYear,
    baselineSharePctGdp: Number(baselineSharePctGdp.toFixed(1)),
    horizonSharePctGdp,
    baselineAnnualBillion2000Usd,
    horizonGdpBillion2000Usd,
    horizonAnnualBillion2000Usd,
    annualIncreaseBillion2000Usd: Number((horizonAnnualBillion2000Usd - baselineAnnualBillion2000Usd).toFixed(1)),
    demographicIncreasePoints,
    realGrowthAssumptionPct,
  };
}

