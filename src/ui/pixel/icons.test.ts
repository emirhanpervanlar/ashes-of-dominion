import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, UNIT_DEFINITIONS } from '../../engine/index.js';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../../engine/data/relics.js';
import { BUILDING_DEFINITIONS } from '../../engine/run/city.js';
import { DOCTRINE_DEFINITIONS } from '../../engine/run/index.js';
import { CARD_VISUALS, POLARITY_ICONS } from '../cardVisuals.js';
import { BUILDING_ICONS, DOCTRINE_ICONS, NODE_ICONS } from '../mapIcons.js';
import { relicIcon } from '../relicIcons.js';
import { STATUS_ICONS } from '../stackStatus.js';
import { UNIT_ROLE_ICONS } from '../unitIcons.js';
import { ICONS } from './icons.js';
import type { IconName } from './icons.js';
import { MASTER } from './palette.js';

const registered = (name: string): boolean => Object.prototype.hasOwnProperty.call(ICONS, name);

describe('pixel icon registry', () => {
  it('every grid is 16x16 and only uses master palette keys', () => {
    for (const [name, grid] of Object.entries(ICONS)) {
      expect(grid.length, `${name} rows`).toBe(16);
      grid.forEach((row, y) => {
        expect(row.length, `${name} row ${y} width`).toBe(16);
        for (const key of row) if (key !== '.') expect(MASTER[key], `${name} row ${y} key "${key}"`).toBeDefined();
      });
    }
  });

  it('every icon has at least one opaque pixel', () => {
    for (const [name, grid] of Object.entries(ICONS)) expect(grid.some((row) => /[^.]/.test(row)), name).toBe(true);
  });
});

describe('game ids have icons', () => {
  const expectAll = (label: string, names: IconName[] | readonly string[]) => {
    for (const name of names) expect(registered(name), `${label}: missing icon "${name}"`).toBe(true);
  };

  it('unit role badges', () => {
    for (const id of Object.keys(UNIT_DEFINITIONS)) expectAll(`unit ${id}`, [UNIT_ROLE_ICONS[id as keyof typeof UNIT_ROLE_ICONS]]);
  });

  it('every engine status type', () => {
    expect(Object.keys(STATUS_ICONS).sort()).toEqual(['armor', 'bleed', 'burn', 'fear', 'freeze', 'poison', 'strength', 'taunt', 'weak']);
    expectAll('status', Object.values(STATUS_ICONS));
  });

  it('every relic id resolves to its own rel_ icon, not the generic placeholder', () => {
    for (const id of [...Object.keys(RELIC_DEFINITIONS), ...Object.keys(STARTING_RELIC_DEFINITIONS)]) {
      expect(relicIcon(id), `relic ${id}`).toBe(`rel_${id}`);
      expect(registered(`rel_${id}`), `relic ${id}`).toBe(true);
    }
  });

  it('every card id and polarity', () => {
    for (const id of Object.keys(CARD_DEFINITIONS)) {
      const visual = CARD_VISUALS[id];
      expect(visual, `card ${id} has no visual`).toBeDefined();
      expectAll(`card ${id}`, [visual!.icon, POLARITY_ICONS[visual!.polarity]]);
    }
    expect(Object.keys(POLARITY_ICONS).sort()).toEqual(['attack', 'buff', 'debuff', 'defense', 'utility']);
    expectAll('polarity', Object.values(POLARITY_ICONS));
  });

  it('run UI icons: threat, farm, marketplace, garrison and the start node', () => {
    expectAll('run ui', ['threat', 'bld_farm', 'bld_marketplace', 'garrison', 'node_start', 'node_city']);
  });

  it('every node type and building id', () => {
    expect(Object.keys(NODE_ICONS).sort()).toEqual(['battle', 'boss', 'elite_battle', 'event', 'merchant', 'resource', 'start', 'village']);
    expectAll('node', Object.values(NODE_ICONS));
    for (const id of [...Object.keys(BUILDING_DEFINITIONS), 'townhall', 'barracks', 'temple', 'marketplace']) {
      expect(BUILDING_ICONS[id], `building ${id}`).toBeDefined();
      expectAll(`building ${id}`, [BUILDING_ICONS[id]!]);
    }
  });

  it('every doctrine has its own Temple icon', () => {
    for (const id of Object.keys(DOCTRINE_DEFINITIONS)) {
      expect(DOCTRINE_ICONS[id], `doctrine ${id}`).toBe(`doctrine_${id}`);
      expectAll(`doctrine ${id}`, [DOCTRINE_ICONS[id]!]);
    }
  });
});
