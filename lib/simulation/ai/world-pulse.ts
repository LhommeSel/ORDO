import type {
  WorldPulseAnswer,
  WorldPulseContext,
  WorldPulseFact,
  WorldPulseKind,
  WorldPulseRequest,
  WorldPulseRequestItem,
  WorldPulseResponse,
} from '../../ai/world-pulse-contracts';
import { ETAT_NATION_WORLD_PULSE_SCHEMA_VERSION, normalizeWorldPulseDossierId } from '../../ai/world-pulse-contracts';
import { commitWorldAction } from '../ledger';
import { makeDossierDecision } from '../dossiers';
import type { DossierImportance, DossierKind, StrategicDossier, WorldEffect, WorldState } from '../types';
import { collectFacts } from './context';
import {
  activeMajorDossierCount,
  dossierImportanceValue,
  rankStrategicDossierReviews,
  rankWorldDossierReviews,
  type StrategicDossierReview,
} from './dossier-scheduler';
import { rankWorldAttention, type WorldAttentionTarget } from './world-attention';
import { queueAutonomousProgram, type AutonomousProgramInput } from './autonomous-programs';

const importanceRank: Record<DossierImportance, number> = { minor: 0, moderate: 1, major: 2, critical: 3 };
const MAX_ACTIVE_MAJOR_DOSSIERS = 12;

const approximateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 3.6);

function pulseFacts(
  state: WorldState,
  kind: WorldPulseKind,
  recentPlayerActions: WorldPulseContext['recentPlayerActions'],
  strategicDossierQueue: StrategicDossierReview[],
  worldDossierQueue: StrategicDossierReview[],
  autonomyFocus: WorldAttentionTarget[],
): { facts: WorldPulseFact[]; omittedFactCount: number; approximateInputTokens: number } {
  const targetIds = new Set(recentPlayerActions.flatMap((action) => [action.actorId, ...action.targetIds]));
  const scheduledReviews = [...strategicDossierQueue, ...worldDossierQueue];
  const scheduledDossierIds = new Set(scheduledReviews.map((review) => review.dossierId));
  const scheduledDossierActors = new Set(scheduledReviews.flatMap((review) => review.actorIds));
  const explorationActorIds = new Set(autonomyFocus.flatMap((focus) => focus.countryIds));
  const energyPattern = /\b(énergie|energet|pétrole|petrole|gaz|hydrocarbure|carburant|raffinerie|approvisionnement)\b/i;
  const recentEnergySignal = recentPlayerActions.some((action) => action.kind === 'energy' || energyPattern.test(action.intent));
  const scheduledEnergyDossier = scheduledReviews.some((review) => {
    const dossier = state.strategicDossiers[review.dossierId];
    return dossier ? energyPattern.test(`${dossier.title} ${dossier.publicSummary} ${dossier.entries.slice(-3).map((entry) => entry.summary).join(' ')}`) : false;
  });
  const playerEnergyFactRelevant = recentEnergySignal || scheduledEnergyDossier;
  const all = collectFacts(state)
    // Le pouls n'obtient pas les secrets des gouvernements : ses sorties seront
    // affichées au joueur et doivent rester compatibles avec cette visibilité.
    // Les faits internes appartenant au joueur sont toutefois nécessaires pour
    // conserver la continuité des dossiers et des rencontres qu'il a lui-même
    // ouverts. Ils ne révèlent aucune information privée d'un autre pays : les
    // faits internes étrangers restent volontairement hors du pouls mondial.
    .filter((fact) => fact.visibility === 'public'
      || (fact.visibility === 'internal' && fact.ownerCountryId === state.playerCountryId))
    // La dépendance pétrolière française ne doit pas devenir un sujet récurrent
    // par défaut. Elle revient dans le contexte uniquement lorsqu'une action ou
    // un dossier stratégique traite réellement d'énergie.
    .filter((fact) => !(fact.domain === 'energy' && fact.entityIds.includes(state.playerCountryId) && !playerEnergyFactRelevant))
    .map((fact) => ({
      id: fact.id,
      domain: fact.domain,
      entityIds: fact.entityIds,
      importance: fact.importance,
      statement: fact.statement,
      score: fact.importance
        + (fact.id === 'world:date' || fact.id === 'world:economy' ? 200 : 0)
        + (fact.entityIds.includes(state.playerCountryId) ? 75 : 0)
        + (fact.entityIds.some((id) => targetIds.has(id)) ? 140 : 0)
        + (kind === 'world_autonomy' && fact.entityIds.some((id) => scheduledDossierActors.has(id)) ? 42 : 0)
        + (kind === 'world_autonomy' && fact.entityIds.some((id) => explorationActorIds.has(id)) ? 74 : 0)
        + (kind === 'world_autonomy' && fact.id.startsWith('dossier:') && scheduledDossierIds.has(fact.id.slice('dossier:'.length)) ? 92 : 0)
        + (kind === 'world_autonomy' && fact.id.startsWith('dossier-entry:') && fact.entityIds.some((id) => scheduledDossierActors.has(id)) ? 28 : 0)
        + (fact.id.startsWith('history:') ? 35 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected: WorldPulseFact[] = [];
  const maximum = kind === 'player_reaction' ? 8_000 : 10_000;
  let used = 0;
  for (const item of all) {
    const fact: WorldPulseFact = {
      id: item.id, domain: item.domain, entityIds: item.entityIds, importance: item.importance, statement: item.statement,
    };
    const cost = approximateTokens(fact);
    if (used + cost > maximum || selected.length >= 96) continue;
    selected.push(fact);
    used += cost;
  }
  return { facts: selected, omittedFactCount: Math.max(0, all.length - selected.length), approximateInputTokens: used };
}

function createContext(
  state: WorldState,
  kind: WorldPulseKind,
  elapsedMonths: number,
  recentPlayerActions: WorldPulseContext['recentPlayerActions'],
): WorldPulseContext {
  const player = state.countries[state.playerCountryId];
  const autonomyFocus = kind === 'world_autonomy' ? rankWorldAttention(state, recentPlayerActions) : [];
  const strategicDossierQueue = kind === 'world_autonomy' ? rankStrategicDossierReviews(state) : [];
  const worldDossierQueue = kind === 'world_autonomy' ? rankWorldDossierReviews(state) : [];
  const selection = pulseFacts(state, kind, recentPlayerActions, strategicDossierQueue, worldDossierQueue, autonomyFocus);
  const visibleActorIds = new Set(selection.facts.flatMap((fact) => fact.entityIds));
  const rankedCountries = Object.values(state.countries).slice().sort((a, b) => b.weight - a.weight).map((country) => country.id);
  const guidedCountryIds = unique([
    state.playerCountryId,
    ...recentPlayerActions.flatMap((action) => [action.actorId, ...action.targetIds]),
    ...strategicDossierQueue.flatMap((review) => review.actorIds),
    ...worldDossierQueue.flatMap((review) => review.actorIds),
    ...autonomyFocus.flatMap((focus) => focus.countryIds),
    ...rankedCountries,
  ]).filter((id) => Boolean(state.countries[id]) && visibleActorIds.has(id)).slice(0, 16);
  const engineGuidance = guidedCountryIds.map((countryId) => {
    const country = state.countries[countryId];
    const leadership = state.leadership[countryId];
    const apparatus = state.politicalApparatus[countryId];
    return {
      countryId,
      strategicGoals: country.strategy.goals.filter((goal) => goal.status === 'active').sort((a, b) => b.priority - a.priority).slice(0, 5).map((goal) => goal.label.slice(0, 300)),
      vulnerabilities: country.strategy.vulnerabilities.slice(0, 5).map((item) => item.slice(0, 300)),
      redLines: country.strategy.redLines.slice(0, 5).map((item) => item.slice(0, 300)),
      doctrine: country.politics.doctrine,
      leadershipTraits: (leadership?.figures ?? []).slice(0, 3).map((figure) => `${figure.name}: risque ${figure.traits.riskAppetite}, fermeté ${figure.traits.belligerence}, flexibilité ${figure.traits.flexibility}, fiabilité ${figure.traits.reliability}`.slice(0, 120)),
      apparatusCurrents: (apparatus?.currents ?? []).slice(0, 6).map((current) => `${current.label} (poids ${current.weight}, implantation ${current.institutionalReach})`.slice(0, 180)),
    };
  });
  return {
    currentDate: state.currentDate,
    elapsedMonths: Number(Math.min(24, Math.max(0, elapsedMonths)).toFixed(3)),
    playerCountryId: state.playerCountryId,
    playerCountryName: player?.name ?? state.playerCountryId,
    recentPlayerActions,
    engineGuidance,
    strategicDossierQueue,
    worldDossierQueue,
    autonomyFocus,
    ...selection,
  };
}

/**
 * Prépare un seul appel HTTP par avance. La mission joueur est incluse
 * uniquement lorsqu’une action récente doit réellement être interprétée ;
 * l’autonomie mondiale reste toujours active.
 */
export function createWorldPulseRequest(
  state: WorldState,
  playerActionStartIndex: number,
  elapsedMonths: number,
  sessionId: string,
): WorldPulseRequest {
  const recentPlayerActions = state.actions
    .slice(playerActionStartIndex)
    .filter((action) => action.origin === 'player')
    .slice(-12)
    .map((action) => ({
      id: action.id,
      kind: action.kind,
      actorId: action.actorId,
      targetIds: action.targetIds ?? [],
      intent: action.intent.slice(0, 1_200),
      createdAt: action.createdAt,
    }));
  const pulseId = `pulse-${state.currentDate}-${crypto.randomUUID().slice(0, 8)}`;
  const autonomy: WorldPulseRequestItem = {
    id: `${pulseId}-autonomy`, kind: 'world_autonomy',
    context: createContext(state, 'world_autonomy', elapsedMonths, recentPlayerActions),
  };
  return {
    schemaVersion: ETAT_NATION_WORLD_PULSE_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    sessionId: sessionId.slice(0, 80),
    pulseId,
    pulses: [
      ...(recentPlayerActions.length ? [{
        id: `${pulseId}-reaction`, kind: 'player_reaction' as const,
        context: createContext(state, 'player_reaction', elapsedMonths, recentPlayerActions),
      }] : []),
      autonomy,
    ],
  };
}

const dossierStatusFor = (trend: 'escalating' | 'stable' | 'deescalating'): StrategicDossier['status'] =>
  trend === 'deescalating' ? 'deescalating' : trend === 'escalating' ? 'active' : 'emerging';

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function clampEffect(value: number) {
  return Math.max(-3, Math.min(3, Math.round(value)));
}

/** Une crise critique peut remplacer un dossier majeur au calme, jamais disparaître derrière une limite d'interface. */
function quietMajorToDemote(state: WorldState, scheduledDossierIds: Set<string>, alreadyDemoted: Set<string>) {
  return Object.values(state.strategicDossiers)
    .filter((dossier) => dossier.status !== 'resolved' && dossier.importance === 'major')
    .filter((dossier) => !dossier.followed && dossier.pendingDecisions.length === 0 && !alreadyDemoted.has(dossier.id))
    .sort((left, right) =>
      Number(scheduledDossierIds.has(left.id)) - Number(scheduledDossierIds.has(right.id))
      || left.updatedAt.localeCompare(right.updatedAt)
      || left.id.localeCompare(right.id),
    )[0];
}

export type AppliedWorldPulse = {
  state: WorldState;
  createdDossierIds: string[];
  updatedDossierIds: string[];
  playerDecisions: number;
  relationChanges: number;
  queuedAutonomousPrograms: number;
  manifestedAnchorIds: string[];
};

/**
 * Adaptateur métier obligatoire entre le LLM et la sauvegarde. Il ne laisse
 * passer que des événements cités, des pays existants et de petits déplacements
 * relationnels. Le LLM ne peut ni signer un traité ni modifier un PIB.
 */
export function applyWorldPulseAnswer(
  state: WorldState,
  item: Pick<WorldPulseRequestItem, 'id' | 'kind' | 'context'>,
  answer: WorldPulseAnswer,
): AppliedWorldPulse {
  const knownFactIds = new Set(item.context.facts.map((fact) => fact.id));
  const effects: WorldEffect[] = [];
  const createdDossierIds: string[] = [];
  const updatedDossierIds: string[] = [];
  let playerDecisions = 0;
  let relationChanges = 0;
  let queuedAutonomousPrograms = 0;
  const manifestedAnchorIds: string[] = [];
  const autonomousInputs: Array<{ input: AutonomousProgramInput; id: string }> = [];
  let projectedMajorCount = activeMajorDossierCount(state);
  const scheduledDossierIds = new Set([
    ...item.context.strategicDossierQueue,
    ...item.context.worldDossierQueue,
  ].map((review) => review.dossierId));
  const demotedDossierIds = new Set<string>();

  answer.proposals.forEach((proposal, index) => {
    const actorIds = unique(proposal.actorIds).filter((id) => Boolean(state.countries[id]));
    const citedFacts = unique(proposal.factIds).filter((id) => knownFactIds.has(id));
    let requestedDossierId = normalizeWorldPulseDossierId(proposal.dossierId);
    const requestedAnchorId = proposal.historicalAnchorId?.trim() || null;
    if (actorIds.length === 0 || citedFacts.length === 0
      || (requestedDossierId !== null && !knownFactIds.has(`dossier:${requestedDossierId}`))) return;
    const historicalAnchor = requestedAnchorId ? state.historicalAnchors?.[requestedAnchorId] : undefined;
    // Une veille historique proposée renseigne le monde, mais elle n'est pas
    // encore un fait. Le modèle ne peut ni la transformer en crise, ni créer
    // un dossier parallèle en citant son identifiant avant son seuil actif.
    if (historicalAnchor
      && citedFacts.includes(`history-anchor:${requestedAnchorId}`)
      && historicalAnchor.status !== 'active') return;
    const validHistoricalAnchor = Boolean(historicalAnchor
      && citedFacts.includes(`history-anchor:${requestedAnchorId}`)
      && actorIds.some((id) => historicalAnchor.affectedActors.includes(id))
      && historicalAnchor.status === 'active');
    // Un ancrage historique déjà proposé possède son propre dossier. L’IA ne
    // peut pas contourner cette continuité en créant un second dossier au
    // moment de la manifestation.
    if (validHistoricalAnchor && historicalAnchor) {
      const linkedDossierId = historicalAnchor.dossierId ?? `historical-${historicalAnchor.id}`;
      if (state.strategicDossiers[linkedDossierId]) {
        if (requestedDossierId !== null && requestedDossierId !== linkedDossierId) return;
        requestedDossierId = linkedDossierId;
      }
    }
    const existing = requestedDossierId ? state.strategicDossiers[requestedDossierId] : undefined;
    // Une mise à jour déclarée ne doit jamais devenir un nouveau dossier si le
    // monde a changé depuis la compilation du contexte IA.
    if (requestedDossierId !== null && !existing) return;
    const dossierId = existing ? existing.id : `${item.id}-dossier-${index + 1}`;
    const requestedParentDossierId = proposal.parentDossierId
      ? normalizeWorldPulseDossierId(proposal.parentDossierId)
      : null;
    const parentDossierId = requestedParentDossierId && requestedParentDossierId !== dossierId
      && state.strategicDossiers[requestedParentDossierId] ? requestedParentDossierId : undefined;
    const wakesSleeping = Boolean(existing?.sleepingAt);
    const currentImportance = existing?.importance;
    const raisesMajorCount = importanceRank[proposal.importance] >= importanceRank.major
      && (!currentImportance || importanceRank[currentImportance] < importanceRank.major);
    let effectiveImportance: DossierImportance = proposal.importance;
    if (raisesMajorCount && projectedMajorCount >= MAX_ACTIVE_MAJOR_DOSSIERS) {
      if (proposal.importance === 'critical') {
        const displaced = quietMajorToDemote(state, scheduledDossierIds, demotedDossierIds);
        if (displaced) {
          effects.push({
            kind: 'dossier_patch', dossierId: displaced.id,
            patch: { importance: 'moderate', autoTracked: false },
            reason: `La crise critique « ${proposal.title.trim()} » remplace un dossier majeur sans signal neuf dans la file prioritaire.`,
            visibility: 'player',
          });
          demotedDossierIds.add(displaced.id);
          projectedMajorCount -= 1;
        }
      } else {
        // La file majeure reste rare : le sujet demeure un dossier modéré
        // consultable au lieu d'encombrer durablement les alertes.
        effectiveImportance = 'moderate';
      }
    }
    if (importanceRank[effectiveImportance] >= importanceRank.major && raisesMajorCount) projectedMajorCount += 1;
    const playerDecision = proposal.requiresPlayerDecision
      && actorIds.includes(state.playerCountryId)
      && importanceRank[effectiveImportance] >= importanceRank.major
      && proposal.playerDecision ? proposal.playerDecision.trim() : undefined;
    const decisionRecord = playerDecision ? makeDossierDecision({
      id: `${item.id}-decision-${index + 1}`,
      prompt: playerDecision,
      createdAt: state.currentDate,
      importance: effectiveImportance,
      actorIds,
      sourceKind: 'world_pulse',
      sourceId: item.id,
      sourceLabel: proposal.title.trim(),
    }) : undefined;
    const entry = {
      id: `${item.id}-entry-${index + 1}`,
      date: state.currentDate,
      title: proposal.title.trim(),
      summary: proposal.summary.trim(),
      importance: effectiveImportance,
      actorIds,
      requiresDecision: Boolean(playerDecision),
      visibility: 'player' as const,
    };

    if (existing) {
      const nextImportance = dossierImportanceValue(effectiveImportance) >= dossierImportanceValue(existing.importance)
        ? effectiveImportance : existing.importance;
      const pendingDecisions = playerDecision
        ? unique([...existing.pendingDecisions, playerDecision]).slice(-6)
        : existing.pendingDecisions;
      const decisionRecords = decisionRecord
        ? [...(existing.decisionRecords ?? []).filter((record) => record.prompt !== playerDecision), decisionRecord]
        : existing.decisionRecords;
      effects.push(
        {
          kind: 'dossier_patch', dossierId,
          patch: {
            actorIds: unique([...existing.actorIds, ...actorIds]),
            regionTags: unique([...existing.regionTags, ...proposal.regionTags.map((tag) => tag.trim())]).slice(0, 8),
            importance: nextImportance,
            status: proposal.trend === 'deescalating' ? 'deescalating' : existing.status === 'resolved' ? 'resolved' : 'active',
            phase: proposal.phase.trim(), trend: proposal.trend, publicSummary: proposal.summary.trim(),
            pendingDecisions,
            ...(wakesSleeping ? { reactivatedAt: state.currentDate, status: 'active' as const } : {}),
            ...(decisionRecords ? { decisionRecords } : {}),
            ...(parentDossierId ? { parentDossierId } : {}),
            ...(item.kind === 'world_autonomy' ? {
              lastAutonomousReviewAt: state.currentDate,
              // L'action de pouls va être ajoutée juste après l'état courant.
              lastAutonomousReviewActionCount: state.actions.length + 1,
            } : {}),
          },
          ...(wakesSleeping ? { clear: ['sleepingAt'] } : {}),
          reason: `Pouls IA ${item.kind} : dossier mis à jour à partir de ${citedFacts.join(', ')}.`, visibility: 'player',
        },
        { kind: 'dossier_entry_add', dossierId, entry, reason: `Événement IA ancré dans ${citedFacts.join(', ')}.`, visibility: 'player' },
      );
      updatedDossierIds.push(dossierId);
    } else {
      const dossier: StrategicDossier = {
        id: dossierId, title: proposal.title.trim(), kind: proposal.kind as DossierKind,
        status: dossierStatusFor(proposal.trend), importance: effectiveImportance,
        actorIds, regionTags: unique(proposal.regionTags.map((tag) => tag.trim()).filter(Boolean)).slice(0, 8),
        startedAt: state.currentDate, updatedAt: state.currentDate, phase: proposal.phase.trim(), trend: proposal.trend,
        publicSummary: proposal.summary.trim(), followed: false,
        autoTracked: importanceRank[effectiveImportance] >= importanceRank.major,
        ...(parentDossierId ? { parentDossierId } : {}),
        ...(item.kind === 'world_autonomy' ? {
          lastAutonomousReviewAt: state.currentDate,
          lastAutonomousReviewActionCount: state.actions.length + 1,
        } : {}),
        commitments: [], pendingDecisions: playerDecision ? [playerDecision] : [], decisionRecords: decisionRecord ? [decisionRecord] : [], relatedCurrentIds: [], relatedActionIds: [], entries: [entry],
      };
      effects.push({ kind: 'dossier_add', dossier, reason: `Pouls IA ${item.kind} : nouveau dossier fondé sur ${citedFacts.join(', ')}.`, visibility: 'player' });
      createdDossierIds.push(dossierId);
    }
    if (playerDecision) playerDecisions += 1;

    if (validHistoricalAnchor && historicalAnchor) {
      effects.push({
        kind: 'historical_anchor_patch', anchorId: historicalAnchor.id,
        patch: {
          status: 'manifested', manifestedAt: state.currentDate,
          manifestation: proposal.title.trim(), dossierId,
        },
        reason: `L’IA propose une manifestation concrète de l’ancrage historique « ${historicalAnchor.trendTitle} ».`,
        visibility: 'player',
      });
      manifestedAnchorIds.push(historicalAnchor.id);
    }

    if (item.kind === 'world_autonomy' && proposal.autonomousAction) {
      const autonomous = proposal.autonomousAction;
      // Une action diplomatique ou de défense doit viser un autre acteur :
      // l'ancienne validation laissait passer « MMR → MMR », ce qui créait
      // des programmes autonomes absurdes dans les dossiers de dette.
      const requiresExternalTarget = autonomous.category === 'diplomacy'
        || autonomous.category === 'defense'
        || autonomous.operation === 'contact'
        || autonomous.operation === 'cooperation'
        || autonomous.operation === 'defense_pact'
        || autonomous.operation === 'mediation'
        || autonomous.operation === 'information_sharing';
      const validTargets = autonomous.targetIds.every((id) => actorIds.includes(id) && id !== autonomous.actorId)
        && (!requiresExternalTarget || autonomous.targetIds.length > 0);
      if (autonomous.actorId === actorIds[0] && autonomous.actorId !== state.playerCountryId && validTargets) {
        autonomousInputs.push({
          id: `${item.id}-program-${index + 1}`,
          input: {
            actorId: autonomous.actorId,
            targetIds: autonomous.targetIds,
            ...(requestedDossierId ? { linkedDossierId: requestedDossierId } : {}),
            category: autonomous.category,
            objective: autonomous.objective,
            ...(autonomous.operation ? { operation: autonomous.operation } : {}),
          },
        });
      }
    }

    for (const change of proposal.relationEffects) {
      if (!actorIds.includes(change.from) || !actorIds.includes(change.to)
        || change.from === change.to || !state.countries[change.from] || !state.countries[change.to]) continue;
      const relation = clampEffect(change.relation);
      const trust = clampEffect(change.trust);
      if (relation === 0 && trust === 0) continue;
      effects.push({
        kind: 'relation_delta', from: change.from, to: change.to, relation, trust,
        reason: `${change.reason.trim()} [${citedFacts.slice(0, 2).join(', ')}]`, visibility: 'player',
      });
      relationChanges += 1;
    }
  });

  let next = effects.length ? commitWorldAction(state, {
    kind: 'historical', actorId: state.playerCountryId, origin: 'ai', visibility: 'player',
    intent: `Pouls mondial IA : ${answer.headline.trim()}`,
    assumptions: [`Mission ${item.kind}`, `Synthèse IA : ${answer.synthesis.trim()}`],
    metadata: { worldPulse: true, pulseItemId: item.id, citedFactCount: new Set(answer.proposals.flatMap((proposal) => proposal.factIds)).size },
    effects,
  }) : state;
  for (const { input, id } of autonomousInputs) {
    const queued = queueAutonomousProgram(next, input, id);
    if (!queued) continue;
    next = queued.state;
    queuedAutonomousPrograms += 1;
  }
  return { state: next, createdDossierIds, updatedDossierIds, playerDecisions, relationChanges, queuedAutonomousPrograms, manifestedAnchorIds };
}

export type WorldPulseExecutionResult = {
  state: WorldState;
  ok: boolean;
  createdDossierIds: string[];
  updatedDossierIds: string[];
  playerDecisions: number;
  relationChanges: number;
  queuedAutonomousPrograms: number;
  manifestedAnchorIds: string[];
  errors: string[];
  response?: WorldPulseResponse;
};

function failedPulse(
  state: WorldState,
  message: string,
  response?: WorldPulseResponse,
): WorldPulseExecutionResult {
  return {
    state, ok: false,
    createdDossierIds: [],
    updatedDossierIds: [],
    playerDecisions: 0,
    relationChanges: 0,
    queuedAutonomousPrograms: 0,
    manifestedAnchorIds: [],
    errors: [message], response,
  };
}

/** Le pouls est atomique : toute mission manquante ou rejetée invalide le lot.
 * Le monde transmis reste alors strictement inchangé afin qu'aucune narration
 * locale ne remplace silencieusement l'IA. */
export async function executeWorldPulse(
  state: WorldState,
  request: WorldPulseRequest,
  fetcher: typeof fetch = fetch,
  latestState?: () => WorldState,
): Promise<WorldPulseExecutionResult> {
  // Le réseau peut répondre plusieurs secondes après le calcul local du tour.
  // L'interface fournit alors son état le plus récent afin que le pouls ne
  // réécrase pas une action effectuée pendant l'attente.
  const stateAtApplication = () => latestState?.() ?? state;
  let response: Response;
  try {
    response = await fetcher('/api/ai/world-pulse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    });
  } catch {
    return failedPulse(stateAtApplication(), 'Le pouls IA est momentanément inaccessible.');
  }
  let payload: WorldPulseResponse;
  try { payload = await response.json() as WorldPulseResponse; } catch {
    return failedPulse(stateAtApplication(), 'Le pouls IA a renvoyé une réponse illisible.');
  }
  if (!payload || typeof payload !== 'object' || typeof (payload as { ok?: unknown }).ok !== 'boolean') {
    return failedPulse(stateAtApplication(), 'Le pouls IA a renvoyé un format inattendu.');
  }
  if (!payload.ok) return failedPulse(stateAtApplication(), payload.message, payload);
  for (const item of request.pulses) {
    const result = payload.results.find((candidate) => candidate.id === item.id);
    if (!result) return failedPulse(stateAtApplication(), `La mission ${item.kind} n’a pas répondu.`, payload);
    if (!result.ok) return failedPulse(stateAtApplication(), `${item.kind} : ${result.message}`, payload);
  }
  let next = stateAtApplication();
  const createdDossierIds: string[] = [];
  const updatedDossierIds: string[] = [];
  let playerDecisions = 0;
  let relationChanges = 0;
  let queuedAutonomousPrograms = 0;
  const manifestedAnchorIds: string[] = [];
  for (const item of request.pulses) {
    const result = payload.results.find((candidate) => candidate.id === item.id);
    if (!result || !result.ok) continue;
    const applied = applyWorldPulseAnswer(next, item, result.answer);
    next = applied.state;
    createdDossierIds.push(...applied.createdDossierIds);
    updatedDossierIds.push(...applied.updatedDossierIds);
    playerDecisions += applied.playerDecisions;
    relationChanges += applied.relationChanges;
    queuedAutonomousPrograms += applied.queuedAutonomousPrograms;
    manifestedAnchorIds.push(...applied.manifestedAnchorIds);
  }
  return {
    state: next, ok: true, createdDossierIds, updatedDossierIds, playerDecisions, relationChanges, queuedAutonomousPrograms, manifestedAnchorIds, errors: [], response: payload,
  };
}
