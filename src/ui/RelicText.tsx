import type { RelicDefinition } from '../engine/index.js';
import { relicBenefit } from './tipContent.js';

type RelicTextSource = Pick<RelicDefinition, 'description' | 'drawbacks'>;

/** A relic's benefit text in the normal colour, with each drawback on its own red line. */
export function RelicText({ relic }: { relic: RelicTextSource }) {
  return (
    <span className="relic-text">
      <span className="relic-benefit">{relicBenefit(relic)}</span>
      {relic.drawbacks?.map((text) => (
        <span key={text} className="relic-drawback">
          {text}
        </span>
      ))}
    </span>
  );
}
