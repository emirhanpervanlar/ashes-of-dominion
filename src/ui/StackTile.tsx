import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, EnemyIntent, Position } from '../engine/index.js';
import { stackLabel } from './eventText.js';
import { UNIT_ICONS } from './unitIcons.js';
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
    const classes = ['unit-octagon', 'empty'];
    if (stack?.count === 0) classes.push('dead');
    return (
      <div className="unit-slot">
        <div className={classes.join(' ')} onClick={selectable ? onClick : undefined}>
          {stack && <span className="unit-icon">{UNIT_ICONS[stack.unitId]}</span>}
        </div>
        <div className="unit-label">
          <div className="unit-name">{stack ? `${UNIT_DEFINITIONS[stack.unitId].name} wiped` : 'Empty'}</div>
          <div className="badges">
            <span className="badge">pos {position}</span>
          </div>
        </div>
      </div>
    );
  }

  const def = UNIT_DEFINITIONS[stack.unitId];
  const hpPct = Math.max(0, Math.min(100, (stack.currentHp / stack.maxHp) * 100));
  const blockPct = stack.maxHp > 0 ? Math.min(100, (stack.block / stack.maxHp) * 100) : 0;

  const classes = ['unit-octagon', side];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');

  let intentText: string | null = null;
  if (intent) {
    if (intent.kind === 'attack') {
      intentText = `⚡ ${stackLabel(state, intent.targetStackId)} (~${intent.estimatedDamage ?? '?'})`;
    } else {
      intentText = `✦ ${stackLabel(state, intent.targetStackId)} (+${intent.buffAmount} ${intent.buffStatus})`;
    }
  }

  return (
    <div className="unit-slot">
      <div className={classes.join(' ')} onClick={selectable ? onClick : undefined} title={def.name}>
        <span className="unit-icon">{UNIT_ICONS[stack.unitId]}</span>
        <span className="unit-count">×{stack.count}</span>
      </div>
      <div className="unit-label">
        <div className="bar">
          <div className={`bar-fill-hp${hpPct < 30 ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
        </div>
        {stack.block > 0 && (
          <div className="bar">
            <div className="bar-fill-block" style={{ width: `${blockPct}%` }} />
          </div>
        )}
        <div className="unit-name">{def.name}</div>
        <div className="badges">
          {stack.block > 0 && <span className="badge">Block {stack.block}</span>}
          {stack.morale !== 0 && (
            <span className="badge">
              Morale {stack.morale > 0 ? '+' : ''}
              {stack.morale}
            </span>
          )}
          {stack.statuses.map((s, i) => (
            <span className="badge" key={i}>
              {s.type} {s.amount}
            </span>
          ))}
          <span className="badge">pos {position}</span>
        </div>
        {intentText && <div className="intent">{intentText}</div>}
      </div>
    </div>
  );
}
