import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_DEFINITIONS, UNIT_DEFINITIONS, computeValidHealTargets, computeValidTargets } from './engine/index.js';
import type { ArmyStack, CardEffect, CardTargeting, EnemyIntent, PlayerAction, Position } from './engine/index.js';
import { applyRunAction, createRun } from './engine/run/index.js';
import type { RunEvent, RunState } from './engine/run/index.js';
import { StackTile } from './ui/StackTile.js';
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
  const [hoveredStackId, setHoveredStackId] = useState<string | null>(null);
  const [droppingInstanceId, setDroppingInstanceId] = useState<string | null>(null);
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
      dispatchCombat({ type: 'END_TURN' });
      setEnemyAnimQueue(null);
      setEnemyAnimIndex(0);
      return;
    }
    const t = setTimeout(() => setEnemyAnimIndex((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [enemyAnimQueue, enemyAnimIndex]);

  const combat = run.combat;
  const currentEnemyIntent = enemyAnimQueue ? enemyAnimQueue[enemyAnimIndex] : null;

  function handleEndTurn() {
    if (!combat) return;
    if (combat.enemyIntents.length === 0) {
      dispatchCombat({ type: 'END_TURN' });
      return;
    }
    setEnemyAnimIndex(0);
    setEnemyAnimQueue(combat.enemyIntents);
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

  const intentByStack = useMemo(() => {
    const map = new Map<string, EnemyIntent>();
    for (const intent of combat?.enemyIntents ?? []) map.set(intent.stackId, intent);
    return map;
  }, [combat?.enemyIntents]);

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
    dispatchRun({ type: 'COMBAT_ACTION', action });
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
    if (!pending || !combat) return;
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
    if (hasFx) {
      setPlayerFx(fx);
      setTimeout(() => {
        setPlayerFx(null);
        dispatchNow();
      }, 420);
    } else {
      dispatchNow();
    }
  }

  function handleDropZoneConfirm() {
    if (!pending) return;
    if (pending.kind === 'card') {
      setDroppingInstanceId(pending.id);
      setTimeout(() => {
        finalize({});
        setDroppingInstanceId(null);
      }, 360);
    } else {
      finalize({});
    }
  }

  function handleStackClick(stack: ArmyStack | undefined, position: Position, side: 'player' | 'enemy') {
    if (!pending) return;
    const alive = !!stack && stack.count > 0;
    const { targeting } = pending;

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
    if (side === 'player' && stack && stack.count > 0 && !stack.actedThisTurn && canAct) {
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
      return !stack.actedThisTurn && canAct;
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

  /** Hovering my own unit highlights the enemy that intends to hit it, and vice versa; everything else fades. */
  function hoverHighlightSet(): Set<string> | null {
    if (!combat || pending || !hoveredStackId) return null;
    const set = new Set([hoveredStackId]);
    for (const intent of combat.enemyIntents) {
      if (intent.kind !== 'attack') continue;
      if (intent.targetStackId === hoveredStackId) set.add(intent.stackId);
      if (intent.stackId === hoveredStackId && intent.targetStackId) set.add(intent.targetStackId);
    }
    return set;
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
    const highlight = hoverHighlightSet();
    return highlight !== null && !highlight.has(stack.stackId);
  }

  function isThreatened(stack: ArmyStack | undefined): boolean {
    if (!combat || !stack) return false;
    return combat.enemyIntents.some((i) => i.kind === 'attack' && i.targetStackId === stack.stackId);
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
    if (side === 'player' && hoveredStackId === stack.stackId) {
      const intent = combat.enemyIntents.find((i) => i.kind === 'attack' && i.targetStackId === stack.stackId);
      return intent?.estimatedDamage;
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
          onClaimRelic={(relicId) => dispatchRun({ type: 'CLAIM_RELIC', relicId })}
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
        {gameChrome}
        <WorldMapScreen
          run={run}
          onMoveTo={(nodeId) => dispatchRun({ type: 'MOVE_TO', nodeId })}
          onEnterCity={() => dispatchRun({ type: 'ENTER_CITY' })}
          onNewRun={newRun}
          onSplitStack={(stackId, splitCount) => dispatchRun({ type: 'SPLIT_STACK', stackId, splitCount })}
          onMergeStacks={(stackIdA, stackIdB) => dispatchRun({ type: 'MERGE_STACKS', stackIdA, stackIdB })}
        />
      </>
    );
  }

  if (run.phase === 'city') {
    return (
      <>
        {gameChrome}
        <CityScreen
          city={run.city}
          gold={run.gold}
          food={run.food}
          hero={run.hero}
          army={run.army}
          onRecruit={(unitId, count, destination) => dispatchRun({ type: 'RECRUIT', unitId, count, destination })}
          onBuild={(buildingId) => dispatchRun({ type: 'BUILD_BUILDING', buildingId })}
          onUpgradeCity={() => dispatchRun({ type: 'UPGRADE_CITY' })}
          onChooseDoctrine={(doctrineId) => dispatchRun({ type: 'CHOOSE_DOCTRINE', doctrineId })}
          onTransferToArmy={(stackId) => dispatchRun({ type: 'TRANSFER_GARRISON_TO_ARMY', stackId })}
          onLeave={() => dispatchRun({ type: 'LEAVE_CITY' })}
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
  const canAct = combat.phase === 'player' && combat.result === 'ongoing' && !enemyAnimQueue && !playerFx;
  const handCount = combat.hand.length;
  const handMid = (handCount - 1) / 2;

  return (
    <div className="battle-viewport">
      {gameChrome}

      <div className="battle-header">
        <div className="hero-column">
          <div className="hero-card">
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
        </div>

        <div className="turn-info">
          <div className="turn-badge-inline">
            <div>
              <strong>Turn {combat.turnNumber}</strong>
            </div>
            <div>{combat.phase === 'player' ? 'Your turn' : combat.phase === 'enemy' ? 'Enemy turn' : 'Battle over'}</div>
            <div>
              Hero HP {combat.hero.hp}/{combat.hero.maxHp}
            </div>
          </div>
          <button className="history-toggle-btn" onClick={() => setHistoryOpen(true)}>
            📜 Log
          </button>
        </div>
      </div>

      <div className="battlefield-v2">
        <div className="side-columns player-side">
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
                  dimmed={isDimmed(s, 'player')}
                  fx={stackFx(s?.stackId)}
                  threatened={isThreatened(s)}
                  previewDamage={previewDamageFor(s, 'player')}
                  onClick={() => onArmyStackClick(s, p, 'player')}
                  onHoverStart={() => s && setHoveredStackId(s.stackId)}
                  onHoverEnd={() => setHoveredStackId(null)}
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
                  dimmed={isDimmed(s, 'player')}
                  fx={stackFx(s?.stackId)}
                  threatened={isThreatened(s)}
                  previewDamage={previewDamageFor(s, 'player')}
                  onClick={() => onArmyStackClick(s, p, 'player')}
                  onHoverStart={() => s && setHoveredStackId(s.stackId)}
                  onHoverEnd={() => setHoveredStackId(null)}
                />
              );
            })}
          </div>
        </div>

        <div className="side-columns enemy-side">
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
                  dimmed={isDimmed(s, 'enemy')}
                  fx={stackFx(s?.stackId)}
                  previewDamage={previewDamageFor(s, 'enemy')}
                  onClick={() => onArmyStackClick(s, p, 'enemy')}
                  onHoverStart={() => s && setHoveredStackId(s.stackId)}
                  onHoverEnd={() => setHoveredStackId(null)}
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
                  dimmed={isDimmed(s, 'enemy')}
                  fx={stackFx(s?.stackId)}
                  previewDamage={previewDamageFor(s, 'enemy')}
                  onClick={() => onArmyStackClick(s, p, 'enemy')}
                  onHoverStart={() => s && setHoveredStackId(s.stackId)}
                  onHoverEnd={() => setHoveredStackId(null)}
                />
              );
            })}
          </div>
        </div>

        {pending?.targeting === 'none' && (
          <div className="drop-zone" onClick={handleDropZoneConfirm}>
            <div className="drop-zone-icon">🃏</div>
            <div className="drop-zone-label">{pending.kind === 'card' ? 'Drop Card' : 'Confirm'}</div>
          </div>
        )}
      </div>

      <div className="hand-fan-wrap">
        <div className="hand-fan">
          {combat.hand.map((instance, i) => {
            const cardDef = CARD_DEFINITIONS[instance.cardId];
            if (!cardDef) return null;
            const offset = i - handMid;
            const rotate = Math.max(-11, Math.min(11, offset * 5));
            const ty = Math.abs(offset) * 3;
            const slotStyle = { '--rot': `${rotate}deg`, '--ty': `${ty}px` } as React.CSSProperties;
            const isDropping = droppingInstanceId === instance.instanceId;
            return (
              <div key={instance.instanceId} className={`hand-card-slot${isDropping ? ' dropping' : ''}`} style={slotStyle}>
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
      </div>

      <button className="end-turn-fab" disabled={!canAct} onClick={handleEndTurn}>
        ⚔️ End Turn
      </button>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Battle Log (Deck ${combat.deck.length} · Discard ${combat.discard.length} · Exhausted ${combat.exhausted.length})`}
        lines={combatHistory}
      />
    </div>
  );
}
