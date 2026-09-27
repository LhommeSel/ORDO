import type { CapacityBaseline, CapacityDomainId, CapacityState } from './types';

const factor = (label: string, value: number, detail: string) => ({ label, value, detail });

/**
 * Transforme une fiche explicitée en chiffres jouables. Les plafonds et les
 * engagements du scénario ne sont donc pas deux valeurs écrites à la main à
 * côté d'une justification : ils sont la somme des composantes présentées au
 * joueur.
 */
export function capacitiesFromBaseline(baseline: CapacityBaseline): CapacityState {
  return Object.fromEntries((Object.keys(baseline) as CapacityDomainId[]).map((domain) => {
    const entry = baseline[domain];
    const maximum = entry.maximumFactors.reduce((total, item) => total + item.value, 0);
    const committed = entry.commitmentFactors.reduce((total, item) => total + item.value, 0);
    return [domain, { maximum, committed: Math.min(maximum, committed) }];
  })) as CapacityState;
}

/** France, 1er janvier 2000. Les points sont des indices de gameplay, ancrés
 * dans des institutions et engagements observables, non des dépenses ou des
 * effectifs réels. */
export const france2000CapacityBaseline: CapacityBaseline = {
  government: {
    maximumFactors: [
      factor('Institutions exécutives', 23, 'Présidence, Premier ministre, cabinets et services interministériels établis.'),
      factor('Administration centrale', 16, 'Corps administratifs expérimentés capables de préparer et d’arbitrer les politiques.'),
      factor('Infrastructures de coordination', 10, 'Réseaux territoriaux, statistiques et systèmes publics soutiennent la circulation de l’information.'),
      factor('Poids européen et international', 12, 'La France participe aux arbitrages européens et multilatéraux avec des équipes permanentes.'),
      factor('Stabilité institutionnelle', 7, 'Institutions stables malgré les contraintes de la cohabitation.'),
    ],
    commitmentFactors: [
      factor('Cohabitation', 10, 'Président et gouvernement de sensibilités différentes multiplient les arbitrages politiques.'),
      factor('Arbitrages budgétaires et sociaux', 8, 'Emploi, retraites et finances publiques mobilisent le centre gouvernemental.'),
      factor('Coordination européenne', 7, 'Préparation des positions françaises dans l’Union économique et monétaire.'),
      factor('Coordination territoriale', 6, 'Relations avec préfets, collectivités et grands services nationaux.'),
    ],
  },
  administration: {
    maximumFactors: [
      factor('Réseau de services publics', 30, 'Administrations centrales, déconcentrées et opérateurs nationaux très étendus.'),
      factor('Professionnalisation administrative', 18, 'Fonction publique structurée et forte continuité des compétences.'),
      factor('Infrastructures nationales', 14, 'Transports, réseaux et systèmes statistiques facilitent la mise en œuvre.'),
      factor('Protection sociale organisée', 10, 'Capacité durable à administrer de grands dispositifs collectifs.'),
    ],
    commitmentFactors: [
      factor('Protection sociale et santé', 16, 'Gestion courante des prestations et assurances sociales.'),
      factor('Éducation et services de proximité', 9, 'Réseaux scolaires et services publics territoriaux.'),
      factor('Finances et fiscalité', 8, 'Recouvrement, contrôle et préparation budgétaire.'),
      factor('Administration territoriale', 9, 'Préfectures, collectivités et mise en œuvre locale.'),
    ],
  },
  diplomacy: {
    maximumFactors: [
      factor('Réseau extérieur', 20, 'Ambassades, consulats et représentations permanentes sur plusieurs continents.'),
      factor('Influence multilatérale', 18, 'Membre permanent du Conseil de sécurité et acteur central de l’Union européenne.'),
      factor('Expertise diplomatique', 14, 'Corps diplomatique, compétences linguistiques et négociation spécialisée.'),
      factor('Soutien de l’État', 12, 'Appui administratif, culturel, économique et militaire aux positions extérieures.'),
    ],
    commitmentFactors: [
      factor('Union européenne', 12, 'Négociations économiques, institutionnelles et réglementaires permanentes.'),
      factor('Réseau consulaire et ambassades', 9, 'Service courant des postes et protection des ressortissants.'),
      factor('Organisations internationales', 7, 'ONU, institutions financières et enceintes multilatérales.'),
      factor('Afrique et Méditerranée', 8, 'Suivi politique, sécuritaire et économique de zones prioritaires.'),
    ],
  },
  economy: {
    maximumFactors: [
      factor('Administration fiscale et budgétaire', 20, 'Trésor, budget et fiscalité donnent une forte capacité de préparation et de contrôle.'),
      factor('Base industrielle', 15, 'Tissu industriel diversifié et grands groupes dans les secteurs stratégiques.'),
      factor('Diversification économique', 15, 'Services, industrie, agriculture et commerce limitent la dépendance à un secteur unique.'),
      factor('Infrastructures financières', 12, 'Système bancaire, statistiques et infrastructures de marché établis.'),
    ],
    commitmentFactors: [
      factor('Euro et budget', 12, 'Mise en place de l’union monétaire et préparation budgétaire nationale.'),
      factor('Emploi et comptes sociaux', 10, 'Chômage élevé et pilotage des comptes sociaux requièrent un suivi constant.'),
      factor('Fiscalité et dette', 9, 'Recettes, dépenses et crédibilité financière à surveiller.'),
      factor('Filières industrielles', 8, 'Suivi des secteurs stratégiques et des restructurations.'),
    ],
  },
  intelligence: {
    maximumFactors: [
      factor('Services intérieur et extérieur', 21, 'Services compétents de sécurité intérieure, extérieure et militaire.'),
      factor('Analyse et moyens techniques', 13, 'Capacités d’analyse, de traitement et de recueil adaptées à une puissance moyenne supérieure.'),
      factor('Coordination interservices', 10, 'Liens fonctionnels entre sécurité intérieure, défense et diplomatie.'),
      factor('Réseaux partenaires', 11, 'Coopérations européennes et alliées, sans atteindre l’ampleur américaine.'),
    ],
    commitmentFactors: [
      factor('Contre-espionnage et sécurité intérieure', 10, 'Protection du territoire et des institutions.'),
      factor('Veille extérieure', 12, 'Suivi des zones d’intérêt, des crises et des partenaires.'),
      factor('Dossiers stratégiques', 8, 'Prolifération, terrorisme et sécurité économique.'),
    ],
  },
  defense: {
    maximumFactors: [
      factor('Dissuasion nucléaire', 20, 'Force de dissuasion et chaîne de commandement nationale.'),
      factor('Forces professionnalisées', 20, 'Armées en professionnalisation avec des capacités interarmées établies.'),
      factor('Industrie de défense', 12, 'Base industrielle et technologique soutenant l’autonomie de décision.'),
      factor('Projection extérieure', 8, 'Capacité à agir hors du territoire avec des alliés ou de façon autonome.'),
      factor('Soutien et logistique', 10, 'Infrastructure, maintenance et commandement des forces.'),
    ],
    commitmentFactors: [
      factor('Dissuasion permanente', 11, 'Disponibilité continue des composantes nucléaires.'),
      factor('Préparation et entraînement', 10, 'Maintien en condition, exercices et cycles de préparation.'),
      factor('Présences et opérations extérieures', 10, 'Engagements permanents et forces prépositionnées.'),
      factor('Maintenance et logistique', 12, 'Entretien des équipements et chaînes de soutien.'),
    ],
  },
};

type CapacitySeed = Record<CapacityDomainId, [maximum: number, committed: number]>;

/** Les neuf autres pays du premier lot. La France possède une fiche plus
 * détaillée ci-dessus ; ces fiches utilisent la même règle de somme avec des
 * libellés courts, afin de garder le premier lot maintenable. Le Brésil est
 * retenu comme dixième pays en cas d'égalité de poids avec l'Espagne, car il
 * apparaît en premier dans le registre du scénario. */
const firstLotSeeds: Record<string, { name: string; context: string; values: CapacitySeed }> = {
  USA: { name: 'États-Unis', context: 'Présidence fédérale, réseaux mondiaux et très forte profondeur matérielle', values: { government: [92, 51], administration: [94, 54], diplomacy: [100, 58], economy: [100, 61], intelligence: [100, 65], defense: [100, 67] } },
  JPN: { name: 'Japon', context: 'État administratif très performant, industrie avancée et contrainte démographique', values: { government: [80, 43], administration: [88, 49], diplomacy: [82, 40], economy: [90, 55], intelligence: [68, 35], defense: [70, 38] } },
  CHN: { name: 'Chine', context: 'Parti-État centralisé, mobilisation administrative élevée et modernisation en cours', values: { government: [90, 46], administration: [82, 48], diplomacy: [72, 34], economy: [88, 57], intelligence: [78, 45], defense: [84, 49] } },
  DEU: { name: 'Allemagne', context: 'Fédération administrative solide, coalition parlementaire et poids industriel européen', values: { government: [72, 34], administration: [78, 40], diplomacy: [66, 33], economy: [78, 45], intelligence: [58, 28], defense: [66, 36] } },
  RUS: { name: 'Russie', context: 'Héritage d’appareil d’État et d’arsenal, mais institutions en transition et ressources contraintes', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  IND: { name: 'Inde', context: 'Démocratie fédérale, grande profondeur humaine et infrastructures encore inégales', values: { government: [76, 42], administration: [64, 43], diplomacy: [78, 39], economy: [74, 49], intelligence: [68, 36], defense: [78, 46] } },
  GBR: { name: 'Royaume-Uni', context: 'Parlementarisme stable, réseau extérieur ancien et alliance atlantique structurante', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  CAN: { name: 'Canada', context: 'Fédération stable, vaste territoire et forte intégration nord-américaine', values: { government: [74, 35], administration: [82, 40], diplomacy: [78, 34], economy: [78, 42], intelligence: [62, 27], defense: [64, 31] } },
  BRA: { name: 'Brésil', context: 'Fédération continentale, diplomatie régionale et contraintes financières persistantes', values: { government: [70, 37], administration: [68, 40], diplomacy: [70, 34], economy: [72, 48], intelligence: [58, 30], defense: [66, 36] } },
};

const generatedLabels: Record<CapacityDomainId, [string, string, string]> = {
  government: ['Institutions et commandement', 'Appareil administratif', 'Réseaux d’arbitrage'],
  administration: ['Personnel et procédures', 'Réseau territorial', 'Outils et infrastructures'],
  diplomacy: ['Réseau extérieur', 'Influence et alliances', 'Expertise et coordination'],
  economy: ['Base productive', 'Instruments économiques', 'Infrastructures financières'],
  intelligence: ['Services et couverture', 'Analyse et moyens techniques', 'Coopérations et liaisons'],
  defense: ['Forces et doctrine', 'Industrie et équipements', 'Projection et soutien'],
};

const generatedCommitmentLabels: Record<CapacityDomainId, [string, string, string]> = {
  government: ['Arbitrages permanents', 'Politiques intérieures', 'Coordination extérieure'],
  administration: ['Services essentiels', 'Gestion territoriale', 'Contrôle et finances'],
  diplomacy: ['Relations prioritaires', 'Postes et organisations', 'Crises et négociations'],
  economy: ['Budget et monnaie', 'Emploi et protection sociale', 'Filières stratégiques'],
  intelligence: ['Sécurité intérieure', 'Veille extérieure', 'Dossiers sensibles'],
  defense: ['Disponibilité des forces', 'Maintenance et entraînement', 'Engagements extérieurs'],
};

const split = (total: number, ratios: [number, number]) => {
  const first = Math.round(total * ratios[0]);
  const second = Math.round(total * ratios[1]);
  return [first, second, total - first - second] as [number, number, number];
};

function generatedBaseline(name: string, context: string, values: CapacitySeed): CapacityBaseline {
  return Object.fromEntries((Object.keys(values) as CapacityDomainId[]).map((domain) => {
    const [maximum, committed] = values[domain];
    const maximumParts = split(maximum, [0.42, 0.33]);
    const committedParts = split(committed, [0.45, 0.3]);
    return [domain, {
      maximumFactors: generatedLabels[domain].map((label, index) => factor(label, maximumParts[index], `${name} : ${context}.`)),
      commitmentFactors: generatedCommitmentLabels[domain].map((label, index) => factor(label, committedParts[index], `${name} : activité permanente liée à ${label.toLocaleLowerCase('fr')}.`)),
    }];
  })) as CapacityBaseline;
}

export const firstLotCapacityBaselines: Record<string, CapacityBaseline> = Object.fromEntries(
  Object.entries(firstLotSeeds).map(([countryId, seed]) => [countryId, generatedBaseline(seed.name, seed.context, seed.values)]),
);

export const topTenCapacityBaselines: Record<string, CapacityBaseline> = {
  ...firstLotCapacityBaselines,
  FRA: france2000CapacityBaseline,
};

const additionalMajorSeeds: Record<string, { name: string; context: string; values: CapacitySeed }> = {
  ITA: { name: 'Italie', context: 'État industriel européen, coalitions changeantes et forte charge de dette publique', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  POL: { name: 'Pologne', context: 'État en transition, modernisation rapide et contraintes de sécurité à l’Est', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  NOR: { name: 'Norvège', context: 'Institutions solides, ressources énergétiques et faible profondeur démographique', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  DZA: { name: 'Algérie', context: 'Appareil sécuritaire important, dépendance aux hydrocarbures et transition politique inachevée', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  LBY: { name: 'Libye', context: 'État rentier fragmenté, institutions faibles et forte dépendance aux hydrocarbures', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  SAU: { name: 'Arabie saoudite', context: 'Monarchie rentière, ressources financières et appareil administratif concentré', values: { government: [55, 25], administration: [55, 28], diplomacy: [50, 22], economy: [55, 30], intelligence: [45, 20], defense: [55, 30] } },
  ZAF: { name: 'Afrique du Sud', context: 'Puissance régionale issue de la transition démocratique, avec industrie et inégalités fortes', values: { government: [60, 33], administration: [62, 36], diplomacy: [65, 29], economy: [62, 40], intelligence: [48, 23], defense: [53, 30] } },
  AUS: { name: 'Australie', context: 'Institutions stables, alliance américaine et économie de ressources tournée vers l’Asie', values: { government: [66, 30], administration: [74, 35], diplomacy: [72, 32], economy: [70, 37], intelligence: [62, 29], defense: [65, 33] } },
  TUR: { name: 'Turquie', context: 'État pivot, armée influente, coalition instable et économie exposée', values: { government: [66, 42], administration: [61, 42], diplomacy: [72, 39], economy: [64, 50], intelligence: [65, 41], defense: [78, 50] } },
  VNM: { name: 'Vietnam', context: 'Parti-État en industrialisation, appareil administratif mobilisé et moyens limités', values: { government: [62, 35], administration: [60, 37], diplomacy: [58, 27], economy: [61, 42], intelligence: [52, 28], defense: [62, 36] } },
  ESP: { name: 'Espagne', context: 'Monarchie parlementaire, convergence européenne et écarts territoriaux persistants', values: { government: [70, 35], administration: [68, 38], diplomacy: [68, 34], economy: [72, 42], intelligence: [58, 30], defense: [66, 36] } },
  MEX: { name: 'Mexique', context: 'Fédération en ouverture politique, intégration nord-américaine et sécurité intérieure lourde', values: { government: [68, 36], administration: [66, 38], diplomacy: [68, 32], economy: [70, 44], intelligence: [50, 24], defense: [62, 34] } },
};

export const allMajorCapacityBaselines: Record<string, CapacityBaseline> = {
  ...topTenCapacityBaselines,
  ...Object.fromEntries(Object.entries(additionalMajorSeeds).map(([countryId, seed]) => [countryId, generatedBaseline(seed.name, seed.context, seed.values)])),
};
