import type { ISODate, WorldState } from '../types';

export type SimulationPhaseContext = {
  chunkStart: ISODate;
  chunkEnd: ISODate;
  elapsedMonths: number;
  reachedMonthBoundary: boolean;
};

export type SimulationPhase = {
  id: string;
  advance: (state: WorldState, context: SimulationPhaseContext) => WorldState;
};

/**
 * Orchestrateur neutre : les domaines restent indépendants et l'ordre explicite
 * rend les interactions auditables sans transformer engine.ts en monolithe.
 */
export function runSimulationPipeline(
  state: WorldState,
  context: SimulationPhaseContext,
  phases: readonly SimulationPhase[],
) {
  return phases.reduce((next, phase) => phase.advance(next, context), state);
}

