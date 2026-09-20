import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import { Icon } from './pixel/Icon.js';
import { chainsUrl } from './pixel/chains.js';
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
              <UnitArt unitId={stack.unitId} />
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
        title={def.name}
      >
        <span className="portrait-art">
          <UnitArt unitId={stack.unitId} />
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
        <span className="portrait-role-badge">
          <Icon name={UNIT_ROLE_ICONS[stack.unitId]} />
        </span>
        {selected && (
          <span className="portrait-select-badge">
            <Icon name="ui_check" />
          </span>
        )}
        {states.blocked && (
          <span className="portrait-blocked-badge" title="Blocked by the ally in front">
            <Icon name="ui_blocked" />
          </span>
        )}
        {(stack.block > 0 || stack.statuses.length > 0) && (
          <div className="portrait-statuses">
            {stack.block > 0 && (
              <span className="portrait-status" title="Block">
                <Icon name="shield" />
                <b>{stack.block}</b>
              </span>
            )}
            {stack.statuses.map((st) => (
              <span className="portrait-status" key={st.type} title={st.type}>
                <Icon name={STATUS_ICONS[st.type]} />
                <b>{st.amount}</b>
              </span>
            ))}
          </div>
        )}
        <span className="unit-name">{def.name}</span>
      </div>
      {floatersEl}
    </div>
  );
}
