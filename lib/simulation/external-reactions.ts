import type {
  ConflictEscalationStage,
  CountryId,
  ExternalConflictReaction,
  WorldEffect,
  WorldState,
} from './types';

/**
 * Voisinages géopolitiques utiles à une crise. Ce n'est volontairement pas
 * une carte exhaustive des frontières : une réaction extérieure peut découler
 * d'une proximité maritime, régionale ou sécuritaire. Le reste est trouvé par
 * les relations, le commerce et les partenaires stratégiques du moteur.
 */
const regionalNeighbours: Record<string, readonly CountryId[]> = {
  FRA: ['GBR', 'DEU', 'ESP', 'ITA', 'BEL'],
  DZA: ['MAR', 'TUN', 'LBY', 'MLI', 'NER', 'MRT'],
  SUR: ['GUY', 'BRA'],
  GUY: ['SUR', 'BRA', 'VEN'],
  GRC: ['TUR', 'CYP', 'ITA', 'EGY', 'ISR'],
  TUR: ['GRC', 'BGR', 'GEO', 'RUS', 'IRN', 'IRQ', 'SYR'],
  UKR: ['POL', 'RUS', 'BLR', 'ROU', 'TUR'],
  RUS: ['UKR', 'POL', 'GEO', 'TUR', 'CHN', 'KAZ'],
  CHN: ['RUS', 'IND', 'PAK', 'VNM', 'JPN', 'KOR', 'TWN'],
  IND: ['PAK', 'CHN', 'BGD', 'LKA', 'NPL'],
  PAK: ['IND', 'CHN', 'AFG', 'IRN'],
  IRN: ['IRQ', 'TUR', 'PAK', 'SAU', 'RUS'],
  IRQ: ['IRN', 'TUR', 'SAU', 'SYR', 'JOR', 'KWT'],
  ISR: ['PSE', 'JOR', 'EGY', 'LBN', 'SYR'],
  EGY: ['ISR', 'LBY', 'SDN', 'SAU'],
  SAU: ['IRQ', 'IRN', 'YEM', 'EGY', 'ARE'],
  USA: ['CAN', 'MEX', 'CUB'],
  BRA: ['ARG', 'BOL', 'PRY', 'URY', 'VEN', 'GUY', 'SUR'],
  VEN: ['COL', 'BRA', 'GUY'],
  KOR: ['PRK', 'JPN', 'CHN', 'USA'],
  PRK: ['KOR', 'CHN', 'RUS', 'JPN'],
  JPN: ['KOR', 'PRK', 'CHN', 'RUS'],
  VNM: ['CHN', 'LAO', 'KHM', 'IDN'],
  NGA: ['BEN', 'NER', 'TCD', 'CMR'],
  ZAF: ['NAM', 'BWA', 'ZWE', 'MOZ'],
};

const americanIds = new Set(['USA', 'CAN', 'MEX', 'BRA', 'ARG', 'CHL', 'COL', 'PER', 'VEN', 'BOL', 'PRY', 'URY', 'ECU', 'GUY', 'SUR', 'CUB', 'HTI', 'JAM']);
const africanIds = new Set(['DZA', 'MAR', 'TUN', 'LBY', 'EGY', 'MLI', 'NER', 'NGA', 'ZAF', 'ETH', 'SDN', 'SOM', 'KEN', 'GHA', 'SEN', 'CMR', 'COD', 'COG', 'TCD', 'MRT']);
const europeanIds = new Set(['FRA', 'DEU', 'ITA', 'ESP', 'GBR', 'POL', 'GRC', 'TUR', 'UKR', 'RUS', 'NOR', 'AUT', 'NLD', 'BEL', 'ROU', 'BGR', 'CYP', 'GEO']);

function relationScore(state: WorldState, observerId: CountryId, countryId: CountryId) {
  const direct = state.relations[`${observerId}:${countryId}`] ?? state.relations[`${countryId}:${observerId}`];
  if (!direct) return 0;
  return direct.securityAlignment * 0.75 + direct.tradeIntensity * 0.45 + direct.relation * 0.12;
}

/** Classement lent et lisible : il ne s'agit pas d'une vérité géopolitique,
 * mais du poids susceptible de faire compter une prise de position mondiale. */
export function rankDiplomaticPowers(state: WorldState) {
  const countries = Object.values(state.countries);
  const maximums = {
    gdp: Math.max(1, ...countries.map((country) => state.macroEconomies?.[country.id]?.realGdpBillion2000Usd ?? 0)),
    weight: Math.max(1, ...countries.map((country) => country.weight)),
    defense: Math.max(1, ...countries.map((country) => country.capacities.defense.maximum)),
    diplomacy: Math.max(1, ...countries.map((country) => country.capacities.diplomacy.maximum)),
    trade: Math.max(1, ...countries.map((country) => Object.values(state.tradeFlows ?? {}).filter((flow) => flow.exporterId === country.id || flow.importerId === country.id).reduce((sum, flow) => sum + flow.annualValueBillion2000Usd, 0))),
  };
  return countries
    .map((country) => {
      const macro = state.macroEconomies?.[country.id];
      const trade = Object.values(state.tradeFlows ?? {}).filter((flow) => flow.exporterId === country.id || flow.importerId === country.id).reduce((sum, flow) => sum + flow.annualValueBillion2000Usd, 0);
      const score = 100 * (
        0.34 * ((macro?.realGdpBillion2000Usd ?? 0) / maximums.gdp)
        + 0.22 * (country.weight / maximums.weight)
        + 0.16 * (country.capacities.defense.maximum / maximums.defense)
        + 0.16 * (country.capacities.diplomacy.maximum / maximums.diplomacy)
        + 0.12 * (trade / maximums.trade)
      );
      return { countryId: country.id, score: Number(score.toFixed(1)) };
    })
    .sort((a, b) => b.score - a.score || a.countryId.localeCompare(b.countryId))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function organizationFor(actorId: CountryId, targetId: CountryId, stage: ConflictEscalationStage) {
  const parties = [actorId, targetId];
  if (stage === 'war') return { id: 'ONU', label: 'Nations unies', relevance: 'Une guerre ouverte relève immédiatement de la sécurité collective.' };
  if (parties.some((id) => americanIds.has(id))) return { id: 'OEA', label: 'Organisation des États américains', relevance: 'La crise touche directement l’espace interaméricain.' };
  if (parties.some((id) => africanIds.has(id))) return { id: 'UA', label: 'Union africaine', relevance: 'La crise affecte la sécurité et la souveraineté d’un État africain.' };
  if (parties.some((id) => europeanIds.has(id))) return { id: 'OTAN', label: 'OTAN', relevance: 'La crise touche l’environnement de sécurité euro-atlantique.' };
  return { id: 'ONU', label: 'Nations unies', relevance: 'La situation est suivie dans le cadre multilatéral.' };
}

function postureFor(state: WorldState, observerId: CountryId, actorId: CountryId, targetId: CountryId, stage: ConflictEscalationStage): ExternalConflictReaction['posture'] {
  if (stage === 'military_preparation') return observerId === 'USA' ? 'private_warning' : 'observation';
  const towardTarget = relationScore(state, observerId, targetId);
  const towardActor = relationScore(state, observerId, actorId);
  if (towardTarget - towardActor > 22) return 'condemnation';
  if (towardTarget - towardActor > 5) return 'public_warning';
  if (stage === 'war') return 'public_warning';
  return 'observation';
}

function summaryFor(observerName: string, actorName: string, targetName: string, posture: ExternalConflictReaction['posture'], stage: ConflictEscalationStage) {
  const situation = stage === 'war' ? `l’ouverture des hostilités entre ${actorName} et ${targetName}` : `la préparation militaire de ${actorName} contre ${targetName}`;
  if (posture === 'condemnation') return `${observerName} condamne ${situation} et demande le retrait des mesures offensives.`;
  if (posture === 'public_warning') return `${observerName} demande publiquement d’éviter ${situation} et avertit que la crise aura un coût diplomatique.`;
  if (posture === 'private_warning') return `${observerName} transmet à ${actorName} un avertissement diplomatique discret au sujet de ${situation}.`;
  if (posture === 'mediation') return `${observerName} propose un canal de consultation afin d’éviter ${situation}.`;
  return `${observerName} signale qu’il suit ${situation}, sans prendre encore d’engagement public.`;
}

function reactionEffect(reaction: ExternalConflictReaction, actorId: CountryId): WorldEffect | null {
  if (!['public_warning', 'condemnation'].includes(reaction.posture) || reaction.role === 'organization') return null;
  const severity = reaction.posture === 'condemnation' ? -8 : -4;
  return { kind: 'relation_delta', from: reaction.actorId as CountryId, to: actorId, relation: severity, trust: severity * 0.7, reason: `${reaction.actorLabel} réagit publiquement à l’escalade militaire.`, visibility: 'player' };
}

export type ExternalReactionSelection = {
  reactions: ExternalConflictReaction[];
  ranking: Array<{ countryId: CountryId; rank: number; score: number }>;
  effects: WorldEffect[];
};

/**
 * Sélectionne un petit observatoire de crise : puissance dominante, seconde
 * puissance du classement, un ou deux acteurs régionaux et une institution.
 * Les réactions sont des avertissements ou des prises de position ; aucune ne
 * transforme mécaniquement ces acteurs en belligérants.
 */
export function selectExternalConflictReactions(
  state: WorldState,
  input: { actorId: CountryId; targetId: CountryId; stage: ConflictEscalationStage; previous?: ExternalConflictReaction[] },
): ExternalReactionSelection {
  const { actorId, targetId, stage } = input;
  const actor = state.countries[actorId];
  const target = state.countries[targetId];
  if (!actor || !target) return { reactions: input.previous ?? [], ranking: [], effects: [] };
  const ranking = rankDiplomaticPowers(state);
  const selected: ExternalConflictReaction[] = [];
  const used = new Set<CountryId>([actorId, targetId]);
  const addCountry = (countryId: CountryId, role: ExternalConflictReaction['role'], relevance: string) => {
    const observer = state.countries[countryId];
    if (!observer || used.has(countryId)) return;
    used.add(countryId);
    const posture = postureFor(state, countryId, actorId, targetId, stage);
    selected.push({ actorId: countryId, actorLabel: observer.name, role, posture, relevance, date: state.currentDate, summary: summaryFor(observer.name, actor.name, target.name, posture, stage) });
  };

  // Les États-Unis restent une voix de référence en 2000 : ils sont appelés
  // dans toute crise militaire internationale, sauf lorsqu'ils en sont partie.
  addCountry('USA', 'leading_power', 'Puissance dominante du classement diplomatique mondial.');
  const second = ranking.find((item) => item.rank === 2)?.countryId;
  if (second) addCountry(second, 'ranked_power', 'Deuxième puissance selon le classement mondial courant.');

  const regionalPool = new Set<CountryId>([
    ...(regionalNeighbours[actorId] ?? []),
    ...(regionalNeighbours[targetId] ?? []),
    ...actor.strategy.partners,
    ...target.strategy.partners,
  ]);
  const regional = [...regionalPool]
    .filter((id) => !used.has(id) && Boolean(state.countries[id]))
    .map((id) => ({ id, score: (regionalNeighbours[actorId]?.includes(id) || regionalNeighbours[targetId]?.includes(id) ? 72 : 35) + relationScore(state, id, actorId) + relationScore(state, id, targetId) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, stage === 'war' ? 2 : 1);
  for (const item of regional) addCountry(item.id, 'regional_actor', 'Voisin, partenaire régional ou acteur directement exposé à la crise.');

  const organization = organizationFor(actorId, targetId, stage);
  const organizationPosture: ExternalConflictReaction['posture'] = stage === 'war' ? 'public_warning' : 'mediation';
  selected.push({
    actorId: organization.id,
    actorLabel: organization.label,
    role: 'organization',
    posture: organizationPosture,
    relevance: organization.relevance,
    date: state.currentDate,
    summary: stage === 'war'
      ? `${organization.label} appelle à la cessation des hostilités et à une consultation formelle.`
      : `${organization.label} propose des consultations et appelle les parties à éviter le franchissement d’un seuil militaire.`,
  });

  // Une montée de stade met à jour la position de chaque acteur plutôt que de
  // répéter indéfiniment les mêmes messages dans la fiche du dossier.
  const prior = new Map((input.previous ?? []).map((reaction) => [reaction.actorId, reaction]));
  const reactions = [...prior.values()];
  for (const reaction of selected) {
    const index = reactions.findIndex((item) => item.actorId === reaction.actorId);
    if (index >= 0) reactions[index] = reaction;
    else reactions.push(reaction);
  }
  return { reactions, ranking: ranking.slice(0, 5), effects: selected.map((reaction) => reactionEffect(reaction, actorId)).filter((effect): effect is WorldEffect => Boolean(effect)) };
}
