import { STARTING_RELIC_DEFINITIONS } from '../data/relics.js';
import type { HeroId, RelicDefinition, RelicEffect, RelicRarity, UnitId } from '../types.js';
import { createRun } from './runEngine.js';

const percent = (multiplier: number): string => `${multiplier >= 1 ? '+' : '-'}${Math.round(Math.abs(multiplier - 1) * 100)}%`;
const signed = (n: number): string => `${n >= 0 ? '+' : '-'}${Math.abs(n)}`;

function summarizeEffect(effect: RelicEffect): string {
  switch (effect.kind) {
    case 'HERO_MAX_MANA':
      return `Hero max Mana ${signed(effect.amount)}`;
    case 'ARMY_SIZE_MULT':
      return `Army size ${percent(effect.multiplier)}`;
    case 'ARMY_SIZE_FLAT_LARGEST':
      return `Largest starting stack ${signed(effect.amount)} units`;
    case 'GOLD_FLAT':
      return `Starting Gold ${signed(effect.amount)}`;
    case 'PLAYER_DAMAGE_MULT':
      return `Damage dealt ${percent(effect.multiplier)}`;
    case 'PLAYER_DAMAGE_TAKEN_MULT':
      return `Damage taken ${percent(effect.multiplier)}`;
    case 'TAG_DAMAGE_MULT':
      return `${effect.tag} damage ${percent(effect.multiplier)}`;
    case 'LARGE_STACK_STRENGTH':
      return `Stacks over ${effect.threshold}: Strength ${signed(effect.amount)}`;
    case 'SMALL_STACK_DAMAGE_MULT':
      return `Stacks under ${effect.threshold}: damage ${percent(effect.multiplier)}`;
    case 'NECROMANCY':
      return `Raise ${Math.round(effect.ratio * 100)}% of the slain`;
    case 'DODGE_BONUS_PERCENT':
      return `Dodge ${signed(effect.amount)}%`;
    case 'HEALING_MULT':
      return `Healing ${percent(effect.multiplier)}`;
    case 'FIRST_CARD_DISCOUNT':
      return `First card each turn costs ${signed(-effect.amount)} Mana`;
  }
}

export interface StartingRelicInfo {
  id: string;
  name: string;
  /** Plain-words text, drawbacks included. */
  description: string;
  rarity: RelicRarity;
  /** One short line per effect, benefits and drawbacks alike. */
  effectSummary: string[];
}

function relicInfo(def: RelicDefinition): StartingRelicInfo {
  return { id: def.id, name: def.name, description: def.description, rarity: def.rarity, effectSummary: def.effects.map(summarizeEffect) };
}

/** The five starting relics (AO-D037) in the fixed order the hero-choice screen shows them. */
export function startingRelicList(): StartingRelicInfo[] {
  return Object.values(STARTING_RELIC_DEFINITIONS).map(relicInfo);
}

export interface StartPreview {
  relic: StartingRelicInfo;
  /** The starting army with the relic applied, in slot order. */
  army: { unitId: UnitId; count: number; position: number }[];
  totalUnits: number;
  maxMana: number;
  gold: number;
  food: number;
}

/**
 * What a run started with this hero and relic would look like, taken from a real
 * `createRun` so the UI never re-implements the relic maths. Undefined for an unknown relic.
 */
export function previewStart(heroId: HeroId, relicId: string): StartPreview | undefined {
  const def = STARTING_RELIC_DEFINITIONS[relicId];
  if (!def) return undefined;
  const run = createRun(0, heroId, undefined, relicId);
  const army = run.army.map((s) => ({ unitId: s.unitId, count: s.count, position: s.position }));
  return {
    relic: relicInfo(def),
    army,
    totalUnits: army.reduce((n, s) => n + s.count, 0),
    maxMana: run.hero.maxMana,
    gold: run.gold,
    food: run.food,
  };
}
