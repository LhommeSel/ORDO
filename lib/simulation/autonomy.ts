import { activateEnergyContract, energyBalance, producerNodes, proposeEnergyContract } from './energy';
import { commitWorldAction } from './ledger';
import type { CountryId, ISODate, WorldState } from './types';

const daysBetween = (a: ISODate, b: ISODate) => Math.max(0, Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000));

export function strategicAttentionScore(state: WorldState, countryId: CountryId) {
  const country = state.countries[countryId];
  if (!country) return 0;
  const daysSinceReview = daysBetween(country.strategy.lastReviewDate, state.currentDate);
  const capacityPressure = Object.values(country.capacities).reduce((sum, item) => sum + item.committed / item.maximum, 0) / 6;
  const vulnerabilityPressure = country.strategy.vulnerabilities.length * 3;
  const energyPressure = (['oil', 'gas'] as const).reduce((sum, resource) => {
    const balance = energyBalance(state, countryId, resource);
    return sum + (balance?.deficit ?? 0) * 0.12;
  }, 0);
  const playerInteraction = Object.values(state.relations).some((relation) =>
    relation.from === state.playerCountryId && relation.to === countryId && relation.memories.length > 0,
  ) ? 12 : 0;
  return country.weight * 0.42 + Math.min(25, daysSinceReview / 12) + vulnerabilityPressure + energyPressure + playerInteraction + capacityPressure * 8;
}

function reviewEnergy(state: WorldState, countryId: CountryId) {
  let next = state;
  for (const resource of ['oil', 'gas'] as const) {
    const balance = energyBalance(next, countryId, resource);
    if (!balance || balance.deficit < Math.max(5, next.countryEnergy[countryId]?.annualDemand[resource] * 0.08)) continue;
    const supplier = producerNodes(next, resource).find(({ node, available }) => node.countryId !== countryId && available >= Math.min(balance.deficit, 18));
    if (!supplier) continue;
    const volume = Math.min(balance.deficit, supplier.available, 18);
    const id = `auto-${countryId}-${supplier.node.countryId}-${resource}-${next.currentDate}`;
    if (next.energyContracts[id]) continue;
    const proposed = proposeEnergyContract(next, {
      id, nodeId: supplier.node.id, buyerId: countryId, annualVolume: Number(volume.toFixed(2)),
      startDate: next.currentDate, endDate: `${Number(next.currentDate.slice(0, 4)) + 4}${next.currentDate.slice(4)}` as ISODate,
      priceFormula: 'Indice régional + prime de sécurité', route: supplier.node.infrastructure[0] ?? 'Route maritime',
      politicalClauses: ['Consultation annuelle sur la sécurité des approvisionnements'], breachPenalty: volume * 1.5,
      origin: 'local_rule',
    });
    if (!proposed.ok) continue;
    const activated = activateEnergyContract(proposed.state, id, countryId, 'local_rule');
    if (activated.ok) next = activated.state;
  }
  return next;
}

function reviewStrategicIndustry(state: WorldState, countryId: CountryId) {
  const vulnerable = Object.values(state.sectors)
    .filter((sector) =>
      sector.countryId === countryId
      && sector.workloadMonths < 12
      && (sector.foreignDependency >= 70 || sector.health <= 45),
    )
    .sort((a, b) => (b.foreignDependency - b.health) - (a.foreignDependency - a.health))[0];
  if (!vulnerable) return state;
  const country = state.countries[countryId];
  if (!country || country.metrics.budget < 4) return state;
  return commitWorldAction(state, {
    kind: 'industrial', actorId: countryId, origin: 'local_rule',
    intent: `Réduire la vulnérabilité de la filière ${vulnerable.sector}`,
    effects: [
      { kind: 'metric_delta', countryId, metric: 'budget', delta: -3, reason: 'Le programme industriel engage des crédits publics et des garanties.' },
      { kind: 'capacity_commitment', countryId, domain: 'economy', delta: 4, reason: 'La conception du programme mobilise les services économiques.' },
      { kind: 'sector_patch', sectorId: vulnerable.id, patch: { workloadMonths: vulnerable.workloadMonths + 24, capacity: Math.min(100, vulnerable.capacity + 3), technology: Math.min(100, vulnerable.technology + 1), health: Math.min(100, vulnerable.health + 2) }, reason: 'Le pays lance un programme pluriannuel de consolidation de la filière.' },
    ],
  });
}

export function reviewCountryStrategy(state: WorldState, countryId: CountryId) {
  if (countryId === state.playerCountryId) return state;
  let next = reviewEnergy(state, countryId);
  next = reviewStrategicIndustry(next, countryId);
  return commitWorldAction(next, {
    kind: 'political', actorId: countryId, origin: 'local_rule', intent: 'Révision périodique de la stratégie nationale',
    visibility: 'debug',
    effects: [{ kind: 'country_strategy_patch', countryId, patch: { lastReviewDate: next.currentDate }, reason: 'Le gouvernement actualise ses priorités à partir de la situation observée.', visibility: 'debug' }],
  });
}

export function runAutonomyCycle(state: WorldState, reviews = 4) {
  const selected = Object.keys(state.countries)
    .filter((countryId) => countryId !== state.playerCountryId)
    .map((countryId) => ({ countryId, score: strategicAttentionScore(state, countryId) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, reviews);
  let next = state;
  for (const { countryId } of selected) next = reviewCountryStrategy(next, countryId);
  return { state: next, reviewedCountryIds: selected.map((item) => item.countryId) };
}
