import { describe, expect, it } from 'vitest';
import { describeRunEvent, unitCountText } from './runEventText.js';

describe('run event texts', () => {
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
    expect(describeRunEvent({ type: 'VILLAGE_HELPED', gold: 15, food: 5, villages: 2 })).toContain('(2 helped)');
  });
});
