import { commitWorldAction } from './ledger';
import type {
  CountryId,
  DossierImpactState,
  DossierPressureChannel,
  DossierPressureSnapshot,
  EconomicShock,
  StrategicDossier,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const importanceWeight = { minor: 0.25, moderate: 0.42, major: 0.66, critical: 1 } as const;
const trendWeight = { escalating: 1, stable: 0.66, deescalating: 0.3 } as const;
const pressureChannelLabels: Record<DossierPressureChannel, string> = {
  demand: 'Demande', supply: 'Offre', financial: 'Finance', trade: 'Commerce', energy: 'Énergie', confidence: 'Confiance',
  security: 'Sécurité', stability: 'Stabilité intérieure', diplomacy: 'Relations diplomatiques',
};

type InternalPressure = DossierPressureSnapshot & {
  shockIntensity?: number;
  metricDelta?: number;
  relationDelta?: number;
};

export type DossierPressureProfile = {
  dossierId: string;
  active: boolean;
  mitigationPct: number;
  pressures: DossierPressureSnapshot[];
  internal: InternalPressure[];
};

function monthsBetween(start: string, end: string) {
  const [startYear, startMonth] = start.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth);
}

function countryActors(state: WorldState, dossier: StrategicDossier): CountryId[] {
  return dossier.actorIds.filter((id): id is CountryId => Boolean(state.countries[id]));
}

function isEligible(dossier: StrategicDossier) {
  if (dossier.status !== 'active' && dossier.status !== 'deescalating') return false;
  if (dossier.sleepingAt) return false;
  return dossier.importance === 'major' || dossier.importance === 'critical' || dossier.followed;
}

/**
 * Une position et des engagements ne suffisent jamais à annuler une crise.
 * Ils amortissent seulement son canal ; le résultat opérationnel d'un programme
 * vaut davantage et finit par vieillir pour éviter un bonus permanent magique.
 */
function mitigationFor(state: WorldState, dossier: StrategicDossier) {
  let mitigation = Math.min(20, dossier.commitments.length * 7);
  if (dossier.playerStance) mitigation += 6;
  for (const program of Object.values(state.actionPrograms ?? {})) {
    if (program.linkedDossierId !== dossier.id) continue;
    if (program.status === 'active') mitigation += 8;
    if (program.status === 'partially_succeeded') mitigation += 8;
    if (program.status === 'succeeded') {
      const age = monthsBetween(program.expectedCompletionAt, state.currentDate);
      mitigation += age <= 6 ? 16 : age <= 18 ? 9 : 4;
    }
    if (program.status === 'failed') mitigation -= 6;
  }
  const anchor = dossier.relatedAnchorId ? state.historicalAnchors[dossier.relatedAnchorId] : undefined;
  if (anchor?.interventionBalance !== undefined) {
    mitigation += Math.min(20, Math.max(0, -anchor.interventionBalance) * 0.8);
    mitigation -= Math.min(10, Math.max(0, anchor.interventionBalance) * 0.35);
  }
  return Math.round(clamp(mitigation, 0, 55));
}

function pressure(
  channel: DossierPressureChannel,
  multiplier: number,
  summary: string,
  strength: number,
  direction: 'pressure' | 'support' = 'pressure',
): InternalPressure {
  const sign = direction === 'pressure' ? 1 : -1;
  const effect = strength * multiplier * sign;
  const isShock = ['demand', 'supply', 'financial', 'trade', 'energy', 'confidence'].includes(channel);
  const levelScale = isShock ? 6.4 : 54;
  return {
    channel,
    level: Math.round(clamp(Math.abs(effect) * levelScale)),
    label: pressureChannelLabels[channel],
    summary,
    direction,
    ...(isShock ? { shockIntensity: Number(effect.toFixed(2)) } : channel === 'diplomacy'
      ? { relationDelta: Number((-effect * 0.55).toFixed(2)) }
      : { metricDelta: Number((-effect * 0.58).toFixed(2)) }),
  };
}

function profileRules(dossier: StrategicDossier, strength: number): InternalPressure[] {
  switch (dossier.kind) {
    case 'economic':
      return [
        pressure('financial', 12, 'Le coût du risque et la prudence des investisseurs se transmettent aux économies concernées.', strength),
        pressure('confidence', 8.5, 'Les ménages et entreprises reportent une partie de leurs décisions.', strength),
      ];
    case 'conflict':
      return [
        pressure('trade', 8, 'Les échanges et routes exposées subissent une friction accrue.', strength),
        pressure('confidence', 8.5, 'L’incertitude stratégique réduit la confiance économique.', strength),
        pressure('security', 0.85, 'Les acteurs du dossier mobilisent davantage leurs appareils de sécurité.', strength),
      ];
    case 'security':
      return [
        pressure('security', 0.82, 'La menace mobilise durablement les capacités de sécurité.', strength),
        pressure('confidence', 6.5, 'Le climat de risque pèse sur les anticipations.', strength),
        pressure('stability', 0.52, 'La tension peut éroder la stabilité politique si elle persiste.', strength),
      ];
    case 'diplomatic_crisis':
      return [
        pressure('trade', 6.5, 'La dégradation politique rend les échanges moins fluides.', strength),
        pressure('confidence', 5.2, 'Les partenaires diffèrent une partie de leurs engagements.', strength),
        pressure('diplomacy', 0.72, 'La confiance entre les parties se dégrade tant que la crise reste ouverte.', strength),
      ];
    case 'cooperation':
      if (dossier.trend === 'escalating') return [
        pressure('trade', 4.6, 'L’échec de la coordination crée une incertitude sur les règles communes.', strength),
        pressure('confidence', 4.2, 'L’absence de compromis retarde les décisions d’investissement.', strength),
      ];
      return [
        pressure('confidence', 3.3, 'La coordination stabilise légèrement les anticipations sans résoudre les fragilités structurelles.', strength * 0.55, 'support'),
        pressure('trade', 2.6, 'Le canal de coopération réduit marginalement les frictions commerciales.', strength * 0.55, 'support'),
      ];
    case 'power_struggle':
      return [
        pressure('stability', 0.8, 'La contestation organisée pèse sur la cohérence de l’appareil d’État.', strength),
        pressure('confidence', 5.5, 'L’incertitude politique fragilise les anticipations des acteurs économiques.', strength),
      ];
    case 'historical':
      return [
        pressure('confidence', 4.2, 'La tendance de fond alimente une prudence progressive avant sa manifestation concrète.', strength),
      ];
    default:
      return [];
  }
}

/** Construit une lecture explicable des effets d'un dossier, sans encore modifier le monde. */
export function dossierPressureProfile(state: WorldState, dossier: StrategicDossier): DossierPressureProfile {
  if (!isEligible(dossier)) return { dossierId: dossier.id, active: false, mitigationPct: 0, pressures: [], internal: [] };
  const mitigationPct = mitigationFor(state, dossier);
  const strength = importanceWeight[dossier.importance] * trendWeight[dossier.trend] * (1 - mitigationPct / 100);
  const internal = profileRules(dossier, strength).filter((item) => item.level > 0);
  return { dossierId: dossier.id, active: internal.length > 0, mitigationPct, pressures: internal.map(({ shockIntensity, metricDelta, relationDelta, ...item }) => item), internal };
}

/**
 * La limite empêche le monde de cumuler artificiellement les pénalités de tous
 * ses dossiers. Les crises critiques passent d'abord ; les modérés doivent être
 * explicitement suivis pour transmettre un effet global.
 */
export function selectDossiersForEffects(state: WorldState, maximum = 4) {
  const rank = { minor: 0, moderate: 1, major: 2, critical: 3 } as const;
  const trendRank = { deescalating: 0, stable: 1, escalating: 2 } as const;
  return Object.values(state.strategicDossiers ?? {})
    .filter(isEligible)
    .sort((a, b) => rank[b.importance] - rank[a.importance]
      || trendRank[b.trend] - trendRank[a.trend]
      || Number(b.pendingDecisions.length > 0) - Number(a.pendingDecisions.length > 0)
      || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, maximum);
}

function impactState(profile: DossierPressureProfile, state: WorldState): DossierImpactState {
  return {
    lastAppliedAt: state.currentDate,
    mitigationPct: profile.mitigationPct,
    pressures: profile.pressures,
  };
}

function shouldNotify(previous: DossierImpactState | undefined, next: DossierImpactState) {
  if (!previous) return true;
  if (Math.abs(previous.mitigationPct - next.mitigationPct) >= 8) return true;
  const signature = (value: DossierImpactState) => value.pressures.map((item) => `${item.channel}:${item.direction}:${item.level}`).join('|');
  return signature(previous) !== signature(next);
}

function shockFor(dossier: StrategicDossier, pressureItem: InternalPressure, affectedCountryIds: CountryId[]): EconomicShock | null {
  if (pressureItem.shockIntensity === undefined || !['demand', 'supply', 'financial', 'trade', 'energy', 'confidence'].includes(pressureItem.channel)) return null;
  return {
    id: `dossier-effect:${dossier.id}:${pressureItem.channel}`,
    label: `${dossier.title} · ${pressureItem.label}`,
    channel: pressureItem.channel as EconomicShock['channel'],
    intensity: pressureItem.shockIntensity,
    remainingMonths: 2.2,
    decayPerMonth: 0.18,
    affectedCountryIds,
    source: 'local_rule',
  };
}

/**
 * Traduit les dossiers actifs en conséquences mesurées à chaque frontière
 * mensuelle. Les canaux économiques suivent ensuite leur transmission normale
 * dans le macro-modèle ; ils ne changent pas directement le PIB.
 */
export function advanceDossierEffects(state: WorldState) {
  const dossiers = selectDossiersForEffects(state);
  if (!dossiers.length) return state;

  const profiles = dossiers.map((dossier) => ({ dossier, profile: dossierPressureProfile(state, dossier), actors: countryActors(state, dossier).slice(0, 4) }))
    .filter((item) => item.profile.active && item.actors.length > 0);
  if (!profiles.length) return state;

  const refreshedIds = new Set(profiles.flatMap(({ dossier, profile }) => profile.internal
    .filter((item) => item.shockIntensity !== undefined).map((item) => `dossier-effect:${dossier.id}:${item.channel}`)));
  const activeShocks = state.worldEconomy.activeShocks.filter((shock) => !refreshedIds.has(shock.id));
  const freshShocks = profiles.flatMap(({ dossier, profile, actors }) => profile.internal.map((item) => shockFor(dossier, item, actors)).filter((item): item is EconomicShock => Boolean(item)));
  const effects: WorldEffect[] = [{
    kind: 'world_economy_patch', patch: { activeShocks: [...activeShocks, ...freshShocks] },
    reason: 'Les pressions actives des dossiers sont injectées dans les canaux économiques puis amorties avec le temps.', visibility: 'debug',
  }];

  for (const { dossier, profile, actors } of profiles) {
    const nextImpact = impactState(profile, state);
    const notify = shouldNotify(dossier.impactState, nextImpact);
    effects.push({
      kind: 'dossier_patch', dossierId: dossier.id,
      patch: { impactState: { ...nextImpact, ...(notify ? { lastNotifiedAt: state.currentDate } : { lastNotifiedAt: dossier.impactState?.lastNotifiedAt }) } },
      reason: 'Le moteur met à jour les conséquences systémiques bornées du dossier.', visibility: 'debug',
    });
    for (const item of profile.internal) {
      if (item.metricDelta === undefined) continue;
      const metric = item.channel === 'security' ? 'security' : 'stability';
      for (const countryId of actors) effects.push({
        kind: 'metric_delta', countryId, metric, delta: item.metricDelta,
        reason: `Pression « ${item.label.toLowerCase()} » du dossier « ${dossier.title} ».`, visibility: 'debug',
      });
    }
    for (const item of profile.internal) {
      if (item.relationDelta === undefined || actors.length < 2) continue;
      const [lead, ...counterparts] = actors;
      for (const counterpart of counterparts.slice(0, 2)) effects.push({
        kind: 'relation_delta', from: lead, to: counterpart, relation: item.relationDelta, trust: item.relationDelta,
        reason: `La crise diplomatique « ${dossier.title} » continue d’éroder la relation entre ses parties.`, visibility: 'debug',
      });
    }
    if (notify) effects.push({
      kind: 'dossier_entry_add', dossierId: dossier.id,
      entry: {
        id: `dossier-impact-${dossier.id}-${state.currentDate}`,
        date: state.currentDate,
        title: 'Conséquences systémiques actualisées',
        summary: profile.mitigationPct
          ? `Le dossier transmet encore des pressions mesurées (${profile.pressures.map((item) => `${item.label.toLowerCase()} ${item.level}/100`).join(' · ')}). Les engagements et actions en cours amortissent actuellement ${profile.mitigationPct}% de cette exposition.`
          : `Le dossier transmet des pressions mesurées (${profile.pressures.map((item) => `${item.label.toLowerCase()} ${item.level}/100`).join(' · ')}). Aucune réponse vérifiable ne les amortit encore.`,
        importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player',
      },
      reason: 'La première apparition ou une évolution matérielle des pressions est ajoutée à la chronologie.', visibility: 'player',
    });
  }

  return commitWorldAction(state, {
    kind: 'historical', actorId: state.playerCountryId,
    targetIds: profiles.flatMap(({ actors }) => actors.filter((id) => id !== state.playerCountryId)),
    origin: 'time', visibility: 'debug',
    intent: 'Actualiser les conséquences des dossiers actifs',
    effects,
    assumptions: ['Maximum de quatre dossiers systémiques par frontière mensuelle.', 'Les effets économiques sont transmis par le macro-modèle, non appliqués directement au PIB.'],
  });
}
