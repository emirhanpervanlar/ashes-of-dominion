import { MASTER, TRANSPARENT } from './palette.js';
import type { Palette } from './palette.js';

export type Grid = readonly string[];

const urlCache = new Map<string, string>();

/** Rasterises palette-indexed grids side by side to one PNG data URL, one canvas pixel per grid cell. Cached by `cacheKey`. */
export function gridsToUrl(cacheKey: string, grids: readonly Grid[], palette: Palette = MASTER): string {
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
  });
  const url = canvas.toDataURL();
  urlCache.set(cacheKey, url);
  return url;
}

export function gridToUrl(cacheKey: string, grid: Grid, palette: Palette = MASTER): string {
  return gridsToUrl(cacheKey, [grid], palette);
}
