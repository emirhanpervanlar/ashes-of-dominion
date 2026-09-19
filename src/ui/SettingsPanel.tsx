import type { CSSProperties } from 'react';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
  onClose: () => void;
}

export function SettingsPanel({ volume, onVolumeChange, onClose }: Props) {
  return (
    <>
      <div className="modal-backdrop pause-backdrop" onClick={onClose} />
      <div className="popup panel panel--iron step-8 pause-menu-card">
        <h2 className="pause-menu-title">Settings</h2>
        <label className="pause-menu-setting pause-menu-slider">
          <span>Music Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            style={{ '--fill': `${Math.round(volume * 100)}%` } as CSSProperties}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          />
          <span className="pause-menu-slider-value">{Math.round(volume * 100)}%</span>
        </label>
        <button className="btn pause-menu-option" onClick={onClose}>
          Back
        </button>
      </div>
    </>
  );
}
