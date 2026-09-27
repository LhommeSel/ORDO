import { energyBalance } from './energy';
import { strategicSectorLabels } from './industrial-inputs';
import { commitWorldAction } from './ledger';
import { seededUnit } from './random';
import { regionForCountry } from './ai/world-attention';
import type { CountryId, WorldEffect, WorldState } from './types';

export type MinorEvent = { family: string; countryId: CountryId; title: string };

type MinorEventCandidate = {
  family: string;
  title: string;
  summary: string;
  effects: WorldEffect[];
};

const cooldownMonths = 6;

function monthsBetween(from: string, to: string) {
  const a = new Date(`${from}T12:00:00Z`); const b = new Date(`${to}T12:00:00Z`);
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth());
}

function wasRecentlyUsed(state: WorldState, countryId: CountryId, family: string) {
  return state.actions.some((action) => action.actorId === countryId
    && action.metadata?.minorEventFamily === family
    && monthsBetween(action.createdAt, state.currentDate) < cooldownMonths);
}

function relationTarget(state: WorldState, countryId: CountryId) {
  return Object.values(state.relations)
    .filter((relation) => relation.from === countryId || relation.to === countryId)
    .map((relation) => relation.from === countryId ? relation.to : relation.from)
    .find((targetId) => targetId !== state.playerCountryId && state.countries[targetId]);
}

function candidate(
  state: WorldState,
  countryId: CountryId,
  salt: string,
  excludedFamilies: Set<string> = new Set(),
): MinorEventCandidate | null {
  const country = state.countries[countryId];
  const macro = state.macroEconomies[countryId];
  const energy = state.countryEnergy[countryId];
  if (!country) return null;
  if (energy) {
    for (const resource of ['oil', 'gas'] as const) {
      if (excludedFamilies.has(`reserve-${resource}`)) continue;
      const balance = energyBalance(state, countryId, resource);
      if (balance && balance.coverageMonths < energy.desiredCoverageMonths[resource] * 0.78
        && energy.strategicStocks[resource] < energy.storageCapacity[resource]) {
        const amount = Math.min(energy.storageCapacity[resource] - energy.strategicStocks[resource], Math.max(0.2, energy.annualDemand[resource] * 0.015));
        return {
          family: `reserve-${resource}`,
          title: `${country.name} renforce discrètement ses stocks de ${resource === 'oil' ? 'pétrole' : 'gaz'}`,
          summary: `Une couverture énergétique jugée trop faible conduit ${country.name} à reconstituer une réserve préventive.`,
          effects: [{ kind: 'energy_stock_delta', countryId, resource, delta: Number(amount.toFixed(3)), reason: 'Un approvisionnement préventif répond à une couverture énergétique insuffisante.' }],
        };
      }
    }
  }
  const vulnerableSector = Object.values(state.sectors)
    .filter((sector) => sector.countryId === countryId && (sector.health < 58 || sector.foreignDependency > 75))
    .sort((a, b) => (a.health - a.foreignDependency) - (b.health - b.foreignDependency))[0];
  if (vulnerableSector && !excludedFamilies.has(`industry-${vulnerableSector.sector}`)) {
    const sectorLabel = strategicSectorLabels[vulnerableSector.sector] ?? vulnerableSector.sector;
    return {
      family: `industry-${vulnerableSector.sector}`,
      title: `${country.name} soutient la filière ${sectorLabel}`,
      summary: `Une mesure de maintenance limite une fragilité identifiée dans cette filière, sans changer la trajectoire industrielle du pays.`,
      effects: [{ kind: 'sector_patch', sectorId: vulnerableSector.id, patch: { health: Math.min(100, vulnerableSector.health + 0.8), workloadMonths: vulnerableSector.workloadMonths + 1 }, reason: 'Une mesure de maintenance industrielle limite une fragilité devenue visible.' }],
    };
  }
  const targetId = relationTarget(state, countryId);
  if (targetId && !excludedFamilies.has('diplomatic-contact')) {
    const direction = seededUnit(state.seed, `${salt}:${countryId}:relation`) > 0.42 ? 1 : -1;
    return {
      family: 'diplomatic-contact',
      title: `${country.name} ajuste son canal avec ${state.countries[targetId]?.name ?? targetId}`,
      summary: `Des consultations techniques modifient légèrement le climat bilatéral, sans ouvrir de négociation formelle.`,
      effects: [{ kind: 'relation_delta', from: countryId, to: targetId, relation: direction, trust: direction, reason: direction > 0 ? 'Des consultations techniques améliorent légèrement le climat bilatéral.' : 'Un désaccord de méthode dégrade légèrement le climat bilatéral.' }],
    };
  }
  if (macro && !excludedFamilies.has('fiscal-adjustment') && (macro.publicDebtPctGdp > 75 || macro.fiscalBalancePctGdp < -4)) {
    return {
      family: 'fiscal-adjustment',
      title: `${country.name} réexamine une dépense publique secondaire`,
      summary: `Une économie administrative desserre marginalement la contrainte budgétaire, avec une friction sociale limitée.`,
      effects: [
        { kind: 'fiscal_delta', countryId, bucket: 'discretionary', delta: 0.18, reason: 'Une économie administrative mineure desserre la contrainte budgétaire.' },
        { kind: 'metric_delta', countryId, metric: 'stability', delta: -0.12, reason: 'La mesure d’économie provoque une friction sociale limitée.' },
      ],
    };
  }
  if (excludedFamilies.has('administrative-review')) return null;
  return {
    family: 'administrative-review',
    title: `${country.name} réévalue une priorité administrative`,
    summary: `Une revue interne réalloue une part limitée des moyens disponibles.`,
    effects: [{ kind: 'fiscal_delta', countryId, bucket: 'discretionary', delta: 0.05, reason: 'Une revue administrative réalloue marginalement les moyens disponibles.' }],
  };
}

/**
 * Génère peu d'événements visibles, répartis entre plusieurs pays et familles.
 * Les effets restent petits et entièrement déterministes : aucune dépense IA.
 */
export function runMinorEventCycle(state: WorldState, count = 3): { state: WorldState; events: MinorEvent[] } {
  const countries = Object.values(state.countries)
    .filter((country) => country.id !== state.playerCountryId)
    .sort((a, b) => seededUnit(state.seed, `${state.currentDate}:${a.id}`) - seededUnit(state.seed, `${state.currentDate}:${b.id}`));
  const usedRegions = new Set<string>();
  const usedFamilies = new Set<string>();
  let next = state;
  const events: MinorEvent[] = [];
  for (const country of countries) {
    if (events.length >= count) break;
    const event = candidate(
      next,
      country.id,
      `${next.currentDate}:${events.length}`,
      usedFamilies,
    );
    if (!event || wasRecentlyUsed(next, country.id, event.family)) continue;
    // Espacer les événements : un même passage ne doit pas se réduire à trois
    // pays voisins si d'autres régions ont une opportunité équivalente.
    const regionHint = regionForCountry(country.id);
    if (usedRegions.has(regionHint) && countries.length > count * 2) continue;
    usedRegions.add(regionHint);
    // Une tournée donne une image du monde, pas trois variantes d'une même
    // mesure. Lorsqu'un thème est déjà apparu, candidate() cherche le levier
    // suivant du pays avant de le laisser de côté.
    usedFamilies.add(event.family);
    next = commitWorldAction(next, {
      kind: event.family.startsWith('reserve') ? 'economic' : event.family.startsWith('industry') ? 'industrial' : event.family === 'diplomatic-contact' ? 'diplomatic' : 'political',
      actorId: country.id,
      origin: 'local_rule',
      visibility: 'public',
      intent: event.title,
      metadata: { minorEventFamily: event.family, minorEvent: true },
      // Une micro-mesure autonome modifie bien le monde, mais n'est ni une
      // actualité ni un dossier. L'exposer dans la carte noyait les vraies
      // transformations politiques derrière des gestes administratifs.
      effects: event.effects,
    });
    events.push({ family: event.family, countryId: country.id, title: event.title });
  }
  return { state: next, events };
}
