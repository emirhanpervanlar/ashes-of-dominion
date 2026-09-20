import { useState } from 'react';
import type { Position } from '../engine/index.js';
import { LEVEL_SLOTS, bossWarning, dailyFoodNet, daysUntilBoss, foodWarning, starvationForecast } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { ArmyGrid } from './ArmyGrid.js';
import { FoodPopup } from './FoodPopup.js';
import { HistoryDrawer } from './HistoryDrawer.js';
import { HERO_ICONS } from './heroIcons.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';
import { describeRunEvent } from './runEventText.js';
import { UnitPopup } from './UnitPopup.js';

const RELIC_GRID_SLOTS = 15;

interface Props {
  run: RunState;
  /** City only: the Leave button under the resources, and Slots instead of Threat/Day/Boss. */
  onLeave?: () => void;
  recentRecruit?: { unitId: string; amount: number } | null;
  onOpenMenu: () => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onSplitStack: (stackId: string, splitCount: number) => void;
  onMergeStacks: (stackIdA: string, stackIdB: string) => void;
  onDismissStack: (stackId: string, count?: number) => void;
}

/** The bottom bar shared by Road and City (AO-D010/D016): resources | hero | army 3x2 | Log + Menu. */
export function GarrisonBar({ run, onLeave, recentRecruit, onOpenMenu, onMoveStack, onSplitStack, onMergeStacks, onDismissStack }: Props) {
  const [popupStackId, setPopupStackId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const { hero, relics, army, city } = run;
  const popupStack = popupStackId ? army.find((s) => s.stackId === popupStackId && s.count > 0) ?? null : null;
  const historyLines = run.log.map(describeRunEvent).filter((line): line is string => line !== null);

  const net = dailyFoodNet(run);
  const foodBad = foodWarning(run);
  const starving = starvationForecast(run).willStarve;
  const warning = bossWarning(run);
  const inCity = !!onLeave;

  return (
    <>
      <div className="garrison-bar">
        <div className="garrison-bar-col garrison-bar-resources">
          <div className="garrison-bar-row">
            <div className="pill pill--gold garrison-bar-stat" title="Gold">
              <Icon name="gold" /> {run.gold}
            </div>
            {inCity ? (
              <div className="pill garrison-bar-stat" title="Building slots used">
                <Icon name="slots" /> {city.buildings.length}/{LEVEL_SLOTS[city.level]}
              </div>
            ) : (
              <div className="pill garrison-bar-stat pill--threat" title={`Threat ${run.threat}: enemies are stronger with every city visit.`}>
                <Icon name="threat" /> {run.threat}
              </div>
            )}
          </div>
          <button
            className={`pill garrison-bar-stat garrison-food${foodBad ? ' pill--danger' : ''}`}
            onClick={() => setFoodOpen(true)}
            title="Food: click for the daily breakdown"
          >
            <Icon name="food" /> {run.food}
            <span className="garrison-food-net">{net > 0 ? `+${net}` : net}/day</span>
            {starving && <Icon name="ui_warn" />}
          </button>
          {inCity ? (
            <button className="btn btn--danger btn--s" onClick={onLeave}>
              Leave
            </button>
          ) : (
            <>
              <div className="garrison-bar-row">
                <div className="pill garrison-bar-stat" title="Day">
                  <Icon name="day" /> Day {run.day}
                </div>
                <div className="pill garrison-bar-stat" title="Chapter">
                  Ch. {run.chapter}/3
                </div>
              </div>
              <div className={`pill garrison-bar-stat garrison-boss${warning ? ' pill--boss-warning' : ''}`} title="The boss waits at the end of the chapter">
                <Icon name="node_boss" /> Boss in {daysUntilBoss(run)} {daysUntilBoss(run) === 1 ? 'day' : 'days'}
              </div>
            </>
          )}
        </div>

        <div className="garrison-bar-col garrison-bar-hero">
          <div className="plaque plaque--iron garrison-hero-plaque">{hero.name}</div>
          <div className="garrison-hero-portrait-rect">
            <Icon name={HERO_ICONS[hero.heroType]} size={2} />
          </div>
          <div className="garrison-relic-grid">
            {Array.from({ length: RELIC_GRID_SLOTS }).map((_, i) => {
              const r = relics[i];
              return r ? (
                <span key={r.id} className="garrison-relic-cell" title={`${r.name} — ${r.description}`}>
                  <Icon name={relicIcon(r.id)} />
                </span>
              ) : (
                <span key={`empty-relic-${i}`} className="garrison-relic-cell empty" />
              );
            })}
          </div>
        </div>

        <div className="garrison-bar-main">
          <ArmyGrid army={army} recentRecruit={recentRecruit} onMoveStack={onMoveStack} onInspect={setPopupStackId} />
        </div>

        <div className="garrison-bar-actions">
          <button className="btn garrison-bar-btn" onClick={() => setHistoryOpen(true)} title="History">
            <Icon name="ui_log" size={2} />
          </button>
          <button className="btn garrison-bar-btn" onClick={onOpenMenu} title="Menu">
            <Icon name="ui_menu" size={2} />
          </button>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="History" lines={historyLines} />
      {foodOpen && <FoodPopup run={run} onClose={() => setFoodOpen(false)} />}

      {popupStack && (
        <UnitPopup
          stack={popupStack}
          army={army}
          onClose={() => setPopupStackId(null)}
          onSplit={onSplitStack}
          onMerge={onMergeStacks}
          onDismiss={onDismissStack}
        />
      )}
    </>
  );
}
