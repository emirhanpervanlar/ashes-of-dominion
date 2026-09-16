/** Base cardId -> upgraded cardId. Not every card is upgradable in the Phase 3 MVP. */
export const CARD_UPGRADES: Record<string, string> = {
  command_strike: 'command_strike_plus',
  defend: 'defend_plus',
  shield_wall: 'shield_wall_plus',
  volley: 'volley_plus',
};
