import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { applyDamageToStack, applyHealToStack } from '../damage.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { generateEnemyIntents } from '../intents.js';
import { createVerticalSliceScenario } from '../scenario.js';
import { computeValidTargets } from '../targeting.js';
import type { ArmyStack, CombatEvent, CombatState, HeroId, Position, UnitId } from '../types.js';

/** Hand-built battle: seeded scenario for hero/deck/rng, but armies, hand and intents are ours. Dexterity 0 = no dodge rolls. */
function battle(playerArmy: ArmyStack[], enemyArmy: ArmyStack[], cardIds: string[] = [], heroId: HeroId = 'warlord'): CombatState {
  const { state } = createVerticalSliceScenario(1, heroId);
  return {
    ...state,
    hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 }, mana: 10, maxMana: 10 },
    playerArmy,
    enemyArmy,
    hand: cardIds.map((cardId, i) => ({ instanceId: `t_${cardId}_${i}`, cardId })),
    enemyIntents: [],
  };
}

function dead(stack: ArmyStack): ArmyStack {
  return { ...stack, count: 0, currentHp: 0 };
}

function wounded(stack: ArmyStack, count: number): ArmyStack {
  return { ...stack, count, currentHp: count * UNIT_DEFINITIONS[stack.unitId].hpPerUnit };
}

function rejection(events: CombatEvent[]): string | undefined {
  const e = events.find((ev) => ev.type === 'ACTION_REJECTED');
  return e && e.type === 'ACTION_REJECTED' ? e.reason : undefined;
}

function attacksBy(events: CombatEvent[], attackerStackId: string) {
  return events.flatMap((e) => (e.type === 'STACK_ATTACKED' && e.attackerStackId === attackerStackId ? [e] : []));
}

function stackOf(state: CombatState, stackId: string): ArmyStack {
  return state.playerArmy.find((s) => s.stackId === stackId)!;
}

const enemyOrcs = () => [createStack('orc', 'enemy', 1, 10), createStack('orc', 'enemy', 2, 10), createStack('orc', 'enemy', 3, 10)];

describe('AO-001 review gap: card path with no legal target', () => {
  it('a unit card is rejected with "no target in reach" when the melee stack has no front target, spending nothing', () => {
    const enemy = [dead(createStack('orc', 'enemy', 1, 10)), dead(createStack('orc', 'enemy', 2, 10)), dead(createStack('orc', 'enemy', 3, 10)), createStack('goblin', 'enemy', 4, 10)];
    const state = battle([createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 2, 2)], enemy, ['charge']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: state.hand[0]!.instanceId,
      actingStackId: 'player_swordsman_1',
      targetStackId: 'enemy_goblin_4',
    });
    expect(rejection(result.events)).toContain('no target in reach');
    expect(result.state.hero.mana).toBe(10);
    expect(result.state.hand).toHaveLength(1);
    expect(result.state.enemyArmy.find((s) => s.stackId === 'enemy_goblin_4')!.count).toBe(10);
  });
});

describe('AO-D002: melee never reaches the backline, ranged does', () => {
  const backline = () => [createStack('goblin', 'enemy', 4, 10), createStack('shaman', 'enemy', 5, 8), createStack('goblin', 'enemy', 6, 10)];

  it('a player melee stack lists no target when every enemy front slot is dead, but an archer still lists the backline', () => {
    const enemy = [...enemyOrcs().map(dead), ...backline()];
    for (const pos of [1, 2, 3] as Position[]) {
      const melee = computeValidTargets(createStack('swordsman', 'player', pos, 5), enemy, UNIT_DEFINITIONS.swordsman);
      expect(melee).toEqual([]);
    }
    const archer = computeValidTargets(createStack('archer', 'player', 4, 5), enemy, UNIT_DEFINITIONS.archer);
    expect(archer.map((s) => s.position).sort()).toEqual([4, 5, 6]);
  });

  it('an ENEMY melee stack never lists a player backline stack, even when the whole front is dead', () => {
    const player = [dead(createStack('swordsman', 'player', 1, 6)), dead(createStack('knight', 'player', 2, 2)), createStack('archer', 'player', 4, 4), createStack('priest', 'player', 5, 4)];
    for (const unit of ['orc', 'goblin', 'wolf', 'shaman'] as UnitId[]) {
      for (const pos of [1, 2, 3] as Position[]) {
        expect(computeValidTargets(createStack(unit, 'enemy', pos, 5), player, UNIT_DEFINITIONS[unit])).toEqual([]);
      }
    }
  });

  it('enemy intents never plan an attack on a backline stack while only the front is unreachable', () => {
    const player = [createStack('swordsman', 'player', 3, 6), createStack('archer', 'player', 4, 4), createStack('priest', 'player', 5, 4)];
    for (const formation of ['horde', 'guarded_shaman', 'wolf_pack', 'elite_guard'] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const { state: base } = createVerticalSliceScenario(seed, 'warlord', formation);
        const intents = generateEnemyIntents({ ...base, playerArmy: player });
        for (const intent of intents.filter((i) => i.kind === 'attack')) {
          expect(player.find((s) => s.stackId === intent.targetStackId)!.position).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('a melee enemy with a dead front lane and no front target plans no attack at all', () => {
    const player = [dead(createStack('swordsman', 'player', 1, 6)), dead(createStack('knight', 'player', 2, 2)), dead(createStack('swordsman', 'player', 3, 2)), createStack('archer', 'player', 4, 4)];
    const { state: base } = createVerticalSliceScenario(3, 'warlord', 'guarded_shaman');
    const intents = generateEnemyIntents({ ...base, playerArmy: player });
    expect(intents.filter((i) => i.kind === 'attack')).toEqual([]);
  });
});

describe('AO-001 review gap: melee enemy whose planned target died', () => {
  it('re-picks a reachable FRONT stack of its own lane', () => {
    const player = [createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 2, 2), dead(createStack('archer', 'player', 4, 4)), createStack('priest', 'player', 5, 4)];
    const state = {
      ...battle(player, [createStack('orc', 'enemy', 1, 10)]),
      enemyIntents: [{ stackId: 'enemy_orc_1', kind: 'attack' as const, targetStackId: 'player_archer_4' }],
    };
    const result = applyPlayerAction(state, { type: 'END_TURN' });
    const hits = attacksBy(result.events, 'enemy_orc_1');
    expect(hits).toHaveLength(1);
    expect(['player_swordsman_1', 'player_knight_2']).toContain(hits[0]!.targetStackId);
    expect(stackOf(result.state, 'player_priest_5').currentHp).toBe(stackOf(state, 'player_priest_5').currentHp);
  });

  it('never falls back to the backline when no front stack is reachable', () => {
    const player = [dead(createStack('swordsman', 'player', 1, 6)), dead(createStack('knight', 'player', 2, 2)), dead(createStack('archer', 'player', 4, 4)), createStack('priest', 'player', 5, 4)];
    const state = {
      ...battle(player, [createStack('orc', 'enemy', 1, 10)]),
      enemyIntents: [{ stackId: 'enemy_orc_1', kind: 'attack' as const, targetStackId: 'player_archer_4' }],
    };
    const result = applyPlayerAction(state, { type: 'END_TURN' });
    expect(attacksBy(result.events, 'enemy_orc_1')).toEqual([]);
    expect(stackOf(result.state, 'player_priest_5').currentHp).toBe(stackOf(state, 'player_priest_5').currentHp);
  });
});

describe('AO-D004: heal math', () => {
  it('each hpPerUnit of heal restores exactly one soldier, and count = ceil(hp / hpPerUnit)', () => {
    // Knight hpPerUnit 12: 5 alive at 50 HP (4 full + 2 hp), 8 before the battle.
    const knight: ArmyStack = { ...createStack('knight', 'player', 1, 8), count: 5, currentHp: 50 };
    expect(applyHealToStack(knight, 1, 12).stack.count).toBe(5); // 51 HP still inside the 5th soldier
    const plusOne = applyHealToStack(knight, 12, 12);
    expect(plusOne.stack.currentHp).toBe(62);
    expect(plusOne.stack.count).toBe(6);
    expect(plusOne.healedAmount).toBe(12);
    const plusThree = applyHealToStack(knight, 36, 12);
    expect(plusThree.stack.count).toBe(8);
  });

  it('losing HP reduces count by ceil(hp / hpPerUnit)', () => {
    const sword = createStack('swordsman', 'player', 1, 6);
    expect(applyDamageToStack(sword, 10, 25).stack.count).toBe(4); // 35 HP left
    expect(applyDamageToStack(sword, 10, 20).stack.count).toBe(4); // 40 HP left
    expect(applyDamageToStack(sword, 10, 60).stack.count).toBe(0);
  });

  it('never heals past the pre-battle count, however strong the healer (basic action and card)', () => {
    const player = [wounded(createStack('swordsman', 'player', 1, 6), 3), createStack('priest', 'player', 5, 60)];
    const state = battle(player, enemyOrcs(), ['greater_heal']);
    const viaBasic = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_priest_5', targetStackId: 'player_swordsman_1' });
    expect(stackOf(viaBasic.state, 'player_swordsman_1')).toMatchObject({ count: 6, currentHp: 60 });
    const viaCard = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: state.hand[0]!.instanceId,
      actingStackId: 'player_priest_5',
      targetStackId: 'player_swordsman_1',
    });
    expect(stackOf(viaCard.state, 'player_swordsman_1')).toMatchObject({ count: 6, currentHp: 60 });
  });

  it('a stack that is already full is not raised above its pre-battle max', () => {
    const player = [createStack('swordsman', 'player', 1, 6), createStack('priest', 'player', 5, 4)];
    const result = applyPlayerAction(battle(player, enemyOrcs()), { type: 'BASIC_ACTION', stackId: 'player_priest_5', targetStackId: 'player_swordsman_1' });
    expect(stackOf(result.state, 'player_swordsman_1')).toMatchObject({ count: 6, currentHp: 60 });
  });
});

describe('Priest can heal every friendly unit type (owner-reported healer bug hunt)', () => {
  const friendly: UnitId[] = ['swordsman', 'archer', 'knight', 'priest'];

  for (const unit of friendly) {
    it(`heals a wounded ${unit} with the basic action and with a heal card`, () => {
      const hp = UNIT_DEFINITIONS[unit].hpPerUnit;
      // The healer is a separate Priest stack; when the target is a Priest too, use a second Priest stack.
      const target = wounded(createStack(unit, 'player', unit === 'priest' ? 4 : 1, 6), 3);
      const healer = createStack('priest', 'player', 6, 4);
      const state = battle([target, healer], enemyOrcs(), ['greater_heal']);

      const basic = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: healer.stackId, targetStackId: target.stackId });
      expect(rejection(basic.events)).toBeUndefined();
      expect(stackOf(basic.state, target.stackId).currentHp).toBeGreaterThan(3 * hp);
      expect(stackOf(basic.state, target.stackId).count).toBeGreaterThanOrEqual(3);

      const card = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: state.hand[0]!.instanceId, actingStackId: healer.stackId, targetStackId: target.stackId });
      expect(rejection(card.events)).toBeUndefined();
      expect(stackOf(card.state, target.stackId).currentHp).toBeGreaterThan(3 * hp);
    });
  }

  it('a Priest can heal itself', () => {
    const priest = wounded(createStack('priest', 'player', 4, 6), 3);
    const result = applyPlayerAction(battle([priest], enemyOrcs()), { type: 'BASIC_ACTION', stackId: priest.stackId, targetStackId: priest.stackId });
    expect(rejection(result.events)).toBeUndefined();
    expect(stackOf(result.state, priest.stackId).currentHp).toBeGreaterThan(3 * 8);
  });

  it('heals a stack that was moved to another position (Reposition) regardless of where it stands', () => {
    const sword = wounded(createStack('swordsman', 'player', 1, 6), 3);
    const moved = { ...sword, position: 6 as Position };
    const state = battle([moved, createStack('priest', 'player', 4, 4)], enemyOrcs());
    const result = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_priest_4', targetStackId: moved.stackId });
    expect(stackOf(result.state, moved.stackId).currentHp).toBeGreaterThan(30);
  });
});

describe('AO-D005: one-turn lockdown flags expire at the start of the next player turn', () => {
  const orcHit = (targetStackId: string) => ({ stackId: 'enemy_orc_1', kind: 'attack' as const, targetStackId });

  it('Brace: cannot act while braced, acts again next turn, flags cleared', () => {
    const state = battle([createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 2, 2)], enemyOrcs(), ['brace']);
    const braced = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: state.hand[0]!.instanceId, actingStackId: 'player_swordsman_1' });
    expect(rejection(braced.events)).toBeUndefined();
    expect(stackOf(braced.state, 'player_swordsman_1').flags).toMatchObject({ cannotAttack: true, incomingDamageReductionPercent: 40 });
    expect(rejection(applyPlayerAction(braced.state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' }).events)).toBeDefined();

    const next = applyPlayerAction(braced.state, { type: 'END_TURN' });
    const flags = stackOf(next.state, 'player_swordsman_1').flags;
    expect(flags.cannotAttack).toBeFalsy();
    expect(flags.incomingDamageReductionPercent).toBeFalsy();
    const attack = applyPlayerAction(next.state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    expect(rejection(attack.events)).toBeUndefined();
    expect(attacksBy(attack.events, 'player_swordsman_1').length).toBeGreaterThan(0);
  });

  it('the damage reduction applies to the enemy turn right after Brace, and not one turn later', () => {
    // Knight in the backline: an adjacent front Knight would absorb the hit through its passive Guard.
    const army = () => [createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 5, 2)];
    const withIntent = (s: CombatState): CombatState => ({ ...s, enemyIntents: [orcHit('player_swordsman_1')] });
    const hit = (events: CombatEvent[]) => attacksBy(events, 'enemy_orc_1')[0]!.finalDamage;

    const baseline = hit(applyPlayerAction(withIntent(battle(army(), enemyOrcs())), { type: 'END_TURN' }).events);

    const start = battle(army(), enemyOrcs(), ['brace']);
    const braced = applyPlayerAction(start, { type: 'PLAY_CARD', instanceId: start.hand[0]!.instanceId, actingStackId: 'player_swordsman_1' });
    const firstTurn = applyPlayerAction(withIntent(braced.state), { type: 'END_TURN' });
    expect(hit(firstTurn.events)).toBeLessThan(baseline);

    const secondTurn = applyPlayerAction(withIntent(firstTurn.state), { type: 'END_TURN' });
    expect(hit(secondTurn.events)).toBe(baseline);
  });

  it('Shield Wall: the Knight cannot move while walled, and can move next turn', () => {
    const state = battle([createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 2, 2)], enemyOrcs(), ['shield_wall', 'reposition', 'reposition']);
    const wall = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: state.hand[0]!.instanceId, actingStackId: 'player_knight_2' });
    expect(rejection(wall.events)).toBeUndefined();
    expect(stackOf(wall.state, 'player_knight_2').flags.cannotMove).toBe(true);

    const blocked = applyPlayerAction(wall.state, { type: 'PLAY_CARD', instanceId: wall.state.hand[0]!.instanceId, actingStackId: 'player_knight_2', toPosition: 5 });
    expect(rejection(blocked.events)).toContain('cannot move');

    const next = applyPlayerAction(wall.state, { type: 'END_TURN' });
    expect(stackOf(next.state, 'player_knight_2').flags.cannotMove).toBeFalsy();
    const moveCard = { instanceId: 't_reposition_next', cardId: 'reposition' };
    const moved = applyPlayerAction({ ...next.state, hand: [moveCard] }, { type: 'PLAY_CARD', instanceId: moveCard.instanceId, actingStackId: 'player_knight_2', toPosition: 5 });
    expect(rejection(moved.events)).toBeUndefined();
    expect(stackOf(moved.state, 'player_knight_2').position).toBe(5);
  });

  it('Protect: only the first hit is redirected to the guardian; a second hit lands on the protected stack', () => {
    // Guardian Knight sits in the backline so the passive Guard redirect (adjacent front Knight) cannot mask the card.
    const player = [createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 5, 2)];
    const state = battle(player, enemyOrcs(), ['protect']);
    const protectedState = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: state.hand[0]!.instanceId, actingStackId: 'player_knight_5', targetStackId: 'player_swordsman_1' });
    expect(rejection(protectedState.events)).toBeUndefined();
    expect(stackOf(protectedState.state, 'player_swordsman_1').flags.redirectToStackId).toBe('player_knight_5');

    const twoHits: CombatState = {
      ...protectedState.state,
      enemyIntents: [
        { stackId: 'enemy_orc_1', kind: 'attack', targetStackId: 'player_swordsman_1' },
        { stackId: 'enemy_orc_2', kind: 'attack', targetStackId: 'player_swordsman_1' },
      ],
    };
    const result = applyPlayerAction(twoHits, { type: 'END_TURN' });
    expect(attacksBy(result.events, 'enemy_orc_1')[0]!.targetStackId).toBe('player_knight_5');
    expect(attacksBy(result.events, 'enemy_orc_2')[0]!.targetStackId).toBe('player_swordsman_1');
  });
});
