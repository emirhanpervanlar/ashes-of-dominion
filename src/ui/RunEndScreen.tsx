import { HERO_DEFINITIONS, UNIT_DEFINITIONS } from '../engine/index.js';
import { runSummary } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';
import type { IconName } from './pixel/icons.js';
import { relicIcon } from './relicIcons.js';
import { Tip } from './Tip.js';
import { heroStatRows, relicTip } from './tipContent.js';
import { UnitArt } from './UnitArt.js';

interface Props {
  run: RunState;
  onNewRun: () => void;
  onMainMenu: () => void;
}

/** Where each `runSummary` row is shown: the engine orders the rows, the UI only groups and decorates them. */
const GROUPS: { label: string; rows: Record<string, IconName> }[] = [
  {
    label: 'Battle',
    rows: {
      battlesWon: 'node_battle',
      elitesDefeated: 'node_elite',
      bossesDefeated: 'node_boss',
      enemiesKilled: 'fx_skull',
      damageDealt: 'damage',
      damageTaken: 'hp',
      turnsPlayed: 'ui_swap',
      cardsPlayed: 'deck',
    },
  },
  {
    label: 'Journey',
    rows: {
      chapter: 'crest',
      days: 'day',
      eventsResolved: 'node_event',
      threat: 'threat',
      largestStack: 'role_tank',
      unitsLost: 'fx_skull',
      unitsStarved: 'food',
      unitsRevived: 'heal',
    },
  },
  { label: 'Economy', rows: { goldGathered: 'gold', foodGathered: 'food', foodEaten: 'food', relics: 'relic' } },
];

export function RunEndScreen({ run, onNewRun, onMainMenu }: Props) {
  const victory = run.phase === 'run_complete';
  const summary = runSummary(run);
  const rowById = new Map(summary.rows.map((r) => [r.id, r]));
  const army = run.army.filter((s) => s.count > 0);

  return (
    <div className="screen run-end" data-screen={victory ? 'victory' : 'defeat'}>
      <div className="run-end-body">
        <h1 className={`plaque plaque--ribbon${victory ? '' : ' plaque--blood'}`}>{victory ? 'Victory' : 'Defeat'}</h1>
        <div className="run-end-cause">{victory ? 'The dominion is yours. The run is complete.' : `${summary.causeLabel}. The run ends here.`}</div>
        <div className="run-end-hero">
          {run.hero.name}, {HERO_DEFINITIONS[run.hero.heroType].name}
        </div>

        <div className="run-end-groups">
          {GROUPS.map((group) => (
            <div key={group.label} className="run-end-group">
              <div className="setup-label">{group.label}</div>
              <div className="well">
                {Object.entries(group.rows).flatMap(([id, icon]) => {
                  const row = rowById.get(id);
                  return row
                    ? [
                        <div key={id} className="row run-end-row">
                          <Icon name={icon} />
                          <span className="run-end-row-label">{row.label}</span>
                          <span className="run-end-row-value">{row.value}</span>
                        </div>,
                      ]
                    : [];
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="run-end-group">
          <div className="setup-label">Relics collected</div>
          <div className="run-end-relics">
            {run.relics.map((r) => (
              <Tip key={r.id} tip={relicTip(r, relicIcon(r.id))}>
                <span className={`relic-choice-frame rarity-${r.rarity}`}>
                  <Icon name={relicIcon(r.id)} size={2} />
                </span>
              </Tip>
            ))}
          </div>
        </div>

        <div className="run-end-loadout">
          <div className="run-end-group">
            <div className="setup-label">Final army</div>
            <div className="run-end-army">
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
          </div>

          <div className="run-end-group">
            <div className="setup-label">Hero</div>
            <div className="well run-end-hero-stats">
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
          </div>
        </div>

        <div className="toolbar">
          <button className="btn btn--l" onClick={onMainMenu}>
            Main Menu
          </button>
          <button className="btn btn--l btn--primary" onClick={onNewRun}>
            New Run
          </button>
        </div>
      </div>
    </div>
  );
}
