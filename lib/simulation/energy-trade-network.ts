import { energyBalance, nodeAvailableExport } from './energy';
import type {
  BilateralTradeFlow,
  CountryId,
  EnergyResource,
  WorldState,
} from './types';

export type EnergyTradeNetworkMode = 'combined' | 'energy' | 'trade';
export type EnergyTradeNetworkScope = 'focus' | 'strategic' | 'documented';
export type EnergyTradeNetworkMetric = 'volume' | 'dependency' | 'risk';

export type EnergyTradeNetworkNode = {
  id: string;
  name: string;
  flag: string;
  weight: number;
  isExternal: boolean;
  degree: number;
  tradeExports: number;
  tradeImports: number;
  energyProduction: number;
  energyDemand: number;
  energyImports: number;
  energyExports: number;
  energyDependency: number;
};

export type EnergyTradeNetworkEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'trade' | 'energy';
  resource?: EnergyResource;
  volume: number;
  route: string;
  risk: number;
  reliability?: number;
  friction?: number;
  metricValue: number;
};

export type EnergyTradeNetworkResult = {
  nodes: EnergyTradeNetworkNode[];
  edges: EnergyTradeNetworkEdge[];
  documentedTradeEdgeCount: number;
  documentedEnergyEdgeCount: number;
  documentedEdgeCount: number;
  omittedEdgeCount: number;
  totalTradeVolume: number;
  totalEnergyVolume: number;
  externalEnergyVolume: number;
};

export type EnergyTradeNetworkOptions = {
  focusCountryId?: CountryId;
  scope?: EnergyTradeNetworkScope;
  mode?: EnergyTradeNetworkMode;
  resource?: EnergyResource | 'all';
  metric?: EnergyTradeNetworkMetric;
  maxNodes?: number;
};

const activeAt = (startDate: string, endDate: string, date: string) =>
  startDate <= date && endDate >= date;

const edgeId = (kind: EnergyTradeNetworkEdge['kind'], from: string, to: string, resource?: EnergyResource) =>
  `${kind}:${from}:${to}:${resource ?? 'all'}`;

const externalIdFor = (resource: EnergyResource) => `external:${resource}`;

const externalLabelFor = (resource: EnergyResource) =>
  resource === 'oil' ? 'Marché mondial du pétrole' : 'Marché mondial du gaz';

const addTradeFlow = (
  edges: Map<string, EnergyTradeNetworkEdge>,
  flow: BilateralTradeFlow,
) => {
  if (!flow.annualValueBillion2000Usd || flow.annualValueBillion2000Usd <= 0) return;
  const id = edgeId('trade', flow.exporterId, flow.importerId);
  const previous = edges.get(id);
  const value = flow.annualValueBillion2000Usd;
  edges.set(id, {
    id,
    from: flow.exporterId,
    to: flow.importerId,
    kind: 'trade',
    volume: (previous?.volume ?? 0) + value,
    route: [...new Set([previous?.route, 'Échanges de biens'].filter(Boolean))].join(' · '),
    risk: Math.max(previous?.risk ?? 0, Math.round((flow.friction + (100 - flow.reliability)) / 2)),
    reliability: Math.round(
      previous?.reliability === undefined
        ? flow.reliability
        : (previous.reliability + flow.reliability) / 2,
    ),
    friction: Math.round(
      previous?.friction === undefined
        ? flow.friction
        : (previous.friction + flow.friction) / 2,
    ),
    metricValue: (previous?.volume ?? 0) + value,
  });
};

/**
 * Unifie les routes commerciales et les approvisionnements énergétiques en
 * un réseau lisible. Les flux physiques restent issus des registres existants;
 * un marché externe est représenté comme un nœud explicite, jamais comme un
 * pays inventé.
 */
export const buildEnergyTradeNetwork = (
  world: WorldState,
  options: EnergyTradeNetworkOptions = {},
): EnergyTradeNetworkResult => {
  const focusCountryId = options.focusCountryId ?? world.playerCountryId;
  const scope = options.scope ?? 'focus';
  const mode = options.mode ?? 'combined';
  const resource = options.resource ?? 'all';
  const metric = options.metric ?? 'volume';
  const maxNodes = Math.max(6, options.maxNodes ?? 18);
  const edges = new Map<string, EnergyTradeNetworkEdge>();

  for (const flow of Object.values(world.tradeFlows ?? {})) {
    if (!world.countries[flow.exporterId] || !world.countries[flow.importerId]) continue;
    addTradeFlow(edges, flow);
  }

  const addEnergy = (
    from: string,
    to: string,
    energyResource: EnergyResource,
    volume: number,
    route: string,
    risk: number,
  ) => {
    if (volume <= 0 || !world.countries[to]) return;
    const id = edgeId('energy', from, to, energyResource);
    const previous = edges.get(id);
    edges.set(id, {
      id,
      from,
      to,
      kind: 'energy',
      resource: energyResource,
      volume: (previous?.volume ?? 0) + volume,
      route: [...new Set([previous?.route, route].filter(Boolean))].join(' · '),
      risk: Math.round(
        previous ? (previous.risk + risk) / 2 : risk,
      ),
      metricValue: (previous?.volume ?? 0) + volume,
    });
  };

  for (const flow of Object.values(world.baselineEnergyFlows ?? {})) {
    if (!activeAt(flow.startDate, flow.endDate, world.currentDate)) continue;
    const source = flow.sourceNodeId ? world.energyNodes[flow.sourceNodeId] : undefined;
    const from = source?.countryId ?? externalIdFor(flow.resource);
    const routeRisk = source
      ? Math.max(5, Math.min(95, 100 - nodeAvailableExport(world, source.id)))
      : 58;
    addEnergy(from, flow.buyerId, flow.resource, flow.annualVolume, flow.route, routeRisk);
  }
  for (const contract of Object.values(world.energyContracts ?? {})) {
    if (contract.status !== 'active' || !activeAt(contract.startDate, contract.endDate, world.currentDate)) continue;
    const source = world.energyNodes[contract.nodeId];
    const from = source?.countryId ?? externalIdFor(contract.resource);
    const routeRisk = source
      ? Math.max(5, Math.min(95, 100 - nodeAvailableExport(world, source.id)))
      : 58;
    addEnergy(from, contract.buyerId, contract.resource, contract.annualVolume, contract.route, routeRisk);
  }

  const allEdges = [...edges.values()].filter((edge) => {
    if (mode === 'energy' && edge.kind !== 'energy') return false;
    if (mode === 'trade' && edge.kind !== 'trade') return false;
    if (edge.kind === 'energy' && resource !== 'all' && edge.resource !== resource) return false;
    return true;
  });
  const scopeEdges = allEdges.filter((edge) => {
    if (scope === 'focus') return edge.from === focusCountryId || edge.to === focusCountryId;
    if (scope === 'strategic') {
      const fromWeight = world.countries[edge.from]?.weight ?? 0;
      const toWeight = world.countries[edge.to]?.weight ?? 0;
      return fromWeight >= 60 || toWeight >= 60 || edge.volume >= 25;
    }
    return true;
  });
  const maxTradeVolume = Math.max(
    1,
    ...scopeEdges.filter((edge) => edge.kind === 'trade').map((edge) => edge.volume),
  );
  const maxEnergyVolume = Math.max(
    1,
    ...scopeEdges.filter((edge) => edge.kind === 'energy').map((edge) => edge.volume),
  );
  const relativeVolume = (edge: EnergyTradeNetworkEdge) =>
    (edge.volume / (edge.kind === 'trade' ? maxTradeVolume : maxEnergyVolume)) * 100;
  const edgePriority = (edge: EnergyTradeNetworkEdge) => {
    if (metric === 'risk') return edge.risk * 2 + edge.volume / 10;
    if (metric === 'dependency') {
      const demand = edge.kind === 'energy'
        ? world.countryEnergy[edge.to]?.annualDemand[edge.resource ?? 'oil'] ?? 1
        : (world.macroEconomies[edge.to]?.realGdpBillion2000Usd ?? 1) / 10;
      return (edge.volume / demand) * 100 + edge.risk / 10;
    }
    return relativeVolume(edge);
  };
  const rankedEdges = scopeEdges.slice().sort((a, b) => edgePriority(b) - edgePriority(a));
  const selectedEdgeIds = new Set<string>();
  const selectedNodeIds = new Set<string>([focusCountryId]);
  for (const edge of rankedEdges) {
    const newNodeCount = [edge.from, edge.to].filter((id) => !selectedNodeIds.has(id)).length;
    if (selectedNodeIds.size + newNodeCount > maxNodes) continue;
    selectedEdgeIds.add(edge.id);
    selectedNodeIds.add(edge.from);
    selectedNodeIds.add(edge.to);
    if (selectedNodeIds.size >= maxNodes && selectedEdgeIds.size >= maxNodes * 2) break;
  }
  if (!selectedEdgeIds.size && rankedEdges.length) {
    selectedEdgeIds.add(rankedEdges[0].id);
    selectedNodeIds.add(rankedEdges[0].from);
    selectedNodeIds.add(rankedEdges[0].to);
  }

  const stats = new Map<string, { tradeExports: number; tradeImports: number; energyProduction: number; energyDemand: number; energyImports: number; energyExports: number; degree: number }>();
  const statsFor = (id: string) => {
    const current = stats.get(id);
    if (current) return current;
    const energy = world.countryEnergy[id];
    const created = {
      tradeExports: 0,
      tradeImports: 0,
      energyProduction: 0,
      energyDemand: energy ? energy.annualDemand.oil + energy.annualDemand.gas : 0,
      energyImports: 0,
      energyExports: 0,
      degree: 0,
    };
    stats.set(id, created);
    return created;
  };
  for (const id of Object.keys(world.countryEnergy)) {
    const countryStats = statsFor(id);
    for (const energyResource of ['oil', 'gas'] as const) {
      const balance = energyBalance(world, id, energyResource);
      const production = Object.values(world.energyNodes)
        .filter((node) => node.countryId === id && node.resource === energyResource)
        .reduce((sum, node) => sum + Math.min(node.annualProduction, node.annualCapacity), 0);
      countryStats.energyProduction += production;
      countryStats.energyImports += balance?.imports ?? 0;
      countryStats.energyExports += balance?.exports ?? 0;
    }
  }
  for (const edge of allEdges) {
    const from = statsFor(edge.from);
    const to = statsFor(edge.to);
    if (edge.kind === 'trade') {
      from.tradeExports += edge.volume;
      to.tradeImports += edge.volume;
    }
  }
  const nodes = [...selectedNodeIds]
    .map((id) => {
      const externalResource = id.startsWith('external:') ? (id.slice(9) as EnergyResource) : undefined;
      const country = world.countries[id];
      const countryStats = statsFor(id);
      return {
        id,
        name: country?.name ?? (externalResource ? externalLabelFor(externalResource) : id),
        flag: country?.flag ?? '⛽',
        weight: country?.weight ?? 0,
        isExternal: !country,
        degree: scopeEdges.filter((edge) => edge.from === id || edge.to === id).length,
        tradeExports: countryStats.tradeExports,
        tradeImports: countryStats.tradeImports,
        energyProduction: countryStats.energyProduction,
        energyDemand: countryStats.energyDemand,
        energyImports: countryStats.energyImports,
        energyExports: countryStats.energyExports,
        energyDependency: countryStats.energyDemand > 0
          ? Math.min(100, (countryStats.energyImports / countryStats.energyDemand) * 100)
          : 0,
      } satisfies EnergyTradeNetworkNode;
    })
    .sort((a, b) => {
      if (a.id === focusCountryId) return -1;
      if (b.id === focusCountryId) return 1;
      return b.degree - a.degree || b.weight - a.weight || a.name.localeCompare(b.name, 'fr');
    });
  const metricForEdge = (edge: EnergyTradeNetworkEdge) => {
    if (metric === 'risk') return edge.risk;
    if (metric === 'dependency') {
      const demand = edge.kind === 'energy'
        ? world.countryEnergy[edge.to]?.annualDemand[edge.resource ?? 'oil'] ?? 1
        : (world.macroEconomies[edge.to]?.realGdpBillion2000Usd ?? 1) / 10;
      return Math.min(100, (edge.volume / demand) * 100);
    }
    return relativeVolume(edge);
  };
  const selectedEdges = rankedEdges
    .filter((edge) => selectedEdgeIds.has(edge.id))
    .map((edge) => ({ ...edge, metricValue: metricForEdge(edge) }));
  return {
    nodes,
    edges: selectedEdges,
    documentedTradeEdgeCount: allEdges.filter((edge) => edge.kind === 'trade').length,
    documentedEnergyEdgeCount: allEdges.filter((edge) => edge.kind === 'energy').length,
    documentedEdgeCount: allEdges.length,
    omittedEdgeCount: Math.max(0, allEdges.length - selectedEdges.length),
    totalTradeVolume: allEdges.filter((edge) => edge.kind === 'trade').reduce((sum, edge) => sum + edge.volume, 0),
    totalEnergyVolume: allEdges.filter((edge) => edge.kind === 'energy').reduce((sum, edge) => sum + edge.volume, 0),
    externalEnergyVolume: allEdges
      .filter((edge) => edge.kind === 'energy' && edge.from.startsWith('external:'))
      .reduce((sum, edge) => sum + edge.volume, 0),
  };
};
