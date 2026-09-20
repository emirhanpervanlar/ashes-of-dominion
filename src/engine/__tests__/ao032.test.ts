import { describe, expect, it } from 'vitest';
import { cardPlayability, cardRequirement } from '../cardRequirements.js';
import { CARD_UPGRADES, isUpgradable, resolveCard } from '../cardUpgrades.js';
import { applyPlayerAction } from '../combat.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CardEffect, CombatState } from '../types.js';

/** Every number inside an effect list, keyed by its path (kind-tagged so a swapped effect never lines up). */
function leaves(effects: CardEffect[]): Map<string, number | string | boolean> {
  const out = new Map<string, number | string | boolean>();
  const walk = (value: unknown, path: string) => {
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    } else if (value !== undefined) {
      out.set(path, value as number | string | boolean);
    }
  };
  effects.forEach((e, i) => walk(e, `${i}`));
  return out;
}

function withHand(state: CombatState, cardId: string, upgraded: boolean): CombatState {
  return { ...state, hand: [{ instanceId: `t_${cardId}`, cardId, upgraded }] };
}

describe('AO-032: every card has a "+" version by the rules', () => {
  const ids = Object.keys(CARD_DEFINITIONS);

  it('covers exactly the card pool', () => {
    expect(Object.keys(CARD_UPGRADES).sort()).toEqual([...ids].sort());
  });

  it.each(ids)('%s: strictly better, same card, nothing lost', (id) => {
    const base = CARD_DEFINITIONS[id]!;
    const plus = resolveCard(id, true)!;
    const up = CARD_UPGRADES[id]!;
    expect(up.description.length).toBeGreaterThan(0);
    expect(plus.name).toBe(`${base.name} +`);
    expect(plus.source).toEqual(base.source);
    expect(plus.targeting).toBe(base.targeting);
    expect(plus.tags).toEqual(base.tags);
    expect(plus.exhaust).toBe(base.exhaust);
    expect(plus.rarity).toBe(base.rarity);

    let improved = false;
    if (up.manaCost !== undefined) {
      // Rule (a): only on a 2+ Mana card, by exactly 1.
      expect(base.manaCost).toBeGreaterThanOrEqual(2);
      expect(up.manaCost).toBe(base.manaCost - 1);
      expect(up.effects).toBeUndefined();
      improved = true;
    }
    if (up.effects) {
      const before = leaves(base.effects);
      const after = leaves(up.effects);
      // Rule (c): at most one appended effect, and only a draw.
      expect(up.effects.length).toBeGreaterThanOrEqual(base.effects.length);
      expect(up.effects.length).toBeLessThanOrEqual(base.effects.length + 1);
      for (const e of up.effects.slice(base.effects.length)) {
        expect(e.kind).toBe('DRAW');
        improved = true;
      }
      for (const [path, was] of before) {
        expect(after.has(path)).toBe(true);
        const now = after.get(path)!;
        if (typeof was !== 'number') {
          expect(now).toBe(was); // kinds, statuses, tags, boolean flags never change
          continue;
        }
        const isDraw = path.endsWith('.amount') && up.effects[Number(path.split('.')[0])]?.kind === 'DRAW';
        const isCondition = /Below|duration|maxTargets|maxSecondaryTargets|Uses|Casualty|accuracy|Accuracy/i.test(path);
        if (isCondition || (now as number) === was) {
          expect(now).toBe(was); // conditions, durations and drawbacks stay
          continue;
        }
        improved = true;
        if (isDraw) continue; // rule (c): draw +1
        expect(now as number).toBeGreaterThan(was);
        // Rule (b): +25..40% (a negative stat, if it ever shows up, is never touched by this).
        expect((now as number) / was).toBeGreaterThanOrEqual(1.249);
        expect((now as number) / was).toBeLessThanOrEqual(1.401);
      }
      // A value that exists only in the upgrade must be part of an appended effect.
      for (const path of after.keys()) {
        if (!before.has(path)) expect(Number(path.split('.')[0])).toBeGreaterThanOrEqual(base.effects.length);
      }
    }
    expect(improved).toBe(true);
    expect(up.manaCost === undefined && !up.effects).toBe(false);
  });

  it('tag-scoped effects keep their tag, so play requirements are unchanged', () => {
    const tagOf = (e: CardEffect) => ('tag' in e ? e.tag : null);
    for (const id of ids) {
      const base = CARD_DEFINITIONS[id]!.effects;
      expect(resolveCard(id, true)!.effects.slice(0, base.length).map(tagOf)).toEqual(base.map(tagOf));
    }
  });
});

describe('AO-032: resolveCard / isUpgradable', () => {
  it('returns the untouched base card unless the instance is upgraded', () => {
    expect(resolveCard('charge')).toBe(CARD_DEFINITIONS.charge);
    expect(resolveCard('charge', false)).toBe(CARD_DEFINITIONS.charge);
    expect(resolveCard('charge', true)!.name).toBe('Charge +');
    expect(CARD_DEFINITIONS.charge!.name).toBe('Charge');
    expect(resolveCard('nope', true)).toBeUndefined();
  });

  it('a card upgrades once', () => {
    expect(isUpgradable({ instanceId: 'a', cardId: 'charge' })).toBe(true);
    expect(isUpgradable({ instanceId: 'a', cardId: 'charge', upgraded: true })).toBe(false);
    expect(isUpgradable({ instanceId: 'a', cardId: 'nope' })).toBe(false);
  });
});

describe('AO-032: combat reads the upgrade', () => {
  const play = (state: CombatState, cardId: string, upgraded: boolean) => {
    const s = withHand(state, cardId, upgraded);
    return applyPlayerAction(s, { type: 'PLAY_CARD', instanceId: s.hand[0]!.instanceId, actingStackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
  };

  it('Charge + hits harder than Charge on the same seed', () => {
    const { state } = createVerticalSliceScenario(9);
    const hit = (r: ReturnType<typeof play>) => r.events.find((e) => e.type === 'STACK_ATTACKED');
    const base = hit(play(state, 'charge', false));
    const plus = hit(play(state, 'charge', true));
    expect(base?.type === 'STACK_ATTACKED' && plus?.type === 'STACK_ATTACKED').toBe(true);
    if (base?.type === 'STACK_ATTACKED' && plus?.type === 'STACK_ATTACKED') {
      expect(plus.rawDamage).toBeGreaterThan(base.rawDamage);
    }
  });

  it('a discounted "+" card spends its lower cost, and is playable when the base card is not', () => {
    const { state } = createVerticalSliceScenario(9);
    const low: CombatState = { ...state, hero: { ...state.hero, mana: 1 } };
    // Brace costs 2; Brace + costs 1.
    expect(cardPlayability('brace', low)).toMatchObject({ playable: false, reason: 'Not enough Mana.' });
    expect(cardPlayability('brace', low, true).playable).toBe(true);

    const act = (upgraded: boolean) => {
      const s = withHand(low, 'brace', upgraded);
      return applyPlayerAction(s, { type: 'PLAY_CARD', instanceId: s.hand[0]!.instanceId, actingStackId: 'player_swordsman_1' });
    };
    expect(act(false).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    const ok = act(true);
    expect(ok.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(ok.state.hero.mana).toBe(0);
    // The played instance keeps its upgrade in the discard pile.
    expect(ok.state.discard.find((c) => c.instanceId === 't_brace')?.upgraded).toBe(true);
  });

  it('an upgraded card keeps its play conditions (source unit, targets)', () => {
    const { state } = createVerticalSliceScenario(9);
    const noSwordsman: CombatState = { ...state, playerArmy: state.playerArmy.map((s) => (s.unitId === 'swordsman' ? { ...s, count: 0, currentHp: 0 } : s)) };
    expect(cardPlayability('brace', noSwordsman, true).playable).toBe(false);
    expect(cardRequirement('brace')).toBe('Needs a living Swordsman');
  });
});
