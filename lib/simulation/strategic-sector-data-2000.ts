import type {
  CountryId,
  CountryState,
  CountryStructuralProfile,
  MacroeconomicState,
  StrategicSectorId,
  StrategicSectorState,
} from './types';
import { industrialInputRequirementsFor, technologyTierFor } from './industrial-inputs';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(1));

function aggregateSector(
  country: CountryState,
  profile: CountryStructuralProfile,
  economy: MacroeconomicState,
  sector: StrategicSectorId,
): StrategicSectorState {
  const agriculture = economy.sectors.agriculture;
  const extractive = economy.sectors.extractive;
  const manufacturing = economy.sectors.manufacturing;
  const services = economy.sectors.market_services;
  const defenseIntensity = clamp(country.weight * 0.55 + country.metrics.security * 0.25 + profile.industrialDepth * 0.2);

  const values = sector === 'consumer_goods'
    ? {
        capacity: clamp(manufacturing.capacityIndex * 0.62 + Math.log10(Math.max(1, economy.populationMillions)) * 9 + profile.economicDiversification * 0.16),
        utilization: manufacturing.utilizationPct,
        health: clamp(manufacturing.productivityIndex * 0.46 + profile.infrastructureQuality * 0.28 + profile.financialResilience * 0.26),
        dependency: clamp(economy.products.manufactured_goods.importDependencyPct * 0.68 + economy.products.industrial_inputs.importDependencyPct * 0.22),
        technology: clamp(profile.industrialDepth * 0.5 + profile.innovationCapacity * 0.25 + profile.infrastructureQuality * 0.15 + profile.economicDiversification * 0.1),
        lead: 18,
        vulnerability: manufacturing.capacityIndex < 42 ? 'Base de biens manufacturés limitée' : undefined,
      }
    : sector === 'industrial_inputs'
      ? {
          capacity: clamp(manufacturing.capacityIndex * 0.54 + extractive.capacityIndex * 0.2 + profile.industrialDepth * 0.26),
          utilization: clamp((manufacturing.utilizationPct + extractive.utilizationPct) / 2),
          health: clamp(manufacturing.productivityIndex * 0.48 + profile.infrastructureQuality * 0.26 + profile.industrialDepth * 0.26),
          dependency: clamp(economy.products.industrial_inputs.importDependencyPct * 0.78 + economy.products.raw_materials.importDependencyPct * 0.18),
          technology: clamp(profile.industrialDepth * 0.5 + profile.innovationCapacity * 0.28 + profile.infrastructureQuality * 0.12 + profile.economicDiversification * 0.1),
          lead: 30,
          vulnerability: economy.products.industrial_inputs.importDependencyPct > 58 ? 'Intrants industriels fortement importés' : undefined,
        }
      : sector === 'machinery_mobility'
        ? {
            capacity: clamp(manufacturing.capacityIndex * 0.52 + profile.industrialDepth * 0.32 + profile.infrastructureQuality * 0.16),
            utilization: manufacturing.utilizationPct,
            health: clamp(manufacturing.productivityIndex * 0.42 + profile.innovationCapacity * 0.34 + profile.industrialDepth * 0.24),
            dependency: clamp(economy.products.industrial_inputs.importDependencyPct * 0.48 + economy.products.strategic_technology.importDependencyPct * 0.32),
            technology: clamp(profile.industrialDepth * 0.38 + profile.innovationCapacity * 0.45 + profile.infrastructureQuality * 0.17),
            lead: 36,
            vulnerability: profile.industrialDepth < 48 ? 'Chaîne de machines et équipements encore peu profonde' : undefined,
          }
        : sector === 'advanced_electronics'
          ? {
              capacity: clamp(manufacturing.capacityIndex * 0.28 + profile.innovationCapacity * 0.46 + profile.infrastructureQuality * 0.26),
              utilization: clamp(manufacturing.utilizationPct + 4),
              health: clamp(profile.innovationCapacity * 0.57 + profile.infrastructureQuality * 0.23 + profile.financialResilience * 0.2),
              dependency: clamp(economy.products.strategic_technology.importDependencyPct * 0.8 + economy.products.industrial_inputs.importDependencyPct * 0.16),
              technology: clamp(profile.innovationCapacity * 0.7 + profile.industrialDepth * 0.18 + profile.infrastructureQuality * 0.12),
              lead: 48,
              vulnerability: profile.innovationCapacity < 50 ? 'Électronique avancée dépendante des savoir-faire étrangers' : undefined,
            }
          : sector === 'defense'
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
          technology: clamp(profile.industrialDepth * 0.22 + profile.innovationCapacity * 0.24 + profile.infrastructureQuality * 0.28 + profile.economicDiversification * 0.26),
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
    technologyTier: technologyTierFor(values.technology),
    inputRequirements: industrialInputRequirementsFor(sector, technologyTierFor(values.technology)),
    expansionLeadMonths: values.lead,
    ...(values.vulnerability ? { vulnerability: values.vulnerability } : {}),
    modelingLevel: 'aggregate',
  };
}

/**
 * Donne à chaque pays un socle productif comparable. Les inventaires
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
    for (const sector of ['consumer_goods', 'industrial_inputs', 'machinery_mobility', 'advanced_electronics', 'defense', 'telecoms', 'strategic_agriculture'] as const) {
      const entry = aggregateSector(country, profile, economy, sector);
      result[entry.id] = entry;
    }
  }
  for (const [id, sector] of Object.entries(documented)) {
    const aggregateId = `${sector.countryId}-${sector.sector}`;
    delete result[aggregateId];
    // Migration ciblée du référentiel précédent : FRA-nuclear était codé à 91
    // alors que ce chiffre décrivait de fait la solidité de la filière, pas
    // une frontière technologique. Le 91 exact sans nouveau champ identifie
    // le vieux socle sans écraser une progression ultérieure du joueur.
    const legacyFrenchNuclearBaseline = sector.id === 'FRA-nuclear'
      && sector.sector === 'nuclear'
      && sector.technology === 91
      && sector.technologyTier === undefined
      && sector.inputRequirements === undefined;
    const technology = legacyFrenchNuclearBaseline ? 55 : sector.technology;
    const technologyTier = sector.technologyTier ?? technologyTierFor(technology);
    result[id] = {
      ...sector,
      technology,
      technologyTier,
      inputRequirements: sector.inputRequirements ?? industrialInputRequirementsFor(sector.sector, technologyTier),
      modelingLevel: sector.modelingLevel ?? 'documented',
    };
  }
  return result;
}
