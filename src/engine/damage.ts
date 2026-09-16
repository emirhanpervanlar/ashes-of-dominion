import type { ArmyStack, RelicEffect, StatusType } from './types.js';

/**
 * Diminishing returns on raw stack count — AGENT.md §11.
 * Flat-bracket lookup (not marginal/tax-bracket) per the literal table.
 * PROTOTYPE: coefficients are explicitly not locked (AGENT.md §70).
 */
const EFFECTIVE_COUNT_BRACKETS: ReadonlyArray<{ max: number; multiplier: number }> = [
  { max: 50, multiplier: 1.0 },
  { max: 100, multiplier: 0.9 },
  { max: 200, multiplier: 0.75 },
  { max: 400, multiplier: 0.6 },
  { max: Infinity, multiplier: 0.45 },
];

export function effectiveCount(count: number): number {
  const bracket = EFFECTIVE_COUNT_BRACKETS.find((b) => count <= b.max);
  return count * (bracket ? bracket.multiplier : 0.45);
}

function statusAmount(stack: ArmyStack, type: StatusType): number {
  return stack.statuses.filter((s) => s.type === type).reduce((sum, s) => sum + s.amount, 0);
}

/**
 * Per-unit attack after Strength/Weak, floored at 0.
 */
export function effectiveAttack(stack: ArmyStack, baseAttack: number): number {
  const strength = statusAmount(stack, 'strength');
  const weak = statusAmount(stack, 'weak');
  return Math.max(0, baseAttack + strength - weak);
}

/**
 * ASSUMPTION (documented, AGENT.md §72): defense mitigates damage per
 * attacking unit before the count multiplier is applied, rather than as a
 * flat subtraction from the final (already-scaled) damage total. A flat
 * subtraction makes single-digit Defense values meaningless once Raw
 * Damage reaches the hundreds. This is a PROTOTYPE formula, not locked.
 */
export function computeRawDamage(
  attackerStack: ArmyStack,
  attackerBaseAttack: number,
  targetDefense: number,
  multiplier: number
): number {
  const perUnitAttack = effectiveAttack(attackerStack, attackerBaseAttack);
  const perUnitNet = Math.max(0, perUnitAttack - targetDefense);
  const raw = perUnitNet * effectiveCount(attackerStack.count) * multiplier;
  return Math.round(raw);
}

/** Combat-modifier relic effects, read fresh on every attack (AGENT.md §16). */
export function relicDamageMultiplier(relics: RelicEffect[], attackerCount: number, attackerTags: string[]): number {
  let mult = 1;
  for (const effect of relics) {
    if (effect.kind === 'PLAYER_DAMAGE_MULT') mult *= effect.multiplier;
    if (effect.kind === 'TAG_DAMAGE_MULT' && attackerTags.includes(effect.tag)) mult *= effect.multiplier;
    if (effect.kind === 'SMALL_STACK_DAMAGE_MULT' && attackerCount < effect.threshold) mult *= effect.multiplier;
  }
  return mult;
}

export function relicFlatAttackBonus(relics: RelicEffect[], attackerCount: number): number {
  let bonus = 0;
  for (const effect of relics) {
    if (effect.kind === 'LARGE_STACK_STRENGTH' && attackerCount > effect.threshold) bonus += effect.amount;
  }
  return bonus;
}

export interface DamageResolution {
  stack: ArmyStack;
  blocked: number;
  finalDamage: number;
  unitsKilled: number;
}

/** Applies damage to a target stack: Block absorbs first, then HP/casualties. */
export function applyDamageToStack(target: ArmyStack, hpPerUnit: number, rawDamage: number): DamageResolution {
  const blocked = Math.min(target.block, rawDamage);
  const remaining = rawDamage - blocked;
  const newBlock = target.block - blocked;
  const newHp = Math.max(0, target.currentHp - remaining);
  const newCount = newHp > 0 ? Math.ceil(newHp / hpPerUnit) : 0;
  const unitsKilled = target.count - newCount;

  return {
    stack: { ...target, block: newBlock, currentHp: newHp, count: newCount },
    blocked,
    finalDamage: remaining,
    unitsKilled,
  };
}
