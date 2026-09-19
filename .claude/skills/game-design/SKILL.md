---
name: game-design
description: Turn an owner's intent about Ashes of Dominion into a checkable design/task spec, check it against the recorded decisions, and surface design questions as DDRs. Use when the owner describes a feeling, a problem, or a feature rather than a concrete change.
---
# game-design

1. **Restate the intent** in one line, in the owner's words. If it is ambiguous, list the 2–3 readings and pick the most likely; ask only if the readings lead to different builds.
2. **Check the record.** Grep `docs/DECISIONS.md`, `docs/SYSTEM_SPEC.md`, `docs/SCREEN_SPEC.md`, then the GDD. Note any existing decision the request touches or reverses. Reversing a decision needs the owner's explicit yes and a new `AO-D###`.
3. **Classify each part**: BUG (violates spec, just fix), UI change (spec exists or ui-ux writes it), RULE change (design decision -> DDR unless the owner already stated the rule), NUMBER change (balance -> DDR with data unless the owner gave the value).
4. **Sequence** by dependency: ux spec -> gameplay-combat/economy -> ui-frontend -> qa-automated -> qa-playtest -> reviewer. Split so no two tasks edit `App.tsx` / `index.css` concurrently.
5. **Write task files** in `tasks/AO-###-slug.md` using the format in `CLAUDE.md`. Acceptance criteria must be pass/fail and observable (a test name, a measured size, a screenshot). Always list Forbidden files.
6. **After the work**, record accepted rule/UI decisions in `docs/DECISIONS.md` and update SYSTEM_SPEC / SCREEN_SPEC so the docs describe reality.

Design guardrails: keep to the pillars in `docs/00_GAME_VISION.md` (command not cast, numbers are bodies, position matters, readable at a glance, small roster). Prefer removing a mechanic to adding one. Never add new resources, statuses or unit types without a DDR.
