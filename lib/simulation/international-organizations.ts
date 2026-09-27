import { commitWorldAction } from './ledger';
import type {
  CountryId,
  CountryState,
  ISODate,
  InternationalOrganizationDecisionRule,
  InternationalOrganizationCampaignTier,
  InternationalOrganizationKind,
  InternationalOrganizationMotion,
  InternationalOrganizationMotionEffect,
  InternationalOrganizationState,
  InternationalOrganizationVoteChoice,
  WorldEffect,
  WorldState,
} from './types';

type OrganizationSeed = Omit<InternationalOrganizationState, 'members' | 'playerMember' | 'playerVoteWeight' | 'motions'> & {
  members: CountryId[];
  playerVoteWeight: number;
};

const seed = (
  id: string,
  shortName: string,
  name: string,
  kind: InternationalOrganizationKind,
  headquarters: string,
  foundedYear: number,
  mandate: string,
  decisionRule: InternationalOrganizationDecisionRule,
  members: CountryId[],
  playerVoteWeight: number,
  playerStanding: number,
  cohesion: number,
  legitimacy: number,
  annualContribution: number,
  agenda: InternationalOrganizationState['agenda'],
): OrganizationSeed => ({
  id, shortName, name, kind, headquarters, foundedYear, mandate, decisionRule,
  members, playerVoteWeight, playerStanding, cohesion, legitimacy,
  annualContribution, agenda, updatedAt: '2000-01-01',
});

/** Les grandes enceintes utiles au scénario de départ, avec leur logique propre. */
export const internationalOrganizationSeeds: OrganizationSeed[] = [
  seed('un', 'ONU', 'Organisation des Nations unies', 'universal', 'New York', 1945,
    'Préserver la paix, organiser la coopération et donner une légitimité aux réponses collectives.', 'security_council',
    ['FRA', 'USA', 'GBR', 'RUS', 'CHN', 'DEU', 'ITA', 'JPN', 'IND', 'BRA', 'CAN', 'ZAF'], 4.7, 82, 58, 76, 4.7,
    [{ id: 'un-peacekeeping', title: 'Mandats de maintien de la paix', summary: 'Les membres arbitrent le financement et le renouvellement des opérations en cours.', stage: 'negotiation', openedAt: '2000-01-01', deadline: '2000-03-01' },
      { id: 'un-financing', title: 'Répartition du financement collectif', summary: 'La quote-part et la capacité de paiement influencent la coalition autour des résolutions.', stage: 'agenda', openedAt: '2000-01-01' }]),
  seed('eu', 'UE', 'Union européenne', 'regional', 'Bruxelles', 1993,
    'Organiser le marché commun, préparer la monnaie unique et coordonner les politiques européennes.', 'qualified_majority',
    ['FRA', 'DEU', 'ITA', 'ESP', 'BEL', 'NLD', 'LUX', 'PRT', 'IRL', 'AUT', 'FIN', 'SWE', 'DNK', 'GRC', 'GBR'], 14.4, 78, 63, 72, 15.2,
    [{ id: 'eu-euro', title: 'Préparation du passage à l’euro fiduciaire', summary: 'La coordination monétaire et les adaptations administratives deviennent prioritaires avant 2002.', stage: 'implementation', openedAt: '2000-01-01', deadline: '2002-01-01' },
      { id: 'eu-enlargement', title: 'Élargissement vers l’Europe centrale', summary: 'Les négociations mêlent normes, garanties politiques et coût budgétaire.', stage: 'negotiation', openedAt: '2000-01-01' }]),
  seed('nato', 'OTAN', 'Organisation du traité de l’Atlantique nord', 'defense', 'Bruxelles', 1949,
    'Garantir la défense collective et adapter les consultations militaires après la guerre froide.', 'consensus',
    ['FRA', 'USA', 'GBR', 'DEU', 'ITA', 'ESP', 'BEL', 'NLD', 'LUX', 'PRT', 'CAN', 'TUR', 'GRC', 'NOR', 'DNK', 'ISL', 'POL', 'CZE', 'HUN'], 5.1, 71, 68, 69, 5.1,
    [{ id: 'nato-strategy', title: 'Adaptation de la posture de l’alliance', summary: 'Les alliés discutent de la place de la Russie, des Balkans et des opérations hors zone.', stage: 'negotiation', openedAt: '2000-01-01' }]),
  seed('imf', 'FMI', 'Fonds monétaire international', 'financial', 'Washington', 1944,
    'Surveiller les équilibres macroéconomiques et conditionner une assistance financière aux réformes convenues.', 'weighted_vote',
    ['FRA', 'USA', 'GBR', 'DEU', 'ITA', 'JPN', 'CHN', 'IND', 'BRA', 'RUS', 'CAN', 'MEX', 'ZAF', 'TUR'], 4.9, 67, 54, 62, 4.9,
    [{ id: 'imf-surveillance', title: 'Surveillance des déséquilibres émergents', summary: 'Les équipes du Fonds testent la solidité des politiques budgétaires et des régimes de change.', stage: 'agenda', openedAt: '2000-01-01' }]),
  seed('wto', 'OMC', 'Organisation mondiale du commerce', 'trade', 'Genève', 1995,
    'Fixer les règles du commerce international et arbitrer les différends entre membres.', 'consensus',
    ['FRA', 'USA', 'GBR', 'DEU', 'ITA', 'ESP', 'JPN', 'CHN', 'IND', 'BRA', 'CAN', 'MEX', 'AUS', 'TUR', 'ZAF'], 4.2, 64, 48, 66, 4.2,
    [{ id: 'wto-agriculture', title: 'Négociations agricoles et services', summary: 'Après l’échec de Seattle, les membres cherchent un format de négociation moins conflictuel.', stage: 'negotiation', openedAt: '2000-01-01' }]),
  seed('oau', 'OUA', 'Organisation de l’unité africaine', 'regional', 'Addis-Abeba', 1963,
    'Préserver la souveraineté des États africains, prévenir les conflits et organiser la coopération régionale.', 'consensus',
    ['DZA', 'EGY', 'MAR', 'NGA', 'ZAF', 'SEN', 'CIV', 'ETH', 'KEN', 'TZA', 'ZWE', 'GHA', 'CMR', 'TUN'], 8.6, 46, 42, 51, 8.6,
    [{ id: 'oau-conflicts', title: 'Prévention des conflits régionaux', summary: 'Les médiations africaines cherchent des marges d’action malgré des moyens limités.', stage: 'agenda', openedAt: '2000-01-01' }]),
  seed('asean', 'ASEAN', 'Association des nations de l’Asie du Sud-Est', 'regional', 'Jakarta', 1967,
    'Maintenir une stabilité régionale par la consultation, le commerce et la non-ingérence.', 'consensus',
    ['IDN', 'MYS', 'THA', 'SGP', 'PHL', 'VNM'], 6.1, 39, 61, 58, 6.1,
    [{ id: 'asean-trade', title: 'Intégration commerciale régionale', summary: 'Les membres renforcent les consultations sur les chaînes industrielles et les équilibres avec la Chine.', stage: 'negotiation', openedAt: '2000-01-01' }]),
  seed('opec', 'OPEP', 'Organisation des pays exportateurs de pétrole', 'energy', 'Vienne', 1960,
    'Coordonner les politiques pétrolières des producteurs et défendre un revenu soutenable face aux variations de la demande mondiale.', 'consensus',
    ['DZA', 'IDN', 'IRN', 'IRQ', 'KWT', 'LBY', 'NGA', 'QAT', 'SAU', 'ARE', 'VEN'], 0, 0, 56, 63, 4.1,
    [{ id: 'opec-ceiling', title: 'Plafond de production et discipline des quotas', summary: 'Les producteurs arbitrent le niveau d’offre ; l’Irak reste un cas particulier sous régime de sanctions en 2000.', stage: 'negotiation', openedAt: '2000-01-01', deadline: '2000-03-01' },
      { id: 'opec-demand', title: 'Reprise de la demande asiatique', summary: 'La consommation mondiale repart, mais la cohésion entre producteurs dépend de la répartition des recettes.', stage: 'agenda', openedAt: '2000-01-01' }]),
];

export function createInternationalOrganizations2000(
  countries: Record<CountryId, CountryState>,
  playerCountryId: CountryId,
): Record<string, InternationalOrganizationState> {
  const addMonths = (iso: ISODate, months: number): ISODate => {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10) as ISODate;
  };
  const motionEffects: Record<string, InternationalOrganizationMotionEffect> = {
    un: 'security_legitimacy', eu: 'trade_rules', nato: 'defense_posture', imf: 'financial_discipline',
    wto: 'trade_rules', oau: 'regional_mediation', asean: 'regional_mediation', opec: 'oil_supply',
  };
  return Object.fromEntries(internationalOrganizationSeeds.map((item) => {
    const members = item.members.filter((id) => Boolean(countries[id]));
    const agenda = item.agenda.find((candidate) => candidate.stage !== 'implementation') ?? item.agenda[0];
    const threshold = item.decisionRule === 'consensus' ? 65 : item.decisionRule === 'qualified_majority' ? 55 : item.decisionRule === 'security_council' ? 60 : 50;
    const supportWeight = Math.min(80, Math.max(32, Math.round(item.cohesion - 2 + (item.legitimacy - 50) * 0.12)));
    const motions: InternationalOrganizationMotion[] = agenda ? [{
      id: `${item.id}-${agenda.id}-2000`, organizationId: item.id, title: agenda.title, summary: agenda.summary,
      openedAt: agenda.openedAt, voteAt: agenda.deadline ?? addMonths(agenda.openedAt, 2), stage: 'voting',
      decisionRule: item.decisionRule, threshold, supportWeight, oppositionWeight: 100 - supportWeight,
      playerChoice: 'undecided', effect: motionEffects[item.id] ?? 'regional_mediation',
    }] : [];
    return [item.id, {
      ...item, motions,
      members,
      playerMember: members.includes(playerCountryId),
      playerVoteWeight: members.includes(playerCountryId) ? item.playerVoteWeight : 0,
    } satisfies InternationalOrganizationState];
  }));
}

/** Acquitte le signal de nouveauté du volet sans modifier la situation
 * internationale : une nouvelle mise à jour d'organisation fera réapparaître
 * l'étoile à la frontière mensuelle suivante. */
export function markInternationalOrganizationsViewed(state: WorldState): WorldState {
  if (state.internationalOrganizationsReadAt === state.currentDate) return state;
  return { ...state, internationalOrganizationsReadAt: state.currentDate };
}

export const organizationKindLabels: Record<InternationalOrganizationKind, string> = {
  universal: 'Universelle', regional: 'Régionale', defense: 'Défense', financial: 'Financière', trade: 'Commerce', energy: 'Énergie',
};

export const organizationDecisionRuleLabels: Record<InternationalOrganizationDecisionRule, string> = {
  consensus: 'Consensus', weighted_vote: 'Vote pondéré', qualified_majority: 'Majorité qualifiée', security_council: 'Conseil de sécurité',
};

export const organizationMotionStageLabels: Record<InternationalOrganizationMotion['stage'], string> = {
  campaigning: 'Coalition en formation', voting: 'Vote ouvert', adopted: 'Résolution adoptée', compromised: 'Compromis adopté', rejected: 'Résolution rejetée',
};

export const organizationVoteChoiceLabels: Record<InternationalOrganizationVoteChoice, string> = {
  support: 'Soutien', oppose: 'Opposition', abstain: 'Abstention', undecided: 'Aucune position',
};

export const organizationCampaignTierLabels: Record<InternationalOrganizationCampaignTier, string> = {
  consultation: 'Consultation discrète',
  coalition: 'Coalition de travail',
  summit: 'Sommet politique',
};

export const organizationCampaignTierCosts: Record<InternationalOrganizationCampaignTier, { budgetCost: number; diplomacyCost: number; supportDelta: number }> = {
  consultation: { budgetCost: 1.5, diplomacyCost: 1, supportDelta: 3 },
  coalition: { budgetCost: 3.5, diplomacyCost: 3, supportDelta: 8 },
  summit: { budgetCost: 7.5, diplomacyCost: 6, supportDelta: 16 },
};

export const organizationMotionEffectLabels: Record<InternationalOrganizationMotionEffect, string> = {
  oil_supply: 'offre pétrolière mondiale', security_legitimacy: 'légitimité des réponses de sécurité', trade_rules: 'règles commerciales',
  financial_discipline: 'discipline financière', defense_posture: 'posture de défense collective', regional_mediation: 'médiation régionale',
};

const addMonths = (iso: ISODate, months: number): ISODate => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10) as ISODate;
};

export function castInternationalOrganizationVote(
  state: WorldState,
  organizationId: string,
  motionId: string,
  choice: Exclude<InternationalOrganizationVoteChoice, 'undecided'>,
): { ok: true; state: WorldState } | { ok: false; state: WorldState; error: string } {
  const organization = state.internationalOrganizations?.[organizationId];
  const motion = organization?.motions?.find((candidate) => candidate.id === motionId);
  if (!organization || !motion) return { ok: false, state, error: 'Motion introuvable.' };
  if (!organization.playerMember) return { ok: false, state, error: `La France ne siège pas dans ${organization.shortName}.` };
  if (motion.stage !== 'voting') return { ok: false, state, error: 'Le vote est fermé.' };
  if (motion.playerChoice !== 'undecided') return { ok: false, state, error: 'La position française est déjà enregistrée.' };
  const motions = organization.motions.map((candidate) => candidate.id === motionId ? { ...candidate, playerChoice: choice } : candidate);
  return { ok: true, state: commitWorldAction(state, {
    kind: 'diplomatic', actorId: state.playerCountryId, targetIds: organization.members, origin: 'player', visibility: 'player',
    intent: `Position française · ${organization.shortName} · ${organizationVoteChoiceLabels[choice]}`,
    effects: [{ kind: 'international_organization_patch', organizationId, patch: { motions, updatedAt: state.currentDate }, reason: `La position française est enregistrée dans le vote ${organization.shortName}.`, visibility: 'player' }],
  }) };
}

/** Engage des moyens français dans la coalition avant le vote. Le joueur peut
 * choisir une ligne favorable ou opposée, avec un coût croissant et un effet
 * borné sur le rapport de forces de la motion. */
export function launchInternationalOrganizationCampaign(
  state: WorldState,
  organizationId: string,
  motionId: string,
  tier: InternationalOrganizationCampaignTier,
  stance: Exclude<InternationalOrganizationVoteChoice, 'abstain' | 'undecided'>,
  targetId?: CountryId,
): { ok: true; state: WorldState } | { ok: false; state: WorldState; error: string } {
  const organization = state.internationalOrganizations?.[organizationId];
  const motion = organization?.motions?.find((candidate) => candidate.id === motionId);
  const country = state.countries[state.playerCountryId];
  const costs = organizationCampaignTierCosts[tier];
  if (!organization || !motion || !country) return { ok: false, state, error: 'Motion introuvable.' };
  if (!organization.playerMember) return { ok: false, state, error: `Le pays joueur ne siège pas dans ${organization.shortName}.` };
  if (motion.stage !== 'campaigning' && motion.stage !== 'voting') return { ok: false, state, error: 'La fenêtre de campagne est fermée.' };
  if (motion.playerCampaign) return { ok: false, state, error: 'Une campagne est déjà engagée sur cette motion.' };
  if (targetId && (targetId === state.playerCountryId || !organization.members.includes(targetId))) {
    return { ok: false, state, error: 'Cet État ne peut pas être ciblé dans cette organisation.' };
  }
  const diplomacyCapacity = country.capacities.diplomacy;
  const availableDiplomacy = diplomacyCapacity.maximum - diplomacyCapacity.committed;
  if (country.fiscal.discretionaryMargin < costs.budgetCost) {
    return { ok: false, state, error: `Budget discrétionnaire insuffisant : ${costs.budgetCost.toFixed(1)} crédits requis.` };
  }
  if (availableDiplomacy < costs.diplomacyCost) {
    return { ok: false, state, error: `Capacité diplomatique insuffisante : ${costs.diplomacyCost} points disponibles requis.` };
  }
  const relation = targetId
    ? state.relations[`${state.playerCountryId}:${targetId}`] ?? state.relations[`${targetId}:${state.playerCountryId}`]
    : undefined;
  const relationScore = relation ? relation.relation * 0.6 + relation.trust * 0.4 : 50;
  const relationModifier = targetId ? Math.round(Math.max(-6, Math.min(6, (relationScore - 50) * 0.12))) : 0;
  const effectiveSupportDelta = Math.max(1, costs.supportDelta + relationModifier);
  const motions = organization.motions.map((candidate) => candidate.id === motionId
    ? {
      ...candidate,
      playerCampaign: { tier, stance, targetId, supportDelta: effectiveSupportDelta, budgetCost: costs.budgetCost, diplomacyCost: costs.diplomacyCost, startedAt: state.currentDate },
    }
    : candidate);
  const countryName = country.name;
  return {
    ok: true,
    state: commitWorldAction(state, {
      kind: 'diplomatic', actorId: state.playerCountryId, targetIds: organization.members, origin: 'player', visibility: 'player',
      intent: `${organizationCampaignTierLabels[tier]} · ${organization.shortName} · ${stance === 'support' ? 'soutenir' : 'bloquer'} la motion${targetId ? ` · cible ${targetId}` : ''}`,
      effects: [
        { kind: 'fiscal_delta', countryId: state.playerCountryId, bucket: 'discretionary', delta: -costs.budgetCost, reason: `Financer la ${organizationCampaignTierLabels[tier].toLocaleLowerCase('fr')} dans ${organization.shortName}.`, visibility: 'player' },
        { kind: 'capacity_commitment', countryId: state.playerCountryId, domain: 'diplomacy', delta: costs.diplomacyCost, reason: `Mobiliser la capacité diplomatique pour ${organization.shortName}.`, visibility: 'player' },
        ...(targetId ? [{ kind: 'relation_delta' as const, from: state.playerCountryId, to: targetId, relation: stance === 'support' ? 1 : -1, trust: stance === 'support' ? 1 : -1, reason: `Contact de coalition avec ${targetId} sur la motion ${organization.shortName}.`, visibility: 'player' as const }] : []),
        { kind: 'international_organization_patch', organizationId, patch: { motions, updatedAt: state.currentDate }, reason: `${countryName} engage une campagne ${stance === 'support' ? 'favorable' : 'opposée'} dans ${organization.shortName}.`, visibility: 'player' },
      ],
    }),
  };
}

function resolutionDossier(state: WorldState, organization: InternationalOrganizationState, motion: InternationalOrganizationMotion, outcome: 'adopted' | 'compromised' | 'rejected') {
  const id = `international-${organization.id}-${motion.id}`;
  const summary = outcome === 'adopted'
    ? `Les membres de ${organization.shortName} ont adopté une décision sur ${organizationMotionEffectLabels[motion.effect]}. La France doit suivre sa mise en œuvre dans le volet Organisations ; aucune négociation bilatérale n’est ouverte automatiquement.`
    : outcome === 'compromised'
      ? `Les membres de ${organization.shortName} ont trouvé un compromis limité sur ${organizationMotionEffectLabels[motion.effect]}. La mesure est appliquée avec une portée réduite ; la France peut encore prendre position dans l’organisation.`
      : `Le vote de ${organization.shortName} n’a pas réuni de majorité sur ${organizationMotionEffectLabels[motion.effect]}. Aucun engagement français n’est créé et la question reste ouverte.`;
  const entry = { id: `${id}-${state.currentDate}`, date: state.currentDate, title: outcome === 'adopted' ? 'Résolution adoptée' : outcome === 'compromised' ? 'Compromis adopté' : 'Résolution rejetée', summary, importance: outcome === 'rejected' ? 'minor' as const : 'moderate' as const, actorIds: [state.playerCountryId, ...organization.members], requiresDecision: false, visibility: 'player' as const };
  const existing = state.strategicDossiers[id];
  if (existing) return { kind: 'dossier_entry_add' as const, dossierId: id, entry, reason: 'Le résultat du vote actualise le dossier multilatéral.', visibility: 'player' as const };
  const dossierKind = motion.effect === 'trade_rules' || motion.effect === 'financial_discipline' || motion.effect === 'oil_supply' ? 'economic' as const : 'security' as const;
  return { kind: 'dossier_add' as const, dossier: { id, title: `${organization.shortName} · ${motion.title}`, kind: dossierKind, status: outcome === 'rejected' ? 'deescalating' as const : 'active' as const, importance: outcome === 'rejected' ? 'minor' as const : 'moderate' as const, scope: 'world' as const, actorIds: [state.playerCountryId, ...organization.members], regionTags: [organization.shortName], startedAt: state.currentDate, updatedAt: state.currentDate, phase: outcome === 'adopted' ? 'Résolution · mise en œuvre' : outcome === 'compromised' ? 'Compromis · mise en œuvre limitée' : 'Vote sans majorité', trend: outcome === 'rejected' ? 'deescalating' as const : 'stable' as const, publicSummary: summary, followed: false, autoTracked: true, commitments: [], pendingDecisions: [], relatedCurrentIds: [], relatedActionIds: [], entries: [entry] }, reason: 'Le résultat du vote ouvre un dossier multilatéral consultable.', visibility: 'player' as const };
}

/** Résout les votes échus, crée un dossier lisible et applique un effet mondial borné. */
export function advanceInternationalOrganizations(state: WorldState): WorldState {
  if (!state.internationalOrganizations) return state;
  let next = state;
  for (const organization of Object.values(next.internationalOrganizations ?? {})) {
    const organizationMotions = organization.motions ?? [];
    for (const motion of organizationMotions) {
      if (motion.stage !== 'voting' || motion.voteAt > next.currentDate) continue;
      const voteBonus = motion.playerChoice === 'support' ? organization.playerVoteWeight : motion.playerChoice === 'oppose' ? -organization.playerVoteWeight : 0;
      const campaignBonus = motion.playerCampaign
        ? (motion.playerCampaign.stance === 'support' ? motion.playerCampaign.supportDelta : -motion.playerCampaign.supportDelta)
        : 0;
      // Les enceintes extérieures continuent d'agir sans input français :
      // l'OPEP bénéficie d'une prime de discipline des producteurs, tandis
      // que les autres organisations restent dépendantes de leur cohésion.
      const autonomousBonus = !organization.playerMember
        ? motion.effect === 'oil_supply' ? 10 : organization.cohesion >= 60 ? 4 : 0
        : 0;
      const support = motion.supportWeight + voteBonus + campaignBonus + autonomousBonus;
      const outcome: 'adopted' | 'compromised' | 'rejected' = support >= motion.threshold
        ? 'adopted'
        : support >= motion.threshold - 8
          ? 'compromised'
          : 'rejected';
      const adopted = outcome !== 'rejected';
      const resolved: InternationalOrganizationMotion = { ...motion, stage: outcome, resolvedAt: next.currentDate, resultSummary: outcome === 'adopted'
        ? `Majorité atteinte (${support.toFixed(1)} contre seuil ${motion.threshold}).`
        : outcome === 'compromised'
          ? `Compromis trouvé (${support.toFixed(1)} ; seuil plein ${motion.threshold}).`
          : `Majorité non atteinte (${support.toFixed(1)} contre seuil ${motion.threshold}).` };
      const motions = organizationMotions.map((candidate) => candidate.id === motion.id ? resolved : candidate);
      const nextAgenda = organization.agenda.find((item) => item.stage !== 'implementation' && !motions.some((candidate) => candidate.id.startsWith(`${organization.id}-${item.id}-`))) ?? organization.agenda.find((item) => item.stage !== 'implementation');
      if (nextAgenda) {
        const threshold = organization.decisionRule === 'consensus' ? 65 : organization.decisionRule === 'qualified_majority' ? 55 : organization.decisionRule === 'security_council' ? 60 : 50;
        const supportWeight = Math.min(80, Math.max(32, Math.round(organization.cohesion - 2 + (organization.legitimacy - 50) * 0.12)));
        motions.push({ id: `${organization.id}-${nextAgenda.id}-${next.currentDate.replaceAll('-', '')}`, organizationId: organization.id, title: nextAgenda.title, summary: nextAgenda.summary, openedAt: next.currentDate, voteAt: addMonths(next.currentDate, 6), stage: 'voting', decisionRule: organization.decisionRule, threshold, supportWeight, oppositionWeight: 100 - supportWeight, playerChoice: 'undecided', effect: motion.effect });
      }
      const effects: WorldEffect[] = [
        { kind: 'international_organization_patch' as const, organizationId: organization.id, patch: { motions, cohesion: Math.max(0, Math.min(100, organization.cohesion + (adopted ? 1 : -2))), updatedAt: next.currentDate }, reason: `Le vote ${organization.shortName} est résolu.`, visibility: 'player' as const },
        resolutionDossier(next, organization, motion, outcome),
      ];
      if (motion.playerCampaign) {
        effects.push({ kind: 'capacity_commitment', countryId: next.playerCountryId, domain: 'diplomacy', delta: -motion.playerCampaign.diplomacyCost, reason: `La campagne dans ${organization.shortName} est clôturée et libère la capacité diplomatique mobilisée.`, visibility: 'player' as const });
      }
      if (adopted && motion.effect === 'oil_supply') {
        const oil = next.worldEconomy.oilMarket;
        const supplyDelta = motion.playerChoice === 'oppose' ? 1.5 : -1.5;
        const effectScale = outcome === 'compromised' ? 0.5 : 1;
        effects.push({ kind: 'world_economy_patch' as const, patch: { oilMarket: { ...oil, supplyIndex: Math.max(0, Math.min(200, oil.supplyIndex + supplyDelta * effectScale)), benchmarkUsdPerBarrel: Math.max(5, oil.benchmarkUsdPerBarrel - supplyDelta * effectScale * 0.7), monthlyChangePct: Number((oil.monthlyChangePct - supplyDelta * effectScale * 0.25).toFixed(2)), lastUpdatedAt: next.currentDate } }, reason: outcome === 'compromised' ? 'Le compromis OPEP modifie partiellement l’équilibre mondial de l’offre pétrolière.' : 'La discipline OPEP modifie l’équilibre mondial de l’offre pétrolière.', visibility: 'player' as const });
      }
      if (adopted && motion.effect !== 'oil_supply') {
        const metric = motion.effect === 'trade_rules' ? 'industry' : motion.effect === 'defense_posture' ? 'security' : motion.effect === 'security_legitimacy' ? 'stability' : 'stability';
        const effectScale = outcome === 'compromised' ? 0.5 : 1;
        const delta = (motion.effect === 'trade_rules' ? 0.45 : motion.effect === 'defense_posture' ? 0.6 : 0.3) * effectScale;
        effects.push({ kind: 'metric_delta', countryId: next.playerCountryId, metric, delta, reason: `La résolution ${organization.shortName} améliore légèrement la ${metric} du pays joueur.`, visibility: 'player' as const });
        if (motion.effect === 'trade_rules') {
          effects.push({ kind: 'world_economy_patch', patch: { tradeVolumeIndex: Number((next.worldEconomy.tradeVolumeIndex + 1.2 * effectScale).toFixed(2)), lastUpdatedAt: next.currentDate }, reason: 'Une règle commerciale commune fluidifie marginalement les échanges mondiaux.', visibility: 'player' as const });
        } else if (motion.effect === 'financial_discipline') {
          effects.push({ kind: 'world_economy_patch', patch: { financialStress: Math.max(0, next.worldEconomy.financialStress - 1.2 * effectScale), lastUpdatedAt: next.currentDate }, reason: 'La surveillance financière réduit marginalement le stress mondial.', visibility: 'player' as const });
        }
      }
      if (adopted && organization.playerMember) {
        const partner = organization.members.find((member) => member !== next.playerCountryId);
        if (partner && (motion.playerChoice === 'support' || motion.playerChoice === 'oppose')) {
          const delta = motion.playerChoice === 'oppose' ? -1 : 1;
          effects.push({ kind: 'relation_delta', from: next.playerCountryId, to: partner, relation: delta, trust: delta, reason: `La position française sur la résolution ${organization.shortName} influe sur la coalition avec ${partner}.`, visibility: 'player' as const });
        }
      }
      next = commitWorldAction(next, { kind: motion.effect === 'oil_supply' ? 'energy' : 'diplomatic', actorId: next.playerCountryId, targetIds: organization.members, origin: 'time', visibility: 'player', intent: `Résolution multilatérale · ${organization.shortName}`, effects });
    }
  }
  return next;
}
