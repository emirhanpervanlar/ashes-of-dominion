# Screen Spec

Current layout and behavior of every screen. Items marked **[PLANNED]** are decided but not built (owned by tasks in `tasks/`). Viewport target 1366x900.

## Title
Centered title, menu: New Game, Continue (only if a save exists), Settings.

## Hero Setup (2 steps)
1. Name input + three hero cards (Warlord / Rogue / Mage) showing portrait, tagline and STR/DEX/INT/VIT/WIS.
2. Starting relic choice (Royal Banner / Arcane Crystal), then Begin Journey.

## Road (world map) — meta family
- **Scene (top, fills remaining height):** `LAYER n / 7`, "You are here — <type>" pill, `Enter City` button when standing on a city, "Choose Your Path", then path cards.
- **Path cards:** 250w x 300h plaques, node-type accent border, corner badge icon scaled to the card. Unknown nodes are not shown.
- **Bottom bar (200px, shared with City):** four columns
  1. Gold / Food / Day, three rows.
  2. Hero: name plaque (rectangular highlight, must sit fully visible above the portrait), large rectangular portrait, 3x5 relic grid below (15 slots; hover = name + effect; empty = dashed).
  3. Army: always 6 slots. Filled = unit icon square, role badge, count printed below. Empty = dashed rectangle reading "Empty". Slot 130x130px (AO-D010), identical on Road and City. Click opens split/merge popup.
  4. Two fixed-size buttons (60x46): Log (opens history drawer, closed by default) and Menu (pause menu).
- No floating corner menu button, no "New Run" (the pause menu has Main Menu).

## City — meta family
- Scene: sky gradient + CSS castle skyline; hotspots for Town Hall, Barracks, Temple and the seven buildings (built = solid, locked = dashed with cost). Popups per hotspot.
- Barracks popup: four units, count input, cost, single **Recruit** button (goes to the army; disabled if unaffordable or the army is full with no matching stack). No garrison, no Fort.
- Bottom bar: identical to Road (resources column shows Gold / Food / building slots).
- **Leave:** a Leave button under the resources column inside the bar (column 1: Gold / Food / Slots, then Leave).

## Merchant — overlay family
Top bar (title, gold pill), a shelf of 3 card offers + optional relic (gold border) with price under each, unaffordable = dimmed, ribbon **Leave** at the bottom-left.

## Event — overlay family
Centered `?` badge, gold plaque title, description, option cards (label + effect). One click resolves.

## Reward — overlay family
Banner "Victory! Choose a Card", up to 3 large cards (cost medallion, icon, name, description), click selects (cyan ring), button reads Skip or Confirm & Continue. No relics.

## Battle — battle family
- **Frame:** full-screen ornate frame. Top: hero chip (name, relics, Mana bar) on the left, turn chip on the right. No floating menu button.
- **Body:** left rail = your 2x3 portrait grid (back column, front column), center = scene panel (holds the Drop Card zone for no-target cards), right rail = enemy 2x3 grid (front column, back column).
- **Portrait slot:** rectangular frame, unit icon, role badge, HP strip, name and `xCount`. Selected = white ring; selectable = gold ring; dimmed when not relevant; cannot act = grey with lock.
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
