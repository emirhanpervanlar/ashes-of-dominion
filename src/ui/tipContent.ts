import {
  HERO_STAT_NEUTRAL,
  HERO_STAT_SCALING_MIN,
  HERO_STAT_SCALING_PER_POINT,
  STATUS_INFO,
  UNIT_DEFINITIONS,
  WISDOM_PER_BONUS_MANA,
  dodgeChancePercent,
  heroSpellScaling,
  maxManaFromWisdom,
  statEffectiveness,
  statusEffectText,
} from '../engine/index.js';
import type { HeroStats, RelicDefinition, StatusType, UnitId } from '../engine/index.js';
import {
  GOLD_MINE_DAILY_GOLD,
  LEVEL_SLOTS,
  THREAT_PER_CITY_VISIT,
  TOTAL_CHAPTERS,
  bossDay,
  dailyFoodNet,
  dailyProduction,
  dailyUpkeep,
  foodDaysLeft,
  isGarrisonDay,
  threatMultiplier,
} from '../engine/run/index.js';
import type { CityBuildingDefinition, RunState } from '../engine/run/index.js';
import { MINE, mineDailyGold } from '../engine/run/mines.js';
import { VILLAGE, villageDailyFood, villageMilitiaPerWeek } from '../engine/run/villages.js';
import type { IconName } from './pixel/icons.js';
import { STATUS_ICONS } from './stackStatus.js';
import { UNIT_ROLE_ICONS } from './unitIcons.js';

export type TipTone = 'good' | 'bad' | 'dim';

export interface TipLine {
  icon?: IconName;
  text: string;
  tone?: TipTone;
}

/** The one content shape every tooltip takes (DESIGN_LANGUAGE 6.8). */
export interface TipContent {
  title?: string;
  icon?: IconName;
  /** Coloured word after the title (relic rarity). */
  tag?: { text: string; tone: 'common' | 'rare' | 'epic' };
  body?: string;
  lines?: TipLine[];
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export function statusTip(type: StatusType, amount: number, duration?: number, stacks = 1): TipContent {
  const lines: TipLine[] = [];
  if (stacks > 1) lines.push({ text: `${stacks} applications added together.`, tone: 'dim' });
  if (duration !== undefined) lines.push({ text: `Lasts ${plural(duration, 'more turn')}.`, tone: 'dim' });
  return { title: STATUS_INFO[type].name, icon: STATUS_ICONS[type], body: statusEffectText(type, amount), lines: lines.length > 0 ? lines : undefined };
}

export function blockTip(amount: number): TipContent {
  return { title: 'Block', icon: 'shield', body: `Absorbs the next ${amount} damage. Block resets at the start of your turn.` };
}

const RARITY_TAG: Record<RelicDefinition['rarity'], NonNullable<TipContent['tag']>> = {
  common: { text: 'Common', tone: 'common' },
  rare: { text: 'Rare', tone: 'rare' },
  epic: { text: 'Epic', tone: 'epic' },
};

/** The relic's benefit text: its description without the drawback sentences, which the UI shows as a separate red line. */
export function relicBenefit(relic: Pick<RelicDefinition, 'description' | 'drawbacks'>): string {
  return (relic.drawbacks ?? []).reduce((text, drawback) => text.replace(drawback, ''), relic.description).replace(/\s+/g, ' ').trim();
}

export function relicTip(relic: Pick<RelicDefinition, 'name' | 'rarity' | 'description' | 'drawbacks'>, icon: IconName): TipContent {
  return {
    title: relic.name,
    icon,
    tag: RARITY_TAG[relic.rarity],
    body: relicBenefit(relic),
    lines: relic.drawbacks?.map((text) => ({ text, tone: 'bad' as const })),
  };
}

/** Role badge text keyed by the role icon; the icons come from unitIcons.ts. */
const ROLE_INFO: Partial<Record<IconName, { name: string; text: string }>> = {
  role_melee: { name: 'Melee', text: 'Hits its own or an adjacent lane, the front row first. A back-row melee stack cannot attack while any ally stands in the front row.' },
  role_ranged: { name: 'Ranged', text: 'Can attack any enemy stack, front or back, from any lane.' },
  role_tank: { name: 'Heavy', text: 'Armoured melee frontliner. Hits its own or an adjacent lane and shields its neighbours.' },
  role_support: { name: 'Support', text: 'Uses its free action to heal a friendly stack instead of attacking.' },
  role_caster: { name: 'Caster', text: 'Magic user that backs up its allies.' },
  role_undead: { name: 'Undead', text: 'Raised from your fallen by the Necromantic Doctrine. A weak melee stack that needs no Food.' },
  role_beast: { name: 'Beast', text: 'Fast melee raider that goes after ranged units first.' },
};

export function roleTip(unitId: UnitId): TipContent {
  const icon = UNIT_ROLE_ICONS[unitId];
  const info = ROLE_INFO[icon];
  if (!info) return { title: UNIT_DEFINITIONS[unitId].name };
  return { title: info.name, icon, body: info.text };
}

/** `was` is the unupgraded cost when the card is cheaper than it. */
export function manaCostTip(cost: number, was?: number): TipContent {
  return { title: 'Mana cost', icon: 'mana', body: was !== undefined && was > cost ? `Costs ${cost} (was ${was}).` : `Costs ${cost} Mana to play.` };
}

export function pileTip(kind: 'draw' | 'discard', count: number): TipContent {
  return kind === 'draw'
    ? { title: 'Draw pile', icon: 'deck', body: `${plural(count, 'card')} left. You draw from here at the start of each turn. Click to see what is in it (the order is hidden).` }
    : { title: 'Discard pile', icon: 'discard', body: `${plural(count, 'card')} used. It is shuffled back into the draw pile when that runs out. Click to view.` };
}

export function goldTip(run: Pick<RunState, 'gold' | 'city' | 'mines'>): TipContent {
  const lines: TipLine[] = [];
  if (run.city.buildings.includes('gold_mine')) lines.push({ icon: 'gold', text: `Gold Mine: +${GOLD_MINE_DAILY_GOLD} Gold every day.`, tone: 'good' });
  if (run.mines > 0) lines.push({ icon: 'node_mine', text: `${plural(run.mines, 'captured mine')}: +${mineDailyGold(run)} Gold every day.`, tone: 'good' });
  return { title: 'Gold', icon: 'gold', body: `${run.gold} Gold. Pays for recruits, buildings, cards and relics. Battles, mines, villages and events bring more.`, lines };
}

export function foodTip(run: Pick<RunState, 'food' | 'army' | 'city' | 'villages'>): TipContent {
  const upkeep = dailyUpkeep(run);
  const production = dailyProduction(run);
  const net = dailyFoodNet(run);
  const days = foodDaysLeft(run);
  const lines: TipLine[] = [
    { text: `Army eats ${upkeep} per day.` },
    { text: `Farm and villages make ${production} per day.` },
    { text: `Net ${signed(net)} per day.`, tone: net < 0 ? 'bad' : 'good' },
  ];
  if (net < 0) lines.push({ icon: 'ui_warn', text: `Lasts ${plural(days, 'more day')}, then the army starves.`, tone: 'bad' });
  lines.push({ text: 'Click for the full breakdown.', tone: 'dim' });
  return { title: 'Food', icon: 'food', body: `${run.food} Food in stock.`, lines };
}

export function threatTip(run: Pick<RunState, 'threat'>): TipContent {
  return {
    title: 'Threat',
    icon: 'threat',
    body: `Threat ${run.threat}: enemy armies are x${threatMultiplier(run.threat).toFixed(2)} their normal size.`,
    lines: [{ text: `Each city visit adds ${THREAT_PER_CITY_VISIT}.`, tone: 'dim' }],
  };
}

export function dayTip(run: Pick<RunState, 'day'>): TipContent {
  let untilGarrison = 1;
  while (!isGarrisonDay(run.day + untilGarrison)) untilGarrison++;
  return {
    title: 'Day',
    icon: 'day',
    body: `Day ${run.day}. Every step along the road takes one day.`,
    lines: [{ icon: 'garrison', text: `Garrison grows in ${plural(untilGarrison, 'day')} (the city gets free soldiers every week).` }],
  };
}

/** What helping one more village adds to the daily Food and the weekly militia, given how many are helped already (militia stops at the engine's village cap). */
export function villageHelpGain(helped: number): { food: number; militia: number } {
  const before = { villages: helped };
  const after = { villages: helped + 1 };
  return { food: villageDailyFood(after) - villageDailyFood(before), militia: villageMilitiaPerWeek(after) - villageMilitiaPerWeek(before) };
}

/** The Road tooltip of a village node: both choices, with the numbers that never change between chapters. */
export function villageTip(): TipContent {
  return {
    title: 'Village',
    icon: 'node_village',
    body: 'You choose when you arrive.',
    lines: [
      { icon: 'gold', text: 'Raid: Gold and Food at once, but Threat +1.', tone: 'bad' },
      { icon: 'food', text: `Help: a smaller gift, then +${VILLAGE.dailyFood} Food every day and +${VILLAGE.militiaPerVillage} militia every week, for the rest of the run.`, tone: 'good' },
    ],
  };
}

export function fortTip(): TipContent {
  return { title: 'Fort', icon: 'node_fort', body: 'Assault an enemy camp: a hard battle, then a relic and extra loot.', lines: [{ icon: 'relic', text: 'Relics from forts never carry a drawback.', tone: 'good' }] };
}

export function mineTip(): TipContent {
  return {
    title: 'Mine',
    icon: 'node_mine',
    body: 'Capture it: a small find now.',
    lines: [{ icon: 'gold', text: `+${MINE.dailyGold} Gold every day for the rest of the run (at most ${MINE.payingMines} mines pay).`, tone: 'good' }],
  };
}

/** Road tooltip of a node: the plain label, or the longer explanation for nodes that have one. */
export function nodeTip(type: string, label: string): TipContent | string {
  if (type === 'village') return villageTip();
  if (type === 'fort') return fortTip();
  if (type === 'mine') return mineTip();
  return label;
}

export function chapterTip(run: Pick<RunState, 'chapter'>): TipContent {
  return { title: `Chapter ${run.chapter}`, body: `Chapter ${run.chapter} of ${TOTAL_CHAPTERS}. Each chapter ends in a boss; the run is won after the third.` };
}

export function bossTip(run: Pick<RunState, 'chapter' | 'day'>): TipContent {
  return { title: 'Boss', icon: 'node_boss', body: `The boss of chapter ${run.chapter} waits on day ${bossDay(run.chapter)}.` };
}

export function slotsTip(run: Pick<RunState, 'city'>): TipContent {
  return { title: 'Building slots', icon: 'slots', body: `${run.city.buildings.length} of ${LEVEL_SLOTS[run.city.level]} slots used. Upgrade the Town Hall for more.` };
}

/** `blocker` is why an unbuilt building cannot be built right now (no slot, no Gold), shown under its cost. */
export function buildingTip(building: CityBuildingDefinition, built: boolean, description: string, blocker: string | null = null): TipContent {
  const lines: TipLine[] = built ? [{ text: 'Built.', tone: 'good' }] : [{ icon: 'gold', text: `Costs ${building.cost} Gold to build.` }];
  if (blocker) lines.push({ icon: 'ui_warn', text: blocker, tone: 'bad' });
  return { title: building.name, body: description, lines };
}

/** Why a card cannot be played right now (AO-D040): the condition plus the current reason. */
export function cardBlockedTip(cardName: string, requirement: string | null, reason: string | null): TipContent {
  const lines: TipLine[] = [];
  if (reason) lines.push({ icon: 'ui_warn', text: reason, tone: 'bad' });
  if (requirement) lines.push({ text: requirement, tone: 'dim' });
  return { title: cardName, lines };
}

export interface HeroStatRow {
  key: keyof HeroStats;
  label: string;
  icon: IconName;
  value: number;
  /** What the stat does at this value. */
  effect: string;
  /** The tooltip: what the stat does in this game (`HERO_STAT_INFO`) plus what it gives at this value. */
  tip: TipContent;
}

const percentAbove = (stat: number): number => Math.round((statEffectiveness(stat) - 1) * 100);

// Numbers below are read off the engine's own formulas (heroStats.ts), so a rebalance updates the tips too.
const BONUS_PER_POINT = Math.round((statEffectiveness(11) - 1) * 100);
const BONUS_CAP = Math.round((statEffectiveness(99) - 1) * 100);
const DODGE_CAP = dodgeChancePercent(99);
const MAX_MANA_CAP = maxManaFromWisdom(0, 99);
const SPELL_PER_POINT = Math.round(HERO_STAT_SCALING_PER_POINT * 100);
const SPELL_SCALING_TEXT = `+${SPELL_PER_POINT}% damage for each point above ${HERO_STAT_NEUTRAL}, -${SPELL_PER_POINT}% for each point below (never under x${HERO_STAT_SCALING_MIN}).`;

/** Hero spell damage change at this stat value, in percent (Intelligence 18 -> +40). */
const spellPercent = (stat: number): number => Math.round((heroSpellScaling(stat) - 1) * 100);

/**
 * What each hero stat does in the game today, in one place (AO-D064). `used: false` stats are not read by the engine
 * and say "Not used yet" (Vitality).
 */
export const HERO_STAT_INFO: Record<keyof HeroStats, { what: string; used: boolean }> = {
  strength: {
    what: `Melee units deal +${BONUS_PER_POINT}% damage for each point above 10 (up to +${BONUS_CAP}%). Also scales Command: Strike: ${SPELL_SCALING_TEXT}`,
    used: true,
  },
  dexterity: {
    what: `Ranged units deal +${BONUS_PER_POINT}% damage for each point above 10 (up to +${BONUS_CAP}%), and 1% Dodge per point above 10 (up to ${DODGE_CAP}%). Also scales the volleys Arrow Rain and Volley: ${SPELL_SCALING_TEXT}`,
    used: true,
  },
  intelligence: {
    what: `Scales the hero's magic spells (Fireball, Frost, Chain Lightning, Arcane Storm): ${SPELL_SCALING_TEXT}`,
    used: true,
  },
  vitality: { what: 'Toughness. Not used yet.', used: false },
  wisdom: {
    what: `Healing +${BONUS_PER_POINT}% per point above 10 (up to +${BONUS_CAP}%). Every ${WISDOM_PER_BONUS_MANA} points above 10 add 1 Max Mana (${MAX_MANA_CAP} at most).`,
    used: true,
  },
};

function statTip(key: keyof HeroStats, label: string, icon: IconName, effect: string): TipContent {
  const info = HERO_STAT_INFO[key];
  return { title: label, icon, body: info.what, lines: info.used ? [{ text: `Now: ${effect}`, tone: 'dim' }] : undefined };
}

/** Joins the effects that actually apply; a stat at or below 10 has none. */
function effectText(...parts: (string | null)[]): string {
  return parts.filter((p): p is string => p !== null).join(' ') || 'No bonus: 10 is neutral.';
}

/**
 * The five hero stats with what each does now. Strength, Dexterity, Intelligence and Wisdom feed combat (heroStats.ts,
 * heroSpells.ts); Vitality is not read by the engine, and the row says so instead of promising an effect.
 */
export function heroStatRows(stats: HeroStats, baseMana: number): HeroStatRow[] {
  const extraMana = maxManaFromWisdom(baseMana, stats.wisdom) - baseMana;
  const dodge = dodgeChancePercent(stats.dexterity);
  const spell = (stat: number, what: string): string | null => (spellPercent(stat) !== 0 ? `${what} ${signed(spellPercent(stat))}% damage.` : null);
  return [
    withTip({
      key: 'strength',
      label: 'Strength',
      icon: 'role_melee',
      value: stats.strength,
      effect: effectText(percentAbove(stats.strength) > 0 ? `Melee units deal +${percentAbove(stats.strength)}% damage.` : null, spell(stats.strength, 'Command: Strike')),
    }),
    withTip({
      key: 'dexterity',
      label: 'Dexterity',
      icon: 'role_ranged',
      value: stats.dexterity,
      effect: effectText(percentAbove(stats.dexterity) > 0 ? `Ranged units deal +${percentAbove(stats.dexterity)}% damage.` : null, dodge > 0 ? `${dodge}% Dodge.` : null, spell(stats.dexterity, 'Volleys')),
    }),
    withTip({ key: 'intelligence', label: 'Intelligence', icon: 'role_caster', value: stats.intelligence, effect: effectText(spell(stats.intelligence, 'Magic spells')) }),
    withTip({ key: 'vitality', label: 'Vitality', icon: 'hp', value: stats.vitality, effect: 'Not used yet.' }),
    withTip({
      key: 'wisdom',
      label: 'Wisdom',
      icon: 'role_support',
      value: stats.wisdom,
      effect: effectText(percentAbove(stats.wisdom) > 0 ? `Healing +${percentAbove(stats.wisdom)}%.` : null, extraMana > 0 ? `Max Mana +${extraMana}.` : null),
    }),
  ];
}

function withTip(row: Omit<HeroStatRow, 'tip'>): HeroStatRow {
  return { ...row, tip: statTip(row.key, row.label, row.icon, row.effect) };
}
