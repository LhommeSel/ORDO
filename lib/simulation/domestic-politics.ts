import { MAJOR_COUNTRY_IDS } from './major-country-pack-2000';
import type { CountryId, WorldState } from './types';

export const politicalCycleModeLabels = {
  competitive_election: 'Élection compétitive',
  managed_election: 'Élection encadrée',
  party_congress: 'Congrès du parti',
  dynastic_succession: 'Succession dynastique',
  institutional_review: 'Réexamen institutionnel',
} as const;

export type DomesticPoliticsStatus = 'stable' | 'watch' | 'campaign' | 'strained';

export type DomesticPoliticsCountry = {
  countryId: CountryId;
  name: string;
  flag: string;
  regime: string;
  governmentLabel: string;
  headOfGovernment: string;
  executive: string;
  stability: number;
  approval: number;
  executiveCoordination: number;
  administrativeCompliance: number;
  politicalMomentum: number;
  governmentSeats: number;
  legislatureSeats: number;
  majorityThreshold: number;
  governmentSeatShare: number;
  parliamentaryTracked: boolean;
  parliamentaryLabel: string;
  cycleMode: string;
  cycleStatus: 'scheduled' | 'campaign' | 'undocumented';
  nextReviewDate?: string;
  monthsToReview?: number;
  warningMonths?: number;
  activePowerStruggles: number;
  activeReactions: number;
  activePoliticalDossiers: number;
  politicalDossierTitles: string[];
  tension: number;
  status: DomesticPoliticsStatus;
  statusLabel: string;
  politicalCue: string;
  leadershipNames: string[];
  apparatusCurrents: string[];
};

export type DomesticPoliticsSnapshot = {
  countries: DomesticPoliticsCountry[];
  campaignCount: number;
  strainedCount: number;
  upcomingCount: number;
  parliamentaryCount: number;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const round = (value: number) => Math.round(value * 10) / 10;

function monthsUntil(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.max(0, round((end - start) / (1000 * 60 * 60 * 24 * 30.4375)));
}

function statusFor(
  tension: number,
  cycleStatus: DomesticPoliticsCountry['cycleStatus'],
  monthsToReview: number | undefined,
  warningMonths: number | undefined,
): DomesticPoliticsStatus {
  if (cycleStatus === 'campaign') return 'campaign';
  if (tension >= 68) return 'strained';
  if (
    monthsToReview !== undefined &&
    warningMonths !== undefined &&
    monthsToReview <= warningMonths
  ) {
    return 'watch';
  }
  return 'stable';
}

function statusLabel(status: DomesticPoliticsStatus) {
  switch (status) {
    case 'campaign':
      return 'Séquence ouverte';
    case 'strained':
      return 'Tension élevée';
    case 'watch':
      return 'Échéance proche';
    default:
      return 'Rapport de forces stable';
  }
}

function politicalCue(
  row: Omit<DomesticPoliticsCountry, 'politicalCue' | 'status' | 'statusLabel'>,
  tension: number,
) {
  if (row.cycleStatus === 'campaign') return 'Le pouvoir est déjà entré dans une séquence de réévaluation.';
  if (row.activePowerStruggles > 0) {
    return `${row.activePowerStruggles} lutte${row.activePowerStruggles > 1 ? 's' : ''} de pouvoir suivie${row.activePowerStruggles > 1 ? 's' : ''} par le moteur.`;
  }
  if (row.activePoliticalDossiers > 0) {
    return `${row.activePoliticalDossiers} dossier${row.activePoliticalDossiers > 1 ? 's' : ''} politique${row.activePoliticalDossiers > 1 ? 's' : ''} structure${row.activePoliticalDossiers > 1 ? 'nt' : ''} actuellement la lecture du pays.`;
  }
  if (!row.parliamentaryTracked) {
    return tension >= 68
      ? 'Le socle public est sous pression ; le détail parlementaire reste agrégé.'
      : 'Le moteur suit l’exécutif et le calendrier ; le Parlement reste agrégé.';
  }
  if (row.governmentSeatShare < 0.5) return 'Le gouvernement doit composer avec une majorité relative ou des soutiens ponctuels.';
  if (row.governmentSeatShare < 0.58) return 'La base gouvernementale est étroite : les textes importants exigent des compromis.';
  return tension >= 52
    ? 'L’exécutif dispose d’un socle, mais plusieurs facteurs peuvent ralentir ses arbitrages.'
    : 'L’exécutif dispose d’un socle parlementaire suffisamment lisible.';
}

function deriveCountry(state: WorldState, countryId: CountryId): DomesticPoliticsCountry | null {
  const country = state.countries[countryId];
  if (!country) return null;
  const politics = country.politics;
  const cycle = state.politicalCycles?.[countryId];
  const national = state.nationalPolitics?.[countryId];
  const leadership = state.leadership?.[countryId];
  const apparatus = state.politicalApparatus?.[countryId];
  const campaigns = Object.values(state.powerStruggleCampaigns ?? {}).filter(
    (campaign) => campaign.countryId === countryId && campaign.status !== 'resolved',
  );
  const reactions = Object.values(state.stakeholderReactions ?? {}).filter(
    (reaction) =>
      reaction.countryId === countryId &&
      reaction.status !== 'resolved' &&
      reaction.visibility !== 'secret',
  );
  const politicalDossiers = Object.values(state.strategicDossiers ?? {}).filter(
    (dossier) =>
      dossier.status !== 'resolved' &&
      (dossier.kind === 'power_struggle' || dossier.kind === 'political_transition') &&
      // Les dossiers mondiaux citent aussi les pays observateurs. Le premier
      // acteur est la puissance dont la dynamique intérieure est le sujet.
      dossier.actorIds[0] === countryId,
  );
  const governmentSeats = national
    ? national.blocs
        .filter((bloc) => bloc.role === 'government' || bloc.role === 'support')
        .reduce((sum, bloc) => sum + bloc.seats, 0)
    : politics.governingSeats;
  const legislatureSeats = national?.blocs.reduce((sum, bloc) => sum + bloc.seats, 0) ?? politics.legislatureSeats;
  const governmentSeatShare = legislatureSeats > 0 ? clamp((governmentSeats / legislatureSeats) * 100) : 0;
  const activeCampaignPressure = campaigns.length
    ? Math.max(...campaigns.map((campaign) => campaign.pressure))
    : 0;
  const reactionPressure = reactions.length
    ? Math.max(...reactions.map((reaction) => (reaction.defiance + reaction.mobilization) / 2))
    : 0;
  const stability = clamp(country.metrics.stability);
  const approval = clamp(politics.publicApproval);
  const executiveCoordination = clamp(
    leadership?.executiveCoordination ?? politics.administrativeCompliance,
  );
  const tension = Math.round(
    clamp(
      (100 - stability) * 0.3 +
        (100 - approval) * 0.25 +
        (100 - executiveCoordination) * 0.15 +
        activeCampaignPressure * 0.2 +
        reactionPressure * 0.1 +
        Math.min(12, politicalDossiers.length * 4),
    ),
  );
  const monthsToReview = cycle?.nextReviewDate
    ? monthsUntil(state.currentDate, cycle.nextReviewDate)
    : undefined;
  const cycleStatus: DomesticPoliticsCountry['cycleStatus'] = cycle?.status ?? 'undocumented';
  const status = statusFor(tension, cycleStatus, monthsToReview, cycle?.warningMonths);
  const rowWithoutStatus = {
    countryId,
    name: country.name,
    flag: country.flag,
    regime: politics.regime,
    governmentLabel: politics.governmentLabel,
    headOfGovernment: politics.headOfGovernment,
    executive: politics.executive,
    stability: Math.round(stability),
    approval: Math.round(approval),
    executiveCoordination: Math.round(executiveCoordination),
    administrativeCompliance: Math.round(clamp(politics.administrativeCompliance)),
    politicalMomentum: Math.round(clamp(national?.politicalMomentum ?? 50, -100, 100)),
    governmentSeats,
    legislatureSeats,
    majorityThreshold: national
      ? Math.floor(legislatureSeats / 2) + 1
      : Math.floor(legislatureSeats / 2) + 1,
    governmentSeatShare: Math.round(governmentSeatShare),
    parliamentaryTracked: Boolean(national),
    parliamentaryLabel: national?.legislatureLabel ?? 'Parlement agrégé',
    cycleMode: cycle ? politicalCycleModeLabels[cycle.mode] : 'Calendrier non documenté',
    cycleStatus,
    nextReviewDate: cycle?.nextReviewDate,
    monthsToReview,
    warningMonths: cycle?.warningMonths,
    activePowerStruggles: campaigns.length,
    activeReactions: reactions.length,
    activePoliticalDossiers: politicalDossiers.length,
    politicalDossierTitles: politicalDossiers.slice(0, 3).map((dossier) => dossier.title),
    tension,
    leadershipNames: leadership?.figures.slice(0, 3).map((figure) => figure.name) ?? [],
    apparatusCurrents: apparatus?.currents.slice(0, 4).map((current) => current.label) ?? [],
  };
  return {
    ...rowWithoutStatus,
    status,
    statusLabel: statusLabel(status),
    politicalCue: politicalCue(rowWithoutStatus, tension),
  };
}

export function domesticPoliticsSnapshot(
  state: WorldState,
  countryIds: readonly CountryId[] = MAJOR_COUNTRY_IDS,
): DomesticPoliticsSnapshot {
  const countries = countryIds
    .map((countryId) => deriveCountry(state, countryId))
    .filter((country): country is DomesticPoliticsCountry => Boolean(country))
    .sort((left, right) => right.tension - left.tension || left.name.localeCompare(right.name));
  return {
    countries,
    campaignCount: countries.filter((country) => country.status === 'campaign').length,
    strainedCount: countries.filter((country) => country.status === 'strained').length,
    upcomingCount: countries.filter(
      (country) =>
        country.monthsToReview !== undefined &&
        country.warningMonths !== undefined &&
        country.monthsToReview <= country.warningMonths,
    ).length,
    parliamentaryCount: countries.filter((country) => country.parliamentaryTracked).length,
  };
}
