import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack } from '../types.js';

/** AGENT.md §20 — additional per-move food cost by total army size. PROTOTYPE. */
const ARMY_SIZE_FOOD_BRACKETS: ReadonlyArray<{ max: number; additional: number }> = [
  { max: 50, additional: 0 },
  { max: 100, additional: 1 },
  { max: 200, additional: 2 },
  { max: 400, additional: 3 },
  { max: Infinity, additional: 5 },
];

const BASE_MOVE_FOOD_COST = 2;

export function totalArmyCount(army: ArmyStack[]): number {
  return army.reduce((sum, s) => sum + s.count, 0);
}

export function moveFoodCost(army: ArmyStack[]): number {
  const count = totalArmyCount(army);
  const bracket = ARMY_SIZE_FOOD_BRACKETS.find((b) => count <= b.max);
  return BASE_MOVE_FOOD_COST + (bracket ? bracket.additional : 5);
}

export interface StarvationResult {
  army: ArmyStack[];
  unitsLost: number;
}

/** AGENT.md §21 — food at 0 doesn't end the run: Morale -1, Army HP -5%, possible casualties. */
export function applyStarvation(army: ArmyStack[]): StarvationResult {
  let unitsLost = 0;
  const newArmy = army.map((stack) => {
    if (stack.count === 0) return stack;
    const hpPerUnit = UNIT_DEFINITIONS[stack.unitId].hpPerUnit;
    const newHp = Math.max(0, Math.floor(stack.currentHp * 0.95));
    const newCount = newHp > 0 ? Math.ceil(newHp / hpPerUnit) : 0;
    unitsLost += stack.count - newCount;
    return { ...stack, currentHp: newHp, count: newCount, morale: stack.morale - 1 };
  });
  return { army: newArmy, unitsLost };
}
