import { applyDamageToStack, UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS } from './unitShapes.js';
import { STATUS_ICONS, cannotAct } from './stackStatus.js';
import type { Floater } from './FloatingText.js';

interface StackFx {
  acting: boolean;
  hit: boolean;
  block: boolean;
  buff: boolean;
  debuff: boolean;
}

interface StackTileProps {
  stack: ArmyStack | undefined;
  side: 'player' | 'enemy';
  ownArmy?: ArmyStack[];
  selectable: boolean;
  selected: boolean;
  dimmed?: boolean;
  previewDamage?: number;
  fx?: StackFx;
  floaters?: Floater[];
  onClick: () => void;
  onInspect: () => void;
}

/** Disciples-style portrait slot: a bordered portrait square; the unit count is the health readout. */
export function StackTile({
  stack,
  side,
  ownArmy,
  selectable,
  selected,
  dimmed,
  previewDamage,
  fx,
  floaters,
  onClick,
  onInspect,
}: StackTileProps) {
  // Rendered in the wiped branch too so a killing blow's floater still shows.
  const floatersEl = floaters?.map((f) => (
    <span key={f.id} className={`floater floater-${f.kind}`} style={{ animationDelay: `${f.delayMs}ms` }}>
      {f.text}
    </span>
  ));

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
        </div>
        {floatersEl}
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

  const locked = cannotAct(stack, side, ownArmy);

  const classes = ['portrait-slot', side];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');
  if (locked) classes.push('locked');
  if (dimmed) classes.push('dimmed');

  const frameClasses = ['portrait-frame'];
  if (fx?.acting) frameClasses.push('fx-acting');
  if (fx?.hit) frameClasses.push('fx-hit');
  if (fx?.block) frameClasses.push('fx-block');
  if (fx?.buff) frameClasses.push('fx-buff');
  if (fx?.debuff) frameClasses.push('fx-debuff');

  return (
    <div className={classes.join(' ')}>
      <div
        className={frameClasses.join(' ')}
        onClick={selectable ? onClick : undefined}
        onContextMenu={(e) => {
          e.preventDefault();
          onInspect();
        }}
        title={def.name}
      >
        <span className="portrait-art">{UNIT_ICONS[stack.unitId]}</span>
        <span className="portrait-role-badge">{UNIT_ROLE_ICONS[stack.unitId]}</span>
        {selected && <span className="portrait-select-badge">✓</span>}
        {locked && !selected && <span className="portrait-lock-badge">🔒</span>}
        {(stack.block > 0 || stack.statuses.length > 0) && (
          <div className="portrait-statuses">
            {stack.block > 0 && (
              <span className="portrait-status" title="Block">
                🧱<b>{stack.block}</b>
              </span>
            )}
            {stack.statuses.map((st) => (
              <span className="portrait-status" key={st.type} title={st.type}>
                {STATUS_ICONS[st.type]}
                <b>{st.amount}</b>
              </span>
            ))}
          </div>
        )}
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
      {floatersEl}
      <div className="portrait-meta">
        <div className="unit-name">
          {def.name} <span className="unit-count">×{stack.count}</span>
        </div>
      </div>
    </div>
  );
}
