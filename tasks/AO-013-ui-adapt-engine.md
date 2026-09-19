# AO-013 UI adapts to the new engine (reward, card removal, Mage Tower, New Run, kill counts)
Owner-intent: "reward applies on click, no confirm; remove cards from the deck (reward/merchant/city); New Run goes to the main menu; damage shown as units killed; Mage Tower tiers"
Agent: ui-frontend
Priority: P0
Depends-on: AO-010, AO-011 merged (local main)
Branch: ai/AO-013

## Context
AO-010/AO-011 changed the engine; `npx tsc --noEmit` currently fails ONLY in src/App.tsx and src/ui/RewardScreen.tsx (CONFIRM_REWARD and chosenCardId/chosenUpgradeInstanceId no longer exist). A full visual redesign (pixel-art medieval language, City redesign, battle effects, tooltip system) comes LATER as separate tasks - so keep styling plain, reuse existing classes, do not invent new visual language, do not polish. Function first.

## Source of truth
docs/DECISIONS.md AO-D022, AO-D024 (only the "acted unit faded" part is later work - skip), AO-D026, AO-D027, AO-D033, AO-D035, AO-D036. docs/SYSTEM_SPEC.md (Run layer + combat sections list the exact new engine API).

## Must change
1. RewardScreen (+ its App.tsx call site): no Confirm button. Clicking a card sends CLAIM_CARD, an upgrade sends CLAIM_UPGRADE, Skip sends SKIP_REWARD, and a "Remove a card" option (free, per `cardRemovalQuote(run)`) opens a simple picker of the master deck and sends REMOVE_CARD. One pick only; the screen closes on the pick. Show the quote/why-disabled text.
2. Merchant and City: a "Remove a card" entry using the same picker component and `cardRemovalQuote(run)` (price / "once per week" / deck floor). Show result via the existing toast/log style.
3. City: Mage Tower shows tier (I-III), `mageTowerDescription(city.mageTowerTier)`, and an "Upgrade to Tier N - X Gold" button (UPGRADE_MAGE_TOWER), disabled without gold, hidden/"Max tier" at tier 3. Use the exports listed in SYSTEM_SPEC.
4. New Run bug (defeat and run_complete screens): New Run clears localStorage `aod_run_state_v1`, resets hasSave, and returns to the title/main menu (`appStage = 'title'`) - see App.tsx newRun(); `loadInitialRun` wraps the parsed run in `migrateRun`.
5. `src/ui/runEventText.ts`: texts for CARD_REMOVED, UNITS_REVIVED, DAILY_INCOME, MAGE_TOWER_UPGRADED (and anything else new in RunEvent).
6. Battle: pass the own army as the 4th argument of `computeValidTargets` so back-row melee stacks blocked by a friendly in front (AO-D033, `isBlockedByFrontAlly`) are not targetable/selectable as attackers and show the existing "cannot act" treatment; the player's rejected-action message must not be silent. Floating text and log lines use `unitsKilled` / `countAfter` from STACK_ATTACKED: "-N units" when N>0, "Wounded" when 0 (AO-D022); the combat log keeps HP damage and adds units killed.
7. Do NOT implement the enemy step playback, effects, HP-bar removal, tooltips, End Turn move: those are later tasks.
8. Delete anything this change orphans. Update docs/SCREEN_SPEC.md for Reward/Merchant/City/Defeat.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/** (report an engine gap instead), design changes.

## Acceptance criteria
1. tsc clean, vitest green. 2. Browser (puppeteer-core, 1366x900, port other than 5173, inject `aod_run_state_v1`): reward screen picks apply instantly; card removal works from reward, merchant, city; Mage Tower upgrade visible and works; defeat -> New Run lands on the title with no saved run; a battle showing "-N units"/"Wounded". Screenshots looked at. 3. No console errors.
