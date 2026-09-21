import { describe, expect, it } from 'vitest';
import type { CombatState } from '../../types.js';
import { RELIC_DEFINITIONS } from '../../data/relics.js';
import { isSimpleRelic } from '../relicSources.js';
import { createRng } from '../../rng.js';
import { BOSS_CHAPTER_MULTIPLIER, CITY_VISIT_WARNING, DAYS_PER_CHAPTER, FORT_FREE_STEPS, TOTAL_CHAPTERS, bossWarning, daysUntilBoss, enemyStrengthAfterCityVisits, threatMultiplier } from '../chapters.js';
import { generateBattleEncounter, generateBossEncounter } from '../encounters.js';
import { applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import { generateWorldMap } from '../worldMap.js';
import { legacySave } from './legacy.js';
import { pickReward } from './rewardHelpers.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);
const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');
const onMap = (seed: number): RunState => createRun(seed);
const total = (army: { count: number }[]) => army.reduce((sum, s) => sum + s.count, 0);

function winCurrentBattle(run: RunState): RunState {
  const combat = run.combat!;
  const wiped: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return act({ ...run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

/** Steps to the boss node of the current chapter, neutralising the nodes en route so this tests day/chapter flow, not encounters. */
function walkToBoss(start: RunState): RunState {
  let run = start;
  const bossLayer = Math.max(...run.worldMap.nodes.map((n) => n.layer));
  for (let layer = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!.layer + 1; layer <= bossLayer; layer++) {
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const next = run.worldMap.nodes.find((n) => n.layer === layer && current.connectsTo.includes(n.id))!;
    const nodes = run.worldMap.nodes.map((n) => (n.id === next.id && n.type !== 'boss' ? { ...n, type: 'start' as const } : n));
    run = act({ ...run, food: 999, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: next.id }).run;
  }
  return run;
}

describe('chapter map generation (AO-D045, AO-D046, AO-D049)', () => {
  it('chapter 1 spans day 1 to 30: the boss is the last layer, 29 steps away', () => {
    const map = generateWorldMap(createRng(1));
    const boss = map.nodes.filter((n) => n.type === 'boss');
    expect(boss).toHaveLength(1);
    expect(boss[0]!.layer).toBe(DAYS_PER_CHAPTER - 1);
    expect(Math.max(...map.nodes.map((n) => n.layer))).toBe(boss[0]!.layer);
  });

  it('later chapters start at the previous boss day and end at day 60 / 90', () => {
    expect(Math.max(...generateWorldMap(createRng(1), 2, 30).nodes.map((n) => n.layer))).toBe(30);
    expect(Math.max(...generateWorldMap(createRng(1), 3, 60).nodes.map((n) => n.layer))).toBe(30);
  });

  it('has no road or city nodes and only the start node is neutral', () => {
    const allowed = new Set(['start', 'battle', 'fort', 'mine', 'village', 'merchant', 'event', 'boss']);
    for (let seed = 1; seed <= 100; seed++) {
      for (const chapter of [1, 2, 3]) {
        for (const node of generateWorldMap(createRng(seed), chapter, (chapter - 1) * 30 + 1).nodes) {
          expect(allowed.has(node.type)).toBe(true);
          if (node.type === 'start') expect(node.layer).toBe(0);
        }
      }
    }
  });

  it('never places an elite in the first 5 steps of the run, and does place them later', () => {
    let later = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (const node of generateWorldMap(createRng(seed)).nodes) {
        if (node.type !== 'fort') continue;
        expect(node.layer).toBeGreaterThan(FORT_FREE_STEPS);
        later++;
      }
    }
    expect(later).toBeGreaterThan(0);
  });

  it('is deterministic per seed and every node stays reachable', () => {
    expect(generateWorldMap(createRng(9), 2, 30)).toEqual(generateWorldMap(createRng(9), 2, 30));
    const map = generateWorldMap(createRng(9));
    const reachable = new Set([map.currentNodeId]);
    for (const node of map.nodes) if (reachable.has(node.id)) node.connectsTo.forEach((id) => reachable.add(id));
    expect(reachable.size).toBe(map.nodes.length);
  });
});

describe('boss cycle and win condition (AO-D046)', () => {
  it('the boss battle starts exactly on day 30, and the warning shows from day 23', () => {
    let run = onMap(3);
    expect(daysUntilBoss(run)).toBe(29);
    expect(bossWarning(run)).toBe(false);
    expect(bossWarning({ ...run, day: 22 })).toBe(false);
    expect(bossWarning({ ...run, day: 23 })).toBe(true);
    run = walkToBoss(run);
    expect(run.day).toBe(30);
    expect(run.phase).toBe('in_battle');
    expect(run.bossBattle).toBe(true);
    expect(daysUntilBoss(run)).toBe(0);
  });

  it('boss 1 and 2 offer a relic choice of up to 3 drawback-free relics and start the next chapter; boss 3 wins the run', () => {
    let run = onMap(4);
    for (let chapter = 1; chapter <= TOTAL_CHAPTERS; chapter++) {
      expect(run.chapter).toBe(chapter);
      run = walkToBoss(run);
      expect(run.day).toBe(chapter * DAYS_PER_CHAPTER);
      expect(run.phase).toBe('in_battle');
      run = winCurrentBattle(run);
      expect(run.phase).toBe('reward');

      if (chapter < TOTAL_CHAPTERS) {
        const choices = run.pendingReward!.relicChoices;
        // AO-D077: only drawback-free relics are offered, so a small pool may leave fewer than 3.
        const owned = new Set(run.relics.map((r) => r.id));
        const unowned = Object.values(RELIC_DEFINITIONS).filter((r) => isSimpleRelic(r) && !owned.has(r.id)).length;
        expect(choices.every((id) => isSimpleRelic(RELIC_DEFINITIONS[id]!))).toBe(true);
        expect(choices).toHaveLength(Math.min(3, unowned));
        if (choices.length > 0) {
          const claimed = act(run, { type: 'CLAIM_RELIC', relicId: choices[0]! });
          expect(claimed.run.relics.map((r) => r.id)).toContain(choices[0]);
          expect(claimed.run.pendingReward!.relicChoices).toEqual([]);
          expect(claimed.run.phase).toBe('reward');
          if (choices.length > 1) expect(rejected(act(claimed.run, { type: 'CLAIM_RELIC', relicId: choices[1]! }).events)).toBe(true);
          run = claimed.run;
        }
      } else {
        expect(run.pendingReward!.relicChoices).toEqual([]);
      }

      const done = pickReward(run);
      run = done.run;
      expect(done.events.some((e) => e.type === 'BOSS_DEFEATED')).toBe(true);
      if (chapter < TOTAL_CHAPTERS) {
        expect(run.phase).toBe('on_map');
        expect(run.bossBattle).toBe(false);
        expect(done.events).toContainEqual({ type: 'CHAPTER_STARTED', chapter: chapter + 1 });
        expect(run.worldMap.currentNodeId).toBe(run.worldMap.nodes[0]!.id);
        expect(daysUntilBoss(run)).toBe(30);
      } else {
        expect(run.phase).toBe('run_complete');
        expect(done.events.some((e) => e.type === 'RUN_COMPLETE')).toBe(true);
      }
    }
  });

  it('a relic outside the boss choice is rejected', () => {
    const run = winCurrentBattle(walkToBoss(onMap(5)));
    const outside = Object.keys(RELIC_DEFINITIONS).find((id) => !run.pendingReward!.relicChoices.includes(id))!;
    expect(rejected(act(run, { type: 'CLAIM_RELIC', relicId: outside }).events)).toBe(true);
  });

  it('losing to a boss is still defeat', () => {
    const run = walkToBoss(onMap(6));
    const combat = run.combat!;
    const wiped: CombatState = { ...combat, playerArmy: combat.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    expect(act({ ...run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run.phase).toBe('defeat');
  });

  it('chapters 2 and 3 field larger bosses and encounters', () => {
    const sizes = [1, 2, 3].map((c) => total(generateBossEncounter(c)));
    expect(sizes[1]).toBeGreaterThan(sizes[0]!);
    expect(sizes[2]).toBeGreaterThan(sizes[1]!);
    expect(BOSS_CHAPTER_MULTIPLIER).toHaveLength(TOTAL_CHAPTERS);
    expect(total(generateBattleEncounter(10, false, 2))).toBeGreaterThan(total(generateBattleEncounter(10, false, 1)));
  });
});

describe('city any time with Threat (AO-D047, AO-D051)', () => {
  it('TRAVEL_TO_CITY opens the city and costs no days or food; the first visit is free (AO-D070), the next raises Threat by 1', () => {
    const run = onMap(7);
    const first = act(run, { type: 'TRAVEL_TO_CITY' });
    expect(first.run.phase).toBe('city');
    expect(first.run.threat).toBe(0);
    expect(first.run.day).toBe(run.day);
    expect(first.run.food).toBe(run.food);
    expect(first.events).toContainEqual({ type: 'CITY_VISITED', threat: 0, free: true });
    const second = act(act(first.run, { type: 'LEAVE_CITY' }).run, { type: 'TRAVEL_TO_CITY' });
    expect(second.run.threat).toBe(1);
    expect(second.events).toContainEqual({ type: 'CITY_VISITED', threat: 1, free: false });
  });

  it('leaving returns to the same map node at no time cost; each visit after the free one adds Threat', () => {
    let run = onMap(8);
    const node = run.worldMap.currentNodeId;
    for (let visit = 1; visit <= 3; visit++) {
      run = act(run, { type: 'TRAVEL_TO_CITY' }).run;
      run = act(run, { type: 'LEAVE_CITY' }).run;
      expect(run.phase).toBe('on_map');
      expect(run.worldMap.currentNodeId).toBe(node);
      expect(run.day).toBe(1);
      expect(run.threat).toBe(visit - 1);
    }
  });

  it('is only valid on the map: not in battle, reward, event, merchant or the city itself', () => {
    const base = onMap(9);
    for (const phase of ['in_battle', 'reward', 'event', 'merchant', 'city'] as const) {
      const result = act({ ...base, phase }, { type: 'TRAVEL_TO_CITY' });
      expect(rejected(result.events)).toBe(true);
      expect(result.run.threat).toBe(0);
    }
  });

  it('buildings still work in a city reached this way', () => {
    let run = { ...act(onMap(10), { type: 'TRAVEL_TO_CITY' }).run, gold: 500 };
    run = act(run, { type: 'BUILD_BUILDING', buildingId: 'forge' }).run;
    expect(run.city.buildings).toContain('forge');
  });

  it('scales enemy unit counts by 1 + 0.06 x threat', () => {
    expect(threatMultiplier(0)).toBe(1);
    expect(threatMultiplier(5)).toBeCloseTo(1.3);
    const base = total(generateBattleEncounter(12, false, 1, 0));
    const stronger = total(generateBattleEncounter(12, false, 1, 10));
    expect(stronger).toBeGreaterThan(base);
    expect(stronger).toBeGreaterThanOrEqual(Math.round(base * 1.5) - 6); // per-stack rounding only
    expect(total(generateBossEncounter(1, 10))).toBe(Math.round(60 * 1.6) * 3 + Math.round(30 * 1.6) * 2 + Math.round(18 * 1.6));
  });

  it('battles started after visits use the run threat', () => {
    const fight = (visits: number): number => {
      let run = onMap(11);
      for (let i = 0; i < visits; i++) run = act(act(run, { type: 'TRAVEL_TO_CITY' }).run, { type: 'LEAVE_CITY' }).run;
      const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
      const nextId = current.connectsTo[0]!;
      const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const, layer: 20 } : n));
      const moved = act({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
      return total(moved.combat!.enemyArmy);
    };
    expect(fight(8)).toBeGreaterThan(fight(0));
  });

  it('exposes what the warning needs', () => {
    const run = { ...onMap(12), threat: 2 };
    expect(enemyStrengthAfterCityVisits(run)).toBeCloseTo(1.12);
    expect(enemyStrengthAfterCityVisits(run, 1)).toBeCloseTo(1.18);
    expect(CITY_VISIT_WARNING.length).toBeGreaterThan(0);
  });
});

describe('migrateRun for pre-AO-021 saves', () => {
  it('moves an old run to chapter 1 with no threat, a fresh road-free map, and finalBattle mapped to bossBattle', () => {
    const fresh = onMap(13);
    const { chapter: _c, threat: _t, bossBattle: _b, ...rest } = fresh;
    const old = legacySave({ ...rest, day: 5, finalBattle: true, worldMap: { nodes: [{ id: 'n0_0', type: 'road', layer: 0, visibility: 'visited', connectsTo: [] }], currentNodeId: 'n0_0' } });
    const migrated = migrateRun(old);
    expect(migrated.chapter).toBe(1);
    expect(migrated.threat).toBe(0);
    expect(migrated.bossBattle).toBe(true);
    expect('finalBattle' in migrated).toBe(false);
    expect(migrated.worldMap.nodes.some((n) => (n.type as string) === 'road' || (n.type as string) === 'city')).toBe(false);
    expect(Math.max(...migrated.worldMap.nodes.map((n) => n.layer))).toBe(25);
    expect(daysUntilBoss(migrated)).toBe(25);
  });

  it('leaves a current run untouched and fills relicChoices on a pending reward that lacks it', () => {
    const run = onMap(14);
    expect(migrateRun(run)).toEqual(run);
    const oldReward = legacySave({ ...run, pendingReward: { cardOptions: [], upgradeOptions: [], relicOffer: null } });
    expect(migrateRun(oldReward).pendingReward!.relicChoices).toEqual([]);
  });
});
