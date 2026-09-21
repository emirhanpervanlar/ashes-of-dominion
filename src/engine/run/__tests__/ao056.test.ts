import { describe, expect, it } from 'vitest';
import { CARD_UPGRADES } from '../../cardUpgrades.js';
import { SHAMAN_BUFF_STRENGTH } from '../../intents.js';
import { createRng } from '../../rng.js';
import { DOCTRINE_CHANGE_INTERVAL_DAYS, nextDoctrineChangeDay } from '../city.js';
import { CURRENT_SAVE_VERSION, applyRunAction, createRun, migrateRun } from '../runEngine.js';
import { validateSave } from '../save.js';
import { runSummary } from '../summary.js';
import type { RunAction, RunState } from '../types.js';
import { generateWorldMap } from '../worldMap.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);
const reason = (events: { type: string }[]) => (events.find((e) => e.type === 'ACTION_REJECTED') as { reason: string } | undefined)?.reason;
const atCity = (day = 1): RunState => act({ ...createRun(3), day }, { type: 'TRAVEL_TO_CITY' }).run;

describe('AO-056 (AO-D085): at most one event per road step', () => {
  it('no layer of any chapter holds two events, and events still appear', () => {
    let events = 0;
    for (let seed = 1; seed <= 120; seed++) {
      for (const chapter of [1, 2, 3]) {
        const map = generateWorldMap(createRng(seed), chapter, (chapter - 1) * 30 + 1);
        const perLayer = new Map<number, number>();
        for (const n of map.nodes) if (n.type === 'event') perLayer.set(n.layer, (perLayer.get(n.layer) ?? 0) + 1);
        events += perLayer.size;
        for (const count of perLayer.values()) expect(count).toBe(1);
      }
    }
    expect(events).toBeGreaterThan(100);
  });
});

describe('AO-056 (AO-D087): the Temple doctrine changes once every 7 days', () => {
  it('the first choice is free and records the day; the next change date is exposed', () => {
    const city = atCity(4);
    expect(nextDoctrineChangeDay(city.city)).toBeNull();
    const chosen = act(city, { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' }).run;
    expect(chosen.city.doctrine).toBe('military');
    expect(chosen.city.doctrineChosenDay).toBe(4);
    expect(nextDoctrineChangeDay(chosen.city)).toBe(4 + DOCTRINE_CHANGE_INTERVAL_DAYS);
  });

  it('a change before the cooldown ends is rejected with the day it opens, and changes nothing', () => {
    const chosen = act(atCity(4), { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' }).run;
    const early = act({ ...chosen, day: 10 }, { type: 'CHOOSE_DOCTRINE', doctrineId: 'arcane' });
    expect(reason(early.events)).toBe('The Doctrine can be changed again on day 11.');
    expect(early.run.city.doctrine).toBe('military');
  });

  it('on the day the cooldown ends the doctrine can be swapped and the cooldown restarts', () => {
    const chosen = act(atCity(4), { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' }).run;
    const changed = act({ ...chosen, day: 11 }, { type: 'CHOOSE_DOCTRINE', doctrineId: 'arcane' });
    expect(changed.events).toContainEqual({ type: 'DOCTRINE_CHOSEN', doctrineId: 'arcane' });
    expect(changed.run.city.doctrine).toBe('arcane');
    expect(nextDoctrineChangeDay(changed.run.city)).toBe(18);
  });

  it('choosing the active doctrine again is rejected and does not restart the cooldown', () => {
    const chosen = act(atCity(4), { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' }).run;
    const same = act({ ...chosen, day: 30 }, { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' });
    expect(reason(same.events)).toBe('That Doctrine is already active.');
    expect(same.run.city.doctrineChosenDay).toBe(4);
  });

  it('save version 5: an older save with a doctrine gets no cooldown, and the field is validated', () => {
    expect(CURRENT_SAVE_VERSION).toBe(5);
    const old = { ...createRun(6), saveVersion: 4, city: { ...createRun(6).city, doctrine: 'economic' } } as unknown as Record<string, unknown>;
    delete (old.city as Record<string, unknown>).doctrineChosenDay;
    const migrated = migrateRun(old as unknown as RunState);
    expect(migrated.saveVersion).toBe(5);
    expect(migrated.city.doctrineChosenDay).toBeNull();
    expect(nextDoctrineChangeDay(migrated.city)).toBeNull();
    expect(act({ ...migrated, phase: 'city' }, { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' }).run.city.doctrine).toBe('military');
    expect(validateSave(JSON.parse(JSON.stringify(migrated)))).not.toBeNull();
    expect(validateSave(JSON.parse(JSON.stringify({ ...migrated, city: { ...migrated.city, doctrineChosenDay: 'x' } })))).toBeNull();
  });
});

describe('AO-056: summary row, shaman export, "+" descriptions', () => {
  it('runSummary has a minesCaptured row right after fortsTaken', () => {
    const run = createRun(2);
    const rows = runSummary({ ...run, stats: { ...run.stats, minesCaptured: 3 } }).rows;
    const at = rows.findIndex((r) => r.id === 'fortsTaken');
    expect(rows[at + 1]).toMatchObject({ id: 'minesCaptured', label: 'Mines captured', value: 3 });
  });

  it('SHAMAN_BUFF_STRENGTH is exported', () => {
    expect(SHAMAN_BUFF_STRENGTH).toBe(4);
  });

  it('Fireball+ and Formation+ descriptions state the upgraded numbers', () => {
    const splash = CARD_UPGRADES.fireball!.effects!.find((e) => e.kind === 'ATTACK_SPLASH')!;
    if (splash.kind !== 'ATTACK_SPLASH') throw new Error('no splash');
    expect(CARD_UPGRADES.fireball!.description).toContain(`${Math.round(splash.primaryMultiplier * 100)}%`);
    expect(CARD_UPGRADES.fireball!.description).toContain(`${Math.round(splash.secondaryMultiplier * 100)}%`);
    const buff = CARD_UPGRADES.formation!.effects!.find((e) => e.kind === 'DEFENSE_BUFF_ALL')!;
    if (buff.kind !== 'DEFENSE_BUFF_ALL') throw new Error('no buff');
    expect(CARD_UPGRADES.formation!.description).toBe(`All friendly stacks +${buff.amount}% Defense this turn.`);
  });
});
