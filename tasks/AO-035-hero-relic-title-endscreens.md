# AO-035 UI adopts engine-next: hero + relic one screen, title, end-of-run statistics, card upgrades display
Owner-intent: "hero and starting relic on ONE screen; a rich statistics screen when the run ends; New Run returns to the main menu; title in the new style; upgraded cards ('+') visible and working"
Agent: ui-frontend
Priority: P0
Depends-on: engine branch ai/engine-next merged into this branch (AO-031 atomic start + run summary, AO-032 card upgrades, AO-034 bug fixes)
Branch: ai/AO-035 (in the ui worktree, already contains engine-next)

## Source of truth
docs/DECISIONS.md AO-D027, D029, D037, D041, D042, D043, D060; docs/SYSTEM_SPEC.md (Start: `createRun(seed, heroId, heroName?, relicId)`, `startingRelicList()`, `previewStart(heroId, relicId)`; End: `runSummary(run)`; Card upgrades: `resolveCard(cardId, upgraded)`, `CARD_UPGRADES`, `isUpgradable(instance)`, reward `upgradeOptions {instanceId, cardId}`, `CARD_UPGRADED {instanceId, cardId}`, `cardPlayability(cardId, state, upgraded)`); docs/DESIGN_LANGUAGE.md (title, hero select, run end rows in section 9); docs/style-proof/index.html.

## Must change
1. Compile again on the merged engine: remove all uses of the removed `CHOOSE_STARTING_RELIC` action and `choosing_starting_relic` phase; `createRun` now takes the relic.
2. ONE screen for commander name + hero + starting relic (replaces CommanderSetupScreen and StartingRelicScreen): name field (Start disabled while empty/whitespace), the 3 heroes with readable stats, the 5 starting relics (from `startingRelicList()`, rarity frame, description with drawbacks, Tip), a live preview panel from `previewStart(heroId, relicId)` (army stacks with pixel unit art and counts, max Mana, starting Gold/Food) and one Start button. Selecting hero/relic updates the preview immediately. Layout per the design language; Back returns to the title.
3. Title screen in the new language: plaque logo, stone menu slab with New Run / Continue / Settings, code-drawn pixel castle skyline in the background (simple, in the design language colours), Continue disabled with a reason when no save.
4. Run end screens (defeat and victory) show `runSummary(run)`: cause of death line, all rows grouped (Battle, Journey, Economy) with pixel icons, relics collected (with Tips), Threat, chapter reached; buttons: New Run -> goes to the TITLE and clears the saved run (`aod_run_state_v1`), and Main Menu. (If a previous task already fixed the New Run flow keep it and verify.)
5. Card upgrades everywhere a card is drawn or priced: use `resolveCard(cardId, upgraded)` for name ("Charge +"), effective mana cost and text (`CARD_UPGRADES[id].description` when upgraded); `hasResource`/`handleCardClick`/card flight must use the effective cost (otherwise the player can try to play an upgraded card at the wrong cost); a "+" marker per the design language on hand cards, large cards, deck viewer, pickers; reward screen Upgrade slot shows the base card as the "Upgrade" option with `resolveCard(cardId, true)` preview (base -> "+" text); event card picker lists upgradable instances (`isUpgradable`); `CARD_UPGRADED` history text ("Upgraded Charge."). Also the card info popup shows the "+" text and its playability with the upgraded flag.
6. Delete every class/component/prop this orphans; docs/SCREEN_SPEC.md sections (Title, Hero+Relic, End screens, Reward upgrade slot).

## Allowed files
src/ui/**, src/App.tsx, src/main.tsx, src/index.css, docs/SCREEN_SPEC.md, index.html.

## Forbidden
src/engine/** (report gaps).

## Acceptance criteria
tsc clean, vitest green (add tests for pure helpers you create, e.g. card view/cost resolution). Browser (puppeteer-core, dev server on port 5204, never 5173/4173, inject `aod_run_state_v1` BEFORE load): title -> New Run -> one-screen hero/relic (name empty disables Start; preview changes with the relic, Traveler's Purse shows more Gold, Royal Banner more army) -> Start -> Road; defeat and victory screens with real `runSummary` data (build the states with the real engine in the page); New Run from the end screen lands on the title with no saved run; an upgraded card in hand (played at its reduced cost), in the reward Upgrade slot and in the event picker. Screenshots looked at; no console errors.

## Status
- 2026-09-20 ACCEPTED (524 tests, merged together with engine-next). Ideas: group duplicates in the event upgrade picker; green cost gem for discounted cards; Start button position; end screen could show army morale and hero stats; UI still recomputes enemySteps (engine now provides them).
