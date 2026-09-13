'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { geoArea, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { Button } from '@/components/ui/button';
import type { WorldState } from '@/lib/simulation/types';
import type { Territory } from '@/lib/simulation/territory-types';
import { territoryEconomicShare, territorySummary } from '@/lib/simulation/territories';
import { territorySources } from '@/lib/simulation/territory-data-france-2000';
import { territoryMapCatalog } from '@/lib/territory-map-catalog';
import { assetMonthlyOutput, assetOperationalOutput, operateTerritorialAsset, type TerritorialAssetActionKind } from '@/lib/simulation/territorial-assets';

const numbers = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimals = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const featureCache = new Map<string, GeoJSON.FeatureCollection>();
const assetUnits: Record<string, string> = { MW: 'MW', bcm_per_year: 'Gm³/an', million_tonnes_per_year: 'Mt/an' };

function assetOperationLabel(asset: WorldState['territorial']['assets'][string]) {
  const operation = asset.operation;
  if (!operation) return null;
  const unit = assetUnits[operation.unit] ?? operation.unit;
  const monthlyUnit = operation.unit === 'MW' ? 'MW moyen' : operation.unit === 'bcm_per_year' ? 'Gm³/mois' : 'Mt/mois';
  const monthly = assetMonthlyOutput(asset);
  const effective = assetOperationalOutput(asset);
  return `max ${decimals.format(operation.maximum)} ${unit} · déployé ${decimals.format(operation.deployed)} ${unit} · disponibilité ${decimals.format(operation.availabilityPct)} % · débit mensuel ${decimals.format(monthly)} ${monthlyUnit} (${decimals.format(effective)} ${unit} effectifs/an)`;
}

// d3's spherical polygons use clockwise exteriors; RFC7946 uses the reverse.
function forD3(collection: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return { ...collection, features: collection.features.map((feature) => {
    if (geoArea(feature) <= 2 * Math.PI) return feature;
    const geometry = feature.geometry;
    if (geometry.type === 'Polygon') return { ...feature, geometry: { ...geometry, coordinates: geometry.coordinates.map((ring) => [...ring].reverse()) } };
    if (geometry.type === 'MultiPolygon') return { ...feature, geometry: { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())) } };
    return feature;
  }) };
}

function RegionalMap({ regions, selected, onSelect, geometryUrl, world }: {
  regions: Territory[]; selected: string; onSelect: (id: string) => void; geometryUrl?: string; world: WorldState;
}) {
  const [collection, setCollection] = useState<GeoJSON.FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showAssets, setShowAssets] = useState(true);
  useEffect(() => {
    setError(false);
    setCollection(null);
    if (!geometryUrl) return;
    const cached = featureCache.get(geometryUrl);
    if (cached) { setCollection(cached); return; }
    const controller = new AbortController();
    void fetch(geometryUrl, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Contours indisponibles');
      const data = await response.json() as GeoJSON.FeatureCollection;
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Contours invalides');
      const converted = forD3(data);
      if (!controller.signal.aborted) { featureCache.set(geometryUrl, converted); setCollection(converted); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [geometryUrl, attempt]);
  const projection = useMemo(() => collection
    ? geoMercator().fitExtent([[25, 25], [735, 455]], collection)
    : geoNaturalEarth1().fitExtent([[20, 20], [740, 460]], { type: 'Sphere' }), [collection]);
  const path = geoPath(projection);
  const allowed = new Set(regions.map((t) => t.id));
  const assets = Object.values(world.territorial.assets).filter((asset) => allowed.has(asset.territoryId));
  const enter = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
  };
  return <div className="territory-map-area">
    <div className="territory-toolbar"><label><input type="checkbox" checked={showAssets} onChange={(event) => setShowAssets(event.target.checked)} /> Afficher les actifs</label><span>Bleu : sélection · ● énergie · ■ port</span></div>
    {geometryUrl && !collection ? <output className="territory-map-placeholder">
      {error ? <>Carte indisponible. La liste reste utilisable. <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Réessayer</Button></> : 'Chargement des contours…'}
    </output> : <svg className="territory-map" viewBox="0 0 760 480" role="group" aria-label="Territoires sélectionnables au clic ou au clavier">
      {!collection && <path d={path({ type: 'Sphere' }) ?? ''} className="map-sphere" />}
      {collection?.features.filter((feature) => allowed.has(String(feature.properties?.id))).map((feature) => {
        const id = String(feature.properties?.id);
        const region = regions.find((item) => item.id === id)!;
        return <path key={id} d={path(feature) ?? ''} className={`map-country ${id === selected ? 'selected' : 'high'}`} role="button" tabIndex={0}
          aria-label={region.name} aria-pressed={id === selected} onClick={() => onSelect(id)} onKeyDown={(e) => enter(e, id)}>
          <title>{region.name}</title>
        </path>;
      })}
      {regions.map((region, index) => {
        const point = region.anchor ? projection(region.anchor) : null;
        if (!point) return null;
        return <g key={region.id} transform={`translate(${point[0]} ${point[1]})`} role="button" tabIndex={0} className="territory-locator"
          aria-label={region.name} aria-pressed={selected === region.id} onClick={() => onSelect(region.id)} onKeyDown={(e) => enter(e, region.id)}>
          <title>{index + 1}. {region.name}</title>
          <circle r={collection ? 11 : 14} fill={selected === region.id ? '#075985' : '#0f172a'} stroke={selected === region.id ? '#38bdf8' : '#cbd5e1'} />
          <text textAnchor="middle" y="4" fill="white" fontSize="12">{index + 1}</text>
        </g>;
      })}
      {showAssets && collection && assets.map((asset) => {
        const point = projection(asset.anchor);
        if (!point) return null;
        return <g key={asset.id} transform={`translate(${point[0]} ${point[1]})`} role="button" tabIndex={0} className="territory-asset-marker"
          aria-label={`${asset.name} : ouvrir son territoire`} onClick={() => onSelect(asset.territoryId)} onKeyDown={(e) => enter(e, asset.territoryId)}>
          <title>{asset.name}</title>
          <circle r="9" fill="transparent" />
          {asset.kind === 'port' ? <rect x="-4" y="-4" width="8" height="8" fill="#fbbf24" stroke="#111827" /> : <circle r="4" fill="#f472b6" stroke="#111827" />}
        </g>;
      })}
    </svg>}
    <p className="territory-help">{collection ? 'Numéros associés à la liste. Contours simplifiés des anciennes régions (pas des limites militaires).' : 'Positions indicatives sur le globe, pas des surfaces ni des frontières. Les petits territoires restent accessibles dans la liste.'}</p>
  </div>;
}

export function TerritoryExplorer({ world, countryId, onWorldChange, onNotice }: { world: WorldState; countryId: string; onWorldChange?: (world: WorldState) => void; onNotice?: (message: string) => void }) {
  const territorial = world.territorial;
  const groups: { id: string; label: string; geometryUrl?: string }[] = territoryMapCatalog[countryId]?.groups ?? [{ id: 'national', label: 'Ensemble national' }];
  const [groupId, setGroupId] = useState(groups[0].id);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const territories = useMemo(() => Object.values(territorial.territories).filter((t) => t.sovereignCountryId === countryId), [territorial.territories, countryId]);
  const group = groups.find((item) => item.id === groupId) ?? groups[0];
  const regions = territories.filter((t) => t.mapGroup === group.id);
  const selected = regions.find((t) => t.id === selectedId) ?? regions[0];
  const summary = territorySummary(territorial, countryId);
  const share = selected ? territoryEconomicShare(territorial, selected) : null;
  const assets = selected ? Object.values(territorial.assets).filter((a) => a.territoryId === selected.id) : [];
  const canOperate = countryId === world.playerCountryId && Boolean(onWorldChange);
  const operate = (assetId: string, kind: TerritorialAssetActionKind) => {
    if (!onWorldChange) return;
    const result = operateTerritorialAsset(world, assetId, kind);
    if (!result.ok) { onNotice?.(result.error); return; }
    onWorldChange(result.state);
    onNotice?.(result.message);
  };
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return <section className="territory-explorer" aria-label="Découpage territorial">
    <header><h3>Territoires · {world.countries[countryId]?.name ?? countryId}</h3>
      <p>{territories.length} unités · {summary.count} dans les comptes nationaux · {numbers.format(summary.population)} habitants · {decimals.format(summary.realGdpBillion2000Usd)} Md$ de PIB réel (base 2000)</p>
    </header>
    <div className="territory-toolbar">{groups.map((item) => <Button key={item.id} variant={group.id === item.id ? 'default' : 'outline'} aria-pressed={group.id === item.id}
      onClick={() => { setGroupId(item.id); setSelectedId(''); setQuery(''); }}>{item.label}</Button>)}</div>
    <div className="territory-layout">
      <nav className="territory-list" aria-label="Liste des territoires">
        <input aria-label="Rechercher un territoire" placeholder="Rechercher un territoire…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {regions.map((region, index) => ({ region, index })).filter(({ region }) => normalize(region.name).includes(normalize(query))).map(({ region, index }) =>
          <button type="button" key={region.id} aria-pressed={selected?.id === region.id} className={selected?.id === region.id ? 'active' : ''} onClick={() => setSelectedId(region.id)}>
            <span>{index + 1}. {region.name}</span><small>{region.population === null ? 'Population à documenter' : `${numbers.format(region.population)} habitants`}</small>
          </button>)}
        {regions.every((r) => !normalize(r.name).includes(normalize(query))) && <p>Aucun territoire trouvé.</p>}
      </nav>
      <div>
        {selected?.kind === 'aggregate' ? <div className="territory-map-placeholder">Le découpage régional de ce pays n’est pas encore renseigné. Son agrégat conserve 100 % de sa population et de son économie ; il sera remplacé, pas ajouté aux futures régions.</div>
          : <RegionalMap world={world} regions={regions} geometryUrl={group.geometryUrl} selected={selected?.id ?? ''} onSelect={setSelectedId} />}
        {selected && <article className="territory-detail" aria-live="polite">
          <h4>{selected.name}</h4>
          <dl><div><dt>Population simulée</dt><dd>{selected.population === null ? 'Non renseignée' : numbers.format(selected.population)}</dd></div>
            <div><dt>PIB réel · Md$ de 2000</dt><dd>{selected.realGdpBillion2000Usd === null ? 'Comptes séparés à renseigner' : decimals.format(selected.realGdpBillion2000Usd)}</dd></div>
            <div><dt>Part du PIB national</dt><dd>{share === null ? 'Hors périmètre national' : `${decimals.format(share)} %`}</dd></div>
            <div><dt>Souveraineté / contrôle</dt><dd>{territorial.entities[selected.sovereignCountryId]?.name} / {territorial.entities[selected.controllerEntityId]?.name}</dd></div></dl>
          <h5>Actifs recensés ({assets.length})</h5>
          {assets.length ? <ul>{assets.map((asset) => <li key={asset.id}><b>{asset.kind === 'port' || asset.kind === 'passage' || asset.kind === 'airport' ? '■' : '●'} {asset.name}</b> — {asset.operatorEntityId ? territorial.entities[asset.operatorEntityId]?.name : 'Opérateur à documenter'} · {asset.status === 'closed' ? 'fermé / arrêté au lancement' : assetOperationLabel(asset) ?? 'inventaire sans capacité chiffrée'}
            {asset.operation && <div className="mt-2 flex flex-wrap gap-1">{canOperate && <>
              <Button size="sm" variant="outline" disabled={asset.status === 'closed' || asset.operation.deployed >= asset.operation.maximum - 0.001} onClick={() => operate(asset.id, 'mobilize')}>Mobiliser</Button>
              <Button size="sm" variant="outline" disabled={asset.status === 'closed' || asset.operation.availabilityPct >= 99.9} onClick={() => operate(asset.id, 'maintain')}>Entretenir</Button>
              <Button size="sm" variant="outline" disabled={asset.status === 'closed'} onClick={() => operate(asset.id, 'invest')}>Étendre</Button>
              <Button size="sm" variant="outline" disabled={asset.status === 'closed'} onClick={() => operate(asset.id, 'close')}>Suspendre</Button>
              {(asset.status !== 'operating' || asset.operation.availabilityPct < 95) && <Button size="sm" variant="outline" onClick={() => operate(asset.id, 'repair')}>Réparer</Button>}
            </>}</div>}
          </li>)}</ul>
            : <p>Aucun actif recensé dans ce premier lot — cela ne signifie pas que le territoire n’en possède pas.</p>}
          <p className="territory-help">Les actifs sans capacité restent un inventaire localisé. Les actifs énergétiques chiffrés ont un débit mensuel dérivé ; seuls ceux marqués comme raccordés au registre influencent les flux. Les boutons d’exploitation apparaissent uniquement pour le pays joué.</p>
          <details><summary>Méthode et sources</summary><p>{selected.note}</p>
            {selected.referenceYear && <p>Population de référence {selected.referenceYear} : {numbers.format(selected.referencePopulation ?? 0)}. La population affichée est recalée sur le total actuel de la partie.</p>}
            <p>À ce stade, les évolutions nationales sont réparties proportionnellement. Pas encore de croissance régionale autonome ni de transfert territorial jouable.</p>
            {[...new Set([...selected.sourceIds, ...assets.flatMap((a) => a.sourceIds)])].map((id) => territorySources[id] && <p key={id}><a href={territorySources[id].url} target="_blank" rel="noreferrer">{territorySources[id].label}</a></p>)}
            {group.geometryUrl && <p><a href="https://github.com/gregoiredavid/france-geojson" target="_blank" rel="noreferrer">Contours : IGN / INSEE / Grégoire David — Licence ouverte</a></p>}
          </details>
        </article>}
      </div>
    </div>
  </section>;
}
