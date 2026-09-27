import { dossierPressureProfile } from './dossier-effects';
import { assessDossierResolution, dossierDecisionRecords } from './dossiers';
import { dossierScopeFor } from './dossier-scope';
import type {
  DossierPressureSnapshot,
  StrategicDossier,
  WorldState,
} from './types';

export type DossierReadingTone = 'neutral' | 'pressure' | 'support';

export type DossierReadingItem = {
  label: string;
  detail: string;
  tone: DossierReadingTone;
};

/**
 * Lecture courte et factuelle d'un dossier. Elle ne stocke aucune prévision :
 * chaque phrase provient de l'état déjà simulé (ancrage, choc, chronologie,
 * pressions ou décisions en attente).
 */
export type DossierCausalReading = {
  trigger: DossierReadingItem;
  playerRelevance: DossierReadingItem;
  effects: Array<DossierReadingItem & {
    level: number;
    direction: DossierPressureSnapshot['direction'];
  }>;
  nextThreshold: DossierReadingItem;
  watch: DossierReadingItem | null;
};

function visibleEntry(state: WorldState, dossier: StrategicDossier) {
  return dossier.entries.find((entry) => entry.visibility === 'public'
    || entry.visibility === 'player'
    || (entry.visibility === 'secret' && entry.actorIds.includes(state.playerCountryId)));
}

function triggerFor(state: WorldState, dossier: StrategicDossier): DossierReadingItem {
  if (dossier.parentDossierId) {
    const parent = state.strategicDossiers[dossier.parentDossierId];
    return {
      label: 'Déclencheur',
      detail: parent
        ? `Conséquence locale du dossier « ${parent.title} ».`
        : 'Conséquence locale rattachée à un dossier mondial déjà enregistré.',
      tone: 'neutral',
    };
  }
  const shock = dossier.sourceShockId
    ? state.worldEconomy.activeShocks.find((item) => item.id === dossier.sourceShockId)
    : undefined;
  if (shock) return {
    label: 'Déclencheur',
    detail: `Choc ${shock.channel} « ${shock.label} » enregistré à une intensité de ${Math.abs(shock.intensity).toFixed(0)}.`,
    tone: shock.intensity > 0 ? 'pressure' : 'support',
  };
  const anchor = dossier.relatedAnchorId ? state.historicalAnchors[dossier.relatedAnchorId] : undefined;
  if (anchor) return {
    label: 'Déclencheur',
    detail: `Tendance historique : ${anchor.trendSummary}`,
    tone: 'neutral',
  };
  const current = dossier.relatedCurrentIds
    .map((id) => state.historicalCurrents[id])
    .find(Boolean);
  if (current) return {
    label: 'Déclencheur',
    detail: `Mouvement de fond : ${current.name}.`,
    tone: 'neutral',
  };
  const entry = visibleEntry(state, dossier);
  const action = entry?.sourceActionId
    ? state.actions.find((item) => item.id === entry.sourceActionId)
    : undefined;
  if (action) return {
    label: 'Déclencheur',
    detail: `Événement enregistré : ${action.intent}.`,
    tone: 'neutral',
  };
  if (entry) return {
    label: 'Déclencheur',
    detail: `${entry.title} : ${entry.summary}`,
    tone: 'neutral',
  };
  return {
    label: 'Déclencheur',
    detail: `Le dossier est suivi depuis le ${dossier.startedAt}.`,
    tone: 'neutral',
  };
}

function playerRelevanceFor(state: WorldState, dossier: StrategicDossier): DossierReadingItem {
  const player = state.countries[state.playerCountryId];
  const direct = dossier.actorIds.includes(state.playerCountryId);
  const scope = dossierScopeFor(state, dossier);
  if (scope === 'national') return {
    label: 'Exposition du pays joué',
    detail: 'Il s’agit d’une affaire intérieure : son évolution dépend directement du gouvernement, de l’appareil d’État et des groupes nationaux.',
    tone: 'neutral',
  };
  if (direct) {
    const counterparts = dossier.actorIds
      .filter((id) => id !== state.playerCountryId)
      .map((id) => state.countries[id]?.name ?? id)
      .slice(0, 3);
    return {
      label: 'Exposition du pays joué',
      detail: counterparts.length
        ? `${player.name} figure directement parmi les acteurs avec ${counterparts.join(', ')}.`
        : `${player.name} figure directement parmi les acteurs de cette situation.`,
      tone: 'neutral',
    };
  }
  return {
    label: 'Exposition du pays joué',
    detail: 'Cette situation est mondiale ou étrangère. Elle reste observable, mais le moteur ne lui attribue pas de conséquence nationale directe à ce stade.',
    tone: 'neutral',
  };
}

function watchFor(state: WorldState, dossier: StrategicDossier): DossierReadingItem | null {
  const anchor = dossier.relatedAnchorId ? state.historicalAnchors[dossier.relatedAnchorId] : undefined;
  if (anchor) return {
    label: 'À surveiller',
    detail: `Fenêtre plausible : ${anchor.probableWindow.start} → ${anchor.probableWindow.end} · pression observée ${anchor.pressure.toFixed(0)}/100.`,
    tone: anchor.status === 'manifested' ? 'pressure' : 'neutral',
  };
  const process = dossier.relatedCurrentIds
    .flatMap((currentId) => Object.values(state.latentProcesses)
      .filter((item) => item.currentId === currentId && item.status === 'preparing'))
    .at(0);
  if (process) return {
    label: 'À surveiller',
    detail: `Processus latent : fenêtre ${process.window.start} → ${process.window.end}. Il ne devient visible qu’après une manifestation matérielle.`,
    tone: 'neutral',
  };
  if (dossier.sleepingAt) return {
    label: 'À surveiller',
    detail: 'Le dossier est en sommeil. Un signal extérieur significatif ou une action explicitement liée peut le réactiver.',
    tone: 'neutral',
  };
  const shock = dossier.sourceShockId
    ? state.worldEconomy.activeShocks.find((item) => item.id === dossier.sourceShockId)
    : undefined;
  if (shock) return {
    label: 'À surveiller',
    detail: `Le choc reste actif pour environ ${Math.ceil(shock.remainingMonths)} mois ; son intensité évolue avec les canaux économiques du moteur.`,
    tone: shock.intensity > 0 ? 'pressure' : 'support',
  };
  return null;
}

export function dossierCausalReading(state: WorldState, dossier: StrategicDossier): DossierCausalReading {
  const profile = dossierPressureProfile(state, dossier);
  const playerDirectlyInvolved = dossier.actorIds.includes(state.playerCountryId);
  const effects = playerDirectlyInvolved
    ? profile.pressures.slice(0, 3).map((pressure) => ({
      label: pressure.label,
      detail: pressure.summary,
      tone: pressure.direction === 'support' ? 'support' as const : 'pressure' as const,
      level: pressure.level,
      direction: pressure.direction,
    }))
    : [];
  const assessment = assessDossierResolution(state, dossier);
  const decisions = dossierDecisionRecords(dossier);
  const nextThreshold = dossier.sleepingAt
    ? {
      label: 'Prochain seuil',
      detail: 'Aucun arbitrage n’est demandé : le dossier doit d’abord être réactivé par un fait matériel ou par votre choix de le suivre.',
      tone: 'neutral' as const,
    }
    : decisions.length
      ? {
        label: 'Prochain seuil',
        detail: `Une décision de niveau ${decisions[0].urgency} est en attente. L’absence de réponse peut relancer puis aggraver le dossier, sans l’annuler.`,
        tone: 'pressure' as const,
      }
      : {
        label: dossierNeedsExitLabel(assessment.mode),
        detail: assessment.nextMilestone,
        tone: assessment.stage === 'resolved' || assessment.stage === 'stabilising' ? 'support' as const : 'neutral' as const,
      };
  return {
    trigger: triggerFor(state, dossier),
    playerRelevance: playerRelevanceFor(state, dossier),
    effects,
    nextThreshold,
    watch: watchFor(state, dossier),
  };
}

function dossierNeedsExitLabel(mode: ReturnType<typeof assessDossierResolution>['mode']) {
  return mode === 'stabilization' ? 'Vers la stabilisation' : 'Prochaine étape';
}
