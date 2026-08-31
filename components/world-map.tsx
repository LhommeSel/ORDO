'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';

type MapMode = 'diplomacy' | 'intelligence' | 'military';

type WorldMapProps = {
  mode: MapMode;
  metrics: Record<string, number>;
  selectedId: string;
  onSelect: (id: string, name: string) => void;
};

type MapEntity = {
  id: string;
  name: string;
  path: string;
};

const viewWidth = 960;
const viewHeight = 500;
const historicalIds = new Set(['SRB', 'MNE', 'KOS', 'SDN', 'SSD']);

export function WorldMap({ mode, metrics, selectedId, onSelect }: WorldMapProps) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [spherePath, setSpherePath] = useState<string>();
  const [graticulePath, setGraticulePath] = useState<string>();
  const drag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      import('d3-geo'),
      import('topojson-client'),
      import('@d3-maps/atlas/world/countries/countries-110m'),
      import('i18n-iso-countries'),
      import('i18n-iso-countries/langs/fr.json'),
    ]).then(([d3, topojson, atlasModule, countriesModule, localeModule]) => {
      if (cancelled) return;
      const world = atlasModule.default as any;
      const countries = countriesModule.default;
      countries.registerLocale(localeModule.default);
      const topology = world as any;
      const collection = topojson.feature(topology, topology.objects.features) as unknown as GeoJSON.FeatureCollection;
      const geometries = topology.objects.features.geometries as any[];
      const ordinary = collection.features
        .filter((item) => !historicalIds.has(String(item.properties?.id ?? '')))
        .map((item) => {
          const id = String(item.properties?.id ?? 'UNK');
          const fallback = String(item.properties?.name_long ?? item.properties?.name ?? id);
          return { id, name: countries.getName(id, 'fr') ?? fallback, geometry: item.geometry };
        });
      ordinary.push({ id: 'YUG', name: 'République fédérale de Yougoslavie', geometry: topojson.merge(topology, geometries.filter((item) => ['SRB', 'MNE', 'KOS'].includes(String(item.properties?.id)))) as GeoJSON.Geometry });
      ordinary.push({ id: 'SDN', name: 'Soudan', geometry: topojson.merge(topology, geometries.filter((item) => ['SDN', 'SSD'].includes(String(item.properties?.id)))) as GeoJSON.Geometry });
      const projection = d3.geoNaturalEarth1().fitExtent([[12, 14], [viewWidth - 12, viewHeight - 14]], { type: 'Sphere' });
      const path = d3.geoPath(projection);
      setEntities(ordinary.map((entity) => ({ id: entity.id, name: entity.name, path: path({ type: 'Feature', properties: { id: entity.id }, geometry: entity.geometry } as GeoJSON.Feature) ?? '' })));
      setSpherePath(path({ type: 'Sphere' }) ?? undefined);
      setGraticulePath(path(d3.geoGraticule10()) ?? undefined);
    });
    return () => { cancelled = true; };
  }, []);

  const zoom = (factor: number) => setTransform((current) => ({ ...current, k: Math.max(1, Math.min(4, current.k * factor)) }));
  const reset = () => setTransform({ x: 0, y: 0, k: 1 });

  const entityClass = (id: string) => {
    if (id === selectedId) return 'selected';
    if (id === 'FRA') return 'player';
    const value = metrics[id];
    if (value === undefined) return 'unknown';
    if (mode === 'diplomacy') return value >= 65 ? 'high' : value >= 45 ? 'medium' : 'low';
    if (mode === 'intelligence') return value >= 75 ? 'high' : value >= 55 ? 'medium' : 'low';
    return value >= 75 ? 'high' : value >= 50 ? 'medium' : 'low';
  };

  return (
    <div className="world-map-wrap">
      <div className="map-controls" aria-label="Contrôles de la carte">
        <button type="button" onClick={() => zoom(1.3)} aria-label="Zoomer"><Plus /></button>
        <button type="button" onClick={() => zoom(1 / 1.3)} aria-label="Dézoomer"><Minus /></button>
        <button type="button" onClick={reset} aria-label="Réinitialiser la carte"><LocateFixed /></button>
      </div>
      <svg
        className="world-map"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Carte politique interactive du monde en janvier 2000"
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId || transform.k === 1) return;
          setTransform((current) => ({ ...current, x: drag.current!.originX + event.clientX - drag.current!.x, y: drag.current!.originY + event.clientY - drag.current!.y }));
        }}
        onPointerUp={() => { drag.current = null; }}
      >
        <path className="map-sphere" d={spherePath ?? undefined} />
        <path className="map-graticule" d={graticulePath ?? undefined} />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          {entities.map((entity) => (
            <path
              key={entity.id}
              d={entity.path}
              className={`map-country ${entityClass(entity.id)}`}
              vectorEffect="non-scaling-stroke"
              role="button"
              tabIndex={0}
              aria-label={entity.name}
              onClick={(event) => { event.stopPropagation(); onSelect(entity.id, entity.name); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(entity.id, entity.name); } }}
            >
              <title>{entity.name}</title>
            </path>
          ))}
        </g>
      </svg>
      <p className="map-historical-note">FRONTIÈRES POLITIQUES 2000 · Soudan unifié · République fédérale de Yougoslavie · Timor oriental sous administration transitoire</p>
    </div>
  );
}

export type { MapMode };
