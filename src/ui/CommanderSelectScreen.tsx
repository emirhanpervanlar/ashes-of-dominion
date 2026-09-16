import { useState } from 'react';

interface Props {
  heroName: string;
  onBegin: () => void;
  onBack: () => void;
}

/**
 * Only one Commander archetype exists in the engine today. The layout is built for a
 * row of cards so more archetypes can be dropped in later without a redesign.
 */
export function CommanderSelectScreen({ heroName, onBegin, onBack }: Props) {
  const [selected, setSelected] = useState(true);

  return (
    <div className="setup-screen commander-select-screen">
      <h1>Choose Your Commander</h1>
      <div className="subtitle">Select the officer who will lead your army through the fractured realm.</div>

      <div className="commander-select-row">
        <div
          className={`commander-card${selected ? ' selected' : ''}`}
          onClick={() => setSelected(true)}
        >
          <div className="commander-card-portrait">🤴</div>
          <div className="commander-card-name">{heroName || 'Commander'}</div>
          <div className="commander-card-title">Lord of the Shattered Kingdom</div>
          <div className="commander-card-desc">
            A veteran officer of the shattered Kingdom, commanding what remains of a proud army through the
            fractured realm.
          </div>
          {selected && <div className="commander-selected-badge">✓ Selected</div>}
        </div>
      </div>

      <div className="toolbar" style={{ justifyContent: 'center', marginTop: 20 }}>
        <button onClick={onBack}>Back</button>
        <button className="primary begin-journey-btn" disabled={!selected} onClick={onBegin}>
          Begin Journey
        </button>
      </div>
    </div>
  );
}
