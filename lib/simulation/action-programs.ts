import { commitWorldAction, relationBetween } from './ledger';
import { dossierNeedsStabilization, makeDossierDecision } from './dossiers';
import { seededUnit } from './random';
import { actionIntentFromProgram } from './action-intents';
import { historicalAnchorResolutionEffects } from './history';
import { actionLeverPolitics, actionLeverProfile, actionLeverProfiles } from './action-levers';
import { evaluateStrategicAction } from './decision-making';
import { evaluatePoliticalPathway } from './politics';
import { stakeholderReactionEffects } from './stakeholders';
import { attachProgramDossier, programExecutionEffects, programOutcomeDetails } from './program-consequences';
import { countryMentionedInText } from './country-sheet';
import { nationalPolicyAuditEffects, nationalReformEffects, nationalReformOutcomeSummaryFor, nationalReformProfiles, nationalReformSnapshot, nationalReformSupport, reformDomainFromText, reformOptionForStructuredIntent, reformOptionForText, reformPolicySignals, reformPolicySignalsForIntent } from './reforms';
import { militaryTheaterCancellationEffects, militaryTheaterDossier, militaryTheaterReservationEffects, militaryTheaterResolutionEffects, validateMilitaryTheaterCommand } from './military-theaters';
import { createParliamentaryProcedure, requiresParliamentaryProcedure } from './national-politics';
import { portDossierEffects, resolvePortProgramEffects } from './territorial-assets';
import { assessGovernmentCapacityForAction, governmentCapacityDimensionLabel } from './government-capacity';
import { actionLifecycleStageForStatus } from './action-lifecycle';
import { selectExternalConflictReactions } from './external-reactions';
import { fiscalBudgetAvailable } from './fiscal';
import { worldCrisisInfluenceResolutionEffects } from './world-crisis-influence';
import { resolveDueGeopoliticalReaction, scheduleGeopoliticalReaction } from './geopolitical-reactions';
import {
  advanceTerritorialProject,
  createTerritorialProject,
  territorialProjectBlocksProgress,
  territorialProjectPlanForIntent,
  territorialProjectResolutionEffects,
  territorialResourceSubject,
  validateTerritorialProjectPlan,
} from './territorial-projects';
import type {
  ActionKind,
  ActionDecisionRoute,
  ActionScope,
  ActionProgram,
  CommonActionCategory,
  CommonActionLever,
  CountryId,
  HistoricalInterventionDirection,
  ISODate,
  MilitaryTheaterActionKind,
  MilitaryTheaterOperation,
  PolicySignal,
  StructuredReformIntent,
  WorldEffect,
  WorldState,
} from './types';
import type { ActionIntent } from './action-intents';

export type PreparedCommonAction = Omit<ActionProgram, 'id' | 'startedAt' | 'expectedCompletionAt' | 'progressMonths' | 'status' | 'resolution'>;

export type CommonActionPreparation =
  | { ok: true; action: PreparedCommonAction; warnings: string[] }
  | { ok: false; error: string };

export type CommonActionPreparationOptions = {
  /** Origine de l’intention : affichée dans la traçabilité, sans effet privilégié. */
  source?: ActionIntent['source'];
  requestId?: string;
  /** Dossier à suivre automatiquement jusqu’à la résolution du programme. */
  linkedDossierId?: string;
  /** Catégorie imposée par une interface structurée ; sinon le texte est interprété localement. */
  category?: CommonActionCategory;
  /** Interlocuteur explicitement lié au dossier ; évite qu'une mention secondaire dans un texte IA ne déplace l'action vers un autre pays. */
  targetId?: CountryId;
  /** Posture explicite appliquée à un ancrage historique lié au programme. */
  historicalIntent?: HistoricalInterventionDirection;
  /** Intention structurée produite par l'IA ou par une interface guidée. */
  reformIntent?: StructuredReformIntent;
  /** Domaine explicitement demandé pour une expertise de politique publique. */
  policyDomain?: import('./types').NationalReformDomain;
};

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const normalize = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function addMonths(date: ISODate, months: number): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
}

/**
 * Le joueur n'a pas à choisir une autorité dans un menu. Le moteur déduit la
 * voie la plus légère compatible avec la demande : l'exécutif par défaut,
 * l'état-major pour les mouvements militaires, et le Parlement seulement
 * pour les textes qui l'exigent réellement.
 */
export function actionDecisionRouteFor(
  category: CommonActionCategory,
  lever: CommonActionLever,
  intent: string,
  durationMonths = 0,
  budgetCost = 0,
): ActionDecisionRoute {
  const value = normalize(intent);
  // Une expertise peut préparer un texte futur, sans pour autant déposer ce
  // texte. Elle relève donc de l'exécutif et ne consomme pas un tour législatif.
  if (lever === 'policy_audit' || lever === 'resource_prospection') return 'executive';
  if (category === 'intelligence') return 'intelligence_services';
  if (category === 'diplomacy') {
    if (lever === 'defense_pact' || /\b(trait[eé]|engagement majeur|alliance strategique)\b/.test(value)) return 'executive_institutional';
    return 'executive';
  }
  if (category === 'defense') {
    if (/\b(declaration de guerre|guerre ouverte|mobilisation generale)\b/.test(value)) return 'parliament';
    // Une opération extérieure très longue et coûteuse peut provoquer un
    // examen parlementaire ; une simple posture ou un redéploiement reste
    // piloté par le joueur avec l'état-major.
    if (durationMonths >= 18 && budgetCost >= 18 && /\b(intervention|occupation|operation exterieure|offensive)\b/.test(value)) return 'parliament';
    return 'executive_staff';
  }
  if (category === 'economic') {
    if (['fiscal_stimulus', 'fiscal_consolidation'].includes(lever) || /\b(loi de finances|impot|taxe|budget legislatif)\b/.test(value)) return 'parliament';
    return 'executive';
  }
  if (category === 'institutional') {
    if (lever === 'national_reform' || /\b(projet de loi|loi|reforme constitutionnelle)\b/.test(value)) return 'parliament';
    return 'executive';
  }
  return 'executive';
}

export function actionScopeFor(category: CommonActionCategory, targetId: CountryId | undefined, intent: string): ActionScope {
  const value = normalize(intent);
  if (/\b(g7|g20|onu|mondial|monde entier|international global)\b/.test(value)) return 'global';
  if (/\b(europe|union europeenne|otan|mediterranee|afrique|asie|amerique|moyen orient|region)\b/.test(value)) return 'regional';
  if (targetId && (category === 'diplomacy' || category === 'intelligence' || category === 'defense')) return 'bilateral';
  return 'national';
}

export function actionLifecycleStageFor(status: ActionProgram['status']): import('./types').ActionLifecycleStage {
  return actionLifecycleStageForStatus(status);
}

function impactPreviewFor(effects: { success: WorldEffect[]; partial: WorldEffect[] }, scope: ActionScope, durationMonths: number) {
  const nationalKinds = new Set(['metric_delta', 'fiscal_delta', 'fiscal_patch', 'macro_policy_delta', 'aggregate_sector_delta', 'politics_patch', 'political_apparatus_patch', 'capacity_commitment', 'capacity_maximum', 'national_reform_patch', 'sector_delta']);
  const national = effects.success.filter((effect) => nationalKinds.has(effect.kind)).map((effect) => effect.reason).slice(0, 3);
  const international = effects.success.filter((effect) => !nationalKinds.has(effect.kind)).map((effect) => effect.reason).slice(0, 3);
  if (scope !== 'national' && international.length === 0) international.push('La relation ou la posture extérieure évolue à l’échelle ciblée.');
  if (national.length === 0) national.push(scope === 'national' ? 'Le fonctionnement interne du pays est susceptible d’évoluer.' : 'Les capacités nationales restent mobilisées pendant l’action.');
  return { national, international, appliesAt: `Effets appliqués à la résolution, après ${durationMonths} mois.` };
}

function auditImpactPreview(state: WorldState, actorId: CountryId, durationMonths: number, intent: string) {
  const subject = territorialResourceSubject(state, actorId, intent);
  if (subject) return {
    national: [`Un rapport de prospection documente le potentiel ${subject.resource === 'or' ? 'd’or' : `de ${subject.resource}`}, les accès et les contraintes en ${subject.territoryName} avant toute décision extractive.`],
    international: [],
    appliesAt: `Rapport disponible après ${durationMonths} mois. Aucune mine ni aucun site extractif n’est ouvert par cette prospection.`,
  };
  return {
    national: ['Un rapport contradictoire est produit et versé au dossier pour éclairer un choix ultérieur.'],
    international: [],
    appliesAt: `Rapport disponible après ${durationMonths} mois. Aucune réforme n’est adoptée par cet audit.`,
  };
}

function territorialProjectImpactPreview(plan: NonNullable<PreparedCommonAction['territorialProjectPlan']>, durationMonths: number) {
  const resource = plan.resource === 'or' ? 'd’or' : `de ${plan.resource}`;
  return {
    national: [
      `Le lancement engage une mine pilote ${resource} en ${plan.territoryName}, sur la base du rapport de prospection déjà remis.`,
      'La capacité extractive, les coûts récurrents et le bilan territorial seront calculés à partir des arbitrages effectivement rendus pendant le chantier.',
    ],
    international: ['La traçabilité, les garanties environnementales et la sécurité du site influenceront ensuite la confiance commerciale des partenaires concernés.'],
    appliesAt: `Chantier initial prévu sur ${durationMonths} mois. Chaque incident territorial peut modifier le coût, le délai, la production et le soutien local.`,
  };
}

function targetInText(state: WorldState, text: string): CountryId | undefined {
  // Réutilise le dictionnaire national commun : les réponses IA emploient
  // naturellement « Alger », « Moscou » ou « Royaume-Uni », pas toujours le
  // libellé exact de la fiche. Sans cela une option lisible devenait
  // impossible à préparer par le moteur.
  return countryMentionedInText(state, text);
}

function inferCategory(text: string): CommonActionCategory | undefined {
  const value = normalize(text);
  if (/\b(renseignement|dgse|espion|surveill|infiltr|ecoute)\b/.test(value)) return 'intelligence';
  // Une intention de guerre peut être formulée sans le vocabulaire technique
  // « défense » ou « déploiement ». Elle ouvre tout de même une voie
  // d'état-major : les risques influencent l'exécution, jamais le droit du
  // joueur à en préparer la trajectoire.
  if (/\b(militaire|defense|armee|arme|troupe|deploi|dissuasion|guerre|invasion|intrusion|incursion|offensive|etat major|renverser|renversement|prise de controle|occupation|intervention)\b/.test(value)) return 'defense';
  // Une prospection minière est une action économique de connaissance. Elle
  // produit un rapport avant toute mine, mais doit mobiliser l'économie et
  // rester visible dans le même domaine que le projet qu'elle prépare.
  if (/\b(prospect\w*|gisement\w*|minerai\w*|ressourc\w* minier\w*|orpaillage|inventaire geologique|potentiel geologique|mine\w*|extraction|exploitat\w*)\b/.test(value)) return 'economic';
  // Un audit, une expertise ou une commission est une action transversale de
  // l'État : son sujet peut être économique, social, énergétique ou militaire,
  // mais son effet immédiat reste la production d'une base de décision.
  if (/\b(audit|etude|expertise|commission|rapport|diagnostic|evaluation|prospective|projection|scenario)\b/.test(value)) return 'institutional';
  // Les retraites relèvent d'abord d'une capacité publique et d'un arbitrage
  // social. Un audit sur ce sujet ne doit pas être rejeté parce qu'il ne cite
  // ni un ministère ni le mot générique « réforme ».
  if (/\b(retrait\w*|pension\w*|vieillesse|assurance vieillesse|protection sociale|securite sociale|capitalisation|repartition)\b/.test(value)) return 'institutional';
  if (/\b(ministere|sous ministere|administration|institution|reforme|service public|relig\w*|laic\w*|immigr\w*|migrat\w*|asile|naturalisation|integration|societ\w*|famille|ordre public|droits civils|egalite)\b/.test(value)) return 'institutional';
  if (/\b(fonds commun|fonds europeen|cofinancement|budget europeen|investissement conjoint|mecanisme de financement|quote part)\b/.test(value)) return 'economic';
  if (/\b(n egocier|negocier|negociation|alliance|cooperation|cooperer|dialogue|accord|partenariat|sommet|mediation)\b/.test(value)) return 'diplomacy';
  if (/\b(programme|plan|industrie|industriel|budget|budgetaire|fiscal|deficit|depense|austerite|consolidation|assainir|investir|investissement|production|commerce|croissance|dette|emploi|energie|energetique|gaz|petrole|semiconducteur|nucleaire|relance|filiere|fonds|cofinancement|financement|quote part|investissement conjoint)\b/.test(value)) return 'economic';
  return undefined;
}

const categoryKinds: Record<CommonActionCategory, ActionKind> = {
  diplomacy: 'diplomatic', economic: 'economic', institutional: 'institutional', defense: 'defense', intelligence: 'intelligence',
};

type DiplomaticOperation = NonNullable<Extract<ActionIntent, { kind: 'common_program' }>['operation']>;

function diplomaticOperation(intent: string): DiplomaticOperation {
  const value = normalize(intent);
  if (/\b(pacte? defense|alliance defensive|garantie militaire|defense mutuelle)\b/.test(value)) return 'defense_pact';
  if (/\b(mediation|arbitrage|rapprochement|desescalade)\b/.test(value)) return 'mediation';
  if (/\b(renseignement|information|donnees|echange d informations|partage d informations)\b/.test(value)) return 'information_sharing';
  if (/\b(cooperation|cooperer|technolog|partage|partenariat|accord)\b/.test(value)) return 'cooperation';
  return 'contact';
}

function diplomaticDossier(state: WorldState, targetId: CountryId, operation: DiplomaticOperation, intent: string): WorldEffect {
  const player = state.countries[state.playerCountryId];
  const target = state.countries[targetId];
  const labels: Record<DiplomaticOperation, string> = {
    contact: 'Canal diplomatique', cooperation: 'Coopération bilatérale', defense_pact: 'Coordination de défense',
    mediation: 'Médiation bilatérale', information_sharing: 'Partage d’informations',
  };
  const kinds: Record<DiplomaticOperation, 'cooperation' | 'security' | 'diplomatic_crisis'> = {
    contact: 'cooperation', cooperation: 'cooperation', defense_pact: 'security', mediation: 'diplomatic_crisis', information_sharing: 'security',
  };
  const id = `diplomatic-${player.id}-${targetId}-${operation}`;
  return {
    kind: 'dossier_add',
    dossier: {
      id, title: `${labels[operation]} · ${player.name}–${target?.name ?? targetId}`,
      kind: kinds[operation], status: 'active', importance: operation === 'defense_pact' ? 'major' : 'moderate',
      actorIds: [player.id, targetId], regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate,
      phase: 'Mise en œuvre', trend: 'stable', publicSummary: `Une initiative de ${labels[operation].toLocaleLowerCase('fr')} est engagée.`,
      followed: true, autoTracked: false, playerStance: intent,
      commitments: [], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [],
      entries: [{ id: `${id}-opening`, date: state.currentDate, title: 'Initiative engagée', summary: intent, importance: 'moderate', actorIds: [player.id, targetId], requiresDecision: false, visibility: 'player' }],
    },
    reason: 'Une initiative diplomatique persistante reçoit un dossier consultable.', visibility: 'player',
  };
}

const conflictStageLabels = {
  rivalry: 'Rivalité stratégique',
  pressure: 'Pression politique',
  crisis: 'Crise ouverte',
  military_preparation: 'Préparation militaire',
  confrontation: 'Confrontation imminente',
  war: 'Guerre ouverte',
} as const;

function isHostileDefenseProgram(program: Pick<ActionProgram, 'category' | 'actorId' | 'targetIds' | 'intent'>) {
  if (program.category !== 'defense') return false;
  const targetId = program.targetIds.find((id): id is CountryId => id !== program.actorId);
  return Boolean(targetId);
}

function confirmedWarThreshold(intent: string) {
  const value = normalize(intent);
  // « Préparer/planifier une invasion » n'est pas le franchissement : le
  // joueur doit ensuite confirmer l'action qui ouvre réellement le conflit.
  const preparatory = /\b(preparer|preparation|planifier|plan|etudier|convoquer|organiser)\b/.test(value);
  if (preparatory) return false;
  return /\b(franchir|lancer l assaut|ordonner l attaque|attaquer|frapper|bombarder|guerre ouverte|entrer en guerre|envahir|occupation effective)\b/.test(value);
}

/** Transforme un ordre hostile en dossier de crise distinct. Il ne remplace
 * jamais le dossier diplomatique parent : l'échange et l'escalade militaire
 * restent deux fils jouables, reliés mais non confondus. */
function conflictEscalationEffects(state: WorldState, program: Pick<ActionProgram, 'id' | 'category' | 'actorId' | 'targetIds' | 'intent' | 'title' | 'linkedDossierId'>): WorldEffect[] {
  if (!isHostileDefenseProgram(program)) return [];
  const targetId = program.targetIds.find((id): id is CountryId => id !== program.actorId);
  if (!targetId || !state.countries[targetId]) return [];
  const player = state.countries[program.actorId];
  const target = state.countries[targetId];
  const threshold = confirmedWarThreshold(program.intent);
  const stage = threshold ? 'war' as const : 'military_preparation' as const;
  const dossierId = `conflict-${program.actorId}-${targetId}`;
  const existing = state.strategicDossiers[dossierId];
  const external = selectExternalConflictReactions(state, {
    actorId: program.actorId,
    targetId,
    stage,
    previous: existing?.conflictState?.externalReactions,
  });
  const signals: Array<{ signal: PolicySignal; weight: number }> = [
    { signal: 'foreign_military_presence', weight: 1 },
    { signal: 'status_humiliation', weight: 0.72 },
  ];
  if (/ressource|hydrocarb|petrol|gaz|minier|gisement/i.test(normalize(program.intent))) signals.push({ signal: 'resource_sovereignty', weight: 0.9 });
  const intensity = threshold ? 92 : 74;
  const effects: WorldEffect[] = [
    { kind: 'relation_delta', from: program.actorId, to: targetId, relation: threshold ? -24 : -14, trust: threshold ? -18 : -10, reason: threshold ? `L’ouverture des hostilités contre ${target.name} rompt la relation bilatérale.` : `La préparation militaire dirigée contre ${target.name} dégrade fortement la relation bilatérale.`, visibility: 'player' },
    ...external.effects,
    ...stakeholderReactionEffects(state, {
      id: `conflict-reaction:${program.id}:${targetId}`,
      countryId: targetId,
      title: threshold ? `Réaction à l’ouverture des hostilités par ${player.name}` : `Réaction à la préparation militaire de ${player.name}`,
      subjectId: dossierId,
      intensity,
      gravity: threshold ? 5 : 4.1,
      signals,
      effects: [],
    }),
  ];
  const summary = threshold
    ? `${player.name} franchit un seuil d’action contre ${target.name}. Une zone de guerre peut désormais être structurée et ses effets économiques, logistiques et politiques deviennent actifs.`
    : `${player.name} engage une préparation militaire contre ${target.name}. L’état-major, les acteurs intérieurs et le gouvernement visé réagissent, mais aucune zone de guerre n’est encore ouverte.`;
  if (existing) {
    effects.unshift({ kind: 'dossier_patch', dossierId, patch: {
      status: 'active', importance: threshold ? 'critical' : existing.importance === 'minor' ? 'moderate' : existing.importance,
      phase: conflictStageLabels[stage], trend: 'escalating', updatedAt: state.currentDate,
      conflictState: {
        stage, updatedAt: state.currentDate, triggerId: program.id,
        ...(threshold ? { warThresholdConfirmed: true } : {}),
        externalReactions: external.reactions,
        powerRankingSnapshot: external.ranking,
        objective: existing.conflictState?.objective,
        situation: existing.conflictState?.situation,
      },
    }, reason: 'La préparation hostile actualise la trajectoire militaire du dossier.', visibility: 'player' });
    effects.push({ kind: 'dossier_entry_add', dossierId, entry: {
      id: `conflict-escalation-${program.id}`, date: state.currentDate, title: conflictStageLabels[stage], summary,
      importance: threshold ? 'critical' : 'major', actorIds: [program.actorId, targetId], requiresDecision: threshold, visibility: 'player',
    }, reason: 'Le seuil d’escalade est conservé dans le dossier de conflit.', visibility: 'player' });
    effects.push({ kind: 'dossier_entry_add', dossierId, entry: {
      id: `conflict-external-${program.id}`, date: state.currentDate, title: 'Réactions extérieures',
      summary: external.reactions.map((reaction) => `${reaction.actorLabel} : ${reaction.summary}`).join(' '),
      importance: threshold ? 'critical' : 'major', actorIds: [program.actorId, targetId, ...external.reactions.map((reaction) => reaction.actorId)], requiresDecision: false, visibility: 'player',
    }, reason: 'Les prises de position internationales sont ajoutées au fil de la crise.', visibility: 'player' });
  } else {
    effects.unshift({ kind: 'dossier_add', dossier: {
      id: dossierId, title: `Crise militaire · ${player.name}–${target.name}`,
      kind: 'conflict', status: 'active', importance: threshold ? 'critical' : 'major', scope: 'player_involved',
      ...(program.linkedDossierId && state.strategicDossiers[program.linkedDossierId] ? { parentDossierId: program.linkedDossierId } : {}),
      actorIds: [program.actorId, targetId], regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate,
      phase: conflictStageLabels[stage], trend: 'escalating', conflictState: {
        stage, updatedAt: state.currentDate, triggerId: program.id,
        ...(threshold ? { warThresholdConfirmed: true } : {}),
        externalReactions: external.reactions,
        powerRankingSnapshot: external.ranking,
      },
      publicSummary: summary, followed: true, autoTracked: false, commitments: [],
      pendingDecisions: threshold ? ['Déterminer les objectifs politiques et les limites de l’engagement militaire.'] : ['Décider s’il faut renforcer, suspendre ou franchir un seuil militaire.'],
      relatedCurrentIds: [], relatedActionIds: [program.id],
      entries: [
        { id: `conflict-opening-${program.id}`, date: state.currentDate, title: conflictStageLabels[stage], summary, importance: threshold ? 'critical' : 'major', actorIds: [program.actorId, targetId], requiresDecision: threshold, visibility: 'player' },
        { id: `conflict-external-${program.id}`, date: state.currentDate, title: 'Réactions extérieures', summary: external.reactions.map((reaction) => `${reaction.actorLabel} : ${reaction.summary}`).join(' '), importance: threshold ? 'critical' : 'major', actorIds: [program.actorId, targetId, ...external.reactions.map((reaction) => reaction.actorId)], requiresDecision: false, visibility: 'player' },
      ],
    }, reason: 'Un ordre militaire hostile ouvre un dossier de conflit persistant.', visibility: 'player' });
  }
  return effects;
}

/** Un programme de renseignement devient aussi un dossier traçable dès son engagement. */
function intelligenceMissionDossier(state: WorldState, program: ActionProgram): WorldEffect[] {
  const targetId = program.targetIds[0];
  if (!targetId) return [];
  const targetName = state.countries[targetId]?.name ?? targetId;
  const dossierId = `intelligence-mission-${program.actorId}-${targetId}`;
  const covert = /secret|clandest|discr[èe]t|sous surveillance|sans informer|non public/i.test(program.intent)
    || !/liaison|partage|coop[ée]ration|accord|officiel|public|conjoint/i.test(program.intent);
  const parentDossier = program.linkedDossierId && program.linkedDossierId !== dossierId
    ? state.strategicDossiers[program.linkedDossierId]
    : undefined;
  const parentLink = parentDossier ? ` Déclenchée depuis « ${parentDossier.title} » : cette suite est suivie séparément.` : '';
  const entry = {
    id: `intel-opening-${program.id}`,
    date: state.currentDate,
    title: covert ? 'Mission clandestine engagée' : 'Mission engagée',
    summary: `${program.intent}.${covert ? ' Aucun acteur extérieur n’est informé automatiquement ; une réaction ne sera produite qu’en cas d’indice ou de compromission modélisée.' : ''}${parentLink}`,
    importance: 'moderate' as const,
    actorIds: [program.actorId, targetId],
    requiresDecision: false,
    visibility: 'player' as const,
  };
  // Un dossier explicitement choisi par le joueur est la mémoire canonique de
  // la mission. Ouvrir en parallèle un « intelligence-mission-* » rendrait la
  // chronologie illisible et ferait remonter deux fois le même fait dans le
  // suivi. Le dossier automatique reste disponible quand aucune liaison n'a
  // été fournie.
  if (parentDossier) {
    return [{
      kind: 'dossier_entry_add' as const,
      dossierId: parentDossier.id,
      entry: {
        ...entry,
        id: `${entry.id}-parent`,
        title: 'Suite renseignement rattachée',
        summary: `Une mission ${covert ? 'clandestine' : 'de renseignement'} visant ${targetName} prolonge ce dossier. Aucun effet diplomatique public n’est déduit de son lancement.`,
      },
      reason: 'Le dossier explicitement choisi conserve le lien causal avec la mission.',
      visibility: 'player' as const,
    }];
  }
  if (state.strategicDossiers[dossierId]) {
    return [
      { kind: 'dossier_entry_add', dossierId, entry, reason: 'La mission rejoint son dossier de renseignement persistant.', visibility: 'player' },
    ];
  }
  return [{
    kind: 'dossier_add',
    dossier: {
      id: dossierId,
      title: `Mission de renseignement · ${targetName}`,
      kind: 'security' as const,
      status: 'active' as const,
      importance: 'moderate' as const,
      scope: 'player_involved' as const,
      actorIds: [program.actorId, targetId],
      regionTags: [],
      startedAt: state.currentDate,
      updatedAt: state.currentDate,
      phase: covert ? 'Mission clandestine en cours' : 'Préparation opérationnelle',
      trend: 'stable' as const,
      publicSummary: covert
        ? `La France conduit une mission clandestine visant ${targetName}. Le moteur ne diffuse aucune réaction internationale au lancement ; seuls le suivi interne, le résultat et une éventuelle compromission seront visibles.`
        : `Une mission de renseignement visant ${targetName} est engagée ; ses résultats et risques seront suivis jusqu’à l’échéance.`,
      followed: true,
      autoTracked: false,
      commitments: [],
      pendingDecisions: [],
      relatedCurrentIds: [],
      relatedActionIds: [program.id],
      entries: [entry],
    },
    reason: covert ? 'Une mission clandestine ouvre un dossier de suivi interne persistant.' : 'Une mission engagée ouvre un dossier de suivi persistant.',
    visibility: 'player' as const,
  }];
}

function diplomaticResolutionEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'category' | 'targetIds' | 'intent' | 'id'>,
  outcome: 'succeeded' | 'partially_succeeded' | 'failed',
  resolution: string,
): WorldEffect[] {
  if (program.category !== 'diplomacy' || program.targetIds.length === 0) return [];
  const targetId = program.targetIds[0];
  if (!targetId || !state.countries[targetId]) return [];
  const operation = diplomaticOperation(program.intent);
  const dossierId = `diplomatic-${state.playerCountryId}-${targetId}-${operation}`;
  const phase = outcome === 'succeeded' ? 'Première mise en œuvre achevée'
    : outcome === 'partially_succeeded' ? 'Mise en œuvre partielle'
      : 'Issue initiale en échec';
  const trend = outcome === 'succeeded' ? 'stable' : 'deescalating';
  return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { phase, trend, status: outcome === 'failed' ? 'deescalating' : 'active' },
      reason: 'La résolution du programme actualise le dossier diplomatique au lieu de disparaître dans le journal.',
      visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${program.id}-resolution`, date: state.currentDate, title: phase, summary: resolution,
        importance: outcome === 'failed' ? 'moderate' : 'major', actorIds: [state.playerCountryId, targetId],
        requiresDecision: outcome !== 'failed', visibility: 'player',
      },
      reason: 'Le résultat est rattaché à la chronologie permanente du dossier.', visibility: 'player',
    },
  ];
}

function linkedDossierResolutionEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'actorId' | 'targetIds' | 'linkedDossierId' | 'id' | 'title' | 'category' | 'lever'>,
  outcome: 'succeeded' | 'partially_succeeded' | 'failed',
  resolution: string,
): WorldEffect[] {
  const dossierId = program.linkedDossierId;
  if (!dossierId) return [];
  const dossier = state.strategicDossiers[dossierId];
  if (!dossier) return [];
  const playerLed = program.actorId === state.playerCountryId;
  const needsStabilization = dossierNeedsStabilization(dossier);
  const isDiplomaticInitiative = program.category === 'diplomacy';
  const isKnowledgeReport = program.lever === 'policy_audit' || program.lever === 'resource_prospection';
  const phase = isKnowledgeReport
    ? outcome === 'succeeded' ? 'Rapport disponible'
      : outcome === 'partially_succeeded' ? 'Rapport incomplet à compléter'
        : program.lever === 'resource_prospection' ? 'Prospection interrompue ou non concluante' : 'Audit interrompu ou non concluant'
    : outcome === 'succeeded'
    ? isDiplomaticInitiative
      ? playerLed ? 'Initiative gouvernementale enregistrée · réponse des partenaires à obtenir' : 'Initiative extérieure enregistrée'
      : playerLed ? 'Réponse gouvernementale efficace' : 'Initiative autonome aboutie'
    : outcome === 'partially_succeeded' ? 'Résultat partiel à consolider'
      : 'Échec et regain de pression';
  // Une désescalade est réservée aux crises. Une coopération aboutie doit
  // rester un dossier actif : son résultat n'est ni une sortie de crise, ni un
  // accord présumé avant la réponse des autres gouvernements.
  const trend = outcome === 'failed' ? 'escalating'
    : outcome === 'succeeded' ? (needsStabilization && playerLed ? 'deescalating' : 'stable')
      : dossier.trend === 'escalating' ? 'stable' : dossier.trend;
  const status = outcome === 'succeeded' && playerLed && needsStabilization ? 'deescalating' : 'active';
  // Même un échec est une information stratégique : le joueur doit pouvoir
  // choisir une suite, demander un dialogue, déléguer ou assumer le silence.
  const requiresPlayerDecision = !isKnowledgeReport && outcome !== 'succeeded'
    && dossier.actorIds.includes(state.playerCountryId)
    && (playerLed || dossier.importance === 'major' || dossier.importance === 'critical');
  const decision = requiresPlayerDecision
    ? playerLed ? `Évaluer la suite de « ${program.title} » dans « ${dossier.title} ».`
      : `Évaluer la suite après la résolution du programme autonome dans « ${dossier.title} ».`
    : undefined;
  const pendingDecisions = decision && !dossier.pendingDecisions.includes(decision)
    ? [...dossier.pendingDecisions, decision].slice(-6)
    : dossier.pendingDecisions;
  const decisionRecords = decision
    ? [...(dossier.decisionRecords ?? []).filter((record) => record.prompt !== decision), makeDossierDecision({
      id: `${program.id}-decision`, prompt: decision, createdAt: state.currentDate,
      importance: dossier.importance, actorIds: dossier.actorIds, sourceKind: 'autonomous_program',
      sourceId: program.id,
      sourceLabel: program.title,
    })]
    : dossier.decisionRecords;
  return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { phase, trend, status, pendingDecisions, ...(decisionRecords ? { decisionRecords } : {}) },
      reason: 'La résolution du programme autonome actualise le dossier qui l’a déclenché.', visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${program.id}-resolution`, date: state.currentDate, title: phase, summary: resolution,
        importance: dossier.importance, actorIds: [...new Set([program.actorId, ...program.targetIds])],
        requiresDecision: requiresPlayerDecision, visibility: 'player',
      },
      reason: 'Le résultat autonome est rattaché à la chronologie du dossier.', visibility: 'player',
    },
  ];
}

function strategicSectorInText(state: WorldState, countryId: CountryId, intent: string) {
  const normalized = normalize(intent);
  const sectorKeyword = /semi.?conduct|puce|electron/.test(normalized) ? 'semiconductors'
    : /nucleaire/.test(normalized) ? 'nuclear'
      : /engrais/.test(normalized) ? 'fertilizers'
        : /acier/.test(normalized) ? 'specialty_steel'
          : /pharma/.test(normalized) ? 'pharmaceuticals'
            : /chantier naval|naval/.test(normalized) ? 'shipbuilding'
              : /telecom/.test(normalized) ? 'telecoms'
                : /machine outil/.test(normalized) ? 'machine_tools'
                  : /armement|defense/.test(normalized) ? 'defense' : undefined;
  return sectorKeyword
    ? Object.values(state.sectors).find((item) => item.countryId === countryId && item.sector === sectorKeyword)
    : undefined;
}

function effectsFor(state: WorldState, category: CommonActionCategory, lever: CommonActionLever, targetId?: CountryId, intent = '', reformIntent?: StructuredReformIntent) {
  const player = state.countries[state.playerCountryId];
  const economy = state.macroEconomies[player.id];
  const success: WorldEffect[] = [];
  const partial: WorldEffect[] = [];
  const recurringCost = (amount: number, reason: string): WorldEffect => ({ kind: 'fiscal_delta', countryId: player.id, bucket: 'recurring_costs', delta: amount, reason });
  const recurringSaving = (amount: number, reason: string): WorldEffect => ({ kind: 'fiscal_delta', countryId: player.id, bucket: 'recurring_savings', delta: amount, reason });
  if (category === 'diplomacy' && targetId) {
    // Une initiative n'est pas un accord. Les relations, le renseignement ou
    // un traité ne changent qu'après une réponse étrangère puis une signature
    // dans le vrai canal diplomatique. Sans cela, le programme faisait gagner
    // artificiellement la négociation avant même qu'un pays ait parlé.
  }
  if (category === 'economic' && economy) {
    if (lever === 'fiscal_stimulus') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 18, publicInvestmentPctGdp: 0.4 }, reason: 'La relance augmente durablement l’impulsion budgétaire et l’investissement public.' }, recurringCost(3.5, 'La relance crée un engagement annuel de dépenses jusqu’à décision contraire.'));
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 7, publicInvestmentPctGdp: 0.15 }, reason: 'La relance n’est mise en œuvre que partiellement.' }, recurringCost(1.4, 'La relance partielle crée un engagement annuel de dépenses réduit.'));
    } else if (lever === 'fiscal_consolidation') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: -16, publicInvestmentPctGdp: -0.15 }, reason: 'La consolidation réduit l’impulsion budgétaire et, avec délai, le besoin de financement.' }, recurringSaving(3, 'La consolidation dégage une économie annuelle durable tant que la réforme est maintenue.'));
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: -6 }, reason: 'L’effort budgétaire reste limité par les résistances politiques.' }, recurringSaving(1, 'La consolidation partielle dégage une économie annuelle limitée.'));
    } else if (lever === 'trade_promotion') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { tradeOpenness: 3 }, reason: 'Le dispositif facilite durablement la prospection et les débouchés extérieurs.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { tradeOpenness: 1 }, reason: 'Quelques nouveaux débouchés sont ouverts.' });
      if (targetId) success.push({ kind: 'relation_delta', from: player.id, to: targetId, relation: 3, trust: 2, reason: 'La coopération commerciale améliore modestement le canal bilatéral.' });
    } else if (lever === 'energy_resilience') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.2, industrialSupport: 2 }, reason: 'Le programme finance des capacités énergétiques et logistiques ; les approvisionnements restent à contractualiser.' }, recurringCost(1.1, 'Les infrastructures de résilience entraînent un entretien annuel identifié.'));
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.08 }, reason: 'Seule une partie des infrastructures énergétiques est engagée.' }, recurringCost(0.4, 'Les infrastructures partielles entraînent un entretien annuel réduit.'));
    } else if (lever === 'resource_prospection') {
      // La prospection engage bien le domaine économique, mais ses effets
      // matériels sont volontairement nuls : le rapport est la sortie. Le
      // projet extractif ultérieur sera une autre décision du joueur.
    } else if (lever === 'resource_development') {
      success.push(
        { kind: 'aggregate_sector_delta', countryId: player.id, sector: 'extractive', delta: { capacityIndex: 6, productivityIndex: 2, employmentSharePct: 0.15 }, reason: 'Le projet minier accroît la capacité extractive, sa productivité et l’emploi directement mobilisé.' },
        { kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.12, industrialSupport: 1 }, reason: 'L’État finance les accès, le contrôle et l’amorçage industriel du projet extractif.' },
        recurringCost(0.8, 'Le contrôle environnemental, territorial et logistique de la mine crée une charge annuelle.'),
      );
      partial.push(
        { kind: 'aggregate_sector_delta', countryId: player.id, sector: 'extractive', delta: { capacityIndex: 2, productivityIndex: 0.5, employmentSharePct: 0.05 }, reason: 'Un pilote minier limité augmente légèrement la capacité extractive.' },
        recurringCost(0.3, 'Le pilote minier crée une charge annuelle limitée de surveillance et de logistique.'),
      );
    } else if (lever === 'electrification') {
      success.push(
        { kind: 'aggregate_sector_delta', countryId: player.id, sector: 'manufacturing', delta: { capacityIndex: 3, productivityIndex: 2 }, reason: 'La modernisation des réseaux et des usages électriques améliore la capacité et la productivité manufacturières.' },
        { kind: 'aggregate_sector_delta', countryId: player.id, sector: 'construction', delta: { capacityIndex: 2, employmentSharePct: 0.12 }, reason: 'Le déploiement des réseaux, bâtiments et équipements électriques soutient la construction.' },
        { kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 1.5, reason: 'L’électrification diffuse renforce le socle industriel national.' },
        { kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.35, industrialSupport: 2 }, reason: 'Le grand plan engage durablement l’investissement public et la politique industrielle.' },
        recurringCost(1.6, 'Les réseaux et dispositifs du plan d’électrification créent une charge annuelle d’exploitation.'),
      );
      partial.push(
        { kind: 'aggregate_sector_delta', countryId: player.id, sector: 'manufacturing', delta: { capacityIndex: 1, productivityIndex: 0.6 }, reason: 'Une première tranche du plan modernise une partie de l’appareil productif.' },
        { kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.12, industrialSupport: 0.7 }, reason: 'Le plan d’électrification reste limité à quelques investissements prioritaires.' },
        recurringCost(0.6, 'La première tranche du plan crée une charge annuelle réduite.'),
      );
    } else if (lever === 'strategic_sector') {
      const sector = strategicSectorInText(state, player.id, intent);
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 3, publicInvestmentPctGdp: 0.2 }, reason: 'L’État concentre une part de sa politique industrielle sur une filière stratégique.' }, recurringCost(1.8, 'Le soutien à la filière devient une dépense annuelle tant qu’il est maintenu.'));
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 1 }, reason: 'Le soutien transversal à la filière reste incomplet.' }, recurringCost(0.7, 'Le soutien partiel à la filière reste une dépense annuelle réduite.'));
      if (sector) {
        success.push({ kind: 'sector_delta', sectorId: sector.id, delta: { capacity: 6, health: 5, technology: 2, workloadMonths: 12 }, reason: `La capacité et la maturité de la filière ${sector.sector} progressent ; la nouvelle capacité est absorbée par un programme de douze mois.` });
        partial.push({ kind: 'sector_delta', sectorId: sector.id, delta: { health: 2, technology: 0.5, workloadMonths: 6 }, reason: `La filière ${sector.sector} consolide surtout sa santé industrielle avec une charge réduite.` });
      }
    } else if (lever === 'industrial_capacity') {
      success.push(
        { kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 2, reason: 'De nouvelles capacités productives renforcent le tissu industriel.' },
        { kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 4, publicInvestmentPctGdp: 0.25 }, reason: 'La politique industrielle et l’investissement public sont renforcés.' },
        recurringCost(1.4, 'Les nouvelles capacités productives entraînent un soutien public annuel.'),
      );
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 0.7, reason: 'Quelques capacités productives sont consolidées.' }, recurringCost(0.5, 'Les capacités productives partielles entraînent un soutien annuel réduit.'));
    } else {
      const commonFund = /\b(fonds commun|fonds europeen|cofinancement|budget europeen|investissement conjoint|mecanisme de financement|quote part)\b/.test(normalize(intent));
      if (commonFund) {
        success.push(
          { kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 5, publicInvestmentPctGdp: 0.25, industrialSupport: 1.2, tradeOpenness: 1 }, reason: 'La quote-part du fonds commun engage l’économie nationale dans un investissement coordonné et mesurable.' },
          recurringCost(0.9, 'La contribution au fonds commun crée une charge annuelle jusqu’à révision de l’accord.'),
        );
        partial.push(
          { kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 2, publicInvestmentPctGdp: 0.1, industrialSupport: 0.4 }, reason: 'La contribution au fonds commun est amorcée, mais les appels de fonds et les projets restent partiels.' },
          recurringCost(0.35, 'La contribution partielle au fonds commun crée une charge annuelle réduite.'),
        );
      } else {
        success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 4, publicInvestmentPctGdp: 0.1 }, reason: 'Le programme général produit une impulsion économique modérée.' });
        partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 1.5 }, reason: 'L’impulsion économique reste limitée.' });
      }
    }
  }
  if (category === 'institutional' && lever !== 'policy_audit') {
    if (lever === 'national_reform') {
      success.push(...nationalReformEffects(state, intent, 'adopted', state.playerCountryId, reformIntent));
      partial.push(...nationalReformEffects(state, intent, 'partial', state.playerCountryId, reformIntent));
    } else if (lever === 'government_reorganization') {
      success.push(
        { kind: 'leadership_patch', countryId: player.id, patch: { executiveCoordination: clamp((state.leadership[player.id]?.executiveCoordination ?? player.politics.administrativeCompliance) + 3) }, reason: 'Les arbitrages entre l’exécutif et ses services deviennent plus cohérents.' },
      );
      partial.push(
        { kind: 'leadership_patch', countryId: player.id, patch: { executiveCoordination: clamp((state.leadership[player.id]?.executiveCoordination ?? player.politics.administrativeCompliance) + 1) }, reason: 'Quelques circuits d’arbitrage sont clarifiés.' },
      );
    } else if (lever === 'anti_corruption') {
      success.push(
        { kind: 'politics_patch', countryId: player.id, patch: { administrativeCompliance: clamp(player.politics.administrativeCompliance + 3) }, reason: 'La mise en conformité renforce l’exécution des décisions.' },
        recurringSaving(0.8, 'La réduction des fuites et irrégularités dégage une économie annuelle durable.'),
      );
      partial.push({ kind: 'politics_patch', countryId: player.id, patch: { administrativeCompliance: clamp(player.politics.administrativeCompliance + 1) }, reason: 'Les contrôles améliorent ponctuellement la conformité.' }, recurringSaving(0.25, 'Les contrôles partiels dégagent une économie annuelle limitée.'));
    } else {
      success.push(
        { kind: 'politics_patch', countryId: player.id, patch: { administrativeCompliance: clamp(player.politics.administrativeCompliance + 3) }, reason: 'Les procédures modernisées améliorent l’exécution administrative.' },
      );
      partial.push(
        { kind: 'politics_patch', countryId: player.id, patch: { administrativeCompliance: clamp(player.politics.administrativeCompliance + 1) }, reason: 'Un premier ensemble de procédures est effectivement simplifié.' },
      );
    }
  }
  if (category === 'defense') {
    const defenseSector = Object.values(state.sectors).find((item) => item.countryId === player.id && item.sector === 'defense');
    if (lever === 'defense_industry' && defenseSector) {
      success.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { capacity: 6, health: 5, technology: 1 }, reason: 'La base industrielle de défense gagne en capacité et en robustesse.' }, recurringCost(1.5, 'Le soutien à la base industrielle de défense devient une dépense annuelle.'));
      partial.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { health: 2 }, reason: 'La base industrielle de défense est seulement consolidée.' }, recurringCost(0.5, 'Le soutien industriel partiel devient une dépense annuelle réduite.'));
    } else if (lever === 'defense_procurement') {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 2.5, reason: 'Les nouveaux équipements améliorent la préparation militaire avec un délai industriel.' }, recurringCost(1.6, 'Les équipements acquis créent un coût annuel de maintien en condition.'));
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 0.8, reason: 'Une partie seulement des équipements est disponible.' }, recurringCost(0.6, 'Les équipements partiellement livrés créent un coût annuel réduit.'));
      if (defenseSector) success.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { workloadMonths: 12, health: 1 }, reason: 'La commande alimente le carnet de l’industrie de défense.' });
    } else if (lever === 'force_deployment') {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 1.5, reason: 'Le déploiement améliore temporairement la posture stratégique.' });
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 0.4, reason: 'Le déploiement reste incomplet.' });
    } else {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 4, reason: 'L’entraînement et la préparation améliorent la disponibilité des forces.' });
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 1.5, reason: 'La préparation des forces progresse partiellement.' });
    }
  }
  if (category === 'intelligence' && targetId) {
    if (targetId === player.id) {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 2, reason: 'La mission intérieure améliore la détection et la prévention des menaces.' });
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 0.7, reason: 'La mission intérieure fournit des signaux utiles mais incomplets.' });
    } else {
      success.push({ kind: 'intelligence_delta', observerId: player.id, targetId, delta: 18, reason: 'Le recueil ciblé améliore la connaissance de cet État.' });
      partial.push({ kind: 'intelligence_delta', observerId: player.id, targetId, delta: 7, reason: 'Le recueil fournit quelques indications, sans tableau complet.' });
    }
  }
  return { success, partial };
}

/** Prépare une action à partir du texte, sans modifier le monde ni engager de ressource. */
export function prepareCommonAction(
  state: WorldState,
  text: string,
  options: CommonActionPreparationOptions = {},
): CommonActionPreparation {
  const intent = text.trim();
  if (intent.length < 12) return { ok: false, error: 'Décrivez une intention un peu plus précise avant de la lancer.' };
  const inferredCategory = inferCategory(intent);
  const economicCue = /\b(prospect\w*|gisement\w*|minerai\w*|ressourc\w* minier\w*|orpaillage|inventaire geologique|potentiel geologique|mine\w*|extraction|exploitat\w*|fonds commun|fonds europeen|cofinancement|budget europeen|investissement conjoint|quote part)\b/.test(normalize(intent));
  const category = options.reformIntent || options.policyDomain
    ? 'institutional'
    : ['institutional', 'diplomacy'].includes(options.category ?? '') && inferredCategory === 'economic' && economicCue
      ? 'economic'
      : options.category ?? inferredCategory;
  if (!category) return { ok: false, error: 'Le moteur ne reconnaît pas encore le domaine de cette intention. Précisez s’il s’agit de diplomatie, d’économie, d’administration, de défense ou de renseignement.' };
  const inferredTargetId = options.targetId ?? targetInText(state, intent);
  const player = state.countries[state.playerCountryId];
  const targetId = inferredTargetId === player.id && category !== 'diplomacy' && category !== 'intelligence'
    ? undefined
    : inferredTargetId;
  const requiresTarget = category === 'diplomacy' || category === 'intelligence';
  if (requiresTarget && !targetId) {
    return { ok: false, error: 'Cette action doit nommer un pays modélisé : le moteur refuse de simuler un interlocuteur indéterminé.' };
  }
  const leverProfile = options.reformIntent
    ? actionLeverProfiles.national_reform
    : options.policyDomain
      ? actionLeverProfiles.policy_audit
      : actionLeverProfile(category, intent);
  const projectPlanResult = leverProfile.lever === 'resource_development'
    ? territorialProjectPlanForIntent(state, player.id, intent)
    : undefined;
  if (projectPlanResult && !projectPlanResult.ok) return { ok: false, error: projectPlanResult.error };
  const projectPlan = projectPlanResult?.ok ? projectPlanResult.plan : undefined;
  const prospectionSubject = ['policy_audit', 'resource_prospection'].includes(leverProfile.lever)
    ? territorialResourceSubject(state, player.id, intent)
    : undefined;
  const politicalProfile = actionLeverPolitics[leverProfile.lever];
  const reformOption = leverProfile.lever === 'national_reform'
    ? options.reformIntent ? reformOptionForStructuredIntent(options.reformIntent) : reformOptionForText(intent)
    : undefined;
  const governmentCapacityAssessment = assessGovernmentCapacityForAction(
    state, player.id, category, politicalProfile.administrativeComplexity,
  );
  const territorialScaleFactor = projectPlan?.scale === 'pilot'
    ? 0.55
    : projectPlan?.scale === 'industrial'
      ? 1.45
      : 1;
  const durationMonths = Math.max(1, Math.round((reformOption?.durationMonths ?? leverProfile.durationMonths) * governmentCapacityAssessment.durationMultiplier * (projectPlan?.scale === 'pilot' ? 0.72 : projectPlan?.scale === 'industrial' ? 1.25 : 1)));
  const budgetCost = Number(((reformOption?.budgetCost ?? leverProfile.budgetCost) * governmentCapacityAssessment.budgetMultiplier * territorialScaleFactor).toFixed(1));
  const detectedDecisionRoute = actionDecisionRouteFor(category, leverProfile.lever, intent, durationMonths, budgetCost);
  // Le modèle parlementaire détaillé est actuellement celui de la France.
  // Pour un autre pays, ne pas afficher un vote qui ne pourrait pas être
  // simulé : l'action reste exécutive jusqu'à ce que son institutionnel soit
  // modélisé, au lieu de promettre une étape fantôme.
  const decisionRoute = detectedDecisionRoute === 'parliament' && !state.nationalPolitics?.[player.id]
    ? 'executive' as const
    : detectedDecisionRoute;
  const scope = actionScopeFor(category, targetId, intent);
  const linkedHistoricalAnchorId = options.linkedDossierId
    ? state.strategicDossiers[options.linkedDossierId]?.relatedAnchorId
    : undefined;
  const requiredCapacities = leverProfile.requiredCapacities;
  const overloaded = requiredCapacities.some(({ domain, commitment }) => player.capacities[domain].committed + commitment > player.capacities[domain].maximum);
  const relation = targetId ? relationBetween(state, player.id, targetId) : undefined;
  const requiredAuthority = decisionRoute === 'parliament'
    ? 'legislative' as const
    : decisionRoute === 'intelligence_services' || decisionRoute === 'executive'
      ? decisionRoute === 'intelligence_services' ? 'administrative' as const : 'executive' as const
      : 'executive' as const;
  const politicalPathway = evaluatePoliticalPathway(state, player.id, {
    requiredAuthority,
    doctrine: politicalProfile.doctrine,
    publicSalience: politicalProfile.publicSalience,
    administrativeComplexity: politicalProfile.administrativeComplexity,
  });
  const politicalEvaluation = evaluateStrategicAction(state, {
    id: `prepared-${leverProfile.lever}`,
    actorId: player.id,
    label: leverProfile.label,
    kind: categoryKinds[category],
    outcomes: politicalProfile.outcomes,
    signals: politicalProfile.decisionSignals,
    doctrine: politicalProfile.doctrine,
    requiredAuthority,
    publicSalience: politicalProfile.publicSalience,
    administrativeComplexity: politicalProfile.administrativeComplexity,
    urgency: politicalProfile.urgency,
    risk: politicalProfile.risk,
    resourceCost: clamp(budgetCost * 5),
    metadata: { timeHorizonYears: durationMonths / 12 },
  });
  // La conformité administrative est déjà intégrée à la capacité de l'État et
  // à la voie politique : ne pas la compter une troisième fois ici.
  const base = 78;
  const relationFactor = category === 'diplomacy' && relation ? (relation.relation - 50) * 0.18 : 0;
  const politicalModifier = (politicalEvaluation.leaderDisposition - 50) * 0.1
    + (politicalEvaluation.apparatusSupport - 50) * 0.12
    + (politicalEvaluation.institutionalFeasibility - 50) * 0.16
    + clamp(politicalEvaluation.finalScore, -40, 40) * 0.12
    - (politicalEvaluation.blocked ? 22 : 0);
  const reformSupport = reformOption ? nationalReformSupport(state, reformOption.domain, reformOption.targetPosition) : undefined;
  const reformModifier = reformSupport ? (reformSupport.score - 50) * 0.34 : 0;
  const successProbability = Math.round(clamp(base + relationFactor + leverProfile.difficultyModifier + politicalModifier + reformModifier + governmentCapacityAssessment.successModifier - (overloaded ? 20 : 0), 12, 92));
  const warnings: string[] = [];
  if (overloaded) warnings.push('Les moyens engagés dépassent une capacité opérationnelle : le risque d’échec augmente fortement.');
  if (targetId && relation && relation.relation < 35) warnings.push(`La relation avec ${state.countries[targetId]?.name} rend l’initiative politiquement difficile.`);
  if (politicalEvaluation.blocked) warnings.push('La majorité, l’appareil ou une ligne rouge bloque actuellement la mise en œuvre normale : l’initiative a une probabilité très faible sans travail politique préalable.');
  else if (politicalEvaluation.apparatusSupport < 42) warnings.push('L’appareil politique soutient peu cette orientation et peut ralentir son exécution.');
  if (politicalEvaluation.leaderDisposition < 42) warnings.push('La direction effective est personnellement réticente à ce levier.');
  if (governmentCapacityAssessment.score < 50) warnings.push(`L’appareil d’État dispose d’une capacité limitée pour cette action (${governmentCapacityAssessment.score}/100) : délais et coûts augmentent.`);
  const limitingGovernmentScore = governmentCapacityAssessment.limitingDimension
    ? governmentCapacityAssessment.dimensions[governmentCapacityAssessment.limitingDimension]
    : undefined;
  if (governmentCapacityAssessment.limitingDimension && limitingGovernmentScore !== undefined && limitingGovernmentScore < 45) {
    warnings.push(`${governmentCapacityDimensionLabel(governmentCapacityAssessment.limitingDimension)} est le principal point faible (${Math.round(limitingGovernmentScore)}/100).`);
  }
  if (governmentCapacityAssessment.structuralModifierEffects && governmentCapacityAssessment.structuralModifierIds?.length) {
    warnings.push('Des tensions nationales influencent cette décision ; leur effet est déjà intégré au coût, au délai et à la probabilité affichés.');
  }
  if (leverProfile.lever === 'energy_resilience') warnings.push('Ce programme développe la résilience et les infrastructures ; constituer un stock physique exige encore un contrat d’approvisionnement distinct.');
  if (leverProfile.lever === 'policy_audit' || leverProfile.lever === 'resource_prospection') warnings.push(prospectionSubject
    ? 'La prospection produit une preuve structurée de décision. Elle n’ouvre aucune mine ni aucun site et n’engage aucun investissement extractif : cette suite restera un choix du joueur.'
    : leverProfile.lever === 'resource_prospection'
      ? 'La prospection est chiffrée comme une étude économique générale. Pour un rapport territorial exploitable, nommez une ressource et un territoire contrôlé présents sur la carte.'
      : 'L’audit produit une base publique de décision. Il ne dépose ni n’adopte la réforme éventuellement envisagée : cette suite restera un choix du joueur.');
  if (reformSupport) warnings.push(...reformSupport.obstacles);
  if (leverProfile.lever === 'strategic_sector' && !strategicSectorInText(state, player.id, intent)) warnings.push('La filière demandée n’a pas encore de registre sectoriel détaillé : seuls les effets transversaux seront appliqués.');
  const effects = effectsFor(state, category, leverProfile.lever, targetId, intent, options.reformIntent);
  const operation = category === 'diplomacy' ? diplomaticOperation(intent) : undefined;
  const intentSpec = actionIntentFromProgram(
    { actorId: player.id, targetIds: targetId ? [targetId] : [], category, lever: leverProfile.lever, intent },
    options.source ?? 'player', operation,
  );
  if (options.requestId) intentSpec.requestId = options.requestId;
  return {
    ok: true,
    warnings,
    action: {
      category,
      lever: leverProfile.lever,
      actorId: player.id,
      targetIds: targetId ? [targetId] : [],
      ...(options.linkedDossierId ? { linkedDossierId: options.linkedDossierId } : {}),
      ...(linkedHistoricalAnchorId ? { historicalIntent: options.historicalIntent ?? 'contain' } : {}),
      title: reformOption?.title
        ?? (leverProfile.lever === 'policy_audit' && options.policyDomain
          ? `Audit public · ${nationalReformProfiles[options.policyDomain].label}`
          : ['policy_audit', 'resource_prospection'].includes(leverProfile.lever) && prospectionSubject
            ? `Prospection · ${prospectionSubject.resource} · ${prospectionSubject.territoryName}`
            : projectPlan
              ? `Mine pilote ${projectPlan.resource === 'or' ? 'd’or' : `de ${projectPlan.resource}`} · ${projectPlan.territoryName}`
            : leverProfile.lever === 'economic_general' && /\b(fonds commun|fonds europeen|cofinancement|budget europeen|investissement conjoint|mecanisme de financement|quote part)\b/.test(normalize(intent))
              ? 'Fonds européen commun'
            : `${leverProfile.label}${targetId ? ` avec ${state.countries[targetId]?.name}` : ''}`),
      intent,
      ...(options.reformIntent ? {
        reformIntent: options.reformIntent,
        reformBaseline: nationalReformSnapshot(state, options.reformIntent.domain, player.id),
      } : {}),
      ...(options.policyDomain ? { policyDomain: options.policyDomain } : {}),
      ...(projectPlan ? { territorialProjectPlan: projectPlan } : {}),
      durationMonths,
      requiredCapacities,
      budgetCost,
      successProbability,
      risks: warnings.length ? warnings : ['Les oppositions, délais d’exécution ou aléas extérieurs peuvent réduire l’effet attendu.'],
      policySignals: [
        ...politicalProfile.policySignals,
        ...(leverProfile.lever === 'national_reform'
          ? options.reformIntent ? reformPolicySignalsForIntent(options.reformIntent) : reformPolicySignals(intent)
          : []),
        ...(leverProfile.lever === 'energy_resilience' && /\b(gaz|petrole|fossile)\b/.test(normalize(intent))
          ? [{ signal: 'fossil_expansion' as const, weight: 0.65 }] : []),
      ],
      politicalAssessment: {
        pathwayStatus: politicalPathway.status,
        requiredAuthority,
        doctrineCompatibility: politicalEvaluation.doctrineCompatibility,
        institutionalFeasibility: politicalEvaluation.institutionalFeasibility,
        leaderDisposition: politicalEvaluation.leaderDisposition,
        apparatusSupport: politicalEvaluation.apparatusSupport,
        finalScore: politicalEvaluation.finalScore,
        blocked: politicalEvaluation.blocked,
        reasons: politicalEvaluation.reasons.slice(0, 6),
      },
      governmentCapacityAssessment,
      // Un projet territorial calcule ses effets terminaux depuis l’état réel
      // du site. Ne pas afficher les effets génériques en parallèle évite de
      // promettre une production qui ne correspondrait plus aux arbitrages.
      successEffects: projectPlan ? [] : effects.success,
      partialEffects: projectPlan ? [] : effects.partial,
      intentSpec,
      decisionRoute,
      scope,
      impactPreview: ['policy_audit', 'resource_prospection'].includes(leverProfile.lever)
        ? auditImpactPreview(state, player.id, durationMonths, intent)
        : projectPlan
          ? territorialProjectImpactPreview(projectPlan, durationMonths)
        : impactPreviewFor(effects, scope, durationMonths),
    },
  };
}

/**
 * Une délégation est une vraie action, mais elle engage moins directement le
 * gouvernement. Elle coûte moins, consomme moins de moyens et agit plus
 * lentement ; son influence sur un ancrage historique est donc réduite.
 */
export function prepareDossierDelegation(state: WorldState, dossierId: string, decision: string): CommonActionPreparation {
  const dossier = state.strategicDossiers[dossierId];
  if (!dossier) return { ok: false, error: 'Dossier introuvable.' };
  const prepared = prepareCommonAction(
    state,
    `Déléguer à l’administration le traitement du dossier « ${dossier.title} » : ${decision}`,
    { source: 'player', linkedDossierId: dossierId, category: 'institutional', historicalIntent: 'contain' },
  );
  if (!prepared.ok) return prepared;
  const historical = Boolean(dossier.relatedAnchorId);
  const action: PreparedCommonAction = {
    ...prepared.action,
    title: `Délégation administrative · ${dossier.title}`,
    // La délégation reste un chemin lent même lorsque les modificateurs
    // structurels rendent l'administration efficace : elle ne doit pas
    // devenir plus rapide qu'une action directe par simple effet de moyenne.
    durationMonths: Math.max(7, prepared.action.durationMonths + 1),
    budgetCost: Number((prepared.action.budgetCost * 0.6).toFixed(1)),
    successProbability: Math.round(clamp(prepared.action.successProbability - 14, 20, 86)),
    requiredCapacities: prepared.action.requiredCapacities.map(({ domain, commitment }) => ({ domain, commitment: Math.max(1, Math.round(commitment * 0.6)) })),
    ...(historical ? { historicalContributionScale: 0.55 } : {}),
    risks: [...prepared.action.risks, 'La délégation réduit le coût politique immédiat, mais laisse moins de prise sur la trajectoire historique.'],
  };
  return { ok: true, action, warnings: [...prepared.warnings, 'Délégation : moyens et coût réduits, résultat plus lent et moins certain.'] };
}

function confirmationFingerprint(program: Pick<ActionProgram, 'actorId' | 'category' | 'lever' | 'targetIds' | 'territorialAssetId' | 'linkedDossierId' | 'intent'>) {
  return [
    program.actorId,
    program.category,
    program.lever ?? '',
    [...(program.targetIds ?? [])].map(String).sort().join(','),
    program.territorialAssetId ?? '',
    normalize(program.intent).replace(/\s+/g, ' '),
  ].join('|');
}

/**
 * Revalide une préparation au moment précis de la confirmation. Une fiche de
 * préparation peut rester ouverte plusieurs mois : l'acteur, la voie
 * institutionnelle et les capacités disponibles ne doivent donc pas être
 * considérés comme immuables entre-temps.
 */
function validatePreparedActionAtConfirmation(state: WorldState, prepared: PreparedCommonAction) {
  if (prepared.actorId !== state.playerCountryId) {
    return { ok: false as const, error: 'Cette action appartient à un autre pays : elle ne peut pas être confirmée depuis la partie en cours.' };
  }
  if (!prepared.intent?.trim() || prepared.intent.trim().length < 12) {
    return { ok: false as const, error: 'L’intention de cette action est vide ou trop courte : préparez-la à nouveau.' };
  }
  if (!Number.isInteger(prepared.durationMonths) || prepared.durationMonths < 1 || prepared.durationMonths > 240) {
    return { ok: false as const, error: 'La durée préparée n’est plus valide : préparez cette action à nouveau.' };
  }
  if (!Number.isFinite(prepared.budgetCost) || prepared.budgetCost < 0 || prepared.budgetCost > 1_000_000) {
    return { ok: false as const, error: 'Le coût préparé n’est plus valide : préparez cette action à nouveau.' };
  }
  if (!Number.isFinite(prepared.successProbability) || prepared.successProbability < 0 || prepared.successProbability > 100) {
    return { ok: false as const, error: 'La probabilité préparée n’est plus valide : préparez cette action à nouveau.' };
  }
  const unknownTarget = (prepared.targetIds ?? []).find((id) => !state.countries[id]);
  if (unknownTarget) return { ok: false as const, error: `L’interlocuteur « ${unknownTarget} » n’existe plus dans cette sauvegarde : préparez l’action à nouveau.` };
  const invalidCapacity = (prepared.requiredCapacities ?? []).find((item) => {
    const capacity = state.countries[state.playerCountryId]?.capacities[item.domain];
    return !capacity || !Number.isFinite(item.commitment) || item.commitment < 0;
  });
  if (invalidCapacity) return { ok: false as const, error: 'Une capacité requise n’est plus disponible dans cette sauvegarde : préparez l’action à nouveau.' };

  const politicalProfile = prepared.lever ? actionLeverPolitics[prepared.lever] : undefined;
  const detectedRoute = actionDecisionRouteFor(
    prepared.category,
    prepared.lever ?? 'administrative_reform',
    prepared.intent,
    prepared.durationMonths,
    prepared.budgetCost,
  );
  const currentRoute = detectedRoute === 'parliament' && !state.nationalPolitics?.[state.playerCountryId]
    ? 'executive' as const
    : detectedRoute;
  if (prepared.decisionRoute && prepared.decisionRoute !== currentRoute) {
    return { ok: false as const, error: 'Le circuit institutionnel a changé depuis la préparation. Préparez à nouveau cette action pour afficher la bonne validation.' };
  }
  const currentGovernment = assessGovernmentCapacityForAction(
    state,
    state.playerCountryId,
    prepared.category,
    politicalProfile?.administrativeComplexity ?? 50,
  );
  const preparedGovernment = prepared.governmentCapacityAssessment;
  const confirmationWarnings: string[] = [];
  if (preparedGovernment && Math.abs(currentGovernment.score - preparedGovernment.score) >= 12) {
    confirmationWarnings.push(`La capacité de l’État a évolué depuis la préparation (${preparedGovernment.score} → ${currentGovernment.score}/100).`);
  }
  const newlyOverloaded = (prepared.requiredCapacities ?? []).some(({ domain, commitment }) => {
    const capacity = state.countries[state.playerCountryId].capacities[domain];
    return capacity.committed + commitment > capacity.maximum;
  });
  if (newlyOverloaded && !prepared.risks.some((risk) => risk.includes('capacité opérationnelle'))) {
    confirmationWarnings.push('Les moyens disponibles sont maintenant saturés ; l’action reste possible, mais son risque augmente.');
  }
  return { ok: true as const, currentRoute, currentGovernment, confirmationWarnings };
}

/** Engage le programme préparé. Les effets ne sont appliqués qu'à sa résolution. */
export function launchCommonAction(state: WorldState, prepared: PreparedCommonAction) {
  const player = state.countries[prepared.actorId];
  if (!player) return { ok: false as const, state, error: 'État acteur introuvable.' };
  const confirmation = validatePreparedActionAtConfirmation(state, prepared);
  if (!confirmation.ok) return { ok: false as const, state, error: confirmation.error };
  if (prepared.territorialProjectPlan) {
    const projectValidation = validateTerritorialProjectPlan(state, prepared.actorId, prepared.territorialProjectPlan);
    if (!projectValidation.ok) return { ok: false as const, state, error: projectValidation.error };
  }
  const fingerprint = confirmationFingerprint(prepared);
  const duplicate = Object.values(state.actionPrograms ?? {}).find((item) =>
    ['active', 'pending_parliament'].includes(item.status)
    && confirmationFingerprint(item) === fingerprint,
  );
  if (duplicate) {
    return { ok: false as const, state, error: `Cette décision est déjà engagée (« ${duplicate.title} »). Le double lancement a été bloqué.` };
  }
  if (prepared.territorialAssetId) {
    const asset = state.territorial.assets[prepared.territorialAssetId];
    if (!asset || state.territorial.territories[asset.territoryId]?.sovereignCountryId !== prepared.actorId)
      return { ok: false as const, state, error: 'Le contrôle territorial a changé ; cette action doit être préparée à nouveau.' };
    if (Object.values(state.actionPrograms).some((item) => item.territorialAssetId === asset.id && ['active', 'pending_parliament'].includes(item.status)))
      return { ok: false as const, state, error: 'Une opération est déjà engagée sur cet actif.' };
  }
  const budgetBucket = prepared.emergencyCapacitySupport ? 'emergency_reserve' as const : 'discretionary' as const;
  const budgetAvailable = fiscalBudgetAvailable(player, budgetBucket);
  const programBase: ActionProgram = {
    ...prepared,
    id: `program-${prepared.category}-${String(state.sequence + 1).padStart(6, '0')}`,
    startedAt: state.currentDate,
    expectedCompletionAt: addMonths(state.currentDate, prepared.durationMonths),
    progressMonths: 0,
    status: 'active',
    confirmedAt: state.currentDate,
    budgetStatus: 'consumed',
    budgetConsumedAt: state.currentDate,
    resourceStatus: 'committed',
    resourcesCommittedAt: state.currentDate,
    risks: [
      ...prepared.risks,
      ...confirmation.confirmationWarnings,
    ],
  };
  if (programBase.territorialProjectPlan) {
    programBase.territorialProjectId = `territorial-${programBase.id}`;
  }
  programBase.linkedDossierId ??= programBase.category === 'diplomacy' && programBase.targetIds[0]
    ? `diplomatic-${programBase.actorId}-${programBase.targetIds[0]}-${diplomaticOperation(programBase.intent)}`
    : programBase.category === 'intelligence' && programBase.targetIds[0]
      ? `intelligence-mission-${programBase.actorId}-${programBase.targetIds[0]}`
      : programBase.militaryOperation && militaryTheaterDossier(state, programBase.militaryOperation)?.kind === 'dossier_add'
        ? `military-theater-${programBase.militaryOperation.targetTheaterId}` : `decision-${programBase.id}`;
  programBase.geopoliticalReaction = scheduleGeopoliticalReaction(state, programBase);
  const procedureRequired = requiresParliamentaryProcedure(programBase);
  const procedure = procedureRequired ? createParliamentaryProcedure(state, programBase) : null;
  if (procedureRequired && !procedure) {
    return { ok: false as const, state, error: 'La validation parlementaire est requise, mais l’institution n’est pas disponible dans cette sauvegarde. Préparez à nouveau l’action.' };
  }
  // Une décision soumise au Parlement n’engage ni budget ni moyens avant le
  // vote. Tous les programmes ont un financement explicite : l'urgence passe
  // par le module de réserve, jamais par un déficit invisible.
  if (!procedure && budgetAvailable < prepared.budgetCost) {
    return { ok: false as const, state, error: `${budgetBucket === 'emergency_reserve' ? 'Réserve d’urgence' : 'Marge discrétionnaire'} insuffisante : ${prepared.budgetCost.toFixed(1)} nécessaires, ${budgetAvailable.toFixed(1)} disponibles.` };
  }
  const program: ActionProgram = procedure
    ? {
      ...programBase,
      status: 'pending_parliament',
      parliamentaryProcessId: procedure.id,
      expectedCompletionAt: addMonths(procedure.voteAt, programBase.durationMonths),
      budgetStatus: 'not_committed',
      budgetConsumedAt: undefined,
      resourceStatus: 'not_committed',
      resourcesCommittedAt: undefined,
    }
    : programBase;
  const territorialProject = createTerritorialProject(state, program);
  if (procedure) {
    const effects: WorldEffect[] = [
      { kind: 'action_program_add', program, reason: 'Le programme est déposé et attend le vote ; aucun moyen n’est encore engagé.' },
      ...(territorialProject ? [{ kind: 'territorial_project_add' as const, project: territorialProject, reason: 'Le projet territorial est enregistré avec sa preuve, ses risques et son territoire.' }] : []),
      { kind: 'parliamentary_procedure_add', countryId: program.actorId, procedure, reason: 'Une procédure parlementaire est ouverte pour le texte préparé.', visibility: 'player' },
      // Une action préparée depuis un dossier diplomatique prolonge ce fil.
      // Créer ici un « Canal diplomatique » parallèle faisait coexister deux
      // dossiers pour la même démarche et cassait sa continuité.
      ...(program.intentSpec?.kind === 'common_program' && program.category === 'diplomacy' && program.targetIds[0] && !program.linkedDossierId
        ? [diplomaticDossier(state, program.targetIds[0], program.intentSpec.operation ?? 'contact', program.intent)] : []),
      ...(program.policySignals?.length ? stakeholderReactionEffects(state, {
        id: `measure-${program.id}`,
        countryId: program.actorId,
        title: program.title,
        subjectId: program.linkedDossierId ?? `program:${program.lever ?? program.category}`,
        intensity: clamp(32 + program.budgetCost * 1.5, 28, 72),
        gravity: program.gravity,
        territorialAssetId: program.territorialAssetId,
        signals: program.policySignals,
        effects: [],
      }) : []),
    ];
    return {
      ok: true as const,
      state: attachProgramDossier(commitWorldAction(state, {
        kind: 'political', actorId: program.actorId, targetIds: program.targetIds, origin: 'player',
        intent: `Déposer : ${program.title}`,
        effects,
        assumptions: [`Confirmation joueur le ${program.confirmedAt}.`, `Parcours : exécutif puis validation parlementaire · commission à partir du ${procedure.committeeAt} · vote à partir du ${procedure.voteAt}.`, `Projection initiale : ${procedure.estimatedVotes}/${procedure.majorityThreshold} voix. Aucun effet matériel avant la décision.`],
        ...(program.linkedDossierId ? { metadata: { linkedDossierId: program.linkedDossierId } } : {}),
      }), program.id),
      programId: program.id,
      parliamentaryProcessId: procedure.id,
    };
  }
  const effects: WorldEffect[] = [
    { kind: 'action_program_add', program, reason: 'Le gouvernement engage le programme et en conserve les paramètres de résolution.' },
    ...(territorialProject ? [{ kind: 'territorial_project_add' as const, project: territorialProject, reason: 'Le projet territorial est enregistré avec sa preuve, ses risques et son territoire.' }] : []),
    { kind: 'fiscal_delta', countryId: program.actorId, bucket: program.emergencyCapacitySupport ? 'emergency_reserve' : 'discretionary', delta: -program.budgetCost, reason: program.emergencyCapacitySupport ? 'La réserve d’urgence finance le renfort temporaire.' : 'La marge discrétionnaire finance le lancement et la coordination du programme.' },
    ...(program.capacityDevelopment?.politicalCost
      ? [{ kind: 'metric_delta' as const, countryId: program.actorId, metric: 'stability' as const, delta: -program.capacityDevelopment.politicalCost, reason: `La transition de « ${program.title} » mobilise des intérêts établis et crée un coût politique explicite.` }]
      : []),
    ...(program.emergencyCapacitySupport
      ? [{ kind: 'capacity_maximum' as const, countryId: program.actorId, domain: program.emergencyCapacitySupport.domain, delta: program.emergencyCapacitySupport.temporaryBoost, reason: `Le financement d’urgence augmente temporairement la capacité ${program.emergencyCapacitySupport.domain}.` }]
      : []),
    ...program.requiredCapacities.map(({ domain, commitment }) => ({ kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: commitment, reason: `Moyens mobilisés pour « ${program.title} » jusqu’à sa résolution.` })),
    ...conflictEscalationEffects(state, program),
    // Même règle hors procédure parlementaire : le dossier ayant déclenché
    // l'action est l'unique mémoire de la négociation et de son exécution.
    ...(program.intentSpec?.kind === 'common_program' && program.category === 'diplomacy' && program.targetIds[0] && !program.linkedDossierId
      ? [diplomaticDossier(state, program.targetIds[0], program.intentSpec.operation ?? 'contact', program.intent)] : []),
    ...(program.category === 'intelligence' ? intelligenceMissionDossier(state, program) : []),
    ...(program.policySignals?.length ? stakeholderReactionEffects(state, {
      id: `measure-${program.id}`,
      countryId: program.actorId,
      title: program.title,
      subjectId: program.linkedDossierId ?? `program:${program.lever ?? program.category}`,
      intensity: clamp(42 + program.budgetCost * 2, 35, 88),
      gravity: program.gravity,
      territorialAssetId: program.territorialAssetId,
      signals: program.policySignals,
      effects: [],
    }) : []),
    ...(program.lever === 'national_reform'
      ? [{ kind: 'national_reform_patch' as const, countryId: program.actorId, domain: program.reformIntent?.domain ?? reformDomainFromText(program.intent), patch: { activeProgramId: program.id }, reason: 'La réforme est inscrite comme programme national en cours.', visibility: 'player' as const }]
      : []),
      ...(program.militaryOperation
        ? militaryTheaterReservationEffects(state, { ...program.militaryOperation, programId: program.id })
        .concat(militaryTheaterDossier(state, { ...program.militaryOperation, programId: program.id }) ?? [])
        : []),
    ...portDossierEffects(state, program),
  ];
  return {
    ok: true as const,
    state: attachProgramDossier(commitWorldAction(state, {
      kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
      origin: 'player', intent: `Lancer : ${program.title}`, effects,
      assumptions: [`Confirmation joueur le ${program.confirmedAt}.`, `Parcours : ${program.decisionRoute ?? 'executive'} · effets appliqués uniquement à la résolution vers le ${program.expectedCompletionAt}.`],
      ...(program.linkedDossierId ? { metadata: { linkedDossierId: program.linkedDossierId } } : {}),
    }), program.id),
    programId: program.id,
  };
}

function cancellationDossierEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'id' | 'actorId' | 'targetIds' | 'category' | 'intent' | 'linkedDossierId' | 'title'>,
  summary: string,
): WorldEffect[] {
  const targetId = program.targetIds[0];
  const candidates = [
    program.linkedDossierId,
    program.category === 'diplomacy' && targetId
      ? `diplomatic-${program.actorId}-${targetId}-${diplomaticOperation(program.intent)}`
      : undefined,
    program.category === 'intelligence' && targetId
      ? `intelligence-mission-${program.actorId}-${targetId}`
      : undefined,
  ].filter((id): id is string => Boolean(id));
  const dossierId = candidates.find((id) => Boolean(state.strategicDossiers[id]));
  if (!dossierId) return [];
  const dossier = state.strategicDossiers[dossierId];
  const actorIds = [...new Set([program.actorId, ...program.targetIds])];
  return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { phase: 'Programme interrompu', updatedAt: state.currentDate },
      reason: 'L’annulation est visible dans le dossier au lieu de faire disparaître l’engagement.', visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${program.id}-cancellation`, date: state.currentDate, title: 'Programme interrompu', summary,
        importance: dossier.importance === 'critical' ? 'major' : dossier.importance, actorIds,
        requiresDecision: false, visibility: 'player',
      },
      reason: 'La décision d’interrompre le programme est rattachée à la chronologie du dossier.', visibility: 'player',
    },
  ];
}

/**
 * Interrompt un programme déjà confirmé. Une procédure parlementaire est
 * retirée proprement ; une action déjà lancée conserve ses crédits dépensés,
 * mais libère immédiatement ses capacités et ses éventuels personnels en
 * transit. Un programme de capacité déjà bien avancé conserve une partie
 * modeste de ses acquis matériels : l'abandon n'efface pas une formation ou
 * un outil déjà déployé.
 */
export function cancelCommonAction(state: WorldState, programId: string, reason = 'Interruption décidée par le joueur.') {
  const program = state.actionPrograms?.[programId];
  if (!program) return { ok: false as const, state, error: 'Programme introuvable dans cette sauvegarde.' };
  if (program.actorId !== state.playerCountryId) return { ok: false as const, state, error: 'Seul le pays joué peut interrompre ce programme.' };
  if (program.status !== 'active' && program.status !== 'pending_parliament') {
    return { ok: false as const, state, error: 'Ce programme est déjà résolu ou annulé.' };
  }
  const pendingParliament = program.status === 'pending_parliament';
  const budgetConsumed = program.budgetStatus === 'consumed' || (!pendingParliament && program.budgetStatus === undefined);
  const resourcesCommitted = program.resourceStatus === 'committed' || (!pendingParliament && program.resourceStatus === undefined);
  const completionRatio = program.durationMonths > 0 ? Math.max(0, Math.min(1, program.progressMonths / program.durationMonths)) : 0;
  const retainedCapacity = !pendingParliament && resourcesCommitted && program.capacityDevelopment && completionRatio >= 0.25
    ? Math.max(1, Math.round(program.capacityDevelopment.capacityGain * Math.min(0.4, completionRatio * 0.4)))
    : 0;
  const retainedAnnualCost = retainedCapacity && program.capacityDevelopment
    ? Number((program.capacityDevelopment.annualMaintenanceCost * retainedCapacity / program.capacityDevelopment.capacityGain).toFixed(1))
    : 0;
  const summary = pendingParliament
    ? `${program.title} est retiré avant le vote. Aucun crédit ni moyen n’a été engagé.`
    : `${program.title} est interrompu. Les crédits déjà dépensés ne sont pas remboursés ; les moyens temporaires sont libérés maintenant.${retainedCapacity ? ` Les travaux déjà réalisés laissent +${retainedCapacity} de capacité durable, avec ${retainedAnnualCost.toFixed(1)} crédit${retainedAnnualCost > 1 ? 's' : ''} d’entretien annuel.` : ''}`;
  const effects: WorldEffect[] = [
    {
      kind: 'action_program_patch', programId,
      patch: {
        status: 'cancelled', resolution: summary, cancellationReason: reason,
        budgetStatus: budgetConsumed ? 'consumed' : 'not_committed',
        resourceStatus: resourcesCommitted ? 'released' : 'not_committed',
        ...(resourcesCommitted ? { resourcesReleasedAt: state.currentDate } : {}),
      },
      reason: summary, visibility: 'player',
    },
    ...(program.territorialProjectId && state.territorialProjects?.[program.territorialProjectId]
      ? [{ kind: 'territorial_project_patch' as const, projectId: program.territorialProjectId, patch: {
        status: 'cancelled' as const, phase: 'closed' as const, updatedAt: state.currentDate, pendingDecision: undefined,
      }, reason: summary, visibility: 'player' as const }]
      : []),
  ];
  if (pendingParliament && program.parliamentaryProcessId) {
    effects.push({
      kind: 'parliamentary_procedure_patch', countryId: program.actorId, procedureId: program.parliamentaryProcessId,
      patch: { stage: 'withdrawn', resolution: `${summary} Motif : ${reason}`, summary: `${summary} Motif : ${reason}` },
      reason: 'La procédure parlementaire est retirée explicitement, sans vote fantôme.', visibility: 'player',
    });
  }
  if (resourcesCommitted) {
    effects.push(...program.requiredCapacities.map(({ domain, commitment }) => ({
      kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: -commitment,
      reason: `Les moyens de « ${program.title} » sont libérés après interruption.`, visibility: 'player' as const,
    })));
    if (program.emergencyCapacitySupport) effects.push({
      kind: 'capacity_maximum', countryId: program.actorId, domain: program.emergencyCapacitySupport.domain,
      delta: -program.emergencyCapacitySupport.temporaryBoost,
      reason: `Le renfort temporaire de « ${program.title} » prend fin après interruption.`, visibility: 'player',
    });
    if (retainedCapacity && program.capacityDevelopment) {
      effects.push({
        kind: 'capacity_maximum', countryId: program.actorId, domain: program.capacityDevelopment.domain, delta: retainedCapacity,
        reason: `L’interruption de « ${program.title} » conserve une partie des acquis déjà installés (+${retainedCapacity}).`, visibility: 'player',
      });
      if (retainedAnnualCost > 0) effects.push({
        kind: 'capacity_maintenance_add', countryId: program.actorId, commitment: {
          id: `maintenance-${program.id}`, domain: program.capacityDevelopment.domain, label: `${program.title} (acquis partiels)`,
          annualBudgetCost: retainedAnnualCost, startedAt: state.currentDate,
        }, reason: `Les acquis partiels de « ${program.title} » nécessitent ${retainedAnnualCost.toFixed(1)} crédits d’entretien annuel.`, visibility: 'player',
      });
    }
    if (program.militaryOperation) effects.push(...militaryTheaterCancellationEffects(state, program.militaryOperation));
    if (program.lever === 'national_reform') effects.push({ kind: 'national_reform_patch', countryId: program.actorId, domain: program.reformIntent?.domain ?? reformDomainFromText(program.intent), patch: { activeProgramId: null }, reason: 'La réforme interrompue ne bloque plus le domaine concerné.', visibility: 'player' });
  }
  effects.push(...cancellationDossierEffects(state, program, summary));
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds, origin: 'player',
      intent: `Interrompre : ${program.title}`, effects,
      assumptions: [
        `Décision joueur le ${state.currentDate}.`,
        pendingParliament ? 'Aucun crédit ni moyen n’avait été engagé avant le retrait.' : 'Les crédits de lancement restent consommés ; les capacités temporaires sont libérées immédiatement.',
        `Motif déclaré : ${reason}`,
      ],
      ...(program.linkedDossierId ? { metadata: { linkedDossierId: program.linkedDossierId } } : {}),
    }),
    programId,
  };
}

/** Résolution déterministe : même sauvegarde + même calendrier = même résultat. */
export function advanceCommonActionPrograms(state: WorldState, elapsedMonths: number) {
  if (!Number.isFinite(elapsedMonths) || elapsedMonths <= 0) return state;
  let next = state;
  for (const initialProgram of Object.values(state.actionPrograms ?? {})) {
    if (initialProgram.status !== 'active') continue;
    next = resolveDueGeopoliticalReaction(next, next.actionPrograms[initialProgram.id] ?? initialProgram);
    const program = next.actionPrograms[initialProgram.id] ?? initialProgram;
    if (program.status !== 'active') continue;
    if (territorialProjectBlocksProgress(next, program.territorialProjectId)) continue;
    // Le vote peut avoir autorisé le lancement à cette même frontière : aucun
    // travail ne doit être crédité pour le mois précédant l'autorisation.
    const lastAdvancedAt = program.execution?.lastAdvancedAt && program.execution.lastAdvancedAt > program.startedAt
      ? program.execution.lastAdvancedAt : program.startedAt;
    const availableMonths = Math.max(0, (Date.parse(next.currentDate) - Date.parse(lastAdvancedAt)) / 86400000 / 30.4375);
    const workMonths = Math.min(elapsedMonths, availableMonths);
    if (workMonths <= 0) continue;
    const followUp = programExecutionEffects(next, program, workMonths);
    const progressMonths = Math.min(program.durationMonths, program.progressMonths + workMonths * followUp.assessment.progressRate);
    if (program.territorialProjectId) {
      next = advanceTerritorialProject(next, program.territorialProjectId, program.durationMonths > 0 ? progressMonths / program.durationMonths * 100 : 100);
    }
    // Les durées sont exprimées en mois calendaires. Une frontière comme
    // 1er janvier → 1er juillet peut représenter 5,99 mois en jours moyens ;
    // la date d'échéance reste néanmoins atteinte et doit déclencher la
    // résolution annoncée au joueur.
    const baseCompletionAt = addMonths(program.startedAt, program.durationMonths);
    const projectDelayMonths = program.territorialProjectId ? next.territorialProjects?.[program.territorialProjectId]?.delayMonths ?? 0 : 0;
    const totalDelayMonths = followUp.execution.delayMonths + projectDelayMonths;
    const expectedCompletionAt = new Date(Date.parse(baseCompletionAt) + Math.ceil(totalDelayMonths * 30.4375) * 86400000).toISOString().slice(0, 10) as ActionProgram['expectedCompletionAt'];
    if (territorialProjectBlocksProgress(next, program.territorialProjectId)) {
      next = commitWorldAction(next, {
        kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
        origin: 'time', visibility: 'debug', intent: `Suspendre au jalon territorial : ${program.title}`,
        effects: [{ kind: 'action_program_patch', programId: program.id, patch: {
          progressMonths: Number(progressMonths.toFixed(3)), expectedCompletionAt, execution: followUp.execution,
        }, reason: 'Le programme atteint un jalon matériel puis attend l’arbitrage territorial du joueur.', visibility: 'debug' }, ...followUp.effects],
      });
      continue;
    }
    const reachedExpectedDate = next.currentDate >= expectedCompletionAt;
    // Les retards territoriaux repoussent réellement l'échéance annoncée. Un
    // chantier matériel peut être techniquement terminé avant cette date,
    // mais il ne peut pas produire son effet final avant les jalons ajoutés.
    if (!reachedExpectedDate) {
      next = commitWorldAction(next, {
        kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
        origin: 'time', visibility: 'debug', intent: `Faire avancer : ${program.title}`,
        effects: [{ kind: 'action_program_patch', programId: program.id, patch: { progressMonths: Number(progressMonths.toFixed(3)), expectedCompletionAt, execution: followUp.execution }, reason: progressMonths >= program.durationMonths ? 'Les travaux matériels sont achevés ; les retards cumulés repoussent encore la mise en service.' : 'Le programme progresse selon les résistances et soutiens effectivement présents.', visibility: 'debug' }, ...followUp.effects],
      });
      continue;
    }
    const attempt = followUp.execution.setbackCount ?? 0;
    const roll = seededUnit(next.seed, attempt === 0
      ? `${program.id}:${baseCompletionAt}`
      : `${program.id}:${baseCompletionAt}:attempt-${attempt}`) * 100;
    const probability = followUp.assessment.effectiveSuccessProbability;
    // Une injection de secours n'est pas une réforme aléatoire : les fonds
    // achètent un renfort provisoire qui expire à une date certaine.
    const rolledOutcome = program.emergencyCapacitySupport
      ? 'succeeded' as const
      : roll <= probability ? 'succeeded' : roll <= probability + 14 ? 'partially_succeeded' : 'failed';
    const unattendedTerritorialDecision = program.territorialProjectId
      ? next.territorialProjects?.[program.territorialProjectId]?.pendingDecision
      : undefined;
    // L’incident ne bloque jamais matériellement le chantier. En revanche,
    // terminer sans arbitrage interdit une réussite pleine : les pénalités ont
    // été subies et la capacité livrée reste limitée.
    const outcome = unattendedTerritorialDecision && rolledOutcome === 'succeeded'
      ? 'partially_succeeded' as const
      : rolledOutcome;
    // Un contretemps peut repousser une échéance, mais jamais garder une
    // décision indéfiniment « en cours ». Les missions de connaissance et les
    // réformes obtiennent un seul report ; les autres programmes au plus deux.
    const maximumSetbacks = program.lever === 'national_reform' || program.lever === 'policy_audit' ? 1 : 2;
    if (outcome === 'failed' && attempt < maximumSetbacks) {
      const additionalDelay = Math.max(1, Math.ceil(program.durationMonths * 0.15 + (100 - probability) / 40));
      const delayMonths = Number((followUp.execution.delayMonths + additionalDelay).toFixed(3));
      const delayedCompletionAt = new Date(Date.parse(baseCompletionAt) + Math.ceil(delayMonths * 30.4375) * 86400000).toISOString().slice(0, 10) as ActionProgram['expectedCompletionAt'];
      const setbackSummary = `Contretemps à l’échéance : le résultat n’est pas encore atteint. Le programme reste engagé et son échéance est reportée de ${additionalDelay} mois, au ${delayedCompletionAt}.`;
      const execution = {
        ...followUp.execution,
        delayMonths,
        setbackCount: attempt + 1,
        events: [...followUp.execution.events, { date: next.currentDate, summary: setbackSummary }].slice(-6),
      };
      const dossierEffects: WorldEffect[] = program.linkedDossierId && next.strategicDossiers[program.linkedDossierId]
        ? [{ kind: 'dossier_entry_add', dossierId: program.linkedDossierId, entry: {
          id: `${program.id}:setback:${attempt + 1}`, date: next.currentDate, title: 'Contretemps d’exécution', summary: setbackSummary,
          importance: 'moderate', actorIds: [program.actorId], requiresDecision: false, visibility: 'player',
        }, reason: 'Le report est enregistré dans le dossier du programme.', visibility: 'player' }]
        : [];
      next = commitWorldAction(next, {
        kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
        origin: 'time', intent: `Reporter : ${program.title}`,
        effects: [{ kind: 'action_program_patch', programId: program.id, patch: {
          progressMonths: program.durationMonths, expectedCompletionAt: delayedCompletionAt, execution,
          resolution: setbackSummary,
        }, reason: setbackSummary, visibility: 'player' }, ...followUp.effects, ...dossierEffects],
      });
      continue;
    }
    // Les effets d'une réforme dépendent de l'état politique au moment où elle
    // aboutit. Les premiers contretemps sont convertis en reports ; après le
    // plafond, une issue terminale explicite libère les moyens et clôt la boucle.
    const developmentEffects: WorldEffect[] = program.capacityDevelopment
      ? (() => {
        const spec = program.capacityDevelopment!;
        if (outcome === 'failed') return [];
        const gain = outcome === 'succeeded' ? spec.capacityGain : Math.max(1, Math.round(spec.capacityGain * 0.4));
        const maintenanceMultiplier = outcome === 'succeeded' ? 1 : 0.55;
        const annualCost = Number((spec.annualMaintenanceCost * maintenanceMultiplier).toFixed(1));
        return [
          { kind: 'capacity_maximum' as const, countryId: program.actorId, domain: spec.domain, delta: gain, reason: `Le programme « ${program.title} » accroît durablement ${spec.domain} de ${gain} points.` },
          ...(annualCost > 0 ? [{ kind: 'capacity_maintenance_add' as const, countryId: program.actorId, commitment: {
            id: `maintenance-${program.id}`, domain: spec.domain, label: program.title, annualBudgetCost: annualCost, startedAt: next.currentDate,
          }, reason: `Les effectifs, outils et contrats issus de « ${program.title} » créent ${annualCost.toFixed(1)} crédits de dépenses annuelles identifiées.` }] : []),
        ];
      })()
      : [];
    const territorialEffects = territorialProjectResolutionEffects(next, program, outcome);
    const resultEffects = program.emergencyCapacitySupport
      ? []
      : developmentEffects.length
        ? developmentEffects
        : territorialEffects ?? resolvePortProgramEffects(next, program, outcome) ?? (program.lever === 'policy_audit'
          ? nationalPolicyAuditEffects(next, program.intent, outcome === 'succeeded', program.actorId, program.policyDomain)
          : program.lever === 'national_reform'
            ? nationalReformEffects(
                next,
                program.intent,
                outcome === 'succeeded' ? 'adopted' : outcome === 'partially_succeeded' ? 'partial' : 'stalled',
                program.actorId,
                program.reformIntent,
              )
            : outcome === 'succeeded' ? program.successEffects : program.partialEffects);
    let resolution = program.emergencyCapacitySupport
      ? `Renfort d’urgence arrivé à échéance : les fonds ont soutenu ${program.emergencyCapacitySupport.domain} pendant trois mois, sans créer de capacité permanente.`
      : program.capacityDevelopment
        ? outcome === 'succeeded'
          ? `Programme de capacité achevé : +${program.capacityDevelopment.capacityGain} durablement en ${program.capacityDevelopment.domain}, avec un entretien annuel identifié.`
          : outcome === 'partially_succeeded'
            ? `Programme de capacité partiellement abouti : une hausse réduite est acquise, mais la transformation reste incomplète.`
            : 'Programme de capacité arrêté après ses contretemps : aucun gain durable supplémentaire n’est acquis et les moyens temporaires sont libérés.'
      : program.territorialProjectId
        ? outcome === 'succeeded'
          ? 'Projet territorial mis en service : ses effets économiques, sociaux, environnementaux et sécuritaires sont consolidés dans le dossier.'
          : outcome === 'partially_succeeded'
            ? 'Projet territorial partiellement mis en service : la production et les retombées restent inférieures au plan, avec des risques résiduels.'
            : 'Projet territorial arrêté : les dépenses et arbitrages restent au bilan, sans capacité productive durable.'
      : program.lever === 'policy_audit' || program.lever === 'resource_prospection'
      ? outcome === 'succeeded'
        ? program.lever === 'resource_prospection'
          ? 'Prospection achevée : le rapport économique et territorial est disponible dans le dossier pour étayer une éventuelle décision extractive. Aucun site n’est ouvert par cette seule étude.'
          : 'Audit achevé : le rapport est disponible dans le dossier pour étayer une décision ultérieure. Aucune réforme n’est engagée par cette seule expertise.'
        : outcome === 'partially_succeeded'
          ? program.lever === 'resource_prospection'
            ? 'Prospection partiellement achevée : les éléments disponibles sont versés au dossier, mais ils ne suffisent pas encore à borner un projet extractif.'
            : 'Audit partiellement achevé : les éléments disponibles sont versés au dossier, mais ils ne suffisent pas encore à fonder une réforme complète.'
          : program.lever === 'resource_prospection'
            ? 'Prospection non concluante après ses contretemps : le rapport est versé au dossier et les moyens sont libérés.'
            : 'Audit non concluant après son report : un rapport d’échec est versé au dossier et les moyens sont libérés.'
      : outcome === 'succeeded'
        ? 'Programme achevé : les objectifs immédiats sont atteints.'
      : outcome === 'partially_succeeded'
        ? 'Programme partiellement achevé : un résultat existe, mais il reste inférieur à l’ambition initiale.'
        : 'Programme arrêté après ses contretemps : l’objectif opérationnel n’est pas atteint et les moyens sont libérés.';
    if (unattendedTerritorialDecision) {
      resolution += ` L’arbitrage « ${unattendedTerritorialDecision.title} » est resté sans réponse : le chantier a continué sous contrainte et ne peut pas être considéré comme pleinement abouti.`;
    }
    const releaseEffects = program.requiredCapacities.map(({ domain, commitment }) => ({
      kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: -commitment,
      reason: `Les moyens temporaires de « ${program.title} » sont libérés.`,
    }));
    const failureEffects: WorldEffect[] = [];
    const intelligencePoliticalEffects: WorldEffect[] = program.category !== 'intelligence' || !program.targetIds[0] || program.targetIds[0] === program.actorId
      ? []
      : program.intent.toLocaleLowerCase('fr').includes('liaison')
        ? [{ kind: 'relation_delta', from: program.actorId, to: program.targetIds[0], relation: outcome === 'succeeded' ? 2 : 0.5, trust: outcome === 'succeeded' ? 3 : 1, reason: 'La liaison entre services crée un canal de confiance limité.' }]
        : [{ kind: 'relation_delta', from: program.actorId, to: program.targetIds[0], relation: -1, trust: -2, reason: 'Une activité clandestine laisse une friction limitée dans la relation bilatérale.' }];
    const intelligenceIncidentEffects: WorldEffect[] = [];
    const militaryEffects = program.militaryOperation
      ? militaryTheaterResolutionEffects(next, program.militaryOperation, outcome)
      : [];
    next = commitWorldAction(next, {
      kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
      origin: 'time', intent: `Résoudre : ${program.title}`,
        effects: [
          { kind: 'action_program_patch', programId: program.id, patch: { progressMonths: program.durationMonths, expectedCompletionAt, execution: followUp.execution, status: outcome, resolution, resourceStatus: 'released', resourcesReleasedAt: next.currentDate }, reason: resolution },
        ...followUp.effects,
        ...releaseEffects,
        ...(program.emergencyCapacitySupport ? [{ kind: 'capacity_maximum' as const, countryId: program.actorId, domain: program.emergencyCapacitySupport.domain, delta: -program.emergencyCapacitySupport.temporaryBoost, reason: `Le renfort temporaire de « ${program.title} » expire à son échéance.` }] : []),
        ...resultEffects, ...failureEffects, ...intelligencePoliticalEffects, ...intelligenceIncidentEffects, ...militaryEffects,
        ...linkedDossierResolutionEffects(next, program, outcome, resolution),
        ...worldCrisisInfluenceResolutionEffects(next, program, outcome),
        ...historicalAnchorResolutionEffects(next, program, outcome),
        ...(program.linkedDossierId ? [] : diplomaticResolutionEffects(next, program, outcome, resolution)),
      ],
    });
    const resolvedProgram = next.actionPrograms[program.id];
    const observedEffects = programOutcomeDetails(next, resolvedProgram);
    const reformOutcome = program.reformIntent && program.reformBaseline
      ? nationalReformOutcomeSummaryFor(
          next,
          program.reformIntent,
          outcome === 'succeeded' ? 'adopted' : outcome === 'partially_succeeded' ? 'partial' : 'stalled',
          program.reformBaseline,
          program.actorId,
        )
      : undefined;
    next = commitWorldAction(next, {
      kind: categoryKinds[program.category], actorId: program.actorId, origin: 'local_rule', visibility: 'debug',
      intent: `Conserver le bilan : ${program.title}`,
      effects: [{ kind: 'action_program_patch', programId: program.id, patch: { observedEffects, ...(reformOutcome ? { reformOutcome, resolution: reformOutcome.headline } : {}) },
        reason: 'Le bilan chiffré survit à la compression du registre.', visibility: 'debug' }],
    });
  }
  return next;
}

/** Prépare un mouvement concret à partir d'un théâtre existant. */
export function prepareMilitaryTheaterAction(
  state: WorldState,
  theaterId: string,
  kind: MilitaryTheaterActionKind,
  amountThousands = 5,
  destinationTheaterId?: string,
): CommonActionPreparation {
  const validation = validateMilitaryTheaterCommand(state, theaterId, kind, amountThousands, destinationTheaterId);
  if (!validation.ok) return validation;
  const { operation: command, source, target, warnings: theaterWarnings } = validation;
  const actionText = kind === 'reinforce'
    ? `Renforcer le théâtre militaire ${target.location} de ${state.countries[state.playerCountryId]?.name ?? state.playerCountryId}`
    : kind === 'withdraw'
      ? `Retirer des forces du théâtre militaire ${source.location} vers ${target.location}`
      : `Redéployer des forces de ${source.location} vers ${target.location}`;
  const base = prepareCommonAction(state, actionText, { category: 'defense', source: 'player' });
  if (!base.ok) return base;
  const durationMonths = kind === 'withdraw' ? 1 : kind === 'redeploy' ? 2 : 3;
  const budgetCost = Number((kind === 'reinforce' ? 0.35 + command.amountThousands * 0.12 : kind === 'redeploy' ? 0.25 + command.amountThousands * 0.07 : 0.18 + command.amountThousands * 0.04).toFixed(1));
  const requiredCapacities = kind === 'reinforce'
    ? [{ domain: 'defense' as const, commitment: 9 }, { domain: 'diplomacy' as const, commitment: 3 }, { domain: 'government' as const, commitment: 3 }]
    : kind === 'redeploy'
      ? [{ domain: 'defense' as const, commitment: 7 }, { domain: 'administration' as const, commitment: 3 }, { domain: 'government' as const, commitment: 2 }]
      : [{ domain: 'defense' as const, commitment: 4 }, { domain: 'administration' as const, commitment: 2 }, { domain: 'government' as const, commitment: 1 }];
  const operation: MilitaryTheaterOperation = {
    id: `theater-op-${state.sequence + 1}-${kind}-${target.id}`,
    kind,
    sourceTheaterId: command.sourceTheaterId,
    targetTheaterId: command.targetTheaterId,
    amountThousands: command.amountThousands,
    startedAt: state.currentDate,
    completesAt: addMonths(state.currentDate, durationMonths),
  };
  const successEffects: WorldEffect[] = [
    { kind: 'metric_delta', countryId: state.playerCountryId, metric: 'security', delta: kind === 'withdraw' ? 0.2 : kind === 'redeploy' ? 0.8 : 1.5, reason: kind === 'withdraw' ? 'Le retrait réduit une exposition extérieure sans désorganiser la défense nationale.' : 'La manœuvre améliore la posture militaire une fois les forces disponibles.' },
  ];
  const partialEffects: WorldEffect[] = [
    { kind: 'metric_delta', countryId: state.playerCountryId, metric: 'security', delta: kind === 'withdraw' ? 0 : 0.35, reason: 'La manœuvre aboutit avec une disponibilité et une coordination incomplètes.' },
  ];
  const cleanedBaseWarnings = base.warnings.filter((warning) => !warning.includes('moyens engagés dépassent'));
  return {
    ok: true,
    warnings: [...cleanedBaseWarnings, ...theaterWarnings, `Les ${command.amountThousands.toFixed(1)} k personnels restent engagés jusqu’au ${operation.completesAt}.`],
    action: {
      ...base.action,
      title: `${kind === 'reinforce' ? 'Renforcement' : kind === 'withdraw' ? 'Retrait' : 'Redéploiement'} · ${target.location}`,
      intent: actionText,
      targetIds: [...new Set(target.hostCountryIds)],
      durationMonths,
      requiredCapacities,
      budgetCost,
      successProbability: Math.round(Math.max(25, Math.min(90, base.action.successProbability + (target.access === 'unknown' ? -12 : 4) + (kind === 'withdraw' ? 8 : 0)))),
      risks: [...new Set([...base.action.risks.filter((risk) => !risk.includes('moyens engagés dépassent')), ...theaterWarnings, 'Un retard logistique ou une réaction du pays hôte peut réduire la disponibilité effective.'])],
      successEffects,
      partialEffects,
      militaryOperation: operation,
      intentSpec: { ...base.action.intentSpec!, objective: actionText },
    },
  };
}
