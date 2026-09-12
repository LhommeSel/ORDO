import type {
  AIJob,
  AIJobBudgetTier,
  AIJobKind,
  CountryId,
  ISODate,
  Visibility,
  WorldState,
} from '../types';
import { militaryBasesForCountry, militaryTheatersForCountry } from '../military-theaters';
import { warZonesForCountry } from '../war-zones';

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
  /** Concepts canoniques utilisés pour la proximité sémantique locale. */
  concepts: string[];
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
  requestingCountryId: CountryId;
  decisionCountryId: CountryId;
  actorId: string;
  targetIds: string[];
  domains: AIContextDomain[];
  topicTags: string[];
  concepts: string[];
  purpose: string;
  playerIntent: string;
  approximateIntentTokens: number;
  tokenBudget: number;
};

export type AIContextReserveFact = AIContextFact & { accessScope: 'known' | 'private' };

export type AIContextPacket = {
  schemaVersion: 1;
  compiledAt: ISODate;
  query: AIContextQuery;
  overview: string;
  /** Ce que le pays demandeur est autorisé à connaître. */
  knownFacts: AIContextFact[];
  /** Vérité privée du pays qui prend la décision, jamais destinée à l'interface joueur. */
  privateDecisionFacts: AIContextFact[];
  /** Réserve non envoyée au premier passage, consultable une seule fois par outil. */
  reserveFacts: AIContextReserveFact[];
  omittedFactCount: number;
  approximateInputTokens: number;
  approximateTotalInputTokens: number;
};

const budgetTokens: Record<AIJobBudgetTier, number> = {
  economy: 3_500,
  standard: 10_000,
  deep: 25_000,
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

const conceptLexicon: Record<string, string> = {
  gaz: 'energy.gas', gas: 'energy.gas', gazier: 'energy.gas', gaziere: 'energy.gas',
  petrole: 'energy.oil', petrolier: 'energy.oil', oil: 'energy.oil', hydrocarbure: 'energy.resource',
  energie: 'energy.resource', energetique: 'energy.resource', production: 'production.capacity',
  reserves: 'energy.reserves', stocks: 'energy.stock', stockage: 'energy.stock',
  consommation: 'demand', demande: 'demand', route: 'logistics.route', transit: 'logistics.route', gazoduc: 'logistics.route', pipeline: 'logistics.route',
  contrat: 'trade.contract', commercial: 'trade.contract', commerce: 'trade.contract', exportation: 'trade.export', importation: 'trade.import',
  negocier: 'diplomacy.negotiation', negotiation: 'diplomacy.negotiation', diplomatie: 'diplomacy.negotiation',
  relation: 'diplomacy.relation', confiance: 'diplomacy.relation', alliance: 'diplomacy.alliance', reddition: 'diplomacy.surrender',
  strategie: 'politics.strategy', objectif: 'politics.strategy', objectifs: 'politics.strategy', vulnerabilites: 'politics.fear', crainte: 'politics.fear',
  doctrine: 'politics.doctrine', ideologie: 'politics.doctrine', gouvernement: 'politics.government', parlement: 'politics.institution',
  defiance: 'politics.stakeholder', groupe: 'politics.stakeholder', personnalite: 'politics.personality',
  pib: 'economy.macro', croissance: 'economy.macro', inflation: 'economy.macro', chomage: 'economy.macro', dette: 'economy.debt', budget: 'economy.budget',
  industrie: 'industry.capacity', industriel: 'industry.capacity', semiconductors: 'industry.semiconductors', nuclear: 'industry.nuclear',
  armement: 'military.armament', defense: 'military.armament', militaire: 'military.armament', securite: 'military.security',
  histoire: 'history.current', tendance: 'history.current', processus: 'history.latent', latent: 'history.latent',
  dossier: 'dossier.current', conflit: 'dossier.conflict', crise: 'dossier.crisis',
  administration: 'capacity.administration', intelligence: 'capacity.intelligence', government: 'capacity.government', diplomacy: 'capacity.diplomacy', economy: 'capacity.economy',
};

/** Petit graphe transversal : il décrit les relations entre concepts, jamais des cas pays par pays. */
const conceptEdges: Record<string, string[]> = {
  'energy.gas': ['energy.resource', 'production.capacity', 'demand', 'energy.stock', 'energy.reserves', 'logistics.route', 'trade.contract'],
  'energy.oil': ['energy.resource', 'production.capacity', 'demand', 'energy.stock', 'energy.reserves', 'logistics.route', 'trade.contract'],
  'energy.resource': ['energy.gas', 'energy.oil', 'trade.contract', 'economy.macro'],
  'trade.contract': ['diplomacy.negotiation', 'diplomacy.relation', 'trade.export', 'trade.import', 'logistics.route'],
  'diplomacy.negotiation': ['diplomacy.relation', 'politics.strategy', 'politics.doctrine', 'capacity.diplomacy', 'trade.contract'],
  'diplomacy.alliance': ['diplomacy.negotiation', 'diplomacy.relation', 'military.security', 'politics.strategy'],
  'diplomacy.surrender': ['diplomacy.negotiation', 'military.security', 'politics.strategy'],
  'politics.strategy': ['politics.fear', 'politics.doctrine', 'diplomacy.relation'],
  'politics.stakeholder': ['politics.government', 'politics.personality', 'dossier.current'],
  'economy.macro': ['economy.debt', 'economy.budget', 'industry.capacity', 'trade.contract'],
  'industry.capacity': ['production.capacity'],
  'military.armament': ['military.security', 'production.capacity'],
  'history.current': ['history.latent', 'dossier.current', 'dossier.crisis'],
  'dossier.conflict': ['dossier.current', 'military.security', 'diplomacy.negotiation'],
  'dossier.crisis': ['dossier.current', 'economy.macro', 'politics.stakeholder'],
};

const symmetricConceptEdges = (() => {
  const graph = new Map<string, Set<string>>();
  for (const [from, tos] of Object.entries(conceptEdges)) for (const to of tos) {
    if (!graph.has(from)) graph.set(from, new Set());
    if (!graph.has(to)) graph.set(to, new Set());
    graph.get(from)!.add(to);
    graph.get(to)!.add(from);
  }
  return graph;
})();

export function conceptsFromText(value: string) {
  return [...new Set(words(value).map((word) => conceptLexicon[word]).filter((item): item is string => Boolean(item)))];
}

function conceptDistance(queryConcepts: string[], factConcepts: string[]) {
  if (!queryConcepts.length || !factConcepts.length) return Number.POSITIVE_INFINITY;
  const targets = new Set(factConcepts);
  if (queryConcepts.some((item) => targets.has(item))) return 0;
  let frontier = new Set(queryConcepts);
  const visited = new Set(frontier);
  for (let distance = 1; distance <= 2; distance += 1) {
    const next = new Set<string>();
    for (const item of frontier) for (const neighbor of symmetricConceptEdges.get(item) ?? []) {
      if (targets.has(neighbor)) return distance;
      if (!visited.has(neighbor)) { visited.add(neighbor); next.add(neighbor); }
    }
    frontier = next;
  }
  return Number.POSITIVE_INFINITY;
}

function domainCanParticipate(query: AIContextQuery, item: AIContextFact) {
  const guardedNamespace: Partial<Record<AIContextDomain, string>> = {
    energy: 'energy.',
    industry: 'industry.',
    military: 'military.',
  };
  const namespace = guardedNamespace[item.domain];
  return !namespace || query.concepts.some((concept) => concept.startsWith(namespace));
}

const compact = (value: unknown, maximum = 600) => String(value).replace(/\s+/g, ' ').trim().slice(0, maximum);
const approximateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 3.6);

type AIContextFactInput = Omit<AIContextFact, 'observedAt' | 'concepts'> & { observedAt?: ISODate; concepts?: string[] };

const fact = (
  state: WorldState,
  input: AIContextFactInput,
): AIContextFact => ({
  ...input,
  concepts: [...new Set([...(input.concepts ?? []), ...conceptsFromText(`${input.domain} ${input.topicTags.join(' ')} ${input.statement}`)])],
  observedAt: input.observedAt ?? state.currentDate,
});

/**
 * Inventaire canonique des faits du monde. Les compilateurs spécialisés (conseil,
 * négociation, pouls mondial) partent tous de cette même vérité plutôt que de
 * reconstruire chacun leur propre lecture de la sauvegarde.
 */
export function collectFacts(state: WorldState): AIContextFact[] {
  const facts: AIContextFact[] = [];
  const add = (input: AIContextFactInput) => facts.push(fact(state, input));

  add({ id: 'world:date', domain: 'overview', entityIds: [], topicTags: ['date', 'monde'], importance: 100, confidence: 100, visibility: 'public', sourcePath: 'currentDate', statement: `La date de simulation est le ${state.currentDate}.` });
  add({ id: 'world:economy', domain: 'economy', entityIds: [], topicTags: ['cycle', 'croissance', 'inflation'], importance: 86, confidence: 92, visibility: 'public', sourcePath: 'worldEconomy', statement: `Cycle mondial ${state.worldEconomy.cycle}; croissance ${state.worldEconomy.globalGrowthAnnualPct.toFixed(2)} %, inflation ${state.worldEconomy.globalInflationAnnualPct.toFixed(2)} %, stress financier ${state.worldEconomy.financialStress.toFixed(1)}/100.` });

  for (const country of Object.values(state.countries)) {
    const macro = state.macroEconomies[country.id];
    add({ id: `country:${country.id}:identity`, domain: 'overview', entityIds: [country.id], topicTags: ['pays', 'gouvernement'], importance: 96, confidence: country.statisticalReliability, visibility: 'public', sourcePath: `countries.${country.id}`, statement: `${country.name} — ${country.politics.regime}; gouvernement ${country.politics.governmentLabel}; approbation publique ${country.politics.publicApproval.toFixed(0)}/100.` });
    add({ id: `country:${country.id}:doctrine`, domain: 'politics', entityIds: [country.id], topicTags: ['doctrine', 'ideologie', 'gouvernement'], importance: 84, confidence: 90, visibility: 'public', sourcePath: `countries.${country.id}.politics.doctrine`, statement: `Doctrine du gouvernement de ${country.name}: économie ${country.politics.doctrine.economic}, social ${country.politics.doctrine.social}, souveraineté ${country.politics.doctrine.sovereignty}, sécurité ${country.politics.doctrine.security}.` });
    add({ id: `country:${country.id}:strategy`, domain: 'politics', entityIds: [country.id, ...country.strategy.partners, ...country.strategy.rivals], topicTags: ['strategie', 'objectifs', 'lignes rouges'], importance: 88, confidence: 100, visibility: 'secret', ownerCountryId: country.id, sourcePath: `countries.${country.id}.strategy`, statement: `Stratégie de ${country.name}: objectifs ${country.strategy.goals.filter((goal) => goal.status === 'active').map((goal) => goal.label).join(', ') || 'aucun'}; vulnérabilités ${country.strategy.vulnerabilities.join(', ') || 'non documentées'}; lignes rouges ${country.strategy.redLines.join(', ') || 'non documentées'}.` });
    const leadership = state.leadership?.[country.id];
    if (leadership) add({ id: `country:${country.id}:leadership`, domain: 'politics', entityIds: [country.id, ...leadership.figures.map((figure) => figure.id)], topicTags: ['dirigeant', 'personnalite', 'gouvernement'], importance: 91, confidence: 78, visibility: 'public', sourcePath: `leadership.${country.id}`, statement: `Direction effective de ${country.name}: ${leadership.figures.map((figure) => `${figure.name} (${figure.role}, autorité ${figure.authorityShare} %; ${figure.ideologyTags.join(', ')})`).join(' ; ')}. Coordination exécutive ${leadership.executiveCoordination}/100.` });
    const politicalCycle = state.politicalCycles?.[country.id];
    if (politicalCycle) add({ id: `country:${country.id}:political-cycle`, domain: 'politics', entityIds: [country.id], topicTags: ['election', 'mandat', 'succession', 'gouvernement'], importance: politicalCycle.status === 'campaign' ? 90 : 69, confidence: 100, visibility: 'public', sourcePath: `politicalCycles.${country.id}`, observedAt: state.currentDate, statement: `Cycle politique de ${country.name}: mode ${politicalCycle.mode}, prochaine échéance ${politicalCycle.nextReviewDate}, statut ${politicalCycle.status}${politicalCycle.lastOutcome ? `, dernier résultat ${politicalCycle.lastOutcome} avec un soutien ${politicalCycle.lastSupportScore ?? 'non chiffré'}/100` : ''}.` });
    const apparatus = state.politicalApparatus?.[country.id];
    if (apparatus) add({ id: `country:${country.id}:apparatus`, domain: 'politics', entityIds: [country.id, ...apparatus.currents.map((current) => current.id)], topicTags: ['parlement', 'administration', 'elites', 'appareil politique'], importance: 87, confidence: 75, visibility: 'secret', ownerCountryId: country.id, sourcePath: `politicalApparatus.${country.id}`, statement: `Appareil politique de ${country.name}: ${apparatus.currents.map((current) => `${current.label} (poids ${current.weight}, implantation ${current.institutionalReach})`).join(' ; ')}. Inertie ${apparatus.inertia}/100, pluralisme ${apparatus.pluralism}/100.` });
    for (const [domain, capacity] of Object.entries(country.capacities)) add({ id: `country:${country.id}:capacity:${domain}`, domain: 'capacity', entityIds: [country.id], topicTags: ['capacite', domain], importance: 76, confidence: 100, visibility: 'internal', ownerCountryId: country.id, sourcePath: `countries.${country.id}.capacities.${domain}`, statement: `${country.name}: capacité ${domain} engagée à ${capacity.committed.toFixed(0)} sur ${capacity.maximum.toFixed(0)}.` });
    if (macro) add({ id: `country:${country.id}:macro`, domain: 'economy', entityIds: [country.id], topicTags: ['pib', 'croissance', 'inflation', 'chomage', 'dette'], importance: 92, confidence: macro.source.confidence, visibility: 'public', sourcePath: `macroEconomies.${country.id}`, observedAt: macro.lastUpdatedAt, statement: `${country.name}: PIB réel ${macro.realGdpBillion2000Usd.toFixed(1)} Md$ 2000; croissance ${macro.realGrowthAnnualPct.toFixed(2)} %; inflation ${macro.inflationAnnualPct.toFixed(2)} %; chômage ${macro.unemploymentPct.toFixed(2)} %; dette publique ${macro.publicDebtPctGdp.toFixed(1)} % du PIB; solde budgétaire ${macro.fiscalBalancePctGdp.toFixed(1)} %.` });
    const energy = state.countryEnergy[country.id];
    if (energy) add({ id: `country:${country.id}:energy`, domain: 'energy', entityIds: [country.id], topicTags: ['petrole', 'gaz', 'stocks', 'dependance'], importance: 84, confidence: country.statisticalReliability, visibility: 'public', sourcePath: `countryEnergy.${country.id}`, statement: `${country.name}: pétrole demande/production/stocks ${energy.annualDemand.oil}/${energy.domesticProduction.oil}/${energy.strategicStocks.oil}; gaz ${energy.annualDemand.gas}/${energy.domesticProduction.gas}/${energy.strategicStocks.gas}.` });
    const militaryTheaters = militaryTheatersForCountry(state, country.id);
    if (militaryTheaters.length) add({
      id: `country:${country.id}:military-theaters`, domain: 'military',
      entityIds: [country.id, ...militaryTheaters.flatMap((theater) => theater.hostCountryIds)],
      topicTags: ['militaire', 'deploiement', 'theatre', 'ravitaillement'],
      importance: 84, confidence: 100, visibility: 'public',
      sourcePath: `militaryTheaters.${country.id}`,
      statement: `${country.name}: ${militaryTheaters.map((theater) => `${theater.location} ${theater.personnelThousands.toFixed(1)} k, disponibles ${theater.availablePersonnelThousands.toFixed(1)} k, préparation ${theater.readiness}/100, ravitaillement ${theater.supplyCoverageMonths.toFixed(1)} mois${theater.currentOperation ? `, opération jusqu'au ${theater.currentOperation.completesAt}` : ''}`).join(' ; ')}.`,
    });
    const militaryBases = militaryBasesForCountry(state, country.id);
    if (militaryBases.length) add({
      id: `country:${country.id}:military-bases`, domain: 'military',
      entityIds: [country.id, ...militaryBases.map((base) => base.hostCountryId)],
      topicTags: ['militaire', 'base', 'stationnement', 'acces'],
      importance: 86, confidence: 100, visibility: 'public',
      sourcePath: `militaryBases.${country.id}`,
      statement: `${country.name}: ${militaryBases.map((base) => `base ${base.location} (${base.hostCountryId}), ${base.assignedPersonnelThousands.toFixed(1)} k/${base.capacityThousands.toFixed(1)} k, statut ${base.status}, accès ${base.access}`).join(' ; ')}.`,
    });
    const warZones = warZonesForCountry(state, country.id);
    if (warZones.length) add({
      id: `country:${country.id}:war-zones`, domain: 'military',
      entityIds: [country.id, ...warZones.flatMap((zone) => zone.countryIds)],
      topicTags: ['militaire', 'conflit', 'front', 'zone-de-guerre', 'economie'],
      importance: 93, confidence: 100, visibility: 'public',
      sourcePath: `warZones.${country.id}`,
      statement: `${country.name}: ${warZones.map((zone) => `${zone.name}, intensité ${zone.intensity}, perturbation économique ${zone.economicDisruptionPct.toFixed(0)} %, ravitaillement ${Math.round(zone.supplyMultiplier * 100)} %, statut ${zone.status}`).join(' ; ')}.`,
    });
  }

  for (const [key, relation] of Object.entries(state.relations)) add({ id: `relation:${key}`, domain: 'diplomacy', entityIds: [relation.from, relation.to], topicTags: ['relation', 'confiance', 'commerce', 'securite'], importance: 82, confidence: 95, visibility: 'public', sourcePath: `relations.${key}`, statement: `${relation.from} → ${relation.to}: relation ${relation.relation.toFixed(0)}, confiance ${relation.trust.toFixed(0)}, commerce ${relation.tradeIntensity.toFixed(0)}, alignement sécuritaire ${relation.securityAlignment.toFixed(0)}.` });
  for (const session of Object.values(state.diplomaticSessions ?? {})) add({ id: `diplomatic-session:${session.id}`, domain: 'diplomacy', entityIds: session.participantIds, topicTags: ['negociation', 'session', session.kind, session.status], importance: session.status === 'active' ? 82 : session.status === 'refused' || session.status === 'closed' ? 52 : 90, confidence: 100, visibility: 'internal', ownerCountryId: session.initiatorId, sourcePath: `diplomaticSessions.${session.id}`, observedAt: session.updatedAt, statement: `Négociation ${session.initiatorId}–${session.counterpartId}: ${session.kind}, statut ${session.status}; ${session.turns.length} échange(s); proposition courante ${session.terms.annualVolume} unités/an jusqu'au ${session.terms.endDate}.` });
  for (const dialogue of Object.values(state.diplomaticDialogues ?? {})) {
    const names = dialogue.participantIds.map((id) => state.countries[id]?.name ?? id).join(', ');
    const last = dialogue.turns.at(-1);
    add({ id: `diplomatic-dialogue:${dialogue.id}`, domain: 'diplomacy', entityIds: dialogue.participantIds, topicTags: ['dialogue', 'diplomatie', dialogue.kind, dialogue.status], importance: dialogue.status === 'closed' ? 52 : 94, confidence: 100, visibility: 'internal', ownerCountryId: dialogue.initiatorId, sourcePath: `diplomaticDialogues.${dialogue.id}`, observedAt: dialogue.updatedAt, statement: `Dialogue ${names}: statut ${dialogue.status}, ${dialogue.turns.length} échange(s), prochain intervenant ${state.countries[dialogue.activeSpeakerId]?.name ?? dialogue.activeSpeakerId}; dernier message ${last ? compact(last.publicMessage, 360) : 'aucun'}.` });
    for (const turn of dialogue.turns.slice(-6)) add({ id: `diplomatic-dialogue-turn:${turn.id}`, domain: 'diplomacy', entityIds: dialogue.participantIds, topicTags: ['dialogue', 'message', turn.kind], importance: dialogue.status === 'awaiting_ai' ? 90 : 76, confidence: 100, visibility: 'internal', ownerCountryId: dialogue.initiatorId, sourcePath: `diplomaticDialogues.${dialogue.id}.turns.${turn.id}`, observedAt: turn.date, statement: `${state.countries[turn.speakerId]?.name ?? turn.speakerId}: ${compact(turn.publicMessage, 600)}` });
  }
  for (const node of Object.values(state.energyNodes)) add({ id: `energy-node:${node.id}`, domain: 'energy', entityIds: [node.countryId], topicTags: [node.resource, 'production', 'capacite', 'reserves'], importance: 72, confidence: 82, visibility: 'public', sourcePath: `energyNodes.${node.id}`, statement: `${node.label} (${node.countryId}, ${node.resource}): production ${node.annualProduction}, capacité ${node.annualCapacity}, réserves prouvées ${node.provenReserves}, coût d'extraction ${node.extractionCost}.` });
  for (const contract of Object.values(state.energyContracts)) add({ id: `energy-contract:${contract.id}`, domain: 'energy', entityIds: [contract.sellerId, contract.buyerId], topicTags: [contract.resource, 'contrat', 'importation', 'exportation'], importance: 78, confidence: 95, visibility: contract.status === 'active' ? 'public' : 'internal', ownerCountryId: contract.buyerId, sourcePath: `energyContracts.${contract.id}`, statement: `Contrat ${contract.resource} ${contract.sellerId} → ${contract.buyerId}: volume annuel ${contract.annualVolume}, statut ${contract.status}, échéance ${contract.endDate}.` });
  for (const sector of Object.values(state.sectors)) add({ id: `sector:${sector.id}`, domain: 'industry', entityIds: [sector.countryId], topicTags: [sector.sector, 'industrie', 'capacite'], importance: 74, confidence: 88, visibility: 'public', sourcePath: `sectors.${sector.id}`, statement: `${sector.countryId}, secteur ${sector.sector}: capacité ${sector.capacity}, utilisation ${sector.utilization} %, charge ${sector.workloadMonths} mois, dépendance étrangère ${sector.foreignDependency}/100.` });
  for (const product of Object.values(state.armamentProducts)) add({ id: `armament:${product.id}`, domain: 'military', entityIds: [product.countryId, ...product.clients.map((client) => client.countryId)], topicTags: ['armement', product.family, 'production', 'export'], importance: 75, confidence: product.evidenceConfidence, visibility: 'public', sourcePath: `armamentProducts.${product.id}`, statement: `${product.name} (${product.manufacturer}): statut ${product.status}, capacité annuelle ${product.annualCapacity}, carnet ${product.backlogMonths} mois, maturité ${product.maturity}, expérience ${product.operationalExperience}.` });
  for (const current of Object.values(state.historicalCurrents)) if (current.playerVisibility !== 'hidden') add({ id: `history:${current.id}`, domain: 'history', entityIds: current.affectedActors, topicTags: ['histoire', 'tendance', ...current.drivers.flatMap(words).slice(0, 8)], importance: 80, confidence: current.playerVisibility === 'known' ? 90 : 58, visibility: current.playerVisibility === 'known' ? 'public' : 'internal', ownerCountryId: state.playerCountryId, sourcePath: `historicalCurrents.${current.id}`, statement: `${current.name}: pression ${current.pressure.toFixed(0)}/100, inertie ${current.inertia.toFixed(0)}, statut ${current.status}; moteurs ${current.drivers.join(', ')}.` });
  for (const anchor of Object.values(state.historicalAnchors ?? {})) {
    if (anchor.status === 'dormant' || anchor.status === 'expired') continue;
    const visible = anchor.playerVisibility !== 'hidden';
    if (!visible) continue;
    const publicTitle = anchor.playerVisibility === 'known' ? anchor.title : anchor.trendTitle;
    add({
      id: `history-anchor:${anchor.id}`, domain: 'history', entityIds: anchor.affectedActors,
      topicTags: ['histoire', 'ancrage', 'tendance', anchor.kind, ...anchor.regionTags],
      importance: anchor.importance === 'critical' ? 98 : anchor.importance === 'major' ? 88 : 70,
      confidence: anchor.playerVisibility === 'known' ? 94 : 72,
      visibility: 'public', ownerCountryId: state.playerCountryId,
      sourcePath: `historicalAnchors.${anchor.id}`, observedAt: anchor.lastEvaluatedAt ?? state.currentDate,
      statement: `${publicTitle}: pression ${anchor.pressure.toFixed(0)}/100, statut ${anchor.status}, fenêtre ${anchor.probableWindow.start}–${anchor.probableWindow.end}. ${anchor.trendSummary} Manifestations admissibles : ${anchor.possibleManifestations.join('; ')}. Invariants : ${anchor.invariants.join('; ')}.${anchor.lastIntervention ? ` Dernière intervention du joueur : ${anchor.lastIntervention.direction}, issue ${anchor.lastIntervention.outcome}, effet ${anchor.lastIntervention.pressureDelta >= 0 ? '+' : ''}${anchor.lastIntervention.pressureDelta.toFixed(1)}.` : ''}${anchor.divergence ? ` Divergence : ${anchor.divergence.kind} — ${anchor.divergence.summary}` : ''}`,
    });
  }
  for (const process of Object.values(state.latentProcesses)) add({ id: `latent:${process.id}`, domain: 'history', entityIds: [process.actorId], topicTags: ['processus', 'latent', 'secret'], importance: 76, confidence: 75, visibility: 'secret', ownerCountryId: String(process.actorId), sourcePath: `latentProcesses.${process.id}`, statement: `Processus latent de ${process.actorId}: ${process.objective}; progrès ${process.progress}/100; statut ${process.status}.` });
  for (const dossier of Object.values(state.strategicDossiers ?? {})) {
    add({ id: `dossier:${dossier.id}`, domain: 'dossier', entityIds: dossier.actorIds, topicTags: [dossier.kind, ...dossier.regionTags], importance: { minor: 45, moderate: 65, major: 85, critical: 100 }[dossier.importance], confidence: 90, visibility: 'public', sourcePath: `strategicDossiers.${dossier.id}`, observedAt: dossier.updatedAt, statement: `${dossier.title}: ${dossier.publicSummary} Phase ${dossier.phase}; tendance ${dossier.trend}; ${dossier.pendingDecisions.length} décision(s) en attente; ${dossier.escalationCount ?? 0} relance(s) du moteur${dossier.sleepingAt ? `; dossier en sommeil depuis ${dossier.sleepingAt}` : ''}.` });
    for (const entry of dossier.entries.slice(-4)) add({ id: `dossier-entry:${entry.id}`, domain: 'dossier', entityIds: entry.actorIds, topicTags: [dossier.kind, entry.importance], importance: { minor: 40, moderate: 60, major: 82, critical: 98 }[entry.importance], confidence: 90, visibility: entry.visibility === 'public' ? 'public' : entry.visibility === 'secret' ? 'secret' : 'internal', ownerCountryId: state.playerCountryId, sourcePath: `strategicDossiers.${dossier.id}.entries.${entry.id}`, observedAt: entry.date, statement: `${entry.title}: ${entry.summary}` });
  }
  for (const zone of Object.values(state.warZones ?? {})) add({
    id: `war-zone:${zone.id}`, domain: 'military', entityIds: zone.countryIds,
    topicTags: ['conflit', 'front', 'zone-de-guerre', zone.intensity],
    importance: zone.intensity === 'critical' ? 100 : zone.intensity === 'high' ? 94 : 82,
    confidence: 100, visibility: 'public', sourcePath: `warZones.${zone.id}`, observedAt: zone.updatedAt,
    statement: `${zone.name}: zone de guerre ${zone.status}, intensité ${zone.intensity}; pays concernés ${zone.countryIds.join(', ')}; territoires suivis ${zone.territoryIds.length}; perturbation économique ${zone.economicDisruptionPct.toFixed(0)} %; multiplicateur de ravitaillement ${Math.round(zone.supplyMultiplier * 100)} %.`,
  });
  for (const reaction of Object.values(state.stakeholderReactions ?? {})) add({ id: `reaction:${reaction.id}`, domain: 'actor', entityIds: [reaction.countryId, reaction.groupId, reaction.targetId], topicTags: ['defiance', 'groupe', reaction.level], importance: { low: 40, moderate: 60, important: 82, critical: 100 }[reaction.level], confidence: 92, visibility: reaction.visibility === 'public' ? 'public' : reaction.visibility === 'secret' ? 'secret' : 'internal', ownerCountryId: reaction.countryId, sourcePath: `stakeholderReactions.${reaction.id}`, observedAt: reaction.updatedAt, statement: `${reaction.label}: défiance ${reaction.level}, tendance ${reaction.trend}; causes ${reaction.causes.join(', ')}.` });
  for (const actor of Object.values(state.powerActors ?? {})) if (actor.visibility !== 'unknown') add({ id: `actor:${actor.id}`, domain: 'actor', entityIds: [actor.countryId, actor.id, actor.stakeholderGroupId], topicTags: ['personnalite', actor.role, ...actor.ideologyTags], importance: Math.max(50, actor.influence), confidence: actor.visibility === 'public' ? 95 : 65, visibility: actor.visibility === 'public' ? 'public' : 'internal', ownerCountryId: actor.countryId, sourcePath: `powerActors.${actor.id}`, observedAt: actor.updatedAt, statement: `${actor.name}, ${actor.position}: objectif immédiat ${actor.immediateObjective}; personnalité ${actor.personalityTags.join(', ')}.` });
  for (const change of state.ledger.slice(-80)) add({ id: `change:${change.id}`, domain: change.path.startsWith('macro') ? 'economy' : change.path.startsWith('relations') ? 'diplomacy' : change.path.startsWith('energy') ? 'energy' : change.path.includes('dossier') ? 'dossier' : 'overview', entityIds: [change.actorId], topicTags: ['changement', ...words(change.path)], importance: change.origin === 'player' ? 88 : 58, confidence: 100, visibility: change.visibility === 'public' ? 'public' : change.visibility === 'secret' ? 'secret' : 'internal', ownerCountryId: change.actorId, sourcePath: `ledger.${change.id}`, observedAt: change.date, statement: `${compact(change.reason, 360)} (${change.path}: ${compact(change.before, 80)} → ${compact(change.after, 120)}).` });
  return facts;
}

export function canCountrySeeFact(state: WorldState, viewer: CountryId, item: AIContextFact) {
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
  const entities = new Set([query.actorId, query.requestingCountryId, query.decisionCountryId, ...query.targetIds]);
  const directEntities = item.entityIds.filter((id) => entities.has(id)).length;
  const distance = conceptDistance(query.concepts, item.concepts);
  const age = monthsBetween(item.observedAt, state.currentDate);
  return item.importance * 0.14
    + item.confidence * 0.07
    + (query.domains.includes(item.domain) ? 4 : 0)
    + Math.min(48, directEntities * 24)
    + (distance === 0 ? 55 : distance === 1 ? 32 : distance === 2 ? 14 : 0)
    + Math.max(0, 8 - age * 0.35);
}

const defaultConceptsByKind: Record<AIJobKind, string[]> = {
  advisor: ['politics.strategy'],
  diplomacy: ['diplomacy.negotiation', 'diplomacy.relation', 'politics.strategy'],
  historical_interpretation: ['history.current', 'history.latent', 'dossier.current'],
  power_struggle: ['politics.stakeholder', 'politics.personality', 'politics.strategy'],
  free_action_interpretation: ['politics.strategy'],
};

function jobPlayerIntent(job: AIJob) {
  if (job.inputText) return job.inputText;
  if (job.kind === 'power_struggle' && job.context.playerResponse) return job.context.playerResponse;
  if (job.kind !== 'power_struggle' && typeof job.context.playerIntent === 'string') return job.context.playerIntent;
  return job.purpose;
}

function decisionCountryForJob(state: WorldState, job: AIJob, targets: CountryId[]) {
  if (job.kind === 'power_struggle') return job.countryId;
  if (job.kind === 'diplomacy') {
    const explicit = typeof job.context.respondingCountryId === 'string'
      ? job.context.respondingCountryId
      : typeof job.context.targetCountryId === 'string' ? job.context.targetCountryId : undefined;
    if (explicit && state.countries[explicit]) return explicit;
    if (targets[0]) return targets[0];
  }
  return state.countries[job.actorId] ? job.actorId : state.playerCountryId;
}

function dynamicBudget(tier: AIJobBudgetTier, intentTokens: number, targetCount: number, jobKind?: AIJobKind) {
  // Les échanges diplomatiques réutilisent leur historique local mais n'ont
  // pas besoin du même plafond que l'analyse générale. On garde une marge
  // d'escalade automatique pour une intention réellement longue ou un groupe
  // multilatéral afin de ne jamais tronquer les lignes rouges importantes.
  const base = jobKind === 'diplomacy' && tier === 'standard' ? 7_500 : budgetTokens[tier];
  if (jobKind === 'diplomacy' && base < budgetTokens.standard && (intentTokens >= 4_000 || targetCount >= 4)) return budgetTokens.standard;
  if (base < budgetTokens.standard && (intentTokens >= 4_000 || targetCount >= 3)) return budgetTokens.standard;
  if (base < budgetTokens.deep && intentTokens >= 9_000) return budgetTokens.deep;
  return base;
}

export function queryForAIJob(state: WorldState, job: AIJob): AIContextQuery {
  const actorId = job.kind === 'power_struggle' ? job.countryId : job.actorId;
  const requestingCountryId = state.countries[actorId] ? actorId : state.playerCountryId;
  const purpose = job.purpose;
  const playerIntent = jobPlayerIntent(job);
  const contextText = `${JSON.stringify(job.context)} ${playerIntent}`;
  const normalizedContext = words(contextText).join(' ');
  const targetIds = Object.values(state.countries)
    .filter((country) => country.id !== requestingCountryId
      && (contextText.includes(country.id) || normalizedContext.includes(words(country.name).join(' '))))
    .map((country) => country.id);
  const decisionCountryId = decisionCountryForJob(state, job, targetIds);
  const approximateIntentTokens = approximateTokens(playerIntent);
  return {
    jobKind: job.kind,
    requestingCountryId,
    decisionCountryId,
    actorId,
    targetIds,
    domains: domainsByKind[job.kind],
    topicTags: [...new Set(words(`${purpose} ${job.reasons.join(' ')} ${contextText}`))].slice(0, 40),
    concepts: [...new Set([...defaultConceptsByKind[job.kind], ...conceptsFromText(`${purpose} ${job.reasons.join(' ')} ${contextText}`)])],
    purpose,
    playerIntent,
    approximateIntentTokens,
    tokenBudget: dynamicBudget(job.budgetTier, approximateIntentTokens, targetIds.length, job.kind),
  };
}

/** Compile la vérité utile du moteur avant tout appel réseau. */
export function compileAIContext(state: WorldState, query: AIContextQuery): AIContextPacket {
  const allFacts = collectFacts(state);
  const scoped = allFacts.flatMap((item): AIContextReserveFact[] => {
    if (canCountrySeeFact(state, query.requestingCountryId, item)) return [{ ...item, accessScope: 'known' }];
    if (item.ownerCountryId === query.decisionCountryId && item.visibility !== 'public') return [{ ...item, accessScope: 'private' }];
    return [];
  });
  const anchorIds = new Set([
    'world:date',
    `country:${query.requestingCountryId}:identity`,
    `country:${query.requestingCountryId}:strategy`,
    `country:${query.decisionCountryId}:identity`,
    `country:${query.decisionCountryId}:strategy`,
    `country:${query.decisionCountryId}:leadership`,
    `country:${query.decisionCountryId}:apparatus`,
    ...query.targetIds.map((id) => `country:${id}:identity`),
  ]);
  const ranked = scoped
    .map((item) => ({ item, score: scoreFact(state, query, item), distance: conceptDistance(query.concepts, item.concepts) }))
    .filter(({ item, distance }) => anchorIds.has(item.id) || (domainCanParticipate(query, item) && Number.isFinite(distance)))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  const selected: AIContextReserveFact[] = [];
  let used = approximateTokens({ query: { ...query, playerIntent: undefined }, overview: state.currentDate });
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
  const selectedIds = new Set(selected.map((item) => `${item.accessScope}:${item.id}`));
  const reserveFacts = scoped
    .filter((item) => !selectedIds.has(`${item.accessScope}:${item.id}`))
    .sort((a, b) => scoreFact(state, query, b) - scoreFact(state, query, a))
    .slice(0, 180);
  const withoutScope = ({ accessScope: _scope, ...item }: AIContextReserveFact): AIContextFact => item;
  const knownFacts = selected.filter((item) => item.accessScope === 'known').map(withoutScope);
  const privateDecisionFacts = selected.filter((item) => item.accessScope === 'private').map(withoutScope);
  return {
    schemaVersion: 1,
    compiledAt: state.currentDate,
    query,
    overview: `${state.countries[query.decisionCountryId]?.name ?? query.decisionCountryId} prend une décision au ${state.currentDate} à partir d'une demande de ${state.countries[query.requestingCountryId]?.name ?? query.requestingCountryId}.`,
    knownFacts,
    privateDecisionFacts,
    reserveFacts,
    omittedFactCount: scoped.length - selected.length,
    approximateInputTokens: used,
    approximateTotalInputTokens: used + query.approximateIntentTokens + 1_500,
  };
}

export type SupplementalFactRequest = { concepts: string[]; entityIds: string[]; reason: string };

/** Sert les compléments demandés par Luna depuis la réserve, avec un plafond indépendant. */
export function selectSupplementalFacts(packet: AIContextPacket, requests: SupplementalFactRequest[], maximumTokens: number) {
  const requestedConcepts = [...new Set(requests.flatMap((request) => request.concepts))];
  const requestedEntities = new Set(requests.flatMap((request) => request.entityIds));
  const ranked = packet.reserveFacts
    .map((item) => {
      const distance = conceptDistance(requestedConcepts, item.concepts);
      const entityMatches = item.entityIds.filter((id) => requestedEntities.has(id)).length;
      return { item, score: (distance === 0 ? 80 : distance === 1 ? 45 : distance === 2 ? 18 : 0) + entityMatches * 35 + item.importance * 0.1 };
    })
    .filter(({ score }) => score >= 30)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  const selected: AIContextReserveFact[] = [];
  let used = 0;
  for (const candidate of ranked) {
    const cost = approximateTokens(candidate.item);
    if (used + cost > maximumTokens) continue;
    selected.push(candidate.item);
    used += cost;
  }
  return {
    knownFacts: selected.filter((item) => item.accessScope === 'known').map(({ accessScope: _scope, ...item }) => item),
    privateDecisionFacts: selected.filter((item) => item.accessScope === 'private').map(({ accessScope: _scope, ...item }) => item),
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
