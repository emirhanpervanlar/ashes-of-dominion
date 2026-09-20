import { applyRunAction } from '../runEngine.js';
import type { RunApplyResult, RunState } from '../types.js';

/** The reward screen cannot be skipped (AO-D068): closes it by claiming the first offered card. */
export function pickReward(run: RunState): RunApplyResult {
  const reward = run.pendingReward;
  if (!reward) throw new Error('No reward pending');
  return applyRunAction(run, { type: 'CLAIM_CARD', cardId: reward.cardOptions[0]! });
}
