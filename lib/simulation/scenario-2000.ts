import type {
  ArmamentProduct,
  CapacityState,
  CountryState,
  EnergyNode,
  HistoricalCurrent,
  LatentProcess,
  StrategicDossier,
  StrategicSectorState,
  WorldState,
} from './types';
import { createMacroEconomies2000, worldEconomy2000 } from './macro-data-2000';
import { createStructuralProfiles2000 } from './structural-data-2000';
import { createStakeholderGroups2000 } from './stakeholder-data-2000';
import { createTradeFlows2000 } from './trade-data-2000';
import { createDecisionProfiles2000 } from './decision-data-2000';
import { createLeadership2000, createPoliticalApparatus2000 } from './political-identity-data-2000';

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
};

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

export function createFrance2000World(): WorldState {
  const structuralProfiles = createStructuralProfiles2000();
  return {
    version: 1,
    scenarioId: 'france-2000-01',
    seed: 20000101,
    sequence: 0,
    currentDate: '2000-01-01',
    playerCountryId: 'FRA',
    countries: structuredClone(countries),
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
    latentProcesses: structuredClone(latentProcesses),
    energyNodes: structuredClone(energyNodes),
    energyContracts: {},
    countryEnergy: {
      FRA: { countryId: 'FRA', annualDemand: { oil: 92, gas: 46 }, domesticProduction: { oil: 2, gas: 3 }, legacyImports: { oil: 90, gas: 43 }, strategicStocks: { oil: 24, gas: 3 }, storageCapacity: { oil: 34, gas: 12 }, desiredCoverageMonths: { oil: 3, gas: 1.5 } },
      DEU: { countryId: 'DEU', annualDemand: { oil: 128, gas: 78 }, domesticProduction: { oil: 4, gas: 18 }, legacyImports: { oil: 124, gas: 60 }, strategicStocks: { oil: 29, gas: 9 }, storageCapacity: { oil: 41, gas: 24 }, desiredCoverageMonths: { oil: 3, gas: 2 } },
      ITA: { countryId: 'ITA', annualDemand: { oil: 96, gas: 60 }, domesticProduction: { oil: 5, gas: 15 }, legacyImports: { oil: 91, gas: 45 }, strategicStocks: { oil: 18, gas: 5 }, storageCapacity: { oil: 30, gas: 18 }, desiredCoverageMonths: { oil: 2.5, gas: 1.5 } },
      POL: { countryId: 'POL', annualDemand: { oil: 24, gas: 14 }, domesticProduction: { oil: 1, gas: 5 }, legacyImports: { oil: 23, gas: 9 }, strategicStocks: { oil: 4, gas: 1 }, storageCapacity: { oil: 8, gas: 4 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
      GBR: { countryId: 'GBR', annualDemand: { oil: 82, gas: 88 }, domesticProduction: { oil: 128, gas: 96 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 11, gas: 2 }, storageCapacity: { oil: 20, gas: 8 }, desiredCoverageMonths: { oil: 1.5, gas: 0.8 } },
      USA: { countryId: 'USA', annualDemand: { oil: 820, gas: 650 }, domesticProduction: { oil: 370, gas: 520 }, legacyImports: { oil: 450, gas: 130 }, strategicStocks: { oil: 92, gas: 25 }, storageCapacity: { oil: 125, gas: 70 }, desiredCoverageMonths: { oil: 3, gas: 1.5 } },
      RUS: { countryId: 'RUS', annualDemand: { oil: 125, gas: 330 }, domesticProduction: { oil: 325, gas: 520 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 28, gas: 60 }, storageCapacity: { oil: 45, gas: 95 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
      CHN: { countryId: 'CHN', annualDemand: { oil: 210, gas: 28 }, domesticProduction: { oil: 160, gas: 24 }, legacyImports: { oil: 50, gas: 4 }, strategicStocks: { oil: 10, gas: 1 }, storageCapacity: { oil: 28, gas: 5 }, desiredCoverageMonths: { oil: 1, gas: 0.5 } },
      NOR: { countryId: 'NOR', annualDemand: { oil: 10, gas: 5 }, domesticProduction: { oil: 150, gas: 62 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 11, gas: 5 }, storageCapacity: { oil: 18, gas: 10 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
      DZA: { countryId: 'DZA', annualDemand: { oil: 18, gas: 24 }, domesticProduction: { oil: 70, gas: 88 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 8, gas: 9 }, storageCapacity: { oil: 14, gas: 18 }, desiredCoverageMonths: { oil: 2, gas: 2 } },
      LBY: { countryId: 'LBY', annualDemand: { oil: 12, gas: 6 }, domesticProduction: { oil: 70, gas: 12 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 10, gas: 2 }, storageCapacity: { oil: 20, gas: 5 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
      SAU: { countryId: 'SAU', annualDemand: { oil: 65, gas: 55 }, domesticProduction: { oil: 430, gas: 58 }, legacyImports: { oil: 0, gas: 0 }, strategicStocks: { oil: 42, gas: 4 }, storageCapacity: { oil: 70, gas: 12 }, desiredCoverageMonths: { oil: 2, gas: 1 } },
    },
    macroEconomies: createMacroEconomies2000(),
    worldEconomy: structuredClone(worldEconomy2000),
    tradeFlows: createTradeFlows2000(),
    decisionProfiles: createDecisionProfiles2000(countries),
    leadership: createLeadership2000(countries),
    politicalApparatus: createPoliticalApparatus2000(countries),
    structuralProfiles,
    stakeholderGroups: createStakeholderGroups2000(countries, structuralProfiles),
    stakeholderReactions: {},
    powerActors: {},
    powerStruggleCampaigns: {},
    aiJobs: {},
    diplomaticSessions: {},
    sectors: structuredClone(sectors),
    armamentProducts: structuredClone(armamentProducts),
    strategicDossiers: structuredClone(strategicDossiers),
    actions: [], ledger: [], processedStopIds: [],
  };
}
