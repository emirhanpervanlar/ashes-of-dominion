import { validateSave } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';

/** Where the whole run is saved. */
export const STORAGE_KEY = 'aod_run_state_v1';

/** The saved run, or null when there is none, it is not JSON, or the engine's `validateSave` rejects its shape or version. Never throws. */
export function readSavedRun(storage: Pick<Storage, 'getItem'>): RunState | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** `readSavedRun` on the browser's localStorage (even reaching for it can throw when storage is blocked). */
export function loadSavedRun(): RunState | null {
  try {
    return readSavedRun(localStorage);
  } catch {
    return null;
  }
}
