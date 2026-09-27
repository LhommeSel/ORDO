import { commitWorldAction } from './ledger';
import { seededUnit } from './random';
import type { DossierImportance, EconomicShock, StrategicDossier, WorldEffect, WorldState } from './types';

type WorldDossierBeat = {
  date: string;
  /** Fenêtre courte pour éviter que l’actualité ne tombe chaque partie au même mois. */
  varianceMonths?: number;
  phase: string;
  title: string;
  summary: string;
  trend?: StrategicDossier['trend'];
  importance?: DossierImportance;
  /** Un jalon peut affecter le prix seulement s'il décrit une contrainte matérielle explicite. */
  oilMarketShock?: Pick<EconomicShock, 'label' | 'channel' | 'intensity' | 'remainingMonths' | 'decayPerMonth'>;
};

type WorldDossierArc = {
  dossier: StrategicDossier;
  beats: WorldDossierBeat[];
};

const dossier = (
  id: string,
  title: string,
  kind: StrategicDossier['kind'],
  importance: DossierImportance,
  actorIds: string[],
  regionTags: string[],
  phase: string,
  publicSummary: string,
): StrategicDossier => ({
  id,
  title,
  kind,
  status: 'active',
  importance,
  actorIds,
  regionTags,
  scope: 'world',
  startedAt: '2000-01-01',
  updatedAt: '2000-01-01',
  phase,
  trend: 'stable',
  publicSummary,
  followed: false,
  autoTracked: true,
  commitments: [],
  pendingDecisions: [],
  relatedCurrentIds: [],
  relatedActionIds: [],
  entries: [{
    id: `${id}-opening`,
    date: '2000-01-01',
    title: 'Situation ouverte',
    summary: publicSummary,
    importance,
    actorIds,
    requiresDecision: false,
    visibility: 'public',
  }],
});

/**
 * Les grands dossiers déjà perceptibles en 2000. Ils ne sont pas des
 * scénarios écrits : les jalons décrivent l'actualité qui les fait évoluer,
 * puis le moteur et les décisions des États déterminent leurs suites.
 */
const arcs: WorldDossierArc[] = [
  {
    dossier: dossier('world-russia-recentralization', 'Recomposition du pouvoir russe', 'power_struggle', 'moderate', ['RUS', 'USA', 'FRA', 'DEU', 'POL'], ['Europe', 'Eurasie'], 'Transition présidentielle', 'L’arrivée de Vladimir Poutine ouvre une période de reprise en main de l’État fédéral, dont l’ampleur reste incertaine.'),
    beats: [
      { date: '2000-03-01', phase: 'Reprise en main de l’appareil fédéral', title: 'Le Kremlin redessine ses relais régionaux', summary: 'Moscou renforce ses leviers sur les régions et prépare une chaîne de commandement plus verticale.', trend: 'escalating' },
      { date: '2000-06-01', phase: 'Arbitrage avec les grands intérêts', title: 'Les oligarques et les gouverneurs testent la nouvelle présidence', summary: 'Le pouvoir central cherche à imposer ses priorités sans encore disposer d’un contrôle complet sur les élites économiques.', trend: 'escalating', importance: 'major' },
    ],
  },
  {
    dossier: dossier('world-southern-africa-consultation', 'Concertation économique et sécuritaire en Afrique australe', 'cooperation', 'moderate', ['ZAF', 'NAM', 'BWA', 'MOZ', 'ZWE'], ['Afrique australe'], 'Consultations régionales', 'Pretoria cherche à stabiliser son voisinage par des échanges réguliers sur le commerce, les infrastructures et la sécurité.'),
    beats: [
      { date: '2000-04-01', phase: 'Priorités régionales consolidées', title: 'Pretoria met commerce et sécurité à la même table', summary: 'Les partenaires d’Afrique australe rapprochent leurs agendas de transit, de sécurité frontalière et d’intégration économique.' },
      { date: '2000-08-01', phase: 'Mise à l’épreuve des engagements', title: 'Les divergences régionales limitent la vitesse de l’intégration', summary: 'Les intérêts nationaux et les fragilités politiques imposent des compromis graduels plutôt qu’une intégration automatique.', trend: 'stable' },
    ],
  },
  {
    dossier: dossier('world-central-asia-transit', 'Hydrocarbures et corridors d’Asie centrale', 'economic', 'moderate', ['KAZ', 'UZB', 'TKM', 'RUS', 'CHN', 'TUR'], ['Asie centrale', 'Eurasie'], 'Compétition pour les routes de transit', 'Les États producteurs et leurs voisins évaluent les voies d’exportation capables de transformer leurs réserves en influence durable.'),
    beats: [
      { date: '2000-04-01', phase: 'Cartographie des corridors concurrents', title: 'Les États d’Asie centrale coordonnent hydrocarbures et transit', summary: 'Les exportateurs confrontent leurs besoins d’accès aux marchés aux dépendances créées par les réseaux existants.', trend: 'escalating' },
      { date: '2000-09-01', phase: 'Négociations d’accès et de financement', title: 'Les grands voisins se positionnent sur les corridors', summary: 'Russie, Chine et Turquie proposent des priorités différentes ; aucun axe ne s’impose sans contreparties politiques et financières.' },
    ],
  },
  {
    dossier: dossier('world-eastern-europe-choice', 'Ancrage occidental de l’Europe centrale', 'cooperation', 'moderate', ['POL', 'CZE', 'HUN', 'ROU', 'BGR', 'DEU', 'FRA', 'RUS'], ['Europe', 'Eurasie'], 'Préparation des rapprochements européens', 'Les capitales d’Europe centrale cherchent des garanties économiques et sécuritaires, tandis que Moscou mesure le recul de son influence.'),
    beats: [
      { date: '2000-05-01', phase: 'Demandes d’ancrage précisées', title: 'Les candidats à l’élargissement accélèrent leur préparation', summary: 'Réformes, normes et coopérations de sécurité deviennent des instruments de rapprochement avec l’Union et ses partenaires.', trend: 'escalating' },
      { date: '2000-10-01', phase: 'Réaction stratégique russe', title: 'Moscou met en garde contre un nouvel équilibre européen', summary: 'La Russie accepte difficilement la perte de profondeur stratégique, sans que cela ne ferme encore les voies de coopération.', trend: 'escalating', importance: 'major' },
    ],
  },
  {
    dossier: dossier('world-middle-east-peace', 'Processus de paix israélo-palestinien', 'diplomatic_crisis', 'moderate', ['ISR', 'PSE', 'USA', 'EGY', 'JOR', 'FRA'], ['Moyen-Orient'], 'Négociation sous forte pression', 'Les interlocuteurs tentent de transformer les accords existants en règlement politique, alors que les questions de souveraineté restent entières.'),
    beats: [
      { date: '2000-05-01', phase: 'Préparation d’une séquence de négociation', title: 'Les médiateurs cherchent un format de discussion décisif', summary: 'Statut de Jérusalem, frontières et sécurité demeurent incompatibles à ce stade, mais aucun acteur ne veut encore assumer l’échec.', trend: 'escalating' },
      { date: '2000-09-01', phase: 'Confiance politique érodée', title: 'Le processus de paix entre dans une phase de forte instabilité', summary: 'Les compromis deviennent plus difficiles à défendre à l’intérieur des deux sociétés ; le risque de rupture augmente.', trend: 'escalating', importance: 'major' },
    ],
  },
  {
    dossier: dossier('world-oil-market-balance', 'Équilibre du marché pétrolier mondial', 'economic', 'moderate', ['SAU', 'RUS', 'USA', 'CHN', 'IND', 'FRA'], ['Moyen-Orient', 'Eurasie', 'Monde'], 'Offre contrainte face à la reprise mondiale', 'La reprise économique renforce la demande de pétrole alors que les producteurs arbitrent entre recettes immédiates et stabilité des prix.'),
    beats: [
      { date: '2000-03-01', phase: 'Production et prix sous surveillance', title: 'Les producteurs évaluent la hausse de la demande mondiale', summary: 'Les niveaux de production deviennent un enjeu de coordination entre producteurs aux intérêts pourtant divergents.', trend: 'escalating' },
      {
        date: '2000-07-01', phase: 'Arbitrage entre recettes et stabilité', title: 'Les producteurs maintiennent une offre volontairement contrainte',
        summary: 'Le maintien de la discipline de production réduit la marge disponible face à la reprise mondiale. Les importateurs anticipent une hausse graduelle du baril.',
        importance: 'major',
        oilMarketShock: { label: 'Discipline de production des exportateurs', channel: 'energy', intensity: 30, remainingMonths: 5, decayPerMonth: 0.14 },
      },
    ],
  },
  {
    dossier: dossier('world-strategic-defense-debate', 'Débat sur les défenses antimissiles et l’équilibre stratégique', 'security', 'moderate', ['USA', 'RUS', 'CHN', 'FRA', 'GBR'], ['Amérique du Nord', 'Europe', 'Asie de l’Est'], 'Révision des équilibres de dissuasion', 'Les projets américains de défense antimissile relancent le débat sur la stabilité nucléaire et les traités de limitation.'),
    beats: [
      { date: '2000-06-01', phase: 'Pression sur les cadres de maîtrise des armements', title: 'Washington remet les défenses antimissiles au centre du débat', summary: 'Moscou et Pékin craignent qu’une nouvelle architecture ne réduise la prévisibilité de la dissuasion stratégique.', trend: 'escalating' },
      { date: '2000-11-01', phase: 'Recherche de garanties stratégiques', title: 'Les puissances nucléaires réclament des clarifications', summary: 'Les échanges portent sur doctrine et vérification ; aucun compromis technique ne règle à lui seul le désaccord politique.' },
    ],
  },
  {
    dossier: dossier('world-kosovo-settlement', 'Stabilisation internationale du Kosovo', 'security', 'moderate', ['UN', 'NATO', 'SRB', 'ALB', 'USA', 'FRA', 'GBR'], ['Europe', 'Balkans'], 'Administration internationale et retour des réfugiés', 'La présence internationale a stoppé l’urgence militaire, mais la sécurité quotidienne, le statut du territoire et le retour des populations restent liés.'),
    beats: [
      { date: '2000-03-01', phase: 'Sécurisation des enclaves et reconstruction', title: 'La KFOR tente de contenir les représailles', summary: 'Les forces internationales protègent les communautés les plus exposées tandis que l’administration civile cherche à relancer les services essentiels.', trend: 'stable' },
      { date: '2000-09-01', phase: 'Statut politique toujours suspendu', title: 'Le statut du Kosovo reste repoussé', summary: 'Les capitales privilégient une autonomie administrée à une décision finale, au risque de prolonger les tensions et la dépendance internationale.', trend: 'escalating', importance: 'major' },
    ],
  },
  {
    dossier: dossier('world-global-trade-legitimacy', 'Règles du commerce mondial et légitimité de l’OMC', 'economic', 'moderate', ['USA', 'EU', 'CHN', 'JPN', 'IND', 'BRA', 'WTO'], ['Monde', 'Amérique du Nord', 'Asie de l’Est', 'Europe'], 'Ouverture commerciale sous contestation', 'L’intégration des marchés accélère les échanges, mais les États émergents et les sociétés civiles contestent la répartition des gains et la transparence des règles.'),
    beats: [
      { date: '2000-02-01', phase: 'Réouverture des négociations commerciales', title: 'Les membres cherchent une méthode après Seattle', summary: 'Les grandes puissances tentent de restaurer un agenda de négociation sans ignorer les demandes de transparence, de développement et de normes sociales.', trend: 'stable' },
      { date: '2000-10-01', phase: 'Coalitions de négociation concurrentes', title: 'Les pays émergents coordonnent leurs demandes', summary: 'Inde, Brésil et partenaires du Sud cherchent à peser sur l’agenda agricole et industriel face aux offres américaines et européennes.', trend: 'escalating', importance: 'major' },
    ],
  },
  {
    dossier: dossier('world-south-asia-nuclear-stability', 'Stabilité nucléaire en Asie du Sud', 'security', 'moderate', ['IND', 'PAK', 'CHN', 'USA'], ['Asie du Sud'], 'Dissuasion récente et canaux de crise', 'L’Inde et le Pakistan disposent désormais d’une dissuasion déclarée, mais leurs forces, doctrines et mécanismes de notification restent incomplets.'),
    beats: [
      { date: '2000-04-01', phase: 'Mise en place de garde-fous bilatéraux', title: 'Delhi et Islamabad testent leurs canaux de crise', summary: 'Les échanges militaires et diplomatiques cherchent à empêcher un incident frontalier de devenir une crise nucléaire.', trend: 'stable' },
      { date: '2000-08-01', phase: 'Pression du Cachemire', title: 'Le Cachemire limite les bénéfices de la détente', summary: 'La rivalité territoriale et les violences indirectes réduisent la portée des engagements de Lahore sans fermer totalement la voie du dialogue.', trend: 'escalating', importance: 'major' },
    ],
  },
  {
    dossier: dossier('world-east-asia-security-balance', 'Équilibre stratégique en Asie orientale', 'security', 'moderate', ['CHN', 'TWN', 'USA', 'JPN', 'KOR'], ['Asie de l’Est', 'Pacifique'], 'Dissuasion et ambiguïté autour de Taïwan', 'La montée du poids chinois rencontre les garanties américaines et les inquiétudes japonaises et taïwanaises ; chaque acteur cherche à éviter une crise qu’il ne pourrait contrôler.'),
    beats: [
      { date: '2000-03-01', phase: 'Élection taïwanaise et signaux militaires', title: 'Pékin prépare sa réponse à l’élection taïwanaise', summary: 'La transition politique à Taipei incite la Chine à combiner avertissements publics et maintien d’un espace de négociation.', trend: 'escalating' },
      { date: '2000-11-01', phase: 'Réassurance alliée et modernisation', title: 'Washington et Tokyo renforcent leurs consultations', summary: 'Les alliés discutent de surveillance, de défense antimissile et de chaînes logistiques sans formaliser un nouveau bloc régional.', trend: 'stable' },
    ],
  },
  {
    dossier: dossier('world-great-lakes-stabilization', 'Stabilisation des Grands Lacs africains', 'conflict', 'moderate', ['COD', 'RWA', 'UGA', 'AGO', 'ZAF', 'UN'], ['Afrique centrale', 'Afrique australe'], 'Désengagement régional incomplet', 'Les accords de Lusaka ouvrent une voie de désescalade, mais les groupes armés, les ressources et les intérêts des voisins maintiennent une forte inertie de conflit.'),
    beats: [
      { date: '2000-05-01', phase: 'Mise en œuvre inégale des accords', title: 'Les mécanismes de cessez-le-feu peinent à vérifier les retraits', summary: 'Les observateurs internationaux et les gouvernements régionaux manquent de moyens pour contrôler simultanément les frontières et les groupes armés.', trend: 'stable' },
      { date: '2000-12-01', phase: 'Risque de conflit gelé', title: 'La paix reste suspendue aux garanties régionales', summary: 'Les acteurs privilégient un compromis minimal qui réduit les combats ouverts sans traiter les causes politiques et économiques de la guerre.', trend: 'deescalating' },
    ],
  },
  {
    dossier: dossier('world-japan-recovery', 'Sortie de stagnation du Japon', 'economic', 'moderate', ['JPN', 'USA', 'CHN', 'KOR'], ['Asie de l’Est', 'Pacifique'], 'Relance sous contrainte démographique', 'Le Japon cherche à sortir de la stagnation et de la déflation sans perdre sa base industrielle, alors que la crise asiatique a fragilisé ses débouchés régionaux.'),
    beats: [
      { date: '2000-04-01', phase: 'Relance et réforme bancaire', title: 'Tokyo arbitre entre soutien conjoncturel et nettoyage financier', summary: 'Le gouvernement cherche à soutenir la demande tout en réduisant les créances douteuses qui bloquent le crédit et l’investissement.', trend: 'stable' },
      { date: '2000-10-01', phase: 'Compétition industrielle asiatique', title: 'La reprise chinoise accentue la pression sur les industriels japonais', summary: 'Les entreprises accélèrent leur réorganisation et leurs investissements technologiques tandis que Tokyo débat du rythme des réformes.', trend: 'escalating' },
    ],
  },
];

export function createInitialWorldDossiers2000() {
  return Object.fromEntries(arcs.map((arc) => [arc.dossier.id, structuredClone(arc.dossier)]));
}

function addMonths(date: string, offset: number) {
  const [year, month] = date.slice(0, 7).split('-').map(Number);
  const absoluteMonth = year * 12 + month - 1 + offset;
  return `${Math.floor(absoluteMonth / 12)}-${String((absoluteMonth % 12) + 1).padStart(2, '0')}-01`;
}

function dueDate(state: WorldState, dossierId: string, beat: WorldDossierBeat) {
  const variance = beat.varianceMonths ?? 2;
  const offset = Math.floor(seededUnit(state.seed, `${dossierId}:${beat.date}`) * (variance + 1));
  return addMonths(beat.date, offset);
}

/** Ajoute un fait lorsqu'un dossier atteint une étape, une seule fois. */
export function advanceWorldDossierArcs(state: WorldState) {
  let next = state;
  for (const arc of arcs) {
    const dossier = next.strategicDossiers[arc.dossier.id];
    if (!dossier || dossier.status === 'resolved') continue;
    for (const beat of arc.beats) {
      const entryId = `arc-${dossier.id}-${beat.date}`;
      if (next.currentDate < dueDate(next, dossier.id, beat) || dossier.entries.some((entry) => entry.id === entryId)) continue;
      const effects: WorldEffect[] = [
        {
          kind: 'dossier_patch',
          dossierId: dossier.id,
          patch: {
            phase: beat.phase,
            publicSummary: beat.summary,
            trend: beat.trend ?? dossier.trend,
            importance: beat.importance ?? dossier.importance,
            updatedAt: next.currentDate,
          },
          reason: 'Un jalon mondial fait évoluer la phase du dossier.',
          visibility: 'public',
        },
        {
          kind: 'dossier_entry_add',
          dossierId: dossier.id,
          entry: {
            id: entryId,
            date: next.currentDate,
            title: beat.title,
            summary: beat.summary,
            importance: beat.importance ?? dossier.importance,
            actorIds: dossier.actorIds,
            requiresDecision: false,
            visibility: 'public',
          },
          reason: 'Le jalon est ajouté à la chronologie mondiale.',
          visibility: 'public',
        },
      ];
      if (beat.oilMarketShock) {
        const shock: EconomicShock = {
          id: `oil-market-beat-${beat.date}`,
          ...beat.oilMarketShock,
          affectedCountryIds: [],
          productFamily: 'energy',
          source: 'historical',
        };
        effects.push({
          kind: 'world_economy_patch',
          patch: {
            activeShocks: [...next.worldEconomy.activeShocks.filter((item) => item.id !== shock.id), shock],
          },
          reason: `Le jalon « ${beat.title} » introduit une contrainte pétrolière explicitement décrite dans le marché mondial.`,
          visibility: 'debug',
        });
      }
      next = commitWorldAction(next, {
        kind: 'historical',
        actorId: next.playerCountryId,
        targetIds: dossier.actorIds.filter((id) => id !== next.playerCountryId),
        origin: 'historical',
        visibility: 'public',
        intent: `Faire évoluer le dossier mondial « ${dossier.title} »`,
        effects,
      });
    }
  }
  return next;
}
