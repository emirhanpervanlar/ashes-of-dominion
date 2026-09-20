import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, Position } from '../engine/index.js';
import { resolveDrop } from './armyDrop.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';
import { roleTip } from './tipContent.js';
import { UnitArt } from './UnitArt.js';
import { UNIT_ROLE_ICONS } from './unitIcons.js';

const POSITIONS: Position[] = [1, 2, 3, 4, 5, 6];
const LANES = ['Left', 'Center', 'Right'];
const SLIDE_MS = 150;
const MERGE_FLASH_MS = 900;
/** Pointer travel before a press becomes a drag; below it the gesture stays a click. */
const DRAG_THRESHOLD = 6;

/** A split-off part the player is still placing: the engine split is only applied once a slot is chosen. */
export interface PlacingSplit {
  stackId: string;
  count: number;
}

interface Props {
  army: ArmyStack[];
  /** Freshly recruited stack shown as a "+N" flourish inside its slot. */
  recentRecruit?: { unitId: string; amount: number } | null;
  /** A modal, popup or drawer is open: nothing can be picked up and any pick-up in progress is dropped. */
  disabled: boolean;
  placing: PlacingSplit | null;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onMergeStacks: (keepStackId: string, absorbStackId: string) => void;
  onPlaceSplit: (toPosition: Position) => void;
  onCancelPlacing: () => void;
  onInspect: (stackId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

function slotTitle(position: Position): string {
  return `${position <= 3 ? 'Front' : 'Back'} - ${LANES[(position - 1) % 3]}`;
}

function slotAt(x: number, y: number): Position | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-position]');
  return el ? (Number(el.dataset.position) as Position) : null;
}

/**
 * The army as it stands on the battle board: top row = front (1-3), bottom row = back (4-6), columns = lanes.
 * A stack is moved by dragging it or by clicking it and then a slot: an empty slot moves it, a different stack swaps,
 * a stack of the same unit type merges (AO-D061). A split-off part is held the same way until an empty slot is chosen.
 * Right-click inspects.
 */
export function ArmyGrid({ army, recentRecruit, disabled, placing, onMoveStack, onMergeStacks, onPlaceSplit, onCancelPlacing, onInspect }: Props) {
  const [heldId, setHeldId] = useState<string | null>(null);
  const [pressId, setPressId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [overPosition, setOverPosition] = useState<Position | null>(null);
  const [mergeFlash, setMergeFlash] = useState<Position | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef(new Map<string, HTMLElement>());
  const beforeRects = useRef<Map<string, DOMRect> | null>(null);
  const pressStart = useRef<Point>({ x: 0, y: 0 });
  const swallowClick = useRef(false);
  const alive = army.filter((s) => s.count > 0);
  const held = heldId !== null && alive.some((s) => s.stackId === heldId);
  const heldStack = held ? alive.find((s) => s.stackId === heldId)! : null;
  const placingStack = placing ? alive.find((s) => s.stackId === placing.stackId) ?? null : null;
  const busy = held || placingStack !== null;

  function resetGesture() {
    setHeldId(null);
    setPressId(null);
    setDragging(false);
    setPointer(null);
    setOverPosition(null);
  }

  useEffect(() => {
    if (heldId !== null && !held) resetGesture();
  }, [heldId, held]);

  useEffect(() => {
    if (!disabled) return;
    resetGesture();
    if (placing) onCancelPlacing();
  }, [disabled]);

  useEffect(() => {
    if (!busy) return;
    const cancel = () => {
      if (dragging) swallowClick.current = true;
      resetGesture();
      if (placing) onCancelPlacing();
    };
    const cancelOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    const cancelOutside = (e: PointerEvent) => {
      if (!gridRef.current?.contains(e.target as Node)) cancel();
    };
    const follow = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener('keydown', cancelOnEsc);
    document.addEventListener('pointerdown', cancelOutside);
    if (placing) window.addEventListener('pointermove', follow);
    return () => {
      window.removeEventListener('keydown', cancelOnEsc);
      document.removeEventListener('pointerdown', cancelOutside);
      window.removeEventListener('pointermove', follow);
    };
  }, [busy, placing]);

  // A press on a filled slot turns into a drag once the pointer travels far enough; the drop resolves like a click on the target.
  useEffect(() => {
    if (pressId === null) return;
    let started = false;
    const onMove = (e: PointerEvent) => {
      if (!started) {
        if (Math.hypot(e.clientX - pressStart.current.x, e.clientY - pressStart.current.y) < DRAG_THRESHOLD) return;
        started = true;
        setHeldId(pressId);
        setDragging(true);
      }
      setPointer({ x: e.clientX, y: e.clientY });
      setOverPosition(slotAt(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      if (!started) {
        setPressId(null);
        return;
      }
      swallowClick.current = true;
      setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      const target = slotAt(e.clientX, e.clientY);
      if (target !== null) dropOn(target, pressId);
      resetGesture();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', resetGesture);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', resetGesture);
    };
  }, [pressId, army]);

  useEffect(() => {
    if (mergeFlash === null) return;
    const t = setTimeout(() => setMergeFlash(null), MERGE_FLASH_MS);
    return () => clearTimeout(t);
  }, [mergeFlash]);

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

  function dropOn(position: Position, stackId: string) {
    const drop = resolveDrop(army, stackId, position);
    if (drop.kind === 'none') return;
    if (drop.kind === 'merge') {
      onMergeStacks(drop.keepStackId, drop.absorbStackId);
      setMergeFlash(position);
      return;
    }
    const snapshot = new Map<string, DOMRect>();
    iconRefs.current.forEach((el, id) => snapshot.set(id, el.getBoundingClientRect()));
    beforeRects.current = snapshot;
    onMoveStack(drop.stackId, drop.toPosition);
  }

  function clickSlot(position: Position, occupant: ArmyStack | undefined) {
    if (disabled || swallowClick.current) return;
    if (placing) {
      if (!occupant) onPlaceSplit(position);
      return;
    }
    if (!heldId) {
      if (occupant) setHeldId(occupant.stackId);
      return;
    }
    if (occupant?.stackId !== heldId) dropOn(position, heldId);
    resetGesture();
  }

  function pressSlot(e: React.PointerEvent, occupant: ArmyStack | undefined) {
    swallowClick.current = false;
    if (disabled || busy || !occupant || e.button !== 0) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    setPressId(occupant.stackId);
  }

  const ghostStack = dragging ? heldStack : placingStack;
  const ghostCount = placing && ghostStack ? placing.count : ghostStack?.count;
  const gridClasses = ['army-grid'];
  if (held) gridClasses.push('holding');
  if (placingStack) gridClasses.push('placing');
  if (dragging) gridClasses.push('dragging');
  if (disabled) gridClasses.push('disabled');

  return (
    <div className="army-block">
      <div className="army-row-labels">
        <span className="army-row-label front">Front</span>
        <span className="army-row-label back">Back</span>
      </div>
      <div className={gridClasses.join(' ')} ref={gridRef}>
        {POSITIONS.map((position) => {
          const s = alive.find((a) => a.position === position);
          const classes = ['army-slot', s ? 'filled' : 'empty'];
          if (s && (s.stackId === heldId || s.stackId === placing?.stackId)) classes.push('held');
          if (heldId && s && s.stackId !== heldId) classes.push(`drop-${resolveDrop(army, heldId, position).kind}`);
          if (dragging && overPosition === position) classes.push('over');
          if (mergeFlash === position) classes.push('merged');
          const count = s && placing && s.stackId === placing.stackId ? s.count - placing.count : s?.count;
          return (
            <Tip key={position} tip={s ? `${slotTitle(position)} (${UNIT_DEFINITIONS[s.unitId].name})` : slotTitle(position)}>
              <div
                className={classes.join(' ')}
                data-position={position}
                onPointerDown={(e) => pressSlot(e, s)}
                onClick={() => clickSlot(position, s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!s || disabled || dragging || placing) return;
                  resetGesture();
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
                      <UnitArt unitId={s.unitId} />
                      <Tip tip={roleTip(s.unitId)}>
                        <span className="army-slot-role">
                          <Icon name={UNIT_ROLE_ICONS[s.unitId]} />
                        </span>
                      </Tip>
                    </span>
                    <span className="army-slot-text">
                      <span className="army-slot-count">×{count}</span>
                      <span className="army-slot-name">{UNIT_DEFINITIONS[s.unitId].name}</span>
                    </span>
                    <span className="army-slot-swap">
                      <Icon name="ui_swap" />
                    </span>
                    <span className="army-slot-merge-label">Merge</span>
                    {recentRecruit?.unitId === s.unitId && <span className="recruit-flourish">+{recentRecruit.amount}</span>}
                    {mergeFlash === position && <span className="recruit-flourish">Merged</span>}
                  </>
                ) : (
                  <>
                    <span className="army-slot-empty-label">Empty</span>
                    <span className="army-slot-move-label">{placing ? 'Place here' : 'Move here'}</span>
                  </>
                )}
                <span className="army-slot-digit">{position}</span>
              </div>
            </Tip>
          );
        })}
      </div>
      {ghostStack &&
        pointer &&
        createPortal(
          <div className="army-ghost" style={{ left: pointer.x, top: pointer.y }}>
            <span className="army-slot-icon">
              <UnitArt unitId={ghostStack.unitId} />
            </span>
            <span className="army-slot-count">×{ghostCount}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
