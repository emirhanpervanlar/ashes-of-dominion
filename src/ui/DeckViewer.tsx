import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActionCardTile } from './ActionCardTile.js';
import { groupCards } from './deckView.js';
import type { DeckTab } from './deckView.js';
import { Modal } from './Modal.js';

interface Props {
  heading: string;
  tabs: DeckTab[];
  /** Tab that opens first; defaults to the first one. */
  initialTab?: string;
  footer?: ReactNode;
  onClose: () => void;
}

/** Read-only card list (deck, draw pile, discard pile): grouped with counts, sorted by cost then name, right-click for card info. */
export function DeckViewer({ heading, tabs, initialTab, footer, onClose }: Props) {
  const [tabId, setTabId] = useState(initialTab ?? tabs[0]?.id ?? '');
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const groups = tab ? groupCards(tab.cards) : [];

  return (
    <Modal heading={tab?.heading ?? heading} onClose={onClose} width={860} footer={footer}>
      {tabs.length > 1 && (
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === tab?.id} className={`tab${t.id === tab?.id ? ' active' : ''}`} onClick={() => setTabId(t.id)}>
              {t.label} ({t.cards.length})
            </button>
          ))}
        </div>
      )}
      {tab?.note && <div className="deck-note">{tab.note}</div>}
      <div className="well deck-grid">
        {groups.length === 0 && <div className="deck-empty">No cards.</div>}
        {groups.map((g) => (
          <ActionCardTile key={g.key} id={g.cardId} upgraded={g.upgraded} count={g.count} affordable />
        ))}
      </div>
    </Modal>
  );
}
