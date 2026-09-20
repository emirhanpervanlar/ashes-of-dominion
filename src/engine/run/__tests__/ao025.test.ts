import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import { createRng } from '../../rng.js';
import type { CombatState, UnitId } from '../../types.js';
import { FARM_TIERS } from '../city.js';
import { STARVATION, dailyFoodNet, dailyUpkeep, foodWarning, starvationForecast, starvationLossRate, starvationMoraleMalus, starveArmy, totalArmyCount } from '../food.js';
import { daysUntilBoss } from '../chapters.js';
import { EVENT_DEFINITIONS } from '../events.js';
import { applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);

function onMap(seed = 1): RunState {
  return createRun(seed);
}

type Slot = 1 | 2 | 3 | 4 | 5 | 6;
function withArmy(run: RunState, counts: Array<[UnitId, number]>): RunState {
  return { ...run, army: counts.map(([unitId, count], i) => createStack(unitId, 'player', (i + 1) as Slot, count)) };
}

const SMALL: Array<[UnitId, number]> = [['swordsman', 6], ['archer', 2]]; // 8 units
const MID: Array<[UnitId, number]> = [['swordsman', 13], ['archer', 9], ['knight', 8], ['priest', 8]]; // 38 units
const BIG: Array<[UnitId, number]> = [['swordsman', 20], ['archer', 14], ['knight', 14], ['priest', 12]]; // 60 units

function step(run: RunState, type: NodeType = 'start') {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return act({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId });
}

/** Starves a fresh army for `days` consecutive days at a full shortage, through the same function the day tick uses. */
function starveFor(counts: Array<[UnitId, number]>, days: number, seed: number): number[] {
  let army = withArmy(onMap(), counts).army;
  const rng = createRng(seed);
  const alive: number[] = [];
  for (let day = 1; day <= days; day++) {
    army = starveArmy(army, rng, 1, day).army;
    alive.push(totalArmyCount(army));
  }
  return alive;
}

describe('AO-D057: starvation loss model', () => {
  it('a bigger shortage kills a bigger share (80% shortage > 10%)', () => {
    expect(starvationLossRate(0.1, 1)).toBeCloseTo(0.048);
    expect(starvationLossRate(1, 1)).toBeCloseTo(0.12);
    expect(starvationLossRate(0.8, 1)).toBeGreaterThan(starvationLossRate(0.1, 1) * 2);
    const rng = () => createRng(3);
    const army = withArmy(onMap(), BIG).army;
    expect(starveArmy(army, rng(), 0.8, 1).deaths.reduce((n, d) => n + d.count, 0)).toBeGreaterThan(starveArmy(army, rng(), 0.1, 1).deaths.reduce((n, d) => n + d.count, 0));
  });

  it('escalates linearly with each consecutive starving day and stops at the cap', () => {
    const rates = [1, 2, 3, 4, 5].map((d) => starvationLossRate(1, d));
    expect(rates[1]! / rates[0]!).toBeCloseTo(1 + STARVATION.escalationGrowth);
    expect(rates[2]! / rates[0]!).toBeCloseTo(1 + 2 * STARVATION.escalationGrowth);
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeGreaterThan(rates[i - 1]!);
    expect(starvationLossRate(1, 50)).toBe(STARVATION.lossCap);
  });

  it('always kills at least 1 while there is a deficit, but never the last unit', () => {
    const army = withArmy(onMap(), [['swordsman', 3]]).army;
    expect(starveArmy(army, createRng(1), 0.01, 1).deaths[0]!.count).toBe(1);
    const lone = withArmy(onMap(), [['swordsman', 1]]).army;
    expect(starveArmy(lone, createRng(1), 1, 9).deaths).toEqual([]);
    expect(totalArmyCount(starveArmy(army, createRng(1), 1, 99).army)).toBeGreaterThanOrEqual(1);
  });

  it('deaths are random, deterministic per seed, and spread across stacks', () => {
    const army = withArmy(onMap(), BIG).army;
    const run = (seed: number) => starveArmy(army, createRng(seed), 1, 4);
    expect(run(7)).toEqual(run(7));
    expect(run(7).deaths).not.toEqual(run(8).deaths);
    expect(run(7).deaths.length).toBeGreaterThan(1); // 30% of 60 units cannot come from one stack
    const totalLost = run(7).deaths.reduce((n, d) => n + d.count, 0);
    expect(totalLost).toBe(Math.ceil(starvationLossRate(1, 4) * 60));
    expect(totalArmyCount(run(7).army)).toBe(60 - totalLost);
  });

  it('empties the stockpile instead of cutting the army down to what the Food can feed', () => {
    const run = { ...withArmy(onMap(), BIG), food: 20 };
    expect(dailyUpkeep(run)).toBe(14);
    const short = { ...run, food: 6 }; // need 14, have 6: deficit 8/14
    const result = step(short);
    const dead = 60 - totalArmyCount(result.run.army);
    expect(result.run.food).toBe(0);
    expect(dead).toBe(Math.ceil(starvationLossRate(8 / 14, 1) * 60));
    expect(dead).toBeLessThan(15); // "cut to the upkeep" would leave ~26 of 60 alive
    expect(result.run.starvationDays).toBe(1);
    const event = result.events.find((e) => e.type === 'STARVED');
    expect(event).toMatchObject({ type: 'STARVED', consecutiveDays: 1, day: short.day + 1 });
    expect(event?.type === 'STARVED' && event.deaths.reduce((n, d) => n + d.count, 0)).toBe(dead);
    expect(result.run.stats.unitsLost).toBe(dead);
  });

  it('consecutive days escalate through the day tick and the first fed day resets the streak', () => {
    let run: RunState = { ...withArmy(onMap(2), MID), food: 0 };
    const losses: number[] = [];
    for (let day = 1; day <= 3; day++) {
      const before = totalArmyCount(run.army);
      run = step(run).run;
      expect(run.starvationDays).toBe(day);
      losses.push((before - totalArmyCount(run.army)) / before);
    }
    expect(losses[1]!).toBeGreaterThan(losses[0]! - 0.03);
    expect(losses[2]!).toBeGreaterThan(losses[0]!);
    const fed = step({ ...run, food: 200 }).run;
    expect(fed.starvationDays).toBe(0);
    expect(step({ ...fed, food: 0 }).run.starvationDays).toBe(1);
  });

  it('a Farm covering the day keeps the streak at 0', () => {
    const base = withArmy(onMap(3), SMALL);
    const run = { ...base, city: { ...base.city, farmTier: 1 as const, buildings: ['farm'] }, food: 0 };
    expect(dailyFoodNet(run)).toBeGreaterThanOrEqual(0);
    expect(step(run).run.starvationDays).toBe(0);
  });

  it('starvation stays inside the run RNG: same run + same action = same deaths', () => {
    const run = { ...withArmy(onMap(4), MID), food: 0 };
    expect(step(run).run.army).toEqual(step(run).run.army);
  });

  it('starvationForecast reports whether and how hard the next day would starve', () => {
    const run = withArmy(onMap(5), BIG);
    expect(starvationForecast({ ...run, food: 500, starvationDays: 0 })).toMatchObject({ willStarve: false, shortageRatio: 0, consecutiveDays: 0, moraleMalus: 0 });
    const hungry = starvationForecast({ ...run, food: 7, starvationDays: 0 });
    expect(hungry.willStarve).toBe(true);
    expect(hungry.shortageRatio).toBeCloseTo(0.5);
    expect(hungry.lossShare).toBeCloseTo(starvationLossRate(0.5, 1));
    expect(hungry.expectedDeaths).toBe(Math.ceil(hungry.lossShare * 60));
    const streak = starvationForecast({ ...run, food: 0, starvationDays: 2 });
    expect(streak.lossShare).toBeCloseTo(starvationLossRate(1, 3));
    expect(streak.moraleMalusIfStarves).toBe(STARVATION.moraleBase);
  });

  it('foodWarning warns before a shortage starts and while starving', () => {
    const run = { ...withArmy(onMap(6), MID), starvationDays: 0 };
    expect(foodWarning({ ...run, food: dailyUpkeep(run) * 10 })).toBe(false);
    expect(foodWarning({ ...run, food: dailyUpkeep(run) * 2 })).toBe(true);
    expect(foodWarning({ ...run, food: 999, starvationDays: 1 })).toBe(true);
  });

  it('a save from before AO-D057 migrates to a 0 starvation streak', () => {
    const { starvationDays: _s, saveVersion: _v, ...old } = onMap(7);
    expect(migrateRun(old as unknown as RunState).starvationDays).toBe(0);
  });
});

describe('AO-D057: starvation Morale', () => {
  it('malus starts after 3 consecutive starving days, then grows and is capped', () => {
    expect(starvationMoraleMalus(0)).toBe(0);
    expect(starvationMoraleMalus(STARVATION.moraleAfterDays - 1)).toBe(0);
    expect(starvationMoraleMalus(3)).toBe(10);
    expect(starvationMoraleMalus(4)).toBe(18);
    expect(starvationMoraleMalus(5)).toBe(26);
    expect(starvationMoraleMalus(99)).toBe(STARVATION.moraleMax);
  });

  const battleAfter = (days: number) => {
    const run = { ...withArmy(onMap(8), BIG), food: 1000, starvationDays: days };
    return step(run, 'battle');
  };

  it('the battle army starts with the malus while the run army keeps full Morale, and it is gone after a fed day resets the streak', () => {
    const fighting = battleAfter(3); // the move itself is fed, so the streak is reset before the fight
    expect(fighting.run.starvationDays).toBe(0);
    expect(fighting.run.combat!.playerArmy.every((s) => s.morale === 100)).toBe(true);

    const starving = step({ ...withArmy(onMap(8), BIG), food: 0, starvationDays: 2 }, 'battle').run; // 3rd starving day
    expect(starving.starvationDays).toBe(3);
    expect(starving.phase).toBe('in_battle');
    expect(starving.combat!.playerArmy.every((s) => s.morale === 100 - 10)).toBe(true);
    expect(starving.army.every((s) => s.morale === 100)).toBe(true);

    const second = step({ ...withArmy(onMap(8), BIG), food: 0, starvationDays: 1 }, 'battle').run; // only the 2nd starving day
    expect(second.combat!.playerArmy.every((s) => s.morale === 100)).toBe(true);

    const later = step({ ...withArmy(onMap(8), BIG), food: 0, starvationDays: 4 }, 'battle').run;
    expect(later.combat!.playerArmy.every((s) => s.morale === 100 - 26)).toBe(true);
  });

  it('winning the battle does not bake the malus into the run army', () => {
    const fighting = step({ ...withArmy(onMap(9), BIG), food: 0, starvationDays: 3 }, 'battle').run;
    const won: CombatState = { ...fighting.combat!, enemyArmy: fighting.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    const after = act({ ...fighting, combat: won }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(after.army.length).toBeGreaterThan(0);
    expect(after.army.every((s) => s.morale === 100)).toBe(true);
  });
});

describe('AO-D058: Farm tiers and the balance table', () => {
  const eatStable = (counts: Array<[UnitId, number]>, tier: number, stable: boolean) => {
    const run = withArmy(onMap(), counts);
    return dailyFoodNet({ ...run, city: { ...run.city, farmTier: tier as 0, buildings: stable ? ['stable'] : [] } });
  };

  it('has 5 strictly rising tiers: tier I covers the start, III a 38-unit army, IV a 60-unit army with a Stable, V a 60-unit army almost without one', () => {
    expect(FARM_TIERS).toHaveLength(5);
    for (let i = 1; i < 5; i++) {
      expect(FARM_TIERS[i]!.food).toBeGreaterThan(FARM_TIERS[i - 1]!.food);
      expect(FARM_TIERS[i]!.cost).toBeGreaterThan(FARM_TIERS[i - 1]!.cost);
    }
    expect(eatStable(SMALL, 1, false)).toBeGreaterThanOrEqual(0);
    expect(eatStable(MID, 3, false)).toBeGreaterThanOrEqual(0);
    expect(eatStable(MID, 2, false)).toBeLessThan(0);
    expect(eatStable(BIG, 3, false)).toBeLessThan(0);
    expect(eatStable(BIG, 4, true)).toBeGreaterThanOrEqual(0);
    expect(eatStable(BIG, 3, true)).toBeLessThan(0);
    expect(eatStable(BIG, 5, true)).toBeGreaterThan(0);
    expect(eatStable(BIG, 5, false)).toBeGreaterThanOrEqual(-2);
  });

  it('prints the balance table: survivors after N consecutive fully starving days from 0 Food, Morale malus, and Farm coverage', () => {
    const lines: string[] = [];
    const SEEDS = 300;
    lines.push('units | day: survivors (mean of ' + SEEDS + ' seeds; seed 1 in brackets) | morale malus');
    for (const [name, counts] of [['8', SMALL], ['38', MID], ['60', BIG]] as const) {
      const total = counts.reduce((n, [, c]) => n + c, 0);
      const sums = [0, 0, 0, 0, 0];
      for (let seed = 1; seed <= SEEDS; seed++) starveFor(counts, 5, seed).forEach((n, i) => (sums[i]! += n));
      const single = starveFor(counts, 5, 1);
      lines.push(`${name.padStart(5)} | ` + sums.map((s, i) => `d${i + 1}: ${(s / SEEDS).toFixed(1)} [${single[i]}]`).join('  ') + ` | ${[1, 2, 3, 4, 5].map((d) => starvationMoraleMalus(d)).join('/')}  (of ${total})`);
    }
    lines.push('Starving day: Morale malus -> damage x / defence x');
    for (let d = 1; d <= 10; d++) {
      const m = Math.max(0, 100 - starvationMoraleMalus(d));
      lines.push(`  d${d}: -${starvationMoraleMalus(d)} -> x${(0.7 + m * 0.003).toFixed(3)} / x${(0.85 + m * 0.0015).toFixed(3)}`);
    }
    lines.push('Farm tier: cost, Food/day; net Food/day for 8 / 38 / 60 units without and with Stable');
    FARM_TIERS.forEach((t, i) => {
      const cells = [SMALL, MID, BIG].map((c) => `${eatStable(c, i + 1, false)}/${eatStable(c, i + 1, true)}`);
      lines.push(`  ${['I', 'II', 'III', 'IV', 'V'][i]}: ${t.cost}g, +${t.food}; ${cells.join('  ')}`);
    });
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe('AO-025 4b: event day costs are upkeep payments', () => {
  const atEvent = (eventId: string, food: number): RunState => ({ ...onMap(10), phase: 'event', food, pendingEvent: { eventId, choice: null, resolved: null } });
  const choose = (run: RunState, optionId: string) => act(run, { type: 'CHOOSE_EVENT_OPTION', optionId });

  it('Wait out the fog eats one day of food and does not move the calendar', () => {
    const run = atEvent('fogbound_ford', 100);
    const waited = choose(run, 'wait').run;
    expect(waited.day).toBe(run.day);
    expect(waited.food).toBe(100 - dailyUpkeep(run));
    expect(waited.starvationDays).toBe(0);
  });

  it('Join the hunt does not move the calendar either, and event texts say food, not days', () => {
    const run = { ...atEvent('hunters_lodge', 10), army: withArmy(onMap(), [['swordsman', 6], ['archer', 2]]).army };
    const joined = choose(run, 'join_hunt').run;
    expect(joined.day).toBe(run.day);
    const texts = [EVENT_DEFINITIONS.hunters_lodge!, EVENT_DEFINITIONS.fogbound_ford!, EVENT_DEFINITIONS.bandit_toll!].flatMap((e) => e.options((n) => n).map((o) => o.description));
    expect(texts.some((t) => /day of food|days of food/.test(t))).toBe(true);
    expect(texts.some((t) => /\+\d+ day\b/.test(t))).toBe(false);
  });

  it('a shortfall applies the starvation model to the shortage only', () => {
    const base = withArmy(atEvent('bandit_toll', 0), BIG);
    const need = 2 * dailyUpkeep(base);
    const short = { ...base, food: need - 7 };
    const refused = choose(short, 'refuse').run;
    expect(refused.food).toBe(0);
    expect(refused.starvationDays).toBe(1);
    expect(totalArmyCount(refused.army)).toBeLessThan(60);
    const paid = choose({ ...base, food: need }, 'refuse').run;
    expect(paid.food).toBe(0);
    expect(paid.starvationDays).toBe(0);
    expect(totalArmyCount(paid.army)).toBe(60);
  });

  it('daysUntilBoss never goes negative', () => {
    expect(daysUntilBoss({ chapter: 1, day: 45 })).toBe(0);
    expect(daysUntilBoss({ chapter: 1, day: 10 })).toBe(20);
  });
});
