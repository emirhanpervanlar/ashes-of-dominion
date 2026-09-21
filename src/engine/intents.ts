import { UNIT_DEFINITIONS } from './data/units.js';
import { cannotAct, computeRawDamage } from './damage.js';
import { computeValidTargets, isFrontPosition } from './targeting.js';
import { nextInt } from './rng.js';
import type { ArmyStack, CombatState, EnemyIntent, UnitDefinition } from './types.js';

/** AO-050: the enemy Shaman never attacks, so its Strength buff carries its role (+20% damage to the buffed stack against the H3 modifier at 0.05 per point). */
const SHAMAN_BUFF_STRENGTH = 4;

function alive(stacks: ArmyStack[]): ArmyStack[] {
  return stacks.filter((s) => s.count > 0);
}

/**
 * v3 §20 priority scoring — "predictable enough to plan against, imperfect enough
 * not to feel scripted." Base values are the doc's literal example numbers;
 * exact weights are PROTOTYPE (v3 §44).
 */
function scoreTarget(target: ArmyStack, targetDef: UnitDefinition, wouldKill: boolean): number {
  let score = 30; // "random Swordsman" baseline
  if (wouldKill) score += 100;
  if (wouldKill && (targetDef.tags.includes('ranged') || targetDef.tags.includes('healer'))) score += 80;
  return score;
}

function pickBestTarget(state: CombatState, attacker: ArmyStack, pool: ArmyStack[]): ArmyStack {
  const attackerDef = UNIT_DEFINITIONS[attacker.unitId];
  let best: ArmyStack[] = [];
  let bestScore = -Infinity;
  for (const target of pool) {
    const targetDef = UNIT_DEFINITIONS[target.unitId];
    const estimatedDamage = computeRawDamage({ attackerStack: attacker, attackerBaseAttack: attackerDef.attack, targetDefense: targetDef.defense, multiplier: 1 });
    const wouldKill = estimatedDamage >= target.currentHp;
    const score = scoreTarget(target, targetDef, wouldKill);
    if (score > bestScore) {
      bestScore = score;
      best = [target];
    } else if (score === bestScore) {
      best.push(target);
    }
  }
  return best[nextInt(state.rng, best.length)]!;
}

/**
 * Visible enemy intents, generated before the player's turn (v3 §20). Target
 * pools come from the same lane geometry the player uses (v3 §5, targeting.ts);
 * `targetPreference` narrows that pool, Taunt overrides it, and priority
 * scoring picks the best target within whatever pool remains.
 */
export function generateEnemyIntents(state: CombatState): EnemyIntent[] {
  const intents: EnemyIntent[] = [];
  const livePlayer = alive(state.playerArmy);
  const liveEnemy = alive(state.enemyArmy);

  for (const stack of liveEnemy) {
    if (cannotAct(stack)) continue;
    const def = UNIT_DEFINITIONS[stack.unitId];
    const pref = def.targetPreference ?? 'frontline';

    if (pref === 'buff-weakest-ally') {
      const candidates = liveEnemy.filter((s) => s.stackId !== stack.stackId);
      const pool = candidates.length > 0 ? candidates : liveEnemy;
      const weakest = pool.reduce((worst, s) => (s.currentHp / s.maxHp < worst.currentHp / worst.maxHp ? s : worst));
      intents.push({ stackId: stack.stackId, kind: 'buff', targetStackId: weakest.stackId, buffStatus: 'strength', buffAmount: SHAMAN_BUFF_STRENGTH });
      continue;
    }

    if (livePlayer.length === 0) continue;

    // AO-D032: Taunt narrows the pool but never overrides reach (lane and front/back rules still apply).
    const validTargets = computeValidTargets(stack, livePlayer, def, liveEnemy);
    if (validTargets.length === 0) continue;
    const taunting = validTargets.filter((s) => s.statuses.some((st) => st.type === 'taunt'));
    let pool: ArmyStack[];
    if (taunting.length > 0) {
      pool = taunting;
    } else {
      if (pref === 'backline') {
        const back = validTargets.filter((s) => !isFrontPosition(s.position));
        pool = back.length > 0 ? back : validTargets;
      } else if (pref === 'weakest') {
        const minRatio = Math.min(...validTargets.map((s) => s.currentHp / s.maxHp));
        pool = validTargets.filter((s) => s.currentHp / s.maxHp === minRatio);
      } else if (pref === 'ranged-priority') {
        const ranged = validTargets.filter((s) => UNIT_DEFINITIONS[s.unitId].tags.includes('ranged') || UNIT_DEFINITIONS[s.unitId].tags.includes('healer'));
        pool = ranged.length > 0 ? ranged : validTargets;
      } else {
        const front = validTargets.filter((s) => isFrontPosition(s.position));
        pool = front.length > 0 ? front : validTargets;
      }
    }

    const target = pickBestTarget(state, stack, pool);
    const targetDef = UNIT_DEFINITIONS[target.unitId];
    const estimatedDamage = computeRawDamage({ attackerStack: stack, attackerBaseAttack: def.attack, targetDefense: targetDef.defense, multiplier: 1 });

    intents.push({ stackId: stack.stackId, kind: 'attack', targetStackId: target.stackId, estimatedDamage });
  }

  return intents;
}
