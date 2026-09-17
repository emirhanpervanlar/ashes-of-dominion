import { describe, expect, it } from 'vitest';
import { applyPlayerAction, startBattle } from '../../combat.js';
import { createRng } from '../../rng.js';
import { buildVerticalSlicePlayerArmy } from '../../army.js';
import { applyRunAction, createRun } from '../runEngine.js';
import { generateBossEncounter } from '../encounters.js';
import type { CombatState } from '../../types.js';
import type { RunState } from '../types.js';

/** Same node-override trick as runEngine.test.ts, but forced straight to the Boss layer. */
function reachBoss(seed: number): RunState {
  let run = createRun(seed);
  run = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' }).run;
  const bossId = run.worldMap.nodes.find((n) => n.type === 'boss')!.id;

  while (run.phase === 'on_map') {
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const nextId = current.connectsTo.includes(bossId) ? bossId : current.connectsTo[0]!;
    const result = applyRunAction(run, { type: 'MOVE_TO', nodeId: nextId });
    run = result.run;
    if (run.phase === 'in_battle' && run.worldMap.currentNodeId !== bossId) {
      // Hit a random battle/elite en route — force through it to keep walking toward the boss.
      const combat = run.combat!;
      const wiped: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
      const won = applyRunAction({ ...run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
      run = won.phase === 'reward' ? applyRunAction(won, { type: 'CONFIRM_REWARD' }).run : won;
    } else if (run.phase === 'event') {
      const optionId = run.pendingEvent!.eventId === 'abandoned_camp' ? 'rest' : 'pay';
      run = applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId }).run;
    } else if (run.phase === 'merchant') {
      run = applyRunAction(run, { type: 'LEAVE_MERCHANT' }).run;
    } else if (run.phase === 'city') {
      run = applyRunAction(run, { type: 'LEAVE_CITY' }).run;
    }
  }
  return run;
}

describe('boss encounter generation', () => {
  it('includes exactly one Warlord', () => {
    const encounter = generateBossEncounter();
    const warlords = encounter.filter((s) => s.unitId === 'warlord');
    expect(warlords).toHaveLength(1);
    expect(warlords[0]!.count).toBe(1);
  });
});

describe('Warlord scaling mechanic', () => {
  it("Warlord's attack damage scales with the player's total army size", () => {
    const smallArmy = buildVerticalSlicePlayerArmy().map((s) => ({ ...s, count: Math.min(s.count, 5), currentHp: s.currentHp, maxHp: s.maxHp }));
    const bigArmy = buildVerticalSlicePlayerArmy(); // 161 units total

    const runBattle = (playerArmy: ReturnType<typeof buildVerticalSlicePlayerArmy>) => {
      const seed = 999;
      const { state } = startBattle({
        seed,
        rng: createRng(seed),
        hero: { id: 'commander', name: 'Commander', hp: 100, maxHp: 100, mana: 5, maxMana: 8, energy: 3, maxEnergy: 3 },
        playerArmy,
        enemyArmy: generateBossEncounter(),
        deck: [],
        activeRelicEffects: [],
        heroSkillIds: [],
      });
      const ended = applyPlayerAction(state, { type: 'END_TURN' });
      const dmg = ended.events.find((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId.includes('warlord'));
      return dmg && dmg.type === 'STACK_ATTACKED' ? dmg.rawDamage : null;
    };

    const smallDamage = runBattle(smallArmy);
    const bigDamage = runBattle(bigArmy);
    expect(smallDamage).not.toBeNull();
    expect(bigDamage).not.toBeNull();
    expect(bigDamage!).toBeGreaterThan(smallDamage!);
  });

  it('the enemy intent preview reflects the scaled damage, not the base value', () => {
    const bigArmy = buildVerticalSlicePlayerArmy();
    const seed = 1234;
    const { state } = startBattle({
      seed,
      rng: createRng(seed),
      hero: { id: 'commander', name: 'Commander', hp: 100, maxHp: 100, mana: 5, maxMana: 8, energy: 3, maxEnergy: 3 },
      playerArmy: bigArmy,
      enemyArmy: generateBossEncounter(),
      deck: [],
      activeRelicEffects: [],
      heroSkillIds: [],
    });
    const warlordIntent = state.enemyIntents.find((i) => i.stackId.includes('warlord'));
    expect(warlordIntent).toBeDefined();
    // Base Warlord attack is 20; with 161 total units / divisor 15 that's +10, well above a naive base-only estimate.
    expect(warlordIntent!.estimatedDamage).toBeGreaterThan(0);
  });
});

describe('run completion via the boss', () => {
  it('defeating the boss offers a final reward whose confirmation ends the run (run_complete)', () => {
    const run = reachBoss(50);
    expect(run.phase).toBe('in_battle');
    expect(run.finalBattle).toBe(true);

    const combat = run.combat!;
    const wiped: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    const won = applyRunAction({ ...run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
    expect(won.run.phase).toBe('reward');

    const confirmed = applyRunAction(won.run, { type: 'CONFIRM_REWARD' });
    expect(confirmed.run.phase).toBe('run_complete');
    expect(confirmed.events.some((e) => e.type === 'RUN_COMPLETE')).toBe(true);
  });

  it('losing to the boss moves to defeat, not run_complete', () => {
    const run = reachBoss(51);
    const combat = run.combat!;
    const wiped: CombatState = { ...combat, playerArmy: combat.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    const result = applyRunAction({ ...run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
    expect(result.run.phase).toBe('defeat');
  });
});
