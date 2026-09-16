import { UNIT_DEFINITIONS } from './data/units.js';
import { bossScalingAttackBonus, computeRawDamage } from './damage.js';
import { nextInt } from './rng.js';
import type { ArmyStack, CombatState, EnemyIntent } from './types.js';

function isFront(stack: ArmyStack): boolean {
  return stack.position <= 3;
}

function alive(stacks: ArmyStack[]): ArmyStack[] {
  return stacks.filter((s) => s.count > 0);
}

/**
 * Visible enemy intents, generated before the player's turn (AGENT.md §8).
 * Deterministic: draws only from state.rng.
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
    // Guard Stance's Taunt (AGENT.md §48 Immortal Knights) overrides normal row targeting.
    const taunting = livePlayer.filter((s) => s.statuses.some((st) => st.type === 'taunt'));
    const rowPool = livePlayer.filter((s) => (pref === 'backline' ? !isFront(s) : isFront(s)));
    const pool = taunting.length > 0 ? taunting : rowPool.length > 0 ? rowPool : livePlayer;
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
