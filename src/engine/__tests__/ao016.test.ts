import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { cardPlayability, cardRequirement } from '../cardRequirements.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { createVerticalSliceScenario } from '../scenario.js';
import { computeValidTargets } from '../targeting.js';
import type { ArmyStack, CombatState } from '../types.js';

/** Hand-built battle: armies, hand and intents are ours. Dexterity 0 = no dodge rolls. */
function battle(playerArmy: ArmyStack[], enemyArmy: ArmyStack[], cardIds: string[] = [], mana = 10): CombatState {
  const { state } = createVerticalSliceScenario(1);
  return {
    ...state,
    hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 }, mana, maxMana: 10 },
    playerArmy,
    enemyArmy,
    hand: cardIds.map((cardId, i) => ({ instanceId: `t_${cardId}_${i}`, cardId })),
    enemyIntents: [],
  };
}

describe('AO-D038 stalemate-only lane guard', () => {
  it('an enemy right-lane melee unit never hits the last left-lane unit while another enemy unit can act', () => {
    const player = [createStack('swordsman', 'player', 1, 500)];
    const rightOrc = createStack('orc', 'enemy', 3, 5);
    const centerGoblin = createStack('goblin', 'enemy', 2, 5); // reaches the left lane
    const state = {
      ...battle(player, [rightOrc, centerGoblin]),
      enemyIntents: [rightOrc, centerGoblin].map((s) => ({ stackId: s.stackId, kind: 'attack' as const, targetStackId: player[0]!.stackId })),
    };
    const result = applyPlayerAction(state, { type: 'END_TURN' });
    const attackers = result.enemySteps!.map((s) => s.actorStackId);
    expect(attackers).toEqual([centerGoblin.stackId]);
  });

  it('a true stalemate still resolves: the battle ends instead of looping forever', () => {
    let state = battle([createStack('swordsman', 'player', 1, 60)], [createStack('orc', 'enemy', 3, 4)]);
    for (let turn = 0; turn < 20 && state.result === 'ongoing'; turn += 1) {
      const actor = state.playerArmy[0]!;
      const targets = computeValidTargets(actor, state.enemyArmy, UNIT_DEFINITIONS[actor.unitId], state.playerArmy);
      expect(targets.length).toBeGreaterThan(0); // fallback opens because nobody can reach anybody
      state = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: actor.stackId, targetStackId: targets[0]!.stackId }).state;
      if (state.result === 'ongoing') state = applyPlayerAction(state, { type: 'END_TURN' }).state;
    }
    expect(state.result).toBe('victory');
  });
});

describe('AO-D040 card requirements and playability', () => {
  it('derives condition text from card data', () => {
    expect(cardRequirement('charge')).toBe('Needs a living Knight and an enemy in reach');
    expect(cardRequirement('mass_charge')).toBe('Needs a living Knight');
    expect(cardRequirement('venomous_army')).toBe('Needs a living Archer');
    expect(cardRequirement('reposition')).toBe('Needs a free position');
    expect(cardRequirement('tactical_insight')).toBeNull();
    expect(cardRequirement('nope')).toBeNull();
  });

  it('every unit-sourced card mentions its source unit', () => {
    for (const card of Object.values(CARD_DEFINITIONS)) {
      if (card.source.type === 'unit') expect(cardRequirement(card.id)).toContain(UNIT_DEFINITIONS[card.source.unitId].name);
    }
  });

  it('Charge without a living Knight is unplayable and says why; the engine agrees', () => {
    const state = battle([createStack('swordsman', 'player', 1, 6)], [createStack('orc', 'enemy', 1, 5)], ['charge']);
    const p = cardPlayability('charge', state);
    expect(p).toEqual({ playable: false, reason: 'Charge is inactive — you have no living Knight stack.' });
    const result = applyPlayerAction(state, { type: 'PLAY_CARD', instanceId: state.hand[0]!.instanceId, actingStackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    expect(result.events.find((e) => e.type === 'ACTION_REJECTED')).toMatchObject({ reason: p.reason });
  });

  it('Charge with a Knight and a reachable enemy is playable', () => {
    const state = battle([createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 2, 2)], [createStack('orc', 'enemy', 1, 5)], ['charge']);
    expect(cardPlayability('charge', state)).toEqual({ playable: true, reason: null });
  });

  it('reports Mana, reach and movement failures', () => {
    const enemyRightOnly = [createStack('orc', 'enemy', 3, 5)];
    const lone = [createStack('knight', 'player', 1, 2)];
    expect(cardPlayability('charge', battle(lone, enemyRightOnly, ['charge'], 0)).reason).toBe('Not enough Mana.');
    const full = ([1, 2, 3, 4, 5, 6] as const).map((p) => createStack('swordsman', 'player', p, 3));
    expect(cardPlayability('reposition', battle(full, enemyRightOnly, ['reposition'])).reason).toBe('No free position.');
    const frozenMove = [{ ...createStack('swordsman', 'player', 1, 3), flags: { cannotMove: true } }];
    expect(cardPlayability('reposition', battle(frozenMove, enemyRightOnly, ['reposition'])).reason).toBe('No stack can move this turn.');
  });

  it('a card whose acting stacks all lack an enemy in reach is unplayable while the board is not in a stalemate', () => {
    // The untargetable center goblin can still hit the left knight, so the guard stays closed and the knight reaches nothing.
    const player = [createStack('knight', 'player', 1, 2)];
    const goblin = { ...createStack('goblin', 'enemy', 2, 5), flags: { untargetable: true } };
    const enemy = [createStack('orc', 'enemy', 3, 5), goblin];
    expect(cardPlayability('ambush', battle(player, enemy, ['ambush']))).toEqual({ playable: false, reason: 'No stack has an enemy in reach.' });
    const lone = battle(player, [createStack('orc', 'enemy', 3, 5)], ['ambush']);
    expect(cardPlayability('ambush', lone).playable).toBe(true); // true stalemate: fallback makes the orc reachable
  });
});
