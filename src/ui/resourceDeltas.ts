import { useEffect, useState } from 'react';
import type { RunState } from '../engine/run/index.js';

export interface ResourceDelta {
  id: number;
  resource: 'gold' | 'food';
  amount: number;
}

interface Seen {
  seed: number;
  gold: number;
  food: number;
}

/** What the bar showed last time it was on screen; lives outside React so a trip through battle, reward or merchant is one change. */
let lastSeen: Seen | null = null;
let nextId = 1;

/**
 * The Gold and Food that changed since the bar last showed them (a day of travel, loot, an event, a purchase, starvation):
 * one signed number per resource. Nothing for the first look at a run.
 */
export function resourceDeltas(prev: Seen | null, run: Pick<RunState, 'seed' | 'gold' | 'food'>): Omit<ResourceDelta, 'id'>[] {
  if (!prev || prev.seed !== run.seed) return [];
  const out: Omit<ResourceDelta, 'id'>[] = [];
  if (run.gold !== prev.gold) out.push({ resource: 'gold', amount: run.gold - prev.gold });
  if (run.food !== prev.food) out.push({ resource: 'food', amount: run.food - prev.food });
  return out;
}

const FLOAT_MS = 1800;

/** Floating "+N" / "-N" entries for the resource pills; each lives 1.8 s. Used by the shared bottom bar. */
export function useResourceDeltas(run: Pick<RunState, 'seed' | 'gold' | 'food'>): ResourceDelta[] {
  const [items, setItems] = useState<ResourceDelta[]>([]);
  useEffect(() => {
    const fresh = resourceDeltas(lastSeen, run).map((d) => ({ ...d, id: nextId++ }));
    lastSeen = { seed: run.seed, gold: run.gold, food: run.food };
    if (fresh.length === 0) return;
    setItems((cur) => [...cur, ...fresh]);
    const ids = new Set(fresh.map((f) => f.id));
    // Not cancelled on cleanup: a re-run of this effect finds nothing new and must not strand the entries on screen.
    window.setTimeout(() => setItems((cur) => cur.filter((f) => !ids.has(f.id))), FLOAT_MS);
  }, [run.seed, run.gold, run.food]);
  return items;
}
