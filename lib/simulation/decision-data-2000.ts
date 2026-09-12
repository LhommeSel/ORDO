import type {
  CountryDecisionProfile,
  CountryId,
  CountryState,
  DecisionCriterion,
  DecisionSignal,
  PoliticalConstraint,
} from './types';

const baseWeights: Record<DecisionCriterion, number> = {
  growth: 75, employment: 70, price_stability: 70, fiscal_sustainability: 65,
  strategic_autonomy: 65, alliance_cohesion: 65, social_cohesion: 70,
  redistribution: 50, regime_survival: 65, elite_support: 55, international_prestige: 60,
};

type ProfileOverride = {
  weights: Partial<Record<DecisionCriterion, number>>;
  riskTolerance: number;
  adaptability: number;
  satisficingThreshold: number;
  choiceNoise: number;
  constraints: PoliticalConstraint[];
};

const aversion = (
  id: string,
  label: string,
  level: PoliticalConstraint['level'],
  signals: DecisionSignal[],
  penalty: number,
  overridePressure: number,
): PoliticalConstraint => ({ id, label, level, signals, penalty, overridePressure, active: true });

const overrides: Record<CountryId, ProfileOverride> = {
  FRA: {
    weights: { employment: 84, strategic_autonomy: 84, alliance_cohesion: 80, social_cohesion: 82, redistribution: 67, international_prestige: 78 },
    riskTolerance: 50, adaptability: 68, satisficingThreshold: -8, choiceNoise: 13,
    constraints: [
      aversion('fra-dependence', 'Préserver l’autonomie stratégique', 'preference', ['foreign_dependency'], 12, 58),
      aversion('fra-alliance-break', 'Ne pas rompre brutalement les alliances occidentales', 'taboo', ['alliance_breach'], 38, 82),
    ],
  },
  DEU: {
    weights: { price_stability: 94, fiscal_sustainability: 95, alliance_cohesion: 88, social_cohesion: 80, strategic_autonomy: 58 },
    riskTolerance: 34, adaptability: 54, satisficingThreshold: -4, choiceNoise: 7,
    constraints: [
      aversion('deu-debt', 'Aversion à l’endettement discrétionnaire', 'taboo', ['deficit_spending'], 40, 76),
      aversion('deu-monetary-financing', 'Refus du financement monétaire national', 'red_line', ['monetary_financing'], 100, 100),
      aversion('deu-alliance-break', 'Ancrage européen et atlantique', 'taboo', ['alliance_breach'], 45, 88),
    ],
  },
  ITA: {
    weights: { growth: 82, employment: 84, fiscal_sustainability: 76, alliance_cohesion: 78, social_cohesion: 78 },
    riskTolerance: 48, adaptability: 72, satisficingThreshold: -10, choiceNoise: 16,
    constraints: [aversion('ita-debt', 'Prudence imposée par la dette existante', 'preference', ['deficit_spending'], 16, 62)],
  },
  ESP: {
    weights: { growth: 86, fiscal_sustainability: 84, alliance_cohesion: 82, strategic_autonomy: 62, social_cohesion: 72, international_prestige: 78 },
    riskTolerance: 46, adaptability: 64, satisficingThreshold: -9, choiceNoise: 12,
    constraints: [
      aversion('esp-fiscal-credibility', 'Préserver la crédibilité budgétaire et la convergence européenne', 'preference', ['deficit_spending'], 18, 62),
      aversion('esp-territorial-integrity', 'Préserver l’intégrité territoriale de l’État', 'taboo', ['elite_displacement'], 45, 86),
    ],
  },
  POL: {
    weights: { growth: 88, employment: 82, strategic_autonomy: 92, alliance_cohesion: 98, regime_survival: 80, international_prestige: 72 },
    riskTolerance: 58, adaptability: 70, satisficingThreshold: -7, choiceNoise: 11,
    constraints: [
      aversion('pol-russian-dependence', 'Refus d’une dépendance stratégique envers la Russie', 'red_line', ['rival_dependency'], 100, 96),
      aversion('pol-alliance-break', 'Priorité à l’intégration euro-atlantique', 'taboo', ['alliance_breach'], 55, 92),
    ],
  },
  USA: {
    weights: { growth: 88, employment: 80, fiscal_sustainability: 48, strategic_autonomy: 85, alliance_cohesion: 62, redistribution: 34, elite_support: 76, international_prestige: 98 },
    riskTolerance: 72, adaptability: 70, satisficingThreshold: -12, choiceNoise: 17,
    constraints: [aversion('usa-autonomy', 'Préserver la liberté d’action américaine', 'preference', ['foreign_dependency'], 13, 65)],
  },
  GBR: {
    weights: { growth: 84, employment: 76, fiscal_sustainability: 78, alliance_cohesion: 86, redistribution: 48, elite_support: 72, international_prestige: 84 },
    riskTolerance: 58, adaptability: 76, satisficingThreshold: -10, choiceNoise: 13,
    constraints: [aversion('gbr-state-control', 'Réserve envers l’intervention économique directe', 'preference', ['state_control'], 14, 62)],
  },
  RUS: {
    weights: { growth: 72, price_stability: 52, fiscal_sustainability: 58, strategic_autonomy: 98, alliance_cohesion: 36, social_cohesion: 68, regime_survival: 96, elite_support: 91, international_prestige: 94 },
    riskTolerance: 68, adaptability: 58, satisficingThreshold: -14, choiceNoise: 19,
    constraints: [
      aversion('rus-political-opening', 'Préserver le contrôle politique central', 'taboo', ['political_opening'], 52, 92),
      aversion('rus-elite-displacement', 'Ne pas retourner brutalement la coalition dirigeante', 'red_line', ['elite_displacement'], 100, 98),
      aversion('rus-dependence', 'Refus d’une dépendance stratégique occidentale', 'taboo', ['rival_dependency'], 48, 88),
    ],
  },
  CHN: {
    weights: { growth: 97, employment: 88, price_stability: 82, strategic_autonomy: 100, alliance_cohesion: 34, social_cohesion: 92, regime_survival: 100, elite_support: 88, international_prestige: 90 },
    riskTolerance: 57, adaptability: 74, satisficingThreshold: -8, choiceNoise: 8,
    constraints: [
      aversion('chn-foreign-dependence', 'Réduire toute dépendance stratégique durable', 'taboo', ['foreign_dependency'], 46, 82),
      aversion('chn-political-opening', 'Maintenir le monopole politique du Parti', 'red_line', ['political_opening'], 100, 100),
      aversion('chn-elite-displacement', 'Préserver la coalition du Parti-État', 'red_line', ['elite_displacement'], 100, 100),
    ],
  },
  NOR: {
    weights: { price_stability: 82, fiscal_sustainability: 96, strategic_autonomy: 72, alliance_cohesion: 82, social_cohesion: 94, redistribution: 82 },
    riskTolerance: 38, adaptability: 66, satisficingThreshold: -3, choiceNoise: 6,
    constraints: [aversion('nor-deficit', 'Préserver les revenus énergétiques pour le long terme', 'taboo', ['deficit_spending'], 36, 80)],
  },
  DZA: {
    weights: { growth: 76, employment: 82, price_stability: 58, strategic_autonomy: 86, social_cohesion: 84, regime_survival: 94, elite_support: 88 },
    riskTolerance: 54, adaptability: 52, satisficingThreshold: -15, choiceNoise: 17,
    constraints: [
      aversion('dza-opening', 'Éviter une ouverture déstabilisant le régime', 'taboo', ['political_opening'], 48, 90),
      aversion('dza-elites', 'Préserver les équilibres de la coalition dirigeante', 'red_line', ['elite_displacement'], 100, 97),
    ],
  },
  LBY: {
    weights: { fiscal_sustainability: 38, strategic_autonomy: 96, alliance_cohesion: 28, social_cohesion: 72, regime_survival: 100, elite_support: 94, international_prestige: 88 },
    riskTolerance: 75, adaptability: 44, satisficingThreshold: -20, choiceNoise: 24,
    constraints: [
      aversion('lby-opening', 'Préserver le système révolutionnaire', 'red_line', ['political_opening'], 100, 99),
      aversion('lby-elites', 'Ne pas menacer les réseaux sécuritaires', 'red_line', ['elite_displacement'], 100, 100),
    ],
  },
  SAU: {
    weights: { fiscal_sustainability: 68, strategic_autonomy: 88, alliance_cohesion: 78, social_cohesion: 74, redistribution: 42, regime_survival: 100, elite_support: 100, international_prestige: 86 },
    riskTolerance: 53, adaptability: 60, satisficingThreshold: -13, choiceNoise: 12,
    constraints: [
      aversion('sau-opening', 'Préserver la monarchie absolue', 'red_line', ['political_opening'], 100, 100),
      aversion('sau-elites', 'Préserver la coalition dynastique', 'red_line', ['elite_displacement'], 100, 100),
    ],
  },
  BRA: {
    weights: { growth: 90, price_stability: 94, fiscal_sustainability: 90, social_cohesion: 78, international_prestige: 76 },
    riskTolerance: 45, adaptability: 68, satisficingThreshold: -8, choiceNoise: 14,
    constraints: [aversion('bra-monetary-stability', 'Éviter une nouvelle rupture de crédibilité monétaire', 'taboo', ['monetary_financing'], 46, 84)],
  },
  ZAF: {
    weights: { employment: 94, social_cohesion: 98, redistribution: 86, international_prestige: 74, regime_survival: 82 },
    riskTolerance: 44, adaptability: 62, satisficingThreshold: -9, choiceNoise: 13,
    constraints: [aversion('zaf-social-fracture', 'Éviter toute politique aggravant brutalement les fractures sociales', 'taboo', ['labor_deregulation'], 34, 78)],
  },
  AUS: {
    weights: { growth: 86, fiscal_sustainability: 88, alliance_cohesion: 94, strategic_autonomy: 68, international_prestige: 78 },
    riskTolerance: 50, adaptability: 72, satisficingThreshold: -8, choiceNoise: 10,
    constraints: [aversion('aus-alliance-break', 'Préserver l’ancrage de sécurité américain', 'taboo', ['alliance_breach'], 42, 86)],
  },
  IND: {
    weights: { growth: 94, employment: 94, strategic_autonomy: 100, regime_survival: 84, international_prestige: 90 },
    riskTolerance: 62, adaptability: 67, satisficingThreshold: -11, choiceNoise: 16,
    constraints: [
      aversion('ind-nuclear-autonomy', 'Préserver l’autonomie de la dissuasion indienne', 'red_line', ['foreign_dependency'], 100, 96),
      aversion('ind-territorial-integrity', 'Refus de toute concession sur l’intégrité territoriale', 'red_line', ['elite_displacement'], 76, 94),
    ],
  },
  JPN: {
    weights: { growth: 92, price_stability: 88, fiscal_sustainability: 82, alliance_cohesion: 96, social_cohesion: 82 },
    riskTolerance: 32, adaptability: 54, satisficingThreshold: -4, choiceNoise: 8,
    constraints: [aversion('jpn-alliance-break', 'Préserver la garantie de sécurité américaine', 'red_line', ['alliance_breach'], 100, 96)],
  },
  TUR: {
    weights: { growth: 90, price_stability: 98, regime_survival: 92, strategic_autonomy: 92, alliance_cohesion: 70 },
    riskTolerance: 62, adaptability: 52, satisficingThreshold: -14, choiceNoise: 19,
    constraints: [
      aversion('tur-territorial-integrity', 'Refus de toute fragmentation territoriale', 'red_line', ['elite_displacement'], 100, 100),
      aversion('tur-nato-isolation', 'Éviter l’isolement stratégique occidental', 'taboo', ['alliance_breach'], 48, 88),
    ],
  },
  VNM: {
    weights: { growth: 94, employment: 90, strategic_autonomy: 98, regime_survival: 100, social_cohesion: 86 },
    riskTolerance: 48, adaptability: 68, satisficingThreshold: -12, choiceNoise: 14,
    constraints: [
      aversion('vnm-party-control', 'Préserver le monopole politique du Parti', 'red_line', ['political_opening'], 100, 100),
      aversion('vnm-sovereignty', 'Refus de toute atteinte à la souveraineté maritime', 'red_line', ['rival_dependency'], 86, 94),
    ],
  },
};

export function createDecisionProfiles2000(countries: Record<CountryId, CountryState>): Record<CountryId, CountryDecisionProfile> {
  return Object.fromEntries(Object.keys(countries).map((countryId) => {
    const override = overrides[countryId] ?? {
      weights: {}, riskTolerance: 50, adaptability: 60, satisficingThreshold: -10, choiceNoise: 12, constraints: [],
    };
    return [countryId, {
      countryId, criterionWeights: { ...baseWeights, ...override.weights },
      riskTolerance: override.riskTolerance, adaptability: override.adaptability,
      satisficingThreshold: override.satisficingThreshold, choiceNoise: override.choiceNoise,
      constraints: override.constraints,
      source: 'Profil décisionnel ORDO — situation politique et institutionnelle au 1er janvier 2000.',
    } satisfies CountryDecisionProfile];
  }));
}
