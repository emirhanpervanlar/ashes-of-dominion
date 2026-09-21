import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CARD_DEFINITIONS, HERO_DEFINITIONS, UNIT_DEFINITIONS, cardRequirement, heroSpellScaling } from '../engine/index.js';
import type { CardDefinition, HeroCastStat, HeroStats } from '../engine/index.js';
import { CardInfoContext } from './cardInfoContext.js';
import type { CardInfoOptions } from './cardInfoContext.js';
import { cardView } from './cardView.js';
import { POLARITY_ICONS, cardVisual } from './cardVisuals.js';
import { LargeCard } from './LargeCard.js';
import { Modal } from './Modal.js';
import { Icon } from './pixel/Icon.js';

const POLARITY_NAMES = { attack: 'Attack', defense: 'Defense', buff: 'Buff', debuff: 'Debuff', utility: 'Utility' } as const;
const STAT_NAMES: Record<HeroCastStat, string> = { strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence' };
const RARITY_NAMES: Record<CardDefinition['rarity'], string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

function sourceLabel(def: CardDefinition): string {
  switch (def.source.type) {
    case 'unit':
      return `${UNIT_DEFINITIONS[def.source.unitId].name} skill`;
    case 'hero':
      return `${HERO_DEFINITIONS[def.source.heroId].name} card`;
    case 'neutral':
      return 'Neutral card';
  }
}

interface Open {
  cardId: string;
  options: CardInfoOptions;
}

/** Hosts the card info popup: any card in the game calls `useCardInfo().open(...)` on right-click. */
export function CardInfoProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [heroStats, setHeroStats] = useState<HeroStats | null>(null);
  const api = useMemo(() => ({ open: (cardId: string, options: CardInfoOptions = {}) => setOpen({ cardId, options }), setHeroStats }), []);
  return (
    <CardInfoContext.Provider value={api}>
      {children}
      {open && <CardInfoPopup cardId={open.cardId} options={open.options} heroStats={heroStats} onClose={() => setOpen(null)} />}
    </CardInfoContext.Provider>
  );
}

/** The change a hero stat makes to a scaling card's damage, e.g. "Intelligence 18: +40% spell damage" (AO-D088). */
function scalingText(stat: HeroCastStat, value: number): string {
  const percent = Math.round((heroSpellScaling(value) - 1) * 100);
  return `${STAT_NAMES[stat]} ${value}: ${percent === 0 ? 'no change to' : `${percent > 0 ? '+' : ''}${percent}%`} spell damage.`;
}

function CardInfoPopup({ cardId, options, heroStats, onClose }: { cardId: string; options: CardInfoOptions; heroStats: HeroStats | null; onClose: () => void }) {
  const { upgraded, playability } = options;
  const def = CARD_DEFINITIONS[cardId];
  const view = cardView(cardId, upgraded);
  if (!def || !view) return null;
  const polarity = cardVisual(cardId).polarity;
  const requirement = cardRequirement(cardId);

  return (
    <Modal heading={view.name} trim onClose={onClose} width={640}>
      <div className="card-info">
        <LargeCard cardId={cardId} upgraded={upgraded} inspectable={false} showRequirement={false} />
        <div className="card-info-side">
          <div className="card-info-type">
            <Icon name={POLARITY_ICONS[polarity]} />
            <span>{POLARITY_NAMES[polarity]}</span>
            <span className="card-info-dot" />
            <span>{RARITY_NAMES[def.rarity]}</span>
          </div>
          <div className="card-info-source">{sourceLabel(def)}</div>
          <p className="card-info-text">{view.description}</p>
          <ul className="card-info-keywords">
            <li>
              Costs <b>{view.manaCost}</b> Mana.
              {view.manaCost < view.baseManaCost && <span className="card-info-upgraded"> (was {view.baseManaCost})</span>}
            </li>
            {view.scalesWith && (
              <li>
                Scales with <b>{STAT_NAMES[view.scalesWith]}</b>.{heroStats && <> {scalingText(view.scalesWith, heroStats[view.scalesWith])}</>}
              </li>
            )}
            {def.exhaust &&<li>Exhaust: removed for the rest of the battle once played.</li>}
            {def.retain && <li>Retain: stays in your hand at the end of the turn.</li>}
            {upgraded && <li className="card-info-upgraded">Upgraded.</li>}
          </ul>
          {(requirement || playability) && (
            <div className="well card-info-cond">
              {requirement && (
                <div className="card-info-cond-line">
                  <Icon name="ui_warn" />
                  <span>{requirement}.</span>
                </div>
              )}
              {playability && (
                <div className={`card-info-cond-line ${playability.playable ? 'good' : 'bad'}`}>
                  <Icon name={playability.playable ? 'ui_check' : 'ui_blocked'} />
                  <span>{playability.playable ? 'Playable right now.' : playability.reason}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
