import { Icon } from './pixel/Icon.js';

interface Props {
  open: boolean;
  onClose: () => void;
  heading: string;
  lines: string[];
}

export function HistoryDrawer({ open, onClose, heading, lines }: Props) {
  if (!open) return null;
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`);
  const newestFirst = [...numbered].reverse();

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="history-drawer">
        <div className="history-drawer-header">
          <strong>{heading}</strong>
          <button className="btn btn--s btn--sq" onClick={onClose}>
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
