import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

const FIRST_REPEAT_MS = 400;
const FASTEST_REPEAT_MS = 50;

/** The next value after one step, held inside [min, max] (max below min collapses to min). */
export function stepValue(value: number, delta: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.max(min, max), value + delta));
}

/** Delay before the next repeat while a button is held: starts slow, speeds up 20% per repeat, never below the floor. */
export function holdDelay(repeats: number): number {
  return Math.max(FASTEST_REPEAT_MS, Math.round(FIRST_REPEAT_MS * 0.8 ** repeats));
}

/** Pointer handlers that step once on press, then keep stepping (faster and faster) while the button is held. Keyboard clicks step once. */
function useHoldRepeat(onStep: () => void) {
  const step = useRef(onStep);
  step.current = onStep;
  const timer = useRef<number | undefined>(undefined);
  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    window.removeEventListener('pointerup', stop);
  }, []);
  useEffect(() => stop, [stop]);

  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      step.current();
      let repeats = 0;
      const tick = () => {
        step.current();
        timer.current = window.setTimeout(tick, holdDelay(++repeats));
      };
      timer.current = window.setTimeout(tick, FIRST_REPEAT_MS);
      // The button may be disabled (and stop hearing the pointer) once the limit is reached, so listen on the window.
      window.addEventListener('pointerup', stop);
    },
    onPointerCancel: stop,
    // Pointer clicks were already handled on press; only a keyboard activation (detail 0) steps here.
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) step.current();
    },
  };
}

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Accessible name of the thing being counted ("Swordsman"). */
  label: string;
}

/** Big [-] number [+] control with hold-to-repeat; the number is shown, never typed. */
export function QuantityStepper({ value, min, max, onChange, label }: Props) {
  const less = useHoldRepeat(() => onChange(stepValue(value, -1, min, max)));
  const more = useHoldRepeat(() => onChange(stepValue(value, 1, min, max)));
  return (
    <div className="quantity-stepper" role="group" aria-label={`${label} count`}>
      <button className="btn btn--sq quantity-stepper-btn" aria-label={`Fewer ${label}`} disabled={value <= min} {...less}>
        -
      </button>
      <output className="quantity-stepper-value well" aria-live="polite">
        {value}
      </output>
      <button className="btn btn--sq quantity-stepper-btn" aria-label={`More ${label}`} disabled={value >= max} {...more}>
        +
      </button>
    </div>
  );
}
