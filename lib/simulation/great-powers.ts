import type { CountryId } from './types';

/** Noyau de gameplay. Les ensembles sont géopolitiques, pas des continents stricts. */
export const priorityCountryGroups = {
  Europe: ['FRA', 'DEU', 'ITA', 'ESP', 'POL', 'GBR', 'NOR', 'AUT', 'GRC', 'UKR', 'NLD'],
  Amériques: ['USA', 'CAN', 'BRA', 'MEX'],
  'Asie-Pacifique': ['CHN', 'IND', 'JPN', 'KOR', 'PRK', 'TWN', 'PAK', 'VNM', 'IDN', 'AUS'],
  'Eurasie et Moyen-Orient': ['RUS', 'TUR', 'IRN', 'SAU', 'ISR'],
  Afrique: ['DZA', 'EGY', 'LBY', 'NER', 'MLI', 'NGA', 'ZAF'],
} as const satisfies Record<string, readonly CountryId[]>;

/** Les 37 États dont la fiche doit progressivement passer au niveau détaillé. */
export const priorityCountryIds = Object.values(priorityCountryGroups).flat() as CountryId[];

export function priorityGroupForCountry(countryId: CountryId) {
  return Object.entries(priorityCountryGroups).find(([, ids]) => (ids as readonly CountryId[]).includes(countryId))?.[0] ?? 'Autre';
}

/**
 * Sous-ensemble déjà documenté de bout en bout. Le nom est conservé pour les
 * modules historiques ; la liste de priorité ne prétend pas que les 37 fiches
 * sont toutes exhaustives dès aujourd'hui.
 */
export const trackedGreatPowerIds = [
  'FRA', 'DEU', 'ITA', 'ESP', 'POL', 'USA', 'GBR', 'RUS', 'CHN', 'NOR',
  'DZA', 'LBY', 'SAU', 'BRA', 'ZAF', 'AUS', 'IND', 'JPN', 'TUR', 'VNM', 'CAN', 'MEX',
] as const satisfies readonly CountryId[];
