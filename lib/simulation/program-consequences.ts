import { commitWorldAction } from './ledger';
import { actionLeverPolitics } from './action-levers';
import { assessGovernmentCapacityForAction } from './government-capacity';
import { fiscalBudgetAvailable } from './fiscal';
import { nationalReformProfiles, reformDomainFromText } from './reforms';
import type { ActionProgram, WorldEffect, WorldState } from './types';

const clamp = (n: number, max = 100) => Math.max(0, Math.min(max, n));
const round = (n: number) => Number(n.toFixed(3));

function policyDossierForProgram(state: WorldState, program: ActionProgram) {
  if (!['policy_audit', 'national_reform'].includes(program.lever ?? '')) return null;
  const domain = program.reformIntent?.domain ?? program.policyDomain ?? reformDomainFromText(program.intent);
  const country = state.countries[program.actorId];
  return {
    id: `reform-${program.actorId}-${domain}`,
    title: `${country?.name ?? program.actorId} · ${nationalReformProfiles[domain].label}`,
  };
}

/**
 * Les anciennes parties pouvaient avoir créé un dossier « decision-* » portant
 * le nom du levier administratif. On le replace sur le dossier de politique
 * publique correspondant, sans perdre son historique de lecture.
 */
export function normalizePolicyProgramDossiers(state: WorldState): WorldState {
  let actionPrograms = state.actionPrograms;
  let strategicDossiers = state.strategicDossiers;
  let changed = false;
  for (const program of Object.values(state.actionPrograms ?? {})) {
    const policyDossier = policyDossierForProgram(state, program);
    const legacyId = `decision-${program.id}`;
    if (!policyDossier || program.linkedDossierId !== legacyId) continue;
    const legacy = strategicDossiers[legacyId];
    if (!legacy) continue;
    const current = strategicDossiers[policyDossier.id];
    const entries = [...(current?.entries ?? []), ...legacy.entries]
      .filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index)
      .sort((left, right) => left.date.localeCompare(right.date));
    const latest = !current || legacy.updatedAt >= current.updatedAt ? legacy : current;
    const { [legacyId]: _legacy, ...remainingDossiers } = strategicDossiers;
    strategicDossiers = {
      ...remainingDossiers,
      [policyDossier.id]: {
        ...latest,
        id: policyDossier.id,
        title: policyDossier.title,
        entries,
        relatedActionIds: [...new Set([...(current?.relatedActionIds ?? []), ...legacy.relatedActionIds, program.id])],
      },
    };
    actionPrograms = {
      ...actionPrograms,
      [program.id]: { ...program, linkedDossierId: policyDossier.id },
    };
    changed = true;
  }
  return changed ? { ...state, actionPrograms, strategicDossiers } : state;
}

const outcomeLabels: Record<string, string> = {
  governanceRisk: 'Risque de gouvernance', laborFriction: 'Tensions sociales', infrastructureCapacity: 'Capacité des infrastructures',
  goodsCapacity: 'Capacité de marchandises', nationalReach: 'Desserte nationale', developmentPotential: 'Potentiel de développement',
};

function changedPortValues(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const previous = before as Record<string, unknown>, current = after as Record<string, unknown>;
  const profileBefore = previous.portProfile as Record<string, unknown> | undefined;
  const profileAfter = current.portProfile as Record<string, unknown> | undefined;
  if (!profileBefore || !profileAfter) return [];
  const details = Object.entries(outcomeLabels).flatMap(([key, label]) => {
    const from = profileBefore[key], to = profileAfter[key];
    return typeof from === 'number' && typeof to === 'number' && from !== to
      ? [`${label} : ${Number(from.toFixed(1))} → ${Number(to.toFixed(1))}/10`] : [];
  });
  if (Array.isArray(profileBefore.capabilities) && Array.isArray(profileAfter.capabilities)) {
    const added = profileAfter.capabilities.filter((item) => !(profileBefore.capabilities as unknown[]).includes(item));
    if (added.includes('lng')) details.push('Terminal GNL désormais disponible.');
  }
  return details;
}

export function attachProgramDossier(state: WorldState, programId: string): WorldState {
  const program = state.actionPrograms[programId];
  if (!program) return state;
  const policyDossier = policyDossierForProgram(state, program);
  const usesGeneratedDossier = !program.linkedDossierId || program.linkedDossierId === `decision-${program.id}`;
  const dossierId = policyDossier && usesGeneratedDossier
    ? policyDossier.id
    : program.linkedDossierId ?? `decision-${program.id}`;
  const dossierTitle = policyDossier && dossierId === policyDossier.id
    ? policyDossier.title
    : program.title;
  const existing = state.strategicDossiers[dossierId];
  const pending = program.status === 'pending_parliament';
  const summary = program.lever === 'policy_audit'
    ? `${program.title} confirmé. Le rapport sera versé à ce dossier ; aucune réforme n’est engagée par l’audit seul.`
    : pending
    ? `${program.title} confirmé et déposé au Parlement. Aucun crédit ni moyen engagé avant adoption.`
    : `${program.title} confirmé. ${program.budgetCost.toFixed(1)} crédits engagés ; résultat attendu vers le ${program.expectedCompletionAt}.`;
  const entry = { id: `${program.id}:confirmation`, date: state.currentDate, title: pending ? 'Texte déposé' : 'Décision confirmée', summary,
    importance: 'moderate' as const, actorIds: [program.actorId, ...program.targetIds], requiresDecision: false, visibility: 'player' as const };
  const effects: WorldEffect[] = [];
  if (program.linkedDossierId !== dossierId) effects.push({ kind: 'action_program_patch', programId, patch: { linkedDossierId: dossierId }, reason: 'Le programme dispose d’un dossier persistant.' });
  if (!existing) effects.push({ kind: 'dossier_add', dossier: {
    id: dossierId, title: dossierTitle, kind: program.category === 'economic' ? 'economic' : 'security',
    importance: 'moderate', scope: 'player_involved', status: 'active', phase: pending ? 'Validation parlementaire' : program.lever === 'policy_audit' ? 'Expertise en cours' : 'Exécution en cours', trend: 'stable',
    actorIds: [...new Set([program.actorId, ...program.targetIds])], regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate,
    publicSummary: program.intent, followed: true, autoTracked: false, commitments: [], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [program.id], entries: [entry],
  }, reason: 'La décision confirmée ouvre son suivi.' });
  else if (!existing.relatedActionIds.includes(program.id)) effects.push(
    {
      kind: 'dossier_patch', dossierId,
      patch: {
        phase: pending ? 'Validation parlementaire' : program.lever === 'policy_audit' ? 'Expertise en cours' : 'Exécution en cours',
        relatedActionIds: [...existing.relatedActionIds, program.id],
        updatedAt: state.currentDate,
      },
      reason: 'Le dossier suit ce programme et affiche immédiatement sa nouvelle phase.',
    },
    { kind: 'dossier_entry_add', dossierId, entry, reason: summary });
  return effects.length ? commitWorldAction(state, { kind: 'political', actorId: program.actorId, origin: 'local_rule', intent: 'Relier la décision à son suivi', effects }) : state;
}

export function programReactions(state: WorldState, program: ActionProgram) {
  return Object.values(state.stakeholderReactions ?? {}).filter((reaction) =>
    reaction.countryId === program.actorId && reaction.status !== 'resolved'
    && reaction.relatedMeasureIds.includes(`measure-${program.id}`));
}

/** Aucun effet global additionnel : seule l'exécution du programme visé est modifiée. */
export function assessProgramExecution(state: WorldState, program: ActionProgram) {
  const reactions = programReactions(state, program);
  let resistance = 0;
  let support = 0;
  const actorLabels: string[] = [];
  for (const reaction of reactions) {
    const group = state.stakeholderGroups[reaction.groupId];
    if (!group) continue;
    const force = clamp(reaction.defiance - group.baselineDefiance) * (reaction.mobilization / 100)
      * (group.influence / 100) * (group.influenceChannels.includes('policy_execution') ? 1 : 0.5);
    if (reaction.stance === 'support') support += force;
    else resistance += force;
    actorLabels.push(`${reaction.stance === 'support' ? 'Soutien' : 'Opposition'} : ${group.label}`);
  }
  resistance = round(clamp(resistance));
  support = round(clamp(support));
  const drag = clamp((resistance - support * 0.6) / 100, 0.5);
  const administrativeComplexity = program.lever ? actionLeverPolitics[program.lever]?.administrativeComplexity ?? 50 : 50;
  const currentGovernment = assessGovernmentCapacityForAction(state, program.actorId, program.category, administrativeComplexity);
  const initialGovernmentScore = program.governmentCapacityAssessment?.score ?? currentGovernment.score;
  const governmentDelta = currentGovernment.score - initialGovernmentScore;
  // La qualité structurelle initiale a déjà calibré coût et durée. Pendant
  // l'exécution, seule son évolution (réforme, crise, surcharge) modifie le
  // rythme : pas de double pénalité cachée.
  const governmentDrift = Math.max(0.8, Math.min(1.15, 1 + governmentDelta / 100));
  return { resistance, support, actorLabels, progressRate: (1 - drag) * governmentDrift,
    governmentCapacityScore: currentGovernment.score, governmentCapacityDelta: round(governmentDelta),
    effectiveSuccessProbability: round(clamp(program.successProbability - resistance * 0.22 + support * 0.1 + governmentDelta * 0.18)) };
}

/** Reprend les effets réellement journalisés, y compris après une sauvegarde compacte. */
export function programOutcomeDetails(state: WorldState, program: ActionProgram): string[] {
  if (program.observedEffects) return program.observedEffects;
  const action = [...state.actions].reverse().find((item) => item.effects.some((effect) =>
    effect.kind === 'action_program_patch' && effect.programId === program.id
    && effect.patch.status && !['active', 'pending_parliament'].includes(effect.patch.status)));
  if (!action) return program.resolution ? [program.resolution] : [];
  const paths = new Set<string>();
  return state.ledger.filter((change) => change.actionId === action.id
    && !/actionPrograms|strategicDossiers|parliamentary/.test(change.path))
    .flatMap((change) => {
      if (paths.has(change.path)) return [];
      paths.add(change.path);
      const values = typeof change.before === 'number' && typeof change.after === 'number'
        ? ` (${Number(change.before.toFixed(2))} → ${Number(change.after.toFixed(2))})` : '';
      return [`${change.reason}${values}`, ...changedPortValues(change.before, change.after)];
    }).slice(0, 8);
}

export function programExecutionEffects(state: WorldState, program: ActionProgram, elapsedMonths: number) {
  const assessment = assessProgramExecution(state, program);
  const previous = program.execution;
  const delayMonths = round((previous?.delayMonths ?? 0) + elapsedMonths * (1 - assessment.progressRate));
  const events = previous?.events ?? [];
  const changed = assessment.actorLabels.join('|') !== (previous?.actorLabels ?? []).join('|')
    || Math.abs(assessment.resistance - (previous?.resistance ?? 0)) >= 10;
  const summary = assessment.actorLabels.length
    ? `${assessment.actorLabels.join(' ; ')}. ${assessment.resistance > assessment.support ? 'Des résistances ralentissent l’exécution.' : 'Les soutiens facilitent l’exécution.'}`
    : 'Les résistances liées à ce programme se sont résorbées.';
  const execution: NonNullable<ActionProgram['execution']> = {
    ...previous, lastAdvancedAt: state.currentDate, delayMonths,
    resistance: assessment.resistance, support: assessment.support,
    effectiveSuccessProbability: assessment.effectiveSuccessProbability,
    actorLabels: assessment.actorLabels,
    events: changed ? [...events, { date: state.currentDate, summary }].slice(-6) : events,
  };
  const effects: WorldEffect[] = [];
  if (changed && program.linkedDossierId && state.strategicDossiers[program.linkedDossierId]) effects.push({
    kind: 'dossier_entry_add', dossierId: program.linkedDossierId,
    entry: { id: `${program.id}:execution:${state.currentDate}`, date: state.currentDate,
      title: 'Rapport d’exécution', summary, importance: 'moderate', actorIds: [program.actorId], requiresDecision: false, visibility: 'player' },
    reason: 'Les réactions des parties prenantes sont reliées à la décision qui les a provoquées.', visibility: 'player',
  });
  return { assessment, execution, effects };
}

/** Une réponse politique coûte des moyens explicites et agit sur la résistance, pas sur l'objectif. */
export function respondToProgramResistance(state: WorldState, programId: string, response: 'consult' | 'maintain') {
  const program = state.actionPrograms[programId];
  if (!program || program.actorId !== state.playerCountryId || !['active', 'pending_parliament'].includes(program.status))
    return { ok: false as const, state, error: 'Ce programme ne peut plus recevoir d’arbitrage.' };
  if (!['consult', 'maintain'].includes(response)) return { ok: false as const, state, error: 'Arbitrage inconnu.' };
  if (program.execution?.lastResponseAt?.slice(0, 7) === state.currentDate.slice(0, 7))
    return { ok: false as const, state, error: 'Un arbitrage a déjà été engagé ce mois-ci pour ce programme.' };
  const opposition = programReactions(state, program).filter((item) => item.stance !== 'support');
  if (!opposition.length) return { ok: false as const, state, error: 'Aucune opposition active sur ce programme.' };
  const cost = response === 'consult' ? 0.5 : 0;
  if (fiscalBudgetAvailable(state.countries[program.actorId], 'discretionary') < cost)
    return { ok: false as const, state, error: 'Marge discrétionnaire insuffisante pour organiser la concertation (0,5).' };
  const summary = response === 'consult'
    ? 'Concertation engagée : 0,5 crédit dépensé. L’opposition recule ; les objectifs et le résultat restent à exécuter.'
    : 'Orientation maintenue : aucun crédit supplémentaire. La mobilisation adverse peut augmenter.';
  const assessment = assessProgramExecution(state, program);
  const execution: NonNullable<ActionProgram['execution']> = {
    lastAdvancedAt: program.startedAt, delayMonths: 0,
    resistance: assessment.resistance, support: assessment.support,
    effectiveSuccessProbability: assessment.effectiveSuccessProbability, actorLabels: assessment.actorLabels,
    ...program.execution,
    lastResponseAt: state.currentDate, lastResponse: response,
    events: [...(program.execution?.events ?? []), { date: state.currentDate, summary }].slice(-6),
  };
  const effects: WorldEffect[] = [
    ...opposition.map((reaction): WorldEffect => ({ kind: 'stakeholder_reaction_patch', reactionId: reaction.id,
      patch: { defiance: clamp(reaction.defiance + (response === 'consult' ? -12 : 3)),
        mobilization: clamp(reaction.mobilization + (response === 'consult' ? -8 : 5)), updatedAt: state.currentDate,
        trend: response === 'consult' ? 'falling' : 'rising' }, reason: summary, visibility: 'player' })),
    { kind: 'action_program_patch', programId, patch: { execution }, reason: summary, visibility: 'player' },
    ...(cost ? [{ kind: 'fiscal_delta' as const, countryId: program.actorId, bucket: 'discretionary' as const, delta: -cost, reason: summary }] : []),
  ];
  if (program.linkedDossierId && state.strategicDossiers[program.linkedDossierId]) effects.push({ kind: 'dossier_entry_add', dossierId: program.linkedDossierId,
    entry: { id: `${program.id}:response:${state.currentDate}`, date: state.currentDate, title: 'Arbitrage du gouvernement', summary,
      importance: 'moderate', actorIds: [program.actorId], requiresDecision: false, visibility: 'player' }, reason: summary, visibility: 'player' });
  return { ok: true as const, state: commitWorldAction(state, { kind: 'political', actorId: program.actorId, origin: 'player', intent: summary, effects }) };
}
