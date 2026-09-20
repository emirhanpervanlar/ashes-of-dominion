import { BUILDING_DEFINITIONS } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { Icon } from '../pixel/Icon.js';
import { buildBlocker } from './cityView.js';

interface Props {
  run: Pick<RunState, 'city' | 'gold'>;
  buildingId: string;
  onBuild: (buildingId: string) => void;
  /** Button label; defaults to "Build". */
  label?: string;
}

/** Cost, the Build button and, when it is disabled, the reason (no slot / no Gold) right under it. */
export function BuildAction({ run, buildingId, onBuild, label = 'Build' }: Props) {
  const cost = BUILDING_DEFINITIONS[buildingId]!.cost;
  const blocker = buildBlocker(run, buildingId);
  return (
    <div className="city-action">
      <div className="city-action-row">
        <span className={`city-cost${run.gold < cost ? ' city-cost--short' : ''}`}>
          <Icon name="gold" /> {cost}
        </span>
        <button className="btn btn--primary" disabled={!!blocker} onClick={() => onBuild(buildingId)}>
          {label}
        </button>
      </div>
      {blocker && (
        <div className="city-blocker">
          <Icon name="ui_warn" /> {blocker}
        </div>
      )}
    </div>
  );
}
