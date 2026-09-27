import type {
  ActionDraft,
  BilateralRelation,
  CountryId,
  WorldAction,
  WorldChange,
  WorldEffect,
  WorldState,
} from './types';
import { MAX_STRATEGIC_SECTOR_WORKLOAD_MONTHS } from './types';

import { indexTerritorialState, synchronizeTerritorialEconomy } from './territories';
import { canTransitionActionProgramStatus } from './action-lifecycle';
import { industrialInputRequirementsFor, technologyTierFor } from './industrial-inputs';
import { commissionedReportForProgram, finalizeReportForProgram } from './reports';

const relationKey = (from: CountryId, to: CountryId) => `${from}:${to}`;
const intelligenceKey = (observerId: CountryId, targetId: CountryId) => `${observerId}:${targetId}`;

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Normalise les champs quantitatifs d'une filière au point d'entrée du
 * registre. Toute source (joueur, règle locale, IA ou événement historique)
 * passe donc par la même borne, sans dupliquer cette règle dans chaque moteur.
 * Une charge historique déjà supérieure à 36 mois n'est pas écrasée : elle
 * représente un carnet existant et ne peut que se résorber.
 */
function normalizeSectorPatch(sector: WorldState['sectors'][string], patch: Partial<WorldState['sectors'][string]>) {
  const raw = { ...sector, ...patch };
  const technology = clamp(raw.technology);
  const technologyTier = technologyTierFor(technology);
  return {
    ...raw,
    capacity: clamp(raw.capacity),
    utilization: clamp(raw.utilization),
    workloadMonths: Math.min(
      Math.max(MAX_STRATEGIC_SECTOR_WORKLOAD_MONTHS, sector.workloadMonths),
      Math.max(0, raw.workloadMonths),
    ),
    health: clamp(raw.health),
    foreignDependency: clamp(raw.foreignDependency),
    technology,
    // Le niveau jouable et la demande matérielle suivent toute montée ou
    // dégradation de maturité. Aucun programme ne peut donc promettre une
    // technologie plus avancée sans augmenter ses dépendances physiques.
    technologyTier,
    inputRequirements: industrialInputRequirementsFor(raw.sector, technologyTier),
  };
}

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

  if (effect.kind === 'world_event_add') {
    const before = state.worldEvents.find((event) => event.id === effect.event.id) ?? null;
    // Les événements sont des constats immuables : un même fait ne peut pas
    // être réécrit ou dupliqué lors d'une seconde frontière de simulation.
    if (before) return state;
    const after = effect.event;
    const next = { ...state, worldEvents: [...state.worldEvents, after] };
    return appendChange(next, action, effect, `worldEvents.${after.id}`, before, after);
  }

  if (effect.kind === 'metric_delta') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const before = country.metrics[effect.metric];
    const rawAfter = before + effect.delta;
    const after = effect.metric === 'industry' ? Math.max(0, rawAfter) : clamp(rawAfter);
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

  if (effect.kind === 'fiscal_delta') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const field = effect.bucket === 'emergency_reserve'
      ? 'emergencyReserve'
      : effect.bucket === 'recurring_costs'
        ? 'recurringProgramCosts'
        : effect.bucket === 'recurring_savings'
          ? 'recurringProgramSavings'
          : 'discretionaryMargin';
    const before = country.fiscal[field];
    const after = Number(Math.max(0, before + effect.delta).toFixed(3));
    const fiscal = { ...country.fiscal, [field]: after };
    const next = { ...state, countries: { ...state.countries, [effect.countryId]: { ...country, fiscal } } };
    return appendChange(next, action, effect, `countries.${effect.countryId}.fiscal.${field}`, before, after);
  }

  if (effect.kind === 'fiscal_patch') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const before = country.fiscal;
    const after = {
      ...before,
      ...effect.patch,
      annualRevenuePctGDP: Math.max(0, Number((effect.patch.annualRevenuePctGDP ?? before.annualRevenuePctGDP).toFixed(3))),
      annualSpendingPctGDP: Math.max(0, Number((effect.patch.annualSpendingPctGDP ?? before.annualSpendingPctGDP).toFixed(3))),
      publicDebtPctGDP: Math.max(0, Number((effect.patch.publicDebtPctGDP ?? before.publicDebtPctGDP).toFixed(3))),
      annualDiscretionaryAllocation: Math.max(0, Number((effect.patch.annualDiscretionaryAllocation ?? before.annualDiscretionaryAllocation).toFixed(3))),
      discretionaryMargin: Math.max(0, Number((effect.patch.discretionaryMargin ?? before.discretionaryMargin).toFixed(3))),
      emergencyReserve: Math.max(0, Number((effect.patch.emergencyReserve ?? before.emergencyReserve).toFixed(3))),
      recurringProgramCosts: Math.max(0, Number((effect.patch.recurringProgramCosts ?? before.recurringProgramCosts).toFixed(3))),
      recurringProgramSavings: Math.max(0, Number((effect.patch.recurringProgramSavings ?? before.recurringProgramSavings).toFixed(3))),
    };
    const next = { ...state, countries: { ...state.countries, [effect.countryId]: { ...country, fiscal: after } } };
    return appendChange(next, action, effect, `countries.${effect.countryId}.fiscal`, before, after);
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

  if (effect.kind === 'leadership_patch') {
    const leadership = state.leadership[effect.countryId];
    if (!leadership) return state;
    const after = { ...leadership, ...effect.patch, countryId: effect.countryId };
    const next = { ...state, leadership: { ...state.leadership, [effect.countryId]: after } };
    return appendChange(next, action, effect, `leadership.${effect.countryId}`, leadership, after);
  }

  if (effect.kind === 'political_apparatus_patch') {
    const apparatus = state.politicalApparatus[effect.countryId];
    if (!apparatus) return state;
    const after = { ...apparatus, ...effect.patch, countryId: effect.countryId };
    const next = { ...state, politicalApparatus: { ...state.politicalApparatus, [effect.countryId]: after } };
    return appendChange(next, action, effect, `politicalApparatus.${effect.countryId}`, apparatus, after);
  }

  if (effect.kind === 'political_cycle_patch') {
    const cycle = state.politicalCycles[effect.countryId];
    if (!cycle) return state;
    const after = { ...cycle, ...effect.patch, countryId: effect.countryId };
    const next = { ...state, politicalCycles: { ...state.politicalCycles, [effect.countryId]: after } };
    return appendChange(next, action, effect, `politicalCycles.${effect.countryId}`, cycle, after);
  }

  if (effect.kind === 'national_politics_patch') {
    const politics = state.nationalPolitics?.[effect.countryId];
    if (!politics) return state;
    const after = { ...politics, ...effect.patch, countryId: effect.countryId };
    const next = { ...state, nationalPolitics: { ...state.nationalPolitics, [effect.countryId]: after } };
    return appendChange(next, action, effect, `nationalPolitics.${effect.countryId}`, politics, after);
  }

  if (effect.kind === 'parliamentary_procedure_add') {
    const politics = state.nationalPolitics?.[effect.countryId];
    if (!politics) return state;
    const before = politics.procedures[effect.procedure.id] ?? null;
    const after = before ?? effect.procedure;
    const nextPolitics = { ...politics, procedures: { ...politics.procedures, [effect.procedure.id]: after } };
    const next = { ...state, nationalPolitics: { ...state.nationalPolitics, [effect.countryId]: nextPolitics } };
    return appendChange(next, action, effect, `nationalPolitics.${effect.countryId}.procedures.${effect.procedure.id}`, before, after);
  }

  if (effect.kind === 'parliamentary_procedure_patch') {
    const politics = state.nationalPolitics?.[effect.countryId];
    const procedure = politics?.procedures[effect.procedureId];
    if (!politics || !procedure) return state;
    const after = { ...procedure, ...effect.patch, id: effect.procedureId, countryId: effect.countryId };
    const nextPolitics = { ...politics, procedures: { ...politics.procedures, [effect.procedureId]: after } };
    const next = { ...state, nationalPolitics: { ...state.nationalPolitics, [effect.countryId]: nextPolitics } };
    return appendChange(next, action, effect, `nationalPolitics.${effect.countryId}.procedures.${effect.procedureId}`, procedure, after);
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

  if (effect.kind === 'capacity_maintenance_add') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const commitments = country.capacityMaintenance ?? {};
    const before = commitments[effect.commitment.id] ?? null;
    const after = before ?? effect.commitment;
    const next = {
      ...state,
      countries: {
        ...state.countries,
        [effect.countryId]: { ...country, capacityMaintenance: { ...commitments, [effect.commitment.id]: after } },
      },
    };
    return appendChange(next, action, effect, `countries.${effect.countryId}.capacityMaintenance.${effect.commitment.id}`, before, after);
  }

  if (effect.kind === 'capacity_overload_patch') {
    const country = state.countries[effect.countryId];
    if (!country) return state;
    const capacity = country.capacities[effect.domain];
    const after = {
      ...capacity,
      ...(effect.patch.overloadMonths === undefined ? {} : { overloadMonths: Math.max(0, Number(effect.patch.overloadMonths.toFixed(2))) }),
      ...(effect.patch.efficiencyPct === undefined ? {} : { efficiencyPct: clamp(effect.patch.efficiencyPct) }),
      ...(effect.patch.lastOverloadAt === undefined ? {} : { lastOverloadAt: effect.patch.lastOverloadAt }),
    };
    const next = { ...state, countries: { ...state.countries, [effect.countryId]: { ...country, capacities: { ...country.capacities, [effect.domain]: after } } } };
    return appendChange(next, action, effect, `countries.${effect.countryId}.capacities.${effect.domain}.load`, {
      overloadMonths: capacity.overloadMonths ?? 0, efficiencyPct: capacity.efficiencyPct ?? 100,
    }, { overloadMonths: after.overloadMonths ?? 0, efficiencyPct: after.efficiencyPct ?? 100 });
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

  if (effect.kind === 'international_organization_patch') {
    const organization = state.internationalOrganizations?.[effect.organizationId];
    if (!organization) return state;
    const after = { ...organization, ...effect.patch, id: organization.id };
    const next = {
      ...state,
      internationalOrganizations: { ...state.internationalOrganizations, [effect.organizationId]: after },
    };
    return appendChange(next, action, effect, `internationalOrganizations.${effect.organizationId}`, organization, after);
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

  if (effect.kind === 'historical_anchor_patch') {
    const anchor = state.historicalAnchors?.[effect.anchorId];
    if (!anchor) return state;
    const after = { ...anchor, ...effect.patch };
    const next = {
      ...state,
      historicalAnchors: { ...state.historicalAnchors, [effect.anchorId]: after },
    };
    return appendChange(next, action, effect, `historicalAnchors.${effect.anchorId}`, anchor, after);
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

  if (effect.kind === 'territorial_asset_patch') {
    const asset = state.territorial.assets[effect.assetId];
    if (!asset) return state;
    const currentOperation = asset.operation;
    const operationPatch = effect.patch.operation;
    const rawOperation = currentOperation && operationPatch ? { ...currentOperation, ...operationPatch } : currentOperation;
    const operation = rawOperation ? {
      ...rawOperation,
      maximum: Math.max(0.001, rawOperation.maximum),
      deployed: Math.min(Math.max(0, rawOperation.deployed), Math.max(0.001, rawOperation.maximum)),
      availabilityPct: clamp(rawOperation.availabilityPct),
    } : undefined;
    const portProfile = asset.portProfile && effect.patch.portProfile
      ? { ...asset.portProfile, ...effect.patch.portProfile }
      : asset.portProfile;
    const after = {
      ...asset,
      ...(effect.patch.status ? { status: effect.patch.status } : {}),
      ...(operation ? { operation, capacity: { value: operation.maximum, unit: operation.unit } } : {}),
      ...(portProfile ? { portProfile } : {}),
    };
    const next = { ...state, territorial: { ...state.territorial, assets: { ...state.territorial.assets, [asset.id]: after } } };
    return appendChange(next, action, effect, `territorial.assets.${asset.id}`, asset, after);
  }

  if (effect.kind === 'territory_transfer') {
    const territory = state.territorial.territories[effect.territoryId];
    const target = state.countries[effect.targetCountryId];
    if (!territory || !target) return state;
    const oldAccountingCountryId = territory.accountingCountryId;
    const nextTerritory = effect.mode === 'occupation'
      ? { ...territory, controllerEntityId: effect.targetCountryId }
      : effect.mode === 'liberation'
        ? { ...territory, controllerEntityId: territory.sovereignCountryId, administratorEntityId: territory.sovereignCountryId }
        : {
          ...territory,
          sovereignCountryId: effect.targetCountryId,
          controllerEntityId: effect.targetCountryId,
          administratorEntityId: effect.targetCountryId,
          accountingCountryId: effect.targetCountryId,
        };
    let territorial = { ...state.territorial, territories: { ...state.territorial.territories, [territory.id]: nextTerritory } };
    territorial = indexTerritorialState(territorial);
    let next: WorldState = { ...state, territorial };
    // Une cession change les comptes macro des deux pays. Une occupation ne
    // déplace pas la population ni le PIB dans les comptes nationaux.
    if (effect.mode === 'cession' && oldAccountingCountryId && oldAccountingCountryId !== effect.targetCountryId) {
      const movedPopulation = territory.population ?? 0;
      const movedGdp = territory.realGdpBillion2000Usd ?? 0;
      for (const countryId of [oldAccountingCountryId, effect.targetCountryId]) {
        const economy = next.macroEconomies[countryId];
        if (!economy) continue;
        const direction = countryId === oldAccountingCountryId ? -1 : 1;
        const populationMillions = Math.max(0, economy.populationMillions + direction * movedPopulation / 1e6);
        const realGdp = Math.max(0, economy.realGdpBillion2000Usd + direction * movedGdp);
        const potentialGdp = Math.max(0, economy.potentialGdpBillion2000Usd + direction * movedGdp);
        next = { ...next, macroEconomies: { ...next.macroEconomies, [countryId]: { ...economy, populationMillions, realGdpBillion2000Usd: realGdp, potentialGdpBillion2000Usd: potentialGdp } } };
        next = { ...next, territorial: synchronizeTerritorialEconomy(next.territorial, countryId, populationMillions * 1e6, realGdp) };
      }
    }
    return appendChange(next, action, effect, `territorial.territories.${territory.id}`, territory, nextTerritory);
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

  if (effect.kind === 'diplomatic_brief_add') {
    const briefs = state.diplomaticBriefs ?? {};
    const before = briefs[effect.brief.id] ?? null;
    const after = before ?? effect.brief;
    const next = { ...state, diplomaticBriefs: { ...briefs, [effect.brief.id]: after } };
    return appendChange(next, action, effect, `diplomaticBriefs.${effect.brief.id}`, before, after);
  }

  if (effect.kind === 'diplomatic_meeting_add') {
    const meetings = state.diplomaticMeetings ?? {};
    const before = meetings[effect.meeting.id] ?? null;
    const after = before ?? effect.meeting;
    const next = { ...state, diplomaticMeetings: { ...meetings, [effect.meeting.id]: after } };
    return appendChange(next, action, effect, `diplomaticMeetings.${effect.meeting.id}`, before, after);
  }

  if (effect.kind === 'diplomatic_meeting_patch') {
    const meeting = state.diplomaticMeetings?.[effect.meetingId];
    if (!meeting) return state;
    const after = { ...meeting, ...effect.patch };
    const next = { ...state, diplomaticMeetings: { ...state.diplomaticMeetings, [effect.meetingId]: after } };
    return appendChange(next, action, effect, `diplomaticMeetings.${effect.meetingId}`, meeting, after);
  }

  if (effect.kind === 'diplomatic_agreement_draft_add') {
    const drafts = state.diplomaticAgreementDrafts ?? {};
    const before = drafts[effect.draft.id] ?? null;
    const after = before ?? effect.draft;
    const next = { ...state, diplomaticAgreementDrafts: { ...drafts, [effect.draft.id]: after } };
    return appendChange(next, action, effect, `diplomaticAgreementDrafts.${effect.draft.id}`, before, after);
  }

  if (effect.kind === 'diplomatic_agreement_draft_patch') {
    const draft = state.diplomaticAgreementDrafts?.[effect.draftId];
    if (!draft) return state;
    const after = { ...draft, ...effect.patch, updatedAt: state.currentDate };
    const next = { ...state, diplomaticAgreementDrafts: { ...state.diplomaticAgreementDrafts, [effect.draftId]: after } };
    return appendChange(next, action, effect, `diplomaticAgreementDrafts.${effect.draftId}`, draft, after);
  }

  if (effect.kind === 'sector_patch') {
    const sector = state.sectors[effect.sectorId];
    if (!sector) return state;
    const after = normalizeSectorPatch(sector, effect.patch);
    const next = { ...state, sectors: { ...state.sectors, [effect.sectorId]: after } };
    return appendChange(next, action, effect, `sectors.${effect.sectorId}`, sector, after);
  }

  if (effect.kind === 'sector_delta') {
    const sector = state.sectors[effect.sectorId];
    if (!sector) return state;
    const patch = Object.fromEntries(Object.entries(effect.delta).map(([key, delta]) => {
      const current = sector[key as keyof typeof sector];
      return [key, typeof current === 'number' && typeof delta === 'number' ? current + delta : current];
    })) as Partial<typeof sector>;
    const after = normalizeSectorPatch(sector, patch);
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
    for (const field of effect.clear ?? []) Reflect.deleteProperty(after, field);
    const next = { ...state, strategicDossiers: { ...state.strategicDossiers, [effect.dossierId]: after } };
    return appendChange(next, action, effect, `strategicDossiers.${effect.dossierId}`, dossier, after);
  }

  if (effect.kind === 'dossier_entry_add') {
    const dossier = state.strategicDossiers?.[effect.dossierId];
    if (!dossier || dossier.entries.some((entry) => entry.id === effect.entry.id)) return state;
    const entry = {
      ...effect.entry,
      sourceActionId: effect.entry.sourceActionId ?? action.id,
      origin: effect.entry.origin ?? action.origin,
      actorId: effect.entry.actorId ?? action.actorId,
    };
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

  if (effect.kind === 'aggregate_sector_delta') {
    const economy = state.macroEconomies[effect.countryId];
    const sector = economy?.sectors[effect.sector];
    if (!economy || !sector) return state;
    const bounds = {
      capacityIndex: [0, 200],
      utilizationPct: [0, 100],
      productivityIndex: [0, 200],
      employmentSharePct: [0, 100],
    } as const;
    const patch = Object.fromEntries(Object.entries(effect.delta).map(([key, delta]) => {
      const typedKey = key as keyof typeof bounds;
      const [minimum, maximum] = bounds[typedKey];
      return [typedKey, clamp(sector[typedKey] + (delta ?? 0), minimum, maximum)];
    })) as Partial<typeof sector>;
    const afterSector = { ...sector, ...patch };
    const afterEconomy = { ...economy, sectors: { ...economy.sectors, [effect.sector]: afterSector } };
    const next = { ...state, macroEconomies: { ...state.macroEconomies, [effect.countryId]: afterEconomy } };
    return appendChange(next, action, effect, `macroEconomies.${effect.countryId}.sectors.${effect.sector}`, sector, afterSector);
  }

  if (effect.kind === 'trade_flow_add') {
    const before = state.tradeFlows[effect.flow.id] ?? null;
    if (before) return state;
    const next = { ...state, tradeFlows: { ...state.tradeFlows, [effect.flow.id]: effect.flow } };
    return appendChange(next, action, effect, `tradeFlows.${effect.flow.id}`, before, effect.flow);
  }

  if (effect.kind === 'trade_flow_patch') {
    const flow = state.tradeFlows[effect.flowId];
    if (!flow) return state;
    const after = { ...flow, ...effect.patch };
    const next = { ...state, tradeFlows: { ...state.tradeFlows, [effect.flowId]: after } };
    return appendChange(next, action, effect, `tradeFlows.${effect.flowId}`, flow, after);
  }

  if (effect.kind === 'macro_policy_delta') {
    const economy = state.macroEconomies[effect.countryId];
    if (!economy) return state;
    const before = economy.policy;
    const bounds: Record<keyof typeof before, [number, number]> = {
      fiscalStance: [-100, 100],
      publicInvestmentPctGdp: [0, 20],
      socialProtection: [0, 100],
      industrialSupport: [0, 100],
      tradeOpenness: [0, 100],
      capitalControls: [0, 100],
      laborFlexibility: [0, 100],
    };
    const policy = Object.fromEntries(Object.entries(effect.patch).map(([key, delta]) => {
      const typedKey = key as keyof typeof before;
      const current = before[typedKey];
      const numericDelta = typeof delta === 'number' ? delta : 0;
      const [minimum, maximum] = bounds[typedKey];
      return [key, typeof current === 'number' ? clamp(current + numericDelta, minimum, maximum) : current];
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

  if (effect.kind === 'structural_modifier_patch') {
    const modifiers = state.structuralModifiers?.[effect.countryId];
    const modifier = modifiers?.find((item) => item.id === effect.modifierId);
    if (!modifiers || !modifier) return state;
    const afterModifier = { ...modifier, ...effect.patch, id: modifier.id, countryId: modifier.countryId };
    const afterModifiers = modifiers.map((item) => item.id === modifier.id ? afterModifier : item);
    const next = { ...state, structuralModifiers: { ...state.structuralModifiers, [effect.countryId]: afterModifiers } };
    const changed = Object.fromEntries(Object.keys(effect.patch)
      .map((key) => [key, afterModifier[key as keyof typeof afterModifier]] as const)
      .filter(([, value]) => value !== undefined));
    const before = Object.fromEntries(Object.keys(effect.patch)
      .map((key) => [key, modifier[key as keyof typeof modifier]] as const)
      .filter(([, value]) => value !== undefined));
    return appendChange(next, action, effect, `structuralModifiers.${effect.countryId}.${modifier.id}`, before, changed);
  }

  if (effect.kind === 'stakeholder_group_add') {
    const before = state.stakeholderGroups[effect.group.id] ?? null;
    const after = before ?? effect.group;
    const next = { ...state, stakeholderGroups: { ...state.stakeholderGroups, [effect.group.id]: after } };
    return appendChange(next, action, effect, `stakeholderGroups.${effect.group.id}`, before, after);
  }

  if (effect.kind === 'stakeholder_group_patch') {
    const before = state.stakeholderGroups[effect.groupId];
    if (!before) return state;
    const after = { ...before, ...effect.patch, id: before.id, countryId: before.countryId };
    return appendChange({ ...state, stakeholderGroups: { ...state.stakeholderGroups, [before.id]: after } }, action, effect, `stakeholderGroups.${before.id}`, before, after);
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

  if (effect.kind === 'national_reform_patch') {
    const key = `${effect.countryId}:${effect.domain}`;
    const reform = state.nationalReforms?.[key];
    if (!reform) return state;
    const after = {
      ...reform,
      ...effect.patch,
      countryId: effect.countryId,
      domain: effect.domain,
      position: Number(clamp(effect.patch.position ?? reform.position).toFixed(2)),
      institutionalAnchor: Number(clamp(effect.patch.institutionalAnchor ?? reform.institutionalAnchor).toFixed(2)),
      publicSalience: Number(clamp(effect.patch.publicSalience ?? reform.publicSalience).toFixed(2)),
      polarization: Number(clamp(effect.patch.polarization ?? reform.polarization).toFixed(2)),
      implementationCapacity: Number(clamp(effect.patch.implementationCapacity ?? reform.implementationCapacity).toFixed(2)),
      administrativeBurden: Number(clamp(effect.patch.administrativeBurden ?? reform.administrativeBurden).toFixed(2)),
      evidenceLevel: Number(clamp(effect.patch.evidenceLevel ?? reform.evidenceLevel).toFixed(2)),
      annualFiscalImpact: Number((effect.patch.annualFiscalImpact ?? reform.annualFiscalImpact).toFixed(2)),
      indicators: Object.fromEntries(Object.entries({ ...reform.indicators, ...effect.patch.indicators }).map(([key, value]) => [key, Number(clamp(value).toFixed(2))])),
    };
    const next = { ...state, nationalReforms: { ...state.nationalReforms, [key]: after } };
    return appendChange(next, action, effect, `nationalReforms.${key}`, reform, after);
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
    const reports = state.reports ?? {};
    const report = commissionedReportForProgram(after);
    const next = {
      ...state,
      actionPrograms: { ...programs, [effect.program.id]: after },
      ...(report && !reports[report.id] ? { reports: { ...reports, [report.id]: report } } : {}),
    };
    return appendChange(next, action, effect, `actionPrograms.${effect.program.id}`, before, after);
  }

  if (effect.kind === 'action_program_patch') {
    const program = state.actionPrograms?.[effect.programId];
    if (!program) return state;
    // Un programme terminé ne peut jamais être relancé par un effet tardif.
    // Les mises à jour sans changement de statut (bilan, événements et
    // rattachement à un dossier) restent autorisées.
    if (effect.patch.status && !canTransitionActionProgramStatus(program.status, effect.patch.status)) return state;
    const after = { ...program, ...effect.patch };
    const reports = state.reports ?? {};
    const reportId = `report-${effect.programId}`;
    const currentReport = reports[reportId];
    let next: WorldState = { ...state, actionPrograms: { ...state.actionPrograms, [effect.programId]: after } };
    if (currentReport) {
      let report = currentReport;
      if (effect.patch.linkedDossierId) report = { ...report, linkedDossierId: effect.patch.linkedDossierId };
      if (['succeeded', 'partially_succeeded', 'failed', 'cancelled'].includes(after.status) && after.status !== program.status) {
        report = finalizeReportForProgram(report, after, state.currentDate, state);
      }
      if (report !== currentReport) next = { ...next, reports: { ...reports, [reportId]: report } };
    }
    return appendChange(next, action, effect, `actionPrograms.${effect.programId}`, program, after);
  }

  if (effect.kind === 'territorial_project_add') {
    const projects = state.territorialProjects ?? {};
    const before = projects[effect.project.id] ?? null;
    if (before) return state;
    const next = { ...state, territorialProjects: { ...projects, [effect.project.id]: effect.project } };
    return appendChange(next, action, effect, `territorialProjects.${effect.project.id}`, before, effect.project);
  }

  if (effect.kind === 'territorial_project_patch') {
    const project = state.territorialProjects?.[effect.projectId];
    if (!project) return state;
    const after = { ...project, ...effect.patch };
    // JSON retire les propriétés undefined. Reproduire ce comportement dès
    // l'application afin qu'un arbitrage clos ne réapparaisse pas au rechargement.
    if (Object.prototype.hasOwnProperty.call(effect.patch, 'pendingDecision') && effect.patch.pendingDecision === undefined) {
      Reflect.deleteProperty(after, 'pendingDecision');
    }
    const next = { ...state, territorialProjects: { ...state.territorialProjects, [effect.projectId]: after } };
    return appendChange(next, action, effect, `territorialProjects.${effect.projectId}`, project, after);
  }

  if (effect.kind === 'military_theater_add') {
    const theaters = state.militaryTheaters ?? {};
    const before = theaters[effect.theater.id] ?? null;
    const after = before ?? effect.theater;
    const next = { ...state, militaryTheaters: { ...theaters, [effect.theater.id]: after } };
    return appendChange(next, action, effect, `militaryTheaters.${effect.theater.id}`, before, after);
  }

  if (effect.kind === 'military_theater_patch') {
    const theater = state.militaryTheaters?.[effect.theaterId];
    if (!theater) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, theater[key as keyof typeof theater]]));
    const raw = { ...theater, ...effect.patch };
    const afterTheater = {
      ...raw,
      personnelThousands: Number(Math.max(0, raw.personnelThousands).toFixed(2)),
      availablePersonnelThousands: Number(Math.max(0, raw.availablePersonnelThousands).toFixed(2)),
      inTransitPersonnelThousands: Number(Math.max(0, raw.inTransitPersonnelThousands).toFixed(2)),
      readiness: Number(clamp(raw.readiness).toFixed(2)),
      supplyCoverageMonths: Number(Math.max(0, raw.supplyCoverageMonths).toFixed(2)),
    };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterTheater[key as keyof typeof afterTheater]]));
    const next = { ...state, militaryTheaters: { ...state.militaryTheaters, [effect.theaterId]: afterTheater } };
    return appendChange(next, action, effect, `militaryTheaters.${effect.theaterId}`, before, after);
  }

  if (effect.kind === 'military_base_add') {
    const bases = state.militaryBases ?? {};
    const before = bases[effect.base.id] ?? null;
    const after = before ?? effect.base;
    const next = { ...state, militaryBases: { ...bases, [effect.base.id]: after } };
    return appendChange(next, action, effect, `militaryBases.${effect.base.id}`, before, after);
  }

  if (effect.kind === 'military_base_patch') {
    const base = state.militaryBases?.[effect.baseId];
    if (!base) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, base[key as keyof typeof base]]));
    const raw = { ...base, ...effect.patch };
    const afterBase = {
      ...raw,
      capacityThousands: Number(Math.max(0, raw.capacityThousands).toFixed(2)),
      assignedPersonnelThousands: Number(Math.max(0, Math.min(raw.capacityThousands, raw.assignedPersonnelThousands)).toFixed(2)),
    };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterBase[key as keyof typeof afterBase]]));
    const next = { ...state, militaryBases: { ...state.militaryBases, [effect.baseId]: afterBase } };
    return appendChange(next, action, effect, `militaryBases.${effect.baseId}`, before, after);
  }

  if (effect.kind === 'war_zone_add') {
    const warZones = state.warZones ?? {};
    const before = warZones[effect.warZone.id] ?? null;
    const raw = before ?? effect.warZone;
    const after = {
      ...raw,
      economicDisruptionPct: Number(clamp(raw.economicDisruptionPct, 0, 60).toFixed(2)),
      supplyMultiplier: Number(clamp(raw.supplyMultiplier, 0.2, 1.2).toFixed(3)),
    };
    const next = { ...state, warZones: { ...warZones, [effect.warZone.id]: after } };
    return appendChange(next, action, effect, `warZones.${effect.warZone.id}`, before, after);
  }

  if (effect.kind === 'war_zone_patch') {
    const warZone = state.warZones?.[effect.warZoneId];
    if (!warZone) return state;
    const before = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, warZone[key as keyof typeof warZone]]));
    const raw = { ...warZone, ...effect.patch };
    const afterZone = {
      ...raw,
      economicDisruptionPct: Number(clamp(raw.economicDisruptionPct, 0, 60).toFixed(2)),
      supplyMultiplier: Number(clamp(raw.supplyMultiplier, 0.2, 1.2).toFixed(3)),
    };
    const after = Object.fromEntries(Object.keys(effect.patch).map((key) => [key, afterZone[key as keyof typeof afterZone]]));
    const next = { ...state, warZones: { ...state.warZones, [effect.warZoneId]: afterZone } };
    return appendChange(next, action, effect, `warZones.${effect.warZoneId}`, before, after);
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
