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
