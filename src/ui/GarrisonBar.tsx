import { useState } from 'react';
import type { ArmyStack, HeroId, Position, RelicDefinition } from '../engine/index.js';
import type { RunEvent } from '../engine/run/index.js';
import { ArmyGrid } from './ArmyGrid.js';
import { HistoryDrawer } from './HistoryDrawer.js';
import { HERO_ICONS } from './heroIcons.js';
import { Icon } from './pixel/Icon.js';
import type { IconName } from './pixel/icons.js';
import { relicIcon } from './relicIcons.js';
import { describeRunEvent } from './runEventText.js';
import { UnitPopup } from './UnitPopup.js';

const RELIC_GRID_SLOTS = 15;

interface Props {
  /** Three rows, top-aligned; the third differs per screen (Road: day, City: building slots). */
  stats: { icon: IconName; text: string }[];
  /** City only: shown under the stats without shifting them. */
  onLeave?: () => void;
  hero: { name: string; heroType: HeroId };
  relics: RelicDefinition[];
  army: ArmyStack[];
  log: RunEvent[];
  recentRecruit?: { unitId: string; amount: number } | null;
  onOpenMenu: () => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onSplitStack: (stackId: string, splitCount: number) => void;
  onMergeStacks: (stackIdA: string, stackIdB: string) => void;
}

/** The bottom bar shared by Road and City (AO-D010/D016): resources | hero | army 3x2 | Log + Menu. */
export function GarrisonBar({ stats, onLeave, hero, relics, army, log, recentRecruit, onOpenMenu, onMoveStack, onSplitStack, onMergeStacks }: Props) {
  const [popupStackId, setPopupStackId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const popupStack = popupStackId ? army.find((s) => s.stackId === popupStackId && s.count > 0) ?? null : null;
  const historyLines = log.map(describeRunEvent).filter((line): line is string => line !== null);

  return (
    <>
      <div className="garrison-bar">
        <div className="garrison-bar-col garrison-bar-resources">
          {stats.map((stat, i) => (
            <div key={stat.icon} className={`pill garrison-bar-stat${i === 0 ? ' pill--gold' : ''}`}>
              <Icon name={stat.icon} /> {stat.text}
            </div>
          ))}
          {onLeave && (
            <button className="btn btn--danger btn--s" onClick={onLeave}>
              Leave
            </button>
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

      {popupStack && (
        <UnitPopup stack={popupStack} army={army} onClose={() => setPopupStackId(null)} onSplit={onSplitStack} onMerge={onMergeStacks} />
      )}
    </>
  );
}
