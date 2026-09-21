import type { PendingVillage } from '../engine/run/index.js';
import { VILLAGE } from '../engine/run/villages.js';
import { villageHelpGain } from './tipContent.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';
import { VillageScene } from './VillageScene.js';

interface Props {
  offer: PendingVillage;
  gold: number;
  food: number;
  threat: number;
  /** Villages already helped this run. */
  helped: number;
  onRaid: () => void;
  onHelp: () => void;
}

/** A village on the road (AO-D072): raid it for Gold and Food now at the price of Threat, or help it for a smaller gift and a permanent village. */
export function VillageScreen({ offer, gold, food, threat, helped, onRaid, onHelp }: Props) {
  const gain = villageHelpGain(helped);
  return (
    <div className="screen village-overlay" data-screen="village">
      <VillageScene />
      <div className="village-topbar">
        <div className="plaque plaque--ribbon">Village</div>
        <div className="village-topbar-stats">
          <span className="pill pill--gold">
            <Icon name="gold" /> {gold}
          </span>
          <span className="pill">
            <Icon name="food" /> {food}
          </span>
        </div>
      </div>

      <p className="village-lead">Smoke rises from a small village. Its people watch you come. {helped > 0 ? `You have helped ${helped} ${helped === 1 ? 'village' : 'villages'} so far.` : ''}</p>

      <div className="village-choices">
        <section className="village-choice village-choice--raid panel panel--wood step-8" data-choice="raid">
          <h3 className="village-choice-title">Raid</h3>
          <p className="village-choice-text">Take what you can carry.</p>
          <div className="village-rewards">
            <span className="pill pill--gold">
              <Icon name="gold" /> +{offer.raid.gold} Gold
            </span>
            <span className="pill">
              <Icon name="food" /> +{offer.raid.food} Food
            </span>
          </div>
          <Tip tip={{ title: 'Threat', icon: 'threat', body: `Threat rises by ${offer.raid.threat}: every enemy army you meet from now on is bigger.` }}>
            <div className="village-warn">
              <Icon name="threat" /> Threat +{offer.raid.threat} (now {threat}, then {threat + offer.raid.threat})
            </div>
          </Tip>
          <button className="btn btn--danger btn--l" onClick={onRaid}>
            Raid the village
          </button>
        </section>

        <section className="village-choice village-choice--help panel panel--wood step-8" data-choice="help">
          <h3 className="village-choice-title">Help</h3>
          <p className="village-choice-text">Lend a hand and the village remembers.</p>
          <div className="village-rewards">
            <span className="pill pill--gold">
              <Icon name="gold" /> +{offer.help.gold} Gold
            </span>
            <span className="pill">
              <Icon name="food" /> +{offer.help.food} Food
            </span>
          </div>
          <ul className="village-perks">
            <li>
              <Icon name="food" /> +{gain.food} Food per day, for the rest of the run
            </li>
            <li>
              <Icon name="garrison" />{' '}
              {gain.militia > 0
                ? `+${gain.militia} militia per week in the city garrison (only the first ${VILLAGE.militiaVillageCap} villages send any)`
                : `No more militia: ${VILLAGE.militiaVillageCap} villages already send the most`}
            </li>
          </ul>
          <button className="btn btn--primary btn--l" onClick={onHelp}>
            Help the village
          </button>
        </section>
      </div>
    </div>
  );
}
