import type { ArmyStack, RelicEffect, StatusType, UnitDefinition } from './types.js';

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

export function statusAmount(stack: ArmyStack, type: StatusType): number {
  return stack.statuses.filter((s) => s.type === type).reduce((sum, s) => sum + s.amount, 0);
}

/** Morale (AGENT.md §46 Horde/§48 archetypes) — ±5% damage dealt per point, soft-capped at ±50%. */
export function moraleDamageMultiplier(morale: number): number {
  const clamped = Math.max(-10, Math.min(10, morale));
  return 1 + clamped * 0.05;
}

/** Veterancy (AGENT.md §30 stack merging, §48 Immortal Knights) — a flat per-unit Attack bonus. */
export function veterancyFlatBonus(veterancy: number): number {
  return Math.floor(veterancy / 3);
}

/** Focus Fire's Vulnerable status — a target-side damage-taken multiplier (`amount` is percentage points). */
export function vulnerableDamageMultiplier(target: ArmyStack): number {
  return 1 + statusAmount(target, 'vulnerable') / 100;
}

/** Immortal Knights relics (e.g. Bulwark Standard) — reduces incoming damage to player stacks. */
export function relicDamageTakenMultiplier(relics: RelicEffect[]): number {
  let mult = 1;
  for (const effect of relics) {
    if (effect.kind === 'PLAYER_DAMAGE_TAKEN_MULT') mult *= effect.multiplier;
  }
  return mult;
}

/** Necromantic Doctrine / Grave Crown — fraction of player casualties raised as Skeletons. */
export function necromancyRatio(relics: RelicEffect[]): number {
  let ratio = 0;
  for (const effect of relics) {
    if (effect.kind === 'NECROMANCY') ratio = Math.max(ratio, effect.ratio);
  }
  return ratio;
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

/** AGENT.md §42 Warlord mechanic — computed fresh each attack, never stored as a status (see UnitDefinition doc comment). */
export function bossScalingAttackBonus(attackerDef: UnitDefinition, playerArmy: ArmyStack[]): number {
  if (!attackerDef.scalesWithPlayerArmy) return 0;
  const totalPlayerCount = playerArmy.reduce((sum, s) => sum + s.count, 0);
  return Math.floor(totalPlayerCount / attackerDef.scalesWithPlayerArmy.divisor);
}

export interface DamageResolution {
  stack: ArmyStack;
  blocked: number;
  finalDamage: number;
  unitsKilled: number;
}

export interface HealResolution {
  stack: ArmyStack;
  healedAmount: number;
}

/** v2_list.md §7/§9 Priest basic action — heals up to maxHp, no revival of dead units. */
export function computeHealAmount(healer: ArmyStack, healPower: number): number {
  return Math.round(effectiveCount(healer.count) * healPower);
}

export function applyHealToStack(target: ArmyStack, amount: number): HealResolution {
  const newHp = Math.min(target.maxHp, target.currentHp + amount);
  return { stack: { ...target, currentHp: newHp }, healedAmount: newHp - target.currentHp };
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
