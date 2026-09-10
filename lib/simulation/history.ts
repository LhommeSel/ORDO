import { commitWorldAction } from './ledger';
import { pickSeeded } from './random';
import type {
  ActionDraft, DossierImportance, HistoricalAnchor, ISODate, StrategicDossier, WorldEffect, WorldState,
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

function anchorDossier(anchor: HistoricalAnchor, date: ISODate, pressure: number): StrategicDossier {
  const dossierId = `historical-${anchor.id}`;
  const early = pressure < anchor.activationThreshold;
  const dossierImportance: DossierImportance = early && anchor.importance !== 'minor' ? 'moderate' : anchor.importance;
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
    pendingDecisions: [],
    relatedCurrentIds: anchor.trendId ? [anchor.trendId] : [],
    relatedAnchorId: anchor.id,
    relatedActionIds: [],
    entries: [{
      id: `${dossierId}-opening`, date,
      title: early ? 'Tendance historique détectée' : 'Ancrage historique activé',
      summary: `${anchor.trendSummary} Manifestations admissibles : ${anchor.possibleManifestations.join('; ')}.`,
      importance: dossierImportance,
      actorIds: anchor.affectedActors,
      requiresDecision: false,
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
      const dossier = anchorDossier({ ...anchor, pressure, status: nextStatus, dossierId }, reachedDate, pressure);
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
      next = commitWorldAction(next, {
        kind: 'historical', actorId: next.playerCountryId, origin: 'historical', visibility: 'player',
        intent: `Activer l’ancrage historique « ${anchor.trendTitle} »`,
        metadata: { historicalAnchor: true, historicalAnchorId: anchor.id },
        effects: [
          { kind: 'historical_anchor_patch', anchorId: anchor.id, patch, reason: 'La pression historique franchit le seuil d’activation.', visibility: 'player' },
          { kind: 'dossier_patch', dossierId, patch: { importance: anchor.importance, status: 'active', trend: 'escalating', phase: 'Seuil d’activation atteint', publicSummary: anchor.trendSummary }, reason: 'Le dossier historique devient actif lorsque la pression atteint son seuil.', visibility: 'player' },
          { kind: 'dossier_entry_add', dossierId, entry: { id: `${dossierId}-activation-${reachedDate}`, date: reachedDate, title: 'Seuil d’activation atteint', summary: `La pression atteint ${pressure.toFixed(0)}/100. L’IA peut maintenant proposer une manifestation parmi les formes admissibles.`, importance: anchor.importance, actorIds: anchor.affectedActors, requiresDecision: false, visibility: 'player' }, reason: 'Le passage au seuil actif est conservé dans la chronologie.', visibility: 'player' },
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
