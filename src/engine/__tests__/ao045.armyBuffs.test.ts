import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { cardPlayability } from '../cardRequirements.js';
import { applyPlayerAction } from '../combat.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { statusAmount } from '../damage.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { ArmyStack, CombatEvent, CombatState, Position, UnitId } from '../types.js';

const big = (unitId: UnitId, position: Position, count = 20): ArmyStack => createStack(unitId, 'player', position, count);
const foe = (unitId: UnitId, position: Position, count = 10): ArmyStack => createStack(unitId, 'enemy', position, count);

function battle(playerArmy: ArmyStack[], enemyArmy: ArmyStack[]): CombatState {
  const { state } = createVerticalSliceScenario(1);
  return { ...state, hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 }, mana: 10, maxMana: 10 }, playerArmy, enemyArmy, hand: [], deck: [], discard: [], enemyIntents: [] };
}

const play = (state: CombatState, cardId: string, extra: { actingStackId?: string; targetStackId?: string } = {}) =>
  applyPlayerAction({ ...state, hand: [{ instanceId: 'c', cardId }] }, { type: 'PLAY_CARD', instanceId: 'c', ...extra });
const rejected = (events: CombatEvent[]) => events.some((e) => e.type === 'ACTION_REJECTED');
const hpDamage = (events: CombatEvent[]) => events.flatMap((e) => (e.type === 'STACK_ATTACKED' ? [e.finalDamage] : []));

describe('AO-D064 army-wide buff cards need no unit target', () => {
  const ARMY_WIDE = ['battle_hardened', 'focus_fire', 'formation', 'hold_the_line', 'rally'];

  it('their targeting is none; genuinely single-target buffs keep an ally stack', () => {
    for (const id of ARMY_WIDE) expect(CARD_DEFINITIONS[id]!.targeting, id).toBe('none');
    for (const id of ['bless', 'last_stand', 'blood_rage', 'brutal_command', 'arcane_shield', 'evasion']) expect(CARD_DEFINITIONS[id]!.targeting, id).toBe('ally-stack');
  });

  it('play with no ids at all, spend the Mana, and buff the whole army', () => {
    const state = battle([big('swordsman', 1), big('knight', 2), big('archer', 4)], [foe('orc', 1)]);
    const hardened = play(state, 'battle_hardened');
    expect(rejected(hardened.events)).toBe(false);
    expect(hardened.state.hero.mana).toBe(8);
    for (const s of hardened.state.playerArmy) {
      expect(statusAmount(s, 'armor'), s.stackId).toBeGreaterThan(0);
      expect(statusAmount(s, 'strength'), s.stackId).toBeGreaterThan(0);
    }
    const formation = play(state, 'formation');
    expect(formation.state.playerArmy.every((s) => statusAmount(s, 'armor') > 0)).toBe(true);
    const hold = play(state, 'hold_the_line');
    expect(hold.state.playerArmy.filter((s) => statusAmount(s, 'armor') > 0).map((s) => s.position)).toEqual([1, 2]);
    const wounded = battle([{ ...big('swordsman', 1), morale: 50 }, { ...big('knight', 2), morale: 60 }], [foe('orc', 1)]);
    expect(play(wounded, 'rally').state.playerArmy.map((s) => s.morale)).toEqual([80, 90]);
  });

  it('Focus Fire: the next friendly attack (any stack) deals +50%, once', () => {
    const state = battle([big('swordsman', 1, 30), big('knight', 2, 30)], [foe('orc', 1, 200)]);
    const plain = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    const focused = applyPlayerAction(play(state, 'focus_fire').state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    expect(hpDamage(focused.events)[0]!).toBeGreaterThan(hpDamage(plain.events)[0]! * 1.4);
    expect(focused.state.nextFriendlyAttackBonusPercent).toBe(0);
    const second = applyPlayerAction(focused.state, { type: 'BASIC_ACTION', stackId: 'player_knight_2', targetStackId: 'enemy_orc_1' });
    const knightPlain = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_knight_2', targetStackId: 'enemy_orc_1' });
    expect(hpDamage(second.events)[0]!).toBe(hpDamage(knightPlain.events)[0]!);
  });

  it('cardPlayability and PLAY_CARD agree for every no-target card', () => {
    const state = battle([big('swordsman', 1)], [foe('orc', 1)]);
    for (const card of Object.values(CARD_DEFINITIONS).filter((c) => c.targeting === 'none')) {
      const verdict = cardPlayability(card.id, state);
      const result = play(state, card.id);
      expect(rejected(result.events), card.id).toBe(!verdict.playable);
    }
  });
});
