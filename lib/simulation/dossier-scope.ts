import type { DossierScope, StrategicDossier, WorldState } from './types';
export type { DossierScope } from './types';

export type DossierDisplayScope = 'national' | 'world';

/** Périmètre fonctionnel d’un dossier, indépendant de son importance. */
/**
 * Les sauvegardes historiques ne possèdent pas toujours encore `scope`.
 * L’inférence reste volontairement simple et rejouable : un dossier qui cite
 * le pays joué est prioritaire pour lui. Une crise intérieure étrangère reste
 * toujours un dossier mondial pour l'interface et pour l'ordonnancement.
 */
export function dossierScopeFor(
  state: WorldState,
  dossier: StrategicDossier,
): DossierScope {
  // `national` a longtemps voulu dire « intérieur à n'importe quel État ».
  // On corrige aussi les anciennes sauvegardes : seul le pays joué peut
  // conserver cette portée dans le moteur.
  const countryActors = dossier.actorIds.filter((actorId) => Boolean(state.countries[actorId]));
  if (dossier.scope === 'national') return countryActors.length === 1 && countryActors[0] === state.playerCountryId ? 'national' : 'world';
  if (dossier.scope) return dossier.scope;
  if (dossier.actorIds.includes(state.playerCountryId))
    return 'player_involved';
  return countryActors.length === 1 && countryActors[0] === state.playerCountryId ? 'national' : 'world';
}

export function dossierScopeLabel(scope: DossierScope) {
  // `player_involved` conserve une priorité moteur, mais désigne une affaire
  // internationale pour le joueur. « National » reste réservé au seul
  // périmètre intérieur du pays gouverné.
  return scope === 'national' ? 'National' : 'Mondial';
}

/**
 * Portée affichée dans la file des dossiers.
 *
 * « National » signifie strictement affaire intérieure du pays joué. Un
 * dossier sur la Turquie, le Congo ou la Russie reste donc mondial, même si
 * l'ancienne sauvegarde lui avait attribué la portée `national`.
 */
export function dossierDisplayScopeFor(
  state: WorldState,
  dossier: StrategicDossier,
): DossierDisplayScope {
  const countryActors = dossier.actorIds.filter((actorId) => Boolean(state.countries[actorId]));
  return countryActors.length === 1 && countryActors[0] === state.playerCountryId ? 'national' : 'world';
}

export function dossierDisplayScopeLabel(scope: DossierDisplayScope) {
  return scope === 'world' ? 'Mondial' : 'National';
}
