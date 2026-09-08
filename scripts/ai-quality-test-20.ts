import { createAdvisorAIRequest } from '../lib/ai/contracts';
import { answerAdvisorQuestion } from '../lib/simulation/advisor';
import { createFrance2000World } from '../lib/simulation/scenario-2000';
import { mkdir, writeFile } from 'node:fs/promises';

const questions = [
  // Simples / factuelles
  'Quel est le PIB de la France en 2000 ?',
  'Quelle est la date de la simulation ?',
  'Quelle est la couverture gazière de la France ?',
  'Quel est le gouvernement allemand au 1er janvier 2000 ?',
  // Moyennes / situées
  'Compare la vulnérabilité énergétique de la France et de l’Allemagne.',
  'Que peut négocier la France avec l’Algérie pour sécuriser son gaz ?',
  'Comment renforcer la filière française des semi-conducteurs sans ignorer le budget ?',
  'Quelle coopération concrète la France peut-elle proposer au Japon ?',
  'La France veut un contrat gazier avec l’Algérie : quel mandat réaliste envoyer ?',
  'Quel serait l’effet d’une hausse durable du prix du pétrole sur la France ?',
  'Comment développer une relation stratégique avec la Turquie sans abandonner les lignes rouges françaises ?',
  'Comment réduire le déficit budgétaire français sans déclencher une crise de dette ?',
  // Difficiles / multi-contraintes
  'La France accumule des stocks de gaz : quelles réactions plausibles des voisins, des fournisseurs et des écologistes ?',
  'La Russie réduit ses livraisons de gaz à l’Europe : quelles options françaises dans les six prochains mois, avec leurs coûts et risques ?',
  'Construis une proposition de partage d’hydrocarbures entre la Turquie et la Grèce qui respecte leurs intérêts et crée une porte de sortie diplomatique.',
  'La France veut prendre le leadership européen dans une crise régionale tout en préservant son autonomie stratégique et sa relation avec les États-Unis : que proposer ?',
  'Compare deux trajectoires françaises sur cinq ans : priorité aux semi-conducteurs ou priorité à l’énergie, sous contrainte budgétaire.',
  'La France abandonne une politique de rigueur alors que l’Allemagne refuse toute mutualisation de dette : quelles conséquences économiques et politiques plausibles ?',
  'Propose un plan de cinq ans pour réduire la vulnérabilité énergétique française en tenant compte des capacités administratives, diplomatiques et budgétaires.',
  'Pourquoi la France ne peut-elle pas vendre des armements à l’infini ? Propose une priorisation entre Rafale, CAESAR et sous-marins.',
];

const origin = process.env.ORDO_TEST_ORIGIN ?? 'http://localhost:3000';
const world = createFrance2000World();
const sessionId = `quality-20-${Date.now()}`;
const results: unknown[] = [];

for (const [index, question] of questions.entries()) {
  const local = answerAdvisorQuestion(world, question);
  const payload = createAdvisorAIRequest(world, question, local, sessionId);
  const started = performance.now();
  const response = await fetch(`${origin}/api/ai/advisor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      // The application rate-limits by IP. Distinct test addresses let the
      // 20-call quality run complete without changing production policy.
      'cf-connecting-ip': `ordo-quality-${index + 1}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as Record<string, unknown>;
  results.push({
    index: index + 1,
    tier: index < 4 ? 'simple' : index < 12 ? 'moyenne' : 'difficile',
    question,
    localQuestionKind: local.questionKind,
    status: response.status,
    ok: data.ok,
    durationMs: Math.round(performance.now() - started),
    answer: data.answer,
    usage: data.usage,
    error: data.ok ? undefined : data,
    requestFacts: payload.context.facts,
  });
  console.log(`${index + 1}/20 status=${response.status} ok=${String(data.ok)} durationMs=${Math.round(performance.now() - started)}`);
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-quality-test-20-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
