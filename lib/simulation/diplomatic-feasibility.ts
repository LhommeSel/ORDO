import type { AIGenericDiplomaticMove } from '../ai/job-contracts';
import type { CountryId, CountryState, WorldState } from './types';
import { evaluateHistoricalChronology } from './historical-chronology';
import { diplomaticProfileFor, diplomaticProfileStatement, type DiplomaticProfile } from './diplomatic-profiles';

/**
 * Garde-fous diplomatiques déterministes.
 *
 * Les lignes rouges ne sont pas une liste exhaustive écrite à la main pour
 * chaque pays : un profil générique couvre la majorité des États, puis les
 * puissances qui structurent une partie reçoivent quelques exceptions. Les
 * déclencheurs liés à la date et à l'état du monde restent calculés ici, afin
 * que le modèle ne puisse pas accepter un événement qui n'existe pas encore.
 */
export type RedLineStrength = 'hard' | 'strong' | 'soft';

export type DiplomaticRedLineRule = {
  id: string;
  label: string;
  strength: RedLineStrength;
  keywords: string[];
  rationale: string;
};

export type DiplomaticFeasibilityIssue = {
  id: string;
  severity: 'hard' | 'counter';
  label: string;
  explanation: string;
  requiredResponse: string;
};

export type DiplomaticIssueDomain = 'territorial_security' | 'energy_resources' | 'trade_industry' | 'alliance_alignment' | 'general';
export type DiplomaticPowerPosture = 'overwhelming_advantage' | 'advantage' | 'parity' | 'disadvantage' | 'overwhelming_disadvantage';

export type DiplomaticPowerBalance = {
  domain: DiplomaticIssueDomain;
  actorScore: number;
  strongestCounterpartScore: number;
  ratio: number;
  posture: DiplomaticPowerPosture;
  /** Décomposition interne : elle explique le résultat sans prétendre à une mesure scientifique. */
  components: {
    material: number;
    localReach: number;
    economicLeverage: number;
    allianceBacking: number;
    legalInstitutional: number;
    resolve: number;
  };
  drivers: string[];
  minimumExpectedOutcome: string[];
};

export type DiplomaticFeasibility = {
  actorId: CountryId;
  participantIds: CountryId[];
  archetype: string;
  rules: DiplomaticRedLineRule[];
  matchedRules: DiplomaticRedLineRule[];
  issues: DiplomaticFeasibilityIssue[];
  blockingIssues: DiplomaticFeasibilityIssue[];
  counterIssues: DiplomaticFeasibilityIssue[];
  /** Lecture interne du rapport de force : elle guide le ton, pas une décision automatique. */
  powerBalance: DiplomaticPowerBalance;
  actorProfile: DiplomaticProfile;
  responseGuidance: string;
  instruction: string;
};

export type ConstrainedDiplomaticMove = {
  move: AIGenericDiplomaticMove;
  publicMessage: string;
  feasibility: DiplomaticFeasibility;
  overridden: boolean;
};

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const unique = <T,>(items: T[]) => [...new Set(items)];

const compact = (value: string, maximum: number) => value.replace(/\s+/g, ' ').trim().slice(0, maximum);

const keywords = (...values: string[]) => values.map(normalize);

const GENERIC_RULES: Record<string, DiplomaticRedLineRule[]> = {
  sovereignty: [{
    id: 'generic-sovereignty',
    label: 'Atteinte à la souveraineté ou à l’intégrité territoriale',
    strength: 'hard',
    keywords: keywords('cession territoriale', 'partition territoriale', 'occupation', 'tutelle étrangère', 'changement de régime imposé', 'renversement du gouvernement'),
    rationale: 'Même un État faible protège en priorité son territoire et son autorité politique.',
  }],
  authoritarian: [{
    id: 'generic-regime-security',
    label: 'Ingérence directe dans le régime ou la succession politique',
    strength: 'hard',
    keywords: keywords('changement de régime', 'opposition au gouvernement', 'ingérence politique', 'condition de démocratisation', 'renversement du régime'),
    rationale: 'Un appareil autoritaire peut négocier des avantages, mais pas sa propre remise en cause.',
  }],
  major: [{
    id: 'generic-strategic-encirclement',
    label: 'Encerclement stratégique par une coalition hostile',
    strength: 'strong',
    keywords: keywords('coalition contre', 'encerclement', 'containment', 'endiguement', 'alliance hostile', 'base militaire étrangère à sa frontière'),
    rationale: 'Une grande puissance tolère une coopération ponctuelle, pas une architecture explicitement conçue pour la contenir.',
  }],
  security: [{
    id: 'generic-security-dependence',
    label: 'Dépendance sécuritaire sans réciprocité ni contrôle national',
    strength: 'strong',
    keywords: keywords('protectorat', 'commandement étranger', 'troupes étrangères sans mandat', 'dépendance militaire'),
    rationale: 'La coopération militaire doit préserver une marge de décision nationale.',
  }],
  small: [{
    id: 'generic-small-state-guarantees',
    label: 'Absence de garanties pour la sécurité et la continuité économique',
    strength: 'strong',
    keywords: keywords('désarmement unilatéral', 'abandon de garantie', 'blocus', 'sanctions sans compensation'),
    rationale: 'Un petit État exige généralement des garanties vérifiables avant de s’exposer.',
  }],
};

const OVERRIDES: Record<CountryId, DiplomaticRedLineRule[]> = {
  RUS: [
    { id: 'rus-post-soviet-space', label: 'Extension de l’OTAN ou dispositif de containment dans l’espace postsoviétique', strength: 'hard', keywords: keywords('extension de l’otan', 'élargissement de l’otan', 'expansion de l’otan', 'nato expansion', 'base otan', 'encerclement de la russie'), rationale: 'La profondeur stratégique postsoviétique est une priorité de sécurité russe.' },
    { id: 'rus-regime-sovereignty', label: 'Changement de régime imposé ou tutelle extérieure', strength: 'hard', keywords: keywords('changement de régime en russie', 'renversement de moscou', 'tutelle occidentale'), rationale: 'La direction russe protège la continuité du régime.' },
    { id: 'rus-ceasefire-conditions', label: 'Cessez-le-feu non vérifiable ni assorti de garanties', strength: 'strong', keywords: keywords('cessez-le-feu', 'cessez le feu', 'armistice', 'trêve'), rationale: 'Un arrêt des combats est négociable seulement avec des garanties, une vérification et des conditions de sécurité.' },
  ],
  CHN: [
    { id: 'chn-taiwan-sovereignty', label: 'Indépendance de Taïwan ou remise en cause de l’unité territoriale', strength: 'hard', keywords: keywords('indépendance de taïwan', 'independance de taiwan', 'taïwan indépendant', 'séparation de taïwan'), rationale: 'L’unité territoriale est une ligne politique centrale de Pékin.' },
    { id: 'chn-anti-coalition', label: 'Coalition stratégique de containment dirigée contre la Chine', strength: 'hard', keywords: keywords('coalition anti-chinoise', 'coalition anti chine', 'containment de la chine', 'contenir la chine', 'contre la chine', 'encerclement de la chine', 'alliance militaire contre la chine'), rationale: 'Pékin peut coopérer ponctuellement, mais refuse une architecture de containment explicite.' },
    { id: 'chn-external-regime', label: 'Condition politique extérieure imposée au Parti', strength: 'hard', keywords: keywords('démocratisation imposée', 'condition de changement politique en chine'), rationale: 'La souveraineté du modèle politique est non négociable.' },
  ],
  USA: [
    { id: 'usa-nato-credibility', label: 'Abandon ou remise en cause unilatérale de l’OTAN', strength: 'hard', keywords: keywords('abandon de l’otan', 'sortie de l’otan', 'remise en cause de l’otan'), rationale: 'La crédibilité des garanties américaines repose sur leurs engagements d’alliance.' },
    { id: 'usa-territory', label: 'Attaque du territoire national ou menace existentielle', strength: 'hard', keywords: keywords('attaque du territoire américain', 'attaque du territoire national', 'destruction des États-unis'), rationale: 'La protection du territoire prime sur toute concession diplomatique.' },
  ],
  FRA: [
    { id: 'fra-nuclear-autonomy', label: 'Perte d’autonomie nucléaire et stratégique', strength: 'hard', keywords: keywords('perte d’autonomie nucléaire', 'abandon de la dissuasion', 'force de frappe sous contrôle étranger'), rationale: 'La France protège sa capacité de décision stratégique indépendante.' },
    { id: 'fra-european-marginalization', label: 'Marginalisation durable de la France en Europe', strength: 'strong', keywords: keywords('marginalisation européenne', 'exclusion de la décision européenne'), rationale: 'La direction française cherche à conserver un rôle moteur en Europe.' },
  ],
  DEU: [
    { id: 'deu-debt-mutualization', label: 'Mutualisation durable des dettes sans discipline commune', strength: 'hard', keywords: keywords('mutualisation durable des dettes', 'union de transfert permanent', 'dette commune sans discipline'), rationale: 'La culture de stabilité allemande borne les transferts budgétaires permanents.' },
  ],
  GBR: [
    { id: 'gbr-sovereignty', label: 'Abandon non réciproque de la souveraineté de décision', strength: 'strong', keywords: keywords('tutelle européenne', 'perte de souveraineté britannique', 'commandement étranger permanent'), rationale: 'Le gouvernement britannique conserve une forte préférence pour la liberté d’action nationale.' },
  ],
  IND: [
    { id: 'ind-kashmir', label: 'Remise en cause imposée du Cachemire ou de l’intégrité territoriale', strength: 'hard', keywords: keywords('remise en cause du cachemire', 'cession du cachemire', 'partition de l’inde'), rationale: 'L’intégrité territoriale et l’autonomie stratégique sont prioritaires.' },
    { id: 'ind-strategic-autonomy', label: 'Contrainte extérieure sur la dissuasion nucléaire', strength: 'hard', keywords: keywords('contrainte extérieure sur la dissuasion nucléaire', 'désarmement nucléaire imposé'), rationale: 'New Delhi refuse une dépendance stratégique imposée.' },
  ],
  TUR: [
    { id: 'tur-territorial-partition', label: 'Partition territoriale de la Turquie', strength: 'hard', keywords: keywords('partition territoriale', 'cession de territoire turc', 'démembrement de la turquie'), rationale: 'La continuité territoriale est une ligne rouge existentielle.' },
  ],
  JPN: [
    { id: 'jpn-defense-autonomy', label: 'Abandon des garanties de sécurité ou réarmement imposé', strength: 'strong', keywords: keywords('abandon de la garantie américaine', 'réarmement imposé', 'désarmement unilatéral du japon'), rationale: 'Tokyo dépend d’alliances de sécurité crédibles, sans accepter une contrainte unilatérale.' },
  ],
};

function archetypeFor(country: CountryState) {
  const regime = normalize(country.politics.regime);
  if (/parti unique|republique populaire|communiste|revolutionnaire|junte|autoritaire|theocr|emirat|sultanat|monarchie absolue/.test(regime)) return 'authoritarian';
  if (country.weight >= 75) return 'major';
  if (country.politics.doctrine.sovereignty >= 70 || country.politics.doctrine.security >= 75) return 'security';
  if (country.weight <= 30) return 'small';
  return 'pluralist';
}

function strategyRule(country: CountryState, line: string, index: number): DiplomaticRedLineRule {
  const normalized = normalize(line);
  const strength: RedLineStrength = /nucle|territor|regime|partition|otan|dissuasion|cachemire|taiwan|dette/.test(normalized) ? 'hard' : 'strong';
  const derivedKeywords = normalized.split(/[^a-z0-9]+/).filter((word) => word.length >= 5);
  return {
    id: `strategy-${country.id}-${index}`,
    label: line,
    strength,
    keywords: unique([normalized, ...derivedKeywords]),
    rationale: 'Ligne rouge reprise de la stratégie persistée du pays.',
  };
}

function staticRulesFor(country: CountryState): { archetype: string; rules: DiplomaticRedLineRule[] } {
  const archetype = archetypeFor(country);
  const rules = [
    ...GENERIC_RULES.sovereignty,
    ...(GENERIC_RULES[archetype] ?? []),
    ...(country.weight >= 75 ? GENERIC_RULES.major : []),
    ...(country.politics.doctrine.security >= 65 ? GENERIC_RULES.security : []),
    ...(country.weight <= 30 ? GENERIC_RULES.small : []),
    ...(OVERRIDES[country.id] ?? []),
    ...country.strategy.redLines.map((line, index) => strategyRule(country, line, index)),
  ];
  const deduped = [...new Map(rules.map((rule) => [rule.id, rule])).values()];
  return { archetype, rules: deduped };
}

function pairKey(a: CountryId, b: CountryId) {
  return [a, b].sort().join(':');
}

function activeConflictPairs(state: WorldState) {
  const pairs = new Set<string>();
  for (const zone of Object.values(state.warZones ?? {})) {
    if (zone.status !== 'active' || zone.countryIds.length < 2) continue;
    for (let index = 0; index < zone.countryIds.length; index += 1) {
      for (let other = index + 1; other < zone.countryIds.length; other += 1) pairs.add(pairKey(zone.countryIds[index], zone.countryIds[other]));
    }
  }
  // Les dossiers de conflit sont également une source de vérité lorsque la
  // zone de guerre n'a pas encore été matérialisée par le moteur.
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    if (dossier.kind !== 'conflict' || dossier.status === 'resolved' || dossier.actorIds.length < 2) continue;
    const actors = dossier.actorIds.filter((id): id is CountryId => Boolean(state.countries[id]));
    for (let index = 0; index < actors.length; index += 1) {
      for (let other = index + 1; other < actors.length; other += 1) pairs.add(pairKey(actors[index], actors[other]));
    }
  }
  return pairs;
}

/**
 * Les lignes rouges ne doivent pas se déclencher lorsqu'un joueur les cite
 * pour les respecter (« ne pas étendre l'OTAN », « prévenir une occupation »).
 * Cette petite fenêtre de négation ne remplace pas le raisonnement IA, elle
 * évite seulement les faux positifs les plus fréquents du moteur local.
 */
function activeTerm(text: string, term: string) {
  const normalizedTerm = normalize(term);
  let from = text.indexOf(normalizedTerm);
  while (from >= 0) {
    const prefix = text.slice(Math.max(0, from - 72), from);
    if (!/(?:ne\s+pas|ne\s+plus|sans|refus(?:er|e|ons)?|eviter|prevenir|respect(?:er|e|ons)?|garant(?:ir|ie)|contre|aucun|aucune)(?:\s+[a-z0-9]+){0,5}\s*$/.test(prefix)) return true;
    from = text.indexOf(normalizedTerm, from + normalizedTerm.length);
  }
  return false;
}

const containsAny = (text: string, terms: string[]) => terms.some((term) => activeTerm(text, term));

/**
 * Une exigence d'accès aux ressources reste une posture coercitive tant que
 * le joueur ne l'a pas explicitement retirée. Cette détection est partagée
 * avec le suivi des dialogues afin qu'une simple demande de « révision » ne
 * fasse pas disparaître l'ultimatum de la mémoire diplomatique.
 */
export function isCoerciveResourceDemand(value: string) {
  const text = normalize(value);
  return containsAny(text, ['exige', 'exigeons', 'exiger', 'impose', 'imposons', 'donnez', 'cedez', 'cede'])
    && containsAny(text, ['ressource', 'hydrocarbure', 'petrole', 'gaz', 'minerai', 'gisement', 'matiere premiere']);
}

/** Détecte les injonctions impériales qui ne portent pas uniquement sur l'énergie. */
export function isCoerciveSovereigntyDemand(value: string) {
  const text = normalize(value);
  return containsAny(text, ['exige', 'exigeons', 'exiger', 'impose', 'imposons', 'ultimatum', 'ordonne', 'ordonner'])
    && containsAny(text, ['territoire', 'port', 'base militaire', 'gouvernement', 'institution', 'controle', 'acces', 'souverainete', 'ressource']);
}

/** Seule une rétractation explicite met fin à l'exigence mémorisée. */
export function explicitlyWithdrawsResourceDemand(value: string) {
  const text = normalize(value);
  return /(?:retir|abandonn|renonc)[a-z]*.{0,60}(?:exigence|demande|ultimatum|acces|exploitation|ressource)/.test(text)
    || /(?:n exigeons|ne demandons|ne revendiquons)[a-z ]{0,30}plus/.test(text);
}

/** Rejoue la posture dans l'ordre : une rétractation peut fermer puis une nouvelle exigence rouvrir le bras de fer. */
export function resourceDemandStillActive(messages: readonly string[]) {
  let active = false;
  for (const message of messages) {
    if (explicitlyWithdrawsResourceDemand(message)) active = false;
    else if (isCoerciveResourceDemand(message)) active = true;
  }
  return active;
}

function issue(id: string, severity: DiplomaticFeasibilityIssue['severity'], label: string, explanation: string, requiredResponse: string): DiplomaticFeasibilityIssue {
  return { id, severity, label, explanation, requiredResponse };
}

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

function issueDomainFor(textValue: string): DiplomaticIssueDomain {
  const text = normalize(textValue);
  if (/(territoir|frontier|mer egee|maritim|zone disput|base militaire|troupe|deploiement|cessez le feu|armistice|securite)/.test(text)) return 'territorial_security';
  if (/(gaz|petrol|hydrocarb|energie|ressource|minier|pipeline|terminal)/.test(text)) return 'energy_resources';
  if (/(commerce|commercial|industrie|investissement|tarif|export|import|technolog|contrat)/.test(text)) return 'trade_industry';
  if (/(otan|alliance|alignement|bloc|coalition|garantie strategique|neutralit)/.test(text)) return 'alliance_alignment';
  return 'general';
}

function relationValue(state: WorldState, from: CountryId, to: CountryId) {
  return state.relations[`${from}:${to}`] ?? state.relations[`${to}:${from}`];
}

function powerComponentsFor(state: WorldState, countryId: CountryId, counterparts: CountryId[]) {
  const country = state.countries[countryId];
  if (!country) return { material: 0, localReach: 0, economicLeverage: 0, allianceBacking: 0, legalInstitutional: 0, resolve: 0 };
  const profile = diplomaticProfileFor(state, countryId);
  const counterpartSet = new Set(counterparts);
  const directRivalry = country.strategy.rivals.some((id) => counterpartSet.has(id))
    || counterparts.some((id) => state.countries[id]?.strategy.rivals.includes(countryId));
  const partnerWeight = country.strategy.partners
    .map((id) => state.countries[id]?.weight ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((total, weight) => total + weight, 0);
  const strongestDirectAlignment = Math.max(0, ...counterparts.map((id) => relationValue(state, countryId, id)?.securityAlignment ?? 0));
  return {
    material: clampScore(country.weight * 0.58 + country.metrics.security * 0.42),
    localReach: clampScore(38 + country.politics.doctrine.security * 0.32 + country.politics.doctrine.sovereignty * 0.18 + (directRivalry ? 12 : 0)),
    economicLeverage: clampScore(country.metrics.industry * 0.52 + Math.min(100, country.fiscal.discretionaryMargin) * 0.34 + country.capacities.economy.maximum * 0.14),
    allianceBacking: clampScore(18 + country.strategy.partners.length * 6 + partnerWeight * 0.13 + strongestDirectAlignment * 0.08),
    legalInstitutional: clampScore(country.capacities.diplomacy.maximum * 0.55 + country.capacities.administration.maximum * 0.25 + (100 - country.politics.doctrine.security) * 0.2),
    resolve: clampScore(profile.riskTolerance * 0.26 + profile.statusSensitivity * 0.32 + country.politics.doctrine.sovereignty * 0.28 + country.politics.doctrine.security * 0.14),
  };
}

const DOMAIN_WEIGHTS: Record<DiplomaticIssueDomain, Record<keyof DiplomaticPowerBalance['components'], number>> = {
  territorial_security: { material: 0.31, localReach: 0.23, economicLeverage: 0.06, allianceBacking: 0.15, legalInstitutional: 0.08, resolve: 0.17 },
  energy_resources: { material: 0.12, localReach: 0.15, economicLeverage: 0.29, allianceBacking: 0.12, legalInstitutional: 0.14, resolve: 0.18 },
  trade_industry: { material: 0.05, localReach: 0.08, economicLeverage: 0.42, allianceBacking: 0.12, legalInstitutional: 0.21, resolve: 0.12 },
  alliance_alignment: { material: 0.19, localReach: 0.12, economicLeverage: 0.1, allianceBacking: 0.29, legalInstitutional: 0.1, resolve: 0.2 },
  general: { material: 0.18, localReach: 0.15, economicLeverage: 0.2, allianceBacking: 0.16, legalInstitutional: 0.14, resolve: 0.17 },
};

const COMPONENT_LABELS: Record<keyof DiplomaticPowerBalance['components'], string> = {
  material: 'moyens matériels et militaires',
  localReach: 'capacité d’action locale',
  economicLeverage: 'leviers économiques',
  allianceBacking: 'appuis extérieurs',
  legalInstitutional: 'leviers juridiques et institutionnels',
  resolve: 'détermination politique',
};

function weightedPowerScore(components: DiplomaticPowerBalance['components'], domain: DiplomaticIssueDomain) {
  const weights = DOMAIN_WEIGHTS[domain];
  return Object.entries(weights).reduce((total, [key, weight]) => total + components[key as keyof typeof components] * weight, 0);
}

export function diplomaticPowerBalanceFor(state: WorldState, actorId: CountryId, participantIds: CountryId[], proposalText: string): DiplomaticPowerBalance {
  const domain = issueDomainFor(proposalText);
  const safeParticipants = unique(participantIds.filter((id) => id !== actorId && Boolean(state.countries[id])));
  const actorComponents = powerComponentsFor(state, actorId, safeParticipants);
  const actorScore = weightedPowerScore(actorComponents, domain);
  const counterpartResults = safeParticipants.map((id) => {
    const components = powerComponentsFor(state, id, [actorId]);
    return { id, components, score: weightedPowerScore(components, domain) };
  });
  const strongest = counterpartResults.sort((a, b) => b.score - a.score)[0];
  const counterpartScore = strongest?.score ?? (actorScore > 0 ? actorScore / 2 : 1);
  const ratio = counterpartScore > 0 ? actorScore / counterpartScore : 2;
  const posture: DiplomaticPowerPosture = ratio >= 1.45 ? 'overwhelming_advantage'
    : ratio >= 1.12 ? 'advantage'
      : ratio <= 0.69 ? 'overwhelming_disadvantage'
        : ratio <= 0.89 ? 'disadvantage'
          : 'parity';
  const componentDifferences = (Object.keys(actorComponents) as Array<keyof typeof actorComponents>)
    .map((key) => ({ key, difference: actorComponents[key] - (strongest?.components[key] ?? 0) }))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  const drivers = componentDifferences.slice(0, 3).map(({ key, difference }) =>
    `${COMPONENT_LABELS[key]} ${difference >= 8 ? 'favorables' : difference <= -8 ? 'défavorables' : 'comparables'}`,
  );
  const profile = diplomaticProfileFor(state, actorId);
  const leadingInterest = profile.publicInterests[0] ?? 'un bénéfice national vérifiable';
  const minimumExpectedOutcome = posture === 'overwhelming_advantage' || posture === 'advantage'
    ? [`Un gain tangible sur « ${leadingInterest} »`, 'Aucune concession unilatérale ou atteinte au statut', 'Reconnaissance du rôle de l’acteur dans l’exécution']
    : posture === 'parity'
      ? [`Une contrepartie vérifiable sur « ${leadingInterest} »`, 'Réciprocité explicite', 'Mécanisme de contrôle ou de révision']
      : [`Préservation des lignes rouges liées à « ${leadingInterest} »`, 'Garantie vérifiable contre le fait accompli', 'Compensation concrète pour toute concession substantielle'];
  return {
    domain,
    actorScore: Number(actorScore.toFixed(1)),
    strongestCounterpartScore: Number(counterpartScore.toFixed(1)),
    ratio: Number(ratio.toFixed(2)),
    posture,
    components: Object.fromEntries(Object.entries(actorComponents).map(([key, value]) => [key, Number(value.toFixed(1))])) as DiplomaticPowerBalance['components'],
    drivers,
    minimumExpectedOutcome,
  };
}

function guidanceFor(profile: DiplomaticProfile, power: DiplomaticPowerBalance, blocking: DiplomaticFeasibilityIssue[], counter: DiplomaticFeasibilityIssue[]) {
  const force = `Rapport de force ${power.domain} : ${power.posture.replaceAll('_', ' ')} ; causes principales : ${power.drivers.join(', ')}.`;
  if (blocking.length) {
    if (power.posture === 'advantage' || power.posture === 'overwhelming_advantage') return `${force} ${profile.negotiationStyle}: refuser clairement le point bloquant et signaler les conséquences diplomatiques proportionnées ; ne pas maquiller un refus en accord.`;
    if (power.posture === 'disadvantage' || power.posture === 'overwhelming_disadvantage') return `${force} ${profile.negotiationStyle}: défendre fermement la ligne rouge, demander des garanties vérifiables et conserver une porte de sortie sans capituler.`;
    return `${force} ${profile.negotiationStyle}: tenir la ligne rouge, puis proposer une alternative réciproque et concrète ; aucun engagement de fond automatique.`;
  }
  if (counter.length) return `${force} ${profile.negotiationStyle}: formuler une contre-proposition limitée, explicite sur les concessions et les conditions, sans transformer le principe en accord signé.`;
  return `${force} ${profile.negotiationStyle}: défendre les intérêts du pays ; rechercher un accord seulement s’il atteint au moins ${power.minimumExpectedOutcome.join(' ; ')}. Ne pas fabriquer un compromis pour le seul bénéfice de conclure.`;
}

/** Déduit la cohérence d'une proposition à la date exacte de la sauvegarde. */
export function deriveDiplomaticFeasibility(state: WorldState, actorId: CountryId, participantIds: CountryId[], proposalText: string): DiplomaticFeasibility {
  const actor = state.countries[actorId];
  const safeParticipants = unique(participantIds.filter((id) => id !== actorId && Boolean(state.countries[id])));
  if (!actor) {
    const unknownProfile = diplomaticProfileFor(state, actorId);
    const powerBalance = diplomaticPowerBalanceFor(state, actorId, safeParticipants, proposalText);
    return { actorId, participantIds: safeParticipants, archetype: 'unknown', rules: [], matchedRules: [], issues: [], blockingIssues: [], counterIssues: [], powerBalance, actorProfile: unknownProfile, responseGuidance: 'Posture inconnue : demander une clarification.', instruction: 'Aucun garde-fou pays n’est disponible : rester prudent et demander une clarification.' };
  }
  const { archetype, rules } = staticRulesFor(actor);
  const actorProfile = diplomaticProfileFor(state, actorId);
  const powerBalance = diplomaticPowerBalanceFor(state, actorId, safeParticipants, proposalText);
  const text = normalize(proposalText);
  const matchedRules = rules.filter((rule) => rule.keywords.some((keyword) => activeTerm(text, keyword)));
  const issues: DiplomaticFeasibilityIssue[] = matchedRules.map((rule) => issue(
    `red-line:${rule.id}`,
    rule.strength === 'hard' ? 'hard' : 'counter',
    rule.label,
    rule.rationale,
    `Ne pas accepter sans retirer ou circonscrire le terme « ${rule.label} ».`,
  ));
  // Une exigence explicite d'accès aux ressources souveraines n'est pas une
  // demande commerciale ordinaire. Le moteur la traite comme une atteinte
  // directe à la souveraineté afin qu'un modèle trop conciliant ne puisse pas
  // fabriquer un compromis dès le premier message.
  const coerciveResourceDemand = isCoerciveResourceDemand(proposalText);
  if (coerciveResourceDemand) {
    issues.push(issue(
      'red-line:generic-resource-coercion',
      'hard',
      'Exigence unilatérale d’accès aux ressources souveraines',
      'Les ressources naturelles relèvent de l’autorité de l’État concerné ; une injonction étrangère appelle un refus politique explicite avant toute discussion commerciale.',
      'Rejeter fermement l’exigence, défendre la souveraineté et n’envisager qu’une proposition commerciale librement négociée après retrait de l’ultimatum.',
    ));
  }
  const coerciveSovereigntyDemand = !coerciveResourceDemand && isCoerciveSovereigntyDemand(proposalText);
  if (coerciveSovereigntyDemand) {
    issues.push(issue(
      'red-line:generic-coercive-sovereignty',
      'hard',
      'Injonction impériale sur le territoire ou les institutions nationales',
      'Une demande formulée comme un ordre ou un ultimatum sur le territoire, les ports ou les institutions appelle une défense politique de la souveraineté avant toute négociation.',
      'Rejeter l’injonction, demander son retrait explicite et ne discuter qu’une coopération consentie et réciproque.',
    ));
  }
  const conflicts = activeConflictPairs(state);
  const ceasefire = containsAny(text, ['cessez-le-feu', 'cessez le feu', 'armistice', 'trêve', 'treve']);
  const hasConflictWithParticipant = safeParticipants.some((id) => conflicts.has(pairKey(actorId, id)));
  if (ceasefire && !hasConflictWithParticipant) {
    issues.push(issue('chronology.no-active-conflict', 'hard', 'Aucun conflit actif entre les parties à la date courante', 'Un cessez-le-feu suppose un affrontement en cours ; le moteur ne doit pas en fabriquer un.', 'Reformuler en canal préventif, médiation ou mécanisme de désescalade, sans parler de cessez-le-feu actuel.'));
  }
  const chronologyFindings = evaluateHistoricalChronology(state.currentDate, proposalText, [actorId, ...safeParticipants]);
  issues.push(...chronologyFindings.map((finding) => issue(finding.id, finding.severity, finding.label, finding.explanation, finding.requiredResponse)));
  const hasChina = actorId === 'CHN' || safeParticipants.includes('CHN');
  const hasUs = actorId === 'USA' || safeParticipants.includes('USA');
  const hasFrance = actorId === 'FRA' || safeParticipants.includes('FRA');
  const triCooperation = containsAny(text, ['triple coopération', 'cooperation trilaterale', 'coopération stratégique usa france chine', 'alliance stratégique usa france chine', 'coalition usa france chine'])
    || (containsAny(text, ['alliance', 'coopération', 'cooperation']) && containsAny(text, ['contenir', 'containment', 'contre', 'coalition']));
  if (hasChina && hasUs && hasFrance && triCooperation) {
    issues.push(issue('red-line:chn-trilateral-containment', 'hard', 'La coopération trilatérale ne doit pas devenir une alliance de containment contre la Chine', 'Une coopération technique ponctuelle est envisageable, mais une alliance stratégique USA–France–Chine doit préciser sa non-hostilité et sa réciprocité.', 'Refuser la clause d’alliance ou la transformer en coopération limitée, transparente et non militaire.'));
  }
  const foreignBase = containsAny(text, ['base militaire', 'troupes étrangères', 'stationnement permanent', 'force étrangère']);
  if (foreignBase && actor.politics.doctrine.sovereignty >= 65) {
    issues.push(issue('dynamic-foreign-base-sovereignty', 'counter', 'Présence militaire étrangère soumise à un mandat et à un contrôle national', 'La souveraineté est trop importante pour qu’une base ou une force étrangère soit acceptée sans durée, mandat et sortie clairement définis.', 'Exiger un mandat limité, une durée, un contrôle de l’État hôte et une clause de retrait.'));
  }
  const dedupedIssues = [...new Map(issues.map((item) => [item.id, item])).values()];
  const blockingIssues = dedupedIssues.filter((item) => item.severity === 'hard');
  const counterIssues = dedupedIssues.filter((item) => item.severity === 'counter');
  const responseGuidance = guidanceFor(actorProfile, powerBalance, blockingIssues, counterIssues);
  const names = safeParticipants.map((id) => state.countries[id]?.name ?? id).join(', ') || 'les interlocuteurs';
  const powerInstruction = `Puissance qualitative sur ce sujet : ${powerBalance.posture.replaceAll('_', ' ')}. Causes : ${powerBalance.drivers.join(' ; ')}. Minimum attendu par ${actor.name} : ${powerBalance.minimumExpectedOutcome.join(' ; ')}. Doctrine d’alignement : ${actorProfile.alignmentDoctrine}. Sensibilité au statut : ${actorProfile.statusSensitivity}/100. Budget de concessions : ${actorProfile.concessionBudget}/100.`;
  const instruction = dedupedIssues.length
    ? `Garde-fous obligatoires pour ${actor.name} face à ${names} : ${dedupedIssues.map((item) => `${item.severity === 'hard' ? 'BLOQUANT' : 'À CONTRE-PROPOSER'} — ${item.label}. ${item.requiredResponse}`).join(' ')} ${powerInstruction} Guidance de réponse : ${responseGuidance}`
    : `Aucune ligne rouge ne bloque explicitement la proposition pour ${actor.name}. Un accord n’est toutefois acceptable que s’il sert ses intérêts : l’absence de blocage ne vaut jamais consentement. ${powerInstruction} Guidance de réponse : ${responseGuidance}`;
  return { actorId, participantIds: safeParticipants, archetype, rules, matchedRules, issues: dedupedIssues, blockingIssues, counterIssues, powerBalance, actorProfile, responseGuidance, instruction };
}

export function diplomaticPostureStatement(state: WorldState, actorId: CountryId) {
  const actor = state.countries[actorId];
  if (!actor) return 'Aucune posture diplomatique structurée n’est disponible.';
  const { archetype, rules } = staticRulesFor(actor);
  const hard = rules.filter((rule) => rule.strength === 'hard').map((rule) => rule.label).slice(0, 8);
  const strong = rules.filter((rule) => rule.strength === 'strong').map((rule) => rule.label).slice(0, 5);
  return `${diplomaticProfileStatement(state, actorId)} ${actor.name} relève du profil ${archetype}. Lignes fermes : ${hard.join(' ; ') || 'aucune explicite'}. Points à négocier avec garanties : ${strong.join(' ; ') || 'aucun documenté'}. Les contraintes de date et de conflit sont recalculées pour chaque proposition.`;
}

const COSTLY_CONCESSION_PATTERN = /(ced|renonc|retir|abandon|moratoire|partage egal|50\s*%|reconnai.{0,30}(?:souverainete|revendication)|limitation unilateral|demilitaris)/;
const TANGIBLE_GAIN_PATTERN = /(garantie|verification|controle conjoint|reciproc|compensation|investissement|acces|reconnaissance|priorite|revenu|transfert|livraison|securite|programme industriel|cooperation industriel|machine outil|formation|competence|production locale)/;

/**
 * Apprécie le coût politique d'un compromis du point de vue d'un signataire.
 * Le score reste interne : il sert au veto moteur et aux réactions nationales,
 * jamais à afficher une prétendue mesure scientifique au joueur.
 */
export function diplomaticSettlementAssessment(
  state: WorldState,
  actorId: CountryId,
  participantIds: CountryId[],
  proposalText: string,
  concessions: string[],
  gains: string[],
) {
  const profile = diplomaticProfileFor(state, actorId);
  const powerBalance = diplomaticPowerBalanceFor(state, actorId, participantIds, proposalText);
  const normalizedConcessions = concessions.map(normalize).filter(Boolean);
  const normalizedGains = gains.map(normalize).filter(Boolean);
  const concessionLoad = normalizedConcessions.reduce((total, item) => total + (COSTLY_CONCESSION_PATTERN.test(item) ? 2 : 1), 0);
  const tangibleGainCount = normalizedGains.filter((item) => TANGIBLE_GAIN_PATTERN.test(item)).length;
  const rivals = participantIds.filter((id) => state.countries[actorId]?.strategy.rivals.includes(id) || state.countries[id]?.strategy.rivals.includes(actorId));
  const hasAdvantage = powerBalance.posture === 'advantage' || powerBalance.posture === 'overwhelming_advantage';
  const allowedConcessions = profile.concessionBudget >= 60 ? 4 : profile.concessionBudget >= 42 ? 3 : profile.concessionBudget >= 28 ? 2 : 1;
  const reasons: string[] = [];
  if (concessionLoad > allowedConcessions) reasons.push(`les concessions excèdent la marge politique disponible (${concessionLoad} charges pour ${allowedConcessions} admises)`);
  if (concessionLoad > 0 && tangibleGainCount === 0) reasons.push('aucune contrepartie nationale vérifiable ne compense les concessions');
  if (rivals.length > 0 && hasAdvantage && profile.statusSensitivity >= 70 && concessionLoad >= Math.max(1, tangibleGainCount)) {
    reasons.push(`le compromis donne une apparence de recul face à ${rivals.map((id) => state.countries[id]?.name ?? id).join(', ')} malgré un rapport de force favorable`);
  }
  const humiliationRisk = Math.min(100, Math.round(
    concessionLoad * 15
    + Math.max(0, concessionLoad - tangibleGainCount) * 14
    + (rivals.length && hasAdvantage ? profile.statusSensitivity * 0.38 : 0)
    + (powerBalance.posture === 'overwhelming_advantage' ? 8 : 0),
  ));
  return {
    humiliating: reasons.length > 0 && humiliationRisk >= 45,
    humiliationRisk,
    concessionLoad,
    tangibleGainCount,
    allowedConcessions,
    reasons,
    powerBalance,
  };
}

function acceptanceInterestIssues(
  state: WorldState,
  actorId: CountryId,
  participantIds: CountryId[],
  proposalText: string,
  move: AIGenericDiplomaticMove,
) {
  if (move.kind !== 'accept') return [];
  const acceptedTerms = move.acceptedTerms ?? [];
  const assessment = diplomaticSettlementAssessment(
    state,
    actorId,
    participantIds,
    [proposalText, move.position, ...acceptedTerms].join(' '),
    move.concessions,
    [proposalText, move.position, ...move.guaranteesRequested, ...move.conditions, ...acceptedTerms],
  );
  const result: DiplomaticFeasibilityIssue[] = [];
  if (assessment.concessionLoad > assessment.allowedConcessions) result.push(issue(
    'interest.concession-budget',
    'counter',
    'Budget politique de concessions dépassé',
    assessment.reasons[0] ?? 'Le gouvernement ne peut soutenir autant de concessions dans un même accord.',
    'Réduire les concessions ou obtenir des compensations tangibles et vérifiables.',
  ));
  if (assessment.concessionLoad > 0 && assessment.tangibleGainCount === 0) result.push(issue(
    'interest.minimum-return',
    'counter',
    'Absence de bénéfice national vérifiable',
    'Une acceptation ne peut pas reposer uniquement sur les concessions du pays qui répond.',
    `Conditionner l’accord à au moins un des résultats suivants : ${assessment.powerBalance.minimumExpectedOutcome.join(' ; ')}.`,
  ));
  if (assessment.humiliating) result.push(issue(
    'interest.status-humiliation',
    'counter',
    'Compromis politiquement humiliant',
    assessment.reasons.join(' ; '),
    'Transformer l’acceptation en contre-proposition : préserver le statut du pays, obtenir un gain asymétrique ou réduire sa concession.',
  ));
  return [...new Map(result.map((item) => [item.id, item])).values()];
}

/**
 * Empêche une réponse IA de transformer une demande anachronique ou une ligne
 * rouge en acceptation. Une contre-proposition est conservée pour laisser au
 * joueur une vraie marge de négociation ; aucune signature n’est créée ici.
 */
export function enforceDiplomaticMove(state: WorldState, actorId: CountryId, participantIds: CountryId[], proposalText: string, move: AIGenericDiplomaticMove, publicMessage: string): ConstrainedDiplomaticMove {
  const baseFeasibility = deriveDiplomaticFeasibility(state, actorId, participantIds, proposalText);
  const acceptanceIssues = acceptanceInterestIssues(state, actorId, participantIds, proposalText, move);
  const combinedIssues = [...new Map([...baseFeasibility.issues, ...acceptanceIssues].map((item) => [item.id, item])).values()];
  const feasibility: DiplomaticFeasibility = acceptanceIssues.length
    ? {
        ...baseFeasibility,
        issues: combinedIssues,
        blockingIssues: combinedIssues.filter((item) => item.severity === 'hard'),
        counterIssues: combinedIssues.filter((item) => item.severity === 'counter'),
        responseGuidance: `${baseFeasibility.responseGuidance} L’acceptation proposée échoue au contrôle d’intérêt national et doit devenir une contre-proposition.`,
        instruction: `${baseFeasibility.instruction} Contrôle après réponse : ${acceptanceIssues.map((item) => `${item.label} — ${item.requiredResponse}`).join(' ')}`,
      }
    : baseFeasibility;
  if (!feasibility.issues.length) return { move, publicMessage, feasibility, overridden: false };
  const actorName = state.countries[actorId]?.name ?? actorId;
  const labels = feasibility.issues.map((item) => item.label);
  const required = feasibility.issues.map((item) => item.requiredResponse);
  if (feasibility.issues.some((item) => item.id === 'red-line:generic-resource-coercion')) {
    const refusalPosition = `${actorName} rejette cette exigence avec indignation. Elle constitue une atteinte intolérable à sa souveraineté : ses ressources naturelles ne sont pas un droit d’accès pour une puissance étrangère. Une relation commerciale normale ne pourra être examinée qu’après retrait explicite de l’ultimatum et présentation d’une proposition respectueuse.`;
    const refusal: AIGenericDiplomaticMove = {
      ...move,
      kind: 'refuse',
      position: compact(refusalPosition, 900),
      concessions: [],
      conditions: [],
      redLines: unique([...move.redLines, labels[0] ?? 'Souveraineté sur les ressources naturelles']).slice(0, 5).map((item) => compact(item, 400)),
      timeline: 'Aucune négociation de fond tant que l’exigence n’est pas retirée.',
      acceptedTerms: [],
      rejectedTerms: unique([...(move.rejectedTerms ?? []), ...labels]).slice(0, 5).map((item) => compact(item, 400)),
      conditionalTerms: [],
      decisionScope: 'dialogue_only',
    };
    const refusalMessage = compact(`${actorName} rejette cette exigence avec indignation. Ses ressources relèvent de sa souveraineté : aucun accès ne sera accordé sous injonction étrangère. Une nouvelle pression sera considérée comme une atteinte à la relation bilatérale ; aucune commission technique ni négociation de fond ne peut commencer avant le retrait de l’ultimatum.`, 1_150);
    return { move: refusal, publicMessage: refusalMessage, feasibility, overridden: true };
  }
  if (feasibility.issues.some((item) => item.id === 'red-line:generic-coercive-sovereignty')) {
    const refusalPosition = `${actorName} rejette fermement cette injonction impériale. Son territoire, ses ports et ses institutions ne sont pas négociables sous ultimatum. Une coopération ne pourra être examinée qu’après retrait explicite de la pression et sur une base réciproque.`;
    const refusal: AIGenericDiplomaticMove = {
      ...move,
      kind: 'refuse',
      position: compact(refusalPosition, 900),
      concessions: [],
      conditions: [],
      redLines: unique([...move.redLines, ...labels]).slice(0, 5).map((item) => compact(item, 400)),
      timeline: 'Aucun engagement tant que l’injonction n’est pas retirée.',
      acceptedTerms: [],
      rejectedTerms: unique([...(move.rejectedTerms ?? []), ...labels]).slice(0, 5).map((item) => compact(item, 400)),
      conditionalTerms: [],
      decisionScope: 'dialogue_only',
    };
    const refusalMessage = compact(`${actorName} rejette fermement cette injonction. Sa souveraineté territoriale et institutionnelle ne peut pas être placée sous ultimatum. Une coopération consentie et réciproque ne pourra être examinée qu’après retrait explicite de la pression.`, 1_150);
    return { move: refusal, publicMessage: refusalMessage, feasibility, overridden: true };
  }
  if (move.kind === 'refuse') {
    const firmness = ['advantage', 'overwhelming_advantage'].includes(feasibility.powerBalance.posture) ? ' Cette position est définitive et toute pression supplémentaire aura un coût politique.'
      : ['disadvantage', 'overwhelming_disadvantage'].includes(feasibility.powerBalance.posture) ? ' Nous défendrons cette ligne rouge malgré le rapport de force et demandons des garanties vérifiables.'
        : ' Nous sommes disposés à entendre une proposition réciproque, mais pas à céder sur ce point.';
    const firmMessage = compact(`${actorName} refuse fermement la proposition. ${labels.join('; ')}. ${publicMessage.trim() || required[0] || 'Aucun engagement ne peut être pris dans ces conditions.'}${firmness}`, 1_150);
    const firmMove: AIGenericDiplomaticMove = {
      ...move,
      position: compact(`${actorName} refuse fermement : ${labels.join('; ')}.`, 900),
      acceptedTerms: [],
      conditionalTerms: [],
      rejectedTerms: unique([...(move.rejectedTerms ?? []), ...labels]).slice(0, 5).map((item) => compact(item, 400)),
      redLines: unique([...move.redLines, ...labels]).slice(0, 5).map((item) => compact(item, 400)),
      decisionScope: 'dialogue_only',
    };
    return { move: firmMove, publicMessage: firmMessage, feasibility, overridden: true };
  }
  const tone = ['advantage', 'overwhelming_advantage'].includes(feasibility.powerBalance.posture)
    ? 'Le rapport de force ne justifie pas de concession unilatérale.'
    : ['disadvantage', 'overwhelming_disadvantage'].includes(feasibility.powerBalance.posture)
      ? 'Nous cherchons à éviter l’escalade, mais nous ne renoncerons pas à nos intérêts essentiels.'
      : 'Une issue réciproque reste possible si chaque partie obtient une garantie vérifiable.';
  const position = `${actorName} ne peut pas accepter les termes tels quels : ${labels.join('; ')}. ${tone} Une voie de discussion reste possible si ces points sont retirés, limités ou assortis de garanties vérifiables.`;
  const constrained: AIGenericDiplomaticMove = {
    ...move,
    kind: 'counter',
    position: compact(position, 900),
    concessions: move.concessions.slice(0, 4),
    conditions: unique([...move.conditions, ...required]).slice(0, 5).map((item) => compact(item, 400)),
    redLines: unique([...move.redLines, ...labels]).slice(0, 5).map((item) => compact(item, 400)),
    timeline: move.timeline || 'Réexamen après clarification des lignes rouges et du calendrier.',
    acceptedTerms: (move.acceptedTerms ?? move.concessions).slice(0, 5),
    rejectedTerms: unique([...(move.rejectedTerms ?? []), ...labels]).slice(0, 5).map((item) => compact(item, 400)),
    conditionalTerms: unique([...(move.conditionalTerms ?? []), ...required]).slice(0, 5).map((item) => compact(item, 400)),
    decisionScope: 'principle',
  };
  const constrainedMessage = compact(`${actorName} formule une contre-proposition ferme. ${labels.join(' ; ')}. ${required[0] ?? 'Les termes doivent être clarifiés avant tout engagement.'} ${tone}`, 1_150);
  return { move: constrained, publicMessage: constrainedMessage, feasibility, overridden: true };
}
