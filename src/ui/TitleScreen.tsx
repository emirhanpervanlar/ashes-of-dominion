import { Icon } from './pixel/Icon.js';

interface Props {
  onStart: () => void;
  onContinue?: () => void;
  onSettings: () => void;
}

export function TitleScreen({ onStart, onContinue, onSettings }: Props) {
  return (
    <div className="screen title-screen" data-screen="title">
      <div className="title-crest">
        <Icon name="crest" size={4} />
      </div>
      <h1 className="title-name">ASHES OF DOMINION</h1>
      <div className="title-tagline">From the embers of a shattered crown, a new dominion shall rise.</div>

      <div className="title-menu">
        <button className="btn btn--l btn--primary" onClick={onStart}>
          New Game
        </button>
        {onContinue && (
          <button className="btn btn--l" onClick={onContinue}>
            Continue
          </button>
        )}
        <button className="btn btn--l" onClick={onSettings}>
          Settings
        </button>
      </div>

      <div className="title-footer">A turn-based dominion of armies, cards, and attrition.</div>
    </div>
  );
}
