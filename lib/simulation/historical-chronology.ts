import type { CountryId, ISODate } from './types';

/**
 * Registre déclaratif des événements dont le moteur connaît la fenêtre
 * historique minimale. Il ne force pas un événement à se produire : il
 * empêche seulement une proposition diplomatique de le traiter comme déjà
 * réalisé avant sa période plausible.
 */
export type HistoricalChronologyRule = {
  id: string;
  label: string;
  earliest: ISODate;
  latest?: ISODate;
  actorIds?: CountryId[];
  keywords: string[];
  explanation: string;
  requiredResponse: string;
};

export type HistoricalChronologyFinding = {
  id: string;
  label: string;
  explanation: string;
  requiredResponse: string;
  severity: 'hard' | 'counter';
};

const fold = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr');

/**
 * Les termes restent volontairement larges : l'IA peut imaginer une
 * manifestation différente, mais elle ne peut pas déplacer sa fenêtre de
 * départ. Les ajouts futurs se font ici, sans toucher aux règles pays.
 */
export const HISTORICAL_CHRONOLOGY_RULES: HistoricalChronologyRule[] = [
  {
    id: 'chronology.rus-ukr-pre-2014', label: 'Crise russo-ukrainienne structurée', earliest: '2014-01-01', actorIds: ['RUS', 'UKR'],
    keywords: ['cessez-le-feu', 'cessez le feu', 'armistice', 'treve', 'trêve', 'guerre russo-ukrainienne', 'conflit russo-ukrainien'],
    explanation: 'Le scénario se situe avant 2014 : une négociation de cessez-le-feu russo-ukrainienne serait anachronique.',
    requiredResponse: 'Proposer un dialogue de prévention ou une garantie de sécurité régionale.',
  },
  {
    id: 'chronology.afghanistan-pre-2001', label: 'Intervention internationale en Afghanistan', earliest: '2001-10-07', actorIds: ['USA', 'AFG'],
    keywords: ['intervention en afghanistan', 'invasion de l afghanistan', 'operation en afghanistan'],
    explanation: 'La fenêtre de l’intervention internationale en Afghanistan commence après les attentats de 2001.',
    requiredResponse: 'Reformuler en soutien humanitaire, renseignement ou prévention régionale.',
  },
  {
    id: 'chronology.iraq-invasion-pre-2003', label: 'Invasion de l’Irak', earliest: '2003-03-20', actorIds: ['USA', 'IRQ'],
    keywords: ['invasion de l irak', 'intervention en irak', 'guerre en irak', 'operation iraqi freedom'],
    explanation: 'L’intervention militaire en Irak ne peut pas être traitée comme un fait accompli avant mars 2003.',
    requiredResponse: 'Proposer une inspection, une dissuasion ou une coalition diplomatique préventive.',
  },
  {
    id: 'chronology.eu-east-enlargement-pre-2004', label: 'Élargissement oriental de l’Union européenne', earliest: '2004-05-01',
    actorIds: ['FRA', 'DEU', 'ITA', 'ESP', 'GBR'], keywords: ['elargissement de l union europeenne', 'élargissement de l’ue', 'adhesion des pays d europe centrale'],
    explanation: 'L’élargissement oriental est encore une négociation avant mai 2004 ; ses garanties et ses oppositions restent ouvertes.',
    requiredResponse: 'Parler de négociation d’adhésion et de garanties, sans présenter l’élargissement comme déjà réalisé.',
  },
  {
    id: 'chronology.global-financial-crisis-pre-2007', label: 'Crise financière mondiale', earliest: '2007-08-01',
    keywords: ['crise financiere mondiale', 'crise financière mondiale', 'crise des subprimes', 'effondrement bancaire mondial'],
    explanation: 'La crise financière mondiale n’est pas un fait accompli avant les premiers déclencheurs de 2007.',
    requiredResponse: 'Décrire un risque de contagion ou un stress financier, pas une crise déjà déclarée.',
  },
  {
    id: 'chronology.rus-georgia-war-pre-2008', label: 'Guerre russo-géorgienne', earliest: '2008-08-07', actorIds: ['RUS', 'GEO'],
    keywords: ['guerre russo georgienne', 'guerre russo-géorgienne', 'invasion de la georgie', 'invasion de la géorgie'],
    explanation: 'La guerre russo-géorgienne ne peut pas être traitée comme déjà déclenchée avant août 2008.',
    requiredResponse: 'Parler de tension, de médiation ou de prévention dans le Caucase.',
  },
  {
    id: 'chronology.arab-spring-pre-2010', label: 'Printemps arabe', earliest: '2010-12-17',
    keywords: ['printemps arabe', 'revoltes arabes', 'révoltes arabes', 'revolution tunisienne', 'révolution tunisienne'],
    explanation: 'Le mouvement de contestation transnational n’est pas encore manifesté avant décembre 2010.',
    requiredResponse: 'Décrire une pression sociale ou une réforme préventive, sans annoncer le mouvement comme lancé.',
  },
  {
    id: 'chronology.mass-terrorism-pre-2001', label: 'Attentat terroriste majeur aux États-Unis', earliest: '2001-01-01', actorIds: ['USA'],
    keywords: ['11 septembre', 'attentat majeur aux etats unis', 'attentat majeur aux états unis', 'attaque terroriste majeure aux etats unis'],
    explanation: 'Avant 2001, le moteur peut suivre une montée du terrorisme, mais pas présenter un attentat majeur comme déjà survenu.',
    requiredResponse: 'Décrire une menace émergente et une préparation possible, sans fixer la manifestation exacte.',
  },
];

function actorSetMatches(rule: HistoricalChronologyRule, actorIds: CountryId[]) {
  if (!rule.actorIds?.length) return true;
  const actors = new Set(actorIds);
  return rule.actorIds.every((id) => actors.has(id));
}

function activeKeyword(text: string, keyword: string) {
  const normalizedKeyword = fold(keyword);
  let from = text.indexOf(normalizedKeyword);
  while (from >= 0) {
    const prefix = text.slice(Math.max(0, from - 72), from);
    if (!/(?:ne\s+pas|ne\s+plus|sans|refus(?:er|e|ons)?|eviter|prevenir|respect(?:er|e|ons)?|garant(?:ir|ie)|contre|aucun|aucune)(?:\s+[a-z0-9]+){0,5}\s*$/.test(prefix)) return true;
    from = text.indexOf(normalizedKeyword, from + normalizedKeyword.length);
  }
  return false;
}

/** Retourne les contradictions temporelles applicables à une proposition. */
export function evaluateHistoricalChronology(currentDate: ISODate, proposalText: string, actorIds: CountryId[]): HistoricalChronologyFinding[] {
  const text = fold(proposalText);
  return HISTORICAL_CHRONOLOGY_RULES
    .filter((rule) => actorSetMatches(rule, actorIds))
    .filter((rule) => rule.keywords.some((keyword) => activeKeyword(text, keyword)))
    .filter((rule) => currentDate < rule.earliest || (rule.latest && currentDate > rule.latest))
    .map((rule) => ({ id: rule.id, label: rule.label, explanation: rule.explanation, requiredResponse: rule.requiredResponse, severity: 'hard' as const }));
}
