import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, EnemyIntent, Position } from '../engine/index.js';
import { stackLabel } from './eventText.js';
import type { CombatState } from '../engine/index.js';

interface StackTileProps {
  state: CombatState;
  stack: ArmyStack | undefined;
  position: Position;
  side: 'player' | 'enemy';
  intent?: EnemyIntent;
  selectable: boolean;
  selected: boolean;
  onClick: () => void;
}

export function StackTile({ state, stack, position, side, intent, selectable, selected, onClick }: StackTileProps) {
  if (!stack || stack.count === 0) {
    const classes = ['stack-tile', 'empty', side];
    if (stack?.count === 0) classes.push('dead');
    return (
      <div className={classes.join(' ')} onClick={selectable ? onClick : undefined}>
        {stack ? `${UNIT_DEFINITIONS[stack.unitId].name} — wiped` : `Empty (pos ${position})`}
      </div>
    );
  }

  const def = UNIT_DEFINITIONS[stack.unitId];
  const hpPct = Math.max(0, Math.min(100, (stack.currentHp / stack.maxHp) * 100));
  const blockPct = stack.maxHp > 0 ? Math.min(100, (stack.block / stack.maxHp) * 100) : 0;

  const classes = ['stack-tile', side];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');

  let intentText: string | null = null;
  if (intent) {
    if (intent.kind === 'attack') {
      intentText = `Intent: Attack ${stackLabel(state, intent.targetStackId)} (~${intent.estimatedDamage ?? '?'})`;
    } else {
      intentText = `Intent: Buff ${stackLabel(state, intent.targetStackId)} (+${intent.buffAmount} ${intent.buffStatus})`;
    }
  }

  return (
    <div className={classes.join(' ')} onClick={selectable ? onClick : undefined}>
      <div className="stack-name">
        <span>
          {def.tags.includes('boss') && '☠ '}
          {def.name}
        </span>
        <span className="stack-count">×{stack.count}</span>
      </div>
      <div className="bar">
        <div className={`bar-fill-hp${hpPct < 30 ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
      </div>
      {stack.block > 0 && (
        <div className="bar">
          <div className="bar-fill-block" style={{ width: `${blockPct}%` }} />
        </div>
      )}
      <div className="badges">
        {stack.block > 0 && <span className="badge">Block {stack.block}</span>}
        {stack.morale !== 0 && <span className="badge">Morale {stack.morale > 0 ? '+' : ''}{stack.morale}</span>}
        {stack.statuses.map((s, i) => (
          <span className="badge" key={i}>
            {s.type} {s.amount}
          </span>
        ))}
        {def.scalesWithPlayerArmy && <span className="badge">grows with your army size</span>}
        <span className="badge">pos {position}</span>
      </div>
      {intentText && <div className="intent">{intentText}</div>}
    </div>
  );
}
