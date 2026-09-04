import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrance2000World } from '../simulation/scenario-2000';
import { answerAdvisorQuestion } from '../simulation/advisor';
import { createAdvisorAIRequest, parseAdvisorAIRequest } from './contracts';

test('le contrat IA transmet un contexte compact et refuse une question surdimensionnée', () => {
  const world = createFrance2000World();
  const question = 'Comment négocier un contrat gazier avec l’Algérie ?';
  const local = answerAdvisorQuestion(world, question);
  const request = createAdvisorAIRequest(world, question, local, 'session-ordo-123456');
  assert.equal(parseAdvisorAIRequest(request)?.question, question);
  assert.equal(parseAdvisorAIRequest({ ...request, question: 'x'.repeat(2_001) }), null);
  assert.ok(JSON.stringify(request).length < 20_000);
});
