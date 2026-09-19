import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_DEFINITIONS, UNIT_DEFINITIONS, computeValidHealTargets, computeValidTargets } from './engine/index.js';
import type { ArmyStack, CardEffect, CardTargeting, EnemyIntent, PlayerAction, Position } from './engine/index.js';
import { applyRunAction, createRun } from './engine/run/index.js';
import type { RunEvent, RunState } from './engine/run/index.js';
import { StackTile } from './ui/StackTile.js';
import { UnitPopup } from './ui/UnitPopup.js';
import { FlyingCard } from './ui/FlyingCard.js';
import type { FlyingCardState } from './ui/FlyingCard.js';
import { floatersFromEvents, useFloatingText } from './ui/FloatingText.js';
import { cannotAct } from './ui/stackStatus.js';
import { ActionCardTile } from './ui/ActionCardTile.js';
import { StartingRelicScreen } from './ui/StartingRelicScreen.js';
import { RewardScreen } from './ui/RewardScreen.js';
import { RunEndScreen } from './ui/RunEndScreen.js';
import { WorldMapScreen } from './ui/WorldMapScreen.js';
import { EventScreen } from './ui/EventScreen.js';
import { MerchantScreen } from './ui/MerchantScreen.js';
import { CityScreen } from './ui/CityScreen.js';
import { describeEvent } from './ui/eventText.js';
import { relicIcon } from './ui/relicIcons.js';
import { CARD_DESCRIPTIONS } from './ui/cardText.js';
import { HistoryDrawer } from './ui/HistoryDrawer.js';
import { ToastStack } from './ui/Toast.js';
import type { ToastItem } from './ui/Toast.js';
import { previewAttackDamage } from './ui/damagePreview.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { CommanderSetupScreen } from './ui/CommanderSetupScreen.js';
import { PauseMenu } from './ui/PauseMenu.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { startMusic, setMusicVolume } from './ui/music.js';

const STORAGE_KEY = 'aod_run_state_v1';

type AppStage = 'title' | 'setup' | 'game';

type PendingTargeting = CardTargeting | 'basic-attack' | 'basic-heal';

interface PendingAction {
  kind: 'card' | 'skill' | 'basic';
  id: string;
  name: string;
  targeting: PendingTargeting;
  actingStackId?: string;
  targetStackId?: string;
}

interface PlayerActionFx {
  attackFrom?: string;
  attackTo?: string;
  blockStacks?: string[];
  buffStacks?: string[];
  debuffStacks?: string[];
}

const BUFF_EFFECT_KINDS = new Set(['GAIN_MORALE', 'GAIN_MORALE_ALL', 'GAIN_MANA', 'DRAW', 'GAIN_TAUNT']);

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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [playedInstanceId, setPlayedInstanceId] = useState<string | null>(null);
  const [inspectStackId, setInspectStackId] = useState<string | null>(null);
  const { floaters, spawn: spawnFloaters } = useFloatingText();
  const [discardingIds, setDiscardingIds] = useState<string[] | null>(null);
  const [drawingIds, setDrawingIds] = useState<Set<string>>(new Set());
  const prevHandIds = useRef<Set<string>>(new Set());
  const [playerFx, setPlayerFx] = useState<PlayerActionFx | null>(null);
  const [enemyAnimQueue, setEnemyAnimQueue] = useState<EnemyIntent[] | null>(null);
  const [enemyAnimIndex, setEnemyAnimIndex] = useState(0);
  const [appStage, setAppStage] = useState<AppStage>('title');
  const [menuOpen, setMenuOpen] = useState(false);
  const [titleSettingsOpen, setTitleSettingsOpen] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState(0.5);
  const [hasSave, setHasSave] = useState(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });
  const nextToastId = useRef(1);

  function changeMusicVolume(v: number) {
    setMusicVolumeState(v);
    setMusicVolume(v);
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    } catch {
      // storage full/unavailable — non-fatal for a local playtest build
    }
  }, [run]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPending(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Steps through the enemy's intents one at a time (highlighting the acting stack and its
  // target) before actually dispatching END_TURN — the engine resolves the whole enemy turn
  // atomically, so this is a pre-resolution "preview playback," not a true step-by-step sim.
  useEffect(() => {
    if (!enemyAnimQueue) return;
    if (enemyAnimIndex >= enemyAnimQueue.length) {
      dispatchEndTurn();
      setEnemyAnimQueue(null);
      setEnemyAnimIndex(0);
      return;
    }
    const t = setTimeout(() => setEnemyAnimIndex((i) => i + 1), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyAnimQueue, enemyAnimIndex]);

  const combat = run.combat;
  const currentEnemyIntent = enemyAnimQueue ? enemyAnimQueue[enemyAnimIndex] : null;

  // Cards newly present in hand (just drawn) play a slide-in-from-the-deck entrance once.
  useEffect(() => {
    if (!combat) return;
    const currentIds = new Set(combat.hand.map((c) => c.instanceId));
    const newIds = [...currentIds].filter((id) => !prevHandIds.current.has(id));
    prevHandIds.current = currentIds;
    if (newIds.length === 0) return;
    setDrawingIds(new Set(newIds));
    const t = setTimeout(() => setDrawingIds(new Set()), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.hand]);

  /** Plays the non-retained hand cards sliding out to the discard pile before END_TURN actually resolves. */
  function dispatchEndTurn() {
    if (!combat) return;
    const leaving = combat.hand.filter((c) => !CARD_DEFINITIONS[c.cardId]?.retain).map((c) => c.instanceId);
    if (leaving.length === 0) {
      dispatchCombat({ type: 'END_TURN' });
      return;
    }
    setDiscardingIds(leaving);
    setTimeout(() => {
      dispatchCombat({ type: 'END_TURN' });
      setDiscardingIds(null);
    }, 320);
  }

  function handleEndTurn() {
    if (!combat) return;
    // Intents are captured at the start of the turn — drop any whose actor (or, for a buff,
    // its target) died to the player's own actions since then, so a dead stack doesn't still
    // appear to "act" in the end-of-turn playback.
    const liveIntents = combat.enemyIntents.filter((i) => {
      const actor = combat.enemyArmy.find((s) => s.stackId === i.stackId);
      if (!actor || actor.count <= 0) return false;
      if (i.kind === 'buff') {
        const target = combat.enemyArmy.find((s) => s.stackId === i.targetStackId);
        return !!target && target.count > 0;
      }
      return true;
    });
    if (liveIntents.length === 0) {
      dispatchEndTurn();
      return;
    }
    setEnemyAnimIndex(0);
    setEnemyAnimQueue(liveIntents);
  }

  function stackFx(stackId: string | undefined): { acting: boolean; hit: boolean; block: boolean; buff: boolean; debuff: boolean } {
    const result = { acting: false, hit: false, block: false, buff: false, debuff: false };
    if (!stackId) return result;
    if (currentEnemyIntent) {
      if (currentEnemyIntent.stackId === stackId) result.acting = true;
      if (currentEnemyIntent.kind === 'attack' && currentEnemyIntent.targetStackId === stackId) result.hit = true;
      if (currentEnemyIntent.kind === 'buff' && currentEnemyIntent.targetStackId === stackId) result.buff = true;
    }
    if (playerFx) {
      if (playerFx.attackFrom === stackId) result.acting = true;
      if (playerFx.attackTo === stackId) result.hit = true;
      if (playerFx.blockStacks?.includes(stackId)) result.block = true;
      if (playerFx.buffStacks?.includes(stackId)) result.buff = true;
      if (playerFx.debuffStacks?.includes(stackId)) result.debuff = true;
    }
    return result;
  }

  function pushToast(icon: string, text: string) {
    setToasts((t) => [...t, { id: nextToastId.current++, icon, text }]);
  }

  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  /** Resource-gain toasts (AGENT.md UX feedback) — a generic before/after diff plus a few event-specific call-outs. */
  function toastsForRunEvents(events: RunEvent[], before: RunState, after: RunState) {
    for (const e of events) {
      if (e.type === 'RESOURCE_FOUND') {
        pushToast('💰', `+${e.gold} Gold, +${e.food} Food`);
      }
      if (e.type === 'EVENT_RESOLVED') {
        const goldDelta = after.gold - before.gold;
        const foodDelta = after.food - before.food;
        const hpDelta = after.hero.hp - before.hero.hp;
        const parts: string[] = [];
        if (goldDelta !== 0) parts.push(`${goldDelta > 0 ? '+' : ''}${goldDelta} Gold`);
        if (foodDelta !== 0) parts.push(`${foodDelta > 0 ? '+' : ''}${foodDelta} Food`);
        if (hpDelta !== 0) parts.push(`${hpDelta > 0 ? '+' : ''}${hpDelta} HP`);
        if (e.outcome === 'search_relic') parts.push('a relic!');
        if (e.outcome === 'search_trap') parts.push('a trap!');
        const icon = e.outcome === 'search_relic' ? '★' : e.outcome === 'search_trap' ? '⚠️' : hpDelta > 0 ? '❤️' : '✨';
        pushToast(icon, parts.length ? parts.join(', ') : 'Nothing happened.');
      }
      if (e.type === 'STARVING') {
        pushToast('💀', `Starving! Lost ${e.unitsLost} unit(s).`);
      }
    }
  }

  function newRun() {
    setRun(createRun(Date.now() & 0xffffffff));
    setPending(null);
  }

  function dispatchRun(action: Parameters<typeof applyRunAction>[1]) {
    const before = run;
    const result = applyRunAction(run, action);
    toastsForRunEvents(result.events, before, result.run);
    setRun(result.run);
    return result;
  }

  function dispatchCombat(action: PlayerAction) {
    const logLengthBefore = combat?.log.length ?? 0;
    const result = dispatchRun({ type: 'COMBAT_ACTION', action });
    // Floating text is for the player's own actions only; the enemy turn is played back separately.
    if (action.type !== 'END_TURN' && result.run.combat) {
      spawnFloaters(floatersFromEvents(result.run.combat.log.slice(logLengthBefore), result.run.combat));
    }
    setPending(null);
  }

  function hasResource(cardId: string): boolean {
    if (!combat) return false;
    const cardDef = CARD_DEFINITIONS[cardId];
    if (!cardDef) return false;
    return combat.hero.mana >= cardDef.manaCost;
  }

  function handleCardClick(instanceId: string, cardId: string) {
    if (!combat || combat.phase !== 'player' || combat.result !== 'ongoing') return;
    if (pending?.kind === 'card' && pending.id === instanceId) {
      setPending(null);
      return;
    }
    const cardDef = CARD_DEFINITIONS[cardId];
    if (!cardDef || !hasResource(cardId)) return;
    // No-target cards no longer play instantly — they require a Drop Card confirmation
    // in the middle of the battlefield, same as any other pending selection.
    setPending({ kind: 'card', id: instanceId, name: cardDef.name, targeting: cardDef.targeting });
  }

  function finalize(extra: { actingStackId?: string; targetStackId?: string; toPosition?: Position }) {
    if (!pending || !combat || flyingCard || playerFx) return;
    const current = pending;

    function dispatchNow() {
      if (current.kind === 'card') {
        dispatchCombat({ type: 'PLAY_CARD', instanceId: current.id, ...extra });
      } else {
        dispatchCombat({ type: 'BASIC_ACTION', stackId: current.id, targetStackId: extra.targetStackId });
      }
    }

    const fx: PlayerActionFx = {};

    if (current.kind === 'basic') {
      const actorStack = combat.playerArmy.find((s) => s.stackId === current.id);
      const basicKind = actorStack ? UNIT_DEFINITIONS[actorStack.unitId].basicAction ?? 'attack' : 'attack';
      if (basicKind === 'heal') {
        if (extra.targetStackId) fx.buffStacks = [extra.targetStackId];
      } else {
        if (extra.actingStackId) fx.attackFrom = extra.actingStackId;
        if (extra.targetStackId) fx.attackTo = extra.targetStackId;
      }
    } else {
      const cardId = combat.hand.find((c) => c.instanceId === current.id)?.cardId;
      const def = cardId ? CARD_DEFINITIONS[cardId] : undefined;
      const effects = def?.effects ?? [];

      if (effects.some((e) => e.kind === 'ATTACK' || e.kind === 'ATTACK_ALL_WITH_TAG')) {
        if (extra.actingStackId) fx.attackFrom = extra.actingStackId;
        if (extra.targetStackId) fx.attackTo = extra.targetStackId;
      }
      if (effects.some((e) => e.kind === 'GAIN_BLOCK_ALL_FRONT')) {
        fx.blockStacks = combat.playerArmy.filter((s) => s.count > 0 && (s.position === 1 || s.position === 2 || s.position === 3)).map((s) => s.stackId);
      } else if (effects.some((e) => e.kind === 'GAIN_BLOCK') && extra.actingStackId) {
        fx.blockStacks = [extra.actingStackId];
      }
      if (effects.some((e) => e.kind === 'GAIN_MORALE_ALL')) {
        fx.buffStacks = combat.playerArmy.filter((s) => s.count > 0).map((s) => s.stackId);
      } else if (effects.some((e) => BUFF_EFFECT_KINDS.has(e.kind)) && extra.actingStackId) {
        fx.buffStacks = [extra.actingStackId];
      }
      if (effects.some((e) => e.kind === 'APPLY_STATUS' && (e.status === 'weak' || e.status === 'freeze')) && extra.targetStackId) {
        fx.debuffStacks = [extra.targetStackId];
      }
    }

    const hasFx = fx.attackFrom || fx.attackTo || fx.blockStacks?.length || fx.buffStacks?.length || fx.debuffStacks?.length;
    const launched = current.kind === 'card' && launchCardFlight(current.id);
    if (hasFx || launched) {
      if (hasFx) setPlayerFx(fx);
      setTimeout(() => {
        setPlayerFx(null);
        setFlyingCard(null);
        setPlayedInstanceId(null);
        dispatchNow();
      }, 420);
    } else {
      dispatchNow();
    }
  }

  /** Lifts the played card out of the (clipping) hand bar into a fixed layer that travels to the scene centre. */
  function launchCardFlight(instanceId: string): boolean {
    const instance = combat?.hand.find((c) => c.instanceId === instanceId);
    const def = instance ? CARD_DEFINITIONS[instance.cardId] : undefined;
    const slot = document.querySelector(`[data-instance-id="${instanceId}"]`);
    const scene = document.querySelector('.frame-scene');
    if (!def || !slot || !scene) return false;
    const from = slot.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    setPlayedInstanceId(instanceId);
    setFlyingCard({
      cardId: def.id,
      name: def.name,
      description: CARD_DESCRIPTIONS[def.id] ?? def.id,
      manaCost: def.manaCost,
      from: { left: from.left, top: from.top, width: from.width, height: from.height },
      to: { x: sceneRect.left + sceneRect.width / 2, y: sceneRect.top + sceneRect.height / 2 },
    });
    return true;
  }

  function handleStackClick(stack: ArmyStack | undefined, position: Position, side: 'player' | 'enemy') {
    if (!pending) return;
    const alive = !!stack && stack.count > 0;
    const { targeting } = pending;

    // Re-clicking an already-selected half of a two-step targeting choice deselects just
    // that half, so the player can pick a different ally/target without restarting the card.
    if (side === 'player' && stack && stack.stackId === pending.actingStackId) {
      setPending({ ...pending, actingStackId: undefined });
      return;
    }
    if (side === 'enemy' && stack && stack.stackId === pending.targetStackId) {
      setPending({ ...pending, targetStackId: undefined });
      return;
    }

    if (targeting === 'basic-attack' && side === 'enemy' && alive) {
      finalize({ actingStackId: pending.actingStackId, targetStackId: stack!.stackId });
      return;
    }
    if (targeting === 'basic-heal' && side === 'player' && alive) {
      finalize({ actingStackId: pending.actingStackId, targetStackId: stack!.stackId });
      return;
    }
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
      return;
    }
    if (targeting === 'ally-stack+ally-stack' && side === 'player' && alive) {
      if (!pending.actingStackId) {
        setPending({ ...pending, actingStackId: stack!.stackId });
        return;
      }
      if (stack!.stackId === pending.actingStackId) return;
      finalize({ actingStackId: pending.actingStackId, targetStackId: stack!.stackId });
    }
  }

  /**
   * v2_list.md §4.2 — clicking one of your own not-yet-acted stacks (with nothing else
   * pending) starts its free basic action instead of requiring a card. Clicking the same
   * acting stack again cancels, same as re-clicking a pending card.
   */
  function onArmyStackClick(stack: ArmyStack | undefined, position: Position, side: 'player' | 'enemy') {
    if (pending?.kind === 'basic' && side === 'player' && stack?.stackId === pending.actingStackId) {
      setPending(null);
      return;
    }
    if (pending) {
      handleStackClick(stack, position, side);
      return;
    }
    if (side === 'player' && stack && stack.count > 0 && !cannotAct(stack, side) && canAct) {
      const def = UNIT_DEFINITIONS[stack.unitId];
      const kind = def.basicAction ?? 'attack';
      setPending({
        kind: 'basic',
        id: stack.stackId,
        name: def.name,
        targeting: kind === 'heal' ? 'basic-heal' : 'basic-attack',
        actingStackId: stack.stackId,
      });
    }
  }

  function isSelectable(stack: ArmyStack | undefined, side: 'player' | 'enemy'): boolean {
    if (!pending) {
      // Nothing pending — only the player's own alive, not-yet-acted stacks are
      // clickable, to start their free basic action.
      if (side !== 'player' || !stack || stack.count === 0) return false;
      return !cannotAct(stack, side) && canAct;
    }
    const alive = !!stack && stack.count > 0;
    const t = pending.targeting;
    if (t === 'basic-attack') {
      if (side !== 'enemy' || !alive || !combat) return false;
      const actor = combat.playerArmy.find((s) => s.stackId === pending.actingStackId);
      if (!actor) return false;
      const validTargets = computeValidTargets(actor, combat.enemyArmy, UNIT_DEFINITIONS[actor.unitId]);
      return validTargets.some((v) => v.stackId === stack!.stackId);
    }
    if (t === 'basic-heal') {
      if (side !== 'player' || !alive || !combat) return false;
      return computeValidHealTargets(combat.playerArmy).some((v) => v.stackId === stack!.stackId);
    }
    if (t === 'ally-stack') return side === 'player' && alive;
    if (t === 'enemy-stack') return side === 'enemy' && alive;
    if (t === 'ally-stack+enemy-stack') {
      if (side === 'player' && alive) return true;
      if (side === 'enemy' && alive) {
        // Once an acting stack is chosen, only its lane-geometry-valid enemies stay selectable.
        if (!pending.actingStackId || !combat) return true;
        const actor = combat.playerArmy.find((s) => s.stackId === pending.actingStackId);
        if (!actor) return true;
        const validTargets = computeValidTargets(actor, combat.enemyArmy, UNIT_DEFINITIONS[actor.unitId]);
        return validTargets.some((v) => v.stackId === stack!.stackId);
      }
      return false;
    }
    if (t === 'ally-stack+position') {
      if (side !== 'player') return false;
      return !pending.actingStackId ? alive : true;
    }
    if (t === 'ally-stack+ally-stack') {
      if (side !== 'player' || !alive) return false;
      return !pending.actingStackId || stack!.stackId !== pending.actingStackId;
    }
    return false;
  }

  function isSelected(stack: ArmyStack | undefined): boolean {
    if (!pending || !stack) return false;
    return stack.stackId === pending.actingStackId || stack.stackId === pending.targetStackId;
  }

  function isDimmed(stack: ArmyStack | undefined, side: 'player' | 'enemy'): boolean {
    if (!stack) return false;
    if (currentEnemyIntent) {
      return stack.stackId !== currentEnemyIntent.stackId && stack.stackId !== currentEnemyIntent.targetStackId;
    }
    if (playerFx) {
      const fx = stackFx(stack.stackId);
      return !fx.acting && !fx.hit && !fx.block && !fx.buff && !fx.debuff;
    }
    if (pending) {
      const selectable = isSelectable(stack, side);
      const chosen = stack.stackId === pending.actingStackId || stack.stackId === pending.targetStackId;
      return !selectable && !chosen;
    }
    return false;
  }

  function findPendingAttackEffect(): Extract<CardEffect, { kind: 'ATTACK' }> | undefined {
    if (!combat || !pending) return undefined;
    if (pending.kind === 'basic') {
      // A free basic attack behaves like a plain 1x ATTACK effect for preview purposes.
      return pending.targeting === 'basic-attack' ? { kind: 'ATTACK', multiplier: 1 } : undefined;
    }
    const cardId = combat.hand.find((c) => c.instanceId === pending.id)?.cardId;
    const def = cardId ? CARD_DEFINITIONS[cardId] : undefined;
    return def?.effects.find((e): e is Extract<CardEffect, { kind: 'ATTACK' }> => e.kind === 'ATTACK');
  }

  function previewDamageFor(stack: ArmyStack | undefined, side: 'player' | 'enemy'): number | undefined {
    if (!combat || !stack) return undefined;
    if (pending) {
      if (side !== 'enemy' || !isSelectable(stack, 'enemy')) return undefined;
      const attackEffect = findPendingAttackEffect();
      if (!attackEffect || !pending.actingStackId) return undefined;
      const attacker = combat.playerArmy.find((s) => s.stackId === pending.actingStackId);
      if (!attacker) return undefined;
      return previewAttackDamage(combat, attacker, stack, attackEffect);
    }
    return undefined;
  }

  if (appStage === 'title') {
    return (
      <>
        <TitleScreen
          onStart={() => {
            startMusic();
            setAppStage('setup');
          }}
          onContinue={
            hasSave
              ? () => {
                  startMusic();
                  setAppStage('game');
                }
              : undefined
          }
          onSettings={() => setTitleSettingsOpen(true)}
        />
        {titleSettingsOpen && (
          <SettingsPanel volume={musicVolume} onVolumeChange={changeMusicVolume} onClose={() => setTitleSettingsOpen(false)} />
        )}
      </>
    );
  }

  if (appStage === 'setup') {
    return (
      <CommanderSetupScreen
        onBack={() => setAppStage('title')}
        onBegin={(heroId, heroName, relicId) => {
          const freshRun = createRun(Date.now() & 0xffffffff, heroId, heroName);
          const result = applyRunAction(freshRun, { type: 'CHOOSE_STARTING_RELIC', relicId });
          setRun(result.run);
          setHasSave(true);
          setAppStage('game');
        }}
      />
    );
  }

  const toastLayer = <ToastStack toasts={toasts} onDismiss={dismissToast} />;
  const menuButton = (
    <button className="pause-menu-btn" onClick={() => setMenuOpen(true)} title="Menu">
      ☰
    </button>
  );
  const pauseMenuOverlay = menuOpen ? (
    <PauseMenu
      onClose={() => setMenuOpen(false)}
      onMainMenu={() => {
        setMenuOpen(false);
        setAppStage('title');
      }}
      volume={musicVolume}
      onVolumeChange={changeMusicVolume}
    />
  ) : null;
  const gameChrome = (
    <>
      {toastLayer}
      {menuButton}
      {pauseMenuOverlay}
    </>
  );
  // Road and Battle have their own in-layout Menu button, so the floating corner one is redundant there.
  const gameChromeNoMenuBtn = (
    <>
      {toastLayer}
      {pauseMenuOverlay}
    </>
  );

  if (run.phase === 'choosing_starting_relic') {
    return (
      <>
        {gameChrome}
        <StartingRelicScreen
          heroName={run.hero.name}
          onChoose={(relicId) => dispatchRun({ type: 'CHOOSE_STARTING_RELIC', relicId })}
        />
      </>
    );
  }

  if (run.phase === 'reward' && run.pendingReward) {
    return (
      <>
        {gameChrome}
        <RewardScreen
          reward={run.pendingReward}
          onClaimCard={(cardId) => dispatchRun({ type: 'CLAIM_CARD', cardId })}
          onClaimUpgrade={(instanceId) => dispatchRun({ type: 'CLAIM_UPGRADE', instanceId })}
          onConfirm={() => dispatchRun({ type: 'CONFIRM_REWARD' })}
        />
      </>
    );
  }

  if (run.phase === 'run_complete' || run.phase === 'defeat') {
    return (
      <>
        {gameChrome}
        <RunEndScreen run={run} onNewRun={newRun} />
      </>
    );
  }

  if (run.phase === 'on_map') {
    return (
      <>
        {gameChromeNoMenuBtn}
        <WorldMapScreen
          run={run}
          onMoveTo={(nodeId) => dispatchRun({ type: 'MOVE_TO', nodeId })}
          onEnterCity={() => dispatchRun({ type: 'ENTER_CITY' })}
          onOpenMenu={() => setMenuOpen(true)}
          onSplitStack={(stackId, splitCount) => dispatchRun({ type: 'SPLIT_STACK', stackId, splitCount })}
          onMergeStacks={(stackIdA, stackIdB) => dispatchRun({ type: 'MERGE_STACKS', stackIdA, stackIdB })}
          onMoveStack={(stackId, toPosition) => dispatchRun({ type: 'MOVE_STACK', stackId, toPosition })}
        />
      </>
    );
  }

  if (run.phase === 'city') {
    return (
      <>
        {gameChromeNoMenuBtn}
        <CityScreen
          city={run.city}
          gold={run.gold}
          food={run.food}
          hero={run.hero}
          army={run.army}
          relics={run.relics}
          log={run.log}
          onRecruit={(unitId, count) => dispatchRun({ type: 'RECRUIT', unitId, count })}
          onBuild={(buildingId) => dispatchRun({ type: 'BUILD_BUILDING', buildingId })}
          onUpgradeCity={() => dispatchRun({ type: 'UPGRADE_CITY' })}
          onChooseDoctrine={(doctrineId) => dispatchRun({ type: 'CHOOSE_DOCTRINE', doctrineId })}
          onOpenMenu={() => setMenuOpen(true)}
          onLeave={() => dispatchRun({ type: 'LEAVE_CITY' })}
          onSplitStack={(stackId, splitCount) => dispatchRun({ type: 'SPLIT_STACK', stackId, splitCount })}
          onMergeStacks={(stackIdA, stackIdB) => dispatchRun({ type: 'MERGE_STACKS', stackIdA, stackIdB })}
          onMoveStack={(stackId, toPosition) => dispatchRun({ type: 'MOVE_STACK', stackId, toPosition })}
        />
      </>
    );
  }

  if (run.phase === 'event' && run.pendingEvent) {
    return (
      <>
        {gameChrome}
        <EventScreen
          eventId={run.pendingEvent.eventId}
          onChoose={(optionId) => dispatchRun({ type: 'CHOOSE_EVENT_OPTION', optionId })}
        />
      </>
    );
  }

  if (run.phase === 'merchant' && run.pendingMerchant) {
    return (
      <>
        {gameChrome}
        <MerchantScreen
          gold={run.gold}
          inventory={run.pendingMerchant}
          onBuyCard={(cardId) => dispatchRun({ type: 'BUY_CARD', cardId })}
          onBuyRelic={(relicId) => dispatchRun({ type: 'BUY_RELIC', relicId })}
          onLeave={() => dispatchRun({ type: 'LEAVE_MERCHANT' })}
        />
      </>
    );
  }

  if (!combat) {
    return <div>Loading…</div>;
  }

  const front = [1, 2, 3] as const;
  const back = [4, 5, 6] as const;
  const combatHistory = combat.log.map((e) => describeEvent(combat, e)).filter((line): line is string => line !== null);
  const manaPct = combat.hero.maxMana > 0 ? Math.min(100, (combat.hero.mana / combat.hero.maxMana) * 100) : 0;
  const inspectedStack = [...combat.playerArmy, ...combat.enemyArmy].find((s) => s.stackId === inspectStackId && s.count > 0);
  const canAct = combat.phase === 'player' && combat.result === 'ongoing' && !enemyAnimQueue && !playerFx && !flyingCard;

  return (
    <div className="disciples-frame">
      {gameChromeNoMenuBtn}

      <span className="frame-ornament corner-tl" aria-hidden="true">
        🐉
      </span>
      <span className="frame-ornament corner-tr" aria-hidden="true">
        🐉
      </span>

      <div className="frame-topbar">
        <div className="frame-hero-chip">
          <div className="hero-portrait">🤴</div>
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
          </div>
        </div>

        <div className="frame-turn-chip">
          <strong>Turn {combat.turnNumber}</strong>
          <span>{combat.phase === 'player' ? 'Your turn' : combat.phase === 'enemy' ? 'Enemy turn' : 'Battle over'}</span>
          <span>
            Hero HP {combat.hero.hp}/{combat.hero.maxHp}
          </span>
        </div>
      </div>

      <div className="frame-body">
        <div className="portrait-rail player-rail">
          <div className="portrait-col">
            {back.map((p) => {
              const s = stackAt(combat.playerArmy, p);
              return (
                <StackTile
                  key={`p-${p}`}
                  stack={s}
                  side="player"
                  selectable={isSelectable(s, 'player')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'player')}
                  fx={stackFx(s?.stackId)}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
                  previewDamage={previewDamageFor(s, 'player')}
                  onClick={() => onArmyStackClick(s, p, 'player')}
                  onInspect={() => s && setInspectStackId(s.stackId)}
                />
              );
            })}
          </div>
          <div className="portrait-col">
            {front.map((p) => {
              const s = stackAt(combat.playerArmy, p);
              return (
                <StackTile
                  key={`p-${p}`}
                  stack={s}
                  side="player"
                  selectable={isSelectable(s, 'player')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'player')}
                  fx={stackFx(s?.stackId)}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
                  previewDamage={previewDamageFor(s, 'player')}
                  onClick={() => onArmyStackClick(s, p, 'player')}
                  onInspect={() => s && setInspectStackId(s.stackId)}
                />
              );
            })}
          </div>
        </div>

        <div className="frame-scene">
          {pending?.targeting === 'none' && (
            <div className="drop-zone" onClick={() => finalize({})}>
              <div className="drop-zone-icon">🃏</div>
              <div className="drop-zone-label">{pending.kind === 'card' ? 'Drop Card' : 'Confirm'}</div>
            </div>
          )}
        </div>

        <div className="portrait-rail enemy-rail">
          <div className="portrait-col">
            {front.map((p) => {
              const s = stackAt(combat.enemyArmy, p);
              return (
                <StackTile
                  key={`e-${p}`}
                  stack={s}
                  side="enemy"
                  selectable={isSelectable(s, 'enemy')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'enemy')}
                  fx={stackFx(s?.stackId)}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
                  previewDamage={previewDamageFor(s, 'enemy')}
                  onClick={() => onArmyStackClick(s, p, 'enemy')}
                  onInspect={() => s && setInspectStackId(s.stackId)}
                />
              );
            })}
          </div>
          <div className="portrait-col">
            {back.map((p) => {
              const s = stackAt(combat.enemyArmy, p);
              return (
                <StackTile
                  key={`e-${p}`}
                  stack={s}
                  side="enemy"
                  selectable={isSelectable(s, 'enemy')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'enemy')}
                  fx={stackFx(s?.stackId)}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
                  previewDamage={previewDamageFor(s, 'enemy')}
                  onClick={() => onArmyStackClick(s, p, 'enemy')}
                  onInspect={() => s && setInspectStackId(s.stackId)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="frame-bottombar">
        <div className="frame-pile deck-pile" title={`Deck: ${combat.deck.length} cards`}>
          <div className="pile-card-back">🂠</div>
          <div className="pile-count">{combat.deck.length}</div>
          <div className="pile-label">Deck</div>
        </div>

        <div className="frame-hand-slots">
          {combat.hand.map((instance, i) => {
            const cardDef = CARD_DEFINITIONS[instance.cardId];
            if (!cardDef) return null;
            const isPlayed = playedInstanceId === instance.instanceId;
            const isDiscarding = discardingIds?.includes(instance.instanceId) ?? false;
            const isDrawing = drawingIds.has(instance.instanceId);
            const slotStyle = { '--stagger': `${i * 40}ms` } as React.CSSProperties;
            const slotClass = ['hand-card-slot', isPlayed && 'played', isDiscarding && 'discarding', isDrawing && 'drawing']
              .filter(Boolean)
              .join(' ');
            return (
              <div key={instance.instanceId} className={slotClass} style={slotStyle} data-instance-id={instance.instanceId}>
                <ActionCardTile
                  id={cardDef.id}
                  name={cardDef.name}
                  description={CARD_DESCRIPTIONS[cardDef.id] ?? cardDef.id}
                  manaCost={cardDef.manaCost}
                  affordable={canAct && hasResource(cardDef.id)}
                  pending={pending?.kind === 'card' && pending.id === instance.instanceId}
                  onClick={() => handleCardClick(instance.instanceId, instance.cardId)}
                />
              </div>
            );
          })}
        </div>

        <div className="frame-pile discard-pile" title={`Discard: ${combat.discard.length} cards`}>
          <div className="pile-card-back discard">🂠</div>
          <div className="pile-count">{combat.discard.length}</div>
          <div className="pile-label">Discard</div>
        </div>

        <div className="frame-round-buttons">
          <button className="round-btn round-btn-main" disabled={!canAct} onClick={handleEndTurn} title="End Turn">
            ⚔️
          </button>
          <button className="round-btn" onClick={() => setHistoryOpen(true)} title="Battle Log">
            📜
          </button>
          <button className="round-btn" onClick={() => setMenuOpen(true)} title="Menu">
            ⚙️
          </button>
        </div>
      </div>

      {flyingCard && <FlyingCard card={flyingCard} />}
      {inspectedStack && (
        <UnitPopup
          stack={inspectedStack}
          army={combat.playerArmy.includes(inspectedStack) ? combat.playerArmy : combat.enemyArmy}
          inBattle
          onClose={() => setInspectStackId(null)}
        />
      )}

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Battle Log (Deck ${combat.deck.length} · Discard ${combat.discard.length} · Exhausted ${combat.exhausted.length})`}
        lines={combatHistory}
      />
    </div>
  );
}
