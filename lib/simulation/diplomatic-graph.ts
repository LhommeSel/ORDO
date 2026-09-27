import type {
  BilateralRelation,
  CountryId,
  WorldState,
} from './types';

export type DiplomaticGraphScope = 'focus' | 'majors' | 'documented';
export type DiplomaticGraphMetric =
  | 'relation'
  | 'trust'
  | 'tradeIntensity'
  | 'securityAlignment';

export type DiplomaticGraphBand = 'partner' | 'stable' | 'watch' | 'tension';

export type DiplomaticGraphNode = {
  id: CountryId;
  name: string;
  flag: string;
  weight: number;
  degree: number;
  isPlayer: boolean;
};

export type DiplomaticGraphEdge = {
  id: string;
  from: CountryId;
  to: CountryId;
  relation: number;
  trust: number;
  tradeIntensity: number;
  securityAlignment: number;
  memories: string[];
  sourceCount: number;
  band: DiplomaticGraphBand;
  metricValue: number;
};

export type DiplomaticGraphResult = {
  nodes: DiplomaticGraphNode[];
  edges: DiplomaticGraphEdge[];
  documentedRelationCount: number;
  documentedPairCount: number;
  omittedRelationCount: number;
  positiveCount: number;
  tensionCount: number;
};

export type DiplomaticGraphOptions = {
  focusCountryId?: CountryId;
  scope?: DiplomaticGraphScope;
  metric?: DiplomaticGraphMetric;
  maxNodes?: number;
};

const metricValueFor = (
  relation: Pick<
    BilateralRelation,
    'relation' | 'trust' | 'tradeIntensity' | 'securityAlignment'
  >,
  metric: DiplomaticGraphMetric,
) => relation[metric];

const bandFor = (relation: number): DiplomaticGraphBand => {
  if (relation >= 65) return 'partner';
  if (relation >= 45) return 'stable';
  if (relation >= 30) return 'watch';
  return 'tension';
};

const pairKeyFor = (from: CountryId, to: CountryId) =>
  [from, to].sort((a, b) => a.localeCompare(b)).join('::');

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50;

/**
 * Converts the directed relation ledger into a deliberately small, readable
 * network. The simulation keeps a relation for each direction; the graph
 * aggregates both directions so a player can read one link without guessing
 * which arrow is authoritative.
 */
export const buildDiplomaticGraph = (
  world: WorldState,
  options: DiplomaticGraphOptions = {},
): DiplomaticGraphResult => {
  const focusCountryId = options.focusCountryId ?? world.playerCountryId;
  const scope = options.scope ?? 'focus';
  const metric = options.metric ?? 'relation';
  const maxNodes = Math.max(6, options.maxNodes ?? 18);
  const countries = world.countries;
  const pairRecords = new Map<
    string,
    { from: CountryId; to: CountryId; values: BilateralRelation[] }
  >();

  for (const relation of Object.values(world.relations)) {
    if (!countries[relation.from] || !countries[relation.to] || relation.from === relation.to)
      continue;
    const key = pairKeyFor(relation.from, relation.to);
    const current = pairRecords.get(key);
    if (current) current.values.push(relation);
    else pairRecords.set(key, { from: relation.from, to: relation.to, values: [relation] });
  }

  const allEdges = [...pairRecords.values()].map(({ from, to, values }) => {
    const edgeFrom = values[0]?.from ?? from;
    const edgeTo = values[0]?.to ?? to;
    const relation = Math.round(average(values.map((value) => value.relation)));
    const trust = Math.round(average(values.map((value) => value.trust)));
    const tradeIntensity = Math.round(
      average(values.map((value) => value.tradeIntensity)),
    );
    const securityAlignment = Math.round(
      average(values.map((value) => value.securityAlignment)),
    );
    const memories = [...new Set(values.flatMap((value) => value.memories))].slice(-5);
    return {
      id: pairKeyFor(edgeFrom, edgeTo),
      from: edgeFrom,
      to: edgeTo,
      relation,
      trust,
      tradeIntensity,
      securityAlignment,
      memories,
      sourceCount: values.length,
      band: bandFor(relation),
      metricValue: metricValueFor(
        { relation, trust, tradeIntensity, securityAlignment },
        metric,
      ),
    } satisfies DiplomaticGraphEdge;
  });

  const scopeEdges = allEdges.filter((edge) => {
    if (scope === 'focus') return edge.from === focusCountryId || edge.to === focusCountryId;
    if (scope === 'majors') {
      const fromWeight = countries[edge.from]?.weight ?? 0;
      const toWeight = countries[edge.to]?.weight ?? 0;
      return fromWeight >= 60 || toWeight >= 60;
    }
    return true;
  });

  const edgePriority = (edge: DiplomaticGraphEdge) => {
    const metricDistance = Math.abs(edge.metricValue - 50);
    const strategicWeight = (countries[edge.from]?.weight ?? 0) + (countries[edge.to]?.weight ?? 0);
    return metric === 'relation' || metric === 'trust'
      ? metricDistance * 2 + strategicWeight / 20
      : edge.metricValue * 2 + strategicWeight / 20;
  };

  const rankedEdges = scopeEdges.slice().sort((a, b) => edgePriority(b) - edgePriority(a));
  const selectedEdgeIds = new Set<string>();
  const selectedNodeIds = new Set<CountryId>([focusCountryId]);

  // A graph is useful only while its labels remain readable. Reserve one slot
  // for the focus country and then admit the strongest links until the budget
  // is reached; remaining documented links stay counted in the summary.
  for (const edge of rankedEdges) {
    const newNodeCount = [edge.from, edge.to].filter(
      (id) => !selectedNodeIds.has(id),
    ).length;
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

  const degreeByCountry = new Map<CountryId, number>();
  for (const edge of rankedEdges) {
    degreeByCountry.set(edge.from, (degreeByCountry.get(edge.from) ?? 0) + 1);
    degreeByCountry.set(edge.to, (degreeByCountry.get(edge.to) ?? 0) + 1);
  }
  const nodes = [...selectedNodeIds]
    .filter((id) => countries[id])
    .map((id) => ({
      id,
      name: countries[id].name,
      flag: countries[id].flag,
      weight: countries[id].weight,
      degree: degreeByCountry.get(id) ?? 0,
      isPlayer: id === world.playerCountryId,
    } satisfies DiplomaticGraphNode))
    .sort((a, b) => {
      if (a.id === focusCountryId) return -1;
      if (b.id === focusCountryId) return 1;
      return b.degree - a.degree || b.weight - a.weight || a.name.localeCompare(b.name, 'fr');
    });

  const edges = rankedEdges.filter((edge) => selectedEdgeIds.has(edge.id));
  return {
    nodes,
    edges,
    documentedRelationCount: Object.keys(world.relations).length,
    documentedPairCount: allEdges.length,
    omittedRelationCount: Math.max(0, allEdges.length - edges.length),
    positiveCount: allEdges.filter((edge) => edge.band === 'partner').length,
    tensionCount: allEdges.filter((edge) => edge.band === 'tension').length,
  };
};
