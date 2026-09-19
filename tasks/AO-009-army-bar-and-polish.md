# AO-009 Army bar 3x2 + reposition UI + polish
Owner-intent: "army as 3 columns x 2 rows so I always understand the real position; re-proportion the rest of the bar; no drift, no arbitrary sizes, nothing unrelated"
Agent: ui-frontend
Priority: P0
Depends-on: AO-006 and AO-007 merged (MOVE_STACK run action exists)
Branch: ai/AO-009

## Source of truth
`tasks/AO-008-bar-spec.md` (UX spec: exact layout, spacing scale, states, acceptance measurements) + decisions AO-D015, AO-D016, AO-D017 in `docs/DECISIONS.md`. Follow the spec exactly; where it is silent follow `docs/DESIGN_BIBLE.md`. Do not invent layout.

## Must change
1. Road and City share ONE army-grid component (3 columns x 2 rows, front row top = positions 1-3, back row bottom = 4-6, lanes left/center/right, FRONT/BACK gutter labels, position digit + tooltip per slot, 240x86 slots per spec).
2. Bar re-proportioned per spec: resources column (City Leave button under it, rows must not shift between Road and City), hero column (plaque / portrait / 3x5 relic grid), buttons column 64x48, one 8px spacing scale, dividers.
3. Reposition: left-click a filled slot picks it up, click another slot moves/swaps via `MOVE_STACK`; Esc / outside click / same-slot click cancels; disabled while a modal, popup, or Log drawer is open. Right-click a stack opens the existing info/split/merge popup (this replaces the old left-click-to-open behavior). Dropping on the same type swaps, never merges.
4. Polish folded in: `+N` recruit flourish must not clip (stays inside the slot); Merchant screen Menu button must not overlap the gold pill (16px clearance); defeat screen must not print "Per AGENT.md §5" — replace with short neutral player-facing copy that states why the run ended (derive from the existing defeat condition: army wiped / hero fell); Training Hall text must say it grants +2 max Mana if any UI string still says AC/DC (grep `src/ui`).
5. Add `STACK_MOVED` History text in `src/ui/runEventText.ts` if AO-007 added that event.
6. Delete every class/prop/function this change orphans (old 6-slot row, `.garrison-unit-cell`, count-below label, etc.) after grep.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md (update Road/City sections to match, remove stale [PLANNED] markers).

## Forbidden
src/engine/**, game rules.

## Acceptance criteria
Every measurable criterion in AO-008-bar-spec.md verified with getBoundingClientRect at 1366x900 and at 1280 and 1600 widths (report the numbers), plus: reposition works on Road and City in the browser (screenshots before/after a swap), right-click popup works, no console errors, tsc clean, vitest green.

## Verification
puppeteer-core in the scratchpad node_modules; dev server on a port other than 5173; inject a run into localStorage `aod_run_state_v1` (phase `on_map` for Road, `city` for City), wait ~1.5s, click Continue on the title. LOOK at every screenshot.
