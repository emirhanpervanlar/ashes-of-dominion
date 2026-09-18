import { applyDamageToStack, UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, EnemyIntent, Position } from '../engine/index.js';
import { stackLabel } from './eventText.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS } from './unitShapes.js';
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

/** Disciples-style portrait slot: a bordered portrait square with HP printed below it. */
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
    const classes = ['portrait-slot', side, 'empty'];
    if (stack?.count === 0) classes.push('dead');
    return (
      <div className={classes.join(' ')}>
        <div className="portrait-frame" onClick={selectable ? onClick : undefined}>
          {stack && <span className="portrait-art">{UNIT_ICONS[stack.unitId]}</span>}
        </div>
        <div className="portrait-meta">
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

  const acted = side === 'player' && stack.actedThisTurn;

  const classes = ['portrait-slot', side];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');
  if (threatened) classes.push('threatened');
  if (acted) classes.push('acted');
  if (dimmed) classes.push('dimmed');

  const frameClasses = ['portrait-frame'];
  if (fx?.acting) frameClasses.push('fx-acting');
  if (fx?.hit) frameClasses.push('fx-hit');
  if (fx?.block) frameClasses.push('fx-block');
  if (fx?.buff) frameClasses.push('fx-buff');
  if (fx?.debuff) frameClasses.push('fx-debuff');

  let intentText: string | null = null;
  if (intent) {
    if (intent.kind === 'attack') {
      intentText = `⚡ ${stackLabel(state, intent.targetStackId)} (~${intent.estimatedDamage ?? '?'})`;
    } else {
      intentText = `✦ ${stackLabel(state, intent.targetStackId)} (+${intent.buffAmount} ${intent.buffStatus})`;
    }
  }

  return (
    <div className={classes.join(' ')} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      <div className={frameClasses.join(' ')} onClick={selectable ? onClick : undefined} title={def.name}>
        {fx?.acting && intentText && <div className="acting-intent-bubble">{intentText}</div>}
        <span className="portrait-art">{UNIT_ICONS[stack.unitId]}</span>
        <span className="portrait-role-badge">{UNIT_ROLE_ICONS[stack.unitId]}</span>
        {selected && <span className="portrait-select-badge">✓</span>}
        {acted && !selected && <span className="portrait-acted-badge" title="Already acted this turn">💤</span>}
        <div className="portrait-hp-strip">
          <div className={`bar-fill-hp${hpPct < 30 ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
          {previewHpLossPct > 0 && (
            <div className="bar-fill-preview" style={{ width: `${previewHpLossPct}%`, left: `${hpPct - previewHpLossPct}%` }} />
          )}
        </div>
        {(stack.block > 0 || previewBlockLossPct > 0) && (
          <div className="portrait-block-strip">
            <div className="bar-fill-block" style={{ width: `${blockPct}%` }} />
            {previewBlockLossPct > 0 && (
              <div className="bar-fill-preview" style={{ width: `${previewBlockLossPct}%`, left: `${blockPct - previewBlockLossPct}%` }} />
            )}
          </div>
        )}
      </div>
      <div className="portrait-hp-text">
        {stack.currentHp}/{stack.maxHp}
      </div>
      <div className="portrait-meta">
        <div className="unit-name">
          {def.name} <span className="unit-count">×{stack.count}</span>
        </div>
        <div className="badges">
          {stack.block > 0 && <span className="badge">Block {stack.block}</span>}
          {stack.morale !== 100 && <span className="badge">Morale {stack.morale}</span>}
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
