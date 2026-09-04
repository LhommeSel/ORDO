import type { AdvisorAnswer } from '../simulation/advisor';
import type { WorldState } from '../simulation/types';

export const ORDO_AI_MODEL = 'gpt-5.6-luna' as const;
export const ORDO_AI_SCHEMA_VERSION = 1 as const;

export type AdvisorAIRequest = {
  schemaVersion: typeof ORDO_AI_SCHEMA_VERSION;
  requestId: string;
  sessionId: string;
  question: string;
  context: {
    currentDate: string;
    playerCountry: { id: string; name: string; government: string };
    interpretation: AdvisorAnswer['interpretation'];
    facts: Array<{ id: string; label: string; value: string; confidence: number }>;
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
};

export type AdvisorAIAnswer = {
  headline: string;
  synthesis: string;
  keyJudgment: string;
  options: AdvisorAIOption[];
  blindSpots: string[];
};

export type AdvisorAIUsage = {
  model: typeof ORDO_AI_MODEL;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  remainingSessionRequestsToday: number;
};

export type AdvisorAIResponse =
  | { ok: true; answer: AdvisorAIAnswer; usage: AdvisorAIUsage }
  | {
      ok: false;
      code: 'not_configured' | 'invalid_request' | 'rate_limited' | 'budget_exhausted' | 'upstream_error';
      message: string;
      retryAfterSeconds?: number;
    };

const compactText = (value: string, maximum: number) => value.trim().slice(0, maximum);

export function createAdvisorAIRequest(
  world: WorldState,
  question: string,
  localAnswer: AdvisorAnswer,
  sessionId: string,
): AdvisorAIRequest {
  const player = world.countries[world.playerCountryId];
  return {
    schemaVersion: ORDO_AI_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    sessionId: compactText(sessionId, 80),
    question: compactText(question, 2_000),
    context: {
      currentDate: world.currentDate,
      playerCountry: {
        id: player.id,
        name: compactText(player.name, 80),
        government: compactText(player.politics.governmentLabel, 160),
      },
      interpretation: localAnswer.interpretation,
      facts: localAnswer.facts.slice(0, 12).map((fact) => ({
        id: compactText(fact.id, 80),
        label: compactText(fact.label, 120),
        value: compactText(fact.value, 300),
        confidence: Math.max(0, Math.min(100, fact.confidence)),
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

/** Validation défensive : le serveur ne fait jamais confiance au JSON du navigateur. */
export function parseAdvisorAIRequest(value: unknown): AdvisorAIRequest | null {
  if (!isRecord(value) || value.schemaVersion !== ORDO_AI_SCHEMA_VERSION) return null;
  if (!isShortString(value.requestId, 80, 8) || !isShortString(value.sessionId, 80, 8)) return null;
  if (!isShortString(value.question, 2_000, 3) || !isRecord(value.context)) return null;
  const context = value.context;
  if (!isShortString(context.currentDate, 10, 10) || !isRecord(context.playerCountry)) return null;
  if (!isShortString(context.playerCountry.id, 80, 1)
    || !isShortString(context.playerCountry.name, 80, 1)
    || !isShortString(context.playerCountry.government, 160, 1)) return null;
  if (!isRecord(context.interpretation) || !Array.isArray(context.facts) || context.facts.length > 12) return null;
  if (!context.facts.every((fact) => isRecord(fact)
    && isShortString(fact.id, 80, 1)
    && isShortString(fact.label, 120, 1)
    && isShortString(fact.value, 300, 1)
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

export function isAdvisorAIAnswer(value: unknown): value is AdvisorAIAnswer {
  if (!isRecord(value)
    || !isShortString(value.headline, 180, 1)
    || !isShortString(value.synthesis, 1_200, 1)
    || !isShortString(value.keyJudgment, 600, 1)
    || !Array.isArray(value.options)
    || value.options.length < 2
    || value.options.length > 3
    || !isStringArray(value.blindSpots, 3, 300)) return false;
  return value.options.every((option) => isRecord(option)
    && isShortString(option.title, 160, 1)
    && isShortString(option.proposal, 800, 1)
    && isShortString(option.whyPlausible, 600, 1)
    && isShortString(option.whyRefused, 600, 1)
    && isStringArray(option.estimatedConsequences, 4, 400)
    && isStringArray(option.risks, 3, 300)
    && isStringArray(option.factIds, 4, 80));
}

export const advisorAIJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'synthesis', 'keyJudgment', 'options', 'blindSpots'],
  properties: {
    headline: { type: 'string', maxLength: 180 },
    synthesis: { type: 'string', maxLength: 1200 },
    keyJudgment: { type: 'string', maxLength: 600 },
    options: {
      type: 'array', minItems: 2, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'proposal', 'whyPlausible', 'whyRefused', 'estimatedConsequences', 'risks', 'factIds'],
        properties: {
          title: { type: 'string', maxLength: 160 },
          proposal: { type: 'string', maxLength: 800 },
          whyPlausible: { type: 'string', maxLength: 600 },
          whyRefused: { type: 'string', maxLength: 600 },
          estimatedConsequences: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', maxLength: 400 } },
          risks: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 300 } },
          factIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', maxLength: 80 } },
        },
      },
    },
    blindSpots: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 300 } },
  },
} as const;
