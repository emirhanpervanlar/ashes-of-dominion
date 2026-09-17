import { UNIT_DEFINITIONS } from './data/units.js';
import { bossScalingAttackBonus, computeRawDamage } from './damage.js';
import { computeValidTargets, isFrontPosition } from './targeting.js';
import { nextInt } from './rng.js';
import type { ArmyStack, CombatState, EnemyIntent } from './types.js';

function alive(stacks: ArmyStack[]): ArmyStack[] {
  return stacks.filter((s) => s.count > 0);
}

/**
 * Visible enemy intents, generated before the player's turn (AGENT.md §8).
 * v2_list.md §5/§14 — the target pool is now the same lane-geometry the
 * player uses, with `targetPreference` narrowing that pool rather than
 * picking from the whole row. Deterministic: draws only from state.rng.
 */
export function generateEnemyIntents(state: CombatState): EnemyIntent[] {
  const intents: EnemyIntent[] = [];
  const livePlayer = alive(state.playerArmy);
  const liveEnemy = alive(state.enemyArmy);

  for (const stack of liveEnemy) {
    const def = UNIT_DEFINITIONS[stack.unitId];
    const pref = def.targetPreference ?? 'frontline';

    if (pref === 'buff-weakest-ally') {
      const candidates = liveEnemy.filter((s) => s.stackId !== stack.stackId);
      const pool = candidates.length > 0 ? candidates : liveEnemy;
      const weakest = pool.reduce((worst, s) =>
        s.currentHp / s.maxHp < worst.currentHp / worst.maxHp ? s : worst
      );
      intents.push({
        stackId: stack.stackId,
        kind: 'buff',
        targetStackId: weakest.stackId,
        buffStatus: 'strength',
        buffAmount: 2,
      });
      continue;
    }

    if (livePlayer.length === 0) continue;

    // Guard Stance's Taunt (AGENT.md §48 Immortal Knights) overrides normal targeting
    // entirely, including the lane geometry — that's the point of drawing aggro.
    const taunting = livePlayer.filter((s) => s.statuses.some((st) => st.type === 'taunt'));
    let pool: ArmyStack[];
    if (taunting.length > 0) {
      pool = taunting;
    } else {
      const validTargets = computeValidTargets(stack, livePlayer, def);
      if (validTargets.length === 0) continue;
      const rowPool = validTargets.filter((s) => (pref === 'backline' ? !isFrontPosition(s.position) : isFrontPosition(s.position)));
      pool = rowPool.length > 0 ? rowPool : validTargets;
    }
    const target = pool[nextInt(state.rng, pool.length)]!;
    const bossFlat = bossScalingAttackBonus(def, state.playerArmy);
    const estimatedDamage = computeRawDamage(stack, def.attack + bossFlat, UNIT_DEFINITIONS[target.unitId].defense, 1);

    intents.push({
      stackId: stack.stackId,
      kind: 'attack',
      targetStackId: target.stackId,
      estimatedDamage,
    });
  }

  return intents;
}
