# AO-043 Final UI fixes (QA report + polish + engine hand-offs)
Owner-intent: solid, cohesive UI at all common viewport sizes; no silent data loss; robust loading
Agent: ui-frontend
Priority: P0
Depends-on: main (AO-042 merged)
Branch: ai/AO-043 (ui worktree, from main)

## Source of truth
The QA report of the final sweep (bugs 1-8, polish, spec drift), the reviewer hand-offs from AO-042, and the ideas lists of AO-028..AO-040 reports. Viewports to satisfy: 1366x900 (reference), 1280x720, 1366x768, 1600x900.

## Must change
1. (MEDIUM-HIGH) End Turn bar must never cover enemy tiles: at 1280x720 and 1366x768 the third-row enemy tiles are under `.endturn-bar`. Re-layout the battlefield/bar so the field has enough height (scale the tile grid or reduce the bar/hand tray heights at short viewports with a container-based layout) and add a measured check (elementFromPoint on every tile centre in a full 3x2 boss board is the tile, not the bar).
2. (MEDIUM) City at 1280x720: all plots visible without hidden scrolling (scale the town to the available height or a two-column compact grid); a visible scroll cue if scrolling remains; opening a row-3 plot must not scroll the header off-screen.
3. (MEDIUM) Defeat/Victory at 1280x720: buttons always visible (layout that fits or sticky footer).
4. (LOW-MED) Road path cards at 1280x720 never clipped by the bottom bar when the food-alert strip or boss banner shows.
5. (LOW) Reward screen with a relic row at 1280x720: Remove/Skip fully visible.
6. (LOW, robustness) Load path: use `validateSave(JSON.parse(raw))` from the engine; null/throw -> title with no save and `hasSave=false`; add a React error boundary around the game that shows a pixel-style "Something went wrong" panel with "Back to menu" and "Clear save and restart" buttons instead of a white screen.
7. (LOW, keyboard) Esc closes the Battle Log / History drawer; focus returns to the Log button.
8. (LOW, a11y) Hand cards and unit tiles are keyboard-operable (tabIndex 0, Enter/Space to select/play, focus ring per the design language) and the icon-only buttons (hero portrait, Deck, Log, Menu, End Turn) get aria-labels; keep Space=end turn only when nothing is focused on a control.
9. Spec drift: every Mana cost gem has a Tip "Costs N Mana to play" ("(was N)" when cheaper); document the drawer Esc behaviour.
10. Polish list: "New Run" from the title with an existing save asks "Abandon your current run?" (Confirm/Cancel); the Food popup rows sum to the same rounded total the bar shows (show the rounding line "Rounded: -3/day") ; remove the duplicate "Loot" toast when loot pills are on the reward screen; toasts do not linger over Victory/Defeat; the floating menu button placement is consistent on Merchant/Event/Reward and Road; hero setup at 1280x720 shows all 5 relics without a cut-off (compact grid); hero popup title truncation; city tooltips close after a click; hide the hover Tip during army drag; shorter dedicated merge flourish; on-screen hint in split placing mode ("Click an empty slot, Esc to cancel"); unit count badge no longer covers the sprite (move to the tile corner outside the art or make it smaller); enemy sprites for Goblin/Orc/Shaman/Wolf get a cold rim/tint on the enemy side (palette substitution) so team is readable; scrollbar hint in scrolling modals (pixel scrollbar per the design language).
11. Engine hand-offs: import `MAX_ARMY_STACKS`, `ROMAN`, Farm/Mage Tower ladder constants and other exported constants instead of hard-coded numbers in UI files (grep for literal 6 stack limits, tier text); remove the duplicate `ROMAN` in cityView.ts.
12. Delete orphaned CSS/utility classes the review listed if nothing references them (`bevel-2`, `bevel-4`, `bevel-in`, `trim-gold`, `panel--iron`, `panel--gold`, `divider`) after grep; docs/SCREEN_SPEC.md updated for everything changed.

## Allowed files
src/ui/**, src/App.tsx, src/main.tsx, src/index.css, index.html, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/** (report gaps), design changes.

## Acceptance criteria
tsc clean, vitest green (add tests for pure helpers and the tile-not-covered measurement where practical). Browser at 1280x720, 1366x768, 1366x900, 1600x900 (puppeteer-core, dev server port 5210, never 5173/4173, inject state BEFORE load): battle with full boss board (no tile under the End Turn bar), city (all 12 plots reachable, header stays), defeat/victory buttons, road with alert strip, reward with relic row, hero setup with 5 relics, corrupt-save recovery via error boundary, Esc closes the log, keyboard-only play of one turn, new-run confirm; screenshots looked at; no console errors.
