import { commitWorldAction, relationBetween } from './ledger';
import { makeDossierDecision } from './dossiers';
import { seededUnit } from './random';
import { actionIntentFromProgram } from './action-intents';
import { historicalAnchorResolutionEffects } from './history';
import { actionLeverPolitics, actionLeverProfile } from './action-levers';
import { evaluateStrategicAction } from './decision-making';
import { evaluatePoliticalPathway } from './politics';
import { stakeholderReactionEffects } from './stakeholders';
import { nationalReformEffects, nationalReformSupport, reformDomainFromText, reformOptionForText } from './reforms';
import type {
  ActionKind,
  ActionProgram,
  CommonActionCategory,
  CommonActionLever,
  CountryId,
  HistoricalInterventionDirection,
  ISODate,
  WorldEffect,
  WorldState,
} from './types';
import type { ActionIntent } from './action-intents';

export type PreparedCommonAction = Omit<ActionProgram, 'id' | 'startedAt' | 'expectedCompletionAt' | 'progressMonths' | 'status' | 'resolution'>;

export type CommonActionPreparation =
  | { ok: true; action: PreparedCommonAction; warnings: string[] }
  | { ok: false; error: string };

export type CommonActionPreparationOptions = {
  /** Origine de l’intention : affichée dans la traçabilité, sans effet privilégié. */
  source?: ActionIntent['source'];
  requestId?: string;
  /** Dossier à suivre automatiquement jusqu’à la résolution du programme. */
  linkedDossierId?: string;
  /** Catégorie imposée par une interface structurée ; sinon le texte est interprété localement. */
  category?: CommonActionCategory;
  /** Posture explicite appliquée à un ancrage historique lié au programme. */
  historicalIntent?: HistoricalInterventionDirection;
};

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const normalize = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function addMonths(date: ISODate, months: number): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
}

function targetInText(state: WorldState, text: string): CountryId | undefined {
  const normalized = ` ${normalize(text)} `;
  return Object.values(state.countries)
    .map((country) => ({ id: country.id, name: normalize(country.name) }))
    .filter((country) => normalized.includes(` ${country.name} `))
    .sort((a, b) => b.name.length - a.name.length)[0]?.id;
}

function inferCategory(text: string): CommonActionCategory | undefined {
  const value = normalize(text);
  if (/\b(renseignement|dgse|espion|surveill|infiltr|ecoute)\b/.test(value)) return 'intelligence';
  if (/\b(militaire|defense|armee|arme|troupe|deploi|dissuasion)\b/.test(value)) return 'defense';
  if (/\b(ministere|sous ministere|administration|institution|reforme|service public|relig\w*|laic\w*|immigr\w*|migrat\w*|asile|naturalisation|integration|societ\w*|famille|ordre public|droits civils|egalite)\b/.test(value)) return 'institutional';
  if (/\b(n egocier|negocier|negociation|alliance|cooperation|cooperer|dialogue|accord|partenariat|sommet|mediation)\b/.test(value)) return 'diplomacy';
  if (/\b(programme|plan|industrie|industriel|budget|budgetaire|fiscal|deficit|depense|austerite|consolidation|assainir|investir|investissement|production|commerce|croissance|dette|emploi|energie|energetique|gaz|petrole|semiconducteur|nucleaire|relance|filiere)\b/.test(value)) return 'economic';
  return undefined;
}

const categoryKinds: Record<CommonActionCategory, ActionKind> = {
  diplomacy: 'diplomatic', economic: 'economic', institutional: 'institutional', defense: 'defense', intelligence: 'intelligence',
};

type DiplomaticOperation = NonNullable<Extract<ActionIntent, { kind: 'common_program' }>['operation']>;

function diplomaticOperation(intent: string): DiplomaticOperation {
  const value = normalize(intent);
  if (/\b(pacte? defense|alliance defensive|garantie militaire|defense mutuelle)\b/.test(value)) return 'defense_pact';
  if (/\b(mediation|arbitrage|rapprochement|desescalade)\b/.test(value)) return 'mediation';
  if (/\b(renseignement|information|donnees|echange d informations|partage d informations)\b/.test(value)) return 'information_sharing';
  if (/\b(cooperation|cooperer|technolog|partage|partenariat|accord)\b/.test(value)) return 'cooperation';
  return 'contact';
}

function diplomaticDossier(state: WorldState, targetId: CountryId, operation: DiplomaticOperation, intent: string): WorldEffect {
  const player = state.countries[state.playerCountryId];
  const target = state.countries[targetId];
  const labels: Record<DiplomaticOperation, string> = {
    contact: 'Canal diplomatique', cooperation: 'Coopération bilatérale', defense_pact: 'Coordination de défense',
    mediation: 'Médiation bilatérale', information_sharing: 'Partage d’informations',
  };
  const kinds: Record<DiplomaticOperation, 'cooperation' | 'security' | 'diplomatic_crisis'> = {
    contact: 'cooperation', cooperation: 'cooperation', defense_pact: 'security', mediation: 'diplomatic_crisis', information_sharing: 'security',
  };
  const id = `diplomatic-${player.id}-${targetId}-${operation}`;
  return {
    kind: 'dossier_add',
    dossier: {
      id, title: `${labels[operation]} · ${player.name}–${target?.name ?? targetId}`,
      kind: kinds[operation], status: 'active', importance: operation === 'defense_pact' ? 'major' : 'moderate',
      actorIds: [player.id, targetId], regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate,
      phase: 'Mise en œuvre', trend: 'stable', publicSummary: `Une initiative de ${labels[operation].toLocaleLowerCase('fr')} est engagée.`,
      followed: true, autoTracked: false, playerStance: intent,
      commitments: [], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [],
      entries: [{ id: `${id}-opening`, date: state.currentDate, title: 'Initiative engagée', summary: intent, importance: 'moderate', actorIds: [player.id, targetId], requiresDecision: false, visibility: 'player' }],
    },
    reason: 'Une initiative diplomatique persistante reçoit un dossier consultable.', visibility: 'player',
  };
}

function diplomaticTreaty(state: WorldState, targetId: CountryId, operation: DiplomaticOperation): WorldEffect | null {
  if (operation === 'contact' || operation === 'mediation') return null;
  const player = state.countries[state.playerCountryId];
  const treatyId = `treaty-${player.id}-${targetId}-${operation}`;
  const labels: Record<Exclude<DiplomaticOperation, 'contact' | 'mediation'>, string> = {
    cooperation: `Accord de coopération ${player.name}–${state.countries[targetId]?.name ?? targetId}`,
    defense_pact: `Pacte de défense ${player.name}–${state.countries[targetId]?.name ?? targetId}`,
    information_sharing: `Accord d’échange d’informations ${player.name}–${state.countries[targetId]?.name ?? targetId}`,
  };
  const monthlyEffects = operation === 'cooperation'
    ? [{ countryId: player.id, metric: 'industry' as const, delta: 0.12 }, { countryId: targetId, metric: 'industry' as const, delta: 0.08 }]
    : operation === 'defense_pact'
      ? [{ countryId: player.id, metric: 'security' as const, delta: 0.12 }, { countryId: targetId, metric: 'security' as const, delta: 0.08 }]
      : [];
  return { kind: 'treaty_add', treaty: { id: treatyId, parties: [player.id, targetId], label: labels[operation], status: 'active', monthlyEffects }, reason: 'L’accord diplomatique devient un engagement suivi par le moteur.', visibility: 'player' };
}

function diplomaticResolutionEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'category' | 'targetIds' | 'intent' | 'id'>,
  outcome: 'succeeded' | 'partially_succeeded' | 'failed',
  resolution: string,
): WorldEffect[] {
  if (program.category !== 'diplomacy' || program.targetIds.length === 0) return [];
  const targetId = program.targetIds[0];
  if (!targetId || !state.countries[targetId]) return [];
  const operation = diplomaticOperation(program.intent);
  const dossierId = `diplomatic-${state.playerCountryId}-${targetId}-${operation}`;
  const phase = outcome === 'succeeded' ? 'Première mise en œuvre achevée'
    : outcome === 'partially_succeeded' ? 'Mise en œuvre partielle'
      : 'Issue initiale en échec';
  const trend = outcome === 'succeeded' ? 'stable' : 'deescalating';
  return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { phase, trend, status: outcome === 'failed' ? 'deescalating' : 'active' },
      reason: 'La résolution du programme actualise le dossier diplomatique au lieu de disparaître dans le journal.',
      visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${program.id}-resolution`, date: state.currentDate, title: phase, summary: resolution,
        importance: outcome === 'failed' ? 'moderate' : 'major', actorIds: [state.playerCountryId, targetId],
        requiresDecision: outcome !== 'failed', visibility: 'player',
      },
      reason: 'Le résultat est rattaché à la chronologie permanente du dossier.', visibility: 'player',
    },
  ];
}

function linkedDossierResolutionEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'actorId' | 'targetIds' | 'linkedDossierId' | 'id' | 'title'>,
  outcome: 'succeeded' | 'partially_succeeded' | 'failed',
  resolution: string,
): WorldEffect[] {
  const dossierId = program.linkedDossierId;
  if (!dossierId) return [];
  const dossier = state.strategicDossiers[dossierId];
  if (!dossier) return [];
  const playerLed = program.actorId === state.playerCountryId;
  const phase = outcome === 'succeeded'
    ? playerLed ? 'Réponse gouvernementale efficace' : 'Initiative autonome aboutie'
    : outcome === 'partially_succeeded' ? 'Résultat partiel à consolider'
      : 'Échec et regain de pression';
  // Une action du joueur réussie peut réellement calmer la situation. Une
  // action étrangère réussie la fait progresser sans présumer qu'elle sert les
  // intérêts du joueur. Un échec ne doit jamais apaiser magiquement une crise.
  const trend = outcome === 'failed' ? 'escalating'
    : outcome === 'succeeded' ? (playerLed ? 'deescalating' : 'stable')
      : dossier.trend === 'escalating' ? 'stable' : dossier.trend;
  const status = outcome === 'succeeded' && playerLed ? 'deescalating' : 'active';
  // Même un échec est une information stratégique : le joueur doit pouvoir
  // choisir une suite, demander un dialogue, déléguer ou assumer le silence.
  const requiresPlayerDecision = outcome !== 'succeeded'
    && dossier.actorIds.includes(state.playerCountryId)
    && (dossier.importance === 'major' || dossier.importance === 'critical');
  const decision = requiresPlayerDecision
    ? `Évaluer la suite après la résolution du programme autonome dans « ${dossier.title} ».`
    : undefined;
  const pendingDecisions = decision && !dossier.pendingDecisions.includes(decision)
    ? [...dossier.pendingDecisions, decision].slice(-6)
    : dossier.pendingDecisions;
  const decisionRecords = decision
    ? [...(dossier.decisionRecords ?? []).filter((record) => record.prompt !== decision), makeDossierDecision({
      id: `${program.id}-decision`, prompt: decision, createdAt: state.currentDate,
      importance: dossier.importance, actorIds: dossier.actorIds, sourceKind: 'autonomous_program',
      sourceId: program.id,
      sourceLabel: program.title,
    })]
    : dossier.decisionRecords;
  return [
    {
      kind: 'dossier_patch', dossierId,
      patch: { phase, trend, status, pendingDecisions, ...(decisionRecords ? { decisionRecords } : {}) },
      reason: 'La résolution du programme autonome actualise le dossier qui l’a déclenché.', visibility: 'player',
    },
    {
      kind: 'dossier_entry_add', dossierId,
      entry: {
        id: `${program.id}-resolution`, date: state.currentDate, title: phase, summary: resolution,
        importance: dossier.importance, actorIds: [...new Set([program.actorId, ...program.targetIds])],
        requiresDecision: requiresPlayerDecision, visibility: 'player',
      },
      reason: 'Le résultat autonome est rattaché à la chronologie du dossier.', visibility: 'player',
    },
  ];
}

function strategicSectorInText(state: WorldState, countryId: CountryId, intent: string) {
  const normalized = normalize(intent);
  const sectorKeyword = /semi.?conduct|puce|electron/.test(normalized) ? 'semiconductors'
    : /nucleaire/.test(normalized) ? 'nuclear'
      : /engrais/.test(normalized) ? 'fertilizers'
        : /acier/.test(normalized) ? 'specialty_steel'
          : /pharma/.test(normalized) ? 'pharmaceuticals'
            : /chantier naval|naval/.test(normalized) ? 'shipbuilding'
              : /telecom/.test(normalized) ? 'telecoms'
                : /machine outil/.test(normalized) ? 'machine_tools'
                  : /armement|defense/.test(normalized) ? 'defense' : undefined;
  return sectorKeyword
    ? Object.values(state.sectors).find((item) => item.countryId === countryId && item.sector === sectorKeyword)
    : undefined;
}

function effectsFor(state: WorldState, category: CommonActionCategory, lever: CommonActionLever, targetId?: CountryId, intent = '') {
  const player = state.countries[state.playerCountryId];
  const economy = state.macroEconomies[player.id];
  const success: WorldEffect[] = [];
  const partial: WorldEffect[] = [];
  if (category === 'diplomacy' && targetId) {
    const operation = diplomaticOperation(intent);
    const relationShift: Record<DiplomaticOperation, { relation: number; trust: number }> = {
      contact: { relation: 5, trust: 3 }, cooperation: { relation: 7, trust: 5 }, defense_pact: { relation: 4, trust: 7 },
      mediation: { relation: 6, trust: 4 }, information_sharing: { relation: 3, trust: 3 },
    };
    const shift = relationShift[operation];
    success.push({ kind: 'relation_delta', from: player.id, to: targetId, relation: shift.relation, trust: shift.trust, reason: `L’opération ${operation} améliore la relation bilatérale.` });
    partial.push({ kind: 'relation_delta', from: player.id, to: targetId, relation: Math.max(1, Math.round(shift.relation / 2)), trust: Math.max(1, Math.round(shift.trust / 2)), reason: 'Le contact est établi, sans accord politique complet.' });
    if (operation === 'information_sharing') success.push({ kind: 'intelligence_delta', observerId: player.id, targetId, delta: 10, reason: 'Le partage formalisé améliore la connaissance de l’interlocuteur.' });
    success.push(diplomaticDossier(state, targetId, operation, intent));
    const treaty = diplomaticTreaty(state, targetId, operation);
    if (treaty) success.push(treaty);
  }
  if (category === 'economic' && economy) {
    if (lever === 'fiscal_stimulus') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 18, publicInvestmentPctGdp: 0.4 }, reason: 'La relance augmente durablement l’impulsion budgétaire et l’investissement public.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 7, publicInvestmentPctGdp: 0.15 }, reason: 'La relance n’est mise en œuvre que partiellement.' });
    } else if (lever === 'fiscal_consolidation') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: -16, publicInvestmentPctGdp: -0.15 }, reason: 'La consolidation réduit l’impulsion budgétaire et, avec délai, le besoin de financement.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: -6 }, reason: 'L’effort budgétaire reste limité par les résistances politiques.' });
    } else if (lever === 'trade_promotion') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { tradeOpenness: 3 }, reason: 'Le dispositif facilite durablement la prospection et les débouchés extérieurs.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { tradeOpenness: 1 }, reason: 'Quelques nouveaux débouchés sont ouverts.' });
      if (targetId) success.push({ kind: 'relation_delta', from: player.id, to: targetId, relation: 3, trust: 2, reason: 'La coopération commerciale améliore modestement le canal bilatéral.' });
    } else if (lever === 'energy_resilience') {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.2, industrialSupport: 2 }, reason: 'Le programme finance des capacités énergétiques et logistiques ; les approvisionnements restent à contractualiser.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { publicInvestmentPctGdp: 0.08 }, reason: 'Seule une partie des infrastructures énergétiques est engagée.' });
    } else if (lever === 'strategic_sector') {
      const sector = strategicSectorInText(state, player.id, intent);
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 3, publicInvestmentPctGdp: 0.2 }, reason: 'L’État concentre une part de sa politique industrielle sur une filière stratégique.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 1 }, reason: 'Le soutien transversal à la filière reste incomplet.' });
      if (sector) {
        success.push({ kind: 'sector_delta', sectorId: sector.id, delta: { capacity: 6, health: 5, technology: 2 }, reason: `La capacité et la maturité de la filière ${sector.sector} progressent.` });
        partial.push({ kind: 'sector_delta', sectorId: sector.id, delta: { health: 2, technology: 0.5 }, reason: `La filière ${sector.sector} consolide surtout sa santé industrielle.` });
      }
    } else if (lever === 'industrial_capacity') {
      success.push(
        { kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 2, reason: 'De nouvelles capacités productives renforcent le tissu industriel.' },
        { kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 4, publicInvestmentPctGdp: 0.25 }, reason: 'La politique industrielle et l’investissement public sont renforcés.' },
      );
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 0.7, reason: 'Quelques capacités productives sont consolidées.' });
    } else {
      success.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 4, publicInvestmentPctGdp: 0.1 }, reason: 'Le programme général produit une impulsion économique modérée.' });
      partial.push({ kind: 'macro_policy_delta', countryId: player.id, patch: { fiscalStance: 1.5 }, reason: 'L’impulsion économique reste limitée.' });
    }
  }
  if (category === 'institutional') {
    if (lever === 'national_reform') {
      success.push(...nationalReformEffects(state, intent, 'adopted'));
      partial.push(...nationalReformEffects(state, intent, 'partial'));
    } else if (lever === 'government_reorganization') {
      success.push({ kind: 'capacity_maximum', countryId: player.id, domain: 'government', delta: 3, reason: 'La nouvelle organisation augmente la capacité de coordination gouvernementale.' });
      partial.push({ kind: 'capacity_maximum', countryId: player.id, domain: 'government', delta: 1, reason: 'La coordination gouvernementale progresse modestement.' });
    } else if (lever === 'anti_corruption') {
      success.push(
        { kind: 'capacity_maximum', countryId: player.id, domain: 'administration', delta: 2, reason: 'Les contrôles internes réduisent les pertes d’efficacité administrative.' },
        { kind: 'politics_patch', countryId: player.id, patch: { administrativeCompliance: clamp(player.politics.administrativeCompliance + 3) }, reason: 'La mise en conformité renforce l’exécution des décisions.' },
      );
      partial.push({ kind: 'politics_patch', countryId: player.id, patch: { administrativeCompliance: clamp(player.politics.administrativeCompliance + 1) }, reason: 'Les contrôles améliorent ponctuellement la conformité.' });
    } else {
      success.push(
        { kind: 'capacity_maximum', countryId: player.id, domain: 'administration', delta: 4, reason: 'La modernisation laisse une capacité administrative durable.' },
        { kind: 'capacity_maximum', countryId: player.id, domain: 'economy', delta: 1, reason: 'Les nouveaux outils renforcent aussi la conduite économique.' },
      );
      partial.push({ kind: 'capacity_maximum', countryId: player.id, domain: 'administration', delta: 1, reason: 'La modernisation reste incomplète mais améliore un service.' });
    }
  }
  if (category === 'defense') {
    const defenseSector = Object.values(state.sectors).find((item) => item.countryId === player.id && item.sector === 'defense');
    if (lever === 'defense_industry' && defenseSector) {
      success.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { capacity: 6, health: 5, technology: 1 }, reason: 'La base industrielle de défense gagne en capacité et en robustesse.' });
      partial.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { health: 2 }, reason: 'La base industrielle de défense est seulement consolidée.' });
    } else if (lever === 'defense_procurement') {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 2.5, reason: 'Les nouveaux équipements améliorent la préparation militaire avec un délai industriel.' });
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 0.8, reason: 'Une partie seulement des équipements est disponible.' });
      if (defenseSector) success.push({ kind: 'sector_delta', sectorId: defenseSector.id, delta: { workloadMonths: 12, health: 1 }, reason: 'La commande alimente le carnet de l’industrie de défense.' });
    } else if (lever === 'force_deployment') {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 1.5, reason: 'Le déploiement améliore temporairement la posture stratégique.' });
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 0.4, reason: 'Le déploiement reste incomplet.' });
    } else {
      success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 4, reason: 'L’entraînement et la préparation améliorent la disponibilité des forces.' });
      partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 1.5, reason: 'La préparation des forces progresse partiellement.' });
    }
  }
  if (category === 'intelligence' && targetId) {
    success.push({ kind: 'intelligence_delta', observerId: player.id, targetId, delta: 18, reason: 'Le recueil ciblé améliore la connaissance de cet État.' });
    partial.push({ kind: 'intelligence_delta', observerId: player.id, targetId, delta: 7, reason: 'Le recueil fournit quelques indications, sans tableau complet.' });
  }
  return { success, partial };
}

/** Prépare une action à partir du texte, sans modifier le monde ni engager de ressource. */
export function prepareCommonAction(
  state: WorldState,
  text: string,
  options: CommonActionPreparationOptions = {},
): CommonActionPreparation {
  const intent = text.trim();
  if (intent.length < 12) return { ok: false, error: 'Décrivez une intention un peu plus précise avant de la lancer.' };
  const category = options.category ?? inferCategory(intent);
  if (!category) return { ok: false, error: 'Le moteur ne reconnaît pas encore le domaine de cette intention. Précisez s’il s’agit de diplomatie, d’économie, d’administration, de défense ou de renseignement.' };
  const targetId = targetInText(state, intent);
  const requiresTarget = category === 'diplomacy' || category === 'intelligence';
  if (requiresTarget && !targetId) {
    return { ok: false, error: 'Cette action doit nommer un pays modélisé : le moteur refuse de simuler un interlocuteur indéterminé.' };
  }
  const player = state.countries[state.playerCountryId];
  const leverProfile = actionLeverProfile(category, intent);
  const linkedHistoricalAnchorId = options.linkedDossierId
    ? state.strategicDossiers[options.linkedDossierId]?.relatedAnchorId
    : undefined;
  const requiredCapacities = leverProfile.requiredCapacities;
  const overloaded = requiredCapacities.some(({ domain, commitment }) => player.capacities[domain].committed + commitment > player.capacities[domain].maximum);
  const relation = targetId ? relationBetween(state, player.id, targetId) : undefined;
  const politicalProfile = actionLeverPolitics[leverProfile.lever];
  const politicalPathway = evaluatePoliticalPathway(state, player.id, {
    requiredAuthority: politicalProfile.requiredAuthority,
    doctrine: politicalProfile.doctrine,
    publicSalience: politicalProfile.publicSalience,
    administrativeComplexity: politicalProfile.administrativeComplexity,
  });
  const politicalEvaluation = evaluateStrategicAction(state, {
    id: `prepared-${leverProfile.lever}`,
    actorId: player.id,
    label: leverProfile.label,
    kind: categoryKinds[category],
    outcomes: politicalProfile.outcomes,
    signals: politicalProfile.decisionSignals,
    doctrine: politicalProfile.doctrine,
    requiredAuthority: politicalProfile.requiredAuthority,
    publicSalience: politicalProfile.publicSalience,
    administrativeComplexity: politicalProfile.administrativeComplexity,
    urgency: politicalProfile.urgency,
    risk: politicalProfile.risk,
    resourceCost: clamp(leverProfile.budgetCost * 5),
    metadata: { timeHorizonYears: leverProfile.durationMonths / 12 },
  });
  const base = 78 + (player.politics.administrativeCompliance - 50) * 0.22;
  const relationFactor = category === 'diplomacy' && relation ? (relation.relation - 50) * 0.18 : 0;
  const politicalModifier = (politicalEvaluation.leaderDisposition - 50) * 0.1
    + (politicalEvaluation.apparatusSupport - 50) * 0.12
    + (politicalEvaluation.institutionalFeasibility - 50) * 0.16
    + clamp(politicalEvaluation.finalScore, -40, 40) * 0.12
    - (politicalEvaluation.blocked ? 22 : 0);
  const reformOption = leverProfile.lever === 'national_reform' ? reformOptionForText(intent) : undefined;
  const reformSupport = reformOption ? nationalReformSupport(state, reformOption.domain, reformOption.targetPosition) : undefined;
  const reformModifier = reformSupport ? (reformSupport.score - 50) * 0.34 : 0;
  const successProbability = Math.round(clamp(base + relationFactor + leverProfile.difficultyModifier + politicalModifier + reformModifier - (overloaded ? 20 : 0), 12, 92));
  const warnings: string[] = [];
  if (overloaded) warnings.push('Les moyens engagés dépassent une capacité opérationnelle : le risque d’échec augmente fortement.');
  if (targetId && relation && relation.relation < 35) warnings.push(`La relation avec ${state.countries[targetId]?.name} rend l’initiative politiquement difficile.`);
  if (politicalEvaluation.blocked) warnings.push('La majorité, l’appareil ou une ligne rouge bloque actuellement la mise en œuvre normale : l’initiative a une probabilité très faible sans travail politique préalable.');
  else if (politicalEvaluation.apparatusSupport < 42) warnings.push('L’appareil politique soutient peu cette orientation et peut ralentir son exécution.');
  if (politicalEvaluation.leaderDisposition < 42) warnings.push('La direction effective est personnellement réticente à ce levier.');
  if (leverProfile.lever === 'energy_resilience') warnings.push('Ce programme développe la résilience et les infrastructures ; constituer un stock physique exige encore un contrat d’approvisionnement distinct.');
  if (reformSupport) warnings.push(...reformSupport.obstacles);
  if (leverProfile.lever === 'strategic_sector' && !strategicSectorInText(state, player.id, intent)) warnings.push('La filière demandée n’a pas encore de registre sectoriel détaillé : seuls les effets transversaux seront appliqués.');
  const effects = effectsFor(state, category, leverProfile.lever, targetId, intent);
  const operation = category === 'diplomacy' ? diplomaticOperation(intent) : undefined;
  const intentSpec = actionIntentFromProgram(
    { actorId: player.id, targetIds: targetId ? [targetId] : [], category, lever: leverProfile.lever, intent },
    options.source ?? 'player', operation,
  );
  if (options.requestId) intentSpec.requestId = options.requestId;
  return {
    ok: true,
    warnings,
    action: {
      category,
      lever: leverProfile.lever,
      actorId: player.id,
      targetIds: targetId ? [targetId] : [],
      ...(options.linkedDossierId ? { linkedDossierId: options.linkedDossierId } : {}),
      ...(linkedHistoricalAnchorId ? { historicalIntent: options.historicalIntent ?? 'contain' } : {}),
      title: `${leverProfile.label}${targetId ? ` avec ${state.countries[targetId]?.name}` : ''}`,
      intent,
      durationMonths: leverProfile.durationMonths,
      requiredCapacities,
      budgetCost: leverProfile.budgetCost,
      successProbability,
      risks: warnings.length ? warnings : ['Les oppositions, délais d’exécution ou aléas extérieurs peuvent réduire l’effet attendu.'],
      policySignals: [
        ...politicalProfile.policySignals,
        ...(leverProfile.lever === 'energy_resilience' && /\b(gaz|petrole|fossile)\b/.test(normalize(intent))
          ? [{ signal: 'fossil_expansion' as const, weight: 0.65 }] : []),
      ],
      politicalAssessment: {
        pathwayStatus: politicalPathway.status,
        doctrineCompatibility: politicalEvaluation.doctrineCompatibility,
        institutionalFeasibility: politicalEvaluation.institutionalFeasibility,
        leaderDisposition: politicalEvaluation.leaderDisposition,
        apparatusSupport: politicalEvaluation.apparatusSupport,
        finalScore: politicalEvaluation.finalScore,
        blocked: politicalEvaluation.blocked,
        reasons: politicalEvaluation.reasons.slice(0, 6),
      },
      successEffects: effects.success,
      partialEffects: effects.partial,
      intentSpec,
    },
  };
}

/**
 * Une délégation est une vraie action, mais elle engage moins directement le
 * gouvernement. Elle coûte moins, consomme moins de moyens et agit plus
 * lentement ; son influence sur un ancrage historique est donc réduite.
 */
export function prepareDossierDelegation(state: WorldState, dossierId: string, decision: string): CommonActionPreparation {
  const dossier = state.strategicDossiers[dossierId];
  if (!dossier) return { ok: false, error: 'Dossier introuvable.' };
  const prepared = prepareCommonAction(
    state,
    `Déléguer à l’administration le traitement du dossier « ${dossier.title} » : ${decision}`,
    { source: 'player', linkedDossierId: dossierId, category: 'institutional', historicalIntent: 'contain' },
  );
  if (!prepared.ok) return prepared;
  const historical = Boolean(dossier.relatedAnchorId);
  const action: PreparedCommonAction = {
    ...prepared.action,
    title: `Délégation administrative · ${dossier.title}`,
    durationMonths: prepared.action.durationMonths + 1,
    budgetCost: Number((prepared.action.budgetCost * 0.6).toFixed(1)),
    successProbability: Math.round(clamp(prepared.action.successProbability - 14, 20, 86)),
    requiredCapacities: prepared.action.requiredCapacities.map(({ domain, commitment }) => ({ domain, commitment: Math.max(1, Math.round(commitment * 0.6)) })),
    ...(historical ? { historicalContributionScale: 0.55 } : {}),
    risks: [...prepared.action.risks, 'La délégation réduit le coût politique immédiat, mais laisse moins de prise sur la trajectoire historique.'],
  };
  return { ok: true, action, warnings: [...prepared.warnings, 'Délégation : moyens et coût réduits, résultat plus lent et moins certain.'] };
}

/** Engage le programme préparé. Les effets ne sont appliqués qu'à sa résolution. */
export function launchCommonAction(state: WorldState, prepared: PreparedCommonAction) {
  const player = state.countries[prepared.actorId];
  if (!player) return { ok: false as const, state, error: 'État acteur introuvable.' };
  if (!Number.isFinite(prepared.budgetCost) || prepared.budgetCost < 0) {
    return { ok: false as const, state, error: 'Le coût du programme est invalide.' };
  }
  if (player.metrics.budget < prepared.budgetCost) {
    return { ok: false as const, state, error: `Budget insuffisant : ${prepared.budgetCost.toFixed(1)} nécessaires, ${player.metrics.budget.toFixed(1)} disponibles.` };
  }
  const program: ActionProgram = {
    ...prepared,
    id: `program-${prepared.category}-${String(state.sequence + 1).padStart(6, '0')}`,
    startedAt: state.currentDate,
    expectedCompletionAt: addMonths(state.currentDate, prepared.durationMonths),
    progressMonths: 0,
    status: 'active',
  };
  const effects: WorldEffect[] = [
    { kind: 'action_program_add', program, reason: 'Le gouvernement engage le programme et en conserve les paramètres de résolution.' },
    { kind: 'metric_delta', countryId: program.actorId, metric: 'budget', delta: -program.budgetCost, reason: 'Crédits de lancement et de coordination du programme.' },
    ...program.requiredCapacities.map(({ domain, commitment }) => ({ kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: commitment, reason: `Moyens mobilisés pour « ${program.title} » jusqu’à sa résolution.` })),
    ...(program.intentSpec?.kind === 'common_program' && program.category === 'diplomacy' && program.targetIds[0]
      ? [diplomaticDossier(state, program.targetIds[0], program.intentSpec.operation ?? 'contact', program.intent)] : []),
    ...(program.policySignals?.length ? stakeholderReactionEffects(state, {
      id: `measure-${program.id}`,
      countryId: program.actorId,
      title: program.title,
      subjectId: program.linkedDossierId ?? `program:${program.lever ?? program.category}`,
      intensity: clamp(42 + program.budgetCost * 2, 35, 88),
      signals: program.policySignals,
      effects: [],
    }) : []),
    ...(program.lever === 'national_reform' && reformDomainFromText(program.intent)
      ? [{ kind: 'national_reform_patch' as const, countryId: program.actorId, domain: reformDomainFromText(program.intent)!, patch: { activeProgramId: program.id }, reason: 'La réforme est inscrite comme programme national en cours.', visibility: 'player' as const }]
      : []),
  ];
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
      origin: 'player', intent: `Lancer : ${program.title}`, effects,
      assumptions: [`Résolution attendue vers le ${program.expectedCompletionAt}.`],
      ...(program.linkedDossierId ? { metadata: { linkedDossierId: program.linkedDossierId } } : {}),
    }),
    programId: program.id,
  };
}

/** Résolution déterministe : même sauvegarde + même calendrier = même résultat. */
export function advanceCommonActionPrograms(state: WorldState, elapsedMonths: number) {
  let next = state;
  for (const program of Object.values(state.actionPrograms ?? {})) {
    if (program.status !== 'active') continue;
    const progressMonths = Math.min(program.durationMonths, program.progressMonths + elapsedMonths);
    if (progressMonths < program.durationMonths) {
      next = commitWorldAction(next, {
        kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
        origin: 'time', visibility: 'debug', intent: `Faire avancer : ${program.title}`,
        effects: [{ kind: 'action_program_patch', programId: program.id, patch: { progressMonths: Number(progressMonths.toFixed(2)) }, reason: 'Le programme progresse pendant la frontière mensuelle.', visibility: 'debug' }],
      });
      continue;
    }
    const roll = seededUnit(next.seed, `${program.id}:${program.expectedCompletionAt}`) * 100;
    const outcome = roll <= program.successProbability ? 'succeeded' : roll <= program.successProbability + 14 ? 'partially_succeeded' : 'failed';
    // Les effets d'une réforme dépendent de l'état politique au moment où elle
    // aboutit. Ils sont donc recalculés à la résolution. Cela garantit aussi
    // qu'un échec libère activeProgramId au lieu de bloquer définitivement le
    // domaine de réforme.
    const resultEffects = program.lever === 'national_reform'
      ? nationalReformEffects(
          next,
          program.intent,
          outcome === 'succeeded' ? 'adopted' : outcome === 'partially_succeeded' ? 'partial' : 'stalled',
          program.actorId,
        )
      : outcome === 'succeeded' ? program.successEffects : outcome === 'partially_succeeded' ? program.partialEffects : [];
    const resolution = outcome === 'succeeded'
      ? 'Programme achevé : les objectifs immédiats sont atteints.'
      : outcome === 'partially_succeeded'
        ? 'Programme partiellement achevé : un résultat existe, mais il reste inférieur à l’ambition initiale.'
        : 'Programme achevé sans résultat opérationnel suffisant.';
    const releaseEffects = program.requiredCapacities.map(({ domain, commitment }) => ({
      kind: 'capacity_commitment' as const, countryId: program.actorId, domain, delta: -commitment,
      reason: `Les moyens temporaires de « ${program.title} » sont libérés.`,
    }));
    const failureEffects: WorldEffect[] = outcome === 'failed'
      ? [{ kind: 'metric_delta', countryId: program.actorId, metric: 'stability', delta: -0.5, reason: 'L’échec visible du programme entame légèrement la crédibilité du gouvernement.' }]
      : [];
    next = commitWorldAction(next, {
      kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
      origin: 'time', intent: `Résoudre : ${program.title}`,
        effects: [
          { kind: 'action_program_patch', programId: program.id, patch: { progressMonths: program.durationMonths, status: outcome, resolution }, reason: resolution },
        ...releaseEffects, ...resultEffects, ...failureEffects,
        ...linkedDossierResolutionEffects(next, program, outcome, resolution),
        ...historicalAnchorResolutionEffects(next, program, outcome),
        ...(program.linkedDossierId ? [] : diplomaticResolutionEffects(next, program, outcome, resolution)),
      ],
    });
  }
  return next;
}
