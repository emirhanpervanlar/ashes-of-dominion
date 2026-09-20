import { UNIT_DEFINITIONS } from '../engine/index.js';
import { dailyFoodNet, dailyProduction, dailyUpkeep, foodDaysLeft, stackUpkeep, starvationForecast } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';

export type FoodRun = Pick<RunState, 'army' | 'city' | 'food' | 'starvationDays'>;

interface Props {
  run: FoodRun;
  onClose: () => void;
}

/** Explains the daily Food numbers behind the resources column: upkeep per stack, production, net, days left, starvation forecast. */
export function FoodPopup({ run, onClose }: Props) {
  const upkeep = dailyUpkeep(run);
  const production = dailyProduction(run);
  const net = dailyFoodNet(run);
  const daysLeft = foodDaysLeft(run);
  const forecast = starvationForecast(run);
  const hasStable = run.city.buildings.includes('stable');
  const stacks = run.army.filter((s) => s.count > 0);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="popup panel panel--stone step-8 food-popup">
        <button className="btn modal-close" onClick={onClose}>
          <Icon name="ui_close" />
        </button>
        <h3>
          <Icon name="food" /> Food
        </h3>
        <div className="food-popup-rows">
          <div className="food-popup-row">
            <span>Stockpile</span>
            <span>{run.food}</span>
          </div>
          {stacks.map((s) => (
            <div key={s.stackId} className="food-popup-row food-popup-sub">
              <span>
                {UNIT_DEFINITIONS[s.unitId].name} ×{s.count}
              </span>
              <span>{stackUpkeep(s).toFixed(1)}</span>
            </div>
          ))}
          <div className="food-popup-row">
            <span>Army upkeep per day{hasStable ? ' (Stable -25%)' : ''}</span>
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
    </>
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
