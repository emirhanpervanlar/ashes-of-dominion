/** Short player-facing effect text per card — v3 canonical doc §11-13. UI-only, not engine logic. */
export const CARD_DESCRIPTIONS: Record<string, string> = {
  // Unit Skill Cards
  shield_bash: 'Attack + apply Weak (-20% damage) to the target.',
  hold_formation: 'Self +30% Defense; adjacent allies +10% Defense. 1 turn.',
  counterattack: 'Next melee attack received this turn is countered for 70% damage.',
  brace: '+50% Defense, incoming damage -40%, cannot attack. 1 turn.',
  focus_shot: 'Next basic attack +60% damage.',
  piercing_arrow: 'Primary target 125% damage; the target behind it takes 50%.',
  arrow_rain: 'Hits up to 3 enemy stacks for 55% damage each.',
  covering_fire: 'Immediate 60% damage attack.',
  charge: 'Attack with +50% damage.',
  shield_wall: '+60% Defense self, +20% adjacent allies. Cannot move. 1 turn.',
  protect: "Redirects 40% of an ally's next damage taken to this Knight.",
  lance_breaker: '+100% damage; applies Weak; self -20% Defense. 1 turn.',
  greater_heal: 'Restores lost soldiers, capped at pre-battle max.',
  bless: 'Friendly stack +25% Damage, +15% Defense. 1 turn.',
  purify: 'Removes Poison/Bleed/Burn/Weak from a friendly stack.',
  divine_protection: 'Next lethal hit leaves the stack at 1 soldier instead. +20% Defense.',

  // Hero Cards — Warlord
  blood_rage: 'Next attack +40% damage; loses 5% of its own count after.',
  mass_charge: 'All Knight stacks +30% damage this turn.',
  hold_the_line: 'All frontline stacks +25% Defense this turn.',
  brutal_command: 'Next attack +100% damage; cannot be redirected.',
  rally: 'Restore morale; draw 1 card.',
  last_stand: 'Target gains +50% Damage, +30% Defense. 1 turn.',
  formation: 'Three adjacent friendly stacks +15% Defense.',
  execution_order: '+100% damage if the target is below 30% HP.',

  // Hero Cards — Rogue
  poison_arrow: 'Next Archer attack applies Poison.',
  double_shot: 'Attack twice: 100% then 60% damage.',
  evasion: 'Selected stack Dodge chance x1.25 this turn.',
  ambush: 'Attack with +25% damage.',
  mark_target: 'Marks the target — ranged damage taken +25% for 2 turns.',
  shadowstep: 'Move a friendly stack; draw 1 card.',
  venomous_army: 'All ranged stacks apply Poison on their next attack this turn.',
  execute: '+150% damage if the target is below 20% HP.',

  // Hero Cards — Mage
  fireball: 'High single-target magic damage with small splash.',
  frost: 'Magic damage (-20%) and applies Freeze.',
  arcane_storm: 'Hits all enemy stacks; the first takes bonus damage.',
  arcane_shield: 'Friendly stack incoming damage -35% this turn.',
  heal: 'Restores lost soldiers, capped at pre-battle max.',
  mana_surge: 'Gain +2 Mana this turn. Exhaust.',
  chain_lightning: 'Full damage to primary, 50% to up to 2 more enemies.',
  arcane_overload: 'Gain +3 Mana and draw a card. Unique.',

  // Neutral Cards
  focus_fire: 'Next friendly attack +50% damage.',
  reposition: 'Move a friendly stack; its next attack +15% damage.',
  tactical_insight: 'Draw 2 cards.',
  emergency_retreat: 'Selected stack cannot be targeted or attack this turn.',
  second_wind: 'Restore 10% of lost soldiers. Exhaust.',
  battle_hardened: '+20% Damage, +20% Defense. 1 turn.',
};
