import { applyDamageToStack, UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, EnemyIntent, Position } from '../engine/index.js';
import { stackLabel } from './eventText.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS, UNIT_SHAPES } from './unitShapes.js';
import type { CombatState } from '../engine/index.js';

interface StackFx {
  acting: boolean;
  hit: boolean;
  block: boolean;
  buff: boolean;
  debuff: boolean;
}

interface StackTileProps {
  state: CombatState;
  stack: ArmyStack | undefined;
  position: Position;
  side: 'player' | 'enemy';
  intent?: EnemyIntent;
  selectable: boolean;
  selected: boolean;
  dimmed?: boolean;
  threatened?: boolean;
  previewDamage?: number;
  fx?: StackFx;
  onClick: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export function StackTile({
  state,
  stack,
  position,
  side,
  intent,
  selectable,
  selected,
  dimmed,
  threatened,
  previewDamage,
  fx,
  onClick,
  onHoverStart,
  onHoverEnd,
}: StackTileProps) {
  if (!stack || stack.count === 0) {
    const classes = ['unit-octagon', 'empty'];
    if (stack) classes.push(`shape-${UNIT_SHAPES[stack.unitId]}`);
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

  let previewHpLossPct = 0;
  let previewBlockLossPct = 0;
  if (previewDamage && previewDamage > 0) {
    const resolution = applyDamageToStack(stack, def.hpPerUnit, previewDamage);
    previewBlockLossPct = stack.maxHp > 0 ? Math.min(100, (resolution.blocked / stack.maxHp) * 100) : 0;
    previewHpLossPct = stack.maxHp > 0 ? Math.min(100, ((stack.currentHp - resolution.stack.currentHp) / stack.maxHp) * 100) : 0;
  }

  const classes = ['unit-octagon', side, `shape-${UNIT_SHAPES[stack.unitId]}`];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');
  if (threatened) classes.push('threatened');
  if (fx?.acting) classes.push('fx-acting');
  if (fx?.hit) classes.push('fx-hit');
  if (fx?.block) classes.push('fx-block');
  if (fx?.buff) classes.push('fx-buff');
  if (fx?.debuff) classes.push('fx-debuff');

  const slotClasses = ['unit-slot'];
  if (dimmed) slotClasses.push('dimmed');

  let intentText: string | null = null;
  if (intent) {
    if (intent.kind === 'attack') {
      intentText = `⚡ ${stackLabel(state, intent.targetStackId)} (~${intent.estimatedDamage ?? '?'})`;
    } else {
      intentText = `✦ ${stackLabel(state, intent.targetStackId)} (+${intent.buffAmount} ${intent.buffStatus})`;
    }
  }

  return (
    <div className={slotClasses.join(' ')} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      <div className={classes.join(' ')} onClick={selectable ? onClick : undefined} title={def.name}>
        {fx?.acting && intentText && <div className="acting-intent-bubble">{intentText}</div>}
        <span className="unit-icon">{UNIT_ICONS[stack.unitId]}</span>
        <span className="unit-role-badge">{UNIT_ROLE_ICONS[stack.unitId]}</span>
        {selected && <span className="unit-selected-badge">✓</span>}
      </div>
      <div className="unit-label">
        <div className="bar">
          <div className={`bar-fill-hp${hpPct < 30 ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
          {previewHpLossPct > 0 && (
            <div className="bar-fill-preview" style={{ width: `${previewHpLossPct}%`, left: `${hpPct - previewHpLossPct}%` }} />
          )}
        </div>
        {(stack.block > 0 || previewBlockLossPct > 0) && (
          <div className="bar">
            <div className="bar-fill-block" style={{ width: `${blockPct}%` }} />
            {previewBlockLossPct > 0 && (
              <div className="bar-fill-preview" style={{ width: `${previewBlockLossPct}%`, left: `${blockPct - previewBlockLossPct}%` }} />
            )}
          </div>
        )}
        <div className="unit-name">
          {def.name} <span className="unit-count">×{stack.count}</span>
        </div>
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
