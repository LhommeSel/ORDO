import { energyBalance, producerNodes } from './energy';
import { createAdministrativeEnergyOffer } from './energy-negotiation';
import { productEvidenceSummary } from './industry';
import { interpretPlayerIntent, rankEnergySuppliers, type PlayerIntent } from './intent';
import { relationBetween } from './ledger';
import type { AdvisorQuestionDimension, AdvisorQuestionKind, AdvisorResponseMode } from '../ai/contracts';
import { countryIdsMentionedInText, countryMentionedInText, countrySheet, defenseReference2000 } from './country-sheet';
import type {
  AiBudgetPolicy,
  CapacityDomainId,
  CountryId,
  StrategicPlan,
  WorldState,
} from './types';

export type AdvisorMode = 'situation' | 'options';

export type AdvisorQuestionClassification = {
  kind: AdvisorQuestionKind;
  dimensions: AdvisorQuestionDimension[];
  responseMode: AdvisorResponseMode;
  confidence: number;
  signals: string[];
};

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
  questionKind: AdvisorQuestionKind;
  dimensions: AdvisorQuestionDimension[];
  responseMode: AdvisorResponseMode;
  actors: Array<{ id: CountryId; name: string; role: 'player' | 'mentioned' | 'focus'; factIds: string[] }>;
  questionConfidence: number;
};

export const defaultAiBudgetPolicy: AiBudgetPolicy = {
  worldDynamism: 'standard',
  diplomacyDepth: 'standard',
  historicalDepth: 'standard',
  advisorDepth: 'standard',
};

const monthLabel = (months: number) => `${months.toFixed(1)} mois`;

const dimensionRules: Array<{ dimension: AdvisorQuestionDimension; label: string; weight: number; pattern: RegExp }> = [
  { dimension: 'diplomacy', label: 'négociation ou relation avec un interlocuteur', weight: 5, pattern: /(?:negoci|contrat|accord|alliance|traite|reddition|ultimatum|mandat diplomatique|cooperat|avec)/ },
  { dimension: 'situation', label: 'demande de situation ou de chiffres', weight: 4, pattern: /(?:quel est|quelle est|combien|etat de|niveau de|chiffre|statistique|compare|comparaison|ou en est|situation|dependance)/ },
  { dimension: 'strategy', label: 'demande d’action ou de stratégie', weight: 5, pattern: /(?:que faire|comment|propose|preparer|renforcer|reduire|lancer|reagir|decision|strategie|plan|trajectoire|priorite|options?)/ },
  { dimension: 'forecast', label: 'projection ou conséquences', weight: 4, pattern: /(?:effet|impact|consequence|risque|scenario|prevoir|projection|reaction|si )/ },
];

/** Classification locale, sans appel API. Le joueur peut la remplacer dans l’interface. */
export function classifyAdvisorQuestion(question: string): AdvisorQuestionClassification {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const scores = new Map<AdvisorQuestionDimension, number>([['situation', 0], ['strategy', 0], ['diplomacy', 0], ['forecast', 0]]);
  const signals: string[] = [];
  for (const rule of dimensionRules) {
    if (rule.pattern.test(normalized)) {
      scores.set(rule.dimension, (scores.get(rule.dimension) ?? 0) + rule.weight);
      signals.push(rule.label);
    }
  }
  const dimensions = [...scores.entries()].filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).map(([dimension]) => dimension);
  if (dimensions.length === 0) return { kind: 'free', dimensions: ['strategy'], responseMode: 'options', confidence: 35, signals: [] };
  const top = scores.get(dimensions[0]) ?? 0;
  const second = scores.get(dimensions[1]) ?? 0;
  const kind: AdvisorQuestionKind = dimensions.includes('diplomacy') ? 'diplomacy' : dimensions.includes('strategy') ? 'strategy' : dimensions.includes('situation') ? 'fact' : 'free';
  const responseMode: AdvisorResponseMode = dimensions.includes('strategy') || dimensions.includes('diplomacy') || dimensions.includes('forecast')
    ? dimensions.includes('situation') ? 'facts_and_options' : 'options'
    : 'facts';
  const confidence = Math.min(98, Math.round(55 + top * 7 + Math.max(0, top - second) * 4));
  return { kind, dimensions, responseMode, confidence, signals };
}

function modeForQuestion(responseMode: AdvisorResponseMode): AdvisorMode {
  return responseMode === 'facts' ? 'situation' : 'options';
}

function percent(value: number) { return `${value.toFixed(1)} %`; }

function collectCountryFacts(state: WorldState, countryId: CountryId, prefix: string): AdvisorFact[] {
  const country = state.countries[countryId];
  const sheet = countrySheet(state, countryId);
  if (!country || !sheet) return [];
  const labelPrefix = prefix === 'player' ? '' : `${country.name} · `;
  const facts: AdvisorFact[] = [];
  const macro = sheet.macro;
  if (macro) facts.push(
    { id: `${prefix}-gdp`, label: `${labelPrefix}PIB réel`, value: `${macro.gdp.toFixed(0)} Md$ (base 2000)`, confidence: 100, sourcePath: `macroEconomies.${countryId}.realGdpBillion2000Usd` },
    { id: `${prefix}-growth`, label: `${labelPrefix}Croissance réelle`, value: percent(macro.growth), confidence: 100, sourcePath: `macroEconomies.${countryId}.realGrowthAnnualPct` },
    { id: `${prefix}-population`, label: `${labelPrefix}Population`, value: `${macro.population.toFixed(1)} millions`, confidence: 100, sourcePath: `macroEconomies.${countryId}.populationMillions` },
    { id: `${prefix}-inflation`, label: `${labelPrefix}Inflation`, value: percent(macro.inflation), confidence: 100, sourcePath: `macroEconomies.${countryId}.inflationAnnualPct` },
    { id: `${prefix}-unemployment`, label: `${labelPrefix}Chômage`, value: percent(macro.unemployment), confidence: 100, sourcePath: `macroEconomies.${countryId}.unemploymentPct` },
    { id: `${prefix}-debt`, label: `${labelPrefix}Dette publique`, value: `${percent(macro.debt)} du PIB`, confidence: 100, sourcePath: `macroEconomies.${countryId}.publicDebtPctGdp` },
    { id: `${prefix}-fiscal`, label: `${labelPrefix}Solde public`, value: `${percent(macro.fiscalBalance)} du PIB`, confidence: 100, sourcePath: `macroEconomies.${countryId}.fiscalBalancePctGdp` },
  );
  if (sheet.energy) facts.push(
    { id: `${prefix}-oil`, label: `${labelPrefix}Pétrole`, value: `${sheet.energy.oilImports.toFixed(1)} unités/an importées · ${monthLabel(sheet.energy.oilStocksMonths)} de stocks`, confidence: 100, sourcePath: `countryEnergy.${countryId}.oil` },
    { id: `${prefix}-gas`, label: `${labelPrefix}Gaz`, value: `${sheet.energy.gasImports.toFixed(1)} unités/an importées · ${monthLabel(sheet.energy.gasStocksMonths)} de stocks`, confidence: 100, sourcePath: `countryEnergy.${countryId}.gas` },
  );
  const defense = defenseReference2000[countryId];
  if (defense) facts.push(
    { id: `${prefix}-defense-budget`, label: `${labelPrefix}Budget de défense`, value: `${defense.budgetBillionUsd.toFixed(1)} Md$`, confidence: 100, sourcePath: `defenseReference2000.${countryId}.budgetBillionUsd` },
    { id: `${prefix}-defense-personnel`, label: `${labelPrefix}Effectifs actifs`, value: `${defense.activePersonnelThousands.toFixed(0)} milliers · ${defense.posture}`, confidence: 100, sourcePath: `defenseReference2000.${countryId}.activePersonnelThousands` },
  );
  return facts;
}

function collectStructuralFacts(state: WorldState, countryId: CountryId, prefix: string): AdvisorFact[] {
  const profile = state.structuralProfiles[countryId];
  const country = state.countries[countryId];
  if (!profile || !country) return [];
  const labelPrefix = prefix === 'player' ? '' : `${country.name} · `;
  const leadership = state.leadership[countryId];
  const apparatus = state.politicalApparatus[countryId];
  const dominantFigure = leadership?.figures.slice().sort((a, b) => b.authorityShare - a.authorityShare)[0];
  const dominantCurrent = apparatus?.currents.slice().sort((a, b) => b.weight - a.weight)[0];
  return [
    ...(dominantFigure ? [{ id: `${prefix}-leader`, label: `${labelPrefix}Dirigeant dominant`, value: `${dominantFigure.name} · ${dominantFigure.ideologyTags.join(', ')}`, confidence: 100, sourcePath: `leadership.${countryId}.figures` }] : []),
    ...(dominantCurrent ? [{ id: `${prefix}-apparatus`, label: `${labelPrefix}Courant dominant de l’appareil`, value: `${dominantCurrent.label} · poids ${dominantCurrent.weight}/100`, confidence: 100, sourcePath: `politicalApparatus.${countryId}.currents` }] : []),
    { id: `${prefix}-industrial-depth`, label: `${labelPrefix}Profondeur industrielle`, value: `${profile.industrialDepth}/100`, confidence: 100, sourcePath: `structuralProfiles.${countryId}.industrialDepth` },
    { id: `${prefix}-innovation`, label: `${labelPrefix}Capacité d’innovation`, value: `${profile.innovationCapacity}/100`, confidence: 100, sourcePath: `structuralProfiles.${countryId}.innovationCapacity` },
    { id: `${prefix}-financial-resilience`, label: `${labelPrefix}Résilience financière`, value: `${profile.financialResilience}/100`, confidence: 100, sourcePath: `structuralProfiles.${countryId}.financialResilience` },
    { id: `${prefix}-demographic-pressure`, label: `${labelPrefix}Pression démographique`, value: `${profile.demographicPressure}/100`, confidence: 100, sourcePath: `structuralProfiles.${countryId}.demographicPressure` },
    { id: `${prefix}-top-goal`, label: `${labelPrefix}Objectif stratégique prioritaire`, value: country.strategy.goals.slice().sort((a, b) => b.priority - a.priority)[0]?.label ?? 'Non établi', confidence: 100, sourcePath: `countries.${countryId}.strategy.goals` },
    { id: `${prefix}-vulnerability`, label: `${labelPrefix}Vulnérabilité structurelle`, value: country.strategy.vulnerabilities[0] ?? 'Non établie', confidence: 100, sourcePath: `countries.${countryId}.strategy.vulnerabilities` },
  ];
}

function relevantFacts(facts: AdvisorFact[], question: string, questionKind: AdvisorQuestionKind, responseMode: AdvisorResponseMode): AdvisorFact[] {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const military = /(armee|militaire|defense|effectif|force|otan|missile|troupe)/.test(normalized);
  const economy = /(pib|croissance|economie|dette|chomage|industrie|budget|inflation|commerce|semi|emploi|investissement)/.test(normalized);
  const energy = /(gaz|petrole|energie|energetique|stock|approvisionnement|fournisseur|gisement|importation)/.test(normalized);
  const strategic = questionKind !== 'fact' || /(objectif|priorite|vulnerabilite|resilience|interet|crainte|menace|ligne rouge)/.test(normalized);
  const score = (fact: AdvisorFact) => {
    let value = 0;
    if (fact.id.includes('defense') && military) value += 8;
    if ((fact.id.includes('oil') || fact.id.includes('gas')) && energy) value += 8;
    if ((fact.id.includes('gdp') || fact.id.includes('growth') || fact.id.includes('debt') || fact.id.includes('inflation') || fact.id.includes('unemployment')) && economy) value += 7;
    if ((fact.id.includes('industrial') || fact.id.includes('innovation') || fact.id.includes('financial') || fact.id.includes('demographic')) && strategic) value += 6;
    if ((fact.id.includes('top-goal') || fact.id.includes('vulnerability')) && strategic) value += 7;
    if ((fact.id.includes('leader') || fact.id.includes('apparatus')) && strategic) value += 7;
    if (fact.id === 'date') value += 3;
    if (fact.id === 'budget' && (economy || strategic)) value += 5;
    if (fact.id === 'relation' || fact.id === 'target-strategy' || fact.id.endsWith('-relation') || fact.id.endsWith('-strategy')) value += 8;
    return value;
  };
  const limit = responseMode === 'facts_and_options' ? 64 : questionKind === 'diplomacy' ? 48 : questionKind === 'strategy' ? 40 : questionKind === 'fact' ? 24 : 32;
  const ranked = facts
    .map((fact, index) => ({ fact, score: score(fact), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ fact }) => fact);
  const required = new Set<string>();
  const prefixes = new Set<string>(['player']);
  for (const fact of facts) {
    const prefix = fact.id.match(/^(actor-[^-]+|target|player)-/)?.[1];
    if (prefix) prefixes.add(prefix);
  }
  for (const prefix of prefixes) {
    const essentials = facts.filter((fact) => fact.id === `${prefix}-relation` || fact.id === `${prefix}-strategy`
      || fact.id === `${prefix}-gdp` || fact.id === `${prefix}-growth` || fact.id === `${prefix}-gas` || fact.id === `${prefix}-oil`);
    const preferred = energy ? essentials.filter((fact) => fact.id.endsWith('-gas') || fact.id.endsWith('-oil'))
      : economy ? essentials.filter((fact) => fact.id.endsWith('-gdp') || fact.id.endsWith('-growth')) : essentials;
    // Relation/priorité restent utiles dans tous les domaines ; on ajoute
    // ensuite les deux mesures directement demandées pour cet acteur.
    for (const fact of [...essentials.filter((item) => item.id.endsWith('-relation') || item.id.endsWith('-strategy')), ...preferred, ...essentials]) {
      if (required.size >= limit) break;
      required.add(fact.id);
      if (required.size >= limit) break;
      if (preferred.length > 0 && preferred.every((item) => required.has(item.id))) break;
    }
  }
  const selected = new Map<string, AdvisorFact>();
  for (const fact of facts) if (required.has(fact.id)) selected.set(fact.id, fact);
  for (const fact of ranked) {
    if (selected.size >= limit) break;
    selected.set(fact.id, fact);
  }
  return facts.filter((fact) => selected.has(fact.id));
}

function collectFacts(state: WorldState, focusCountryId?: CountryId, question = '', questionKind: AdvisorQuestionKind = 'free', responseMode: AdvisorResponseMode = 'options') {
  const player = state.countries[state.playerCountryId];
  const facts: AdvisorFact[] = [
    {
      id: 'date', label: 'Date de situation', value: state.currentDate, confidence: 100,
      sourcePath: 'currentDate',
    },
    { id: 'budget', label: 'Marge budgétaire opérationnelle', value: `${player.metrics.budget.toFixed(1)} unités budgétaires ORDO`, confidence: 100, sourcePath: `countries.${player.id}.metrics.budget` },
  ];
  const playerFacts = collectCountryFacts(state, player.id, 'player');
  facts.push(...playerFacts, ...collectStructuralFacts(state, player.id, 'player'));
  const mentioned = countryIdsMentionedInText(state, question).filter((id) => id !== player.id);
  if (focusCountryId && focusCountryId !== player.id && !mentioned.includes(focusCountryId)) mentioned.unshift(focusCountryId);
  const actors: AdvisorAnswer['actors'] = [{ id: player.id, name: player.name, role: 'player', factIds: [] }];
  // Tous les pays explicitement cités deviennent des acteurs du contexte.
  // La sélection des faits reste bornée plus bas pour préserver le budget de
  // jetons, et les données absentes restent signalées au modèle.
  mentioned.forEach((targetId, index) => {
    const target = state.countries[targetId];
    if (!target) return;
    const prefix = index === 0 ? 'target' : `actor-${target.id}`;
    const relation = relationBetween(state, player.id, targetId);
    facts.push({
      id: index === 0 ? 'relation' : `${prefix}-relation`, label: `Relation avec ${target.name}`,
      value: relation ? `${relation.relation}/100 · confiance ${relation.trust}/100` : 'Relation non structurée',
      confidence: 95, sourcePath: `relations.${player.id}:${targetId}`,
    });
    facts.push({
      id: index === 0 ? 'target-strategy' : `${prefix}-strategy`, label: `${target.name} · Priorité observée`,
      value: target.strategy.goals.slice().sort((a, b) => b.priority - a.priority)[0]?.label ?? 'Non établie',
      confidence: Math.min(95, 45 + (state.intelligence[`${player.id}:${targetId}`] ?? 0) * 0.5),
      sourcePath: `countries.${targetId}.strategy.goals`,
    });
    const targetFacts = collectCountryFacts(state, targetId, prefix);
    facts.push(...targetFacts, ...collectStructuralFacts(state, targetId, prefix));
    actors.push({ id: target.id, name: target.name, role: target.id === focusCountryId ? 'focus' : 'mentioned', factIds: facts.filter((fact) => fact.id === (index === 0 ? 'relation' : `${prefix}-relation`) || fact.id.startsWith(`${prefix}-`)).map((fact) => fact.id) });
  });
  actors[0].factIds = facts.filter((fact) => !fact.id.startsWith('target-') && !fact.id.startsWith('actor-')).map((fact) => fact.id);
  const selectedFacts = relevantFacts(facts, question, questionKind, responseMode);
  const selectedIds = new Set(selectedFacts.map((fact) => fact.id));
  return { facts: selectedFacts, actors: actors.map((actor) => ({ ...actor, factIds: actor.factIds.filter((id) => selectedIds.has(id)) })) };
}

function diplomaticPlan(state: WorldState, targetId: CountryId): StrategicPlan {
  const player = state.countries[state.playerCountryId];
  const target = state.countries[targetId];
  const relation = relationBetween(state, player.id, targetId);
  const sharedGoal = target.strategy.goals.slice().sort((a, b) => b.priority - a.priority)[0]?.label ?? 'stabilité régionale';
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
  options: { focusCountryId?: CountryId; policy?: AiBudgetPolicy; questionKind?: AdvisorQuestionKind } = {},
): AdvisorAnswer {
  const interpretation = interpretPlayerIntent(state, question);
  const classification = options.questionKind
    ? {
      kind: options.questionKind,
      dimensions: options.questionKind === 'fact' ? ['situation' as const] : options.questionKind === 'diplomacy' ? ['diplomacy' as const] : ['strategy' as const],
      responseMode: options.questionKind === 'fact' ? 'facts' as const : 'options' as const,
      confidence: 100, signals: ['mode choisi par le joueur'],
    }
    : question.trim().length === 0
      ? { kind: 'fact' as const, dimensions: ['situation' as const], responseMode: 'facts' as const, confidence: 100, signals: [] }
      : classifyAdvisorQuestion(question);
  const focusCountryId = interpretation.targetId ?? options.focusCountryId ?? countryMentionedInText(state, question);
  const questionKind = interpretation.kind === 'energy_contract' ? 'diplomacy' : classification.kind;
  const dimensions = interpretation.kind === 'energy_contract' && !classification.dimensions.includes('diplomacy')
    ? [...classification.dimensions, 'diplomacy' as const] : classification.dimensions;
  const responseMode = interpretation.kind === 'energy_contract'
    ? 'facts_and_options' as const : classification.responseMode;
  const mode = modeForQuestion(responseMode);
  const collected = collectFacts(state, focusCountryId, question, questionKind, responseMode);
  const facts = collected.facts;
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
        ? `${plans.length} fournisseur(s) ont été classés à partir des volumes encore disponibles, des routes et de la relation diplomatique.`
        : `Une proposition administrative exécutable a été préparée avec ${focus}, sans demander au joueur de régler tous les paramètres techniques.`;
  return {
    mode,
    headline: interpretation.kind === 'energy_contract'
      ? `Négociation de ${resourceLabel}${focus ? ` · ${focus}` : ''}`
      : mode === 'options' ? `Options concrètes${focus ? ` concernant ${focus}` : ''}` : `État de la situation${focus ? ` · ${focus}` : ''}`,
    synthesis: interpretation.kind === 'energy_contract' ? energySynthesis : mode === 'options'
      ? `${plans.length} piste(s) sont reliées à des capacités, des interlocuteurs, des délais et des indicateurs vérifiables. Aucune n’est une simple étiquette de gameplay.`
      : `La réponse repose sur ${facts.length} faits chiffrés du monde simulé.`,
    facts, plans, generatedBy: 'local_rules', interpretation,
    llmRecommended: responseMode !== 'facts' && ((options.policy?.advisorDepth ?? 'standard') === 'detailed' || question.length > 220),
    questionKind,
    dimensions,
    responseMode,
    actors: collected.actors,
    questionConfidence: interpretation.kind === 'energy_contract' ? interpretation.confidence : classification.confidence,
  };
}

export function armamentAdvisorFacts(state: WorldState) {
  return Object.values(state.armamentProducts)
    .filter((product) => product.countryId === state.playerCountryId)
    .map((product) => ({ productId: product.id, name: product.name, ...productEvidenceSummary(product) }));
}
