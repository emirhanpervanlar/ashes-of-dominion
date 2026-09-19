# AO-019 DL-1 Foundations of the new visual language
Owner-intent: "move the whole game to the medieval pixel-art language of the style proof"
Agent: ui-frontend
Priority: P0
Depends-on: AO-018 merged
Branch: ai/AO-019

## Source of truth
docs/DESIGN_LANGUAGE.md (section 10 DL-1, sections 1-5 and 6 component base), docs/style-proof/index.html (the visual reference: copy its real CSS, do not reinvent), docs/DECISIONS.md AO-D041, AO-D042.

## Must change
1. `index.html`: load the three fonts exactly as the style proof does.
2. `src/index.css`: introduce the design-language tokens (colour, type, spacing, screen tints via `data-screen`), map or replace the old `:root` tokens per section 10.1, add the shared base classes from the proof: `.panel` (stone/wood/parchment/iron/gold variants), `.plaque`, `.btn` (primary/secondary/danger + states), `.well`, `.row`, scrollbar, `.step` stepped-corner/bevel/shadow helpers.
3. Convert EVERY existing screen so it uses the new tokens, fonts, materials and shared classes: no border-radius anywhere (count of non-zero `border-radius` in CSS and inline styles must be 0), no gradients-for-decoration outside the material recipes, muted palette. Emoji and icon replacement is NOT part of this task (DL-2), layout is not redesigned (later tasks) - this pass re-skins what exists so nothing looks like the old mobile style and nothing breaks.
4. Per-screen tint via `data-screen` (title, road/map, city, battle, overlays/vault).
5. Delete every class/token the change orphans; no compat aliases left behind except where the design language 10.1 explicitly maps old to new for a later task (list them in the report).

## Allowed files
index.html, src/index.css, src/ui/**, src/App.tsx (class names/structure only, no logic changes).

## Forbidden
src/engine/**, game logic, layout redesigns, new features.

## Acceptance criteria
1. tsc clean, vitest green. 2. No horizontal scroll and no clipped text at 1366x900 on: title, hero select, starting relic, road map, city + a building popup, battle, reward, merchant, event, defeat, pause menu. 3. `border-radius` audit: zero non-zero occurrences in src (css, tsx inline). 4. Screenshots of every screen above (puppeteer-core, port other than 5173, inject `aod_run_state_v1`, Continue) looked at and compared with the style proof; list anything that still looks like the old style. 5. No console errors.

## Verification
puppeteer-core, 1366x900; also 1280 and 1600 for the bottom bar.

## Status
- 2026-09-19 ACCEPTED (tsc clean, 262 tests, border-radius count 0, screenshots reviewed). Leftovers belong to DL-2..DL-11.
