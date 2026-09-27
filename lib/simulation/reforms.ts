import type {
  CountryId,
  CountryState,
  ISODate,
  NationalPolicyIndicatorId,
  NationalReformDomain,
  NationalReformOutcome,
  NationalReformOutcomeSummary,
  NationalReformSnapshot,
  NationalReformState,
  PolicySignal,
  WorldEffect,
  WorldState,
  StructuredReformIntent,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(2));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

type PolicyIndicator = { id: NationalPolicyIndicatorId; label: string };

export type NationalReformOption = {
  id: string;
  domain: NationalReformDomain;
  title: string;
  summary: string;
  targetPosition: number;
  durationMonths: number;
  budgetCost: number;
  /** Effet annuel net après adoption : + dépense, − économie. */
  annualFiscalImpact: number;
  indicatorDeltas: Partial<Record<NationalPolicyIndicatorId, number>>;
  intensity: 'modérée' | 'forte';
};

type ReformRoute = Omit<NationalReformOption, 'id' | 'domain'> & { keywords: RegExp };

export type NationalReformProfile = {
  domain: NationalReformDomain;
  label: string;
  subtitle: string;
  positionLabels: [string, string, string];
  indicators: PolicyIndicator[];
  low: ReformRoute;
  high: ReformRoute;
};

const route = (
  title: string,
  summary: string,
  targetPosition: number,
  durationMonths: number,
  budgetCost: number,
  annualFiscalImpact: number,
  indicatorDeltas: NationalReformOption['indicatorDeltas'],
  keywords: RegExp,
  intensity: NationalReformOption['intensity'] = 'forte',
): ReformRoute => ({ title, summary, targetPosition, durationMonths, budgetCost, annualFiscalImpact, indicatorDeltas, keywords, intensity });

/** Une définition commune : toute loi nationale modifie un domaine suivi,
 * des indicateurs lisibles et une incidence annuelle explicitée. */
export const nationalReformProfiles: Record<NationalReformDomain, NationalReformProfile> = {
  retirement: {
    domain: 'retirement', label: 'Retraites et vieillissement', subtitle: 'Niveau de protection, soutenabilité et place de la capitalisation.',
    positionLabels: ['Répartition renforcée', 'Modèle mixte', 'Financement diversifié'],
    indicators: [{ id: 'coverage', label: 'Niveau de protection' }, { id: 'sustainability', label: 'Soutenabilité' }, { id: 'marketRole', label: 'Part capitalisée' }],
    low: route('Consolider la répartition et les minima', 'Renforcer les garanties de pension et ajuster progressivement les paramètres du régime public.', 34, 14, 5.2, 1.8, { coverage: 8, equity: 4, sustainability: 2 }, /repartition|minimum vieillesse|pension minimum|garantie.*pension|age legal/),
    high: route('Diversifier le financement des retraites', 'Introduire progressivement une part capitalisée, avec des garanties de transition et un suivi public.', 68, 18, 7.5, 2.6, { sustainability: 8, marketRole: 14, coverage: -1 }, /capitalisation|fonds de pension|epargne retraite|financement diversifie/),
  },
  labor: {
    domain: 'labor', label: 'Travail et emploi', subtitle: 'Contrat de travail, négociation, mobilité et accès à l’emploi.',
    positionLabels: ['Protection réglementaire forte', 'Compromis social', 'Flexisécurité et négociation'],
    indicators: [{ id: 'access', label: 'Accès à l’emploi' }, { id: 'equity', label: 'Protection des salariés' }, { id: 'productivity', label: 'Productivité' }],
    low: route('Renforcer les protections du travail', 'Étendre les garanties des salariés, l’inspection et la négociation collective.', 34, 13, 4.8, 1.3, { equity: 8, access: 3, productivity: -1 }, /protection.*salar|droit du travail|syndic|inspection du travail|contrat stable/),
    high: route('Mettre en place une flexisécurité négociée', 'Assouplir les transitions d’emploi en finançant formation, assurance et négociation.', 68, 15, 5.6, 0.9, { access: 7, productivity: 6, equity: -2 }, /flexisecur|assoupl|mobilite|flexib|embauche/),
  },
  taxation: {
    domain: 'taxation', label: 'Fiscalité et prélèvements', subtitle: 'Assiette, progressivité, incitations et rendement durable.',
    positionLabels: ['Redistribution renforcée', 'Équilibre des prélèvements', 'Assiette large et taux modérés'],
    indicators: [{ id: 'sustainability', label: 'Rendement durable' }, { id: 'equity', label: 'Progressivité' }, { id: 'productivity', label: 'Incitation économique' }],
    low: route('Renforcer la progressivité fiscale', 'Accroître la contribution des revenus et patrimoines les plus élevés tout en préservant les services publics.', 34, 12, 3.8, -0.5, { equity: 9, sustainability: 4, productivity: -2 }, /progressiv|haut revenu|patrimoine|fortune|redistribut/),
    high: route('Élargir l’assiette et simplifier les taux', 'Réduire les niches, élargir les bases et abaisser certains taux pour améliorer la lisibilité.', 68, 12, 3.4, -1.2, { sustainability: 8, productivity: 5, equity: -3 }, /assiette|niche fiscale|simplif.*impot|baisser.*taux|allegement/),
  },
  social_protection: {
    domain: 'social_protection', label: 'Protection sociale', subtitle: 'Couverture des risques, ciblage des aides et insertion.',
    positionLabels: ['Couverture universelle', 'Socle commun ciblé', 'Protection contributive et activation'],
    indicators: [{ id: 'coverage', label: 'Couverture' }, { id: 'equity', label: 'Équité' }, { id: 'sustainability', label: 'Soutenabilité' }],
    low: route('Étendre le socle de protection sociale', 'Élargir les prestations et l’accès effectif aux droits pour les ménages fragiles.', 34, 14, 6.1, 2.7, { coverage: 9, equity: 8, sustainability: -2 }, /rsa|prestation|protection sociale|aide sociale|minimum social|couverture universelle/),
    high: route('Cibler les prestations et renforcer l’insertion', 'Concentrer les aides sur les situations prioritaires et renforcer l’accompagnement vers l’emploi.', 68, 13, 4.2, -0.9, { sustainability: 8, access: 4, coverage: -2 }, /cibl|insertion|activation|condition.*aide|controle.*prestation/),
  },
  health: {
    domain: 'health', label: 'Santé', subtitle: 'Accès aux soins, organisation du système et maîtrise des dépenses.',
    positionLabels: ['Système public intégré', 'Pilotage mixte', 'Autonomie organisée des acteurs'],
    indicators: [{ id: 'access', label: 'Accès aux soins' }, { id: 'coverage', label: 'Couverture' }, { id: 'sustainability', label: 'Maîtrise des dépenses' }],
    low: route('Renforcer le service public de santé', 'Consolider l’hôpital, la prévention et l’accès territorial aux soins.', 34, 16, 7.2, 3.1, { access: 9, coverage: 7, sustainability: -2 }, /hopital public|service public.*sante|prevention|desert medical|soins/),
    high: route('Réorganiser l’offre de soins', 'Donner davantage de responsabilités aux réseaux, territoires et assureurs sous régulation commune.', 68, 15, 5.4, 1.1, { sustainability: 7, access: 4, coverage: -1 }, /assurance sante|reseau de soins|autonomie.*hopital|reorganis.*soins/),
  },
  education: {
    domain: 'education', label: 'Éducation et formation', subtitle: 'Égalité d’accès, autonomie des établissements et compétences.',
    positionLabels: ['Service public national renforcé', 'Socle commun et autonomie', 'Autonomie et parcours diversifiés'],
    indicators: [{ id: 'access', label: 'Accès' }, { id: 'equity', label: 'Égalité scolaire' }, { id: 'productivity', label: 'Compétences' }],
    low: route('Renforcer le service public éducatif', 'Investir dans les équipes, le socle commun et la réduction des inégalités scolaires.', 34, 15, 6.4, 2.4, { access: 8, equity: 9, productivity: 3 }, /ecole publique|enseignant|education prioritaire|egalite scolaire|socle commun/),
    high: route('Accroître l’autonomie des établissements', 'Diversifier les parcours et donner aux établissements davantage de responsabilités évaluées.', 68, 14, 5.1, 1.2, { productivity: 7, access: 4, equity: -2 }, /autonomie.*etablissement|parcours|universite autonome|apprentissage/),
  },
  energy: {
    domain: 'energy', label: 'Énergie', subtitle: 'Sécurité d’approvisionnement, coût de transition et résilience.',
    positionLabels: ['Approvisionnement conventionnel', 'Mix diversifié', 'Transition bas carbone résiliente'],
    indicators: [{ id: 'resilience', label: 'Résilience' }, { id: 'sustainability', label: 'Coût durable' }, { id: 'environment', label: 'Impact climatique' }],
    low: route('Sécuriser l’approvisionnement conventionnel', 'Consolider les filières existantes et les stocks afin de réduire le risque de rupture à court terme.', 34, 13, 5.8, 1.3, { resilience: 6, sustainability: 3, environment: -6 }, /gaz|petrole|charbon|fossile|stock strategique|approvisionnement/),
    high: route('Accélérer la transition énergétique', 'Investir dans les réseaux, les économies d’énergie et les sources bas carbone.', 70, 22, 9.1, 3.2, { resilience: 8, environment: 11, sustainability: -1 }, /renouvelable|decarbon|transition energetique|efficacite energetique|climat/),
  },
  industry: {
    domain: 'industry', label: 'Industrie et innovation', subtitle: 'Capacité productive, souveraineté technologique et compétitivité.',
    positionLabels: ['Concurrence et spécialisation', 'Politique industrielle ciblée', 'Stratégie productive coordonnée'],
    indicators: [{ id: 'productivity', label: 'Productivité' }, { id: 'resilience', label: 'Autonomie productive' }, { id: 'stateCapacity', label: 'Pilotage public' }],
    low: route('Simplifier l’environnement productif', 'Réduire les obstacles réglementaires et concentrer l’État sur les infrastructures communes.', 34, 14, 4.2, -0.6, { productivity: 6, stateCapacity: 3, resilience: -1 }, /simplif.*industrie|concurrence|deregul.*industrie|allegement.*entreprise/),
    high: route('Déployer une stratégie industrielle ciblée', 'Soutenir des filières, des compétences et des investissements stratégiques identifiés.', 70, 20, 8.3, 2.8, { resilience: 9, productivity: 6, stateCapacity: 6 }, /politique industrielle|filiere strategique|reindustr|semi.conduct|souverainete industrielle/),
  },
  environment: {
    domain: 'environment', label: 'Environnement et territoire', subtitle: 'Climat, eau, agriculture, pollution et adaptation des territoires.',
    positionLabels: ['Normes limitées', 'Transition graduelle', 'Protection écologique structurante'],
    indicators: [{ id: 'environment', label: 'État environnemental' }, { id: 'resilience', label: 'Adaptation' }, { id: 'productivity', label: 'Transition productive' }],
    low: route('Alléger les contraintes environnementales', 'Prioriser la continuité productive et concentrer les obligations sur les risques les plus directs.', 32, 11, 3.6, -0.7, { productivity: 4, environment: -7, resilience: -2 }, /alleger.*norme|deregul.*environnement|moratoire.*ecolog|reduire.*contrainte/),
    high: route('Structurer la transition écologique', 'Renforcer les normes, l’adaptation des territoires et les investissements de dépollution.', 72, 20, 7.8, 2.5, { environment: 11, resilience: 8, productivity: 2 }, /environnement|pollution|eau|biodivers|agricult|adaptation|ecolog/),
  },
  housing: {
    domain: 'housing', label: 'Logement et aménagement', subtitle: 'Accès au logement, construction, règles foncières et cohésion territoriale.',
    positionLabels: ['Marché et foncier assouplis', 'Mix de régulation', 'Logement abordable soutenu'],
    indicators: [{ id: 'access', label: 'Accès au logement' }, { id: 'equity', label: 'Abordabilité' }, { id: 'stateCapacity', label: 'Capacité de construction' }],
    low: route('Libérer le foncier et simplifier la construction', 'Réduire les délais et contraintes pour augmenter l’offre privée de logements.', 34, 13, 4.7, 0.6, { access: 6, stateCapacity: 4, equity: -2 }, /foncier|permis de construire|liber.*construction|immobilier/),
    high: route('Renforcer le logement abordable', 'Financer l’offre sociale et la rénovation dans les zones où la tension est la plus forte.', 68, 18, 7.3, 2.6, { access: 8, equity: 9, stateCapacity: 5 }, /logement social|loyer|sans.abri|habitat abordable|renovation urbaine/),
  },
  administration: {
    domain: 'administration', label: 'Administration et services publics', subtitle: 'Procédures, effectifs, numérisation et présence territoriale.',
    positionLabels: ['Normes et contrôles centralisés', 'Modernisation pilotée', 'Services agiles et territorialisés'],
    indicators: [{ id: 'stateCapacity', label: 'Capacité administrative' }, { id: 'access', label: 'Accès aux services' }, { id: 'productivity', label: 'Efficacité' }],
    low: route('Simplifier et standardiser les procédures', 'Réduire les délais et harmoniser les règles pour améliorer l’exécution quotidienne.', 36, 12, 4.3, -0.5, { stateCapacity: 7, productivity: 7, access: 2 }, /simplif.*administr|procedure|fonctionnaire|bureaucrat|guichet unique/),
    high: route('Territorialiser et numériser les services', 'Investir dans les systèmes d’information, les compétences et la présence de proximité.', 68, 18, 7.1, 1.8, { stateCapacity: 9, access: 7, productivity: 5 }, /numeri|decentralis.*service|service public.*territoire|modernis.*administr/),
  },
  institutions: {
    domain: 'institutions', label: 'Institutions et démocratie', subtitle: 'Équilibre des pouvoirs, règles électorales et décision publique.',
    positionLabels: ['Exécutif concentré', 'Équilibre institutionnel', 'Contre-pouvoirs et décentralisation'],
    indicators: [{ id: 'rights', label: 'Garanties démocratiques' }, { id: 'stateCapacity', label: 'Capacité de décision' }, { id: 'equity', label: 'Représentation' }],
    low: route('Rationaliser la décision exécutive', 'Clarifier les compétences et raccourcir les procédures de décision publique.', 34, 12, 4.5, 0.2, { stateCapacity: 7, rights: -2, equity: -1 }, /executif|rationalis.*parlement|decret|simplif.*loi|gouvernance/),
    high: route('Renforcer les contre-pouvoirs', 'Étendre les garanties de contrôle, la transparence et la représentation territoriale.', 70, 15, 5.3, 0.8, { rights: 9, equity: 6, stateCapacity: -1 }, /constitution|election|parlement|contre.pouvoir|democrati|decentralis/),
  },
  justice: {
    domain: 'justice', label: 'Justice et droits', subtitle: 'Accès au droit, délai de jugement, garanties et politique pénale.',
    positionLabels: ['Politique pénale ferme', 'Équilibre des garanties', 'Accès au droit renforcé'],
    indicators: [{ id: 'security', label: 'Protection contre la délinquance' }, { id: 'rights', label: 'Garanties' }, { id: 'access', label: 'Accès à la justice' }],
    low: route('Renforcer la réponse pénale', 'Augmenter les moyens d’enquête, d’exécution des peines et de protection des victimes.', 34, 14, 6.2, 1.9, { security: 8, rights: -3, access: 1 }, /penal|prison|peine|delinquance|victime|police judiciaire/),
    high: route('Améliorer l’accès au droit', 'Réduire les délais, renforcer l’aide juridictionnelle et les garanties procédurales.', 70, 16, 6.5, 2.1, { rights: 9, access: 9, security: 2 }, /aide juridictionnelle|acces au droit|tribunal|delai.*justice|garantie.*procedure/),
  },
  security: {
    domain: 'security', label: 'Sécurité intérieure', subtitle: 'Prévention, protection civile, renseignement intérieur et maintien de l’ordre.',
    positionLabels: ['Maintien de l’ordre réactif', 'Sécurité coordonnée', 'Prévention et résilience civile'],
    indicators: [{ id: 'security', label: 'Sécurité' }, { id: 'resilience', label: 'Résilience civile' }, { id: 'rights', label: 'Garanties' }],
    low: route('Renforcer le maintien de l’ordre', 'Accroître les moyens de réponse, de contrôle et de protection immédiate.', 34, 12, 6.4, 2.0, { security: 8, resilience: 2, rights: -2 }, /maintien de l ordre|controle|securite interieure|police|surveillance/),
    high: route('Développer la prévention et la résilience civile', 'Coordonner prévention, secours, renseignement intérieur et préparation des collectivités.', 70, 16, 6.8, 2.3, { security: 6, resilience: 9, rights: 2 }, /prevention.*securite|protection civile|secours|resilience civile|terrorisme/),
  },
  religion: {
    domain: 'religion', label: 'Religion et neutralité de l’État', subtitle: 'Laïcité, reconnaissance des cultes et règles communes des services publics.',
    positionLabels: ['Références religieuses fortes', 'Neutralité négociée', 'État fortement neutre'],
    indicators: [{ id: 'rights', label: 'Libertés et garanties' }, { id: 'stateCapacity', label: 'Règles communes' }, { id: 'equity', label: 'Égalité de traitement' }],
    low: route('Élargir la reconnaissance des cultes', 'Accorder davantage de place aux représentants confessionnels dans le dialogue public et certains services.', 38, 12, 3.5, 0.4, { rights: 4, equity: 2, stateCapacity: -1 }, /reconnaissance|autorite relig|accommod|culte/),
    high: route('Renforcer la neutralité de l’État', 'Clarifier les règles communes et limiter les exceptions confessionnelles dans les services publics.', 78, 12, 4.5, 0.6, { stateCapacity: 6, equity: 4, rights: -1 }, /neutral|laic|secular/),
  },
  immigration: {
    domain: 'immigration', label: 'Immigration et intégration', subtitle: 'Admissions, contrôle des flux, langue, emploi et naturalisation.',
    positionLabels: ['Admissions fortement resserrées', 'Gestion intermédiaire', 'Ouverture encadrée et intégration'],
    indicators: [{ id: 'access', label: 'Parcours d’intégration' }, { id: 'security', label: 'Maîtrise des flux' }, { id: 'equity', label: 'Égalité de traitement' }],
    low: route('Resserrer les admissions', 'Réduire les admissions, renforcer les contrôles et concentrer l’effort sur les filières jugées prioritaires.', 28, 9, 4, 0.8, { security: 7, access: -3, equity: -2 }, /restriction|resserr|controle|admission|fermer|frontiere/),
    high: route('Pacte d’intégration et de travail', 'Accélérer la langue, l’accès à l’emploi et la naturalisation sous conditions vérifiables.', 68, 15, 5.5, 1.4, { access: 8, equity: 5, security: 1 }, /integration|travail|langue|naturalisation/),
  },
  societal: {
    domain: 'societal', label: 'Politique sociétale', subtitle: 'Droits civils, normes familiales, égalité et ordre public.',
    positionLabels: ['Ordre public et normes traditionnelles', 'Compromis sociétal', 'Droits civils étendus'],
    indicators: [{ id: 'rights', label: 'Droits civils' }, { id: 'equity', label: 'Égalité' }, { id: 'security', label: 'Cohésion et ordre public' }],
    low: route('Priorité à l’ordre public et à la famille', 'Renforcer les obligations communes et les politiques familiales, au prix de contraintes sociales plus visibles.', 32, 12, 3.5, 0.7, { security: 5, rights: -4, equity: -3 }, /ordre public|famille|obligation|tradition/),
    high: route('Étendre les droits civils', 'Étendre les protections individuelles et l’égalité juridique, avec une mise en œuvre progressive.', 76, 15, 4.5, 1.1, { rights: 9, equity: 8, security: -1 }, /droit|egalite|protection|libert/),
  },
};

export const nationalReformDomains = Object.keys(nationalReformProfiles) as NationalReformDomain[];

/** Les voies préparées servent d'exemples rapides. Une commande libre génère
 * une option du même type dans reformOptionForText. */
export const nationalReformOptions: NationalReformOption[] = nationalReformDomains.flatMap((domain) => {
  const profile = nationalReformProfiles[domain];
  return [profile.low, profile.high].map((candidate, index) => ({ ...candidate, id: `${domain}-${index === 0 ? 'low' : 'high'}`, domain }));
});

type BaselineOverride = Partial<Pick<NationalReformState, 'position' | 'evidenceLevel' | 'indicators'>>;

/** Valeurs explicites de la France au 1er janvier 2000 : point de départ
 * consultable, et non score global caché. */
const france2000Baselines: Partial<Record<NationalReformDomain, BaselineOverride>> = {
  retirement: { position: 32, indicators: { coverage: 75, sustainability: 46, marketRole: 22 } }, labor: { position: 43, indicators: { access: 65, equity: 68, productivity: 53 } }, taxation: { position: 43, indicators: { sustainability: 48, equity: 66, productivity: 52 } }, social_protection: { position: 38, indicators: { coverage: 76, equity: 69, sustainability: 49 } }, health: { position: 32, indicators: { access: 74, coverage: 80, sustainability: 50 } }, education: { position: 33, indicators: { access: 73, equity: 68, productivity: 57 } }, energy: { position: 43, indicators: { resilience: 47, sustainability: 45, environment: 51 } }, industry: { position: 46, indicators: { productivity: 58, resilience: 54, stateCapacity: 53 } }, environment: { position: 42, indicators: { environment: 49, resilience: 48, productivity: 54 } }, housing: { position: 36, indicators: { access: 51, equity: 55, stateCapacity: 48 } }, administration: { position: 48, indicators: { stateCapacity: 56, access: 58, productivity: 54 } }, institutions: { position: 58, indicators: { rights: 71, stateCapacity: 65, equity: 60 } }, justice: { position: 53, indicators: { security: 57, rights: 68, access: 62 } }, security: { position: 48, indicators: { security: 63, resilience: 52, rights: 65 } }, religion: { position: 78, indicators: { rights: 75, stateCapacity: 66, equity: 70 } }, immigration: { position: 55, indicators: { access: 54, security: 57, equity: 55 } }, societal: { position: 63, indicators: { rights: 72, equity: 70, security: 50 } },
};

const legacyPositions: Record<string, Partial<Record<NationalReformDomain, number>>> = {
  DEU: { religion: 58, immigration: 48, societal: 52 }, ITA: { religion: 55, immigration: 39, societal: 50 }, ESP: { religion: 62, immigration: 43, societal: 56 }, GBR: { religion: 56, immigration: 48, societal: 60 }, DZA: { religion: 28, immigration: 36, societal: 27 }, USA: { religion: 51, immigration: 65, societal: 63 }, RUS: { religion: 38, immigration: 30, societal: 35 }, CHN: { religion: 30, immigration: 20, societal: 25 }, JPN: { religion: 60, immigration: 22, societal: 45 }, IND: { religion: 39, immigration: 30, societal: 36 }, TUR: { religion: 38, immigration: 35, societal: 34 }, VNM: { religion: 34, immigration: 25, societal: 29 }, BRA: { religion: 46, immigration: 49, societal: 54 }, ZAF: { religion: 48, immigration: 52, societal: 57 }, AUS: { religion: 58, immigration: 56, societal: 62 },
};

function heuristicPosition(country: CountryState, domain: NationalReformDomain) {
  const descriptor = normalize(`${country.politics.regime} ${country.politics.governmentLabel}`);
  const doctrine = country.politics.doctrine;
  if (domain === 'religion') {
    if (/theocr|islamique|religieux|charia/.test(descriptor)) return 25;
    if (/parti unique|communiste|emirat/.test(descriptor)) return 34;
    return clamp(58 + doctrine.social * 0.35);
  }
  if (domain === 'immigration') return clamp(45 + doctrine.social * 0.18 + (country.weight > 70 ? 5 : 0));
  if (domain === 'retirement' || domain === 'social_protection' || domain === 'health' || domain === 'education') return clamp(48 - doctrine.social * 0.18);
  if (domain === 'taxation' || domain === 'labor' || domain === 'industry') return clamp(52 + doctrine.economic * 0.2);
  if (domain === 'security' || domain === 'justice') return clamp(50 - doctrine.security * 0.15);
  return clamp(52 + doctrine.social * 0.16 + doctrine.sovereignty * 0.08);
}

function defaultIndicators(country: CountryState, profile: NationalReformProfile): NationalReformState['indicators'] {
  const baseline = clamp(45 + country.politics.administrativeCompliance * 0.18 + country.weight * 0.05);
  return Object.fromEntries(profile.indicators.map(({ id }, index) => [id, round(clamp(baseline + (index - 1) * 3))]));
}

export function createNationalReforms2000(countries: Record<CountryId, CountryState>, date: ISODate = '2000-01-01') {
  const result: Record<string, NationalReformState> = {};
  for (const country of Object.values(countries)) {
    const descriptor = normalize(`${country.politics.regime} ${country.politics.governmentLabel}`);
    const institutionalAnchor = clamp(34 + country.politics.administrativeCompliance * 0.32 + (/theocr|parti unique|emirat/.test(descriptor) ? 18 : 0));
    for (const domain of nationalReformDomains) {
      const profile = nationalReformProfiles[domain];
      const override = country.id === 'FRA' ? france2000Baselines[domain] : undefined;
      const position = override?.position ?? legacyPositions[country.id]?.[domain] ?? heuristicPosition(country, domain);
      result[`${country.id}:${domain}`] = {
        countryId: country.id, domain, position: round(position), institutionalAnchor: round(institutionalAnchor), publicSalience: ['retirement', 'labor', 'taxation', 'social_protection', 'health', 'immigration'].includes(domain) ? 58 : 46, polarization: 12,
        implementationCapacity: round(clamp(country.politics.administrativeCompliance * 0.8 + country.capacities.administration.maximum * 0.2)), administrativeBurden: 18,
        evidenceLevel: round(override?.evidenceLevel ?? clamp(39 + country.politics.administrativeCompliance * 0.22)), annualFiscalImpact: 0,
        indicators: { ...defaultIndicators(country, profile), ...override?.indicators }, reformCount: 0, activeProgramId: null, lastChangedAt: date,
      };
    }
  }
  return result;
}

export function reformStateKey(countryId: CountryId, domain: NationalReformDomain) { return `${countryId}:${domain}`; }

/** Toute loi reste dans un domaine persistant. Une loi inconnue est donc une
 * réforme institutionnelle, jamais une modernisation administrative arbitraire. */
export function reformDomainFromText(text: string): NationalReformDomain {
  const value = normalize(text);
  const selectedRoute = nationalReformOptions.find((item) => value.includes(normalize(item.title)));
  if (selectedRoute) return selectedRoute.domain;
  if (/retraite|pension|vieillesse|capitalisation|repartition/.test(value)) return 'retirement';
  if (/travail|emploi|chomage|salaire|syndic|contrat de travail|licenciement/.test(value)) return 'labor';
  if (/impot|taxe|tva|fiscal\w*|prelevement|cotisation/.test(value)) return 'taxation';
  if (/securite sociale|prestation|aide sociale|minimum social|allocat|protection sociale/.test(value)) return 'social_protection';
  if (/sante|hopital|soins|medecin|assurance maladie/.test(value)) return 'health';
  if (/educ\w*|ecole|universite|enseignant|formation|apprentissage/.test(value)) return 'education';
  if (/environnement|ecolog|pollution|biodivers|\beau\b|agricultur|climat|emission/.test(value)) return 'environment';
  if (/energ\w*|electric|nucleaire|gaz|petrole|charbon|renouvelable/.test(value)) return 'energy';
  if (/industri\w*|reindustr|filiere|usine|innovation|semi.conduct|technolog/.test(value)) return 'industry';
  if (/logement|habitat|loyer|foncier|immobilier|construction/.test(value)) return 'housing';
  if (/admin\w*|fonctionnaire|service public|procedure|bureaucrat|guichet/.test(value)) return 'administration';
  if (/justice|tribunal|penal|prison|aide juridictionnelle|magistrat/.test(value)) return 'justice';
  if (/securite interieure|maintien de l ordre|protection civile|police|terrorisme/.test(value)) return 'security';
  if (/relig|laic|confession|eglise|culte/.test(value)) return 'religion';
  if (/immigr|migrat|asile|frontiere|naturalisation|integration/.test(value)) return 'immigration';
  if (/societ|famille|droits civils|ordre public|mœurs|moeurs|egalite/.test(value)) return 'societal';
  return 'institutions';
}

function balancedRoute(profile: NationalReformProfile): ReformRoute {
  const average = (field: keyof Pick<ReformRoute, 'durationMonths' | 'budgetCost' | 'annualFiscalImpact' | 'targetPosition'>) => round((profile.low[field] + profile.high[field]) / 2);
  const keys = [...new Set([...Object.keys(profile.low.indicatorDeltas), ...Object.keys(profile.high.indicatorDeltas)])] as NationalPolicyIndicatorId[];
  const indicators = Object.fromEntries(keys.map((key) => [key, round(((profile.low.indicatorDeltas[key] ?? 0) + (profile.high.indicatorDeltas[key] ?? 0)) / 2)]));
  return route(`Réforme-cadre de ${profile.label.toLocaleLowerCase('fr')}`, `Définir une trajectoire graduelle, chiffrée et révisable pour ${profile.label.toLocaleLowerCase('fr')}.`, average('targetPosition'), average('durationMonths'), average('budgetCost'), average('annualFiscalImpact'), indicators, /$^/, 'modérée');
}

/** Les ordres libres et les voies guidées utilisent la même proposition. */
export function reformOptionForText(text: string, requestedDomain?: NationalReformDomain): NationalReformOption {
  const value = normalize(text);
  const selectedRoute = nationalReformOptions.find((item) => value.includes(normalize(item.title)));
  if (selectedRoute) return selectedRoute;
  const domain = requestedDomain ?? reformDomainFromText(text);
  const profile = nationalReformProfiles[domain];
  // Les boutons guidés réinjectent leur intitulé dans l'ordre. Préserver
  // explicitement leur voie évite qu'un verbe générique tel que « renforcer »
  // inverse par accident l'orientation choisie par le joueur.
  const candidate = profile.low.keywords.test(value)
    ? profile.low
    : profile.high.keywords.test(value)
      ? profile.high
      : /reduire|resserrer|proteger|renforcer|public|encadrer|controle|consolider/.test(value)
        ? profile.low
        : /ouvrir|diversifier|assouplir|autonomie|investir|etendre|capitalis|decentralis/.test(value)
          ? profile.high
          : balancedRoute(profile);
  const direction = candidate === profile.low ? 'low' : candidate === profile.high ? 'high' : 'balanced';
  return { ...candidate, id: `${domain}-${direction}`, domain };
}

/** Résout une intention déjà comprise par l'IA sans réinterpréter sa prose. */
export function reformOptionForStructuredIntent(intent: StructuredReformIntent): NationalReformOption {
  const profile = nationalReformProfiles[intent.domain];
  const candidate = intent.direction === 'lower'
    ? profile.low
    : intent.direction === 'higher'
      ? profile.high
      : balancedRoute(profile);
  const paceMultiplier = intent.pace === 'rapid' ? 0.72 : 1;
  const budgetMultiplier = intent.pace === 'rapid' ? 1.18 : 1;
  return {
    ...candidate,
    id: intent.id,
    domain: intent.domain,
    title: intent.title,
    summary: intent.objective,
    durationMonths: Math.max(2, Math.round(candidate.durationMonths * paceMultiplier)),
    budgetCost: round(candidate.budgetCost * budgetMultiplier),
  };
}

export function reformPositionLabel(domain: NationalReformDomain, position: number) {
  const labels = nationalReformProfiles[domain].positionLabels;
  return position >= 68 ? labels[2] : position >= 45 ? labels[1] : labels[0];
}

export function reformPolicySignals(text: string): Array<{ signal: PolicySignal; weight: number }> {
  const domain = reformDomainFromText(text);
  const option = reformOptionForText(text, domain);
  if (domain === 'labor' && option.targetPosition >= 55) return [{ signal: 'labor_deregulation', weight: 0.8 }];
  if (domain === 'taxation' && option.targetPosition < 45) return [{ signal: 'tax_increase_high_incomes', weight: 0.85 }];
  if (domain === 'taxation' && option.targetPosition >= 55) return [{ signal: 'austerity', weight: 0.35 }];
  if (domain === 'industry') return [{ signal: 'public_industrial_investment', weight: option.targetPosition >= 55 ? 0.8 : 0.35 }];
  if (domain === 'energy' && option.targetPosition < 45 && /gaz|petrole|charbon|fossile/.test(normalize(text))) return [{ signal: 'fossil_expansion', weight: 0.7 }];
  if (domain === 'administration' || domain === 'institutions') return [{ signal: 'administrative_reorganization', weight: 0.65 }];
  return [];
}

export function reformPolicySignalsForIntent(intent: StructuredReformIntent): Array<{ signal: PolicySignal; weight: number }> {
  const option = reformOptionForStructuredIntent(intent);
  const domain = intent.domain;
  if (domain === 'labor' && option.targetPosition >= 55) return [{ signal: 'labor_deregulation', weight: 0.8 }];
  if (domain === 'taxation' && option.targetPosition < 45) return [{ signal: 'tax_increase_high_incomes', weight: 0.85 }];
  if (domain === 'taxation' && option.targetPosition >= 55) return [{ signal: 'austerity', weight: 0.35 }];
  if (domain === 'industry') return [{ signal: 'public_industrial_investment', weight: option.targetPosition >= 55 ? 0.8 : 0.35 }];
  if (domain === 'administration' || domain === 'institutions') return [{ signal: 'administrative_reorganization', weight: 0.65 }];
  return [];
}

export function nationalReformSnapshot(
  state: WorldState,
  domain: NationalReformDomain,
  countryId = state.playerCountryId,
): NationalReformSnapshot | undefined {
  const current = state.nationalReforms?.[reformStateKey(countryId, domain)];
  if (!current) return undefined;
  return {
    domain,
    position: current.position,
    positionLabel: reformPositionLabel(domain, current.position),
    annualFiscalImpact: current.annualFiscalImpact,
    indicators: { ...current.indicators },
    evidenceLevel: current.evidenceLevel,
    polarization: current.polarization,
    capturedAt: state.currentDate,
  };
}

export function nationalReformOutcomeSummaryFor(
  state: WorldState,
  intent: StructuredReformIntent,
  outcome: NationalReformOutcome,
  before: NationalReformSnapshot,
  countryId = state.playerCountryId,
): NationalReformOutcomeSummary | undefined {
  const after = nationalReformSnapshot(state, intent.domain, countryId);
  if (!after) return undefined;
  const changes: string[] = [];
  if (before.positionLabel !== after.positionLabel) changes.push(`Orientation : ${before.positionLabel} → ${after.positionLabel}.`);
  else changes.push(`Orientation maintenue : ${after.positionLabel}.`);
  if (before.annualFiscalImpact !== after.annualFiscalImpact) {
    changes.push(`Incidence annuelle : ${before.annualFiscalImpact >= 0 ? '+' : ''}${before.annualFiscalImpact} → ${after.annualFiscalImpact >= 0 ? '+' : ''}${after.annualFiscalImpact} crédits.`);
  }
  for (const [indicator, value] of Object.entries(after.indicators)) {
    const previous = before.indicators[indicator as NationalPolicyIndicatorId];
    if (typeof previous === 'number' && typeof value === 'number' && previous !== value) {
      changes.push(`${nationalReformProfiles[intent.domain].indicators.find((item) => item.id === indicator)?.label ?? indicator} : ${Math.round(previous)} → ${Math.round(value)}.`);
    }
  }
  const headline = outcome === 'adopted'
    ? `${intent.title} est mise en œuvre.`
    : outcome === 'partial'
      ? `${intent.title} est appliquée partiellement.`
      : outcome === 'stalled'
        ? `${intent.title} est bloquée.`
      : `${intent.title} est remise en cause.`;
  const summary = outcome === 'adopted'
    ? `La décision est entrée en vigueur. L’orientation de ${nationalReformProfiles[intent.domain].label.toLowerCase()} est désormais « ${after.positionLabel} ».`
    : outcome === 'partial'
      ? `Une partie des mesures est appliquée. Le dossier reste ouvert sur les dispositions encore inabouties.`
      : outcome === 'stalled'
        ? `La réforme n’a pas franchi les résistances politiques ou administratives ; la situation de départ demeure la référence.`
        : `L’application a produit une contestation suffisante pour remettre l’orientation en cause.`;
  return { outcome, before, after, headline, summary, changes: changes.slice(0, 6) };
}

export function nationalReformSupport(state: WorldState, domain: NationalReformDomain, targetPosition: number, countryId = state.playerCountryId) {
  const country = state.countries[countryId];
  if (!country) return { score: 0, obstacles: ['Le pays porteur de la réforme est absent du monde simulé.'] };
  const reform = state.nationalReforms?.[reformStateKey(country.id, domain)];
  if (!reform) return { score: 35, obstacles: ['Profil de politique publique absent du monde simulé.'] };
  const ideal = clamp(50 + country.politics.doctrine.social * 0.45);
  const distance = Math.abs(targetPosition - reform.position);
  const ideologicalDistance = Math.abs(targetPosition - ideal);
  const score = Math.round(clamp(76 - distance * 0.42 - ideologicalDistance * 0.18 - reform.institutionalAnchor * 0.12 - reform.polarization * 0.22 + reform.implementationCapacity * 0.08 + (reform.evidenceLevel - 45) * 0.14));
  const obstacles: string[] = [];
  if (reform.evidenceLevel < 45) obstacles.push('La base factuelle est encore faible : un audit réduit le risque sans décider de l’orientation.');
  if (ideologicalDistance > 24) obstacles.push('La ligne du gouvernement est éloignée de la réforme proposée.');
  if (reform.institutionalAnchor > 62) obstacles.push('Des institutions et corps établis peuvent ralentir le changement.');
  if (reform.polarization > 35) obstacles.push('Le sujet est déjà fortement polarisé.');
  if (reform.implementationCapacity < 48) obstacles.push('L’administration manque de moyens pour appliquer rapidement la réforme.');
  return { score, obstacles };
}

/** L'audit augmente le niveau de preuve. Il ne modifie ni la position, ni les
 * crédits, ni l'orientation de la future loi. */
export function nationalPolicyAuditEffects(state: WorldState, intent: string, completed: boolean, countryId = state.playerCountryId, requestedDomain?: NationalReformDomain): WorldEffect[] {
  const country = state.countries[countryId];
  if (!country) return [];
  const domain = requestedDomain ?? reformDomainFromText(intent);
  const current = state.nationalReforms?.[reformStateKey(country.id, domain)];
  if (!current) return [];
  const evidenceLevel = round(clamp(current.evidenceLevel + (completed ? 22 : 10)));
  return [{ kind: 'national_reform_patch', countryId: country.id, domain, patch: { evidenceLevel, lastChangedAt: state.currentDate }, reason: `L’audit verse des scénarios contradictoires dans « ${nationalReformProfiles[domain].label} » : base factuelle ${current.evidenceLevel}/100 → ${evidenceLevel}/100.`, visibility: 'player' }];
}

function policyMacroEffects(countryId: CountryId, domain: NationalReformDomain, factor: number): WorldEffect[] {
  if (factor <= 0) return [];
  if (domain === 'industry') return [{ kind: 'macro_policy_delta', countryId, patch: { industrialSupport: round(1.5 * factor), publicInvestmentPctGdp: round(0.1 * factor) }, reason: 'La réforme industrielle modifie durablement le pilotage des filières.' }];
  if (domain === 'energy' || domain === 'environment') return [{ kind: 'macro_policy_delta', countryId, patch: { publicInvestmentPctGdp: round(0.08 * factor) }, reason: 'La réforme énergétique ou environnementale modifie progressivement l’effort d’investissement public.' }];
  if (domain === 'taxation') return [{ kind: 'macro_policy_delta', countryId, patch: { fiscalStance: round(-1 * factor) }, reason: 'La réforme fiscale ajuste durablement la posture budgétaire.' }];
  return [];
}

export function nationalReformEffects(
  state: WorldState,
  intent: string,
  outcome: NationalReformOutcome,
  countryId = state.playerCountryId,
  structuredIntent?: StructuredReformIntent,
): WorldEffect[] {
  const country = state.countries[countryId];
  if (!country) return [];
  const domain = structuredIntent?.domain ?? reformDomainFromText(intent);
  const option = structuredIntent ? reformOptionForStructuredIntent(structuredIntent) : reformOptionForText(intent, domain);
  const current = state.nationalReforms?.[reformStateKey(country.id, domain)];
  if (!current) return [];
  const factor = outcome === 'adopted' ? 1 : outcome === 'partial' ? 0.5 : 0;
  const delta = option.targetPosition - current.position;
  const position = round(clamp(current.position + delta * factor));
  const indicators = { ...current.indicators };
  for (const [indicator, change] of Object.entries(option.indicatorDeltas)) {
    const key = indicator as NationalPolicyIndicatorId;
    indicators[key] = round(clamp((current.indicators[key] ?? 50) + (change ?? 0) * factor));
  }
  const annualFiscalImpact = round(current.annualFiscalImpact + (option.annualFiscalImpact - current.annualFiscalImpact) * factor);
  const annualImpactDelta = round(annualFiscalImpact - current.annualFiscalImpact);
  const polarization = round(clamp(current.polarization + (outcome === 'stalled' ? 6 : Math.abs(delta) * (outcome === 'adopted' ? 0.42 : 0.25))));
  const evidenceBonus = (current.evidenceLevel - 45) * 0.015;
  const stabilityDelta = outcome === 'adopted' ? round(0.8 - Math.abs(delta) * 0.022 + evidenceBonus) : outcome === 'partial' ? round(0.25 - Math.abs(delta) * 0.012 + evidenceBonus / 2) : -0.55;
  const approvalDelta = outcome === 'adopted' ? round(0.4 - Math.abs(delta) * 0.012 + evidenceBonus / 2) : outcome === 'partial' ? -0.15 : -0.7;
  const dossierId = `reform-${country.id}-${domain}`;
  const profile = nationalReformProfiles[domain];
  const title = `${country.name} · ${profile.label}`;
  const summary = outcome === 'adopted'
    ? `${option.title} est mise en œuvre ; la politique évolue vers « ${reformPositionLabel(domain, position)} » et son incidence annuelle nette est de ${annualFiscalImpact >= 0 ? '+' : ''}${annualFiscalImpact} crédit${Math.abs(annualFiscalImpact) > 1 ? 's' : ''}.`
    : outcome === 'partial'
      ? `${option.title} n’est appliquée qu’en partie ; la trajectoire reste ouverte et les indicateurs ne progressent qu’à moitié.`
      : `La réforme « ${option.title} » se heurte aux institutions et reste bloquée.`;
  const effects: WorldEffect[] = [
    { kind: 'national_reform_patch', countryId: country.id, domain, patch: { position, indicators, annualFiscalImpact, polarization, administrativeBurden: round(clamp(current.administrativeBurden + (outcome === 'adopted' ? 4 : 2))), reformCount: current.reformCount + (outcome === 'stalled' ? 0 : 1), activeProgramId: null, lastOutcome: outcome, lastChangedAt: state.currentDate }, reason: summary, visibility: 'player' },
    { kind: 'politics_patch', countryId: country.id, patch: { publicApproval: clamp(country.politics.publicApproval + approvalDelta) }, reason: `La réaction de l’opinion à la réforme modifie l’approbation du gouvernement (${approvalDelta >= 0 ? '+' : ''}${approvalDelta}).`, visibility: 'player' },
    { kind: 'metric_delta', countryId: country.id, metric: 'stability', delta: stabilityDelta, reason: 'La réforme crée une friction temporaire, modulée par la qualité de la préparation.', visibility: 'player' },
    ...policyMacroEffects(country.id, domain, factor),
  ];
  if (annualImpactDelta > 0) effects.push({ kind: 'fiscal_delta', countryId: country.id, bucket: 'recurring_costs', delta: annualImpactDelta, reason: `${option.title} crée ${annualImpactDelta} crédit${annualImpactDelta > 1 ? 's' : ''} de dépense annuelle durable.` });
  if (annualImpactDelta < 0) effects.push({ kind: 'fiscal_delta', countryId: country.id, bucket: 'recurring_savings', delta: -annualImpactDelta, reason: `${option.title} dégage ${-annualImpactDelta} crédit${-annualImpactDelta > 1 ? 's' : ''} d’économie annuelle durable.` });
  const existing = state.strategicDossiers[dossierId];
  if (!existing) effects.push({ kind: 'dossier_add', dossier: { id: dossierId, title, kind: 'political_transition', status: outcome === 'stalled' ? 'active' : 'deescalating', importance: 'moderate', actorIds: [country.id], regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate, phase: outcome === 'adopted' ? 'Mise en œuvre et réactions' : 'Arbitrage institutionnel', trend: outcome === 'stalled' ? 'escalating' : 'stable', publicSummary: summary, followed: true, autoTracked: false, commitments: [option.title], pendingDecisions: outcome === 'stalled' ? ['Choisir une voie de compromis, un dialogue ou un silence explicite.'] : [], relatedCurrentIds: [], relatedActionIds: [], entries: [{ id: `${dossierId}-opening`, date: state.currentDate, title: option.title, summary, importance: 'moderate', actorIds: [country.id], requiresDecision: outcome === 'stalled', visibility: 'player' }] }, reason: 'Une réforme nationale structurante devient un dossier permanent.', visibility: 'player' });
  else effects.push({ kind: 'dossier_patch', dossierId, patch: { updatedAt: state.currentDate, phase: outcome === 'adopted' ? 'Mise en œuvre et réactions' : 'Arbitrage institutionnel', trend: outcome === 'stalled' ? 'escalating' : 'stable', status: outcome === 'stalled' ? 'active' : existing.status }, reason: 'Le dossier de politique publique conserve les arbitrages et réactions successifs.', visibility: 'player' });
  effects.push({ kind: 'dossier_entry_add', dossierId, entry: { id: `${dossierId}-${state.currentDate}-${outcome}`, date: state.currentDate, title: option.title, summary, importance: 'moderate', actorIds: [country.id], requiresDecision: outcome === 'stalled', visibility: 'player' }, reason: 'Chaque étape de la réforme reste consultable dans son dossier.', visibility: 'player' });
  return effects;
}
