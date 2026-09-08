import type { ActionProgram, CommonActionCategory, CountryId, EnergyResource } from './types';

/**
 * Objet intermédiaire entre une formulation humaine et une action du moteur.
 * Il est volontairement plus pauvre qu'une ActionProgram : ni l'IA ni le
 * joueur ne peuvent y injecter directement des effets ou une signature.
 */
export type ActionIntent =
  | {
      kind: 'common_program';
      actorId: CountryId;
      targetIds: CountryId[];
      category: CommonActionCategory;
      objective: string;
      operation?: 'contact' | 'cooperation' | 'defense_pact' | 'mediation' | 'information_sharing';
      source: 'player' | 'local_rule' | 'ai';
      requestId?: string;
    }
  | {
      kind: 'energy_contract';
      actorId: CountryId;
      targetIds: CountryId[];
      resource: EnergyResource;
      objective: string;
      source: 'player' | 'local_rule' | 'ai';
      requestId?: string;
    };

export const actionIntentFromProgram = (program: Pick<ActionProgram, 'actorId' | 'targetIds' | 'category' | 'intent'>, source: ActionIntent['source'] = 'player', operation?: ActionIntentExtractOperation): ActionIntent => ({
  kind: 'common_program',
  actorId: program.actorId,
  targetIds: program.targetIds.filter((id): id is CountryId => typeof id === 'string'),
  category: program.category,
  objective: program.intent,
  source,
  ...(operation ? { operation } : {}),
});

type ActionIntentExtractOperation = NonNullable<Extract<ActionIntent, { kind: 'common_program' }>['operation']>;
