# AO-028 Battle screen pass (HP bars, states, End Turn, deselect) + bar polish
Owner-intent: "no HP bars, click empty to deselect, End Turn as a wide bar under the enemy area, acted units faded, frozen = ice, cannot-move = chains, blocked back-row melee shown, everything in the new pixel language"
Agent: ui-frontend
Priority: P0
Depends-on: AO-027 merged
Branch: ai/AO-028 (created in the ui worktree)

## Source of truth
docs/DECISIONS.md AO-D003, D004, D011, D024, D033, D040; docs/DESIGN_LANGUAGE.md sections 6 (unit tile, states), 8 (effects vocabulary), 9 (battle screen row); docs/style-proof/index.html (battle mock is the visual reference); docs/SYSTEM_SPEC.md (combat helpers: cardRequirement/cardPlayability, isBlockedByFrontAlly, cannotAct logic in stackStatus.ts).

## Must change
1. Unit tile: remove the HP strip and block strip entirely (also the damage-preview on the HP bar). Block and statuses show as icons with amounts (existing status icon+amount convention). Count stays. States: acted this turn = faded (no lock); frozen = ice overlay; cannot act because of an effect (cannotMove/cannotAttack flags) = chain overlay; back-row melee blocked by a friendly in front (AO-D033) = a distinct subtle marker (a small "blocked" icon) and not selectable; selectable/selected/targetable states per the design language. Remove the lock icon.
2. Clicking empty battlefield space deselects the selected stack and cancels a pending card (Esc keeps working).
3. End Turn: wide button spanning the bottom of the enemy half of the battlefield (see the style proof), removed from the bottom-right stack of buttons; Space also ends the turn when no popup/pending card is active (ignore while typing or a modal is open).
4. Empty centre: no narration text (AO-D023); leave the centre clean for the effects layer of the next task but keep the played-card-in-centre behaviour of AO-D011.
5. Frame polish: battle frame ornaments use pixel icons (already), the hero plaque and turn plaque per the design language; the hand tray, deck/discard piles per the style proof.
6. Bar polish (Road/City bottom bar): resource pills must not clip at 1280/1366/1600 widths ("DAY 1", "BOSS IN 29 DAYS" clip today); re-measure and fix with getBoundingClientRect, no horizontal scroll.
7. Delete every class/prop this orphans; docs/SCREEN_SPEC.md battle section updated.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/**, game rules, effect animations (next task).

## Acceptance criteria
tsc clean, vitest green. Browser (puppeteer-core, port other than 5173, inject state BEFORE load): a real battle played from the start (play cards, attack, end turn) with screenshots at 1366x900 showing: no HP bars anywhere, acted units faded, a frozen and a chained stack (inject states or use a card that causes them), a blocked back-row melee marker, End Turn bar, deselect by clicking empty space, Space to end turn. Bar measurements at 1280/1366/1600 reported. No console errors.
