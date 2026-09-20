import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ScrollAreaProps {
  /** Classes of the scrolling element itself (its own overflow, padding, layout). */
  className?: string;
  /** Classes of the wrapper that carries the cue overlays and takes the flex / height role in the parent. */
  wrapClassName?: string;
  children: ReactNode;
}

/**
 * A scrolling region that says when there is more: a fade with a pulsing chevron on the edge that still has content
 * (DESIGN_LANGUAGE pixel scrollbar hint). The cue shows only while content is hidden there and never blocks the pointer.
 */
export function ScrollArea({ className, wrapClassName, children }: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ up: false, down: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const up = el.scrollTop > 2;
      const down = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setMore((m) => (m.up === up && m.down === down ? m : { up, down }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', measure);
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);

  return (
    <div className={`scroll-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      <div ref={ref} className={`scroll-area${className ? ` ${className}` : ''}`}>
        {children}
      </div>
      {more.up && <span className="scroll-cue scroll-cue--up" aria-hidden="true" />}
      {more.down && <span className="scroll-cue scroll-cue--down" aria-hidden="true" />}
    </div>
  );
}
