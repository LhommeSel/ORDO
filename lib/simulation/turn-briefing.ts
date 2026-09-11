import type { ActionProgram, StrategicDossier, WorldState } from './types';

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
  dossierId?: string;
};

export type TurnBriefing = {
  from: string;
  to: string;
  elapsedMonths: number;
  actionCount: number;
  autonomousActorCount: number;
  metrics: TurnBriefingMetric[];
  highlights: TurnBriefingHighlight[];
  completedPrograms: Array<{ id: string; title: string; status: ActionProgram['status']; resolution?: string }>;
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

function dossierHighlights(before: WorldState, after: WorldState): TurnBriefingHighlight[] {
  const highlights: TurnBriefingHighlight[] = [];
  for (const dossier of Object.values(after.strategicDossiers ?? {})) {
    const debtCountryId = dossier.id.startsWith('sovereign-debt-') ? dossier.actorIds.find((id) => Boolean(after.macroEconomies[id])) : undefined;
    const debtRelevant = !debtCountryId || debtCountryId === after.playerCountryId || after.macroEconomies[debtCountryId]?.sovereignDebt.status === 'default';
    if (!debtRelevant) continue;
    const previous = before.strategicDossiers?.[dossier.id];
    if (!previous) {
      highlights.push({ id: `new-${dossier.id}`, title: `Nouveau dossier · ${dossier.title}`, detail: `${dossier.phase} — ${dossier.publicSummary}`, tone: dossierTone(dossier), dossierId: dossier.id });
      continue;
    }
    if (previous.status !== dossier.status) {
      highlights.push({
        id: `status-${dossier.id}-${dossier.status}`,
        title: dossier.status === 'resolved' ? `Dossier stabilisé · ${dossier.title}` : `Changement de phase · ${dossier.title}`,
        detail: `${previous.status} → ${dossier.status} · ${dossier.phase}`,
        tone: dossier.status === 'resolved' || dossier.status === 'deescalating' ? 'positive' : dossierTone(dossier), dossierId: dossier.id,
      });
      continue;
    }
    if (previous.importance !== dossier.importance || previous.trend !== dossier.trend) {
      highlights.push({
        id: `trajectory-${dossier.id}`,
        title: `Trajectoire modifiée · ${dossier.title}`,
        detail: `${previous.importance}/${previous.trend} → ${dossier.importance}/${dossier.trend} · ${dossier.phase}`,
        tone: dossierTone(dossier), dossierId: dossier.id,
      });
      continue;
    }
    const previousEntries = new Set(previous.entries.map((entry) => entry.id));
    const entry = dossier.entries.slice().reverse().find((item) => !previousEntries.has(item.id) && item.visibility !== 'debug');
    if (entry && (entry.importance === 'moderate' || entry.importance === 'major' || entry.importance === 'critical' || entry.requiresDecision)) {
      highlights.push({ id: `entry-${entry.id}`, title: `${dossier.title} · ${entry.title}`, detail: entry.summary, tone: dossierTone(dossier), dossierId: dossier.id });
    }
  }
  const rank = { major: 0, moderate: 1, positive: 2, neutral: 3 } as const;
  return highlights.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
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
    .map((program) => ({ id: program.id, title: program.title, status: program.status, resolution: program.resolution }))
    .slice(0, 6);
  const beforeMacro = before.macroEconomies[before.playerCountryId];
  const afterMacro = after.macroEconomies[after.playerCountryId];
  const beforeCountry = before.countries[before.playerCountryId];
  const afterCountry = after.countries[after.playerCountryId];
  const metrics = beforeMacro && afterMacro && beforeCountry && afterCountry ? [
    metric('gdp', 'PIB réel', beforeMacro.realGdpBillion2000Usd, afterMacro.realGdpBillion2000Usd, ' Md$', 1),
    metric('growth', 'Croissance', beforeMacro.realGrowthAnnualPct, afterMacro.realGrowthAnnualPct, ' %', 2),
    metric('inflation', 'Inflation', beforeMacro.inflationAnnualPct, afterMacro.inflationAnnualPct, ' %', 2),
    metric('unemployment', 'Chômage', beforeMacro.unemploymentPct, afterMacro.unemploymentPct, ' %', 2),
    metric('debt', 'Dette publique', beforeMacro.publicDebtPctGdp, afterMacro.publicDebtPctGdp, ' % PIB', 2),
    metric('budget', 'Marge budgétaire', beforeCountry.metrics.budget, afterCountry.metrics.budget, '', 1),
  ] : [];
  return {
    from: before.currentDate,
    to: after.currentDate,
    elapsedMonths: round(monthsBetween(before.currentDate, after.currentDate), 1),
    actionCount: newActions.filter((action) => action.kind !== 'time_advance').length,
    autonomousActorCount: new Set(newActions.filter((action) => action.actorId !== after.playerCountryId).map((action) => action.actorId)).size,
    metrics,
    highlights: dossierHighlights(before, after),
    completedPrograms,
  };
}
