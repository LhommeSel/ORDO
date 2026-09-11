import type {
  CountryId,
  CountryState,
  CountryStructuralProfile,
  MacroeconomicState,
  StrategicSectorId,
  StrategicSectorState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(1));

function aggregateSector(
  country: CountryState,
  profile: CountryStructuralProfile,
  economy: MacroeconomicState,
  sector: StrategicSectorId,
): StrategicSectorState {
  const agriculture = economy.sectors.agriculture;
  const services = economy.sectors.market_services;
  const defenseIntensity = clamp(country.weight * 0.55 + country.metrics.security * 0.25 + profile.industrialDepth * 0.2);

  const values = sector === 'defense'
    ? {
        capacity: defenseIntensity,
        utilization: clamp(48 + country.metrics.security * 0.32),
        health: clamp(profile.industrialDepth * 0.55 + profile.innovationCapacity * 0.45),
        dependency: clamp(92 - profile.industrialDepth * 0.72 - profile.innovationCapacity * 0.18),
        technology: clamp(profile.innovationCapacity * 0.6 + profile.industrialDepth * 0.4),
        lead: 42,
        vulnerability: profile.industrialDepth < 40 ? 'Base industrielle de défense étroite' : undefined,
      }
    : sector === 'telecoms'
      ? {
          capacity: clamp(profile.infrastructureQuality * 0.58 + services.capacityIndex * 0.42),
          utilization: services.utilizationPct,
          health: clamp(profile.infrastructureQuality * 0.6 + profile.financialResilience * 0.4),
          dependency: clamp(78 - profile.innovationCapacity * 0.55),
          technology: clamp(profile.innovationCapacity * 0.68 + profile.infrastructureQuality * 0.32),
          lead: 24,
          vulnerability: profile.infrastructureQuality < 40 ? 'Réseau national encore incomplet' : undefined,
        }
      : {
          capacity: clamp(
            agriculture.capacityIndex * 0.28
              + agriculture.productivityIndex * 0.22
              + agriculture.valueAddedSharePct * 1.35
              + Math.log10(Math.max(1, economy.populationMillions)) * 8,
          ),
          utilization: agriculture.utilizationPct,
          health: clamp(agriculture.productivityIndex * 0.55 + profile.infrastructureQuality * 0.25 + profile.socialStabilizers * 0.2),
          dependency: economy.products.food.importDependencyPct,
          technology: clamp(agriculture.productivityIndex * 0.65 + profile.innovationCapacity * 0.35),
          lead: 18,
          vulnerability: economy.products.food.importDependencyPct > 55 ? 'Dépendance élevée aux importations alimentaires' : undefined,
        };

  return {
    id: `${country.id}-${sector}`,
    countryId: country.id,
    sector,
    capacity: round(values.capacity),
    utilization: round(values.utilization),
    workloadMonths: 0,
    health: round(values.health),
    foreignDependency: round(values.dependency),
    technology: round(values.technology),
    expansionLeadMonths: values.lead,
    ...(values.vulnerability ? { vulnerability: values.vulnerability } : {}),
    modelingLevel: 'aggregate',
  };
}

/**
 * Donne à chaque pays trois filières systémiques comparables. Les inventaires
 * nationaux documentés remplacent automatiquement leur équivalent agrégé.
 */
export function createStrategicSectors2000(
  countries: Record<CountryId, CountryState>,
  profiles: Record<CountryId, CountryStructuralProfile>,
  economies: Record<CountryId, MacroeconomicState>,
  documented: Record<string, StrategicSectorState>,
) {
  const result: Record<string, StrategicSectorState> = {};
  for (const country of Object.values(countries)) {
    const profile = profiles[country.id];
    const economy = economies[country.id];
    if (!profile || !economy) continue;
    for (const sector of ['defense', 'telecoms', 'strategic_agriculture'] as const) {
      const entry = aggregateSector(country, profile, economy, sector);
      result[entry.id] = entry;
    }
  }
  for (const [id, sector] of Object.entries(documented)) {
    const aggregateId = `${sector.countryId}-${sector.sector}`;
    delete result[aggregateId];
    result[id] = { ...sector, modelingLevel: sector.modelingLevel ?? 'documented' };
  }
  return result;
}
