import { enqueueAIJob } from './ai/orchestrator';
import { commitWorldAction } from './ledger';
import { relationBetween } from './ledger';
import { resolveDossierDecision } from './dossiers';
import { historicalAnchorChannelEffects } from './history';
import type { DiplomaticDialogue, DiplomaticTurn, GeneralAIJob, CountryId, WorldState, AIJobOutcome, DossierEntry, StrategicDossier } from './types';
import type { AIDiplomaticMove } from '../ai/job-contracts';

const unique = <T,>(items: T[]) => [...new Set(items)];

function addMonths(date: `${number}-${number}-${number}`, months: number): `${number}-${number}-${number}` {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as `${number}-${number}-${number}`;
}

function nextSpeaker(state: WorldState, dialogue: Pick<DiplomaticDialogue, 'participantIds' | 'activeSpeakerId' | 'initiatorId'>, exclude: CountryId[] = []) {
  const candidates = dialogue.participantIds.filter((id) => !exclude.includes(id) && id !== dialogue.activeSpeakerId && Boolean(state.countries[id]));
  return candidates.sort((a, b) => {
    const ar = relationBetween(state, dialogue.initiatorId, a)?.relation ?? 50;
    const br = relationBetween(state, dialogue.initiatorId, b)?.relation ?? 50;
    return ar - br || (state.countries[b]?.weight ?? 0) - (state.countries[a]?.weight ?? 0) || a.localeCompare(b);
  })[0] ?? dialogue.participantIds.find((id) => id !== dialogue.initiatorId) ?? dialogue.initiatorId;
}

function turn(id: string, date: `${number}-${number}-${number}`, speakerId: CountryId, kind: DiplomaticTurn['kind'], publicMessage: string): DiplomaticTurn {
  return { id, date, speakerId, kind, publicMessage };
}

/**
 * Un dialogue libre ne doit jamais basculer silencieusement dans le contrat
 * énergétique parce que le joueur a mentionné l'énergie. Le modèle peut
 * malgré tout renvoyer le mauvais scope ; on le ramène alors dans le contrat
 * générique en conservant sa décision et son message public.
 */
function normalizeDialogueMove(move: AIDiplomaticMove, publicMessage: string): Extract<AIDiplomaticMove, { scope: 'general_dialogue' }> {
  if (move.scope === 'general_dialogue') return move;
  const position = publicMessage.trim() || 'La position de l’interlocuteur doit être précisée avant tout engagement.';
  return {
    scope: 'general_dialogue',
    kind: move.kind === 'counter' || move.kind === 'accept' || move.kind === 'refuse' ? move.kind : 'message',
    agreementType: move.clauses.includes('technology_cooperation') || move.clauses.includes('infrastructure_investment')
      ? 'industrial_cooperation'
      : 'industrial_cooperation',
    position,
    concessions: move.clauses.includes('local_content') ? ['Étudier une participation industrielle locale.'] : [],
    guaranteesRequested: move.clauses.includes('diplomatic_consultation') ? ['Prévoir des consultations régulières entre les deux gouvernements.'] : [],
    conditions: move.annualVolume !== null || move.durationYears !== null
      ? ['Préciser séparément les paramètres techniques lors de la prochaine phase de négociation.']
      : [],
    redLines: [],
    timeline: move.durationYears !== null ? `Réexaminer les paramètres dans ${move.durationYears} an(s).` : 'À préciser lors de la prochaine réunion.',
  };
}

/** Ouvre un canal bilatéral ou multilatéral. La première réponse est produite par l'IA. */
export function openDiplomaticDialogue(state: WorldState, participantIds: CountryId[], openingMessage: string, linkedDossierId?: string) {
  const participants = unique([state.playerCountryId, ...participantIds]).filter((id) => Boolean(state.countries[id]));
  const counterparts = participants.filter((id) => id !== state.playerCountryId);
  if (!openingMessage.trim() || counterparts.length === 0) return { ok: false as const, state, error: 'Ajoutez au moins un pays et un message.' };
  const id = `dialogue-${state.sequence + 1}-${participants.join('-')}`;
  const speaker = nextSpeaker(state, { participantIds: participants, activeSpeakerId: state.playerCountryId, initiatorId: state.playerCountryId });
  const dialogue: DiplomaticDialogue = {
    id, kind: participants.length > 2 ? 'multilateral_dialogue' : 'bilateral_dialogue',
    initiatorId: state.playerCountryId, participantIds: participants, activeSpeakerId: speaker,
    status: 'awaiting_ai', aiMode: 'ai', openedAt: state.currentDate, updatedAt: state.currentDate, linkedDossierId,
    turns: [
      turn(`${id}-player-1`, state.currentDate, state.playerCountryId, 'message', openingMessage.trim()),
    ],
  };
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: counterparts, origin: 'player', visibility: 'player',
    intent: `Ouvrir un dialogue ${dialogue.kind === 'multilateral_dialogue' ? 'multilatéral' : 'bilatéral'}`,
    ...(linkedDossierId ? { metadata: { linkedDossierId } } : {}),
    effects: [
      { kind: 'diplomatic_dialogue_add', dialogue, reason: 'Le canal diplomatique conserve le premier message et attend une réponse IA contextualisée.', visibility: 'player' },
      ...(linkedDossierId && state.strategicDossiers[linkedDossierId] ? [{
        kind: 'dossier_entry_add' as const,
        dossierId: linkedDossierId,
        entry: {
          id: `dialogue-player-entry-${dialogue.id}-1`, date: state.currentDate, title: 'Message du gouvernement', summary: openingMessage.trim(),
          importance: state.strategicDossiers[linkedDossierId].importance, actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' as const,
        },
        reason: 'Le message initial du joueur est conservé dans la chronologie du dossier lié.', visibility: 'player' as const,
      }] : []),
    ],
  }), dialogueId: id };
}

/** Ajoute un interlocuteur à un canal déjà ouvert sans perdre son historique. */
export function addDiplomaticDialogueParticipant(state: WorldState, dialogueId: string, countryId: CountryId) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || dialogue.status === 'closed') return { ok: false as const, state, error: 'Ce canal est fermé.' };
  if (!state.countries[countryId] || countryId === state.playerCountryId) return { ok: false as const, state, error: 'Ce pays ne peut pas être ajouté au canal.' };
  if (dialogue.participantIds.includes(countryId)) return { ok: false as const, state, error: 'Ce pays participe déjà à la discussion.' };
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue,
    kind: 'multilateral_dialogue',
    participantIds: [...dialogue.participantIds, countryId],
    updatedAt: state.currentDate,
  };
  const addedName = state.countries[countryId]?.name ?? countryId;
  const effects: import('./types').WorldEffect[] = [{
    kind: 'diplomatic_dialogue_patch', dialogueId, patch: nextDialogue,
    reason: `${addedName} rejoint le canal diplomatique sans effacer les échanges précédents.`, visibility: 'player',
  }];
  if (dialogue.linkedDossierId && state.strategicDossiers[dialogue.linkedDossierId]) effects.push({
    kind: 'dossier_entry_add', dossierId: dialogue.linkedDossierId,
    entry: {
      id: `dialogue-participant-${dialogue.id}-${countryId}-${state.sequence + 1}`, date: state.currentDate,
      title: 'Participant ajouté au canal', summary: `${addedName} est invité à la discussion diplomatique en cours.`,
      importance: state.strategicDossiers[dialogue.linkedDossierId].importance, actorIds: nextDialogue.participantIds,
      requiresDecision: false, visibility: 'player',
    }, reason: 'L’élargissement du canal est conservé dans le dossier diplomatique.', visibility: 'player',
  });
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: nextDialogue.participantIds.filter((id) => id !== state.playerCountryId),
    origin: 'player', visibility: 'player', intent: `Ajouter ${addedName} au dialogue`, effects,
  }) };
}

function dialogueDossier(state: WorldState, dialogue: DiplomaticDialogue, title: string, summary: string, entryTitle: string, entrySummary: string, commitments: string[] = []): StrategicDossier {
  const entry: DossierEntry = {
    id: `dialogue-dossier-entry-${dialogue.id}-${state.sequence + 1}`, date: state.currentDate, title: entryTitle, summary: entrySummary,
    importance: 'moderate', actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player',
  };
  return {
    id: `diplomatic-dialogue-${dialogue.id}`, title, kind: 'cooperation', status: 'active', importance: 'moderate',
    actorIds: dialogue.participantIds, regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate,
    phase: title.startsWith('Procédure') ? 'Procédure d’accord' : 'Accord conclu', trend: 'stable', publicSummary: summary,
    followed: true, autoTracked: true, commitments, pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [], entries: [entry],
  };
}

/** Ouvre un dialogue depuis une décision de dossier et consomme cette décision. */
export function openDiplomaticDialogueForDossier(state: WorldState, dossierId: string, openingMessage?: string, decisionPrompt?: string) {
  const dossier = state.strategicDossiers?.[dossierId];
  if (!dossier) return { ok: false as const, state, error: 'Dossier introuvable.' };
  const existing = Object.values(state.diplomaticDialogues ?? {}).find((dialogue) => dialogue.linkedDossierId === dossierId && dialogue.status !== 'closed');
  if (existing) {
    const decision = decisionPrompt && dossier.pendingDecisions.includes(decisionPrompt) ? decisionPrompt : undefined;
    const nextState = decision ? resolveDossierDecision(state, dossierId, decision, 'dialogue') : state;
    return { ok: true as const, state: nextState, dialogueId: existing.id };
  }
  const counterparts = dossier.actorIds.filter((id) => id !== state.playerCountryId && Boolean(state.countries[id]));
  const message = openingMessage?.trim() || `Le gouvernement souhaite ouvrir une consultation sur le dossier « ${dossier.title} » et recueillir vos lignes rouges.`;
  const opened = openDiplomaticDialogue(state, counterparts, message, dossierId);
  if (!opened.ok) return opened;
  const decision = decisionPrompt && dossier.pendingDecisions.includes(decisionPrompt)
    ? decisionPrompt
    : dossier.pendingDecisions[0];
  const nextState = decision ? resolveDossierDecision(opened.state, dossierId, decision, 'dialogue') : opened.state;
  return { ok: true as const, state: nextState, dialogueId: opened.dialogueId };
}

export function sendDiplomaticDialogueMessage(state: WorldState, dialogueId: string, message: string) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || dialogue.status !== 'awaiting_player' || !message.trim()) return { ok: false as const, state, error: 'Ce dialogue n’attend pas de message du joueur.' };
  const normalizedMessage = message.trim();
  const lastTurn = dialogue.turns.at(-1);
  // Un double clic ou un rerender ne doit jamais inscrire deux fois le même
  // message du joueur dans l’historique facturé au prochain appel IA.
  if (lastTurn?.speakerId === state.playerCountryId && lastTurn.publicMessage === normalizedMessage) {
    return { ok: false as const, state, error: 'Ce message vient déjà d’être envoyé.' };
  }
  const activeSpeaker = nextSpeaker(state, dialogue, [state.playerCountryId]);
  if (!dialogue.participantIds.includes(activeSpeaker) || activeSpeaker === state.playerCountryId) {
    return { ok: false as const, state, error: 'Aucun interlocuteur valide n’est disponible pour ce dialogue.' };
  }
  const next: DiplomaticDialogue = {
    ...dialogue, status: 'awaiting_ai', aiMode: 'local', activeSpeakerId: activeSpeaker, updatedAt: state.currentDate,
    turns: [...dialogue.turns, turn(`${dialogue.id}-player-${dialogue.turns.length + 1}`, state.currentDate, state.playerCountryId, 'message', normalizedMessage)],
  };
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId), origin: 'player', visibility: 'player',
    intent: `Prendre la parole dans « ${dialogue.id} »`, effects: [
      { kind: 'diplomatic_dialogue_patch', dialogueId, patch: next, reason: 'Le joueur relance le dialogue ; une réponse IA est désormais optionnelle et payante.', visibility: 'player' },
      ...(dialogue.linkedDossierId && state.strategicDossiers[dialogue.linkedDossierId] ? [{
        kind: 'dossier_entry_add' as const, dossierId: dialogue.linkedDossierId,
        entry: {
          id: `dialogue-player-entry-${dialogue.id}-${dialogue.turns.length + 1}`,
          date: state.currentDate, title: 'Message du gouvernement', summary: normalizedMessage,
          importance: state.strategicDossiers[dialogue.linkedDossierId].importance,
          actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' as const,
        },
        reason: 'Le message du joueur est conservé dans la chronologie du dossier lié.', visibility: 'player' as const,
      }] : []),
    ],
    ...(dialogue.linkedDossierId ? { metadata: { linkedDossierId: dialogue.linkedDossierId } } : {}),
  }), speakerId: activeSpeaker };
}

/**
 * Le joueur tranche la dernière position structurée reçue. Une acceptation
 * crée un engagement diplomatique persistant ; un refus ferme le canal ; une
 * demande de révision relance explicitement un tour IA sans appliquer d'effet.
 */
export function resolveDiplomaticDialogueResponse(
  state: WorldState,
  dialogueId: string,
  decision: 'accept' | 'refuse' | 'request_revision' | 'acknowledge',
) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  const response = dialogue?.lastResponse;
  if (!dialogue || !response || dialogue.status !== 'awaiting_player' || dialogue.resolution) {
    return { ok: false as const, state, error: 'Aucune position structurée ne peut être tranchée pour ce dialogue.' };
  }
  if (decision === 'accept' && response.kind !== 'accept' && response.kind !== 'counter') {
    return { ok: false as const, state, error: 'Cette réponse est une prise de position, pas une proposition formalisable.' };
  }
  const labels = {
    accept: 'Position acceptée : un engagement diplomatique est inscrit.',
    refuse: 'Position refusée : le canal diplomatique est fermé.',
    request_revision: 'Révision demandée : une nouvelle réponse de l’interlocuteur est attendue.',
    acknowledge: 'Position reçue : aucun engagement formel n’est créé.',
  } as const;
  const messages = {
    accept: 'Nous acceptons cette position et souhaitons l’inscrire comme engagement diplomatique.',
    refuse: 'Nous refusons cette position dans sa forme actuelle et ne pouvons pas l’inscrire comme engagement.',
    request_revision: 'Nous demandons une révision de cette position, notamment sur les garanties et les conditions proposées.',
    acknowledge: 'Nous prenons acte de votre position. Aucun engagement formel n’est conclu à ce stade.',
  } as const;
  const nextStatus = decision === 'request_revision' ? 'awaiting_ai' as const : 'closed' as const;
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue,
    status: nextStatus,
    updatedAt: state.currentDate,
    resolution: { status: decision === 'request_revision' ? 'revision_requested' : decision === 'accept' ? 'accepted' : decision === 'refuse' ? 'refused' : 'acknowledged', decidedAt: state.currentDate, summary: labels[decision] },
    turns: [...dialogue.turns, turn(`${dialogue.id}-player-resolution-${dialogue.turns.length + 1}`, state.currentDate, state.playerCountryId, decision === 'accept' ? 'acceptance' : decision === 'refuse' ? 'refusal' : 'counterproposal', messages[decision])],
  };
  const effects: import('./types').WorldEffect[] = [
    { kind: 'diplomatic_dialogue_patch', dialogueId, patch: nextDialogue, reason: labels[decision], visibility: 'player' },
  ];
  if (decision === 'accept' && (response.kind === 'accept' || response.kind === 'counter')) {
    const treatyId = `dialogue-commitment-${dialogue.id}-${state.sequence + 1}`;
    const durationByType: Record<typeof response.agreementType, number> = {
      industrial_cooperation: 36, information_sharing: 24, security_cooperation: 24,
      political_guarantee: 18, mediation: 12, defense_cooperation: 36,
    };
    const monthlyByType: Record<typeof response.agreementType, Array<{ countryId: CountryId; metric: 'budget' | 'industry' | 'stability' | 'security'; delta: number }>> = {
      industrial_cooperation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'industry', delta: countryId === state.playerCountryId ? 0.05 : 0.035 })),
      information_sharing: [],
      security_cooperation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'security', delta: countryId === state.playerCountryId ? 0.05 : 0.035 })),
      political_guarantee: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'stability', delta: countryId === state.playerCountryId ? 0.035 : 0.025 })),
      mediation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'stability', delta: 0.02 })),
      defense_cooperation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'security', delta: countryId === state.playerCountryId ? 0.07 : 0.045 })),
    };
    effects.push({
      kind: 'treaty_add',
      treaty: { id: treatyId, parties: dialogue.participantIds, label: `Engagement diplomatique · ${response.agreementType.replaceAll('_', ' ')}`, status: 'active', startDate: state.currentDate, endDate: addMonths(state.currentDate, durationByType[response.agreementType]), monthlyEffects: monthlyByType[response.agreementType] },
      reason: 'L’acceptation du joueur transforme la position diplomatique en engagement persistant.', visibility: 'player',
    });
    if (response.agreementType === 'information_sharing') {
      effects.push(...dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((targetId) => ({
        kind: 'intelligence_delta' as const, observerId: state.playerCountryId, targetId, delta: 8,
        reason: 'Un accord d’échange d’informations améliore la connaissance de l’interlocuteur.', visibility: 'player' as const,
      })));
    }
  }
  const relationEffect = decision === 'accept' && (response.kind === 'accept' || response.kind === 'counter') ? { relation: 4, trust: 3 } : decision === 'refuse' ? { relation: -3, trust: -2 } : null;
  if (relationEffect) effects.push(...dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((targetId) => ({
    kind: 'relation_delta' as const, from: state.playerCountryId, to: targetId, relation: relationEffect.relation, trust: relationEffect.trust,
    reason: decision === 'accept' ? 'L’acceptation d’un engagement diplomatique renforce la relation.' : 'Le refus d’une position diplomatique dégrade la relation.', visibility: 'player' as const,
  })));
  const formalAgreement = decision === 'accept' && (response.kind === 'accept' || response.kind === 'counter');
  if (!dialogue.linkedDossierId && (formalAgreement || decision === 'request_revision')) {
    const names = dialogue.participantIds.map((id) => state.countries[id]?.name ?? id).join(', ');
    const agreementLabel = response.agreementType.replaceAll('_', ' ');
    const dossier = formalAgreement
      ? dialogueDossier(state, dialogue, `Accord diplomatique · ${names}`, `Un accord de ${agreementLabel} est conclu avec ${names} et doit désormais être suivi dans le temps.`, 'Accord diplomatique conclu', response.position, [`Engagement diplomatique : ${response.position}`])
      : dialogueDossier(state, dialogue, `Procédure d’accord · ${names}`, `Une procédure de négociation est ouverte avec ${names} ; les garanties et conditions restent à préciser.`, 'Procédure d’accord ouverte', messages.request_revision);
    effects.push({ kind: 'dossier_add', dossier, reason: formalAgreement ? 'L’accord conclu devient un dossier de suivi.' : 'La demande de révision ouvre une procédure d’accord suivie.', visibility: 'player' });
  }
  if (dialogue.linkedDossierId && state.strategicDossiers[dialogue.linkedDossierId]) {
    const dossier = state.strategicDossiers[dialogue.linkedDossierId];
    effects.push(
      { kind: 'dossier_patch', dossierId: dossier.id, patch: { commitments: decision === 'accept' && (response.kind === 'accept' || response.kind === 'counter') ? [...dossier.commitments, `Engagement diplomatique : ${response.position}`] : dossier.commitments, playerStance: messages[decision] }, reason: 'La décision du joueur actualise les engagements du dossier.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId: dossier.id, entry: { id: `dialogue-resolution-${dialogue.id}-${state.sequence + 1}`, date: state.currentDate, title: labels[decision], summary: messages[decision], importance: dossier.importance, actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' }, reason: 'La résolution du dialogue est conservée dans la chronologie du dossier.', visibility: 'player' },
    );
    const historicalResolution = decision === 'accept' && (response.kind === 'accept' || response.kind === 'counter')
      ? 'diplomatic_agreement' as const
      : decision === 'refuse' ? 'diplomatic_refusal' as const : undefined;
    if (historicalResolution) effects.push(...historicalAnchorChannelEffects(state, dossier.id, { sourceId: dialogue.id, resolution: historicalResolution }));
  }
  return { ok: true as const, state: commitWorldAction(state, { kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId), origin: 'player', visibility: 'player', intent: labels[decision], effects }), decision };
}

/** Crée la tâche IA qui produit la réponse de l’interlocuteur. */
export function requestDiplomaticDialogueAI(state: WorldState, dialogueId: string) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || dialogue.status !== 'awaiting_ai') return { ok: false as const, state, error: 'Aucune réponse IA n’est en attente pour ce dialogue.' };
  if (!dialogue.participantIds.includes(dialogue.activeSpeakerId) || dialogue.activeSpeakerId === state.playerCountryId || !state.countries[dialogue.activeSpeakerId]) {
    return { ok: false as const, state, error: 'L’interlocuteur du dialogue est invalide ; aucun appel IA n’a été lancé.' };
  }
  const speaker = state.countries[dialogue.activeSpeakerId];
  const job: GeneralAIJob = {
    id: `diplomacy-dialogue:${dialogue.id}:${dialogue.turns.length}`,
    kind: 'diplomacy', schemaVersion: 1, priority: 'normal', budgetTier: 'standard', status: 'pending', requestedAt: state.currentDate, attempts: 0,
    inputText: dialogue.turns.at(-1)?.publicMessage ?? '',
    purpose: `Réponse de ${speaker?.name ?? dialogue.activeSpeakerId} dans un dialogue diplomatique`, actorId: state.playerCountryId,
    reasons: ['Respecter les intérêts, la personnalité et les lignes rouges de l’interlocuteur.'],
    context: { dialogueId: dialogue.id, respondingCountryId: dialogue.activeSpeakerId, participantIds: dialogue.participantIds, recentTurns: dialogue.turns.slice(-12), playerIntent: dialogue.turns.at(-1)?.publicMessage ?? '' },
  };
  const queued = enqueueAIJob(state, job);
  const patched = commitWorldAction(queued, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId), origin: 'player', visibility: 'player',
    intent: `Demander la réponse de ${speaker?.name ?? dialogue.activeSpeakerId}`, effects: [{ kind: 'diplomatic_dialogue_patch', dialogueId, patch: { aiMode: 'ai' }, reason: 'Le joueur confirme explicitement la consommation d’un appel IA.', visibility: 'player' }],
  });
  return { ok: true as const, state: patched, jobId: job.id, speakerId: dialogue.activeSpeakerId };
}

export function applyDiplomaticDialogueAIAnswer(state: WorldState, jobId: string, outcome: AIJobOutcome, move?: AIDiplomaticMove | null) {
  const job = state.aiJobs[jobId];
  if (!job || job.kind !== 'diplomacy' || typeof job.context.dialogueId !== 'string') return { ok: false as const, state, error: 'Tâche de dialogue introuvable.' };
  const dialogue = state.diplomaticDialogues[job.context.dialogueId];
  if (!dialogue) return { ok: false as const, state, error: 'Dialogue introuvable.' };
  const speaker = dialogue.activeSpeakerId;
  if (job.context.respondingCountryId !== speaker || !dialogue.participantIds.includes(speaker) || speaker === state.playerCountryId || !state.countries[speaker]) {
    return { ok: false as const, state, error: 'La réponse IA ne correspond pas à l’interlocuteur attendu.' };
  }
  const nextSpeakerId = nextSpeaker(state, dialogue, [state.playerCountryId, speaker]);
  const response = outcome.publicMessage.trim();
  const relationEffect = move?.kind === 'accept' ? { relation: 5, trust: 3 } : move?.kind === 'refuse' ? { relation: -5, trust: -3 } : move?.kind === 'counter' ? { relation: 2, trust: 1 } : null;
  const normalizedMove = move ? normalizeDialogueMove(move, response) : null;
  const structuredResponse = normalizedMove?.scope === 'general_dialogue' ? {
    kind: normalizedMove.kind,
    agreementType: normalizedMove.agreementType,
    position: normalizedMove.position,
    concessions: normalizedMove.concessions,
    guaranteesRequested: normalizedMove.guaranteesRequested,
    conditions: normalizedMove.conditions,
    redLines: normalizedMove.redLines,
    timeline: normalizedMove.timeline,
  } : dialogue.lastResponse;
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue, status: 'awaiting_player', aiMode: 'ai', activeSpeakerId: nextSpeakerId, updatedAt: state.currentDate,
    resolution: undefined,
    lastResponse: structuredResponse,
    turns: [...dialogue.turns, turn(`${dialogue.id}-${speaker}-${dialogue.turns.length + 1}`, state.currentDate, speaker, 'message', response || outcome.assessment.slice(0, 600))],
  };
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: speaker, targetIds: dialogue.participantIds.filter((id) => id !== speaker), origin: 'ai', visibility: 'player',
    intent: `Réponse diplomatique de ${speaker} dans « ${dialogue.id} »`, effects: [
      { kind: 'diplomatic_dialogue_patch', dialogueId: dialogue.id, patch: nextDialogue, reason: 'La réponse IA est ajoutée à la mémoire du canal diplomatique.', visibility: 'player' },
      ...(relationEffect ? dialogue.participantIds.filter((id) => id !== speaker).map((targetId) => ({ kind: 'relation_delta' as const, from: speaker, to: targetId, relation: relationEffect.relation, trust: relationEffect.trust, reason: `Position diplomatique ${move?.kind === 'accept' ? 'favorable' : move?.kind === 'refuse' ? 'refusée' : 'contre-proposée'} dans le dialogue.`, visibility: 'player' as const })) : []),
      ...(dialogue.linkedDossierId && state.strategicDossiers[dialogue.linkedDossierId] ? [{ kind: 'dossier_entry_add' as const, dossierId: dialogue.linkedDossierId, entry: { id: `dialogue-entry-${dialogue.id}-${dialogue.turns.length + 1}`, date: state.currentDate, title: `Réponse de ${state.countries[speaker]?.name ?? speaker}`, summary: response || outcome.assessment.slice(0, 600), importance: state.strategicDossiers[dialogue.linkedDossierId].importance, actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' as const }, reason: 'Le dialogue associé actualise directement le dossier suivi.', visibility: 'player' as const }] : []),
      { kind: 'ai_job_patch', jobId, patch: { status: 'resolved', resolvedAt: state.currentDate, attempts: job.attempts + 1, outcome }, reason: 'La réponse diplomatique IA est conservée dans la tâche.', visibility: 'debug' },
    ],
  }) };
}
