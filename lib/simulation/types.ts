import type { TerritorialState } from './territory-types';

export type ISODate = `${number}-${number}-${number}`;
export type CountryId = string;
export type EntityId = string;

export type CapacityDomainId =
  | 'government'
  | 'administration'
  | 'diplomacy'
  | 'economy'
  | 'intelligence'
  | 'defense';

export type CapacityState = Record<CapacityDomainId, { maximum: number; committed: number }>;

export type WorldMetric = 'budget' | 'industry' | 'stability' | 'security';
export type ActionOrigin = 'player' | 'local_rule' | 'ai' | 'historical' | 'time';
export type Visibility = 'public' | 'player' | 'secret' | 'debug';

export type GovernmentDoctrine = {
  economic: number;
  social: number;
  sovereignty: number;
  security: number;
};

/** Domaines de réforme nationale : une posture interne, pas une jauge de "capital politique". */
export type NationalReformDomain = 'religion' | 'immigration' | 'societal';
export type NationalReformOutcome = 'adopted' | 'partial' | 'stalled' | 'reversed';

/**
 * État synthétique d'une politique nationale. `position` reste interne au moteur
 * (0 = plus traditionnel/restrictif, 100 = plus sécularisé/ouvert/libéral selon
 * le domaine) ; l'interface l'affiche sous forme de libellés qualitatifs.
 */
export type NationalReformState = {
  countryId: CountryId;
  domain: NationalReformDomain;
  position: number;
  institutionalAnchor: number;
  publicSalience: number;
  polarization: number;
  implementationCapacity: number;
  administrativeBurden: number;
  reformCount: number;
  activeProgramId?: string | null;
  lastOutcome?: NationalReformOutcome;
  lastChangedAt: ISODate;
};

export type PoliticalSystem = {
  regime: string;
  executive: string;
  headOfGovernment: string;
  governmentLabel: string;
  legislatureSeats: number;
  governingSeats: number;
  publicApproval: number;
  administrativeCompliance: number;
  doctrine: GovernmentDoctrine;
};

export type StrategicGoal = {
  id: string;
  label: string;
  priority: number;
  progress: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
};

export type CountryStrategy = {
  goals: StrategicGoal[];
  vulnerabilities: string[];
  redLines: string[];
  partners: CountryId[];
  rivals: CountryId[];
  lastReviewDate: ISODate;
};

export type LeadershipTraitProfile = {
  riskAppetite: number;
  belligerence: number;
  flexibility: number;
  transactionality: number;
  patience: number;
  ideologicalCommitment: number;
  reliability: number;
};

export type LeadershipFigure = {
  id: string;
  name: string;
  role: string;
  authorityShare: number;
  ideologyTags: string[];
  traits: LeadershipTraitProfile;
};

/** Les détenteurs effectifs de l'autorité, y compris en cohabitation ou direction collective. */
export type CountryLeadership = {
  countryId: CountryId;
  figures: LeadershipFigure[];
  executiveCoordination: number;
  sourceBasis: string;
};

export type PoliticalCycleMode =
  | 'competitive_election'
  | 'managed_election'
  | 'party_congress'
  | 'dynastic_succession'
  | 'institutional_review';

export type PoliticalCampaignStrategy =
  | 'govern_record'
  | 'majority_mobilization'
  | 'institutional_neutrality';

/**
 * Calendrier institutionnel minimal. Il décrit quand le pouvoir doit être
 * réévalué, sans pré-écrire le vainqueur historique ni conserver éternellement
 * le dirigeant du scénario 2000.
 */
export type PoliticalCycle = {
  countryId: CountryId;
  mode: PoliticalCycleMode;
  intervalMonths: number;
  warningMonths: number;
  nextReviewDate: ISODate;
  lastReviewDate?: ISODate;
  cycleNumber: number;
  status: 'scheduled' | 'campaign';
  dossierId?: string | null;
  /** Posture choisie par le joueur : elle influe sur le rapport de force sans désigner le vainqueur. */
  campaignStrategy?: PoliticalCampaignStrategy | null;
  campaignSupportModifier?: number;
  transitionStabilityModifier?: number;
  campaignChosenAt?: ISODate | null;
  lastOutcome?: 'renewal' | 'alternation' | 'succession' | 'continuity';
  lastSupportScore?: number;
};

export type ApparatusCurrent = {
  id: string;
  label: string;
  weight: number;
  institutionalReach: number;
  supportedSignals: DecisionSignal[];
  opposedSignals: DecisionSignal[];
  criterionPreferences: Partial<Record<DecisionCriterion, number>>;
};

/** Lignes idéologiques durables de l'administration, du parlement et des élites organisées. */
export type PoliticalApparatusProfile = {
  countryId: CountryId;
  currents: ApparatusCurrent[];
  pluralism: number;
  inertia: number;
  sourceBasis: string;
};

export type CountryState = {
  id: CountryId;
  name: string;
  flag: string;
  weight: number;
  statisticalReliability: number;
  metrics: Record<WorldMetric, number>;
  capacities: CapacityState;
  politics: PoliticalSystem;
  strategy: CountryStrategy;
};

export type BilateralRelation = {
  from: CountryId;
  to: CountryId;
  relation: number;
  trust: number;
  tradeIntensity: number;
  securityAlignment: number;
  memories: string[];
};

export type InformationNature = 'public' | 'estimated' | 'classified' | 'unknown';

export type KnownValue = {
  trueValue: number;
  publishedValue?: number;
  estimate?: { minimum: number; maximum: number };
  nature: InformationNature;
  confidence: number;
  updatedAt: ISODate;
  source: string;
  manipulationPossible: boolean;
};

export type InstitutionStage = 'proposal' | 'building' | 'partial' | 'operational';

export type InstitutionState = {
  id: string;
  countryId: CountryId;
  label: string;
  stage: InstitutionStage;
  progressMonths: number;
  durationMonths: number;
  startedAt?: ISODate;
};

export type TreatyState = {
  id: string;
  parties: CountryId[];
  label: string;
  status: 'draft' | 'pending' | 'active' | 'suspended' | 'expired';
  startDate?: ISODate;
  endDate?: ISODate;
  monthlyEffects: Array<{ countryId: CountryId; metric: WorldMetric; delta: number }>;
};

export type HistoricalCurrent = {
  id: string;
  name: string;
  startDate: ISODate;
  probableWindow: { start: ISODate; end: ISODate };
  pressure: number;
  inertia: number;
  driverRate: number;
  brakeRate: number;
  drivers: string[];
  brakes: string[];
  affectedActors: EntityId[];
  latentProcessIds: string[];
  possibleManifestations: string[];
  playerVisibility: 'hidden' | 'suspected' | 'known';
  status: 'dormant' | 'active' | 'resolved' | 'dissipated';
};

/**
 * Ancrage historique : un fait ou une fenêtre historique que le moteur doit
 * rendre plausible sans imposer sa manifestation exacte. La pression est
 * calculée localement ; l'IA peut ensuite proposer une manifestation bornée
 * et la rattacher au dossier correspondant.
 */
export type HistoricalInterventionDirection = 'contain' | 'redirect' | 'accelerate';
export type HistoricalInterventionOutcome = Extract<ActionProgramStatus, 'succeeded' | 'partially_succeeded' | 'failed'> | 'agreed' | 'refused' | 'silent';

export type HistoricalIntervention = {
  programId: string;
  date: ISODate;
  direction: HistoricalInterventionDirection;
  outcome: HistoricalInterventionOutcome;
  pressureDelta: number;
  summary: string;
};

export type HistoricalDivergence = {
  kind: 'contained' | 'redirected' | 'accelerated';
  date: ISODate;
  programId: string;
  summary: string;
};

export type HistoricalAnchor = {
  id: string;
  title: string;
  trendTitle: string;
  trendSummary: string;
  kind: DossierKind;
  importance: DossierImportance;
  trendId?: string;
  probableWindow: { start: ISODate; end: ISODate };
  proposalThreshold: number;
  activationThreshold: number;
  basePressure: number;
  historicalWeight: number;
  affectedActors: EntityId[];
  regionTags: string[];
  invariants: string[];
  possibleManifestations: string[];
  playerVisibility: 'hidden' | 'suspected' | 'known';
  playerInfluence: 'none' | 'low' | 'medium' | 'high';
  status: 'dormant' | 'proposed' | 'active' | 'manifested' | 'disrupted' | 'expired';
  pressure: number;
  dossierId?: string;
  lastEvaluatedAt?: ISODate;
  proposedAt?: ISODate;
  activatedAt?: ISODate;
  manifestedAt?: ISODate;
  manifestation?: string;
  /** Effet cumulé des programmes explicitement rattachés à ce dossier. */
  interventionBalance?: number;
  lastIntervention?: HistoricalIntervention;
  /** Trace durable d’une bifurcation, sans prétendre reconstituer une autre histoire complète. */
  divergence?: HistoricalDivergence;
};

export type LatentProcess = {
  id: string;
  currentId: string;
  actorId: EntityId;
  objective: string;
  progress: number;
  capability: number;
  secrecy: number;
  window: { start: ISODate; end: ISODate };
  possibleOutcomes: string[];
  status: 'preparing' | 'ready' | 'manifested' | 'disrupted' | 'abandoned';
};

export type EnergyResource = 'oil' | 'gas';

export type EnergyNode = {
  id: string;
  countryId: CountryId;
  resource: EnergyResource;
  label: string;
  provenReserves: number;
  probableReserves: number;
  annualProduction: number;
  annualCapacity: number;
  domesticConsumption: number;
  storageCapacity: number;
  stocks: number;
  extractionCost: number;
  declineRate: number;
  developmentLeadMonths: number;
  infrastructure: string[];
};

export type EnergyContract = {
  id: string;
  sellerId: CountryId;
  buyerId: CountryId;
  nodeId: string;
  resource: EnergyResource;
  annualVolume: number;
  startDate: ISODate;
  endDate: ISODate;
  priceFormula: string;
  route: string;
  priority: number;
  politicalClauses: string[];
  breachPenalty: number;
  status: 'proposed' | 'active' | 'suspended' | 'expired' | 'broken';
};

/** Flux présents au lancement : ils donnent une origine finie aux importations déjà existantes. */
export type BaselineEnergyFlow = {
  id: string;
  buyerId: CountryId;
  resource: EnergyResource;
  annualVolume: number;
  startDate: ISODate;
  endDate: ISODate;
  route: string;
  /** Un nœud modélisé est physiquement débité ; une source externe reste fermée à la négociation. */
  sourceNodeId?: string;
  externalSourceLabel?: string;
};

export type DiplomaticEnergyTerms = {
  resource: EnergyResource;
  nodeId: string;
  annualVolume: number;
  coverageShare: number;
  durationYears: number;
  startDate: ISODate;
  endDate: ISODate;
  priceSummary: string;
  route: string;
  politicalClauses: string[];
};

export type DiplomaticTurn = {
  id: string;
  date: ISODate;
  speakerId: EntityId;
  kind: 'proposal' | 'counterproposal' | 'acceptance' | 'refusal' | 'signature' | 'message';
  publicMessage: string;
  proposalRevision?: number;
};

/** Position structurée affichée après une réponse IA dans un dialogue politique libre. */
export type DiplomaticDialogueResponse = {
  kind: 'accept' | 'counter' | 'refuse' | 'request_clarification' | 'message';
  agreementType: 'industrial_cooperation' | 'information_sharing' | 'security_cooperation' | 'political_guarantee' | 'mediation' | 'defense_cooperation';
  position: string;
  concessions: string[];
  guaranteesRequested: string[];
  conditions: string[];
  redLines: string[];
  timeline: string;
};

export type DiplomaticDialogueResolution = {
  status: 'accepted' | 'refused' | 'revision_requested' | 'acknowledged';
  decidedAt: ISODate;
  summary: string;
};

export type DiplomaticSession = {
  id: string;
  kind: 'energy_contract';
  initiatorId: CountryId;
  counterpartId: CountryId;
  participantIds: EntityId[];
  status: 'awaiting_response' | 'countered' | 'awaiting_signature' | 'active' | 'refused' | 'closed';
  aiMode: 'local' | 'ai';
  openedAt: ISODate;
  updatedAt: ISODate;
  terms: DiplomaticEnergyTerms;
  turns: DiplomaticTurn[];
  privatePosition: {
    ownerCountryId: CountryId;
    willingness: number;
    motivations: string[];
    objections: string[];
    redLines: string[];
  };
  linkedDossierId: string;
  linkedContractId?: string;
};

/** Dialogue politique libre, distinct d’une négociation énergétique chiffrée. */
export type DiplomaticDialogue = {
  id: string;
  kind: 'bilateral_dialogue' | 'multilateral_dialogue';
  initiatorId: CountryId;
  participantIds: CountryId[];
  activeSpeakerId: CountryId;
  status: 'awaiting_player' | 'awaiting_ai' | 'closed';
  aiMode: 'local' | 'ai';
  openedAt: ISODate;
  updatedAt: ISODate;
  turns: DiplomaticTurn[];
  lastResponse?: DiplomaticDialogueResponse;
  resolution?: DiplomaticDialogueResolution;
  linkedDossierId?: string;
};

export type CountryEnergyState = {
  countryId: CountryId;
  annualDemand: Record<EnergyResource, number>;
  domesticProduction: Record<EnergyResource, number>;
  legacyImports: Record<EnergyResource, number>;
  strategicStocks: Record<EnergyResource, number>;
  storageCapacity: Record<EnergyResource, number>;
  desiredCoverageMonths: Record<EnergyResource, number>;
};

export type MacroSource = {
  provider: string;
  observationYear: number;
  indicatorCodes: string[];
  estimatedIndicatorCodes?: string[];
  confidence: number;
};

export type EconomicProductFamily =
  | 'food'
  | 'energy'
  | 'raw_materials'
  | 'industrial_inputs'
  | 'manufactured_goods'
  | 'strategic_technology';

export type ProductFamilyState = {
  productionIndex: number;
  capacityIndex: number;
  demandIndex: number;
  inventoryMonths: number;
  importDependencyPct: number;
  exportOrientationPct: number;
  domesticPriceIndex: number;
};

export type AggregateSectorId =
  | 'agriculture'
  | 'extractive'
  | 'manufacturing'
  | 'construction'
  | 'market_services'
  | 'public_services';

export type AggregateSectorState = {
  valueAddedSharePct: number;
  capacityIndex: number;
  utilizationPct: number;
  productivityIndex: number;
  employmentSharePct: number;
};

export type EconomicPolicyState = {
  fiscalStance: number;
  publicInvestmentPctGdp: number;
  socialProtection: number;
  industrialSupport: number;
  tradeOpenness: number;
  capitalControls: number;
  laborFlexibility: number;
};

export type EconomicShockChannel = 'demand' | 'supply' | 'financial' | 'trade' | 'energy' | 'confidence';

export type EconomicShock = {
  id: string;
  label: string;
  channel: EconomicShockChannel;
  intensity: number;
  remainingMonths: number;
  decayPerMonth: number;
  affectedCountryIds: CountryId[];
  productFamily?: EconomicProductFamily;
  source: 'historical' | 'player' | 'local_rule' | 'ai';
};

/**
 * Lecture synthétique des conséquences qu'un dossier actif transmet au monde.
 * Le moteur conserve les valeurs continues ; cette couche expose seulement une
 * intensité lisible et bornée pour le joueur et le journal causal.
 */
export type DossierPressureChannel = EconomicShockChannel | 'security' | 'stability' | 'diplomacy';

export type DossierPressureSnapshot = {
  channel: DossierPressureChannel;
  /** Échelle de lecture 0–100, indépendante de l'unité interne du moteur. */
  level: number;
  label: string;
  summary: string;
  direction: 'pressure' | 'support';
};

export type DossierImpactState = {
  lastAppliedAt: ISODate;
  lastNotifiedAt?: ISODate;
  mitigationPct: number;
  pressures: DossierPressureSnapshot[];
};

export type SovereignDebtStatus =
  | 'stable'
  | 'watch'
  | 'stressed'
  | 'refinancing_crisis'
  | 'default'
  | 'restructuring';

export type SovereignDebtState = {
  effectiveInterestRatePct: number;
  sovereignSpreadBps: number;
  averageMaturityYears: number;
  annualMaturingDebtPctGdp: number;
  foreignHeldSharePct: number;
  foreignCurrencySharePct: number;
  /** Part de la dette libellée dans la monnaie contrôlée par l'État. */
  localCurrencySharePct: number;
  /** Part de l'encours à taux fixe ; elle retarde la transmission d'un choc de taux. */
  fixedRateSharePct: number;
  domesticBankExposurePctAssets: number;
  centralBankBackstop: number;
  /** Trésorerie immédiatement mobilisable, exprimée en mois de service de la dette. */
  cashBufferMonthsDebtService: number;
  /** Crédibilité perçue du prêteur en dernier ressort (0–100). */
  backstopCredibilityPct: number;
  /** Crédibilité budgétaire avant l'accès au marché (0–100). */
  fiscalCredibilityPct: number;
  marketAccess: number;
  refinancingNeedPctGdp: number;
  fundingGapPctGdp: number;
  debtServicePctRevenue: number;
  missedPaymentsPctGdp: number;
  monthsUnderStress: number;
  status: SovereignDebtStatus;
};

export type BankingSystemState = {
  capitalAdequacyPct: number;
  nonPerformingLoansPct: number;
  liquidityStress: number;
  sovereignExposureStress: number;
  creditAvailability: number;
};

export type DebtCrisisResponse =
  | 'emergency_austerity'
  | 'central_bank_backstop'
  | 'international_assistance'
  | 'capital_controls'
  | 'restructure';

export type WorldProductMarket = {
  family: EconomicProductFamily;
  priceIndex: number;
  demandIndex: number;
  supplyIndex: number;
  inventoryMonths: number;
  volatility: number;
};

export type BilateralTradeFlow = {
  id: string;
  exporterId: CountryId;
  importerId: CountryId;
  annualValueBillion2000Usd: number;
  productMix: Record<EconomicProductFamily, number>;
  friction: number;
  reliability: number;
};

export type MacroeconomicState = {
  countryId: CountryId;
  realGdpBillion2000Usd: number;
  potentialGdpBillion2000Usd: number;
  realGrowthAnnualPct: number;
  potentialGrowthAnnualPct: number;
  outputGapPct: number;
  populationMillions: number;
  populationGrowthAnnualPct: number;
  workingAgeSharePct: number;
  laborForceParticipationPct: number;
  dependencyRatioPct: number;
  netMigrationRatePerThousand: number;
  inflationAnnualPct: number;
  unemploymentPct: number;
  wageGrowthAnnualPct: number;
  investmentSharePctGdp: number;
  householdConsumptionSharePctGdp: number;
  governmentConsumptionSharePctGdp: number;
  domesticDemandGrowthAnnualPct: number;
  exportSharePctGdp: number;
  importSharePctGdp: number;
  tradeBalancePctGdp: number;
  currentAccountPctGdp: number;
  publicRevenuePctGdp: number;
  publicSpendingPctGdp: number;
  fiscalBalancePctGdp: number;
  publicDebtPctGdp: number;
  policyRatePct: number;
  creditGrowthAnnualPct: number;
  privateDebtPctGdp: number;
  financialStress: number;
  exchangeRateIndex: number;
  foreignReserveMonthsImports: number;
  industrySharePctGdp: number;
  productivityIndex: number;
  capitalStockIndex: number;
  humanCapitalIndex: number;
  confidenceIndex: number;
  sovereignDebt: SovereignDebtState;
  bankingSystem: BankingSystemState;
  policy: EconomicPolicyState;
  sectors: Record<AggregateSectorId, AggregateSectorState>;
  products: Record<EconomicProductFamily, ProductFamilyState>;
  source: MacroSource;
  lastUpdatedAt: ISODate;
};

export type WorldEconomyState = {
  globalGrowthAnnualPct: number;
  globalInflationAnnualPct: number;
  demandIndex: number;
  tradeVolumeIndex: number;
  financialStress: number;
  neutralInterestRatePct: number;
  productMarkets: Record<EconomicProductFamily, WorldProductMarket>;
  activeShocks: EconomicShock[];
  cycle: 'recession' | 'slowdown' | 'balanced' | 'expansion' | 'overheating';
  lastUpdatedAt: ISODate;
};

export type MonetaryRegime =
  | 'sovereign_floating'
  | 'sovereign_managed'
  | 'currency_union'
  | 'pegged';

export type WorkforceTrend = 'strong_growth' | 'growth' | 'stable' | 'decline' | 'strong_decline';

/** Données structurelles lentes dont les diagnostics sont dérivés. */
export type CountryStructuralProfile = {
  countryId: CountryId;
  industrialDepth: number;
  economicDiversification: number;
  innovationCapacity: number;
  infrastructureQuality: number;
  financialResilience: number;
  socialStabilizers: number;
  exportConcentration: number;
  resourceRentDependency: number;
  demographicPressure: number;
  productivityCatchUp: number;
  monetaryRegime: MonetaryRegime;
  workforceTrend: WorkforceTrend;
  source: {
    basis: string;
    observationYear: number;
    confidence: number;
    estimated: boolean;
  };
};

export type StructuralDiagnosis = {
  id: string;
  countryId: CountryId;
  category: 'strength' | 'vulnerability' | 'trend';
  title: string;
  summary: string;
  severity: number;
  direction: 'improving' | 'stable' | 'worsening';
  horizonYears: [number, number];
  reversibility: 'low' | 'medium' | 'high';
  causes: string[];
  possibleConsequences: string[];
  availableLevers: string[];
  confidence: number;
};

export type StakeholderCategory = 'military' | 'organized_labor' | 'capital' | 'administration' | 'civic';
export type StakeholderInfluenceChannel =
  | 'political_support'
  | 'economic_confidence'
  | 'policy_execution'
  | 'security_cohesion'
  | 'social_mobilization'
  | 'diplomatic_acceptance';
export type ReactionLevel = 'low' | 'moderate' | 'important' | 'critical';
export type ReactionTrend = 'falling' | 'stable' | 'rising' | 'rising_fast';
export type PolicySignal =
  | 'defense_cuts'
  | 'alliance_disengagement'
  | 'military_doctrine_break'
  | 'labor_deregulation'
  | 'capital_controls'
  | 'administrative_reorganization'
  | 'austerity'
  | 'public_industrial_investment'
  | 'tax_increase_high_incomes'
  | 'fossil_expansion';

export type StakeholderGroup = {
  id: string;
  countryId: CountryId;
  label: string;
  category: StakeholderCategory;
  influence: number;
  cohesion: number;
  baselineDefiance: number;
  sensitivities: Partial<Record<PolicySignal, number>>;
  influenceChannels: StakeholderInfluenceChannel[];
  possibleResponses: string[];
};

export type StakeholderReaction = {
  id: string;
  countryId: CountryId;
  groupId: string;
  targetId: EntityId;
  subjectId: string;
  label: string;
  defiance: number;
  mobilization: number;
  level: ReactionLevel;
  trend: ReactionTrend;
  causes: string[];
  likelyConsequences: string[];
  relatedMeasureIds: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
  decayPerMonth: number;
  status: 'active' | 'subsiding' | 'resolved';
  visibility: 'public' | 'internal' | 'secret';
};

export type GovernmentMeasure = {
  id: string;
  countryId: CountryId;
  title: string;
  subjectId: string;
  intensity: number;
  signals: Array<{ signal: PolicySignal; weight: number }>;
  effects: WorldEffect[];
};

export type PowerActorRole =
  | 'military_officer'
  | 'union_leader'
  | 'business_leader'
  | 'senior_official'
  | 'civic_figure';

export type PowerActorVisibility = 'unknown' | 'suspected' | 'identified' | 'public';

/** Un individu n'est matérialisé que lorsqu'une tendance institutionnelle a besoin d'un visage. */
export type EmergentPowerActor = {
  id: string;
  countryId: CountryId;
  stakeholderGroupId: string;
  name: string;
  role: PowerActorRole;
  position: string;
  fictionalAlternateHistory: boolean;
  ideologyTags: string[];
  personalityTags: string[];
  deepObjective: string;
  immediateObjective: string;
  influence: number;
  legitimacy: number;
  loyaltyToRegime: number;
  loyaltyToGovernment: number;
  riskTolerance: number;
  visibility: PowerActorVisibility;
  status: 'active' | 'removed' | 'retired' | 'detained' | 'deceased';
  campaignIds: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type PowerStruggleTactic =
  | 'private_lobbying'
  | 'administrative_obstruction'
  | 'public_criticism'
  | 'media_campaign'
  | 'organized_resignation'
  | 'social_mobilization'
  | 'strike'
  | 'investment_freeze'
  | 'capital_flight'
  | 'opposition_funding'
  | 'information_leak'
  | 'security_disobedience'
  | 'extra_constitutional_preparation'
  | 'negotiation'
  | 'deescalation';

export type PowerStruggleAIPlan = {
  revision: number;
  generatedAt: ISODate;
  strategy: string;
  immediateObjective: string;
  acceptableCompromise: string;
  personalRedLine: string;
  currentTactic: PowerStruggleTactic;
  publicMove: string;
  reassessmentTriggers: Array<
    'player_response' | 'pressure_shift' | 'government_crisis' | 'deadline' | 'external_shock'
  >;
  reviewAfterMonths: number;
};

export type PowerStruggleCampaign = {
  id: string;
  countryId: CountryId;
  subjectId: string;
  stakeholderReactionId: string;
  instigatorActorIds: string[];
  targetId: EntityId;
  dossierId: string;
  status: 'emerging' | 'active' | 'deescalating' | 'resolved';
  pressure: number;
  momentum: number;
  escalation: number;
  phase: string;
  deepObjective: string;
  aiPlan: PowerStruggleAIPlan;
  nextAIReviewAt: ISODate;
  lastAdvancedAt: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type PowerStruggleAIRequestPurpose =
  | 'materialize_actor'
  | 'reassess_campaign'
  | 'react_to_player';

/** Contexte volontairement compact : le LLM n'a jamais besoin de recevoir toute la sauvegarde. */
export type AIJobKind =
  | 'power_struggle'
  | 'diplomacy'
  | 'historical_interpretation'
  | 'advisor'
  | 'free_action_interpretation';

export type AIJobPriority = 'background' | 'normal' | 'urgent';
export type AIJobBudgetTier = 'economy' | 'standard' | 'deep';

export type AIJobEffectHint = {
  kind:
    | 'relation_shift'
    | 'capacity_pressure'
    | 'stakeholder_reaction'
    | 'dossier_update'
    | 'actor_materialization'
    | 'historical_manifestation'
    | 'interpreted_action';
  targetIds: EntityId[];
  magnitude: 'minor' | 'moderate' | 'major';
  direction: 'positive' | 'negative' | 'mixed';
  reason: string;
};

/** Résultat consultatif conservé avec la tâche. Aucun effet n'est appliqué sans adaptateur métier. */
export type AIJobOutcome = {
  headline: string;
  assessment: string;
  publicMessage: string;
  proposals: Array<{
    label: string;
    action: string;
    rationale: string;
    likelyReactions: string[];
    uncertainties: string[];
    effectHints: AIJobEffectHint[];
  }>;
  requestedFacts: string[];
  contextFactIds: string[];
  approximateInputTokens: number;
};

export type AIJobBase = {
  id: string;
  kind: AIJobKind;
  schemaVersion: 1;
  priority: AIJobPriority;
  budgetTier: AIJobBudgetTier;
  status: 'pending' | 'resolved' | 'cancelled' | 'failed';
  requestedAt: ISODate;
  resolvedAt?: ISODate;
  attempts: number;
  /** Texte libre intégral du joueur. `purpose` reste un résumé court exploitable par le moteur. */
  inputText?: string;
  error?: string;
  outcome?: AIJobOutcome;
};

export type AIJobPatch = Partial<Omit<AIJobBase, 'id' | 'kind' | 'schemaVersion'>>;

export type PowerStruggleAIJob = AIJobBase & {
  kind: 'power_struggle';
  purpose: PowerStruggleAIRequestPurpose;
  countryId: CountryId;
  reactionId: string;
  campaignId?: string;
  reasons: string[];
  context: {
    countryName: string;
    governmentLabel: string;
    stakeholderLabel: string;
    stakeholderCategory: StakeholderCategory;
    subjectId: string;
    defiance: number;
    mobilization: number;
    influence: number;
    cohesion: number;
    causes: string[];
    plausibleResponses: string[];
    existingActorIds: string[];
    currentCampaign?: {
      phase: string;
      pressure: number;
      momentum: number;
      escalation: number;
      lastStrategy: string;
    };
    playerResponse?: string;
  };
};

export type GeneralAIJob = AIJobBase & {
  kind: Exclude<AIJobKind, 'power_struggle'>;
  purpose: string;
  actorId: EntityId;
  reasons: string[];
  context: Record<string, unknown>;
};

export type AIJob = PowerStruggleAIJob | GeneralAIJob;

/** Alias conservé pour les intégrations déjà écrites. */
export type PowerStruggleAIRequest = PowerStruggleAIJob;

export type PowerStruggleAIProposal = {
  actor?: {
    name: string;
    role: PowerActorRole;
    position: string;
    ideologyTags: string[];
    personalityTags: string[];
    deepObjective: string;
    immediateObjective: string;
    influence: number;
    legitimacy: number;
    loyaltyToRegime: number;
    loyaltyToGovernment: number;
    riskTolerance: number;
    initialVisibility: PowerActorVisibility;
  };
  strategy: string;
  immediateObjective: string;
  acceptableCompromise: string;
  personalRedLine: string;
  currentTactic: PowerStruggleTactic;
  publicMove: string;
  reassessmentTriggers: PowerStruggleAIPlan['reassessmentTriggers'];
  reviewAfterMonths: number;
};

export type StrategicSectorId =
  | 'defense'
  | 'semiconductors'
  | 'nuclear'
  | 'fertilizers'
  | 'specialty_steel'
  | 'pharmaceuticals'
  | 'shipbuilding'
  | 'telecoms'
  | 'machine_tools'
  | 'strategic_agriculture'
  | 'maritime_logistics';

export type StrategicSectorState = {
  id: string;
  countryId: CountryId;
  sector: StrategicSectorId;
  capacity: number;
  utilization: number;
  workloadMonths: number;
  health: number;
  foreignDependency: number;
  technology: number;
  expansionLeadMonths: number;
  vulnerability?: string;
  /**
   * Une filière documentée possède un inventaire national propre. Une filière
   * agrégée est une projection du socle macroéconomique : elle complète la
   * jouabilité mondiale sans inventer d'entreprise ou d'usine précise.
   */
  modelingLevel?: 'documented' | 'aggregate';
};

export type ArmamentMaturity =
  | 'concept'
  | 'prototype'
  | 'qualification'
  | 'in_service'
  | 'proven'
  | 'aging';

export type OperationalExperience =
  | 'never_deployed'
  | 'exercise_only'
  | 'deployed_no_combat'
  | 'combat_deployed'
  | 'high_intensity_proven'
  | 'contested_results';

export type ArmamentProduct = {
  id: string;
  countryId: CountryId;
  name: string;
  family: string;
  manufacturer: string;
  status: 'development' | 'exportable' | 'production' | 'standby' | 'discontinued';
  annualCapacity: number;
  backlogMonths: number;
  industrialHealth: number;
  maturity: ArmamentMaturity;
  operationalExperience: OperationalExperience;
  fieldFeedback: 'unknown' | 'favorable' | 'mixed' | 'concerning';
  evidenceConfidence: number;
  reputation: number;
  clients: Array<{ countryId: CountryId; quantity: number; delivered: number }>;
  prospects: Array<{
    id: string;
    countryId: CountryId;
    quantity: number;
    status: 'prospecting' | 'negotiating' | 'approval_required' | 'lost' | 'won';
    politicalSensitivity: number;
  }>;
};

export type ActionKind =
  | 'diplomatic'
  | 'economic'
  | 'political'
  | 'institutional'
  | 'intelligence'
  | 'defense'
  | 'energy'
  | 'industrial'
  | 'historical'
  | 'time_advance';

/**
 * Un programme est l'unité commune entre une intention du joueur et ses effets
 * dans le monde : il consomme des moyens, prend du temps, puis est résolu par le
 * moteur. Il évite que chaque domaine invente sa propre boucle de gameplay.
 */
export type CommonActionCategory =
  | 'diplomacy'
  | 'economic'
  | 'institutional'
  | 'defense'
  | 'intelligence';

/**
 * Mécanisme concret d'un programme. La catégorie choisit le domaine ; le
 * levier détermine ce que le moteur modifie réellement. Deux actions
 * économiques ne deviennent donc plus automatiquement le même bonus.
 */
export type CommonActionLever =
  | 'diplomatic_contact'
  | 'diplomatic_cooperation'
  | 'defense_pact'
  | 'mediation'
  | 'information_sharing'
  | 'fiscal_stimulus'
  | 'fiscal_consolidation'
  | 'industrial_capacity'
  | 'strategic_sector'
  | 'trade_promotion'
  | 'energy_resilience'
  | 'economic_general'
  | 'administrative_reform'
  | 'government_reorganization'
  | 'anti_corruption'
  | 'national_reform'
  | 'force_readiness'
  | 'defense_procurement'
  | 'force_deployment'
  | 'defense_industry'
  | 'intelligence_assessment'
  | 'intelligence_surveillance';

export type ActionProgramStatus =
  | 'active'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';

export type ActionProgram = {
  id: string;
  category: CommonActionCategory;
  /** Optional for migration of older saves; every newly prepared program has one. */
  lever?: CommonActionLever;
  actorId: CountryId;
  targetIds: EntityId[];
  /** Dossier stratégique à l'origine du programme, lorsqu'il existe. */
  linkedDossierId?: string;
  /** Posture choisie par le joueur quand le dossier est un ancrage historique. */
  historicalIntent?: HistoricalInterventionDirection;
  /** Une délégation agit sur le même dossier, mais avec un effet volontairement réduit. */
  historicalContributionScale?: number;
  title: string;
  intent: string;
  startedAt: ISODate;
  expectedCompletionAt: ISODate;
  durationMonths: number;
  progressMonths: number;
  status: ActionProgramStatus;
  requiredCapacities: Array<{ domain: CapacityDomainId; commitment: number }>;
  budgetCost: number;
  successProbability: number;
  risks: string[];
  /** Signaux politiques utilisés pour faire réagir les corps organisés. */
  policySignals?: Array<{ signal: PolicySignal; weight: number }>;
  /** Photo de faisabilité au moment où le programme a été préparé. */
  politicalAssessment?: {
    pathwayStatus: PoliticalPathway['status'];
    doctrineCompatibility: number;
    institutionalFeasibility: number;
    leaderDisposition: number;
    apparatusSupport: number;
    finalScore: number;
    blocked: boolean;
    reasons: string[];
  };
  successEffects: WorldEffect[];
  partialEffects: WorldEffect[];
  resolution?: string;
  /** Intention vérifiée à l'origine du programme, sans effets exécutables. */
  intentSpec?: import('./action-intents').ActionIntent;
};

export type WorldEffect =
  | { kind: 'date_set'; date: ISODate; reason: string; visibility?: Visibility }
  | { kind: 'processed_stop_add'; stopId: string; reason: string; visibility?: Visibility }
  | { kind: 'metric_delta'; countryId: CountryId; metric: WorldMetric; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'politics_patch'; countryId: CountryId; patch: Partial<PoliticalSystem>; reason: string; visibility?: Visibility }
  | { kind: 'leadership_patch'; countryId: CountryId; patch: Partial<CountryLeadership>; reason: string; visibility?: Visibility }
  | { kind: 'political_apparatus_patch'; countryId: CountryId; patch: Partial<PoliticalApparatusProfile>; reason: string; visibility?: Visibility }
  | { kind: 'political_cycle_patch'; countryId: CountryId; patch: Partial<PoliticalCycle>; reason: string; visibility?: Visibility }
  | { kind: 'country_strategy_patch'; countryId: CountryId; patch: Partial<CountryStrategy>; reason: string; visibility?: Visibility }
  | { kind: 'capacity_commitment'; countryId: CountryId; domain: CapacityDomainId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'capacity_maximum'; countryId: CountryId; domain: CapacityDomainId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'relation_delta'; from: CountryId; to: CountryId; relation: number; trust: number; reason: string; visibility?: Visibility }
  | { kind: 'intelligence_delta'; observerId: CountryId; targetId: CountryId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'institution_patch'; institutionId: string; patch: Partial<InstitutionState>; reason: string; visibility?: Visibility }
  | { kind: 'treaty_add'; treaty: TreatyState; reason: string; visibility?: Visibility }
  | { kind: 'treaty_patch'; treatyId: string; patch: Partial<TreatyState>; reason: string; visibility?: Visibility }
  | { kind: 'historical_pressure'; currentId: string; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'historical_anchor_patch'; anchorId: string; patch: Partial<HistoricalAnchor>; reason: string; visibility?: Visibility }
  | { kind: 'latent_process_patch'; processId: string; patch: Partial<LatentProcess>; reason: string; visibility?: Visibility }
  | { kind: 'energy_contract_add'; contract: EnergyContract; reason: string; visibility?: Visibility }
  | { kind: 'energy_contract_patch'; contractId: string; patch: Partial<EnergyContract>; reason: string; visibility?: Visibility }
  | { kind: 'energy_node_patch'; nodeId: string; patch: Partial<EnergyNode>; reason: string; visibility?: Visibility }
  | { kind: 'energy_stock_delta'; countryId: CountryId; resource: EnergyResource; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_session_add'; session: DiplomaticSession; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_session_patch'; sessionId: string; patch: Partial<DiplomaticSession>; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_dialogue_add'; dialogue: DiplomaticDialogue; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_dialogue_patch'; dialogueId: string; patch: Partial<DiplomaticDialogue>; reason: string; visibility?: Visibility }
  | { kind: 'sector_patch'; sectorId: string; patch: Partial<StrategicSectorState>; reason: string; visibility?: Visibility }
  | { kind: 'sector_delta'; sectorId: string; delta: Partial<Record<'capacity' | 'utilization' | 'workloadMonths' | 'health' | 'foreignDependency' | 'technology', number>>; reason: string; visibility?: Visibility }
  | { kind: 'armament_patch'; productId: string; patch: Partial<ArmamentProduct>; reason: string; visibility?: Visibility }
  | { kind: 'dossier_add'; dossier: StrategicDossier; reason: string; visibility?: Visibility }
  | { kind: 'dossier_patch'; dossierId: string; patch: Partial<StrategicDossier>; reason: string; visibility?: Visibility }
  | { kind: 'dossier_entry_add'; dossierId: string; entry: DossierEntry; reason: string; visibility?: Visibility }
  | { kind: 'macro_patch'; countryId: CountryId; patch: Partial<MacroeconomicState>; reason: string; visibility?: Visibility }
  | { kind: 'macro_policy_delta'; countryId: CountryId; patch: Partial<EconomicPolicyState>; reason: string; visibility?: Visibility }
  | { kind: 'world_economy_patch'; patch: Partial<WorldEconomyState>; reason: string; visibility?: Visibility }
  | { kind: 'structural_profile_patch'; countryId: CountryId; patch: Partial<CountryStructuralProfile>; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_group_add'; group: StakeholderGroup; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_reaction_add'; reaction: StakeholderReaction; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_reaction_patch'; reactionId: string; patch: Partial<StakeholderReaction>; reason: string; visibility?: Visibility }
  | { kind: 'national_reform_patch'; countryId: CountryId; domain: NationalReformDomain; patch: Partial<NationalReformState>; reason: string; visibility?: Visibility }
  | { kind: 'power_actor_add'; actor: EmergentPowerActor; reason: string; visibility?: Visibility }
  | { kind: 'power_actor_patch'; actorId: string; patch: Partial<EmergentPowerActor>; reason: string; visibility?: Visibility }
  | { kind: 'power_campaign_add'; campaign: PowerStruggleCampaign; reason: string; visibility?: Visibility }
  | { kind: 'power_campaign_patch'; campaignId: string; patch: Partial<PowerStruggleCampaign>; reason: string; visibility?: Visibility }
  | { kind: 'ai_job_add'; job: AIJob; reason: string; visibility?: Visibility }
  | { kind: 'ai_job_patch'; jobId: string; patch: AIJobPatch; reason: string; visibility?: Visibility }
  | { kind: 'action_program_add'; program: ActionProgram; reason: string; visibility?: Visibility }
  | { kind: 'action_program_patch'; programId: string; patch: Partial<ActionProgram>; reason: string; visibility?: Visibility };

export type ActionDraft = {
  kind: ActionKind;
  actorId: CountryId;
  targetIds?: EntityId[];
  intent: string;
  origin: ActionOrigin;
  effects: WorldEffect[];
  assumptions?: string[];
  visibility?: Visibility;
  metadata?: Record<string, unknown>;
};

export type WorldAction = ActionDraft & {
  id: string;
  createdAt: ISODate;
  status: 'proposed' | 'validated' | 'applied' | 'rejected' | 'cancelled';
};

export type WorldChange = {
  id: string;
  actionId: string;
  date: ISODate;
  actorId: CountryId;
  path: string;
  before: unknown;
  after: unknown;
  reason: string;
  origin: ActionOrigin;
  visibility: Visibility;
};

export type SimulationStop = {
  id: string;
  date: ISODate;
  title: string;
  kind: 'major' | 'diplomatic' | 'political';
};

export type DossierImportance = 'minor' | 'moderate' | 'major' | 'critical';
export type DossierKind = 'conflict' | 'diplomatic_crisis' | 'economic' | 'security' | 'cooperation' | 'historical' | 'power_struggle' | 'political_transition';

export type DossierEntry = {
  id: string;
  date: ISODate;
  title: string;
  summary: string;
  importance: DossierImportance;
  actorIds: EntityId[];
  requiresDecision: boolean;
  visibility: Visibility;
  sourceActionId?: string;
};

export type DossierDecisionUrgency = 'low' | 'medium' | 'high' | 'critical';
export type DossierDecisionChannel = 'local_action' | 'dialogue' | 'delegation' | 'explicit_silence';
export type DossierDecisionSourceKind = 'legacy' | 'world_pulse' | 'autonomous_program' | 'historical' | 'player_action';

/** Métadonnées persistantes d’une décision, sans supprimer la compatibilité avec pendingDecisions. */
export type DossierDecision = {
  id: string;
  prompt: string;
  createdAt: ISODate;
  urgency: DossierDecisionUrgency;
  sourceKind: DossierDecisionSourceKind;
  sourceId?: string;
  sourceLabel?: string;
  actorIds: EntityId[];
  availableChannels: DossierDecisionChannel[];
  status: 'pending' | 'resolved' | 'expired';
  resolvedAt?: ISODate;
  expiredAt?: ISODate;
  resolutionChannel?: DossierDecisionChannel;
};

export type StrategicDossier = {
  id: string;
  title: string;
  kind: DossierKind;
  status: 'emerging' | 'active' | 'deescalating' | 'resolved';
  importance: DossierImportance;
  actorIds: EntityId[];
  regionTags: string[];
  startedAt: ISODate;
  updatedAt: ISODate;
  phase: string;
  trend: 'escalating' | 'stable' | 'deescalating';
  publicSummary: string;
  followed: boolean;
  autoTracked: boolean;
  /** Dernière fois où la voie autonome IA a réellement produit une mise à jour. */
  lastAutonomousReviewAt?: ISODate;
  /** Position de l'action de pouls dans le journal, pour distinguer deux faits du même mois. */
  lastAutonomousReviewActionCount?: number;
  /** Dernière revue locale d'un dossier modéré ou mineur, sans appel IA. */
  lastLocalReviewAt?: ISODate;
  /** Position de la revue locale dans le journal pour ne pas la recompter comme un signal. */
  lastLocalReviewActionCount?: number;
  lastViewedEntryId?: string;
  playerStance?: string;
  commitments: string[];
  pendingDecisions: string[];
  /** Index enrichi ; les anciennes sauvegardes n’ont que pendingDecisions. */
  decisionRecords?: DossierDecision[];
  /** Nombre de relances automatiques produites faute d’arbitrage. */
  escalationCount?: number;
  /** Dernière date à laquelle le moteur a relancé ce dossier. */
  lastEscalatedAt?: ISODate;
  /** Date de mise en sommeil d’un dossier secondaire sans décision active. */
  sleepingAt?: ISODate;
  /** Date du dernier réveil automatique après un signal externe significatif. */
  reactivatedAt?: ISODate;
  /** Effets systémiques calculés lors de la dernière frontière mensuelle. */
  impactState?: DossierImpactState;
  relatedCurrentIds: string[];
  /** Ancrage historique à l’origine du dossier, s’il y en a un. */
  relatedAnchorId?: string;
  relatedActionIds: string[];
  entries: DossierEntry[];
};

export type WorldState = {
  version: 1;
  territorial: TerritorialState;
  scenarioId: string;
  seed: number;
  sequence: number;
  currentDate: ISODate;
  playerCountryId: CountryId;
  countries: Record<CountryId, CountryState>;
  relations: Record<string, BilateralRelation>;
  intelligence: Record<string, number>;
  institutions: Record<string, InstitutionState>;
  treaties: Record<string, TreatyState>;
  historicalCurrents: Record<string, HistoricalCurrent>;
  historicalAnchors: Record<string, HistoricalAnchor>;
  latentProcesses: Record<string, LatentProcess>;
  energyNodes: Record<string, EnergyNode>;
  energyContracts: Record<string, EnergyContract>;
  baselineEnergyFlows: Record<string, BaselineEnergyFlow>;
  countryEnergy: Record<CountryId, CountryEnergyState>;
  macroEconomies: Record<CountryId, MacroeconomicState>;
  worldEconomy: WorldEconomyState;
  tradeFlows: Record<string, BilateralTradeFlow>;
  decisionProfiles: Record<CountryId, CountryDecisionProfile>;
  leadership: Record<CountryId, CountryLeadership>;
  politicalCycles: Record<CountryId, PoliticalCycle>;
  politicalApparatus: Record<CountryId, PoliticalApparatusProfile>;
  structuralProfiles: Record<CountryId, CountryStructuralProfile>;
  stakeholderGroups: Record<string, StakeholderGroup>;
  stakeholderReactions: Record<string, StakeholderReaction>;
  nationalReforms: Record<string, NationalReformState>;
  powerActors: Record<string, EmergentPowerActor>;
  powerStruggleCampaigns: Record<string, PowerStruggleCampaign>;
  aiJobs: Record<string, AIJob>;
  actionPrograms: Record<string, ActionProgram>;
  diplomaticSessions: Record<string, DiplomaticSession>;
  diplomaticDialogues: Record<string, DiplomaticDialogue>;
  sectors: Record<string, StrategicSectorState>;
  armamentProducts: Record<string, ArmamentProduct>;
  strategicDossiers: Record<string, StrategicDossier>;
  actions: WorldAction[];
  ledger: WorldChange[];
  processedStopIds: string[];
};

export type PoliticalActionProfile = {
  requiredAuthority: 'executive' | 'legislative' | 'constitutional' | 'administrative';
  doctrine: Partial<GovernmentDoctrine>;
  publicSalience: number;
  administrativeComplexity: number;
};

export type PoliticalPathway = {
  status: 'direct' | 'legislative' | 'negotiable' | 'blocked' | 'rupture';
  doctrineCompatibility: number;
  votesAvailable: number;
  votesRequired: number;
  administrativeFeasibility: number;
  obstacles: string[];
  routes: string[];
};

export type DecisionCriterion =
  | 'growth'
  | 'employment'
  | 'price_stability'
  | 'fiscal_sustainability'
  | 'strategic_autonomy'
  | 'alliance_cohesion'
  | 'social_cohesion'
  | 'redistribution'
  | 'regime_survival'
  | 'elite_support'
  | 'international_prestige';

export type DecisionSignal =
  | 'deficit_spending'
  | 'austerity'
  | 'foreign_dependency'
  | 'rival_dependency'
  | 'strategic_autonomy'
  | 'alliance_cooperation'
  | 'alliance_breach'
  | 'market_liberalization'
  | 'state_control'
  | 'redistribution'
  | 'labor_deregulation'
  | 'monetary_financing'
  | 'military_escalation'
  | 'political_opening'
  | 'elite_displacement'
  | 'commercial_deal';

export type PoliticalConstraint = {
  id: string;
  label: string;
  level: 'preference' | 'taboo' | 'red_line';
  signals: DecisionSignal[];
  penalty: number;
  overridePressure: number;
  active: boolean;
};

export type CountryDecisionProfile = {
  countryId: CountryId;
  criterionWeights: Record<DecisionCriterion, number>;
  riskTolerance: number;
  adaptability: number;
  satisficingThreshold: number;
  choiceNoise: number;
  constraints: PoliticalConstraint[];
  source: string;
};

export type StrategicActionCandidate = {
  id: string;
  actorId: CountryId;
  label: string;
  kind: ActionKind;
  outcomes: Partial<Record<DecisionCriterion, number>>;
  signals: DecisionSignal[];
  doctrine?: Partial<GovernmentDoctrine>;
  requiredAuthority: PoliticalActionProfile['requiredAuthority'];
  publicSalience: number;
  administrativeComplexity: number;
  urgency: number;
  risk: number;
  resourceCost: number;
  metadata?: Record<string, unknown>;
};

export type StrategicActionEvaluation = {
  candidateId: string;
  objectiveScore: number;
  governingScore: number;
  doctrineCompatibility: number;
  institutionalFeasibility: number;
  leaderDisposition: number;
  apparatusSupport: number;
  finalScore: number;
  blocked: boolean;
  reasons: string[];
  constraints: Array<{ id: string; level: PoliticalConstraint['level']; appliedPenalty: number; overridden: boolean }>;
};

export type StrategicPlan = {
  id: string;
  title: string;
  intent: string;
  rationale: string;
  factsUsed: string[];
  measures: Array<{ actor: string; action: string; target: string; deadline: string }>;
  requiredCapabilities: CapacityDomainId[];
  interlocutors: EntityId[];
  assumptions: string[];
  risks: string[];
  likelyReactions: string[];
  successIndicators: string[];
  horizon: string;
  execution?: {
    kind: 'energy_contract';
    supplierId: CountryId;
    resource: EnergyResource;
  };
};

export type AiBudgetPolicy = {
  worldDynamism: 'economy' | 'standard' | 'organic';
  diplomacyDepth: 'concise' | 'standard' | 'detailed';
  historicalDepth: 'concise' | 'standard' | 'detailed';
  advisorDepth: 'concise' | 'standard' | 'detailed';
};
