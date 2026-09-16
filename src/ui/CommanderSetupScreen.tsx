import { useState } from 'react';
import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { relicIcon } from './relicIcons.js';

interface Props {
  onBack: () => void;
  onBegin: (heroName: string, relicId: string) => void;
}

export function CommanderSetupScreen({ onBack, onBegin }: Props) {
  const [name, setName] = useState('');
  const [relicId, setRelicId] = useState<string | null>(null);
  const relics = Object.values(STARTING_RELIC_DEFINITIONS);

  return (
    <div className="setup-screen commander-select-screen">
      <h1>Your Commander</h1>
      <div className="subtitle">Name your officer, then choose how they enter the fractured realm.</div>

      <input
        className="name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Commander"
        maxLength={20}
        autoFocus
      />

      <div className="commander-select-row">
        {relics.map((relic) => (
          <div
            key={relic.id}
            className={`commander-card${relicId === relic.id ? ' selected' : ''}`}
            onClick={() => setRelicId(relic.id)}
          >
            <div className="commander-card-portrait">{relicIcon(relic.id)}</div>
            <div className="commander-card-name">{relic.name}</div>
            <div className="commander-card-desc">{relic.description}</div>
            {relicId === relic.id && <div className="commander-selected-badge">✓ Selected</div>}
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ justifyContent: 'center', marginTop: 20 }}>
        <button onClick={onBack}>Back</button>
        <button
          className="primary begin-journey-btn"
          disabled={!relicId}
          onClick={() => relicId && onBegin(name.trim(), relicId)}
        >
          Begin Journey
        </button>
      </div>
    </div>
  );
}
