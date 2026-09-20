import type { ArmyStack, Position } from '../engine/index.js';

/** What dropping (or click-placing) a stack on a slot does. `none` = invalid drop, the tile returns. */
export type DropResolution =
  | { kind: 'move'; stackId: string; toPosition: Position }
  | { kind: 'swap'; stackId: string; toPosition: Position }
  | { kind: 'merge'; keepStackId: string; absorbStackId: string }
  | { kind: 'none' };

/**
 * Outside battle: an empty slot moves, a different stack swaps, a stack of the same unit type merges (AO-D061).
 * The merge keeps the target stack so the result stays where the tile was dropped.
 */
export function resolveDrop(army: ArmyStack[], draggedId: string, toPosition: Position): DropResolution {
  const alive = army.filter((s) => s.count > 0);
  const dragged = alive.find((s) => s.stackId === draggedId);
  if (!dragged) return { kind: 'none' };
  const target = alive.find((s) => s.position === toPosition);
  if (!target) return { kind: 'move', stackId: draggedId, toPosition };
  if (target.stackId === draggedId) return { kind: 'none' };
  if (target.unitId === dragged.unitId) return { kind: 'merge', keepStackId: target.stackId, absorbStackId: draggedId };
  return { kind: 'swap', stackId: draggedId, toPosition };
}

/** Positions that accept a held split-off part: the empty ones. */
export function freePositions(army: ArmyStack[]): Position[] {
  const taken = new Set(army.filter((s) => s.count > 0).map((s) => s.position));
  return ([1, 2, 3, 4, 5, 6] as Position[]).filter((p) => !taken.has(p));
}
