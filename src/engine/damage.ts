import { dodgeChancePercent, statEffectiveness } from './heroStats.js';
import { nextInt } from './rng.js';
import type { ArmyStack, Hero, RelicEffect, StatusType, UnitDefinition } from './types.js';
import type { RngState } from './rng.js';

/**
 * Diminishing returns on raw stack count, used by healing only — v3 §10 "Count scaling".
 * Damage no longer uses it (AO-D018: damage is linear in unit count).
 */
const EFFECTIVE_COUNT_BRACKETS: ReadonlyArray<{ max: number; multiplier: number }> = [
  { max: 20, multiplier: 1.0 },
  { max: 50, multiplier: 0.9 },
  { max: 100, multiplier: 0.75 },
  { max: 200, multiplier: 0.6 },
  { max: 400, multiplier: 0.45 },
  { max: Infinity, multiplier: 0.35 },
];

export function effectiveCount(count: number): number {
  const bracket = EFFECTIVE_COUNT_BRACKETS.find((b) => count <= b.max);
  return count * (bracket ? bracket.multiplier : 0.35);
}

export function statusAmount(stack: ArmyStack, type: StatusType): number {
  return stack.statuses.filter((s) => s.type === type).reduce((sum, s) => sum + s.amount, 0);
}

/** v3 §9 — Morale 0-100, starts at 100. PROTOTYPE curve: x0.7 at 0 morale up to x1.0 at 100. */
export function moraleDamageMultiplier(morale: number): number {
  const clamped = Math.max(0, Math.min(100, morale));
  return 0.7 + (clamped / 100) * 0.3;
}

export function moraleDefenseMultiplier(morale: number): number {
  const clamped = Math.max(0, Math.min(100, morale));
  return 0.85 + (clamped / 100) * 0.15;
}

/** v3 §8 — flat veterancy tiers (0/3/5/8%), not an unbounded stat. */
const VETERANCY_DAMAGE_BONUS: Record<0 | 1 | 2 | 3, number> = { 0: 0, 1: 0.03, 2: 0.05, 3: 0.08 };

export function veterancyDamageMultiplier(veterancy: 0 | 1 | 2 | 3): number {
  return 1 + VETERANCY_DAMAGE_BONUS[veterancy];
}

/** Fear — PROTOTYPE: reduces the afflicted attacker's own damage output while active. */
export function fearDamageMultiplier(attacker: ArmyStack): number {
  return 1 - Math.min(75, statusAmount(attacker, 'fear')) / 100;
}

/** Armor status — flat per-attack damage reduction, applied like extra Defense. */
export function armorReduction(target: ArmyStack): number {
  return statusAmount(target, 'armor');
}

export function relicDamageTakenMultiplier(relics: RelicEffect[]): number {
  let mult = 1;
  for (const effect of relics) {
    if (effect.kind === 'PLAYER_DAMAGE_TAKEN_MULT') mult *= effect.multiplier;
  }
  return mult;
}

export function necromancyRatio(relics: RelicEffect[]): number {
  let ratio = 0;
  for (const effect of relics) {
    if (effect.kind === 'NECROMANCY') ratio = Math.max(ratio, effect.ratio);
  }
  return ratio;
}

/** Per-unit attack after Strength/Weak, floored at 0. */
export function effectiveAttack(stack: ArmyStack, baseAttack: number): number {
  const strength = statusAmount(stack, 'strength');
  const weak = statusAmount(stack, 'weak');
  return Math.max(0, baseAttack + strength - weak);
}

export interface RawDamageParams {
  attackerStack: ArmyStack;
  attackerBaseAttack: number;
  targetDefense: number;
  multiplier: number;
  /** v3 §5 — the acting Hero's relevant stat effectiveness (STR for melee, DEX for ranged, INT for Mage magic cards). */
  heroEffectiveness?: number;
}

/** AO-D018 — Heroes 3 attack-vs-defense damage constants, kept together so balance passes touch one place. */
export const ATTACK_ADVANTAGE_PER_POINT = 0.05;
export const ATTACK_ADVANTAGE_MAX = 3;
export const DEFENSE_ADVANTAGE_PER_POINT = 0.025;
export const DEFENSE_ADVANTAGE_MAX = 0.7;

/** Percentage modifier on every unit's damage: x(1 + up to 3) if attack > defense, x(1 - up to 0.7) otherwise. */
export function attackDefenseModifier(attack: number, defense: number): number {
  if (attack > defense) return 1 + Math.min(ATTACK_ADVANTAGE_MAX, ATTACK_ADVANTAGE_PER_POINT * (attack - defense));
  return 1 - Math.min(DEFENSE_ADVANTAGE_MAX, DEFENSE_ADVANTAGE_PER_POINT * (defense - attack));
}

/**
 * AO-D018 (Heroes 3): per-unit attack scaled by the attack/defense percentage modifier, then
 * multiplied linearly by unit count. A hit that lands never rounds down to 0.
 */
export function computeRawDamage(params: RawDamageParams): number {
  const { attackerStack, attackerBaseAttack, targetDefense, multiplier, heroEffectiveness = 1 } = params;
  const perUnitAttack = effectiveAttack(attackerStack, attackerBaseAttack) * heroEffectiveness;
  const raw = perUnitAttack * attackDefenseModifier(perUnitAttack, targetDefense) * attackerStack.count * multiplier;
  return raw > 0 ? Math.max(1, Math.round(raw)) : 0;
}

export function relicDodgeBonusPercent(relics: RelicEffect[]): number {
  let bonus = 0;
  for (const effect of relics) {
    if (effect.kind === 'DODGE_BONUS_PERCENT') bonus += effect.amount;
  }
  return bonus;
}

/** Rolls the Hero's Dexterity-derived Dodge for an attack landing on a player stack. Mutates rng state. */
export function rollDodge(rng: RngState, hero: Hero, targetSide: 'player' | 'enemy', dodgeMultiplier = 1, flatBonus = 0): boolean {
  if (targetSide !== 'player') return false;
  const chance = Math.min(100, dodgeChancePercent(hero.stats.dexterity) * dodgeMultiplier + flatBonus);
  if (chance <= 0) return false;
  return nextInt(rng, 100) < chance;
}

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

export function relicHealingMultiplier(relics: RelicEffect[]): number {
  let mult = 1;
  for (const effect of relics) {
    if (effect.kind === 'HEALING_MULT') mult *= effect.multiplier;
  }
  return mult;
}

export interface DamageResolution {
  stack: ArmyStack;
  blocked: number;
  finalDamage: number;
  unitsKilled: number;
  dodged: boolean;
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
    dodged: false,
  };
}

export interface HealResolution {
  stack: ArmyStack;
  healedAmount: number;
}

/** v3 §9/§11 heal cards/actions — heals up to `preBattleMaxCount` soldiers, never beyond it. */
export function computeHealAmount(healer: ArmyStack, healPower: number, wisdomEffectiveness = 1, healingMult = 1): number {
  return Math.round(effectiveCount(healer.count) * healPower * wisdomEffectiveness * healingMult);
}

export function applyHealToStack(target: ArmyStack, amount: number, hpPerUnit: number): HealResolution {
  const capHp = target.preBattleMaxCount * hpPerUnit;
  // Healing never lowers HP, even when current HP already exceeds the cap.
  const newHp = Math.max(target.currentHp, Math.min(capHp, target.currentHp + amount));
  const newCount = Math.max(target.count, Math.ceil(newHp / hpPerUnit));
  return { stack: { ...target, currentHp: newHp, count: newCount }, healedAmount: newHp - target.currentHp };
}

/** v3 §8 unit passives — resolved by id so damage.ts stays the single source of truth for combat math. */
export function passiveDamageBonusMultiplier(attacker: ArmyStack, attackerDef: UnitDefinition, targetSide: 'player' | 'enemy', allies: ArmyStack[], target?: ArmyStack): number {
  let mult = 1;
  if (attackerDef.passiveId === 'high_ground' && attacker.position > 3) mult *= 1.25; // Archer backline
  if (attackerDef.passiveId === 'mob_tactics') {
    const adjacentGoblin = allies.some((s) => s.count > 0 && s.unitId === 'goblin' && s.stackId !== attacker.stackId && Math.abs(s.position - attacker.position) === 1);
    if (adjacentGoblin) mult *= 1.1;
  }
  if (attackerDef.passiveId === 'brutal' && target && target.count > 0 && target.count / target.preBattleMaxCount < 0.5) mult *= 1.2;
  if (attackerDef.passiveId === 'pounce' && target && target.position > 3) mult *= 1.5; // Wolf vs backline
  return mult;
}

export function passiveDefenseBonus(target: ArmyStack, targetDef: UnitDefinition, allies: ArmyStack[]): number {
  if (targetDef.passiveId !== 'formation_discipline') return 0;
  const adjacentFriendlyFront = allies.some(
    (s) => s.count > 0 && s.position <= 3 && s.stackId !== target.stackId && Math.abs(s.position - target.position) === 1
  );
  return adjacentFriendlyFront && target.position <= 3 ? targetDef.defense * 0.1 : 0;
}
