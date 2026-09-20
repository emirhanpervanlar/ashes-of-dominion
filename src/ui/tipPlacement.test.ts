import { describe, expect, it } from 'vitest';
import { placeTip } from './tipPlacement.js';

const viewport = { width: 1366, height: 900 };
const size = { width: 280, height: 120 };
const inside = (p: { left: number; top: number }) =>
  p.left >= 8 && p.top >= 8 && p.left + size.width <= viewport.width - 8 && p.top + size.height <= viewport.height - 8;

describe('placeTip', () => {
  it('goes below the target when it fits, 8px away and centred', () => {
    const p = placeTip({ left: 600, top: 100, width: 40, height: 40 }, size, viewport);
    expect(p.side).toBe('below');
    expect(p.top).toBe(148);
    expect(p.left).toBe(620 - 140);
  });

  it('flips above for a target on the bottom bar', () => {
    const p = placeTip({ left: 600, top: 820, width: 40, height: 40 }, size, viewport);
    expect(p.side).toBe('above');
    expect(p.top).toBe(820 - 8 - 120);
  });

  it('stays inside the viewport at every screen corner and edge', () => {
    const xs = [0, 4, 683, 1330, 1350];
    const ys = [0, 4, 450, 860, 880];
    for (const left of xs) {
      for (const top of ys) {
        expect(inside(placeTip({ left, top, width: 32, height: 20 }, size, viewport)), `${left},${top}`).toBe(true);
      }
    }
  });

  it('clamps a very tall bubble on a short viewport', () => {
    const p = placeTip({ left: 10, top: 100, width: 20, height: 20 }, { width: 200, height: 300 }, { width: 400, height: 320 });
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + 300).toBeLessThanOrEqual(312);
  });
});
