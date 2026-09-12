import { nodeAvailableExport } from './energy';
import { relationBetween } from './ledger';
import { countryMentionedInText } from './country-sheet';
import type { CountryId, EnergyResource, WorldState } from './types';

export type PlayerIntent = {
  kind: 'energy_contract' | 'general_advice';
  resource?: EnergyResource;
  targetId?: CountryId;
  targetLabel?: string;
  targetStatus: 'modeled' | 'unmodeled' | 'unspecified';
  confidence: number;
  warnings: string[];
};

export type EnergySupplierCandidate = {
  countryId: CountryId;
  nodeId: string;
  available: number;
  score: number;
  reasons: string[];
};

const normalize = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function requestedTargetLabel(text: string) {
  const match = text.match(/(?:avec|auprès de|aupres de|provenant de|acheter à|acheter a)\s+(?:(?:l['’]|le |la |les |du |de la |des )?)([\p{L}][\p{L}\s'’-]{1,45}?)(?=\s+(?:afin|pour|de long terme|à long terme|a long terme|sur|sans)\b|[,.!?;]|$)/iu);
  const label = match?.[1]?.trim();
  if (!label || /^(?:un|une|des|nouveau|fournisseur|partenaire)/i.test(label)) return undefined;
  return label.replace(/\s+/g, ' ');
}

export function interpretPlayerIntent(state: WorldState, text: string): PlayerIntent {
  const normalized = normalize(text);
  const resource: EnergyResource | undefined = /\b(gaz|gazi\w*|gnl)\b/.test(normalized)
    ? 'gas'
    : /\b(petrol\w*|brent|baril)\b/.test(normalized) ? 'oil' : undefined;
  const energyLanguage = Boolean(resource) || /\b(energie|energetique|approvisionnement)\b/.test(normalized);
  // « sécurisation des approvisionnements » est une formulation courante du
  // joueur pour demander un contrat sans employer le mot contrat. On garde
  // une racine ciblée (securis*) pour ne pas transformer une simple question
  // sur les importations en négociation énergétique.
  const contractLanguage = /\b(contrat|accord|negoci\w*|acheter|importer|securis\w*|fournisseur)\b/.test(normalized);
  const kind = energyLanguage && contractLanguage ? 'energy_contract' : 'general_advice';
  const modeledId = countryMentionedInText(state, text);
  const modeled = modeledId ? state.countries[modeledId] : undefined;
  const rawTarget = modeled ? modeled.name : requestedTargetLabel(text);
  const warnings: string[] = [];
  if (kind === 'energy_contract' && !resource) warnings.push('La ressource énergétique n’est pas assez précise : gaz ou pétrole doit être indiqué.');
  if (!modeled && rawTarget) warnings.push(`${rawTarget} n’existe pas encore dans la base mondiale du prototype ; le moteur refuse d’inventer ses capacités.`);
  return {
    kind, resource,
    targetId: modeled?.id,
    targetLabel: rawTarget,
    targetStatus: modeled ? 'modeled' : rawTarget ? 'unmodeled' : 'unspecified',
    confidence: kind === 'energy_contract' && resource ? (modeled || !rawTarget ? 96 : 78) : 65,
    warnings,
  };
}

export function rankEnergySuppliers(state: WorldState, resource: EnergyResource): EnergySupplierCandidate[] {
  const bestByCountry = new Map<CountryId, EnergySupplierCandidate>();
  for (const node of Object.values(state.energyNodes)) {
    if (node.resource !== resource || node.countryId === state.playerCountryId) continue;
    const available = nodeAvailableExport(state, node.id);
    if (available <= 0) continue;
    const country = state.countries[node.countryId];
    if (!country) continue;
    const relation = relationBetween(state, state.playerCountryId, node.countryId);
    const routeKnown = node.infrastructure.length > 0;
    const score = Number((
      Math.min(45, available * 0.45)
      + country.statisticalReliability * 0.25
      + (relation?.relation ?? 50) * 0.2
      + (routeKnown ? 10 : 2)
    ).toFixed(1));
    const candidate = {
      countryId: node.countryId, nodeId: node.id, available, score,
      reasons: [
        `${available.toFixed(1)} unités/an encore exportables`,
        routeKnown ? `acheminement identifié : ${node.infrastructure[0]}` : 'acheminement à négocier',
        `marge exportable physique : ${Math.min(100, available / Math.max(1, nodeAvailableExport(state, node.id)) * 100).toFixed(0)} % de la capacité libre du nœud`,
      ],
    };
    const current = bestByCountry.get(node.countryId);
    if (!current || candidate.score > current.score) bestByCountry.set(node.countryId, candidate);
  }
  return [...bestByCountry.values()].sort((a, b) => b.score - a.score || b.available - a.available);
}
