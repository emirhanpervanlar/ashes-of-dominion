# AO-036 Engine follow-ups from the UI reports (Weak, status data, relic drawbacks, enemySteps)
Owner-intent: keep numbers and text consistent; give the UI data instead of duplicated tables
Agent: gameplay-combat
Priority: P1
Depends-on: ai/engine-next
Branch: ai/AO-036 (engine worktree, from ai/engine-next)

## Must change
1. Weak consistency (bug vs spec): card text and the tooltip say "Weak: deals 20% less damage" but `effectiveAttack` subtracts the flat amount (20 or 15) from Attack, which under the H3 percentage model is a huge, wrong effect. Make Weak reduce the stack's damage output by `amount`% (multiplicative on the final per-unit damage, min 1 per landed hit), keep durations, update tests and note the change in docs/SYSTEM_SPEC.md. Report the before/after damage numbers for one example.
2. Status effect data: expose one table in the engine (e.g. `STATUS_INFO` in a data file: id, name, short effect text built from the same numbers the combat code uses, whether it is a buff or debuff) so the UI stops mirroring damage.ts in `src/ui/tipContent.ts`. Tests: every StatusType present, texts mention the numbers used by damage.ts/combat.ts (derive from constants where possible). List the export for the UI.
3. Structured relic drawbacks: add an optional `drawbacks: string[]` (or a `benefit`/`drawback` split) to every relic definition that has a downside so the UI can render a red drawback line; keep `description` text unchanged in meaning. Export via the relic list helpers (`startingRelicList()` and the found-relic accessors).
4. `enemySteps` on the run layer: `RunApplyResult` (COMBAT_ACTION END_TURN) also returns `enemySteps` so the UI stops re-running the pure END_TURN to get them; tests.
5. Royal Banner (`ARMY_SIZE_FLAT_LARGEST`) applied mid-run must not full-heal the stack it grows (same class as B3): fix with a test.

## Allowed files
src/engine/** (data, combat/damage, run layer relic and result plumbing), its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, balance numbers other than the Weak conversion, card texts.

## Acceptance criteria
tsc errors only in known UI files; vitest green; report lists the exact new exports and the Weak numbers.
