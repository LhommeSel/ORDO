import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as advisorPOST } from '../../app/api/ai/advisor/route';
import { createAdvisorAIRequest } from './contracts';
import { answerAdvisorQuestion } from '../simulation/advisor';
import { createFrance2000World } from '../simulation/scenario-2000';

const makeRequest = (sessionId: string, answer: unknown) => {
  const world = createFrance2000World();
  const local = answerAdvisorQuestion(world, 'Quelle stratégie économique est possible ?', { questionKind: 'strategy' });
  const payload = createAdvisorAIRequest(world, 'Quelle stratégie économique est possible ?', local, sessionId);
  return {
    payload,
    request: new Request('http://localhost:3000/api/ai/advisor', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        'content-length': String(new TextEncoder().encode(JSON.stringify(payload)).byteLength),
      },
      body: JSON.stringify(payload),
    }),
    upstream: new Response(JSON.stringify({
      output_text: JSON.stringify(answer),
      usage: { input_tokens: 120, output_tokens: 240, total_tokens: 360, input_tokens_details: { cached_tokens: 80 } },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  };
};

const requestUrl = (input: RequestInfo | URL) => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

test('la route conseiller accepte une réponse structurée avec un fournisseur IA simulé', async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  try {
    process.env.AI_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.AI_MODEL = 'gpt-5.6-luna';
    process.env.AI_RATE_LIMIT_SALT = 'mock-test';
    const world = createFrance2000World();
    const local = answerAdvisorQuestion(world, 'Quelle stratégie économique est possible ?', { questionKind: 'strategy' });
    const factId = local.facts[0]?.id ?? 'date';
    const answer = {
      headline: 'Une trajectoire industrielle progressive est possible',
      synthesis: 'Les capacités disponibles permettent une action graduelle. Le calendrier doit préserver le budget.',
      keyJudgment: 'La cohérence politique et budgétaire compte davantage qu’un programme maximal immédiat.',
      options: [1, 2, 3].map((index) => ({
        title: `Option ${index}`,
        proposal: `Préparer une étape industrielle ${index} avec un calendrier explicite.`,
        whyPlausible: 'Cette option s’appuie sur un fait transmis par le moteur.',
        whyRefused: 'Elle mobilise des moyens et peut ralentir d’autres priorités.',
        estimatedConsequences: ['Progression graduelle de la capacité.'],
        risks: ['Retard si le financement est insuffisant.'],
        factIds: [factId],
      })),
      blindSpots: ['Les réactions des partenaires non documentés restent inconnues.'],
      claims: [{ text: 'Le budget transmis doit être préservé.', status: 'fact', factIds: [factId] }],
    };
    const { request, upstream } = makeRequest('mock-route-valid', answer);
    globalThis.fetch = (async (input, init) => requestUrl(input).includes('api.openai.com') ? upstream : previousFetch(input, init)) as typeof fetch;
    const response = await advisorPOST(request);
    const body = await response.json() as { ok: boolean; answer?: { options: unknown[] }; usage?: { inputTokens: number; outputTokens: number } };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.answer?.options.length, 3);
    assert.deepEqual(body.usage && { inputTokens: body.usage.inputTokens, outputTokens: body.usage.outputTokens }, { inputTokens: 120, outputTokens: 240 });
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});

test('la route conseiller rejette une sortie qui cite un fait absent', async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  try {
    process.env.AI_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.AI_MODEL = 'gpt-5.6-luna';
    process.env.AI_RATE_LIMIT_SALT = 'mock-test-invalid';
    const invalidAnswer = {
      headline: 'Réponse test',
      synthesis: 'Réponse volontairement invalide.',
      keyJudgment: 'Le moteur doit la refuser.',
      options: [1, 2, 3].map((index) => ({
        title: `Option ${index}`,
        proposal: 'Proposition test.',
        whyPlausible: 'Motif test.',
        whyRefused: 'Risque test.',
        estimatedConsequences: ['Conséquence test.'],
        risks: ['Risque test.'],
        factIds: ['fact-inexistant'],
      })),
      blindSpots: [],
      claims: [{ text: 'Fait non transmis.', status: 'fact', factIds: ['fact-inexistant'] }],
    };
    const { request, upstream } = makeRequest('mock-route-invalid', invalidAnswer);
    globalThis.fetch = (async (input, init) => requestUrl(input).includes('api.openai.com') ? upstream : previousFetch(input, init)) as typeof fetch;
    const response = await advisorPOST(request);
    const body = await response.json() as { ok: boolean; code?: string; diagnostics?: { issues: string[] } };
    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.code, 'upstream_error');
    assert.ok(body.diagnostics?.issues.some((issue) => issue.includes('aucune citation valide')));
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});

test('la route conseiller conserve les options quand un claim factuel isolé est sans provenance', async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  try {
    process.env.AI_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.AI_MODEL = 'gpt-5.6-luna';
    process.env.AI_RATE_LIMIT_SALT = 'mock-test-isolated-claim';
    const world = createFrance2000World();
    const local = answerAdvisorQuestion(world, 'Quelle stratégie économique est possible ?', { questionKind: 'strategy' });
    const factId = local.facts[0]?.id ?? 'date';
    const answer = {
      headline: 'Réponse exploitable malgré un claim écarté',
      synthesis: 'Les options restent fondées sur les faits transmis.',
      keyJudgment: 'Conserver une trajectoire graduelle.',
      options: [1, 2, 3].map((index) => ({
        title: `Option ${index}`,
        proposal: `Préparer une étape ${index}.`,
        whyPlausible: 'Cette option s’appuie sur un fait transmis.',
        whyRefused: 'Elle mobilise des moyens.',
        estimatedConsequences: ['Effet progressif.'],
        risks: ['Retard possible.'],
        factIds: [factId],
      })),
      blindSpots: ['Les réactions non documentées restent inconnues.'],
      claims: [
        { text: 'Le fait transmis est exploitable.', status: 'fact', factIds: [factId] },
        { text: 'Ce fait n’existe pas dans le contexte.', status: 'fact', factIds: ['fact-inexistant'] },
        { text: 'Une trajectoire graduelle est envisageable.', status: 'proposal', factIds: [] },
      ],
    };
    const { request, upstream } = makeRequest('mock-route-isolated-claim', answer);
    globalThis.fetch = (async (input, init) => requestUrl(input).includes('api.openai.com') ? upstream : previousFetch(input, init)) as typeof fetch;
    const response = await advisorPOST(request);
    const body = await response.json() as { ok: boolean; answer?: { claims: unknown[] }; diagnostics?: { removedFactIds: string[]; removedClaims: number[] } };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.answer?.claims.length, 2);
    assert.deepEqual(body.diagnostics, { removedFactIds: ['fact-inexistant'], removedClaims: [1] });
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});
