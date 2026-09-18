import type { HeroStats } from './types.js';

/**
 * v3 §5 — "10 is neutral. Below 10 gives no negative scaling."
 * effectiveness = 1 + max(0, stat-10) * 0.02, capped at x1.40 overall.
 */
export function statEffectiveness(stat: number): number {
  return Math.min(1.4, 1 + Math.max(0, stat - 10) * 0.02);
}

/**
 * v3 §5 Dexterity table (10->0%, 12->2%, 15->5%, 18->8%, 20->10%) is exactly
 * `dex - 10`, capped at the documented 20% ceiling.
 */
export function dodgeChancePercent(dexterity: number): number {
  return Math.min(20, Math.max(0, dexterity - 10));
}

/** v3 §5 — every 2 Wisdom above 10 = +1 Max Mana, capped at 12 total. */
export function maxManaFromWisdom(baseMana: number, wisdom: number): number {
  const bonus = Math.floor(Math.max(0, wisdom - 10) / 2);
  return Math.min(12, baseMana + bonus);
}

/** Which Hero stat scales a unit's basic-attack damage, by its attack style. */
export function damageStatFor(tags: string[]): keyof HeroStats {
  if (tags.includes('ranged')) return 'dexterity';
  return 'strength';
}
