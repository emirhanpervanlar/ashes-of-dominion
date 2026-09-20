import { Icon } from './pixel/Icon.js';
import { TitleSkyline } from './TitleSkyline.js';

interface Props {
  onStart: () => void;
  /** Undefined when there is no saved run: Continue is shown disabled with the reason. */
  onContinue?: () => void;
  onSettings: () => void;
}

export function TitleScreen({ onStart, onContinue, onSettings }: Props) {
  return (
    <div className="screen title-screen" data-screen="title">
      <TitleSkyline />
      <div className="title-content">
        <div className="title-crest">
          <Icon name="crest" size={4} />
        </div>
        <h1 className="plaque plaque--ribbon title-plaque">Ashes of Dominion</h1>
        <div className="title-tagline">From the embers of a shattered crown, a new dominion shall rise.</div>

        <div className="shadowed">
          <div className="panel panel--stone step-8 title-menu">
            <button className="btn btn--l btn--primary" onClick={onStart}>
              New Run
            </button>
            <button className="btn btn--l" disabled={!onContinue} onClick={onContinue}>
              Continue
            </button>
            {!onContinue && <div className="title-menu-note">No saved run yet.</div>}
            <button className="btn btn--l" onClick={onSettings}>
              Settings
            </button>
          </div>
        </div>
      </div>
      <div className="title-footer">A turn-based dominion of armies, cards, and attrition.</div>
    </div>
  );
}
