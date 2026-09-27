import { assessPoliticalSupport } from './political-cycles';
import { commitWorldAction } from './ledger';
import { evaluatePoliticalPathway } from './politics';
import { fiscalBudgetAvailable } from './fiscal';
import { reformDomainFromText } from './reforms';
import type {
  ActionProgram,
  CountryId,
  ISODate,
  NationalPoliticalState,
  ParliamentaryBlocState,
  ParliamentaryCommitteeCondition,
  ParliamentaryProcedure,
  PoliticalActionProfile,
  PoliticalPathway,
  WorldState,
} from './types';

export type { ParliamentaryBlocRole } from './types';
/** Une composition est une photographie de départ, ensuite mutable par le moteur. */
export type ParliamentaryBloc = ParliamentaryBlocState;

export type NationalCalendarEventKind = 'budget' | 'session' | 'election' | 'institutional';

export type NationalCalendarEvent = {
  id: string;
  countryId: CountryId;
  date: ISODate;
  endDate?: ISODate;
  title: string;
  kind: NationalCalendarEventKind;
  authority: string;
  summary: string;
  preparationMonths: number;
  hardDate: boolean;
};

export type InstitutionalRoute = {
  id: string;
  label: string;
  description: string;
  authority: string;
  profile: PoliticalActionProfile;
  pathway: PoliticalPathway;
};

export type NationalPoliticalSnapshot = {
  countryId: CountryId;
  legislatureLabel: string;
  legislatureSeats: number;
  majorityThreshold: number;
  referenceLabel: string;
  referenceIsCurrent: boolean;
  blocs: ParliamentaryBloc[];
  governmentSeats: number;
  oppositionSeats: number;
  procedures: ParliamentaryProcedure[];
  upcomingEvents: NationalCalendarEvent[];
  routes: InstitutionalRoute[];
  campaign: ReturnType<typeof assessPoliticalSupport> | null;
};

const addMonths = (date: ISODate, months: number): ISODate => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
};

const dayDistance = (from: ISODate, to: ISODate) => Math.round(
  (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
);

/**
 * Photographie des groupes le 1er octobre 2000. Elle inclut les deux sièges
 * vacants afin que l'hémicycle conserve ses 577 sièges constitutionnels.
 * Les 318 sièges des groupes de la gauche plurielle expliquent la majorité
 * gouvernementale de départ ; les aléas d'une réforme passent ensuite par le
 * moteur politique commun, pas par cette image statique.
 */
export const franceParliament2000: ParliamentaryBloc[] = [
  {
    id: 'fra-ps', label: 'Groupe socialiste', shortLabel: 'PS', seats: 254, color: '#e14578', role: 'government',
    leader: 'Jean-Marc Ayrault', orientation: 'Social-démocratie · pivot de la gauche plurielle',
    priorities: ['emploi', 'services publics', 'construction européenne'],
    redLines: ['démantèlement brutal de la protection sociale', 'désaveu de la cohabitation gouvernementale'], discipline: 88,
  },
  {
    id: 'fra-pcf', label: 'Communiste', shortLabel: 'PCF', seats: 35, color: '#b72f3f', role: 'government',
    leader: 'Alain Bocquet', orientation: 'Gauche communiste · partenaire critique du gouvernement',
    priorities: ['emploi industriel', 'services publics', 'pouvoir d’achat'],
    redLines: ['privatisations structurantes', 'recul social imposé'], discipline: 74,
  },
  {
    id: 'fra-rcv', label: 'Radical, Citoyen et Vert', shortLabel: 'RCV', seats: 29, color: '#4caf69', role: 'support',
    leader: 'Bernard Charles', orientation: 'Écologistes, radicaux et citoyens · soutien de majorité',
    priorities: ['écologie', 'libertés publiques', 'Europe politique'],
    redLines: ['recul environnemental manifeste', 'centralisation sans contrepartie'], discipline: 68,
  },
  {
    id: 'fra-rpr', label: 'Rassemblement pour la République', shortLabel: 'RPR', seats: 138, color: '#244c7a', role: 'opposition',
    leader: 'Jean-Louis Debré', orientation: 'Droite gaulliste · opposition parlementaire',
    priorities: ['autorité de l’État', 'sécurité', 'souveraineté nationale'],
    redLines: ['affaiblissement de la présidence', 'abandon explicite de l’autonomie nationale'], discipline: 84,
  },
  {
    id: 'fra-udf', label: 'Union pour la démocratie française – Alliance', shortLabel: 'UDF', seats: 70, color: '#3294d7', role: 'opposition',
    leader: 'Philippe Douste-Blazy', orientation: 'Centre droit · européen et décentralisateur',
    priorities: ['Europe', 'maîtrise budgétaire', 'décentralisation'],
    redLines: ['dérive des comptes publics', 'rupture européenne brutale'], discipline: 73,
  },
  {
    id: 'fra-dl', label: 'Démocratie libérale et Indépendants', shortLabel: 'DL', seats: 44, color: '#7e80bd', role: 'opposition',
    leader: 'José Rossi', orientation: 'Droite libérale · opposition économique',
    priorities: ['baisse des prélèvements', 'initiative privée', 'autorité'],
    redLines: ['extension durable du contrôle économique de l’État', 'hausse fiscale générale'], discipline: 80,
  },
  {
    id: 'fra-ni', label: 'Non-inscrits', shortLabel: 'NI', seats: 5, color: '#8b8f9a', role: 'non_aligned',
    leader: 'Positions diverses', orientation: 'Députés sans groupe constitué',
    priorities: ['enjeux territoriaux', 'dossiers locaux'],
    redLines: ['aucune ligne commune'], discipline: 35,
  },
  {
    id: 'fra-vacant', label: 'Sièges vacants', shortLabel: 'Vacants', seats: 2, color: '#4b5563', role: 'vacant',
    leader: '—', orientation: 'Circonscriptions en attente de pourvoi', priorities: [], redLines: [], discipline: 0,
  },
];

/** Le référentiel est délibérément limité à la France pendant l'alpha. */
export function createNationalPolitics2000(): Record<CountryId, NationalPoliticalState> {
  return {
    FRA: {
      countryId: 'FRA',
      legislatureLabel: 'Assemblée nationale',
      compositionVersion: 1,
      compositionDate: '2000-01-01',
      governmentBlocIds: ['fra-ps', 'fra-pcf', 'fra-rcv'],
      blocs: structuredClone(franceParliament2000),
      procedures: {},
      politicalMomentum: 0,
    },
  };
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr');

const isBudgetText = (program: ActionProgram) => /budget|fiscal|impot|taxe|prelevement|depense|subvention|financement/.test(normalize(`${program.title} ${program.intent}`));

/**
 * Le Parlement reste une exception lisible, pas un péage devant chaque action.
 * Les demandes courantes sont pilotées par l'exécutif ; seules une réforme
 * législative, un budget explicite, une déclaration de guerre ou une opération
 * extérieure exceptionnellement lourde ouvrent une procédure. Un traité majeur
 * reste une validation institutionnelle exécutive, sans vote automatique.
 */
export function requiresParliamentaryProcedure(program: Pick<ActionProgram, 'actorId' | 'category' | 'politicalAssessment' | 'decisionRoute' | 'lever' | 'title' | 'intent' | 'durationMonths' | 'budgetCost'>) {
  if (program.actorId !== 'FRA') return false;
  const text = normalize(`${program.title} ${program.intent}`);
  if (program.decisionRoute === 'parliament') return true;
  if (program.category === 'defense' && /\b(declaration de guerre|guerre ouverte|mobilisation generale)\b/.test(text)) return true;
  if (program.category === 'defense' && program.durationMonths >= 18 && program.budgetCost >= 18 && /\b(intervention|occupation|operation exterieure|offensive)\b/.test(text)) return true;
  // Compatibilité avec les anciennes sauvegardes qui ne possèdent pas encore
  // decisionRoute : on conserve leur lecture parlementaire d'origine.
  const authority = program.politicalAssessment?.requiredAuthority;
  return !program.decisionRoute && program.category !== 'diplomacy' && (authority === 'legislative' || authority === 'constitutional');
}

function programStakeholderReactions(state: WorldState, program: ActionProgram) {
  const subjectId = program.linkedDossierId ?? `program:${program.lever ?? program.category}`;
  return Object.values(state.stakeholderReactions).filter((reaction) => (
    reaction.countryId === program.actorId
    && reaction.status !== 'resolved'
    && (
      reaction.relatedMeasureIds.includes(`measure-${program.id}`)
      || reaction.causes.includes(program.title)
      || reaction.subjectId === subjectId
    )
  ));
}

function stakeholderBlocScoreDelta(state: WorldState, program: ActionProgram, blocId: string) {
  let delta = 0;
  const sensitivities: Record<string, Record<string, number>> = {
    organized_labor: { 'fra-ps': 1, 'fra-pcf': 1.3, 'fra-rcv': 0.7 },
    administration: { 'fra-ps': 0.8, 'fra-pcf': 0.5, 'fra-rcv': 0.55, 'fra-udf': 0.25, 'fra-rpr': 0.2 },
    capital: { 'fra-ps': 0.3, 'fra-udf': 1, 'fra-dl': 1.3, 'fra-rpr': 0.45 },
    civic: { 'fra-ps': 0.65, 'fra-pcf': 0.55, 'fra-rcv': 0.9, 'fra-rpr': 0.7, 'fra-udf': 0.45, 'fra-dl': 0.35 },
    military: { 'fra-ps': 0.5, 'fra-rpr': 1.2, 'fra-udf': 0.5, 'fra-dl': 0.45 },
  };
  for (const reaction of programStakeholderReactions(state, program)) {
    const group = state.stakeholderGroups[reaction.groupId];
    const sensitivity = group ? sensitivities[group.category]?.[blocId] ?? 0 : 0;
    if (!group || sensitivity === 0) continue;
    const pressure = (reaction.defiance * 0.46 + reaction.mobilization * 0.34 + (reaction.actorPressure ?? 0) * 0.2)
      * (0.45 + group.influence / 180);
    const direction = reaction.stance === 'support' ? 1 : -1;
    delta += direction * pressure * sensitivity * 0.1;
  }
  return Math.round(clamp(delta, -18, 18));
}

function committeeScoreDelta(procedure: ParliamentaryProcedure | undefined, blocId: string) {
  if (!procedure?.committeeConditions?.length || !procedure.acceptedCommitteeConditionIds?.length) return 0;
  return procedure.committeeConditions
    .filter((condition) => procedure.acceptedCommitteeConditionIds?.includes(condition.id))
    .flatMap((condition) => condition.blocScoreDeltas)
    .filter((item) => item.blocId === blocId)
    .reduce((sum, item) => sum + item.delta, 0);
}

function blocDisposition(
  state: WorldState,
  bloc: ParliamentaryBloc,
  program: ActionProgram,
  momentum: number,
  procedure?: ParliamentaryProcedure,
) {
  const text = normalize(`${program.title} ${program.intent}`);
  let score = bloc.role === 'government' ? 87 : bloc.role === 'support' ? 76 : bloc.role === 'opposition' ? 26 : bloc.role === 'non_aligned' ? 44 : 0;
  const has = (...terms: string[]) => terms.some((term) => text.includes(term));
  if (has('emploi', 'industrie', 'service public', 'protection sociale', 'logement')) {
    if (['fra-ps', 'fra-pcf'].includes(bloc.id)) score += 11;
    if (bloc.id === 'fra-rcv') score += 4;
    if (bloc.id === 'fra-dl') score -= 10;
  }
  if (has('privatisation', 'baisse des prelevements', 'liberalisation', 'deregulation')) {
    if (bloc.id === 'fra-dl') score += 25;
    if (bloc.id === 'fra-udf') score += 10;
    if (['fra-pcf', 'fra-ps'].includes(bloc.id)) score -= 24;
  }
  if (has('ecologie', 'pollution', 'climat', 'renouvelable', 'environnement')) {
    if (bloc.id === 'fra-rcv') score += 22;
    if (bloc.id === 'fra-pcf') score -= 4;
  }
  if (has('defense', 'securite', 'renseignement', 'militaire')) {
    if (bloc.id === 'fra-rpr') score += 16;
    if (bloc.id === 'fra-ps') score += 4;
  }
  if (has('europe', 'europeen', 'union europeenne')) {
    if (['fra-udf', 'fra-rcv', 'fra-ps'].includes(bloc.id)) score += 12;
    if (bloc.id === 'fra-rpr') score -= 5;
  }
  if (has('impot', 'taxe', 'prelevement') && bloc.id === 'fra-dl') score -= 18;
  if (has('budget', 'deficit', 'dette', 'consolidation') && bloc.id === 'fra-udf') score += 10;
  if (program.politicalAssessment?.finalScore !== undefined) score += (program.politicalAssessment.finalScore - 55) * 0.18;
  score += stakeholderBlocScoreDelta(state, program, bloc.id);
  score += committeeScoreDelta(procedure, bloc.id);
  return Math.round(clamp(score + momentum * 0.3));
}

function voteShare(score: number, discipline: number) {
  if (score >= 78) return clamp(0.72 + score * 0.0018 + discipline / 2_000, 0, 0.96);
  if (score >= 62) return clamp(0.42 + score * 0.002 + discipline / 2_200, 0, 0.82);
  if (score >= 48) return clamp(0.12 + score * 0.0025 + discipline / 2_600, 0, 0.58);
  return clamp(0.025 + score * 0.001 + discipline / 3_000, 0, 0.24);
}

function projectedSupport(
  state: WorldState,
  politics: NationalPoliticalState,
  program: ActionProgram,
  procedure?: ParliamentaryProcedure,
) {
  const supportByBloc = politics.blocs.filter((bloc) => bloc.role !== 'vacant').map((bloc) => {
    const score = blocDisposition(state, bloc, program, politics.politicalMomentum, procedure);
    const estimatedVotes = Math.round(bloc.seats * voteShare(score, bloc.discipline));
    return {
      blocId: bloc.id,
      estimatedVotes,
      disposition: score >= 62 ? 'support' as const : score >= 45 ? 'conditional' as const : 'oppose' as const,
    };
  });
  return {
    supportByBloc,
    estimatedVotes: supportByBloc.reduce((sum, item) => sum + item.estimatedVotes, 0),
  };
}

function hasSocialExposure(program: ActionProgram) {
  return /retrait|pension|vieillesse|protection sociale|securite sociale|capitalisation|repartition|emploi|chomage|salaire|travail|service public|austerite/.test(
    normalize(`${program.title} ${program.intent}`),
  );
}

function committeeConditions(
  state: WorldState,
  procedure: ParliamentaryProcedure,
  program: ActionProgram,
): ParliamentaryCommitteeCondition[] {
  if (procedure.committeeConditions?.length) return procedure.committeeConditions;
  const reactions = programStakeholderReactions(state, program);
  const opposition = reactions.filter((reaction) => reaction.stance !== 'support');
  const reactionIds = (category: string) => opposition
    .filter((reaction) => state.stakeholderGroups[reaction.groupId]?.category === category)
    .map((reaction) => reaction.id);
  const conditions: ParliamentaryCommitteeCondition[] = [];
  const socialReactionIds = [...reactionIds('organized_labor'), ...reactionIds('administration')];
  if (hasSocialExposure(program) || socialReactionIds.length) {
    const surcharge = Number(Math.max(0.8, Math.min(2.5, program.budgetCost * 0.28)).toFixed(1));
    conditions.push({
      id: `${procedure.id}:social-guarantees`,
      title: 'Garanties sociales et transition',
      summary: 'La commission demande une clause de transition et des garanties explicites pour les personnes directement exposées.',
      requestedByBlocIds: ['fra-ps', 'fra-pcf', 'fra-rcv'],
      stakeholderReactionIds: socialReactionIds,
      amendment: 'Clause de transition sociale et rapport annuel de protection',
      budgetDelta: surcharge,
      durationDeltaMonths: 0,
      blocScoreDeltas: [{ blocId: 'fra-ps', delta: 3 }, { blocId: 'fra-pcf', delta: 9 }, { blocId: 'fra-rcv', delta: 4 }],
    });
  }
  const fiscalConcern = procedure.kind === 'budget'
    || /budget|deficit|dette|fiscal|impot|taxe|depense|financement/.test(normalize(`${program.title} ${program.intent}`));
  const capitalReactionIds = reactionIds('capital');
  if (conditions.length < 2 && (fiscalConcern || capitalReactionIds.length)) {
    conditions.push({
      id: `${procedure.id}:budget-framework`,
      title: 'Cadrage budgétaire et clause de revoyure',
      summary: 'Un plafond de dépense et une évaluation annuelle sont demandés avant toute montée en charge.',
      requestedByBlocIds: ['fra-udf', 'fra-dl'],
      stakeholderReactionIds: capitalReactionIds,
      amendment: 'Plafond de dépense et clause annuelle de revoyure',
      budgetDelta: 0,
      durationDeltaMonths: 0,
      blocScoreDeltas: [{ blocId: 'fra-udf', delta: 8 }, { blocId: 'fra-dl', delta: 4 }, { blocId: 'fra-ps', delta: 2 }],
    });
  }
  const civicReactionIds = reactionIds('civic');
  if (conditions.length < 2 && civicReactionIds.length) {
    conditions.push({
      id: `${procedure.id}:phased-implementation`,
      title: 'Mise en œuvre progressive',
      summary: 'La commission demande un déploiement par étapes afin de réduire la polarisation et de laisser un temps d’ajustement.',
      requestedByBlocIds: ['fra-rcv', 'fra-udf'],
      stakeholderReactionIds: civicReactionIds,
      amendment: 'Calendrier de mise en œuvre progressive',
      budgetDelta: Number(Math.max(0.5, program.budgetCost * 0.12).toFixed(1)),
      durationDeltaMonths: 3,
      blocScoreDeltas: [{ blocId: 'fra-ps', delta: 3 }, { blocId: 'fra-rcv', delta: 6 }, { blocId: 'fra-udf', delta: 4 }],
    });
  }
  return conditions.slice(0, 2);
}

/** Prépare une procédure lisible, sans préjuger de son résultat deux mois plus tard. */
export function createParliamentaryProcedure(state: WorldState, program: ActionProgram): ParliamentaryProcedure | null {
  const politics = state.nationalPolitics?.[program.actorId];
  if (!politics) return null;
  const kind = program.politicalAssessment?.requiredAuthority === 'constitutional'
    ? 'constitutional'
    : isBudgetText(program) ? 'budget' : 'law';
  const projection = projectedSupport(state, politics, program);
  const majorityThreshold = kind === 'constitutional'
    ? Math.ceil(politics.blocs.reduce((sum, bloc) => sum + bloc.seats, 0) * 0.6)
    : Math.floor(politics.blocs.reduce((sum, bloc) => sum + bloc.seats, 0) / 2) + 1;
  const procedureId = `parliament-${program.id}`;
  return {
    id: procedureId,
    programId: program.id,
    countryId: program.actorId,
    title: kind === 'budget' ? `Arbitrage budgétaire · ${program.title}` : kind === 'constitutional' ? `Révision institutionnelle · ${program.title}` : `Projet de loi · ${program.title}`,
    kind,
    stage: 'draft',
    submittedAt: state.currentDate,
    committeeAt: addMonths(state.currentDate, 1),
    voteAt: addMonths(state.currentDate, 2),
    majorityThreshold,
    estimatedVotes: projection.estimatedVotes,
    supportByBloc: projection.supportByBloc,
    amendments: [],
    summary: `Texte déposé par le gouvernement. Projection initiale : ${projection.estimatedVotes}/${majorityThreshold} voix nécessaires ; la commission peut encore modifier l'équilibre.`,
  };
}

function committeeAmendments(procedure: ParliamentaryProcedure) {
  if (procedure.kind === 'budget') return ['Cadrage pluriannuel demandé', 'Clause de contrôle parlementaire ajoutée'];
  if (procedure.kind === 'constitutional') return ['Recherche d’un accord transpartisan', 'Voie référendaire conservée comme alternative'];
  return ['Rapport d’application exigé', 'Évaluation parlementaire à échéance ajoutée'];
}

function procedureForCondition(
  procedure: ParliamentaryProcedure,
  conditionId: string,
  response: 'accept' | 'decline',
) {
  const ids = response === 'accept'
    ? [...new Set([...(procedure.acceptedCommitteeConditionIds ?? []), conditionId])]
    : [...new Set([...(procedure.declinedCommitteeConditionIds ?? []), conditionId])];
  return response === 'accept'
    ? { ...procedure, acceptedCommitteeConditionIds: ids }
    : { ...procedure, declinedCommitteeConditionIds: ids };
}

/** Le joueur peut accepter ou refuser une demande précise sans engager de crédit avant le vote. */
export function respondToParliamentaryCondition(
  state: WorldState,
  procedureId: string,
  conditionId: string,
  response: 'accept' | 'decline',
) {
  const politics = Object.values(state.nationalPolitics ?? {}).find((item) => item.procedures[procedureId]);
  const procedure = politics?.procedures[procedureId];
  const program = procedure ? state.actionPrograms[procedure.programId] : undefined;
  if (!politics || !procedure || !program) return { ok: false as const, state, error: 'Procédure parlementaire introuvable.' };
  if (procedure.stage !== 'committee' || program.status !== 'pending_parliament') {
    return { ok: false as const, state, error: 'Cette demande de commission n’est plus ouverte.' };
  }
  const condition = procedure.committeeConditions?.find((item) => item.id === conditionId);
  if (!condition) return { ok: false as const, state, error: 'Condition de commission introuvable.' };
  if (procedure.acceptedCommitteeConditionIds?.includes(conditionId) || procedure.declinedCommitteeConditionIds?.includes(conditionId)) {
    return { ok: false as const, state, error: 'Cette condition a déjà reçu une réponse.' };
  }

  const adjustedProgram = response === 'accept'
    ? {
      ...program,
      budgetCost: Number((program.budgetCost + condition.budgetDelta).toFixed(1)),
      durationMonths: program.durationMonths + condition.durationDeltaMonths,
      expectedCompletionAt: addMonths(procedure.voteAt, program.durationMonths + condition.durationDeltaMonths),
    }
    : program;
  const adjustedProcedure = procedureForCondition(procedure, conditionId, response);
  const projection = projectedSupport(state, politics, adjustedProgram, adjustedProcedure);
  const accepted = response === 'accept';
  const amendments = accepted
    ? [...new Set([...procedure.amendments, condition.amendment])]
    : procedure.amendments;
  const summary = accepted
    ? `Compromis intégré : ${condition.title}. Projection actualisée : ${projection.estimatedVotes}/${procedure.majorityThreshold} voix ; vote prévu le ${procedure.voteAt}.`
    : `Texte maintenu sans « ${condition.title} ». Projection : ${projection.estimatedVotes}/${procedure.majorityThreshold} voix ; vote prévu le ${procedure.voteAt}.`;
  const effects: import('./types').WorldEffect[] = [
    {
      kind: 'parliamentary_procedure_patch', countryId: procedure.countryId, procedureId: procedure.id,
      patch: { ...adjustedProcedure, estimatedVotes: projection.estimatedVotes, supportByBloc: projection.supportByBloc, amendments, summary },
      reason: accepted ? 'Le gouvernement accepte une condition explicitement négociée en commission.' : 'Le gouvernement conserve le texte sans cette condition de commission.',
      visibility: 'player',
    },
  ];
  if (accepted) effects.push({
    kind: 'action_program_patch', programId: program.id,
    patch: {
      budgetCost: adjustedProgram.budgetCost,
      durationMonths: adjustedProgram.durationMonths,
      expectedCompletionAt: adjustedProgram.expectedCompletionAt,
      resolution: `Texte en commission : compromis retenu — ${condition.title}.`,
    },
    reason: `Le compromis « ${condition.title} » modifie les paramètres du texte avant le vote.`, visibility: 'player',
  });
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'political', actorId: procedure.countryId, origin: 'player', visibility: 'player',
      intent: `${accepted ? 'Accepter' : 'Refuser'} une condition de commission : ${condition.title}`,
      effects,
      assumptions: [
        `Condition : ${condition.title}.`,
        accepted
          ? `Effet prévu après adoption : ${condition.budgetDelta > 0 ? `+${condition.budgetDelta.toFixed(1)} crédit${condition.budgetDelta > 1 ? 's' : ''}` : 'aucun crédit supplémentaire'}${condition.durationDeltaMonths ? ` · +${condition.durationDeltaMonths} mois d’exécution` : ''}.`
          : 'Le texte est maintenu sans modification matérielle.',
      ],
    }),
  };
}

/** Un vote perdu conserve le texte : le joueur peut le représenter après un délai politique. */
export function retryParliamentaryProcedure(state: WorldState, procedureId: string) {
  const politics = Object.values(state.nationalPolitics ?? {}).find((item) => item.procedures[procedureId]);
  const procedure = politics?.procedures[procedureId];
  const program = procedure ? state.actionPrograms[procedure.programId] : undefined;
  if (!politics || !procedure || !program) return { ok: false as const, state, error: 'Procédure parlementaire introuvable.' };
  if (procedure.stage !== 'rejected' || program.status !== 'pending_parliament') {
    return { ok: false as const, state, error: 'Seul un texte rejeté et encore préparé peut être redéposé.' };
  }
  const committeeAt = addMonths(state.currentDate, 1);
  const voteAt = addMonths(state.currentDate, 2);
  const projection = projectedSupport(state, politics, program, procedure);
  const effects: import('./types').WorldEffect[] = [
    {
      kind: 'parliamentary_procedure_patch', countryId: procedure.countryId, procedureId: procedure.id,
      patch: {
        stage: 'draft', submittedAt: state.currentDate, committeeAt, voteAt,
        declinedCommitteeConditionIds: [], resolution: undefined,
        estimatedVotes: projection.estimatedVotes, supportByBloc: projection.supportByBloc,
        summary: `Texte redéposé après le vote perdu. Les amendements déjà retenus sont conservés ; nouvelle commission à partir du ${committeeAt}.`,
      },
      reason: 'Le gouvernement redépose le texte sans engager de crédit ni de capacité.', visibility: 'player',
    },
    {
      kind: 'action_program_patch', programId: program.id,
      patch: {
        expectedCompletionAt: addMonths(voteAt, program.durationMonths),
        resolution: 'Texte redéposé : nouvelle fenêtre de commission puis de vote.',
      },
      reason: 'Le programme reste préparé pendant la nouvelle séquence parlementaire.', visibility: 'player',
    },
  ];
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'political', actorId: procedure.countryId, origin: 'player', visibility: 'player',
      intent: `Redéposer : ${procedure.title}`,
      effects,
      assumptions: [`Nouvelle commission à partir du ${committeeAt}.`, `Nouveau vote à partir du ${voteAt}.`, 'Aucun crédit ni moyen n’est engagé pendant ce délai.'],
    }),
  };
}

/**
 * Passage mensuel de la commission puis du vote. L'action matérielle ne démarre
 * qu'après l'adoption ou l'adoption amendée : c'est un délai, pas une interdiction.
 */
export function advanceParliamentaryProcedures(state: WorldState) {
  let next = state;
  for (const politics of Object.values(state.nationalPolitics ?? {})) {
    for (const original of Object.values(politics.procedures).sort((a, b) => a.id.localeCompare(b.id))) {
      const procedure = next.nationalPolitics?.[politics.countryId]?.procedures[original.id];
      const program = procedure ? next.actionPrograms[procedure.programId] : undefined;
      if (!procedure || !program || program.status !== 'pending_parliament') continue;
      if (procedure.stage === 'draft' && next.currentDate >= procedure.committeeAt) {
        const conditions = committeeConditions(next, procedure, program);
        const amendments = committeeAmendments(procedure);
        const stage = conditions.length ? 'committee' : 'vote_scheduled';
        const summary = conditions.length
          ? `Commission ouverte. ${conditions.length === 1 ? 'Une condition politique attend une réponse' : 'Deux conditions politiques attendent une réponse'} ; vote prévu à partir du ${procedure.voteAt}.`
          : `Commission achevée. ${amendments.join(' · ')}. Vote prévu à partir du ${procedure.voteAt}.`;
        next = commitWorldAction(next, {
          kind: 'political', actorId: procedure.countryId, origin: 'local_rule', visibility: 'player',
          intent: `Examiner en commission : ${procedure.title}`,
          effects: [{ kind: 'parliamentary_procedure_patch', countryId: procedure.countryId, procedureId: procedure.id,
            patch: { stage, amendments, committeeConditions: conditions, summary },
            reason: conditions.length ? 'La commission expose ses compromis possibles avant le vote.' : 'La commission précise le texte sans en changer unilatéralement l’objectif.', visibility: 'player' }],
        });
        continue;
      }
      if (!['committee', 'vote_scheduled'].includes(procedure.stage) || next.currentDate < procedure.voteAt) continue;
      const currentPolitics = next.nationalPolitics?.[procedure.countryId];
      if (!currentPolitics) continue;
      const currentVotes = projectedSupport(next, currentPolitics, program, procedure);
      const estimatedVotes = currentVotes.estimatedVotes;
      const margin = estimatedVotes - procedure.majorityThreshold;
      const fundingAvailable = next.countries[program.actorId] ? fiscalBudgetAvailable(next.countries[program.actorId], 'discretionary') >= program.budgetCost : false;
      const stage = fundingAvailable && margin >= 12 && !(procedure.acceptedCommitteeConditionIds?.length) ? 'adopted' : fundingAvailable && margin >= 0 ? 'amended' : 'rejected';
      const adopted = stage === 'adopted' || stage === 'amended';
      const resolution = !fundingAvailable
        ? `Vote reporté faute de crédits : la marge discrétionnaire disponible (${next.countries[program.actorId]?.fiscal.discretionaryMargin.toFixed(1) ?? '0'}) ne couvre plus le coût de ${program.budgetCost.toFixed(1)}.`
        : stage === 'adopted'
        ? `Adopté avec une projection de ${estimatedVotes} voix pour ${procedure.majorityThreshold} nécessaires.`
        : stage === 'amended'
          ? `Adopté après amendements : projection de ${estimatedVotes} voix pour ${procedure.majorityThreshold} nécessaires.`
          : `Vote perdu : projection de ${estimatedVotes} voix, sous le seuil de ${procedure.majorityThreshold}. Le texte reste disponible pour une nouvelle séquence.`;
      const effects: import('./types').WorldEffect[] = [
        { kind: 'parliamentary_procedure_patch', countryId: procedure.countryId, procedureId: procedure.id,
          patch: { stage, estimatedVotes, supportByBloc: currentVotes.supportByBloc, resolution, summary: resolution }, reason: 'Le vote parlementaire tranche la procédure.', visibility: 'player' },
        { kind: 'action_program_patch', programId: program.id,
          patch: adopted ? {
            status: 'active', startedAt: next.currentDate, expectedCompletionAt: addMonths(next.currentDate, program.durationMonths), progressMonths: 0,
            successProbability: stage === 'amended' ? program.successProbability - 8 : program.successProbability,
            resolution: stage === 'amended' ? 'Texte adopté sous réserve d’amendements parlementaires.' : 'Texte adopté : lancement opérationnel autorisé.',
            budgetStatus: 'consumed', budgetConsumedAt: next.currentDate,
            resourceStatus: 'committed', resourcesCommittedAt: next.currentDate,
          } : {
            status: 'pending_parliament', expectedCompletionAt: addMonths(next.currentDate, 2 + program.durationMonths),
            resolution: `${resolution} Aucun crédit ni moyen n’a été engagé.`,
            budgetStatus: 'not_committed', resourceStatus: 'not_committed',
          },
          reason: adopted ? 'Le vote autorise le lancement du programme.' : 'Le vote retarde le programme sans engager de moyen matériel.', visibility: 'player' },
      ];
      if (adopted) {
        effects.push(
          { kind: 'fiscal_delta', countryId: program.actorId, bucket: 'discretionary', delta: -program.budgetCost, reason: 'La marge discrétionnaire est engagée après l’adoption parlementaire.', visibility: 'player' },
          ...program.requiredCapacities.map(({ domain, commitment }) => ({ kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: commitment, reason: `Moyens mobilisés après le vote pour « ${program.title} ».`, visibility: 'player' as const })),
        );
        const reformDomain = program.reformIntent?.domain ?? reformDomainFromText(program.intent);
        if (program.lever === 'national_reform' && reformDomain) effects.push({
          kind: 'national_reform_patch', countryId: program.actorId, domain: reformDomain,
          patch: { activeProgramId: program.id }, reason: 'La réforme devient active après son adoption parlementaire.', visibility: 'player',
        });
      }
      if (program.linkedDossierId && next.strategicDossiers[program.linkedDossierId]) effects.push({
        kind: 'dossier_entry_add', dossierId: program.linkedDossierId,
        entry: { id: `${program.id}:vote`, date: next.currentDate, title: adopted ? 'Adoption et lancement' : 'Vote perdu : texte à reprendre',
          summary: `${resolution} ${adopted ? `${program.budgetCost.toFixed(1)} crédits engagés ; l’exécution commence maintenant.` : 'Aucun crédit ni moyen engagé ; le joueur peut redéposer le texte après un délai.'}`,
          importance: 'moderate', actorIds: [program.actorId], requiresDecision: !adopted, visibility: 'player' },
        reason: 'La décision parlementaire rejoint le suivi du programme.', visibility: 'player',
      });
      next = commitWorldAction(next, { kind: 'political', actorId: procedure.countryId, origin: 'local_rule', visibility: 'player', intent: `Voter : ${procedure.title}`, effects });
    }
  }
  return next;
}

const franceFixedCalendar: NationalCalendarEvent[] = [
  {
    id: 'fra-municipales-2001-1', countryId: 'FRA', date: '2001-03-11', endDate: '2001-03-18', title: 'Élections municipales', kind: 'election',
    authority: 'Corps électoral et exécutifs locaux', summary: 'Un test territorial de la majorité et de l’opposition ; il ne renverse pas directement l’exécutif national.', preparationMonths: 3, hardDate: true,
  },
  {
    id: 'fra-senatoriales-2001', countryId: 'FRA', date: '2001-09-23', title: 'Renouvellement sénatorial', kind: 'election',
    authority: 'Grand électorat', summary: 'Renouvellement partiel du Sénat : effet institutionnel et territorial, pas une élection générale.', preparationMonths: 2, hardDate: true,
  },
  {
    id: 'fra-presidential-2002-1', countryId: 'FRA', date: '2002-04-21', endDate: '2002-05-05', title: 'Élection présidentielle', kind: 'election',
    authority: 'Présidence de la République', summary: 'Échéance centrale de la cohabitation. Le moteur ouvre la séquence politique avant le scrutin et résout le rapport de forces à l’échelle mensuelle.', preparationMonths: 4, hardDate: true,
  },
  {
    id: 'fra-legislatives-2002', countryId: 'FRA', date: '2002-06-09', endDate: '2002-06-16', title: 'Élections législatives', kind: 'election',
    authority: 'Assemblée nationale', summary: 'La composition fine sera reconstruite au moment du résultat ; ce scrutin peut modifier la base de soutien du gouvernement.', preparationMonths: 4, hardDate: true,
  },
  {
    id: 'fra-regionales-2004', countryId: 'FRA', date: '2004-03-21', endDate: '2004-03-28', title: 'Élections régionales', kind: 'election',
    authority: 'Régions', summary: 'Baromètre territorial et politique, utile pour anticiper les coalitions mais sans effet automatique sur le gouvernement.', preparationMonths: 3, hardDate: true,
  },
  {
    id: 'fra-europeennes-2004', countryId: 'FRA', date: '2004-06-13', title: 'Élections européennes', kind: 'election',
    authority: 'Parlement européen', summary: 'Échéance politique européenne : elle mesure les rapports de force sans se substituer aux institutions françaises.', preparationMonths: 3, hardDate: true,
  },
];

function annualFranceCalendar(year: number): NationalCalendarEvent[] {
  const date = (month: string) => `${year}-${month}` as ISODate;
  return [
    {
      id: `fra-budget-preparation-${year}`, countryId: 'FRA', date: date('09-01'), endDate: date('12-31'), title: `Séquence budgétaire ${year}`, kind: 'budget',
      authority: 'Gouvernement, Assemblée nationale et Sénat', summary: 'Fenêtre de préparation, débat et vote du budget. Les mesures qui modifient durablement dépenses ou prélèvements y trouvent leur voie institutionnelle normale.', preparationMonths: 3, hardDate: false,
    },
    {
      id: `fra-session-ordinary-${year}`, countryId: 'FRA', date: date('10-01'), endDate: `${year + 1}-06-30` as ISODate, title: 'Session parlementaire ordinaire', kind: 'session',
      authority: 'Assemblée nationale et Sénat', summary: 'Fenêtre principale pour les projets de loi, amendements, commissions et arbitrages parlementaires.', preparationMonths: 1, hardDate: false,
    },
  ];
}

export type InternationalCalendarEvent = {
  id: string;
  date: ISODate;
  endDate?: ISODate;
  title: string;
  institution: string;
  summary: string;
  preparationMonths: number;
};

/**
 * Les sommets changent parfois de lieu ou de jour. Le moteur enregistre donc
 * des fenêtres stables, plutôt que de feindre une précision historique qui ne
 * survivrait pas à une divergence de partie.
 */
function annualInternationalCalendar(year: number): InternationalCalendarEvent[] {
  const date = (monthDay: string) => `${year}-${monthDay}` as ISODate;
  return [
    { id: `global-eu-spring-${year}`, date: date('03-15'), title: 'Conseil européen de printemps', institution: 'Union européenne', summary: 'Fenêtre d’arbitrage européen : économie, élargissement, sécurité et lignes communes peuvent y être portés.', preparationMonths: 2 },
    { id: `global-imf-spring-${year}`, date: date('04-15'), title: 'Réunions de printemps', institution: 'FMI · Banque mondiale', summary: 'Fenêtre de coordination financière internationale et de signaux sur la dette souveraine.', preparationMonths: 2 },
    { id: `global-g7-${year}`, date: date('06-15'), title: 'Fenêtre de sommet du G7', institution: 'G7', summary: 'Une fenêtre diplomatique de haut niveau ; l’ordre du jour concret dépend du monde simulé et des crises en cours.', preparationMonths: 3 },
    { id: `global-un-ga-${year}`, date: date('09-15'), endDate: date('10-15'), title: 'Assemblée générale des Nations unies', institution: 'ONU', summary: 'Séquence multilatérale utile aux résolutions, coalitions, prises de parole et rencontres bilatérales.', preparationMonths: 2 },
    { id: `global-imf-autumn-${year}`, date: date('10-10'), title: 'Réunions annuelles', institution: 'FMI · Banque mondiale', summary: 'Fenêtre financière annuelle : réformes, financement et fragilités souveraines peuvent s’y cristalliser.', preparationMonths: 2 },
    { id: `global-eu-winter-${year}`, date: date('12-10'), title: 'Conseil européen d’hiver', institution: 'Union européenne', summary: 'Dernière fenêtre européenne de l’année pour les arbitrages politiques et budgétaires.', preparationMonths: 2 },
  ];
}

export function upcomingInternationalCalendar(currentDate: ISODate, horizonMonths = 12) {
  const horizon = addMonths(currentDate, horizonMonths);
  const firstYear = Number(currentDate.slice(0, 4));
  return Array.from({ length: Math.ceil(horizonMonths / 12) + 2 }, (_, index) => annualInternationalCalendar(firstYear + index))
    .flat()
    .filter((event) => event.date >= currentDate && event.date <= horizon)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

function franceInstitutionalRoutes(state: WorldState): InstitutionalRoute[] {
  const routes: Array<Omit<InstitutionalRoute, 'pathway'>> = [
    {
      id: 'executive', label: 'Décision exécutive', authority: 'Président, Premier ministre et gouvernement',
      description: 'Décret, instruction ou arbitrage de l’exécutif. Rapide, mais contraint par la cohabitation et l’administration.',
      profile: { requiredAuthority: 'executive', doctrine: {}, publicSalience: 36, administrativeComplexity: 45 },
    },
    {
      id: 'law', label: 'Projet de loi', authority: 'Assemblée nationale puis Sénat',
      description: 'Voie normale pour une réforme durable : majorité, amendements, calendrier parlementaire et texte applicable.',
      profile: { requiredAuthority: 'legislative', doctrine: { social: 18 }, publicSalience: 66, administrativeComplexity: 70 },
    },
    {
      id: 'budget', label: 'Arbitrage budgétaire', authority: 'Gouvernement et Parlement',
      description: 'Une dépense ou un prélèvement durable doit s’inscrire dans la séquence budgétaire ; la fenêtre d’automne réduit les frictions.',
      profile: { requiredAuthority: 'legislative', doctrine: { economic: -10 }, publicSalience: 74, administrativeComplexity: 74 },
    },
    {
      id: 'constitutional', label: 'Révision institutionnelle', authority: 'Congrès ou référendum',
      description: 'Réservée aux changements de règles fondamentales : elle exige une coalition large ou un référendum selon la voie choisie.',
      profile: { requiredAuthority: 'constitutional', doctrine: { sovereignty: 35 }, publicSalience: 90, administrativeComplexity: 88 },
    },
  ];
  return routes.map((route) => ({ ...route, pathway: evaluatePoliticalPathway(state, 'FRA', route.profile) }));
}

function monthsWindow(currentDate: ISODate, horizonMonths: number) {
  return addMonths(currentDate, horizonMonths);
}

export function nationalPoliticalSnapshot(
  state: WorldState,
  countryId: CountryId = state.playerCountryId,
  horizonMonths = 30,
): NationalPoliticalSnapshot | null {
  if (countryId !== 'FRA' || !state.countries.FRA) return null;
  const country = state.countries.FRA;
  const cycle = state.politicalCycles.FRA;
  const national = state.nationalPolitics?.FRA;
  const blocs = national?.blocs ?? franceParliament2000;
  const horizon = monthsWindow(state.currentDate, horizonMonths);
  const calendar = [
    ...franceFixedCalendar,
    ...Array.from({ length: Math.ceil(horizonMonths / 12) + 2 }, (_, index) => annualFranceCalendar(Number(state.currentDate.slice(0, 4)) + index)).flat(),
    ...(cycle ? [{
      id: `fra-cycle-${cycle.cycleNumber}`, countryId: 'FRA' as CountryId,
      date: addMonths(cycle.nextReviewDate, -cycle.warningMonths), endDate: cycle.nextReviewDate,
      title: cycle.status === 'campaign' ? 'Séquence politique ouverte' : 'Ouverture de la séquence présidentielle', kind: 'institutional' as const,
      authority: 'Exécutif, partis et électorat', summary: 'Le moteur crée alors un dossier politique, mesure le bilan du pays et laisse au joueur choisir une posture de campagne.', preparationMonths: 0, hardDate: false,
    } satisfies NationalCalendarEvent] : []),
  ].filter((event) => event.date >= state.currentDate && event.date <= horizon)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const governmentSeats = blocs.filter((bloc) => bloc.role === 'government' || bloc.role === 'support').reduce((sum, bloc) => sum + bloc.seats, 0);
  const oppositionSeats = blocs.filter((bloc) => bloc.role === 'opposition').reduce((sum, bloc) => sum + bloc.seats, 0);
  const referenceIsCurrent = Boolean(national && national.compositionDate <= state.currentDate);
  return {
    countryId,
    legislatureLabel: 'Assemblée nationale',
    legislatureSeats: country.politics.legislatureSeats,
    majorityThreshold: Math.floor(country.politics.legislatureSeats / 2) + 1,
    referenceLabel: national
      ? `Composition parlementaire · ${national.compositionDate.slice(0, 4)}${national.lastElectionOutcome ? ` · ${national.lastElectionOutcome === 'alternation' ? 'alternance' : 'reconduction'}` : ''}`
      : 'Composition de référence · année 2000',
    referenceIsCurrent,
    blocs,
    governmentSeats,
    oppositionSeats,
    procedures: Object.values(national?.procedures ?? {}).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || left.id.localeCompare(right.id)),
    upcomingEvents: calendar,
    routes: franceInstitutionalRoutes(state),
    campaign: cycle ? assessPoliticalSupport(state, 'FRA', cycle) : null,
  };
}

export function calendarEventReadiness(event: NationalCalendarEvent, currentDate: ISODate): 'due' | 'prepare' | 'scheduled' {
  const days = dayDistance(currentDate, event.date);
  if (days <= 31) return 'due';
  if (days <= event.preparationMonths * 31) return 'prepare';
  return 'scheduled';
}
