import { commitWorldAction, relationBetween } from './ledger';
import { makeDossierDecision } from './dossiers';
import { seededUnit } from './random';
import { actionIntentFromProgram } from './action-intents';
import type {
  ActionKind,
  ActionProgram,
  CapacityDomainId,
  CommonActionCategory,
  CountryId,
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
  if (/\b(ministere|sous ministere|administration|institution|reforme de l etat|service public)\b/.test(value)) return 'institutional';
  if (/\b(n egocier|negocier|negociation|alliance|cooperation|cooperer|dialogue|accord|partenariat|sommet|mediation)\b/.test(value)) return 'diplomacy';
  if (/\b(programme|plan|industrie|industriel|budget|investir|investissement|production|commerce|croissance|dette|emploi|energie|energetique|gaz|petrole|semiconducteur|nucleaire|relance|filiere)\b/.test(value)) return 'economic';
  return undefined;
}

const categoryLabels: Record<CommonActionCategory, string> = {
  diplomacy: 'Initiative diplomatique', economic: 'Programme économique', institutional: 'Réorganisation institutionnelle',
  defense: 'Programme de défense', intelligence: 'Opération de renseignement',
};

const categoryKinds: Record<CommonActionCategory, ActionKind> = {
  diplomacy: 'diplomatic', economic: 'economic', institutional: 'institutional', defense: 'defense', intelligence: 'intelligence',
};

function defaultCommitments(category: CommonActionCategory): Array<{ domain: CapacityDomainId; commitment: number }> {
  switch (category) {
    case 'diplomacy': return [{ domain: 'diplomacy', commitment: 5 }, { domain: 'government', commitment: 2 }];
    case 'economic': return [{ domain: 'economy', commitment: 7 }, { domain: 'administration', commitment: 4 }, { domain: 'government', commitment: 2 }];
    case 'institutional': return [{ domain: 'administration', commitment: 8 }, { domain: 'government', commitment: 5 }, { domain: 'economy', commitment: 2 }];
    case 'defense': return [{ domain: 'defense', commitment: 8 }, { domain: 'administration', commitment: 3 }, { domain: 'government', commitment: 2 }];
    case 'intelligence': return [{ domain: 'intelligence', commitment: 6 }, { domain: 'diplomacy', commitment: 2 }];
  }
}

function durationFor(category: CommonActionCategory) {
  return category === 'institutional' ? 6 : category === 'economic' ? 4 : category === 'defense' ? 3 : category === 'diplomacy' ? 2 : 2;
}

function budgetFor(category: CommonActionCategory) {
  return category === 'institutional' ? 4.5 : category === 'economic' ? 3.5 : category === 'defense' ? 4 : category === 'diplomacy' ? 0.7 : 1.2;
}

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
  const dossier = dossierId ? state.strategicDossiers[dossierId] : undefined;
  if (!dossier) return [];
  const phase = outcome === 'succeeded' ? 'Programme achevé'
    : outcome === 'partially_succeeded' ? 'Programme partiellement achevé'
      : 'Programme échoué';
  const trend = outcome === 'failed' ? 'deescalating' : outcome === 'succeeded' ? 'stable' : dossier.trend;
  // Même un échec est une information stratégique : le joueur doit pouvoir
  // choisir une suite, demander un dialogue, déléguer ou assumer le silence.
  const requiresPlayerDecision = dossier.actorIds.includes(state.playerCountryId)
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
      patch: { phase, trend, status: outcome === 'failed' ? 'deescalating' : dossier.status, pendingDecisions, ...(decisionRecords ? { decisionRecords } : {}) },
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

function effectsFor(state: WorldState, category: CommonActionCategory, targetId?: CountryId, intent = '') {
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
    success.push(
      { kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 2.5, reason: 'Le programme économique soutient l’activité industrielle.' },
      { kind: 'macro_policy_delta', countryId: player.id, patch: { industrialSupport: 4, publicInvestmentPctGdp: 0.25 }, reason: 'La priorité budgétaire et industrielle est réorientée.' },
    );
    partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 0.8, reason: 'Le programme produit un effet industriel limité.' });
    const normalized = normalize(intent);
    const sectorKeyword = /semi.?conduct|puce|electron/.test(normalized) ? 'semiconductors'
      : /nucleaire/.test(normalized) ? 'nuclear'
        : /armement|defense/.test(normalized) ? 'defense' : undefined;
    const sector = sectorKeyword && Object.values(state.sectors).find((item) => item.countryId === player.id && item.sector === sectorKeyword);
    if (sector) {
      success.push({ kind: 'sector_delta', sectorId: sector.id, delta: { capacity: 5, health: 4, workloadMonths: 12 }, reason: `Le programme cible explicitement la filière ${sector.sector}.` });
      partial.push({ kind: 'sector_delta', sectorId: sector.id, delta: { health: 1, workloadMonths: 4 }, reason: `La filière ${sector.sector} reçoit un soutien partiel.` });
    }
  }
  if (category === 'institutional') {
    success.push(
      { kind: 'capacity_maximum', countryId: player.id, domain: 'administration', delta: 4, reason: 'La réorganisation laisse une capacité administrative durable.' },
      { kind: 'capacity_maximum', countryId: player.id, domain: 'economy', delta: 2, reason: 'Les nouveaux services renforcent la conduite économique.' },
    );
    partial.push({ kind: 'capacity_maximum', countryId: player.id, domain: 'administration', delta: 1, reason: 'La réorganisation reste incomplète mais améliore un service.' });
  }
  if (category === 'defense') {
    success.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 4, reason: 'Le programme de défense améliore la préparation nationale.' });
    partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'security', delta: 1.5, reason: 'Le programme de défense améliore partiellement la préparation nationale.' });
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
  const category = inferCategory(intent);
  if (!category) return { ok: false, error: 'Le moteur ne reconnaît pas encore le domaine de cette intention. Précisez s’il s’agit de diplomatie, d’économie, d’administration, de défense ou de renseignement.' };
  const targetId = targetInText(state, intent);
  const requiresTarget = category === 'diplomacy' || category === 'intelligence';
  if (requiresTarget && !targetId) {
    return { ok: false, error: 'Cette action doit nommer un pays modélisé : le moteur refuse de simuler un interlocuteur indéterminé.' };
  }
  const player = state.countries[state.playerCountryId];
  const requiredCapacities = defaultCommitments(category);
  const overloaded = requiredCapacities.some(({ domain, commitment }) => player.capacities[domain].committed + commitment > player.capacities[domain].maximum);
  const relation = targetId ? relationBetween(state, player.id, targetId) : undefined;
  const base = 78 + (player.politics.administrativeCompliance - 50) * 0.22;
  const relationFactor = category === 'diplomacy' && relation ? (relation.relation - 50) * 0.18 : 0;
  const successProbability = Math.round(clamp(base + relationFactor - (overloaded ? 20 : 0), 25, 92));
  const warnings: string[] = [];
  if (overloaded) warnings.push('Les moyens engagés dépassent une capacité opérationnelle : le risque d’échec augmente fortement.');
  if (targetId && relation && relation.relation < 35) warnings.push(`La relation avec ${state.countries[targetId]?.name} rend l’initiative politiquement difficile.`);
  const effects = effectsFor(state, category, targetId, intent);
  const operation = category === 'diplomacy' ? diplomaticOperation(intent) : undefined;
  const intentSpec = actionIntentFromProgram(
    { actorId: player.id, targetIds: targetId ? [targetId] : [], category, intent },
    options.source ?? 'player', operation,
  );
  if (options.requestId) intentSpec.requestId = options.requestId;
  return {
    ok: true,
    warnings,
    action: {
      category,
      actorId: player.id,
      targetIds: targetId ? [targetId] : [],
      ...(options.linkedDossierId ? { linkedDossierId: options.linkedDossierId } : {}),
      title: `${categoryLabels[category]}${targetId ? ` avec ${state.countries[targetId]?.name}` : ''}`,
      intent,
      durationMonths: durationFor(category),
      requiredCapacities,
      budgetCost: budgetFor(category),
      successProbability,
      risks: warnings.length ? warnings : ['Les oppositions, délais d’exécution ou aléas extérieurs peuvent réduire l’effet attendu.'],
      successEffects: effects.success,
      partialEffects: effects.partial,
      intentSpec,
    },
  };
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
  ];
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: categoryKinds[program.category], actorId: program.actorId, targetIds: program.targetIds,
      origin: 'player', intent: `Lancer : ${program.title}`, effects,
      assumptions: [`Résolution attendue vers le ${program.expectedCompletionAt}.`],
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
    const resultEffects = outcome === 'succeeded' ? program.successEffects : outcome === 'partially_succeeded' ? program.partialEffects : [];
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
        ...(program.linkedDossierId ? [] : diplomaticResolutionEffects(next, program, outcome, resolution)),
      ],
    });
  }
  return next;
}
