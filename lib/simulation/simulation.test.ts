import assert from 'node:assert/strict';
import test from 'node:test';

import { answerAdvisorQuestion, assessStrategicPlan } from './advisor';
import { launchCommonAction, prepareCommonAction } from './action-programs';
import { energyBalance, nodeAvailableExport, proposeEnergyContract } from './energy';
import {
  acceptEnergyOffer, adjustEnergyOffer, createAdministrativeEnergyOffer, sendEnergyOffer,
} from './energy-negotiation';
import { advanceWorld, replayWorld } from './engine';
import { deserializeWorld, serializeWorld } from './persistence';
import { evaluatePoliticalPathway } from './politics';
import { addEconomicShock, setEconomicPolicy } from './macro-economy';
import { applyDebtCrisisResponse } from './sovereign-debt';
import { evaluateStrategicAction, selectStrategicAction } from './decision-making';
import { reviewCountryStrategy } from './autonomy';
import type { GovernmentMeasure, StrategicActionCandidate } from './types';
import { createFrance2000World } from './scenario-2000';
import { deriveStructuralDiagnostics } from './structural-diagnostics';
import {
  enactGovernmentMeasure, enactPrototypeGovernmentMeasure, stakeholderPressureByChannel, visibleStakeholderReactions,
} from './stakeholders';
import {
  applyPowerStruggleAIProposal, pendingPowerStruggleAIRequests,
  submitPowerStrugglePlayerResponse,
} from './power-struggles';
import { interpretPlayerIntent, rankEnergySuppliers } from './intent';
import {
  dossierUnreadCount, dossiersRequiringAttention, markDossierViewed, setDossierFollowed,
} from './dossiers';

test('le scénario 2000 charge un monde cohérent et jouable', () => {
  const state = createFrance2000World();
  assert.equal(state.currentDate, '2000-01-01');
  assert.equal(state.playerCountryId, 'FRA');
  assert.ok(Object.keys(state.countries).length >= 10);
  assert.ok(Object.keys(state.historicalCurrents).length >= 3);
  assert.ok(Object.keys(state.armamentProducts).length >= 6);
  assert.ok(Object.keys(state.strategicDossiers).length >= 2);
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
  const advanced = advanceWorld(launched.state, '2000-04-01').state;
  assert.notEqual(advanced.actionPrograms[launched.programId].status, 'active');
  assert.equal(advanced.countries.FRA.capacities.diplomacy.committed, initial.countries.FRA.capacities.diplomacy.committed);
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

test('une demande libre identifie le pays et la ressource sans sélecteur', () => {
  const state = createFrance2000World();
  const answer = answerAdvisorQuestion(state, 'Je veux négocier un contrat gazier de long terme avec l’Algérie.');
  assert.equal(answer.interpretation.kind, 'energy_contract');
  assert.equal(answer.interpretation.resource, 'gas');
  assert.equal(answer.interpretation.targetId, 'DZA');
  assert.equal(answer.plans.length, 1);
  assert.equal(answer.plans[0].execution?.supplierId, 'DZA');
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

test('un pays absent est identifié sans inventer de capacité', () => {
  const state = createFrance2000World();
  const intent = interpretPlayerIntent(state, 'Négocier un contrat gazier avec le Kazakhstan.');
  const answer = answerAdvisorQuestion(state, 'Négocier un contrat gazier avec le Kazakhstan.');
  assert.equal(intent.targetLabel, 'Kazakhstan');
  assert.equal(intent.targetStatus, 'unmodeled');
  assert.equal(answer.plans.length, 0);
  assert.ok(answer.synthesis.includes('ne fabrique donc pas'));
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

test('la sauvegarde et le registre permettent de reconstruire exactement un état', () => {
  const initial = createFrance2000World();
  const advanced = advanceWorld(initial, '2000-03-01').state;
  const restored = deserializeWorld(serializeWorld(advanced));
  assert.deepEqual(restored, advanced);

  const replayed = replayWorld(createFrance2000World(), advanced.actions);
  assert.deepEqual(replayed, advanced);
});

test('le noyau macroéconomique fait évoluer réellement les économies sur un an', () => {
  const initial = createFrance2000World();
  const advanced = advanceWorld(initial, '2001-01-01').state;
  assert.equal(Object.keys(initial.macroEconomies).length, 19);
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
  state.countryEnergy.POL.legacyImports.gas = 0;
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

  assert.equal(Object.keys(state.structuralProfiles).length, 12);
  assert.ok(france.some((item) => item.id === 'energy-import-dependency'));
  assert.ok(france.some((item) => item.id === 'industrial-depth'));
  assert.ok(norway.some((item) => item.id === 'energy-export-capacity'));

  state.countryEnergy.FRA.domesticProduction = { ...state.countryEnergy.FRA.annualDemand };
  const energyIndependentFrance = deriveStructuralDiagnostics(state, 'FRA');
  assert.ok(!energyIndependentFrance.some((item) => item.id === 'energy-import-dependency'));
});

test('les mesures successives font émerger une défiance qualitative puis celle-ci s’use', () => {
  let state = createFrance2000World();
  assert.equal(Object.keys(state.stakeholderGroups).length, 48);
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
