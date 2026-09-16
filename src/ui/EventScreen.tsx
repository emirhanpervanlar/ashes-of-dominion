import { EVENT_DEFINITIONS } from '../engine/run/index.js';

interface Props {
  eventId: string;
  onChoose: (optionId: string) => void;
}

export function EventScreen({ eventId, onChoose }: Props) {
  const def = EVENT_DEFINITIONS[eventId];
  if (!def) return null;

  return (
    <div>
      <h1>{def.title}</h1>
      <div className="subtitle">{def.description}</div>
      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {def.options.map((option) => (
          <div key={option.id} className="card-tile" style={{ minWidth: 220, cursor: 'pointer' }} onClick={() => onChoose(option.id)}>
            <div className="card-name">
              <span>{option.label}</span>
            </div>
            <div className="card-text">{option.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
