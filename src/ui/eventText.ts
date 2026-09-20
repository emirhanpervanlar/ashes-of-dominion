import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, CombatEvent, CombatState } from '../engine/index.js';

function findStackAnywhere(state: CombatState, stackId: string): ArmyStack | undefined {
  return state.playerArmy.find((s) => s.stackId === stackId) ?? state.enemyArmy.find((s) => s.stackId === stackId);
}

function stackLabel(state: CombatState, stackId: string | null | undefined): string {
  if (!stackId) return 'unknown';
  const stack = findStackAnywhere(state, stackId);
  if (!stack) return stackId;
  return `${UNIT_DEFINITIONS[stack.unitId].name} (pos ${stack.position})`;
}

/** Plain-text combat log line for an event, or null if it's too noisy to show. */
export function describeEvent(state: CombatState, event: CombatEvent): string | null {
  switch (event.type) {
    case 'BATTLE_STARTED':
      return 'Battle started.';
    case 'TURN_STARTED':
      return event.side === 'player' ? `— Turn ${event.turnNumber}: Player —` : `— Turn ${event.turnNumber}: Enemy —`;
    case 'CARD_PLAYED':
      return `Played ${event.cardId}.`;
    case 'CARD_EXHAUSTED':
      return `${event.cardId} exhausted.`;
    case 'DECK_RESHUFFLED':
      return 'Deck reshuffled.';
    case 'STACK_ATTACKED':
      return `${stackLabel(state, event.attackerStackId)} attacks ${stackLabel(state, event.targetStackId)} for ${event.finalDamage} dmg${event.blocked > 0 ? ` (${event.blocked} blocked)` : ''}: ${event.unitsKilled} unit(s) killed, ${event.countAfter} left.`;
    case 'STACK_DESTROYED':
      return `${stackLabel(state, event.stackId)} was destroyed!`;
    case 'BLOCK_GAINED':
      return `${stackLabel(state, event.stackId)} gains ${event.amount} Block.`;
    case 'MORALE_CHANGED':
      return `${stackLabel(state, event.stackId)} morale ${event.amount >= 0 ? '+' : ''}${event.amount}.`;
    case 'STATUS_APPLIED':
      return `${stackLabel(state, event.stackId)} gains ${event.status} (${event.amount}).`;
    case 'STATUSES_REMOVED':
      return `${stackLabel(state, event.stackId)} loses ${event.statuses.join(', ')}.`;
    case 'STACK_HEALED':
      return `${stackLabel(state, event.stackId)} heals ${event.amount}.`;
    case 'COUNTERATTACK_TRIGGERED':
      return `${stackLabel(state, event.stackId)} counterattacks ${stackLabel(state, event.targetStackId)}!`;
    case 'DIVINE_SHIELD_CONSUMED':
      return `${stackLabel(state, event.stackId)}'s Divine Protection absorbs a lethal blow!`;
    case 'STACK_MOVED':
      return `${stackLabel(state, event.stackId)} moves to position ${event.toPosition}.`;
    case 'MANA_GAINED':
      return `Hero gains ${event.amount} Mana.`;
    case 'ACTION_REJECTED':
      return `Rejected: ${event.reason}`;
    case 'BATTLE_ENDED':
      return event.result === 'victory' ? 'VICTORY!' : 'DEFEAT.';
    default:
      return null;
  }
}
