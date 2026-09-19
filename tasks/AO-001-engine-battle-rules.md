# AO-001 Battle engine rule fixes
Owner-intent: "front units must not hit back units; units get stuck unable to attack; heal/HP should work like Heroes 3"
Agent: gameplay-combat
Priority: P0
Depends-on: none
Branch: ai/AO-001

## Goal
Lock in the engine-side battle rule changes already in the working tree and close the remaining engine gaps.

## Must preserve
Lane geometry for ranged units, Guard passive redirect, Divine Protection, 76+ passing tests.

## Must change
- AO-D002 melee no-backline (already in `targeting.ts`; confirm enemy AI in `intents.ts` obeys it, and that a melee stack with zero legal targets is handled everywhere it can act — basic action rejection message must say no target is in reach, not "cannot attack").
- AO-D005 flag expiry (in `combat.ts`; add a test that Protect's redirect is consumed by the first redirected hit).
- AO-D004 verify heal cap + count math with a test matching the owner's example (50 units/500 HP -> 40/400, heal 10 => +1 unit, never above 50).

## Allowed files
src/engine/** and tests.

## Forbidden
src/ui/**, src/App.tsx, any card/unit data values.

## Acceptance criteria
1. Melee stack never lists a backline enemy as a valid target, even when the lane's front slot is dead.
2. A stack that plays Brace can act again on its next turn (test exists).
3. Protect redirects exactly one hit (test exists).
4. Heal test for the 50/500 example passes.
5. tsc clean, vitest green.

## Verification
`npx tsc --noEmit && npx vitest run`
