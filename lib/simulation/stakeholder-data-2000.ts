import type {
  CountryState,
  CountryStructuralProfile,
  StakeholderGroup,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, Math.round(value)));

export function createStakeholderGroups2000(
  countries: Record<string, CountryState>,
  profiles: Record<string, CountryStructuralProfile>,
): Record<string, StakeholderGroup> {
  const groups: StakeholderGroup[] = [];
  for (const country of Object.values(countries)) {
    const profile = profiles[country.id];
    if (!profile) continue;
    groups.push(
      {
        id: `${country.id}-military-command`, countryId: country.id,
        label: 'Haut commandement et cadres des armées', category: 'military',
        influence: clamp(45 + country.weight * 0.35), cohesion: clamp(48 + country.metrics.security * 0.35), baselineDefiance: 8,
        sensitivities: { defense_cuts: 0.92, austerity: 0.18, administrative_reorganization: 0.08 },
        influenceChannels: ['security_cohesion', 'political_support'],
        possibleResponses: ['Critiques internes et fuites', 'Ralentissement de l’exécution', 'Démissions ou refus d’obéissance dans une crise extrême'],
      },
      {
        id: `${country.id}-organized-labor`, countryId: country.id,
        label: 'Syndicats et salariés organisés', category: 'organized_labor',
        influence: clamp(32 + profile.socialStabilizers * 0.42), cohesion: clamp(36 + profile.socialStabilizers * 0.25), baselineDefiance: 12,
        sensitivities: { labor_deregulation: 0.96, austerity: 0.62, public_industrial_investment: -0.28 },
        influenceChannels: ['social_mobilization', 'political_support', 'policy_execution'],
        possibleResponses: ['Négociation collective', 'Mobilisations sectorielles', 'Grève nationale lorsque la mobilisation devient critique'],
      },
      {
        id: `${country.id}-capital-owners`, countryId: country.id,
        label: 'Détenteurs de capitaux et directions financières', category: 'capital',
        influence: clamp(45 + profile.financialResilience * 0.38), cohesion: clamp(34 + profile.exportConcentration * 0.22), baselineDefiance: 9,
        sensitivities: { capital_controls: 0.94, tax_increase_high_incomes: 0.58, public_industrial_investment: -0.08 },
        influenceChannels: ['economic_confidence', 'political_support'],
        possibleResponses: ['Report d’investissements', 'Lobbying et campagne publique', 'Sorties de capitaux lorsque les contrôles restent contournables'],
      },
      {
        id: `${country.id}-senior-administration`, countryId: country.id,
        label: 'Haute administration et corps techniques', category: 'administration',
        influence: clamp(35 + country.politics.administrativeCompliance * 0.48), cohesion: clamp(42 + country.politics.administrativeCompliance * 0.35), baselineDefiance: 6,
        sensitivities: { administrative_reorganization: 0.74, austerity: 0.32, public_industrial_investment: 0.12 },
        influenceChannels: ['policy_execution', 'political_support'],
        possibleResponses: ['Réserves techniques', 'Application lente ou restrictive', 'Blocage administratif informel dans les cas critiques'],
      },
    );
  }
  return Object.fromEntries(groups.map((group) => [group.id, group]));
}
