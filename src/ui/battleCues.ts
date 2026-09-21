import { CARD_DEFINITIONS, HERO_ATTACKER_ID, UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, CombatEvent, CombatState, EnemyStep, StatusType } from '../engine/index.js';

/** How an attack travels: melee lunges and slashes, ranged fires a bolt, casters throw an orb. */
export type AttackStyle = 'melee' | 'bolt' | 'orb';
export type StatusTone = 'buff' | 'debuff' | 'freeze';

export interface HitCue {
  targetStackId: string;
  unitsKilled: number;
  /** HP that got through Block; above 0 with no kills reads as "Wounded" (AO-D022). */
  hpDamage: number;
  blocked: number;
  dodged: boolean;
  countAfter: number;
}

/** One visual beat of a combat action, derived from engine events or an enemy step; never from rules. */
export type Cue =
  | { kind: 'attack'; attackerStackId: string; style: AttackStyle; hits: HitCue[] }
  | { kind: 'dot'; stackId: string; hit: HitCue }
  | { kind: 'block'; stackId: string; amount: number }
  | { kind: 'heal'; stackId: string; units: number }
  | { kind: 'status'; stackId: string; status: StatusType; tone: StatusTone };

const DEBUFFS: StatusType[] = ['weak', 'bleed', 'poison', 'burn', 'fear'];

export function statusTone(status: StatusType): StatusTone {
  if (status === 'freeze') return 'freeze';
  return DEBUFFS.includes(status) ? 'debuff' : 'buff';
}

function findStack(board: CombatState, stackId: string): ArmyStack | undefined {
  return board.playerArmy.find((s) => s.stackId === stackId) ?? board.enemyArmy.find((s) => s.stackId === stackId);
}

function attackStyle(attacker: ArmyStack | undefined, magic: boolean): AttackStyle {
  if (magic) return 'orb';
  const def = attacker ? UNIT_DEFINITIONS[attacker.unitId] : undefined;
  if (!def) return 'melee';
  if (def.tags.includes('caster')) return 'orb';
  if (def.rangedAllAccess || def.tags.includes('ranged')) return 'bolt';
  return 'melee';
}

/** A hero-cast card travels by the stat it scales with: Intelligence throws a fire orb, Dexterity shoots arrows, Strength slashes. */
function heroAttackStyle(cardId: string | undefined): AttackStyle {
  const stat = cardId ? CARD_DEFINITIONS[cardId]?.scalesWith : undefined;
  return stat === 'intelligence' ? 'orb' : stat === 'dexterity' ? 'bolt' : 'melee';
}

function isMagicCard(cardId: string | undefined): boolean {
  return !!cardId && !!CARD_DEFINITIONS[cardId]?.tags.includes('magic');
}

function pushAttack(cues: Cue[], board: CombatState, attackerStackId: string, hit: HitCue, magic: boolean, cardId?: string): void {
  const last = cues[cues.length - 1];
  if (last?.kind === 'attack' && last.attackerStackId === attackerStackId) {
    last.hits.push(hit);
    return;
  }
  const style = attackerStackId === HERO_ATTACKER_ID ? heroAttackStyle(cardId) : attackStyle(findStack(board, attackerStackId), magic);
  cues.push({ kind: 'attack', attackerStackId, style, hits: [hit] });
}

/** Cues for the events one player action appended to the log; `before` / `board` are the states around the action. */
export function cuesFromEvents(events: CombatEvent[], before: CombatState, board: CombatState, cardId?: string): Cue[] {
  const cues: Cue[] = [];
  const magic = isMagicCard(cardId);
  const healed = new Set<string>();
  for (const e of events) {
    if (e.type === 'STACK_ATTACKED') {
      const hit: HitCue = {
        targetStackId: e.targetStackId,
        unitsKilled: e.unitsKilled,
        hpDamage: e.finalDamage,
        blocked: e.blocked,
        dodged: e.rawDamage === 0 && e.finalDamage === 0 && e.blocked === 0,
        countAfter: e.countAfter,
      };
      if (e.attackerStackId === e.targetStackId) cues.push({ kind: 'dot', stackId: e.targetStackId, hit });
      else pushAttack(cues, board, e.attackerStackId, hit, magic, cardId);
    } else if (e.type === 'STACK_HEALED' && e.amount > 0) {
      // Soldiers actually restored (count is the health readout); a second heal on the same stack reports none.
      const gained = healed.has(e.stackId) ? 0 : (findStack(board, e.stackId)?.count ?? 0) - (findStack(before, e.stackId)?.count ?? 0);
      healed.add(e.stackId);
      cues.push({ kind: 'heal', stackId: e.stackId, units: Math.max(0, gained) });
    } else if (e.type === 'BLOCK_GAINED' && e.amount > 0) {
      cues.push({ kind: 'block', stackId: e.stackId, amount: e.amount });
    } else if (e.type === 'STATUS_APPLIED') {
      cues.push({ kind: 'status', stackId: e.stackId, status: e.status, tone: statusTone(e.status) });
    }
  }
  return cues;
}

/** Cues for one enemy step: the actor's attack, counterattacks it provoked (in order), then statuses it applied. */
export function cuesForStep(step: EnemyStep, board: CombatState): Cue[] {
  const cues: Cue[] = [];
  for (const h of step.hits) {
    pushAttack(cues, board, h.attackerStackId, { targetStackId: h.targetStackId, unitsKilled: h.unitsKilled, hpDamage: h.hpDamage, blocked: h.blocked, dodged: h.dodged, countAfter: h.countAfter }, false);
  }
  for (const s of step.statuses) cues.push({ kind: 'status', stackId: s.stackId, status: s.status, tone: statusTone(s.status) });
  return cues;
}

/** Shows one step on the displayed board: the snapshots it produced plus the statuses it applied. */
export function applyStep(board: CombatState, step: EnemyStep): CombatState {
  const snapshots = new Map(step.resulting.map((s) => [s.stackId, s]));
  const patch = (army: ArmyStack[]): ArmyStack[] =>
    army.map((s) => {
      const snap = snapshots.get(s.stackId);
      const added = step.statuses.filter((st) => st.stackId === s.stackId);
      if (!snap && added.length === 0) return s;
      return {
        ...s,
        ...(snap ? { count: snap.count, currentHp: snap.currentHp, block: snap.block } : {}),
        statuses: [...s.statuses, ...added.map((a) => ({ type: a.status, amount: a.amount, duration: a.duration }))],
      };
    });
  return { ...board, playerArmy: patch(board.playerArmy), enemyArmy: patch(board.enemyArmy) };
}

/** The board as the enemy phase starts: leftover non-retained cards are already in the discard pile. */
export function enemyPhaseBoard(pre: CombatState): CombatState {
  const leaving = pre.hand.filter((c) => !CARD_DEFINITIONS[c.cardId]?.retain);
  return { ...pre, phase: 'enemy', hand: pre.hand.filter((c) => CARD_DEFINITIONS[c.cardId]?.retain), discard: [...pre.discard, ...leaving] };
}

/** The board after each step, in order; the last entry is the enemy phase's end. */
export function replayEnemySteps(pre: CombatState, steps: EnemyStep[]): CombatState[] {
  const boards: CombatState[] = [];
  let board = enemyPhaseBoard(pre);
  for (const step of steps) {
    board = applyStep(board, step);
    boards.push(board);
  }
  return boards;
}

/**
 * Stack ids whose replayed count / HP / Block differ from the engine's final state. The final state is taken after the
 * next player turn has started, which also ticks poison/bleed/burn and resets player Block, so stacks carrying a
 * damage-over-time status are skipped and player Block is compared only when the battle ended (no new turn).
 */
export function replayMismatches(replayed: CombatState, final: CombatState): string[] {
  const bad: string[] = [];
  for (const army of ['playerArmy', 'enemyArmy'] as const) {
    for (const want of final[army]) {
      const got = replayed[army].find((s) => s.stackId === want.stackId);
      if (!got) {
        bad.push(want.stackId);
        continue;
      }
      if (got.statuses.some((s) => s.type === 'poison' || s.type === 'bleed' || s.type === 'burn')) continue;
      const blockMatters = army === 'enemyArmy' || final.phase === 'ended';
      if (got.count !== want.count || got.currentHp !== want.currentHp || (blockMatters && got.block !== want.block)) bad.push(want.stackId);
    }
  }
  return bad;
}
