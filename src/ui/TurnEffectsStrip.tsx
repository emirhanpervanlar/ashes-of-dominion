import type { ArmyStack } from '../engine/index.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';
import { turnEffects } from './turnEffects.js';

/** "Turn effects" strip in the battle top bar: the buffs the army carries now (they end with the turn or when used). */
export function TurnEffects({ army }: { army: ArmyStack[] }) {
  const effects = turnEffects(army);
  if (effects.length === 0) return null;
  return (
    <div className="turn-effects" aria-label="Turn effects">
      <span className="turn-effects-label">Turn effects</span>
      {effects.map((e) => (
        <Tip key={e.id} tip={e.tip}>
          <span className="turn-chip" tabIndex={0}>
            <Icon name={e.icon} />
            {e.text}
          </span>
        </Tip>
      ))}
    </div>
  );
}
