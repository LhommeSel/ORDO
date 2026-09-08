import { createAdvisorAIRequest } from '../lib/ai/contracts';
import { answerAdvisorQuestion } from '../lib/simulation/advisor';
import { createFrance2000World } from '../lib/simulation/scenario-2000';
import { mkdir, writeFile } from 'node:fs/promises';

const questions = [
  'Quel est le PIB réel de la France en 2000 ?',
  'Quel est l’état des forces militaires françaises ?',
  'Quel est le risque immédiat majeur pour la France ?',
  'Compare la dépendance énergétique de la France et de l’Allemagne.',
  'Que peut faire la France avec l’Algérie pour réduire sa vulnérabilité gazière ?',
  'Propose une stratégie concrète de coopération avec la Turquie.',
  'Comment renforcer la filière française des semi-conducteurs sans ignorer les contraintes budgétaires ?',
  'Si les approvisionnements russes deviennent incertains, quelles décisions françaises préparer ?',
  'Nous voulons accroître fortement les réserves de gaz françaises et négocier avec l’Algérie : quel mandat réaliste envoyer ?',
  'Comment la France peut-elle approfondir son partenariat avec le Japon sans diluer son autonomie stratégique ?',
];

const start = Number.parseInt(process.argv[2] ?? '0', 10);
const count = Number.parseInt(process.argv[3] ?? String(questions.length), 10);
const selected = questions.slice(start, start + count);
const origin = process.env.ORDO_TEST_ORIGIN ?? 'http://localhost:3000';
const world = createFrance2000World();

const results: unknown[] = [];
for (const [offset, question] of selected.entries()) {
  const local = answerAdvisorQuestion(world, question);
  const payload = createAdvisorAIRequest(world, question, local, `quality-session-${String(start + offset).padStart(2, '0')}-20260906`);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const response = await fetch(`${origin}/api/ai/advisor`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(payload),
  });
  const data = await response.json() as Record<string, unknown>;
  const durationMs = Math.round(performance.now() - started);
  const answer = data.answer as { headline?: string; synthesis?: string; keyJudgment?: string; options?: Array<{ title?: string; proposal?: string; factIds?: string[] }>; blindSpots?: string[] } | undefined;
  results.push({
    index: start + offset + 1, question, status: response.status, ok: data.ok,
    startedAt, durationMs, request: payload, rawResponse: data,
    usage: data.usage,
    answer,
    error: data.ok ? undefined : data,
  });
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-quality-test-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
console.log(JSON.stringify(results, null, 2));
process.exit(0);
