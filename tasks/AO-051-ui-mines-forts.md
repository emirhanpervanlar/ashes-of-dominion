# AO-051 UI adopts Mines, Forts and the fixed Barracks (AO-047)
Owner-intent: the map shows the new objective nodes; the city treats Barracks as a fixed building
Agent: ui-frontend
Priority: P0
Depends-on: main (AO-047 + AO-049 merged)
Branch: ai/AO-051 (ui worktree, from main)

## Must change
1. Compile clean: NodeType is now `start | battle | fort | mine | village | merchant | event | boss` (`elite_battle` -> `fort`, `resource` -> `mine`): fix mapIcons.ts, WorldMapScreen.tsx (labels, accents, badges, node cards), index.css (`.node-elite_battle`/`.node-resource` -> `.node-fort`/`.node-mine`), icons tests. Draw pixel icons `node_fort` (small enemy camp/palisade with banner) and `node_mine` (pickaxe and cart/mine entrance) in the existing grid format, reuse in Tips: Fort "Assault an enemy camp: hard battle, relic + extra loot"; Mine "Capture: small find and +1 Gold per day (max 6 mines pay)"; Village unchanged.
2. Events/texts: `RESOURCE_FOUND` is now `MINE_CAPTURED {gold, food, mines}` (toast/banner "Mine captured: +G Gold, +F Food, N mines"), `stats.elitesDefeated` -> `fortsTaken` in runEndView/RunEndScreen labels ("Forts taken"), any remaining "Elite" wording in UI -> "Fort"; runEventText total-function (no missing return) with a test covering every RunEvent type.
3. Fort victory: the reward screen already shows the "Relic gained" banner; handle "no relic gained" (simple pool used up: show "The camp held no relic" plus the bonus loot) and boss rewards with 0-3 relicChoices (empty list = no relic row).
4. Barracks fixed building (AO-D080): the city always shows Barracks as a built plot with its tier (I-IV) and Upgrade; remove the "Build Barracks" path from BarracksPanel/CityScreen (`barracksTier` is 1-4, BUILD 'barracks' is refused by the engine), keep the tier ladder, garrison and recruit sections; the cityView "every scene building exists in the engine" test must use the new fixed-building list; hard-coded old recruit prices in cityView tests come from the engine (`recruitQuote`/`RECRUIT_COSTS`).
5. Village help text: read numbers from the engine (`VILLAGE`, `villageDailyFood`, `villageMilitiaPerWeek`) instead of hard-coding (+1 Food a day, militia cap).
6. Polish from the AO-049 report: toasts do not stack over open city panels (lower z-index or offset), the boss reward says clearly "Picking a card forfeits the unclaimed relics", the Barracks modal splits into Recruit / Garrison tabs so it no longer needs scrolling at 900px, empty garrison rows hide the Collect button, a "visited" marker for captured mines/helped villages on the map history if easy.
7. docs/SCREEN_SPEC.md for Road nodes/City/Reward; delete orphaned code.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md, docs/DESIGN_LANGUAGE.md (icon lists only).

## Forbidden
src/engine/**.

## Acceptance criteria
tsc clean, vitest green. Browser (puppeteer-core, dev server port 5213, never 5173/4173; inject state BEFORE load; real clicks): Road with all node types incl. fort, mine, village; capture a mine (toast, +1 Gold/day appears in the day income), assault a fort and win (Relic gained banner, loot), a fort with an exhausted relic pool, boss reward with 0 and 3 relics, city Barracks tabs, end screen "Forts taken"; screenshots looked at; no console errors.
