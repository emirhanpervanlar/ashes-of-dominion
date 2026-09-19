---
name: combat-review
description: Checklist for reviewing or playtesting combat/engine changes in Ashes of Dominion against the recorded rules. Use on any diff touching src/engine or any battle behavior report.
---
# combat-review

Verify each item with a test or a repro, not by reading alone.

**Targeting** (AO-D002): melee never lists a backline enemy, including when its lane's front slot is dead; ranged reaches all; Taunt overrides enemy targeting; enemy AI uses the same geometry; a dead planned target retargets only within legal targets; a melee stack with no target gets the "no target in reach" rejection.
**Health/heal** (AO-D004): `count = ceil(currentHp / hpPerUnit)`; block absorbs first; heal never exceeds `preBattleMaxCount x hpPerUnit`; one `hpPerUnit` of heal = one soldier; casualties persist to the run army after victory.
**Flags/lifecycles** (AO-D005): every flag has a defined end (turn start, first consumption, or uses counter). Nothing that says "1 turn" can persist. A stack that plays Brace acts again next turn. Protect redirects exactly one hit. Divine Protection triggers once.
**Turn loop**: Mana refills, block resets, `actedThisTurn` resets, statuses tick once per round, DoT ticks at the owner's turn start, dead actors never act, intents are regenerated each turn.
**Cards**: cost is Mana only; unit-sourced cards need a living source stack; targeting validation matches the card's `targeting`; effects are data (`CardEffect`), no per-card ID switches; "+N% Defense" is percent-of-base with a floor, not flat.
**Numbers sanity**: damage never negative or NaN; count never negative; dodge/morale/veterancy caps hold; no infinite loops in counterattack/redirect chains.
**Determinism**: same seed + same actions = same result; no `Math.random`, no `Date`.
**Tests**: each new rule has a test that fails without the change; no test loosened; SYSTEM_SPEC updated if a rule changed.

Output findings as BUG / BALANCE / DESIGN CONCERN with evidence.
