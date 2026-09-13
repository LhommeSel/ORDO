import { commitWorldAction } from './ledger';
import { powerTacticEffects } from './power-tactics';
import { makeDossierDecision } from './dossier-decisions';
import { qualitativeReactionLevel } from './stakeholders';
import type {
  EmergentPowerActor,
  ISODate,
  PowerActorRole,
  PowerStruggleAIPlan,
  PowerStruggleAIProposal,
  PowerStruggleAIRequest,
  PowerStruggleCampaign,
  PowerStrugglePlayerDecision,
  PowerStruggleTactic,
  StakeholderCategory,
  StakeholderGroup,
  StakeholderReaction,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(2));

const tacticsByCategory: Record<StakeholderCategory, PowerStruggleTactic[]> = {
  military: [
    'private_lobbying', 'administrative_obstruction', 'public_criticism',
    'organized_resignation', 'information_leak', 'security_disobedience',
    'extra_constitutional_preparation', 'negotiation', 'deescalation',
  ],
  organized_labor: [
    'private_lobbying', 'public_criticism', 'media_campaign', 'social_mobilization',
    'strike', 'information_leak', 'negotiation', 'deescalation',
  ],
  capital: [
    'private_lobbying', 'public_criticism', 'media_campaign', 'investment_freeze',
    'capital_flight', 'opposition_funding', 'information_leak', 'negotiation', 'deescalation',
  ],
  administration: [
    'private_lobbying', 'administrative_obstruction', 'public_criticism',
    'organized_resignation', 'information_leak', 'negotiation', 'deescalation',
  ],
  civic: [
    'private_lobbying', 'public_criticism', 'media_campaign', 'social_mobilization',
    'information_leak', 'negotiation', 'deescalation',
  ],
};

const roleByCategory: Record<StakeholderCategory, PowerActorRole[]> = {
  military: ['military_officer'],
  organized_labor: ['union_leader'],
  capital: ['business_leader'],
  administration: ['senior_official'],
  civic: ['civic_figure'],
};

const tacticSeverity: Record<PowerStruggleTactic, number> = {
  private_lobbying: 12,
  administrative_obstruction: 38,
  public_criticism: 32,
  media_campaign: 42,
  organized_resignation: 52,
  social_mobilization: 48,
  strike: 62,
  investment_freeze: 55,
  capital_flight: 72,
  opposition_funding: 64,
  information_leak: 44,
  security_disobedience: 78,
  extra_constitutional_preparation: 96,
  negotiation: 18,
  deescalation: 4,
};

export const powerStruggleDecisionLabels: Record<PowerStrugglePlayerDecision, string> = {
  negotiate: 'Ouvrir une négociation',
  concede: 'Accorder une concession ciblée',
  contain: 'Contenir la contestation',
  ignore: 'Ignorer publiquement',
};

export const powerStruggleDecisionSummaries: Record<PowerStrugglePlayerDecision, string> = {
  negotiate: 'Réduit la tension à court terme, mais donne à l’acteur une place officielle dans la discussion.',
  concede: 'Apaise rapidement la base contestataire au prix d’un recul politique ou budgétaire.',
  contain: 'Protège la ligne du gouvernement, mais augmente le risque de polarisation et de rupture.',
  ignore: 'Économise du temps politique maintenant, en laissant la pression s’accumuler.',
};

function campaignStatusFor(
  campaign: PowerStruggleCampaign,
  pressure: number,
  reaction: StakeholderReaction,
  dossierStatus?: 'emerging' | 'active' | 'deescalating' | 'resolved',
): PowerStruggleCampaign['status'] {
  if (dossierStatus === 'resolved') return 'resolved';
  if (reaction.status === 'resolved' || (pressure < 35 && reaction.trend === 'falling')) return 'deescalating';
  if (pressure >= 48 || (campaign.status === 'active' && pressure >= 35)) return 'active';
  if (campaign.status === 'deescalating' && pressure < 48) return 'deescalating';
  return 'emerging';
}

function campaignPhaseFor(status: PowerStruggleCampaign['status'], pressure: number) {
  if (status === 'resolved') return 'Campagne close';
  if (status === 'deescalating') return 'Retour au calme surveillé';
  if (pressure >= 82) return 'Confrontation ouverte';
  if (pressure >= 64) return 'Pression publique';
  if (pressure >= 48) return 'Mobilisation structurée';
  return 'Tension émergente';
}

function pressureBand(pressure: number) {
  return pressure >= 82 ? 3 : pressure >= 64 ? 2 : pressure >= 48 ? 1 : 0;
}

function campaignTrendFor(previous: number, pressure: number, status: PowerStruggleCampaign['status']) {
  if (status === 'deescalating') return 'deescalating' as const;
  if (pressure >= previous + 5) return 'escalating' as const;
  if (pressure <= previous - 5) return 'deescalating' as const;
  return 'stable' as const;
}

function addMonths(date: ISODate, months: number): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + Math.max(1, Math.round(months)));
  return value.toISOString().slice(0, 10) as ISODate;
}

function strugglePressure(group: StakeholderGroup, reaction: StakeholderReaction) {
  return round(clamp(
    reaction.defiance * 0.36
    + reaction.mobilization * 0.24
    + group.influence * 0.24
    + group.cohesion * 0.16,
  ));
}

function compactContext(
  state: WorldState,
  group: StakeholderGroup,
  reaction: StakeholderReaction,
  campaign?: PowerStruggleCampaign,
  playerResponse?: string,
): PowerStruggleAIRequest['context'] {
  const country = state.countries[reaction.countryId];
  const existingActorIds = Object.values(state.powerActors ?? {})
    .filter((actor) => actor.countryId === reaction.countryId
      && actor.stakeholderGroupId === group.id
      && actor.status === 'active')
    .map((actor) => actor.id);
  return {
    countryName: country?.name ?? reaction.countryId,
    governmentLabel: country?.politics.governmentLabel ?? 'Gouvernement inconnu',
    stakeholderLabel: group.label,
    stakeholderCategory: group.category,
    subjectId: reaction.subjectId,
    defiance: reaction.defiance,
    mobilization: reaction.mobilization,
    influence: group.influence,
    cohesion: group.cohesion,
    causes: reaction.causes,
    plausibleResponses: group.possibleResponses,
    existingActorIds,
    ...(campaign ? { currentCampaign: {
      phase: campaign.phase,
      pressure: campaign.pressure,
      momentum: campaign.momentum,
      escalation: campaign.escalation,
      lastStrategy: campaign.aiPlan.strategy,
    } } : {}),
    ...(playerResponse ? { playerResponse } : {}),
  };
}

function pendingRequestFor(state: WorldState, reactionId: string, campaignId?: string) {
  return Object.values(state.aiJobs ?? {}).filter((job): job is PowerStruggleAIRequest => job.kind === 'power_struggle').find((request) =>
    request.status === 'pending'
    && request.reactionId === reactionId
    && (!campaignId || request.campaignId === campaignId),
  );
}

function activeCampaignForReaction(state: WorldState, reactionId: string) {
  return Object.values(state.powerStruggleCampaigns ?? {}).find((campaign) =>
    campaign.stakeholderReactionId === reactionId && campaign.status !== 'resolved',
  );
}

/**
 * Le moteur s'arrête à la causalité : il constate qu'une opposition a les raisons
 * et les moyens de s'incarner, puis place l'arbitrage narratif dans la file IA.
 */
export function detectPowerStruggleOpportunities(state: WorldState) {
  const effects: WorldEffect[] = [];
  const pendingEmergences = Object.values(state.aiJobs ?? {})
    .filter((job) => job.kind === 'power_struggle' && job.status === 'pending' && job.purpose === 'materialize_actor').length;
  // Une tension locale ne doit pas monopoliser le budget IA : quelques dossiers
  // prioritaires sont ouverts à chaque passage, les autres restent observables.
  const emergenceSlots = Math.max(0, 3 - pendingEmergences);
  const candidates = Object.values(state.stakeholderReactions ?? {})
    .filter((reaction) => {
      if (reaction.status === 'resolved' || !['important', 'critical'].includes(reaction.level)) return false;
      const group = state.stakeholderGroups[reaction.groupId];
      return Boolean(group && !activeCampaignForReaction(state, reaction.id) && !pendingRequestFor(state, reaction.id));
    })
    .map((reaction) => ({ reaction, group: state.stakeholderGroups[reaction.groupId], pressure: strugglePressure(state.stakeholderGroups[reaction.groupId], reaction) }))
    .filter((candidate) => candidate.pressure >= 48)
    .sort((a, b) => b.pressure - a.pressure || a.reaction.id.localeCompare(b.reaction.id))
    .slice(0, emergenceSlots);
  for (const { reaction, group, pressure } of candidates) {
    const request: PowerStruggleAIRequest = {
      id: `power-ai-emergence:${reaction.id}`,
      kind: 'power_struggle', schemaVersion: 1,
      priority: reaction.level === 'critical' ? 'urgent' : 'normal', budgetTier: 'standard', attempts: 0,
      purpose: 'materialize_actor',
      countryId: reaction.countryId,
      reactionId: reaction.id,
      status: 'pending',
      requestedAt: state.currentDate,
      reasons: [
        `${group.label} atteint une opposition ${reaction.level}.`,
        `La combinaison influence–cohésion–mobilisation atteint ${pressure}/100.`,
        'Une IA doit décider si cette tendance s’incarne et quelle stratégie elle adopte.',
      ],
      context: compactContext(state, group, reaction),
    };
    effects.push({
      kind: 'ai_job_add', job: request,
      reason: 'Une opposition institutionnelle suffisamment forte exige un arbitrage politique par IA.',
      visibility: 'debug',
    });
  }
  if (!effects.length) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId, origin: 'local_rule',
    intent: 'Détecter les oppositions susceptibles de s’incarner',
    visibility: 'debug', effects,
  });
}

function validateProposal(
  request: PowerStruggleAIRequest,
  group: StakeholderGroup,
  proposal: PowerStruggleAIProposal,
) {
  const errors: string[] = [];
  if (!tacticsByCategory[group.category].includes(proposal.currentTactic)) {
    errors.push(`La tactique « ${proposal.currentTactic} » n'est pas accessible à ${group.label}.`);
  }
  if (request.purpose === 'materialize_actor' && !proposal.actor) {
    errors.push('La matérialisation exige un acteur proposé par l’IA.');
  }
  if (proposal.actor && !roleByCategory[group.category].includes(proposal.actor.role)) {
    errors.push(`Le rôle « ${proposal.actor.role} » ne peut pas incarner directement ce groupe.`);
  }
  for (const [label, value] of Object.entries({
    influence: proposal.actor?.influence,
    legitimacy: proposal.actor?.legitimacy,
    loyaltyToRegime: proposal.actor?.loyaltyToRegime,
    loyaltyToGovernment: proposal.actor?.loyaltyToGovernment,
    riskTolerance: proposal.actor?.riskTolerance,
  })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
      errors.push(`${label} doit être compris entre 0 et 100.`);
    }
  }
  if (!proposal.strategy.trim() || !proposal.immediateObjective.trim() || !proposal.publicMove.trim()) {
    errors.push('Le plan IA doit contenir une stratégie, un objectif immédiat et une manifestation concrète.');
  }
  if (!Number.isFinite(proposal.reviewAfterMonths) || proposal.reviewAfterMonths < 1 || proposal.reviewAfterMonths > 24) {
    errors.push('Le prochain examen IA doit être prévu entre 1 et 24 mois.');
  }
  return errors;
}

function buildAIPlan(state: WorldState, proposal: PowerStruggleAIProposal, revision: number): PowerStruggleAIPlan {
  return {
    revision,
    generatedAt: state.currentDate,
    strategy: proposal.strategy,
    immediateObjective: proposal.immediateObjective,
    acceptableCompromise: proposal.acceptableCompromise,
    personalRedLine: proposal.personalRedLine,
    currentTactic: proposal.currentTactic,
    publicMove: proposal.publicMove,
    reassessmentTriggers: [...new Set(proposal.reassessmentTriggers)],
    reviewAfterMonths: Math.round(proposal.reviewAfterMonths),
  };
}

/**
 * Seul point autorisé d'écriture d'une réponse LLM dans le monde. Le moteur
 * fournit les identifiants, borne les valeurs et refuse les moyens incompatibles.
 */
export function applyPowerStruggleAIProposal(
  state: WorldState,
  requestId: string,
  proposal: PowerStruggleAIProposal,
): { ok: true; state: WorldState } | { ok: false; state: WorldState; errors: string[] } {
  const candidate = state.aiJobs?.[requestId];
  const request = candidate?.kind === 'power_struggle' ? candidate : undefined;
  if (!request || request.status !== 'pending') {
    return { ok: false, state, errors: ['Demande IA introuvable ou déjà traitée.'] };
  }
  const reaction = state.stakeholderReactions[request.reactionId];
  const group = reaction && state.stakeholderGroups[reaction.groupId];
  if (!reaction || !group) return { ok: false, state, errors: ['La cause institutionnelle de la demande a disparu.'] };
  const errors = validateProposal(request, group, proposal);
  if (errors.length) return { ok: false, state, errors };

  const existingCampaign = request.campaignId ? state.powerStruggleCampaigns[request.campaignId] : undefined;
  if (request.purpose !== 'materialize_actor' && !existingCampaign) {
    return { ok: false, state, errors: ['La campagne à réévaluer n’existe plus.'] };
  }
  const plan = buildAIPlan(state, proposal, (existingCampaign?.aiPlan.revision ?? 0) + 1);
  const effects: WorldEffect[] = [];
  let tacticActorIds = existingCampaign?.instigatorActorIds ?? [];
  let tacticDossierId = existingCampaign?.dossierId ?? '';
  let tacticPressure = existingCampaign?.pressure ?? strugglePressure(group, reaction);
  let tacticMomentum = existingCampaign?.momentum ?? reaction.mobilization;
  let tacticActorInfluence = tacticActorIds.length
    ? tacticActorIds.reduce((total, actorId) => total + (state.powerActors[actorId]?.influence ?? 0), 0) / tacticActorIds.length
    : group.influence;

  if (!existingCampaign) {
    const actorInput = proposal.actor!;
    const actorId = `power-actor:${request.id}`;
    const campaignId = `power-campaign:${request.reactionId}`;
    const dossierId = `power-dossier:${request.reactionId}`;
    const actor: EmergentPowerActor = {
      id: actorId,
      countryId: request.countryId,
      stakeholderGroupId: group.id,
      name: actorInput.name.trim(),
      role: actorInput.role,
      position: actorInput.position.trim(),
      fictionalAlternateHistory: true,
      ideologyTags: [...new Set(actorInput.ideologyTags)].slice(0, 6),
      personalityTags: [...new Set(actorInput.personalityTags)].slice(0, 6),
      deepObjective: actorInput.deepObjective.trim(),
      immediateObjective: actorInput.immediateObjective.trim(),
      influence: round(clamp(actorInput.influence)),
      legitimacy: round(clamp(actorInput.legitimacy)),
      loyaltyToRegime: round(clamp(actorInput.loyaltyToRegime)),
      loyaltyToGovernment: round(clamp(actorInput.loyaltyToGovernment)),
      riskTolerance: round(clamp(actorInput.riskTolerance)),
      visibility: actorInput.initialVisibility,
      status: 'active',
      campaignIds: [campaignId],
      createdAt: state.currentDate,
      updatedAt: state.currentDate,
    };
    const pressure = strugglePressure(group, reaction);
    const campaign: PowerStruggleCampaign = {
      id: campaignId,
      countryId: request.countryId,
      subjectId: reaction.subjectId,
      stakeholderReactionId: reaction.id,
      instigatorActorIds: [actor.id],
      targetId: reaction.targetId,
      dossierId,
      status: 'emerging',
      pressure,
      momentum: round(clamp(reaction.mobilization * 0.7 + actor.influence * 0.3)),
      escalation: tacticSeverity[plan.currentTactic],
      phase: plan.publicMove,
      deepObjective: actor.deepObjective,
      aiPlan: plan,
      nextAIReviewAt: addMonths(state.currentDate, plan.reviewAfterMonths),
      lastAdvancedAt: state.currentDate,
      createdAt: state.currentDate,
      updatedAt: state.currentDate,
    };
    tacticActorIds = [actor.id];
    tacticDossierId = dossierId;
    tacticPressure = pressure;
    tacticMomentum = campaign.momentum;
    tacticActorInfluence = actor.influence;
    effects.push(
      { kind: 'power_actor_add', actor, reason: 'L’IA donne un visage persistant à une opposition institutionnelle réelle.', visibility: 'player' },
      { kind: 'power_campaign_add', campaign, reason: 'L’acteur émergent engage une stratégie persistante, distincte d’un événement isolé.', visibility: 'player' },
      {
        kind: 'dossier_add',
        dossier: {
          id: dossierId,
          title: `${actor.name} — ${reaction.label}`,
          kind: 'power_struggle', status: 'emerging', importance: reaction.level === 'critical' ? 'critical' : 'major',
          actorIds: [request.countryId, actor.id], regionTags: [request.countryId],
          startedAt: state.currentDate, updatedAt: state.currentDate,
          phase: plan.publicMove, trend: 'escalating',
          publicSummary: `${actor.position} incarne désormais ${reaction.label.toLocaleLowerCase('fr')}. ${plan.publicMove}`,
          followed: true, autoTracked: true,
          commitments: [], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [],
          entries: [{
            id: `${dossierId}:emergence`, date: state.currentDate,
            title: 'Une opposition prend un visage',
            summary: `${actor.name}, ${actor.position}, poursuit l’objectif suivant : ${plan.immediateObjective}. ${plan.publicMove}`,
            importance: reaction.level === 'critical' ? 'critical' : 'major',
            actorIds: [request.countryId, actor.id], requiresDecision: false, visibility: 'player',
          }],
        },
        reason: 'La lutte de pouvoir est suivie comme un dossier permanent.', visibility: 'player',
      },
    );
  } else {
    const pressure = strugglePressure(group, reaction);
    effects.push(
      {
        kind: 'power_campaign_patch', campaignId: existingCampaign.id,
        patch: {
          pressure,
          escalation: tacticSeverity[plan.currentTactic],
          phase: plan.publicMove,
          aiPlan: plan,
          nextAIReviewAt: addMonths(state.currentDate, plan.reviewAfterMonths),
          updatedAt: state.currentDate,
        },
        reason: 'L’IA réévalue la stratégie sans modifier directement les contraintes matérielles.', visibility: 'player',
      },
      {
        kind: 'dossier_patch', dossierId: existingCampaign.dossierId,
        patch: { phase: plan.publicMove, updatedAt: state.currentDate, trend: plan.currentTactic === 'deescalation' ? 'deescalating' : 'escalating' },
        reason: 'La nouvelle stratégie devient la phase courante du dossier.', visibility: 'player',
      },
      {
        kind: 'dossier_entry_add', dossierId: existingCampaign.dossierId,
        entry: {
          id: `${existingCampaign.dossierId}:ai-revision-${plan.revision}`,
          date: state.currentDate, title: 'Réévaluation stratégique',
          summary: plan.publicMove, importance: plan.currentTactic === 'extra_constitutional_preparation' ? 'critical' : 'moderate',
          actorIds: [request.countryId, ...existingCampaign.instigatorActorIds],
          requiresDecision: false, visibility: 'player',
        },
        reason: 'La manifestation choisie par l’IA rejoint la mémoire du dossier.', visibility: 'player',
      },
    );
    for (const actorId of existingCampaign.instigatorActorIds) effects.push({
      kind: 'power_actor_patch', actorId,
      patch: { immediateObjective: plan.immediateObjective, updatedAt: state.currentDate },
      reason: 'La réévaluation IA actualise l’objectif immédiat sans effacer la personnalité de l’acteur.', visibility: 'player',
    });
  }
  effects.push(...powerTacticEffects(state, {
    countryId: request.countryId,
    actorIds: tacticActorIds,
    reactionId: reaction.id,
    dossierId: tacticDossierId,
    category: group.category,
    pressure: tacticPressure,
    momentum: tacticMomentum,
    actorInfluence: tacticActorInfluence,
    plan,
  }));
  effects.push({
    kind: 'ai_job_patch', jobId: requestId,
    patch: { status: 'resolved', resolvedAt: state.currentDate },
    reason: 'Le plan IA a été validé et intégré au monde.', visibility: 'debug',
  });
  return {
    ok: true,
    state: commitWorldAction(state, {
      kind: 'political', actorId: request.countryId, origin: 'ai',
      targetIds: existingCampaign?.instigatorActorIds ?? [],
      intent: existingCampaign ? 'Réévaluer une lutte de pouvoir' : 'Incarner une opposition institutionnelle',
      effects,
      metadata: { requestId, planRevision: plan.revision },
    }),
  };
}

/**
 * Le temps actualise les moyens objectifs et fait évoluer la crise, mais ne
 * choisit jamais une nouvelle tactique à la place de l'IA ou du joueur. Les
 * seuils servent uniquement à rendre la boucle jouable : émergence → lutte
 * active → désescalade, avec une décision explicite lorsque la pression
 * devient politiquement coûteuse.
 */
export function advancePowerStruggles(state: WorldState, elapsedMonths: number) {
  if (elapsedMonths <= 0) return state;
  const effects: WorldEffect[] = [];
  for (const campaign of Object.values(state.powerStruggleCampaigns ?? {})) {
    if (campaign.status === 'resolved') continue;
    const reaction = state.stakeholderReactions[campaign.stakeholderReactionId];
    const group = reaction && state.stakeholderGroups[reaction.groupId];
    if (!reaction || !group) continue;
    const dossier = state.strategicDossiers[campaign.dossierId];
    const pressure = strugglePressure(group, reaction);
    const momentum = round(clamp(campaign.momentum + (pressure - campaign.pressure) * 0.35 - elapsedMonths * 0.25));
    const status = campaignStatusFor(campaign, pressure, reaction, dossier?.status);
    const phaseCandidate = campaignPhaseFor(status, pressure);
    const phaseChanged = status !== campaign.status || pressureBand(pressure) !== pressureBand(campaign.pressure);
    const phase = phaseChanged ? phaseCandidate : campaign.phase;
    const trend = campaignTrendFor(campaign.pressure, pressure, status);
    const quietMonths = status === 'deescalating' ? (campaign.quietMonths ?? 0) + elapsedMonths : 0;
    const pressureJumped = pressure >= 68 && campaign.pressure < 68;
    const playerLed = campaign.countryId === state.playerCountryId;
    const pendingDecision = dossier?.decisionRecords?.some((record) =>
      record.status === 'pending' && record.sourceId === campaign.id) ?? false;
    const decisionNeeded = Boolean(dossier && playerLed && !pendingDecision && pressureJumped);
    const actorName = campaign.instigatorActorIds
      .map((id) => state.powerActors[id]?.name)
      .find(Boolean) ?? 'L’acteur émergent';
    const patch: Partial<PowerStruggleCampaign> = {
      pressure, momentum, status, phase, quietMonths,
      lastAdvancedAt: state.currentDate, updatedAt: state.currentDate,
    };
    effects.push({
      kind: 'power_campaign_patch', campaignId: campaign.id, patch,
      reason: 'Les moyens de la campagne suivent l’évolution réelle de sa base institutionnelle.', visibility: 'debug',
    });

    if (dossier && phaseChanged) {
      const importance = dossier.importance;
      effects.push(
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: { status, trend, phase, updatedAt: state.currentDate },
          reason: 'La phase de la lutte de pouvoir est synchronisée avec la pression institutionnelle.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `${dossier.id}:campaign-phase:${state.currentDate}:${status}`,
            date: state.currentDate,
            title: status === 'active' ? 'La contestation devient active' : status === 'deescalating' ? 'La contestation entre en désescalade' : 'Une tension politique se forme',
            summary: `${actorName} · ${phase}. Pression institutionnelle estimée : ${pressure}/100.`,
            importance, actorIds: dossier.actorIds, requiresDecision: decisionNeeded, visibility: 'player',
          },
          reason: 'Le changement de phase devient lisible dans la chronologie du dossier.', visibility: 'player',
        },
      );
    }

    if (decisionNeeded && dossier) {
      const prompt = `Répondre à la montée de la contestation portée par ${actorName} dans « ${dossier.title} ».`;
      const decision = makeDossierDecision({
        id: `${dossier.id}:power-decision:${state.currentDate}`,
        prompt, createdAt: state.currentDate,
        importance: dossier.importance, actorIds: dossier.actorIds,
        sourceKind: 'player_action', sourceId: campaign.id, sourceLabel: actorName,
      });
      effects.push(
        {
          kind: 'dossier_patch', dossierId: dossier.id,
          patch: {
            pendingDecisions: [...new Set([...dossier.pendingDecisions, prompt])],
            decisionRecords: [...(dossier.decisionRecords ?? []), decision],
            updatedAt: state.currentDate,
          },
          reason: 'Une contestation devenue coûteuse exige un arbitrage du gouvernement joueur.', visibility: 'player',
        },
        {
          kind: 'dossier_entry_add', dossierId: dossier.id,
          entry: {
            id: `${dossier.id}:power-decision:${state.currentDate}`,
            date: state.currentDate, title: 'Arbitrage gouvernemental requis',
            summary: `${actorName} a franchi un seuil de pression. Le joueur peut négocier, concéder, contenir ou ignorer.`,
            importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: true, visibility: 'player',
          },
          reason: 'La crise ne s’auto-résout pas lorsque le pouvoir du joueur est directement engagé.', visibility: 'player',
        },
      );
    }

    const due = state.currentDate >= campaign.nextAIReviewAt;
    const shifted = Math.abs(pressure - campaign.pressure) >= 10
      && campaign.aiPlan.reassessmentTriggers.includes('pressure_shift');
    const needsReview = due || shifted || reaction.status === 'resolved' || phaseChanged;
    if (needsReview && !pendingRequestFor(state, reaction.id, campaign.id)) {
      const request: PowerStruggleAIRequest = {
        id: `power-ai-review:${campaign.id}:${campaign.aiPlan.revision + 1}`,
        kind: 'power_struggle', schemaVersion: 1,
        priority: reaction.level === 'critical' ? 'urgent' : phaseChanged ? 'normal' : 'background', budgetTier: 'standard', attempts: 0,
        purpose: 'reassess_campaign', countryId: campaign.countryId,
        reactionId: reaction.id, campaignId: campaign.id,
        status: 'pending', requestedAt: state.currentDate,
        reasons: [
          ...(due ? ['L’horizon fixé par le plan précédent est atteint.'] : []),
          ...(shifted ? [`La pression institutionnelle est passée de ${campaign.pressure} à ${pressure}.`] : []),
          ...(phaseChanged ? [`La campagne change de phase : ${phase}.`] : []),
          ...(reaction.status === 'resolved' ? ['La contestation collective qui soutenait la campagne s’est résorbée.'] : []),
        ],
        context: compactContext(state, group, { ...reaction, defiance: reaction.defiance }, { ...campaign, pressure, momentum }),
      };
      effects.push({
        kind: 'ai_job_add', job: request,
        reason: 'Un changement charnière demande à l’IA de réinterpréter la stratégie de l’acteur.', visibility: 'debug',
      });
    }
  }
  if (!effects.length) return state;
  return commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId, origin: 'time',
    intent: 'Actualiser les luttes de pouvoir', visibility: 'debug', effects,
  });
}

/**
 * Résolution locale d'un arbitrage de lutte de pouvoir. Elle permet au joueur
 * de faire avancer un dossier sans attendre un appel Luna ; une réponse libre
 * reste toujours possible via submitPowerStrugglePlayerResponse.
 */
export function resolvePowerStrugglePlayerDecision(
  state: WorldState,
  campaignId: string,
  decision: PowerStrugglePlayerDecision,
): { ok: true; state: WorldState } | { ok: false; state: WorldState; error: string } {
  const campaign = state.powerStruggleCampaigns?.[campaignId];
  if (!campaign || campaign.status === 'resolved') return { ok: false, state, error: 'Lutte de pouvoir introuvable ou déjà close.' };
  if (campaign.countryId !== state.playerCountryId) return { ok: false, state, error: 'Cette lutte ne relève pas du gouvernement joueur.' };
  const dossier = state.strategicDossiers?.[campaign.dossierId];
  const reaction = state.stakeholderReactions[campaign.stakeholderReactionId];
  const group = reaction && state.stakeholderGroups[reaction.groupId];
  if (!dossier || !reaction || !group) return { ok: false, state, error: 'La base institutionnelle de cette lutte n’est plus disponible.' };
  const record = (dossier.decisionRecords ?? []).find((item) => item.sourceId === campaignId && item.status === 'pending');
  if (!record || !dossier.pendingDecisions.includes(record.prompt)) return { ok: false, state, error: 'Aucun arbitrage local n’est actuellement attendu pour cette lutte.' };

  const strength = clamp(campaign.pressure * 0.45 + campaign.momentum * 0.3 + group.influence * 0.25) / 100;
  const deltas: Record<PowerStrugglePlayerDecision, { defiance: number; mobilization: number; stability: number; budget: number; approval: number; compliance: number; campaignStatus: PowerStruggleCampaign['status']; trend: 'stable' | 'escalating' | 'deescalating'; phase: string }> = {
    negotiate: { defiance: -9, mobilization: -7, stability: 0.2, budget: -0.2, approval: 0.8, compliance: 0, campaignStatus: 'active', trend: 'stable', phase: 'Négociation politique' },
    concede: { defiance: -16, mobilization: -12, stability: 0.6, budget: -1.2, approval: -0.4, compliance: 0.2, campaignStatus: 'deescalating', trend: 'deescalating', phase: 'Compromis en mise en œuvre' },
    contain: { defiance: 6, mobilization: 5, stability: -1.1, budget: -0.1, approval: 0.4, compliance: -0.7, campaignStatus: 'active', trend: 'escalating', phase: 'Confrontation contenue' },
    ignore: { defiance: 4, mobilization: 5, stability: -0.6, budget: 0, approval: -1.1, compliance: -0.4, campaignStatus: 'active', trend: 'escalating', phase: 'Silence gouvernemental' },
  };
  const effect = deltas[decision];
  const defiance = round(clamp(reaction.defiance + effect.defiance * strength));
  const mobilization = round(clamp(reaction.mobilization + effect.mobilization * strength));
  const level = qualitativeReactionLevel(defiance, reaction.level);
  const decisionRecords = (dossier.decisionRecords ?? []).map((item) => item.id === record.id
    ? { ...item, status: 'resolved' as const, resolvedAt: state.currentDate, resolutionChannel: 'local_action' as const }
    : item);
  const pendingDecisions = dossier.pendingDecisions.filter((prompt) => prompt !== record.prompt);
  const actorName = campaign.instigatorActorIds.map((id) => state.powerActors[id]?.name).find(Boolean) ?? 'L’acteur émergent';
  const summaries: Record<PowerStrugglePlayerDecision, string> = {
    negotiate: `Le gouvernement ouvre une négociation avec ${actorName}. La contestation baisse légèrement, mais l’acteur obtient une place reconnue dans le processus.`,
    concede: `Le gouvernement accorde une concession ciblée à ${actorName}. La mobilisation recule, au prix d’un coût budgétaire et d’un recul politique limités.`,
    contain: `Le gouvernement choisit de contenir ${actorName}. La réforme est maintenue, mais la pression et la polarisation augmentent.`,
    ignore: `Le gouvernement ignore publiquement ${actorName}. Aucun moyen supplémentaire n’est engagé, mais la contestation gagne du temps et de la visibilité.`,
  };
  const effects: WorldEffect[] = [
    {
      kind: 'stakeholder_reaction_patch', reactionId: reaction.id,
      patch: { defiance, mobilization, level, trend: effect.trend === 'stable' ? 'falling' : effect.trend === 'deescalating' ? 'falling' : 'rising', updatedAt: state.currentDate, status: level === 'low' ? 'subsiding' : 'active' },
      reason: 'L’arbitrage du gouvernement modifie directement la base de mobilisation de la contestation.', visibility: 'player',
    },
    { kind: 'metric_delta', countryId: campaign.countryId, metric: 'stability', delta: effect.stability * strength, reason: summaries[decision], visibility: 'player' },
    ...(effect.budget ? [{ kind: 'metric_delta' as const, countryId: campaign.countryId, metric: 'budget' as const, delta: effect.budget * strength, reason: 'La réponse politique mobilise ou économise une marge budgétaire limitée.', visibility: 'player' as const }] : []),
    {
      kind: 'politics_patch', countryId: campaign.countryId,
      patch: { publicApproval: round(clamp(state.countries[campaign.countryId].politics.publicApproval + effect.approval * strength)), administrativeCompliance: round(clamp(state.countries[campaign.countryId].politics.administrativeCompliance + effect.compliance * strength)) },
      reason: 'La réponse modifie la crédibilité et la capacité d’exécution du gouvernement.', visibility: 'player',
    },
    {
      kind: 'power_campaign_patch', campaignId,
      patch: { status: effect.campaignStatus, phase: effect.phase, quietMonths: effect.campaignStatus === 'deescalating' ? 1 : 0, lastPlayerDecision: decision, lastPlayerDecisionAt: state.currentDate, pressure: strugglePressure(group, { ...reaction, defiance, mobilization }), momentum: round(clamp(campaign.momentum + (effect.campaignStatus === 'deescalating' ? -8 : decision === 'ignore' ? 4 : -3) * strength)), updatedAt: state.currentDate },
      reason: 'Le choix du joueur devient la nouvelle phase de la campagne sans supprimer la possibilité d’une réévaluation IA.', visibility: 'player',
    },
    {
      kind: 'dossier_patch', dossierId: dossier.id,
      patch: { pendingDecisions, decisionRecords, playerStance: powerStruggleDecisionLabels[decision], status: effect.campaignStatus === 'deescalating' ? 'deescalating' : 'active', trend: effect.trend, phase: effect.phase, updatedAt: state.currentDate },
      reason: 'L’arbitrage est retiré de la file d’attente et inscrit dans la trajectoire du dossier.', visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId: dossier.id,
      entry: { id: `${dossier.id}:player-decision:${state.currentDate}:${decision}`, date: state.currentDate, title: powerStruggleDecisionLabels[decision], summary: summaries[decision], importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player' },
      reason: 'Le choix politique est conservé dans la chronologie du dossier.', visibility: 'player',
    },
  ];
  return { ok: true, state: commitWorldAction(state, { kind: 'political', actorId: state.playerCountryId, targetIds: campaign.instigatorActorIds, origin: 'player', visibility: 'player', intent: powerStruggleDecisionLabels[decision], effects }) };
}

export function pendingPowerStruggleAIRequests(state: WorldState) {
  return Object.values(state.aiJobs ?? {})
    .filter((request): request is PowerStruggleAIRequest => request.kind === 'power_struggle' && request.status === 'pending')
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id));
}

/** Une réponse libre du joueur devient un nouveau point d'interprétation, pas un embranchement codé. */
export function submitPowerStrugglePlayerResponse(state: WorldState, campaignId: string, response: string) {
  const campaign = state.powerStruggleCampaigns?.[campaignId];
  if (!campaign || campaign.status === 'resolved' || !response.trim()) {
    return { ok: false as const, state, error: 'Campagne introuvable, terminée ou réponse vide.' };
  }
  const reaction = state.stakeholderReactions[campaign.stakeholderReactionId];
  const group = reaction && state.stakeholderGroups[reaction.groupId];
  if (!reaction || !group) return { ok: false as const, state, error: 'Base institutionnelle introuvable.' };
  const pending = Object.values(state.aiJobs ?? {}).filter((request): request is PowerStruggleAIRequest =>
    request.kind === 'power_struggle' && request.campaignId === campaignId && request.status === 'pending');
  const request: PowerStruggleAIRequest = {
    id: `power-ai-response:${campaign.id}:${state.sequence + 1}`,
    kind: 'power_struggle', schemaVersion: 1,
    priority: 'urgent', budgetTier: 'standard', attempts: 0,
    purpose: 'react_to_player', countryId: campaign.countryId,
    reactionId: reaction.id, campaignId: campaign.id,
    status: 'pending', requestedAt: state.currentDate,
    reasons: ['Le joueur a adressé une réponse directe aux protagonistes du dossier.'],
    context: compactContext(state, group, reaction, campaign, response.trim()),
  };
  const effects: WorldEffect[] = [
    ...pending.map((item): WorldEffect => ({
      kind: 'ai_job_patch', jobId: item.id, patch: { status: 'cancelled' },
      reason: 'La réponse du joueur rend prioritaire une nouvelle réévaluation.', visibility: 'debug',
    })),
    { kind: 'ai_job_add', job: request, reason: 'La réponse libre doit être interprétée par l’acteur IA.', visibility: 'debug' },
    {
      kind: 'dossier_entry_add', dossierId: campaign.dossierId,
      entry: {
        id: `${campaign.dossierId}:player-response:${state.sequence + 1}`,
        date: state.currentDate, title: 'Réponse du gouvernement', summary: response.trim(),
        importance: 'moderate', actorIds: [state.playerCountryId, ...campaign.instigatorActorIds],
        requiresDecision: false, visibility: 'player',
      },
      reason: 'La réponse du joueur est conservée avant toute interprétation de l’IA.', visibility: 'player',
    },
  ];
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'political', actorId: state.playerCountryId, targetIds: campaign.instigatorActorIds,
      origin: 'player', intent: `Répondre au dossier « ${state.strategicDossiers[campaign.dossierId]?.title ?? campaign.id} »`,
      effects,
    }),
    requestId: request.id,
  };
}
