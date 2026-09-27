import type { TerritorialState, TerritorialAssetOperation, TerritorialPortProfile } from './territory-types';

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

/** Charge institutionnelle persistante. Les champs d'usure sont optionnels
 * pour permettre la lecture des anciennes sauvegardes. */
export type CapacityState = Record<CapacityDomainId, {
  maximum: number;
  committed: number;
  overloadMonths?: number;
  efficiencyPct?: number;
  lastOverloadAt?: ISODate | null;
}>;

/** Un élément visible du calcul initial d'une capacité. Les valeurs ne sont
 * jamais cachées derrière une note narrative : leur somme donne le chiffre
 * affiché au joueur. */
export type CapacityBaselineFactor = {
  label: string;
  value: number;
  detail: string;
};

export type CapacityBaseline = Record<CapacityDomainId, {
  maximumFactors: CapacityBaselineFactor[];
  commitmentFactors: CapacityBaselineFactor[];
}>;

/** Comptabilité publique lisible : les deux dernières valeurs sont des unités
 * de jeu, séparées des pourcentages macroéconomiques. */
export type FiscalState = {
  annualRevenuePctGDP: number;
  annualSpendingPctGDP: number;
  fiscalBalancePctGDP: number;
  publicDebtPctGDP: number;
  /** Enveloppe votée pour l'année, avant les dépenses de lancement. */
  annualDiscretionaryAllocation: number;
  discretionaryMargin: number;
  emergencyReserve: number;
  /** Coûts ou économies pérennes créés par les programmes aboutis. */
  recurringProgramCosts: number;
  recurringProgramSavings: number;
  /** Année de la dernière loi de finances simulée. */
  lastSettlementYear: number;
};

/** Les paliers sont communs à tous les domaines : l'effet, les coûts et la
 * durée sont toujours affichés avant le lancement. */
export type CapacityDevelopmentTier = 'light' | 'medium' | 'heavy';

/** Coût durable né d'un programme abouti (formation, maintenance, effectifs). */
export type CapacityMaintenanceCommitment = {
  id: string;
  domain: CapacityDomainId;
  label: string;
  annualBudgetCost: number;
  startedAt: ISODate;
};

/** Paramètres persistés pour rendre une hausse de capacité entièrement traçable. */
export type CapacityDevelopmentSpec = {
  domain: CapacityDomainId;
  tier: CapacityDevelopmentTier;
  capacityGain: number;
  capitalCost: number;
  transitionCost: number;
  annualMaintenanceCost: number;
  politicalCost: number;
};

/** Renfort immédiat financé pour absorber une crise, sans gain permanent. */
export type EmergencyCapacitySupport = {
  domain: CapacityDomainId;
  temporaryBoost: number;
};

/**
 * Capacités structurelles de l'État. Elles ne constituent pas une seconde
 * réserve de points : elles décrivent la qualité avec laquelle les moyens
 * opérationnels sont transformés en décisions effectivement exécutées.
 */
export type GovernmentCapacityDimensionId =
  | 'executiveSteering'
  | 'administrativeDelivery'
  | 'fiscalCapacity'
  | 'territorialReach'
  | 'informationExpertise'
  | 'integrityControl';

/** Photographie conservée au lancement afin de rendre le calcul explicable. */
export type ActionGovernmentCapacityAssessment = {
  evaluatedAt: ISODate;
  score: number;
  dimensions: Partial<Record<GovernmentCapacityDimensionId, number>>;
  durationMultiplier: number;
  budgetMultiplier: number;
  successModifier: number;
  limitingDimension?: GovernmentCapacityDimensionId;
  /** Modificateurs structurels qui ont influé sur ce calcul. */
  structuralModifierIds?: string[];
  structuralModifierEffects?: {
    durationPct: number;
    budgetPct: number;
    successModifier: number;
  };
};

export type WorldMetric = 'industry' | 'stability' | 'security';
export type ActionOrigin = 'player' | 'local_rule' | 'ai' | 'historical' | 'time';
export type Visibility = 'public' | 'player' | 'secret' | 'debug';

export type GovernmentDoctrine = {
  economic: number;
  social: number;
  sovereignty: number;
  security: number;
};

/** Domaines de politique publique suivis par le moteur législatif.
 * Une réforme ne peut plus se résoudre en bonus abstrait : elle transforme
 * l'une de ces politiques, avec son coût récurrent et ses indicateurs. */
export type NationalReformDomain =
  | 'retirement'
  | 'labor'
  | 'taxation'
  | 'social_protection'
  | 'health'
  | 'education'
  | 'energy'
  | 'industry'
  | 'environment'
  | 'housing'
  | 'administration'
  | 'institutions'
  | 'justice'
  | 'security'
  | 'religion'
  | 'immigration'
  | 'societal';
export type NationalReformOutcome = 'adopted' | 'partial' | 'stalled' | 'reversed';

/**
 * Contrat sémantique stable entre le joueur, l'IA et le moteur. L'IA choisit
 * explicitement le domaine et la direction ; le moteur reste seul responsable
 * du coût, de la voie institutionnelle et des effets effectivement appliqués.
 */
export type StructuredReformIntent = {
  id: string;
  domain: NationalReformDomain;
  title: string;
  objective: string;
  measures: string[];
  direction: 'lower' | 'balanced' | 'higher';
  pace: 'rapid' | 'gradual';
  acceptedCompromises: string[];
  factualBasisIds: string[];
};

/** Photographie conservée au moment de la confirmation pour produire un vrai
 * bilan avant/après, même après compression du registre. */
export type NationalReformSnapshot = {
  domain: NationalReformDomain;
  position: number;
  positionLabel: string;
  annualFiscalImpact: number;
  indicators: Partial<Record<NationalPolicyIndicatorId, number>>;
  evidenceLevel: number;
  polarization: number;
  capturedAt: ISODate;
};

export type NationalReformOutcomeSummary = {
  outcome: NationalReformOutcome;
  before: NationalReformSnapshot;
  after: NationalReformSnapshot;
  headline: string;
  summary: string;
  changes: string[];
};

/** Indicateurs réutilisables. Chaque politique n'en expose que trois, ce qui
 * évite de créer une jauge opaque ou un écran rempli de chiffres. */
export type NationalPolicyIndicatorId =
  | 'coverage'
  | 'sustainability'
  | 'access'
  | 'equity'
  | 'marketRole'
  | 'resilience'
  | 'productivity'
  | 'stateCapacity'
  | 'rights'
  | 'security'
  | 'environment';

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
  /** Qualité de la base factuelle : les audits la font progresser avant le
   * dépôt d'un texte, sans préjuger de l'orientation de ce texte. */
  evidenceLevel: number;
  /** Effet annuel net sur les crédits après adoption : positif = dépense,
   * négatif = économie. Il est reconcilié avec la loi de finances. */
  annualFiscalImpact: number;
  /** Trois indicateurs au plus, définis par le profil du domaine. */
  indicators: Partial<Record<NationalPolicyIndicatorId, number>>;
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
  /** Comptabilité publique détaillée, source unique des crédits jouables. */
  fiscal: FiscalState;
  capacities: CapacityState;
  /** Décomposition de l'état initial, lorsque le scénario dispose d'une fiche
   * suffisamment documentée. Elle est conservée pour l'affichage et l'audit. */
  capacityBaseline?: CapacityBaseline;
  /** Présent après la première hausse durable de capacité ; optionnel pour les sauvegardes antérieures. */
  capacityMaintenance?: Record<string, CapacityMaintenanceCommitment>;
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

export type TreatyImplementationKind =
  | 'energy_framework'
  | 'industrial_transfer'
  | 'maritime_security'
  | 'defense_support'
  | 'information_channel';

/**
 * Volet matériel optionnel d'un accord diplomatique.
 *
 * Le traité reste un engagement politique, tandis que cette structure indique
 * au moteur quels registres concrets peuvent progresser. Les identifiants sont
 * des liens vers les inventaires existants : aucune capacité n'est inventée
 * par l'accord lui-même.
 */
export type TreatyImplementation = {
  kind: TreatyImplementationKind;
  phase: 'exploration' | 'pilot' | 'operational' | 'complete';
  progressPct: number;
  monthlyProgressPct: number;
  sectorIds: string[];
  energyNodeIds: string[];
  armamentProductIds: string[];
  militaryTheaterIds: string[];
  assetIds: string[];
  milestonePcts: number[];
  completedMilestones?: number[];
  dossierId?: string;
  note: string;
};

export type TreatyState = {
  id: string;
  parties: CountryId[];
  label: string;
  status: 'draft' | 'pending' | 'active' | 'suspended' | 'expired';
  startDate?: ISODate;
  endDate?: ISODate;
  monthlyEffects: Array<{ countryId: CountryId; metric: WorldMetric; delta: number }>;
  implementation?: TreatyImplementation;
};

export type InternationalOrganizationKind =
  | 'universal'
  | 'regional'
  | 'defense'
  | 'financial'
  | 'trade'
  | 'energy';

export type InternationalOrganizationDecisionRule =
  | 'consensus'
  | 'weighted_vote'
  | 'qualified_majority'
  | 'security_council';

export type InternationalOrganizationAgendaItem = {
  id: string;
  title: string;
  summary: string;
  stage: 'agenda' | 'negotiation' | 'vote' | 'implementation';
  openedAt: ISODate;
  deadline?: ISODate;
};

export type InternationalOrganizationMotionStage = 'campaigning' | 'voting' | 'adopted' | 'compromised' | 'rejected';

export type InternationalOrganizationVoteChoice = 'support' | 'oppose' | 'abstain' | 'undecided';

export type InternationalOrganizationCampaignTier = 'consultation' | 'coalition' | 'summit';

export type InternationalOrganizationCampaign = {
  tier: InternationalOrganizationCampaignTier;
  stance: Exclude<InternationalOrganizationVoteChoice, 'abstain' | 'undecided'>;
  targetId?: CountryId;
  supportDelta: number;
  budgetCost: number;
  diplomacyCost: number;
  startedAt: ISODate;
};

export type InternationalOrganizationMotionEffect =
  | 'oil_supply'
  | 'security_legitimacy'
  | 'trade_rules'
  | 'financial_discipline'
  | 'defense_posture'
  | 'regional_mediation';

/** Une motion est le point de contact régulier entre le joueur et une enceinte. */
export type InternationalOrganizationMotion = {
  id: string;
  organizationId: string;
  title: string;
  summary: string;
  openedAt: ISODate;
  voteAt: ISODate;
  stage: InternationalOrganizationMotionStage;
  decisionRule: InternationalOrganizationDecisionRule;
  threshold: number;
  supportWeight: number;
  oppositionWeight: number;
  playerChoice: InternationalOrganizationVoteChoice;
  effect: InternationalOrganizationMotionEffect;
  playerCampaign?: InternationalOrganizationCampaign;
  resultSummary?: string;
  resolvedAt?: ISODate;
};

/**
 * Socle multilatéral commun. Les décisions passent par des motions datées et
 * des votes explicites ; leurs effets sont ensuite appliqués par le moteur et
 * restent lisibles dans un dossier mondial.
 */
export type InternationalOrganizationState = {
  id: string;
  shortName: string;
  name: string;
  kind: InternationalOrganizationKind;
  headquarters: string;
  foundedYear: number;
  mandate: string;
  decisionRule: InternationalOrganizationDecisionRule;
  members: CountryId[];
  playerMember: boolean;
  playerVoteWeight: number;
  playerStanding: number;
  cohesion: number;
  legitimacy: number;
  annualContribution: number;
  agenda: InternationalOrganizationAgendaItem[];
  motions: InternationalOrganizationMotion[];
  updatedAt: ISODate;
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
  /** Actifs territoriaux qui détaillent ce nœud sans le compter deux fois. */
  territorialAssetIds?: string[];
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
  /** Terminal portuaire optionnel utilisé pour les flux maritimes.
   * L'absence de ce lien conserve les contrats historiques ou raccordés par
   * pipeline sans leur imposer artificiellement un port modélisé. */
  portAssetId?: string;
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
  /** Port d'arrivée optionnel : une négociation énergétique peut rester
   * abstraite tant qu'aucune infrastructure précise n'est choisie. */
  portAssetId?: string;
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

/** Typologie commune des engagements issus d’un dialogue libre. */
export type DiplomaticAgreementType =
  | 'industrial_cooperation'
  | 'energy_cooperation'
  | 'information_sharing'
  | 'security_cooperation'
  | 'political_guarantee'
  | 'mediation'
  | 'defense_cooperation';

/** Position d’un participant dans une réponse multilatérale. */
export type DiplomaticParticipantPosition = {
  participantId: CountryId;
  kind: 'accept' | 'counter' | 'refuse' | 'pending';
  position: string;
  acceptedTerms: string[];
  rejectedTerms: string[];
  conditionalTerms: string[];
  rationale?: string;
};

/** Position structurée affichée après une réponse IA dans un dialogue politique libre. */
export type DiplomaticDialogueResponse = {
  kind: 'accept' | 'counter' | 'refuse' | 'request_clarification' | 'message';
  agreementType: DiplomaticAgreementType;
  position: string;
  concessions: string[];
  guaranteesRequested: string[];
  conditions: string[];
  redLines: string[];
  timeline: string;
  /** Lecture rapide de la réponse, sans demander au joueur d’interpréter un paragraphe. */
  acceptedTerms?: string[];
  rejectedTerms?: string[];
  conditionalTerms?: string[];
  decisionScope?: 'dialogue_only' | 'principle' | 'substance';
  participantPositions?: DiplomaticParticipantPosition[];
  /** Raisons déterministes affichées lorsque le moteur a ramené une acceptation à une contre-proposition. */
  feasibilityIssues?: Array<{
    id: string;
    severity: 'hard' | 'counter';
    label: string;
    explanation: string;
    requiredResponse: string;
  }>;
};

export type DiplomaticDialogueResolution = {
  status: 'accepted' | 'accepted_conditionally' | 'refused' | 'revision_requested' | 'acknowledged';
  decidedAt: ISODate;
  summary: string;
};

/** Synthèse consultative d'un dialogue. Elle ne constitue jamais un accord. */
export type DiplomaticBrief = {
  id: string;
  dialogueId: string;
  generatedAt: ISODate;
  source: 'local' | 'ai';
  summary: string;
  pointsOfAgreement: string[];
  openPoints: string[];
  recommendedChanges: string[];
  suggestedMeeting?: 'official' | 'discreet' | 'technical';
};

export type DiplomaticMeetingMode = 'official' | 'discreet' | 'technical';
export type DiplomaticMeetingStatus = 'proposed' | 'scheduled' | 'completed' | 'cancelled';

/** Rencontre qui prolonge le dialogue sans signer automatiquement un accord. */
export type DiplomaticMeeting = {
  id: string;
  dialogueId: string;
  participantIds: CountryId[];
  mode: DiplomaticMeetingMode;
  status: DiplomaticMeetingStatus;
  proposedAt: ISODate;
  scheduledAt?: ISODate;
  agenda: string[];
  outcomeSummary?: string;
  draftId?: string;
  /** Réponse agrégée des participants à la proposition finale. */
  counterpartDecision?: 'pending' | 'accepted' | 'countered' | 'refused';
  /** Réponses conservées séparément pour éviter de fabriquer un consensus. */
  participantPositions?: DiplomaticParticipantPosition[];
};

export type DiplomaticAgreementDomain = 'energy' | 'defense' | 'industrial' | 'security' | 'political' | 'general';
export type DiplomaticAgreementDraftStage = 'framework' | 'final_proposal' | 'signed' | 'rejected';

/** Projet d'accord lisible : les termes sont volontairement simples et bornés. */
export type DiplomaticAgreementDraft = {
  id: string;
  dialogueId: string;
  meetingId: string;
  participantIds: CountryId[];
  domain: DiplomaticAgreementDomain;
  stage: DiplomaticAgreementDraftStage;
  title: string;
  summary: string;
  terms: Record<string, string | number>;
  unresolvedConditions: string[];
  /** L’accord ne peut être signé qu’après acceptation explicite des participants. */
  counterpartDecision?: 'pending' | 'accepted' | 'countered' | 'refused';
  createdAt: ISODate;
  updatedAt: ISODate;
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
  briefIds?: string[];
  meetingIds?: string[];
  agreementDraftIds?: string[];
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

/**
 * Stock géologique d'or connu au lancement. Il est séparé de la production
 * annuelle et des réserves monétaires détenues par les banques centrales :
 * ces deux objets seront raccordés au moteur des flux dans une étape dédiée.
 */
export type GoldCountryStock = {
  countryId: CountryId;
  identifiedReservesTonnes: number;
  probableReservesTonnes: number;
  frontierPotentialTonnes: number;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  lastUpdatedAt: ISODate;
};

export type ResourceCategory = 'energy' | 'metal' | 'precious' | 'fertilizer' | 'strategic';
export type ResourceUnit = 'tonnes' | 'barrels' | 'bcm' | 'mwh';

export type ResourceDefinition = {
  id: string;
  name: string;
  category: ResourceCategory;
  unit: ResourceUnit;
  strategicImportance: number;
  marketEnabled: boolean;
  note: string;
};

export type ResourceBasin = {
  id: string;
  resourceId: string;
  name: string;
  territoryIds: string[];
  countryIds: CountryId[];
  geologicalContinuity: number;
  sharedStatus: 'national' | 'cross_border' | 'transboundary_system';
  sourceIds: string[];
};

export type ResourceTerritorialShare = {
  territoryId: string;
  sharePct: number;
};

export type ResourceDeposit = {
  id: string;
  basinId: string;
  resourceId: string;
  territoryShares: ResourceTerritorialShare[];
  identifiedStock: number;
  probableStock: number;
  frontierPotential: number;
  quality: number;
  depth: number;
  extractionDifficulty: number;
  environmentalRisk: number;
  logisticsDifficulty: number;
  controllerEntityIds: string[];
  claimantEntityIds: string[];
  legalStatus: 'undisputed' | 'contested' | 'shared' | 'occupied';
  accessAssetIds: string[];
  confidence: 'high' | 'medium' | 'low';
  sourceIds: string[];
  lastUpdatedAt: ISODate;
};

export type ResourceCountryStock = {
  countryId: CountryId;
  resourceId: string;
  identifiedStock: number;
  probableStock: number;
  frontierPotential: number;
  depositIds: string[];
  confidence: 'high' | 'medium' | 'low';
  lastUpdatedAt: ISODate;
};

export type ResourceState = {
  definitions: Record<string, ResourceDefinition>;
  basins: Record<string, ResourceBasin>;
  deposits: Record<string, ResourceDeposit>;
  countryStocks: Record<CountryId, Record<string, ResourceCountryStock>>;
  lastUpdatedAt: ISODate;
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

/**
 * Lecture compacte de la place productive d'un pays dans l'économie mondiale.
 *
 * Les indices évitent de matérialiser chaque usine ou chaque tonne de minerai,
 * tout en donnant au moteur des causes concrètes aux relocalisations, pénuries
 * d'intrants et rapports de force commerciaux. Tous sont sur 0–100, sauf le
 * solde d'implantation qui est une variation annuelle de capacité.
 */
export type ProductiveSystemState = {
  /** Aptitude à recevoir de nouvelles unités de production. */
  productiveAttractiveness: number;
  /** Insertion effective dans les chaînes de valeur internationales. */
  globalValueChainIntegration: number;
  /** Part critique de l'appareil industriel dépendante d'achats extérieurs. */
  foreignIndustrialDependency: number;
  /** Concentration des fournisseurs : élevé = peu d'alternatives immédiates. */
  supplyConcentration: number;
  /** Capacité à peser sur les débouchés, normes et conditions commerciales. */
  commercialInfluence: number;
  /** Exposition des secteurs avancés aux métaux et composants critiques. */
  criticalInputExposure: number;
  /** Solde annuel de capacité productive attirée ou déplacée hors du pays. */
  productiveRelocationBalanceAnnualPct: number;
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

export type WorldProductMarket = {
  family: EconomicProductFamily;
  priceIndex: number;
  demandIndex: number;
  supplyIndex: number;
  inventoryMonths: number;
  volatility: number;
};

/**
 * Marché pétrolier distinct du panier énergétique général. Les volumes
 * explicitement recensés ne couvrent pas encore tous les producteurs : leur
 * évolution est donc pondérée dans l'offre mondiale plutôt que confondue avec
 * la totalité des besoins nationaux.
 */
export type OilMarketState = {
  benchmarkUsdPerBarrel: number;
  priceIndex: number;
  monthlyChangePct: number;
  demandIndex: number;
  supplyIndex: number;
  inventoryMonths: number;
  spareCapacityPct: number;
  disruptionRisk: number;
  /** Part de l'offre mondiale rendue physique par les gisements recensés. */
  modelledSupplySharePct: number;
  baselineModelledProduction: number;
  baselineModelledCapacity: number;
  baselineInventoryMonths: number;
  drivers: Array<{
    id: 'demand' | 'supply' | 'stocks' | 'spare_capacity' | 'geopolitics';
    label: string;
    direction: 'up' | 'down' | 'neutral';
    detail: string;
  }>;
  lastUpdatedAt: ISODate;
};

export type BilateralTradeFlow = {
  id: string;
  exporterId: CountryId;
  importerId: CountryId;
  annualValueBillion2000Usd: number;
  productMix: Record<EconomicProductFamily, number>;
  friction: number;
  reliability: number;
  /** Capacité agrégée de la route, dont les ports et la desserte sont une cause. */
  routeCapacityIndex?: number;
  lastUpdatedAt?: ISODate;
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
  productiveSystem: ProductiveSystemState;
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
  oilMarket: OilMarketState;
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

/** Signaux lents ou de seuil qui peuvent faire varier un modificateur sans
 * transformer chaque variation mensuelle en événement visible. */
export type StructuralSignalId =
  | 'public_approval'
  | 'unemployment'
  | 'inflation'
  | 'financial_stress'
  | 'energy_import_dependency'
  | 'energy_supply_pressure'
  | 'logistics_pressure'
  | 'government_capacity'
  | 'administrative_load'
  | 'security'
  | 'stability';

export type StructuralModifierCategory = 'social' | 'institutional' | 'economic' | 'strategic';
export type StructuralTriggerOperator = 'above' | 'below';

export type StructuralModifierTrigger = {
  id: string;
  signal: StructuralSignalId;
  operator: StructuralTriggerOperator;
  threshold: number;
  /** Intensité ajoutée lorsque le seuil est franchi. */
  adjustment: number;
  label: string;
  explanation: string;
};

/** Effets numériques bornés et réutilisables par les actions communes. */
export type StructuralModifierEffects = {
  capacityDeltas?: Partial<Record<GovernmentCapacityDimensionId, number>>;
  actionDurationPct?: number;
  actionBudgetPct?: number;
  actionSuccessModifier?: number;
  stakeholderMobilizationPct?: number;
};

/**
 * Modificateur structurel lisible par le joueur. Il peut être une donnée de
 * fond (intensité de base) ou devenir actif lorsque plusieurs conditions sont
 * franchies. Ses effets restent des ajustements bornés : ils ne remplacent
 * jamais les capacités, le budget ou les acteurs déjà simulés.
 */
export type StructuralModifierState = {
  id: string;
  countryId: CountryId;
  label: string;
  category: StructuralModifierCategory;
  summary: string;
  baselineIntensity: number;
  intensity: number;
  active: boolean;
  triggers: StructuralModifierTrigger[];
  effects: StructuralModifierEffects;
  appliesTo: CommonActionCategory[];
  source: string;
  lastUpdatedAt: ISODate;
  lastTransition?: 'activated' | 'intensified' | 'eased' | 'deactivated';
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
  | 'territorial_concession'
  | 'foreign_military_presence'
  | 'alliance_reorientation'
  | 'resource_sovereignty'
  | 'trade_opening'
  | 'technology_transfer'
  | 'security_guarantee'
  | 'diplomatic_deescalation'
  | 'status_humiliation'
  | 'labor_deregulation'
  | 'capital_controls'
  | 'administrative_reorganization'
  | 'austerity'
  | 'public_industrial_investment'
  | 'tax_increase_high_incomes'
  | 'fossil_expansion'
  | 'port_governance'
  | 'port_capacity_investment';

export type StakeholderGroup = {
  id: string;
  countryId: CountryId;
  label: string;
  category: StakeholderCategory;
  influence: number;
  /** Disposition cachée à transformer un désaccord en escalade publique ou opérationnelle. */
  escalationDisposition?: number;
  cohesion: number;
  baselineDefiance: number;
  sensitivities: Partial<Record<PolicySignal, number>>;
  influenceChannels: StakeholderInfluenceChannel[];
  possibleResponses: string[];
  /** Limite un acteur local au site concerné. */
  territorialAssetId?: string;
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
  /** Rapports internes ayant déclenché la réaction ; non affichés comme des scores au joueur. */
  actionGravity?: number;
  actorPressure?: number;
  stance?: 'opposition' | 'support';
};

export type GovernmentMeasure = {
  id: string;
  countryId: CountryId;
  title: string;
  subjectId: string;
  intensity: number;
  territorialAssetId?: string;
  signals: Array<{ signal: PolicySignal; weight: number }>;
  effects: WorldEffect[];
  /** Gravité explicite 0–5 ; sinon elle est dérivée de l'intensité et des signaux. */
  gravity?: number;
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
  /** Nombre de frontières mensuelles passées en phase de désescalade. */
  quietMonths?: number;
  /** Dernier arbitrage explicite du joueur, lorsqu'il dirige le pays concerné. */
  lastPlayerDecision?: PowerStrugglePlayerDecision;
  lastPlayerDecisionAt?: ISODate;
};

/**
 * Réponses courtes du joueur à une lutte de pouvoir. Elles ne remplacent pas
 * le dialogue libre avec l'IA : elles offrent un levier local, prévisible et
 * peu coûteux pour que la crise puisse réellement évoluer sans appel payant.
 */
export type PowerStrugglePlayerDecision = 'negotiate' | 'concede' | 'contain' | 'ignore';

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

/** Trace compacte d'une exécution IA, conservée avec la tâche pour que le
 * joueur puisse vérifier le coût et la latence sans exposer de secret. */
export type AIJobExecution = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  completedAt: ISODate;
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
  execution?: AIJobExecution;
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
    escalationDisposition: number;
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
  | 'consumer_goods'
  | 'industrial_inputs'
  | 'machinery_mobility'
  | 'advanced_electronics'
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

/**
 * Fenêtre de charge planifiable pour une filière stratégique.
 *
 * Elle ne prétend pas décrire chaque usine : elle empêche simplement qu'un
 * programme civil ou une décision autonome empile une charge infinie. Les
 * charges historiques déjà supérieures à cette fenêtre sont conservées puis
 * résorbées normalement par le moteur.
 */
export const MAX_STRATEGIC_SECTOR_WORKLOAD_MONTHS = 36;

/**
 * Intensité d’usage des intrants de 0 à 10. Ce ne sont pas encore des tonnes
 * ou des stocks physiques : elles bornent la montée technologique et seront
 * reliées aux fournisseurs, contrats et réserves dans le lot suivant.
 */
export type IndustrialInputRequirements = {
  industrialMetals: number;
  criticalMinerals: number;
  advancedComponents: number;
};

export type StrategicSectorState = {
  id: string;
  countryId: CountryId;
  sector: StrategicSectorId;
  capacity: number;
  utilization: number;
  workloadMonths: number;
  health: number;
  foreignDependency: number;
  /** Maturité fine 0–100 utilisée par les mécanismes historiques. */
  technology: number;
  /** Palier de production lisible, de 1 (élémentaire) à 10 (frontière). */
  technologyTier?: number;
  /** Demande matérielle dérivée du palier technologique. */
  inputRequirements?: IndustrialInputRequirements;
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
  | 'resource_prospection'
  | 'resource_development'
  | 'electrification'
  | 'economic_general'
  | 'policy_audit'
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

/** Voie de décision lisible par le joueur. L'exécutif reste la voie normale. */
export type ActionDecisionRoute =
  | 'executive'
  | 'executive_staff'
  | 'executive_institutional'
  | 'parliament'
  | 'intelligence_services';

/** Échelle à laquelle une action peut produire des conséquences. */
export type ActionScope = 'national' | 'bilateral' | 'regional' | 'global';

/** Projection de l'état d'une action dans son circuit de décision. */
export type ActionLifecycleStage =
  | 'draft'
  | 'confirmed'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';

export type ActionProgramStatus =
  | 'active'
  /** Texte déposé : aucun crédit ni moyen n'est engagé avant le vote. */
  | 'pending_parliament'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';

/** Rapport produit par une demande de connaissance avant toute réforme. */
export type GovernmentReportKind = 'audit' | 'prospection' | 'expertise' | 'renseignement';
export type GovernmentReportStatus = 'commissioned' | 'delivered' | 'incomplete' | 'cancelled';

/**
 * Preuve exploitable par le moteur. Le texte du rapport reste destiné au
 * joueur et à l'IA ; ce bloc empêche d'autoriser un projet par simple
 * recherche de mots dans une prose générée.
 */
export type OperationalProjectFinding = {
  projectType: 'resource_extraction';
  territoryId: string;
  territoryName: string;
  resource: string;
  viability: 'inconclusive' | 'conditional' | 'viable' | 'unviable';
  confidence: 'low' | 'medium' | 'high';
  /** Contraintes factuelles que le futur projet devra reprendre. */
  constraints: Array<'logistics' | 'environment' | 'security' | 'social_license' | 'finance'>;
  recommendedScale: 'pilot' | 'regional' | 'industrial';
  stakeholderIds?: string[];
  depositId?: string;
  basinId?: string;
  affectedTerritoryIds?: string[];
  claimantEntityIds?: string[];
  legalStatus?: 'undisputed' | 'contested' | 'shared' | 'occupied';
};

export type GovernmentReport = {
  id: string;
  kind: GovernmentReportKind;
  title: string;
  subject: string;
  actorId: CountryId;
  targetIds: EntityId[];
  programId: string;
  linkedDossierId?: string;
  commissionedAt: ISODate;
  dueAt: ISODate;
  status: GovernmentReportStatus;
  executiveSummary: string;
  findings: string[];
  recommendations: string[];
  confidence?: 'low' | 'medium' | 'high';
  operationalFinding?: OperationalProjectFinding;
  deliveredAt?: ISODate;
};

export type TerritorialProjectRiskId = 'logistics' | 'environment' | 'security' | 'social_license' | 'finance';
export type TerritorialProjectPhase = 'preparation' | 'construction' | 'commissioning' | 'operating' | 'suspended' | 'closed';
export type TerritorialProjectStatus = 'active' | 'awaiting_decision' | 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';
export type TerritorialProjectEventFamily =
  | 'logistics_bottleneck'
  | 'environmental_alert'
  | 'security_pressure'
  | 'community_opposition'
  | 'cost_overrun'
  | 'resource_upgrade';

/** Sujet territorial extrait de l'intention et validé par un rapport. */
export type TerritorialProjectPlan = {
  projectType: 'resource_extraction';
  territoryId: string;
  territoryName: string;
  resource: string;
  scale: 'pilot' | 'regional' | 'industrial';
  /** Montage choisi avant confirmation ; le moteur l'applique à tous les projets localisés. */
  deliveryModel: TerritorialProjectDeliveryModel;
  evidenceReportId: string;
  depositId?: string;
  basinId?: string;
  affectedTerritoryIds?: string[];
  claimantEntityIds?: string[];
  legalStatus?: 'undisputed' | 'contested' | 'shared' | 'occupied';
};

export type TerritorialProjectDeliveryModel = 'public' | 'private' | 'mixed';

export type TerritorialProjectActorKind =
  | 'central_state'
  | 'local_authority'
  | 'operator'
  | 'labor'
  | 'environmental'
  | 'political'
  | 'claimant_state'
  | 'security_network'
  | 'community'
  | 'judiciary';

export type TerritorialProjectActorStatus = 'watching' | 'consulting' | 'demanding' | 'opposing' | 'coercive';

/** Acteur activé par les conditions réelles du territoire et du projet. */
export type TerritorialProjectActor = {
  id: string;
  kind: TerritorialProjectActorKind;
  name: string;
  role: string;
  interest: string;
  demand: string;
  status: TerritorialProjectActorStatus;
  influence: number;
  leverage: number;
  pressure: number;
  /** États déjà signalés dans le dossier, pour éviter les doublons à chaque tour. */
  notifiedStatuses: TerritorialProjectActorStatus[];
  lastUpdatedAt: ISODate;
};

/** Effets bornés qu'une option peut avoir sur le projet et sur le monde. */
export type TerritorialProjectChoiceImpact = {
  additionalBudgetCost: number;
  delayMonths: number;
  riskDeltas: Partial<Record<TerritorialProjectRiskId, number>>;
  outputPotentialDelta: number;
  socialAcceptanceDelta: number;
  environmentalSafeguardsDelta: number;
  securityControlDelta: number;
  nationalStabilityDelta?: number;
  internationalReputationDelta?: number;
};

export type TerritorialProjectDecisionOption = {
  id: string;
  label: string;
  summary: string;
  impact: TerritorialProjectChoiceImpact;
};

export type TerritorialProjectPendingDecision = {
  id: string;
  family: TerritorialProjectEventFamily;
  title: string;
  factualBrief: string;
  occurredAt: ISODate;
  options: TerritorialProjectDecisionOption[];
  /** Le chantier ne s’arrête pas : ce compteur rend le coût de l’inaction visible. */
  unresolvedMonths: number;
  /** L'IA transforme ce cadre factuel en scène et positions d'acteurs. */
  aiNarrativeStatus: 'required' | 'ready';
  aiNarrative?: string;
};

export type TerritorialProject = {
  id: string;
  programId: string;
  dossierId: string;
  actorId: CountryId;
  projectType: 'resource_extraction';
  territoryId: string;
  territoryName: string;
  anchor: [number, number] | null;
  resource: string;
  scale: 'pilot' | 'regional' | 'industrial';
  deliveryModel: TerritorialProjectDeliveryModel;
  evidenceReportId: string;
  depositId?: string;
  basinId?: string;
  affectedTerritoryIds?: string[];
  claimantEntityIds?: string[];
  legalStatus?: 'undisputed' | 'contested' | 'shared' | 'occupied';
  phase: TerritorialProjectPhase;
  status: TerritorialProjectStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  progressPct: number;
  delayMonths: number;
  initialBudgetCost: number;
  additionalBudgetCost: number;
  risks: Record<TerritorialProjectRiskId, number>;
  outputPotential: number;
  socialAcceptance: number;
  environmentalSafeguards: number;
  securityControl: number;
  /** Qualité de la maîtrise publique et contractuelle du projet. */
  governanceScore?: number;
  /** Indicateurs préparatoires ; ils alimenteront les flux de production futurs. */
  budgetLeakagePct?: number;
  outputLeakagePct?: number;
  /** Acteurs et demandes persistantes du projet, communs à tous les secteurs. */
  actors: TerritorialProjectActor[];
  eventHistory: Array<{
    id: string;
    family: TerritorialProjectEventFamily;
    date: ISODate;
    title: string;
    summary: string;
    selectedOptionId?: string;
    selectedOptionLabel?: string;
  }>;
  pendingDecision?: TerritorialProjectPendingDecision;
  /** Bilan transversal conservé à la clôture et lisible par l'IA. */
  outcome?: {
    economic: string;
    social: string;
    environmental: string;
    security: string;
    political: string;
    governance: string;
    international: string;
  };
};

/** État comptable du budget d'un programme. Le coût est un coût de lancement,
 * pas un prélèvement mensuel implicite. */
export type ActionBudgetStatus = 'not_committed' | 'consumed';

/** Levier volontaire du joueur sur une crise mondiale suivie. */
export type WorldCrisisInfluenceKind = 'mediation' | 'material_response';

/** Effet borné d'un programme français sur le dossier mondial auquel il est rattaché. */
export type WorldCrisisInfluenceSpec = {
  kind: WorldCrisisInfluenceKind;
  label: string;
  summary: string;
  pressureDeltaOnSuccess: number;
  cooperationDeltaOnSuccess: number;
  playerExposureMitigationOnSuccess: number;
  pressureDeltaOnPartial: number;
  cooperationDeltaOnPartial: number;
  playerExposureMitigationOnPartial: number;
};

/** État des moyens administratifs/opérationnels réservés par un programme. */
export type ActionResourceStatus = 'not_committed' | 'committed' | 'released';

/**
 * Réponse internationale différée à une décision du pays joué. Elle conserve
 * une lecture politique bornée : les observateurs prennent position, mais
 * aucun canal diplomatique n'est créé sans initiative explicite du joueur.
 */
export type GeopoliticalReactionPosture = 'support' | 'caution' | 'concern' | 'opposition';

export type GeopoliticalReactionState = {
  status: 'scheduled' | 'resolved';
  /** Délai de lecture politique après le lancement matériel du programme. */
  delayMonths: number;
  dueAt: ISODate;
  observers: Array<{
    countryId: CountryId;
    posture: GeopoliticalReactionPosture;
    rationale: string;
  }>;
  resolvedAt?: ISODate;
};

export type ActionProgram = {
  id: string;
  category: CommonActionCategory;
  /** Optional for migration of older saves; every newly prepared program has one. */
  lever?: CommonActionLever;
  actorId: CountryId;
  targetIds: EntityId[];
  /** Actif territorial ciblé par un programme d’exploitation, si applicable. */
  territorialAssetId?: string;
  /** Projet territorial créé au lancement pour les investissements localisés. */
  territorialProjectId?: string;
  /** Plan vérifié lors de la préparation ; sa preuve est revalidée au lancement. */
  territorialProjectPlan?: TerritorialProjectPlan;
  /** Opération résolue sur l'état actuel du port, pas sur sa photographie initiale. */
  portOperation?: import('./territorial-assets').PortActionKind;
  /** Dossier stratégique à l'origine du programme, lorsqu'il existe. */
  linkedDossierId?: string;
  /** Influence explicite et bornée sur une crise mondiale ; jamais déduite d'un simple ordre libre. */
  worldCrisisInfluence?: WorldCrisisInfluenceSpec;
  /** Posture choisie par le joueur quand le dossier est un ancrage historique. */
  historicalIntent?: HistoricalInterventionDirection;
  /** Une délégation agit sur le même dossier, mais avec un effet volontairement réduit. */
  historicalContributionScale?: number;
  title: string;
  intent: string;
  /** Intention de réforme validée. Lorsqu'elle existe, aucune déduction par
   * mots-clés n'est autorisée pendant l'exécution ou la résolution. */
  reformIntent?: StructuredReformIntent;
  /** Domaine explicite d'un audit de politique publique. */
  policyDomain?: NationalReformDomain;
  reformBaseline?: NationalReformSnapshot;
  reformOutcome?: NationalReformOutcomeSummary;
  startedAt: ISODate;
  expectedCompletionAt: ISODate;
  durationMonths: number;
  progressMonths: number;
  status: ActionProgramStatus;
  /** Procédure nationale qui doit aboutir avant le lancement matériel. */
  parliamentaryProcessId?: string;
  requiredCapacities: Array<{ domain: CapacityDomainId; commitment: number }>;
  budgetCost: number;
  /** Présent uniquement pour les programmes définis du module Capacités. */
  capacityDevelopment?: CapacityDevelopmentSpec;
  /** Présent uniquement pour une injection de secours temporaire. */
  emergencyCapacitySupport?: EmergencyCapacitySupport;
  successProbability: number;
  risks: string[];
  /** Signaux politiques utilisés pour faire réagir les corps organisés. */
  policySignals?: Array<{ signal: PolicySignal; weight: number }>;
  /** Gravité de la réaction attendue, 0–5 ; absente = calculée à partir des signaux. */
  gravity?: number;
  /** Photo de faisabilité au moment où le programme a été préparé. */
  politicalAssessment?: {
    pathwayStatus: PoliticalPathway['status'];
    requiredAuthority?: PoliticalActionProfile['requiredAuthority'];
    doctrineCompatibility: number;
    institutionalFeasibility: number;
    leaderDisposition: number;
    apparatusSupport: number;
    finalScore: number;
    blocked: boolean;
    reasons: string[];
  };
  /** Influence structurelle de l'appareil d'État au moment de la préparation. */
  governmentCapacityAssessment?: ActionGovernmentCapacityAssessment;
  successEffects: WorldEffect[];
  partialEffects: WorldEffect[];
  resolution?: string;
  /** Intention vérifiée à l'origine du programme, sans effets exécutables. */
  intentSpec?: import('./action-intents').ActionIntent;
  /** Parcours institutionnel retenu par le moteur au moment de la préparation. */
  decisionRoute?: ActionDecisionRoute;
  /** Portée prévisible ; elle ne modifie pas le monde avant la résolution. */
  scope?: ActionScope;
  /** Date à laquelle le joueur a confirmé la proposition. */
  confirmedAt?: ISODate;
  /** Le budget n'est consommé qu'au lancement matériel (après vote si requis). */
  budgetStatus?: ActionBudgetStatus;
  /** Date du débit effectif des crédits, distincte de la confirmation. */
  budgetConsumedAt?: ISODate;
  /** Les capacités sont réservées au lancement matériel puis libérées à la fin. */
  resourceStatus?: ActionResourceStatus;
  /** Date de réservation effective des capacités. */
  resourcesCommittedAt?: ISODate;
  /** Date de libération des capacités, par résolution ou annulation. */
  resourcesReleasedAt?: ISODate;
  /** Motif affichable lorsque le joueur interrompt le programme. */
  cancellationReason?: string;
  observedEffects?: string[];
  /** Suivi compact des conséquences réelles, conservé dans les sauvegardes. */
  execution?: {
    lastAdvancedAt: ISODate;
    delayMonths: number;
    resistance: number;
    support: number;
    effectiveSuccessProbability: number;
    /** Nombre de contretemps à l'échéance. Un contretemps reporte le programme,
     * il ne l'annule pas. */
    setbackCount?: number;
    actorLabels: string[];
    lastResponseAt?: ISODate;
    lastResponse?: 'consult' | 'maintain';
    events: Array<{ date: ISODate; summary: string }>;
  };
  /** Réactions étrangères attendues après une initiative qui les expose réellement. */
  geopoliticalReaction?: GeopoliticalReactionState;
  /** Projection consultative affichée avant l'application des effets. */
  impactPreview?: {
    national: string[];
    international: string[];
    appliesAt: string;
  };
  /** Commande locale de mouvement militaire, résolue par le programme. */
  militaryOperation?: MilitaryTheaterOperation;
};

/**
 * Référentiel opérationnel du renseignement. Les valeurs de personnel et de
 * budget sont des ordres de grandeur internes au prototype : elles servent à
 * calibrer les coûts et ne prétendent pas décrire des effectifs secrets réels.
 */
export type IntelligenceAgencyDomain = 'domestic' | 'external' | 'military';
export type IntelligenceCoverageBand = 'absente' | 'limitée' | 'établie' | 'profonde';
export type IntelligenceMissionKind = 'surveillance' | 'réseau' | 'liaison' | 'terrain' | 'analyse';

export type IntelligenceAgencyState = {
  id: string;
  countryId: CountryId;
  /** Nom affichable à la date courante (ex. DST avant 2014, DGSI ensuite). */
  name: string;
  domain: IntelligenceAgencyDomain;
  personnelOrder: number;
  surveillancePersonnelOrder: number;
  fieldPersonnelOrder: number;
  networkPersonnelOrder: number;
  operationalBudgetBillion: number;
  technicalLevel: number;
  readiness: number;
  legalMandate: string;
  politicalOversight: string;
  specialties: string[];
  coverage: Record<string, IntelligenceCoverageBand>;
};

export type IntelligenceMissionState = {
  id: string;
  agencyId: string;
  actorCountryId: CountryId;
  targetCountryId?: CountryId;
  targetRegion?: string;
  kind: IntelligenceMissionKind;
  objective: string;
  status: 'prepared' | 'active' | 'completed' | 'failed' | 'cancelled';
  startedAt?: ISODate;
  expectedCompletionAt?: ISODate;
  personnelCommitted: number;
  budgetCost: number;
  risk: number;
};

export type IntelligenceServiceState = {
  countryId: CountryId;
  agencies: Record<string, IntelligenceAgencyState>;
  missions: Record<string, IntelligenceMissionState>;
  regionalCoverage: Record<string, IntelligenceCoverageBand>;
  lastUpdated: ISODate;
};

export type MilitaryTheaterStatus = 'home' | 'active' | 'reserve' | 'withdrawn';
export type MilitaryTheaterAccess = 'national' | 'host_consent' | 'allied' | 'contested' | 'denied' | 'unknown';
export type MilitaryTheaterActionKind = 'reinforce' | 'withdraw' | 'redeploy';
export type MilitaryBaseStatus = 'active' | 'restricted' | 'closed';
export type MilitaryBaseType = 'permanent' | 'prepositioned' | 'support';

export type MilitaryBase = {
  id: string;
  ownerCountryId: CountryId;
  hostCountryId: CountryId;
  location: string;
  type: MilitaryBaseType;
  capacityThousands: number;
  assignedPersonnelThousands: number;
  status: MilitaryBaseStatus;
  access: MilitaryTheaterAccess;
  mission: string;
  agreementStartAt?: ISODate;
  agreementEndAt?: ISODate;
};

export type MilitaryTheaterOperation = {
  id: string;
  programId?: string;
  kind: MilitaryTheaterActionKind;
  sourceTheaterId: string;
  targetTheaterId: string;
  amountThousands: number;
  startedAt: ISODate;
  completesAt: ISODate;
};

/** État dynamique d'un théâtre : la fiche 2000 sert de base, ces valeurs évoluent. */
export type MilitaryTheater = {
  id: string;
  countryId: CountryId;
  location: string;
  hostCountryIds: CountryId[];
  personnelThousands: number;
  availablePersonnelThousands: number;
  inTransitPersonnelThousands: number;
  mission: string;
  status: MilitaryTheaterStatus;
  readiness: number;
  supplyCoverageMonths: number;
  access: MilitaryTheaterAccess;
  baseIds?: string[];
  currentOperation?: MilitaryTheaterOperation;
};

/**
 * Zone de guerre légère : une maille opérationnelle entre le dossier
 * diplomatique et le front tactique. Elle porte uniquement les effets
 * économiques et logistiques nécessaires au bac à sable ; elle ne simule pas
 * chaque bataille.
 */
export type WarZoneIntensity = 'low' | 'moderate' | 'high' | 'critical';
export type WarZoneStatus = 'active' | 'resolved';

export type WarZone = {
  id: string;
  name: string;
  countryIds: CountryId[];
  territoryIds: string[];
  theaterIds: string[];
  intensity: WarZoneIntensity;
  economicDisruptionPct: number;
  supplyMultiplier: number;
  status: WarZoneStatus;
  startedAt: ISODate;
  updatedAt: ISODate;
  expectedEndAt?: ISODate;
  dossierId?: string;
  /** Valeurs restaurées automatiquement lorsque le dossier se termine. */
  baselineGrowthAnnualPct: Partial<Record<CountryId, number>>;
  baselineInflationAnnualPct: Partial<Record<CountryId, number>>;
  baselineSupplyCoverageMonths: Partial<Record<string, number>>;
};

/**
 * Le Parlement est une donnée de simulation distincte de la simple jauge de
 * soutien politique. Il permet à une mesure de prendre du temps, d'être
 * amendée ou rejetée, sans retirer au joueur le droit de la proposer.
 */
export type ParliamentaryBlocRole = 'government' | 'support' | 'opposition' | 'non_aligned' | 'vacant';

export type ParliamentaryBlocState = {
  id: string;
  label: string;
  shortLabel: string;
  seats: number;
  color: string;
  role: ParliamentaryBlocRole;
  leader: string;
  orientation: string;
  priorities: string[];
  redLines: string[];
  /** Cohésion du groupe lors d'un vote, de 0 à 100. */
  discipline: number;
};

export type ParliamentaryProcedureStage = 'draft' | 'committee' | 'vote_scheduled' | 'adopted' | 'amended' | 'rejected' | 'withdrawn';
export type ParliamentaryProcedureKind = 'law' | 'budget' | 'constitutional';

/**
 * Une commission ne produit pas un second jeu de popularité : elle formule
 * une demande concrète, portée par des groupes parlementaires et, lorsque
 * c'est pertinent, par une mobilisation déjà présente dans le pays.
 */
export type ParliamentaryCommitteeCondition = {
  id: string;
  title: string;
  summary: string;
  requestedByBlocIds: string[];
  stakeholderReactionIds: string[];
  amendment: string;
  /** Surcoût de mise en œuvre, engagé uniquement si le texte est adopté. */
  budgetDelta: number;
  /** Allongement de l'exécution après l'adoption. */
  durationDeltaMonths: number;
  /** Effet direct sur la disposition des groupes explicitement concernés. */
  blocScoreDeltas: Array<{ blocId: string; delta: number }>;
};

export type ParliamentaryProcedure = {
  id: string;
  programId: string;
  countryId: CountryId;
  title: string;
  kind: ParliamentaryProcedureKind;
  stage: ParliamentaryProcedureStage;
  submittedAt: ISODate;
  committeeAt: ISODate;
  voteAt: ISODate;
  majorityThreshold: number;
  estimatedVotes: number;
  supportByBloc: Array<{ blocId: string; estimatedVotes: number; disposition: 'support' | 'conditional' | 'oppose' }>;
  amendments: string[];
  /** Une ou deux demandes maximum : le compromis reste lisible. */
  committeeConditions?: ParliamentaryCommitteeCondition[];
  acceptedCommitteeConditionIds?: string[];
  declinedCommitteeConditionIds?: string[];
  summary: string;
  resolution?: string;
};

export type NationalPoliticalState = {
  countryId: CountryId;
  legislatureLabel: string;
  compositionVersion: number;
  compositionDate: ISODate;
  governmentBlocIds: string[];
  blocs: ParliamentaryBlocState[];
  procedures: Record<string, ParliamentaryProcedure>;
  politicalMomentum: number;
  lastElectionOutcome?: 'renewal' | 'alternation';
};

/**
 * Fait daté, déjà survenu et sans boucle de suivi. Les conséquences durables
 * éventuelles vivent dans les systèmes concernés ou dans un dossier distinct,
 * mais un événement ne devient jamais lui-même une tâche pour le joueur.
 */
export type WorldEvent = {
  id: string;
  date: ISODate;
  title: string;
  summary: string;
  /** Situation persistante alimentée par ce fait, s’il y en a une. */
  dossierId?: string;
  importance: 'major' | 'moderate' | 'minor';
  scope: 'national' | 'world';
  actorIds: EntityId[];
  source: 'system' | 'historical' | 'player';
  /** Localisation optionnelle d'un fait territorial pour la carte. */
  territoryId?: string;
  anchor?: [number, number] | null;
};

export type WorldEffect =
  | { kind: 'date_set'; date: ISODate; reason: string; visibility?: Visibility }
  | { kind: 'processed_stop_add'; stopId: string; reason: string; visibility?: Visibility }
  | { kind: 'world_event_add'; event: WorldEvent; reason: string; visibility?: Visibility }
  | { kind: 'metric_delta'; countryId: CountryId; metric: WorldMetric; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'fiscal_delta'; countryId: CountryId; bucket: 'discretionary' | 'emergency_reserve' | 'recurring_costs' | 'recurring_savings'; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'fiscal_patch'; countryId: CountryId; patch: Partial<FiscalState>; reason: string; visibility?: Visibility }
  | { kind: 'politics_patch'; countryId: CountryId; patch: Partial<PoliticalSystem>; reason: string; visibility?: Visibility }
  | { kind: 'leadership_patch'; countryId: CountryId; patch: Partial<CountryLeadership>; reason: string; visibility?: Visibility }
  | { kind: 'political_apparatus_patch'; countryId: CountryId; patch: Partial<PoliticalApparatusProfile>; reason: string; visibility?: Visibility }
  | { kind: 'political_cycle_patch'; countryId: CountryId; patch: Partial<PoliticalCycle>; reason: string; visibility?: Visibility }
  | { kind: 'national_politics_patch'; countryId: CountryId; patch: Partial<Omit<NationalPoliticalState, 'countryId' | 'procedures'>>; reason: string; visibility?: Visibility }
  | { kind: 'parliamentary_procedure_add'; countryId: CountryId; procedure: ParliamentaryProcedure; reason: string; visibility?: Visibility }
  | { kind: 'parliamentary_procedure_patch'; countryId: CountryId; procedureId: string; patch: Partial<ParliamentaryProcedure>; reason: string; visibility?: Visibility }
  | { kind: 'country_strategy_patch'; countryId: CountryId; patch: Partial<CountryStrategy>; reason: string; visibility?: Visibility }
  | { kind: 'capacity_commitment'; countryId: CountryId; domain: CapacityDomainId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'capacity_maximum'; countryId: CountryId; domain: CapacityDomainId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'capacity_maintenance_add'; countryId: CountryId; commitment: CapacityMaintenanceCommitment; reason: string; visibility?: Visibility }
  | { kind: 'capacity_overload_patch'; countryId: CountryId; domain: CapacityDomainId; patch: { overloadMonths?: number; efficiencyPct?: number; lastOverloadAt?: ISODate | null }; reason: string; visibility?: Visibility }
  | { kind: 'relation_delta'; from: CountryId; to: CountryId; relation: number; trust: number; reason: string; visibility?: Visibility }
  | { kind: 'intelligence_delta'; observerId: CountryId; targetId: CountryId; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'institution_patch'; institutionId: string; patch: Partial<InstitutionState>; reason: string; visibility?: Visibility }
  | { kind: 'treaty_add'; treaty: TreatyState; reason: string; visibility?: Visibility }
  | { kind: 'treaty_patch'; treatyId: string; patch: Partial<TreatyState>; reason: string; visibility?: Visibility }
  | { kind: 'international_organization_patch'; organizationId: string; patch: Partial<InternationalOrganizationState>; reason: string; visibility?: Visibility }
  | { kind: 'historical_pressure'; currentId: string; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'historical_anchor_patch'; anchorId: string; patch: Partial<HistoricalAnchor>; reason: string; visibility?: Visibility }
  | { kind: 'latent_process_patch'; processId: string; patch: Partial<LatentProcess>; reason: string; visibility?: Visibility }
  | { kind: 'energy_contract_add'; contract: EnergyContract; reason: string; visibility?: Visibility }
  | { kind: 'energy_contract_patch'; contractId: string; patch: Partial<EnergyContract>; reason: string; visibility?: Visibility }
  | { kind: 'energy_node_patch'; nodeId: string; patch: Partial<EnergyNode>; reason: string; visibility?: Visibility }
  | { kind: 'territorial_asset_patch'; assetId: string; patch: { status?: 'operating' | 'closed' | 'damaged'; operation?: Partial<TerritorialAssetOperation>; portProfile?: Partial<TerritorialPortProfile> }; reason: string; visibility?: Visibility }
  | { kind: 'territory_transfer'; territoryId: string; mode: 'cession' | 'occupation' | 'liberation'; targetCountryId: CountryId; reason: string; visibility?: Visibility }
  | { kind: 'energy_stock_delta'; countryId: CountryId; resource: EnergyResource; delta: number; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_session_add'; session: DiplomaticSession; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_session_patch'; sessionId: string; patch: Partial<DiplomaticSession>; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_dialogue_add'; dialogue: DiplomaticDialogue; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_dialogue_patch'; dialogueId: string; patch: Partial<DiplomaticDialogue>; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_brief_add'; brief: DiplomaticBrief; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_meeting_add'; meeting: DiplomaticMeeting; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_meeting_patch'; meetingId: string; patch: Partial<DiplomaticMeeting>; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_agreement_draft_add'; draft: DiplomaticAgreementDraft; reason: string; visibility?: Visibility }
  | { kind: 'diplomatic_agreement_draft_patch'; draftId: string; patch: Partial<DiplomaticAgreementDraft>; reason: string; visibility?: Visibility }
  | { kind: 'sector_patch'; sectorId: string; patch: Partial<StrategicSectorState>; reason: string; visibility?: Visibility }
  | { kind: 'sector_delta'; sectorId: string; delta: Partial<Record<'capacity' | 'utilization' | 'workloadMonths' | 'health' | 'foreignDependency' | 'technology', number>>; reason: string; visibility?: Visibility }
  | { kind: 'armament_patch'; productId: string; patch: Partial<ArmamentProduct>; reason: string; visibility?: Visibility }
  | { kind: 'dossier_add'; dossier: StrategicDossier; reason: string; visibility?: Visibility }
  | {
    kind: 'dossier_patch';
    dossierId: string;
    patch: Partial<StrategicDossier>;
    /** Champs optionnels supprimés explicitement afin de survivre à JSON. */
    clear?: Array<keyof StrategicDossier>;
    reason: string;
    visibility?: Visibility;
  }
  | { kind: 'dossier_entry_add'; dossierId: string; entry: DossierEntry; reason: string; visibility?: Visibility }
  | { kind: 'macro_patch'; countryId: CountryId; patch: Partial<MacroeconomicState>; reason: string; visibility?: Visibility }
  | { kind: 'aggregate_sector_delta'; countryId: CountryId; sector: AggregateSectorId; delta: Partial<Record<'capacityIndex' | 'utilizationPct' | 'productivityIndex' | 'employmentSharePct', number>>; reason: string; visibility?: Visibility }
  | { kind: 'macro_policy_delta'; countryId: CountryId; patch: Partial<EconomicPolicyState>; reason: string; visibility?: Visibility }
  | { kind: 'trade_flow_add'; flow: BilateralTradeFlow; reason: string; visibility?: Visibility }
  | { kind: 'trade_flow_patch'; flowId: string; patch: Partial<BilateralTradeFlow>; reason: string; visibility?: Visibility }
  | { kind: 'world_economy_patch'; patch: Partial<WorldEconomyState>; reason: string; visibility?: Visibility }
  | { kind: 'structural_profile_patch'; countryId: CountryId; patch: Partial<CountryStructuralProfile>; reason: string; visibility?: Visibility }
  | { kind: 'structural_modifier_patch'; countryId: CountryId; modifierId: string; patch: Partial<StructuralModifierState>; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_group_add'; group: StakeholderGroup; reason: string; visibility?: Visibility }
  | { kind: 'stakeholder_group_patch'; groupId: string; patch: Partial<StakeholderGroup>; reason: string; visibility?: Visibility }
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
  | { kind: 'action_program_patch'; programId: string; patch: Partial<ActionProgram>; reason: string; visibility?: Visibility }
  | { kind: 'territorial_project_add'; project: TerritorialProject; reason: string; visibility?: Visibility }
  | { kind: 'territorial_project_patch'; projectId: string; patch: Partial<TerritorialProject>; reason: string; visibility?: Visibility }
  | { kind: 'military_theater_add'; theater: MilitaryTheater; reason: string; visibility?: Visibility }
  | { kind: 'military_theater_patch'; theaterId: string; patch: Partial<MilitaryTheater>; reason: string; visibility?: Visibility }
  | { kind: 'military_base_add'; base: MilitaryBase; reason: string; visibility?: Visibility }
  | { kind: 'military_base_patch'; baseId: string; patch: Partial<MilitaryBase>; reason: string; visibility?: Visibility }
  | { kind: 'war_zone_add'; warZone: WarZone; reason: string; visibility?: Visibility }
  | { kind: 'war_zone_patch'; warZoneId: string; patch: Partial<WarZone>; reason: string; visibility?: Visibility };

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
export type DossierScope = 'world' | 'national' | 'player_involved';

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
  /** Provenance conservée pour distinguer une évolution du monde d’une réponse du joueur. */
  origin?: ActionOrigin;
  actorId?: CountryId;
};

export type DossierDecisionUrgency = 'low' | 'medium' | 'high' | 'critical';
export type DossierDecisionChannel = 'local_action' | 'dialogue' | 'delegation' | 'explicit_silence';
export type DossierDecisionSourceKind = 'legacy' | 'world_pulse' | 'autonomous_program' | 'historical' | 'player_action' | 'diplomatic_response';

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

/** Étapes lisibles d'une crise militaire. La dernière étape n'est jamais
 * déduite d'une simple tension : elle exige un seuil d'action confirmé. */
export type ConflictEscalationStage = 'rivalry' | 'pressure' | 'crisis' | 'military_preparation' | 'confrontation' | 'war';

/**
 * Une réaction extérieure est un fait diplomatique visible, pas une entrée
 * automatique dans le conflit. Elle permet au joueur de voir qui observe,
 * avertit ou condamne sans simuler une coalition entière à chaque incident.
 */
export type ExternalConflictReaction = {
  actorId: EntityId;
  actorLabel: string;
  role: 'leading_power' | 'ranked_power' | 'regional_actor' | 'organization';
  posture: 'observation' | 'private_warning' | 'public_warning' | 'condemnation' | 'mediation';
  summary: string;
  relevance: string;
  date: ISODate;
};

/** But politique poursuivi par un gouvernement dans une crise. Il ne décrit
 * jamais une manoeuvre tactique : il donne au moteur une condition de sortie
 * lisible et laisse au joueur toute liberté dans les moyens choisis. */
export type ConflictObjectiveKind =
  | 'demonstration_of_force'
  | 'resource_access'
  | 'territorial_control'
  | 'regime_change'
  | 'security_guarantee'
  | 'negotiated_settlement'
  | 'other';

export type ConflictPoliticalObjective = {
  kind: ConflictObjectiveKind;
  statement: string;
  progress: number;
  status: 'planned' | 'pursuing' | 'achieved' | 'blocked' | 'abandoned';
  definedAt: ISODate;
  updatedAt: ISODate;
};

/** Lecture stratégique compacte, volontairement distincte d'un simulateur de bataille. */
export type ConflictSituation = {
  militaryBalance: number;
  logisticalSustainment: number;
  domesticSupport: number;
  targetResistance: number;
  internationalPressure: number;
  monthlyBudgetCost: number;
  assessment: string;
  updatedAt: ISODate;
};

/** Décision politique prise une fois qu'une crise armée a atteint un seuil.
 * Elle ne vaut ni traité, ni reconnaissance internationale : elle explique
 * seulement la ligne effectivement retenue par le gouvernement. */
export type ConflictExitChoice = 'consolidate' | 'negotiate' | 'withdraw' | 'armed_stalemate' | 'continue';

export type ConflictExitState = {
  choice: ConflictExitChoice;
  status: 'implemented' | 'awaiting_negotiation' | 'ongoing';
  chosenAt: ISODate;
  summary: string;
  enduringConsequences: string[];
};

export type ConflictEscalationState = {
  stage: ConflictEscalationStage;
  updatedAt: ISODate;
  /** Programme ou directive ayant fait monter le dossier au stade courant. */
  triggerId?: string;
  /** Une zone de guerre n'est autorisée qu'après ce seuil explicite. */
  warThresholdConfirmed?: boolean;
  /** Réactions extérieures sélectionnées : peu nombreuses et motivées. */
  externalReactions?: ExternalConflictReaction[];
  /** Classement conservé avec la crise pour rendre l'intervention lisible. */
  powerRankingSnapshot?: Array<{ countryId: CountryId; rank: number; score: number }>;
  objective?: ConflictPoliticalObjective;
  situation?: ConflictSituation;
  /** Ligne de sortie retenue par le joueur ; les éventuels termes restent à négocier. */
  exit?: ConflictExitState;
};

/** Posture d'un acteur dans un dossier mondial autonome. Elle décrit une
 * action politique observable, sans ouvrir ni simuler un canal diplomatique. */
export type WorldCrisisActorPosture = {
  countryId: CountryId;
  stance: 'coordinate' | 'compete' | 'contain' | 'harden' | 'wait';
  summary: string;
};

/**
 * État compact d'une crise mondiale. Les jalons historiques ne font que
 * l'ouvrir ; ses évolutions ultérieures se fondent sur le monde simulé.
 */
export type WorldCrisisState = {
  mode: 'resource_market' | 'political_transition' | 'regional_integration' | 'diplomatic_crisis' | 'security_balance' | 'regional_cooperation';
  pressure: number;
  cooperation: number;
  materialStress: number;
  politicalResolve: number;
  actorPostures: WorldCrisisActorPosture[];
  lastDriverSummary: string;
  lastAdvancedAt: ISODate;
  nextReviewAt: ISODate;
  /** Conséquences appliquées une seule fois et conservées dans le monde. */
  appliedOutcomes: string[];
  /** Protection française acquise contre les retombées de cette crise (0–100), sans prétendre changer seule le monde. */
  playerExposureMitigation?: number;
  /** Date de la dernière déclaration publique française sur ce dossier. */
  lastPublicPositionAt?: ISODate;
};

export type StrategicDossier = {
  id: string;
  title: string;
  kind: DossierKind;
  status: 'emerging' | 'active' | 'deescalating' | 'resolved';
  importance: DossierImportance;
  /** Périmètre de suivi ; absent dans les anciennes sauvegardes et alors inféré. */
  scope?: DossierScope;
  /** Dossier mondial à l’origine d’une déclinaison nationale éventuelle. */
  parentDossierId?: string;
  /** Identifiant du choc économique qui a ouvert le dossier, si applicable. */
  sourceShockId?: string;
  /** Frontière à laquelle le choc source a cessé d’être actif. */
  sourceShockEndedAt?: ISODate;
  actorIds: EntityId[];
  regionTags: string[];
  startedAt: ISODate;
  updatedAt: ISODate;
  phase: string;
  trend: 'escalating' | 'stable' | 'deescalating';
  /** Présent uniquement pour les dossiers de conflit suivis. */
  conflictState?: ConflictEscalationState;
  /** Présent pour les crises mondiales ayant une boucle autonome. */
  worldCrisisState?: WorldCrisisState;
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
  /** Dossier volontairement retiré de la file active tant qu’il ne requiert pas le pays joué. */
  ignoredAt?: ISODate;
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
  /** Services et missions de renseignement ; optionnel pour migrer les anciennes sauvegardes. */
  intelligenceServices?: Record<CountryId, IntelligenceServiceState>;
  institutions: Record<string, InstitutionState>;
  treaties: Record<string, TreatyState>;
  internationalOrganizations?: Record<string, InternationalOrganizationState>;
  /** Dernière date à laquelle le joueur a consulté le volet des organisations. */
  internationalOrganizationsReadAt?: ISODate;
  historicalCurrents: Record<string, HistoricalCurrent>;
  historicalAnchors: Record<string, HistoricalAnchor>;
  latentProcesses: Record<string, LatentProcess>;
  energyNodes: Record<string, EnergyNode>;
  energyContracts: Record<string, EnergyContract>;
  baselineEnergyFlows: Record<string, BaselineEnergyFlow>;
  countryEnergy: Record<CountryId, CountryEnergyState>;
  /** Réserves géologiques d'or par pays, sans production ni prix de marché. */
  goldStocks?: Record<CountryId, GoldCountryStock>;
  /** Registre commun des ressources, bassins, gisements et juridictions. */
  resources?: ResourceState;
  macroEconomies: Record<CountryId, MacroeconomicState>;
  worldEconomy: WorldEconomyState;
  tradeFlows: Record<string, BilateralTradeFlow>;
  decisionProfiles: Record<CountryId, CountryDecisionProfile>;
  leadership: Record<CountryId, CountryLeadership>;
  politicalCycles: Record<CountryId, PoliticalCycle>;
  politicalApparatus: Record<CountryId, PoliticalApparatusProfile>;
  /** États disposant d'une boucle parlementaire détaillée. La France ouvre le prototype. */
  nationalPolitics: Record<CountryId, NationalPoliticalState>;
  structuralProfiles: Record<CountryId, CountryStructuralProfile>;
  /** Tensions nationales dérivées des données simulées, par pays. */
  structuralModifiers?: Record<CountryId, StructuralModifierState[]>;
  stakeholderGroups: Record<string, StakeholderGroup>;
  stakeholderReactions: Record<string, StakeholderReaction>;
  nationalReforms: Record<string, NationalReformState>;
  powerActors: Record<string, EmergentPowerActor>;
  powerStruggleCampaigns: Record<string, PowerStruggleCampaign>;
  aiJobs: Record<string, AIJob>;
  actionPrograms: Record<string, ActionProgram>;
  /** Rapports persistants issus des audits, prospections et expertises. */
  reports?: Record<string, GovernmentReport>;
  /** Investissements localisés avec risques, incidents et arbitrages propres. */
  territorialProjects?: Record<string, TerritorialProject>;
  militaryTheaters: Record<string, MilitaryTheater>;
  militaryBases: Record<string, MilitaryBase>;
  warZones: Record<string, WarZone>;
  diplomaticSessions: Record<string, DiplomaticSession>;
  diplomaticDialogues: Record<string, DiplomaticDialogue>;
  diplomaticBriefs: Record<string, DiplomaticBrief>;
  diplomaticMeetings: Record<string, DiplomaticMeeting>;
  diplomaticAgreementDrafts: Record<string, DiplomaticAgreementDraft>;
  sectors: Record<string, StrategicSectorState>;
  armamentProducts: Record<string, ArmamentProduct>;
  strategicDossiers: Record<string, StrategicDossier>;
  /** Faits clos, affichés séparément des dossiers qui demandent un suivi. */
  worldEvents: WorldEvent[];
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
