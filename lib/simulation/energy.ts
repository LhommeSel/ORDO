import { commitWorldAction } from './ledger';
import type {
  CountryId,
  BaselineEnergyFlow,
  EnergyContract,
  EnergyNode,
  EnergyResource,
  ISODate,
  ActionOrigin,
  WorldState,
} from './types';

const activeOn = (contract: EnergyContract, date: ISODate) =>
  contract.status === 'active' && contract.startDate <= date && contract.endDate >= date;

const bookedOn = (contract: EnergyContract, date: ISODate) =>
  ['active', 'proposed'].includes(contract.status) && contract.startDate <= date && contract.endDate >= date;

const baselineActiveOn = (flow: BaselineEnergyFlow, date: ISODate) =>
  flow.startDate <= date && flow.endDate >= date;

export function nodePhysicalExportCapacity(state: WorldState, nodeId: string) {
  const node = state.energyNodes[nodeId];
  if (!node) return 0;
  return Math.max(0, Math.min(node.annualProduction, node.annualCapacity) - node.domesticConsumption);
}

export function nodeBookedVolume(state: WorldState, nodeId: string, date = state.currentDate) {
  const baseline = Object.values(state.baselineEnergyFlows ?? {})
    .filter((flow) => flow.sourceNodeId === nodeId && baselineActiveOn(flow, date))
    .reduce((sum, flow) => sum + flow.annualVolume, 0);
  const contracts = Object.values(state.energyContracts)
    .filter((contract) => contract.nodeId === nodeId && bookedOn(contract, date))
    .reduce((sum, contract) => sum + contract.annualVolume, 0);
  return baseline + contracts;
}

export function nodeCommittedVolume(state: WorldState, nodeId: string, date = state.currentDate) {
  return nodeBookedVolume(state, nodeId, date);
}

export function nodeAvailableExport(state: WorldState, nodeId: string, date = state.currentDate) {
  const node = state.energyNodes[nodeId];
  if (!node) return 0;
  return Math.max(0, nodePhysicalExportCapacity(state, nodeId) - nodeBookedVolume(state, nodeId, date));
}

export function nodeExpansionPotential(state: WorldState, nodeId: string) {
  const node = state.energyNodes[nodeId];
  if (!node) return 0;
  return Math.max(0, node.annualCapacity - node.annualProduction);
}

function nodeDeliveryRatio(state: WorldState, nodeId: string, date = state.currentDate) {
  const booked = nodeBookedVolume(state, nodeId, date);
  if (booked <= 0) return 1;
  return Math.min(1, nodePhysicalExportCapacity(state, nodeId) / booked);
}

export function baselineFlowDeliveredVolume(state: WorldState, flow: BaselineEnergyFlow, date = state.currentDate) {
  if (!baselineActiveOn(flow, date)) return 0;
  return flow.sourceNodeId ? flow.annualVolume * nodeDeliveryRatio(state, flow.sourceNodeId, date) : flow.annualVolume;
}

export function contractDeliveredVolume(state: WorldState, contract: EnergyContract, date = state.currentDate) {
  if (!activeOn(contract, date)) return 0;
  return contract.annualVolume * nodeDeliveryRatio(state, contract.nodeId, date);
}

function domesticProductionAt(state: WorldState, countryId: CountryId, resource: EnergyResource) {
  const nodes = Object.values(state.energyNodes).filter((node) => node.countryId === countryId && node.resource === resource);
  if (!nodes.length) return state.countryEnergy[countryId]?.domesticProduction[resource] ?? 0;
  return nodes.reduce((sum, node) => sum + Math.min(node.annualProduction, node.annualCapacity), 0);
}

export function energyBalance(state: WorldState, countryId: CountryId, resource: EnergyResource) {
  const energy = state.countryEnergy[countryId];
  if (!energy) return null;
  const flows = Object.values(state.baselineEnergyFlows ?? {});
  const hasRegistry = flows.length > 0;
  const baselineImports = hasRegistry
    ? flows.filter((flow) => flow.buyerId === countryId && flow.resource === resource).reduce((sum, flow) => sum + baselineFlowDeliveredVolume(state, flow), 0)
    : energy.legacyImports?.[resource] ?? 0;
  const contractualImports = Object.values(state.energyContracts)
    .filter((contract) => contract.buyerId === countryId && contract.resource === resource)
    .reduce((sum, contract) => sum + contractDeliveredVolume(state, contract), 0);
  const baselineExports = flows
    .filter((flow) => flow.resource === resource && flow.sourceNodeId && state.energyNodes[flow.sourceNodeId]?.countryId === countryId)
    .reduce((sum, flow) => sum + baselineFlowDeliveredVolume(state, flow), 0);
  const contractualExports = Object.values(state.energyContracts)
    .filter((contract) => contract.sellerId === countryId && contract.resource === resource)
    .reduce((sum, contract) => sum + contractDeliveredVolume(state, contract), 0);
  const imports = baselineImports + contractualImports;
  const exports = baselineExports + contractualExports;
  const available = domesticProductionAt(state, countryId, resource) + imports - exports;
  const deficit = Math.max(0, energy.annualDemand[resource] - available);
  const surplus = Math.max(0, available - energy.annualDemand[resource]);
  const coverageMonths = energy.annualDemand[resource] > 0
    ? (energy.strategicStocks[resource] / energy.annualDemand[resource]) * 12
    : 12;
  return { imports, contractualImports, legacyImports: baselineImports, exports, available, deficit, surplus, coverageMonths };
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
  if (state.energyContracts[input.id]) return { ok: false as const, state, error: 'Cette proposition de contrat existe déjà dans le registre.' };
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
  if (contract.status === 'active') return { ok: false as const, state, error: 'Ce contrat est déjà actif.' };
  const available = nodeAvailableExport(state, contract.nodeId, contract.startDate) + (contract.status === 'proposed' ? contract.annualVolume : 0);
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
      if (!balance) continue;
      if (balance.surplus > 0) {
        const stocks = next.countryEnergy[countryId].strategicStocks[resource];
        const space = Math.max(0, next.countryEnergy[countryId].storageCapacity[resource] - stocks);
        const stored = Math.min(space, balance.surplus * (elapsedMonths / 12));
        if (stored > 0) next = commitWorldAction(next, {
          kind: 'energy', actorId: countryId, origin: 'time', visibility: 'debug', intent: `Constituer des réserves de ${resource}`,
          effects: [{ kind: 'energy_stock_delta', countryId, resource, delta: stored, reason: `Le surplus contractuel est dirigé vers les stocks disponibles.`, visibility: 'debug' }],
        });
      }
      if (balance.deficit <= 0) continue;
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
