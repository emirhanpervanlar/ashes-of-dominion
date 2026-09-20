import type { CombatState, EnemyStep } from '../engine/index.js';
import { applyStep, cuesForStep } from './battleCues.js';
import type { Cue } from './battleCues.js';
import { floatersFromCues } from './FloatingText.js';
import type { Floater } from './FloatingText.js';
import type { Fx } from './fxDom.js';

/** One enemy action takes about this long from actor glow to the next action (AO-D023: ~500-700 ms). */
const ENEMY_STEP_MS = 640;
const ACTOR_GLOW_MS = 120;
/** Pause between the beats of one action (a counterattack answering the attack). */
const BEAT_MS = 200;
/** Lets the last impact and its floaters read before the caller carries on. */
const TAIL_MS = 160;

export interface PlaybackHost {
  fx: Fx;
  spawnFloaters: (entries: Omit<Floater, 'id'>[]) => void;
}

function showCue(host: PlaybackHost, cue: Cue): void {
  host.fx.impact(cue);
  host.spawnFloaters(floatersFromCues([cue]));
}

/**
 * Plays cues around a state change: the first attack winds up (lunge or projectile), then `commit` swaps the displayed
 * state in and every cue's result lands. With `sequential` later attacks (counterattacks) get their own beat; without
 * it they all resolve together (a card hitting several stacks). Resolves early, without committing, when skipped.
 */
export async function playCues(host: PlaybackHost, cues: Cue[], commit: () => void, sequential: boolean): Promise<void> {
  const { fx } = host;
  const attacks = cues.filter((c): c is Extract<Cue, { kind: 'attack' }> => c.kind === 'attack');
  const windups = (sequential ? attacks.slice(0, 1) : attacks).map((a) => fx.windup(a));
  await fx.motion(Math.max(0, ...windups));
  if (fx.skipped) return;

  // A stack this action wipes is snapshotted first: its tile is about to become an empty "Wiped" slot.
  for (const cue of cues) {
    if (cue.kind === 'attack') for (const h of cue.hits) if (h.countAfter === 0 && !h.dodged) fx.ghost(h.targetStackId);
  }
  commit();

  const first = cues.findIndex((c) => c.kind === 'attack');
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!;
    if (sequential && cue.kind === 'attack' && i !== first) {
      await fx.wait(BEAT_MS);
      if (fx.skipped) return;
      const ms = fx.windup(cue);
      await fx.motion(ms);
      if (fx.skipped) return;
    }
    showCue(host, cue);
  }
  await fx.wait(TAIL_MS);
}

/**
 * Replays the enemy turn step by step from the enemy-phase board. `show` receives the board after each step; the caller
 * lands on the engine's final state afterwards (also when the replay is skipped).
 */
export async function playEnemySteps(host: PlaybackHost, start: CombatState, steps: EnemyStep[], show: (board: CombatState) => void): Promise<void> {
  const { fx } = host;
  let board = start;
  for (const step of steps) {
    if (fx.skipped) return;
    const began = performance.now();
    fx.glow(step.actorStackId);
    await fx.motion(ACTOR_GLOW_MS);
    if (fx.skipped) return;
    const cues = cuesForStep(step, board);
    await playCues(
      host,
      cues,
      () => {
        board = applyStep(board, step);
        show(board);
      },
      true,
    );
    if (fx.skipped) return;
    await fx.wait(ENEMY_STEP_MS - (performance.now() - began));
  }
}
