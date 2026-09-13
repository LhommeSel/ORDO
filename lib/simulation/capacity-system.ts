import { commitWorldAction } from './ledger';
import type { CapacityDomainId, CapacityState, WorldState } from './types';

const domains: CapacityDomainId[] = ['government', 'administration', 'diplomacy', 'economy', 'intelligence', 'defense'];
const domainWeights: Record<CapacityDomainId, number> = {
  government: 1, administration: 1.1, diplomacy: 0.8, economy: 0.9, intelligence: 0.7, defense: 1.2,
};
const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export type CapacityLoadLevel = 'available' | 'high' | 'saturated' | 'overloaded';

export function capacityLoad(capacity: CapacityState[CapacityDomainId]) {
  const ratio = capacity.committed / Math.max(1, capacity.maximum);
  const efficiencyPct = capacity.efficiencyPct ?? clamp(100 - Math.max(0, ratio - 0.8) * 120, 35, 100);
  const level: CapacityLoadLevel = ratio > 1 ? 'overloaded' : ratio > 0.9 ? 'saturated' : ratio > 0.75 ? 'high' : 'available';
  return { ratio, efficiencyPct, level, overloadMonths: capacity.overloadMonths ?? 0 };
}

/**
 * Fait vivre la surcharge institutionnelle au fil des frontières mensuelles.
 * Une capacité dépassée ne bloque pas une action : elle dégrade progressivement
 * son efficacité, l'administration et la stabilité, puis se résorbe quand la
 * charge redescend. Les valeurs détaillées restent persistées pour informer le
 * joueur et l'IA sans transformer chaque action en micro-gestion.
 */
export function advanceOperationalCapacities(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  let next = state;
  for (const country of Object.values(state.countries)) {
    const effects: WorldState['actions'][number]['effects'] = [];
    for (const domain of domains) {
      const current = next.countries[country.id]?.capacities[domain];
      if (!current) continue;
      const ratio = current.committed / Math.max(1, current.maximum);
      const previousMonths = current.overloadMonths ?? 0;
      const overloadMonths = ratio > 1
        ? round(previousMonths + elapsedMonths)
        : round(Math.max(0, previousMonths - elapsedMonths * 1.5));
      const efficiencyPct = round(clamp(100 - Math.max(0, ratio - 0.8) * 120, 35, 100));
      const oldEfficiency = current.efficiencyPct ?? 100;
      const changed = Math.abs(oldEfficiency - efficiencyPct) > 0.01 || Math.abs(previousMonths - overloadMonths) > 0.01;
      if (changed) effects.push({
        kind: 'capacity_overload_patch', countryId: country.id, domain,
        patch: { overloadMonths, efficiencyPct, lastOverloadAt: ratio > 1 ? next.currentDate : null },
        reason: ratio > 1
          ? `La charge ${domain} dépasse le plafond depuis ${overloadMonths.toFixed(1)} mois : l'efficacité opérationnelle descend à ${efficiencyPct}%.`
          : `La charge ${domain} revient sous contrôle : l'efficacité remonte à ${efficiencyPct}%.`,
        visibility: country.id === state.playerCountryId ? 'player' : 'debug',
      });
      if (ratio <= 1) continue;
      const excess = ratio - 1;
      const pressure = Math.min(1, excess * 2.5);
      const weight = domainWeights[domain];
      effects.push(
        { kind: 'metric_delta', countryId: country.id, metric: 'stability', delta: -round(0.08 * pressure * weight * elapsedMonths), reason: `La surcharge de ${domain} augmente la désorganisation interne.` , visibility: country.id === state.playerCountryId ? 'player' : 'debug' },
        { kind: 'metric_delta', countryId: country.id, metric: 'budget', delta: -round(0.05 * pressure * weight * elapsedMonths), reason: `La surcharge de ${domain} provoque des coûts de coordination et de rattrapage.`, visibility: country.id === state.playerCountryId ? 'player' : 'debug' },
      );
    }
    if (effects.length) next = commitWorldAction(next, {
      kind: 'institutional', actorId: country.id, origin: 'time', visibility: country.id === state.playerCountryId ? 'player' : 'debug',
      intent: `Évaluer la charge opérationnelle de ${country.name}`, effects,
    });
  }
  return next;
}
