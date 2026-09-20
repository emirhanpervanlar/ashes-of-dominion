import { useEffect, useRef } from 'react';
import { Icon } from './pixel/Icon.js';
import { quietTipsBriefly } from './Tip.js';

interface Props {
  open: boolean;
  onClose: () => void;
  heading: string;
  lines: string[];
}

/** Newest-first log drawer: Esc closes it and focus goes back to the button that opened it. */
export function HistoryDrawer({ open, onClose, heading, lines }: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (opener?.isConnected) {
        quietTipsBriefly();
        opener.focus();
      }
    };
  }, [open]);

  if (!open) return null;
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`);
  const newestFirst = [...numbered].reverse();

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div ref={drawerRef} className="history-drawer" role="dialog" aria-modal="true" aria-label={heading} tabIndex={-1}>
        <div className="history-drawer-header">
          <strong>{heading}</strong>
          <button className="btn btn--s btn--sq" aria-label="Close log" onClick={onClose}>
            <Icon name="ui_close" />
          </button>
        </div>
        <div className="history-drawer-body">
          {newestFirst.length === 0 && <div className="subtitle">No history yet.</div>}
          {newestFirst.map((line, i) => (
            <div key={i} className="row history-line">
              {line}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
