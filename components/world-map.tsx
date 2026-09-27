'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { mapCapitals2000 } from '@/lib/map-capitals-2000';
import { LocateFixed, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import type { GeometryCollection, MultiPolygon, Polygon, Topology } from 'topojson-specification';

type MapMode = 'base' | 'diplomacy' | 'intelligence' | 'military';

type WorldMapProps = {
  mode: MapMode;
  playerCountryId: string;
  metrics: Record<string, number>;
  /** Valeur lisible affichée dans l’infobulle de chaque pays pour le thème actif. */
  metricLabels?: Record<string, string>;
  selectedId: string;
  onSelect: (id: string, name: string) => void;
  /** Fiche rendue dans un encadré flottant ancré au pays sélectionné. */
  selectedOverlay?: ReactNode;
  /** Repères optionnels des pays d'accueil d'un déploiement militaire. */
  deploymentMarkers?: Array<{
    id: string;
    countryId: string;
    label: string;
    personnelThousands: number;
    mission: string;
  }>;
  /** Repères des zones de guerre actives, un point par pays impliqué. */
  warZoneMarkers?: Array<{
    id: string;
    countryId: string;
    label: string;
    intensity: 'low' | 'moderate' | 'high' | 'critical';
  }>;
  /** Gisements recensés : repères régionaux, distincts des faits de chronologie. */
  resourceMarkers?: Array<{
    id: string;
    label: string;
    resourceId: string;
    category: 'energy' | 'metal' | 'precious' | 'fertilizer' | 'strategic';
    coordinates: [number, number];
    identifiedStock: number;
    legalStatus: 'undisputed' | 'contested' | 'shared' | 'occupied';
  }>;
  /** Sites physiques effectivement lancés : distincts des gisements encore potentiels. */
  physicalProjectMarkers?: Array<{
    id: string;
    countryId: string;
    label: string;
    resource: string;
    phase: 'preparation' | 'construction' | 'commissioning' | 'operating' | 'suspended' | 'closed';
    status: 'active' | 'awaiting_decision' | 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';
    progressPct: number;
    coordinates?: [number, number] | null;
  }>;
  /** Liens documentés rendus par le calque actif : relation, commerce ou énergie. */
  links?: Array<{
    id: string;
    fromId: string;
    toId: string;
    label: string;
    kind: 'relation' | 'trade' | 'energy';
    weight?: number;
  }>;
  /** Pays mis en avant par la chronologie des faits survenus. */
  focusCountryId?: string;
  focusCountryIds?: string[];
  /** Coordonnée territoriale précise d'un fait local (par exemple une mine). */
  focusCoordinates?: [number, number] | null;
  focusLocationLabel?: string;
  /** Change même si deux faits successifs concernent le même pays. */
  focusKey?: string;
  /** Le code couleur sépare un fait ponctuel d’un dossier qui continuera d’évoluer. */
  focusKind?: 'event' | 'dossier' | 'trend' | 'player';
  /** Vue immersive : la carte masque temporairement les cadres de commande. */
  immersive?: boolean;
  onToggleImmersive?: () => void;
};

type MapEntity = {
  id: string;
  name: string;
  path?: string;
  point?: [number, number];
};

type DeploymentPoint = {
  id: string;
  countryId: string;
  label: string;
  personnelThousands: number;
  mission: string;
  point: [number, number];
};

type WarZonePoint = {
  id: string;
  countryId: string;
  label: string;
  intensity: 'low' | 'moderate' | 'high' | 'critical';
  point: [number, number];
};

type ResourcePoint = {
  id: string;
  label: string;
  resourceId: string;
  category: 'energy' | 'metal' | 'precious' | 'fertilizer' | 'strategic';
  identifiedStock: number;
  legalStatus: 'undisputed' | 'contested' | 'shared' | 'occupied';
  point: [number, number];
};

type PhysicalProjectPoint = NonNullable<WorldMapProps['physicalProjectMarkers']>[number] & {
  point: [number, number];
};

type MapLinkPoint = {
  id: string;
  label: string;
  kind: 'relation' | 'trade' | 'energy';
  weight: number;
  from: [number, number];
  to: [number, number];
};

type AtlasProperties = { id?: string; name?: string; name_long?: string };
type AtlasTopology = Topology<{ features: GeometryCollection<AtlasProperties> }>;
type AtlasArea = Polygon<AtlasProperties> | MultiPolygon<AtlasProperties>;

// Palette politique stable : les teintes réservées correspondent aux pays
// explicitement demandés. Les autres teintes sont volontairement assez
// distinctes pour rester lisibles sur une carte sombre, sans prétendre
// représenter une donnée analytique.
const mapTonePalette = [
  '#18365c', '#9e3d4c', '#c9a52e', '#252b33',
  '#2f7d4b', '#b86f52', '#1f5b3a', '#73b8df',
  '#855a3a', '#c6aa72', '#c9272c', '#3c3b6e',
  '#5b7f7a', '#8e4f4f', '#4b5a8a', '#7c6a4b',
];
const forcedMapTones: Record<string, number> = {
  FRA: 0, GBR: 1, ESP: 2, DEU: 3,
  IRL: 4, AUT: 5, RUS: 6, SWE: 7,
  MAR: 8, EGY: 9, CHN: 10, USA: 11,
};

// Les points de micro-États n'existent pas comme polygones dans tous les
// fonds cartographiques. Ces relations de voisinage évitent néanmoins deux
// teintes identiques pour les cas visibles et les plus proches.
const fallbackMapAdjacency: Record<string, string[]> = {
  AND: ['FRA', 'ESP'], MCO: ['FRA'], LIE: ['CHE', 'AUT'], SMR: ['ITA'], VAT: ['ITA'],
  BRN: ['MYS'], BTN: ['IND', 'CHN'],
};

function assignMapTones(ids: string[], adjacency: Map<string, Set<string>>) {
  const uniqueIds = [...new Set(ids)];
  const order = uniqueIds.sort((a, b) => {
    const forcedDelta = Number(forcedMapTones[b] !== undefined) - Number(forcedMapTones[a] !== undefined);
    if (forcedDelta) return forcedDelta;
    const degreeDelta = (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0);
    return degreeDelta || a.localeCompare(b);
  });
  const tones: Record<string, number> = {};
  const usage = Array.from({ length: mapTonePalette.length }, () => 0);
  const stableSeed = (id: string) => {
    let hash = 7;
    for (const character of id) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    return hash;
  };
  for (const id of order) {
    const blocked = new Set([...adjacency.get(id) ?? []].map((neighbor) => tones[neighbor]).filter((tone): tone is number => typeof tone === 'number'));
    const forced = forcedMapTones[id];
    let selected = forced !== undefined && !blocked.has(forced) ? forced : -1;
    if (selected < 0) {
      const available = mapTonePalette.map((_tone, index) => index).filter((index) => !blocked.has(index));
      // Répartir la palette au lieu de prendre systématiquement la première
      // teinte libre : la carte reste propre aux frontières, mais ne retombe
      // plus artificiellement sur seulement quatre couleurs.
      const minimumUsage = Math.min(...available.map((index) => usage[index]));
      const balanced = available.filter((index) => usage[index] === minimumUsage);
      selected = balanced[stableSeed(id) % balanced.length] ?? available[0] ?? 0;
    }
    tones[id] = selected;
    usage[selected] += 1;
  }
  return tones;
}

const viewWidth = 960;
const viewHeight = 500;
const initialOverlayOffset = { x: 40, y: -96 };
// La carte est volontairement cadrée un peu plus près dès son ouverture. Le
// centre reste celui du monde, avec une marge suffisante pour que les boutons
// de zoom permettent ensuite de retrouver une vue plus large.
const defaultTransform = {
  x: -(viewWidth * 0.09),
  y: -(viewHeight * 0.045),
  k: 1.18,
};
// Le fond cartographique utilise quelques codes différents du registre ÉTAT-NATION
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

export function WorldMap({ mode, metrics, metricLabels = {}, selectedId, onSelect, selectedOverlay, playerCountryId, deploymentMarkers = [], warZoneMarkers = [], resourceMarkers = [], physicalProjectMarkers = [], links = [], focusCountryId, focusCountryIds = [], focusCoordinates, focusLocationLabel, focusKey, focusKind = 'event', immersive = false, onToggleImmersive }: WorldMapProps) {
  const [transform, setTransform] = useState(defaultTransform);
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [spherePath, setSpherePath] = useState<string>();
  const [graticulePath, setGraticulePath] = useState<string>();
  const [capitals, setCapitals] = useState<Array<{ countryId: string; name: string; point: [number, number] }>>([]);
  const [showCapitals, setShowCapitals] = useState(true);
  const animation = useRef<number | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const coordinateProjection = useRef<((coordinates: [number, number]) => [number, number] | null) | null>(null);
  const countryPoints = useMemo(() => new Map(entities.filter((entity) => entity.point).map((entity) => [entity.id, entity.point!])), [entities]);
  const deploymentPoints: DeploymentPoint[] = deploymentMarkers.flatMap((marker) => {
    const point = countryPoints.get(marker.countryId);
    return point ? [{ ...marker, point }] : [];
  });
  const warZonePoints: WarZonePoint[] = warZoneMarkers.flatMap((marker) => {
    const point = countryPoints.get(marker.countryId);
    return point ? [{ ...marker, point }] : [];
  });
  const resourcePoints: ResourcePoint[] = resourceMarkers.flatMap((marker) => {
    const point = coordinateProjection.current?.(marker.coordinates);
    return point ? [{ ...marker, point }] : [];
  });
  const physicalProjectPoints: PhysicalProjectPoint[] = physicalProjectMarkers.flatMap((marker) => {
    const point = marker.coordinates ? coordinateProjection.current?.(marker.coordinates) : countryPoints.get(marker.countryId);
    return point ? [{ ...marker, point }] : [];
  });
  const linkPoints: MapLinkPoint[] = links.flatMap((link) => {
    const from = countryPoints.get(link.fromId), to = countryPoints.get(link.toId);
    return from && to && Math.abs(from[0] - to[0]) <= viewWidth * .42 ? [{ ...link, weight: link.weight ?? 1, from, to }] : [];
  });
  const [entityTones, setEntityTones] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const moved = useRef(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayDrag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const [overlayOffset, setOverlayOffset] = useState(initialOverlayOffset);
  const [overlayDocked, setOverlayDocked] = useState(true);
  const [overlayPositionOverride, setOverlayPositionOverride] = useState<{ x: number; y: number } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: viewWidth, height: viewHeight });
  const [territorialFocusPoint, setTerritorialFocusPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const update = () => setViewportSize({ width: element.clientWidth || viewWidth, height: element.clientHeight || viewHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Chaque nouveau pays repart près de son repère ; le déplacement manuel
    // reste ensuite conservé tant que la fiche sélectionnée ne change pas.
    setOverlayOffset(initialOverlayOffset);
    setOverlayDocked(true);
    setOverlayPositionOverride(null);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    void Promise.all([
      import('d3-geo'),
      import('topojson-client'),
      // Le fond 50m conserve un poids raisonnable et des contours propres à
      // l’écran de jeu ; le zoom est renforcé par la projection vectorielle.
      import('@d3-maps/atlas/world/countries/countries-50m'),
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
      const groupAtlasId = (atlasId: string) => {
        if (atlasAliases[atlasId]) return atlasAliases[atlasId];
        if (['SRB', 'MNE', 'KOS'].includes(atlasId)) return 'SRB';
        if (['SDN', 'SDS'].includes(atlasId)) return 'SDN';
        return atlasId;
      };
      const adjacency = new Map<string, Set<string>>();
      const addNeighbor = (a: string, b: string) => {
        if (!a || !b || a === 'UNK' || b === 'UNK' || a === b) return;
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
      };
      const atlasIds = geometries.map((item) => groupAtlasId(String(item.properties?.id ?? 'UNK')));
      topojson.neighbors(geometries).forEach((neighbors, index) => {
        neighbors.forEach((neighborIndex) => addNeighbor(atlasIds[index], atlasIds[neighborIndex]));
      });
      Object.entries(fallbackMapAdjacency).forEach(([id, neighbors]) => neighbors.forEach((neighbor) => addNeighbor(id, neighbor)));
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
      coordinateProjection.current = (coordinates) => projection(coordinates) as [number, number] | null;
      const path = d3.geoPath(projection);
      const represented = new Set(ordinary.map((entity) => entity.id));
      const countryPoints = new Map<string, [number, number]>();
      // Certains pays sont des MultiPolygon qui incluent des territoires
      // ultramarins (la France en particulier). Leur centroïde global est
      // alors tiré dans l'Atlantique, parfois jusqu'à la péninsule Ibérique.
      // Le repère doit représenter le territoire principal affiché : on
      // utilise donc le plus grand polygone avant de calculer le centroïde.
      const representativeCentroid = (geometry: GeoJSON.Geometry) => {
        if (geometry.type !== 'MultiPolygon' || geometry.coordinates.length === 0) {
          return d3.geoCentroid({ type: 'Feature', geometry } as GeoJSON.Feature);
        }
        const largest = geometry.coordinates
          .map((coordinates) => ({ type: 'Polygon' as const, coordinates }))
          .sort((a, b) => d3.geoArea(b) - d3.geoArea(a))[0];
        return largest
          ? d3.geoCentroid({ type: 'Feature', geometry: largest } as GeoJSON.Feature)
          : d3.geoCentroid({ type: 'Feature', geometry } as GeoJSON.Feature);
      };
      ordinary.forEach((entity) => {
        const centroid = representativeCentroid(entity.geometry);
        const point = projection(centroid);
        if (point) countryPoints.set(entity.id, point as [number, number]);
      });
      const mapped = ordinary.map((entity) => ({ id: entity.id, name: entity.name, path: path({ type: 'Feature', properties: { id: entity.id }, geometry: entity.geometry } as GeoJSON.Feature) ?? '', point: countryPoints.get(entity.id) }));
      const points = Object.entries(fallbackCoordinates)
        .filter(([id]) => !represented.has(id))
        .flatMap(([id, coordinates]) => {
          const point = projection(coordinates);
          return point ? [{ id, name: countries.getName(id, 'fr') ?? id, point: point as [number, number] }] : [];
        });
      const allEntities = [...mapped, ...points];
      setEntities(allEntities);
      setTerritorialFocusPoint(focusCoordinates ? coordinateProjection.current(focusCoordinates) : null);
      setEntityTones(assignMapTones(allEntities.map((entity) => entity.id), adjacency));
      setCapitals(mapCapitals2000.flatMap((capital) => {
        const point = projection(capital.coordinates);
        return point ? [{ countryId: capital.countryId, name: capital.name, point: point as [number, number] }] : [];
      }));
      setSpherePath(path({ type: 'Sphere' }) ?? undefined);
      setGraticulePath(path(d3.geoGraticule10()) ?? undefined);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    setTerritorialFocusPoint(focusCoordinates && coordinateProjection.current
      ? coordinateProjection.current(focusCoordinates)
      : null);
  }, [focusCoordinates?.[0], focusCoordinates?.[1]]);

  const bound = (x: number, size: number, k: number) => Math.max(size * (1 - k), Math.min(0, x));
  const stopCameraAnimation = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
  };
  useEffect(() => {
    stopCameraAnimation();
    if (!focusCountryId && !territorialFocusPoint) return;
    const point = territorialFocusPoint ?? entities.find((entity) => entity.id === focusCountryId)?.point;
    if (!point) return;
    const from = transformRef.current;
    const k = territorialFocusPoint ? 4.2 : 2.8;
    const target = { k, x: bound(viewWidth / 2 - point[0] * k, viewWidth, k), y: bound(viewHeight / 2 - point[1] * k, viewHeight, k) };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTransform(target); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 780);
      const eased = progress * progress * (3 - 2 * progress);
      setTransform({ x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, k: from.k + (target.k - from.k) * eased });
      animation.current = progress < 1 ? requestAnimationFrame(animate) : null;
    };
    animation.current = requestAnimationFrame(animate);
    return stopCameraAnimation;
  }, [entities, focusCountryId, focusKey, territorialFocusPoint]);
  const zoomAt = (factor: number, anchorX = viewWidth / 2, anchorY = viewHeight / 2) => {
    stopCameraAnimation();
    setTransform((current) => {
    const k = Math.max(1, Math.min(16, current.k * factor));
    const ratio = k / current.k;
    return {
      k,
      x: bound(anchorX - (anchorX - current.x) * ratio, viewWidth, k),
      y: bound(anchorY - (anchorY - current.y) * ratio, viewHeight, k),
    };
    });
  };
  const zoom = (factor: number) => zoomAt(factor);
  const reset = () => { stopCameraAnimation(); setTransform(defaultTransform); };
  const selectedEntity = entities.find((entity) => entity.id === selectedId);
  const selectedAnchor = selectedEntity?.point ?? [viewWidth / 2, viewHeight / 2] as [number, number];
  const transformedAnchor = [selectedAnchor[0] * transform.k + transform.x, selectedAnchor[1] * transform.k + transform.y] as [number, number];
  const svgMatrix = svgRef.current?.getScreenCTM();
  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const mapWidth = viewportSize.width;
  const mapHeight = viewportSize.height;
  const overlayWidth = overlayRef.current?.offsetWidth || 360;
  const overlayHeight = overlayRef.current?.offsetHeight || 520;
  const overlayAnchor = svgMatrix && wrapRect
    ? [
      svgMatrix.a * transformedAnchor[0] + svgMatrix.c * transformedAnchor[1] + svgMatrix.e - wrapRect.left + overlayOffset.x * svgMatrix.a,
      svgMatrix.b * transformedAnchor[0] + svgMatrix.d * transformedAnchor[1] + svgMatrix.f - wrapRect.top + overlayOffset.y * svgMatrix.d,
    ] as [number, number]
    : [transformedAnchor[0] + overlayOffset.x, transformedAnchor[1] + overlayOffset.y] as [number, number];
  const anchoredOverlayPosition = {
    x: Math.max(8, Math.min(mapWidth - overlayWidth - 8, overlayAnchor[0])),
    y: Math.max(8, Math.min(mapHeight - overlayHeight - 8, overlayAnchor[1])),
  };
  const overlayPosition = overlayDocked
    ? { x: Math.max(8, mapWidth - overlayWidth - 12), y: 12 }
    : overlayPositionOverride ?? anchoredOverlayPosition;
  const beginOverlayDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button,a,input,select,textarea')) return;
    event.stopPropagation();
    const origin = overlayPosition;
    overlayDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: origin.x, originY: origin.y };
    setOverlayDocked(false);
    setOverlayPositionOverride(origin);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveOverlay = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = overlayDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    setOverlayPositionOverride({
      x: Math.max(8, Math.min(mapWidth - overlayWidth - 8, current.originX + event.clientX - current.x)),
      y: Math.max(8, Math.min(mapHeight - overlayHeight - 8, current.originY + event.clientY - current.y)),
    });
  };
  const endOverlayDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (overlayDrag.current?.pointerId === event.pointerId) overlayDrag.current = null;
  };

  const entityClass = (id: string) => {
    const toneClass = `map-tone-${entityTones[id] ?? 0}`;
    const timelineClass = focusCountryIds.includes(id) ? ` timeline-focus ${focusKind}` : '';
    if (id === selectedId) return `${toneClass} selected${timelineClass}`;
    if (id === playerCountryId) return `${toneClass} player${timelineClass}`;
    if (mode === 'base') return `${toneClass}${timelineClass}`;
    const value = metrics[id];
    if (value === undefined) return `${toneClass} map-metric unknown${timelineClass}`;
    if (mode === 'diplomacy') return `${toneClass} map-metric ${value >= 65 ? 'high' : value >= 45 ? 'medium' : 'low'}${timelineClass}`;
    if (mode === 'intelligence') return `${toneClass} map-metric ${value >= 75 ? 'high' : value >= 55 ? 'medium' : 'low'}${timelineClass}`;
    return `${toneClass} map-metric ${value >= 75 ? 'high' : value >= 50 ? 'medium' : 'low'}${timelineClass}`;
  };
  const focusPoints = entities.filter((entity) => focusCountryIds.includes(entity.id) && entity.point);

  return (
    <div ref={wrapRef} className="world-map-wrap">
      {!entities.length && <output className="map-load-status">{loadError ? <><span>Carte indisponible. Les fiches et la liste des pays restent accessibles.</span><button type="button" onClick={() => setAttempt((n) => n + 1)}>Réessayer</button></> : 'Chargement de la carte…'}</output>}
      <div className="map-controls" aria-label="Contrôles de la carte">
        <button type="button" className="map-capitals-toggle" aria-pressed={showCapitals} onClick={() => setShowCapitals((visible) => !visible)} title="Afficher ou masquer les capitales">Capitales</button>
        <span className="map-zoom-value" aria-label="Niveau de zoom">{transform.k.toFixed(1)}×</span>
        <button type="button" disabled={transform.k >= 16} onClick={() => zoom(1.3)} aria-label="Zoomer"><Plus /></button>
        <button type="button" disabled={transform.k <= 1} onClick={() => zoom(1 / 1.3)} aria-label="Dézoomer"><Minus /></button>
        <button type="button" onClick={reset} aria-label="Réinitialiser la carte"><LocateFixed /></button>
        {onToggleImmersive && <button type="button" onClick={onToggleImmersive} aria-label={immersive ? 'Quitter la vue immersive' : 'Ouvrir la carte en plein écran'} title={immersive ? 'Quitter la vue immersive · Échap' : 'Vue immersive'}>{immersive ? <Minimize2 /> : <Maximize2 />}</button>}
      </div>
      <svg
        className="world-map"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio={immersive ? 'xMidYMid slice' : 'xMidYMid meet'}
        shapeRendering="geometricPrecision"
        role="group"
        aria-label="Carte mondiale interactive, repères historiques simplifiés"
        ref={svgRef}
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const matrix = event.currentTarget.getScreenCTM();
          const point = matrix
            ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
            : { x: viewWidth / 2, y: viewHeight / 2 };
          const delta = Math.max(-120, Math.min(120, event.deltaY));
          zoomAt(Math.exp(-delta * 0.0022), point.x, point.y);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (event.detail > 1) {
            event.preventDefault();
            event.stopPropagation();
            drag.current = null;
            moved.current = true;
            return;
          }
          stopCameraAnimation();
          moved.current = false;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId || transformRef.current.k === 1) return;
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
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            drag.current = null;
          }
        }}
        onPointerCancel={() => { drag.current = null; moved.current = false; }}
        onLostPointerCapture={() => { drag.current = null; }}
        onPointerLeave={() => { if (!moved.current) drag.current = null; }}
      >
        <g className="map-transform-layer" transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          <path className="map-sphere" d={spherePath ?? undefined} />
          <path className="map-graticule" d={graticulePath ?? undefined} />
          {entities.map((entity) => {
            const common = {
              className: `map-country ${entityClass(entity.id)}`,
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': entity.name,
              'aria-pressed': entity.id === selectedId,
              onClick: (event: ReactMouseEvent<SVGElement>) => { event.stopPropagation(); if (!moved.current && event.detail < 2) { setOverlayOffset(initialOverlayOffset); setOverlayDocked(true); setOverlayPositionOverride(null); onSelect(entity.id, entity.name); } },
              onKeyDown: (event: ReactKeyboardEvent<SVGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(entity.id, entity.name); } },
            };
            return entity.path
              ? <path key={entity.id} {...common} d={entity.path} vectorEffect="non-scaling-stroke"><title>{entity.name}{metricLabels[entity.id] ? ` · ${metricLabels[entity.id]}` : ''}</title></path>
              : entity.point
                ? <circle key={entity.id} {...common} cx={entity.point[0]} cy={entity.point[1]} r={(entity.id === selectedId ? 3 : 2) / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke"><title>{entity.name}{metricLabels[entity.id] ? ` · ${metricLabels[entity.id]}` : ' · repère ponctuel'}</title></circle>
                : null;
          })}
          {showCapitals && transform.k >= 2 && <g className="map-capitals" aria-label="Capitales en 2000">
            {capitals.filter((capital) => {
              const x = capital.point[0] * transform.k + transform.x;
              const y = capital.point[1] * transform.k + transform.y;
              return x > -20 && x < viewWidth + 20 && y > -20 && y < viewHeight + 20;
            }).map((capital) => <g key={`${capital.countryId}-${capital.name}`} transform={`translate(${capital.point[0]} ${capital.point[1]}) scale(${1 / transform.k})`}>
              <circle r="2" /><title>{capital.name} · capitale en 2000</title>
              {(transform.k >= 5 || capital.countryId === selectedId || capital.countryId === focusCountryId) && <text x="4" y="-3">{capital.name}</text>}
            </g>)}
          </g>}
          {resourcePoints.length > 0 && <g className="map-resource-layer" aria-label="Gisements et bassins de ressources">
            {resourcePoints.map((marker) => <g key={marker.id} className={`map-resource-marker ${marker.category} ${marker.legalStatus}`} transform={`translate(${marker.point[0]} ${marker.point[1]})`}>
              <circle className="map-resource-halo" r={5 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <circle className="map-resource-dot" r={1.8 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <title>{marker.label} · {marker.resourceId} · {marker.identifiedStock.toLocaleString('fr-FR')} unités identifiées · statut {marker.legalStatus}</title>
            </g>)}
          </g>}
          {physicalProjectPoints.length > 0 && <g className="map-physical-project-layer" aria-label="Sites physiques développés">
            {physicalProjectPoints.map((marker) => <g
              key={marker.id}
              className={`map-physical-project-marker ${marker.phase} ${marker.status}`}
              transform={`translate(${marker.point[0]} ${marker.point[1]})`}
              role="button"
              tabIndex={0}
              aria-label={`${marker.label} · ${marker.phase} · ${Math.round(marker.progressPct)} %`}
              onClick={(event) => { event.stopPropagation(); if (!moved.current) onSelect(marker.countryId, marker.label); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(marker.countryId, marker.label); } }}
            >
              <circle className="map-physical-project-halo" r={7 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <rect className="map-physical-project-core" x={-2.7 / Math.sqrt(transform.k)} y={-2.7 / Math.sqrt(transform.k)} width={5.4 / Math.sqrt(transform.k)} height={5.4 / Math.sqrt(transform.k)} transform="rotate(45)" vectorEffect="non-scaling-stroke" />
              <title>{marker.label} · {marker.resource} · {marker.phase} · progression {Math.round(marker.progressPct)} %</title>
            </g>)}
          </g>}
          {focusPoints.length > 0 && (
            <g className={`map-timeline-focus-layer ${focusKind}`} aria-label="Lieu de l’événement en cours">
              {focusPoints.map((entity) => (
                <g key={`timeline-focus-${entity.id}`}>
                  <circle className="map-timeline-focus-ring" cx={entity.point![0]} cy={entity.point![1]} r={6 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
                  <circle className="map-timeline-focus-dot" cx={entity.point![0]} cy={entity.point![1]} r={1.8 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
          )}
          {territorialFocusPoint && <g className="map-territorial-focus-layer" aria-label={focusLocationLabel ? `Événement localisé : ${focusLocationLabel}` : 'Événement localisé'}>
            <circle className="map-territorial-focus-ring" cx={territorialFocusPoint[0]} cy={territorialFocusPoint[1]} r={8 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
            <circle className="map-territorial-focus-dot" cx={territorialFocusPoint[0]} cy={territorialFocusPoint[1]} r={2.2 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
            <title>{focusLocationLabel ?? 'Lieu précis de l’événement'}</title>
          </g>}
          {linkPoints.length > 0 && (
            <g className="map-link-layer" aria-label="Liens internationaux documentés">
              {linkPoints.map((link) => {
                const midX = (link.from[0] + link.to[0]) / 2;
                const midY = (link.from[1] + link.to[1]) / 2;
                const curve = Math.max(12, Math.min(46, Math.abs(link.from[0] - link.to[0]) * 0.12));
                const controlY = midY - curve;
                return (
                  <g key={link.id} className={`map-link ${link.kind}`}>
                    <path
                      d={`M ${link.from[0]} ${link.from[1]} Q ${midX} ${controlY} ${link.to[0]} ${link.to[1]}`}
                      style={{ strokeWidth: Math.max(0.8, Math.min(2.3, link.weight)) }}
                    />
                    <circle cx={link.from[0]} cy={link.from[1]} r={1.3 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
                    <circle cx={link.to[0]} cy={link.to[1]} r={1.3 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
                    <title>{link.label}</title>
                  </g>
                );
              })}
            </g>
          )}
          {deploymentPoints.length > 0 && <g className="map-deployment-layer" aria-label="Déploiements militaires ventilés par pays">
            {deploymentPoints.map((marker) => <g
              key={marker.id}
              className="map-deployment-marker"
              role="button"
              tabIndex={0}
              aria-label={`${marker.label} · ${marker.personnelThousands} milliers de personnels`}
              onClick={(event) => { event.stopPropagation(); if (!moved.current) onSelect(marker.countryId, marker.label); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(marker.countryId, marker.label); } }}
            >
              <circle className="map-deployment-halo" cx={marker.point[0]} cy={marker.point[1]} r={Math.max(4, Math.min(9, 3 + marker.personnelThousands / 16)) / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <circle className="map-deployment-dot" cx={marker.point[0]} cy={marker.point[1]} r={2.4 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <title>{marker.label} · {marker.personnelThousands} k · {marker.mission}</title>
            </g>)}
          </g>}
          {warZonePoints.length > 0 && <g className="map-war-zone-layer" aria-label="Zones de guerre actives">
            {warZonePoints.map((marker) => <g
              key={marker.id}
              className={`map-war-zone-marker ${marker.intensity}`}
              role="button"
              tabIndex={0}
              aria-label={`${marker.label} · intensité ${marker.intensity}`}
              onClick={(event) => { event.stopPropagation(); if (!moved.current) onSelect(marker.countryId, marker.label); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(marker.countryId, marker.label); } }}
            >
              <circle className="map-war-zone-ring" cx={marker.point[0]} cy={marker.point[1]} r={(marker.intensity === 'critical' ? 8 : marker.intensity === 'high' ? 6 : 5) / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <circle className="map-war-zone-dot" cx={marker.point[0]} cy={marker.point[1]} r={2 / Math.sqrt(transform.k)} vectorEffect="non-scaling-stroke" />
              <title>{marker.label} · zone de guerre · intensité {marker.intensity}</title>
            </g>)}
          </g>}
        </g>
      </svg>
      {selectedOverlay && <div
        ref={overlayRef}
        className="map-country-overlay"
        role="dialog"
        aria-label="Fiche du pays sélectionné"
        style={{ left: `${overlayPosition.x}px`, top: `${overlayPosition.y}px` }}
        onPointerDown={beginOverlayDrag}
        onPointerMove={moveOverlay}
        onPointerUp={endOverlayDrag}
        onPointerCancel={endOverlayDrag}
      >
        <div className="map-country-overlay-handle"><span>Fiche du pays</span><span className="map-country-overlay-hint">Glisser pour déplacer</span></div>
        {selectedOverlay}
      </div>}
      <p className="map-historical-note">REPÈRES SIMPLIFIÉS · Soudan et Yougoslavie regroupés pour 2000 · points ponctuels pour les petits États sans polygone · contours issus d’un fond contemporain, non exhaustivement historicisé · Zoom par boutons, déplacement après zoom</p>
    </div>
  );
}

export type { MapMode };
