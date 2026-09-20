import { describe, expect, it } from 'vitest';
import { MAX_ARMY_STACKS, createStack, findFreeArmyPosition } from '../../army.js';
import { roundSafe } from '../../floatSafe.js';
import { createRng } from '../../rng.js';
import type { Position, UnitId } from '../../types.js';
import {
  ARCANE_CASTER_MULTIPLIER,
  BUILDING_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  ECONOMIC_DOCTRINE_MULTIPLIER,
  FARM_TIERS,
  FORGE_DAMAGE_MULTIPLIER,
  MARKET_RECRUIT_DISCOUNT,
  MILITARY_DAMAGE_MULTIPLIER,
  NECROMANTIC_RAISE_RATIO,
  ROMAN,
  SHRINE_REVIVE_RATIO,
  STABLE_FOOD_DISCOUNT,
  TRAINING_HALL_MAX_MANA,
  createInitialCityState,
  farmDescription,
  recruitCost,
  settleArmyAfterVictory,
} from '../city.js';
import { moveFoodCost } from '../food.js';
import { RESOURCE_NODE_LOOT, rollResourceNode } from '../loot.js';
import { MERCHANT_CARD_PRICE, generateMerchantInventory } from '../merchant.js';
import { STARTING_FOOD, STARTING_GOLD, applyRunAction, createRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';

const pct = (fraction: number): number => Math.round(fraction * 100);
const atCity = (run: RunState): RunState => ({ ...run, phase: 'city', gold: 1000 });
const withBuilding = (id: string) => ({ ...createInitialCityState(), buildings: [id] });

describe('AO-042: MAX_ARMY_STACKS', () => {
  it('is six and drives the free-slot search, recruiting and splitting', () => {
    expect(MAX_ARMY_STACKS).toBe(6);
    const units: UnitId[] = ['archer', 'knight', 'priest', 'goblin', 'orc', 'wolf']; // no Swordsman: nothing to merge a recruit into
    const full = units.map((unitId, i) => createStack(unitId, 'player', (i + 1) as Position, 5));
    expect(full).toHaveLength(MAX_ARMY_STACKS);
    expect(findFreeArmyPosition(full)).toBeNull();
    expect(findFreeArmyPosition(full.slice(0, 5))).toBe(6);

    const city = { ...atCity(createRun(1)), army: full };
    const rejection = (action: RunAction) => applyRunAction(city, action).events.find((e) => e.type === 'ACTION_REJECTED');
    expect(rejection({ type: 'RECRUIT', unitId: 'swordsman', count: 1 })).toMatchObject({ reason: expect.stringContaining(`${MAX_ARMY_STACKS} stacks`) });
    expect(rejection({ type: 'SPLIT_STACK', stackId: full[0]!.stackId, splitCount: 2 })).toMatchObject({ reason: expect.stringContaining(`${MAX_ARMY_STACKS} stacks`) });
  });

  it('MOVE_STACK accepts positions up to it and rejects the next one', () => {
    const run = { ...createRun(2), phase: 'on_map' as const };
    const stack = run.army[0]!;
    expect(applyRunAction(run, { type: 'MOVE_STACK', stackId: stack.stackId, toPosition: MAX_ARMY_STACKS as Position }).events).toEqual([]);
    expect(applyRunAction(run, { type: 'MOVE_STACK', stackId: stack.stackId, toPosition: (MAX_ARMY_STACKS + 1) as Position }).events[0]).toMatchObject({ type: 'ACTION_REJECTED' });
  });
});

describe('AO-042: building and doctrine numbers are single constants, and the text is built from them', () => {
  it('Market: the recruit discount is the constant and the description prints it', () => {
    const plain = recruitCost(createInitialCityState(), 'swordsman', 1000)!.gold;
    const market = recruitCost(withBuilding('market'), 'swordsman', 1000)!.gold;
    expect(market / plain).toBeCloseTo(1 - MARKET_RECRUIT_DISCOUNT, 10);
    expect(BUILDING_DEFINITIONS.market!.description).toBe(`Recruitment costs -${pct(MARKET_RECRUIT_DISCOUNT)}% Gold.`);
  });

  it('Stable: the Food discount is the constant and the description prints it', () => {
    const army = [createStack('knight', 'player', 1, 200)]; // 100 Food a day
    const plain = moveFoodCost(army, createInitialCityState());
    expect(moveFoodCost(army, withBuilding('stable'))).toBe(Math.floor(plain * (1 - STABLE_FOOD_DISCOUNT)));
    expect(BUILDING_DEFINITIONS.stable!.description).toBe(`Movement Food cost -${pct(STABLE_FOOD_DISCOUNT)}%.`);
  });

  it('Training Hall: building it adds the constant to max Mana and Mana, and the description prints it', () => {
    const run = atCity(createRun(3));
    const built = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'training_hall' }).run;
    expect(built.hero.maxMana - run.hero.maxMana).toBe(TRAINING_HALL_MAX_MANA);
    expect(built.hero.mana - run.hero.mana).toBe(TRAINING_HALL_MAX_MANA);
    expect(BUILDING_DEFINITIONS.training_hall!.description).toBe(`Hero max Mana +${TRAINING_HALL_MAX_MANA}, immediately.`);
  });

  it('Forge: the combat effect is the constant and the description prints it', () => {
    expect(BUILDING_DEFINITIONS.forge!.combatEffects).toEqual([{ kind: 'PLAYER_DAMAGE_MULT', multiplier: FORGE_DAMAGE_MULTIPLIER }]);
    expect(BUILDING_DEFINITIONS.forge!.description).toBe(`Army attack +${pct(FORGE_DAMAGE_MULTIPLIER - 1)}%.`);
  });

  it('Shrine: revival follows the constant and the description prints it', () => {
    const before = createStack('swordsman', 'player', 1, 1000);
    const after = { ...before, count: 0, currentHp: 0 };
    const back = settleArmyAfterVictory([{ ...after, count: 1000 - 500, currentHp: 5000 }], withBuilding('shrine')).revived;
    expect(back).toBe(Math.floor(500 * SHRINE_REVIVE_RATIO));
    expect(BUILDING_DEFINITIONS.shrine!.description).toBe(`After every battle, ${pct(SHRINE_REVIVE_RATIO)}% of your casualties (rounded down) rise again.`);
  });

  it('doctrines: effects use the constants and the descriptions print them', () => {
    expect(DOCTRINE_DEFINITIONS.military!.combatEffects).toEqual([{ kind: 'PLAYER_DAMAGE_MULT', multiplier: MILITARY_DAMAGE_MULTIPLIER }]);
    expect(DOCTRINE_DEFINITIONS.military!.description).toBe(`Army damage +${pct(MILITARY_DAMAGE_MULTIPLIER - 1)}%.`);
    expect(DOCTRINE_DEFINITIONS.arcane!.combatEffects).toEqual([{ kind: 'TAG_DAMAGE_MULT', tag: 'caster', multiplier: ARCANE_CASTER_MULTIPLIER }]);
    expect(DOCTRINE_DEFINITIONS.arcane!.description).toBe(`Caster units (Mage) +${pct(ARCANE_CASTER_MULTIPLIER - 1)}% Attack.`);
    expect(DOCTRINE_DEFINITIONS.necromantic!.combatEffects).toEqual([{ kind: 'NECROMANCY', ratio: NECROMANTIC_RAISE_RATIO }]);
    expect(DOCTRINE_DEFINITIONS.necromantic!.description).toBe(`${pct(NECROMANTIC_RAISE_RATIO)}% of your casualties rise again as Skeletons.`);
    expect(DOCTRINE_DEFINITIONS.economic!.description).toBe(`Resource nodes yield +${pct(ECONOMIC_DOCTRINE_MULTIPLIER - 1)}% Gold/Food.`);
  });

  it('Economic Doctrine: a resource node pays exactly the plain roll times the constant', () => {
    const base = createRun(4);
    const current = base.worldMap.nodes.find((n) => n.id === base.worldMap.currentNodeId)!;
    const nextId = current.connectsTo[0]!;
    const worldMap = { ...base.worldMap, nodes: base.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'resource' as const } : n)) };
    const found = (doctrine: string | null) => applyRunAction({ ...base, worldMap, city: { ...base.city, doctrine } }, { type: 'MOVE_TO', nodeId: nextId }).events.find((e) => e.type === 'RESOURCE_FOUND')!;
    const rng = () => createRng(base.rng.seed);
    expect(found(null)).toMatchObject(rollResourceNode(rng(), 1));
    expect(found('economic')).toMatchObject(rollResourceNode(rng(), ECONOMIC_DOCTRINE_MULTIPLIER));
  });
});

describe('AO-042: loot, merchant and start constants', () => {
  it('resource nodes roll inside RESOURCE_NODE_LOOT (inclusive ends reachable) and scale by the multiplier', () => {
    const rng = createRng(11);
    const seen = { gold: new Set<number>(), food: new Set<number>() };
    for (let i = 0; i < 3000; i++) {
      const { gold, food } = rollResourceNode(rng, 1);
      seen.gold.add(gold);
      seen.food.add(food);
    }
    expect(Math.min(...seen.gold)).toBe(RESOURCE_NODE_LOOT.gold[0]);
    expect(Math.max(...seen.gold)).toBe(RESOURCE_NODE_LOOT.gold[1]);
    expect(Math.min(...seen.food)).toBe(RESOURCE_NODE_LOOT.food[0]);
    expect(Math.max(...seen.food)).toBe(RESOURCE_NODE_LOOT.food[1]);
    const scaled = rollResourceNode(createRng(5), 2);
    const plain = rollResourceNode(createRng(5), 1);
    expect(scaled).toEqual({ gold: roundSafe(plain.gold * 2), food: roundSafe(plain.food * 2) });
  });

  it('every merchant card costs MERCHANT_CARD_PRICE and buying one charges exactly that', () => {
    const run = createRun(6);
    const stock = generateMerchantInventory({ ...run.rng }, run.relics);
    expect(stock.cardOffers.length).toBeGreaterThan(0);
    for (const offer of stock.cardOffers) expect(offer.price).toBe(MERCHANT_CARD_PRICE);
    const shopping: RunState = { ...run, phase: 'merchant', pendingMerchant: stock, gold: 200 };
    const bought = applyRunAction(shopping, { type: 'BUY_CARD', cardId: stock.cardOffers[0]!.cardId }).run;
    expect(bought.gold).toBe(200 - MERCHANT_CARD_PRICE);
  });

  it('a new run starts with STARTING_GOLD and STARTING_FOOD', () => {
    const run = createRun(7, 'warlord', undefined, 'whetstone');
    expect(run.gold).toBe(STARTING_GOLD);
    expect(run.food).toBe(STARTING_FOOD);
    expect([STARTING_GOLD, STARTING_FOOD]).toEqual([100, 50]);
  });

  it('there is one ROMAN table and the tier descriptions use it', () => {
    expect(ROMAN.length).toBeGreaterThanOrEqual(FARM_TIERS.length);
    expect(farmDescription(1)).toContain(`Tier ${ROMAN[0]}`);
    expect(farmDescription(FARM_TIERS.length)).toContain(`Tier ${ROMAN[FARM_TIERS.length - 1]}`);
  });
});
