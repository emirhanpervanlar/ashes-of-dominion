import { describe, expect, it } from 'vitest';
import { createRun } from '../engine/run/index.js';
import { STORAGE_KEY, readSavedRun } from './saveLoad.js';

const storage = (raw: string | null, throws = false) => ({
  getItem: (key: string) => {
    if (throws) throw new Error('storage blocked');
    return key === STORAGE_KEY ? raw : null;
  },
});

describe('readSavedRun', () => {
  it('returns a valid saved run', () => {
    const run = createRun(11);
    expect(readSavedRun(storage(JSON.stringify(run)))?.seed).toBe(11);
  });

  it('is null for no save, broken JSON, a wrong shape and a blocked storage', () => {
    expect(readSavedRun(storage(null))).toBeNull();
    expect(readSavedRun(storage('{not json'))).toBeNull();
    expect(readSavedRun(storage('42'))).toBeNull();
    expect(readSavedRun(storage('{"phase":"on_map"}'))).toBeNull();
    expect(readSavedRun(storage(JSON.stringify(createRun(1)), true))).toBeNull();
  });

  it('is null for a save from a newer game version', () => {
    expect(readSavedRun(storage(JSON.stringify({ ...createRun(1), saveVersion: 999 })))).toBeNull();
  });
});
