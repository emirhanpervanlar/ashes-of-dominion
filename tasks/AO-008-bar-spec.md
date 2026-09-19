# AO-008 Bottom bar spec (AO-D016 / AO-D015)

Grounded in measured 1366x900 City screenshot (Road shares `.garrison-bar`): bar 200h; cols today: resources x16 w96, hero x128 w176, army x320 (6x130 slots, 14 gap, ~350px dead space right of slot 4), buttons x1280 w70 (60x46). Slot 130 + count below leaves no room for two rows.

## Spacing scale
Base 8px: 4 / 8 / 16 / 24 / 32. Every gap, padding and size below is on it (4 only for relic grid gaps). Bar: `border-top 3px`, `padding 8px 16px`, so inner content box = 1334 x 181. Column gap 16; divider = 2px border + 16 padding on resources and hero columns (columns 1-2 only).

## Columns at 1366 (x from bar left)
| Col | Content width | Notes |
|---|---|---|
| 1 Resources | 88 (+16+2 = 106) | 3 stat rows 32h, gap 8, top-aligned. City: Leave 88x32 below (gap 8) — rows do not shift between Road/City. |
| 2 Hero | 156 (+16+2 = 174) | plaque 24h; gap 8; portrait flex (=49h, min 48); gap 8; relic grid 5x3 cells 28x28, gap 4 (156x92). Sum 24+8+49+8+92 = 181. |
| 3 Army | flex (942) | grid centered, see below. |
| 4 Buttons | 64 | Log, Menu each 64x48, gap 8, top-aligned; nothing else. |

Fixed columns total 424; army zone = viewport - 424.

## Army grid (3x2, real positions)
```
|res |hero              | F  [ 1 L ][ 2 C ][ 3 R ]        | Log |
|    |                  | R  [ 4 L ][ 5 C ][ 6 R ]        | Menu|
```
- Label gutter 16w (row label, rotated 270deg, 10px uppercase, letter-spacing 1): **FRONT** (accent) beside row 1, **BACK** (text-dim) beside row 2; gutter-to-grid gap 8.
- Slot: 86h, width `1fr` clamp 168-240 (240 at 1366); gap 8 both axes. Grid height 2x86+8 = 180 (1px slack in 181, centered vertically). Grid width 3x240+16 = 736; gutter+gap 24 => 760 block, centered in the zone (91px symmetric slack at 1366).
- Lane alignment: column = lane (L/C/R) same as battle board; slot tooltip "Front - Left" etc.; a 10px dim position digit 1-6 sits bottom-right in every slot (filled or empty).
- Filled slot (row layout, padding 8): unit icon 64x64 left (emoji 40px); right: count `x26` 20px bold accent, unit name 12px text-dim below, ellipsis. Role badge 20px circle INSIDE the slot at icon top-left (no negative offsets, nothing clipped). No text under the slot.
- Empty slot: dashed 2px border, transparent, "Empty" 12px centered, opacity .55 (as today).
- `+N` recruit flourish: rises inside the slot rect (translateY 0 to -12 while fading, anchored top-right of icon); must stay within slot bounds. Slot/bar `overflow:visible` is NOT a fix.

## Widths
- 1280: fixed cols unchanged; zone 856 -> slots 240 still fit (760); slack 48 each side. 1600: slots capped at 240, slack grows (centered); do not scale anything else. Supported minimum 1024 (slots shrink to 168, no wrap, no horizontal scroll).

## Reposition (AO-D015; Road and City identical, one component)
States per slot: **default**; **hover** (accent border, only when idle or as target); **picked-up** (3px accent outline, icon at 70% opacity, "held" shadow, no size/layout change); **valid target** (while holding: every other slot pulses accent border; hover on empty = "Move here" hint replaces "Empty"; hover on occupied = swap glyph and outline on both slots); **invalid/disabled** (any modal or Log drawer open: no hover, default cursor, held pick auto-cancelled).
- Click stack = pick up; click another slot = move (empty) or swap (occupied); click the same slot, Esc, or click outside the grid = cancel. Drag: pointerdown + >6px move starts drag with 80% ghost; drop on slot = same result, drop elsewhere = cancel. 150ms ease slide of both icons on completion; no toast.
- Empty slot with nothing held: no-op.
- Split/merge popup no longer fits on click. Proposal: right-click (matches AO-D011) or a small "..." affordance opens it. **DDR needed** (changes AO-D010 behavior). Dropping a stack on the same unit type = swap, never merge (merging stays in the popup).

## Folded-in fixes
- Merchant: Menu button must not overlap gold pill; pill right edge <= Menu left - 16 (reserve top-bar right zone 64+16).
- Defeat screen: remove "Per AGENT.md §5"; developer references never appear in player text (replace copy with in-world wording; copy owner: Director).

## Acceptance (getBoundingClientRect, 1366x900)
1. `.garrison-bar` h=200; children top = 700+3+8 and bottom <= 900-8.
2. 6 slots exist in a 3x2 grid: slots 1-3 share `top`, 4-6 share `top` = row1 top + 94; column lefts identical for 1/4, 2/5, 3/6; widths 240, heights 86; column gap 8.
3. Grid block (gutter through slot 6) fully inside army zone; centered within 1px; no slot/badge/flourish rect leaves its slot rect (badge inside, `+N` within slot).
4. Row labels: FRONT vertically centered on row 1, BACK on row 2 (+-1px).
5. Column x/widths: res content x=16 w=88, hero content x=138 w=156, relic cell 28x28 gap 4, plaque h=24; all inside 181 without overflow; buttons 64x48 gap 8 and right edge = 1366-16.
6. Every measured size/gap in the bar is a multiple of 4 (8 preferred); pixel-identical bar rects on Road and City except Leave button.
7. At 1280 and 1600: no horizontal scroll, slots <=240 wide, same heights, grid centered +-1px.
8. Interaction: click A then empty B => stack lands at B position (state check); click A then occupied B => swapped; Esc, same-slot click, outside click => no change; opening any modal while held => cancelled and slots unresponsive; works on Road and City.
9. Merchant Menu vs gold pill rects do not intersect; defeat text contains no "AGENT.md".
