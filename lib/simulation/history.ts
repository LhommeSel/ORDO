import { commitWorldAction } from './ledger';
import { pickSeeded } from './random';
import type { ActionDraft, ISODate, WorldEffect, WorldState } from './types';

export type HistoricalManifestation = {
  currentId: string;
  processId: string;
  title: string;
  outcome: string;
  date: ISODate;
  confidence: number;
};

const inWindow = (date: ISODate, start: ISODate, end: ISODate) => date >= start && date <= end;

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
