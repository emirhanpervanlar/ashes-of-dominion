# AO-037 UI follow-ups on the finished engine (status data, enemySteps, drawbacks, pickers, polish)
Owner-intent: keep UI text truthful and simple; use the engine's data instead of copies
Agent: ui-frontend
Priority: P1
Depends-on: AO-035/036 merged into main
Branch: ai/AO-037 (ui worktree, from main)

## Must change
1. Status tooltips read `STATUS_INFO` / `statusEffectText(id, amount)` from the engine; delete the mirrored `STATUS_INFO` table and hard-coded numbers in `src/ui/tipContent.ts` (tests updated so they assert engine-derived text).
2. Enemy playback uses `RunApplyResult.enemySteps` from the run action result; remove the second `applyPlayerAction` call in App.tsx (keep the dev assertion that the replay equals the final state).
3. Relic drawbacks: render `drawbacks` (from `startingRelicList()` / `foundRelicList()` / `RELIC_DEFINITIONS[id].drawbacks`) as a separate red line in relic tooltips, hero+relic screen cards, reward/merchant/boss relic cards and the hero popup relic list; benefit text stays normal colour.
4. Event upgrade/remove card picker groups duplicates ("Charge x3") with an `xN` chip like the deck viewer, and never clips its last row in the modal (scrolls properly); same check for the removal picker.
5. Discounted cost: a card whose effective cost is lower than the base ("+" versions) shows its cost gem in the "cheaper" colour from the design language (green) in hand and cards; a tip says "Costs 1 (was 2)".
6. Hero + relic screen: Start button pinned next to the preview panel (or a fixed footer) so it is always visible at 1366x900 and 1280x720 without scrolling.
7. Reward relic offer cards (elite/boss) get a rarity frame, a tooltip and right-click info like other cards/relics.
8. End screen: also show the final army (unit art + counts) and the hero's stat block.
9. Delete orphaned code; docs/SCREEN_SPEC.md updates.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/** (report gaps).

## Acceptance criteria
tsc clean, vitest green, browser screenshots of each changed item (hero setup at two viewport sizes, relic tooltip with red drawback, event picker with grouped cards, discounted cost gem, elite reward relic card, end screen with army + stats), enemy playback still identical to final state, no console errors.

## Status
- 2026-09-20 ACCEPTED (526 tests). Ideas: add cheaper cost colour to DESIGN_LANGUAGE 6.4; scrollbar hint in picker modal; right-click info for icon-only relic lists.
