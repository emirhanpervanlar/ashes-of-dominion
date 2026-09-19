# Backlog (owner requests not yet built)

Status: TODO / IN PROGRESS / BLOCKED (needs owner). Decisions live in docs/DECISIONS.md; every item gets a task file when it starts.

## Bugs
- [IN PROGRESS AO-016] Last left-lane unit can be hit by the enemy's far-right unit (AO-D038).
- [TODO, UI pass] Damage preview still shows on the HP bar; HP bars to be removed from battle (AO-D024).
- [TODO economy] No Elite Battle in the first 3 road steps (AO-D039).
- [TODO, UI pass] Enemy damage/effects on my units are only visible in the log (needs enemy step playback, AO-D023).

## Cards and decks
- [IN PROGRESS AO-014] Simple 10-card starting decks, 4 distinct cards.
- [IN PROGRESS AO-016 + UI] Conditional cards (Charge needs a Knight) must show a warning/tooltip; agent picks warning vs tooltip (AO-D040).
- [TODO UI] Card info popup (right-click) for deck cards, same convention as unit info popup.
- [TODO UI] Battle: draw pile viewer and discard pile viewer.
- [TODO UI] Outside battle: Deck viewer opened by a button in the Road/City bottom bar.
- [TODO UI] Hero popup on clicking the hero portrait: stats now; XP/level after the hero design discussion (AO-D030).

## Relics
- [TODO economy] 5 simple starting relics in a separate pool; rarity common/rare/epic; some relics with drawbacks; sources: elites, events (rare), merchants (priced by rarity) (AO-D037).
- [TODO later] Unlock new starting relics after runs based on achievements (needs persistent profile).

## Battle screen
- [TODO UI] Enemy turn step-by-step playback with real numbers (engine gives `enemySteps`).
- [TODO UI] Code-drawn effects: lunge, slash, projectile, block, buff/heal, freeze ice, chains, hit shake, death fade.
- [TODO UI] Remove HP bars, click empty space deselects, End Turn wide bar under the enemy area, acted units faded (AO-D024).
- [TODO UI] Unit and buff/debuff tooltips with real effect text (AO-D025).

## Meta screens and systems
- [TODO UI] Hero + starting relic on ONE screen (needs atomic START_RUN engine action). Must also: make hero stats readable on the hero select (they are not legible today) and block starting without a commander name (empty/whitespace name disables Start).
- [TODO UI] Defeat screen with full run statistics (engine already collects `run.stats`).
- [TODO UI] City redesign, Heroes 3 style, wide panel per building; Temple doctrines as big cards.
- [TODO UI] Drag-and-drop army repositioning, split places the new stack where the player chooses, merge closes the popup, dropping the same type merges (reverses AO-D017 drop rule).
- [TODO UI] Shared instant tooltip component everywhere (relics, reward mana cost, role badges, resources, buildings, piles).
- [IN PROGRESS AO-015] Visual design language (medieval pixel-art, HoMM3/Disciples), then style proof page, then all screens. Unit sprites drawn in code: phase 2, only if the owner likes the proof.

## Balance
- [TODO qa-playtest] elite_guard wipes starting armies in one passed turn; buff cards weigh less under the H3 model; Mage army vs guarded_shaman.

## Planned, far future (owner discussion first)
- Real objectives instead of plain battles (AO-D059): mine capture (+10 Gold/day passive), village raid (100 Gold + 20 Food now) vs help villagers (+10 Food/day passive), rescues; player decisions create passive income. Design conversation first.
- Hero XP / levels / stats and RPG structure (AO-D030); unit XP.
- Unlocks after death: cards, starting relics, new heroes (persistent profile).
- Elemental damage types (poison, fire, freeze, lightning) and immunities (AO-D031).
- `greater_heal` vs `heal` are identical in data (2 mana, same effect): decide.
