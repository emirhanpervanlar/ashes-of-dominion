---
name: release-check
description: Pre-merge checklist the Director (and reviewer) runs before accepting a task branch into main. Use whenever a task moves from IN_REVIEW to ACCEPTED.
---
# release-check

1. Branch is `ai/AO-###`, based on current `main`, commits carry the Co-Authored-By trailer, no stray files (scratch scripts, debug tests, screenshots).
2. `npx tsc --noEmit` clean. `npx vitest run` green. If a build script matters: `npm run build`.
3. Every acceptance criterion in the task file marked pass with evidence. Deviations listed and accepted by the Director.
4. No DECISIONS violations. Any new owner decision written to `docs/DECISIONS.md` as `AO-D###`; SYSTEM_SPEC / SCREEN_SPEC updated and [PLANNED] markers removed for finished items.
5. Tests: new rules protected; no loosened or deleted tests without a note; engine tests independent of UI.
6. UI tasks: screenshots reviewed by the Director (or ui-ux); no console errors; dev server stopped.
7. No dead code or orphaned CSS; no compat shims; no unrelated refactors in the diff.
8. `git diff --stat main...HEAD` is the size you expect for the task.
9. Then: merge (fast-forward or merge commit), push only if the owner asked, mark the task ACCEPTED with the date, delete the branch.
