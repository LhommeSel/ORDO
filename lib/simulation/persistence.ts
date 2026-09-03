import type { WorldState } from './types';
import { createMacroEconomies2000, worldEconomy2000 } from './macro-data-2000';

export type SaveEnvelope = {
  format: 'ordo-world';
  schemaVersion: 1;
  savedAt: string;
  state: WorldState;
};

export function serializeWorld(state: WorldState) {
  const envelope: SaveEnvelope = {
    format: 'ordo-world', schemaVersion: 1, savedAt: new Date().toISOString(), state,
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
  const countryEnergy = Object.fromEntries(Object.entries(restored.countryEnergy).map(([countryId, energy]) => [countryId, {
    ...energy,
    legacyImports: energy.legacyImports ?? {
      oil: Math.max(0, energy.annualDemand.oil - energy.domesticProduction.oil),
      gas: Math.max(0, energy.annualDemand.gas - energy.domesticProduction.gas),
    },
  }]));
  return {
    ...restored,
    countryEnergy,
    strategicDossiers: restored.strategicDossiers ?? {},
    macroEconomies: restored.macroEconomies ?? createMacroEconomies2000(),
    worldEconomy: restored.worldEconomy ?? structuredClone(worldEconomy2000),
  };
}

export function cloneWorld(state: WorldState) {
  return deserializeWorld(serializeWorld(state));
}
