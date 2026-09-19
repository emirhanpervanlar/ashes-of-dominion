import type { HeroId } from '../engine/index.js';
import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';
import { HERO_ICONS } from './heroIcons.js';

interface Props {
  heroId: HeroId;
  heroName: string;
  onChoose: (relicId: string) => void;
}

export function StartingRelicScreen({ heroId, heroName, onChoose }: Props) {
  return (
    <div className="screen" data-screen="hero">
     <div className="setup-screen">
      <div className="setup-hero-portrait">
        <Icon name={HERO_ICONS[heroId]} size={4} />
      </div>
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
                <Icon name={relicIcon(relic.id)} /> {relic.name}
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
