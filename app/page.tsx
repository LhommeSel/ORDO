'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
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
  Landmark,
  Newspaper,
  Radio,
  RefreshCcw,
  Send,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
    influence: number;
  };
};

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
  },
  {
    id: 'ita', name: 'Italie', flag: '🇮🇹', role: 'Partenaire méditerranéen', relation: 57, trust: 53,
    posture: 'Opportuniste', color: 'var(--signal-green)',
    interests: ['Convergence dans la zone euro', 'Politique méditerranéenne', 'Flexibilité budgétaire'],
    redLines: ['Austérité imposée', 'Marginalisation méditerranéenne'],
  },
  {
    id: 'pol', name: 'Pologne', flag: '🇵🇱', role: 'Puissance du flanc oriental', relation: 44, trust: 39,
    posture: 'Méﬁante', color: 'var(--signal-red)',
    interests: ['Adhésion à l’Union européenne', 'Modernisation militaire', 'Souveraineté nationale'],
    redLines: ['Pression politique russe', 'Affaiblissement des garanties de l’OTAN'],
  },
  {
    id: 'usa', name: 'États-Unis', flag: '🇺🇸', role: 'Allié stratégique', relation: 73, trust: 66,
    posture: 'Exigeante', color: 'var(--signal-gold)',
    interests: ['Stabilité des Balkans', 'Cohésion de l’OTAN', 'Commerce transatlantique'],
    redLines: ['Défense européenne concurrente de l’OTAN', 'Protectionnisme technologique'],
  },
];

const initialMessages: Record<string, Message[]> = {
  deu: [{ id: 1, author: 'foreign', text: 'Monsieur le Président, Berlin veut consolider l’euro et préparer l’élargissement. Toute initiative française devra préserver la discipline commune et la compétitivité industrielle.', meta: 'Chancellerie fédérale · gouvernement Schröder' }],
  ita: [{ id: 2, author: 'foreign', text: 'Rome souhaite que la nouvelle Europe monétaire reste aussi méditerranéenne et sociale. Nous examinerons toute proposition mêlant croissance, infrastructures et coopération régionale.', meta: 'Palais Chigi · gouvernement D’Alema' }],
  pol: [{ id: 3, author: 'foreign', text: 'Notre entrée dans l’OTAN est acquise ; notre priorité est désormais l’Union européenne. Varsovie attend un calendrier politique et des investissements concrets.', meta: 'Chancellerie du Premier ministre Buzek' }],
  usa: [{ id: 4, author: 'foreign', text: 'Washington reste ouvert à vos propositions. Nous jugerons leur effet sur l’OTAN, la stabilité des Balkans et l’ouverture du commerce transatlantique.', meta: 'Administration Clinton · Conseil de sécurité nationale' }],
};

const events = [
  { status: 'TENSION ACTIVE', title: 'Faiblesse de l’euro face au dollar', detail: 'La crédibilité de la monnaie unique est sous pression.', tone: 'danger' },
  { status: 'ÉMERGENT', title: 'Sommet européen de Lisbonne', detail: 'Fenêtre de préparation : 3 mois.', tone: 'warning' },
  { status: 'SURVEILLANCE', title: 'Élection présidentielle russe', detail: 'Le scrutin anticipé est prévu le 26 mars.', tone: 'neutral' },
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
      effects: { budget: -10, stability: 4, security: 1, influence: 2 },
    },
    {
      id: 'european-coalition',
      title: 'B — Coalition numérique européenne',
      detail: 'Coordonne télécoms, recherche et règles communes avec Berlin et Rome.',
      recommended: true,
      effects: { budget: -5, stability: 2, security: 3, influence: 6 },
    },
    {
      id: 'prudence',
      title: 'C — Prudence budgétaire',
      detail: 'Attend la correction des marchés avant d’engager de nouveaux crédits.',
      effects: { budget: 4, stability: -2, security: 0, influence: -3 },
    },
  ],
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
  const [month, setMonth] = useState(0);
  const [pendingTreaty, setPendingTreaty] = useState(false);
  const [activeTreaty, setActiveTreaty] = useState(false);
  const [budget, setBudget] = useState(246);
  const [influence, setInfluence] = useState(42);
  const [industry, setIndustry] = useState(100);
  const [stability, setStability] = useState(68);
  const [security, setSecurity] = useState(54);
  const [isThinking, setIsThinking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState('09:00');
  const [selectedCandidateId, setSelectedCandidateId] = useState('lisbon-strategy');
  const [queuedEventId, setQueuedEventId] = useState<string | null>(null);
  const [advisorChoiceId, setAdvisorChoiceId] = useState<string | null>(null);

  const selected = useMemo(() => countries.find((country) => country.id === selectedId) ?? countries[0], [selectedId]);
  const selectedCandidate = historicalCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? historicalCandidates[0];
  const currentMessages = messages[selectedId] ?? [];
  const date = month === 0 ? 'Janvier 2000' : month === 1 ? 'Février 2000' : 'Mars 2000';

  const chooseCountry = (id: string) => {
    setSelectedId(id);
    setPendingTreaty(false);
    setDraft('');
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
    setIsThinking(false);
  };

  const ratifyTreaty = () => {
    if (influence < 4) return;
    setPendingTreaty(false);
    setActiveTreaty(true);
    setInfluence((value) => value - 4);
    setMessages((current) => ({
      ...current,
      [selectedId]: [...(current[selectedId] ?? []), { id: Date.now(), author: 'foreign', text: 'Le protocole commercial est ratifié. Il entrera en vigueur au début du mois prochain.', meta: 'Accord enregistré · effet mécanique confirmé' }],
    }));
  };

  const advanceMonth = () => {
    setMonth((value) => Math.min(value + 1, 2));
    if (activeTreaty) setIndustry((value) => Number((value + 0.6).toFixed(1)));
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
    setInfluence((value) => Math.max(0, value + choice.effects.influence));
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
            <Metric icon={Users} label="INFLUENCE" value={`${influence}`} delta={activeTreaty ? '-4' : '+2/mois'} />
          </div>
          <Button onClick={advanceMonth} className="h-10 rounded-none px-5 font-mono text-xs tracking-[0.08em]">TERMINER LE MOIS <ChevronRight /></Button>
        </div>
      </header>

      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto grid max-w-[1600px] gap-px bg-border lg:grid-cols-3">
          {events.map((event) => (
            <article key={event.title} className="bg-background px-5 py-3.5 lg:px-8">
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.14em]"><span className={`event-dot ${event.tone}`} /><span className="text-muted-foreground">{event.status}</span></div>
              <p className="text-sm font-medium">{event.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
            </article>
          ))}
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

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 xl:grid-cols-[280px_minmax(420px,1fr)_340px] xl:px-8">
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

          <section className={`dossier-panel treaty-card ${pendingTreaty || activeTreaty ? 'active' : ''}`}>
            <PanelTitle icon={Handshake} eyebrow={activeTreaty ? 'TRAITÉ ACTIF' : 'PROPOSITION STRUCTURÉE'} title="Protocole industriel" />
            {pendingTreaty || activeTreaty ? (
              <div className="space-y-4 p-4">
                <div className="space-y-2 text-xs"><Term icon={Check} text="Droits de douane industriels −12 %" /><Term icon={Check} text="Durée initiale : 12 mois" /><Term icon={ArrowUpRight} text="Capacité industrielle +0,6 / mois" /><Term icon={Shield} text="Clause de révision automatique" /></div>
                <div className="flex items-center justify-between border-y border-border py-3 font-mono text-[10px]"><span className="text-muted-foreground">COÛT POLITIQUE</span><span>4 INFLUENCE</span></div>
                {activeTreaty ? <p className="flex items-center gap-2 font-mono text-[10px] text-[var(--signal-green)]"><Check className="size-3.5" /> RATIFIÉ — EFFET AU PROCHAIN MOIS</p> : <Button onClick={ratifyTreaty} className="h-9 w-full rounded-none font-mono text-xs">RATIFIER LE PROTOCOLE</Button>}
              </div>
            ) : <div className="p-4 text-xs leading-5 text-muted-foreground">Faites une proposition économique à votre interlocuteur. Les accords acceptables seront convertis en règles vérifiables avant ratification.</div>}
          </section>

          <section className="border border-dashed border-border px-4 py-3 text-[11px] leading-5 text-muted-foreground"><span className="font-mono text-[10px] text-primary">MODE DE DÉMONSTRATION</span><br />Les réactions utilisent actuellement le moteur local. Le connecteur LLM sécurisé sera activé sans exposer de clé dans le jeu.</section>
        </aside>
      </div>
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
