import type { WorldState } from './types';
import { createTerritorialState, indexTerritorialState } from './territories';
import { createMacroEconomies2000, worldEconomy2000 } from './macro-data-2000';
import { createStructuralProfiles2000 } from './structural-data-2000';
import { createStakeholderGroups2000 } from './stakeholder-data-2000';
import { createTradeFlows2000 } from './trade-data-2000';
import { createDecisionProfiles2000 } from './decision-data-2000';
import { createLeadership2000, createPoliticalApparatus2000 } from './political-identity-data-2000';

export type SaveEnvelope = {
  format: 'ordo-world';
  schemaVersion: 1;
  savedAt: string;
  state: WorldState;
};

const SAVE_COMPACTION_THRESHOLD = 2_000;
const TECHNICAL_ACTION_TAIL = 240;
const TECHNICAL_LEDGER_TAIL = 480;

/**
 * Les états courants sont déjà des snapshots complets : au-delà d'une partie
 * longue, garder chaque écriture technique de chaque frontière mensuelle ne
 * renforce pas la simulation et gonfle inutilement le stockage local.
 * Les choix, réponses IA, événements visibles et une queue technique bornée
 * restent intacts. Les index de revue autonome sont recalés sur la nouvelle
 * liste d'actions.
 */
export function compactWorldForSave(state: WorldState): WorldState {
  if (state.actions.length <= SAVE_COMPACTION_THRESHOLD) return state;
  const firstTechnicalActionToKeep = Math.max(0, state.actions.length - TECHNICAL_ACTION_TAIL);
  const keepAction = (action: WorldState['actions'][number], index: number) =>
    action.origin === 'player'
    || action.origin === 'ai'
    || action.origin === 'historical'
    || action.visibility === 'player'
    || action.metadata?.minorEvent === true
    || index >= firstTechnicalActionToKeep;
  const keptActions = state.actions.filter(keepAction);
  const keptActionIds = new Set(keptActions.map((action) => action.id));
  const firstTechnicalChangeToKeep = Math.max(0, state.ledger.length - TECHNICAL_LEDGER_TAIL);
  const keptLedger = state.ledger.filter((change, index) =>
    keptActionIds.has(change.actionId)
    || change.origin === 'player'
    || change.origin === 'ai'
    || change.origin === 'historical'
    || change.visibility === 'player'
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
  const envelope: SaveEnvelope = {
    format: 'ordo-world', schemaVersion: 1, savedAt: new Date().toISOString(), state: compactWorldForSave(state),
  };
  return JSON.stringify(envelope);
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
  const structuralProfiles = restored.structuralProfiles ?? createStructuralProfiles2000();
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
  const countryEnergy = Object.fromEntries(Object.entries(restored.countryEnergy).map(([countryId, energy]) => [countryId, {
    ...energy,
    legacyImports: energy.legacyImports ?? {
      oil: Math.max(0, energy.annualDemand.oil - energy.domesticProduction.oil),
      gas: Math.max(0, energy.annualDemand.gas - energy.domesticProduction.gas),
    },
  }]));
  return {
    ...restored,
    territorial: restored.territorial
      ? indexTerritorialState(restored.territorial)
      : createTerritorialState({ countries: restored.countries, macroEconomies }),
    countryEnergy,
    baselineEnergyFlows: Object.fromEntries(Object.entries(restored.baselineEnergyFlows ?? {}).map(([id, flow]) => [id, {
      ...flow, sourceNodeId: flow.sourceNodeId,
    }])),
    strategicDossiers: restored.strategicDossiers ?? {},
    macroEconomies,
    worldEconomy,
    tradeFlows: restored.tradeFlows ?? createTradeFlows2000(),
    decisionProfiles: restored.decisionProfiles ?? createDecisionProfiles2000(restored.countries),
    leadership: restored.leadership ?? createLeadership2000(restored.countries),
    politicalApparatus: restored.politicalApparatus ?? createPoliticalApparatus2000(restored.countries),
    structuralProfiles,
    stakeholderGroups: restored.stakeholderGroups ?? createStakeholderGroups2000(restored.countries, structuralProfiles),
    stakeholderReactions: restored.stakeholderReactions ?? {},
    powerActors: restored.powerActors ?? {},
    powerStruggleCampaigns: restored.powerStruggleCampaigns ?? {},
    aiJobs: restored.aiJobs ?? (restored as unknown as { powerStruggleAIRequests?: WorldState['aiJobs'] }).powerStruggleAIRequests ?? {},
    actionPrograms: restored.actionPrograms ?? {},
    diplomaticSessions: restored.diplomaticSessions ?? {},
  };
}

export function cloneWorld(state: WorldState) {
  return deserializeWorld(serializeWorld(state));
}
