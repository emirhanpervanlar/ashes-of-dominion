/** Short player-facing effect text per card — AGENT.md §15. UI-only, not engine logic. */
export const CARD_DESCRIPTIONS: Record<string, string> = {
  command_strike: 'Selected friendly stack attacks.',
  charge: 'Friendly Cavalry stack attacks with +50% Attack.',
  volley: 'All friendly Archer stacks attack.',
  defend: 'Selected stack gains +15 Block.',
  shield_wall: 'Frontline gains +25 Block.',
  reposition: 'Move one friendly stack to an empty slot.',
  rally: 'Target stack gains +2 Morale.',
  arcane_focus: 'Gain 2 Mana.',
  battle_meditation: 'Gain 1 Mana and draw 1 card.',
  tactical_insight: 'Draw 2 cards. Exhaust.',
};

export const CARD_COST_LABEL: Record<string, string> = {
  AC: 'AC',
  DC: 'DC',
  MANA: 'Mana',
};
