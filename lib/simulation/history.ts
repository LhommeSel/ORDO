import { commitWorldAction } from './ledger';
import { makeDossierDecision } from './dossier-decisions';
import { pickSeeded } from './random';
import type {
  ActionDraft, ActionProgram, DossierImportance, HistoricalAnchor, HistoricalInterventionDirection, ISODate, StrategicDossier, WorldEffect, WorldState,
} from './types';

export type HistoricalManifestation = {
  currentId: string;
  processId: string;
  title: string;
  outcome: string;
  date: ISODate;
  confidence: number;
};

export type HistoricalAnchorCandidate = {
  anchorId: string;
  dossierId: string;
  title: string;
  trendTitle: string;
  phase: 'signal' | 'active' | 'window_closing';
  pressure: number;
  importance: DossierImportance;
  possibleManifestations: string[];
  invariants: string[];
};

const inWindow = (date: ISODate, start: ISODate, end: ISODate) => date >= start && date <= end;

function dateProgress(date: ISODate, start: ISODate, end: ISODate) {
  const startTime = new Date(`${start}T12:00:00Z`).getTime();
  const endTime = new Date(`${end}T12:00:00Z`).getTime();
  const currentTime = new Date(`${date}T12:00:00Z`).getTime();
  if (endTime <= startTime) return 1;
  return Math.max(0, Math.min(1, (currentTime - startTime) / (endTime - startTime)));
}

function monthsBetween(start: ISODate, end: ISODate) {
  const [startYear, startMonth] = start.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth);
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const interventionLabels: Record<HistoricalInterventionDirection, string> = {
  contain: 'réduction de la pression',
  redirect: 'redirection de la trajectoire',
  accelerate: 'accélération de la trajectoire',
};

function interventionMagnitude(anchor: HistoricalAnchor, outcome: ActionProgram['status'], contributionScale = 1) {
  const base = { none: 0, low: 3, medium: 5, high: 8 }[anchor.playerInfluence];
  const outcomeFactor = outcome === 'succeeded' ? 1 : outcome === 'partially_succeeded' ? 0.45 : -0.25;
  return Number((base * outcomeFactor * contributionScale).toFixed(2));
}

/**
 * Les actions ne réécrivent jamais librement l'histoire. Elles ne peuvent
 * influencer un ancrage que si elles sont rattachées à son dossier, et leur
 * poids dépend à la fois de l'influence plausible du joueur et de l'issue du
 * programme. Plusieurs réussites cohérentes sont nécessaires pour installer
 * une bifurcation durable.
 */
export function historicalAnchorResolutionEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'id' | 'title' | 'linkedDossierId' | 'historicalIntent' | 'historicalContributionScale' | 'status'>,
  outcome: Extract<ActionProgram['status'], 'succeeded' | 'partially_succeeded' | 'failed'>,
): WorldEffect[] {
  const dossier = program.linkedDossierId ? state.strategicDossiers[program.linkedDossierId] : undefined;
  const anchorId = dossier?.relatedAnchorId;
  const anchor = anchorId ? state.historicalAnchors[anchorId] : undefined;
  if (!dossier || !anchor || ['manifested', 'disrupted', 'expired'].includes(anchor.status)) return [];

  const direction = program.historicalIntent ?? 'contain';
  const magnitude = interventionMagnitude(anchor, outcome, program.historicalContributionScale ?? 1);
  if (magnitude === 0) return [];
  const directionFactor = direction === 'redirect' ? 0.75 : 1;
  const pressureDelta = Number(((direction === 'accelerate' ? 1 : -1) * magnitude * directionFactor).toFixed(2));
  const nextPressure = Number(clamp(anchor.pressure + pressureDelta).toFixed(2));
  const nextBalance = Number(clamp((anchor.interventionBalance ?? 0) + pressureDelta, -100, 100).toFixed(2));
  const divergenceThreshold = Math.max(8, Math.round(anchor.historicalWeight / 7));
  const successful = outcome !== 'failed';
  const contained = direction === 'contain' && successful && nextBalance <= -divergenceThreshold;
  const redirected = direction === 'redirect' && successful && nextBalance <= -(divergenceThreshold * 0.75);
  const accelerated = direction === 'accelerate' && successful && nextBalance >= divergenceThreshold * 0.75;
  const divergence = contained
    ? { kind: 'contained' as const, date: state.currentDate, programId: program.id, summary: 'Les interventions cumulées ont rendu la manifestation historique initialement attendue insuffisamment probable.' }
    : redirected
      ? { kind: 'redirected' as const, date: state.currentDate, programId: program.id, summary: 'Les interventions cumulées orientent le dossier vers une manifestation différente, sans effacer les tensions de fond.' }
      : accelerated
        ? { kind: 'accelerated' as const, date: state.currentDate, programId: program.id, summary: 'Les interventions cumulées augmentent la probabilité d’une manifestation plus rapide ou plus dure.' }
        : anchor.divergence;
  const nextStatus: HistoricalAnchor['status'] = contained
    ? 'disrupted'
    : direction === 'accelerate' && nextPressure >= anchor.activationThreshold
      ? 'active'
      : anchor.status;
  const outcomeLabel = outcome === 'succeeded' ? 'achevé' : outcome === 'partially_succeeded' ? 'partiellement achevé' : 'insuffisant';
  const summary = `Le programme « ${program.title} » est ${outcomeLabel}. Pression ${anchor.pressure.toFixed(0)} → ${nextPressure.toFixed(0)}/100 ; bilan cumulé ${nextBalance.toFixed(1)}. ${divergence?.summary ?? 'La tendance de fond demeure ouverte.'}`;
  const phase = contained
    ? 'Divergence historique consolidée'
    : redirected
      ? 'Trajectoire historique redirigée'
      : accelerated
        ? 'Trajectoire historique accélérée'
        : `Influence en cours : ${interventionLabels[direction]}`;

  return [
    {
      kind: 'historical_anchor_patch', anchorId: anchor.id,
      patch: {
        pressure: nextPressure,
        status: nextStatus,
        interventionBalance: nextBalance,
        lastIntervention: { programId: program.id, date: state.currentDate, direction, outcome, pressureDelta, summary },
        ...(divergence ? { divergence } : {}),
      },
      reason: `Le programme lié au dossier exerce une ${interventionLabels[direction]} sur l’ancrage historique.`, visibility: 'player',
    },
    {
      kind: 'dossier_patch', dossierId: dossier.id,
      patch: {
        relatedActionIds: [...new Set([...dossier.relatedActionIds, program.id])].slice(-12),
        phase,
        trend: pressureDelta > 0 ? 'escalating' : 'deescalating',
        ...(contained ? { status: 'resolved' as const, autoTracked: false, publicSummary: `${anchor.trendSummary} La trajectoire historique initiale est désormais considérée comme déviée.` } : {}),
      },
      reason: 'La conséquence historique du programme reste consultable dans le dossier.', visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId: dossier.id,
      entry: {
        id: `${program.id}-historical-impact`, date: state.currentDate,
        title: contained ? 'Divergence historique consolidée' : `Influence historique : ${interventionLabels[direction]}`,
        summary, importance: anchor.importance, actorIds: anchor.affectedActors,
        requiresDecision: false, visibility: 'player',
      },
      reason: 'Le programme laisse une trace causale de son effet sur la trajectoire historique.', visibility: 'player',
    },
  ];
}

export type HistoricalChannelResolution = 'diplomatic_agreement' | 'diplomatic_refusal' | 'explicit_silence';

/**
 * Les canaux sans programme (accord diplomatique conclu, refus, silence)
 * doivent laisser une trace causale au même titre qu'une action locale. Leur
 * poids est inférieur à celui d'un programme, afin qu'une unique conversation
 * ne réécrive jamais une trajectoire historique à elle seule.
 */
export function historicalAnchorChannelEffects(
  state: WorldState,
  dossierId: string,
  input: { sourceId: string; resolution: HistoricalChannelResolution },
): WorldEffect[] {
  const dossier = state.strategicDossiers[dossierId];
  const anchor = dossier?.relatedAnchorId ? state.historicalAnchors[dossier.relatedAnchorId] : undefined;
  if (!dossier || !anchor || ['manifested', 'disrupted', 'expired'].includes(anchor.status)) return [];

  const profile = input.resolution === 'diplomatic_agreement'
    ? { direction: 'contain' as const, scale: 0.7, outcome: 'agreed' as const, label: 'Accord diplomatique consolidé', phase: 'Coordination diplomatique engagée' }
    : input.resolution === 'diplomatic_refusal'
      ? { direction: 'accelerate' as const, scale: 0.3, outcome: 'refused' as const, label: 'Canal diplomatique refermé', phase: 'Marge diplomatique réduite' }
      : { direction: 'accelerate' as const, scale: 0.55, outcome: 'silent' as const, label: 'Silence sur le dossier historique', phase: 'Absence de posture publique' };
  const base = { none: 0, low: 3, medium: 5, high: 8 }[anchor.playerInfluence];
  if (base === 0) return [];
  const pressureDelta = Number(((profile.direction === 'contain' ? -1 : 1) * base * profile.scale).toFixed(2));
  const nextPressure = Number(clamp(anchor.pressure + pressureDelta).toFixed(2));
  const nextBalance = Number(clamp((anchor.interventionBalance ?? 0) + pressureDelta, -100, 100).toFixed(2));
  const divergenceThreshold = Math.max(8, Math.round(anchor.historicalWeight / 7));
  const contained = profile.direction === 'contain' && nextBalance <= -divergenceThreshold;
  const accelerated = profile.direction === 'accelerate' && nextBalance >= divergenceThreshold * 0.75;
  const divergence = contained
    ? { kind: 'contained' as const, date: state.currentDate, programId: input.sourceId, summary: 'Des initiatives diplomatiques cumulées ont suffisamment réduit la pression pour rendre la manifestation initiale improbable.' }
    : accelerated
      ? { kind: 'accelerated' as const, date: state.currentDate, programId: input.sourceId, summary: 'Les renoncements et refus cumulés durcissent la trajectoire plausible du dossier.' }
      : anchor.divergence;
  const summary = `${profile.label}. Pression ${anchor.pressure.toFixed(0)} → ${nextPressure.toFixed(0)}/100 ; bilan cumulé ${nextBalance.toFixed(1)}. ${divergence?.summary ?? 'La trajectoire reste ouverte.'}`;

  return [
    {
      kind: 'historical_anchor_patch', anchorId: anchor.id,
      patch: {
        pressure: nextPressure,
        status: contained ? 'disrupted' : profile.direction === 'accelerate' && nextPressure >= anchor.activationThreshold ? 'active' : anchor.status,
        interventionBalance: nextBalance,
        lastIntervention: { programId: input.sourceId, date: state.currentDate, direction: profile.direction, outcome: profile.outcome, pressureDelta, summary },
        ...(divergence ? { divergence } : {}),
      },
      reason: `Le canal « ${profile.label.toLocaleLowerCase('fr')} » modifie la pression de l’ancrage.`, visibility: 'player',
    },
    {
      kind: 'dossier_patch', dossierId,
      patch: {
        phase: contained ? 'Divergence historique consolidée' : profile.phase,
        trend: pressureDelta > 0 ? 'escalating' : 'deescalating',
        ...(contained ? { status: 'resolved' as const, autoTracked: false } : {}),
      },
      reason: 'Le choix de canal est relié à la trajectoire historique suivie.', visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `historical-channel-${input.sourceId}`, date: state.currentDate, title: profile.label,
        summary, importance: anchor.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player',
      },
      reason: 'La conséquence historique du canal choisi reste consultable dans le dossier.', visibility: 'player',
    },
  ];
}

/**
 * Un signal historique ne doit pas devenir une corvée mensuelle. Le joueur
 * reçoit donc un premier arbitrage seulement si son État est réellement
 * concerné, puis éventuellement un second lorsque le seuil d'activation est
 * franchi après qu'il a déjà pris position.
 */
function historicalDossierDecision(
  state: WorldState,
  anchor: HistoricalAnchor,
  date: ISODate,
  importance: DossierImportance,
  stage: 'signal' | 'activation',
) {
  if (anchor.playerInfluence === 'none' || !anchor.affectedActors.includes(state.playerCountryId)) return undefined;
  const playerName = state.countries[state.playerCountryId]?.name ?? state.playerCountryId;
  const prompt = stage === 'signal'
    ? `Choisir la posture de ${playerName} face aux signaux de « ${anchor.trendTitle} » avant que la trajectoire ne se fige.`
    : `Le seuil d'activation de « ${anchor.trendTitle} » est atteint : ${playerName} doit-il tenter d'infléchir la trajectoire, l'accompagner ou assumer le silence ?`;
  return makeDossierDecision({
    id: `historical-decision-${anchor.id}-${stage}`,
    prompt,
    createdAt: date,
    importance,
    actorIds: anchor.affectedActors,
    sourceKind: 'historical',
    sourceId: `${anchor.id}:${stage}`,
    sourceLabel: stage === 'signal' ? 'Signal historique' : 'Seuil historique',
  });
}

function anchorDossier(state: WorldState, anchor: HistoricalAnchor, date: ISODate, pressure: number): StrategicDossier {
  const dossierId = `historical-${anchor.id}`;
  const early = pressure < anchor.activationThreshold;
  const dossierImportance: DossierImportance = early && anchor.importance !== 'minor' ? 'moderate' : anchor.importance;
  const openingDecision = historicalDossierDecision(state, anchor, date, dossierImportance, 'signal');
  return {
    id: dossierId,
    title: anchor.trendTitle,
    kind: anchor.kind,
    status: early ? 'emerging' : 'active',
    importance: dossierImportance,
    actorIds: anchor.affectedActors,
    regionTags: anchor.regionTags,
    startedAt: date,
    updatedAt: date,
    phase: early ? 'Signaux précurseurs' : 'Seuil d’activation atteint',
    trend: early ? 'stable' : 'escalating',
    publicSummary: anchor.trendSummary,
    followed: false,
    // Une proposition historique doit être visible une fois, même si elle
    // n’est pas encore un dossier majeur suivi en continu.
    autoTracked: true,
    commitments: [],
    pendingDecisions: openingDecision ? [openingDecision.prompt] : [],
    ...(openingDecision ? { decisionRecords: [openingDecision] } : {}),
    relatedCurrentIds: anchor.trendId ? [anchor.trendId] : [],
    relatedAnchorId: anchor.id,
    relatedActionIds: [],
    entries: [{
      id: `${dossierId}-opening`, date,
      title: early ? 'Tendance historique détectée' : 'Ancrage historique activé',
      summary: `${anchor.trendSummary} Manifestations admissibles : ${anchor.possibleManifestations.join('; ')}.`,
      importance: dossierImportance,
      actorIds: anchor.affectedActors,
      requiresDecision: Boolean(openingDecision),
      visibility: anchor.playerVisibility === 'known' ? 'public' : 'player',
    }],
  };
}

function anchorPressure(state: WorldState, anchor: HistoricalAnchor, reachedDate: ISODate, elapsedMonths: number) {
  const current = anchor.trendId ? state.historicalCurrents[anchor.trendId] : undefined;
  const trendPressure = current?.pressure ?? anchor.pressure;
  const progress = dateProgress(reachedDate, anchor.probableWindow.start, anchor.probableWindow.end);
  // Le calendrier augmente la pression, mais ne suffit pas à lui seul à
  // déclencher une manifestation : l’inertie et les freins du courant restent
  // déterminants quand un courant correspondant existe.
  const trendBoost = current ? (trendPressure - anchor.pressure) * 0.18 : 0;
  const calendarBoost = progress * Math.min(18, 4 + monthsBetween(anchor.probableWindow.start, anchor.probableWindow.end) * 0.12);
  const next = anchor.pressure + trendBoost + calendarBoost + Math.max(0, elapsedMonths) * 0.18;
  return Math.max(0, Math.min(100, Number(next.toFixed(2))));
}

function updateHistoricalAnchors(
  state: WorldState,
  elapsedMonths: number,
  reachedDate: ISODate,
): { state: WorldState; candidates: HistoricalAnchorCandidate[] } {
  let next = state;
  const candidates: HistoricalAnchorCandidate[] = [];
  for (const anchor of Object.values(state.historicalAnchors ?? {})) {
    if (['manifested', 'disrupted', 'expired'].includes(anchor.status)) continue;
    if (reachedDate < anchor.probableWindow.start) continue;
    const pressure = anchorPressure(next, anchor, reachedDate, elapsedMonths);
    const insideWindow = inWindow(reachedDate, anchor.probableWindow.start, anchor.probableWindow.end);
    const previousStatus = anchor.status;
    const crossedProposal = previousStatus === 'dormant' && pressure >= anchor.proposalThreshold;
    const crossedActivation = ['dormant', 'proposed'].includes(previousStatus) && pressure >= anchor.activationThreshold && insideWindow;
    const windowClosing = reachedDate >= anchor.probableWindow.end;
    const nextStatus: HistoricalAnchor['status'] = windowClosing && pressure < anchor.activationThreshold
      ? 'expired'
      : crossedActivation || previousStatus === 'active' ? 'active'
        : crossedProposal || previousStatus === 'proposed' ? 'proposed' : previousStatus;
    const patch: Partial<HistoricalAnchor> = {
      pressure,
      status: nextStatus,
      lastEvaluatedAt: reachedDate,
      ...(crossedProposal ? { proposedAt: reachedDate } : {}),
      ...(crossedActivation ? { activatedAt: reachedDate } : {}),
    };
    const dossierId = anchor.dossierId ?? `historical-${anchor.id}`;
    const shouldCreateDossier = crossedProposal && anchor.playerVisibility !== 'hidden';
    const existing = next.strategicDossiers[dossierId];
    if (shouldCreateDossier && !existing) {
      const dossier = anchorDossier(next, { ...anchor, pressure, status: nextStatus, dossierId }, reachedDate, pressure);
      patch.dossierId = dossier.id;
      next = commitWorldAction(next, {
        kind: 'historical', actorId: next.playerCountryId, origin: 'historical', visibility: 'player',
        intent: `Proposer le dossier historique « ${anchor.trendTitle} »`,
        metadata: { historicalAnchor: true, historicalAnchorId: anchor.id, dossierProposal: true },
        effects: [
          { kind: 'historical_anchor_patch', anchorId: anchor.id, patch, reason: 'La pression historique franchit le seuil de proposition.', visibility: 'player' },
          { kind: 'dossier_add', dossier, reason: 'Une tendance historique plausible devient un dossier consultable.', visibility: 'player' },
        ],
      });
    } else if (Object.keys(patch).length > 0 && (
      Math.round(anchor.pressure) !== Math.round(pressure)
      || anchor.status !== nextStatus
      || anchor.lastEvaluatedAt !== reachedDate
    )) {
      next = commitWorldAction(next, {
        kind: 'historical', actorId: next.playerCountryId, origin: 'historical', visibility: 'debug',
        intent: `Évaluer l’ancrage historique « ${anchor.trendTitle} »`,
        metadata: { historicalAnchor: true, historicalAnchorId: anchor.id },
        effects: [{ kind: 'historical_anchor_patch', anchorId: anchor.id, patch, reason: 'Le moteur réévalue la pression et la fenêtre de l’ancrage.', visibility: 'debug' }],
      });
    }

    const effectiveStatus = nextStatus === 'expired' ? 'expired' : nextStatus;
    if (['proposed', 'active'].includes(effectiveStatus) && pressure >= anchor.proposalThreshold && insideWindow) {
      candidates.push({
        anchorId: anchor.id, dossierId, title: anchor.title, trendTitle: anchor.trendTitle,
        phase: pressure >= anchor.activationThreshold ? 'active' : windowClosing ? 'window_closing' : 'signal',
        pressure, importance: anchor.importance,
        possibleManifestations: anchor.possibleManifestations, invariants: anchor.invariants,
      });
    }

    if (nextStatus === 'active' && existing && crossedActivation) {
      const hasPendingDecision = existing.pendingDecisions.length > 0;
      const alreadyReceivedActivationDecision = (existing.decisionRecords ?? [])
        .some((decision) => decision.sourceId === `${anchor.id}:activation`);
      const activationDecision = !hasPendingDecision && !alreadyReceivedActivationDecision
        ? historicalDossierDecision(next, anchor, reachedDate, anchor.importance, 'activation')
        : undefined;
      next = commitWorldAction(next, {
        kind: 'historical', actorId: next.playerCountryId, origin: 'historical', visibility: 'player',
        intent: `Activer l’ancrage historique « ${anchor.trendTitle} »`,
        metadata: { historicalAnchor: true, historicalAnchorId: anchor.id },
        effects: [
          { kind: 'historical_anchor_patch', anchorId: anchor.id, patch, reason: 'La pression historique franchit le seuil d’activation.', visibility: 'player' },
          {
            kind: 'dossier_patch', dossierId,
            patch: {
              importance: anchor.importance, status: 'active', trend: 'escalating', phase: 'Seuil d’activation atteint', publicSummary: anchor.trendSummary,
              ...(activationDecision ? {
                pendingDecisions: [...existing.pendingDecisions, activationDecision.prompt],
                decisionRecords: [...(existing.decisionRecords ?? []), activationDecision],
              } : {}),
            },
            reason: 'Le dossier historique devient actif lorsque la pression atteint son seuil.', visibility: 'player',
          },
          { kind: 'dossier_entry_add', dossierId, entry: { id: `${dossierId}-activation-${reachedDate}`, date: reachedDate, title: 'Seuil d’activation atteint', summary: activationDecision ? `La pression atteint ${pressure.toFixed(0)}/100. Une nouvelle posture est demandée, car le premier arbitrage n'a pas suffi à écarter la trajectoire.` : `La pression atteint ${pressure.toFixed(0)}/100. Le dossier devient actif ; l'IA peut maintenant proposer une manifestation parmi les formes admissibles.`, importance: anchor.importance, actorIds: anchor.affectedActors, requiresDecision: Boolean(activationDecision), visibility: 'player' }, reason: 'Le passage au seuil actif est conservé dans la chronologie.', visibility: 'player' },
        ],
      });
    }
  }
  return { state: next, candidates };
}

export function advanceHistoricalAnchors(
  state: WorldState,
  elapsedMonths: number,
  reachedDate: ISODate,
) {
  return updateHistoricalAnchors(state, elapsedMonths, reachedDate);
}

export function advanceHistoricalCurrents(
  state: WorldState,
  elapsedMonths: number,
  reachedDate: ISODate,
): { state: WorldState; manifestations: HistoricalManifestation[] } {
  let next = state;
  const manifestations: HistoricalManifestation[] = [];

  for (const current of Object.values(state.historicalCurrents)) {
    if (current.status !== 'active' || reachedDate < current.startDate) continue;
    const netRate = current.driverRate - current.brakeRate;
    const inertiaFactor = 0.55 + current.inertia / 200;
    const pressureDelta = netRate * elapsedMonths * inertiaFactor;
    next = commitWorldAction(next, {
      kind: 'historical', actorId: next.playerCountryId, origin: 'historical',
      intent: `Évolution du courant : ${current.name}`,
      visibility: current.playerVisibility === 'hidden' ? 'debug' : 'player',
      effects: [{
        kind: 'historical_pressure', currentId: current.id, delta: pressureDelta,
        reason: `Les moteurs structurels de « ${current.name} » continuent d’agir.`,
        visibility: current.playerVisibility === 'hidden' ? 'debug' : 'player',
      }],
    });
  }

  for (const process of Object.values(next.latentProcesses)) {
    if (process.status !== 'preparing' || reachedDate < process.window.start) continue;
    const current = next.historicalCurrents[process.currentId];
    if (!current || current.status !== 'active') continue;
    const progressGain = elapsedMonths * (0.55 + current.pressure / 100) * (0.45 + process.capability / 160);
    const progress = Math.min(100, process.progress + progressGain);
    const ready = progress >= 100 && inWindow(reachedDate, process.window.start, process.window.end);
    next = commitWorldAction(next, {
      kind: 'historical', actorId: next.playerCountryId, origin: 'historical',
      intent: `Progression d’un processus latent lié à ${current.name}`,
      visibility: process.secrecy >= 70 ? 'debug' : 'player',
      effects: [{
        kind: 'latent_process_patch', processId: process.id,
        patch: { progress, status: ready ? 'ready' : 'preparing' },
        reason: `Le processus latent progresse sous l’effet du courant « ${current.name} ».`,
        visibility: process.secrecy >= 70 ? 'debug' : 'player',
      }],
    });

    if (!ready) continue;
    const outcome = pickSeeded(process.possibleOutcomes, state.seed, `${process.id}:${reachedDate}`);
    manifestations.push({
      currentId: current.id,
      processId: process.id,
      title: current.name,
      outcome,
      date: reachedDate,
      confidence: Math.round((current.pressure + process.capability) / 2),
    });
    const dossierId = `current-${current.id}`;
    const effects: WorldEffect[] = [{
      kind: 'latent_process_patch', processId: process.id,
      patch: { status: 'manifested' },
      reason: `Le processus latent se concrétise sous la forme : ${outcome}.`, visibility: 'public',
    }];
    if (next.strategicDossiers[dossierId]) {
      effects.push(
        {
          kind: 'dossier_patch', dossierId,
          patch: { phase: outcome, trend: 'escalating', publicSummary: `${current.name} se manifeste désormais sous la forme : ${outcome}.` },
          reason: 'La manifestation historique modifie la phase du dossier suivi.', visibility: 'public',
        },
        {
          kind: 'dossier_entry_add', dossierId,
          entry: { id: `manifestation-${process.id}-${reachedDate}`, date: reachedDate, title: outcome, summary: `Le courant « ${current.name} » franchit un seuil et produit une manifestation observable.`, importance: 'major', actorIds: current.affectedActors, requiresDecision: current.affectedActors.includes(next.playerCountryId), visibility: 'public' },
          reason: 'La manifestation rejoint la chronologie permanente du dossier.', visibility: 'public',
        },
      );
    }
    next = commitWorldAction(next, {
      kind: 'historical', actorId: next.playerCountryId, origin: 'historical',
      intent: `Manifestation du courant : ${outcome}`,
      effects,
    });
  }

  return { state: next, manifestations };
}

export function disruptLatentProcess(
  state: WorldState,
  processId: string,
  actorId: string,
  disruptionStrength: number,
) {
  const process = state.latentProcesses[processId];
  if (!process || process.status === 'manifested') return state;
  const progress = Math.max(0, process.progress - disruptionStrength);
  const status = disruptionStrength >= process.capability * 0.8 ? 'disrupted' : process.status;
  const action: ActionDraft = {
    kind: 'intelligence', actorId, origin: 'player', targetIds: [process.actorId],
    intent: `Perturber le processus latent ${process.objective}`,
    effects: [{
      kind: 'latent_process_patch', processId,
      patch: { progress, status },
      reason: status === 'disrupted' ? 'Le réseau opérationnel est désorganisé.' : 'La préparation adverse est retardée.',
      visibility: 'secret',
    }],
  };
  return commitWorldAction(state, action);
}
