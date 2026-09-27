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
import { createNationalPolitics2000 } from './national-politics';
import { createStructuralModifiers2000, initializeStructuralModifiers } from './structural-modifiers';
import { createGoldStocks2000 } from './gold-stocks-2000';
import { createResourceState2000 } from './resource-data-2000';

export type SaveEnvelope = {
  format: 'etat-nation-world';
  schemaVersion: 2;
  savedAt: string;
  state: WorldState;
  historySummary?: {
    actionsCompacted: number;
    changesCompacted: number;
  };
};

/** Format historique lu uniquement pour ne pas perdre une partie existante. */
type LegacySaveEnvelope = Omit<SaveEnvelope, 'format'> & { format: 'ordo-world' };

const SAVE_COMPACTION_THRESHOLD = 2_000;
/** Une nouvelle couche fiscale obligatoire rend les snapshots antérieurs
 * incohérents. Le jeu repart donc d'un scénario propre au lieu de simuler une
 * migration qui masquerait des données manquantes. */
const SAVE_SCHEMA_VERSION = 2;
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
    format: 'etat-nation-world', schemaVersion: SAVE_SCHEMA_VERSION, savedAt: new Date().toISOString(), state: compacted,
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
  format: 'etat-nation-world-gzip';
  savedAt: string;
  bytes: ArrayBuffer;
  /** Les navigateurs anciens ne proposent pas toujours CompressionStream. */
  encoding?: 'gzip' | 'plain';
};

const SAVE_DB_NAME = 'etat-nation-saves-v2';
const SAVE_STORE_NAME = 'snapshots';
const SAVE_KEY = 'etat-nation-world-v2';
const LEGACY_SAVE_DB_NAME = 'ordo-saves-v2';
const LEGACY_SAVE_KEY = 'ordo-world-v2';
const LEGACY_SAVE_V1_KEY = 'ordo-world-v1';

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

function openSaveDb(databaseName = SAVE_DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
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

async function getIndexedSave(databaseName = SAVE_DB_NAME, key = SAVE_KEY): Promise<StoredSave | undefined> {
  const db = await openSaveDb(databaseName);
  const value = await new Promise<StoredSave | undefined>((resolve, reject) => {
    const transaction = db.transaction(SAVE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(SAVE_STORE_NAME).get(key);
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
      await putIndexedSave({ format: 'etat-nation-world-gzip', savedAt: new Date().toISOString(), bytes: toArrayBuffer(compressed.bytes), encoding: compressed.encoding });
      return { rawBytes: new TextEncoder().encode(raw).byteLength, storedBytes: compressed.bytes.byteLength, compacted: compactWorldForSave(state).actions.length < state.actions.length };
    } catch {
      // Certains navigateurs privés exposent IndexedDB tout en refusant son
      // ouverture. Le stockage local reste alors un secours valide.
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ format: 'etat-nation-world-gzip', savedAt: new Date().toISOString(), data: bytesToBase64(compressed.bytes), encoding: compressed.encoding }));
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
      // Une seule lecture de compatibilité : dès la prochaine sauvegarde, la
      // partie bascule sur les clés État-Nation sans perdre son état joué.
      if (!raw) {
        const legacy = await getIndexedSave(LEGACY_SAVE_DB_NAME, LEGACY_SAVE_KEY);
        if (legacy?.bytes) raw = await gunzipBytes(legacy.bytes, legacy.encoding);
      }
    } catch {
      // Même secours que lors de l'écriture : IndexedDB peut être présent mais
      // interdit par le mode privé ou une politique du navigateur.
    }
  }
  if (!raw && typeof localStorage !== 'undefined') {
    for (const storageKey of [SAVE_KEY, LEGACY_SAVE_KEY]) {
      if (raw) break;
      const compressed = localStorage.getItem(storageKey);
      if (!compressed) continue;
      const candidate = JSON.parse(compressed) as { format?: string; data?: string; encoding?: 'gzip' | 'plain' };
      if ((candidate.format === 'etat-nation-world-gzip' || candidate.format === 'ordo-world-gzip') && candidate.data) raw = await gunzipBytes(base64ToBytes(candidate.data), candidate.encoding);
    }
    raw ??= localStorage.getItem('etat-nation-world-v1') ?? localStorage.getItem(LEGACY_SAVE_V1_KEY) ?? undefined;
  }
  if (!raw) return undefined;
  return deserializeWorld(raw);
}

export function deserializeWorld(raw: string): WorldState {
  const candidate: unknown = JSON.parse(raw);
  if (!candidate || typeof candidate !== 'object') throw new Error('Sauvegarde État-Nation invalide.');
  const envelope = candidate as Partial<SaveEnvelope | LegacySaveEnvelope>;
  if (envelope.format !== 'etat-nation-world' || envelope.schemaVersion !== SAVE_SCHEMA_VERSION || !envelope.state) {
    throw new Error('Format de sauvegarde État-Nation inconnu ou obsolète.');
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
      productiveSystem: { ...fallback.productiveSystem, ...saved.productiveSystem },
    } : fallback];
  }));
  const worldEconomy = {
    ...structuredClone(worldEconomy2000), ...restored.worldEconomy,
    productMarkets: {
      ...structuredClone(worldEconomy2000.productMarkets),
      ...restored.worldEconomy?.productMarkets,
    },
    oilMarket: {
      ...structuredClone(worldEconomy2000.oilMarket),
      ...restored.worldEconomy?.oilMarket,
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
  // Les anciennes versions ne liaient la fiche qu’après la première réponse
  // IA. À la restauration, réparer ces canaux orphelins afin qu’un échange
  // déjà joué redevienne visible dans « Diplomatie » et « Dossiers ».
  const diplomaticDialogues = { ...restored.diplomaticDialogues };
  const strategicDossiers = { ...restored.strategicDossiers };
  const actionPrograms = { ...restored.actionPrograms };
  for (const dialogue of Object.values(diplomaticDialogues)) {
    const dossierId = dialogue.linkedDossierId ?? `diplomatic-dialogue-${dialogue.id}`;
    if (!strategicDossiers[dossierId]) {
      const names = dialogue.participantIds
        .filter((id) => id !== restored.playerCountryId)
        .map((id) => countries[id]?.name ?? id)
        .join(' et ');
      const opening = dialogue.turns.find((item) => item.speakerId === restored.playerCountryId)?.publicMessage ?? 'Ouverture d’un contact diplomatique.';
      const latestForeign = dialogue.turns.slice().reverse().find((item) => item.speakerId !== restored.playerCountryId);
      strategicDossiers[dossierId] = {
        id: dossierId,
        title: `Contact diplomatique · ${names || 'interlocuteur'}`,
        kind: 'cooperation',
        status: dialogue.status === 'closed' ? 'resolved' : 'active',
        importance: 'moderate',
        actorIds: dialogue.participantIds,
        regionTags: [],
        startedAt: dialogue.openedAt,
        updatedAt: dialogue.updatedAt,
        phase: 'Canal diplomatique restauré',
        trend: 'stable',
        publicSummary: `Le canal diplomatique avec ${names || 'l’interlocuteur'} a été restauré depuis une sauvegarde antérieure.`,
        followed: true,
        autoTracked: false,
        playerStance: opening,
        commitments: [],
        pendingDecisions: [],
        relatedCurrentIds: [],
        relatedActionIds: [],
        entries: [
          { id: `${dossierId}-opening`, date: dialogue.openedAt, title: 'Demande initiale du gouvernement', summary: opening, importance: 'moderate', actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' },
          ...(latestForeign ? [{ id: `${dossierId}-latest-response`, date: latestForeign.date, title: `Dernière réponse · ${countries[latestForeign.speakerId]?.name ?? latestForeign.speakerId}`, summary: latestForeign.publicMessage, importance: 'moderate' as const, actorIds: dialogue.participantIds, requiresDecision: false, visibility: 'player' as const }] : []),
        ],
      };
    }
    if (dialogue.linkedDossierId !== dossierId) diplomaticDialogues[dialogue.id] = { ...dialogue, linkedDossierId: dossierId };
  }
  // Une version intermédiaire créait un « Canal diplomatique » lorsqu'une
  // action était ensuite préparée depuis une fiche « Contact diplomatique ».
  // Les deux désignaient le même échange : on ramène les anciennes parties à
  // une seule chronologie, sans fusionner les dossiers de sujets réellement
  // distincts (énergie, défense, renseignement, etc.).
  const sameActors = (left: string[], right: string[]) => left.length === right.length
    && left.every((id) => right.includes(id));
  const contactByActors = (actorIds: string[]) => Object.values(diplomaticDialogues)
    .filter((dialogue) => sameActors(dialogue.participantIds, actorIds))
    .map((dialogue) => dialogue.linkedDossierId)
    .find((dossierId): dossierId is string => Boolean(dossierId && strategicDossiers[dossierId]?.title.startsWith('Contact diplomatique ·')));
  for (const duplicate of Object.values(strategicDossiers)) {
    if (!duplicate.title.startsWith('Canal diplomatique ·')) continue;
    const canonicalId = contactByActors(duplicate.actorIds);
    if (!canonicalId || canonicalId === duplicate.id) continue;
    const canonical = strategicDossiers[canonicalId];
    if (!canonical) continue;
    const entries = [...canonical.entries, ...duplicate.entries]
      .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index)
      .sort((left, right) => left.date.localeCompare(right.date));
    const priority = { minor: 1, moderate: 2, major: 3, critical: 4 } as const;
    strategicDossiers[canonicalId] = {
      ...canonical,
      updatedAt: canonical.updatedAt >= duplicate.updatedAt ? canonical.updatedAt : duplicate.updatedAt,
      importance: priority[duplicate.importance] > priority[canonical.importance] ? duplicate.importance : canonical.importance,
      commitments: [...new Set([...canonical.commitments, ...duplicate.commitments])],
      pendingDecisions: [...new Set([...canonical.pendingDecisions, ...duplicate.pendingDecisions])],
      relatedCurrentIds: [...new Set([...canonical.relatedCurrentIds, ...duplicate.relatedCurrentIds])],
      relatedActionIds: [...new Set([...canonical.relatedActionIds, ...duplicate.relatedActionIds])],
      entries,
    };
    delete strategicDossiers[duplicate.id];
    for (const [programId, program] of Object.entries(actionPrograms)) {
      if (program.linkedDossierId === duplicate.id) actionPrograms[programId] = { ...program, linkedDossierId: canonicalId };
    }
  }
  // Une ancienne règle assimilait toute réussite gouvernementale à une
  // « désescalade ». Cela a notamment transformé des coopérations ordinaires
  // en pseudo-crises. Réparer les sauvegardes existantes : un partenariat
  // demeure actif, avec une réponse ou des engagements à suivre.
  for (const [dossierId, dossier] of Object.entries(strategicDossiers)) {
    if (dossier.kind !== 'cooperation' || dossier.status !== 'deescalating') continue;
    strategicDossiers[dossierId] = {
      ...dossier,
      status: 'active',
      trend: 'stable',
      phase: dossier.phase === 'Réponse gouvernementale efficace'
        ? 'Initiative gouvernementale enregistrée · réponse des partenaires à obtenir'
        : dossier.phase,
    };
  }
  const hasNationalRiskState = Object.values(restored.structuralModifiers ?? {})
    .flat()
    .some((modifier) => modifier.id.startsWith('social-tension-'));
  const loaded: WorldState = {
    ...restored,
    countries,
    relations: { ...baseline.relations, ...restored.relations },
    intelligence: { ...baseline.intelligence, ...restored.intelligence },
    territorial,
    countryEnergy,
    goldStocks: { ...createGoldStocks2000(countries, restored.currentDate), ...(restored.goldStocks ?? {}) },
    resources: createResourceState2000(countries, territorial, restored.currentDate, { ...createGoldStocks2000(countries, restored.currentDate), ...(restored.goldStocks ?? {}) }),
    baselineEnergyFlows: Object.fromEntries(Object.entries({ ...baseline.baselineEnergyFlows, ...restored.baselineEnergyFlows }).map(([id, flow]) => [id, {
      ...flow, sourceNodeId: flow.sourceNodeId,
    }])),
    strategicDossiers,
    worldEvents: restored.worldEvents ?? [],
    historicalAnchors: { ...createHistoricalAnchors2000(), ...restored.historicalAnchors },
    macroEconomies,
    sectors,
    worldEconomy,
    tradeFlows: { ...createTradeFlows2000(), ...restored.tradeFlows },
    decisionProfiles: { ...createDecisionProfiles2000(countries), ...restored.decisionProfiles },
    leadership: { ...createLeadership2000(countries), ...restored.leadership },
    politicalCycles: { ...createPoliticalCycles2000(countries), ...restored.politicalCycles },
    politicalApparatus: { ...createPoliticalApparatus2000(countries), ...restored.politicalApparatus },
    nationalPolitics: { ...createNationalPolitics2000(), ...restored.nationalPolitics },
    structuralProfiles,
    structuralModifiers: hasNationalRiskState
      ? { ...createStructuralModifiers2000(countries, restored.currentDate), ...restored.structuralModifiers }
      : createStructuralModifiers2000(countries, restored.currentDate),
    stakeholderGroups: { ...createStakeholderGroups2000(countries, structuralProfiles), ...restored.stakeholderGroups },
    stakeholderReactions: restored.stakeholderReactions ?? {},
    nationalReforms: { ...createNationalReforms2000(countries, restored.currentDate), ...restored.nationalReforms },
    powerActors: restored.powerActors ?? {},
    powerStruggleCampaigns: restored.powerStruggleCampaigns ?? {},
    aiJobs: restored.aiJobs ?? (restored as unknown as { powerStruggleAIRequests?: WorldState['aiJobs'] }).powerStruggleAIRequests ?? {},
    actionPrograms,
    reports: { ...baseline.reports, ...restored.reports },
    territorialProjects: restored.territorialProjects ?? {},
    militaryTheaters: { ...baseline.militaryTheaters, ...restored.militaryTheaters },
    militaryBases: { ...baseline.militaryBases, ...restored.militaryBases },
    warZones: { ...baseline.warZones, ...restored.warZones },
    diplomaticSessions: restored.diplomaticSessions ?? {},
    diplomaticDialogues,
    diplomaticBriefs: restored.diplomaticBriefs ?? {},
    diplomaticMeetings: restored.diplomaticMeetings ?? {},
    diplomaticAgreementDrafts: restored.diplomaticAgreementDrafts ?? {},
  };
  // La première version utilisait des traits culturels spécifiques. Ils sont
  // remplacés par des tensions génériques fondées sur les données réellement
  // simulées ; les parties antérieures sont donc normalisées une fois ici.
  return hasNationalRiskState ? loaded : initializeStructuralModifiers(loaded);
}

export function cloneWorld(state: WorldState) {
  return deserializeWorld(serializeWorld(state));
}
