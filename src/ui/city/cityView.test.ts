import { describe, expect, it } from 'vitest';
import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, FARM_TIERS, LEVEL_SLOTS, MAGE_TOWER_TIERS, createRun, recruitCost } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { RECRUITABLE_UNITS, SCENE_BUILDINGS, activeEffects, buildBlocker, buildingEffect, levelRows, placementText, plotState, recruitQuote, tierRows } from './cityView.js';

function cityRun(patch: Partial<RunState> = {}, city: Partial<RunState['city']> = {}): RunState {
  const run = createRun(7, 'warlord', 'Tester');
  return { ...run, phase: 'city', gold: 1000, food: 200, ...patch, city: { ...run.city, ...city } };
}

describe('recruitQuote', () => {
  it('totals come from the engine cost and per-unit gold shows the Market discount', () => {
    const plain = cityRun();
    const q = recruitQuote(plain, 'swordsman', 10);
    expect(q.gold).toBe(recruitCost(plain.city, 'swordsman', 10)!.gold);
    expect(q.goldPerUnit).toBe(8);
    expect(q.food).toBe(10);
    const market = cityRun({}, { buildings: ['market'] });
    expect(recruitQuote(market, 'swordsman', 10).goldPerUnit).toBeCloseTo(6.8);
    expect(recruitQuote(market, 'swordsman', 10).gold).toBeLessThan(q.gold);
  });

  it('max affordable is the largest count Gold and Food both allow', () => {
    const run = cityRun({ gold: 100, food: 6 });
    const q = recruitQuote(run, 'knight', 1);
    expect(q.maxAffordable).toBe(3); // 15g / 2f each: Food limits to 3
    const rich = cityRun({ gold: 100, food: 500 });
    expect(recruitQuote(rich, 'knight', 1).maxAffordable).toBe(6); // Gold limits to 6
    expect(recruitQuote(cityRun({ gold: 3 }), 'knight', 1).maxAffordable).toBe(0);
  });

  it('blocks on Gold, Food and a zero count, and lets an exact fit through', () => {
    expect(recruitQuote(cityRun({ gold: 79 }), 'swordsman', 10).blocker).toBe('Not enough Gold.');
    expect(recruitQuote(cityRun({ food: 9 }), 'swordsman', 10).blocker).toBe('Not enough Food.');
    expect(recruitQuote(cityRun(), 'swordsman', 0).blocker).toBe('Choose how many to recruit.');
    expect(recruitQuote(cityRun({ gold: 80, food: 10 }), 'swordsman', 10).blocker).toBeNull();
  });

  it('merges into an existing stack of the same type and takes the first free slot otherwise', () => {
    const run = cityRun();
    const have = run.army.find((s) => s.count > 0)!;
    const same = recruitQuote(run, have.unitId, 1);
    expect(same.placement).toBe('merge');
    const other = RECRUITABLE_UNITS.find((u) => !run.army.some((s) => s.unitId === u && s.count > 0))!;
    const fresh = recruitQuote(run, other, 1);
    expect(fresh.placement).toBe('free');
    const taken = new Set(run.army.filter((s) => s.count > 0).map((s) => s.position));
    const firstFree = [1, 2, 3, 4, 5, 6].find((p) => !taken.has(p as never));
    expect(fresh.slot).toBe(firstFree);
    expect(placementText(fresh, 0, 'X')).toContain(`slot ${firstFree}`);
  });

  it('a full army only accepts a type it already has', () => {
    const base = cityRun();
    const template = base.army[0]!;
    const army = (['swordsman', 'knight', 'goblin', 'orc', 'shaman', 'wolf'] as const).map((unitId, i) => ({ ...template, stackId: `s${i}`, unitId, position: (i + 1) as never, count: 3 }));
    const full = cityRun({ army });
    const archer = recruitQuote(full, 'archer', 1);
    expect(archer.placement).toBe('full');
    expect(archer.blocker).toMatch(/Army full/);
    expect(recruitQuote(full, 'swordsman', 1).placement).toBe('merge');
    expect(recruitQuote(full, 'swordsman', 1).blocker).toBeNull();
  });
});

describe('building states', () => {
  it('reports built, locked by slots, unaffordable and buildable', () => {
    const run = cityRun({ gold: 1000 }, { buildings: ['market', 'stable', 'forge'] }); // level 1 has 3 slots
    expect(plotState(run, 'market')).toBe('built');
    expect(plotState(run, 'farm')).toBe('locked');
    expect(buildBlocker(run, 'farm')).toMatch(/No free building slot/);
    const open = cityRun({ gold: 10 });
    expect(plotState(open, 'farm')).toBe('unaffordable');
    expect(buildBlocker(open, 'farm')).toMatch(/Not enough Gold/);
    expect(plotState(cityRun(), 'farm')).toBe('buildable');
    expect(buildBlocker(cityRun(), 'farm')).toBeNull();
    expect(buildBlocker(run, 'market')).toBeNull();
  });

  it('every scene building exists in the engine and none is listed twice', () => {
    expect(new Set(SCENE_BUILDINGS).size).toBe(SCENE_BUILDINGS.length);
    // The Barracks (AO-D071) is a tiered building in the engine but its own fixed plot in the scene.
    expect([...SCENE_BUILDINGS, 'barracks'].sort()).toEqual(Object.keys(BUILDING_DEFINITIONS).sort());
  });
});

describe('ladders', () => {
  it('mage tower rows come from MAGE_TOWER_TIERS and mark built / next / locked', () => {
    const rows = tierRows('mage_tower', 1);
    expect(rows.map((r) => r.state)).toEqual(['built', 'next', 'locked']);
    expect(rows.map((r) => r.cost)).toEqual(MAGE_TOWER_TIERS.map((t) => t.cost));
    expect(rows[2]!.bonus).toBe(`Hero max Mana +${MAGE_TOWER_TIERS[2]!.maxMana}`);
  });

  it('farm rows cover all five tiers; an unbuilt farm starts at tier I as next', () => {
    expect(tierRows('farm', 0).map((r) => r.state)).toEqual(['next', 'locked', 'locked', 'locked', 'locked']);
    expect(tierRows('farm', 5).every((r) => r.state === 'built')).toBe(true);
    expect(tierRows('farm', 2)[4]!.bonus).toBe(`+${FARM_TIERS[4]!.food} Food per day`);
  });

  it('town hall rows list slots per level and the next upgrade', () => {
    const rows = levelRows(2);
    expect(rows.map((r) => r.slots)).toEqual([LEVEL_SLOTS[1], LEVEL_SLOTS[2], LEVEL_SLOTS[3]]);
    expect(rows.map((r) => r.state)).toEqual(['built', 'built', 'next']);
    expect(rows[0]!.cost).toBe(0);
  });
});

describe('activeEffects', () => {
  it('is empty for a bare city', () => {
    expect(activeEffects(cityRun())).toEqual([]);
  });

  it('lists every built building and the doctrine with engine numbers', () => {
    const run = cityRun({}, {
      level: 3,
      buildings: ['market', 'stable', 'forge', 'training_hall', 'farm', 'gold_mine', 'mage_tower', 'shrine'],
      farmTier: 3,
      mageTowerTier: 2,
      doctrine: 'economic',
    });
    const effects = activeEffects(run);
    expect(effects.map((e) => e.id)).toEqual(['market', 'stable', 'forge', 'training_hall', 'farm', 'gold_mine', 'mage_tower', 'shrine', 'economic']);
    expect(effects.find((e) => e.id === 'farm')!.text).toBe(`+${FARM_TIERS[2]!.food} Food every day.`);
    expect(effects.find((e) => e.id === 'mage_tower')!.text).toBe(`Hero max Mana +${MAGE_TOWER_TIERS[1]!.maxMana}.`);
    expect(effects.find((e) => e.id === 'forge')!.text).toBe('Army attack +5%.');
    expect(effects.find((e) => e.id === 'shrine')!.text).toContain('10%');
    expect(effects.find((e) => e.id === 'economic')!.text).toBe(DOCTRINE_DEFINITIONS.economic!.description);
  });

  it('a stable reports the Food it saves the current army', () => {
    const run = cityRun({}, { buildings: ['stable'] });
    const big = { ...run, army: run.army.map((s) => ({ ...s, count: 40 })) };
    expect(buildingEffect(big, 'stable')!.text).toMatch(/Saves \d+ Food a day/);
    expect(buildingEffect(run, 'market')).toBeNull();
  });
});
