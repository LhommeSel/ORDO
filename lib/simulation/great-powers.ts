import type { CountryId } from './types';

/**
 * Périmètre de référence suivi avec un niveau de détail explicite au lancement
 * du scénario 2000. Les autres États restent jouables sur leur fiche compacte.
 */
export const trackedGreatPowerIds = [
  'FRA', 'DEU', 'ITA', 'ESP', 'POL', 'USA', 'GBR', 'RUS', 'CHN', 'NOR',
  'DZA', 'LBY', 'SAU', 'BRA', 'ZAF', 'AUS', 'IND', 'JPN', 'TUR', 'VNM',
] as const satisfies readonly CountryId[];
