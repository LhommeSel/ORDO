import type { WorldState } from './types';
import type { Territory, TerritorialState, TerritoryDataset } from './territory-types';
import { franceTerritoryDataset } from './territory-data-france-2000';
import { europeTerritoryDatasets } from './territory-data-europe';
import { americasMacroTerritoryDatasets } from './territory-data-americas-macro';
import { extendedAmericasTerritoryDatasets } from './territory-data-americas-extended';
import { addAmericasMajorPorts } from './territory-data-americas-ports';
import { addEuropeMajorPorts } from './territory-data-europe-ports';
import { addAfricaMajorPorts } from './territory-data-africa-ports';
import { addAsiaMajorPorts } from './territory-data-asia-ports';
import { addOceaniaMajorPorts } from './territory-data-oceania-ports';

// Add country data here, not country-specific branches in the simulation or map.
const datasets: Record<string, TerritoryDataset> = {
  FRA: franceTerritoryDataset,
  ...europeTerritoryDatasets,
  ...americasMacroTerritoryDatasets,
  ...extendedAmericasTerritoryDatasets,
};
type MacroBasis = Pick<WorldState, 'countries' | 'macroEconomies'>;

function positiveOrZero(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Valeur territoriale négative ou non finie.');
  return value;
}

/** Allocates the remainder to the last item; no monthly rounding drift in totals. */
function allocate(total: number, weights: number[]): number[] {
  positiveOrZero(total);
  const sum = weights.reduce((a, b) => a + positiveOrZero(b), 0);
  if (!weights.length) return [];
  if (sum <= 0 && total > 0) throw new Error('Répartition territoriale sans poids : calibration nécessaire.');
  let remaining = total;
  return weights.map((weight, index) => {
    const value = index === weights.length - 1 ? remaining : Math.min(remaining, sum ? total * weight / sum : 0);
    remaining -= value;
    return value;
  });
}

/** Rebuild indexes from authoritative records, including after a save import. */
export function indexTerritorialState(state: TerritorialState): TerritorialState {
  if (state.schemaVersion !== 1 || !state.territories || !state.assets || !state.entities) {
    throw new Error('Référentiel territorial absent ou version non prise en charge.');
  }
  const accountingTerritoryIds: Record<string, string[]> = {};
  for (const [id, territory] of Object.entries(state.territories)) {
    if (territory.id !== id) throw new Error('Identifiant territorial incohérent.');
    for (const value of [territory.population, territory.realGdpBillion2000Usd]) {
      if (value !== null) positiveOrZero(value);
    }
    for (const entityId of [territory.sovereignCountryId, territory.controllerEntityId, territory.administratorEntityId]) {
      if (!state.entities[entityId]) throw new Error(`Entité territoriale inconnue : ${entityId}`);
    }
    if (territory.accountingCountryId !== null) {
      if (territory.population === null || territory.realGdpBillion2000Usd === null) throw new Error('Comptes territoriaux incomplets.');
      (accountingTerritoryIds[territory.accountingCountryId] ??= []).push(id);
    }
  }
  for (const asset of Object.values(state.assets)) {
    if (!state.territories[asset.territoryId]) throw new Error(`Actif sans territoire : ${asset.id}`);
    if (asset.portProfile) {
      const profile = asset.portProfile;
      if (asset.kind !== 'port') throw new Error(`Profil portuaire sur un actif non portuaire : ${asset.id}`);
      if (profile.goodsCapacity < 0 || profile.goodsCapacity > 10 || profile.infrastructureCapacity < profile.goodsCapacity || profile.infrastructureCapacity > 10) {
        throw new Error(`Capacité portuaire incohérente : ${asset.id}`);
      }
      if (profile.nationalReach < 0 || profile.nationalReach > 10 || profile.governanceRisk < 0 || profile.governanceRisk > 10 || profile.laborFriction < 0 || profile.laborFriction > 5) {
        throw new Error(`Indicateurs portuaires hors bornes : ${asset.id}`);
      }
    }
  }
  return { ...state, accountingTerritoryIds };
}

/** National macro remains the growth driver in this first regional slice. O(regions of country). */
export function synchronizeTerritorialEconomy(
  state: TerritorialState, countryId: string, population: number, realGdp: number,
): TerritorialState {
  const ids = state.accountingTerritoryIds[countryId] ?? [];
  if (!ids.length) return state;
  const regions = ids.map((id) => state.territories[id]);
  const popTotal = regions.reduce((sum, region) => sum + (region.population ?? 0), 0);
  const gdpTotal = regions.reduce((sum, region) => sum + (region.realGdpBillion2000Usd ?? 0), 0);
  const populations = allocate(population, regions.map((region) => popTotal > 0 ? region.population ?? 0 : region.populationWeight));
  const gdps = allocate(realGdp, regions.map((region) => gdpTotal > 0 ? region.realGdpBillion2000Usd ?? 0 : region.economicWeight));
  const territories = { ...state.territories };
  ids.forEach((id, index) => {
    territories[id] = { ...territories[id], population: populations[index], realGdpBillion2000Usd: gdps[index] };
  });
  return { ...state, territories };
}

/** Replace an aggregate only. Never silently overwrite a developed region or its player history. */
export function regionalizeCountry(state: TerritorialState, dataset: TerritoryDataset, basis: MacroBasis): TerritorialState {
  const existing = Object.values(state.territories).filter((t) => t.sovereignCountryId === dataset.countryId);
  if (existing.some((t) => t.kind !== 'aggregate')) throw new Error('Pays déjà régionalisé : migration explicite nécessaire.');
  const economy = basis.macroEconomies[dataset.countryId];
  if (!basis.countries[dataset.countryId] || !economy) throw new Error('Pays sans base macroéconomique.');
  const territories = { ...state.territories };
  existing.forEach((t) => { delete territories[t.id]; });
  for (const seed of dataset.territories) {
    if (territories[seed.id]) throw new Error(`Territoire dupliqué : ${seed.id}`);
    territories[seed.id] = {
      id: seed.id, name: seed.name, kind: seed.kind, sovereignCountryId: dataset.countryId,
      controllerEntityId: dataset.countryId, administratorEntityId: dataset.countryId, claimantEntityIds: [],
      accountingCountryId: seed.inNationalAccounts ? dataset.countryId : null,
      population: seed.inNationalAccounts ? 0 : seed.referencePopulation,
      realGdpBillion2000Usd: seed.inNationalAccounts ? 0 : null,
      populationWeight: seed.referencePopulation ?? 0, economicWeight: seed.economicWeight,
      referencePopulation: seed.referencePopulation, referenceYear: seed.referenceYear,
      provenance: seed.inNationalAccounts ? 'calibrated' : 'not_calibrated',
      sourceIds: seed.sourceIds, note: seed.note, mapGroup: seed.mapGroup, anchor: seed.anchor,
    };
  }
  const assets = { ...state.assets };
  const replacementTerritories = dataset.territories
    .map((seed) => territories[seed.id])
    .filter((territory): territory is Territory => Boolean(territory));
  // Les catalogues d’actifs sont chargés avant certains découpages régionaux.
  // Ne jamais perdre un port ou une infrastructure déjà recensée : on la
  // rattache à la maille la plus proche quand des ancres existent, sinon à la
  // première maille comptable. Cela conserve l’actif et permet de détailler le
  // pays plus tard sans exiger une migration manuelle préalable.
  const aggregateIds = new Set(existing.map((territory) => territory.id));
  for (const [assetId, asset] of Object.entries(assets)) {
    if (!aggregateIds.has(asset.territoryId) || replacementTerritories.length === 0) continue;
    const anchored = replacementTerritories.filter((territory) => territory.anchor);
    const candidates = anchored.length > 0 ? anchored : replacementTerritories;
    const target = asset.anchor && anchored.length > 0
      ? candidates.reduce((best, territory) => {
        const bestDistance = Math.hypot((best.anchor![0] - asset.anchor[0]) * Math.cos(asset.anchor[1] * Math.PI / 180), best.anchor![1] - asset.anchor[1]);
        const distance = Math.hypot((territory.anchor![0] - asset.anchor[0]) * Math.cos(asset.anchor[1] * Math.PI / 180), territory.anchor![1] - asset.anchor[1]);
        return distance < bestDistance ? territory : best;
      })
      : candidates[0];
    assets[assetId] = { ...asset, territoryId: target.id };
  }
  for (const asset of dataset.assets) {
    if (assets[asset.id]) throw new Error(`Actif dupliqué : ${asset.id}`);
    assets[asset.id] = structuredClone(asset);
  }
  const entities = { ...state.entities, ...Object.fromEntries(dataset.entities.map((entity) => [entity.id, entity])) };
  const next = indexTerritorialState({ ...state, territories, entities, assets });
  return synchronizeTerritorialEconomy(next, dataset.countryId, economy.populationMillions * 1e6, economy.realGdpBillion2000Usd);
}

export function createTerritorialState(basis: MacroBasis): TerritorialState {
  let state: TerritorialState = { schemaVersion: 1, territories: {}, accountingTerritoryIds: {}, assets: {}, entities: {} };
  for (const country of Object.values(basis.countries)) {
    state.entities[country.id] = { id: country.id, name: country.name, kind: 'state' };
    const economy = basis.macroEconomies[country.id];
    const id = `${country.id}:aggregate`;
    state.territories[id] = {
      id, name: `${country.name} — ensemble national`, kind: 'aggregate', sovereignCountryId: country.id,
      controllerEntityId: country.id, administratorEntityId: country.id, claimantEntityIds: [],
      accountingCountryId: economy ? country.id : null,
      population: economy ? economy.populationMillions * 1e6 : null,
      realGdpBillion2000Usd: economy?.realGdpBillion2000Usd ?? null,
      populationWeight: 1, economicWeight: 1, referencePopulation: null, referenceYear: null,
      provenance: 'national_aggregate', sourceIds: [], mapGroup: 'national', anchor: null,
      note: 'Agrégat national provisoire, pas une région réelle. Le découpage détaillé remplacera cet agrégat sans ajouter de PIB.',
    };
  }
  state = indexTerritorialState(state);
  for (const dataset of Object.values(datasets)) {
    if (basis.countries[dataset.countryId] && basis.macroEconomies[dataset.countryId]) state = regionalizeCountry(state, dataset, basis);
  }
  // Les ports couvrent aussi les pays restés à l’agrégat national ; leur
  // inventaire n’ajoute ni PIB, ni capacité énergétique, ni nouveau registre.
  return indexTerritorialState(addOceaniaMajorPorts(addAsiaMajorPorts(addAfricaMajorPorts(addEuropeMajorPorts(addAmericasMajorPorts(state))))));
}

export function territorySummary(state: TerritorialState, countryId: string) {
  const regions = (state.accountingTerritoryIds[countryId] ?? []).map((id) => state.territories[id]);
  return {
    population: regions.reduce((sum, t) => sum + (t.population ?? 0), 0),
    realGdpBillion2000Usd: regions.reduce((sum, t) => sum + (t.realGdpBillion2000Usd ?? 0), 0),
    count: regions.length,
  };
}

export function territoryEconomicShare(state: TerritorialState, territory: Territory) {
  if (territory.accountingCountryId === null || territory.realGdpBillion2000Usd === null) return null;
  const total = territorySummary(state, territory.accountingCountryId).realGdpBillion2000Usd;
  return total > 0 ? territory.realGdpBillion2000Usd / total * 100 : 0;
}
