import { useState } from 'react';
import { Modal } from './Modal.js';
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
    <Modal heading="Paused" material="iron" onClose={onClose} width={320}>
      <div className="pause-menu-card">
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
    </Modal>
  );
}
