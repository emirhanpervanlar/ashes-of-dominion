import { describe, expect, it } from 'vitest';
import { applyPlayerAction, createStack, createVerticalSliceScenario } from '../engine/index.js';
import type { CombatState } from '../engine/index.js';
import { applyStep, cuesForStep, cuesFromEvents, enemyPhaseBoard, replayEnemySteps, replayMismatches } from './battleCues.js';
import { floatersFromCues } from './FloatingText.js';

/** The small starting armies do not survive a passed turn, so scale them up (same idea as the engine tests). */
function sturdy(state: CombatState, factor = 100): CombatState {
  return {
    ...state,
    playerArmy: state.playerArmy.map((s) => ({ ...s, count: s.count * factor, currentHp: s.currentHp * factor, maxHp: s.maxHp * factor, startingCount: s.startingCount * factor, preBattleMaxCount: s.preBattleMaxCount * factor })),
  };
}

const formations = ['horde', 'guarded_shaman', 'wolf_pack', 'elite_guard'] as const;

describe('enemy step replay', () => {
  it('replaying the steps over the pre-turn board lands on the engine final state (seeded battles)', () => {
    for (const formation of formations) {
      for (let seed = 1; seed <= 8; seed++) {
        const pre = sturdy(createVerticalSliceScenario(seed, 'warlord', formation).state);
        const result = applyPlayerAction(pre, { type: 'END_TURN' });
        const boards = replayEnemySteps(pre, result.enemySteps!);
        expect(boards).toHaveLength(result.enemySteps!.length);
        expect(replayMismatches(boards.at(-1)!, result.state)).toEqual([]);
      }
    }
  });

  it('a battle-ending enemy turn also matches on Block (no new turn resets it)', () => {
    const start = createVerticalSliceScenario(3).state;
    const pre: CombatState = { ...start, playerArmy: start.playerArmy.map((s) => ({ ...s, count: 1, currentHp: 1, block: 4 })) };
    const result = applyPlayerAction(pre, { type: 'END_TURN' });
    expect(result.state.phase).toBe('ended');
    expect(replayMismatches(replayEnemySteps(pre, result.enemySteps!).at(-1)!, result.state)).toEqual([]);
  });

  it('the counts change step by step, only touching what each step reports', () => {
    const pre = sturdy(createVerticalSliceScenario(2, 'warlord', 'horde').state);
    const steps = applyPlayerAction(pre, { type: 'END_TURN' }).enemySteps!;
    let board = enemyPhaseBoard(pre);
    let changes = 0;
    for (const step of steps) {
      const next = applyStep(board, step);
      const touched = new Set(step.resulting.map((r) => r.stackId));
      for (const s of [...next.playerArmy, ...next.enemyArmy]) {
        const was = [...board.playerArmy, ...board.enemyArmy].find((b) => b.stackId === s.stackId)!;
        if (!touched.has(s.stackId)) expect(s).toBe(was);
        else if (s.count !== was.count) changes++;
      }
      board = next;
    }
    expect(changes).toBeGreaterThan(0);
  });

  it('the enemy-phase board discards the non-retained hand and shows the enemy turn', () => {
    const pre = createVerticalSliceScenario(1).state;
    const board = enemyPhaseBoard(pre);
    expect(board.phase).toBe('enemy');
    expect(board.hand.length + board.discard.length).toBe(pre.hand.length + pre.discard.length);
    expect(board.discard.length).toBeGreaterThanOrEqual(pre.hand.length - board.hand.length);
  });
});

describe('cues', () => {
  it('a shaman buff step is a status cue with a floater carrying the status icon, no attack', () => {
    const pre = sturdy(createVerticalSliceScenario(1, 'warlord', 'guarded_shaman').state);
    const step = applyPlayerAction(pre, { type: 'END_TURN' }).enemySteps!.find((s) => s.kind === 'buff')!;
    const cues = cuesForStep(step, enemyPhaseBoard(pre));
    expect(cues.every((c) => c.kind === 'status')).toBe(true);
    const [floater] = floatersFromCues(cues);
    expect(floater).toMatchObject({ text: 'strength', kind: 'status', icon: 'st_strength' });
  });

  it('an attack step keeps the actor as attacker and reads kills as "-N units", no kills as "Wounded"', () => {
    const { state } = createVerticalSliceScenario(1);
    const swordsman = createStack('swordsman', 'player', 1, 6);
    const orc = createStack('orc', 'enemy', 1, 3);
    const setup: CombatState = {
      ...state,
      hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 } },
      playerArmy: [swordsman],
      enemyArmy: [orc],
      enemyIntents: [{ stackId: orc.stackId, kind: 'attack', targetStackId: swordsman.stackId }],
    };
    const step = applyPlayerAction(setup, { type: 'END_TURN' }).enemySteps![0]!;
    const cues = cuesForStep(step, setup);
    expect(cues[0]).toMatchObject({ kind: 'attack', attackerStackId: orc.stackId, style: 'melee' });
    const hit = step.hits[0]!;
    const [floater] = floatersFromCues(cues);
    expect(floater!.text).toBe(hit.unitsKilled > 0 ? `-${hit.unitsKilled} ${hit.unitsKilled === 1 ? 'unit' : 'units'}` : 'Wounded');
  });

  it('a player basic attack yields one attack cue, ranged units fire a bolt', () => {
    const { state } = createVerticalSliceScenario(2);
    const archer = createStack('archer', 'player', 4, 5);
    const target = state.enemyArmy.find((s) => s.count > 0)!;
    const result = applyPlayerAction({ ...state, playerArmy: [...state.playerArmy, archer] }, { type: 'BASIC_ACTION', stackId: archer.stackId, targetStackId: target.stackId });
    const cues = cuesFromEvents(result.events, state, result.state);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ kind: 'attack', attackerStackId: archer.stackId, style: 'bolt' });
  });
});

describe('heal cue', () => {
  it('reports the soldiers actually restored (the count change), not HP divided by unit HP', () => {
    const { state } = createVerticalSliceScenario(2);
    const hurt = { ...createStack('swordsman', 'player', 1, 6), preBattleMaxCount: 12, maxHp: 120, currentHp: 60 };
    const priest = createStack('priest', 'player', 6, 6);
    const before: CombatState = { ...state, playerArmy: [hurt, priest] };
    const result = applyPlayerAction(before, { type: 'BASIC_ACTION', stackId: priest.stackId, targetStackId: hurt.stackId });
    const gained = result.state.playerArmy.find((s) => s.stackId === hurt.stackId)!.count - hurt.count;
    expect(gained).toBeGreaterThan(0);
    const cues = cuesFromEvents(result.events, before, result.state);
    expect(cues).toEqual([{ kind: 'heal', stackId: hurt.stackId, units: gained }]);
    expect(floatersFromCues(cues)[0]!.text).toBe(`+${gained} ${gained === 1 ? 'unit' : 'units'}`);
  });
});
