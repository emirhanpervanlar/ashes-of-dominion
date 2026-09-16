import type { RunState } from '../engine/run/index.js';
import type { MapNode } from '../engine/run/index.js';

interface Props {
  run: RunState;
  onMoveTo: (nodeId: string) => void;
  onEnterCity: () => void;
  onNewRun: () => void;
}

const NODE_LABELS: Record<MapNode['type'], string> = {
  road: 'Road',
  battle: 'Battle',
  elite_battle: 'Elite Battle',
  resource: 'Resource',
  merchant: 'Merchant',
  event: 'Event',
  city: 'City',
  end: 'End (Phase 3 MVP)',
};

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onNewRun }: Props) {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layers = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;

  return (
    <div>
      <h1>Ashes of Dominion — World Map</h1>
      <div className="subtitle">Run seed {run.seed} · Battles won {run.battlesWon}</div>

      <div className="toolbar">
        <button onClick={onNewRun}>Abandon Run / New Run</button>
        {current.type === 'city' && (
          <button className="primary" onClick={onEnterCity}>
            Enter City
          </button>
        )}
      </div>

      <div className="hero-panel">
        <div className="stat">
          <span className="stat-label">Day</span> {run.day}
        </div>
        <div className="stat">
          <span className="stat-label">Gold</span> {run.gold}
        </div>
        <div className="stat">
          <span className="stat-label">Food</span> {run.food}
        </div>
        <div className="stat">
          <span className="stat-label">Hero HP</span> {run.hero.hp}/{run.hero.maxHp}
        </div>
        <div className="stat">
          <span className="stat-label">Army</span> {run.army.reduce((sum, s) => sum + s.count, 0)}
        </div>
        <div className="stat">
          <span className="stat-label">Relics</span> {run.relics.map((r) => r.name).join(', ') || 'none'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {Array.from({ length: layers }, (_, layer) => (
          <div key={layer} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
            {run.worldMap.nodes
              .filter((n) => n.layer === layer)
              .map((node) => {
                const isCurrent = node.id === current.id;
                const isSelectable = !isCurrent && current.connectsTo.includes(node.id) && node.visibility !== 'unknown';
                const classes = ['stack-tile'];
                if (isCurrent) classes.push('selected', 'player');
                else if (isSelectable) classes.push('selectable', 'player');
                else classes.push('empty');
                return (
                  <div key={node.id} className={classes.join(' ')} onClick={isSelectable ? () => onMoveTo(node.id) : undefined}>
                    <div className="stack-name">
                      <span>{node.visibility === 'unknown' ? 'Unknown' : NODE_LABELS[node.type]}</span>
                    </div>
                    <div className="badges">
                      <span className="badge">layer {node.layer}</span>
                      {isCurrent && <span className="badge">you are here</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
