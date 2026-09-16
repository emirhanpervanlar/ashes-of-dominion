import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';

interface Props {
  onChoose: (relicId: string) => void;
}

export function StartingRelicScreen({ onChoose }: Props) {
  return (
    <div>
      <h1>Ashes of Dominion — New Run</h1>
      <div className="subtitle">Choose one starting relic (AGENT.md §17).</div>
      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {Object.values(STARTING_RELIC_DEFINITIONS).map((relic) => (
          <div key={relic.id} className="card-tile" style={{ minWidth: 220, cursor: 'pointer' }} onClick={() => onChoose(relic.id)}>
            <div className="card-name">
              <span>{relic.name}</span>
            </div>
            <div className="card-text">{relic.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
