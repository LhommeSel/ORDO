import { activateEnergyContract, energyBalance, nodeBookedVolume, nodeExpansionPotential, producerNodes, proposeEnergyContract } from './energy';
import { commitWorldAction } from './ledger';
import { selectStrategicAction } from './decision-making';
import type { CountryId, DecisionSignal, EconomicShock, ISODate, StrategicActionCandidate, StrategicDossier, WorldEffect, WorldState } from './types';

const daysBetween = (a: ISODate, b: ISODate) => Math.max(0, Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000));

/** Un choc suffisamment sérieux donne la priorité aux pays qu'il atteint. */
function activeCrisisFor(state: WorldState, countryId: CountryId): EconomicShock | undefined {
  return state.worldEconomy.activeShocks
    .filter((shock) => Math.abs(shock.intensity) >= 55
      && (shock.affectedCountryIds.length === 0 || shock.affectedCountryIds.includes(countryId)))
    .sort((left, right) => Math.abs(right.intensity) - Math.abs(left.intensity)
      || right.remainingMonths - left.remainingMonths)[0];
}

function autonomousCrisisDossier(state: WorldState, buyerId: CountryId, sellerId: CountryId, shock: EconomicShock, focus: 'energy' | 'trade', resource?: 'oil' | 'gas'): StrategicDossier | null {
  // Un même choc et un même acheteur ne doivent pas ouvrir un dossier par
  // fournisseur : les contrats successifs restent dans le registre énergétique
  // tandis que le dossier conserve la crise diplomatique de fond.
  const id = `autonomous-crisis-${shock.id}-${buyerId}`;
  if (state.strategicDossiers[id]) return null;
  const buyer = state.countries[buyerId];
  const seller = state.countries[sellerId];
  if (!buyer || !seller) return null;
  const playerInvolved = buyerId === state.playerCountryId || sellerId === state.playerCountryId;
  const importance = Math.abs(shock.intensity) >= 70 ? 'major' : 'moderate';
  const resourceLabel = resource ? resource === 'gas' ? 'gaz' : 'pétrole' : 'des débouchés commerciaux';
  const focusLabel = focus === 'energy' ? 'Coordination énergétique' : 'Coordination commerciale';
  const summary = focus === 'energy'
    ? `La crise « ${shock.label} » pousse ${buyer.name} à sécuriser du ${resourceLabel} auprès de ${seller.name}. Les volumes et la dépendance créent un enjeu diplomatique durable.`
    : `La crise « ${shock.label} » pousse ${buyer.name} à consulter ${seller.name} pour préserver ${resourceLabel}. Les flux croisés créent un enjeu diplomatique durable.`;
  return {
    id, title: `${focusLabel} · ${buyer.name}–${seller.name}`, kind: 'cooperation', status: 'active', importance,
    sourceShockId: shock.id,
    scope: playerInvolved ? 'player_involved' : 'world', actorIds: [buyerId, sellerId], regionTags: [], startedAt: state.currentDate,
    updatedAt: state.currentDate, phase: 'Sécurisation des approvisionnements', trend: 'escalating', publicSummary: summary,
    followed: playerInvolved, autoTracked: true, commitments: [focus === 'energy' ? `Contrat autonome de ${resourceLabel} à formaliser avec ${seller.name}.` : `Consultation commerciale autonome à formaliser avec ${seller.name}.`],
    pendingDecisions: playerInvolved && importance === 'major' ? ['Décider si la sécurisation énergétique doit devenir un engagement diplomatique plus large.'] : [],
    relatedCurrentIds: [], relatedActionIds: [], entries: [{
      id: `${id}-${state.currentDate}`, date: state.currentDate, title: 'Ouverture du dossier diplomatique', summary,
      importance, actorIds: [buyerId, sellerId], requiresDecision: playerInvolved && importance === 'major', visibility: 'player',
    }],
  };
}

function largestTradePartner(state: WorldState, countryId: CountryId) {
  return Object.values(state.tradeFlows)
    .filter((flow) => flow.exporterId === countryId || flow.importerId === countryId)
    .map((flow) => ({ countryId: flow.exporterId === countryId ? flow.importerId : flow.exporterId, value: flow.annualValueBillion2000Usd }))
    .sort((left, right) => right.value - left.value)
    .find((item) => Boolean(state.countries[item.countryId]))?.countryId;
}

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
  const crisisPressure = state.worldEconomy.activeShocks
    .filter((shock) => shock.affectedCountryIds.length === 0 || shock.affectedCountryIds.includes(countryId))
    .reduce((sum, shock) => sum + Math.abs(shock.intensity) * (shock.affectedCountryIds.length > 0 ? 0.45 : 0.12), 0);
  return country.weight * 0.42 + Math.min(25, daysSinceReview / 12) + vulnerabilityPressure + energyPressure + playerInteraction + capacityPressure * 8 + Math.min(30, crisisPressure);
}

function reviewEnergy(state: WorldState, countryId: CountryId) {
  let next = state;
  for (const resource of ['oil', 'gas'] as const) {
    const balance = energyBalance(next, countryId, resource);
    const energy = next.countryEnergy[countryId];
    if (!balance || !energy) continue;
    const demand = next.countryEnergy[countryId]?.annualDemand[resource] ?? 1;
    const targetMonths = energy.desiredCoverageMonths[resource];
    const stockGapAnnualized = Math.max(0, (targetMonths - balance.coverageMonths) / 12 * demand);
    const urgentDeficit = balance.deficit >= Math.max(5, demand * 0.08);
    const weakReserve = balance.coverageMonths < targetMonths * 0.7;
    if (!urgentDeficit && !weakReserve) continue;
    const suppliers = producerNodes(next, resource)
      .filter(({ node, available }) => node.countryId !== countryId && available >= Math.min(balance.deficit, 18))
      .slice(0, 5);
    const candidates: StrategicActionCandidate[] = suppliers.map((supplier) => {
      const partner = next.countries[countryId].strategy.partners.includes(supplier.node.countryId);
      const rival = next.countries[countryId].strategy.rivals.includes(supplier.node.countryId);
      const signals: DecisionSignal[] = ['foreign_dependency'];
      if (partner) signals.push('alliance_cooperation');
      if (rival) signals.push('rival_dependency');
      return {
        id: `secure-${resource}-${supplier.node.countryId}`, actorId: countryId,
        label: `Sécuriser du ${resource === 'oil' ? 'pétrole' : 'gaz'} auprès de ${supplier.node.countryId}`,
        kind: 'energy', signals,
        outcomes: {
          growth: 18, employment: 8, price_stability: 28, fiscal_sustainability: -6,
          strategic_autonomy: rival ? -48 : -18, alliance_cohesion: partner ? 34 : rival ? -42 : 4,
          social_cohesion: 12, regime_survival: 8,
        },
        requiredAuthority: 'executive', publicSalience: 32, administrativeComplexity: 24,
        urgency: Math.min(98, 35 + balance.deficit / demand * 160), risk: rival ? 72 : partner ? 18 : 36,
        resourceCost: 8,
        metadata: { nodeId: supplier.node.id, supplierId: supplier.node.countryId, available: supplier.available },
      };
    });
    const selected = selectStrategicAction(next, candidates, `energy:${resource}:${next.currentDate}`);
    if (!selected) continue;
    const supplier = suppliers.find((item) => item.node.id === selected.candidate.metadata?.nodeId);
    if (!supplier) continue;
    const volume = Math.min(Math.max(balance.deficit, stockGapAnnualized), supplier.available, Math.max(4, demand * 0.18), 18);
    const id = `auto-${countryId}-${supplier.node.countryId}-${resource}-${next.currentDate}`;
    if (next.energyContracts[id]) continue;
    next = commitWorldAction(next, {
      kind: 'political', actorId: countryId, origin: 'local_rule', visibility: 'debug',
      intent: `Arbitrer l’approvisionnement en ${resource}`,
      effects: [], metadata: { selectedCandidate: selected.candidate.id, evaluation: selected.evaluation },
    });
    const proposed = proposeEnergyContract(next, {
      id, nodeId: supplier.node.id, buyerId: countryId, annualVolume: Number(volume.toFixed(2)),
      startDate: next.currentDate, endDate: `${Number(next.currentDate.slice(0, 4)) + 4}${next.currentDate.slice(4)}` as ISODate,
      priceFormula: 'Indice régional + prime de sécurité', route: supplier.node.infrastructure[0] ?? 'Route maritime',
      politicalClauses: ['Consultation annuelle sur la sécurité des approvisionnements'], breachPenalty: volume * 1.5,
      origin: 'local_rule',
    });
    if (!proposed.ok) continue;
    const activated = activateEnergyContract(proposed.state, id, countryId, 'local_rule');
    if (activated.ok) {
      next = activated.state;
      const crisis = activeCrisisFor(next, countryId);
      const sellerId = next.energyContracts[id]?.sellerId;
      if (crisis && sellerId) {
        const dossier = autonomousCrisisDossier(next, countryId, sellerId, crisis, 'energy', resource);
        if (dossier) next = commitWorldAction(next, {
          kind: 'diplomatic', actorId: countryId, targetIds: [sellerId], origin: 'local_rule', visibility: 'player',
          intent: `Ouvrir un dossier diplomatique sur la crise énergétique avec ${sellerId}`,
          effects: [{ kind: 'dossier_add', dossier, reason: 'Une réponse autonome à une crise énergétique ouvre un suivi diplomatique lorsque les intérêts d’approvisionnement se croisent.', visibility: 'player' }],
        });
      }
    }
  }
  // Un producteur proche de la saturation ne « vend » pas sans fin : il ouvre
  // une revue d'expansion, visible dans le registre, avant toute hausse future.
  for (const { node } of producerNodes(next, 'oil').concat(producerNodes(next, 'gas'))) {
    if (node.countryId !== countryId) continue;
    const capacity = Math.max(1, Math.min(node.annualProduction, node.annualCapacity) - node.domesticConsumption);
    const pressure = nodeBookedVolume(next, node.id) / capacity;
    if (pressure < 0.88) continue;
    const id = `capacity-review-${node.id}-${next.currentDate}`;
    if (next.actions.some((action) => action.intent === id)) continue;
    next = commitWorldAction(next, {
      kind: 'energy', actorId: countryId, origin: 'local_rule', visibility: 'debug', intent: id,
      effects: [], metadata: { nodeId: node.id, booked: nodeBookedVolume(next, node.id), physicalCapacity: capacity, expansionPotential: nodeExpansionPotential(next, node.id) },
    });
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
  const urgency = Math.min(95, 30 + vulnerable.foreignDependency * 0.45 + Math.max(0, 55 - vulnerable.health) * 0.8);
  const candidate: StrategicActionCandidate = {
    id: `industry-${vulnerable.id}`, actorId: countryId,
    label: `Consolider la filière ${vulnerable.sector}`, kind: 'industrial',
    outcomes: {
      growth: 26, employment: 22, price_stability: 3, fiscal_sustainability: -24,
      strategic_autonomy: 62, social_cohesion: 12, regime_survival: 8, elite_support: 14,
      international_prestige: 18,
    },
    signals: ['strategic_autonomy', 'state_control', 'deficit_spending'],
    requiredAuthority: 'executive', publicSalience: 46, administrativeComplexity: 58,
    urgency, risk: 34, resourceCost: 42,
  };
  const selected = selectStrategicAction(state, [candidate], `industry:${vulnerable.id}:${state.currentDate}`);
  if (!selected) return state;
  return commitWorldAction(state, {
    kind: 'industrial', actorId: countryId, origin: 'local_rule',
    intent: `Réduire la vulnérabilité de la filière ${vulnerable.sector}`,
    effects: [
      { kind: 'metric_delta', countryId, metric: 'budget', delta: -3, reason: 'Le programme industriel engage des crédits publics et des garanties.' },
      { kind: 'capacity_commitment', countryId, domain: 'economy', delta: 4, reason: 'La conception du programme mobilise les services économiques.' },
      { kind: 'sector_patch', sectorId: vulnerable.id, patch: { workloadMonths: vulnerable.workloadMonths + 24, capacity: Math.min(100, vulnerable.capacity + 3), technology: Math.min(100, vulnerable.technology + 1), health: Math.min(100, vulnerable.health + 2) }, reason: 'Le pays lance un programme pluriannuel de consolidation de la filière.' },
    ],
    metadata: { selectedCandidate: selected.candidate.id, evaluation: selected.evaluation },
  });
}

/** Réponse bornée pour les crises non énergétiques : une seule mesure par
 * pays et par choc, soumise à la doctrine et aux capacités existantes. */
function reviewCrisisChannels(state: WorldState, countryId: CountryId) {
  const crisis = activeCrisisFor(state, countryId);
  if (!crisis || crisis.channel === 'energy') return state;
  const alreadyResponded = state.actions.some((action) => action.actorId === countryId && action.metadata?.crisisResponse === crisis.id);
  if (alreadyResponded) return state;
  const partnerId = crisis.channel === 'trade' ? largestTradePartner(state, countryId) : undefined;
  const common = {
    actorId: countryId, label: '', kind: 'economic' as const, signals: [] as DecisionSignal[],
    outcomes: { growth: 20, employment: 14, fiscal_sustainability: -12, social_cohesion: 10, regime_survival: 8 },
    requiredAuthority: 'executive' as const, publicSalience: 48, administrativeComplexity: 38,
    urgency: Math.min(96, 36 + Math.abs(crisis.intensity) * 0.65), risk: 40, resourceCost: 24,
  };
  const candidate: StrategicActionCandidate = crisis.channel === 'financial' || crisis.channel === 'demand'
    ? { ...common, id: `crisis-response-${crisis.id}`, label: 'Stabiliser le crédit et soutenir la demande', signals: ['deficit_spending', 'redistribution'], outcomes: { ...common.outcomes, growth: 28, employment: 24, fiscal_sustainability: -25 }, risk: 52 }
    : crisis.channel === 'trade'
      ? { ...common, id: `crisis-response-${crisis.id}`, label: 'Diversifier les débouchés commerciaux', signals: ['commercial_deal', 'strategic_autonomy'], outcomes: { ...common.outcomes, growth: 24, international_prestige: 10 } }
      : crisis.channel === 'supply'
        ? { ...common, id: `crisis-response-${crisis.id}`, label: 'Protéger les capacités productives', signals: ['strategic_autonomy', 'state_control'], outcomes: { ...common.outcomes, growth: 22, strategic_autonomy: 30, fiscal_sustainability: -18 } }
        : { ...common, id: `crisis-response-${crisis.id}`, label: 'Rétablir la confiance économique', signals: ['redistribution', 'commercial_deal'], outcomes: { ...common.outcomes, growth: 16, social_cohesion: 24 } };
  const selected = selectStrategicAction(state, [candidate], `crisis-response:${countryId}:${crisis.id}`);
  if (!selected) return state;
  const patch = crisis.channel === 'financial' || crisis.channel === 'demand'
    ? { fiscalStance: 8, publicInvestmentPctGdp: 0.15 }
    : crisis.channel === 'trade' ? { tradeOpenness: 2.5 } : crisis.channel === 'supply' ? { industrialSupport: 2 } : { socialProtection: 1.5 };
  const effects: WorldEffect[] = [{ kind: 'macro_policy_delta', countryId, patch, reason: `Le pays ajuste sa politique pour absorber le choc ${crisis.channel}.` }];
  if (partnerId && Math.abs(crisis.intensity) >= 65) {
    const dossier = autonomousCrisisDossier(state, countryId, partnerId, crisis, 'trade');
    if (dossier) effects.push({ kind: 'dossier_add', dossier, reason: 'Une crise commerciale sévère transforme la recherche de débouchés en coordination diplomatique suivie.', visibility: 'player' });
  }
  return commitWorldAction(state, {
    kind: partnerId ? 'diplomatic' : 'economic', actorId: countryId, targetIds: partnerId ? [partnerId] : [], origin: 'local_rule', visibility: 'player',
    intent: `Réponse autonome au choc économique « ${crisis.label} »`, metadata: { crisisResponse: crisis.id, selectedCandidate: selected.candidate.id, evaluation: selected.evaluation }, effects,
  });
}

export function reviewCountryStrategy(state: WorldState, countryId: CountryId) {
  if (countryId === state.playerCountryId) return state;
  let next = reviewEnergy(state, countryId);
  next = reviewStrategicIndustry(next, countryId);
  next = reviewCrisisChannels(next, countryId);
  return commitWorldAction(next, {
    kind: 'political', actorId: countryId, origin: 'local_rule', intent: 'Révision périodique de la stratégie nationale',
    visibility: 'debug',
    effects: [{ kind: 'country_strategy_patch', countryId, patch: { lastReviewDate: next.currentDate }, reason: 'Le gouvernement actualise ses priorités à partir de la situation observée.', visibility: 'debug' }],
  });
}

export function runAutonomyCycle(state: WorldState, reviews = 4) {
  const crisisCountries = new Set(state.worldEconomy.activeShocks
    .filter((shock) => Math.abs(shock.intensity) >= 55 && shock.affectedCountryIds.length > 0)
    .flatMap((shock) => shock.affectedCountryIds));
  const selected = Object.keys(state.countries)
    .filter((countryId) => countryId !== state.playerCountryId)
    .map((countryId) => ({ countryId, score: strategicAttentionScore(state, countryId) }))
    .sort((a, b) => Number(crisisCountries.has(b.countryId)) - Number(crisisCountries.has(a.countryId)) || b.score - a.score)
    .slice(0, reviews);
  let next = state;
  for (const { countryId } of selected) next = reviewCountryStrategy(next, countryId);
  return { state: next, reviewedCountryIds: selected.map((item) => item.countryId) };
}
