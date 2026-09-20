import { BUILDING_DEFINITIONS, LEVEL_SLOTS, dailyFoodNet, dailyProduction, dailyUpkeep } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { BUILDING_ICONS } from '../mapIcons.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';
import { BuildAction } from './BuildAction.js';
import { ROMAN, freeSlots, tierRows } from './cityView.js';

interface Props {
  kind: 'mage_tower' | 'farm';
  run: RunState;
  onBuild: (buildingId: string) => void;
  onUpgrade: () => void;
  onClose: () => void;
}

const STATE_LABEL = { built: 'Built', next: 'Next', locked: 'Locked' } as const;

/** Mage Tower (I-III) and Farm (I-V): one slot at every tier, the ladder shows the cumulative bonus and what the next step costs. */
export function TierLadderPanel({ kind, run, onBuild, onUpgrade, onClose }: Props) {
  const def = BUILDING_DEFINITIONS[kind]!;
  const tier = kind === 'mage_tower' ? run.city.mageTowerTier : run.city.farmTier;
  const built = run.city.buildings.includes(kind);
  const rows = tierRows(kind, built ? tier : 0);
  const next = rows.find((r) => r.state === 'next') ?? null;
  const current = rows.filter((r) => r.state === 'built').pop() ?? null;
  const net = dailyFoodNet(run);

  return (
    <Modal heading={def.name} material="wood" onClose={onClose} width={720}>
      <div className="city-building">
        <div className="city-building-art well step">
          <Icon name={BUILDING_ICONS[kind]!} size={4} />
        </div>
        <div className="city-building-body">
          <div className="city-section">
            <h3>{built ? `Now: tier ${ROMAN[tier - 1]}` : 'Not built yet'}</h3>
            <p className="city-effect-big">{current ? current.bonus : 'No bonus until it is built.'}</p>
            {kind === 'farm' && (
              <p className="city-note">
                Production {dailyProduction(run)} a day, the army eats {dailyUpkeep(run)}: net {net > 0 ? `+${net}` : net} Food a day.
              </p>
            )}
            <p className="city-note">
              One building slot at every tier ({run.city.buildings.length} of {LEVEL_SLOTS[run.city.level]} used, {freeSlots(run)} free).
            </p>
          </div>

          <div className="city-ladder well step">
            {rows.map((row) => (
              <div key={row.tier} className={`city-ladder-row city-ladder-row--${row.state}`}>
                <span className="city-ladder-num gem">{ROMAN[row.tier - 1]}</span>
                <span className="city-ladder-info">
                  <span className="city-ladder-bonus">{row.bonus}</span>
                  <span className="city-ladder-tier">{row.label}</span>
                </span>
                <span className={`city-cost${row.state === 'next' && run.gold < row.cost ? ' city-cost--short' : ''}`}>
                  <Icon name="gold" /> {row.cost}
                </span>
                <span className={`city-tag city-tag--${row.state}`}>{STATE_LABEL[row.state]}</span>
              </div>
            ))}
          </div>

          {next &&
            (built ? (
              <div className="city-action">
                <div className="city-action-row">
                  <button className="btn btn--primary" disabled={run.gold < next.cost} onClick={onUpgrade}>
                    Upgrade to {next.label}
                  </button>
                </div>
                {run.gold < next.cost && (
                  <div className="city-blocker">
                    <Icon name="ui_warn" /> Not enough Gold ({next.cost} needed).
                  </div>
                )}
              </div>
            ) : (
              <BuildAction run={run} buildingId={kind} onBuild={onBuild} label={`Build ${next.label}`} />
            ))}
          {built && !next && <p className="city-note">Fully upgraded.</p>}
        </div>
      </div>
    </Modal>
  );
}
