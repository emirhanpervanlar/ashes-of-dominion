# AO-034 QA bug fixes (B1-B4 from the AO-033 playtest)
Owner-intent: fix real bugs found by simulated playthroughs; no design changes
Agent: gameplay-combat (B1, B2, B4) then gameplay-economy scope for B3 (same agent may do both, engine only)
Priority: P0
Depends-on: engine branch ai/engine-next (contains AO-031, AO-032)
Branch: ai/AO-034 (created from ai/engine-next in the wow-eng worktree)

## Bugs (each with a repro from the QA report; seeds/scripts are in the scratchpad qa folder: C:\Users\EMIRHA~1\AppData\Local\Temp\claude\d--ai-project-wow\a7e4b8f3-3b8f-4fac-9616-a4b71b17e2f8\scratchpad\qa, repro1..4.ts, run with `npx vite-node --root D:/ai_project/wow-eng <script>`)
- B1 CRITICAL: Emergency Retreat sets `untargetable` and it never expires; it leaks into later battles (stack invulnerable for the rest of the run). `startPlayerTurn` (combat.ts ~834) clears only cannotAttack, cannotMove and incomingDamageReductionPercent. Per the card text and AO-D005 the flag lasts 1 turn: clear it at the start of the owner's next turn (and make sure enemy intents/targeting respect the expiry).
- B2 HIGH: combat-transient state leaks into the run army after victory (`settleArmyAfterVictory` keeps flags, statuses, block, `actedThisTurn`; `isFirstTurn` skips the clear). Observed: stacked armor statuses, `dodgeMultiplier`, `incomingDamageReductionPercent`, `nextAttackDamageBonusPercent`, `selfCasualtyPercentAfterAttack`, `actedThisTurn`. Fix: reset ALL per-battle state (flags, statuses, block, actedThisTurn) when a battle ends (settle) AND when a battle starts, keeping only persistent stack data (count, hp, veterancy, morale as the run defines it). Tests must cover each leaked field.
- B3 MEDIUM: Arcane Crystal (ARMY_SIZE_MULT 0.9) granted mid-run (it is a found relic now). It floors per stack, full-heals wounded stacks and can empty the army (1-unit army -> 0 units). This is a bug fix, not a design change: when the effect is applied mid-run, never reduce a living stack below 1 unit, do not heal, keep army size as close to -10% as flooring allows without emptying stacks, and update the misleading comment in `applyRelicStatEffectsOnce`. Report exactly what rule you chose.
- B4 LOW: PLAY_CARD of an `ally-stack` card with `targetStackId` set to an ENEMY id throws a TypeError instead of ACTION_REJECTED. Validate target side/existence for every target type in PLAY_CARD; fuzz test (random legal+illegal actions, a few thousand steps, several seeds) must produce no throw.

## Must change
Fix B1-B4 with tests that FAIL without the change (use the repro seeds). No balance numbers, no other behaviour changes. docs/SYSTEM_SPEC.md updated where a rule text is now different.

## Allowed files
src/engine/** (combat.ts, army/run settle code, run relic application), its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, balance numbers, card data, damage formula.

## Acceptance criteria
tsc errors only in the known UI files (list); vitest green; report lists each fix, test names and the B3 rule.
