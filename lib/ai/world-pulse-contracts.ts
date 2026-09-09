import type { AIContextDomain } from '../simulation/ai/context';
import type { DossierImportance, DossierKind, ISODate } from '../simulation/types';
import type { AdvisorAIUsage } from './contracts';

/**
 * Un tour n'est facturé qu'une fois côté ORDO, mais il peut embarquer deux
 * regards séparés : la réaction au joueur et l'évolution autonome du monde.
 * Les deux réponses restent purement déclaratives jusqu'à leur validation par
 * lib/simulation/ai/world-pulse.ts.
 */
export const ORDO_WORLD_PULSE_SCHEMA_VERSION = 1 as const;

export type WorldPulseKind = 'player_reaction' | 'world_autonomy';

export type WorldPulseFact = {
  id: string;
  domain: AIContextDomain;
  entityIds: string[];
  importance: number;
  statement: string;
};

export type WorldPulseActionContext = {
  id: string;
  kind: string;
  actorId: string;
  targetIds: string[];
  intent: string;
  createdAt: ISODate;
};

export type WorldPulseAttentionTarget = {
  region: string;
  priority: number;
  reason: string;
  countryIds: string[];
};

/** Directives privées du moteur : elles individualisent les États sans devenir des faits affichables. */
export type WorldPulseActorGuidance = {
  countryId: string;
  strategicGoals: string[];
  vulnerabilities: string[];
  redLines: string[];
  doctrine: { economic: number; social: number; sovereignty: number; security: number };
  leadershipTraits: string[];
  apparatusCurrents: string[];
};

export type WorldPulseContext = {
  currentDate: ISODate;
  elapsedMonths: number;
  playerCountryId: string;
  playerCountryName: string;
  recentPlayerActions: WorldPulseActionContext[];
  engineGuidance: WorldPulseActorGuidance[];
  autonomyFocus: WorldPulseAttentionTarget[];
  facts: WorldPulseFact[];
  omittedFactCount: number;
  approximateInputTokens: number;
};

export type WorldPulseRequestItem = {
  id: string;
  kind: WorldPulseKind;
  context: WorldPulseContext;
};

export type WorldPulseRequest = {
  schemaVersion: typeof ORDO_WORLD_PULSE_SCHEMA_VERSION;
  requestId: string;
  sessionId: string;
  pulseId: string;
  pulses: [WorldPulseRequestItem, WorldPulseRequestItem];
};

export type WorldPulseRelationEffect = {
  from: string;
  to: string;
  relation: number;
  trust: number;
  reason: string;
};

export type WorldPulseProposal = {
  dossierId: string | null;
  title: string;
  kind: DossierKind;
  importance: DossierImportance;
  actorIds: string[];
  regionTags: string[];
  phase: string;
  trend: 'escalating' | 'stable' | 'deescalating';
  summary: string;
  requiresPlayerDecision: boolean;
  playerDecision: string | null;
  factIds: string[];
  relationEffects: WorldPulseRelationEffect[];
};

export type WorldPulseAnswer = {
  headline: string;
  synthesis: string;
  proposals: WorldPulseProposal[];
  requestedFactIds: string[];
};

/**
 * Les faits de dossier sont préfixés par `dossier:` pour rester identifiables
 * dans le contexte, alors que la sauvegarde est indexée par l'identifiant nu.
 * Le modèle peut recopier le factId : on retire donc un unique préfixe connu.
 */
export function normalizeWorldPulseDossierId(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.startsWith('dossier:') ? trimmed.slice('dossier:'.length) : trimmed;
}

/** Rend les réponses compatibles avec l'index des dossiers du moteur. */
export function normalizeWorldPulseAnswerDossierIds(answer: WorldPulseAnswer): WorldPulseAnswer {
  return {
    ...answer,
    proposals: answer.proposals.map((proposal) => ({
      ...proposal,
      dossierId: normalizeWorldPulseDossierId(proposal.dossierId),
    })),
  };
}

export type WorldPulseItemResult =
  | { id: string; kind: WorldPulseKind; ok: true; answer: WorldPulseAnswer; usage: Omit<AdvisorAIUsage, 'remainingSessionRequestsToday'> }
  | { id: string; kind: WorldPulseKind; ok: false; message: string };

export type WorldPulseResponse =
  | { ok: true; results: WorldPulseItemResult[]; usage: AdvisorAIUsage }
  | {
      ok: false;
      code: 'not_configured' | 'invalid_request' | 'rate_limited' | 'budget_exhausted' | 'upstream_error';
      message: string;
      retryAfterSeconds?: number;
    };

const dossierKinds: DossierKind[] = ['conflict', 'diplomatic_crisis', 'economic', 'security', 'cooperation', 'historical', 'power_struggle'];
const importance: DossierImportance[] = ['minor', 'moderate', 'major', 'critical'];
const domains: AIContextDomain[] = ['overview', 'economy', 'energy', 'industry', 'diplomacy', 'politics', 'military', 'history', 'dossier', 'actor', 'capacity'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, maximum: number, minimum = 0) => typeof value === 'string' && value.trim().length >= minimum && value.length <= maximum;
const isTextArray = (value: unknown, maximumItems: number, maximumLength: number): value is string[] => Array.isArray(value)
  && value.length <= maximumItems && value.every((item) => isText(item, maximumLength, 1));
const isNumber = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

function isFact(value: unknown): value is WorldPulseFact {
  return isRecord(value)
    && isText(value.id, 160, 1)
    && typeof value.domain === 'string' && domains.includes(value.domain as AIContextDomain)
    && isTextArray(value.entityIds, 12, 80)
    && isNumber(value.importance, 0, 100)
    && isText(value.statement, 1_200, 1);
}

function isAction(value: unknown): value is WorldPulseActionContext {
  return isRecord(value)
    && isText(value.id, 120, 1) && isText(value.kind, 40, 1) && isText(value.actorId, 80, 1)
    && isTextArray(value.targetIds, 12, 80) && isText(value.intent, 1_200, 1)
    && isText(value.createdAt, 10, 10);
}

function isGuidance(value: unknown): value is WorldPulseActorGuidance {
  return isRecord(value)
    && isText(value.countryId, 80, 1)
    && isTextArray(value.strategicGoals, 5, 300) && isTextArray(value.vulnerabilities, 5, 300)
    && isTextArray(value.redLines, 5, 300) && isTextArray(value.leadershipTraits, 8, 120)
    && isTextArray(value.apparatusCurrents, 6, 180)
    && isRecord(value.doctrine)
    && isNumber(value.doctrine.economic, -100, 100) && isNumber(value.doctrine.social, -100, 100)
    && isNumber(value.doctrine.sovereignty, -100, 100) && isNumber(value.doctrine.security, -100, 100);
}

function isAttentionTarget(value: unknown): value is WorldPulseAttentionTarget {
  return isRecord(value)
    && isText(value.region, 80, 1) && isNumber(value.priority, 0, 100)
    && isText(value.reason, 180, 1) && isTextArray(value.countryIds, 12, 80);
}

function isContext(value: unknown): value is WorldPulseContext {
  return isRecord(value)
    && isText(value.currentDate, 10, 10) && isNumber(value.elapsedMonths, 0, 24)
    && isText(value.playerCountryId, 80, 1) && isText(value.playerCountryName, 120, 1)
    && Array.isArray(value.recentPlayerActions) && value.recentPlayerActions.length <= 16 && value.recentPlayerActions.every(isAction)
    && Array.isArray(value.engineGuidance) && value.engineGuidance.length >= 1 && value.engineGuidance.length <= 16 && value.engineGuidance.every(isGuidance)
    && Array.isArray(value.autonomyFocus) && value.autonomyFocus.length <= 6 && value.autonomyFocus.every(isAttentionTarget)
    && Array.isArray(value.facts) && value.facts.length >= 1 && value.facts.length <= 110 && value.facts.every(isFact)
    && isNumber(value.omittedFactCount, 0, 100_000) && isNumber(value.approximateInputTokens, 1, 25_000);
}

export function parseWorldPulseRequest(value: unknown): WorldPulseRequest | null {
  if (!isRecord(value) || value.schemaVersion !== ORDO_WORLD_PULSE_SCHEMA_VERSION
    || !isText(value.requestId, 80, 8) || !isText(value.sessionId, 80, 8) || !isText(value.pulseId, 120, 8)
    || !Array.isArray(value.pulses) || value.pulses.length !== 2) return null;
  const items = value.pulses;
  if (!items.every((item) => isRecord(item)
    && isText(item.id, 120, 1)
    && (item.kind === 'player_reaction' || item.kind === 'world_autonomy')
    && isContext(item.context))) return null;
  const kinds = new Set(items.map((item) => item.kind));
  if (kinds.size !== 2 || !kinds.has('player_reaction') || !kinds.has('world_autonomy')) return null;
  return value as WorldPulseRequest;
}

function isRelationEffect(value: unknown): value is WorldPulseRelationEffect {
  return isRecord(value)
    && isText(value.from, 80, 1) && isText(value.to, 80, 1)
    && isNumber(value.relation, -8, 8) && isNumber(value.trust, -8, 8)
    && isText(value.reason, 300, 1);
}

export function isWorldPulseAnswer(value: unknown, kind: WorldPulseKind): value is WorldPulseAnswer {
  if (!isRecord(value) || !isText(value.headline, 180, 1) || !isText(value.synthesis, 900, 1)
    || !Array.isArray(value.proposals) || !isTextArray(value.requestedFactIds, 6, 160)) return false;
  const maximum = kind === 'player_reaction' ? 1 : 2;
  if (value.proposals.length > maximum) return false;
  return value.proposals.every((proposal) => {
    if (!isRecord(proposal)) return false;
    const actorIds = proposal.actorIds;
    return (proposal.dossierId === null || isText(proposal.dossierId, 120, 1))
      && isText(proposal.title, 180, 1)
      && typeof proposal.kind === 'string' && dossierKinds.includes(proposal.kind as DossierKind)
      && typeof proposal.importance === 'string' && importance.includes(proposal.importance as DossierImportance)
      && isTextArray(actorIds, 6, 80) && actorIds.length >= 1
      && isTextArray(proposal.regionTags, 5, 80)
      && isText(proposal.phase, 220, 1) && ['escalating', 'stable', 'deescalating'].includes(String(proposal.trend))
      && isText(proposal.summary, 900, 1)
      && typeof proposal.requiresPlayerDecision === 'boolean'
      && (proposal.playerDecision === null || isText(proposal.playerDecision, 400, 1))
      && isTextArray(proposal.factIds, 8, 160)
      && Array.isArray(proposal.relationEffects) && proposal.relationEffects.length <= 4 && proposal.relationEffects.every(isRelationEffect);
  });
}

const relationEffectSchema = {
  type: 'object', additionalProperties: false,
  required: ['from', 'to', 'relation', 'trust', 'reason'],
  properties: {
    from: { type: 'string', maxLength: 80 }, to: { type: 'string', maxLength: 80 },
    relation: { type: 'number', minimum: -8, maximum: 8 }, trust: { type: 'number', minimum: -8, maximum: 8 },
    reason: { type: 'string', maxLength: 300 },
  },
} as const;

const proposalSchema = {
  type: 'object', additionalProperties: false,
  required: ['dossierId', 'title', 'kind', 'importance', 'actorIds', 'regionTags', 'phase', 'trend', 'summary', 'requiresPlayerDecision', 'playerDecision', 'factIds', 'relationEffects'],
  properties: {
    dossierId: { anyOf: [{ type: 'string', maxLength: 120 }, { type: 'null' }] },
    title: { type: 'string', maxLength: 180 }, kind: { type: 'string', enum: dossierKinds }, importance: { type: 'string', enum: importance },
    actorIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', maxLength: 80 } },
    regionTags: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 80 } },
    phase: { type: 'string', maxLength: 220 }, trend: { type: 'string', enum: ['escalating', 'stable', 'deescalating'] },
    summary: { type: 'string', maxLength: 900 }, requiresPlayerDecision: { type: 'boolean' },
    playerDecision: { anyOf: [{ type: 'string', maxLength: 400 }, { type: 'null' }] },
    factIds: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 160 } },
    relationEffects: { type: 'array', maxItems: 4, items: relationEffectSchema },
  },
} as const;

export const worldPulseAIJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'synthesis', 'proposals', 'requestedFactIds'],
  properties: {
    headline: { type: 'string', maxLength: 180 }, synthesis: { type: 'string', maxLength: 900 },
    proposals: { type: 'array', maxItems: 2, items: proposalSchema },
    requestedFactIds: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 160 } },
  },
} as const;
