# AO-038 City redesign (Heroes 3 style) and building panels
Owner-intent: "the Temple screen and all City popups are raw; redesign the City to fit the game and the reference games (Heroes 3 town), including the effects list"
Agent: ui-frontend
Priority: P0
Depends-on: AO-037 merged
Branch: ai/AO-038 (ui worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D062, D020, D036, D052, D058, D047, D048, D035; docs/DESIGN_LANGUAGE.md (section 9 City row, wood/stone, panels, plaques, tiers), docs/style-proof/index.html; docs/SYSTEM_SPEC.md run layer (city.ts: BUILDING_DEFINITIONS, LEVEL_SLOTS, LEVEL_UP_COST, RECRUIT_COSTS, Mage Tower and Farm tiers, doctrines, `city.buildings`, card removal price, Threat); current code src/ui/CityScreen.tsx.

## Must change
1. City view: a town scene per the design language (warm stone + wood, code-drawn skyline behind), buildings as clear plots/structures with built / buildable / locked (slot limit) / affordable states, each with its pixel `bld_*` icon and a Tip (cost, effect); header plaque with the city name, level and slots used (e.g. 4/5), gold; Leave button; Threat notice (visits make enemies stronger).
2. Each building opens a WIDE titled panel (Modal shell) with its own layout, no more small raw popups:
   - Barracks: unit cards (pixel unit art, name, role, stats, cost per unit in Gold + Food upkeep per unit) with +/- quantity steppers (and Max), total cost, Recruit button; shows army capacity rules (merge into same type / first free slot; army full message).
   - Town Hall: level progression ladder (levels, slots per level, costs, next level Upgrade button); card removal section (price from `cardRemovalQuote`, free first, then price curve; opens the picker).
   - Temple: doctrines as large cards (name, plain-language effect, chosen state, Choose button; one permanent choice with a confirm).
   - Mage Tower and Farm: tier ladders (I-III / I-V) with cumulative bonus, next tier cost, Upgrade button.
   - Market, Forge, Stable, Shrine, Gold Mine, Training Hall: effect text, cost, Build button, built state.
3. "Active effects" list panel (in the city view): every effect currently granted by built buildings and doctrine (recruit discount, army attack, food upkeep reduction, daily income, farm production, max Mana, revival after battle, etc.) with icons, computed from engine data (no duplicated numbers where the engine exports them; ask via a report for missing exports).
4. Bottom bar stays shared with the Road; make the relic grid cells 32px per AO-D042 (re-measure the bar at 1280/1366/1600, no horizontal scroll, no clipping) and keep the 3x2 army grid.
5. All strings English, tooltips through the shared Tip, modals through the shared Modal, no emoji, no border-radius.
6. Delete every class/component this orphans; docs/SCREEN_SPEC.md City section rewritten.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/** (report gaps), changing building rules or numbers.

## Acceptance criteria
tsc clean, vitest green (tests for pure helpers such as the effects list builder and recruit total calculation). Browser (puppeteer-core, dev server port 5206, never 5173/4173, inject state BEFORE load): city at level 1 with few buildings and at a rich late state; open every building panel; recruit with steppers (gold/food change, army merge and full-army cases); build and upgrade Mage Tower and Farm; choose a doctrine; card removal from Town Hall; active effects list; measurements of the bar at 1280/1366/1600. Screenshots looked at, no console errors.
