import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_DEFINITIONS, UNIT_DEFINITIONS, applyPlayerAction, computeValidHealTargets, computeValidTargets } from './engine/index.js';
import type { ArmyStack, CardTargeting, CombatState, PlayerAction, Position } from './engine/index.js';
import { applyRunAction, cardRemovalQuote, createRun, enemyStrengthAfterCityVisits, eventView, migrateRun } from './engine/run/index.js';
import type { RunEvent, RunState } from './engine/run/index.js';
import { StackTile } from './ui/StackTile.js';
import { UnitPopup } from './ui/UnitPopup.js';
import { FlyingCard } from './ui/FlyingCard.js';
import type { FlyingCardState } from './ui/FlyingCard.js';
import { floatersFromCues, useFloatingText } from './ui/FloatingText.js';
import { cuesFromEvents, enemyPhaseBoard, replayEnemySteps, replayMismatches } from './ui/battleCues.js';
import { playCues, playEnemySteps } from './ui/battlePlayback.js';
import { useBattleFx, useStatusTransitions } from './ui/useBattleFx.js';
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
import { describeRunEvent } from './ui/runEventText.js';
import { relicIcon } from './ui/relicIcons.js';
import { HERO_ICONS } from './ui/heroIcons.js';
import { Icon } from './ui/pixel/Icon.js';
import type { IconName } from './ui/pixel/icons.js';
import { CARD_DESCRIPTIONS } from './ui/cardText.js';
import { HistoryDrawer } from './ui/HistoryDrawer.js';
import { ToastStack } from './ui/Toast.js';
import type { ToastItem } from './ui/Toast.js';
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

function loadInitialRun(): RunState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateRun(JSON.parse(raw) as RunState);
  } catch {
    // corrupted save — fall through to a fresh run
  }
  return createRun(Date.now() & 0xffffffff);
}

/** The Gold and Food of the most recent battle's loot, or null when there was none. */
function lastLoot(log: RunEvent[]): { gold: number; food: number } | null {
  const loot = [...log].reverse().find((e): e is Extract<RunEvent, { type: 'BATTLE_LOOT' }> => e.type === 'BATTLE_LOOT');
  return loot ? { gold: loot.gold, food: loot.food } : null;
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
  // The board shown while an animated sequence runs ahead of the run state (enemy turn playback, a battle-ending blow).
  const [playbackBoard, setPlaybackBoard] = useState<CombatState | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const fx = useBattleFx();
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
      if (hasSave) localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    } catch {
      // storage full/unavailable — non-fatal for a local playtest build
    }
  }, [run, hasSave]);

  // Set by the battle render only while Space may end the turn (nothing pending, no popup open); null everywhere else.
  const spaceEndTurn = useRef<(() => void) | null>(null);
  spaceEndTurn.current = null;
  // Set by the render only while the enemy turn is being replayed: Space or a click skips to its end.
  const skipPlayback = useRef<(() => void) | null>(null);
  skipPlayback.current = null;

  useEffect(() => {
    function typing(t: EventTarget | null): boolean {
      return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPending(null);
      if (e.code === 'Space' && !e.repeat && !typing(e.target) && (skipPlayback.current ?? spaceEndTurn.current)) {
        e.preventDefault();
        (skipPlayback.current ?? spaceEndTurn.current)?.();
      }
    }
    // A focused button would otherwise also "click" itself when Space is released.
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' && !typing(e.target) && document.activeElement instanceof HTMLButtonElement) e.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const combat = playbackBoard ?? run.combat;
  useStatusTransitions(fx, combat);

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

  /** Runs the enemy phase as a replay of the engine's steps, then lands on the engine's final state. */
  async function handleEndTurn() {
    if (!run.combat || fxBusy) return;
    const pre = run.combat;
    const leaving = pre.hand.filter((c) => !CARD_DEFINITIONS[c.cardId]?.retain).map((c) => c.instanceId);
    setFxBusy(true);
    setPending(null);
    fx.begin();
    if (leaving.length > 0) {
      setDiscardingIds(leaving);
      await fx.wait(320);
    }
    // The run layer does not hand back the enemy steps, so the same deterministic engine call is repeated for them.
    const played = applyPlayerAction(pre, { type: 'END_TURN' });
    const steps = played.enemySteps ?? [];
    const result = applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
    if (import.meta.env.DEV && result.run.combat) {
      const replayed = replayEnemySteps(pre, steps).at(-1) ?? enemyPhaseBoard(pre);
      const bad = replayMismatches(replayed, result.run.combat);
      if (bad.length > 0) console.error('Enemy playback diverged from the engine final state for', bad);
    }
    try {
      setPlaybackBoard(enemyPhaseBoard(pre));
      setDiscardingIds(null);
      await playEnemySteps({ fx, spawnFloaters }, enemyPhaseBoard(pre), steps, setPlaybackBoard);
    } finally {
      setPlaybackBoard(null);
      commitRun(result);
      if (result.run.combat) {
        const events = played.events;
        const tail = events.slice(events.findIndex((e) => e.type === 'ENEMY_TURN_RESOLVED') + 1);
        const dots = cuesFromEvents(tail, result.run.combat).filter((c) => c.kind === 'dot');
        dots.forEach((c) => fx.impact(c));
        spawnFloaters(floatersFromCues(dots));
      }
      setFxBusy(false);
    }
  }

  function pushToast(icon: IconName, text: string, ms?: number) {
    setToasts((t) => [...t, { id: nextToastId.current++, icon, text, ms }]);
  }

  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  /** Toasts for run events (resource gains, losses, milestones); the history drawer carries the full text via describeRunEvent. */
  function toastsForRunEvents(events: RunEvent[]) {
    for (const e of events) {
      const text = describeRunEvent(e);
      switch (e.type) {
        case 'RESOURCE_FOUND':
          pushToast('gold', `+${e.gold} Gold, +${e.food} Food`);
          break;
        case 'BATTLE_LOOT':
          pushToast('gold', text ?? 'Loot');
          break;
        case 'EVENT_RESOLVED':
          pushToast('fx_sparkle', text ?? 'Nothing happened.', 8000);
          break;
        case 'STARVED':
          pushToast('fx_skull', text ?? 'The army starved.', 6000);
          break;
        case 'UNITS_LOST':
          pushToast('fx_skull', text ?? 'Units lost.');
          break;
        case 'UNITS_GAINED':
        case 'UNITS_DISMISSED':
        case 'UNIT_GAIN_DECLINED':
          pushToast('crest', text ?? 'The army changed.');
          break;
        case 'CARD_REMOVED':
          pushToast('discard', text ?? 'Card removed.');
          break;
        case 'MAGE_TOWER_UPGRADED':
          pushToast('bld_mage_tower', text ?? 'Mage Tower upgraded.');
          break;
        case 'FARM_UPGRADED':
          pushToast('bld_farm', text ?? 'Farm upgraded.');
          break;
        case 'THREAT_CHANGED':
          pushToast('threat', text ?? 'Threat changed.');
          break;
        case 'BOSS_DEFEATED':
          pushToast('node_boss', text ?? 'Boss defeated.');
          break;
        case 'CHAPTER_STARTED':
          pushToast('day', text ?? 'A new chapter begins.');
          break;
        case 'ACTION_REJECTED':
          pushToast('ui_warn', e.reason);
          break;
      }
    }
  }

  function newRun() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable — the in-memory run is replaced below anyway
    }
    setRun(createRun(Date.now() & 0xffffffff));
    setPending(null);
    setHasSave(false);
    setAppStage('title');
  }

  /** Applies a computed run result: toasts for its events, then the new run state. */
  function commitRun(result: ReturnType<typeof applyRunAction>, action?: Parameters<typeof applyRunAction>[1]) {
    toastsForRunEvents(result.events);
    if (action?.type === 'LEAVE_CITY' && result.run.phase === 'on_map') {
      pushToast('threat', `Enemies grew stronger: Threat ${result.run.threat} (x${enemyStrengthAfterCityVisits(result.run).toFixed(2)} enemy strength).`);
    }
    setRun(result.run);
  }

  function dispatchRun(action: Parameters<typeof applyRunAction>[1]) {
    const result = applyRunAction(run, action);
    commitRun(result, action);
    return result;
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

  /**
   * Resolves the pending card / basic action. The engine result is computed at once; the effects derived from its events
   * (lunge, projectile, block ring...) play first, and the new state is shown at the moment of contact.
   */
  async function finalize(extra: { actingStackId?: string; targetStackId?: string; toPosition?: Position }) {
    if (!pending || !run.combat || flyingCard || fxBusy) return;
    const before = run.combat;
    const current = pending;
    const action: PlayerAction =
      current.kind === 'card'
        ? { type: 'PLAY_CARD', instanceId: current.id, ...extra }
        : { type: 'BASIC_ACTION', stackId: current.id, targetStackId: extra.targetStackId };
    const result = applyRunAction(run, { type: 'COMBAT_ACTION', action });
    const after = result.run.combat;
    setPending(null);
    // The engine rejects illegal actions with a reason in the combat log; surface it instead of failing silently.
    const events = after ? after.log.slice(before.log.length) : [];
    const rejected = events.find((e) => e.type === 'ACTION_REJECTED');
    if (!after || rejected) {
      if (rejected) pushToast('ui_warn', rejected.reason);
      commitRun(result);
      return;
    }
    const cardId = current.kind === 'card' ? before.hand.find((c) => c.instanceId === current.id)?.cardId : undefined;
    const cues = cuesFromEvents(events, after, cardId);
    const flying = current.kind === 'card' && launchCardFlight(current.id);
    // A blow that ends the battle keeps the battlefield on screen until its effects have played.
    const endsBattle = result.run.phase !== 'in_battle';
    let shown = false;
    setFxBusy(true);
    fx.begin();
    try {
      if (flying) await fx.wait(300);
      await playCues(
        { fx, spawnFloaters },
        cues,
        () => {
          shown = true;
          setFlyingCard(null);
          setPlayedInstanceId(null);
          if (endsBattle) setPlaybackBoard(after);
          else commitRun(result);
        },
        false,
      );
      if (endsBattle && shown) await fx.wait(700);
    } finally {
      setFlyingCard(null);
      setPlayedInstanceId(null);
      setPlaybackBoard(null);
      if (endsBattle || !shown) commitRun(result);
      setFxBusy(false);
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
    if (side === 'player' && stack && stack.count > 0 && !cannotAct(stack, side, combat?.playerArmy) && canAct) {
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
      return !cannotAct(stack, side, combat?.playerArmy) && canAct;
    }
    const alive = !!stack && stack.count > 0;
    const t = pending.targeting;
    if (t === 'basic-attack') {
      if (side !== 'enemy' || !alive || !combat) return false;
      const actor = combat.playerArmy.find((s) => s.stackId === pending.actingStackId);
      if (!actor) return false;
      const validTargets = computeValidTargets(actor, combat.enemyArmy, UNIT_DEFINITIONS[actor.unitId], combat.playerArmy);
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
        const validTargets = computeValidTargets(actor, combat.enemyArmy, UNIT_DEFINITIONS[actor.unitId], combat.playerArmy);
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
    if (!stack || !pending) return false;
    const selectable = isSelectable(stack, side);
    const chosen = stack.stackId === pending.actingStackId || stack.stackId === pending.targetStackId;
    return !selectable && !chosen;
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
    <button className="btn btn--sq pause-menu-btn" onClick={() => setMenuOpen(true)} title="Menu">
      <Icon name="ui_menu" />
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
          heroId={run.hero.heroType}
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
          loot={lastLoot(run.log)}
          isBoss={run.bossBattle}
          onClaimRelic={(relicId) => dispatchRun({ type: 'CLAIM_RELIC', relicId })}
          onClaimCard={(cardId) => dispatchRun({ type: 'CLAIM_CARD', cardId })}
          onClaimUpgrade={(instanceId) => dispatchRun({ type: 'CLAIM_UPGRADE', instanceId })}
          deck={run.masterDeck}
          removalQuote={cardRemovalQuote(run)}
          onRemoveCard={(instanceId) => dispatchRun({ type: 'REMOVE_CARD', instanceId })}
          onSkip={() => dispatchRun({ type: 'SKIP_REWARD' })}
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
          onEnterCity={() => dispatchRun({ type: 'TRAVEL_TO_CITY' })}
          onOpenMenu={() => setMenuOpen(true)}
          onSplitStack={(stackId, splitCount) => dispatchRun({ type: 'SPLIT_STACK', stackId, splitCount })}
          onMergeStacks={(stackIdA, stackIdB) => dispatchRun({ type: 'MERGE_STACKS', stackIdA, stackIdB })}
          onMoveStack={(stackId, toPosition) => dispatchRun({ type: 'MOVE_STACK', stackId, toPosition })}
          onDismissStack={(stackId, count) => dispatchRun({ type: 'DISMISS_STACK', stackId, count })}
        />
      </>
    );
  }

  if (run.phase === 'city') {
    return (
      <>
        {gameChromeNoMenuBtn}
        <CityScreen
          run={run}
          onRecruit={(unitId, count) => dispatchRun({ type: 'RECRUIT', unitId, count })}
          onBuild={(buildingId) => dispatchRun({ type: 'BUILD_BUILDING', buildingId })}
          onUpgradeCity={() => dispatchRun({ type: 'UPGRADE_CITY' })}
          onUpgradeMageTower={() => dispatchRun({ type: 'UPGRADE_MAGE_TOWER' })}
          onUpgradeFarm={() => dispatchRun({ type: 'UPGRADE_FARM' })}
          onRemoveCard={(instanceId) => dispatchRun({ type: 'REMOVE_CARD', instanceId })}
          onChooseDoctrine={(doctrineId) => dispatchRun({ type: 'CHOOSE_DOCTRINE', doctrineId })}
          onOpenMenu={() => setMenuOpen(true)}
          onLeave={() => dispatchRun({ type: 'LEAVE_CITY' })}
          onSplitStack={(stackId, splitCount) => dispatchRun({ type: 'SPLIT_STACK', stackId, splitCount })}
          onMergeStacks={(stackIdA, stackIdB) => dispatchRun({ type: 'MERGE_STACKS', stackIdA, stackIdB })}
          onMoveStack={(stackId, toPosition) => dispatchRun({ type: 'MOVE_STACK', stackId, toPosition })}
          onDismissStack={(stackId, count) => dispatchRun({ type: 'DISMISS_STACK', stackId, count })}
        />
      </>
    );
  }

  const pendingEventView = run.phase === 'event' ? eventView(run) : null;
  if (pendingEventView) {
    return (
      <>
        {gameChrome}
        <EventScreen
          view={pendingEventView}
          deck={run.masterDeck}
          army={run.army}
          newcomer={run.pendingUnitChoice?.newcomer ?? null}
          resolved={run.pendingEvent?.resolved ?? null}
          onChoose={(optionId) => dispatchRun({ type: 'CHOOSE_EVENT_OPTION', optionId })}
          onChooseCard={(instanceId) => dispatchRun({ type: 'CHOOSE_EVENT_CARD', instanceId })}
          onChooseUnit={(unitId) => dispatchRun({ type: 'CHOOSE_EVENT_UNIT', unitId })}
          onCancelChoice={() => dispatchRun({ type: 'CANCEL_EVENT_CHOICE' })}
          onDismissStack={(stackId, count) => dispatchRun({ type: 'DISMISS_STACK', stackId, count })}
          onDeclineGain={() => dispatchRun({ type: 'DECLINE_UNIT_GAIN' })}
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
          deck={run.masterDeck}
          removalQuote={cardRemovalQuote(run)}
          onRemoveCard={(instanceId) => dispatchRun({ type: 'REMOVE_CARD', instanceId })}
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
  const canAct = combat.phase === 'player' && combat.result === 'ongoing' && !playbackBoard && !fxBusy && !flyingCard;
  if (canAct && !pending && !menuOpen && !historyOpen && !inspectedStack) spaceEndTurn.current = handleEndTurn;
  if (playbackBoard) skipPlayback.current = fx.skip;

  /** Clicking bare battlefield (not a unit, the drop zone or End Turn) drops the selection and any pending card. */
  function onFieldClick(e: React.MouseEvent) {
    if (flyingCard || fxBusy) return;
    if ((e.target as HTMLElement).closest('.portrait-slot:not(.empty), .portrait-slot.selectable, .drop-zone, .endturn-bar')) return;
    setPending(null);
  }

  return (
    <div className="screen disciples-frame" data-screen="battle" onClick={() => skipPlayback.current?.()}>
      {gameChromeNoMenuBtn}

      <span className="frame-ornament corner-tl" aria-hidden="true">
        <Icon name="ornament_dragon" size={3} />
      </span>
      <span className="frame-ornament corner-tr" aria-hidden="true">
        <Icon name="ornament_dragon" size={3} />
      </span>

      <div className="frame-topbar">
        <div className="frame-hero-chip">
          <div className="hero-portrait">
            <Icon name={HERO_ICONS[run.hero.heroType]} size={2} />
          </div>
          <div className="hero-info">
            <div className="hero-name-row">
              <span>{combat.hero.name}</span>
              <div className="relic-icons">
                {run.relics.map((r) => (
                  <span key={r.id} className="relic-icon" title={`${r.name} — ${r.description}`}>
                    <Icon name={relicIcon(r.id)} />
                  </span>
                ))}
              </div>
            </div>
            <div className="mana-row">
              <span className="mana-label">Mana</span>
              <div className="mana-bar-track">
                <div className="mana-bar-fill" style={{ width: `${manaPct}%` }} />
              </div>
              <span className="mana-value">
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

      <div className="frame-body" onClick={onFieldClick}>
        <div className="portrait-rail player-rail">
          <div className="portrait-col">
            {back.map((p) => {
              const s = stackAt(combat.playerArmy, p);
              return (
                <StackTile
                  key={`p-${p}`}
                  stack={s}
                  side="player"
                  ownArmy={combat.playerArmy}
                  selectable={isSelectable(s, 'player')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'player')}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
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
                  ownArmy={combat.playerArmy}
                  selectable={isSelectable(s, 'player')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'player')}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
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
              <Icon name="deck" size={2} />
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
                  ownArmy={combat.enemyArmy}
                  selectable={isSelectable(s, 'enemy')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'enemy')}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
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
                  ownArmy={combat.enemyArmy}
                  selectable={isSelectable(s, 'enemy')}
                  selected={isSelected(s)}
                  dimmed={isDimmed(s, 'enemy')}
                  floaters={floaters.filter((f) => f.stackId === s?.stackId)}
                  onClick={() => onArmyStackClick(s, p, 'enemy')}
                  onInspect={() => s && setInspectStackId(s.stackId)}
                />
              );
            })}
          </div>
        </div>

        <div className="fx-layer" ref={fx.attach} aria-hidden="true" />

        <div className="endturn-bar shadowed-1">
          <button className="btn btn--primary btn--l endturn-btn" disabled={!canAct} onClick={handleEndTurn}>
            End Turn
          </button>
        </div>
      </div>

      <div className="frame-bottombar">
        <div className="frame-pile deck-pile" title={`Deck: ${combat.deck.length} cards`}>
          <div className="pile-card-back">
            <Icon name="deck" size={2} />
          </div>
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
          <div className="pile-card-back discard">
            <Icon name="discard" size={2} />
          </div>
          <div className="pile-count">{combat.discard.length}</div>
          <div className="pile-label">Discard</div>
        </div>

        <div className="frame-round-buttons">
          <button className="btn round-btn" onClick={() => setHistoryOpen(true)} title="Battle Log">
            <Icon name="ui_log" size={2} />
          </button>
          <button className="btn round-btn" onClick={() => setMenuOpen(true)} title="Menu">
            <Icon name="ui_menu" size={2} />
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
