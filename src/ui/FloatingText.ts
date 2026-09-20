import { useCallback, useRef, useState } from 'react';
import type { IconName } from './pixel/icons.js';
import { STATUS_ICONS } from './stackStatus.js';
import type { Cue, HitCue } from './battleCues.js';

export interface Floater {
  id: number;
  stackId: string;
  text: string;
  icon?: IconName;
  kind: 'damage' | 'wound' | 'block' | 'heal' | 'status';
  delayMs: number;
  /** 0-2: floaters of one stack that overlap in time sit on different heights (set by staggerFloaters). */
  lane?: number;
}

const LIFETIME_MS = 1600;
/** Floaters on one stack start at least this far apart so a multi-hit turn reads as a list, not one smeared line. */
const STAGGER_MS = 450;
let nextFloaterId = 1;

/** Turns visual cues into floating-text entries: "-N units" / "Wounded" (AO-D022), Blocked, +N Block, heal in units, statuses. */
export function floatersFromCues(cues: Cue[]): Omit<Floater, 'id'>[] {
  const out: Omit<Floater, 'id'>[] = [];
  const perStack = new Map<string, number>();
  function add(stackId: string, text: string, kind: Floater['kind'], icon?: IconName) {
    const n = perStack.get(stackId) ?? 0;
    perStack.set(stackId, n + 1);
    out.push({ stackId, text, icon, kind, delayMs: n * 260 });
  }
  function addHit(hit: HitCue) {
    if (hit.dodged) add(hit.targetStackId, 'Dodged', 'status');
    else if (hit.unitsKilled > 0) add(hit.targetStackId, `-${hit.unitsKilled} ${hit.unitsKilled === 1 ? 'unit' : 'units'}`, 'damage');
    else if (hit.hpDamage > 0) add(hit.targetStackId, 'Wounded', 'wound');
    else if (hit.blocked === 0) add(hit.targetStackId, 'No damage', 'status');
    if (hit.blocked > 0) add(hit.targetStackId, `Blocked ${hit.blocked}`, 'block');
  }
  for (const cue of cues) {
    if (cue.kind === 'attack') cue.hits.forEach(addHit);
    else if (cue.kind === 'dot') addHit(cue.hit);
    else if (cue.kind === 'heal') add(cue.stackId, cue.units > 0 ? `+${cue.units} ${cue.units === 1 ? 'unit' : 'units'}` : 'Healed', 'heal');
    else if (cue.kind === 'block') add(cue.stackId, `+${cue.amount} Block`, 'block');
    else add(cue.stackId, cue.status, 'status', STATUS_ICONS[cue.status]);
  }
  return out;
}

/** Per stack: when its next floater may start, when the last one did, and the height lane it used. */
export interface FloaterQueue {
  freeAt: number;
  lastStart: number;
  lane: number;
}

const LANES = 3;

/**
 * Pushes each entry's start back until its stack's previous floater has had `STAGGER_MS` and gives floaters that are on
 * screen together different lanes; `queue` is updated in place. Pure so the queueing is testable.
 */
export function staggerFloaters(entries: Omit<Floater, 'id'>[], now: number, queue: Map<string, FloaterQueue>): Omit<Floater, 'id'>[] {
  return entries.map((e) => {
    const prev = queue.get(e.stackId);
    const start = Math.max(now + e.delayMs, prev?.freeAt ?? 0);
    const lane = prev && start - prev.lastStart < LIFETIME_MS ? (prev.lane + 1) % LANES : 0;
    queue.set(e.stackId, { freeAt: start + STAGGER_MS, lastStart: start, lane });
    return { ...e, delayMs: start - now, lane };
  });
}

export function useFloatingText() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const queue = useRef(new Map<string, FloaterQueue>());
  const spawn = useCallback((entries: Omit<Floater, 'id'>[]) => {
    if (entries.length === 0) return;
    const queued = staggerFloaters(entries, performance.now(), queue.current);
    const added = queued.map((e) => ({ ...e, id: nextFloaterId++ }));
    setFloaters((f) => [...f, ...added]);
    const ids = new Set(added.map((a) => a.id));
    setTimeout(() => setFloaters((f) => f.filter((x) => !ids.has(x.id))), LIFETIME_MS + Math.max(...queued.map((e) => e.delayMs)));
  }, []);
  return { floaters, spawn };
}
