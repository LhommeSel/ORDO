'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Fuel, Network, Package, Search } from 'lucide-react';

import {
  buildEnergyTradeNetwork,
  type EnergyTradeNetworkMetric,
  type EnergyTradeNetworkMode,
  type EnergyTradeNetworkScope,
} from '@/lib/simulation/energy-trade-network';
import type { CountryId, EnergyResource, WorldState } from '@/lib/simulation';

type EnergyTradeNetworkProps = {
  world: WorldState;
};

const modeLabels: Record<EnergyTradeNetworkMode, string> = {
  combined: 'Énergie + commerce',
  energy: 'Énergie seulement',
  trade: 'Commerce seulement',
};

const scopeLabels: Record<EnergyTradeNetworkScope, string> = {
  focus: 'Autour du pays joué',
  strategic: 'Nœuds stratégiques',
  documented: 'Réseau documenté',
};

const metricLabels: Record<EnergyTradeNetworkMetric, string> = {
  volume: 'Volume',
  dependency: 'Dépendance',
  risk: 'Risque de route',
};

const energyColors = {
  trade: '#63b3ed',
  energy: '#d8b45d',
};

const shorten = (label: string, max = 15) =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;

export function EnergyTradeNetwork({ world }: EnergyTradeNetworkProps) {
  const [focusId, setFocusId] = useState<CountryId>(world.playerCountryId);
  const [mode, setMode] = useState<EnergyTradeNetworkMode>('combined');
  const [scope, setScope] = useState<EnergyTradeNetworkScope>('focus');
  const [resource, setResource] = useState<EnergyResource | 'all'>('all');
  const [metric, setMetric] = useState<EnergyTradeNetworkMetric>('volume');
  const [countryFilter, setCountryFilter] = useState('');

  const network = useMemo(
    () =>
      buildEnergyTradeNetwork(world, {
        focusCountryId: focusId,
        mode,
        scope,
        resource,
        metric,
        maxNodes: 18,
      }),
    [focusId, metric, mode, resource, scope, world],
  );
  const selectedNode = network.nodes.find((node) => node.id === focusId) ?? network.nodes[0];
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

  const visibleNodes = network.nodes;
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();
    const center = visibleNodes.find((node) => node.id === focusId);
    const others = visibleNodes.filter((node) => node.id !== focusId);
    if (center) result.set(center.id, { x: 360, y: 194 });
    const radius = others.length > 11 ? 151 : 137;
    others.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, others.length)) * Math.PI * 2;
      result.set(node.id, {
        x: 360 + Math.cos(angle) * radius,
        y: 194 + Math.sin(angle) * radius * 0.78,
      });
    });
    return result;
  }, [focusId, visibleNodes]);

  const nodeEdges = network.edges
    .filter((edge) => edge.from === focusId || edge.to === focusId)
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);
  const volumeLabel = (value: number) => `${value.toFixed(1)} Md$ / an`;

  return (
    <section className="border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Network className="size-4 text-primary" /> Réseau énergie–commerce
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Les routes commerciales et les approvisionnements énergétiques sont affichés
            ensemble pour repérer les dépendances, les corridors structurants et les points
            de rupture. Un marché extérieur reste identifié comme tel.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div className="border border-border px-2 py-2">
            <div className="font-mono text-base text-sky-300">{network.documentedTradeEdgeCount}</div>
            <div className="text-muted-foreground">routes commerciales</div>
          </div>
          <div className="border border-border px-2 py-2">
            <div className="font-mono text-base text-amber-200">{network.documentedEnergyEdgeCount}</div>
            <div className="text-muted-foreground">corridors énergie</div>
          </div>
          <div className="border border-border px-2 py-2">
            <div className="font-mono text-base text-foreground">{network.totalTradeVolume.toFixed(0)}</div>
            <div className="text-muted-foreground">Md$ échangés</div>
          </div>
          <div className="border border-border px-2 py-2">
            <div className="font-mono text-base text-amber-200">{network.externalEnergyVolume.toFixed(0)}</div>
            <div className="text-muted-foreground">énergie externe</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Point de vue
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2 top-2 size-3 text-muted-foreground" />
            <input
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              placeholder="Choisir un pays…"
              aria-label="Rechercher un pays dans le réseau énergie commerce"
              className="w-full border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
          <select
            value={world.countries[focusId] ? focusId : ''}
            onChange={(event) => setFocusId(event.target.value)}
            aria-label="Pays au centre du réseau énergie commerce"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {selectedNode?.isExternal && <option value="">{selectedNode.flag} {selectedNode.name}</option>}
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Réseau
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as EnergyTradeNetworkMode)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Périmètre
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as EnergyTradeNetworkScope)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Ressource
          <select
            value={resource}
            onChange={(event) => setResource(event.target.value as EnergyResource | 'all')}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">Pétrole + gaz</option>
            <option value="oil">Pétrole</option>
            <option value="gas">Gaz</option>
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Épaisseur
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as EnergyTradeNetworkMetric)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="overflow-hidden border border-border bg-[#07131b]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span>{network.edges.length} liaison(s) affichée(s) · centre : {selectedNode?.name ?? 'aucun'}</span>
            <span>{network.omittedEdgeCount ? `${network.omittedEdgeCount} lien(s) condensé(s)` : 'Réseau complet'}</span>
          </div>
          <svg
            viewBox="0 0 720 390"
            className="h-[330px] w-full min-w-[560px]"
            aria-label={`Réseau énergie commerce centré sur ${selectedNode?.name ?? 'le pays joué'}`}
          >
            <defs>
              <radialGradient id="energy-trade-network-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d8b45d" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#d8b45d" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="720" height="390" fill="#07131b" />
            <circle cx="360" cy="194" r="90" fill="url(#energy-trade-network-glow)" />
            {network.edges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              const width = 1.2 + Math.min(5, edge.metricValue / (metric === 'risk' ? 16 : metric === 'dependency' ? 14 : 30));
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={energyColors[edge.kind]}
                  strokeWidth={width}
                  strokeOpacity="0.72"
                  strokeDasharray={edge.kind === 'trade' ? '5 4' : undefined}
                >
                  <title>{`${edge.kind === 'energy' ? 'Énergie' : 'Commerce'} · ${edge.volume.toFixed(1)} · ${edge.route}`}</title>
                </line>
              );
            })}
            {visibleNodes.map((node) => {
              const point = positions.get(node.id);
              if (!point) return null;
              const isFocus = node.id === focusId;
              const radius = isFocus ? 27 : 13 + Math.min(8, node.degree * 1.2);
              return (
                <g
                  key={node.id}
                  tabIndex={0}
                  aria-label={`Centrer le réseau sur ${node.name}`}
                  onClick={() => setFocusId(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setFocusId(node.id);
                  }}
                  className="cursor-pointer"
                >
                  <circle cx={point.x} cy={point.y} r={radius + 3} fill="none" stroke={isFocus ? '#f0cf70' : '#425768'} strokeOpacity={isFocus ? 0.9 : 0.55} />
                  <circle cx={point.x} cy={point.y} r={radius} fill={node.isExternal ? '#29323a' : isFocus ? '#9b7b31' : '#1a2e3d'} stroke={node.isExternal ? '#d8b45d' : isFocus ? '#f0cf70' : '#7590a3'} strokeWidth={isFocus ? 2 : 1} />
                  <text x={point.x} y={point.y - 2} textAnchor="middle" fontSize={isFocus ? 19 : 13}>{node.flag}</text>
                  <text x={point.x} y={point.y + radius + 14} textAnchor="middle" fill="#d9e2e8" fontSize={isFocus ? 12 : 10} fontWeight={isFocus ? 700 : 500}>{shorten(node.name)}</text>
                </g>
              );
            })}
            {!network.edges.length && <text x="360" y="200" textAnchor="middle" fill="#a4b4bf" fontSize="13">Aucun flux ne correspond à ce filtre.</text>}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-sky-300" /> Commerce</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-amber-200" /> Énergie</span>
            <span className="ml-auto">Épaisseur = {metricLabels[metric].toLocaleLowerCase('fr')} (échelle relative)</span>
          </div>
        </div>

        <aside className="border border-border bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-primary">Fiche de dépendance</div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {selectedNode?.flag} {selectedNode?.name ?? 'Aucun pays'}
          </div>
          {selectedNode?.isExternal ? (
            <div className="mt-3 flex items-start gap-2 border border-amber-400/40 bg-amber-400/5 p-2 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Ce nœud regroupe les volumes venant du marché mondial hors périmètre détaillé.
              Il signale une dépendance, pas un fournisseur unique.
            </div>
          ) : selectedNode ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Exportations</div><div className="font-mono text-sm text-sky-200">{volumeLabel(selectedNode.tradeExports)}</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Importations</div><div className="font-mono text-sm text-sky-200">{volumeLabel(selectedNode.tradeImports)}</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Production énergie</div><div className="font-mono text-sm text-amber-200">{selectedNode.energyProduction.toFixed(1)} / an</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Dépendance énergie</div><div className="font-mono text-sm text-amber-200">{selectedNode.energyDependency.toFixed(0)} %</div></div>
              </div>
              <div className="border-l-2 border-primary pl-2 text-muted-foreground">
                Demande énergétique : {selectedNode.energyDemand.toFixed(1)} / an · importations : {selectedNode.energyImports.toFixed(1)} / an.
              </div>
              {nodeEdges.length ? (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {nodeEdges.map((edge) => {
                    const counterpartId = edge.from === focusId ? edge.to : edge.from;
                    const counterpart = network.nodes.find((node) => node.id === counterpartId);
                    return <div key={edge.id} className="flex items-center justify-between gap-2"><span>{edge.kind === 'energy' ? <Fuel className="mr-1 inline size-3 text-amber-200" /> : <Package className="mr-1 inline size-3 text-sky-200" />}{counterpart?.flag} {counterpart?.name ?? counterpartId}</span><b>{edge.volume.toFixed(1)}</b></div>;
                  })}
                </div>
              ) : <p className="text-xs text-muted-foreground">Aucun flux détaillé autour de ce pays dans le périmètre choisi.</p>}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
