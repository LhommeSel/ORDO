import { mkdir, writeFile } from 'node:fs/promises';

import { createFrance2000World } from '../lib/simulation/scenario-2000';
import { executeAIJob } from '../lib/simulation/ai/executor';
import {
  openDiplomaticDialogue,
  requestDiplomaticDialogueAI,
  resolveDiplomaticDialogueResponse,
  sendDiplomaticDialogueMessage,
} from '../lib/simulation/diplomacy-dialogue';
import { advanceWorld } from '../lib/simulation/engine';
import type { CountryId, DiplomaticDialogue, WorldState } from '../lib/simulation/types';

/**
 * Campagne verticale de diplomatie : les appels IA sont explicites, les
 * réponses complètes sont conservées dans outputs/ pour audit manuel.
 * Aucun appel au pouls mondial n'est lancé ici : les douze avances testent
 * uniquement la continuité locale des dossiers, relations et engagements.
 */

const origin = process.env.ORDO_TEST_ORIGIN ?? 'https://ordo-geopolitique.lhommesel.chatgpt.site';
const sessionId = `ai-diplomatic-campaign-${Date.now()}`;

const requestToOrigin = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(init.headers);
  headers.set('Origin', origin);
  headers.set('cf-connecting-ip', `ordo-campaign-${sessionId}`);
  return fetch(path.startsWith('/') ? `${origin}${path}` : path, { ...init, headers });
};

type CampaignCase = {
  id: string;
  title: string;
  participants: CountryId[];
  opening: string;
  followUps: string[];
  expectedSignals: string[];
  linkedDossierId?: string;
  finalDecision?: 'accept' | 'refuse' | 'request_revision' | 'acknowledge';
};

const baselineCampaignCases: CampaignCase[] = [
  {
    id: 'aegean-gas',
    title: 'Exploitation coordonnée du gaz en Méditerranée orientale',
    participants: ['TUR', 'GRC'],
    opening: 'La France propose à la Turquie et à la Grèce d’examiner une exploitation coordonnée de leurs ressources gazières en Méditerranée orientale. Le principe serait de partager les bénéfices et les infrastructures sans préjuger de la souveraineté sur les zones maritimes disputées.',
    followUps: [
      'Nous entendons vos réserves. La coopération ne doit pas transformer une zone contestée en frontière reconnue : quelles garanties précises exigez-vous pour poursuivre ?',
      'La France propose un accord limité, réversible et sans reconnaissance territoriale, avec un mécanisme de suspension si les forages deviennent un fait accompli. Pouvez-vous préciser vos lignes rouges finales ?',
    ],
    expectedSignals: ['les deux pays répondent séparément', 'les zones disputées restent une ligne rouge', 'aucune souveraineté n’est implicitement cédée'],
    finalDecision: 'acknowledge',
  },
  {
    id: 'suriname-piracy',
    title: 'Coopération franco-surinamienne contre la pêche et la piraterie illégales',
    participants: ['SUR'],
    opening: 'La France propose au Suriname une coopération maritime pragmatique contre la piraterie, la pêche illégale et les trafics côtiers : échange d’informations, coordination des garde-côtes et formations ciblées, sans présence militaire permanente imposée.',
    followUps: ['La France peut commencer par un partage d’alertes et une formation courte, sous contrôle du Suriname. Quelles garanties de souveraineté et de financement vous feraient accepter ce dispositif ?'],
    expectedSignals: ['capacité maritime limitée', 'souveraineté du Suriname', 'coopération graduelle'],
    finalDecision: 'accept',
  },
  {
    id: 'latin-mediterranean',
    title: 'Coopération latine entre la France, l’Italie et l’Espagne',
    participants: ['ITA', 'ESP'],
    opening: 'La France propose à l’Italie et à l’Espagne une coopération latine en Méditerranée : coordination des infrastructures portuaires, sécurité maritime et projets économiques communs, sans créer une institution concurrente de l’Union européenne.',
    followUps: ['Nous proposons de commencer par trois projets mesurables : échanges portuaires, sécurité maritime et financement d’infrastructures. Quels secteurs et quelles garanties budgétaires souhaitez-vous retenir ?'],
    expectedSignals: ['priorités italiennes et espagnoles distinctes', 'complémentarité avec l’Union européenne', 'projets limités et mesurables'],
    finalDecision: 'accept',
  },
  {
    id: 'india-aircraft',
    title: 'Proposition française d’équipement aéronautique à l’Inde',
    participants: ['IND'],
    opening: 'La France propose à l’Inde d’examiner une coopération aéronautique et de défense autour d’avions de combat, de formation, de maintenance et de transfert industriel, dans le respect des capacités de production et de l’autonomie stratégique indienne.',
    followUps: ['Nous pouvons discuter d’un premier lot limité, d’un calendrier de livraison réaliste et d’une montée en compétence industrielle indienne. Quelles exigences opérationnelles et industrielles conditionnent votre intérêt ?'],
    expectedSignals: ['autonomie stratégique indienne', 'transfert industriel', 'production et livraisons plafonnées'],
    finalDecision: 'request_revision',
  },
];

/** Variante d’escalade demandée pour vérifier la résistance des négociations. */
const escalationCampaignCases: CampaignCase[] = [
  {
    id: 'aegean-gas-escalation',
    title: 'Égée : soutien français explicite à la position grecque',
    participants: ['TUR', 'GRC'],
    opening: 'La France propose à la Turquie et à la Grèce d’examiner une exploitation coordonnée du gaz en Méditerranée orientale, mais précise qu’aucun forage ne doit créer un fait accompli dans les zones disputées.',
    followUps: [
      'La France soutient désormais explicitement le principe grec : aucune opération dans une zone disputée sans accord préalable et mécanisme de déconfliction. La Turquie peut-elle accepter ce moratoire sans renoncer à ses revendications ?',
      'Nous proposons un moratoire vérifiable, une commission technique et un partage provisoire des recettes, sans reconnaissance de souveraineté. En cas de refus, la France soutiendra la Grèce dans les enceintes européennes et juridiques. Quelles garanties finales chaque gouvernement exige-t-il ?',
      'Si le statu quo persiste, la France prendra le parti de la Grèce : présence navale de signalement, soutien diplomatique et suspension de toute coopération qui banaliserait un forage unilatéral. Nous préférons un compromis, mais nous n’accepterons pas un fait accompli.',
    ],
    expectedSignals: ['la Grèce demande des garanties de souveraineté', 'la Turquie défend ses revendications', 'risque d’escalade ou de confrontation', 'aucun accord automatique'],
    finalDecision: 'acknowledge',
  },
  {
    id: 'suriname-illegal-gold-mining',
    title: 'Suriname : lutte contre l’orpaillage illégal avec présence française',
    participants: ['SUR'],
    opening: 'La France propose au Suriname une coopération ciblée contre l’orpaillage illégal, les trafics et la déforestation : renseignement fluvial, contrôle des pistes et soutien aux garde-côtes. La France souhaite aussi établir une force de liaison permanente et une base avancée conjointe, sous souveraineté surinamaise.',
    followUps: [
      'La France accepte que la base soit juridiquement surinamaise, mais demande un détachement français permanent de renseignement, de gendarmerie et de soutien logistique sur place. Quelles limites de souveraineté et quelles règles d’engagement le Suriname impose-t-il ?',
      'Sans présence française durable, le dispositif risque de rester symbolique face aux réseaux d’orpaillage. Nous proposons une base avancée conjointe, un mandat de trois ans renouvelable et un financement français des moyens fluviaux. Êtes-vous prêts à l’inscrire dans un accord formel ?',
      'Nous pouvons limiter les patrouilles françaises à la formation, au renseignement et à la protection des équipes, mais nous insistons pour que la base et le détachement figurent dans l’accord contre l’orpaillage illégal. Quelle contrepartie le Suriname demande-t-il pour accepter ?',
    ],
    expectedSignals: ['orpaillage illégal', 'souveraineté surinamaise', 'présence française sur place', 'mandat et règles d’engagement'],
    finalDecision: 'accept',
  },
  {
    id: 'latin-mediterranean-autonomy',
    title: 'France–Italie–Espagne : coopération méditerranéenne plus autonome',
    participants: ['ITA', 'ESP'],
    opening: 'La France propose à l’Italie et à l’Espagne un cadre latin de coopération en Méditerranée : ports, sécurité maritime, énergie et investissements. Le cadre resterait compatible avec l’Union européenne, mais pourrait décider et financer certaines initiatives sans attendre une impulsion de Bruxelles.',
    followUps: [
      'Nous proposons un secrétariat léger, un fonds méditerranéen et des décisions à trois sur les infrastructures et la sécurité maritime. L’Italie et l’Espagne accepteraient-elles une géométrie variable qui ne passe pas systématiquement par les institutions européennes ?',
      'La coopération ne vise pas à quitter l’Union, mais à disposer d’une capacité d’initiative autonome : financement commun, patrouilles coordonnées et contrats portuaires négociés ensemble. Quelles lignes rouges politiques ou budgétaires souhaitez-vous inscrire ?',
      'La France est prête à avancer même si l’Union ne valide pas chaque étape, avec transparence et compatibilité juridique. Nous demandons une décision politique de principe aujourd’hui et un premier projet méditerranéen hors calendrier communautaire. Qui est prêt à s’engager ?',
    ],
    expectedSignals: ['complémentarité mais autonomie vis-à-vis de l’UE', 'priorités italiennes et espagnoles distinctes', 'fonds ou secrétariat commun', 'risque politique de dissociation'],
    finalDecision: 'accept',
  },
  {
    id: 'india-aircraft-sale',
    title: 'Inde : finalisation d’une vente d’avions de combat',
    participants: ['IND'],
    opening: 'La France propose à l’Inde une vente ferme de 24 Mirage 2000-5/9, avec formation, maintenance en Inde et transfert industriel limité. Le calendrier doit rester compatible avec la capacité annuelle française et l’autonomie stratégique indienne.',
    followUps: [
      'Nous pouvons réserver 24 appareils sur quatre ans, avec un premier lot de six avions, formation des équipages et chaîne de maintenance indienne. Quelles exigences de transfert industriel, de financement et d’emploi opérationnel conditionnent votre accord ?',
      'La France accepte une montée en compétence industrielle et un centre de maintenance en Inde, mais conserve les éléments les plus sensibles des moteurs et de l’avionique. Nous pouvons aussi garantir un calendrier de livraison et une clause de non-réexportation. Cette formule répond-elle à vos besoins ?',
      'Nous validons les conditions : 24 avions, livraisons échelonnées sur quatre ans, formation, maintenance locale, financement pluriannuel et contrôle de l’usage final. La France demande maintenant la signature politique du contrat et le lancement de la commande.',
    ],
    expectedSignals: ['volume plafonné à 24 appareils', 'transfert industriel progressif', 'autonomie stratégique indienne', 'validation finale du contrat'],
    finalDecision: 'accept',
  },
];

const campaignCases = process.env.ORDO_CAMPAIGN_MODE === 'escalation' ? escalationCampaignCases : baselineCampaignCases;

type CallRecord = {
  stage: string;
  ok: boolean;
  jobId?: string;
  speakerId?: string;
  httpStatus?: number;
  latencyMs?: number;
  response?: unknown;
  error?: string;
};

type CaseRecord = CampaignCase & {
  calls: CallRecord[];
  dialogue?: DiplomaticDialogue;
  resolution?: unknown;
  dossierIdsBefore: string[];
  dossierIdsAfter: string[];
};

const nextMonth = (date: `${number}-${number}-${number}`) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10) as `${number}-${number}-${number}`;
};

async function askAI(state: WorldState, dialogueId: string, stage: string, calls: CallRecord[]) {
  const queued = requestDiplomaticDialogueAI(state, dialogueId);
  if (!queued.ok) {
    calls.push({ stage, ok: false, error: queued.error });
    return { state, ok: false as const };
  }
  const started = performance.now();
  const executed = await executeAIJob(queued.state, queued.jobId, sessionId, requestToOrigin);
  const record: CallRecord = {
    stage,
    ok: executed.ok,
    jobId: queued.jobId,
    speakerId: queued.speakerId,
    httpStatus: executed.ok ? 200 : 502,
    latencyMs: Math.round(performance.now() - started),
    response: executed.response,
  };
  if (!executed.ok) record.error = executed.response.message;
  calls.push(record);
  return { state: executed.state, ok: executed.ok as boolean };
}

async function runCase(initial: WorldState, scenario: CampaignCase): Promise<{ state: WorldState; record: CaseRecord }> {
  const calls: CallRecord[] = [];
  const dossierIdsBefore = Object.keys(initial.strategicDossiers);
  let state = initial;
  const opened = openDiplomaticDialogue(state, scenario.participants, scenario.opening, scenario.linkedDossierId);
  if (!opened.ok) {
    calls.push({ stage: 'open', ok: false, error: opened.error });
    return { state, record: { ...scenario, calls, dossierIdsBefore, dossierIdsAfter: dossierIdsBefore } };
  }
  state = opened.state;
  let turn = await askAI(state, opened.dialogueId, 'first_response', calls);
  state = turn.state;
  for (let index = 0; index < scenario.followUps.length && state.diplomaticDialogues[opened.dialogueId]?.status === 'awaiting_player'; index += 1) {
    const sent = sendDiplomaticDialogueMessage(state, opened.dialogueId, scenario.followUps[index]);
    if (!sent.ok) {
      calls.push({ stage: `player_follow_up_${index + 1}`, ok: false, error: sent.error });
      break;
    }
    state = sent.state;
    turn = await askAI(state, opened.dialogueId, `response_${index + 2}`, calls);
    state = turn.state;
    if (!turn.ok) break;
  }

  const dialogue = state.diplomaticDialogues[opened.dialogueId];
  let resolution: unknown;
  if (dialogue?.status === 'awaiting_player' && scenario.finalDecision) {
    const resolved = resolveDiplomaticDialogueResponse(state, opened.dialogueId, scenario.finalDecision);
    resolution = resolved.ok ? { ok: true, decision: scenario.finalDecision } : { ok: false, error: resolved.error };
    if (resolved.ok) state = resolved.state;
  }
  const finalDialogue = state.diplomaticDialogues[opened.dialogueId];
  return {
    state,
    record: {
      ...scenario,
      calls,
      dialogue: finalDialogue,
      resolution,
      dossierIdsBefore,
      dossierIdsAfter: Object.keys(state.strategicDossiers),
    },
  };
}

let state = createFrance2000World();
const initialDate = state.currentDate;
const records: CaseRecord[] = [];

for (const scenario of campaignCases) {
  const result = await runCase(state, scenario);
  state = result.state;
  records.push(result.record);
  const successfulCalls = result.record.calls.filter((call) => call.ok);
  const speakers = successfulCalls.map((call) => call.speakerId).filter(Boolean);
  console.log(`${scenario.id}: calls=${successfulCalls.length}/${result.record.calls.length} speakers=${speakers.join(',') || 'none'} status=${result.record.dialogue?.status ?? 'failed'}`);
}

const monthlyAdvances: Array<Record<string, unknown>> = [];
for (let month = 0; month < 12; month += 1) {
  const from = state.currentDate;
  const advanced = advanceWorld(state, nextMonth(state.currentDate));
  state = advanced.state;
  monthlyAdvances.push({
    month: month + 1,
    from,
    to: state.currentDate,
    elapsedMonths: advanced.elapsedMonths,
    reviewedCountryIds: advanced.reviewedCountryIds,
    dossierCount: Object.keys(state.strategicDossiers).length,
    activeTreaties: Object.values(state.treaties).filter((treaty) => treaty.status === 'active').map((treaty) => treaty.label),
    resolution: advanced.resolution,
  });
  console.log(`advance ${month + 1}/12 date=${state.currentDate} dossiers=${Object.keys(state.strategicDossiers).length}`);
}

const output = {
  sessionId,
  origin,
  initialDate,
  finalDate: state.currentDate,
  scenarios: records,
  monthlyAdvances,
  final: {
    countryCount: Object.keys(state.countries).length,
    actionCount: state.actions.length,
    dossierCount: Object.keys(state.strategicDossiers).length,
    activeTreaties: Object.values(state.treaties).filter((treaty) => treaty.status === 'active').map((treaty) => ({ id: treaty.id, label: treaty.label, parties: treaty.parties, endDate: treaty.endDate })),
    relations: Object.values(state.relations).filter((relation) => records.some((record) => record.participants.includes(relation.from) || record.participants.includes(relation.to))),
  },
};

await mkdir('outputs', { recursive: true });
const outputPath = `outputs/ai-diplomatic-campaign-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`saved=${outputPath}`);
console.log(JSON.stringify(output.final, null, 2));
