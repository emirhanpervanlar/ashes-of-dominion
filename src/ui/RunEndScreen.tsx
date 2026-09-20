import { HERO_DEFINITIONS, UNIT_DEFINITIONS } from '../engine/index.js';
import { runSummary } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';
import { highlights, ratioShare, statGroups } from './runEndView.js';
import { ScrollArea } from './ScrollArea.js';
import { Tip } from './Tip.js';
import { heroStatRows, relicTip } from './tipContent.js';
import { UnitArt } from './UnitArt.js';

interface Props {
  run: RunState;
  onNewRun: () => void;
  onMainMenu: () => void;
}

const n = (value: number): string => value.toLocaleString('en-US');

interface RatioBarProps {
  title: string;
  a: { label: string; value: number };
  b: { label: string; value: number };
}

/** Two numbers as one bar: the first part in gold, the second in blood, with the values under it. */
function RatioBar({ title, a, b }: RatioBarProps) {
  return (
    <div className="ratio">
      <div className="ratio-title">{title}</div>
      <div className="ratio-bar" role="img" aria-label={`${a.label} ${n(a.value)}, ${b.label} ${n(b.value)}`}>
        <i className="ratio-a" style={{ width: `${ratioShare(a.value, b.value)}%` }} />
        <i className="ratio-b" />
      </div>
      <div className="ratio-values">
        <span className="ratio-value--a">
          {a.label} {n(a.value)}
        </span>
        <span className="ratio-value--b">
          {b.label} {n(b.value)}
        </span>
      </div>
    </div>
  );
}

/** Defeat / Run complete: header and buttons stay put, the statistics scroll in between (any viewport keeps the buttons visible). */
export function RunEndScreen({ run, onNewRun, onMainMenu }: Props) {
  const victory = run.phase === 'run_complete';
  const summary = runSummary(run);
  const groups = statGroups(run, summary);
  const army = run.army.filter((s) => s.count > 0);
  const value = (id: string): number => summary.rows.find((r) => r.id === id)?.value ?? 0;

  return (
    <div className="screen run-end" data-screen={victory ? 'victory' : 'defeat'}>
      <header className="run-end-head">
        <h1 className={`plaque plaque--ribbon${victory ? '' : ' plaque--blood'}`}>{victory ? 'Victory' : 'Defeat'}</h1>
        <div className="run-end-cause">{victory ? 'The dominion is yours. The run is complete.' : `${summary.causeLabel}. The run ends here.`}</div>
        <div className="run-end-hero">
          {run.hero.name}, {HERO_DEFINITIONS[run.hero.heroType].name}
        </div>
      </header>

      <ScrollArea wrapClassName="run-end-scroll" className="run-end-content">
        <div className="run-end-body">
          <div className="run-end-highlights">
            {highlights(summary).map((h) => (
              <div key={h.id} className="run-end-highlight">
                <Icon name={h.icon} size={2} />
                <span className="run-end-highlight-value">{n(h.value)}</span>
                <span className="run-end-highlight-label">{h.label}</span>
              </div>
            ))}
          </div>

          <div className="run-end-ratios">
            <RatioBar title="Damage" a={{ label: 'dealt', value: value('damageDealt') }} b={{ label: 'taken', value: value('damageTaken') }} />
            <RatioBar title="Casualties" a={{ label: 'enemies killed', value: value('enemiesKilled') }} b={{ label: 'units lost', value: value('unitsLost') }} />
          </div>

          {groups.map((group) => (
            <section key={group.label} className="run-end-group">
              <div className="setup-label">{group.label}</div>
              <div className="well">
                {group.rows.map((row) => (
                  <div key={row.id} className="row run-end-row">
                    <Icon name={row.icon} />
                    <span className="run-end-row-label">{row.label}</span>
                    <span className="run-end-row-value">{n(row.value)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="run-end-group">
            <div className="setup-label">Final army</div>
            <div className="run-end-strip">
              {army.length === 0 && <span className="run-end-none">Wiped out.</span>}
              {army.map((s) => (
                <Tip key={s.stackId} tip={UNIT_DEFINITIONS[s.unitId].name}>
                  <span className="run-end-stack">
                    <UnitArt unitId={s.unitId} size={1} />
                    <span className="preview-count">x{s.count}</span>
                    <span className="run-end-stack-name">{UNIT_DEFINITIONS[s.unitId].name}</span>
                  </span>
                </Tip>
              ))}
            </div>
          </section>

          <section className="run-end-group">
            <div className="setup-label">Relics collected</div>
            <div className="run-end-strip">
              {run.relics.map((r) => (
                <Tip key={r.id} tip={relicTip(r, relicIcon(r.id))}>
                  <span className={`relic-choice-frame rarity-${r.rarity}`}>
                    <Icon name={relicIcon(r.id)} size={2} />
                  </span>
                </Tip>
              ))}
            </div>
          </section>

          <section className="run-end-group">
            <div className="setup-label">Hero</div>
            <div className="well">
              {heroStatRows(run.hero.stats, run.hero.baseMana).map((row) => (
                <Tip key={row.key} tip={{ title: row.label, icon: row.icon, body: row.effect }}>
                  <div className="row run-end-row">
                    <Icon name={row.icon} />
                    <span className="run-end-row-label">{row.label}</span>
                    <span className="run-end-row-value">{row.value}</span>
                  </div>
                </Tip>
              ))}
              <div className="row run-end-row">
                <Icon name="mana" />
                <span className="run-end-row-label">Max Mana</span>
                <span className="run-end-row-value">{run.hero.maxMana}</span>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>

      <footer className="run-end-foot">
        <button className="btn btn--l" onClick={onMainMenu}>
          Main Menu
        </button>
        <button className="btn btn--l btn--primary" onClick={onNewRun}>
          New Run
        </button>
      </footer>
    </div>
  );
}
