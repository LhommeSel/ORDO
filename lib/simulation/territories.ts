import type { WorldState } from './types';
import type { Territory, TerritorialState, TerritoryDataset } from './territory-types';
import { franceTerritoryDataset } from './territory-data-france-2000';
import { europeTerritoryDatasets } from './territory-data-europe';
import { americasMacroTerritoryDatasets } from './territory-data-americas-macro';
import { extendedAmericasTerritoryDatasets } from './territory-data-americas-extended';

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
  if (Object.values(state.assets).some((asset) => existing.some((t) => t.id === asset.territoryId))) {
    throw new Error('Réaffecter les actifs de l’agrégat avant de le remplacer.');
  }
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
  return state;
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
