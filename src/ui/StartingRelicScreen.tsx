import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { relicIcon } from './relicIcons.js';

interface Props {
  heroName: string;
  onChoose: (relicId: string) => void;
}

export function StartingRelicScreen({ heroName, onChoose }: Props) {
  return (
    <div className="screen" data-screen="hero">
     <div className="setup-screen">
      <div className="setup-hero-portrait">🤴</div>
      <h1>{heroName}</h1>
      <div className="subtitle">
        A veteran officer of the shattered Kingdom, commanding what remains of a proud army through the fractured
        realm. Choose one starting relic to begin the run.
      </div>

      <div className="setup-options">
        {Object.values(STARTING_RELIC_DEFINITIONS).map((relic) => (
          <div key={relic.id} className="option-tile setup-option" onClick={() => onChoose(relic.id)}>
            <div className="option-name">
              <span>
                {relicIcon(relic.id)} {relic.name}
              </span>
            </div>
            <div className="option-text">{relic.description}</div>
          </div>
        ))}
      </div>
     </div>
    </div>
  );
}
