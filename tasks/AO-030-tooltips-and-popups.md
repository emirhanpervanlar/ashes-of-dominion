# AO-030 Shared tooltip + card info + deck/pile viewers + hero popup
Owner-intent: "instant tooltips everywhere; card info popup; see my deck, draw pile, discard pile; click the hero to see stats; conditional cards must explain themselves"
Agent: ui-frontend
Priority: P0
Depends-on: AO-029 merged
Branch: ai/AO-030

## Source of truth
docs/DECISIONS.md AO-D025, D040, D035/D052 (removal), D048 (food), D054; docs/DESIGN_LANGUAGE.md sections 6 (tooltip, modal, tabs, list rows), 9; docs/SYSTEM_SPEC.md (`cardRequirement(cardId)`, `cardPlayability(cardId, combat)`, status effect data, relic data with rarity/drawbacks, food helpers, hero stats).

## Must change
1. ONE shared instant tooltip component (`Tip`): no delay, viewport-aware placement (never off-screen), keyboard focus support, replaces every native `title=` attribute and bespoke tooltip. Content comes from data, not hand-written duplicates: buffs/debuffs (icon + name + what it does numerically, e.g. Weak: deals X% less damage), relics (name, rarity, description incl. drawback), resources (Gold, Food incl. daily net, Threat, Day/Boss), role badges on unit tiles in the bar and the unit popup, reward card mana cost gem ("Costs N Mana"), Deck/Discard piles, buildings (cost/effect), hero stats.
2. Card info popup: right-click any card (hand, reward, merchant, deck viewer) opens a popup like the unit info popup: art, cost, type, full text, upgraded state, and its condition/requirement (`cardRequirement`); in battle also the current playability reason.
3. Conditional cards (AO-D040): a card whose condition is not met is shown dimmed with the reason in a Tip and, when clicked, a toast/warning with the reason (`cardPlayability`); a small requirement line on cards where it fits, otherwise only the tooltip (you decide by looking at screenshots; prefer clean cards).
4. Battle: Deck (draw pile) and Discard buttons open a viewer modal listing the cards (sorted, grouped with counts, not in draw order; tabs for draw/discard if convenient); read-only, card info popup available from rows.
5. Outside battle: a Deck button in the Road/City bottom bar opens the full deck viewer (all owned cards, grouped, with counts and the upgraded marker); in City it also links to card removal.
6. Hero popup: clicking the hero portrait (Road/City bar and battle hero plaque) opens a modal with hero name, portrait, stats (Strength/Dexterity/Intelligence/Vitality/Wisdom with icons and what each does), Mana, relics list (each with a Tip), and a clearly marked empty "Level / XP" section that says "Coming soon" only if the engine has no XP yet (do not invent numbers).
7. Modal shell (`Modal`) used by all popups (unit, card, deck, hero, pause, settings) with the design-language plaque header, Esc to close, click outside to close, focus trap basics.
8. Delete replaced code; docs/SCREEN_SPEC.md sections for these popups.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md.

## Forbidden
src/engine/** (report gaps, e.g. missing status descriptions in data).

## Acceptance criteria
tsc clean, vitest green (tests for Tip content builders and the deck grouping/sorting helpers). Browser screenshots: tooltips on a relic, a debuff, a resource, a role badge, a reward card cost; card info popup; unplayable Charge with no Knight showing the reason; battle draw and discard viewers; Road deck viewer; hero popup. No native `title=` left (grep). No off-screen tooltip at the screen edges. No console errors.

## Status
- 2026-09-20 ACCEPTED (427 tests). Follow-ups: status effect data table in engine; Weak flat -Attack vs card text -%; relic drawbacks not structured; large card art window smaller than the spec; reward relic offer card lacks tooltip/frame.
