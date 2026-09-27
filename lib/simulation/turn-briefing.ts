import type { ActionProgram, StrategicDossier, WorldState } from './types';
import { dossierDisplayScopeFor } from './dossier-scope';

export type TurnBriefingMetric = {
  id: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  unit: string;
  digits: number;
};

export type TurnBriefingHighlight = {
  id: string;
  title: string;
  detail: string;
  tone: 'major' | 'moderate' | 'positive' | 'neutral';
  scope: 'player' | 'world';
  dossierId?: string;
  /** Une tendance observable reste dans Monde tant qu'elle n'est pas devenue dossier. */
  anchorId?: string;
  modifierId?: string;
};

export type TurnBriefingProgram = {
  id: string;
  title: string;
  status: ActionProgram['status'];
  progressMonths: number;
  durationMonths: number;
  expectedCompletionAt: string;
  dossierId?: string;
};

export type TurnBriefingShock = {
  id: string;
  label: string;
  channel: string;
  intensity: number;
  remainingMonths: number;
  status: 'new' | 'intensifying' | 'easing' | 'ended';
  scope: 'player' | 'world';
};

export type TurnBriefing = {
  from: string;
  to: string;
  elapsedMonths: number;
  actionCount: number;
  autonomousActorCount: number;
  metrics: TurnBriefingMetric[];
  highlights: TurnBriefingHighlight[];
  playerHighlights: TurnBriefingHighlight[];
  worldHighlights: TurnBriefingHighlight[];
  /** Nouvelles décisions devenues explicites pendant ce passage. */
  decisionHighlights: TurnBriefingHighlight[];
  /** Franchissements de seuil structurel pendant ce passage. */
  structuralModifierHighlights: TurnBriefingHighlight[];
  /** Décisions encore ouvertes à la fin du passage, y compris les anciennes. */
  pendingDecisionCount: number;
  programUpdates: TurnBriefingProgram[];
  completedPrograms: Array<{ id: string; title: string; status: ActionProgram['status']; resolution?: string; reformOutcome?: ActionProgram['reformOutcome'] }>;
  shockUpdates: TurnBriefingShock[];
  /** Tâches qui attendent une décision explicite, afin que le passage du temps
   * ne transforme jamais une réponse IA en effet invisible. */
  aiJobsQueued: number;
  aiJobsPending: number;
  aiJobsFailed: number;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const monthsBetween = (start: string, end: string) => {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth + (endDay - startDay) / 30.4375);
};

function metric(id: string, label: string, before: number, after: number, unit: string, digits: number): TurnBriefingMetric {
  return { id, label, before: round(before, digits), after: round(after, digits), delta: round(after - before, digits), unit, digits };
}

function dossierTone(dossier: StrategicDossier): TurnBriefingHighlight['tone'] {
  if (dossier.importance === 'critical' || dossier.importance === 'major') return 'major';
  return dossier.trend === 'deescalating' || dossier.status === 'resolved' ? 'positive' : 'moderate';
}

// Ces entrées restent dans la chronologie détaillée du dossier, mais ne sont
// pas assez narratives pour interrompre la succession de faits sur la carte.
function isRoutineDossierEntry(title: string) {
  return /^(Revue locale|Conséquences systémiques actualisées|Dossier mis en sommeil)/.test(title);
}

function dossierHighlights(before: WorldState, after: WorldState): TurnBriefingHighlight[] {
  const highlights: TurnBriefingHighlight[] = [];
  for (const dossier of Object.values(after.strategicDossiers ?? {})) {
    // Les votes multilatéraux sont regroupés dans le module des organisations
    // internationales ; les dupliquer dans le briefing saturerait la carte
    // d'événements alors que le joueur peut les consulter dans leur registre.
    if (dossier.id.startsWith('international-')) continue;
    const scope = dossierDisplayScopeFor(after, dossier) === 'national' ? 'player' : 'world';
    const previous = before.strategicDossiers?.[dossier.id];
    if (!previous) {
      highlights.push({ id: `new-${dossier.id}`, title: `Nouveau dossier · ${dossier.title}`, detail: `${dossier.phase} — ${dossier.publicSummary}`, tone: dossierTone(dossier), scope, dossierId: dossier.id });
      continue;
    }
    const previousEntries = new Set(previous.entries.map((entry) => entry.id));
    const newEntries = dossier.entries.slice().reverse().filter((item) => !previousEntries.has(item.id)
      && item.visibility !== 'debug');
    const newEntry = newEntries.find((item) => !isRoutineDossierEntry(item.title));
    const reactionEntry = newEntries.find((item) => item.title === 'Réactions internationales');
    // Une réaction étrangère est la conséquence directe d'un choix du joueur.
    // Elle passe avant le libellé administratif de changement de phase, afin
    // que la carte raconte la causalité plutôt que la mécanique interne.
    if (reactionEntry) {
      highlights.push({
        id: `entry-${reactionEntry.id}`, title: `${dossier.title} · ${reactionEntry.title}`, detail: reactionEntry.summary,
        tone: reactionEntry.importance === 'major' || reactionEntry.importance === 'critical' ? 'major' : dossierTone(dossier),
        // Le dossier peut rester mondial, mais la réaction répond directement
        // à un ordre du pays joué : elle doit donc figurer dans son bilan.
        scope: 'player', dossierId: dossier.id,
      });
      continue;
    }
    if (previous.status !== dossier.status) {
      highlights.push({
        id: `status-${dossier.id}-${dossier.status}`,
        title: dossier.status === 'resolved' ? `Dossier stabilisé · ${dossier.title}` : `Changement de phase · ${dossier.title}`,
        detail: `${previous.status} → ${dossier.status} · ${dossier.phase}`,
        tone: dossier.status === 'resolved' || dossier.status === 'deescalating' ? 'positive' : dossierTone(dossier), scope, dossierId: dossier.id,
      });
      continue;
    }
    if (previous.importance !== dossier.importance || previous.trend !== dossier.trend) {
      highlights.push({
        id: `trajectory-${dossier.id}`,
        title: `Trajectoire modifiée · ${dossier.title}`,
        detail: `${previous.importance}/${previous.trend} → ${dossier.importance}/${dossier.trend} · ${dossier.phase}`,
        tone: dossierTone(dossier), scope, dossierId: dossier.id,
      });
      continue;
    }
    const entry = newEntry;
    if (entry && !isRoutineDossierEntry(entry.title) && (entry.importance === 'moderate' || entry.importance === 'major' || entry.importance === 'critical' || entry.requiresDecision)) {
      highlights.push({ id: `entry-${entry.id}`, title: `${dossier.title} · ${entry.title}`, detail: entry.summary, tone: dossierTone(dossier), scope, dossierId: dossier.id });
    }
  }
  const rank = { major: 0, moderate: 1, positive: 2, neutral: 3 } as const;
  return highlights.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

function worldEventHighlights(before: WorldState, after: WorldState): TurnBriefingHighlight[] {
  const previousIds = new Set((before.worldEvents ?? []).map((event) => event.id));
  return (after.worldEvents ?? [])
    .filter((event) => !previousIds.has(event.id))
    .map((event) => ({
      id: `event-${event.id}`,
      title: `${event.scope === 'world' ? 'Événement mondial' : 'Événement national'} · ${event.title}`,
      detail: event.summary,
      tone: event.importance === 'major' ? 'major' : event.importance === 'moderate' ? 'moderate' : 'neutral',
      scope: event.scope === 'national' ? 'player' : 'world',
      dossierId: event.dossierId,
    }));
}

function historicalAnchorHighlights(before: WorldState, after: WorldState): TurnBriefingHighlight[] {
  const highlights: TurnBriefingHighlight[] = [];
  for (const anchor of Object.values(after.historicalAnchors ?? {})) {
    if (anchor.playerVisibility === 'hidden' || after.currentDate < anchor.probableWindow.start) continue;
    const previous = before.historicalAnchors?.[anchor.id];
    if (!previous || previous.status === anchor.status) continue;
    // Dès qu'une tendance a son dossier concret, celui-ci porte son suivi pour
    // éviter de compter deux fois le même changement dans le rapport.
    if (anchor.dossierId && after.strategicDossiers[anchor.dossierId]) continue;
    if (!['proposed', 'active', 'manifested', 'disrupted'].includes(anchor.status)) continue;
    const label = anchor.status === 'proposed' ? 'Tendance à surveiller'
      : anchor.status === 'active' ? 'Tendance qui s’affirme'
        : anchor.status === 'manifested' ? 'Tendance manifestée' : 'Tendance infléchie';
    highlights.push({
      id: `anchor-${anchor.id}-${anchor.status}`,
      title: `${label} · ${anchor.trendTitle}`,
      detail: `${anchor.trendSummary} Aucune décision n’est imposée à ce stade.`,
      tone: anchor.status === 'manifested' ? 'major' : anchor.importance === 'major' || anchor.importance === 'critical' ? 'moderate' : 'neutral',
      scope: 'world', anchorId: anchor.id,
    });
  }
  return highlights;
}

function decisionHighlights(before: WorldState, after: WorldState): TurnBriefingHighlight[] {
  const highlights: TurnBriefingHighlight[] = [];
  for (const dossier of Object.values(after.strategicDossiers ?? {})) {
    if (dossier.status === 'resolved' || dossier.sleepingAt || dossier.pendingDecisions.length === 0) continue;
    const previous = before.strategicDossiers?.[dossier.id];
    const previousPending = new Set(previous?.pendingDecisions ?? []);
    const newPrompts = dossier.pendingDecisions.filter((prompt) => !previousPending.has(prompt));
    const wasEscalated = dossier.lastEscalatedAt === after.currentDate;
    if (previous && newPrompts.length === 0 && !wasEscalated) continue;
    const prompt = newPrompts.at(-1) ?? dossier.pendingDecisions.at(-1);
    highlights.push({
      id: `decision-${dossier.id}-${after.currentDate}`,
      title: `Décision attendue · ${dossier.title}`,
      detail: prompt ?? 'Le dossier appelle un arbitrage explicite du gouvernement.',
      tone: dossier.importance === 'critical' || dossier.importance === 'major' ? 'major' : 'moderate',
      // Une décision pendante est une tâche du joueur même lorsque le dossier
      // concerne d’abord plusieurs pays et reste affiché dans Monde.
      scope: 'player',
      dossierId: dossier.id,
    });
  }
  return highlights.sort((a, b) => (a.tone === 'major' ? -1 : 1) - (b.tone === 'major' ? -1 : 1) || a.title.localeCompare(b.title));
}

function structuralModifierHighlights(before: WorldState, after: WorldState): TurnBriefingHighlight[] {
  const highlights: TurnBriefingHighlight[] = [];
  for (const [countryId, modifiers] of Object.entries(after.structuralModifiers ?? {})) {
    const previousModifiers = new Map((before.structuralModifiers?.[countryId] ?? []).map((modifier) => [modifier.id, modifier]));
    for (const modifier of modifiers) {
      const previous = previousModifiers.get(modifier.id);
      if (!previous) continue;
      const activeChanged = previous.active !== modifier.active;
      const intensityChanged = Math.abs(previous.intensity - modifier.intensity) >= 3;
      if (!activeChanged && !intensityChanged) continue;
      // Les tensions faibles des autres États vivent dans leur simulation ; le
      // briefing mondial ne remonte que les crises franchies. Cela évite de
      // transformer chaque variation économique locale en actualité mondiale.
      if (countryId !== after.playerCountryId && previous.intensity < 50 && modifier.intensity < 50) continue;
      const transition = modifier.lastTransition === 'activated' ? 'Seuil franchi'
        : modifier.lastTransition === 'deactivated' ? 'Seuil résorbé'
          : modifier.lastTransition === 'intensified' ? 'Pression renforcée' : modifier.lastTransition === 'eased' ? 'Pression relâchée' : 'Évolution structurelle';
      highlights.push({
        id: `modifier-${modifier.id}-${after.currentDate}`,
        title: `${transition} · ${modifier.label}`,
        detail: `${modifier.summary} ${modifier.active ? 'La situation influence désormais les décisions concernées.' : 'La situation revient à un niveau de surveillance.'}`,
        tone: modifier.active ? (modifier.lastTransition === 'activated' || modifier.lastTransition === 'intensified' ? 'moderate' : 'neutral') : 'positive',
        scope: countryId === after.playerCountryId ? 'player' : 'world',
        modifierId: modifier.id,
      });
    }
  }
  return highlights.sort((a, b) => (a.tone === 'moderate' ? -1 : 1) - (b.tone === 'moderate' ? -1 : 1));
}

/**
 * Résumé des chocs qui ont réellement changé entre deux frontières.
 * Les oscillations inférieures à deux points ne remontent pas au joueur afin
 * de conserver un briefing utile, tandis qu'une disparition reste signalée.
 */
function shockUpdates(before: WorldState, after: WorldState): TurnBriefingShock[] {
  const previous = new Map(before.worldEconomy.activeShocks.map((shock) => [shock.id, shock]));
  const updates: TurnBriefingShock[] = [];
  for (const shock of after.worldEconomy.activeShocks) {
    const old = previous.get(shock.id);
    const scope = shock.affectedCountryIds.length > 0 && shock.affectedCountryIds.includes(after.playerCountryId) ? 'player' : 'world';
    const status: TurnBriefingShock['status'] = !old
      ? 'new'
      : Math.abs(shock.intensity) > Math.abs(old.intensity) + 2 ? 'intensifying'
        : Math.abs(shock.intensity) < Math.abs(old.intensity) - 2 ? 'easing' : 'easing';
    if (!old || Math.abs(shock.intensity - old.intensity) >= 2 || shock.remainingMonths < old.remainingMonths - 1) {
      updates.push({ id: shock.id, label: shock.label, channel: shock.channel, intensity: shock.intensity, remainingMonths: shock.remainingMonths, status, scope });
    }
  }
  const activeIds = new Set(after.worldEconomy.activeShocks.map((shock) => shock.id));
  for (const shock of before.worldEconomy.activeShocks) {
    if (activeIds.has(shock.id)) continue;
    updates.push({
      id: shock.id, label: shock.label, channel: shock.channel, intensity: shock.intensity, remainingMonths: 0,
      status: 'ended', scope: shock.affectedCountryIds.length > 0 && shock.affectedCountryIds.includes(after.playerCountryId) ? 'player' : 'world',
    });
  }
  return updates
    .sort((left, right) => Number(right.status === 'new' || right.status === 'intensifying') - Number(left.status === 'new' || left.status === 'intensifying')
      || Math.abs(right.intensity) - Math.abs(left.intensity) || left.id.localeCompare(right.id))
    .slice(0, 6);
}

/**
 * Produit un compte rendu éphémère : il ne duplique rien dans la sauvegarde et
 * résume uniquement les différences observables entre deux états du monde.
 */
export function buildTurnBriefing(before: WorldState, after: WorldState): TurnBriefing {
  const beforeActionIds = new Set(before.actions.map((action) => action.id));
  const newActions = after.actions.filter((action) => !beforeActionIds.has(action.id));
  const beforePrograms = before.actionPrograms ?? {};
  const completedPrograms = Object.values(after.actionPrograms ?? {})
    .filter((program) => beforePrograms[program.id]?.status === 'active' && program.status !== 'active')
    .map((program) => ({ id: program.id, title: program.title, status: program.status, resolution: program.resolution, reformOutcome: program.reformOutcome }))
    .slice(0, 6);
  const beforeMacro = before.macroEconomies[before.playerCountryId];
  const afterMacro = after.macroEconomies[after.playerCountryId];
  const beforeCountry = before.countries[before.playerCountryId];
  const afterCountry = after.countries[after.playerCountryId];
  const beforeFiscal = beforeCountry?.fiscal;
  const afterFiscal = afterCountry?.fiscal;
  const metrics = beforeMacro && afterMacro && beforeCountry && afterCountry ? [
    metric('gdp', 'PIB réel', beforeMacro.realGdpBillion2000Usd, afterMacro.realGdpBillion2000Usd, ' Md$', 1),
    metric('growth', 'Croissance', beforeMacro.realGrowthAnnualPct, afterMacro.realGrowthAnnualPct, ' %', 2),
    metric('inflation', 'Inflation', beforeMacro.inflationAnnualPct, afterMacro.inflationAnnualPct, ' %', 2),
    metric('unemployment', 'Chômage', beforeMacro.unemploymentPct, afterMacro.unemploymentPct, ' %', 2),
    metric('fiscal-balance', 'Solde public', beforeFiscal?.fiscalBalancePctGDP ?? 0, afterFiscal?.fiscalBalancePctGDP ?? 0, ' % PIB', 2),
    metric('budget', 'Marge discrétionnaire', beforeFiscal?.discretionaryMargin ?? 0, afterFiscal?.discretionaryMargin ?? 0, ' crédits', 1),
    metric('recurring-commitments', 'Engagements durables', (beforeFiscal?.recurringProgramCosts ?? 0) - (beforeFiscal?.recurringProgramSavings ?? 0), (afterFiscal?.recurringProgramCosts ?? 0) - (afterFiscal?.recurringProgramSavings ?? 0), ' crédits/an', 1),
  ] : [];
  const dossierChanges = dossierHighlights(before, after);
  const changedDossierIds = new Set(dossierChanges.flatMap((highlight) => highlight.dossierId ? [highlight.dossierId] : []));
  const eventChanges = worldEventHighlights(before, after)
    // Le dossier porte la phase et la suite lorsqu’il change dans le même
    // passage ; garder aussi l’événement créerait deux alertes pour un seul
    // fait. Les événements liés restent visibles dans le registre mondial.
    .filter((highlight) => !highlight.dossierId || !changedDossierIds.has(highlight.dossierId));
  const highlights = [...eventChanges, ...dossierChanges, ...historicalAnchorHighlights(before, after)];
  const playerHighlights = highlights.filter((item) => item.scope === 'player').slice(0, 6);
  const worldHighlights = highlights.filter((item) => item.scope === 'world').slice(0, 6);
  const newDecisionHighlights = decisionHighlights(before, after);
  const newStructuralModifierHighlights = structuralModifierHighlights(before, after);
  const pendingDecisionCount = Object.values(after.strategicDossiers ?? {})
    .filter((dossier) => dossier.status !== 'resolved' && !dossier.sleepingAt)
    .reduce((total, dossier) => total + dossier.pendingDecisions.length, 0);
  const beforeJobIds = new Set(Object.keys(before.aiJobs ?? {}));
  const aiJobsQueued = Object.values(after.aiJobs ?? {}).filter((job) => !beforeJobIds.has(job.id)).length;
  const aiJobsPending = Object.values(after.aiJobs ?? {}).filter((job) => job.status === 'pending').length;
  const aiJobsFailed = Object.values(after.aiJobs ?? {}).filter((job) => job.status === 'failed').length;
  const programUpdates = Object.values(after.actionPrograms ?? {})
    .filter((program) => program.actorId === after.playerCountryId && ['active', 'pending_parliament'].includes(program.status))
    .filter((program) => {
      const previous = beforePrograms[program.id];
      return !previous || previous.progressMonths !== program.progressMonths || previous.status !== program.status;
    })
    .sort((left, right) => right.progressMonths - left.progressMonths || left.expectedCompletionAt.localeCompare(right.expectedCompletionAt))
    .slice(0, 3)
    .map((program) => ({ id: program.id, title: program.title, status: program.status, progressMonths: program.progressMonths, durationMonths: program.durationMonths, expectedCompletionAt: program.expectedCompletionAt, dossierId: program.linkedDossierId }));
  return {
    from: before.currentDate,
    to: after.currentDate,
    elapsedMonths: round(monthsBetween(before.currentDate, after.currentDate), 1),
    actionCount: newActions.filter((action) => action.kind !== 'time_advance').length,
    autonomousActorCount: new Set(newActions.filter((action) => action.actorId !== after.playerCountryId).map((action) => action.actorId)).size,
    metrics,
    highlights: [...playerHighlights, ...worldHighlights],
    playerHighlights,
    worldHighlights,
    decisionHighlights: newDecisionHighlights,
    structuralModifierHighlights: newStructuralModifierHighlights,
    pendingDecisionCount,
    programUpdates,
    completedPrograms,
    shockUpdates: shockUpdates(before, after),
    aiJobsQueued,
    aiJobsPending,
    aiJobsFailed,
  };
}
