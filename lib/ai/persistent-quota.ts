import { aiRuntimePolicy } from './security';

type QuotaRow = { request_count: number; reset_at: number };
type BudgetRow = { estimated_usd: number; reset_at: number };
type PersistentQuotaSuccess = {
  available: boolean;
  ok: true;
  remainingSessionRequestsToday?: number;
};
type PersistentQuotaFailure = {
  available: boolean;
  ok: false;
  code: 'rate_limited' | 'budget_exhausted';
  message: string;
  retryAfterSeconds: number;
};

export type PersistentQuotaAdmission = PersistentQuotaSuccess | PersistentQuotaFailure;

type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      run<T = unknown>(): Promise<T>;
    };
  };
};

type D1RunResult = { meta?: { changes?: number } };

let warnedUnavailable = false;
let quotaSchemaDatabase: D1Like | null = null;
let quotaSchemaPromise: Promise<void> | null = null;

/**
 * Récupère le binding D1 uniquement dans le runtime Worker. Le fallback est
 * volontaire : le serveur local ne possède pas encore la base de production.
 */
async function getQuotaDatabase(): Promise<D1Like | null> {
  try {
    const workers = await import('cloudflare:workers') as unknown as { env?: Record<string, unknown> };
    const database = workers.env?.DB;
    if (database && typeof database === 'object' && 'prepare' in database) return database as D1Like;
  } catch {
    // Node/vinext dev : le module cloudflare:workers n'est pas disponible.
  }
  if (!warnedUnavailable && process.env.NODE_ENV === 'production') {
    warnedUnavailable = true;
    console.warn('ORDO persistent AI quota unavailable; using in-memory safeguards.');
  }
  return null;
}

/**
 * Les environnements Sites disposent de la migration D1, tandis que vinext
 * peut démarrer une base locale vierge. Le schéma minimal est donc créé à la
 * demande, de façon idempotente, pour que le fallback mémoire ne masque pas
 * une vraie réservation persistante pendant les tests ou après un redémarrage.
 */
async function ensureQuotaSchema(database: D1Like) {
  if (quotaSchemaDatabase === database) return;
  if (!quotaSchemaPromise) {
    quotaSchemaPromise = database.prepare(
      `CREATE TABLE IF NOT EXISTS ai_quota_windows (
         scope TEXT NOT NULL,
         subject_key TEXT NOT NULL,
         window_start TEXT NOT NULL,
         reset_at INTEGER NOT NULL,
         request_count INTEGER NOT NULL DEFAULT 0,
         estimated_usd REAL NOT NULL DEFAULT 0,
         updated_at INTEGER NOT NULL,
         PRIMARY KEY (scope, subject_key, window_start)
       )`,
    ).bind().run().then(() => {
      quotaSchemaDatabase = database;
    }).catch((error) => {
      quotaSchemaPromise = null;
      throw error;
    });
  }
  await quotaSchemaPromise;
}

const utcWindow = () => {
  const now = Date.now();
  const date = new Date(now);
  const windowStart = date.toISOString().slice(0, 10);
  const next = new Date(`${windowStart}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { now, windowStart, resetAt: next.getTime() };
};

const secondsUntil = (timestamp: number, now: number) => Math.max(1, Math.ceil((timestamp - now) / 1_000));

async function readBudget(database: D1Like, windowStart: string) {
  return database.prepare(
    `SELECT estimated_usd, reset_at
     FROM ai_quota_windows
     WHERE scope = 'budget' AND subject_key = 'global' AND window_start = ?`,
  ).bind(windowStart).first<BudgetRow>();
}

async function claimWindow(database: D1Like, scope: 'ip_day' | 'session_day', subjectKey: string, windowStart: string, resetAt: number, limit: number) {
  // Une clause WHERE sur l'UPSERT empêche de compter une tentative déjà
  // refusée. La clé est un hash, jamais une adresse IP ou un identifiant brut.
  const result = await database.prepare(
    `INSERT INTO ai_quota_windows
       (scope, subject_key, window_start, reset_at, request_count, estimated_usd, updated_at)
     VALUES (?, ?, ?, ?, 1, 0, ?)
     ON CONFLICT(scope, subject_key, window_start) DO UPDATE SET
       request_count = request_count + 1,
       updated_at = excluded.updated_at
     WHERE request_count < ?`,
  ).bind(scope, subjectKey, windowStart, resetAt, Date.now(), limit).run<D1RunResult>();
  // D1 ne garantit pas un résultat fiable pour RETURNING sur un UPSERT
  // conditionnel. `meta.changes` indique atomiquement si cette réservation a
  // réellement été consommée, y compris lorsque plusieurs requêtes arrivent
  // simultanément sur le dernier jeton disponible.
  if (result.meta?.changes !== 1) return null;
  return database.prepare(
    `SELECT request_count, reset_at
     FROM ai_quota_windows
     WHERE scope = ? AND subject_key = ? AND window_start = ?`,
  ).bind(scope, subjectKey, windowStart).first<QuotaRow>();
}

/**
 * Réserve un appel dans les compteurs durables. Les limites minute et le
 * nombre de requêtes simultanées restent dans security.ts ; D1 couvre les
 * redémarrages, plusieurs instances et la rotation de sauvegardes.
 */
export async function claimPersistentAIRequest(ipKey: string, sessionKey: string): Promise<PersistentQuotaAdmission> {
  const database = await getQuotaDatabase();
  if (!database) return { available: false, ok: true };
  const policy = aiRuntimePolicy();
  const { now, windowStart, resetAt } = utcWindow();
  try {
    await ensureQuotaSchema(database);
    const budget = await readBudget(database, windowStart);
    if (budget && budget.estimated_usd >= policy.dailyBudgetUsd) {
      return {
        available: true,
        ok: false,
        code: 'budget_exhausted',
        message: 'Le budget IA quotidien d’ORDO est épuisé.',
        retryAfterSeconds: secondsUntil(budget.reset_at, now),
      };
    }

    const ip = await claimWindow(database, 'ip_day', ipKey, windowStart, resetAt, policy.perIpPerDay);
    if (!ip) {
      return {
        available: true,
        ok: false,
        code: 'rate_limited',
        message: 'Le plafond quotidien de demandes depuis cette connexion est atteint.',
        retryAfterSeconds: secondsUntil(resetAt, now),
      };
    }
    const session = await claimWindow(database, 'session_day', sessionKey, windowStart, resetAt, policy.perSessionPerDay);
    if (!session) {
      return {
        available: true,
        ok: false,
        code: 'rate_limited',
        message: 'Le quota quotidien de cette partie est atteint.',
        retryAfterSeconds: secondsUntil(resetAt, now),
      };
    }
    return {
      available: true,
      ok: true,
      remainingSessionRequestsToday: Math.max(0, policy.perSessionPerDay - session.request_count),
    };
  } catch (error) {
    // Une panne D1 ne doit pas rendre le jeu inutilisable ; le coupe-circuit
    // mémoire et la limite OpenAI restent actifs. Le détail n'est pas exposé.
    console.error('ORDO persistent AI quota failure', { name: error instanceof Error ? error.name : 'unknown' });
    return { available: false, ok: true };
  }
}

/** Enregistre le coût réel dès qu'une réponse OpenAI a fourni son usage. */
export async function recordPersistentAICost(estimatedUsd: number) {
  if (!Number.isFinite(estimatedUsd) || estimatedUsd <= 0) return;
  const database = await getQuotaDatabase();
  if (!database) return;
  const { windowStart, resetAt } = utcWindow();
  try {
    await ensureQuotaSchema(database);
    await database.prepare(
      `INSERT INTO ai_quota_windows
         (scope, subject_key, window_start, reset_at, request_count, estimated_usd, updated_at)
       VALUES ('budget', 'global', ?, ?, 0, ?, ?)
       ON CONFLICT(scope, subject_key, window_start) DO UPDATE SET
         estimated_usd = estimated_usd + excluded.estimated_usd,
         updated_at = excluded.updated_at`,
    ).bind(windowStart, resetAt, estimatedUsd, Date.now()).run();
  } catch (error) {
    console.error('ORDO persistent AI cost recording failure', { name: error instanceof Error ? error.name : 'unknown' });
  }
}
