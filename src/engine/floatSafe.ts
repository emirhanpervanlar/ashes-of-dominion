/**
 * Rounding for products of decimals (loss rates, discounts, multipliers). Float noise turns 3 into 3.0000000000000004,
 * so a plain ceil gives one unit too many; snapping to 9 decimals first keeps the rounding on the intended number.
 */
const SNAP = 1e9;

function snap(x: number): number {
  return Math.round(x * SNAP) / SNAP;
}

export function ceilSafe(x: number): number {
  return Math.ceil(snap(x));
}

export function floorSafe(x: number): number {
  return Math.floor(snap(x));
}

export function roundSafe(x: number): number {
  return Math.round(snap(x));
}
