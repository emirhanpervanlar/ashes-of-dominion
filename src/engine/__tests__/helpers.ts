import type { CombatState } from '../types.js';

/**
 * AO-D018 damage is linear in count, so the small starting armies do not survive a passed turn against
 * the scenario formations. Turn-loop tests that only care about turn bookkeeping use this beefed-up army.
 */
export function sturdy(state: CombatState, factor = 100): CombatState {
  return {
    ...state,
    playerArmy: state.playerArmy.map((s) => ({
      ...s,
      count: s.count * factor,
      currentHp: s.currentHp * factor,
      maxHp: s.maxHp * factor,
      startingCount: s.startingCount * factor,
      preBattleMaxCount: s.preBattleMaxCount * factor,
    })),
  };
}
