import type { AIContextDomain } from '../simulation/ai/context';
import type { CommonActionCategory, DossierImportance, DossierKind, DossierScope, ISODate } from '../simulation/types';
import type { AdvisorAIUsage } from './contracts';

/**
 * Un tour n'est facturé qu'une fois côté ORDO. Il peut embarquer une réaction
 * au joueur et l'évolution autonome du monde ; la première est omise lorsqu'il
 * n'y a aucune action récente à interpréter. Les réponses restent purement
 * déclaratives jusqu'à leur validation par lib/simulation/ai/world-pulse.ts.
 */
// Version 3 ajoute les files de périmètre des dossiers et le lien parent.
export const ORDO_WORLD_PULSE_SCHEMA_VERSION = 3 as const;

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

/** File des crises majeures effectivement éligibles à une nouvelle analyse. */
export type WorldPulseStrategicDossier = {
  dossierId: string;
  importance: 'major' | 'critical';
  scope: DossierScope;
  urgency: number;
  requiresImmediateReview: boolean;
  reasons: string[];
  actorIds: string[];
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
  strategicDossierQueue: WorldPulseStrategicDossier[];
  /** Dossiers majeurs sans lien direct avec le pays joué. */
  worldDossierQueue: WorldPulseStrategicDossier[];
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
  /** Le regard joueur est omis lorsqu’aucune action joueur récente n’existe. */
  pulses: WorldPulseRequestItem[];
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
  /** Dossier parent lorsqu’une conséquence locale est rattachée à une crise plus large. */
  parentDossierId?: string | null;
  /** Identifiant d’un ancrage historique dont l’IA propose la manifestation. */
  historicalAnchorId?: string | null;
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
  /** Intention optionnelle pour le monde autonome ; jamais fournie pour le joueur. */
  autonomousAction?: {
    actorId: string;
    targetIds: string[];
    category: CommonActionCategory;
    objective: string;
    operation?: 'contact' | 'cooperation' | 'defense_pact' | 'mediation' | 'information_sharing';
  };
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
      parentDossierId: proposal.parentDossierId === undefined || proposal.parentDossierId === null
        ? proposal.parentDossierId
        : normalizeWorldPulseDossierId(proposal.parentDossierId),
    })),
  };
}

export type WorldPulseItemResult =
  | { id: string; kind: WorldPulseKind; ok: true; answer: WorldPulseAnswer; usage: Omit<AdvisorAIUsage, 'remainingSessionRequestsToday'> }
  | { id: string; kind: WorldPulseKind; ok: false; message: string; usage?: Omit<AdvisorAIUsage, 'remainingSessionRequestsToday'> };

export type WorldPulseResponse =
  | { ok: true; results: WorldPulseItemResult[]; usage: AdvisorAIUsage }
  | {
      ok: false;
      code: 'not_configured' | 'invalid_request' | 'rate_limited' | 'budget_exhausted' | 'upstream_error';
      message: string;
      retryAfterSeconds?: number;
    };

const dossierKinds: DossierKind[] = ['conflict', 'diplomatic_crisis', 'economic', 'security', 'cooperation', 'historical', 'power_struggle', 'political_transition'];
const importance: DossierImportance[] = ['minor', 'moderate', 'major', 'critical'];
const domains: AIContextDomain[] = ['overview', 'economy', 'energy', 'industry', 'diplomacy', 'politics', 'military', 'history', 'dossier', 'actor', 'capacity'];
const actionCategories: CommonActionCategory[] = ['diplomacy', 'economic', 'institutional', 'defense', 'intelligence'];

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

function isStrategicDossier(value: unknown): value is WorldPulseStrategicDossier {
  return isRecord(value)
    && isText(value.dossierId, 120, 1) && (value.importance === 'major' || value.importance === 'critical')
    && (value.scope === 'world' || value.scope === 'national' || value.scope === 'player_involved')
    && isNumber(value.urgency, 0, 100) && typeof value.requiresImmediateReview === 'boolean'
    && isTextArray(value.reasons, 5, 220) && isTextArray(value.actorIds, 6, 80);
}

function isContext(value: unknown): value is WorldPulseContext {
  return isRecord(value)
    && isText(value.currentDate, 10, 10) && isNumber(value.elapsedMonths, 0, 24)
    && isText(value.playerCountryId, 80, 1) && isText(value.playerCountryName, 120, 1)
    && Array.isArray(value.recentPlayerActions) && value.recentPlayerActions.length <= 16 && value.recentPlayerActions.every(isAction)
    && Array.isArray(value.engineGuidance) && value.engineGuidance.length >= 1 && value.engineGuidance.length <= 16 && value.engineGuidance.every(isGuidance)
    && Array.isArray(value.strategicDossierQueue) && value.strategicDossierQueue.length <= 4 && value.strategicDossierQueue.every(isStrategicDossier)
    && Array.isArray(value.worldDossierQueue) && value.worldDossierQueue.length <= 4 && value.worldDossierQueue.every(isStrategicDossier)
    && Array.isArray(value.autonomyFocus) && value.autonomyFocus.length <= 6 && value.autonomyFocus.every(isAttentionTarget)
    && Array.isArray(value.facts) && value.facts.length >= 1 && value.facts.length <= 110 && value.facts.every(isFact)
    && isNumber(value.omittedFactCount, 0, 100_000) && isNumber(value.approximateInputTokens, 1, 25_000);
}

/**
 * Les onglets ouverts avant le déploiement de la séparation des dossiers
 * peuvent encore poster les contrats v1/v2. On les élève localement vers le
 * contrat courant afin qu'une session longue ne soit pas interrompue par un
 * simple décalage de bundle. Les champs ajoutés sont neutres : une ancienne
 * file stratégique est une file du pays joué, et l'ancienne version n'a pas
 * encore de file mondiale.
 */
function migrateLegacyWorldPulseRequest(value: unknown): unknown {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) return value;
  const pulses = Array.isArray(value.pulses) ? value.pulses.map((item) => {
    if (!isRecord(item) || !isRecord(item.context)) return item;
    const context = item.context;
    const strategicDossierQueue = Array.isArray(context.strategicDossierQueue)
      ? context.strategicDossierQueue.map((review) => isRecord(review) && review.scope === undefined
        ? { ...review, scope: 'player_involved' }
        : review)
      : [];
    const worldDossierQueue = Array.isArray(context.worldDossierQueue) ? context.worldDossierQueue : [];
    return { ...item, context: { ...context, strategicDossierQueue, worldDossierQueue } };
  }) : value.pulses;
  return { ...value, schemaVersion: ORDO_WORLD_PULSE_SCHEMA_VERSION, pulses };
}

export function parseWorldPulseRequest(value: unknown): WorldPulseRequest | null {
  const migrated = migrateLegacyWorldPulseRequest(value);
  if (!isRecord(migrated) || migrated.schemaVersion !== ORDO_WORLD_PULSE_SCHEMA_VERSION
    || !isText(migrated.requestId, 80, 8) || !isText(migrated.sessionId, 80, 8) || !isText(migrated.pulseId, 120, 8)
    || !Array.isArray(migrated.pulses) || migrated.pulses.length < 1 || migrated.pulses.length > 2) return null;
  const items = migrated.pulses;
  if (!items.every((item) => isRecord(item)
    && isText(item.id, 120, 1)
    && (item.kind === 'player_reaction' || item.kind === 'world_autonomy')
    && isContext(item.context))) return null;
  const kinds = new Set(items.map((item) => item.kind));
  if (!kinds.has('world_autonomy') || kinds.size !== migrated.pulses.length) return null;
  return migrated as WorldPulseRequest;
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
    const autonomousAction = proposal.autonomousAction;
    const validAutonomousAction = autonomousAction === undefined || autonomousAction === null || (isRecord(autonomousAction)
      && isText(autonomousAction.actorId, 80, 1)
      && isTextArray(autonomousAction.targetIds, 3, 80)
      && typeof autonomousAction.category === 'string' && actionCategories.includes(autonomousAction.category as CommonActionCategory)
      && isText(autonomousAction.objective, 600, 12)
      && (autonomousAction.operation === undefined || (typeof autonomousAction.operation === 'string'
        && ['contact', 'cooperation', 'defense_pact', 'mediation', 'information_sharing'].includes(autonomousAction.operation))));
    return (proposal.dossierId === null || isText(proposal.dossierId, 120, 1))
      && (proposal.parentDossierId === undefined || proposal.parentDossierId === null || isText(proposal.parentDossierId, 120, 1))
      && (proposal.historicalAnchorId === undefined || proposal.historicalAnchorId === null || isText(proposal.historicalAnchorId, 120, 1))
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
      && Array.isArray(proposal.relationEffects) && proposal.relationEffects.length <= 4 && proposal.relationEffects.every(isRelationEffect)
      && validAutonomousAction;
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
  required: ['dossierId', 'parentDossierId', 'historicalAnchorId', 'title', 'kind', 'importance', 'actorIds', 'regionTags', 'phase', 'trend', 'summary', 'requiresPlayerDecision', 'playerDecision', 'factIds', 'relationEffects', 'autonomousAction'],
  properties: {
    dossierId: { anyOf: [{ type: 'string', maxLength: 120 }, { type: 'null' }] },
    parentDossierId: { anyOf: [{ type: 'string', maxLength: 120 }, { type: 'null' }] },
    historicalAnchorId: { anyOf: [{ type: 'string', maxLength: 120 }, { type: 'null' }] },
    title: { type: 'string', maxLength: 180 }, kind: { type: 'string', enum: dossierKinds }, importance: { type: 'string', enum: importance },
    actorIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', maxLength: 80 } },
    regionTags: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 80 } },
    phase: { type: 'string', maxLength: 220 }, trend: { type: 'string', enum: ['escalating', 'stable', 'deescalating'] },
    summary: { type: 'string', maxLength: 900 }, requiresPlayerDecision: { type: 'boolean' },
    playerDecision: { anyOf: [{ type: 'string', maxLength: 400 }, { type: 'null' }] },
    factIds: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 160 } },
    relationEffects: { type: 'array', maxItems: 4, items: relationEffectSchema },
    autonomousAction: {
      anyOf: [{ type: 'null' }, {
      type: 'object', additionalProperties: false,
      required: ['actorId', 'targetIds', 'category', 'objective', 'operation'],
      properties: {
        actorId: { type: 'string', maxLength: 80 },
        targetIds: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 80 } },
        category: { type: 'string', enum: actionCategories },
        objective: { type: 'string', minLength: 12, maxLength: 600 },
        operation: { anyOf: [{ type: 'string', enum: ['contact', 'cooperation', 'defense_pact', 'mediation', 'information_sharing'] }, { type: 'null' }] },
      },
      }],
    },
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
