import { useEffect } from 'react';
import { Icon } from './pixel/Icon.js';
import type { IconName } from './pixel/icons.js';

export interface ToastItem {
  id: number;
  icon: IconName;
  text: string;
  /** Milliseconds on screen; long outcome texts stay longer. */
  ms?: number;
}

interface StackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: StackProps) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.ms ?? 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div className="toast-row" onClick={() => onDismiss(toast.id)}>
      <Icon name={toast.icon} />
      <span>{toast.text}</span>
    </div>
  );
}
