import type {
  CapacityDomainId, CommonActionCategory, CommonActionLever, DecisionCriterion,
  DecisionSignal, GovernmentDoctrine, PolicySignal, PoliticalActionProfile,
} from './types';

export type ActionLeverProfile = {
  lever: CommonActionLever;
  category: CommonActionCategory;
  label: string;
  durationMonths: number;
  budgetCost: number;
  difficultyModifier: number;
  requiredCapacities: Array<{ domain: CapacityDomainId; commitment: number }>;
};

export type ActionLeverPolitics = {
  doctrine: Partial<GovernmentDoctrine>;
  outcomes: Partial<Record<DecisionCriterion, number>>;
  decisionSignals: DecisionSignal[];
  policySignals: Array<{ signal: PolicySignal; weight: number }>;
  requiredAuthority: PoliticalActionProfile['requiredAuthority'];
  publicSalience: number;
  administrativeComplexity: number;
  urgency: number;
  risk: number;
};

const profile = (
  lever: CommonActionLever,
  category: CommonActionCategory,
  label: string,
  durationMonths: number,
  budgetCost: number,
  difficultyModifier: number,
  requiredCapacities: ActionLeverProfile['requiredCapacities'],
): ActionLeverProfile => ({ lever, category, label, durationMonths, budgetCost, difficultyModifier, requiredCapacities });

export const actionLeverProfiles: Record<CommonActionLever, ActionLeverProfile> = {
  diplomatic_contact: profile('diplomatic_contact', 'diplomacy', 'Ouverture d’un canal diplomatique', 1, 0.4, 6, [{ domain: 'diplomacy', commitment: 3 }, { domain: 'government', commitment: 1 }]),
  diplomatic_cooperation: profile('diplomatic_cooperation', 'diplomacy', 'Accord de coopération', 3, 1.2, -2, [{ domain: 'diplomacy', commitment: 6 }, { domain: 'government', commitment: 3 }]),
  defense_pact: profile('defense_pact', 'diplomacy', 'Négociation d’un pacte de défense', 6, 2.4, -12, [{ domain: 'diplomacy', commitment: 9 }, { domain: 'defense', commitment: 5 }, { domain: 'government', commitment: 5 }]),
  mediation: profile('mediation', 'diplomacy', 'Médiation internationale', 4, 1.4, -7, [{ domain: 'diplomacy', commitment: 8 }, { domain: 'government', commitment: 4 }]),
  information_sharing: profile('information_sharing', 'diplomacy', 'Partage institutionnel d’informations', 3, 1.1, -4, [{ domain: 'diplomacy', commitment: 5 }, { domain: 'intelligence', commitment: 5 }]),

  fiscal_stimulus: profile('fiscal_stimulus', 'economic', 'Relance budgétaire', 6, 8, 0, [{ domain: 'economy', commitment: 8 }, { domain: 'administration', commitment: 5 }, { domain: 'government', commitment: 4 }]),
  fiscal_consolidation: profile('fiscal_consolidation', 'economic', 'Consolidation budgétaire', 9, 2, -4, [{ domain: 'economy', commitment: 7 }, { domain: 'administration', commitment: 6 }, { domain: 'government', commitment: 6 }]),
  industrial_capacity: profile('industrial_capacity', 'economic', 'Programme de capacité industrielle', 18, 10, -8, [{ domain: 'economy', commitment: 10 }, { domain: 'administration', commitment: 7 }, { domain: 'government', commitment: 4 }]),
  strategic_sector: profile('strategic_sector', 'economic', 'Programme de filière stratégique', 24, 14, -11, [{ domain: 'economy', commitment: 12 }, { domain: 'administration', commitment: 8 }, { domain: 'government', commitment: 4 }]),
  trade_promotion: profile('trade_promotion', 'economic', 'Soutien aux exportations', 4, 1.5, 1, [{ domain: 'economy', commitment: 5 }, { domain: 'diplomacy', commitment: 4 }, { domain: 'administration', commitment: 2 }]),
  energy_resilience: profile('energy_resilience', 'economic', 'Programme de résilience énergétique', 12, 7, -6, [{ domain: 'economy', commitment: 8 }, { domain: 'administration', commitment: 6 }, { domain: 'diplomacy', commitment: 3 }]),
  economic_general: profile('economic_general', 'economic', 'Programme économique général', 6, 3.5, -2, [{ domain: 'economy', commitment: 7 }, { domain: 'administration', commitment: 4 }, { domain: 'government', commitment: 2 }]),

  administrative_reform: profile('administrative_reform', 'institutional', 'Modernisation administrative', 12, 6, -6, [{ domain: 'administration', commitment: 9 }, { domain: 'government', commitment: 5 }, { domain: 'economy', commitment: 2 }]),
  government_reorganization: profile('government_reorganization', 'institutional', 'Réorganisation gouvernementale', 8, 4.5, -4, [{ domain: 'administration', commitment: 7 }, { domain: 'government', commitment: 8 }]),
  anti_corruption: profile('anti_corruption', 'institutional', 'Renforcement de l’intégrité publique', 12, 5, -9, [{ domain: 'administration', commitment: 10 }, { domain: 'government', commitment: 7 }, { domain: 'intelligence', commitment: 2 }]),
  national_reform: profile('national_reform', 'institutional', 'Réforme nationale', 12, 4, -8, [{ domain: 'government', commitment: 8 }, { domain: 'administration', commitment: 9 }, { domain: 'diplomacy', commitment: 1 }]),

  force_readiness: profile('force_readiness', 'defense', 'Préparation et entraînement des forces', 9, 6, -3, [{ domain: 'defense', commitment: 9 }, { domain: 'administration', commitment: 3 }, { domain: 'government', commitment: 2 }]),
  defense_procurement: profile('defense_procurement', 'defense', 'Acquisition d’équipements militaires', 24, 12, -9, [{ domain: 'defense', commitment: 10 }, { domain: 'administration', commitment: 6 }, { domain: 'economy', commitment: 4 }]),
  force_deployment: profile('force_deployment', 'defense', 'Déploiement de forces', 2, 5, -10, [{ domain: 'defense', commitment: 13 }, { domain: 'diplomacy', commitment: 5 }, { domain: 'government', commitment: 5 }]),
  defense_industry: profile('defense_industry', 'defense', 'Renforcement de l’industrie de défense', 24, 14, -11, [{ domain: 'defense', commitment: 8 }, { domain: 'economy', commitment: 10 }, { domain: 'administration', commitment: 7 }]),

  intelligence_assessment: profile('intelligence_assessment', 'intelligence', 'Évaluation de renseignement', 2, 1.2, 3, [{ domain: 'intelligence', commitment: 5 }, { domain: 'diplomacy', commitment: 1 }]),
  intelligence_surveillance: profile('intelligence_surveillance', 'intelligence', 'Opération de surveillance ciblée', 5, 2.8, -7, [{ domain: 'intelligence', commitment: 9 }, { domain: 'diplomacy', commitment: 2 }]),
};

const politics = (
  doctrine: ActionLeverPolitics['doctrine'],
  outcomes: ActionLeverPolitics['outcomes'],
  decisionSignals: DecisionSignal[],
  policySignals: ActionLeverPolitics['policySignals'],
  requiredAuthority: ActionLeverPolitics['requiredAuthority'],
  publicSalience: number,
  administrativeComplexity: number,
  urgency: number,
  risk: number,
): ActionLeverPolitics => ({ doctrine, outcomes, decisionSignals, policySignals, requiredAuthority, publicSalience, administrativeComplexity, urgency, risk });

export const actionLeverPolitics: Record<CommonActionLever, ActionLeverPolitics> = {
  diplomatic_contact: politics({}, { alliance_cohesion: 15, international_prestige: 8 }, ['commercial_deal'], [], 'executive', 15, 20, 25, 12),
  diplomatic_cooperation: politics({ sovereignty: 10 }, { growth: 18, alliance_cohesion: 45, international_prestige: 25 }, ['alliance_cooperation', 'commercial_deal'], [], 'executive', 35, 42, 35, 24),
  defense_pact: politics({ security: 55, sovereignty: 10 }, { strategic_autonomy: -10, alliance_cohesion: 80, international_prestige: 32 }, ['alliance_cooperation'], [], 'legislative', 72, 58, 48, 55),
  mediation: politics({ social: 15 }, { alliance_cohesion: 30, international_prestige: 65 }, ['alliance_cooperation'], [], 'executive', 52, 60, 65, 38),
  information_sharing: politics({ security: 40 }, { alliance_cohesion: 42, strategic_autonomy: 15 }, ['alliance_cooperation'], [], 'executive', 28, 54, 45, 34),
  fiscal_stimulus: politics({ economic: -25, social: 15 }, { growth: 68, employment: 58, fiscal_sustainability: -62, social_cohesion: 20 }, ['deficit_spending', 'state_control'], [{ signal: 'public_industrial_investment', weight: 0.65 }], 'legislative', 78, 68, 62, 48),
  fiscal_consolidation: politics({ economic: 28, social: -15 }, { growth: -28, employment: -35, price_stability: 25, fiscal_sustainability: 76, social_cohesion: -52 }, ['austerity', 'market_liberalization'], [{ signal: 'austerity', weight: 1 }], 'legislative', 88, 62, 55, 54),
  industrial_capacity: politics({ economic: -12, sovereignty: 30 }, { growth: 55, employment: 48, fiscal_sustainability: -24, strategic_autonomy: 62 }, ['state_control', 'strategic_autonomy', 'deficit_spending'], [{ signal: 'public_industrial_investment', weight: 1 }], 'legislative', 66, 76, 50, 42),
  strategic_sector: politics({ economic: -15, sovereignty: 45 }, { growth: 48, employment: 36, fiscal_sustainability: -30, strategic_autonomy: 82 }, ['state_control', 'strategic_autonomy', 'deficit_spending'], [{ signal: 'public_industrial_investment', weight: 1 }], 'legislative', 62, 84, 58, 48),
  trade_promotion: politics({ economic: 22 }, { growth: 42, employment: 28, alliance_cohesion: 18, international_prestige: 15 }, ['commercial_deal', 'market_liberalization'], [], 'administrative', 28, 42, 46, 18),
  energy_resilience: politics({ sovereignty: 38 }, { growth: 12, fiscal_sustainability: -18, strategic_autonomy: 72 }, ['strategic_autonomy', 'state_control'], [], 'legislative', 58, 78, 68, 38),
  economic_general: politics({}, { growth: 28, employment: 18, fiscal_sustainability: -12 }, ['deficit_spending'], [], 'legislative', 48, 58, 45, 30),
  administrative_reform: politics({ economic: 8 }, { growth: 18, fiscal_sustainability: 28, regime_survival: 18 }, ['market_liberalization'], [{ signal: 'administrative_reorganization', weight: 1 }], 'legislative', 58, 82, 42, 36),
  government_reorganization: politics({}, { regime_survival: 30, elite_support: -15 }, ['elite_displacement'], [{ signal: 'administrative_reorganization', weight: 1 }], 'executive', 64, 68, 58, 44),
  anti_corruption: politics({ social: 18 }, { fiscal_sustainability: 35, regime_survival: 12, elite_support: -55, social_cohesion: 38 }, ['elite_displacement', 'political_opening'], [{ signal: 'administrative_reorganization', weight: 0.8 }], 'legislative', 82, 86, 72, 58),
  national_reform: politics({ social: 16 }, { regime_survival: 18, social_cohesion: 28, elite_support: -12 }, ['political_opening'], [{ signal: 'administrative_reorganization', weight: 0.35 }], 'legislative', 76, 78, 58, 52),
  force_readiness: politics({ security: 48 }, { strategic_autonomy: 38, fiscal_sustainability: -18, international_prestige: 18 }, ['military_escalation', 'deficit_spending'], [], 'executive', 38, 62, 48, 32),
  defense_procurement: politics({ security: 58 }, { strategic_autonomy: 48, fiscal_sustainability: -38, international_prestige: 22 }, ['military_escalation', 'deficit_spending'], [{ signal: 'public_industrial_investment', weight: 0.45 }], 'legislative', 62, 78, 52, 42),
  force_deployment: politics({ security: 72 }, { strategic_autonomy: 28, alliance_cohesion: 30, social_cohesion: -25, international_prestige: 45 }, ['military_escalation', 'alliance_cooperation'], [], 'executive', 84, 66, 82, 78),
  defense_industry: politics({ economic: -8, security: 55, sovereignty: 45 }, { growth: 28, employment: 32, fiscal_sustainability: -35, strategic_autonomy: 78 }, ['state_control', 'strategic_autonomy', 'deficit_spending'], [{ signal: 'public_industrial_investment', weight: 0.75 }], 'legislative', 58, 86, 48, 46),
  intelligence_assessment: politics({ security: 28 }, { strategic_autonomy: 18, regime_survival: 12 }, [], [], 'administrative', 8, 38, 55, 18),
  intelligence_surveillance: politics({ security: 58 }, { strategic_autonomy: 28, regime_survival: 22, alliance_cohesion: -12 }, [], [], 'executive', 18, 62, 68, 58),
};

const normalize = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

export function inferActionLever(category: CommonActionCategory, text: string): CommonActionLever {
  const value = normalize(text);
  if (category === 'diplomacy') {
    if (/\b(pacte? de defense|alliance defensive|garantie militaire|defense mutuelle)\b/.test(value)) return 'defense_pact';
    if (/\b(mediation|arbitrage|desescalade|cessez le feu)\b/.test(value)) return 'mediation';
    if (/\b(partage|echange)\b.*\b(information|renseignement|donnee)\b|\bcooperation de renseignement\b/.test(value)) return 'information_sharing';
    if (/\b(cooperation|partenariat|accord)\b/.test(value)) return 'diplomatic_cooperation';
    return 'diplomatic_contact';
  }
  if (category === 'economic') {
    if (/\b(austerite|consolidation|assainir|reduire|baisser|maitriser)\b.*\b(deficit|dette|depense)|\bequilibre budgetaire\b/.test(value)) return 'fiscal_consolidation';
    if (/\b(relance|stimulus|soutenir la demande|commande publique)\b/.test(value)) return 'fiscal_stimulus';
    if (/\bexport|\bprospection commerciale|\bsoutien commercial|\bvendre a l etranger/.test(value)) return 'trade_promotion';
    if (/\b(reserve strategique|stockage|securite energetique|resilience energetique|diversifier).*(gaz|petrole|energie)|\b(gaz|petrole|energie).*(reserve|stockage|resilience)\b/.test(value)) return 'energy_resilience';
    if (/\b(semi conduct|puce|electron|nucleaire|engrais|acier|pharma|chantier naval|telecom|machine outil|armement|filiere strategique)\b/.test(value)) return 'strategic_sector';
    if (/\b(reindustr|industrie|industriel|capacite de production|usine|filiere)\b/.test(value)) return 'industrial_capacity';
    return 'economic_general';
  }
  if (category === 'institutional') {
    if (/\b(corruption|integrite|transparence|conflit d interet)\b/.test(value)) return 'anti_corruption';
    if (/\b(reforme|relig\w*|laic\w*|confession\w*|immigr\w*|migrat\w*|asile|naturalisation|integration|societ\w*|famille|ordre public|droits civils|egalite)\b/.test(value)) return 'national_reform';
    if (/\b(ministere|sous ministere|secretariat d etat|gouvernement|cabinet)\b/.test(value)) return 'government_reorganization';
    return 'administrative_reform';
  }
  if (category === 'defense') {
    if (/\b(deploi|stationner|projeter|troupes?|forces?)\b/.test(value)) return 'force_deployment';
    if (/\b(industrie|usine|production|capacite)\b.*\b(arme|armement|militaire|defense)\b|\barmement\b.*\b(industrie|production)\b/.test(value)) return 'defense_industry';
    if (/\b(acheter|acquerir|commande|equipement|moderniser|remplacer)\b/.test(value)) return 'defense_procurement';
    return 'force_readiness';
  }
  if (/\b(surveill|infiltr|intercept|espion|ecoute)\b/.test(value)) return 'intelligence_surveillance';
  return 'intelligence_assessment';
}

export function actionLeverProfile(category: CommonActionCategory, text: string): ActionLeverProfile {
  const selected = actionLeverProfiles[inferActionLever(category, text)];
  // Défense en profondeur contre une incohérence future du dictionnaire.
  if (selected.category !== category) throw new Error(`Le levier ${selected.lever} n'appartient pas au domaine ${category}.`);
  return selected;
}
