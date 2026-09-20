import type { RunState } from '../types.js';

/** A save as older builds wrote it: the same object without `saveVersion` (a missing version means "before versioning"). */
export function legacySave(run: object): RunState {
  const { saveVersion: _version, ...rest } = run as Record<string, unknown>;
  return rest as unknown as RunState;
}
