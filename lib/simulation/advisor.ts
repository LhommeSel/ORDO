import { energyBalance, producerNodes } from './energy';
import { createAdministrativeEnergyOffer } from './energy-negotiation';
import { productEvidenceSummary } from './industry';
import { interpretPlayerIntent, rankEnergySuppliers, type PlayerIntent } from './intent';
import { relationBetween } from './ledger';
import type {
  AiBudgetPolicy,
  CapacityDomainId,
  CountryId,
  StrategicPlan,
  WorldState,
} from './types';

export type AdvisorMode = 'situation' | 'options';

export type AdvisorFact = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  sourcePath: string;
};

export type PlanAssessment = {
  feasible: boolean;
  capabilityPressure: Array<{ domain: CapacityDomainId; usage: number; maximum: number; level: 'modérée' | 'forte' | 'maximale' | 'dépassée' }>;
  strengths: string[];
  objections: string[];
  estimatedConsequences: string[];
};

export type AdvisorAnswer = {
  mode: AdvisorMode;
  headline: string;
  synthesis: string;
  facts: AdvisorFact[];
  plans: StrategicPlan[];
  generatedBy: 'local_rules';
  llmRecommended: boolean;
  interpretation: PlayerIntent;
};

export const defaultAiBudgetPolicy: AiBudgetPolicy = {
  worldDynamism: 'standard',
  diplomacyDepth: 'standard',
  historicalDepth: 'standard',
  advisorDepth: 'standard',
};

const monthLabel = (months: number) => `${months.toFixed(1)} mois`;

function classifyQuestion(question: string): AdvisorMode {
  const normalized = question.toLocaleLowerCase('fr');
  return /(que faire|propose|option|agir|action|stratégie|strategie|comment|négoci|negoci|contrat|accord)/.test(normalized)
    ? 'options'
    : 'situation';
}

function collectFacts(state: WorldState, focusCountryId?: CountryId): AdvisorFact[] {
  const player = state.countries[state.playerCountryId];
  const facts: AdvisorFact[] = [
    {
      id: 'date', label: 'Date de situation', value: state.currentDate, confidence: 100,
      sourcePath: 'currentDate',
    },
    {
      id: 'budget', label: 'Marge budgétaire', value: player.metrics.budget.toFixed(1), confidence: 100,
      sourcePath: `countries.${player.id}.metrics.budget`,
    },
  ];
  if (focusCountryId && focusCountryId !== player.id && state.countries[focusCountryId]) {
    const target = state.countries[focusCountryId];
    const relation = relationBetween(state, player.id, focusCountryId);
    facts.push({
      id: 'relation', label: `Relation avec ${target.name}`,
      value: relation ? `${relation.relation}/100 · confiance ${relation.trust}/100` : 'Relation non structurée',
      confidence: 95, sourcePath: `relations.${player.id}:${focusCountryId}`,
    });
    facts.push({
      id: 'target-strategy', label: 'Priorité observée',
      value: target.strategy.goals.sort((a, b) => b.priority - a.priority)[0]?.label ?? 'Non établie',
      confidence: Math.min(95, 45 + (state.intelligence[`${player.id}:${focusCountryId}`] ?? 0) * 0.5),
      sourcePath: `countries.${focusCountryId}.strategy.goals`,
    });
  }
  for (const resource of ['oil', 'gas'] as const) {
    const balance = energyBalance(state, player.id, resource);
    if (!balance) continue;
    facts.push({
      id: `energy-${resource}`,
      label: resource === 'oil' ? 'Couverture pétrolière' : 'Couverture gazière',
      value: `${monthLabel(balance.coverageMonths)} de stocks · ${balance.deficit.toFixed(1)} unités/an de déficit`,
      confidence: 100, sourcePath: `countryEnergy.${player.id}.${resource}`,
    });
  }
  return facts;
}

function diplomaticPlan(state: WorldState, targetId: CountryId): StrategicPlan {
  const player = state.countries[state.playerCountryId];
  const target = state.countries[targetId];
  const relation = relationBetween(state, player.id, targetId);
  const sharedGoal = target.strategy.goals.sort((a, b) => b.priority - a.priority)[0]?.label ?? 'stabilité régionale';
  return {
    id: `plan-diplomacy-${targetId}-${state.currentDate}`,
    title: `Former un cadre de crédibilité ${player.name}–${target.name}`,
    intent: `Arriver aux prochaines échéances multilatérales avec une position négociée sur ${sharedGoal.toLocaleLowerCase('fr')}.`,
    rationale: `${target.name} a intérêt à peser sur le compromis final, tandis que ${player.name} gagne à tester les lignes rouges avant la séance formelle. La relation actuelle (${relation?.relation ?? 50}/100) permet une ouverture sans présumer d’un accord.`,
    factsUsed: [`Relation bilatérale ${relation?.relation ?? 50}/100`, `Priorité de ${target.name} : ${sharedGoal}`],
    measures: [
      { actor: 'Conseiller diplomatique', action: 'Ouvrir un canal discret et demander trois exigences non négociables', target: target.name, deadline: 'Sous 10 jours' },
      { actor: 'Ministère compétent', action: 'Préparer une note commune limitée aux convergences vérifiées', target: 'Cabinets ministériels', deadline: 'Avant le prochain conseil' },
      { actor: 'Chef du gouvernement', action: 'Valider ou ajourner l’affichage politique conjoint', target: target.politics.headOfGovernment, deadline: 'À J-2' },
    ],
    requiredCapabilities: ['diplomacy', 'government'],
    interlocutors: [targetId],
    assumptions: ['Le gouvernement partenaire conserve sa coalition actuelle.', 'Le dossier reste négociable hors séance plénière.'],
    risks: ['Une fuite peut rigidifier les positions.', 'Le partenaire peut utiliser le canal pour obtenir des concessions sans s’engager.'],
    likelyReactions: [`${target.name} demandera vraisemblablement une contrepartie sur sa priorité nationale.`, 'Les partenaires non consultés chercheront à éviter un directoire bilatéral.'],
    successIndicators: ['Trois points communs consignés', 'Aucune contradiction publique avant le conseil', 'Canal de crise maintenu après l’échéance'],
    horizon: '2 à 6 semaines',
  };
}

function energyPlan(state: WorldState, resource: 'oil' | 'gas', preferredSupplierId?: CountryId): StrategicPlan | null {
  const player = state.countries[state.playerCountryId];
  const balance = energyBalance(state, player.id, resource);
  const suppliers = producerNodes(state, resource).filter(({ node, available }) => node.countryId !== player.id && available > 3);
  const supplier = suppliers.find(({ node }) => node.countryId === preferredSupplierId) ?? suppliers[0];
  if (!balance || !supplier) return null;
  const seller = state.countries[supplier.node.countryId];
  const prepared = createAdministrativeEnergyOffer(state, supplier.node.countryId, resource);
  if (!prepared.ok) return null;
  const offer = prepared.offer;
  const noun = resource === 'oil' ? 'pétrole' : 'gaz';
  return {
    id: `plan-${resource}-${supplier.node.countryId}-${state.currentDate}`,
    title: `Ouvrir une négociation de ${noun} avec ${seller.name}`,
    intent: `Réduire l’exposition aux ruptures sans tenter de monopoliser la capacité mondiale.`,
    rationale: `L’administration propose spontanément un accord couvrant environ ${offer.coverageShare.toFixed(1)} % des besoins sur ${offer.durationYears} ans. Le joueur peut l’envoyer immédiatement ou demander un ajustement ciblé.`,
    factsUsed: [`Stocks : ${balance.coverageMonths.toFixed(1)} mois`, `Déficit : ${balance.deficit.toFixed(1)} unités/an`, `Offre initiale : ${offer.coverageShare.toFixed(1)} % des besoins`],
    measures: [
      { actor: 'Direction de l’énergie', action: 'Préparer une proposition équilibrée à partir des besoins et capacités disponibles', target: seller.name, deadline: 'Immédiat' },
      { actor: 'Diplomatie', action: 'Transmettre la proposition et recevoir la position du fournisseur', target: seller.name, deadline: 'Sous 30 jours' },
      { actor: 'Gouvernement', action: 'Accepter, insister ou abandonner selon la réponse', target: player.name, deadline: 'À réception' },
    ],
    requiredCapabilities: ['economy', 'diplomacy'], interlocutors: [supplier.node.countryId],
    assumptions: ['Le volume exportable n’est pas attribué à un tiers avant ratification.'],
    risks: ['Dépendance accrue envers le fournisseur.', 'Prime de sécurité supérieure au marché spot.'],
    likelyReactions: [`${seller.name} cherchera une durée ferme ou une contrepartie diplomatique.`, 'Les acheteurs concurrents peuvent surenchérir.'],
    successIndicators: ['Contrat activé sans dépasser la capacité du nœud', 'Stocks au-dessus de la cible nationale', 'Aucune route unique au-delà de 50 % des importations'],
    horizon: '1 à 4 mois',
    execution: { kind: 'energy_contract', supplierId: supplier.node.countryId, resource },
  };
}

function industrialPlan(state: WorldState): StrategicPlan | null {
  const player = state.countries[state.playerCountryId];
  const sector = Object.values(state.sectors)
    .filter((item) => item.countryId === player.id)
    .sort((a, b) => b.foreignDependency - a.foreignDependency)[0];
  if (!sector) return null;
  return {
    id: `plan-industry-${sector.id}-${state.currentDate}`,
    title: `Consolider la filière ${sector.sector.replaceAll('_', ' ')}`,
    intent: 'Transformer une vulnérabilité documentée en programme industriel borné et vérifiable.',
    rationale: `La dépendance extérieure atteint ${sector.foreignDependency}/100, pour une santé industrielle de ${sector.health}/100. Un programme de deux ans protège les compétences sans simuler chaque intrant.`,
    factsUsed: [`Dépendance : ${sector.foreignDependency}/100`, `Santé : ${sector.health}/100`, `Technologie : ${sector.technology}/100`],
    measures: [
      { actor: 'Administration économique', action: 'Cartographier trois dépendances bloquantes et contractualiser les capacités critiques', target: sector.sector, deadline: 'Sous 3 mois' },
      { actor: 'Gouvernement', action: 'Conditionner les aides à des jalons de capacité et de technologie', target: 'Industriels du secteur', deadline: 'Au prochain budget' },
      { actor: 'Diplomatie économique', action: 'Sécuriser un fournisseur de repli allié', target: 'Partenaires stratégiques', deadline: 'Sous 9 mois' },
    ],
    requiredCapabilities: ['economy', 'administration'], interlocutors: [],
    assumptions: ['Le budget reste supérieur au seuil de lancement.', 'Les industriels acceptent des obligations de résultat.'],
    risks: ['Effet d’aubaine sans capacité nouvelle.', 'Représailles commerciales des fournisseurs évincés.'],
    likelyReactions: ['Les industriels demanderont des commandes garanties.', 'Les partenaires étrangers défendront leurs parts de marché.'],
    successIndicators: ['Dépendance réduite sous 60/100', 'Santé industrielle supérieure à 55/100', 'Carnet de charge supérieur à 12 mois'],
    horizon: '18 à 36 mois',
  };
}

export function generateStrategicPlans(state: WorldState, focusCountryId?: CountryId, resourceHint: 'oil' | 'gas' = 'oil') {
  const plans: StrategicPlan[] = [];
  const energy = energyPlan(state, resourceHint, focusCountryId);
  if (energy) plans.push(energy);
  if (focusCountryId && focusCountryId !== state.playerCountryId && state.countries[focusCountryId]) plans.push(diplomaticPlan(state, focusCountryId));
  const industry = industrialPlan(state);
  if (industry) plans.push(industry);
  return plans.slice(0, 3);
}

export function assessStrategicPlan(state: WorldState, plan: StrategicPlan): PlanAssessment {
  const country = state.countries[state.playerCountryId];
  const capabilityPressure = plan.requiredCapabilities.map((domain) => {
    const capacity = country.capacities[domain];
    const estimatedLoad = domain === 'government' ? 4 : domain === 'diplomacy' ? 5 : 6;
    const usage = capacity.committed + estimatedLoad;
    const ratio = usage / capacity.maximum;
    return { domain, usage, maximum: capacity.maximum, level: (ratio > 1 ? 'dépassée' : ratio > 0.9 ? 'maximale' : ratio > 0.7 ? 'forte' : 'modérée') as PlanAssessment['capabilityPressure'][number]['level'] };
  });
  const objections = capabilityPressure.filter((item) => item.level === 'dépassée').map((item) => `La capacité ${item.domain} serait dépassée (${item.usage}/${item.maximum}).`);
  const strengths = plan.factsUsed.slice(0, 2);
  return {
    feasible: objections.length === 0,
    capabilityPressure, strengths, objections,
    estimatedConsequences: [plan.likelyReactions[0], plan.risks[0]].filter(Boolean),
  };
}

export function answerAdvisorQuestion(
  state: WorldState,
  question: string,
  options: { focusCountryId?: CountryId; policy?: AiBudgetPolicy } = {},
): AdvisorAnswer {
  const interpretation = interpretPlayerIntent(state, question);
  const focusCountryId = interpretation.targetId ?? options.focusCountryId;
  const mode = interpretation.kind === 'energy_contract' ? 'options' : classifyQuestion(question);
  const facts = collectFacts(state, focusCountryId);
  let plans: StrategicPlan[] = [];
  if (interpretation.kind === 'energy_contract' && interpretation.resource) {
    if (interpretation.targetStatus === 'modeled' && interpretation.targetId) {
      const targeted = energyPlan(state, interpretation.resource, interpretation.targetId);
      plans = targeted && targeted.execution?.supplierId === interpretation.targetId ? [targeted] : [];
    } else if (interpretation.targetStatus === 'unspecified') {
      plans = rankEnergySuppliers(state, interpretation.resource).slice(0, 3)
        .map((candidate) => energyPlan(state, interpretation.resource!, candidate.countryId))
        .filter((plan): plan is StrategicPlan => Boolean(plan));
    }
  } else if (mode === 'options') {
    plans = generateStrategicPlans(state, focusCountryId);
  }
  const focus = focusCountryId ? state.countries[focusCountryId]?.name : interpretation.targetLabel;
  const resourceLabel = interpretation.resource === 'gas' ? 'gaz' : interpretation.resource === 'oil' ? 'pétrole' : 'énergie';
  const energySynthesis = interpretation.targetStatus === 'unmodeled'
    ? `${interpretation.targetLabel} a bien été identifié, mais ses capacités ne sont pas encore présentes dans le monde simulé. ORDO ne fabrique donc pas de contrat fictif.`
    : interpretation.targetStatus === 'modeled' && plans.length === 0
      ? `${focus} est bien identifié, mais aucune capacité exportatrice de ${resourceLabel} compatible n’est actuellement disponible dans le registre physique.`
      : interpretation.targetStatus === 'unspecified'
        ? `${plans.length} fournisseur(s) ont été classés à partir des volumes encore disponibles, des routes, de la relation et de la fiabilité des données.`
        : `Une proposition administrative exécutable a été préparée avec ${focus}, sans demander au joueur de régler tous les paramètres techniques.`;
  return {
    mode,
    headline: interpretation.kind === 'energy_contract'
      ? `Négociation de ${resourceLabel}${focus ? ` · ${focus}` : ''}`
      : mode === 'options' ? `Options concrètes${focus ? ` concernant ${focus}` : ''}` : `État de la situation${focus ? ` · ${focus}` : ''}`,
    synthesis: interpretation.kind === 'energy_contract' ? energySynthesis : mode === 'options'
      ? `${plans.length} piste(s) sont reliées à des capacités, des interlocuteurs, des délais et des indicateurs vérifiables. Aucune n’est une simple étiquette de gameplay.`
      : `La réponse repose sur ${facts.length} faits du monde simulé, avec leur confiance et leur chemin de provenance.`,
    facts, plans, generatedBy: 'local_rules', interpretation,
    llmRecommended: (options.policy?.advisorDepth ?? 'standard') === 'detailed' || question.length > 220,
  };
}

export function armamentAdvisorFacts(state: WorldState) {
  return Object.values(state.armamentProducts)
    .filter((product) => product.countryId === state.playerCountryId)
    .map((product) => ({ productId: product.id, name: product.name, ...productEvidenceSummary(product) }));
}
