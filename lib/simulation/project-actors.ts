import type {
  TerritorialProject,
  TerritorialProjectActor,
  TerritorialProjectActorKind,
  TerritorialProjectActorStatus,
  TerritorialProjectDeliveryModel,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const statusRank: Record<TerritorialProjectActorStatus, number> = {
  watching: 0,
  consulting: 1,
  demanding: 2,
  opposing: 3,
  coercive: 4,
};

export const territorialActorStatusLabels: Record<TerritorialProjectActorStatus, string> = {
  watching: 'veille',
  consulting: 'demande de concertation',
  demanding: 'revendication active',
  opposing: 'opposition organisée',
  coercive: 'action de contrainte',
};

export function territorialIntegrationScore(state: WorldState, project: TerritorialProject) {
  const territory = state.territorial.territories[project.territoryId];
  if (!territory) return 55;
  const countryTerritories = Object.values(state.territorial.territories)
    .filter((item) => item.accountingCountryId === territory.accountingCountryId && item.population !== null);
  const population = territory.population ?? 0;
  const localIncome = population > 0 && territory.realGdpBillion2000Usd !== null
    ? territory.realGdpBillion2000Usd * 1e9 / population
    : undefined;
  const nationalIncome = countryTerritories.length
    ? countryTerritories.reduce((sum, item) => sum + (item.realGdpBillion2000Usd ?? 0), 0) * 1e9
      / Math.max(1, countryTerritories.reduce((sum, item) => sum + (item.population ?? 0), 0))
    : localIncome;
  const incomeGap = localIncome !== undefined && nationalIncome
    ? clamp((1 - localIncome / nationalIncome) * 100, -20, 70)
    : 20;
  const remoteness = territory.kind === 'overseas' ? 28 : territory.anchor ? 6 : 16;
  const administrativeDistance = territory.kind === 'overseas' ? 16 : 4;
  return clamp(76 - remoteness - administrativeDistance - incomeGap * 0.28 - (project.deliveryModel === 'private' ? 4 : 0));
}

type ActorSeed = {
  kind: TerritorialProjectActorKind;
  name: string;
  role: string;
  interest: string;
  demand: string;
  pressure: number;
  influence: number;
  leverage: number;
};

function actorSeeds(state: WorldState, project: TerritorialProject): ActorSeed[] {
  const integration = territorialIntegrationScore(state, project);
  const gap = 100 - integration;
  const privatePressure = project.deliveryModel === 'private' ? 12 : project.deliveryModel === 'mixed' ? 6 : 0;
  const publicPressure = project.deliveryModel === 'public' ? 5 : 0;
  const scalePressure = project.scale === 'industrial' ? 14 : project.scale === 'regional' ? 7 : 2;
  const claimantIds = (project.claimantEntityIds ?? []).filter((id) => id !== project.actorId && state.countries[id]);
  const seeds: ActorSeed[] = [
    {
      kind: 'central_state', name: 'État central', role: 'Cadre, financement et contrôle du projet',
      interest: 'Préserver la continuité du chantier et la légitimité de la décision nationale.',
      demand: 'Garanties de contrôle, de calendrier et de traçabilité.',
      pressure: clamp(34 + publicPressure + project.risks.finance * 0.18), influence: 88, leverage: 74,
    },
    {
      kind: 'local_authority', name: `Autorités locales · ${project.territoryName}`, role: 'Représentation du territoire d’implantation',
      interest: 'Obtenir des emplois, des infrastructures et une part visible des retombées.',
      demand: 'Assurances d’emplois locaux, de sous-traitance et de partage des recettes.',
      pressure: clamp(gap * 0.58 + project.risks.social_license * 0.28 + privatePressure), influence: 68, leverage: 64,
    },
  ];
  if (claimantIds.length && project.legalStatus && project.legalStatus !== 'undisputed') {
    const claimantNames = claimantIds.map((id) => state.countries[id]?.name ?? id).join(', ');
    seeds.push({
      kind: 'claimant_state', name: `États revendicateurs · ${claimantNames}`, role: 'Revendication de souveraineté, de rente ou d’accès au bassin',
      interest: 'Empêcher que l’exploitation locale transforme un partage contesté en fait accompli.',
      demand: 'Garantie de consultation, de partage ou de reconnaissance des droits revendiqués.',
      pressure: clamp(48 + (project.legalStatus === 'contested' ? 18 : 9) + scalePressure + privatePressure), influence: 78, leverage: 67,
    });
  }
  if (project.deliveryModel !== 'public') seeds.push({
    kind: 'operator', name: 'Opérateur privé et financeurs', role: 'Investissement, construction et exploitation',
    interest: 'Protéger la rentabilité, le calendrier et la sécurité juridique.',
    demand: 'Garanties de rentabilité, de sécurité et de stabilité réglementaire.',
    pressure: clamp(35 + project.risks.finance * 0.45 + scalePressure), influence: 72, leverage: 68,
  });
  if (project.deliveryModel !== 'private') seeds.push({
    kind: 'operator', name: 'Administration et opérateur public', role: 'Maîtrise d’ouvrage publique et contrôle du site',
    interest: 'Tenir la mission publique sans dépassement ni perte de contrôle.',
    demand: 'Moyens administratifs, personnels et calendrier réaliste.',
    pressure: clamp(31 + project.risks.logistics * 0.25 + project.risks.finance * 0.2), influence: 66, leverage: 57,
  });
  if (project.outputPotential >= 35) seeds.push({
    kind: 'labor', name: 'Salariés et sous-traitants locaux', role: 'Main-d’œuvre et chaîne de prestation',
    interest: 'Transformer l’investissement en emplois et qualifications durables.',
    demand: 'Formation, recrutement local et conditions de travail garanties.',
    pressure: clamp(30 + gap * 0.22 + scalePressure), influence: 55, leverage: 52,
  });
  if (project.risks.environment >= 48) seeds.push({
    kind: 'environmental', name: 'Associations environnementales et élus écologistes', role: 'Surveillance des dommages et de la conformité',
    interest: 'Réduire l’empreinte du projet et rendre les dommages opposables.',
    demand: 'Contre-expertise, transparence des données et garanties réparatrices.',
    pressure: clamp(project.risks.environment * 0.72 + scalePressure * 0.35), influence: 53, leverage: 46,
  });
  if (gap >= 30 || project.risks.environment >= 62 || project.deliveryModel === 'private') seeds.push({
    kind: 'political', name: 'Opposition nationale et groupes territoriaux', role: 'Mise en cause politique du partage de la rente',
    interest: 'Démontrer que le projet sert ou abandonne le territoire.',
    demand: 'Débat public, garanties de redistribution et contrôle parlementaire.',
    pressure: clamp(gap * 0.52 + project.risks.social_license * 0.22 + privatePressure), influence: 60, leverage: 49,
  });
  if (project.risks.security >= 55) seeds.push({
    kind: 'security_network', name: project.resource === 'or' ? 'Réseaux clandestins et orpaillage illégal' : 'Réseaux clandestins et flux informels', role: 'Contrôle informel des accès, flux et débouchés',
    interest: 'Préserver les revenus clandestins et l’accès aux circuits de production.',
    demand: 'Aucune demande institutionnelle fiable : pression sur les accès et les flux.',
    pressure: clamp(project.risks.security * 0.82 + project.outputPotential * 0.16), influence: 44, leverage: 71,
  });
  if (project.risks.finance >= 58 || project.risks.environment >= 72) seeds.push({
    kind: 'judiciary', name: 'Autorités de contrôle et justice', role: 'Enquête sur les dommages, marchés et détournements',
    interest: 'Rendre les irrégularités et les responsabilités vérifiables.',
    demand: 'Traçabilité des marchés, audits et accès aux données du projet.',
    pressure: clamp((project.risks.finance - 45) * 0.8 + (project.risks.environment - 50) * 0.45), influence: 76, leverage: 61,
  });
  return seeds;
}

export function projectGovernanceScore(state: WorldState, project: TerritorialProject) {
  const country = state.countries[project.actorId];
  const administrativeCompliance = country?.politics?.administrativeCompliance ?? 60;
  const integration = territorialIntegrationScore(state, project);
  const modelAdjustment = project.deliveryModel === 'mixed' ? 5 : project.deliveryModel === 'public' ? 2 : -4;
  return Number(clamp(
    administrativeCompliance * 0.42
    + integration * 0.24
    + project.securityControl * 0.14
    + (100 - project.risks.finance) * 0.2
    + modelAdjustment,
  ).toFixed(1));
}

export function projectLeakageRates(state: WorldState, project: TerritorialProject) {
  const governance = projectGovernanceScore(state, project);
  return {
    governanceScore: governance,
    budgetLeakagePct: Number(clamp((100 - governance) * 0.25 + project.risks.finance * 0.1, 0, 35).toFixed(1)),
    outputLeakagePct: Number(clamp((100 - governance) * 0.18 + project.risks.security * 0.12, 0, 30).toFixed(1)),
  };
}

function statusForPressure(pressure: number): TerritorialProjectActorStatus {
  if (pressure >= 82) return 'coercive';
  if (pressure >= 66) return 'opposing';
  if (pressure >= 50) return 'demanding';
  if (pressure >= 34) return 'consulting';
  return 'watching';
}

function actorId(projectId: string, kind: TerritorialProjectActorKind) {
  return `${projectId}:actor:${kind}`;
}

export function createTerritorialProjectActors(state: WorldState, project: TerritorialProject): TerritorialProjectActor[] {
  return actorSeeds(state, project).map((seed) => ({
    id: actorId(project.id, seed.kind),
    kind: seed.kind,
    name: seed.name,
    role: seed.role,
    interest: seed.interest,
    demand: seed.demand,
    status: 'watching',
    influence: seed.influence,
    leverage: seed.leverage,
    pressure: Number(seed.pressure.toFixed(1)),
    notifiedStatuses: [],
    lastUpdatedAt: state.currentDate,
  }));
}

export function refreshTerritorialProjectActors(state: WorldState, project: TerritorialProject) {
  const previous = new Map((project.actors ?? []).map((actor) => [actor.kind, actor]));
  const actors = actorSeeds(state, project).map((seed) => {
    const old = previous.get(seed.kind);
    const status = statusForPressure(seed.pressure);
    const notifiedStatuses = old?.notifiedStatuses ?? [];
    return {
      id: old?.id ?? actorId(project.id, seed.kind), kind: seed.kind, name: seed.name, role: seed.role,
      interest: seed.interest, demand: seed.demand, status,
      influence: seed.influence, leverage: seed.leverage, pressure: Number(seed.pressure.toFixed(1)),
      notifiedStatuses, lastUpdatedAt: state.currentDate,
    } satisfies TerritorialProjectActor;
  });
  const escalations = actors.filter((actor) => {
    const old = previous.get(actor.kind);
    const previousRank = old ? statusRank[old.status] : 0;
    return statusRank[actor.status] >= 2
      && statusRank[actor.status] > previousRank
      && !actor.notifiedStatuses.includes(actor.status);
  });
  const marked = actors.map((actor) => escalations.some((item) => item.id === actor.id)
    ? { ...actor, notifiedStatuses: [...actor.notifiedStatuses, actor.status] }
    : actor);
  return { actors: marked, escalations };
}

export function actorEscalationText(actor: TerritorialProjectActor, project: TerritorialProject) {
  const state = territorialActorStatusLabels[actor.status];
  return `${actor.name} passe au stade « ${state} » sur le projet ${project.resource === 'or' ? 'd’or' : `de ${project.resource}`} en ${project.territoryName}. ${actor.demand}`;
}

export function deliveryModelLabel(model: TerritorialProjectDeliveryModel) {
  return model === 'public' ? 'Maîtrise publique' : model === 'private' ? 'Concession privée' : 'Société mixte';
}
