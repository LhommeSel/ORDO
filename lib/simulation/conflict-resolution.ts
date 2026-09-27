import { commitWorldAction } from './ledger';
import { openDiplomaticDialogueForDossier } from './diplomacy-dialogue';
import { stakeholderReactionEffects } from './stakeholders';
import { restorationEffectsForWarZone } from './war-zones';
import type {
  ConflictExitChoice,
  ConflictExitState,
  ConflictObjectiveKind,
  ConflictPoliticalObjective,
  ConflictSituation,
  CountryId,
  DossierDecision,
  StrategicDossier,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const objectiveLabels: Record<ConflictObjectiveKind, string> = {
  demonstration_of_force: 'Démonstration de force', resource_access: 'Accès à une ressource', territorial_control: 'Contrôle territorial',
  regime_change: 'Changement de régime', security_guarantee: 'Garantie de sécurité', negotiated_settlement: 'Accord négocié', other: 'Objectif politique libre',
};

export function conflictObjectiveKindFor(statement: string): ConflictObjectiveKind {
  const value = statement.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/ressource|hydrocarb|petrol|gaz|minerai|minier|gisement|contrat energetique/.test(value)) return 'resource_access';
  if (/territoire|annex|occuper|controle territorial|frontiere|zone disputee/.test(value)) return 'territorial_control';
  if (/renvers|changement de regime|destituer|remplacer le regime/.test(value)) return 'regime_change';
  if (/garantie|securite|demilitar|retrait des forces|non agression/.test(value)) return 'security_guarantee';
  if (/negoci|cessez.le.feu|accord|paix|mediation/.test(value)) return 'negotiated_settlement';
  if (/demonstration|pression|dissuad|avertissement|montrer/.test(value)) return 'demonstration_of_force';
  return 'other';
}

export function conflictObjectiveLabel(kind: ConflictObjectiveKind) {
  return objectiveLabels[kind];
}

const exitLabels: Record<ConflictExitChoice, string> = {
  consolidate: 'Consolider le résultat',
  negotiate: 'Négocier sous pression',
  withdraw: 'Se retirer',
  armed_stalemate: 'Geler le conflit',
  continue: 'Poursuivre l’engagement',
};

export function conflictExitLabel(choice: ConflictExitChoice) {
  return exitLabels[choice];
}

function conflictParties(state: WorldState, dossier: StrategicDossier) {
  const ids = dossier.actorIds.filter((id): id is CountryId => Boolean(state.countries[id]));
  return { actorId: ids[0], targetId: ids[1] };
}

function externalPressure(dossier: StrategicDossier) {
  return (dossier.conflictState?.externalReactions ?? []).reduce((total, reaction) => total + ({ observation: 3, private_warning: 7, mediation: 5, public_warning: 14, condemnation: 22 }[reaction.posture]), 0);
}

/** Lecture commune à l'interface et à l'avance mensuelle. Les valeurs sont
 * qualitatives : elles mesurent la capacité à poursuivre une politique, pas
 * des unités de combat ou le déroulé d'une offensive réelle. */
export function conflictSituationFor(state: WorldState, dossier: StrategicDossier): ConflictSituation | null {
  const { actorId, targetId } = conflictParties(state, dossier);
  if (!actorId || !targetId) return null;
  const actor = state.countries[actorId];
  const target = state.countries[targetId];
  const actorDefense = actor.capacities.defense;
  const targetDefense = target.capacities.defense;
  const actorAvailable = Math.max(0, actorDefense.maximum - actorDefense.committed);
  const targetAvailable = Math.max(0, targetDefense.maximum - targetDefense.committed);
  const militaryBalance = clamp(50 + (actorDefense.maximum - targetDefense.maximum) * 0.65 + (actorAvailable - targetAvailable) * 0.3);
  const actorTheaters = Object.values(state.militaryTheaters ?? {}).filter((theater) => theater.countryId === actorId && theater.status === 'active');
  const deployedSupply = actorTheaters.length
    ? actorTheaters.reduce((sum, theater) => sum + theater.supplyCoverageMonths, 0) / actorTheaters.length
    : 2.5;
  const logisticalSustainment = clamp(28 + deployedSupply * 16 + actorAvailable * 0.32);
  const domesticSupport = clamp(actor.politics.publicApproval * 0.62 + actor.politics.administrativeCompliance * 0.38 - Math.max(0, actorDefense.committed - actorDefense.maximum * 0.72) * 0.35);
  const targetResistance = clamp(target.politics.publicApproval * 0.45 + target.politics.administrativeCompliance * 0.28 + targetDefense.maximum * 0.36 + targetAvailable * 0.16);
  const internationalPressure = clamp(externalPressure(dossier));
  const monthlyBudgetCost = Number((0.18 + actorDefense.maximum / 260 + Math.max(0, 55 - logisticalSustainment) / 210 + internationalPressure / 450).toFixed(2));
  const assessment = militaryBalance >= 65
    ? logisticalSustainment < 45 ? 'Avantage politique et militaire, mais logistique fragile.' : 'Avantage de moyens ; la contrainte principale est désormais politique et diplomatique.'
    : militaryBalance <= 38 ? 'Rapport de force défavorable : poursuivre reste possible, mais le coût et le risque d’enlisement augmentent.'
      : logisticalSustainment < 45 ? 'Rapport de force incertain et soutien logistique limité.'
        : 'Rapport de force disputé : aucun résultat politique n’est garanti.';
  return { militaryBalance: Number(militaryBalance.toFixed(0)), logisticalSustainment: Number(logisticalSustainment.toFixed(0)), domesticSupport: Number(domesticSupport.toFixed(0)), targetResistance: Number(targetResistance.toFixed(0)), internationalPressure: Number(internationalPressure.toFixed(0)), monthlyBudgetCost, assessment, updatedAt: state.currentDate };
}

function pendingObjectiveDecision(dossier: StrategicDossier) {
  return dossier.pendingDecisions.find((prompt) => /objectifs politiques|objectif politique|limites de l.engagement/i.test(prompt));
}

function exitExternalReactions(dossier: StrategicDossier, choice: ConflictExitChoice) {
  return (dossier.conflictState?.externalReactions ?? []).map((reaction) => {
    if (choice === 'withdraw' && ['public_warning', 'condemnation'].includes(reaction.posture)) return { ...reaction, posture: 'observation' as const, summary: `${reaction.actorLabel} prend acte du retrait et maintient une observation prudente.` };
    if (choice === 'negotiate' && ['public_warning', 'condemnation'].includes(reaction.posture)) return { ...reaction, posture: 'mediation' as const, summary: `${reaction.actorLabel} exige des garanties avant de considérer la crise comme close.` };
    if (choice === 'consolidate' && reaction.posture === 'private_warning') return { ...reaction, posture: 'public_warning' as const, summary: `${reaction.actorLabel} conteste la consolidation unilatérale du résultat obtenu.` };
    return reaction;
  });
}

function exitRelationEffects(state: WorldState, dossier: StrategicDossier, choice: ConflictExitChoice): WorldEffect[] {
  const actorId = dossier.actorIds[0] as CountryId | undefined;
  if (!actorId) return [];
  const partyIds = new Set(dossier.actorIds);
  const delta = choice === 'withdraw' ? 4 : choice === 'consolidate' ? -3 : 0;
  if (!delta) return [];
  return (dossier.conflictState?.externalReactions ?? [])
    .map((reaction) => reaction.actorId)
    .filter((id): id is CountryId => Boolean(state.countries[id as CountryId]) && !partyIds.has(id))
    .map((id) => ({ kind: 'relation_delta' as const, from: actorId, to: id, relation: delta, trust: Math.trunc(delta / 2), reason: `${exitLabels[choice]} dans « ${dossier.title} » modifie la position de ${state.countries[id]?.name ?? id}.`, visibility: 'public' as const }));
}

/**
 * Enregistre une sortie de crise. Aucun choix n'est interdit, y compris avant
 * d'avoir atteint l'objectif : le moteur matérialise alors ses conséquences
 * plutôt que d'imposer une voie "raisonnable".
 */
export function resolveConflictExit(state: WorldState, dossierId: string, choice: ConflictExitChoice) {
  const dossier = state.strategicDossiers?.[dossierId];
  const conflict = dossier?.conflictState;
  if (!dossier || dossier.kind !== 'conflict' || !conflict) return { ok: false as const, state, error: 'Cette sortie ne concerne pas un dossier de conflit actif.' };
  const actorId = dossier.actorIds[0] as CountryId | undefined;
  const targetId = dossier.actorIds.find((id) => id !== actorId && Boolean(state.countries[id])) as CountryId | undefined;
  if (!actorId || !targetId) return { ok: false as const, state, error: 'Les parties de ce conflit ne sont pas identifiées.' };

  if (choice === 'negotiate') {
    const opened = openDiplomaticDialogueForDossier(state, dossierId, `La France propose une suspension des opérations et l’ouverture immédiate de négociations, sans préjuger des termes définitifs.`, undefined, [targetId]);
    if (!opened.ok) return opened;
    const current = opened.state.strategicDossiers[dossierId];
    const zone = opened.state.warZones?.[`war-zone-${dossierId}`];
    const exit: ConflictExitState = { choice, status: 'awaiting_negotiation', chosenAt: opened.state.currentDate, summary: 'Les opérations sont suspendues pour ouvrir une négociation sous pression ; aucun accord n’est encore conclu.', enduringConsequences: ['La relation bilatérale reste dégradée.', 'Les tiers exigent des garanties vérifiables.', 'Le dossier reste ouvert jusqu’à un choix formel sur les termes.'] };
    const next = commitWorldAction(opened.state, {
      kind: 'diplomatic', actorId, targetIds: [targetId], origin: 'player', visibility: 'player', intent: `Ouvrir une négociation de sortie pour « ${dossier.title} »`,
      effects: [
        { kind: 'dossier_patch', dossierId, patch: { status: 'deescalating', trend: 'deescalating', phase: 'Négociation sous pression · termes à définir', conflictState: { ...current.conflictState!, exit, externalReactions: exitExternalReactions(current, choice) } }, reason: 'La suspension des opérations ouvre un canal, sans créer de traité.', visibility: 'player' },
        ...(zone && zone.status !== 'resolved' ? [{ kind: 'war_zone_patch' as const, warZoneId: zone.id, patch: { status: 'resolved' as const, updatedAt: opened.state.currentDate }, reason: 'Les opérations sont suspendues pendant la négociation.', visibility: 'public' as const }, ...restorationEffectsForWarZone(zone)] : []),
      ],
    });
    return { ok: true as const, state: next, dialogueId: opened.dialogueId, notice: 'Canal de négociation ouvert : les termes restent à écrire et à faire accepter.' };
  }

  const situation = conflictSituationFor(state, dossier);
  const objective = conflict.objective;
  const zone = state.warZones?.[`war-zone-${dossierId}`];
  const summaries: Record<Exclude<ConflictExitChoice, 'negotiate'>, ConflictExitState> = {
    consolidate: { choice, status: 'implemented', chosenAt: state.currentDate, summary: 'Le gouvernement consolide le résultat obtenu sans le transformer en accord accepté.', enduringConsequences: ['Le pays visé conserve un grief durable.', 'Les puissances opposées peuvent durcir leur position.', 'Le coût militaire immédiat diminue, pas le coût diplomatique.'] },
    withdraw: { choice, status: 'implemented', chosenAt: state.currentDate, summary: 'Le gouvernement met fin à l’engagement et retire sa posture coercitive.', enduringConsequences: ['La crise militaire se clôt sans accord.', 'Le coût international se réduit.', 'Des critiques intérieures peuvent dénoncer un recul.'] },
    armed_stalemate: { choice, status: 'ongoing', chosenAt: state.currentDate, summary: 'Le front est gelé : aucun règlement n’est acquis et le rapport de force reste en place.', enduringConsequences: ['Les coûts militaires et logistiques persistent.', 'La tension peut repartir à tout moment.', 'Aucune reconnaissance politique du résultat n’est obtenue.'] },
    continue: { choice, status: 'ongoing', chosenAt: state.currentDate, summary: 'Le gouvernement poursuit son engagement malgré les coûts et les réactions déjà identifiées.', enduringConsequences: ['Le coût mensuel et la pression extérieure continuent.', 'Le résultat politique reste réversible.', 'Le conflit peut gagner en intensité.'] },
  };
  const exit = summaries[choice as Exclude<ConflictExitChoice, 'negotiate'>];
  const nextObjective = objective ? { ...objective, status: choice === 'withdraw' ? 'abandoned' as const : choice === 'consolidate' ? 'achieved' as const : choice === 'armed_stalemate' ? 'blocked' as const : 'pursuing' as const, updatedAt: state.currentDate } : undefined;
  const targetMeasure = choice === 'consolidate' ? {
    id: `conflict-exit-${dossierId}-${state.sequence + 1}`, countryId: targetId, subjectId: dossierId, title: `Consolidation adverse dans ${dossier.title}`, intensity: Math.max(55, situation?.militaryBalance ?? 55), gravity: 4,
    signals: [{ signal: 'status_humiliation' as const, weight: 1 }, { signal: 'territorial_concession' as const, weight: 0.7 }], effects: [],
  } : null;
  const playerMeasure = choice === 'withdraw' ? {
    id: `conflict-withdrawal-${dossierId}-${state.sequence + 1}`, countryId: actorId, subjectId: dossierId, title: `Retrait de ${dossier.title}`, intensity: 54, gravity: 3,
    signals: [{ signal: 'status_humiliation' as const, weight: 0.85 }, { signal: 'diplomatic_deescalation' as const, weight: -0.35 }], effects: [],
  } : null;
  const closesZone = choice === 'consolidate' || choice === 'withdraw';
  const updatedConflict = { ...conflict, objective: nextObjective, exit, situation: situation ?? conflict.situation, externalReactions: exitExternalReactions(dossier, choice) };
  const next = commitWorldAction(state, {
    kind: 'defense', actorId, targetIds: [targetId], origin: 'player', visibility: 'player', intent: `${exitLabels[choice]} dans « ${dossier.title} »`,
    effects: [
      { kind: 'dossier_patch', dossierId, patch: { status: choice === 'withdraw' ? 'resolved' : choice === 'consolidate' ? 'deescalating' : 'active', trend: choice === 'continue' ? 'escalating' : choice === 'armed_stalemate' ? 'stable' : 'deescalating', phase: `${exitLabels[choice]} · ${exit.status === 'ongoing' ? 'crise toujours ouverte' : 'conséquences en cours'}`, conflictState: updatedConflict, pendingDecisions: dossier.pendingDecisions.filter((prompt) => !/Choisir la sortie politique/.test(prompt)) }, reason: exit.summary, visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId, entry: { id: `conflict-exit-${dossierId}-${state.sequence + 1}`, date: state.currentDate, title: exitLabels[choice], summary: `${exit.summary} ${exit.enduringConsequences.join(' ')}`, importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player' }, reason: 'La sortie retenue devient une conséquence persistante du dossier.', visibility: 'player' },
      ...(closesZone && zone && zone.status !== 'resolved' ? [{ kind: 'war_zone_patch' as const, warZoneId: zone.id, patch: { status: 'resolved' as const, updatedAt: state.currentDate }, reason: 'La décision politique suspend les opérations dans la zone.', visibility: 'public' as const }, ...restorationEffectsForWarZone(zone)] : []),
      ...exitRelationEffects(state, dossier, choice),
      ...(targetMeasure ? stakeholderReactionEffects(state, targetMeasure) : []),
      ...(playerMeasure ? stakeholderReactionEffects(state, playerMeasure) : []),
    ],
  });
  return { ok: true as const, state: next, notice: exit.summary };
}

/** Enregistre un objectif formulé librement. Il fixe une condition de succès,
 * pas une liste d'actions autorisées : le joueur garde ensuite le choix des
 * leviers, du rythme et du niveau de confrontation. */
export function setConflictPoliticalObjective(state: WorldState, dossierId: string, statement: string) {
  const dossier = state.strategicDossiers?.[dossierId];
  const clean = statement.trim();
  if (!dossier || dossier.kind !== 'conflict' || !dossier.conflictState || clean.length < 12) return state;
  const previous = dossier.conflictState.objective;
  const objective: ConflictPoliticalObjective = {
    kind: conflictObjectiveKindFor(clean), statement: clean, progress: previous?.status === 'achieved' ? 0 : previous?.progress ?? 0,
    status: 'planned', definedAt: state.currentDate, updatedAt: state.currentDate,
  };
  const decision = pendingObjectiveDecision(dossier);
  const pendingDecisions = decision ? dossier.pendingDecisions.filter((item) => item !== decision) : dossier.pendingDecisions;
  const decisionRecords = decision
    ? (dossier.decisionRecords ?? []).map((record): DossierDecision => record.prompt === decision && record.status === 'pending'
      ? { ...record, status: 'resolved', resolvedAt: state.currentDate, resolutionChannel: 'local_action' }
      : record)
    : dossier.decisionRecords;
  return commitWorldAction(state, {
    kind: 'political', actorId: state.playerCountryId, targetIds: dossier.actorIds, origin: 'player', visibility: 'player',
    intent: `Fixer l’objectif politique de « ${dossier.title} »`,
    effects: [
      { kind: 'dossier_patch', dossierId, patch: {
        conflictState: { ...dossier.conflictState, objective }, pendingDecisions, decisionRecords,
        phase: `Objectif politique · ${objectiveLabels[objective.kind]}`, playerStance: clean, updatedAt: state.currentDate,
      }, reason: 'Le gouvernement fixe l’objectif politique suivi par le moteur de crise.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId, entry: {
        id: `conflict-objective-${dossierId}-${state.sequence + 1}`, date: state.currentDate, title: 'Objectif politique fixé',
        summary: `${objectiveLabels[objective.kind]} : ${clean}`, importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: false, visibility: 'player',
      }, reason: 'L’objectif est ajouté à la chronologie et peut être remplacé par une nouvelle directive.', visibility: 'player' },
    ],
  });
}

function monthlyProgress(objective: ConflictPoliticalObjective, situation: ConflictSituation) {
  const base = objective.kind === 'demonstration_of_force' ? 7.5
    : objective.kind === 'security_guarantee' || objective.kind === 'negotiated_settlement' ? 3.4
      : objective.kind === 'resource_access' ? 2.7 : objective.kind === 'territorial_control' ? 2.4 : objective.kind === 'regime_change' ? 1.7 : 2.6;
  const delta = base
    + (situation.militaryBalance - 50) * 0.09
    + (situation.logisticalSustainment - 50) * 0.045
    + (situation.domesticSupport - 50) * 0.025
    - (situation.targetResistance - 50) * 0.055
    - situation.internationalPressure * 0.035;
  return Number(Math.max(-3.5, Math.min(9.5, delta)).toFixed(1));
}

/** Avance les objectifs uniquement aux frontières mensuelles. Le premier
 * résultat atteint ouvre une décision de sortie : aucun accord ni retrait ne
 * se produit sans choix explicite du joueur. */
export function advanceConflictResolution(state: WorldState): WorldState {
  let next = state;
  for (const initial of Object.values(next.strategicDossiers ?? {})) {
    const dossier = next.strategicDossiers[initial.id];
    const conflict = dossier?.conflictState;
    if (!dossier || dossier.kind !== 'conflict' || !conflict || dossier.status === 'resolved') continue;
    const situation = conflictSituationFor(next, dossier);
    if (!situation) continue;
    const objective = conflict.objective;
    const isWar = conflict.stage === 'war' && conflict.warThresholdConfirmed === true;
    const effects: WorldEffect[] = [];
    if (!objective || !isWar || ['achieved', 'abandoned', 'blocked'].includes(objective.status)) {
      effects.push({ kind: 'dossier_patch', dossierId: dossier.id, patch: { conflictState: { ...conflict, situation } }, reason: 'La lecture stratégique de la crise est actualisée.', visibility: 'player' });
    } else {
      const delta = monthlyProgress(objective, situation);
      const progress = clamp(objective.progress + delta);
      const status = progress >= 100 ? 'achieved' as const : progress <= 0 && delta < 0 ? 'blocked' as const : 'pursuing' as const;
      const nextObjective = { ...objective, progress: Number(progress.toFixed(1)), status, updatedAt: next.currentDate };
      effects.push(
        { kind: 'fiscal_delta', countryId: dossier.actorIds[0] as CountryId, bucket: 'discretionary', delta: -situation.monthlyBudgetCost, reason: `Coût mensuel de la poursuite de l’objectif « ${objectiveLabels[objective.kind]} » dans ${dossier.title}.`, visibility: 'player' },
        { kind: 'dossier_patch', dossierId: dossier.id, patch: {
          conflictState: { ...conflict, objective: nextObjective, situation },
          phase: status === 'achieved' ? 'Objectif atteint · choisir la sortie politique' : `Objectif en cours · ${objectiveLabels[objective.kind]}`,
          ...(status === 'achieved' ? { pendingDecisions: [...dossier.pendingDecisions, 'Choisir la sortie politique après l’atteinte de l’objectif : consolider, négocier ou poursuivre.'] } : {}),
        }, reason: 'Le moteur actualise la progression politique, les coûts et les contraintes de la crise.', visibility: 'player' },
      );
      if (status === 'achieved') effects.push({ kind: 'dossier_entry_add', dossierId: dossier.id, entry: {
        id: `conflict-objective-achieved-${dossier.id}-${next.sequence + 1}`, date: next.currentDate, title: 'Objectif politique atteint',
        summary: `L’objectif « ${objective.statement} » atteint un seuil suffisant. Le gouvernement doit décider s’il consolide le résultat, négocie ou poursuit l’engagement.`, importance: dossier.importance, actorIds: dossier.actorIds, requiresDecision: true, visibility: 'player',
      }, reason: 'L’atteinte d’un objectif politique ouvre une décision de sortie, sans imposer la paix.', visibility: 'player' });
    }
    if (effects.length) next = commitWorldAction(next, {
      kind: 'defense', actorId: dossier.actorIds[0] as CountryId, targetIds: dossier.actorIds.slice(1), origin: 'time', visibility: 'player',
      intent: `Réévaluer l’objectif politique de « ${dossier.title} »`, effects,
    });
  }
  return next;
}
