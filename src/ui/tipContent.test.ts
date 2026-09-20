import { describe, expect, it } from 'vitest';
import { STATUS_INFO, UNIT_DEFINITIONS, statusEffectText } from '../engine/index.js';
import type { StatusType, UnitId } from '../engine/index.js';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS, createRun } from '../engine/run/index.js';
import { STATUS_ICONS } from './stackStatus.js';
import { blockTip, buildingTip, foodTip, heroStatRows, manaCostTip, pileTip, relicTip, roleTip, statusTip, threatTip } from './tipContent.js';

describe('status tips', () => {
  it('cover every status type with a name and a numeric effect', () => {
    for (const type of Object.keys(STATUS_ICONS) as StatusType[]) {
      const tip = statusTip(type, 3, 2);
      expect(tip.title, type).toBe(STATUS_INFO[type].name);
      expect(tip.icon, type).toBe(STATUS_ICONS[type]);
      expect(tip.body?.length, type).toBeGreaterThan(0);
      expect(tip.lines?.[0]?.text).toBe('Lasts 2 more turns.');
    }
  });

  it('takes the effect text from the engine with the amount filled in', () => {
    for (const type of Object.keys(STATUS_INFO) as StatusType[]) {
      expect(statusTip(type, 7).body, type).toBe(statusEffectText(type, 7));
    }
    expect(statusTip('poison', 4).body).toContain('4 damage');
    expect(statusTip('armor', 5, 1).lines?.[0]?.text).toBe('Lasts 1 more turn.');
  });

  it('describes Block', () => {
    expect(blockTip(7).body).toContain('7 damage');
  });
});

describe('relic tips', () => {
  it('carry name, rarity and the full description for every relic', () => {
    for (const relic of [...Object.values(RELIC_DEFINITIONS), ...Object.values(STARTING_RELIC_DEFINITIONS)]) {
      const tip = relicTip(relic, 'relic');
      expect(tip.title).toBe(relic.name);
      expect(tip.tag?.tone).toBe(relic.rarity);
      expect(tip.body).toBe(relic.description);
    }
  });
});

describe('role tips', () => {
  it('give every unit type a named role', () => {
    for (const unitId of Object.keys(UNIT_DEFINITIONS) as UnitId[]) {
      const tip = roleTip(unitId);
      expect(tip.body, unitId).toBeTruthy();
      expect(tip.title).not.toBe(UNIT_DEFINITIONS[unitId].name);
    }
  });
});

describe('cost, pile and resource tips', () => {
  it('states the Mana cost', () => {
    expect(manaCostTip(2).body).toBe('Costs 2 Mana to play.');
  });

  it('counts pile cards with the right plural', () => {
    expect(pileTip('draw', 1).body).toContain('1 card left');
    expect(pileTip('discard', 3).body).toContain('3 cards used');
  });

  it('threat tip shows the enemy size multiplier', () => {
    expect(threatTip({ threat: 5 }).body).toContain('x1.30');
  });

  it('food tip shows daily upkeep and net, and warns when the stock runs out', () => {
    const run = createRun(1);
    const tip = foodTip({ ...run, food: 1 });
    expect(tip.title).toBe('Food');
    expect(tip.lines?.some((l) => l.text.startsWith('Army eats'))).toBe(true);
    expect(tip.lines?.some((l) => l.tone === 'bad')).toBe(true);
  });

  it('building tip shows the cost until it is built', () => {
    const b = { id: 'forge', name: 'Forge', description: 'x', category: 'hero' as const, cost: 80 };
    expect(buildingTip(b, false, 'Army attack +5%.').lines?.[0]?.text).toBe('Costs 80 Gold to build.');
    expect(buildingTip(b, true, 'Army attack +5%.').lines?.[0]?.text).toBe('Built.');
  });
});

describe('heroStatRows', () => {
  const stats = { strength: 16, dexterity: 10, intelligence: 8, vitality: 14, wisdom: 8 };

  it('lists the five stats in order with their values', () => {
    const rows = heroStatRows(stats, 3);
    expect(rows.map((r) => r.key)).toEqual(['strength', 'dexterity', 'intelligence', 'vitality', 'wisdom']);
    expect(rows.map((r) => r.value)).toEqual([16, 10, 8, 14, 8]);
  });

  it('derives effects from the engine formulas', () => {
    const rows = heroStatRows({ ...stats, strength: 20, dexterity: 15, wisdom: 14 }, 3);
    expect(rows[0]!.effect).toContain('+20%');
    expect(rows[1]!.effect).toContain('5% Dodge');
    expect(rows[4]!.effect).toContain('Max Mana +2');
  });

  it('says so when a stat gives no bonus', () => {
    const rows = heroStatRows(stats, 3);
    expect(rows[1]!.effect).toBe('No bonus: 10 is neutral.');
    expect(rows[4]!.effect).toBe('No bonus: 10 is neutral.');
  });

  it('is honest about stats the engine does not read yet', () => {
    const rows = heroStatRows(stats, 3);
    expect(rows[2]!.effect).toContain('Not used');
    expect(rows[3]!.effect).toContain('Not used');
  });
});
