export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TipPlacement {
  left: number;
  top: number;
  side: 'above' | 'below';
}

/**
 * Where a tooltip of `size` goes relative to `target`: centred on it, 8px away, below when that fits and above otherwise.
 * When neither side fits it takes the roomier one and is clamped, so the bubble is always fully inside the viewport
 * (given a viewport at least as large as the bubble plus the margins).
 */
export function placeTip(target: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, gap = 8, margin = 8): TipPlacement {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const left = clamp(target.left + target.width / 2 - size.width / 2, margin, viewport.width - size.width - margin);

  const below = target.top + target.height + gap;
  const above = target.top - gap - size.height;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const fitsAbove = above >= margin;
  let side: TipPlacement['side'];
  if (fitsBelow) side = 'below';
  else if (fitsAbove) side = 'above';
  else side = viewport.height - (target.top + target.height) >= target.top ? 'below' : 'above';

  const top = clamp(side === 'below' ? below : above, margin, viewport.height - size.height - margin);
  return { left, top, side };
}
