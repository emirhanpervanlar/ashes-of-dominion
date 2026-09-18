import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { RunState } from '../engine/run/index.js';
import type { MapNode } from '../engine/run/index.js';
import { HistoryDrawer } from './HistoryDrawer.js';
import { describeRunEvent } from './runEventText.js';
import { relicIcon } from './relicIcons.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS } from './unitShapes.js';
import { UnitPopup } from './UnitPopup.js';
import { HERO_PORTRAITS } from './heroIcons.js';

const MAX_ARMY_SLOTS = 6;
const RELIC_GRID_SLOTS = 15;

interface Props {
  run: RunState;
  onMoveTo: (nodeId: string) => void;
  onEnterCity: () => void;
  onOpenMenu: () => void;
  onSplitStack: (stackId: string, splitCount: number) => void;
  onMergeStacks: (stackIdA: string, stackIdB: string) => void;
}

const NODE_LABELS: Record<MapNode['type'], string> = {
  road: 'Road',
  battle: 'Battle',
  elite_battle: 'Elite Battle',
  resource: 'Resource',
  merchant: 'Merchant',
  event: 'Event',
  city: 'City',
  boss: 'Boss',
};

const NODE_BADGES: Record<MapNode['type'], string> = {
  road: '·',
  battle: '⚔️',
  elite_battle: '☠️',
  resource: '💰',
  merchant: '🛒',
  event: '❓',
  city: '🏰',
  boss: '👑',
};

const NODE_ACCENTS: Record<MapNode['type'], string> = {
  road: '#6b7280',
  battle: '#c85c5c',
  elite_battle: '#8b2f2f',
  resource: '#d4af37',
  merchant: '#4a90d9',
  event: '#a05cd9',
  city: '#e0b34c',
  boss: '#e0503c',
};

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onOpenMenu, onSplitStack, onMergeStacks }: Props) {
  const [popupStackId, setPopupStackId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const popupStack = popupStackId ? run.army.find((s) => s.stackId === popupStackId && s.count > 0) ?? null : null;
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layerCount = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;
  const nextChoices = current.connectsTo
    .map((id) => run.worldMap.nodes.find((n) => n.id === id))
    .filter((n): n is MapNode => !!n && n.visibility !== 'unknown');
  const historyLines = run.log.map(describeRunEvent).filter((line): line is string => line !== null);
  const armySlots = run.army.filter((s) => s.count > 0);

  return (
    <div className="garrison-frame">
      <div className="garrison-scene">
        <div className="path-progress">
          Layer {current.layer + 1} / {layerCount}
        </div>
        <div className="current-location-badge" style={{ '--pc-color': NODE_ACCENTS[current.type] } as React.CSSProperties}>
          <span className="current-location-icon">{NODE_BADGES[current.type]}</span>
          <span>You are here — {NODE_LABELS[current.type]}</span>
        </div>
        {current.type === 'city' && (
          <button className="primary" style={{ marginTop: 10 }} onClick={onEnterCity}>
            Enter City
          </button>
        )}

        <div className="path-choice-heading">Choose Your Path</div>
        <div className="path-choice-row">
          {nextChoices.length === 0 && <div className="subtitle">This is the end of the road.</div>}
          {nextChoices.map((node) => {
            const known = node.visibility !== 'unknown';
            return (
              <div
                key={node.id}
                className="path-choice-card"
                style={{ '--pc-color': NODE_ACCENTS[node.type] } as React.CSSProperties}
                onClick={() => onMoveTo(node.id)}
              >
                <span className="path-choice-badge">{known ? NODE_BADGES[node.type] : '?'}</span>
                <div className="path-choice-name">{known ? NODE_LABELS[node.type] : 'Unknown'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="garrison-bar">
        <div className="garrison-bar-col garrison-bar-resources">
          <div className="garrison-bar-stat">
            <span>💰</span> {run.gold}
          </div>
          <div className="garrison-bar-stat">
            <span>🌾</span> {run.food}
          </div>
          <div className="garrison-bar-stat">
            <span>⏳</span> Day {run.day}
          </div>
        </div>

        <div className="garrison-bar-col garrison-bar-hero">
          <div className="garrison-hero-plaque">{run.hero.name}</div>
          <div className="garrison-hero-portrait-rect">{HERO_PORTRAITS[run.hero.heroType]}</div>
          <div className="garrison-relic-grid">
            {Array.from({ length: RELIC_GRID_SLOTS }).map((_, i) => {
              const r = run.relics[i];
              return r ? (
                <span key={r.id} className="garrison-relic-cell" title={`${r.name} — ${r.description}`}>
                  {relicIcon(r.id)}
                </span>
              ) : (
                <span key={`empty-relic-${i}`} className="garrison-relic-cell empty" />
              );
            })}
          </div>
        </div>

        <div className="garrison-bar-col garrison-bar-main">
          <div className="garrison-bar-army">
            {Array.from({ length: MAX_ARMY_SLOTS }).map((_, i) => {
              const s = armySlots[i];
              if (!s) {
                return (
                  <div key={`empty-unit-${i}`} className="garrison-unit-cell empty">
                    <div className="garrison-slot garrison-slot-empty">Empty</div>
                  </div>
                );
              }
              return (
                <div key={s.stackId} className="garrison-unit-cell" onClick={() => setPopupStackId(s.stackId)} title={UNIT_DEFINITIONS[s.unitId].name}>
                  <div className="garrison-slot">
                    <span className="garrison-slot-icon">{UNIT_ICONS[s.unitId]}</span>
                    <span className="garrison-slot-role">{UNIT_ROLE_ICONS[s.unitId]}</span>
                  </div>
                  <span className="garrison-slot-count-below">{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="garrison-bar-col garrison-bar-actions">
          <button className="garrison-bar-btn" onClick={() => setHistoryOpen(true)} title="History">
            📜
          </button>
          <button className="garrison-bar-btn" onClick={onOpenMenu} title="Menu">
            ☰
          </button>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="History" lines={historyLines} />

      {popupStack && (
        <UnitPopup
          stack={popupStack}
          army={run.army}
          onClose={() => setPopupStackId(null)}
          onSplit={onSplitStack}
          onMerge={onMergeStacks}
        />
      )}
    </div>
  );
}
