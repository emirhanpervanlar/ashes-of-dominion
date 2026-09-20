import { useState } from 'react';
import type { Position } from '../engine/index.js';
import { LEVEL_SLOTS, bossWarning, dailyFoodNet, daysUntilBoss, foodWarning, starvationForecast } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { ArmyGrid } from './ArmyGrid.js';
import type { PlacingSplit } from './ArmyGrid.js';
import { FoodPopup } from './FoodPopup.js';
import { HistoryDrawer } from './HistoryDrawer.js';
import { DeckViewer } from './DeckViewer.js';
import { polarityTabs } from './deckView.js';
import { HERO_ICONS } from './heroIcons.js';
import { HeroPopup } from './HeroPopup.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';
import { describeRunEvent } from './runEventText.js';
import { Tip } from './Tip.js';
import { bossTip, chapterTip, dayTip, foodTip, goldTip, relicTip, slotsTip, threatTip } from './tipContent.js';
import { UnitPopup } from './UnitPopup.js';

const RELIC_GRID_SLOTS = 15;

interface Props {
  run: RunState;
  /** City only: the Leave button under the resources, and Slots instead of Threat/Day/Boss. */
  onLeave?: () => void;
  /** City only: the Deck viewer links to card removal. */
  onOpenCardRemoval?: () => void;
  recentRecruit?: { unitId: string; amount: number } | null;
  onOpenMenu: () => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  /** Splits splitCount off the stack and puts the new stack on the empty slot toPosition. */
  onSplitStack: (stackId: string, splitCount: number, toPosition: Position) => void;
  /** The absorbed stack joins the kept one, which stays where it is. */
  onMergeStacks: (keepStackId: string, absorbStackId: string) => void;
  onDismissStack: (stackId: string, count?: number) => void;
}

/** The bottom bar shared by Road and City (AO-D010/D016): resources | hero | army 3x2 | Log + Menu. */
export function GarrisonBar({ run, onLeave, onOpenCardRemoval, recentRecruit, onOpenMenu, onMoveStack, onSplitStack, onMergeStacks, onDismissStack }: Props) {
  const [popupStackId, setPopupStackId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [heroOpen, setHeroOpen] = useState(false);
  const [placing, setPlacing] = useState<PlacingSplit | null>(null);
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
            <Tip tip={goldTip(run)}>
              <div className="pill pill--gold garrison-bar-stat">
                <Icon name="gold" /> {run.gold}
              </div>
            </Tip>
            {inCity ? (
              <Tip tip={slotsTip(run)}>
                <div className="pill garrison-bar-stat">
                  <Icon name="slots" /> {city.buildings.length}/{LEVEL_SLOTS[city.level]}
                </div>
              </Tip>
            ) : (
              <Tip tip={threatTip(run)}>
                <div className="pill garrison-bar-stat pill--threat">
                  <Icon name="threat" /> {run.threat}
                </div>
              </Tip>
            )}
          </div>
          <Tip tip={foodTip(run)}>
            <button className={`pill garrison-bar-stat garrison-food${foodBad ? ' pill--danger' : ''}`} onClick={() => setFoodOpen(true)}>
              <Icon name="food" /> {run.food}
              <span className="garrison-food-net">{net > 0 ? `+${net}` : net}/day</span>
              {starving && <Icon name="ui_warn" />}
            </button>
          </Tip>
          {inCity ? (
            <button className="btn btn--danger btn--s" onClick={onLeave}>
              Leave
            </button>
          ) : (
            <>
              <div className="garrison-bar-row">
                <Tip tip={dayTip(run)}>
                  <div className="pill garrison-bar-stat">
                    <Icon name="day" /> Day {run.day}
                  </div>
                </Tip>
                <Tip tip={chapterTip(run)}>
                  <div className="pill garrison-bar-stat">Ch. {run.chapter}/3</div>
                </Tip>
              </div>
              <Tip tip={bossTip(run)}>
                <div className={`pill garrison-bar-stat garrison-boss${warning ? ' pill--boss-warning' : ''}`}>
                  <Icon name="node_boss" /> Boss in {daysUntilBoss(run)} {daysUntilBoss(run) === 1 ? 'day' : 'days'}
                </div>
              </Tip>
            </>
          )}
        </div>

        <div className="garrison-bar-col garrison-bar-hero">
          <div className="plaque plaque--iron garrison-hero-plaque">{hero.name}</div>
          <Tip tip="Hero stats">
            <button className="garrison-hero-portrait-rect" onClick={() => setHeroOpen(true)}>
              <Icon name={HERO_ICONS[hero.heroType]} size={2} />
            </button>
          </Tip>
          <div className="garrison-relic-grid">
            {Array.from({ length: RELIC_GRID_SLOTS }).map((_, i) => {
              const r = relics[i];
              return r ? (
                <Tip key={r.id} tip={relicTip(r, relicIcon(r.id))}>
                  <span className="garrison-relic-cell">
                    <Icon name={relicIcon(r.id)} />
                  </span>
                </Tip>
              ) : (
                <span key={`empty-relic-${i}`} className="garrison-relic-cell empty" />
              );
            })}
          </div>
        </div>

        <div className="garrison-bar-main">
          <ArmyGrid
            army={army}
            recentRecruit={recentRecruit}
            disabled={popupStack !== null || historyOpen || foodOpen || deckOpen || heroOpen}
            placing={placing}
            onMoveStack={onMoveStack}
            onMergeStacks={onMergeStacks}
            onPlaceSplit={(toPosition) => {
              if (placing) onSplitStack(placing.stackId, placing.count, toPosition);
              setPlacing(null);
            }}
            onCancelPlacing={() => setPlacing(null)}
            onInspect={setPopupStackId}
          />
        </div>

        <div className="garrison-bar-actions">
          <Tip tip="Deck">
            <button className="btn garrison-bar-btn" onClick={() => setDeckOpen(true)}>
              <Icon name="deck" size={2} />
            </button>
          </Tip>
          <Tip tip="History">
            <button className="btn garrison-bar-btn" onClick={() => setHistoryOpen(true)}>
              <Icon name="ui_log" size={2} />
            </button>
          </Tip>
          <Tip tip="Menu">
            <button className="btn garrison-bar-btn" onClick={onOpenMenu}>
              <Icon name="ui_menu" size={2} />
            </button>
          </Tip>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} heading="History" lines={historyLines} />
      {foodOpen && <FoodPopup run={run} onClose={() => setFoodOpen(false)} />}
      {heroOpen && <HeroPopup run={run} onClose={() => setHeroOpen(false)} />}
      {deckOpen && (
        <DeckViewer
          heading={`Your deck - ${run.masterDeck.length} cards`}
          tabs={polarityTabs(run.masterDeck)}
          footer={
            onOpenCardRemoval && (
              <button
                className="btn"
                onClick={() => {
                  setDeckOpen(false);
                  onOpenCardRemoval();
                }}
              >
                Remove a card
              </button>
            )
          }
          onClose={() => setDeckOpen(false)}
        />
      )}

      {popupStack && (
        <UnitPopup
          stack={popupStack}
          army={army}
          onClose={() => setPopupStackId(null)}
          onSplit={(stackId, count) => {
            setPlacing({ stackId, count });
            setPopupStackId(null);
          }}
          onMerge={onMergeStacks}
          onDismiss={onDismissStack}
        />
      )}
    </>
  );
}
