import { describe, expect, it } from 'vitest';
import type { RunEvent } from '../engine/run/index.js';
import { describeRunEvent, unitCountText } from './runEventText.js';

/** One sample per RunEvent type; the Record type makes a new engine event a compile error until it is listed here. */
const SAMPLES: { [T in RunEvent['type']]: Extract<RunEvent, { type: T }> } = {
  RUN_STARTED: { type: 'RUN_STARTED' },
  STARTING_RELIC_CHOSEN: { type: 'STARTING_RELIC_CHOSEN', relicId: 'x' },
  MOVED: { type: 'MOVED', nodeId: 'n', foodCost: 2 },
  STARVED: { type: 'STARVED', deaths: [{ unitId: 'swordsman', count: 1 }], day: 3, consecutiveDays: 1 },
  MINE_CAPTURED: { type: 'MINE_CAPTURED', gold: 9, food: 4, mines: 2 },
  ARRIVED_AT_NODE: { type: 'ARRIVED_AT_NODE', nodeId: 'n', nodeType: 'fort' },
  BATTLE_WON: { type: 'BATTLE_WON' },
  BATTLE_LOST: { type: 'BATTLE_LOST' },
  RELIC_CLAIMED: { type: 'RELIC_CLAIMED', relicId: 'x' },
  CARD_REWARD_CLAIMED: { type: 'CARD_REWARD_CLAIMED', cardId: 'charge' },
  CARD_UPGRADED: { type: 'CARD_UPGRADED', instanceId: 'c', cardId: 'charge' },
  CARD_REMOVED: { type: 'CARD_REMOVED', instanceId: 'c', cardId: 'charge', goldPaid: 0 },
  UNITS_REVIVED: { type: 'UNITS_REVIVED', count: 2 },
  UNITS_RAISED: { type: 'UNITS_RAISED', count: 2 },
  DAILY_INCOME: { type: 'DAILY_INCOME', gold: 1, food: 0 },
  BATTLE_LOOT: { type: 'BATTLE_LOOT', gold: 5, food: 0 },
  FARM_UPGRADED: { type: 'FARM_UPGRADED', tier: 2 },
  BARRACKS_UPGRADED: { type: 'BARRACKS_UPGRADED', tier: 2 },
  FOOD_PURCHASED: { type: 'FOOD_PURCHASED', packs: 1, food: 10, gold: 15 },
  VILLAGE_RAIDED: { type: 'VILLAGE_RAIDED', gold: 60, food: 15 },
  VILLAGE_HELPED: { type: 'VILLAGE_HELPED', gold: 15, food: 5, villages: 1 },
  GARRISON_GROWN: { type: 'GARRISON_GROWN', units: [{ unitId: 'swordsman', count: 4 }] },
  GARRISON_COLLECTED: { type: 'GARRISON_COLLECTED', unitId: 'swordsman', count: 4 },
  EVENT_RESOLVED: { type: 'EVENT_RESOLVED', eventId: 'e', optionId: 'o', outcome: 'ok', text: 'Something happened.' },
  THREAT_CHANGED: { type: 'THREAT_CHANGED', threat: 2, delta: 1 },
  UNITS_GAINED: { type: 'UNITS_GAINED', unitId: 'archer', count: 1 },
  UNITS_LOST: { type: 'UNITS_LOST', unitId: 'archer', count: 1 },
  UNITS_DISMISSED: { type: 'UNITS_DISMISSED', unitId: 'archer', count: 1 },
  UNIT_GAIN_DECLINED: { type: 'UNIT_GAIN_DECLINED', unitId: 'archer', count: 1 },
  ITEM_PURCHASED: { type: 'ITEM_PURCHASED', itemId: 'charge', price: 30 },
  UNITS_RECRUITED: { type: 'UNITS_RECRUITED', unitId: 'archer', count: 3 },
  BUILDING_BUILT: { type: 'BUILDING_BUILT', buildingId: 'gold_mine' },
  CITY_LEVELED_UP: { type: 'CITY_LEVELED_UP', level: 2 },
  MAGE_TOWER_UPGRADED: { type: 'MAGE_TOWER_UPGRADED', tier: 2 },
  DOCTRINE_CHOSEN: { type: 'DOCTRINE_CHOSEN', doctrineId: 'economic' },
  CITY_VISITED: { type: 'CITY_VISITED', threat: 1, free: false },
  BOSS_DEFEATED: { type: 'BOSS_DEFEATED', chapter: 1 },
  CHAPTER_STARTED: { type: 'CHAPTER_STARTED', chapter: 2 },
  RUN_COMPLETE: { type: 'RUN_COMPLETE' },
  ACTION_REJECTED: { type: 'ACTION_REJECTED', reason: 'no' },
};


describe('run event texts', () => {
  it('answers every RunEvent type with text or an explicit null, never undefined', () => {
    for (const event of Object.values(SAMPLES)) expect(describeRunEvent(event), event.type).not.toBeUndefined();
  });

  it('words a captured mine with the find and the mine count', () => {
    expect(describeRunEvent({ type: 'MINE_CAPTURED', gold: 9, food: 4, mines: 1 })).toBe('Mine captured: +9 Gold, +4 Food, 1 mine.');
    expect(describeRunEvent({ type: 'MINE_CAPTURED', gold: 9, food: 4, mines: 3 })).toBe('Mine captured: +9 Gold, +4 Food, 3 mines.');
  });

  it('names every unit type that starved, with plurals', () => {
    const text = describeRunEvent({
      type: 'STARVED',
      deaths: [
        { unitId: 'swordsman', count: 3 },
        { unitId: 'archer', count: 1 },
      ],
      day: 4,
      consecutiveDays: 2,
    });
    expect(text).toBe('3 Swordsmen, 1 Archer starved (starving day 2).');
  });

  it('reports the Necromantic Doctrine raising Skeletons', () => {
    expect(describeRunEvent({ type: 'UNITS_RAISED', count: 5 })).toBe('5 fallen soldiers rose as Skeletons.');
    expect(describeRunEvent({ type: 'UNITS_RAISED', count: 1 })).toBe('1 fallen soldier rose as a Skeleton.');
  });

  it('says which card an upgrade improved', () => {
    expect(describeRunEvent({ type: 'CARD_UPGRADED', instanceId: 'c1', cardId: 'charge' })).toBe('Upgraded Charge.');
  });

  it('pluralises regular and irregular unit names', () => {
    expect(unitCountText('wolf', 2)).toBe('2 Wolves');
    expect(unitCountText('knight', 1)).toBe('1 Knight');
    expect(unitCountText('goblin', 4)).toBe('4 Goblins');
  });

  it('describes loot, city visits and empty daily income', () => {
    expect(describeRunEvent({ type: 'BATTLE_LOOT', gold: 20, food: 0 })).toBe('Loot: +20 Gold.');
    expect(describeRunEvent({ type: 'BATTLE_LOOT', gold: 20, food: 8 })).toBe('Loot: +20 Gold, +8 Food.');
    expect(describeRunEvent({ type: 'CITY_VISITED', threat: 2, free: false })).toContain('Threat is now 2');
    expect(describeRunEvent({ type: 'CITY_VISITED', threat: 0, free: true })).toContain('no Threat increase');
    expect(describeRunEvent({ type: 'DAILY_INCOME', gold: 0, food: 0 })).toBeNull();
    expect(describeRunEvent({ type: 'DAILY_INCOME', gold: 10, food: 3 })).toBe('Daily income: +10 Gold, +3 Food.');
  });

  it('describes the garrison, Barracks, Marketplace and village events', () => {
    expect(describeRunEvent({ type: 'GARRISON_GROWN', units: [{ unitId: 'swordsman', count: 4 }, { unitId: 'archer', count: 3 }] })).toBe('The garrison grew: 4 Swordsmen, 3 Archers are waiting in the city.');
    expect(describeRunEvent({ type: 'GARRISON_COLLECTED', unitId: 'archer', count: 1 })).toBe('Collected 1 Archer from the garrison.');
    expect(describeRunEvent({ type: 'BARRACKS_UPGRADED', tier: 2 })).toBe('Barracks upgraded to tier II.');
    expect(describeRunEvent({ type: 'FOOD_PURCHASED', packs: 3, food: 30, gold: 40 })).toBe('Bought 3 Food packs (+30 Food) for 40 Gold.');
    expect(describeRunEvent({ type: 'VILLAGE_RAIDED', gold: 60, food: 15 })).toBe('Raided a village: +60 Gold, +15 Food.');
    expect(describeRunEvent({ type: 'VILLAGE_HELPED', gold: 15, food: 5, villages: 2 })).toBe('Helped a village: +15 Gold, +5 Food. Helped villages now send 2 Food every day and 2 militia every week (2 helped).');
  });
});
