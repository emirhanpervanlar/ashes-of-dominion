import { MASTER, TRANSPARENT } from './palette.js';
import type { Palette } from './palette.js';

export type Grid = readonly string[];

const urlCache = new Map<string, string>();

/** Rasterises palette-indexed grids side by side to one PNG data URL, one canvas pixel per grid cell. Cached by `cacheKey`. */
export function gridsToUrl(cacheKey: string, grids: readonly Grid[], palette: Palette = MASTER, rim?: string): string {
  const hit = urlCache.get(cacheKey);
  if (hit) return hit;
  const w = grids[0]?.[0]?.length ?? 0;
  const canvas = document.createElement('canvas');
  canvas.width = w * grids.length;
  canvas.height = grids[0]?.length ?? 0;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  grids.forEach((grid, frame) => {
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const key = row.charAt(x);
        if (key === TRANSPARENT) continue;
        const colour = palette[key];
        if (!colour) throw new Error(`unknown palette key "${key}" in ${cacheKey}`);
        ctx.fillStyle = colour;
        ctx.fillRect(frame * w + x, y, 1, 1);
      }
    });
    if (rim) {
      // A one-pixel halo on the empty cells next to the picture, drawn under nothing (it only fills transparent cells).
      ctx.fillStyle = rim;
      const opaque = (x: number, y: number) => (grid[y]?.charAt(x) ?? TRANSPARENT) !== TRANSPARENT;
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < w; x++) {
          if (opaque(x, y)) continue;
          if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) ctx.fillRect(frame * w + x, y, 1, 1);
        }
      }
    }
  });
  const url = canvas.toDataURL();
  urlCache.set(cacheKey, url);
  return url;
}

export function gridToUrl(cacheKey: string, grid: Grid, palette: Palette = MASTER): string {
  return gridsToUrl(cacheKey, [grid], palette);
}
