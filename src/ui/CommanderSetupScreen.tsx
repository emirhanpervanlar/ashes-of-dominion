import { useState } from 'react';
import { HERO_DEFINITIONS } from '../engine/index.js';
import type { HeroId } from '../engine/index.js';
import { STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { relicIcon } from './relicIcons.js';
import { HERO_PORTRAITS } from './heroIcons.js';

interface Props {
  onBack: () => void;
  onBegin: (heroId: HeroId, heroName: string, relicId: string) => void;
}

const HERO_TAGLINES: Record<HeroId, string> = {
  warlord: 'Elite frontline army. Strength, defense, command.',
  rogue: 'Ranged damage, Dodge, Poison and Execute.',
  mage: 'Magic, control, Mana and healing.',
};

export function CommanderSetupScreen({ onBack, onBegin }: Props) {
  const [step, setStep] = useState<'hero' | 'relic'>('hero');
  const [name, setName] = useState('');
  const [heroId, setHeroId] = useState<HeroId | null>(null);
  const [relicId, setRelicId] = useState<string | null>(null);
  const relics = Object.values(STARTING_RELIC_DEFINITIONS);
  const heroes = Object.values(HERO_DEFINITIONS);

  if (step === 'hero') {
    return (
      <div className="setup-screen commander-select-screen">
        <h1>Your Commander</h1>
        <div className="subtitle">Name your officer, then choose who leads the army.</div>

        <input
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Commander"
          maxLength={20}
          autoFocus
        />

        <div className="commander-select-row">
          {heroes.map((hero) => (
            <div key={hero.id} className={`commander-card${heroId === hero.id ? ' selected' : ''}`} onClick={() => setHeroId(hero.id)}>
              <div className="commander-card-portrait">{HERO_PORTRAITS[hero.id]}</div>
              <div className="commander-card-name">{hero.name}</div>
              <div className="commander-card-desc">{HERO_TAGLINES[hero.id]}</div>
              <div className="hero-stat-line">
                STR {hero.stats.strength} · DEX {hero.stats.dexterity} · INT {hero.stats.intelligence} · VIT {hero.stats.vitality} · WIS{' '}
                {hero.stats.wisdom}
              </div>
              {heroId === hero.id && <div className="commander-selected-badge">✓ Selected</div>}
            </div>
          ))}
        </div>

        <div className="toolbar" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button onClick={onBack}>Back</button>
          <button className="primary begin-journey-btn" disabled={!heroId} onClick={() => heroId && setStep('relic')}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-screen commander-select-screen">
      <h1>Starting Relic</h1>
      <div className="subtitle">Choose how {name.trim() || (heroId ? HERO_DEFINITIONS[heroId].name : 'your Commander')} enters the fractured realm.</div>

      <div className="commander-select-row">
        {relics.map((relic) => (
          <div key={relic.id} className={`commander-card${relicId === relic.id ? ' selected' : ''}`} onClick={() => setRelicId(relic.id)}>
            <div className="commander-card-portrait">{relicIcon(relic.id)}</div>
            <div className="commander-card-name">{relic.name}</div>
            <div className="commander-card-desc">{relic.description}</div>
            {relicId === relic.id && <div className="commander-selected-badge">✓ Selected</div>}
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ justifyContent: 'center', marginTop: 20 }}>
        <button onClick={() => setStep('hero')}>Back</button>
        <button
          className="primary begin-journey-btn"
          disabled={!relicId}
          onClick={() => heroId && relicId && onBegin(heroId, name.trim(), relicId)}
        >
          Begin Journey
        </button>
      </div>
    </div>
  );
}
