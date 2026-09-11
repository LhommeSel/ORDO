'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Archive, BrainCircuit, ChevronRight, Database, Factory,
  BellRing, CheckCircle2, Eye, FlaskConical, Fuel, History, Landmark, Map, Pin,
  PinOff, RotateCcw, Save, Send, Shield, SlidersHorizontal, Swords, X,
  TrendingUp, LoaderCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WorldMap } from '@/components/world-map';
import { TerritoryExplorer } from '@/components/territory-explorer';
import { DiplomacySheet } from '@/components/diplomacy-sheet';
import {
  advanceWorld, answerAdvisorQuestion, armamentAdvisorFacts,
  actionLeverProfiles,
  acceptEnergyOffer, adjustEnergyOffer, assessStrategicPlan,
  continueEnergyNegotiationAI, createAdministrativeEnergyOffer, createWorld2000,
  dossierUnreadCount, dossiersRequiringAttention, dossierUpdatesSinceView, assessDossierResolution, energyBalance,
  energyCounterpartResponseFromSession, evaluatePoliticalPathway, executeAIJob, markDossierViewed, productEvidenceSummary,
  enactPrototypeGovernmentMeasure, reactionLevelLabels, reactionTrendLabels,
  authorizeArmamentProspect, rejectArmamentProspect,
  launchCommonAction, prepareCommonAction, prepareDossierDelegation,
  nodeAvailableExport, nodeBookedVolume, nodeExpansionPotential,
  reactivateDossier, resolveDossierDecision, resolveDiplomaticDialogueResponse, sendEnergyOffer, startEnergyNegotiationAI, visibleLedger, visibleStakeholderReactions,
  loadWorldFromBrowser, saveWorldToBrowser,
  openDiplomaticDialogue, openDiplomaticDialogueForDossier, sendDiplomaticDialogueMessage, requestDiplomaticDialogueAI, addDiplomaticDialogueParticipant,
  structuralDiagnosisGroups,
  classifyAdvisorQuestion,
  createWorldPulseRequest, executeWorldPulse, rankStrategicDossierReviews,
  setDossierFollowed,
  dossierDecisionRecords,
  dossierPressureProfile,
  buildTurnBriefing,
  assessPoliticalSupport, choosePoliticalCampaignStrategy, politicalCampaignOptions, politicalCycleStops,
  countrySheet,
  nationalReformOptions, reformPositionLabel, reformStateKey,
  type AdvisorAnswer, type AdvisorQuestionKind, type EnergyAdministrativeOffer, type EnergyCounterpartResponse,
  type CommonActionCategory, type EnergyOfferAdjustment, type HistoricalInterventionDirection, type ISODate, type StrategicDossier, type StrategicPlan,
  type NationalReformDomain, type PoliticalCampaignStrategy, type PreparedCommonAction, type PrototypeMeasureId, type StructuralDiagnosis, type TurnBriefing, type WorldState,
} from '@/lib/simulation';
import {
  createAdvisorAIRequest,
  type AdvisorAIRequest,
  type AdvisorAIAnswer,
  type AdvisorAIOption,
  type AdvisorAIResponse,
  type AdvisorAIUsage,
} from '@/lib/ai/contracts';
import type { WorldPulseResponse } from '@/lib/ai/world-pulse-contracts';

type Panel = 'world' | 'map' | 'economy' | 'energy' | 'industry' | 'reforms' | 'military' | 'dossiers' | 'diplomacy' | 'advisor' | 'ledger';

type AdvisorAIAuditEntry = {
  id: string;
  createdAt: string;
  request: Pick<AdvisorAIRequest, 'requestId' | 'question' | 'context'>;
  result: { ok: true; answer: AdvisorAIAnswer; usage: AdvisorAIUsage; source?: 'llm' | 'local_fallback' } | { ok: false; message: string; usage?: AdvisorAIUsage; diagnostics?: { issues: string[]; truncated: boolean } };
};

type WorldPulseAIAuditEntry = {
  id: string;
  createdAt: string;
  currentDate: ISODate;
  response: WorldPulseResponse;
};

const advisorAuditStorageKey = 'ordo-advisor-ai-audit-v1';
const advisorAuditMaximumEntries = 20;
const worldPulseAuditStorageKey = 'ordo-world-pulse-ai-audit-v1';
const worldPulseAuditMaximumEntries = 24;

function readAdvisorAudit(): AdvisorAIAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(advisorAuditStorageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, advisorAuditMaximumEntries) as AdvisorAIAuditEntry[] : [];
  } catch {
    return [];
  }
}

function readWorldPulseAudit(): WorldPulseAIAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(worldPulseAuditStorageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, worldPulseAuditMaximumEntries) as WorldPulseAIAuditEntry[] : [];
  } catch {
    return [];
  }
}

const panels: Array<{ id: Panel; label: string; icon: typeof Activity }> = [
  { id: 'world', label: 'Monde', icon: Activity },
  { id: 'map', label: 'Carte', icon: Map },
  { id: 'economy', label: 'Économie', icon: TrendingUp },
  { id: 'energy', label: 'Énergie', icon: Fuel },
  { id: 'industry', label: 'Industrie', icon: Factory },
  { id: 'reforms', label: 'Réformes', icon: SlidersHorizontal },
  { id: 'military', label: 'Défense', icon: Shield },
  { id: 'dossiers', label: 'Dossiers', icon: Swords },
  { id: 'diplomacy', label: 'Diplomatie', icon: Send },
  { id: 'advisor', label: 'Conseiller', icon: BrainCircuit },
  { id: 'ledger', label: 'Registre', icon: Database },
];

const addMonths = (date: ISODate, months: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
};

const worldPulseSessionId = () => {
  const storageKey = 'ordo-ai-session-v1';
  let sessionId = localStorage.getItem(storageKey);
  if (!sessionId) { sessionId = crypto.randomUUID(); localStorage.setItem(storageKey, sessionId); }
  return sessionId;
};

const capacityTone = (committed: number, maximum: number) => {
  const ratio = committed / maximum;
  if (ratio > 1) return 'text-red-300';
  if (ratio > 0.85) return 'text-amber-300';
  return 'text-emerald-300';
};

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="border border-border bg-card/70 p-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
    <div className="mt-1 text-xl font-semibold">{value}</div>
    {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
  </div>;
}

const reactionTone = {
  low: 'text-muted-foreground', moderate: 'text-sky-300', important: 'text-amber-300', critical: 'text-red-300',
};

function WorldPanel({ world, onWorldChange, onNotice }: {
  world: WorldState;
  onWorldChange: (world: WorldState) => void;
  onNotice: (message: string) => void;
}) {
  const player = world.countries[world.playerCountryId];
  const reactions = visibleStakeholderReactions(world, player.id);
  const enact = (measureId: PrototypeMeasureId) => {
    const next = enactPrototypeGovernmentMeasure(world, measureId);
    onWorldChange(next);
    const action = next.actions.at(-1);
    onNotice(`${action?.intent ?? 'Mesure gouvernementale'} · réactions des corps organisés actualisées.`);
  };
  const politicalTest = evaluatePoliticalPathway(world, player.id, {
    requiredAuthority: 'constitutional', doctrine: { economic: 10, sovereignty: 90 },
    publicSalience: 90, administrativeComplexity: 80,
  });
  const autonomousReviews = world.actions.filter((action) =>
    action.intent === 'Révision périodique de la stratégie nationale',
  ).slice(-8).reverse();
  const activePrograms = Object.values(world.actionPrograms ?? {})
    .filter((program) => program.actorId === player.id && program.status === 'active')
    .sort((a, b) => a.expectedCompletionAt.localeCompare(b.expectedCompletionAt));
  const autonomousPrograms = Object.values(world.actionPrograms ?? {})
    .filter((program) => program.actorId !== player.id && program.status === 'active')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 8);
  const feed = buildEventFeed(world);
  return <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pays modélisés" value={String(Object.keys(world.countries).length)} detail={`${player.name} actif · architecture multi-pays`} />
        <Stat label="Budget" value={player.metrics.budget.toFixed(1)} detail="Ressource chiffrée, pas de capital politique" />
        <Stat label="Actions" value={String(world.actions.length)} detail={`${world.ledger.length} modifications causales`} />
        <Stat label="Courants actifs" value={String(Object.values(world.historicalCurrents).filter((item) => item.status === 'active').length)} detail="Manifestations non prédéterminées" />
      </div>

      <div className="border border-border bg-card/70">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 font-semibold"><Landmark className="size-4 text-primary" /> Capacités opérationnelles</div>
          <p className="mt-1 text-xs text-muted-foreground">Les actions consomment des moyens réels par domaine ; dépasser le maximum augmente le risque au lieu de bloquer artificiellement.</p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(player.capacities).map(([domain, value]) => <div key={domain} className="bg-card p-4">
            <div className="flex justify-between text-sm"><span className="capitalize">{domain}</span><span className={`font-mono ${capacityTone(value.committed, value.maximum)}`}>{value.committed}/{value.maximum}</span></div>
            <div className="mt-2 h-1.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, value.committed / value.maximum * 100)}%` }} /></div>
          </div>)}
        </div>
      </div>

      <div className="border border-border bg-card/70">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 font-semibold"><Activity className="size-4 text-primary" /> Réactions des corps organisés</div>
          <p className="mt-1 text-xs text-muted-foreground">Le moteur conserve des valeurs continues, mais n’affiche que le niveau, la tendance, les causes et les conséquences concrètes. Les mesures successives s’accumulent dans un même courant de défiance.</p>
        </div>
        <div className="grid gap-px bg-border lg:grid-cols-[.72fr_1.28fr]">
          <div className="bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mesures pilotes du prototype</div>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => enact('defense_cuts')}>Réduire fortement les crédits militaires</Button>
              <Button variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => enact('labor_restrictions')}>Encadrer davantage le droit de grève</Button>
              <Button variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => enact('capital_controls')}>Encadrer les sorties de capitaux</Button>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Ces boutons servent à éprouver le mécanisme avant son raccordement au futur moteur d’actions libres et à l’IA.</p>
          </div>
          <div className="bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Signaux actifs</div>
            <div className="mt-3 space-y-2">{reactions.length ? reactions.map((reaction) => {
              const group = world.stakeholderGroups[reaction.groupId];
              return <details key={reaction.id} className="border border-border bg-background/35 p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-medium">{reaction.label}</div><div className="mt-1 text-xs text-muted-foreground">{reaction.causes[0]}</div></div>
                    <div className="shrink-0 text-right"><div className={`font-mono text-[10px] uppercase ${reactionTone[reaction.level]}`}>{reactionLevelLabels[reaction.level]}</div><div className="mt-1 text-[10px] text-muted-foreground">{reactionTrendLabels[reaction.trend]}</div></div>
                  </div>
                </summary>
                <div className="mt-3 border-t border-border/70 pt-3 text-xs">
                  <div className="text-muted-foreground">{reaction.visibility === 'internal' ? 'Signal interne' : reaction.visibility === 'secret' ? 'Signal clandestin' : 'Réaction publique'} · {reaction.relatedMeasureIds.length} mesure(s) associée(s)</div>
                  <div className="mt-2"><b>Conséquences possibles</b><ul className="mt-1 space-y-1 text-muted-foreground">{reaction.likelyConsequences.map((item) => <li key={item}>— {item}</li>)}</ul></div>
                  {group && <div className="mt-2 text-muted-foreground">La portée dépend de la cohésion et des moyens propres à ce groupe, conservés par le moteur sans jauges supplémentaires à l’écran.</div>}
                </div>
              </details>;
            }) : <div className="border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune défiance organisée significative n’est suivie pour le moment.</div>}</div>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2 font-semibold"><History className="size-4 text-sky-300" /> Mouvements de fond</div>
        <div className="mt-4 space-y-3">
          {Object.values(world.historicalCurrents).map((current) => <div key={current.id} className="grid gap-2 border-l-2 border-sky-400/50 pl-3 sm:grid-cols-[1fr_auto]">
            <div><div className="text-sm font-medium">{current.name}</div><div className="text-xs text-muted-foreground">Fenêtre {current.probableWindow.start} → {current.probableWindow.end} · {current.possibleManifestations.length} manifestations possibles</div></div>
            <div className="font-mono text-xs text-sky-300">pression {current.pressure.toFixed(1)}</div>
          </div>)}
        </div>
      </div>

      <EventFeedPanel feed={feed} />

      <div className="border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary" /> Programmes en cours</div>
        <p className="mt-1 text-xs text-muted-foreground">Une intention engagée reste ici jusqu’à sa résolution. Ses moyens sont libérés automatiquement à l’issue du programme.</p>
        <div className="mt-3 space-y-2">{activePrograms.length ? activePrograms.map((program) => {
          const progress = program.durationMonths ? Math.min(100, program.progressMonths / program.durationMonths * 100) : 100;
          return <div key={program.id} className="border border-border bg-background/35 p-3">
            <div className="flex items-start justify-between gap-3"><div><div className="font-medium">{program.title}</div><div className="mt-1 text-xs text-muted-foreground">Fin estimée : {program.expectedCompletionAt} · issue initiale estimée : {program.successProbability}%</div></div><span className="font-mono text-[10px] text-primary">{program.category}</span></div>
            <div className="mt-3 h-1.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>
          </div>;
        }) : <div className="border border-dashed border-border p-4 text-xs text-muted-foreground">Aucun programme gouvernemental n’est engagé. Préparez une action depuis le Conseiller.</div>}</div>
      </div>
    </section>

    <aside className="space-y-4">
      <div className="border border-border bg-card/70 p-4">
        <div className="font-semibold">Autonomie des États</div>
        <p className="mt-1 text-xs text-muted-foreground">Deux gouvernements sont réévalués à chaque frontière mensuelle. Le rythme ne dépend pas du nombre de clics du joueur.</p>
        <div className="mt-4 space-y-2">
          {autonomousReviews.length ? autonomousReviews.map((action) => <div key={action.id} className="flex items-center justify-between border-b border-border/70 pb-2 text-sm">
            <span>{world.countries[action.actorId]?.flag} {world.countries[action.actorId]?.name}</span><span className="font-mono text-[10px] text-muted-foreground">{action.createdAt}</span>
          </div>) : <div className="text-sm text-muted-foreground">Avancez d’un mois pour déclencher les premières revues.</div>}
        </div>
        <div className="mt-5 border-t border-border/70 pt-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Programmes autonomes en cours</div>
          <div className="mt-2 space-y-2">{autonomousPrograms.length ? autonomousPrograms.map((program) => <div key={program.id} className="border border-border/70 bg-background/30 p-2 text-xs"><div className="flex items-start justify-between gap-2"><span>{world.countries[program.actorId]?.flag} {world.countries[program.actorId]?.name ?? program.actorId}</span><span className="font-mono text-[10px] text-primary">{program.category}</span></div><div className="mt-1 text-muted-foreground">{program.title} · résolution {program.expectedCompletionAt}</div></div>) : <div className="text-xs text-muted-foreground">Aucun programme autonome mis en file par l’IA pour le moment.</div>}</div>
        </div>
      </div>

      <div className="border border-border bg-card/70 p-4">
        <div className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4 text-amber-300" /> Test de rupture politique</div>
        <p className="mt-2 text-sm">Passage immédiat à une ligne économique dirigiste et souverainiste.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Stat label="Statut" value={politicalTest.status} /><Stat label="Compatibilité" value={`${politicalTest.doctrineCompatibility}/100`} /></div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{politicalTest.obstacles.map((item) => <li key={item}>— {item}</li>)}</ul>
      </div>
    </aside>
  </div>;
}

type EventFeedItem = { id: string; date: string; title: string; summary: string; importance: 'major' | 'moderate' | 'minor'; source: string; dossierId?: string };

function buildEventFeed(world: WorldState): EventFeedItem[] {
  const items: EventFeedItem[] = [];
  for (const dossier of Object.values(world.strategicDossiers ?? {})) {
    const debtCountryId = dossier.id.startsWith('sovereign-debt-') ? dossier.actorIds.find((id) => Boolean(world.macroEconomies[id])) : undefined;
    const debtDefaultRecorded = dossier.entries.some((entry) => /défaut souverain/i.test(entry.title));
    const debtRelevant = !debtCountryId || debtCountryId === world.playerCountryId || world.macroEconomies[debtCountryId]?.sovereignDebt.status === 'default' || debtDefaultRecorded;
    if (!debtRelevant) continue;
    for (const entry of dossier.entries) {
      if (!['public', 'player'].includes(entry.visibility)) continue;
      const sourceAction = entry.sourceActionId ? world.actions.find((action) => action.id === entry.sourceActionId) : undefined;
      const playerMessage = sourceAction?.origin === 'player'
        || entry.id.startsWith('dialogue-player-')
        || entry.id.startsWith('dialogue-resolution-')
        || entry.id.startsWith('decision-')
        || entry.title === 'Message du gouvernement';
      const historicalEvent = dossier.kind === 'historical'
        || sourceAction?.origin === 'historical'
        || entry.id.startsWith('historical-');
      if (!playerMessage && !historicalEvent) continue;
      const importance = entry.importance === 'critical' || entry.importance === 'major' ? 'major' : entry.importance === 'moderate' ? 'moderate' : 'minor';
      items.push({ id: `dossier:${entry.id}`, date: entry.date, title: entry.title, summary: entry.summary, importance, source: historicalEvent ? `Histoire · ${dossier.title}` : 'Message du joueur', dossierId: dossier.id });
    }
  }
  for (const change of visibleLedger(world).slice(-160)) {
    if (change.path.startsWith('strategicDossiers.')) continue;
    const sourceAction = world.actions.find((action) => action.id === change.actionId);
    if (sourceAction?.origin !== 'player' && sourceAction?.origin !== 'historical') continue;
    const importance = sourceAction?.metadata?.minorEvent === true
      ? 'minor'
      : change.origin === 'ai' || change.path.includes('relations') || change.path.includes('worldEconomy') || change.path.includes('macroEconomies') ? 'moderate' : 'minor';
    items.push({ id: `change:${change.id}`, date: change.date, title: change.path.split('.').at(-1) ?? 'Modification du monde', summary: change.reason, importance, source: sourceAction.origin === 'historical' ? 'Événement historique' : 'Action du joueur' });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 120);
}

function EventFeedPanel({ feed }: { feed: EventFeedItem[] }) {
  const groups: Array<{ key: EventFeedItem['importance']; label: string; tone: string }> = [
    { key: 'major', label: 'Majeurs', tone: 'text-red-300' },
    { key: 'moderate', label: 'Modérés', tone: 'text-amber-300' },
    { key: 'minor', label: 'Mineurs', tone: 'text-sky-300' },
  ];
  return <div className="border border-border bg-card/70 p-4">
    <div className="flex items-center gap-2 font-semibold"><BellRing className="size-4 text-primary" /> Fil des événements</div>
    <p className="mt-1 text-xs text-muted-foreground">Les événements majeurs restent visibles en alerte ; les événements mineurs sont simulés sans interrompre le rythme du joueur.</p>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">{groups.map((group) => {
      const entries = feed.filter((item) => item.importance === group.key).slice(0, 8);
      return <section key={group.key} className="border border-border/80 bg-background/25 p-3"><div className={`font-mono text-[10px] uppercase tracking-wider ${group.tone}`}>{group.label} · {entries.length}</div><div className="mt-2 space-y-2">{entries.length ? entries.map((item) => <div key={item.id} className="border-b border-border/60 pb-2 last:border-0"><div className="text-xs font-medium">{item.title}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.date} · {item.source}</div><p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{item.summary}</p></div>) : <div className="text-xs text-muted-foreground">Aucun événement dans cette catégorie.</div>}</div></section>;
    })}</div>
  </div>;
}

const reformDomainLabels: Record<NationalReformDomain, { label: string; subtitle: string }> = {
  religion: { label: 'Religion et neutralité de l’État', subtitle: 'Laïcité, reconnaissance des cultes et place des autorités religieuses.' },
  immigration: { label: 'Immigration et intégration', subtitle: 'Admissions, contrôle des flux, langue, emploi et naturalisation.' },
  societal: { label: 'Politique sociétale', subtitle: 'Droits civils, normes familiales et ordre public.' },
};

function ReformsPanel({ world, onWorldChange, onNotice }: { world: WorldState; onWorldChange: (world: WorldState) => void; onNotice: (message: string) => void }) {
  const player = world.countries[world.playerCountryId];
  const [launching, setLaunching] = useState<string | null>(null);
  const engage = (optionId: string) => {
    const option = nationalReformOptions.find((item) => item.id === optionId);
    if (!option) return;
    const intent = `Réforme nationale ${reformDomainLabels[option.domain].label} : ${option.title}. ${option.summary}`;
    const prepared = prepareCommonAction(world, intent, { category: 'institutional' });
    if (!prepared.ok) { onNotice(prepared.error); return; }
    const launched = launchCommonAction(world, prepared.action);
    if (!launched.ok) { onNotice(launched.error); return; }
    setLaunching(option.id);
    onWorldChange(launched.state);
    onNotice(`${option.title} engagé · ${prepared.action.successProbability}% de réussite initiale · résolution prévue dans ${prepared.action.durationMonths} mois.`);
    window.setTimeout(() => setLaunching(null), 350);
  };
  return <div className="space-y-4">
    <section className="border border-border bg-card/70 p-4">
      <div className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="size-4 text-primary" /> Réformes nationales</div>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Ces sujets ne sont pas des bonus abstraits : chaque réforme déplace une position nationale, consomme les capacités du gouvernement et de l’administration, puis produit une polarisation et un dossier consultable. Les libellés masquent les valeurs internes du moteur.</p>
    </section>
    <div className="grid gap-4 xl:grid-cols-3">
      {(['religion', 'immigration', 'societal'] as const).map((domain) => {
        const reform = world.nationalReforms?.[reformStateKey(player.id, domain)];
        const options = nationalReformOptions.filter((option) => option.domain === domain);
        return <section key={domain} className="border border-border bg-card/70">
          <div className="border-b border-border p-4"><div className="font-semibold">{reformDomainLabels[domain].label}</div><p className="mt-1 text-xs text-muted-foreground">{reformDomainLabels[domain].subtitle}</p></div>
          <div className="p-4">
            {reform ? <><div className="flex items-end justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Position actuelle</div><div className="mt-1 text-sm font-medium">{reformPositionLabel(domain, reform.position)}</div></div><div className="font-mono text-xs text-primary">{reform.position}/100</div></div><div className="mt-2 h-1.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${reform.position}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground"><span>polarisation {reform.polarization}/100</span><span>ancrage {reform.institutionalAnchor}/100</span>{reform.activeProgramId && <span className="text-amber-300">programme en cours</span>}</div></> : <p className="text-xs text-muted-foreground">Données de réforme absentes de cette sauvegarde.</p>}
            <div className="mt-4 space-y-2">{options.map((option) => {
              const prepared = prepareCommonAction(world, `Réforme nationale ${reformDomainLabels[domain].label} : ${option.title}. ${option.summary}`, { category: 'institutional' });
              const disabled = !reform || Boolean(reform.activeProgramId) || !prepared.ok || launching === option.id;
              const probability = prepared.ok ? `${prepared.action.successProbability}%` : '—';
              return <button key={option.id} type="button" disabled={disabled} onClick={() => engage(option.id)} title={prepared.ok ? prepared.warnings.join(' ') : undefined} className="w-full border border-border bg-background/30 p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-55"><div className="flex items-start justify-between gap-3"><span className="text-sm font-medium">{option.title}</span><span className="shrink-0 font-mono text-[10px] text-primary">{probability}</span></div><p className="mt-1 text-xs text-muted-foreground">{option.summary}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground"><span>{option.durationMonths} mois</span><span>{option.budgetCost.toFixed(1)} budget</span><span>{option.intensity}</span></div></button>;
            })}</div>
          </div>
        </section>;
      })}
    </div>
  </div>;
}

function MapPanel({ world }: { world: WorldState }) {
  const [selectedCountryId, setSelectedCountryId] = useState(world.playerCountryId);
  const selected = world.countries[selectedCountryId];
  const sheet = countrySheet(world, selectedCountryId);
  const politicalCycle = world.politicalCycles?.[selectedCountryId];
  const activeMetrics = useMemo(() => Object.fromEntries(Object.keys(world.countries).map((id) => [id, 100])), [world.countries]);
  const activeCountries = Object.values(world.countries).sort((a, b) => b.weight - a.weight);

  return <section className="strategic-map-shell border border-border bg-card/70">
    <div className="map-header">
      <div><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Repère géographique</div><h2 className="mt-1 text-lg font-semibold">Carte des États modélisés</h2></div>
      <p className="max-w-2xl text-xs text-muted-foreground">Les pays en vert sont actuellement actifs dans le moteur. Cliquez un État pour consulter sa fiche de base ; les autres frontières restent visibles sans données ORDO.</p>
      <div className="ml-auto font-mono text-[10px] text-muted-foreground">{activeCountries.length} / 195 États modélisés</div>
    </div>
    <div className="map-command-layout">
      <WorldMap mode="military" metrics={activeMetrics} playerCountryId={world.playerCountryId} selectedId={selectedCountryId} onSelect={(id) => setSelectedCountryId(id)} />
      <aside className="map-dossier">
        {selected ? <>
          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">État modélisé</div>
          <h3 className="mt-1 text-xl font-semibold">{selected.flag} {selected.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{selected.politics.governmentLabel}</p>
          {politicalCycle && <p className="mt-1 text-[11px] text-muted-foreground">Prochaine échéance politique : <b className="text-foreground">{politicalCycle.nextReviewDate}</b> · {politicalCycle.status === 'campaign' ? 'séquence ouverte' : 'planifiée'}{politicalCycle.lastOutcome ? ` · dernier résultat : ${politicalCycle.lastOutcome}` : ''}</p>}
          <div className="map-facts">
            <Stat label="PIB réel" value={sheet?.macro ? `${sheet.macro.gdp.toFixed(0)} Md$` : '—'} detail="base 2000" />
            <Stat label="Croissance" value={sheet?.macro ? `${sheet.macro.growth.toFixed(1)} %` : '—'} />
            <Stat label="Population" value={sheet?.macro ? `${sheet.macro.population.toFixed(1)} M` : '—'} />
            <Stat label="Dette publique" value={sheet?.macro ? `${sheet.macro.debt.toFixed(1)} %` : '—'} />
            <Stat label="Budget défense" value={sheet?.defense ? `${sheet.defense.budgetBillionUsd.toFixed(1)} Md$` : '—'} />
            <Stat label="Effectifs actifs" value={sheet?.defense ? `${sheet.defense.activePersonnelThousands.toFixed(0)} k` : '—'} />
            <Stat label="Stocks pétrole" value={sheet?.energy ? `${sheet.energy.oilStocksMonths.toFixed(1)} mois` : '—'} />
            <Stat label="Stocks gaz" value={sheet?.energy ? `${sheet.energy.gasStocksMonths.toFixed(1)} mois` : '—'} />
          </div>
          {sheet?.defense && <div className="text-xs"><b>Posture militaire</b><p className="mt-1 text-muted-foreground">{sheet.defense.posture} · {sheet.defense.capabilities.join(' · ')}{sheet.defense.modelingLevel === 'aggregate' ? ' · ordre de grandeur ORDO à affiner' : ''}</p></div>}
          {sheet?.securityActors?.length ? <div className="mt-4 border-t border-border pt-3"><div className="font-mono text-[10px] uppercase tracking-wider text-amber-300">Acteurs non étatiques · référentiel 2000</div><div className="mt-2 space-y-2">{sheet.securityActors.map((actor) => <div key={actor.id} className="border border-border/70 bg-background/30 p-2 text-xs"><div className="flex items-start justify-between gap-2"><b>{actor.name}</b><span className={actor.threatLevel === 'high' || actor.threatLevel === 'critical' ? 'text-red-300' : 'text-amber-300'}>{actor.category === 'organized_crime' ? 'crime organisé' : actor.category === 'terrorist' ? 'terroriste' : 'paramilitaire'}</span></div><p className="mt-1 text-muted-foreground">{actor.activity} · zones : {actor.zones.join(', ')}</p><p className="mt-1 text-muted-foreground">Effectif estimé : {actor.estimatedStrength}. {actor.notes}</p></div>)}</div></div> : null}
          <div className="text-xs"><b>Priorité immédiate</b><p className="mt-1 text-muted-foreground">{selected.strategy.goals[0]?.label ?? 'Aucune priorité encore formalisée.'}</p></div>
          <div className="mt-4 text-xs"><b>Vulnérabilités connues</b><ul className="mt-1 space-y-1 text-muted-foreground">{selected.strategy.vulnerabilities.length ? selected.strategy.vulnerabilities.map((item) => <li key={item}>— {item}</li>) : <li>— Aucune vulnérabilité formalisée.</li>}</ul></div>
        </> : <>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Référence géographique</div>
          <h3 className="mt-1 text-xl font-semibold">État non modélisé</h3>
          <p className="mt-2 text-sm text-muted-foreground">Cette frontière est affichée pour l’orientation du joueur. Son référentiel sera ajouté lorsque le pays entrera dans le périmètre de simulation.</p>
        </>}
        <div className="map-legend"><span><i className="player" /> Pays joué</span><span><i className="high" /> État modélisé</span><span><i /> Référence sans données</span></div>
      </aside>
    </div>
    <div className="border-t border-border p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">États actifs · sélectionnez un pays pour ses territoires</div>
      <div className="mt-2 flex flex-wrap gap-2">{activeCountries.map((country) => <button key={country.id} onClick={() => setSelectedCountryId(country.id)} className={`border px-2 py-1 text-xs transition-colors ${selectedCountryId === country.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/20 text-muted-foreground hover:border-primary'}`}>{country.flag} {country.name}</button>)}</div>
    </div>
    {selected && <TerritoryExplorer key={selectedCountryId} world={world} countryId={selectedCountryId} />}
  </section>;
}

const diagnosisDirectionLabels = {
  improving: 'amélioration', stable: 'stable', worsening: 'dégradation',
};

const diagnosisReversibilityLabels = {
  low: 'faible', medium: 'moyenne', high: 'forte',
};

function StructuralDiagnosisCard({ diagnosis }: { diagnosis: StructuralDiagnosis }) {
  const tone = diagnosis.category === 'strength'
    ? 'border-emerald-400/35'
    : diagnosis.category === 'vulnerability'
      ? 'border-amber-400/40'
      : 'border-sky-400/35';
  const signal = diagnosis.category === 'strength'
    ? 'text-emerald-300'
    : diagnosis.category === 'vulnerability'
      ? 'text-amber-300'
      : 'text-sky-300';
  return <details className={`border bg-background/35 p-3 ${tone}`}>
    <summary className="cursor-pointer list-none">
      <div className="flex items-start justify-between gap-3">
        <div><div className="font-medium">{diagnosis.title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{diagnosis.summary}</p></div>
        <span className={`shrink-0 font-mono text-[10px] ${signal}`}>{diagnosis.severity}/100</span>
      </div>
    </summary>
    <div className="mt-3 space-y-3 border-t border-border/70 pt-3 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
        <span>tendance : {diagnosisDirectionLabels[diagnosis.direction]}</span>
        <span>horizon : {diagnosis.horizonYears[0]}–{diagnosis.horizonYears[1]} ans</span>
        <span>réversibilité : {diagnosisReversibilityLabels[diagnosis.reversibility]}</span>
      </div>
      <div><b>Fondements mesurés</b><ul className="mt-1 space-y-1 text-muted-foreground">{diagnosis.causes.map((item) => <li key={item}>— {item}</li>)}</ul></div>
      <div><b>Si rien ne change</b><ul className="mt-1 space-y-1 text-muted-foreground">{diagnosis.possibleConsequences.map((item) => <li key={item}>— {item}</li>)}</ul></div>
      <div><b>Leviers possibles</b><div className="mt-1 flex flex-wrap gap-1">{diagnosis.availableLevers.map((item) => <span key={item} className="border border-border bg-muted/30 px-2 py-1">{item}</span>)}</div></div>
    </div>
  </details>;
}

function MilitaryPanel({ world, onNotice }: { world: WorldState; onNotice: (message: string) => void }) {
  const countries = useMemo(() => Object.values(world.countries).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [world.countries]);
  const [selectedId, setSelectedId] = useState(world.playerCountryId);
  const [theaterAI, setTheaterAI] = useState<Record<string, string>>({});
  const [theaterAILoading, setTheaterAILoading] = useState<string | null>(null);
  const [selectedTheaterLocation, setSelectedTheaterLocation] = useState<string | null>(null);
  useEffect(() => { if (!world.countries[selectedId]) setSelectedId(world.playerCountryId); }, [selectedId, world.countries, world.playerCountryId]);
  useEffect(() => { setSelectedTheaterLocation(null); setTheaterAILoading(null); }, [selectedId]);
  const selected = world.countries[selectedId] ?? world.countries[world.playerCountryId];
  const sheet = selected ? countrySheet(world, selected.id) : null;
  const defense = sheet?.defense;
  const unitTotal = defense?.unitTypes?.reduce((total, unit) => total + unit.personnelThousands, 0) ?? defense?.activePersonnelThousands ?? 0;
  const deploymentTotal = defense?.deployments?.reduce((total, deployment) => total + deployment.personnelThousands, 0) ?? 0;
  const theaterDeployments = defense?.deployments?.filter((deployment) => !/métropole|réserve|rotation/i.test(deployment.location)) ?? [];
  const theaterTotal = theaterDeployments.reduce((total, deployment) => total + deployment.personnelThousands, 0);
  const combatAvailable = defense ? defense.activePersonnelThousands * (defense.combatAvailabilityPct ?? 35) / 100 : 0;
  const sustainableProjection = defense ? defense.activePersonnelThousands * (defense.sustainableProjectionPct ?? 20) / 100 : 0;
  const askTheaterAI = async (deployment: { location: string; personnelThousands: number; mission: string }) => {
    if (!selected || theaterAILoading) return;
    const question = `Théâtre d’opérations « ${deployment.location} » de ${selected.name} en ${world.currentDate}. ${deployment.personnelThousands} milliers de personnels y sont recensés pour la mission suivante : ${deployment.mission}. Explique pourquoi cette présence existe, quels objectifs politiques et militaires sont plausibles, puis propose trois options concrètes pour le gouvernement français avec leurs risques et conditions. Distingue les faits du référentiel 2000 des recommandations et n’invente aucune opération précise.`;
    setSelectedTheaterLocation(deployment.location);
    setTheaterAILoading(deployment.location);
    try {
      const local = answerAdvisorQuestion(world, question, { questionKind: 'strategy' });
      const request = createAdvisorAIRequest(world, question, local, worldPulseSessionId());
      const response = await fetch('/api/ai/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const payload = await response.json() as AdvisorAIResponse;
      if (!payload.ok) { onNotice(`Appel IA indisponible : ${payload.message}`); return; }
      const answer = payload.answer;
      if (!answer || !Array.isArray(answer.options)) {
        onNotice('Réponse IA incomplète : le théâtre reste inchangé.');
        return;
      }
      setTheaterAI((current) => ({ ...current, [deployment.location]: `${answer.headline}\n${answer.keyJudgment}\n\n${answer.options.map((option) => `• ${option.title} — ${option.proposal} (${option.whyPlausible})`).join('\n')}` }));
      onNotice(`Analyse IA reçue pour le théâtre « ${deployment.location} ».`);
    } catch { onNotice('Le serveur IA est inaccessible ; aucune recommandation n’a été appliquée.'); }
    finally { setTheaterAILoading(null); }
  };
  return <div className="space-y-4">
    <section className="border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Shield className="size-4 text-primary" /> Dossier militaire</div><p className="mt-1 text-xs text-muted-foreground">Effectifs par type d’unité, qualité estimée et projection géographique. Les données sont un référentiel jouable de l’année 2000.</p></div><select aria-label="Pays du dossier militaire" value={selected?.id ?? world.playerCountryId} onChange={(event) => setSelectedId(event.target.value)} className="border border-border bg-background px-2 py-1.5 text-sm">{countries.map((country) => <option key={country.id} value={country.id}>{country.flag} {country.name}</option>)}</select></div>
      {!defense ? <p className="mt-4 text-sm text-muted-foreground">Aucune donnée militaire pour ce pays.</p> : <>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><Stat label="Budget défense" value={`${defense.budgetBillionUsd.toFixed(1)} Md$`} /><Stat label="Effectifs actifs" value={`${defense.activePersonnelThousands.toFixed(0)} k`} detail={unitTotal ? `inventaire ${unitTotal.toFixed(0)} k` : undefined} /><Stat label="Posture" value={defense.posture} /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><Stat label="Aptes au combat" value={`${combatAvailable.toFixed(0)} k`} detail={`${defense.combatAvailabilityPct ?? 35}% des actifs`} /><Stat label="Projection durable" value={`${sustainableProjection.toFixed(0)} k`} detail={`${defense.sustainableProjectionPct ?? 20}% des actifs`} /><Stat label="Sur théâtres" value={`${theaterTotal.toFixed(0)} k`} detail={`${(theaterTotal / Math.max(1, defense.activePersonnelThousands) * 100).toFixed(0)}% des actifs`} /></div>
        <div className="mt-4 grid gap-px bg-border lg:grid-cols-2">
          <section className="bg-card p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Effectifs par type d’unité</div><div className="mt-3 space-y-2">{defense.unitTypes?.map((unit) => <div key={unit.id} className="border-b border-border/70 pb-2 last:border-0"><div className="flex items-center justify-between gap-3 text-sm"><span>{unit.label}</span><b>{unit.personnelThousands.toFixed(0)} k</b></div><div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Qualité {unit.quality}/100</span><span>{unit.qualityLabel}</span></div><div className="mt-1 h-1 bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, unit.quality))}%` }} /></div></div>) ?? <p className="text-xs text-muted-foreground">Inventaire détaillé non documenté.</p>}</div></section>
          <section className="bg-card p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Projection et stationnement</div><div className="mt-3 space-y-2">{defense.deployments?.map((deployment) => <div key={deployment.location} className={`border-b border-border/70 pb-2 last:border-0 ${selectedTheaterLocation === deployment.location ? 'bg-primary/5' : ''}`}><div className="flex items-center justify-between gap-3 text-sm"><span>{deployment.location}</span><div className="flex items-center gap-2"><b>{deployment.personnelThousands.toFixed(0)} k</b>{!/métropole|réserve|rotation/i.test(deployment.location) && <Button type="button" size="sm" variant="outline" onClick={() => void askTheaterAI(deployment)} disabled={theaterAILoading !== null}>{theaterAILoading === deployment.location ? 'Analyse…' : 'Appel IA'}</Button>}</div></div><p className="mt-1 text-[11px] text-muted-foreground">{deployment.mission}</p></div>) ?? <p className="text-xs text-muted-foreground">Répartition géographique non documentée.</p>}</div><div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">Total recensé : <b className="text-foreground">{deploymentTotal.toFixed(0)} k</b> · théâtres extérieurs : <b className="text-foreground">{theaterTotal.toFixed(0)} k</b>. Les appels IA donnent une lecture stratégique et ne modifient pas la partie.</div></section>
        </div>
        <section className="border border-primary/30 bg-card/70 p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Appel IA · théâtre d’opération</div>{!selectedTheaterLocation && <p className="mt-2 text-xs text-muted-foreground">Sélectionnez « Appel IA » sur un théâtre extérieur pour obtenir une explication de la présence, des objectifs et des options possibles.</p>}{selectedTheaterLocation && theaterAILoading === selectedTheaterLocation && <p className="mt-2 text-xs text-muted-foreground">Analyse du théâtre « {selectedTheaterLocation} » en cours…</p>}{selectedTheaterLocation && theaterAILoading !== selectedTheaterLocation && theaterAI[selectedTheaterLocation] && <div className="mt-2 whitespace-pre-line border-l-2 border-primary bg-primary/5 p-3 text-[11px] leading-5 text-muted-foreground">{theaterAI[selectedTheaterLocation]}</div>}</section>
        <p className="mt-3 border-l-2 border-primary bg-primary/5 p-3 text-[11px] leading-5 text-muted-foreground"><b className="text-foreground">Pourquoi 353 k ne signifie pas 353 k combattants projetables :</b> les effectifs comprennent le soutien, les états-majors, la maintenance, la formation, la gendarmerie et les relèves. Le taux « aptes au combat » retire les absences et indisponibilités ; la « projection durable » réserve les forces nécessaires à la défense du territoire et aux rotations. Les théâtres extérieurs sont donc comparés à ces deux plafonds, pas au seul total administratif.</p>
        <p className="mt-3 text-[11px] text-muted-foreground">Capacités structurantes : {defense.capabilities.join(' · ')}. La qualité combine entraînement, disponibilité et cohérence des équipements.</p>
      </>}
    </section>
  </div>;
}

function EconomyPanel({ world }: { world: WorldState }) {
  const [selectedCountryId, setSelectedCountryId] = useState(world.playerCountryId);
  const economies = Object.values(world.macroEconomies).sort((a, b) => b.realGdpBillion2000Usd - a.realGdpBillion2000Usd);
  const selectedCountry = world.countries[selectedCountryId] ?? world.countries[world.playerCountryId];
  const profile = world.structuralProfiles[selectedCountry.id];
  const diagnoses = structuralDiagnosisGroups(world, selectedCountry.id);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Cycle mondial" value={world.worldEconomy.cycle} detail={`mis à jour au ${world.worldEconomy.lastUpdatedAt}`} />
      <Stat label="Croissance mondiale" value={`${world.worldEconomy.globalGrowthAnnualPct.toFixed(2)} %`} detail="rythme annuel simulé" />
      <Stat label="Inflation mondiale" value={`${world.worldEconomy.globalInflationAnnualPct.toFixed(2)} %`} detail="référence agrégée" />
      <Stat label="Demande mondiale" value={world.worldEconomy.demandIndex.toFixed(2)} detail="indice 100 au 1er janvier 2000" />
    </div>
    <div className="border border-border bg-card/70 p-4">
      <div className="flex items-center gap-2 font-semibold"><TrendingUp className="size-4 text-primary" /> Économie et structures de long terme</div>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Les diagnostics ci-dessous ne donnent aucun bonus autonome : ils expliquent les conséquences produites par les données physiques, macroéconomiques et institutionnelles du pays. Ils apparaissent, évoluent ou disparaissent lorsque leurs causes changent.</p>
    </div>
    <section className="border border-border bg-card/70">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Bilan structurel vivant</div><h2 className="mt-1 text-lg font-semibold">{selectedCountry.flag} {selectedCountry.name}</h2></div>
          <div className="flex max-w-full gap-1 overflow-x-auto">{economies.map((economy) => {
            const country = world.countries[economy.countryId];
            return <button key={economy.countryId} onClick={() => setSelectedCountryId(economy.countryId)} className={`shrink-0 border px-2 py-1.5 text-xs ${selectedCountry.id === economy.countryId ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>{country?.flag} {country?.name}</button>;
          })}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span>{diagnoses.strengths.length} force(s)</span><span>{diagnoses.vulnerabilities.length} vulnérabilité(s)</span><span>{diagnoses.trends.length} dynamique(s)</span>
          {profile && <span title={profile.source.basis}>socle structurel {profile.source.observationYear}</span>}
        </div>
      </div>
      <div className="grid gap-px bg-border xl:grid-cols-3">
        {([
          ['Forces structurelles', diagnoses.strengths, 'text-emerald-300'],
          ['Vulnérabilités', diagnoses.vulnerabilities, 'text-amber-300'],
          ['Dynamiques de long terme', diagnoses.trends, 'text-sky-300'],
        ] as const).map(([label, items, tone]) => <div key={label} className="bg-card p-4">
          <div className={`font-mono text-[10px] uppercase tracking-wider ${tone}`}>{label}</div>
          <div className="mt-3 space-y-2">{items.length ? items.map((item) => <StructuralDiagnosisCard key={item.id} diagnosis={item} />) : <div className="border border-dashed border-border p-4 text-xs text-muted-foreground">Aucun signal structurel assez fort pour être affiché.</div>}</div>
        </div>)}
      </div>
    </section>
    <div className="overflow-x-auto border border-border bg-card/70">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Pays</th><th>PIB réel</th><th>Croissance</th><th>Potentiel</th><th>Inflation</th><th>Chômage</th><th>Commerce</th><th>Investissement</th><th>Confiance</th></tr></thead>
        <tbody>{economies.map((economy) => <tr key={economy.countryId} onClick={() => setSelectedCountryId(economy.countryId)} className={`cursor-pointer border-b border-border/60 hover:bg-muted/20 ${selectedCountry.id === economy.countryId ? 'bg-primary/5' : ''}`}>
          <td className="p-3 font-medium">{world.countries[economy.countryId]?.flag} {world.countries[economy.countryId]?.name}</td>
          <td>{economy.realGdpBillion2000Usd.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md$</td>
          <td className={economy.realGrowthAnnualPct < 0 ? 'text-red-300' : 'text-emerald-300'}>{economy.realGrowthAnnualPct.toFixed(2)} %</td>
          <td>{economy.potentialGrowthAnnualPct.toFixed(2)} %</td><td>{economy.inflationAnnualPct.toFixed(2)} %</td><td>{economy.unemploymentPct.toFixed(2)} %</td>
          <td className={economy.tradeBalancePctGdp < 0 ? 'text-amber-300' : ''}>{economy.tradeBalancePctGdp > 0 ? '+' : ''}{economy.tradeBalancePctGdp.toFixed(2)} % PIB</td>
          <td>{economy.investmentSharePctGdp.toFixed(1)} % PIB</td>
          <td title={`${economy.source.provider} · ${economy.source.indicatorCodes.join(', ')}`}>{economy.source.confidence} %</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="text-xs text-muted-foreground">Base 2000 : indicateurs macroéconomiques, structures productives et registre physique de l’énergie. Le moteur conserve un référentiel stable pour la simulation.</div>
  </div>;
}

function EnergyPanel({ world }: { world: WorldState }) {
  const countryIds = Object.keys(world.countryEnergy);
  const resources = ['oil', 'gas'] as const;
  const nodes = Object.values(world.energyNodes);
  const baselineFlows = Object.values(world.baselineEnergyFlows ?? {});
  const activeContracts = Object.values(world.energyContracts).filter((contract) => contract.status === 'active');
  const registry = resources.map((resource) => {
    const resourceNodes = nodes.filter((node) => node.resource === resource);
    return {
      resource,
      production: resourceNodes.reduce((sum, node) => sum + Math.min(node.annualProduction, node.annualCapacity), 0),
      booked: resourceNodes.reduce((sum, node) => sum + nodeBookedVolume(world, node.id), 0),
      available: resourceNodes.reduce((sum, node) => sum + nodeAvailableExport(world, node.id), 0),
      expandable: resourceNodes.reduce((sum, node) => sum + nodeExpansionPotential(world, node.id), 0),
    };
  });
  return <div className="space-y-4">
    <div className="border border-border bg-card/70 p-4">
      <div className="font-semibold">Registre physique mondial pétrole & gaz</div>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Chaque flux de départ a désormais une origine. Les contrats et engagements existants débitent le même registre : un volume déjà réservé ne peut pas être revendu. La capacité non déployée est distincte du volume disponible immédiatement.</p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">{registry.map((item) => <div key={item.resource} className="border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between"><div className="font-semibold capitalize">{item.resource === 'oil' ? 'Pétrole' : 'Gaz'}</div><span className="font-mono text-[10px] text-primary">registre modélisé</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Stat label="Production" value={item.production.toFixed(1)} /><Stat label="Déjà réservé" value={item.booked.toFixed(1)} /><Stat label="Libre maintenant" value={item.available.toFixed(1)} /><Stat label="Capacité à déployer" value={item.expandable.toFixed(1)} /></div>
    </div>)}</div>
    <div className="overflow-x-auto border border-border bg-card/70">
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Pays</th><th>Importations pétrole</th><th>Stocks pétrole</th><th>Importations gaz</th><th>Stocks gaz</th><th>Déficit restant</th></tr></thead>
        <tbody>{countryIds.map((id) => {
          const oil = energyBalance(world, id, 'oil'); const gas = energyBalance(world, id, 'gas');
          const deficit = (oil?.deficit ?? 0) + (gas?.deficit ?? 0);
          return <tr key={id} className="border-b border-border/60"><td className="p-3 font-medium">{world.countries[id]?.flag} {world.countries[id]?.name}</td><td>{oil?.imports.toFixed(1)}</td><td>{oil?.coverageMonths.toFixed(1)} mois</td><td>{gas?.imports.toFixed(1)}</td><td>{gas?.coverageMonths.toFixed(1)} mois</td><td className={deficit > 0 ? 'text-amber-300' : 'text-emerald-300'}>{deficit > 0 ? deficit.toFixed(1) : 'équilibré'}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <section className="border border-border bg-card/70">
      <div className="border-b border-border p-4"><div className="font-semibold">Production et capacité des nœuds</div><p className="mt-1 text-xs text-muted-foreground">La colonne « libre » tient compte des engagements historiques et des contrats actifs ; « à déployer » nécessite un futur programme industriel ou extractif.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Système</th><th>Production</th><th>Capacité max.</th><th>Usage local</th><th>Réservé</th><th>Libre</th><th>À déployer</th></tr></thead><tbody>{nodes.map((node) => <tr key={node.id} className="border-b border-border/60"><td className="p-3"><div className="font-medium">{node.label}</div><div className="text-xs text-muted-foreground">{world.countries[node.countryId]?.flag} {world.countries[node.countryId]?.name} · {node.resource === 'oil' ? 'pétrole' : 'gaz'}</div></td><td>{node.annualProduction.toFixed(1)}</td><td>{node.annualCapacity.toFixed(1)}</td><td>{node.domesticConsumption.toFixed(1)}</td><td>{nodeBookedVolume(world, node.id).toFixed(1)}</td><td className={nodeAvailableExport(world, node.id) > 0 ? 'text-emerald-300' : 'text-muted-foreground'}>{nodeAvailableExport(world, node.id).toFixed(1)}</td><td>{nodeExpansionPotential(world, node.id).toFixed(1)}</td></tr>)}</tbody></table></div>
    </section>
    <section className="border border-border bg-card/70">
      <div className="border-b border-border p-4"><div className="font-semibold">Flux énergétiques enregistrés</div><p className="mt-1 text-xs text-muted-foreground">{baselineFlows.length} flux initiaux et {activeContracts.length} contrat(s) signé(s). Les flux hors registre détaillé expliquent les importations dont le corridor historique n’est pas encore individualisé, sans offrir une ressource infinie au joueur.</p></div>
      <div className="max-h-80 overflow-auto divide-y divide-border/60">{[...baselineFlows, ...activeContracts].map((flow) => {
        const isContract = 'sellerId' in flow;
        const nodeId = isContract ? flow.nodeId : flow.sourceNodeId;
        const sourceNode = nodeId ? world.energyNodes[nodeId] : undefined;
        const source = sourceNode ? `${world.countries[sourceNode.countryId]?.flag ?? ''} ${world.countries[sourceNode.countryId]?.name ?? sourceNode.label}` : !isContract ? flow.externalSourceLabel : 'Contrat';
        return <div key={`${isContract ? 'contract' : 'baseline'}-${flow.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs"><div><b>{source}</b> → {world.countries[flow.buyerId]?.flag} {world.countries[flow.buyerId]?.name}<div className="mt-1 text-muted-foreground">{flow.route}</div></div><div className="font-mono text-primary">{flow.annualVolume.toFixed(1)} / an · {flow.resource === 'oil' ? 'pétrole' : 'gaz'}</div></div>;
      })}</div>
    </section>
  </div>;
}

function IndustryPanel({ world, onWorldChange, onNotice }: { world: WorldState; onWorldChange: (world: WorldState) => void; onNotice: (message: string) => void }) {
  const player = world.countries[world.playerCountryId];
  const nationalSectors = Object.values(world.sectors).filter((sector) => sector.countryId === world.playerCountryId);
  const nationalProducts = Object.values(world.armamentProducts).filter((product) => product.countryId === world.playerCountryId);
  const evidence = Object.fromEntries(armamentAdvisorFacts(world).map((item) => [item.productId, item]));
  const resolveProspect = (productId: string, prospectId: string, decision: 'authorize' | 'reject') => {
    const result = decision === 'authorize'
      ? authorizeArmamentProspect(world, productId, prospectId)
      : rejectArmamentProspect(world, productId, prospectId);
    if (!result.ok) return onNotice(result.error);
    onWorldChange(result.state);
    onNotice(decision === 'authorize' ? 'Exportation autorisée et commande inscrite au carnet.' : 'Exportation refusée ; le prospect est clos.');
  };
  return <div className="space-y-4">
    <div className="grid gap-3 lg:grid-cols-3">{nationalSectors.map((sector) => <div key={sector.id} className="border border-border bg-card/70 p-4">
      <div className="flex items-start justify-between gap-2"><div className="font-medium capitalize">{sector.countryId} · {sector.sector.replaceAll('_', ' ')}</div><span className="font-mono text-[9px] uppercase text-muted-foreground">{sector.modelingLevel === 'aggregate' ? 'socle agrégé' : 'inventaire détaillé'}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div>Capacité <b>{sector.capacity}</b></div><div>Utilisation <b>{sector.utilization.toFixed(0)}%</b></div><div>Santé <b>{sector.health.toFixed(0)}</b></div><div>Dépendance <b>{sector.foreignDependency}</b></div></div>
      <div className="mt-3 text-xs text-muted-foreground">Charge : {sector.workloadMonths.toFixed(1)} mois · inertie {sector.expansionLeadMonths} mois</div>
    </div>)}{nationalSectors.length === 0 && <div className="border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">Aucune filière industrielle détaillée n’est encore inventoriée pour {player.name}. Les indicateurs macroéconomiques nationaux restent actifs.</div>}</div>

    <div className="border border-border bg-card/70">
      <div className="border-b border-border p-4"><div className="flex items-center gap-2 font-semibold"><Shield className="size-4 text-primary" /> Produits phares d’armement · {player.name}</div><p className="mt-1 text-xs text-muted-foreground">Bouquet suivi individuellement, sans chaîne de production à la Victoria.</p></div>
      <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">{nationalProducts.map((product) => {
        const proof = evidence[product.id] ?? productEvidenceSummary(product);
        return <div key={product.id} className="bg-card p-4">
          <div className="flex justify-between gap-3"><div><div className="font-semibold">{product.name}</div><div className="text-xs text-muted-foreground">{product.manufacturer} · {product.family}</div></div><span className="font-mono text-[10px] text-primary">{product.status}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div>Capacité/an <b>{product.annualCapacity}</b></div><div>Carnet <b>{product.backlogMonths.toFixed(1)} mois</b></div><div>Technique <b>{proof.maturity}</b></div><div>Terrain <b>{proof.operationalExperience}</b></div></div>
          <div className="mt-3 text-xs text-muted-foreground">Retours {proof.feedback} · confiance documentaire {proof.confidence}% · {product.prospects.length} prospect(s)</div>
          {product.prospects.length > 0 && <div className="mt-3 space-y-2 border-t border-border pt-3">{product.prospects.slice(-3).map((prospect) => {
            const buyer = world.countries[prospect.countryId];
            const pending = prospect.status === 'approval_required' || prospect.status === 'negotiating';
            return <div key={prospect.id} className="border border-border bg-background/30 p-2 text-xs"><div className="flex items-start justify-between gap-2"><span>{buyer?.flag} {buyer?.name ?? prospect.countryId} · {prospect.quantity} unités</span><span className="font-mono text-[10px] text-primary">{prospect.status}</span></div><div className="mt-1 text-muted-foreground">Sensibilité politique : {prospect.politicalSensitivity}/100</div>{pending && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => resolveProspect(product.id, prospect.id, 'authorize')}>Autoriser</Button><Button size="sm" variant="outline" onClick={() => resolveProspect(product.id, prospect.id, 'reject')}>Refuser</Button></div>}</div>;
          })}</div>}
        </div>;
      })}{nationalProducts.length === 0 && <div className="col-span-full bg-card p-4 text-sm text-muted-foreground">Aucun produit vitrine n’est encore documenté pour ce pays. Les exportations d’armement détaillées restent indisponibles tant que cet inventaire n’est pas ajouté.</div>}</div>
    </div>
  </div>;
}

function PlanCard({ world, plan, onPrepare }: { world: WorldState; plan: StrategicPlan; onPrepare?: (plan: StrategicPlan) => void }) {
  const assessment = assessStrategicPlan(world, plan);
  return <details className="group border border-border bg-card/70 p-4 open:border-primary/40">
    <summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{plan.title}</div><p className="mt-1 text-sm text-muted-foreground">{plan.intent}</p></div><ChevronRight className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-90" /></div></summary>
    <div className="mt-4 border-t border-border pt-4 text-sm">
      <p>{plan.rationale}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mesures</div><ol className="mt-2 space-y-2">{plan.measures.map((measure, index) => <li key={`${measure.actor}-${index}`}><b>{index + 1}. {measure.actor}</b> — {measure.action} <span className="text-muted-foreground">({measure.deadline})</span></li>)}</ol></div><div><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Pourquoi accepter / refuser</div><ul className="mt-2 space-y-2 text-muted-foreground">{assessment.strengths.map((item) => <li key={item} className="text-emerald-300">+ {item}</li>)}{plan.risks.slice(0, 2).map((item) => <li key={item} className="text-amber-300">− {item}</li>)}</ul></div></div>
      <div className="mt-4 bg-muted/30 p-3 text-xs"><b>Conséquences estimées :</b> {assessment.estimatedConsequences.join(' · ')}</div>
      {plan.execution && <Button className="mt-4" onClick={() => onPrepare?.(plan)}><ChevronRight className="size-4" /> Préparer la proposition</Button>}
    </div>
  </details>;
}

const adjustmentLabels: Record<EnergyOfferAdjustment, string> = {
  more_volume: 'Demander plus de volume', better_price: 'Négocier une décote',
  shorter_term: 'Réduire la durée', delivery_security: 'Garantir les livraisons',
};

function EnergyNegotiationPanel({
  world, offer, response, signedContractId, showAdjustments, onSend, onSendAI, onReplyAI, onAdjust, onSign, onToggleAdjustments, onClose,
  aiNegotiationStatus, aiNegotiationMessage, playerReply, onPlayerReplyChange,
}: {
  world: WorldState; offer: EnergyAdministrativeOffer; response: EnergyCounterpartResponse | null;
  signedContractId: string | null; showAdjustments: boolean; onSend: () => void;
  onSendAI: () => void; onReplyAI: () => void;
  onAdjust: (kind: EnergyOfferAdjustment) => void; onSign: () => void;
  onToggleAdjustments: () => void; onClose: () => void;
  aiNegotiationStatus: 'idle' | 'loading' | 'ready' | 'unavailable'; aiNegotiationMessage: string;
  playerReply: string; onPlayerReplyChange: (value: string) => void;
}) {
  const supplier = world.countries[offer.supplierId];
  const leadership = world.leadership[offer.supplierId];
  const resource = offer.resource === 'gas' ? 'gaz' : 'pétrole';
  return <section className="border border-primary/50 bg-card/90">
    <div className="flex items-start justify-between gap-4 border-b border-border p-4">
      <div><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Proposition administrative</div><h3 className="mt-1 text-lg font-semibold">Accord de {resource} avec {supplier?.flag} {supplier?.name}</h3></div>
      <Button size="icon" variant="ghost" title="Fermer" onClick={onClose}><X className="size-4" /></Button>
    </div>
    <div className="space-y-4 p-4">
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Couverture" value={`${offer.coverageShare.toFixed(1)} %`} detail="des besoins annuels" />
        <Stat label="Durée" value={`${offer.durationYears} ans`} detail="accord de long terme" />
        <Stat label="Prix" value={offer.pricePosture === 'market' ? 'Marché' : offer.pricePosture === 'seller_premium' ? 'Prime fournisseur' : 'Décote'} detail={offer.priceSummary} />
        <Stat label="Moyens" value={offer.diplomaticEffort} detail={`${offer.adjustments.length} ajustement(s)`} />
      </div>
      <p className="text-sm text-muted-foreground">L’administration a dimensionné l’offre selon les <b className="text-foreground">besoins de {world.countries[world.playerCountryId].name}</b> et la <b className="text-foreground">capacité réellement disponible</b> du fournisseur. Vous pouvez l’envoyer telle quelle.</p>
      {leadership && <div className="border-l-2 border-primary bg-primary/5 p-3 text-xs"><b>Décision effective :</b> {leadership.figures.map((figure) => `${figure.name} (${figure.authorityShare} % d’autorité)`).join(' · ')}<span className="mt-1 block text-muted-foreground">Le moteur combine leurs orientations avec les contraintes de l’appareil politique du pays.</span></div>}
      {showAdjustments && !signedContractId && <div className="border border-border bg-muted/20 p-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ajustements facultatifs</div>
        <div className="flex flex-wrap gap-2">{(Object.keys(adjustmentLabels) as EnergyOfferAdjustment[]).map((kind) => <Button key={kind} size="sm" variant={offer.adjustments.includes(kind) ? 'default' : 'outline'} disabled={offer.adjustments.includes(kind)} onClick={() => onAdjust(kind)}>{adjustmentLabels[kind]}</Button>)}</div>
        <p className="mt-2 text-xs text-amber-300">Durcir plusieurs paramètres augmente les moyens engagés et le risque de contre-proposition.</p>
      </div>}
      <details className="border border-border p-3 text-xs text-muted-foreground"><summary className="cursor-pointer text-foreground">Voir les paramètres techniques</summary><div className="mt-2 grid gap-1 sm:grid-cols-2"><span>Volume : {offer.annualVolume.toFixed(2)} unités/an</span><span>Route : {offer.route}</span><span>Début : {offer.startDate}</span><span>Fin : {offer.endDate}</span>{offer.politicalClauses.map((clause) => <span key={clause} className="sm:col-span-2">Clause : {clause}</span>)}</div></details>
      {response && <div className={`border p-4 ${response.status === 'refused' ? 'border-red-400/50' : response.status === 'countered' ? 'border-amber-400/50' : 'border-emerald-400/50'}`}>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Réponse de {supplier?.name} · {response.status === 'accepted' ? 'accord' : response.status === 'countered' ? 'contre-proposition' : 'refus'}</div>
        <p className="mt-2 text-sm">{response.message}</p>
        <ul className="mt-2 text-xs text-muted-foreground">{response.reasons.map((reason) => <li key={reason}>— {reason}</li>)}</ul>
      </div>}
      {aiNegotiationStatus !== 'idle' && <div className={`border p-3 text-xs ${aiNegotiationStatus === 'unavailable' ? 'border-amber-400/50 text-amber-200' : 'border-primary/30 text-muted-foreground'}`}>{aiNegotiationStatus === 'loading' && <LoaderCircle className="mr-2 inline size-3 animate-spin" />}{aiNegotiationMessage}</div>}
      {response && response.status !== 'refused' && !signedContractId && world.diplomaticSessions[offer.id]?.aiMode === 'ai' && <div className="border border-border bg-muted/20 p-3">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Répondre à l’interlocuteur</label>
        <Textarea value={playerReply} onChange={(event) => onPlayerReplyChange(event.target.value)} placeholder="Ex. Nous acceptons la prime si vous garantissez la priorité de livraison et un réexamen après cinq ans." className="mt-2 min-h-24" />
        <Button className="mt-2" variant="outline" disabled={playerReply.trim().length < 3 || aiNegotiationStatus === 'loading'} onClick={onReplyAI}><Send className="size-4" /> Poursuivre avec Luna</Button>
      </div>}
      {signedContractId ? <div className="flex items-center gap-3 border border-emerald-400/50 bg-emerald-400/5 p-4 text-sm"><CheckCircle2 className="size-5 text-emerald-300" /><div><b>Accord signé et activé.</b><div className="font-mono text-[10px] text-muted-foreground">{signedContractId}</div></div></div> : <div className="flex flex-wrap gap-2">
        {!response && <Button onClick={onSend}><Send className="size-4" /> Résolution locale</Button>}
        {!response && <Button variant="outline" disabled={aiNegotiationStatus === 'loading'} onClick={onSendAI}>{aiNegotiationStatus === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />} Négocier avec l’IA</Button>}
        {response && response.status !== 'refused' && <Button onClick={onSign}><CheckCircle2 className="size-4" /> {response.status === 'countered' ? 'Accepter la contre-proposition' : 'Signer l’accord'}</Button>}
        <Button variant="outline" onClick={onToggleAdjustments}><SlidersHorizontal className="size-4" /> Ajuster</Button>
        <Button variant="ghost" onClick={onClose}>Abandonner</Button>
      </div>}
    </div>
  </section>;
}

function WorldPulseAuditPanel({ entries, onClear }: { entries: WorldPulseAIAuditEntry[]; onClear: () => void }) {
  const summary = entries.reduce((acc, entry) => {
    if (!entry.response.ok) {
      acc.failedPulses += 1;
      return acc;
    }
    acc.successfulPulses += 1;
    acc.inputTokens += entry.response.usage.inputTokens;
    acc.outputTokens += entry.response.usage.outputTokens;
    acc.costUsd += entry.response.usage.estimatedCostUsd;
    acc.cacheHits += entry.response.usage.cacheDiagnostics?.type === 'cache_hit' ? 1 : 0;
    entry.response.results.forEach((result) => {
      if (result.ok) {
        acc.successfulMissions += 1;
      } else {
        acc.rejectedMissions += 1;
      }
    });
    return acc;
  }, {
    successfulPulses: 0,
    failedPulses: 0,
    successfulMissions: 0,
    rejectedMissions: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    cacheHits: 0,
  });

  return <section className="border border-sky-400/35 bg-card/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-wider text-sky-300">Traçabilité des pouls mondiaux</div><h2 className="mt-1 text-lg font-semibold">Réponses IA reçues à chaque avancée</h2><p className="mt-1 text-xs text-muted-foreground">Journal local de test : les réponses complètes sont conservées sur cet appareil, jamais la clé API.</p></div>{entries.length > 0 && <Button size="sm" variant="outline" onClick={onClear}>Effacer le journal</Button>}</div>
    {entries.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Pouls enregistrés" value={`${summary.successfulPulses}/${entries.length}`} detail={summary.failedPulses ? `${summary.failedPulses} échec(s) global(aux)` : 'réponses globales validées'} />
      <Stat label="Missions" value={`${summary.successfulMissions} validées`} detail={summary.rejectedMissions ? `${summary.rejectedMissions} rejetée(s), sans effet monde` : 'aucun rejet de mission'} />
      <Stat label="Tokens cumulés" value={`${summary.inputTokens.toLocaleString('fr-FR')} in · ${summary.outputTokens.toLocaleString('fr-FR')} out`} detail={`${summary.cacheHits} pouls avec cache réutilisé`} />
      <Stat label="Coût estimé" value={`$${summary.costUsd.toFixed(4)}`} detail="cumul des pouls visibles" />
    </div>}
    {!entries.length && <div className="mt-4 border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun pouls IA enregistré. Avancez la simulation pour capturer les deux voies spécialisées.</div>}
    <div className="mt-4 space-y-3">{entries.map((entry, index) => <details key={entry.id} className="border border-border bg-background/35 p-3" open={index === 0}>
      <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-2 pr-5"><span className="font-semibold">Pouls du {entry.currentDate}</span><span className={`font-mono text-[10px] ${entry.response.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{entry.response.ok ? `${entry.response.usage.model} · $${entry.response.usage.estimatedCostUsd.toFixed(4)}` : `échec · ${entry.response.code}`}</span></div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString('fr-FR')} · {entry.response.ok ? `${entry.response.results.length} voie(s)` : 'réponse globale indisponible'}</div></summary>
      {entry.response.ok ? <div className="mt-3 space-y-3">{entry.response.results.map((result) => <div key={result.id} className="border border-border bg-muted/15 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b>{result.kind === 'player_reaction' ? 'Réaction aux actions du joueur' : 'Autonomie du monde'}</b><span className="font-mono text-[10px] text-muted-foreground">{result.ok ? `${result.usage.inputTokens} in · ${result.usage.outputTokens} out · ${(result.usage.latencyMs / 1000).toFixed(1)} s` : 'réponse rejetée'}</span></div>{result.ok ? <pre className="mt-2 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">{JSON.stringify(result.answer, null, 2)}</pre> : <div className="mt-2 text-xs text-amber-200">{result.message}</div>}</div>)}</div> : <div className="mt-3 text-xs text-amber-200">{entry.response.message}</div>}
    </details>)}</div>
  </section>;
}

function AdvisorAIAuditPanel({ entries, onClear }: { entries: AdvisorAIAuditEntry[]; onClear: () => void }) {
  return <section className="border border-sky-400/35 bg-card/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-sky-300">Traçabilité IA locale</div>
        <h2 className="mt-1 text-lg font-semibold">Ce qui a été envoyé et reçu</h2>
        <p className="mt-1 text-xs text-muted-foreground">Conservé sur cet appareil, limité aux {advisorAuditMaximumEntries} derniers appels. La clé API et les données serveur sensibles n’y figurent jamais.</p>
      </div>
      {entries.length > 0 && <Button size="sm" variant="outline" onClick={onClear}>Effacer le journal</Button>}
    </div>
    {!entries.length && <div className="mt-4 border border-dashed border-border p-4 text-sm text-muted-foreground">Le prochain appel IA apparaîtra ici avec son contexte, sa réponse et son coût.</div>}
    <div className="mt-4 space-y-3">{entries.map((entry, index) => <details key={entry.id} className="border border-border bg-background/35 p-3" open={index === 0}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-2 pr-5">
          <span className="font-semibold">{entry.request.question}</span>
          <span className={`font-mono text-[10px] ${entry.result.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{entry.result.ok ? `${entry.result.source === 'local_fallback' ? 'secours local' : entry.result.usage.model} · $${entry.result.usage.estimatedCostUsd.toFixed(4)}` : entry.result.usage ? `rejeté · $${entry.result.usage.estimatedCostUsd.toFixed(4)}` : 'appel non abouti'}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString('fr-FR')} · requête {entry.request.requestId.slice(0, 8)}</div>
      </summary>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="border border-border bg-muted/15 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-sky-300">Envoyé au modèle</div>
          <div className="mt-2 text-xs"><b>Question :</b> {entry.request.question}</div>
          <div className="mt-2 text-xs text-muted-foreground">{entry.request.context.playerCountry.name} · {entry.request.context.playerCountry.government} · {entry.request.context.currentDate} · mode {entry.request.context.questionKind}</div>
          {(entry.request.context.conversationHistory?.length ?? 0) > 0 && <div className="mt-2 text-xs text-muted-foreground">Historique court transmis : {entry.request.context.conversationHistory.length} échange(s), utilisé uniquement pour éviter les répétitions.</div>}
          <div className="mt-3 text-xs"><b>Faits sélectionnés ({entry.request.context.facts.length})</b><ul className="mt-1 space-y-1 text-muted-foreground">{entry.request.context.facts.map((fact) => <li key={fact.id}>— <span className="font-mono text-[10px]">{fact.id}</span> : {fact.label} — {fact.value} <span className="text-sky-300">({fact.confidence}%)</span></li>)}</ul></div>
          <div className="mt-3 text-xs"><b>Pistes locales jointes ({entry.request.context.localPlans.length})</b><ul className="mt-1 space-y-1 text-muted-foreground">{entry.request.context.localPlans.map((plan, planIndex) => <li key={`${plan.title}-${planIndex}`}>— <b>{plan.title}</b> : {plan.intent}</li>)}</ul></div>
          <div className="mt-3 border-l-2 border-sky-400/60 pl-2 text-[11px] text-muted-foreground">Règles fixes du serveur : répondre en français, n’utiliser comme chiffres que les faits fournis, distinguer faits et inférences, ne jamais modifier le monde.</div>
        </div>
        <div className="border border-border bg-muted/15 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">Reçu et contrôlé</div>
          {entry.result.ok ? <>
            <div className="mt-2 text-xs"><b>Validation :</b> réponse structurée conforme au contrat ORDO.</div>
            <div className="mt-2 text-xs"><b>Usage :</b> {entry.result.usage.inputTokens} entrants · {entry.result.usage.outputTokens} sortants{entry.result.usage.cachedInputTokens > 0 ? ` · ${entry.result.usage.cachedInputTokens} relus depuis le cache` : ''}{entry.result.usage.cacheWriteTokens ? ` · ${entry.result.usage.cacheWriteTokens} écrits dans le cache` : ''} · {entry.result.usage.latencyMs / 1000}s · {entry.result.usage.remainingSessionRequestsToday} appel(s) restant(s).</div>
            {entry.result.usage.cacheDiagnostics && entry.result.usage.cacheDiagnostics.type !== 'not_reported' && <div className="mt-1 font-mono text-[10px] text-muted-foreground">Cache IA : {entry.result.usage.cacheDiagnostics.type === 'cache_hit' ? 'préfixe réutilisé' : 'préfixe non réutilisé'}{entry.result.usage.cacheDiagnostics.reason ? ` · ${entry.result.usage.cacheDiagnostics.reason}` : ''}{entry.result.usage.cacheDiagnostics.comparisonReusableTokens != null ? ` · ${entry.result.usage.cacheDiagnostics.comparisonReusableTokens} jetons comparables` : ''}.</div>}
            <details className="mt-3 border border-border bg-background/30 p-2"><summary className="cursor-pointer text-xs font-semibold">Voir la réponse structurée exacte</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">{JSON.stringify(entry.result.answer, null, 2)}</pre></details>
          </> : <div className="mt-2 text-xs text-amber-200"><b>Erreur :</b> {entry.result.message}{entry.result.usage && <div className="mt-2 font-mono text-[10px]">Usage consommé : {entry.result.usage.inputTokens} entrants · {entry.result.usage.outputTokens} sortants · ${entry.result.usage.estimatedCostUsd.toFixed(4)}</div>}{entry.result.diagnostics && <div className="mt-2 text-[10px] text-muted-foreground">Diagnostic : {entry.result.diagnostics.truncated ? 'sortie interrompue' : 'sortie complète mais rejetée'}{entry.result.diagnostics.issues.length > 0 ? ` · ${entry.result.diagnostics.issues.join(', ')}` : ''}</div>}</div>}
        </div>
      </div>
    </details>)}</div>
  </section>;
}

function AdvisorPanel({ world, onWorldChange, onNotice }: { world: WorldState; onWorldChange: (world: WorldState) => void; onNotice: (message: string) => void }) {
  // Les avances de temps peuvent terminer pendant qu'un panneau est ouvert.
  // Les handlers asynchrones lisent donc toujours le dernier monde, pas la
  // fermeture créée avant le dernier rendu.
  const worldRef = useRef(world);
  useEffect(() => { worldRef.current = world; }, [world]);
  const [question, setQuestion] = useState('');
  const [questionKindOverride, setQuestionKindOverride] = useState<AdvisorQuestionKind | 'auto'>('auto');
  const [answer, setAnswer] = useState<AdvisorAnswer>(() => answerAdvisorQuestion(world, ''));
  const [preparedAction, setPreparedAction] = useState<PreparedCommonAction | null>(null);
  const [actionWarnings, setActionWarnings] = useState<string[]>([]);
  const [aiAnswer, setAiAnswer] = useState<AdvisorAIAnswer | null>(null);
  const [aiUsage, setAiUsage] = useState<AdvisorAIUsage | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [aiMessage, setAiMessage] = useState('L’IA n’est appelée que sur demande explicite.');
  const [aiAudit, setAiAudit] = useState<AdvisorAIAuditEntry[]>(readAdvisorAudit);
  const [offer, setOffer] = useState<EnergyAdministrativeOffer | null>(null);
  const [response, setResponse] = useState<EnergyCounterpartResponse | null>(null);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [signedContractId, setSignedContractId] = useState<string | null>(null);
  const [aiNegotiationStatus, setAiNegotiationStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [aiNegotiationMessage, setAiNegotiationMessage] = useState('');
  const [playerReply, setPlayerReply] = useState('');
  const detectedQuestion = question.trim().length >= 3 ? classifyAdvisorQuestion(question) : null;
  const selectedQuestionKind = questionKindOverride === 'auto' ? undefined : questionKindOverride;
  const questionKindLabel: Record<AdvisorQuestionKind, string> = {
    fact: 'État du monde', strategy: 'Décisions', diplomacy: 'Diplomatie', free: 'Libre',
  };
  const dimensionLabel: Record<string, string> = {
    situation: 'situation', strategy: 'stratégie', diplomacy: 'diplomatie', forecast: 'projection',
  };
  const resetNegotiation = () => {
    setOffer(null); setResponse(null); setSignedContractId(null); setPlayerReply(''); setAiNegotiationStatus('idle'); setAiNegotiationMessage('');
  };
  const appendAudit = (entry: AdvisorAIAuditEntry) => {
    setAiAudit((previous) => {
      const next = [entry, ...previous].slice(0, advisorAuditMaximumEntries);
      localStorage.setItem(advisorAuditStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const clearAudit = () => {
    localStorage.removeItem(advisorAuditStorageKey);
    setAiAudit([]);
  };
  const prepareLocalAnswer = () => {
    if (question.trim().length < 3) return;
    const local = answerAdvisorQuestion(world, question, { questionKind: selectedQuestionKind });
    setAnswer(local);
    setAiAnswer(null); setAiUsage(null); setAiStatus('idle');
    setAiMessage('Analyse locale terminée · aucun appel facturé.');
    resetNegotiation();
    return local;
  };
  const prepareAction = () => {
    const result = prepareCommonAction(world, question);
    if (!result.ok) {
      setPreparedAction(null); setActionWarnings([result.error]);
      return;
    }
    setPreparedAction(result.action); setActionWarnings(result.warnings);
    setAiAnswer(null); setAiUsage(null); setAiStatus('idle');
    setAiMessage('Programme préparé localement · aucun appel facturé.');
    resetNegotiation();
  };
  const launchPreparedAction = () => {
    if (!preparedAction) return;
    const result = launchCommonAction(world, preparedAction);
    if (!result.ok) return onNotice(result.error);
    onWorldChange(result.state);
    onNotice(`Programme lancé : il sera résolu automatiquement au fil du temps.`);
    setPreparedAction(null); setActionWarnings([]);
  };
  const askAI = async () => {
    if (question.trim().length < 3 || aiStatus === 'loading') return;
    const currentWorld = worldRef.current;
    const local = answerAdvisorQuestion(currentWorld, question, { questionKind: selectedQuestionKind });
    setAnswer(local); setAiAnswer(null); setAiUsage(null); setAiStatus('loading');
    setAiMessage('L’IA confronte la demande aux faits transmis par le moteur…');
    resetNegotiation();
    try {
      const storageKey = 'ordo-ai-session-v1';
      let sessionId = localStorage.getItem(storageKey);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(storageKey, sessionId);
      }
      const conversationHistory = aiAudit
        .filter((entry): entry is AdvisorAIAuditEntry & { result: { ok: true; answer: AdvisorAIAnswer; usage: AdvisorAIUsage } } => entry.result.ok)
        .slice(0, 2)
        .map((entry) => ({ question: entry.request.question, summary: `${entry.result.answer.headline} — ${entry.result.answer.keyJudgment}` }));
      const aiRequest = createAdvisorAIRequest(currentWorld, question, local, sessionId, conversationHistory);
      const auditRequest = { requestId: aiRequest.requestId, question: aiRequest.question, context: aiRequest.context };
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiRequest),
      });
      const payload = await response.json() as AdvisorAIResponse;
      if (!payload.ok) {
        appendAudit({ id: aiRequest.requestId, createdAt: new Date().toISOString(), request: auditRequest, result: { ok: false, message: payload.message, usage: payload.usage, diagnostics: payload.diagnostics } });
        setAiStatus('unavailable'); setAiMessage(payload.message);
        return;
      }
      appendAudit({ id: aiRequest.requestId, createdAt: new Date().toISOString(), request: auditRequest, result: { ok: true, answer: payload.answer, usage: payload.usage, source: payload.source } });
      setAiAnswer(payload.answer); setAiUsage(payload.usage); setAiStatus('ready');
      setAiMessage(`${payload.source === 'local_fallback' ? 'Réponse locale de secours (sortie IA invalide)' : 'Réponse IA validée'} · ${payload.usage.remainingSessionRequestsToday} requête(s) restantes aujourd’hui.`);
    } catch {
      // L'entrée n'est créée ici que si la requête a pu être préparée, afin d'éviter un faux audit vide.
      setAiStatus('unavailable');
      setAiMessage('Le serveur IA est inaccessible. La réponse locale reste disponible.');
    }
  };
  const prepare = (plan: StrategicPlan) => {
    if (!plan.execution) return;
    const result = createAdministrativeEnergyOffer(world, plan.execution.supplierId, plan.execution.resource);
    if (!result.ok) return onNotice(result.error);
    setOffer(result.offer); setResponse(null); setSignedContractId(null); setShowAdjustments(false);
  };
  const prepareAIOption = (option: AdvisorAIOption) => {
    const intent = option.actionIntent;
    if (!intent || intent.kind !== 'energy_contract') return;
    if (!world.countries[intent.targetCountryId]) return onNotice('Le pays proposé par l’IA n’est pas présent dans le monde simulé.');
    const result = createAdministrativeEnergyOffer(world, intent.targetCountryId, intent.resource);
    if (!result.ok) return onNotice(result.error);
    setOffer(result.offer); setResponse(null); setSignedContractId(null); setShowAdjustments(false);
    onNotice('Intention IA convertie en offre administrative ; aucun contrat n’est encore signé.');
  };
  const prepareAIOptionAction = (option: AdvisorAIOption) => {
    const actionText = `${option.title}. ${option.proposal}`;
    const result = prepareCommonAction(world, actionText, { source: 'ai' });
    if (!result.ok) {
      setPreparedAction(null); setActionWarnings([`Cette proposition IA doit être précisée avant exécution : ${result.error}`]);
      return;
    }
    setPreparedAction(result.action); setActionWarnings([
      'Proposition consultative : aucun effet ne sera appliqué avant votre confirmation.',
      ...result.warnings,
    ]);
    setAiMessage('Proposition IA convertie en programme local · aucun appel supplémentaire et aucun effet appliqué.');
    resetNegotiation();
  };
  const adjust = (kind: EnergyOfferAdjustment) => {
    if (!offer) return;
    setOffer(adjustEnergyOffer(world, offer, kind)); setResponse(null);
  };
  const send = () => {
    if (!offer) return;
    const result = sendEnergyOffer(world, offer);
    if (!result.ok) return onNotice(result.error);
    onWorldChange(result.state); setResponse(result.response); setOffer(result.response.offer);
    onNotice(`Réponse reçue de ${world.countries[offer.supplierId]?.name}.`);
  };
  const aiSessionId = () => {
    const storageKey = 'ordo-ai-session-v1';
    let sessionId = localStorage.getItem(storageKey);
    if (!sessionId) { sessionId = crypto.randomUUID(); localStorage.setItem(storageKey, sessionId); }
    return sessionId;
  };
  const resolveDiplomacyJob = async (pendingWorld: WorldState, jobId: string, diplomaticSessionId: string) => {
    setAiNegotiationStatus('loading'); setAiNegotiationMessage('L’IA prépare la réponse du pays à partir de ses intérêts privés…');
    onWorldChange(pendingWorld);
    const result = await executeAIJob(pendingWorld, jobId, aiSessionId());
    if (!result.ok) {
      setAiNegotiationStatus('unavailable'); setAiNegotiationMessage(result.response.message);
      return;
    }
    const session = result.state.diplomaticSessions[diplomaticSessionId];
    const answer = result.response.answer;
    onWorldChange(result.state);
    setOffer(energyCounterpartResponseFromSession(session).offer);
    setResponse(energyCounterpartResponseFromSession(session, [answer.assessment, ...answer.proposals.slice(0, 1).map((proposal) => proposal.rationale)]));
    setAiNegotiationStatus('ready');
    setAiNegotiationMessage(`Réponse IA validée par le moteur · coût estimé $${result.response.usage.estimatedCostUsd.toFixed(4)}.`);
  };
  const sendWithAI = async () => {
    if (!offer || aiNegotiationStatus === 'loading') return;
    const started = startEnergyNegotiationAI(world, offer);
    if (!started.ok) return onNotice(started.error);
    await resolveDiplomacyJob(started.state, started.jobId, started.sessionId);
  };
  const replyWithAI = async () => {
    if (!offer || playerReply.trim().length < 3 || aiNegotiationStatus === 'loading') return;
    const continued = continueEnergyNegotiationAI(world, offer.id, playerReply);
    if (!continued.ok) return onNotice(continued.error);
    setPlayerReply(''); setResponse(null);
    await resolveDiplomacyJob(continued.state, continued.jobId, offer.id);
  };
  const sign = () => {
    if (!response) return;
    const result = acceptEnergyOffer(world, response.offer);
    if (!result.ok) return onNotice(result.error);
    onWorldChange(result.state); setSignedContractId(result.contractId);
    onNotice(`Accord énergétique signé : les flux physiques et les capacités ont été mis à jour.`);
  };
  return <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
    <section className="border border-border bg-card/70 p-4">
      <div className="flex items-center gap-2 font-semibold"><BrainCircuit className="size-4 text-primary" /> Action ou question libre</div>
      <p className="mt-1 text-sm text-muted-foreground">Écrivez votre intention comme vous la formuleriez à votre administration. Le pays, la ressource et l’objectif sont extraits de la phrase ; aucun partenaire n’est imposé par un menu.</p>
      <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Votre demande</label>
      <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ex. Je veux sécuriser un contrat gazier de long terme avec l’Algérie afin de diversifier nos approvisionnements." className="mt-2 min-h-36" />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Interprétation :</span>
        {(['auto', 'fact', 'strategy', 'diplomacy', 'free'] as const).map((kind) => {
          const active = questionKindOverride === kind;
          const label = kind === 'auto' ? `Automatique${detectedQuestion ? ` · ${detectedQuestion.dimensions.map((item) => dimensionLabel[item] ?? item).join(' + ')}` : ''}` : questionKindLabel[kind];
          return <Button key={kind} type="button" size="sm" variant={active ? 'default' : 'outline'} className="h-7 px-2 text-[11px]" onClick={() => setQuestionKindOverride(kind)}>{label}</Button>;
        })}
        {detectedQuestion && questionKindOverride === 'auto' && <span className="text-muted-foreground">({detectedQuestion.confidence}% de confiance)</span>}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Button variant="outline" disabled={question.trim().length < 3 || aiStatus === 'loading'} onClick={prepareLocalAnswer}>Préparer localement</Button>
        <Button variant="outline" disabled={question.trim().length < 3 || aiStatus === 'loading'} onClick={prepareAction}><CheckCircle2 className="size-4" />Préparer une action</Button>
        <Button disabled={question.trim().length < 3 || aiStatus === 'loading'} onClick={askAI}>{aiStatus === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}Approfondir avec l’IA</Button>
      </div>
      <div className={`mt-4 border p-3 text-xs ${aiStatus === 'unavailable' ? 'border-amber-400/40 text-amber-200' : 'border-border bg-muted/20 text-muted-foreground'}`}>{aiMessage}{aiUsage && <div className="mt-2 font-mono text-[10px] text-muted-foreground">{aiUsage.inputTokens} jetons reçus · {aiUsage.outputTokens} produits · coût estimé ${aiUsage.estimatedCostUsd.toFixed(4)}</div>}</div>
      <div className="mt-2 text-[11px] text-muted-foreground">Le moteur local produit les actions exécutables. L’IA les approfondit, mais ne peut modifier aucune donnée du monde.</div>
    </section>
    <section className="space-y-3">
      {aiAnswer && <div className="border border-primary/45 bg-card/80 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Analyse IA · consultative</div>
        <h2 className="mt-1 text-xl font-semibold">{aiAnswer.headline}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{aiAnswer.synthesis}</p>
        <div className="mt-4 border-l-2 border-primary bg-primary/5 p-3 text-sm"><b>Jugement central :</b> {aiAnswer.keyJudgment}</div>
        <div className="mt-4 border border-border bg-background/25 p-3 text-xs"><b>Nature des affirmations</b><div className="mt-2 space-y-1 text-muted-foreground">{aiAnswer.claims.map((claim, index) => <div key={`${claim.text}-${index}`}><span className={claim.status === 'fact' ? 'text-emerald-300' : claim.status === 'proposal' ? 'text-sky-300' : 'text-amber-300'}>{claim.status}</span> · {claim.text}{claim.factIds.length > 0 && <span className="font-mono text-[10px]"> · {claim.factIds.join(', ')}</span>}</div>)}</div></div>
        {aiAnswer.options.length === 0 && <div className="mt-4 border-l-2 border-emerald-400 bg-emerald-400/5 p-3 text-sm"><b>Réponse factuelle :</b> cette demande ne déclenche volontairement aucune option d’action.</div>}
        <div className="mt-4 space-y-3">{aiAnswer.options.map((option, index) => <details key={`${option.title}-${index}`} className="border border-border bg-background/35 p-3">
          <summary className="cursor-pointer list-none font-semibold">{index + 1}. {option.title}</summary>
          <p className="mt-2 text-sm">{option.proposal}</p>
          <div className="mt-3 grid gap-3 text-xs lg:grid-cols-2">
            <div><b className="text-emerald-300">Pourquoi l’accepter</b><p className="mt-1 text-muted-foreground">{option.whyPlausible}</p></div>
            <div><b className="text-amber-300">Pourquoi la refuser</b><p className="mt-1 text-muted-foreground">{option.whyRefused}</p></div>
          </div>
          <div className="mt-3 text-xs"><b>Conséquences estimées</b><ul className="mt-1 space-y-1 text-muted-foreground">{option.estimatedConsequences.map((item) => <li key={item}>— {item}</li>)}</ul></div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground"><span>Faits mobilisés : {option.factIds.join(', ')}</span><span className="flex flex-wrap gap-2">{option.actionIntent?.kind === 'energy_contract' && <Button size="sm" variant="outline" className="font-sans text-xs" onClick={() => prepareAIOption(option)}>Préparer l’offre vérifiée</Button>}{option.actionIntent?.kind !== 'energy_contract' && <Button size="sm" variant="outline" className="font-sans text-xs" onClick={() => prepareAIOptionAction(option)}>Préparer cette option</Button>}</span></div>
        </details>)}</div>
        <div className="mt-4 text-xs"><b>Angles morts</b><ul className="mt-1 space-y-1 text-muted-foreground">{aiAnswer.blindSpots.map((item) => <li key={item}>— {item}</li>)}</ul></div>
      </div>}
      <AdvisorAIAuditPanel entries={aiAudit} onClear={clearAudit} />
      <div className="border border-border bg-card/70 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">{questionKindLabel[answer.questionKind]}</div><h2 className="mt-1 text-xl font-semibold">{answer.headline}</h2><p className="mt-2 text-sm text-muted-foreground">{answer.synthesis}</p>
        {answer.interpretation.kind === 'energy_contract' && <div className="mt-4 border-l-2 border-primary bg-muted/20 p-3 text-xs"><b>Demande comprise :</b> négociation énergétique · {answer.interpretation.resource === 'gas' ? 'gaz' : answer.interpretation.resource === 'oil' ? 'pétrole' : 'ressource à préciser'} · {answer.interpretation.targetLabel ?? 'fournisseur à recommander'}{answer.interpretation.warnings.map((warning) => <div key={warning} className="mt-2 text-amber-300">⚠ {warning}</div>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">{answer.facts.map((fact) => <span key={fact.id} title={fact.sourcePath} className="border border-border bg-muted/30 px-2 py-1 text-xs"><b>{fact.label}</b> · {fact.value}</span>)}</div>
      </div>
      {offer && <EnergyNegotiationPanel world={world} offer={offer} response={response} signedContractId={signedContractId} showAdjustments={showAdjustments} onSend={send} onSendAI={sendWithAI} onReplyAI={replyWithAI} onAdjust={adjust} onSign={sign} onToggleAdjustments={() => setShowAdjustments((value) => !value)} onClose={resetNegotiation} aiNegotiationStatus={aiNegotiationStatus} aiNegotiationMessage={aiNegotiationMessage} playerReply={playerReply} onPlayerReplyChange={setPlayerReply} />}
      {(preparedAction || actionWarnings.length > 0) && <div className={`border p-4 ${preparedAction ? 'border-primary/45 bg-card/80' : 'border-amber-400/40 bg-card/70'}`}>
        {preparedAction ? <>
          <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Programme prêt à engager</div>
          <h2 className="mt-1 text-xl font-semibold">{preparedAction.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{preparedAction.intent}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4"><Stat label="Origine" value={preparedAction.intentSpec?.source === 'ai' ? 'IA consultative' : 'Joueur'} /><Stat label="Durée" value={`${preparedAction.durationMonths} mois`} /><Stat label="Issue estimée" value={`${preparedAction.successProbability}%`} /><Stat label="Coût initial" value={preparedAction.budgetCost.toFixed(1)} detail="budget du prototype" /></div>
          {preparedAction.lever && <div className="mt-3 border-l-2 border-sky-400 bg-sky-400/5 p-3 text-xs"><b>Levier réellement simulé :</b> {actionLeverProfiles[preparedAction.lever].label}</div>}
          {preparedAction.politicalAssessment && <div className="mt-3 border border-border bg-background/30 p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Faisabilité politique au lancement</div><div className="mt-2 grid gap-2 sm:grid-cols-4"><Stat label="Voie" value={preparedAction.politicalAssessment.pathwayStatus} /><Stat label="Dirigeant" value={`${preparedAction.politicalAssessment.leaderDisposition.toFixed(0)}/100`} /><Stat label="Appareil" value={`${preparedAction.politicalAssessment.apparatusSupport.toFixed(0)}/100`} /><Stat label="Institutions" value={`${preparedAction.politicalAssessment.institutionalFeasibility.toFixed(0)}/100`} /></div>{preparedAction.politicalAssessment.reasons.length > 0 && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Pourquoi cette faisabilité ?</summary><ul className="mt-2 space-y-1">{preparedAction.politicalAssessment.reasons.map((reason) => <li key={reason}>— {reason}</li>)}</ul></details>}</div>}
          <div className="mt-4 text-xs"><b>Moyens engagés :</b><div className="mt-2 flex flex-wrap gap-2">{preparedAction.requiredCapacities.map((item) => <span key={item.domain} className="border border-border bg-muted/30 px-2 py-1">{item.domain} +{item.commitment}</span>)}</div></div>
          <div className="mt-4 text-xs"><b>Si le programme réussit :</b><ul className="mt-1 space-y-1 text-muted-foreground">{preparedAction.successEffects.slice(0, 5).map((effect, index) => <li key={`${effect.kind}-${index}`}>— {effect.reason}</li>)}</ul></div>
          <div className="mt-4 text-xs"><b>Risques :</b><ul className="mt-1 space-y-1 text-muted-foreground">{preparedAction.risks.map((risk) => <li key={risk}>— {risk}</li>)}</ul></div>
          {actionWarnings.length > 0 && <div className="mt-3 text-xs text-amber-300">{actionWarnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}</div>}
          <Button className="mt-4" onClick={launchPreparedAction}><CheckCircle2 className="size-4" />Engager le programme</Button>
        </> : <><div className="font-semibold text-amber-200">Action non préparée</div><div className="mt-2 space-y-1 text-sm text-amber-100">{actionWarnings.map((warning) => <div key={warning}>— {warning}</div>)}</div></>}
      </div>}
      {answer.plans.map((plan) => <PlanCard key={plan.id} world={world} plan={plan} onPrepare={prepare} />)}
    </section>
  </div>;
}

const dossierImportanceTone: Record<StrategicDossier['importance'], string> = {
  minor: 'text-slate-300', moderate: 'text-sky-300', major: 'text-amber-300', critical: 'text-red-300',
};

const decisionUrgencyLabels: Record<string, string> = { low: 'faible', medium: 'moyenne', high: 'haute', critical: 'critique' };
const decisionSourceLabels: Record<string, string> = { legacy: 'héritée', world_pulse: 'pouls IA', autonomous_program: 'programme autonome', historical: 'historique', player_action: 'action du joueur' };
const decisionChannelLabels: Record<string, string> = { local_action: 'action locale', dialogue: 'dialogue', delegation: 'délégation', explicit_silence: 'silence explicite' };

const programStatusLabels: Record<string, string> = {
  active: 'Actif', succeeded: 'Réussi', partially_succeeded: 'Partiel', failed: 'Échoué', cancelled: 'Annulé',
};

const programStatusTone: Record<string, string> = {
  active: 'text-primary', succeeded: 'text-emerald-300', partially_succeeded: 'text-amber-300', failed: 'text-red-300', cancelled: 'text-muted-foreground',
};

const programCategoryLabels: Record<string, string> = {
  diplomacy: 'Diplomatie', economic: 'Économie', institutional: 'Institutions', defense: 'Défense', intelligence: 'Renseignement',
};

function AutonomousProgramsPanel({ world }: { world: WorldState }) {
  const programs = Object.values(world.actionPrograms ?? {})
    .filter((program) => program.actorId !== world.playerCountryId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
  const active = programs.filter((program) => program.status === 'active').length;
  const resolved = programs.length - active;
  return <section className="border border-border bg-card/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Suivi autonome</div>
        <h2 className="mt-1 text-lg font-semibold">Programmes lancés par les autres États</h2>
        <p className="mt-1 text-xs text-muted-foreground">Le pouls IA formule des intentions ; le moteur en fixe les moyens, la durée et la résolution. Aucun effet n’est appliqué directement par le modèle.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-3">
        <Stat label="Total" value={String(programs.length)} />
        <Stat label="Actifs" value={String(active)} />
        <Stat label="Résolus" value={String(resolved)} />
      </div>
    </div>
    {!programs.length && <div className="mt-4 border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun programme autonome n’a encore été lancé.</div>}
    {programs.length > 0 && <div className="mt-4 space-y-2">{programs.slice(0, 16).map((program) => {
      const progress = program.durationMonths > 0 ? Math.min(100, program.progressMonths / program.durationMonths * 100) : 100;
      const actor = world.countries[program.actorId];
      const targets = program.targetIds.map((id) => world.countries[id]?.name ?? id).join(', ') || 'Aucun interlocuteur direct';
      return <details key={program.id} className="border border-border bg-background/35 p-3">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="font-medium">{actor?.flag} {actor?.name ?? program.actorId}</div><div className="mt-1 text-sm">{program.title}</div></div>
            <span className={`font-mono text-[10px] uppercase ${programStatusTone[program.status] ?? 'text-muted-foreground'}`}>{programStatusLabels[program.status] ?? program.status}</span>
          </div>
          <div className="mt-3 h-1.5 bg-muted"><div className={`h-full ${program.status === 'failed' ? 'bg-red-400' : program.status === 'succeeded' ? 'bg-emerald-400' : 'bg-primary'}`} style={{ width: `${progress}%` }} /></div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{program.progressMonths}/{program.durationMonths} mois</span><span>{program.status === 'active' ? `résolution prévue ${program.expectedCompletionAt}` : `lancé le ${program.startedAt}`}</span></div>
        </summary>
        <div className="mt-3 border-t border-border/70 pt-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-3"><Stat label="Domaine" value={programCategoryLabels[program.category] ?? program.category} /><Stat label="Cible(s)" value={targets} /><Stat label="Issue estimée" value={`${program.successProbability}%`} /></div>
          <p className="mt-3"><b>Objectif :</b> {program.intent}</p>
          {program.linkedDossierId && <p className="mt-2"><b>Dossier déclencheur :</b> {world.strategicDossiers[program.linkedDossierId]?.title ?? program.linkedDossierId}</p>}
          <p className="mt-2 text-muted-foreground"><b>Moyens :</b> {program.requiredCapacities.map((item) => `${item.domain} +${item.commitment}`).join(' · ')} · budget réservé {program.budgetCost.toFixed(1)}</p>
          {program.risks.length > 0 && <p className="mt-2 text-amber-200"><b>Risques :</b> {program.risks.join(' · ')}</p>}
          {program.resolution && <p className="mt-2 text-muted-foreground"><b>Résolution :</b> {program.resolution}</p>}
        </div>
      </details>;
    })}</div>}
    {programs.length > 16 && <div className="mt-3 text-[11px] text-muted-foreground">{programs.length - 16} programme(s) plus ancien(s) restent consultables dans le registre causal.</div>}
  </section>;
}

function DossiersPanel({ world, selectedId, onSelect, onWorldChange, onNotice, onOpenDiplomacy }: {
  world: WorldState; selectedId: string | null; onSelect: (id: string) => void; onWorldChange: (world: WorldState) => void; onNotice: (message: string) => void; onOpenDiplomacy?: (dialogueId: string) => void;
}) {
  const [dossierAIForId, setDossierAIForId] = useState<string | null>(null);
  const [dossierAIAnswer, setDossierAIAnswer] = useState<AdvisorAIAnswer | null>(null);
  const [dossierAIUsage, setDossierAIUsage] = useState<AdvisorAIUsage | null>(null);
  const [dossierAIStatus, setDossierAIStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [preparedDossierOption, setPreparedDossierOption] = useState<{ title: string; action: PreparedCommonAction; warnings: string[]; decision?: string } | null>(null);
  const rank = { minor: 0, moderate: 1, major: 2, critical: 3 } as const;
  const historicalIntentLabels: Record<HistoricalInterventionDirection, string> = {
    contain: 'Réduire la pression', redirect: 'Rediriger la trajectoire', accelerate: 'Accélérer la trajectoire',
  };
  const dossiers = Object.values(world.strategicDossiers).sort((a, b) => rank[b.importance] - rank[a.importance] || b.updatedAt.localeCompare(a.updatedAt));
  const scheduledReviews = useMemo(() => new globalThis.Map(rankStrategicDossierReviews(world).map((review) => [review.dossierId, review])), [world]);
  const selected = dossiers.find((dossier) => dossier.id === selectedId) ?? dossiers[0];
  const updates = selected ? dossierUpdatesSinceView(world, selected.id) : [];
  const decisionRecords = selected ? dossierDecisionRecords(selected) : [];
  const diplomaticSession = selected ? Object.values(world.diplomaticSessions).find((session) => session.linkedDossierId === selected.id) : undefined;
  const historicalAnchor = selected?.relatedAnchorId ? world.historicalAnchors?.[selected.relatedAnchorId] : undefined;
  const dossierImpact = selected ? dossierPressureProfile(world, selected) : null;
  const resolutionAssessment = selected ? assessDossierResolution(world, selected) : null;
  const campaignCycle = selected?.kind === 'political_transition'
    ? Object.values(world.politicalCycles).find((cycle) => cycle.dossierId === selected.id && cycle.countryId === world.playerCountryId)
    : undefined;
  const campaignAssessment = campaignCycle ? assessPoliticalSupport(world, campaignCycle.countryId, campaignCycle) : undefined;
  const campaignProjection = campaignAssessment
    ? campaignAssessment.supportScore - campaignAssessment.threshold > 8 ? 'Reconduction plutôt favorable'
      : campaignAssessment.supportScore - campaignAssessment.threshold < -8 ? 'Alternance plutôt favorable'
        : 'Scrutin indécis'
    : 'Projection indisponible';
  const chooseCampaignStrategy = (strategy: PoliticalCampaignStrategy) => {
    const next = choosePoliticalCampaignStrategy(world, strategy);
    if (next === world) {
      onNotice('Cette posture ne peut plus être modifiée pour l’échéance en cours.');
      return;
    }
    onWorldChange(next);
    onNotice('Posture de campagne enregistrée : le résultat reste déterminé par la situation du pays.');
  };
  const askDossierAI = async () => {
    if (!selected || dossierAIStatus === 'loading') return;
    const actors = selected.actorIds.map((id) => world.countries[id]?.name ?? id).join(', ');
    const dialogueHistory = Object.values(world.diplomaticDialogues ?? {})
      .filter((dialogue) => dialogue.participantIds.some((id) => selected.actorIds.includes(id)))
      .flatMap((dialogue) => dialogue.turns.slice(-4).map((turn) => `${world.countries[turn.speakerId]?.name ?? turn.speakerId}: ${turn.publicMessage}`))
      .slice(-8);
    const question = `Dossier « ${selected.title} » (${selected.importance}) concernant ${actors || 'les acteurs documentés'}. `
      + `À la date ${world.currentDate}, propose exactement trois réponses concrètes que ${world.countries[world.playerCountryId].name} pourrait envisager. `
      + 'Pour chacune, précise le levier, le calendrier, les réactions plausibles, les avantages, les risques et les conséquences estimées. Ne traite pas cette demande comme une action déjà exécutée.'
      + (dialogueHistory.length ? ` Intègre aussi ces échanges diplomatiques récents, sans les inventer : ${dialogueHistory.join(' | ')}` : '');
    const local = answerAdvisorQuestion(world, question, { questionKind: 'strategy' });
    setDossierAIForId(selected.id); setDossierAIAnswer(null); setDossierAIUsage(null); setDossierAIStatus('loading');
    try {
      const request = createAdvisorAIRequest(world, question, local, worldPulseSessionId());
      const response = await fetch('/api/ai/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
      });
      const payload = await response.json() as AdvisorAIResponse;
      if (!payload.ok) {
        setDossierAIStatus('error');
        onNotice(`Analyse du dossier indisponible : ${payload.message}`);
        return;
      }
      setDossierAIAnswer(payload.answer); setDossierAIUsage(payload.usage); setDossierAIStatus('ready');
    } catch {
      setDossierAIStatus('error');
      onNotice('Le serveur IA est inaccessible ; le dossier reste consultable localement.');
    }
  };
  const prepareDossierOption = (option: AdvisorAIOption) => {
    const result = prepareCommonAction(world, `${option.title}. ${option.proposal}`, { source: 'ai', linkedDossierId: selected.id });
    if (!result.ok) {
      onNotice(`Cette proposition doit être précisée avant exécution : ${result.error}`);
      return;
    }
    setPreparedDossierOption({ title: option.title, action: result.action, warnings: result.warnings });
    onNotice('Option du dossier convertie en programme préparé ; aucun effet appliqué.');
  };
  const launchDossierOption = () => {
    if (!preparedDossierOption) return;
    const result = launchCommonAction(world, preparedDossierOption.action);
    if (!result.ok) { onNotice(result.error); return; }
    const next = preparedDossierOption.decision
      ? resolveDossierDecision(result.state, selected.id, preparedDossierOption.decision, 'local_action')
      : result.state;
    onWorldChange(next);
    setPreparedDossierOption(null);
    onNotice(preparedDossierOption.decision
      ? 'Action locale engagée : la décision est résolue et le programme suivra le dossier dans le temps.'
      : 'Programme lancé depuis le dossier : résolution attendue au fil du temps.');
  };
  const prepareLocalDecision = (decision: string) => {
    const categoryByDossier: Record<StrategicDossier['kind'], CommonActionCategory> = {
      economic: 'economic', security: 'defense', conflict: 'defense', diplomatic_crisis: 'diplomacy', cooperation: 'diplomacy', historical: 'institutional', power_struggle: 'institutional', political_transition: 'institutional',
    };
    const category = categoryByDossier[selected.kind];
    const counterpart = selected.actorIds
      .filter((id) => id !== world.playerCountryId)
      .map((id) => world.countries[id])
      .find(Boolean);
    const targetClause = category === 'diplomacy' && counterpart ? ` avec ${counterpart.name}` : '';
    const categoryText: Record<CommonActionCategory, string> = {
      economic: 'programme économique', diplomacy: 'initiative diplomatique', institutional: 'réforme administrative', defense: 'programme de défense', intelligence: 'opération de renseignement',
    };
    const result = prepareCommonAction(
      world,
      `Lancer un ${categoryText[category]}${targetClause} pour traiter le dossier « ${selected.title} » : ${decision}`,
      { source: 'player', linkedDossierId: selected.id, category },
    );
    if (!result.ok) { onNotice(`Action locale impossible : ${result.error}`); return; }
    setPreparedDossierOption({ title: `Action locale · ${selected.title}`, action: result.action, warnings: result.warnings, decision });
    onNotice('Action locale préparée : confirmez pour engager budget et capacités.');
  };
  const changePreparedDossierCategory = (category: CommonActionCategory) => {
    if (!preparedDossierOption?.decision) return;
    const result = prepareCommonAction(world, preparedDossierOption.action.intent, {
      source: 'player', linkedDossierId: selected.id, category, historicalIntent: preparedDossierOption.action.historicalIntent,
    });
    if (!result.ok) { onNotice(`Ce domaine ne peut pas être préparé : ${result.error}`); return; }
    setPreparedDossierOption({ ...preparedDossierOption, action: result.action, warnings: result.warnings });
    onNotice(`Domaine de l’action modifié : ${programCategoryLabels[category]}.`);
  };
  const changePreparedHistoricalIntent = (historicalIntent: HistoricalInterventionDirection) => {
    if (!preparedDossierOption || !historicalAnchor) return;
    const result = prepareCommonAction(world, preparedDossierOption.action.intent, {
      source: 'player', linkedDossierId: selected.id, category: preparedDossierOption.action.category, historicalIntent,
    });
    if (!result.ok) { onNotice(`Cette posture ne peut pas être préparée : ${result.error}`); return; }
    setPreparedDossierOption({ ...preparedDossierOption, action: result.action, warnings: result.warnings });
    onNotice(`Posture historique sélectionnée : ${historicalIntentLabels[historicalIntent]}.`);
  };
  const resolveDecision = (decision: string, channel: 'local_action' | 'dialogue' | 'delegation' | 'explicit_silence') => {
    if (channel === 'dialogue') {
      const opened = openDiplomaticDialogueForDossier(world, selected.id, undefined, decision);
      if (!opened.ok) { onNotice(opened.error); return; }
      onWorldChange(opened.state); onOpenDiplomacy?.(opened.dialogueId);
      onNotice(`Dialogue ouvert depuis « ${selected.title} » : l’IA prépare directement la première réponse.`);
      return;
    }
    if (channel === 'delegation') {
      const prepared = prepareDossierDelegation(world, selected.id, decision);
      if (!prepared.ok) { onNotice(`Délégation impossible : ${prepared.error}`); return; }
      const launched = launchCommonAction(world, prepared.action);
      if (!launched.ok) { onNotice(`Délégation impossible : ${launched.error}`); return; }
      const next = resolveDossierDecision(launched.state, selected.id, decision, channel);
      onWorldChange(next);
      onNotice(`Dossier délégué : un programme administratif est lancé et sera résolu au fil du temps.`);
      return;
    }
    const next = resolveDossierDecision(world, selected.id, decision, channel);
    if (next === world) return;
    onWorldChange(next);
    onNotice(`Décision enregistrée dans « ${selected.title} » : ${channel === 'explicit_silence' ? 'silence explicite' : 'action gouvernementale'}.`);
  };
  if (!selected) return <div className="border border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">Aucun dossier stratégique connu.</div>;
  return <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
    <section className="border border-border bg-card/70">
      <div className="border-b border-border p-4"><div className="flex items-center gap-2 font-semibold"><Swords className="size-4 text-primary" /> Situations suivies</div><p className="mt-1 text-xs text-muted-foreground">Un dossier conserve sa chronologie, même lorsqu’aucune notification n’interrompt le tour.</p></div>
      <div className="divide-y divide-border/60">{dossiers.map((dossier) => {
        const unread = dossierUnreadCount(world, dossier.id);
        const review = scheduledReviews.get(dossier.id);
        return <button key={dossier.id} onClick={() => onSelect(dossier.id)} className={`w-full p-4 text-left transition-colors hover:bg-muted/30 ${selected.id === dossier.id ? 'bg-muted/30' : ''}`}>
          <div className="flex items-start justify-between gap-3"><div className="font-medium">{dossier.title}</div><span className={`font-mono text-[10px] uppercase ${dossierImportanceTone[dossier.importance]}`}>{dossier.importance}</span></div>
          <div className="mt-1 text-xs text-muted-foreground">{dossier.phase} · {dossier.updatedAt}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">{dossier.followed && <span className="text-primary">Épinglé</span>}{dossier.autoTracked && <span className="text-amber-300">Suivi majeur</span>}{(dossier.escalationCount ?? 0) > 0 && <span className="text-red-300">Relances : {dossier.escalationCount}</span>}{review ? <span className={review.requiresImmediateReview ? 'text-red-300' : 'text-amber-200'}>{review.requiresImmediateReview ? 'Réévaluation prioritaire' : 'Réévaluation possible'}</span> : (dossier.importance === 'major' || dossier.importance === 'critical') && <span className="text-muted-foreground">Sous surveillance · aucun signal neuf</span>}{unread > 0 && <span className="ml-auto bg-primary/15 px-2 py-0.5 text-primary">{unread} nouveau{unread > 1 ? 'x' : ''}</span>}</div>
        </button>;
      })}</div>
    </section>
    <section className="space-y-4">
      <AutonomousProgramsPanel world={world} />
      <div className="border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className={`font-mono text-[10px] uppercase tracking-wider ${dossierImportanceTone[selected.importance]}`}>{selected.kind} · {selected.sleepingAt ? 'en sommeil' : selected.status}</div><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onWorldChange(setDossierFollowed(world, selected.id, !selected.followed))}>{selected.followed ? <PinOff className="size-4" /> : <Pin className="size-4" />}{selected.followed ? 'Ne plus épingler' : 'Épingler'}</Button>{selected.sleepingAt && <Button variant="outline" onClick={() => { onWorldChange(reactivateDossier(world, selected.id)); onNotice('Dossier réactivé dans le suivi actif.'); }}>Réactiver le dossier</Button>}{(selected.importance === 'moderate' || selected.importance === 'major' || selected.importance === 'critical') && <Button onClick={askDossierAI} disabled={dossierAIStatus === 'loading'}>{dossierAIStatus === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}Demander des options à l’IA</Button>}</div></div>
        <p className="mt-3 text-sm text-muted-foreground">{selected.publicSummary}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4"><Stat label="Phase" value={selected.phase} /><Stat label="Tendance" value={selected.trend} /><Stat label="Acteurs" value={selected.actorIds.map((id) => world.countries[id]?.flag ?? id).join(' ')} /><Stat label="Relances" value={String(selected.escalationCount ?? 0)} detail={selected.lastEscalatedAt ? `dernière : ${selected.lastEscalatedAt}` : 'aucune'} /></div>
        {selected.playerStance && <div className="mt-3 border-l-2 border-primary pl-3 text-sm"><b>Position du joueur :</b> {selected.playerStance}</div>}
        {dossierImpact?.active && <div className="mt-4 border border-amber-400/30 bg-amber-300/5 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-mono text-[10px] uppercase tracking-wider text-amber-200">Pressions systémiques</div><span className="font-mono text-[10px] text-emerald-300">Amortissement vérifiable : −{dossierImpact.mitigationPct}%</span></div>
          <p className="mt-2 text-muted-foreground">Effets bornés, appliqués à la frontière mensuelle puis transmis par le moteur économique et relationnel. Ils disparaissent progressivement lorsque le dossier se résorbe.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{dossierImpact.pressures.map((pressure) => <div key={`${pressure.channel}-${pressure.direction}`} className={`border p-2 ${pressure.direction === 'support' ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-amber-400/25 bg-background/25'}`}><div className="flex items-center justify-between gap-2"><b>{pressure.label}</b><span className={pressure.direction === 'support' ? 'text-emerald-300' : 'text-amber-200'}>{pressure.direction === 'support' ? 'Soutien' : 'Pression'} {pressure.level}/100</span></div><p className="mt-1 text-[11px] text-muted-foreground">{pressure.summary}</p></div>)}</div>
          {dossierImpact.mitigationSources.length > 0 && <div className="mt-3 border-t border-amber-400/20 pt-2"><b>Origine de l’amortissement</b><ul className="mt-1 space-y-1 text-muted-foreground">{dossierImpact.mitigationSources.map((source, index) => <li key={`${source.label}-${index}`}>— {source.label} : <span className={source.value >= 0 ? 'text-emerald-300' : 'text-red-300'}>{source.value >= 0 ? '+' : ''}{source.value} points</span></li>)}</ul></div>}
          {selected.impactState && <div className="mt-2 font-mono text-[10px] text-muted-foreground">Dernier calcul enregistré : {selected.impactState.lastAppliedAt}</div>}
        </div>}
        {resolutionAssessment && <div className="mt-4 border border-border bg-background/25 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Trajectoire de sortie</div><span className={resolutionAssessment.stage === 'resolved' || resolutionAssessment.stage === 'stabilising' ? 'text-emerald-300' : 'text-amber-200'}>{resolutionAssessment.stage === 'resolved' ? 'Clos' : resolutionAssessment.stage === 'stabilising' ? 'Stabilisation acquise' : resolutionAssessment.stage === 'blocked' ? 'Conditions non réunies' : 'Situation active'}</span></div>
          <p className="mt-2"><b>Prochaine étape :</b> {resolutionAssessment.nextMilestone}</p>
          {resolutionAssessment.positiveSignals.length > 0 && <div className="mt-2 text-emerald-200"><b>Signaux favorables :</b> {resolutionAssessment.positiveSignals.join(' · ')}</div>}
          {resolutionAssessment.blockers.length > 0 && <div className="mt-2 text-muted-foreground"><b>Obstacles :</b> {resolutionAssessment.blockers.join(' · ')}</div>}
        </div>}
        {historicalAnchor && <div className="mt-4 border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs">
          <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-200">Ancrage historique · {historicalAnchor.status}</div>
          <p className="mt-2"><b>Tendance de fond :</b> {historicalAnchor.trendSummary}</p>
          <p className="mt-2"><b>Invariants :</b> {historicalAnchor.invariants.join(' · ')}</p>
          <p className="mt-2"><b>Manifestations possibles :</b> {historicalAnchor.possibleManifestations.join(' · ')}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground"><span>Fenêtre : {historicalAnchor.probableWindow.start} → {historicalAnchor.probableWindow.end}</span><span>Pression : {historicalAnchor.pressure.toFixed(0)}/100</span><span>Influence joueur : {historicalAnchor.playerInfluence}</span>{historicalAnchor.interventionBalance !== undefined && <span>Impact cumulé : {historicalAnchor.interventionBalance > 0 ? '+' : ''}{historicalAnchor.interventionBalance.toFixed(1)}</span>}</div>
          {historicalAnchor.divergence && <p className="mt-2 border-l-2 border-cyan-300 pl-2 text-cyan-100"><b>Divergence :</b> {historicalAnchor.divergence.summary}</p>}
        </div>}
      </div>
      {campaignCycle && campaignCycle.status === 'campaign' && <div className="border border-violet-400/35 bg-violet-400/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-wider text-violet-200">Échéance nationale · décision politique</div><h3 className="mt-1 text-lg font-semibold">Choisir la posture du gouvernement</h3></div><div className="text-right text-xs"><div className="text-muted-foreground">Projection actuelle</div><div className="font-mono text-base text-violet-100">{campaignProjection}</div></div></div>
        <p className="mt-2 text-sm text-muted-foreground">Ces postures consomment des moyens réels ou modifient la stabilité de la transition. Aucune ne choisit directement le vainqueur.</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">{politicalCampaignOptions.map((option) => {
          const selectedStrategy = campaignCycle.campaignStrategy === option.id;
          return <div key={option.id} className={`border p-3 ${selectedStrategy ? 'border-violet-300 bg-violet-300/10' : 'border-border bg-background/25'}`}><div className="font-semibold">{option.title}</div><p className="mt-2 text-xs text-muted-foreground">{option.summary}</p><p className="mt-3 text-xs"><b>Engagement :</b> {option.cost}</p><p className="mt-1 text-xs text-amber-200"><b>Risque :</b> {option.risk}</p><Button className="mt-3 w-full" size="sm" variant={selectedStrategy ? 'default' : 'outline'} disabled={Boolean(campaignCycle.campaignStrategy)} onClick={() => chooseCampaignStrategy(option.id)}>{selectedStrategy ? 'Posture engagée' : 'Choisir cette posture'}</Button></div>;
        })}</div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">{campaignAssessment?.factors.filter((factor) => factor.label !== 'Posture de campagne').map((factor) => <div key={factor.label} className="border border-border/70 bg-background/25 p-2"><span className="text-muted-foreground">{factor.label}</span><div className="mt-1 font-mono">{factor.value.toFixed(1)}</div></div>)}</div>
      </div>}
      {dossierAIForId === selected.id && dossierAIAnswer && <div className="border border-primary/45 bg-card/80 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Options IA · consultatives</div>
        <h3 className="mt-1 text-lg font-semibold">{dossierAIAnswer.headline}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{dossierAIAnswer.synthesis}</p>
        <div className="mt-3 space-y-2">{dossierAIAnswer.options.map((option, index) => <details key={`${option.title}-${index}`} className="border border-border bg-background/30 p-3"><summary className="cursor-pointer font-semibold">{index + 1}. {option.title}</summary><p className="mt-2 text-sm">{option.proposal}</p><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><p><b className="text-emerald-300">Pourquoi c’est plausible :</b> {option.whyPlausible}</p><p><b className="text-amber-300">Pourquoi cela peut échouer :</b> {option.whyRefused}</p></div><div className="mt-2 text-xs text-muted-foreground"><b>Conséquences :</b> {option.estimatedConsequences.join(' · ')}</div><Button size="sm" variant="outline" className="mt-3" onClick={() => prepareDossierOption(option)}><CheckCircle2 className="size-3" />Préparer cette option</Button></details>)}</div>
        {dossierAIUsage && <div className="mt-3 font-mono text-[10px] text-muted-foreground">{dossierAIUsage.inputTokens} jetons entrants · {dossierAIUsage.outputTokens} sortants · coût estimé ${dossierAIUsage.estimatedCostUsd.toFixed(4)} · {dossierAIUsage.latencyMs / 1000}s</div>}
        <div className="mt-2 text-xs text-muted-foreground">Ces options n’appliquent aucun effet. Pour agir, préparez ensuite une action depuis le Conseiller.</div>
      </div>}
      {preparedDossierOption && <div className="border border-primary/45 bg-card/80 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Programme préparé · confirmation requise</div>
        <h3 className="mt-1 font-semibold">{preparedDossierOption.title}</h3>
        {preparedDossierOption.decision && <p className="mt-2 border-l-2 border-primary pl-3 text-xs text-muted-foreground"><b>Décision concernée :</b> {preparedDossierOption.decision}</p>}
        {preparedDossierOption.decision && <label className="mt-3 flex max-w-sm flex-col gap-1 text-xs"><span className="font-semibold">Domaine proposé · modifiable</span><select className="border border-border bg-background px-2 py-1.5" value={preparedDossierOption.action.category} onChange={(event) => changePreparedDossierCategory(event.target.value as CommonActionCategory)}>{Object.entries(programCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {historicalAnchor && preparedDossierOption.action.historicalIntent && <label className="mt-3 flex max-w-sm flex-col gap-1 text-xs"><span className="font-semibold">Effet recherché sur la trajectoire</span><select className="border border-cyan-300/35 bg-background px-2 py-1.5" value={preparedDossierOption.action.historicalIntent} onChange={(event) => changePreparedHistoricalIntent(event.target.value as HistoricalInterventionDirection)}>{Object.entries(historicalIntentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="text-muted-foreground">L’effet dépendra de l’issue du programme, de votre influence réelle et des interventions déjà engagées.</span></label>}
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3"><Stat label="Domaine" value={preparedDossierOption.action.category} /><Stat label="Durée" value={`${preparedDossierOption.action.durationMonths} mois`} /><Stat label="Budget" value={`${preparedDossierOption.action.budgetCost.toFixed(1)} unités`} /></div>
        {preparedDossierOption.warnings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-300">{preparedDossierOption.warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}</ul>}
        <div className="mt-3 flex flex-wrap gap-2"><Button onClick={launchDossierOption}><CheckCircle2 className="size-4" />Confirmer et lancer</Button><Button variant="outline" onClick={() => setPreparedDossierOption(null)}>Annuler</Button></div>
      </div>}
      {dossierAIForId === selected.id && dossierAIStatus === 'error' && <div className="border border-amber-400/40 bg-card/70 p-3 text-sm text-amber-200">L’analyse IA n’a pas abouti. Le dossier et son analyse locale restent disponibles.</div>}
      {(decisionRecords.length > 0 || selected.commitments.length > 0) && <div className="grid gap-3 lg:grid-cols-2">
        <div className="border border-border bg-card/70 p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-amber-300">Décisions attendues</div>{decisionRecords.length ? <div className="mt-3 space-y-3">{decisionRecords.map((decision) => <div key={decision.id} className="border border-amber-300/30 bg-amber-300/5 p-3"><div className="text-sm">{decision.prompt}</div><div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground"><span>urgence {decisionUrgencyLabels[decision.urgency] ?? decision.urgency}</span><span>origine : {decisionSourceLabels[decision.sourceKind] ?? decision.sourceKind}</span>{decision.sourceLabel && <span>· {decision.sourceLabel}</span>}</div><div className="mt-1 text-[11px] text-muted-foreground">Acteurs : {decision.actorIds.map((id) => world.countries[id]?.name ?? id).join(', ')} · canaux : {decision.availableChannels.map((channel) => decisionChannelLabels[channel] ?? channel).join(', ')}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => prepareLocalDecision(decision.prompt)}>Préparer une action locale</Button><Button size="sm" variant="outline" onClick={() => resolveDecision(decision.prompt, 'dialogue')}>Ouvrir un dialogue</Button><Button size="sm" variant="outline" onClick={() => resolveDecision(decision.prompt, 'delegation')}>Déléguer</Button><Button size="sm" variant="ghost" onClick={() => resolveDecision(decision.prompt, 'explicit_silence')}>Garder le silence</Button></div></div>)}</div> : <div className="mt-2 text-sm text-muted-foreground">Aucun arbitrage immédiat.</div>}</div>
        <div className="border border-border bg-card/70 p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">Engagements mémorisés</div><ul className="mt-2 space-y-2 text-sm">{selected.commitments.length ? selected.commitments.map((item) => <li key={item}>— {item}</li>) : <li className="text-muted-foreground">Aucun engagement formel.</li>}</ul></div>
      </div>}
      {diplomaticSession && <div className="border border-border bg-card/70">
        <div className="border-b border-border p-4"><div className="font-semibold">Échanges diplomatiques conservés</div><div className="mt-1 text-xs text-muted-foreground">Statut : {diplomaticSession.status} · résolution {diplomaticSession.aiMode === 'ai' ? 'Luna' : 'moteur local'}</div></div>
        <div className="divide-y divide-border/60">{diplomaticSession.turns.map((turn) => <div key={turn.id} className="p-4"><div className="text-xs font-semibold">{world.countries[turn.speakerId]?.flag} {world.countries[turn.speakerId]?.name ?? turn.speakerId}</div><p className="mt-1 text-sm text-muted-foreground">{turn.publicMessage}</p></div>)}</div>
      </div>}
      <div className="border border-border bg-card/70">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4"><div><div className="font-semibold">Chronologie du dossier</div><div className="text-xs text-muted-foreground">{updates.length} changement(s) depuis la dernière consultation</div></div>{updates.length > 0 && <Button size="sm" variant="outline" onClick={() => onWorldChange(markDossierViewed(world, selected.id))}><Eye className="size-4" /> Marquer comme consulté</Button>}</div>
        <div className="divide-y divide-border/60">{selected.entries.slice().reverse().map((entry) => <div key={entry.id} className={`p-4 ${updates.some((update) => update.id === entry.id) ? 'bg-primary/5' : ''}`}><div className="flex items-center justify-between gap-3"><div className="font-medium">{entry.title}</div><span className="font-mono text-[10px] text-muted-foreground">{entry.date}</span></div><p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>{entry.requiresDecision && <div className="mt-2 text-xs text-amber-300">Décision du joueur requise</div>}</div>)}</div>
      </div>
    </section>
  </div>;
}

function DiplomacyPanel({ world, onWorldChange, onNotice, initialDialogueId }: {
  world: WorldState;
  onWorldChange: (world: WorldState) => void;
  onNotice: (message: string) => void;
  initialDialogueId?: string | null;
}) {
  const worldRef = useRef(world);
  useEffect(() => { worldRef.current = world; }, [world]);
  const player = world.countries[world.playerCountryId];
  const countries = useMemo(() => Object.values(world.countries)
    .filter((country) => country.id !== world.playerCountryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr')), [world.countries, world.playerCountryId]);
  const [countrySearch, setCountrySearch] = useState('');
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!query) return countries;
    return countries.filter((country) => country.name.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith(query));
  }, [countries, countrySearch]);
  const [selectedId, setSelectedId] = useState(countries[0]?.id ?? '');
  const [participants, setParticipants] = useState<string[]>(countries[0]?.id ? [countries[0].id] : []);
  const [dialogueId, setDialogueId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [lastAIUsage, setLastAIUsage] = useState<string | undefined>();
  const autoStartedDialogueIds = useRef(new Set<string>());
  const dialogue = dialogueId ? world.diplomaticDialogues?.[dialogueId] : undefined;
  useEffect(() => {
    if (!initialDialogueId || !world.diplomaticDialogues?.[initialDialogueId]) return;
    const target = world.diplomaticDialogues[initialDialogueId];
    setDialogueId(initialDialogueId);
    setSelectedId(target.activeSpeakerId === player.id ? target.participantIds.find((id) => id !== player.id) ?? target.activeSpeakerId : target.activeSpeakerId);
    setOpen(true);
  }, [initialDialogueId, world.diplomaticDialogues, player.id]);
  const recentDialogues = Object.values(world.diplomaticDialogues ?? {}).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sheetCountries = filteredCountries.map((country) => {
    const relation = world.relations[`${player.id}:${country.id}`] ?? world.relations[`${country.id}:${player.id}`];
    const sheet = countrySheet(world, country.id);
    return {
      id: country.id, name: country.name, flag: country.flag, role: country.politics.governmentLabel,
      posture: relation && relation.relation >= 65 ? 'Partenaire actif' : relation && relation.relation <= 35 ? 'Rival sous tension' : 'Relation de travail',
      relation: Math.round(relation?.relation ?? sheet?.relation?.value ?? 50), trust: Math.round(relation?.trust ?? sheet?.relation?.trust ?? 50),
      interests: country.strategy.goals.filter((goal) => goal.status === 'active').slice(0, 4).map((goal) => goal.label),
      redLines: country.strategy.redLines.slice(0, 4),
    };
  });
  const selectedSheetCountry = sheetCountries.find((item) => item.id === selectedId) ?? sheetCountries[0] ?? {
    id: player.id, name: player.name, flag: player.flag, role: player.politics.governmentLabel, posture: 'Canal national', relation: 50, trust: 50, interests: [], redLines: [],
  };
  const participantOptions = sheetCountries.filter((country) => !dialogue?.participantIds.includes(country.id));
  const messages = dialogue?.turns.map((turn, index) => ({
    id: index, author: turn.speakerId === player.id ? 'player' as const : 'foreign' as const,
    text: turn.publicMessage, meta: `${world.countries[turn.speakerId]?.name ?? turn.speakerId} · ${turn.date}`,
  })) ?? [];
  const quickReplies = dialogue ? [
    { label: 'Accepter', value: 'Nous acceptons cette orientation sous réserve de formaliser les garanties proposées.' },
    { label: 'Refuser', value: 'Nous ne pouvons pas accepter cette proposition dans sa forme actuelle.' },
    { label: 'Contre-proposer', value: 'Nous formulons une contre-proposition et vous invitons à préciser vos conditions minimales.' },
    { label: 'Demander des précisions', value: 'Avant de nous engager, nous demandons des précisions sur les garanties, le calendrier et les conséquences.' },
  ] : [];
  const openNewDialogue = () => {
    const ids = participants.length ? participants : (selectedId ? [selectedId] : []);
    if (!ids.length) { onNotice('Sélectionnez au moins un interlocuteur.'); return; }
    setDialogueId(null); setSelectedId(ids[0]); setDraft(''); setOpen(true);
  };
  const openIndependentDialogue = () => {
    const targetId = selectedId || countries[0]?.id;
    if (!targetId) { onNotice('Sélectionnez un interlocuteur.'); return; }
    setParticipants([targetId]);
    setDialogueId(null);
    setSelectedId(targetId);
    setDraft('');
    setOpen(true);
  };
  const send = () => {
    if (!draft.trim()) return;
    const currentWorld = worldRef.current;
    if (dialogue) {
      const result = sendDiplomaticDialogueMessage(currentWorld, dialogue.id, draft);
      if (!result.ok) { onNotice(result.error); return; }
      onWorldChange(result.state); setDraft(''); setSelectedId(result.speakerId);
      onNotice('Message envoyé. La réponse IA reste facultative et nécessite votre confirmation.');
      return;
    }
    const result = openDiplomaticDialogue(currentWorld, participants.length ? participants : [selectedId], draft);
    if (!result.ok) { onNotice(result.error); return; }
    onWorldChange(result.state); setDialogueId(result.dialogueId); setDraft('');
    setIsThinking(true);
    setLastAIUsage(undefined);
    onNotice('Dialogue ouvert : l’IA prépare la première réponse…');
    const request = requestDiplomaticDialogueAI(result.state, result.dialogueId);
    if (!request.ok) { setIsThinking(false); onNotice(request.error); return; }
    onWorldChange(request.state);
    void executeAIJob(request.state, request.jobId, worldPulseSessionId()).then((aiResult) => {
      if (!aiResult.ok) { onNotice(`Première réponse IA indisponible : ${aiResult.response.message}`); return; }
      onWorldChange(aiResult.state);
      const usage = aiResult.response.usage;
      setLastAIUsage(`${usage.inputTokens} entrées · ${usage.outputTokens} sorties · $${usage.estimatedCostUsd.toFixed(4)}`);
      const updated = aiResult.state.diplomaticDialogues[result.dialogueId];
      if (updated) setSelectedId(updated.activeSpeakerId);
      onNotice('Première réponse diplomatique IA reçue.');
    }).catch(() => onNotice('Le serveur IA est inaccessible ; le dialogue reste en attente.'))
      .finally(() => setIsThinking(false));
  };
  const askAI = async () => {
    if (!dialogue || dialogue.status !== 'awaiting_ai' || isThinking) return;
    const currentWorld = worldRef.current;
    const request = requestDiplomaticDialogueAI(currentWorld, dialogue.id);
    if (!request.ok) { onNotice(request.error); return; }
    onWorldChange(request.state); setIsThinking(true); setLastAIUsage(undefined);
    try {
      const result = await executeAIJob(request.state, request.jobId, worldPulseSessionId());
      if (!result.ok) { onNotice(`Réponse IA indisponible : ${result.response.message}`); return; }
      onWorldChange(result.state);
      const usage = result.response.usage;
      setLastAIUsage(`${usage.inputTokens} entrées · ${usage.outputTokens} sorties · $${usage.estimatedCostUsd.toFixed(4)}`);
      const updated = result.state.diplomaticDialogues[dialogue.id];
      if (updated) setSelectedId(updated.activeSpeakerId);
      onNotice('Réponse diplomatique IA reçue et ajoutée à la mémoire du dialogue.');
    } catch { onNotice('Le serveur IA est inaccessible ; aucun effet diplomatique n’a été appliqué.'); }
    finally { setIsThinking(false); }
  };
  useEffect(() => {
    if (!initialDialogueId || !dialogue || dialogue.id !== initialDialogueId || dialogue.status !== 'awaiting_ai' || autoStartedDialogueIds.current.has(initialDialogueId)) return;
    autoStartedDialogueIds.current.add(initialDialogueId);
    const currentWorld = worldRef.current;
    const request = requestDiplomaticDialogueAI(currentWorld, initialDialogueId);
    if (!request.ok) { onNotice(request.error); return; }
    onWorldChange(request.state);
    setIsThinking(true);
    setLastAIUsage(undefined);
    void executeAIJob(request.state, request.jobId, worldPulseSessionId()).then((result) => {
      if (!result.ok) { onNotice(`Première réponse IA indisponible : ${result.response.message}`); return; }
      onWorldChange(result.state);
      const usage = result.response.usage;
      setLastAIUsage(`${usage.inputTokens} entrées · ${usage.outputTokens} sorties · $${usage.estimatedCostUsd.toFixed(4)}`);
      const updated = result.state.diplomaticDialogues[initialDialogueId];
      if (updated) setSelectedId(updated.activeSpeakerId);
      onNotice('Première réponse diplomatique IA reçue.');
    }).catch(() => onNotice('Le serveur IA est inaccessible ; le dialogue reste en attente.'))
      .finally(() => setIsThinking(false));
  }, [dialogue, initialDialogueId, onNotice, onWorldChange]);
  const resolveResponse = (decision: 'accept' | 'refuse' | 'request_revision' | 'acknowledge') => {
    if (!dialogue) return;
    const result = resolveDiplomaticDialogueResponse(worldRef.current, dialogue.id, decision);
    if (!result.ok) { onNotice(result.error); return; }
    onWorldChange(result.state);
    onNotice(decision === 'accept' ? 'Engagement diplomatique inscrit dans le moteur et le registre.' : decision === 'refuse' ? 'Position refusée : le canal est fermé.' : decision === 'acknowledge' ? 'Position reçue : aucun engagement formel n’a été créé.' : 'Révision demandée : confirmez ensuite l’appel IA pour obtenir une nouvelle réponse.');
  };
  const addParticipant = (countryId: string) => {
    if (!dialogue) return;
    const result = addDiplomaticDialogueParticipant(worldRef.current, dialogue.id, countryId);
    if (!result.ok) { onNotice(result.error); return; }
    onWorldChange(result.state); setSelectedId(countryId);
    onNotice(`${world.countries[countryId]?.name ?? countryId} a rejoint le canal diplomatique.`);
  };
  const selectDialogue = (id: string) => {
    const target = worldRef.current.diplomaticDialogues?.[id];
    if (!target) return;
    setDialogueId(id);
    setSelectedId(target.activeSpeakerId === player.id ? target.participantIds.find((participantId) => participantId !== player.id) ?? target.activeSpeakerId : target.activeSpeakerId);
    setOpen(true);
  };
  const memories = selectedId ? [
    ...(world.relations[`${player.id}:${selectedId}`]?.memories ?? world.relations[`${selectedId}:${player.id}`]?.memories ?? []).slice(-4),
    ...(dialogue ? [`Canal ${dialogue.kind === 'multilateral_dialogue' ? 'multilatéral' : 'bilatéral'} · ${dialogue.turns.length} échanges · ${dialogue.status}`] : []),
  ] : [];
  const agreements = selectedId ? Object.values(world.treaties ?? {})
    .filter((treaty) => treaty.status === 'active' && treaty.parties.includes(selectedId))
    .map((treaty) => treaty.label)
    .slice(-6) : [];
  return <div className="space-y-4">
    <section className="border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Send className="size-4 text-primary" /> Centre diplomatique</div><p className="mt-1 text-xs text-muted-foreground">Ouvrez un canal avec n’importe quel pays. La première réponse est générée par IA ; les suivantes restent lancées explicitement.</p></div><Button onClick={openNewDialogue}>Nouveau dialogue</Button></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <label className="text-xs text-muted-foreground">Pays participants (Ctrl/Cmd pour un groupe)
          <input value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} placeholder="Rechercher par début du nom…" aria-label="Rechercher un pays" className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
          <select multiple value={participants} onChange={(event) => setParticipants(Array.from(event.target.selectedOptions, (option) => option.value))} className="mt-1 min-h-28 w-full border border-border bg-background p-2 text-sm">{filteredCountries.map((country) => <option key={country.id} value={country.id}>{country.flag} {country.name}</option>)}</select>
        </label>
        <div><div className="text-xs text-muted-foreground">Dialogues mémorisés</div><div className="mt-1 max-h-28 space-y-1 overflow-y-auto">{recentDialogues.length ? recentDialogues.slice(0, 8).map((item) => <button key={item.id} onClick={() => selectDialogue(item.id)} className={`block w-full border px-2 py-1 text-left text-xs ${dialogueId === item.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/30'}`}>{item.kind === 'multilateral_dialogue' ? 'Groupe' : 'Bilatéral'} · {item.participantIds.filter((id) => id !== player.id).map((id) => world.countries[id]?.name ?? id).join(', ')} · {item.status}</button>) : <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">Aucun dialogue ouvert.</p>}</div></div>
      </div>
      {lastAIUsage && <div className="mt-3 font-mono text-[10px] text-muted-foreground">Dernier appel : {lastAIUsage}</div>}
    </section>
    <DiplomacySheet open={open} onOpenChange={setOpen} countries={sheetCountries} selectedId={selectedSheetCountry.id} participantIds={dialogue?.participantIds} participantOptions={dialogue ? participantOptions : []} onAddParticipant={dialogue ? addParticipant : undefined} dialogues={recentDialogues.slice(0, 8).map((item) => ({ id: item.id, kind: item.kind, participantIds: item.participantIds, status: item.status, label: item.participantIds.filter((id) => id !== player.id).map((id) => world.countries[id]?.name ?? id).join(', ') }))} selectedDialogueId={dialogueId} onSelectDialogue={selectDialogue} onNewDialogue={openIndependentDialogue} onSelectCountry={(id) => { if (dialogue && !dialogue.participantIds.includes(id)) return; setSelectedId(id); }} selectedCountry={selectedSheetCountry} messages={messages} structuredResponse={dialogue?.lastResponse} responseResolution={dialogue?.resolution} onResolveResponse={dialogue?.status === 'awaiting_player' && dialogue?.lastResponse && !dialogue?.resolution ? resolveResponse : undefined} draft={draft} onDraftChange={setDraft} onSend={send} isThinking={isThinking} playerCountryName={player.name} participantCount={dialogue?.participantIds.length ?? (participants.length + 1)} activeSpeakerLabel={dialogue ? (world.countries[dialogue.activeSpeakerId]?.name ?? dialogue.activeSpeakerId) : undefined} statusLabel={!dialogue ? 'Aucun canal ouvert — rédigez le premier message' : dialogue.status === 'awaiting_ai' ? 'Réponse IA disponible — validation explicite nécessaire' : dialogue.status === 'awaiting_player' ? 'Votre tour — vous pouvez répondre ou demander une option structurée' : 'Canal fermé'} quickReplies={dialogue?.status === 'awaiting_player' ? quickReplies : []} onQuickReply={(value) => setDraft(value)} canRequestAI={Boolean(dialogue && dialogue.status === 'awaiting_ai')} onRequestAI={askAI} memories={memories} agreements={agreements} onResolveEvent={() => undefined} />
  </div>;
}

function LedgerPanel({ world }: { world: WorldState }) {
  const entries = visibleLedger(world).slice(-120).reverse();
  return <div className="border border-border bg-card/70">
    <div className="border-b border-border p-4"><div className="font-semibold">Registre causal lisible par le joueur</div><p className="mt-1 text-xs text-muted-foreground">Chaque modification conserve la cause, l’acteur, l’origine, l’avant et l’après. Les entrées secrètes ou de débogage restent masquées.</p></div>
    <div className="divide-y divide-border/60">{entries.length ? entries.map((entry) => <div key={entry.id} className="grid gap-2 p-3 text-sm md:grid-cols-[90px_70px_1fr_1.3fr]"><span className="font-mono text-[10px] text-muted-foreground">{entry.date}</span><span className="font-mono text-[10px] uppercase text-primary">{entry.origin}</span><span className="break-all text-xs">{entry.path}</span><span className="text-xs text-muted-foreground">{entry.reason}</span></div>) : <div className="p-8 text-center text-sm text-muted-foreground">Aucune modification visible. Avancez la simulation.</div>}</div>
  </div>;
}

function TurnBriefingPanel({ briefing, onOpenDossier }: { briefing: TurnBriefing; onOpenDossier: (id: string) => void }) {
  const tone = { major: 'text-red-300', moderate: 'text-amber-300', positive: 'text-emerald-300', neutral: 'text-muted-foreground' } as const;
  const signed = (value: number, digits: number, unit: string) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
  const calm = briefing.highlights.length === 0 && briefing.completedPrograms.length === 0;
  return <details open className="group border-b border-border bg-card/55">
    <summary className="mx-auto flex max-w-[1600px] cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm lg:px-6">
      <ChevronRight className="size-4 text-primary transition-transform group-open:rotate-90" />
      <b>Bilan du passage du temps</b>
      <span className="text-xs text-muted-foreground">{briefing.from} → {briefing.to} · {briefing.actionCount} évolution(s) · {briefing.autonomousActorCount} acteur(s) étranger(s)</span>
    </summary>
    <div className="mx-auto grid max-w-[1600px] gap-3 px-4 pb-4 lg:grid-cols-[1.1fr_1fr] lg:px-6">
      <section className="border border-border bg-background/35 p-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Indicateurs du pays joué</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{briefing.metrics.map((item) => <div key={item.id} className="border border-border/70 p-2 text-xs"><div className="text-muted-foreground">{item.label}</div><div className="mt-1 flex items-baseline justify-between gap-2"><b>{item.after.toFixed(item.digits)}{item.unit}</b><span className={item.delta === 0 ? 'text-muted-foreground' : item.delta > 0 ? 'text-sky-300' : 'text-amber-300'}>{signed(item.delta, item.digits, item.unit)}</span></div></div>)}</div>
      </section>
      <section className="border border-border bg-background/35 p-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Faits à retenir</div>
        <div className="mt-2 space-y-2">{calm && <p className="text-xs text-muted-foreground">Aucun basculement majeur : les systèmes ont évolué sans ouvrir de nouvelle décision.</p>}{briefing.highlights.map((item) => <button key={item.id} type="button" onClick={() => item.dossierId && onOpenDossier(item.dossierId)} disabled={!item.dossierId} className="block w-full border-b border-border/60 pb-2 text-left disabled:cursor-default"><div className={`text-xs font-medium ${tone[item.tone]}`}>{item.title}</div><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.detail}</p></button>)}{briefing.completedPrograms.map((program) => <div key={program.id} className="border-b border-border/60 pb-2"><div className={program.status === 'succeeded' ? 'text-xs font-medium text-emerald-300' : program.status === 'failed' ? 'text-xs font-medium text-red-300' : 'text-xs font-medium text-amber-300'}>{program.title} · {program.status}</div><p className="mt-1 text-[11px] text-muted-foreground">{program.resolution}</p></div>)}</div>
      </section>
    </div>
  </details>;
}

export default function Home() {
  const [world, setWorld] = useState<WorldState>(() => createWorld2000('FRA'));
  const [startingCountryId, setStartingCountryId] = useState<string>('FRA');
  const [pulseAudit, setPulseAudit] = useState<WorldPulseAIAuditEntry[]>(readWorldPulseAudit);
  const [panel, setPanel] = useState<Panel>('map');
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [selectedDialogueId, setSelectedDialogueId] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scénario France · 1er janvier 2000 chargé.');
  const [lastBriefing, setLastBriefing] = useState<TurnBriefing | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const player = world.countries[world.playerCountryId];
  useEffect(() => { setStartingCountryId(world.playerCountryId); }, [world.playerCountryId]);
  const autonomousCount = useMemo(() => new Set(world.actions.filter((action) => action.origin === 'local_rule').map((action) => action.actorId)).size, [world.actions]);
  const dossierAlerts = useMemo(() => dossiersRequiringAttention(world), [world]);
  const openDossier = (id: string) => { setSelectedDossierId(id); setPanel('dossiers'); };

  const advance = async (months: number) => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    const before = world;
    const requestedDate = addMonths(before.currentDate, months);
    const result = advanceWorld(before, requestedDate, politicalCycleStops(before, requestedDate));
    setWorld(result.state);
    setLastBriefing(buildTurnBriefing(before, result.state));
    const countries = [...new Set(result.reviewedCountryIds)].map((id) => result.state.countries[id]?.name).filter(Boolean);
    const auditNotice = result.audit.ok ? '' : ` · audit : ${result.audit.issues[0] ?? 'incohérence détectée'}`;
    const stopNotice = result.stop ? ` · arrêt : ${result.stop.title}` : '';
    const baseNotice = `${result.elapsedDays} jours simulés · ${countries.length} État(s) réévalué(s)${result.manifestations.length ? ` · ${result.manifestations.length} manifestation(s) historique(s)` : ''}${stopNotice}${auditNotice}`;
    setNotice(`${baseNotice} · pouls mondial IA en cours…`);
    try {
      // Les actions du joueur précèdent nécessairement le clic d'avance. On les
      // récupère donc depuis la dernière frontière de temps, pas seulement parmi
      // les actions ajoutées par advanceWorld dans cet appel.
      const lastTimeAdvance = before.actions.map((action) => action.kind).lastIndexOf('time_advance');
      const request = createWorldPulseRequest(result.state, lastTimeAdvance + 1, result.elapsedMonths, worldPulseSessionId());
      const pulse = await executeWorldPulse(result.state, request);
      if (pulse.response) {
        setPulseAudit((previous) => {
          const next = [{ id: `${request.pulseId}-${Date.now()}`, createdAt: new Date().toISOString(), currentDate: result.state.currentDate, response: pulse.response! }, ...previous].slice(0, worldPulseAuditMaximumEntries);
          localStorage.setItem(worldPulseAuditStorageKey, JSON.stringify(next));
          return next;
        });
      }
      setWorld(pulse.state);
      setLastBriefing(buildTurnBriefing(before, pulse.state));
      const touched = pulse.createdDossierIds.length + pulse.updatedDossierIds.length;
      if (pulse.createdDossierIds.length) setSelectedDossierId(pulse.createdDossierIds[0]);
      if (pulse.ok) {
        setNotice(`${baseNotice} · pouls IA : ${touched} dossier(s), ${pulse.relationChanges} relation(s) actualisée(s)${pulse.manifestedAnchorIds.length ? ` · ${pulse.manifestedAnchorIds.length} manifestation(s) historique(s)` : ''}${pulse.queuedAutonomousPrograms ? ` · ${pulse.queuedAutonomousPrograms} programme(s) autonome(s) en file` : ''}${pulse.playerDecisions ? ` · ${pulse.playerDecisions} décision(s) attendue(s)` : ''}.`);
      } else {
        const fallback = pulse.fallbackApplied ? ` · simulation locale conservée pour ${pulse.fallbackApplied} mission(s)` : '';
        const historicalFallback = pulse.manifestedAnchorIds.length ? ` · ${pulse.manifestedAnchorIds.length} manifestation(s) historique(s) assurée(s) localement` : '';
        setNotice(`${baseNotice} · pouls IA partiel : ${touched} dossier(s) appliqué(s)${pulse.queuedAutonomousPrograms ? ` · ${pulse.queuedAutonomousPrograms} programme(s) autonome(s) en file` : ''}${historicalFallback}${fallback}${pulse.errors.length ? ` · ${pulse.errors[0]}` : ''}.`);
      }
    } catch {
      // Le tour local reste valable même si le navigateur ne peut pas lancer le pouls.
      setNotice(`${baseNotice} · le pouls IA n’a pas pu démarrer ; le monde local reste cohérent.`);
    } finally {
      setIsAdvancing(false);
    }
  };
  const save = async () => {
    try {
      const result = await saveWorldToBrowser(world);
      setNotice(`Sauvegarde compressée créée · ${(result.storedBytes / 1024 / 1024).toFixed(2)} Mo stockés (état brut ${(result.rawBytes / 1024 / 1024).toFixed(2)} Mo).`);
    } catch {
      setNotice('La sauvegarde locale a échoué : stockage du navigateur indisponible ou saturé.');
    }
  };
  const load = async () => {
    try {
      const restored = await loadWorldFromBrowser();
      if (!restored) return setNotice('Aucune sauvegarde locale.');
      setWorld(restored);
      setLastBriefing(null);
      setNotice('Sauvegarde locale restaurée.');
    } catch {
      setNotice('La sauvegarde locale est illisible ou obsolète.');
    }
  };
  const reset = () => { setWorld(createWorld2000(world.playerCountryId)); setLastBriefing(null); setNotice(`Scénario ${player.name} · 2000 réinitialisé.`); };
  const startCountryGame = () => {
    const next = createWorld2000(startingCountryId);
    setWorld(next); setLastBriefing(null); setSelectedDossierId(null); setSelectedDialogueId(null); setPanel('map');
    setNotice(`Nouvelle partie ${next.countries[next.playerCountryId].name} · 1er janvier 2000 chargée.`);
  };
  const clearPulseAudit = () => { localStorage.removeItem(worldPulseAuditStorageKey); setPulseAudit([]); };

  return <main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <div className="mr-auto"><div className="font-mono text-xs font-bold tracking-[0.3em] text-primary">ORDO</div><div className="text-xs text-muted-foreground">laboratoire du moteur géopolitique</div></div>
        <div className="flex items-stretch border border-border bg-card text-sm"><div className="px-3 py-2"><b>{player.flag} {player.name}</b> · <span className="font-mono text-primary">{world.currentDate}</span></div><select aria-label="Pays d’une nouvelle partie" className="max-w-40 border-l border-border bg-background px-2 text-xs" value={startingCountryId} onChange={(event) => setStartingCountryId(event.target.value)}>{Object.values(world.countries).sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((country) => <option key={country.id} value={country.id}>{country.flag} {country.name}</option>)}</select><Button variant="ghost" className="rounded-none border-l border-border" onClick={startCountryGame}>Nouvelle partie</Button></div>
        <div className="flex gap-1"><Button variant="outline" disabled={isAdvancing} onClick={() => advance(1)}>{isAdvancing && <LoaderCircle className="size-3 animate-spin" />}+ 1 mois</Button><Button variant="outline" disabled={isAdvancing} onClick={() => advance(3)}>+ 3 mois</Button><Button disabled={isAdvancing} onClick={() => advance(12)}>+ 1 an</Button></div>
        <div className="flex gap-1"><Button size="icon" variant="ghost" title="Sauvegarder" onClick={save}><Save /></Button><Button size="icon" variant="ghost" title="Charger" onClick={load}><Archive /></Button><Button size="icon" variant="ghost" title="Réinitialiser" onClick={reset}><RotateCcw /></Button></div>
      </div>
      <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 lg:px-6">{panels.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPanel(id)} className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${panel === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon className="size-4" />{label}</button>)}</div>
      {dossierAlerts.length > 0 && <div className="border-t border-border bg-card/60"><div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-4 py-2 lg:px-6"><BellRing className="size-4 shrink-0 text-amber-300" /><span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Dossiers actifs</span>{dossierAlerts.slice(0, 4).map((dossier) => <button key={dossier.id} onClick={() => openDossier(dossier.id)} className="shrink-0 border border-border bg-background px-2 py-1 text-xs hover:border-primary"><span className={dossierImportanceTone[dossier.importance]}>●</span> {dossier.title}{dossier.pendingDecisions.length > 0 ? ' · décision attendue' : ` · ${dossierUnreadCount(world, dossier.id)} nouveau(x)`}</button>)}</div></div>}
    </header>
    <div className="border-b border-border bg-muted/20"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2 text-xs text-muted-foreground lg:px-6"><span>{notice}</span><span className="hidden font-mono sm:block">{autonomousCount} acteurs autonomes · seed {world.seed} · séquence {world.sequence}</span></div></div>
    {lastBriefing && <TurnBriefingPanel briefing={lastBriefing} onOpenDossier={openDossier} />}
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      {panel === 'world' && <><WorldPanel world={world} onWorldChange={setWorld} onNotice={setNotice} /><div className="mt-4"><WorldPulseAuditPanel entries={pulseAudit} onClear={clearPulseAudit} /></div></>}
      {panel === 'map' && <MapPanel world={world} />}
      {panel === 'economy' && <EconomyPanel world={world} />}
      {panel === 'energy' && <EnergyPanel world={world} />}
      {panel === 'industry' && <IndustryPanel world={world} onWorldChange={setWorld} onNotice={setNotice} />}
      {panel === 'reforms' && <ReformsPanel world={world} onWorldChange={setWorld} onNotice={setNotice} />}
      {panel === 'military' && <MilitaryPanel world={world} onNotice={setNotice} />}
      {panel === 'dossiers' && <DossiersPanel world={world} selectedId={selectedDossierId} onSelect={setSelectedDossierId} onWorldChange={setWorld} onNotice={setNotice} onOpenDiplomacy={(dialogueId) => { setSelectedDialogueId(dialogueId); setPanel('diplomacy'); }} />}
      {panel === 'diplomacy' && <DiplomacyPanel world={world} onWorldChange={setWorld} onNotice={setNotice} initialDialogueId={selectedDialogueId} />}
      {panel === 'advisor' && <AdvisorPanel world={world} onWorldChange={setWorld} onNotice={setNotice} />}
      {panel === 'ledger' && <LedgerPanel world={world} />}
    </div>
  </main>;
}
