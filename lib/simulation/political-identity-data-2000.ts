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
  GBR: {
    executiveCoordination: 88,
    figures: [{ id: 'gbr-blair-2000', name: 'Tony Blair', role: 'Premier ministre', authorityShare: 100, ideologyTags: ['troisième voie', 'atlantisme', 'interventionnisme'], traits: traits(66, 61, 65, 72, 57, 69, 72) }],
  },
  USA: {
    executiveCoordination: 82,
    figures: [{ id: 'usa-clinton-2000', name: 'Bill Clinton', role: 'Président', authorityShare: 100, ideologyTags: ['centrisme démocrate', 'libéralisme économique', 'internationalisme'], traits: traits(55, 39, 78, 80, 62, 48, 70) }],
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
  GBR: ['État permanent, atlantiste et financier', 'Majorité travailliste réformatrice'],
  USA: ['Établissement de sécurité et appareil fédéral', 'Congrès et coalition économique'],
  RUS: ['Appareil sécuritaire et centralisateur', 'Réseaux économiques issus de la transition'],
  CHN: ['Parti-État et sécurité politique', 'Technocratie de modernisation économique'],
  DZA: ['Appareil militaire et sécuritaire', 'Technocratie présidentielle et réseaux économiques'],
  LBY: ['Réseaux révolutionnaires et sécuritaires', 'Réseaux tribaux et économiques'],
  SAU: ['Coalition dynastique et religieuse', 'Technocratie pétrolière et financière'],
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
