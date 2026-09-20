import { useState } from 'react';
import { HERO_DEFINITIONS } from '../engine/index.js';
import type { HeroId, HeroStats } from '../engine/index.js';
import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { relicIcon } from './relicIcons.js';
import { HERO_ICONS } from './heroIcons.js';
import { Icon } from './pixel/Icon.js';
import type { IconName } from './pixel/icons.js';

interface Props {
  onBack: () => void;
  onBegin: (heroId: HeroId, heroName: string, relicId: string) => void;
}

const HERO_TAGLINES: Record<HeroId, string> = {
  warlord: 'Elite frontline army. Strength, defense, command.',
  rogue: 'Ranged damage, Dodge, Poison and Execute.',
  mage: 'Magic, control, Mana and healing.',
};

const HERO_STAT_ROWS: { key: keyof HeroStats; label: string; icon: IconName; hint: string }[] = [
  { key: 'strength', label: 'Strength', icon: 'role_melee', hint: 'Melee damage' },
  { key: 'dexterity', label: 'Dexterity', icon: 'role_ranged', hint: 'Ranged damage and Dodge' },
  { key: 'intelligence', label: 'Intelligence', icon: 'role_caster', hint: 'Magic damage' },
  { key: 'vitality', label: 'Vitality', icon: 'hp', hint: 'Toughness' },
  { key: 'wisdom', label: 'Wisdom', icon: 'role_support', hint: 'Healing and max Mana' },
];

export function CommanderSetupScreen({ onBack, onBegin }: Props) {
  const [step, setStep] = useState<'hero' | 'relic'>('hero');
  const [name, setName] = useState('');
  const [heroId, setHeroId] = useState<HeroId | null>(null);
  const [relicId, setRelicId] = useState<string | null>(null);
  const relics = Object.values(STARTING_RELIC_DEFINITIONS);
  const heroes = Object.values(HERO_DEFINITIONS);
  const nameReady = name.trim().length > 0;

  if (step === 'hero') {
    return (
      <div className="screen" data-screen="hero">
       <div className="setup-screen">
        <h1>Your Commander</h1>
        <div className="subtitle">Name your officer, then choose who leads the army.</div>

        <input
          className="input name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Commander"
          maxLength={20}
          autoFocus
        />

        <div className="commander-select-row">
          {heroes.map((hero) => (
            <div key={hero.id} className={`commander-card${heroId === hero.id ? ' selected' : ''}`} onClick={() => setHeroId(hero.id)}>
              <div className="commander-card-portrait">
                <Icon name={HERO_ICONS[hero.id]} size={4} />
              </div>
              <div className="commander-card-name">{hero.name}</div>
              <div className="commander-card-desc">{HERO_TAGLINES[hero.id]}</div>
              <div className="hero-stat-table">
                {HERO_STAT_ROWS.map((row) => (
                  <div key={row.key} className="hero-stat-row" title={row.hint}>
                    <Icon name={row.icon} />
                    <span className="hero-stat-label">{row.label}</span>
                    <span className="hero-stat-value">{hero.stats[row.key]}</span>
                  </div>
                ))}
              </div>
              {heroId === hero.id && (
                <div className="commander-selected-badge">
                  <Icon name="ui_check" /> Selected
                </div>
              )}
            </div>
          ))}
        </div>

        {!nameReady && <div className="setup-hint">Enter a commander name to continue.</div>}

        <div className="toolbar">
          <button className="btn" onClick={onBack}>
            Back
          </button>
          <button className="btn btn--primary" disabled={!heroId || !nameReady} onClick={() => heroId && nameReady && setStep('relic')}>
            Continue
          </button>
        </div>
       </div>
      </div>
    );
  }

  return (
    <div className="screen" data-screen="hero">
     <div className="setup-screen">
      <h1>Starting Relic</h1>
      <div className="subtitle">Choose how {name.trim() || (heroId ? HERO_DEFINITIONS[heroId].name : 'your Commander')} enters the fractured realm.</div>

      <div className="commander-select-row">
        {relics.map((relic) => (
          <div key={relic.id} className={`commander-card${relicId === relic.id ? ' selected' : ''}`} onClick={() => setRelicId(relic.id)}>
            <div className="commander-card-portrait">
              <Icon name={relicIcon(relic.id)} size={3} />
            </div>
            <div className="commander-card-name">{relic.name}</div>
            <div className="commander-card-desc">{relic.description}</div>
            {relicId === relic.id && (
              <div className="commander-selected-badge">
                <Icon name="ui_check" /> Selected
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn" onClick={() => setStep('hero')}>
          Back
        </button>
        <button
          className="btn btn--primary"
          disabled={!relicId || !nameReady}
          onClick={() => heroId && relicId && nameReady && onBegin(heroId, name.trim(), relicId)}
        >
          Begin Journey
        </button>
      </div>
     </div>
    </div>
  );
}
