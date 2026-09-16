import { buildVerticalSliceEnemyArmy, buildVerticalSlicePlayerArmy } from '../army.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { DEFAULT_HERO_SKILL_LOADOUT } from '../data/heroSkills.js';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../data/relics.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { applyPlayerAction, startBattle } from '../combat.js';
import { createRng } from '../rng.js';
import type { ArmyStack, CardInstance, CombatState, Hero, PlayerAction, RelicDefinition, RelicEffect } from '../types.js';
import { CARD_UPGRADES } from './cardUpgrades.js';
import { buildPendingReward } from './rewards.js';
import type { RunAction, RunApplyResult, RunEvent, RunState } from './types.js';

function cloneRun(run: RunState): RunState {
  return JSON.parse(JSON.stringify(run)) as RunState;
}

function buildStartingDeck(): CardInstance[] {
  const ids = [
    'command_strike',
    'command_strike',
    'charge',
    'volley',
    'defend',
    'defend',
    'shield_wall',
    'reposition',
    'rally',
    'arcane_focus',
    'battle_meditation',
    'tactical_insight',
  ];
  return ids.map((cardId, i) => ({ instanceId: `${cardId}#${i}`, cardId }));
}

export function createRun(seed: number): RunState {
  const hero: Hero = {
    id: 'commander',
    name: 'Commander',
    hp: 100,
    maxHp: 100,
    mana: 5,
    maxMana: 8,
    ac: 3,
    maxAc: 3,
    dc: 3,
    maxDc: 3,
  };

  return {
    seed,
    rng: createRng(seed),
    hero,
    army: buildVerticalSlicePlayerArmy(),
    masterDeck: buildStartingDeck(),
    relics: [],
    battlesWon: 0,
    phase: 'choosing_starting_relic',
    combat: null,
    pendingReward: null,
    log: [{ type: 'RUN_STARTED' }],
  };
}

function rescaleStack(stack: ArmyStack, multiplier: number): ArmyStack {
  const def = UNIT_DEFINITIONS[stack.unitId];
  const newCount = Math.max(0, Math.floor(stack.count * multiplier));
  const newMaxHp = newCount * def.hpPerUnit;
  return { ...stack, count: newCount, currentHp: newMaxHp, maxHp: newMaxHp, startingCount: newCount };
}

function addFlatToLargestStack(army: ArmyStack[], amount: number): ArmyStack[] {
  if (army.length === 0) return army;
  const largest = army.reduce((a, b) => (b.count > a.count ? b : a));
  const def = UNIT_DEFINITIONS[largest.unitId];
  return army.map((s) => {
    if (s.stackId !== largest.stackId) return s;
    const newCount = s.count + amount;
    const newMaxHp = newCount * def.hpPerUnit;
    return { ...s, count: newCount, currentHp: newMaxHp, maxHp: newMaxHp, startingCount: newCount };
  });
}

/**
 * "Stat-boost" relic effects are applied once, permanently, right when the
 * relic is granted — see the RelicEffect doc comment in engine/types.ts.
 * ARMY_SIZE_* kinds only ever appear on starting relics, applied before any
 * casualties exist, so rescaling to a fresh maxHp/currentHp is safe.
 */
function applyRelicStatEffectsOnce(run: RunState, def: RelicDefinition): void {
  for (const effect of def.effects) {
    switch (effect.kind) {
      case 'HERO_MAX_MANA':
        run.hero.maxMana += effect.amount;
        run.hero.mana += effect.amount;
        break;
      case 'HERO_MAX_AC':
        run.hero.maxAc += effect.amount;
        run.hero.ac += effect.amount;
        break;
      case 'HERO_MAX_DC':
        run.hero.maxDc += effect.amount;
        run.hero.dc += effect.amount;
        break;
      case 'ARMY_SIZE_MULT':
        run.army = run.army.map((s) => rescaleStack(s, effect.multiplier));
        break;
      case 'ARMY_SIZE_FLAT_LARGEST':
        run.army = addFlatToLargestStack(run.army, effect.amount);
        break;
      default:
        break; // combat-modifier kinds are read dynamically from run.relics each attack — nothing to bake in here
    }
  }
}

function startBattleForRun(run: RunState): CombatState {
  const relicEffects: RelicEffect[] = run.relics.flatMap((r) => r.effects);
  const { state } = startBattle({
    seed: run.seed,
    rng: run.rng,
    hero: run.hero,
    playerArmy: run.army,
    enemyArmy: buildVerticalSliceEnemyArmy(),
    deck: run.masterDeck,
    activeRelicEffects: relicEffects,
    heroSkillIds: DEFAULT_HERO_SKILL_LOADOUT,
  });
  return state;
}

function reject(events: RunEvent[], reason: string): void {
  events.push({ type: 'ACTION_REJECTED', reason });
}

function chooseStartingRelic(run: RunState, relicId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'choosing_starting_relic') {
    reject(events, 'Starting relic already chosen.');
    return { run, events };
  }
  const def = STARTING_RELIC_DEFINITIONS[relicId];
  if (!def) {
    reject(events, 'Unknown starting relic.');
    return { run, events };
  }

  applyRelicStatEffectsOnce(run, def);
  run.relics.push(def);
  events.push({ type: 'STARTING_RELIC_CHOSEN', relicId });

  run.phase = 'in_battle';
  run.combat = startBattleForRun(run);
  return { run, events };
}

function forwardCombatAction(run: RunState, action: PlayerAction, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'in_battle' || !run.combat) {
    reject(events, 'No battle in progress.');
    return { run, events };
  }

  const result = applyPlayerAction(run.combat, action);
  run.combat = result.state;

  if (result.state.result === 'victory') {
    run.hero = result.state.hero;
    run.army = result.state.playerArmy;
    run.rng = { seed: result.state.rng.seed };
    run.battlesWon += 1;
    events.push({ type: 'BATTLE_WON' });
    run.pendingReward = buildPendingReward(run.rng, run.relics, run.masterDeck);
    run.phase = 'reward';
  } else if (result.state.result === 'defeat') {
    run.hero = result.state.hero;
    run.army = result.state.playerArmy;
    run.rng = { seed: result.state.rng.seed };
    events.push({ type: 'BATTLE_LOST' });
    run.phase = 'defeat';
  }

  return { run, events };
}

function claimRelic(run: RunState, relicId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.relicOptions.includes(relicId)) {
    reject(events, 'That relic is not one of the current options.');
    return { run, events };
  }
  run.pendingReward.chosenRelicId = relicId;
  return { run, events };
}

function claimCard(run: RunState, cardId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.cardOptions.includes(cardId)) {
    reject(events, 'That card is not one of the current options.');
    return { run, events };
  }
  run.pendingReward.chosenCardId = cardId;
  run.pendingReward.chosenUpgradeInstanceId = null; // mutually exclusive with an upgrade pick
  return { run, events };
}

function claimUpgrade(run: RunState, instanceId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.upgradeOptions.some((o) => o.instanceId === instanceId)) {
    reject(events, 'That upgrade is not one of the current options.');
    return { run, events };
  }
  run.pendingReward.chosenUpgradeInstanceId = instanceId;
  run.pendingReward.chosenCardId = null; // mutually exclusive with a new-card pick
  return { run, events };
}

function confirmReward(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  const reward = run.pendingReward;
  let choseSomething = false;

  if (reward.chosenRelicId) {
    const def = RELIC_DEFINITIONS[reward.chosenRelicId];
    if (def) {
      applyRelicStatEffectsOnce(run, def);
      run.relics.push(def);
      events.push({ type: 'RELIC_CLAIMED', relicId: def.id });
      choseSomething = true;
    }
  }

  if (reward.chosenCardId && CARD_DEFINITIONS[reward.chosenCardId]) {
    const instanceId = `${reward.chosenCardId}#reward${run.masterDeck.length}`;
    run.masterDeck.push({ instanceId, cardId: reward.chosenCardId });
    events.push({ type: 'CARD_REWARD_CLAIMED', cardId: reward.chosenCardId });
    choseSomething = true;
  } else if (reward.chosenUpgradeInstanceId) {
    const idx = run.masterDeck.findIndex((c) => c.instanceId === reward.chosenUpgradeInstanceId);
    if (idx >= 0) {
      const card = run.masterDeck[idx]!;
      const upgradedId = CARD_UPGRADES[card.cardId];
      if (upgradedId) {
        events.push({ type: 'CARD_UPGRADED', instanceId: card.instanceId, fromCardId: card.cardId, toCardId: upgradedId });
        run.masterDeck[idx] = { ...card, cardId: upgradedId };
        choseSomething = true;
      }
    }
  }

  if (!choseSomething) {
    events.push({ type: 'REWARD_SKIPPED' });
  }

  run.pendingReward = null;
  // Phase 3 MVP has no world map yet — one battle, one reward, run ends
  // here. Phase 4 replaces this terminal state with real map navigation.
  run.phase = 'run_complete';
  events.push({ type: 'RUN_COMPLETE' });
  return { run, events };
}

export function applyRunAction(run: RunState, action: RunAction): RunApplyResult {
  const working = cloneRun(run);
  const events: RunEvent[] = [];

  let result: RunApplyResult;
  switch (action.type) {
    case 'CHOOSE_STARTING_RELIC':
      result = chooseStartingRelic(working, action.relicId, events);
      break;
    case 'COMBAT_ACTION':
      result = forwardCombatAction(working, action.action, events);
      break;
    case 'CLAIM_RELIC':
      result = claimRelic(working, action.relicId, events);
      break;
    case 'CLAIM_CARD':
      result = claimCard(working, action.cardId, events);
      break;
    case 'CLAIM_UPGRADE':
      result = claimUpgrade(working, action.instanceId, events);
      break;
    case 'CONFIRM_REWARD':
      result = confirmReward(working, events);
      break;
  }

  result.run.log = [...result.run.log, ...result.events];
  return result;
}
