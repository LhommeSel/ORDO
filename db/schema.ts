/**
 * Schéma logique D1 d'ORDO.
 *
 * Le quota ne conserve que des compteurs agrégés par fenêtre UTC et des clés
 * déjà hachées. Les sauvegardes, conversations et contenus de partie restent
 * locaux au navigateur et ne sont jamais écrits dans cette table.
 */
export const aiQuotaWindowsTable = 'ai_quota_windows' as const;
