import { MASTER } from './palette.js';
import type { Palette } from './palette.js';
import { gridsToUrl } from './render.js';
import type { Grid } from './render.js';

export const SPRITE_SIZE = 32;

/** A 32x32 palette-indexed picture with two idle frames (the second is the "breathing" pose). */
export interface Sprite {
  frames: readonly [Grid, Grid];
}

export type Team = 'player' | 'enemy';

/** Team characters `a` `A` `h` are terracotta for the player and steel blue for the enemy (AO-D042); every other key is shared. */
const TEAM_PALETTES: Record<Team, Palette> = {
  player: MASTER,
  enemy: { ...MASTER, a: '#4a6a8a', A: '#26384e', h: '#86a8c8' },
};

/**
 * Second idle frame: everything above `feetRow` sinks one row (a one pixel bob), the legs stay planted.
 * Used by the sprites that are drawn as a single pose.
 */
export function withIdleBob(rows: Grid, feetRow: number): Sprite {
  const blank = '.'.repeat(SPRITE_SIZE);
  const bob = rows.map((row, y) => (y < feetRow ? (rows[y - 1] ?? blank) : row));
  return { frames: [rows, bob] };
}

/** Both idle frames side by side as one PNG data URL (cached per sprite and team). */
export function spriteStripUrl(id: string, sprite: Sprite, team: Team): string {
  return gridsToUrl(`sprite:${id}:${team}`, sprite.frames, TEAM_PALETTES[team]);
}
