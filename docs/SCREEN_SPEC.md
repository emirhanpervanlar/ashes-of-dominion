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
- **Bottom bar (200px, shared with City; one component, `GarrisonBar`):** 3px top border, padding 8px 16px, 181px content height, 8px spacing scale (4px only between relic cells), column gap 16. Four columns:
  1. Resources (88 content + 16 padding + 2px divider): Gold / Food / Day, three 32px rows with 8px gaps.
  2. Hero (156 content + 16 + 2px divider): plaque 24h, portrait 48h, 3x5 relic grid of 28x28 cells with 4px gaps (hover = name + effect; empty = dashed). The 1px left over in the 181px content box sits at the bottom.
  3. Army (flexible zone, block centered): the 3x2 grid in true board positions. Top row = front, positions 1-3; bottom row = back, positions 4-6; columns = left / center / right lane (same lanes as the battle board). A 16px gutter left of the grid carries the rotated FRONT (accent) and BACK (dim) row labels. Slots are 86h, 240w (shrink to a 168 minimum on narrow viewports), 8px gaps; grid 736x180, block 760 wide. Each slot has a dim position digit 1-6 (bottom-right) and a tooltip ("Front - Left"). Filled slot: 64x64 icon with a 20px role badge inside its top-left corner, count `×N` (20px bold accent) and unit name (12px dim) to the right. Empty slot: dashed, "Empty".
  4. Buttons (64 wide): Log (history drawer, closed by default) and Menu (pause menu), each 64x48 with an 8px gap, top-aligned.
- **Reposition (AO-D015/D017):** left-click a filled slot to pick the stack up (3px accent outline, icon dimmed), then click another slot: an empty slot moves it there, an occupied slot swaps (never merges). Same-slot click, Esc, or a click outside the grid cancels. While holding, the other slots pulse; hovering an empty slot reads "Move here", hovering an occupied one shows a swap glyph. Both icons slide for 150ms. Runs `MOVE_STACK` (stack ids never change). Right-click a stack opens the info / split / merge popup. Drag-and-drop is not built.
- No floating corner menu button, no "New Run" (the pause menu has Main Menu).

## City — meta family
- Scene: sky gradient + CSS castle skyline; hotspots for Town Hall, Barracks, Temple and the seven buildings (built = solid, locked = dashed with cost). Popups per hotspot.
- Barracks popup: four units, count input, cost, single **Recruit** button (goes to the army; disabled if unaffordable or the army is full with no matching stack). No garrison, no Fort.
- Bottom bar: the same component as Road, pixel-identical (resources column shows Gold / Food / building slots). Recruiting shows a "+N" flourish that rises inside the recruited stack's slot. Reposition and right-click popup work here too.
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
