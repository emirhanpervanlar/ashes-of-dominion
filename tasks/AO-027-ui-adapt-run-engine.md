# AO-027 UI adapts to the new run engine (map, boss, city/Threat, food, events, relics) - fixes the broken Road screen
Owner-intent: "after hero select the Road screen does not appear" (the UI still speaks the old engine: road/city nodes, ENTER_CITY, old events). Make the whole run playable again in the new visual language.
Agent: ui-frontend
Priority: P0
Depends-on: AO-026 merged
Branch: ai/AO-027

## Source of truth
docs/DECISIONS.md AO-D045..D060 (esp. D046 boss, D047/D051 city + Threat, D048/D053/D057 food/loot/starvation, D050/D054/D056 events, D035/D052 removal, D037 relics), docs/SYSTEM_SPEC.md (Run layer lists every new export/action/event), docs/DESIGN_LANGUAGE.md (use existing shared classes and pixel `Icon`s; add missing icons in the same grid format: `farm`, node `start`, threat, boss warning, etc.), tasks/AO-011..AO-025 reports are in SYSTEM_SPEC.

## Must change (function first; keep the current layouts, no redesign yet)
1. Make it compile and run: `npx tsc --noEmit` clean, `npx vitest run` fully green (including the Farm icon test and a new icon test entries). Known breakages: `ENTER_CITY` (now `TRAVEL_TO_CITY`), NodeType `road`/`city` removed and `start` added (mapIcons.ts, WorldMapScreen.tsx), `STARVING` replaced by `STARVED`, `EventScreen` must use `eventView(run)`, reward `relicChoices`/`relicOffer` + `CLAIM_RELIC`.
2. Road screen (WorldMapScreen + bar): current node card incl. `start`; choices for battle / elite / resource / merchant / event / boss; nodes up to `worldMap.revealedUntilStep` are shown; "Enter City" button ALWAYS available on the map: opens a confirm popup with the Threat warning text (`CITY_VISIT_WARNING`, current enemy strength and after one more visit via `enemyStrengthAfterCityVisits`), then TRAVEL_TO_CITY; a notice after returning ("Enemies grew stronger"). Show the Threat value somewhere in the bar. Leaving the city returns to the map.
3. Day / boss: next to the Day pill show "Boss in N days" from `daysUntilBoss(run)`; when `bossWarning(run)` (last 7 days) it turns red, pulses (pixel-step animation from the design language) and shows a banner once when entering the window. Show chapter (1-3).
4. Food and starvation: resources column shows Food with daily net (upkeep, production, net via `dailyUpkeep/dailyProduction/dailyFoodNet`), a tooltip-like popup or hover text explaining them; `foodWarning` styles Food red; when starving show `starvationForecast(run)` and the morale malus; the toast/history for `STARVED` reads "N Swordsman(s) starved" per unit type. Unit info popup shows each stack's food use (`stackUpkeep`) and has a "Dismiss" control (whole stack or a count; last unit type cannot be dismissed) calling DISMISS_STACK, only outside battle.
5. Events: EventScreen renders `eventView(run)`: each option with `available`/`reason` (greyed with the reason), the outcome text `EVENT_RESOLVED.text`, card picker (`choice.kind='card'`: upgrade/remove/give, with cancel via CANCEL_EVENT_CARD... use the exact actions in SYSTEM_SPEC), unit-offer picker (`choice.kind='unit'`), and the pending unit gain popup: the army shown with `run.pendingUnitChoice.newcomer` as a 7th entry, dismiss (whole/partial) or DECLINE_UNIT_GAIN. Ambush outcome hands over to the battle screen.
6. Reward screens: elite relic offer and boss `relicChoices` (choose 1 of 3, rarity frames per design language) via CLAIM_RELIC, then the normal card/removal/skip pick; loot line "+N Gold / +N Food" from `BATTLE_LOOT`.
7. City: Farm building (5 tiers: name, tier numeral, food per day, next tier cost, upgrade button via UPGRADE_FARM), Mage Tower tiers stay; card removal shows the City price curve (free first, then `cityRemovalPrice`); Merchant shows relic rarity + price.
8. History/toast texts (`runEventText.ts`, App.tsx toasts) for every new RunEvent: CITY_VISITED, BOSS_DEFEATED, CHAPTER_STARTED, BATTLE_LOOT, DAILY_INCOME {gold, food}, FARM_UPGRADED, STARVED, THREAT_CHANGED, UNITS_GAINED, UNITS_LOST, UNITS_DISMISSED, UNIT_GAIN_DECLINED, MAGE_TOWER_UPGRADED, EVENT_RESOLVED text.
9. Hero select fixes the owner reported: hero stats readable (proper labelled stat rows with icons, legible size), and the Start/Continue button disabled while the commander name is empty or whitespace. (The single-screen hero+relic merge is a later task; keep the two steps but fix these two.)
10. Old saves: `loadInitialRun` migrates (migrateRun); an old save must land on a working Road screen.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md (update Road/City/Event/Reward/Defeat sections).

## Forbidden
src/engine/** (report engine gaps), game rules, big redesigns.

## Acceptance criteria
1. tsc clean; vitest fully green. 2. Browser (puppeteer-core, port other than 5173; inject `aod_run_state_v1` BEFORE load with evaluateOnNewDocument; never touch 5173; stop the server after): new run -> hero select (name required, stats readable) -> starting relic -> Road screen with choices; walk several steps; battle; reward; event with a card picker and one with the unit-overflow popup; city via the always-on button with the Threat warning; Farm upgrade; a starving state (inject food 0) showing forecast, STARVED toast; boss warning window (inject day 24); boss reward relic choice. Screenshots of each looked at. 3. No console errors. 4. Report anything still missing.

## Status
- 2026-09-20 ACCEPTED (tsc clean, 392 tests, screenshots reviewed). Open: bar resource pills clip at some widths ("DAY 1", "BOSS IN 29 DAYS" on day 1); battle-to-victory not exercised in browser by the agent.
