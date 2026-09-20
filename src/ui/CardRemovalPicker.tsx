import { useState } from 'react';
import type { CardInstance } from '../engine/index.js';
import type { CardRemovalQuote } from '../engine/run/index.js';
import { LargeCard } from './LargeCard.js';
import { Modal } from './Modal.js';

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

      {open && quote.allowed && (
        <Modal heading={`Remove a card ${quote.gold > 0 ? `- ${quote.gold} Gold` : '- free'}`} onClose={() => setOpen(false)} width={900}>
          <div className="card-removal-grid">
            {deck.map((instance) => (
              <LargeCard
                key={instance.instanceId}
                cardId={instance.cardId}
                upgraded={instance.upgraded}
                onClick={() => {
                  setOpen(false);
                  onRemove(instance.instanceId);
                }}
              />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
