import { defenseReference2000 } from './country-sheet';
import { commitWorldAction, relationBetween } from './ledger';
import type { ActionProgram, CountryId, MilitaryBase, MilitaryTheater, MilitaryTheaterAccess, MilitaryTheaterActionKind, MilitaryTheaterOperation, WorldEffect, WorldState } from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const slug = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const isHome = (location: string) => /métropole|territoire|réserve|rotation/i.test(location);
const isReserve = (location: string) => /réserve|rotation/i.test(location);
const baseMission = /base|prépositionn|point d’appui|point d'appui/i;
const baseLocations: Partial<Record<CountryId, string>> = {
  CIV: 'Abidjan · Côte d’Ivoire',
  DJI: 'Djibouti',
  SEN: 'Dakar · Sénégal',
  GAB: 'Libreville · Gabon',
};

/** Implantations extérieures majeures déjà suggérées par le référentiel 2000. */
export function createMilitaryBases2000(): Record<string, MilitaryBase> {
  const bases: Record<string, MilitaryBase> = {};
  for (const [ownerCountryId, defense] of Object.entries(defenseReference2000)) {
    for (const deployment of defense.deployments ?? []) {
      for (const placement of deployment.countryBreakdown ?? []) {
        if (!placement.mission || !baseMission.test(placement.mission)) continue;
        const id = `base-${ownerCountryId}-${placement.countryId}`;
        const assigned = Number(placement.personnelThousands.toFixed(2));
        bases[id] = {
          id,
          ownerCountryId,
          hostCountryId: placement.countryId,
          location: baseLocations[placement.countryId] ?? placement.countryId,
          type: /prépositionn/i.test(placement.mission) ? 'prepositioned' : /base/i.test(placement.mission) ? 'permanent' : 'support',
          capacityThousands: Number(Math.max(assigned + 1, assigned * 1.25).toFixed(2)),
          assignedPersonnelThousands: assigned,
          status: 'active',
          access: 'host_consent',
          mission: placement.mission,
          agreementStartAt: '2000-01-01',
        };
      }
    }
  }
  return bases;
}

/** Convertit les ventilations de référence en états dynamiques sans inventer de nouveaux théâtres. */
export function createMilitaryTheaters2000(): Record<string, MilitaryTheater> {
  const theaters: Record<string, MilitaryTheater> = {};
  const bases = createMilitaryBases2000();
  for (const [countryId, defense] of Object.entries(defenseReference2000)) {
    for (const deployment of defense.deployments ?? []) {
      const home = isHome(deployment.location);
      const reserve = isReserve(deployment.location);
      const hostCountryIds = [...new Set((deployment.countryBreakdown ?? []).map((item) => item.countryId))];
      const id = `theater-${countryId}-${slug(deployment.location)}`;
      const baseIds = Object.values(bases)
        .filter((base) => base.ownerCountryId === countryId && hostCountryIds.includes(base.hostCountryId))
        .map((base) => base.id);
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
        ...(baseIds.length ? { baseIds } : {}),
      };
    }
  }
  return theaters;
}

export function militaryBasesForCountry(state: WorldState, countryId: CountryId): MilitaryBase[] {
  return Object.values(state.militaryBases ?? {})
    .filter((base) => base.ownerCountryId === countryId)
    .sort((a, b) => a.hostCountryId.localeCompare(b.hostCountryId) || a.location.localeCompare(b.location));
}

export function militaryBaseById(state: WorldState, baseId: string): MilitaryBase | undefined {
  return state.militaryBases?.[baseId];
}

function relationSignal(state: WorldState, ownerCountryId: CountryId, hostCountryId: CountryId) {
  return relationBetween(state, ownerCountryId, hostCountryId) ?? relationBetween(state, hostCountryId, ownerCountryId);
}

function hasDefenseAgreement(state: WorldState, ownerCountryId: CountryId, hostCountryId: CountryId) {
  return Object.values(state.treaties ?? {}).some((treaty) => treaty.status === 'active'
    && treaty.parties.includes(ownerCountryId)
    && treaty.parties.includes(hostCountryId)
    && /défense|militaire|otan|sécurité|stationnement|base/i.test(treaty.label));
}

function accessFromRelation(state: WorldState, ownerCountryId: CountryId, hostCountryId: CountryId, fallback: MilitaryTheaterAccess): MilitaryTheaterAccess {
  if (hasDefenseAgreement(state, ownerCountryId, hostCountryId)) return 'allied';
  const relation = relationSignal(state, ownerCountryId, hostCountryId);
  if (!relation) return fallback;
  const score = relation.relation * 0.5 + relation.trust * 0.25 + relation.securityAlignment * 0.25;
  if (score >= 65 && relation.securityAlignment >= 50) return 'allied';
  if (score >= 44) return 'host_consent';
  if (score >= 25) return 'contested';
  return 'denied';
}

function accessFromBase(state: WorldState, base: MilitaryBase): MilitaryTheaterAccess {
  if (base.status === 'closed') return 'denied';
  if (base.status === 'restricted') return 'contested';
  return accessFromRelation(state, base.ownerCountryId, base.hostCountryId, base.access);
}

/** Recalcule l’accès politique sans modifier les effectifs ni créer d’action joueur. */
export function advanceMilitaryTheaterAccess(state: WorldState): WorldState {
  let next = state;
  for (const base of Object.values(state.militaryBases ?? {})) {
    const access = accessFromBase(next, base);
    if (access === base.access) continue;
    const previousAccess = base.access;
    next = commitAccessPatch(next, 'base', base.id, access, base.ownerCountryId, base.hostCountryId, base.location);
    if (['contested', 'denied'].includes(access) && !['contested', 'denied'].includes(previousAccess)) {
      next = appendAccessDossier(next, base.ownerCountryId, [base.hostCountryId], `Accès à la base · ${base.location}`, base.location, access, base.id);
    }
  }
  for (const theater of Object.values(next.militaryTheaters ?? {})) {
    if (theater.status === 'home' || theater.status === 'reserve') continue;
    const baseAccesses = (theater.baseIds ?? []).map((id) => next.militaryBases?.[id]?.access).filter((access): access is MilitaryTheaterAccess => Boolean(access));
    const hostAccesses = theater.hostCountryIds.map((hostCountryId) => accessFromRelation(next, theater.countryId, hostCountryId, theater.access));
    const access = baseAccesses.includes('denied') && baseAccesses.length === baseAccesses.filter((item) => item === 'denied').length
      ? 'denied'
      : baseAccesses.includes('allied') || hostAccesses.includes('allied')
        ? 'allied'
        : baseAccesses.includes('contested') || hostAccesses.includes('contested')
          ? 'contested'
          : baseAccesses.includes('host_consent') || hostAccesses.includes('host_consent')
            ? 'host_consent'
            : theater.hostCountryIds.length ? 'unknown' : theater.access;
    if (access === theater.access) continue;
    const previousAccess = theater.access;
    next = commitAccessPatch(next, 'theater', theater.id, access, theater.countryId, theater.hostCountryIds, theater.location);
    if (['contested', 'denied'].includes(access) && !['contested', 'denied'].includes(previousAccess)) {
      next = appendAccessDossier(next, theater.countryId, theater.hostCountryIds, `Accès au théâtre · ${theater.location}`, theater.location, access, theater.id);
    }
  }
  return next;
}

function appendAccessDossier(state: WorldState, ownerCountryId: CountryId, hostCountryIds: CountryId[], title: string, location: string, access: MilitaryTheaterAccess, subjectId: string): WorldState {
  const dossierId = `military-access-${subjectId}`;
  if (state.strategicDossiers?.[dossierId]) return state;
  const actorIds = [ownerCountryId, ...hostCountryIds].filter((id, index, all) => id && all.indexOf(id) === index);
  return commitWorldAction(state, {
    kind: 'diplomatic', actorId: ownerCountryId, targetIds: hostCountryIds, origin: 'time',
    intent: `Ouvrir un dossier sur l’accès militaire · ${location}`,
    effects: [{
      kind: 'dossier_add',
      dossier: {
        id: dossierId, title, kind: 'security', status: 'active', importance: access === 'denied' ? 'major' : 'moderate',
        actorIds, regionTags: [location], startedAt: state.currentDate, updatedAt: state.currentDate,
        phase: access === 'denied' ? 'Accès refusé' : 'Accès contesté', trend: 'escalating',
        publicSummary: `Le pays hôte ${access === 'denied' ? 'refuse' : 'conteste'} l’accès à ${location}.`, followed: true, autoTracked: false,
        commitments: [], pendingDecisions: [`Décider s’il faut négocier, réduire la présence ou maintenir la posture autour de ${location}.`],
        relatedCurrentIds: [], relatedActionIds: [],
        entries: [{ id: `${dossierId}-opening`, date: state.currentDate, title: access === 'denied' ? 'Accès refusé' : 'Accès contesté', summary: `Le statut d’accès militaire devient « ${access} » pour ${location}.`, importance: access === 'denied' ? 'major' : 'moderate', actorIds, requiresDecision: true, visibility: 'player' }],
      },
      reason: 'Une dégradation de l’accès militaire devient un dossier diplomatique suivi.', visibility: 'player',
    }],
  });
}

function commitAccessPatch(state: WorldState, target: 'base' | 'theater', id: string, access: MilitaryTheaterAccess, actorId: CountryId, targetIds: CountryId[] | CountryId, location: string): WorldState {
  const targetList = Array.isArray(targetIds) ? targetIds : [targetIds];
  const effect: WorldEffect = target === 'base'
    ? { kind: 'military_base_patch', baseId: id, patch: { access }, reason: `L’accès politique de l’implantation ${location} devient « ${access} ».` }
    : { kind: 'military_theater_patch', theaterId: id, patch: { access }, reason: `L’accès politique du théâtre ${location} devient « ${access} ».` };
  return commitWorldAction(state, { kind: 'diplomatic', actorId, targetIds: targetList, origin: 'time', intent: `Réévaluer l’accès militaire · ${location}`, effects: [effect] });
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
    if (theater.access === 'denied') return { ok: false, error: `Le pays hôte refuse actuellement l’accès au théâtre « ${theater.location} ».` };
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
    if (target.access === 'denied') return { ok: false, error: `Le pays hôte refuse actuellement l’accès au théâtre « ${target.location} ».` };
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
  if (!target || !['contested', 'denied', 'unknown'].includes(target.access)) return null;
  const actorIds = [state.playerCountryId, ...target.hostCountryIds].filter((id, index, all) => id && all.indexOf(id) === index);
  const dossierId = `military-theater-${target.id}`;
  return {
    kind: 'dossier_add',
    dossier: {
      id: dossierId,
      title: `Accès militaire contesté · ${target.location}`,
      kind: 'security', status: 'active', importance: target.access === 'denied' ? 'major' : target.hostCountryIds.length ? 'major' : 'moderate',
      actorIds, regionTags: [target.location], startedAt: state.currentDate, updatedAt: state.currentDate,
      phase: 'Réaction au déploiement', trend: 'escalating', publicSummary: `L’accès politique à ${target.location} est ${target.access === 'denied' ? 'refusé' : target.access === 'contested' ? 'contesté' : 'non documenté'} ; le mouvement doit être évalué politiquement.`,
      followed: true, autoTracked: false, commitments: [], pendingDecisions: [`Décider si le mouvement vers ${target.location} doit être maintenu, expliqué ou suspendu.`],
      relatedCurrentIds: [], relatedActionIds: [],
      entries: [{ id: `${dossierId}-opening`, date: state.currentDate, title: 'Accès à clarifier', summary: `Le gouvernement engage ${operation.amountThousands.toFixed(1)} k vers ${target.location} alors que l’accès est ${target.access}.`, importance: 'major', actorIds, requiresDecision: true, visibility: 'player' }],
    },
    reason: 'Un accès contesté ou non documenté ouvre un dossier de réaction afin que le mouvement ait une conséquence politique lisible.', visibility: 'player',
  };
}
