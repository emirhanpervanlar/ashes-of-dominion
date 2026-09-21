import { describe, expect, it } from 'vitest';
import { BARRACKS_TIERS, BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, FARM_TIERS, LEVEL_SLOTS, MAGE_TOWER_TIERS, GOLD_MINE_DAILY_GOLD, MARKET_RECRUIT_DISCOUNT, MINE, RECRUIT_COSTS, createRun, isGarrisonDay, mineDailyGold, recruitCost } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { FIXED_BUILDINGS, RECRUITABLE_UNITS, SCENE_BUILDINGS, activeEffects, barracksRows, buildBlocker, buildingArt, buildingEffect, buildingLevel, collectBlocker, dailyChange, daysToGarrison, garrisonRows, garrisonSlots, levelLabel, levelRows, placementText, plotState, recruitQuote, tierRows } from './cityView.js';

function cityRun(patch: Partial<RunState> = {}, city: Partial<RunState['city']> = {}): RunState {
  const run = createRun(7, 'warlord', 'Tester');
  return { ...run, phase: 'city', gold: 1000, food: 200, ...patch, city: { ...run.city, barracksTier: 4, ...city } };
}

describe('recruitQuote', () => {
  it('totals come from the engine cost and per-unit gold shows the Market discount', () => {
    const plain = cityRun();
    const q = recruitQuote(plain, 'swordsman', 10);
    expect(q.gold).toBe(recruitCost(plain.city, 'swordsman', 10)!.gold);
    expect(q.goldPerUnit).toBe(RECRUIT_COSTS.swordsman!.gold);
    expect(q.food).toBe(10 * RECRUIT_COSTS.swordsman!.food);
    const market = cityRun({}, { buildings: ['market'] });
    expect(recruitQuote(market, 'swordsman', 10).goldPerUnit).toBeCloseTo(RECRUIT_COSTS.swordsman!.gold * (1 - MARKET_RECRUIT_DISCOUNT));
    expect(recruitQuote(market, 'swordsman', 10).gold).toBeLessThan(q.gold);
  });

  it('max affordable is the largest count Gold and Food both allow', () => {
    const knight = RECRUIT_COSTS.knight!;
    const run = cityRun({ gold: 1000, food: knight.food * 3 });
    expect(recruitQuote(run, 'knight', 1).maxAffordable).toBe(3); // Food limits
    const rich = cityRun({ gold: knight.gold * 6, food: 500 });
    expect(recruitQuote(rich, 'knight', 1).maxAffordable).toBe(6); // Gold limits
    expect(recruitQuote(cityRun({ gold: 3 }), 'knight', 1).maxAffordable).toBe(0);
  });

  it('blocks on Gold, Food and a zero count, and lets an exact fit through', () => {
    const sword = RECRUIT_COSTS.swordsman!;
    expect(recruitQuote(cityRun({ gold: sword.gold * 10 - 1 }), 'swordsman', 10).blocker).toBe('Not enough Gold.');
    expect(recruitQuote(cityRun({ food: sword.food * 10 - 1 }), 'swordsman', 10).blocker).toBe('Not enough Food (every recruit costs Food too).');
    expect(recruitQuote(cityRun(), 'swordsman', 0).blocker).toBe('Choose how many to recruit.');
    expect(recruitQuote(cityRun({ gold: sword.gold * 10, food: sword.food * 10 }), 'swordsman', 10).blocker).toBeNull();
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
    expect(archer.blocker).toMatch(/Field army is full/);
    expect(recruitQuote(full, 'swordsman', 1).placement).toBe('merge');
    expect(recruitQuote(full, 'swordsman', 1).blocker).toBeNull();
  });
});

describe('recruit locks', () => {
  it('a unit above the Barracks tier is blocked with the engine reason', () => {
    expect(recruitQuote(cityRun({}, { barracksTier: 1 }), 'archer', 1).blocker).toMatch(/needs Barracks tier II/);
    expect(recruitQuote(cityRun({}, { barracksTier: 1 }), 'swordsman', 1).blocker).toBeNull();
  });
});

describe('barracks ladder and garrison', () => {
  it('rows follow BARRACKS_TIERS and mark built / next / locked', () => {
    const rows = barracksRows(2);
    expect(rows.map((r) => r.unitId)).toEqual(BARRACKS_TIERS.map((t) => t.unitId));
    expect(rows.map((r) => r.state)).toEqual(['built', 'built', 'next', 'locked']);
    expect(rows[2]!.cost).toBe(BARRACKS_TIERS[2]!.cost);
  });

  it('garrison rows show waiting, cap and weekly per unlocked type, and whether the army has room', () => {
    const run = cityRun({ garrison: { swordsman: 5, archer: 3 }, villages: 0 }, { barracksTier: 2 });
    const rows = garrisonRows(run);
    expect(rows.map((r) => r.unitId)).toEqual(['swordsman', 'archer']);
    expect(rows[0]).toMatchObject({ waiting: 5, weekly: 4, cap: 8, fits: true });
    expect(rows[1]).toMatchObject({ waiting: 3, weekly: 3, cap: 6 });
  });

  it('a type with no matching stack and no free slot does not fit', () => {
    const base = cityRun();
    const template = base.army[0]!;
    const army = (['swordsman', 'knight', 'goblin', 'orc', 'shaman', 'wolf'] as const).map((unitId, i) => ({ ...template, stackId: `s${i}`, unitId, position: (i + 1) as never, count: 3 }));
    const rows = garrisonRows(cityRun({ army, garrison: { swordsman: 2, archer: 2 } }, { barracksTier: 2 }));
    expect(rows.find((r) => r.unitId === 'swordsman')!.fits).toBe(true);
    expect(rows.find((r) => r.unitId === 'archer')!.fits).toBe(false);
  });

  it('counts the days to the next garrison day from the engine calendar', () => {
    for (const day of [1, 6, 7, 8, 13, 14]) {
      const n = daysToGarrison(day);
      expect(isGarrisonDay(day + n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      for (let k = 1; k < n; k++) expect(isGarrisonDay(day + k)).toBe(false);
    }
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
    expect([...SCENE_BUILDINGS].sort()).toEqual(Object.keys(BUILDING_DEFINITIONS).sort());
    // The four fixed plots (Barracks included, AO-D080) are not engine buildings that take a slot.
    for (const id of FIXED_BUILDINGS) expect(BUILDING_DEFINITIONS[id]).toBeUndefined();
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

describe('dailyChange', () => {
  it('adds the captured mines (max paying) to the Gold Mine building', () => {
    const plain = cityRun();
    expect(dailyChange({ ...plain, mines: 0 }).gold).toBe(0);
    expect(dailyChange({ ...plain, mines: 2 }).gold).toBe(mineDailyGold({ mines: 2 }));
    expect(dailyChange({ ...plain, mines: 9 }).gold).toBe(MINE.payingMines * MINE.dailyGold);
    const withBuilding = cityRun({}, { buildings: ['gold_mine'] });
    expect(dailyChange({ ...withBuilding, mines: 2 }).gold).toBe(GOLD_MINE_DAILY_GOLD + mineDailyGold({ mines: 2 }));
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

describe('building levels and art', () => {
  it('tiered buildings show their tier, the Town Hall its level, everything else one level; unbuilt optionals show none', () => {
    const run = cityRun({}, { level: 2, barracksTier: 2, buildings: ['farm', 'forge'], farmTier: 5, mageTowerTier: 1 });
    expect(buildingLevel(run.city, 'townhall')).toEqual({ level: 2, max: 3 });
    expect(buildingLevel(run.city, 'barracks')).toEqual({ level: 2, max: BARRACKS_TIERS.length });
    expect(buildingLevel(run.city, 'farm')).toEqual({ level: FARM_TIERS.length, max: FARM_TIERS.length });
    expect(buildingLevel(run.city, 'forge')).toEqual({ level: 1, max: 1 });
    expect(buildingLevel(run.city, 'mage_tower')).toBeNull();
    expect(buildingLevel(run.city, 'market')).toBeNull();
    expect(buildingLevel(run.city, 'temple')).toEqual({ level: 1, max: 1 });
  });

  it('the label is "Lv n" until the top level, then "Max"', () => {
    expect(levelLabel({ level: 2, max: 5 })).toBe('Lv 2');
    expect(levelLabel({ level: 5, max: 5 })).toBe('Max');
    expect(levelLabel({ level: 1, max: 1 })).toBe('Max');
  });

  it('grows the art from the first stage at level 1 to the last at max level', () => {
    expect(buildingArt('farm', null)).toBe('bld_farm');
    expect(buildingArt('farm', { level: 1, max: 5 })).toBe('bld_farm');
    expect(buildingArt('farm', { level: 3, max: 5 })).toBe('bld_farm_2');
    expect(buildingArt('farm', { level: 5, max: 5 })).toBe('bld_farm_3');
    expect(buildingArt('mage_tower', { level: 2, max: 3 })).toBe('bld_mage_tower_2');
    expect(buildingArt('barracks', { level: 4, max: 4 })).toBe('bld_barracks_3');
    expect(buildingArt('forge', { level: 1, max: 1 })).toBe('bld_forge');
  });
});

describe('garrison bar slots', () => {
  it('has one slot per Barracks tier: grown unit types first (with their cap), the rest empty', () => {
    const run = cityRun({ garrison: { swordsman: 5 } }, { barracksTier: 2 });
    const slots = garrisonSlots(run);
    expect(slots).toHaveLength(BARRACKS_TIERS.length);
    expect(slots[0]).toMatchObject({ unitId: 'swordsman', waiting: 5, cap: garrisonRows(run)[0]!.cap });
    expect(slots[1]).toMatchObject({ unitId: 'archer', waiting: 0 });
    expect(slots[2]).toBeNull();
    expect(slots[3]).toBeNull();
  });

  it('a slot is collectable only when something waits and the army has room', () => {
    const run = cityRun({ garrison: { swordsman: 5 } }, { barracksTier: 2 });
    const [sword, archer] = garrisonSlots(run) as NonNullable<ReturnType<typeof garrisonSlots>[number]>[];
    expect(collectBlocker(sword!)).toBeNull();
    expect(collectBlocker(archer!)).toBe('No Archer waiting.');
    expect(collectBlocker({ ...sword!, fits: false })).toMatch(/^Army full/);
  });
});
