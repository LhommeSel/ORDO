import { commitWorldAction } from './ledger';
import type {
  CountryId,
  EnergyContract,
  EnergyNode,
  EnergyResource,
  ISODate,
  ActionOrigin,
  WorldState,
} from './types';

const activeOn = (contract: EnergyContract, date: ISODate) =>
  contract.status === 'active' && contract.startDate <= date && contract.endDate >= date;

export function nodeCommittedVolume(state: WorldState, nodeId: string, date = state.currentDate) {
  return Object.values(state.energyContracts)
    .filter((contract) => contract.nodeId === nodeId && activeOn(contract, date))
    .reduce((sum, contract) => sum + contract.annualVolume, 0);
}

export function nodeAvailableExport(state: WorldState, nodeId: string, date = state.currentDate) {
  const node = state.energyNodes[nodeId];
  if (!node) return 0;
  const exportCapacity = Math.max(0, node.annualCapacity - node.domesticConsumption);
  return Math.max(0, exportCapacity - nodeCommittedVolume(state, nodeId, date));
}

export function energyBalance(state: WorldState, countryId: CountryId, resource: EnergyResource) {
  const energy = state.countryEnergy[countryId];
  if (!energy) return null;
  const contractualImports = Object.values(state.energyContracts)
    .filter((contract) => contract.buyerId === countryId && contract.resource === resource && activeOn(contract, state.currentDate))
    .reduce((sum, contract) => sum + contract.annualVolume, 0);
  const legacyImports = energy.legacyImports?.[resource] ?? 0;
  const imports = legacyImports + contractualImports;
  const exports = Object.values(state.energyContracts)
    .filter((contract) => contract.sellerId === countryId && contract.resource === resource && activeOn(contract, state.currentDate))
    .reduce((sum, contract) => sum + contract.annualVolume, 0);
  const available = energy.domesticProduction[resource] + imports - exports;
  const deficit = Math.max(0, energy.annualDemand[resource] - available);
  const surplus = Math.max(0, available - energy.annualDemand[resource]);
  const coverageMonths = energy.annualDemand[resource] > 0
    ? (energy.strategicStocks[resource] / energy.annualDemand[resource]) * 12
    : 12;
  return { imports, contractualImports, legacyImports, exports, available, deficit, surplus, coverageMonths };
}

export function proposeEnergyContract(
  state: WorldState,
  input: {
    id: string;
    nodeId: string;
    buyerId: CountryId;
    annualVolume: number;
    startDate: ISODate;
    endDate: ISODate;
    priceFormula: string;
    route: string;
    priority?: number;
    politicalClauses?: string[];
    breachPenalty?: number;
    origin?: ActionOrigin;
  },
) {
  const node = state.energyNodes[input.nodeId];
  if (!node) return { ok: false as const, state, error: 'Gisement ou système de production inconnu.' };
  if (!state.countries[input.buyerId]) return { ok: false as const, state, error: 'Pays acheteur inconnu.' };
  if (input.startDate > input.endDate) return { ok: false as const, state, error: 'Période contractuelle invalide.' };
  const available = nodeAvailableExport(state, node.id, input.startDate);
  if (input.annualVolume <= 0 || input.annualVolume > available) {
    return { ok: false as const, state, error: `Volume indisponible : ${available.toFixed(1)} unités/an restent exportables.` };
  }
  const contract: EnergyContract = {
    id: input.id,
    sellerId: node.countryId,
    buyerId: input.buyerId,
    nodeId: node.id,
    resource: node.resource,
    annualVolume: input.annualVolume,
    startDate: input.startDate,
    endDate: input.endDate,
    priceFormula: input.priceFormula,
    route: input.route,
    priority: input.priority ?? 50,
    politicalClauses: input.politicalClauses ?? [],
    breachPenalty: input.breachPenalty ?? 0,
    status: 'proposed',
  };
  const next = commitWorldAction(state, {
    kind: 'energy', actorId: input.buyerId, targetIds: [node.countryId], origin: input.origin ?? 'player',
    intent: `Proposer un contrat de ${node.resource === 'oil' ? 'pétrole' : 'gaz'} à ${node.countryId}`,
    effects: [{ kind: 'energy_contract_add', contract, reason: `Une proposition réserve provisoirement ${input.annualVolume} unités/an dans le dossier de négociation.` }],
  });
  return { ok: true as const, state: next, contract };
}

export function activateEnergyContract(state: WorldState, contractId: string, actorId: CountryId, origin: ActionOrigin = 'player') {
  const contract = state.energyContracts[contractId];
  if (!contract) return { ok: false as const, state, error: 'Contrat inconnu.' };
  const available = nodeAvailableExport(state, contract.nodeId, contract.startDate) + (contract.status === 'active' ? contract.annualVolume : 0);
  if (available < contract.annualVolume) return { ok: false as const, state, error: 'La capacité exportable a été attribuée entre-temps.' };
  const next = commitWorldAction(state, {
    kind: 'energy', actorId, targetIds: [contract.sellerId, contract.buyerId], origin,
    intent: `Activer le contrat énergétique ${contractId}`,
    effects: [
      { kind: 'energy_contract_patch', contractId, patch: { status: 'active' }, reason: 'Les deux gouvernements ratifient le contrat et les volumes deviennent fermes.' },
      { kind: 'relation_delta', from: contract.buyerId, to: contract.sellerId, relation: 2, trust: 1, reason: 'La signature crée une interdépendance énergétique durable.' },
      { kind: 'capacity_commitment', countryId: contract.buyerId, domain: 'economy', delta: 3, reason: 'Le suivi du contrat mobilise l’administration économique.' },
    ],
  });
  return { ok: true as const, state: next };
}

export function advanceEnergySystem(state: WorldState, elapsedMonths: number) {
  let next = state;
  const years = elapsedMonths / 12;
  for (const node of Object.values(state.energyNodes)) {
    const productionAfterDecline = Math.max(0, node.annualProduction * (1 - node.declineRate * years));
    if (Math.abs(productionAfterDecline - node.annualProduction) < 0.001) continue;
    next = commitWorldAction(next, {
      kind: 'energy', actorId: node.countryId, origin: 'time', intent: `Déclin naturel de ${node.label}`,
      visibility: 'debug',
      effects: [{
        kind: 'energy_node_patch', nodeId: node.id,
        patch: { annualProduction: Number(productionAfterDecline.toFixed(3)) },
        reason: 'La production évolue selon le taux de déclin du système extractif.', visibility: 'debug',
      }],
    });
  }

  for (const countryId of Object.keys(next.countryEnergy)) {
    for (const resource of ['oil', 'gas'] as const) {
      const balance = energyBalance(next, countryId, resource);
      if (!balance || balance.deficit <= 0) continue;
      const monthlyDeficit = balance.deficit * (elapsedMonths / 12);
      const stocks = next.countryEnergy[countryId].strategicStocks[resource];
      const draw = Math.min(stocks, monthlyDeficit);
      const uncovered = Math.max(0, monthlyDeficit - draw);
      const effects = [];
      if (draw > 0) effects.push({
        kind: 'energy_stock_delta' as const, countryId, resource, delta: -draw,
        reason: `Les réserves couvrent une partie du déficit de ${resource === 'oil' ? 'pétrole' : 'gaz'}.`,
      });
      if (uncovered > 0 && next.countries[countryId]) {
        effects.push({ kind: 'metric_delta' as const, countryId, metric: 'industry' as const, delta: -Math.min(3, uncovered * 0.08), reason: 'Le déficit énergétique non couvert ralentit l’activité industrielle.' });
        effects.push({ kind: 'metric_delta' as const, countryId, metric: 'stability' as const, delta: -Math.min(2, uncovered * 0.04), reason: 'La pénurie énergétique accroît la tension intérieure.' });
      }
      if (effects.length) next = commitWorldAction(next, {
        kind: 'energy', actorId: countryId, origin: 'time', intent: `Équilibrer les approvisionnements en ${resource}`,
        effects,
      });
    }
  }
  return next;
}

export function producerNodes(state: WorldState, resource: EnergyResource) {
  return Object.values(state.energyNodes)
    .filter((node: EnergyNode) => node.resource === resource)
    .map((node) => ({ node, available: nodeAvailableExport(state, node.id) }))
    .sort((a, b) => b.available - a.available);
}
