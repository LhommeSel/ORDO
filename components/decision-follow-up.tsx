'use client';

import { Button } from './ui/button';
import { cancelCommonAction } from '../lib/simulation/action-programs';
import { assessProgramExecution, programOutcomeDetails, programReactions, respondToProgramResistance } from '../lib/simulation/program-consequences';
import type { ActionProgram, WorldState } from '../lib/simulation/types';

const labels: Record<ActionProgram['status'], string> = {
  pending_parliament: 'Validation parlementaire', active: 'Exécution en cours', succeeded: 'Objectif atteint',
  partially_succeeded: 'Résultat partiel', failed: 'Objectif non atteint', cancelled: 'Programme interrompu',
};

export function DecisionFollowUp({ world, dossierId, onWorldChange, onNotice }: {
  world: WorldState; dossierId: string; onWorldChange: (state: WorldState) => void; onNotice: (message: string) => void;
}) {
  const programs = Object.values(world.actionPrograms).filter((program) => program.linkedDossierId === dossierId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (!programs.length) return null;
  const applyResponse = (programId: string, response: 'consult' | 'maintain') => {
    const result = respondToProgramResistance(world, programId, response);
    if (!result.ok) return onNotice(result.error);
    onWorldChange(result.state);
    onNotice(response === 'consult' ? 'Concertation engagée : 0,5 crédit débité. Son effet sera pris en compte dans la suite de l’exécution.' : 'Orientation maintenue : la réaction des opposants est actualisée.');
  };
  return <section className="border border-primary/30 bg-card/70 p-4" aria-label="Suivi des décisions">
    <div className="decision-follow-up-heading"><span>Chaîne de décision</span><h3>Décisions et conséquences</h3><p>Chaque ordre confirmé conserve sa voie institutionnelle, ses moyens engagés et ses effets constatés.</p></div>
    <div className="mt-3 space-y-3">{programs.map((program) => {
      const pending = program.status === 'pending_parliament';
      const active = pending || program.status === 'active';
      const own = program.actorId === world.playerCountryId;
      const opposition = programReactions(world, program).some((reaction) => reaction.stance !== 'support');
      const assessment = assessProgramExecution(world, program);
      const vote = program.parliamentaryProcessId ? world.nationalPolitics[program.actorId]?.procedures[program.parliamentaryProcessId] : undefined;
      const effects = active ? [] : programOutcomeDetails(world, program);
      const responseUsed = program.execution?.lastResponseAt?.slice(0, 7) === world.currentDate.slice(0, 7);
      const currentStep = program.status === 'pending_parliament' ? 2 : program.status === 'active' ? 3 : 4;
      const progress = pending
        ? 0
        : active
          ? Math.round((program.progressMonths / Math.max(1, program.durationMonths)) * 100)
          : 100;
      const targetDate = pending ? vote?.voteAt ?? program.expectedCompletionAt : program.expectedCompletionAt;
      return <article key={program.id} className="border border-border bg-background/40 p-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{program.title}</h4><span className={active ? 'text-amber-200' : 'text-primary'}>{labels[program.status]}</span></div>
        <ol className="decision-lifecycle" aria-label="Progression de la décision">{['Confirmée', 'Validation', 'Exécution', 'Bilan'].map((step, index) => <li key={step} className={index + 1 <= currentStep ? 'complete' : ''}><i>{index + 1}</i><span>{step}</span></li>)}</ol>
        <div className="decision-timebar" aria-label={`Progression temporelle : ${progress} %`}>
          <progress className="sr-only" value={progress} max={100}>
            {progress} %
          </progress>
          <div className="decision-timebar-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
            <i style={{ left: `${Math.min(98, Math.max(2, progress))}%` }} />
          </div>
          <div className="decision-timebar-labels">
            <span><b>Confirmé</b>{program.startedAt}</span>
            <span className={active ? 'current' : ''}><b>Situation</b>{active ? `${progress} % · ${world.currentDate}` : labels[program.status]}</span>
            <span className="end"><b>{pending ? 'Vote prévu' : 'Bilan prévu'}</b>{targetDate}</span>
          </div>
        </div>
        <p className="mt-2">{pending
          ? vote?.stage === 'rejected'
            ? 'Vote perdu · texte disponible pour une nouvelle séquence parlementaire · aucun moyen engagé'
            : vote?.stage === 'committee'
              ? `Commission en cours · vote prévu : ${vote.voteAt} · aucun moyen engagé`
              : `Vote prévu : ${vote?.voteAt ?? 'à programmer'} · aucun moyen engagé`
          : active ? `Échéance estimée : ${program.expectedCompletionAt} · progression ${Math.round(program.progressMonths / Math.max(1, program.durationMonths) * 100)} %`
            : program.resolution}</p>
        {pending && vote ? <p className="mt-1 font-mono text-[10px] text-muted-foreground">Assemblée : {vote.estimatedVotes}/{vote.majorityThreshold} · {vote.stage === 'committee' && (vote.committeeConditions?.length ?? 0) > 0 ? `${vote.committeeConditions!.filter((condition) => !vote.acceptedCommitteeConditionIds?.includes(condition.id) && !vote.declinedCommitteeConditionIds?.includes(condition.id)).length} compromis à arbitrer dans Réformes` : 'projection actualisée par les groupes et réactions concernés'}</p> : null}
        <p className="mt-1 text-muted-foreground">Budget : {program.budgetStatus === 'not_committed' ? 'non engagé' : `${program.budgetCost.toFixed(1)} crédits engagés`}
          {' · '}Moyens : {pending || program.resourceStatus === 'not_committed' ? 'non mobilisés' : program.resourceStatus === 'released' ? 'libérés' : 'mobilisés'}</p>
        {Boolean(program.execution?.delayMonths) && <p className="mt-1 text-amber-200">Retard cumulé : {(program.execution!.delayMonths * 30.4375).toFixed(0)} jours</p>}
        {active && assessment.actorLabels.length > 0 && <ul className="mt-2 space-y-1">{assessment.actorLabels.map((label) => <li key={label}>{label}</li>)}</ul>}
        {program.execution?.events.length ? <details className="mt-2"><summary className="cursor-pointer">Réactions et arbitrages</summary><ul className="mt-2 space-y-2">{program.execution.events.map((event, index) => <li key={`${event.date}-${index}`}><span className="text-muted-foreground">{event.date} · </span>{event.summary}</li>)}</ul></details> : null}
        {program.reformOutcome && <div className="mt-3 border-l-2 border-primary bg-primary/5 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-primary">Bilan politique</div>
          <div className="mt-1 font-semibold">{program.reformOutcome.headline}</div>
          <p className="mt-1 text-muted-foreground">{program.reformOutcome.summary}</p>
          {program.reformOutcome.changes.length > 0 && <ul className="mt-2 space-y-1">{program.reformOutcome.changes.map((change) => <li key={change}>— {change}</li>)}</ul>}
        </div>}
        {effects.length > 0 && <div className="mt-3"><b>Effets constatés</b><ul className="mt-1 space-y-1">{effects.map((effect, index) => <li key={index}>{effect}</li>)}</ul></div>}
        {active && own && <div className="mt-3 flex flex-wrap gap-2">
          {opposition && <><Button size="sm" variant="outline" disabled={responseUsed} onClick={() => applyResponse(program.id, 'consult')}>Engager une concertation · 0,5 crédit</Button>
            <Button size="sm" variant="outline" disabled={responseUsed} onClick={() => applyResponse(program.id, 'maintain')}>Maintenir l’orientation</Button></>}
          <Button size="sm" variant="outline" onClick={() => {
            const result = cancelCommonAction(world, program.id);
            if (!result.ok) return onNotice(result.error);
            onWorldChange(result.state); onNotice(pending ? 'Texte retiré avant engagement.' : 'Programme interrompu : moyens libérés, crédits déjà engagés conservés comme dépense.');
          }}>{pending ? 'Retirer le texte' : 'Interrompre le programme'}</Button>
        </div>}
      </article>;
    })}</div>
  </section>;
}
