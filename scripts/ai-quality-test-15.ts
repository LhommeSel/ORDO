import { createAdvisorAIRequest } from '../lib/ai/contracts';
import { answerAdvisorQuestion } from '../lib/simulation/advisor';
import { createFrance2000World } from '../lib/simulation/scenario-2000';
import { mkdir, writeFile } from 'node:fs/promises';

// Test de qualité volontairement limité aux questions moyennes et difficiles.
// Les réponses complètes sont conservées dans outputs/ pour audit.
const questions = [
  // Moyennes / situées
  'Compare la vulnérabilité énergétique de la France et de l’Allemagne et indique les chiffres qui justifient ton diagnostic.',
  'Que peut négocier concrètement la France avec l’Algérie pour sécuriser son gaz, en tenant compte des volumes, du budget et de la relation bilatérale ?',
  'Comment renforcer la filière française des semi-conducteurs sans dépasser les capacités budgétaires et administratives disponibles ?',
  'Quelle coopération concrète la France peut-elle proposer au Japon dans les domaines technologique, industriel et de défense ?',
  'La France veut un contrat gazier avec l’Algérie : quel mandat initial réaliste envoyer et quels points laisser ouverts à la négociation ?',
  // Difficiles / multi-contraintes
  'La France accumule des stocks de gaz : quelles réactions plausibles des voisins, des fournisseurs, des industriels et des écologistes, et quelles décisions devraient être prises dans les douze prochains mois ?',
  'La Russie réduit ses livraisons de gaz à l’Europe : compare deux trajectoires françaises sur six mois avec coûts budgétaires, effets industriels, risques diplomatiques et acteurs concernés.',
  'Construis une proposition de partage d’hydrocarbures entre la Turquie et la Grèce qui respecte leurs intérêts, maintient leurs revendications territoriales ouvertes et crée une porte de sortie diplomatique.',
  'La France veut prendre le leadership européen dans une crise régionale tout en préservant son autonomie stratégique et sa relation avec les États-Unis : propose trois options chiffrées et leurs contreparties.',
  'Compare deux trajectoires françaises sur cinq ans : priorité aux semi-conducteurs ou priorité à l’énergie, sous contrainte budgétaire, en détaillant les effets sur le PIB, la dette, l’emploi et la souveraineté.',
  'La France abandonne une politique de rigueur alors que l’Allemagne refuse toute mutualisation de dette : quelles conséquences économiques et politiques plausibles, et quels compromis sont négociables ?',
  'Propose un plan de cinq ans pour réduire la vulnérabilité énergétique française en tenant compte des capacités administratives, diplomatiques, industrielles et budgétaires, avec étapes et indicateurs.',
  'Pourquoi la France ne peut-elle pas vendre des armements à l’infini ? Propose une priorisation entre Rafale, CAESAR et sous-marins en tenant compte des capacités de production et des contrats déjà engagés.',
  'Une réforme anti-OTAN devient très impopulaire : crée un acteur politique cohérent susceptible de s’y opposer, avec personnalité, objectifs, moyens d’action et suites d’événements possibles sans imposer un scénario unique.',
  'La France devient dominante dans les contrats pétroliers méditerranéens : analyse les réactions probables de l’Algérie, de la Libye, de la Turquie, de la Grèce et de l’Allemagne, puis propose deux stratégies de prévention de l’hégémonie.',
];

const origin = process.env.ORDO_TEST_ORIGIN ?? 'http://localhost:3000';
const world = createFrance2000World();
const sessionId = `quality-15-${Date.now()}`;
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
      'cf-connecting-ip': `ordo-quality-15-${index + 1}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as Record<string, unknown>;
  results.push({
    index: index + 1,
    tier: index < 5 ? 'moyenne' : 'difficile',
    question,
    localQuestionKind: local.questionKind,
    localDimensions: local.dimensions,
    localResponseMode: local.responseMode,
    localActors: local.actors,
    status: response.status,
    ok: data.ok,
    durationMs: Math.round(performance.now() - started),
    answer: data.answer,
    usage: data.usage,
    error: data.ok ? undefined : data,
    requestFacts: payload.context.facts,
  });
  console.log(`${index + 1}/15 status=${response.status} ok=${String(data.ok)} durationMs=${Math.round(performance.now() - started)}`);
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-quality-test-15-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
