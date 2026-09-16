import type { HeroSkillDefinition, HeroSkillState } from '../engine/index.js';
import { CARD_COST_LABEL } from './cardText.js';

interface SkillTileProps {
  skillDef: HeroSkillDefinition;
  skillState: HeroSkillState;
  affordable: boolean;
  pending: boolean;
  onClick: () => void;
}

export function SkillTile({ skillDef, skillState, affordable, pending, onClick }: SkillTileProps) {
  const onCooldown = skillState.cooldownRemaining > 0;
  const classes = ['card-tile'];
  if (!affordable || onCooldown) classes.push('disabled');
  if (pending) classes.push('pending');

  return (
    <div className={classes.join(' ')} onClick={affordable && !onCooldown ? onClick : undefined}>
      <div className="card-name">
        <span>{skillDef.name}</span>
        <span className="card-cost">
          {skillDef.cost.amount} {CARD_COST_LABEL[skillDef.cost.type]}
        </span>
      </div>
      <div className="card-text">{skillDef.description}</div>
      {onCooldown && <div className="card-text">Cooldown: {skillState.cooldownRemaining} turn(s)</div>}
    </div>
  );
}
