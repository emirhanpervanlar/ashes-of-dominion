# AO-003 Road / City polish
Owner-intent: "road cards too small, hero name hidden, city Leave doesn't fit"
Agent: ui-frontend
Priority: P1
Depends-on: AO-002 (both edit index.css — sequential)
Branch: ai/AO-003

## Must change
1. Road path-choice cards: 250w x 300h, icon/badge scaled to match.
2. Road bottom bar: hero name plaque is currently hidden behind the portrait — fix stacking/layout.
3. Road unit slots: width 130px (AO-D010). City shares the same class, keep them identical.
4. City: replace the fixed Leave ribbon with a Leave button placed under the resources column inside the bar.

## Allowed files
src/ui/WorldMapScreen.tsx, src/ui/CityScreen.tsx, src/index.css.

## Acceptance criteria
Screenshots of Road and City at 1366x900 showing each item; measured widths reported; tsc + vitest green.

## Status
- 2026-09-19 ACCEPTED (Director verified screenshots + measurements: card 250x300, slot 130, bar 200, plaque visible). tsc clean, 82/82.
