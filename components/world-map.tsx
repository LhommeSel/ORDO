'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { GeometryCollection, MultiPolygon, Polygon, Topology } from 'topojson-specification';

type MapMode = 'diplomacy' | 'intelligence' | 'military';

type WorldMapProps = {
  mode: MapMode;
  playerCountryId: string;
  metrics: Record<string, number>;
  selectedId: string;
  onSelect: (id: string, name: string) => void;
};

type MapEntity = {
  id: string;
  name: string;
  path?: string;
  point?: [number, number];
};

type AtlasProperties = { id?: string; name?: string; name_long?: string };
type AtlasTopology = Topology<{ features: GeometryCollection<AtlasProperties> }>;
type AtlasArea = Polygon<AtlasProperties> | MultiPolygon<AtlasProperties>;

const viewWidth = 960;
const viewHeight = 500;
// Le fond cartographique utilise quelques codes différents du registre ORDO
// (PSX/PSE, SDS/SSD) et des frontières contemporaines. Ces alias empêchent
// qu'une zone pourtant modélisée ouvre une fausse fiche « non modélisée ».
const historicalIds = new Set(['SRB', 'MNE', 'KOS', 'SDN', 'SDS']);
const atlasAliases: Record<string, string> = { PSX: 'PSE' };
// Les micro-États et quelques territoires ne possèdent pas de polygone
// exploitable dans le fond 110m. Un repère ponctuel les rend néanmoins
// sélectionnables au même titre que les grands pays ; la fiche complète reste
// accessible dans la liste sous la carte.
const fallbackCoordinates: Record<string, [number, number]> = {
  AND: [1.6, 42.5], ATG: [-61.8, 17.1], BRB: [-59.5, 13.2], BRN: [114.7, 4.5],
  BTN: [90.4, 27.5], CPV: [-24.0, 16.0], COM: [43.3, -11.7], DJI: [43.1, 11.6],
  DMA: [-61.4, 15.4], FJI: [178.0, -18.0], FSM: [158.2, 6.9], GRD: [-61.7, 12.1],
  KIR: [173.0, 1.8], LCA: [-61.0, 14.0], LIE: [9.5, 47.1], MHL: [171.2, 7.1],
  MCO: [7.4, 43.7], MNE: [19.3, 42.7], NRU: [166.9, -0.5], PLW: [134.5, 7.5],
  SMR: [12.5, 43.9], SSD: [31.3, 6.9], STP: [6.6, 0.2], TON: [-175.2, -21.2],
  TUV: [179.1, -8.5], VAT: [12.5, 41.9], VUT: [167.0, -16.2], WSM: [-172.1, -13.8],
  SAH: [-12.0, 24.0], FLK: [-59.0, -51.7], GRL: [-42.0, 72.0], ATF: [69.0, -49.0],
  PRI: [-66.5, 18.2], NCL: [165.6, -21.5], TWN: [121.0, 23.7], ATA: [0.0, -80.0],
  CYN: [33.0, 35.2], SOL: [46.0, 5.0],
};

export function WorldMap({ mode, metrics, selectedId, onSelect, playerCountryId }: WorldMapProps) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [spherePath, setSpherePath] = useState<string>();
  const [graticulePath, setGraticulePath] = useState<string>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const moved = useRef(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    void Promise.all([
      import('d3-geo'),
      import('topojson-client'),
      import('@d3-maps/atlas/world/countries/countries-110m'),
      import('i18n-iso-countries'),
      import('i18n-iso-countries/langs/fr.json'),
    ]).then(([d3, topojson, atlasModule, countriesModule, localeModule]) => {
      if (cancelled) return;
      const world = atlasModule.default as AtlasTopology;
      const countries = countriesModule.default;
      countries.registerLocale(localeModule.default);
      const topology = world;
      const collection = topojson.feature(topology, topology.objects.features);
      const geometries = topology.objects.features.geometries.filter((item): item is AtlasArea => item.type === 'Polygon' || item.type === 'MultiPolygon');
      const ordinary = collection.features
        .filter((item) => !historicalIds.has(String(item.properties?.id ?? '')))
        .map((item) => {
          const atlasId = String(item.properties?.id ?? 'UNK');
          const id = atlasAliases[atlasId] ?? atlasId;
          const fallback = String(item.properties?.name_long ?? item.properties?.name ?? id);
          return { id, name: countries.getName(id, 'fr') ?? fallback, geometry: item.geometry };
        });
      ordinary.push({ id: 'SRB', name: 'République fédérale de Yougoslavie', geometry: topojson.merge(topology, geometries.filter((item) => ['SRB', 'MNE', 'KOS'].includes(String(item.properties?.id)))) as GeoJSON.Geometry });
      ordinary.push({ id: 'SDN', name: 'Soudan', geometry: topojson.merge(topology, geometries.filter((item) => ['SDN', 'SDS'].includes(String(item.properties?.id)))) as GeoJSON.Geometry });
      const projection = d3.geoNaturalEarth1().fitExtent([[12, 14], [viewWidth - 12, viewHeight - 14]], { type: 'Sphere' });
      const path = d3.geoPath(projection);
      const represented = new Set(ordinary.map((entity) => entity.id));
      const mapped = ordinary.map((entity) => ({ id: entity.id, name: entity.name, path: path({ type: 'Feature', properties: { id: entity.id }, geometry: entity.geometry } as GeoJSON.Feature) ?? '' }));
      const points = Object.entries(fallbackCoordinates)
        .filter(([id]) => !represented.has(id))
        .flatMap(([id, coordinates]) => {
          const point = projection(coordinates);
          return point ? [{ id, name: countries.getName(id, 'fr') ?? id, point: point as [number, number] }] : [];
        });
      setEntities([...mapped, ...points]);
      setSpherePath(path({ type: 'Sphere' }) ?? undefined);
      setGraticulePath(path(d3.geoGraticule10()) ?? undefined);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  const bound = (x: number, size: number, k: number) => Math.max(size * (1 - k), Math.min(0, x));
  const zoom = (factor: number) => setTransform((current) => {
    const k = Math.max(1, Math.min(4, current.k * factor));
    return { k, x: bound(viewWidth / 2 - (viewWidth / 2 - current.x) * k / current.k, viewWidth, k), y: bound(viewHeight / 2 - (viewHeight / 2 - current.y) * k / current.k, viewHeight, k) };
  });
  const reset = () => setTransform({ x: 0, y: 0, k: 1 });

  const entityClass = (id: string) => {
    if (id === selectedId) return 'selected';
    if (id === playerCountryId) return 'player';
    const value = metrics[id];
    if (value === undefined) return 'unknown';
    if (mode === 'diplomacy') return value >= 65 ? 'high' : value >= 45 ? 'medium' : 'low';
    if (mode === 'intelligence') return value >= 75 ? 'high' : value >= 55 ? 'medium' : 'low';
    return value >= 75 ? 'high' : value >= 50 ? 'medium' : 'low';
  };

  return (
    <div className="world-map-wrap">
      {!entities.length && <output className="map-load-status">{loadError ? <><span>Carte indisponible. Les fiches et la liste des pays restent accessibles.</span><button type="button" onClick={() => setAttempt((n) => n + 1)}>Réessayer</button></> : 'Chargement de la carte…'}</output>}
      <div className="map-controls" aria-label="Contrôles de la carte">
        <button type="button" onClick={() => zoom(1.3)} aria-label="Zoomer"><Plus /></button>
        <button type="button" onClick={() => zoom(1 / 1.3)} aria-label="Dézoomer"><Minus /></button>
        <button type="button" onClick={reset} aria-label="Réinitialiser la carte"><LocateFixed /></button>
      </div>
      <svg
        className="world-map"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="group"
        aria-label="Carte mondiale interactive, repères historiques simplifiés"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          moved.current = false;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId || transform.k === 1) return;
          const currentDrag = drag.current;
          const dx = event.clientX - currentDrag.x;
          const dy = event.clientY - currentDrag.y;
          if (!moved.current && Math.hypot(dx, dy) < 5) return;
          moved.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          const matrix = event.currentTarget.getScreenCTM();
          if (!matrix) return;
          const scale = matrix.a;
          if (!scale) return;
          setTransform((current) => ({ ...current, x: bound(currentDrag.originX + dx / scale, viewWidth, current.k), y: bound(currentDrag.originY + dy / scale, viewHeight, current.k) }));
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; moved.current = false; }}
        onLostPointerCapture={() => { drag.current = null; }}
        onPointerLeave={() => { if (!moved.current) drag.current = null; }}
      >
        <path className="map-sphere" d={spherePath ?? undefined} />
        <path className="map-graticule" d={graticulePath ?? undefined} />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          {entities.map((entity) => {
            const common = {
              className: `map-country ${entityClass(entity.id)}`,
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': entity.name,
              'aria-pressed': entity.id === selectedId,
              onClick: (event: ReactMouseEvent<SVGElement>) => { event.stopPropagation(); if (!moved.current) onSelect(entity.id, entity.name); },
              onKeyDown: (event: ReactKeyboardEvent<SVGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(entity.id, entity.name); } },
            };
            return entity.point
              ? <circle key={entity.id} {...common} cx={entity.point[0]} cy={entity.point[1]} r={entity.id === selectedId ? 4 : 2.5}><title>{entity.name} · repère ponctuel</title></circle>
              : <path key={entity.id} {...common} d={entity.path ?? ''} vectorEffect="non-scaling-stroke"><title>{entity.name}</title></path>;
          })}
        </g>
      </svg>
      <p className="map-historical-note">REPÈRES SIMPLIFIÉS · Soudan et Yougoslavie regroupés pour 2000 · points ponctuels pour les petits États sans polygone · contours issus d’un fond contemporain, non exhaustivement historicisé · Zoom par boutons, déplacement après zoom</p>
    </div>
  );
}

export type { MapMode };
