import { commitWorldAction, relationBetween } from './ledger';
import { seededUnit } from './random';
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

export type PreparedCommonAction = Omit<ActionProgram, 'id' | 'startedAt' | 'expectedCompletionAt' | 'progressMonths' | 'status' | 'resolution'>;

export type CommonActionPreparation =
  | { ok: true; action: PreparedCommonAction; warnings: string[] }
  | { ok: false; error: string };

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

function inferCategory(text: string): CommonActionCategory {
  const value = normalize(text);
  if (/\b(renseignement|dgse|espion|surveill|infiltr|ecoute)\b/.test(value)) return 'intelligence';
  if (/\b(militaire|defense|armee|arme|troupe|deploi|dissuasion)\b/.test(value)) return 'defense';
  if (/\b(ministere|sous ministere|administration|institution|reforme de l etat|service public)\b/.test(value)) return 'institutional';
  if (/\b(n egocier|negocier|negociation|alliance|cooperation|cooperer|dialogue|accord|partenariat|sommet|mediation)\b/.test(value)) return 'diplomacy';
  return 'economic';
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

function effectsFor(state: WorldState, category: CommonActionCategory, targetId?: CountryId) {
  const player = state.countries[state.playerCountryId];
  const economy = state.macroEconomies[player.id];
  const success: WorldEffect[] = [];
  const partial: WorldEffect[] = [];
  if (category === 'diplomacy' && targetId) {
    success.push({ kind: 'relation_delta', from: player.id, to: targetId, relation: 5, trust: 3, reason: 'Le canal politique créé par le programme améliore la relation bilatérale.' });
    partial.push({ kind: 'relation_delta', from: player.id, to: targetId, relation: 2, trust: 1, reason: 'Le contact est établi, sans accord politique complet.' });
  }
  if (category === 'economic' && economy) {
    success.push(
      { kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 2.5, reason: 'Le programme économique soutient l’activité industrielle.' },
      { kind: 'macro_patch', countryId: player.id, patch: { policy: { ...economy.policy, industrialSupport: clamp(economy.policy.industrialSupport + 4), publicInvestmentPctGdp: Number((economy.policy.publicInvestmentPctGdp + 0.25).toFixed(2)) } }, reason: 'La priorité budgétaire et industrielle est réorientée.' },
    );
    partial.push({ kind: 'metric_delta', countryId: player.id, metric: 'industry', delta: 0.8, reason: 'Le programme produit un effet industriel limité.' });
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
export function prepareCommonAction(state: WorldState, text: string): CommonActionPreparation {
  const intent = text.trim();
  if (intent.length < 12) return { ok: false, error: 'Décrivez une intention un peu plus précise avant de la lancer.' };
  const category = inferCategory(intent);
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
  const effects = effectsFor(state, category, targetId);
  return {
    ok: true,
    warnings,
    action: {
      category,
      actorId: player.id,
      targetIds: targetId ? [targetId] : [],
      title: `${categoryLabels[category]}${targetId ? ` avec ${state.countries[targetId]?.name}` : ''}`,
      intent,
      durationMonths: durationFor(category),
      requiredCapacities,
      budgetCost: budgetFor(category),
      successProbability,
      risks: warnings.length ? warnings : ['Les oppositions, délais d’exécution ou aléas extérieurs peuvent réduire l’effet attendu.'],
      successEffects: effects.success,
      partialEffects: effects.partial,
    },
  };
}

/** Engage le programme préparé. Les effets ne sont appliqués qu'à sa résolution. */
export function launchCommonAction(state: WorldState, prepared: PreparedCommonAction) {
  const player = state.countries[prepared.actorId];
  if (!player) return { ok: false as const, state, error: 'État acteur introuvable.' };
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
      ],
    });
  }
  return next;
}
