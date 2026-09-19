# AO-020 DL-2 Pixel icon engine and emoji removal
Owner-intent: "no emoji, crisp pixel icons everywhere, same language as the style proof"
Agent: ui-frontend
Priority: P0
Depends-on: AO-019 merged
Branch: ai/AO-020

## Source of truth
docs/DESIGN_LANGUAGE.md section 7 (icon set, master palette, string-grid format, 7.4 emoji replacement map) and section 10 DL-2; docs/style-proof/index.html (16 finished icons + renderer: reuse the grids and the renderer code); docs/DECISIONS.md AO-D041, AO-D042.

## Must change
1. `src/ui/pixel/`: palette-indexed grid renderer (canvas or CSS, `image-rendering: pixelated`, integer scales x1/x2/x3), master palette (include the extra keys the style proof needed), an `Icon` component (`<Icon name="sword" size={2} />`), icon registry.
2. Draw ALL icons of the design-language list (resources, unit roles, statuses incl. freeze/chain/poison/weak..., card types/polarities, node types, buildings, UI glyphs, relic icons incl. `travelers_purse`, hero crests, unit portraits as role/unit icons until the sprite phase). Reuse the 16 proof icons as they are. Every StatusType, UnitId, hero, relic id, building id, node type, card polarity and UI glyph used in the game must have an icon; a vitest test enforces completeness (fails when a new id has no icon) and that every grid is 16x16 and only uses palette keys.
3. Replace EVERY emoji and text glyph icon (list in the report what grep found: crest, unit/hero/relic/status/role/node/building/card icons, the buttons glyphs, the dragon ornaments in the battle frame etc.) with `Icon`. Final grep for emoji ranges and the symbols listed in section 7.4 over src returns nothing.
4. Unit portraits: keep one pixel icon per unit id (x3, larger tile art) for now; they will be replaced by sprites in DL-10 through the same component (design the `UnitArt` wrapper so that switch is one place).
5. Delete orphaned emoji tables/files (`unitIcons.ts` emoji parts, `heroIcons.ts` emoji parts, `relicIcons.ts` fallbacks...), no dead code.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, tests under src/ui or src/ (frontend tests), docs/DESIGN_LANGUAGE.md (only to record icon names actually drawn).

## Forbidden
src/engine/** (needs of new ids: report), layout redesign, logic changes.

## Acceptance criteria
tsc clean, vitest green including the icon completeness test; emoji grep clean; every screen re-screenshotted at 1366x900 (title, hero, relic, map, city + popups, battle, reward, merchant, event, defeat, pause/settings) and looked at: icons crisp (no blur), legible at their sizes, consistent palette; no console errors; list icons you judge weak so they can be redrawn.
