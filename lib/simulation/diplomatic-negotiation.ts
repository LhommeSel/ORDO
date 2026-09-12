import { commitWorldAction } from './ledger';
import { diplomaticCommitmentEffects, normalizeDialogueMove } from './diplomacy-dialogue';
import { enqueueAIJob } from './ai/orchestrator';
import { historicalAnchorChannelEffects } from './history';
import type {
  AIJobOutcome,
  GeneralAIJob,
  DiplomaticAgreementDraft,
  DiplomaticAgreementDomain,
  DiplomaticBrief,
  DiplomaticDialogue,
  DiplomaticTurn,
  DiplomaticMeeting,
  DiplomaticMeetingMode,
  DiplomaticMeetingStatus,
  DiplomaticDialogueResponse,
  ISODate,
  WorldEffect,
  WorldState,
} from './types';
import type { AIDiplomaticMove } from '../ai/job-contracts';

const addMonths = (date: ISODate, months: number): ISODate => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
};

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

type MeetingDecision = NonNullable<DiplomaticAgreementDraft['counterpartDecision']>;

const meetingDecisionLabel: Record<MeetingDecision, string> = {
  pending: 'Réponse des participants en attente',
  accepted: 'Projet accepté par les participants',
  countered: 'Contre-proposition des participants',
  refused: 'Projet refusé par les participants',
};

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
      ...response.redLines.slice(0, 1).map((item) => `Préserver : ${item}`),
    ]).slice(0, 5),
    draftId, counterpartDecision: 'pending',
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
    unresolvedConditions: unique([
      ...response.conditions.map((item) => `Condition : ${item}`),
      ...response.guaranteesRequested.map((item) => `Garantie : ${item}`),
      ...response.redLines.map((item) => `Ligne rouge à préserver : ${item}`),
    ]).slice(0, 8),
    counterpartDecision: 'pending',
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

/**
 * Demande, après la date de rencontre, la position finale agrégée des
 * participants. L'appel reste explicite et ne signe jamais le projet.
 */
export function requestDiplomaticMeetingAI(state: WorldState, draftId: string) {
  const draft = state.diplomaticAgreementDrafts?.[draftId];
  if (!draft || draft.stage !== 'final_proposal') return { ok: false as const, state, error: 'Ce projet n’est pas disponible pour une réponse des participants.' };
  const meeting = state.diplomaticMeetings?.[draft.meetingId];
  if (!meeting || meeting.status !== 'scheduled') return { ok: false as const, state, error: 'La rencontre liée à ce projet n’est pas en attente de réponse.' };
  if (meeting.scheduledAt && meeting.scheduledAt > state.currentDate) return { ok: false as const, state, error: `La rencontre est prévue le ${meeting.scheduledAt}.` };
  const dialogue = state.diplomaticDialogues?.[draft.dialogueId];
  if (!dialogue) return { ok: false as const, state, error: 'Le dialogue lié à ce projet est introuvable.' };
  const alreadyPending = Object.values(state.aiJobs ?? {}).some((job) => job.kind === 'diplomacy' && job.status === 'pending' && job.context.meetingId === meeting.id);
  if (alreadyPending) return { ok: false as const, state, error: 'Une réponse des participants est déjà en cours.' };
  const counterparts = draft.participantIds.filter((id) => id !== state.playerCountryId && Boolean(state.countries[id]));
  if (!counterparts.length) return { ok: false as const, state, error: 'Aucun participant étranger ne peut répondre à ce projet.' };
  const names = counterparts.map((id) => state.countries[id]?.name ?? id).join(', ');
  const recentTurns = dialogue.turns.slice(-8).map((item) => ({ speakerId: item.speakerId, date: item.date, kind: item.kind, publicMessage: item.publicMessage }));
  const job: GeneralAIJob = {
    id: `diplomacy-meeting:${meeting.id}:${state.sequence + 1}`,
    kind: 'diplomacy', schemaVersion: 1, priority: 'normal', budgetTier: 'standard', status: 'pending', requestedAt: state.currentDate, attempts: 0,
    inputText: `Réponse finale des participants au projet « ${draft.title} »`,
    purpose: `Réponse finale de ${names} après la rencontre diplomatique`, actorId: state.playerCountryId,
    reasons: [
      'Vérifier l’acceptation réelle de chaque participant avant toute signature.',
      'Respecter les intérêts, lignes rouges et contraintes politiques exposés dans le dialogue.',
      'Formuler une contre-proposition concrète si le projet reste bloqué.',
    ],
    context: {
      meetingId: meeting.id, draftId: draft.id, dialogueId: dialogue.id, respondingCountryId: counterparts[0], participantIds: draft.participantIds,
      recentTurns, agenda: meeting.agenda, draft: { title: draft.title, summary: draft.summary, domain: draft.domain, terms: draft.terms, unresolvedConditions: draft.unresolvedConditions },
      playerIntent: `Obtenir la réponse agrégée de ${names} au projet final sans signer automatiquement.`,
    },
  };
  return { ok: true as const, state: enqueueAIJob(state, job), jobId: job.id, meetingId: meeting.id };
}

const meetingTurn = (dialogueId: string, speakerId: string, index: number, date: ISODate, message: string): DiplomaticTurn => ({
  id: `${dialogueId}-meeting-${index}`, date, speakerId, kind: 'message', publicMessage: message,
});

/** Applique une réponse structurée de réunion sans créer d’engagement implicite. */
export function applyDiplomaticMeetingAIAnswer(state: WorldState, jobId: string, outcome: AIJobOutcome, move?: AIDiplomaticMove | null) {
  const job = state.aiJobs[jobId];
  if (!job || job.kind !== 'diplomacy' || typeof job.context.meetingId !== 'string' || typeof job.context.draftId !== 'string' || typeof job.context.dialogueId !== 'string') return { ok: false as const, state, error: 'Tâche de rencontre diplomatique introuvable.' };
  const meeting = state.diplomaticMeetings?.[job.context.meetingId];
  const draft = state.diplomaticAgreementDrafts?.[job.context.draftId];
  const dialogue = state.diplomaticDialogues?.[job.context.dialogueId];
  if (!meeting || !draft || !dialogue || meeting.draftId !== draft.id || draft.dialogueId !== dialogue.id) return { ok: false as const, state, error: 'Les liens de la rencontre diplomatique sont incohérents.' };
  if (meeting.status !== 'scheduled' || draft.stage !== 'final_proposal') return { ok: false as const, state, error: 'Cette rencontre ne peut plus recevoir de réponse.' };
  const publicMessage = outcome.publicMessage.trim() || outcome.assessment.trim().slice(0, 800) || 'Les participants réservent leur position.';
  const normalized = move ? normalizeDialogueMove(move, publicMessage) : null;
  const kind = normalized?.kind;
  const decision: MeetingDecision = kind === 'accept' ? 'accepted' : kind === 'counter' ? 'countered' : kind === 'refuse' ? 'refused' : 'pending';
  const unresolved = normalized ? unique([
    ...normalized.conditions.map((item) => `Condition : ${item}`),
    ...normalized.guaranteesRequested.map((item) => `Garantie : ${item}`),
    ...normalized.redLines.map((item) => `Ligne rouge à préserver : ${item}`),
  ]).slice(0, 8) : draft.unresolvedConditions;
  const names = draft.participantIds.filter((id) => id !== state.playerCountryId).map((id) => state.countries[id]?.name ?? id).join(', ');
  const summary = kind === 'accept'
    ? `${names} accepte le projet présenté ; la signature reste une action explicite du joueur.`
    : kind === 'counter'
      ? `${names} formule une contre-proposition ; les points ouverts doivent être révisés avant toute signature.`
      : kind === 'refuse'
        ? `${names} refuse le projet final ; aucune mise en œuvre ne sera activée.`
        : `${names} demande des précisions complémentaires avant de se prononcer définitivement.`;
  const nextDraft: DiplomaticAgreementDraft = { ...draft, counterpartDecision: decision, unresolvedConditions: decision === 'accepted' ? [] : unresolved, stage: decision === 'refused' ? 'rejected' : 'final_proposal', summary: `${draft.summary} ${summary}`, updatedAt: state.currentDate };
  const nextMeeting: DiplomaticMeeting = { ...meeting, counterpartDecision: decision, status: decision === 'refused' ? 'completed' : 'scheduled', outcomeSummary: summary };
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue, updatedAt: state.currentDate,
    turns: [...dialogue.turns, meetingTurn(dialogue.id, draft.participantIds.find((id) => id !== state.playerCountryId) ?? dialogue.initiatorId, dialogue.turns.length + 1, state.currentDate, publicMessage)],
    lastResponse: normalized ? {
      kind: normalized.kind === 'request_clarification' || normalized.kind === 'message' ? 'counter' : normalized.kind,
      agreementType: normalized.agreementType, position: normalized.position, concessions: normalized.concessions,
      guaranteesRequested: normalized.guaranteesRequested, conditions: normalized.conditions, redLines: normalized.redLines, timeline: normalized.timeline,
    } : dialogue.lastResponse,
  };
  const counterpartTargets = draft.participantIds.filter((id) => id !== state.playerCountryId);
  const relationDelta = decision === 'accepted' ? { relation: 2, trust: 2 } : decision === 'countered' ? { relation: 1, trust: 0 } : decision === 'refused' ? { relation: -4, trust: -3 } : { relation: 0, trust: 0 };
  const effects: WorldEffect[] = [
    { kind: 'diplomatic_agreement_draft_patch', draftId: draft.id, patch: nextDraft, reason: `La réponse IA des participants est enregistrée : ${meetingDecisionLabel[decision]}.`, visibility: 'player' },
    { kind: 'diplomatic_meeting_patch', meetingId: meeting.id, patch: nextMeeting, reason: 'La rencontre conserve sa réponse sans signer automatiquement.', visibility: 'player' },
    { kind: 'diplomatic_dialogue_patch', dialogueId: dialogue.id, patch: nextDialogue, reason: 'La réponse de la rencontre rejoint la mémoire du dialogue diplomatique.', visibility: 'player' },
    ...(relationDelta.relation !== 0 || relationDelta.trust !== 0 ? counterpartTargets.map((targetId) => ({ kind: 'relation_delta' as const, from: targetId, to: state.playerCountryId, relation: relationDelta.relation, trust: relationDelta.trust, reason: `Réponse ${decision === 'accepted' ? 'favorable' : decision === 'countered' ? 'contre-proposée' : 'refusée'} au projet diplomatique.`, visibility: 'player' as const })) : []),
    { kind: 'ai_job_patch', jobId, patch: { status: 'resolved', resolvedAt: state.currentDate, attempts: job.attempts + 1, outcome }, reason: 'La réponse IA de la rencontre est conservée dans la tâche.', visibility: 'debug' },
  ];
  if (dialogue.linkedDossierId && state.strategicDossiers[dialogue.linkedDossierId]) effects.push({ kind: 'dossier_entry_add', dossierId: dialogue.linkedDossierId, entry: { id: `meeting-response-${meeting.id}-${state.sequence + 1}`, date: state.currentDate, title: `Réponse à la rencontre · ${decision}`, summary, importance: state.strategicDossiers[dialogue.linkedDossierId].importance, actorIds: draft.participantIds, requiresDecision: decision === 'countered' || decision === 'pending', visibility: 'player' }, reason: 'La réponse de la rencontre actualise le dossier sans effacer les conditions.', visibility: 'player' });
  return { ok: true as const, state: commitWorldAction(state, { kind: 'diplomatic', actorId: draft.participantIds.find((id) => id !== state.playerCountryId) ?? state.playerCountryId, targetIds: counterpartTargets, origin: 'ai', visibility: 'player', intent: `Réponse des participants à ${draft.title}`, effects }), decision };
}

/**
 * Signe un projet issu d’une acceptation conditionnelle.
 *
 * Le passage est volontairement distinct de l’acceptation initiale : le
 * projet doit être révisé, ne plus avoir de condition ouverte et attendre la
 * date de la rencontre. C’est seulement ici que les effets matériels et
 * historiques d’un accord sont appliqués.
 */
export function signDiplomaticAgreementDraft(state: WorldState, draftId: string) {
  const draft = state.diplomaticAgreementDrafts?.[draftId];
  if (!draft || draft.stage !== 'final_proposal') return { ok: false as const, state, error: 'Ce projet n’est pas disponible pour signature.' };
  if (draft.unresolvedConditions.length > 0) return { ok: false as const, state, error: 'Des conditions, garanties ou lignes rouges restent à régler avant la signature.' };
  if (draft.counterpartDecision !== 'accepted') return { ok: false as const, state, error: 'La réponse des participants est requise avant la signature du projet.' };
  const dialogue = state.diplomaticDialogues?.[draft.dialogueId];
  if (!dialogue || dialogue.resolution?.status !== 'accepted_conditionally') return { ok: false as const, state, error: 'Ce projet ne provient pas d’une acceptation conditionnelle active.' };
  const meeting = state.diplomaticMeetings?.[draft.meetingId];
  if (!meeting || meeting.status !== 'scheduled') return { ok: false as const, state, error: 'La rencontre liée à ce projet n’est pas programmée.' };
  if (meeting.counterpartDecision !== 'accepted') return { ok: false as const, state, error: 'La rencontre n’a pas encore reçu l’accord explicite des participants.' };
  if (meeting.scheduledAt && meeting.scheduledAt > state.currentDate) return { ok: false as const, state, error: `La rencontre est prévue le ${meeting.scheduledAt}.` };
  const response = dialogue.lastResponse;
  if (!response || (response.kind !== 'accept' && response.kind !== 'counter')) return { ok: false as const, state, error: 'La dernière position diplomatique ne peut pas être formalisée.' };

  const treatyId = `dialogue-commitment-${dialogue.id}-${state.sequence + 1}`;
  const dossierId = `diplomatic-dialogue-${dialogue.id}`;
  const treatyEffects = diplomaticCommitmentEffects(state, dialogue, response, treatyId, dossierId);
  const names = dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((id) => state.countries[id]?.name ?? id).join(', ');
  const signedDialogue: DiplomaticDialogue = {
    ...dialogue,
    updatedAt: state.currentDate,
    resolution: dialogue.resolution ? { ...dialogue.resolution, status: 'accepted', decidedAt: state.currentDate, summary: 'Projet diplomatique signé : l’engagement est désormais actif.' } : dialogue.resolution,
  };
  const effects: WorldEffect[] = [
    ...treatyEffects,
    { kind: 'diplomatic_agreement_draft_patch', draftId, patch: { stage: 'signed', unresolvedConditions: [], summary: `${draft.summary} Accord signé le ${state.currentDate}.` }, reason: 'La proposition finale est signée après règlement des points ouverts.', visibility: 'player' },
    { kind: 'diplomatic_meeting_patch', meetingId: meeting.id, patch: { status: 'completed', outcomeSummary: `Accord signé entre ${names}.` }, reason: 'La rencontre aboutit à une signature explicite.', visibility: 'player' },
    { kind: 'diplomatic_dialogue_patch', dialogueId: dialogue.id, patch: signedDialogue, reason: 'La signature clôt la formalisation du dialogue sans effacer son historique.', visibility: 'player' },
  ];
  const relation = response.agreementType === 'energy_cooperation' ? { relation: 1, trust: 0 } : { relation: 4, trust: 3 };
  effects.push(...dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((targetId) => ({
    kind: 'relation_delta' as const, from: state.playerCountryId, to: targetId, relation: relation.relation, trust: relation.trust,
    reason: 'La signature d’un engagement diplomatique consolide la relation.', visibility: 'player' as const,
  })));
  const dossier = state.strategicDossiers?.[dossierId];
  if (dossier) {
    effects.push(
      { kind: 'dossier_patch', dossierId, patch: { phase: 'Accord signé', trend: 'stable', publicSummary: `Un accord de ${domainLabel[draft.domain]} est désormais actif avec ${names}.`, commitments: [...dossier.commitments.filter((commitment) => !commitment.startsWith('Intention à formaliser')), `Engagement diplomatique : ${response.position}`], playerStance: 'Accord formalisé et suivi dans le temps.' }, reason: 'La signature fait passer le dossier de formalisation à un engagement actif.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId, entry: { id: `diplomatic-signature-${draft.id}`, date: state.currentDate, title: 'Accord diplomatique signé', summary: `La rencontre aboutit à un engagement actif avec ${names}.`, importance: dossier.importance, actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' }, reason: 'La signature est ajoutée à la chronologie du dossier.', visibility: 'player' },
    );
    if (dossier.relatedAnchorId) effects.push(...historicalAnchorChannelEffects(state, dossierId, { sourceId: draft.id, resolution: 'diplomatic_agreement' }));
  }
  return { ok: true as const, state: commitWorldAction(state, { kind: 'diplomatic', actorId: state.playerCountryId, targetIds: dialogue.participantIds.filter((id) => id !== state.playerCountryId), origin: 'player', visibility: 'player', intent: `Signer ${draft.title}`, effects }), treatyId };
}

export const diplomaticMeetingStatusLabel: Record<DiplomaticMeetingStatus, string> = {
  proposed: 'Proposée', scheduled: 'Programmée', completed: 'Terminée', cancelled: 'Annulée',
};
