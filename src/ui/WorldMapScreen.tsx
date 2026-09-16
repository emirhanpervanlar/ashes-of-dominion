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
  boss: 'Boss',
};

const NODE_ICONS: Record<MapNode['type'], string> = {
  road: '·',
  battle: '⚔️',
  elite_battle: '☠️',
  resource: '💰',
  merchant: '🛒',
  event: '❓',
  city: '🏰',
  boss: '👑',
};

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onNewRun }: Props) {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layerCount = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;
  const layers = Array.from({ length: layerCount }, (_, layer) => run.worldMap.nodes.filter((n) => n.layer === layer));

  return (
    <div>
      <h1>Ashes of Dominion — World Map</h1>
      <div className="subtitle">
        Run seed {run.seed} · Battles won {run.battlesWon}
      </div>

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

      <div className="map-column">
        {layers.map((nodes, layer) => (
          <div key={layer}>
            <div className="map-layer">
              {nodes.map((node) => {
                const isCurrent = node.id === current.id;
                const isSelectable = !isCurrent && current.connectsTo.includes(node.id) && node.visibility !== 'unknown';
                const classes = ['stack-tile'];
                if (isCurrent) classes.push('selected', 'player');
                else if (isSelectable) classes.push('selectable', 'player');
                else classes.push('empty');
                const known = node.visibility !== 'unknown';
                return (
                  <div key={node.id} className={classes.join(' ')} onClick={isSelectable ? () => onMoveTo(node.id) : undefined}>
                    <div className="stack-name">
                      <span>
                        {known ? NODE_ICONS[node.type] : '?'} {known ? NODE_LABELS[node.type] : 'Unknown'}
                      </span>
                    </div>
                    <div className="badges">
                      <span className="badge">layer {node.layer}</span>
                      {isCurrent && <span className="badge">you are here</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {layer < layers.length - 1 && <div className="map-connector">│</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
