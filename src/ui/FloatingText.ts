import { useCallback, useState } from 'react';
import type { IconName } from './pixel/icons.js';
import { STATUS_ICONS } from './stackStatus.js';
import type { Cue, HitCue } from './battleCues.js';

export interface Floater {
  id: number;
  stackId: string;
  text: string;
  icon?: IconName;
  kind: 'damage' | 'block' | 'heal' | 'status';
  delayMs: number;
}

const LIFETIME_MS = 1400;
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
    else if (hit.hpDamage > 0) add(hit.targetStackId, 'Wounded', 'damage');
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

export function useFloatingText() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const spawn = useCallback((entries: Omit<Floater, 'id'>[]) => {
    if (entries.length === 0) return;
    const added = entries.map((e) => ({ ...e, id: nextFloaterId++ }));
    setFloaters((f) => [...f, ...added]);
    const ids = new Set(added.map((a) => a.id));
    setTimeout(() => setFloaters((f) => f.filter((x) => !ids.has(x.id))), LIFETIME_MS + Math.max(...entries.map((e) => e.delayMs)));
  }, []);
  return { floaters, spawn };
}
