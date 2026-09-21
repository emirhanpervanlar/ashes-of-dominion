import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { HERO_DEFINITIONS } from '../data/heroes.js';
import { generateEnemyIntents } from '../intents.js';
import { applyRunAction, createRun } from '../run/runEngine.js';
import { createHero, createVerticalSliceScenario } from '../scenario.js';
import type { RunState } from '../run/types.js';
import type { ArmyStack, CombatEvent, CombatState, HeroId, Position, UnitId } from '../types.js';

function fightingRun(mutate: (run: RunState) => RunState = (r) => r): RunState {
  const run = mutate(createRun(5, 'warlord'));
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n));
  return applyRunAction({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

describe('AO-D065 mana', () => {
  it('fresh heroes start at Warlord 3, Rogue 3, Mage 4', () => {
    expect(createHero('warlord').maxMana).toBe(3);
    expect(createHero('rogue').maxMana).toBe(3);
    expect(createHero('mage').maxMana).toBe(4);
    for (const id of ['warlord', 'rogue', 'mage'] as const) expect(HERO_DEFINITIONS[id].baseMana).toBe(3);
  });

  it('a battle never starts below max Mana even when the hero carries 0 from the previous one', () => {
    const run = fightingRun((r) => ({ ...r, hero: { ...r.hero, mana: 0 } }));
    expect(run.combat!.hero.mana).toBe(run.combat!.hero.maxMana);
    expect(run.combat!.hero.maxMana).toBe(3);
  });

  it('win a battle spending Mana, start another: Mana is max again', () => {
    let run = fightingRun();
    const spent = { ...run.combat!, hero: { ...run.combat!.hero, mana: 0 }, enemyArmy: run.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    run = applyRunAction({ ...run, combat: spent }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(run.phase).toBe('reward');
    expect(run.hero.mana).toBe(0);
    const again = fightingRun(() => ({ ...run, phase: 'on_map', pendingReward: null, combat: null }));
    expect(again.combat!.hero.mana).toBe(3);
  });
});

// ---------- shared combat helpers ----------
function battle(playerArmy: ArmyStack[], enemyArmy: ArmyStack[], cardIds: string[] = [], heroId: HeroId = 'warlord'): CombatState {
  const { state } = createVerticalSliceScenario(1, heroId);
  const base: CombatState = {
    ...state,
    hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 }, mana: 10, maxMana: 10 },
    playerArmy,
    enemyArmy,
    hand: cardIds.map((cardId, i) => ({ instanceId: `t_${cardId}_${i}`, cardId })),
    deck: [],
    discard: [],
  };
  return { ...base, enemyIntents: generateEnemyIntents(base) };
}

const big = (unitId: UnitId, position: Position, count = 100): ArmyStack => createStack(unitId, 'player', position, count);
const foe = (unitId: UnitId, position: Position, count = 10): ArmyStack => createStack(unitId, 'enemy', position, count);
const freezeOf = (s: ArmyStack): ArmyStack => ({ ...s, statuses: [...s.statuses, { type: 'freeze', amount: 1, duration: 1 }] });
const attacksBy = (events: CombatEvent[], stackId: string) => events.filter((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId === stackId);
const rejection = (events: CombatEvent[]) => events.flatMap((e) => (e.type === 'ACTION_REJECTED' ? [e.reason] : []))[0];

describe('AO-D066 frozen stacks do not act', () => {
  it('a stack frozen after its intent was planned does not attack; it acts again the turn after', () => {
    const planned = battle([big('swordsman', 1)], [foe('goblin', 1), foe('goblin', 2)]);
    expect(planned.enemyIntents.map((i) => i.stackId).sort()).toEqual(['enemy_goblin_1', 'enemy_goblin_2']);
    const frozen: CombatState = { ...planned, enemyArmy: planned.enemyArmy.map((s) => (s.stackId === 'enemy_goblin_1' ? freezeOf(s) : s)) };

    const first = applyPlayerAction(frozen, { type: 'END_TURN' });
    expect(attacksBy(first.events, 'enemy_goblin_1')).toHaveLength(0);
    expect(attacksBy(first.events, 'enemy_goblin_2').length).toBeGreaterThan(0);
    expect(first.state.enemyArmy[0]!.statuses.some((s) => s.type === 'freeze')).toBe(false);

    const second = applyPlayerAction(first.state, { type: 'END_TURN' });
    expect(attacksBy(second.events, 'enemy_goblin_1').length).toBeGreaterThan(0);
  });

  it('a frozen stack gets no intent when the plan is generated', () => {
    const state = battle([big('swordsman', 1)], [freezeOf(foe('goblin', 1)), foe('goblin', 2)]);
    expect(state.enemyIntents.map((i) => i.stackId)).toEqual(['enemy_goblin_2']);
  });

  it('a frozen player stack cannot use its basic action nor an attack card', () => {
    const state = battle([freezeOf(big('swordsman', 1)), big('knight', 2)], [foe('goblin', 1)], ['shield_bash']);
    const basic = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_goblin_1' });
    expect(rejection(basic.events)).toContain('cannot act');
    const card = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: 't_shield_bash_0', actingStackId: 'player_swordsman_1', targetStackId: 'enemy_goblin_1' });
    expect(rejection(card.events)).toContain('cannot act');
    expect(card.state.hero.mana).toBe(10);
  });

  it('a stack locked by cannotAttack is skipped on the enemy side too', () => {
    const planned = battle([big('swordsman', 1)], [foe('goblin', 1)]);
    const locked: CombatState = { ...planned, enemyArmy: planned.enemyArmy.map((s) => ({ ...s, flags: { cannotAttack: true } })) };
    expect(attacksBy(applyPlayerAction(locked, { type: 'END_TURN' }).events, 'enemy_goblin_1')).toHaveLength(0);
  });
});

describe('AO-D067 battle end window', () => {
  const lastKill = () => {
    const wounded = { ...big('swordsman', 2, 10), count: 10, currentHp: 40 };
    const state = battle([big('swordsman', 1, 50), wounded, big('priest', 4, 10)], [foe('goblin', 1, 1)]);
    return applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_goblin_1' });
  };

  it('killing the last enemy leaves the battle running with enemiesCleared set', () => {
    const { state, events } = lastKill();
    expect(state.enemyArmy.every((s) => s.count === 0)).toBe(true);
    expect(state.enemiesCleared).toBe(true);
    expect(state.result).toBe('ongoing');
    expect(state.phase).toBe('player');
    expect(events.some((e) => e.type === 'BATTLE_ENDED')).toBe(false);
  });

  it('a healer can still heal after the last kill, and END_TURN then wins without an enemy turn', () => {
    const { state } = lastKill();
    const healed = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_priest_4', targetStackId: 'player_swordsman_2' });
    expect(healed.events.some((e) => e.type === 'STACK_HEALED')).toBe(true);
    expect(healed.state.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!.currentHp).toBeGreaterThan(40);
    expect(healed.state.result).toBe('ongoing');

    const done = applyPlayerAction(healed.state, { type: 'END_TURN' });
    expect(done.state.result).toBe('victory');
    expect(done.state.phase).toBe('ended');
    expect(done.events.some((e) => e.type === 'TURN_STARTED' || e.type === 'ENEMY_TURN_RESOLVED')).toBe(false);
    expect(done.events.filter((e) => e.type === 'BATTLE_ENDED')).toHaveLength(1);
  });

  it('AO-D079: without a healer the last kill wins the battle at once, with no End Turn needed', () => {
    const state = battle([big('swordsman', 1, 50), big('archer', 4, 10)], [foe('goblin', 1, 1)]);
    const { state: after, events } = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_goblin_1' });
    expect(after.result).toBe('victory');
    expect(after.phase).toBe('ended');
    expect(events.filter((e) => e.type === 'BATTLE_ENDED')).toEqual([{ type: 'BATTLE_ENDED', result: 'victory' }]);
  });

  it('AO-D079: a healer that has already died no longer keeps the window open', () => {
    const dead = { ...big('priest', 4, 10), count: 0, currentHp: 0 };
    const state = battle([big('swordsman', 1, 50), dead], [foe('goblin', 1, 1)]);
    const { state: after } = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_goblin_1' });
    expect(after.result).toBe('victory');
    expect(after.phase).toBe('ended');
  });

  it('AO-D079: a card kill with no healer ends the battle at once through the run reducer too', () => {
    let run = fightingRun();
    expect(run.army.some((s) => s.unitId === 'priest')).toBe(false);
    const one = run.combat!.enemyArmy.map((s, i) => (i === 0 ? { ...s, count: 1, currentHp: 1 } : { ...s, count: 0, currentHp: 0 }));
    run = { ...run, combat: { ...run.combat!, enemyArmy: one } };
    const attacker = run.combat!.playerArmy.find((s) => s.unitId === 'swordsman')!;
    const target = one[0]!;
    const result = applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'BASIC_ACTION', stackId: attacker.stackId, targetStackId: target.stackId } });
    expect(result.run.phase).toBe('reward');
  });

  it('enemies are not cleared while any stack lives', () => {
    const state = battle([big('swordsman', 1, 50)], [foe('goblin', 1, 1), foe('goblin', 2, 5)]);
    const r = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_goblin_1' });
    expect(r.state.enemiesCleared).toBe(false);
  });

  it('a run only reaches the reward after the End Turn that follows the last kill', () => {
    let run = fightingRun();
    const cleared = { ...run.combat!, enemiesCleared: true, enemyArmy: run.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    run = { ...run, combat: cleared };
    expect(run.phase).toBe('in_battle');
    expect(applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run.phase).toBe('reward');
  });
});

describe('AO-D069 reach: back-row melee vs any front ally; healers never blocked', () => {
  it('owner repro: front row holds only a right-lane unit, back centre + right melee are blocked', () => {
    const enemy = [foe('orc', 3, 5), foe('goblin', 5, 5), foe('goblin', 6, 5)];
    const state = battle([big('swordsman', 1, 50)], enemy);
    expect(state.enemyIntents.map((i) => i.stackId)).toEqual(['enemy_orc_3']);
    const result = applyPlayerAction(state, { type: 'END_TURN' });
    expect(attacksBy(result.events, 'enemy_goblin_5')).toHaveLength(0);
    expect(attacksBy(result.events, 'enemy_goblin_6')).toHaveLength(0);
    expect(attacksBy(result.events, 'enemy_orc_3').length).toBeGreaterThan(0);
  });

  it('a player back-row swordsman is blocked by a front stack in another lane', () => {
    const state = battle([big('knight', 3, 5), big('swordsman', 4, 10)], [foe('orc', 1, 5)]);
    const r = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_4', targetStackId: 'enemy_orc_1' });
    expect(rejection(r.events)).toContain('cannot attack while a friendly stack stands in front');
  });

  it('a Priest heals from the back row behind front allies, itself included', () => {
    const priest = { ...big('priest', 5, 10), currentHp: 30 };
    const state = battle([big('swordsman', 1, 10), priest], [foe('orc', 1, 5)]);
    const self = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_priest_5', targetStackId: 'player_priest_5' });
    expect(self.events.some((e) => e.type === 'STACK_HEALED')).toBe(true);
    expect(self.state.playerArmy.find((s) => s.stackId === 'player_priest_5')!.currentHp).toBeGreaterThan(30);
  });

  it('the Heal card is not blocked by reach either', () => {
    const state = battle([big('swordsman', 1, 10), { ...big('priest', 5, 10), currentHp: 30 }], [foe('orc', 1, 5)], ['heal']);
    const r = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: 't_heal_0', actingStackId: 'player_priest_5', targetStackId: 'player_priest_5' });
    expect(rejection(r.events)).toBeUndefined();
  });
});
