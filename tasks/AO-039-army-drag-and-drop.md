# AO-039 Army drag-and-drop, split placement, merge behaviour
Owner-intent: "drag-and-drop for repositioning; split lets me place the new stack; merge closes the popup; dropping two identical units onto each other merges them"
Agent: ui-frontend
Priority: P1
Depends-on: AO-038 merged (shares the bottom bar)
Branch: ai/AO-039

## Source of truth
docs/DECISIONS.md AO-D061 (amends D017), D015, D016, D054 (dismiss); tasks/AO-008-bar-spec.md and AO-009 for the bar; docs/DESIGN_LANGUAGE.md; docs/SYSTEM_SPEC.md (`MOVE_STACK`, `SPLIT_STACK`, `MERGE_STACKS`, `DISMISS_STACK`, positions 1-6).

## Must change
1. Drag-and-drop on the shared army grid (Road and City, outside battle only): pointer-based drag (mouse and touch via pointer events, no native HTML5 DnD quirks) of a filled slot with a drag ghost of the unit tile; valid targets highlight (empty slot = move, different stack = swap, same unit type = merge), invalid drop returns the tile; disabled while a modal, popup or the Log drawer is open. Click-to-pick-up stays as a fallback; Esc cancels a drag.
2. Dropping onto a stack of the SAME unit type merges via MERGE_STACKS (reverses the D017 "never merges" rule) with a short merge feedback (pixel flourish inside the slot, respecting the no-clip rule); dropping onto a different type swaps via MOVE_STACK.
3. Split: the unit popup Split control asks for the count, then the split-off part is HELD (shown as a ghost following the pointer or a "placing" state with the empty slots highlighted): the player clicks or drops it on an empty slot to place it (SPLIT_STACK then MOVE_STACK, or a single engine-safe sequence; the stack must never be left in a wrong half-state: if placement is cancelled with Esc the split is undone / never applied). If no empty slot exists, Split is disabled with a reason Tip.
4. Merge in the popup closes the popup after the action.
5. Right-click still opens the unit info popup (with Dismiss); the popup is not opened by dragging.
6. Delete orphaned code; docs/SCREEN_SPEC.md army bar section updated.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/** (report gaps, e.g. if a combined split+place action is needed).

## Acceptance criteria
tsc clean, vitest green (tests for the pure drop-resolution helper: empty/other/same-type/invalid). Browser (port 5207, never 5173/4173; inject state BEFORE load; use real pointer events via puppeteer mouse.down/move/up): drag to empty slot, swap, drag same type (merge), Esc mid-drag, split-and-place, split cancelled, merge closes popup, drag disabled during a modal, on both Road and City; screenshots looked at, no console errors.
