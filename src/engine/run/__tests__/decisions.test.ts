import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import { applyPlayerAction, startBattle } from '../../combat.js';
import { CARD_DEFINITIONS } from '../../data/cards.js';
import { HERO_DEFINITIONS } from '../../data/heroes.js';
import { createRng } from '../../rng.js';
import { createHero } from '../../scenario.js';
import type { ArmyStack, CombatState, HeroId, Position } from '../../types.js';
import { applyRunAction, createRun } from '../runEngine.js';
import { buildPendingReward } from '../rewards.js';
import type { RunState } from '../types.js';

const HEROES: HeroId[] = ['warlord', 'rogue', 'mage'];

function inCity(run: RunState, army: ArmyStack[]): RunState {
  return { ...run, phase: 'city', army, gold: 1000, food: 1000 };
}

describe('AO-D007: starting armies per hero', () => {
  const expected: Record<HeroId, Array<[string, number]>> = {
    warlord: [['swordsman', 6], ['knight', 2]],
    rogue: [['archer', 6], ['knight', 2]],
    mage: [['archer', 4], ['priest', 4]],
  };

  for (const hero of HEROES) {
    it(`${hero} starts a run with exactly ${JSON.stringify(expected[hero])}`, () => {
      const run = createRun(11, hero);
      expect(run.army.map((s) => [s.unitId, s.count]).sort()).toEqual([...expected[hero]].sort());
      expect(run.army.every((s) => s.currentHp === s.maxHp && s.preBattleMaxCount === s.count)).toBe(true);
      expect(HERO_DEFINITIONS[hero].startingArmy.map((e) => [e.unitId, e.count]).sort()).toEqual([...expected[hero]].sort());
    });
  }

  it('ranged and healing units start in the backline, melee up front, on distinct positions', () => {
    for (const hero of HEROES) {
      const army = createRun(12, hero).army;
      expect(new Set(army.map((s) => s.position)).size).toBe(army.length);
      for (const s of army) {
        const backliner = s.unitId === 'archer' || s.unitId === 'priest';
        expect(s.position > 3).toBe(backliner);
      }
    }
  });
});

describe('AO-D006: post-battle reward', () => {
  it('never offers relics and never more than 3 card+upgrade choices, for every hero deck and many seeds', () => {
    for (const hero of HEROES) {
      const deck = createRun(1, hero).masterDeck;
      for (let seed = 1; seed <= 40; seed++) {
        const reward = buildPendingReward(createRng(seed), [], deck);
        expect(reward.relicOptions).toEqual([]);
        const total = reward.cardOptions.length + reward.upgradeOptions.length;
        expect(total).toBeGreaterThan(0);
        expect(total).toBeLessThanOrEqual(3);
        expect(new Set(reward.cardOptions).size).toBe(reward.cardOptions.length);
        expect(reward.cardOptions.every((id) => CARD_DEFINITIONS[id] && !id.endsWith('_plus'))).toBe(true);
      }
    }
  });

  it('a won battle in a real run carries that reward, and a relic claim is rejected', () => {
    let run = applyRunAction(createRun(21, 'rogue'), { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' }).run;
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const nextId = current.connectsTo[0]!;
    run = { ...run, worldMap: { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n)) } };
    run = applyRunAction(run, { type: 'MOVE_TO', nodeId: nextId }).run;
    const wiped: CombatState = { ...run.combat!, enemyArmy: run.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    run = applyRunAction({ ...run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;

    expect(run.phase).toBe('reward');
    const reward = run.pendingReward!;
    expect(reward.relicOptions).toEqual([]);
    expect(reward.cardOptions.length + reward.upgradeOptions.length).toBeLessThanOrEqual(3);
    const relicsBefore = run.relics.length;
    const claim = applyRunAction(run, { type: 'CLAIM_RELIC', relicId: 'royal_banner' });
    expect(claim.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(applyRunAction(claim.run, { type: 'CONFIRM_REWARD' }).run.relics).toHaveLength(relicsBefore);
  });
});

describe('AO-D008: recruits join the field army directly (max 6 stacks)', () => {
  const sixStacks = (): ArmyStack[] =>
    (['swordsman', 'knight', 'archer', 'priest'] as const).flatMap((unit, i) => [createStack(unit, 'player', (i + 1) as Position, 4)]).concat([
      { ...createStack('swordsman', 'player', 5, 3), stackId: 'player_swordsman_5' },
      { ...createStack('knight', 'player', 6, 3), stackId: 'player_knight_6' },
    ]);

  it('merges into an existing stack of the same type with no new stack', () => {
    const run = inCity(createRun(31), sixStacks());
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'archer', count: 5 });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(result.run.army).toHaveLength(6);
    const archer = result.run.army.find((s) => s.unitId === 'archer')!;
    expect(archer).toMatchObject({ count: 9, currentHp: 9 * 6, maxHp: 9 * 6, preBattleMaxCount: 9 });
    expect(result.run.gold).toBeLessThan(1000);
  });

  it('rejects a new type when 6 stacks are full and spends nothing', () => {
    const full = sixStacks().filter((s) => s.unitId !== 'priest').concat([createStack('archer', 'player', 4, 2), createStack('knight', 'player', 3, 1)]);
    // 6 living stacks, none a Priest.
    const army = full.slice(0, 6).map((s, i) => ({ ...s, position: (i + 1) as Position, stackId: `player_${s.unitId}_${i + 1}` }));
    expect(army).toHaveLength(6);
    expect(army.some((s) => s.unitId === 'priest')).toBe(false);
    const run = inCity(createRun(32), army);
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'priest', count: 3 });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(result.run.army).toHaveLength(6);
    expect(result.run.gold).toBe(1000);
    expect(result.run.food).toBe(1000);
  });

  it('places a new type in a free slot as a full-health living stack', () => {
    const run = inCity(createRun(33), createRun(33).army);
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'priest', count: 5 });
    const priest = result.run.army.find((s) => s.unitId === 'priest')!;
    expect(priest).toMatchObject({ count: 5, currentHp: 40, maxHp: 40, preBattleMaxCount: 5 });
    expect(new Set(result.run.army.map((s) => s.position)).size).toBe(result.run.army.length);
  });

  it('there is no garrison: the run state has no garrison field and recruiting is rejected outside the city', () => {
    const run = createRun(34);
    expect(Object.keys(run)).not.toContain('garrison');
    expect(Object.keys(run.city)).not.toContain('garrison');
    const result = applyRunAction({ ...run, phase: 'on_map' }, { type: 'RECRUIT', unitId: 'swordsman', count: 1 });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('recruited units are fully usable in battle (healer-cannot-heal-Swordsman hunt)', () => {
  function fight(army: ArmyStack[]): CombatState {
    const { state } = startBattle({
      seed: 5,
      rng: createRng(5),
      hero: { ...createHero('mage'), stats: { ...createHero('mage').stats, dexterity: 0 } },
      playerArmy: army,
      enemyArmy: [createStack('orc', 'enemy', 1, 10), createStack('orc', 'enemy', 2, 10)],
      deck: [{ instanceId: 'gh#0', cardId: 'greater_heal' }],
    });
    return { ...state, hand: [{ instanceId: 'gh#0', cardId: 'greater_heal' }], hero: { ...state.hero, mana: 6, maxMana: 6 } };
  }

  it('a Swordsman recruited into a Mage army can be healed by the Priest (basic action and card)', () => {
    const recruited = applyRunAction(inCity(createRun(41, 'mage'), createRun(41, 'mage').army), { type: 'RECRUIT', unitId: 'swordsman', count: 6 }).run.army;
    const sword = recruited.find((s) => s.unitId === 'swordsman')!;
    const priest = recruited.find((s) => s.unitId === 'priest')!;
    const army = recruited.map((s) => (s.stackId === sword.stackId ? { ...s, count: 3, currentHp: 30 } : s));
    const state = fight(army);

    const basic = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: priest.stackId, targetStackId: sword.stackId });
    expect(basic.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(basic.state.playerArmy.find((s) => s.stackId === sword.stackId)!.currentHp).toBeGreaterThan(30);

    const card = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: 'gh#0', actingStackId: priest.stackId, targetStackId: sword.stackId });
    expect(card.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(card.state.playerArmy.find((s) => s.stackId === sword.stackId)!.currentHp).toBeGreaterThan(30);
  });

  it('every stack in a run army has a unique stackId after recruiting into a slot freed by a wiped stack', () => {
    // Warlord's Swordsman stack was wiped in an earlier battle (count 0 stays in the army list); recruit Swordsmen again.
    const base = createRun(42).army.map((s) => (s.unitId === 'swordsman' ? { ...s, count: 0, currentHp: 0 } : s));
    const after = applyRunAction(inCity(createRun(42), base), { type: 'RECRUIT', unitId: 'swordsman', count: 5 }).run.army;
    const ids = after.map((s) => s.stackId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Same bug seen from combat: replaceStack writes to the first stack with the id (the wiped one), so the live recruit was never healed.
  it('a recruited Swordsman takes a hit and is healed in battle when a wiped Swordsman stack shared its slot', () => {
    const wiped = createRun(43, 'mage').army.concat([{ ...createStack('swordsman', 'player', 1, 6), count: 0, currentHp: 0 }]);
    const recruited = applyRunAction(inCity(createRun(43, 'mage'), wiped), { type: 'RECRUIT', unitId: 'swordsman', count: 6 }).run.army;
    const sword = recruited.find((s) => s.unitId === 'swordsman' && s.count > 0)!;
    const priest = recruited.find((s) => s.unitId === 'priest')!;
    const state = fight(recruited.map((s) => (s === sword ? { ...s, count: 3, currentHp: 30 } : s)));
    const result = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: priest.stackId, targetStackId: sword.stackId });
    const livingSwordsmen = result.state.playerArmy.filter((s) => s.count > 0 && s.unitId === 'swordsman');
    expect(livingSwordsmen).toHaveLength(1);
    expect(livingSwordsmen[0]!.currentHp).toBeGreaterThan(30);
  });

  it('stackIds stay unique through wipe-in-battle, recruit, split and merge', () => {
    let run = createRun(44);
    const ids = () => run.army.map((s) => s.stackId);
    const unique = () => expect(new Set(ids()).size).toBe(ids().length);
    const swordId = run.army.find((s) => s.unitId === 'swordsman')!.stackId;

    // Victory with the Swordsman stack wiped in the battle.
    const wipedBattle: CombatState = {
      ...startBattle({ seed: 44, rng: createRng(44), hero: run.hero, playerArmy: run.army, enemyArmy: [createStack('orc', 'enemy', 1, 1)], deck: run.masterDeck }).state,
    };
    const state: CombatState = {
      ...wipedBattle,
      playerArmy: wipedBattle.playerArmy.map((s) => (s.stackId === swordId ? { ...s, count: 0, currentHp: 0 } : s)),
      enemyArmy: wipedBattle.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    run = applyRunAction({ ...run, phase: 'in_battle', combat: state }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(run.phase).toBe('reward');
    unique();

    run = { ...run, phase: 'city', gold: 1000, food: 1000 };
    run = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 6 }).run;
    unique();
    const recruited = run.army.find((s) => s.unitId === 'swordsman')!;
    run = applyRunAction(run, { type: 'SPLIT_STACK', stackId: recruited.stackId, splitCount: 2 }).run;
    unique();
    expect(run.army.filter((s) => s.unitId === 'swordsman')).toHaveLength(2);
    const [a, b] = run.army.filter((s) => s.unitId === 'swordsman');
    run = applyRunAction(run, { type: 'MERGE_STACKS', stackIdA: a!.stackId, stackIdB: b!.stackId }).run;
    unique();
    expect(run.army.filter((s) => s.unitId === 'swordsman')).toHaveLength(1);
  });
});

describe('Royal Banner / Arcane Crystal keep the heal cap consistent (AO-D004)', () => {
  function healed(relicId: string, wound: number) {
    const boosted = applyRunAction(createRun(51), { type: 'CHOOSE_STARTING_RELIC', relicId }).run.army;
    const sword = boosted.find((s) => s.unitId === 'swordsman')!;
    const priest = createStack('priest', 'player', 5, 4);
    const army = [...boosted, priest].map((s) => (s.stackId === sword.stackId ? { ...s, currentHp: s.maxHp - wound } : s));
    const { state } = startBattle({
      seed: 5,
      rng: createRng(5),
      hero: createHero('warlord'),
      playerArmy: army,
      enemyArmy: [createStack('orc', 'enemy', 1, 10)],
      deck: [],
    });
    const result = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: priest.stackId, targetStackId: sword.stackId });
    const event = result.events.find((e) => e.type === 'STACK_HEALED');
    return { sword, after: result.state.playerArmy.find((s) => s.stackId === sword.stackId)!, event };
  }

  it('relic-boosted stacks have every count field in step', () => {
    for (const relicId of ['royal_banner', 'arcane_crystal']) {
      const sword = applyRunAction(createRun(50), { type: 'CHOOSE_STARTING_RELIC', relicId }).run.army.find((s) => s.unitId === 'swordsman')!;
      expect(sword.startingCount).toBe(sword.count);
      expect(sword.preBattleMaxCount).toBe(sword.count);
      expect(sword.currentHp).toBe(sword.maxHp);
    }
  });

  it('a full-health Royal Banner Swordsman x12 is not changed by a Priest heal (never negative)', () => {
    const { sword, after, event } = healed('royal_banner', 0);
    expect(sword.count).toBe(12);
    if (event && event.type === 'STACK_HEALED') expect(event.amount).toBe(0);
    expect(after.currentHp).toBe(sword.maxHp);
    expect(after.count).toBe(12);
  });

  it('a wounded Royal Banner Swordsman heals, but only up to the boosted cap', () => {
    const wounded = healed('royal_banner', 5);
    expect(wounded.after.currentHp).toBeGreaterThan(wounded.sword.maxHp - 5);
    expect(wounded.after.currentHp).toBeLessThanOrEqual(wounded.sword.maxHp);
    const grievous = healed('royal_banner', 200);
    expect(grievous.after.currentHp).toBeGreaterThan(grievous.sword.maxHp - 200);
    expect(grievous.after.currentHp).toBeLessThanOrEqual(grievous.sword.maxHp);
  });

  it('Arcane Crystal (-10%) full-health stack is also unchanged by a heal', () => {
    const { sword, after } = healed('arcane_crystal', 0);
    expect(after.currentHp).toBe(sword.maxHp);
    expect(after.count).toBe(sword.count);
  });
});
