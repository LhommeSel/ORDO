import type {
  CountryId,
  StructuralDiagnosis,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

const monetaryLabels = {
  sovereign_floating: 'Monnaie souveraine à change flottant',
  sovereign_managed: 'Monnaie souveraine administrée',
  currency_union: 'Politique monétaire mutualisée',
  pegged: 'Monnaie arrimée à une devise étrangère',
} as const;

const workforceLabels = {
  strong_growth: 'Main-d’œuvre en forte expansion',
  growth: 'Main-d’œuvre en expansion',
  stable: 'Main-d’œuvre globalement stable',
  decline: 'Contraction progressive de la main-d’œuvre',
  strong_decline: 'Contraction rapide de la main-d’œuvre',
} as const;

export function energyImportDependency(state: WorldState, countryId: CountryId) {
  const energy = state.countryEnergy[countryId];
  if (!energy) return 0;
  const demand = energy.annualDemand.oil + energy.annualDemand.gas;
  if (demand <= 0) return 0;
  const requiredImports =
    Math.max(0, energy.annualDemand.oil - energy.domesticProduction.oil)
    + Math.max(0, energy.annualDemand.gas - energy.domesticProduction.gas);
  return clamp(requiredImports / demand * 100);
}

export function deriveStructuralDiagnostics(
  state: WorldState,
  countryId: CountryId,
  observerId: CountryId = state.playerCountryId,
): StructuralDiagnosis[] {
  const profile = state.structuralProfiles[countryId];
  const country = state.countries[countryId];
  const economy = state.macroEconomies[countryId];
  if (!profile || !country || !economy) return [];

  const intelligence = observerId === countryId ? 100 : state.intelligence[`${observerId}:${countryId}`] ?? 0;
  const visibleConfidence = Math.round(Math.min(
    profile.source.confidence,
    observerId === countryId ? 100 : 55 + country.statisticalReliability * 0.35 + intelligence * 0.1,
  ));
  const diagnoses: StructuralDiagnosis[] = [];
  const add = (diagnosis: Omit<StructuralDiagnosis, 'countryId' | 'confidence'>) => diagnoses.push({
    ...diagnosis,
    countryId,
    confidence: visibleConfidence,
  });

  if (profile.industrialDepth >= 68) add({
    id: 'industrial-depth', category: 'strength', title: 'Base industrielle profonde',
    summary: 'Le pays dispose de compétences, de fournisseurs et d’outils productifs capables de soutenir des programmes complexes.',
    severity: profile.industrialDepth, direction: country.metrics.industry >= 95 ? 'stable' : 'worsening', horizonYears: [3, 15], reversibility: 'medium',
    causes: [`Profondeur industrielle estimée à ${profile.industrialDepth}/100`, `Industrie : ${economy.industrySharePctGdp.toFixed(1)} % du PIB`],
    possibleConsequences: ['Montée en cadence plus rapide dans les filières existantes', 'Meilleure résistance aux ruptures d’approvisionnement ciblées'],
    availableLevers: ['Entretenir les compétences critiques', 'Financer la modernisation des capacités', 'Sécuriser les sous-traitants stratégiques'],
  });

  if (profile.economicDiversification >= 75) add({
    id: 'diversification', category: 'strength', title: 'Économie diversifiée',
    summary: 'Aucun secteur unique ne détermine à lui seul la trajectoire de l’économie nationale.',
    severity: profile.economicDiversification, direction: 'stable', horizonYears: [2, 12], reversibility: 'low',
    causes: [`Diversification estimée à ${profile.economicDiversification}/100`],
    possibleConsequences: ['Amortissement des chocs sectoriels', 'Plusieurs sources possibles de croissance et de recettes publiques'],
    availableLevers: ['Préserver la concurrence entre filières', 'Éviter une concentration excessive des investissements'],
  });

  if (profile.innovationCapacity >= 75) add({
    id: 'innovation-capacity', category: 'strength', title: 'Capacité d’innovation élevée',
    summary: 'La recherche, les compétences et les entreprises permettent de transformer plus facilement une dépense en gain de productivité.',
    severity: profile.innovationCapacity, direction: 'stable', horizonYears: [4, 20], reversibility: 'medium',
    causes: [`Capacité d’innovation estimée à ${profile.innovationCapacity}/100`],
    possibleConsequences: ['Diffusion technologique plus rapide', 'Meilleure chance de faire émerger des filières exportatrices'],
    availableLevers: ['Recherche publique', 'Formation supérieure', 'Commandes de lancement', 'Coopérations technologiques'],
  });

  if (profile.infrastructureQuality >= 78) add({
    id: 'infrastructure-quality', category: 'strength', title: 'Infrastructures robustes',
    summary: 'Les réseaux de transport, d’énergie et de communication réduisent les frictions de l’activité économique.',
    severity: profile.infrastructureQuality, direction: 'stable', horizonYears: [5, 25], reversibility: 'medium',
    causes: [`Qualité des infrastructures estimée à ${profile.infrastructureQuality}/100`],
    possibleConsequences: ['Coûts logistiques contenus', 'Déploiement plus rapide des nouveaux projets'],
    availableLevers: ['Maintenance préventive', 'Modernisation des réseaux', 'Résilience des points critiques'],
  });

  if (profile.socialStabilizers >= 78) add({
    id: 'social-stabilizers', category: 'strength', title: 'Forts stabilisateurs sociaux',
    summary: 'Les transferts et services publics amortissent automatiquement une baisse de revenu ou une hausse du chômage.',
    severity: profile.socialStabilizers, direction: 'stable', horizonYears: [0, 5], reversibility: 'medium',
    causes: [`Puissance des stabilisateurs estimée à ${profile.socialStabilizers}/100`],
    possibleConsequences: ['Consommation moins volatile pendant une récession', 'Hausse automatique des dépenses publiques en période de crise'],
    availableLevers: ['Cibler les dispositifs d’urgence', 'Préserver leur financement', 'Réformer leur efficacité administrative'],
  });

  const dependency = energyImportDependency(state, countryId);
  if (dependency >= 45) add({
    id: 'energy-import-dependency', category: 'vulnerability', title: 'Dépendance énergétique extérieure',
    summary: 'Une part importante du pétrole et du gaz consommés doit être obtenue à l’étranger.',
    severity: Math.round(dependency), direction: 'stable', horizonYears: [0, 8], reversibility: 'medium',
    causes: [`Dépendance physique calculée à ${dependency.toFixed(0)} % de la demande pétrolière et gazière`],
    possibleConsequences: ['Inflation importée lors d’une pénurie', 'Pression diplomatique des fournisseurs', 'Ralentissement industriel en cas de rupture'],
    availableLevers: ['Diversifier les fournisseurs', 'Constituer des réserves', 'Réduire la demande', 'Développer une production ou une énergie de substitution'],
  });

  const energy = state.countryEnergy[countryId];
  if (energy && energy.domesticProduction.oil + energy.domesticProduction.gas > (energy.annualDemand.oil + energy.annualDemand.gas) * 1.25) add({
    id: 'energy-export-capacity', category: 'strength', title: 'Capacité exportatrice d’hydrocarbures',
    summary: 'La production nationale dépasse nettement les besoins internes et peut soutenir des contrats extérieurs.',
    severity: clamp(profile.resourceRentDependency), direction: 'stable', horizonYears: [0, 15], reversibility: 'low',
    causes: ['Production physique supérieure à la consommation intérieure', `Capacité disponible dans le registre énergétique`],
    possibleConsequences: ['Recettes extérieures en période de prix élevés', 'Levier diplomatique auprès des importateurs'],
    availableLevers: ['Développer les capacités existantes', 'Sécuriser les routes d’exportation', 'Négocier des contrats de long terme'],
  });

  if (profile.resourceRentDependency >= 60) add({
    id: 'resource-rent', category: 'vulnerability', title: 'Dépendance aux rentes de ressources',
    summary: 'Les recettes extérieures et publiques restent fortement liées à un petit nombre de matières premières.',
    severity: profile.resourceRentDependency, direction: profile.economicDiversification < 45 ? 'worsening' : 'stable', horizonYears: [1, 15], reversibility: 'low',
    causes: [`Dépendance aux rentes estimée à ${profile.resourceRentDependency}/100`, `Diversification : ${profile.economicDiversification}/100`],
    possibleConsequences: ['Budget vulnérable à une baisse des cours', 'Appréciation de la monnaie pénalisant les autres exportations', 'Retard de diversification'],
    availableLevers: ['Fonds de stabilisation', 'Investissement hors hydrocarbures', 'Développement de recettes fiscales non rentières'],
  });

  if (profile.exportConcentration >= 70) add({
    id: 'export-concentration', category: 'vulnerability', title: 'Exportations concentrées',
    summary: 'Une rupture sur quelques produits ou marchés peut affecter une part disproportionnée des recettes extérieures.',
    severity: profile.exportConcentration, direction: 'stable', horizonYears: [1, 10], reversibility: 'medium',
    causes: [`Concentration estimée à ${profile.exportConcentration}/100`, `Exportations : ${economy.exportSharePctGdp.toFixed(1)} % du PIB`],
    possibleConsequences: ['Forte volatilité des recettes', 'Dépendance accrue envers quelques partenaires'],
    availableLevers: ['Diversifier les destinations', 'Soutenir de nouvelles filières exportatrices', 'Créer des réserves financières'],
  });

  if (economy.exportSharePctGdp >= 35) add({
    id: 'foreign-demand-exposure', category: 'vulnerability', title: 'Exposition à la demande étrangère',
    summary: 'Une récession chez les principaux partenaires se transmet rapidement aux commandes nationales.',
    severity: clamp(45 + (economy.exportSharePctGdp - 35) * 1.5), direction: state.worldEconomy.globalGrowthAnnualPct < 2 ? 'worsening' : 'stable', horizonYears: [0, 4], reversibility: 'medium',
    causes: [`Exportations : ${economy.exportSharePctGdp.toFixed(1)} % du PIB`],
    possibleConsequences: ['Production et investissement plus cycliques', 'Contagion rapide des crises commerciales'],
    availableLevers: ['Diversifier les partenaires', 'Soutenir la demande intérieure', 'Sécuriser des contrats de long terme'],
  });

  if (profile.financialResilience <= 45) add({
    id: 'financial-fragility', category: 'vulnerability', title: 'Fragilité financière',
    summary: 'Le système financier dispose de marges limitées pour absorber une fuite de capitaux, des défauts ou une crise bancaire.',
    severity: 100 - profile.financialResilience, direction: economy.inflationAnnualPct > 10 ? 'worsening' : 'stable', horizonYears: [0, 6], reversibility: 'medium',
    causes: [`Résilience financière estimée à ${profile.financialResilience}/100`],
    possibleConsequences: ['Contraction brutale du crédit', 'Dépréciation monétaire', 'Besoin de garanties publiques'],
    availableLevers: ['Renforcer les réserves', 'Durcir la supervision', 'Recapitaliser les établissements fragiles'],
  });

  if (economy.unemploymentPct >= 12) add({
    id: 'structural-unemployment', category: 'vulnerability', title: 'Chômage durablement élevé',
    summary: 'Une part importante de la population active reste hors de l’emploi, même sans récession ouverte.',
    severity: clamp(40 + economy.unemploymentPct * 1.5), direction: economy.realGrowthAnnualPct < economy.potentialGrowthAnnualPct ? 'worsening' : 'improving', horizonYears: [2, 12], reversibility: 'medium',
    causes: [`Chômage observé ou estimé à ${economy.unemploymentPct.toFixed(1)} %`],
    possibleConsequences: ['Recettes fiscales réduites', 'Dépenses sociales plus élevées', 'Tensions politiques et perte de compétences'],
    availableLevers: ['Formation', 'Investissement productif', 'Réforme des règles d’emploi', 'Politiques territoriales'],
  });

  if (profile.economicDiversification <= 45) add({
    id: 'weak-diversification', category: 'vulnerability', title: 'Économie peu diversifiée',
    summary: 'La création de richesse repose sur un nombre restreint de secteurs et offre peu de relais en cas de choc.',
    severity: 100 - profile.economicDiversification, direction: profile.productivityCatchUp >= 70 ? 'improving' : 'stable', horizonYears: [5, 20], reversibility: 'low',
    causes: [`Diversification estimée à ${profile.economicDiversification}/100`],
    possibleConsequences: ['Dépendance aux importations industrielles', 'Difficulté à absorber un choc sectoriel'],
    availableLevers: ['Former une main-d’œuvre qualifiée', 'Développer des infrastructures communes', 'Soutenir plusieurs filières complémentaires'],
  });

  if (profile.demographicPressure >= 55 || ['decline', 'strong_decline'].includes(profile.workforceTrend)) add({
    id: 'demographic-pressure', category: 'vulnerability', title: 'Pression démographique sur la main-d’œuvre',
    summary: 'Le vieillissement et la contraction des générations actives risquent de limiter la production potentielle.',
    severity: Math.max(profile.demographicPressure, profile.workforceTrend === 'strong_decline' ? 85 : 60), direction: 'worsening', horizonYears: [5, 30], reversibility: 'low',
    causes: [workforceLabels[profile.workforceTrend], `Pression démographique estimée à ${profile.demographicPressure}/100`],
    possibleConsequences: ['Pénuries de compétences', 'Croissance potentielle plus faible', 'Dépenses de retraite et de santé accrues'],
    availableLevers: ['Immigration de travail', 'Hausse de la participation', 'Automatisation', 'Politique familiale de long terme'],
  });

  if (profile.productivityCatchUp >= 65) add({
    id: 'productivity-catch-up', category: 'trend', title: 'Potentiel de rattrapage productif',
    summary: 'L’écart technologique permet une croissance rapide si le pays investit et absorbe les savoir-faire étrangers.',
    severity: profile.productivityCatchUp, direction: profile.innovationCapacity >= 45 ? 'improving' : 'stable', horizonYears: [5, 25], reversibility: 'medium',
    causes: [`Potentiel de rattrapage estimé à ${profile.productivityCatchUp}/100`, `Investissement : ${economy.investmentSharePctGdp.toFixed(1)} % du PIB`],
    possibleConsequences: ['Gains de productivité supérieurs aux économies déjà avancées', 'Convergence graduelle puis ralentissement naturel'],
    availableLevers: ['Importer des technologies', 'Former les travailleurs', 'Attirer des investissements', 'Construire des infrastructures'],
  });

  if (profile.workforceTrend !== 'stable' && !['decline', 'strong_decline'].includes(profile.workforceTrend)) add({
    id: 'workforce-momentum', category: 'trend', title: workforceLabels[profile.workforceTrend],
    summary: 'L’arrivée de nouveaux actifs peut soutenir la croissance, à condition que l’économie crée suffisamment d’emplois et de capital.',
    severity: profile.workforceTrend === 'strong_growth' ? 85 : 65, direction: 'improving', horizonYears: [3, 20], reversibility: 'low',
    causes: [`Croissance démographique actuelle : ${economy.populationGrowthAnnualPct.toFixed(2)} % par an`],
    possibleConsequences: ['Hausse de la production potentielle', 'Risque de chômage ou de tension sociale si l’emploi ne suit pas'],
    availableLevers: ['Éducation', 'Création d’emplois', 'Logement et infrastructures urbaines'],
  });

  if (profile.monetaryRegime === 'currency_union' || profile.monetaryRegime === 'pegged') add({
    id: 'monetary-regime', category: 'trend', title: monetaryLabels[profile.monetaryRegime],
    summary: profile.monetaryRegime === 'currency_union'
      ? 'La stabilité et la profondeur du marché monétaire sont partagées, mais le pays ne règle pas seul ses taux ni son taux de change.'
      : 'L’ancrage stabilise le change mais oblige la politique monétaire à défendre la parité.',
    severity: 55, direction: 'stable', horizonYears: [0, 10], reversibility: 'low',
    causes: [monetaryLabels[profile.monetaryRegime]],
    possibleConsequences: ['Réponse monétaire nationale limitée', 'Moindre risque de change dans la zone concernée'],
    availableLevers: ['Coordination avec l’autorité monétaire', 'Politique budgétaire', 'Réformes de compétitivité'],
  });

  return diagnoses.sort((a, b) => b.severity - a.severity);
}

export function structuralDiagnosisGroups(state: WorldState, countryId: CountryId, observerId = state.playerCountryId) {
  const diagnoses = deriveStructuralDiagnostics(state, countryId, observerId);
  return {
    strengths: diagnoses.filter((item) => item.category === 'strength'),
    vulnerabilities: diagnoses.filter((item) => item.category === 'vulnerability'),
    trends: diagnoses.filter((item) => item.category === 'trend'),
  };
}
