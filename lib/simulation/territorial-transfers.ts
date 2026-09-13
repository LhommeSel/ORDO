import { commitWorldAction } from './ledger';
import type { WorldState } from './types';

/** Transfert atomique : cession comptable, occupation temporaire ou libération. */
export function transferTerritory(
  state: WorldState,
  territoryId: string,
  targetCountryId: string,
  mode: 'cession' | 'occupation' | 'liberation',
  actorId: string = state.playerCountryId,
) {
  const territory = state.territorial.territories[territoryId];
  if (!territory) return { ok: false as const, state, error: 'Territoire inconnu.' };
  if (!state.countries[targetCountryId]) return { ok: false as const, state, error: 'Pays cible inconnu.' };
  if (mode === 'cession' && territory.sovereignCountryId !== actorId) return { ok: false as const, state, error: 'Seul le souverain peut céder ce territoire.' };
  if ((mode === 'occupation' || mode === 'liberation') && territory.controllerEntityId !== actorId) return { ok: false as const, state, error: 'Le pays joué ne contrôle pas ce territoire.' };
  if (mode !== 'liberation' && targetCountryId === territory.sovereignCountryId) return { ok: false as const, state, error: 'Le pays cible est déjà le souverain de ce territoire.' };
  const label = mode === 'cession' ? 'Céder' : mode === 'occupation' ? 'Placer sous occupation' : 'Libérer';
  const next = commitWorldAction(state, {
    kind: 'diplomatic', actorId, targetIds: [targetCountryId], origin: 'player',
    intent: `${label} le territoire ${territory.name}`,
    effects: [{ kind: 'territory_transfer', territoryId, targetCountryId, mode, reason: mode === 'cession'
      ? `La cession de « ${territory.name} » réconcilie souveraineté, contrôle et comptes macroéconomiques.`
      : mode === 'occupation'
        ? `Le contrôle de « ${territory.name} » passe temporairement à ${state.countries[targetCountryId].name} sans transfert de PIB.`
        : `Le contrôle de « ${territory.name} » revient à son souverain sans modifier les comptes nationaux.` }],
  });
  return { ok: true as const, state: next, message: `${territory.name} : opération « ${mode} » enregistrée.` };
}
