import { fiscalBudgetAvailable } from './fiscal';
import { commitWorldAction } from './ledger';
import type {
  ActionProgram,
  CommonActionCategory,
  CountryId,
  StrategicDossier,
  WorldCrisisInfluenceKind,
  WorldCrisisInfluenceSpec,
  WorldEffect,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

export type WorldCrisisInfluenceOption = {
  kind: 'public_position' | WorldCrisisInfluenceKind;
  title: string;
  summary: string;
  category?: CommonActionCategory;
  intent?: string;
  targetId?: CountryId;
  requiresForeignDialogue?: boolean;
  publicCost?: number;
  influence?: WorldCrisisInfluenceSpec;
};

function principalCounterpart(state: WorldState, dossier: StrategicDossier): CountryId | undefined {
  return dossier.actorIds.find((id): id is CountryId => id !== state.playerCountryId && Boolean(state.countries[id]));
}

function materialOption(state: WorldState, dossier: StrategicDossier): WorldCrisisInfluenceOption {
  const oil = dossier.id === 'world-oil-market-balance';
  const security = dossier.worldCrisisState?.mode === 'security_balance' || dossier.worldCrisisState?.mode === 'diplomatic_crisis';
  const category: CommonActionCategory = oil ? 'economic' : security ? 'defense' : 'intelligence';
  const intent = oil
    ? 'Lancer un programme français de résilience énergétique : stocks stratégiques pétroliers, diversification des importations et continuité logistique.'
    : security
      ? `Renforcer la préparation des forces françaises face aux retombées de « ${dossier.title} ».`
      : `Lancer une évaluation de renseignement française sur les retombées de « ${dossier.title} ».`;
  return {
    kind: 'material_response',
    title: oil ? 'Réduire l’exposition énergétique française' : 'Préparer une réponse matérielle française',
    summary: oil
      ? 'Protège la France contre un choc durable ; elle ne prétend pas, seule, faire baisser le prix mondial.'
      : 'Renforce les moyens français face aux retombées ; l’effet international reste volontairement limité.',
    category,
    intent,
    influence: {
      kind: 'material_response', label: oil ? 'Résilience énergétique française' : 'Préparation française',
      summary: oil ? 'La France amortit une part des effets d’un marché pétrolier tendu.' : 'La France réduit sa vulnérabilité aux retombées de la crise.',
      pressureDeltaOnSuccess: 0, cooperationDeltaOnSuccess: 0, playerExposureMitigationOnSuccess: oil ? 18 : 12,
      pressureDeltaOnPartial: 0, cooperationDeltaOnPartial: 0, playerExposureMitigationOnPartial: oil ? 8 : 5,
    },
  };
}

/** Trois voies seulement : parole légère, médiation après vrai dialogue, ou protection française. */
export function worldCrisisInfluenceOptions(state: WorldState, dossierId: string): WorldCrisisInfluenceOption[] {
  const dossier = state.strategicDossiers[dossierId];
  if (!dossier?.worldCrisisState) return [];
  const targetId = principalCounterpart(state, dossier);
  const target = targetId ? state.countries[targetId]?.name : 'les acteurs concernés';
  return [
    {
      kind: 'public_position', title: 'Prendre une position publique', publicCost: 0.3,
      summary: 'Un signal diplomatique limité : il infléchit la lecture du dossier, sans créer de canal ni d’engagement matériel.',
    },
    {
      kind: 'mediation', title: 'Préparer une médiation', category: 'diplomacy', targetId, requiresForeignDialogue: true,
      intent: `Préparer une médiation française avec ${target} afin de réduire la pression dans « ${dossier.title} » et de clarifier un cadre de coopération.`,
      summary: 'Nécessite qu’un interlocuteur ait déjà répondu dans un dialogue que vous avez ouvert. Le programme ne remplace pas cette discussion.',
      influence: {
        kind: 'mediation', label: 'Médiation française', summary: 'La médiation française crée une marge limitée de désescalade et de coordination.',
        pressureDeltaOnSuccess: -8, cooperationDeltaOnSuccess: 10, playerExposureMitigationOnSuccess: 3,
        pressureDeltaOnPartial: -3, cooperationDeltaOnPartial: 4, playerExposureMitigationOnPartial: 1,
      },
    },
    materialOption(state, dossier),
  ];
}

/** Une déclaration est une action légère et ponctuelle. Elle n’ouvre jamais un dialogue. */
export function declareWorldCrisisPosition(state: WorldState, dossierId: string) {
  const dossier = state.strategicDossiers[dossierId];
  const crisis = dossier?.worldCrisisState;
  const player = state.countries[state.playerCountryId];
  const cost = 0.3;
  if (!dossier || !crisis || !player) return { ok: false as const, state, error: 'Cette crise mondiale n’est plus disponible.' };
  if (crisis.lastPublicPositionAt === state.currentDate) return { ok: false as const, state, error: 'Une position publique a déjà été prise sur ce dossier ce mois-ci.' };
  if (fiscalBudgetAvailable(player) < cost) return { ok: false as const, state, error: `Marge discrétionnaire insuffisante : ${cost.toFixed(1)} crédit nécessaire.` };
  const nextCrisis = {
    ...crisis,
    pressure: Number(clamp(crisis.pressure - 2).toFixed(1)),
    cooperation: Number(clamp(crisis.cooperation + 2).toFixed(1)),
    lastPublicPositionAt: state.currentDate,
  };
  const summary = 'La France appelle publiquement à contenir l’escalade et à préserver un espace de coordination. Le signal est réel, mais son effet reste limité sans relais ni négociation.';
  const effects: WorldEffect[] = [
    { kind: 'fiscal_delta', countryId: player.id, bucket: 'discretionary', delta: -cost, reason: 'Préparation diplomatique et communication de la position publique française.', visibility: 'player' },
    { kind: 'dossier_patch', dossierId, patch: { playerStance: summary, worldCrisisState: nextCrisis, updatedAt: state.currentDate }, reason: 'La position française modifie légèrement la marge politique du dossier.', visibility: 'player' },
    { kind: 'dossier_entry_add', dossierId, entry: { id: `world-crisis-position-${dossierId}-${state.currentDate}`, date: state.currentDate, title: 'Position publique française', summary, importance: 'moderate', actorIds: [player.id], requiresDecision: false, visibility: 'player' }, reason: 'La position publique est conservée dans la chronologie du dossier.', visibility: 'player' },
  ];
  return { ok: true as const, state: commitWorldAction(state, { kind: 'diplomatic', actorId: player.id, targetIds: [], origin: 'player', visibility: 'player', intent: `Déclarer une position publique sur « ${dossier.title} »`, effects }) };
}

/** Injecte le résultat d’un programme volontaire dans la même crise, sans transformer une préparation française en causalité mondiale démesurée. */
export function worldCrisisInfluenceResolutionEffects(
  state: WorldState,
  program: Pick<ActionProgram, 'id' | 'actorId' | 'linkedDossierId' | 'worldCrisisInfluence'>,
  outcome: 'succeeded' | 'partially_succeeded' | 'failed',
): WorldEffect[] {
  const spec = program.worldCrisisInfluence;
  const dossierId = program.linkedDossierId;
  const dossier = dossierId ? state.strategicDossiers[dossierId] : undefined;
  const crisis = dossier?.worldCrisisState;
  if (!spec || !dossierId || !dossier || !crisis || outcome === 'failed') return [];
  const succeeded = outcome === 'succeeded';
  const pressureDelta = succeeded ? spec.pressureDeltaOnSuccess : spec.pressureDeltaOnPartial;
  const cooperationDelta = succeeded ? spec.cooperationDeltaOnSuccess : spec.cooperationDeltaOnPartial;
  const mitigationDelta = succeeded ? spec.playerExposureMitigationOnSuccess : spec.playerExposureMitigationOnPartial;
  const nextCrisis = {
    ...crisis,
    pressure: Number(clamp(crisis.pressure + pressureDelta).toFixed(1)),
    cooperation: Number(clamp(crisis.cooperation + cooperationDelta).toFixed(1)),
    playerExposureMitigation: Number(clamp((crisis.playerExposureMitigation ?? 0) + mitigationDelta).toFixed(1)),
  };
  const result = succeeded ? 'aboutit' : 'produit un résultat partiel';
  const summary = `${spec.summary} Le programme ${result} : pression ${pressureDelta >= 0 ? '+' : ''}${pressureDelta.toFixed(0)}, coopération ${cooperationDelta >= 0 ? '+' : ''}${cooperationDelta.toFixed(0)}, protection française +${mitigationDelta.toFixed(0)}.`;
  return [
    { kind: 'dossier_patch', dossierId, patch: { worldCrisisState: nextCrisis, updatedAt: state.currentDate }, reason: 'Le résultat du programme volontaire infléchit les indicateurs explicitement prévus.', visibility: 'player' },
    { kind: 'dossier_entry_add', dossierId, entry: { id: `${program.id}-world-crisis-influence`, date: state.currentDate, title: `${spec.label} · résultat`, summary, importance: 'moderate', actorIds: [program.actorId], requiresDecision: false, visibility: 'player' }, reason: 'L’influence française est lisible dans la chronologie de la crise.', visibility: 'player' },
  ];
}
