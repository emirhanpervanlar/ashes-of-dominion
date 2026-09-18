import { describe, expect, it } from 'vitest';
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
  // The named 3-phase "Ashen Warlord" boss (v3 §22) is Phase 6 content, not yet
  // implemented — generateBossEncounter is a placeholder oversized elite formation
  // (see encounters.ts) so the run's final battle still exists end-to-end.
  it('fields a formation noticeably larger than a standard encounter', () => {
    const encounter = generateBossEncounter();
    const total = encounter.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBeGreaterThan(150);
    expect(encounter.every((s) => s.side === 'enemy')).toBe(true);
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
