import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CARD_DEFINITIONS } from '../engine/index.js';
import type { CardInstance } from '../engine/index.js';
import type { CardRemovalQuote } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardVisual } from './cardVisuals.js';

interface Props {
  deck: CardInstance[];
  quote: CardRemovalQuote;
  onRemove: (instanceId: string) => void;
}

/** "Remove a card" button (price or why-disabled text included) that opens a picker of the master deck. */
export function CardRemovalPicker({ deck, quote, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const label = quote.allowed ? (quote.gold > 0 ? `Remove a card (${quote.gold}g)` : 'Remove a card (free)') : 'Remove a card';

  return (
    <>
      <div className="card-removal">
        <button className="btn" disabled={!quote.allowed} onClick={() => setOpen(true)}>
          {label}
        </button>
        {!quote.allowed && <div className="card-removal-note">{quote.reason}</div>}
      </div>

      {open &&
        quote.allowed &&
        // Portal: the City popup is transformed + clipped, which would trap a nested fixed-position modal.
        createPortal(
        <>
          <div className="modal-backdrop" onClick={() => setOpen(false)} />
          <div className="popup panel panel--stone step-8 card-removal-popup">
            <button className="btn modal-close" onClick={() => setOpen(false)}>
              ✕
            </button>
            <h3>Remove a card {quote.gold > 0 ? `— ${quote.gold} Gold` : '— free'}</h3>
            <div className="card-removal-grid">
              {deck.map((instance) => {
                const def = CARD_DEFINITIONS[instance.cardId];
                if (!def) return null;
                const visual = cardVisual(instance.cardId);
                return (
                  <div
                    key={instance.instanceId}
                    className={`reward-card polarity-${visual.polarity}`}
                    onClick={() => {
                      setOpen(false);
                      onRemove(instance.instanceId);
                    }}
                  >
                    <div className="reward-card-cost">{def.manaCost}</div>
                    <div className="reward-card-icon">{visual.icon}</div>
                    <div className="reward-card-name">{def.name}</div>
                    <div className="reward-card-desc">{CARD_DESCRIPTIONS[instance.cardId] ?? instance.cardId}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
