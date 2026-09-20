import { roundSafe } from '../floatSafe.js';
import { nextInt, type RngState } from '../rng.js';
import { DAYS_PER_CHAPTER, threatMultiplier } from './chapters.js';

/**
 * AO-D053 battle loot. Gold is common, Food is a low-probability drop. Both grow with the
 * chapter, the day inside the chapter, Threat (stronger enemies) and elite/boss fights.
 * Every number is a PROPOSAL; nothing else in the engine hard-codes them.
 */
export const BATTLE_LOOT = {
  /** Base bands by chapter (index 0 = chapter 1), at day 1 of the chapter, normal enemy, Threat 0. */
  chapters: [
    { gold: [12, 24], foodChance: 0.2, food: [5, 10] },
    { gold: [25, 45], foodChance: 0.25, food: [8, 16] },
    { gold: [40, 70], foodChance: 0.3, food: [12, 22] },
  ] as ReadonlyArray<{ gold: readonly [number, number]; foodChance: number; food: readonly [number, number] }>,
  /** Gold amount and Food chance are multiplied by 1 + dayBonus x (share of the chapter's days already gone). */
  dayBonus: 0.5,
  /** Elite battles and bosses pay more. */
  elite: { gold: 1.75, foodChance: 2, food: 1.5 },
  /** Food chance never exceeds this, so Food stays a gamble. */
  maxFoodChance: 0.6,
} as const;

export interface LootContext {
  chapter: number;
  day: number;
  elite: boolean;
  threat: number;
}

export interface LootBands {
  gold: readonly [number, number];
  foodChance: number;
  food: readonly [number, number];
}

/** The Gold range, Food chance and Food range a battle would pay right now; the roll picks inside them. */
export function battleLootBands(ctx: LootContext): LootBands {
  const base = BATTLE_LOOT.chapters[ctx.chapter - 1] ?? BATTLE_LOOT.chapters[BATTLE_LOOT.chapters.length - 1]!;
  const chapterStart = (ctx.chapter - 1) * DAYS_PER_CHAPTER + 1;
  const progress = Math.min(1, Math.max(0, (ctx.day - chapterStart) / DAYS_PER_CHAPTER));
  const dayMult = 1 + BATTLE_LOOT.dayBonus * progress;
  const threat = threatMultiplier(ctx.threat);
  const elite = ctx.elite ? BATTLE_LOOT.elite : { gold: 1, foodChance: 1, food: 1 };
  const scale = (n: number, m: number) => roundSafe(n * m);
  return {
    gold: [scale(base.gold[0], dayMult * threat * elite.gold), scale(base.gold[1], dayMult * threat * elite.gold)],
    foodChance: Math.min(BATTLE_LOOT.maxFoodChance, base.foodChance * dayMult * elite.foodChance),
    food: [scale(base.food[0], threat * elite.food), scale(base.food[1], threat * elite.food)],
  };
}

/** Deterministic through the run RNG; always consumes three rolls so later randomness does not depend on the Food outcome. */
export function rollBattleLoot(rng: RngState, ctx: LootContext): { gold: number; food: number } {
  const bands = battleLootBands(ctx);
  const gold = bands.gold[0] + nextInt(rng, bands.gold[1] - bands.gold[0] + 1);
  const dropped = nextInt(rng, 100) < roundSafe(bands.foodChance * 100);
  const foodRoll = bands.food[0] + nextInt(rng, bands.food[1] - bands.food[0] + 1);
  return { gold, food: dropped ? foodRoll : 0 };
}
