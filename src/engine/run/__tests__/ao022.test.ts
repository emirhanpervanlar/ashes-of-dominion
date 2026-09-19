import { describe, expect, it } from 'vitest';
import { UNIT_DEFINITIONS } from '../../data/units.js';
import { createStack } from '../../army.js';
import { createRng } from '../../rng.js';
import type { CombatState, UnitId } from '../../types.js';
import { BUILDING_DEFINITIONS, FARM_TIERS, farmDescription } from '../city.js';
import { FOOD_WARNING_DAYS, dailyFoodNet, dailyProduction, dailyUpkeep, foodDaysLeft, foodWarning, moveFoodCost, stackUpkeep } from '../food.js';
import { BATTLE_LOOT, battleLootBands, rollBattleLoot } from '../loot.js';
import { applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);
const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');

function onMap(seed: number, hero: 'warlord' | 'rogue' | 'mage' = 'warlord'): RunState {
  return act(createRun(seed, hero), { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' }).run;
}

function withArmy(run: RunState, counts: Array<[UnitId, number]>): RunState {
  return { ...run, army: counts.map(([unitId, count], i) => createStack(unitId, 'player', ((i + 1) as 1 | 2 | 3 | 4 | 5 | 6), count)) };
}

function withFarm(run: RunState, tier: 0 | 1 | 2 | 3 | 4 | 5): RunState {
  return { ...run, city: { ...run.city, farmTier: tier, buildings: tier > 0 ? [...run.city.buildings, 'farm'] : run.city.buildings } };
}

function step(run: RunState, type: NodeType = 'start') {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return act({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId });
}

function winBattle(run: RunState, type: NodeType = 'battle') {
  const fighting = step(run, type).run;
  const combat = fighting.combat!;
  const won: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return act({ ...fighting, combat: won }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
}

describe('AO-D048: per-unit Food upkeep', () => {
  it('has one foodPerUnit per unit: Knight eats most, Swordsman and Goblin least, Archer and Priest in between', () => {
    const f = (id: UnitId) => UNIT_DEFINITIONS[id].foodPerUnit;
    expect(f('knight')).toBeGreaterThan(f('archer'));
    expect(f('knight')).toBeGreaterThan(f('priest'));
    expect(f('archer')).toBeGreaterThan(f('swordsman'));
    expect(f('priest')).toBeGreaterThan(f('swordsman'));
    expect(f('goblin')).toBeLessThanOrEqual(f('archer'));
    expect(f('goblin')).toBeLessThan(f('knight'));
  });

  it('a stack eats count x foodPerUnit and the day costs the sum, rounded to the nearest Food', () => {
    const run = withArmy(onMap(1), [['swordsman', 10], ['knight', 3], ['priest', 1]]);
    expect(stackUpkeep(run.army[0]!)).toBeCloseTo(1);
    expect(stackUpkeep(run.army[1]!)).toBeCloseTo(1.5);
    expect(stackUpkeep(run.army[2]!)).toBeCloseTo(0.2);
    expect(dailyUpkeep(run)).toBe(3); // 1 + 1.5 + 0.2 = 2.7
  });

  it('the same count eats more when the units are heavier, and more with count', () => {
    const light = withArmy(onMap(1), [['swordsman', 10]]);
    const heavy = withArmy(onMap(1), [['knight', 10]]);
    const bigger = withArmy(onMap(1), [['swordsman', 20]]);
    expect(dailyUpkeep(heavy)).toBeGreaterThan(dailyUpkeep(light));
    expect(dailyUpkeep(bigger)).toBeGreaterThan(dailyUpkeep(light));
  });

  // Balance targets (director follow-up): Food stays pressure, and a Farm lets the player answer it.
  const MID = [['swordsman', 13], ['archer', 9], ['knight', 8], ['priest', 8]] as Array<[UnitId, number]>; // 38 units
  const BIG = [['swordsman', 20], ['archer', 14], ['knight', 14], ['priest', 12]] as Array<[UnitId, number]>; // 60 units
  const net = (run: RunState, tier: 0 | 1 | 2 | 3 | 4 | 5) => dailyFoodNet(withFarm(run, tier));

  it('(1) a starting army, with or without Royal Banner, lasts at least 15 days on the starting Food with no Farm and no loot', () => {
    for (const hero of ['warlord', 'rogue', 'mage'] as const) {
      const fresh = createRun(2, hero);
      const bannered = onMap(2, hero);
      expect(fresh.army.reduce((n, s) => n + s.count, 0)).toBe(8);
      for (const run of [fresh, bannered]) expect(foodDaysLeft(run)).toBeGreaterThanOrEqual(15);
      expect(foodDaysLeft(fresh)).toBeGreaterThanOrEqual(25);
    }
  });

  it('(2) Farm tier I covers a starting-size army, including one with Royal Banner', () => {
    for (const hero of ['warlord', 'rogue', 'mage'] as const) expect(net(onMap(2, hero), 1)).toBeGreaterThanOrEqual(0);
  });

  it('(3) Farm tier III balances a 38-unit army and leaves a 60-unit army within -8 Food a day', () => {
    const mid = withArmy(onMap(2), MID);
    const big = withArmy(onMap(2), BIG);
    expect(mid.army.reduce((n, s) => n + s.count, 0)).toBe(38);
    expect(big.army.reduce((n, s) => n + s.count, 0)).toBe(60);
    expect(net(mid, 3)).toBeGreaterThanOrEqual(0);
    expect(net(mid, 2)).toBeLessThan(0);
    expect(net(big, 3)).toBeGreaterThanOrEqual(-8);
    expect(net(big, 3)).toBeLessThan(0);
  });

  it('a move costs exactly the daily upkeep', () => {
    const run = onMap(3);
    const moved = step(run).run;
    expect(run.food - moved.food).toBe(dailyUpkeep(run));
    expect(moved.stats.foodEaten).toBe(dailyUpkeep(run));
  });

  it('Stable still cuts the cost by 25%, rounded down, minimum 1', () => {
    const run = withArmy(onMap(3), [['knight', 16]]);
    expect(moveFoodCost(run.army)).toBe(8);
    expect(moveFoodCost(run.army, { ...run.city, buildings: ['stable'] })).toBe(6);
    const big = withArmy(onMap(3), BIG);
    expect(moveFoodCost(big.army, { ...big.city, buildings: ['stable'] })).toBeLessThan(moveFoodCost(big.army));
    const tiny = withArmy(onMap(3), [['swordsman', 1]]);
    expect(moveFoodCost(tiny.army, { ...tiny.city, buildings: ['stable'] })).toBe(1);
  });
});

describe('AO-D048: Farm', () => {
  const atCity = (gold: number): RunState => ({ ...act(onMap(4), { type: 'TRAVEL_TO_CITY' }).run, gold });

  it('tiers are cumulative +3/+6/+9/+11/+13 Food per day for 60/140/320/560/900 Gold in one slot', () => {
    expect(FARM_TIERS.map((t) => t.food)).toEqual([3, 6, 9, 11, 13]);
    expect(FARM_TIERS.map((t) => t.cost)).toEqual([60, 140, 320, 560, 900]);
    let run = atCity(3000);
    run = act(run, { type: 'BUILD_BUILDING', buildingId: 'farm' }).run;
    expect(run.city.farmTier).toBe(1);
    expect(run.gold).toBe(2940);
    expect(dailyProduction(run)).toBe(3);
    run = act(run, { type: 'UPGRADE_FARM' }).run;
    expect(run.city.farmTier).toBe(2);
    expect(run.gold).toBe(2800);
    expect(dailyProduction(run)).toBe(6);
    const t3 = act(run, { type: 'UPGRADE_FARM' });
    expect(t3.events.some((e) => e.type === 'FARM_UPGRADED' && e.tier === 3)).toBe(true);
    run = t3.run;
    expect(run.gold).toBe(2480);
    expect(dailyProduction(run)).toBe(9);
    run = act(run, { type: 'UPGRADE_FARM' }).run;
    run = act(run, { type: 'UPGRADE_FARM' }).run;
    expect(run.city.farmTier).toBe(5);
    expect(run.gold).toBe(2480 - 560 - 900);
    expect(dailyProduction(run)).toBe(13);
    expect(run.city.buildings.filter((b) => b === 'farm')).toHaveLength(1);
    expect(rejected(act(run, { type: 'UPGRADE_FARM' }).events)).toBe(true);
  });

  it('cannot be upgraded before it is built, without Gold, or outside the city', () => {
    expect(rejected(act(atCity(1000), { type: 'UPGRADE_FARM' }).events)).toBe(true);
    const built = withFarm(atCity(100), 1);
    expect(rejected(act(built, { type: 'UPGRADE_FARM' }).events)).toBe(true);
    expect(built.city.farmTier).toBe(1);
    expect(rejected(act({ ...built, gold: 1000, phase: 'on_map' }, { type: 'UPGRADE_FARM' }).events)).toBe(true);
  });

  it('descriptions state the real numbers', () => {
    expect(BUILDING_DEFINITIONS.farm!.cost).toBe(60);
    expect(farmDescription(0)).toContain('+3 Food every day');
    expect(farmDescription(0)).toContain('+13');
    expect(farmDescription(1)).toContain('Tier I');
    expect(farmDescription(1)).toContain('140 Gold');
    expect(farmDescription(2)).toContain('+9 total');
    expect(farmDescription(2)).toContain('320 Gold');
    expect(farmDescription(4)).toContain('900 Gold');
    expect(farmDescription(5)).toContain('Tier V');
    expect(farmDescription(5)).toContain('Max tier');
  });

  it('produces Food on every move through the daily hook and reports it in DAILY_INCOME', () => {
    const run = withFarm(onMap(5), 2);
    const result = step(run);
    expect(result.run.food).toBe(run.food + 6 - dailyUpkeep(run));
    expect(result.events).toContainEqual({ type: 'DAILY_INCOME', gold: 0, food: 6 });
    expect(result.run.stats.foodGathered).toBe(6);
  });

  it('production is added before the army eats, so a Farm can stop this day starving', () => {
    const upkeep = dailyUpkeep(onMap(5));
    const starving = step({ ...onMap(5), food: upkeep - 1 });
    expect(starving.events.some((e) => e.type === 'STARVED')).toBe(true);
    const fed = step({ ...withFarm(onMap(5), 1), food: upkeep - 1 });
    expect(fed.events.some((e) => e.type === 'STARVED')).toBe(false);
    expect(fed.run.starvationDays).toBe(0);
  });

  it('Gold Mine and Farm both show up in one DAILY_INCOME event', () => {
    const run = withFarm({ ...onMap(5), city: { ...onMap(5).city, buildings: ['gold_mine'] } }, 1);
    expect(step(run).events).toContainEqual({ type: 'DAILY_INCOME', gold: 10, food: 3 });
  });

  it('a save from before the Farm migrates to no Farm', () => {
    const { farmTier: _f, ...oldCity } = onMap(6).city;
    const migrated = migrateRun({ ...onMap(6), city: oldCity } as unknown as RunState);
    expect(migrated.city.farmTier).toBe(0);
  });
});

describe('AO-D048: net Food and the warning', () => {
  it('net = Farm production - upkeep; the warning shows when Food runs out within 3 days', () => {
    const run = onMap(7);
    const upkeep = dailyUpkeep(run);
    expect(dailyFoodNet(run)).toBe(-upkeep);
    expect(dailyFoodNet(withFarm(run, 3))).toBe(9 - upkeep);

    const safe = { ...run, food: upkeep * FOOD_WARNING_DAYS };
    expect(foodDaysLeft(safe)).toBe(FOOD_WARNING_DAYS);
    expect(foodWarning(safe)).toBe(false);
    expect(foodWarning({ ...safe, food: safe.food - 1 })).toBe(true);
    expect(foodWarning({ ...run, food: 0 })).toBe(true);
  });

  it('never warns while production covers the upkeep', () => {
    const run = withArmy(onMap(7), [['swordsman', 5]]); // 1 Food a day
    expect(foodWarning({ ...withFarm(run, 1), food: 0 })).toBe(false);
    expect(foodDaysLeft(withFarm(run, 1))).toBe(Infinity);
  });

  it('the warning agrees with reality: the first starving move happens exactly when foodDaysLeft runs out', () => {
    let run = { ...onMap(7), food: 14 };
    const upkeep = dailyUpkeep(run);
    const safeDays = foodDaysLeft(run);
    expect(safeDays).toBe(Math.floor(14 / upkeep));
    for (let i = 0; i < safeDays; i++) {
      run = step(run).run;
      expect(run.starvationDays).toBe(0);
    }
    run = step(run).run;
    expect(run.starvationDays).toBe(1);
  });

  it('the foodWarning also stays on while the army is already starving', () => {
    const run = withFarm(withArmy(onMap(7), [['swordsman', 5]]), 1);
    expect(foodWarning({ ...run, food: 0 })).toBe(false);
    expect(foodWarning({ ...run, food: 0, starvationDays: 1 })).toBe(true);
  });
});

describe('AO-D053: battle loot', () => {
  const ctx = { chapter: 1, day: 1, elite: false, threat: 0 };
  const expectedGold = (b: ReturnType<typeof battleLootBands>) => (b.gold[0] + b.gold[1]) / 2;
  const expectedFood = (b: ReturnType<typeof battleLootBands>) => b.foodChance * ((b.food[0] + b.food[1]) / 2);

  it('a won battle pays Gold and maybe Food through the run RNG, reports it, and updates the gathered stats', () => {
    const run = onMap(9);
    const result = winBattle(run);
    const loot = result.events.find((e) => e.type === 'BATTLE_LOOT');
    expect(loot).toBeDefined();
    if (loot?.type !== 'BATTLE_LOOT') throw new Error('unreachable');
    const bands = battleLootBands({ ...ctx, day: result.run.day });
    expect(loot.gold).toBeGreaterThanOrEqual(bands.gold[0]);
    expect(loot.gold).toBeLessThanOrEqual(bands.gold[1]);
    expect(loot.food === 0 || (loot.food >= bands.food[0] && loot.food <= bands.food[1])).toBe(true);
    const upkeep = dailyUpkeep(run);
    expect(result.run.gold).toBe(run.gold + loot.gold);
    expect(result.run.food).toBe(run.food - upkeep + loot.food);
    expect(result.run.stats.goldGathered).toBe(loot.gold);
    expect(result.run.stats.foodGathered).toBe(loot.food);
    expect(result.run.phase).toBe('reward');
  });

  it('is deterministic for the same run and action sequence', () => {
    const a = winBattle(onMap(10)).events.find((e) => e.type === 'BATTLE_LOOT');
    const b = winBattle(onMap(10)).events.find((e) => e.type === 'BATTLE_LOOT');
    expect(a).toEqual(b);
  });

  it('Food is not guaranteed: across seeds it sometimes drops and sometimes does not, at roughly the configured chance', () => {
    let drops = 0;
    const n = 400;
    for (let seed = 0; seed < n; seed++) {
      const loot = rollBattleLoot(createRng(seed), ctx);
      expect(loot.gold).toBeGreaterThan(0);
      if (loot.food > 0) drops += 1;
    }
    expect(drops).toBeGreaterThan(0);
    expect(drops).toBeLessThan(n);
    expect(Math.abs(drops / n - BATTLE_LOOT.chapters[0]!.foodChance)).toBeLessThan(0.08);
  });

  it('always consumes the same number of rolls, so a Food miss does not shift later randomness', () => {
    const marks = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      rollBattleLoot(rng, ctx);
      const ref = createRng(seed);
      for (let i = 0; i < 3; i++) ref.seed = (ref.seed + 0x6d2b79f5) >>> 0;
      expect(rng.seed).toBe(ref.seed);
      marks.add(rng.seed);
    }
    expect(marks.size).toBeGreaterThan(1);
  });

  it('improves with the chapter and the day, and elite and boss fights pay more', () => {
    const early = battleLootBands(ctx);
    const late = battleLootBands({ ...ctx, day: 29 });
    const ch2 = battleLootBands({ ...ctx, chapter: 2, day: 31 });
    const ch3 = battleLootBands({ ...ctx, chapter: 3, day: 61 });
    const elite = battleLootBands({ ...ctx, elite: true });
    expect(expectedGold(late)).toBeGreaterThan(expectedGold(early));
    expect(late.foodChance).toBeGreaterThan(early.foodChance);
    expect(expectedGold(ch2)).toBeGreaterThan(expectedGold(late));
    expect(expectedGold(ch3)).toBeGreaterThan(expectedGold(ch2));
    expect(expectedFood(ch3)).toBeGreaterThan(expectedFood(ch2));
    expect(expectedFood(ch2)).toBeGreaterThan(expectedFood(early));
    expect(expectedGold(elite)).toBeGreaterThan(expectedGold(early));
    expect(elite.foodChance).toBeGreaterThan(early.foodChance);
    expect(battleLootBands({ ...ctx, threat: 5 }).gold[1]).toBeGreaterThan(early.gold[1]);
    expect(battleLootBands({ ...ctx, elite: true, chapter: 3, day: 89 }).foodChance).toBeLessThanOrEqual(BATTLE_LOOT.maxFoodChance);
  });

  it('an elite victory rolls elite-band loot', () => {
    const result = winBattle(onMap(11), 'elite_battle');
    const loot = result.events.find((e) => e.type === 'BATTLE_LOOT');
    const bands = battleLootBands({ ...ctx, day: result.run.day, elite: true });
    if (loot?.type !== 'BATTLE_LOOT') throw new Error('no loot event');
    expect(loot.gold).toBeGreaterThanOrEqual(bands.gold[0]);
    expect(loot.gold).toBeLessThanOrEqual(bands.gold[1]);
  });
});
