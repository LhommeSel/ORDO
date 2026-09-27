import type { CountryId, CountryState, WorldState } from './types';

/**
 * Profil diplomatique de départ. Les intérêts privés ne sont jamais une
 * information d'interface : ils servent uniquement à faire varier la décision
 * du répondant et le texte de la contre-proposition.
 */
export type DiplomaticPosture = 'assertive' | 'transactional' | 'cautious' | 'cooperative' | 'revisionist' | 'non_aligned';
export type NegotiationStyle = 'firm' | 'legalistic' | 'transactional' | 'consensus' | 'patient' | 'coercive';
export type AlignmentDoctrine = 'bloc_leader' | 'bloc_member' | 'strategic_autonomy' | 'balancing' | 'non_aligned' | 'neutral' | 'revisionist';

export type DiplomaticProfile = {
  posture: DiplomaticPosture;
  negotiationStyle: NegotiationStyle;
  initialPosition: string;
  publicInterests: string[];
  privateInterests: string[];
  riskTolerance: number;
  escalationThreshold: number;
  /** Manière dont le pays articule alliances et liberté d'action. */
  alignmentDoctrine: AlignmentDoctrine;
  /** Coût politique d'une apparence de recul, notamment face à un rival plus faible. */
  statusSensitivity: number;
  /** Marge politique disponible pour accorder des concessions dans un même accord. */
  concessionBudget: number;
};

const profile = (
  posture: DiplomaticPosture,
  negotiationStyle: NegotiationStyle,
  initialPosition: string,
  publicInterests: string[],
  privateInterests: string[],
  riskTolerance: number,
  escalationThreshold: number,
  options: Partial<Pick<DiplomaticProfile, 'alignmentDoctrine' | 'statusSensitivity' | 'concessionBudget'>> = {},
): DiplomaticProfile => ({
  posture,
  negotiationStyle,
  initialPosition,
  publicInterests,
  privateInterests,
  riskTolerance,
  escalationThreshold,
  alignmentDoctrine: options.alignmentDoctrine
    ?? (posture === 'non_aligned' ? 'non_aligned' : posture === 'revisionist' ? 'revisionist' : posture === 'cooperative' ? 'bloc_member' : 'strategic_autonomy'),
  statusSensitivity: options.statusSensitivity ?? Math.min(82, Math.max(32, Math.round(44 + escalationThreshold * 0.32))),
  concessionBudget: options.concessionBudget ?? Math.min(72, Math.max(24, Math.round(66 - escalationThreshold * 0.34))),
});

/** Postures au 1er janvier 2000 pour les pays qui structurent les parties. */
export const DIPLOMATIC_PROFILES_2000: Partial<Record<CountryId, DiplomaticProfile>> = {
  FRA: profile('assertive', 'legalistic', 'Puissance européenne autonome, favorable aux compromis qui préservent sa liberté d’action.', ['Autonomie stratégique', 'Influence européenne', 'Accès commerciaux diversifiés'], ['Préserver le rôle des entreprises publiques', 'Éviter une dépendance stratégique aux États-Unis', 'Protéger la dissuasion nucléaire'], 54, 62, { alignmentDoctrine: 'strategic_autonomy', statusSensitivity: 70, concessionBudget: 44 }),
  DEU: profile('cautious', 'legalistic', 'Partenaire européen prudent : ouverture économique, mais discipline budgétaire et stabilité juridique.', ['Stabilité de l’euro', 'Marché européen', 'Prévisibilité juridique'], ['Limiter les transferts permanents', 'Éviter une crise de confiance financière', 'Préserver la coalition gouvernementale'], 35, 54),
  ITA: profile('transactional', 'transactional', 'Partenaire méditerranéen pragmatique, sensible aux bénéfices économiques et à la stabilité régionale.', ['Influence méditerranéenne', 'Croissance industrielle', 'Accès aux marchés'], ['Réduire la pression sur la dette', 'Obtenir des investissements visibles', 'Préserver les équilibres de coalition'], 58, 48),
  ESP: profile('cooperative', 'consensus', 'Partenaire européen et méditerranéen : recherche de coopération, d’investissements et de reconnaissance.', ['Développement méditerranéen', 'Intégration européenne', 'Sécurité énergétique'], ['Obtenir des retombées régionales', 'Éviter une marginalisation face à la France et l’Italie', 'Préserver la stabilité intérieure'], 47, 44),
  POL: profile('assertive', 'firm', 'État d’Europe centrale atlantiste, qui exige des garanties de sécurité crédibles.', ['Garantie américaine', 'Ancrage européen', 'Modernisation militaire'], ['Éviter toute zone grise avec Moscou', 'Obtenir un soutien matériel durable', 'Préserver la cohésion nationale'], 50, 42),
  GBR: profile('assertive', 'transactional', 'Puissance maritime et atlantique : coopération sélective, sans abandon de souveraineté.', ['Alliance atlantique', 'Influence maritime', 'Finance internationale'], ['Conserver une marge de manœuvre hors tutelle', 'Protéger la City', 'Éviter une intégration européenne irréversible'], 56, 52),
  NOR: profile('cooperative', 'consensus', 'Partenaire nordique prudent, ouvert à la coopération si elle reste transparente et compatible avec le droit.', ['Sécurité maritime', 'Ressources énergétiques', 'Droit international'], ['Protéger les revenus énergétiques', 'Éviter l’escalade arctique', 'Préserver le consensus social'], 32, 38),
  AUT: profile('cautious', 'legalistic', 'État neutre et européen : médiation possible, engagement militaire extérieur limité.', ['Neutralité', 'Commerce européen', 'Stabilité régionale'], ['Ne pas devenir une base arrière', 'Éviter les sanctions extraterritoriales', 'Préserver les équilibres sociaux'], 25, 40),
  GRC: profile('assertive', 'firm', 'État méditerranéen attaché à sa souveraineté maritime et à des garanties explicites.', ['Souveraineté maritime', 'Sécurité égéenne', 'Soutien européen'], ['Ne pas reconnaître de fait une revendication adverse', 'Obtenir un partage vérifiable des bénéfices', 'Éviter un isolement face à Ankara'], 46, 45, { alignmentDoctrine: 'bloc_member', statusSensitivity: 76, concessionBudget: 34 }),
  USA: profile('assertive', 'transactional', 'Puissance dominante : offre des garanties et des marchés, mais attend un alignement stratégique.', ['Crédibilité des alliances', 'Ouverture des marchés', 'Supériorité technologique'], ['Préserver la primauté du dollar', 'Éviter une coalition concurrente', 'Maintenir la liberté d’action militaire'], 70, 68, { alignmentDoctrine: 'bloc_leader', statusSensitivity: 82, concessionBudget: 48 }),
  RUS: profile('revisionist', 'coercive', 'Puissance en restauration, disposée à négocier des avantages mais hostile à tout recul stratégique imposé.', ['Profondeur stratégique', 'Influence postsoviétique', 'Ressources énergétiques'], ['Reconstruire une sphère d’influence', 'Préserver la continuité du régime', 'Éviter l’encerclement militaire'], 68, 74, { alignmentDoctrine: 'revisionist', statusSensitivity: 90, concessionBudget: 24 }),
  CHN: profile('revisionist', 'patient', 'Puissance montante : coopération économique patiente, refus net de toute coalition de containment.', ['Souveraineté territoriale', 'Industrialisation', 'Accès aux technologies'], ['Réduire les dépendances critiques', 'Conserver la stabilité du Parti', 'Éviter une reconnaissance internationale de Taïwan indépendant'], 42, 72, { alignmentDoctrine: 'revisionist', statusSensitivity: 88, concessionBudget: 30 }),
  IND: profile('non_aligned', 'transactional', 'Grande démocratie non alignée : coopération concrète, mais autonomie stratégique et réciprocité.', ['Autonomie stratégique', 'Développement industriel', 'Sécurité régionale'], ['Obtenir des transferts de technologie', 'Diversifier les fournisseurs', 'Éviter une dépendance à une seule alliance'], 55, 49, { alignmentDoctrine: 'non_aligned', statusSensitivity: 78, concessionBudget: 42 }),
  JPN: profile('cautious', 'legalistic', 'Puissance commerciale prudente, protégée par ses alliances et attachée à la stabilité régionale.', ['Sécurité maritime', 'Commerce asiatique', 'Alliance américaine'], ['Éviter une course aux armements incontrôlée', 'Sécuriser les chaînes industrielles', 'Maintenir le statu quo régional'], 28, 38),
  KOR: profile('cautious', 'transactional', 'État industriel sous contrainte de sécurité, ouvert aux garanties et aux partenariats technologiques.', ['Dissuasion conventionnelle', 'Export industriel', 'Alliance américaine'], ['Éviter une guerre péninsulaire', 'Préserver la compétitivité des conglomérats', 'Obtenir une marge diplomatique avec Pékin'], 40, 50),
  PRK: profile('revisionist', 'coercive', 'Régime fermé : concessions limitées, forte sensibilité à la survie politique et aux garanties.', ['Survie du régime', 'Autonomie militaire', 'Aide économique'], ['Obtenir des ressources sans contrôle extérieur', 'Exploiter les divergences entre grandes puissances', 'Préserver le monopole politique'], 73, 78),
  CAN: profile('cooperative', 'consensus', 'Partenaire nord-américain fiable, favorable aux règles communes et à la coopération continentale.', ['Marché nord-américain', 'Multilatéralisme', 'Ressources arctiques'], ['Éviter une dépendance asymétrique aux États-Unis', 'Protéger les provinces productrices', 'Préserver l’accès maritime'], 38, 40),
  TUR: profile('assertive', 'firm', 'Puissance charnière et troisième voie : membre de l’OTAN sans alignement automatique, elle entretient aussi ses canaux avec Moscou et refuse d’être ramenée au rang d’un acteur secondaire en Méditerranée orientale.', ['Influence régionale', 'Accès énergétique', 'Autonomie de défense', 'Liberté d’action entre l’OTAN et la Russie'], ['Éviter l’encerclement', 'Obtenir une reconnaissance de puissance régionale', 'Préserver la liberté d’action en mer Égée', 'Ne pas apparaître comme cédant à une pression grecque'], 63, 61, { alignmentDoctrine: 'balancing', statusSensitivity: 86, concessionBudget: 28 }),
  DZA: profile('assertive', 'firm', 'État souverain et rentier : coopération possible contre respect explicite du contrôle national des ressources.', ['Souveraineté énergétique', 'Stabilité intérieure', 'Partenariats méditerranéens'], ['Protéger la rente et les entreprises publiques', 'Éviter toute tutelle française', 'Financer la paix sociale'], 44, 64),
  SAU: profile('cautious', 'transactional', 'Monarchie énergétique : coopération pragmatique, garanties de sécurité et contrôle de la rente.', ['Sécurité du régime', 'Export énergétique', 'Partenariat américain'], ['Éviter une contestation interne', 'Maintenir le contrôle de la production', 'Obtenir une protection militaire crédible'], 48, 67),
  UKR: profile('assertive', 'legalistic', 'État en transition, attaché à son intégrité territoriale et à des garanties européennes.', ['Intégrité territoriale', 'Accès européen', 'Réforme institutionnelle'], ['Éviter une dépendance russe', 'Financer la transition économique', 'Conserver plusieurs canaux de sécurité'], 52, 47),
  IRN: profile('revisionist', 'firm', 'Puissance régionale autonome : coopération sélective, refus des tutelles et des conditions de régime.', ['Autonomie régionale', 'Industrie énergétique', 'Profondeur stratégique'], ['Contourner l’isolement', 'Préserver le régime', 'Monnayer les accès énergétiques et logistiques'], 62, 70),
  EGY: profile('cautious', 'transactional', 'État pivot : cherche des aides, des investissements et une stabilité régionale sans alignement total.', ['Stabilité régionale', 'Canal de Suez', 'Aide économique'], ['Préserver le contrôle militaire de l’État', 'Obtenir des financements', 'Éviter une contagion politique'], 45, 63),
  BRA: profile('non_aligned', 'consensus', 'Grande puissance régionale : autonomie diplomatique, développement et coopération sans bloc exclusif.', ['Développement industriel', 'Leadership sud-américain', 'Agriculture et énergie'], ['Éviter une dépendance aux États-Unis', 'Protéger les filières nationales', 'Préserver la stabilité fédérale'], 46, 45),
  ZAF: profile('non_aligned', 'consensus', 'Puissance régionale africaine : coopération multilatérale et autonomie post-apartheid.', ['Développement régional', 'Sécurité australe', 'Commerce minier'], ['Éviter une tutelle extérieure', 'Stabiliser la transition politique', 'Protéger les infrastructures minières'], 42, 48),
  AUS: profile('assertive', 'transactional', 'Allié régional : coopération de sécurité forte, mais protection des intérêts économiques et maritimes.', ['Alliance américaine', 'Sécurité indo-pacifique', 'Ressources minières'], ['Éviter une coercition chinoise', 'Préserver les exportations vers l’Asie', 'Maintenir la cohésion fédérale'], 55, 55),
  VNM: profile('cautious', 'patient', 'État souverain et commerçant : diversification des partenariats, refus de toute tutelle.', ['Souveraineté maritime', 'Industrialisation', 'Diversification des partenariats'], ['Éviter une dépendance chinoise', 'Préserver la stabilité du Parti', 'Attirer les investissements sans perdre le contrôle'], 38, 58),
  MEX: profile('non_aligned', 'transactional', 'Puissance nord-américaine autonome : coopération économique, non-intervention et contrôle des ressources.', ['Commerce continental', 'Souveraineté énergétique', 'Stabilité intérieure'], ['Limiter l’asymétrie avec Washington', 'Protéger les recettes publiques', 'Éviter une crise sociale'], 43, 51),
  MLI: profile('cautious', 'firm', 'État sahélien fragile : demande de sécurité et de respect de l’autorité nationale.', ['Intégrité territoriale', 'Sécurité intérieure', 'Aide au développement'], ['Éviter une tutelle militaire', 'Conserver le contrôle des ressources', 'Gérer les rivalités régionales'], 50, 59),
  NGA: profile('assertive', 'transactional', 'Puissance démographique et énergétique : partenariats ouverts, contrôle national des ressources.', ['Revenus énergétiques', 'Leadership régional', 'Industrialisation'], ['Réduire la captation de rente', 'Éviter les bases étrangères incontrôlées', 'Préserver l’unité fédérale'], 53, 56),
  IDN: profile('non_aligned', 'consensus', 'Archipel non aligné : coopération économique et maritime, sans abandon de souveraineté.', ['Unité territoriale', 'Commerce maritime', 'Développement industriel'], ['Éviter une polarisation sino-américaine', 'Protéger les ressources maritimes', 'Maintenir la cohésion de l’archipel'], 39, 50),
  SUR: profile('cautious', 'legalistic', 'Petit État : coopération possible uniquement avec contrôle national, garanties et bénéfices vérifiables.', ['Souveraineté territoriale', 'Développement des ressources', 'Sécurité maritime'], ['Éviter une exploitation prédatrice', 'Obtenir des recettes locales', 'Préserver l’autorité de Paramaribo'], 34, 53),
};

function fallbackProfile(country: CountryState): DiplomaticProfile {
  const authoritarian = /parti unique|republique populaire|communiste|junte|autoritaire|theocr|emirat|sultanat|monarchie absolue/i.test(country.politics.regime);
  const major = country.weight >= 75;
  const cautious = country.politics.doctrine.security >= 70 || country.politics.doctrine.sovereignty >= 75;
  const posture: DiplomaticPosture = authoritarian || major ? 'assertive' : cautious ? 'cautious' : 'cooperative';
  const negotiationStyle: NegotiationStyle = authoritarian ? 'firm' : cautious ? 'legalistic' : country.weight <= 30 ? 'consensus' : 'transactional';
  const publicInterests = country.strategy.goals.filter((goal) => goal.status === 'active').slice(0, 4).map((goal) => goal.label);
  const privateInterests = [...country.strategy.vulnerabilities, ...country.strategy.goals.filter((goal) => goal.status === 'active').map((goal) => `Progresser sur « ${goal.label} »`)].slice(0, 6);
  const alignmentDoctrine: AlignmentDoctrine = country.strategy.partners.length >= 3
    ? (major ? 'bloc_leader' : 'bloc_member')
    : country.strategy.partners.length === 0
      ? 'non_aligned'
      : country.strategy.rivals.length > 0
        ? 'balancing'
        : 'strategic_autonomy';
  return profile(
    posture,
    negotiationStyle,
    publicInterests.length ? `${country.name} protège ses intérêts nationaux et privilégie une coopération compatible avec sa souveraineté.` : `${country.name} examine les propositions au cas par cas, selon ses intérêts et ses garanties de sécurité.`,
    publicInterests.length ? publicInterests : ['Souveraineté nationale', 'Stabilité intérieure'],
    privateInterests.length ? privateInterests : ['Préserver la stabilité du régime', 'Obtenir des bénéfices vérifiables'],
    major ? 55 : country.weight <= 30 ? 35 : 45,
    authoritarian ? 66 : cautious ? 54 : 46,
    {
      alignmentDoctrine,
      statusSensitivity: Math.min(88, Math.round(38 + country.weight * 0.42 + country.politics.doctrine.sovereignty * 0.18)),
      concessionBudget: Math.max(22, Math.min(68, Math.round(64 - country.politics.doctrine.sovereignty * 0.28 - (major ? 6 : 0)))),
    },
  );
}

export function diplomaticProfileFor(state: WorldState, countryId: CountryId): DiplomaticProfile {
  const country = state.countries[countryId];
  return (countryId && DIPLOMATIC_PROFILES_2000[countryId]) || (country ? fallbackProfile(country) : profile('cautious', 'legalistic', 'Posture inconnue : demander des garanties et une clarification.', [], [], 35, 60));
}

export function diplomaticProfileStatement(state: WorldState, countryId: CountryId, includePrivate = true) {
  const country = state.countries[countryId];
  const current = diplomaticProfileFor(state, countryId);
  const name = country?.name ?? countryId;
  const publicPart = `${name}: posture initiale « ${current.initialPosition} » Style de négociation: ${current.negotiationStyle}; intérêts publics: ${current.publicInterests.join(', ') || 'non documentés'}.`;
  if (!includePrivate) return publicPart;
  return `${publicPart} Doctrine d’alignement: ${current.alignmentDoctrine}; sensibilité au statut ${current.statusSensitivity}/100; budget de concessions ${current.concessionBudget}/100. Raisons internes à ne pas révéler: ${current.privateInterests.join(', ') || 'aucune documentée'}. Tolérance au risque ${current.riskTolerance}/100; seuil d’escalade ${current.escalationThreshold}/100.`;
}
