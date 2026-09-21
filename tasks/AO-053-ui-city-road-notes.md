# AO-053 UI: city/road/deck notes from owner playtest round 3
Owner-intent: Gold/Food popups reachable everywhere, Barracks usability, garrison bar, building levels, card scaling info
Agent: ui-frontend
Priority: P1
Depends-on: main
Branch: ai/AO-053 (ui worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D084, D086, D087 (UI parts only: badges, level text, level-dependent visuals), D088.

## Must change
1. Road bottom resource strip: Gold shows the same +/- per-day value style as Food; clicking Gold opens a Gold popup (income: mines, sources; costs) built like the Food popup. City: the "per day +/- Gold Food" line under Active Effects opens the Gold / Food popups.
2. Barracks: shrink the recruit +/- stepper (it is oversized); move the tier upgrade (current tier, next tier cost, Upgrade button) to the TOP of the Barracks panel visible on both tabs, so the player never needs the Garrison tab to upgrade. Remove the tier ladder duplicate if redundant.
3. Bottom bar in the city: a permanent "Garrison" block of 4 slots between Hero and Army showing the waiting garrison units (sprite + count, cap from engine), click = collect (COLLECT_GARRISON, disabled reason as Tip); the Garrison tab inside the Barracks panel can then be removed or reduced to the tier-difference info the owner likes (keep the tier comparison, drop the collect UI duplication).
4. City buildings: remove the green check badge; every building shows its current level ("Lv 2"), "Max" at max level. Building art changes with level (at least Farm: patch -> fields; also Barracks, Mage Tower, Temple, Training Hall, Marketplace get 2-3 visual stages, pixel art in the design language).
5. Card views (deck viewer, hand, reward): remove the "Scales with X" badge from the tile; the card info popup shows "Scales with <Stat>", the hero's current stat value and the effect on this card (e.g. "Intelligence 18: +40% spell damage"; use heroSpellScaling / constants from the engine, no re-implemented math).
6. Update docs/SCREEN_SPEC.md, delete orphaned code.

## Not in scope (engine tasks): temple 7-day change, one event at a time, mines/farm fights, enemy ranged formations. The Temple UI hook comes after the engine adds the cooldown.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md, docs/DESIGN_LANGUAGE.md (icon lists).

## Forbidden
src/engine/** (report gaps).

## Acceptance criteria
tsc clean, vitest green. Browser (port 5215 only, never 5173/4173, state injected before load, real clicks, screenshots looked at, no console errors): Gold popup on Road and City, Barracks upgrade at top, garrison bar collect, building levels/Max and visuals at levels 1..max, card info popup scaling text, 1366x900 and 1280x720.
- 2026-09-21 ACCEPTED (767 tests). DDR: Temple/Training Hall/Marketplace have no engine levels (single stage, read Max); Director recommends A (keep) until the owner wants tiers.
