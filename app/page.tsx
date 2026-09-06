'use client';

import { useMemo, useState } from 'react';
import {
  Activity, Archive, BrainCircuit, ChevronRight, Database, Factory,
  BellRing, CheckCircle2, Eye, FlaskConical, Fuel, History, Landmark, Map, Pin,
  PinOff, RotateCcw, Save, Send, Shield, SlidersHorizontal, Swords, X,
  TrendingUp, LoaderCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WorldMap } from '@/components/world-map';
import {
  advanceWorld, answerAdvisorQuestion, armamentAdvisorFacts,
  acceptEnergyOffer, adjustEnergyOffer, assessStrategicPlan,
  continueEnergyNegotiationAI, createAdministrativeEnergyOffer, createFrance2000World, deserializeWorld,
  dossierUnreadCount, dossiersRequiringAttention, dossierUpdatesSinceView, energyBalance,
  energyCounterpartResponseFromSession, evaluatePoliticalPathway, executeAIJob, markDossierViewed, productEvidenceSummary,
  enactPrototypeGovernmentMeasure, reactionLevelLabels, reactionTrendLabels,
  sendEnergyOffer, serializeWorld, startEnergyNegotiationAI, visibleLedger, visibleStakeholderReactions,
  structuralDiagnosisGroups,
  setDossierFollowed,
  type AdvisorAnswer, type EnergyAdministrativeOffer, type EnergyCounterpartResponse,
  type EnergyOfferAdjustment, type ISODate, type StrategicDossier, type StrategicPlan,
  type PrototypeMeasureId, type StructuralDiagnosis, type WorldState,
} from '@/lib/simulation';
import {
  createAdvisorAIRequest,
  type AdvisorAIRequest,
  type AdvisorAIAnswer,
  type AdvisorAIResponse,
  type AdvisorAIUsage,
} from '@/lib/ai/contracts';

type Panel = 'world' | 'map' | 'economy' | 'energy' | 'industry' | 'dossiers' | 'advisor' | 'ledger';

type AdvisorAIAuditEntry = {
  id: string;
  createdAt: string;
  request: Pick<AdvisorAIRequest, 'requestId' | 'question' | 'context'>;
  result: { ok: true; answer: AdvisorAIAnswer; usage: AdvisorAIUsage } | { ok: false; message: string };
};

const advisorAuditStorageKey = 'ordo-advisor-ai-audit-v1';
const advisorAuditMaximumEntries = 20;

function readAdvisorAudit(): AdvisorAIAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(advisorAuditStorageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, advisorAuditMaximumEntries) as AdvisorAIAuditEntry[] : [];
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
  { id: 'dossiers', label: 'Dossiers', icon: Swords },
  { id: 'advisor', label: 'Conseiller', icon: BrainCircuit },
  { id: 'ledger', label: 'Registre', icon: Database },
];

const addMonths = (date: ISODate, months: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
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
  return <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pays modélisés" value={String(Object.keys(world.countries).length)} detail="France active · architecture multi-pays" />
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

function MapPanel({ world }: { world: WorldState }) {
  const [selectedCountryId, setSelectedCountryId] = useState(world.playerCountryId);
  const selected = world.countries[selectedCountryId];
  const activeMetrics = useMemo(() => Object.fromEntries(Object.keys(world.countries).map((id) => [id, 100])), [world.countries]);
  const activeCountries = Object.values(world.countries).sort((a, b) => b.weight - a.weight);

  return <section className="strategic-map-shell border border-border bg-card/70">
    <div className="map-header">
      <div><div className="font-mono text-[10px] uppercase tracking-wider text-primary">Repère géographique</div><h2 className="mt-1 text-lg font-semibold">Carte des États modélisés</h2></div>
      <p className="max-w-2xl text-xs text-muted-foreground">Les pays en vert sont actuellement actifs dans le moteur. Cliquez un État pour consulter sa fiche de base ; les autres frontières restent visibles sans données ORDO.</p>
      <div className="ml-auto font-mono text-[10px] text-muted-foreground">{activeCountries.length} / 195 États modélisés</div>
    </div>
    <div className="map-command-layout">
      <WorldMap mode="military" metrics={activeMetrics} selectedId={selectedCountryId} onSelect={(id) => setSelectedCountryId(id)} />
      <aside className="map-dossier">
        {selected ? <>
          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">État modélisé</div>
          <h3 className="mt-1 text-xl font-semibold">{selected.flag} {selected.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{selected.politics.governmentLabel}</p>
          <div className="map-facts">
            <Stat label="Poids" value={`${selected.weight}/100`} detail="influence relative" />
            <Stat label="Fiabilité" value={`${selected.statisticalReliability}%`} detail="données initiales" />
            <Stat label="Stabilité" value={`${selected.metrics.stability}/100`} />
            <Stat label="Industrie" value={`${selected.metrics.industry}/100`} />
          </div>
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
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">États actifs</div>
      <div className="mt-2 flex flex-wrap gap-2">{activeCountries.map((country) => <button key={country.id} onClick={() => setSelectedCountryId(country.id)} className={`border px-2 py-1 text-xs transition-colors ${selectedCountryId === country.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/20 text-muted-foreground hover:border-primary'}`}>{country.flag} {country.name}</button>)}</div>
    </div>
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
        <span>confiance : {diagnosis.confidence}%</span>
      </div>
      <div><b>Fondements mesurés</b><ul className="mt-1 space-y-1 text-muted-foreground">{diagnosis.causes.map((item) => <li key={item}>— {item}</li>)}</ul></div>
      <div><b>Si rien ne change</b><ul className="mt-1 space-y-1 text-muted-foreground">{diagnosis.possibleConsequences.map((item) => <li key={item}>— {item}</li>)}</ul></div>
      <div><b>Leviers possibles</b><div className="mt-1 flex flex-wrap gap-1">{diagnosis.availableLevers.map((item) => <span key={item} className="border border-border bg-muted/30 px-2 py-1">{item}</span>)}</div></div>
    </div>
  </details>;
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
          {profile && <span title={profile.source.basis}>socle {profile.source.observationYear} · confiance {profile.source.confidence}% · {profile.source.estimated ? 'estimé' : 'documenté'}</span>}
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
    <div className="text-xs text-muted-foreground">Base 2000 : World Development Indicators. Les données absentes ou estimées sont signalées dans la provenance et abaissent la confiance statistique.</div>
  </div>;
}

function EnergyPanel({ world }: { world: WorldState }) {
  const countryIds = Object.keys(world.countryEnergy);
  return <div className="space-y-4">
    <div className="border border-border bg-card/70 p-4">
      <div className="font-semibold">Registre physique mondial pétrole & gaz</div>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">La production, la capacité maximale, les contrats et les stocks existent indépendamment du texte. Une même unité ne peut pas être vendue deux fois.</p>
    </div>
    <div className="overflow-x-auto border border-border bg-card/70">
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Pays</th><th>Pétrole disponible</th><th>Stocks pétrole</th><th>Gaz disponible</th><th>Stocks gaz</th><th>Contrats actifs</th></tr></thead>
        <tbody>{countryIds.map((id) => {
          const oil = energyBalance(world, id, 'oil'); const gas = energyBalance(world, id, 'gas');
          const contracts = Object.values(world.energyContracts).filter((item) => item.status === 'active' && (item.buyerId === id || item.sellerId === id)).length;
          return <tr key={id} className="border-b border-border/60"><td className="p-3 font-medium">{world.countries[id]?.flag} {world.countries[id]?.name}</td><td>{oil?.available.toFixed(1)}</td><td>{oil?.coverageMonths.toFixed(1)} mois</td><td>{gas?.available.toFixed(1)}</td><td>{gas?.coverageMonths.toFixed(1)} mois</td><td>{contracts}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">{Object.values(world.energyNodes).map((node) => <div key={node.id} className="border border-border bg-card/70 p-4">
      <div className="flex justify-between"><div className="font-medium">{node.label}</div><span className="font-mono text-xs text-primary">{node.resource}</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="text-muted-foreground">Production</span><div>{node.annualProduction.toFixed(1)}</div></div><div><span className="text-muted-foreground">Capacité</span><div>{node.annualCapacity.toFixed(1)}</div></div><div><span className="text-muted-foreground">Réserves</span><div>{node.provenReserves.toFixed(0)}</div></div></div>
    </div>)}</div>
  </div>;
}

function IndustryPanel({ world }: { world: WorldState }) {
  const evidence = Object.fromEntries(armamentAdvisorFacts(world).map((item) => [item.productId, item]));
  return <div className="space-y-4">
    <div className="grid gap-3 lg:grid-cols-3">{Object.values(world.sectors).map((sector) => <div key={sector.id} className="border border-border bg-card/70 p-4">
      <div className="font-medium capitalize">{sector.countryId} · {sector.sector.replaceAll('_', ' ')}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div>Capacité <b>{sector.capacity}</b></div><div>Utilisation <b>{sector.utilization.toFixed(0)}%</b></div><div>Santé <b>{sector.health.toFixed(0)}</b></div><div>Dépendance <b>{sector.foreignDependency}</b></div></div>
      <div className="mt-3 text-xs text-muted-foreground">Charge : {sector.workloadMonths.toFixed(1)} mois · inertie {sector.expansionLeadMonths} mois</div>
    </div>)}</div>

    <div className="border border-border bg-card/70">
      <div className="border-b border-border p-4"><div className="flex items-center gap-2 font-semibold"><Shield className="size-4 text-primary" /> Produits phares d’armement français</div><p className="mt-1 text-xs text-muted-foreground">Bouquet suivi individuellement, sans chaîne de production à la Victoria.</p></div>
      <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">{Object.values(world.armamentProducts).map((product) => {
        const proof = evidence[product.id] ?? productEvidenceSummary(product);
        return <div key={product.id} className="bg-card p-4">
          <div className="flex justify-between gap-3"><div><div className="font-semibold">{product.name}</div><div className="text-xs text-muted-foreground">{product.manufacturer} · {product.family}</div></div><span className="font-mono text-[10px] text-primary">{product.status}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div>Capacité/an <b>{product.annualCapacity}</b></div><div>Carnet <b>{product.backlogMonths.toFixed(1)} mois</b></div><div>Technique <b>{proof.maturity}</b></div><div>Terrain <b>{proof.operationalExperience}</b></div></div>
          <div className="mt-3 text-xs text-muted-foreground">Retours {proof.feedback} · confiance documentaire {proof.confidence}% · {product.prospects.length} prospect(s)</div>
        </div>;
      })}</div>
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
      <p className="text-sm text-muted-foreground">L’administration a dimensionné l’offre selon les <b className="text-foreground">besoins français</b> et la <b className="text-foreground">capacité réellement disponible</b> du fournisseur. Vous pouvez l’envoyer telle quelle.</p>
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
          <span className={`font-mono text-[10px] ${entry.result.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{entry.result.ok ? `${entry.result.usage.model} · $${entry.result.usage.estimatedCostUsd.toFixed(4)}` : 'appel non abouti'}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString('fr-FR')} · requête {entry.request.requestId.slice(0, 8)}</div>
      </summary>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="border border-border bg-muted/15 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-sky-300">Envoyé au modèle</div>
          <div className="mt-2 text-xs"><b>Question :</b> {entry.request.question}</div>
          <div className="mt-2 text-xs text-muted-foreground">{entry.request.context.playerCountry.name} · {entry.request.context.playerCountry.government} · {entry.request.context.currentDate}</div>
          <div className="mt-3 text-xs"><b>Faits sélectionnés ({entry.request.context.facts.length})</b><ul className="mt-1 space-y-1 text-muted-foreground">{entry.request.context.facts.map((fact) => <li key={fact.id}>— <span className="font-mono text-[10px]">{fact.id}</span> : {fact.label} — {fact.value} <span className="text-sky-300">({fact.confidence}%)</span></li>)}</ul></div>
          <div className="mt-3 text-xs"><b>Pistes locales jointes ({entry.request.context.localPlans.length})</b><ul className="mt-1 space-y-1 text-muted-foreground">{entry.request.context.localPlans.map((plan, planIndex) => <li key={`${plan.title}-${planIndex}`}>— <b>{plan.title}</b> : {plan.intent}</li>)}</ul></div>
          <div className="mt-3 border-l-2 border-sky-400/60 pl-2 text-[11px] text-muted-foreground">Règles fixes du serveur : répondre en français, n’utiliser comme chiffres que les faits fournis, distinguer faits et inférences, ne jamais modifier le monde.</div>
        </div>
        <div className="border border-border bg-muted/15 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">Reçu et contrôlé</div>
          {entry.result.ok ? <>
            <div className="mt-2 text-xs"><b>Validation :</b> réponse structurée conforme au contrat ORDO.</div>
            <div className="mt-2 text-xs"><b>Usage :</b> {entry.result.usage.inputTokens} entrants · {entry.result.usage.outputTokens} sortants · {entry.result.usage.remainingSessionRequestsToday} appel(s) restant(s).</div>
            <details className="mt-3 border border-border bg-background/30 p-2"><summary className="cursor-pointer text-xs font-semibold">Voir la réponse structurée exacte</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">{JSON.stringify(entry.result.answer, null, 2)}</pre></details>
          </> : <div className="mt-2 text-xs text-amber-200"><b>Erreur :</b> {entry.result.message}</div>}
        </div>
      </div>
    </details>)}</div>
  </section>;
}

function AdvisorPanel({ world, onWorldChange, onNotice }: { world: WorldState; onWorldChange: (world: WorldState) => void; onNotice: (message: string) => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AdvisorAnswer>(() => answerAdvisorQuestion(world, ''));
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
    const local = answerAdvisorQuestion(world, question);
    setAnswer(local);
    setAiAnswer(null); setAiUsage(null); setAiStatus('idle');
    setAiMessage('Analyse locale terminée · aucun appel facturé.');
    resetNegotiation();
    return local;
  };
  const askAI = async () => {
    if (question.trim().length < 3 || aiStatus === 'loading') return;
    const local = answerAdvisorQuestion(world, question);
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
      const aiRequest = createAdvisorAIRequest(world, question, local, sessionId);
      const auditRequest = { requestId: aiRequest.requestId, question: aiRequest.question, context: aiRequest.context };
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiRequest),
      });
      const payload = await response.json() as AdvisorAIResponse;
      if (!payload.ok) {
        appendAudit({ id: aiRequest.requestId, createdAt: new Date().toISOString(), request: auditRequest, result: { ok: false, message: payload.message } });
        setAiStatus('unavailable'); setAiMessage(payload.message);
        return;
      }
      appendAudit({ id: aiRequest.requestId, createdAt: new Date().toISOString(), request: auditRequest, result: { ok: true, answer: payload.answer, usage: payload.usage } });
      setAiAnswer(payload.answer); setAiUsage(payload.usage); setAiStatus('ready');
      setAiMessage(`Réponse IA validée · ${payload.usage.remainingSessionRequestsToday} requête(s) restantes aujourd’hui.`);
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
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" disabled={question.trim().length < 3 || aiStatus === 'loading'} onClick={prepareLocalAnswer}>Préparer localement</Button>
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
        <div className="mt-4 space-y-3">{aiAnswer.options.map((option, index) => <details key={`${option.title}-${index}`} className="border border-border bg-background/35 p-3" open={index === 0}>
          <summary className="cursor-pointer list-none font-semibold">{index + 1}. {option.title}</summary>
          <p className="mt-2 text-sm">{option.proposal}</p>
          <div className="mt-3 grid gap-3 text-xs lg:grid-cols-2">
            <div><b className="text-emerald-300">Pourquoi l’accepter</b><p className="mt-1 text-muted-foreground">{option.whyPlausible}</p></div>
            <div><b className="text-amber-300">Pourquoi la refuser</b><p className="mt-1 text-muted-foreground">{option.whyRefused}</p></div>
          </div>
          <div className="mt-3 text-xs"><b>Conséquences estimées</b><ul className="mt-1 space-y-1 text-muted-foreground">{option.estimatedConsequences.map((item) => <li key={item}>— {item}</li>)}</ul></div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">Faits mobilisés : {option.factIds.join(', ')}</div>
        </details>)}</div>
        <div className="mt-4 text-xs"><b>Angles morts</b><ul className="mt-1 space-y-1 text-muted-foreground">{aiAnswer.blindSpots.map((item) => <li key={item}>— {item}</li>)}</ul></div>
      </div>}
      <AdvisorAIAuditPanel entries={aiAudit} onClear={clearAudit} />
      <div className="border border-border bg-card/70 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">{answer.mode}</div><h2 className="mt-1 text-xl font-semibold">{answer.headline}</h2><p className="mt-2 text-sm text-muted-foreground">{answer.synthesis}</p>
        {answer.interpretation.kind === 'energy_contract' && <div className="mt-4 border-l-2 border-primary bg-muted/20 p-3 text-xs"><b>Demande comprise :</b> négociation énergétique · {answer.interpretation.resource === 'gas' ? 'gaz' : answer.interpretation.resource === 'oil' ? 'pétrole' : 'ressource à préciser'} · {answer.interpretation.targetLabel ?? 'fournisseur à recommander'} <span className="text-muted-foreground">· confiance {answer.interpretation.confidence}%</span>{answer.interpretation.warnings.map((warning) => <div key={warning} className="mt-2 text-amber-300">⚠ {warning}</div>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">{answer.facts.map((fact) => <span key={fact.id} title={`${fact.sourcePath} · confiance ${fact.confidence}%`} className="border border-border bg-muted/30 px-2 py-1 text-xs"><b>{fact.label}</b> · {fact.value}</span>)}</div>
      </div>
      {offer && <EnergyNegotiationPanel world={world} offer={offer} response={response} signedContractId={signedContractId} showAdjustments={showAdjustments} onSend={send} onSendAI={sendWithAI} onReplyAI={replyWithAI} onAdjust={adjust} onSign={sign} onToggleAdjustments={() => setShowAdjustments((value) => !value)} onClose={resetNegotiation} aiNegotiationStatus={aiNegotiationStatus} aiNegotiationMessage={aiNegotiationMessage} playerReply={playerReply} onPlayerReplyChange={setPlayerReply} />}
      {answer.plans.map((plan) => <PlanCard key={plan.id} world={world} plan={plan} onPrepare={prepare} />)}
    </section>
  </div>;
}

const dossierImportanceTone: Record<StrategicDossier['importance'], string> = {
  minor: 'text-slate-300', moderate: 'text-sky-300', major: 'text-amber-300', critical: 'text-red-300',
};

function DossiersPanel({ world, selectedId, onSelect, onWorldChange }: {
  world: WorldState; selectedId: string | null; onSelect: (id: string) => void; onWorldChange: (world: WorldState) => void;
}) {
  const rank = { minor: 0, moderate: 1, major: 2, critical: 3 } as const;
  const dossiers = Object.values(world.strategicDossiers).sort((a, b) => rank[b.importance] - rank[a.importance] || b.updatedAt.localeCompare(a.updatedAt));
  const selected = dossiers.find((dossier) => dossier.id === selectedId) ?? dossiers[0];
  const updates = selected ? dossierUpdatesSinceView(world, selected.id) : [];
  const diplomaticSession = selected ? Object.values(world.diplomaticSessions).find((session) => session.linkedDossierId === selected.id) : undefined;
  if (!selected) return <div className="border border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">Aucun dossier stratégique connu.</div>;
  return <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
    <section className="border border-border bg-card/70">
      <div className="border-b border-border p-4"><div className="flex items-center gap-2 font-semibold"><Swords className="size-4 text-primary" /> Situations suivies</div><p className="mt-1 text-xs text-muted-foreground">Un dossier conserve sa chronologie, même lorsqu’aucune notification n’interrompt le tour.</p></div>
      <div className="divide-y divide-border/60">{dossiers.map((dossier) => {
        const unread = dossierUnreadCount(world, dossier.id);
        return <button key={dossier.id} onClick={() => onSelect(dossier.id)} className={`w-full p-4 text-left transition-colors hover:bg-muted/30 ${selected.id === dossier.id ? 'bg-muted/30' : ''}`}>
          <div className="flex items-start justify-between gap-3"><div className="font-medium">{dossier.title}</div><span className={`font-mono text-[10px] uppercase ${dossierImportanceTone[dossier.importance]}`}>{dossier.importance}</span></div>
          <div className="mt-1 text-xs text-muted-foreground">{dossier.phase} · {dossier.updatedAt}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">{dossier.followed && <span className="text-primary">Épinglé</span>}{dossier.autoTracked && <span className="text-amber-300">Suivi majeur</span>}{unread > 0 && <span className="ml-auto bg-primary/15 px-2 py-0.5 text-primary">{unread} nouveau{unread > 1 ? 'x' : ''}</span>}</div>
        </button>;
      })}</div>
    </section>
    <section className="space-y-4">
      <div className="border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className={`font-mono text-[10px] uppercase tracking-wider ${dossierImportanceTone[selected.importance]}`}>{selected.kind} · {selected.status}</div><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2></div><Button variant="outline" onClick={() => onWorldChange(setDossierFollowed(world, selected.id, !selected.followed))}>{selected.followed ? <PinOff className="size-4" /> : <Pin className="size-4" />}{selected.followed ? 'Ne plus épingler' : 'Épingler'}</Button></div>
        <p className="mt-3 text-sm text-muted-foreground">{selected.publicSummary}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><Stat label="Phase" value={selected.phase} /><Stat label="Tendance" value={selected.trend} /><Stat label="Acteurs" value={selected.actorIds.map((id) => world.countries[id]?.flag ?? id).join(' ')} /></div>
        {selected.playerStance && <div className="mt-3 border-l-2 border-primary pl-3 text-sm"><b>Position du joueur :</b> {selected.playerStance}</div>}
      </div>
      {(selected.pendingDecisions.length > 0 || selected.commitments.length > 0) && <div className="grid gap-3 lg:grid-cols-2">
        <div className="border border-border bg-card/70 p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-amber-300">Décisions attendues</div><ul className="mt-2 space-y-2 text-sm">{selected.pendingDecisions.length ? selected.pendingDecisions.map((item) => <li key={item}>— {item}</li>) : <li className="text-muted-foreground">Aucun arbitrage immédiat.</li>}</ul></div>
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

function LedgerPanel({ world }: { world: WorldState }) {
  const entries = visibleLedger(world).slice(-120).reverse();
  return <div className="border border-border bg-card/70">
    <div className="border-b border-border p-4"><div className="font-semibold">Registre causal lisible par le joueur</div><p className="mt-1 text-xs text-muted-foreground">Chaque modification conserve la cause, l’acteur, l’origine, l’avant et l’après. Les entrées secrètes ou de débogage restent masquées.</p></div>
    <div className="divide-y divide-border/60">{entries.length ? entries.map((entry) => <div key={entry.id} className="grid gap-2 p-3 text-sm md:grid-cols-[90px_70px_1fr_1.3fr]"><span className="font-mono text-[10px] text-muted-foreground">{entry.date}</span><span className="font-mono text-[10px] uppercase text-primary">{entry.origin}</span><span className="break-all text-xs">{entry.path}</span><span className="text-xs text-muted-foreground">{entry.reason}</span></div>) : <div className="p-8 text-center text-sm text-muted-foreground">Aucune modification visible. Avancez la simulation.</div>}</div>
  </div>;
}

export default function Home() {
  const [world, setWorld] = useState<WorldState>(() => createFrance2000World());
  const [panel, setPanel] = useState<Panel>('world');
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scénario France · 1er janvier 2000 chargé.');
  const player = world.countries[world.playerCountryId];
  const autonomousCount = useMemo(() => new Set(world.actions.filter((action) => action.origin === 'local_rule').map((action) => action.actorId)).size, [world.actions]);
  const dossierAlerts = useMemo(() => dossiersRequiringAttention(world), [world]);
  const openDossier = (id: string) => { setSelectedDossierId(id); setPanel('dossiers'); };

  const advance = (months: number) => {
    const result = advanceWorld(world, addMonths(world.currentDate, months));
    setWorld(result.state);
    const countries = [...new Set(result.reviewedCountryIds)].map((id) => result.state.countries[id]?.name).filter(Boolean);
    setNotice(`${result.elapsedDays} jours simulés · ${countries.length} État(s) réévalué(s)${result.manifestations.length ? ` · ${result.manifestations.length} manifestation(s) historique(s)` : ''}.`);
  };
  const save = () => { localStorage.setItem('ordo-world-v1', serializeWorld(world)); setNotice('Sauvegarde locale créée.'); };
  const load = () => { const raw = localStorage.getItem('ordo-world-v1'); if (!raw) return setNotice('Aucune sauvegarde locale.'); setWorld(deserializeWorld(raw)); setNotice('Sauvegarde locale restaurée.'); };
  const reset = () => { setWorld(createFrance2000World()); setNotice('Scénario 2000 réinitialisé.'); };

  return <main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <div className="mr-auto"><div className="font-mono text-xs font-bold tracking-[0.3em] text-primary">ORDO</div><div className="text-xs text-muted-foreground">laboratoire du moteur géopolitique</div></div>
        <div className="border border-border bg-card px-3 py-2 text-sm"><b>{player.flag} {player.name}</b> · <span className="font-mono text-primary">{world.currentDate}</span></div>
        <div className="flex gap-1"><Button variant="outline" onClick={() => advance(1)}>+ 1 mois</Button><Button variant="outline" onClick={() => advance(3)}>+ 3 mois</Button><Button onClick={() => advance(12)}>+ 1 an</Button></div>
        <div className="flex gap-1"><Button size="icon" variant="ghost" title="Sauvegarder" onClick={save}><Save /></Button><Button size="icon" variant="ghost" title="Charger" onClick={load}><Archive /></Button><Button size="icon" variant="ghost" title="Réinitialiser" onClick={reset}><RotateCcw /></Button></div>
      </div>
      <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 lg:px-6">{panels.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPanel(id)} className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${panel === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon className="size-4" />{label}</button>)}</div>
      {dossierAlerts.length > 0 && <div className="border-t border-border bg-card/60"><div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-4 py-2 lg:px-6"><BellRing className="size-4 shrink-0 text-amber-300" /><span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Dossiers actifs</span>{dossierAlerts.slice(0, 4).map((dossier) => <button key={dossier.id} onClick={() => openDossier(dossier.id)} className="shrink-0 border border-border bg-background px-2 py-1 text-xs hover:border-primary"><span className={dossierImportanceTone[dossier.importance]}>●</span> {dossier.title}{dossier.pendingDecisions.length > 0 ? ' · décision attendue' : ` · ${dossierUnreadCount(world, dossier.id)} nouveau(x)`}</button>)}</div></div>}
    </header>
    <div className="border-b border-border bg-muted/20"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2 text-xs text-muted-foreground lg:px-6"><span>{notice}</span><span className="hidden font-mono sm:block">{autonomousCount} acteurs autonomes · seed {world.seed} · séquence {world.sequence}</span></div></div>
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      {panel === 'world' && <WorldPanel world={world} onWorldChange={setWorld} onNotice={setNotice} />}
      {panel === 'map' && <MapPanel world={world} />}
      {panel === 'economy' && <EconomyPanel world={world} />}
      {panel === 'energy' && <EnergyPanel world={world} />}
      {panel === 'industry' && <IndustryPanel world={world} />}
      {panel === 'dossiers' && <DossiersPanel world={world} selectedId={selectedDossierId} onSelect={setSelectedDossierId} onWorldChange={setWorld} />}
      {panel === 'advisor' && <AdvisorPanel world={world} onWorldChange={setWorld} onNotice={setNotice} />}
      {panel === 'ledger' && <LedgerPanel world={world} />}
    </div>
  </main>;
}
