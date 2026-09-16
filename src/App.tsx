import { useEffect, useMemo, useState } from 'react';
import {
  applyPlayerAction,
  CARD_DEFINITIONS,
  createVerticalSliceScenario,
} from './engine/index.js';
import type { ArmyStack, CardDefinition, CardInstance, CombatState, EnemyIntent, Position } from './engine/index.js';
import { StackTile } from './ui/StackTile.js';
import { CardTile } from './ui/CardTile.js';
import { describeEvent } from './ui/eventText.js';

const STORAGE_KEY = 'aod_combat_state_v1';

interface PendingCard {
  instance: CardInstance;
  cardDef: CardDefinition;
  actingStackId?: string;
  targetStackId?: string;
}

function loadInitialState(): CombatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CombatState;
  } catch {
    // corrupted save — fall through to a fresh scenario
  }
  return createVerticalSliceScenario(Date.now() & 0xffffffff).state;
}

function stackAt(army: ArmyStack[], position: Position): ArmyStack | undefined {
  return army.find((s) => s.position === position);
}

function hasResource(state: CombatState, cardDef: CardDefinition): boolean {
  const have = cardDef.cost.type === 'AC' ? state.hero.ac : cardDef.cost.type === 'DC' ? state.hero.dc : state.hero.mana;
  return have >= cardDef.cost.amount;
}

function targetingHint(cardDef: CardDefinition, pending: PendingCard): string {
  switch (cardDef.targeting) {
    case 'ally-stack':
      return `Select a friendly stack for ${cardDef.name}.`;
    case 'enemy-stack':
      return `Select an enemy stack for ${cardDef.name}.`;
    case 'ally-stack+enemy-stack':
      if (!pending.actingStackId) return `Select the friendly stack to command for ${cardDef.name}.`;
      return `Select the enemy stack to attack.`;
    case 'ally-stack+position':
      if (!pending.actingStackId) return `Select the friendly stack to move for ${cardDef.name}.`;
      return `Select an empty slot to move it to.`;
    default:
      return '';
  }
}

export default function App() {
  const [state, setState] = useState<CombatState>(loadInitialState);
  const [pending, setPending] = useState<PendingCard | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/unavailable — non-fatal for a local playtest build
    }
  }, [state]);

  const intentByStack = useMemo(() => {
    const map = new Map<string, EnemyIntent>();
    for (const intent of state.enemyIntents) map.set(intent.stackId, intent);
    return map;
  }, [state.enemyIntents]);

  function newBattle() {
    const { state: fresh } = createVerticalSliceScenario(Date.now() & 0xffffffff);
    setState(fresh);
    setPending(null);
  }

  function dispatch(action: Parameters<typeof applyPlayerAction>[1]) {
    const result = applyPlayerAction(state, action);
    setState(result.state);
    setPending(null);
  }

  function handleCardClick(instance: CardInstance) {
    if (state.phase !== 'player' || state.result !== 'ongoing') return;
    if (pending?.instance.instanceId === instance.instanceId) {
      setPending(null); // click again to cancel
      return;
    }
    const cardDef = CARD_DEFINITIONS[instance.cardId];
    if (!cardDef || !hasResource(state, cardDef)) return;

    if (cardDef.targeting === 'none') {
      dispatch({ type: 'PLAY_CARD', instanceId: instance.instanceId });
      return;
    }
    setPending({ instance, cardDef });
  }

  function handleStackClick(stack: ArmyStack | undefined, position: Position, side: 'player' | 'enemy') {
    if (!pending) return;
    const alive = !!stack && stack.count > 0;
    const { cardDef } = pending;

    if (cardDef.targeting === 'ally-stack' && side === 'player' && alive) {
      dispatch({ type: 'PLAY_CARD', instanceId: pending.instance.instanceId, actingStackId: stack!.stackId });
      return;
    }
    if (cardDef.targeting === 'enemy-stack' && side === 'enemy' && alive) {
      dispatch({ type: 'PLAY_CARD', instanceId: pending.instance.instanceId, targetStackId: stack!.stackId });
      return;
    }
    if (cardDef.targeting === 'ally-stack+enemy-stack') {
      if (side === 'player' && alive) {
        if (pending.targetStackId) {
          dispatch({
            type: 'PLAY_CARD',
            instanceId: pending.instance.instanceId,
            actingStackId: stack!.stackId,
            targetStackId: pending.targetStackId,
          });
        } else {
          setPending({ ...pending, actingStackId: stack!.stackId });
        }
        return;
      }
      if (side === 'enemy' && alive) {
        if (pending.actingStackId) {
          dispatch({
            type: 'PLAY_CARD',
            instanceId: pending.instance.instanceId,
            actingStackId: pending.actingStackId,
            targetStackId: stack!.stackId,
          });
        } else {
          setPending({ ...pending, targetStackId: stack!.stackId });
        }
        return;
      }
    }
    if (cardDef.targeting === 'ally-stack+position' && side === 'player') {
      if (!pending.actingStackId) {
        if (alive) setPending({ ...pending, actingStackId: stack!.stackId });
        return;
      }
      if (!alive) {
        dispatch({
          type: 'PLAY_CARD',
          instanceId: pending.instance.instanceId,
          actingStackId: pending.actingStackId,
          toPosition: position,
        });
      } else {
        setPending({ ...pending, actingStackId: stack!.stackId });
      }
    }
  }

  function isSelectable(stack: ArmyStack | undefined, side: 'player' | 'enemy'): boolean {
    if (!pending) return false;
    const alive = !!stack && stack.count > 0;
    const t = pending.cardDef.targeting;
    if (t === 'ally-stack') return side === 'player' && alive;
    if (t === 'enemy-stack') return side === 'enemy' && alive;
    if (t === 'ally-stack+enemy-stack') return (side === 'player' && alive) || (side === 'enemy' && alive);
    if (t === 'ally-stack+position') {
      if (side !== 'player') return false;
      return !pending.actingStackId ? alive : true;
    }
    return false;
  }

  function isSelected(stack: ArmyStack | undefined): boolean {
    if (!pending || !stack) return false;
    return stack.stackId === pending.actingStackId || stack.stackId === pending.targetStackId;
  }

  const front = [1, 2, 3] as const;
  const back = [4, 5, 6] as const;

  const recentLog = state.log.slice(-40);

  return (
    <div>
      <h1>Ashes of Dominion — Combat Vertical Slice</h1>
      <div className="subtitle">Phase 2: pure client-side combat engine, playable in browser. No backend, no save beyond this device.</div>

      <div className="toolbar">
        <button className="primary" onClick={newBattle}>
          New Battle
        </button>
        {pending && <span className="hint">{targetingHint(pending.cardDef, pending)} (click the card again to cancel)</span>}
      </div>

      {state.result !== 'ongoing' && (
        <div className={`result-banner ${state.result}`}>{state.result === 'victory' ? 'VICTORY' : 'DEFEAT'} — battle over, run would continue at a higher layer (not implemented yet)</div>
      )}

      <div className="hero-panel">
        <strong>{state.hero.name}</strong>
        <div className="stat">
          <span className="stat-label">HP</span> {state.hero.hp}/{state.hero.maxHp}
        </div>
        <div className="stat">
          <span className="stat-label">Mana</span> {state.hero.mana}/{state.hero.maxMana}
        </div>
        <div className="stat">
          <span className="stat-label">AC</span> {state.hero.ac}/{state.hero.maxAc}
        </div>
        <div className="stat">
          <span className="stat-label">DC</span> {state.hero.dc}/{state.hero.maxDc}
        </div>
        <div className="stat">
          <span className="stat-label">Turn</span> {state.turnNumber} ({state.phase})
        </div>
      </div>

      <div className="battlefield">
        <div className="row">
          {back.map((p) => {
            const s = stackAt(state.enemyArmy, p);
            return (
              <StackTile
                key={`e-${p}`}
                state={state}
                stack={s}
                position={p}
                side="enemy"
                intent={s ? intentByStack.get(s.stackId) : undefined}
                selectable={isSelectable(s, 'enemy')}
                selected={isSelected(s)}
                onClick={() => handleStackClick(s, p, 'enemy')}
              />
            );
          })}
        </div>
        <div className="row">
          {front.map((p) => {
            const s = stackAt(state.enemyArmy, p);
            return (
              <StackTile
                key={`e-${p}`}
                state={state}
                stack={s}
                position={p}
                side="enemy"
                intent={s ? intentByStack.get(s.stackId) : undefined}
                selectable={isSelectable(s, 'enemy')}
                selected={isSelected(s)}
                onClick={() => handleStackClick(s, p, 'enemy')}
              />
            );
          })}
        </div>

        <div className="row-divider" />

        <div className="row">
          {front.map((p) => {
            const s = stackAt(state.playerArmy, p);
            return (
              <StackTile
                key={`p-${p}`}
                state={state}
                stack={s}
                position={p}
                side="player"
                selectable={isSelectable(s, 'player')}
                selected={isSelected(s)}
                onClick={() => handleStackClick(s, p, 'player')}
              />
            );
          })}
        </div>
        <div className="row">
          {back.map((p) => {
            const s = stackAt(state.playerArmy, p);
            return (
              <StackTile
                key={`p-${p}`}
                state={state}
                stack={s}
                position={p}
                side="player"
                selectable={isSelectable(s, 'player')}
                selected={isSelected(s)}
                onClick={() => handleStackClick(s, p, 'player')}
              />
            );
          })}
        </div>
      </div>

      <div className="hand">
        {state.hand.map((instance) => {
          const cardDef = CARD_DEFINITIONS[instance.cardId];
          if (!cardDef) return null;
          return (
            <CardTile
              key={instance.instanceId}
              instance={instance}
              cardDef={cardDef}
              affordable={state.phase === 'player' && state.result === 'ongoing' && hasResource(state, cardDef)}
              pending={pending?.instance.instanceId === instance.instanceId}
              onClick={() => handleCardClick(instance)}
            />
          );
        })}
      </div>

      <div className="toolbar">
        <button
          className="primary"
          disabled={state.phase !== 'player' || state.result !== 'ongoing'}
          onClick={() => dispatch({ type: 'END_TURN' })}
        >
          End Turn
        </button>
        <span className="subtitle">Deck {state.deck.length} · Discard {state.discard.length} · Exhausted {state.exhausted.length}</span>
      </div>

      <div className="log">
        {recentLog.map((event, i) => {
          const text = describeEvent(state, event);
          if (!text) return null;
          const cls = event.type === 'ACTION_REJECTED' ? 'rejected' : event.type === 'BATTLE_ENDED' ? 'result' : undefined;
          return (
            <div key={i} className={cls}>
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
