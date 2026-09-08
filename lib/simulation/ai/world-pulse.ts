import type {
  WorldPulseAnswer,
  WorldPulseContext,
  WorldPulseFact,
  WorldPulseKind,
  WorldPulseRequest,
  WorldPulseRequestItem,
  WorldPulseResponse,
} from '../../ai/world-pulse-contracts';
import { ORDO_WORLD_PULSE_SCHEMA_VERSION } from '../../ai/world-pulse-contracts';
import { commitWorldAction } from '../ledger';
import type { DossierImportance, DossierKind, StrategicDossier, WorldEffect, WorldState } from '../types';
import { collectFacts } from './context';

const importanceRank: Record<DossierImportance, number> = { minor: 0, moderate: 1, major: 2, critical: 3 };

const approximateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 3.6);

function pulseFacts(
  state: WorldState,
  kind: WorldPulseKind,
  recentPlayerActions: WorldPulseContext['recentPlayerActions'],
): { facts: WorldPulseFact[]; omittedFactCount: number; approximateInputTokens: number } {
  const targetIds = new Set(recentPlayerActions.flatMap((action) => [action.actorId, ...action.targetIds]));
  const activeDossierActors = new Set(Object.values(state.strategicDossiers)
    .filter((dossier) => dossier.status !== 'resolved')
    .flatMap((dossier) => dossier.actorIds));
  const all = collectFacts(state)
    // Le pouls n'obtient pas les secrets des gouvernements : ses sorties seront
    // affichées au joueur et doivent rester compatibles avec cette visibilité.
    .filter((fact) => fact.visibility === 'public')
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
        + (kind === 'world_autonomy' && fact.entityIds.some((id) => activeDossierActors.has(id)) ? 55 : 0)
        + (fact.id.startsWith('dossier:') || fact.id.startsWith('dossier-entry:') ? 60 : 0)
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
  const selection = pulseFacts(state, kind, recentPlayerActions);
  const visibleActorIds = new Set(selection.facts.flatMap((fact) => fact.entityIds));
  const rankedCountries = Object.values(state.countries).slice().sort((a, b) => b.weight - a.weight).map((country) => country.id);
  const guidedCountryIds = unique([
    state.playerCountryId,
    ...recentPlayerActions.flatMap((action) => [action.actorId, ...action.targetIds]),
    ...Object.values(state.strategicDossiers).filter((dossier) => dossier.status !== 'resolved').flatMap((dossier) => dossier.actorIds),
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
    ...selection,
  };
}

/**
 * Prépare un seul appel HTTP par avance, contenant deux missions LLM. Le
 * serveur en décompte une seule unité de quota de partie : c'est un tour, pas
 * deux interactions explicites du joueur.
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
  const reaction: WorldPulseRequestItem = {
    id: `${pulseId}-reaction`, kind: 'player_reaction',
    context: createContext(state, 'player_reaction', elapsedMonths, recentPlayerActions),
  };
  const autonomy: WorldPulseRequestItem = {
    id: `${pulseId}-autonomy`, kind: 'world_autonomy',
    context: createContext(state, 'world_autonomy', elapsedMonths, recentPlayerActions),
  };
  return {
    schemaVersion: ORDO_WORLD_PULSE_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    sessionId: sessionId.slice(0, 80),
    pulseId,
    pulses: [reaction, autonomy],
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

export type AppliedWorldPulse = {
  state: WorldState;
  createdDossierIds: string[];
  updatedDossierIds: string[];
  playerDecisions: number;
  relationChanges: number;
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

  answer.proposals.forEach((proposal, index) => {
    const actorIds = unique(proposal.actorIds).filter((id) => Boolean(state.countries[id]));
    const citedFacts = unique(proposal.factIds).filter((id) => knownFactIds.has(id));
    if (actorIds.length === 0 || citedFacts.length === 0
      || (proposal.dossierId !== null && !knownFactIds.has(`dossier:${proposal.dossierId}`))) return;
    const existing = proposal.dossierId ? state.strategicDossiers[proposal.dossierId] : undefined;
    const dossierId = existing ? existing.id : `${item.id}-dossier-${index + 1}`;
    const playerDecision = proposal.requiresPlayerDecision
      && actorIds.includes(state.playerCountryId)
      && importanceRank[proposal.importance] >= importanceRank.major
      && proposal.playerDecision ? proposal.playerDecision.trim() : undefined;
    const entry = {
      id: `${item.id}-entry-${index + 1}`,
      date: state.currentDate,
      title: proposal.title.trim(),
      summary: proposal.summary.trim(),
      importance: proposal.importance,
      actorIds,
      requiresDecision: Boolean(playerDecision),
      visibility: 'player' as const,
    };

    if (existing) {
      const nextImportance = importanceRank[proposal.importance] >= importanceRank[existing.importance]
        ? proposal.importance : existing.importance;
      const pendingDecisions = playerDecision
        ? unique([...existing.pendingDecisions, playerDecision]).slice(-6)
        : existing.pendingDecisions;
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
          },
          reason: `Pouls IA ${item.kind} : dossier mis à jour à partir de ${citedFacts.join(', ')}.`, visibility: 'player',
        },
        { kind: 'dossier_entry_add', dossierId, entry, reason: `Événement IA ancré dans ${citedFacts.join(', ')}.`, visibility: 'player' },
      );
      updatedDossierIds.push(dossierId);
    } else {
      const dossier: StrategicDossier = {
        id: dossierId, title: proposal.title.trim(), kind: proposal.kind as DossierKind,
        status: dossierStatusFor(proposal.trend), importance: proposal.importance,
        actorIds, regionTags: unique(proposal.regionTags.map((tag) => tag.trim()).filter(Boolean)).slice(0, 8),
        startedAt: state.currentDate, updatedAt: state.currentDate, phase: proposal.phase.trim(), trend: proposal.trend,
        publicSummary: proposal.summary.trim(), followed: false,
        autoTracked: importanceRank[proposal.importance] >= importanceRank.major,
        commitments: [], pendingDecisions: playerDecision ? [playerDecision] : [], relatedCurrentIds: [], relatedActionIds: [], entries: [entry],
      };
      effects.push({ kind: 'dossier_add', dossier, reason: `Pouls IA ${item.kind} : nouveau dossier fondé sur ${citedFacts.join(', ')}.`, visibility: 'player' });
      createdDossierIds.push(dossierId);
    }
    if (playerDecision) playerDecisions += 1;

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

  if (!effects.length) return { state, createdDossierIds, updatedDossierIds, playerDecisions, relationChanges };
  const next = commitWorldAction(state, {
    kind: 'historical', actorId: state.playerCountryId, origin: 'ai', visibility: 'player',
    intent: `Pouls mondial IA : ${answer.headline.trim()}`,
    assumptions: [`Mission ${item.kind}`, `Synthèse IA : ${answer.synthesis.trim()}`],
    metadata: { worldPulse: true, pulseItemId: item.id, citedFactCount: new Set(answer.proposals.flatMap((proposal) => proposal.factIds)).size },
    effects,
  });
  return { state: next, createdDossierIds, updatedDossierIds, playerDecisions, relationChanges };
}

export type WorldPulseExecutionResult = {
  state: WorldState;
  ok: boolean;
  createdDossierIds: string[];
  updatedDossierIds: string[];
  playerDecisions: number;
  relationChanges: number;
  errors: string[];
  response?: WorldPulseResponse;
};

/** Un échec IA ne bloque jamais le tour local déjà calculé. */
export async function executeWorldPulse(
  state: WorldState,
  request: WorldPulseRequest,
  fetcher: typeof fetch = fetch,
): Promise<WorldPulseExecutionResult> {
  let response: Response;
  try {
    response = await fetcher('/api/ai/world-pulse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    });
  } catch {
    return { state, ok: false, createdDossierIds: [], updatedDossierIds: [], playerDecisions: 0, relationChanges: 0, errors: ['Le pouls IA est momentanément inaccessible.'] };
  }
  let payload: WorldPulseResponse;
  try { payload = await response.json() as WorldPulseResponse; } catch {
    return { state, ok: false, createdDossierIds: [], updatedDossierIds: [], playerDecisions: 0, relationChanges: 0, errors: ['Le pouls IA a renvoyé une réponse illisible.'] };
  }
  if (!payload.ok) return { state, ok: false, createdDossierIds: [], updatedDossierIds: [], playerDecisions: 0, relationChanges: 0, errors: [payload.message], response: payload };
  let next = state;
  const createdDossierIds: string[] = [];
  const updatedDossierIds: string[] = [];
  const errors: string[] = [];
  let playerDecisions = 0;
  let relationChanges = 0;
  for (const item of request.pulses) {
    const result = payload.results.find((candidate) => candidate.id === item.id);
    if (!result) { errors.push(`La mission ${item.kind} n’a pas répondu.`); continue; }
    if (!result.ok) { errors.push(result.message); continue; }
    const applied = applyWorldPulseAnswer(next, item, result.answer);
    next = applied.state;
    createdDossierIds.push(...applied.createdDossierIds);
    updatedDossierIds.push(...applied.updatedDossierIds);
    playerDecisions += applied.playerDecisions;
    relationChanges += applied.relationChanges;
  }
  return {
    state: next, ok: errors.length === 0, createdDossierIds, updatedDossierIds, playerDecisions, relationChanges, errors, response: payload,
  };
}
