import { energyBalance } from './energy';
import { relationBetween } from './ledger';
import type { CountryId, WorldState } from './types';

export type DefenseReference = {
  budgetBillionUsd: number;
  activePersonnelThousands: number;
  posture: string;
  capabilities: string[];
  /** Part des actifs immédiatement aptes au combat et part projetable durablement. */
  combatAvailabilityPct?: number;
  sustainableProjectionPct?: number;
  /** Inventaire agrégé pour le dossier militaire (ordre de grandeur jouable). */
  unitTypes?: Array<{ id: string; label: string; personnelThousands: number; quality: number; qualityLabel: string }>;
  /** Répartition indicative des forces par théâtre ou zone de projection. */
  deployments?: Array<{ location: string; personnelThousands: number; mission: string }>;
  modelingLevel?: 'documented' | 'aggregate';
};

export type SecurityActorReference = {
  id: string;
  name: string;
  category: 'organized_crime' | 'terrorist' | 'paramilitary';
  activity: string;
  zones: string[];
  estimatedStrength: string;
  threatLevel: 'low' | 'moderate' | 'high' | 'critical';
  notes: string;
};

/** Acteurs non étatiques documentés comme contexte de scénario autour de 2000. */
export const securityActorReference2000: Record<CountryId, SecurityActorReference[]> = {
  FRA: [
    { id: 'illegal-gold-miners-guyane', name: 'Réseaux d’orpaillage illégal en Guyane', category: 'organized_crime', activity: 'Extraction clandestine, contrebande d’or et logistique fluviale', zones: ['Maroni', 'Oyapock', 'intérieur guyanais'], estimatedStrength: 'réseaux diffus · plusieurs centaines d’opérateurs', threatLevel: 'high', notes: 'Pression sur l’environnement, les communes isolées et la souveraineté territoriale.' },
    { id: 'corsican-organized-crime', name: 'Réseaux de grand banditisme corse', category: 'organized_crime', activity: 'Extorsion, trafics et blanchiment', zones: ['Corse', 'arc méditerranéen', 'métropoles'], estimatedStrength: 'cellules et soutiens · ordre de grandeur non consolidé', threatLevel: 'high', notes: 'Capacité d’influence locale et d’intimidation des acteurs économiques.' },
    { id: 'metropolitan-organized-crime', name: 'Réseaux de grand banditisme métropolitain', category: 'organized_crime', activity: 'Stupéfiants, armes, braquages et recyclage financier', zones: ['Île-de-France', 'Provence', 'grands ports'], estimatedStrength: 'réseaux fragmentés · milliers de membres et relais', threatLevel: 'moderate', notes: 'Menace principalement criminelle, avec effets sur la corruption et la sécurité urbaine.' },
    { id: 'corsican-clandestine-groups', name: 'Groupes armés clandestins corses', category: 'paramilitary', activity: 'Actions armées, intimidation et contrôle territorial ponctuel', zones: ['Corse'], estimatedStrength: 'quelques centaines de membres et soutiens', threatLevel: 'high', notes: 'Catégorie paramilitaire utilisée par le scénario pour suivre les capacités armées clandestines.' },
    { id: 'jihadist-networks-2000', name: 'Réseaux jihadistes clandestins issus du GIA', category: 'terrorist', activity: 'Soutien logistique, recrutement et préparation d’attentats', zones: ['métropole · réseaux transnationaux'], estimatedStrength: 'petites cellules · effectifs discrets', threatLevel: 'moderate', notes: 'Signal de renseignement : la capacité réelle dépend de la surveillance et des connexions extérieures.' },
  ],
};

/**
 * Références de départ 2000. Elles donnent des ordres de grandeur jouables,
 * pas un renseignement temps réel : les données sensibles évoluent ensuite
 * par le moteur et sont filtrées par le renseignement du joueur.
 */
export const defenseReference2000: Record<CountryId, DefenseReference> = {
  FRA: {
    budgetBillionUsd: 44, activePersonnelThousands: 353, posture: 'dissuasion indépendante et projection',
    capabilities: ['dissuasion nucléaire', 'aéronavale', 'forces de projection'],
    combatAvailabilityPct: 42,
    sustainableProjectionPct: 28,
    unitTypes: [
      { id: 'army', label: 'Armée de terre', personnelThousands: 139, quality: 78, qualityLabel: 'Bonne · professionnalisation en cours' },
      { id: 'navy', label: 'Marine nationale', personnelThousands: 44, quality: 82, qualityLabel: 'Très bonne · haute disponibilité navale' },
      { id: 'air', label: "Armée de l'air", personnelThousands: 64, quality: 80, qualityLabel: 'Très bonne · supériorité aérienne régionale' },
      { id: 'gendarmerie', label: 'Gendarmerie nationale', personnelThousands: 100, quality: 74, qualityLabel: 'Bonne · maillage territorial' },
      { id: 'joint', label: 'Services interarmées', personnelThousands: 6, quality: 76, qualityLabel: 'Bonne · soutien et renseignement' },
    ],
    deployments: [
      { location: 'Métropole', personnelThousands: 240, mission: 'Défense du territoire, dissuasion et entraînement' },
      { location: "Outre-mer et bases prépositionnées", personnelThousands: 24, mission: 'Souveraineté, protection des approches et présence' },
      { location: 'Afrique', personnelThousands: 18, mission: 'Coopération de défense et opérations extérieures' },
      { location: 'Balkans', personnelThousands: 8, mission: 'KFOR, maintien de la paix et sécurisation' },
      { location: 'Missions navales et aériennes', personnelThousands: 15, mission: 'Projection, surveillance et contrôle des espaces' },
      { location: 'Réserve opérationnelle / rotation', personnelThousands: 48, mission: 'Alerte, relève et renfort des théâtres' },
    ],
  },
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

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/**
 * Produit un ordre de grandeur militaire pour les pays sans inventaire dédié.
 * Le budget et les effectifs sont cohérents avec l'économie, la population et
 * la posture du régime, sans prétendre documenter une armée unité par unité.
 */
export function defenseReferenceForCountry(state: WorldState, countryId: CountryId): DefenseReference | null {
  const documented = defenseReference2000[countryId];
  if (documented) return { ...documented, modelingLevel: 'documented' };
  const country = state.countries[countryId];
  const economy = state.macroEconomies[countryId];
  if (!country || !economy) return null;
  const coerciveRegime = /autoritaire|junte|parti unique|militaire|absolue/i.test(country.politics.regime);
  const spendingShare = clamp(
    1.05 + country.weight / 70 + Math.max(0, 58 - country.metrics.security) / 38 + (coerciveRegime ? 0.65 : 0),
    0.7,
    7.5,
  );
  const personnelShare = clamp(
    0.22 + country.weight / 95 + Math.max(0, 55 - country.metrics.security) / 42 + (coerciveRegime ? 0.38 : 0),
    0.12,
    2.8,
  );
  const posture = country.weight >= 75
    ? 'projection et influence internationale'
    : country.weight >= 45
      ? 'défense régionale et protection des intérêts nationaux'
      : coerciveRegime
        ? 'sécurité du régime et défense territoriale'
        : 'défense territoriale et coopération régionale';
  const capabilities = [
    country.metrics.industry >= 65 ? 'base industrielle nationale' : 'capacités conventionnelles',
    country.weight >= 65 ? 'projection régionale' : 'défense territoriale',
  ];
  return {
    budgetBillionUsd: Number((economy.realGdpBillion2000Usd * spendingShare / 100).toFixed(2)),
    activePersonnelThousands: Number((economy.populationMillions * personnelShare * 10).toFixed(0)),
    posture,
    capabilities,
    modelingLevel: 'aggregate',
  };
}

export function securityActorsForCountry(_state: WorldState, countryId: CountryId): SecurityActorReference[] {
  return securityActorReference2000[countryId] ?? [];
}

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
  securityActors: SecurityActorReference[];
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
    defense: defenseReferenceForCountry(state, countryId),
    securityActors: securityActorsForCountry(state, countryId),
    relation: relation ? { value: relation.relation, trust: relation.trust } : undefined,
    topGoal: country.strategy.goals.slice().sort((a, b) => b.priority - a.priority)[0]?.label,
    vulnerabilities: country.strategy.vulnerabilities,
  };
}
