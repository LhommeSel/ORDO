import { commitWorldAction } from './ledger';
import type {
  DiplomaticAgreementDraft,
  DiplomaticAgreementDomain,
  DiplomaticBrief,
  DiplomaticDialogue,
  DiplomaticMeeting,
  DiplomaticMeetingMode,
  DiplomaticMeetingStatus,
  DiplomaticDialogueResponse,
  ISODate,
  WorldState,
} from './types';

const addMonths = (date: ISODate, months: number): ISODate => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
};

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const domainForAgreement = (agreementType: DiplomaticDialogueResponse['agreementType']): DiplomaticAgreementDomain => {
  switch (agreementType) {
    case 'energy_cooperation': return 'energy';
    case 'defense_cooperation': return 'defense';
    case 'industrial_cooperation': return 'industrial';
    case 'security_cooperation': return 'security';
    case 'political_guarantee':
    case 'mediation': return 'political';
    default: return 'general';
  }
};

const domainLabel: Record<DiplomaticAgreementDomain, string> = {
  energy: 'énergétique', defense: 'défense', industrial: 'industriel', security: 'sécurité', political: 'politique', general: 'coopération',
};

export type DiplomaticBriefInput = Omit<DiplomaticBrief, 'id' | 'dialogueId' | 'generatedAt'>;

/** Enregistre une synthèse déjà produite, qu'elle provienne du moteur ou de l'IA. */
export function saveDiplomaticBrief(state: WorldState, dialogueId: string, input: DiplomaticBriefInput) {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue) return { ok: false as const, state, error: 'Dialogue introuvable.' };
  const brief: DiplomaticBrief = {
    ...input,
    id: `diplomatic-brief-${dialogue.id}-${state.sequence + 1}`,
    dialogueId,
    generatedAt: state.currentDate,
    pointsOfAgreement: unique(input.pointsOfAgreement).slice(0, 6),
    openPoints: unique(input.openPoints).slice(0, 8),
    recommendedChanges: unique(input.recommendedChanges).slice(0, 6),
  };
  const nextDialogue: DiplomaticDialogue = { ...dialogue, briefIds: [...(dialogue.briefIds ?? []), brief.id], updatedAt: state.currentDate };
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId),
      origin: input.source === 'ai' ? 'ai' : 'player', visibility: 'player', intent: 'Enregistrer une synthèse diplomatique',
      effects: [
        { kind: 'diplomatic_brief_add', brief, reason: input.source === 'ai' ? 'La synthèse IA est conservée séparément du dialogue et du projet d’accord.' : 'La synthèse locale est conservée pour préparer une rencontre.', visibility: 'player' },
        { kind: 'diplomatic_dialogue_patch', dialogueId, patch: nextDialogue, reason: 'Le dialogue référence la synthèse sans devenir un contrat.', visibility: 'player' },
      ],
    }),
    brief,
  };
}

/** Produit une synthèse sans appel réseau, utile comme secours et pour les tests. */
export function diplomaticBriefFromDialogue(state: WorldState, dialogueId: string, source: DiplomaticBrief['source'] = 'local') {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || !dialogue.lastResponse) return { ok: false as const, state, error: 'Aucune position structurée à synthétiser.' };
  const response = dialogue.lastResponse;
  const counterpartNames = dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((id) => state.countries[id]?.name ?? id);
  const briefInput: DiplomaticBriefInput = {
    source,
    summary: `${counterpartNames.join(', ')} : ${response.position}`,
    pointsOfAgreement: unique([
      ...response.concessions.slice(0, 3),
      response.kind === 'accept' ? 'Un accord de principe est envisageable.' : 'Le canal reste ouvert à une négociation structurée.',
    ]).slice(0, 4),
    openPoints: unique([...response.conditions, ...response.guaranteesRequested]).slice(0, 6),
    recommendedChanges: unique([
      response.conditions[0] ? `Préciser : ${response.conditions[0]}` : '',
      response.guaranteesRequested[0] ? `Garantir : ${response.guaranteesRequested[0]}` : '',
      response.redLines[0] ? `Éviter : ${response.redLines[0]}` : '',
    ]).slice(0, 4),
    suggestedMeeting: response.conditions.length > 0 ? 'official' : 'technical',
  };
  return saveDiplomaticBrief(state, dialogueId, briefInput);
}

/** Prépare une rencontre ; elle reste réversible et ne signe rien. */
export function proposeDiplomaticMeeting(state: WorldState, dialogueId: string, mode: DiplomaticMeetingMode = 'official') {
  const dialogue = state.diplomaticDialogues?.[dialogueId];
  if (!dialogue || !dialogue.lastResponse) return { ok: false as const, state, error: 'Une position diplomatique est nécessaire avant de convoquer une rencontre.' };
  const existing = Object.values(state.diplomaticMeetings ?? {}).find((meeting) => meeting.dialogueId === dialogueId && ['proposed', 'scheduled'].includes(meeting.status));
  if (existing) return { ok: true as const, state, meetingId: existing.id, draftId: existing.draftId };
  const response = dialogue.lastResponse;
  const meetingId = `diplomatic-meeting-${dialogue.id}-${state.sequence + 1}`;
  const draftId = `diplomatic-agreement-draft-${dialogue.id}-${state.sequence + 1}`;
  const counterpartNames = dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((id) => state.countries[id]?.name ?? id);
  const domain = domainForAgreement(response.agreementType);
  const meeting: DiplomaticMeeting = {
    id: meetingId, dialogueId, participantIds: dialogue.participantIds, mode, status: 'scheduled', proposedAt: state.currentDate,
    scheduledAt: addMonths(state.currentDate, mode === 'discreet' ? 0 : 1),
    agenda: unique([
      'Valider les points d’accord déjà acquis.',
      ...response.conditions.slice(0, 2).map((item) => `Traiter : ${item}`),
      ...response.guaranteesRequested.slice(0, 2).map((item) => `Garantir : ${item}`),
    ]).slice(0, 5),
    draftId,
  };
  const draft: DiplomaticAgreementDraft = {
    id: draftId, dialogueId, meetingId, participantIds: dialogue.participantIds, domain, stage: 'final_proposal',
    title: `Projet d’accord ${domainLabel[domain]} · ${counterpartNames.join(' – ')}`,
    summary: `Projet issu de la rencontre ${mode === 'official' ? 'officielle' : mode === 'discreet' ? 'discrète' : 'technique'} : ${response.position}`,
    terms: {
      portée: domainLabel[domain],
      calendrier: response.timeline,
      participants: counterpartNames.join(', '),
      garanties: response.guaranteesRequested.slice(0, 3).join(' ; ') || 'À préciser',
    },
    unresolvedConditions: response.conditions.slice(0, 5),
    createdAt: state.currentDate,
    updatedAt: state.currentDate,
  };
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue,
    meetingIds: [...(dialogue.meetingIds ?? []), meetingId],
    agreementDraftIds: [...(dialogue.agreementDraftIds ?? []), draftId],
    updatedAt: state.currentDate,
  };
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId),
      origin: 'player', visibility: 'player', intent: `Convoquer une rencontre diplomatique ${mode}`,
      effects: [
        { kind: 'diplomatic_meeting_add', meeting, reason: 'La rencontre prolonge la négociation sans signer automatiquement un accord.', visibility: 'player' },
        { kind: 'diplomatic_agreement_draft_add', draft, reason: 'La rencontre produit un projet d’accord lisible et révisable.', visibility: 'player' },
        { kind: 'diplomatic_dialogue_patch', dialogueId, patch: nextDialogue, reason: 'Le dialogue conserve le lien vers la rencontre et son projet d’accord.', visibility: 'player' },
      ],
    }),
    meetingId,
    draftId,
  };
}

/** Modifie un projet sans appliquer encore d’effet au monde. */
export function reviseDiplomaticAgreementDraft(state: WorldState, draftId: string, patch: Partial<Pick<DiplomaticAgreementDraft, 'summary' | 'terms' | 'unresolvedConditions'>>) {
  const draft = state.diplomaticAgreementDrafts?.[draftId];
  if (!draft || draft.stage !== 'final_proposal') return { ok: false as const, state, error: 'Ce projet d’accord n’est plus révisable.' };
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'diplomatic', actorId: state.playerCountryId, targetIds: draft.participantIds.filter((id) => id !== state.playerCountryId),
      origin: 'player', visibility: 'player', intent: 'Réviser un projet d’accord diplomatique',
      effects: [{ kind: 'diplomatic_agreement_draft_patch', draftId, patch, reason: 'Le joueur ajuste le projet avant de le soumettre.', visibility: 'player' }],
    }),
  };
}

export const diplomaticMeetingStatusLabel: Record<DiplomaticMeetingStatus, string> = {
  proposed: 'Proposée', scheduled: 'Programmée', completed: 'Terminée', cancelled: 'Annulée',
};
