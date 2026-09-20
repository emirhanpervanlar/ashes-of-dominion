import { useEffect, useRef } from 'react';
import type { CombatState } from '../engine/index.js';
import { createFx } from './fxDom.js';
import type { Fx } from './fxDom.js';
import { stackStates } from './stackStatus.js';

export function useBattleFx(): Fx {
  const ref = useRef<Fx | null>(null);
  ref.current ??= createFx();
  return ref.current;
}

/** Plays the thaw shatter and the chain break when a stack loses Freeze / a "cannot act" flag on the displayed board. */
export function useStatusTransitions(fx: Fx, board: CombatState | null): void {
  const previous = useRef(new Map<string, { frozen: boolean; chained: boolean }>());
  useEffect(() => {
    const now = new Map<string, { frozen: boolean; chained: boolean }>();
    for (const s of [...(board?.playerArmy ?? []), ...(board?.enemyArmy ?? [])]) {
      if (s.count === 0) continue;
      const { frozen, chained } = stackStates(s, s.side);
      now.set(s.stackId, { frozen, chained });
    }
    for (const [id, state] of now) {
      const before = previous.current.get(id);
      if (before?.frozen && !state.frozen) fx.shatter(id);
      if (before?.chained && !state.chained) fx.chainBreak(id);
    }
    previous.current = now;
  }, [board, fx]);
}
