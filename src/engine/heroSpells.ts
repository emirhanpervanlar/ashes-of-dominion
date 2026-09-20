import { attackDefenseModifier } from './damage.js';

/**
 * AO-D064 hero-cast cards: the hero casts on the chosen enemy directly, so the damage does not depend on
 * any friendly stack. All the numbers a balance pass may touch live here.
 */

/** Stack id used as `attackerStackId` on the STACK_ATTACKED events a hero-cast card produces. */
export const HERO_ATTACKER_ID = 'hero';

/** Damage of a card with multiplier 1.0 cast by a hero whose scaling stat is neutral, before the defense modifier. */
export const HERO_SPELL_BASE_POWER = 10;
/** The "attack" side of the H3 attack/defense modifier for hero spells (spells are not tied to a unit's Attack stat). */
export const HERO_SPELL_ATTACK = 5;
/** Hero stat scaling: 10 is neutral, every point above adds this much and every point below removes it (floored). */
export const HERO_STAT_NEUTRAL = 10;
export const HERO_STAT_SCALING_PER_POINT = 0.05;
export const HERO_STAT_SCALING_MIN = 0.5;

/** Damage multiplier a hero's scaling stat gives: Intelligence 18 -> x1.4, 8 -> x0.9. */
export function heroSpellScaling(stat: number): number {
  return Math.max(HERO_STAT_SCALING_MIN, 1 + (stat - HERO_STAT_NEUTRAL) * HERO_STAT_SCALING_PER_POINT);
}

export interface HeroSpellDamageParams {
  /** The hero's value of the card's scaling stat. */
  stat: number;
  /** Card multiplier times every other multiplier (relics, execute bonus, ...). */
  multiplier: number;
  /** The target's effective defense (base + passives + armor). */
  targetDefense: number;
}

/** card multiplier x base spell power x hero stat scaling x H3 defense modifier; a landed hit never rounds to 0. */
export function heroSpellDamage({ stat, multiplier, targetDefense }: HeroSpellDamageParams): number {
  const raw = HERO_SPELL_BASE_POWER * multiplier * heroSpellScaling(stat) * attackDefenseModifier(HERO_SPELL_ATTACK, targetDefense);
  return raw > 0 ? Math.max(1, Math.round(raw)) : 0;
}
