import type { AdvisorAnswer } from '../simulation/advisor';
import { nationalReformProfiles, reformPositionLabel, reformStateKey } from '../simulation/reforms';
import type { NationalReformDomain, WorldState } from '../simulation/types';

export type AdvisorQuestionKind = 'fact' | 'strategy' | 'diplomacy' | 'free';
export type AdvisorQuestionDimension = 'situation' | 'strategy' | 'diplomacy' | 'forecast';
export type AdvisorResponseMode = 'facts' | 'options' | 'facts_and_options';
export type AdvisorAIExecutionMode = 'consultative' | 'operational';
export type AdvisorAIOperationalScope = 'general' | 'intelligence' | 'reform' | 'dossier';
export type AdvisorProgramCategory = 'economic' | 'diplomacy' | 'institutional' | 'defense' | 'intelligence';
type IntelligenceMissionKind = 'surveillance' | 'réseau' | 'liaison' | 'terrain' | 'analyse';

export type AdvisorActorContext = {
  id: string;
  name: string;
  role: 'player' | 'mentioned' | 'focus';
  factIds: string[];
};

export const ETAT_NATION_AI_MODEL = 'gpt-5.6-luna' as const;
export const ETAT_NATION_AI_SCHEMA_VERSION = 1 as const;
export const ETAT_NATION_ADVISOR_QUESTION_MAX_CHARS = 30_000;

export type AdvisorAIRequest = {
  schemaVersion: typeof ETAT_NATION_AI_SCHEMA_VERSION;
  requestId: string;
  sessionId: string;
  question: string;
  context: {
    currentDate: string;
    questionKind: AdvisorQuestionKind;
    /** Le mode opérationnel produit des brouillons préparables, jamais des effets directs. */
    executionMode?: AdvisorAIExecutionMode;
    /** Détermine la forme d’intention structurée exigée du modèle. */
    operationalScope?: AdvisorAIOperationalScope;
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
    /** Contexte autoritatif fourni lorsqu'une demande vient du module Réformes. */
    reformContext?: {
      domain: NationalReformDomain;
      label: string;
      currentOrientation: string;
      currentPosition: number;
      annualFiscalImpact: number;
      evidenceLevel: number;
      polarization: number;
      institutionalAnchor: number;
      implementationCapacity: number;
      activeProgramTitle: string | null;
      indicators: Array<{ id: string; label: string; value: number }>;
    };
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
    /** Terminal d'arrivée souhaité ; absent/null signifie que la route reste libre. */
    portAssetId?: string | null;
  } | {
    kind: 'intelligence_mission';
    targetCountryId: string;
    missionKind: IntelligenceMissionKind;
    objective: string;
    agencyId: string;
    authority: string;
  } | {
    kind: 'port_action';
    targetCountryId: string;
    assetId: string;
    action: 'audit' | 'invest' | 'equip_lng' | 'decongest' | 'maintain' | 'repair';
    objective: string;
  } | {
    kind: 'reform_proposal';
    domain: NationalReformDomain;
    title: string;
    objective: string;
    measures: string[];
    direction: 'lower' | 'balanced' | 'higher';
    pace: 'rapid' | 'gradual';
    acceptedCompromises: string[];
  } | {
    kind: 'policy_audit';
    domain: NationalReformDomain;
    title: string;
    objective: string;
    deliverables: string[];
  } | {
    kind: 'government_program';
    category: AdvisorProgramCategory;
    title: string;
    objective: string;
    targetCountryId?: string | null;
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
  cachedInputTokens: number;
  /** Préfixe stable écrit dans le cache lors de cet appel, si l'API le signale. */
  cacheWriteTokens?: number;
  /** Diagnostic compact : utile pour vérifier que le cache est réellement exploitable. */
  cacheDiagnostics?: {
    type: 'cache_hit' | 'cache_miss' | 'not_reported';
    reason?: string;
    cacheMissedTokens?: number;
    comparisonReusableTokens?: number;
  };
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  remainingSessionRequestsToday: number;
};

export type AdvisorAIResponse =
  | {
      ok: true;
      answer: AdvisorAIAnswer;
      usage: AdvisorAIUsage;
      /** Éléments écartés par le contrôle de provenance sans invalider toute la réponse. */
      diagnostics?: { removedFactIds: string[]; removedClaims: number[] };
    }
  | {
      ok: false;
      code: 'not_configured' | 'invalid_request' | 'rate_limited' | 'budget_exhausted' | 'upstream_error';
      message: string;
      retryAfterSeconds?: number;
      usage?: AdvisorAIUsage;
      diagnostics?: { issues: string[]; truncated: boolean };
    };

const compactText = (value: string, maximum: number) => value.trim().slice(0, maximum);

const comparable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

/** Joindre uniquement les échanges diplomatiques pertinents à la question. */
function dialogueFactsForQuestion(world: WorldState, question: string) {
  const normalizedQuestion = comparable(question);
  return Object.values(world.diplomaticDialogues ?? {})
    .filter((dialogue) => {
      // Le pays joué participe à presque tous les canaux : le considérer
      // comme une mention suffisait donc à injecter les échanges de tous les
      // interlocuteurs dans chaque dossier. Seuls les pays étrangers cités,
      // ou le dossier explicitement visé, rendent un canal pertinent.
      const participantMentioned = dialogue.participantIds
        .filter((id) => id !== world.playerCountryId)
        .some((id) => {
        const country = world.countries[id];
          return Boolean(country && normalizedQuestion.includes(comparable(country.name)));
        });
      const dossier = dialogue.linkedDossierId ? world.strategicDossiers[dialogue.linkedDossierId] : undefined;
      const dossierMentioned = Boolean(dossier && normalizedQuestion.includes(comparable(dossier.title)));
      return participantMentioned || dossierMentioned;
    })
    .flatMap((dialogue) => dialogue.turns.slice(-6).map((turn) => ({
      id: `dialogue-${dialogue.id}-${turn.id}`,
      label: `Dialogue · ${world.countries[turn.speakerId]?.name ?? turn.speakerId}`,
      value: compactText(turn.publicMessage, 600),
      confidence: 100,
      sourcePath: `diplomaticDialogues.${dialogue.id}.turns.${turn.id}`,
    })))
    .slice(-8);
}

export function createAdvisorAIRequest(
  world: WorldState,
  question: string,
  localAnswer: AdvisorAnswer,
  sessionId: string,
  conversationHistory: Array<{ question: string; summary: string }> = [],
  executionMode: AdvisorAIExecutionMode = 'consultative',
  reformDomain?: NationalReformDomain,
  operationalScope: AdvisorAIOperationalScope = reformDomain ? 'reform' : 'general',
): AdvisorAIRequest {
  if (question.length > ETAT_NATION_ADVISOR_QUESTION_MAX_CHARS) throw new RangeError('advisor_question_too_large');
  const player = world.countries[world.playerCountryId];
  // Les questions multi-acteurs perdaient trop vite les indicateurs de pays
  // pourtant explicitement cités. On élargit le contexte qualifié, sans
  // injecter l'historique complet de la partie.
  const maxFacts = localAnswer.responseMode === 'facts_and_options' ? 84 : localAnswer.questionKind === 'diplomacy' || localAnswer.questionKind === 'strategy' ? 72 : 48;
  const dialogueFacts = dialogueFactsForQuestion(world, question);
  const reform = reformDomain ? world.nationalReforms?.[reformStateKey(world.playerCountryId, reformDomain)] : undefined;
  const reformProfile = reformDomain ? nationalReformProfiles[reformDomain] : undefined;
  const activeReformProgram = reform?.activeProgramId ? world.actionPrograms?.[reform.activeProgramId] : undefined;
  return {
    schemaVersion: ETAT_NATION_AI_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    sessionId: compactText(sessionId, 80),
    question: question.trim(),
    context: {
        currentDate: world.currentDate,
        questionKind: localAnswer.questionKind,
        executionMode,
        operationalScope,
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
      facts: [
        ...localAnswer.facts.slice(0, Math.max(0, maxFacts - dialogueFacts.length)),
        ...dialogueFacts,
      ].slice(0, maxFacts).map((fact) => ({
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
      ...(reform && reformProfile ? { reformContext: {
        domain: reform.domain,
        label: reformProfile.label,
        currentOrientation: reformPositionLabel(reform.domain, reform.position),
        currentPosition: reform.position,
        annualFiscalImpact: reform.annualFiscalImpact,
        evidenceLevel: reform.evidenceLevel,
        polarization: reform.polarization,
        institutionalAnchor: reform.institutionalAnchor,
        implementationCapacity: reform.implementationCapacity,
        activeProgramTitle: activeReformProgram?.title ?? null,
        indicators: reformProfile.indicators.map((indicator) => ({
          id: indicator.id,
          label: indicator.label,
          value: reform.indicators[indicator.id] ?? 50,
        })),
      } } : {}),
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
const isAdvisorAIExecutionMode = (value: unknown): value is AdvisorAIExecutionMode =>
  value === 'consultative' || value === 'operational';
const isAdvisorAIOperationalScope = (value: unknown): value is AdvisorAIOperationalScope =>
  value === 'general' || value === 'intelligence' || value === 'reform' || value === 'dossier';
const isNationalReformDomain = (value: unknown): value is NationalReformDomain =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(nationalReformProfiles, value);

/** Validation défensive : le serveur ne fait jamais confiance au JSON du navigateur. */
export function parseAdvisorAIRequest(value: unknown): AdvisorAIRequest | null {
  if (!isRecord(value) || value.schemaVersion !== ETAT_NATION_AI_SCHEMA_VERSION) return null;
  if (!isShortString(value.requestId, 80, 8) || !isShortString(value.sessionId, 80, 8)) return null;
  if (!isShortString(value.question, ETAT_NATION_ADVISOR_QUESTION_MAX_CHARS, 3) || !isRecord(value.context)) return null;
  const context = value.context;
  if (!isShortString(context.currentDate, 10, 10)
    || !isAdvisorQuestionKind(context.questionKind)
    || (context.executionMode !== undefined && !isAdvisorAIExecutionMode(context.executionMode))
    || (context.operationalScope !== undefined && !isAdvisorAIOperationalScope(context.operationalScope))
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
      && isStringArray(actor.factIds, 32, 100))) return null;
  if (!isRecord(context.interpretation) || !Array.isArray(context.facts) || context.facts.length > 84) return null;
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
  if (context.reformContext !== undefined) {
    const reform = context.reformContext;
    if (!isRecord(reform)
      || !isNationalReformDomain(reform.domain)
      || !isShortString(reform.label, 120, 1)
      || !isShortString(reform.currentOrientation, 160, 1)
      || typeof reform.currentPosition !== 'number'
      || typeof reform.annualFiscalImpact !== 'number'
      || typeof reform.evidenceLevel !== 'number'
      || typeof reform.polarization !== 'number'
      || typeof reform.institutionalAnchor !== 'number'
      || typeof reform.implementationCapacity !== 'number'
      || !(reform.activeProgramTitle === null || isShortString(reform.activeProgramTitle, 180, 1))
      || !Array.isArray(reform.indicators)
      || reform.indicators.length > 4
      || !reform.indicators.every((indicator) => isRecord(indicator)
        && isShortString(indicator.id, 60, 1)
        && isShortString(indicator.label, 120, 1)
        && typeof indicator.value === 'number')) return null;
  }
  return value as AdvisorAIRequest;
}

const responseModeForKind = (kind: AdvisorQuestionKind): AdvisorResponseMode => kind === 'fact' ? 'facts' : 'options';

export function isAdvisorAIAnswer(value: unknown, expectedKind: AdvisorQuestionKind = 'strategy', expectedMode?: AdvisorResponseMode, requireOperationalIntents = false): value is AdvisorAIAnswer {
  const responseMode = expectedMode ?? responseModeForKind(expectedKind);
  if (!isRecord(value)
    || !isShortString(value.headline, 180, 1)
    || !isShortString(value.synthesis, 1_200, 1)
    || !isShortString(value.keyJudgment, 600, 1)
    || !Array.isArray(value.options)
    // Quatre pistes ne sont utiles que lorsqu'elles sont réellement distinctes.
    // Le contrat accepte donc deux à quatre voies, plutôt que d'imposer trois
    // reformulations artificielles d'une même décision.
    || (responseMode === 'facts' ? value.options.length !== 0 : value.options.length < 2 || value.options.length > 4)
    || !isStringArray(value.blindSpots, 3, 300)
    || !Array.isArray(value.claims) || value.claims.length < 1 || value.claims.length > 8
    || !value.claims.every(isAdvisorAIClaim)) return false;
  const optionsValid = value.options.every((option) => isRecord(option)
    && isShortString(option.title, 160, 1)
    && isShortString(option.proposal, 800, 1)
    && isShortString(option.whyPlausible, 600, 1)
    && isShortString(option.whyRefused, 600, 1)
    && isStringArray(option.estimatedConsequences, 4, 400)
    && isStringArray(option.risks, 3, 300)
    && isStringArray(option.factIds, 4, 80)
    && (option.actionIntent === undefined || option.actionIntent === null || isAdvisorAIActionIntent(option.actionIntent)));
  return optionsValid && (!requireOperationalIntents || value.options.every((option) => isRecord(option) && isAdvisorAIActionIntent(option.actionIntent)));
}

function isAdvisorAIActionIntent(value: unknown): value is NonNullable<AdvisorAIOption['actionIntent']> {
  if (!isRecord(value)) return false;
  if (value.kind === 'energy_contract') {
    return isShortString(value.targetCountryId, 80, 1)
      && (value.resource === 'oil' || value.resource === 'gas')
      && isShortString(value.objective, 300, 1)
      && (value.portAssetId === undefined || value.portAssetId === null || isShortString(value.portAssetId, 140, 1));
  }
  if (value.kind === 'intelligence_mission') {
    return isShortString(value.targetCountryId, 80, 1)
      && (value.missionKind === 'surveillance' || value.missionKind === 'réseau' || value.missionKind === 'liaison' || value.missionKind === 'terrain' || value.missionKind === 'analyse')
      && isShortString(value.objective, 300, 1)
      && isShortString(value.agencyId, 100, 1)
      && isShortString(value.authority, 180, 1);
  }
  if (value.kind === 'port_action') {
    return isShortString(value.targetCountryId, 80, 1)
      && isShortString(value.assetId, 140, 1)
      && (value.action === 'audit' || value.action === 'invest' || value.action === 'equip_lng'
        || value.action === 'decongest' || value.action === 'maintain' || value.action === 'repair')
      && isShortString(value.objective, 300, 1);
  }
  if (value.kind === 'reform_proposal') {
    return isNationalReformDomain(value.domain)
      && isShortString(value.title, 160, 1)
      && isShortString(value.objective, 500, 1)
      && Array.isArray(value.measures)
      && value.measures.length > 0
      && isStringArray(value.measures, 5, 240)
      && (value.direction === 'lower' || value.direction === 'balanced' || value.direction === 'higher')
      && (value.pace === 'rapid' || value.pace === 'gradual')
      && isStringArray(value.acceptedCompromises, 4, 240);
  }
  if (value.kind === 'policy_audit') {
    return isNationalReformDomain(value.domain)
      && isShortString(value.title, 160, 1)
      && isShortString(value.objective, 500, 1)
      && Array.isArray(value.deliverables)
      && value.deliverables.length > 0
      && isStringArray(value.deliverables, 5, 240);
  }
  if (value.kind === 'government_program') {
    return (value.category === 'economic' || value.category === 'diplomacy'
        || value.category === 'institutional' || value.category === 'defense'
        || value.category === 'intelligence')
      && isShortString(value.title, 160, 1)
      && isShortString(value.objective, 500, 1)
      && (value.targetCountryId === undefined || value.targetCountryId === null
        || isShortString(value.targetCountryId, 80, 1));
  }
  return false;
}

function isAdvisorAIClaim(value: unknown): value is AdvisorAIClaim {
  return isRecord(value)
    && isShortString(value.text, 500, 1)
    && (value.status === 'fact' || value.status === 'inference' || value.status === 'proposal')
    && isStringArray(value.factIds, 6, 100);
}

/** Diagnostic non exposé au joueur : utile quand un modèle respecte presque le contrat. */
export function advisorAnswerValidationIssues(value: unknown, expectedKind: AdvisorQuestionKind = 'strategy', expectedMode?: AdvisorResponseMode, requireOperationalIntents = false): string[] {
  const responseMode = expectedMode ?? responseModeForKind(expectedKind);
  if (!isRecord(value)) return ['racine non objet'];
  const issues: string[] = [];
  if (!isShortString(value.headline, 180, 1)) issues.push('headline');
  if (!isShortString(value.synthesis, 1_200, 1)) issues.push('synthesis');
  if (!isShortString(value.keyJudgment, 600, 1)) issues.push('keyJudgment');
  if (!Array.isArray(value.options)) issues.push('options absent');
  else {
    if (responseMode === 'facts' && value.options.length !== 0) issues.push(`options=${value.options.length}, attendu=0`);
    if (responseMode !== 'facts' && (value.options.length < 2 || value.options.length > 4)) issues.push(`options=${value.options.length}, attendu=2..4`);
    value.options.forEach((option, index) => {
      if (!isRecord(option)) { issues.push(`option${index} non objet`); return; }
      if (!isShortString(option.title, 160, 1)) issues.push(`option${index}.title`);
      if (!isShortString(option.proposal, 800, 1)) issues.push(`option${index}.proposal`);
      if (!isShortString(option.whyPlausible, 600, 1)) issues.push(`option${index}.whyPlausible`);
      if (!isShortString(option.whyRefused, 600, 1)) issues.push(`option${index}.whyRefused`);
      if (!isStringArray(option.estimatedConsequences, 4, 400)) issues.push(`option${index}.estimatedConsequences`);
      if (!isStringArray(option.risks, 3, 300)) issues.push(`option${index}.risks`);
      if (!isStringArray(option.factIds, 4, 80)) issues.push(`option${index}.factIds`);
      if (option.actionIntent !== undefined && option.actionIntent !== null && !isAdvisorAIActionIntent(option.actionIntent)) issues.push(`option${index}.actionIntent`);
      if (requireOperationalIntents && !isAdvisorAIActionIntent(option.actionIntent)) issues.push(`option${index}.actionIntent requis en mode opérationnel`);
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

const stripInternalCitations = (value: unknown) => typeof value === 'string'
  ? value.replace(/【[^】]*】/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
  : value;

/** Retire les identifiants de faits bruts que le modèle peut recopier dans sa prose. */
export function sanitizeAdvisorAnswerText(value: unknown) {
  if (!isRecord(value)) return value;
  const cleanList = (items: unknown) => Array.isArray(items) ? items.map(stripInternalCitations) : items;
  const options = Array.isArray(value.options) ? value.options.map((option) => {
    if (!isRecord(option)) return option;
    return {
      ...option,
      title: stripInternalCitations(option.title),
      proposal: stripInternalCitations(option.proposal),
      whyPlausible: stripInternalCitations(option.whyPlausible),
      whyRefused: stripInternalCitations(option.whyRefused),
      estimatedConsequences: cleanList(option.estimatedConsequences),
      risks: cleanList(option.risks),
    };
  }) : value.options;
  const claims = Array.isArray(value.claims) ? value.claims.map((claim) => {
    if (!isRecord(claim)) return claim;
    return { ...claim, text: stripInternalCitations(claim.text) };
  }) : value.claims;
  return {
    ...value,
    headline: stripInternalCitations(value.headline),
    synthesis: stripInternalCitations(value.synthesis),
    keyJudgment: stripInternalCitations(value.keyJudgment),
    blindSpots: cleanList(value.blindSpots),
    options,
    claims,
  };
}

/** Nettoie les citations avant validation sans toucher au texte généré par le modèle. */
export function sanitizeAdvisorAnswerFactIds(value: unknown, factIds: ReadonlySet<string>) {
  if (!isRecord(value) || !Array.isArray(value.options)) {
    return { answer: value, removed: [] as string[], removedClaims: [] as number[] };
  }
  const removed: string[] = [];
  const removedClaims: number[] = [];
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
  const claims = Array.isArray(value.claims) ? value.claims.map((claim, index) => {
    if (!isRecord(claim) || !Array.isArray(claim.factIds)) return claim;
    const cleaned = claim.factIds.filter((id): id is string => typeof id === 'string').map(normalizeFactId).filter((id) => {
      if (factIds.has(id)) return true;
      removed.push(id); return false;
    });
    // Une affirmation présentée comme un fait sans provenance ne doit pas
    // contaminer toute la réponse. On l'écarte seulement ; les options et
    // les autres claims restent consultables et auditables.
    if (claim.status === 'fact' && cleaned.length === 0) {
      removedClaims.push(index);
      return null;
    }
    return { ...claim, factIds: cleaned };
  }).filter((claim): claim is Exclude<typeof claim, null> => claim !== null) : value.claims;
  return { answer: { ...value, options, claims }, removed, removedClaims };
}

/**
 * Une intention d’action est une extension facultative. Si le modèle propose
 * un interlocuteur qui n’a pas été transmis dans le contexte, on la neutralise
 * plutôt que de jeter toute la réponse consultative (le texte reste lisible,
 * mais aucune action ne pourra être préparée à partir de cette intention).
 */
export function sanitizeAdvisorAnswerActionIntents(
  value: unknown,
  actorIds: ReadonlySet<string>,
  portAssetIds: ReadonlySet<string> = new Set(),
) {
  if (!isRecord(value) || !Array.isArray(value.options)) return { answer: value, removed: [] as string[] };
  const removed: string[] = [];
  const options = value.options.map((option) => {
    if (!isRecord(option) || !isRecord(option.actionIntent)) return option;
    const targetBearingKinds = new Set([
      'energy_contract',
      'intelligence_mission',
      'port_action',
    ]);
    const optionalTargetKind = option.actionIntent.kind === 'government_program';
    const target = option.actionIntent.targetCountryId;
    if ((targetBearingKinds.has(String(option.actionIntent.kind))
        && (typeof target !== 'string' || !actorIds.has(target)))
      || (optionalTargetKind && target !== undefined && target !== null
        && (typeof target !== 'string' || !actorIds.has(target)))) {
      removed.push(typeof target === 'string' ? target : 'acteur absent');
      return { ...option, actionIntent: null };
    }
    if (
      option.actionIntent.kind === 'port_action' &&
      (typeof option.actionIntent.assetId !== 'string' ||
        !portAssetIds.has(option.actionIntent.assetId))
    ) {
      // Les identifiants de faits sont lisibles mais ne sont pas des identifiants
      // d'actifs. Ne jamais laisser l'IA transformer l'un en opération réelle.
      removed.push(`port:${String(option.actionIntent.assetId)}`);
      return { ...option, actionIntent: null };
    }
    return option;
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
      type: 'array', minItems: 0, maxItems: 4,
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
                required: ['kind', 'targetCountryId', 'resource', 'objective', 'portAssetId'],
                properties: {
                  kind: { type: 'string', enum: ['energy_contract'] },
                  targetCountryId: { type: 'string', maxLength: 80 },
                  resource: { type: 'string', enum: ['oil', 'gas'] },
                   objective: { type: 'string', maxLength: 300 },
                   portAssetId: { anyOf: [{ type: 'string', maxLength: 140 }, { type: 'null' }] },
                 },
               },
               {
                 type: 'object', additionalProperties: false,
                 required: ['kind', 'targetCountryId', 'missionKind', 'objective', 'agencyId', 'authority'],
                 properties: {
                   kind: { type: 'string', enum: ['intelligence_mission'] },
                   targetCountryId: { type: 'string', maxLength: 80 },
                   missionKind: { type: 'string', enum: ['surveillance', 'réseau', 'liaison', 'terrain', 'analyse'] },
                   objective: { type: 'string', maxLength: 300 },
                   agencyId: { type: 'string', maxLength: 100 },
                   authority: { type: 'string', maxLength: 180 },
                 },
               },
                {
                  type: 'object', additionalProperties: false,
                  required: ['kind', 'targetCountryId', 'assetId', 'action', 'objective'],
                 properties: {
                   kind: { type: 'string', enum: ['port_action'] },
                   targetCountryId: { type: 'string', maxLength: 80 },
                   assetId: { type: 'string', maxLength: 140 },
                   action: { type: 'string', enum: ['audit', 'invest', 'equip_lng', 'decongest', 'maintain', 'repair'] },
                    objective: { type: 'string', maxLength: 300 },
                  },
                },
                {
                  type: 'object', additionalProperties: false,
                  required: ['kind', 'domain', 'title', 'objective', 'measures', 'direction', 'pace', 'acceptedCompromises'],
                  properties: {
                    kind: { type: 'string', enum: ['reform_proposal'] },
                    domain: { type: 'string', enum: Object.keys(nationalReformProfiles) },
                    title: { type: 'string', maxLength: 160 },
                    objective: { type: 'string', maxLength: 500 },
                    measures: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', maxLength: 240 } },
                    direction: { type: 'string', enum: ['lower', 'balanced', 'higher'] },
                    pace: { type: 'string', enum: ['rapid', 'gradual'] },
                    acceptedCompromises: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 240 } },
                  },
                },
                 {
                   type: 'object', additionalProperties: false,
                   required: ['kind', 'domain', 'title', 'objective', 'deliverables'],
                  properties: {
                    kind: { type: 'string', enum: ['policy_audit'] },
                    domain: { type: 'string', enum: Object.keys(nationalReformProfiles) },
                    title: { type: 'string', maxLength: 160 },
                    objective: { type: 'string', maxLength: 500 },
                     deliverables: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', maxLength: 240 } },
                   },
                 },
                 {
                   type: 'object', additionalProperties: false,
                   required: ['kind', 'category', 'title', 'objective', 'targetCountryId'],
                   properties: {
                     kind: { type: 'string', enum: ['government_program'] },
                     category: { type: 'string', enum: ['economic', 'diplomacy', 'institutional', 'defense', 'intelligence'] },
                     title: { type: 'string', maxLength: 160 },
                     objective: { type: 'string', maxLength: 500 },
                     targetCountryId: { anyOf: [{ type: 'string', maxLength: 80 }, { type: 'null' }] },
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
