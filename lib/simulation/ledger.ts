import type {
  ActionDraft,
  BilateralRelation,
  CountryId,
  WorldAction,
  WorldChange,
  WorldEffect,
  WorldState,
} from './types';

import { synchronizeTerritorialEconomy } from './territories';

const relationKey = (from: CountryId, to: CountryId) => `${from}:${to}`;
const intelligenceKey = (observerId: CountryId, targetId: CountryId) => `${observerId}:${targetId}`;

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

function nextId(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

function appendChange(
  state: WorldState,
  action: WorldAction,
  effect: WorldEffect,
  path: string,
  before: unknown,
  after: unknown,
): WorldState {
  const sequence = state.sequence + 1;
  const change: WorldChange = {
    id: nextId('chg', sequence),
    actionId: action.id,
    date: state.currentDate,
    actorId: action.actorId,
    path,
    before,
    after,
    reason: effect.reason,
    origin: action.origin,
    visibility: effect.visibility ?? action.visibility ?? 'player',
  };
  return { ...state, sequence, ledger: [...state.ledger, change] };
}

function applyEffect(state: WorldState, action: WorldAction, effect: WorldEffect): WorldState {
  if (effect.kind === 'date_set') {
    const before = state.currentDate;
    const next = { ...state, currentDate: effect.date };
    return appendChange(next, action, effect, 'currentDate', before, effect.date);
  }

  if (effect.kind === 'processed_stop_add') {
    const before = state.processedStopIds;
    const after = before.includes(effect.stopId) ? before : [...before, effect.stopId];
    const next = { ...state, processedStopIds: after };
    return appendChange(next, action, effect, 'processedStopIds', before, after);
  }

  if (effect.kind === 'metric_delta') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const before = country.metrics[effect.metric];
    const rawAfter = before + effect.delta;
    const after = effect.metric === 'budget' ? rawAfter : effect.metric === 'industry' ? Math.max(0, rawAfter) : clamp(rawAfter);
    const next = {
      ...state,
      countries: {
        ...state.countries,
        [effect.countryId]: {
          ...country,
          metrics: { ...country.metrics, [effect.metric]: Number(after.toFixed(3)) },
        },
      },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.metrics.${effect.metric}`, before, Number(after.toFixed(3)));
  }

  if (effect.kind === 'politics_patch') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, country.politics[key as keyof typeof country.politics]]));
    const rawPolitics = { ...country.politics, ...effect.patch };
    const afterPolitics = {
      ...rawPolitics,
      publicApproval: Number(clamp(rawPolitics.publicApproval).toFixed(3)),
      administrativeCompliance: Number(clamp(rawPolitics.administrativeCompliance).toFixed(3)),
    };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterPolitics[key as keyof typeof afterPolitics]]));
    const next = {
      ...state,
      countries: { ...state.countries, [effect.countryId]: { ...country, politics: afterPolitics } },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.politics`, before, after);
  }

  if (effect.kind === 'country_strategy_patch') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const after = { ...country.strategy, ...effect.patch };
    const next = {
      ...state,
      countries: { ...state.countries, [effect.countryId]: { ...country, strategy: after } },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.strategy`, country.strategy, after);
  }

  if (effect.kind === 'capacity_commitment' || effect.kind === 'capacity_maximum') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const capacity = country.capacities[effect.domain];
    const field = effect.kind === 'capacity_commitment' ? 'committed' : 'maximum';
    const before = capacity[field];
    const after = field === 'committed' ? Math.max(0, before + effect.delta) : Math.max(1, before + effect.delta);
    const next = {
      ...state,
      countries: {
        ...state.countries,
        [effect.countryId]: {
          ...country,
          capacities: {
            ...country.capacities,
            [effect.domain]: { ...capacity, [field]: Number(after.toFixed(3)) },
          },
        },
      },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.capacities.${effect.domain}.${field}`, before, Number(after.toFixed(3)));
  }

  if (effect.kind === 'relation_delta') {
    const key = relationKey(effect.from, effect.to);
    const current: BilateralRelation = state.relations[key] ?? {
      from: effect.from,
      to: effect.to,
      relation: 50,
      trust: 50,
      tradeIntensity: 0,
      securityAlignment: 0,
      memories: [],
    };
    const before = { relation: current.relation, trust: current.trust };
    const after = {
      relation: clamp(current.relation + effect.relation),
      trust: clamp(current.trust + effect.trust),
    };
    const next = {
      ...state,
      relations: { ...state.relations, [key]: { ...current, ...after } },
    };
    return appendChange(next, action, effect, `relations.${key}`, before, after);
  }

  if (effect.kind === 'intelligence_delta') {
    const key = intelligenceKey(effect.observerId, effect.targetId);
    const before = state.intelligence[key] ?? 0;
    const after = clamp(before + effect.delta);
    const next = { ...state, intelligence: { ...state.intelligence, [key]: after } };
    return appendChange(next, action, effect, `intelligence.${key}`, before, after);
  }

  if (effect.kind === 'institution_patch') {
    const institution = state.institutions[effect.institutionId];
    if (!institution) return state;
    const after = { ...institution, ...effect.patch };
    const next = { ...state, institutions: { ...state.institutions, [effect.institutionId]: after } };
    return appendChange(next, action, effect, `institutions.${effect.institutionId}`, institution, after);
  }

  if (effect.kind === 'treaty_add') {
    const before = state.treaties[effect.treaty.id] ?? null;
    if (before) return state;
    const next = { ...state, treaties: { ...state.treaties, [effect.treaty.id]: effect.treaty } };
    return appendChange(next, action, effect, `treaties.${effect.treaty.id}`, before, effect.treaty);
  }

  if (effect.kind === 'treaty_patch') {
    const treaty = state.treaties[effect.treatyId];
    if (!treaty) return state;
    const after = { ...treaty, ...effect.patch };
    const next = { ...state, treaties: { ...state.treaties, [effect.treatyId]: after } };
    return appendChange(next, action, effect, `treaties.${effect.treatyId}`, treaty, after);
  }

  if (effect.kind === 'historical_pressure') {
    const current = state.historicalCurrents[effect.currentId];
    if (!current) return state;
    const before = current.pressure;
    const after = clamp(before + effect.delta);
    const next = {
      ...state,
      historicalCurrents: {
        ...state.historicalCurrents,
        [effect.currentId]: { ...current, pressure: after },
      },
    };
    return appendChange(next, action, effect, `historicalCurrents.${effect.currentId}.pressure`, before, after);
  }

  if (effect.kind === 'latent_process_patch') {
    const process = state.latentProcesses[effect.processId];
    if (!process) return state;
    const after = { ...process, ...effect.patch };
    const next = { ...state, latentProcesses: { ...state.latentProcesses, [effect.processId]: after } };
    return appendChange(next, action, effect, `latentProcesses.${effect.processId}`, process, after);
  }

  if (effect.kind === 'energy_contract_add') {
    const before = state.energyContracts[effect.contract.id] ?? null;
    const next = {
      ...state,
      energyContracts: { ...state.energyContracts, [effect.contract.id]: effect.contract },
    };
    return appendChange(next, action, effect, `energyContracts.${effect.contract.id}`, before, effect.contract);
  }

  if (effect.kind === 'energy_contract_patch') {
    const contract = state.energyContracts[effect.contractId];
    if (!contract) return state;
    const after = { ...contract, ...effect.patch };
    const next = { ...state, energyContracts: { ...state.energyContracts, [effect.contractId]: after } };
    return appendChange(next, action, effect, `energyContracts.${effect.contractId}`, contract, after);
  }

  if (effect.kind === 'energy_node_patch') {
    const node = state.energyNodes[effect.nodeId];
    if (!node) return state;
    const after = { ...node, ...effect.patch };
    const next = { ...state, energyNodes: { ...state.energyNodes, [effect.nodeId]: after } };
    return appendChange(next, action, effect, `energyNodes.${effect.nodeId}`, node, after);
  }

  if (effect.kind === 'energy_stock_delta') {
    const energy = state.countryEnergy[effect.countryId];
    if (!energy) return state;
    const before = energy.strategicStocks[effect.resource];
    const after = Math.min(
      energy.storageCapacity[effect.resource],
      Math.max(0, before + effect.delta),
    );
    const next = {
      ...state,
      countryEnergy: {
        ...state.countryEnergy,
        [effect.countryId]: {
          ...energy,
          strategicStocks: { ...energy.strategicStocks, [effect.resource]: Number(after.toFixed(3)) },
        },
      },
    };
    return appendChange(next, action, effect, `countryEnergy.${effect.countryId}.strategicStocks.${effect.resource}`, before, Number(after.toFixed(3)));
  }

  if (effect.kind === 'diplomatic_session_add') {
    const sessions = state.diplomaticSessions ?? {};
    const before = sessions[effect.session.id] ?? null;
    const after = before ?? effect.session;
    const next = { ...state, diplomaticSessions: { ...sessions, [effect.session.id]: after } };
    return appendChange(next, action, effect, `diplomaticSessions.${effect.session.id}`, before, after);
  }

  if (effect.kind === 'diplomatic_session_patch') {
    const session = state.diplomaticSessions?.[effect.sessionId];
    if (!session) return state;
    const after = { ...session, ...effect.patch };
    const next = { ...state, diplomaticSessions: { ...state.diplomaticSessions, [effect.sessionId]: after } };
    return appendChange(next, action, effect, `diplomaticSessions.${effect.sessionId}`, session, after);
  }

  if (effect.kind === 'diplomatic_dialogue_add') {
    const dialogues = state.diplomaticDialogues ?? {};
    const before = dialogues[effect.dialogue.id] ?? null;
    const after = before ?? effect.dialogue;
    const next = { ...state, diplomaticDialogues: { ...dialogues, [effect.dialogue.id]: after } };
    return appendChange(next, action, effect, `diplomaticDialogues.${effect.dialogue.id}`, before, after);
  }

  if (effect.kind === 'diplomatic_dialogue_patch') {
    const dialogue = state.diplomaticDialogues?.[effect.dialogueId];
    if (!dialogue) return state;
    const after = { ...dialogue, ...effect.patch };
    const next = { ...state, diplomaticDialogues: { ...state.diplomaticDialogues, [effect.dialogueId]: after } };
    return appendChange(next, action, effect, `diplomaticDialogues.${effect.dialogueId}`, dialogue, after);
  }

  if (effect.kind === 'sector_patch') {
    const sector = state.sectors[effect.sectorId];
    if (!sector) return state;
    const after = { ...sector, ...effect.patch };
    const next = { ...state, sectors: { ...state.sectors, [effect.sectorId]: after } };
    return appendChange(next, action, effect, `sectors.${effect.sectorId}`, sector, after);
  }

  if (effect.kind === 'sector_delta') {
    const sector = state.sectors[effect.sectorId];
    if (!sector) return state;
    const bounded = (key: string, value: number) => key === 'workloadMonths'
      ? Math.max(0, value) : clamp(value);
    const patch = Object.fromEntries(Object.entries(effect.delta).map(([key, delta]) => {
      const current = sector[key as keyof typeof sector];
      return [key, typeof current === 'number' && typeof delta === 'number' ? bounded(key, current + delta) : current];
    })) as Partial<typeof sector>;
    const after = { ...sector, ...patch };
    const next = { ...state, sectors: { ...state.sectors, [effect.sectorId]: after } };
    return appendChange(next, action, effect, `sectors.${effect.sectorId}`, sector, after);
  }

  if (effect.kind === 'dossier_add') {
    const dossiers = state.strategicDossiers ?? {};
    const before = dossiers[effect.dossier.id] ?? null;
    const after = before ?? effect.dossier;
    const next = { ...state, strategicDossiers: { ...dossiers, [effect.dossier.id]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossier.id}`, before, after);
  }

  if (effect.kind === 'dossier_patch') {
    const dossier = state.strategicDossiers?.[effect.dossierId];
    if (!dossier) return state;
    const after = { ...dossier, ...effect.patch };
    const next = { ...state, strategicDossiers: { ...state.strategicDossiers, [effect.dossierId]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossierId}`, dossier, after);
  }

  if (effect.kind === 'dossier_entry_add') {
    const dossier = state.strategicDossiers?.[effect.dossierId];
    if (!dossier || dossier.entries.some((entry) => entry.id === effect.entry.id)) return state;
    const entry = { ...effect.entry, sourceActionId: effect.entry.sourceActionId ?? action.id };
    const after = {
      ...dossier,
      updatedAt: entry.date,
      relatedActionIds: dossier.relatedActionIds.includes(action.id) ? dossier.relatedActionIds : [...dossier.relatedActionIds, action.id],
      entries: [...dossier.entries, entry],
    };
    const next = { ...state, strategicDossiers: { ...state.strategicDossiers, [effect.dossierId]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossierId}.entries.${entry.id}`, null, entry);
  }

  if (effect.kind === 'macro_patch') {
    const economy = state.macroEconomies[effect.countryId];
    if (!economy) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, economy[key as keyof typeof economy]]));
    const afterEconomy = { ...economy, ...effect.patch };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterEconomy[key as keyof typeof afterEconomy]]));
    let next = { ...state, macroEconomies: { ...state.macroEconomies, [effect.countryId]: afterEconomy } };
    next = appendChange(next, action, effect, `macroEconomies.${effect.countryId}`, before, after);
    if (effect.patch.populationMillions !== undefined || effect.patch.realGdpBillion2000Usd !== undefined) {
      const territorial = synchronizeTerritorialEconomy(state.territorial, effect.countryId, afterEconomy.populationMillions * 1e6, afterEconomy.realGdpBillion2000Usd);
      // Store aggregate reconciliation only, never thousands of region snapshots per month.
      // The original macro effect deterministically replays the proportional allocation.
      const ids = territorial.accountingTerritoryIds[effect.countryId] ?? [];
      const amounts = (registry: typeof territorial) => ({
        regionCount: ids.length,
        population: ids.reduce((sum, id) => sum + (registry.territories[id].population ?? 0), 0),
        gdp: ids.reduce((sum, id) => sum + (registry.territories[id].realGdpBillion2000Usd ?? 0), 0),
      });
      next = appendChange({ ...next, territorial }, action, effect, `territorial.accounting.${effect.countryId}`, amounts(state.territorial), amounts(territorial));
    }
    return next;
  }

  if (effect.kind === 'macro_policy_delta') {
    const economy = state.macroEconomies[effect.countryId];
    if (!economy) return state;
    const before = economy.policy;
    const policy = Object.fromEntries(Object.entries(effect.patch).map(([key, delta]) => {
      const current = before[key as keyof typeof before];
      const numericDelta = typeof delta === 'number' ? delta : 0;
      return [key, typeof current === 'number' ? clamp(current + numericDelta) : current];
    })) as Partial<typeof before>;
    const afterPolicy = { ...before, ...policy };
    const afterEconomy = { ...economy, policy: afterPolicy };
    const next = { ...state, macroEconomies: { ...state.macroEconomies, [effect.countryId]: afterEconomy } };
    return appendChange(next, action, effect, `macroEconomies.${effect.countryId}.policy`, before, afterPolicy);
  }

  if (effect.kind === 'world_economy_patch') {
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, state.worldEconomy[key as keyof typeof state.worldEconomy]]));
    const afterEconomy = { ...state.worldEconomy, ...effect.patch };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterEconomy[key as keyof typeof afterEconomy]]));
    const next = { ...state, worldEconomy: afterEconomy };
    return appendChange(next, action, effect, 'worldEconomy', before, after);
  }

  if (effect.kind === 'structural_profile_patch') {
    const profile = state.structuralProfiles[effect.countryId];
    if (!profile) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, profile[key as keyof typeof profile]]));
    const afterProfile = { ...profile, ...effect.patch };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterProfile[key as keyof typeof afterProfile]]));
    const next = { ...state, structuralProfiles: { ...state.structuralProfiles, [effect.countryId]: afterProfile } };
    return appendChange(next, action, effect, `structuralProfiles.${effect.countryId}`, before, after);
  }

  if (effect.kind === 'stakeholder_group_add') {
    const before = state.stakeholderGroups[effect.group.id] ?? null;
    const after = before ?? effect.group;
    const next = { ...state, stakeholderGroups: { ...state.stakeholderGroups, [effect.group.id]: after } };
    return appendChange(next, action, effect, `stakeholderGroups.${effect.group.id}`, before, after);
  }

  if (effect.kind === 'stakeholder_reaction_add') {
    const before = state.stakeholderReactions[effect.reaction.id] ?? null;
    const after = before ?? effect.reaction;
    const next = { ...state, stakeholderReactions: { ...state.stakeholderReactions, [effect.reaction.id]: after } };
    return appendChange(next, action, effect, `stakeholderReactions.${effect.reaction.id}`, before, after);
  }

  if (effect.kind === 'stakeholder_reaction_patch') {
    const reaction = state.stakeholderReactions[effect.reactionId];
    if (!reaction) return state;
    const after = { ...reaction, ...effect.patch };
    const next = { ...state, stakeholderReactions: { ...state.stakeholderReactions, [effect.reactionId]: after } };
    return appendChange(next, action, effect, `stakeholderReactions.${effect.reactionId}`, reaction, after);
  }

  if (effect.kind === 'power_actor_add') {
    const actors = state.powerActors ?? {};
    const before = actors[effect.actor.id] ?? null;
    const after = before ?? effect.actor;
    const next = { ...state, powerActors: { ...actors, [effect.actor.id]: after } };
    return appendChange(next, action, effect, `powerActors.${effect.actor.id}`, before, after);
  }

  if (effect.kind === 'power_actor_patch') {
    const actor = state.powerActors?.[effect.actorId];
    if (!actor) return state;
    const after = { ...actor, ...effect.patch };
    const next = { ...state, powerActors: { ...state.powerActors, [effect.actorId]: after } };
    return appendChange(next, action, effect, `powerActors.${effect.actorId}`, actor, after);
  }

  if (effect.kind === 'power_campaign_add') {
    const campaigns = state.powerStruggleCampaigns ?? {};
    const before = campaigns[effect.campaign.id] ?? null;
    const after = before ?? effect.campaign;
    const next = { ...state, powerStruggleCampaigns: { ...campaigns, [effect.campaign.id]: after } };
    return appendChange(next, action, effect, `powerStruggleCampaigns.${effect.campaign.id}`, before, after);
  }

  if (effect.kind === 'power_campaign_patch') {
    const campaign = state.powerStruggleCampaigns?.[effect.campaignId];
    if (!campaign) return state;
    const after = { ...campaign, ...effect.patch };
    const next = { ...state, powerStruggleCampaigns: { ...state.powerStruggleCampaigns, [effect.campaignId]: after } };
    return appendChange(next, action, effect, `powerStruggleCampaigns.${effect.campaignId}`, campaign, after);
  }

  if (effect.kind === 'ai_job_add') {
    const jobs = state.aiJobs ?? {};
    const before = jobs[effect.job.id] ?? null;
    const after = before ?? effect.job;
    const next = { ...state, aiJobs: { ...jobs, [effect.job.id]: after } };
    return appendChange(next, action, effect, `aiJobs.${effect.job.id}`, before, after);
  }

  if (effect.kind === 'ai_job_patch') {
    const job = state.aiJobs?.[effect.jobId];
    if (!job) return state;
    const after = { ...job, ...effect.patch } as typeof job;
    const next = { ...state, aiJobs: { ...state.aiJobs, [effect.jobId]: after } };
    return appendChange(next, action, effect, `aiJobs.${effect.jobId}`, job, after);
  }

  if (effect.kind === 'action_program_add') {
    const programs = state.actionPrograms ?? {};
    const before = programs[effect.program.id] ?? null;
    const after = before ?? effect.program;
    const next = { ...state, actionPrograms: { ...programs, [effect.program.id]: after } };
    return appendChange(next, action, effect, `actionPrograms.${effect.program.id}`, before, after);
  }

  if (effect.kind === 'action_program_patch') {
    const program = state.actionPrograms?.[effect.programId];
    if (!program) return state;
    const after = { ...program, ...effect.patch };
    const next = { ...state, actionPrograms: { ...state.actionPrograms, [effect.programId]: after } };
    return appendChange(next, action, effect, `actionPrograms.${effect.programId}`, program, after);
  }

  const product = state.armamentProducts[effect.productId];
  if (!product) return state;
  const after = { ...product, ...effect.patch };
  const next = { ...state, armamentProducts: { ...state.armamentProducts, [effect.productId]: after } };
  return appendChange(next, action, effect, `armamentProducts.${effect.productId}`, product, after);
}

export function commitWorldAction(state: WorldState, draft: ActionDraft): WorldState {
  const actionSequence = state.sequence + 1;
  const action: WorldAction = {
    ...draft,
    id: nextId('act', actionSequence),
    createdAt: state.currentDate,
    // Une action est atomique côté moteur : elle n’est jamais observable entre
    // sa validation et l’application de ses effets. Éviter un second parcours
    // de tout le journal réduit fortement le coût des longues simulations.
    status: 'applied',
    targetIds: draft.targetIds ?? [],
  };
  let next: WorldState = {
    ...state,
    sequence: actionSequence,
    actions: [...state.actions, action],
  };
  for (const effect of action.effects) next = applyEffect(next, action, effect);
  return next;
}

export function visibleLedger(state: WorldState, countryId = state.playerCountryId) {
  return state.ledger.filter((change) => {
    if (change.visibility === 'public' || change.visibility === 'player') return true;
    if (change.visibility === 'secret') return change.actorId === countryId;
    return false;
  });
}

export function relationBetween(state: WorldState, from: CountryId, to: CountryId) {
  return state.relations[relationKey(from, to)];
}

export function intelligenceLevel(state: WorldState, observerId: CountryId, targetId: CountryId) {
  return state.intelligence[intelligenceKey(observerId, targetId)] ?? 0;
}
