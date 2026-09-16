import { useState } from 'react';

interface Props {
  onConfirm: (name: string) => void;
  onBack: () => void;
}

export function NameEntryScreen({ onConfirm, onBack }: Props) {
  const [name, setName] = useState('');

  function confirm() {
    onConfirm(name.trim());
  }

  return (
    <div className="setup-screen">
      <div className="setup-hero-portrait">🤴</div>
      <h1>Name Your Commander</h1>
      <div className="subtitle">Who leads the remnants of the shattered Kingdom into the fractured realm?</div>

      <input
        className="name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Commander"
        maxLength={20}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirm();
        }}
      />

      <div className="toolbar" style={{ justifyContent: 'center', marginTop: 18 }}>
        <button onClick={onBack}>Back</button>
        <button className="primary" onClick={confirm}>
          Continue
        </button>
      </div>
    </div>
  );
}
