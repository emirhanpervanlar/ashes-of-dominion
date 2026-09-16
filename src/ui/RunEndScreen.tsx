import type { RunState } from '../engine/run/index.js';

interface Props {
  run: RunState;
  onNewRun: () => void;
}

export function RunEndScreen({ run, onNewRun }: Props) {
  const victory = run.phase === 'run_complete';
  return (
    <div>
      <h1>{victory ? 'Run Milestone Complete' : 'Defeat'}</h1>
      <div className={`result-banner ${victory ? 'victory' : 'defeat'}`}>
        {victory
          ? 'Phase 3 MVP has one battle — the world map (Phase 4) will chain many more together.'
          : 'The army was destroyed. Per AGENT.md §5, Hero defeat only ends the battle — but with no world map yet, the run also ends here for now.'}
      </div>
      <div className="hero-panel">
        <div className="stat">
          <span className="stat-label">Battles won</span> {run.battlesWon}
        </div>
        <div className="stat">
          <span className="stat-label">Relics</span> {run.relics.map((r) => r.name).join(', ') || 'none'}
        </div>
        <div className="stat">
          <span className="stat-label">Deck size</span> {run.masterDeck.length}
        </div>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={onNewRun}>
          New Run
        </button>
      </div>
    </div>
  );
}
