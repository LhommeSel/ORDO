import { energyBalance, nodeAvailableExport, activateEnergyContract, proposeEnergyContract } from './energy';
import { commitWorldAction, relationBetween } from './ledger';
import type { CountryId, EnergyResource, ISODate, WorldState } from './types';

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
  pricePosture: 'market' | 'buyer_favorable';
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
  let score = 55 + ((relation?.relation ?? 50) - 50) * 0.22 + ((relation?.trust ?? 45) - 45) * 0.12;
  if (offer.durationYears >= 10) score += 8;
  if (offer.durationYears <= 5) score -= 9;
  if (offer.pricePosture === 'buyer_favorable') score -= 11;
  if (offer.politicalClauses.length) score -= 3;
  score -= volumePressure * 34;

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
  const next = commitWorldAction(state, {
    kind: 'diplomatic', actorId: offer.buyerId, targetIds: [offer.supplierId], origin: 'player',
    intent: `Transmettre une proposition de contrat ${offer.resource === 'gas' ? 'gazier' : 'pétrolier'} à ${supplier.name}`,
    effects: [], assumptions: [`Offre administrative, révision ${offer.revision}.`],
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
  return { ok: true as const, state: activated.state, contractId };
}
