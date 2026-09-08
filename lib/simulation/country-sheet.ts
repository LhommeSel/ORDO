import { energyBalance } from './energy';
import { relationBetween } from './ledger';
import type { CountryId, WorldState } from './types';

export type DefenseReference = {
  budgetBillionUsd: number;
  activePersonnelThousands: number;
  posture: string;
  capabilities: string[];
};

/**
 * Références de départ 2000. Elles donnent des ordres de grandeur jouables,
 * pas un renseignement temps réel : les données sensibles évoluent ensuite
 * par le moteur et sont filtrées par le renseignement du joueur.
 */
export const defenseReference2000: Record<CountryId, DefenseReference> = {
  FRA: { budgetBillionUsd: 44, activePersonnelThousands: 353, posture: 'dissuasion indépendante et projection', capabilities: ['dissuasion nucléaire', 'aéronavale', 'forces de projection'] },
  DEU: { budgetBillionUsd: 28, activePersonnelThousands: 333, posture: 'défense alliée européenne', capabilities: ['armée de terre mécanisée', 'industrie de défense', 'OTAN'] },
  ITA: { budgetBillionUsd: 20, activePersonnelThousands: 320, posture: 'méditerranée et coalition', capabilities: ['marine', 'bases méditerranéennes', 'OTAN'] },
  POL: { budgetBillionUsd: 4.5, activePersonnelThousands: 235, posture: 'défense territoriale en transition', capabilities: ['forces terrestres', 'adaptation OTAN'] },
  GBR: { budgetBillionUsd: 36, activePersonnelThousands: 212, posture: 'projection alliée mondiale', capabilities: ['dissuasion nucléaire', 'marine hauturière', 'renseignement'] },
  USA: { budgetBillionUsd: 281, activePersonnelThousands: 1370, posture: 'projection mondiale', capabilities: ['porte-avions', 'dissuasion nucléaire', 'supériorité aérienne'] },
  RUS: { budgetBillionUsd: 20, activePersonnelThousands: 1200, posture: 'puissance continentale et nucléaire', capabilities: ['dissuasion nucléaire', 'forces terrestres', 'complexe militaro-industriel'] },
  CHN: { budgetBillionUsd: 40, activePersonnelThousands: 2500, posture: 'montée en puissance régionale', capabilities: ['forces terrestres massives', 'missiles', 'modernisation navale'] },
  NOR: { budgetBillionUsd: 3.6, activePersonnelThousands: 27, posture: 'surveillance nord-atlantique', capabilities: ['OTAN', 'surveillance maritime'] },
  DZA: { budgetBillionUsd: 2.1, activePersonnelThousands: 120, posture: 'sécurité du régime et frontières', capabilities: ['forces terrestres', 'contre-insurrection'] },
  LBY: { budgetBillionUsd: 0.9, activePersonnelThousands: 75, posture: 'défense du régime', capabilities: ['défense aérienne', 'forces conventionnelles'] },
  SAU: { budgetBillionUsd: 20, activePersonnelThousands: 200, posture: 'protection des infrastructures et du régime', capabilities: ['défense aérienne', 'achats occidentaux'] },
  BRA: { budgetBillionUsd: 14, activePersonnelThousands: 318, posture: 'autonomie régionale', capabilities: ['armée de terre', 'industrie aéronautique', 'Atlantique sud'] },
  ZAF: { budgetBillionUsd: 2, activePersonnelThousands: 78, posture: 'stabilité régionale', capabilities: ['forces régionales', 'industrie de défense limitée'] },
  AUS: { budgetBillionUsd: 10, activePersonnelThousands: 52, posture: 'alliance indo-pacifique', capabilities: ['marine', 'interopérabilité alliée'] },
  IND: { budgetBillionUsd: 17, activePersonnelThousands: 1300, posture: 'autonomie continentale', capabilities: ['dissuasion nucléaire', 'forces terrestres', 'marine en expansion'] },
  JPN: { budgetBillionUsd: 45, activePersonnelThousands: 240, posture: 'défense insulaire alliée', capabilities: ['marine', 'défense aérienne', 'alliance américaine'] },
  TUR: { budgetBillionUsd: 8, activePersonnelThousands: 640, posture: 'puissance-pivot régionale', capabilities: ['forces terrestres', 'OTAN', 'détroits'] },
  VNM: { budgetBillionUsd: 1, activePersonnelThousands: 480, posture: 'défense territoriale', capabilities: ['forces terrestres', 'défense côtière'] },
};

const normalize = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

const aliases: Record<string, string[]> = {
  USA: ['usa', 'us', 'etats unis', 'amerique'], GBR: ['royaume uni', 'grande bretagne', 'angleterre'],
  SAU: ['arabie saoudite', 'saoudiens'], DZA: ['algerie'], DEU: ['allemagne'], RUS: ['russie', 'moscou'],
  CHN: ['chine'], JPN: ['japon'], TUR: ['turquie'], ZAF: ['afrique du sud'], AUS: ['australie'], IND: ['inde'], BRA: ['bresil'], VNM: ['vietnam'],
};

export function countryMentionedInText(state: WorldState, text: string): CountryId | undefined {
  const normalized = ` ${normalize(text)} `;
  return Object.values(state.countries)
    .flatMap((country) => [country.name, ...(aliases[country.id] ?? [])].map((name) => ({ id: country.id, name: normalize(name) })))
    .filter((candidate) => candidate.name.length > 1 && normalized.includes(` ${candidate.name} `))
    .sort((a, b) => b.name.length - a.name.length)[0]?.id;
}

/** Retourne toutes les entités nationales explicitement citées, dans l'ordre de leur apparition. */
export function countryIdsMentionedInText(state: WorldState, text: string): CountryId[] {
  const normalized = ` ${normalize(text)} `;
  const matches = Object.values(state.countries)
    .flatMap((country) => [country.name, ...(aliases[country.id] ?? [])].map((name) => ({ id: country.id, name: normalize(name) })))
    .filter((candidate) => candidate.name.length > 1 && normalized.includes(` ${candidate.name} `))
    .sort((a, b) => normalized.indexOf(` ${a.name} `) - normalized.indexOf(` ${b.name} `) || b.name.length - a.name.length);
  return [...new Set(matches.map((match) => match.id))];
}

export type CountrySheet = {
  countryId: CountryId;
  macro: { gdp: number; growth: number; population: number; inflation: number; unemployment: number; debt: number; fiscalBalance: number } | null;
  energy: { oilImports: number; gasImports: number; oilStocksMonths: number; gasStocksMonths: number } | null;
  defense: DefenseReference | null;
  relation?: { value: number; trust: number };
  topGoal?: string;
  vulnerabilities: string[];
};

export function countrySheet(state: WorldState, countryId: CountryId): CountrySheet | null {
  const country = state.countries[countryId];
  if (!country) return null;
  const macro = state.macroEconomies[countryId];
  const oil = energyBalance(state, countryId, 'oil');
  const gas = energyBalance(state, countryId, 'gas');
  const relation = countryId === state.playerCountryId ? undefined : relationBetween(state, state.playerCountryId, countryId);
  return {
    countryId,
    macro: macro ? {
      gdp: macro.realGdpBillion2000Usd, growth: macro.realGrowthAnnualPct, population: macro.populationMillions,
      inflation: macro.inflationAnnualPct, unemployment: macro.unemploymentPct, debt: macro.publicDebtPctGdp, fiscalBalance: macro.fiscalBalancePctGdp,
    } : null,
    energy: oil && gas ? { oilImports: oil.imports, gasImports: gas.imports, oilStocksMonths: oil.coverageMonths, gasStocksMonths: gas.coverageMonths } : null,
    defense: defenseReference2000[countryId] ?? null,
    relation: relation ? { value: relation.relation, trust: relation.trust } : undefined,
    topGoal: country.strategy.goals.slice().sort((a, b) => b.priority - a.priority)[0]?.label,
    vulnerabilities: country.strategy.vulnerabilities,
  };
}
