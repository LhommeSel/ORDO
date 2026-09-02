'use client';

import { useMemo, useState } from 'react';
import {
  Activity, Archive, BrainCircuit, ChevronRight, Database, Factory,
  CheckCircle2, FlaskConical, Fuel, History, Landmark, RotateCcw, Save,
  Send, Shield, SlidersHorizontal, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  advanceWorld, answerAdvisorQuestion, armamentAdvisorFacts,
  acceptEnergyOffer, adjustEnergyOffer, assessStrategicPlan,
  createAdministrativeEnergyOffer, createFrance2000World, deserializeWorld,
  energyBalance, evaluatePoliticalPathway, productEvidenceSummary,
  sendEnergyOffer, serializeWorld, visibleLedger,
  type AdvisorAnswer, type EnergyAdministrativeOffer, type EnergyCounterpartResponse,
  type EnergyOfferAdjustment, type ISODate, type StrategicPlan, type WorldState,
} from '@/lib/simulation';

type Panel = 'world' | 'energy' | 'industry' | 'advisor' | 'ledger';

const panels: Array<{ id: Panel; label: string; icon: typeof Activity }> = [
  { id: 'world', label: 'Monde', icon: Activity },
  { id: 'energy', label: 'Énergie', icon: Fuel },
  { id: 'industry', label: 'Industrie', icon: Factory },
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

function WorldPanel({ world }: { world: WorldState }) {
  const player = world.countries[world.playerCountryId];
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
  world, offer, response, signedContractId, showAdjustments, onSend, onAdjust, onSign, onToggleAdjustments, onClose,
}: {
  world: WorldState; offer: EnergyAdministrativeOffer; response: EnergyCounterpartResponse | null;
  signedContractId: string | null; showAdjustments: boolean; onSend: () => void;
  onAdjust: (kind: EnergyOfferAdjustment) => void; onSign: () => void;
  onToggleAdjustments: () => void; onClose: () => void;
}) {
  const supplier = world.countries[offer.supplierId];
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
        <Stat label="Prix" value={offer.pricePosture === 'market' ? 'Marché' : 'Décote'} detail={offer.priceSummary} />
        <Stat label="Moyens" value={offer.diplomaticEffort} detail={`${offer.adjustments.length} ajustement(s)`} />
      </div>
      <p className="text-sm text-muted-foreground">L’administration a dimensionné l’offre selon les <b className="text-foreground">besoins français</b> et la <b className="text-foreground">capacité réellement disponible</b> du fournisseur. Vous pouvez l’envoyer telle quelle.</p>
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
      {signedContractId ? <div className="flex items-center gap-3 border border-emerald-400/50 bg-emerald-400/5 p-4 text-sm"><CheckCircle2 className="size-5 text-emerald-300" /><div><b>Accord signé et activé.</b><div className="font-mono text-[10px] text-muted-foreground">{signedContractId}</div></div></div> : <div className="flex flex-wrap gap-2">
        {!response && <Button onClick={onSend}><Send className="size-4" /> Envoyer la proposition</Button>}
        {response && response.status !== 'refused' && <Button onClick={onSign}><CheckCircle2 className="size-4" /> {response.status === 'countered' ? 'Accepter la contre-proposition' : 'Signer l’accord'}</Button>}
        <Button variant="outline" onClick={onToggleAdjustments}><SlidersHorizontal className="size-4" /> Ajuster</Button>
        <Button variant="ghost" onClick={onClose}>Abandonner</Button>
      </div>}
    </div>
  </section>;
}

function AdvisorPanel({ world, onWorldChange, onNotice }: { world: WorldState; onWorldChange: (world: WorldState) => void; onNotice: (message: string) => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AdvisorAnswer>(() => answerAdvisorQuestion(world, ''));
  const [offer, setOffer] = useState<EnergyAdministrativeOffer | null>(null);
  const [response, setResponse] = useState<EnergyCounterpartResponse | null>(null);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [signedContractId, setSignedContractId] = useState<string | null>(null);
  const ask = () => {
    if (question.trim().length < 3) return;
    setAnswer(answerAdvisorQuestion(world, question));
    setOffer(null); setResponse(null); setSignedContractId(null);
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
      <Button className="mt-3 w-full" disabled={question.trim().length < 3} onClick={ask}>Interpréter et préparer</Button>
      <div className="mt-4 border border-border bg-muted/20 p-3 text-xs text-muted-foreground">Moteur actuel : <b className="text-foreground">règles locales</b>. Appel LLM recommandé : <b className="text-foreground">{answer.llmRecommended ? 'oui' : 'non'}</b>.</div>
    </section>
    <section className="space-y-3">
      <div className="border border-border bg-card/70 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">{answer.mode}</div><h2 className="mt-1 text-xl font-semibold">{answer.headline}</h2><p className="mt-2 text-sm text-muted-foreground">{answer.synthesis}</p>
        {answer.interpretation.kind === 'energy_contract' && <div className="mt-4 border-l-2 border-primary bg-muted/20 p-3 text-xs"><b>Demande comprise :</b> négociation énergétique · {answer.interpretation.resource === 'gas' ? 'gaz' : answer.interpretation.resource === 'oil' ? 'pétrole' : 'ressource à préciser'} · {answer.interpretation.targetLabel ?? 'fournisseur à recommander'} <span className="text-muted-foreground">· confiance {answer.interpretation.confidence}%</span>{answer.interpretation.warnings.map((warning) => <div key={warning} className="mt-2 text-amber-300">⚠ {warning}</div>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">{answer.facts.map((fact) => <span key={fact.id} title={`${fact.sourcePath} · confiance ${fact.confidence}%`} className="border border-border bg-muted/30 px-2 py-1 text-xs"><b>{fact.label}</b> · {fact.value}</span>)}</div>
      </div>
      {offer && <EnergyNegotiationPanel world={world} offer={offer} response={response} signedContractId={signedContractId} showAdjustments={showAdjustments} onSend={send} onAdjust={adjust} onSign={sign} onToggleAdjustments={() => setShowAdjustments((value) => !value)} onClose={() => { setOffer(null); setResponse(null); setSignedContractId(null); }} />}
      {answer.plans.map((plan) => <PlanCard key={plan.id} world={world} plan={plan} onPrepare={prepare} />)}
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
  const [notice, setNotice] = useState('Scénario France · 1er janvier 2000 chargé.');
  const player = world.countries[world.playerCountryId];
  const autonomousCount = useMemo(() => new Set(world.actions.filter((action) => action.origin === 'local_rule').map((action) => action.actorId)).size, [world.actions]);

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
    </header>
    <div className="border-b border-border bg-muted/20"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2 text-xs text-muted-foreground lg:px-6"><span>{notice}</span><span className="hidden font-mono sm:block">{autonomousCount} acteurs autonomes · seed {world.seed} · séquence {world.sequence}</span></div></div>
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      {panel === 'world' && <WorldPanel world={world} />}
      {panel === 'energy' && <EnergyPanel world={world} />}
      {panel === 'industry' && <IndustryPanel world={world} />}
      {panel === 'advisor' && <AdvisorPanel world={world} onWorldChange={setWorld} onNotice={setNotice} />}
      {panel === 'ledger' && <LedgerPanel world={world} />}
    </div>
  </main>;
}
