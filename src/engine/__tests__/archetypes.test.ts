import { describe, expect, it } from 'vitest';
import { applyPlayerAction } from '../combat.js';
import { generateEnemyIntents } from '../intents.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CombatState } from '../types.js';

function withHand(state: CombatState, cardIds: string[]): CombatState {
  return { ...state, hand: cardIds.map((cardId, i) => ({ instanceId: `test_${cardId}_${i}`, cardId })) };
}

function handCard(state: CombatState, cardId: string) {
  const card = state.hand.find((c) => c.cardId === cardId);
  if (!card) throw new Error(`Card ${cardId} not in hand`);
  return card;
}

function attackEvent(events: ReturnType<typeof applyPlayerAction>['events']) {
  const e = events.find((e) => e.type === 'STACK_ATTACKED');
  if (!e || e.type !== 'STACK_ATTACKED') throw new Error('no STACK_ATTACKED event');
  return e;
}

describe('v3 §9 Morale (0-100) affects damage and defense', () => {
  it('higher morale deals more damage', () => {
    const { state } = createVerticalSliceScenario(500);
    const buffed: CombatState = { ...state, playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_swordsman_1' ? { ...s, morale: 100 } : s)) };
    const debuffed: CombatState = { ...state, playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_swordsman_1' ? { ...s, morale: 0 } : s)) };

    const buffedDmg = attackEvent(applyPlayerAction(buffed, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' }).events).rawDamage;
    const debuffedDmg = attackEvent(applyPlayerAction(debuffed, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' }).events).rawDamage;

    expect(buffedDmg).toBeGreaterThan(debuffedDmg);
  });
});

describe('v3 §8 Veterancy (flat tiers 0/3/5/8%)', () => {
  it('higher veterancy deals more damage', () => {
    const { state } = createVerticalSliceScenario(501);
    const veteran: CombatState = { ...state, playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_swordsman_1' ? { ...s, veterancy: 3 } : s)) };

    const baseDmg = attackEvent(applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' }).events).rawDamage;
    const veteranDmg = attackEvent(applyPlayerAction(veteran, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' }).events).rawDamage;

    expect(veteranDmg).toBeGreaterThan(baseDmg);
  });
});

describe('Taunt overrides normal enemy targeting', () => {
  it('a taunting stack pulls every attack intent regardless of lane/row', () => {
    // Intents are locked in at the start of a turn — this tests generateEnemyIntents
    // directly rather than going through an END_TURN that would still be executing
    // the turn's original (pre-Taunt) intents.
    // Warlord's reduced starting roster (v3 balance pass) has no Archer — use Rogue, whose
    // Archer stack still lands at the same player_archer_4 id (ranged units are backline).
    const { state } = createVerticalSliceScenario(502, 'rogue');
    const taunting: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_archer_4' ? { ...s, statuses: [{ type: 'taunt' as const, amount: 1, duration: 2 }] } : s)),
    };
    const intents = generateEnemyIntents(taunting);
    const attackIntents = intents.filter((i) => i.kind === 'attack');
    expect(attackIntents.length).toBeGreaterThan(0);
    for (const intent of attackIntents) {
      expect(intent.targetStackId).toBe('player_archer_4');
    }
  });
});

describe('v3 §8 Guard passive / Protect card redirect', () => {
  it("Knight's Guard passive redirects damage aimed at an adjacent frontline ally", () => {
    const { state } = createVerticalSliceScenario(503);
    // Warlord army: Swordsman(pos1), Knight(pos2), Archer(pos4) — Swordsman is adjacent to the Knight.
    const swordsmanBefore = state.playerArmy.find((s) => s.unitId === 'swordsman')!;
    const knightBefore = state.playerArmy.find((s) => s.unitId === 'knight')!;
    // Force an enemy intent to target the Swordsman directly and resolve the enemy turn —
    // Guard should redirect the hit to the adjacent Knight.
    const forced: CombatState = {
      ...state,
      enemyIntents: state.enemyIntents.map((i) => ({ ...i, kind: 'attack', targetStackId: swordsmanBefore.stackId, estimatedDamage: 9999 })),
    };
    const ended = applyPlayerAction(forced, { type: 'END_TURN' });
    const attacked = ended.events.filter((e) => e.type === 'STACK_ATTACKED');
    // At least one attack should have landed on the Knight (redirect target) rather than the Swordsman.
    expect(attacked.some((e) => e.type === 'STACK_ATTACKED' && e.targetStackId === knightBefore.stackId)).toBe(true);
  });

  it('the Protect card redirects a percentage of damage to the acting Knight', () => {
    let { state } = createVerticalSliceScenario(504);
    state = withHand(state, ['protect']);
    const knight = state.playerArmy.find((s) => s.unitId === 'knight')!;
    const swordsman = state.playerArmy.find((s) => s.unitId === 'swordsman')!;
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'protect').instanceId,
      actingStackId: knight.stackId,
      targetStackId: swordsman.stackId,
    });
    const protectedStack = result.state.playerArmy.find((s) => s.stackId === swordsman.stackId)!;
    expect(protectedStack.flags.redirectPercent).toBe(40);
    expect(protectedStack.flags.redirectToStackId).toBe(knight.stackId);
  });
});

describe('Divine Protection', () => {
  it('a lethal hit leaves the shielded stack at 1 soldier instead of destroying it', () => {
    // divine_protection is Priest-sourced — use Mage (has a Priest, and no Knight, so
    // Guard's redirect passive can't move the hit to a different stack). Shield the Archer
    // stack (Mage's reduced v3 roster has no Swordsman).
    let { state } = createVerticalSliceScenario(504.5, 'mage');
    state = withHand(state, ['divine_protection']);
    const archer = state.playerArmy.find((s) => s.unitId === 'archer')!;
    const shielded = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'divine_protection').instanceId,
      actingStackId: archer.stackId,
    }).state;
    expect(shielded.playerArmy.find((s) => s.stackId === archer.stackId)!.flags.divineShield).toBe(true);

    // Make the shielded stack trivially killable so a hit would normally destroy it. Only the
    // first enemy attacks it — Divine Protection absorbs one lethal blow, not the whole turn.
    // The rest are turned into harmless self-buffs (rather than redirected at another living
    // stack) so none of them can die mid-turn and trigger the "retarget to any survivor"
    // fallback in resolveEnemyTurn, which would otherwise bounce a second hit back onto the
    // now-unshielded archer.
    const fatal: CombatState = {
      ...shielded,
      playerArmy: shielded.playerArmy.map((s) => (s.stackId === archer.stackId ? { ...s, count: 1, currentHp: 1 } : s)),
      enemyIntents: shielded.enemyIntents.map((i, idx) =>
        idx === 0
          ? { ...i, kind: 'attack', targetStackId: archer.stackId, estimatedDamage: 1 }
          : { ...i, kind: 'buff', targetStackId: i.stackId, buffStatus: 'strength', buffAmount: 1 }
      ),
    };
    const ended = applyPlayerAction(fatal, { type: 'END_TURN' });
    expect(ended.events.some((e) => e.type === 'DIVINE_SHIELD_CONSUMED')).toBe(true);
    const survivor = ended.state.playerArmy.find((s) => s.stackId === archer.stackId);
    expect(survivor).toBeDefined();
    expect(survivor!.count).toBe(1);
  });
});

describe('Dodge (Hero Dexterity)', () => {
  it('a very high Dexterity Hero occasionally avoids damage entirely', () => {
    const { state } = createVerticalSliceScenario(505, 'rogue'); // Rogue has the highest base Dexterity (17)
    const highDex: CombatState = { ...state, hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 40 } } };
    const originalArcher = state.playerArmy.find((s) => s.unitId === 'archer')!;
    let sawDodge = false;
    let current = highDex;
    for (let i = 0; i < 40; i++) {
      const archer = current.playerArmy.find((s) => s.unitId === 'archer');
      if (!archer) break;
      const forced: CombatState = {
        ...current,
        // v3 balance pass shrank starting rosters — reset the target to full strength each
        // iteration so it survives the whole enemy formation's concentrated fire and the loop
        // gets a fair number of dodge rolls instead of dying out after one or two turns.
        playerArmy: current.playerArmy.map((s) =>
          s.stackId === archer.stackId ? { ...s, count: originalArcher.count, currentHp: originalArcher.maxHp } : s
        ),
        enemyIntents: current.enemyIntents.map((it) => ({ ...it, kind: 'attack', targetStackId: archer.stackId, estimatedDamage: 1 })),
      };
      const ended = applyPlayerAction(forced, { type: 'END_TURN' });
      const hits = ended.events.filter((e) => e.type === 'STACK_ATTACKED' && e.targetStackId === archer.stackId);
      if (hits.some((e) => e.type === 'STACK_ATTACKED' && e.rawDamage === 0)) sawDodge = true;
      current = ended.state;
      if (ended.state.result !== 'ongoing') break;
    }
    expect(sawDodge).toBe(true);
  });
});

describe('Poison/Bleed/Burn tick as damage-over-time', () => {
  it('a poisoned stack loses soldiers at the start of its side\'s next turn', () => {
    const { state } = createVerticalSliceScenario(506);
    const poisoned: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => (s.stackId === 'enemy_orc_1' ? { ...s, statuses: [{ type: 'poison' as const, amount: 9999, duration: 3 }] } : s)),
    };
    const result = applyPlayerAction(poisoned, { type: 'END_TURN' });
    // The enemy turn starts are not explicitly ticked in this engine (only the player
    // side's upcoming turn ticks both armies) — after one END_TURN the next player turn
    // has started, which ticks statuses for both sides.
    const orc = result.state.enemyArmy.find((s) => s.stackId === 'enemy_orc_1');
    expect(orc === undefined || orc.count === 0 || orc.currentHp < poisoned.enemyArmy.find((e) => e.stackId === 'enemy_orc_1')!.currentHp).toBe(true);
  });
});

describe('Execution Order / Execute — conditional bonus vs low-HP targets', () => {
  it('deals bonus damage against a target below the HP threshold', () => {
    let { state } = createVerticalSliceScenario(507);
    state = withHand(state, ['execution_order']);
    const woundedTarget: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => (s.stackId === 'enemy_orc_1' ? { ...s, currentHp: Math.round(s.maxHp * 0.2) } : s)),
    };

    const healthyDmg = attackEvent(
      applyPlayerAction(state, {
        type: 'PLAY_CARD',
        instanceId: handCard(state, 'execution_order').instanceId,
        actingStackId: 'player_swordsman_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;
    const woundedDmg = attackEvent(
      applyPlayerAction(withHand(woundedTarget, ['execution_order']), {
        type: 'PLAY_CARD',
        instanceId: handCard(withHand(woundedTarget, ['execution_order']), 'execution_order').instanceId,
        actingStackId: 'player_swordsman_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    expect(woundedDmg).toBeGreaterThan(healthyDmg);
  });
});

describe('Rally and unit passives', () => {
  it('Rally raises morale and draws a card', () => {
    let { state } = createVerticalSliceScenario(508);
    state = withHand(state, ['rally']);
    state = { ...state, playerArmy: state.playerArmy.map((s) => (s.unitId === 'swordsman' ? { ...s, morale: 50 } : s)) };
    const swordsman = state.playerArmy.find((s) => s.unitId === 'swordsman')!;
    const handBefore = state.hand.length;
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'rally').instanceId,
      actingStackId: swordsman.stackId,
    });
    const updated = result.state.playerArmy.find((s) => s.stackId === swordsman.stackId)!;
    expect(updated.morale).toBeGreaterThan(swordsman.morale);
    // Rally's own card leaves the hand, then draws 1 back — hand size is unchanged.
    expect(result.state.hand.length).toBe(handBefore - 1 + 1);
  });

  it("Archer's High Ground passive boosts damage while in the backline", () => {
    // Warlord's reduced starting roster (v3 balance pass) has no Archer — use Rogue.
    const { state } = createVerticalSliceScenario(509, 'rogue');
    const archer = state.playerArmy.find((s) => s.unitId === 'archer')!;
    expect(archer.position).toBeGreaterThan(3); // placed in the backline by buildHeroStartingArmy
    const frontClone: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) => (s.stackId === archer.stackId ? { ...s, position: 1 as const } : s)),
    };
    const backDmg = attackEvent(applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: archer.stackId, targetStackId: 'enemy_orc_1' }).events).rawDamage;
    const frontDmg = attackEvent(applyPlayerAction(frontClone, { type: 'BASIC_ACTION', stackId: archer.stackId, targetStackId: 'enemy_orc_1' }).events).rawDamage;
    expect(backDmg).toBeGreaterThan(frontDmg);
  });
});

describe('"1 turn" self-lockdown flags (Brace) expire instead of sticking forever', () => {
  it('a stack that plays Brace can act again on its next turn', () => {
    let { state } = createVerticalSliceScenario(510);
    state = withHand(state, ['brace']);
    const swordsman = state.playerArmy.find((s) => s.unitId === 'swordsman')!;
    const braced = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'brace').instanceId,
      actingStackId: swordsman.stackId,
    }).state;
    expect(braced.playerArmy.find((s) => s.stackId === swordsman.stackId)!.flags.cannotAttack).toBe(true);

    // Rejected this turn.
    const rejectedThisTurn = applyPlayerAction(braced, { type: 'BASIC_ACTION', stackId: swordsman.stackId, targetStackId: 'enemy_orc_1' });
    expect(rejectedThisTurn.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);

    // End turn (through the enemy's turn) and back to a fresh player turn — the flag must be gone.
    const nextTurn = applyPlayerAction(braced, { type: 'END_TURN' }).state;
    const swordsmanNextTurn = nextTurn.playerArmy.find((s) => s.stackId === swordsman.stackId)!;
    expect(swordsmanNextTurn.flags.cannotAttack).toBeFalsy();
    expect(swordsmanNextTurn.flags.incomingDamageReductionPercent).toBeFalsy();
    const actedNextTurn = applyPlayerAction(nextTurn, { type: 'BASIC_ACTION', stackId: swordsman.stackId, targetStackId: 'enemy_orc_1' });
    expect(actedNextTurn.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
  });
});
