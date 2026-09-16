import { useEffect, useMemo, useState } from 'react';
import { CARD_DEFINITIONS, HERO_SKILL_DEFINITIONS } from './engine/index.js';
import type { ArmyStack, CardTargeting, EnemyIntent, PlayerAction, Position } from './engine/index.js';
import { applyRunAction, createRun } from './engine/run/index.js';
import type { RunState } from './engine/run/index.js';
import { StackTile } from './ui/StackTile.js';
import { CardTile } from './ui/CardTile.js';
import { StartingRelicScreen } from './ui/StartingRelicScreen.js';
import { RewardScreen } from './ui/RewardScreen.js';
import { RunEndScreen } from './ui/RunEndScreen.js';
import { WorldMapScreen } from './ui/WorldMapScreen.js';
import { EventScreen } from './ui/EventScreen.js';
import { MerchantScreen } from './ui/MerchantScreen.js';
import { CityScreen } from './ui/CityScreen.js';
import { describeEvent } from './ui/eventText.js';
import { relicIcon } from './ui/relicIcons.js';

const STORAGE_KEY = 'aod_run_state_v1';

interface PendingAction {
  kind: 'card' | 'skill';
  id: string;
  name: string;
  targeting: CardTargeting;
  actingStackId?: string;
  targetStackId?: string;
}

function loadInitialRun(): RunState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RunState;
  } catch {
    // corrupted save — fall through to a fresh run
  }
  return createRun(Date.now() & 0xffffffff);
}

function stackAt(army: ArmyStack[], position: Position): ArmyStack | undefined {
  return army.find((s) => s.position === position);
}

export default function App() {
  const [run, setRun] = useState<RunState>(loadInitialRun);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    } catch {
      // storage full/unavailable — non-fatal for a local playtest build
    }
  }, [run]);

  const combat = run.combat;

  const intentByStack = useMemo(() => {
    const map = new Map<string, EnemyIntent>();
    for (const intent of combat?.enemyIntents ?? []) map.set(intent.stackId, intent);
    return map;
  }, [combat?.enemyIntents]);

  function newRun() {
    setRun(createRun(Date.now() & 0xffffffff));
    setPending(null);
  }

  function dispatchRun(action: Parameters<typeof applyRunAction>[1]) {
    const result = applyRunAction(run, action);
    setRun(result.run);
    return result;
  }

  function dispatchCombat(action: PlayerAction) {
    dispatchRun({ type: 'COMBAT_ACTION', action });
    setPending(null);
  }

  function hasResource(kind: 'card' | 'skill', id: string): boolean {
    if (!combat) return false;
    const cost = kind === 'card' ? CARD_DEFINITIONS[id]?.cost : HERO_SKILL_DEFINITIONS[id]?.cost;
    if (!cost) return false;
    const have = cost.type === 'AC' ? combat.hero.ac : cost.type === 'DC' ? combat.hero.dc : combat.hero.mana;
    return have >= cost.amount;
  }

  function handleCardClick(instanceId: string, cardId: string) {
    if (!combat || combat.phase !== 'player' || combat.result !== 'ongoing') return;
    if (pending?.kind === 'card' && pending.id === instanceId) {
      setPending(null);
      return;
    }
    const cardDef = CARD_DEFINITIONS[cardId];
    if (!cardDef || !hasResource('card', cardId)) return;
    if (cardDef.targeting === 'none') {
      dispatchCombat({ type: 'PLAY_CARD', instanceId });
      return;
    }
    setPending({ kind: 'card', id: instanceId, name: cardDef.name, targeting: cardDef.targeting });
  }

  function handleSkillClick(skillId: string) {
    if (!combat || combat.phase !== 'player' || combat.result !== 'ongoing') return;
    const skillState = combat.heroSkills.find((s) => s.skillId === skillId);
    if (!skillState || skillState.cooldownRemaining > 0) return;
    if (pending?.kind === 'skill' && pending.id === skillId) {
      setPending(null);
      return;
    }
    const skillDef = HERO_SKILL_DEFINITIONS[skillId];
    if (!skillDef || !hasResource('skill', skillId)) return;
    if (skillDef.targeting === 'none') {
      dispatchCombat({ type: 'USE_SKILL', skillId });
      return;
    }
    setPending({ kind: 'skill', id: skillId, name: skillDef.name, targeting: skillDef.targeting });
  }

  function finalize(extra: { actingStackId?: string; targetStackId?: string; toPosition?: Position }) {
    if (!pending) return;
    if (pending.kind === 'card') {
      dispatchCombat({ type: 'PLAY_CARD', instanceId: pending.id, ...extra });
    } else {
      dispatchCombat({ type: 'USE_SKILL', skillId: pending.id, ...extra });
    }
  }

  function handleStackClick(stack: ArmyStack | undefined, position: Position, side: 'player' | 'enemy') {
    if (!pending) return;
    const alive = !!stack && stack.count > 0;
    const { targeting } = pending;

    if (targeting === 'ally-stack' && side === 'player' && alive) {
      finalize({ actingStackId: stack!.stackId });
      return;
    }
    if (targeting === 'enemy-stack' && side === 'enemy' && alive) {
      finalize({ targetStackId: stack!.stackId });
      return;
    }
    if (targeting === 'ally-stack+enemy-stack') {
      if (side === 'player' && alive) {
        if (pending.targetStackId) finalize({ actingStackId: stack!.stackId, targetStackId: pending.targetStackId });
        else setPending({ ...pending, actingStackId: stack!.stackId });
        return;
      }
      if (side === 'enemy' && alive) {
        if (pending.actingStackId) finalize({ actingStackId: pending.actingStackId, targetStackId: stack!.stackId });
        else setPending({ ...pending, targetStackId: stack!.stackId });
        return;
      }
    }
    if (targeting === 'ally-stack+position' && side === 'player') {
      if (!pending.actingStackId) {
        if (alive) setPending({ ...pending, actingStackId: stack!.stackId });
        return;
      }
      if (!alive) {
        finalize({ actingStackId: pending.actingStackId, toPosition: position });
      } else {
        setPending({ ...pending, actingStackId: stack!.stackId });
      }
    }
  }

  function isSelectable(stack: ArmyStack | undefined, side: 'player' | 'enemy'): boolean {
    if (!pending) return false;
    const alive = !!stack && stack.count > 0;
    const t = pending.targeting;
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

  if (run.phase === 'choosing_starting_relic') {
    return <StartingRelicScreen onChoose={(relicId) => dispatchRun({ type: 'CHOOSE_STARTING_RELIC', relicId })} />;
  }

  if (run.phase === 'reward' && run.pendingReward) {
    return (
      <RewardScreen
        reward={run.pendingReward}
        onClaimRelic={(relicId) => dispatchRun({ type: 'CLAIM_RELIC', relicId })}
        onClaimCard={(cardId) => dispatchRun({ type: 'CLAIM_CARD', cardId })}
        onClaimUpgrade={(instanceId) => dispatchRun({ type: 'CLAIM_UPGRADE', instanceId })}
        onConfirm={() => dispatchRun({ type: 'CONFIRM_REWARD' })}
      />
    );
  }

  if (run.phase === 'run_complete' || run.phase === 'defeat') {
    return <RunEndScreen run={run} onNewRun={newRun} />;
  }

  if (run.phase === 'on_map') {
    return (
      <WorldMapScreen
        run={run}
        onMoveTo={(nodeId) => dispatchRun({ type: 'MOVE_TO', nodeId })}
        onEnterCity={() => dispatchRun({ type: 'ENTER_CITY' })}
        onNewRun={newRun}
      />
    );
  }

  if (run.phase === 'city') {
    return (
      <CityScreen
        city={run.city}
        gold={run.gold}
        food={run.food}
        army={run.army}
        onRecruit={(unitId, count, destination) => dispatchRun({ type: 'RECRUIT', unitId, count, destination })}
        onBuild={(buildingId) => dispatchRun({ type: 'BUILD_BUILDING', buildingId })}
        onUpgradeCity={() => dispatchRun({ type: 'UPGRADE_CITY' })}
        onChooseDoctrine={(doctrineId) => dispatchRun({ type: 'CHOOSE_DOCTRINE', doctrineId })}
        onTransferToArmy={(stackId) => dispatchRun({ type: 'TRANSFER_GARRISON_TO_ARMY', stackId })}
        onLeave={() => dispatchRun({ type: 'LEAVE_CITY' })}
      />
    );
  }

  if (run.phase === 'event' && run.pendingEvent) {
    return (
      <EventScreen
        eventId={run.pendingEvent.eventId}
        onChoose={(optionId) => dispatchRun({ type: 'CHOOSE_EVENT_OPTION', optionId })}
      />
    );
  }

  if (run.phase === 'merchant' && run.pendingMerchant) {
    return (
      <MerchantScreen
        gold={run.gold}
        inventory={run.pendingMerchant}
        onBuyCard={(cardId) => dispatchRun({ type: 'BUY_CARD', cardId })}
        onBuyRelic={(relicId) => dispatchRun({ type: 'BUY_RELIC', relicId })}
        onLeave={() => dispatchRun({ type: 'LEAVE_MERCHANT' })}
      />
    );
  }

  if (!combat) {
    return <div>Loading…</div>;
  }

  const front = [1, 2, 3] as const;
  const back = [4, 5, 6] as const;
  const recentLog = combat.log.slice(-40);
  const manaPct = combat.hero.maxMana > 0 ? Math.min(100, (combat.hero.mana / combat.hero.maxMana) * 100) : 0;
  const canAct = combat.phase === 'player' && combat.result === 'ongoing';

  return (
    <div>
      <div className="top-bar">
        <div className="hero-card">
          <div className="hero-portrait">🧑‍✈️</div>
          <div className="hero-info">
            <div className="hero-name-row">
              <span>{combat.hero.name}</span>
              <div className="relic-icons">
                {run.relics.map((r) => (
                  <span key={r.id} className="relic-icon" title={`${r.name} — ${r.description}`}>
                    {relicIcon(r.id)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mana-row">
              <span className="mana-label">Mana</span>
              <div className="mana-bar-track">
                <div className="mana-bar-fill" style={{ width: `${manaPct}%` }} />
              </div>
              <span>
                {combat.hero.mana}/{combat.hero.maxMana}
              </span>
            </div>
            <div className="skills-row">
              {combat.heroSkills.map((skillState) => {
                const skillDef = HERO_SKILL_DEFINITIONS[skillState.skillId];
                if (!skillDef) return null;
                const onCooldown = skillState.cooldownRemaining > 0;
                const affordable = canAct && hasResource('skill', skillDef.id);
                return (
                  <button
                    key={skillDef.id}
                    className={`skill-chip${pending?.kind === 'skill' && pending.id === skillDef.id ? ' pending' : ''}`}
                    disabled={!affordable || onCooldown}
                    onClick={() => handleSkillClick(skillDef.id)}
                    title={skillDef.description}
                  >
                    {skillDef.name}
                    <span className="skill-chip-cost">
                      {skillDef.cost.amount}
                      {skillDef.cost.type === 'MANA' ? 'M' : skillDef.cost.type}
                    </span>
                    {onCooldown ? ` (${skillState.cooldownRemaining})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="turn-badge">
          <div>
            <strong>Turn {combat.turnNumber}</strong>
          </div>
          <div>{combat.phase === 'player' ? 'Your turn' : combat.phase === 'enemy' ? 'Enemy turn' : 'Battle over'}</div>
          <div>Hero HP {combat.hero.hp}/{combat.hero.maxHp}</div>
          <div style={{ marginTop: 6 }}>
            <button onClick={newRun}>Abandon Run</button>
          </div>
        </div>
      </div>

      {pending && <div className="hint">Targeting for {pending.name} — click the card/skill again to cancel.</div>}

      <div className="battlefield-v2">
        <div className="side-columns">
          <div className="unit-column">
            {back.map((p) => {
              const s = stackAt(combat.playerArmy, p);
              return (
                <StackTile
                  key={`p-${p}`}
                  state={combat}
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
          <div className="unit-column">
            {front.map((p) => {
              const s = stackAt(combat.playerArmy, p);
              return (
                <StackTile
                  key={`p-${p}`}
                  state={combat}
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

        <div className="vs-divider">VS</div>

        <div className="side-columns">
          <div className="unit-column">
            {front.map((p) => {
              const s = stackAt(combat.enemyArmy, p);
              return (
                <StackTile
                  key={`e-${p}`}
                  state={combat}
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
          <div className="unit-column">
            {back.map((p) => {
              const s = stackAt(combat.enemyArmy, p);
              return (
                <StackTile
                  key={`e-${p}`}
                  state={combat}
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
        </div>
      </div>

      <div className="bottom-bar">
        <div className="resource-pips">
          <div className="pip">
            <span className="pip-dot ac" /> AC {combat.hero.ac}/{combat.hero.maxAc}
          </div>
          <div className="pip">
            <span className="pip-dot dc" /> DC {combat.hero.dc}/{combat.hero.maxDc}
          </div>
        </div>
        <button className="primary" disabled={!canAct} onClick={() => dispatchCombat({ type: 'END_TURN' })}>
          End Turn
        </button>
        <div className="pile-counts">
          Deck {combat.deck.length} · Discard {combat.discard.length} · Exhausted {combat.exhausted.length}
        </div>
      </div>

      <div className="hand-tray">
        {combat.hand.map((instance) => {
          const cardDef = CARD_DEFINITIONS[instance.cardId];
          if (!cardDef) return null;
          return (
            <CardTile
              key={instance.instanceId}
              instance={instance}
              cardDef={cardDef}
              affordable={canAct && hasResource('card', cardDef.id)}
              pending={pending?.kind === 'card' && pending.id === instance.instanceId}
              onClick={() => handleCardClick(instance.instanceId, instance.cardId)}
            />
          );
        })}
      </div>

      <div className="log">
        {recentLog.map((event, i) => {
          const text = describeEvent(combat, event);
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
