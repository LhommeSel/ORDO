import { securityActorsForCountry } from './country-sheet';
import { fiscalBudgetAvailable } from './fiscal';
import { commitWorldAction } from './ledger';
import type {
  ActionProgram,
  GovernmentReport,
  OperationalProjectFinding,
  TerritorialProject,
  TerritorialProjectDecisionOption,
  TerritorialProjectEventFamily,
  TerritorialProjectPlan,
  TerritorialProjectRiskId,
  TerritorialProjectDeliveryModel,
  WorldEffect,
  WorldState,
} from './types';
import { actorEscalationText, createTerritorialProjectActors, projectLeakageRates, refreshTerritorialProjectActors } from './project-actors';
import { resourceDepositsForTerritory } from './resource-data-2000';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

export const normalizeProjectText = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

const resourceAliases: Array<{ resource: string; aliases: RegExp }> = [
  { resource: 'or', aliases: /\b(or|aurifere|auriferes|aurifere|gold)\b/ },
  { resource: 'lithium', aliases: /\b(lithium)\b/ },
  { resource: 'cuivre', aliases: /\b(cuivre|copper)\b/ },
  { resource: 'uranium', aliases: /\b(uranium)\b/ },
  { resource: 'fer', aliases: /\b(fer|minerai de fer)\b/ },
  { resource: 'bauxite', aliases: /\b(bauxite)\b/ },
  { resource: 'nickel', aliases: /\b(nickel)\b/ },
  { resource: 'cobalt', aliases: /\b(cobalt)\b/ },
  { resource: 'diamants', aliases: /\b(diamant|diamants)\b/ },
  { resource: 'charbon', aliases: /\b(charbon|houille)\b/ },
  { resource: 'pétrole', aliases: /\b(petrole|petrolier|hydrocarbure liquide)\b/ },
  { resource: 'gaz', aliases: /\b(gaz|gazier|hydrocarbure gazeux)\b/ },
  { resource: 'terres rares', aliases: /\b(terres rares|rare earth)\b/ },
];

function resourceInText(text: string) {
  const value = normalizeProjectText(text);
  return resourceAliases.find(({ aliases }) => aliases.test(value))?.resource;
}

function resourceWithArticle(resource: string) {
  return resource === 'or' ? 'd’or' : `de ${resource}`;
}

function deliveryModelInText(text: string): TerritorialProjectDeliveryModel {
  const value = normalizeProjectText(text);
  // La combinaison est une décision distincte du choix « privé ». Tester le
  // montage mixte en premier évite qu'une phrase comme « public et privé » ne
  // soit tronquée au premier mot reconnu.
  const hasPublic = /\b(etat|public|publique|regie|operateur public|service public)\b/.test(value);
  const hasPrivate = /\b(privee?|concession|entreprise privee|consortium)\b/.test(value);
  if (hasPublic && hasPrivate) return 'mixed';
  if (hasPublic) return 'public';
  if (hasPrivate) return 'private';
  return 'mixed';
}

function territoryAliases(name: string) {
  const normalized = normalizeProjectText(name);
  const short = normalizeProjectText(name.split('(')[0] ?? name);
  return [...new Set([normalized, short].filter((value) => value.length >= 3))];
}

function resourceDepositForTerritory(state: WorldState, territoryId: string, resource: string) {
  const registry = state.resources;
  if (!registry) return undefined;
  return resourceDepositsForTerritory(registry, territoryId)
    .filter((deposit) => deposit.resourceId === resource)
    .sort((left, right) => right.identifiedStock - left.identifiedStock)[0];
}

/**
 * Extrait uniquement un sujet que les données territoriales savent nommer.
 * Une intention vague (« ouvrir une mine ») reste donc non exécutable.
 */
export function territorialResourceSubject(
  state: WorldState,
  actorId: string,
  text: string,
): Omit<TerritorialProjectPlan, 'evidenceReportId'> | undefined {
  const normalized = ` ${normalizeProjectText(text)} `;
  const territory = Object.values(state.territorial.territories)
    .filter((item) => item.sovereignCountryId === actorId || item.controllerEntityId === actorId)
    .flatMap((item) => territoryAliases(item.name).map((alias) => ({ item, alias })))
    .filter(({ alias }) => normalized.includes(` ${alias} `))
    .sort((left, right) => right.alias.length - left.alias.length)[0]?.item;
  if (!territory) return undefined;
  const explicitResource = resourceInText(text);
  const genericProspection = /\b(prospect\w*|inventaire\w*|recens\w*|ressourc\w* minier\w*|potentiel geologique|gisement\w*)\b/.test(normalized);
  // Une demande de prospection peut dire « ressources minières de Guyane »
  // sans choisir un minerai. Dans ce cas, le registre fournit le sujet le
  // mieux documenté pour le territoire ; une future mine, elle, devra
  // toujours nommer explicitement sa ressource.
  const inferredResource = explicitResource ?? (genericProspection
    ? (state.resources ? resourceDepositsForTerritory(state.resources, territory.id) : [])
      .sort((left, right) => right.identifiedStock - left.identifiedStock)[0]?.resourceId
    : undefined);
  if (!inferredResource) return undefined;
  const resource = inferredResource;
  const deposit = resourceDepositForTerritory(state, territory.id, resource);
  const basin = deposit ? state.resources?.basins[deposit.basinId] : undefined;
  const scale = /\b(pilote|experimental|demonstrateur)\b/.test(normalized)
    ? 'pilot' as const
    : /\b(industriel|grande echelle|massif|majeur)\b/.test(normalized)
      ? 'industrial' as const
      : 'regional' as const;
  return {
    projectType: 'resource_extraction',
    territoryId: territory.id,
    territoryName: territory.name,
    resource,
    scale,
    deliveryModel: deliveryModelInText(text),
    ...(deposit ? {
      depositId: deposit.id,
      basinId: deposit.basinId,
      affectedTerritoryIds: basin?.territoryIds ?? [territory.id],
      claimantEntityIds: deposit.claimantEntityIds,
      legalStatus: deposit.legalStatus,
    } : {}),
  };
}

function matchingSecurityActors(state: WorldState, actorId: string, territoryName: string, resource: string) {
  const territory = normalizeProjectText(territoryName);
  const resourceText = normalizeProjectText(resource);
  // « or » est trop court pour une recherche par sous-chaîne : il remonterait
  // par exemple un acteur lié à la Corse. Les réseaux doivent être reliés par
  // un mot entier, ou par le vocabulaire minier effectivement documenté.
  const resourceMention = resource === 'or'
    ? (value: string) => /\b(or|aurifere|orpaillage|gold)\b/.test(value)
    : (value: string) => new RegExp(`\\b${resourceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(value);
  return securityActorsForCountry(state, actorId).filter((actor) => {
    const text = normalizeProjectText(`${actor.name} ${actor.activity} ${actor.zones.join(' ')} ${actor.notes}`);
    const territoryStem = territory.slice(0, Math.max(5, territory.length - 1));
    return text.includes(territory) || text.includes(territoryStem) || resourceMention(text);
  });
}

function securityRiskFor(state: WorldState, actorId: string, territoryName: string, resource: string) {
  const matching = matchingSecurityActors(state, actorId, territoryName, resource);
  if (!matching.length) return 38;
  const score = { low: 38, moderate: 56, high: 76, critical: 90 } as const;
  return Math.max(...matching.map((actor) => score[actor.threatLevel]));
}

export function territorialProjectRisks(
  state: WorldState,
  actorId: string,
  subject: Pick<TerritorialProjectPlan, 'territoryId' | 'territoryName' | 'resource' | 'scale' | 'depositId'>,
): TerritorialProject['risks'] {
  const territory = state.territorial.territories[subject.territoryId];
  const deposit = subject.depositId ? state.resources?.deposits[subject.depositId] : undefined;
  const assets = Object.values(state.territorial.assets).filter((asset) => asset.territoryId === subject.territoryId);
  const accessCount = assets.filter((asset) => ['port', 'airport', 'logistics', 'passage'].includes(asset.kind) && asset.status === 'operating').length;
  const smallPopulation = territory?.population !== null && territory?.population !== undefined && territory.population < 500_000;
  const scalePressure = subject.scale === 'industrial' ? 18 : subject.scale === 'regional' ? 8 : 0;
  const legalPressure = deposit?.legalStatus === 'contested' ? 14 : deposit?.legalStatus === 'shared' ? 8 : 0;
  const crossBorderPressure = (deposit?.territoryShares.length ?? 0) > 1 ? 8 : 0;
  return {
    logistics: clamp((accessCount === 0 ? 72 : accessCount === 1 ? 54 : 38) + (smallPopulation ? 8 : 0) + scalePressure * 0.45 + crossBorderPressure),
    environment: clamp((territory?.kind === 'overseas' ? 72 : 48) + scalePressure),
    security: clamp(securityRiskFor(state, actorId, subject.territoryName, subject.resource) + scalePressure * 0.35 + legalPressure + crossBorderPressure),
    social_license: clamp((territory?.kind === 'overseas' ? 62 : 44) + (smallPopulation ? 7 : 0) + scalePressure * 0.75 + legalPressure * 0.4),
    finance: clamp(40 + scalePressure + (accessCount === 0 ? 16 : 0) + legalPressure + crossBorderPressure),
  };
}

export function operationalFindingForReport(
  state: WorldState,
  report: Pick<GovernmentReport, 'kind' | 'actorId' | 'subject'>,
  programText: string,
  delivered: boolean,
): OperationalProjectFinding | undefined {
  if (report.kind !== 'prospection') return undefined;
  const subject = territorialResourceSubject(state, report.actorId, `${report.subject} ${programText}`);
  if (!subject) return undefined;
  const risks = territorialProjectRisks(state, report.actorId, subject);
  const constraints = (Object.entries(risks) as Array<[TerritorialProjectRiskId, number]>)
    .filter(([, value]) => value >= 55)
    .map(([risk]) => risk);
  return {
    projectType: subject.projectType,
    territoryId: subject.territoryId,
    territoryName: subject.territoryName,
    resource: subject.resource,
    viability: delivered ? 'conditional' : 'inconclusive',
    confidence: delivered ? 'high' : 'low',
    constraints,
    // Une prospection ne valide jamais une exploitation de plein volume. Le
    // premier projet autorisé est un pilote, quel que soit le vocabulaire
    // ambitieux employé dans la demande initiale.
    recommendedScale: 'pilot',
    stakeholderIds: matchingSecurityActors(state, report.actorId, subject.territoryName, subject.resource).map((actor) => actor.id),
    depositId: subject.depositId,
    basinId: subject.basinId,
    affectedTerritoryIds: subject.affectedTerritoryIds,
    claimantEntityIds: subject.claimantEntityIds,
    legalStatus: subject.legalStatus,
  };
}

export function matchingOperationalReport(
  state: WorldState,
  actorId: string,
  subject: Omit<TerritorialProjectPlan, 'evidenceReportId'>,
) {
  return Object.values(state.reports ?? {}).find((report) => {
    const finding = report.operationalFinding;
    return report.actorId === actorId
      && report.status === 'delivered'
      && finding?.projectType === subject.projectType
      && finding.territoryId === subject.territoryId
      && normalizeProjectText(finding.resource) === normalizeProjectText(subject.resource)
      && (!subject.depositId || finding.depositId === subject.depositId)
      && (finding.viability === 'conditional' || finding.viability === 'viable');
  });
}

export function territorialProjectPlanForIntent(state: WorldState, actorId: string, intent: string) {
  const subject = territorialResourceSubject(state, actorId, intent);
  if (!subject) return { ok: false as const, error: 'Le projet extractif doit nommer une ressource et un territoire contrôlé présents dans la carte.' };
  const report = matchingOperationalReport(state, actorId, subject);
  if (!report) return {
    ok: false as const,
    error: `Le projet ${resourceWithArticle(subject.resource)} en ${subject.territoryName} exige d’abord un rapport de prospection livré sur cette ressource et ce territoire.`,
  };
  return { ok: true as const, plan: { ...subject, evidenceReportId: report.id } satisfies TerritorialProjectPlan };
}

export function validateTerritorialProjectPlan(state: WorldState, actorId: string, plan: TerritorialProjectPlan) {
  const territory = state.territorial.territories[plan.territoryId];
  const report = state.reports?.[plan.evidenceReportId];
  const finding = report?.operationalFinding;
  if (!territory || (territory.sovereignCountryId !== actorId && territory.controllerEntityId !== actorId)) {
    return { ok: false as const, error: 'Le contrôle du territoire a changé ; le projet doit être réévalué.' };
  }
  if (!report || report.status !== 'delivered' || finding?.territoryId !== plan.territoryId
    || normalizeProjectText(finding.resource) !== normalizeProjectText(plan.resource)
    || (plan.depositId && finding.depositId !== plan.depositId)
    || !['conditional', 'viable'].includes(finding.viability)) {
    return { ok: false as const, error: 'La preuve opérationnelle associée au projet n’est plus valide.' };
  }
  return { ok: true as const };
}

export function createTerritorialProject(state: WorldState, program: ActionProgram): TerritorialProject | undefined {
  const plan = program.territorialProjectPlan;
  if (!plan || !program.territorialProjectId) return undefined;
  const territory = state.territorial.territories[plan.territoryId];
  if (!territory) return undefined;
  const risks = territorialProjectRisks(state, program.actorId, plan);
  const project: TerritorialProject = {
    id: program.territorialProjectId,
    programId: program.id,
    dossierId: program.linkedDossierId ?? `decision-${program.id}`,
    actorId: program.actorId,
    projectType: plan.projectType,
    territoryId: plan.territoryId,
    territoryName: plan.territoryName,
    anchor: territory.anchor,
    resource: plan.resource,
    scale: plan.scale,
    deliveryModel: plan.deliveryModel,
    evidenceReportId: plan.evidenceReportId,
    depositId: plan.depositId,
    basinId: plan.basinId,
    affectedTerritoryIds: plan.affectedTerritoryIds,
    claimantEntityIds: plan.claimantEntityIds,
    legalStatus: plan.legalStatus,
    phase: 'preparation',
    status: 'active',
    createdAt: state.currentDate,
    updatedAt: state.currentDate,
    progressPct: 0,
    delayMonths: 0,
    initialBudgetCost: program.budgetCost,
    additionalBudgetCost: 0,
    risks,
    outputPotential: plan.scale === 'pilot' ? 42 : plan.scale === 'regional' ? 62 : 80,
    socialAcceptance: clamp(100 - risks.social_license),
    environmentalSafeguards: 35,
    securityControl: clamp(100 - risks.security),
    actors: [],
    eventHistory: [],
  };
  const leakage = projectLeakageRates(state, project);
  return { ...project, ...leakage, actors: createTerritorialProjectActors(state, project) };
}

function actorEscalationEffects(state: WorldState, project: TerritorialProject, escalations: TerritorialProject['actors']) {
  if (!escalations.length) return [];
  const dossier = state.strategicDossiers[project.dossierId];
  const eventId = `${project.id}:actors:${state.currentDate}:${escalations.map((actor) => `${actor.kind}-${actor.status}`).join('-')}`;
  const summary = escalations.map((actor) => actorEscalationText(actor, project)).join(' ');
  const actorIds = [project.actorId, ...escalations.map((actor) => actor.id)];
  const importance = escalations.some((actor) => actor.status === 'coercive' || actor.status === 'opposing') ? 'major' as const : 'moderate' as const;
  return [
    { kind: 'world_event_add' as const, event: {
      id: eventId, date: state.currentDate, title: `Acteurs mobilisés · ${project.territoryName}`,
      summary, dossierId: project.dossierId, importance, scope: 'national' as const, actorIds, source: 'system' as const,
      territoryId: project.territoryId, anchor: project.anchor,
    }, reason: 'Plusieurs acteurs atteignent un seuil d’implication dans le projet territorial.', visibility: 'player' as const },
    ...(dossier ? [{ kind: 'dossier_entry_add' as const, dossierId: project.dossierId, entry: {
      id: eventId, date: state.currentDate, title: `Acteurs mobilisés · ${project.territoryName}`,
      summary, importance, actorIds, requiresDecision: false, visibility: 'player' as const,
    }, reason: 'L’implication des acteurs est regroupée dans le dossier du projet.', visibility: 'player' as const }] : []),
  ];
}

const emptyImpact = (): TerritorialProjectDecisionOption['impact'] => ({
  additionalBudgetCost: 0,
  delayMonths: 0,
  riskDeltas: {},
  outputPotentialDelta: 0,
  socialAcceptanceDelta: 0,
  environmentalSafeguardsDelta: 0,
  securityControlDelta: 0,
});

function optionsFor(family: TerritorialProjectEventFamily): TerritorialProjectDecisionOption[] {
  if (family === 'logistics_bottleneck') return [
    { id: 'build-access', label: 'Financer les accès durables', summary: 'Créer une desserte robuste et accepter un surcoût immédiat.', impact: { ...emptyImpact(), additionalBudgetCost: 1.8, delayMonths: 1, riskDeltas: { logistics: -30, environment: 5 }, outputPotentialDelta: 8, socialAcceptanceDelta: 2 } },
    { id: 'temporary-route', label: 'Installer une desserte provisoire', summary: 'Limiter la dépense, au prix d’un chantier plus lent et fragile.', impact: { ...emptyImpact(), additionalBudgetCost: 0.7, delayMonths: 2, riskDeltas: { logistics: -14, finance: 5 }, outputPotentialDelta: -3 } },
    { id: 'reduce-scale', label: 'Réduire l’échelle du projet', summary: 'Préserver le calendrier en abaissant la production visée.', impact: { ...emptyImpact(), riskDeltas: { logistics: -20, finance: -10 }, outputPotentialDelta: -15, socialAcceptanceDelta: 4 } },
  ];
  if (family === 'environmental_alert') return [
    { id: 'independent-study', label: 'Suspendre pour expertise indépendante', summary: 'Documenter l’impact et renforcer les garanties avant reprise.', impact: { ...emptyImpact(), additionalBudgetCost: 0.9, delayMonths: 2, riskDeltas: { environment: -28, social_license: -14 }, environmentalSafeguardsDelta: 30, socialAcceptanceDelta: 12, internationalReputationDelta: 2 } },
    { id: 'reinforce-safeguards', label: 'Renforcer le chantier sans l’arrêter', summary: 'Ajouter des protections tout en maintenant une activité réduite.', impact: { ...emptyImpact(), additionalBudgetCost: 1.3, delayMonths: 1, riskDeltas: { environment: -18 }, outputPotentialDelta: -4, environmentalSafeguardsDelta: 20, socialAcceptanceDelta: 6 } },
    { id: 'maintain-course', label: 'Maintenir le calendrier', summary: 'Assumer la contestation et le risque de dommages durables.', impact: { ...emptyImpact(), riskDeltas: { environment: 12, social_license: 18 }, outputPotentialDelta: 3, socialAcceptanceDelta: -18, environmentalSafeguardsDelta: -8, nationalStabilityDelta: -1.5, internationalReputationDelta: -2 } },
  ];
  if (family === 'security_pressure') return [
    { id: 'joint-enforcement', label: 'Coordonner sécurité et autorités locales', summary: 'Cibler les réseaux illégaux tout en protégeant les populations.', impact: { ...emptyImpact(), additionalBudgetCost: 1.1, delayMonths: 1, riskDeltas: { security: -28, social_license: -8 }, securityControlDelta: 28, socialAcceptanceDelta: 8, nationalStabilityDelta: 0.5 } },
    { id: 'site-only-security', label: 'Sécuriser uniquement le site', summary: 'Protéger vite l’investissement sans traiter l’économie clandestine alentour.', impact: { ...emptyImpact(), additionalBudgetCost: 0.6, riskDeltas: { security: -12, social_license: 5 }, securityControlDelta: 16, socialAcceptanceDelta: -4 } },
    { id: 'tolerate-leakage', label: 'Tolérer les pertes périphériques', summary: 'Éviter une opération coûteuse, avec une production et une autorité amoindries.', impact: { ...emptyImpact(), riskDeltas: { security: 14, finance: 8 }, outputPotentialDelta: -12, securityControlDelta: -10, nationalStabilityDelta: -0.8 } },
  ];
  if (family === 'community_opposition') return [
    { id: 'territorial-agreement', label: 'Négocier un accord territorial', summary: 'Associer collectivités, emplois locaux et mécanisme de compensation.', impact: { ...emptyImpact(), additionalBudgetCost: 1.0, delayMonths: 1, riskDeltas: { social_license: -30, finance: 5 }, socialAcceptanceDelta: 28, environmentalSafeguardsDelta: 8, nationalStabilityDelta: 1 } },
    { id: 'local-employment', label: 'Garantir formation et emplois locaux', summary: 'Concentrer les concessions sur les retombées économiques.', impact: { ...emptyImpact(), additionalBudgetCost: 0.7, riskDeltas: { social_license: -18 }, outputPotentialDelta: -2, socialAcceptanceDelta: 17 } },
    { id: 'administrative-override', label: 'Passer outre administrativement', summary: 'Préserver le rythme du chantier en assumant le conflit politique.', impact: { ...emptyImpact(), riskDeltas: { social_license: 20, security: 8 }, socialAcceptanceDelta: -24, nationalStabilityDelta: -2 } },
  ];
  if (family === 'cost_overrun') return [
    { id: 'supplement-budget', label: 'Ouvrir une enveloppe complémentaire', summary: 'Préserver la cible industrielle et absorber le surcoût.', impact: { ...emptyImpact(), additionalBudgetCost: 2.2, riskDeltas: { finance: -25 }, outputPotentialDelta: 5 } },
    { id: 'stage-investment', label: 'Échelonner les investissements', summary: 'Réduire la tension budgétaire en acceptant un retard.', impact: { ...emptyImpact(), additionalBudgetCost: 0.5, delayMonths: 2, riskDeltas: { finance: -16 }, outputPotentialDelta: -3 } },
    { id: 'cut-specifications', label: 'Réduire le périmètre', summary: 'Tenir l’enveloppe initiale avec un potentiel de production inférieur.', impact: { ...emptyImpact(), riskDeltas: { finance: -22 }, outputPotentialDelta: -18, socialAcceptanceDelta: -3 } },
  ];
  return [
    { id: 'verify-upgrade', label: 'Vérifier avant d’étendre', summary: 'Confirmer la découverte puis réviser le plan industriel.', impact: { ...emptyImpact(), additionalBudgetCost: 0.6, delayMonths: 1, riskDeltas: { finance: -4 }, outputPotentialDelta: 16 } },
    { id: 'accelerate', label: 'Accélérer l’exploitation', summary: 'Transformer rapidement la découverte en capacité supplémentaire.', impact: { ...emptyImpact(), additionalBudgetCost: 1.5, riskDeltas: { environment: 12, social_license: 8, finance: 5 }, outputPotentialDelta: 24, environmentalSafeguardsDelta: -5 } },
    { id: 'keep-plan', label: 'Conserver le plan initial', summary: 'Garder la découverte comme marge sans changer le chantier.', impact: { ...emptyImpact(), outputPotentialDelta: 8 } },
  ];
}

const eventCopy: Record<TerritorialProjectEventFamily, { title: string; brief: (project: TerritorialProject) => string }> = {
  logistics_bottleneck: { title: 'Accès au site plus difficiles que prévu', brief: (project) => `Les accès au projet ${resourceWithArticle(project.resource)} en ${project.territoryName} ne permettent pas de tenir simultanément le coût, le calendrier et le volume prévus.` },
  environmental_alert: { title: 'Alerte environnementale sur le chantier', brief: (project) => `Les premiers travaux du projet ${resourceWithArticle(project.resource)} révèlent un impact environnemental insuffisamment couvert par les garanties existantes.` },
  security_pressure: { title: 'Pression des réseaux clandestins', brief: (project) => `Des activités clandestines perturbent les accès, la sécurité et la traçabilité autour du projet ${resourceWithArticle(project.resource)} en ${project.territoryName}.` },
  community_opposition: { title: 'Contestation territoriale du projet', brief: (project) => `Des acteurs locaux demandent des garanties sur l’emploi, les retombées et les dommages du projet ${resourceWithArticle(project.resource)}.` },
  cost_overrun: { title: 'Dérive du coût du projet', brief: (project) => `Les contraintes cumulées du projet ${resourceWithArticle(project.resource)} dépassent l’enveloppe de lancement et imposent un arbitrage de périmètre.` },
  resource_upgrade: { title: 'Indices supérieurs aux estimations', brief: (project) => `Les travaux révèlent un potentiel ${resourceWithArticle(project.resource)} supérieur au scénario central du rapport, sans encore justifier une extension automatique.` },
};

function nextEventFamily(project: TerritorialProject): TerritorialProjectEventFamily | undefined {
  const used = new Set(project.eventHistory.map((event) => event.family));
  const candidates: Array<[TerritorialProjectEventFamily, number]> = [
    ['logistics_bottleneck', project.risks.logistics],
    ['environmental_alert', project.risks.environment],
    ['security_pressure', project.risks.security],
    ['community_opposition', project.risks.social_license],
    ['cost_overrun', project.risks.finance],
  ];
  const risk = candidates.filter(([family]) => !used.has(family)).sort((left, right) => right[1] - left[1])[0];
  if (risk && risk[1] >= 48) return risk[0];
  if (!used.has('resource_upgrade') && project.progressPct >= 55) return 'resource_upgrade';
  return undefined;
}

function projectEventEffects(state: WorldState, project: TerritorialProject, family: TerritorialProjectEventFamily): WorldEffect[] {
  const copy = eventCopy[family];
  const decisionId = `${project.id}:decision:${project.eventHistory.length + 1}`;
  const factualBrief = copy.brief(project);
  const pendingDecision = {
    id: decisionId,
    family,
    title: copy.title,
    factualBrief,
    occurredAt: state.currentDate,
    options: optionsFor(family),
    unresolvedMonths: 0,
    aiNarrativeStatus: 'required' as const,
  };
  const history = [...project.eventHistory, {
    id: decisionId,
    family,
    date: state.currentDate,
    title: copy.title,
    summary: factualBrief,
  }];
  const dossier = state.strategicDossiers[project.dossierId];
  return [
    { kind: 'territorial_project_patch', projectId: project.id, patch: { status: 'active', phase: project.phase, updatedAt: state.currentDate, pendingDecision, eventHistory: history }, reason: factualBrief, visibility: 'player' },
    { kind: 'world_event_add', event: {
      id: `${decisionId}:event`, date: state.currentDate, title: copy.title, summary: factualBrief,
      dossierId: project.dossierId, importance: family === 'resource_upgrade' ? 'moderate' : 'major', scope: 'national',
      actorIds: [project.actorId], source: 'system', territoryId: project.territoryId, anchor: project.anchor,
    }, reason: 'Un incident matériel du projet devient un fait visible sur la carte.', visibility: 'player' },
    ...(dossier ? [
      { kind: 'dossier_patch' as const, dossierId: project.dossierId, patch: {
        phase: `Arbitrage requis · ${copy.title}`,
        updatedAt: state.currentDate,
        pendingDecisions: dossier.pendingDecisions.includes(factualBrief) ? dossier.pendingDecisions : [...dossier.pendingDecisions, factualBrief],
      }, reason: 'Le projet attend une décision du gouvernement.', visibility: 'player' as const },
      { kind: 'dossier_entry_add' as const, dossierId: project.dossierId, entry: {
        id: decisionId, date: state.currentDate, title: copy.title, summary: factualBrief,
        importance: 'major' as const, actorIds: [project.actorId], requiresDecision: true, visibility: 'player' as const,
      }, reason: 'L’incident est inscrit dans la chronologie du projet.', visibility: 'player' as const },
    ] : []),
  ];
}

/** Coût mensuel de l’inaction : l’événement reste ouvert, mais il devient une
 * friction réelle plutôt qu’un mur de gameplay. */
function deferredDecisionPenalty(family: TerritorialProjectEventFamily) {
  const base = {
    additionalBudgetCost: 0.1,
    delayMonths: 0.18,
    riskDeltas: {} as Partial<Record<TerritorialProjectRiskId, number>>,
    socialAcceptanceDelta: 0,
    environmentalSafeguardsDelta: 0,
    securityControlDelta: 0,
    nationalMetric: undefined as 'stability' | 'security' | undefined,
    nationalMetricDelta: 0,
  };
  if (family === 'logistics_bottleneck') return { ...base, riskDeltas: { logistics: 1.2, finance: 0.6 } };
  if (family === 'environmental_alert') return { ...base, riskDeltas: { environment: 1.35, social_license: 0.55 }, socialAcceptanceDelta: -0.8, environmentalSafeguardsDelta: -0.45, nationalMetric: 'stability' as const, nationalMetricDelta: -0.16 };
  if (family === 'security_pressure') return { ...base, riskDeltas: { security: 1.35, social_license: 0.35 }, socialAcceptanceDelta: -0.45, securityControlDelta: -1, nationalMetric: 'security' as const, nationalMetricDelta: -0.18 };
  if (family === 'community_opposition') return { ...base, riskDeltas: { social_license: 1.6, security: 0.25 }, socialAcceptanceDelta: -1.25, nationalMetric: 'stability' as const, nationalMetricDelta: -0.22 };
  if (family === 'cost_overrun') return { ...base, additionalBudgetCost: 0.18, riskDeltas: { finance: 1.5 } };
  return { ...base, additionalBudgetCost: 0.04, delayMonths: 0.05, riskDeltas: { finance: 0.25 } };
}

/**
 * Avance le projet jusqu'au prochain jalon. Un seul incident peut être ouvert
 * à la fois ; son arbitrage reste ouvert, mais ne fige jamais le chantier.
 */
export function advanceTerritorialProject(
  state: WorldState,
  projectId: string,
  progressPct: number,
) {
  const project = state.territorialProjects?.[projectId];
  if (!project || !['active', 'awaiting_decision'].includes(project.status)) return state;
  if (project.pendingDecision) {
    const decision = project.pendingDecision;
    const deferred = deferredDecisionPenalty(decision.family);
    const available = fiscalBudgetAvailable(state.countries[project.actorId], 'discretionary');
    const incurredCost = Math.min(deferred.additionalBudgetCost, available);
    const risk = (id: TerritorialProjectRiskId) => clamp(project.risks[id] + (deferred.riskDeltas[id] ?? 0));
    const updated: TerritorialProject = {
      ...project,
      status: 'active',
      progressPct: clamp(Math.max(project.progressPct, progressPct)),
      phase: progressPct >= 82 ? 'commissioning' : progressPct >= 20 ? 'construction' : 'preparation',
      updatedAt: state.currentDate,
      delayMonths: Number((project.delayMonths + deferred.delayMonths).toFixed(2)),
      additionalBudgetCost: Number((project.additionalBudgetCost + incurredCost).toFixed(2)),
      risks: { logistics: risk('logistics'), environment: risk('environment'), security: risk('security'), social_license: risk('social_license'), finance: risk('finance') },
      socialAcceptance: clamp(project.socialAcceptance + deferred.socialAcceptanceDelta),
      environmentalSafeguards: clamp(project.environmentalSafeguards + deferred.environmentalSafeguardsDelta),
      securityControl: clamp(project.securityControl + deferred.securityControlDelta),
      pendingDecision: { ...decision, unresolvedMonths: decision.unresolvedMonths + 1 },
    };
    const refreshedActors = refreshTerritorialProjectActors(state, updated);
    const updatedWithActors = { ...updated, ...projectLeakageRates(state, updated), actors: refreshedActors.actors };
    const effects: WorldEffect[] = [
      { kind: 'territorial_project_patch', projectId, patch: updatedWithActors, reason: `L’arbitrage « ${decision.title} » reste ouvert : le chantier continue avec une pénalité de risque et de délai.`, visibility: 'player' },
      ...(incurredCost > 0 ? [{ kind: 'fiscal_delta' as const, countryId: project.actorId, bucket: 'discretionary' as const, delta: -incurredCost, reason: 'L’absence d’arbitrage entraîne des coûts de continuité et de sécurisation du chantier.' }] : []),
      ...(deferred.nationalMetric ? [{ kind: 'metric_delta' as const, countryId: project.actorId, metric: deferred.nationalMetric, delta: deferred.nationalMetricDelta, reason: 'Un incident territorial non traité dégrade temporairement la situation nationale.' }] : []),
      ...actorEscalationEffects(state, updatedWithActors, refreshedActors.escalations),
    ];
    return commitWorldAction(state, {
      kind: 'economic', actorId: project.actorId, origin: 'time',
      intent: `Poursuivre sous contrainte : ${project.resource} · ${project.territoryName}`,
      effects,
      metadata: { territorialProjectId: project.id, territorialProjectDecisionId: decision.id },
    });
  }
  const updated: TerritorialProject = {
    ...project,
    progressPct: clamp(Math.max(project.progressPct, progressPct)),
    phase: progressPct >= 82 ? 'commissioning' : progressPct >= 20 ? 'construction' : 'preparation',
    updatedAt: state.currentDate,
  };
  const refreshedActors = refreshTerritorialProjectActors(state, updated);
  const updatedWithActors = { ...updated, ...projectLeakageRates(state, updated), actors: refreshedActors.actors };
  let next = commitWorldAction(state, {
    kind: 'economic', actorId: project.actorId, origin: 'time', visibility: 'debug',
    intent: `Avancer le projet territorial : ${project.resource} · ${project.territoryName}`,
    effects: [{ kind: 'territorial_project_patch', projectId, patch: updatedWithActors, reason: 'Le jalon matériel du projet est synchronisé avec son programme.', visibility: 'debug' }, ...actorEscalationEffects(state, updatedWithActors, refreshedActors.escalations)],
  });
  const threshold = 12 + updatedWithActors.eventHistory.length * 20;
  if (updatedWithActors.progressPct < threshold) return next;
  const family = nextEventFamily(updatedWithActors);
  if (!family) return next;
  next = commitWorldAction(next, {
    kind: 'economic', actorId: project.actorId, origin: 'time',
    intent: `Signaler un incident du projet : ${eventCopy[family].title}`,
    effects: projectEventEffects(next, updatedWithActors, family),
    metadata: { territorialProjectId: project.id, territorialProjectDecisionId: `${project.id}:decision:${project.eventHistory.length + 1}` },
  });
  return next;
}

export function territorialProjectBlocksProgress(state: WorldState, projectId?: string) {
  // Conservé pour les appels existants : un incident est une contrainte et une
  // décision politique, jamais un verrou technique qui arrête le jeu.
  void state; void projectId;
  return false;
}

/**
 * L'IA ne modifie jamais les coûts ou les risques : elle rend l'incident
 * compréhensible en reliant les faits du moteur aux acteurs de terrain.
 * Sans cette lecture, le joueur ne peut pas arbitrer un projet territorial.
 */
export function applyTerritorialProjectAINarrative(
  state: WorldState,
  projectId: string,
  decisionId: string,
  narrative: string,
) {
  const project = state.territorialProjects?.[projectId];
  const decision = project?.pendingDecision;
  const value = narrative.trim().replace(/\s+/g, ' ').slice(0, 2_000);
  if (!project || !decision || decision.id !== decisionId) {
    return { ok: false as const, state, error: 'Cet arbitrage territorial n’est plus actif.' };
  }
  if (!value) return { ok: false as const, state, error: 'La lecture IA de cet incident est vide.' };
  const next = commitWorldAction(state, {
    kind: 'economic', actorId: project.actorId, origin: 'ai', visibility: 'debug',
    intent: `Mettre en récit l’incident territorial : ${decision.title}`,
    effects: [{
      kind: 'territorial_project_patch', projectId,
      patch: { pendingDecision: { ...decision, aiNarrativeStatus: 'ready', aiNarrative: value } },
      reason: 'La lecture IA contextualise l’arbitrage sans altérer ses effets autorisés.',
      visibility: 'debug',
    }],
    metadata: { territorialProjectId: projectId, territorialProjectDecisionId: decisionId },
  });
  return { ok: true as const, state: next };
}

export function resolveTerritorialProjectDecision(
  state: WorldState,
  projectId: string,
  decisionId: string,
  optionId: string,
) {
  const project = state.territorialProjects?.[projectId];
  const decision = project?.pendingDecision;
  if (!project || !decision || decision.id !== decisionId) return { ok: false as const, state, error: 'Cet arbitrage territorial n’est plus actif.' };
  if (decision.aiNarrativeStatus !== 'ready' || !decision.aiNarrative) {
    return { ok: false as const, state, error: 'L’incident doit d’abord être présenté par l’IA avant tout arbitrage.' };
  }
  const option = decision.options.find((item) => item.id === optionId);
  if (!option) return { ok: false as const, state, error: 'Option territoriale introuvable.' };
  const available = fiscalBudgetAvailable(state.countries[project.actorId], 'discretionary');
  if (option.impact.additionalBudgetCost > available) return { ok: false as const, state, error: `Marge discrétionnaire insuffisante : ${option.impact.additionalBudgetCost.toFixed(1)} nécessaire, ${available.toFixed(1)} disponible.` };
  const risk = (id: TerritorialProjectRiskId) => clamp(project.risks[id] + (option.impact.riskDeltas[id] ?? 0));
  const eventHistory = project.eventHistory.map((event) => event.id === decision.id
    ? { ...event, selectedOptionId: option.id, selectedOptionLabel: option.label, summary: `${event.summary} Décision : ${option.label}. ${option.summary}` }
    : event);
  const patch: Partial<TerritorialProject> = {
    status: 'active',
    phase: project.progressPct >= 82 ? 'commissioning' : project.progressPct >= 20 ? 'construction' : 'preparation',
    updatedAt: state.currentDate,
    delayMonths: Number((project.delayMonths + option.impact.delayMonths).toFixed(2)),
    additionalBudgetCost: Number((project.additionalBudgetCost + option.impact.additionalBudgetCost).toFixed(2)),
    risks: { logistics: risk('logistics'), environment: risk('environment'), security: risk('security'), social_license: risk('social_license'), finance: risk('finance') },
    outputPotential: clamp(project.outputPotential + option.impact.outputPotentialDelta),
    socialAcceptance: clamp(project.socialAcceptance + option.impact.socialAcceptanceDelta),
    environmentalSafeguards: clamp(project.environmentalSafeguards + option.impact.environmentalSafeguardsDelta),
    securityControl: clamp(project.securityControl + option.impact.securityControlDelta),
    eventHistory,
    pendingDecision: undefined,
  };
  const projectAfterChoice = { ...project, ...patch } as TerritorialProject;
  const refreshedActors = refreshTerritorialProjectActors(state, projectAfterChoice);
  Object.assign(patch, projectLeakageRates(state, projectAfterChoice), { actors: refreshedActors.actors });
  const dossier = state.strategicDossiers[project.dossierId];
  const effects: WorldEffect[] = [
    { kind: 'territorial_project_patch', projectId, patch, reason: `${option.label} : ${option.summary}`, visibility: 'player' },
    ...(option.impact.additionalBudgetCost > 0 ? [{ kind: 'fiscal_delta' as const, countryId: project.actorId, bucket: 'discretionary' as const, delta: -option.impact.additionalBudgetCost, reason: `L’arbitrage « ${option.label} » engage un financement complémentaire du projet.` }] : []),
    ...(option.impact.nationalStabilityDelta ? [{ kind: 'metric_delta' as const, countryId: project.actorId, metric: 'stability' as const, delta: option.impact.nationalStabilityDelta, reason: `L’arbitrage territorial « ${option.label} » modifie le soutien politique au projet.` }] : []),
    ...internationalSignalEffects(state, project, option.impact.internationalReputationDelta ?? 0, `Les partenaires commerciaux prennent acte de l’arbitrage territorial « ${option.label} » sur les garanties du projet.`),
    ...(dossier ? [
      { kind: 'dossier_patch' as const, dossierId: project.dossierId, patch: {
        phase: 'Exécution du projet territorial', updatedAt: state.currentDate,
        pendingDecisions: dossier.pendingDecisions.filter((item) => item !== decision.factualBrief),
      }, reason: 'L’arbitrage territorial est clos.', visibility: 'player' as const },
      { kind: 'dossier_entry_add' as const, dossierId: project.dossierId, entry: {
        id: `${decision.id}:resolution`, date: state.currentDate, title: `Décision · ${option.label}`,
        summary: option.summary, importance: 'major' as const, actorIds: [project.actorId], requiresDecision: false, visibility: 'player' as const,
      }, reason: 'La décision du joueur est conservée dans le dossier.', visibility: 'player' as const },
    ] : []),
  ];
  const next = commitWorldAction(state, {
    kind: 'economic', actorId: project.actorId, origin: 'player',
    intent: `Arbitrer ${decision.title} : ${option.label}`, effects,
    metadata: { territorialProjectId: project.id, territorialProjectDecisionId: decision.id, optionId: option.id },
  });
  return { ok: true as const, state: next };
}

function outcomeFor(project: TerritorialProject, result: 'succeeded' | 'partially_succeeded' | 'failed'): NonNullable<TerritorialProject['outcome']> {
  const success = result === 'succeeded';
  const partial = result === 'partially_succeeded';
  const crossBorderNote = project.claimantEntityIds?.length && project.legalStatus && project.legalStatus !== 'undisputed'
    ? ` Le projet reste lié à une revendication ${project.legalStatus} portée par ${project.claimantEntityIds.join(', ')} ; aucune reconnaissance automatique du droit territorial n’est produite.`
    : '';
  return {
    economic: result === 'failed'
      ? `Le projet ${resourceWithArticle(project.resource)} n’atteint pas le stade productif ; les dépenses engagées restent sans capacité durable.`
      : `${success ? 'Une capacité productive durable' : 'Une capacité pilote limitée'} ${resourceWithArticle(project.resource)} est créée en ${project.territoryName}, avec un potentiel final de ${Math.round(project.outputPotential)}/100.`,
    social: `Acceptation territoriale finale : ${Math.round(project.socialAcceptance)}/100 ; les choix d’emploi, de compensation et de concertation restent inscrits dans le dossier.`,
    environmental: `Garanties environnementales finales : ${Math.round(project.environmentalSafeguards)}/100 ; risque résiduel ${Math.round(project.risks.environment)}/100.`,
    security: `Contrôle du site et de ses flux : ${Math.round(project.securityControl)}/100 ; pression clandestine résiduelle ${Math.round(project.risks.security)}/100.`,
    political: `${partial ? 'Le résultat partiel' : success ? 'La mise en service' : 'L’échec'} pèse sur le bilan gouvernemental selon l’acceptation locale et les surcoûts assumés.`,
    governance: `Gouvernance du projet : ${Math.round(project.governanceScore ?? 0)}/100 ; fuite estimée du budget engagé ${Math.round(project.budgetLeakagePct ?? 0)} % et perte potentielle des flux de production ${Math.round(project.outputLeakagePct ?? 0)} %. Ces indicateurs alimenteront le registre de production et les recettes lorsque le marché sera modélisé.`,
    international: `${project.resource === 'or'
      ? 'La traçabilité de la production et le respect des garanties conditionnent sa crédibilité sur les marchés internationaux.'
      : `La nouvelle capacité ${resourceWithArticle(project.resource)} modifie à la marge la dépendance extérieure et l’intérêt des partenaires industriels.`}${crossBorderNote}`,
  };
}

/** Les partenaires observateurs viennent du réseau commercial réel, jamais
 * d'une liste ad hoc par mine. Ils reçoivent seulement un signal limité de
 * fiabilité / traçabilité, pas un contrat fictif. */
function marketObserversForProject(state: WorldState, project: TerritorialProject) {
  const scores = new Map<string, number>();
  for (const flow of Object.values(state.tradeFlows ?? {})) {
    const counterpart = flow.exporterId === project.actorId ? flow.importerId
      : flow.importerId === project.actorId ? flow.exporterId : undefined;
    if (!counterpart || !state.countries[counterpart]) continue;
    const rawMaterialWeight = flow.productMix.raw_materials ?? 0;
    scores.set(counterpart, (scores.get(counterpart) ?? 0) + flow.annualValueBillion2000Usd * (0.55 + rawMaterialWeight * 1.8));
  }
  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([countryId]) => countryId);
}

function internationalSignalEffects(
  state: WorldState,
  project: TerritorialProject,
  delta: number,
  reason: string,
): WorldEffect[] {
  if (!delta) return [];
  return marketObserversForProject(state, project).map((countryId) => ({
    kind: 'relation_delta' as const,
    from: countryId,
    to: project.actorId,
    relation: Number((delta * 0.45).toFixed(2)),
    trust: Number((delta * 0.3).toFixed(2)),
    reason,
    visibility: 'player' as const,
  }));
}

/** Effets terminaux calculés depuis l'état réel du projet, pas depuis le texte initial. */
export function territorialProjectResolutionEffects(
  state: WorldState,
  program: ActionProgram,
  result: 'succeeded' | 'partially_succeeded' | 'failed',
): WorldEffect[] | undefined {
  const project = program.territorialProjectId ? state.territorialProjects?.[program.territorialProjectId] : undefined;
  if (!project) return undefined;
  const successFactor = result === 'succeeded' ? 1 : result === 'partially_succeeded' ? 0.45 : 0;
  const qualityFactor = clamp((project.outputPotential + project.socialAcceptance + project.environmentalSafeguards + project.securityControl) / 400, 0.2, 1);
  const capacityGain = Number((8 * successFactor * qualityFactor).toFixed(2));
  const employmentGain = Number((0.2 * successFactor * (0.6 + project.socialAcceptance / 250)).toFixed(3));
  const stabilityDelta = Number((((project.socialAcceptance - 50) / 25 - Math.max(0, project.risks.environment - project.environmentalSafeguards) / 45) * successFactor).toFixed(2));
  const securityDelta = Number((((project.securityControl - project.risks.security) / 45) * successFactor).toFixed(2));
  const unattendedDecision = project.pendingDecision;
  const baseOutcome = outcomeFor(project, result);
  const outcome = unattendedDecision ? {
    ...baseOutcome,
    political: `${baseOutcome.political} L’arbitrage « ${unattendedDecision.title} » n’a pas été tranché avant la mise en service : ses pénalités restent inscrites dans le bilan gouvernemental.`,
    environmental: `${baseOutcome.environmental} L’absence de décision explicite a laissé le risque suivre le chantier jusqu’à son terme.`,
  } : baseOutcome;
  const dossier = state.strategicDossiers[project.dossierId];
  const observers = marketObserversForProject(state, project);
  const marketSignal = Number(((
    (project.environmentalSafeguards - project.risks.environment) * 0.05
    + (project.securityControl - project.risks.security) * 0.025
    + (project.socialAcceptance - 50) * 0.02
  ) * successFactor).toFixed(2));
  const worldSummary = result === 'failed'
    ? `Le projet ${resourceWithArticle(project.resource)} en ${project.territoryName} est arrêté : aucune nouvelle capacité extractive n’entre en service, mais ses dépenses et tensions territoriales restent au bilan.`
    : `${result === 'succeeded' ? 'Mise en service' : 'Mise en service partielle'} d’une capacité ${project.scale === 'pilot' ? 'pilote' : project.scale === 'regional' ? 'régionale' : 'industrielle'} ${resourceWithArticle(project.resource)} en ${project.territoryName}. Les garanties environnementales, la sécurité et l’acceptation locale déterminent sa crédibilité commerciale.`;
  return [
    { kind: 'territorial_project_patch', projectId: project.id, patch: {
      status: result, phase: result === 'failed' ? 'closed' : 'operating', progressPct: 100,
      updatedAt: state.currentDate, outcome, pendingDecision: undefined,
      eventHistory: unattendedDecision ? project.eventHistory.map((event) => event.id === unattendedDecision.id
        ? { ...event, selectedOptionId: 'unresolved', selectedOptionLabel: 'Aucun arbitrage avant la résolution', summary: `${event.summary} Aucun arbitrage n’a été rendu avant la résolution ; le chantier a continué sous pénalité.` }
        : event) : project.eventHistory,
    }, reason: outcome.economic, visibility: 'player' },
    ...(capacityGain > 0 ? [{ kind: 'aggregate_sector_delta' as const, countryId: project.actorId, sector: 'extractive' as const, delta: { capacityIndex: capacityGain, productivityIndex: Number((capacityGain * 0.32).toFixed(2)), employmentSharePct: employmentGain }, reason: outcome.economic }] : []),
    ...(stabilityDelta ? [{ kind: 'metric_delta' as const, countryId: project.actorId, metric: 'stability' as const, delta: stabilityDelta, reason: outcome.social }] : []),
    ...(securityDelta ? [{ kind: 'metric_delta' as const, countryId: project.actorId, metric: 'security' as const, delta: securityDelta, reason: outcome.security }] : []),
    ...(result !== 'failed' ? [{ kind: 'fiscal_delta' as const, countryId: project.actorId, bucket: 'recurring_costs' as const, delta: Number((0.35 + project.risks.environment / 180 + project.risks.security / 220).toFixed(2)), reason: 'Le contrôle environnemental, territorial et sécuritaire du site devient une charge annuelle explicite.' }] : []),
    ...internationalSignalEffects(state, project, marketSignal, 'Les partenaires commerciaux ajustent marginalement leur confiance à la traçabilité et aux garanties du projet territorial.'),
    { kind: 'world_event_add' as const, event: {
      id: `${project.id}:world-outcome`, date: state.currentDate,
      title: result === 'failed' ? `Projet extractif arrêté · ${project.territoryName}` : `Nouvelle capacité extractive · ${project.territoryName}`,
      summary: worldSummary, dossierId: project.dossierId, importance: result === 'failed' ? 'major' : 'moderate', scope: 'world',
      actorIds: [project.actorId, ...observers], source: 'player', territoryId: project.territoryId, anchor: project.anchor,
    }, reason: 'Le résultat territorial devient un fait économique et commercial visible à l’échelle mondiale.', visibility: 'player' as const },
    ...(dossier ? [
      { kind: 'dossier_patch' as const, dossierId: project.dossierId, patch: { phase: result === 'failed' ? 'Projet arrêté' : 'Site en exploitation', updatedAt: state.currentDate }, reason: outcome.economic, visibility: 'player' as const },
      { kind: 'dossier_entry_add' as const, dossierId: project.dossierId, entry: {
        id: `${project.id}:outcome`, date: state.currentDate, title: result === 'failed' ? 'Projet minier arrêté' : 'Mise en service du projet minier',
        summary: [outcome.economic, outcome.social, outcome.environmental, outcome.security, outcome.governance].join(' '),
        importance: 'major' as const, actorIds: [project.actorId], requiresDecision: false, visibility: 'player' as const,
      }, reason: 'Le bilan transversal du projet est versé au dossier.', visibility: 'player' as const },
      ...(unattendedDecision ? [{ kind: 'dossier_patch' as const, dossierId: project.dossierId, patch: {
        pendingDecisions: dossier.pendingDecisions.filter((item) => item !== unattendedDecision.factualBrief),
      }, reason: 'La mise en service clôt l’arbitrage devenu sans objet, sans effacer ses conséquences.', visibility: 'player' as const }, {
        kind: 'dossier_entry_add' as const, dossierId: project.dossierId, entry: {
          id: `${unattendedDecision.id}:unresolved`, date: state.currentDate, title: 'Arbitrage laissé sans réponse',
          summary: `Le chantier a continué sans décision sur « ${unattendedDecision.title} ». Les pénalités de délai, coût et risque sont intégrées au bilan final.`,
          importance: 'moderate' as const, actorIds: [project.actorId], requiresDecision: false, visibility: 'player' as const,
        }, reason: 'Le dossier conserve la trace de l’inaction du gouvernement.', visibility: 'player' as const },] : []),
    ] : []),
  ];
}
