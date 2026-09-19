# Decisions Log

Append-only. Newest last. Format: `AO-D<nn> | date | decision | why`.

- AO-D001 | 2026-09 | Combat is Mana-only; AP/DP and Energy are excluded from MVP. | v3 canonical.
- AO-D002 | 2026-09 | Melee units may only target enemy FRONT row in their lane geometry. No fallback to the backline when a front slot is empty. Only ranged (`rangedAllAccess`) units reach the backline. | Owner: front units must not hit back units.
- AO-D003 | 2026-09 | Enemy intent / "who attacks whom" previews are removed (text, bubble, threatened pulse, hover highlight, hover damage preview). The end-of-turn playback may still glow the acting stack and shake the hit stack. | Owner: looked bad.
- AO-D004 | 2026-09 | Stack health is total HP = count x hpPerUnit; losing HP reduces count (Heroes 3 model). Heals restore HP, each `hpPerUnit` of heal = 1 unit, capped at the stack's pre-battle count (`preBattleMaxCount`). Battle UI does NOT display raw HP numbers. | Owner.
- AO-D005 | 2026-09 | "1 turn" self-lockdown flags (`cannotAttack`, `cannotMove`, `incomingDamageReductionPercent`) expire at the start of the owner's next turn. Protect's redirect is consumed by the next hit it redirects. | Bug: flags previously stuck forever.
- AO-D006 | 2026-09 | Post-battle rewards: no relics; at most 3 choices total (new cards + upgrades combined), Slay-the-Spire style screen. | Owner.
- AO-D007 | 2026-09 | Starting armies are small: Warlord Swordsman6+Knight2, Rogue Archer6+Knight2, Mage Archer4+Priest4. | Owner: too easy.
- AO-D008 | 2026-09 | City garrison mechanic removed; recruits join the field army directly (max 6 stacks). | Owner.
- AO-D009 | 2026-09 | Hero HP is not shown on the Road/City bars (mechanic considered meaningless). Engine field kept. | Owner.
- AO-D010 | 2026-09 | Road and City share one bottom bar (200px): resources | hero plaque+portrait+3x5 relic grid | 6 unit slots (empty = dashed "Empty") | Log + Menu fixed-size buttons. Road unit slot width 130px. | Owner.
- AO-D011 | 2026-09 | Battle UI: no pos badge, no HP numbers, buffs/debuffs as icon plus amount on the portrait, right-click opens unit info, floating combat text for the players own actions, stacks that cannot act show a lock icon and no hover, cannot-attack warning text removed, played cards travel to scene centre and stay visible. Road path cards 250x300. | Owner (planned, tasks AO-002/AO-003).
- AO-D012 | 2026-09 | Working model: owner decides; Claude Director turns intent into tasks and dispatches specialists (gameplay-combat, gameplay-economy, ui-ux, ui-frontend, qa-automated, qa-playtest, reviewer). Agents never change design; they raise a DDR. No GitHub Actions (API-key billing); everything runs locally in-session. | Owner.
