import type { WorldState } from './types';
import { createTerritorialState, indexTerritorialState } from './territories';
import { createMacroEconomies2000, worldEconomy2000 } from './macro-data-2000';
import { createStructuralProfiles2000 } from './structural-data-2000';
import { createStakeholderGroups2000 } from './stakeholder-data-2000';
import { createNationalReforms2000 } from './reforms';
import { createTradeFlows2000 } from './trade-data-2000';
import { createDecisionProfiles2000 } from './decision-data-2000';
import { createLeadership2000, createPoliticalApparatus2000 } from './political-identity-data-2000';
import { createPoliticalCycles2000 } from './political-cycles';
import { createHistoricalAnchors2000 } from './historical-anchors-2000';
import { createStrategicSectors2000 } from './strategic-sector-data-2000';
import { createWorld2000 } from './scenario-2000';

export type SaveEnvelope = {
  format: 'ordo-world';
  schemaVersion: 1;
  savedAt: string;
  state: WorldState;
  historySummary?: {
    actionsCompacted: number;
    changesCompacted: number;
  };
};

const SAVE_COMPACTION_THRESHOLD = 2_000;
const LEDGER_COMPACTION_THRESHOLD = 4_000;
const TECHNICAL_ACTION_TAIL = 120;
const TECHNICAL_LEDGER_TAIL = 240;

/**
 * Les états courants sont déjà des snapshots complets : au-delà d'une partie
 * longue, garder chaque écriture technique de chaque frontière mensuelle ne
 * renforce pas la simulation et gonfle inutilement le stockage local.
 * Les choix, réponses IA, événements visibles et une queue technique bornée
 * restent intacts. Les index de revue autonome sont recalés sur la nouvelle
 * liste d'actions.
 */
export function compactWorldForSave(state: WorldState): WorldState {
  if (state.actions.length <= SAVE_COMPACTION_THRESHOLD && state.ledger.length <= LEDGER_COMPACTION_THRESHOLD) return state;
  const firstTechnicalActionToKeep = Math.max(0, state.actions.length - TECHNICAL_ACTION_TAIL);
  const keepAction = (action: WorldState['actions'][number], index: number) =>
    action.origin === 'player'
    || action.origin === 'ai'
    || action.origin === 'historical'
    || action.metadata?.minorEvent === true
    || action.metadata?.worldPulse === true
    || action.kind === 'diplomatic'
    || index >= firstTechnicalActionToKeep;
  const keptActions = state.actions.filter(keepAction);
  const keptActionIds = new Set(keptActions.map((action) => action.id));
  const firstTechnicalChangeToKeep = Math.max(0, state.ledger.length - TECHNICAL_LEDGER_TAIL);
  const keptLedger = state.ledger.filter((change, index) =>
    keptActionIds.has(change.actionId)
    || (change.origin !== 'time' && change.origin !== 'local_rule')
    || index >= firstTechnicalChangeToKeep,
  );
  const newCountAtOldCount = (oldCount: number) => state.actions
    .slice(0, Math.max(0, oldCount))
    .reduce((count, action) => count + (keptActionIds.has(action.id) ? 1 : 0), 0);
  const strategicDossiers = Object.fromEntries(Object.entries(state.strategicDossiers).map(([id, dossier]) => {
    const oldCount = dossier.lastAutonomousReviewActionCount;
    if (typeof oldCount !== 'number') return [id, dossier];
    return [id, {
      ...dossier,
      lastAutonomousReviewActionCount: newCountAtOldCount(oldCount),
    }];
  }));
  return { ...state, actions: keptActions, ledger: keptLedger, strategicDossiers };
}

export function serializeWorld(state: WorldState) {
  const compacted = compactWorldForSave(state);
  const envelope: SaveEnvelope = {
    format: 'ordo-world', schemaVersion: 1, savedAt: new Date().toISOString(), state: compacted,
    ...(compacted !== state ? {
      historySummary: {
        actionsCompacted: state.actions.length - compacted.actions.length,
        changesCompacted: state.ledger.length - compacted.ledger.length,
      },
    } : {}),
  };
  return JSON.stringify(envelope);
}

type StoredSave = {
  format: 'ordo-world-gzip';
  savedAt: string;
  bytes: ArrayBuffer;
  /** Les navigateurs anciens ne proposent pas toujours CompressionStream. */
  encoding?: 'gzip' | 'plain';
};

const SAVE_DB_NAME = 'ordo-saves-v2';
const SAVE_STORE_NAME = 'snapshots';
const SAVE_KEY = 'ordo-world-v2';

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

async function gzipText(value: string): Promise<{ bytes: Uint8Array; encoding: 'gzip' | 'plain' }> {
  if (typeof CompressionStream === 'undefined') {
    return { bytes: new TextEncoder().encode(value), encoding: 'plain' };
  }
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new TextEncoder().encode(value));
  await writer.close();
  return { bytes: new Uint8Array(await new Response(stream.readable).arrayBuffer()), encoding: 'gzip' };
}

async function gunzipBytes(value: ArrayBuffer | Uint8Array, encoding: 'gzip' | 'plain' = 'gzip') {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (encoding === 'plain') return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Cette sauvegarde est compressée, mais ce navigateur ne sait pas la décompresser.');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(bytes as unknown as BufferSource);
  await writer.close();
  return new TextDecoder().decode(await new Response(stream.readable).arrayBuffer());
}

function openSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SAVE_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir la base de sauvegarde.'));
  });
}

async function putIndexedSave(value: StoredSave) {
  const db = await openSaveDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SAVE_STORE_NAME, 'readwrite');
    transaction.objectStore(SAVE_STORE_NAME).put(value, SAVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Impossible d’enregistrer la sauvegarde.'));
  });
  db.close();
}

async function getIndexedSave(): Promise<StoredSave | undefined> {
  const db = await openSaveDb();
  const value = await new Promise<StoredSave | undefined>((resolve, reject) => {
    const transaction = db.transaction(SAVE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(SAVE_STORE_NAME).get(SAVE_KEY);
    request.onsuccess = () => resolve(request.result as StoredSave | undefined);
    request.onerror = () => reject(request.error ?? new Error('Impossible de lire la sauvegarde.'));
  });
  db.close();
  return value;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Sauvegarde compressée du navigateur. IndexedDB évite la limite stricte de localStorage. */
export async function saveWorldToBrowser(state: WorldState) {
  const raw = serializeWorld(state);
  const compressed = await gzipText(raw);
  if (hasIndexedDb()) {
    try {
      await putIndexedSave({ format: 'ordo-world-gzip', savedAt: new Date().toISOString(), bytes: toArrayBuffer(compressed.bytes), encoding: compressed.encoding });
      return { rawBytes: new TextEncoder().encode(raw).byteLength, storedBytes: compressed.bytes.byteLength, compacted: compactWorldForSave(state).actions.length < state.actions.length };
    } catch {
      // Certains navigateurs privés exposent IndexedDB tout en refusant son
      // ouverture. Le stockage local reste alors un secours valide.
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ format: 'ordo-world-gzip', savedAt: new Date().toISOString(), data: bytesToBase64(compressed.bytes), encoding: compressed.encoding }));
  } else {
    throw new Error('Le navigateur ne fournit aucun stockage local.');
  }
  return { rawBytes: new TextEncoder().encode(raw).byteLength, storedBytes: compressed.bytes.byteLength, compacted: compactWorldForSave(state).actions.length < state.actions.length };
}

/** Charge une sauvegarde v2 compressée, avec migration depuis la clé v1. */
export async function loadWorldFromBrowser() {
  let raw: string | undefined;
  if (hasIndexedDb()) {
    try {
      const stored = await getIndexedSave();
      if (stored?.bytes) raw = await gunzipBytes(stored.bytes, stored.encoding);
    } catch {
      // Même secours que lors de l'écriture : IndexedDB peut être présent mais
      // interdit par le mode privé ou une politique du navigateur.
    }
  }
  if (!raw && typeof localStorage !== 'undefined') {
    const compressed = localStorage.getItem(SAVE_KEY);
    if (compressed) {
      const candidate = JSON.parse(compressed) as { format?: string; data?: string; encoding?: 'gzip' | 'plain' };
      if (candidate.format === 'ordo-world-gzip' && candidate.data) raw = await gunzipBytes(base64ToBytes(candidate.data), candidate.encoding);
    }
    raw ??= localStorage.getItem('ordo-world-v1') ?? undefined;
  }
  if (!raw) return undefined;
  return deserializeWorld(raw);
}

export function deserializeWorld(raw: string): WorldState {
  const candidate: unknown = JSON.parse(raw);
  if (!candidate || typeof candidate !== 'object') throw new Error('Sauvegarde ORDO invalide.');
  const envelope = candidate as Partial<SaveEnvelope>;
  if (envelope.format !== 'ordo-world' || envelope.schemaVersion !== 1 || !envelope.state) {
    throw new Error('Format de sauvegarde ORDO inconnu ou obsolète.');
  }
  if (envelope.state.version !== 1 || !envelope.state.scenarioId || !envelope.state.currentDate) {
    throw new Error('État du monde incomplet.');
  }
  const restored = structuredClone(envelope.state);
  // Une sauvegarde garde l'état déjà joué, mais reçoit les pays et registres
  // structurels ajoutés depuis sa création. Sans ce socle, une ancienne partie
  // pouvait rester définitivement limitée à l'ancien catalogue national.
  const baseline = createWorld2000(restored.playerCountryId);
  const countries = { ...baseline.countries, ...restored.countries };
  const structuralProfiles = {
    ...createStructuralProfiles2000(countries),
    ...restored.structuralProfiles,
  };
  const defaultMacroEconomies = createMacroEconomies2000();
  const macroEconomies = Object.fromEntries(Object.entries(defaultMacroEconomies).map(([countryId, fallback]) => {
    const saved = restored.macroEconomies?.[countryId];
    return [countryId, saved ? {
      ...fallback, ...saved,
      policy: { ...fallback.policy, ...saved.policy },
      sectors: { ...fallback.sectors, ...saved.sectors },
      products: { ...fallback.products, ...saved.products },
    } : fallback];
  }));
  const worldEconomy = {
    ...structuredClone(worldEconomy2000), ...restored.worldEconomy,
    productMarkets: {
      ...structuredClone(worldEconomy2000.productMarkets),
      ...restored.worldEconomy?.productMarkets,
    },
    activeShocks: restored.worldEconomy?.activeShocks ?? [],
  };
  const sectors = createStrategicSectors2000(
    countries,
    structuralProfiles,
    macroEconomies,
    restored.sectors ?? {},
  );
  const countryEnergy = Object.fromEntries(Object.entries({ ...baseline.countryEnergy, ...restored.countryEnergy }).map(([countryId, energy]) => [countryId, {
    ...energy,
    legacyImports: energy.legacyImports ?? {
      oil: Math.max(0, energy.annualDemand.oil - energy.domesticProduction.oil),
      gas: Math.max(0, energy.annualDemand.gas - energy.domesticProduction.gas),
    },
  }]));
  const representedTerritorialCountries = new Set(Object.values(restored.territorial?.territories ?? {}).map((territory) => territory.sovereignCountryId));
  const baselineTerritories = Object.fromEntries(Object.entries(baseline.territorial.territories)
    .filter(([, territory]) => !representedTerritorialCountries.has(territory.sovereignCountryId)));
  const baselineAssets = Object.fromEntries(Object.entries(baseline.territorial.assets)
    .filter(([, asset]) => Boolean(baselineTerritories[asset.territoryId])));
  const territorial = restored.territorial
    ? indexTerritorialState({
      ...baseline.territorial,
      ...restored.territorial,
      territories: { ...baselineTerritories, ...restored.territorial.territories },
      assets: { ...baselineAssets, ...restored.territorial.assets },
      entities: { ...baseline.territorial.entities, ...restored.territorial.entities },
    })
    : createTerritorialState({ countries, macroEconomies });
  return {
    ...restored,
    countries,
    relations: { ...baseline.relations, ...restored.relations },
    intelligence: { ...baseline.intelligence, ...restored.intelligence },
    territorial,
    countryEnergy,
    baselineEnergyFlows: Object.fromEntries(Object.entries({ ...baseline.baselineEnergyFlows, ...restored.baselineEnergyFlows }).map(([id, flow]) => [id, {
      ...flow, sourceNodeId: flow.sourceNodeId,
    }])),
    strategicDossiers: restored.strategicDossiers ?? {},
    historicalAnchors: { ...createHistoricalAnchors2000(), ...restored.historicalAnchors },
    macroEconomies,
    sectors,
    worldEconomy,
    tradeFlows: { ...createTradeFlows2000(), ...restored.tradeFlows },
    decisionProfiles: { ...createDecisionProfiles2000(countries), ...restored.decisionProfiles },
    leadership: { ...createLeadership2000(countries), ...restored.leadership },
    politicalCycles: { ...createPoliticalCycles2000(countries), ...restored.politicalCycles },
    politicalApparatus: { ...createPoliticalApparatus2000(countries), ...restored.politicalApparatus },
    structuralProfiles,
    stakeholderGroups: { ...createStakeholderGroups2000(countries, structuralProfiles), ...restored.stakeholderGroups },
    stakeholderReactions: restored.stakeholderReactions ?? {},
    nationalReforms: { ...createNationalReforms2000(countries, restored.currentDate), ...restored.nationalReforms },
    powerActors: restored.powerActors ?? {},
    powerStruggleCampaigns: restored.powerStruggleCampaigns ?? {},
    aiJobs: restored.aiJobs ?? (restored as unknown as { powerStruggleAIRequests?: WorldState['aiJobs'] }).powerStruggleAIRequests ?? {},
    actionPrograms: restored.actionPrograms ?? {},
    diplomaticSessions: restored.diplomaticSessions ?? {},
    diplomaticDialogues: restored.diplomaticDialogues ?? {},
  };
}

export function cloneWorld(state: WorldState) {
  return deserializeWorld(serializeWorld(state));
}
