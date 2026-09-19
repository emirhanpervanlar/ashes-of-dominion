import { useState } from 'react';
import { SettingsPanel } from './SettingsPanel.js';

interface Props {
  onClose: () => void;
  onMainMenu: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}

export function PauseMenu({ onClose, onMainMenu, volume, onVolumeChange }: Props) {
  const [view, setView] = useState<'main' | 'settings'>('main');

  if (view === 'settings') {
    return <SettingsPanel volume={volume} onVolumeChange={onVolumeChange} onClose={() => setView('main')} />;
  }

  return (
    <>
      <div className="modal-backdrop pause-backdrop" onClick={onClose} />
      <div className="popup panel panel--iron step-8 pause-menu-card">
        <h2 className="pause-menu-title">Paused</h2>
        <button className="btn btn--primary pause-menu-option" onClick={onClose}>
          Continue
        </button>
        <button className="btn pause-menu-option" onClick={() => setView('settings')}>
          Settings
        </button>
        <button className="btn pause-menu-option" onClick={onMainMenu}>
          Main Menu
        </button>
      </div>
    </>
  );
}
