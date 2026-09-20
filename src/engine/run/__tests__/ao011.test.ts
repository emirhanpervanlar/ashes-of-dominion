import { describe, expect, it } from 'vitest';
import type { CombatEvent, CombatState } from '../../types.js';
import { CARD_REMOVAL, cardRemovalQuote } from '../cardRemoval.js';
import { BUILDING_DEFINITIONS, GOLD_MINE_DAILY_GOLD, MAGE_TOWER_TIERS, mageTowerDescription } from '../city.js';
import { moveFoodCost } from '../food.js';
import { applyRunAction, createRun, migrateRun } from '../runEngine.js';
import { createRunStats, tallyCombatEvents } from '../stats.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';
import { legacySave } from './legacy.js';

function act(run: RunState, action: RunAction) {
  return applyRunAction(run, action);
}
const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');

function onMap(seed: number, hero: 'warlord' | 'rogue' | 'mage' = 'warlord'): RunState {
  return createRun(seed, hero);
}

function moveToNextAs(run: RunState, type: NodeType): RunState {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return act({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

function inBattle(seed: number): RunState {
  return moveToNextAs(onMap(seed), 'battle');
}

function winWith(run: RunState, mutatePlayer: (army: CombatState['playerArmy']) => CombatState['playerArmy']): RunState {
  const combat = run.combat!;
  const won: CombatState = {
    ...combat,
    playerArmy: mutatePlayer(combat.playerArmy),
    enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
  };
  return act({ ...run, combat: won }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

/** A won battle where the first stack lost `lost` of its units and is hurt. */
function wonWithCasualties(run: RunState, lost: number): RunState {
  return winWith(run, (army) =>
    army.map((s, i) => (i === 0 ? { ...s, count: s.count - lost, currentHp: 1 } : s))
  );
}

describe('AO-D019: full heal after a won battle', () => {
  it('restores every surviving stack to full HP of its surviving count; dead units stay dead', () => {
    const run = inBattle(1);
    const before = run.army[0]!;
    const won = wonWithCasualties(run, 2);
    expect(won.phase).toBe('reward');
    const hpPerUnit = before.maxHp / before.count;
    const hurt = won.army[0]!;
    expect(hurt.count).toBe(before.count - 2);
    expect(hurt.currentHp).toBe(hurt.count * hpPerUnit);
    expect(hurt.maxHp).toBe(hurt.count * hpPerUnit);
    expect(hurt.preBattleMaxCount).toBe(hurt.count);
    expect(hurt.startingCount).toBe(hurt.count);
    for (const s of won.army) expect(s.currentHp).toBe(s.maxHp);
  });

  it('a stack wiped out in the battle is not resurrected without a Shrine', () => {
    const won = winWith(inBattle(2), (army) => army.map((s, i) => (i === 0 ? { ...s, count: 0, currentHp: 0 } : s)));
    expect(won.army[0]!.count).toBe(0);
    expect(applyRunAction(won, { type: 'SKIP_REWARD' }).run.army.filter((s) => s.count > 0)).toHaveLength(won.army.length - 1);
  });
});

describe('AO-D020: city building effects', () => {
  const withBuilding = (run: RunState, id: string): RunState => ({ ...run, city: { ...run.city, buildings: [...run.city.buildings, id] } });

  const withBigStack = (run: RunState): RunState => ({
    ...run,
    combat: { ...run.combat!, playerArmy: run.combat!.playerArmy.map((s, i) => (i === 0 ? { ...s, count: 30, preBattleMaxCount: 30 } : s)) },
  });

  it('Shrine revives 10% of casualties (rounded down) after a battle, never above the pre-battle count', () => {
    const won = wonWithCasualties(withBigStack(withBuilding(inBattle(3), 'shrine')), 25); // floor(2.5) = 2 revived
    expect(won.army[0]!.count).toBe(30 - 25 + 2);
    expect(won.army[0]!.count).toBeLessThanOrEqual(30);
    expect(won.army[0]!.currentHp).toBe(won.army[0]!.maxHp);
    expect(won.army[0]!.preBattleMaxCount).toBe(won.army[0]!.count);
    expect(won.stats.unitsRevived).toBe(2);
    expect(won.log.some((e) => e.type === 'UNITS_REVIVED' && e.count === 2)).toBe(true);
  });

  it('Shrine rounds down (9 casualties revive nobody), does nothing without casualties or without a Shrine', () => {
    const rounded = wonWithCasualties(withBigStack(withBuilding(inBattle(4), 'shrine')), 9);
    expect(rounded.army[0]!.count).toBe(21);
    expect(rounded.stats.unitsRevived).toBe(0);
    expect(winWith(withBuilding(inBattle(4), 'shrine'), (a) => a).stats.unitsRevived).toBe(0);
    expect(wonWithCasualties(withBigStack(inBattle(4)), 25).army[0]!.count).toBe(5);
  });

  it('Forge adds a +5% army damage effect to the battle (RelicEffect pipeline), Stable/Market do not', () => {
    const forged = moveToNextAs(withBuilding(onMap(5), 'forge'), 'battle');
    expect(forged.combat!.activeRelicEffects).toContainEqual({ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.05 });
    const plain = moveToNextAs(onMap(5), 'battle');
    expect(plain.combat!.activeRelicEffects.some((e) => e.kind === 'PLAYER_DAMAGE_MULT' && e.multiplier === 1.05)).toBe(false);
    expect(BUILDING_DEFINITIONS.forge!.description).toBe('Army attack +5%.');
  });

  it('Forge no longer grants max Mana', () => {
    const run = { ...onMap(6), phase: 'city' as const, gold: 500 };
    const built = act(run, { type: 'BUILD_BUILDING', buildingId: 'forge' }).run;
    expect(built.hero.maxMana).toBe(run.hero.maxMana);
  });

  it('Stable cuts movement Food cost by 25% (rounded down, min 1)', () => {
    const run = onMap(7);
    const stable = withBuilding(run, 'stable');
    const base = moveFoodCost(run.army);
    expect(moveFoodCost(run.army, stable.city)).toBe(Math.max(1, Math.floor(base * 0.75)));
    expect(moveFoodCost(run.army, stable.city)).toBeLessThan(base);
    const moved = moveToNextAs({ ...stable, food: 50 }, 'start');
    expect(moved.food).toBe(50 - moveFoodCost(run.army, stable.city));
  });

  const inCityWith = (gold: number, seed = 8): RunState => ({ ...onMap(seed), phase: 'city' as const, gold });
  const build = (r: RunState) => act(r, { type: 'BUILD_BUILDING', buildingId: 'mage_tower' });
  const upgrade = (r: RunState) => act(r, { type: 'UPGRADE_MAGE_TOWER' });

  it('Mage Tower tiers give cumulative +1/+3/+6 max Mana for 80/200/500 Gold in one slot, strictly in order', () => {
    const start = inCityWith(2000);
    expect(rejected(upgrade(start).events)).toBe(true); // nothing to upgrade yet
    let run = build(start).run;
    expect(run.city.mageTowerTier).toBe(1);
    expect(run.gold).toBe(2000 - MAGE_TOWER_TIERS[0]!.cost);
    expect(run.hero.maxMana).toBe(start.hero.maxMana + 1);
    expect(run.hero.mana).toBe(start.hero.mana + 1);
    expect(run.hero.stats.wisdom).toBe(start.hero.stats.wisdom);

    run = upgrade(run).run;
    expect(run.city.mageTowerTier).toBe(2);
    expect(run.gold).toBe(2000 - 80 - 200);
    expect(run.hero.maxMana).toBe(start.hero.maxMana + 3);

    const t3 = upgrade(run);
    expect(t3.events.some((e) => e.type === 'MAGE_TOWER_UPGRADED' && e.tier === 3)).toBe(true);
    run = t3.run;
    expect(run.city.mageTowerTier).toBe(3);
    expect(run.gold).toBe(2000 - 80 - 200 - 500);
    expect(run.hero.maxMana).toBe(start.hero.maxMana + 6);
    expect(run.city.buildings.filter((id) => id === 'mage_tower')).toHaveLength(1);
    expect(rejected(upgrade(run).events)).toBe(true); // max tier
    expect(rejected(build(run).events)).toBe(true); // cannot rebuild
  });

  it('a tier needs its full price and a failed upgrade changes nothing', () => {
    const built = build(inCityWith(80 + 199)).run;
    const result = upgrade(built);
    expect(rejected(result.events)).toBe(true);
    expect(result.run.city.mageTowerTier).toBe(1);
    expect(result.run.gold).toBe(199);
    expect(result.run.hero.maxMana).toBe(built.hero.maxMana);
  });

  it('upgrades only work in the city, and stack with Training Hall and relics without double counting', () => {
    const start = inCityWith(2000);
    const tower = upgrade(build(start).run).run;
    expect(rejected(act({ ...tower, phase: 'on_map' }, { type: 'UPGRADE_MAGE_TOWER' }).events)).toBe(true);
    const both = act(tower, { type: 'BUILD_BUILDING', buildingId: 'training_hall' }).run;
    expect(both.hero.maxMana).toBe(start.hero.maxMana + 3 + 2);
  });

  it('descriptions state the current tier bonus and the next cost', () => {
    expect(mageTowerDescription(0)).toContain('+1');
    expect(mageTowerDescription(1)).toContain('Tier I');
    expect(mageTowerDescription(1)).toContain('200 Gold');
    expect(mageTowerDescription(2)).toContain('500 Gold');
    expect(mageTowerDescription(2)).toContain('+6 total');
    expect(mageTowerDescription(3)).toContain('Max tier');
    expect(BUILDING_DEFINITIONS.mage_tower!.cost).toBe(80);
  });

  it('a pre-AO-D036 save with a Mage Tower migrates to tier I: Wisdom +2 undone, max Mana recomputed', () => {
    const run = onMap(8, 'mage');
    const old = { ...run, city: { level: 1, buildings: ['mage_tower'], doctrine: null }, hero: { ...run.hero, stats: { ...run.hero.stats, wisdom: run.hero.stats.wisdom + 2 }, maxMana: run.hero.maxMana + 1, mana: run.hero.mana + 1 } };
    const migrated = migrateRun(legacySave(old));
    expect(migrated.city.mageTowerTier).toBe(1);
    expect(migrated.hero.stats.wisdom).toBe(run.hero.stats.wisdom);
    expect(migrated.hero.maxMana).toBe(run.hero.maxMana + 1);
    expect(migrateRun(migrated).hero.maxMana).toBe(migrated.hero.maxMana); // idempotent
    expect(migrateRun(run).city.mageTowerTier).toBe(0);
  });

  it('Gold Mine gives +10 Gold per day instead of a one-off +100', () => {
    const run = { ...onMap(9), phase: 'city' as const, gold: 200 };
    const built = act(run, { type: 'BUILD_BUILDING', buildingId: 'gold_mine' }).run;
    expect(built.gold).toBe(200 - 80); // no immediate payout
    const day = built.day;
    const moved = moveToNextAs({ ...built, phase: 'on_map' }, 'start');
    expect(moved.day).toBe(day + 1);
    expect(moved.gold).toBe(120 + GOLD_MINE_DAILY_GOLD);
    expect(moved.log.some((e) => e.type === 'DAILY_INCOME' && e.gold === 10)).toBe(true);
    expect(moved.stats.goldGathered).toBe(10);
  });

  it('descriptions tell the truth', () => {
    expect(BUILDING_DEFINITIONS.stable!.description).toContain('Food');
    expect(BUILDING_DEFINITIONS.gold_mine!.description).toContain('10 Gold');
    expect(BUILDING_DEFINITIONS.mage_tower!.description).toContain('max Mana');
    expect(BUILDING_DEFINITIONS.shrine!.description).toContain('10%');
  });
});

describe('AO-D027: run stats', () => {
  it('a new run has zeroed stats, and an old save without stats loads with zero defaults', () => {
    expect(createRunStats().enemiesKilled).toBe(0);
    const { stats: _s, cardRemoval: _c, ...rest } = createRun(10);
    const legacy = legacySave(rest);
    const migrated = migrateRun(legacy);
    expect(migrated.stats).toEqual(createRunStats());
    expect(migrated.cardRemoval).toEqual({ merchantUses: 0, cityUses: 0 });
    // ...and the reducer accepts it directly.
    const result = applyRunAction(legacy, { type: 'TRAVEL_TO_CITY' });
    expect(result.run.stats.nodesVisited).toBe(0);
    expect(result.run.cardRemoval.merchantUses).toBe(0);
  });

  it('tallies combat events by side', () => {
    const stats = createRunStats();
    const events: CombatEvent[] = [
      { type: 'TURN_STARTED', side: 'player', turnNumber: 2 },
      { type: 'TURN_STARTED', side: 'enemy', turnNumber: 2 },
      { type: 'CARD_PLAYED', instanceId: 'a', cardId: 'x' },
      { type: 'STACK_ATTACKED', attackerStackId: 'p1', targetStackId: 'e1', rawDamage: 20, finalDamage: 15, blocked: 5, unitsKilled: 3, countAfter: 0 },
      { type: 'UNITS_KILLED', stackId: 'e1', count: 3 },
      { type: 'STACK_ATTACKED', attackerStackId: 'e1', targetStackId: 'p1', rawDamage: 9, finalDamage: 9, blocked: 0, unitsKilled: 1, countAfter: 0 },
      { type: 'UNITS_KILLED', stackId: 'p1', count: 1 },
    ];
    tallyCombatEvents(stats, events, new Set(['p1']));
    expect(stats).toMatchObject({ turnsPlayed: 1, cardsPlayed: 1, damageDealt: 15, damageTaken: 9, enemiesKilled: 3, unitsLost: 1 });
  });

  it('accumulates through a real run: nodes, days, food, gold, battles, turns, largest stack', () => {
    let run = onMap(11);
    expect(run.stats.largestStack).toBe(12); // 6 Swordsmen + Royal Banner's +6
    run = moveToNextAs(run, 'resource');
    expect(run.stats).toMatchObject({ nodesVisited: 1, daysElapsed: 1, foodEaten: moveFoodCost(run.army) });
    expect(run.stats.goldGathered).toBeGreaterThanOrEqual(20);
    expect(run.stats.foodGathered).toBeGreaterThanOrEqual(10);
    expect(run.stats.largestStack).toBe(12);

    run = moveToNextAs(run, 'battle');
    expect(run.stats.turnsPlayed).toBe(1);
    run = winWith(run, (a) => a);
    expect(run.stats.battlesWon).toBe(1);
    expect(run.battlesWon).toBe(1);
  });

  it('records real damage dealt/taken and units killed from combat actions', () => {
    let run = inBattle(12);
    const combat = run.combat!;
    let done = false;
    for (const p of combat.playerArmy) {
      for (const e of combat.enemyArmy) {
        if (done) break;
        const r = act(run, { type: 'COMBAT_ACTION', action: { type: 'BASIC_ACTION', stackId: p.stackId, targetStackId: e.stackId } });
        if (!rejected(r.events) && r.run.combat!.log.some((ev) => ev.type === 'STACK_ATTACKED')) {
          run = r.run;
          done = true;
        }
      }
    }
    expect(done).toBe(true);
    expect(run.stats.damageDealt).toBeGreaterThan(0);
    const ended = act(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(ended.stats.turnsPlayed).toBeGreaterThanOrEqual(2);
    expect(ended.stats.damageTaken + ended.stats.damageDealt).toBeGreaterThan(0);
  });

  it('defeat still keeps the stats and moves to the defeat phase', () => {
    const run = inBattle(13);
    const lost: CombatState = { ...run.combat!, playerArmy: run.combat!.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    const result = act({ ...run, combat: lost }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(result.phase).toBe('defeat');
    expect(result.stats.turnsPlayed).toBe(1);
  });
});

describe('AO-D026: reward resolves immediately', () => {
  it('claiming a card, skipping and removing each close the reward with no confirm step', () => {
    const won = winWith(inBattle(20), (a) => a);
    const cardId = won.pendingReward!.cardOptions[0]!;
    const claimed = act(won, { type: 'CLAIM_CARD', cardId });
    expect(claimed.run.phase).toBe('on_map');
    expect(claimed.run.pendingReward).toBeNull();
    expect(claimed.run.masterDeck).toHaveLength(11);

    const skipped = act(won, { type: 'SKIP_REWARD' });
    expect(skipped.run.phase).toBe('on_map');
    expect(skipped.events.some((e) => e.type === 'REWARD_SKIPPED')).toBe(true);
    expect(skipped.run.masterDeck).toHaveLength(10);

    const target = won.masterDeck[0]!;
    const removed = act(won, { type: 'REMOVE_CARD', instanceId: target.instanceId });
    expect(removed.run.phase).toBe('on_map');
    expect(removed.run.masterDeck).toHaveLength(9);
    expect(removed.run.masterDeck.some((c) => c.instanceId === target.instanceId)).toBe(false);
    expect(removed.run.gold).toBe(won.gold);
    expect(removed.run.stats.cardsRemoved).toBe(1);
  });

  it('only one pick: a second claim after resolving is rejected', () => {
    const won = winWith(inBattle(21), (a) => a);
    const first = act(won, { type: 'SKIP_REWARD' }).run;
    expect(rejected(act(first, { type: 'CLAIM_CARD', cardId: won.pendingReward!.cardOptions[0]! }).events)).toBe(true);
    expect(rejected(act(first, { type: 'SKIP_REWARD' }).events)).toBe(true);
  });

  it('a card added after a removal never reuses an existing instance id', () => {
    let won = winWith(inBattle(22), (a) => a);
    const cardId = won.pendingReward!.cardOptions[0]!;
    won = act(won, { type: 'CLAIM_CARD', cardId }).run;
    let again = winWith(moveToNextAs(won, 'battle'), (a) => a);
    again = act(again, { type: 'REMOVE_CARD', instanceId: again.masterDeck[0]!.instanceId }).run;
    let third = winWith(moveToNextAs(again, 'battle'), (a) => a);
    third = act(third, { type: 'CLAIM_CARD', cardId: third.pendingReward!.cardOptions[0]! }).run;
    const ids = third.masterDeck.map((c) => c.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the last boss reward still ends the run', () => {
    const run = { ...onMap(23), chapter: 3 };
    const boss = moveToNextAs(run, 'boss');
    const won = winWith(boss, (a) => a);
    expect(act(won, { type: 'SKIP_REWARD' }).run.phase).toBe('run_complete');
  });
});

describe('AO-D026: card removal at merchant and city', () => {
  const atMerchant = (seed: number, gold = 500): RunState => ({ ...moveToNextAs(onMap(seed), 'merchant'), gold });
  const atCity = (seed: number): RunState => act(onMap(seed), { type: 'TRAVEL_TO_CITY' }).run;

  it('merchant: price rises with each removal and Gold is charged', () => {
    let run = atMerchant(30);
    const [a, b] = [run.masterDeck[0]!, run.masterDeck[1]!];
    expect(cardRemovalQuote(run)).toEqual({ allowed: true, gold: CARD_REMOVAL.merchant.baseGold });
    run = act(run, { type: 'REMOVE_CARD', instanceId: a.instanceId }).run;
    expect(run.gold).toBe(500 - CARD_REMOVAL.merchant.baseGold);
    expect(run.phase).toBe('merchant'); // stays in the shop
    expect(cardRemovalQuote(run)).toEqual({ allowed: true, gold: CARD_REMOVAL.merchant.baseGold + CARD_REMOVAL.merchant.stepGold });
    const gold = run.gold;
    run = act(run, { type: 'REMOVE_CARD', instanceId: b.instanceId }).run;
    expect(run.gold).toBe(gold - CARD_REMOVAL.merchant.baseGold - CARD_REMOVAL.merchant.stepGold);
    expect(run.masterDeck).toHaveLength(8);
    expect(run.stats.goldSpent).toBe(CARD_REMOVAL.merchant.baseGold * 2 + CARD_REMOVAL.merchant.stepGold);
    expect(run.stats.cardsRemoved).toBe(2);
  });

  it('merchant: rejected without enough Gold, spends nothing', () => {
    const run = atMerchant(31, 10);
    const result = act(run, { type: 'REMOVE_CARD', instanceId: run.masterDeck[0]!.instanceId });
    expect(rejected(result.events)).toBe(true);
    expect(result.run.masterDeck).toHaveLength(10);
    expect(result.run.gold).toBe(10);
  });

  it('city (AO-D052): the first removal is free, then 50, 100, 200 ... Gold each, with no daily limit', () => {
    let run = { ...atCity(32), gold: 1000 };
    const remove = () => {
      const before = run.gold;
      const result = act(run, { type: 'REMOVE_CARD', instanceId: run.masterDeck[0]!.instanceId });
      expect(rejected(result.events)).toBe(false);
      run = result.run;
      return before - run.gold;
    };
    expect(cardRemovalQuote(run)).toEqual({ allowed: true, gold: 0 });
    expect([remove(), remove(), remove(), remove()]).toEqual([0, 50, 100, 200]);
    expect(run.day).toBe(atCity(32).day); // same day every time
    expect(run.phase).toBe('city');
    expect(run.masterDeck).toHaveLength(6);
    expect(cardRemovalQuote(run)).toEqual({ allowed: true, gold: 400 });
  });

  it('city: an unaffordable removal is rejected and quoted as such', () => {
    let run = atCity(32);
    run = act(run, { type: 'REMOVE_CARD', instanceId: run.masterDeck[0]!.instanceId }).run;
    run = { ...run, gold: 49 };
    expect(cardRemovalQuote(run)).toMatchObject({ allowed: false });
    const again = act(run, { type: 'REMOVE_CARD', instanceId: run.masterDeck[0]!.instanceId });
    expect(rejected(again.events)).toBe(true);
    expect(again.run.masterDeck).toHaveLength(9);
    expect(cardRemovalQuote({ ...run, gold: 50 })).toEqual({ allowed: true, gold: 50 });
  });

  it('a save with the old lastCityDay counter migrates to one paid-for city use', () => {
    const run = atCity(32);
    const old = legacySave({ ...run, cardRemoval: { merchantUses: 2, lastCityDay: 4 } });
    expect(migrateRun(old).cardRemoval).toEqual({ merchantUses: 2, cityUses: 1 });
    expect(migrateRun({ ...old, cardRemoval: { merchantUses: 0, lastCityDay: null } } as unknown as RunState).cardRemoval.cityUses).toBe(0);
  });

  it('is rejected on the map, for unknown cards, and below the minimum deck size', () => {
    const run = onMap(33);
    expect(rejected(act(run, { type: 'REMOVE_CARD', instanceId: run.masterDeck[0]!.instanceId }).events)).toBe(true);

    const city = atCity(33);
    expect(rejected(act(city, { type: 'REMOVE_CARD', instanceId: 'nope' }).events)).toBe(true);
    const tiny = { ...city, masterDeck: city.masterDeck.slice(0, CARD_REMOVAL.minDeckSize) };
    const result = act(tiny, { type: 'REMOVE_CARD', instanceId: tiny.masterDeck[0]!.instanceId });
    expect(rejected(result.events)).toBe(true);
    expect(result.run.masterDeck).toHaveLength(CARD_REMOVAL.minDeckSize);
  });
});
