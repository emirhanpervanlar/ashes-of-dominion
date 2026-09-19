import { applyRunAction } from '../runEngine.js';
import { eventView } from '../events.js';
import type { RunState } from '../types.js';

/** A pending event as the reducer expects it (no sub-step in progress). */
export function pendingEventOf(eventId: string): NonNullable<RunState['pendingEvent']> {
  return { eventId, choice: null, resolved: null };
}

/** Settles whatever event is pending by trying its available options until one returns to the map (skips gambles that may ambush, card/unit picks). */
export function resolveEventToMap(run: RunState): RunState {
  const view = eventView(run)!;
  for (const option of view.options.filter((o) => o.available)) {
    const result = applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId: option.id }).run;
    if (result.phase === 'on_map') return result;
  }
  throw new Error(`no option of ${view.id} returns to the map`);
}
