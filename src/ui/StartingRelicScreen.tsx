import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { relicIcon } from './relicIcons.js';

interface Props {
  onChoose: (relicId: string) => void;
}

export function StartingRelicScreen({ onChoose }: Props) {
  return (
    <div className="setup-screen">
      <div className="setup-hero-portrait">🧑‍✈️</div>
      <h1>Commander</h1>
      <div className="subtitle">
        A veteran officer of the shattered Kingdom, commanding what remains of a proud army through the fractured
        realm. Choose one starting relic to begin the run (AGENT.md §17).
      </div>

      <div className="setup-options">
        {Object.values(STARTING_RELIC_DEFINITIONS).map((relic) => (
          <div key={relic.id} className="card-tile setup-option" onClick={() => onChoose(relic.id)}>
            <div className="card-name">
              <span>
                {relicIcon(relic.id)} {relic.name}
              </span>
            </div>
            <div className="card-text">{relic.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
