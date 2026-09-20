import { cloneElement, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './pixel/Icon.js';
import { placeTip } from './tipPlacement.js';
import type { TipContent } from './tipContent.js';

interface TipApi {
  show: (target: HTMLElement, content: TipContent) => void;
  hide: (target?: HTMLElement) => void;
  /** Swaps the text of the tip that is currently open on `target` (its data changed while hovered). */
  refresh: (target: HTMLElement, content: TipContent) => void;
}

interface Shown {
  target: HTMLElement;
  content: TipContent;
}

const TipContext = createContext<TipApi | null>(null);

/** The single tooltip node (DESIGN_LANGUAGE 6.8): instant, never off-screen, follows its target, never interactive. */
export function TipProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const api = useMemo<TipApi>(
    () => ({
      show: (target, content) => setShown({ target, content }),
      hide: (target) => setShown((cur) => (!target || cur?.target === target ? null : cur)),
      refresh: (target, content) =>
        setShown((cur) => (cur && cur.target === target && JSON.stringify(cur.content) !== JSON.stringify(content) ? { target, content } : cur)),
    }),
    [],
  );

  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, [shown]);

  return (
    <TipContext.Provider value={api}>
      {children}
      {shown && createPortal(<TipBubble shown={shown} onGone={() => setShown(null)} />, document.body)}
    </TipContext.Provider>
  );
}

function TipBubble({ shown, onGone }: { shown: Shown; onGone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { target, content } = shown;

  function place() {
    const el = ref.current;
    if (!el) return;
    const r = target.getBoundingClientRect();
    const pos = placeTip(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    );
    el.style.left = `${Math.round(pos.left)}px`;
    el.style.top = `${Math.round(pos.top)}px`;
    el.style.visibility = 'visible';
  }

  // Placed before paint so the bubble never flashes at the wrong spot; kept on the target while it moves or disappears.
  useLayoutEffect(place, [shown]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (!target.isConnected) return onGone();
      place();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <div ref={ref} className="tip step" role="tooltip" style={{ visibility: 'hidden' }}>
      {(content.title || content.tag) && (
        <div className="tip-head">
          {content.icon && <Icon name={content.icon} />}
          {content.title && <span className="tip-title">{content.title}</span>}
          {content.tag && <span className={`tip-tag tip-tag--${content.tag.tone}`}>{content.tag.text}</span>}
        </div>
      )}
      {content.body && <div className="tip-body">{content.body}</div>}
      {content.lines?.map((line, i) => (
        <div key={i} className={`tip-line${line.tone ? ` tip-line--${line.tone}` : ''}`}>
          {line.icon && <Icon name={line.icon} />}
          <span>{line.text}</span>
        </div>
      ))}
    </div>
  );
}

const NATIVELY_FOCUSABLE = new Set(['button', 'a', 'input', 'select', 'textarea']);

interface TipProps {
  /** A plain string is a title-only tip; null/undefined shows nothing. */
  tip: TipContent | string | null | undefined;
  /** One DOM element: the hover/focus target. */
  children: ReactElement<Record<string, unknown>>;
}

/** Wraps one element and shows `tip` on pointer hover or keyboard focus, with no delay. Replaces every native title attribute. */
export function Tip({ tip, children }: TipProps) {
  const api = useContext(TipContext);
  const content = typeof tip === 'string' ? { title: tip } : tip;
  const hovered = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (api && content && hovered.current) api.refresh(hovered.current, content);
  });
  if (!content || !api) return children;

  const props = children.props as {
    onPointerEnter?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerLeave?: (e: ReactPointerEvent<HTMLElement>) => void;
    onFocus?: (e: FocusEvent<HTMLElement>) => void;
    onBlur?: (e: FocusEvent<HTMLElement>) => void;
    tabIndex?: number;
    className?: string;
  };
  const addsFocus = typeof children.type === 'string' && !NATIVELY_FOCUSABLE.has(children.type) && props.tabIndex === undefined;

  return cloneElement(children, {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
      props.onPointerEnter?.(e);
      hovered.current = e.currentTarget;
      if (e.pointerType !== 'touch') api.show(e.currentTarget, content);
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => {
      props.onPointerLeave?.(e);
      api.hide(e.currentTarget);
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      props.onFocus?.(e);
      // Only keyboard focus (focus-visible) shows the tip; a mouse click that focuses a button must not.
      hovered.current = e.currentTarget;
      if (e.currentTarget.matches(':focus-visible')) api.show(e.currentTarget, content);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      props.onBlur?.(e);
      api.hide(e.currentTarget);
    },
    ...(addsFocus ? { tabIndex: 0, className: `${props.className ?? ''} tip-focus`.trim() } : {}),
  });
}
