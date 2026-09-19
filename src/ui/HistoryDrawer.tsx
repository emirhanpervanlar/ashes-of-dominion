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
      <div className="modal-backdrop" onClick={onClose} />
      <div className="history-drawer">
        <div className="history-drawer-header">
          <strong>{title}</strong>
          <button className="btn btn--s btn--sq" onClick={onClose}>
            ✕
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
