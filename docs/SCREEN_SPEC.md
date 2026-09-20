# Screen Spec

Current layout and behavior of every screen. Items marked **[PLANNED]** are decided but not built (owned by tasks in `tasks/`). Viewport target 1366x900.

## Title
Centered title, menu: New Game, Continue (only if a save exists), Settings.

## Hero Setup (2 steps)
1. Name input + three hero cards (Warlord / Rogue / Mage) showing portrait, tagline and a stat table: five labelled rows (icon, name, value) for Strength, Dexterity, Intelligence, Vitality, Wisdom. **Continue is disabled while the name is empty or only whitespace** (a hint appears under the cards).
2. Starting relic choice (the 5 starting relics), then Begin Journey (also disabled without a name). The single-screen hero + relic merge (AO-D029) is still [PLANNED].

## Road (world map) — meta family
- **Scene (top, fills remaining height):** `Chapter n — Step x / y`, the "You are here — <type>" pill (the `start` node reads "Start"), an always-available **Enter City** button beside it, a red **food alert** strip when `foodWarning` (starving forecast with expected deaths and the morale malus, or days of Food left), "Choose Your Path" and the path cards. When the boss window opens (`bossWarning`, last 7 days) a red banner "The boss draws near: N days left." shows once per chapter per session (click or 6 s to dismiss).
- **Path cards:** 250w x 300h plaques for battle / elite / resource / merchant / event / boss, node-type accent border, corner badge icon. A node shows when its visibility is not `unknown` or its layer is within `worldMap.revealedUntilStep`; layers beyond the next one that were scouted appear as a small "Scouted ahead" icon strip under the cards.
- **Enter City:** opens a confirm popup with `CITY_VISIT_WARNING`, the current enemy strength (`enemyStrengthAfterCityVisits(run)`, x1.00 at Threat 0) and the strength after one more visit; Stay on the Road / Enter City (`TRAVEL_TO_CITY`, no days, no Food). Leaving the city returns to the map and toasts "Enemies grew stronger: Threat N (xM enemy strength)".
- **Bottom bar (200px, shared with City; one component, `GarrisonBar`, takes the run):** 3px top border, padding 8px 16px, 181px content height, 8px spacing scale (4px only between relic cells), column gap 16. Four columns:
  1. Resources (256 content + 16 padding + 4px divider), four 32px rows with 8px gaps: **Gold | Threat**; **Food** (stockpile and daily net, e.g. `50  -2/day`, red with a warning glyph when `foodWarning`; click opens the Food popup with per-stack upkeep, Farm production, net, days left, starvation forecast); **Day | Ch. n/3**; **Boss in N days** (turns red and pulses in 1s pixel steps inside the warning window; static under reduced motion).
  2. Hero (156 content + 16 + 2px divider): plaque 24h, portrait 48h, 3x5 relic grid of 28x28 cells with 4px gaps (hover = name + effect; empty = dashed).
  3. Army (flexible zone, block centered): the 3x2 grid in true board positions. Top row = front, positions 1-3; bottom row = back, positions 4-6; columns = left / center / right lane. A 16px gutter left of the grid carries the rotated FRONT (accent) and BACK (dim) row labels. Slots are 86h, 240w (shrink to a 168 minimum on narrow viewports), 8px gaps. Filled slot: 64x64 icon with a 20px role badge, count `×N` and unit name; empty slot: dashed "Empty".
  4. Buttons (64 wide): Log (history drawer) and Menu, each 64x48.
- **Reposition (AO-D015/D017):** left-click a filled slot to pick the stack up, then click another slot (empty = move, occupied = swap). Right-click a stack opens the unit popup: stats, food use per day (`stackUpkeep`), Split / Merge, and **Dismiss** (count input + two-step confirm; whole stack allowed unless it is the last unit type, then at most count-1) calling `DISMISS_STACK`, outside battle only.
- Toasts (7 s for event outcome texts) and the History drawer use `runEventText.ts`: STARVED ("3 Swordsmen, 1 Archer starved"), BATTLE_LOOT, CHAPTER_STARTED, BOSS_DEFEATED, CITY_VISITED, THREAT_CHANGED, UNITS_GAINED/LOST/DISMISSED, UNIT_GAIN_DECLINED, FARM_UPGRADED, MAGE_TOWER_UPGRADED, DAILY_INCOME, EVENT_RESOLVED text.
- No floating corner menu button, no "New Run" (the pause menu has Main Menu).

## City — meta family
- Scene: sky gradient + CSS castle skyline; hotspots for Town Hall, Barracks, Temple and the eight buildings (built = solid, locked = dashed with cost). Popups per hotspot.
- Town Hall popup: level up, plus **Remove a card**: free the first time, then `cityRemovalPrice` (50, 100, 200 ... Gold, no daily limit; deck floor 5); the popup text shows the price curve and the button shows the current price or the disabled reason (`cardRemovalQuote`).
- Mage Tower popup (built): tier (I-III), `mageTowerDescription`, **Upgrade to Tier N - X Gold** (replaced by "Max tier" at III).
- **Farm** popup: `farmDescription`; built = "Tier N: +F Food per day" and **Upgrade to Tier N+1 - X Gold** (`UPGRADE_FARM`, 5 tiers I-V, "Max tier" at V). The hotspot sub-label shows the tier.
- Barracks popup: four units, count input, cost, single **Recruit** button. No garrison, no Fort.
- Bottom bar: the same `GarrisonBar` as Road; resources column shows **Gold | Slots**, the Food pill (same popup) and the **Leave** button (returns to the map).
- Recruiting shows a "+N" flourish inside the recruited stack's slot. Reposition and the unit popup (with Dismiss) work here too.

## Merchant — overlay family
Top bar (title, gold pill), a shelf of 3 card offers + optional relic offer (rarity frame: common grey, rare steel, epic purple, rarity word on top, price under it), unaffordable = dimmed with a red price, ribbon **Leave** at the bottom-left. Below the shelf a **Remove a card (price)** button opens the deck picker (price rises per use; disabled reasons shown). A toast confirms the removal; the screen stays open.

## Event — overlay family
Rendered from `eventView(run)`: centered `?` badge, plaque title, description, option cards (label + effect text). An option with `available: false` is dimmed and shows its `reason` in red and does not react to clicks. A click calls `CHOOSE_EVENT_OPTION`; the outcome text (`EVENT_RESOLVED.text`) is a long toast and a History line. Sub-steps:
- **Card picker** (`choice.kind = 'card'`): modal grid of the eligible cards titled "Choose a card to upgrade / remove / give away", close button = `CANCEL_EVENT_CHOICE`, a click = `CHOOSE_EVENT_CARD`.
- **Unit picker** (`choice.kind = 'unit'`, Mercenary Camp): two unit tiles, click = `CHOOSE_EVENT_UNIT`, Cancel = `CANCEL_EVENT_CHOICE`.
- **Army full** (`run.pendingUnitChoice`): modal "Your army is full" with the outcome text and all army stacks plus the newcomer (tagged New, gold ring) as tiles showing count and food per day; a click opens the unit popup where Dismiss (whole or part, the newcomer included) calls `DISMISS_STACK`; **Turn the <unit> away** calls `DECLINE_UNIT_GAIN`. The event closes when the engine settles it.
- An ambush outcome hands the run to the battle screen, then the usual reward.

## Reward — overlay family
Banner "Victory! Choose One" ("The Boss Has Fallen!" after a boss), a loot line (pills "+N Gold", "+N Food" from the last `BATTLE_LOOT`), an optional relic row, up to 3 large cards (cost medallion, icon, name, description), then **Remove a card (free)** and **Skip**.
- **Relic row:** an elite victory shows its `relicOffer` ("Elite spoils: take a relic"), a boss victory shows `relicChoices` ("Boss spoils: take one relic", 3 cards). Each is a relic card with a rarity frame (common grey, rare steel, epic purple) and rarity word; a click calls `CLAIM_RELIC`, the row disappears and the screen stays open for the normal pick. Leaving forfeits an unclaimed relic (stated on screen).
- Card pick: one pick only, no Confirm: clicking a card (or upgrade) applies it and the screen closes.

## Deck picker (shared)
Modal listing the whole master deck as cards; clicking one removes it and closes the picker. Used by Reward, Merchant and City. Rendered in a portal so clipped popups cannot trap it.

## Defeat / Run complete
(Unchanged by AO-027.) Run summary and a **New Run** button: clears the saved run, disables Continue and returns to the title screen.

## Battle — battle family
- **Frame:** full-screen ornate frame. Top: hero chip (name, relics, Mana bar) on the left, turn chip on the right. No floating menu button.
- **Body:** left rail = your 2x3 portrait grid (back column, front column), center = scene panel (holds the Drop Card zone for no-target cards), right rail = enemy 2x3 grid (front column, back column).
- **Portrait slot:** rectangular frame, unit icon, role badge, HP strip, name and `xCount`. Selected = white ring; selectable = gold ring; dimmed when not relevant; cannot act = grey with lock (includes a back-row melee stack blocked by a friendly stack in front, AO-D033). Floating text shows `-N units` for kills and `Wounded` when the hit killed nothing; the battle log line carries HP damage, units killed and units left.
- **Bottom bar:** Deck pile (count) at far left, hand in a flat row (no fan), Discard pile (count) at the right of the hand, then a vertical column of three rectangular buttons at the far right: End Turn (top, gold), Log, Settings. Draw = cards slide in from the deck; end of turn = leftover cards slide to the discard pile.
- **Interaction:** click your stack to start its free action, then click a legal enemy (Priest: any friendly stack). Card flow: click card, then the required targets (or the Drop Card zone). Re-click a selected stack to deselect; `Esc` cancels. Dead enemy stacks never act in playback.
- **No pos badge, no HP numbers** on portraits; the count is the health readout. Block and statuses appear as small icons with their amount on the portrait image (top-left), not as text under the name.
- **Right-click** any stack (yours or enemy) opens the unit info popup without split/merge, plus morale, veterancy, block and active statuses.
- **Floating combat text** rises over the affected portrait for the player's own actions only (damage -N, Blocked N, +N block, heal in units, status applied).
- **Cannot act** (acted, frozen, cannotAttack): lock icon, greyed, not selectable; no warning text.
- **Played cards** travel to the scene centre in a fixed layer above the hand bar and stay until the action resolves.
- **Removed on purpose (AO-D003):** enemy intent text/bubble, threatened pulse, hover highlight of attackers, hover damage preview.

## Pause menu / Settings / History drawer
Pause menu: resume, settings (music volume), main menu. History drawer: newest-first numbered log, opened only via a Log button, closed by default.
