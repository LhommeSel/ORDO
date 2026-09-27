import type { IndustrialInputRequirements, StrategicSectorId } from './types';

/**
 * Le niveau de maturité 0–100 est conservé pour les calculs historiques déjà
 * présents. Le palier 1–10 est la lecture jouable : il décrit ce que la
 * filière est réellement capable de produire, et non seulement sa santé.
 */
export function technologyTierFor(technology: number) {
  // Le niveau 10 doit rester exceptionnel au démarrage : l'échelle 0–100
  // historique est volontairement compressée pour laisser une marge de
  // progression sur vingt-cinq ans aux pays déjà industrialisés.
  return Math.max(1, Math.min(10, Math.ceil(technology / 11)));
}

const genericTierLabels = [
  'Assemblage et maintenance élémentaires',
  'Production simple sous dépendance extérieure',
  'Maîtrise nationale des procédés courants',
  'Filière industrielle mature',
  'Production avancée et ingénierie autonome',
  'Conception compétitive de nouvelle génération',
  'Production avancée à grande échelle',
  'Frontière technologique et démonstrateurs',
  'Précurseur industriel de la prochaine génération',
  'Frontière mondiale déployée',
] as const;

const nuclearTierLabels = [
  'Recherche et support élémentaires',
  'Exploitation sous assistance extérieure',
  'Exploitation nationale d’un parc limité',
  'Parc de génération II mature',
  'Parc avancé, cycle du combustible et conception de génération III',
  'Génération III en construction et qualification',
  'Génération III maîtrisée en série et à l’export',
  'Démonstrateurs de génération IV',
  'Génération IV préindustrielle et fusion expérimentale avancée',
  'Fusion industrielle ou frontière nucléaire pleinement déployée',
] as const;

/** Libellé jouable ; le nucléaire possède une trajectoire propre sur trente ans. */
export function technologyTierLabelFor(sector: StrategicSectorId, technologyTier: number) {
  const index = Math.max(0, Math.min(9, Math.round(technologyTier) - 1));
  return sector === 'nuclear' ? nuclearTierLabels[index] : genericTierLabels[index];
}

const baselineInputs: Record<StrategicSectorId, IndustrialInputRequirements> = {
  consumer_goods: { industrialMetals: 3, criticalMinerals: 1, advancedComponents: 1 },
  industrial_inputs: { industrialMetals: 8, criticalMinerals: 2, advancedComponents: 1 },
  machinery_mobility: { industrialMetals: 6, criticalMinerals: 3, advancedComponents: 3 },
  advanced_electronics: { industrialMetals: 4, criticalMinerals: 5, advancedComponents: 5 },
  defense: { industrialMetals: 6, criticalMinerals: 3, advancedComponents: 4 },
  semiconductors: { industrialMetals: 3, criticalMinerals: 6, advancedComponents: 6 },
  nuclear: { industrialMetals: 7, criticalMinerals: 4, advancedComponents: 4 },
  fertilizers: { industrialMetals: 3, criticalMinerals: 1, advancedComponents: 1 },
  specialty_steel: { industrialMetals: 9, criticalMinerals: 3, advancedComponents: 2 },
  pharmaceuticals: { industrialMetals: 2, criticalMinerals: 2, advancedComponents: 3 },
  shipbuilding: { industrialMetals: 9, criticalMinerals: 2, advancedComponents: 3 },
  telecoms: { industrialMetals: 3, criticalMinerals: 4, advancedComponents: 5 },
  machine_tools: { industrialMetals: 7, criticalMinerals: 3, advancedComponents: 4 },
  strategic_agriculture: { industrialMetals: 4, criticalMinerals: 1, advancedComponents: 1 },
  maritime_logistics: { industrialMetals: 6, criticalMinerals: 2, advancedComponents: 3 },
};

const clampDemand = (value: number) => Math.max(0, Math.min(10, Math.round(value)));

/**
 * Les besoins sont des intensités, pas encore des tonnes. Une hausse de
 * niveau rend toutefois la contrainte matérielle immédiatement plus forte :
 * les secteurs sophistiqués atteignent vite un besoin élevé en minerais
 * critiques et en composants avancés.
 */
export function industrialInputRequirementsFor(sector: StrategicSectorId, technologyTier: number): IndustrialInputRequirements {
  const base = baselineInputs[sector];
  const additionalTier = Math.max(0, Math.min(9, technologyTier - 1));
  return {
    industrialMetals: clampDemand(base.industrialMetals + additionalTier * 0.38),
    criticalMinerals: clampDemand(base.criticalMinerals + additionalTier * 0.72),
    advancedComponents: clampDemand(base.advancedComponents + additionalTier * 0.66),
  };
}

export const industrialInputLabels: Record<keyof IndustrialInputRequirements, string> = {
  industrialMetals: 'Métaux industriels',
  criticalMinerals: 'Minerais et métaux critiques',
  advancedComponents: 'Composants avancés',
};

export const strategicSectorLabels: Record<StrategicSectorId, string> = {
  consumer_goods: 'Biens de consommation',
  industrial_inputs: 'Intrants industriels',
  machinery_mobility: 'Machines et mobilité',
  advanced_electronics: 'Électronique avancée',
  defense: 'Défense',
  semiconductors: 'Semi-conducteurs',
  nuclear: 'Nucléaire',
  fertilizers: 'Engrais',
  specialty_steel: 'Aciers spéciaux',
  pharmaceuticals: 'Pharmacie',
  shipbuilding: 'Construction navale',
  telecoms: 'Télécommunications',
  machine_tools: 'Machines-outils',
  strategic_agriculture: 'Agriculture stratégique',
  maritime_logistics: 'Logistique maritime',
};
