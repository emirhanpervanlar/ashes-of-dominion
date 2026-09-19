import { MASTER, TRANSPARENT } from './palette.js';
import type { Palette } from './palette.js';

export type Grid = readonly string[];

const urlCache = new Map<string, string>();

/** Rasterises a palette-indexed grid to a PNG data URL, one canvas pixel per grid cell. Cached by `cacheKey`. */
export function gridToUrl(cacheKey: string, grid: Grid, palette: Palette = MASTER): string {
  const hit = urlCache.get(cacheKey);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = grid[0]?.length ?? 0;
  canvas.height = grid.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row.charAt(x);
      if (key === TRANSPARENT) continue;
      const colour = palette[key];
      if (!colour) throw new Error(`unknown palette key "${key}" in ${cacheKey}`);
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  const url = canvas.toDataURL();
  urlCache.set(cacheKey, url);
  return url;
}
