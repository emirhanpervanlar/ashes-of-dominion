import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, Position } from '../engine/index.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS } from './unitShapes.js';

const POSITIONS: Position[] = [1, 2, 3, 4, 5, 6];
const LANES = ['Left', 'Center', 'Right'];
const SLIDE_MS = 150;

interface Props {
  army: ArmyStack[];
  /** Freshly recruited stack shown as a "+N" flourish inside its slot. */
  recentRecruit?: { unitId: string; amount: number } | null;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onInspect: (stackId: string) => void;
}

function slotTitle(position: Position): string {
  return `${position <= 3 ? 'Front' : 'Back'} - ${LANES[(position - 1) % 3]}`;
}

/**
 * The army as it stands on the battle board: top row = front (1-3), bottom row = back (4-6), columns = lanes.
 * Left-click picks a stack up, a second click on another slot moves or swaps it; right-click inspects.
 */
export function ArmyGrid({ army, recentRecruit, onMoveStack, onInspect }: Props) {
  const [heldId, setHeldId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef(new Map<string, HTMLElement>());
  const beforeRects = useRef<Map<string, DOMRect> | null>(null);
  const alive = army.filter((s) => s.count > 0);
  const held = heldId !== null && alive.some((s) => s.stackId === heldId);

  useEffect(() => {
    if (heldId !== null && !held) setHeldId(null);
  }, [heldId, held]);

  useEffect(() => {
    if (!held) return;
    const cancelOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeldId(null);
    };
    const cancelOutside = (e: PointerEvent) => {
      if (!gridRef.current?.contains(e.target as Node)) setHeldId(null);
    };
    window.addEventListener('keydown', cancelOnEsc);
    document.addEventListener('pointerdown', cancelOutside);
    return () => {
      window.removeEventListener('keydown', cancelOnEsc);
      document.removeEventListener('pointerdown', cancelOutside);
    };
  }, [held]);

  // Slide the icons from where they were to where they landed (rects captured just before the move).
  useLayoutEffect(() => {
    const before = beforeRects.current;
    if (!before) return;
    beforeRects.current = null;
    iconRefs.current.forEach((el, id) => {
      const from = before.get(id);
      if (!from) return;
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (dx === 0 && dy === 0) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: SLIDE_MS, easing: 'ease' });
    });
  }, [army]);

  function clickSlot(position: Position, occupant: ArmyStack | undefined) {
    if (!held) {
      if (occupant) setHeldId(occupant.stackId);
      return;
    }
    if (occupant?.stackId === heldId) {
      setHeldId(null);
      return;
    }
    const snapshot = new Map<string, DOMRect>();
    iconRefs.current.forEach((el, id) => snapshot.set(id, el.getBoundingClientRect()));
    beforeRects.current = snapshot;
    onMoveStack(heldId!, position);
    setHeldId(null);
  }

  return (
    <div className="army-block">
      <div className="army-row-labels">
        <span className="army-row-label front">Front</span>
        <span className="army-row-label back">Back</span>
      </div>
      <div className={`army-grid${held ? ' holding' : ''}`} ref={gridRef}>
        {POSITIONS.map((position) => {
          const s = alive.find((a) => a.position === position);
          const classes = ['army-slot', s ? 'filled' : 'empty'];
          if (s && s.stackId === heldId) classes.push('held');
          return (
            <div
              key={position}
              className={classes.join(' ')}
              title={s ? `${slotTitle(position)} (${UNIT_DEFINITIONS[s.unitId].name})` : slotTitle(position)}
              onClick={() => clickSlot(position, s)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!s) return;
                setHeldId(null);
                onInspect(s.stackId);
              }}
            >
              {s ? (
                <>
                  <span
                    className="army-slot-icon"
                    ref={(el) => {
                      if (el) iconRefs.current.set(s.stackId, el);
                      else iconRefs.current.delete(s.stackId);
                    }}
                  >
                    {UNIT_ICONS[s.unitId]}
                    <span className="army-slot-role">{UNIT_ROLE_ICONS[s.unitId]}</span>
                  </span>
                  <span className="army-slot-text">
                    <span className="army-slot-count">×{s.count}</span>
                    <span className="army-slot-name">{UNIT_DEFINITIONS[s.unitId].name}</span>
                  </span>
                  <span className="army-slot-swap">⇄</span>
                  {recentRecruit?.unitId === s.unitId && <span className="recruit-flourish">+{recentRecruit.amount}</span>}
                </>
              ) : (
                <>
                  <span className="army-slot-empty-label">Empty</span>
                  <span className="army-slot-move-label">Move here</span>
                </>
              )}
              <span className="army-slot-digit">{position}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
