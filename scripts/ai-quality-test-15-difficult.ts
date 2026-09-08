import { createAdvisorAIRequest } from '../lib/ai/contracts';
import { answerAdvisorQuestion } from '../lib/simulation/advisor';
import { createFrance2000World } from '../lib/simulation/scenario-2000';
import { mkdir, writeFile } from 'node:fs/promises';

const questions = [
  'La France veut réduire sa dépendance énergétique sans affaiblir son industrie : compare une stratégie gaz, une stratégie nucléaire et une stratégie de sobriété, avec les chiffres disponibles, les coûts, les acteurs opposés et les effets sur cinq ans.',
  'La Russie réduit ses livraisons de gaz à l’Europe : propose trois trajectoires françaises sur six mois, en tenant compte des stocks, des capacités exportatrices disponibles, du budget, de l’industrie et des réactions de l’Allemagne et de l’Algérie.',
  'Construis une proposition de partage d’hydrocarbures entre la Turquie et la Grèce qui maintient leurs revendications territoriales ouvertes, répartit les bénéfices, protège les infrastructures et crée plusieurs sorties diplomatiques plausibles.',
  'La France veut prendre le leadership européen dans une crise régionale tout en conservant son autonomie stratégique et sa relation avec les États-Unis : quelles concessions sont acceptables pour l’Allemagne, l’Italie et le Royaume-Uni ?',
  'Compare deux trajectoires françaises sur cinq ans : priorité aux semi-conducteurs ou priorité à l’énergie, sous contrainte de dette et de capacité administrative, avec effets attendus sur le PIB, la croissance, l’emploi, la dette et la souveraineté.',
  'La France accumule des stocks de gaz et négocie avec l’Algérie, la Norvège et la Russie : analyse les réactions probables des fournisseurs, des voisins, des industriels, des syndicats et des écologistes, puis propose deux mécanismes de prévention de l’hégémonie.',
  'Une réforme française de réduction de la coopération avec l’OTAN devient très impopulaire : crée un général atlantiste émergent, avec personnalité, intérêts, moyens d’action, seuils d’escalade et plusieurs suites possibles sans imposer un scénario unique.',
  'La France devient dominante dans les contrats pétroliers méditerranéens : compare les réactions de l’Algérie, de la Libye, de la Turquie, de la Grèce et de l’Allemagne, puis propose une stratégie de partage qui ne transforme pas les partenaires en dépendants.',
  'La France abandonne une politique de rigueur alors que l’Allemagne refuse toute mutualisation de dette : quelles conséquences économiques et politiques plausibles, quelles lignes rouges empêchent un compromis et quelles mesures graduelles restent compatibles avec les deux appareils politiques ?',
  'Propose un plan français de cinq ans pour réduire la vulnérabilité énergétique en combinant contrats, stockage, production nationale, diversification des routes et sobriété, sans inventer de capacités absentes du registre.',
  'Pourquoi la France ne peut-elle pas vendre des armements à l’infini ? Priorise Rafale, CAESAR, sous-marins et radars en tenant compte des capacités annuelles, des carnets de commandes, des preuves techniques et des preuves au combat.',
  'La France réforme simultanément l’armée, les syndicats et les grands corps administratifs : identifie les acteurs susceptibles de se coaliser, les mesures qui augmentent la corruption par surcharge et les compromis permettant de conserver une capacité d’exécution.',
  'Compare les intérêts de la France, du Japon, de l’Inde et de l’Australie face à une crise de semi-conducteurs : propose une coalition industrielle réaliste, ses contreparties, ses coûts politiques et les risques de dépendance envers les États-Unis.',
  'Une crise de dette touche un grand importateur d’énergie tandis qu’un fournisseur exportateur perd de la capacité : explique les transmissions vers les banques, le commerce, l’emploi, les stocks et les relations diplomatiques, puis propose deux réponses non équivalentes.',
  'Le joueur engage trop d’actions diplomatiques, économiques et secrètes pendant plusieurs mois : diagnostique les effets de surcharge par domaine, les signaux de défiance des militaires, du capital, des syndicats et de l’administration, et les moyens crédibles de rétablir la capacité gouvernementale.',
];

const origin = process.env.ORDO_TEST_ORIGIN ?? 'http://localhost:3000';
const world = createFrance2000World();
const sessionId = `quality-15-difficult-${Date.now()}`;
const results: unknown[] = [];
const selectedQuestions = questions.slice(0, Math.max(1, Math.min(questions.length, Number.parseInt(process.env.ORDO_TEST_LIMIT ?? String(questions.length), 10) || questions.length)));

for (const [index, question] of selectedQuestions.entries()) {
  const local = answerAdvisorQuestion(world, question);
  const payload = createAdvisorAIRequest(world, question, local, sessionId);
  const started = performance.now();
  const response = await fetch(`${origin}/api/ai/advisor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'cf-connecting-ip': `ordo-quality-15-difficult-${index + 1}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as Record<string, unknown>;
  results.push({
    index: index + 1,
    tier: 'difficile',
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
  console.log(`${index + 1}/${selectedQuestions.length} status=${response.status} ok=${String(data.ok)} durationMs=${Math.round(performance.now() - started)}`);
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-quality-test-15-difficult-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
