import type { DossierScope, StrategicDossier, WorldState } from './types';
export type { DossierScope } from './types';

/** Périmètre fonctionnel d’un dossier, indépendant de son importance. */
/**
 * Les sauvegardes historiques ne possèdent pas toujours encore `scope`.
 * L’inférence reste volontairement simple et rejouable : un dossier qui cite
 * le pays joué est prioritaire pour lui, un dossier à acteur national unique
 * reste une situation intérieure étrangère, le reste relève du monde.
 */
export function dossierScopeFor(
  state: WorldState,
  dossier: StrategicDossier,
): DossierScope {
  if (dossier.scope) return dossier.scope;
  if (dossier.actorIds.includes(state.playerCountryId))
    return 'player_involved';
  const countryActors = dossier.actorIds.filter((actorId) =>
    Boolean(state.countries[actorId]),
  );
  return countryActors.length <= 1 ? 'national' : 'world';
}

export function dossierScopeLabel(scope: DossierScope) {
  return scope === 'player_involved'
    ? 'Implique le joueur'
    : scope === 'national'
      ? 'National · autre pays'
      : 'Mondial';
}
