import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { cardPlayability } from '../cardRequirements.js';
import { applyPlayerAction } from '../combat.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { generateEnemyIntents } from '../intents.js';
import { HERO_ATTACKER_ID, heroSpellScaling } from '../heroSpells.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { ArmyStack, CombatEvent, CombatState, HeroId, Position, UnitId } from '../types.js';

function battle(playerArmy: ArmyStack[], enemyArmy: ArmyStack[], cardIds: string[] = [], heroId: HeroId = 'warlord'): CombatState {
  const { state } = createVerticalSliceScenario(1, heroId);
  const base: CombatState = {
    ...state,
    hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 }, mana: 10, maxMana: 10 },
    playerArmy,
    enemyArmy,
    hand: cardIds.map((cardId, i) => ({ instanceId: `t_${cardId}_${i}`, cardId })),
    deck: [],
    discard: [],
  };
  return { ...base, enemyIntents: generateEnemyIntents(base) };
}

const big = (unitId: UnitId, position: Position, count = 100): ArmyStack => createStack(unitId, 'player', position, count);
const foe = (unitId: UnitId, position: Position, count = 10): ArmyStack => createStack(unitId, 'enemy', position, count);
const attacksBy = (events: CombatEvent[], stackId: string) => events.filter((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId === stackId);
const rejection = (events: CombatEvent[]) => events.flatMap((e) => (e.type === 'ACTION_REJECTED' ? [e.reason] : []))[0];

describe('AO-D064 hero-cast cards', () => {
  const HERO_CAST = ['arcane_storm', 'arrow_rain', 'chain_lightning', 'command_strike', 'fireball', 'frost', 'volley'];
  const cast = (state: CombatState, cardId: string, targetStackId?: string) =>
    applyPlayerAction({ ...state, hand: [{ instanceId: 'c', cardId }] }, { type: 'PLAY_CARD', instanceId: 'c', targetStackId });
  const dmg = (events: CombatEvent[], targetId: string) => events.flatMap((e) => (e.type === 'STACK_ATTACKED' && e.targetStackId === targetId ? [e.finalDamage] : []))[0];

  it('exactly these cards are hero-cast, none needs a unit type', () => {
    const list = Object.values(CARD_DEFINITIONS).filter((c) => c.cast === 'hero');
    expect(list.map((c) => c.id).sort()).toEqual(HERO_CAST);
    for (const c of list) {
      expect(c.source.type).toBe('hero');
      expect(['enemy-stack', 'none']).toContain(c.targeting);
      expect(c.scalesWith).toBeDefined();
    }
  });

  it('Fireball needs no source unit, ignores friendly stacks and never damages the player army', () => {
    const player = [big('swordsman', 1, 30), big('knight', 2, 5)]; // no Archer, no Priest: the old card was inactive here
    const state = battle(player, [foe('goblin', 1, 12), foe('goblin', 2, 12)], [], 'mage');
    const r = cast(state, 'fireball', 'enemy_goblin_1');
    expect(rejection(r.events)).toBeUndefined();
    expect(r.state.playerArmy).toEqual(state.playerArmy);
    expect(r.events.filter((e) => e.type === 'STACK_ATTACKED').every((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId === HERO_ATTACKER_ID)).toBe(true);
    expect(r.state.enemyArmy[0]!.count).toBeLessThan(12);
  });

  it('damage does not depend on the size of any friendly stack', () => {
    const small = cast(battle([big('archer', 4, 4)], [foe('orc', 1, 10)], [], 'mage'), 'fireball', 'enemy_orc_1');
    const huge = cast(battle([big('archer', 4, 400)], [foe('orc', 1, 10)], [], 'mage'), 'fireball', 'enemy_orc_1');
    expect(dmg(small.events, 'enemy_orc_1')).toBe(dmg(huge.events, 'enemy_orc_1'));
  });

  it('scales with the hero stat: Intelligence 18 hits clearly harder than 8; Strength/Dexterity scale their own cards', () => {
    const at = (stats: Partial<CombatState['hero']['stats']>, cardId: string) => {
      const s = battle([big('swordsman', 1)], [foe('goblin', 1, 40)], []);
      return dmg(cast({ ...s, hero: { ...s.hero, stats: { ...s.hero.stats, ...stats } } }, cardId, 'enemy_goblin_1').events, 'enemy_goblin_1')!;
    };
    expect(heroSpellScaling(18)).toBeCloseTo(1.4);
    expect(heroSpellScaling(8)).toBeCloseTo(0.9);
    expect(heroSpellScaling(-40)).toBe(0.5);
    expect(at({ intelligence: 18 }, 'fireball')).toBeGreaterThan(at({ intelligence: 8 }, 'fireball') * 1.4);
    expect(at({ strength: 18 }, 'command_strike')).toBeGreaterThan(at({ strength: 8 }, 'command_strike'));
    expect(at({ intelligence: 18 }, 'command_strike')).toBe(at({ intelligence: 8 }, 'command_strike'));
    expect(at({ dexterity: 20 }, 'volley')).toBeGreaterThan(at({ dexterity: 10 }, 'volley'));
  });

  it('the target defense modifier still applies', () => {
    const s = battle([big('swordsman', 1)], [foe('goblin', 1, 40), foe('orc', 2, 40)], []);
    const goblin = dmg(cast(s, 'command_strike', 'enemy_goblin_1').events, 'enemy_goblin_1')!;
    const orc = dmg(cast(s, 'command_strike', 'enemy_orc_2').events, 'enemy_orc_2')!;
    expect(orc).toBeLessThan(goblin);
  });

  it('Fireball splashes only to the neighbours in the same row', () => {
    const enemy = [foe('goblin', 1, 40), foe('goblin', 2, 40), foe('goblin', 3, 40), foe('goblin', 5, 40)];
    const state = battle([big('swordsman', 1)], enemy, [], 'mage');
    const center = cast(state, 'fireball', 'enemy_goblin_2');
    expect(dmg(center.events, 'enemy_goblin_1')).toBeGreaterThan(0);
    expect(dmg(center.events, 'enemy_goblin_3')).toBeGreaterThan(0);
    expect(dmg(center.events, 'enemy_goblin_5')).toBeUndefined();
    expect(dmg(center.events, 'enemy_goblin_1')).toBeLessThan(dmg(center.events, 'enemy_goblin_2')!);
    const left = cast(state, 'fireball', 'enemy_goblin_1');
    expect(dmg(left.events, 'enemy_goblin_2')).toBeGreaterThan(0);
    expect(dmg(left.events, 'enemy_goblin_3')).toBeUndefined();
  });

  it('Frost casts on the chosen enemy and the frozen stack skips its turn', () => {
    const state = battle([big('swordsman', 1, 50)], [foe('goblin', 1, 10), foe('goblin', 2, 10)], [], 'mage');
    const r = cast(state, 'frost', 'enemy_goblin_1');
    expect(r.state.enemyArmy[0]!.statuses.some((s) => s.type === 'freeze')).toBe(true);
    expect(r.state.enemyIntents.map((i) => i.stackId)).toEqual(['enemy_goblin_2']);
    const turn = applyPlayerAction(r.state, { type: 'END_TURN' });
    expect(attacksBy(turn.events, 'enemy_goblin_1')).toHaveLength(0);
    expect(attacksBy(turn.events, 'enemy_goblin_2').length).toBeGreaterThan(0);
  });

  it('Arcane Storm and Arrow Rain need no target; Chain Lightning chains from the chosen enemy', () => {
    const enemy = [foe('goblin', 1, 20), foe('goblin', 2, 20), foe('goblin', 3, 20), foe('goblin', 4, 20)];
    const state = battle([big('swordsman', 1)], enemy, [], 'mage');
    const storm = cast(state, 'arcane_storm');
    expect(rejection(storm.events)).toBeUndefined();
    expect(storm.state.enemyArmy.every((s) => s.currentHp < s.maxHp)).toBe(true);
    const rain = cast(state, 'arrow_rain');
    expect(rain.state.enemyArmy.filter((s) => s.currentHp < s.maxHp)).toHaveLength(3);
    const chain = cast(state, 'chain_lightning', 'enemy_goblin_3');
    expect(dmg(chain.events, 'enemy_goblin_3')).toBeGreaterThan(dmg(chain.events, 'enemy_goblin_1')!);
    expect(chain.state.enemyArmy.filter((s) => s.currentHp < s.maxHp)).toHaveLength(3);
  });

  it('is rejected, spending nothing, when no enemy is left; cardPlayability agrees', () => {
    const state = battle([big('swordsman', 1), big('priest', 4, 10)], [foe('goblin', 1, 1)], [], 'mage'); // the healer keeps the AO-D067 window open
    const killed = cast(state, 'arcane_storm');
    expect(killed.state.enemiesCleared).toBe(true);
    const again = cast(killed.state, 'arcane_storm');
    expect(rejection(again.events)).toBe('No enemy to target.');
    expect(again.state.hero.mana).toBe(killed.state.hero.mana);
    expect(cardPlayability('arcane_storm', killed.state).playable).toBe(false);
    expect(cardPlayability('arcane_storm', state).playable).toBe(true);
  });
});
