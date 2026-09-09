import { enqueueAIJob } from './ai/orchestrator';
import { commitWorldAction } from './ledger';
import { relationBetween } from './ledger';
import type { DiplomaticDialogue, DiplomaticTurn, GeneralAIJob, CountryId, WorldState } from './types';
import type { AIJobOutcome } from '../ai/job-contracts';

const unique = <T,>(items: T[]) => [...new Set(items)];

function nextSpeaker(state: WorldState, dialogue: Pick<DiplomaticDialogue, 'participantIds' | 'activeSpeakerId' | 'initiatorId'>, exclude: CountryId[] = []) {
  const candidates = dialogue.participantIds.filter((id) => !exclude.includes(id) && id !== dialogue.activeSpeakerId && Boolean(state.countries[id]));
  return candidates.sort((a, b) => {
    const ar = relationBetween(state, dialogue.initiatorId, a)?.relation ?? 50;
    const br = relationBetween(state, dialogue.initiatorId, b)?.relation ?? 50;
    return ar - br || (state.countries[b]?.weight ?? 0) - (state.countries[a]?.weight ?? 0) || a.localeCompare(b);
  })[0] ?? dialogue.participantIds.find((id) => id !== dialogue.initiatorId) ?? dialogue.initiatorId;
}

function localReply(state: WorldState, speakerId: CountryId, message: string, participantIds: CountryId[]) {
  const country = state.countries[speakerId];
  const relation = relationBetween(state, state.playerCountryId, speakerId)?.relation ?? 50;
  const stance = relation >= 65 ? 'accueille favorablement' : relation <= 35 ? 'réagit avec réserve' : 'répond prudemment à';
  const focus = participantIds.length > 2 ? ' Les autres délégations sont invitées à préciser leurs lignes rouges.' : '';
  return `${country?.name ?? speakerId} ${stance} votre message : « ${message.slice(0, 220)} ».${focus}`;
}

function turn(id: string, date: `${number}-${number}-${number}`, speakerId: CountryId, kind: DiplomaticTurn['kind'], publicMessage: string): DiplomaticTurn {
  return { id, date, speakerId, kind, publicMessage };
}

/** Ouvre un canal bilatéral ou multilatéral. La première réponse est locale et gratuite. */
export function openDiplomaticDialogue(state: WorldState, participantIds: CountryId[], openingMessage: string) {
  const participants = unique([state.playerCountryId, ...participantIds]).filter((id) => Boolean(state.countries[id]));
  const counterparts = participants.filter((id) => id !== state.playerCountryId);
  if (!openingMessage.trim() || counterparts.length === 0) return { ok: false as const, state, error: 'Ajoutez au moins un pays et un message.' };
  const id = `dialogue-${state.sequence + 1}-${participants.join('-')}`;
  const speaker = nextSpeaker(state, { participantIds: participants, activeSpeakerId: state.playerCountryId, initiatorId: state.playerCountryId });
  const dialogue: DiplomaticDialogue = {
    id, kind: participants.length > 2 ? 'multilateral_dialogue' : 'bilateral_dialogue',
    initiatorId: state.playerCountryId, participantIds: participants, activeSpeakerId: speaker,
    status: 'awaiting_player', aiMode: 'local', openedAt: state.currentDate, updatedAt: state.currentDate,
    turns: [
      turn(`${id}-player-1`, state.currentDate, state.playerCountryId, 'message', openingMessage.trim()),
      turn(`${id}-${speaker}-1`, state.currentDate, speaker, 'message', localReply(state, speaker, openingMessage, participants)),
    ],
  };
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: counterparts, origin: 'player', visibility: 'player',
    intent: `Ouvrir un dialogue ${dialogue.kind === 'multilateral_dialogue' ? 'multilatéral' : 'bilatéral'}`,
    effects: [{ kind: 'diplomatic_dialogue_add', dialogue, reason: 'Le canal diplomatique conserve le premier message et la réponse locale gratuite.', visibility: 'player' }],
  }), dialogueId: id };
}

export function sendDiplomaticDialogueMessage(state: WorldState, dialogueId: string, message: string) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || dialogue.status !== 'awaiting_player' || !message.trim()) return { ok: false as const, state, error: 'Ce dialogue n’attend pas de message du joueur.' };
  const activeSpeaker = nextSpeaker(state, dialogue, [state.playerCountryId]);
  const next: DiplomaticDialogue = {
    ...dialogue, status: 'awaiting_ai', aiMode: 'local', activeSpeakerId: activeSpeaker, updatedAt: state.currentDate,
    turns: [...dialogue.turns, turn(`${dialogue.id}-player-${dialogue.turns.length + 1}`, state.currentDate, state.playerCountryId, 'message', message.trim())],
  };
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId), origin: 'player', visibility: 'player',
    intent: `Prendre la parole dans « ${dialogue.id} »`, effects: [{ kind: 'diplomatic_dialogue_patch', dialogueId, patch: next, reason: 'Le joueur relance le dialogue ; une réponse IA est désormais optionnelle et payante.', visibility: 'player' }],
  }), speakerId: activeSpeaker };
}

/** Crée une tâche IA seulement après l’accord explicite du joueur. */
export function requestDiplomaticDialogueAI(state: WorldState, dialogueId: string) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || dialogue.status !== 'awaiting_ai') return { ok: false as const, state, error: 'Aucune réponse IA n’est en attente pour ce dialogue.' };
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

export function applyDiplomaticDialogueAIAnswer(state: WorldState, jobId: string, outcome: AIJobOutcome) {
  const job = state.aiJobs[jobId];
  if (!job || job.kind !== 'diplomacy' || typeof job.context.dialogueId !== 'string') return { ok: false as const, state, error: 'Tâche de dialogue introuvable.' };
  const dialogue = state.diplomaticDialogues[job.context.dialogueId];
  if (!dialogue) return { ok: false as const, state, error: 'Dialogue introuvable.' };
  const speaker = dialogue.activeSpeakerId;
  const nextSpeakerId = nextSpeaker(state, dialogue, [state.playerCountryId, speaker]);
  const response = outcome.publicMessage.trim();
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue, status: 'awaiting_player', aiMode: 'ai', activeSpeakerId: nextSpeakerId, updatedAt: state.currentDate,
    turns: [...dialogue.turns, turn(`${dialogue.id}-${speaker}-${dialogue.turns.length + 1}`, state.currentDate, speaker, 'message', response || outcome.assessment.slice(0, 600))],
  };
  return { ok: true as const, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: speaker, targetIds: dialogue.participantIds.filter((id) => id !== speaker), origin: 'ai', visibility: 'player',
    intent: `Réponse diplomatique de ${speaker} dans « ${dialogue.id} »`, effects: [
      { kind: 'diplomatic_dialogue_patch', dialogueId: dialogue.id, patch: nextDialogue, reason: 'La réponse IA est ajoutée à la mémoire du canal diplomatique.', visibility: 'player' },
      { kind: 'ai_job_patch', jobId, patch: { status: 'resolved', resolvedAt: state.currentDate, attempts: job.attempts + 1, outcome }, reason: 'La réponse diplomatique IA est conservée dans la tâche.', visibility: 'debug' },
    ],
  }) };
}
