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
const ENEMY_COLD = '#5a86b0';
/** Share of the cold tone blended into every enemy colour: enough to read as the other team, not enough to turn goblins blue. */
const ENEMY_TINT = 0.22;
/** Keys that keep their colour on both teams: the outline and the glowing eyes. */
const TINT_EXEMPT = new Set(['k', 'e']);

/** Mixes `hex` toward `toward` by `amount` (0-1), per channel, rounded. */
export function mixHex(hex: string, toward: string, amount: number): string {
  const channel = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(hex, i) * (1 - amount) + channel(toward, i) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Palette substitution for the enemy side: every colour leans cold, so goblins, orcs, shamans and wolves read as the enemy team. */
function coldPalette(base: Palette): Palette {
  return Object.fromEntries(Object.entries(base).map(([key, hex]) => [key, TINT_EXEMPT.has(key) ? hex : mixHex(hex, ENEMY_COLD, ENEMY_TINT)]));
}

const TEAM_PALETTES: Record<Team, Palette> = {
  player: MASTER,
  enemy: { ...coldPalette(MASTER), a: '#4a6a8a', A: '#26384e', h: '#86a8c8' },
};

/** A one-pixel cold halo around enemy pictures lifts them off the dark window (players have none). */
const TEAM_RIM: Record<Team, string | undefined> = { player: undefined, enemy: '#557fa8' };

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
  return gridsToUrl(`sprite:${id}:${team}`, sprite.frames, TEAM_PALETTES[team], TEAM_RIM[team]);
}
