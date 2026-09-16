interface Props {
  onStart: () => void;
  onContinue?: () => void;
  onSettings: () => void;
}

export function TitleScreen({ onStart, onContinue, onSettings }: Props) {
  return (
    <div className="title-screen">
      <div className="title-crest">🛡️</div>
      <h1 className="title-name">ASHES OF DOMINION</h1>
      <div className="title-tagline">From the embers of a shattered crown, a new dominion shall rise.</div>

      <div className="title-menu">
        <button className="title-menu-btn primary" onClick={onStart}>
          New Game
        </button>
        {onContinue && (
          <button className="title-menu-btn" onClick={onContinue}>
            Continue
          </button>
        )}
        <button className="title-menu-btn" onClick={onSettings}>
          Settings
        </button>
      </div>

      <div className="title-footer">A turn-based dominion of armies, cards, and attrition.</div>
    </div>
  );
}
