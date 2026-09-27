'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Network, Search, Shield, Swords } from 'lucide-react';

import {
  buildDefenseNetwork,
  type DefenseNetworkMetric,
  type DefenseNetworkMode,
  type DefenseNetworkScope,
} from '@/lib/simulation/defense-network';
import type { CountryId, WorldState } from '@/lib/simulation';

type DefenseGlobalNetworkProps = {
  world: WorldState;
};

const modeLabels: Record<DefenseNetworkMode, string> = {
  combined: 'Présence + bases + tensions',
  presence: 'Théâtres et présences',
  bases: 'Bases internationales',
  conflicts: 'Zones de conflit',
};

const scopeLabels: Record<DefenseNetworkScope, string> = {
  focus: 'Autour du pays joué',
  strategic: 'Acteurs stratégiques',
  documented: 'Réseau documenté',
};

const metricLabels: Record<DefenseNetworkMetric, string> = {
  personnel: 'Effectifs',
  readiness: 'Préparation',
  risk: 'Risque d’accès',
};

const edgeColors = {
  deployment: '#df905d',
  host: '#d8b45d',
  base: '#63b3ed',
  conflict: '#dc6565',
};

const edgeLabels = {
  deployment: 'Théâtre',
  host: 'Accès hôte',
  base: 'Base',
  conflict: 'Conflit',
};

const shorten = (label: string, max = 16) =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;

export function DefenseGlobalNetwork({ world }: DefenseGlobalNetworkProps) {
  const [focusId, setFocusId] = useState<CountryId>(world.playerCountryId);
  const [mode, setMode] = useState<DefenseNetworkMode>('combined');
  const [scope, setScope] = useState<DefenseNetworkScope>('focus');
  const [metric, setMetric] = useState<DefenseNetworkMetric>('personnel');
  const [countryFilter, setCountryFilter] = useState('');

  const network = useMemo(
    () =>
      buildDefenseNetwork(world, {
        focusCountryId: focusId,
        mode,
        scope,
        metric,
        maxNodes: 18,
      }),
    [focusId, metric, mode, scope, world],
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
    .slice(0, 6);

  const edgeWidth = (value: number) => 1.2 + Math.min(5, value / (metric === 'risk' ? 18 : metric === 'readiness' ? 16 : 35));

  return (
    <section className="border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Network className="size-4 text-primary" /> Défense mondiale · réseau de présence
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Les théâtres sont des nœuds distincts des pays : ils montrent où une force est
            engagée, qui l’accueille et quelle marge d’accès reste disponible. Les bases et
            les conflits actifs complètent la lecture sans simuler les batailles.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div className="border border-border px-2 py-2"><div className="font-mono text-base text-orange-200">{network.documentedTheaterCount}</div><div className="text-muted-foreground">théâtres</div></div>
          <div className="border border-border px-2 py-2"><div className="font-mono text-base text-sky-300">{network.documentedBaseCount}</div><div className="text-muted-foreground">bases</div></div>
          <div className="border border-border px-2 py-2"><div className="font-mono text-base text-foreground">{network.deployedPersonnelThousands.toFixed(0)} k</div><div className="text-muted-foreground">sur théâtres</div></div>
          <div className="border border-border px-2 py-2"><div className="font-mono text-base text-red-300">{network.highRiskEdgeCount}</div><div className="text-muted-foreground">accès à risque</div></div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Point de vue
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2 top-2 size-3 text-muted-foreground" />
            <input
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              placeholder="Choisir un pays…"
              aria-label="Rechercher un pays dans le réseau de défense"
              className="w-full border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
          <select
            value={world.countries[focusId] ? focusId : ''}
            onChange={(event) => setFocusId(event.target.value)}
            aria-label="Pays au centre du réseau de défense"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {selectedNode?.kind === 'theater' && <option value="">⚔️ {selectedNode.name}</option>}
            {countryOptions.map((country) => <option key={country.id} value={country.id}>{country.flag} {country.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Vue
          <select value={mode} onChange={(event) => setMode(event.target.value as DefenseNetworkMode)} className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground">
            {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Périmètre
          <select value={scope} onChange={(event) => setScope(event.target.value as DefenseNetworkScope)} className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground">
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Épaisseur
          <select value={metric} onChange={(event) => setMetric(event.target.value as DefenseNetworkMetric)} className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground">
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
          <svg viewBox="0 0 720 390" className="h-[330px] w-full min-w-[560px]" aria-label={`Réseau de défense centré sur ${selectedNode?.name ?? 'le pays joué'}`}>
            <defs>
              <radialGradient id="defense-network-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#df905d" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#df905d" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="720" height="390" fill="#07131b" />
            <circle cx="360" cy="194" r="90" fill="url(#defense-network-glow)" />
            {network.edges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              return (
                <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={edgeColors[edge.kind]} strokeWidth={edgeWidth(edge.metricValue)} strokeOpacity="0.74" strokeDasharray={edge.kind === 'conflict' ? '5 4' : edge.kind === 'host' ? '2 4' : undefined}>
                  <title>{`${edgeLabels[edge.kind]} · ${edge.label} · ${edge.detail}`}</title>
                </line>
              );
            })}
            {visibleNodes.map((node) => {
              const point = positions.get(node.id);
              if (!point) return null;
              const isFocus = node.id === focusId;
              const radius = isFocus ? 27 : node.kind === 'theater' ? 16 : 13 + Math.min(8, node.degree * 1.2);
              const fill = node.kind === 'theater' ? '#3d2f29' : isFocus ? '#9b7b31' : '#1a2e3d';
              return (
                <g key={node.id} tabIndex={0} aria-label={`Centrer le réseau sur ${node.name}`} onClick={() => setFocusId(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setFocusId(node.id); }} className="cursor-pointer">
                  <circle cx={point.x} cy={point.y} r={radius + 3} fill="none" stroke={isFocus ? '#f0cf70' : node.kind === 'theater' ? '#df905d' : '#425768'} strokeOpacity={isFocus ? 0.9 : 0.58} />
                  <circle cx={point.x} cy={point.y} r={radius} fill={fill} stroke={isFocus ? '#f0cf70' : node.kind === 'theater' ? '#df905d' : '#7590a3'} strokeWidth={isFocus ? 2 : 1} />
                  <text x={point.x} y={point.y - 2} textAnchor="middle" fontSize={isFocus ? 19 : 13}>{node.kind === 'theater' ? '⚔️' : node.flag}</text>
                  <text x={point.x} y={point.y + radius + 14} textAnchor="middle" fill="#d9e2e8" fontSize={isFocus ? 12 : 10} fontWeight={isFocus ? 700 : 500}>{shorten(node.name)}</text>
                </g>
              );
            })}
            {!network.edges.length && <text x="360" y="200" textAnchor="middle" fill="#a4b4bf" fontSize="13">{mode === 'conflicts' ? 'Aucune zone de conflit active dans le registre.' : 'Aucune liaison ne correspond à cette vue.'}</text>}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            {Object.entries(edgeLabels).map(([kind, label]) => <span key={kind} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: edgeColors[kind as keyof typeof edgeColors] }} />{label}</span>)}
            <span className="ml-auto">Épaisseur = {metricLabels[metric].toLocaleLowerCase('fr')}</span>
          </div>
        </div>

        <aside className="border border-border bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-primary">Fiche de posture</div>
          <div className="mt-1 text-base font-semibold text-foreground">{selectedNode?.flag} {selectedNode?.name ?? 'Aucun acteur'}</div>
          {selectedNode?.kind === 'theater' ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Effectifs</div><div className="font-mono text-sm text-orange-200">{selectedNode.personnelThousands.toFixed(1)} k</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Préparation</div><div className="font-mono text-sm text-orange-200">{selectedNode.readiness.toFixed(0)}/100</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Ravitaillement</div><div className="font-mono text-sm text-foreground">{selectedNode.supplyCoverageMonths.toFixed(1)} mois</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Risque accès</div><div className="font-mono text-sm text-red-300">{selectedNode.accessRisk.toFixed(0)}/100</div></div>
              </div>
              <div className="border-l-2 border-primary pl-2 text-muted-foreground">{selectedNode.mission ?? 'Mission non documentée.'}</div>
            </div>
          ) : selectedNode ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Effectifs actifs</div><div className="font-mono text-sm text-foreground">{selectedNode.personnelThousands.toFixed(0)} k</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Budget défense</div><div className="font-mono text-sm text-foreground">{selectedNode.budgetBillionUsd.toFixed(1)} Md$</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Théâtres</div><div className="font-mono text-sm text-orange-200">{selectedNode.theaterCount}</div></div>
                <div className="border border-border px-2 py-1.5"><div className="text-[10px] text-muted-foreground">Bases</div><div className="font-mono text-sm text-sky-300">{selectedNode.baseCount}</div></div>
              </div>
              <div className="border-l-2 border-primary pl-2 text-muted-foreground">Préparation moyenne : {selectedNode.readiness ? `${selectedNode.readiness.toFixed(0)}/100` : 'non documentée'} · accès à risque : {selectedNode.accessRisk.toFixed(0)}/100.</div>
            </div>
          ) : null}
          {nodeEdges.length ? (
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              {nodeEdges.map((edge) => {
                const counterpartId = edge.from === focusId ? edge.to : edge.from;
                const counterpart = network.nodes.find((node) => node.id === counterpartId);
                return <div key={edge.id} className="flex items-center justify-between gap-2"><span>{edge.kind === 'base' ? <Building2 className="mr-1 inline size-3 text-sky-200" /> : edge.kind === 'conflict' ? <Swords className="mr-1 inline size-3 text-red-300" /> : <Shield className="mr-1 inline size-3 text-orange-200" />}{counterpart?.flag} {counterpart?.name ?? counterpartId}</span><b>{edge.volume.toFixed(1)} k</b></div>;
              })}
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 border border-amber-400/40 bg-amber-400/5 p-2 text-xs text-amber-100"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Aucune liaison de défense documentée dans ce périmètre.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
