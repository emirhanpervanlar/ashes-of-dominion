import { useState } from 'react';
import { HERO_DEFINITIONS, UNIT_DEFINITIONS } from '../engine/index.js';
import type { HeroId } from '../engine/index.js';
import { STARTING_RELIC_DEFINITIONS, previewStart, startingRelicList } from '../engine/run/index.js';
import { HERO_ICONS } from './heroIcons.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';
import { Tip } from './Tip.js';
import { heroStatRows, relicTip } from './tipContent.js';
import { UnitArt } from './UnitArt.js';

interface Props {
  onBack: () => void;
  onBegin: (heroId: HeroId, heroName: string, relicId: string) => void;
}

const HERO_TAGLINES: Record<HeroId, string> = {
  warlord: 'Elite frontline army. Strength, defense, command.',
  rogue: 'Ranged damage, Dodge, Poison and Execute.',
  mage: 'Magic, control, Mana and healing.',
};

const ROWS = [
  ['Front', [1, 2, 3]],
  ['Back', [4, 5, 6]],
] as const;

/** Commander name, hero and starting relic on one screen (AO-D029) with a live preview of the run they start (AO-031 `previewStart`). */
export function HeroSetupScreen({ onBack, onBegin }: Props) {
  const heroes = Object.values(HERO_DEFINITIONS);
  const relics = startingRelicList();
  const [name, setName] = useState('');
  const [heroId, setHeroId] = useState<HeroId>(heroes[0]!.id);
  const [relicId, setRelicId] = useState(relics[0]!.id);
  const nameReady = name.trim().length > 0;
  const preview = previewStart(heroId, relicId);

  return (
    <div className="screen" data-screen="hero">
      <div className="hero-setup">
        <div className="hero-setup-head">
          <h1>Your Commander</h1>
          <input
            className="input name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Commander name"
            aria-label="Commander name"
            maxLength={20}
            autoFocus
          />
        </div>

        <div className="hero-setup-main">
          <div className="hero-setup-choices">
            <div className="setup-label">Choose your hero</div>
            <div className="hero-choice-row">
              {heroes.map((hero) => (
                <button key={hero.id} className={`hero-choice${heroId === hero.id ? ' selected' : ''}`} onClick={() => setHeroId(hero.id)}>
                  <span className="hero-choice-top">
                    <span className="hero-choice-portrait step">
                      <Icon name={HERO_ICONS[hero.id]} size={4} />
                    </span>
                    <span className="hero-choice-title">
                      <span className="hero-choice-name">{hero.name}</span>
                      <span className="hero-choice-desc">{HERO_TAGLINES[hero.id]}</span>
                    </span>
                  </span>
                  <span className="hero-stat-table">
                    {heroStatRows(hero.stats, hero.baseMana).map((row) => (
                      <Tip key={row.key} tip={{ title: row.label, icon: row.icon, body: row.effect }}>
                        <span className="hero-stat-row">
                          <Icon name={row.icon} />
                          <span className="hero-stat-label">{row.label}</span>
                          <span className="hero-stat-value">{row.value}</span>
                        </span>
                      </Tip>
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <div className="setup-label">Choose your relic</div>
            <div className="relic-choice-list">
              {relics.map((relic) => (
                <button key={relic.id} className={`relic-choice rarity-${relic.rarity}${relicId === relic.id ? ' selected' : ''}`} onClick={() => setRelicId(relic.id)}>
                  <Tip tip={relicTip(STARTING_RELIC_DEFINITIONS[relic.id]!, relicIcon(relic.id))}>
                    <span className="relic-choice-frame">
                      <Icon name={relicIcon(relic.id)} size={3} />
                    </span>
                  </Tip>
                  <span className="relic-choice-text">
                    <span className="relic-choice-name">{relic.name}</span>
                    <span className="relic-choice-desc">{relic.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {preview && (
            <div className="panel panel--stone step-8 start-preview">
              <div className="setup-label">Your starting army</div>
              <div className="preview-army">
                {ROWS.map(([label, row]) => (
                  <div key={label} className="preview-row">
                    <span className="preview-row-label">{label}</span>
                    {row.map((position) => {
                      const stack = preview.army.find((s) => s.position === position);
                      return (
                        <div key={position} className={`preview-slot${stack ? '' : ' empty'}`}>
                          {stack && (
                            <>
                              <UnitArt unitId={stack.unitId} size={2} />
                              <span className="preview-count">x{stack.count}</span>
                              <span className="preview-unit">{UNIT_DEFINITIONS[stack.unitId].name}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="well preview-stats">
                <div className="row preview-stat">
                  <Icon name="crest" />
                  <span>Units</span>
                  <b>{preview.totalUnits}</b>
                </div>
                <div className="row preview-stat">
                  <Icon name="mana" />
                  <span>Max Mana</span>
                  <b>{preview.maxMana}</b>
                </div>
                <div className="row preview-stat">
                  <Icon name="gold" />
                  <span>Gold</span>
                  <b>{preview.gold}</b>
                </div>
                <div className="row preview-stat">
                  <Icon name="food" />
                  <span>Food</span>
                  <b>{preview.food}</b>
                </div>
              </div>
              <div className="preview-relic">
                <span className="preview-relic-name">{preview.relic.name}</span>
                {preview.relic.effectSummary.map((line) => (
                  <span key={line} className="preview-relic-line">
                    {line}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hero-setup-foot">
          {!nameReady && <span className="setup-hint">Enter a commander name to start.</span>}
          <button className="btn" onClick={onBack}>
            Back
          </button>
          <button className="btn btn--l btn--primary" disabled={!nameReady} onClick={() => nameReady && onBegin(heroId, name.trim(), relicId)}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
