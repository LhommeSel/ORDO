import type { AdvisorAnswer } from '../simulation/advisor';
import type { WorldState } from '../simulation/types';

export type AdvisorQuestionKind = 'fact' | 'strategy' | 'diplomacy' | 'free';
export type AdvisorQuestionDimension = 'situation' | 'strategy' | 'diplomacy' | 'forecast';
export type AdvisorResponseMode = 'facts' | 'options' | 'facts_and_options';

export type AdvisorActorContext = {
  id: string;
  name: string;
  role: 'player' | 'mentioned' | 'focus';
  factIds: string[];
};

export const ORDO_AI_MODEL = 'gpt-5.6-luna' as const;
export const ORDO_AI_SCHEMA_VERSION = 1 as const;
export const ORDO_ADVISOR_QUESTION_MAX_CHARS = 30_000;

export type AdvisorAIRequest = {
  schemaVersion: typeof ORDO_AI_SCHEMA_VERSION;
  requestId: string;
  sessionId: string;
  question: string;
  context: {
    currentDate: string;
    questionKind: AdvisorQuestionKind;
    dimensions: AdvisorQuestionDimension[];
    responseMode: AdvisorResponseMode;
    questionConfidence: number;
    conversationHistory: Array<{ question: string; summary: string }>;
    playerCountry: { id: string; name: string; government: string };
    actors: AdvisorActorContext[];
    interpretation: AdvisorAnswer['interpretation'];
    facts: Array<{ id: string; label: string; value: string; confidence: number; sourcePath: string }>;
    localPlans: Array<{
      title: string;
      intent: string;
      rationale: string;
      horizon: string;
      risks: string[];
      likelyReactions: string[];
    }>;
  };
};

export type AdvisorAIOption = {
  title: string;
  proposal: string;
  whyPlausible: string;
  whyRefused: string;
  estimatedConsequences: string[];
  risks: string[];
  factIds: string[];
  /** Présente uniquement une intention validée, jamais un effet à appliquer. */
  actionIntent?: {
    kind: 'energy_contract';
    targetCountryId: string;
    resource: 'oil' | 'gas';
    objective: string;
  };
};

export type AdvisorAIClaim = {
  text: string;
  status: 'fact' | 'inference' | 'proposal';
  factIds: string[];
};

export type AdvisorAIAnswer = {
  headline: string;
  synthesis: string;
  keyJudgment: string;
  options: AdvisorAIOption[];
  blindSpots: string[];
  claims: AdvisorAIClaim[];
};

export type AdvisorAIUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  remainingSessionRequestsToday: number;
};

export type AdvisorAIResponse =
  | { ok: true; answer: AdvisorAIAnswer; usage: AdvisorAIUsage; source?: 'llm' | 'local_fallback' }
  | {
      ok: false;
      code: 'not_configured' | 'invalid_request' | 'rate_limited' | 'budget_exhausted' | 'upstream_error';
      message: string;
      retryAfterSeconds?: number;
      usage?: AdvisorAIUsage;
      diagnostics?: { issues: string[]; truncated: boolean };
    };

const compactText = (value: string, maximum: number) => value.trim().slice(0, maximum);

export function createAdvisorAIRequest(
  world: WorldState,
  question: string,
  localAnswer: AdvisorAnswer,
  sessionId: string,
  conversationHistory: Array<{ question: string; summary: string }> = [],
): AdvisorAIRequest {
  if (question.length > ORDO_ADVISOR_QUESTION_MAX_CHARS) throw new RangeError('advisor_question_too_large');
  const player = world.countries[world.playerCountryId];
  return {
    schemaVersion: ORDO_AI_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    sessionId: compactText(sessionId, 80),
    question: question.trim(),
    context: {
      currentDate: world.currentDate,
      questionKind: localAnswer.questionKind,
      dimensions: localAnswer.dimensions,
      responseMode: localAnswer.responseMode,
      questionConfidence: localAnswer.questionConfidence,
      conversationHistory: conversationHistory.slice(0, 2).map((item) => ({
        question: compactText(item.question, 300),
        summary: compactText(item.summary, 500),
      })),
      playerCountry: {
        id: player.id,
        name: compactText(player.name, 80),
        government: compactText(player.politics.governmentLabel, 160),
      },
      actors: localAnswer.actors.slice(0, 100).map((actor) => ({
        id: compactText(actor.id, 80), name: compactText(actor.name, 100), role: actor.role,
        factIds: actor.factIds.slice(0, 24).map((id) => compactText(id, 100)),
      })),
      interpretation: localAnswer.interpretation,
      facts: localAnswer.facts.slice(0, localAnswer.responseMode === 'facts_and_options' ? 64 : 48).map((fact) => ({
        id: compactText(fact.id, 80),
        label: compactText(fact.label, 120),
        value: compactText(fact.value, 300),
        confidence: Math.max(0, Math.min(100, fact.confidence)),
        sourcePath: compactText(fact.sourcePath, 180),
      })),
      localPlans: localAnswer.plans.slice(0, 3).map((plan) => ({
        title: compactText(plan.title, 160),
        intent: compactText(plan.intent, 500),
        rationale: compactText(plan.rationale, 800),
        horizon: compactText(plan.horizon, 100),
        risks: plan.risks.slice(0, 4).map((item) => compactText(item, 300)),
        likelyReactions: plan.likelyReactions.slice(0, 4).map((item) => compactText(item, 300)),
      })),
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isShortString = (value: unknown, maximum: number, minimum = 0) =>
  typeof value === 'string' && value.trim().length >= minimum && value.length <= maximum;

const isStringArray = (value: unknown, maximumItems: number, maximumLength: number) =>
  Array.isArray(value)
  && value.length <= maximumItems
  && value.every((item) => isShortString(item, maximumLength, 1));

const isAdvisorQuestionKind = (value: unknown): value is AdvisorQuestionKind =>
  value === 'fact' || value === 'strategy' || value === 'diplomacy' || value === 'free';

const dimensions = ['situation', 'strategy', 'diplomacy', 'forecast'] as const;
const isAdvisorQuestionDimension = (value: unknown): value is AdvisorQuestionDimension =>
  typeof value === 'string' && (dimensions as readonly string[]).includes(value);
const isAdvisorResponseMode = (value: unknown): value is AdvisorResponseMode =>
  value === 'facts' || value === 'options' || value === 'facts_and_options';

/** Validation défensive : le serveur ne fait jamais confiance au JSON du navigateur. */
export function parseAdvisorAIRequest(value: unknown): AdvisorAIRequest | null {
  if (!isRecord(value) || value.schemaVersion !== ORDO_AI_SCHEMA_VERSION) return null;
  if (!isShortString(value.requestId, 80, 8) || !isShortString(value.sessionId, 80, 8)) return null;
  if (!isShortString(value.question, ORDO_ADVISOR_QUESTION_MAX_CHARS, 3) || !isRecord(value.context)) return null;
  const context = value.context;
  if (!isShortString(context.currentDate, 10, 10)
    || !isAdvisorQuestionKind(context.questionKind)
    || !Array.isArray(context.dimensions) || context.dimensions.length < 1 || context.dimensions.length > 4
    || !context.dimensions.every(isAdvisorQuestionDimension)
    || !isAdvisorResponseMode(context.responseMode)
    || typeof context.questionConfidence !== 'number'
    || context.questionConfidence < 0 || context.questionConfidence > 100
    || !isRecord(context.playerCountry)) return null;
  if (!Array.isArray(context.conversationHistory) || context.conversationHistory.length > 2
    || !context.conversationHistory.every((item) => isRecord(item)
      && isShortString(item.question, 300, 1)
      && isShortString(item.summary, 500, 1))) return null;
  if (!isShortString(context.playerCountry.id, 80, 1)
    || !isShortString(context.playerCountry.name, 80, 1)
    || !isShortString(context.playerCountry.government, 160, 1)) return null;
  if (!Array.isArray(context.actors) || context.actors.length < 1 || context.actors.length > 100
    || !context.actors.every((actor) => isRecord(actor)
      && isShortString(actor.id, 80, 1)
      && isShortString(actor.name, 100, 1)
      && (actor.role === 'player' || actor.role === 'mentioned' || actor.role === 'focus')
      && isStringArray(actor.factIds, 24, 100))) return null;
  if (!isRecord(context.interpretation) || !Array.isArray(context.facts) || context.facts.length > 64) return null;
  if (!context.facts.every((fact) => isRecord(fact)
    && isShortString(fact.id, 80, 1)
    && isShortString(fact.label, 120, 1)
    && isShortString(fact.value, 300, 1)
    && isShortString(fact.sourcePath, 180, 1)
    && typeof fact.confidence === 'number'
    && fact.confidence >= 0
    && fact.confidence <= 100)) return null;
  if (!Array.isArray(context.localPlans) || context.localPlans.length > 3) return null;
  if (!context.localPlans.every((plan) => isRecord(plan)
    && isShortString(plan.title, 160, 1)
    && isShortString(plan.intent, 500, 1)
    && isShortString(plan.rationale, 800, 1)
    && isShortString(plan.horizon, 100, 1)
    && isStringArray(plan.risks, 4, 300)
    && isStringArray(plan.likelyReactions, 4, 300))) return null;
  return value as AdvisorAIRequest;
}

const responseModeForKind = (kind: AdvisorQuestionKind): AdvisorResponseMode => kind === 'fact' ? 'facts' : 'options';

export function isAdvisorAIAnswer(value: unknown, expectedKind: AdvisorQuestionKind = 'strategy', expectedMode?: AdvisorResponseMode): value is AdvisorAIAnswer {
  const responseMode = expectedMode ?? responseModeForKind(expectedKind);
  if (!isRecord(value)
    || !isShortString(value.headline, 180, 1)
    || !isShortString(value.synthesis, 1_200, 1)
    || !isShortString(value.keyJudgment, 600, 1)
    || !Array.isArray(value.options)
    || (responseMode === 'facts' ? value.options.length !== 0 : value.options.length !== 3)
    || !isStringArray(value.blindSpots, 3, 300)
    || !Array.isArray(value.claims) || value.claims.length < 1 || value.claims.length > 8
    || !value.claims.every(isAdvisorAIClaim)) return false;
  return value.options.every((option) => isRecord(option)
    && isShortString(option.title, 160, 1)
    && isShortString(option.proposal, 800, 1)
    && isShortString(option.whyPlausible, 600, 1)
    && isShortString(option.whyRefused, 600, 1)
    && isStringArray(option.estimatedConsequences, 4, 400)
    && isStringArray(option.risks, 3, 300)
    && isStringArray(option.factIds, 4, 80)
    && (option.actionIntent === undefined || option.actionIntent === null || (isRecord(option.actionIntent)
      && option.actionIntent.kind === 'energy_contract'
      && isShortString(option.actionIntent.targetCountryId, 80, 1)
      && (option.actionIntent.resource === 'oil' || option.actionIntent.resource === 'gas')
      && isShortString(option.actionIntent.objective, 300, 1))));
}

function isAdvisorAIClaim(value: unknown): value is AdvisorAIClaim {
  return isRecord(value)
    && isShortString(value.text, 500, 1)
    && (value.status === 'fact' || value.status === 'inference' || value.status === 'proposal')
    && isStringArray(value.factIds, 6, 100);
}

/** Diagnostic non exposé au joueur : utile quand un modèle respecte presque le contrat. */
export function advisorAnswerValidationIssues(value: unknown, expectedKind: AdvisorQuestionKind = 'strategy', expectedMode?: AdvisorResponseMode): string[] {
  const responseMode = expectedMode ?? responseModeForKind(expectedKind);
  if (!isRecord(value)) return ['racine non objet'];
  const issues: string[] = [];
  if (!isShortString(value.headline, 180, 1)) issues.push('headline');
  if (!isShortString(value.synthesis, 1_200, 1)) issues.push('synthesis');
  if (!isShortString(value.keyJudgment, 600, 1)) issues.push('keyJudgment');
  if (!Array.isArray(value.options)) issues.push('options absent');
  else {
    const expectedOptions = responseMode === 'facts' ? 0 : 3;
    if (value.options.length !== expectedOptions) issues.push(`options=${value.options.length}, attendu=${expectedOptions}`);
    value.options.forEach((option, index) => {
      if (!isRecord(option)) { issues.push(`option${index} non objet`); return; }
      if (!isShortString(option.title, 160, 1)) issues.push(`option${index}.title`);
      if (!isShortString(option.proposal, 800, 1)) issues.push(`option${index}.proposal`);
      if (!isShortString(option.whyPlausible, 600, 1)) issues.push(`option${index}.whyPlausible`);
      if (!isShortString(option.whyRefused, 600, 1)) issues.push(`option${index}.whyRefused`);
      if (!isStringArray(option.estimatedConsequences, 4, 400)) issues.push(`option${index}.estimatedConsequences`);
      if (!isStringArray(option.risks, 3, 300)) issues.push(`option${index}.risks`);
      if (!isStringArray(option.factIds, 4, 80)) issues.push(`option${index}.factIds`);
      if (option.actionIntent !== undefined && option.actionIntent !== null && (!isRecord(option.actionIntent)
        || option.actionIntent.kind !== 'energy_contract'
        || !isShortString(option.actionIntent.targetCountryId, 80, 1)
        || (option.actionIntent.resource !== 'oil' && option.actionIntent.resource !== 'gas')
        || !isShortString(option.actionIntent.objective, 300, 1))) issues.push(`option${index}.actionIntent`);
    });
  }
  if (!isStringArray(value.blindSpots, 3, 300)) issues.push('blindSpots');
  if (!Array.isArray(value.claims) || value.claims.length < 1 || value.claims.length > 8 || !value.claims.every(isAdvisorAIClaim)) issues.push('claims');
  return issues;
}

/** Contrôle de provenance : les citations doivent venir du contexte effectivement transmis. */
export function advisorAnswerGroundingIssues(value: unknown, factIds: ReadonlySet<string>, actorIds?: ReadonlySet<string>): string[] {
  if (!isRecord(value) || !Array.isArray(value.options)) return ['options absentes'];
  const issues: string[] = [];
  value.options.forEach((option, index) => {
    if (!isRecord(option) || !Array.isArray(option.factIds)) return;
    const unknown = option.factIds.filter((id): id is string => typeof id === 'string' && !factIds.has(id));
    if (unknown.length > 0) issues.push(`option${index}.factIds inconnus=${unknown.join(',')}`);
    if (option.factIds.length === 0 || option.factIds.every((id) => typeof id !== 'string' || !factIds.has(id))) {
      issues.push(`option${index}.aucune citation valide`);
    }
    if (option.actionIntent && isRecord(option.actionIntent) && actorIds
      && typeof option.actionIntent.targetCountryId === 'string'
      && !actorIds.has(option.actionIntent.targetCountryId)) {
      issues.push(`option${index}.actionIntent.acteur absent du contexte`);
    }
  });
  if (Array.isArray(value.claims)) value.claims.forEach((claim, index) => {
    if (!isRecord(claim) || !Array.isArray(claim.factIds)) return;
    const unknown = claim.factIds.filter((id): id is string => typeof id === 'string' && !factIds.has(id));
    if (unknown.length > 0) issues.push(`claim${index}.factIds inconnus=${unknown.join(',')}`);
    if (claim.status === 'fact' && !claim.factIds.some((id) => typeof id === 'string' && factIds.has(id))) {
      issues.push(`claim${index}.fait sans citation valide`);
    }
  });
  return issues;
}

const normalizeFactId = (value: string) => value
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .normalize('NFC')
  .trim();

/** Nettoie les citations avant validation sans toucher au texte généré par le modèle. */
export function sanitizeAdvisorAnswerFactIds(value: unknown, factIds: ReadonlySet<string>) {
  if (!isRecord(value) || !Array.isArray(value.options)) return { answer: value, removed: [] as string[] };
  const removed: string[] = [];
  const options = value.options.map((option) => {
    if (!isRecord(option) || !Array.isArray(option.factIds)) return option;
    const cleaned = option.factIds
      .filter((id): id is string => typeof id === 'string')
      .map(normalizeFactId)
      .filter((id) => {
        if (factIds.has(id)) return true;
        removed.push(id);
        return false;
      });
    return { ...option, factIds: cleaned };
  });
  const claims = Array.isArray(value.claims) ? value.claims.map((claim) => {
    if (!isRecord(claim) || !Array.isArray(claim.factIds)) return claim;
    const cleaned = claim.factIds.filter((id): id is string => typeof id === 'string').map(normalizeFactId).filter((id) => {
      if (factIds.has(id)) return true;
      removed.push(id); return false;
    });
    return { ...claim, factIds: cleaned };
  }) : value.claims;
  return { answer: { ...value, options, claims }, removed };
}

/**
 * Une intention d’action est une extension facultative. Si le modèle propose
 * un interlocuteur qui n’a pas été transmis dans le contexte, on la neutralise
 * plutôt que de jeter toute la réponse consultative (le texte reste lisible,
 * mais aucune action ne pourra être préparée à partir de cette intention).
 */
export function sanitizeAdvisorAnswerActionIntents(value: unknown, actorIds: ReadonlySet<string>) {
  if (!isRecord(value) || !Array.isArray(value.options)) return { answer: value, removed: [] as string[] };
  const removed: string[] = [];
  const options = value.options.map((option) => {
    if (!isRecord(option) || !isRecord(option.actionIntent)) return option;
    const target = option.actionIntent.targetCountryId;
    if (typeof target !== 'string' || actorIds.has(target)) return option;
    removed.push(target);
    return { ...option, actionIntent: null };
  });
  return { answer: { ...value, options }, removed };
}

export const advisorAIJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'synthesis', 'keyJudgment', 'options', 'blindSpots', 'claims'],
  properties: {
    headline: { type: 'string', maxLength: 180 },
    synthesis: { type: 'string', maxLength: 1200 },
    keyJudgment: { type: 'string', maxLength: 600 },
      options: {
      type: 'array', minItems: 0, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        // Le mode strict de l’API exige que chaque propriété soit requise.
        // Une intention absente est donc représentée explicitement par null.
        required: ['title', 'proposal', 'whyPlausible', 'whyRefused', 'estimatedConsequences', 'risks', 'factIds', 'actionIntent'],
        properties: {
          title: { type: 'string', maxLength: 160 },
          proposal: { type: 'string', maxLength: 800 },
          whyPlausible: { type: 'string', maxLength: 600 },
          whyRefused: { type: 'string', maxLength: 600 },
          estimatedConsequences: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', maxLength: 400 } },
          risks: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 300 } },
          factIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', maxLength: 80 } },
          actionIntent: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object', additionalProperties: false,
                required: ['kind', 'targetCountryId', 'resource', 'objective'],
                properties: {
                  kind: { type: 'string', enum: ['energy_contract'] },
                  targetCountryId: { type: 'string', maxLength: 80 },
                  resource: { type: 'string', enum: ['oil', 'gas'] },
                  objective: { type: 'string', maxLength: 300 },
                },
              },
            ],
          },
        },
      },
    },
    blindSpots: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 300 } },
    claims: {
      type: 'array', minItems: 1, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'status', 'factIds'],
        properties: {
          text: { type: 'string', maxLength: 500 },
          status: { type: 'string', enum: ['fact', 'inference', 'proposal'] },
          factIds: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 100 } },
        },
      },
    },
  },
} as const;
