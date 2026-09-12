import assert from 'node:assert/strict';
import test from 'node:test';

import { compileContextForAIJob } from './ai/context';
import { createWorld2000 } from './scenario-2000';
import { deriveDiplomaticFeasibility, enforceDiplomaticMove } from './diplomatic-feasibility';
import { evaluateHistoricalChronology } from './historical-chronology';
import { applyDiplomaticDialogueAIAnswer, openDiplomaticDialogue, requestDiplomaticDialogueAI, resolveDiplomaticDialogueResponse } from './diplomacy-dialogue';
import { applyDiplomaticMeetingAIAnswer, proposeDiplomaticMeeting, requestDiplomaticMeetingAI, reviseDiplomaticAgreementDraft } from './diplomatic-negotiation';
import type { AIGenericDiplomaticMove } from '../ai/job-contracts';
import type { GeneralAIJob } from './types';

const acceptedMove: AIGenericDiplomaticMove = {
  scope: 'general_dialogue', kind: 'accept', agreementType: 'mediation',
  position: 'Nous acceptons.', concessions: [], guaranteesRequested: [], conditions: [], redLines: [], timeline: 'Immédiat',
};

function diplomacyJob(inputText: string, requestingCountryId: string, respondingCountryId: string, participantIds: string[]): GeneralAIJob {
  return {
    id: `test-diplomacy-${respondingCountryId}`,
    kind: 'diplomacy', schemaVersion: 1, priority: 'normal', budgetTier: 'standard', status: 'pending', requestedAt: '2000-01-01', attempts: 0,
    inputText, purpose: 'Tester la cohérence diplomatique', actorId: requestingCountryId,
    reasons: ['Test des lignes rouges et du contrôle chronologique.'],
    context: { respondingCountryId, participantIds, playerIntent: inputText },
  };
}

test('refuse une acceptation anachronique Russie–Ukraine en 2000', () => {
  const state = createWorld2000('FRA');
  const feasibility = deriveDiplomaticFeasibility(state, 'RUS', ['UKR'], 'Proposer un cessez-le-feu mutuel immédiat entre la Russie et l’Ukraine.');
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'chronology.no-active-conflict'));
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'chronology.rus-ukr-pre-2014'));
  const constrained = enforceDiplomaticMove(state, 'RUS', ['UKR'], 'Proposer un cessez-le-feu mutuel immédiat entre la Russie et l’Ukraine.', acceptedMove, 'Nous acceptons le cessez-le-feu.');
  assert.equal(constrained.overridden, true);
  assert.equal(constrained.move.kind, 'counter');
  assert.match(constrained.publicMessage, /contre-proposition/i);
  assert.match(constrained.move.conditions.join(' '), /préventif|sécurité|anachronique/i);
});

test('bloque une alliance stratégique trilatérale de containment contre la Chine', () => {
  const state = createWorld2000('FRA');
  const text = 'Proposer une coopération stratégique et une alliance militaire USA-France-Chine pour contenir la Chine.';
  const feasibility = deriveDiplomaticFeasibility(state, 'CHN', ['USA', 'FRA'], text);
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'red-line:chn-anti-coalition'));
  assert.ok(feasibility.blockingIssues.some((item) => item.id === 'red-line:chn-trilateral-containment'));
  const constrained = enforceDiplomaticMove(state, 'CHN', ['USA', 'FRA'], text, acceptedMove, 'La Chine accepte.');
  assert.equal(constrained.move.kind, 'counter');
  assert.match(constrained.move.redLines.join(' '), /coalition|trilatérale|containment/i);
});

test('ne bloque pas une formulation qui protège explicitement la ligne rouge', () => {
  const state = createWorld2000('FRA');
  const feasibility = deriveDiplomaticFeasibility(state, 'RUS', ['FRA'], 'Nous refusons l’extension de l’OTAN et voulons prévenir toute occupation.');
  assert.equal(feasibility.matchedRules.some((item) => item.id === 'rus-post-soviet-space'), false);
  assert.equal(feasibility.blockingIssues.length, 0);
});

test('injecte les garde-fous privés dans le contexte diplomatique sans les rendre publics', () => {
  const state = createWorld2000('FRA');
  const job = diplomacyJob('Proposer un cessez-le-feu mutuel avec l’Ukraine.', 'FRA', 'RUS', ['FRA', 'RUS', 'UKR']);
  const packet = compileContextForAIJob(state, job);
  const guardrail = packet.privateDecisionFacts.find((item) => item.id.startsWith('diplomacy:guardrails:RUS:'));
  assert.ok(guardrail);
  assert.match(guardrail.statement, /chronologie|conflit actif|BLOQUANT/i);
  assert.equal(packet.knownFacts.some((item) => item.id === guardrail?.id), false);
});

test('applique le garde-fou au moment de résoudre un dialogue, même si le modèle accepte', () => {
  const opened = openDiplomaticDialogue(createWorld2000('FRA'), ['RUS'], 'Proposer un cessez-le-feu mutuel avec la Russie.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Accord', assessment: 'La Russie accepte.', publicMessage: 'Nous acceptons le cessez-le-feu.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, acceptedMove);
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  assert.equal(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.kind, 'counter');
  assert.match(answered.state.diplomaticDialogues[opened.dialogueId].turns.at(-1)?.publicMessage ?? '', /contre-proposition/i);
  assert.ok(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.rejectedTerms?.length);
  assert.ok(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.conditionalTerms?.length);
  assert.equal(answered.state.diplomaticDialogues[opened.dialogueId].lastResponse?.decisionScope, 'principle');
});

test('registre chronologique : une invasion de l’Irak avant 2003 devient une prévention', () => {
  const findings = evaluateHistoricalChronology('2000-01-01', 'Préparer une intervention en Irak avec les États-Unis.', ['USA', 'IRQ']);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.id, 'chronology.iraq-invasion-pre-2003');
});

test('le registre chronologique ne confond pas une prévention avec un fait déjà réalisé', () => {
  const findings = evaluateHistoricalChronology('2000-01-01', 'Prévenir une intervention en Irak et éviter une invasion.', ['USA', 'IRQ']);
  assert.equal(findings.length, 0);
});

test('cinq scénarios diplomatiques restent différenciés par leurs lignes rouges et leur calendrier', () => {
  const state = createWorld2000('FRA');
  const scenarios = [
    {
      name: 'Russie–Ukraine', actorId: 'RUS', participants: ['UKR'],
      text: 'Signer un cessez-le-feu mutuel immédiat.', expected: 'counter',
    },
    {
      name: 'Chine–États-Unis–France', actorId: 'CHN', participants: ['USA', 'FRA'],
      text: 'Former une alliance militaire USA-France-Chine pour contenir la Chine.', expected: 'counter',
    },
    {
      name: 'Gaz Grèce–Turquie', actorId: 'TUR', participants: ['GRC'],
      text: 'Exploiter le gaz en mer Égée ; les zones disputées restent contestées et chaque partie garde ses droits.', expected: 'accept',
    },
    {
      name: 'Vente d’armes à l’Inde', actorId: 'IND', participants: ['FRA'],
      text: 'Acheter des avions français avec formation et maintenance locale.', expected: 'accept',
    },
    {
      name: 'Dette allemande', actorId: 'DEU', participants: ['FRA'],
      text: 'Accepter une mutualisation durable des dettes sans discipline commune.', expected: 'counter',
    },
  ];
  const results = scenarios.map((scenario) => {
    const feasibility = deriveDiplomaticFeasibility(state, scenario.actorId, scenario.participants, scenario.text);
    const constrained = enforceDiplomaticMove(state, scenario.actorId, scenario.participants, scenario.text, acceptedMove, 'Nous acceptons cette proposition.');
    return { scenario, feasibility, constrained };
  });
  assert.deepEqual(results.map(({ constrained }) => constrained.move.kind), ['counter', 'counter', 'accept', 'accept', 'counter']);
  assert.equal(results[0]?.feasibility.blockingIssues.some((item) => item.id === 'chronology.no-active-conflict'), true);
  assert.equal(results[1]?.feasibility.blockingIssues.some((item) => item.id === 'red-line:chn-trilateral-containment'), true);
  assert.equal(results[2]?.feasibility.issues.length, 0);
  assert.equal(results[3]?.feasibility.issues.length, 0);
  assert.equal(results[4]?.feasibility.blockingIssues.some((item) => item.id === 'red-line:deu-debt-mutualization'), true);
  assert.ok(results[0]?.constrained.move.rejectedTerms?.length);
  assert.ok(results[4]?.constrained.move.conditionalTerms?.length);
});

test('une rencontre multilatérale exige une position distincte et applique le veto d’un participant', () => {
  const opened = openDiplomaticDialogue(createWorld2000('FRA'), ['TUR', 'GRC'], 'Proposons une coopération énergétique en mer Égée.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Cadre de discussion', assessment: 'Les parties sont prêtes à discuter.', publicMessage: 'Nous pouvons discuter sous garanties.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 100,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'energy_cooperation', position: 'Poursuivre sous garanties.', concessions: [], guaranteesRequested: ['Déconfliction'], conditions: [], redLines: [], timeline: 'Six mois.',
  });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const accepted = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const meeting = proposeDiplomaticMeeting(accepted.state, opened.dialogueId, 'discreet');
  assert.equal(meeting.ok, true);
  if (!meeting.ok || typeof meeting.meetingId !== 'string' || typeof meeting.draftId !== 'string') return;
  const request = requestDiplomaticMeetingAI(meeting.state, meeting.draftId);
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const result = applyDiplomaticMeetingAIAnswer(request.state, request.jobId, {
    headline: 'Positions divergentes', assessment: 'La Turquie accepte, la Grèce demande un ajustement territorial.', publicMessage: 'La Turquie accepte le cadre ; la Grèce demande de préserver explicitement ses droits en mer Égée.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 180,
  }, {
    scope: 'general_dialogue', kind: 'accept', agreementType: 'energy_cooperation', position: 'Accord énergétique possible.', concessions: ['Partager les recettes'], guaranteesRequested: [], conditions: [], redLines: [], timeline: 'Vingt ans.',
    participantResponses: [
      { participantId: 'TUR', kind: 'accept', position: 'La Turquie accepte le cadre.', acceptedTerms: ['Partager les recettes'], rejectedTerms: [], conditionalTerms: [], rationale: 'Le cadre respecte ses intérêts énergétiques.' },
      { participantId: 'GRC', kind: 'counter', position: 'La Grèce accepte sous réserve de ses droits territoriaux.', acceptedTerms: ['Partager les recettes'], rejectedTerms: ['Forage unilatéral'], conditionalTerms: ['Aucune reconnaissance de souveraineté adverse'], rationale: 'La souveraineté égéenne reste non négociable.' },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decision, 'countered');
  assert.deepEqual(result.state.diplomaticMeetings[meeting.meetingId].participantPositions?.map((item) => [item.participantId, item.kind]), [['TUR', 'accept'], ['GRC', 'counter']]);
  assert.equal(result.state.diplomaticAgreementDrafts[meeting.draftId].counterpartDecision, 'countered');
  assert.equal(Object.values(result.state.treaties).filter((treaty) => treaty.status === 'active').length, 0);
});

test('une acceptation agrégée sans réponses individuelles reste bloquée en multilatéral', () => {
  const opened = openDiplomaticDialogue(createWorld2000('FRA'), ['TUR', 'GRC'], 'Proposons une coopération maritime.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Accord de principe', assessment: 'Les parties envisagent un accord.', publicMessage: 'Nous acceptons le principe.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 100,
  }, acceptedMove);
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const accepted = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const meeting = proposeDiplomaticMeeting(accepted.state, opened.dialogueId, 'discreet');
  assert.equal(meeting.ok, true);
  if (!meeting.ok || typeof meeting.meetingId !== 'string' || typeof meeting.draftId !== 'string') return;
  const request = requestDiplomaticMeetingAI(meeting.state, meeting.draftId);
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const result = applyDiplomaticMeetingAIAnswer(request.state, request.jobId, {
    headline: 'Consensus annoncé', assessment: 'Tous acceptent.', publicMessage: 'Tous les participants acceptent.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 100,
  }, { ...acceptedMove, agreementType: 'security_cooperation' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decision, 'countered');
  assert.equal(result.state.diplomaticMeetings[meeting.meetingId].participantPositions?.every((item) => item.kind === 'pending'), true);
  assert.equal(result.state.diplomaticAgreementDrafts[meeting.draftId].counterpartDecision, 'countered');
});

test('une contre-proposition ouvre un dossier ciblé et différencie les relations', () => {
  const opened = openDiplomaticDialogue(createWorld2000('FRA'), ['TUR', 'GRC'], 'Proposons une coopération énergétique en mer Égée.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Cadre accepté sous réserve', assessment: 'La Turquie accepte, la Grèce demande une clause territoriale.', publicMessage: 'La Turquie accepte le cadre ; la Grèce demande une garantie supplémentaire.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 100,
  }, { ...acceptedMove, agreementType: 'energy_cooperation', participantResponses: [
    { participantId: 'TUR', kind: 'accept', position: 'La Turquie accepte.', acceptedTerms: ['Partage des recettes'], rejectedTerms: [], conditionalTerms: [], rationale: 'Le cadre est compatible avec ses intérêts.' },
    { participantId: 'GRC', kind: 'counter', position: 'La Grèce demande une garantie territoriale.', acceptedTerms: [], rejectedTerms: ['Forage unilatéral'], conditionalTerms: ['Aucune reconnaissance de souveraineté adverse'], rationale: 'La zone reste disputée.' },
  ] });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const accepted = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const meeting = proposeDiplomaticMeeting(accepted.state, opened.dialogueId, 'discreet');
  assert.equal(meeting.ok, true);
  if (!meeting.ok || typeof meeting.draftId !== 'string') return;
  const meetingRequest = requestDiplomaticMeetingAI(meeting.state, meeting.draftId);
  assert.equal(meetingRequest.ok, true);
  if (!meetingRequest.ok) return;
  const meetingAnswered = applyDiplomaticMeetingAIAnswer(meetingRequest.state, meetingRequest.jobId, {
    headline: 'Cadre accepté sous réserve', assessment: 'La Turquie accepte, la Grèce demande une clause territoriale.', publicMessage: 'La Turquie accepte le cadre ; la Grèce demande une garantie supplémentaire.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 100,
  }, { ...acceptedMove, agreementType: 'energy_cooperation', participantResponses: [
    { participantId: 'TUR', kind: 'accept', position: 'La Turquie accepte.', acceptedTerms: ['Partage des recettes'], rejectedTerms: [], conditionalTerms: [], rationale: 'Le cadre est compatible avec ses intérêts.' },
    { participantId: 'GRC', kind: 'counter', position: 'La Grèce demande une garantie territoriale.', acceptedTerms: [], rejectedTerms: ['Forage unilatéral'], conditionalTerms: ['Aucune reconnaissance de souveraineté adverse'], rationale: 'La zone reste disputée.' },
  ] });
  assert.equal(meetingAnswered.ok, true);
  if (!meetingAnswered.ok) return;
  const dossier = meetingAnswered.state.strategicDossiers[`diplomatic-dialogue-${opened.dialogueId}`];
  assert.equal(dossier?.kind, 'cooperation');
  assert.equal(dossier?.importance, 'moderate');
  assert.ok(dossier?.pendingDecisions.some((prompt) => /Grèce/i.test(prompt)));
  assert.ok(dossier?.entries.some((entry) => /Grèce/i.test(entry.title)));
  const turkeyBefore = meeting.state.relations['TUR:FRA']?.relation ?? 50;
  const greeceBefore = meeting.state.relations['GRC:FRA']?.relation ?? 50;
  assert.equal(meetingAnswered.state.relations['TUR:FRA']?.relation, turkeyBefore + 2);
  assert.equal(meetingAnswered.state.relations['GRC:FRA']?.relation, greeceBefore + 1);

  // Une nouvelle rencontre doit recevoir le dossier et l'historique, plutôt
  // que de repartir du seul intitulé du projet.
  const revised = reviseDiplomaticAgreementDraft(meetingAnswered.state, meeting.draftId, {
    summary: 'Partage des recettes sans reconnaissance de souveraineté sur les zones disputées.',
  });
  assert.equal(revised.ok, true);
  if (!revised.ok) return;
  const resumed = requestDiplomaticMeetingAI(revised.state, meeting.draftId);
  assert.equal(resumed.ok, true);
  if (!resumed.ok) return;
  const resumedJob = resumed.state.aiJobs[resumed.jobId] as GeneralAIJob | undefined;
  const resumedContext = resumedJob?.context as Record<string, unknown> | undefined;
  assert.equal(resumedContext?.dossierId, dossier?.id);
  const negotiationHistory = resumedContext?.negotiationHistory as { previousMeetings?: unknown[] } | undefined;
  assert.ok(negotiationHistory && Array.isArray(negotiationHistory.previousMeetings));
  const resumedPacket = compileContextForAIJob(resumed.state, resumedJob!);
  assert.ok(resumedPacket.knownFacts.some((item) => item.id === `dossier:${dossier?.id}`));
  assert.ok(resumedPacket.knownFacts.some((item) => item.id === `diplomatic-dialogue-positions:${opened.dialogueId}`));
});

test('une révision invalide la réponse précédente et permet de rouvrir un refus', () => {
  const opened = openDiplomaticDialogue(createWorld2000('FRA'), ['GRC'], 'Proposons une coopération maritime.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const first = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(first.state, first.jobId, {
    headline: 'Ouverture', assessment: 'Une rencontre est possible.', publicMessage: 'Nous pouvons examiner le projet.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 80,
  }, { ...acceptedMove, agreementType: 'security_cooperation' });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const accepted = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const meeting = proposeDiplomaticMeeting(accepted.state, opened.dialogueId, 'discreet');
  assert.equal(meeting.ok, true);
  if (!meeting.ok || typeof meeting.draftId !== 'string' || typeof meeting.meetingId !== 'string') return;
  const request = requestDiplomaticMeetingAI(meeting.state, meeting.draftId);
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const refused = applyDiplomaticMeetingAIAnswer(request.state, request.jobId, {
    headline: 'Refus', assessment: 'Le projet est refusé.', publicMessage: 'Nous refusons le projet dans sa forme actuelle.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 80,
  }, { ...acceptedMove, agreementType: 'security_cooperation', kind: 'refuse', position: 'Nous refusons.' });
  assert.equal(refused.ok, true);
  if (!refused.ok) return;
  const reopened = reviseDiplomaticAgreementDraft(refused.state, meeting.draftId, { summary: 'Projet reformulé avec une clause de consultation.' });
  assert.equal(reopened.ok, true);
  if (!reopened.ok) return;
  assert.equal(reopened.state.diplomaticAgreementDrafts[meeting.draftId].stage, 'final_proposal');
  assert.equal(reopened.state.diplomaticAgreementDrafts[meeting.draftId].counterpartDecision, 'pending');
  assert.equal(reopened.state.diplomaticMeetings[meeting.meetingId].status, 'scheduled');
  assert.ok(reopened.state.strategicDossiers[`diplomatic-dialogue-${opened.dialogueId}`]?.entries.some((entry) => /rouvert|révisé/i.test(entry.title)));
});
