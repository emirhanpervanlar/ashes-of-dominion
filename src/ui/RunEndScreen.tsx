import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { RunState } from '../engine/run/index.js';

interface Props {
  run: RunState;
  onNewRun: () => void;
}

export function RunEndScreen({ run, onNewRun }: Props) {
  const victory = run.phase === 'run_complete';
  const defeatReason = run.hero.hp <= 0 ? 'Your hero fell in battle, and the run ends here.' : 'Every unit in your army was lost, and the run ends here.';
  const armySummary = run.army
    .filter((s) => s.count > 0)
    .map((s) => `${UNIT_DEFINITIONS[s.unitId].name} ×${s.count}`)
    .join(', ');

  return (
    <div>
      <h1>{victory ? 'Victory — Run Complete' : 'Defeat'}</h1>
      <div className={`result-banner ${victory ? 'victory' : 'defeat'}`}>
        {victory
          ? 'The Warlord has fallen. The run is complete.'
          : defeatReason}
      </div>

      <h2 style={{ fontSize: 14 }}>Run Summary</h2>
      <div className="hero-panel" style={{ flexWrap: 'wrap' }}>
        <div className="stat">
          <span className="stat-label">Day</span> {run.day}
        </div>
        <div className="stat">
          <span className="stat-label">Battles won</span> {run.battlesWon}
        </div>
        <div className="stat">
          <span className="stat-label">City level</span> {run.city.level}
        </div>
        <div className="stat">
          <span className="stat-label">Gold</span> {run.gold}
        </div>
        <div className="stat">
          <span className="stat-label">Relics</span> {run.relics.map((r) => r.name).join(', ') || 'none'}
        </div>
        <div className="stat">
          <span className="stat-label">Deck size</span> {run.masterDeck.length}
        </div>
      </div>
      <div className="hero-panel">
        <div className="stat">
          <span className="stat-label">Final army</span> {armySummary || 'wiped out'}
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
