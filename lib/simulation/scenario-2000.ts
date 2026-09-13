import type {
  ArmamentProduct,
  BaselineEnergyFlow,
  CapacityState,
  CountryId,
  CountryState,
  CountryEnergyState,
  EnergyNode,
  HistoricalCurrent,
  LatentProcess,
  StrategicDossier,
  StrategicSectorState,
  WorldState,
} from './types';
import { createStrategicSectors2000 } from './strategic-sector-data-2000';
import { createMacroEconomies2000, worldEconomy2000 } from './macro-data-2000';
import { createTerritorialState } from './territories';
import { createStructuralProfiles2000 } from './structural-data-2000';
import { createStakeholderGroups2000 } from './stakeholder-data-2000';
import { createTradeFlows2000 } from './trade-data-2000';
import { createDecisionProfiles2000 } from './decision-data-2000';
import { createLeadership2000, createPoliticalApparatus2000 } from './political-identity-data-2000';
import { createPoliticalCycles2000 } from './political-cycles';
import { createNationalBaselineCountries2000 } from './national-baseline-2000';
import { createGlobalBaselineCountries2000 } from './global-baseline-2000';
import { assertValidCountryRegistry } from './data-validator';
import { defenseReferences2000ForValidation } from './country-sheet';
import { createHistoricalAnchors2000 } from './historical-anchors-2000';
import { createNationalReforms2000 } from './reforms';
import { createMilitaryBases2000, createMilitaryTheaters2000 } from './military-theaters';
import { initializeTerritorialAssetOperations, territorialEnergyNodeAdditions } from './territorial-assets';

const capacities = (values: Partial<Record<keyof CapacityState, [number, number]>> = {}): CapacityState => ({
  government: { maximum: values.government?.[0] ?? 55, committed: values.government?.[1] ?? 25 },
  administration: { maximum: values.administration?.[0] ?? 55, committed: values.administration?.[1] ?? 28 },
  diplomacy: { maximum: values.diplomacy?.[0] ?? 50, committed: values.diplomacy?.[1] ?? 22 },
  economy: { maximum: values.economy?.[0] ?? 55, committed: values.economy?.[1] ?? 30 },
  intelligence: { maximum: values.intelligence?.[0] ?? 45, committed: values.intelligence?.[1] ?? 20 },
  defense: { maximum: values.defense?.[0] ?? 55, committed: values.defense?.[1] ?? 30 },
});

function country(input: Omit<CountryState, 'metrics' | 'capacities'> & {
  metrics?: Partial<CountryState['metrics']>;
  capacities?: CapacityState;
}): CountryState {
  return {
    ...input,
    metrics: {
      budget: input.metrics?.budget ?? 100,
      industry: input.metrics?.industry ?? 100,
      stability: input.metrics?.stability ?? 60,
      security: input.metrics?.security ?? 55,
    },
    capacities: input.capacities ?? capacities(),
  };
}

const countries: Record<string, CountryState> = {
  FRA: country({
    id: 'FRA', name: 'France', flag: '🇫🇷', weight: 82, statisticalReliability: 92,
    metrics: { budget: 246, industry: 100, stability: 68, security: 54 },
    capacities: capacities({ government: [68, 31], administration: [72, 42], diplomacy: [64, 36], economy: [62, 39], intelligence: [55, 30], defense: [70, 43] }),
    politics: {
      regime: 'République semi-présidentielle en cohabitation', executive: 'Jacques Chirac',
      headOfGovernment: 'Lionel Jospin', governmentLabel: 'Gouvernement de la gauche plurielle',
      legislatureSeats: 577, governingSeats: 319, publicApproval: 57, administrativeCompliance: 78,
      doctrine: { economic: -18, social: 28, sovereignty: 18, security: 8 },
    },
    strategy: {
      goals: [
        { id: 'european-leadership', label: 'Peser sur la construction européenne', priority: 88, progress: 42, status: 'active' },
        { id: 'industrial-autonomy', label: 'Préserver l’autonomie industrielle', priority: 72, progress: 55, status: 'active' },
      ],
      vulnerabilities: ['Dépendance énergétique', 'Chômage élevé', 'Cohabitation politique'],
      redLines: ['Marginalisation européenne', 'Perte d’autonomie nucléaire'],
      partners: ['DEU', 'ITA', 'USA'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  DEU: country({
    id: 'DEU', name: 'Allemagne', flag: '🇩🇪', weight: 84, statisticalReliability: 94,
    metrics: { industry: 112, stability: 72, security: 62 },
    capacities: capacities({ government: [72, 34], administration: [78, 40], diplomacy: [66, 33], economy: [78, 45], intelligence: [58, 28], defense: [66, 36] }),
    politics: {
      regime: 'République fédérale parlementaire', executive: 'Johannes Rau', headOfGovernment: 'Gerhard Schröder',
      governmentLabel: 'Coalition SPD–Verts', legislatureSeats: 669, governingSeats: 345,
      publicApproval: 55, administrativeCompliance: 84,
      doctrine: { economic: 18, social: 20, sovereignty: -12, security: 4 },
    },
    strategy: {
      goals: [{ id: 'euro-stability', label: 'Garantir la crédibilité de l’euro', priority: 92, progress: 48, status: 'active' }],
      vulnerabilities: ['Coût de la réunification', 'Dépendance énergétique'],
      redLines: ['Mutualisation durable des dettes'], partners: ['FRA', 'USA', 'POL'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  ITA: country({
    id: 'ITA', name: 'Italie', flag: '🇮🇹', weight: 68, statisticalReliability: 86,
    politics: {
      regime: 'République parlementaire', executive: 'Carlo Azeglio Ciampi', headOfGovernment: 'Massimo D’Alema',
      governmentLabel: 'Coalition de centre gauche', legislatureSeats: 630, governingSeats: 330,
      publicApproval: 46, administrativeCompliance: 64,
      doctrine: { economic: -8, social: 20, sovereignty: -5, security: 0 },
    },
    strategy: {
      goals: [{ id: 'mediterranean-influence', label: 'Renforcer l’influence méditerranéenne', priority: 72, progress: 41, status: 'active' }],
      vulnerabilities: ['Dette publique', 'Instabilité gouvernementale', 'Dépendance énergétique'],
      redLines: ['Marginalisation méditerranéenne'], partners: ['FRA', 'DEU'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  POL: country({
    id: 'POL', name: 'Pologne', flag: '🇵🇱', weight: 54, statisticalReliability: 78,
    politics: {
      regime: 'République parlementaire', executive: 'Aleksander Kwaśniewski', headOfGovernment: 'Jerzy Buzek',
      governmentLabel: 'Coalition AWS–UW', legislatureSeats: 460, governingSeats: 261,
      publicApproval: 43, administrativeCompliance: 59,
      doctrine: { economic: 26, social: 4, sovereignty: 42, security: 48 },
    },
    strategy: {
      goals: [{ id: 'eu-accession', label: 'Préparer l’adhésion à l’Union européenne', priority: 96, progress: 56, status: 'active' }],
      vulnerabilities: ['Modernisation militaire', 'Transition économique'],
      redLines: ['Pression russe'], partners: ['DEU', 'USA'], rivals: ['RUS'], lastReviewDate: '2000-01-01',
    },
  }),
  USA: country({
    id: 'USA', name: 'États-Unis', flag: '🇺🇸', weight: 100, statisticalReliability: 91,
    metrics: { industry: 128, stability: 74, security: 70 },
    capacities: capacities({ government: [92, 51], administration: [94, 54], diplomacy: [100, 58], economy: [100, 61], intelligence: [100, 65], defense: [100, 67] }),
    politics: {
      regime: 'République fédérale présidentielle', executive: 'Bill Clinton', headOfGovernment: 'Bill Clinton',
      governmentLabel: 'Administration Clinton', legislatureSeats: 535, governingSeats: 260,
      publicApproval: 62, administrativeCompliance: 82,
      doctrine: { economic: 28, social: 12, sovereignty: 35, security: 34 },
    },
    strategy: {
      goals: [{ id: 'global-order', label: 'Préserver l’ordre international dominé par Washington', priority: 98, progress: 75, status: 'active' }],
      vulnerabilities: ['Polarisation politique', 'Dépendance aux marchés financiers'],
      redLines: ['Remise en cause de l’OTAN', 'Attaque du territoire national'], partners: ['FRA', 'DEU', 'GBR'], rivals: ['RUS', 'CHN'], lastReviewDate: '2000-01-01',
    },
  }),
  GBR: country({
    id: 'GBR', name: 'Royaume-Uni', flag: '🇬🇧', weight: 76, statisticalReliability: 92,
    politics: {
      regime: 'Monarchie parlementaire', executive: 'Élisabeth II', headOfGovernment: 'Tony Blair',
      governmentLabel: 'Gouvernement travailliste', legislatureSeats: 659, governingSeats: 418,
      publicApproval: 58, administrativeCompliance: 86,
      doctrine: { economic: 20, social: 18, sovereignty: 28, security: 32 },
    },
    strategy: {
      goals: [{ id: 'atlantic-bridge', label: 'Rester le pont entre l’Europe et les États-Unis', priority: 88, progress: 63, status: 'active' }],
      vulnerabilities: ['Arbitrage Europe–Atlantique'], redLines: ['Intégration européenne fédérale'],
      partners: ['USA', 'FRA'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  RUS: country({
    id: 'RUS', name: 'Russie', flag: '🇷🇺', weight: 80, statisticalReliability: 55,
    metrics: { industry: 74, stability: 45, security: 64 },
    politics: {
      regime: 'République fédérale présidentielle en transition', executive: 'Vladimir Poutine', headOfGovernment: 'Vladimir Poutine',
      governmentLabel: 'Présidence par intérim', legislatureSeats: 450, governingSeats: 170,
      publicApproval: 61, administrativeCompliance: 52,
      doctrine: { economic: 18, social: -8, sovereignty: 74, security: 70 },
    },
    strategy: {
      goals: [{ id: 'state-restoration', label: 'Restaurer l’autorité de l’État', priority: 100, progress: 38, status: 'active' }],
      vulnerabilities: ['Institutions fragiles', 'Conflit tchétchène', 'Économie dépendante des matières premières'],
      redLines: ['Extension de l’OTAN à l’espace postsoviétique'], partners: [], rivals: ['USA'], lastReviewDate: '2000-01-01',
    },
  }),
  CHN: country({
    id: 'CHN', name: 'Chine', flag: '🇨🇳', weight: 86, statisticalReliability: 52,
    metrics: { industry: 92, stability: 70, security: 72 },
    capacities: capacities({ government: [90, 46], administration: [82, 48], diplomacy: [72, 34], economy: [88, 57], intelligence: [78, 45], defense: [84, 49] }),
    politics: {
      regime: 'République populaire à parti unique', executive: 'Jiang Zemin', headOfGovernment: 'Zhu Rongji',
      governmentLabel: 'Direction du Parti communiste chinois', legislatureSeats: 2979, governingSeats: 2979,
      publicApproval: 72, administrativeCompliance: 80,
      doctrine: { economic: 36, social: -22, sovereignty: 88, security: 62 },
    },
    strategy: {
      goals: [{ id: 'industrial-rise', label: 'Accélérer l’industrialisation et l’intégration commerciale', priority: 100, progress: 52, status: 'active' }],
      vulnerabilities: ['Dépendance technologique', 'Inégalités régionales'], redLines: ['Indépendance de Taïwan'],
      partners: [], rivals: ['USA'], lastReviewDate: '2000-01-01',
    },
  }),
  NOR: country({
    id: 'NOR', name: 'Norvège', flag: '🇳🇴', weight: 42, statisticalReliability: 96,
    politics: {
      regime: 'Monarchie parlementaire', executive: 'Harald V', headOfGovernment: 'Kjell Magne Bondevik',
      governmentLabel: 'Coalition centriste', legislatureSeats: 165, governingSeats: 42,
      publicApproval: 54, administrativeCompliance: 91,
      doctrine: { economic: 8, social: 26, sovereignty: 22, security: 16 },
    },
    strategy: { goals: [], vulnerabilities: ['Dépendance aux recettes énergétiques'], redLines: [], partners: ['GBR', 'DEU'], rivals: [], lastReviewDate: '2000-01-01' },
  }),
  DZA: country({
    id: 'DZA', name: 'Algérie', flag: '🇩🇿', weight: 46, statisticalReliability: 56,
    politics: {
      regime: 'République présidentielle', executive: 'Abdelaziz Bouteflika', headOfGovernment: 'Ahmed Benbitour',
      governmentLabel: 'Présidence Bouteflika', legislatureSeats: 380, governingSeats: 240,
      publicApproval: 50, administrativeCompliance: 55,
      doctrine: { economic: -6, social: 6, sovereignty: 64, security: 72 },
    },
    strategy: { goals: [], vulnerabilities: ['Violence intérieure', 'Dépendance aux hydrocarbures'], redLines: [], partners: ['FRA'], rivals: [], lastReviewDate: '2000-01-01' },
  }),
  LBY: country({
    id: 'LBY', name: 'Libye', flag: '🇱🇾', weight: 38, statisticalReliability: 28,
    politics: {
      regime: 'Jamahiriya autoritaire', executive: 'Mouammar Kadhafi', headOfGovernment: 'Mouammar Kadhafi',
      governmentLabel: 'Direction révolutionnaire', legislatureSeats: 1000, governingSeats: 1000,
      publicApproval: 48, administrativeCompliance: 58,
      doctrine: { economic: -24, social: -4, sovereignty: 92, security: 80 },
    },
    strategy: { goals: [], vulnerabilities: ['Isolement diplomatique', 'Dépendance aux hydrocarbures'], redLines: [], partners: [], rivals: ['USA'], lastReviewDate: '2000-01-01' },
  }),
  SAU: country({
    id: 'SAU', name: 'Arabie saoudite', flag: '🇸🇦', weight: 62, statisticalReliability: 48,
    politics: {
      regime: 'Monarchie absolue', executive: 'Fahd ben Abdelaziz Al Saoud', headOfGovernment: 'Abdallah ben Abdelaziz Al Saoud',
      governmentLabel: 'Maison Al Saoud', legislatureSeats: 90, governingSeats: 90,
      publicApproval: 58, administrativeCompliance: 72,
      doctrine: { economic: 16, social: -72, sovereignty: 72, security: 76 },
    },
    strategy: { goals: [], vulnerabilities: ['Dépendance pétrolière', 'Tensions sociales'], redLines: ['Menace sur la monarchie'], partners: ['USA'], rivals: [], lastReviewDate: '2000-01-01' },
  }),
  BRA: country({
    id: 'BRA', name: 'Brésil', flag: '🇧🇷', weight: 70, statisticalReliability: 78,
    metrics: { budget: 132, industry: 82, stability: 63, security: 57 },
    capacities: capacities({ government: [70, 37], administration: [68, 40], diplomacy: [70, 34], economy: [72, 48], intelligence: [58, 30], defense: [66, 36] }),
    politics: {
      regime: 'République fédérale présidentielle', executive: 'Fernando Henrique Cardoso', headOfGovernment: 'Fernando Henrique Cardoso',
      governmentLabel: 'Coalition présidentielle autour du PSDB', legislatureSeats: 594, governingSeats: 340,
      publicApproval: 47, administrativeCompliance: 67,
      doctrine: { economic: 30, social: 10, sovereignty: 28, security: 18 },
    },
    strategy: {
      goals: [
        { id: 'bra-real-credibility', label: 'Consolider le real et la crédibilité financière', priority: 94, progress: 56, status: 'active' },
        { id: 'bra-regional-leadership', label: 'Affirmer le leadership sud-américain', priority: 78, progress: 47, status: 'active' },
      ],
      vulnerabilities: ['Dette et taux d’intérêt élevés', 'Inégalités sociales', 'Dépendance aux capitaux extérieurs'],
      redLines: ['Nouvelle crise monétaire'], partners: ['USA'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  ZAF: country({
    id: 'ZAF', name: 'Afrique du Sud', flag: '🇿🇦', weight: 55, statisticalReliability: 78,
    metrics: { budget: 74, industry: 64, stability: 58, security: 52 },
    capacities: capacities({ government: [60, 33], administration: [62, 36], diplomacy: [65, 29], economy: [62, 40], intelligence: [48, 23], defense: [53, 30] }),
    politics: {
      regime: 'République parlementaire constitutionnelle', executive: 'Thabo Mbeki', headOfGovernment: 'Thabo Mbeki',
      governmentLabel: 'Gouvernement de l’ANC', legislatureSeats: 400, governingSeats: 266,
      publicApproval: 61, administrativeCompliance: 63,
      doctrine: { economic: 8, social: 46, sovereignty: 33, security: 18 },
    },
    strategy: {
      goals: [
        { id: 'zaf-democratic-consolidation', label: 'Consolider la transition démocratique', priority: 96, progress: 54, status: 'active' },
        { id: 'zaf-african-role', label: 'Structurer une influence africaine crédible', priority: 74, progress: 45, status: 'active' },
      ],
      vulnerabilities: ['Chômage de masse', 'Inégalités héritées de l’apartheid', 'Criminalité et pandémie'],
      redLines: ['Retour à une violence politique systémique'], partners: ['BRA'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  AUS: country({
    id: 'AUS', name: 'Australie', flag: '🇦🇺', weight: 60, statisticalReliability: 94,
    metrics: { budget: 118, industry: 66, stability: 76, security: 64 },
    capacities: capacities({ government: [66, 30], administration: [74, 35], diplomacy: [72, 32], economy: [70, 37], intelligence: [62, 29], defense: [65, 33] }),
    politics: {
      regime: 'Monarchie parlementaire fédérale', executive: 'Élisabeth II', headOfGovernment: 'John Howard',
      governmentLabel: 'Coalition libérale–nationale', legislatureSeats: 150, governingSeats: 80,
      publicApproval: 56, administrativeCompliance: 86,
      doctrine: { economic: 34, social: -10, sovereignty: 35, security: 42 },
    },
    strategy: {
      goals: [
        { id: 'aus-us-alliance', label: 'Préserver l’alliance américaine et l’ancrage indo-pacifique', priority: 92, progress: 66, status: 'active' },
        { id: 'aus-resource-markets', label: 'Sécuriser les débouchés des ressources', priority: 82, progress: 60, status: 'active' },
      ],
      vulnerabilities: ['Éloignement géographique', 'Dépendance aux exportations de ressources', 'Exposition aux marchés asiatiques'],
      redLines: ['Abandon de l’alliance américaine'], partners: ['USA', 'JPN'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  IND: country({
    id: 'IND', name: 'Inde', flag: '🇮🇳', weight: 78, statisticalReliability: 72,
    metrics: { budget: 96, industry: 76, stability: 62, security: 72 },
    capacities: capacities({ government: [76, 42], administration: [64, 43], diplomacy: [78, 39], economy: [74, 49], intelligence: [68, 36], defense: [78, 46] }),
    politics: {
      regime: 'République fédérale parlementaire', executive: 'K. R. Narayanan', headOfGovernment: 'Atal Bihari Vajpayee',
      governmentLabel: 'Coalition NDA', legislatureSeats: 543, governingSeats: 296,
      publicApproval: 54, administrativeCompliance: 61,
      doctrine: { economic: 17, social: 12, sovereignty: 72, security: 70 },
    },
    strategy: {
      goals: [
        { id: 'ind-growth-opening', label: 'Accélérer la croissance et l’intégration économique', priority: 96, progress: 50, status: 'active' },
        { id: 'ind-strategic-autonomy', label: 'Préserver l’autonomie stratégique et nucléaire', priority: 98, progress: 64, status: 'active' },
      ],
      vulnerabilities: ['Pauvreté de masse', 'Infrastructures insuffisantes', 'Tensions avec le Pakistan et la Chine'],
      redLines: ['Contrainte extérieure sur la dissuasion nucléaire', 'Remise en cause du Cachemire'], partners: ['RUS'], rivals: ['CHN'], lastReviewDate: '2000-01-01',
    },
  }),
  JPN: country({
    id: 'JPN', name: 'Japon', flag: '🇯🇵', weight: 88, statisticalReliability: 95,
    metrics: { budget: 226, industry: 118, stability: 70, security: 68 },
    capacities: capacities({ government: [80, 43], administration: [88, 49], diplomacy: [82, 40], economy: [90, 55], intelligence: [68, 35], defense: [70, 38] }),
    politics: {
      regime: 'Monarchie constitutionnelle parlementaire', executive: 'Akihito', headOfGovernment: 'Yoshiro Mori',
      governmentLabel: 'Coalition PLD–Kōmeitō–Conservateur', legislatureSeats: 480, governingSeats: 271,
      publicApproval: 38, administrativeCompliance: 86,
      doctrine: { economic: 10, social: 10, sovereignty: 20, security: 25 },
    },
    strategy: {
      goals: [
        { id: 'jpn-end-stagnation', label: 'Sortir durablement de la stagnation et de la déflation', priority: 100, progress: 34, status: 'active' },
        { id: 'jpn-alliance', label: 'Maintenir l’alliance américaine et la sécurité régionale', priority: 94, progress: 70, status: 'active' },
      ],
      vulnerabilities: ['Déflation', 'Dette publique', 'Dépendance énergétique', 'Vieillissement démographique'],
      redLines: ['Menace directe sur l’archipel', 'Rupture de la garantie américaine'], partners: ['USA', 'AUS'], rivals: ['CHN'], lastReviewDate: '2000-01-01',
    },
  }),
  TUR: country({
    id: 'TUR', name: 'Turquie', flag: '🇹🇷', weight: 64, statisticalReliability: 68,
    metrics: { budget: 78, industry: 70, stability: 49, security: 75 },
    capacities: capacities({ government: [66, 42], administration: [61, 42], diplomacy: [72, 39], economy: [64, 50], intelligence: [65, 41], defense: [78, 50] }),
    politics: {
      regime: 'République parlementaire', executive: 'Süleyman Demirel', headOfGovernment: 'Bülent Ecevit',
      governmentLabel: 'Coalition DSP–MHP–ANAP', legislatureSeats: 550, governingSeats: 351,
      publicApproval: 45, administrativeCompliance: 62,
      doctrine: { economic: 10, social: -10, sovereignty: 73, security: 79 },
    },
    strategy: {
      goals: [
        { id: 'tur-imf-stabilization', label: 'Stabiliser l’économie et le programme financier', priority: 100, progress: 42, status: 'active' },
        { id: 'tur-eu-candidacy', label: 'Transformer la candidature européenne en levier stratégique', priority: 88, progress: 48, status: 'active' },
      ],
      vulnerabilities: ['Inflation extrême', 'Dette de court terme', 'Question kurde', 'Fragilité bancaire'],
      redLines: ['Partition territoriale', 'Isolement de l’OTAN'], partners: ['USA'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
  VNM: country({
    id: 'VNM', name: 'Vietnam', flag: '🇻🇳', weight: 48, statisticalReliability: 58,
    metrics: { budget: 42, industry: 54, stability: 61, security: 58 },
    capacities: capacities({ government: [62, 35], administration: [60, 37], diplomacy: [58, 27], economy: [61, 42], intelligence: [52, 28], defense: [62, 36] }),
    politics: {
      regime: 'République socialiste à parti unique', executive: 'Trần Đức Lương', headOfGovernment: 'Phan Văn Khải',
      governmentLabel: 'Direction du Parti communiste vietnamien', legislatureSeats: 450, governingSeats: 450,
      publicApproval: 64, administrativeCompliance: 70,
      doctrine: { economic: 10, social: -18, sovereignty: 76, security: 50 },
    },
    strategy: {
      goals: [
        { id: 'vnm-export-industrialization', label: 'Accélérer l’industrialisation orientée vers l’export', priority: 98, progress: 52, status: 'active' },
        { id: 'vnm-strategic-balance', label: 'Préserver la marge de manœuvre face aux grandes puissances', priority: 90, progress: 44, status: 'active' },
      ],
      vulnerabilities: ['Faible revenu par habitant', 'Infrastructures', 'Dépendance commerciale', 'Pression chinoise'],
      redLines: ['Atteinte à la souveraineté maritime', 'Déstabilisation du Parti'], partners: [], rivals: ['CHN'], lastReviewDate: '2000-01-01',
    },
  }),
};

const allCountries: Record<string, CountryState> = {
  ...createGlobalBaselineCountries2000(),
  ...countries,
  ...createNationalBaselineCountries2000(),
  ESP: country({
    id: 'ESP', name: 'Espagne', flag: '🇪🇸', weight: 70, statisticalReliability: 88,
    metrics: { budget: 118, industry: 88, stability: 64, security: 55 },
    capacities: capacities({ government: [70, 35], administration: [68, 38], diplomacy: [68, 34], economy: [72, 42], intelligence: [58, 30], defense: [66, 36] }),
    politics: {
      regime: 'Monarchie parlementaire', executive: 'Juan Carlos I', headOfGovernment: 'José María Aznar',
      governmentLabel: 'Gouvernement conservateur du Partido Popular', legislatureSeats: 350, governingSeats: 183,
      publicApproval: 52, administrativeCompliance: 72,
      doctrine: { economic: 18, social: -4, sovereignty: 12, security: 18 },
    },
    strategy: {
      goals: [
        { id: 'esp-euro-convergence', label: 'Consolider la convergence européenne', priority: 88, progress: 62, status: 'active' },
        { id: 'esp-mediterranean', label: 'Renforcer la position méditerranéenne et atlantique', priority: 74, progress: 48, status: 'active' },
      ],
      vulnerabilities: ['Chômage élevé', 'Dépendance énergétique extérieure', 'Écarts régionaux persistants'],
      redLines: ['Atteinte à l’intégrité territoriale', 'Isolement européen'], partners: ['FRA', 'DEU', 'ITA'], rivals: [], lastReviewDate: '2000-01-01',
    },
  }),
};

const currents: Record<string, HistoricalCurrent> = {
  'dotcom-exuberance': {
    id: 'dotcom-exuberance', name: 'Emballement des valeurs technologiques', startDate: '1998-01-01',
    probableWindow: { start: '2000-02-01', end: '2001-12-31' }, pressure: 78, inertia: 82,
    driverRate: 2.4, brakeRate: 0.6,
    drivers: ['Afflux de capitaux', 'Valorisations déconnectées des revenus', 'Optimisme autour d’Internet'],
    brakes: ['Resserrement monétaire', 'Contrôle prudentiel', 'Correction anticipée'], affectedActors: ['USA', 'FRA', 'DEU', 'GBR'],
    latentProcessIds: ['dotcom-repricing'], possibleManifestations: ['Correction progressive', 'Krach technologique', 'Contagion bancaire limitée'],
    playerVisibility: 'known', status: 'active',
  },
  'lisbon-convergence': {
    id: 'lisbon-convergence', name: 'Convergence européenne vers l’économie de la connaissance', startDate: '1999-06-01',
    probableWindow: { start: '2000-03-01', end: '2001-06-30' }, pressure: 66, inertia: 74,
    driverRate: 1.6, brakeRate: 0.4, drivers: ['Agenda européen', 'Retard technologique perçu', 'Emploi'],
    brakes: ['Désaccords budgétaires', 'Priorités nationales'], affectedActors: ['FRA', 'DEU', 'ITA', 'GBR'],
    latentProcessIds: ['lisbon-agenda'], possibleManifestations: ['Stratégie européenne commune', 'Accord minimal', 'Coalitions sectorielles'],
    playerVisibility: 'known', status: 'active',
  },
  'transnational-jihadism': {
    id: 'transnational-jihadism', name: 'Expansion des réseaux djihadistes transnationaux', startDate: '1996-01-01',
    probableWindow: { start: '2000-01-01', end: '2004-12-31' }, pressure: 64, inertia: 88,
    driverRate: 1.1, brakeRate: 0.25, drivers: ['Réseaux vétérans', 'Financements clandestins', 'Sanctuaires'],
    brakes: ['Coopération du renseignement', 'Arrestations', 'Tarissement financier'], affectedActors: ['USA', 'FRA', 'GBR'],
    latentProcessIds: ['major-external-operation'], possibleManifestations: ['Attentat majeur', 'Tentative déjouée', 'Campagne coordonnée de moindre ampleur'],
    playerVisibility: 'hidden', status: 'active',
  },
};

const latentProcesses: Record<string, LatentProcess> = {
  'dotcom-repricing': { id: 'dotcom-repricing', currentId: 'dotcom-exuberance', actorId: 'GLOBAL_MARKETS', objective: 'Réévaluer brutalement les actifs technologiques', progress: 70, capability: 86, secrecy: 10, window: { start: '2000-03-01', end: '2001-12-31' }, possibleOutcomes: ['Correction progressive', 'Krach technologique'], status: 'preparing' },
  'lisbon-agenda': { id: 'lisbon-agenda', currentId: 'lisbon-convergence', actorId: 'EU', objective: 'Produire une stratégie économique européenne commune', progress: 58, capability: 72, secrecy: 18, window: { start: '2000-03-01', end: '2000-06-30' }, possibleOutcomes: ['Stratégie ambitieuse', 'Compromis limité'], status: 'preparing' },
  'major-external-operation': { id: 'major-external-operation', currentId: 'transnational-jihadism', actorId: 'AL_QAEDA_NETWORK', objective: 'Organiser une opération extérieure majeure contre les États-Unis', progress: 42, capability: 58, secrecy: 91, window: { start: '2001-01-01', end: '2003-12-31' }, possibleOutcomes: ['Attentat majeur', 'Tentative déjouée', 'Opération retardée'], status: 'preparing' },
};

const strategicDossiers: Record<string, StrategicDossier> = {
  'current-dotcom-exuberance': {
    id: 'current-dotcom-exuberance', title: 'Surchauffe des valeurs technologiques', kind: 'economic',
    status: 'active', importance: 'major', actorIds: ['USA', 'FRA', 'DEU', 'GBR'], regionTags: ['Amérique du Nord', 'Europe'],
    startedAt: '2000-01-01', updatedAt: '2000-01-01', phase: 'Accumulation des vulnérabilités', trend: 'escalating',
    publicSummary: 'Les valorisations technologiques et les flux de capitaux s’éloignent des revenus observables.',
    followed: false, autoTracked: true, commitments: [],
    pendingDecisions: ['Déterminer si la France prépare un dispositif de prévention financière.'],
    relatedCurrentIds: ['dotcom-exuberance'], relatedActionIds: [],
    entries: [{ id: 'dotcom-opening', date: '2000-01-01', title: 'Valorisations sous tension', summary: 'L’exposition des marchés occidentaux au secteur technologique devient un sujet stratégique durable.', importance: 'moderate', actorIds: ['USA', 'FRA', 'DEU', 'GBR'], requiresDecision: false, visibility: 'public' }],
  },
  'current-lisbon-convergence': {
    id: 'current-lisbon-convergence', title: 'Stratégie économique européenne', kind: 'cooperation',
    status: 'active', importance: 'moderate', actorIds: ['FRA', 'DEU', 'ITA', 'GBR'], regionTags: ['Europe'],
    startedAt: '2000-01-01', updatedAt: '2000-01-01', phase: 'Préparation de l’agenda commun', trend: 'stable',
    publicSummary: 'Les gouvernements européens cherchent un compromis sur l’économie de la connaissance et l’emploi.',
    followed: false, autoTracked: false, commitments: [], pendingDecisions: [],
    relatedCurrentIds: ['lisbon-convergence'], relatedActionIds: [],
    entries: [{ id: 'lisbon-opening', date: '2000-01-01', title: 'Agenda européen en préparation', summary: 'Les capitales commencent à consolider leurs priorités avant les prochaines échéances.', importance: 'minor', actorIds: ['FRA', 'DEU', 'ITA', 'GBR'], requiresDecision: false, visibility: 'public' }],
  },
};

const energyNodes: Record<string, EnergyNode> = {
  'nor-oil': { id: 'nor-oil', countryId: 'NOR', resource: 'oil', label: 'Plateau continental norvégien', provenReserves: 920, probableReserves: 320, annualProduction: 150, annualCapacity: 164, domesticConsumption: 10, storageCapacity: 18, stocks: 11, extractionCost: 18, declineRate: 0.02, developmentLeadMonths: 42, infrastructure: ['Terminaux de la mer du Nord', 'Oléoducs offshore'] },
  'nor-gas': { id: 'nor-gas', countryId: 'NOR', resource: 'gas', label: 'Gaz de la mer du Nord', provenReserves: 1180, probableReserves: 410, annualProduction: 62, annualCapacity: 72, domesticConsumption: 5, storageCapacity: 10, stocks: 5, extractionCost: 15, declineRate: 0.01, developmentLeadMonths: 48, infrastructure: ['Europipe', 'Zeepipe'] },
  'rus-oil': { id: 'rus-oil', countryId: 'RUS', resource: 'oil', label: 'Bassins pétroliers russes', provenReserves: 6400, probableReserves: 2200, annualProduction: 325, annualCapacity: 360, domesticConsumption: 125, storageCapacity: 45, stocks: 28, extractionCost: 12, declineRate: 0.015, developmentLeadMonths: 36, infrastructure: ['Droujba', 'Terminaux baltes'] },
  'rus-gas': { id: 'rus-gas', countryId: 'RUS', resource: 'gas', label: 'Système gazier russe', provenReserves: 18600, probableReserves: 5200, annualProduction: 520, annualCapacity: 570, domesticConsumption: 330, storageCapacity: 95, stocks: 60, extractionCost: 9, declineRate: 0.008, developmentLeadMonths: 48, infrastructure: ['Fraternité', 'Yamal-Europe'] },
  'dza-oil': { id: 'dza-oil', countryId: 'DZA', resource: 'oil', label: 'Bassins sahariens algériens', provenReserves: 1450, probableReserves: 500, annualProduction: 70, annualCapacity: 82, domesticConsumption: 18, storageCapacity: 14, stocks: 8, extractionCost: 10, declineRate: 0.012, developmentLeadMonths: 30, infrastructure: ['Terminaux méditerranéens'] },
  'dza-gas': { id: 'dza-gas', countryId: 'DZA', resource: 'gas', label: 'Gaz saharien algérien', provenReserves: 4500, probableReserves: 1600, annualProduction: 88, annualCapacity: 104, domesticConsumption: 24, storageCapacity: 18, stocks: 9, extractionCost: 8, declineRate: 0.009, developmentLeadMonths: 36, infrastructure: ['TransMed', 'Gazoduc Maghreb-Europe', 'Terminaux GNL'] },
  'lby-oil': { id: 'lby-oil', countryId: 'LBY', resource: 'oil', label: 'Croissant pétrolier libyen', provenReserves: 3900, probableReserves: 1100, annualProduction: 70, annualCapacity: 92, domesticConsumption: 12, storageCapacity: 20, stocks: 10, extractionCost: 7, declineRate: 0.01, developmentLeadMonths: 30, infrastructure: ['Ras Lanouf', 'Es Sider'] },
  'sau-oil': { id: 'sau-oil', countryId: 'SAU', resource: 'oil', label: 'Système pétrolier saoudien', provenReserves: 26000, probableReserves: 6400, annualProduction: 430, annualCapacity: 520, domesticConsumption: 65, storageCapacity: 70, stocks: 42, extractionCost: 4, declineRate: 0.004, developmentLeadMonths: 24, infrastructure: ['Ras Tanura', 'Petroline'] },
  'bra-oil': { id: 'bra-oil', countryId: 'BRA', resource: 'oil', label: 'Bassins offshore brésiliens', provenReserves: 920, probableReserves: 420, annualProduction: 68, annualCapacity: 75, domesticConsumption: 100, storageCapacity: 20, stocks: 11, extractionCost: 20, declineRate: 0.01, developmentLeadMonths: 48, infrastructure: ['Bassin de Campos', 'Terminaux du Sud-Est'] },
  'aus-gas': { id: 'aus-gas', countryId: 'AUS', resource: 'gas', label: 'Gaz offshore australien', provenReserves: 1150, probableReserves: 520, annualProduction: 31, annualCapacity: 38, domesticConsumption: 20, storageCapacity: 5, stocks: 2, extractionCost: 14, declineRate: 0.008, developmentLeadMonths: 48, infrastructure: ['Bass Strait', 'North West Shelf'] },
  'vnm-oil': { id: 'vnm-oil', countryId: 'VNM', resource: 'oil', label: 'Plateau continental vietnamien', provenReserves: 350, probableReserves: 180, annualProduction: 17, annualCapacity: 21, domesticConsumption: 8, storageCapacity: 3, stocks: 1, extractionCost: 17, declineRate: 0.012, developmentLeadMonths: 42, infrastructure: ['Bach Ho', 'Vung Tau'] },
  ...territorialEnergyNodeAdditions,
};

const baselineFlow = (
  id: string, buyerId: string, resource: 'oil' | 'gas', annualVolume: number, route: string, sourceNodeId?: string,
): BaselineEnergyFlow => ({
  id, buyerId, resource, annualVolume, route, sourceNodeId,
  ...(sourceNodeId ? {} : { externalSourceLabel: 'Marché hors périmètre ORDO' }),
  startDate: '2000-01-01', endDate: '2025-12-31',
});

/**
 * Les importations de départ sont attribuées à une origine finie. Les volumes
 * « hors périmètre » couvrent le reste du monde, mais ne constituent pas une
 * source négociable tant que leurs pays ne sont pas ajoutés au moteur.
 */
const baselineEnergyFlows: Record<string, BaselineEnergyFlow> = Object.fromEntries([
  baselineFlow('fra-oil-nor', 'FRA', 'oil', 20, 'Mer du Nord', 'nor-oil'), baselineFlow('fra-oil-rus', 'FRA', 'oil', 20, 'Terminaux baltes', 'rus-oil'), baselineFlow('fra-oil-dza', 'FRA', 'oil', 10, 'Méditerranée', 'dza-oil'), baselineFlow('fra-oil-sau', 'FRA', 'oil', 20, 'Canal de Suez', 'sau-oil'), baselineFlow('fra-oil-ext', 'FRA', 'oil', 20, 'Marché maritime mondial'),
  baselineFlow('fra-gas-dza', 'FRA', 'gas', 14, 'Gazoduc Maghreb-Europe', 'dza-gas'), baselineFlow('fra-gas-nor', 'FRA', 'gas', 6, 'Interconnexions mer du Nord', 'nor-gas'), baselineFlow('fra-gas-rus', 'FRA', 'gas', 12, 'Corridor continental', 'rus-gas'), baselineFlow('fra-gas-ext', 'FRA', 'gas', 11, 'GNL mondial'),
  baselineFlow('deu-oil-rus', 'DEU', 'oil', 20, 'Droujba', 'rus-oil'), baselineFlow('deu-oil-nor', 'DEU', 'oil', 8, 'Mer du Nord', 'nor-oil'), baselineFlow('deu-oil-sau', 'DEU', 'oil', 25, 'Canal de Suez', 'sau-oil'), baselineFlow('deu-oil-ext', 'DEU', 'oil', 71, 'Marché maritime mondial'),
  baselineFlow('deu-gas-rus', 'DEU', 'gas', 30, 'Yamal-Europe', 'rus-gas'), baselineFlow('deu-gas-nor', 'DEU', 'gas', 8, 'Europipe', 'nor-gas'), baselineFlow('deu-gas-dza', 'DEU', 'gas', 4, 'Interconnexions européennes', 'dza-gas'), baselineFlow('deu-gas-ext', 'DEU', 'gas', 18, 'GNL mondial'),
  baselineFlow('ita-oil-rus', 'ITA', 'oil', 10, 'Mer Noire–Méditerranée', 'rus-oil'), baselineFlow('ita-oil-lby', 'ITA', 'oil', 7, 'Méditerranée centrale', 'lby-oil'), baselineFlow('ita-oil-dza', 'ITA', 'oil', 5, 'Méditerranée', 'dza-oil'), baselineFlow('ita-oil-sau', 'ITA', 'oil', 15, 'Canal de Suez', 'sau-oil'), baselineFlow('ita-oil-ext', 'ITA', 'oil', 54, 'Marché maritime mondial'),
  baselineFlow('ita-gas-rus', 'ITA', 'gas', 25, 'Corridor continental', 'rus-gas'), baselineFlow('ita-gas-dza', 'ITA', 'gas', 16, 'TransMed', 'dza-gas'), baselineFlow('ita-gas-ext', 'ITA', 'gas', 4, 'GNL mondial'),
  baselineFlow('pol-oil-rus', 'POL', 'oil', 15, 'Droujba', 'rus-oil'), baselineFlow('pol-oil-ext', 'POL', 'oil', 8, 'Marché maritime mondial'), baselineFlow('pol-gas-rus', 'POL', 'gas', 9, 'Yamal-Europe', 'rus-gas'),
  baselineFlow('usa-oil-sau', 'USA', 'oil', 80, 'Golfe–Atlantique', 'sau-oil'), baselineFlow('usa-oil-ext', 'USA', 'oil', 370, 'Marché continental et maritime'), baselineFlow('usa-gas-ext', 'USA', 'gas', 130, 'Marché continental'),
  baselineFlow('chn-oil-rus', 'CHN', 'oil', 18, 'Livraisons ferroviaires', 'rus-oil'), baselineFlow('chn-oil-sau', 'CHN', 'oil', 12, 'Océan Indien', 'sau-oil'), baselineFlow('chn-oil-ext', 'CHN', 'oil', 20, 'Marché maritime mondial'), baselineFlow('chn-gas-ext', 'CHN', 'gas', 4, 'GNL mondial'),
  baselineFlow('bra-oil-ext', 'BRA', 'oil', 32, 'Marché atlantique'), baselineFlow('bra-gas-ext', 'BRA', 'gas', 3, 'Gaz régional'), baselineFlow('zaf-oil-ext', 'ZAF', 'oil', 21, 'Marché maritime mondial'),
  baselineFlow('ind-oil-sau', 'IND', 'oil', 25, 'Océan Indien', 'sau-oil'), baselineFlow('ind-oil-rus', 'IND', 'oil', 10, 'Mer Noire–océan Indien', 'rus-oil'), baselineFlow('ind-oil-ext', 'IND', 'oil', 40, 'Marché maritime mondial'),
  baselineFlow('jpn-oil-sau', 'JPN', 'oil', 70, 'Golfe–Asie orientale', 'sau-oil'), baselineFlow('jpn-oil-ext', 'JPN', 'oil', 189, 'Marché maritime mondial'), baselineFlow('jpn-gas-aus', 'JPN', 'gas', 6, 'North West Shelf', 'aus-gas'), baselineFlow('jpn-gas-ext', 'JPN', 'gas', 72, 'GNL mondial'),
  baselineFlow('tur-oil-rus', 'TUR', 'oil', 6, 'Mer Noire', 'rus-oil'), baselineFlow('tur-oil-sau', 'TUR', 'oil', 8, 'Méditerranée orientale', 'sau-oil'), baselineFlow('tur-oil-ext', 'TUR', 'oil', 16, 'Marché maritime mondial'), baselineFlow('tur-gas-rus', 'TUR', 'gas', 13, 'Blue Stream', 'rus-gas'),
].map((flow) => [flow.id, flow]));

const sectors: Record<string, StrategicSectorState> = {
  'FRA-defense': { id: 'FRA-defense', countryId: 'FRA', sector: 'defense', capacity: 82, utilization: 71, workloadMonths: 30, health: 78, foreignDependency: 22, technology: 86, expansionLeadMonths: 30 },
  'FRA-semiconductors': { id: 'FRA-semiconductors', countryId: 'FRA', sector: 'semiconductors', capacity: 48, utilization: 76, workloadMonths: 12, health: 61, foreignDependency: 64, technology: 66, expansionLeadMonths: 42, vulnerability: 'Dépendance aux procédés les plus avancés' },
  'FRA-nuclear': { id: 'FRA-nuclear', countryId: 'FRA', sector: 'nuclear', capacity: 92, utilization: 68, workloadMonths: 54, health: 88, foreignDependency: 18, technology: 91, expansionLeadMonths: 72 },
  'DEU-machine-tools': { id: 'DEU-machine-tools', countryId: 'DEU', sector: 'machine_tools', capacity: 94, utilization: 84, workloadMonths: 18, health: 91, foreignDependency: 24, technology: 92, expansionLeadMonths: 24 },
  'USA-semiconductors': { id: 'USA-semiconductors', countryId: 'USA', sector: 'semiconductors', capacity: 100, utilization: 86, workloadMonths: 14, health: 94, foreignDependency: 28, technology: 100, expansionLeadMonths: 30 },
  'CHN-semiconductors': { id: 'CHN-semiconductors', countryId: 'CHN', sector: 'semiconductors', capacity: 32, utilization: 91, workloadMonths: 22, health: 64, foreignDependency: 82, technology: 48, expansionLeadMonths: 48, vulnerability: 'Dépendance aux équipements et conceptions étrangers' },
};

const armamentProducts: Record<string, ArmamentProduct> = {
  'mirage-2000-5': { id: 'mirage-2000-5', countryId: 'FRA', name: 'Mirage 2000-5/9', family: 'Avion de combat', manufacturer: 'Dassault Aviation', status: 'production', annualCapacity: 15, backlogMonths: 32, industrialHealth: 82, maturity: 'proven', operationalExperience: 'combat_deployed', fieldFeedback: 'favorable', evidenceConfidence: 88, reputation: 86, clients: [{ countryId: 'FRA', quantity: 315, delivered: 240 }, { countryId: 'GRC', quantity: 40, delivered: 25 }, { countryId: 'UAE', quantity: 30, delivered: 0 }], prospects: [] },
  rafale: { id: 'rafale', countryId: 'FRA', name: 'Rafale', family: 'Avion de combat', manufacturer: 'Dassault Aviation', status: 'development', annualCapacity: 6, backlogMonths: 54, industrialHealth: 76, maturity: 'qualification', operationalExperience: 'exercise_only', fieldFeedback: 'unknown', evidenceConfidence: 82, reputation: 68, clients: [{ countryId: 'FRA', quantity: 61, delivered: 0 }], prospects: [] },
  leclerc: { id: 'leclerc', countryId: 'FRA', name: 'Leclerc', family: 'Char de combat', manufacturer: 'GIAT Industries', status: 'production', annualCapacity: 32, backlogMonths: 42, industrialHealth: 56, maturity: 'in_service', operationalExperience: 'deployed_no_combat', fieldFeedback: 'mixed', evidenceConfidence: 84, reputation: 73, clients: [{ countryId: 'FRA', quantity: 406, delivered: 218 }, { countryId: 'UAE', quantity: 390, delivered: 280 }], prospects: [] },
  caesar: { id: 'caesar', countryId: 'FRA', name: 'CAESAR', family: 'Artillerie automotrice', manufacturer: 'GIAT Industries', status: 'development', annualCapacity: 2, backlogMonths: 8, industrialHealth: 52, maturity: 'prototype', operationalExperience: 'exercise_only', fieldFeedback: 'unknown', evidenceConfidence: 70, reputation: 45, clients: [], prospects: [] },
  scorpene: { id: 'scorpene', countryId: 'FRA', name: 'Scorpène', family: 'Sous-marin conventionnel', manufacturer: 'DCN', status: 'production', annualCapacity: 0.7, backlogMonths: 58, industrialHealth: 81, maturity: 'qualification', operationalExperience: 'never_deployed', fieldFeedback: 'unknown', evidenceConfidence: 78, reputation: 72, clients: [{ countryId: 'CHL', quantity: 2, delivered: 0 }], prospects: [] },
  exocet: { id: 'exocet', countryId: 'FRA', name: 'Exocet', family: 'Missile antinavire', manufacturer: 'Aérospatiale Matra Missiles', status: 'exportable', annualCapacity: 42, backlogMonths: 20, industrialHealth: 84, maturity: 'proven', operationalExperience: 'combat_deployed', fieldFeedback: 'favorable', evidenceConfidence: 93, reputation: 90, clients: [], prospects: [] },
};

/** Fallback energy envelope for countries without a site-level inventory yet. */
function defaultCountryEnergy2000(country: CountryState): CountryEnergyState {
  const demand = Math.max(4, country.weight * 1.35);
  const gasShare = country.strategy.vulnerabilities.some((item) => /gaz|énerg|pétrol/i.test(item)) ? 0.42 : 0.3;
  const gasDemand = Math.max(2, demand * gasShare);
  const domesticShare = country.strategy.vulnerabilities.some((item) => /pétrol|hydrocarb|ressource/i.test(item)) ? 0.34 : 0.08;
  const oilDomestic = demand * domesticShare;
  const gasDomestic = gasDemand * (domesticShare * 0.8);
  return {
    countryId: country.id,
    annualDemand: { oil: demand, gas: gasDemand },
    domesticProduction: { oil: oilDomestic, gas: gasDomestic },
    legacyImports: { oil: Math.max(0, demand - oilDomestic), gas: Math.max(0, gasDemand - gasDomestic) },
    strategicStocks: { oil: demand * 0.16, gas: gasDemand * 0.12 },
    storageCapacity: { oil: demand * 0.24, gas: gasDemand * 0.2 },
    desiredCoverageMonths: { oil: 2, gas: 1 },
  };
}

export function createWorld2000(requestedPlayerCountryId: CountryId = 'FRA'): WorldState {
  const structuralProfiles = createStructuralProfiles2000(allCountries);
  const macroEconomies = createMacroEconomies2000();
  assertValidCountryRegistry(allCountries, macroEconomies, { defenseReferences: defenseReferences2000ForValidation });
  const playerCountryId = allCountries[requestedPlayerCountryId] ? requestedPlayerCountryId : 'FRA';
  const playerCountry = allCountries[playerCountryId];
  const energyNodesWithAssets = structuredClone(energyNodes);
  const territorialWithOperations = initializeTerritorialAssetOperations(
    createTerritorialState({ countries: allCountries, macroEconomies }),
    energyNodesWithAssets,
  );
  const dossiers = structuredClone(strategicDossiers);
  const dotcom = dossiers['current-dotcom-exuberance'];
  const playerDirectlyExposed = dotcom.actorIds.includes(playerCountryId);
  dotcom.pendingDecisions = playerDirectlyExposed
    ? [`Déterminer si ${playerCountry.name} prépare un dispositif de prévention financière.`]
    : [];
  return {
    version: 1,
    territorial: territorialWithOperations.territorial,
    scenarioId: `${playerCountryId.toLowerCase()}-2000-01`,
    seed: 20000101,
    sequence: 0,
    currentDate: '2000-01-01',
    playerCountryId,
    countries: structuredClone(allCountries),
    relations: {
      'FRA:DEU': { from: 'FRA', to: 'DEU', relation: 68, trust: 61, tradeIntensity: 82, securityAlignment: 65, memories: [] },
      'FRA:ITA': { from: 'FRA', to: 'ITA', relation: 57, trust: 53, tradeIntensity: 69, securityAlignment: 54, memories: [] },
      'FRA:POL': { from: 'FRA', to: 'POL', relation: 44, trust: 39, tradeIntensity: 34, securityAlignment: 41, memories: [] },
      'FRA:USA': { from: 'FRA', to: 'USA', relation: 73, trust: 66, tradeIntensity: 74, securityAlignment: 81, memories: [] },
    },
    intelligence: { 'FRA:DEU': 0, 'FRA:ITA': 0, 'FRA:POL': 0, 'FRA:USA': 0, 'FRA:RUS': 0, 'FRA:CHN': 0 },
    institutions: {
      'prosperity-ministry': { id: 'prosperity-ministry', countryId: 'FRA', label: 'Sous-ministère à la Prospérité', stage: 'proposal', progressMonths: 0, durationMonths: 7 },
    },
    treaties: {
      'industrial-protocol': { id: 'industrial-protocol', parties: ['FRA', 'DEU'], label: 'Protocole industriel', status: 'draft', monthlyEffects: [{ countryId: 'FRA', metric: 'industry', delta: 0.6 }] },
    },
    historicalCurrents: structuredClone(currents),
    historicalAnchors: createHistoricalAnchors2000(),
    latentProcesses: structuredClone(latentProcesses),
    energyNodes: territorialWithOperations.energyNodes,
    energyContracts: {},
    baselineEnergyFlows: structuredClone(baselineEnergyFlows),
    countryEnergy: {
      FRA: { countryId: 'FRA', annualDemand: { oil: 92, gas: 46 }, domesticProduction: { oil: 2, gas: 3 }, legacyImports: { oil: 90, gas: 43 }, strategicStocks: { oil: 24, gas: 3 }, storageCapacity: { oil: 34, gas: 12 }, desiredCoverageMonths: { oil: 3, gas: 1.5 } },
      DEU: { countryId: 'DEU', annualDemand: { oil: 128, gas: 78 }, domesticProduction: { oil: 4, gas: 18 }, legacyImports: { oil: 124, gas: 60 }, strategicStocks: { oil: 29, gas: 9 }, storageCapacity: { oil: 41, gas: 24 }, desiredCoverageMonths: { oil: 3, gas: 2 } },
      ITA: { countryId: 'ITA', annualDemand: { oil: 96, gas: 60 }, domesticProduction: { oil: 5, gas: 15 }, legacyImports: { oil: 91, gas: 45 }, strategicStocks: { oil: 18, gas: 5 }, storageCapacity: { oil: 30, gas: 18 }, desiredCoverageMonths: { oil: 2.5, gas: 1.5 } },
      ESP: { countryId: 'ESP', annualDemand: { oil: 70, gas: 25 }, domesticProduction: { oil: 2, gas: 8 }, legacyImports: { oil: 68, gas: 17 }, strategicStocks: { oil: 16, gas: 3 }, storageCapacity: { oil: 25, gas: 7 }, desiredCoverageMonths: { oil: 2.5, gas: 1.5 } },
      POL: { countryId: 'POL', annualDemand: { oil: 24, gas: 14 }, domesticProduction: { oil: 1, gas: 5 }, legacyImports: { oil: 23, gas: 9 }, strategicStocks: { oil: 4, gas: 1 }, storageCapacity: { oil: 8, gas: 4 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
      GBR: { countryId: 'GBR', annualDemand: { oil: 82, gas: 88 }, domesticProduction: { oil: 128, gas: 96 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 11, gas: 2 }, storageCapacity: { oil: 20, gas: 8 }, desiredCoverageMonths: { oil: 1.5, gas: 0.8 } },
      USA: { countryId: 'USA', annualDemand: { oil: 820, gas: 650 }, domesticProduction: { oil: 370, gas: 520 }, legacyImports: { oil: 450, gas: 130 }, strategicStocks: { oil: 92, gas: 25 }, storageCapacity: { oil: 125, gas: 70 }, desiredCoverageMonths: { oil: 3, gas: 1.5 } },
      RUS: { countryId: 'RUS', annualDemand: { oil: 125, gas: 330 }, domesticProduction: { oil: 325, gas: 520 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 28, gas: 60 }, storageCapacity: { oil: 45, gas: 95 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
      CHN: { countryId: 'CHN', annualDemand: { oil: 210, gas: 28 }, domesticProduction: { oil: 160, gas: 24 }, legacyImports: { oil: 50, gas: 4 }, strategicStocks: { oil: 10, gas: 1 }, storageCapacity: { oil: 28, gas: 5 }, desiredCoverageMonths: { oil: 1, gas: 0.5 } },
      NOR: { countryId: 'NOR', annualDemand: { oil: 10, gas: 5 }, domesticProduction: { oil: 150, gas: 62 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 11, gas: 5 }, storageCapacity: { oil: 18, gas: 10 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
      DZA: { countryId: 'DZA', annualDemand: { oil: 18, gas: 24 }, domesticProduction: { oil: 70, gas: 88 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 8, gas: 9 }, storageCapacity: { oil: 14, gas: 18 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
      LBY: { countryId: 'LBY', annualDemand: { oil: 12, gas: 6 }, domesticProduction: { oil: 70, gas: 12 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 10, gas: 2 }, storageCapacity: { oil: 20, gas: 5 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
      SAU: { countryId: 'SAU', annualDemand: { oil: 65, gas: 55 }, domesticProduction: { oil: 430, gas: 58 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 42, gas: 4 }, storageCapacity: { oil: 70, gas: 12 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
      BRA: { countryId: 'BRA', annualDemand: { oil: 100, gas: 10 }, domesticProduction: { oil: 68, gas: 7 }, legacyImports: { oil: 32, gas: 3 }, strategicStocks: { oil: 11, gas: 1 }, storageCapacity: { oil: 20, gas: 4 }, desiredCoverageMonths: { oil: 1.5, gas: 0.8 } },
      ZAF: { countryId: 'ZAF', annualDemand: { oil: 22, gas: 2 }, domesticProduction: { oil: 1, gas: 2 }, legacyImports: { oil: 21, gas: 0 }, strategicStocks: { oil: 3, gas: 0.3 }, storageCapacity: { oil: 7, gas: 1 }, desiredCoverageMonths: { oil: 1.5, gas: 0.5 } },
      AUS: { countryId: 'AUS', annualDemand: { oil: 40, gas: 20 }, domesticProduction: { oil: 41, gas: 31 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 6, gas: 2 }, storageCapacity: { oil: 10, gas: 5 }, desiredCoverageMonths: { oil: 1.5, gas: 1 } },
      IND: { countryId: 'IND', annualDemand: { oil: 110, gas: 27 }, domesticProduction: { oil: 35, gas: 27 }, legacyImports: { oil: 75, gas: 0 }, strategicStocks: { oil: 7, gas: 1 }, storageCapacity: { oil: 16, gas: 4 }, desiredCoverageMonths: { oil: 0.8, gas: 0.5 } },
      JPN: { countryId: 'JPN', annualDemand: { oil: 260, gas: 80 }, domesticProduction: { oil: 1, gas: 2 }, legacyImports: { oil: 259, gas: 78 }, strategicStocks: { oil: 72, gas: 7 }, storageCapacity: { oil: 90, gas: 14 }, desiredCoverageMonths: { oil: 3, gas: 1 } },
      TUR: { countryId: 'TUR', annualDemand: { oil: 33, gas: 14 }, domesticProduction: { oil: 3, gas: 1 }, legacyImports: { oil: 30, gas: 13 }, strategicStocks: { oil: 3, gas: 1 }, storageCapacity: { oil: 6, gas: 3 }, desiredCoverageMonths: { oil: 1, gas: 0.8 } },
      VNM: { countryId: 'VNM', annualDemand: { oil: 8, gas: 6 }, domesticProduction: { oil: 17, gas: 6 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 1, gas: 0.4 }, storageCapacity: { oil: 3, gas: 1 }, desiredCoverageMonths: { oil: 1, gas: 0.5 } },
      ...Object.fromEntries(Object.values(allCountries).filter((country) => !['FRA', 'DEU', 'ITA', 'POL', 'GBR', 'USA', 'RUS', 'CHN', 'NOR', 'DZA', 'LBY', 'SAU', 'BRA', 'ZAF', 'AUS', 'IND', 'JPN', 'TUR', 'VNM'].includes(country.id)).map((country) => [country.id, defaultCountryEnergy2000(country)])),
    },
    macroEconomies,
    worldEconomy: structuredClone(worldEconomy2000),
    tradeFlows: createTradeFlows2000(),
    decisionProfiles: createDecisionProfiles2000(allCountries),
    leadership: createLeadership2000(allCountries),
    politicalCycles: createPoliticalCycles2000(allCountries),
    politicalApparatus: createPoliticalApparatus2000(allCountries),
    structuralProfiles,
    stakeholderGroups: createStakeholderGroups2000(allCountries, structuralProfiles),
    stakeholderReactions: {},
    nationalReforms: createNationalReforms2000(allCountries),
    powerActors: {},
    powerStruggleCampaigns: {},
    aiJobs: {},
    actionPrograms: {},
    militaryTheaters: createMilitaryTheaters2000(),
    militaryBases: createMilitaryBases2000(),
    warZones: {},
    diplomaticSessions: {},
    diplomaticDialogues: {},
    diplomaticBriefs: {},
    diplomaticMeetings: {},
    diplomaticAgreementDrafts: {},
    sectors: createStrategicSectors2000(allCountries, structuralProfiles, macroEconomies, sectors),
    armamentProducts: structuredClone(armamentProducts),
    strategicDossiers: dossiers,
    actions: [], ledger: [], processedStopIds: [],
  };
}

/** Alias conservé pour les anciennes sauvegardes, tests et intégrations. */
export function createFrance2000World(): WorldState {
  return createWorld2000('FRA');
}
