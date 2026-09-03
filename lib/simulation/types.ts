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

export type MacroeconomicState = {
  countryId: CountryId;
  realGdpBillion2000Usd: number;
  realGrowthAnnualPct: number;
  potentialGrowthAnnualPct: number;
  populationMillions: number;
  populationGrowthAnnualPct: number;
  inflationAnnualPct: number;
  unemploymentPct: number;
  investmentSharePctGdp: number;
  exportSharePctGdp: number;
  importSharePctGdp: number;
  tradeBalancePctGdp: number;
  industrySharePctGdp: number;
  productivityIndex: number;
  source: MacroSource;
  lastUpdatedAt: ISODate;
};

export type WorldEconomyState = {
  globalGrowthAnnualPct: number;
  globalInflationAnnualPct: number;
  demandIndex: number;
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

export type WorldEffect =
  | { kind: 'date_set'; date: ISODate; reason: string; visibility?: Visibility }
  | { kind: 'processed_stop_add'; stopId: string; reason: string; visibility?: Visibility }
  | { kind: 'metric_delta'; countryId: CountryId; metric: WorldMetric; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'country_strategy_patch'; countryId: CountryId; patch: Partial<CountryStrategy>; reason: string; visibility?: Visibility }
  | { kind: 'capacity_commitment'; countryId: CountryId; domain: CapacityDomainId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'capacity_maximum'; countryId: CountryId; domain: CapacityDomainId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'relation_delta'; from: CountryId; to: CountryId; relation: number; trust: number; reason: string; visibility?: Visibility }
  | { kind: 'intelligence_delta'; observerId: CountryId; targetId: CountryId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'institution_patch'; institutionId: string; patch: Partial<InstitutionState>; reason: string; visibility?: Visibility }
  | { kind: 'treaty_patch'; treatyId: string; patch: Partial<TreatyState>; reason: string; visibility?: Visibility }
  | { kind: 'historical_pressure'; currentId: string; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'latent_process_patch'; processId: string; patch: Partial<LatentProcess>; reason: string; visibility?: Visibility }
  | { kind: 'energy_contract_add'; contract: EnergyContract; reason: string; visibility?: Visibility }
  | { kind: 'energy_contract_patch'; contractId: string; patch: Partial<EnergyContract>; reason: string; visibility?: Visibility }
  | { kind: 'energy_node_patch'; nodeId: string; patch: Partial<EnergyNode>; reason: string; visibility?: Visibility }
  | { kind: 'energy_stock_delta'; countryId: CountryId; resource: EnergyResource; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'sector_patch'; sectorId: string; patch: Partial<StrategicSectorState>; reason: string; visibility?: Visibility }
  | { kind: 'armament_patch'; productId: string; patch: Partial<ArmamentProduct>; reason: string; visibility?: Visibility }
  | { kind: 'dossier_add'; dossier: StrategicDossier; reason: string; visibility?: Visibility }
  | { kind: 'dossier_patch'; dossierId: string; patch: Partial<StrategicDossier>; reason: string; visibility?: Visibility }
  | { kind: 'dossier_entry_add'; dossierId: string; entry: DossierEntry; reason: string; visibility?: Visibility }
  | { kind: 'macro_patch'; countryId: CountryId; patch: Partial<MacroeconomicState>; reason: string; visibility?: Visibility }
  | { kind: 'world_economy_patch'; patch: Partial<WorldEconomyState>; reason: string; visibility?: Visibility }
  | { kind: 'structural_profile_patch'; countryId: CountryId; patch: Partial<CountryStructuralProfile>; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_group_add'; group: StakeholderGroup; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_reaction_add'; reaction: StakeholderReaction; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_reaction_patch'; reactionId: string; patch: Partial<StakeholderReaction>; reason: string; visibility?: Visibility };

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
export type DossierKind = 'conflict' | 'diplomatic_crisis' | 'economic' | 'security' | 'cooperation' | 'historical';

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
  lastViewedEntryId?: string;
  playerStance?: string;
  commitments: string[];
  pendingDecisions: string[];
  relatedCurrentIds: string[];
  relatedActionIds: string[];
  entries: DossierEntry[];
};

export type WorldState = {
  version: 1;
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
  latentProcesses: Record<string, LatentProcess>;
  energyNodes: Record<string, EnergyNode>;
  energyContracts: Record<string, EnergyContract>;
  countryEnergy: Record<CountryId, CountryEnergyState>;
  macroEconomies: Record<CountryId, MacroeconomicState>;
  worldEconomy: WorldEconomyState;
  structuralProfiles: Record<CountryId, CountryStructuralProfile>;
  stakeholderGroups: Record<string, StakeholderGroup>;
  stakeholderReactions: Record<string, StakeholderReaction>;
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
