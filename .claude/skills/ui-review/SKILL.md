---
name: ui-review
description: Checklist and browser procedure for reviewing Ashes of Dominion screens against SCREEN_SPEC and the Design Bible. Use on any UI diff or when the owner says a screen feels off.
---
# ui-review

**Procedure.** Start `npm run dev -- --port <not 5173>`. Drive with puppeteer-core (Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`), viewport 1366x900. Jump to a screen by injecting a saved run into localStorage `aod_run_state_v1` and clicking Continue on the title. Screenshot each state and actually look at it. Kill the dev server.

**Per-screen checks**
- Layout matches `docs/SCREEN_SPEC.md` (measure with `getBoundingClientRect`: bar heights, slot widths, card sizes).
- Nothing overflows, clips, overlaps or hides behind other chrome (fixed buttons, ribbons, the bottom bar). Text never sits under an image.
- Visual family is consistent (battle / meta / overlay) and reuses shared classes; no one-off colors.
- Hierarchy follows the Design Bible (battle: count > position > legality > buffs > card text).
- States: default, hover, selected, disabled, empty, dimmed all distinct; non-interactive things show no hover; empty slots are dashed and labeled.
- Feedback: each action produces visible feedback on the affected element; nothing important is conveyed only by a toast.
- Removed things stay removed (AO-D003 intent UI, AO-D004 raw HP in battle, AO-D008 garrison, AO-D009 hub hero HP, floating corner menu button on Road/Battle/City).
- Interaction: click, re-click deselect, Esc cancel, right-click info; no console errors (`pageerror`, `console.error`).
- Cleanliness: grep that removed classes/props have no leftovers; no duplicate styling systems.

Output numbered findings with severity, screenshot path and a concrete fix.
