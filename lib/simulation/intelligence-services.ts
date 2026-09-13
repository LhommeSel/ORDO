import type {
  ActionProgram,
  CountryId,
  CountryState,
  IntelligenceAgencyState,
  IntelligenceCoverageBand,
  IntelligenceMissionKind,
  IntelligenceMissionState,
  IntelligenceServiceState,
  ISODate,
  WorldState,
} from './types';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const coverageBand = (value: number): IntelligenceCoverageBand =>
  value >= 76 ? 'profonde' : value >= 51 ? 'établie' : value >= 26 ? 'limitée' : 'absente';

const countryRegion = (country: CountryState) => {
  if (['FRA', 'DEU', 'ITA', 'ESP', 'POL', 'GBR', 'NOR', 'AUT', 'GRC'].includes(country.id)) return 'Europe';
  if (['USA', 'CAN', 'MEX', 'BRA'].includes(country.id)) return 'Amériques';
  if (['DZA', 'EGY', 'MLI', 'NGA', 'ZAF'].includes(country.id)) return 'Afrique';
  if (['SAU', 'IRN', 'TUR'].includes(country.id)) return 'Moyen-Orient';
  if (['CHN', 'IND', 'JPN', 'KOR', 'PRK', 'VNM', 'IDN'].includes(country.id)) return 'Asie';
  if (country.id === 'AUS') return 'Océanie';
  return 'Monde';
};

const genericAgency = (
  country: CountryState,
  id: string,
  name: string,
  domain: IntelligenceAgencyState['domain'],
  multiplier: number,
): IntelligenceAgencyState => {
  const scale = clamp(country.weight * multiplier, 18, 92);
  const technical = clamp(38 + country.weight * 0.42 + country.metrics.industry * 0.08, 28, 88);
  return {
    id, countryId: country.id, name, domain,
    personnelOrder: Math.round(scale * 70),
    surveillancePersonnelOrder: Math.round(scale * 70 * (domain === 'domestic' ? 0.48 : 0.32)),
    fieldPersonnelOrder: Math.round(scale * 70 * (domain === 'external' ? 0.4 : 0.24)),
    networkPersonnelOrder: Math.round(scale * 70 * (domain === 'external' ? 0.28 : 0.2)),
    operationalBudgetBillion: Number((0.15 + scale * 0.018).toFixed(2)),
    technicalLevel: Math.round(technical), readiness: Math.round(clamp(42 + country.metrics.security * 0.18, 32, 82)),
    legalMandate: domain === 'domestic' ? 'Sécurité intérieure et contre-ingérence' : 'Renseignement extérieur et protection des intérêts nationaux',
    politicalOversight: 'Contrôle politique et parlementaire variable selon le régime',
    specialties: domain === 'domestic' ? ['contre-ingérence', 'surveillance intérieure'] : ['analyse pays', 'réseaux extérieurs'],
    coverage: { [countryRegion(country)]: coverageBand(scale), Monde: coverageBand(scale * 0.62) },
  };
};

const franceAgencies = (date: ISODate): Record<string, IntelligenceAgencyState> => ({
  dst: {
    id: 'dst', countryId: 'FRA', name: date >= '2014-05-12' ? 'DGSI' : 'DST', domain: 'domestic',
    personnelOrder: 4500, operationalBudgetBillion: 0.8, technicalLevel: 62, readiness: 72,
    surveillancePersonnelOrder: 2150, fieldPersonnelOrder: 1100, networkPersonnelOrder: 900,
    legalMandate: 'Contre-espionnage, terrorisme et sécurité intérieure',
    politicalOversight: 'Tutelle du ministère de l’Intérieur ; contrôle juridictionnel et parlementaire',
    specialties: ['contre-espionnage', 'terrorisme', 'protection des intérêts scientifiques'],
    coverage: { France: 'profonde', Europe: 'établie' },
  },
  dgse: {
    id: 'dgse', countryId: 'FRA', name: 'DGSE', domain: 'external',
    personnelOrder: 4500, operationalBudgetBillion: 1.2, technicalLevel: 68, readiness: 70,
    surveillancePersonnelOrder: 1500, fieldPersonnelOrder: 1800, networkPersonnelOrder: 1200,
    legalMandate: 'Renseignement extérieur et opérations clandestines autorisées',
    politicalOversight: 'Autorité gouvernementale ; contrôle parlementaire spécialisé',
    specialties: ['renseignement humain', 'écoutes', 'opérations extérieures', 'analyse stratégique'],
    coverage: { Europe: 'établie', Maghreb: 'profonde', 'Moyen-Orient': 'limitée', Afrique: 'établie', Asie: 'limitée', Amériques: 'limitée' },
  },
});

/** Crée un référentiel compact pour tous les États ; la France reçoit le niveau de détail du prototype. */
export function createIntelligenceServices2000(countries: Record<CountryId, CountryState>, date: ISODate = '2000-01-01'): Record<CountryId, IntelligenceServiceState> {
  return Object.fromEntries(Object.values(countries).map((country) => {
    const agencies = country.id === 'FRA'
      ? franceAgencies(date)
      : {
        [`${country.id.toLowerCase()}-domestic`]: genericAgency(country, `${country.id.toLowerCase()}-domestic`, 'Service intérieur', 'domestic', 0.85),
        [`${country.id.toLowerCase()}-external`]: genericAgency(country, `${country.id.toLowerCase()}-external`, 'Service extérieur', 'external', 0.65),
      };
    const regionalCoverage = Object.fromEntries(Object.entries(Object.values(agencies)[0]?.coverage ?? {}).map(([region, band]) => [region, band]));
    return [country.id, { countryId: country.id, agencies, missions: {}, regionalCoverage, lastUpdated: date } satisfies IntelligenceServiceState];
  }));
}

export function intelligenceServiceForCountry(state: WorldState, countryId: CountryId): IntelligenceServiceState | null {
  return state.intelligenceServices?.[countryId] ?? null;
}

export function intelligenceAgencyName(agency: IntelligenceAgencyState, date: ISODate): string {
  if (agency.id === 'dst') return date >= '2014-05-12' ? 'DGSI' : 'DST';
  return agency.name;
}

export const intelligenceMissionKindLabels: Record<IntelligenceMissionKind, string> = {
  surveillance: 'Surveillance ciblée', réseau: 'Développer un réseau', liaison: 'Liaison avec un service partenaire', terrain: 'Mission de terrain', analyse: 'Analyse stratégique',
};

/** Enregistre une mission après le lancement d’un ActionProgram déjà validé. */
export function registerIntelligenceMission(state: WorldState, program: ActionProgram, kind: IntelligenceMissionKind, objective: string, agencyId?: string, targetRegion?: string): WorldState {
  if (program.category !== 'intelligence') return state;
  const service = state.intelligenceServices?.[program.actorId];
  if (!service) return state;
  const agency = agencyId && service.agencies[agencyId] ? service.agencies[agencyId] : Object.values(service.agencies)[0];
  if (!agency) return state;
  const mission: IntelligenceMissionState = {
    id: `intel-mission-${program.id}`,
    agencyId: agency.id, actorCountryId: program.actorId,
    ...(program.targetIds[0] ? { targetCountryId: program.targetIds[0] } : {}),
    ...(targetRegion ? { targetRegion } : {}), kind, objective,
    status: 'active', startedAt: program.startedAt, expectedCompletionAt: program.expectedCompletionAt,
    personnelCommitted: Math.max(1, Math.round(program.requiredCapacities.find(({ domain }) => domain === 'intelligence')?.commitment ?? 1) * 70),
    budgetCost: program.budgetCost, risk: Math.round(clamp(100 - program.successProbability)),
  };
  return { ...state, intelligenceServices: { ...state.intelligenceServices, [program.actorId]: { ...service, missions: { ...service.missions, [mission.id]: mission }, lastUpdated: state.currentDate } } };
}

/** Reflète le statut des missions sur les ActionPrograms résolus par le moteur. */
export function syncIntelligenceMissions(state: WorldState): WorldState {
  if (!state.intelligenceServices) return state;
  let changed = false;
  const services: Record<CountryId, IntelligenceServiceState> = Object.fromEntries(Object.entries(state.intelligenceServices).map(([countryId, service]) => {
    const missions: Record<string, IntelligenceMissionState> = Object.fromEntries(Object.entries(service.missions).map(([id, mission]) => {
      const program = state.actionPrograms[`program-intelligence-${id.replace('intel-mission-program-intelligence-', '')}`] ?? Object.values(state.actionPrograms).find((candidate) => `intel-mission-${candidate.id}` === id);
      if (!program) return [id, mission];
      const status = program.status === 'active' ? 'active' : program.status === 'succeeded' || program.status === 'partially_succeeded' ? 'completed' : program.status === 'failed' ? 'failed' : 'cancelled';
      if (status !== mission.status) { changed = true; return [id, { ...mission, status }]; }
      return [id, mission];
    }));
    return [countryId, { ...service, missions, lastUpdated: state.currentDate }];
  }));
  return changed ? { ...state, intelligenceServices: services } : state;
}

export { coverageBand };
