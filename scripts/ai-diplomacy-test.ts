import { mkdir, writeFile } from 'node:fs/promises';

import { createFrance2000World } from '../lib/simulation/scenario-2000';
import { executeAIJob } from '../lib/simulation/ai/executor';
import { openDiplomaticDialogue, requestDiplomaticDialogueAI } from '../lib/simulation/diplomacy-dialogue';

const origin = process.env.ORDO_TEST_ORIGIN ?? 'http://localhost:3000';
const sessionId = `ai-diplomacy-${Date.now()}`;

const requestToOrigin = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(init.headers);
  headers.set('Origin', origin);
  headers.set('cf-connecting-ip', `ordo-diplomacy-${sessionId}`);
  return fetch(path.startsWith('/') ? `${origin}${path}` : path, { ...init, headers });
};

type Scenario = {
  id: string;
  participants: string[];
  opening: string;
  dossierId?: string;
};

const scenarios: Scenario[] = [
  {
    id: 'bilateral-industrial',
    participants: ['DEU'],
    opening: 'La France propose une coopération industrielle européenne sur les semi-conducteurs, avec réciprocité, garanties de souveraineté et calendrier avant le prochain Conseil européen.',
  },
  {
    id: 'multilateral-energy',
    participants: ['DEU', 'ITA'],
    opening: 'La France propose une coordination trilatérale des stocks gaziers et des achats d’urgence, sans engagement automatique ni transfert permanent de souveraineté.',
  },
  {
    id: 'dossier-european-convergence',
    participants: ['DEU'],
    dossierId: 'current-lisbon-convergence',
    opening: 'Sur le dossier de convergence européenne, la France souhaite ouvrir une négociation sur les garanties industrielles, les étapes de coordination et les lignes rouges de chaque gouvernement.',
  },
];

const selectedScenarios = process.argv[2]
  ? scenarios.filter((scenario) => scenario.id === process.argv[2])
  : scenarios;

const results: unknown[] = [];

for (const scenario of selectedScenarios) {
  const started = performance.now();
  let state = createFrance2000World();
  const opened = openDiplomaticDialogue(state, scenario.participants, scenario.opening, scenario.dossierId);
  if (!opened.ok) {
    results.push({ id: scenario.id, ok: false, stage: 'open', error: opened.error });
    continue;
  }
  state = opened.state;
  const queued = requestDiplomaticDialogueAI(state, opened.dialogueId);
  if (!queued.ok) {
    results.push({ id: scenario.id, ok: false, stage: 'queue', error: queued.error });
    continue;
  }
  const executed = await executeAIJob(queued.state, queued.jobId, sessionId, requestToOrigin);
  state = executed.state;
  const dialogue = state.diplomaticDialogues[opened.dialogueId];
  results.push({
    id: scenario.id,
    ok: executed.ok,
    elapsedMs: Math.round(performance.now() - started),
    participants: dialogue?.participantIds,
    linkedDossierId: dialogue?.linkedDossierId,
    activeSpeakerId: dialogue?.activeSpeakerId,
    status: dialogue?.status,
    response: executed.response,
    dialogue,
  });
  console.log(`${scenario.id}: ok=${executed.ok} elapsedMs=${Math.round(performance.now() - started)} status=${dialogue?.status ?? 'unknown'}`);
}

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-diplomacy-test-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify({ sessionId, origin, scenarios, results }, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
console.log(JSON.stringify(results, null, 2));
