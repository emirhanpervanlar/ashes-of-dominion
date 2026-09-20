import { CARD_REMOVAL, LEVEL_SLOTS, ROMAN, cardRemovalQuote, cityRemovalPrice } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { CardRemovalPicker } from '../CardRemovalPicker.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';
import { levelRows } from './cityView.js';

interface Props {
  run: RunState;
  onUpgradeCity: () => void;
  onRemoveCard: (instanceId: string) => void;
  onClose: () => void;
}

const STATE_LABEL = { built: 'Reached', next: 'Next', locked: 'Locked' } as const;

/** Town Hall: the level ladder (slots per level, cost, Upgrade) and card removal with its price curve (AO-D052). */
export function TownHallPanel({ run, onUpgradeCity, onRemoveCard, onClose }: Props) {
  const rows = levelRows(run.city.level);
  const next = rows.find((r) => r.state === 'next') ?? null;
  const uses = run.cardRemoval.cityUses;
  const quote = cardRemovalQuote(run);
  const curve = [0, 1, 2, 3].map((i) => cityRemovalPrice(uses + i));

  return (
    <Modal heading="Town Hall" material="wood" onClose={onClose} width={880}>
      <div className="city-hall">
        <section className="city-hall-col">
          <div className="city-section-head">
            <Icon name="slots" size={2} />
            <h3>City level</h3>
          </div>
          <p className="city-note">
            Level {run.city.level}: {run.city.buildings.length} of {LEVEL_SLOTS[run.city.level]} building slots used.
          </p>
          <div className="city-ladder well step">
            {rows.map((row) => (
              <div key={row.level} className={`city-ladder-row city-ladder-row--${row.state}`}>
                <span className="city-ladder-num gem">{ROMAN[row.level - 1]}</span>
                <span className="city-ladder-info">
                  <span className="city-ladder-bonus">{row.slots} building slots</span>
                  <span className="city-ladder-tier">Level {row.level}</span>
                </span>
                {row.cost > 0 && (
                  <span className={`city-cost${row.state === 'next' && run.gold < row.cost ? ' city-cost--short' : ''}`}>
                    <Icon name="gold" /> {row.cost}
                  </span>
                )}
                <span className={`city-tag city-tag--${row.state}`}>{STATE_LABEL[row.state]}</span>
              </div>
            ))}
          </div>
          {next ? (
            <div className="city-action">
              <div className="city-action-row">
                <button className="btn btn--primary" disabled={run.gold < next.cost} onClick={onUpgradeCity}>
                  Upgrade to Level {next.level}
                </button>
              </div>
              {run.gold < next.cost && (
                <div className="city-blocker">
                  <Icon name="ui_warn" /> Not enough Gold ({next.cost} needed).
                </div>
              )}
            </div>
          ) : (
            <p className="city-note">The city is at its maximum level.</p>
          )}
        </section>

        <section className="city-hall-col">
          <div className="city-section-head">
            <Icon name="discard" size={2} />
            <h3>Card removal</h3>
          </div>
          <p className="city-note">
            Thin your deck of weak cards. It has {run.masterDeck.length} cards and never goes below {CARD_REMOVAL.minDeckSize}.
          </p>
          <div className="city-price-strip well step">
            <span className="t-label-text">Price of the next removals</span>
            <div className="city-price-chips">
              {curve.map((price, i) => (
                <span key={i} className={`city-price-chip${i === 0 ? ' city-price-chip--now' : ''}`}>
                  {price === 0 ? (
                    'Free'
                  ) : (
                    <>
                      <Icon name="gold" /> {price}
                    </>
                  )}
                </span>
              ))}
            </div>
            <p className="city-note">The first removal is free, then the price rises with every removal. Removed so far: {uses}.</p>
          </div>
          <CardRemovalPicker deck={run.masterDeck} quote={quote} onRemove={onRemoveCard} />
        </section>
      </div>
    </Modal>
  );
}
