import { ORDO_AI_MODEL, type AdvisorAIResponse } from './contracts';

type WindowCounter = { count: number; resetAt: number };
type DailyBudget = { estimatedUsd: number; resetAt: number };

const minuteCounters = new Map<string, WindowCounter>();
const dailyCounters = new Map<string, WindowCounter>();
// Défense en profondeur contre la rotation d'identifiants de partie. Ces
// compteurs restent volontairement distincts du quota par session : un joueur
// honnête peut avoir plusieurs sauvegardes, mais un même client ne peut pas
// contourner le plafond en recréant localStorage à chaque requête.
const dailyIpCounters = new Map<string, WindowCounter>();
let dailyBudget: DailyBudget = { estimatedUsd: 0, resetAt: 0 };
let inflight = 0;

const integerSetting = (name: string, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

const numberSetting = (name: string, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

export const aiRuntimePolicy = () => ({
  enabled: process.env.AI_ENABLED === 'true',
  apiKey: process.env.OPENAI_API_KEY ?? '',
  model: process.env.AI_MODEL?.trim() || ORDO_AI_MODEL,
  perIpPerMinute: integerSetting('AI_PER_IP_PER_MINUTE', 4, 1, 30),
  perIpPerDay: integerSetting('AI_PER_IP_PER_DAY', 60, 1, 500),
  perSessionPerDay: integerSetting('AI_PER_SESSION_PER_DAY', 20, 1, 200),
  maximumInflight: integerSetting('AI_MAX_INFLIGHT', 4, 1, 20),
  dailyBudgetUsd: numberSetting('AI_DAILY_BUDGET_USD', 0.5, 0.05, 100),
  maxOutputTokens: integerSetting('AI_MAX_OUTPUT_TOKENS', 1_400, 400, 4_000),
  maxRequestBytes: integerSetting('AI_MAX_REQUEST_BYTES', 160_000, 20_000, 400_000),
});

const incrementWindow = (map: Map<string, WindowCounter>, key: string, durationMs: number, now: number) => {
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + durationMs };
    map.set(key, fresh);
    return fresh;
  }
  current.count += 1;
  return current;
};

const secondsUntil = (timestamp: number, now: number) => Math.max(1, Math.ceil((timestamp - now) / 1_000));

export type AIAdmission =
  | { ok: true; remainingSessionRequestsToday: number; release: () => void }
  | { ok: false; response: Extract<AdvisorAIResponse, { ok: false }> };

export async function hashRateLimitKey(value: string) {
  const bytes = new TextEncoder().encode(`${process.env.AI_RATE_LIMIT_SALT ?? 'ordo-ephemeral'}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export function admitAIRequest(ipKey: string, sessionKey: string): AIAdmission {
  const policy = aiRuntimePolicy();
  if (!policy.enabled || !policy.apiKey) {
    return { ok: false, response: { ok: false, code: 'not_configured', message: 'Le modèle IA est prêt, mais la clé serveur n’est pas encore activée.' } };
  }
  const now = Date.now();
  const nextMidnight = new Date(now);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  if (dailyBudget.resetAt <= now) dailyBudget = { estimatedUsd: 0, resetAt: nextMidnight.getTime() };
  if (dailyBudget.estimatedUsd >= policy.dailyBudgetUsd) {
    return { ok: false, response: { ok: false, code: 'budget_exhausted', message: 'Le budget IA quotidien d’ORDO est épuisé.', retryAfterSeconds: secondsUntil(dailyBudget.resetAt, now) } };
  }
  if (inflight >= policy.maximumInflight) {
    return { ok: false, response: { ok: false, code: 'rate_limited', message: 'Le conseiller traite déjà plusieurs demandes. Réessayez dans quelques instants.', retryAfterSeconds: 10 } };
  }
  const minute = incrementWindow(minuteCounters, ipKey, 60_000, now);
  if (minute.count > policy.perIpPerMinute) {
    return { ok: false, response: { ok: false, code: 'rate_limited', message: 'Trop de demandes rapprochées.', retryAfterSeconds: secondsUntil(minute.resetAt, now) } };
  }
  const ipDay = incrementWindow(dailyIpCounters, ipKey, 86_400_000, now);
  if (ipDay.count > policy.perIpPerDay) {
    return { ok: false, response: { ok: false, code: 'rate_limited', message: 'Le plafond quotidien de demandes depuis cette connexion est atteint.', retryAfterSeconds: secondsUntil(ipDay.resetAt, now) } };
  }
  const session = incrementWindow(dailyCounters, sessionKey, 86_400_000, now);
  if (session.count > policy.perSessionPerDay) {
    return { ok: false, response: { ok: false, code: 'rate_limited', message: 'Le quota quotidien de cette partie est atteint.', retryAfterSeconds: secondsUntil(session.resetAt, now) } };
  }
  inflight += 1;
  let released = false;
  return {
    ok: true,
    remainingSessionRequestsToday: Math.max(0, policy.perSessionPerDay - session.count),
    release: () => { if (!released) { released = true; inflight = Math.max(0, inflight - 1); } },
  };
}

export function recordAICost(estimatedUsd: number) {
  if (Number.isFinite(estimatedUsd) && estimatedUsd > 0) dailyBudget.estimatedUsd += estimatedUsd;
}

const pricingByModel: Record<string, { input: number; cachedInput: number; output: number }> = {
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10 },
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.6 },
  'gpt-5.6-luna': { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

export function supportsReasoning(model: string) {
  return /^gpt-(?:5|6)(?:\.|-|$)/.test(model);
}

export function estimateAICost(model: string, inputTokens: number, outputTokens: number, cachedInputTokens = 0) {
  // Valeur prudente pour tout modèle non encore répertorié afin de ne pas sous-estimer le budget.
  const pricing = pricingByModel[model] ?? { input: 4, cachedInput: 4, output: 20 };
  const uncached = Math.max(0, inputTokens - cachedInputTokens);
  return (uncached * pricing.input + cachedInputTokens * pricing.cachedInput + outputTokens * pricing.output) / 1_000_000;
}

export function requestIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'local';
}

export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
