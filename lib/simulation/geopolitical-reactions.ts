import { commitWorldAction, relationBetween } from './ledger';
import type {
  ActionProgram,
  CountryId,
  GeopoliticalReactionPosture,
  GeopoliticalReactionState,
  ISODate,
  WorldEffect,
  WorldState,
} from './types';

const addMonths = (date: string, months: number): ISODate => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10) as ISODate;
};

const asCountryIds = (state: WorldState, ids: readonly string[]) =>
  ids.filter((id): id is CountryId => Boolean(state.countries[id]));

const wordsFor = (program: Pick<ActionProgram, 'title' | 'intent'>) =>
  `${program.title} ${program.intent}`.toLocaleLowerCase('fr');

function isCooperative(program: Pick<ActionProgram, 'title' | 'intent'>) {
  return /accord|coop[ée]ration|partenariat|fonds commun|coordination|dialogue|n[ée]goci|soutien|investissement conjoint|m[ée]diation/.test(wordsFor(program));
}

function isAssertive(program: Pick<ActionProgram, 'title' | 'intent'>) {
  return /sanction|pression|exig|ultimatum|conditionn|contourn|surveillance|renseignement|espion|intercepter|d[ée]ployer|renforcer|missile|armement/.test(wordsFor(program));
}

/**
 * Une mission de service extérieur reste clandestine par défaut. Elle ne
 * devient une information publique que si le programme annonce explicitement
 * une liaison, un partage ou une coopération officielle. Cela évite de
 * transformer une demande DGSE en communiqué mondial dès son lancement.
 */
function isCovertIntelligence(program: ActionProgram) {
  if (program.category !== 'intelligence') return false;
  const text = wordsFor(program);
  if (/secret|clandest|discr[èe]t|sous surveillance|sans informer|non public/.test(text)) return true;
  return !/liaison|partage|coop[ée]ration|accord|officiel|public|conjoint/.test(text);
}

function isExternallyExposed(state: WorldState, program: ActionProgram) {
  if (program.actorId !== state.playerCountryId || program.militaryOperation) return false;
  if (isCovertIntelligence(program)) return false;
  if (program.category === 'institutional' || program.lever === 'policy_audit' || program.lever === 'national_reform' || program.capacityDevelopment || program.emergencyCapacitySupport) return false;
  const targets = asCountryIds(state, program.targetIds).filter((id) => id !== program.actorId);
  return targets.length > 0 && ['diplomacy', 'economic', 'defense', 'intelligence'].includes(program.category);
}

function directPosture(state: WorldState, program: ActionProgram, targetId: CountryId): GeopoliticalReactionPosture {
  const relation = relationBetween(state, program.actorId, targetId)?.relation ?? 50;
  if (program.category === 'intelligence') return relation >= 65 ? 'concern' : 'opposition';
  if (isAssertive(program)) return relation >= 62 ? 'concern' : 'opposition';
  if (isCooperative(program)) return relation >= 42 ? 'support' : 'caution';
  return relation >= 55 ? 'caution' : 'concern';
}

function observerPosture(
  state: WorldState,
  program: ActionProgram,
  observerId: CountryId,
  targetId: CountryId,
): GeopoliticalReactionPosture {
  const player = state.countries[program.actorId];
  const target = state.countries[targetId];
  const observer = state.countries[observerId];
  if (!player || !target || !observer) return 'caution';
  if (player.strategy.partners.includes(observerId) && isCooperative(program)) return 'support';
  if (target.strategy.partners.includes(observerId)) return isAssertive(program) ? 'concern' : 'caution';
  if (player.strategy.rivals.includes(observerId)) return isCooperative(program) ? 'caution' : 'concern';
  const towardPlayer = relationBetween(state, observerId, program.actorId)?.relation ?? 50;
  const towardTarget = relationBetween(state, observerId, targetId)?.relation ?? 50;
  if (towardTarget - towardPlayer > 16 && isAssertive(program)) return 'opposition';
  return isCooperative(program) && towardPlayer >= 55 ? 'support' : 'caution';
}

function rationaleFor(
  state: WorldState,
  program: ActionProgram,
  observerId: CountryId,
  targetId: CountryId,
  direct: boolean,
) {
  if (direct) return isCooperative(program)
    ? 'Partie directement concernée par l’initiative proposée.'
    : 'État directement exposé par la décision française.';
  if (state.countries[targetId]?.strategy.partners.includes(observerId)) return `Partenaire stratégique de ${state.countries[targetId]?.name ?? targetId}.`;
  if (state.countries[program.actorId]?.strategy.partners.includes(observerId)) return `Partenaire stratégique de ${state.countries[program.actorId]?.name ?? program.actorId}.`;
  return 'Puissance liée aux intérêts économiques ou sécuritaires du dossier.';
}

/**
 * Programme au plus deux voix, déterministes et reliées à des intérêts déjà
 * documentés. La sélection est volontairement étroite pour ne pas transformer
 * chaque ordre français en conseil de sécurité mondial.
 */
export function scheduleGeopoliticalReaction(state: WorldState, program: ActionProgram): GeopoliticalReactionState | undefined {
  if (!isExternallyExposed(state, program)) return undefined;
  const targetId = asCountryIds(state, program.targetIds).find((id) => id !== program.actorId);
  if (!targetId) return undefined;
  const player = state.countries[program.actorId];
  const target = state.countries[targetId];
  if (!player || !target) return undefined;
  const observers: GeopoliticalReactionState['observers'] = [{
    countryId: targetId,
    posture: directPosture(state, program, targetId),
    rationale: rationaleFor(state, program, targetId, targetId, true),
  }];
  const candidates = [...new Set([
    ...target.strategy.partners,
    ...target.strategy.rivals,
    ...player.strategy.partners,
    ...player.strategy.rivals,
  ])]
    .filter((id): id is CountryId => Boolean(state.countries[id]) && id !== program.actorId && id !== targetId)
    .map((countryId) => {
      const country = state.countries[countryId];
      const score = (target.strategy.partners.includes(countryId) ? 80 : 0)
        + (player.strategy.partners.includes(countryId) ? 52 : 0)
        + (target.strategy.rivals.includes(countryId) ? 22 : 0)
        + (player.strategy.rivals.includes(countryId) ? 16 : 0)
        + country.weight * 0.18;
      return { countryId, score };
    })
    .sort((left, right) => right.score - left.score || left.countryId.localeCompare(right.countryId));
  const observerId = candidates[0]?.countryId;
  if (observerId) observers.push({
    countryId: observerId,
    posture: observerPosture(state, program, observerId, targetId),
    rationale: rationaleFor(state, program, observerId, targetId, false),
  });
  // Une réaction doit rester visible même pour une action courte : elle arrive
  // au mois suivant dans la plupart des cas, deux mois seulement lorsque le
  // programme laisse réellement le temps aux positions de se structurer.
  const delayMonths = program.durationMonths >= 4 ? 2 : 1;
  return { status: 'scheduled', delayMonths, dueAt: addMonths(program.startedAt, delayMonths), observers };
}

function statementFor(
  state: WorldState,
  program: ActionProgram,
  observer: GeopoliticalReactionState['observers'][number],
) {
  const observerName = state.countries[observer.countryId]?.name ?? observer.countryId;
  const playerName = state.countries[program.actorId]?.name ?? program.actorId;
  if (observer.posture === 'support') return `${observerName} salue l’initiative de ${playerName} et se dit prêt à en accompagner les effets, sans engagement automatique.`;
  if (observer.posture === 'caution') return `${observerName} demande des garanties sur le périmètre et les conséquences de l’initiative de ${playerName}, avant de préciser sa position.`;
  if (observer.posture === 'concern') return `${observerName} exprime des réserves sur l’initiative de ${playerName} et indique qu’il suivra ses effets sur ses intérêts.`;
  return `${observerName} conteste l’initiative de ${playerName} et avertit qu’elle pèsera sur la relation bilatérale.`;
}

function relationEffect(program: ActionProgram, observer: GeopoliticalReactionState['observers'][number]): WorldEffect {
  const value = observer.posture === 'support' ? 2 : observer.posture === 'caution' ? -1 : observer.posture === 'concern' ? -3 : -5;
  return {
    kind: 'relation_delta', from: observer.countryId, to: program.actorId,
    relation: value, trust: value === 2 ? 1.5 : value * 0.65,
    reason: `Réaction de ${observer.countryId} à « ${program.title} ».`, visibility: 'player',
  };
}

/**
 * Rend la réaction lorsque le délai est atteint. Elle alimente le dossier du
 * programme, donc la carte et les suivis, sans créer de session diplomatique
 * ni de nouvelle obligation de réponse.
 */
export function resolveDueGeopoliticalReaction(state: WorldState, program: ActionProgram): WorldState {
  const reaction = program.geopoliticalReaction;
  if (!reaction || reaction.status !== 'scheduled' || program.status !== 'active') return state;
  if (isCovertIntelligence(program)) {
    return commitWorldAction(state, {
      kind: 'intelligence', actorId: program.actorId, targetIds: program.targetIds, origin: 'time', visibility: 'debug',
      intent: `Conserver le secret de la mission : ${program.title}`,
      effects: [{ kind: 'action_program_patch', programId: program.id, patch: { geopoliticalReaction: { ...reaction, status: 'resolved', resolvedAt: state.currentDate } }, reason: 'Une mission clandestine ne produit pas de réaction internationale automatique.', visibility: 'debug' }],
    });
  }
  const launchedAt = program.resourcesCommittedAt ?? program.startedAt;
  const earliestDueAt = addMonths(launchedAt, reaction.delayMonths);
  if (reaction.dueAt < earliestDueAt) {
    return commitWorldAction(state, {
      kind: 'diplomatic', actorId: program.actorId, targetIds: program.targetIds, origin: 'time', visibility: 'debug',
      intent: `Recaler les réactions extérieures : ${program.title}`,
      effects: [{ kind: 'action_program_patch', programId: program.id, patch: { geopoliticalReaction: { ...reaction, dueAt: earliestDueAt } }, reason: 'Le délai de réaction commence au lancement matériel du programme.', visibility: 'debug' }],
    });
  }
  if (state.currentDate < reaction.dueAt) return state;
  const dossier = program.linkedDossierId ? state.strategicDossiers[program.linkedDossierId] : undefined;
  const lines = reaction.observers.map((observer) => statementFor(state, program, observer));
  const opposition = reaction.observers.some((observer) => observer.posture === 'opposition' || observer.posture === 'concern');
  const effects: WorldEffect[] = [
    { kind: 'action_program_patch', programId: program.id, patch: { geopoliticalReaction: { ...reaction, status: 'resolved', resolvedAt: state.currentDate } }, reason: 'Les prises de position étrangères ont été versées au suivi.', visibility: 'player' },
    ...reaction.observers.map((observer) => relationEffect(program, observer)),
  ];
  if (dossier) {
    effects.push(
      { kind: 'dossier_patch', dossierId: dossier.id, patch: {
        phase: opposition ? 'Réactions internationales' : dossier.phase,
        trend: opposition ? 'escalating' : dossier.trend,
        importance: opposition && dossier.importance === 'minor' ? 'moderate' : dossier.importance,
        updatedAt: state.currentDate,
      }, reason: 'Les positions étrangères deviennent une conséquence lisible du programme.', visibility: 'player' },
      { kind: 'dossier_entry_add', dossierId: dossier.id, entry: {
        id: `${program.id}:geopolitical-reaction`, date: state.currentDate, title: 'Réactions internationales',
        summary: `${lines.join(' ')} Une suite diplomatique reste à l’initiative du joueur.`,
        importance: opposition ? 'major' : 'moderate', actorIds: [program.actorId, ...reaction.observers.map((observer) => observer.countryId)],
        requiresDecision: false, visibility: 'player',
      }, reason: 'Les réactions étrangères sont visibles dans la chronologie du dossier.', visibility: 'player' },
    );
  }
  return commitWorldAction(state, {
    kind: 'diplomatic', actorId: program.actorId, targetIds: reaction.observers.map((observer) => observer.countryId), origin: 'time',
    intent: `Enregistrer les réactions extérieures à ${program.title}`,
    effects,
    assumptions: ['Deux observateurs au maximum.', 'Aucun dialogue diplomatique n’est ouvert automatiquement.'],
  });
}
