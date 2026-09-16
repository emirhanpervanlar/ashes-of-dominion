import { describe, expect, it } from 'vitest';
import { applyRunAction, createRun } from '../runEngine.js';
import type { CombatState } from '../../types.js';
import type { RunState } from '../types.js';

/**
 * These tests exercise the reward/relic/upgrade loop, not combat AI —
 * wipe the enemy army directly (same pattern as combat.test.ts's battle
 * outcome tests) rather than simulating a full, possibly-losing battle.
 */
function forceVictory(run: RunState): RunState {
  const combat = run.combat;
  if (!combat) throw new Error('no combat in progress');
  const wipedCombat: CombatState = {
    ...combat,
    enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
  };
  const result = applyRunAction({ ...run, combat: wipedCombat }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
  return result.run;
}

describe('run creation', () => {
  it('starts in choosing_starting_relic with the vertical-slice army/deck', () => {
    const run = createRun(1);
    expect(run.phase).toBe('choosing_starting_relic');
    expect(run.army.map((s) => s.count)).toEqual([18, 80, 8, 30, 10, 15]);
    expect(run.masterDeck.length).toBe(12);
    expect(run.combat).toBeNull();
  });
});

describe('starting relic', () => {
  it('Royal Banner adds +20 to the largest starting stack', () => {
    const run = createRun(2);
    const result = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    // Largest stack is the Swordsman x80.
    const swordsman = result.run.army.find((s) => s.unitId === 'swordsman')!;
    expect(swordsman.count).toBe(100);
    expect(result.run.phase).toBe('in_battle');
    expect(result.run.combat).not.toBeNull();
  });

  it('Arcane Crystal boosts max Mana and shrinks the whole army by 10%', () => {
    const run = createRun(3);
    const result = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'arcane_crystal' });
    expect(result.run.hero.maxMana).toBe(10);
    expect(result.run.hero.mana).toBe(7);
    expect(result.run.army.find((s) => s.unitId === 'swordsman')!.count).toBe(72); // floor(80*0.9)
  });

  it('rejects choosing a starting relic twice', () => {
    const run = createRun(4);
    const first = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const second = applyRunAction(first.run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'arcane_crystal' });
    expect(second.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('battle -> reward -> run complete loop', () => {
  it('winning the battle offers a reward, and confirming it ends the run (Phase 3 MVP has one battle)', () => {
    const run = createRun(5);
    const started = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const won = forceVictory(started.run);

    expect(won.phase).toBe('reward');
    expect(won.pendingReward).not.toBeNull();
    expect(won.pendingReward!.cardOptions.length).toBeGreaterThan(0);
    expect(won.battlesWon).toBe(1);

    const cardId = won.pendingReward!.cardOptions[0]!;
    const claimed = applyRunAction(won, { type: 'CLAIM_CARD', cardId });
    const confirmed = applyRunAction(claimed.run, { type: 'CONFIRM_REWARD' });

    expect(confirmed.run.phase).toBe('run_complete');
    expect(confirmed.run.masterDeck.some((c) => c.cardId === cardId)).toBe(true);
    expect(confirmed.run.masterDeck.length).toBe(13); // 12 starting + 1 reward
  });

  it('claiming an upgrade replaces the card id in the master deck instead of adding a new one', () => {
    const run = createRun(6);
    const started = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const won = forceVictory(started.run);

    const upgrade = won.pendingReward!.upgradeOptions.find((o) => o.cardId === 'command_strike');
    expect(upgrade).toBeDefined();

    const claimed = applyRunAction(won, { type: 'CLAIM_UPGRADE', instanceId: upgrade!.instanceId });
    const confirmed = applyRunAction(claimed.run, { type: 'CONFIRM_REWARD' });

    expect(confirmed.run.masterDeck.length).toBe(12); // no net new card
    expect(confirmed.run.masterDeck.find((c) => c.instanceId === upgrade!.instanceId)?.cardId).toBe('command_strike_plus');
  });

  it('claiming a relic reward applies its effect immediately', () => {
    const run = createRun(7);
    const started = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const won = forceVictory(started.run);

    const relicId = won.pendingReward!.relicOptions.find((id) => id === 'cursed_crown') ?? won.pendingReward!.relicOptions[0];
    expect(relicId).toBeDefined();
    const manaBefore = won.hero.maxMana;

    const claimed = applyRunAction(won, { type: 'CLAIM_RELIC', relicId: relicId! });
    const confirmed = applyRunAction(claimed.run, { type: 'CONFIRM_REWARD' });

    expect(confirmed.run.relics.some((r) => r.id === relicId)).toBe(true);
    if (relicId === 'cursed_crown') {
      expect(confirmed.run.hero.maxMana).toBe(manaBefore + 3);
    }
  });

  it('rejects claiming a relic/card that is not among the offered options', () => {
    const run = createRun(8);
    const started = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const won = forceVictory(started.run);
    const result = applyRunAction(won, { type: 'CLAIM_CARD', cardId: 'not_a_real_card' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('determinism', () => {
  it('identical seed + identical actions produce identical run state', () => {
    const run = (seed: number) => {
      const created = createRun(seed);
      const started = applyRunAction(created, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
      return forceVictory(started.run);
    };
    const a = run(100);
    const b = run(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
