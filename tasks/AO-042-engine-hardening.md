# AO-042 Engine hardening from the final review (input validation, float safety, saves, constants, dead code)
Owner-intent: robust, consistent code before more content
Agent: gameplay-economy (engine-wide cleanup allowed for this task, no combat rule changes)
Priority: P0
Depends-on: main
Branch: ai/AO-042 (engine worktree, from main)

## Source of truth
The review report findings 1-6 (summarised here).

## Must change
1. Reducer input validation (MEDIUM): `RECRUIT`, `SPLIT_STACK`, `DISMISS_STACK` and any action carrying a count/amount must reject non-integers, NaN, Infinity and non-positive values with ACTION_REJECTED (`Number.isInteger(count) && count > 0`); the same for merges, moves (`toPosition` must be 1-6 integer), and ids that do not exist; add a `default:` branch to the reducer switch (unknown action -> ACTION_REJECTED, never `undefined`). A fuzz test (thousands of hostile actions: NaN, 1.5, negative, huge, missing fields, wrong types) must never throw, never produce NaN/negative gold/food/counts, and never mutate the input state.
2. Float safety (MEDIUM-LOW): `starvationDeaths` (food.ts) `ceil(lossRate * total)` gives off-by-one deaths from float noise (e.g. 3.0000000000000004 -> 4). Fix with a rounding-safe ceil (round to 9 decimals first or `ceil(x - 1e-9)`), apply the same care to any other ceil/floor on products of decimals (loot, upkeep double rounding in food.ts, city discounts); regression tests using the reviewer's cases (need 11 / deficit 2 / 55 units; need 16 / deficit 7 / 40 units).
3. Saves (MEDIUM-LOW): add a `saveVersion` field to RunState (current = 2; missing = legacy) and make `migrateRun` version-aware instead of only "field undefined" guessing; a shape validator `validateSave(unknown): RunState | null` (checks the essential structure: phase, army stacks, map, hero, numbers finite) so App.tsx can fall back to the title screen with no save instead of crashing on a partial/corrupt object; migrate or safely drop an in-progress legacy `combat`/`pendingReward` (choose the safe rule, document it). Keep the storage key. Tests with old-format and corrupt objects.
4. Single constants (LOW-MED): `MAX_ARMY_STACKS` (6) used everywhere in the engine (UI files use it in the UI task; export it); export named constants for the Market discount, Stable discount, Economic doctrine multiplier, Training Hall Mana, resource-node loot ranges (move the hard-coded 20-40 / 10-20 into loot.ts), Merchant card price, starting Gold/Food; make descriptions derive from those constants; remove the duplicated `ROMAN`. Tests assert the text matches the constants.
5. Dead code (LOW): remove unused exports and code the review listed where nothing imports them and no test needs them: `FIRST_CARD_DISCOUNT` effect kind (if no relic uses it and no test), `CARD_COST_LABEL`, `getMusicVolume` if unused, `stackLabel`, `CardRequirement` type, un-needed `export`s on `checkBattleResult`/`StartBattleParams`; keep things used by tests only if they are test helpers in `__tests__` (move helper code out of production files when trivial: `createVerticalSliceScenario`). Do NOT touch UI files except deleting an export that is obviously unused there AND only if trivial; list any UI-side removals for the UI task instead.
6. Stale comments: replace the eight `AGENT.md §` references with the decision ids, fix the stale "future work" / "garrison" / "PROPOSAL awaiting owner" comments, and the `}export const SHRINE_REVIVE_RATIO` formatting glitch in city.ts.

## Allowed files
src/engine/** and tests, docs/SYSTEM_SPEC.md (only the sections you change).

## Forbidden
UI, balance numbers, combat rules, card data.

## Acceptance criteria
tsc clean (UI unaffected) and vitest green with the new fuzz/float/save tests failing on the old code; report lists every removed export and every new constant name.
