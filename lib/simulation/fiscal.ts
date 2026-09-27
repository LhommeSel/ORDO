import type { CountryState, FiscalState, MacroeconomicState, WorldEffect, WorldState } from './types';

const round = (value: number) => Number(value.toFixed(2));

/** Initialise une comptabilité jouable à partir d'une enveloppe annuelle.
 * Les crédits de décision sont volontairement séparés des ratios macro. */
export function fiscalStateForCredits(annualCredits: number, overrides: Partial<FiscalState> = {}): FiscalState {
  const total = Math.max(0, Number(annualCredits) || 0);
  const reserve = Math.min(total, overrides.emergencyReserve ?? round(Math.min(36, Math.max(5, total * 0.15))));
  const allocation = overrides.annualDiscretionaryAllocation ?? round(Math.max(0, total - reserve));
  return {
    annualRevenuePctGDP: overrides.annualRevenuePctGDP ?? 40,
    annualSpendingPctGDP: overrides.annualSpendingPctGDP ?? 42,
    fiscalBalancePctGDP: overrides.fiscalBalancePctGDP ?? -2,
    publicDebtPctGDP: overrides.publicDebtPctGDP ?? 55,
    annualDiscretionaryAllocation: allocation,
    discretionaryMargin: overrides.discretionaryMargin ?? allocation,
    emergencyReserve: reserve,
    recurringProgramCosts: overrides.recurringProgramCosts ?? 0,
    recurringProgramSavings: overrides.recurringProgramSavings ?? 0,
    lastSettlementYear: overrides.lastSettlementYear ?? 2000,
  };
}

export function fiscalBudgetAvailable(country: CountryState, bucket: 'discretionary' | 'emergency_reserve' = 'discretionary') {
  const bucketValue = bucket === 'emergency_reserve' ? country.fiscal.emergencyReserve : country.fiscal.discretionaryMargin;
  return Math.max(0, bucketValue);
}

export function fiscalTotalAvailable(country: CountryState) {
  const fiscal = country.fiscal;
  return round(fiscal.discretionaryMargin + fiscal.emergencyReserve);
}

function fiscalSettlement(country: CountryState, macro: MacroeconomicState | undefined, year: number): FiscalState {
  const fiscal = country.fiscal;
  const growth = macro?.realGrowthAnnualPct ?? 2;
  const unemployment = macro?.unemploymentPct ?? 7;
  const fiscalStance = macro?.policy.fiscalStance ?? 0;
  const maintenance = Object.values(country.capacityMaintenance ?? {}).reduce((sum, item) => sum + item.annualBudgetCost, 0);
  const recurringNet = fiscal.recurringProgramSavings - fiscal.recurringProgramCosts - maintenance;
  const revenue = round(Math.max(5, Math.min(75, fiscal.annualRevenuePctGDP + (growth - 2) * 0.05 + fiscalStance * 0.008)));
  const spending = round(Math.max(5, Math.min(80, fiscal.annualSpendingPctGDP + Math.max(0, unemployment - 6) * 0.025 + fiscalStance * 0.025)));
  const balance = round(revenue - spending);
  const debtBasis = macro?.publicDebtPctGdp ?? fiscal.publicDebtPctGDP;
  const debt = round(Math.max(0, Math.min(260, debtBasis - balance + Math.max(0, unemployment - 8) * 0.08)));
  const growthFactor = 1 + Math.max(-0.12, Math.min(0.12, growth * 0.018 - debt * 0.0008 + balance * 0.004));
  const allocation = round(Math.max(0, fiscal.annualDiscretionaryAllocation * growthFactor + recurringNet));
  const reserveTarget = round(Math.max(3, Math.min(36, allocation * 0.17 + Math.max(0, -balance) * 1.2)));
  return {
    ...fiscal,
    annualRevenuePctGDP: revenue,
    annualSpendingPctGDP: spending,
    fiscalBalancePctGDP: balance,
    publicDebtPctGDP: debt,
    annualDiscretionaryAllocation: allocation,
    discretionaryMargin: allocation,
    emergencyReserve: reserveTarget,
    lastSettlementYear: year,
  };
}

/** Exécute la loi de finances au 1er janvier : croissance, chômage, dette et
 * engagements permanents redéfinissent l'enveloppe de l'année. */
export function fiscalSettlementEffects(state: WorldState): WorldEffect[] {
  const year = Number(state.currentDate.slice(0, 4));
  if (!state.currentDate.endsWith('-01-01') || !Number.isInteger(year)) return [];
  return Object.values(state.countries)
    .filter((country) => country.fiscal.lastSettlementYear < year)
    .map((country) => ({
      kind: 'fiscal_patch' as const,
      countryId: country.id,
      patch: fiscalSettlement(country, state.macroEconomies[country.id], year),
      reason: `Loi de finances ${year} : l'enveloppe tient compte de la croissance, du chômage, de la dette et des engagements durables.`,
      visibility: country.id === state.playerCountryId ? 'player' as const : 'debug' as const,
    }));
}
