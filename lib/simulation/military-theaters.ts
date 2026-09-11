import { defenseReference2000 } from './country-sheet';
import type { ActionProgram, CountryId, MilitaryTheater, MilitaryTheaterActionKind, MilitaryTheaterOperation, WorldEffect, WorldState } from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const slug = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const isHome = (location: string) => /métropole|territoire|réserve|rotation/i.test(location);
const isReserve = (location: string) => /réserve|rotation/i.test(location);

/** Convertit les ventilations de référence en états dynamiques sans inventer de nouveaux théâtres. */
export function createMilitaryTheaters2000(): Record<string, MilitaryTheater> {
  const theaters: Record<string, MilitaryTheater> = {};
  for (const [countryId, defense] of Object.entries(defenseReference2000)) {
    for (const deployment of defense.deployments ?? []) {
      const home = isHome(deployment.location);
      const reserve = isReserve(deployment.location);
      const hostCountryIds = [...new Set((deployment.countryBreakdown ?? []).map((item) => item.countryId))];
      const id = `theater-${countryId}-${slug(deployment.location)}`;
      theaters[id] = {
        id,
        countryId,
        location: deployment.location,
        hostCountryIds,
        personnelThousands: Number(deployment.personnelThousands.toFixed(2)),
        availablePersonnelThousands: Number(deployment.personnelThousands.toFixed(2)),
        inTransitPersonnelThousands: 0,
        mission: deployment.mission,
        status: home ? reserve ? 'reserve' : 'home' : 'active',
        readiness: home ? reserve ? 42 : 72 : 64,
        supplyCoverageMonths: home ? reserve ? 4 : 8 : hostCountryIds.length ? 2 : 1.2,
        access: home ? 'national' : hostCountryIds.length ? 'host_consent' : 'unknown',
      };
    }
  }
  return theaters;
}

export function militaryTheatersForCountry(state: WorldState, countryId: CountryId): MilitaryTheater[] {
  return Object.values(state.militaryTheaters ?? {})
    .filter((theater) => theater.countryId === countryId)
    .sort((a, b) => (a.status === 'home' ? -1 : 1) - (b.status === 'home' ? -1 : 1) || b.personnelThousands - a.personnelThousands);
}

export function militaryTheaterById(state: WorldState, theaterId: string): MilitaryTheater | undefined {
  return state.militaryTheaters?.[theaterId];
}

/** Réserve les personnels au lancement : ils ne peuvent pas être engagés deux fois. */
export function militaryTheaterReservationEffects(state: WorldState, operation: MilitaryTheaterOperation, visibility: 'player' | 'debug' = 'player'): WorldEffect[] {
  const source = state.militaryTheaters?.[operation.sourceTheaterId];
  const target = state.militaryTheaters?.[operation.targetTheaterId];
  if (!source || !target) return [];
  const amount = operation.amountThousands;
  return [
    { kind: 'military_theater_patch', theaterId: source.id, patch: { availablePersonnelThousands: Number((source.availablePersonnelThousands - amount).toFixed(2)), currentOperation: operation }, reason: `Les personnels sont réservés pour l’opération « ${operation.kind} ».`, visibility },
    { kind: 'military_theater_patch', theaterId: target.id, patch: { inTransitPersonnelThousands: Number((target.inTransitPersonnelThousands + amount).toFixed(2)), currentOperation: operation, readiness: Number(clamp(target.readiness - 4).toFixed(2)) }, reason: `Le mouvement vers « ${target.location} » est engagé ; la préparation opérationnelle est temporairement réduite.`, visibility },
  ];
}

/** Applique ou annule le transfert lorsque le programme atteint son échéance. */
export function militaryTheaterResolutionEffects(state: WorldState, operation: MilitaryTheaterOperation, outcome: 'succeeded' | 'partially_succeeded' | 'failed'): WorldEffect[] {
  const source = state.militaryTheaters?.[operation.sourceTheaterId];
  const target = state.militaryTheaters?.[operation.targetTheaterId];
  if (!source || !target) return [];
  const amount = operation.amountThousands;
  const effects: WorldEffect[] = [];
  if (outcome === 'failed') {
    effects.push(
      { kind: 'military_theater_patch', theaterId: source.id, patch: { availablePersonnelThousands: Number((source.availablePersonnelThousands + amount).toFixed(2)), currentOperation: undefined }, reason: 'Le mouvement militaire échoue ; les personnels restent dans leur théâtre de départ.', visibility: 'player' },
      { kind: 'military_theater_patch', theaterId: target.id, patch: { inTransitPersonnelThousands: Number(Math.max(0, target.inTransitPersonnelThousands - amount).toFixed(2)), currentOperation: undefined, readiness: Number(clamp(target.readiness - 2).toFixed(2)) }, reason: 'L’échec logistique entame temporairement la préparation du théâtre.', visibility: 'player' },
    );
    return effects;
  }
  const readinessGain = outcome === 'succeeded' ? 5 : 1;
  effects.push(
    { kind: 'military_theater_patch', theaterId: source.id, patch: { personnelThousands: Number(Math.max(0, source.personnelThousands - amount).toFixed(2)), currentOperation: undefined }, reason: `Les personnels quittent « ${source.location} » pour rejoindre le nouveau théâtre.`, visibility: 'player' },
    { kind: 'military_theater_patch', theaterId: target.id, patch: { personnelThousands: Number((target.personnelThousands + amount).toFixed(2)), availablePersonnelThousands: Number((target.availablePersonnelThousands + amount).toFixed(2)), inTransitPersonnelThousands: Number(Math.max(0, target.inTransitPersonnelThousands - amount).toFixed(2)), currentOperation: undefined, readiness: Number(clamp(target.readiness + readinessGain).toFixed(2)), supplyCoverageMonths: Number(Math.max(0.2, target.supplyCoverageMonths - (amount / 25)).toFixed(2)) }, reason: outcome === 'succeeded' ? 'Le renforcement atteint le théâtre et devient disponible.' : 'Le renforcement atteint le théâtre avec une préparation incomplète.', visibility: 'player' },
  );
  return effects;
}

function destinationForWithdrawal(state: WorldState, source: MilitaryTheater) {
  return militaryTheatersForCountry(state, source.countryId)
    .filter((theater) => theater.id !== source.id && (theater.status === 'home' || theater.status === 'reserve'))
    .sort((a, b) => (a.status === 'home' ? -1 : 1) - (b.status === 'home' ? -1 : 1))[0];
}

function availableSourceForReinforcement(state: WorldState, target: MilitaryTheater) {
  return militaryTheatersForCountry(state, target.countryId)
    .filter((theater) => theater.id !== target.id && (theater.status === 'reserve' || theater.status === 'home') && theater.availablePersonnelThousands >= 0.1)
    .sort((a, b) => (a.status === 'reserve' ? -1 : 1) - (b.status === 'reserve' ? -1 : 1) || b.availablePersonnelThousands - a.availablePersonnelThousands)[0];
}

export type PreparedMilitaryTheaterCommand = {
  kind: MilitaryTheaterActionKind;
  sourceTheaterId: string;
  targetTheaterId: string;
  amountThousands: number;
};

export type MilitaryTheaterActionValidation = {
  ok: true;
  operation: PreparedMilitaryTheaterCommand;
  source: MilitaryTheater;
  target: MilitaryTheater;
  warnings: string[];
} | { ok: false; error: string };

export function validateMilitaryTheaterCommand(state: WorldState, theaterId: string, kind: MilitaryTheaterActionKind, amountThousands: number, destinationTheaterId?: string): MilitaryTheaterActionValidation {
  const theater = state.militaryTheaters?.[theaterId];
  if (!theater) return { ok: false, error: 'Théâtre militaire introuvable dans cette sauvegarde.' };
  if (theater.countryId !== state.playerCountryId) return { ok: false, error: 'Le joueur ne peut commander que les forces de son propre pays.' };
  const amount = Number(amountThousands.toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Le volume de personnels doit être positif.' };
  if (theater.currentOperation) return { ok: false, error: `Le théâtre « ${theater.location} » a déjà un mouvement en cours.` };
  let source = theater;
  let target = theater;
  if (kind === 'reinforce') {
    if (theater.status === 'home' || theater.status === 'reserve') return { ok: false, error: 'Le renforcement cible un théâtre extérieur.' };
    source = availableSourceForReinforcement(state, theater) ?? theater;
    if (source.id === theater.id || source.availablePersonnelThousands < amount) return { ok: false, error: `Réserve mobilisable insuffisante : ${source.id === theater.id ? 'aucune base de départ disponible' : `${source.availablePersonnelThousands.toFixed(1)} k disponibles`}.` };
  } else if (kind === 'withdraw') {
    if (theater.status === 'home' || theater.status === 'reserve') return { ok: false, error: 'Le retrait concerne un théâtre extérieur.' };
    if (theater.availablePersonnelThousands < amount) return { ok: false, error: `Effectifs disponibles insuffisants sur ce théâtre : ${theater.availablePersonnelThousands.toFixed(1)} k.` };
    target = destinationForWithdrawal(state, theater) ?? theater;
    if (target.id === theater.id) return { ok: false, error: 'Aucun théâtre national ou de réserve ne peut accueillir ce retrait.' };
  } else {
    if (!destinationTheaterId) return { ok: false, error: 'Choisissez un théâtre de destination pour le redéploiement.' };
    target = state.militaryTheaters?.[destinationTheaterId] ?? theater;
    if (target.id === theater.id || target.countryId !== theater.countryId) return { ok: false, error: 'Le redéploiement doit rester dans le même pays et changer de théâtre.' };
    if (target.currentOperation) return { ok: false, error: `Le théâtre de destination « ${target.location} » a déjà un mouvement en cours.` };
    if (theater.availablePersonnelThousands < amount) return { ok: false, error: `Effectifs disponibles insuffisants sur ce théâtre : ${theater.availablePersonnelThousands.toFixed(1)} k.` };
  }
  if (source.currentOperation || target.currentOperation) return { ok: false, error: 'Un des théâtres concernés est déjà mobilisé par une autre opération.' };
  const warnings: string[] = [];
  if (target.access === 'unknown') warnings.push('L’accès politique au théâtre n’est pas documenté : le mouvement peut provoquer une réaction diplomatique.');
  if (target.supplyCoverageMonths < 1.5) warnings.push('La couverture logistique est faible ; le renforcement risque de réduire la disponibilité effective.');
  if (kind === 'redeploy' && target.status === 'home') warnings.push('Le redéploiement vers la métropole améliore la réserve nationale mais réduit la présence extérieure.');
  return { ok: true, operation: { kind, sourceTheaterId: source.id, targetTheaterId: target.id, amountThousands: amount, }, source, target, warnings };
}

export function theaterOperationForProgram(program: Pick<ActionProgram, 'militaryOperation'>): MilitaryTheaterOperation | undefined {
  return program.militaryOperation;
}

export function militaryTheaterDossier(state: WorldState, operation: MilitaryTheaterOperation): WorldEffect | null {
  const target = state.militaryTheaters?.[operation.targetTheaterId];
  if (!target || target.access !== 'unknown') return null;
  const actorIds = [state.playerCountryId, ...target.hostCountryIds].filter((id, index, all) => id && all.indexOf(id) === index);
  const dossierId = `military-theater-${target.id}`;
  return {
    kind: 'dossier_add',
    dossier: {
      id: dossierId,
      title: `Mouvement militaire · ${target.location}`,
      kind: 'security', status: 'active', importance: target.hostCountryIds.length ? 'major' : 'moderate',
      actorIds, regionTags: [target.location], startedAt: state.currentDate, updatedAt: state.currentDate,
      phase: 'Réaction au déploiement', trend: 'escalating', publicSummary: `Un mouvement de forces vers ${target.location} doit être évalué politiquement.`,
      followed: true, autoTracked: false, commitments: [], pendingDecisions: [`Décider si le mouvement vers ${target.location} doit être maintenu, expliqué ou suspendu.`],
      relatedCurrentIds: [], relatedActionIds: [],
      entries: [{ id: `${dossierId}-opening`, date: state.currentDate, title: 'Mouvement détecté', summary: `Le gouvernement engage ${operation.amountThousands.toFixed(1)} k vers ${target.location}.`, importance: 'major', actorIds, requiresDecision: true, visibility: 'player' }],
    },
    reason: 'Un théâtre non documenté ouvre un dossier de réaction afin que le mouvement ait une conséquence politique lisible.', visibility: 'player',
  };
}
