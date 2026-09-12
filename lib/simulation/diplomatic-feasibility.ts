import type { AIGenericDiplomaticMove } from '../ai/job-contracts';
import type { CountryId, CountryState, WorldState } from './types';
import { evaluateHistoricalChronology } from './historical-chronology';

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

export type DiplomaticFeasibility = {
  actorId: CountryId;
  participantIds: CountryId[];
  archetype: string;
  rules: DiplomaticRedLineRule[];
  matchedRules: DiplomaticRedLineRule[];
  issues: DiplomaticFeasibilityIssue[];
  blockingIssues: DiplomaticFeasibilityIssue[];
  counterIssues: DiplomaticFeasibilityIssue[];
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

function issue(id: string, severity: DiplomaticFeasibilityIssue['severity'], label: string, explanation: string, requiredResponse: string): DiplomaticFeasibilityIssue {
  return { id, severity, label, explanation, requiredResponse };
}

/** Déduit la cohérence d'une proposition à la date exacte de la sauvegarde. */
export function deriveDiplomaticFeasibility(state: WorldState, actorId: CountryId, participantIds: CountryId[], proposalText: string): DiplomaticFeasibility {
  const actor = state.countries[actorId];
  const safeParticipants = unique(participantIds.filter((id) => id !== actorId && Boolean(state.countries[id])));
  if (!actor) {
    return { actorId, participantIds: safeParticipants, archetype: 'unknown', rules: [], matchedRules: [], issues: [], blockingIssues: [], counterIssues: [], instruction: 'Aucun garde-fou pays n’est disponible : rester prudent et demander une clarification.' };
  }
  const { archetype, rules } = staticRulesFor(actor);
  const text = normalize(proposalText);
  const matchedRules = rules.filter((rule) => rule.keywords.some((keyword) => activeTerm(text, keyword)));
  const issues: DiplomaticFeasibilityIssue[] = matchedRules.map((rule) => issue(
    `red-line:${rule.id}`,
    rule.strength === 'hard' ? 'hard' : 'counter',
    rule.label,
    rule.rationale,
    `Ne pas accepter sans retirer ou circonscrire le terme « ${rule.label} ».`,
  ));
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
  const names = safeParticipants.map((id) => state.countries[id]?.name ?? id).join(', ') || 'les interlocuteurs';
  const instruction = dedupedIssues.length
    ? `Garde-fous obligatoires pour ${actor.name} face à ${names} : ${dedupedIssues.map((item) => `${item.severity === 'hard' ? 'BLOQUANT' : 'À CONTRE-PROPOSER'} — ${item.label}. ${item.requiredResponse}`).join(' ')}`
    : `Aucune ligne rouge ne bloque explicitement la proposition pour ${actor.name}. Vérifier néanmoins la doctrine, les objectifs et les contreparties avant d’accepter.`;
  return { actorId, participantIds: safeParticipants, archetype, rules, matchedRules, issues: dedupedIssues, blockingIssues, counterIssues, instruction };
}

export function diplomaticPostureStatement(state: WorldState, actorId: CountryId) {
  const actor = state.countries[actorId];
  if (!actor) return 'Aucune posture diplomatique structurée n’est disponible.';
  const { archetype, rules } = staticRulesFor(actor);
  const hard = rules.filter((rule) => rule.strength === 'hard').map((rule) => rule.label).slice(0, 8);
  const strong = rules.filter((rule) => rule.strength === 'strong').map((rule) => rule.label).slice(0, 5);
  return `${actor.name} relève du profil ${archetype}. Lignes fermes : ${hard.join(' ; ') || 'aucune explicite'}. Points à négocier avec garanties : ${strong.join(' ; ') || 'aucun documenté'}. Les contraintes de date et de conflit sont recalculées pour chaque proposition.`;
}

/**
 * Empêche une réponse IA de transformer une demande anachronique ou une ligne
 * rouge en acceptation. Une contre-proposition est conservée pour laisser au
 * joueur une vraie marge de négociation ; aucune signature n’est créée ici.
 */
export function enforceDiplomaticMove(state: WorldState, actorId: CountryId, participantIds: CountryId[], proposalText: string, move: AIGenericDiplomaticMove, publicMessage: string): ConstrainedDiplomaticMove {
  const feasibility = deriveDiplomaticFeasibility(state, actorId, participantIds, proposalText);
  if (!feasibility.issues.length || move.kind === 'refuse') return { move, publicMessage, feasibility, overridden: false };
  const actorName = state.countries[actorId]?.name ?? actorId;
  const labels = feasibility.issues.map((item) => item.label);
  const required = feasibility.issues.map((item) => item.requiredResponse);
  const position = `${actorName} ne peut pas accepter les termes tels quels : ${labels.join('; ')}. Une voie de discussion reste possible si ces points sont retirés, limités ou assortis de garanties vérifiables.`;
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
  const constrainedMessage = compact(`${actorName} formule une contre-proposition. ${labels.join(' ; ')}. ${required[0] ?? 'Les termes doivent être clarifiés avant tout engagement.'}`, 1_150);
  return { move: constrained, publicMessage: constrainedMessage, feasibility, overridden: true };
}
