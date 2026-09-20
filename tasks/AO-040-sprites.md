# AO-040 Pixel unit and hero sprites (DL-10) + weak icon redraws
Owner-intent: "unit sprites in the quality of the style proof, replacing the small role icons everywhere; game feels alive"
Agent: ui-frontend
Priority: P1
Depends-on: AO-039 merged
Branch: ai/AO-040 (ui worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D041, D042; docs/DESIGN_LANGUAGE.md section 7.6 (sprite format and renderer), 7.7 (icons drawn) and the icon weaknesses listed in tasks/AO-020; docs/style-proof/index.html (the approved sprites: Swordsman, Archer, Knight, Goblin, Orc as 32x32 palette grids with the master palette extras `W j l u f F q Q O z Z x e I h a A`, 2-frame idle, hit flash, team palette swap: reuse the grids as they are); scratchpad generator files from the style proof (dsl/pal/sprites) are gone: work from the grids in the HTML. Current art wrapper: `src/ui/UnitArt.tsx` (single place that draws a unit picture), `src/ui/pixel/*`.

## Must change
1. Sprite system in `src/ui/pixel/`: `Sprite` type (palette-indexed string grid 32x32, optional second idle frame and a hit frame), renderer (canvas -> cached PNG data URL, integer scales, `image-rendering: pixelated`), team palette swap (player warm terracotta / enemy cold) by palette substitution rather than duplicate grids where possible, mirror support for the enemy side.
2. Draw sprites for EVERY unit id in the engine (`src/engine/data/units.ts`: swordsman, archer, knight, priest, goblin, orc, shaman, wolf; check for any other id used by encounters or bosses and cover it) reusing the five approved proof sprites unchanged, and drawing the missing ones (Priest, Shaman, Wolf, and any boss/other) to the same quality and style: clear silhouette, 32x32, max ~16 colours from the master palette. Also the three hero portraits (warlord, rogue, mage) as sprites for the hero plaque, hero popup and hero setup.
3. `UnitArt` renders sprites everywhere a unit picture appears: battle tiles (2-frame idle bob using steps timing, the hit/lunge effects from AO-029 keep working on the tile), army bar slots, unit popup, Barracks cards, reward/event unit offers, drag ghost, hero setup preview, end screen army. Enemy sprites are drawn facing the player (mirror) and cold-tinted; player sprites warm. Faded/frozen/chained overlays still work on top.
4. Redraw the weak icons listed by AO-020 (`ornament_dragon`, `hero_warlord`/`unit_swordsman` face reading as a skull, `card_buff`/`card_debuff`, `st_weak`, `st_taunt`, `node_road` is removed, `node_resource`, `rel_crown_of_champions`, `rel_shadow_ring`, `rel_glass_cannon_idol`, `rel_whetstone`, `role_tank` vs `shield`), keeping ids and the completeness tests green; add doctrine icons (military, arcane, necromantic, economic) for the Temple.
5. Tests: every unit id and hero id has a valid 32x32 sprite (grid dimensions, palette keys), sprite registry completeness test.
6. Update docs/DESIGN_LANGUAGE.md section 7.6/7.7 with the sprites actually drawn, docs/SCREEN_SPEC.md where unit art is described; delete the superseded per-unit 16x16 unit icons only if nothing uses them (keep role icons used for badges).

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/DESIGN_LANGUAGE.md, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/**.

## Acceptance criteria
tsc clean, vitest green. Browser (port 5208, never 5173/4173; inject state BEFORE load): battle with all unit types on screen (player and enemy), army bar with 6 different stacks, Barracks, unit popup, hero plaque/hero popup/hero setup, end screen; zoomed crops of each sprite at its display scale to confirm crisp pixels and readable silhouettes; idle animation frames captured; no console errors. Report which sprites you consider weakest.
