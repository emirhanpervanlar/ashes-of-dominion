# Design Bible — look, feel, UX

Rules for how the game presents itself. Screen-by-screen layout lives in `SCREEN_SPEC.md`.

## Constraints
- No art assets in the repo. Everything is CSS gradients, borders, box-shadows, `clip-path` and emoji. Structure and hierarchy carry the design; do not fake illustration.
- English UI copy. Short, concrete, no jokes, no exclamation spam. Numbers over adjectives.
- Desktop first (design at 1366x900); nothing may overflow or clip at that size.

## Visual language (three families — keep them consistent within a family)
| Family | Screens | Palette / motif |
|---|---|---|
| **Battle** | Battle | Dark brown wood-and-iron frame (`#362c20 -> #110d08`), bronze trim (`#6b5a3a`, `#4a3c26`), green-black scene panel, blue (player) / red (enemy) portrait borders, carved-dragon corners |
| **Meta / hub** | Road, City | Warm red-and-gold: panels `#3a2318 -> #180f09`, borders `#8a3a2a` / `#8a5a3a`, one shared 200px bottom bar |
| **Choice overlays** | Reward, Merchant, Event | Full-screen dark radial (`#241f18 -> #0f0d0a`), gold plaque banner, large cards, Slay-the-Spire pacing |

Global tokens live in `:root` of `src/index.css` (`--accent` gold `#e0b34c`, `--hp`, `--player`, `--enemy`). Reuse before inventing: `.garrison-bar`, `.garrison-slot`, `.reward-card`, `.portrait-*`, `.round-btn`, `.event-*`.

## Information hierarchy
- Battle (highest first): 1 unit count, 2 position/lane, 3 target legality, 4 buff/debuff, 5 card text. Raw HP is not a battle readout (count is health). Anything that predicts enemy behavior is intentionally absent (AO-D003).
- Meta screens: resources and army first, then choices. Never bury the army.

## Interaction principles
- Every clickable thing has hover/selected states. Anything not interactive right now has **none** and shows why (lock icon, dimming) instead of a text warning.
- One click = one meaning. Re-clicking a selected unit deselects it. `Esc` cancels.
- Feedback answers "what did my action do?": floating numbers on the affected stack (damage, block, heal) and a status icon appearing on the portrait.
- Irreversible choices (recruit, build, buy) are single-click with the cost visible before the click.
- Right-click on a unit opens an info popup. It never triggers a game action.

## Motion
Short and purposeful: 0.15s hover, 0.3–0.45s card draw/discard/play, about 0.7s per enemy playback step. Nothing loops except a pending-action pulse. A played card travels to the centre of the scene and stays visible until resolved; it never vanishes behind chrome.

## Do / Don't
- Do delete CSS your change orphans. Don't keep two systems for one job.
- Do extract components when adding battle UI; keep `App.tsx` markup thin.
- Don't add text badges for state an icon plus a number can carry.
- Don't show hero HP on hub screens (AO-D009) or raw stack HP in battle (AO-D004).
- Don't use per-screen one-off colors outside the three families.
