import type {
  AIJob,
  AIJobBudgetTier,
  AIJobEffectHint,
  AIJobKind,
  AIJobOutcome,
  AIJobPriority,
  PowerStruggleAIProposal,
  PowerStruggleTactic,
} from '../simulation/types';
import type { AIContextFact, AIContextPacket } from '../simulation/ai/context';
import { ORDO_AI_MODEL, ORDO_AI_SCHEMA_VERSION, type AdvisorAIUsage } from './contracts';

export type AIJobDescriptor = {
  id: string;
  kind: AIJobKind;
  purpose: string;
  playerIntent: string;
  actorId: string;
  priority: AIJobPriority;
  budgetTier: AIJobBudgetTier;
  reasons: string[];
  domainContext: Record<string, unknown>;
};

export type AIJobAIRequest = {
  schemaVersion: typeof ORDO_AI_SCHEMA_VERSION;
  requestId: string;
  sessionId: string;
  job: AIJobDescriptor;
  context: AIContextPacket;
};

export type AIJobAIProposal = AIJobOutcome['proposals'][number];

export type AIJobAIAnswer = {
  headline: string;
  assessment: string;
  publicMessage: string;
  proposals: AIJobAIProposal[];
  requestedFacts: string[];
  powerStrugglePlan: PowerStruggleAIProposal | null;
  diplomaticMove: AIDiplomaticMove | null;
};

export type AIEnergyDiplomaticMove = {
  scope: 'energy_contract';
  kind: 'accept' | 'counter' | 'refuse' | 'message';
  annualVolume: number | null;
  durationYears: number | null;
  pricePosture: 'market' | 'supplier_premium' | 'buyer_discount' | null;
  clauses: Array<'delivery_priority' | 'infrastructure_investment' | 'local_content' | 'technology_cooperation' | 'diplomatic_consultation'>;
};

/** Réponse de fond pour un dialogue politique : aucune décision n'est forcée dans un contrat chiffré. */
export type AIGenericDiplomaticMove = {
  scope: 'general_dialogue';
  kind: 'accept' | 'counter' | 'refuse' | 'request_clarification' | 'message';
  agreementType: 'industrial_cooperation' | 'information_sharing' | 'security_cooperation' | 'political_guarantee' | 'mediation' | 'defense_cooperation';
  position: string;
  concessions: string[];
  guaranteesRequested: string[];
  conditions: string[];
  redLines: string[];
  timeline: string;
};

export type AIDiplomaticMove = AIEnergyDiplomaticMove | AIGenericDiplomaticMove;

export type AIPrivateDecision = {
  actorId: string;
  objectivesUsed: string[];
  fearsUsed: string[];
  redLinesUsed: string[];
  confidentialRationale: string;
};

export type AIJobAIModelAnswer = AIJobAIAnswer & { privateDecision: AIPrivateDecision | null };

export type AIJobAIResponse =
  | { ok: true; answer: AIJobAIAnswer; usage: AdvisorAIUsage }
  | {
      ok: false;
      code: 'not_configured' | 'invalid_request' | 'rate_limited' | 'budget_exhausted' | 'upstream_error';
      message: string;
      retryAfterSeconds?: number;
      /** Un JSON rejeté peut tout de même avoir été facturé par le fournisseur. */
      usage?: AdvisorAIUsage;
    };

const kinds: AIJobKind[] = ['power_struggle', 'diplomacy', 'historical_interpretation', 'advisor', 'free_action_interpretation'];
const priorities: AIJobPriority[] = ['background', 'normal', 'urgent'];
const tiers: AIJobBudgetTier[] = ['economy', 'standard', 'deep'];
const domains = ['overview', 'economy', 'energy', 'industry', 'diplomacy', 'politics', 'military', 'history', 'dossier', 'actor', 'capacity'];
const visibilities = ['public', 'internal', 'secret'];
const tactics: PowerStruggleTactic[] = ['private_lobbying', 'administrative_obstruction', 'public_criticism', 'media_campaign', 'organized_resignation', 'social_mobilization', 'strike', 'investment_freeze', 'capital_flight', 'opposition_funding', 'information_leak', 'security_disobedience', 'extra_constitutional_preparation', 'negotiation', 'deescalation'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown, maximum: number, minimum = 0) => typeof value === 'string' && value.trim().length >= minimum && value.length <= maximum;
const isStringArray = (value: unknown, maximumItems: number, maximumLength: number) => Array.isArray(value) && value.length <= maximumItems && value.every((item) => isString(item, maximumLength, 1));
const isNumber = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

export const AI_PLAYER_INTENT_MAX_CHARS = 30_000;

function compactText(value: string, maximum: number) {
  return value.trim().slice(0, maximum);
}

function descriptorFromJob(job: AIJob): AIJobDescriptor {
  const rawIntent = job.inputText
    ?? (job.kind === 'power_struggle' ? job.context.playerResponse : typeof job.context.playerIntent === 'string' ? job.context.playerIntent : undefined)
    ?? job.purpose;
  if (rawIntent.length > AI_PLAYER_INTENT_MAX_CHARS) throw new RangeError('player_intent_too_large');
  return {
    id: compactText(job.id, 120),
    kind: job.kind,
    purpose: compactText(job.purpose, 500),
    playerIntent: rawIntent,
    actorId: compactText(job.kind === 'power_struggle' ? job.countryId : job.actorId, 80),
    priority: job.priority,
    budgetTier: job.budgetTier,
    reasons: job.reasons.slice(0, 8).map((reason) => compactText(reason, 500)),
    domainContext: job.context,
  };
}

export function createAIJobAIRequest(job: AIJob, context: AIContextPacket, sessionId: string): AIJobAIRequest {
  return {
    schemaVersion: ORDO_AI_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    sessionId: compactText(sessionId, 80),
    job: descriptorFromJob(job),
    context,
  };
}

function isFact(value: unknown): value is AIContextFact {
  return isRecord(value)
    && isString(value.id, 160, 1)
    && typeof value.domain === 'string' && domains.includes(value.domain)
    && isStringArray(value.entityIds, 20, 80)
    && isStringArray(value.topicTags, 30, 80)
    && isStringArray(value.concepts, 30, 80)
    && isString(value.observedAt, 10, 10)
    && isNumber(value.importance, 0, 100)
    && isNumber(value.confidence, 0, 100)
    && typeof value.visibility === 'string' && visibilities.includes(value.visibility)
    && (value.ownerCountryId === undefined || isString(value.ownerCountryId, 80, 1))
    && isString(value.sourcePath, 300, 1)
    && isString(value.statement, 1_200, 1)
    && (value.causalFactIds === undefined || isStringArray(value.causalFactIds, 20, 160));
}

export function parseAIJobAIRequest(value: unknown): AIJobAIRequest | null {
  if (!isRecord(value) || value.schemaVersion !== ORDO_AI_SCHEMA_VERSION) return null;
  if (!isString(value.requestId, 80, 8) || !isString(value.sessionId, 80, 8) || !isRecord(value.job) || !isRecord(value.context)) return null;
  const job = value.job;
  if (!isString(job.id, 120, 1)
    || typeof job.kind !== 'string' || !kinds.includes(job.kind as AIJobKind)
    || !isString(job.purpose, 500, 1)
    || !isString(job.playerIntent, AI_PLAYER_INTENT_MAX_CHARS, 1)
    || !isString(job.actorId, 80, 1)
    || typeof job.priority !== 'string' || !priorities.includes(job.priority as AIJobPriority)
    || typeof job.budgetTier !== 'string' || !tiers.includes(job.budgetTier as AIJobBudgetTier)
    || !isStringArray(job.reasons, 8, 500)
    || !isRecord(job.domainContext)
    || JSON.stringify(job.domainContext).length > 14_000) return null;
  const context = value.context;
  if (context.schemaVersion !== 1 || !isString(context.compiledAt, 10, 10) || !isRecord(context.query)
    || !isString(context.overview, 600, 1)
    || !Array.isArray(context.knownFacts) || context.knownFacts.length > 180 || !context.knownFacts.every(isFact)
    || !Array.isArray(context.privateDecisionFacts) || context.privateDecisionFacts.length > 120 || !context.privateDecisionFacts.every(isFact)
    || !Array.isArray(context.reserveFacts) || context.reserveFacts.length > 180
    || !context.reserveFacts.every((fact) => isRecord(fact) && (fact.accessScope === 'known' || fact.accessScope === 'private') && isFact(fact))
    || !isNumber(context.omittedFactCount, 0, 100_000)
    || !isNumber(context.approximateInputTokens, 1, 25_000)
    || !isNumber(context.approximateTotalInputTokens, 1, 45_000)) return null;
  const query = context.query;
  if (query.jobKind !== job.kind || !isString(query.requestingCountryId, 80, 1) || !isString(query.decisionCountryId, 80, 1)
    || !isString(query.actorId, 80, 1) || !isStringArray(query.targetIds, 40, 80)
    || !Array.isArray(query.domains) || query.domains.length > domains.length || !query.domains.every((item) => typeof item === 'string' && domains.includes(item))
    || !isStringArray(query.topicTags, 40, 80) || !isStringArray(query.concepts, 40, 80) || !isString(query.purpose, 500, 1)
    || !isString(query.playerIntent, AI_PLAYER_INTENT_MAX_CHARS, 1) || query.playerIntent !== job.playerIntent
    || !isNumber(query.approximateIntentTokens, 1, 10_000)
    || !isNumber(query.tokenBudget, 500, 25_000)) return null;
  return value as AIJobAIRequest;
}

function isEffectHint(value: unknown): value is AIJobEffectHint {
  return isRecord(value)
    && typeof value.kind === 'string' && ['relation_shift', 'capacity_pressure', 'stakeholder_reaction', 'dossier_update', 'actor_materialization', 'historical_manifestation', 'interpreted_action'].includes(value.kind)
    && isStringArray(value.targetIds, 8, 80)
    && typeof value.magnitude === 'string' && ['minor', 'moderate', 'major'].includes(value.magnitude)
    && typeof value.direction === 'string' && ['positive', 'negative', 'mixed'].includes(value.direction)
    && isString(value.reason, 500, 1);
}

function isPowerActor(value: unknown) {
  return value === null || (isRecord(value)
    && isString(value.name, 120, 1) && isString(value.role, 40, 1) && isString(value.position, 180, 1)
    && isStringArray(value.ideologyTags, 6, 60) && isStringArray(value.personalityTags, 6, 60)
    && isString(value.deepObjective, 500, 1) && isString(value.immediateObjective, 500, 1)
    && isNumber(value.influence, 0, 100) && isNumber(value.legitimacy, 0, 100)
    && isNumber(value.loyaltyToRegime, 0, 100) && isNumber(value.loyaltyToGovernment, 0, 100)
    && isNumber(value.riskTolerance, 0, 100) && isString(value.initialVisibility, 20, 1));
}

function isPowerStrugglePlan(value: unknown): value is PowerStruggleAIProposal | null {
  if (value === null) return true;
  return isRecord(value) && isPowerActor(value.actor ?? null)
    && isString(value.strategy, 800, 1) && isString(value.immediateObjective, 500, 1)
    && isString(value.acceptableCompromise, 500, 1) && isString(value.personalRedLine, 500, 1)
    && typeof value.currentTactic === 'string' && tactics.includes(value.currentTactic as PowerStruggleTactic)
    && isString(value.publicMove, 700, 1)
    && Array.isArray(value.reassessmentTriggers) && value.reassessmentTriggers.length <= 5
    && value.reassessmentTriggers.every((item) => typeof item === 'string' && ['player_response', 'pressure_shift', 'government_crisis', 'deadline', 'external_shock'].includes(item))
    && isNumber(value.reviewAfterMonths, 1, 24);
}

function isPrivateDecision(value: unknown): value is AIPrivateDecision | null {
  return value === null || (isRecord(value)
    && isString(value.actorId, 80, 1)
    && isStringArray(value.objectivesUsed, 6, 300)
    && isStringArray(value.fearsUsed, 6, 300)
    && isStringArray(value.redLinesUsed, 6, 300)
    && isString(value.confidentialRationale, 1_200, 1));
}

function isDiplomaticMove(value: unknown): value is AIDiplomaticMove | null {
  if (value === null) return true;
  if (!isRecord(value) || (value.scope !== 'energy_contract' && value.scope !== 'general_dialogue')) return false;
  if (value.scope === 'energy_contract') {
    if (typeof value.kind !== 'string' || !['accept', 'counter', 'refuse', 'message'].includes(value.kind)
      || !(value.annualVolume === null || isNumber(value.annualVolume, 0.01, 100_000))
      || !(value.durationYears === null || isNumber(value.durationYears, 1, 30))
      || !(value.pricePosture === null || (typeof value.pricePosture === 'string' && ['market', 'supplier_premium', 'buyer_discount'].includes(value.pricePosture)))
      || !Array.isArray(value.clauses) || value.clauses.length > 3
      || !value.clauses.every((item) => typeof item === 'string' && ['delivery_priority', 'infrastructure_investment', 'local_content', 'technology_cooperation', 'diplomatic_consultation'].includes(item))) return false;
    return value.kind !== 'counter' || (value.annualVolume !== null && value.durationYears !== null && value.pricePosture !== null);
  }
  return typeof value.kind === 'string' && ['accept', 'counter', 'refuse', 'request_clarification', 'message'].includes(value.kind)
    && typeof value.agreementType === 'string' && ['industrial_cooperation', 'information_sharing', 'security_cooperation', 'political_guarantee', 'mediation', 'defense_cooperation'].includes(value.agreementType)
    && isString(value.position, 900, 1)
    && isStringArray(value.concessions, 5, 400)
    && isStringArray(value.guaranteesRequested, 5, 400)
    && isStringArray(value.conditions, 5, 400)
    && isStringArray(value.redLines, 5, 400)
    && isString(value.timeline, 220, 1);
}

export function isAIJobAIModelAnswer(value: unknown, kind?: AIJobKind): value is AIJobAIModelAnswer {
  if (!isRecord(value) || !isString(value.headline, 180, 1) || !isString(value.assessment, 1_500, 1)
    || !isString(value.publicMessage, 1_200, 1)
    || !Array.isArray(value.proposals) || value.proposals.length < 1 || value.proposals.length > 3
    || !isStringArray(value.requestedFacts, 5, 240) || !isPowerStrugglePlan(value.powerStrugglePlan)
    || !isDiplomaticMove(value.diplomaticMove)
    || !isPrivateDecision(value.privateDecision)) return false;
  if (kind === 'power_struggle' && value.powerStrugglePlan === null) return false;
  if (kind && kind !== 'power_struggle' && value.powerStrugglePlan !== null) return false;
  if (kind === 'diplomacy' && value.privateDecision === null) return false;
  if (kind && kind !== 'diplomacy' && value.privateDecision !== null) return false;
  if (kind === 'diplomacy' && value.diplomaticMove === null) return false;
  if (kind && kind !== 'diplomacy' && value.diplomaticMove !== null) return false;
  return value.proposals.every((proposal) => isRecord(proposal)
    && isString(proposal.label, 160, 1) && isString(proposal.action, 900, 1)
    && isString(proposal.rationale, 900, 1) && isStringArray(proposal.likelyReactions, 5, 400)
    && isStringArray(proposal.uncertainties, 5, 400) && Array.isArray(proposal.effectHints)
    && proposal.effectHints.length <= 6 && proposal.effectHints.every(isEffectHint));
}

export function sanitizeAIJobAIAnswer(value: AIJobAIModelAnswer): AIJobAIAnswer {
  const { privateDecision: _privateDecision, ...publicAnswer } = value;
  return publicAnswer;
}

const effectHintSchema = {
  type: 'object', additionalProperties: false,
  required: ['kind', 'targetIds', 'magnitude', 'direction', 'reason'],
  properties: {
    kind: { type: 'string', enum: ['relation_shift', 'capacity_pressure', 'stakeholder_reaction', 'dossier_update', 'actor_materialization', 'historical_manifestation', 'interpreted_action'] },
    targetIds: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 80 } },
    magnitude: { type: 'string', enum: ['minor', 'moderate', 'major'] },
    direction: { type: 'string', enum: ['positive', 'negative', 'mixed'] },
    reason: { type: 'string', maxLength: 500 },
  },
} as const;

const powerActorSchema = {
  type: 'object', additionalProperties: false,
  required: ['name', 'role', 'position', 'ideologyTags', 'personalityTags', 'deepObjective', 'immediateObjective', 'influence', 'legitimacy', 'loyaltyToRegime', 'loyaltyToGovernment', 'riskTolerance', 'initialVisibility'],
  properties: {
    name: { type: 'string', maxLength: 120 }, role: { type: 'string', enum: ['military_officer', 'union_leader', 'business_leader', 'senior_official', 'civic_figure'] }, position: { type: 'string', maxLength: 180 },
    ideologyTags: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 60 } }, personalityTags: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 60 } },
    deepObjective: { type: 'string', maxLength: 500 }, immediateObjective: { type: 'string', maxLength: 500 },
    influence: { type: 'number', minimum: 0, maximum: 100 }, legitimacy: { type: 'number', minimum: 0, maximum: 100 }, loyaltyToRegime: { type: 'number', minimum: 0, maximum: 100 }, loyaltyToGovernment: { type: 'number', minimum: 0, maximum: 100 }, riskTolerance: { type: 'number', minimum: 0, maximum: 100 },
    initialVisibility: { type: 'string', enum: ['unknown', 'suspected', 'identified', 'public'] },
  },
} as const;

const powerPlanSchema = {
  type: 'object', additionalProperties: false,
  required: ['actor', 'strategy', 'immediateObjective', 'acceptableCompromise', 'personalRedLine', 'currentTactic', 'publicMove', 'reassessmentTriggers', 'reviewAfterMonths'],
  properties: {
    actor: { anyOf: [powerActorSchema, { type: 'null' }] },
    strategy: { type: 'string', maxLength: 800 }, immediateObjective: { type: 'string', maxLength: 500 }, acceptableCompromise: { type: 'string', maxLength: 500 }, personalRedLine: { type: 'string', maxLength: 500 },
    currentTactic: { type: 'string', enum: tactics }, publicMove: { type: 'string', maxLength: 700 },
    reassessmentTriggers: { type: 'array', maxItems: 5, items: { type: 'string', enum: ['player_response', 'pressure_shift', 'government_crisis', 'deadline', 'external_shock'] } },
    reviewAfterMonths: { type: 'number', minimum: 1, maximum: 24 },
  },
} as const;

const privateDecisionSchema = {
  type: 'object', additionalProperties: false,
  required: ['actorId', 'objectivesUsed', 'fearsUsed', 'redLinesUsed', 'confidentialRationale'],
  properties: {
    actorId: { type: 'string', maxLength: 80 },
    objectivesUsed: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 300 } },
    fearsUsed: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 300 } },
    redLinesUsed: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 300 } },
    confidentialRationale: { type: 'string', maxLength: 1200 },
  },
} as const;

const energyDiplomaticMoveSchema = {
  type: 'object', additionalProperties: false,
  required: ['scope', 'kind', 'annualVolume', 'durationYears', 'pricePosture', 'clauses'],
  properties: {
    scope: { type: 'string', enum: ['energy_contract'] },
    kind: { type: 'string', enum: ['accept', 'counter', 'refuse', 'message'] },
    annualVolume: { anyOf: [{ type: 'number', minimum: 0.01, maximum: 100000 }, { type: 'null' }] },
    durationYears: { anyOf: [{ type: 'number', minimum: 1, maximum: 30 }, { type: 'null' }] },
    pricePosture: { anyOf: [{ type: 'string', enum: ['market', 'supplier_premium', 'buyer_discount'] }, { type: 'null' }] },
    clauses: { type: 'array', maxItems: 3, items: { type: 'string', enum: ['delivery_priority', 'infrastructure_investment', 'local_content', 'technology_cooperation', 'diplomatic_consultation'] } },
  },
} as const;

const generalDiplomaticMoveSchema = {
  type: 'object', additionalProperties: false,
  required: ['scope', 'kind', 'agreementType', 'position', 'concessions', 'guaranteesRequested', 'conditions', 'redLines', 'timeline'],
  properties: {
    scope: { type: 'string', enum: ['general_dialogue'] },
    kind: { type: 'string', enum: ['accept', 'counter', 'refuse', 'request_clarification', 'message'] },
    agreementType: { type: 'string', enum: ['industrial_cooperation', 'information_sharing', 'security_cooperation', 'political_guarantee', 'mediation', 'defense_cooperation'] },
    position: { type: 'string', maxLength: 900 },
    concessions: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 400 } },
    guaranteesRequested: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 400 } },
    conditions: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 400 } },
    redLines: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 400 } },
    timeline: { type: 'string', maxLength: 220 },
  },
} as const;

export const aiJobAIJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'assessment', 'publicMessage', 'proposals', 'requestedFacts', 'powerStrugglePlan', 'diplomaticMove', 'privateDecision'],
  properties: {
    headline: { type: 'string', maxLength: 180 },
    assessment: { type: 'string', maxLength: 1500 },
    publicMessage: { type: 'string', maxLength: 1200 },
    proposals: { type: 'array', minItems: 1, maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      required: ['label', 'action', 'rationale', 'likelyReactions', 'uncertainties', 'effectHints'],
      properties: {
        label: { type: 'string', maxLength: 160 }, action: { type: 'string', maxLength: 900 }, rationale: { type: 'string', maxLength: 900 },
        likelyReactions: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 400 } },
        uncertainties: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 400 } },
        effectHints: { type: 'array', maxItems: 6, items: effectHintSchema },
      },
    } },
    requestedFacts: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 240 } },
    powerStrugglePlan: { anyOf: [powerPlanSchema, { type: 'null' }] },
    diplomaticMove: { anyOf: [energyDiplomaticMoveSchema, generalDiplomaticMoveSchema, { type: 'null' }] },
    privateDecision: { anyOf: [privateDecisionSchema, { type: 'null' }] },
  },
} as const;

export function toAIJobOutcome(answer: AIJobAIAnswer, context: AIContextPacket): AIJobOutcome {
  return {
    headline: answer.headline,
    assessment: answer.assessment,
    publicMessage: answer.publicMessage,
    proposals: answer.proposals,
    requestedFacts: answer.requestedFacts,
    contextFactIds: [...context.knownFacts, ...context.privateDecisionFacts].map((item) => item.id),
    approximateInputTokens: context.approximateInputTokens,
  };
}

export { ORDO_AI_MODEL };
