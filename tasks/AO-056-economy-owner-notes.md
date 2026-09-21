# AO-056 Economy/run engine: mine/farm fights, one event at a time, Temple change every 7 days, minesCaptured summary
Owner-intent: D083, D085, D087 (Temple), plus a gap from AO-054
Agent: gameplay-economy
Priority: P1
Depends-on: main
Branch: ai/AO-056 (eco worktree, from main)

## Must change
1. AO-D083: Mine (and Fort/Farm-type) road nodes must always start a battle; no free capture. Mines currently give +1 Gold/day after capture: keep rewards, but gate them behind winning a battle (a weaker encounter than a fort, scaled like a regular fight). Report how the node resolves today and what changed; update tests and SYSTEM_SPEC.
2. AO-D085: at most ONE event at a time on the road: find where 2-3 events can be pending together (spawn on the same step, chained events, pending event queue) and make it one; add a test.
3. AO-D087 Temple: the chosen doctrine can be changed once every 7 days (day counter based, action validation with a clear rejection reason, expose `nextDoctrineChangeDay`/similar for the UI, save format bump/migration if required with a test).
4. Add the `minesCaptured` row to runSummary (src/engine/run/summary.ts) after Forts taken; export SHAMAN_BUFF_STRENGTH from intents.ts; fix stale "+" descriptions in cardUpgrades.ts for Fireball+ and Formation+ (numbers per data).
No design changes: raise a DDR for anything unclear.
## Allowed files
src/engine/** (run layer, summary, intents export, cardUpgrades texts), tests, docs/SYSTEM_SPEC.md. Forbidden: UI (list what the UI must adopt).
## Acceptance
tsc errors only in UI files that need adoption (list them), vitest green, each change has a failing-before test, report lists new actions/fields for the UI.
