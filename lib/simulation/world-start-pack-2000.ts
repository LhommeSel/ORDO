import type { WorldEvent } from './types';

/**
 * Faits déjà survenus lorsque la partie commence le 1er janvier 2000.
 * Ils donnent une mémoire immédiate au fil mondial sans ouvrir de décision.
 * Les dossiers évolutifs restent dans `world-dossier-arcs.ts`.
 */
export const worldEvents2000: WorldEvent[] = [
  {
    id: 'event-euro-accounting-launch',
    date: '1999-01-01',
    title: 'L’euro devient la monnaie de compte de onze États',
    summary: 'La monnaie unique entre dans sa phase scripturale. Les taux de change sont désormais irrévocablement fixés entre les pays participants, tandis que les billets et pièces restent à venir.',
    importance: 'major',
    scope: 'world',
    actorIds: ['EU', 'FRA', 'DEU', 'ITA', 'ESP'],
    source: 'historical',
  },
  {
    id: 'event-lahore-declaration',
    date: '1999-02-21',
    title: 'Delhi et Islamabad signent la déclaration de Lahore',
    summary: 'Après les essais nucléaires de 1998, l’Inde et le Pakistan ouvrent un canal de réduction des risques. La détente reste fragile et dépend d’un contrôle politique des tensions au Cachemire.',
    dossierId: 'world-south-asia-nuclear-stability',
    importance: 'moderate',
    scope: 'world',
    actorIds: ['IND', 'PAK', 'CHN', 'USA'],
    source: 'historical',
  },
  {
    id: 'event-kosovo-international-administration',
    date: '1999-06-10',
    title: 'Le Kosovo passe sous administration internationale',
    summary: 'La résolution 1244 installe une présence civile et militaire internationale. Le cessez-le-feu règle l’urgence immédiate, sans résoudre le statut du territoire ni le retour des populations.',
    dossierId: 'world-kosovo-settlement',
    importance: 'major',
    scope: 'world',
    actorIds: ['UN', 'NATO', 'SRB', 'ALB', 'USA', 'FRA', 'GBR'],
    source: 'historical',
  },
  {
    id: 'event-east-timor-intervention',
    date: '1999-09-20',
    title: 'Une force internationale intervient au Timor oriental',
    summary: 'L’INTERFET rétablit un minimum de sécurité après les violences qui suivent le référendum d’autodétermination. La transition vers une administration internationale devient le nouvel enjeu.',
    importance: 'moderate',
    scope: 'world',
    actorIds: ['UN', 'AUS', 'IDN', 'PRT'],
    source: 'historical',
  },
  {
    id: 'event-second-chechen-war',
    date: '1999-10-01',
    title: 'La guerre de Tchétchénie se prolonge',
    summary: 'L’offensive russe en Tchétchénie confirme la priorité donnée par Moscou à la restauration de l’autorité fédérale. Les conséquences humanitaires et sécuritaires dépassent rapidement le seul théâtre caucasien.',
    dossierId: 'world-russia-recentralization',
    importance: 'major',
    scope: 'world',
    actorIds: ['RUS', 'GEO'],
    source: 'historical',
  },
  {
    id: 'event-macau-handover',
    date: '1999-12-20',
    title: 'Macao revient sous souveraineté chinoise',
    summary: 'Le transfert de Macao clôt la dernière grande restitution coloniale en Asie orientale. Pékin consolide le principe « un pays, deux systèmes » tout en observant la réaction des acteurs régionaux.',
    importance: 'moderate',
    scope: 'world',
    actorIds: ['CHN', 'PRT', 'HKG'],
    source: 'historical',
  },
  {
    id: 'event-seattle-wto-protests',
    date: '1999-11-30',
    title: 'Les protestations de Seattle contestent la gouvernance commerciale',
    summary: 'La conférence ministérielle de l’OMC s’ouvre dans un climat de contestation sociale. Les chaînes de valeur s’étendent, mais leur légitimité politique devient un dossier à part entière.',
    dossierId: 'world-global-trade-legitimacy',
    importance: 'moderate',
    scope: 'world',
    actorIds: ['WTO', 'USA', 'EU', 'BRA', 'IND'],
    source: 'historical',
  },
  {
    id: 'event-putin-acting-president',
    date: '1999-12-31',
    title: 'Vladimir Poutine devient président par intérim de la Russie',
    summary: 'La démission de Boris Eltsine ouvre une transition présidentielle imprévisible. Le nouveau centre du pouvoir promet de restaurer l’autorité de l’État sans avoir encore défini le compromis avec les régions et les grands intérêts économiques.',
    dossierId: 'world-russia-recentralization',
    importance: 'major',
    scope: 'world',
    actorIds: ['RUS', 'USA', 'FRA', 'DEU', 'POL'],
    source: 'historical',
  },
  {
    id: 'event-panama-canal-transfer',
    date: '1999-12-31',
    title: 'Le canal de Panama passe sous contrôle panaméen',
    summary: 'Le transfert prévu par les traités Torrijos-Carter est achevé. Le canal devient un actif souverain majeur, avec des effets attendus sur le commerce, les investissements et la présence américaine dans la région.',
    importance: 'moderate',
    scope: 'world',
    actorIds: ['PAN', 'USA'],
    source: 'historical',
  },
  {
    id: 'event-y2k-transition',
    date: '2000-01-01',
    title: 'Le passage à l’an 2000 se fait sans rupture systémique',
    summary: 'Les principaux réseaux informatiques franchissent le changement de date sans panne mondiale. La confiance dans la continuité technique est préservée, mais la dépendance aux systèmes numériques devient visible comme enjeu stratégique.',
    importance: 'minor',
    scope: 'world',
    actorIds: ['USA', 'JPN', 'EU', 'CHN'],
    source: 'historical',
  },
];

export function createInitialWorldEvents2000() {
  return structuredClone(worldEvents2000);
}
