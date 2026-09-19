# AO-002 Battle screen clarity pass
Owner-intent: "I don't understand what my actions do; statuses are messy; too much noise"
Agent: ui-frontend
Priority: P0
Depends-on: AO-001 merged
Branch: ai/AO-002

## Goal
Make every player action legible on the battlefield and remove noise.

## Must preserve
Engine behavior, selection/targeting flow (incl. re-click deselect), draw/discard animations, AO-D003.

## Must change
1. Remove the "pos N" badge from every battle portrait.
2. Do not render HP numbers in battle (AO-D004). The count (xN) is the health readout.
3. Buffs/debuffs: remove the text badges under the name; show small icons ON the portrait image with their amount next to each icon.
4. Right-click on any battle stack opens an info popup (reuse UnitPopup without split/merge; add active statuses, morale, veterancy, block if easy).
5. Floating combat text for the PLAYER's own actions, derived from new `combat.log` events after each dispatch: damage dealt (-N), blocked (Blocked N), heal (+N units/HP as designed), status applied. Text rises and fades over the affected portrait.
6. A stack that cannot act this turn (acted, frozen, cannotAttack) shows a lock/block icon and loses its hover/selectable styling. Remove the "cannot attack this turn" warning/toast text.
7. Played cards must animate toward screen centre and stay visible (z-index bug: currently fly up and vanish behind the bottom bar).

## Allowed files
src/ui/StackTile.tsx, src/ui/UnitPopup.tsx, src/App.tsx (battle section + new small components), src/index.css.

## Forbidden
src/engine/**. If a needed value is missing from engine events, raise a DDR.

## Acceptance criteria
1..7 each visible in a browser screenshot; no leftover CSS for removed elements; tsc + vitest green.

## Verification
puppeteer run: enter battle, attack, play a defense card, play a no-target card, right-click a stack; attach screenshots.

## Status
- 2026-09-19 ACCEPTED after REVISION-1 (killing-blow floaters). Reviewer + Director verified screenshots; tsc clean, 82/82.
