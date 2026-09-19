import { useCallback, useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { CombatEvent, CombatState } from '../engine/index.js';
import type { IconName } from './pixel/icons.js';
import { STATUS_ICONS } from './stackStatus.js';

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

/** Turns the events an action just appended to the combat log into floating-text entries. */
export function floatersFromEvents(events: CombatEvent[], after: CombatState): Omit<Floater, 'id'>[] {
  const out: Omit<Floater, 'id'>[] = [];
  const perStack = new Map<string, number>();
  function add(stackId: string, text: string, kind: Floater['kind'], icon?: IconName) {
    const n = perStack.get(stackId) ?? 0;
    perStack.set(stackId, n + 1);
    out.push({ stackId, text, icon, kind, delayMs: n * 260 });
  }
  for (const e of events) {
    if (e.type === 'STACK_ATTACKED') {
      if (e.unitsKilled > 0) add(e.targetStackId, `-${e.unitsKilled} ${e.unitsKilled === 1 ? 'unit' : 'units'}`, 'damage');
      else if (e.finalDamage > 0) add(e.targetStackId, 'Wounded', 'damage');
      if (e.blocked > 0) add(e.targetStackId, `Blocked ${e.blocked}`, 'block');
    } else if (e.type === 'STACK_HEALED' && e.amount > 0) {
      const stack = [...after.playerArmy, ...after.enemyArmy].find((s) => s.stackId === e.stackId);
      const units = stack ? Math.floor(e.amount / UNIT_DEFINITIONS[stack.unitId].hpPerUnit) : 0;
      add(e.stackId, units > 0 ? `+${units} ${units === 1 ? 'unit' : 'units'}` : 'Healed', 'heal');
    } else if (e.type === 'BLOCK_GAINED' && e.amount > 0) {
      add(e.stackId, `+${e.amount} Block`, 'block');
    } else if (e.type === 'STATUS_APPLIED') {
      add(e.stackId, e.status, 'status', STATUS_ICONS[e.status]);
    }
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
