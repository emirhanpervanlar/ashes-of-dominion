import { describe, expect, it } from 'vitest';
import { applyPlayerAction, createVerticalSliceScenario } from '../engine/index.js';
import type { CardInstance, CombatState } from '../engine/index.js';
import { cuesFromEvents } from './battleCues.js';
import { describeEvent } from './eventText.js';
import { floatersFromCues } from './FloatingText.js';

/** A Mage battle where the hand is just `cardId` and mana is plentiful. */
function cast(cardId: string, targetIndex = 0) {
  const start = createVerticalSliceScenario(3, 'mage', 'horde').state;
  const card: CardInstance = { instanceId: 'c1', cardId };
  const before: CombatState = { ...start, hand: [card], hero: { ...start.hero, mana: 9, maxMana: 9 } };
  const target = before.enemyArmy.filter((s) => s.count > 0)[targetIndex]!;
  const result = applyPlayerAction(before, { type: 'PLAY_CARD', instanceId: 'c1', targetStackId: target.stackId });
  expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
  return { before, after: result.state, events: result.events, target };
}

describe('hero-cast cards', () => {
  it('Fireball is one orb cue from the hero (no stack lookup) hitting the target and its neighbours; own units are untouched', () => {
    const { before, after, events, target } = cast('fireball', 1);
    const cues = cuesFromEvents(events, before, after, 'fireball');
    const attacks = cues.filter((c) => c.kind === 'attack');
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ attackerStackId: 'hero', style: 'orb' });
    if (attacks[0]!.kind === 'attack') {
      expect(attacks[0]!.hits[0]!.targetStackId).toBe(target.stackId);
      expect(attacks[0]!.hits.length).toBeGreaterThan(1);
    }
    expect(after.playerArmy.map((s) => s.count)).toEqual(before.playerArmy.map((s) => s.count));
  });

  it('the style follows the stat the card scales with: Dexterity bolts, Strength slashes', () => {
    const volley = cast('volley');
    expect(cuesFromEvents(volley.events, volley.before, volley.after, 'volley').find((c) => c.kind === 'attack')).toMatchObject({ style: 'bolt' });
    const strike = cast('command_strike');
    expect(cuesFromEvents(strike.events, strike.before, strike.after, 'command_strike').find((c) => c.kind === 'attack')).toMatchObject({ style: 'melee' });
  });

  it('floaters land on the target, and the log says who cast what', () => {
    const { before, after, events, target } = cast('fireball');
    const floaters = floatersFromCues(cuesFromEvents(events, before, after, 'fireball'));
    expect(floaters.some((f) => f.stackId === target.stackId)).toBe(true);
    expect(floaters.some((f) => f.stackId === 'hero')).toBe(false);
    const lines = events.map((e) => describeEvent(after, e)).filter(Boolean);
    expect(lines).toContain(`${before.hero.name} casts Fireball.`);
    expect(lines.some((l) => l!.startsWith(`${before.hero.name} hits `))).toBe(true);
    expect(lines.some((l) => l!.includes('unknown') || l!.includes('hero '))).toBe(false);
  });
});
