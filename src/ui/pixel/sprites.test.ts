import { describe, expect, it } from 'vitest';
import { HERO_DEFINITIONS, UNIT_DEFINITIONS } from '../../engine/index.js';
import { MASTER } from './palette.js';
import { SPRITE_SIZE, mixHex, withIdleBob } from './sprite.js';
import type { Sprite } from './sprite.js';
import { HERO_SPRITES } from './sprites/heroes.js';
import { UNIT_SPRITES } from './sprites/units.js';

const all: [string, Sprite][] = [...Object.entries(UNIT_SPRITES), ...Object.entries(HERO_SPRITES)];
const MAX_COLOURS = 16;

describe('sprite registry', () => {
  it('has a sprite for every unit id and hero id, and nothing else', () => {
    expect(Object.keys(UNIT_SPRITES).sort()).toEqual(Object.keys(UNIT_DEFINITIONS).sort());
    expect(Object.keys(HERO_SPRITES).sort()).toEqual(Object.keys(HERO_DEFINITIONS).sort());
  });

  it.each(all)('%s: two 32x32 idle frames using master palette keys only', (name, sprite) => {
    expect(sprite.frames.length, name).toBe(2);
    sprite.frames.forEach((grid, f) => {
      expect(grid.length, `${name} frame ${f} rows`).toBe(SPRITE_SIZE);
      grid.forEach((row, y) => {
        expect(row.length, `${name} frame ${f} row ${y} width`).toBe(SPRITE_SIZE);
        for (const key of row) if (key !== '.') expect(MASTER[key], `${name} frame ${f} row ${y} key "${key}"`).toBeDefined();
      });
    });
  });

  it.each(all)('%s: at most 16 colours besides the outline and a visible second frame', (name, sprite) => {
    const keys = new Set(sprite.frames[0].join(''));
    keys.delete('.');
    keys.delete('k');
    expect(keys.size, `${name} colours`).toBeLessThanOrEqual(MAX_COLOURS);
    expect(sprite.frames[1].join(), `${name} idle frame differs`).not.toBe(sprite.frames[0].join());
  });
});

describe('withIdleBob', () => {
  it('sinks everything above the feet row by one and keeps the rest', () => {
    const rows = Array.from({ length: SPRITE_SIZE }, (_, y) => (y === 5 ? 'x'.padEnd(SPRITE_SIZE, '.') : '.'.repeat(SPRITE_SIZE)));
    const { frames } = withIdleBob(rows, 20);
    expect(frames[0]).toBe(rows);
    expect(frames[1][6]).toBe(rows[5]);
    expect(frames[1][5]).toBe('.'.repeat(SPRITE_SIZE));
    expect(frames[1][20]).toBe(rows[20]);
  });
});

describe('enemy palette', () => {
  it('mixHex blends per channel and keeps the ends', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#102030', '#305070', 0.5)).toBe('#203850');
  });
});
