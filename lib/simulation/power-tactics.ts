import type {
  PowerStruggleAIPlan,
  MacroeconomicState,
  StakeholderCategory,
  WorldEffect,
  WorldState,
} from './types';

type TacticContext = {
  countryId: string;
  actorIds: string[];
  reactionId: string;
  dossierId: string;
  category: StakeholderCategory;
  pressure: number;
  momentum: number;
  actorInfluence: number;
  plan: PowerStruggleAIPlan;
};

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Number(value.toFixed(3));

/**
 * Une tactique choisie par l'IA est exécutée une seule fois lors de l'adoption
 * du plan. Ces effets bornés représentent son impact matériel immédiat ; la
 * tactique suivante demeure une décision de l'IA, jamais du moteur.
 */
export function powerTacticEffects(state: WorldState, context: TacticContext): WorldEffect[] {
  const country = state.countries[context.countryId];
  if (!country) return [];
  const economy = state.macroEconomies[context.countryId];
  const reaction = state.stakeholderReactions[context.reactionId];
  const strength = clamp(
    context.pressure * 0.45 + context.momentum * 0.3 + context.actorInfluence * 0.25,
  ) / 100;
  const effects: WorldEffect[] = [];

  const politics = (approvalDelta = 0, complianceDelta = 0, reason: string) => {
    effects.push({
      kind: 'politics_patch', countryId: context.countryId,
      patch: {
        publicApproval: round(country.politics.publicApproval + approvalDelta * strength),
        administrativeCompliance: round(country.politics.administrativeCompliance + complianceDelta * strength),
      },
      reason, visibility: 'player',
    });
  };
  const metric = (metricId: 'industry' | 'stability' | 'security', delta: number, reason: string) => {
    effects.push({ kind: 'metric_delta', countryId: context.countryId, metric: metricId, delta: round(delta * strength), reason, visibility: 'player' });
  };
  const macro = (patch: Partial<MacroeconomicState>, reason: string) => {
    if (!economy) return;
    effects.push({ kind: 'macro_patch', countryId: context.countryId, patch, reason, visibility: 'player' });
  };
  const exposeActors = () => {
    for (const actorId of context.actorIds) effects.push({
      kind: 'power_actor_patch', actorId,
      patch: { visibility: 'public', updatedAt: state.currentDate },
      reason: 'La tactique choisie expose publiquement son instigateur.', visibility: 'player',
    });
  };

  switch (context.plan.currentTactic) {
    case 'private_lobbying':
      politics(0, -0.45, 'Les consultations concurrentes ralentissent légèrement la coordination gouvernementale.');
      break;
    case 'administrative_obstruction':
      politics(0, -3.2, 'L’obstruction interne réduit l’obéissance et la vitesse d’exécution administrative.');
      metric('stability', -0.45, 'Les frictions institutionnelles deviennent perceptibles dans l’appareil d’État.');
      break;
    case 'public_criticism':
      exposeActors();
      politics(-2.1, -0.25, 'La critique d’une figure institutionnelle crédible érode le soutien au gouvernement.');
      break;
    case 'media_campaign':
      exposeActors();
      politics(-2.8, 0, 'Une campagne médiatique structurée pèse sur l’opinion publique.');
      metric('stability', -0.65, 'La polarisation publique accroît la conflictualité politique.');
      break;
    case 'organized_resignation':
      exposeActors();
      politics(-1.4, -2.4, 'Des départs coordonnés privent l’État d’autorité et d’expérience.');
      if (context.category === 'military') metric('security', -1.2, 'Les démissions affaiblissent temporairement la continuité du commandement.');
      break;
    case 'social_mobilization':
      exposeActors();
      metric('stability', -1.5, 'La mobilisation organisée installe le conflit dans l’espace public.');
      politics(-1.2, -0.4, 'La pression de rue réduit la marge politique et administrative du gouvernement.');
      break;
    case 'strike':
      exposeActors();
      metric('stability', -2.1, 'Le mouvement de grève perturbe durablement l’ordre social.');
      metric('industry', -0.9, 'Les arrêts de travail réduisent temporairement la production effective.');
      if (economy) macro({
        confidenceIndex: round(Math.max(0, economy.confidenceIndex - 1.8 * strength)),
      }, 'La durée incertaine du conflit social dégrade la confiance économique.');
      break;
    case 'investment_freeze':
      if (economy) macro({
        confidenceIndex: round(Math.max(0, economy.confidenceIndex - 2.5 * strength)),
        investmentSharePctGdp: round(Math.max(0, economy.investmentSharePctGdp - 0.55 * strength)),
      }, 'Le report coordonné des projets affecte l’investissement et la confiance.');
      break;
    case 'capital_flight':
      if (economy) macro({
        confidenceIndex: round(Math.max(0, economy.confidenceIndex - 3.4 * strength)),
        foreignReserveMonthsImports: round(Math.max(0, economy.foreignReserveMonthsImports - 0.3 * strength)),
        exchangeRateIndex: round(Math.max(1, economy.exchangeRateIndex - 1.5 * strength)),
      }, 'Les sorties de capitaux touchent les réserves, la monnaie et la confiance financière.');
      break;
    case 'opposition_funding':
      politics(-1.65, 0, 'Des moyens supplémentaires permettent à l’opposition de mieux contester le gouvernement.');
      metric('stability', -0.75, 'La compétition politique s’intensifie sous l’effet des financements organisés.');
      break;
    case 'information_leak':
      exposeActors();
      politics(-1.8, -0.6, 'La divulgation d’informations internes fragilise l’autorité du gouvernement.');
      break;
    case 'security_disobedience':
      exposeActors();
      metric('security', -2.6, 'La désobéissance affaiblit directement la chaîne de commandement.');
      politics(-1.1, -2.1, 'Le refus d’exécuter certaines directives révèle une rupture institutionnelle.');
      break;
    case 'extra_constitutional_preparation':
      metric('stability', -5.2, 'La préparation d’une rupture extraconstitutionnelle déstabilise le régime.');
      metric('security', -3.3, 'La politisation des moyens coercitifs fracture les institutions de sécurité.');
      politics(-3.6, -4.2, 'La crise ouverte réduit simultanément la légitimité et l’obéissance institutionnelle.');
      break;
    case 'negotiation': {
      const dossier = state.strategicDossiers[context.dossierId];
      const decision = `Répondre à la proposition : ${context.plan.immediateObjective}`;
      effects.push({
        kind: 'dossier_patch', dossierId: context.dossierId,
        patch: { pendingDecisions: [...new Set([...(dossier?.pendingDecisions ?? []), decision])] },
        reason: 'La négociation choisie par l’acteur appelle une réponse explicite du joueur.', visibility: 'player',
      });
      break;
    }
    case 'deescalation':
      if (reaction) effects.push({
        kind: 'stakeholder_reaction_patch', reactionId: reaction.id,
        patch: {
          defiance: round(Math.max(0, reaction.defiance - 6 * strength)),
          mobilization: round(Math.max(0, reaction.mobilization - 5 * strength)),
          trend: 'falling', updatedAt: state.currentDate,
        },
        reason: 'La stratégie d’apaisement réduit la mobilisation de la base institutionnelle.', visibility: 'player',
      });
      break;
  }
  return effects;
}
