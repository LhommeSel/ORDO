import { energyBalance, nodeAvailableExport, activateEnergyContract, proposeEnergyContract } from './energy';
import { createDossier, recordDossierUpdate } from './dossiers';
import { evaluateStrategicAction } from './decision-making';
import { commitWorldAction, relationBetween } from './ledger';
import type { AIDiplomaticMove, AIJobAIAnswer } from '../ai/job-contracts';
import type { AIJobOutcome, CountryId, DiplomaticEnergyTerms, DiplomaticSession, EnergyResource, GeneralAIJob, ISODate, StrategicActionCandidate, WorldState } from './types';

export type EnergyOfferAdjustment =
  | 'more_volume'
  | 'better_price'
  | 'shorter_term'
  | 'delivery_security';

export type EnergyAdministrativeOffer = {
  id: string;
  buyerId: CountryId;
  supplierId: CountryId;
  nodeId: string;
  resource: EnergyResource;
  annualVolume: number;
  coverageShare: number;
  durationYears: number;
  startDate: ISODate;
  endDate: ISODate;
  pricePosture: 'market' | 'buyer_favorable' | 'seller_premium';
  priceSummary: string;
  route: string;
  politicalClauses: string[];
  diplomaticEffort: 'faible' | 'modérée' | 'forte';
  adjustments: EnergyOfferAdjustment[];
  revision: number;
};

export type EnergyCounterpartResponse = {
  status: 'accepted' | 'countered' | 'refused';
  offer: EnergyAdministrativeOffer;
  message: string;
  reasons: string[];
};

const addYears = (date: ISODate, years: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString().slice(0, 10) as ISODate;
};

const round = (value: number) => Number(value.toFixed(2));
const energyDossierId = (offer: EnergyAdministrativeOffer) => `energy-${offer.buyerId}-${offer.supplierId}-${offer.resource}`;

const diplomaticTerms = (offer: EnergyAdministrativeOffer): DiplomaticEnergyTerms => ({
  resource: offer.resource, nodeId: offer.nodeId, annualVolume: offer.annualVolume,
  coverageShare: offer.coverageShare, durationYears: offer.durationYears,
  startDate: offer.startDate, endDate: offer.endDate, priceSummary: offer.priceSummary,
  route: offer.route, politicalClauses: offer.politicalClauses,
});

const clauseLabels: Record<AIDiplomaticMove['clauses'][number], string> = {
  delivery_priority: 'Priorité de livraison en période de tension',
  infrastructure_investment: 'Participation à l’investissement dans les infrastructures de transit',
  local_content: 'Part locale pour les entreprises du pays fournisseur',
  technology_cooperation: 'Coopération technique limitée à la filière énergétique',
  diplomatic_consultation: 'Consultation diplomatique annuelle sur la sécurité énergétique',
};

const priceSummaries: Record<NonNullable<AIDiplomaticMove['pricePosture']>, string> = {
  market: 'Prix de marché indexé, révision tous les trois ans',
  supplier_premium: 'Indice de marché assorti d’une prime de sécurité au fournisseur',
  buyer_discount: 'Indice de marché assorti d’une décote de long terme',
};

function createDiplomacyJob(state: WorldState, session: DiplomaticSession, playerIntent: string): GeneralAIJob {
  const jobId = `diplomacy:${session.id}:${session.turns.length}`;
  return {
    id: jobId, kind: 'diplomacy', schemaVersion: 1, priority: 'normal', budgetTier: 'standard',
    status: 'pending', requestedAt: state.currentDate, attempts: 0,
    inputText: playerIntent.slice(0, 30_000),
    purpose: `Réponse de ${session.counterpartId} dans la négociation énergétique ${session.id}`,
    actorId: session.initiatorId,
    reasons: ['Produire une réponse nationale située sans contourner les contraintes physiques du moteur.'],
    context: {
      respondingCountryId: session.counterpartId,
      targetCountryId: session.counterpartId,
      diplomaticSessionId: session.id,
      negotiationKind: session.kind,
      currentTerms: session.terms,
      recentTurns: session.turns.slice(-12),
    },
  };
}

export function administrativeOfferFromSession(session: DiplomaticSession): EnergyAdministrativeOffer {
  return {
    id: session.id, buyerId: session.initiatorId, supplierId: session.counterpartId,
    nodeId: session.terms.nodeId, resource: session.terms.resource,
    annualVolume: session.terms.annualVolume, coverageShare: session.terms.coverageShare,
    durationYears: session.terms.durationYears, startDate: session.terms.startDate,
    endDate: session.terms.endDate, priceSummary: session.terms.priceSummary,
    pricePosture: session.terms.priceSummary.includes('prime de sécurité') ? 'seller_premium'
      : session.terms.priceSummary.includes('décote') ? 'buyer_favorable' : 'market',
    route: session.terms.route, politicalClauses: session.terms.politicalClauses,
    diplomaticEffort: session.turns.length >= 5 ? 'forte' : session.turns.length >= 3 ? 'modérée' : 'faible',
    adjustments: [], revision: Math.max(0, session.turns.filter((turn) => turn.proposalRevision !== undefined).length - 1),
  };
}

export function energyCounterpartResponseFromSession(session: DiplomaticSession, reasons: string[] = []): EnergyCounterpartResponse {
  const status: EnergyCounterpartResponse['status'] = session.status === 'awaiting_signature' || session.status === 'active'
    ? 'accepted' : session.status === 'refused' ? 'refused' : 'countered';
  const lastCounterpartTurn = [...session.turns].reverse().find((turn) => turn.speakerId === session.counterpartId);
  return {
    status,
    offer: administrativeOfferFromSession(session),
    message: lastCounterpartTurn?.publicMessage ?? 'La négociation est en attente d’une réponse.',
    reasons,
  };
}

export function startEnergyNegotiationAI(state: WorldState, offer: EnergyAdministrativeOffer) {
  const supplier = state.countries[offer.supplierId];
  const buyer = state.countries[offer.buyerId];
  if (!supplier || !buyer) return { ok: false as const, state, error: 'Les participants de la négociation sont inconnus.' };
  if (offer.annualVolume > nodeAvailableExport(state, offer.nodeId)) return { ok: false as const, state, error: 'Le volume proposé dépasse désormais la capacité exportable.' };
  const dossierId = energyDossierId(offer);
  const session: DiplomaticSession = {
    id: offer.id, kind: 'energy_contract', initiatorId: offer.buyerId, counterpartId: offer.supplierId,
    participantIds: [offer.buyerId, offer.supplierId], status: 'awaiting_response', aiMode: 'ai',
    openedAt: state.currentDate, updatedAt: state.currentDate, terms: diplomaticTerms(offer),
    turns: [{
      id: `${offer.id}-turn-proposal-${offer.revision}`, date: state.currentDate,
      speakerId: offer.buyerId, kind: 'proposal', proposalRevision: offer.revision,
      publicMessage: `Proposition de ${offer.annualVolume.toFixed(2)} unités par an sur ${offer.durationYears} ans, ${offer.priceSummary.toLowerCase()}.`,
    }],
    privatePosition: {
      ownerCountryId: offer.supplierId, willingness: 50,
      motivations: supplier.strategy.goals.filter((goal) => goal.status === 'active').map((goal) => goal.label),
      objections: supplier.strategy.vulnerabilities,
      redLines: supplier.strategy.redLines,
    },
    linkedDossierId: dossierId,
  };
  const job = createDiplomacyJob(state, session, session.turns[0].publicMessage);
  let next = createDossier(state, {
    id: dossierId, title: `Approvisionnement ${offer.resource === 'gas' ? 'gazier' : 'pétrolier'} ${buyer.name}–${supplier.name}`,
    kind: 'economic', status: 'active', importance: 'moderate', actorIds: [offer.buyerId, offer.supplierId],
    regionTags: [], startedAt: state.currentDate, updatedAt: state.currentDate, phase: 'Réponse diplomatique attendue', trend: 'stable',
    publicSummary: 'Une proposition énergétique a été transmise par voie diplomatique.', followed: true, autoTracked: false,
    playerStance: 'Sécuriser un accord soutenable et négocier les contreparties.', commitments: [],
    pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [], entries: [],
  }, offer.buyerId, 'player');
  next = commitWorldAction(next, {
    kind: 'diplomatic', actorId: offer.buyerId, targetIds: [offer.supplierId], origin: 'player',
    intent: `Ouvrir avec Luna une négociation énergétique avec ${supplier.name}`,
    effects: [
      { kind: 'diplomatic_session_add', session, reason: 'La négociation IA est inscrite dans la mémoire diplomatique.', visibility: 'player' },
      { kind: 'ai_job_add', job, reason: 'Le pays interlocuteur doit répondre selon ses intérêts privés et son identité politique.', visibility: 'debug' },
    ],
  });
  return { ok: true as const, state: next, sessionId: session.id, jobId: job.id };
}

export function continueEnergyNegotiationAI(state: WorldState, sessionId: string, playerMessage: string) {
  const session = state.diplomaticSessions[sessionId];
  const message = playerMessage.trim();
  if (!session || session.aiMode !== 'ai') return { ok: false as const, state, error: 'Cette négociation IA est introuvable.' };
  if (!['countered', 'awaiting_signature'].includes(session.status)) return { ok: false as const, state, error: 'Cette négociation n’attend pas de réponse du joueur.' };
  if (message.length < 3 || message.length > 4_000) return { ok: false as const, state, error: 'La réponse doit contenir entre 3 et 4 000 caractères.' };
  const turns = [...session.turns, {
    id: `${session.id}-turn-player-${session.turns.length + 1}`, date: state.currentDate,
    speakerId: session.initiatorId, kind: 'message' as const, publicMessage: message,
  }];
  const pendingSession = { ...session, status: 'awaiting_response' as const, updatedAt: state.currentDate, turns };
  const job = createDiplomacyJob(state, pendingSession, message);
  const next = commitWorldAction(state, {
    kind: 'diplomatic', actorId: session.initiatorId, targetIds: [session.counterpartId], origin: 'player',
    intent: `Répondre à ${session.counterpartId} dans la négociation ${session.id}`,
    effects: [
      { kind: 'diplomatic_session_patch', sessionId, patch: { status: 'awaiting_response', updatedAt: state.currentDate, turns }, reason: 'La réponse du joueur poursuit la session existante.', visibility: 'player' },
      { kind: 'ai_job_add', job, reason: 'Une nouvelle réponse diplomatique de l’interlocuteur est requise.', visibility: 'debug' },
    ],
  });
  return { ok: true as const, state: next, jobId: job.id };
}

export function applyEnergyDiplomacyAIAnswer(state: WorldState, jobId: string, answer: AIJobAIAnswer, outcome: AIJobOutcome) {
  const job = state.aiJobs[jobId];
  if (!job || job.kind !== 'diplomacy' || job.status !== 'pending') return { ok: false as const, state, errors: ['Tâche diplomatique absente ou déjà résolue.'] };
  const sessionId = typeof job.context.diplomaticSessionId === 'string' ? job.context.diplomaticSessionId : '';
  const session = state.diplomaticSessions[sessionId];
  const move = answer.diplomaticMove;
  if (!session || session.status !== 'awaiting_response' || !move) return { ok: false as const, state, errors: ['Session diplomatique incohérente.'] };
  let terms = session.terms;
  let status: DiplomaticSession['status'] = 'countered';
  if (move.kind === 'accept') status = 'awaiting_signature';
  if (move.kind === 'refuse') status = 'refused';
  if (move.kind === 'counter') {
    const available = nodeAvailableExport(state, session.terms.nodeId);
    const demand = state.countryEnergy[session.initiatorId]?.annualDemand[session.terms.resource] ?? 0;
    if (move.annualVolume === null || move.durationYears === null || move.pricePosture === null
      || move.annualVolume > available || move.annualVolume > demand * 0.35) {
      return { ok: false as const, state, errors: ['La contre-proposition de Luna dépasse les limites physiques ou commerciales autorisées.'] };
    }
    const durationYears = Math.round(move.durationYears);
    terms = {
      ...terms, annualVolume: round(move.annualVolume), coverageShare: round(move.annualVolume / Math.max(1, demand) * 100),
      durationYears, endDate: addYears(terms.startDate, durationYears), priceSummary: priceSummaries[move.pricePosture],
      politicalClauses: [...new Set(move.clauses.map((clause) => clauseLabels[clause]))],
    };
  }
  const turn = {
    id: `${session.id}-turn-ai-${session.turns.length + 1}`, date: state.currentDate,
    speakerId: session.counterpartId,
    kind: move.kind === 'accept' ? 'acceptance' as const : move.kind === 'refuse' ? 'refusal' as const : move.kind === 'counter' ? 'counterproposal' as const : 'message' as const,
    publicMessage: answer.publicMessage, proposalRevision: move.kind === 'counter' ? session.turns.length : undefined,
  };
  let next = commitWorldAction(state, {
    kind: 'diplomatic', actorId: session.counterpartId, targetIds: [session.initiatorId], origin: 'ai',
    intent: `Répondre dans la négociation ${session.id}`,
    effects: [
      { kind: 'diplomatic_session_patch', sessionId, patch: { status, terms, updatedAt: state.currentDate, turns: [...session.turns, turn] }, reason: 'Le mouvement structuré de Luna est validé par le moteur diplomatique.', visibility: 'player' },
      { kind: 'ai_job_patch', jobId, patch: { status: 'resolved', resolvedAt: state.currentDate, attempts: job.attempts + 1, outcome, error: undefined }, reason: 'La réponse IA a été contrôlée et rattachée à sa session.', visibility: 'debug' },
    ],
  });
  next = recordDossierUpdate(next, session.linkedDossierId, {
    id: `${turn.id}-dossier`, title: status === 'awaiting_signature' ? 'Accord de principe obtenu' : status === 'refused' ? 'Négociation refusée' : 'Réponse diplomatique reçue',
    summary: answer.publicMessage, importance: status === 'awaiting_signature' ? 'major' : 'moderate', actorIds: [session.counterpartId],
    requiresDecision: status !== 'refused', actorId: session.counterpartId, origin: 'ai',
    patch: {
      phase: status === 'awaiting_signature' ? 'Accord en attente de signature' : status === 'refused' ? 'Négociation interrompue' : 'Contre-proposition à arbitrer',
      status: status === 'refused' ? 'deescalating' : 'active',
      pendingDecisions: status === 'refused' ? [] : ['Signer les termes actuels ou poursuivre la négociation.'],
      publicSummary: answer.publicMessage,
    },
  });
  return { ok: true as const, state: next, sessionId };
}

export function createAdministrativeEnergyOffer(
  state: WorldState,
  supplierId: CountryId,
  resource: EnergyResource,
) {
  const buyerId = state.playerCountryId;
  const energy = state.countryEnergy[buyerId];
  const balance = energyBalance(state, buyerId, resource);
  const node = Object.values(state.energyNodes)
    .filter((candidate) => candidate.countryId === supplierId && candidate.resource === resource)
    .sort((a, b) => nodeAvailableExport(state, b.id) - nodeAvailableExport(state, a.id))[0];
  if (!energy || !balance) return { ok: false as const, error: 'Le pays joueur ne possède pas de bilan énergétique exploitable.' };
  if (!node) return { ok: false as const, error: 'Ce pays ne dispose pas d’une filière exportatrice adaptée.' };
  const available = nodeAvailableExport(state, node.id);
  if (available <= 0) return { ok: false as const, error: 'La capacité exportable de ce fournisseur est déjà attribuée.' };

  const demand = energy.annualDemand[resource];
  const targetShare = balance.deficit > demand * 0.35 ? 0.16 : 0.1;
  const annualVolume = round(Math.min(balance.deficit || demand * 0.08, demand * targetShare, available * 0.18));
  if (annualVolume <= 0) return { ok: false as const, error: 'Aucun volume cohérent ne peut être demandé actuellement.' };
  const durationYears = resource === 'gas' ? 12 : 8;
  const offer: EnergyAdministrativeOffer = {
    id: `offer-${buyerId}-${supplierId}-${resource}-${state.currentDate}`,
    buyerId, supplierId, nodeId: node.id, resource, annualVolume,
    coverageShare: round((annualVolume / demand) * 100), durationYears,
    startDate: state.currentDate, endDate: addYears(state.currentDate, durationYears),
    pricePosture: 'market',
    priceSummary: 'Prix de marché indexé, révision tous les trois ans',
    route: node.infrastructure[0] ?? 'Acheminement à convenir',
    politicalClauses: [], diplomaticEffort: 'faible', adjustments: [], revision: 0,
  };
  return { ok: true as const, offer };
}

export function adjustEnergyOffer(
  state: WorldState,
  offer: EnergyAdministrativeOffer,
  adjustment: EnergyOfferAdjustment,
) {
  if (offer.adjustments.includes(adjustment)) return offer;
  const demand = state.countryEnergy[offer.buyerId]?.annualDemand[offer.resource] ?? offer.annualVolume;
  const available = nodeAvailableExport(state, offer.nodeId);
  let next = { ...offer, adjustments: [...offer.adjustments, adjustment], revision: offer.revision + 1 };
  if (adjustment === 'more_volume') {
    const annualVolume = round(Math.min(offer.annualVolume * 1.35, demand * 0.24, available * 0.32));
    next = { ...next, annualVolume, coverageShare: round((annualVolume / demand) * 100) };
  }
  if (adjustment === 'better_price') {
    next = { ...next, pricePosture: 'buyer_favorable', priceSummary: 'Décote demandée sur l’indice de marché' };
  }
  if (adjustment === 'shorter_term') {
    const durationYears = Math.max(3, offer.durationYears - (offer.resource === 'gas' ? 5 : 3));
    next = { ...next, durationYears, endDate: addYears(offer.startDate, durationYears) };
  }
  if (adjustment === 'delivery_security') {
    next = { ...next, politicalClauses: [...offer.politicalClauses, 'Garantie prioritaire de livraison en période de tension'] };
  }
  const count = next.adjustments.length;
  const diplomaticEffort: EnergyAdministrativeOffer['diplomaticEffort'] = count >= 3 ? 'forte' : 'modérée';
  return { ...next, diplomaticEffort };
}

export function sendEnergyOffer(state: WorldState, offer: EnergyAdministrativeOffer) {
  const supplier = state.countries[offer.supplierId];
  if (!supplier) return { ok: false as const, state, error: 'Interlocuteur inconnu.' };
  const available = nodeAvailableExport(state, offer.nodeId);
  const demand = state.countryEnergy[offer.buyerId]?.annualDemand[offer.resource] ?? offer.annualVolume;
  const relation = relationBetween(state, offer.buyerId, offer.supplierId);
  const fairVolume = Math.min(available * 0.22, demand * 0.2);
  const volumePressure = fairVolume > 0 ? Math.max(0, offer.annualVolume / fairVolume - 1) : 4;
  const strategicCandidate: StrategicActionCandidate = {
    id: `${offer.id}-supplier-decision`, actorId: offer.supplierId,
    label: `Conclure un contrat ${offer.resource} avec ${offer.buyerId}`,
    kind: 'diplomatic',
    outcomes: {
      growth: Math.min(52, 18 + offer.annualVolume / Math.max(1, available) * 70),
      employment: 18,
      fiscal_sustainability: offer.durationYears >= 10 ? 34 : 20,
      strategic_autonomy: offer.annualVolume > available * 0.3 ? -24 : 8,
      alliance_cohesion: relation && relation.relation >= 55 ? 22 : 4,
      regime_survival: 8,
      elite_support: 16,
      international_prestige: 10,
    },
    signals: [
      'commercial_deal',
      ...(relation && relation.relation >= 55 ? ['alliance_cooperation' as const] : []),
      ...(offer.annualVolume > available * 0.3 ? ['foreign_dependency' as const] : []),
    ],
    doctrine: { economic: 8, sovereignty: offer.annualVolume > available * 0.3 ? -18 : 10 },
    requiredAuthority: 'executive', publicSalience: 38,
    administrativeComplexity: 42 + offer.adjustments.length * 7,
    urgency: 28, risk: 24 + offer.adjustments.length * 8,
    resourceCost: Math.min(85, offer.annualVolume / Math.max(1, available) * 100),
    metadata: { timeHorizonYears: offer.durationYears, counterpartId: offer.buyerId },
  };
  const strategicEvaluation = evaluateStrategicAction(state, strategicCandidate);
  let score = 55 + ((relation?.relation ?? 50) - 50) * 0.22 + ((relation?.trust ?? 45) - 45) * 0.12;
  if (offer.durationYears >= 10) score += 8;
  if (offer.durationYears <= 5) score -= 9;
  if (offer.pricePosture === 'buyer_favorable') score -= 11;
  if (offer.politicalClauses.length) score -= 3;
  score -= volumePressure * 34;
  score += (strategicEvaluation.finalScore - 35) * 0.38;

  let responseOffer = offer;
  let status: EnergyCounterpartResponse['status'];
  let message: string;
  const reasons: string[] = [];
  if (offer.annualVolume > available || score < 28) {
    status = 'refused';
    reasons.push(offer.annualVolume > available ? 'Le volume n’est plus physiquement disponible.' : 'Les conditions cumulées sont jugées trop défavorables.');
    message = `${supplier.name} ne souhaite pas ouvrir de négociation sur cette base. Une proposition plus limitée ou plus longue pourrait être examinée.`;
  } else if (score < 60) {
    status = 'countered';
    const annualVolume = round(Math.min(offer.annualVolume, fairVolume));
    const durationYears = offer.resource === 'gas' ? Math.max(8, offer.durationYears) : Math.max(6, offer.durationYears);
    responseOffer = {
      ...offer, annualVolume, coverageShare: round((annualVolume / demand) * 100), durationYears,
      endDate: addYears(offer.startDate, durationYears), pricePosture: 'market',
      priceSummary: 'Prix de marché indexé, révision tous les trois ans', revision: offer.revision + 1,
    };
    reasons.push('Le fournisseur protège sa marge exportable et refuse une décote durable.');
    message = `${supplier.name} accepte le principe d’un accord, mais propose de couvrir ${responseOffer.coverageShare.toFixed(1)} % des besoins du pays acheteur sur ${durationYears} ans, aux conditions de marché.`;
  } else {
    status = 'accepted';
    reasons.push('Le volume reste compatible avec les engagements existants et la durée sécurise les recettes du fournisseur.');
    message = `${supplier.name} accepte la proposition administrative : ${offer.coverageShare.toFixed(1)} % des besoins couverts sur ${offer.durationYears} ans.`;
  }
  reasons.push(`La direction politique juge la proposition ${strategicEvaluation.leaderDisposition >= 58 ? 'compatible avec sa manière de gouverner' : strategicEvaluation.leaderDisposition < 42 ? 'contraire à ses préférences' : 'politiquement acceptable'}.`);
  reasons.push(`L’appareil d’État offre un soutien ${strategicEvaluation.apparatusSupport >= 62 ? 'solide' : strategicEvaluation.apparatusSupport < 42 ? 'fragile' : 'mesuré'} à sa mise en œuvre.`);
  const dossierId = energyDossierId(offer);
  const buyer = state.countries[offer.buyerId];
  let prepared = createDossier(state, {
    id: dossierId,
    title: `Approvisionnement ${offer.resource === 'gas' ? 'gazier' : 'pétrolier'} ${buyer?.name ?? offer.buyerId}–${supplier.name}`,
    kind: 'economic', status: 'active', importance: 'moderate',
    actorIds: [offer.buyerId, offer.supplierId], regionTags: [],
    startedAt: state.currentDate, updatedAt: state.currentDate,
    phase: 'Préparation de l’offre', trend: 'stable',
    publicSummary: `Une négociation de long terme porte sur ${offer.coverageShare.toFixed(1)} % des besoins du pays acheteur.`,
    followed: true, autoTracked: false,
    playerStance: 'Sécuriser les approvisionnements sans monopoliser la capacité du fournisseur.',
    commitments: [], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [], entries: [],
  }, offer.buyerId, 'player');
  const session: DiplomaticSession = {
    id: offer.id, kind: 'energy_contract', initiatorId: offer.buyerId, counterpartId: offer.supplierId,
    participantIds: [offer.buyerId, offer.supplierId],
    status: status === 'accepted' ? 'awaiting_signature' : status === 'countered' ? 'countered' : 'refused',
    aiMode: 'local', openedAt: state.currentDate, updatedAt: state.currentDate,
    terms: diplomaticTerms(responseOffer), linkedDossierId: dossierId,
    turns: [
      { id: `${offer.id}-turn-proposal-${offer.revision}`, date: state.currentDate, speakerId: offer.buyerId, kind: 'proposal', publicMessage: `Proposition de ${offer.annualVolume.toFixed(2)} unités par an sur ${offer.durationYears} ans.`, proposalRevision: offer.revision },
      { id: `${offer.id}-turn-response-${responseOffer.revision}`, date: state.currentDate, speakerId: offer.supplierId, kind: status === 'accepted' ? 'acceptance' : status === 'countered' ? 'counterproposal' : 'refusal', publicMessage: message, proposalRevision: responseOffer.revision },
    ],
    privatePosition: {
      ownerCountryId: offer.supplierId,
      willingness: Math.max(0, Math.min(100, round(score))),
      motivations: [
        'Sécuriser des recettes d’exportation compatibles avec la capacité physique.',
        ...supplier.strategy.goals.filter((goal) => goal.status === 'active').map((goal) => goal.label),
      ],
      objections: strategicEvaluation.reasons.filter((reason) => /tabou|ligne rouge|risque|coût politique/i.test(reason)),
      redLines: supplier.strategy.redLines,
    },
  };
  const existingSession = prepared.diplomaticSessions[session.id];
  const pendingSessionJobs = Object.values(prepared.aiJobs).filter((job) => job.kind === 'diplomacy'
    && job.status === 'pending' && job.context.diplomaticSessionId === session.id);
  prepared = commitWorldAction(prepared, {
    kind: 'diplomatic', actorId: offer.buyerId, targetIds: [offer.supplierId], origin: 'player',
    intent: `Transmettre une proposition de contrat ${offer.resource === 'gas' ? 'gazier' : 'pétrolier'} à ${supplier.name}`,
    effects: [
      existingSession
        ? { kind: 'diplomatic_session_patch' as const, sessionId: session.id, patch: session, reason: 'La résolution locale remplace la tentative IA en attente.', visibility: 'player' as const }
        : { kind: 'diplomatic_session_add' as const, session, reason: 'Ouverture et première réponse d’une négociation persistante.', visibility: 'player' as const },
      ...pendingSessionJobs.map((job) => ({ kind: 'ai_job_patch' as const, jobId: job.id, patch: { status: 'cancelled' as const, error: 'Résolution locale choisie par le joueur.' }, reason: 'Le joueur choisit la résolution locale.', visibility: 'debug' as const })),
    ],
    assumptions: [`Offre administrative, révision ${offer.revision}.`],
  });
  const pendingDecisions = status === 'accepted'
    ? ['Signer ou abandonner l’accord accepté par le fournisseur.']
    : status === 'countered' ? ['Accepter, modifier ou refuser la contre-proposition.'] : [];
  const next = recordDossierUpdate(prepared, dossierId, {
    id: `response-${offer.revision}-${state.currentDate}-${state.sequence + 1}`,
    title: status === 'accepted' ? 'Proposition acceptée' : status === 'countered' ? 'Contre-proposition reçue' : 'Proposition refusée',
    summary: message, importance: 'moderate', actorIds: [offer.supplierId],
    requiresDecision: status !== 'refused', actorId: offer.supplierId, origin: 'local_rule',
    patch: {
      phase: status === 'accepted' ? 'Accord en attente de signature' : status === 'countered' ? 'Contre-proposition à arbitrer' : 'Négociation interrompue',
      status: status === 'refused' ? 'deescalating' : 'active', pendingDecisions,
      publicSummary: message,
    },
  });
  return { ok: true as const, state: next, response: { status, offer: responseOffer, message, reasons } satisfies EnergyCounterpartResponse };
}

export function acceptEnergyOffer(state: WorldState, offer: EnergyAdministrativeOffer) {
  const contractId = `player-${offer.buyerId}-${offer.supplierId}-${offer.resource}-${state.currentDate}-${state.sequence + 1}`;
  const proposed = proposeEnergyContract(state, {
    id: contractId, nodeId: offer.nodeId, buyerId: offer.buyerId,
    annualVolume: offer.annualVolume, startDate: offer.startDate, endDate: offer.endDate,
    priceFormula: offer.priceSummary, route: offer.route, politicalClauses: offer.politicalClauses,
    breachPenalty: round(offer.annualVolume * 1.5), origin: 'player',
  });
  if (!proposed.ok) return proposed;
  const activated = activateEnergyContract(proposed.state, contractId, offer.buyerId, 'player');
  if (!activated.ok) return activated;
  const dossierId = energyDossierId(offer);
  const session = activated.state.diplomaticSessions[offer.id];
  const withSession = session ? commitWorldAction(activated.state, {
    kind: 'diplomatic', actorId: offer.buyerId, targetIds: [offer.supplierId], origin: 'player',
    intent: `Signer l’accord négocié avec ${offer.supplierId}`,
    effects: [
      { kind: 'diplomatic_session_patch', sessionId: offer.id, patch: {
        status: 'active', updatedAt: state.currentDate, linkedContractId: contractId,
        turns: [...session.turns, { id: `${offer.id}-turn-signature`, date: state.currentDate, speakerId: offer.buyerId, kind: 'signature', publicMessage: 'L’accord est signé et entre en vigueur.', proposalRevision: offer.revision }],
      }, reason: 'La signature clôt la négociation et transforme la proposition en engagement actif.', visibility: 'player' },
      { kind: 'relation_delta', from: offer.buyerId, to: offer.supplierId, relation: 2, trust: 2, reason: 'La conclusion d’un accord énergétique renforce la relation bilatérale.', visibility: 'public' },
    ],
  }) : activated.state;
  const next = recordDossierUpdate(withSession, dossierId, {
    id: `signature-${contractId}`, title: 'Accord signé et activé',
    summary: `Le contrat réserve ${offer.annualVolume.toFixed(2)} unités par an jusqu’au ${offer.endDate}.`,
    importance: 'major', actorIds: [offer.buyerId, offer.supplierId], actorId: offer.buyerId, origin: 'player',
    patch: {
      phase: 'Exécution du contrat', trend: 'stable', pendingDecisions: [],
      commitments: [`${offer.annualVolume.toFixed(2)} unités/an jusqu’au ${offer.endDate} · ${offer.priceSummary}`],
      publicSummary: 'L’accord est ratifié ; les volumes sont intégrés au registre énergétique mondial.',
    },
  });
  return { ok: true as const, state: next, contractId };
}
