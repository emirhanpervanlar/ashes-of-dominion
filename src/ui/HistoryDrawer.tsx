interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: string[];
}

export function HistoryDrawer({ open, onClose, title, lines }: Props) {
  if (!open) return null;
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`);
  const newestFirst = [...numbered].reverse();

  return (
    <>
      <div className="history-drawer-backdrop" onClick={onClose} />
      <div className="history-drawer">
        <div className="history-drawer-header">
          <strong>{title}</strong>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="history-drawer-body">
          {newestFirst.length === 0 && <div className="subtitle">No history yet.</div>}
          {newestFirst.map((line, i) => (
            <div key={i} className="history-line">
              {line}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
