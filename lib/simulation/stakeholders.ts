import { commitWorldAction } from './ledger';
import { diplomaticSettlementAssessment } from './diplomatic-feasibility';
import { seededUnit } from './random';
import type {
  DiplomaticAgreementType,
  DiplomaticDialogue,
  DiplomaticDialogueResponse,
  GovernmentMeasure,
  PolicySignal,
  ReactionLevel,
  ReactionTrend,
  StakeholderInfluenceChannel,
  StakeholderReaction,
  StakeholderGroup,
  WorldEffect,
  WorldState,
} from './types';

export type PrototypeMeasureId = 'defense_cuts' | 'labor_restrictions' | 'capital_controls';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(2));

/**
 * Gravité visible sous forme qualitative dans l'interface, mais conservée en
 * valeur numérique pour calibrer les réactions. Une mesure peut fournir sa
 * propre gravité ; sinon elle est déduite de son intensité et de ses signaux.
 */
export function actionGravity(measure: GovernmentMeasure) {
  if (measure.gravity !== undefined && Number.isFinite(measure.gravity)) {
    return round(clamp(measure.gravity, 0, 5));
  }
  const intensity = clamp(measure.intensity, 0, 100) / 100;
  const signalMass = measure.signals.reduce((total, signal) => total + Math.abs(signal.weight), 0);
  return round(clamp(intensity * 4 + Math.min(0.7, signalMass * 0.22), 0, 5));
}

export type StakeholderPressureAssessment = {
  groupId: string;
  gravity: number;
  relevance: number;
  influence: number;
  escalationDisposition: number;
  pressure: number;
  activationThreshold: number;
  activationProbability: number;
  selected: boolean;
};

function escalationDispositionFor(group: { escalationDisposition?: number; baselineDefiance: number; cohesion: number }) {
  return clamp(group.escalationDisposition ?? (20 + group.baselineDefiance * 1.8 + group.cohesion * 0.28));
}

function activationThresholdFor(gravity: number) {
  if (gravity <= 0.5) return 92;
  if (gravity <= 1.5) return 76;
  if (gravity <= 2.5) return 45;
  if (gravity <= 3.5) return 40;
  if (gravity <= 4.5) return 30;
  return 20;
}

/**
 * Rapport interne entre gravité de l'action et capacité d'un groupe à se
 * mobiliser. Les probabilités exactes restent cachées au joueur ; le tirage
 * est déterministe pour qu'une sauvegarde et son rechargement donnent le même
 * résultat.
 */
export function assessStakeholderPressure(
  state: WorldState,
  measure: GovernmentMeasure,
  group: { id: string; influence: number; cohesion: number; baselineDefiance: number; escalationDisposition?: number; sensitivities: Partial<Record<import('./types').PolicySignal, number>> },
): StakeholderPressureAssessment {
  const gravity = actionGravity(measure);
  const relevance = clamp(Math.abs(measure.signals.reduce((total, item) => total + (group.sensitivities[item.signal] ?? 0) * item.weight, 0)) * 100);
  const influence = clamp(group.influence);
  const escalationDisposition = escalationDispositionFor(group);
  const pressure = round(clamp(
    gravity / 5 * 45 + relevance * 0.25 + influence * 0.18 + escalationDisposition * 0.12,
  ));
  const activationThreshold = activationThresholdFor(gravity);
  const activationProbability = round(clamp((pressure - activationThreshold + 20) / 60, 0.05, 0.98));
  const roll = seededUnit(state.seed, `${measure.id}:${group.id}:${state.currentDate}`);
  const selected = gravity > 0 && relevance > 0 && roll <= activationProbability;
  return { groupId: group.id, gravity, relevance, influence, escalationDisposition, pressure, activationThreshold, activationProbability, selected };
}

function maxReactionCount(gravity: number) {
  if (gravity <= 1.5) return 1;
  return 2;
}

/** Les intérêts portuaires locaux dépendent du site, sans accuser une personne réelle. */
function localPortGroups(state: WorldState, measure: GovernmentMeasure): StakeholderGroup[] {
  const asset = measure.territorialAssetId ? state.territorial.assets[measure.territorialAssetId] : undefined;
  if (!asset?.portProfile) return [];
  const { governanceRisk, laborFriction } = asset.portProfile;
  return [
    { id: `port-management:${asset.id}`, countryId: measure.countryId, territorialAssetId: asset.id,
      label: `Direction et intérêts établis · ${asset.name}`, category: 'administration',
      influence: clamp(25 + governanceRisk * 6), cohesion: 65, baselineDefiance: governanceRisk * 3,
      escalationDisposition: clamp(governanceRisk * 9),
      sensitivities: { port_governance: governanceRisk >= 5 ? governanceRisk / 7 : -0.3, port_capacity_investment: -0.7 },
      influenceChannels: ['policy_execution'], possibleResponses: ['Réserves sur les contrôles', 'Rétention de documents et retards administratifs'] },
    { id: `port-labor:${asset.id}`, countryId: measure.countryId, territorialAssetId: asset.id,
      label: `Représentants des travailleurs · ${asset.name}`, category: 'organized_labor',
      influence: clamp(30 + laborFriction * 6), cohesion: 70, baselineDefiance: laborFriction * 3,
      escalationDisposition: clamp(20 + laborFriction * 7),
      sensitivities: { port_governance: laborFriction >= 5 ? laborFriction / 9 : -0.2, port_capacity_investment: -0.6 },
      influenceChannels: ['policy_execution', 'social_mobilization'], possibleResponses: ['Demande de garanties sur les conditions de travail', 'Mobilisation sur le site'] },
  ];
}

function parliamentaryGroups(state: WorldState, countryId: string): StakeholderGroup[] {
  const blocs = state.nationalPolitics?.[countryId]?.blocs ?? [];
  const totalSeats = blocs.reduce((sum, bloc) => sum + bloc.seats, 0) || 1;
  return blocs.filter((bloc) => bloc.role !== 'vacant' && bloc.role !== 'non_aligned').map((bloc) => {
    const orientation = `${bloc.orientation} ${bloc.priorities.join(' ')}`.toLocaleLowerCase('fr');
    const social = /gauche|social|communis/.test(orientation);
    const liberal = /libéral|initiative privée|centre droit/.test(orientation);
    const ecology = /écolog/.test(orientation);
    const sovereign = /gaull|souverain|sécurité/.test(orientation);
    return { id: `bloc:${bloc.id}`, countryId,
      label: `${bloc.label} · ${bloc.leader}`, category: 'civic' as const,
      influence: clamp(20 + bloc.seats / totalSeats * 100), cohesion: bloc.discipline,
      baselineDefiance: bloc.role === 'opposition' ? 14 : 6,
      escalationDisposition: clamp(20 + bloc.discipline * 0.25 + (bloc.role === 'opposition' ? 15 : 0)),
      sensitivities: { austerity: social ? 0.75 : -0.25, labor_deregulation: social ? 0.85 : liberal ? -0.65 : 0,
        capital_controls: liberal ? 0.8 : social ? -0.3 : 0.2,
        tax_increase_high_incomes: liberal ? 0.75 : social ? -0.6 : 0.2,
        public_industrial_investment: social ? -0.55 : 0.1,
        fossil_expansion: ecology ? 0.9 : 0, defense_cuts: sovereign ? 0.8 : 0.15,
        alliance_disengagement: sovereign ? 0.4 : 0.2,
        military_doctrine_break: sovereign ? 0.65 : 0.25 },
      influenceChannels: ['political_support' as const],
      possibleResponses: ['Prise de position publique', 'Amendements et pression parlementaire'] };
  });
}

/**
 * Certains intérêts n'ont de raison d'exister que lorsqu'un dossier les
 * touche. Ils sont créés à la demande, avec des identifiants stables, puis
 * réutilisés si un accord ultérieur concerne le même secteur.
 */
function diplomaticContextGroups(state: WorldState, measure: GovernmentMeasure): StakeholderGroup[] {
  const country = state.countries[measure.countryId];
  if (!country) return [];
  const signals = new Set(measure.signals.map((item) => item.signal));
  const sovereignty = Math.max(0, country.politics.doctrine.sovereignty);
  const security = Math.max(0, country.politics.doctrine.security);
  const groups: StakeholderGroup[] = [];
  if (signals.has('territorial_concession') || signals.has('foreign_military_presence') || signals.has('alliance_reorientation') || signals.has('status_humiliation')) groups.push({
    id: `${country.id}-diplomatic-sovereignty-network`, countryId: country.id,
    label: 'Réseaux de souveraineté et de sécurité nationale', category: 'civic',
    influence: clamp(30 + country.weight * 0.22 + sovereignty * 0.25),
    escalationDisposition: clamp(38 + sovereignty * 0.35 + security * 0.12), cohesion: clamp(42 + sovereignty * 0.25), baselineDefiance: 10,
    sensitivities: { territorial_concession: 0.96, foreign_military_presence: 0.88, alliance_reorientation: 0.78, security_guarantee: -0.22, diplomatic_deescalation: 0.16, status_humiliation: 0.94 },
    influenceChannels: ['political_support', 'social_mobilization', 'diplomatic_acceptance'],
    possibleResponses: ['Contestation publique des concessions', 'Pression pour renégocier les garanties', 'Mobilisation nationale en cas d’atteinte territoriale'],
  });
  if (signals.has('resource_sovereignty')) groups.push({
    id: `${country.id}-resource-interests`, countryId: country.id,
    label: 'Filières énergétiques, minières et intérêts des ressources', category: 'capital',
    influence: clamp(32 + country.weight * 0.2), escalationDisposition: clamp(28 + sovereignty * 0.26), cohesion: 58, baselineDefiance: 9,
    sensitivities: { resource_sovereignty: 0.86, trade_opening: -0.32, technology_transfer: 0.18, diplomatic_deescalation: -0.18 },
    influenceChannels: ['economic_confidence', 'policy_execution', 'diplomatic_acceptance'],
    possibleResponses: ['Lobbying sur le contrôle des ressources', 'Conditionnement des investissements', 'Soutien à l’accord si les revenus nationaux sont protégés'],
  });
  if (signals.has('trade_opening') || signals.has('technology_transfer')) groups.push({
    id: `${country.id}-trade-technology-interests`, countryId: country.id,
    label: 'Industries exportatrices et filières technologiques', category: 'capital',
    influence: clamp(34 + country.metrics.industry * 0.22), escalationDisposition: 34, cohesion: 61, baselineDefiance: 8,
    sensitivities: { trade_opening: -0.78, technology_transfer: 0.42, resource_sovereignty: 0.12, diplomatic_deescalation: -0.3 },
    influenceChannels: ['economic_confidence', 'policy_execution', 'diplomatic_acceptance'],
    possibleResponses: ['Soutien aux nouveaux débouchés', 'Demande de garanties industrielles', 'Réticence face à un transfert technologique asymétrique'],
  });
  const supplementalSuffixes = [
    'strategic-establishment', 'strategic-industries', 'sovereignty-currents',
    'diplomatic-sovereignty-network', 'resource-interests', 'trade-technology-interests',
  ];
  const existingSupplementalCount = Object.values(state.stakeholderGroups).filter((group) => (
    group.countryId === country.id && supplementalSuffixes.some((suffix) => group.id.endsWith(suffix))
  )).length;
  // Le modèle reste lisible : cinq groupes particuliers au maximum par pays,
  // même lorsqu'une grande puissance déjà détaillée devient partie à un dossier.
  return groups.slice(0, Math.max(0, 5 - existingSupplementalCount));
}

export const reactionLevelLabels: Record<ReactionLevel, string> = {
  low: 'faible', moderate: 'modérée', important: 'importante', critical: 'critique',
};

export const reactionTrendLabels: Record<ReactionTrend, string> = {
  falling: 'en diminution', stable: 'stable', rising: 'en augmentation', rising_fast: 'en augmentation rapide',
};

/** Les marges évitent qu'un niveau clignote autour d'un seuil. */
export function qualitativeReactionLevel(value: number, previous?: ReactionLevel): ReactionLevel {
  if (previous === 'critical' && value >= 70) return 'critical';
  if (previous === 'important' && value >= 46 && value < 79) return 'important';
  if (previous === 'moderate' && value >= 21 && value < 54) return 'moderate';
  if (previous === 'low' && value < 29) return 'low';
  return value >= 75 ? 'critical' : value >= 50 ? 'important' : value >= 25 ? 'moderate' : 'low';
}

function trendForDelta(delta: number): ReactionTrend {
  return delta >= 14 ? 'rising_fast' : delta >= 4 ? 'rising' : delta <= -4 ? 'falling' : 'stable';
}

function consequenceCount(level: ReactionLevel) {
  return level === 'critical' ? 3 : level === 'important' ? 2 : 1;
}

export function stakeholderReactionEffects(state: WorldState, measure: GovernmentMeasure): WorldEffect[] {
  const effects: WorldEffect[] = [];
  const local = localPortGroups(state, measure);
  const parliamentary = local.length ? [] : parliamentaryGroups(state, measure.countryId);
  const diplomatic = local.length ? [] : diplomaticContextGroups(state, measure);
  const contextual = local.length ? local : [...parliamentary, ...diplomatic];
  const existing = Object.values(state.stakeholderGroups)
    .filter((item) => item.countryId === measure.countryId && !item.territorialAssetId && !item.id.startsWith('bloc:'))
    // Lorsque le Parlement est détaillé, ses blocs remplacent l'opposition
    // générique afin de ne pas compter deux fois la même force politique.
    .filter((item) => !parliamentary.length || item.id !== `${measure.countryId}-political-opposition`);
  const groups = local.length
    ? local
    : [...new Map([...existing, ...contextual].map((group) => [group.id, group])).values()];
  for (const group of contextual) effects.push(state.stakeholderGroups[group.id]
    ? { kind: 'stakeholder_group_patch', groupId: group.id, patch: group, reason: 'Les intérêts concernés reflètent la situation présente.', visibility: 'debug' }
    : { kind: 'stakeholder_group_add', group, reason: 'Les intérêts concernés sont identifiés dans le monde simulé.', visibility: 'debug' });
  const assessments = groups.map((group) => ({ group, assessment: assessStakeholderPressure(state, measure, group) }));
  const candidates = assessments
    .filter(({ group, assessment }) => {
      const reactionId = `${group.id}:${measure.subjectId}`;
      const current = state.stakeholderReactions[reactionId];
      if (current?.relatedMeasureIds.includes(measure.id)) return false;
      const delta = round(measure.intensity * (measure.signals.reduce((total, item) => total + (group.sensitivities[item.signal] ?? 0) * item.weight, 0)) * 0.45);
      // Une réaction existante reste suivie pour le même sujet, même si la
      // nouvelle mesure l'apaise ; une nouvelle réaction doit franchir le seuil.
      return Boolean(current && Math.abs(delta) >= 2) || (Math.abs(delta) >= 2 && assessment.selected);
    })
    .sort((a, b) => {
      // La pertinence de la nouvelle décision prime sur l'ancienneté : un
      // conflit syndical existant ne doit pas masquer les intérêts financiers.
      return b.assessment.pressure - a.assessment.pressure || a.group.id.localeCompare(b.group.id);
    })
    .slice(0, maxReactionCount(actionGravity(measure)));
  for (const { group, assessment } of candidates) {
    const sensitivity = measure.signals.reduce((total, item) =>
      total + (group.sensitivities[item.signal] ?? 0) * item.weight, 0);
    const delta = round(measure.intensity * sensitivity * 0.45);
    if (Math.abs(delta) < 2) continue;

    const reactionId = `${group.id}:${measure.subjectId}`;
    const current = state.stakeholderReactions[reactionId];
    const stance = current?.stance ?? (current ? 'opposition' : delta < 0 ? 'support' : 'opposition');
    const signedDelta = stance === 'support' ? -delta : delta;
    const defiance = round(clamp((current?.defiance ?? group.baselineDefiance) + signedDelta));
    const mobilization = round(clamp((current?.mobilization ?? 18) + signedDelta * 0.62));
    const level = qualitativeReactionLevel(defiance, current?.level);
    const causes = [...new Set([measure.title, ...(current?.causes ?? [])])].slice(0, 4);
    const likelyConsequences = stance === 'support' ? ['Soutien public et coopération à l’exécution'] : group.possibleResponses.slice(0, consequenceCount(level));
    if (current) {
      effects.push({
        kind: 'stakeholder_reaction_patch', reactionId,
        patch: {
          defiance, mobilization, level, trend: trendForDelta(delta), causes, likelyConsequences,
          relatedMeasureIds: [...new Set([...current.relatedMeasureIds, measure.id])],
          updatedAt: state.currentDate, status: 'active', stance, actionGravity: assessment.gravity, actorPressure: assessment.pressure,
        },
        reason: `${group.label} réévalue sa position après « ${measure.title} ».`, visibility: 'player',
      });
    } else {
      const reaction: StakeholderReaction = {
        id: reactionId, countryId: measure.countryId, groupId: group.id,
        targetId: measure.countryId, subjectId: measure.subjectId,
        label: `${stance === 'support' ? 'Soutien' : 'Défiance'} de ${group.label.toLocaleLowerCase('fr')}`,
        defiance, mobilization, level, trend: trendForDelta(delta), causes, likelyConsequences,
        relatedMeasureIds: [measure.id], createdAt: state.currentDate, updatedAt: state.currentDate,
        decayPerMonth: group.category === 'military' ? 0.7 : group.category === 'administration' ? 1.1 : 1.5,
        status: 'active', visibility: group.category === 'military' || group.category === 'administration' ? 'internal' : 'public',
        stance, actionGravity: assessment.gravity, actorPressure: assessment.pressure,
      };
      effects.push({
        kind: 'stakeholder_reaction_add', reaction,
        reason: `Une réaction organisée apparaît après « ${measure.title} ».`, visibility: 'player',
      });
    }
  }
  return effects;
}

const diplomaticAgreementLabels: Record<DiplomaticAgreementType, string> = {
  industrial_cooperation: 'coopération industrielle', energy_cooperation: 'coopération énergétique',
  information_sharing: 'partage d’informations', security_cooperation: 'coopération de sécurité',
  political_guarantee: 'garantie politique', mediation: 'médiation', defense_cooperation: 'coopération de défense',
};

function normalizedDiplomaticText(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

/** Traduit le contenu politique d'un accord en signaux lisibles par les groupes intérieurs. */
export function diplomaticPolicySignals(
  agreementType: DiplomaticAgreementType,
  text: string,
): Array<{ signal: PolicySignal; weight: number }> {
  const normalized = normalizedDiplomaticText(text);
  const weights = new Map<PolicySignal, number>();
  const add = (signal: PolicySignal, weight: number) => weights.set(signal, Math.max(weight, weights.get(signal) ?? 0));
  if (/territoir|frontier|zone disput|mer egee|maritim|souverain|forage unilateral/.test(normalized)) add('territorial_concession', 0.92);
  if (/base militaire|presence militaire|stationnement|troupes etranger|deploiement etranger/.test(normalized)) add('foreign_military_presence', 0.95);
  if (/otan|alliance|alignement|bloc strategique|russie|etats-unis|garantie de securite/.test(normalized)) add('alliance_reorientation', 0.72);
  if (/hydrocarb|petrol|gaz|ressource|minier|partage des revenus|recettes/.test(normalized)) add('resource_sovereignty', 0.82);
  if (/commerce|commercial|marche|contrat|investissement|tarif|export/.test(normalized)) add('trade_opening', 0.62);
  if (/technolog|transfert|licence|production locale|propriete intellectuelle/.test(normalized)) add('technology_transfer', 0.72);
  if (/garantie|protection|assistance|defense commune|securite collective/.test(normalized)) add('security_guarantee', 0.58);
  if (/moratoire|cessez-le-feu|desescal|deconfliction|retrait|suspension des forage/.test(normalized)) add('diplomatic_deescalation', 0.76);
  if (agreementType === 'energy_cooperation') add('resource_sovereignty', 0.5);
  if (agreementType === 'industrial_cooperation') { add('trade_opening', 0.5); add('technology_transfer', 0.48); }
  if (agreementType === 'defense_cooperation') { add('alliance_reorientation', 0.62); add('security_guarantee', 0.58); }
  if (agreementType === 'security_cooperation' || agreementType === 'information_sharing') add('security_guarantee', 0.48);
  if (agreementType === 'political_guarantee') { add('alliance_reorientation', 0.46); add('security_guarantee', 0.56); }
  if (agreementType === 'mediation') add('diplomatic_deescalation', 0.62);
  return [...weights].map(([signal, weight]) => ({ signal, weight }));
}

/**
 * Un accord peut susciter du soutien ou de l'opposition dans chacun des pays
 * signataires. Le tirage reste borné à zéro, une ou deux réactions par pays :
 * signer ne fabrique donc pas mécaniquement une crise intérieure.
 */
export function diplomaticAgreementReactionEffects(
  state: WorldState,
  dialogue: Pick<DiplomaticDialogue, 'id' | 'initiatorId' | 'participantIds'>,
  response: DiplomaticDialogueResponse,
  treatyId: string,
): WorldEffect[] {
  const effects: WorldEffect[] = [];
  for (const countryId of dialogue.participantIds) {
    const individual = response.participantPositions?.find((item) => item.participantId === countryId);
    const terms = individual
      ? [individual.position, ...individual.acceptedTerms, ...individual.conditionalTerms]
      : [response.position, ...(response.acceptedTerms ?? []), ...response.concessions, ...response.conditions, ...response.guaranteesRequested];
    const signals = diplomaticPolicySignals(response.agreementType, terms.join(' '));
    const inferredConcessions = individual
      ? individual.acceptedTerms.filter((term) => /ced|renonc|retir|abandon|moratoire|partage egal|50\s*%|demilitaris/i.test(normalizedDiplomaticText(term)))
      : response.concessions;
    const settlement = diplomaticSettlementAssessment(
      state,
      countryId,
      dialogue.participantIds.filter((id) => id !== countryId),
      terms.join(' '),
      inferredConcessions,
      individual
        ? [...individual.acceptedTerms, ...individual.conditionalTerms]
        : [...(response.acceptedTerms ?? []), ...response.conditions, ...response.guaranteesRequested],
    );
    if (settlement.humiliating) signals.push({ signal: 'status_humiliation', weight: Math.min(1, Math.max(0.55, settlement.humiliationRisk / 100)) });
    const highSovereigntyCost = signals.some((item) => ['territorial_concession', 'foreign_military_presence'].includes(item.signal));
    const substantial = signals.some((item) => ['alliance_reorientation', 'resource_sovereignty'].includes(item.signal));
    effects.push(...stakeholderReactionEffects(state, {
      id: `diplomatic-agreement:${treatyId}:${countryId}`,
      countryId,
      title: `Accord de ${diplomaticAgreementLabels[response.agreementType]}`,
      subjectId: `dialogue:${dialogue.id}`,
      intensity: clamp(46 + signals.length * 5 + (individual?.conditionalTerms.length ?? response.conditions.length) * 2 + (settlement.humiliating ? 12 : 0), 42, 92),
      gravity: settlement.humiliating ? 4.6 : highSovereigntyCost ? 4.2 : substantial ? 3.4 : 2.4,
      signals,
      effects: [],
    }));
  }
  return effects;
}

export function prototypeGovernmentMeasure(state: WorldState, measureId: PrototypeMeasureId): GovernmentMeasure {
  const countryId = state.playerCountryId;
  const id = `${measureId}-${state.currentDate}-${state.sequence + 1}`;
  if (measureId === 'defense_cuts') return {
    id, countryId, title: 'Réduction accélérée des crédits militaires',
    subjectId: 'government-course', intensity: 72,
    signals: [{ signal: 'defense_cuts', weight: 1 }, { signal: 'austerity', weight: 0.25 }],
    effects: [
      { kind: 'fiscal_delta', countryId, bucket: 'discretionary', delta: 3, reason: 'Les crédits militaires libèrent une marge budgétaire immédiate.' },
      { kind: 'metric_delta', countryId, metric: 'security', delta: -1, reason: 'La préparation militaire absorbe la réduction des crédits.' },
    ],
  };
  if (measureId === 'labor_restrictions') return {
    id, countryId, title: 'Encadrement renforcé du droit de grève',
    subjectId: 'government-course', intensity: 68,
    signals: [{ signal: 'labor_deregulation', weight: 1 }, { signal: 'administrative_reorganization', weight: 0.15 }],
    effects: [{ kind: 'metric_delta', countryId, metric: 'stability', delta: -0.8, reason: 'La réforme accroît temporairement la conflictualité sociale.' }],
  };
  return {
    id, countryId, title: 'Encadrement administratif des sorties de capitaux',
    subjectId: 'government-course', intensity: 66,
    signals: [{ signal: 'capital_controls', weight: 1 }, { signal: 'administrative_reorganization', weight: 0.2 }],
    effects: [{ kind: 'fiscal_delta', countryId, bucket: 'discretionary', delta: -0.5, reason: 'Le nouveau contrôle mobilise des moyens administratifs et financiers.' }],
  };
}

export function enactPrototypeGovernmentMeasure(state: WorldState, measureId: PrototypeMeasureId) {
  const measure = prototypeGovernmentMeasure(state, measureId);
  return enactGovernmentMeasure(state, measure);
}

/** Point d'entrée commun aux mesures cadrées et aux décisions libres interprétées par IA. */
export function enactGovernmentMeasure(state: WorldState, measure: GovernmentMeasure) {
  return commitWorldAction(state, {
    kind: 'political', actorId: measure.countryId, origin: 'player',
    intent: measure.title,
    effects: [...measure.effects, ...stakeholderReactionEffects(state, measure)],
    metadata: { measureId: measure.id, subjectId: measure.subjectId, signals: measure.signals, actionGravity: actionGravity(measure) },
  });
}

export function advanceStakeholderReactions(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  const effects: WorldEffect[] = [];
  for (const reaction of Object.values(state.stakeholderReactions)) {
    if (reaction.status === 'resolved') continue;
    const group = state.stakeholderGroups[reaction.groupId];
    if (!group) continue;
    const defiance = round(Math.max(group.baselineDefiance, reaction.defiance - reaction.decayPerMonth * elapsedMonths));
    const mobilization = round(Math.max(10, reaction.mobilization - reaction.decayPerMonth * 0.7 * elapsedMonths));
    const level = qualitativeReactionLevel(defiance, reaction.level);
    const resolved = defiance <= group.baselineDefiance + 0.5 && mobilization <= 10.5;
    effects.push({
      kind: 'stakeholder_reaction_patch', reactionId: reaction.id,
      patch: {
        defiance, mobilization, level, trend: defiance < reaction.defiance ? 'falling' : 'stable',
        updatedAt: state.currentDate, status: resolved ? 'resolved' : level === 'low' ? 'subsiding' : 'active',
      },
      reason: resolved ? 'La réaction organisée est revenue à son niveau ordinaire.' : 'Sans nouveau déclencheur, la réaction s’use progressivement.',
      visibility: 'debug',
    });
  }
  if (!effects.length) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId, origin: 'local_rule',
    intent: 'Actualiser les réactions des corps organisés', visibility: 'debug', effects,
  });
}

export function stakeholderPressureByChannel(
  state: WorldState,
  countryId: string,
  channel: StakeholderInfluenceChannel,
) {
  let pressure = 0;
  for (const reaction of Object.values(state.stakeholderReactions)) {
    if (reaction.countryId !== countryId || reaction.status === 'resolved' || reaction.stance === 'support') continue;
    const group = state.stakeholderGroups[reaction.groupId];
    if (!group?.influenceChannels.includes(channel)) continue;
    pressure += reaction.defiance
      * (0.35 + reaction.mobilization / 180)
      * (0.4 + group.influence / 170)
      * (0.5 + group.cohesion / 220);
  }
  return round(clamp(pressure));
}

export function visibleStakeholderReactions(state: WorldState, countryId = state.playerCountryId) {
  return Object.values(state.stakeholderReactions)
    .filter((reaction) => reaction.countryId === countryId && reaction.status !== 'resolved')
    .sort((a, b) => {
      const order: Record<ReactionLevel, number> = { low: 0, moderate: 1, important: 2, critical: 3 };
      return order[b.level] - order[a.level] || b.updatedAt.localeCompare(a.updatedAt);
    });
}
