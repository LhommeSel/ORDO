import { commitWorldAction, relationBetween } from './ledger';
import { pickSeeded } from './random';
import type { ArmamentProduct, CountryId, WorldState } from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

export function advanceIndustrySystem(state: WorldState, elapsedMonths: number) {
  let next = state;
  for (const sector of Object.values(state.sectors)) {
    if (sector.modelingLevel === 'aggregate') continue;
    const workloadMonths = Math.max(0, sector.workloadMonths - elapsedMonths);
    const targetUtilization = workloadMonths >= 18 ? 92 : workloadMonths >= 6 ? 70 : workloadMonths > 0 ? 48 : 28;
    const maxMove = elapsedMonths * (targetUtilization > sector.utilization ? 2.2 : 1.4);
    const utilization = sector.utilization + Math.sign(targetUtilization - sector.utilization) * Math.min(Math.abs(targetUtilization - sector.utilization), maxMove);
    const healthDelta = utilization < 35 ? -0.45 * elapsedMonths : utilization > 65 ? 0.08 * elapsedMonths : -0.08 * elapsedMonths;
    next = commitWorldAction(next, {
      kind: 'industrial', actorId: sector.countryId, origin: 'time', intent: `Actualiser la filière ${sector.sector}`,
      visibility: 'debug',
      effects: [{
        kind: 'sector_patch', sectorId: sector.id,
        patch: { workloadMonths: Number(workloadMonths.toFixed(2)), utilization: Number(clamp(utilization).toFixed(2)), health: Number(clamp(sector.health + healthDelta).toFixed(2)) },
        reason: 'La charge industrielle baisse avec les livraisons et l’utilisation évolue avec inertie.', visibility: 'debug',
      }],
    });
  }

  for (const product of Object.values(next.armamentProducts)) {
    if (product.status === 'discontinued') continue;
    const backlogMonths = Math.max(0, product.backlogMonths - elapsedMonths);
    let industrialHealth = product.industrialHealth;
    let status = product.status;
    if (backlogMonths < 6 && product.status !== 'development') industrialHealth -= elapsedMonths * 0.45;
    if (backlogMonths === 0 && industrialHealth < 38) status = 'standby';
    next = commitWorldAction(next, {
      kind: 'industrial', actorId: product.countryId, origin: 'time', intent: `Faire progresser le carnet de ${product.name}`,
      visibility: 'debug',
      effects: [{
        kind: 'armament_patch', productId: product.id,
        patch: { backlogMonths: Number(backlogMonths.toFixed(2)), industrialHealth: Number(clamp(industrialHealth).toFixed(2)), status },
        reason: 'Les livraisons consomment progressivement le carnet de commandes.', visibility: 'debug',
      }],
    });
  }
  return createAutomaticArmamentProspects(next);
}

export function rankArmamentProspectBuyers(state: WorldState, product: ArmamentProduct) {
  return Object.values(state.countries)
    .filter((country) => country.id !== product.countryId)
    .map((country) => {
      const relation = relationBetween(state, product.countryId, country.id)?.relation ?? 45;
      const economy = state.macroEconomies[country.id];
      const securityNeed = clamp(72 - country.metrics.security);
      const affordability = economy
        ? clamp(Math.log10(Math.max(1, economy.realGdpBillion2000Usd)) * 22 - economy.financialStress * 0.18)
        : clamp(country.weight * 0.55);
      const existingClient = product.clients.some((client) => client.countryId === country.id);
      const unresolvedProspect = product.prospects.some((prospect) => prospect.countryId === country.id && ['prospecting', 'negotiating', 'approval_required', 'won'].includes(prospect.status));
      const score = relation * 0.34 + securityNeed * 0.24 + affordability * 0.22 + country.weight * 0.2
        + (existingClient ? 14 : 0) - (unresolvedProspect ? 100 : 0);
      return { countryId: country.id, score, relation, securityNeed, affordability };
    })
    .filter((candidate) => candidate.score > 30)
    .sort((a, b) => b.score - a.score || a.countryId.localeCompare(b.countryId));
}

export function createAutomaticArmamentProspects(state: WorldState) {
  let next = state;
  for (const product of Object.values(state.armamentProducts)) {
    if (!['exportable', 'production'].includes(product.status) || product.backlogMonths >= 30) continue;
    if (product.prospects.some((prospect) => ['prospecting', 'negotiating', 'approval_required'].includes(prospect.status))) continue;
    const shortlist = rankArmamentProspectBuyers(state, product).slice(0, 8);
    if (!shortlist.length) continue;
    const buyerId = pickSeeded(shortlist, state.seed, `${product.id}:${state.currentDate}:${product.prospects.length}`).countryId;
    const relation = relationBetween(state, product.countryId, buyerId)?.relation ?? 48;
    const buyer = state.countries[buyerId];
    const regimeSensitivity = /autoritaire|junte|monarchie absolue|parti unique/i.test(buyer.politics.regime) ? 12 : 0;
    const sensitivity = clamp(72 - relation * 0.5 + regimeSensitivity);
    const quantity = Math.max(2, Math.round(product.annualCapacity * (0.35 + product.reputation / 140) * (0.55 + buyer.weight / 160)));
    const prospect = {
      id: `${product.id}-${buyerId}-${state.currentDate}`,
      countryId: buyerId,
      quantity,
      status: sensitivity >= 45 ? 'approval_required' as const : 'negotiating' as const,
      politicalSensitivity: Math.round(sensitivity),
    };
    next = commitWorldAction(next, {
      kind: 'defense', actorId: product.countryId, targetIds: [buyerId], origin: 'local_rule',
      intent: `${product.manufacturer} prospecte un débouché pour ${product.name}`,
      effects: [{
        kind: 'armament_patch', productId: product.id,
        patch: { prospects: [...product.prospects, prospect] },
        reason: 'L’industriel cherche automatiquement des commandes lorsque son carnet se réduit.', visibility: 'player',
      }],
    });
  }
  return next;
}

export function authorizeArmamentProspect(state: WorldState, productId: string, prospectId: string, actorId = state.playerCountryId) {
  const product = state.armamentProducts[productId];
  const prospect = product?.prospects.find((item) => item.id === prospectId);
  if (!product || !prospect) return { ok: false as const, state, error: 'Prospect industriel inconnu.' };
  if (product.countryId !== actorId) return { ok: false as const, state, error: 'Seul le gouvernement du pays producteur peut autoriser cette exportation.' };
  if (!['approval_required', 'negotiating'].includes(prospect.status)) return { ok: false as const, state, error: 'Ce dossier n’est plus ouvert.' };
  const updatedProspects = product.prospects.map((item) => item.id === prospectId ? { ...item, status: 'won' as const } : item);
  const client = product.clients.find((item) => item.countryId === prospect.countryId);
  const updatedClients = client
    ? product.clients.map((item) => item.countryId === prospect.countryId ? { ...item, quantity: item.quantity + prospect.quantity } : item)
    : [...product.clients, { countryId: prospect.countryId, quantity: prospect.quantity, delivered: 0 }];
  const addedBacklog = product.annualCapacity > 0 ? (prospect.quantity / product.annualCapacity) * 12 : 36;
  const next = commitWorldAction(state, {
    kind: 'defense', actorId, targetIds: [prospect.countryId], origin: 'player',
    intent: `Autoriser l’exportation de ${product.name} vers ${prospect.countryId}`,
    effects: [
      { kind: 'armament_patch', productId, patch: { prospects: updatedProspects, clients: updatedClients, backlogMonths: Number((product.backlogMonths + addedBacklog).toFixed(2)), industrialHealth: clamp(product.industrialHealth + 3) }, reason: 'La commande est inscrite au carnet et soutient la filière.' },
      { kind: 'relation_delta', from: product.countryId, to: prospect.countryId, relation: 3, trust: 2, reason: 'Le programme d’armement crée une relation stratégique durable.' },
    ],
  });
  return { ok: true as const, state: next };
}

export function rejectArmamentProspect(state: WorldState, productId: string, prospectId: string, actorId = state.playerCountryId) {
  const product = state.armamentProducts[productId];
  const prospect = product?.prospects.find((item) => item.id === prospectId);
  if (!product || !prospect) return { ok: false as const, state, error: 'Prospect industriel inconnu.' };
  if (product.countryId !== actorId) return { ok: false as const, state, error: 'Seul le gouvernement du pays producteur peut refuser cette exportation.' };
  if (!['approval_required', 'negotiating'].includes(prospect.status)) return { ok: false as const, state, error: 'Ce dossier n’est plus ouvert.' };
  const updatedProspects = product.prospects.map((item) => item.id === prospectId ? { ...item, status: 'lost' as const } : item);
  return {
    ok: true as const,
    state: commitWorldAction(state, {
      kind: 'defense', actorId, targetIds: [prospect.countryId], origin: 'player',
      intent: `Refuser l’exportation de ${product.name} vers ${prospect.countryId}`,
      effects: [
        { kind: 'armament_patch', productId, patch: { prospects: updatedProspects }, reason: 'L’exécutif ferme ce débouché sans modifier le carnet de commandes.' },
        { kind: 'relation_delta', from: product.countryId, to: prospect.countryId, relation: -1, trust: -1, reason: 'Le refus déçoit légèrement l’acheteur potentiel.' },
      ],
    }),
  };
}

export function productEvidenceSummary(product: ArmamentProduct) {
  const maturityLabels: Record<ArmamentProduct['maturity'], string> = {
    concept: 'Concept expérimental', prototype: 'Prototype fonctionnel', qualification: 'Qualification en cours',
    in_service: 'Admis au service', proven: 'Technologie éprouvée', aging: 'Filière vieillissante',
  };
  const experienceLabels: Record<ArmamentProduct['operationalExperience'], string> = {
    never_deployed: 'Jamais déployé', exercise_only: 'Testé en exercice', deployed_no_combat: 'Déployé hors combat',
    combat_deployed: 'Engagé en opération', high_intensity_proven: 'Éprouvé en combat intense', contested_results: 'Résultats contestés',
  };
  return {
    maturity: maturityLabels[product.maturity],
    operationalExperience: experienceLabels[product.operationalExperience],
    feedback: product.fieldFeedback,
    confidence: product.evidenceConfidence,
  };
}
