import type {
  AIJob,
  AIJobBudgetTier,
  AIJobKind,
  CountryId,
  ISODate,
  Visibility,
  WorldState,
} from '../types';

export type AIContextDomain =
  | 'overview'
  | 'economy'
  | 'energy'
  | 'industry'
  | 'diplomacy'
  | 'politics'
  | 'military'
  | 'history'
  | 'dossier'
  | 'actor'
  | 'capacity';

export type AIContextVisibility = 'public' | 'internal' | 'secret';

export type AIContextFact = {
  id: string;
  domain: AIContextDomain;
  entityIds: string[];
  topicTags: string[];
  observedAt: ISODate;
  importance: number;
  confidence: number;
  visibility: AIContextVisibility;
  ownerCountryId?: CountryId;
  sourcePath: string;
  statement: string;
  causalFactIds?: string[];
};

export type AIContextQuery = {
  jobKind: AIJobKind;
  perspectiveCountryId: CountryId;
  actorId: string;
  targetIds: string[];
  domains: AIContextDomain[];
  topicTags: string[];
  purpose: string;
  tokenBudget: number;
};

export type AIContextPacket = {
  schemaVersion: 1;
  compiledAt: ISODate;
  query: AIContextQuery;
  overview: string;
  facts: AIContextFact[];
  omittedFactCount: number;
  approximateInputTokens: number;
};

const budgetTokens: Record<AIJobBudgetTier, number> = {
  economy: 3_500,
  standard: 9_000,
  deep: 18_000,
};

const domainsByKind: Record<AIJobKind, AIContextDomain[]> = {
  advisor: ['overview', 'economy', 'energy', 'industry', 'diplomacy', 'politics', 'military', 'dossier', 'capacity'],
  diplomacy: ['overview', 'diplomacy', 'economy', 'energy', 'industry', 'military', 'dossier', 'capacity'],
  historical_interpretation: ['overview', 'history', 'politics', 'economy', 'dossier', 'actor'],
  power_struggle: ['overview', 'politics', 'actor', 'dossier', 'capacity', 'economy'],
  free_action_interpretation: ['overview', 'politics', 'diplomacy', 'economy', 'energy', 'industry', 'military', 'history', 'dossier', 'capacity'],
};

const words = (value: string) => value
  .toLocaleLowerCase('fr')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9]+/)
  .filter((word) => word.length > 2);

const compact = (value: unknown, maximum = 600) => String(value).replace(/\s+/g, ' ').trim().slice(0, maximum);
const approximateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 3.6);

const fact = (
  state: WorldState,
  input: Omit<AIContextFact, 'observedAt'> & { observedAt?: ISODate },
): AIContextFact => ({ ...input, observedAt: input.observedAt ?? state.currentDate });

function collectFacts(state: WorldState): AIContextFact[] {
  const facts: AIContextFact[] = [];
  const add = (input: Omit<AIContextFact, 'observedAt'> & { observedAt?: ISODate }) => facts.push(fact(state, input));

  add({ id: 'world:date', domain: 'overview', entityIds: [], topicTags: ['date', 'monde'], importance: 100, confidence: 100, visibility: 'public', sourcePath: 'currentDate', statement: `La date de simulation est le ${state.currentDate}.` });
  add({ id: 'world:economy', domain: 'economy', entityIds: [], topicTags: ['cycle', 'croissance', 'inflation'], importance: 86, confidence: 92, visibility: 'public', sourcePath: 'worldEconomy', statement: `Cycle mondial ${state.worldEconomy.cycle}; croissance ${state.worldEconomy.globalGrowthAnnualPct.toFixed(2)} %, inflation ${state.worldEconomy.globalInflationAnnualPct.toFixed(2)} %, stress financier ${state.worldEconomy.financialStress.toFixed(1)}/100.` });

  for (const country of Object.values(state.countries)) {
    const macro = state.macroEconomies[country.id];
    add({ id: `country:${country.id}:identity`, domain: 'overview', entityIds: [country.id], topicTags: ['pays', 'gouvernement'], importance: 96, confidence: country.statisticalReliability, visibility: 'public', sourcePath: `countries.${country.id}`, statement: `${country.name} — ${country.politics.regime}; gouvernement ${country.politics.governmentLabel}; approbation publique ${country.politics.publicApproval.toFixed(0)}/100.` });
    add({ id: `country:${country.id}:doctrine`, domain: 'politics', entityIds: [country.id], topicTags: ['doctrine', 'ideologie', 'gouvernement'], importance: 84, confidence: 90, visibility: 'public', sourcePath: `countries.${country.id}.politics.doctrine`, statement: `Doctrine du gouvernement de ${country.name}: économie ${country.politics.doctrine.economic}, social ${country.politics.doctrine.social}, souveraineté ${country.politics.doctrine.sovereignty}, sécurité ${country.politics.doctrine.security}.` });
    add({ id: `country:${country.id}:strategy`, domain: 'politics', entityIds: [country.id, ...country.strategy.partners, ...country.strategy.rivals], topicTags: ['strategie', 'objectifs', 'lignes rouges'], importance: 88, confidence: 100, visibility: 'secret', ownerCountryId: country.id, sourcePath: `countries.${country.id}.strategy`, statement: `Stratégie de ${country.name}: objectifs ${country.strategy.goals.filter((goal) => goal.status === 'active').map((goal) => goal.label).join(', ') || 'aucun'}; vulnérabilités ${country.strategy.vulnerabilities.join(', ') || 'non documentées'}; lignes rouges ${country.strategy.redLines.join(', ') || 'non documentées'}.` });
    for (const [domain, capacity] of Object.entries(country.capacities)) add({ id: `country:${country.id}:capacity:${domain}`, domain: 'capacity', entityIds: [country.id], topicTags: ['capacite', domain], importance: 76, confidence: 100, visibility: 'internal', ownerCountryId: country.id, sourcePath: `countries.${country.id}.capacities.${domain}`, statement: `${country.name}: capacité ${domain} engagée à ${capacity.committed.toFixed(0)} sur ${capacity.maximum.toFixed(0)}.` });
    if (macro) add({ id: `country:${country.id}:macro`, domain: 'economy', entityIds: [country.id], topicTags: ['pib', 'croissance', 'inflation', 'chomage', 'dette'], importance: 92, confidence: macro.source.confidence, visibility: 'public', sourcePath: `macroEconomies.${country.id}`, observedAt: macro.lastUpdatedAt, statement: `${country.name}: PIB réel ${macro.realGdpBillion2000Usd.toFixed(1)} Md$ 2000; croissance ${macro.realGrowthAnnualPct.toFixed(2)} %; inflation ${macro.inflationAnnualPct.toFixed(2)} %; chômage ${macro.unemploymentPct.toFixed(2)} %; dette publique ${macro.publicDebtPctGdp.toFixed(1)} % du PIB; solde budgétaire ${macro.fiscalBalancePctGdp.toFixed(1)} %.` });
    const energy = state.countryEnergy[country.id];
    if (energy) add({ id: `country:${country.id}:energy`, domain: 'energy', entityIds: [country.id], topicTags: ['petrole', 'gaz', 'stocks', 'dependance'], importance: 84, confidence: country.statisticalReliability, visibility: 'public', sourcePath: `countryEnergy.${country.id}`, statement: `${country.name}: pétrole demande/production/stocks ${energy.annualDemand.oil}/${energy.domesticProduction.oil}/${energy.strategicStocks.oil}; gaz ${energy.annualDemand.gas}/${energy.domesticProduction.gas}/${energy.strategicStocks.gas}.` });
  }

  for (const [key, relation] of Object.entries(state.relations)) add({ id: `relation:${key}`, domain: 'diplomacy', entityIds: [relation.from, relation.to], topicTags: ['relation', 'confiance', 'commerce', 'securite'], importance: 82, confidence: 95, visibility: 'public', sourcePath: `relations.${key}`, statement: `${relation.from} → ${relation.to}: relation ${relation.relation.toFixed(0)}, confiance ${relation.trust.toFixed(0)}, commerce ${relation.tradeIntensity.toFixed(0)}, alignement sécuritaire ${relation.securityAlignment.toFixed(0)}.` });
  for (const node of Object.values(state.energyNodes)) add({ id: `energy-node:${node.id}`, domain: 'energy', entityIds: [node.countryId], topicTags: [node.resource, 'production', 'capacite', 'reserves'], importance: 72, confidence: 82, visibility: 'public', sourcePath: `energyNodes.${node.id}`, statement: `${node.label} (${node.countryId}, ${node.resource}): production ${node.annualProduction}, capacité ${node.annualCapacity}, réserves prouvées ${node.provenReserves}, coût d'extraction ${node.extractionCost}.` });
  for (const contract of Object.values(state.energyContracts)) add({ id: `energy-contract:${contract.id}`, domain: 'energy', entityIds: [contract.sellerId, contract.buyerId], topicTags: [contract.resource, 'contrat', 'importation', 'exportation'], importance: 78, confidence: 95, visibility: contract.status === 'active' ? 'public' : 'internal', ownerCountryId: contract.buyerId, sourcePath: `energyContracts.${contract.id}`, statement: `Contrat ${contract.resource} ${contract.sellerId} → ${contract.buyerId}: volume annuel ${contract.annualVolume}, statut ${contract.status}, échéance ${contract.endDate}.` });
  for (const sector of Object.values(state.sectors)) add({ id: `sector:${sector.id}`, domain: 'industry', entityIds: [sector.countryId], topicTags: [sector.sector, 'industrie', 'capacite'], importance: 74, confidence: 88, visibility: 'public', sourcePath: `sectors.${sector.id}`, statement: `${sector.countryId}, secteur ${sector.sector}: capacité ${sector.capacity}, utilisation ${sector.utilization} %, charge ${sector.workloadMonths} mois, dépendance étrangère ${sector.foreignDependency}/100.` });
  for (const product of Object.values(state.armamentProducts)) add({ id: `armament:${product.id}`, domain: 'military', entityIds: [product.countryId, ...product.clients.map((client) => client.countryId)], topicTags: ['armement', product.family, 'production', 'export'], importance: 75, confidence: product.evidenceConfidence, visibility: 'public', sourcePath: `armamentProducts.${product.id}`, statement: `${product.name} (${product.manufacturer}): statut ${product.status}, capacité annuelle ${product.annualCapacity}, carnet ${product.backlogMonths} mois, maturité ${product.maturity}, expérience ${product.operationalExperience}.` });
  for (const current of Object.values(state.historicalCurrents)) if (current.playerVisibility !== 'hidden') add({ id: `history:${current.id}`, domain: 'history', entityIds: current.affectedActors, topicTags: ['histoire', 'tendance', ...current.drivers.flatMap(words).slice(0, 8)], importance: 80, confidence: current.playerVisibility === 'known' ? 90 : 58, visibility: current.playerVisibility === 'known' ? 'public' : 'internal', ownerCountryId: state.playerCountryId, sourcePath: `historicalCurrents.${current.id}`, statement: `${current.name}: pression ${current.pressure.toFixed(0)}/100, inertie ${current.inertia.toFixed(0)}, statut ${current.status}; moteurs ${current.drivers.join(', ')}.` });
  for (const process of Object.values(state.latentProcesses)) add({ id: `latent:${process.id}`, domain: 'history', entityIds: [process.actorId], topicTags: ['processus', 'latent', 'secret'], importance: 76, confidence: 75, visibility: 'secret', ownerCountryId: String(process.actorId), sourcePath: `latentProcesses.${process.id}`, statement: `Processus latent de ${process.actorId}: ${process.objective}; progrès ${process.progress}/100; statut ${process.status}.` });
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    add({ id: `dossier:${dossier.id}`, domain: 'dossier', entityIds: dossier.actorIds, topicTags: [dossier.kind, ...dossier.regionTags], importance: { minor: 45, moderate: 65, major: 85, critical: 100 }[dossier.importance], confidence: 90, visibility: 'public', sourcePath: `strategicDossiers.${dossier.id}`, observedAt: dossier.updatedAt, statement: `${dossier.title}: ${dossier.publicSummary} Phase ${dossier.phase}; tendance ${dossier.trend}.` });
    for (const entry of dossier.entries.slice(-4)) add({ id: `dossier-entry:${entry.id}`, domain: 'dossier', entityIds: entry.actorIds, topicTags: [dossier.kind, entry.importance], importance: { minor: 40, moderate: 60, major: 82, critical: 98 }[entry.importance], confidence: 90, visibility: entry.visibility === 'public' ? 'public' : entry.visibility === 'secret' ? 'secret' : 'internal', ownerCountryId: state.playerCountryId, sourcePath: `strategicDossiers.${dossier.id}.entries.${entry.id}`, observedAt: entry.date, statement: `${entry.title}: ${entry.summary}` });
  }
  for (const reaction of Object.values(state.stakeholderReactions ?? {})) add({ id: `reaction:${reaction.id}`, domain: 'actor', entityIds: [reaction.countryId, reaction.groupId, reaction.targetId], topicTags: ['defiance', 'groupe', reaction.level], importance: { low: 40, moderate: 60, important: 82, critical: 100 }[reaction.level], confidence: 92, visibility: reaction.visibility === 'public' ? 'public' : reaction.visibility === 'secret' ? 'secret' : 'internal', ownerCountryId: reaction.countryId, sourcePath: `stakeholderReactions.${reaction.id}`, observedAt: reaction.updatedAt, statement: `${reaction.label}: défiance ${reaction.level}, tendance ${reaction.trend}; causes ${reaction.causes.join(', ')}.` });
  for (const actor of Object.values(state.powerActors ?? {})) if (actor.visibility !== 'unknown') add({ id: `actor:${actor.id}`, domain: 'actor', entityIds: [actor.countryId, actor.id, actor.stakeholderGroupId], topicTags: ['personnalite', actor.role, ...actor.ideologyTags], importance: Math.max(50, actor.influence), confidence: actor.visibility === 'public' ? 95 : 65, visibility: actor.visibility === 'public' ? 'public' : 'internal', ownerCountryId: actor.countryId, sourcePath: `powerActors.${actor.id}`, observedAt: actor.updatedAt, statement: `${actor.name}, ${actor.position}: objectif immédiat ${actor.immediateObjective}; personnalité ${actor.personalityTags.join(', ')}.` });
  for (const change of state.ledger.slice(-80)) add({ id: `change:${change.id}`, domain: change.path.startsWith('macro') ? 'economy' : change.path.startsWith('relations') ? 'diplomacy' : change.path.startsWith('energy') ? 'energy' : change.path.includes('dossier') ? 'dossier' : 'overview', entityIds: [change.actorId], topicTags: ['changement', ...words(change.path)], importance: change.origin === 'player' ? 88 : 58, confidence: 100, visibility: change.visibility === 'public' ? 'public' : change.visibility === 'secret' ? 'secret' : 'internal', ownerCountryId: change.actorId, sourcePath: `ledger.${change.id}`, observedAt: change.date, statement: `${compact(change.reason, 360)} (${change.path}: ${compact(change.before, 80)} → ${compact(change.after, 120)}).` });
  return facts;
}

function canSee(state: WorldState, viewer: CountryId, item: AIContextFact) {
  if (item.visibility === 'public') return true;
  if (item.ownerCountryId === viewer) return true;
  if (!item.ownerCountryId) return false;
  const intelligence = state.intelligence[`${viewer}:${item.ownerCountryId}`] ?? 0;
  return item.visibility === 'internal' ? intelligence >= 65 : intelligence >= 85;
}

function monthsBetween(from: ISODate, to: ISODate) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
}

function scoreFact(state: WorldState, query: AIContextQuery, item: AIContextFact) {
  const entities = new Set([query.actorId, query.perspectiveCountryId, ...query.targetIds]);
  const topics = new Set(query.topicTags);
  const directEntities = item.entityIds.filter((id) => entities.has(id)).length;
  const topicMatches = item.topicTags.flatMap(words).filter((word) => topics.has(word)).length;
  const age = monthsBetween(item.observedAt, state.currentDate);
  return item.importance * 0.35
    + item.confidence * 0.12
    + (query.domains.includes(item.domain) ? 24 : 0)
    + Math.min(36, directEntities * 18)
    + Math.min(24, topicMatches * 6)
    + Math.max(0, 14 - age * 0.5);
}

export function queryForAIJob(state: WorldState, job: AIJob): AIContextQuery {
  const actorId = job.kind === 'power_struggle' ? job.countryId : job.actorId;
  const perspectiveCountryId = state.countries[actorId] ? actorId : state.playerCountryId;
  const purpose = job.purpose;
  const contextText = JSON.stringify(job.context);
  const targetIds = Object.keys(state.countries).filter((id) => id !== perspectiveCountryId && contextText.includes(id));
  return {
    jobKind: job.kind,
    perspectiveCountryId,
    actorId,
    targetIds,
    domains: domainsByKind[job.kind],
    topicTags: [...new Set(words(`${purpose} ${job.reasons.join(' ')} ${contextText}`))].slice(0, 40),
    purpose,
    tokenBudget: budgetTokens[job.budgetTier],
  };
}

/** Compile la vérité utile du moteur avant tout appel réseau. */
export function compileAIContext(state: WorldState, query: AIContextQuery): AIContextPacket {
  const visible = collectFacts(state).filter((item) => canSee(state, query.perspectiveCountryId, item));
  const ranked = visible
    .map((item) => ({ item, score: scoreFact(state, query, item) }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  const selected: AIContextFact[] = [];
  let used = approximateTokens({ query, overview: state.currentDate });
  const anchorIds = new Set([
    'world:date',
    'world:economy',
    `country:${query.perspectiveCountryId}:identity`,
    `country:${query.perspectiveCountryId}:strategy`,
    ...query.targetIds.map((id) => `country:${id}:identity`),
  ]);
  const ordered = [
    ...ranked.filter(({ item }) => anchorIds.has(item.id)),
    ...ranked.filter(({ item }) => !anchorIds.has(item.id)),
  ];
  for (const candidate of ordered) {
    const cost = approximateTokens(candidate.item);
    if (used + cost > query.tokenBudget) continue;
    selected.push(candidate.item);
    used += cost;
  }
  return {
    schemaVersion: 1,
    compiledAt: state.currentDate,
    query,
    overview: `${state.countries[query.perspectiveCountryId]?.name ?? query.perspectiveCountryId} raisonne au ${state.currentDate} pour « ${compact(query.purpose, 240)} ».` ,
    facts: selected,
    omittedFactCount: visible.length - selected.length,
    approximateInputTokens: used,
  };
}

export function compileContextForAIJob(state: WorldState, job: AIJob) {
  return compileAIContext(state, queryForAIJob(state, job));
}

export function visibilityFromWorld(value: Visibility): AIContextVisibility | null {
  if (value === 'public') return 'public';
  if (value === 'player' || value === 'secret') return value === 'secret' ? 'secret' : 'internal';
  return null;
}
