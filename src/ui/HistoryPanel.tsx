interface Props {
  title: string;
  lines: string[];
  collapsed?: boolean;
  onToggle?: () => void;
}

export function HistoryPanel({ title, lines, collapsed, onToggle }: Props) {
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`);
  const newestFirst = [...numbered].reverse();

  return (
    <div className={`history-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="history-header" onClick={onToggle}>
        <span>{title}</span>
        {onToggle && <span>{collapsed ? '▸' : '▾'}</span>}
      </div>
      {!collapsed && (
        <div className="history-body">
          {newestFirst.length === 0 && <div className="subtitle">No history yet.</div>}
          {newestFirst.map((line, i) => (
            <div key={i} className="history-line">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
