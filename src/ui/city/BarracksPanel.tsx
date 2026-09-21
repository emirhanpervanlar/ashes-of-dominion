import { Fragment, useState } from 'react';
import { MAX_ARMY_STACKS, UNIT_DEFINITIONS } from '../../engine/index.js';
import type { UnitId } from '../../engine/index.js';
import { GARRISON, ROMAN, dailyUpkeep, recruitBlocker, totalArmyCount } from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { Icon } from '../pixel/Icon.js';
import { Modal } from '../Modal.js';
import { QuantityStepper } from '../QuantityStepper.js';
import { Tip } from '../Tip.js';
import { unitCountText } from '../runEventText.js';
import { roleTip } from '../tipContent.js';
import { UnitArt } from '../UnitArt.js';
import { UNIT_ROLE_ICONS } from '../unitIcons.js';
import { UNIT_DESCRIPTIONS } from '../unitText.js';
import { MAX_RECRUIT, RECRUITABLE_UNITS, barracksRows, daysToGarrison, placementText, recruitQuote } from './cityView.js';

interface Props {
  run: RunState;
  /** The last recruit, shown as a confirmation line. */
  recent: { unitId: UnitId; amount: number } | null;
  onRecruit: (unitId: UnitId, count: number) => void;
  onUpgrade: () => void;
  onClose: () => void;
}

const fmt = (n: number): string => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

const TIER_TAG = { built: 'Built', next: 'Next', locked: 'Locked' } as const;

/** Barracks (a fixed building, AO-D080): the tier upgrade sits on top of both tabs (AO-D086); a Recruit tab with one card per unit (locked ones greyed) and a quantity stepper, and a Tiers tab comparing what each tier adds. The waiting garrison is collected in the bottom bar. */
export function BarracksPanel({ run, recent, onRecruit, onUpgrade, onClose }: Props) {
  const [tab, setTab] = useState<'recruit' | 'tiers'>('recruit');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const stacks = run.army.filter((s) => s.count > 0);
  const tier = run.city.barracksTier;
  const rows = barracksRows(tier);
  const next = rows.find((r) => r.state === 'next') ?? null;
  const days = daysToGarrison(run.day);

  return (
    <Modal heading="Barracks" material="wood" onClose={onClose} width={920}>
      <div className="city-barracks-strip well step">
        <span className="city-strip-item city-strip-item--big">
          <Icon name="gold" size={2} /> {run.gold} Gold
        </span>
        <span className="city-strip-item city-strip-item--big">
          <Icon name="food" size={2} /> {run.food} Food
        </span>
        <span className="city-strip-item">
          <Icon name="slots" /> Army {stacks.length} of {MAX_ARMY_STACKS} stacks, {totalArmyCount(stacks)} units
        </span>
        <span className="city-strip-item">
          <Icon name="food" /> Eats {dailyUpkeep(run)} a day
        </span>
      </div>

      <div className="city-barracks-upgrade well step">
        <span className="city-strip-item city-strip-item--big">
          <Icon name="bld_barracks" /> Tier {ROMAN[tier - 1]} of {rows.length}
        </span>
        {next ? (
          <>
            <span className="city-strip-item">
              Next: Tier {ROMAN[next.tier - 1]}, recruit {UNIT_DEFINITIONS[next.unitId].name}, +{next.weekly} a week
            </span>
            <span className={`city-strip-item city-cost${run.gold < next.cost ? ' city-cost--short' : ''}`}>
              <Icon name="gold" /> {next.cost}
            </span>
            <button className="btn btn--primary btn--s" disabled={run.gold < next.cost} onClick={onUpgrade}>
              Upgrade to {next.label}
            </button>
            {run.gold < next.cost && (
              <span className="city-blocker">
                <Icon name="ui_warn" /> Not enough Gold ({next.cost} needed).
              </span>
            )}
          </>
        ) : (
          <span className="city-strip-item">Max tier: every unit is unlocked.</span>
        )}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'recruit'} className={`tab${tab === 'recruit' ? ' active' : ''}`} onClick={() => setTab('recruit')}>
          Recruit
        </button>
        <button role="tab" aria-selected={tab === 'tiers'} className={`tab${tab === 'tiers' ? ' active' : ''}`} onClick={() => setTab('tiers')}>
          Tiers
        </button>
      </div>

      {tab === 'tiers' && (
        <>
          <p className="city-note">
            Free soldiers wait in the city and are collected from the Garrison block in the bottom bar. It grows every {GARRISON.intervalDays} days (next arrival in {days} {days === 1 ? 'day' : 'days'}, on day {run.day + days}) and holds at most {GARRISON.capWeeks} weeks of each type.
          </p>
          <div className="city-ladder well step">
            {rows.map((row) => (
              <div key={row.tier} className={`city-ladder-row city-ladder-row--${row.state}`}>
                <span className="city-ladder-num gem">{ROMAN[row.tier - 1]}</span>
                <UnitArt unitId={row.unitId} size={1} />
                <span className="city-ladder-info">
                  <span className="city-ladder-bonus">{UNIT_DEFINITIONS[row.unitId].name}</span>
                  <span className="city-ladder-tier">Recruit, +{row.weekly} a week</span>
                </span>
                {row.state === 'next' && (
                  <span className={`city-cost${run.gold < row.cost ? ' city-cost--short' : ''}`}>
                    <Icon name="gold" /> {row.cost}
                  </span>
                )}
                <span className={`city-tag city-tag--${row.state}`}>{TIER_TAG[row.state]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'recruit' && (
        <>
          <p className="city-note city-recruit-note">A recruit joins the stack of its type, or takes the first free slot. With {MAX_ARMY_STACKS} stacks and no stack of that type there is no room.</p>

          <div className="city-recruits">
            {RECRUITABLE_UNITS.map((unitId) => {
              const def = UNIT_DEFINITIONS[unitId];
              const unlockTier = RECRUITABLE_UNITS.indexOf(unitId) + 1;
              const locked = unlockTier > tier;
              const count = counts[unitId] ?? 1;
              const quote = recruitQuote(run, unitId, count);
              const existing = stacks.find((s) => s.unitId === unitId)?.count ?? 0;
              const set = (n: number) => setCounts({ ...counts, [unitId]: Math.max(1, Math.min(MAX_RECRUIT, n)) });
              const card = (
                <div className={`city-recruit step${locked ? ' city-recruit--locked' : ''}`} data-unit={unitId}>
                  <div className="city-recruit-art well step">
                    <UnitArt unitId={unitId} />
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
                  {locked ? (
                    <div className="city-recruit-lock">
                      <Icon name="ui_blocked" /> Unlocks at tier {ROMAN[unlockTier - 1]}
                    </div>
                  ) : (
                    <>
                      <div className="city-recruit-cost">
                        <span>
                          <Icon name="gold" /> {fmt(quote.goldPerUnit)} each
                        </span>
                        <span>
                          <Icon name="food" /> {quote.foodPerUnit} each
                        </span>
                        <span className="city-recruit-upkeep">Then eats {quote.upkeepPerUnit} Food a day</span>
                      </div>

                      <QuantityStepper value={count} min={1} max={Math.max(1, quote.maxAffordable)} onChange={set} label={def.name} />

                      <div className="city-recruit-total">
                        <button className="btn btn--s" disabled={quote.maxAffordable < 1} onClick={() => set(quote.maxAffordable)}>
                          Max
                        </button>
                        <span className={run.gold < quote.gold ? 'city-cost--short' : ''}>
                          <Icon name="gold" /> {quote.gold}
                        </span>
                        <span className={run.food < quote.food ? 'city-cost--short' : ''}>
                          <Icon name="food" /> {quote.food}
                        </span>
                      </div>
                      <p className="city-recruit-place">{placementText(quote, existing, def.name)}</p>
                      <button
                        className="btn btn--primary city-recruit-btn"
                        disabled={!!quote.blocker}
                        onClick={() => {
                          onRecruit(unitId, count);
                          set(1);
                        }}
                      >
                        Recruit {count}
                      </button>
                      {quote.blocker && quote.placement !== 'full' && <div className="city-blocker city-recruit-blocker">{quote.blocker}</div>}
                    </>
                  )}
                </div>
              );
              return locked ? (
                <Tip key={unitId} tip={recruitBlocker(run, unitId, 1) ?? ''}>
                  {card}
                </Tip>
              ) : (
                <Fragment key={unitId}>{card}</Fragment>
              );
            })}
          </div>

          <div className="city-recent">{recent ? `Recruited ${unitCountText(recent.unitId, recent.amount)}.` : ''}</div>
        </>
      )}
    </Modal>
  );
}
