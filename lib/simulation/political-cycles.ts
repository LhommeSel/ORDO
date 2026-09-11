import { commitWorldAction } from './ledger';
import { seededUnit } from './random';
import type {
  CountryId,
  CountryLeadership,
  CountryState,
  DecisionSignal,
  GovernmentDoctrine,
  ISODate,
  PoliticalApparatusProfile,
  PoliticalCycle,
  PoliticalCycleMode,
  StrategicDossier,
  SimulationStop,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

function addMonths(date: ISODate, months: number): ISODate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
}

function inferMode(country: CountryState): PoliticalCycleMode {
  const regime = country.politics.regime.toLocaleLowerCase('fr');
  if (/monarchie absolue|dynasti|émirat|sultanat/.test(regime)) return 'dynastic_succession';
  if (/parti unique|communiste|révolutionnaire/.test(regime)) return 'party_congress';
  if (/autoritaire|parti dominant|mouvement dominant|militaire/.test(regime)) return 'managed_election';
  if (/transition|intérim/.test(regime)) return 'institutional_review';
  return 'competitive_election';
}

const cycleOverrides: Partial<Record<CountryId, Partial<PoliticalCycle>>> = {
  FRA: { mode: 'competitive_election', intervalMonths: 60, warningMonths: 4, nextReviewDate: '2002-04-01' },
  DEU: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 4, nextReviewDate: '2002-09-01' },
  ITA: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 3, nextReviewDate: '2001-05-01' },
  ESP: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 4, nextReviewDate: '2004-03-01' },
  POL: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 3, nextReviewDate: '2001-09-01' },
  GBR: { mode: 'competitive_election', intervalMonths: 60, warningMonths: 4, nextReviewDate: '2001-06-01' },
  USA: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 5, nextReviewDate: '2000-11-01' },
  RUS: { mode: 'managed_election', intervalMonths: 48, warningMonths: 3, nextReviewDate: '2000-03-01' },
  CHN: { mode: 'party_congress', intervalMonths: 60, warningMonths: 3, nextReviewDate: '2002-11-01' },
  NOR: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 3, nextReviewDate: '2001-09-01' },
  DZA: { mode: 'managed_election', intervalMonths: 60, warningMonths: 3, nextReviewDate: '2004-04-01' },
  BRA: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 4, nextReviewDate: '2002-10-01' },
  ZAF: { mode: 'competitive_election', intervalMonths: 60, warningMonths: 4, nextReviewDate: '2004-04-01' },
  AUS: { mode: 'competitive_election', intervalMonths: 36, warningMonths: 3, nextReviewDate: '2001-11-01' },
  IND: { mode: 'competitive_election', intervalMonths: 60, warningMonths: 4, nextReviewDate: '2004-04-01' },
  JPN: { mode: 'competitive_election', intervalMonths: 36, warningMonths: 3, nextReviewDate: '2001-07-01' },
  TUR: { mode: 'competitive_election', intervalMonths: 48, warningMonths: 4, nextReviewDate: '2002-11-01' },
  VNM: { mode: 'party_congress', intervalMonths: 60, warningMonths: 3, nextReviewDate: '2001-04-01' },
};

function defaultInterval(countryId: CountryId, mode: PoliticalCycleMode) {
  if (mode === 'competitive_election') return seededUnit(20000101, `${countryId}:term`) > 0.5 ? 60 : 48;
  if (mode === 'dynastic_succession') return 84;
  return 60;
}

/** Répartit les échéances des pays secondaires pour éviter un « super-tour électoral » artificiel. */
export function createPoliticalCycles2000(countries: Record<CountryId, CountryState>): Record<CountryId, PoliticalCycle> {
  return Object.fromEntries(Object.values(countries).map((country) => {
    const mode = inferMode(country);
    const intervalMonths = defaultInterval(country.id, mode);
    const defaultOffset = 8 + Math.floor(seededUnit(20000101, `${country.id}:first-political-review`) * 29);
    const base: PoliticalCycle = {
      countryId: country.id,
      mode,
      intervalMonths,
      warningMonths: mode === 'competitive_election' ? 4 : mode === 'dynastic_succession' ? 1 : 3,
      nextReviewDate: addMonths('2000-01-01', defaultOffset),
      cycleNumber: 1,
      status: 'scheduled',
    };
    return [country.id, { ...base, ...cycleOverrides[country.id], countryId: country.id } satisfies PoliticalCycle];
  }));
}

/**
 * Une longue avance doit s’interrompre avant l’échéance du pays joué : sinon
 * la campagne et son résultat seraient calculés dans le même clic, sans laisser
 * au joueur le temps de modifier la conjoncture ou d’engager une action.
 */
export function politicalCycleStops(state: WorldState, requestedDate: ISODate): SimulationStop[] {
  const cycle = state.politicalCycles?.[state.playerCountryId];
  if (!cycle || cycle.status === 'campaign') return [];
  const date = addMonths(cycle.nextReviewDate, -cycle.warningMonths);
  const id = `political-campaign-${cycle.countryId.toLowerCase()}-${cycle.cycleNumber}`;
  if (date <= state.currentDate || date > requestedDate || state.processedStopIds.includes(id)) return [];
  return [{ id, date, title: `Ouverture de l’échéance politique de ${state.countries[cycle.countryId]?.name ?? cycle.countryId}`, kind: 'political' }];
}

export type PoliticalSupportAssessment = {
  supportScore: number;
  threshold: number;
  retained: boolean;
  factors: Array<{ label: string; value: number }>;
};

export function assessPoliticalSupport(state: WorldState, countryId: CountryId, cycle = state.politicalCycles[countryId]): PoliticalSupportAssessment {
  const country = state.countries[countryId];
  const macro = state.macroEconomies[countryId];
  if (!country || !cycle) return { supportScore: 0, threshold: 100, retained: false, factors: [] };
  const economic = macro
    ? clamp(52 + macro.realGrowthAnnualPct * 4.2 - Math.max(0, macro.unemploymentPct - 5) * 1.15 - Math.abs(macro.inflationAnnualPct - 2) * 1.4)
    : 50;
  const approval = clamp(country.politics.publicApproval);
  const stability = clamp(country.metrics.stability);
  const security = clamp(country.metrics.security);
  const coordination = clamp(state.leadership[countryId]?.executiveCoordination ?? 60);
  const uncertainty = (seededUnit(state.seed, `${countryId}:${cycle.nextReviewDate}:${cycle.cycleNumber}:politics`) - 0.5) * 18;
  const supportScore = clamp(approval * 0.4 + stability * 0.2 + economic * 0.2 + security * 0.08 + coordination * 0.12 + uncertainty);
  const threshold: Record<PoliticalCycleMode, number> = {
    competitive_election: 52,
    managed_election: 36,
    party_congress: 33,
    dynastic_succession: 28,
    institutional_review: 43,
  };
  return {
    supportScore: round(supportScore),
    threshold: threshold[cycle.mode],
    retained: supportScore >= threshold[cycle.mode],
    factors: [
      { label: 'Approbation publique', value: round(approval) },
      { label: 'Conjoncture économique', value: round(economic) },
      { label: 'Stabilité institutionnelle', value: round(stability) },
      { label: 'Cohésion de la direction', value: round(coordination) },
    ],
  };
}

function oppositionDoctrine(current: GovernmentDoctrine, state: WorldState, countryId: CountryId, cycleNumber: number): GovernmentDoctrine {
  const variation = (axis: string) => (seededUnit(state.seed, `${countryId}:${cycleNumber}:${axis}`) - 0.5) * 20;
  return {
    economic: round(clamp(-current.economic * 0.72 + variation('economic'), -100, 100)),
    social: round(clamp(-current.social * 0.58 + variation('social'), -100, 100)),
    sovereignty: round(clamp(current.sovereignty * 0.62 + variation('sovereignty'), -100, 100)),
    security: round(clamp(current.security * 0.68 + variation('security'), -100, 100)),
  };
}

function continuityDoctrine(current: GovernmentDoctrine, state: WorldState, countryId: CountryId, cycleNumber: number): GovernmentDoctrine {
  const drift = (axis: string) => (seededUnit(state.seed, `${countryId}:${cycleNumber}:${axis}:drift`) - 0.5) * 6;
  return {
    economic: round(clamp(current.economic + drift('economic'), -100, 100)),
    social: round(clamp(current.social + drift('social'), -100, 100)),
    sovereignty: round(clamp(current.sovereignty + drift('sovereignty'), -100, 100)),
    security: round(clamp(current.security + drift('security'), -100, 100)),
  };
}

function doctrineTags(doctrine: GovernmentDoctrine) {
  return [
    doctrine.economic >= 20 ? 'libéralisme économique' : doctrine.economic <= -20 ? 'dirigisme économique' : 'pragmatisme économique',
    doctrine.social >= 20 ? 'orientation sociale' : doctrine.social <= -20 ? 'conservatisme social' : 'équilibre social',
    doctrine.sovereignty >= 30 ? 'souverainisme' : doctrine.sovereignty <= -20 ? 'intégration multilatérale' : 'autonomie coopérative',
    doctrine.security >= 35 ? 'priorité sécuritaire' : 'retenue stratégique',
  ];
}

function signalsForDoctrine(doctrine: GovernmentDoctrine): { supported: DecisionSignal[]; opposed: DecisionSignal[] } {
  const supported: DecisionSignal[] = ['commercial_deal'];
  const opposed: DecisionSignal[] = ['elite_displacement'];
  supported.push(doctrine.economic < -15 ? 'state_control' : doctrine.economic > 15 ? 'market_liberalization' : 'alliance_cooperation');
  if (doctrine.social > 15) supported.push('redistribution');
  if (doctrine.sovereignty > 25) supported.push('strategic_autonomy'); else supported.push('alliance_cooperation');
  if (doctrine.security > 35) supported.push('military_escalation');
  if (doctrine.sovereignty > 65) opposed.push('foreign_dependency');
  return { supported: [...new Set(supported)], opposed };
}

function transitionedLeadership(state: WorldState, countryId: CountryId, doctrine: GovernmentDoctrine, succession: boolean, cycleNumber: number): CountryLeadership {
  const country = state.countries[countryId];
  const year = state.currentDate.slice(0, 4);
  const flexibility = round(clamp(62 - Math.abs(doctrine.economic) * 0.18 - Math.abs(doctrine.sovereignty) * 0.12));
  return {
    countryId,
    figures: [{
      id: `${countryId.toLowerCase()}-systemic-executive-${year}-${cycleNumber}`,
      name: succession ? `Nouvelle direction de ${country.name}` : `Coalition d’alternance de ${year}`,
      role: succession ? 'Direction exécutive issue de la succession' : 'Direction exécutive issue de l’élection',
      authorityShare: 100,
      ideologyTags: doctrineTags(doctrine),
      traits: {
        riskAppetite: round(clamp(48 + doctrine.sovereignty * 0.12)),
        belligerence: round(clamp(42 + doctrine.security * 0.22)),
        flexibility,
        transactionality: round(clamp(55 + doctrine.economic * 0.1)),
        patience: round(clamp(60 + doctrine.social * 0.08)),
        ideologicalCommitment: round(clamp(58 + Math.max(Math.abs(doctrine.economic), Math.abs(doctrine.sovereignty)) * 0.24)),
        reliability: round(clamp(64 - Math.max(0, Math.abs(doctrine.sovereignty) - 45) * 0.15)),
      },
    }],
    executiveCoordination: succession ? 52 : 66,
    sourceBasis: 'Direction alternative produite par le cycle politique ORDO. Le moteur fixe sa ligne ; une couche narrative pourra ensuite matérialiser des personnalités sans réécrire le résultat.',
  };
}

function consolidatedRenewalLeadership(current: CountryLeadership, date: ISODate): CountryLeadership {
  if (current.figures.length <= 1) return current;
  const dominant = current.figures.slice().sort((a, b) => b.authorityShare - a.authorityShare)[0];
  return {
    ...current,
    figures: [{ ...dominant, role: 'Direction exécutive issue de la reconduction', authorityShare: 100 }],
    executiveCoordination: round(clamp(current.executiveCoordination + 10)),
    sourceBasis: `La direction partagée antérieure a été départagée par l’échéance politique du ${date}.`,
  };
}

function transitionedApparatus(current: PoliticalApparatusProfile, label: string, doctrine: GovernmentDoctrine): PoliticalApparatusProfile {
  const signals = signalsForDoctrine(doctrine);
  const stateCurrent = current.currents[0];
  const governmentCurrent = current.currents[1] ?? stateCurrent;
  return {
    ...current,
    currents: [
      stateCurrent,
      {
        ...governmentCurrent,
        id: `${current.countryId.toLowerCase()}-apparatus-government-current`,
        label,
        supportedSignals: signals.supported,
        opposedSignals: signals.opposed,
        institutionalReach: Math.max(42, governmentCurrent.institutionalReach - 8),
      },
    ],
    sourceBasis: 'L’appareil permanent est conservé ; son courant gouvernemental est recalé après la transition politique systémique.',
  };
}

function cycleDossier(state: WorldState, countryId: CountryId, cycle: PoliticalCycle): StrategicDossier {
  const country = state.countries[countryId];
  const dossierId = `political-cycle-${countryId.toLowerCase()}-${cycle.cycleNumber}`;
  const importance = countryId === state.playerCountryId || country.weight >= 90 ? 'major' : 'moderate';
  return {
    id: dossierId,
    title: `Échéance politique · ${country.name}`,
    kind: 'political_transition',
    status: 'emerging',
    importance,
    actorIds: [countryId],
    regionTags: ['politique intérieure', countryId],
    startedAt: state.currentDate,
    updatedAt: state.currentDate,
    phase: 'Préparation de l’échéance institutionnelle',
    trend: 'stable',
    publicSummary: `Le pouvoir de ${country.name} approche d’une échéance institutionnelle. La reconduction dépendra de la conjoncture, de l’approbation et de la cohésion de l’État ; aucun vainqueur historique n’est pré-écrit.`,
    followed: false,
    autoTracked: importance === 'major',
    commitments: [],
    pendingDecisions: [],
    relatedCurrentIds: [],
    relatedActionIds: [],
    entries: [{
      id: `${dossierId}-opening`, date: state.currentDate,
      title: 'Ouverture de la séquence politique',
      summary: `L’échéance est prévue au ${cycle.nextReviewDate}. Les indicateurs du monde détermineront le rapport de force.`,
      importance, actorIds: [countryId], requiresDecision: false, visibility: 'public',
    }],
  };
}

function shouldTrackDossier(state: WorldState, countryId: CountryId) {
  const country = state.countries[countryId];
  return countryId === state.playerCountryId || country.weight >= 68;
}

function openCampaign(state: WorldState, cycle: PoliticalCycle) {
  const dossier = cycleDossier(state, cycle.countryId, cycle);
  const effects: WorldEffect[] = [
    { kind: 'political_cycle_patch', countryId: cycle.countryId, patch: { status: 'campaign', dossierId: dossier.id }, reason: 'L’échéance institutionnelle entre dans sa phase publique.' },
  ];
  if (shouldTrackDossier(state, cycle.countryId) && !state.strategicDossiers[dossier.id]) {
    effects.push({ kind: 'dossier_add', dossier, reason: 'Une échéance politique significative devient un dossier suivi.', visibility: 'public' });
  }
  return commitWorldAction(state, {
    kind: 'political', actorId: cycle.countryId, origin: 'local_rule', visibility: 'public',
    intent: `Ouvrir la séquence politique de ${state.countries[cycle.countryId].name}`,
    metadata: { politicalCycle: true, politicalCycleStage: 'campaign' }, effects,
  });
}

function resolveCycle(state: WorldState, cycle: PoliticalCycle) {
  const country = state.countries[cycle.countryId];
  const assessment = assessPoliticalSupport(state, cycle.countryId, cycle);
  const competitive = cycle.mode === 'competitive_election';
  const changed = !assessment.retained;
  const outcome: NonNullable<PoliticalCycle['lastOutcome']> = assessment.retained
    ? competitive ? 'renewal' : 'continuity'
    : competitive ? 'alternation' : 'succession';
  const doctrine = changed && competitive
    ? oppositionDoctrine(country.politics.doctrine, state, cycle.countryId, cycle.cycleNumber)
    : continuityDoctrine(country.politics.doctrine, state, cycle.countryId, cycle.cycleNumber);
  const year = state.currentDate.slice(0, 4);
  const nextDate = addMonths(cycle.nextReviewDate, cycle.intervalMonths);
  const label = changed
    ? competitive ? `Coalition d’alternance issue de l’échéance de ${year}` : `Nouvelle direction issue de la succession de ${year}`
    : `${country.politics.governmentLabel} · mandat reconduit en ${year}`;
  const sharedLeadershipRenewed = assessment.retained && competitive && state.leadership[cycle.countryId].figures.length > 1;
  const renewedLeadership = sharedLeadershipRenewed
    ? consolidatedRenewalLeadership(state.leadership[cycle.countryId], state.currentDate)
    : undefined;
  const effects: WorldEffect[] = [
    {
      kind: 'political_cycle_patch', countryId: cycle.countryId,
      patch: { status: 'scheduled', lastReviewDate: state.currentDate, nextReviewDate: nextDate, cycleNumber: cycle.cycleNumber + 1, lastOutcome: outcome, lastSupportScore: assessment.supportScore, dossierId: null },
      reason: `L’échéance est résolue avec un soutien de ${assessment.supportScore}/100 ; la suivante est planifiée.`, visibility: 'public',
    },
    {
      kind: 'politics_patch', countryId: cycle.countryId,
      patch: {
        doctrine,
        governmentLabel: label,
        ...(changed ? { executive: competitive ? `Exécutif issu de l’alternance de ${year}` : `Direction issue de la succession de ${year}`, headOfGovernment: competitive ? `Coalition d’alternance de ${year}` : `Nouvelle direction de ${year}` } : renewedLeadership ? {
          executive: renewedLeadership.figures[0].name,
          headOfGovernment: renewedLeadership.figures[0].name,
          regime: country.politics.regime.replace(/\s+en cohabitation/iu, ''),
        } : {}),
        publicApproval: changed ? 58 : clamp(country.politics.publicApproval * 0.72 + 18),
        governingSeats: competitive
          ? Math.round(country.politics.legislatureSeats * (changed ? 0.54 : 0.52))
          : country.politics.governingSeats,
      },
      reason: changed ? 'Le rapport de force produit une nouvelle ligne gouvernementale.' : 'La reconduction maintient la ligne générale avec une dérive politique limitée.', visibility: 'public',
    },
  ];
  if (changed) {
    effects.push(
      { kind: 'leadership_patch', countryId: cycle.countryId, patch: transitionedLeadership(state, cycle.countryId, doctrine, !competitive, cycle.cycleNumber), reason: 'La direction effective est remplacée par le résultat systémique de la transition.', visibility: 'public' },
      { kind: 'political_apparatus_patch', countryId: cycle.countryId, patch: transitionedApparatus(state.politicalApparatus[cycle.countryId], label, doctrine), reason: 'Le courant gouvernemental change tandis que l’appareil permanent conserve son inertie.', visibility: 'player' },
    );
  } else if (renewedLeadership) {
    effects.push({
      kind: 'leadership_patch', countryId: cycle.countryId, patch: renewedLeadership,
      reason: 'L’échéance départage une direction partagée et met fin à la cohabitation héritée du scénario initial.', visibility: 'public',
    });
  }
  const dossierId = cycle.dossierId;
  if (dossierId && state.strategicDossiers[dossierId]) {
    const importance = state.strategicDossiers[dossierId].importance;
    effects.push(
      {
        kind: 'dossier_patch', dossierId,
        patch: {
          status: 'resolved', phase: changed ? competitive ? 'Alternance politique' : 'Succession du pouvoir' : 'Pouvoir reconduit',
          trend: 'deescalating', updatedAt: state.currentDate,
          publicSummary: changed
            ? `Le soutien de ${assessment.supportScore}/100 n’a pas suffi : ${country.name} change de direction politique. La nouvelle ligne découle du monde simulé, pas de la chronologie réelle.`
            : `Avec un soutien de ${assessment.supportScore}/100, le pouvoir de ${country.name} est reconduit.`,
        },
        reason: 'Le dossier électoral est clos par le résultat calculé.', visibility: 'public',
      },
      {
        kind: 'dossier_entry_add', dossierId,
        entry: {
          id: `${dossierId}-result`, date: state.currentDate,
          title: changed ? competitive ? 'Alternance' : 'Succession' : 'Reconduction',
          summary: `${label}. Soutien final : ${assessment.supportScore}/100 ; seuil de maintien : ${assessment.threshold}/100. ${assessment.factors.map((factor) => `${factor.label} ${factor.value}`).join(' · ')}.`,
          importance, actorIds: [cycle.countryId], requiresDecision: false, visibility: 'public',
        },
        reason: 'Le résultat et ses déterminants restent auditables dans la chronologie du dossier.', visibility: 'public',
      },
    );
  }
  return commitWorldAction(state, {
    kind: 'political', actorId: cycle.countryId, origin: 'local_rule', visibility: 'public',
    intent: `Résoudre l’échéance politique de ${country.name}`,
    metadata: { politicalCycle: true, politicalCycleStage: 'resolution', politicalOutcome: outcome, supportScore: assessment.supportScore },
    effects,
  });
}

/**
 * Une seule passe mensuelle suffit : les résultats restent locaux et
 * déterministes ; l’IA enrichira ensuite les acteurs et discours, sans pouvoir
 * modifier clandestinement le vainqueur déjà inscrit au registre causal.
 */
export function advancePoliticalCycles(state: WorldState) {
  let next = state;
  const cycles = Object.values(state.politicalCycles ?? {}).sort((a, b) => a.countryId.localeCompare(b.countryId));
  for (const original of cycles) {
    let cycle = next.politicalCycles[original.countryId];
    if (!cycle || !next.countries[cycle.countryId]) continue;
    const campaignDate = addMonths(cycle.nextReviewDate, -cycle.warningMonths);
    if (cycle.status === 'scheduled' && next.currentDate >= campaignDate && next.currentDate < cycle.nextReviewDate) {
      next = openCampaign(next, cycle);
      cycle = next.politicalCycles[cycle.countryId];
    }
    if (next.currentDate >= cycle.nextReviewDate) next = resolveCycle(next, cycle);
  }
  return next;
}
