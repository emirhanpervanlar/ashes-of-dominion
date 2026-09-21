# AO-049 UI adopts the new economy engine (villages, garrison, Barracks, Marketplace, rewards, free visits)
Owner-intent: the new run features must be playable: villages, weekly garrison, Barracks tiers, Marketplace, relic-gained reward flow, free first city visits; make the project compile again
Agent: ui-frontend
Priority: P0
Depends-on: main (AO-046 + AO-048 merged). Mines and Forts (AO-047) arrive later as a small follow-up: keep node type maps easy to extend.
Branch: ai/AO-049 (ui worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D068, D070, D071, D072, D080; docs/SYSTEM_SPEC.md run layer (City / Barracks / Garrison / Marketplace / Villages / Rewards / Food loot); tasks/AO-046 report exports: `recruitBlocker`, `BARRACKS_TIERS`, `UPGRADE_BARRACKS`, `COLLECT_GARRISON`, `run.garrison`, `weeklyGarrison`, `garrisonCap`, `isGarrisonDay`, `FOOD_MARKET`, `BUY_FOOD`, `foodMarketQuote`, `village` phase with `run.pendingVillage`, `RAID_VILLAGE`, `HELP_VILLAGE`, `villageOffer`, `villageDailyFood`, `villageMilitiaPerWeek`, `farmProduction(city)`, `nextCityVisitRaisesThreat`, `CITY_VISITED {threat, free}`, `pendingReward.relicGained` / `relicChoices`, events GARRISON_GROWN / GARRISON_COLLECTED / BARRACKS_UPGRADED / FOOD_PURCHASED / VILLAGE_RAIDED / VILLAGE_HELPED / RELIC_CLAIMED.

## Must change
1. Compile and test clean again: fix the 16 errors (App.tsx SKIP_REWARD dispatch, RewardScreen relicOffer, runEventText REWARD_SKIPPED + missing return for new events, runEventText.test CITY_VISITED `free`, mapIcons/WorldMapScreen NODE records need `village` (new icon), FoodPopup/tipContent/cityView food helper types now need `villages` in their Pick types (use `farmProduction(city)` / pass the run fields), icons.test keys).
2. Reward screen (AO-D068): no Skip and no Remove card buttons: the player must pick a card or the upgrade slot (the screen title "Victory! Choose One"); elite relic is already granted: show a "Relic gained" banner card (rarity frame, name, benefit text, Tip) above the choices, not selectable; boss keeps the 3-relic choice via CLAIM_RELIC.
3. Village screen (phase `village`): a village scene (simple code-drawn pixel village backdrop in the design language) with the two choices from `run.pendingVillage`: Raid (shows immediate Gold/Food, "Threat +1" warning in red) and Help (immediate reward + permanent effects "+3 Food per day" and "+1 militia per week"); result toast; back to the map. Node card/icon for `village` on the Road, Tip explaining both options.
4. City / Barracks: Barracks panel reworked: tier ladder I-IV (unlocked units with pixel art, weekly garrison per tier, next tier cost, Upgrade button via UPGRADE_BARRACKS), a Garrison section (units waiting per type with counts and the cap, "next arrival in N days" from the world day, Collect all / per unit via COLLECT_GARRISON, disabled with the reason when the army has no room), then the recruit cards only for unlocked units (locked ones greyed with "Unlocks at tier N"); use `recruitBlocker` reasons in Tips. Barracks is a fixed building: (AO-D080 is being implemented in the engine by another agent: treat `city.barracksTier` as 1-4, show the Barracks plot always built with its tier; if tier is 0 show it as "Build" using the existing build action so both engine states work).
5. Marketplace panel in the city (always available, no slot): Food packs with the quote from `foodMarketQuote` (price per pack, next price, max affordable), [-] number [+] quantity control like the Barracks stepper, Buy button via BUY_FOOD, current Gold/Food strip; a small price-history hint "price rises 8% per pack".
6. Threat: the city-visit warning says the first visit of the run/chapter is FREE when `nextCityVisitRaisesThreat(run)` is false (green text, "No Threat increase"); after a visit the notice reflects `CITY_VISITED.free`.
7. Bottom bar / Road: show the weekly garrison day hint in the Day pill Tip ("Garrison grows in N days"), village count and Food per day in the Food popup (`villageDailyFood`), and history/toast texts for every new event (GARRISON_GROWN, GARRISON_COLLECTED, BARRACKS_UPGRADED, FOOD_PURCHASED, VILLAGE_RAIDED, VILLAGE_HELPED, RELIC_CLAIMED, UNITS_RAISED).
8. Draw the missing pixel icons in the existing grid format: `node_village`, `bld_marketplace`, `bld_barracks` tiers if needed, garrison, plus keep `bld_farm`; update icon completeness tests.
9. Update docs/SCREEN_SPEC.md (Reward, Village, City sections), delete orphaned code.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md, docs/DESIGN_LANGUAGE.md (icon lists only).

## Forbidden
src/engine/** (report gaps).

## Acceptance criteria
tsc clean, vitest green. Browser (puppeteer-core, dev server port 5212, never 5173/4173; inject state BEFORE load; real clicks): reward with relic gained banner and no Skip/Remove; village Raid and Help (Food per day appears in the Food popup); city with Barracks tiers, garrison collect (partial when the army is nearly full), recruit with locked/unlocked units; Marketplace purchases with rising price; free first city visit warning; history entries; screenshots looked at; no console errors.

## Status
- 2026-09-21 ACCEPTED (739 tests). Open: village scene empty sky band; Barracks modal tall; toasts over panels; see AO-051.
