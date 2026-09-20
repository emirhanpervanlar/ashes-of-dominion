import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './pixel/Icon.js';
import { ScrollArea } from './ScrollArea.js';
import { quietTipsBriefly } from './Tip.js';

interface ModalProps {
  /** Plaque header that overlaps the top edge (Display face). Omit for a header-less popup. */
  heading?: ReactNode;
  /** Omit for a decision the player must make: no close button, Esc or click-outside. */
  onClose?: () => void;
  /** Panel material: stone for info/deck viewers, iron for battle popups, wood for city popups. */
  material?: 'stone' | 'iron' | 'wood';
  /** Gold trim frame, for the info popups (unit, card, hero). */
  trim?: boolean;
  width?: number | string;
  footer?: ReactNode;
  children: ReactNode;
}

// Open modals, oldest first: only the top one reacts to Esc, and a modal opened over another gets the darker backdrop.
const openModals: symbol[] = [];

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal shell (DESIGN_LANGUAGE 6.9): portal, plaque header, close button, Esc and click-outside close,
 * focus moved inside and kept there while it is open, focus returned to the opener on close.
 */
export function Modal({ heading, onClose, material = 'stone', trim, width, footer, children }: ModalProps) {
  const winRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [depth] = useState(() => openModals.length);

  useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    winRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (openModals[openModals.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !winRef.current) return;
      const items = [...winRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!winRef.current.contains(active) || (e.shiftKey && (active === first || active === winRef.current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      openModals.splice(openModals.indexOf(id), 1);
      if (opener?.isConnected) {
        quietTipsBriefly();
        opener.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      className={`modal-layer${depth > 0 ? ' modal-layer--stacked' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current?.();
      }}
    >
      <div ref={winRef} className="modal-win" style={{ width }} role="dialog" aria-modal="true" tabIndex={-1}>
        {heading && <div className="plaque modal-plaque">{heading}</div>}
        <div className={`panel panel--${material} step-8 modal-frame${trim ? ' modal-frame--trim' : ''}${heading ? ' modal-frame--titled' : ''}`}>
          {onClose && (
            <button className="btn modal-close" aria-label="Close" onClick={onClose}>
              <Icon name="ui_close" />
            </button>
          )}
          <ScrollArea className="modal-scroll">{children}</ScrollArea>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
