import assert from 'node:assert/strict';
import test from 'node:test';

import { answerAdvisorQuestion, assessStrategicPlan, classifyAdvisorQuestion } from './advisor';
import { createAdvisorAIRequest } from '../ai/contracts';
import { advanceCommonActionPrograms, launchCommonAction, prepareCommonAction, prepareDossierDelegation, prepareMilitaryTheaterAction } from './action-programs';
import { energyBalance, nodeAvailableExport, proposeEnergyContract } from './energy';
import {
  acceptEnergyOffer, adjustEnergyOffer, createAdministrativeEnergyOffer, sendEnergyOffer,
} from './energy-negotiation';
import { advanceWorld, replayWorld } from './engine';
import { compactWorldForSave, deserializeWorld, serializeWorld } from './persistence';
import { evaluatePoliticalPathway } from './politics';
import { addEconomicShock, setEconomicPolicy } from './macro-economy';
import { applyDebtCrisisResponse } from './sovereign-debt';
import { evaluateStrategicAction, selectStrategicAction } from './decision-making';
import { reviewCountryStrategy } from './autonomy';
import { countrySheet, defenseReferenceForCountry, defenseReferences2000ForValidation } from './country-sheet';
import type { GovernmentMeasure, ISODate, StrategicActionCandidate, WorldState } from './types';
import { createFrance2000World, createWorld2000 } from './scenario-2000';
import { deriveStructuralDiagnostics } from './structural-diagnostics';
import {
  enactGovernmentMeasure, enactPrototypeGovernmentMeasure, stakeholderPressureByChannel, visibleStakeholderReactions,
} from './stakeholders';
import {
  applyPowerStruggleAIProposal, detectPowerStruggleOpportunities, pendingPowerStruggleAIRequests,
  submitPowerStrugglePlayerResponse,
} from './power-struggles';
import { interpretPlayerIntent, rankEnergySuppliers } from './intent';
import {
  advanceDossierEscalation, advanceDossierLifecycle, advanceDossierReviewQueue, assessDossierResolution, dossierUnreadCount, dossiersRequiringAttention, markDossierViewed, reactivateDossier, resolveDossierDecision, setDossierFollowed,
} from './dossiers';
import { advanceDossierEffects, dossierPressureProfile, selectDossiersForEffects } from './dossier-effects';
import { queryForAIJob } from './ai/context';
import { applyWorldPulseAnswer, createWorldPulseRequest, executeWorldPulse } from './ai/world-pulse';
import { parseWorldPulseRequest } from '../ai/world-pulse-contracts';
import { runMinorEventCycle } from './minor-events';
import { rankWorldAttention } from './ai/world-attention';
import { activeMajorDossierCount, rankDossierReviews, rankStrategicDossierReviews, rankWorldDossierReviews } from './ai/dossier-scheduler';
import { commitWorldAction } from './ledger';
import { addDiplomaticDialogueParticipant, applyDiplomaticDialogueAIAnswer, openDiplomaticDialogue, openDiplomaticDialogueForDossier, requestDiplomaticDialogueAI, resolveDiplomaticDialogueResponse, sendDiplomaticDialogueMessage } from './diplomacy-dialogue';
import { applyDiplomaticMeetingAIAnswer, diplomaticBriefFromDialogue, proposeDiplomaticMeeting, requestDiplomaticMeetingAI, reviseDiplomaticAgreementDraft, signDiplomaticAgreementDraft } from './diplomatic-negotiation';
import { validateCountryRegistry } from './data-validator';
import { buildTurnBriefing } from './turn-briefing';
import { queueAutonomousProgram } from './ai/autonomous-programs';
import { authorizeArmamentProspect, createAutomaticArmamentProspects, rankArmamentProspectBuyers, rejectArmamentProspect } from './industry';
import { advancePoliticalCycles, assessPoliticalSupport, choosePoliticalCampaignStrategy, politicalCampaignDecisionPrompt, politicalCycleStops } from './political-cycles';
import { nationalReformEffects, reformStateKey } from './reforms';
import { advanceMilitaryTheaterAccess, militaryBasesForCountry, militaryTheatersForCountry } from './military-theaters';
import { advanceWarZones, warZonesForCountry } from './war-zones';

const trackedGreatPowers = ['FRA', 'DEU', 'ITA', 'ESP', 'POL', 'USA', 'GBR', 'RUS', 'CHN', 'NOR', 'DZA', 'LBY', 'SAU', 'BRA', 'ZAF', 'AUS', 'IND', 'JPN', 'TUR', 'VNM'] as const;

test('les grandes puissances suivies disposent d’un socle macro, politique, militaire et commercial complet', () => {
  const state = createWorld2000();
  for (const countryId of trackedGreatPowers) {
    assert.ok(state.countries[countryId], `${countryId}: fiche nationale`);
    assert.ok(state.macroEconomies[countryId], `${countryId}: macroéconomie`);
    assert.ok(state.structuralProfiles[countryId], `${countryId}: profil structurel`);
    assert.ok(state.leadership[countryId]?.figures.length, `${countryId}: dirigeant`);
    assert.ok(state.politicalApparatus[countryId]?.currents.length, `${countryId}: appareil politique`);
    assert.ok(state.decisionProfiles[countryId], `${countryId}: profil décisionnel`);
    const defense = defenseReferenceForCountry(state, countryId);
    assert.equal(defense?.modelingLevel, 'documented', `${countryId}: référence militaire documentée`);
    assert.ok(Object.values(state.tradeFlows).some((flow) => flow.exporterId === countryId || flow.importerId === countryId), `${countryId}: flux commercial`);
  }
  const spain = state.macroEconomies.ESP;
  assert.equal(spain.realGdpBillion2000Usd, 598.103);
  assert.equal(spain.populationMillions, 40.568);
  assert.equal(spain.inflationAnnualPct, 3.434);
});

test('le scénario 2000 charge un monde cohérent et jouable', () => {
  const state = createFrance2000World();
  assert.equal(state.currentDate, '2000-01-01');
  assert.equal(state.playerCountryId, 'FRA');
  assert.equal(Object.keys(state.countries).length, 195);
  assert.equal(validateCountryRegistry(state.countries, state.macroEconomies, { defenseReferences: defenseReferences2000ForValidation }).filter((issue) => issue.severity === 'error').length, 0);
  assert.ok(Object.keys(state.historicalCurrents).length >= 3);
  assert.ok(Object.keys(state.armamentProducts).length >= 6);
  assert.ok(Object.keys(state.strategicDossiers).length >= 2);
  assert.ok(Object.keys(state.historicalAnchors).length >= 20);
  assert.equal(Object.keys(state.politicalCycles).length, 195);
  assert.equal(Object.keys(state.nationalReforms).length, 195 * 3);
});

test('une réforme nationale est un programme résoluble et ouvre un dossier permanent', () => {
  const state = createFrance2000World();
  const prepared = prepareCommonAction(state, 'Réforme nationale de laïcité : renforcer la neutralité de l’État', { category: 'institutional' });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.action.lever, 'national_reform');
  const launched = launchCommonAction(state, { ...prepared.action, durationMonths: 1, successProbability: 92 });
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const resolved = advanceCommonActionPrograms(launched.state, 1);
  const reform = resolved.nationalReforms[reformStateKey('FRA', 'religion')];
  assert.equal(reform.activeProgramId, null);
  assert.ok(reform.lastOutcome);
  assert.ok(resolved.strategicDossiers['reform-FRA-religion']);
});

test('les effets de réforme restent bornés et traçables', () => {
  const state = createFrance2000World();
  const before = state.nationalReforms[reformStateKey('FRA', 'immigration')];
  const effects = nationalReformEffects(state, 'Resserrement des admissions et contrôle des flux migratoires', 'adopted');
  assert.ok(effects.some((effect) => effect.kind === 'national_reform_patch'));
  const patched = commitWorldAction(state, { kind: 'political', actorId: 'FRA', origin: 'player', intent: 'Tester une réforme migratoire', effects });
  const after = patched.nationalReforms[reformStateKey('FRA', 'immigration')];
  assert.ok(after.position >= 0 && after.position <= 100);
  assert.ok(after.polarization >= before.polarization);
  assert.ok(patched.ledger.some((change) => change.path.includes('nationalReforms.FRA:immigration')));
});

test('une nouvelle partie peut attribuer au joueur n’importe quel pays du registre', () => {
  const japan = createWorld2000('JPN');
  assert.equal(japan.playerCountryId, 'JPN');
  assert.equal(japan.scenarioId, 'jpn-2000-01');
  assert.equal(japan.strategicDossiers['current-dotcom-exuberance'].pendingDecisions.length, 0);
  const usa = createWorld2000('USA');
  assert.match(usa.strategicDossiers['current-dotcom-exuberance'].pendingDecisions[0], /États-Unis/);
  assert.equal(createWorld2000('PAYS_INCONNU').playerCountryId, 'FRA');
});

test('chaque pays possède un socle industriel et militaire minimal sans faux inventaire détaillé', () => {
  const state = createFrance2000World();
  for (const country of Object.values(state.countries)) {
    const sectors = Object.values(state.sectors).filter((sector) => sector.countryId === country.id);
    assert.ok(sectors.length >= 3, `${country.id} doit posséder au moins trois filières`);
    assert.ok(sectors.some((sector) => sector.sector === 'defense'));
    assert.ok(sectors.some((sector) => sector.sector === 'telecoms'));
    assert.ok(sectors.some((sector) => sector.sector === 'strategic_agriculture'));
    assert.ok(countrySheet(state, country.id)?.defense, `${country.id} doit posséder une référence militaire`);
  }
  assert.equal(state.sectors['FRA-defense'].modelingLevel, 'documented');
  assert.equal(state.sectors['AGO-defense'].modelingLevel, 'aggregate');
  assert.equal(countrySheet(state, 'FRA')?.defense?.modelingLevel, 'documented');
  assert.equal(countrySheet(state, 'AGO')?.defense?.modelingLevel, 'aggregate');
});

test('une ancienne sauvegarde reçoit les socles sectoriels manquants à son chargement', () => {
  const legacy = createFrance2000World();
  legacy.sectors = { 'FRA-defense': { ...legacy.sectors['FRA-defense'], modelingLevel: undefined } };
  const restored = deserializeWorld(serializeWorld(legacy));
  assert.equal(restored.sectors['FRA-defense'].modelingLevel, 'documented');
  assert.equal(restored.sectors['AGO-defense'].modelingLevel, 'aggregate');
});

test('une ancienne sauvegarde reçoit les pays ajoutés sans écraser son monde joué', () => {
  const legacy = createFrance2000World();
  legacy.currentDate = '2004-05-01';
  legacy.countries.FRA.metrics.budget = 173;
  const removedCountryIds = Object.keys(legacy.countries).filter((id) => !['FRA', 'DEU', 'ITA'].includes(id));
  for (const id of removedCountryIds) {
    delete legacy.countries[id];
    delete legacy.countryEnergy[id];
    delete legacy.decisionProfiles[id];
    delete legacy.leadership[id];
    delete legacy.politicalCycles[id];
    delete legacy.politicalApparatus[id];
  }
  legacy.territorial = {
    ...legacy.territorial,
    territories: Object.fromEntries(Object.entries(legacy.territorial.territories).filter(([, territory]) => ['FRA', 'DEU', 'ITA'].includes(territory.sovereignCountryId))),
    assets: Object.fromEntries(Object.entries(legacy.territorial.assets).filter(([, asset]) => legacy.territorial.territories[asset.territoryId] && ['FRA', 'DEU', 'ITA'].includes(legacy.territorial.territories[asset.territoryId].sovereignCountryId))),
    entities: Object.fromEntries(Object.entries(legacy.territorial.entities).filter(([id]) => ['FRA', 'DEU', 'ITA'].includes(id))),
  };
  const restored = deserializeWorld(serializeWorld(legacy));
  assert.equal(Object.keys(restored.countries).length, 195);
  assert.equal(restored.currentDate, '2004-05-01');
  assert.equal(restored.countries.FRA.metrics.budget, 173);
  assert.ok(restored.countryEnergy.AGO);
  assert.ok(restored.politicalCycles.AGO);
  assert.ok(Object.values(restored.territorial.territories).some((territory) => territory.sovereignCountryId === 'AGO'));
});

test('les échéances politiques sont réparties et ouvrent un dossier avant les scrutins majeurs', () => {
  const initial = createFrance2000World();
  const atCampaign = { ...initial, currentDate: '2000-06-01' as const };
  const advanced = advancePoliticalCycles(atCampaign);
  assert.equal(advanced.politicalCycles.USA.status, 'campaign');
  const dossier = advanced.strategicDossiers['political-cycle-usa-1'];
  assert.ok(dossier);
  assert.equal(dossier.kind, 'political_transition');
  assert.match(dossier.publicSummary, /aucun vainqueur historique n’est pré-écrit/);
});

test('une alternance remplace la direction de 2000 sans effacer l’appareil permanent', () => {
  const initial = createFrance2000World();
  const stressed = structuredClone(initial);
  stressed.currentDate = '2000-11-01';
  stressed.countries.USA.politics.publicApproval = 8;
  stressed.countries.USA.metrics.stability = 15;
  stressed.countries.USA.metrics.security = 20;
  stressed.leadership.USA.executiveCoordination = 18;
  stressed.macroEconomies.USA.realGrowthAnnualPct = -6;
  stressed.macroEconomies.USA.unemploymentPct = 16;
  const assessment = assessPoliticalSupport(stressed, 'USA');
  assert.equal(assessment.retained, false);
  const permanentCurrentId = stressed.politicalApparatus.USA.currents[0].id;
  const advanced = advancePoliticalCycles(stressed);
  assert.equal(advanced.politicalCycles.USA.lastOutcome, 'alternation');
  assert.notEqual(advanced.leadership.USA.figures[0].name, 'Bill Clinton');
  assert.equal(advanced.politicalApparatus.USA.currents[0].id, permanentCurrentId);
  assert.match(advanced.countries.USA.politics.governmentLabel, /alternance/);
});

test('une direction soutenue peut être reconduite mais son prochain contrôle reste planifié', () => {
  const initial = createFrance2000World();
  const stable = structuredClone(initial);
  stable.currentDate = '2000-11-01';
  stable.countries.USA.politics.publicApproval = 88;
  stable.countries.USA.metrics.stability = 90;
  stable.leadership.USA.executiveCoordination = 92;
  const advanced = advancePoliticalCycles(stable);
  assert.equal(advanced.politicalCycles.USA.lastOutcome, 'renewal');
  assert.equal(advanced.leadership.USA.figures[0].name, 'Bill Clinton');
  assert.equal(advanced.politicalCycles.USA.nextReviewDate, '2004-11-01');
});

test('une échéance compétitive départage une cohabitation au lieu de la figer pour toujours', () => {
  const initial = createFrance2000World();
  const stable = structuredClone(initial);
  stable.currentDate = '2002-04-01';
  stable.countries.FRA.politics.publicApproval = 90;
  stable.countries.FRA.metrics.stability = 90;
  stable.leadership.FRA.executiveCoordination = 88;
  const advanced = advancePoliticalCycles(stable);
  assert.equal(advanced.politicalCycles.FRA.lastOutcome, 'renewal');
  assert.equal(advanced.leadership.FRA.figures.length, 1);
  assert.equal(advanced.countries.FRA.politics.regime.includes('cohabitation'), false);
  assert.equal(advanced.countries.FRA.politics.executive, advanced.leadership.FRA.figures[0].name);
});

test('une avance longue s’arrête avant l’échéance politique du pays joué', () => {
  const initial = createFrance2000World();
  const requestedDate = '2003-01-01' as const;
  const result = advanceWorld(initial, requestedDate, politicalCycleStops(initial, requestedDate));
  assert.equal(result.reachedDate, '2001-12-01');
  assert.equal(result.stop?.kind, 'political');
  assert.equal(result.state.politicalCycles.FRA.status, 'campaign');
  assert.ok(result.state.strategicDossiers['political-cycle-fra-1']);
});

test('la campagne nationale exige une posture sans permettre de choisir le vainqueur', () => {
  const initial = createFrance2000World();
  initial.currentDate = '2001-12-01';
  const campaign = advancePoliticalCycles(initial);
  const dossier = campaign.strategicDossiers['political-cycle-fra-1'];
  assert.equal(dossier.pendingDecisions[0], politicalCampaignDecisionPrompt);
  const baseline = assessPoliticalSupport(campaign, 'FRA').supportScore;
  const governmentBefore = campaign.countries.FRA.capacities.government.committed;
  const mobilized = choosePoliticalCampaignStrategy(campaign, 'majority_mobilization');
  assert.equal(mobilized.politicalCycles.FRA.campaignStrategy, 'majority_mobilization');
  assert.equal(mobilized.countries.FRA.capacities.government.committed, governmentBefore + 5);
  assert.ok(assessPoliticalSupport(mobilized, 'FRA').supportScore > baseline + 4);
  assert.equal(mobilized.strategicDossiers[dossier.id].pendingDecisions.length, 0);
});

test('les moyens de campagne sont libérés après le scrutin', () => {
  const initial = createFrance2000World();
  initial.currentDate = '2001-12-01';
  const campaign = advancePoliticalCycles(initial);
  const governmentBefore = campaign.countries.FRA.capacities.government.committed;
  const mobilized = choosePoliticalCampaignStrategy(campaign, 'majority_mobilization');
  mobilized.currentDate = '2002-04-01';
  const resolved = advancePoliticalCycles(mobilized);
  assert.equal(resolved.countries.FRA.capacities.government.committed, governmentBefore);
  assert.equal(resolved.politicalCycles.FRA.campaignStrategy, null);
  assert.equal(resolved.strategicDossiers['political-cycle-fra-1'].status, 'resolved');
});

test('le silence de campagne laisse le bilan décider et expire proprement l’arbitrage', () => {
  const initial = createFrance2000World();
  initial.currentDate = '2001-12-01';
  const campaign = advancePoliticalCycles(initial);
  const baseline = assessPoliticalSupport(campaign, 'FRA').supportScore;
  campaign.currentDate = '2002-04-01';
  const resolved = advancePoliticalCycles(campaign);
  const dossier = resolved.strategicDossiers['political-cycle-fra-1'];
  assert.equal(resolved.politicalCycles.FRA.lastSupportScore, baseline);
  assert.equal(dossier.pendingDecisions.length, 0);
  assert.equal(dossier.decisionRecords?.[0]?.status, 'expired');
});

test('un dossier actif transmet une pression bornée au macro-modèle et les engagements l’amortissent', () => {
  const initial = createFrance2000World();
  const dossier = initial.strategicDossiers['current-dotcom-exuberance'];
  const baseline = dossierPressureProfile(initial, dossier);
  assert.equal(baseline.active, true);
  assert.ok(baseline.pressures.some((item) => item.channel === 'financial'));

  const merelyPositioned = structuredClone(initial);
  merelyPositioned.strategicDossiers[dossier.id].playerStance = 'Le gouvernement affirme suivre la situation.';
  assert.equal(dossierPressureProfile(merelyPositioned, merelyPositioned.strategicDossiers[dossier.id]).mitigationPct, baseline.mitigationPct);

  const committed = structuredClone(initial);
  committed.strategicDossiers[dossier.id].commitments = ['Coordination prudentielle avec les partenaires européens'];
  const reduced = dossierPressureProfile(committed, committed.strategicDossiers[dossier.id]);
  assert.ok(reduced.mitigationPct > baseline.mitigationPct);
  assert.ok((reduced.pressures.find((item) => item.channel === 'financial')?.level ?? 0) < (baseline.pressures.find((item) => item.channel === 'financial')?.level ?? 0));

  const applied = advanceDossierEffects(initial);
  const shock = applied.worldEconomy.activeShocks.find((item) => item.id === 'dossier-effect:current-dotcom-exuberance:financial');
  assert.ok(shock && shock.intensity > 0);
  assert.equal(applied.strategicDossiers[dossier.id].impactState?.lastAppliedAt, initial.currentDate);
  assert.ok(applied.strategicDossiers[dossier.id].entries.some((entry) => entry.id === `dossier-impact-${dossier.id}-${initial.currentDate}`));
});

test('le résultat d’un programme joueur calme un dossier tandis que son échec l’aggrave', () => {
  const initial = createFrance2000World();
  const dossierId = 'current-dotcom-exuberance';
  const prepared = prepareCommonAction(initial, 'Lancer un programme économique de prévention financière', { source: 'player', linkedDossierId: dossierId, category: 'economic' });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const successLaunch = launchCommonAction(initial, { ...prepared.action, durationMonths: 1, successProbability: 100 });
  assert.equal(successLaunch.ok, true);
  if (!successLaunch.ok) return;
  const success = advanceCommonActionPrograms(successLaunch.state, 1);
  assert.equal(success.strategicDossiers[dossierId].status, 'deescalating');
  assert.equal(success.strategicDossiers[dossierId].trend, 'deescalating');

  const failureLaunch = launchCommonAction(initial, { ...prepared.action, durationMonths: 1, successProbability: -100 });
  assert.equal(failureLaunch.ok, true);
  if (!failureLaunch.ok) return;
  const failure = advanceCommonActionPrograms(failureLaunch.state, 1);
  assert.equal(failure.strategicDossiers[dossierId].status, 'active');
  assert.equal(failure.strategicDossiers[dossierId].trend, 'escalating');
});

test('un dossier réellement désescaladé se clôt après une période calme et reste archivé', () => {
  const state = structuredClone(createFrance2000World());
  const dossier = state.strategicDossiers['current-dotcom-exuberance'];
  state.currentDate = '2000-08-01';
  state.strategicDossiers[dossier.id] = {
    ...dossier, status: 'deescalating', trend: 'deescalating', phase: 'Réponse efficace',
    updatedAt: '2000-01-01', pendingDecisions: [], decisionRecords: [], relatedAnchorId: undefined,
  };
  const assessment = assessDossierResolution(state, state.strategicDossiers[dossier.id]);
  assert.equal(assessment.canResolve, true);
  assert.match(assessment.nextMilestone, /prochaine frontière mensuelle/i);
  const resolved = advanceDossierLifecycle(state);
  assert.equal(resolved.strategicDossiers[dossier.id].status, 'resolved');
  assert.equal(resolved.strategicDossiers[dossier.id].autoTracked, false);
  assert.ok(resolved.strategicDossiers[dossier.id].entries.some((entry) => entry.id.startsWith(`dossier-resolved-${dossier.id}`)));
});

test('le bilan de tour résume les indicateurs et les changements de dossier sans dupliquer la sauvegarde', () => {
  const before = createFrance2000World();
  const after = structuredClone(before);
  after.currentDate = '2000-02-01';
  after.macroEconomies.FRA.realGdpBillion2000Usd += 2;
  after.strategicDossiers['current-dotcom-exuberance'].trend = 'deescalating';
  after.strategicDossiers['current-dotcom-exuberance'].phase = 'Correction ordonnée';
  const briefing = buildTurnBriefing(before, after);
  assert.equal(briefing.from, '2000-01-01');
  assert.equal(briefing.to, '2000-02-01');
  assert.equal(briefing.metrics.find((item) => item.id === 'gdp')?.delta, 2);
  assert.ok(briefing.highlights.some((item) => item.dossierId === 'current-dotcom-exuberance'));
  assert.ok(briefing.playerHighlights.some((item) => item.dossierId === 'current-dotcom-exuberance'));

  const source = after.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(source);
  if (!source) return;
  after.strategicDossiers['briefing-world-dossier'] = {
    ...source,
    id: 'briefing-world-dossier',
    title: 'Dossier mondial de démonstration',
    actorIds: ['USA', 'DEU'],
    scope: 'world',
    pendingDecisions: [],
    entries: [],
    updatedAt: after.currentDate,
  };
  const worldBriefing = buildTurnBriefing(before, after);
  assert.ok(worldBriefing.worldHighlights.some((item) => item.dossierId === 'briefing-world-dossier'));
  assert.equal(worldBriefing.playerHighlights.some((item) => item.dossierId === 'briefing-world-dossier'), false);
  assert.equal(before.currentDate, '2000-01-01');
});

test('plusieurs avances successives conservent des files de dossiers joueur et monde distinctes', () => {
  const initial = createFrance2000World();
  const source = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(source);
  if (!source) return;
  let state: WorldState = {
    ...initial,
    strategicDossiers: {
      ...initial.strategicDossiers,
      'multi-advance-world': {
        ...source,
        id: 'multi-advance-world',
        title: 'Suivi mondial de test',
        actorIds: ['USA', 'DEU'],
        scope: 'world' as const,
        pendingDecisions: ['Surveiller la diffusion du choc.'],
        lastAutonomousReviewAt: undefined,
      },
      'multi-advance-player': {
        ...source,
        id: 'multi-advance-player',
        title: 'Dossier national de test',
        actorIds: ['FRA'],
        scope: 'player_involved' as const,
        pendingDecisions: ['Choisir une réponse française.'],
        lastAutonomousReviewAt: undefined,
      },
    },
  };
  for (const month of [2, 3, 4]) {
    const nextDate = `2000-${String(month).padStart(2, '0')}-01` as ISODate;
    state = advanceWorld(state, nextDate).state;
    const autonomy = createWorldPulseRequest(state, state.actions.length, 1, `multi-advance-${month}`).pulses
      .find((pulse) => pulse.kind === 'world_autonomy');
    assert.ok(autonomy?.context.strategicDossierQueue.some((review) => review.dossierId === 'multi-advance-player'));
    assert.ok(autonomy?.context.worldDossierQueue.some((review) => review.dossierId === 'multi-advance-world'));
    assert.equal(autonomy?.context.strategicDossierQueue.some((review) => review.dossierId === 'multi-advance-world'), false);
    assert.equal(autonomy?.context.worldDossierQueue.some((review) => review.dossierId === 'multi-advance-player'), false);
  }
  assert.equal(state.currentDate, '2000-04-01');
  assert.ok(state.strategicDossiers['multi-advance-world']);
  assert.ok(state.strategicDossiers['multi-advance-player']);
});

test('la boucle locale de douze mois fait avancer économie, monde autonome et événements mineurs', () => {
  const initial = createFrance2000World();
  let state: WorldState = initial;
  let minorEvents = 0;
  let changedBriefings = 0;
  for (let month = 1; month <= 12; month += 1) {
    const requestedDate = new Date(Date.UTC(2000, month, 1)).toISOString().slice(0, 10) as ISODate;
    const before = state;
    const result = advanceWorld(before, requestedDate);
    assert.equal(result.audit.ok, true);
    state = result.state;
    minorEvents += state.actions.slice(before.actions.length).filter((action) => action.metadata?.minorEvent === true).length;
    const briefing = buildTurnBriefing(before, state);
    if (briefing.playerHighlights.length > 0 || briefing.worldHighlights.length > 0) changedBriefings += 1;
    const autonomy = createWorldPulseRequest(state, state.actions.length, 1, `twelve-month-loop-${month}`).pulses
      .find((pulse) => pulse.kind === 'world_autonomy');
    assert.ok(autonomy);
    if (!autonomy) continue;
    const playerDossiers = new Set(autonomy.context.strategicDossierQueue.map((review) => review.dossierId));
    const worldDossiers = new Set(autonomy.context.worldDossierQueue.map((review) => review.dossierId));
    assert.equal([...playerDossiers].some((id) => worldDossiers.has(id)), false);
    assert.ok(autonomy.context.approximateInputTokens > 0);
  }
  assert.equal(state.currentDate, '2001-01-01');
  assert.ok(minorEvents >= 12);
  assert.ok(changedBriefings >= 1);
  assert.notEqual(state.macroEconomies.FRA.realGdpBillion2000Usd, initial.macroEconomies.FRA.realGdpBillion2000Usd);
});

test('le moteur limite les conséquences systémiques simultanées à quatre dossiers', () => {
  const state = structuredClone(createFrance2000World());
  const template = state.strategicDossiers['current-dotcom-exuberance'];
  for (let index = 0; index < 5; index += 1) {
    const id = `systemic-test-${index}`;
    state.strategicDossiers[id] = {
      ...template, id, title: `Stress systémique ${index}`, importance: 'major', followed: true,
      actorIds: ['FRA', 'USA'], commitments: [], pendingDecisions: [], entries: [], impactState: undefined,
    };
  }
  assert.equal(selectDossiersForEffects(state).length, 4);
  const applied = advanceDossierEffects(state);
  const affected = Object.values(applied.strategicDossiers).filter((dossier) => dossier.impactState?.lastAppliedAt === state.currentDate);
  assert.equal(affected.length, 4);
});

test('les ancrages historiques ouvrent un dossier sur signal sans imposer immédiatement une manifestation', () => {
  const initial = createFrance2000World();
  const afterTwoMonths = advanceWorld(initial, '2000-03-01').state;
  const russia = afterTwoMonths.historicalAnchors['russia-recentralization'];
  const china = afterTwoMonths.historicalAnchors['china-wto-integration'];
  assert.ok(russia && china);
  assert.notEqual(russia?.status, 'dormant');
  assert.notEqual(china?.status, 'dormant');
  assert.ok(afterTwoMonths.strategicDossiers['historical-russia-recentralization']);
  assert.ok(afterTwoMonths.strategicDossiers['historical-china-wto-integration']);
  const russiaDossier = afterTwoMonths.strategicDossiers['historical-russia-recentralization'];
  assert.equal(russiaDossier.pendingDecisions.length, 1);
  assert.equal(russiaDossier.decisionRecords?.[0]?.sourceKind, 'historical');
  assert.equal(russiaDossier.decisionRecords?.[0]?.sourceId, 'russia-recentralization:signal');
  assert.equal(afterTwoMonths.historicalAnchors['mass-casualty-terrorism']?.status, 'dormant');
});

test('un ancrage historique ne redemande un arbitrage qu’au franchissement d’un seuil après une première position', () => {
  const signalled = advanceWorld(createFrance2000World(), '2001-03-01').state;
  const dossierId = 'historical-mass-casualty-terrorism';
  const signalDecision = signalled.strategicDossiers[dossierId]?.pendingDecisions[0];
  assert.ok(signalDecision);
  if (!signalDecision) return;

  const positioned = resolveDossierDecision(signalled, dossierId, signalDecision, 'delegation');
  const activated = advanceWorld(positioned, '2001-12-01').state;
  const dossier = activated.strategicDossiers[dossierId];
  const activationDecisions = dossier.decisionRecords?.filter((decision) => decision.sourceId === 'mass-casualty-terrorism:activation') ?? [];
  assert.equal(activationDecisions.length, 1);
  assert.equal(dossier.pendingDecisions.length, 1);
  assert.equal(dossier.pendingDecisions[0], activationDecisions[0].prompt);

  const nextMonth = advanceWorld(activated, '2002-01-01').state;
  const repeated = nextMonth.strategicDossiers[dossierId].decisionRecords?.filter((decision) => decision.sourceId === 'mass-casualty-terrorism:activation') ?? [];
  assert.equal(repeated.length, 1);
});

test('un ancrage historique peut être concrétisé par l IA uniquement dans sa fenêtre', () => {
  const initial = createFrance2000World();
  const prepared = advanceWorld(initial, '2001-12-01').state;
  const item = createWorldPulseRequest(prepared, prepared.actions.length, 1, 'historical-anchor-test').pulses.find((pulse) => pulse.kind === 'world_autonomy');
  assert.ok(item);
  if (!item) return;
  const fact = item.context.facts.find((candidate) => candidate.id === 'history-anchor:mass-casualty-terrorism');
  const dossier = prepared.strategicDossiers['historical-mass-casualty-terrorism'];
  assert.ok(fact && dossier);
  if (!fact || !dossier) return;
  const applied = applyWorldPulseAnswer(prepared, item, {
    headline: 'Opération terroriste majeure',
    synthesis: 'Une manifestation concrète est désormais observée dans la fenêtre historique.',
    requestedFactIds: [],
    proposals: [{
      // Même si l’IA oublie le dossier existant, le moteur doit rattacher la
      // manifestation au dossier de l’ancrage au lieu d’en créer un second.
      dossierId: null,
      historicalAnchorId: 'mass-casualty-terrorism',
      title: 'Attaque coordonnée contre une infrastructure stratégique',
      kind: 'security', importance: 'critical', actorIds: ['USA', 'GBR', 'FRA'], regionTags: ['Monde'],
      phase: 'Manifestation', trend: 'escalating', summary: 'Une opération coordonnée révèle la capacité extérieure du réseau.',
      requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
    }],
  });
  assert.equal(applied.manifestedAnchorIds[0], 'mass-casualty-terrorism');
  assert.equal(applied.state.historicalAnchors['mass-casualty-terrorism']?.status, 'manifested');
  assert.deepEqual(applied.createdDossierIds, []);
  assert.ok(applied.updatedDossierIds.includes(dossier.id));
});

test('un ancrage seulement proposé ne peut pas être matérialisé avant son seuil actif', () => {
  const early = advanceWorld(createFrance2000World(), '2001-03-01').state;
  const item = createWorldPulseRequest(early, early.actions.length, 1, 'historical-anchor-early-test').pulses.find((pulse) => pulse.kind === 'world_autonomy');
  const dossier = early.strategicDossiers['historical-mass-casualty-terrorism'];
  const fact = item?.context.facts.find((candidate) => candidate.id === 'history-anchor:mass-casualty-terrorism');
  assert.ok(item && dossier && fact);
  if (!item || !dossier || !fact) return;
  const applied = applyWorldPulseAnswer(early, item, {
    headline: 'Risque terroriste accru', synthesis: 'La tendance existe, sans manifestation validée à ce stade.', requestedFactIds: [],
    proposals: [{
      dossierId: dossier.id, historicalAnchorId: 'mass-casualty-terrorism', title: 'Attaque prématurée refusée par le moteur',
      kind: 'security', importance: 'critical', actorIds: ['USA', 'GBR', 'FRA'], regionTags: ['Monde'], phase: 'Signal', trend: 'escalating',
      summary: 'Le modèle ne peut pas matérialiser un ancrage avant son seuil actif.', requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
    }],
  });
  assert.equal(applied.manifestedAnchorIds.length, 0);
  assert.equal(applied.state.historicalAnchors['mass-casualty-terrorism']?.status, 'proposed');
});

test('un programme lié à un dossier historique modifie sa pression et laisse une trace causale', () => {
  const active = advanceWorld(createFrance2000World(), '2001-12-01').state;
  const dossierId = 'historical-mass-casualty-terrorism';
  const prepared = prepareCommonAction(
    active,
    'Lancer une opération de renseignement avec les États-Unis pour protéger les infrastructures stratégiques.',
    { source: 'player', linkedDossierId: dossierId, category: 'intelligence', historicalIntent: 'contain' },
  );
  assert.ok(prepared.ok);
  if (!prepared.ok) return;
  const launched = launchCommonAction(active, { ...prepared.action, durationMonths: 1, successProbability: 100 });
  assert.ok(launched.ok);
  if (!launched.ok) return;
  const after = advanceWorld(launched.state, '2002-02-01').state;
  const anchor = after.historicalAnchors['mass-casualty-terrorism'];
  assert.ok(anchor?.lastIntervention);
  assert.equal(anchor?.lastIntervention?.direction, 'contain');
  assert.ok((anchor?.lastIntervention?.pressureDelta ?? 0) < 0);
  assert.ok((anchor?.interventionBalance ?? 0) < 0);
  assert.ok(after.strategicDossiers[dossierId]?.entries.some((entry) => entry.id.endsWith('-historical-impact')));
});

test('le silence sur un dossier historique augmente sa pression et laisse une causalité lisible', () => {
  const signalled = advanceWorld(createFrance2000World(), '2001-03-01').state;
  const dossierId = 'historical-mass-casualty-terrorism';
  const dossier = signalled.strategicDossiers[dossierId];
  const before = signalled.historicalAnchors['mass-casualty-terrorism']?.pressure ?? 0;
  const silenced = resolveDossierDecision(signalled, dossierId, dossier.pendingDecisions[0], 'explicit_silence');
  const anchor = silenced.historicalAnchors['mass-casualty-terrorism'];
  assert.ok(anchor.pressure > before);
  assert.equal(anchor.lastIntervention?.outcome, 'silent');
  assert.ok(silenced.strategicDossiers[dossierId].entries.some((entry) => entry.title === 'Silence sur le dossier historique'));
});

test('une délégation historique est moins chère, plus lente et moins influente qu’une action directe', () => {
  const signalled = advanceWorld(createFrance2000World(), '2001-03-01').state;
  const dossierId = 'historical-mass-casualty-terrorism';
  const delegation = prepareDossierDelegation(signalled, dossierId, signalled.strategicDossiers[dossierId].pendingDecisions[0]);
  assert.ok(delegation.ok);
  if (!delegation.ok) return;
  assert.equal(delegation.action.historicalContributionScale, 0.55);
  assert.ok(delegation.action.budgetCost < 4.5);
  assert.ok(delegation.action.durationMonths > 6);
  assert.ok(delegation.action.successProbability < 90);
  const launched = launchCommonAction(signalled, { ...delegation.action, successProbability: 100 });
  assert.ok(launched.ok);
  if (!launched.ok) return;
  const resolved = advanceWorld(launched.state, '2002-05-01').state;
  const anchor = resolved.historicalAnchors['mass-casualty-terrorism'];
  assert.ok((anchor.lastIntervention?.pressureDelta ?? 0) < 0);
  assert.ok(Math.abs(anchor.lastIntervention?.pressureDelta ?? 0) < 5);
});

test('un accord issu d’un dialogue historique réduit la pression uniquement lorsqu’il est formalisé', () => {
  const signalled = advanceWorld(createFrance2000World(), '2001-03-01').state;
  const dossierId = 'historical-mass-casualty-terrorism';
  const before = signalled.historicalAnchors['mass-casualty-terrorism']?.pressure ?? 0;
  const opened = openDiplomaticDialogueForDossier(signalled, dossierId, 'Nous proposons une coordination de sécurité durable.');
  assert.ok(opened.ok);
  if (!opened.ok) return;
  // L'ouverture attend la première réponse de l'interlocuteur. Le joueur ne
  // peut pas envoyer artificiellement un second message avant cette réponse.
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.ok(queued.ok);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Accord de sécurité', assessment: 'Une coordination formelle est possible.', publicMessage: 'Nous acceptons une coordination de renseignement encadrée.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'information_sharing', position: 'Coordination de renseignement encadrée.', concessions: [], guaranteesRequested: ['Consultation régulière'], conditions: ['Cadre écrit'], redLines: [], timeline: 'Immédiat.',
  });
  assert.ok(answered.ok);
  if (!answered.ok) return;
  const accepted = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.ok(accepted.ok);
  if (!accepted.ok) return;
  const anchor = accepted.state.historicalAnchors['mass-casualty-terrorism'];
  // La contre-proposition comporte encore une garantie et une condition :
  // l’acceptation du joueur reste une intention à formaliser et ne doit pas
  // modifier immédiatement la trajectoire historique.
  assert.equal(accepted.state.diplomaticDialogues[opened.dialogueId].resolution?.status, 'accepted_conditionally');
  assert.equal(anchor.pressure, before);
  assert.equal(anchor.lastIntervention, undefined);
});

test('une réforme nationale échouée libère le domaine et ouvre un arbitrage', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Resserrer fortement les admissions migratoires et renforcer les contrôles');
  assert.ok(prepared.ok);
  if (!prepared.ok) return;
  const launched = launchCommonAction(initial, { ...prepared.action, durationMonths: 1, successProbability: 0 });
  assert.ok(launched.ok);
  if (!launched.ok) return;
  const active = launched.state.nationalReforms[reformStateKey('FRA', 'immigration')];
  assert.equal(active.activeProgramId, launched.programId);
  const resolved = advanceWorld(launched.state, '2000-02-15').state;
  const reform = resolved.nationalReforms[reformStateKey('FRA', 'immigration')];
  assert.equal(reform.activeProgramId, null);
  assert.equal(reform.lastOutcome, 'stalled');
  assert.ok(resolved.strategicDossiers['reform-FRA-immigration']?.pendingDecisions.length);
});

test('le pouls mondial IA ne peut créer que des mises à jour de dossiers citées et relationnelles bornées', () => {
  const initial = createFrance2000World();
  const request = createWorldPulseRequest(initial, initial.actions.length, 1, 'test-world-pulse-session');
  assert.ok(parseWorldPulseRequest(request));
  const item = request.pulses.find((candidate) => candidate.kind === 'world_autonomy');
  assert.ok(item);
  if (!item) return;
  const dossierFact = item.context.facts.find((fact) => fact.id === 'dossier:current-dotcom-exuberance');
  assert.ok(dossierFact);
  if (!dossierFact) return;
  const applied = applyWorldPulseAnswer(initial, item, {
    headline: 'Les marchés technologiques se crispent',
    synthesis: 'Les autorités financières réévaluent les risques. Le dossier reste évolutif.',
    requestedFactIds: [],
    proposals: [{
      // Luna recopiait naturellement le factId. Le moteur doit accepter ce
      // préfixe sans créer un second dossier.
      dossierId: 'dossier:current-dotcom-exuberance', title: 'Vigilance financière accrue', kind: 'economic', importance: 'major',
      actorIds: ['USA', 'FRA'], regionTags: ['Europe', 'Amérique du Nord'], phase: 'Réévaluation des expositions', trend: 'escalating',
      summary: 'Les autorités et investisseurs réévaluent progressivement leur exposition aux valeurs technologiques.',
      requiresPlayerDecision: true, playerDecision: 'Déterminer si la France prépare une surveillance prudentielle ciblée.',
      factIds: [dossierFact.id],
      relationEffects: [{ from: 'USA', to: 'FRA', relation: 8, trust: -8, reason: 'Consultations financières plus tendues.' }],
    }],
  });
  const dossier = applied.state.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(dossier.entries.some((entry) => entry.title === 'Vigilance financière accrue'));
  assert.ok(dossier.pendingDecisions.includes('Déterminer si la France prépare une surveillance prudentielle ciblée.'));
  assert.deepEqual(applied.updatedDossierIds, ['current-dotcom-exuberance']);
  const relation = applied.state.relations['USA:FRA'];
  assert.ok(relation);
  assert.equal(relation.relation - (initial.relations['USA:FRA']?.relation ?? 50), 3);
  assert.equal(relation.trust - (initial.relations['USA:FRA']?.trust ?? 50), -3);
  assert.equal(applied.relationChanges, 1);
});

test('le pouls mondial conserve le contexte interne du joueur sans exposer celui des autres pays', () => {
  const initial = createFrance2000World();
  const withPlayerDossierEntry = commitWorldAction(initial, {
    kind: 'diplomatic', actorId: 'FRA', targetIds: ['USA'], origin: 'player', visibility: 'player',
    intent: 'Préparer une consultation franco-américaine sur la bulle technologique',
    effects: [{
      kind: 'dossier_entry_add', dossierId: 'current-dotcom-exuberance', visibility: 'player', reason: 'Conserver le point de situation du joueur.',
      entry: {
        id: 'pulse-player-visible-entry', date: initial.currentDate, title: 'Consultation franco-américaine préparée',
        summary: 'Paris prépare une consultation avec Washington sur les expositions technologiques.', importance: 'major',
        actorIds: ['FRA', 'USA'], requiresDecision: false, visibility: 'player',
      },
    }],
  });
  const request = createWorldPulseRequest(withPlayerDossierEntry, withPlayerDossierEntry.actions.length, 1, 'test-world-pulse-private-continuity');
  const autonomy = request.pulses.find((item) => item.kind === 'world_autonomy');
  assert.ok(autonomy);
  if (!autonomy) return;
  assert.ok(autonomy.context.facts.some((fact) => fact.id === 'dossier-entry:pulse-player-visible-entry'));
  assert.ok(!autonomy.context.facts.some((fact) => fact.id === 'country:USA:capacity:government'));
});

test('un rejet du pouls IA est isolé et conserve le tour local en secours', async () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Ouvrir une coopération technologique avec l’Allemagne.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(initial, prepared.action);
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const request = createWorldPulseRequest(launched.state, initial.actions.length, 1, 'test-world-pulse-fallback');
  assert.equal(request.pulses.length, 2);
  const autonomy = request.pulses.find((item) => item.kind === 'world_autonomy');
  const reaction = request.pulses.find((item) => item.kind === 'player_reaction');
  assert.ok(autonomy && reaction);
  if (!autonomy || !reaction) return;
  const emptyAnswer = { headline: 'Aucun changement immédiat', synthesis: 'La mission ne relève aucun changement supplémentaire.', proposals: [], requestedFactIds: [] };
  const fakeFetcher = async () => new Response(JSON.stringify({
    ok: true,
    results: [
      { id: reaction.id, kind: reaction.kind, ok: true, answer: emptyAnswer, usage: { model: 'gpt-5.6-luna', inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, estimatedCostUsd: 0, latencyMs: 1 } },
      { id: autonomy.id, kind: autonomy.kind, ok: false, message: 'La réponse structurée de cette voie a été rejetée.' },
    ],
    usage: { model: 'gpt-5.6-luna', inputTokens: 20, cachedInputTokens: 0, outputTokens: 10, estimatedCostUsd: 0, latencyMs: 1, remainingSessionRequestsToday: 1 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await executeWorldPulse(launched.state, request, fakeFetcher as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(result.fallbackApplied, 1);
  assert.match(result.errors[0] ?? '', /world_autonomy/);
  assert.equal(result.state.currentDate, launched.state.currentDate);
});

test('un pouls IA valide traverse toute la boucle et matérialise une initiative autonome bornée', async () => {
  const initial = createFrance2000World();
  const request = createWorldPulseRequest(initial, initial.actions.length, 1, 'test-world-pulse-e2e');
  const autonomy = request.pulses.find((item) => item.kind === 'world_autonomy');
  assert.ok(autonomy);
  if (!autonomy) return;
  const fact = autonomy.context.facts.find((item) => item.id === 'dossier:current-dotcom-exuberance');
  assert.ok(fact);
  if (!fact) return;
  const fakeFetcher = async () => new Response(JSON.stringify({
    ok: true,
    results: [{
      id: autonomy.id, kind: autonomy.kind, ok: true,
      answer: {
        headline: 'Consultations financières ciblées',
        synthesis: 'Les partenaires ouvrent un canal limité sur le risque technologique.',
        requestedFactIds: [fact.id],
        proposals: [{
          dossierId: 'current-dotcom-exuberance', historicalAnchorId: null,
          title: 'Consultation transatlantique', kind: 'economic', importance: 'major',
          actorIds: ['USA', 'FRA'], regionTags: ['Atlantique'], phase: 'Consultations', trend: 'stable',
          summary: 'Washington propose une consultation technique avec Paris.',
          requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
          autonomousAction: {
            actorId: 'USA', targetIds: ['FRA'], category: 'diplomacy',
            objective: 'Ouvrir un canal de consultation financière.', operation: 'contact',
          },
        }],
      },
      usage: { model: 'gpt-5.6-luna', inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, estimatedCostUsd: 0, latencyMs: 1 },
    }],
    usage: { model: 'gpt-5.6-luna', inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, estimatedCostUsd: 0, latencyMs: 1, remainingSessionRequestsToday: 19 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await executeWorldPulse(initial, request, fakeFetcher as typeof fetch);
  assert.equal(result.ok, true);
  assert.ok(result.updatedDossierIds.includes('current-dotcom-exuberance'));
  assert.equal(result.queuedAutonomousPrograms, 1);
  assert.ok(Object.values(result.state.actionPrograms).some((program) => program.actorId === 'USA' && program.linkedDossierId === 'current-dotcom-exuberance'));
});

test('une conséquence autonome peut rester rattachée à son dossier mondial parent', () => {
  const state = createFrance2000World();
  const request = createWorldPulseRequest(state, state.actions.length, 1, 'test-dossier-parent');
  const autonomy = request.pulses.find((item) => item.kind === 'world_autonomy');
  assert.ok(autonomy);
  if (!autonomy) return;
  const fact = autonomy.context.facts.find((item) => item.id === 'dossier:current-dotcom-exuberance');
  assert.ok(fact);
  if (!fact) return;
  const applied = applyWorldPulseAnswer(state, autonomy, {
    headline: 'Déclinaison nationale',
    synthesis: 'Une tension globale produit une conséquence locale identifiable.',
    requestedFactIds: [fact.id],
    proposals: [{
      dossierId: null,
      parentDossierId: 'dossier:current-dotcom-exuberance',
      title: 'Conséquence nationale de la tension technologique',
      kind: 'economic', importance: 'moderate', actorIds: ['FRA'], regionTags: ['Europe'],
      phase: 'Réponse nationale', trend: 'stable',
      summary: 'Paris ouvre une revue interne liée à la tension mondiale.',
      requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
    }],
  });
  const created = applied.state.strategicDossiers[applied.createdDossierIds[0] ?? ''];
  assert.equal(created?.parentDossierId, 'current-dotcom-exuberance');
});

test('une réponse tardive du pouls conserve les actions faites pendant son calcul', async () => {
  const initial = createFrance2000World();
  const request = createWorldPulseRequest(initial, initial.actions.length, 1, 'test-world-pulse-rebase');
  const latest = commitWorldAction(initial, {
    kind: 'political', actorId: 'FRA', origin: 'player', visibility: 'player',
    intent: 'Action effectuée pendant le calcul du pouls',
    effects: [{ kind: 'metric_delta', countryId: 'FRA', metric: 'stability', delta: 0.25, reason: 'Vérifier la conservation des actions concurrentes.' }],
  });
  const results = request.pulses.map((item) => ({
    id: item.id,
    kind: item.kind,
    ok: true as const,
    answer: { headline: 'Aucun changement', synthesis: 'Le monde reste stable.', proposals: [], requestedFactIds: [] },
    usage: { model: 'gpt-5.6-luna', inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, estimatedCostUsd: 0, latencyMs: 1 },
  }));
  const fakeFetcher = async () => new Response(JSON.stringify({
    ok: true,
    results,
    usage: { model: 'gpt-5.6-luna', inputTokens: 20, cachedInputTokens: 0, outputTokens: 20, estimatedCostUsd: 0, latencyMs: 1, remainingSessionRequestsToday: 1 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await executeWorldPulse(initial, request, fakeFetcher as typeof fetch, () => latest);
  assert.ok(result.state.actions.some((action) => action.intent === 'Action effectuée pendant le calcul du pouls'));
  assert.equal(result.state.countries.FRA.metrics.stability, latest.countries.FRA.metrics.stability);
});

test('un rejet de l autonomie mondiale matérialise au plus un ancrage actif déjà visible', async () => {
  const active = advanceWorld(createFrance2000World(), '2001-01-01').state;
  const request = createWorldPulseRequest(active, active.actions.length, 1, 'test-historical-fallback');
  const autonomy = request.pulses.find((item) => item.kind === 'world_autonomy');
  assert.ok(autonomy);
  if (!autonomy) return;
  const activeVisible = autonomy.context.facts
    .filter((fact) => fact.id.startsWith('history-anchor:'))
    .map((fact) => fact.id.slice('history-anchor:'.length))
    .filter((id) => active.historicalAnchors[id]?.status === 'active');
  assert.ok(activeVisible.length >= 2);
  const fakeFetcher = async () => new Response(JSON.stringify({
    ok: true,
    results: [{ id: autonomy.id, kind: autonomy.kind, ok: false, message: 'Réponse autonomie rejetée.' }],
    usage: { model: 'gpt-5.6-luna', inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, latencyMs: 1, remainingSessionRequestsToday: 1 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await executeWorldPulse(active, request, fakeFetcher as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(result.fallbackApplied, 1);
  assert.equal(result.manifestedAnchorIds.length, 1);
  const manifestedId = result.manifestedAnchorIds[0];
  assert.ok(activeVisible.includes(manifestedId));
  const anchor = result.state.historicalAnchors[manifestedId];
  assert.equal(anchor.status, 'manifested');
  assert.ok(anchor.manifestation && anchor.possibleManifestations.includes(anchor.manifestation));
  const dossier = result.state.strategicDossiers[anchor.dossierId ?? `historical-${anchor.id}`];
  assert.ok(dossier.entries.some((entry) => entry.id === `historical-fallback-${anchor.id}-${result.state.currentDate}`));
});

test('la rotation d’attention mondiale remonte des régions négligées sans forcer un événement', () => {
  const state = createFrance2000World();
  const focus = rankWorldAttention(state, []);
  assert.ok(focus.length >= 3);
  assert.ok(focus.every((target) => target.priority >= 0 && target.priority <= 100));
  assert.ok(focus.some((target) => target.region === 'Afrique' || target.region === 'Asie du Sud-Est et Océanie'));
  const request = createWorldPulseRequest(state, state.actions.length, 1, 'test-world-pulse-attention');
  const autonomy = request.pulses.find((candidate) => candidate.kind === 'world_autonomy');
  assert.ok(autonomy?.context.autonomyFocus.length);
  assert.ok(parseWorldPulseRequest(request));
});

test('les dossiers majeurs calmes quittent la file IA, mais une décision en attente les y ramène immédiatement', () => {
  const initial = createFrance2000World();
  const dotcom = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(dotcom);
  if (!dotcom) return;
  const quiet = {
    ...initial,
    strategicDossiers: {
      ...initial.strategicDossiers,
      [dotcom.id]: { ...dotcom, lastAutonomousReviewAt: initial.currentDate, pendingDecisions: [] },
    },
  };
  assert.ok(!rankStrategicDossierReviews(quiet).some((review) => review.dossierId === dotcom.id));

  const urgent = {
    ...quiet,
    strategicDossiers: {
      ...quiet.strategicDossiers,
      [dotcom.id]: { ...quiet.strategicDossiers[dotcom.id], pendingDecisions: ['Choisir une réponse prudentielle.'] },
    },
  };
  const review = rankStrategicDossierReviews(urgent).find((candidate) => candidate.dossierId === dotcom.id);
  assert.ok(review?.requiresImmediateReview);
  assert.ok(review?.reasons.includes('décision du joueur en attente'));
  const request = createWorldPulseRequest(urgent, urgent.actions.length, 1, 'test-world-pulse-queue');
  const autonomy = request.pulses.find((candidate) => candidate.kind === 'world_autonomy');
  assert.ok(autonomy?.context.strategicDossierQueue.some((candidate) => candidate.dossierId === dotcom.id));
  assert.ok(parseWorldPulseRequest(request));
});

test('les files de dossiers séparent le pays joué des crises autonomes du monde', () => {
  const initial = createFrance2000World();
  const source = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(source);
  if (!source) return;
  const worldDossier = {
    ...source,
    id: 'test-world-major',
    title: 'Crise mondiale de démonstration',
    actorIds: ['USA', 'DEU'],
    scope: 'world' as const,
    pendingDecisions: ['Choisir une trajectoire autonome.'],
    lastAutonomousReviewAt: undefined,
  };
  const playerDossier = {
    ...source,
    id: 'test-player-major',
    title: 'Arbitrage national de démonstration',
    actorIds: ['FRA', 'DEU'],
    scope: 'player_involved' as const,
    pendingDecisions: ['Choisir une réponse française.'],
    lastAutonomousReviewAt: undefined,
  };
  const state = {
    ...initial,
    strategicDossiers: {
      ...initial.strategicDossiers,
      [worldDossier.id]: worldDossier,
      [playerDossier.id]: playerDossier,
    },
  };
  const playerQueue = rankStrategicDossierReviews(state);
  const worldQueue = rankWorldDossierReviews(state);
  assert.ok(playerQueue.some((review) => review.dossierId === playerDossier.id));
  assert.equal(playerQueue.some((review) => review.dossierId === worldDossier.id), false);
  assert.ok(worldQueue.some((review) => review.dossierId === worldDossier.id));
  assert.equal(worldQueue.some((review) => review.dossierId === playerDossier.id), false);
  const autonomy = createWorldPulseRequest(state, state.actions.length, 1, 'test-dossier-scope').pulses
    .find((candidate) => candidate.kind === 'world_autonomy');
  assert.ok(autonomy?.context.strategicDossierQueue.some((review) => review.dossierId === playerDossier.id));
  assert.ok(autonomy?.context.worldDossierQueue.some((review) => review.dossierId === worldDossier.id));
  assert.ok(parseWorldPulseRequest(createWorldPulseRequest(state, state.actions.length, 1, 'test-dossier-scope-parse')));
});

test('la file stratégique fait tourner les dossiers majeurs ex æquo au fil des mois', () => {
  const initial = createFrance2000World();
  const source = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(source);
  if (!source) return;
  const state = {
    ...initial,
    strategicDossiers: Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
      const id = `rotation-major-${index + 1}`;
      return [id, {
        ...source, id, title: `Dossier majeur en rotation ${index + 1}`, importance: 'major' as const,
        autoTracked: true, pendingDecisions: [], lastAutonomousReviewAt: undefined, lastLocalReviewAt: undefined,
      }];
    })),
  };
  const seen = new Set<string>();
  for (let month = 1; month <= 12; month += 1) {
    const currentDate = `2000-${String(month).padStart(2, '0')}-01` as ISODate;
    rankStrategicDossierReviews({ ...state, currentDate }, 4).forEach((review) => seen.add(review.dossierId));
  }
  assert.equal(seen.size, 8);
});

test('les voies de suivi des dossiers ont des cadences indépendantes', () => {
  const initial = createFrance2000World();
  const schedules = rankDossierReviews(initial);
  const major = schedules.find((review) => review.dossierId === 'current-dotcom-exuberance');
  const moderate = schedules.find((review) => review.dossierId === 'current-lisbon-convergence');

  assert.equal(major?.lane, 'major');
  assert.equal(major?.requiresImmediateReview, true);
  assert.equal(major?.due, true);
  assert.equal(moderate?.lane, 'moderate');
  assert.equal(moderate?.requiresImmediateReview, false);
  assert.equal(moderate?.intervalMonths, 6);
  assert.equal(moderate?.nextReviewAt, '2000-07-01');

  let state = initial;
  for (let month = 2; month <= 13; month += 1) {
    const year = 2000 + Math.floor((month - 1) / 12);
    const monthNumber = ((month - 1) % 12) + 1;
    const requestedDate = `${year}-${String(monthNumber).padStart(2, '0')}-01` as ISODate;
    state = advanceWorld(state, requestedDate).state;
  }
  assert.equal(state.currentDate, '2001-01-01');
  assert.equal(new Set(state.actions.map((action) => action.id)).size, state.actions.length);
  assert.equal(new Set(state.ledger.map((change) => change.id)).size, state.ledger.length);
});

test('une revue locale secondaire attend son échéance puis reste silencieuse', () => {
  const initial = createFrance2000World();
  const moderate = initial.strategicDossiers['current-lisbon-convergence'];
  assert.ok(moderate);
  if (!moderate) return;
  const june = { ...initial, currentDate: '2000-06-01' as ISODate };
  const juneState = advanceDossierReviewQueue(june);
  assert.equal(juneState.strategicDossiers[moderate.id]?.lastLocalReviewAt, undefined);
  const july = { ...june, currentDate: '2000-07-01' as ISODate };
  const reviewed = advanceDossierReviewQueue(july);
  const localReviews = reviewed.actions.filter((action) => action.metadata?.dossierReview === true && action.metadata.dossierReviewLane === 'moderate');
  assert.ok(localReviews.length >= 1);
  assert.equal(reviewed.strategicDossiers[moderate.id]?.lastLocalReviewAt, '2000-07-01');
  const august = { ...reviewed, currentDate: '2000-08-01' as ISODate };
  const after = advanceDossierReviewQueue(august);
  assert.equal(after.actions.filter((action) => action.metadata?.dossierReview === true && action.metadata.dossierReviewLane === 'moderate').length, localReviews.length);
});

test('un choix lié à un dossier est détecté même s’il est produit au même mois que la précédente revue', () => {
  const initial = createFrance2000World();
  const dotcom = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(dotcom);
  if (!dotcom) return;
  const reviewed = {
    ...initial,
    strategicDossiers: {
      ...initial.strategicDossiers,
      [dotcom.id]: {
        ...dotcom,
        lastAutonomousReviewAt: initial.currentDate,
        lastAutonomousReviewActionCount: initial.actions.length,
        pendingDecisions: [],
      },
    },
  };
  const afterChoice = commitWorldAction(reviewed, {
    kind: 'diplomatic', actorId: 'FRA', targetIds: ['USA'], origin: 'player', visibility: 'player',
    intent: 'Demander une consultation financière avec les États-Unis.', effects: [],
  });
  const review = rankStrategicDossierReviews(afterChoice).find((candidate) => candidate.dossierId === dotcom.id);
  assert.ok(review?.requiresImmediateReview);
});

test('la file mondiale borne les nouveaux dossiers majeurs sans effacer les dossiers existants', () => {
  const initial = createFrance2000World();
  const source = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(source);
  if (!source) return;
  const capped = {
    ...initial,
    strategicDossiers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const id = `test-major-${index + 1}`;
      return [id, { ...source, id, title: `Dossier majeur ${index + 1}`, importance: 'major' as const, autoTracked: true, pendingDecisions: [] }];
    })),
  };
  assert.equal(activeMajorDossierCount(capped), 12);
  const request = createWorldPulseRequest(capped, capped.actions.length, 1, 'test-world-pulse-cap');
  const item = request.pulses.find((candidate) => candidate.kind === 'world_autonomy');
  const fact = item?.context.facts.find((candidate) => candidate.id === 'world:economy');
  assert.ok(item && fact);
  if (!item || !fact) return;
  const applied = applyWorldPulseAnswer(capped, item, {
    headline: 'Émergence économique documentée', synthesis: 'Un sujet nouveau mais non prioritaire est enregistré.', requestedFactIds: [],
    proposals: [{
      dossierId: null, title: 'Dossier supplémentaire', kind: 'economic', importance: 'major',
      actorIds: ['FRA'], regionTags: ['Europe'], phase: 'Observation', trend: 'stable', summary: 'Une évolution économique est enregistrée sans saturer la file majeure.',
      requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
    }],
  });
  const created = applied.createdDossierIds.map((id) => applied.state.strategicDossiers[id]).find(Boolean);
  assert.equal(created?.importance, 'moderate');
  assert.equal(activeMajorDossierCount(applied.state), 12);

  const critical = applyWorldPulseAnswer(capped, item, {
    headline: 'Rupture critique documentée', synthesis: 'Une crise exceptionnelle doit rester visible.', requestedFactIds: [],
    proposals: [{
      dossierId: null, title: 'Crise critique supplémentaire', kind: 'security', importance: 'critical',
      actorIds: ['FRA'], regionTags: ['Europe'], phase: 'Alerte', trend: 'escalating', summary: 'Une crise critique remplace le suivi le moins urgent sans faire croître la file.',
      requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
    }],
  });
  const createdCritical = critical.createdDossierIds.map((id) => critical.state.strategicDossiers[id]).find(Boolean);
  assert.equal(createdCritical?.importance, 'critical');
  assert.equal(activeMajorDossierCount(critical.state), 12);
  assert.equal(Object.values(critical.state.strategicDossiers).filter((dossier) => dossier.importance === 'moderate').length, 1);
});

test('les événements mineurs autonomes sont peu nombreux, variés et soumis à un délai', () => {
  const initial = createFrance2000World();
  const first = runMinorEventCycle(initial, 3);
  assert.equal(first.events.length, 3);
  assert.ok(first.events.every((event) => first.state.actions.some((action) => action.metadata?.minorEventFamily === event.family)));
  const second = runMinorEventCycle(first.state, 3);
  assert.ok(second.events.every((event) => !first.events.some((previous) => previous.countryId === event.countryId && previous.family === event.family)));
});

test('le pouls ne transforme jamais un dossier inconnu en nouveau dossier', () => {
  const initial = createFrance2000World();
  const request = createWorldPulseRequest(initial, initial.actions.length, 1, 'test-world-pulse-session');
  const item = request.pulses.find((candidate) => candidate.kind === 'world_autonomy');
  assert.ok(item);
  if (!item) return;
  const fact = item.context.facts.find((candidate) => candidate.id === 'world:economy');
  assert.ok(fact);
  if (!fact) return;
  const applied = applyWorldPulseAnswer(initial, item, {
    headline: 'Tentative invalide', synthesis: 'Cette mise à jour ne doit rien créer.', requestedFactIds: [],
    proposals: [{
      dossierId: 'dossier-inexistant', title: 'Mise à jour invalide', kind: 'economic', importance: 'moderate',
      actorIds: ['FRA'], regionTags: [], phase: 'Sans effet', trend: 'stable', summary: 'Le moteur doit ignorer ce dossier absent.',
      requiresPlayerDecision: false, playerDecision: null, factIds: [fact.id], relationEffects: [],
    }],
  });
  assert.equal(Object.keys(applied.state.strategicDossiers).length, Object.keys(initial.strategicDossiers).length);
  assert.deepEqual(applied.createdDossierIds, []);
  assert.deepEqual(applied.updatedDossierIds, []);
});

test('le pouls de réaction conserve les choix du joueur faits avant le clic d’avance', () => {
  const firstTurn = advanceWorld(createFrance2000World(), '2000-02-01').state;
  const prepared = prepareCommonAction(firstTurn, 'Ouvrir une coopération technologique avec l’Allemagne.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(firstTurn, prepared.action);
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const after = advanceWorld(launched.state, '2000-03-01').state;
  const startIndex = firstTurn.actions.map((action) => action.kind).lastIndexOf('time_advance') + 1;
  const request = createWorldPulseRequest(after, startIndex, 1, 'test-world-pulse-session');
  const reaction = request.pulses.find((candidate) => candidate.kind === 'player_reaction');
  assert.ok(reaction?.context.recentPlayerActions.some((action) => action.id === launched.state.actions.at(-1)?.id));
});

test('une intention diplomatique devient un programme puis libère ses moyens à la résolution', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Ouvrir une coopération technologique avec l’Allemagne.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.action.category, 'diplomacy');
  const launched = launchCommonAction(initial, prepared.action);
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  assert.equal(launched.state.actionPrograms[launched.programId].status, 'active');
  assert.ok(launched.state.countries.FRA.capacities.diplomacy.committed > initial.countries.FRA.capacities.diplomacy.committed);
  const advanced = advanceWorld(launched.state, '2000-06-01').state;
  assert.notEqual(advanced.actionPrograms[launched.programId].status, 'active');
  assert.equal(advanced.countries.FRA.capacities.diplomacy.committed, initial.countries.FRA.capacities.diplomacy.committed);
});

test('une initiative diplomatique réussie crée un engagement et un dossier persistants', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Négocier une alliance défensive avec l’Allemagne.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(initial, { ...prepared.action, successProbability: 100 });
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const advanced = advanceWorld(launched.state, '2000-08-01').state;
  assert.ok(Object.values(advanced.treaties).some((treaty) => treaty.parties.includes('DEU') && treaty.status === 'active'));
  assert.ok(Object.values(advanced.strategicDossiers).some((dossier) => dossier.actorIds.includes('DEU') && dossier.kind === 'security'));
  assert.equal(advanced.actionPrograms[launched.programId].status, 'succeeded');
});

test('une option IA reste consultative, ouvre un dossier puis reçoit le résultat de résolution', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Proposer une coopération technologique avec le Japon.', {
    source: 'ai', requestId: 'ai-quality-option-1',
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.action.intentSpec?.source, 'ai');
  assert.equal(prepared.action.intentSpec?.requestId, 'ai-quality-option-1');
  const launched = launchCommonAction(initial, { ...prepared.action, successProbability: 100 });
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const activeDossier = Object.values(launched.state.strategicDossiers).find((dossier) => dossier.actorIds.includes('JPN'));
  assert.ok(activeDossier);
  assert.equal(activeDossier?.status, 'active');
  const advanced = advanceWorld(launched.state, '2000-06-01').state;
  const resolvedDossier = activeDossier ? advanced.strategicDossiers[activeDossier.id] : undefined;
  assert.ok(resolvedDossier?.entries.some((entry) => entry.id === `${launched.programId}-resolution`));
  assert.equal(resolvedDossier?.phase, 'Première mise en œuvre achevée');
});

test('un contrat énergétique ne peut pas dépasser la capacité physique restante', () => {
  const state = createFrance2000World();
  const nodeId = 'nor-oil';
  const available = nodeAvailableExport(state, nodeId);
  const result = proposeEnergyContract(state, {
    id: 'impossible-contract', nodeId, buyerId: 'FRA', annualVolume: available + 1,
    startDate: state.currentDate, endDate: '2005-01-01', priceFormula: 'Brent', route: 'Mer du Nord',
  });
  assert.equal(result.ok, false);
  assert.equal(result.state.actions.length, 0);
});

test('le registre énergétique réserve les flux historiques et empêche une double vente', () => {
  const initial = createFrance2000World();
  assert.ok(Object.keys(initial.baselineEnergyFlows).length > 40);
  assert.equal(energyBalance(initial, 'FRA', 'gas')?.imports, 43);
  const available = nodeAvailableExport(initial, 'dza-gas');
  const proposal = proposeEnergyContract(initial, {
    id: 'all-dza-gas', nodeId: 'dza-gas', buyerId: 'FRA', annualVolume: available,
    startDate: '2000-01-01', endDate: '2005-01-01', priceFormula: 'Marché', route: 'Méditerranée',
  });
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  assert.equal(nodeAvailableExport(proposal.state, 'dza-gas'), 0);
  const second = proposeEnergyContract(proposal.state, {
    id: 'double-sale', nodeId: 'dza-gas', buyerId: 'ITA', annualVolume: 1,
    startDate: '2000-01-01', endDate: '2005-01-01', priceFormula: 'Marché', route: 'Méditerranée',
  });
  assert.equal(second.ok, false);
});

test('un pays sans corridor énergétique détaillé conserve ses importations héritées', () => {
  const state = createFrance2000World();
  const balance = energyBalance(state, 'BEN', 'gas');
  assert.ok(balance);
  assert.equal(balance?.deficit, 0);
  assert.ok((balance?.imports ?? 0) > 0);
});

test('une demande simple produit une proposition gazière administrativement réaliste', () => {
  const state = createFrance2000World();
  const result = createAdministrativeEnergyOffer(state, 'DZA', 'gas');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.offer.diplomaticEffort, 'faible');
  assert.equal(result.offer.durationYears, 12);
  assert.ok(result.offer.coverageShare > 0 && result.offer.coverageShare <= 20);
  assert.ok(result.offer.annualVolume <= nodeAvailableExport(state, result.offer.nodeId));
});

test('une négociation acceptée devient un contrat physique actif', () => {
  const initial = createFrance2000World();
  assert.equal(initial.leadership.FRA.figures.length, 2);
  assert.equal(initial.leadership.DZA.figures[0].name, 'Abdelaziz Bouteflika');
  const draft = createAdministrativeEnergyOffer(initial, 'DZA', 'gas');
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const sent = sendEnergyOffer(initial, draft.offer);
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  assert.equal(sent.response.status, 'accepted');
  const openSession = sent.state.diplomaticSessions[draft.offer.id];
  assert.equal(openSession.status, 'awaiting_signature');
  assert.equal(openSession.turns.length, 2);
  assert.equal(openSession.privatePosition.ownerCountryId, 'DZA');
  const signed = acceptEnergyOffer(sent.state, sent.response.offer);
  assert.equal(signed.ok, true);
  if (!signed.ok) return;
  assert.equal(signed.state.energyContracts[signed.contractId].status, 'active');
  assert.equal(signed.state.diplomaticSessions[draft.offer.id].status, 'active');
  assert.equal(signed.state.diplomaticSessions[draft.offer.id].linkedContractId, signed.contractId);
  assert.ok(signed.state.actions.some((action) => action.origin === 'player' && action.intent.includes(signed.contractId)));
  assert.ok((energyBalance(signed.state, 'FRA', 'gas')?.imports ?? 0) > (energyBalance(initial, 'FRA', 'gas')?.imports ?? 0));
  const dossier = signed.state.strategicDossiers['energy-FRA-DZA-gas'];
  assert.equal(dossier.followed, true);
  assert.equal(dossier.phase, 'Exécution du contrat');
  assert.equal(dossier.pendingDecisions.length, 0);
  assert.ok(dossier.commitments.length >= 1);
});

test('durcir une offre reste facultatif et provoque une vraie contre-réaction', () => {
  const initial = createFrance2000World();
  const draft = createAdministrativeEnergyOffer(initial, 'DZA', 'gas');
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const volume = adjustEnergyOffer(initial, draft.offer, 'more_volume');
  const price = adjustEnergyOffer(initial, volume, 'better_price');
  assert.equal(price.diplomaticEffort, 'modérée');
  const sent = sendEnergyOffer(initial, price);
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  assert.ok(['countered', 'refused'].includes(sent.response.status));
});

test('une rupture idéologique est un chemin politique coûteux, pas une action gratuite', () => {
  const state = createFrance2000World();
  const pathway = evaluatePoliticalPathway(state, 'FRA', {
    requiredAuthority: 'constitutional', doctrine: { economic: 0, sovereignty: 95 },
    publicSalience: 95, administrativeComplexity: 90,
  });
  assert.ok(['blocked', 'rupture'].includes(pathway.status));
  assert.ok(pathway.obstacles.length >= 2);
  assert.ok(pathway.routes.length >= 1);
});

test('la cadence autonome dépend du calendrier, pas du nombre de clics', () => {
  const initialA = createFrance2000World();
  const oneJump = advanceWorld(initialA, '2000-04-01').state;

  let monthly = createFrance2000World();
  monthly = advanceWorld(monthly, '2000-02-01').state;
  monthly = advanceWorld(monthly, '2000-03-01').state;
  monthly = advanceWorld(monthly, '2000-04-01').state;

  const nonPlayerReviews = (state: typeof monthly) => state.actions.filter((action) =>
    action.intent === 'Révision périodique de la stratégie nationale' && action.actorId !== state.playerCountryId,
  ).map((action) => `${action.createdAt}:${action.actorId}`);
  assert.deepEqual(nonPlayerReviews(oneJump), nonPlayerReviews(monthly));
});

test('chaque avance expose une résolution de tour unique et traçable', () => {
  const initial = createFrance2000World();
  const result = advanceWorld(initial, '2000-04-01');

  assert.equal(result.resolution.from, initial.currentDate);
  assert.equal(result.resolution.to, result.reachedDate);
  assert.equal(result.resolution.requestedDate, '2000-04-01');
  assert.equal(result.resolution.isNoop, false);
  assert.ok(result.resolution.phasesCompleted.includes('macroeconomy'));
  assert.ok(result.resolution.phasesCompleted.includes('country-autonomy'));
  assert.equal(result.resolution.actionsAdded, result.state.actions.length - initial.actions.length);
  assert.equal(result.resolution.changesAdded, result.state.ledger.length - initial.ledger.length);
  assert.ok(result.resolution.autonomousActions > 0);
});

test('le monde agit sans attendre le joueur', () => {
  const result = advanceWorld(createFrance2000World(), '2001-01-01');
  const autonomousActors = new Set(result.state.actions
    .filter((action) => action.intent === 'Révision périodique de la stratégie nationale')
    .map((action) => action.actorId));
  assert.ok(autonomousActors.size >= 4);
  assert.ok(!autonomousActors.has('FRA'));
});

test('le conseiller local produit des options situées et auditables', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Que pouvons-nous proposer à l’Allemagne avant le prochain conseil ?', { focusCountryId: 'DEU' });
  assert.equal(answer.mode, 'options');
  assert.equal(answer.generatedBy, 'local_rules');
  assert.ok(answer.plans.length >= 2);
  const diplomatic = answer.plans.find((plan) => plan.id.startsWith('plan-diplomacy-'))!;
  assert.ok(diplomatic);
  assert.ok(diplomatic.measures.length >= 3);
  assert.ok(diplomatic.factsUsed.some((fact) => fact.includes('Relation')));
  assert.ok(assessStrategicPlan(state, diplomatic).capabilityPressure.length >= 1);
});

test('le classificateur local distingue faits, stratégie et diplomatie', () => {
  assert.equal(classifyAdvisorQuestion('Quel est le PIB français en 2000 ?').kind, 'fact');
  assert.equal(classifyAdvisorQuestion('Que peut faire la France pour réduire sa dette ?').kind, 'strategy');
  assert.equal(classifyAdvisorQuestion('Négocier un contrat gazier avec l’Algérie').kind, 'diplomacy');
  const fact = answerAdvisorQuestion(createFrance2000World(), 'Quel est le PIB réel de la France en 2000 ?');
  assert.equal(fact.questionKind, 'fact');
  assert.equal(fact.plans.length, 0);

  const mixed = classifyAdvisorQuestion('Compare deux trajectoires françaises : priorité à l’énergie ou aux semi-conducteurs ?');
  assert.equal(mixed.kind, 'strategy');
  assert.deepEqual(mixed.dimensions, ['strategy', 'situation']);
  assert.equal(mixed.responseMode, 'facts_and_options');

  const multiActor = answerAdvisorQuestion(createFrance2000World(), 'Construis une proposition entre la Turquie et la Grèce avec médiation française.');
  assert.deepEqual(multiActor.actors.map((actor) => actor.id), ['FRA', 'TUR', 'GRC']);
  assert.ok(multiActor.facts.some((item) => item.id === 'actor-GRC-strategy'));
});

test('le conseiller conserve les pays cités et reconnaît le vocabulaire énergétique', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Compare la vulnérabilité énergétique de la France, de l’Allemagne et de l’Italie : stocks de gaz, production et options.', { questionKind: 'strategy' });
  assert.ok(answer.actors.some((actor) => actor.id === 'DEU'));
  assert.ok(answer.actors.some((actor) => actor.id === 'ITA'));
  assert.ok(answer.facts.some((fact) => fact.id === 'target-gas' || fact.id === 'actor-DEU-gas'));
  assert.ok(answer.facts.some((fact) => fact.id === 'actor-ITA-gas'));
});

test('un programme ne peut pas engager un budget inférieur à son coût', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Lancer un programme industriel de semi-conducteurs.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const poor = { ...initial, countries: { ...initial.countries, FRA: { ...initial.countries.FRA, metrics: { ...initial.countries.FRA.metrics, budget: 0 } } } };
  const launched = launchCommonAction(poor, prepared.action);
  assert.equal(launched.ok, false);
  assert.match(launched.error, /Budget insuffisant/);
});

test('une intention inconnue ne devient pas arbitrairement un programme économique', () => {
  const result = prepareCommonAction(createFrance2000World(), 'Faire quelque chose de surprenant.');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /ne reconnaît pas encore le domaine/);
});

test('les actions économiques utilisent des leviers distincts plutôt qu’un bonus générique', () => {
  const initial = createFrance2000World();
  const stimulus = prepareCommonAction(initial, 'Lancer un plan de relance par la commande publique.');
  const consolidation = prepareCommonAction(initial, 'Réduire fortement le déficit et maîtriser les dépenses publiques.');
  const semiconductors = prepareCommonAction(initial, 'Créer une filière stratégique française de semi-conducteurs.');
  assert.equal(stimulus.ok, true);
  assert.equal(consolidation.ok, true);
  assert.equal(semiconductors.ok, true);
  if (!stimulus.ok || !consolidation.ok || !semiconductors.ok) return;
  assert.equal(stimulus.action.lever, 'fiscal_stimulus');
  assert.equal(consolidation.action.lever, 'fiscal_consolidation');
  assert.equal(semiconductors.action.lever, 'strategic_sector');
  assert.notEqual(stimulus.action.durationMonths, semiconductors.action.durationMonths);
  assert.ok(semiconductors.action.successEffects.some((effect) => effect.kind === 'sector_delta' && effect.sectorId === 'FRA-semiconductors'));
});

test('une consolidation réussie peut réellement rendre la posture budgétaire négative', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Réduire fortement le déficit par une consolidation budgétaire.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(initial, { ...prepared.action, successProbability: 100 });
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const resolved = advanceCommonActionPrograms(launched.state, prepared.action.durationMonths);
  assert.ok(resolved.macroEconomies.FRA.policy.fiscalStance < initial.macroEconomies.FRA.policy.fiscalStance);
});

test('un programme de réserves énergétiques ne crée pas gratuitement de pétrole ou de gaz', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Développer les réserves stratégiques de pétrole et la résilience énergétique.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.action.lever, 'energy_resilience');
  assert.ok(prepared.warnings.some((warning) => warning.includes('contrat d’approvisionnement')));
  assert.equal(prepared.action.successEffects.some((effect) => effect.kind === 'energy_stock_delta'), false);
});

test('un prospect d’armement peut être autorisé ou refusé sans engagement de capacité permanent', () => {
  const initial = createFrance2000World();
  assert.ok(rankArmamentProspectBuyers(initial, initial.armamentProducts.exocet).length > 8);
  const proposed = createAutomaticArmamentProspects(initial);
  const product = Object.values(proposed.armamentProducts).find((item) => item.prospects.some((prospect) => ['approval_required', 'negotiating'].includes(prospect.status)));
  assert.ok(product);
  if (!product) return;
  const prospect = product.prospects.find((item) => ['approval_required', 'negotiating'].includes(item.status))!;
  const diplomacyBefore = proposed.countries.FRA.capacities.diplomacy.committed;
  const authorized = authorizeArmamentProspect(proposed, product.id, prospect.id);
  assert.equal(authorized.ok, true);
  if (!authorized.ok) return;
  assert.equal(authorized.state.armamentProducts[product.id].prospects.find((item) => item.id === prospect.id)?.status, 'won');
  assert.ok(authorized.state.armamentProducts[product.id].backlogMonths > product.backlogMonths);
  assert.equal(authorized.state.countries.FRA.capacities.diplomacy.committed, diplomacyBefore);
  const rejected = rejectArmamentProspect(proposed, product.id, prospect.id);
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  assert.equal(rejected.state.armamentProducts[product.id].prospects.find((item) => item.id === prospect.id)?.status, 'lost');
  assert.equal(rejected.state.armamentProducts[product.id].backlogMonths, product.backlogMonths);
});

test('un joueur étranger ne peut pas décider pour l’industrie d’armement française', () => {
  const initial = createWorld2000('JPN');
  const product = structuredClone(initial.armamentProducts.rafale);
  product.prospects = [{ id: 'rafale-test-jpn', countryId: 'IND', quantity: 12, status: 'approval_required', politicalSensitivity: 40 }];
  initial.armamentProducts.rafale = product;
  const attempted = authorizeArmamentProspect(initial, 'rafale', 'rafale-test-jpn');
  assert.equal(attempted.ok, false);
  assert.match(attempted.error, /pays producteur/);
});

test('la direction et l’appareil politique modulent une action du joueur et ses oppositions', () => {
  const initial = createFrance2000World();
  const prepared = prepareCommonAction(initial, 'Réduire fortement le déficit par une consolidation budgétaire.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.ok(prepared.action.politicalAssessment);
  assert.ok((prepared.action.politicalAssessment?.leaderDisposition ?? 100) < 70);
  const launched = launchCommonAction(initial, prepared.action);
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  assert.ok(Object.values(launched.state.stakeholderReactions).some((reaction) => reaction.causes.includes(prepared.action.title)));
});

test('une action étrangère proposée par l’IA reste soumise à la doctrine nationale', () => {
  const initial = createFrance2000World();
  const stimulus = queueAutonomousProgram(initial, {
    actorId: 'DEU', targetIds: [], category: 'economic', objective: 'Lancer une relance massive financée par le déficit public.',
  }, 'test-deu-stimulus');
  const trade = queueAutonomousProgram(initial, {
    actorId: 'DEU', targetIds: ['FRA'], category: 'economic', objective: 'Développer les exportations allemandes vers la France.',
  }, 'test-deu-trade');
  assert.ok(trade);
  if (stimulus) {
    assert.equal(stimulus.program.lever, 'fiscal_stimulus');
    assert.ok(stimulus.program.successProbability < trade!.program.successProbability);
  }
});

test('la signature énergétique est idempotente', () => {
  const initial = createFrance2000World();
  const draft = createAdministrativeEnergyOffer(initial, 'DZA', 'gas');
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const sent = sendEnergyOffer(initial, draft.offer);
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  const first = acceptEnergyOffer(sent.state, sent.response.offer);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = acceptEnergyOffer(first.state, sent.response.offer);
  assert.equal(second.ok, false);
  assert.match(second.error, /déjà été signée/);
});

test('la fiche pays et le conseiller exposent des chiffres opérationnels sans jauge de fiabilité', () => {
  const state = createFrance2000World();
  const sheet = countrySheet(state, 'FRA');
  assert.equal(sheet?.defense?.activePersonnelThousands, 353);
  assert.equal(sheet?.macro?.population, 60.919);
  const answer = answerAdvisorQuestion(state, 'Quel est l’état des forces militaires françaises ?');
  assert.ok(answer.facts.some((fact) => fact.id === 'player-defense-budget'));
  assert.ok(answer.facts.some((fact) => fact.id === 'player-defense-personnel'));
  assert.ok(answer.facts.some((fact) => fact.id === 'player-defense-deployments'));
  assert.ok(answer.facts.find((fact) => fact.id === 'player-defense-deployments')?.value.includes('Côte d’Ivoire'));
  assert.ok(answer.facts.some((fact) => fact.value.includes('353 milliers')));
});

test('un État autonome comble aussi une réserve énergétique trop faible', () => {
  const state = createFrance2000World();
  state.countryEnergy.POL.strategicStocks.gas = 0;
  const reviewed = reviewCountryStrategy(state, 'POL');
  assert.ok(Object.values(reviewed.energyContracts).some((contract) => contract.buyerId === 'POL' && contract.resource === 'gas'));
});

test('une demande libre identifie le pays et la ressource sans sélecteur', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Je veux négocier un contrat gazier de long terme avec l’Algérie.');
  assert.equal(answer.interpretation.kind, 'energy_contract');
  assert.equal(answer.interpretation.resource, 'gas');
  assert.equal(answer.interpretation.targetId, 'DZA');
  assert.equal(answer.plans.length, 1);
  assert.equal(answer.plans[0].execution?.supplierId, 'DZA');
});

test('une demande de sécurisation gazière reste bien un contrat de gaz', () => {
  const state = createFrance2000World();
  const text = 'Demander à l’Algérie une sécurisation de nos approvisionnements gaziers pour réduire la vulnérabilité énergétique.';
  const answer = answerAdvisorQuestion(state, text);
  assert.equal(answer.interpretation.kind, 'energy_contract');
  assert.equal(answer.interpretation.resource, 'gas');
  assert.equal(answer.interpretation.targetId, 'DZA');
  assert.equal(answer.plans.length, 1);
  assert.equal(answer.plans[0].execution?.supplierId, 'DZA');
  assert.equal(answer.plans[0].execution?.resource, 'gas');
  const prepared = prepareCommonAction(state, text);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.action.lever, 'energy_resilience');
});

test('un ancien onglet de pouls v1/v2 est migré sans perdre sa mission', () => {
  const state = createFrance2000World();
  const current = createWorldPulseRequest(state, state.actions.length, 1, 'legacy-pulse-v2-session');
  const legacyV2 = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
  legacyV2.schemaVersion = 2;
  for (const item of legacyV2.pulses as Array<Record<string, unknown>>) {
    const context = item.context as Record<string, unknown>;
    delete context.worldDossierQueue;
    if (Array.isArray(context.strategicDossierQueue)) {
      for (const review of context.strategicDossierQueue as Array<Record<string, unknown>>) delete review.scope;
    }
  }
  assert.ok(parseWorldPulseRequest(legacyV2));

  const prepared = prepareCommonAction(state, 'Ouvrir une coopération technologique avec l’Allemagne.');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(state, prepared.action);
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const currentV1 = createWorldPulseRequest(launched.state, state.actions.length, 1, 'legacy-pulse-v1-session');
  const legacyV1 = JSON.parse(JSON.stringify(currentV1)) as Record<string, unknown>;
  legacyV1.schemaVersion = 1;
  for (const item of legacyV1.pulses as Array<Record<string, unknown>>) {
    const context = item.context as Record<string, unknown>;
    delete context.strategicDossierQueue;
    delete context.worldDossierQueue;
  }
  assert.equal((legacyV1.pulses as unknown[]).length, 2);
  assert.ok(parseWorldPulseRequest(legacyV1));
});

test('sans partenaire imposé, le moteur classe plusieurs fournisseurs réels', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Je veux sécuriser un contrat gazier de long terme.');
  const ranked = rankEnergySuppliers(state, 'gas');
  assert.equal(answer.interpretation.targetStatus, 'unspecified');
  assert.ok(answer.plans.length >= 2);
  assert.equal(answer.plans[0].execution?.supplierId, ranked[0].countryId);
  assert.equal(new Set(answer.plans.map((plan) => plan.execution?.supplierId)).size, answer.plans.length);
});

test('une fiche nationale compacte est utilisable sans inventaire territorial détaillé', () => {
  const state = createFrance2000World();
  const intent = interpretPlayerIntent(state, 'Négocier un contrat gazier avec le Kazakhstan.');
  const answer = answerAdvisorQuestion(state, 'Négocier un contrat gazier avec le Kazakhstan.');
  assert.equal(intent.targetLabel, 'Kazakhstan');
  assert.equal(intent.targetStatus, 'modeled');
  assert.equal(answer.plans.length, 0);
  assert.ok(answer.synthesis.includes('aucune capacité exportatrice'));
});

test('un dossier conserve ses nouveautés jusqu’à leur consultation', () => {
  const state = createFrance2000World();
  const dossierId = 'current-dotcom-exuberance';
  assert.equal(dossierUnreadCount(state, dossierId), 1);
  assert.ok(dossiersRequiringAttention(state).some((dossier) => dossier.id === dossierId));
  const viewed = markDossierViewed(state, dossierId);
  assert.equal(dossierUnreadCount(viewed, dossierId), 0);
  assert.ok(dossiersRequiringAttention(viewed).some((dossier) => dossier.id === dossierId));
});

test('le joueur peut épingler un dossier modéré sans modifier la simulation', () => {
  const state = createFrance2000World();
  const dossierId = 'current-lisbon-convergence';
  const followed = setDossierFollowed(state, dossierId, true);
  assert.equal(followed.strategicDossiers[dossierId].followed, true);
  assert.equal(followed.actions.length, state.actions.length);
  assert.ok(dossiersRequiringAttention(followed).some((dossier) => dossier.id === dossierId));
});

test('une manifestation historique alimente le dossier au lieu de rester isolée', () => {
  const state = createFrance2000World();
  state.latentProcesses['dotcom-repricing'].progress = 99.9;
  const advanced = advanceWorld(state, '2000-04-01').state;
  const dossier = advanced.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(dossier.entries.some((entry) => entry.id.startsWith('manifestation-dotcom-repricing')));
  assert.equal(dossier.trend, 'escalating');
});

test('un passage du temps expose un audit de pipeline sans modifier la logique du tour', () => {
  const result = advanceWorld(createFrance2000World(), '2000-04-01');
  assert.equal(result.state.currentDate, '2000-04-01');
  assert.equal(result.audit.ok, true);
  assert.equal(result.audit.chunks, 3);
  assert.ok(result.audit.phases.some((phase) => phase.id === 'macroeconomy'));
  assert.ok(result.audit.phases.some((phase) => phase.id === 'dossier-signals'));
  assert.ok(result.audit.phases.every((phase) => phase.actionsAfter >= phase.actionsBefore));
});

test('un signal externe significatif réveille automatiquement un dossier secondaire endormi', () => {
  const initial = createFrance2000World();
  const source = initial.strategicDossiers['current-lisbon-convergence'];
  const sleeping = {
    ...initial,
    currentDate: '2000-08-01' as const,
    strategicDossiers: {
      ...initial.strategicDossiers,
      [source.id]: { ...source, pendingDecisions: [], sleepingAt: '2000-02-01' as const, status: 'deescalating' as const, phase: 'Mise en sommeil' as const },
    },
  };
  const signaled = commitWorldAction(sleeping, {
    kind: 'diplomatic', actorId: 'DEU', targetIds: ['FRA'], origin: 'ai', visibility: 'player',
    intent: 'Berlin demande une consultation économique urgente',
    effects: [{ kind: 'relation_delta', from: 'DEU', to: 'FRA', relation: 2, trust: 1, reason: 'Une consultation bilatérale modifie le canal.' }],
  });
  const advanced = advanceWorld(signaled, '2000-09-01');
  assert.equal(advanced.audit.ok, true);
  const awakened = advanced.state.strategicDossiers[source.id];
  assert.equal(awakened.sleepingAt, undefined);
  assert.equal(awakened.reactivatedAt, '2000-09-01');
  assert.equal(awakened.phase, 'Réactivé par signal externe');
  assert.equal(awakened.entries.at(-1)?.sourceActionId, signaled.actions.at(-1)?.id);
});

test('une décision ignorée relance puis escalade le dossier avec un délai', () => {
  const initial = createFrance2000World();
  const first = advanceDossierEscalation({ ...initial, currentDate: '2000-03-01' });
  const dossier = first.strategicDossiers['current-dotcom-exuberance'];
  assert.equal(dossier.escalationCount, 1);
  assert.equal(dossier.trend, 'escalating');
  assert.ok(dossier.entries.at(-1)?.title.includes('Relance'));

  const sameMonth = advanceDossierEscalation(first);
  assert.equal(sameMonth.strategicDossiers[dossier.id].escalationCount, 1);

  const second = advanceDossierEscalation({ ...first, currentDate: '2000-05-01' });
  const escalated = second.strategicDossiers[dossier.id];
  assert.equal(escalated.escalationCount, 2);
  assert.equal(escalated.importance, 'critical');
  assert.ok(escalated.entries.at(-1)?.title.includes('Escalade'));
});

test('le silence explicite résout la décision mais dégrade le canal sur un dossier urgent', () => {
  const initial = createFrance2000World();
  const dossierId = 'current-dotcom-exuberance';
  const decision = initial.strategicDossiers[dossierId].pendingDecisions[0];
  const resolved = resolveDossierDecision(initial, dossierId, decision, 'explicit_silence');
  const dossier = resolved.strategicDossiers[dossierId];
  assert.equal(dossier.pendingDecisions.length, 0);
  assert.equal(dossier.decisionRecords?.at(-1)?.resolutionChannel, 'explicit_silence');
  assert.equal(dossier.trend, 'escalating');
});

test('un dossier secondaire ancien passe en sommeil sans perdre son historique', () => {
  const initial = createFrance2000World();
  const source = initial.strategicDossiers['current-lisbon-convergence'];
  const pending = { ...source, pendingDecisions: ['Choisir un calendrier de coopération.'], updatedAt: '2000-01-01' as const };
  const stale = { ...initial, currentDate: '2000-08-01' as const, strategicDossiers: { ...initial.strategicDossiers, [source.id]: pending } };
  const sleeping = advanceDossierLifecycle(stale).strategicDossiers[source.id];
  assert.equal(sleeping.pendingDecisions.length, 0);
  assert.equal(sleeping.sleepingAt, '2000-08-01');
  assert.equal(sleeping.decisionRecords?.at(-1)?.status, 'expired');
  assert.equal(sleeping.entries.at(-1)?.title, 'Dossier mis en sommeil');
  const active = reactivateDossier(advanceDossierLifecycle(stale), source.id).strategicDossiers[source.id];
  assert.equal(active.sleepingAt, undefined);
  assert.equal(active.phase, 'Réactivé par le joueur');
});

test('la sauvegarde et le registre permettent de reconstruire exactement un état', () => {
  const initial = createFrance2000World();
  const advanced = advanceWorld(initial, '2000-03-01').state;
  const restored = deserializeWorld(serializeWorld(advanced));
  assert.deepEqual(restored, advanced);

  const replayed = replayWorld(createFrance2000World(), advanced.actions);
  assert.deepEqual(replayed, advanced);
});

test('une longue sauvegarde compacte les écritures techniques mais conserve les actions importantes', () => {
  const initial = createFrance2000World();
  const technicalActions = Array.from({ length: 2_400 }, (_, index) => ({
    id: `technical-${index}`, createdAt: initial.currentDate, status: 'applied' as const,
    kind: 'time_advance' as const, actorId: 'FRA', targetIds: [], origin: 'time' as const,
    visibility: 'debug' as const, intent: `Écriture technique ${index}`, effects: [],
  }));
  const playerAction = {
    ...technicalActions[0], id: 'player-important', origin: 'player' as const,
    visibility: 'player' as const, intent: 'Action politique à conserver',
  };
  const large = {
    ...initial,
    sequence: 2_400,
    actions: [playerAction, ...technicalActions],
    ledger: technicalActions.map((action, index) => ({
      id: `change-${index}`, actionId: action.id, date: initial.currentDate, actorId: 'FRA',
      path: 'currentDate', before: initial.currentDate, after: initial.currentDate,
      reason: action.intent, origin: 'time' as const, visibility: 'debug' as const,
    })),
  };
  const compacted = compactWorldForSave(large);
  assert.ok(compacted.actions.length < large.actions.length);
  assert.ok(compacted.actions.some((action) => action.id === 'player-important'));
  assert.ok(compacted.ledger.length < large.ledger.length);
  assert.deepEqual(compacted.countries, large.countries);
  assert.deepEqual(compacted.macroEconomies, large.macroEconomies);
});

test('le noyau macroéconomique fait évoluer réellement les économies sur un an', () => {
  const initial = createFrance2000World();
  const advanced = advanceWorld(initial, '2001-01-01').state;
  assert.equal(Object.keys(initial.macroEconomies).length, 195);
  assert.equal(initial.macroEconomies.FRA.realGdpBillion2000Usd, 1360.959);
  assert.ok(advanced.macroEconomies.FRA.realGdpBillion2000Usd > initial.macroEconomies.FRA.realGdpBillion2000Usd);
  assert.notEqual(advanced.macroEconomies.FRA.realGrowthAnnualPct, initial.macroEconomies.FRA.realGrowthAnnualPct);
  assert.ok(advanced.worldEconomy.demandIndex > initial.worldEconomy.demandIndex);
  assert.equal(energyBalance(initial, 'FRA', 'oil')?.deficit, 0);
  assert.equal(Object.keys(initial.macroEconomies.FRA.products).length, 6);
  assert.equal(Object.keys(initial.macroEconomies.FRA.sectors).length, 6);
  assert.ok(Object.keys(initial.tradeFlows).length >= 30);
});

test('une crise financière se transmet à la demande, à l’emploi et aux comptes publics', () => {
  const initial = createFrance2000World();
  const normal = advanceWorld(structuredClone(initial), '2001-01-01').state;
  let crisis = addEconomicShock(structuredClone(initial), {
    id: 'test-credit-freeze', label: 'Gel mondial du crédit', channel: 'financial', intensity: 70,
    remainingMonths: 18, decayPerMonth: 0.035, affectedCountryIds: [], source: 'local_rule',
  });
  crisis = addEconomicShock(crisis, {
    id: 'test-demand-crash', label: 'Contraction de la demande', channel: 'demand', intensity: 45,
    remainingMonths: 12, decayPerMonth: 0.04, affectedCountryIds: [], source: 'local_rule',
  });
  const stressed = advanceWorld(crisis, '2001-01-01').state;
  assert.ok(stressed.worldEconomy.globalGrowthAnnualPct < normal.worldEconomy.globalGrowthAnnualPct - 2);
  assert.ok(stressed.macroEconomies.FRA.financialStress > normal.macroEconomies.FRA.financialStress + 20);
  assert.ok(stressed.macroEconomies.FRA.unemploymentPct > normal.macroEconomies.FRA.unemploymentPct);
  assert.ok(stressed.macroEconomies.FRA.fiscalBalancePctGdp < normal.macroEconomies.FRA.fiscalBalancePctGdp);
});

test('un choc énergétique renchérit l’énergie et frappe davantage les importateurs', () => {
  const initial = createFrance2000World();
  const normal = advanceWorld(structuredClone(initial), '2001-01-01').state;
  const shocked = advanceWorld(addEconomicShock(structuredClone(initial), {
    id: 'test-energy-shortage', label: 'Pénurie énergétique', channel: 'energy', intensity: 80,
    remainingMonths: 12, decayPerMonth: 0.025, affectedCountryIds: [], productFamily: 'energy', source: 'local_rule',
  }), '2001-01-01').state;
  assert.ok(shocked.worldEconomy.productMarkets.energy.priceIndex > normal.worldEconomy.productMarkets.energy.priceIndex + 15);
  const frenchLoss = normal.macroEconomies.FRA.realGrowthAnnualPct - shocked.macroEconomies.FRA.realGrowthAnnualPct;
  const norwegianLoss = normal.macroEconomies.NOR.realGrowthAnnualPct - shocked.macroEconomies.NOR.realGrowthAnnualPct;
  assert.ok(frenchLoss > norwegianLoss + 1);
  assert.ok(shocked.macroEconomies.USA.realGrowthAnnualPct < normal.macroEconomies.USA.realGrowthAnnualPct);
});

test('un choc national atteint ses partenaires selon les flux commerciaux', () => {
  const initial = createFrance2000World();
  const normal = advanceWorld(structuredClone(initial), '2001-01-01').state;
  const shocked = advanceWorld(addEconomicShock(structuredClone(initial), {
    id: 'test-us-demand', label: 'Récession américaine', channel: 'demand', intensity: 70,
    remainingMonths: 12, decayPerMonth: 0.025, affectedCountryIds: ['USA'], source: 'local_rule',
  }), '2001-01-01').state;
  const chineseLoss = normal.macroEconomies.CHN.realGrowthAnnualPct - shocked.macroEconomies.CHN.realGrowthAnnualPct;
  const frenchLoss = normal.macroEconomies.FRA.realGrowthAnnualPct - shocked.macroEconomies.FRA.realGrowthAnnualPct;
  assert.ok(chineseLoss > frenchLoss);
  assert.ok(shocked.worldEconomy.globalGrowthAnnualPct < normal.worldEconomy.globalGrowthAnnualPct);
});

test('la relance soutient l’activité mais détériore réellement la trajectoire de dette', () => {
  const initial = createFrance2000World();
  const expansion = setEconomicPolicy(structuredClone(initial), 'FRA', { fiscalStance: 65, publicInvestmentPctGdp: 7 });
  const austerity = setEconomicPolicy(structuredClone(initial), 'FRA', { fiscalStance: -65, publicInvestmentPctGdp: 2 });
  assert.equal(expansion.ok, true);
  assert.equal(austerity.ok, true);
  const expanded = advanceWorld(expansion.state, '2003-01-01').state.macroEconomies.FRA;
  const restricted = advanceWorld(austerity.state, '2003-01-01').state.macroEconomies.FRA;
  assert.ok(expanded.realGdpBillion2000Usd > restricted.realGdpBillion2000Usd);
  assert.ok(expanded.publicDebtPctGdp > restricted.publicDebtPctGdp + 5);
  assert.ok(expanded.capitalStockIndex > restricted.capitalStockIndex);
});

test('le modèle reste borné sur dix ans et laisse agir les tendances démographiques', () => {
  const initial = createFrance2000World();
  const advanced = advanceWorld(structuredClone(initial), '2010-01-01').state;
  for (const economy of Object.values(advanced.macroEconomies)) {
    assert.ok(Number.isFinite(economy.realGdpBillion2000Usd) && economy.realGdpBillion2000Usd > 0);
    assert.ok(economy.inflationAnnualPct >= -5 && economy.inflationAnnualPct <= 45);
    assert.ok(economy.unemploymentPct >= 1.5 && economy.unemploymentPct <= 45);
    assert.ok(economy.publicDebtPctGdp >= 0 && economy.publicDebtPctGdp <= 350);
  }
  assert.ok(advanced.macroEconomies.DEU.workingAgeSharePct < initial.macroEconomies.DEU.workingAgeSharePct);
  assert.ok(advanced.macroEconomies.CHN.capitalStockIndex > initial.macroEconomies.CHN.capitalStockIndex + 15);
});

test('une crise souveraine dépend du refinancement et non d’un seuil arbitraire de dette', () => {
  const initial = createFrance2000World();
  for (const countryId of ['USA', 'DZA']) {
    initial.macroEconomies[countryId].publicDebtPctGdp = 120;
    initial.macroEconomies[countryId].fiscalBalancePctGdp = -6;
  }
  const advanced = advanceWorld(initial, '2002-01-01').state;
  assert.equal(advanced.macroEconomies.USA.sovereignDebt.status, 'watch');
  assert.equal(advanced.macroEconomies.USA.sovereignDebt.fundingGapPctGdp, 0);
  assert.equal(advanced.macroEconomies.DZA.sovereignDebt.status, 'default');
  assert.ok(advanced.macroEconomies.DZA.sovereignDebt.fundingGapPctGdp > 10);
  assert.ok(advanced.macroEconomies.DZA.bankingSystem.liquidityStress > advanced.macroEconomies.USA.bankingSystem.liquidityStress);
  assert.ok(advanced.strategicDossiers['sovereign-debt-DZA']);
});

test('une restructuration réduit la dette mais transmet les pertes aux banques', () => {
  const initial = createFrance2000World();
  Object.assign(initial.macroEconomies.DZA, { publicDebtPctGdp: 120, fiscalBalancePctGdp: -8 });
  const crisis = advanceWorld(initial, '2002-01-01').state;
  const debtBefore = crisis.macroEconomies.DZA.publicDebtPctGdp;
  const bankStressBefore = crisis.macroEconomies.DZA.bankingSystem.liquidityStress;
  const response = applyDebtCrisisResponse(crisis, 'DZA', 'restructure');
  assert.equal(response.ok, true);
  assert.equal(response.state.macroEconomies.DZA.sovereignDebt.status, 'restructuring');
  assert.ok(response.state.macroEconomies.DZA.publicDebtPctGdp < debtBefore * 0.75);
  assert.ok(response.state.macroEconomies.DZA.bankingSystem.liquidityStress > bankStressBefore);
  assert.ok(response.state.strategicDossiers['sovereign-debt-DZA'].entries.some((entry) => entry.title === 'Réponse gouvernementale'));
});

test('le pouvoir peut refuser la meilleure action matérielle pour protéger le régime', () => {
  const state = createFrance2000World();
  const opening: StrategicActionCandidate = {
    id: 'china-open-politics', actorId: 'CHN', label: 'Libéralisation politique et économique', kind: 'political',
    outcomes: { growth: 82, employment: 45, strategic_autonomy: -15, social_cohesion: -20, regime_survival: -90, elite_support: -80 },
    signals: ['market_liberalization', 'political_opening', 'elite_displacement'],
    requiredAuthority: 'executive', publicSalience: 95, administrativeComplexity: 82, urgency: 35, risk: 72, resourceCost: 55,
  };
  const consolidation: StrategicActionCandidate = {
    id: 'china-consolidate', actorId: 'CHN', label: 'Consolider le contrôle du Parti-État', kind: 'political',
    outcomes: { growth: -22, employment: -8, strategic_autonomy: 28, social_cohesion: 18, regime_survival: 92, elite_support: 86 },
    signals: ['state_control'], requiredAuthority: 'executive', publicSalience: 45,
    administrativeComplexity: 30, urgency: 35, risk: 24, resourceCost: 22,
  };
  const openingEvaluation = evaluateStrategicAction(state, opening);
  const consolidationEvaluation = evaluateStrategicAction(state, consolidation);
  assert.ok(openingEvaluation.objectiveScore > consolidationEvaluation.objectiveScore);
  assert.equal(openingEvaluation.blocked, true);
  assert.equal(openingEvaluation.constraints.filter((item) => item.level === 'red_line').length, 2);
  assert.equal(selectStrategicAction(state, [opening, consolidation])?.candidate.id, consolidation.id);
});

test('un tabou peut céder à une urgence extrême tandis qu’une ligne rouge demeure', () => {
  const state = createFrance2000World();
  const germanStimulus = (urgency: number): StrategicActionCandidate => ({
    id: `deu-stimulus-${urgency}`, actorId: 'DEU', label: 'Relance financée par la dette', kind: 'economic',
    outcomes: { growth: 48, employment: 42, fiscal_sustainability: -38, social_cohesion: 24 },
    signals: ['deficit_spending'], requiredAuthority: 'executive', publicSalience: 60,
    administrativeComplexity: 35, urgency, risk: 32, resourceCost: 42,
  });
  const normal = evaluateStrategicAction(state, germanStimulus(40));
  const emergency = evaluateStrategicAction(state, germanStimulus(92));
  assert.equal(normal.constraints[0].overridden, false);
  assert.equal(emergency.constraints[0].overridden, true);
  assert.ok(emergency.constraints[0].appliedPenalty < normal.constraints[0].appliedPenalty);

  const russianDependence: StrategicActionCandidate = {
    id: 'pol-russian-dependence', actorId: 'POL', label: 'Dépendance énergétique russe', kind: 'energy',
    outcomes: { growth: 70, employment: 30, price_stability: 65, strategic_autonomy: -75 },
    signals: ['foreign_dependency', 'rival_dependency'], requiredAuthority: 'executive',
    publicSalience: 55, administrativeComplexity: 25, urgency: 99, risk: 40, resourceCost: 18,
  };
  assert.equal(evaluateStrategicAction(state, russianDependence).blocked, true);
});

test('l’autonomie économique obéit réellement aux lignes rouges du gouvernement', () => {
  const state = createFrance2000World();
  state.baselineEnergyFlows['pol-gas-rus'] = { ...state.baselineEnergyFlows['pol-gas-rus'], annualVolume: 0 };
  const reviewed = reviewCountryStrategy(state, 'POL');
  const contracts = Object.values(reviewed.energyContracts).filter((contract) => contract.buyerId === 'POL' && contract.status === 'active');
  assert.ok(contracts.length >= 1);
  assert.ok(contracts.every((contract) => contract.sellerId !== 'RUS'));
  assert.ok(reviewed.actions.some((action) => action.intent === 'Arbitrer l’approvisionnement en gas' && action.metadata?.evaluation));
});

test('le bilan structurel dérive ses diagnostics des données du monde', () => {
  const state = createFrance2000World();
  const france = deriveStructuralDiagnostics(state, 'FRA');
  const norway = deriveStructuralDiagnostics(state, 'NOR');

  assert.equal(Object.keys(state.structuralProfiles).length, 195);
  assert.ok(france.some((item) => item.id === 'energy-import-dependency'));
  assert.ok(france.some((item) => item.id === 'industrial-depth'));
  assert.ok(norway.some((item) => item.id === 'energy-export-capacity'));

  state.countryEnergy.FRA.domesticProduction = { ...state.countryEnergy.FRA.annualDemand };
  const energyIndependentFrance = deriveStructuralDiagnostics(state, 'FRA');
  assert.ok(!energyIndependentFrance.some((item) => item.id === 'energy-import-dependency'));
});

test('les mesures successives font émerger une défiance qualitative puis celle-ci s’use', () => {
  let state = createFrance2000World();
  assert.equal(Object.keys(state.stakeholderGroups).length, 780);
  assert.equal(visibleStakeholderReactions(state).length, 0);

  state = enactPrototypeGovernmentMeasure(state, 'labor_restrictions');
  let unionReaction = visibleStakeholderReactions(state).find((item) => item.groupId === 'FRA-organized-labor');
  assert.equal(unionReaction?.level, 'moderate');

  state = enactPrototypeGovernmentMeasure(state, 'labor_restrictions');
  unionReaction = visibleStakeholderReactions(state).find((item) => item.groupId === 'FRA-organized-labor');
  assert.equal(unionReaction?.level, 'important');
  assert.equal(unionReaction?.relatedMeasureIds.length, 2);

  state = enactPrototypeGovernmentMeasure(state, 'capital_controls');
  assert.ok(stakeholderPressureByChannel(state, 'FRA', 'economic_confidence') > 0);
  const beforeDecay = unionReaction!.defiance;
  state = advanceWorld(state, '2000-07-01').state;
  unionReaction = visibleStakeholderReactions(state).find((item) => item.groupId === 'FRA-organized-labor');
  assert.ok(unionReaction!.defiance < beforeDecay);
  assert.equal(unionReaction?.trend, 'falling');
});

test('une opposition systémique attend l’IA puis devient un acteur et un dossier persistants', () => {
  let state = createFrance2000World();
  const measure: GovernmentMeasure = {
    id: 'test-alliance-reform', countryId: 'FRA',
    title: 'Réorientation accélérée hors des structures intégrées de l’OTAN',
    subjectId: 'alliance-posture', intensity: 92,
    signals: [
      { signal: 'alliance_disengagement', weight: 1 },
      { signal: 'military_doctrine_break', weight: 0.5 },
    ],
    effects: [],
  };
  state = enactGovernmentMeasure(state, measure);
  state = advanceWorld(state, '2000-02-01').state;

  const [request] = pendingPowerStruggleAIRequests(state);
  assert.equal(request.kind, 'power_struggle');
  assert.equal(state.aiJobs[request.id].status, 'pending');
  assert.equal(request.context.stakeholderCategory, 'military');
  assert.equal(Object.keys(state.powerActors).length, 0);
  assert.equal(Object.keys(state.powerStruggleCampaigns).length, 0);

  const complianceBefore = state.countries.FRA.politics.administrativeCompliance;
  const generated = applyPowerStruggleAIProposal(state, request.id, {
    actor: {
      name: 'Général Antoine Delmas', role: 'military_officer',
      position: 'chef adjoint de l’état-major des armées',
      ideologyTags: ['atlantiste', 'interopérabilité occidentale'],
      personalityTags: ['légaliste', 'inflexible', 'prudent'],
      deepObjective: 'Préserver l’ancrage occidental des forces françaises',
      immediateObjective: 'Obtenir un moratoire de six mois sur la réforme',
      influence: 72, legitimacy: 67, loyaltyToRegime: 91,
      loyaltyToGovernment: 31, riskTolerance: 36, initialVisibility: 'suspected',
    },
    strategy: 'Fédérer confidentiellement les officiers favorables à l’interopérabilité avant toute prise de parole.',
    immediateObjective: 'Obtenir un moratoire de six mois sur la réforme',
    acceptableCompromise: 'Une autonomie politique assortie du maintien des coopérations opérationnelles',
    personalRedLine: 'Ne pas préparer d’action extraconstitutionnelle',
    currentTactic: 'private_lobbying',
    publicMove: 'Des réserves convergentes circulent au sein de l’état-major.',
    reassessmentTriggers: ['player_response', 'pressure_shift', 'deadline'],
    reviewAfterMonths: 2,
  });
  assert.equal(generated.ok, true);
  if (!generated.ok) return;
  state = generated.state;
  const actor = Object.values(state.powerActors)[0];
  const campaign = Object.values(state.powerStruggleCampaigns)[0];
  assert.equal(actor.fictionalAlternateHistory, true);
  assert.equal(campaign.aiPlan.currentTactic, 'private_lobbying');
  assert.ok(state.countries.FRA.politics.administrativeCompliance < complianceBefore);
  assert.equal(state.strategicDossiers[campaign.dossierId].kind, 'power_struggle');

  const answered = submitPowerStrugglePlayerResponse(
    state, campaign.id,
    'Le gouvernement accepte une consultation technique, mais refuse de suspendre la réforme.',
  );
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const responseRequest = pendingPowerStruggleAIRequests(answered.state)[0];
  assert.equal(responseRequest.purpose, 'react_to_player');
  assert.ok(responseRequest.context.playerResponse?.includes('consultation technique'));
});

test('les tensions émergentes sont plafonnées par passage pour préserver le budget IA', () => {
  let state = createFrance2000World();
  const measure: GovernmentMeasure = {
    id: 'test-capacity-reform', countryId: 'FRA', title: 'Réorganisation administrative brutale', subjectId: 'admin-reform', intensity: 95,
    signals: [{ signal: 'administrative_reorganization', weight: 1 }], effects: [],
  };
  state = enactGovernmentMeasure(state, measure);
  const reactions = Object.values(state.stakeholderReactions).filter((reaction) => reaction.countryId === 'FRA');
  const duplicated = reactions.slice(0, 6).reduce((all, reaction, index) => ({
    ...all,
    [`synthetic-${index}`]: { ...reaction, id: `synthetic-${index}`, level: 'critical' as const, defiance: 100, mobilization: 100 },
  }), {} as typeof state.stakeholderReactions);
  state = { ...state, stakeholderReactions: { ...state.stakeholderReactions, ...duplicated } };
  const detected = detectPowerStruggleOpportunities(state);
  const pending = Object.values(detected.aiJobs).filter((job) => job.kind === 'power_struggle' && job.purpose === 'materialize_actor' && job.status === 'pending');
  assert.ok(pending.length <= 3);
});

test('un dialogue libre attend une première réponse IA puis réserve Luna aux tours confirmés', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU', 'ITA'], 'Nous proposons une coordination industrielle avant le prochain Conseil européen.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const first = opened.state.diplomaticDialogues[opened.dialogueId];
  assert.equal(first.kind, 'multilateral_dialogue');
  assert.equal(first.status, 'awaiting_ai');
  assert.equal(first.turns.length, 1);

  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  assert.equal(queued.state.diplomaticDialogues[opened.dialogueId].aiMode, 'ai');
  assert.equal(queued.state.aiJobs[queued.jobId].kind, 'diplomacy');

  const applied = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Position prudente', assessment: 'Une réponse conditionnelle est envisageable.',
    publicMessage: 'Nous pouvons examiner cette piste si les garanties sont écrites.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, {
    scope: 'general_dialogue', kind: 'counter',
    agreementType: 'political_guarantee',
    position: 'Nous sommes disposés à avancer, mais pas sans garanties politiques explicites.',
    concessions: ['Coordination industrielle limitée'],
    guaranteesRequested: ['Consultation préalable avant toute annonce publique'],
    conditions: ['Validation par nos parlements respectifs'],
    redLines: ['Aucune mutualisation budgétaire permanente'],
    timeline: 'Évaluer la proposition avant le prochain Conseil européen.',
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const finalDialogue = applied.state.diplomaticDialogues[opened.dialogueId];
  assert.equal(finalDialogue.status, 'awaiting_player');
  assert.equal(finalDialogue.turns.length, 2);
  assert.equal(finalDialogue.lastResponse?.kind, 'counter');
  assert.match(finalDialogue.lastResponse?.position ?? '', /garanties politiques/);
  assert.equal(applied.state.aiJobs[queued.jobId].status, 'resolved');

  const accepted = resolveDiplomaticDialogueResponse(applied.state, opened.dialogueId, 'accept');
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.state.diplomaticDialogues[opened.dialogueId].status, 'closed');
  assert.equal(accepted.state.diplomaticDialogues[opened.dialogueId].resolution?.status, 'accepted_conditionally');
  const acceptedTreaty = Object.values(accepted.state.treaties).find((treaty) => treaty.id.startsWith(`dialogue-commitment-${opened.dialogueId}`));
  assert.equal(acceptedTreaty, undefined);
  const formalisation = accepted.state.strategicDossiers[`diplomatic-dialogue-${opened.dialogueId}`];
  assert.equal(formalisation?.phase, 'Formalisation requise');
  assert.ok(formalisation?.commitments.some((commitment) => commitment.startsWith('Intention à formaliser')));
});

test('un groupe diplomatique peut accueillir un pays et faire tourner la parole sans appel implicite', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU'], 'Nous proposons une consultation trilatérale sur la sécurité énergétique.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const added = addDiplomaticDialogueParticipant(opened.state, opened.dialogueId, 'ITA');
  assert.equal(added.ok, true);
  if (!added.ok) return;
  const grouped = added.state.diplomaticDialogues[opened.dialogueId];
  assert.equal(grouped.kind, 'multilateral_dialogue');
  assert.deepEqual(grouped.participantIds, ['FRA', 'DEU', 'ITA']);

  const firstSpeaker = grouped.activeSpeakerId;
  const firstRequest = requestDiplomaticDialogueAI(added.state, opened.dialogueId);
  assert.equal(firstRequest.ok, true);
  if (!firstRequest.ok) return;
  const firstAnswer = applyDiplomaticDialogueAIAnswer(firstRequest.state, firstRequest.jobId, {
    headline: 'Consultation prudente', assessment: 'Le groupe peut avancer sur des garanties communes.',
    publicMessage: 'Nous sommes prêts à examiner cette proposition avec les autres participants.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'security_cooperation',
    position: 'Nous demandons des garanties communes et une consultation préalable.', concessions: ['Partager les informations de risque énergétique'],
    guaranteesRequested: ['Consultation préalable'], conditions: ['Validation gouvernementale'], redLines: ['Aucune obligation automatique de soutien'], timeline: 'Revue sous trois mois.',
  });
  assert.equal(firstAnswer.ok, true);
  if (!firstAnswer.ok) return;
  const afterFirst = firstAnswer.state.diplomaticDialogues[opened.dialogueId];
  assert.notEqual(afterFirst.activeSpeakerId, firstSpeaker);
  assert.ok(afterFirst.participantIds.includes(afterFirst.activeSpeakerId));
  assert.equal(afterFirst.status, 'awaiting_player');

  const sent = sendDiplomaticDialogueMessage(firstAnswer.state, opened.dialogueId, 'Nous acceptons de préciser les garanties et souhaitons entendre le troisième participant.');
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  assert.equal(sent.state.diplomaticDialogues[opened.dialogueId].status, 'awaiting_ai');
  assert.equal(sent.state.diplomaticDialogues[opened.dialogueId].activeSpeakerId, 'ITA');
  assert.equal(sent.state.diplomaticDialogues[opened.dialogueId].aiMode, 'local');
  const secondRequest = requestDiplomaticDialogueAI(sent.state, opened.dialogueId);
  assert.equal(secondRequest.ok, true);
  if (!secondRequest.ok) return;
  assert.equal(secondRequest.state.diplomaticDialogues[opened.dialogueId].aiMode, 'ai');
  const recentTurns = (secondRequest.state.aiJobs[secondRequest.jobId].context as Record<string, unknown>).recentTurns as unknown[];
  assert.equal(recentTurns.length, 3);
  assert.equal(queryForAIJob(secondRequest.state, secondRequest.state.aiJobs[secondRequest.jobId]).tokenBudget, 7_500);
});

test('la synthèse et la rencontre restent séparées du contrat et sont persistantes', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU'], 'Nous proposons une coopération industrielle progressive avec des garanties politiques.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Position conditionnelle', assessment: 'Une réunion peut débloquer le calendrier.',
    publicMessage: 'Nous pouvons avancer si le calendrier et les garanties sont précisés.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 160,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'industrial_cooperation',
    position: 'Nous sommes prêts à négocier une coopération industrielle, sous garanties.',
    concessions: ['Partager certaines formations'], guaranteesRequested: ['Consultation préalable'],
    conditions: ['Validation parlementaire'], redLines: ['Aucune obligation automatique'], timeline: 'Réunion sous trois mois.',
  });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;

  const acceptedBase = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(acceptedBase.ok, true);
  if (!acceptedBase.ok) return;
  assert.equal(acceptedBase.state.diplomaticDialogues[opened.dialogueId].resolution?.status, 'accepted_conditionally');

  const brief = diplomaticBriefFromDialogue(acceptedBase.state, opened.dialogueId);
  assert.equal(brief.ok, true);
  if (!brief.ok) return;
  assert.equal(brief.brief.source, 'local');
  assert.ok(brief.brief.openPoints.some((point) => point.includes('Validation parlementaire')));
  assert.equal(brief.state.diplomaticDialogues[opened.dialogueId].briefIds?.length, 1);

  const beforeTreaties = Object.keys(brief.state.treaties).length;
  const meeting = proposeDiplomaticMeeting(brief.state, opened.dialogueId, 'official');
  assert.equal(meeting.ok, true);
  if (!meeting.ok) return;
  const meetingId = meeting.meetingId;
  const draftId = meeting.draftId;
  assert.equal(typeof meetingId, 'string');
  assert.equal(typeof draftId, 'string');
  if (typeof meetingId !== 'string' || typeof draftId !== 'string') return;
  assert.equal(Object.keys(meeting.state.treaties).length, beforeTreaties);
  assert.equal(meeting.state.diplomaticMeetings[meetingId].status, 'scheduled');
  assert.equal(meeting.state.diplomaticAgreementDrafts[draftId].stage, 'final_proposal');
  assert.equal(meeting.state.diplomaticAgreementDrafts[draftId].domain, 'industrial');
  assert.equal(meeting.state.diplomaticMeetings[meetingId].scheduledAt, '2000-02-01');

  const revised = reviseDiplomaticAgreementDraft(meeting.state, draftId, { terms: { calendrier: 'Phase pilote après validation parlementaire.' } });
  assert.equal(revised.ok, true);
  if (!revised.ok) return;
  assert.equal(revised.state.diplomaticAgreementDrafts[draftId].terms.calendrier, 'Phase pilote après validation parlementaire.');
  const blockedByOpenTerms = signDiplomaticAgreementDraft(revised.state, draftId);
  assert.equal(blockedByOpenTerms.ok, false);
  const cleared = reviseDiplomaticAgreementDraft(revised.state, draftId, { unresolvedConditions: [] });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  const blockedByDate = signDiplomaticAgreementDraft(cleared.state, draftId);
  assert.equal(blockedByDate.ok, false);
  const atMeetingDate = advanceWorld(cleared.state, '2000-02-01').state;
  const blockedByCounterpart = signDiplomaticAgreementDraft(atMeetingDate, draftId);
  assert.equal(blockedByCounterpart.ok, false);
  if (blockedByCounterpart.ok) return;
  assert.match(blockedByCounterpart.error, /participants/i);
  const meetingAI = requestDiplomaticMeetingAI(atMeetingDate, draftId);
  assert.equal(meetingAI.ok, true);
  if (!meetingAI.ok) return;
  const meetingAnswered = applyDiplomaticMeetingAIAnswer(meetingAI.state, meetingAI.jobId, {
    headline: 'Accord accepté', assessment: 'Les participants valident le projet.',
    publicMessage: 'Nous acceptons le projet final et sommes prêts à le signer.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 220,
  }, {
    scope: 'general_dialogue', kind: 'accept', agreementType: 'industrial_cooperation',
    position: 'Le projet final est accepté.', concessions: [], guaranteesRequested: [], conditions: [], redLines: [], timeline: 'Mise en œuvre progressive.',
  });
  assert.equal(meetingAnswered.ok, true);
  if (!meetingAnswered.ok) return;
  assert.equal(meetingAnswered.state.diplomaticAgreementDrafts[draftId].counterpartDecision, 'accepted');
  assert.equal(meetingAnswered.state.diplomaticMeetings[meetingId].counterpartDecision, 'accepted');
  assert.equal(meetingAnswered.state.aiJobs[meetingAI.jobId].status, 'resolved');
  const signed = signDiplomaticAgreementDraft(meetingAnswered.state, draftId);
  assert.equal(signed.ok, true, signed.ok ? undefined : signed.error);
  if (!signed.ok) return;
  assert.equal(signed.state.diplomaticAgreementDrafts[draftId].stage, 'signed');
  assert.equal(signed.state.diplomaticMeetings[meetingId].status, 'completed');
  assert.equal(signed.state.diplomaticDialogues[opened.dialogueId].resolution?.status, 'accepted');
  assert.equal(signed.state.treaties[signed.treatyId]?.status, 'active');
  assert.ok(signed.state.strategicDossiers[`diplomatic-dialogue-${opened.dialogueId}`]?.entries.some((entry) => entry.title === 'Accord diplomatique signé'));
  const restored = deserializeWorld(serializeWorld(revised.state));
  assert.deepEqual(restored.diplomaticBriefs, revised.state.diplomaticBriefs);
  assert.deepEqual(restored.diplomaticMeetings, revised.state.diplomaticMeetings);
  assert.deepEqual(restored.diplomaticAgreementDrafts, revised.state.diplomaticAgreementDrafts);
});

test('la réponse de rencontre peut contre-proposer ou refuser sans engagement implicite', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['GRC'], 'Proposons une coopération maritime avec garanties réciproques.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Ouverture', assessment: 'Une rencontre est utile.', publicMessage: 'Nous sommes prêts à examiner votre proposition.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'security_cooperation', position: 'Nous demandons des garanties réciproques.', concessions: [], guaranteesRequested: ['Consultations régulières'], conditions: ['Pas de déploiement unilatéral'], redLines: ['Respect des zones maritimes'], timeline: 'Réexamen sous six mois.',
  });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const acceptedBase = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(acceptedBase.ok, true);
  if (!acceptedBase.ok) return;
  const meeting = proposeDiplomaticMeeting(acceptedBase.state, opened.dialogueId, 'discreet');
  assert.equal(meeting.ok, true);
  if (!meeting.ok) return;
  const draftId = meeting.draftId;
  const meetingId = meeting.meetingId;
  if (typeof draftId !== 'string' || typeof meetingId !== 'string') return;
  const meetingAI = requestDiplomaticMeetingAI(meeting.state, draftId);
  assert.equal(meetingAI.ok, true);
  if (!meetingAI.ok) return;
  const countered = applyDiplomaticMeetingAIAnswer(meetingAI.state, meetingAI.jobId, {
    headline: 'Contre-proposition', assessment: 'Athènes demande une garantie supplémentaire.', publicMessage: 'Nous acceptons le principe mais demandons une clause de consultation préalable.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 140,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'security_cooperation', position: 'Accord possible avec consultation préalable.', concessions: [], guaranteesRequested: ['Consultation préalable'], conditions: ['Validation par nos autorités'], redLines: [], timeline: 'Revue annuelle.',
  });
  assert.equal(countered.ok, true);
  if (!countered.ok) return;
  assert.equal(countered.state.diplomaticAgreementDrafts[draftId].counterpartDecision, 'countered');
  assert.ok(countered.state.diplomaticAgreementDrafts[draftId].unresolvedConditions.length > 0);
  const cleared = reviseDiplomaticAgreementDraft(countered.state, draftId, { unresolvedConditions: [] });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  const blocked = signDiplomaticAgreementDraft(cleared.state, draftId);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error, /participants/i);
  const refusalJob = requestDiplomaticMeetingAI(cleared.state, draftId);
  assert.equal(refusalJob.ok, true);
  if (!refusalJob.ok) return;
  const refused = applyDiplomaticMeetingAIAnswer(refusalJob.state, refusalJob.jobId, {
    headline: 'Refus', assessment: 'La garantie ne peut pas être acceptée.', publicMessage: 'Nous refusons le projet dans sa forme actuelle.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 110,
  }, {
    scope: 'general_dialogue', kind: 'refuse', agreementType: 'security_cooperation', position: 'Le projet est refusé.', concessions: [], guaranteesRequested: [], conditions: [], redLines: [], timeline: 'Aucune échéance.',
  });
  assert.equal(refused.ok, true);
  if (!refused.ok) return;
  assert.equal(refused.state.diplomaticAgreementDrafts[draftId].stage, 'rejected');
  assert.equal(refused.state.diplomaticMeetings[meetingId].status, 'completed');
  assert.equal(Object.values(refused.state.treaties).filter((treaty) => treaty.status === 'active').length, 0);
});

test('une position stratégique sans accord formel devient un dossier modéré non majeur', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['TUR', 'GRC'], 'Explorons un partage des hydrocarbures en mer Égée sans préjuger des souverainetés.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Lignes rouges concurrentes', assessment: 'Les deux gouvernements souhaitent poursuivre les échanges mais refusent de renoncer à leurs revendications.',
    publicMessage: 'Nous pouvons poursuivre les discussions, mais les zones disputées et les garanties de souveraineté restent non négociables.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 220,
  }, {
    scope: 'general_dialogue', kind: 'counter', agreementType: 'energy_cooperation',
    position: 'Poursuivre l’exploration sous garanties, sans reconnaître la souveraineté adverse.', concessions: [], guaranteesRequested: ['Mécanisme de déconfliction'], conditions: ['Accord séparé sur les zones disputées'], redLines: ['Aucune reconnaissance de souveraineté', 'Aucun forage unilatéral'], timeline: 'Revue avant la prochaine saison de forage.',
  });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const acknowledged = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'acknowledge');
  assert.equal(acknowledged.ok, true);
  if (!acknowledged.ok) return;
  const dossier = Object.values(acknowledged.state.strategicDossiers).find((item) => item.id === `diplomatic-dialogue-${opened.dialogueId}`);
  assert.equal(dossier?.importance, 'moderate');
  assert.equal(dossier?.autoTracked, false);
  assert.match(dossier?.phase ?? '', /suspens/i);
  assert.ok(dossier?.entries.some((entry) => entry.title.includes('sans accord formel')));
});

test('un accord formel suit une mise en œuvre et touche un registre existant', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU'], 'Mettons en place une coopération industrielle sur les machines-outils.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const queued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const answered = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Accord industriel', assessment: 'L’Allemagne accepte un programme de coopération industrielle progressif.',
    publicMessage: 'Nous acceptons un programme industriel progressif avec un transfert de compétences encadré.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 180,
  }, {
    scope: 'general_dialogue', kind: 'accept', agreementType: 'industrial_cooperation',
    position: 'Coopération industrielle acceptée sous réserve de validation administrative.', concessions: ['Partager certaines formations'], guaranteesRequested: [], conditions: [], redLines: [], timeline: 'Premiers résultats sous douze mois.',
  });
  assert.equal(answered.ok, true);
  if (!answered.ok) return;
  const accepted = resolveDiplomaticDialogueResponse(answered.state, opened.dialogueId, 'accept');
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const treaty = Object.values(accepted.state.treaties).find((item) => item.parties.includes('DEU') && item.implementation?.kind === 'industrial_transfer');
  assert.ok(treaty?.implementation);
  if (!treaty?.implementation) return;
  assert.ok(treaty.implementation.sectorIds.length > 0);
  const advanced = advanceWorld(accepted.state, '2001-01-01').state;
  const implementation = advanced.treaties[treaty.id].implementation;
  assert.ok((implementation?.progressPct ?? 0) >= 35 && (implementation?.progressPct ?? 0) <= 38);
  assert.equal(implementation?.phase, 'pilot');
  assert.ok(advanced.strategicDossiers[implementation!.dossierId!]?.entries.some((entry) => entry.title.includes('25%')));
});

test('un message d’un dialogue lié est visible dans la chronologie du dossier', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU'], 'Ouvrons une consultation sur un calendrier en deux étapes avec garanties industrielles.', 'current-lisbon-convergence');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const dossier = opened.state.strategicDossiers['current-lisbon-convergence'];
  assert.ok(dossier.entries.some((entry) => entry.title === 'Message du gouvernement'));
  assert.ok(dossier.entries.some((entry) => entry.summary.includes('calendrier en deux étapes')));
});

test('le conseiller transmet les derniers échanges quand la question vise leur dossier', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU'], 'Ouvrons une consultation sur la Stratégie économique européenne.', 'current-lisbon-convergence');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const question = 'Quelles options pour la Stratégie économique européenne avec l’Allemagne ?';
  const local = answerAdvisorQuestion(opened.state, question);
  const request = createAdvisorAIRequest(opened.state, question, local, 'test-dialogue-context');
  assert.ok(request.context.facts.some((fact) => fact.id.startsWith('dialogue-dialogue-')));
  assert.ok(request.context.facts.some((fact) => fact.value.includes('consultation')));
});

test('un scope énergétique mal renvoyé dans un dialogue libre reste résoluble', () => {
  const initial = createFrance2000World();
  const opened = openDiplomaticDialogue(initial, ['DEU'], 'Ouvrons une coopération industrielle et énergétique.');
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const firstQueued = requestDiplomaticDialogueAI(opened.state, opened.dialogueId);
  assert.equal(firstQueued.ok, true);
  if (!firstQueued.ok) return;
  const firstApplied = applyDiplomaticDialogueAIAnswer(firstQueued.state, firstQueued.jobId, {
    headline: 'Précisions', assessment: 'Une première réponse est nécessaire.', publicMessage: 'Nous avons bien reçu votre ouverture et attendons vos garanties.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  });
  assert.equal(firstApplied.ok, true);
  if (!firstApplied.ok) return;
  const sent = sendDiplomaticDialogueMessage(firstApplied.state, opened.dialogueId, 'Nous proposons une première phase de garanties.');
  assert.equal(sent.ok, true);
  if (!sent.ok) return;
  const queued = requestDiplomaticDialogueAI(sent.state, opened.dialogueId);
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const duplicate = requestDiplomaticDialogueAI(queued.state, opened.dialogueId);
  assert.equal(duplicate.ok, false);
  const applied = applyDiplomaticDialogueAIAnswer(queued.state, queued.jobId, {
    headline: 'Contre-proposition', assessment: 'Une négociation progressive est possible.',
    publicMessage: 'Nous pouvons avancer avec une coopération industrielle progressive.', proposals: [], requestedFacts: [], contextFactIds: [], approximateInputTokens: 120,
  }, {
    scope: 'energy_contract', kind: 'counter', annualVolume: null, durationYears: 10, pricePosture: null, clauses: ['technology_cooperation'],
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const dialogue = applied.state.diplomaticDialogues[opened.dialogueId];
  assert.equal(dialogue.lastResponse?.kind, 'counter');
  assert.equal(dialogue.lastResponse?.agreementType, 'energy_cooperation');
  assert.match(dialogue.lastResponse?.position ?? '', /coopération industrielle progressive/);
  assert.equal(dialogue.status, 'awaiting_player');
  const resolved = resolveDiplomaticDialogueResponse(applied.state, opened.dialogueId, 'accept');
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.state.diplomaticDialogues[opened.dialogueId].resolution?.status, 'accepted_conditionally');
  const treaty = Object.values(resolved.state.treaties).find((item) => item.id.startsWith(`dialogue-commitment-${opened.dialogueId}`));
  assert.equal(treaty, undefined);
  const formalisation = resolved.state.strategicDossiers[`diplomatic-dialogue-${opened.dialogueId}`];
  assert.equal(formalisation?.phase, 'Formalisation requise');
  assert.ok(formalisation?.commitments.some((commitment) => commitment.startsWith('Intention à formaliser')));
});

test('le dossier militaire décompose un théâtre large par pays sans changer le total', () => {
  const sheet = countrySheet(createFrance2000World(), 'FRA');
  const africa = sheet?.defense?.deployments?.find((deployment) => deployment.location === 'Afrique');
  assert.equal(africa?.personnelThousands, 18);
  assert.equal(africa?.countryBreakdown?.reduce((total, item) => total + item.personnelThousands, 0), 18);
  assert.deepEqual(africa?.countryBreakdown?.map((item) => item.countryId), ['CIV', 'DJI', 'SEN', 'GAB', 'TCD', 'CMR']);
});

test('le registre militaire refuse une ventilation qui dépasse son théâtre', () => {
  const state = createFrance2000World();
  const invalid = structuredClone(defenseReferences2000ForValidation);
  invalid.FRA.deployments![2].countryBreakdown![0].personnelThousands = 19;
  const issues = validateCountryRegistry(state.countries, state.macroEconomies, { defenseReferences: invalid });
  assert.ok(issues.some((issue) => issue.severity === 'error' && issue.field?.includes('countryBreakdown')));
});

test('les principales puissances disposent d’un déploiement régional total cohérent', () => {
  const state = createFrance2000World();
  for (const countryId of ['DEU', 'ITA', 'POL', 'GBR', 'USA', 'RUS', 'CHN', 'DZA', 'IND', 'JPN', 'TUR']) {
    const defense = countrySheet(state, countryId)?.defense;
    assert.ok(defense?.deployments?.length, `${countryId} doit exposer ses théâtres principaux`);
    const total = defense!.deployments!.reduce((sum, deployment) => sum + deployment.personnelThousands, 0);
    assert.equal(total, defense!.activePersonnelThousands, `${countryId} : déploiements et effectifs doivent coïncider`);
  }
});

test('un renforcement de théâtre réserve puis transfère les personnels sans créer de troupes', () => {
  const initial = createFrance2000World();
  const theaters = militaryTheatersForCountry(initial, 'FRA');
  const africa = theaters.find((theater) => theater.location === 'Afrique');
  const reserve = theaters.find((theater) => theater.status === 'reserve');
  assert.ok(africa && reserve);
  if (!africa || !reserve) return;
  const totalBefore = theaters.reduce((sum, theater) => sum + theater.personnelThousands, 0);
  const prepared = prepareMilitaryTheaterAction(initial, africa.id, 'reinforce', 5);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(initial, { ...prepared.action, successProbability: 100 });
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  assert.equal(launched.state.militaryTheaters[africa.id].inTransitPersonnelThousands, 5);
  assert.equal(launched.state.militaryTheaters[reserve.id].availablePersonnelThousands, reserve.availablePersonnelThousands - 5);
  const resolved = advanceCommonActionPrograms(launched.state, 3);
  const after = militaryTheatersForCountry(resolved, 'FRA');
  assert.equal(after.find((theater) => theater.id === africa.id)?.currentOperation, undefined);
  assert.equal(after.reduce((sum, theater) => sum + theater.personnelThousands, 0), totalBefore);
  assert.equal(after.find((theater) => theater.id === africa.id)?.personnelThousands, africa.personnelThousands + 5);
});

test('un redéploiement de théâtre conserve les effectifs et bloque les opérations concurrentes', () => {
  const initial = createFrance2000World();
  const theaters = militaryTheatersForCountry(initial, 'FRA');
  const africa = theaters.find((theater) => theater.location === 'Afrique');
  const balkans = theaters.find((theater) => theater.location === 'Balkans');
  assert.ok(africa && balkans);
  if (!africa || !balkans) return;
  const prepared = prepareMilitaryTheaterAction(initial, africa.id, 'redeploy', 5, balkans.id);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const launched = launchCommonAction(initial, { ...prepared.action, successProbability: 100 });
  assert.equal(launched.ok, true);
  if (!launched.ok) return;
  const duplicate = prepareMilitaryTheaterAction(launched.state, africa.id, 'withdraw', 5);
  assert.equal(duplicate.ok, false);
  const resolved = advanceCommonActionPrograms(launched.state, 2);
  assert.equal(resolved.militaryTheaters[africa.id].personnelThousands, africa.personnelThousands - 5);
  assert.equal(resolved.militaryTheaters[balkans.id].personnelThousands, balkans.personnelThousands + 5);
});

test('les implantations extérieures majeures sont distinguées des simples théâtres', () => {
  const state = createFrance2000World();
  const bases = militaryBasesForCountry(state, 'FRA');
  assert.equal(bases.length, 3);
  const djibouti = bases.find((base) => base.hostCountryId === 'DJI');
  assert.ok(djibouti);
  assert.equal(djibouti?.access, 'host_consent');
  const africa = militaryTheatersForCountry(state, 'FRA').find((theater) => theater.location === 'Afrique');
  assert.ok(africa?.baseIds?.includes(djibouti!.id));
});

test('les relations et accords recalculent l’accès d’une base, et un refus bloque un renforcement', () => {
  const initial = createFrance2000World();
  const djibouti = militaryBasesForCountry(initial, 'FRA').find((base) => base.hostCountryId === 'DJI');
  const africa = militaryTheatersForCountry(initial, 'FRA').find((theater) => theater.location === 'Afrique');
  assert.ok(djibouti && africa);
  if (!djibouti || !africa) return;
  const withAgreement = structuredClone(initial);
  withAgreement.relations['FRA:DJI'] = { from: 'FRA', to: 'DJI', relation: 82, trust: 76, tradeIntensity: 10, securityAlignment: 75, memories: [] };
  withAgreement.treaties['fra-dji-defense'] = { id: 'fra-dji-defense', parties: ['FRA', 'DJI'], label: 'Accord de défense et de stationnement', status: 'active', monthlyEffects: [] };
  const allied = advanceMilitaryTheaterAccess(withAgreement);
  assert.equal(allied.militaryBases[djibouti.id].access, 'allied');
  const lowAccess = structuredClone(initial);
  lowAccess.relations['FRA:DJI'] = { from: 'FRA', to: 'DJI', relation: 8, trust: 12, tradeIntensity: 0, securityAlignment: 0, memories: [] };
  const downgraded = advanceMilitaryTheaterAccess(lowAccess);
  assert.equal(downgraded.militaryBases[djibouti.id].access, 'denied');
  assert.ok(downgraded.strategicDossiers['military-access-base-FRA-DJI']);
  const deniedState = {
    ...initial,
    militaryTheaters: { ...initial.militaryTheaters, [africa.id]: { ...africa, access: 'denied' as const } },
  };
  const blocked = prepareMilitaryTheaterAction(deniedState, africa.id, 'reinforce', 5);
  assert.equal(blocked.ok, false);
});

test('un programme autonome diplomatique ne peut pas cibler son propre État', () => {
  const initial = createFrance2000World();
  const request = createWorldPulseRequest(initial, initial.actions.length, 1, 'test-self-target');
  const autonomy = request.pulses.find((candidate) => candidate.kind === 'world_autonomy')!;
  const fact = autonomy.context.facts[0];
  const applied = applyWorldPulseAnswer(initial, autonomy, {
    headline: 'Test de cohérence', synthesis: 'Une proposition autonome est contrôlée avant mise en file.', requestedFactIds: [],
    proposals: [{
      dossierId: null, title: 'Crise interne de test', kind: 'economic', importance: 'moderate', actorIds: ['DEU'], regionTags: ['Europe'],
      phase: 'Surveillance', trend: 'stable', summary: 'Le gouvernement allemand étudie une réponse interne.', requiresPlayerDecision: false, playerDecision: null,
      factIds: [fact.id], relationEffects: [], autonomousAction: { actorId: 'DEU', targetIds: ['DEU'], category: 'diplomacy', operation: 'contact', objective: 'Ouvrir un canal interne de test.', },
    }],
  });
  assert.equal(applied.queuedAutonomousPrograms, 0);
});

test('un programme autonome conserve le dossier qui l’a déclenché', () => {
  const initial = createFrance2000World();
  const request = createWorldPulseRequest(initial, initial.actions.length, 1, 'test-linked-program');
  const autonomy = request.pulses.find((candidate) => candidate.kind === 'world_autonomy')!;
  const fact = autonomy.context.facts.find((candidate) => candidate.id === 'dossier:current-dotcom-exuberance');
  assert.ok(fact);
  if (!fact) return;
  const applied = applyWorldPulseAnswer(initial, autonomy, {
    headline: 'Programme lié', synthesis: 'Une initiative étrangère est rattachée au dossier suivi.', requestedFactIds: [],
    proposals: [{
      dossierId: 'current-dotcom-exuberance', title: 'Coordination transatlantique', kind: 'economic', importance: 'major',
      actorIds: ['USA', 'FRA'], regionTags: ['Atlantique'], phase: 'Consultations', trend: 'stable',
      summary: 'Washington ouvre des consultations avec Paris sur la correction technologique.', requiresPlayerDecision: false, playerDecision: null,
      factIds: [fact.id], relationEffects: [], autonomousAction: { actorId: 'USA', targetIds: ['FRA'], category: 'diplomacy', operation: 'contact', objective: 'Ouvrir des consultations techniques avec la France.', },
    }],
  });
  assert.equal(applied.queuedAutonomousPrograms, 1);
  const program = Object.values(applied.state.actionPrograms).find((item) => item.actorId === 'USA');
  assert.equal(program?.linkedDossierId, 'current-dotcom-exuberance');
  if (!program) return;
  const resolved = advanceWorld(applied.state, '2000-04-01').state;
  assert.ok(resolved.actionPrograms[program.id]?.resolution);
  const dossier = resolved.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(dossier.entries.some((entry) => entry.id === `${program.id}-resolution`));
  const needsFollowUp = resolved.actionPrograms[program.id]?.status !== 'succeeded';
  assert.equal(
    dossier.pendingDecisions.some((decision) => decision.includes('résolution du programme autonome')),
    needsFollowUp,
  );
});

test('un même dossier majeur calme bénéficie d’un délai entre deux réévaluations', () => {
  const initial = createFrance2000World();
  const dotcom = initial.strategicDossiers['current-dotcom-exuberance'];
  assert.ok(dotcom);
  if (!dotcom) return;
  const reviewed = { ...initial, currentDate: '2000-01-01' as const, strategicDossiers: {
    ...initial.strategicDossiers,
    [dotcom.id]: { ...dotcom, lastAutonomousReviewAt: '2000-01-01' as const, lastAutonomousReviewActionCount: initial.actions.length, pendingDecisions: [] },
  } };
  const nextMonth = { ...reviewed, currentDate: '2000-02-01' as const };
  assert.equal(rankStrategicDossierReviews(nextMonth).some((review) => review.dossierId === dotcom.id), false);
  const afterCooldown = { ...reviewed, currentDate: '2000-03-01' as const };
  assert.equal(rankStrategicDossierReviews(afterCooldown).some((review) => review.dossierId === dotcom.id), false);
});

test('un dossier de conflit actif crée une zone de guerre et transmet un choc temporaire', () => {
  const initial = createFrance2000World();
  const template = Object.values(initial.strategicDossiers)[0];
  assert.ok(template);
  if (!template) return;
  const dossier = {
    ...structuredClone(template),
    id: 'fixture-war-zone', title: 'Crise frontalière franco-allemande', kind: 'conflict' as const,
    status: 'active' as const, importance: 'major' as const, actorIds: ['FRA', 'DEU'],
    regionTags: ['Europe'], phase: 'Front contesté', trend: 'escalating' as const,
    publicSummary: 'Un affrontement régional menace les échanges et la sécurité.',
    startedAt: '2000-01-01' as const, updatedAt: '2000-01-01' as const,
    pendingDecisions: [], commitments: [], entries: [], relatedCurrentIds: [], relatedActionIds: [],
  };
  const conflictState = { ...initial, strategicDossiers: { ...initial.strategicDossiers, [dossier.id]: dossier } };
  const baselineGrowth = conflictState.macroEconomies.FRA.realGrowthAnnualPct;
  const created = advanceWarZones(conflictState);
  const zone = created.warZones['war-zone-fixture-war-zone'];
  assert.ok(zone);
  if (!zone) return;
  assert.equal(zone.intensity, 'high');
  assert.deepEqual(warZonesForCountry(created, 'FRA').map((item) => item.id), [zone.id]);
  const impacted = advanceWarZones(created);
  assert.ok(impacted.macroEconomies.FRA.realGrowthAnnualPct < baselineGrowth);
  assert.equal(impacted.warZones[zone.id].economicDisruptionPct, 14);

  const resolved = advanceWarZones({
    ...impacted,
    strategicDossiers: { ...impacted.strategicDossiers, [dossier.id]: { ...dossier, status: 'resolved' as const, updatedAt: '2000-02-01' as const } },
  });
  assert.equal(resolved.warZones[zone.id].status, 'resolved');
  assert.equal(resolved.macroEconomies.FRA.realGrowthAnnualPct, baselineGrowth);
});
