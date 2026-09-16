import { useState } from 'react';

interface Props {
  onClose: () => void;
  onMainMenu: () => void;
  musicOn: boolean;
  onToggleMusic: () => void;
}

export function PauseMenu({ onClose, onMainMenu, musicOn, onToggleMusic }: Props) {
  const [view, setView] = useState<'main' | 'settings'>('main');

  return (
    <>
      <div className="modal-backdrop pause-backdrop" onClick={onClose} />
      <div className="pause-menu-card">
        {view === 'main' ? (
          <>
            <h2 className="pause-menu-title">Paused</h2>
            <button className="pause-menu-option primary" onClick={onClose}>
              Continue
            </button>
            <button className="pause-menu-option" onClick={() => setView('settings')}>
              Settings
            </button>
            <button className="pause-menu-option" onClick={onMainMenu}>
              Main Menu
            </button>
          </>
        ) : (
          <>
            <h2 className="pause-menu-title">Settings</h2>
            <label className="pause-menu-setting">
              <input type="checkbox" checked={musicOn} onChange={onToggleMusic} />
              Music
            </label>
            <button className="pause-menu-option" onClick={() => setView('main')}>
              Back
            </button>
          </>
        )}
      </div>
    </>
  );
}
