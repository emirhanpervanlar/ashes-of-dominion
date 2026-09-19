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
    <div className="screen run-end" data-screen={victory ? 'victory' : 'defeat'}>
      <div className="run-end-body">
        <h1 className={`plaque plaque--ribbon${victory ? '' : ' plaque--blood'}`}>{victory ? 'Victory — Run Complete' : 'Defeat'}</h1>
        <div className="panel panel--stone step-8">
          {victory ? 'The Warlord has fallen. The run is complete.' : defeatReason}
        </div>

        <div className="well run-summary">
          <div className="stat">
            <span className="stat-label">Day</span> <span className="stat-value">{run.day}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Battles won</span> <span className="stat-value">{run.battlesWon}</span>
          </div>
          <div className="stat">
            <span className="stat-label">City level</span> <span className="stat-value">{run.city.level}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gold</span> <span className="stat-value">{run.gold}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Relics</span> {run.relics.map((r) => r.name).join(', ') || 'none'}
          </div>
          <div className="stat">
            <span className="stat-label">Deck size</span> <span className="stat-value">{run.masterDeck.length}</span>
          </div>
        </div>
        <div className="well run-summary">
          <div className="stat">
            <span className="stat-label">Final army</span> {armySummary || 'wiped out'}
          </div>
        </div>

        <button className="btn btn--l btn--primary" onClick={onNewRun}>
          New Run
        </button>
      </div>
    </div>
  );
}
