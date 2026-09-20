import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, RECRUIT_COSTS } from './city.js';

/** Own-property test: ids come from untrusted input and must never resolve to inherited keys such as "constructor". */
function isKeyOf(table: object, key: unknown): boolean {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A positive whole number: rejects NaN, Infinity, fractions, zero, negatives and non-numbers. */
export function isPositiveCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** A board slot, 1-6. */
export function isBoardPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

const COMBAT_ACTION_TYPES: ReadonlySet<string> = new Set(['PLAY_CARD', 'BASIC_ACTION', 'END_TURN']);
const COMBAT_ID_FIELDS = ['instanceId', 'actingStackId', 'targetStackId', 'secondTargetStackId', 'stackId'] as const;

function combatActionProblem(action: unknown): string | null {
  if (!isRecord(action) || typeof action.type !== 'string' || !COMBAT_ACTION_TYPES.has(action.type)) return 'Malformed combat action.';
  if (action.type === 'PLAY_CARD' && !isId(action.instanceId)) return 'Malformed combat action.';
  if (action.type === 'BASIC_ACTION' && !isId(action.stackId)) return 'Malformed combat action.';
  for (const field of COMBAT_ID_FIELDS) {
    if (action[field] !== undefined && !isId(action[field])) return 'Malformed combat action.';
  }
  if (action.toPosition !== undefined && !isBoardPosition(action.toPosition)) return 'Malformed combat action.';
  return null;
}

/**
 * Shape check for a run action before any handler sees it: the reducer takes JSON from the UI, so every id must
 * be a string and every count/position a sane whole number. Returns the rejection reason, or null when the payload is well formed
 * (whether the referenced things exist in the current state is up to the handler; unknown `type`s are the reducer's default branch).
 */
export function actionProblem(action: unknown): string | null {
  if (!isRecord(action) || typeof action.type !== 'string') return 'Malformed action.';
  switch (action.type) {
    case 'COMBAT_ACTION':
      return combatActionProblem(action.action);
    case 'MOVE_TO':
      return isId(action.nodeId) ? null : 'Malformed action.';
    case 'CLAIM_CARD':
    case 'BUY_CARD':
      return isId(action.cardId) ? null : 'Malformed action.';
    case 'CLAIM_RELIC':
    case 'BUY_RELIC':
      return isId(action.relicId) ? null : 'Malformed action.';
    case 'CLAIM_UPGRADE':
    case 'REMOVE_CARD':
    case 'CHOOSE_EVENT_CARD':
      return isId(action.instanceId) ? null : 'Malformed action.';
    case 'CHOOSE_EVENT_OPTION':
      return isId(action.optionId) ? null : 'Malformed action.';
    case 'CHOOSE_EVENT_UNIT':
      return isId(action.unitId) ? null : 'Malformed action.';
    case 'DISMISS_STACK':
      if (!isId(action.stackId)) return 'Malformed action.';
      return action.count === undefined || isPositiveCount(action.count) ? null : 'Invalid dismiss amount.';
    case 'RECRUIT':
      if (!isKeyOf(RECRUIT_COSTS, action.unitId)) return 'Unknown recruitable unit.';
      return isPositiveCount(action.count) ? null : 'Invalid recruit count.';
    case 'BUILD_BUILDING':
      return isKeyOf(BUILDING_DEFINITIONS, action.buildingId) ? null : 'Unknown building.';
    case 'CHOOSE_DOCTRINE':
      return isKeyOf(DOCTRINE_DEFINITIONS, action.doctrineId) ? null : 'Unknown doctrine.';
    case 'SPLIT_STACK':
      if (!isId(action.stackId)) return 'Malformed action.';
      return isPositiveCount(action.splitCount) ? null : 'Invalid split amount.';
    case 'MERGE_STACKS':
      return isId(action.stackIdA) && isId(action.stackIdB) ? null : 'Malformed action.';
    case 'MOVE_STACK':
      if (!isId(action.stackId)) return 'Malformed action.';
      return isBoardPosition(action.toPosition) ? null : 'Position must be 1-6.';
    default:
      return null;
  }
}
