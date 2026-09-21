import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_DEFINITIONS, UNIT_DEFINITIONS, cannotAct as engineCannotAct, cardPlayability, cardRequirement, computeValidHealTargets, computeValidTargets, resolveCard } from './engine/index.js';
import type { ArmyStack, CardTargeting, CombatState, PlayerAction, Position } from './engine/index.js';
import { applyRunAction, cardRemovalQuote, createRun, enemyStrengthAfterCityVisits, eventView } from './engine/run/index.js';
import type { RunEvent, RunState } from './engine/run/index.js';
import { useCardInfoHero } from './ui/cardInfoContext.js';
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
import { RewardScreen } from './ui/RewardScreen.js';
import { RunEndScreen } from './ui/RunEndScreen.js';
import { WorldMapScreen } from './ui/WorldMapScreen.js';
import { EventScreen } from './ui/EventScreen.js';
import { MerchantScreen } from './ui/MerchantScreen.js';
import { CityScreen } from './ui/CityScreen.js';
import { VillageScreen } from './ui/VillageScreen.js';
import { describeEvent } from './ui/eventText.js';
import { describeRunEvent } from './ui/runEventText.js';
import { relicIcon } from './ui/relicIcons.js';
import { HeroArt } from './ui/HeroArt.js';
import { Icon } from './ui/pixel/Icon.js';
import type { IconName } from './ui/pixel/icons.js';
import { HistoryDrawer } from './ui/HistoryDrawer.js';
import { DeckViewer } from './ui/DeckViewer.js';
import { HeroPopup } from './ui/HeroPopup.js';
import { Tip } from './ui/Tip.js';
import { TurnEffects } from './ui/TurnEffectsStrip.js';
import { cardBlockedTip, pileTip, relicTip } from './ui/tipContent.js';
import { ToastStack } from './ui/Toast.js';
import type { ToastItem } from './ui/Toast.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { HeroSetupScreen } from './ui/HeroSetupScreen.js';
import { PauseMenu } from './ui/PauseMenu.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { startMusic, setMusicVolume } from './ui/music.js';
import { Modal } from './ui/Modal.js';
import { STORAGE_KEY, loadSavedRun } from './ui/saveLoad.js';

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

/** The Gold and Food of the most recent battle's loot, or null when there was none. */
function lastLoot(log: RunEvent[]): { gold: number; food: number } | null {
  const loot = [...log].reverse().find((e): e is Extract<RunEvent, { type: 'BATTLE_LOOT' }> => e.type === 'BATTLE_LOOT');
  return loot ? { gold: loot.gold, food: loot.food } : null;
}

function stackAt(army: ArmyStack[], position: Position): ArmyStack | undefined {
  return army.find((s) => s.position === position);
}

export default function App() {
  // A save the engine's validator rejects (corrupt, or from a newer game) counts as no save: title screen, Continue disabled.
  const [savedRun] = useState(loadSavedRun);
  const [run, setRun] = useState<RunState>(() => savedRun ?? createRun(Date.now() & 0xffffffff));
  useCardInfoHero(run.hero.stats);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [playedInstanceId, setPlayedInstanceId] = useState<string | null>(null);
  const [inspectStackId, setInspectStackId] = useState<string | null>(null);
  const [pileOpen, setPileOpen] = useState<'draw' | 'discard' | null>(null);
  const [heroOpen, setHeroOpen] = useState(false);
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
  const [hasSave, setHasSave] = useState(savedRun !== null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const nextToastId = useRef(1);

  function changeMusicVolume(v: number) {
    setMusicVolumeState(v);
    setMusicVolume(v);
  }

  // Toasts about the run's last step must not linger over the end screens.
  useEffect(() => {
    if (run.phase === 'defeat' || run.phase === 'run_complete') setToasts([]);
  }, [run.phase]);

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
  // Set by the render only while an effect sequence (an action, the enemy turn replay) runs: Space or a click skips to its end.
  const skipPlayback = useRef<(() => void) | null>(null);
  skipPlayback.current = null;

  useEffect(() => {
    function typing(t: EventTarget | null): boolean {
      return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    }
    /** A control the player reached with the keyboard: Space then belongs to it (select, play, press), not to End Turn. */
    function controlHasKeyboardFocus(): boolean {
      const a = document.activeElement;
      return a instanceof HTMLElement && a !== document.body && a.matches(':focus-visible') && a.matches('button, [role="button"], a[href], input, select, textarea, [tabindex]');
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPending(null);
      if (e.code !== 'Space' || e.repeat || typing(e.target)) return;
      // Any open modal (card info, deck viewer, hero popup...) owns the keyboard.
      if (document.querySelector('.modal-layer')) return;
      if (skipPlayback.current) {
        e.preventDefault();
        skipPlayback.current();
      } else if (spaceEndTurn.current && !controlHasKeyboardFocus()) {
        e.preventDefault();
        spaceEndTurn.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    // AO-D067: with every enemy dead the button finishes the battle: no discard, no enemy turn, the engine resolves the victory.
    if (pre.enemiesCleared) {
      setPending(null);
      commitRun(applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }));
      return;
    }
    const leaving = pre.hand.filter((c) => !CARD_DEFINITIONS[c.cardId]?.retain).map((c) => c.instanceId);
    setFxBusy(true);
    setPending(null);
    fx.begin();
    if (leaving.length > 0) {
      setDiscardingIds(leaving);
      await fx.wait(320);
    }
    const result = applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
    const steps = result.enemySteps ?? [];
    if (import.meta.env.DEV && result.run.combat) {
      const replayed = replayEnemySteps(pre, steps).at(-1) ?? enemyPhaseBoard(pre);
      const bad = replayMismatches(replayed, result.run.combat);
      if (bad.length > 0) console.error('Enemy playback diverged from the engine final state for', bad);
    }
    try {
      setPlaybackBoard(enemyPhaseBoard(pre));
      setDiscardingIds(null);
      // A frozen (or held) enemy has no step to replay: say it skips its turn instead of going silent (AO-D066).
      spawnFloaters(
        pre.enemyArmy
          .filter((s) => s.count > 0 && engineCannotAct(s))
          .map((s) => ({ stackId: s.stackId, text: 'Skips turn', icon: 'st_freeze' as const, kind: 'status' as const, delayMs: 0 })),
      );
      await playEnemySteps({ fx, spawnFloaters }, enemyPhaseBoard(pre), steps, setPlaybackBoard);
    } finally {
      setPlaybackBoard(null);
      commitRun(result);
      if (result.run.combat) {
        const events = result.run.combat.log.slice(pre.log.length);
        const tail = events.slice(events.findIndex((e) => e.type === 'ENEMY_TURN_RESOLVED') + 1);
        const dots = cuesFromEvents(tail, pre, result.run.combat).filter((c) => c.kind === 'dot');
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
        // Gold and Food changes are not toasted: the reward screen shows the loot pills and the bar floats the change (resourceDeltas).
        case 'MINE_CAPTURED':
          pushToast('node_mine', text ?? 'Mine captured.', 6000);
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
        case 'UNITS_RAISED':
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
        case 'BARRACKS_UPGRADED':
          pushToast('bld_barracks', text ?? 'Barracks upgraded.');
          break;
        case 'GARRISON_GROWN':
        case 'GARRISON_COLLECTED':
          pushToast('garrison', text ?? 'The garrison changed.');
          break;
        case 'FOOD_PURCHASED':
          pushToast('bld_marketplace', text ?? 'Food bought.');
          break;
        case 'VILLAGE_RAIDED':
          pushToast('node_village', text ?? 'The village was raided.', 6000);
          break;
        case 'VILLAGE_HELPED':
          pushToast('node_village', text ?? 'The village was helped.', 8000);
          break;
        case 'RELIC_CLAIMED':
          pushToast('relic', text ?? 'Relic claimed.');
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

  /** Split, then move the new stack (the only id that did not exist before) to the slot the player chose. */
  function splitAndPlace(stackId: string, splitCount: number, toPosition: Position) {
    const split = applyRunAction(run, { type: 'SPLIT_STACK', stackId, splitCount });
    const known = new Set(run.army.map((s) => s.stackId));
    const created = split.run.army.find((s) => !known.has(s.stackId));
    if (!created) {
      commitRun(split);
      return;
    }
    const placed = applyRunAction(split.run, { type: 'MOVE_STACK', stackId: created.stackId, toPosition });
    commitRun({ ...placed, events: [...split.events, ...placed.events] });
  }

  /** Split, then merge the new stack (the only id that did not exist before) into a stack of the same unit type; nothing changes if the merge is refused. */
  function splitAndMerge(stackId: string, splitCount: number, targetStackId: string) {
    const split = applyRunAction(run, { type: 'SPLIT_STACK', stackId, splitCount });
    const known = new Set(run.army.map((s) => s.stackId));
    const created = split.run.army.find((s) => !known.has(s.stackId));
    if (!created) {
      commitRun(split);
      return;
    }
    const merged = applyRunAction(split.run, { type: 'MERGE_STACKS', stackIdA: targetStackId, stackIdB: created.stackId });
    const refused = merged.events.filter((e) => e.type === 'ACTION_REJECTED');
    if (refused.length > 0) {
      toastsForRunEvents(refused);
      return;
    }
    commitRun({ ...merged, events: [...split.events, ...merged.events] });
  }

  function handleCardClick(instanceId: string, cardId: string, upgraded: boolean) {
    if (!combat || combat.phase !== 'player' || combat.result !== 'ongoing') return;
    if (pending?.kind === 'card' && pending.id === instanceId) {
      setPending(null);
      return;
    }
    const cardDef = resolveCard(cardId, upgraded);
    if (!cardDef) return;
    // Says why a card cannot be played (AO-D040) instead of ignoring the click; nothing to say while an effect sequence runs.
    const playable = cardPlayability(cardId, combat, upgraded);
    if (!playable.playable) {
      if (!fxBusy && !flyingCard && playable.reason) pushToast('ui_warn', playable.reason);
      return;
    }
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
    const cues = cuesFromEvents(events, before, after, cardId);
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
    const upgraded = instance?.upgraded;
    const slot = document.querySelector(`[data-instance-id="${instanceId}"]`);
    const scene = document.querySelector('.frame-scene');
    if (!def || !slot || !scene) return false;
    const from = slot.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    setPlayedInstanceId(instanceId);
    setFlyingCard({
      cardId: def.id,
      upgraded,
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
            // A finished run (defeat / complete) has nothing left to lose, so only a run in progress asks.
            if (hasSave && run.phase !== 'defeat' && run.phase !== 'run_complete') {
              setConfirmAbandon(true);
              return;
            }
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
        {confirmAbandon && (
          <Modal
            heading="Abandon your current run?"
            onClose={() => setConfirmAbandon(false)}
            width={520}
            footer={
              <>
                <button className="btn" onClick={() => setConfirmAbandon(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    setConfirmAbandon(false);
                    startMusic();
                    setAppStage('setup');
                  }}
                >
                  Confirm
                </button>
              </>
            }
          >
            <p className="city-confirm-warning">Starting a new run replaces your saved run. It cannot be undone.</p>
          </Modal>
        )}
      </>
    );
  }

  if (appStage === 'setup') {
    return (
      <HeroSetupScreen
        onBack={() => setAppStage('title')}
        onBegin={(heroId, heroName, relicId) => {
          setRun(createRun(Date.now() & 0xffffffff, heroId, heroName, relicId));
          setHasSave(true);
          setAppStage('game');
        }}
      />
    );
  }

  const toastLayer = <ToastStack toasts={toasts} onDismiss={dismissToast} />;
  const menuButton = (
    <Tip tip="Menu">
      <button className="btn btn--sq pause-menu-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
        <Icon name="ui_menu" />
      </button>
    </Tip>
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

  if (run.phase === 'reward' && run.pendingReward) {
    return (
      <>
        {gameChrome}
        <RewardScreen
          reward={run.pendingReward}
          loot={lastLoot(run.log)}
          isBoss={run.bossBattle}
          isFort={!run.bossBattle && run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)?.type === 'fort'}
          onClaimRelic={(relicId) => dispatchRun({ type: 'CLAIM_RELIC', relicId })}
          onClaimCard={(cardId) => dispatchRun({ type: 'CLAIM_CARD', cardId })}
          onClaimUpgrade={(instanceId) => dispatchRun({ type: 'CLAIM_UPGRADE', instanceId })}
        />
      </>
    );
  }

  if (run.phase === 'run_complete' || run.phase === 'defeat') {
    return (
      <>
        {gameChromeNoMenuBtn}
        <RunEndScreen run={run} onNewRun={newRun} onMainMenu={() => setAppStage('title')} />
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
          onSplitStack={splitAndPlace}
          onSplitMerge={splitAndMerge}
          onMergeStacks={(keep, absorb) => dispatchRun({ type: 'MERGE_STACKS', stackIdA: keep, stackIdB: absorb })}
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
          onUpgradeBarracks={() => dispatchRun({ type: 'UPGRADE_BARRACKS' })}
          onCollectGarrison={(unitId) => dispatchRun({ type: 'COLLECT_GARRISON', unitId })}
          onBuyFood={(packs) => dispatchRun({ type: 'BUY_FOOD', packs })}
          onUpgradeCity={() => dispatchRun({ type: 'UPGRADE_CITY' })}
          onUpgradeMageTower={() => dispatchRun({ type: 'UPGRADE_MAGE_TOWER' })}
          onUpgradeFarm={() => dispatchRun({ type: 'UPGRADE_FARM' })}
          onRemoveCard={(instanceId) => dispatchRun({ type: 'REMOVE_CARD', instanceId })}
          onChooseDoctrine={(doctrineId) => dispatchRun({ type: 'CHOOSE_DOCTRINE', doctrineId })}
          onOpenMenu={() => setMenuOpen(true)}
          onLeave={() => dispatchRun({ type: 'LEAVE_CITY' })}
          onSplitStack={splitAndPlace}
          onSplitMerge={splitAndMerge}
          onMergeStacks={(keep, absorb) => dispatchRun({ type: 'MERGE_STACKS', stackIdA: keep, stackIdB: absorb })}
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

  if (run.phase === 'village' && run.pendingVillage) {
    return (
      <>
        {gameChrome}
        <VillageScreen
          offer={run.pendingVillage}
          gold={run.gold}
          food={run.food}
          threat={run.threat}
          helped={run.villages}
          onRaid={() => dispatchRun({ type: 'RAID_VILLAGE' })}
          onHelp={() => dispatchRun({ type: 'HELP_VILLAGE' })}
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
  if (fxBusy) skipPlayback.current = fx.skip;

  /** True while a card that needs no target is pending: the whole battlefield is its drop area. */
  const fieldArmed = pending?.kind === 'card' && pending.targeting === 'none';

  /** Clicking bare battlefield (not a unit or the drop zone) plays a pending no-target card, otherwise drops the selection. */
  function onFieldClick(e: React.MouseEvent) {
    if (flyingCard || fxBusy) return;
    if ((e.target as HTMLElement).closest('.portrait-slot:not(.empty), .portrait-slot.selectable, .drop-zone')) return;
    if (fieldArmed) finalize({});
    else setPending(null);
  }

  /** A dragged card may be dropped on a unit (same as clicking it) or, for a no-target card, anywhere on the field. */
  function onFieldDragOver(e: React.DragEvent) {
    if (pending?.kind === 'card' && !fxBusy && !flyingCard) e.preventDefault();
  }

  function onFieldDrop(e: React.DragEvent) {
    e.preventDefault();
    if (flyingCard || fxBusy) return;
    const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-stack-id]');
    const stack = slot ? [...combat!.playerArmy, ...combat!.enemyArmy].find((s) => s.stackId === slot.dataset.stackId) : undefined;
    if (stack && stack.count > 0) onArmyStackClick(stack, stack.position, stack.side);
    else if (fieldArmed) finalize({});
  }

  function onCardDragStart(instanceId: string, cardId: string, upgraded: boolean) {
    if (pending?.kind !== 'card' || pending.id !== instanceId) handleCardClick(instanceId, cardId, upgraded);
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
          <Tip tip="Hero stats">
            <button className="hero-portrait" aria-label="Hero stats" onClick={() => setHeroOpen(true)}>
              <HeroArt heroId={run.hero.heroType} />
            </button>
          </Tip>
          <div className="hero-info">
            <div className="hero-name-row">
              <span>{combat.hero.name}</span>
              <div className="relic-icons">
                {run.relics.map((r) => (
                  <Tip key={r.id} tip={relicTip(r, relicIcon(r.id))}>
                    <span className="relic-icon">
                      <Icon name={relicIcon(r.id)} />
                    </span>
                  </Tip>
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

        <TurnEffects army={combat.playerArmy} nextFriendlyAttackBonusPercent={combat.nextFriendlyAttackBonusPercent} />

        <div className="frame-turn-chip">
          <strong>Turn {combat.turnNumber}</strong>
          <span>{combat.phase === 'player' ? 'Your turn' : combat.phase === 'enemy' ? 'Enemy turn' : 'Battle over'}</span>
          <span>
            Hero HP {combat.hero.hp}/{combat.hero.maxHp}
          </span>
        </div>
      </div>

      <div className={`frame-body${fieldArmed ? ' field-armed' : ''}`} onClick={onFieldClick} onDragOver={onFieldDragOver} onDrop={onFieldDrop}>
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
          {combat.enemiesCleared && combat.result === 'ongoing' && <div className="battle-end-banner">All enemies fallen - heal up, then finish the battle</div>}
          {pending?.targeting === 'none' && (
            <div
              className="drop-zone"
              role="button"
              tabIndex={0}
              aria-label={pending.kind === 'card' ? 'Play card' : 'Confirm'}
              onClick={() => finalize({})}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                finalize({});
              }}
            >
              <Icon name="deck" size={2} />
              <div className="drop-zone-label">{pending.kind === 'card' ? 'Play Card' : 'Confirm'}</div>
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

      </div>

      <div className="frame-bottombar">
        <div className="frame-pile-container">
          <Tip tip={pileTip('draw', combat.deck.length)}>
            <button className="frame-pile deck-pile" aria-label={`Draw pile, ${combat.deck.length} cards`} onClick={() => setPileOpen('draw')}>
              <div className="pile-card-back">
                <Icon name="deck" size={2} />
              </div>
            </button>
          </Tip>
        </div>
        <div className="frame-hand-slots">
          {combat.hand.map((instance, i) => {
            const cardDef = resolveCard(instance.cardId, instance.upgraded);
            if (!cardDef) return null;
            const play = cardPlayability(instance.cardId, combat, instance.upgraded);
            const blocked = canAct && !play.playable;
            const isPlayed = playedInstanceId === instance.instanceId;
            const isDiscarding = discardingIds?.includes(instance.instanceId) ?? false;
            const isDrawing = drawingIds.has(instance.instanceId);
            const slotStyle = { '--stagger': `${i * 40}ms` } as React.CSSProperties;
            const slotClass = ['hand-card-slot', isPlayed && 'played', isDiscarding && 'discarding', isDrawing && 'drawing']
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={instance.instanceId}
                className={slotClass}
                style={slotStyle}
                data-instance-id={instance.instanceId}
                draggable={canAct && play.playable}
                onDragStart={() => onCardDragStart(instance.instanceId, instance.cardId, !!instance.upgraded)}
              >
                <ActionCardTile
                  id={cardDef.id}
                  upgraded={instance.upgraded}
                  affordable={canAct && play.playable}
                  conditionBlocked={blocked && combat.hero.mana >= cardDef.manaCost}
                  playability={combat.phase === 'player' ? play : undefined}
                  tip={blocked ? cardBlockedTip(cardDef.name, cardRequirement(instance.cardId), play.reason) : null}
                  pending={pending?.kind === 'card' && pending.id === instance.instanceId}
                  onClick={() => handleCardClick(instance.instanceId, instance.cardId, !!instance.upgraded)}
                />
              </div>
            );
          })}
        </div>

        <div className="frame-round-buttons">
          <div className="endturn-bar shadowed-1">
          <button className={`btn btn--primary btn--sq endturn-btn${combat.enemiesCleared ? ' endturn-btn--finish' : ''}`} disabled={!canAct} onClick={handleEndTurn}>
            {combat.enemiesCleared ? 'Finish Battle' : 'End Turn'}
          </button>
        </div>
        
        <div className="frame-pile-container">
          <Tip tip={pileTip('discard', combat.discard.length)}>
            <button className="frame-pile discard-pile" aria-label={`Discard pile, ${combat.discard.length} cards`} onClick={() => setPileOpen('discard')}>
              <div className="pile-card-back discard">
                <Icon name="discard" size={2} />
              </div>
            </button>
          </Tip>
        </div>
        <div className="frame-round-buttons-end">
            <Tip tip="Battle Log">
              <button className="btn round-btn" aria-label="Battle log" onClick={() => setHistoryOpen(true)}>
                <Icon name="ui_log" size={2} />
              </button>
            </Tip>
            <Tip tip="Menu">
              <button className="btn round-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
                <Icon name="ui_menu" size={2} />
              </button>
            </Tip>
          </div>
        </div>
      </div>

      {flyingCard && <FlyingCard card={flyingCard} />}
      {inspectedStack && (
        <UnitPopup
          stack={inspectedStack}
          army={combat.playerArmy.includes(inspectedStack) ? combat.playerArmy : combat.enemyArmy}
          inBattle
          team={combat.playerArmy.includes(inspectedStack) ? 'player' : 'enemy'}
          onClose={() => setInspectStackId(null)}
        />
      )}

      {heroOpen && <HeroPopup run={run} onClose={() => setHeroOpen(false)} />}
      {pileOpen && (
        <DeckViewer
          heading="Cards"
          initialTab={pileOpen}
          tabs={[
            { id: 'draw', label: 'Draw', cards: combat.deck, heading: `Draw pile - ${combat.deck.length}`, note: 'The order is hidden. Cards are listed by cost.' },
            { id: 'discard', label: 'Discard', cards: combat.discard, heading: `Discard pile - ${combat.discard.length}`, note: 'Reshuffled into the draw pile when it runs out.' },
            ...(combat.exhausted.length > 0
              ? [{ id: 'exhausted', label: 'Exhausted', cards: combat.exhausted, heading: `Exhausted - ${combat.exhausted.length}`, note: 'Gone for the rest of this battle.' }]
              : []),
          ]}
          onClose={() => setPileOpen(null)}
        />
      )}

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        heading={`Battle Log (Deck ${combat.deck.length} · Discard ${combat.discard.length} · Exhausted ${combat.exhausted.length})`}
        lines={combatHistory}
      />
    </div>
  );
}
