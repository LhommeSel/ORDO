'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Factory,
  Flag,
  Handshake,
  Landmark,
  Radio,
  Send,
  Shield,
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

const countries: Country[] = [
  {
    id: 'deu', name: 'Allemagne', flag: '🇩🇪', role: 'Partenaire économique majeur', relation: 68, trust: 61,
    posture: 'Prudente', color: 'var(--signal-blue)',
    interests: ['Stabilité européenne', 'Énergie abordable', 'Industrie exportatrice'],
    redLines: ['Dette commune permanente', 'Engagement militaire automatique'],
  },
  {
    id: 'ita', name: 'Italie', flag: '🇮🇹', role: 'Partenaire méditerranéen', relation: 57, trust: 53,
    posture: 'Opportuniste', color: 'var(--signal-green)',
    interests: ['Accès aux marchés', 'Contrôle migratoire', 'Soutien budgétaire'],
    redLines: ['Austérité imposée', 'Isolement méditerranéen'],
  },
  {
    id: 'pol', name: 'Pologne', flag: '🇵🇱', role: 'Puissance du flanc oriental', relation: 44, trust: 39,
    posture: 'Méﬁante', color: 'var(--signal-red)',
    interests: ['Garanties militaires', 'Souveraineté nationale', 'Énergie sécurisée'],
    redLines: ['Dépendance envers Moscou', 'Réduction de la présence américaine'],
  },
  {
    id: 'usa', name: 'États-Unis', flag: '🇺🇸', role: 'Allié stratégique', relation: 73, trust: 66,
    posture: 'Exigeante', color: 'var(--signal-gold)',
    interests: ['Cohésion de l’OTAN', 'Achats de défense', 'Alignement technologique'],
    redLines: ['Autonomie stratégique hostile', 'Transfert de technologies sensibles'],
  },
];

const initialMessages: Record<string, Message[]> = {
  deu: [{ id: 1, author: 'foreign', text: 'Madame la Présidente, Berlin est prêt à discuter d’un approfondissement économique, à condition que les engagements soient mesurables et réciproques.', meta: 'Cabinet du Chancelier · canal sécurisé' }],
  ita: [{ id: 2, author: 'foreign', text: 'Rome souhaite un accord méditerranéen concret. Nous écouterons toute proposition qui combine investissement, énergie et contrôle des frontières.', meta: 'Palais Chigi · canal diplomatique' }],
  pol: [{ id: 3, author: 'foreign', text: 'Varsovie attend des garanties, pas une déclaration de principe. Toute coopération devra renforcer effectivement le flanc oriental.', meta: 'Chancellerie du Premier ministre' }],
  usa: [{ id: 4, author: 'foreign', text: 'Washington reste ouvert à vos propositions. Nous évaluerons leur contribution à la sécurité collective et au partage du fardeau.', meta: 'Conseil de sécurité nationale' }],
};

const events = [
  { status: 'CRISE ACTIVE', title: 'Tensions énergétiques en Europe', detail: 'Les réserves régionales couvrent 74 jours.', tone: 'danger' },
  { status: 'ÉMERGENT', title: 'Coalition industrielle franco-allemande', detail: 'Fenêtre de négociation : 2 mois.', tone: 'warning' },
  { status: 'SURVEILLANCE', title: 'Pression sur le flanc oriental', detail: 'La Pologne demande de nouvelles garanties.', tone: 'neutral' },
];

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
  const [influence, setInfluence] = useState(42);
  const [industry, setIndustry] = useState(100);
  const [isThinking, setIsThinking] = useState(false);

  const selected = useMemo(() => countries.find((country) => country.id === selectedId) ?? countries[0], [selectedId]);
  const currentMessages = messages[selectedId] ?? [];
  const date = month === 0 ? 'Janvier 2022' : month === 1 ? 'Février 2022' : 'Mars 2022';

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
            <Metric icon={CircleDollarSign} label="BUDGET" value="318 Md€" delta="+1,2" />
            <Metric icon={Factory} label="INDUSTRIE" value={`${industry}`} delta={activeTreaty ? '+0,6' : 'stable'} />
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
