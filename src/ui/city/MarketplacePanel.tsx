import { useState } from 'react';
import { FOOD_MARKET, foodMarketQuote } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';
import { QuantityStepper } from '../QuantityStepper.js';

interface Props {
  run: RunState;
  onBuy: (packs: number) => void;
  onClose: () => void;
}

/** Marketplace (AO-D071): Food packs for Gold with a rising price; always available, no building slot. */
export function MarketplacePanel({ run, onBuy, onClose }: Props) {
  const [wanted, setWanted] = useState(1);
  const one = foodMarketQuote(run, 1);
  const max = Math.max(1, one.maxAffordable);
  const packs = Math.min(wanted, max);
  const quote = foodMarketQuote(run, packs);
  const growth = Math.round((FOOD_MARKET.priceGrowth - 1) * 100);
  const affordable = quote.maxAffordable >= packs;

  return (
    <Modal heading="Marketplace" material="wood" onClose={onClose} width={620}>
      <div className="city-barracks-strip well step">
        <span className="city-strip-item city-strip-item--big">
          <Icon name="gold" size={2} /> {run.gold} Gold
        </span>
        <span className="city-strip-item city-strip-item--big">
          <Icon name="food" size={2} /> {run.food} Food
        </span>
      </div>

      <div className="city-building">
        <div className="city-building-art well step">
          <Icon name="bld_marketplace" size={4} />
        </div>
        <div className="city-building-body">
          <div className="city-section">
            <h3>Food packs</h3>
            <p className="city-effect-big">
              A pack gives {FOOD_MARKET.foodPerPack} Food and costs <Icon name="gold" /> {quote.packPrice} now; the next one costs <Icon name="gold" /> {quote.nextPackPrice}.
            </p>
            <p className="city-note">
              The price rises {growth}% with every pack you buy and never falls back. {run.foodPurchases === 0 ? 'You have bought none yet.' : `You have bought ${run.foodPurchases} so far.`}
            </p>
          </div>

          <QuantityStepper value={packs} min={1} max={max} onChange={setWanted} label="Food packs" />

          <div className="city-recruit-total">
            <button className="btn btn--s" disabled={one.maxAffordable < 1} onClick={() => setWanted(one.maxAffordable)}>
              Max
            </button>
            <span className={affordable ? '' : 'city-cost--short'}>
              <Icon name="gold" /> {quote.gold}
            </span>
            <span>
              <Icon name="food" /> +{quote.food}
            </span>
          </div>

          <div className="city-action">
            <div className="city-action-row">
              <button
                className="btn btn--primary"
                disabled={!affordable}
                onClick={() => {
                  onBuy(packs);
                  setWanted(1);
                }}
              >
                Buy {packs} {packs === 1 ? 'pack' : 'packs'}
              </button>
            </div>
            {!affordable && (
              <div className="city-blocker">
                <Icon name="ui_warn" /> Not enough Gold ({quote.gold} needed).
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
