import { useState } from 'react';
import { DOCTRINE_DEFINITIONS } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { DOCTRINE_ICONS } from '../mapIcons.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';

interface Props {
  run: Pick<RunState, 'city'>;
  onChoose: (doctrineId: string) => void;
  onClose: () => void;
}

/** Temple: the doctrines as large cards. One permanent choice, confirmed in a second modal. */
export function TemplePanel({ run, onChoose, onClose }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const chosenId = run.city.doctrine;
  const pendingDoctrine = pending ? DOCTRINE_DEFINITIONS[pending] : null;

  return (
    <Modal heading="Temple" material="wood" onClose={onClose} width={880}>
      <p className="city-note city-temple-lead">
        {chosenId ? 'Your doctrine is chosen and cannot be changed this run.' : 'Choose one doctrine. The choice is permanent for the rest of the run.'}
      </p>
      <div className="city-doctrines">
        {Object.values(DOCTRINE_DEFINITIONS).map((doctrine) => {
          const chosen = chosenId === doctrine.id;
          const locked = !!chosenId && !chosen;
          return (
            <div key={doctrine.id} className={`city-doctrine step${chosen ? ' city-doctrine--chosen' : ''}${locked ? ' city-doctrine--locked' : ''}`}>
              <div className="city-doctrine-art well step">
                <Icon name={DOCTRINE_ICONS[doctrine.id]!} size={3} />
              </div>
              <div className="city-doctrine-name">{doctrine.name}</div>
              <p className="city-doctrine-effect">{doctrine.description}</p>
              {chosen ? (
                <span className="city-tag city-tag--built">Chosen</span>
              ) : locked ? (
                <span className="city-tag city-tag--locked">Not chosen</span>
              ) : (
                <button className="btn btn--primary" onClick={() => setPending(doctrine.id)}>
                  Choose
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pendingDoctrine && (
        <Modal
          heading="Choose a doctrine"
          material="wood"
          width={480}
          onClose={() => setPending(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  onChoose(pendingDoctrine.id);
                  setPending(null);
                }}
              >
                Confirm
              </button>
            </>
          }
        >
          <div className="city-confirm">
            <Icon name={DOCTRINE_ICONS[pendingDoctrine.id]!} size={3} />
            <h3>{pendingDoctrine.name}</h3>
            <p className="city-effect-big">{pendingDoctrine.description}</p>
            <p className="city-note">This cannot be undone. The other doctrines are lost for this run.</p>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
