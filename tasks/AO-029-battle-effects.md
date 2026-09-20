# AO-029 Battle effects and step-by-step enemy playback
Owner-intent: "code-drawn battle effects (attack lunges, slashes, projectiles, block, buffs, freeze, chains), the enemy turn played step by step with the real numbers, enemy damage visible on my units"
Agent: ui-frontend
Priority: P0
Depends-on: AO-028 merged
Branch: ai/AO-029

## Source of truth
docs/DECISIONS.md AO-D022, D023, D024; docs/DESIGN_LANGUAGE.md section 8 (durations, easings, the 13 effects) and the style proof's effect demos (copy the working CSS/JS: lunge, slash, arrow bolt, block ring, hit shake, death fade, heal/buff particles, freeze ice, chains); docs/SYSTEM_SPEC.md combat section: `END_TURN` returns `enemySteps` (actor, kind, target, hits[] incl. counterattacks, statuses[], resulting[] snapshots) and `STACK_ATTACKED` carries `unitsKilled` / `countAfter`.

## Must change
1. Effects layer over the battlefield (pointer-events none): unit lunge toward the target and back, sword slash, arrow/bolt projectile from the attacker to the target, hit shake + flash, death fade when a stack is wiped, block ring on Block gain, heal and buff particles, freeze ice, chain overlay appear/disappear, debuff drops (poison). Steps-based pixel animations per the design language; respect `prefers-reduced-motion` (skip motion, keep the floaters).
2. Floating text on the target (both sides): "-N units" (N > 0) or "Wounded"; "+N block", heal "+N units", status gains with the icon; enemy actions included.
3. Enemy turn playback: after END_TURN the UI replays `enemySteps` one by one (short beat between steps, ~500-700 ms per action; a skip control: click or Space skips to the end) applying each step's `resulting` snapshot to the displayed board so the counts change step by step and floaters show the real numbers, then lands on the engine's final state (must equal it exactly; assert in dev). Replace the old pre-resolution intent playback entirely (AO-D003: no intent preview) and delete its code.
4. Player actions use the same effect vocabulary (card play, basic attack, heal), driven by the combat events of the action.
5. Log drawer stays; add nothing to the centre as text.
6. Docs/SCREEN_SPEC.md battle effects section.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/**, rules.

## Acceptance criteria
tsc clean, vitest green (add unit tests for the step-replay reducer/helper: replaying steps over the pre-turn state equals the final state for several seeded battles). Browser: play a full turn cycle; screenshots/frames of: attack lunge + slash, projectile, block ring, heal, freeze, chains, death fade, enemy step 1..N with changing counts, skip. Capture at least 3 frames of an animation to prove motion. No console errors, no stuck animation state after skip or quick clicks.

## Status
- 2026-09-20 ACCEPTED (404 tests). Ideas: bolt/lunge are small on the wide field; counterattack applied with first hit; run layer does not return enemySteps (UI recomputes with the same pure call): expose it on RunApplyResult later; no card gives Block yet (GAIN_BLOCK unused).
