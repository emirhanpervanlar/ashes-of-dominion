import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import type { CombatState } from '../../types.js';
import { UNIT_DEFINITIONS } from '../../data/units.js';
import { nextCityVisitRaisesThreat } from '../chapters.js';
import { BARRACKS_TIERS, FARM_TIERS } from '../city.js';
import { dailyProduction, dailyUpkeep } from '../food.js';
import { BATTLE_LOOT, battleLootBands, rollBattleLoot } from '../loot.js';
import { garrisonCap, garrisonUnits, weeklyGarrison } from '../garrison.js';
import { FOOD_MARKET, foodMarketQuote, foodPackPrice } from '../marketplace.js';
import { buildPendingReward } from '../rewards.js';
import { CURRENT_SAVE_VERSION, STARTING_GOLD, applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';
import { validateSave } from '../save.js';
import { VILLAGE, villageOffer } from '../villages.js';
import { NODE_WEIGHTS, generateWorldMap } from '../worldMap.js';
import { withBarracks } from './cityHelpers.js';
import { pickReward } from './rewardHelpers.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);
const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');
const reason = (events: { type: string }[]) => (events.find((e) => e.type === 'ACTION_REJECTED') as { reason: string } | undefined)?.reason;
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A run standing at a fresh node of `type` one step from the current one, arrived and (for fights) in battle. */
function arriveAt(run: RunState, type: NodeType): RunState {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return act({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

function winFight(fighting: RunState): RunState {
  const combat = fighting.combat!;
  const won: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return act({ ...fighting, combat: won }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

describe('AO-046 item 1 (AO-D068): the reward cannot be skipped', () => {
  it('always offers at least 2 new cards, also when nothing in the deck can be upgraded', () => {
    const deck = createRun(1).masterDeck.map((c) => ({ ...c, upgraded: true }));
    for (let seed = 1; seed <= 30; seed++) {
      const reward = buildPendingReward(createRng(seed), [], deck, false);
      expect(reward.upgradeOptions).toHaveLength(0);
      expect(reward.cardOptions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('SKIP_REWARD no longer exists and REMOVE_CARD is refused on the reward screen', () => {
    const won = winFight(arriveAt(createRun(3), 'battle'));
    expect(won.phase).toBe('reward');
    expect(rejected(act(won, { type: 'SKIP_REWARD' } as unknown as RunAction).events)).toBe(true);
    const removal = act(won, { type: 'REMOVE_CARD', instanceId: won.masterDeck[0]!.instanceId });
    expect(rejected(removal.events)).toBe(true);
    expect(removal.run.phase).toBe('reward');
  });

  it('an elite win grants the relic at once (one RELIC_CLAIMED with the id stored as relicGained); a boss win still offers a choice', () => {
    const elite = arriveAt(createRun(5), 'fort');
    const won = winFight(elite);
    const id = won.pendingReward!.relicGained!;
    expect(won.relics.map((r) => r.id)).toContain(id);
    expect(won.log.filter((e) => e.type === 'RELIC_CLAIMED' && e.relicId === id)).toHaveLength(1);

    const boss = winFight(arriveAt({ ...createRun(5), day: 29 }, 'boss'));
    expect(boss.pendingReward!.relicGained).toBeNull();
    expect(boss.pendingReward!.relicChoices).toHaveLength(3);
  });

  it('a version-2 save waiting on the old elite relic offer is granted that relic when it loads', () => {
    const run = createRun(6);
    const legacy = { ...roundTrip(run), saveVersion: 2, phase: 'reward', pendingReward: { cardOptions: ['charge'], upgradeOptions: [], relicOffer: 'arcane_crystal', relicChoices: [] } };
    const migrated = validateSave(legacy)!;
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.relics.map((r) => r.id)).toContain('arcane_crystal');
    expect(migrated.pendingReward).toEqual({ cardOptions: ['charge'], upgradeOptions: [], relicGained: 'arcane_crystal', relicChoices: [] });
    expect(migrateRun(migrated)).toBe(migrated);
  });
});

describe('AO-046 item 2 (AO-D070): free city visits', () => {
  const visit = (run: RunState): RunState => act(act(run, { type: 'TRAVEL_TO_CITY' }).run, { type: 'LEAVE_CITY' }).run;

  it('the first visit of the run is free, later ones raise Threat, and the helper tells the UI in advance', () => {
    let run = createRun(7);
    expect(nextCityVisitRaisesThreat(run)).toBe(false);
    run = visit(run);
    expect([run.threat, run.cityVisitsThisChapter]).toEqual([0, 1]);
    expect(nextCityVisitRaisesThreat(run)).toBe(true);
    run = visit(run);
    run = visit(run);
    expect([run.threat, run.cityVisitsThisChapter]).toEqual([2, 3]);
  });

  it('the first visit of every new chapter is free again (counter reset on CHAPTER_STARTED)', () => {
    let run = visit(visit(createRun(8)));
    expect(run.threat).toBe(1);
    const boss = winFight(arriveAt({ ...run, day: 29 }, 'boss'));
    const started = pickReward(boss);
    expect(started.events.some((e) => e.type === 'CHAPTER_STARTED')).toBe(true);
    run = started.run;
    expect(run.cityVisitsThisChapter).toBe(0);
    expect(nextCityVisitRaisesThreat(run)).toBe(false);
    expect(visit(run).threat).toBe(1);
    expect(visit(visit(run)).threat).toBe(2);
  });

  it('old saves: a run that carries Threat counts as having visited; one without does not', () => {
    const fresh = roundTrip({ ...createRun(9), saveVersion: 2 }) as unknown as Record<string, unknown>;
    delete fresh.cityVisitsThisChapter;
    expect(validateSave(fresh)!.cityVisitsThisChapter).toBe(0);
    expect(validateSave({ ...fresh, threat: 3 })!.cityVisitsThisChapter).toBe(1);
  });
});

describe('AO-046 item 3 (AO-D071): recruiting at any city visit', () => {
  /** Walks `days` resource nodes forward so the run is on that day, then visits the city. */
  function cityOnDay(seed: number, days: number): RunState {
    let run = createRun(seed);
    for (let i = 0; i < days; i++) run = arriveAt(run, 'mine');
    return act(withBarracks(run), { type: 'TRAVEL_TO_CITY' }).run;
  }

  it('there is no time or per-visit rule: every unit can be recruited on every day of the chapter and at every visit', () => {
    for (const day of [0, 1, 6, 7, 8, 13, 14, 15, 21, 22, 28]) {
      const city = cityOnDay(4, day);
      expect(city.day).toBe(1 + day);
      for (const unitId of ['swordsman', 'archer', 'knight', 'priest'] as const) {
        expect(rejected(act(city, { type: 'RECRUIT', unitId, count: 2 }).events), `${unitId} on day ${city.day}`).toBe(false);
      }
    }
    let run = withBarracks(createRun(4));
    for (let visit = 1; visit <= 6; visit++) {
      run = act(act(run, { type: 'TRAVEL_TO_CITY' }).run, { type: 'RECRUIT', unitId: 'swordsman', count: 1 }).run;
      run = act(run, { type: 'LEAVE_CITY' }).run;
      expect(run.stats.unitsRecruited, `visit ${visit}`).toBe(visit);
    }
  });

  it('the only gates are Gold, Food (every recruit also costs Food) and the 6-stack cap, and each rejection names itself', () => {
    const city = cityOnDay(4, 3);
    const broke = act({ ...city, gold: 0 }, { type: 'RECRUIT', unitId: 'swordsman', count: 1 });
    expect(reason(broke.events)).toBe('Not enough Gold.');
    const hungry = act({ ...city, food: 0 }, { type: 'RECRUIT', unitId: 'swordsman', count: 1 });
    expect(reason(hungry.events)).toContain('Not enough Food');

    const kinds = ['swordsman', 'swordsman', 'swordsman', 'archer', 'archer', 'knight'] as const;
    const six = kinds.map((unitId, i) => ({ ...city.army[0]!, stackId: `s${i}`, unitId, position: (i + 1) as 1, count: 3 }));
    const full = { ...city, army: six, gold: 500, food: 500 };
    expect(rejected(act(full, { type: 'RECRUIT', unitId: 'swordsman', count: 1 }).events)).toBe(false); // merges into a stack of its type
    expect(reason(act(full, { type: 'RECRUIT', unitId: 'priest', count: 1 }).events)).toContain('Field army is full');
  });

  it('a stack wiped out in the last battle does not take a slot away from a recruit', () => {
    const base = createRun(12);
    const filler = ['archer', 'priest', 'knight'].map((unitId, i) => ({ ...base.army[0]!, stackId: `f${i}`, unitId: unitId as 'archer', position: (i + 3) as 3, count: 2 }));
    const army = [{ ...base.army[0]!, position: 1 as const }, { ...base.army[1]!, position: 2 as const }, ...filler];
    const fighting = arriveAt({ ...base, army, gold: 500, food: 500 }, 'battle');
    const won = winFight({ ...fighting, combat: { ...fighting.combat!, playerArmy: fighting.combat!.playerArmy.map((s, i) => (i === 0 ? { ...s, count: 0, currentHp: 0 } : s)) } });
    const city = act(withBarracks(pickReward(won).run), { type: 'TRAVEL_TO_CITY' }).run;
    expect(city.army.filter((s) => s.count > 0)).toHaveLength(won.army.filter((s) => s.count > 0).length);
    expect(rejected(act(city, { type: 'RECRUIT', unitId: 'swordsman', count: 3 }).events)).toBe(false);
  });
});

describe('AO-046 item 4 (AO-D071): tiered Barracks and the weekly garrison', () => {
  const inCity = (run: RunState): RunState => ({ ...run, phase: 'city' });
  const walk = (run: RunState, days: number): RunState => {
    let current = run;
    for (let i = 0; i < days; i++) current = arriveAt(current, 'mine');
    return current;
  };
  const withTier = (run: RunState, tier: 0 | 1 | 2 | 3 | 4): RunState => ({ ...run, city: { ...run.city, barracksTier: tier } });

  it('is one building slot at every tier, built for 60 Gold, then 120 / 240 / 480 for tiers II-IV; recruiting is locked until it stands', () => {
    expect(BARRACKS_TIERS.map((t) => t.cost)).toEqual([60, 120, 240, 480]);
    let run = inCity({ ...createRun(20), gold: 2000, food: 500 });
    expect(reason(act(run, { type: 'RECRUIT', unitId: 'swordsman', count: 1 }).events)).toBe('Build the Barracks to recruit.');
    expect(rejected(act(run, { type: 'UPGRADE_BARRACKS' }).events)).toBe(true);

    run = act(run, { type: 'BUILD_BUILDING', buildingId: 'barracks' }).run;
    expect([run.city.barracksTier, run.city.buildings, run.gold]).toEqual([1, ['barracks'], 1940]);
    expect(rejected(act(run, { type: 'BUILD_BUILDING', buildingId: 'barracks' }).events)).toBe(true);
    for (const [tier, cost] of [[2, 120], [3, 240], [4, 480]] as const) {
      const before = run.gold;
      const result = act(run, { type: 'UPGRADE_BARRACKS' });
      run = result.run;
      expect(result.events).toContainEqual({ type: 'BARRACKS_UPGRADED', tier });
      expect([run.city.barracksTier, before - run.gold, run.city.buildings]).toEqual([tier, cost, ['barracks']]);
    }
    expect(rejected(act(run, { type: 'UPGRADE_BARRACKS' }).events)).toBe(true);
    expect(rejected(act({ ...run, city: { ...run.city, barracksTier: 1 }, gold: 100 }, { type: 'UPGRADE_BARRACKS' }).events)).toBe(true);
  });

  it('each tier unlocks exactly one recruitable unit type (I Swordsman, II Archer, III Priest, IV Knight)', () => {
    const base = inCity({ ...createRun(21), gold: 2000, food: 500 });
    const unitOrder = ['swordsman', 'archer', 'priest', 'knight'] as const;
    for (const tier of [0, 1, 2, 3, 4] as const) {
      for (const [i, unitId] of unitOrder.entries()) {
        const result = act(withTier(base, tier), { type: 'RECRUIT', unitId, count: 1 });
        expect(rejected(result.events), `${unitId} at tier ${tier}`).toBe(i >= tier);
      }
    }
    expect(reason(act(withTier(base, 1), { type: 'RECRUIT', unitId: 'knight', count: 1 }).events)).toBe('Knight needs Barracks tier IV.');
  });

  it('the garrison grows every 7th day of the world clock: nothing without a Barracks, weekly units by tier with one', () => {
    const none = walk(createRun(22), 13);
    expect(none.day).toBe(14);
    expect(none.garrison).toEqual({});
    expect(none.log.some((e) => e.type === 'GARRISON_GROWN')).toBe(false);

    const tier1 = walk(withTier(createRun(22), 1), 6);
    expect([tier1.day, tier1.garrison]).toEqual([7, { swordsman: 4 }]);
    expect(tier1.log).toContainEqual({ type: 'GARRISON_GROWN', units: [{ unitId: 'swordsman', count: 4 }] });

    const tier4 = walk(withTier(createRun(22), 4), 6);
    expect(tier4.garrison).toEqual({ swordsman: 4, archer: 3, priest: 2, knight: 1 });
    expect(garrisonUnits(tier4.garrison).map((u) => u.unitId)).toEqual(['swordsman', 'archer', 'priest', 'knight']);
  });

  it('accumulates up to a cap of 2 weeks and reports only what was added', () => {
    let run = walk(withTier(createRun(23), 2), 6);
    expect(run.garrison).toEqual({ swordsman: 4, archer: 3 });
    run = walk(run, 7);
    expect(run.garrison).toEqual({ swordsman: 8, archer: 6 });
    const beforeLog = run.log.length;
    run = walk(run, 7);
    expect(run.garrison).toEqual({ swordsman: 8, archer: 6 });
    expect(run.log.slice(beforeLog).some((e) => e.type === 'GARRISON_GROWN')).toBe(false);
    expect(garrisonCap(run)).toEqual({ swordsman: 8, archer: 6 });
  });

  it('an event that pays days of upkeep does not move the world clock, so it never grows the garrison', () => {
    const run = { ...withTier(createRun(24), 1), day: 6 };
    const paid = act({ ...run, phase: 'event', pendingEvent: { eventId: 'fogbound_ford', choice: null, resolved: null } }, { type: 'CHOOSE_EVENT_OPTION', optionId: 'wait' });
    expect(paid.run.day).toBe(6);
    expect(paid.run.garrison).toEqual({});
  });

  it('COLLECT_GARRISON is free, merges into the same type, takes a free slot for a new one and works only in the city', () => {
    const run = inCity({ ...withTier(createRun(25), 2), garrison: { swordsman: 4, archer: 3 }, gold: 50, food: 50 });
    const sword = run.army.find((s) => s.unitId === 'swordsman')!;
    const all = act(run, { type: 'COLLECT_GARRISON' });
    expect(all.events.filter((e) => e.type === 'GARRISON_COLLECTED')).toEqual([
      { type: 'GARRISON_COLLECTED', unitId: 'swordsman', count: 4 },
      { type: 'GARRISON_COLLECTED', unitId: 'archer', count: 3 },
    ]);
    expect(all.run.garrison).toEqual({});
    expect(all.run.army.find((s) => s.unitId === 'swordsman')!.count).toBe(sword.count + 4);
    expect(all.run.army.find((s) => s.unitId === 'archer')).toMatchObject({ count: 3, currentHp: 3 * UNIT_DEFINITIONS.archer.hpPerUnit });
    expect([all.run.gold, all.run.food]).toEqual([50, 50]);

    const one = act(run, { type: 'COLLECT_GARRISON', unitId: 'archer' });
    expect(one.run.garrison).toEqual({ swordsman: 4 });
    expect(rejected(act({ ...run, phase: 'on_map' }, { type: 'COLLECT_GARRISON' }).events)).toBe(true);
    expect(reason(act({ ...run, garrison: {} }, { type: 'COLLECT_GARRISON' }).events)).toBe('No soldiers are waiting in the garrison.');
    expect(rejected(act(run, { type: 'COLLECT_GARRISON', unitId: 'constructor' as 'archer' }).events)).toBe(true);
    expect(rejected(act(run, { type: 'COLLECT_GARRISON', unitId: 5 as unknown as 'archer' }).events)).toBe(true);
  });

  it('what does not fit stays in the garrison', () => {
    const kinds = ['swordsman', 'swordsman', 'swordsman', 'archer', 'archer', 'knight'] as const;
    const base = createRun(26);
    const six = kinds.map((unitId, i) => ({ ...base.army[0]!, stackId: `s${i}`, unitId, position: (i + 1) as 1, count: 3 }));
    const run = inCity({ ...withTier(base, 3), army: six, garrison: { swordsman: 4, priest: 2 } });
    const result = act(run, { type: 'COLLECT_GARRISON' });
    expect(result.run.garrison).toEqual({ priest: 2 });
    expect(result.run.army.filter((s) => s.unitId === 'swordsman').reduce((n, s) => n + s.count, 0)).toBe(13);
    const blockedOnly = act(run, { type: 'COLLECT_GARRISON', unitId: 'priest' });
    expect(reason(blockedOnly.events)).toContain('Field army is full');
    expect(blockedOnly.run.garrison).toEqual({ swordsman: 4, priest: 2 });
  });

  it('old saves keep full recruiting as a free tier IV Barracks and start with an empty garrison', () => {
    const old = roundTrip({ ...createRun(27), saveVersion: 2 }) as unknown as { city: Record<string, unknown>; garrison?: unknown };
    delete old.city.barracksTier;
    delete old.garrison;
    const loaded = validateSave(old)!;
    expect([loaded.city.barracksTier, loaded.city.buildings, loaded.garrison]).toEqual([4, ['barracks'], {}]);
  });
});

describe('AO-046 item 5 (AO-D071): the city Marketplace', () => {
  const shop = (gold: number, food = 20): RunState => ({ ...createRun(30), phase: 'city', gold, food });

  it('prices follow 12 x 1.08^purchases rounded; a quote for several packs charges each pack at its own price', () => {
    expect([0, 1, 2, 3, 4, 5, 10, 20].map(foodPackPrice)).toEqual([12, 13, 14, 15, 16, 18, 26, 56]);
    const quote = foodMarketQuote(shop(500), 3);
    expect(quote).toMatchObject({ packs: 3, food: 30, gold: 12 + 13 + 14, packPrice: 12, nextPackPrice: 15 });
    expect(foodMarketQuote(shop(5000)).maxAffordable).toBe(FOOD_MARKET.maxPacksPerAction);
    expect(foodMarketQuote(shop(40)).maxAffordable).toBe(3); // 12 + 13 + 14 = 39
    expect(foodMarketQuote(shop(11)).maxAffordable).toBe(0);
  });

  it('BUY_FOOD spends Gold, adds 10 Food per pack, raises the run-wide price and reports what it did', () => {
    let run = shop(200);
    const first = act(run, { type: 'BUY_FOOD', packs: 1 });
    expect(first.events).toContainEqual({ type: 'FOOD_PURCHASED', packs: 1, food: 10, gold: 12 });
    run = first.run;
    expect([run.gold, run.food, run.foodPurchases, run.stats.goldSpent, run.stats.foodGathered]).toEqual([188, 30, 1, 12, 10]);
    run = act(run, { type: 'BUY_FOOD', packs: 3 }).run;
    expect([run.gold, run.food, run.foodPurchases]).toEqual([188 - (13 + 14 + 15), 60, 4]);
    expect(foodMarketQuote(run).packPrice).toBe(16);
    // The price belongs to the run, not to the visit.
    const back = act(act(run, { type: 'LEAVE_CITY' }).run, { type: 'TRAVEL_TO_CITY' }).run;
    expect(foodMarketQuote(back).packPrice).toBe(16);
  });

  it('is rejected without enough Gold or outside the city, and changes nothing', () => {
    const poor = act(shop(11), { type: 'BUY_FOOD', packs: 1 });
    expect(reason(poor.events)).toBe('Not enough Gold.');
    expect([poor.run.gold, poor.run.food, poor.run.foodPurchases]).toEqual([11, 20, 0]);
    expect(rejected(act({ ...shop(500), phase: 'on_map' }, { type: 'BUY_FOOD', packs: 1 }).events)).toBe(true);
    expect(rejected(act(shop(30), { type: 'BUY_FOOD', packs: 3 }).events)).toBe(true); // 39 Gold
  });

  it('validates the pack count as a whole number from 1 to the per-action cap', () => {
    const run = shop(100000);
    for (const packs of [0, -1, 1.5, NaN, Infinity, '2', null, undefined, FOOD_MARKET.maxPacksPerAction + 1, Number.MAX_SAFE_INTEGER + 2]) {
      const result = act(run, { type: 'BUY_FOOD', packs } as unknown as RunAction);
      expect(rejected(result.events), String(packs)).toBe(true);
      expect(result.run.gold).toBe(100000);
    }
    expect(rejected(act(run, { type: 'BUY_FOOD', packs: FOOD_MARKET.maxPacksPerAction }).events)).toBe(false);
  });

  it('old saves start with no purchases', () => {
    const old = roundTrip({ ...createRun(31), saveVersion: 2 }) as unknown as Record<string, unknown>;
    delete old.foodPurchases;
    expect(validateSave(old)!.foodPurchases).toBe(0);
  });
});

describe('AO-046 item 6 (AO-D072): villages', () => {
  const atVillage = (seed = 40): RunState => arriveAt(createRun(seed), 'village');
  const mapOf = (seed: number, chapter: number) => generateWorldMap(createRng(seed), chapter, (chapter - 1) * 30 + 1);

  it('villages are drawn into the chapter maps by weight, deterministically per seed, never on the start or boss layer', () => {
    let villages = 0;
    let nodes = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const chapter of [1, 2, 3]) {
        const first = mapOf(seed, chapter);
        expect(mapOf(seed, chapter)).toEqual(first);
        const v = first.nodes.filter((n) => n.type === 'village');
        villages += v.length;
        nodes += first.nodes.filter((n) => n.layer > 0 && n.type !== 'boss').length;
        expect(v.every((n) => n.layer > 0 && n.layer < first.nodes.find((x) => x.type === 'boss')!.layer)).toBe(true);
      }
    }
    const expected = NODE_WEIGHTS.village / Object.values(NODE_WEIGHTS).reduce((n, w) => n + w, 0);
    expect(Math.abs(villages / nodes - expected)).toBeLessThan(0.02);
  });

  it('arriving opens the village choice with the numbers for this chapter', () => {
    const run = atVillage();
    expect(run.phase).toBe('village');
    expect(run.pendingVillage).toEqual(villageOffer(1));
    expect(run.log).toContainEqual({ type: 'ARRIVED_AT_NODE', nodeId: run.worldMap.currentNodeId, nodeType: 'village' });
    expect(villageOffer(3).raid.gold).toBeGreaterThan(villageOffer(1).raid.gold);
    expect(villageOffer(9)).toEqual(villageOffer(3));
    // The map cannot be walked or the city entered until the village is decided.
    expect(rejected(act(run, { type: 'TRAVEL_TO_CITY' }).events)).toBe(true);
    expect(rejected(act(run, { type: 'MOVE_TO', nodeId: run.worldMap.nodes.find((n) => n.layer === 2)!.id }).events)).toBe(true);
  });

  it('Raid pays Gold and Food at once, raises Threat by 1 and counts as raided', () => {
    const run = atVillage();
    const offer = run.pendingVillage!;
    const result = act(run, { type: 'RAID_VILLAGE' });
    expect(result.run.phase).toBe('on_map');
    expect(result.run.pendingVillage).toBeNull();
    expect([result.run.gold - run.gold, result.run.food - run.food, result.run.threat - run.threat]).toEqual([offer.raid.gold, offer.raid.food, 1]);
    expect(result.events).toContainEqual({ type: 'VILLAGE_RAIDED', gold: offer.raid.gold, food: offer.raid.food });
    expect(result.events).toContainEqual({ type: 'THREAT_CHANGED', threat: run.threat + 1, delta: 1 });
    expect([result.run.stats.villagesRaided, result.run.stats.villagesHelped, result.run.villages]).toEqual([1, 0, 0]);
  });

  it('Help pays a smaller gift and makes the village permanent: +3 Food a day each (stacking, in the daily hook with the Farm) and militia every week', () => {
    const run = atVillage();
    const offer = run.pendingVillage!;
    expect(offer.help.gold).toBeLessThan(offer.raid.gold);
    const helped = act(run, { type: 'HELP_VILLAGE' });
    expect(helped.events).toContainEqual({ type: 'VILLAGE_HELPED', gold: offer.help.gold, food: offer.help.food, villages: 1 });
    expect([helped.run.gold - run.gold, helped.run.threat - run.threat, helped.run.villages, helped.run.stats.villagesHelped]).toEqual([offer.help.gold, 0, 1, 1]);
    expect(dailyProduction(helped.run)).toBe(VILLAGE.dailyFood);

    const two = { ...helped.run, villages: 2, city: { ...helped.run.city, farmTier: 1 as const } };
    expect(dailyProduction(two)).toBe(FARM_TIERS[0]!.food + 2 * VILLAGE.dailyFood);
    const day = arriveAt(two, 'mine');
    expect(day.log).toContainEqual({ type: 'DAILY_INCOME', gold: 0, food: FARM_TIERS[0]!.food + 2 * VILLAGE.dailyFood });
  });

  it('helped villages add Swordsman militia to the weekly garrison (capped) even without a Barracks, and the garrison cap follows', () => {
    const three = { ...createRun(41), villages: 3 };
    expect(weeklyGarrison(three)).toEqual({ swordsman: 3 });
    expect(weeklyGarrison({ ...three, villages: VILLAGE.militiaVillageCap + 4 })).toEqual({ swordsman: VILLAGE.militiaVillageCap });
    let run = three;
    for (let i = 0; i < 6; i++) run = arriveAt(run, 'mine');
    expect(run.day).toBe(7);
    expect(run.garrison).toEqual({ swordsman: 3 });
    const withBarracks = { ...three, city: { ...three.city, barracksTier: 1 as const } };
    expect(weeklyGarrison(withBarracks)).toEqual({ swordsman: 4 + 3 });
    expect(garrisonCap(withBarracks)).toEqual({ swordsman: 14 });
  });

  it('both choices are rejected outside a village and change nothing', () => {
    const run = createRun(42);
    for (const type of ['RAID_VILLAGE', 'HELP_VILLAGE'] as const) {
      const result = act(run, { type });
      expect(rejected(result.events)).toBe(true);
      expect(result.run.gold).toBe(run.gold);
    }
  });

  it('saves: a village phase needs its pending offer, old saves get 0 villages and the new stats', () => {
    const run = atVillage();
    expect(validateSave(roundTrip(run))).not.toBeNull();
    expect(validateSave(roundTrip({ ...run, pendingVillage: null }))).toBeNull();
    const old = roundTrip({ ...createRun(43), saveVersion: 2 }) as unknown as Record<string, unknown>;
    delete old.villages;
    delete old.pendingVillage;
    delete (old.stats as Record<string, unknown>).villagesHelped;
    delete (old.stats as Record<string, unknown>).villagesRaided;
    const loaded = validateSave(old)!;
    expect([loaded.villages, loaded.pendingVillage, loaded.stats.villagesHelped, loaded.stats.villagesRaided]).toEqual([0, null, 0, 0]);
  });
});

describe('AO-046 item 7 (AO-D074): Food balance', () => {
  const ctx = { chapter: 1, day: 1, fort: false, threat: 0 };

  it('the Food chance after a battle is about 45% early and rises with chapter, day and elites; the amounts are unchanged', () => {
    expect(battleLootBands(ctx).foodChance).toBe(0.45);
    expect(battleLootBands(ctx).food).toEqual([5, 10]);
    expect(battleLootBands({ ...ctx, day: 29 }).foodChance).toBeGreaterThan(0.6);
    expect(battleLootBands({ ...ctx, chapter: 2, day: 31 }).foodChance).toBeGreaterThan(battleLootBands(ctx).foodChance);
    expect(battleLootBands({ ...ctx, chapter: 3, day: 61 }).foodChance).toBeGreaterThan(battleLootBands({ ...ctx, chapter: 2, day: 31 }).foodChance);
    expect(battleLootBands({ ...ctx, fort: true }).foodChance).toBeGreaterThan(battleLootBands(ctx).foodChance);
    expect(battleLootBands({ ...ctx, chapter: 3, day: 89, fort: true }).foodChance).toBe(BATTLE_LOOT.maxFoodChance);
  });

  it('measured over many rolls, an early battle drops Food about 45% of the time', () => {
    let drops = 0;
    const rng = createRng(99);
    for (let i = 0; i < 2000; i++) if (rollBattleLoot(rng, ctx).food > 0) drops += 1;
    expect(drops / 2000).toBeGreaterThan(0.41);
    expect(drops / 2000).toBeLessThan(0.49);
  });

  it('every hero starts with enough Food to march 15 days with no income at all (no starvation before day 15)', () => {
    for (const hero of ['warlord', 'rogue', 'mage'] as const) {
      const run = createRun(1, hero);
      expect(dailyUpkeep(run) * 15, hero).toBeLessThan(run.food);
    }
  });
});

describe('AO-046 item 8 (AO-D074): starting armies and the start', () => {
  const HEROES = ['warlord', 'rogue', 'mage'] as const;

  it('every hero opens with 8 units and a solid front line of at least 4 melee soldiers, the Mage included', () => {
    for (const hero of HEROES) {
      const army = createRun(3, hero, undefined, 'whetstone').army;
      expect(army.reduce((n, s) => n + s.count, 0), hero).toBe(8);
      const front = army.filter((s) => s.position <= 3);
      expect(front.reduce((n, s) => n + s.count, 0), hero).toBeGreaterThanOrEqual(4);
      expect(front.every((s) => s.unitId === 'swordsman' || s.unitId === 'knight'), hero).toBe(true);
    }
    const mage = createRun(3, 'mage').army;
    expect(mage.find((s) => s.unitId === 'swordsman')!.count).toBeGreaterThanOrEqual(3);
    expect(mage.some((s) => s.unitId === 'archer') && mage.some((s) => s.unitId === 'priest')).toBe(true);
  });

  it('the free first city visit lets a fresh run raise a Barracks and recruit before the first fight without Threat', () => {
    let run = createRun(5, 'mage');
    run = act(run, { type: 'TRAVEL_TO_CITY' }).run;
    run = act(run, { type: 'BUILD_BUILDING', buildingId: 'barracks' }).run;
    const before = run.army.reduce((n, s) => n + s.count, 0);
    const recruited = act(run, { type: 'RECRUIT', unitId: 'swordsman', count: 5 });
    expect(rejected(recruited.events)).toBe(false);
    expect(recruited.run.army.reduce((n, s) => n + s.count, 0)).toBe(before + 5);
    expect([recruited.run.threat, recruited.run.gold]).toEqual([0, STARTING_GOLD - BARRACKS_TIERS[0]!.cost - 5 * 8]);
  });
});
