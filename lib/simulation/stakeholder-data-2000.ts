import type {
  CountryId,
  CountryState,
  CountryStructuralProfile,
  PolicySignal,
  StakeholderCategory,
  StakeholderGroup,
  StakeholderInfluenceChannel,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, Math.round(value)));
const sensitivity = (value: number) => Math.min(1, Math.max(-1, Number(value.toFixed(2))));

type BaseGroupKey = 'military' | 'labor' | 'capital' | 'administration' | 'opposition';
type GroupAdjustment = {
  influence?: number;
  escalation?: number;
  cohesion?: number;
  defiance?: number;
  sensitivities?: Partial<Record<PolicySignal, number>>;
};

/**
 * Ces ajustements peu nombreux complètent les différences structurelles
 * calculées pour chaque État. Ils évitent 196 fiches écrites à la main tout
 * en donnant une personnalité aux pays qui structurent le plus les parties.
 */
const NATIONAL_ADJUSTMENTS: Partial<Record<CountryId, Partial<Record<BaseGroupKey, GroupAdjustment>>>> = {
  FRA: {
    military: { sensitivities: { alliance_reorientation: 0.72, technology_transfer: 0.58 } },
    labor: { influence: 8, escalation: 8 },
    opposition: { sensitivities: { resource_sovereignty: 0.58, foreign_military_presence: 0.52 } },
  },
  USA: {
    military: { influence: 12, cohesion: 8, sensitivities: { alliance_reorientation: 0.92, security_guarantee: -0.48 } },
    capital: { influence: 10, sensitivities: { trade_opening: -0.92, technology_transfer: 0.66 } },
    opposition: { influence: 8, escalation: 10 },
  },
  RUS: {
    military: { influence: 14, escalation: 14, sensitivities: { territorial_concession: 1, alliance_reorientation: 0.96 } },
    administration: { influence: 8, sensitivities: { resource_sovereignty: 0.82 } },
    opposition: { sensitivities: { diplomatic_deescalation: 0.5, territorial_concession: 1 } },
  },
  CHN: {
    military: { influence: 12, cohesion: 12, sensitivities: { territorial_concession: 1, foreign_military_presence: 1 } },
    administration: { influence: 12, sensitivities: { technology_transfer: 0.68, alliance_reorientation: 0.76 } },
    capital: { sensitivities: { trade_opening: -0.8, technology_transfer: 0.28 } },
  },
  IND: {
    military: { influence: 8, sensitivities: { alliance_reorientation: 0.82, technology_transfer: -0.3 } },
    capital: { sensitivities: { technology_transfer: -0.62, trade_opening: -0.45 } },
    opposition: { sensitivities: { alliance_reorientation: 0.88, foreign_military_presence: 0.9 } },
  },
  TUR: {
    military: { influence: 12, escalation: 14, cohesion: 8, sensitivities: { territorial_concession: 1, alliance_reorientation: 0.92, diplomatic_deescalation: 0.42, status_humiliation: 1 } },
    administration: { influence: 6, sensitivities: { resource_sovereignty: 0.72, alliance_reorientation: 0.7 } },
    opposition: { influence: 7, escalation: 12, sensitivities: { territorial_concession: 1, foreign_military_presence: 0.86, alliance_reorientation: 0.9, status_humiliation: 0.96 } },
  },
  GRC: {
    military: { influence: 8, escalation: 10, sensitivities: { territorial_concession: 1, foreign_military_presence: 0.82, security_guarantee: -0.58, status_humiliation: 0.94 } },
    capital: { sensitivities: { diplomatic_deescalation: -0.55, trade_opening: -0.6 } },
    opposition: { influence: 8, escalation: 12, sensitivities: { territorial_concession: 1, alliance_reorientation: 0.72, status_humiliation: 0.9 } },
  },
  DZA: {
    military: { influence: 12, sensitivities: { resource_sovereignty: 1, foreign_military_presence: 1, territorial_concession: 0.9 } },
    administration: { influence: 8, sensitivities: { resource_sovereignty: 0.92, trade_opening: 0.28 } },
    opposition: { escalation: 10, sensitivities: { resource_sovereignty: 1, foreign_military_presence: 1 } },
  },
  IRN: {
    military: { influence: 12, escalation: 14, sensitivities: { foreign_military_presence: 1, alliance_reorientation: 0.96, resource_sovereignty: 0.92 } },
    administration: { sensitivities: { technology_transfer: -0.42, resource_sovereignty: 0.76 } },
    opposition: { sensitivities: { alliance_reorientation: 0.88 } },
  },
  JPN: {
    military: { sensitivities: { alliance_reorientation: 0.86, security_guarantee: -0.7 } },
    capital: { influence: 10, sensitivities: { trade_opening: -0.9, diplomatic_deescalation: -0.62 } },
    administration: { influence: 10, cohesion: 8 },
  },
  DEU: {
    labor: { influence: 8 },
    capital: { influence: 10, sensitivities: { trade_opening: -0.92, diplomatic_deescalation: -0.6 } },
    administration: { influence: 10, cohesion: 10, sensitivities: { alliance_reorientation: 0.5 } },
  },
  GBR: {
    military: { influence: 8, sensitivities: { alliance_reorientation: 0.9, security_guarantee: -0.55 } },
    capital: { influence: 10, sensitivities: { trade_opening: -0.9 } },
    opposition: { sensitivities: { alliance_reorientation: 0.72 } },
  },
  SAU: {
    military: { influence: 10, sensitivities: { security_guarantee: -0.72, alliance_reorientation: 0.82 } },
    administration: { influence: 8, sensitivities: { resource_sovereignty: 0.9 } },
    capital: { sensitivities: { trade_opening: -0.5, resource_sovereignty: 0.6 } },
  },
  BRA: {
    military: { sensitivities: { foreign_military_presence: 0.88, alliance_reorientation: 0.72 } },
    capital: { influence: 8, sensitivities: { trade_opening: -0.7, resource_sovereignty: 0.42 } },
    opposition: { sensitivities: { resource_sovereignty: 0.7 } },
  },
};

type StrategicLabels = readonly [string, string, string];

/** Trois groupes différenciés uniquement pour le noyau géopolitique suivi. */
const STRATEGIC_GROUP_LABELS: Partial<Record<CountryId, StrategicLabels>> = {
  FRA: ['État-major diplomatique et stratégique', 'Industries stratégiques et exportatrices', 'Courants souverainistes et gaullistes'],
  DEU: ['Établissement euro-atlantique et juridique', 'Industrie exportatrice allemande', 'Courants de stabilité budgétaire et fédérale'],
  ITA: ['Appareil méditerranéen de l’État', 'Industrie du Nord et grands groupes', 'Coalitions territoriales et souverainistes'],
  ESP: ['Appareil européen et ibéro-méditerranéen', 'Groupes d’infrastructure et d’exportation', 'Forces territoriales et autonomiques'],
  POL: ['Établissement atlantiste et sécuritaire', 'Industrie nationale de défense', 'Courants souverainistes polonais'],
  GBR: ['Établissement atlantiste britannique', 'City et groupes exportateurs', 'Courants souverainistes britanniques'],
  USA: ['Communauté de sécurité nationale', 'Industries de défense et de haute technologie', 'Courants interventionnistes et isolationnistes'],
  RUS: ['Appareil sécuritaire et stratégique', 'Groupes énergétiques et industriels', 'Courants nationaux-patriotiques'],
  CHN: ['Direction stratégique du Parti-État', 'Armée populaire de libération', 'Entreprises publiques et provinces exportatrices'],
  IND: ['Communauté stratégique non alignée', 'Industrie nationale de défense', 'Coalitions fédérales et souverainistes'],
  JPN: ['Bureaucraties économiques et stratégiques', 'Grands groupes industriels japonais', 'Courants de sécurité et d’alliance'],
  TUR: ['État-major et appareil républicain', 'Entreprises anatoliennes, énergétiques et logistiques', 'Courants nationalistes et souverainistes'],
  GRC: ['État-major et communauté égéenne', 'Armateurs et intérêts maritimes grecs', 'Courants nationaux et élus insulaires'],
  DZA: ['Appareil militaire et sécuritaire', 'Technocratie énergétique et entreprises publiques', 'Courants souverainistes algériens'],
  IRN: ['Appareil sécuritaire et Gardiens de la révolution', 'Technocratie énergétique iranienne', 'Réseaux religieux et souverainistes'],
  SAU: ['Établissement royal et sécuritaire', 'Technocratie pétrolière saoudienne', 'Réseaux religieux et conservateurs'],
  BRA: ['Communauté stratégique brésilienne', 'Agribusiness et industrie exportatrice', 'Gouverneurs et coalitions fédérales'],
  ZAF: ['Coalition politique post-apartheid', 'Groupes miniers et industriels', 'Mouvements civiques et territoriaux'],
  AUS: ['Établissement de sécurité indo-pacifique', 'Groupes miniers et exportateurs', 'États fédérés et courants autonomistes'],
  CAN: ['Appareil fédéral et multilatéral', 'Provinces productrices et groupes exportateurs', 'Courants provinciaux et autonomistes'],
  MEX: ['Appareil fédéral et énergétique', 'Industries exportatrices du Nord', 'Gouverneurs et réseaux territoriaux'],
  VNM: ['Direction stratégique du Parti', 'Armée populaire vietnamienne', 'Technocratie industrielle et exportatrice'],
  SUR: ['Administration des ressources nationales', 'Entreprises minières et logistiques', 'Communautés de l’intérieur et courants souverainistes'],
};

function mergeSensitivities(
  base: Partial<Record<PolicySignal, number>>,
  adjustment?: GroupAdjustment,
): Partial<Record<PolicySignal, number>> {
  const merged = { ...base };
  for (const [signal, value] of Object.entries(adjustment?.sensitivities ?? {}) as Array<[PolicySignal, number]>) {
    merged[signal] = sensitivity(value);
  }
  return merged;
}

function adjustedGroup(countryId: CountryId, key: BaseGroupKey, input: Omit<StakeholderGroup, 'countryId'>): StakeholderGroup {
  const adjustment = NATIONAL_ADJUSTMENTS[countryId]?.[key];
  return {
    ...input,
    countryId,
    influence: clamp(input.influence + (adjustment?.influence ?? 0)),
    escalationDisposition: clamp((input.escalationDisposition ?? 40) + (adjustment?.escalation ?? 0)),
    cohesion: clamp(input.cohesion + (adjustment?.cohesion ?? 0)),
    baselineDefiance: clamp(input.baselineDefiance + (adjustment?.defiance ?? 0)),
    sensitivities: mergeSensitivities(input.sensitivities, adjustment),
  };
}

function strategicGroups(country: CountryState, profile?: CountryStructuralProfile): StakeholderGroup[] {
  const labels = STRATEGIC_GROUP_LABELS[country.id];
  if (!labels) return [];
  const sovereignty = Math.max(0, country.politics.doctrine.sovereignty);
  const security = Math.max(0, country.politics.doctrine.security);
  const financialResilience = profile?.financialResilience ?? 50;
  const exportConcentration = profile?.exportConcentration ?? 50;
  const definitions: Array<{
    suffix: string; label: string; category: StakeholderCategory; influence: number; escalation: number; cohesion: number;
    sensitivities: Partial<Record<PolicySignal, number>>; channels: StakeholderInfluenceChannel[]; responses: string[];
  }> = [
    {
      suffix: 'strategic-establishment', label: labels[0], category: 'administration',
      influence: 42 + country.weight * 0.28, escalation: 24 + security * 0.35, cohesion: 55 + security * 0.25,
      sensitivities: { territorial_concession: sensitivity(0.58 + sovereignty / 230), alliance_reorientation: sensitivity(0.5 + security / 260), security_guarantee: -0.25, foreign_military_presence: sensitivity(0.4 + sovereignty / 300), status_humiliation: sensitivity(0.56 + sovereignty / 260) },
      channels: ['policy_execution', 'security_cohesion', 'diplomatic_acceptance'],
      responses: ['Réserves stratégiques internes', 'Doctrine d’application restrictive', 'Pression pour renégocier les garanties'],
    },
    {
      suffix: 'strategic-industries', label: labels[1], category: 'capital',
      influence: 38 + financialResilience * 0.25 + exportConcentration * 0.12, escalation: 22 + exportConcentration * 0.24, cohesion: 48 + financialResilience * 0.25,
      sensitivities: { trade_opening: sensitivity(-0.48 - exportConcentration / 250), technology_transfer: 0.3, resource_sovereignty: 0.22, diplomatic_deescalation: -0.36 },
      channels: ['economic_confidence', 'policy_execution', 'diplomatic_acceptance'],
      responses: ['Lobbying sectoriel', 'Conditionnement des investissements', 'Soutien public si les débouchés sont protégés'],
    },
    {
      suffix: 'sovereignty-currents', label: labels[2], category: 'civic',
      influence: 26 + country.weight * 0.2 + sovereignty * 0.28, escalation: 36 + sovereignty * 0.38, cohesion: 42 + sovereignty * 0.28,
      sensitivities: { territorial_concession: sensitivity(0.68 + sovereignty / 220), foreign_military_presence: sensitivity(0.58 + sovereignty / 260), alliance_reorientation: sensitivity(0.45 + sovereignty / 300), resource_sovereignty: sensitivity(0.45 + sovereignty / 260), diplomatic_deescalation: 0.18, status_humiliation: sensitivity(0.72 + sovereignty / 240) },
      channels: ['political_support', 'social_mobilization', 'diplomatic_acceptance'],
      responses: ['Campagne publique sur la souveraineté', 'Pression parlementaire ou partisane', 'Mobilisation symbolique ou territoriale'],
    },
  ];
  return definitions.map((item) => ({
    id: `${country.id}-${item.suffix}`, countryId: country.id, label: item.label, category: item.category,
    influence: clamp(item.influence), escalationDisposition: clamp(item.escalation), cohesion: clamp(item.cohesion), baselineDefiance: 9,
    sensitivities: item.sensitivities, influenceChannels: item.channels, possibleResponses: item.responses,
  }));
}

export function createStakeholderGroups2000(
  countries: Record<string, CountryState>,
  profiles: Record<string, CountryStructuralProfile>,
): Record<string, StakeholderGroup> {
  const groups: StakeholderGroup[] = [];
  for (const country of Object.values(countries)) {
    const profile = profiles[country.id];
    const socialStabilizers = profile?.socialStabilizers ?? 50;
    const financialResilience = profile?.financialResilience ?? 50;
    const exportConcentration = profile?.exportConcentration ?? 50;
    const sovereignty = Math.max(0, country.politics.doctrine.sovereignty);
    const security = Math.max(0, country.politics.doctrine.security);
    const oppositionShare = country.politics.legislatureSeats > 0
      ? 100 - country.politics.governingSeats / country.politics.legislatureSeats * 100
      : 45;
    groups.push(
      adjustedGroup(country.id, 'military', {
        id: `${country.id}-military-command`, label: 'Haut commandement et cadres des armées', category: 'military',
        influence: clamp(45 + country.weight * 0.35), escalationDisposition: clamp(32 + country.metrics.security * 0.2), cohesion: clamp(48 + country.metrics.security * 0.35), baselineDefiance: 8,
        sensitivities: {
          defense_cuts: 0.92, alliance_disengagement: 0.86, military_doctrine_break: 0.72,
          territorial_concession: sensitivity(0.52 + sovereignty / 230 + security / 360),
          foreign_military_presence: sensitivity(0.46 + sovereignty / 280),
          alliance_reorientation: sensitivity(0.42 + security / 300), security_guarantee: -0.32,
          diplomatic_deescalation: sensitivity(0.08 + security / 700), technology_transfer: 0.28,
          status_humiliation: sensitivity(0.58 + sovereignty / 260 + security / 420),
          austerity: 0.18, administrative_reorganization: 0.08, port_governance: 0.08,
        },
        influenceChannels: ['security_cohesion', 'political_support', 'diplomatic_acceptance'],
        possibleResponses: ['Critiques internes et fuites', 'Ralentissement de l’exécution', 'Démissions ou refus d’obéissance dans une crise extrême'],
      }),
      adjustedGroup(country.id, 'labor', {
        id: `${country.id}-organized-labor`, label: 'Syndicats et salariés organisés', category: 'organized_labor',
        influence: clamp(32 + socialStabilizers * 0.42), escalationDisposition: clamp(36 + socialStabilizers * 0.18), cohesion: clamp(36 + socialStabilizers * 0.25), baselineDefiance: 12,
        sensitivities: {
          labor_deregulation: 0.96, austerity: 0.62, public_industrial_investment: -0.28,
          trade_opening: sensitivity(0.18 + exportConcentration / 500), technology_transfer: -0.18,
          resource_sovereignty: 0.32, diplomatic_deescalation: -0.2,
          port_governance: 0.32, port_capacity_investment: 0.18,
        },
        influenceChannels: ['social_mobilization', 'political_support', 'policy_execution'],
        possibleResponses: ['Négociation collective', 'Mobilisations sectorielles', 'Grève nationale lorsque la mobilisation devient critique'],
      }),
      adjustedGroup(country.id, 'capital', {
        id: `${country.id}-capital-owners`, label: 'Détenteurs de capitaux et directions financières', category: 'capital',
        influence: clamp(45 + financialResilience * 0.38), escalationDisposition: clamp(22 + exportConcentration * 0.16), cohesion: clamp(34 + exportConcentration * 0.22), baselineDefiance: 9,
        sensitivities: {
          capital_controls: 0.94, tax_increase_high_incomes: 0.58, public_industrial_investment: -0.08,
          trade_opening: sensitivity(-0.42 - exportConcentration / 240), technology_transfer: 0.2,
          resource_sovereignty: 0.16, security_guarantee: -0.12, diplomatic_deescalation: -0.42,
          port_governance: 0.18, port_capacity_investment: 0.18,
        },
        influenceChannels: ['economic_confidence', 'political_support', 'diplomatic_acceptance'],
        possibleResponses: ['Report d’investissements', 'Lobbying et campagne publique', 'Sorties de capitaux lorsque les contrôles restent contournables'],
      }),
      adjustedGroup(country.id, 'administration', {
        id: `${country.id}-senior-administration`, label: 'Haute administration et corps techniques', category: 'administration',
        influence: clamp(35 + country.politics.administrativeCompliance * 0.48), escalationDisposition: clamp(14 + (100 - country.politics.administrativeCompliance) * 0.18), cohesion: clamp(42 + country.politics.administrativeCompliance * 0.35), baselineDefiance: 6,
        sensitivities: {
          administrative_reorganization: 0.74, austerity: 0.32, public_industrial_investment: 0.12,
          territorial_concession: sensitivity(0.28 + sovereignty / 350), foreign_military_presence: 0.34,
          alliance_reorientation: 0.32, resource_sovereignty: 0.42, technology_transfer: 0.12,
          security_guarantee: -0.18, diplomatic_deescalation: -0.12, status_humiliation: 0.34,
          port_governance: 0.74, port_capacity_investment: 0.12,
        },
        influenceChannels: ['policy_execution', 'political_support', 'diplomatic_acceptance'],
        possibleResponses: ['Réserves techniques', 'Application lente ou restrictive', 'Blocage administratif informel dans les cas critiques'],
      }),
      adjustedGroup(country.id, 'opposition', {
        id: `${country.id}-political-opposition`, label: 'Opposition politique organisée', category: 'civic',
        influence: clamp(26 + oppositionShare * 0.45), escalationDisposition: clamp(34 + (100 - country.politics.publicApproval) * 0.24), cohesion: clamp(42 + oppositionShare * 0.22), baselineDefiance: clamp(10 + (100 - country.politics.publicApproval) * 0.08),
        sensitivities: {
          territorial_concession: sensitivity(0.58 + sovereignty / 280), foreign_military_presence: sensitivity(0.4 + sovereignty / 350),
          alliance_reorientation: 0.46, resource_sovereignty: 0.52, technology_transfer: 0.24,
          security_guarantee: -0.08, diplomatic_deescalation: 0.08, status_humiliation: sensitivity(0.62 + sovereignty / 300),
          austerity: 0.32, labor_deregulation: 0.28, capital_controls: 0.18,
        },
        influenceChannels: ['political_support', 'social_mobilization', 'diplomatic_acceptance'],
        possibleResponses: ['Critique publique de l’accord', 'Demande de débat ou de vote', 'Campagne politique contre les concessions'],
      }),
      ...strategicGroups(country, profile),
    );
  }
  return Object.fromEntries(groups.map((group) => [group.id, group]));
}
