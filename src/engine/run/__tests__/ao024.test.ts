import { describe, expect, it } from 'vitest';
import type { ArmyStack, CombatState, UnitId } from '../../types.js';
import { addUnitsToArmy } from '../city.js';
import { CARD_REMOVAL } from '../cardRemoval.js';
import { EVENT_DEFINITIONS, EVENT_IDS, EVENT_TUNING, chapterScale, eventView, optionAvailability, pickEventId, resolveEventOptions } from '../events.js';
import { dailyUpkeep, totalArmyCount } from '../food.js';
import { applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import { pendingEventOf } from './eventHelpers.js';

function onMap(seed: number): RunState {
  return createRun(seed);
}

function atEvent(eventId: string, seed = 1, patch: Partial<RunState> = {}): RunState {
  return { ...onMap(seed), phase: 'event', pendingEvent: pendingEventOf(eventId), ...patch };
}

function choose(run: RunState, optionId: string) {
  return applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId });
}

function act(run: RunState, action: RunAction) {
  return applyRunAction(run, action);
}

function stack(run: RunState, unitId: UnitId): ArmyStack | undefined {
  return run.army.find((s) => s.unitId === unitId && s.count > 0);
}

function withUnits(run: RunState, units: UnitId[]): RunState {
  let army: ArmyStack[] = [];
  for (const unitId of units) army = addUnitsToArmy(army, unitId, 5)!;
  return { ...run, army };
}

/** The six-stack army with no Knight: nothing can join without a dismissal. */
const FULL_ARMY: UnitId[] = ['swordsman', 'archer', 'priest', 'goblin', 'orc', 'wolf'];

function resolvedOutcome(events: { type: string; outcome?: string }[]): string | undefined {
  return events.find((e) => e.type === 'EVENT_RESOLVED')?.outcome;
}

describe('event pool selection (AO-D050)', () => {
  function drawMany(run: RunState, count: number): string[] {
    const working = JSON.parse(JSON.stringify(run)) as RunState;
    return Array.from({ length: count }, () => pickEventId(working));
  }

  it('never repeats an event until every eligible one has been seen', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const drawn = drawMany(onMap(seed), 14); // chapter 1: 16 events minus the 2 chapter-2 ones
      expect(new Set(drawn).size).toBe(14);
    }
  });

  it('resets when exhausted but keeps the last 3 draws out of the next round', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const drawn = drawMany(onMap(seed), 17);
      const lastThree = drawn.slice(11, 14);
      expect(lastThree).toHaveLength(3);
      expect(drawn.slice(14, 17).some((id) => lastThree.includes(id))).toBe(false);
    }
  });

  it('chapter-2 events only appear from chapter 2', () => {
    const chapterOne = drawMany(onMap(3), 40);
    expect(chapterOne).not.toContain('ruined_watchtower');
    expect(chapterOne).not.toContain('blood_altar');
    const chapterTwo = drawMany({ ...onMap(3), chapter: 2 }, 16);
    expect(chapterTwo).toContain('ruined_watchtower');
    expect(chapterTwo).toContain('blood_altar');
  });

  it('is deterministic per seed and survives a save/resume round trip', () => {
    const run = onMap(9);
    expect(drawMany(run, 6)).toEqual(drawMany(run, 6));
    const resumed = migrateRun(JSON.parse(JSON.stringify(atEvent('wayside_shrine', 9))) as RunState);
    expect(resumed.pendingEvent).toEqual(pendingEventOf('wayside_shrine'));
    const first = pickEventId(resumed);
    expect(resumed.seenEventIds).toEqual([first]);
  });

  it('an old save without the new fields gets defaults', () => {
    const old = JSON.parse(JSON.stringify(atEvent('wayside_shrine'))) as Record<string, unknown>;
    delete old.seenEventIds;
    delete old.lastCasualties;
    delete old.pendingUnitChoice;
    old.pendingEvent = { eventId: 'wayside_shrine' };
    const migrated = migrateRun(old as unknown as RunState);
    expect(migrated.seenEventIds).toEqual([]);
    expect(migrated.lastCasualties).toEqual([]);
    expect(migrated.pendingUnitChoice).toBeNull();
    expect(migrated.pendingEvent).toEqual(pendingEventOf('wayside_shrine'));
  });

  it('entering an event node records the event as seen', () => {
    const run = onMap(4);
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const nextId = current.connectsTo[0]!;
    const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'event' as const } : n));
    const arrived = act({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
    expect(arrived.seenEventIds).toEqual([arrived.pendingEvent!.eventId]);
  });

  it('every event keeps at least one option playable with an empty purse and no special units', () => {
    const broke = { ...onMap(1), gold: 0, army: withUnits(onMap(1), ['swordsman']).army };
    for (const id of EVENT_IDS) {
      expect(resolveEventOptions(id, 1).some((o) => optionAvailability(broke, o).available), id).toBe(true);
    }
  });

  it('the weights table matches the proposal', () => {
    const weights = Object.fromEntries(EVENT_IDS.map((id) => [id, EVENT_DEFINITIONS[id]!.weight]));
    expect(weights).toEqual({
      abandoned_camp: 8,
      bandit_toll: 8,
      wayside_shrine: 8,
      plague_cart: 8,
      hunters_lodge: 8,
      deserter_knight: 7,
      forgotten_library: 7,
      cursed_well: 6,
      crossroads_gallows: 6,
      wandering_smith: 6,
      fogbound_ford: 7,
      hedge_witch: 5,
      ambushed_merchants: 6,
      mercenary_camp: 6,
      ruined_watchtower: 4,
      blood_altar: 3,
    });
  });
});

describe('option requirements', () => {
  it('a unit requirement is enforced and explained', () => {
    const noPriest = withUnits(atEvent('plague_cart'), ['swordsman']);
    const rejected = choose(noPriest, 'sell_remedies');
    expect(rejected.events).toContainEqual({ type: 'ACTION_REJECTED', reason: 'Requires Priest in your army.' });
    expect(rejected.run.pendingEvent).not.toBeNull();
    const view = eventView(noPriest)!.options.find((o) => o.id === 'sell_remedies')!;
    expect(view).toMatchObject({ available: false, reason: 'Requires Priest in your army.' });

    const withPriest = withUnits(atEvent('plague_cart'), ['swordsman', 'priest']);
    const sold = choose({ ...withPriest, gold: 10 }, 'sell_remedies').run;
    expect(sold.gold).toBe(10 + EVENT_TUNING.plague_cart.sellGold);
    expect(sold.phase).toBe('on_map');
  });

  it('a Gold requirement is enforced', () => {
    const poor = atEvent('hunters_lodge', 1, { gold: 5 });
    expect(choose(poor, 'trade').events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    const paid = choose({ ...poor, gold: 50, food: 10 }, 'trade').run;
    expect(paid.gold).toBe(30);
    expect(paid.food).toBe(40);
  });

  it('a deck-size requirement is enforced', () => {
    const run = atEvent('blood_altar', 1, { chapter: 2 });
    const small = { ...run, masterDeck: run.masterDeck.slice(0, EVENT_TUNING.blood_altar.offerMinDeck - 1) };
    expect(optionAvailability(small, resolveEventOptions('blood_altar', 2).find((o) => o.id === 'offer_card')!)).toEqual({
      available: false,
      reason: `Needs at least ${EVENT_TUNING.blood_altar.offerMinDeck} cards in your deck.`,
    });
    const big = { ...run, masterDeck: [...run.masterDeck, ...run.masterDeck].slice(0, 10) };
    expect(optionAvailability(big, resolveEventOptions('blood_altar', 2).find((o) => o.id === 'offer_card')!).available).toBe(true);
  });

  it('removal and giving respect the deck floor', () => {
    const run = atEvent('forgotten_library');
    const floor = { ...run, masterDeck: run.masterDeck.slice(0, CARD_REMOVAL.minDeckSize) };
    expect(eventView(floor)!.options.find((o) => o.id === 'burn_page')).toMatchObject({ available: false });
    expect(choose(floor, 'burn_page').events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('with no card that can be upgraded, the upgrade options are unavailable', () => {
    // No card in the current roster carries an upgrade definition yet, so Study is always greyed out.
    expect(eventView(atEvent('forgotten_library'))!.options.find((o) => o.id === 'study')).toMatchObject({ available: false, reason: 'No card in your deck can be upgraded.' });
  });

  it('a revival option needs casualties', () => {
    const run = atEvent('hedge_witch', 1, { gold: 100 });
    expect(eventView(run)!.options.find((o) => o.id === 'buy_brew')).toMatchObject({ available: false, reason: 'No fallen units to revive.' });
  });

  it('a chapter requirement is enforced', () => {
    const option = { id: 'x', label: '', description: '', result: '', effects: [], requires: { minChapter: 2 } };
    expect(optionAvailability(onMap(1), option).available).toBe(false);
    expect(optionAvailability({ ...onMap(1), chapter: 2 }, option).available).toBe(true);
  });
});

describe('effects', () => {
  it('Gold and Food amounts scale by chapter x1 / x1.5 / x2', () => {
    expect([1, 2, 3].map(chapterScale)).toEqual([1, 1.5, 2]);
    const base = EVENT_TUNING.plague_cart.sellGold;
    for (const [chapter, mult] of [[1, 1], [2, 1.5], [3, 2]] as const) {
      const run = withUnits(atEvent('plague_cart', 1, { chapter, gold: 0 }), ['swordsman', 'priest']);
      expect(choose(run, 'sell_remedies').run.gold).toBe(Math.round(base * mult));
      expect(resolveEventOptions('plague_cart', chapter).find((o) => o.id === 'sell_remedies')!.description).toContain(String(Math.round(base * mult)));
    }
  });

  it('MAX_MANA_DELTA raises max Mana for the run', () => {
    const run = atEvent('wayside_shrine');
    expect(choose(run, 'pray').run.hero.maxMana).toBe(run.hero.maxMana + 1);
  });

  it('THREAT_DELTA raises and lowers Threat but never below 0', () => {
    const desecrated = choose(atEvent('wayside_shrine', 1, { gold: 0 }), 'desecrate').run;
    expect(desecrated.threat).toBe(1);
    expect(desecrated.gold).toBe(EVENT_TUNING.wayside_shrine.desecrateGold);
    const dispatched = choose(atEvent('deserter_knight', 1, { threat: 3 }), 'dispatch');
    expect(dispatched.run.threat).toBe(2);
    expect(dispatched.events).toContainEqual({ type: 'THREAT_CHANGED', threat: 2, delta: -1 });
    expect(choose(atEvent('deserter_knight', 1, { threat: 0 }), 'dispatch').run.threat).toBe(0);
  });

  it('UPKEEP_DAYS charges the army upkeep but does not move the calendar', () => {
    const run = atEvent('fogbound_ford', 1, { food: 100 });
    const upkeep = dailyUpkeep(run);
    const waited = choose(run, 'wait').run;
    expect(waited.day).toBe(run.day);
    expect(waited.food).toBe(100 - upkeep);
  });

  it('UPKEEP_DAYS scales the Bandit Toll loss with the army', () => {
    const small = withUnits(atEvent('bandit_toll', 5, { food: 100 }), ['swordsman']);
    const large = withUnits(atEvent('bandit_toll', 5, { food: 100 }), ['swordsman', 'knight', 'orc', 'archer', 'priest']);
    const lostSmall = 100 - choose(small, 'refuse').run.food;
    const lostLarge = 100 - choose(large, 'refuse').run.food;
    expect(lostSmall).toBe(2 * dailyUpkeep(small));
    expect(lostLarge).toBe(2 * dailyUpkeep(large));
    expect(lostLarge).toBeGreaterThan(lostSmall);
  });

  it('UNIT_GAIN_ALL_STACKS grows every stack and raises Threat', () => {
    const run = atEvent('cursed_well');
    const drunk = choose(run, 'drink').run;
    expect(totalArmyCount(drunk.army)).toBe(totalArmyCount(run.army) + 2 * run.army.length);
    for (const s of drunk.army) expect(s.currentHp).toBe(s.maxHp);
    expect(drunk.threat).toBe(1);
  });

  it('UNIT_LOSS: largest stack loses units; a random stack loses a percentage; the army is never wiped', () => {
    const run = atEvent('fogbound_ford');
    const largest = run.army.reduce((a, b) => (b.count > a.count ? b : a));
    const forded = choose(run, 'ford_blind').run;
    expect(forded.army.find((s) => s.stackId === largest.stackId)!.count).toBe(largest.count - 1);

    const plague = withUnits(atEvent('plague_cart', 2, { gold: 0, food: 0 }), ['swordsman']);
    const looted = choose({ ...plague, army: plague.army.map((s) => ({ ...s, count: 20, currentHp: s.maxHp, maxHp: s.maxHp })) }, 'loot').run;
    expect(looted.army[0]!.count).toBe(15);
    expect(looted.gold).toBe(EVENT_TUNING.plague_cart.lootGold);
    expect(looted.food).toBe(EVENT_TUNING.plague_cart.lootFood);

    const lone = { ...withUnits(atEvent('fogbound_ford'), ['swordsman']) };
    lone.army = lone.army.map((s) => ({ ...s, count: 1 }));
    expect(totalArmyCount(choose(lone, 'ford_blind').run.army)).toBe(1);
  });

  it('REVIVE_LAST_CASUALTIES brings back a share of the last battle\'s losses and uses them up', () => {
    const base = withUnits(atEvent('abandoned_camp'), ['swordsman']);
    const run: RunState = { ...base, lastCasualties: [{ unitId: 'swordsman', count: 10 }, { unitId: 'knight', count: 3 }] };
    const rested = choose(run, 'rest');
    expect(stack(rested.run, 'swordsman')!.count).toBe(5 + 3);
    expect(stack(rested.run, 'knight')!.count).toBe(1);
    expect(rested.run.lastCasualties).toEqual([{ unitId: 'swordsman', count: 7 }, { unitId: 'knight', count: 2 }]);
    expect(rested.events).toContainEqual({ type: 'UNITS_REVIVED', count: 4 });
  });

  it('a won battle records its casualties for later revival', () => {
    const run = onMap(6);
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const nextId = current.connectsTo[0]!;
    const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n));
    const fighting = act({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
    const combat = fighting.combat!;
    const hurt: CombatState = {
      ...combat,
      playerArmy: combat.playerArmy.map((s, i) => (i === 0 ? { ...s, count: s.count - 2, preBattleMaxCount: s.count, currentHp: s.currentHp - 2 * 10 } : s)),
      enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    const won = act({ ...fighting, combat: hurt }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(won.lastCasualties).toEqual([{ unitId: combat.playerArmy[0]!.unitId, count: 2 }]);
  });

  it('REVEAL_MAP sets revealedUntilStep to the current layer + steps', () => {
    const run = atEvent('ruined_watchtower', 1, { chapter: 2 });
    const layer = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!.layer;
    expect(choose(run, 'climb').run.worldMap.revealedUntilStep).toBe(layer + 5);
  });

  it('GAIN_CARD (through a won gamble) adds a card and RELIC grants a relic of the requested rarity', () => {
    let rescued: RunState | undefined;
    for (let seed = 1; seed <= 200 && !rescued; seed++) {
      const r = choose(atEvent('ambushed_merchants', seed, { gold: 0 }), 'rescue');
      if (resolvedOutcome(r.events) === 'rescue_success') rescued = r.run;
    }
    expect(rescued).toBeDefined();
    expect(rescued!.gold).toBe(EVENT_TUNING.ambushed_merchants.rescueGold);
    expect(rescued!.masterDeck).toHaveLength(onMap(1).masterDeck.length + 1);
    expect(rescued!.phase).toBe('on_map');

    for (let seed = 1; seed <= 60; seed++) {
      const run = atEvent('blood_altar', seed, { chapter: 2, masterDeck: [...onMap(seed).masterDeck, ...onMap(seed).masterDeck] });
      const offered = act(choose(run, 'offer_card').run, { type: 'CHOOSE_EVENT_CARD', instanceId: run.masterDeck[0]!.instanceId }).run;
      expect(['rare', 'epic']).toContain(offered.relics[offered.relics.length - 1]!.rarity);
    }
  });
});

describe('card picks', () => {
  it('Wandering Smith trade: choose the option, pick a card, get Gold; cancel returns to the options', () => {
    const run = atEvent('wandering_smith', 1, { gold: 0 });
    const picking = choose(run, 'trade').run;
    expect(picking.pendingEvent!.choice).toMatchObject({ kind: 'card', action: 'give', optionId: 'trade' });
    expect(picking.masterDeck).toHaveLength(run.masterDeck.length);

    expect(act(picking, { type: 'CHOOSE_EVENT_OPTION', optionId: 'watch' }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(act(picking, { type: 'CHOOSE_EVENT_CARD', instanceId: 'nope' }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);

    const cancelled = act(picking, { type: 'CANCEL_EVENT_CHOICE' }).run;
    expect(cancelled.pendingEvent!.choice).toBeNull();

    const card = run.masterDeck[2]!;
    const done = act(picking, { type: 'CHOOSE_EVENT_CARD', instanceId: card.instanceId });
    expect(done.run.masterDeck.some((c) => c.instanceId === card.instanceId)).toBe(false);
    expect(done.run.gold).toBe(EVENT_TUNING.wandering_smith.tradeGold);
    expect(done.run.phase).toBe('on_map');
    expect(done.run.pendingEvent).toBeNull();
  });

  it('Forgotten Library burn a page removes a card for free and counts it', () => {
    const run = atEvent('forgotten_library');
    const picking = choose(run, 'burn_page').run;
    const card = run.masterDeck[0]!;
    const done = act(picking, { type: 'CHOOSE_EVENT_CARD', instanceId: card.instanceId }).run;
    expect(done.masterDeck).toHaveLength(run.masterDeck.length - 1);
    expect(done.stats.cardsRemoved).toBe(1);
    expect(done.gold).toBe(run.gold);
    expect(done.cardRemoval).toEqual(run.cardRemoval);
  });

  it('Hedge Witch bargain: gives a card and a relic', () => {
    const run = atEvent('hedge_witch', 3, { masterDeck: [...onMap(3).masterDeck, ...onMap(3).masterDeck] });
    const picking = choose(run, 'bargain').run;
    const done = act(picking, { type: 'CHOOSE_EVENT_CARD', instanceId: run.masterDeck[1]!.instanceId }).run;
    expect(done.masterDeck).toHaveLength(run.masterDeck.length - 1);
    expect(done.relics).toHaveLength(run.relics.length + 1);
    expect(['common', 'rare']).toContain(done.relics[done.relics.length - 1]!.rarity);
  });

  it('a card pick outside a card choice is rejected', () => {
    expect(act(atEvent('wandering_smith'), { type: 'CHOOSE_EVENT_CARD', instanceId: 'x' }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('gambles (AO-D056)', () => {
  function findGamble(eventId: string, optionId: string, outcome: string, patch: Partial<RunState> = {}): RunState {
    for (let seed = 1; seed <= 400; seed++) {
      const run = atEvent(eventId, seed, patch);
      if (resolvedOutcome(choose(run, optionId).events) === outcome) return run;
    }
    throw new Error(`no seed gives ${eventId}/${optionId} -> ${outcome}`);
  }

  it('Ambushed Merchants rescue: success pays Gold and a card, failure starts a battle that then rewards and returns to the map', () => {
    const lucky = choose(findGamble('ambushed_merchants', 'rescue', 'rescue_success'), 'rescue').run;
    expect(lucky.phase).toBe('on_map');

    const failed = choose(findGamble('ambushed_merchants', 'rescue', 'rescue_ambush'), 'rescue');
    expect(failed.events.some((e) => e.type === 'EVENT_RESOLVED')).toBe(true);
    expect(failed.run.phase).toBe('in_battle');
    expect(failed.run.pendingEvent).toBeNull();
    expect(failed.run.combat!.enemyArmy.length).toBeGreaterThan(0);

    const wiped: CombatState = { ...failed.run.combat!, enemyArmy: failed.run.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    const won = act({ ...failed.run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(won.phase).toBe('reward');
    expect(act(won, { type: 'SKIP_REWARD' }).run.phase).toBe('on_map');
  });

  it('the ambush is a normal battle of the current chapter at the current Threat', () => {
    const run = findGamble('ambushed_merchants', 'rescue', 'rescue_ambush', { chapter: 2, threat: 5 });
    const ambushed = choose(run, 'rescue').run;
    expect(ambushed.combat!.enemyArmy.reduce((sum, s) => sum + s.count, 0)).toBeGreaterThan(
      choose(findGamble('ambushed_merchants', 'rescue', 'rescue_ambush'), 'rescue').run.combat!.enemyArmy.reduce((sum, s) => sum + s.count, 0),
    );
  });

  it('losing the ambush battle ends the run', () => {
    const failed = choose(findGamble('ambushed_merchants', 'rescue', 'rescue_ambush'), 'rescue').run;
    const dead: CombatState = { ...failed.combat!, playerArmy: failed.combat!.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    expect(act({ ...failed, combat: dead }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run.phase).toBe('defeat');
  });

  it('the Ambushed Merchants chance is low, and the two converted gambles (Blood Altar smash, Watchtower cellar) both end in an ambush on failure', () => {
    for (const [id, optionId, chapter] of [['ambushed_merchants', 'rescue', 1], ['blood_altar', 'smash', 2], ['ruined_watchtower', 'loot_cellar', 2]] as const) {
      const gamble = resolveEventOptions(id, chapter).find((o) => o.id === optionId)!.gamble!;
      expect(gamble.failure).toBe('ambush');
      expect(gamble.successChance).toBeLessThanOrEqual(0.3);
    }
    const trials = 400;
    let wins = 0;
    for (let seed = 1; seed <= trials; seed++) {
      if (resolvedOutcome(choose(atEvent('ambushed_merchants', seed), 'rescue').events) === 'rescue_success') wins++;
    }
    expect(wins / trials).toBeGreaterThan(0.22);
    expect(wins / trials).toBeLessThan(0.38);
  });

  it('Blood Altar smash: Threat rises either way; success gives a rare relic, failure an ambush', () => {
    const win = findGamble('blood_altar', 'smash', 'smash_success', { chapter: 2 });
    const won = choose(win, 'smash').run;
    expect(won.threat).toBe(1);
    expect(won.relics[won.relics.length - 1]!.rarity).toBe('rare');
    const lose = findGamble('blood_altar', 'smash', 'smash_ambush', { chapter: 2 });
    const lost = choose(lose, 'smash').run;
    expect(lost.threat).toBe(1);
    expect(lost.phase).toBe('in_battle');
  });

  it('Hunt alone: success gives Food, failure costs a unit', () => {
    const win = findGamble('hunters_lodge', 'hunt_alone', 'hunt_alone_success');
    expect(choose(win, 'hunt_alone').run.food).toBe(win.food + EVENT_TUNING.hunters_lodge.aloneFood);
    const lose = findGamble('hunters_lodge', 'hunt_alone', 'hunt_alone_failure');
    expect(totalArmyCount(choose(lose, 'hunt_alone').run.army)).toBe(totalArmyCount(lose.army) - 1);
  });

  it('Abandoned Camp search keeps its historical outcome ids', () => {
    const outcomes = new Set<string | undefined>();
    for (let seed = 1; seed <= 100; seed++) outcomes.add(resolvedOutcome(choose(atEvent('abandoned_camp', seed), 'search').events));
    expect(outcomes).toEqual(new Set(['search_relic', 'search_trap']));
  });

  it('every resolved event carries English outcome text', () => {
    const result = choose(atEvent('wayside_shrine'), 'pray');
    expect(result.events.find((e) => e.type === 'EVENT_RESOLVED')).toMatchObject({ eventId: 'wayside_shrine', optionId: 'pray', outcome: 'pray', text: 'Your mind clears; you can hold more power.' });
  });
});

describe('unit gain and dismissal (AO-D054)', () => {
  it('a unit gain that fits simply joins the army', () => {
    const run = withUnits(atEvent('deserter_knight', 1, { gold: 100 }), ['swordsman']);
    const recruited = choose(run, 'recruit').run;
    expect(stack(recruited, 'knight')!.count).toBe(2);
    expect(recruited.gold).toBe(100 - EVENT_TUNING.deserter_knight.recruitGold);
    expect(recruited.pendingUnitChoice).toBeNull();
    expect(recruited.phase).toBe('on_map');
  });

  it('a unit gain merges into an existing stack of the type even when the army has 6 stacks', () => {
    const run = withUnits(atEvent('deserter_knight', 1, { gold: 100 }), ['swordsman', 'archer', 'priest', 'goblin', 'orc', 'knight']);
    const recruited = choose(run, 'recruit').run;
    expect(recruited.army).toHaveLength(6);
    expect(stack(recruited, 'knight')!.count).toBe(7);
    expect(recruited.pendingUnitChoice).toBeNull();
  });

  function fullArmyPending(): RunState {
    const run = withUnits(atEvent('deserter_knight', 1, { gold: 100 }), FULL_ARMY);
    return choose(run, 'recruit').run;
  }

  it('with no room the newcomer is held as a pending 7th entry and the event stays open', () => {
    const pending = fullArmyPending();
    expect(pending.army).toHaveLength(6);
    expect(pending.pendingUnitChoice!.newcomer).toMatchObject({ unitId: 'knight', count: 2 });
    expect(pending.phase).toBe('event');
    expect(pending.pendingEvent!.resolved).toMatchObject({ optionId: 'recruit' });
    expect(pending.gold).toBe(100 - EVENT_TUNING.deserter_knight.recruitGold);
    expect(act(pending, { type: 'MOVE_TO', nodeId: pending.worldMap.nodes[1]!.id }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(act(pending, { type: 'CHOOSE_EVENT_OPTION', optionId: 'leave' }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('dismissing a whole stack lets the newcomer in and completes the event', () => {
    const pending = fullArmyPending();
    const goblins = stack(pending, 'goblin')!;
    const done = act(pending, { type: 'DISMISS_STACK', stackId: goblins.stackId });
    expect(done.events).toContainEqual({ type: 'UNITS_DISMISSED', unitId: 'goblin', count: 5 });
    expect(done.events).toContainEqual({ type: 'UNITS_GAINED', unitId: 'knight', count: 2 });
    expect(done.events.some((e) => e.type === 'EVENT_RESOLVED')).toBe(true);
    expect(stack(done.run, 'goblin')).toBeUndefined();
    expect(stack(done.run, 'knight')!.count).toBe(2);
    expect(done.run.army).toHaveLength(6);
    expect(done.run.pendingUnitChoice).toBeNull();
    expect(done.run.pendingEvent).toBeNull();
    expect(done.run.phase).toBe('on_map');
  });

  it('a partial dismissal frees no slot, so the choice stays pending', () => {
    const pending = fullArmyPending();
    const half = act(pending, { type: 'DISMISS_STACK', stackId: stack(pending, 'goblin')!.stackId, count: 2 }).run;
    expect(stack(half, 'goblin')!.count).toBe(3);
    expect(half.pendingUnitChoice).not.toBeNull();
    expect(half.phase).toBe('event');
  });

  it('the newcomer can itself be dismissed (whole = decline) or trimmed', () => {
    const pending = fullArmyPending();
    const id = pending.pendingUnitChoice!.newcomer.stackId;
    const trimmed = act(pending, { type: 'DISMISS_STACK', stackId: id, count: 1 }).run;
    expect(trimmed.pendingUnitChoice!.newcomer.count).toBe(1);
    const gone = act(trimmed, { type: 'DISMISS_STACK', stackId: id });
    expect(gone.run.pendingUnitChoice).toBeNull();
    expect(gone.run.army).toHaveLength(6);
    expect(gone.run.phase).toBe('on_map');
  });

  it('DECLINE_UNIT_GAIN drops the newcomer and completes the event; the Gold stays spent', () => {
    const pending = fullArmyPending();
    const declined = act(pending, { type: 'DECLINE_UNIT_GAIN' });
    expect(declined.events).toContainEqual({ type: 'UNIT_GAIN_DECLINED', unitId: 'knight', count: 2 });
    expect(declined.run.pendingUnitChoice).toBeNull();
    expect(declined.run.phase).toBe('on_map');
    expect(stack(declined.run, 'knight')).toBeUndefined();
    expect(declined.run.gold).toBe(pending.gold);
    expect(act(declined.run, { type: 'DECLINE_UNIT_GAIN' }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('merging stacks to free a slot places the waiting unit', () => {
    const run = withUnits(atEvent('deserter_knight', 1, { gold: 100 }), FULL_ARMY);
    const split: RunState = { ...run, army: run.army.map((s, i) => (i === 5 ? { ...s, unitId: 'swordsman' as UnitId } : s)) };
    const pending = choose(split, 'recruit').run;
    const [a, b] = pending.army.filter((s) => s.unitId === 'swordsman');
    const merged = act(pending, { type: 'MERGE_STACKS', stackIdA: a!.stackId, stackIdB: b!.stackId }).run;
    expect(merged.pendingUnitChoice).toBeNull();
    expect(stack(merged, 'knight')!.count).toBe(2);
    expect(merged.phase).toBe('on_map');
  });

  it('Mercenary Camp: two offers, pick one, units of that type join (or wait for a dismissal)', () => {
    const run = withUnits(atEvent('mercenary_camp', 1, { gold: 100 }), ['swordsman']);
    const offering = choose(run, 'hire').run;
    const choice = offering.pendingEvent!.choice!;
    expect(choice.kind).toBe('unit');
    if (choice.kind !== 'unit') return;
    expect(choice.unitIds).toHaveLength(2);
    expect(new Set(choice.unitIds).size).toBe(2);
    expect(act(offering, { type: 'CHOOSE_EVENT_UNIT', unitId: 'orc' }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);

    const pick = choice.unitIds[0]!;
    const hired = act(offering, { type: 'CHOOSE_EVENT_UNIT', unitId: pick }).run;
    expect(hired.gold).toBe(100 - EVENT_TUNING.mercenary_camp.hireGold);
    expect(stack(hired, pick)!.count).toBe(pick === 'swordsman' ? 5 + 3 : 3);
    expect(hired.phase).toBe('on_map');

    const full = choose(withUnits(atEvent('mercenary_camp', 1, { gold: 100 }), FULL_ARMY), 'hire').run;
    const fullChoice = full.pendingEvent!.choice;
    if (fullChoice?.kind !== 'unit') throw new Error('expected a unit choice');
    const newType = fullChoice.unitIds.find((u) => !FULL_ARMY.includes(u));
    if (newType) {
      const waiting = act(full, { type: 'CHOOSE_EVENT_UNIT', unitId: newType }).run;
      expect(waiting.pendingUnitChoice!.newcomer.unitId).toBe(newType);
      expect(waiting.phase).toBe('event');
    }
  });

  describe('DISMISS_STACK on its own', () => {
    it('removes a whole stack or part of it, on the map', () => {
      const run = onMap(1);
      const [first] = run.army;
      const partial = act(run, { type: 'DISMISS_STACK', stackId: first!.stackId, count: 3 }).run;
      expect(partial.army.find((s) => s.stackId === first!.stackId)!.count).toBe(first!.count - 3);
      const whole = act(run, { type: 'DISMISS_STACK', stackId: first!.stackId }).run;
      expect(whole.army.some((s) => s.stackId === first!.stackId)).toBe(false);
    });

    it('rejects bad amounts, unknown stacks and dismissing the last unit type', () => {
      const run = withUnits(onMap(1), ['swordsman', 'archer']);
      const [a, b] = run.army;
      const rejects = (action: RunAction, r = run) => act(r, action).events.some((e) => e.type === 'ACTION_REJECTED');
      expect(rejects({ type: 'DISMISS_STACK', stackId: 'nope' })).toBe(true);
      expect(rejects({ type: 'DISMISS_STACK', stackId: a!.stackId, count: 0 })).toBe(true);
      expect(rejects({ type: 'DISMISS_STACK', stackId: a!.stackId, count: a!.count + 1 })).toBe(true);
      expect(rejects({ type: 'DISMISS_STACK', stackId: a!.stackId, count: 1.5 })).toBe(true);
      const one = act(run, { type: 'DISMISS_STACK', stackId: a!.stackId }).run;
      expect(rejects({ type: 'DISMISS_STACK', stackId: b!.stackId }, one)).toBe(true);
      expect(one.army).toHaveLength(1);
      expect(act(one, { type: 'DISMISS_STACK', stackId: b!.stackId, count: b!.count - 1 }).run.army[0]!.count).toBe(1);
    });

    it('is refused during a battle', () => {
      const run = onMap(2);
      const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
      const nextId = current.connectsTo[0]!;
      const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n));
      const fighting = act({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
      expect(fighting.phase).toBe('in_battle');
      const result = act(fighting, { type: 'DISMISS_STACK', stackId: fighting.army[0]!.stackId });
      expect(result.events).toContainEqual({ type: 'ACTION_REJECTED', reason: 'Units can only be dismissed outside battle.' });
    });
  });
});
