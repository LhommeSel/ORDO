import { energyBalance } from './energy';
import { commitWorldAction } from './ledger';
import type { MacroeconomicState, WorldEffect, WorldState } from './types';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

const cycleFor = (growth: number): WorldState['worldEconomy']['cycle'] =>
  growth < 0 ? 'recession' : growth < 2 ? 'slowdown' : growth < 3.6 ? 'balanced' : growth < 5 ? 'expansion' : 'overheating';

function nextCountryEconomy(state: WorldState, economy: MacroeconomicState, elapsedMonths: number, globalGrowth: number) {
  const oil = energyBalance(state, economy.countryId, 'oil');
  const gas = energyBalance(state, economy.countryId, 'gas');
  const oilStress = oil ? oil.deficit / Math.max(1, state.countryEnergy[economy.countryId]?.annualDemand.oil ?? 1) : 0;
  const gasStress = gas ? gas.deficit / Math.max(1, state.countryEnergy[economy.countryId]?.annualDemand.gas ?? 1) : 0;
  const energyStress = clamp((oilStress + gasStress) / 2, 0, 1);
  const country = state.countries[economy.countryId];
  const globalImpulse = (globalGrowth - 3.2) * 0.18;
  const investmentImpulse = (economy.investmentSharePctGdp - 22) * 0.035;
  const tradeImpulse = clamp(economy.tradeBalancePctGdp * 0.018, -0.8, 0.8);
  const stabilityDrag = Math.max(0, 55 - (country?.metrics.stability ?? 55)) * 0.025;
  const targetGrowth = clamp(economy.potentialGrowthAnnualPct + globalImpulse + investmentImpulse + tradeImpulse - stabilityDrag - energyStress * 6, -12, 12);
  const transition = 1 - Math.exp(-0.3 * elapsedMonths / 12);
  const growth = economy.realGrowthAnnualPct + (targetGrowth - economy.realGrowthAnnualPct) * transition;
  const averageGrowth = (economy.realGrowthAnnualPct + growth) / 2;
  const gdp = economy.realGdpBillion2000Usd * Math.pow(Math.max(0.01, 1 + averageGrowth / 100), elapsedMonths / 12);
  const population = economy.populationMillions * Math.pow(Math.max(0.01, 1 + economy.populationGrowthAnnualPct / 100), elapsedMonths / 12);
  const inflationTarget = clamp(2 + Math.max(0, growth - economy.potentialGrowthAnnualPct) * 0.35 + energyStress * 8, -3, 30);
  const inflationTransition = 1 - Math.exp(-0.55 * elapsedMonths / 12);
  const inflation = economy.inflationAnnualPct + (inflationTarget - economy.inflationAnnualPct) * inflationTransition;
  const unemployment = clamp(economy.unemploymentPct - 0.35 * (growth - economy.potentialGrowthAnnualPct) * elapsedMonths / 12, 1, 45);
  const productivityGrowth = clamp((economy.potentialGrowthAnnualPct - economy.populationGrowthAnnualPct) * 0.55, -2, 6);
  const productivity = economy.productivityIndex * Math.pow(1 + productivityGrowth / 100, elapsedMonths / 12);
  return {
    realGdpBillion2000Usd: round(gdp),
    realGrowthAnnualPct: round(growth),
    populationMillions: round(population),
    inflationAnnualPct: round(inflation),
    unemploymentPct: round(unemployment),
    productivityIndex: round(productivity),
    lastUpdatedAt: state.currentDate,
  } satisfies Partial<MacroeconomicState>;
}

export function advanceMacroeconomy(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  const dotcomPressure = state.historicalCurrents['dotcom-exuberance']?.pressure ?? 0;
  const structuralRisk = Math.max(0, dotcomPressure - 85) / 15;
  const globalTarget = clamp(3.4 - structuralRisk * 1.2, -4, 6);
  const globalTransition = 1 - Math.exp(-0.22 * elapsedMonths / 12);
  const globalGrowth = state.worldEconomy.globalGrowthAnnualPct
    + (globalTarget - state.worldEconomy.globalGrowthAnnualPct) * globalTransition;
  const globalInflation = state.worldEconomy.globalInflationAnnualPct
    + (2.4 - state.worldEconomy.globalInflationAnnualPct) * (1 - Math.exp(-0.35 * elapsedMonths / 12));
  const demandIndex = state.worldEconomy.demandIndex * Math.pow(Math.max(0.01, 1 + globalGrowth / 100), elapsedMonths / 12);
  const effects: WorldEffect[] = [{
    kind: 'world_economy_patch',
    patch: {
      globalGrowthAnnualPct: round(globalGrowth), globalInflationAnnualPct: round(globalInflation),
      demandIndex: round(demandIndex), cycle: cycleFor(globalGrowth), lastUpdatedAt: state.currentDate,
    },
    reason: 'La conjoncture mondiale évolue selon son inertie et les tensions historiques actives.', visibility: 'debug',
  }];
  for (const economy of Object.values(state.macroEconomies)) {
    effects.push({
      kind: 'macro_patch', countryId: economy.countryId,
      patch: nextCountryEconomy(state, economy, elapsedMonths, globalGrowth),
      reason: 'Le PIB, les prix, l’emploi, la population et la productivité évoluent avec la conjoncture et les contraintes nationales.',
      visibility: 'debug',
    });
  }
  return commitWorldAction(state, {
    kind: 'economic', actorId: state.playerCountryId, origin: 'time',
    intent: 'Mettre à jour les équilibres macroéconomiques mensuels', visibility: 'debug', effects,
  });
}
