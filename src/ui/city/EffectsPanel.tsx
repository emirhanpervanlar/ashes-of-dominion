import type { RunState } from '../../engine/run/index.js';
import { Icon } from '../pixel/Icon.js';
import { activeEffects, dailyChange } from './cityView.js';

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/** Everything the built buildings and the doctrine do right now (AO-D062), worded from engine data in cityView.ts. */
export function EffectsPanel({ run }: { run: Pick<RunState, 'city' | 'army' | 'villages' | 'mines'> }) {
  const effects = activeEffects(run);
  const daily = dailyChange(run);
  return (
    <aside className="city-effects panel panel--wood step-8" aria-label="Active effects">
      <h3>Active effects</h3>
      <div className="city-effects-list well step">
        {effects.length === 0 ? (
          <p className="city-effects-empty">Nothing yet. Every building you raise, and the doctrine you choose, adds its effect here.</p>
        ) : (
          effects.map((effect) => (
            <div key={effect.id} className="city-effect">
              <span className="city-effect-icon">
                <Icon name={effect.icon} size={2} />
              </span>
              <span className="city-effect-text">
                <span className="city-effect-name">{effect.title}</span>
                <span className="city-effect-desc">{effect.text}</span>
              </span>
            </div>
          ))
        )}
      </div>
      <div className="city-daily">
        <span className="t-label-text">Per day</span>
        <span className={`city-daily-item${daily.gold > 0 ? ' city-daily-item--good' : ''}`}>
          <Icon name="gold" /> {signed(daily.gold)}
        </span>
        <span className={`city-daily-item${daily.food < 0 ? ' city-daily-item--bad' : ' city-daily-item--good'}`}>
          <Icon name="food" /> {signed(daily.food)}
        </span>
      </div>
    </aside>
  );
}
