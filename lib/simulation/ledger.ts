import type {
  ActionDraft,
  BilateralRelation,
  CountryId,
  WorldAction,
  WorldChange,
  WorldEffect,
  WorldState,
} from './types';

const relationKey = (from: CountryId, to: CountryId) => `${from}:${to}`;
const intelligenceKey = (observerId: CountryId, targetId: CountryId) => `${observerId}:${targetId}`;

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

function nextId(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

function appendChange(
  state: WorldState,
  action: WorldAction,
  effect: WorldEffect,
  path: string,
  before: unknown,
  after: unknown,
): WorldState {
  const sequence = state.sequence + 1;
  const change: WorldChange = {
    id: nextId('chg', sequence),
    actionId: action.id,
    date: state.currentDate,
    actorId: action.actorId,
    path,
    before,
    after,
    reason: effect.reason,
    origin: action.origin,
    visibility: effect.visibility ?? action.visibility ?? 'player',
  };
  return { ...state, sequence, ledger: [...state.ledger, change] };
}

function applyEffect(state: WorldState, action: WorldAction, effect: WorldEffect): WorldState {
  if (effect.kind === 'date_set') {
    const before = state.currentDate;
    const next = { ...state, currentDate: effect.date };
    return appendChange(next, action, effect, 'currentDate', before, effect.date);
  }

  if (effect.kind === 'processed_stop_add') {
    const before = state.processedStopIds;
    const after = before.includes(effect.stopId) ? before : [...before, effect.stopId];
    const next = { ...state, processedStopIds: after };
    return appendChange(next, action, effect, 'processedStopIds', before, after);
  }

  if (effect.kind === 'metric_delta') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const before = country.metrics[effect.metric];
    const rawAfter = before + effect.delta;
    const after = effect.metric === 'budget' ? rawAfter : effect.metric === 'industry' ? Math.max(0, rawAfter) : clamp(rawAfter);
    const next = {
      ...state,
      countries: {
        ...state.countries,
        [effect.countryId]: {
          ...country,
          metrics: { ...country.metrics, [effect.metric]: Number(after.toFixed(3)) },
        },
      },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.metrics.${effect.metric}`, before, Number(after.toFixed(3)));
  }

  if (effect.kind === 'country_strategy_patch') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const after = { ...country.strategy, ...effect.patch };
    const next = {
      ...state,
      countries: { ...state.countries, [effect.countryId]: { ...country, strategy: after } },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.strategy`, country.strategy, after);
  }

  if (effect.kind === 'capacity_commitment' || effect.kind === 'capacity_maximum') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const capacity = country.capacities[effect.domain];
    const field = effect.kind === 'capacity_commitment' ? 'committed' : 'maximum';
    const before = capacity[field];
    const after = field === 'committed' ? Math.max(0, before + effect.delta) : Math.max(1, before + effect.delta);
    const next = {
      ...state,
      countries: {
        ...state.countries,
        [effect.countryId]: {
          ...country,
          capacities: {
            ...country.capacities,
            [effect.domain]: { ...capacity, [field]: Number(after.toFixed(3)) },
          },
        },
      },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.capacities.${effect.domain}.${field}`, before, Number(after.toFixed(3)));
  }

  if (effect.kind === 'relation_delta') {
    const key = relationKey(effect.from, effect.to);
    const current: BilateralRelation = state.relations[key] ?? {
      from: effect.from,
      to: effect.to,
      relation: 50,
      trust: 50,
      tradeIntensity: 0,
      securityAlignment: 0,
      memories: [],
    };
    const before = { relation: current.relation, trust: current.trust };
    const after = {
      relation: clamp(current.relation + effect.relation),
      trust: clamp(current.trust + effect.trust),
    };
    const next = {
      ...state,
      relations: { ...state.relations, [key]: { ...current, ...after } },
    };
    return appendChange(next, action, effect, `relations.${key}`, before, after);
  }

  if (effect.kind === 'intelligence_delta') {
    const key = intelligenceKey(effect.observerId, effect.targetId);
    const before = state.intelligence[key] ?? 0;
    const after = clamp(before + effect.delta);
    const next = { ...state, intelligence: { ...state.intelligence, [key]: after } };
    return appendChange(next, action, effect, `intelligence.${key}`, before, after);
  }

  if (effect.kind === 'institution_patch') {
    const institution = state.institutions[effect.institutionId];
    if (!institution) return state;
    const after = { ...institution, ...effect.patch };
    const next = { ...state, institutions: { ...state.institutions, [effect.institutionId]: after } };
    return appendChange(next, action, effect, `institutions.${effect.institutionId}`, institution, after);
  }

  if (effect.kind === 'treaty_patch') {
    const treaty = state.treaties[effect.treatyId];
    if (!treaty) return state;
    const after = { ...treaty, ...effect.patch };
    const next = { ...state, treaties: { ...state.treaties, [effect.treatyId]: after } };
    return appendChange(next, action, effect, `treaties.${effect.treatyId}`, treaty, after);
  }

  if (effect.kind === 'historical_pressure') {
    const current = state.historicalCurrents[effect.currentId];
    if (!current) return state;
    const before = current.pressure;
    const after = clamp(before + effect.delta);
    const next = {
      ...state,
      historicalCurrents: {
        ...state.historicalCurrents,
        [effect.currentId]: { ...current, pressure: after },
      },
    };
    return appendChange(next, action, effect, `historicalCurrents.${effect.currentId}.pressure`, before, after);
  }

  if (effect.kind === 'latent_process_patch') {
    const process = state.latentProcesses[effect.processId];
    if (!process) return state;
    const after = { ...process, ...effect.patch };
    const next = { ...state, latentProcesses: { ...state.latentProcesses, [effect.processId]: after } };
    return appendChange(next, action, effect, `latentProcesses.${effect.processId}`, process, after);
  }

  if (effect.kind === 'energy_contract_add') {
    const before = state.energyContracts[effect.contract.id] ?? null;
    const next = {
      ...state,
      energyContracts: { ...state.energyContracts, [effect.contract.id]: effect.contract },
    };
    return appendChange(next, action, effect, `energyContracts.${effect.contract.id}`, before, effect.contract);
  }

  if (effect.kind === 'energy_contract_patch') {
    const contract = state.energyContracts[effect.contractId];
    if (!contract) return state;
    const after = { ...contract, ...effect.patch };
    const next = { ...state, energyContracts: { ...state.energyContracts, [effect.contractId]: after } };
    return appendChange(next, action, effect, `energyContracts.${effect.contractId}`, contract, after);
  }

  if (effect.kind === 'energy_node_patch') {
    const node = state.energyNodes[effect.nodeId];
    if (!node) return state;
    const after = { ...node, ...effect.patch };
    const next = { ...state, energyNodes: { ...state.energyNodes, [effect.nodeId]: after } };
    return appendChange(next, action, effect, `energyNodes.${effect.nodeId}`, node, after);
  }

  if (effect.kind === 'energy_stock_delta') {
    const energy = state.countryEnergy[effect.countryId];
    if (!energy) return state;
    const before = energy.strategicStocks[effect.resource];
    const after = Math.min(
      energy.storageCapacity[effect.resource],
      Math.max(0, before + effect.delta),
    );
    const next = {
      ...state,
      countryEnergy: {
        ...state.countryEnergy,
        [effect.countryId]: {
          ...energy,
          strategicStocks: { ...energy.strategicStocks, [effect.resource]: Number(after.toFixed(3)) },
        },
      },
    };
    return appendChange(next, action, effect, `countryEnergy.${effect.countryId}.strategicStocks.${effect.resource}`, before, Number(after.toFixed(3)));
  }

  if (effect.kind === 'sector_patch') {
    const sector = state.sectors[effect.sectorId];
    if (!sector) return state;
    const after = { ...sector, ...effect.patch };
    const next = { ...state, sectors: { ...state.sectors, [effect.sectorId]: after } };
    return appendChange(next, action, effect, `sectors.${effect.sectorId}`, sector, after);
  }

  if (effect.kind === 'dossier_add') {
    const dossiers = state.strategicDossiers ?? {};
    const before = dossiers[effect.dossier.id] ?? null;
    const after = before ?? effect.dossier;
    const next = { ...state, strategicDossiers: { ...dossiers, [effect.dossier.id]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossier.id}`, before, after);
  }

  if (effect.kind === 'dossier_patch') {
    const dossier = state.strategicDossiers?.[effect.dossierId];
    if (!dossier) return state;
    const after = { ...dossier, ...effect.patch };
    const next = { ...state, strategicDossiers: { ...state.strategicDossiers, [effect.dossierId]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossierId}`, dossier, after);
  }

  if (effect.kind === 'dossier_entry_add') {
    const dossier = state.strategicDossiers?.[effect.dossierId];
    if (!dossier || dossier.entries.some((entry) => entry.id === effect.entry.id)) return state;
    const entry = { ...effect.entry, sourceActionId: effect.entry.sourceActionId ?? action.id };
    const after = {
      ...dossier,
      updatedAt: entry.date,
      relatedActionIds: dossier.relatedActionIds.includes(action.id) ? dossier.relatedActionIds : [...dossier.relatedActionIds, action.id],
      entries: [...dossier.entries, entry],
    };
    const next = { ...state, strategicDossiers: { ...state.strategicDossiers, [effect.dossierId]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossierId}.entries.${entry.id}`, null, entry);
  }

  if (effect.kind === 'macro_patch') {
    const economy = state.macroEconomies[effect.countryId];
    if (!economy) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, economy[key as keyof typeof economy]]));
    const afterEconomy = { ...economy, ...effect.patch };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterEconomy[key as keyof typeof afterEconomy]]));
    const next = { ...state, macroEconomies: { ...state.macroEconomies, [effect.countryId]: afterEconomy } };
    return appendChange(next, action, effect, `macroEconomies.${effect.countryId}`, before, after);
  }

  if (effect.kind === 'world_economy_patch') {
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, state.worldEconomy[key as keyof typeof state.worldEconomy]]));
    const afterEconomy = { ...state.worldEconomy, ...effect.patch };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterEconomy[key as keyof typeof afterEconomy]]));
    const next = { ...state, worldEconomy: afterEconomy };
    return appendChange(next, action, effect, 'worldEconomy', before, after);
  }

  const product = state.armamentProducts[effect.productId];
  if (!product) return state;
  const after = { ...product, ...effect.patch };
  const next = { ...state, armamentProducts: { ...state.armamentProducts, [effect.productId]: after } };
  return appendChange(next, action, effect, `armamentProducts.${effect.productId}`, product, after);
}

export function commitWorldAction(state: WorldState, draft: ActionDraft): WorldState {
  const actionSequence = state.sequence + 1;
  const action: WorldAction = {
    ...draft,
    id: nextId('act', actionSequence),
    createdAt: state.currentDate,
    status: 'validated',
    targetIds: draft.targetIds ?? [],
  };
  let next: WorldState = {
    ...state,
    sequence: actionSequence,
    actions: [...state.actions, action],
  };
  for (const effect of action.effects) next = applyEffect(next, action, effect);
  const applied = { ...action, status: 'applied' as const };
  return {
    ...next,
    actions: next.actions.map((item) => (item.id === action.id ? applied : item)),
  };
}

export function visibleLedger(state: WorldState, countryId = state.playerCountryId) {
  return state.ledger.filter((change) => {
    if (change.visibility === 'public' || change.visibility === 'player') return true;
    if (change.visibility === 'secret') return change.actorId === countryId;
    return false;
  });
}

export function relationBetween(state: WorldState, from: CountryId, to: CountryId) {
  return state.relations[relationKey(from, to)];
}

export function intelligenceLevel(state: WorldState, observerId: CountryId, targetId: CountryId) {
  return state.intelligence[intelligenceKey(observerId, targetId)] ?? 0;
}
