import { useEffect } from 'react';

export interface ToastItem {
  id: number;
  icon: string;
  text: string;
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
    const timer = setTimeout(() => onDismiss(toast.id), 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div className="toast-row" onClick={() => onDismiss(toast.id)}>
      <span className="toast-icon">{toast.icon}</span>
      <span>{toast.text}</span>
    </div>
  );
}
