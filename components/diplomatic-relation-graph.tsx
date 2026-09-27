'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Network, Search, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  buildDiplomaticGraph,
  type DiplomaticGraphBand,
  type DiplomaticGraphMetric,
  type DiplomaticGraphScope,
} from '@/lib/simulation/diplomatic-graph';
import type { CountryId, WorldState } from '@/lib/simulation';

type DiplomaticRelationGraphProps = {
  world: WorldState;
  onOpenDiplomacy?: (countryId: CountryId) => void;
};

const metricLabels: Record<DiplomaticGraphMetric, string> = {
  relation: 'Relation',
  trust: 'Confiance',
  tradeIntensity: 'Commerce',
  securityAlignment: 'Sécurité',
};

const scopeLabels: Record<DiplomaticGraphScope, string> = {
  focus: 'Autour du pays joué',
  majors: 'Puissances et voisins',
  documented: 'Réseau documenté',
};

const bandLabels: Record<DiplomaticGraphBand, string> = {
  partner: 'Partenaire',
  stable: 'Stable',
  watch: 'À surveiller',
  tension: 'Tension',
};

const bandColors: Record<DiplomaticGraphBand, string> = {
  partner: '#48c78e',
  stable: '#c7a955',
  watch: '#e69b49',
  tension: '#d96565',
};

const metricValueLabel = (value: number) => `${Math.round(value)}/100`;

const relationBetween = (world: WorldState, first: CountryId, second: CountryId) => {
  const direct = world.relations[`${first}:${second}`];
  const reverse = world.relations[`${second}:${first}`];
  if (direct && reverse) {
    return {
      relation: Math.round((direct.relation + reverse.relation) / 2),
      trust: Math.round((direct.trust + reverse.trust) / 2),
      tradeIntensity: Math.round(
        (direct.tradeIntensity + reverse.tradeIntensity) / 2,
      ),
      securityAlignment: Math.round(
        (direct.securityAlignment + reverse.securityAlignment) / 2,
      ),
      memories: [...new Set([...direct.memories, ...reverse.memories])].slice(-5),
    };
  }
  const relation = direct ?? reverse;
  return relation
    ? {
        relation: relation.relation,
        trust: relation.trust,
        tradeIntensity: relation.tradeIntensity,
        securityAlignment: relation.securityAlignment,
        memories: relation.memories.slice(-5),
      }
    : undefined;
};

export function DiplomaticRelationGraph({
  world,
  onOpenDiplomacy,
}: DiplomaticRelationGraphProps) {
  const player = world.countries[world.playerCountryId];
  const [focusId, setFocusId] = useState<CountryId>(world.playerCountryId);
  const [scope, setScope] = useState<DiplomaticGraphScope>('focus');
  const [metric, setMetric] = useState<DiplomaticGraphMetric>('relation');
  const [threshold, setThreshold] = useState<'all' | 'positive' | 'watch' | 'tension'>('all');
  const [countryFilter, setCountryFilter] = useState('');

  const graph = useMemo(
    () =>
      buildDiplomaticGraph(world, {
        focusCountryId: focusId,
        scope,
        metric,
        maxNodes: 18,
      }),
    [world, focusId, metric, scope],
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((edge) => {
        if (threshold === 'positive') return edge.band === 'partner';
        if (threshold === 'watch') return edge.band === 'watch' || edge.band === 'stable';
        if (threshold === 'tension') return edge.band === 'tension';
        return true;
      }),
    [graph.edges, threshold],
  );
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<CountryId>([focusId]);
    visibleEdges.forEach((edge) => {
      ids.add(edge.from);
      ids.add(edge.to);
    });
    return ids;
  }, [focusId, visibleEdges]);
  const visibleNodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id));
  const positions = useMemo(() => {
    const center = visibleNodes.find((node) => node.id === focusId);
    const others = visibleNodes.filter((node) => node.id !== focusId);
    const result = new Map<CountryId, { x: number; y: number }>();
    if (center) result.set(center.id, { x: 360, y: 192 });
    const radius = others.length > 10 ? 148 : 136;
    others.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, others.length)) * Math.PI * 2;
      result.set(node.id, {
        x: 360 + Math.cos(angle) * radius,
        y: 192 + Math.sin(angle) * radius * 0.78,
      });
    });
    return result;
  }, [focusId, visibleNodes]);

  const selectedCountry = world.countries[focusId] ?? player;
  const selectedRelation =
    focusId === player.id ? undefined : relationBetween(world, player.id, focusId);
  const selectedEdges = visibleEdges.filter(
    (edge) => edge.from === focusId || edge.to === focusId,
  );
  const countryOptions = useMemo(() => {
    const query = countryFilter.trim().toLocaleLowerCase('fr');
    const filtered = Object.values(world.countries)
      .filter((country) => country.name.toLocaleLowerCase('fr').includes(query))
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'fr'))
      .slice(0, 60);
    if (!filtered.some((country) => country.id === focusId) && world.countries[focusId]) {
      return [world.countries[focusId], ...filtered].slice(0, 60);
    }
    return filtered;
  }, [countryFilter, focusId, world.countries]);

  const edgeColor = (band: DiplomaticGraphBand) => bandColors[band];
  const edgeWidth = (value: number) => 1.2 + Math.min(4, Math.abs(value - 50) / 15);

  return (
    <section className="border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Network className="size-4 text-primary" /> Carte des relations diplomatiques
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Une lecture synthétique des liens documentés. Les deux sens d’une relation sont
            agrégés pour rendre visibles les convergences et les tensions sans simuler une
            précision que le moteur ne possède pas.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="border border-border px-3 py-2">
            <div className="font-mono text-base text-foreground">{graph.documentedPairCount}</div>
            <div className="text-muted-foreground">paires documentées</div>
          </div>
          <div className="border border-border px-3 py-2">
            <div className="font-mono text-base text-emerald-300">{graph.positiveCount}</div>
            <div className="text-muted-foreground">partenariats</div>
          </div>
          <div className="border border-border px-3 py-2">
            <div className="font-mono text-base text-red-300">{graph.tensionCount}</div>
            <div className="text-muted-foreground">tensions</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Point de vue
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2 top-2 size-3 text-muted-foreground" />
            <input
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              placeholder="Choisir un pays…"
              className="w-full border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary"
              aria-label="Rechercher un pays pour le graphe"
            />
          </div>
          <select
            value={focusId}
            onChange={(event) => setFocusId(event.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            aria-label="Pays au centre du graphe"
          >
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Périmètre
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as DiplomaticGraphScope)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {Object.entries(scopeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Mesure
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as DiplomaticGraphMetric)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {Object.entries(metricLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Filtre relation
          <select
            value={threshold}
            onChange={(event) => setThreshold(event.target.value as typeof threshold)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">Toutes les liaisons</option>
            <option value="positive">Partenaires actifs</option>
            <option value="watch">Stables / à surveiller</option>
            <option value="tension">Tensions</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="overflow-hidden border border-border bg-[#07131b]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span>{visibleEdges.length} liaison(s) affichée(s) · centre : {selectedCountry.name}</span>
            <span>{graph.omittedRelationCount ? `${graph.omittedRelationCount} lien(s) condensé(s)` : 'Réseau complet'}</span>
          </div>
          <svg
            viewBox="0 0 720 385"
            className="h-[330px] w-full min-w-[560px]"
            aria-label={`Graphe diplomatique centré sur ${selectedCountry.name}`}
          >
            <defs>
              <radialGradient id="diplomatic-graph-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c7a955" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#c7a955" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="720" height="385" fill="#07131b" />
            <circle cx="360" cy="192" r="85" fill="url(#diplomatic-graph-glow)" />
            {visibleEdges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={edgeColor(edge.band)}
                  strokeWidth={edgeWidth(metric === 'relation' ? edge.relation : edge.metricValue)}
                  strokeOpacity="0.7"
                  strokeDasharray={edge.band === 'watch' ? '4 5' : undefined}
                >
                  <title>{`${bandLabels[edge.band]} · relation ${edge.relation}/100 · ${edge.from} — ${edge.to}`}</title>
                </line>
              );
            })}
            {visibleNodes.map((node) => {
              const point = positions.get(node.id);
              if (!point) return null;
              const isFocus = node.id === focusId;
              const radius = isFocus ? 27 : 13 + Math.min(8, node.degree * 1.4);
              return (
                <g
                  key={node.id}
                  tabIndex={0}
                  aria-label={`Centrer le graphe sur ${node.name}`}
                  onClick={() => setFocusId(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setFocusId(node.id);
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius + (isFocus ? 4 : 2)}
                    fill="none"
                    stroke={node.isPlayer ? '#f0cf70' : '#425768'}
                    strokeOpacity={isFocus ? 0.9 : 0.55}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={node.isPlayer ? '#9b7b31' : '#1a2e3d'}
                    stroke={node.isPlayer ? '#f0cf70' : '#7590a3'}
                    strokeWidth={isFocus ? 2 : 1}
                  />
                  <text x={point.x} y={point.y - 2} textAnchor="middle" fontSize={isFocus ? 20 : 13}>
                    {node.flag}
                  </text>
                  <text
                    x={point.x}
                    y={point.y + radius + 14}
                    textAnchor="middle"
                    fill="#d9e2e8"
                    fontSize={isFocus ? 12 : 10}
                    fontWeight={isFocus ? 700 : 500}
                  >
                    {node.name.length > 15 ? `${node.name.slice(0, 14)}…` : node.name}
                  </text>
                </g>
              );
            })}
            {!visibleEdges.length && (
              <text x="360" y="198" textAnchor="middle" fill="#a4b4bf" fontSize="13">
                Aucun lien ne correspond à ce filtre.
              </text>
            )}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            {Object.entries(bandLabels).map(([band, label]) => (
              <span key={band} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: bandColors[band as DiplomaticGraphBand] }} />
                {label}
              </span>
            ))}
            <span className="ml-auto">Épaisseur = {metricLabels[metric].toLocaleLowerCase('fr')}</span>
          </div>
        </div>

        <aside className="border border-border bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-primary">Fiche de relation</div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {selectedCountry.flag} {selectedCountry.name}
          </div>
          {focusId === player.id ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Le pays joué est au centre. Cliquez sur un nœud pour inspecter un partenaire,
              un voisin ou une tension.
            </p>
          ) : selectedRelation ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['Relation', selectedRelation.relation],
                  ['Confiance', selectedRelation.trust],
                  ['Commerce', selectedRelation.tradeIntensity],
                  ['Sécurité', selectedRelation.securityAlignment],
                ] as const).map(([label, value]) => (
                  <div key={label} className="border border-border px-2 py-1.5">
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                    <div className="font-mono text-sm text-foreground">{metricValueLabel(value)}</div>
                  </div>
                ))}
              </div>
              <div className="border-l-2 border-primary pl-2 text-muted-foreground">
                {selectedRelation.memories[0] ?? 'Aucune mémoire diplomatique détaillée.'}
              </div>
              {selectedRelation.memories.length > 1 && (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {selectedRelation.memories.slice(1, 4).map((memory) => <li key={memory}>· {memory}</li>)}
                </ul>
              )}
              {onOpenDiplomacy && (
                <Button
                  size="sm"
                  className="mt-1 w-full"
                  onClick={() => onOpenDiplomacy(focusId)}
                >
                  <ExternalLink className="mr-1 size-3" /> Ouvrir le canal diplomatique
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 border border-amber-400/40 bg-amber-400/5 p-2 text-xs text-amber-100">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              Aucune relation bilatérale documentée avec {player.name}. Le moteur ne déduit pas
              une posture à partir du silence des données.
            </div>
          )}
          {focusId !== player.id && selectedEdges.length > 0 && (
            <div className="mt-3 text-[10px] text-muted-foreground">
              {selectedEdges.length} lien(s) affiché(s) autour de ce pays dans le périmètre sélectionné.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
