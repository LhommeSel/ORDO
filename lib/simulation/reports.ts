import type {
  ActionProgram,
  GovernmentReport,
  GovernmentReportKind,
  GovernmentReportStatus,
  ISODate,
  WorldState,
} from './types';
import { retirementProjectionFor } from './retirement-projection';
import { operationalFindingForReport } from './territorial-projects';
import { securityActorsForCountry } from './country-sheet';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .replace(/[’']/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const labels: Record<GovernmentReportKind, string> = {
  audit: 'Rapport d’audit',
  prospection: 'Rapport de prospection',
  expertise: 'Rapport d’expertise',
  renseignement: 'Note de renseignement',
};

const projectScaleLabel = (scale: 'pilot' | 'regional' | 'industrial') => ({
  pilot: 'pilote', regional: 'régional', industrial: 'industriel',
})[scale];

const resourceWithArticle = (resource: string) => resource === 'or' ? 'd’or' : `de ${resource}`;

const operationalConstraintLabel: Record<string, string> = {
  logistics: 'desserte et logistique',
  environment: 'protection environnementale',
  security: 'sécurisation et traçabilité',
  social_license: 'acceptation locale',
  finance: 'maîtrise du coût',
};

const capacityLabel: Record<string, string> = {
  government: 'pilotage gouvernemental',
  administration: 'administration',
  diplomacy: 'diplomatie',
  economy: 'économie',
  intelligence: 'renseignement',
  defense: 'défense',
};

function subjectForProgram(program: Pick<ActionProgram, 'title' | 'intent'>) {
  const raw = program.intent.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const withoutVerb = raw.replace(/^(demander|réaliser|realiser|mener|lancer|préparer|preparer|constituer|produire|effectuer|auditer|prospecter|étudier|etudier|évaluer|evaluer|audit|expertise|prospection|étude|etude|rapport|renseignement)\s+(de\s+|sur\s+|des\s+|du\s+|d['’]\s*)?/i, '');
  const subject = withoutVerb.replace(/^(un|une|le|la|les|des)\s+/i, '').trim();
  return (subject || program.title).slice(0, 180);
}

/** Identifie les actions de connaissance qui doivent laisser un rapport. */
export function reportKindForProgram(program: Pick<ActionProgram, 'category' | 'lever' | 'intent' | 'portOperation'>): GovernmentReportKind | undefined {
  const value = normalize(program.intent);
  if (program.portOperation === 'audit' || /\baudit\b/.test(value)) return 'audit';
  if (program.lever === 'resource_prospection' || /\b(prospect\w*|debouche\w*|marche cible|client potentiel|export\w*|gisement\w*|minerai\w*|ressourc\w* minier\w*|orpaillage|inventaire geologique|potentiel geologique)\b/.test(value)) return 'prospection';
  if (program.category === 'intelligence' || /\b(renseignement|surveillance|ecoute|infiltration|reconnaissance)\b/.test(value)) return 'renseignement';
  if (/\b(etude|expertise|diagnostic|evaluation|rapport|prospective|projection|scenario|commission)\b/.test(value)) return 'expertise';
  if (program.lever === 'policy_audit') return 'audit';
  return undefined;
}

export function commissionedReportForProgram(program: Pick<ActionProgram, 'id' | 'category' | 'lever' | 'intent' | 'portOperation' | 'actorId' | 'targetIds' | 'startedAt' | 'expectedCompletionAt' | 'linkedDossierId' | 'title'>): GovernmentReport | undefined {
  const kind = reportKindForProgram(program);
  if (!kind) return undefined;
  const subject = subjectForProgram(program);
  return {
    id: `report-${program.id}`,
    kind,
    title: `${labels[kind]} · ${subject}`,
    subject,
    actorId: program.actorId,
    targetIds: [...program.targetIds],
    programId: program.id,
    ...(program.linkedDossierId ? { linkedDossierId: program.linkedDossierId } : {}),
    commissionedAt: program.startedAt,
    dueAt: program.expectedCompletionAt,
    status: 'commissioned',
    executiveSummary: `Demande enregistrée. Le ${labels[kind].toLocaleLowerCase('fr')} sera constitué à l’échéance du programme.`,
    findings: [],
    recommendations: [],
  };
}

function reportStatusForProgram(status: ActionProgram['status']): GovernmentReportStatus {
  if (status === 'succeeded') return 'delivered';
  if (status === 'cancelled') return 'cancelled';
  return 'incomplete';
}

/** Finalise le rapport même si l’action n’aboutit que partiellement. */
export function finalizeReportForProgram(
  report: GovernmentReport,
  program: Pick<ActionProgram, 'status' | 'intent' | 'title' | 'budgetCost' | 'requiredCapacities' | 'resolution'>,
  deliveredAt: ISODate,
  state?: WorldState,
): GovernmentReport {
  const status = reportStatusForProgram(program.status);
  const capacitySummary = program.requiredCapacities.length
    ? program.requiredCapacities.map(({ domain, commitment }) => `${capacityLabel[domain] ?? domain} ${commitment}`).join(' · ')
    : 'aucun moyen spécialisé';
  const examinedScope = program.intent.trim().replace(/[.!?]+$/, '');
  const resolution = program.resolution ?? (status === 'cancelled' ? 'La demande a été interrompue avant sa remise.' : 'Le programme a produit des éléments partiels.');
  const isDelivered = status === 'delivered';
  const retirementAudit = /retrait\w*|pension\w*|vieillesse|assurance vieillesse|protection sociale|securite sociale|capitalisation|repartition/i.test(`${report.subject} ${program.intent} ${program.title}`);
  const operationalFinding = state
    ? operationalFindingForReport(state, report, `${program.intent} ${program.title}`, isDelivered)
    : undefined;
  const projection = retirementAudit && state ? retirementProjectionFor(state, report.actorId, 2025) : undefined;
  const retirementFindings = projection && isDelivered ? [
    `Base 2000 : les dépenses de retraite sont estimées à ${projection.baselineSharePctGdp.toFixed(1)} % du PIB, soit environ ${projection.baselineAnnualBillion2000Usd.toFixed(1)} Md$ constants 2000 par an.`,
    `Projection 2025 : ${projection.horizonSharePctGdp.toFixed(1)} % du PIB, soit environ ${projection.horizonAnnualBillion2000Usd.toFixed(1)} Md$ constants 2000 par an.`,
    `Écart annuel à l’horizon 2025 : +${projection.annualIncreaseBillion2000Usd.toFixed(1)} Md$ constants 2000 par rapport à 2000, avant toute réforme.`,
    `Hypothèses : pression démographique +${projection.demographicIncreasePoints.toFixed(1)} points de PIB et croissance réelle tendancielle de ${projection.realGrowthAssumptionPct.toFixed(2)} % par an ; le financement et les économies d’une réforme restent à décider.`,
  ] : [];
  const securityActors = operationalFinding && state
    ? securityActorsForCountry(state, report.actorId).filter((actor) => operationalFinding.stakeholderIds?.includes(actor.id))
    : [];
  const resourceDeposit = operationalFinding?.depositId && state?.resources
    ? state.resources.deposits[operationalFinding.depositId]
    : undefined;
  const resourceBasin = resourceDeposit && state?.resources ? state.resources.basins[resourceDeposit.basinId] : undefined;
  const projectFindings = operationalFinding && isDelivered ? [
    `La prospection confirme un potentiel ${resourceWithArticle(operationalFinding.resource)} suffisant pour instruire un projet ${projectScaleLabel(operationalFinding.recommendedScale)} en ${operationalFinding.territoryName} ; elle ne certifie pas encore une production industrielle définitive.`,
    `Contraintes à reprendre dans le projet : ${operationalFinding.constraints.length ? operationalFinding.constraints.map((constraint) => operationalConstraintLabel[constraint] ?? constraint).join(', ') : 'aucune contrainte majeure identifiée au stade de la prospection'}.`,
    ...(resourceDeposit ? [`Gisement documenté : ${resourceDeposit.id}, stock identifié ${resourceDeposit.identifiedStock.toFixed(0)} unités, stock probable ${resourceDeposit.probableStock.toFixed(0)} ; statut juridique ${resourceDeposit.legalStatus}.`] : []),
    ...(resourceBasin && resourceBasin.countryIds.length > 1 ? [`Bassin ${resourceBasin.name} : continuité transfrontalière avec ${resourceBasin.countryIds.join(', ')} ; les droits d’accès et les revendications devront être traités séparément du projet local.`] : []),
    ...(operationalFinding.claimantEntityIds?.length ? [`Entités revendicatrices à consulter : ${operationalFinding.claimantEntityIds.join(', ')}.`] : []),
    ...(securityActors.length ? [`Acteurs de sécurité documentés : ${securityActors.map((actor) => `${actor.name} (${actor.activity})`).join(' · ')}.`] : []),
    'Le rapport autorise la préparation d’un projet borné ; coût, délai, production et acceptation dépendront de son exécution territoriale.',
  ] : [];
  return {
    ...report,
    status,
    deliveredAt,
    confidence: isDelivered ? 'high' : status === 'incomplete' ? 'low' : undefined,
    executiveSummary: isDelivered
      ? projection
        ? `${report.title} est remis. Il chiffre la trajectoire des retraites jusqu’en 2025 : environ ${projection.horizonSharePctGdp.toFixed(1)} % du PIB, soit ${projection.horizonAnnualBillion2000Usd.toFixed(1)} Md$ constants 2000 par an. Il n’engage aucune réforme automatiquement.`
        : operationalFinding
          ? `${report.title} est remis. Il confirme un potentiel exploitable pour un projet ${projectScaleLabel(operationalFinding.recommendedScale)} ${resourceWithArticle(operationalFinding.resource)} en ${operationalFinding.territoryName}, sous conditions. Il n’ouvre aucun site automatiquement.`
        : `${report.title} est remis. Il éclaire une décision ultérieure et n’engage aucune réforme automatiquement.`
      : status === 'cancelled'
        ? `${report.title} n’a pas été remis : la demande a été interrompue.`
        : `${report.title} est remis sous forme incomplète ; il peut servir de base, mais ses constats doivent être complétés.`,
    findings: [
      `Périmètre examiné : ${examinedScope}.`,
      `Moyens engagés : ${program.budgetCost.toFixed(1)} crédits · ${capacitySummary}.`,
      `Issue du programme : ${resolution}`,
      ...retirementFindings,
      ...projectFindings,
    ],
    recommendations: isDelivered
      ? projection
        ? ['Utiliser ces montants comme base argumentative avant de choisir une réforme ; l’audit ne crée ni économie, ni recette, ni capacité supplémentaire.']
        : operationalFinding
          ? [`Préparer un projet ${projectScaleLabel(operationalFinding.recommendedScale)} ${resourceWithArticle(operationalFinding.resource)} en ${operationalFinding.territoryName}, avec des réponses explicites aux contraintes recensées et un jalon avant extension.`]
          : ['Conserver ce rapport comme base argumentative avant toute réforme ou décision opérationnelle.']
      : status === 'cancelled'
        ? ['Relancer une demande distincte si une base documentée reste nécessaire.']
      : ['Compléter les constats avant de fonder une réforme générale sur ce rapport.'],
    ...(operationalFinding ? { operationalFinding } : {}),
  };
}
