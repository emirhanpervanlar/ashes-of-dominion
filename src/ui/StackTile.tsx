import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import { Icon } from './pixel/Icon.js';
import { chainsUrl } from './pixel/chains.js';
import { Tip } from './Tip.js';
import { blockTip, roleTip, statusTip } from './tipContent.js';
import { UnitArt } from './UnitArt.js';
import { UNIT_ROLE_ICONS } from './unitIcons.js';
import { STATUS_ICONS, stackStates } from './stackStatus.js';
import type { Floater } from './FloatingText.js';

interface StackTileProps {
  stack: ArmyStack | undefined;
  side: 'player' | 'enemy';
  ownArmy?: ArmyStack[];
  selectable: boolean;
  selected: boolean;
  dimmed?: boolean;
  floaters?: Floater[];
  onClick: () => void;
  onInspect: () => void;
}

/** Sprite window is 88x76 (frame 96x112 minus padding, team line and name row). */
const CHAINS = chainsUrl(88, 76);

/** Disciples-style portrait slot: the unit count is the health readout (AO-D004), state is icons and overlays (AO-D024). */
export function StackTile({ stack, side, ownArmy, selectable, selected, dimmed, floaters, onClick, onInspect }: StackTileProps) {
  // Rendered in the wiped branch too so a killing blow's floater still shows.
  const floatersEl = floaters?.map((f) => (
    <span key={f.id} className={`floater floater-${f.kind}`} style={{ animationDelay: `${f.delayMs}ms` }}>
      {f.icon && <Icon name={f.icon} />}
      {f.text}
    </span>
  ));

  if (!stack || stack.count === 0) {
    const classes = ['portrait-slot', side, 'empty'];
    if (stack?.count === 0) classes.push('dead');
    return (
      <div className={classes.join(' ')} data-stack-id={stack?.stackId}>
        <div className="portrait-frame" onClick={selectable ? onClick : undefined}>
          {stack && (
            <span className="portrait-art">
              <UnitArt unitId={stack.unitId} team={side} seed={stack.stackId} />
            </span>
          )}
          <span className="unit-name">{stack ? 'Wiped' : 'Empty'}</span>
        </div>
        {floatersEl}
      </div>
    );
  }

  const def = UNIT_DEFINITIONS[stack.unitId];
  const states = stackStates(stack, side, ownArmy);

  const classes = ['portrait-slot', side];
  if (selectable) classes.push('selectable');
  if (selected) classes.push('selected');
  if (states.acted) classes.push('acted');
  if (states.frozen) classes.push('frozen');
  if (states.chained) classes.push('chained');
  if (states.blocked) classes.push('blocked');
  if (dimmed) classes.push('dimmed');

  return (
    <div className={classes.join(' ')} data-stack-id={stack.stackId}>
      <div
        className="portrait-frame"
        onClick={selectable ? onClick : undefined}
        onContextMenu={(e) => {
          e.preventDefault();
          onInspect();
        }}
      >
        <span className="portrait-art">
          <UnitArt unitId={stack.unitId} team={side} seed={stack.stackId} />
          {states.frozen && (
            <span className="unit-ice" aria-hidden="true">
              <b />
              <b />
              <b />
            </span>
          )}
          {states.chained && <span className="unit-chains" aria-hidden="true" style={{ backgroundImage: CHAINS }} />}
        </span>
        <span className="portrait-count">×{stack.count}</span>
        <Tip tip={roleTip(stack.unitId)}>
          <span className="portrait-role-badge">
            <Icon name={UNIT_ROLE_ICONS[stack.unitId]} />
          </span>
        </Tip>
        {selected && (
          <span className="portrait-select-badge">
            <Icon name="ui_check" />
          </span>
        )}
        {states.blocked && (
          <Tip tip={{ title: 'Blocked', icon: 'ui_blocked', body: 'A melee stack in the back row cannot attack while an ally stands directly in front of it.' }}>
            <span className="portrait-blocked-badge">
              <Icon name="ui_blocked" />
            </span>
          </Tip>
        )}
        {(stack.block > 0 || stack.statuses.length > 0) && (
          <div className="portrait-statuses">
            {stack.block > 0 && (
              <Tip tip={blockTip(stack.block)}>
                <span className="portrait-status">
                  <Icon name="shield" />
                  <b>{stack.block}</b>
                </span>
              </Tip>
            )}
            {stack.statuses.map((st, i) => (
              <Tip key={`${st.type}-${i}`} tip={statusTip(st.type, st.amount, st.duration)}>
                <span className="portrait-status">
                  <Icon name={STATUS_ICONS[st.type]} />
                  <b>{st.amount}</b>
                </span>
              </Tip>
            ))}
          </div>
        )}
        <span className="unit-name">{def.name}</span>
      </div>
      {floatersEl}
    </div>
  );
}
