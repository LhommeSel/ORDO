'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  Factory,
  Flag,
  Gauge,
  Handshake,
  Eye,
  Landmark,
  Newspaper,
  Radio,
  Radar,
  RefreshCcw,
  Send,
  Shield,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DiplomacySheet,
  type DiplomaticEventState,
  type ResolutionChannel,
} from '@/components/diplomacy-sheet';
import { TimeAdvanceDialog } from '@/components/time-advance-dialog';
import { WorldMap, type MapMode } from '@/components/world-map';

type Country = {
  id: string;
  name: string;
  flag: string;
  role: string;
  relation: number;
  trust: number;
  posture: string;
  color: string;
  interests: string[];
  redLines: string[];
  military: MilitaryProfile;
};

type MilitaryProfile = {
  potential: number;
  access: number;
  personnel: string;
  readiness: number;
  projection: number;
  logistics: number;
  industry: number;
  ground: number;
  air: number;
  naval: number;
  strengths: string[];
};

type Message = {
  id: number;
  author: 'player' | 'foreign';
  text: string;
  meta?: string;
};

type HistoricalEvent = {
  id: string;
  title: string;
  realDate: string;
  score: number;
  verdict: 'REJOUABLE' | 'À ADAPTER' | 'ÉCARTÉ';
  source: string;
  sourceUrl: string;
  historicalOutcome: string;
  divergence: string;
  adaptation: string;
};

type AdvisorChoice = {
  id: string;
  title: string;
  detail: string;
  recommended?: boolean;
  effects: {
    budget: number;
    stability: number;
    security: number;
  };
};

type CapacityDomainId = 'government' | 'administration' | 'diplomacy' | 'economy' | 'intelligence' | 'defense';

type CapacityState = Record<CapacityDomainId, { maximum: number; committed: number }>;

type InstitutionStage = 'proposal' | 'building' | 'partial' | 'operational';

type AdvisorProposal = {
  title: string;
  urgency: string;
  reason: string;
  signals: string[];
  choices: AdvisorChoice[];
};

const countries: Country[] = [
  {
    id: 'deu', name: 'Allemagne', flag: '🇩🇪', role: 'Partenaire économique majeur', relation: 68, trust: 61,
    posture: 'Prudente', color: 'var(--signal-blue)',
    interests: ['Stabilité de l’euro', 'Élargissement de l’Union', 'Industrie exportatrice'],
    redLines: ['Mutualisation durable des dettes', 'Découplage entre défense européenne et OTAN'],
    military: { potential: 64, access: 88, personnel: '330–350 k', readiness: 68, projection: 46, logistics: 72, industry: 82, ground: 72, air: 67, naval: 43, strengths: ['Base industrielle', 'Logistique OTAN'] },
  },
  {
    id: 'ita', name: 'Italie', flag: '🇮🇹', role: 'Partenaire méditerranéen', relation: 57, trust: 53,
    posture: 'Opportuniste', color: 'var(--signal-green)',
    interests: ['Convergence dans la zone euro', 'Politique méditerranéenne', 'Flexibilité budgétaire'],
    redLines: ['Austérité imposée', 'Marginalisation méditerranéenne'],
    military: { potential: 52, access: 80, personnel: '270–300 k', readiness: 58, projection: 52, logistics: 57, industry: 61, ground: 52, air: 56, naval: 68, strengths: ['Flotte méditerranéenne', 'Aéronautique'] },
  },
  {
    id: 'pol', name: 'Pologne', flag: '🇵🇱', role: 'Puissance du flanc oriental', relation: 44, trust: 39,
    posture: 'Méﬁante', color: 'var(--signal-red)',
    interests: ['Adhésion à l’Union européenne', 'Modernisation militaire', 'Souveraineté nationale'],
    redLines: ['Pression politique russe', 'Affaiblissement des garanties de l’OTAN'],
    military: { potential: 39, access: 52, personnel: '180–260 k', readiness: 48, projection: 25, logistics: 40, industry: 47, ground: 66, air: 41, naval: 18, strengths: ['Masse terrestre', 'Profondeur stratégique'] },
  },
  {
    id: 'usa', name: 'États-Unis', flag: '🇺🇸', role: 'Allié stratégique', relation: 73, trust: 66,
    posture: 'Exigeante', color: 'var(--signal-gold)',
    interests: ['Stabilité des Balkans', 'Cohésion de l’OTAN', 'Commerce transatlantique'],
    redLines: ['Défense européenne concurrente de l’OTAN', 'Protectionnisme technologique'],
    military: { potential: 94, access: 69, personnel: '1,3–1,5 M', readiness: 89, projection: 100, logistics: 97, industry: 98, ground: 89, air: 100, naval: 100, strengths: ['Projection mondiale', 'Supériorité aéronavale'] },
  },
];

const initialMessages: Record<string, Message[]> = {
  deu: [{ id: 1, author: 'foreign', text: 'Monsieur le Président, Berlin veut consolider l’euro et préparer l’élargissement. Toute initiative française devra préserver la discipline commune et la compétitivité industrielle.', meta: 'Chancellerie fédérale · gouvernement Schröder' }],
  ita: [{ id: 2, author: 'foreign', text: 'Rome souhaite que la nouvelle Europe monétaire reste aussi méditerranéenne et sociale. Nous examinerons toute proposition mêlant croissance, infrastructures et coopération régionale.', meta: 'Palais Chigi · gouvernement D’Alema' }],
  pol: [{ id: 3, author: 'foreign', text: 'Notre entrée dans l’OTAN est acquise ; notre priorité est désormais l’Union européenne. Varsovie attend un calendrier politique et des investissements concrets.', meta: 'Chancellerie du Premier ministre Buzek' }],
  usa: [{ id: 4, author: 'foreign', text: 'Washington reste ouvert à vos propositions. Nous jugerons leur effet sur l’OTAN, la stabilité des Balkans et l’ouverture du commerce transatlantique.', meta: 'Administration Clinton · Conseil de sécurité nationale' }],
};

const events = [
  { status: 'POSITION ATTENDUE', title: 'Faiblesse de l’euro face au dollar', detail: 'Berlin demande une coordination avant la prochaine réunion de l’Eurogroupe.', tone: 'danger', diplomaticEventId: 'euro-coordination' },
  { status: 'ÉMERGENT', title: 'Sommet européen de Lisbonne', detail: 'Fenêtre de préparation : 3 mois.', tone: 'warning' },
  { status: 'SURVEILLANCE', title: 'Élection présidentielle russe', detail: 'Le scrutin anticipé est prévu le 26 mars.', tone: 'neutral' },
];

const initialDiplomaticEvents: DiplomaticEventState[] = [
  {
    id: 'euro-coordination',
    title: 'Coordination franco-allemande sur l’euro',
    summary: 'Berlin attend une position française. Vous pouvez discuter, agir directement, déléguer ou choisir de ne pas répondre.',
    countryId: 'deu',
    requirement: 'position_required',
    deadlineLabel: 'AVANT FIN JANVIER',
    deadline: '2000-01-31',
    allowedChannels: ['dialogue', 'government_action', 'economic_action', 'multilateral_channel', 'delegation', 'explicit_silence'],
    resolved: false,
  },
];

const simulationStops = [
  { id: 'russian-election', date: '2000-03-26', title: 'Élection présidentielle russe', candidateId: 'russian-election' },
  { id: 'lisbon-summit', date: '2000-03-23', title: 'Conseil européen extraordinaire de Lisbonne', candidateId: 'lisbon-strategy' },
  { id: 'dotcom-correction', date: '2000-04-14', title: 'Correction des valeurs technologiques', candidateId: 'dotcom-correction' },
];

const historicalCandidates: HistoricalEvent[] = [
  {
    id: 'lisbon-strategy',
    title: 'Conseil européen extraordinaire de Lisbonne',
    realDate: '23–24 mars 2000',
    score: 92,
    verdict: 'REJOUABLE',
    source: 'Parlement européen · Conclusions de Lisbonne',
    sourceUrl: 'https://www.europarl.europa.eu/summits/lis1_fr.htm',
    historicalOutcome: 'L’Union adopte une stratégie décennale centrée sur l’emploi, la réforme économique et l’économie de la connaissance.',
    divergence: 'Les institutions, les gouvernements et la préparation du sommet restent proches de la situation historique.',
    adaptation: 'Maintenir le sommet, mais recalculer ses objectifs et son niveau d’ambition selon les coalitions construites par le joueur.',
  },
  {
    id: 'russian-election',
    title: 'Élection présidentielle anticipée en Russie',
    realDate: '26 mars 2000',
    score: 84,
    verdict: 'À ADAPTER',
    source: 'OSCE/BIDDH · Mission d’observation électorale',
    sourceUrl: 'https://odihr.osce.org/odihr/elections/russia/115757',
    historicalOutcome: 'Le scrutin anticipé du 26 mars installe Vladimir Poutine à la présidence russe.',
    divergence: 'L’élection reste certaine, mais le rapport de la France à Moscou peut modifier la campagne et les premières orientations diplomatiques.',
    adaptation: 'Conserver le scrutin tout en faisant varier le résultat, la participation et la doctrine étrangère du nouveau pouvoir.',
  },
  {
    id: 'dotcom-correction',
    title: 'Retournement des valeurs technologiques',
    realDate: 'Mars–avril 2000',
    score: 67,
    verdict: 'À ADAPTER',
    source: 'FMI · Marchés de capitaux internationaux',
    sourceUrl: 'https://www.elibrary.imf.org/display/book/9781557759498/ch02.xml',
    historicalOutcome: 'Le Nasdaq atteint un sommet en mars, puis la correction américaine se propage aux marchés européens.',
    divergence: 'Les valorisations restent élevées, mais les investissements et réglementations technologiques du joueur modifient l’exposition française.',
    adaptation: 'Créer une correction d’intensité variable plutôt qu’un krach obligatoire, avec des secteurs gagnants et perdants.',
  },
];

const advisorProposal: AdvisorProposal = {
  title: 'Positionner la France dans l’économie numérique européenne',
  urgency: 'DÉCISION CONSEILLÉE · AVANT LISBONNE',
  reason: 'La technologie et la réforme du marché européen dominent l’agenda du début de l’année 2000, tandis que les valorisations deviennent fragiles.',
  signals: ['Sommet de Lisbonne dans 3 mois', 'Valeurs technologiques proches d’un sommet', 'Euro sous pression face au dollar'],
  choices: [
    {
      id: 'public-investment',
      title: 'A — Grand plan numérique public',
      detail: 'Équipe les écoles et les administrations, avec un coût budgétaire immédiat.',
      effects: { budget: -10, stability: 4, security: 1 },
    },
    {
      id: 'european-coalition',
      title: 'B — Coalition numérique européenne',
      detail: 'Coordonne télécoms, recherche et règles communes avec Berlin et Rome.',
      recommended: true,
      effects: { budget: -5, stability: 2, security: 3 },
    },
    {
      id: 'prudence',
      title: 'C — Prudence budgétaire',
      detail: 'Attend la correction des marchés avant d’engager de nouveaux crédits.',
      effects: { budget: 4, stability: -2, security: 0 },
    },
  ],
};

const capacityCatalog: Array<{ id: CapacityDomainId; label: string; short: string }> = [
  { id: 'government', label: 'Gouvernement', short: 'GOUV.' },
  { id: 'administration', label: 'Administration', short: 'ADMIN.' },
  { id: 'diplomacy', label: 'Diplomatie', short: 'DIPLO.' },
  { id: 'economy', label: 'Économie et commerce', short: 'ÉCON.' },
  { id: 'intelligence', label: 'Renseignement', short: 'RENS.' },
  { id: 'defense', label: 'Défense', short: 'DÉF.' },
];

const initialCapacities: CapacityState = {
  government: { maximum: 68, committed: 31 },
  administration: { maximum: 72, committed: 42 },
  diplomacy: { maximum: 64, committed: 36 },
  economy: { maximum: 62, committed: 39 },
  intelligence: { maximum: 55, committed: 30 },
  defense: { maximum: 70, committed: 43 },
};

function generateReply(country: Country, text: string) {
  const normalized = text.toLowerCase();
  if (/commerce|douan|industrie|invest|économ/.test(normalized)) {
    return {
      text: `${country.name} accepte d’ouvrir une négociation formelle. Nous proposons une réduction tarifaire réciproque limitée aux secteurs industriels stratégiques, avec une clause de révision après douze mois.`,
      treaty: true,
    };
  }
  if (/alliance|militaire|défense|otan|armée/.test(normalized)) {
    return {
      text: `Nous comprenons l’objectif sécuritaire, mais un engagement automatique franchirait l’une de nos lignes rouges. ${country.name} pourrait toutefois examiner un mécanisme de consultation et des exercices conjoints.`,
      treaty: false,
    };
  }
  if (/énergie|gaz|nucléaire|électricité/.test(normalized)) {
    return {
      text: `La sécurité énergétique est une priorité commune. ${country.name} demande des volumes, un calendrier et une répartition précise des investissements avant de prendre position.`,
      treaty: false,
    };
  }
  return {
    text: `Votre proposition a été transmise aux ministères concernés. ${country.name} souhaite connaître le coût, le calendrier et les garanties que la France est prête à engager.`,
    treaty: false,
  };
}

export default function Home() {
  const [selectedId, setSelectedId] = useState('deu');
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [currentDate, setCurrentDate] = useState('2000-01-01');
  const [timeAdvanceOpen, setTimeAdvanceOpen] = useState(false);
  const [processedSimulationStops, setProcessedSimulationStops] = useState<string[]>([]);
  const [simulationNotice, setSimulationNotice] = useState('Simulation active au 1er janvier 2000.');
  const [pendingTreaty, setPendingTreaty] = useState(false);
  const [activeTreaty, setActiveTreaty] = useState(false);
  const [budget, setBudget] = useState(246);
  const [industry, setIndustry] = useState(100);
  const [stability, setStability] = useState(68);
  const [security, setSecurity] = useState(54);
  const [isThinking, setIsThinking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState('09:00');
  const [selectedCandidateId, setSelectedCandidateId] = useState('lisbon-strategy');
  const [queuedEventId, setQueuedEventId] = useState<string | null>(null);
  const [advisorChoiceId, setAdvisorChoiceId] = useState<string | null>(null);
  const [intelBoost, setIntelBoost] = useState<Record<string, number>>({});
  const [capacities, setCapacities] = useState<CapacityState>(initialCapacities);
  const [institutionStage, setInstitutionStage] = useState<InstitutionStage>('proposal');
  const [institutionMonths, setInstitutionMonths] = useState(0);
  const [institutionNotice, setInstitutionNotice] = useState('Projet disponible : créer un sous-ministère à la Prospérité.');
  const [mapMode, setMapMode] = useState<MapMode>('diplomacy');
  const [selectedMapId, setSelectedMapId] = useState('FRA');
  const [selectedMapName, setSelectedMapName] = useState('France');
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [diplomaticEvents, setDiplomaticEvents] = useState(initialDiplomaticEvents);
  const [activeDiplomaticEventId, setActiveDiplomaticEventId] = useState<string | null>(null);
  const [diplomaticNotice, setDiplomaticNotice] = useState('Une position française est attendue sur la faiblesse de l’euro.');
  const [diplomaticImpacts, setDiplomaticImpacts] = useState<Record<string, { relation: number; trust: number }>>({});
  const [diplomaticMemories, setDiplomaticMemories] = useState<Record<string, string[]>>({});

  const selected = useMemo(() => countries.find((country) => country.id === selectedId) ?? countries[0], [selectedId]);
  const selectedCandidate = historicalCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? historicalCandidates[0];
  const intelConfidence = Math.min(95, Math.round((selected.relation * 0.25) + (selected.trust * 0.25) + (selected.military.access * 0.5) + (intelBoost[selected.id] ?? 0)));
  const militaryUncertainty = intelConfidence >= 75 ? 3 : intelConfidence >= 55 ? 8 : 15;
  const selectedMapCountry = countries.find((country) => country.id.toUpperCase() === selectedMapId);
  const mapMetrics = Object.fromEntries(countries.map((country) => {
    const impact = diplomaticImpacts[country.id] ?? { relation: 0, trust: 0 };
    if (mapMode === 'military') return [country.id.toUpperCase(), country.military.potential];
    if (mapMode === 'intelligence') return [country.id.toUpperCase(), Math.round(((country.relation + impact.relation) * 0.25) + ((country.trust + impact.trust) * 0.25) + (country.military.access * 0.5))];
    return [country.id.toUpperCase(), country.relation + impact.relation];
  }));
  const currentMessages = messages[selectedId] ?? [];
  const activeDiplomaticEvent = diplomaticEvents.find((event) => event.id === activeDiplomaticEventId);
  const selectedDiplomaticImpact = diplomaticImpacts[selected.id] ?? { relation: 0, trust: 0 };
  const selectedDiplomaticCountry = { ...selected, relation: Math.max(0, Math.min(100, selected.relation + selectedDiplomaticImpact.relation)), trust: Math.max(0, Math.min(100, selected.trust + selectedDiplomaticImpact.trust)) };
  const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${currentDate}T12:00:00Z`));

  const chooseCountry = (id: string) => {
    setSelectedId(id);
    setPendingTreaty(false);
    setDraft('');
  };

  const rememberDiplomaticChoice = (countryId: string, memory: string) => {
    setDiplomaticMemories((current) => ({ ...current, [countryId]: [memory, ...(current[countryId] ?? [])].slice(0, 5) }));
  };

  const applyDiplomaticImpact = (countryId: string, relation: number, trust: number) => {
    setDiplomaticImpacts((current) => ({
      ...current,
      [countryId]: {
        relation: (current[countryId]?.relation ?? 0) + relation,
        trust: (current[countryId]?.trust ?? 0) + trust,
      },
    }));
  };

  const resolveDiplomaticEvent = (channel: ResolutionChannel, targetEvent = activeDiplomaticEvent) => {
    if (!targetEvent || targetEvent.resolved) return;
    if (channel === 'dialogue') {
      setDraft(`La France souhaite ouvrir une discussion directe concernant « ${targetEvent.title} ». Nous sommes prêts à exposer notre position et à examiner une réponse coordonnée.`);
      setDiplomaticNotice('Discussion préparée : envoyez votre position pour résoudre l’événement par le dialogue.');
      return;
    }

    const resolutionCopy: Record<Exclude<ResolutionChannel, 'dialogue'>, { player: string; foreign: string; notice: string; relation: number; trust: number; memory: string; load: number }> = {
      government_action: {
        player: 'La France traitera cette question par une décision gouvernementale. Une position publique sera annoncée sans négociation bilatérale préalable.',
        foreign: 'Berlin prend acte de votre décision. Nous en évaluerons le contenu concret avant de déterminer notre propre position.',
        notice: 'Événement réglé par une décision gouvernementale.', relation: 0, trust: 0, load: 3,
        memory: 'La France a privilégié une décision gouvernementale à une négociation directe sur l’euro.',
      },
      economic_action: {
        player: 'La France répondra par des mesures économiques vérifiables et communiquera leurs résultats par les canaux techniques.',
        foreign: 'Nous jugerons cette réponse sur ses effets. Une coordination politique aurait toutefois facilité la convergence.',
        notice: 'Événement réglé par une mesure économique.', relation: 0, trust: -1, load: 3,
        memory: 'La France a répondu par une mesure économique plutôt que par un échange politique.',
      },
      multilateral_channel: {
        player: 'La France préfère poursuivre cet échange par les canaux diplomatiques habituels et dans le cadre de l’Eurogroupe.',
        foreign: 'Nous acceptons ce cadre, même si Berlin aurait préféré une clarification bilatérale plus rapide.',
        notice: 'Événement réglé par un canal multilatéral.', relation: 0, trust: -1, load: 2,
        memory: 'La France a redirigé la discussion vers l’Eurogroupe.',
      },
      delegation: {
        player: 'Cette question sera traitée par notre ministère des Affaires étrangères. Il vous transmettra une réponse officielle.',
        foreign: 'La chancellerie attendra la réponse de votre ministère et maintient ses services disponibles.',
        notice: 'Événement délégué au ministère des Affaires étrangères.', relation: 0, trust: 0, load: 1,
        memory: 'La présidence française a délégué la réponse à son ministère.',
      },
      explicit_silence: {
        player: 'Votre communication a bien été reçue. La France ne souhaite pas faire de commentaire supplémentaire.',
        foreign: 'Berlin interprète cette absence de position comme un refus de coordination dans une période monétaire sensible.',
        notice: 'Silence diplomatique enregistré : la relation et la confiance diminuent.', relation: -4, trust: -5, load: 0,
        memory: 'La France a choisi de ne pas répondre substantiellement à la demande allemande sur l’euro.',
      },
    };
    const outcome = resolutionCopy[channel];
    setDiplomaticEvents((current) => current.map((event) => event.id === targetEvent.id ? { ...event, resolved: true, resolvedBy: channel } : event));
    setMessages((current) => ({
      ...current,
      [targetEvent.countryId]: [...(current[targetEvent.countryId] ?? []),
        { id: Date.now(), author: 'player', text: outcome.player, meta: 'Réponse officielle française' },
        { id: Date.now() + 1, author: 'foreign', text: outcome.foreign, meta: 'Réaction diplomatique · mémoire enregistrée' },
      ],
    }));
    applyDiplomaticImpact(targetEvent.countryId, outcome.relation, outcome.trust);
    rememberDiplomaticChoice(targetEvent.countryId, outcome.memory);
    if (outcome.load) setCapacities((current) => applyCapacityChanges(current, { diplomacy: outcome.load }));
    setDiplomaticNotice(outcome.notice);
  };

  const sendMessage = async () => {
    const clean = draft.trim();
    if (!clean || isThinking) return;
    const playerMessage: Message = { id: Date.now(), author: 'player', text: clean, meta: 'Présidence de la République française' };
    setMessages((current) => ({ ...current, [selectedId]: [...(current[selectedId] ?? []), playerMessage] }));
    setDraft('');
    setIsThinking(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const reply = generateReply(selected, clean);
    setMessages((current) => ({
      ...current,
      [selectedId]: [...(current[selectedId] ?? []), { id: Date.now() + 1, author: 'foreign', text: reply.text, meta: `${selected.name} · réponse confidentielle` }],
    }));
    setPendingTreaty(reply.treaty);
    if (reply.treaty) {
      setCapacities((current) => applyCapacityChanges(current, { diplomacy: 5, economy: 7 }));
    }
    if (activeDiplomaticEvent && !activeDiplomaticEvent.resolved && activeDiplomaticEvent.countryId === selectedId) {
      setDiplomaticEvents((current) => current.map((event) => event.id === activeDiplomaticEvent.id ? { ...event, resolved: true, resolvedBy: 'dialogue' } : event));
      applyDiplomaticImpact(selectedId, 1, 2);
      rememberDiplomaticChoice(selectedId, `La France a ouvert un échange direct pour traiter « ${activeDiplomaticEvent.title} ».`);
      setDiplomaticNotice('Événement réglé par un échange direct. La réponse est mémorisée dans la relation.');
    }
    setIsThinking(false);
  };

  const ratifyTreaty = () => {
    setPendingTreaty(false);
    setActiveTreaty(true);
    setCapacities((current) => applyCapacityChanges(current, { government: 6, administration: 8, economy: 5 }));
    setMessages((current) => ({
      ...current,
      [selectedId]: [...(current[selectedId] ?? []), { id: Date.now(), author: 'foreign', text: 'Le protocole commercial est ratifié. Il entrera en vigueur au début du mois prochain.', meta: 'Accord enregistré · effet mécanique confirmé' }],
    }));
  };

  const advanceSimulation = (requestedTarget: string) => {
    const directExchangeBlocker = diplomaticEvents
      .filter((event) => !event.resolved && event.requirement === 'direct_exchange_required')
      .filter((event) => event.deadline > currentDate && event.deadline <= requestedTarget)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    const majorStop = simulationStops
      .filter((stop) => !processedSimulationStops.includes(stop.id) && stop.date > currentDate && stop.date <= requestedTarget)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    const stopCandidates = [
      majorStop ? { date: majorStop.date, kind: 'major' as const } : null,
      directExchangeBlocker ? { date: directExchangeBlocker.deadline, kind: 'diplomatic' as const } : null,
    ].filter(Boolean) as Array<{ date: string; kind: 'major' | 'diplomatic' }>;
    const firstStop = stopCandidates.sort((a, b) => a.date.localeCompare(b.date))[0];
    const reachedDate = firstStop?.date ?? requestedTarget;
    const elapsedDays = Math.max(0, Math.round((new Date(`${reachedDate}T12:00:00Z`).getTime() - new Date(`${currentDate}T12:00:00Z`).getTime()) / 86_400_000));
    const elapsedMonths = elapsedDays / 30.44;

    diplomaticEvents
      .filter((event) => !event.resolved && event.requirement !== 'direct_exchange_required' && event.deadline > currentDate && event.deadline <= reachedDate)
      .forEach((event) => resolveDiplomaticEvent('explicit_silence', event));

    setCurrentDate(reachedDate);
    setTimeAdvanceOpen(false);
    if (activeTreaty) setIndustry((value) => Number((value + 0.6 * elapsedMonths).toFixed(1)));

    if ((institutionStage === 'building' || institutionStage === 'partial') && elapsedMonths > 0) {
      const previousMonth = institutionMonths;
      const nextMonth = Math.min(7, previousMonth + elapsedMonths);
      setInstitutionMonths(nextMonth);
      setBudget((value) => Number((value - 0.02 * elapsedMonths).toFixed(2)));
      if (previousMonth < 3 && nextMonth >= 3) {
        setInstitutionStage('partial');
        setCapacities((current) => ({ ...current, economy: { ...current.economy, maximum: current.economy.maximum + 4 } }));
        setInstitutionNotice('Le sous-ministère est partiellement opérationnel : capacité économique +4.');
      }
      if (previousMonth < 7 && nextMonth >= 7) {
        setInstitutionStage('operational');
        setCapacities((current) => {
          const expanded = { ...current, economy: { ...current.economy, maximum: current.economy.maximum + 5 } };
          return applyCapacityChanges(expanded, { government: -4, administration: -8, economy: -3 });
        });
        setInstitutionNotice('Institution pleinement opérationnelle : capacité économique totale +9, charge de transition libérée.');
      }
    }

    if (firstStop?.kind === 'diplomatic' && directExchangeBlocker) {
      setActiveDiplomaticEventId(directExchangeBlocker.id);
      chooseCountry(directExchangeBlocker.countryId);
      setDiplomacyOpen(true);
      setSimulationNotice(`Simulation interrompue le ${formatSimulationDate(reachedDate)} : une réponse diplomatique directe est exigée.`);
      return;
    }
    if (firstStop?.kind === 'major' && majorStop) {
      setProcessedSimulationStops((current) => [...current, majorStop.id]);
      setSelectedCandidateId(majorStop.candidateId);
      setSimulationNotice(`Simulation interrompue le ${formatSimulationDate(reachedDate)} : ${majorStop.title}.`);
      return;
    }
    setSimulationNotice(`Simulation avancée jusqu’au ${formatSimulationDate(reachedDate)}. Les effets continus ont été calculés proportionnellement.`);
  };

  const scanHistoricalSources = async () => {
    if (isScanning) return;
    setIsScanning(true);
    await new Promise((resolve) => setTimeout(resolve, 850));
    setLastScan(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setIsScanning(false);
  };

  const applyAdvisorChoice = (choice: AdvisorChoice) => {
    if (advisorChoiceId) return;
    setAdvisorChoiceId(choice.id);
    setBudget((value) => value + choice.effects.budget);
    setStability((value) => Math.max(0, Math.min(100, value + choice.effects.stability)));
    setSecurity((value) => Math.max(0, Math.min(100, value + choice.effects.security)));
    setCapacities((current) => applyCapacityChanges(current, { government: 4, administration: 5, economy: 6 }));
  };

  const reinforceIntelligence = () => {
    if ((intelBoost[selected.id] ?? 0) >= 20) return;
    setCapacities((current) => applyCapacityChanges(current, { intelligence: 6 }));
    setIntelBoost((current) => ({ ...current, [selected.id]: Math.min(20, (current[selected.id] ?? 0) + 12) }));
  };

  const createProsperityMinistry = () => {
    if (institutionStage !== 'proposal' || budget < 0.42) return;
    setBudget((value) => Number((value - 0.42).toFixed(2)));
    setInstitutionStage('building');
    setInstitutionMonths(0);
    setCapacities((current) => applyCapacityChanges(current, { government: 4, administration: 8, economy: 3 }));
    setInstitutionNotice('Décret publié : recrutement et transfert des compétences en cours. Aucun gain immédiat.');
  };

  const selectMapCountry = (id: string, name: string) => {
    setSelectedMapId(id);
    setSelectedMapName(name);
    const known = countries.find((country) => country.id.toUpperCase() === id);
    if (known) chooseCountry(known.id);
  };

  const openDiplomaticWindow = (countryId = selectedId, eventId: string | null = null) => {
    chooseCountry(countryId);
    setActiveDiplomaticEventId(eventId);
    setDiplomacyOpen(true);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-5 px-5 py-4 lg:px-8">
          <div className="mr-auto flex items-center gap-3">
            <div className="grid size-10 place-items-center border border-primary/30 bg-primary/10 text-primary"><Landmark className="size-5" /></div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground">SIMULATION GÉOPOLITIQUE</p>
              <h1 className="font-heading text-lg font-medium tracking-[0.05em]">ORDO <span className="text-primary">/ ALPHA</span></h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs">
            <Metric icon={CalendarDays} label="CALENDRIER" value={date} />
            <Metric icon={CircleDollarSign} label="BUDGET" value={`${budget} Md€`} delta="+1,2" />
            <Metric icon={Factory} label="INDUSTRIE" value={`${industry}`} delta={activeTreaty ? '+0,6' : 'stable'} />
            <Metric icon={Gauge} label="STABILITÉ" value={`${stability}`} />
            <Metric icon={Shield} label="SÉCURITÉ" value={`${security}`} />
          </div>
          <Button variant="outline" onClick={() => openDiplomaticWindow()} className="h-10 rounded-none border-border px-4 font-mono text-xs">
            <Radio className="size-3.5" /> DIPLOMATIE
          </Button>
          <Button onClick={() => setTimeAdvanceOpen(true)} className="h-10 rounded-none px-5 font-mono text-xs tracking-[0.08em]">AVANCER LA SIMULATION <ChevronRight /></Button>
        </div>
        <div className="simulation-notice"><Clock3 className="size-3.5" /><span>{simulationNotice}</span></div>
      </header>

      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto grid max-w-[1600px] gap-px bg-border lg:grid-cols-3">
          {events.map((event) => {
            const diplomaticEvent = event.diplomaticEventId ? diplomaticEvents.find((item) => item.id === event.diplomaticEventId) : undefined;
            return (
            <article key={event.title} className="bg-background px-5 py-3.5 lg:px-8">
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.14em]"><span className={`event-dot ${event.tone}`} /><span className="text-muted-foreground">{event.status}</span></div>
              <p className="text-sm font-medium">{event.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
              {diplomaticEvent && (
                <button
                  type="button"
                  className={`event-diplomacy-button ${diplomaticEvent.resolved ? 'resolved' : ''}`}
                  onClick={() => openDiplomaticWindow(diplomaticEvent.countryId, diplomaticEvent.id)}
                >
                  {diplomaticEvent.resolved ? `TRAITÉ · ${resolutionLabel(diplomaticEvent.resolvedBy)}` : 'CHOISIR UNE RÉPONSE'} <ChevronRight />
                </button>
              )}
            </article>
          );})}
        </div>
        <div className="diplomatic-notice"><Radio className="size-3.5" /><span>{diplomaticNotice}</span></div>
      </section>

      <section className="strategic-map-shell">
        <div className="mx-auto max-w-[1600px] px-4 py-5 xl:px-8">
          <section className="dossier-panel">
            <div className="map-header">
              <div className="mr-auto"><p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">CENTRE DE COMMANDEMENT · 1er JANVIER 2000</p><h2 className="text-base font-medium">Carte stratégique mondiale</h2></div>
              <div className="map-mode-switch" aria-label="Mode cartographique">
                {(['diplomacy', 'intelligence', 'military'] as MapMode[]).map((mode) => <button key={mode} type="button" onClick={() => setMapMode(mode)} aria-pressed={mapMode === mode}>{mode === 'diplomacy' ? 'DIPLOMATIE' : mode === 'intelligence' ? 'RENSEIGNEMENT' : 'MILITAIRE'}</button>)}
              </div>
            </div>
            <div className="map-command-layout">
              <WorldMap mode={mapMode} metrics={mapMetrics} selectedId={selectedMapId} onSelect={selectMapCountry} />
              <aside className="map-dossier" aria-live="polite">
                <p className="font-mono text-[9px] tracking-[0.14em] text-primary">PAYS SÉLECTIONNÉ</p>
                <h3 className="mt-1 text-xl font-medium">{selectedMapName}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{selectedMapId === 'FRA' ? 'Votre État · République française' : selectedMapId === 'YUG' ? 'État fédéral · configuration historique' : selectedMapId === 'SDN' ? 'État souverain · territoire unifié en 2000' : selectedMapCountry?.role ?? 'Dossier diplomatique disponible'}</p>
                <div className="map-facts">
                  <MapFact label="RELATION" value={selectedMapId === 'FRA' ? '—' : selectedMapCountry ? `${selectedMapCountry.relation}/100` : 'Non évaluée'} />
                  <MapFact label="RENSEIGNEMENT" value={selectedMapCountry ? `${Math.round((selectedMapCountry.relation * 0.25) + (selectedMapCountry.trust * 0.25) + (selectedMapCountry.military.access * 0.5))}%` : selectedMapId === 'FRA' ? 'Complet' : 'Fragmentaire'} />
                  <MapFact label="PUISSANCE MILITAIRE" value={selectedMapCountry ? `${selectedMapCountry.military.potential}/100` : selectedMapId === 'FRA' ? 'État de référence' : 'À estimer'} />
                  <MapFact label="STATUT EN 2000" value={selectedMapId === 'YUG' || selectedMapId === 'SDN' ? 'Frontière historique' : 'Reconnu'} />
                </div>
                {selectedMapCountry ? <Button onClick={() => openDiplomaticWindow(selectedMapCountry.id)} className="h-9 w-full rounded-none font-mono text-[10px]">OUVRIR LA FENÊTRE DIPLOMATIQUE</Button> : <p className="border border-dashed border-border px-3 py-2 text-[10px] leading-4 text-muted-foreground">Cliquez sur n’importe quel pays pour l’identifier. Les quatre interlocuteurs déjà modélisés disposent d’un dossier complet ; les autres seront alimentés par la base mondiale.</p>}
                <div className="map-legend"><span><i className="player" />France</span><span><i className="high" />Fort / fiable</span><span><i className="medium" />Intermédiaire</span><span><i className="low" />Faible / incertain</span></div>
              </aside>
            </div>
          </section>
        </div>
      </section>

      <section className="intelligence-shell">
        <div className="mx-auto max-w-[1600px] px-4 py-5 xl:px-8">
          <div className="intelligence-grid">
            <section className="dossier-panel min-w-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
                <Newspaper className="size-4 text-primary" />
                <div className="mr-auto">
                  <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">OBSERVATOIRE HISTORIQUE</p>
                  <h2 className="text-sm font-medium">Événements réels candidats</h2>
                </div>
                <span className="source-status"><Database className="size-3" /> 3 SOURCES OFFICIELLES</span>
                <Button variant="outline" onClick={() => void scanHistoricalSources()} disabled={isScanning} className="h-8 rounded-none border-border px-3 font-mono text-[10px]">
                  <RefreshCcw className={`size-3 ${isScanning ? 'animate-spin' : ''}`} /> {isScanning ? 'ANALYSE…' : 'RÉANALYSER'}
                </Button>
              </div>

              <div className="historical-layout">
                <div className="divide-y divide-border border-r border-border">
                  {historicalCandidates.map((candidate) => (
                    <button key={candidate.id} type="button" onClick={() => setSelectedCandidateId(candidate.id)} className={`historical-row ${selectedCandidateId === candidate.id ? 'selected' : ''}`}>
                      <span className={`plausibility-score ${candidate.score >= 75 ? 'high' : candidate.score >= 45 ? 'medium' : 'low'}`}>{candidate.score}%</span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="mb-1 flex items-center gap-2 font-mono text-[9px] tracking-[0.08em] text-muted-foreground"><Clock3 className="size-3" /> {candidate.realDate}</span>
                        <span className="block text-sm font-medium leading-5">{candidate.title}</span>
                      </span>
                      <span className={`verdict ${candidate.verdict === 'REJOUABLE' ? 'replay' : candidate.verdict === 'À ADAPTER' ? 'adapt' : 'reject'}`}>{candidate.verdict}</span>
                    </button>
                  ))}
                </div>

                <article className="event-analysis">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="font-mono text-[9px] tracking-[0.12em] text-primary">COMPARAISON RÉALITÉ ↔ PARTIE</p><h3 className="mt-1 text-base font-medium">{selectedCandidate.title}</h3></div>
                    <span className="score-badge">{selectedCandidate.score}% PLAUSIBLE</span>
                  </div>
                  <AnalysisLine label="DANS LA RÉALITÉ" text={selectedCandidate.historicalOutcome} />
                  <AnalysisLine label="ÉCART DANS LA PARTIE" text={selectedCandidate.divergence} />
                  <AnalysisLine label="VERSION PROPOSÉE" text={selectedCandidate.adaptation} accent />
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    <a href={selectedCandidate.sourceUrl} target="_blank" rel="noreferrer" className="mr-auto font-mono text-[9px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">SOURCE : {selectedCandidate.source}</a>
                    <Button variant="outline" onClick={() => setQueuedEventId(selectedCandidate.id)} className="h-8 rounded-none border-border px-3 font-mono text-[10px]" disabled={queuedEventId === selectedCandidate.id || selectedCandidate.verdict === 'ÉCARTÉ'}>
                      {selectedCandidate.verdict === 'ÉCARTÉ' ? 'NON ÉLIGIBLE' : queuedEventId === selectedCandidate.id ? 'AJOUTÉ AU CALENDRIER' : 'PROPOSER AU JOUEUR'}
                    </Button>
                  </div>
                </article>
              </div>
              <div className="pipeline-strip"><span>1 · SOURCES</span><ChevronRight /><span>2 · CONDITIONS HISTORIQUES</span><ChevronRight /><span>3 · ÉTAT DU MONDE</span><ChevronRight /><span>4 · SCORE</span><ChevronRight /><span>5 · PROPOSITION</span><span className="ml-auto">DERNIÈRE ANALYSE {lastScan}</span></div>
            </section>

            <aside className="dossier-panel advisor-panel">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><BrainCircuit className="size-4 text-primary" /><div><p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">PROPOSITION DE L’IA</p><h2 className="text-sm font-medium">Conseil stratégique</h2></div></div>
              <div className="p-4">
                <p className="font-mono text-[9px] tracking-[0.1em] text-[var(--signal-red)]">{advisorProposal.urgency}</p>
                <h3 className="mt-2 text-base font-medium leading-6">{advisorProposal.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{advisorProposal.reason}</p>
                <div className="my-4 grid gap-1.5">{advisorProposal.signals.map((signal) => <p key={signal} className="advisor-signal"><Activity className="size-3 text-primary" />{signal}</p>)}</div>
                <div className="space-y-2">
                  {advisorProposal.choices.map((choice) => (
                    <button key={choice.id} type="button" onClick={() => applyAdvisorChoice(choice)} disabled={Boolean(advisorChoiceId)} className={`advisor-choice ${advisorChoiceId === choice.id ? 'chosen' : ''}`}>
                      <span className="flex items-center justify-between gap-2"><strong>{choice.title}</strong>{choice.recommended && <span className="recommendation"><Sparkles className="size-3" /> IA</span>}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{choice.detail}</span>
                      <span className="mt-2 block font-mono text-[9px] text-muted-foreground">BUDGET {formatImpact(choice.effects.budget)} · STAB. {formatImpact(choice.effects.stability)} · SÉCUR. {formatImpact(choice.effects.security)}</span>
                    </button>
                  ))}
                </div>
                {advisorChoiceId && <p className="mt-3 flex items-center gap-2 border border-[var(--signal-green)]/30 bg-[var(--signal-green)]/5 px-3 py-2 font-mono text-[9px] text-[var(--signal-green)]"><Check className="size-3" /> CHOIX ENREGISTRÉ — EFFETS APPLIQUÉS</p>}
              </div>
            </aside>
          </div>
          <p className="mt-2 font-mono text-[9px] leading-4 text-muted-foreground">POINT DE DÉPART : 1er JANVIER 2000 · Le score est calculé par des règles vérifiables ; l’IA explique les écarts et rédige les variantes, mais ne peut ni révéler le futur, ni inventer une source, ni appliquer une conséquence seule.</p>
        </div>
      </section>

      <section className="capacity-shell">
        <div className="mx-auto max-w-[1600px] px-4 py-5 xl:px-8">
          <div className="capacity-layout">
            <section className="dossier-panel">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><Gauge className="size-4 text-primary" /><div><p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">APPAREIL D’ÉTAT</p><h2 className="text-sm font-medium">Capacités opérationnelles</h2></div></div>
              <div className="capacity-domain-grid">
                {capacityCatalog.map((domain) => <CapacityDomain key={domain.id} label={domain.label} state={capacities[domain.id]} />)}
              </div>
              <p className="border-t border-border px-4 py-2.5 font-mono text-[9px] leading-4 text-muted-foreground">CHARGE = moyens déjà engagés · dépasser 100 % reste possible, mais augmente délais, erreurs, fuites ou désorganisation selon le domaine.</p>
            </section>

            <aside className="dossier-panel reform-panel">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><Building2 className="size-4 text-primary" /><div><p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">RÉFORME INSTITUTIONNELLE</p><h2 className="text-sm font-medium">Sous-ministère à la Prospérité</h2></div></div>
              <div className="p-4">
                <div className="reform-effects">
                  <ReformFact label="COÛT INITIAL" value="0,42 Md€" />
                  <ReformFact label="FONCTIONNEMENT" value="0,16 Md€/an" />
                  <ReformFact label="MISE EN PLACE" value="7 mois" />
                  <ReformFact label="GAIN FINAL" value="Économie +9" accent />
                </div>
                <div className="my-4 space-y-2 text-xs"><Term icon={Check} text="1 800 postes créés ou transférés" /><Term icon={ArrowUpRight} text="Gouvernement +4 et Administration +8 de charge pendant la transition" /><Term icon={Shield} text="Gain progressif : +4 au 3e mois, +5 au 7e mois" /></div>
                {institutionStage === 'proposal' ? (
                  <Button onClick={createProsperityMinistry} className="h-9 w-full rounded-none font-mono text-[10px]">CRÉER L’INSTITUTION</Button>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between font-mono text-[9px]"><span>{institutionStage === 'operational' ? 'OPÉRATIONNEL' : institutionStage === 'partial' ? 'PARTIELLEMENT OPÉRATIONNEL' : 'MISE EN PLACE'}</span><span>{Math.min(institutionMonths, 7).toFixed(1).replace('.0', '')} / 7 MOIS</span></div>
                    <div className="institution-progress"><span style={{ width: `${Math.min(100, (institutionMonths / 7) * 100)}%` }} /></div>
                  </div>
                )}
                <div className="institution-notice" aria-live="polite"><Bell className="mt-0.5 size-3.5 shrink-0" /><p>{institutionNotice}</p></div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div id="diplomacy-center" className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 xl:grid-cols-[280px_minmax(420px,1fr)_340px] xl:px-8">
        <aside className="dossier-panel min-w-0">
          <PanelTitle icon={Radio} eyebrow="CANAUX OUVERTS" title="Contacts diplomatiques" />
          <div className="divide-y divide-border">
            {countries.map((country) => (
              <button key={country.id} type="button" onClick={() => chooseCountry(country.id)} className={`country-row ${selectedId === country.id ? 'selected' : ''}`} aria-pressed={selectedId === country.id}>
                <span className="text-2xl" aria-hidden="true">{country.flag}</span>
                <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{country.name}</span><span className="block truncate text-[11px] text-muted-foreground">{country.role}</span></span>
                <span className="font-mono text-xs" style={{ color: country.color }}>{country.relation}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>CAPACITÉ DIPLOMATIQUE</span><span>3 / 4</span></div>
            <div className="h-1 bg-muted"><div className="h-full w-3/4 bg-primary" /></div>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Chaque négociation active mobilise l’attention de votre gouvernement.</p>
          </div>
        </aside>

        <section className="dossier-panel flex min-h-[610px] min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
            <span className="text-3xl" aria-hidden="true">{selected.flag}</span>
            <div className="min-w-0 flex-1"><p className="font-mono text-[10px] tracking-[0.16em] text-primary">NÉGOCIATION BILATÉRALE</p><h2 className="truncate text-lg font-medium">France — {selected.name}</h2></div>
            <span className="border border-border bg-muted/30 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">CANAL CHIFFRÉ</span>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
            {currentMessages.map((message) => (
              <article key={message.id} className={`message ${message.author}`}><p className="mb-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">{message.meta}</p><p className="text-sm leading-6">{message.text}</p></article>
            ))}
            {isThinking && <div className="message foreign" aria-live="polite"><p className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">ANALYSE DES INTÉRÊTS EN COURS…</p></div>}
          </div>
          <div className="border-t border-border bg-muted/10 p-4">
            <label htmlFor="diplomatic-message" className="mb-2 block font-mono text-[10px] tracking-[0.12em] text-muted-foreground">DIRECTIVE LIBRE — VOUS DÉCRIVEZ L’INTENTION, LE MOTEUR ARBITRE LE RÉSULTAT</label>
            <div className="flex items-end gap-2">
              <Textarea id="diplomatic-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Ex. Proposer un accord industriel et une baisse réciproque des droits de douane…" className="min-h-20 resize-none rounded-none bg-background" />
              <Button onClick={() => void sendMessage()} disabled={!draft.trim() || isThinking} className="size-10 shrink-0 rounded-none p-0" aria-label="Envoyer la proposition"><Send className="size-4" /></Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="dossier-panel">
            <PanelTitle icon={Flag} eyebrow="DOSSIER ACTEUR" title={selected.name} />
            <div className="grid grid-cols-3 border-b border-border"><SmallStat label="RELATION" value={`${selected.relation}/100`} /><SmallStat label="CONFIANCE" value={`${selected.trust}/100`} /><SmallStat label="POSTURE" value={selected.posture} /></div>
            <div className="space-y-5 p-4"><DossierList title="INTÉRÊTS PRIORITAIRES" items={selected.interests} positive /><DossierList title="LIGNES ROUGES" items={selected.redLines} /></div>
          </section>

          <section className="dossier-panel military-panel">
            <PanelTitle icon={Radar} eyebrow="RENSEIGNEMENT MILITAIRE" title={`Forces de ${selected.name}`} />
            <div className="military-summary">
              <div>
                <p className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground">PUISSANCE POTENTIELLE ESTIMÉE</p>
                <p className="mt-1 font-mono text-2xl text-primary">{formatEstimate(selected.military.potential, militaryUncertainty)}</p>
              </div>
              <div className="intel-confidence">
                <Eye className="size-4" />
                <span><span className="block text-[8px] tracking-[0.08em] text-muted-foreground">FIABILITÉ</span><strong>{intelConfidence}%</strong></span>
              </div>
            </div>
            <div className="military-grid">
              <MilitaryDimension label="PRÉPARATION" value={selected.military.readiness} uncertainty={militaryUncertainty} />
              <MilitaryDimension label="PROJECTION" value={selected.military.projection} uncertainty={militaryUncertainty} />
              <MilitaryDimension label="LOGISTIQUE" value={selected.military.logistics} uncertainty={militaryUncertainty} />
              <MilitaryDimension label="INDUSTRIE" value={selected.military.industry} uncertainty={militaryUncertainty} />
              <MilitaryDimension label="TERRESTRE" value={selected.military.ground} uncertainty={militaryUncertainty} />
              <MilitaryDimension label="AÉRIEN" value={selected.military.air} uncertainty={militaryUncertainty} />
              <MilitaryDimension label="NAVAL" value={selected.military.naval} uncertainty={militaryUncertainty} />
            </div>
            <div className="border-t border-border p-4">
              <div className="mb-3 grid grid-cols-2 gap-3 text-xs">
                <div><p className="font-mono text-[8px] text-muted-foreground">EFFECTIFS ESTIMÉS</p><p className="mt-1">{intelConfidence >= 55 ? selected.military.personnel : 'Données fragmentaires'}</p></div>
                <div><p className="font-mono text-[8px] text-muted-foreground">POINTS FORTS PROBABLES</p><p className="mt-1">{selected.military.strengths.join(' · ')}</p></div>
              </div>
              <p className="mb-3 text-[10px] leading-4 text-muted-foreground">La fourchette combine relations diplomatiques, confiance, accès aux sources et partage allié. Elle peut être volontairement trompée par l’adversaire.</p>
              <Button variant="outline" onClick={reinforceIntelligence} disabled={(intelBoost[selected.id] ?? 0) >= 20} className="h-8 w-full rounded-none border-border font-mono text-[9px]">
                {(intelBoost[selected.id] ?? 0) >= 20 ? 'RENSEIGNEMENT RENFORCÉ' : 'MOBILISER LE RENSEIGNEMENT · +6 CHARGE'}
              </Button>
            </div>
          </section>

          <section className={`dossier-panel treaty-card ${pendingTreaty || activeTreaty ? 'active' : ''}`}>
            <PanelTitle icon={Handshake} eyebrow={activeTreaty ? 'TRAITÉ ACTIF' : 'PROPOSITION STRUCTURÉE'} title="Protocole industriel" />
            {pendingTreaty || activeTreaty ? (
              <div className="space-y-4 p-4">
                <div className="space-y-2 text-xs"><Term icon={Check} text="Droits de douane industriels −12 %" /><Term icon={Check} text="Durée initiale : 12 mois" /><Term icon={ArrowUpRight} text="Capacité industrielle +0,6 / mois" /><Term icon={Shield} text="Clause de révision automatique" /></div>
                <div className="border-y border-border py-3 font-mono text-[9px]"><span className="block text-muted-foreground">CHARGE DE MISE EN ŒUVRE</span><span className="mt-1 block">GOUV. +6 · ADMIN. +8 · ÉCON. +5</span></div>
                {activeTreaty ? <p className="flex items-center gap-2 font-mono text-[10px] text-[var(--signal-green)]"><Check className="size-3.5" /> RATIFIÉ — EFFET AU PROCHAIN MOIS</p> : <Button onClick={ratifyTreaty} className="h-9 w-full rounded-none font-mono text-xs">RATIFIER LE PROTOCOLE</Button>}
              </div>
            ) : <div className="p-4 text-xs leading-5 text-muted-foreground">Faites une proposition économique à votre interlocuteur. Les accords acceptables seront convertis en règles vérifiables avant ratification.</div>}
          </section>

          <section className="border border-dashed border-border px-4 py-3 text-[11px] leading-5 text-muted-foreground"><span className="font-mono text-[10px] text-primary">MODE DE DÉMONSTRATION</span><br />Les réactions utilisent actuellement le moteur local. Le connecteur LLM sécurisé sera activé sans exposer de clé dans le jeu.</section>
        </aside>
      </div>

      <DiplomacySheet
        open={diplomacyOpen}
        onOpenChange={setDiplomacyOpen}
        countries={countries.map((country) => {
          const impact = diplomaticImpacts[country.id] ?? { relation: 0, trust: 0 };
          return { ...country, relation: Math.max(0, Math.min(100, country.relation + impact.relation)), trust: Math.max(0, Math.min(100, country.trust + impact.trust)) };
        })}
        selectedId={selectedId}
        onSelectCountry={(id) => { chooseCountry(id); setActiveDiplomaticEventId(null); }}
        selectedCountry={selectedDiplomaticCountry}
        messages={currentMessages}
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => void sendMessage()}
        isThinking={isThinking}
        activeEvent={activeDiplomaticEvent}
        onResolveEvent={resolveDiplomaticEvent}
        memories={diplomaticMemories[selectedId] ?? []}
      />
      <TimeAdvanceDialog
        open={timeAdvanceOpen}
        onOpenChange={setTimeAdvanceOpen}
        currentDate={currentDate}
        deadlineDates={diplomaticEvents.filter((event) => !event.resolved).map((event) => event.deadline)}
        eventDates={simulationStops.filter((stop) => !processedSimulationStops.includes(stop.id)).map((stop) => stop.date)}
        onAdvance={advanceSimulation}
      />
    </main>
  );
}

function Metric({ icon: Icon, label, value, delta }: { icon: typeof Activity; label: string; value: string; delta?: string }) {
  return <div className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /><span><span className="block text-[9px] tracking-[0.12em] text-muted-foreground">{label}</span><span className="text-foreground">{value}</span>{delta && <span className="ml-1.5 text-primary">{delta}</span>}</span></div>;
}

function AnalysisLine({ label, text, accent = false }: { label: string; text: string; accent?: boolean }) {
  return <div className={`analysis-line ${accent ? 'accent' : ''}`}><p className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 text-xs leading-5">{text}</p></div>;
}

function formatImpact(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatSimulationDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

function resolutionLabel(channel?: ResolutionChannel) {
  const labels: Partial<Record<ResolutionChannel, string>> = {
    dialogue: 'DIALOGUE',
    government_action: 'DÉCISION',
    economic_action: 'MESURE ÉCONOMIQUE',
    multilateral_channel: 'AUTRES CANAUX',
    delegation: 'DÉLÉGUÉ',
    explicit_silence: 'SILENCE',
  };
  return channel ? labels[channel] ?? 'RÉSOLU' : 'RÉSOLU';
}

function applyCapacityChanges(current: CapacityState, changes: Partial<Record<CapacityDomainId, number>>): CapacityState {
  const next = { ...current };
  for (const [id, delta] of Object.entries(changes) as Array<[CapacityDomainId, number]>) {
    next[id] = { ...next[id], committed: Math.max(0, next[id].committed + delta) };
  }
  return next;
}

function capacityLabel(percent: number) {
  if (percent < 60) return 'UTILISATION MODÉRÉE';
  if (percent < 85) return 'FORTE MOBILISATION';
  if (percent < 100) return 'CAPACITÉ MAXIMALE';
  return 'SURCHARGE CRITIQUE';
}

function CapacityDomain({ label, state }: { label: string; state: { maximum: number; committed: number } }) {
  const percent = Math.round((state.committed / state.maximum) * 100);
  return <article className={`capacity-domain ${percent >= 100 ? 'overloaded' : percent >= 85 ? 'saturated' : ''}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-medium">{label}</h3><p className="mt-1 font-mono text-[8px] text-muted-foreground">{capacityLabel(percent)}</p></div><p className="font-mono text-sm">{state.committed}<span className="text-muted-foreground">/{state.maximum}</span></p></div><div className="capacity-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div><p className="mt-1 text-right font-mono text-[8px] text-muted-foreground">{percent}% DE CHARGE</p></article>;
}

function ReformFact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><p className="font-mono text-[8px] text-muted-foreground">{label}</p><p className={`mt-1 font-mono text-[11px] ${accent ? 'text-[var(--signal-green)]' : ''}`}>{value}</p></div>;
}

function MapFact({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-[8px] tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 text-xs">{value}</p></div>;
}

function formatEstimate(value: number, uncertainty: number) {
  if (uncertainty <= 3) return `${value - uncertainty}–${value + uncertainty}`;
  return `${Math.max(0, value - uncertainty)}–${Math.min(100, value + uncertainty)}`;
}

function MilitaryDimension({ label, value, uncertainty }: { label: string; value: number; uncertainty: number }) {
  const lower = Math.max(0, value - uncertainty);
  const upper = Math.min(100, value + uncertainty);
  return <div className="military-dimension"><div className="flex items-center justify-between font-mono text-[8px]"><span className="text-muted-foreground">{label}</span><span>{lower}–{upper}</span></div><div className="military-track"><span className="military-known" style={{ width: `${lower}%` }} /><span className="military-fog" style={{ left: `${lower}%`, width: `${upper - lower}%` }} /></div></div>;
}

function PanelTitle({ icon: Icon, eyebrow, title }: { icon: typeof Activity; eyebrow: string; title: string }) {
  return <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><Icon className="size-4 text-primary" /><div><p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">{eyebrow}</p><h3 className="text-sm font-medium">{title}</h3></div></div>;
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-border px-3 py-3 last:border-r-0"><p className="font-mono text-[8px] tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 truncate font-mono text-[11px]">{value}</p></div>;
}

function DossierList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return <div><p className="mb-2 font-mono text-[9px] tracking-[0.1em] text-muted-foreground">{title}</p><ul className="space-y-1.5 text-xs">{items.map((item) => <li key={item} className="flex gap-2"><span style={{ color: positive ? 'var(--signal-green)' : 'var(--signal-red)' }}>◆</span>{item}</li>)}</ul></div>;
}

function Term({ icon: Icon, text }: { icon: typeof Activity; text: string }) {
  return <p className="flex items-center gap-2"><Icon className="size-3.5 text-primary" />{text}</p>;
}
