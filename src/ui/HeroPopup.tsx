import { HERO_DEFINITIONS } from '../engine/index.js';
import type { RunState } from '../engine/run/index.js';
import { HeroArt } from './HeroArt.js';
import { Modal } from './Modal.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';
import { Tip } from './Tip.js';
import { heroStatRows, relicTip } from './tipContent.js';

/** Hero stats popup (AO-D040): portrait, the five stats with what each does, Mana, relics. Level/XP is a marked placeholder until AO-D030. */
export function HeroPopup({ run, onClose }: { run: Pick<RunState, 'hero' | 'relics'>; onClose: () => void }) {
  const { hero, relics } = run;
  const rows = heroStatRows(hero.stats, hero.baseMana);

  return (
    <Modal heading={hero.name} trim onClose={onClose} width={620}>
      <div className="hero-popup">
        <div className="hero-popup-side">
          <div className="hero-popup-portrait step">
            <HeroArt heroId={hero.heroType} size={3} />
          </div>
          <div className="hero-popup-class">{HERO_DEFINITIONS[hero.heroType].name}</div>
        </div>
        <div className="hero-popup-main">
          <div className="well hero-popup-stats">
            {rows.map((row) => (
              <div key={row.key} className="row hero-popup-stat">
                <Icon name={row.icon} />
                <span className="hero-popup-stat-name">{row.label}</span>
                <span className="hero-popup-stat-value">{row.value}</span>
                <span className="hero-popup-stat-effect">{row.effect}</span>
              </div>
            ))}
            <div className="row hero-popup-stat">
              <Icon name="mana" />
              <span className="hero-popup-stat-name">Mana</span>
              <span className="hero-popup-stat-value">{hero.maxMana}</span>
              <span className="hero-popup-stat-effect">Spent to play cards. Refills every turn.</span>
            </div>
          </div>
          <div className="hero-popup-label">Relics</div>
          <div className="hero-popup-relics">
            {relics.length === 0 && <span className="hero-popup-none">None yet.</span>}
            {relics.map((r) => (
              <Tip key={r.id} tip={relicTip(r, relicIcon(r.id))}>
                <span className={`hero-popup-relic rarity-${r.rarity}`}>
                  <Icon name={relicIcon(r.id)} size={2} />
                </span>
              </Tip>
            ))}
          </div>
          <div className="hero-popup-label">Level / XP</div>
          <div className="hero-popup-coming">Coming soon</div>
        </div>
      </div>
    </Modal>
  );
}
