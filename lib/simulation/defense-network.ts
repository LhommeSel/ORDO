import { defenseReferenceForCountry } from './country-sheet';
import type {
  CountryId,
  MilitaryTheater,
  MilitaryTheaterAccess,
  WorldState,
} from './types';

export type DefenseNetworkMode = 'combined' | 'presence' | 'bases' | 'conflicts';
export type DefenseNetworkScope = 'focus' | 'strategic' | 'documented';
export type DefenseNetworkMetric = 'personnel' | 'readiness' | 'risk';

export type DefenseNetworkNode = {
  id: string;
  name: string;
  flag: string;
  kind: 'country' | 'theater';
  isExternal: boolean;
  weight: number;
  degree: number;
  personnelThousands: number;
  budgetBillionUsd: number;
  readiness: number;
  supplyCoverageMonths: number;
  baseCount: number;
  theaterCount: number;
  accessRisk: number;
  mission?: string;
  status?: string;
};

export type DefenseNetworkEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'deployment' | 'host' | 'base' | 'conflict';
  volume: number;
  readiness: number;
  risk: number;
  label: string;
  detail: string;
  metricValue: number;
};

export type DefenseNetworkResult = {
  nodes: DefenseNetworkNode[];
  edges: DefenseNetworkEdge[];
  documentedTheaterCount: number;
  documentedBaseCount: number;
  documentedConflictCount: number;
  documentedEdgeCount: number;
  omittedEdgeCount: number;
  deployedPersonnelThousands: number;
  basedPersonnelThousands: number;
  highRiskEdgeCount: number;
};

export type DefenseNetworkOptions = {
  focusCountryId?: CountryId;
  mode?: DefenseNetworkMode;
  scope?: DefenseNetworkScope;
  metric?: DefenseNetworkMetric;
  maxNodes?: number;
};

const accessRisk: Record<MilitaryTheaterAccess, number> = {
  national: 8,
  allied: 18,
  host_consent: 35,
  unknown: 55,
  contested: 76,
  denied: 92,
};

const intensityScore: Record<string, number> = {
  low: 25,
  moderate: 50,
  high: 75,
  critical: 95,
};

const edgeKindForMode = (mode: DefenseNetworkMode, kind: DefenseNetworkEdge['kind']) => {
  if (mode === 'presence') return kind === 'deployment' || kind === 'host';
  if (mode === 'bases') return kind === 'base';
  if (mode === 'conflicts') return kind === 'conflict';
  return true;
};

const theaterNodeId = (theater: MilitaryTheater) => `theater:${theater.id}`;

const addEdge = (edges: Map<string, DefenseNetworkEdge>, edge: DefenseNetworkEdge) => {
  if (edge.volume <= 0) return;
  edges.set(edge.id, edge);
};

/**
 * Builds a strategic presence network from the military ledgers. The graph
 * deliberately keeps theatres as nodes: a country can project force into a
 * region without that region being mistaken for a sovereign state.
 */
export const buildDefenseNetwork = (
  world: WorldState,
  options: DefenseNetworkOptions = {},
): DefenseNetworkResult => {
  const focusCountryId = options.focusCountryId ?? world.playerCountryId;
  const mode = options.mode ?? 'combined';
  const scope = options.scope ?? 'focus';
  const metric = options.metric ?? 'personnel';
  const maxNodes = Math.max(8, options.maxNodes ?? 18);
  const edges = new Map<string, DefenseNetworkEdge>();
  const theaters = Object.values(world.militaryTheaters ?? {});
  const bases = Object.values(world.militaryBases ?? {});
  const conflicts = Object.values(world.warZones ?? {}).filter((zone) => zone.status === 'active');

  for (const theater of theaters) {
    const nodeId = theaterNodeId(theater);
    const readiness = Math.max(0, Math.min(100, theater.readiness));
    const deploymentRisk = Math.max(accessRisk[theater.access], 100 - readiness);
    addEdge(edges, {
      id: `deployment:${theater.id}`,
      from: theater.countryId,
      to: nodeId,
      kind: 'deployment',
      volume: theater.personnelThousands,
      readiness,
      risk: deploymentRisk,
      label: theater.location,
      detail: `${theater.mission} · ${theater.personnelThousands.toFixed(1)} k personnels`,
      metricValue: theater.personnelThousands,
    });
    for (const hostCountryId of theater.hostCountryIds) {
      if (!world.countries[hostCountryId]) continue;
      addEdge(edges, {
        id: `host:${theater.id}:${hostCountryId}`,
        from: nodeId,
        to: hostCountryId,
        kind: 'host',
        volume: theater.personnelThousands / Math.max(1, theater.hostCountryIds.length),
        readiness,
        risk: accessRisk[theater.access],
        label: `Accès · ${world.countries[hostCountryId].name}`,
        detail: `${theater.access} · ravitaillement ${theater.supplyCoverageMonths.toFixed(1)} mois`,
        metricValue: theater.personnelThousands,
      });
    }
  }
  for (const base of bases) {
    if (!world.countries[base.ownerCountryId] || !world.countries[base.hostCountryId]) continue;
    addEdge(edges, {
      id: `base:${base.id}`,
      from: base.ownerCountryId,
      to: base.hostCountryId,
      kind: 'base',
      volume: base.assignedPersonnelThousands,
      readiness: base.status === 'active' ? 78 : base.status === 'restricted' ? 45 : 0,
      risk: accessRisk[base.access],
      label: base.location,
      detail: `${base.mission} · capacité ${base.capacityThousands.toFixed(1)} k`,
      metricValue: base.assignedPersonnelThousands,
    });
  }
  for (const zone of conflicts) {
    for (let index = 0; index < zone.countryIds.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < zone.countryIds.length; nextIndex += 1) {
        const from = zone.countryIds[index];
        const to = zone.countryIds[nextIndex];
        if (!world.countries[from] || !world.countries[to]) continue;
        const score = intensityScore[zone.intensity] ?? 50;
        addEdge(edges, {
          id: `conflict:${zone.id}:${from}:${to}`,
          from,
          to,
          kind: 'conflict',
          volume: score,
          readiness: score,
          risk: score,
          label: zone.name,
          detail: `Intensité ${zone.intensity} · perturbation économique ${zone.economicDisruptionPct.toFixed(1)}%`,
          metricValue: score,
        });
      }
    }
  }

  const allEdges = [...edges.values()].filter((edge) => edgeKindForMode(mode, edge.kind));
  const focusTheaterIds = new Set(
    allEdges
      .filter((edge) => edge.from === focusCountryId || edge.to === focusCountryId)
      .flatMap((edge) => [edge.from, edge.to])
      .filter((id) => id.startsWith('theater:')),
  );
  const scopeEdges = allEdges.filter((edge) => {
    if (scope === 'focus') {
      return (
        edge.from === focusCountryId ||
        edge.to === focusCountryId ||
        focusTheaterIds.has(edge.from) ||
        focusTheaterIds.has(edge.to)
      );
    }
    if (scope === 'strategic') {
      const fromWeight = world.countries[edge.from]?.weight ?? 0;
      const toWeight = world.countries[edge.to]?.weight ?? 0;
      return fromWeight >= 60 || toWeight >= 60 || edge.volume >= 25 || edge.kind === 'conflict';
    }
    return true;
  });
  const metricForEdge = (edge: DefenseNetworkEdge) => {
    if (metric === 'risk') return edge.risk;
    if (metric === 'readiness') return edge.readiness;
    return edge.volume;
  };
  const rankedEdges = scopeEdges
    .slice()
    .sort((a, b) => metricForEdge(b) - metricForEdge(a));
  const selectedNodeIds = new Set<string>([focusCountryId]);
  const selectedEdgeIds = new Set<string>();
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

  const countryStats = new Map<CountryId, { personnel: number; budget: number; readiness: number; supply: number; theaterCount: number; baseCount: number; risk: number }>();
  for (const country of Object.values(world.countries)) {
    const defense = defenseReferenceForCountry(world, country.id);
    const relatedTheaters = theaters.filter((theater) => theater.countryId === country.id);
    const relatedBases = bases.filter((base) => base.ownerCountryId === country.id);
    countryStats.set(country.id, {
      personnel: defense?.activePersonnelThousands ?? relatedTheaters.reduce((sum, theater) => sum + theater.personnelThousands, 0),
      budget: defense?.budgetBillionUsd ?? 0,
      readiness: relatedTheaters.length ? relatedTheaters.reduce((sum, theater) => sum + theater.readiness, 0) / relatedTheaters.length : 0,
      supply: relatedTheaters.length ? relatedTheaters.reduce((sum, theater) => sum + theater.supplyCoverageMonths, 0) / relatedTheaters.length : 0,
      theaterCount: relatedTheaters.length,
      baseCount: relatedBases.length,
      risk: relatedTheaters.length ? Math.max(...relatedTheaters.map((theater) => accessRisk[theater.access])) : 0,
    });
  }
  const degreeById = new Map<string, number>();
  for (const edge of scopeEdges) {
    degreeById.set(edge.from, (degreeById.get(edge.from) ?? 0) + 1);
    degreeById.set(edge.to, (degreeById.get(edge.to) ?? 0) + 1);
  }
  const nodes = [...selectedNodeIds]
    .map((id) => {
      if (id.startsWith('theater:')) {
        const theater = world.militaryTheaters[id.slice(8)];
        return {
          id,
          name: theater?.location ?? id,
          flag: '⚔️',
          kind: 'theater' as const,
          isExternal: false,
          weight: 0,
          degree: degreeById.get(id) ?? 0,
          personnelThousands: theater?.personnelThousands ?? 0,
          budgetBillionUsd: 0,
          readiness: theater?.readiness ?? 0,
          supplyCoverageMonths: theater?.supplyCoverageMonths ?? 0,
          baseCount: theater?.baseIds?.length ?? 0,
          theaterCount: 1,
          accessRisk: theater ? accessRisk[theater.access] : 100,
          mission: theater?.mission,
          status: theater?.status,
        } satisfies DefenseNetworkNode;
      }
      const country = world.countries[id];
      const stats = countryStats.get(id);
      return {
        id,
        name: country?.name ?? id,
        flag: country?.flag ?? '🛡️',
        kind: 'country' as const,
        isExternal: !country,
        weight: country?.weight ?? 0,
        degree: degreeById.get(id) ?? 0,
        personnelThousands: stats?.personnel ?? 0,
        budgetBillionUsd: stats?.budget ?? 0,
        readiness: stats?.readiness ?? 0,
        supplyCoverageMonths: stats?.supply ?? 0,
        baseCount: stats?.baseCount ?? 0,
        theaterCount: stats?.theaterCount ?? 0,
        accessRisk: stats?.risk ?? 0,
      } satisfies DefenseNetworkNode;
    })
    .sort((a, b) => {
      if (a.id === focusCountryId) return -1;
      if (b.id === focusCountryId) return 1;
      return b.degree - a.degree || b.weight - a.weight || a.name.localeCompare(b.name, 'fr');
    });
  const selectedEdges = rankedEdges
    .filter((edge) => selectedEdgeIds.has(edge.id))
    .map((edge) => ({ ...edge, metricValue: metricForEdge(edge) }));
  return {
    nodes,
    edges: selectedEdges,
    documentedTheaterCount: theaters.length,
    documentedBaseCount: bases.length,
    documentedConflictCount: conflicts.length,
    documentedEdgeCount: allEdges.length,
    omittedEdgeCount: Math.max(0, allEdges.length - selectedEdges.length),
    deployedPersonnelThousands: theaters.reduce((sum, theater) => sum + theater.personnelThousands, 0),
    basedPersonnelThousands: bases.reduce((sum, base) => sum + base.assignedPersonnelThousands, 0),
    highRiskEdgeCount: allEdges.filter((edge) => edge.risk >= 70).length,
  };
};

