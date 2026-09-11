import type { ISODate, WorldState } from '../types';

/** Découpage large utilisé uniquement pour éviter la concentration du pouls autonome. */
const REGION_GROUPS: Record<string, string[]> = {
  Europe: ['FRA', 'DEU', 'ITA', 'ESP', 'GBR', 'POL', 'AUT', 'BEL', 'BGR', 'BIH', 'CHE', 'CZE', 'DNK', 'EST', 'FIN', 'GRC', 'HRV', 'HUN', 'IRL', 'ISL', 'LUX', 'NLD', 'PRT', 'ROU', 'SRB', 'SWE', 'UKR'],
  'Amérique du Nord': ['USA', 'CAN', 'MEX', 'CRI', 'CUB', 'DOM', 'GTM', 'NIC', 'PAN'],
  'Amérique du Sud': ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'PER', 'URY', 'VEN'],
  Afrique: ['AGO', 'CIV', 'CMR', 'COD', 'EGY', 'ETH', 'GHA', 'KEN', 'MAR', 'MOZ', 'NGA', 'SEN', 'SDN', 'TZA', 'TUN', 'UGA', 'ZAF', 'ZWE'],
  'Moyen-Orient': ['ARE', 'BHR', 'IRN', 'IRQ', 'ISR', 'JOR', 'KWT', 'LBN', 'QAT', 'SAU', 'SYR', 'YEM'],
  'Asie centrale': ['KAZ', 'TKM', 'UZB'],
  'Asie du Sud': ['AFG', 'BGD', 'IND', 'PAK'],
  'Asie de l’Est': ['CHN', 'JPN', 'KOR', 'MMR'],
  'Asie du Sud-Est et Océanie': ['AUS', 'IDN', 'KHM', 'MYS', 'NZL', 'PHL', 'SGP', 'THA', 'VNM'],
};
const regionByCountry = new Map(Object.entries(REGION_GROUPS).flatMap(([region, ids]) => ids.map((id) => [id, region] as const)));

export type WorldAttentionTarget = { region: string; priority: number; reason: string; countryIds: string[] };

function monthsBetween(from: ISODate, to: ISODate) {
  const start = new Date(`${from}T00:00:00Z`); const end = new Date(`${to}T00:00:00Z`);
  return Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
}
const countryRegion = (id: string) => regionByCountry.get(id) ?? 'Autres régions';

function addActivity(activity: Map<string, ISODate>, state: WorldState, date: ISODate, ids: string[]) {
  const regions = new Set(ids.filter((id) => state.countries[id]).map(countryRegion));
  for (const region of regions) if (!activity.has(region) || date > (activity.get(region) as ISODate)) activity.set(region, date);
}

/** Rotation déterministe des régions hors de la file des crises majeures. */
export function rankWorldAttention(state: WorldState, recentPlayerActions: Array<{ actorId: string; targetIds: string[] }>, limit = 4): WorldAttentionTarget[] {
  const countriesByRegion = new Map<string, string[]>();
  for (const country of Object.values(state.countries)) {
    const region = countryRegion(country.id); countriesByRegion.set(region, [...(countriesByRegion.get(region) ?? []), country.id]);
  }
  const activity = new Map<string, ISODate>();
  for (const action of state.actions) addActivity(activity, state, action.createdAt, [action.actorId, ...(action.targetIds ?? [])]);
  const recentlyTouched = new Set(recentPlayerActions.flatMap((action) => [action.actorId, ...action.targetIds]).filter((id) => state.countries[id]).map(countryRegion));
  return [...countriesByRegion.entries()].map(([region, countryIds]) => {
    const last = activity.get(region); const neglectedMonths = last ? monthsBetween(last, state.currentDate) : 12;
    const weight = countryIds.reduce((sum, id) => sum + (state.countries[id]?.weight ?? 0), 0);
    const priority = Math.min(100, Math.round(25 + Math.min(42, neglectedMonths * 5) + Math.min(24, weight / 10) - (recentlyTouched.has(region) ? 24 : 0)));
    const reason = last ? `${neglectedMonths} mois sans mouvement autonome visible` : 'région jamais observée par le pouls';
    return { region, priority, reason, countryIds: countryIds.slice().sort((a, b) => (state.countries[b]?.weight ?? 0) - (state.countries[a]?.weight ?? 0)).slice(0, 12) };
  }).sort((a, b) => b.priority - a.priority || a.region.localeCompare(b.region)).slice(0, limit);
}

export function regionForCountry(countryId: string) { return countryRegion(countryId); }
