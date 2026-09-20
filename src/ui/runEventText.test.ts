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
    expect(describeRunEvent({ type: 'CITY_VISITED', threat: 2 })).toContain('Threat is now 2');
    expect(describeRunEvent({ type: 'DAILY_INCOME', gold: 0, food: 0 })).toBeNull();
    expect(describeRunEvent({ type: 'DAILY_INCOME', gold: 10, food: 3 })).toBe('Daily income: +10 Gold, +3 Food.');
  });
});
