import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import type { IconName } from './pixel/icons.js';
import { STATUS_ICONS, groupStatuses } from './stackStatus.js';
import type { TipContent } from './tipContent.js';

/** One chip of the "Turn effects" strip: a buff the player's army carries right now (read from flags and statuses, never re-derived). */
export interface TurnEffect {
  id: string;
  icon: IconName;
  /** Short chip text. */
  text: string;
  tip: TipContent;
}

const stackName = (s: ArmyStack): string => `${UNIT_DEFINITIONS[s.unitId].name} x${s.count}`;

/** Stacks that carry a flag value, grouped by that value, so "+50%" on two stacks is one chip. */
function byValue(army: ArmyStack[], read: (s: ArmyStack) => number | undefined): Map<number, ArmyStack[]> {
  const groups = new Map<number, ArmyStack[]>();
  for (const s of army) {
    const value = read(s);
    if (value === undefined || value === 0) continue;
    groups.set(value, [...(groups.get(value) ?? []), s]);
  }
  return groups;
}

const namesLine = (stacks: ArmyStack[]) => ({ text: stacks.map(stackName).join(', '), tone: 'dim' as const });

/**
 * The buffs that matter this turn: next-attack bonuses, damage reduction, counterattack, redirect, divine shield, dodge,
 * untargetable, plus the strength / armor / taunt statuses. Empty when nothing is active. Order is stable: the army-wide
 * Focus Fire bonus (`CombatState.nextFriendlyAttackBonusPercent`), then flags, then statuses.
 */
export function turnEffects(playerArmy: ArmyStack[], nextFriendlyAttackBonusPercent = 0): TurnEffect[] {
  const living = playerArmy.filter((s) => s.count > 0);
  const out: TurnEffect[] = [];

  if (nextFriendlyAttackBonusPercent > 0) {
    out.push({
      id: 'army-next-attack',
      icon: 'st_strength',
      text: `Next friendly attack +${nextFriendlyAttackBonusPercent}%`,
      tip: {
        title: 'Next friendly attack',
        icon: 'st_strength',
        body: `The next attack any of your stacks makes deals +${nextFriendlyAttackBonusPercent}% damage, then the bonus is used up. Hero spells do not use it.`,
      },
    });
  }

  for (const [pct, stacks] of byValue(living, (s) => s.flags.nextAttackDamageBonusPercent)) {
    out.push({
      id: `next-attack-${pct}`,
      icon: 'st_strength',
      text: `Next attack ${pct > 0 ? '+' : ''}${pct}%`,
      tip: { title: 'Next attack', icon: 'st_strength', body: `The next basic attack of ${stacks.length === 1 ? 'this stack' : 'each of these stacks'} deals ${pct > 0 ? '+' : ''}${pct}% damage. It is used up when the stack attacks.`, lines: [namesLine(stacks)] },
    });
  }
  for (const [pct, stacks] of byValue(living, (s) => s.flags.incomingDamageReductionPercent)) {
    out.push({
      id: `reduction-${pct}`,
      icon: 'shield',
      text: `Damage taken -${pct}%`,
      tip: { title: 'Damage reduction', icon: 'shield', body: `Incoming damage is reduced by ${pct}%. Lasts until the start of your next turn.`, lines: [namesLine(stacks)] },
    });
  }
  for (const [pct, stacks] of byValue(living, (s) => (s.flags.counterattackUsesLeft ? s.flags.counterattackPercent : undefined))) {
    out.push({
      id: `counter-${pct}`,
      icon: 'fx_dagger',
      text: `Counter ${pct}%`,
      tip: { title: 'Counterattack', icon: 'fx_dagger', body: `Retaliates for ${pct}% damage against the next melee hit received.`, lines: [namesLine(stacks)] },
    });
  }
  const redirecting = living.filter((s) => (s.flags.redirectPercent ?? 0) > 0);
  if (redirecting.length > 0) {
    const pct = redirecting[0]!.flags.redirectPercent!;
    out.push({
      id: 'redirect',
      icon: 'fx_flag',
      text: `Protect ${pct}%`,
      tip: { title: 'Protect', icon: 'fx_flag', body: `${pct}% of the next direct hit on the protected ally is taken by this stack instead.`, lines: [namesLine(redirecting)] },
    });
  }
  const shielded = living.filter((s) => s.flags.divineShield);
  if (shielded.length > 0) {
    out.push({
      id: 'divine-shield',
      icon: 'fx_sparkle',
      text: 'Divine shield',
      tip: { title: 'Divine shield', icon: 'fx_sparkle', body: 'The next lethal hit leaves the stack with 1 soldier instead.', lines: [namesLine(shielded)] },
    });
  }
  const evasive = living.filter((s) => (s.flags.dodgeMultiplier ?? 1) > 1);
  if (evasive.length > 0) {
    out.push({
      id: 'dodge',
      icon: 'fx_wind',
      text: 'Evasion',
      tip: { title: 'Evasion', icon: 'fx_wind', body: 'Dodge chance is multiplied this turn.', lines: [namesLine(evasive)] },
    });
  }
  const hidden = living.filter((s) => s.flags.untargetable);
  if (hidden.length > 0) {
    out.push({
      id: 'untargetable',
      icon: 'fx_wind',
      text: 'Untargetable',
      tip: { title: 'Untargetable', icon: 'fx_wind', body: 'Cannot be targeted by enemies and cannot attack this turn.', lines: [namesLine(hidden)] },
    });
  }

  // Statuses the player put on their own army: one chip per type with the summed amount over every stack.
  const totals = new Map<string, { type: 'strength' | 'armor' | 'taunt'; stacks: ArmyStack[]; amount: number; duration: number }>();
  for (const s of living) {
    for (const g of groupStatuses(s.statuses)) {
      if (g.type !== 'strength' && g.type !== 'armor' && g.type !== 'taunt') continue;
      const entry = totals.get(g.type) ?? { type: g.type, stacks: [], amount: 0, duration: 0 };
      entry.stacks.push(s);
      entry.amount += g.amount;
      entry.duration = Math.max(entry.duration, g.duration);
      totals.set(g.type, entry);
    }
  }
  const NAMES = { strength: 'Strength', armor: 'Armor', taunt: 'Taunt' } as const;
  for (const t of totals.values()) {
    const each = t.type === 'taunt' ? '' : ` (${t.stacks.length} ${t.stacks.length === 1 ? 'stack' : 'stacks'})`;
    out.push({
      id: `status-${t.type}`,
      icon: STATUS_ICONS[t.type],
      text: t.type === 'taunt' ? NAMES.taunt : `${NAMES[t.type]} +${t.amount}`,
      tip: {
        title: NAMES[t.type],
        icon: STATUS_ICONS[t.type],
        body: t.type === 'armor' ? `Counts as +${t.amount} Defense in total${each}.` : t.type === 'strength' ? `+${t.amount} Attack in total${each}.` : 'Enemies must target these stacks.',
        lines: [{ text: `Lasts ${t.duration} more ${t.duration === 1 ? 'turn' : 'turns'}.`, tone: 'dim' }, namesLine(t.stacks)],
      },
    });
  }
  return out;
}
