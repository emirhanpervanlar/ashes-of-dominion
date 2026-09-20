import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { UnitId } from '../engine/index.js';
import { STABLE_FOOD_DISCOUNT, dailyFoodNet, dailyProduction, foodDaysLeft, starvationForecast } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { Modal } from './Modal.js';
import { Icon } from './pixel/Icon.js';
import { foodBreakdown } from './foodView.js';

export type FoodRun = Pick<RunState, 'army' | 'city' | 'food' | 'starvationDays'>;

interface Props {
  run: FoodRun;
  onClose: () => void;
}

/** Explains the daily Food numbers behind the resources column: upkeep per stack, production, net, days left, starvation forecast. */
export function FoodPopup({ run, onClose }: Props) {
  const food = foodBreakdown(run);
  const upkeep = food.upkeep;
  const production = dailyProduction(run);
  const net = dailyFoodNet(run);
  const daysLeft = foodDaysLeft(run);
  const forecast = starvationForecast(run);

  return (
    <Modal heading="Food" onClose={onClose} width={420}>
      <div className="food-popup">
        <div className="food-popup-rows">
          <div className="food-popup-row">
            <span>Stockpile</span>
            <span>{run.food}</span>
          </div>
          {food.stacks.map((s) => (
            <div key={s.stackId} className="food-popup-row food-popup-sub">
              <span>
                {UNIT_DEFINITIONS[s.unitId as UnitId].name} ×{s.count}
              </span>
              <span>{s.food.toFixed(1)}</span>
            </div>
          ))}
          <div className="food-popup-row food-popup-sub">
            <span>Together</span>
            <span>{food.subtotal.toFixed(1)}</span>
          </div>
          <div className="food-popup-row">
            <span>Rounded to whole Food</span>
            <span>-{food.rounded}/day</span>
          </div>
          {food.stableApplied && (
            <div className="food-popup-row">
              <span>Stable -{Math.round(STABLE_FOOD_DISCOUNT * 100)}%</span>
              <span>-{food.upkeep}/day</span>
            </div>
          )}
          <div className="food-popup-row">
            <span>Army upkeep per day</span>
            <span>-{upkeep}</span>
          </div>
          <div className="food-popup-row">
            <span>Farm production per day</span>
            <span>+{production}</span>
          </div>
          <div className={`food-popup-row food-popup-net${net < 0 ? ' negative' : ''}`}>
            <span>Net per day</span>
            <span>{net > 0 ? `+${net}` : net}</span>
          </div>
        </div>
        {daysLeft > 0 && (
          <p className="subtitle">{daysLeft === Infinity ? 'Your Food supply is stable.' : `Food lasts ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}.`}</p>
        )}
        <p className="subtitle">Every day of marching costs the upkeep; the Farm is added first. Unfed armies starve.</p>
        {(forecast.willStarve || forecast.consecutiveDays > 0) && (
          <div className="food-popup-warn">
            <Icon name="ui_warn" /> <StarvationLines forecast={forecast} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export function StarvationLines({ forecast }: { forecast: ReturnType<typeof starvationForecast> }) {
  return (
    <span>
      {forecast.willStarve
        ? `The next day starves the army: about ${forecast.expectedDeaths} ${forecast.expectedDeaths === 1 ? 'unit' : 'units'} will die.`
        : `Starvation streak: ${forecast.consecutiveDays} ${forecast.consecutiveDays === 1 ? 'day' : 'days'}.`}
      {forecast.moraleMalus > 0
        ? ` Battle Morale -${forecast.moraleMalus}.`
        : forecast.willStarve && forecast.moraleMalusIfStarves > 0
          ? ` Battle Morale would drop by ${forecast.moraleMalusIfStarves}.`
          : ''}
    </span>
  );
}
