# AO-044 Documentation sync (task index, backlog, specs, bible)
Owner-intent: docs must match the game; the source-of-truth chain must not contradict itself
Agent: ui-ux (docs only, no src changes)
Priority: P1
Depends-on: main
Branch: none (docs-only; the Director commits)

## Must change (from the final review)
1. tasks/README.md: full task index AO-001..AO-043 with agent and final status (missing files AO-012, AO-015, AO-033 are referenced by name only: describe them in one line; add dated status lines to AO-004, 005, 008, 023, 031, 032 files if missing).
2. tasks/BACKLOG.md: rewrite to the truth: mark everything built as DONE (with the AO id), leave only real open items: balance package awaiting owner decisions, hero XP/levels/stats RPG design (D030), unit XP, unlocks after death (cards, heroes, starting relics), elemental damage types and immunities (D031), objective nodes (D059), heal vs greater_heal identical data, Necromantic Doctrine no-op (needs owner answer), Block cards, boss epic relic pool too small, encounter/loot tuning, Temple/building sprites, more sprites/animation frames, sound. Keep it short.
3. docs/SYSTEM_SPEC.md: "Not built yet" must not list the card upgrade pool (built); "Known divergences" must reflect D013/D044 (melee reach), card-removal values are accepted (D035/D052) not proposals; reflect the saveVersion/validateSave and constants added by AO-042 if not already; keep it consistent with the code by reading the source where unsure.
4. docs/DESIGN_BIBLE.md: it contradicts D041/D024/D042 (no art assets, emoji, three visual families, lock icon, .garrison-slot). Rewrite it as a short bible that defers to DESIGN_LANGUAGE.md for visuals and keeps only still-valid product/UX principles (readability first, no raw HP in battle, etc.), or mark superseded sections clearly.
5. docs/DESIGN_LANGUAGE.md: header says PROPOSAL awaiting owner approval -> approved by D041; section 11 owner questions -> answered (D042); "today 28x28" -> 32; "interim" wording; section 9 City row updated to the AO-038 structure and the classes actually used; add the "cheaper cost gem" colour (moss green) to section 6.4; list sprites and icons as built.
6. docs/DECISIONS.md: add a short note at the top explaining that a few entries (D050, D055, D056, D059) are out of numeric order but chronological; do not renumber or edit decisions.
7. CLAUDE.md: only if it is stale (team table, commands, worktree workflow used in this session: two git worktrees with their own node_modules, never a junction; never touch ports 5173/4173); keep it short.

## Allowed files
tasks/README.md, tasks/BACKLOG.md, task files (status lines only), docs/*.md, CLAUDE.md.

## Forbidden
src/**, changing decisions, changing game design.

## Acceptance criteria
Every statement checked against the code or decisions; report lists each file changed and any doc/code contradiction you could not resolve (owner question).
