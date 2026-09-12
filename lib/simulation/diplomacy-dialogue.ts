import { enqueueAIJob } from './ai/orchestrator';
import { commitWorldAction } from './ledger';
import { relationBetween } from './ledger';
import { resolveDossierDecision } from './dossiers';
import { historicalAnchorChannelEffects } from './history';
import type { DiplomaticAgreementType, DiplomaticDialogue, DiplomaticDialogueResponse, DiplomaticTurn, GeneralAIJob, CountryId, WorldState, WorldEffect, AIJobOutcome, DossierEntry, StrategicDossier, TreatyImplementation } from './types';
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
    // Un dialogue libre peut mentionner un contrat ou un corridor énergétique.
    // On conserve alors la nature de coordination énergétique sans fabriquer
    // un volume physique : le contrat chiffré reste la responsabilité de la
    // session énergie dédiée.
    agreementType: 'energy_cooperation',
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

function dialogueDossier(
  state: WorldState,
  dialogue: DiplomaticDialogue,
  title: string,
  summary: string,
  entryTitle: string,
  entrySummary: string,
  commitments: string[] = [],
  options: { autoTracked?: boolean; phase?: string } = {},
): StrategicDossier {
  const entry: DossierEntry = {
    id: `dialogue-dossier-entry-${dialogue.id}-${state.sequence + 1}`, date: state.currentDate, title: entryTitle, summary: entrySummary,
    importance: 'moderate', actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player',
  };
  return {
    id: `diplomatic-dialogue-${dialogue.id}`, title, kind: 'cooperation', status: 'active', importance: 'moderate',
    actorIds: dialogue.participantIds, regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate,
    phase: options.phase ?? (title.startsWith('Procédure') ? 'Procédure d’accord' : 'Accord conclu'), trend: 'stable', publicSummary: summary,
    followed: true, autoTracked: options.autoTracked ?? true, commitments, pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [], entries: [entry],
  };
}

/**
 * Détermine le volet matériel d'un accord sans inventer de capacité.
 * Les références sont limitées aux registres déjà présents dans la sauvegarde;
 * l'accord ne devient donc jamais une production ou une livraison magique.
 */
function treatyImplementationFor(
  state: WorldState,
  dialogue: DiplomaticDialogue,
  agreementType: DiplomaticAgreementType,
  text: string,
  dossierId: string,
): TreatyImplementation | undefined {
  const parties = new Set(dialogue.participantIds);
  const energyRequested = /gaz|gas|pétrole|petrol|hydrocarb|énerg/i.test(text);
  const energyNodeIds = Object.values(state.energyNodes ?? {})
    .filter((node) => parties.has(node.countryId) && (!energyRequested || node.resource === 'gas'))
    .map((node) => node.id)
    .slice(0, 8);
  const sectorIds = Object.values(state.sectors ?? {})
    .filter((sector) => parties.has(sector.countryId))
    .filter((sector) => ['maritime_logistics', 'shipbuilding', 'telecoms', 'machine_tools', 'defense', 'semiconductors'].includes(sector.sector))
    .map((sector) => sector.id)
    .slice(0, 8);
  const armamentProductIds = Object.values(state.armamentProducts ?? {})
    .filter((product) => parties.has(product.countryId))
    .map((product) => product.id)
    .slice(0, 6);
  const militaryTheaterIds = Object.values(state.militaryTheaters ?? {})
    .filter((theater) => parties.has(theater.countryId) || theater.hostCountryIds.some((id) => parties.has(id)))
    .map((theater) => theater.id)
    .slice(0, 6);
  const assetIds = Object.values(state.territorial?.assets ?? {})
    .filter((asset) => ['port', 'lng_terminal', 'logistics', 'industrial', 'naval_base'].includes(asset.kind))
    .filter((asset) => parties.has(state.territorial.territories[asset.territoryId]?.sovereignCountryId ?? ''))
    .map((asset) => asset.id)
    .slice(0, 8);

  const common = {
    progressPct: 0,
    milestonePcts: [25, 50, 75, 100],
    completedMilestones: [],
    dossierId,
    sectorIds: [] as string[],
    energyNodeIds: [] as string[],
    armamentProductIds: [] as string[],
    militaryTheaterIds: [] as string[],
    assetIds,
  };
  switch (agreementType) {
    case 'energy_cooperation':
      return {
        ...common,
        kind: 'energy_framework', phase: 'exploration', monthlyProgressPct: 2.5,
        energyNodeIds, note: 'Cadre de coopération énergétique : les volumes et infrastructures doivent encore être confirmés dans le registre énergétique.',
      };
    case 'industrial_cooperation':
      return {
        ...common,
        kind: 'industrial_transfer', phase: 'pilot', monthlyProgressPct: 3,
        sectorIds, assetIds, note: 'Coopération industrielle : les filières liées progressent par étapes, sous réserve des capacités réellement disponibles.',
      };
    case 'security_cooperation':
      return {
        ...common,
        kind: 'maritime_security', phase: 'pilot', monthlyProgressPct: 4,
        militaryTheaterIds, note: 'Coopération de sécurité : la préparation des théâtres et bases liés progresse sans créer de troupes supplémentaires.',
      };
    case 'defense_cooperation':
      return {
        ...common,
        kind: 'defense_support', phase: 'pilot', monthlyProgressPct: 3,
        armamentProductIds, militaryTheaterIds, note: 'Coopération de défense : elle utilise les carnets et théâtres existants, sans dépasser leur capacité de production.',
      };
    case 'information_sharing':
      return {
        ...common,
        kind: 'information_channel', phase: 'exploration', monthlyProgressPct: 5,
        note: 'Canal d’information opérationnel : les échanges améliorent la connaissance, sans modifier les capacités physiques.',
      };
    default:
      return undefined;
  }
}

/**
 * Construit les effets d’un engagement diplomatique déjà formalisé.
 *
 * Cette fabrique est partagée par l’acceptation d’une proposition réellement
 * finale et par la signature ultérieure d’un projet issu d’une acceptation
 * conditionnelle. Le contrôle de validité reste dans les fonctions appelantes;
 * ici, on ne fait que produire les effets après leur validation.
 */
export function diplomaticCommitmentEffects(
  state: WorldState,
  dialogue: DiplomaticDialogue,
  response: DiplomaticDialogueResponse,
  treatyId: string,
  dossierId: string,
): WorldEffect[] {
  const durationByType: Record<DiplomaticAgreementType, number> = {
    industrial_cooperation: 36, energy_cooperation: 24, information_sharing: 24, security_cooperation: 24,
    political_guarantee: 18, mediation: 12, defense_cooperation: 36,
  };
  const monthlyByType: Record<DiplomaticAgreementType, Array<{ countryId: CountryId; metric: 'budget' | 'industry' | 'stability' | 'security'; delta: number }>> = {
    industrial_cooperation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'industry', delta: countryId === state.playerCountryId ? 0.05 : 0.035 })),
    // Un cadre de coopération ne crée pas de croissance ou de fiabilité
    // « magiques » : les effets matériels passent par les registres dédiés.
    energy_cooperation: [],
    information_sharing: [],
    security_cooperation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'security', delta: countryId === state.playerCountryId ? 0.05 : 0.035 })),
    political_guarantee: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'stability', delta: countryId === state.playerCountryId ? 0.035 : 0.025 })),
    mediation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'stability', delta: 0.02 })),
    defense_cooperation: dialogue.participantIds.map((countryId) => ({ countryId, metric: 'security', delta: countryId === state.playerCountryId ? 0.07 : 0.045 })),
  };
  const implementation = treatyImplementationFor(
    state,
    dialogue,
    response.agreementType,
    `${dialogue.turns.at(-1)?.publicMessage ?? ''} ${response.position}`,
    dossierId,
  );
  const effects: WorldEffect[] = [{
    kind: 'treaty_add',
    treaty: {
      id: treatyId,
      parties: dialogue.participantIds,
      label: `Engagement diplomatique · ${response.agreementType.replaceAll('_', ' ')}`,
      status: 'active',
      startDate: state.currentDate,
      endDate: addMonths(state.currentDate, durationByType[response.agreementType]),
      monthlyEffects: monthlyByType[response.agreementType],
      ...(implementation ? { implementation } : {}),
    },
    reason: 'La signature transforme la proposition diplomatique en engagement persistant.',
    visibility: 'player',
  }];
  if (response.agreementType === 'information_sharing') {
    effects.push(...dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((targetId) => ({
      kind: 'intelligence_delta' as const, observerId: state.playerCountryId, targetId, delta: 8,
      reason: 'Un accord d’échange d’informations améliore la connaissance de l’interlocuteur.', visibility: 'player' as const,
    })));
  }
  if (response.agreementType === 'energy_cooperation') {
    effects.push(...dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((targetId) => ({
      kind: 'capacity_commitment' as const, countryId: state.playerCountryId, domain: 'economy' as const, delta: 2,
      reason: `Le cadre énergétique avec ${state.countries[targetId]?.name ?? targetId} mobilise un suivi administratif dédié.`, visibility: 'player' as const,
    })));
  }
  return effects;
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
  // Après une réponse IA, activeSpeakerId désigne déjà l'interlocuteur que le
  // moteur a choisi pour le prochain tour. Le message du joueur doit donc lui
  // être adressé directement ; recalculer ici en l'excluant faisait sauter ce
  // participant et répétait parfois le précédent locuteur dans les groupes.
  const activeSpeaker = dialogue.activeSpeakerId !== state.playerCountryId
    && dialogue.participantIds.includes(dialogue.activeSpeakerId)
    && Boolean(state.countries[dialogue.activeSpeakerId])
    ? dialogue.activeSpeakerId
    : nextSpeaker(state, dialogue, [state.playerCountryId]);
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
 * ne devient un engagement actif que si l'interlocuteur a effectivement
 * formulé une proposition finale sans conditions, garanties ou lignes rouges
 * encore ouvertes. Dans les autres cas, l'acceptation est conservée comme une
 * intention conditionnelle à formaliser ; un refus ferme le canal et une
 * demande de révision relance explicitement un tour IA.
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
  const hasOpenTerms = response.conditions.length > 0 || response.guaranteesRequested.length > 0 || response.redLines.length > 0;
  const formalAgreement = decision === 'accept' && response.kind === 'accept' && !hasOpenTerms;
  const conditionalAcceptance = decision === 'accept' && (response.kind === 'accept' || response.kind === 'counter') && !formalAgreement;
  const labels = {
    accept: formalAgreement ? 'Position acceptée : un engagement diplomatique est inscrit.' : 'Position acceptée sous conditions : une formalisation reste nécessaire.',
    refuse: 'Position refusée : le canal diplomatique est fermé.',
    request_revision: 'Révision demandée : une nouvelle réponse de l’interlocuteur est attendue.',
    acknowledge: 'Position reçue : aucun engagement formel n’est créé.',
  } as const;
  const messages = {
    accept: formalAgreement ? 'Nous acceptons cette position et souhaitons l’inscrire comme engagement diplomatique.' : 'Nous acceptons cette position comme base de travail, sous réserve de formaliser les conditions et garanties restantes.',
    refuse: 'Nous refusons cette position dans sa forme actuelle et ne pouvons pas l’inscrire comme engagement.',
    request_revision: 'Nous demandons une révision de cette position, notamment sur les garanties et les conditions proposées.',
    acknowledge: 'Nous prenons acte de votre position. Aucun engagement formel n’est conclu à ce stade.',
  } as const;
  const nextStatus = decision === 'request_revision' ? 'awaiting_ai' as const : 'closed' as const;
  const nextDialogue: DiplomaticDialogue = {
    ...dialogue,
    status: nextStatus,
    updatedAt: state.currentDate,
    resolution: { status: decision === 'request_revision' ? 'revision_requested' : formalAgreement ? 'accepted' : conditionalAcceptance ? 'accepted_conditionally' : decision === 'refuse' ? 'refused' : 'acknowledged', decidedAt: state.currentDate, summary: labels[decision] },
    turns: [...dialogue.turns, turn(`${dialogue.id}-player-resolution-${dialogue.turns.length + 1}`, state.currentDate, state.playerCountryId, decision === 'accept' ? 'acceptance' : decision === 'refuse' ? 'refusal' : 'counterproposal', messages[decision])],
  };
  const effects: import('./types').WorldEffect[] = [
    { kind: 'diplomatic_dialogue_patch', dialogueId, patch: nextDialogue, reason: labels[decision], visibility: 'player' },
  ];
  const names = dialogue.participantIds.map((id) => state.countries[id]?.name ?? id).join(', ');
  const dossierId = `diplomatic-dialogue-${dialogue.id}`;
  if (formalAgreement) {
    const treatyId = `dialogue-commitment-${dialogue.id}-${state.sequence + 1}`;
    effects.push(...diplomaticCommitmentEffects(state, dialogue, response, treatyId, dossierId));
  }
  const isEnergyFramework = response.agreementType === 'energy_cooperation';
  const relationEffect = formalAgreement
    ? { relation: isEnergyFramework ? 1 : 4, trust: isEnergyFramework ? 0 : 3 }
    : conditionalAcceptance
      ? { relation: isEnergyFramework ? 1 : 2, trust: isEnergyFramework ? 0 : 1 }
      : decision === 'refuse' ? { relation: -3, trust: -2 } : null;
  if (relationEffect) effects.push(...dialogue.participantIds.filter((id) => id !== state.playerCountryId).map((targetId) => ({
    kind: 'relation_delta' as const, from: state.playerCountryId, to: targetId, relation: relationEffect.relation, trust: relationEffect.trust,
    reason: decision === 'accept' ? 'L’acceptation d’un engagement diplomatique renforce la relation.' : 'Le refus d’une position diplomatique dégrade la relation.', visibility: 'player' as const,
  })));
  const unresolvedStrategicPosition = decision === 'acknowledge'
    && ['energy_cooperation', 'defense_cooperation', 'security_cooperation', 'political_guarantee', 'mediation'].includes(response.agreementType)
    && (dialogue.participantIds.length > 2 || response.redLines.length >= 2 || response.conditions.length >= 2);
  if (!dialogue.linkedDossierId && (formalAgreement || conditionalAcceptance || decision === 'request_revision' || unresolvedStrategicPosition)) {
    const agreementLabel = response.agreementType.replaceAll('_', ' ');
    const dossier = formalAgreement
      ? dialogueDossier(state, dialogue, `Accord diplomatique · ${names}`, `Un accord de ${agreementLabel} est conclu avec ${names} et doit désormais être suivi dans le temps.`, 'Accord diplomatique conclu', response.position, [`Engagement diplomatique : ${response.position}`])
      : conditionalAcceptance
        ? dialogueDossier(state, dialogue, `Formalisation diplomatique · ${names}`, `La position de ${names} est acceptée comme base de travail, mais les conditions restantes empêchent encore tout engagement actif.`, 'Intention acceptée sous conditions', messages.accept, [`Intention à formaliser : ${response.position}`], { phase: 'Formalisation requise' })
      : decision === 'request_revision'
        ? dialogueDossier(state, dialogue, `Procédure d’accord · ${names}`, `Une procédure de négociation est ouverte avec ${names} ; les garanties et conditions restent à préciser.`, 'Procédure d’accord ouverte', messages.request_revision)
        : dialogueDossier(
          state,
          dialogue,
          `Négociation en suspens · ${names}`,
          `La position de ${names} est enregistrée, mais aucun engagement formel n’est conclu. Les lignes rouges et garanties doivent encore être arbitrées.`,
          'Position reçue sans accord formel',
          `${response.position}${response.redLines.length ? ` Lignes rouges : ${response.redLines.join(' ; ')}.` : ''}`,
          [],
          { autoTracked: false, phase: 'Négociation exploratoire en suspens' },
        );
    effects.push({ kind: 'dossier_add', dossier, reason: formalAgreement ? 'L’accord conclu devient un dossier de suivi.' : conditionalAcceptance ? 'L’acceptation conditionnelle ouvre une formalisation suivie sans activer encore l’accord.' : decision === 'request_revision' ? 'La demande de révision ouvre une procédure d’accord suivie.' : 'Une négociation stratégique non conclue devient un dossier modéré pour éviter qu’elle ne disparaisse du monde.', visibility: 'player' });
  }
  if (dialogue.linkedDossierId && state.strategicDossiers[dialogue.linkedDossierId]) {
    const dossier = state.strategicDossiers[dialogue.linkedDossierId];
    effects.push(
      { kind: 'dossier_patch', dossierId: dossier.id, patch: { commitments: formalAgreement ? [...dossier.commitments, `Engagement diplomatique : ${response.position}`] : conditionalAcceptance ? [...dossier.commitments, `Intention à formaliser : ${response.position}`] : dossier.commitments, playerStance: messages[decision] }, reason: 'La décision du joueur actualise les engagements du dossier.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId: dossier.id, entry: { id: `dialogue-resolution-${dialogue.id}-${state.sequence + 1}`, date: state.currentDate, title: labels[decision], summary: messages[decision], importance: dossier.importance, actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' }, reason: 'La résolution du dialogue est conservée dans la chronologie du dossier.', visibility: 'player' },
    );
    const historicalResolution = formalAgreement
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
  // Protection contre un double clic ou deux composants qui soumettraient la
  // même réponse avant que le premier job ne soit résolu. Sans ce garde-fou,
  // deux appels facturés pouvaient être créés pour un seul tour diplomatique.
  const alreadyPending = Object.values(state.aiJobs ?? {}).some((job) =>
    job.kind === 'diplomacy' && job.status === 'pending' && job.context.dialogueId === dialogueId);
  if (alreadyPending) return { ok: false as const, state, error: 'Une réponse IA est déjà en cours pour ce dialogue.' };
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
    // Le journal complet reste local dans le dialogue ; Luna ne reçoit que les
    // huit derniers tours, suffisants pour garder les lignes rouges sans payer
    // à nouveau toute l'histoire du canal à chaque réponse.
    context: { dialogueId: dialogue.id, respondingCountryId: dialogue.activeSpeakerId, participantIds: dialogue.participantIds, recentTurns: dialogue.turns.slice(-8), playerIntent: dialogue.turns.at(-1)?.publicMessage ?? '' },
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
  const normalizedMove = move ? normalizeDialogueMove(move, response) : null;
  const isEnergyFramework = normalizedMove?.scope === 'general_dialogue' && normalizedMove.agreementType === 'energy_cooperation';
  const relationEffect = normalizedMove?.kind === 'accept'
    ? { relation: isEnergyFramework ? 1 : 5, trust: isEnergyFramework ? 0 : 3 }
    : normalizedMove?.kind === 'refuse' ? { relation: -5, trust: -3 }
      : normalizedMove?.kind === 'counter' ? { relation: isEnergyFramework ? 1 : 2, trust: isEnergyFramework ? 0 : 1 }
        : null;
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
