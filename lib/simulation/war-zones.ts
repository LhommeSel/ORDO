import { commitWorldAction } from './ledger';
import type {
  CountryId,
  StrategicDossier,
  WarZone,
  WarZoneIntensity,
  WorldEffect,
  WorldState,
} from './types';

const INTENSITY_ORDER: WarZoneIntensity[] = ['low', 'moderate', 'high', 'critical'];

const PROFILE: Record<WarZoneIntensity, { economicDisruptionPct: number; supplyMultiplier: number }> = {
  low: { economicDisruptionPct: 2, supplyMultiplier: 0.95 },
  moderate: { economicDisruptionPct: 6, supplyMultiplier: 0.86 },
  high: { economicDisruptionPct: 14, supplyMultiplier: 0.72 },
  critical: { economicDisruptionPct: 28, supplyMultiplier: 0.55 },
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function shiftIntensity(value: WarZoneIntensity, delta: number): WarZoneIntensity {
  const index = clamp(INTENSITY_ORDER.indexOf(value) + delta, 0, INTENSITY_ORDER.length - 1);
  return INTENSITY_ORDER[index];
}

function dossierIntensity(dossier: StrategicDossier): WarZoneIntensity {
  const initial: WarZoneIntensity = dossier.importance === 'critical'
    ? 'high'
    : dossier.importance === 'major'
      ? 'moderate'
      : 'low';
  if (dossier.trend === 'escalating') return shiftIntensity(initial, 1);
  if (dossier.trend === 'deescalating') return shiftIntensity(initial, -1);
  return initial;
}

function countriesForDossier(state: WorldState, dossier: StrategicDossier): CountryId[] {
  return [...new Set(dossier.actorIds.filter((id): id is CountryId => Boolean(state.countries[id])))] as CountryId[];
}

function territoryIdsForCountries(state: WorldState, countryIds: CountryId[]): string[] {
  const matches = Object.values(state.territorial?.territories ?? {})
    .filter((territory) => countryIds.includes(territory.sovereignCountryId) && territory.kind !== 'aggregate')
    .map((territory) => territory.id);
  if (matches.length) return matches.slice(0, 12);
  return countryIds
    .map((countryId) => `${countryId}:aggregate`)
    .filter((territoryId) => Boolean(state.territorial?.territories?.[territoryId]));
}

function theaterIdsForCountries(state: WorldState, countryIds: CountryId[]): string[] {
  return Object.values(state.militaryTheaters ?? {})
    .filter((theater) => theater.status === 'active' && countryIds.includes(theater.countryId))
    .map((theater) => theater.id);
}

/** Construit une zone à partir d'un dossier de conflit sans inventer de front tactique. */
export function createWarZoneForDossier(state: WorldState, dossier: StrategicDossier): WarZone | null {
  const countryIds = countriesForDossier(state, dossier);
  if (countryIds.length < 2) return null;
  const intensity = dossierIntensity(dossier);
  const profile = PROFILE[intensity];
  const theaterIds = theaterIdsForCountries(state, countryIds);
  return {
    id: `war-zone-${dossier.id}`,
    name: dossier.title,
    countryIds,
    territoryIds: territoryIdsForCountries(state, countryIds),
    theaterIds,
    intensity,
    economicDisruptionPct: profile.economicDisruptionPct,
    supplyMultiplier: profile.supplyMultiplier,
    status: 'active',
    startedAt: dossier.startedAt,
    updatedAt: state.currentDate,
    dossierId: dossier.id,
    baselineGrowthAnnualPct: Object.fromEntries(countryIds.map((countryId) => [countryId, state.macroEconomies[countryId]?.realGrowthAnnualPct ?? 0])),
    baselineInflationAnnualPct: Object.fromEntries(countryIds.map((countryId) => [countryId, state.macroEconomies[countryId]?.inflationAnnualPct ?? 0])),
    baselineSupplyCoverageMonths: Object.fromEntries(theaterIds.map((theaterId) => [theaterId, state.militaryTheaters[theaterId]?.supplyCoverageMonths ?? 0])),
  };
}

export function warZonesForCountry(state: WorldState, countryId: CountryId): WarZone[] {
  return Object.values(state.warZones ?? {}).filter((zone) => zone.countryIds.includes(countryId));
}

export function activeWarZones(state: WorldState): WarZone[] {
  return Object.values(state.warZones ?? {}).filter((zone) => zone.status === 'active');
}

function impactEffects(zone: WarZone): WorldEffect[] {
  const profile = PROFILE[zone.intensity];
  const effects: WorldEffect[] = [];
  for (const countryId of zone.countryIds) {
      const baselineGrowth = zone.baselineGrowthAnnualPct[countryId];
      const baselineInflation = zone.baselineInflationAnnualPct[countryId];
      if (baselineGrowth === undefined && baselineInflation === undefined) continue;
      effects.push({
        kind: 'macro_patch',
        countryId,
        patch: {
          ...(baselineGrowth === undefined ? {} : { realGrowthAnnualPct: Number((baselineGrowth - profile.economicDisruptionPct * 0.08).toFixed(2)) }),
          ...(baselineInflation === undefined ? {} : { inflationAnnualPct: Number((baselineInflation + profile.economicDisruptionPct * 0.02).toFixed(2)) }),
        },
        reason: `La zone de guerre « ${zone.name} » perturbe temporairement l'activité et les approvisionnements.`,
        visibility: 'public',
      });
  }
  for (const theaterId of zone.theaterIds) {
      const baselineSupply = zone.baselineSupplyCoverageMonths[theaterId];
      if (baselineSupply === undefined) continue;
      effects.push({
        kind: 'military_theater_patch',
        theaterId,
        patch: { supplyCoverageMonths: Number((baselineSupply * zone.supplyMultiplier).toFixed(2)) },
        reason: `Ravitaillement dégradé dans la zone de guerre « ${zone.name} ».`,
        visibility: 'player',
      });
  }
  return effects;
}

function restorationEffects(zone: WarZone): WorldEffect[] {
  const effects: WorldEffect[] = [];
  for (const [countryId, value] of Object.entries(zone.baselineGrowthAnnualPct)) {
    const inflation = zone.baselineInflationAnnualPct[countryId as CountryId];
    effects.push({
      kind: 'macro_patch',
      countryId: countryId as CountryId,
      patch: {
        realGrowthAnnualPct: value,
        ...(inflation === undefined ? {} : { inflationAnnualPct: inflation }),
      },
      reason: `Les effets macroéconomiques temporaires de « ${zone.name} » sont retirés après sa résolution.`,
      visibility: 'public',
    });
  }
  for (const [theaterId, value] of Object.entries(zone.baselineSupplyCoverageMonths)) {
    effects.push({
      kind: 'military_theater_patch',
      theaterId,
      patch: { supplyCoverageMonths: value },
      reason: `Le ravitaillement revient à son niveau de référence après « ${zone.name} ».`,
      visibility: 'player',
    });
  }
  return effects;
}

/**
 * Revue mensuelle des conflits : au plus une zone par dossier, puis une seule
 * action d'impact par zone. Les conflits ne consomment donc pas la file des
 * événements mineurs et peuvent évoluer indépendamment des autres dossiers.
 */
export function advanceWarZones(state: WorldState): WorldState {
  let next = state;
  const dossiers = Object.values(state.strategicDossiers ?? {});

  for (const dossier of dossiers) {
    if (dossier.kind !== 'conflict' || dossier.status === 'emerging') continue;
    const id = `war-zone-${dossier.id}`;
    if (!next.warZones?.[id]) {
      const zone = createWarZoneForDossier(next, dossier);
      if (!zone) continue;
      next = commitWorldAction(next, {
        kind: 'defense',
        actorId: zone.countryIds[0],
        targetIds: zone.countryIds.slice(1),
        origin: 'time',
        intent: `Structurer la zone de guerre « ${zone.name} »`,
        effects: [{ kind: 'war_zone_add', warZone: zone, reason: 'Un dossier de conflit actif atteint une maille opérationnelle territoriale.', visibility: 'public' }],
      });
    }
  }

  for (const zone of Object.values(next.warZones ?? {})) {
    const dossier = zone.dossierId ? next.strategicDossiers?.[zone.dossierId] : undefined;
    if (zone.status === 'resolved') continue;
    if (dossier?.status === 'resolved') {
      next = commitWorldAction(next, {
        kind: 'defense', actorId: zone.countryIds[0], targetIds: zone.countryIds.slice(1), origin: 'time',
        intent: `Clore la zone de guerre « ${zone.name} »`,
        effects: [
          { kind: 'war_zone_patch', warZoneId: zone.id, patch: { status: 'resolved', updatedAt: next.currentDate }, reason: 'Le dossier de conflit associé est résolu.', visibility: 'public' },
          ...restorationEffects(zone),
        ],
      });
      continue;
    }

    const desiredIntensity = dossier ? dossierIntensity(dossier) : zone.intensity;
    const desiredProfile = PROFILE[desiredIntensity];
    const patch = {
      ...(desiredIntensity === zone.intensity ? {} : { intensity: desiredIntensity }),
      economicDisruptionPct: desiredProfile.economicDisruptionPct,
      supplyMultiplier: desiredProfile.supplyMultiplier,
      updatedAt: next.currentDate,
    };
    next = commitWorldAction(next, {
      kind: 'defense', actorId: zone.countryIds[0], targetIds: zone.countryIds.slice(1), origin: 'time',
      intent: `Actualiser la zone de guerre « ${zone.name} »`,
      effects: [
        { kind: 'war_zone_patch', warZoneId: zone.id, patch, reason: 'La tension du dossier est réévaluée à la frontière mensuelle.', visibility: 'public' },
        ...impactEffects({ ...zone, ...patch }),
      ],
    });
  }
  return next;
}
