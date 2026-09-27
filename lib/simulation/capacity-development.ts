import { prepareCommonAction, type CommonActionPreparation, type PreparedCommonAction } from './action-programs';
import type {
  CapacityDevelopmentSpec,
  CapacityDevelopmentTier,
  CapacityDomainId,
  CommonActionCategory,
  CommonActionLever,
  WorldState,
} from './types';

type CapacityProgramDefinition = {
  domain: CapacityDomainId;
  tier: CapacityDevelopmentTier;
  title: string;
  summary: string;
  durationMonths: number;
  capitalCost: number;
  transitionCost: number;
  annualMaintenanceCost: number;
  politicalCost: number;
  capacityGain: number;
  transitionLoad: number;
};

const domainMeta: Record<CapacityDomainId, { label: string; category: CommonActionCategory; lever: CommonActionLever }> = {
  government: { label: 'Coordination gouvernementale', category: 'institutional', lever: 'government_reorganization' },
  administration: { label: 'Administration', category: 'institutional', lever: 'administrative_reform' },
  // Former des diplomates ou moderniser un réseau est un investissement
  // national. Ce n'est pas une démarche auprès d'un pays qui exigerait un
  // interlocuteur bilatéral.
  diplomacy: { label: 'Diplomatie', category: 'institutional', lever: 'administrative_reform' },
  economy: { label: 'Conduite économique', category: 'economic', lever: 'economic_general' },
  // Même logique pour les analystes et outils : le programme renforce les
  // services, sans lancer une mission visant un État déterminé.
  intelligence: { label: 'Renseignement', category: 'institutional', lever: 'administrative_reform' },
  defense: { label: 'Défense', category: 'defense', lever: 'force_readiness' },
};

const definitions: CapacityProgramDefinition[] = [
  { domain: 'government', tier: 'light', title: 'Cellule de coordination et revue des arbitrages', summary: 'Cartographie des arbitrages, calendrier commun et équipe de coordination resserrée.', durationMonths: 2, capitalCost: 4, transitionCost: 1, annualMaintenanceCost: 0.4, politicalCost: 0, capacityGain: 2, transitionLoad: 4 },
  { domain: 'government', tier: 'medium', title: 'Secrétariat interministériel de coordination', summary: 'Méthodes communes, secrétariat permanent et chaîne d’arbitrage documentée.', durationMonths: 5, capitalCost: 12, transitionCost: 4, annualMaintenanceCost: 1.2, politicalCost: 1, capacityGain: 5, transitionLoad: 8 },
  { domain: 'government', tier: 'heavy', title: 'Refonte de la coordination gouvernementale', summary: 'Réorganisation des responsabilités, des cabinets et des systèmes de suivi.', durationMonths: 9, capitalCost: 30, transitionCost: 12, annualMaintenanceCost: 3, politicalCost: 3, capacityGain: 10, transitionLoad: 15 },

  { domain: 'administration', tier: 'light', title: 'Simplification ciblée des services', summary: 'Audit des flux puis mise en œuvre de simplifications dans un périmètre limité.', durationMonths: 2, capitalCost: 4, transitionCost: 1, annualMaintenanceCost: 0.5, politicalCost: 0, capacityGain: 2, transitionLoad: 4 },
  { domain: 'administration', tier: 'medium', title: 'Numérisation et professionnalisation des services', summary: 'Formation, outils partagés et réorganisation de services prioritaires.', durationMonths: 6, capitalCost: 14, transitionCost: 6, annualMaintenanceCost: 1.6, politicalCost: 1.2, capacityGain: 5, transitionLoad: 9 },
  { domain: 'administration', tier: 'heavy', title: 'Transformation administrative nationale', summary: 'Refonte des carrières, systèmes d’information et chaînes de contrôle.', durationMonths: 10, capitalCost: 34, transitionCost: 17, annualMaintenanceCost: 4.2, politicalCost: 3.5, capacityGain: 10, transitionLoad: 17 },

  { domain: 'diplomacy', tier: 'light', title: 'Renforcement ciblé des postes et de l’expertise', summary: 'Formation linguistique, cellules pays et redéploiement d’attachés.', durationMonths: 3, capitalCost: 3, transitionCost: 1, annualMaintenanceCost: 0.5, politicalCost: 0, capacityGain: 2, transitionLoad: 3 },
  { domain: 'diplomacy', tier: 'medium', title: 'Réseau diplomatique spécialisé', summary: 'Postes prioritaires, expertise économique et systèmes de coordination régionale.', durationMonths: 6, capitalCost: 10, transitionCost: 4, annualMaintenanceCost: 1.5, politicalCost: 0.8, capacityGain: 5, transitionLoad: 7 },
  { domain: 'diplomacy', tier: 'heavy', title: 'Expansion et modernisation du réseau extérieur', summary: 'Nouveaux postes, académie diplomatique et systèmes d’information sécurisés.', durationMonths: 10, capitalCost: 24, transitionCost: 10, annualMaintenanceCost: 3.8, politicalCost: 2, capacityGain: 10, transitionLoad: 13 },

  { domain: 'economy', tier: 'light', title: 'Cellule d’analyse économique et d’investissement', summary: 'Prévisions, suivi des filières et appui ciblé à la décision budgétaire.', durationMonths: 3, capitalCost: 5, transitionCost: 2, annualMaintenanceCost: 0.7, politicalCost: 0, capacityGain: 2, transitionLoad: 4 },
  { domain: 'economy', tier: 'medium', title: 'Agence de politique industrielle et d’évaluation', summary: 'Expertise sectorielle, suivi des aides et capacités d’intervention coordonnées.', durationMonths: 7, capitalCost: 16, transitionCost: 7, annualMaintenanceCost: 2.1, politicalCost: 1.4, capacityGain: 5, transitionLoad: 9 },
  { domain: 'economy', tier: 'heavy', title: 'Refonte des instruments économiques de l’État', summary: 'Systèmes fiscaux, financiers et industriels intégrés à l’échelle nationale.', durationMonths: 11, capitalCost: 38, transitionCost: 19, annualMaintenanceCost: 5.2, politicalCost: 3.8, capacityGain: 10, transitionLoad: 18 },

  { domain: 'intelligence', tier: 'light', title: 'Renforcement de l’analyse et des liaisons', summary: 'Méthodes d’analyse, formation et liens opérationnels entre services.', durationMonths: 2, capitalCost: 4, transitionCost: 2, annualMaintenanceCost: 0.7, politicalCost: 0.2, capacityGain: 2, transitionLoad: 3 },
  { domain: 'intelligence', tier: 'medium', title: 'Modernisation technique et recrutement spécialisé', summary: 'Analystes, outils techniques et coordination des services compétents.', durationMonths: 6, capitalCost: 15, transitionCost: 8, annualMaintenanceCost: 2.3, politicalCost: 1.2, capacityGain: 5, transitionLoad: 8 },
  { domain: 'intelligence', tier: 'heavy', title: 'Architecture nationale de renseignement', summary: 'Capteurs, sécurité des données, formation avancée et chaîne interservices.', durationMonths: 10, capitalCost: 36, transitionCost: 20, annualMaintenanceCost: 5.8, politicalCost: 3.2, capacityGain: 10, transitionLoad: 16 },

  { domain: 'defense', tier: 'light', title: 'Remise à niveau de la préparation des forces', summary: 'Entraînement, maintenance ciblée et reconstitution des équipes critiques.', durationMonths: 3, capitalCost: 6, transitionCost: 3, annualMaintenanceCost: 1, politicalCost: 0.3, capacityGain: 2, transitionLoad: 4 },
  { domain: 'defense', tier: 'medium', title: 'Professionnalisation et soutien des forces', summary: 'Recrutement, entraînement, maintenance et chaîne logistique renforcés.', durationMonths: 7, capitalCost: 20, transitionCost: 11, annualMaintenanceCost: 3.1, politicalCost: 1.5, capacityGain: 5, transitionLoad: 10 },
  { domain: 'defense', tier: 'heavy', title: 'Refonte de la disponibilité militaire', summary: 'Effectifs, soutiens, infrastructure et préparation des forces à l’échelle nationale.', durationMonths: 12, capitalCost: 46, transitionCost: 26, annualMaintenanceCost: 7, politicalCost: 4, capacityGain: 10, transitionLoad: 20 },
];

export const capacityProgramTierLabels: Record<CapacityDevelopmentTier, string> = {
  light: 'Léger', medium: 'Moyen', heavy: 'Lourd',
};

export const capacityDomainLabels: Record<CapacityDomainId, string> = Object.fromEntries(
  Object.entries(domainMeta).map(([domain, meta]) => [domain, meta.label]),
) as Record<CapacityDomainId, string>;

const round = (value: number) => Number(value.toFixed(1));

export function capacityDevelopmentPrograms(domain?: CapacityDomainId) {
  return definitions.filter((definition) => !domain || definition.domain === domain);
}

function requirementsFor(definition: CapacityProgramDefinition) {
  const support = definition.tier === 'light' ? 1 : definition.tier === 'medium' ? 3 : 6;
  return definition.domain === 'government'
    ? [{ domain: 'government' as const, commitment: definition.transitionLoad }, { domain: 'administration' as const, commitment: support }]
    : [{ domain: definition.domain, commitment: definition.transitionLoad }, { domain: 'government' as const, commitment: support }];
}

function impact(definition: CapacityProgramDefinition, gain: number) {
  const totalCost = definition.capitalCost + definition.transitionCost;
  return {
    national: [
      `À terme : +${gain} de capacité ${capacityDomainLabels[definition.domain]}.`,
      `Pendant ${definition.durationMonths} mois : ${definition.transitionLoad} moyens de ${capacityDomainLabels[definition.domain]} sont mobilisés pour la transformation.`,
      definition.annualMaintenanceCost > 0 ? `Après réussite : ${definition.annualMaintenanceCost.toFixed(1)} crédits par an d’entretien et de personnels.` : '',
    ].filter(Boolean),
    international: [],
    appliesAt: `Coût de lancement : ${totalCost.toFixed(1)} crédits. Le gain ne s’applique qu’à la résolution.`,
  };
}

/** Produit une carte de programme chiffrée. Une instruction libre ne peut pas
 * l'imiter : seules ces définitions portent un gain de capacité maximum. */
export function prepareCapacityDevelopmentProgram(
  state: WorldState,
  domain: CapacityDomainId,
  tier: CapacityDevelopmentTier,
): CommonActionPreparation {
  const definition = definitions.find((item) => item.domain === domain && item.tier === tier);
  if (!definition) return { ok: false, error: 'Programme de capacité introuvable.' };
  const player = state.countries[state.playerCountryId];
  const remainingGain = Math.max(0, 100 - player.capacities[domain].maximum);
  if (remainingGain === 0) return { ok: false, error: `${capacityDomainLabels[domain]} est déjà au plafond structurel.` };
  const meta = domainMeta[domain];
  const intent = `${definition.title}. ${definition.summary}`;
  const base = prepareCommonAction(state, intent, { source: 'player', category: meta.category });
  if (!base.ok) return base;
  const capacityGain = Math.min(definition.capacityGain, remainingGain);
  const budgetCost = round(definition.capitalCost + definition.transitionCost);
  const spec: CapacityDevelopmentSpec = {
    domain, tier, capacityGain, capitalCost: definition.capitalCost, transitionCost: definition.transitionCost,
    annualMaintenanceCost: definition.annualMaintenanceCost, politicalCost: definition.politicalCost,
  };
  const action: PreparedCommonAction = {
    ...base.action,
    title: `${capacityProgramTierLabels[tier]} · ${definition.title}`,
    intent,
    lever: meta.lever,
    durationMonths: definition.durationMonths,
    budgetCost,
    requiredCapacities: requirementsFor(definition),
    successProbability: Math.max(20, Math.min(92, base.action.successProbability + (tier === 'light' ? 7 : tier === 'heavy' ? -10 : 0))),
    risks: [
      `Coût de lancement : ${definition.capitalCost.toFixed(1)} crédits ; transition et accompagnement : ${definition.transitionCost.toFixed(1)} crédits.`,
      `Moyens temporairement mobilisés : ${requirementsFor(definition).map(({ domain: itemDomain, commitment }) => `${capacityDomainLabels[itemDomain]} ${commitment}`).join(' · ')}.`,
      ...(definition.politicalCost ? [`Coût politique explicite au lancement : −${definition.politicalCost.toFixed(1)} stabilité.`] : []),
      `Entretien après réussite : ${definition.annualMaintenanceCost.toFixed(1)} crédits par an.`,
    ],
    policySignals: [],
    capacityDevelopment: spec,
    successEffects: [],
    partialEffects: [],
    impactPreview: impact(definition, capacityGain),
  };
  return { ok: true, action, warnings: [] };
}

/** Finance un renfort exceptionnel de trois mois. Il élargit la capacité
 * disponible immédiatement puis se retire automatiquement, sans entretien. */
export function prepareEmergencyCapacitySupport(state: WorldState, domain: CapacityDomainId): CommonActionPreparation {
  const player = state.countries[state.playerCountryId];
  const meta = domainMeta[domain];
  const temporaryBoost = Math.max(4, Math.round(player.capacities[domain].maximum * 0.12));
  const budgetCost = round(temporaryBoost * 1.5 + 1);
  const intent = `Injecter des fonds d’urgence pour renforcer temporairement ${capacityDomainLabels[domain]}.`;
  const base = prepareCommonAction(state, intent, { source: 'player', category: meta.category });
  if (!base.ok) return base;
  return {
    ok: true,
    warnings: [],
    action: {
      ...base.action,
      title: `Urgence · renfort temporaire ${capacityDomainLabels[domain]}`,
      intent,
      lever: meta.lever,
      durationMonths: 3,
      budgetCost,
      requiredCapacities: [{ domain: 'government', commitment: 1 }],
      successProbability: 100,
      risks: [
        `Injection immédiate : ${budgetCost.toFixed(1)} crédits.`,
        `Renfort temporaire : +${temporaryBoost} de capacité ${capacityDomainLabels[domain]} pendant 3 mois.`,
        'Le renfort expire automatiquement et ne crée aucun gain structurel ni dépense d’entretien.',
      ],
      policySignals: [],
      emergencyCapacitySupport: { domain, temporaryBoost },
      successEffects: [],
      partialEffects: [],
      impactPreview: {
        national: [`+${temporaryBoost} immédiatement pendant 3 mois sur ${capacityDomainLabels[domain]}.`, 'Le plafond revient à son niveau initial à la résolution.'],
        international: [],
        appliesAt: 'Effet immédiat après confirmation ; aucune capacité structurelle n’est gagnée.',
      },
    },
  };
}
