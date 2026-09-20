import { BUILDING_DEFINITIONS, LEVEL_SLOTS } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { BUILDING_ICONS } from '../mapIcons.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';
import { BuildAction } from './BuildAction.js';
import { buildingEffect, freeSlots } from './cityView.js';

const CATEGORY_LABEL = { economy: 'Economy', army: 'Army', hero: 'Hero', special: 'Special' } as const;

interface Props {
  run: RunState;
  buildingId: string;
  onBuild: (buildingId: string) => void;
  onClose: () => void;
}

/** Market, Forge, Stable, Shrine, Gold Mine, Training Hall: what it does, what it costs, Build or Built. */
export function BuildingPanel({ run, buildingId, onBuild, onClose }: Props) {
  const def = BUILDING_DEFINITIONS[buildingId]!;
  const built = run.city.buildings.includes(buildingId);
  const effect = buildingEffect(run, buildingId);
  return (
    <Modal heading={def.name} material="wood" onClose={onClose} width={640}>
      <div className="city-building">
        <div className="city-building-art well step">
          <Icon name={BUILDING_ICONS[buildingId]!} size={4} />
        </div>
        <div className="city-building-body">
          <div className="city-tag-row">
            <span className="city-tag">{CATEGORY_LABEL[def.category]}</span>
            {built && <span className="city-tag city-tag--built">Built</span>}
          </div>
          <div className="city-section">
            <h3>{built ? 'Effect now' : 'Effect'}</h3>
            <p className="city-effect-big">{effect?.text ?? def.description}</p>
          </div>
          {built ? (
            <p className="city-note">This building is active. It uses one of your {LEVEL_SLOTS[run.city.level]} building slots.</p>
          ) : (
            <>
              <p className="city-note">
                Building slots: {run.city.buildings.length} of {LEVEL_SLOTS[run.city.level]} used ({freeSlots(run)} free).
              </p>
              <BuildAction run={run} buildingId={buildingId} onBuild={onBuild} />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
