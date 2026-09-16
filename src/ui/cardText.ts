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
  command_strike_plus: 'Selected friendly stack attacks (upgraded).',
  defend_plus: 'Selected stack gains +25 Block.',
  shield_wall_plus: 'Frontline gains +35 Block.',
  volley_plus: 'All friendly Archer stacks attack (upgraded).',
  commanders_presence: 'All army gains +1 Morale.',
  execute: '+50% damage against enemies below 30% HP.',
  focus_fire: 'Selected enemy becomes Vulnerable (+25% damage taken this turn).',
  veterans_resolve: 'Selected friendly stack attacks with +30% Attack.',
  guard_stance: 'Selected stack gains Taunt (2 turns) and +15 Block.',
  raise_dead: 'Sacrifice 20% of a friendly stack to summon Skeletons.',
};

export const CARD_COST_LABEL: Record<string, string> = {
  AC: 'AC',
  DC: 'DC',
  MANA: 'Mana',
};
