import { EVENT_DEFINITIONS } from '../engine/run/index.js';

interface Props {
  eventId: string;
  onChoose: (optionId: string) => void;
}

export function EventScreen({ eventId, onChoose }: Props) {
  const def = EVENT_DEFINITIONS[eventId];
  if (!def) return null;

  return (
    <div className="screen event-overlay" data-screen="vault">
      <div className="event-badge">?</div>
      <div className="plaque plaque--ribbon">{def.title}</div>
      <div className="panel panel--parch step-8 event-description">{def.description}</div>

      <div className="event-options">
        {def.options.map((option) => (
          <div key={option.id} className="event-option-card" onClick={() => onChoose(option.id)}>
            <div className="event-option-label">{option.label}</div>
            <div className="event-option-desc">{option.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
