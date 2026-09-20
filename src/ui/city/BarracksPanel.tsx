import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../../engine/index.js';
import type { UnitId } from '../../engine/index.js';
import { dailyUpkeep, totalArmyCount } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';
import { Tip } from '../Tip.js';
import { unitCountText } from '../runEventText.js';
import { roleTip } from '../tipContent.js';
import { UnitArt } from '../UnitArt.js';
import { UNIT_ROLE_ICONS } from '../unitIcons.js';
import { UNIT_DESCRIPTIONS } from '../unitText.js';
import { MAX_RECRUIT, RECRUITABLE_UNITS, placementText, recruitQuote } from './cityView.js';

interface Props {
  run: RunState;
  /** The last recruit, shown as a confirmation line. */
  recent: { unitId: UnitId; amount: number } | null;
  onRecruit: (unitId: UnitId, count: number) => void;
  onClose: () => void;
}

const fmt = (n: number): string => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** Barracks: one card per unit with a quantity stepper, the total in Gold and Food, and where the recruits will go. */
export function BarracksPanel({ run, recent, onRecruit, onClose }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const stacks = run.army.filter((s) => s.count > 0);

  return (
    <Modal heading="Barracks" material="wood" onClose={onClose} width={920}>
      <div className="city-barracks-strip well step">
        <span className="city-strip-item">
          <Icon name="gold" /> {run.gold}
        </span>
        <span className="city-strip-item">
          <Icon name="food" /> {run.food}
        </span>
        <span className="city-strip-item">
          <Icon name="slots" /> Army {stacks.length} of 6 stacks, {totalArmyCount(stacks)} units
        </span>
        <span className="city-strip-item">
          <Icon name="food" /> Eats {dailyUpkeep(run)} a day
        </span>
      </div>
      <p className="city-note">A recruit joins the stack of its type, or takes the first free slot. With 6 stacks and no stack of that type there is no room.</p>

      <div className="city-recruits">
        {RECRUITABLE_UNITS.map((unitId) => {
          const def = UNIT_DEFINITIONS[unitId];
          const count = counts[unitId] ?? 1;
          const quote = recruitQuote(run, unitId, count);
          const existing = stacks.find((s) => s.unitId === unitId)?.count ?? 0;
          const set = (n: number) => setCounts({ ...counts, [unitId]: Math.max(1, Math.min(MAX_RECRUIT, n)) });
          return (
            <div key={unitId} className="city-recruit step">
              <div className="city-recruit-art well step">
                <UnitArt unitId={unitId} size={3} />
                <Tip tip={roleTip(unitId)}>
                  <span className="city-recruit-role">
                    <Icon name={UNIT_ROLE_ICONS[unitId]} />
                  </span>
                </Tip>
              </div>
              <div className="city-recruit-name">{def.name}</div>
              <p className="city-recruit-desc">{UNIT_DESCRIPTIONS[unitId]}</p>
              <div className="city-recruit-stats">
                <span>
                  <Icon name="hp" /> HP {def.hpPerUnit}
                </span>
                <span>
                  <Icon name="damage" /> Damage {def.damage}
                </span>
                <span>
                  <Icon name="role_melee" /> Attack {def.attack}
                </span>
                <span>
                  <Icon name="shield" /> Defense {def.defense}
                </span>
              </div>
              <div className="city-recruit-cost">
                <span>
                  <Icon name="gold" /> {fmt(quote.goldPerUnit)} each
                </span>
                <span>
                  <Icon name="food" /> {quote.foodPerUnit} each
                </span>
                <span className="city-recruit-upkeep">Then eats {quote.upkeepPerUnit} Food a day</span>
              </div>

              <div className="city-stepper">
                <button className="btn btn--s btn--sq" aria-label={`Fewer ${def.name}`} disabled={count <= 1} onClick={() => set(count - 1)}>
                  -
                </button>
                <input
                  className="input city-stepper-input"
                  type="number"
                  min={1}
                  max={MAX_RECRUIT}
                  aria-label={`${def.name} count`}
                  value={count}
                  onChange={(e) => set(Number(e.target.value) || 1)}
                />
                <button className="btn btn--s btn--sq" aria-label={`More ${def.name}`} disabled={count >= quote.maxAffordable} onClick={() => set(count + 1)}>
                  +
                </button>
                <button className="btn btn--s" disabled={quote.maxAffordable < 1} onClick={() => set(quote.maxAffordable)}>
                  Max
                </button>
              </div>

              <div className="city-recruit-total">
                <span className={run.gold < quote.gold ? 'city-cost--short' : ''}>
                  <Icon name="gold" /> {quote.gold}
                </span>
                <span className={run.food < quote.food ? 'city-cost--short' : ''}>
                  <Icon name="food" /> {quote.food}
                </span>
              </div>
              <p className="city-recruit-place">{placementText(quote, existing, def.name)}</p>
              <button className="btn btn--primary city-recruit-btn" disabled={!!quote.blocker} onClick={() => onRecruit(unitId, count)}>
                Recruit {count}
              </button>
              <div className="city-blocker city-recruit-blocker">{quote.blocker && !(quote.placement === 'full') ? quote.blocker : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="city-recent">{recent ? `Recruited ${unitCountText(recent.unitId, recent.amount)}.` : ''}</div>
    </Modal>
  );
}
