import { GOLD_MINE_DAILY_GOLD, MINE, mineDailyGold } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { Modal } from './Modal.js';
import { dailyChange } from './city/cityView.js';

export type GoldRun = Pick<RunState, 'gold' | 'city' | 'army' | 'villages' | 'mines'>;

interface Props {
  run: GoldRun;
  onClose: () => void;
}

/** Explains the daily Gold number behind the resources column: where the income comes from. Nothing costs Gold by the day (the engine has no daily Gold cost), so the costs line says where Gold does go. */
export function GoldPopup({ run, onClose }: Props) {
  const hasMine = run.city.buildings.includes('gold_mine');
  const paying = Math.min(run.mines, MINE.payingMines);
  const net = dailyChange(run).gold;

  return (
    <Modal heading="Gold" onClose={onClose} width={420}>
      <div className="food-popup">
        <div className="food-popup-rows">
          <div className="food-popup-row">
            <span>Stockpile</span>
            <span>{run.gold}</span>
          </div>
          <div className="food-popup-row">
            <span>Gold Mine building</span>
            <span>{hasMine ? `+${GOLD_MINE_DAILY_GOLD}` : 'not built'}</span>
          </div>
          <div className="food-popup-row">
            <span>
              Captured mines: {run.mines}
              {run.mines > paying ? ` (${paying} pay)` : ''}
            </span>
            <span>+{mineDailyGold(run)}</span>
          </div>
          <div className="food-popup-row">
            <span>Daily costs</span>
            <span>none</span>
          </div>
          <div className={`food-popup-row food-popup-net${net < 0 ? ' negative' : ''}`}>
            <span>Net per day</span>
            <span>{net > 0 ? `+${net}` : net}</span>
          </div>
        </div>
        <p className="subtitle">The Gold Mine and every captured mine pay each day you travel. At most {MINE.payingMines} captured mines pay.</p>
        <p className="subtitle">Gold is spent on recruits, buildings, cards and relics. Battles, mines, villages and events bring more.</p>
      </div>
    </Modal>
  );
}
