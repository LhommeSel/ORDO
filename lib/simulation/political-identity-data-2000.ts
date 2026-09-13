import type {
  CountryId,
  CountryLeadership,
  CountryState,
  DecisionSignal,
  LeadershipTraitProfile,
  PoliticalApparatusProfile,
} from './types';

type LeadershipOverride = {
  figures: CountryLeadership['figures'];
  executiveCoordination: number;
};

const traits = (
  riskAppetite: number,
  belligerence: number,
  flexibility: number,
  transactionality: number,
  patience: number,
  ideologicalCommitment: number,
  reliability: number,
): LeadershipTraitProfile => ({
  riskAppetite, belligerence, flexibility, transactionality, patience, ideologicalCommitment, reliability,
});

const leadershipOverrides: Partial<Record<CountryId, LeadershipOverride>> = {
  FRA: {
    executiveCoordination: 48,
    figures: [
      { id: 'fra-chirac-2000', name: 'Jacques Chirac', role: 'Président de la République', authorityShare: 44, ideologyTags: ['gaullisme', 'autonomie stratégique', 'centre droit'], traits: traits(52, 42, 64, 55, 62, 56, 67) },
      { id: 'fra-jospin-2000', name: 'Lionel Jospin', role: 'Premier ministre', authorityShare: 56, ideologyTags: ['social-démocratie', 'gauche plurielle', 'construction européenne'], traits: traits(39, 24, 55, 43, 70, 72, 78) },
    ],
  },
  DEU: {
    executiveCoordination: 78,
    figures: [{ id: 'deu-schroder-2000', name: 'Gerhard Schröder', role: 'Chancelier fédéral', authorityShare: 100, ideologyTags: ['social-démocratie réformatrice', 'européisme', 'atlantisme'], traits: traits(42, 25, 61, 68, 68, 58, 76) }],
  },
  ITA: {
    executiveCoordination: 61,
    figures: [
      { id: 'ita-ciampi-2000', name: 'Carlo Azeglio Ciampi', role: 'Président de la République', authorityShare: 30, ideologyTags: ['européisme', 'crédibilité monétaire', 'institutionnalisme'], traits: traits(30, 18, 64, 58, 79, 63, 86) },
      { id: 'ita-dalema-2000', name: 'Massimo D’Alema', role: 'Président du Conseil', authorityShare: 70, ideologyTags: ['centre gauche', 'réforme prudente', 'ancrage européen'], traits: traits(42, 27, 62, 65, 69, 57, 72) },
    ],
  },
  POL: {
    executiveCoordination: 64,
    figures: [
      { id: 'pol-kwasniewski-2000', name: 'Aleksander Kwaśniewski', role: 'Président de la République', authorityShare: 36, ideologyTags: ['social-démocratie', 'intégration euro-atlantique', 'pragmatisme'], traits: traits(46, 28, 69, 62, 71, 50, 75) },
      { id: 'pol-buzek-2000', name: 'Jerzy Buzek', role: 'Premier ministre', authorityShare: 64, ideologyTags: ['droite réformatrice', 'atlantisme', 'transition de marché'], traits: traits(48, 32, 55, 57, 62, 67, 69) },
    ],
  },
  ESP: {
    executiveCoordination: 82,
    figures: [{ id: 'esp-aznar-2000', name: 'José María Aznar', role: 'Président du gouvernement', authorityShare: 100, ideologyTags: ['conservatisme libéral', 'atlantisme', 'intégration européenne'], traits: traits(48, 42, 58, 70, 68, 72, 74) }],
  },
  NOR: {
    executiveCoordination: 74,
    figures: [{ id: 'nor-bondevik-2000', name: 'Kjell Magne Bondevik', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['centre droit', 'État-providence', 'atlantisme prudent'], traits: traits(32, 20, 61, 59, 81, 69, 84) }],
  },
  GBR: {
    executiveCoordination: 88,
    figures: [{ id: 'gbr-blair-2000', name: 'Tony Blair', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['troisième voie', 'atlantisme', 'interventionnisme'], traits: traits(66, 61, 65, 72, 57, 69, 72) }],
  },
  USA: {
    executiveCoordination: 82,
    figures: [{ id: 'usa-clinton-2000', name: 'Bill Clinton', role: 'Président', authorityShare: 100, ideologyTags: ['centrisme démocrate', 'libéralisme économique', 'internationalisme'], traits: traits(55, 39, 78, 80, 62, 48, 70) }],
  },
  CAN: {
    executiveCoordination: 84,
    figures: [{ id: 'can-chretien-2000', name: 'Jean Chrétien', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['libéralisme centriste', 'fédéralisme canadien', 'multilatéralisme'], traits: traits(34, 18, 68, 57, 75, 48, 82) }],
  },
  MEX: {
    executiveCoordination: 62,
    figures: [{ id: 'mex-zedillo-2000', name: 'Ernesto Zedillo', role: 'Président', authorityShare: 100, ideologyTags: ['transition démocratique', 'stabilité macroéconomique', 'souveraineté nord-américaine'], traits: traits(42, 28, 61, 65, 70, 58, 68) }],
  },
  RUS: {
    executiveCoordination: 62,
    figures: [{ id: 'rus-putin-2000', name: 'Vladimir Poutine', role: 'Président par intérim', authorityShare: 100, ideologyTags: ['centralisation', 'souverainisme', 'restauration de l’État'], traits: traits(70, 72, 45, 69, 76, 78, 61) }],
  },
  CHN: {
    executiveCoordination: 86,
    figures: [
      { id: 'chn-jiang-2000', name: 'Jiang Zemin', role: 'Secrétaire général et président', authorityShare: 58, ideologyTags: ['primauté du Parti', 'souveraineté', 'modernisation'], traits: traits(45, 45, 48, 58, 82, 91, 75) },
      { id: 'chn-zhu-2000', name: 'Zhu Rongji', role: 'Premier ministre', authorityShare: 42, ideologyTags: ['réforme économique', 'discipline administrative', 'ouverture commerciale'], traits: traits(50, 27, 55, 77, 84, 72, 82) },
    ],
  },
  DZA: {
    executiveCoordination: 58,
    figures: [
      { id: 'dza-bouteflika-2000', name: 'Abdelaziz Bouteflika', role: 'Président', authorityShare: 72, ideologyTags: ['réconciliation nationale', 'souverainisme', 'équilibre des clans'], traits: traits(49, 43, 57, 72, 70, 68, 58) },
      { id: 'dza-benbitour-2000', name: 'Ahmed Benbitour', role: 'Chef du gouvernement', authorityShare: 28, ideologyTags: ['gestion économique', 'réforme prudente'], traits: traits(34, 20, 55, 65, 73, 52, 72) },
    ],
  },
  LBY: {
    executiveCoordination: 72,
    figures: [{ id: 'lby-kadhafi-2000', name: 'Mouammar Kadhafi', role: 'Guide de la révolution', authorityShare: 100, ideologyTags: ['révolutionnaire', 'personnalisme', 'souverainisme'], traits: traits(84, 78, 31, 67, 45, 91, 28) }],
  },
  SAU: {
    executiveCoordination: 74,
    figures: [
      { id: 'sau-fahd-2000', name: 'Fahd ben Abdelaziz Al Saoud', role: 'Roi', authorityShare: 48, ideologyTags: ['continuité dynastique', 'conservatisme', 'alliance américaine'], traits: traits(32, 41, 43, 63, 78, 86, 73) },
      { id: 'sau-abdallah-2000', name: 'Abdallah ben Abdelaziz Al Saoud', role: 'Prince héritier et dirigeant opérationnel', authorityShare: 52, ideologyTags: ['prudence dynastique', 'réforme graduelle', 'sécurité régionale'], traits: traits(38, 46, 52, 61, 82, 77, 78) },
    ],
  },
  BRA: {
    executiveCoordination: 72,
    figures: [{ id: 'bra-cardoso-2000', name: 'Fernando Henrique Cardoso', role: 'Président', authorityShare: 100, ideologyTags: ['stabilisation monétaire', 'réforme libérale', 'multilatéralisme'], traits: traits(42, 25, 71, 68, 78, 62, 74) }],
  },
  ZAF: {
    executiveCoordination: 76,
    figures: [{ id: 'zaf-mbeki-2000', name: 'Thabo Mbeki', role: 'Président', authorityShare: 100, ideologyTags: ['consolidation démocratique', 'renaissance africaine', 'réduction des inégalités'], traits: traits(44, 30, 62, 62, 78, 72, 70) }],
  },
  AUS: {
    executiveCoordination: 86,
    figures: [{ id: 'aus-howard-2000', name: 'John Howard', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['libéralisme conservateur', 'alliance américaine', 'rigueur budgétaire'], traits: traits(48, 38, 52, 62, 76, 74, 78) }],
  },
  IND: {
    executiveCoordination: 68,
    figures: [{ id: 'ind-vajpayee-2000', name: 'Atal Bihari Vajpayee', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['nationalisme modéré', 'autonomie stratégique', 'ouverture graduelle'], traits: traits(58, 52, 61, 66, 76, 78, 72) }],
  },
  JPN: {
    executiveCoordination: 55,
    figures: [{ id: 'jpn-mori-2000', name: 'Yoshiro Mori', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['conservatisme PLD', 'alliance américaine', 'relance prudente'], traits: traits(38, 26, 48, 52, 65, 57, 48) }],
  },
  TUR: {
    executiveCoordination: 52,
    figures: [
      { id: 'tur-demirel-2000', name: 'Süleyman Demirel', role: 'Président', authorityShare: 38, ideologyTags: ['républicanisme', 'équilibre institutionnel', 'occidentalisme'], traits: traits(46, 42, 58, 68, 70, 64, 70) },
      { id: 'tur-ecevit-2000', name: 'Bülent Ecevit', role: 'Premier ministre', authorityShare: 62, ideologyTags: ['nationalisme de gauche', 'souveraineté', 'réforme prudente'], traits: traits(50, 55, 46, 52, 68, 74, 64) },
    ],
  },
  VNM: {
    executiveCoordination: 80,
    figures: [{ id: 'vnm-khai-2000', name: 'Phan Văn Khải', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['Đổi Mới', 'modernisation économique', 'primauté du Parti'], traits: traits(39, 28, 62, 63, 80, 84, 73) }],
  },
};

const doctrineSignals = (country: CountryState) => {
  const supported: DecisionSignal[] = ['commercial_deal'];
  const opposed: DecisionSignal[] = [];
  if (country.politics.doctrine.economic < -10) supported.push('state_control', 'redistribution');
  if (country.politics.doctrine.economic > 10) supported.push('market_liberalization');
  if (country.politics.doctrine.sovereignty > 35) supported.push('strategic_autonomy');
  else supported.push('alliance_cooperation');
  if (country.politics.doctrine.security > 45) supported.push('military_escalation');
  if (country.strategy.redLines.some((line) => /otan|alliance|atlant/i.test(line))) opposed.push('alliance_breach');
  opposed.push('elite_displacement');
  return { supported, opposed };
};

export function createLeadership2000(countries: Record<CountryId, CountryState>): Record<CountryId, CountryLeadership> {
  return Object.fromEntries(Object.values(countries).map((country) => {
    const override = leadershipOverrides[country.id];
    if (override) return [country.id, { countryId: country.id, ...override, sourceBasis: 'Interprétation de gameplay ORDO de la direction politique au 1er janvier 2000 ; valeurs non présentées comme mesures scientifiques.' } satisfies CountryLeadership];
    return [country.id, {
      countryId: country.id,
      figures: [{
        id: `${country.id.toLowerCase()}-leader-2000`,
        name: country.politics.headOfGovernment,
        role: country.politics.executive === country.politics.headOfGovernment ? 'Dirigeant exécutif' : 'Chef du gouvernement',
        authorityShare: 100,
        ideologyTags: [country.politics.governmentLabel],
        traits: traits(50, 45, 55, 55, 60, 60, 65),
      }],
      executiveCoordination: 70,
      sourceBasis: 'Profil provisoire dérivé de la situation institutionnelle du scénario 2000.',
    } satisfies CountryLeadership];
  }));
}

const apparatusLabels: Partial<Record<CountryId, [string, string]>> = {
  FRA: ['Haute administration républicaine et européenne', 'Majorité de gauche plurielle'],
  DEU: ['Culture ordolibérale et fédérale', 'Coalition sociale-démocrate et écologiste'],
  ITA: ['Bureaucratie d’État et réseaux économiques territoriaux', 'Coalition de centre gauche et partenaires parlementaires'],
  POL: ['Administration de transition et appareil de sécurité', 'Coalition AWS–UW et élites réformatrices'],
  ESP: ['Administration centrale et autonomies régionales', 'Majorité Partido Popular et élites économiques'],
  NOR: ['Administration consensuelle et institutions pétrolières', 'Coalition chrétienne-démocrate et partenaires centristes'],
  GBR: ['État permanent, atlantiste et financier', 'Majorité travailliste réformatrice'],
  USA: ['Établissement de sécurité et appareil fédéral', 'Congrès et coalition économique'],
  CAN: ['Fédéralisme administratif, bilinguisme et provinces', 'Majorité libérale fédérale et compromis territorial'],
  MEX: ['Fédéralisme présidentiel et appareil administratif national', 'PRI en transition, élites économiques et ouverture électorale'],
  RUS: ['Appareil sécuritaire et centralisateur', 'Réseaux économiques issus de la transition'],
  CHN: ['Parti-État et sécurité politique', 'Technocratie de modernisation économique'],
  DZA: ['Appareil militaire et sécuritaire', 'Technocratie présidentielle et réseaux économiques'],
  LBY: ['Réseaux révolutionnaires et sécuritaires', 'Réseaux tribaux et économiques'],
  SAU: ['Coalition dynastique et religieuse', 'Technocratie pétrolière et financière'],
  BRA: ['Fédéralisme administratif et coalition du centre', 'Congrès fragmenté et élites économiques'],
  ZAF: ['État constitutionnel post-apartheid', 'Mouvement national africain et coalition sociale'],
  AUS: ['Administration fédérale et alliance occidentale', 'Coalition libérale–nationale'],
  IND: ['Haute administration fédérale et appareil sécuritaire', 'Coalition nationale démocratique'],
  JPN: ['Bureaucraties économiques et réseau PLD', 'Coalition gouvernementale conservatrice'],
  TUR: ['État-major et appareil républicain', 'Coalition DSP–MHP–ANAP'],
  VNM: ['Parti-État et appareil sécuritaire', 'Technocratie du Đổi Mới'],
};

export function createPoliticalApparatus2000(countries: Record<CountryId, CountryState>): Record<CountryId, PoliticalApparatusProfile> {
  return Object.fromEntries(Object.values(countries).map((country) => {
    const signals = doctrineSignals(country);
    const labels = apparatusLabels[country.id] ?? ['Appareil administratif permanent', country.politics.governmentLabel];
    const firstWeight = country.politics.regime.toLowerCase().includes('parti unique') || country.politics.regime.toLowerCase().includes('autoritaire') ? 68 : 52;
    return [country.id, {
      countryId: country.id,
      currents: [
        {
          id: `${country.id.toLowerCase()}-apparatus-state`, label: labels[0], weight: firstWeight,
          institutionalReach: country.politics.administrativeCompliance,
          supportedSignals: signals.supported,
          opposedSignals: signals.opposed,
          criterionPreferences: { regime_survival: 82, strategic_autonomy: 72, social_cohesion: 68 },
        },
        {
          id: `${country.id.toLowerCase()}-apparatus-government`, label: labels[1], weight: 100 - firstWeight,
          institutionalReach: Math.max(35, country.politics.publicApproval),
          supportedSignals: [...signals.supported, country.politics.doctrine.economic < 0 ? 'redistribution' : 'market_liberalization'],
          opposedSignals: signals.opposed,
          criterionPreferences: { growth: 78, employment: 74, elite_support: 66, alliance_cohesion: 62 },
        },
      ],
      pluralism: Math.min(90, Math.max(10, 100 - firstWeight + (country.politics.governingSeats < country.politics.legislatureSeats * 0.6 ? 15 : 0))),
      inertia: Math.min(95, Math.max(30, country.politics.administrativeCompliance)),
      sourceBasis: 'Lignes institutionnelles de gameplay dérivées du régime et de la coalition au 1er janvier 2000.',
    } satisfies PoliticalApparatusProfile];
  }));
}
