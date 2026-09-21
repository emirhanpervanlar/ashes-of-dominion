import { CARD_DEFINITIONS, UNIT_DEFINITIONS } from '../engine/index.js';
import { RELIC_DEFINITIONS, ROMAN, STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import { villageDailyFood, villageMilitiaPerWeek } from '../engine/run/villages.js';
import type { RunEvent, UnitCount } from '../engine/run/index.js';

function relicName(relicId: string): string {
  return RELIC_DEFINITIONS[relicId]?.name ?? STARTING_RELIC_DEFINITIONS[relicId]?.name ?? relicId;
}

function cardName(cardId: string): string {
  return CARD_DEFINITIONS[cardId]?.name ?? cardId;
}

function unitName(unitId: string): string {
  return UNIT_DEFINITIONS[unitId as keyof typeof UNIT_DEFINITIONS]?.name ?? unitId;
}

const IRREGULAR_PLURALS: Record<string, string> = { Swordsman: 'Swordsmen', Wolf: 'Wolves' };

/** "3 Swordsmen" / "1 Archer". */
export function unitCountText(unitId: string, count: number): string {
  const name = unitName(unitId);
  return `${count} ${count === 1 ? name : (IRREGULAR_PLURALS[name] ?? `${name}s`)}`;
}

/** "3 Swordsmen, 1 Archer" per unit type. */
export function unitCountsText(counts: UnitCount[]): string {
  return counts.map((c) => unitCountText(c.unitId, c.count)).join(', ');
}

/** Plain-text history line for a RunEvent, or null to omit it (noise). */
export function describeRunEvent(event: RunEvent): string | null {
  switch (event.type) {
    case 'RUN_STARTED':
    case 'STARTING_RELIC_CHOSEN':
      return null; // already visible in the sidebar's Relics list — noise in the history feed
    case 'MOVED':
      return `Moved onward (−${event.foodCost} Food).`;
    case 'STARVED':
      return `${unitCountsText(event.deaths)} starved (starving day ${event.consecutiveDays}).`;
    case 'MINE_CAPTURED':
      return `Mine captured: +${event.gold} Gold, +${event.food} Food, ${event.mines} ${event.mines === 1 ? 'mine' : 'mines'}.`;
    case 'ARRIVED_AT_NODE':
      return null; // redundant with MOVED/MINE_CAPTURED/etc.
    case 'BATTLE_WON':
      return 'Battle won!';
    case 'BATTLE_LOST':
      return 'Battle lost.';
    case 'BATTLE_LOOT':
      return event.food > 0 ? `Loot: +${event.gold} Gold, +${event.food} Food.` : `Loot: +${event.gold} Gold.`;
    case 'BOSS_DEFEATED':
      return `The chapter ${event.chapter} boss has fallen.`;
    case 'CHAPTER_STARTED':
      return `Chapter ${event.chapter} begins.`;
    case 'CITY_VISITED':
      return event.free ? `Visited the city. First visit: no Threat increase (Threat ${event.threat}).` : `Visited the city. Threat is now ${event.threat}: enemies grew stronger.`;
    case 'THREAT_CHANGED':
      return `Threat ${event.delta > 0 ? 'rose' : 'fell'} to ${event.threat}.`;
    case 'RELIC_CLAIMED':
      return `Claimed relic: ${relicName(event.relicId)}.`;
    case 'CARD_REWARD_CLAIMED':
      return `Added card to deck: ${cardName(event.cardId)}.`;
    case 'CARD_UPGRADED':
      return `Upgraded ${cardName(event.cardId)}.`;
    case 'CARD_REMOVED':
      return `Removed ${cardName(event.cardId)} from the deck${event.goldPaid > 0 ? ` for ${event.goldPaid}g` : ''}.`;
    case 'UNITS_REVIVED':
      return `Revived ${event.count} fallen unit(s) after the battle.`;
    case 'UNITS_RAISED':
      return event.count === 1 ? '1 fallen soldier rose as a Skeleton.' : `${event.count} fallen soldiers rose as Skeletons.`;
    case 'DAILY_INCOME': {
      const parts = [event.gold > 0 && `+${event.gold} Gold`, event.food > 0 && `+${event.food} Food`].filter(Boolean);
      return parts.length ? `Daily income: ${parts.join(', ')}.` : null;
    }
    case 'FARM_UPGRADED':
      return `Farm upgraded to tier ${event.tier}.`;
    case 'BARRACKS_UPGRADED':
      return `Barracks upgraded to tier ${ROMAN[event.tier - 1]}.`;
    case 'GARRISON_GROWN':
      return `The garrison grew: ${unitCountsText(event.units)} are waiting in the city.`;
    case 'GARRISON_COLLECTED':
      return `Collected ${unitCountText(event.unitId, event.count)} from the garrison.`;
    case 'FOOD_PURCHASED':
      return `Bought ${event.packs} ${event.packs === 1 ? 'Food pack' : 'Food packs'} (+${event.food} Food) for ${event.gold} Gold.`;
    case 'VILLAGE_RAIDED':
      return `Raided a village: +${event.gold} Gold, +${event.food} Food.`;
    case 'VILLAGE_HELPED':
      return `Helped a village: +${event.gold} Gold, +${event.food} Food. Helped villages now send ${villageDailyFood(event)} Food every day and ${villageMilitiaPerWeek(event)} militia every week (${event.villages} helped).`;
    case 'MAGE_TOWER_UPGRADED':
      return `Mage Tower upgraded to tier ${event.tier}.`;
    case 'EVENT_RESOLVED':
      return event.text;
    case 'UNITS_GAINED':
      return `${unitCountText(event.unitId, event.count)} joined the army.`;
    case 'UNITS_LOST':
      return `Lost ${unitCountText(event.unitId, event.count)}.`;
    case 'UNITS_DISMISSED':
      return `Dismissed ${unitCountText(event.unitId, event.count)}.`;
    case 'UNIT_GAIN_DECLINED':
      return `Turned away ${unitCountText(event.unitId, event.count)}.`;
    case 'ITEM_PURCHASED':
      return `Bought ${cardName(event.itemId) !== event.itemId ? cardName(event.itemId) : relicName(event.itemId)} for ${event.price}g.`;
    case 'UNITS_RECRUITED':
      return `Recruited ${event.count} ${unitName(event.unitId)} to the army.`;
    case 'BUILDING_BUILT':
      return `Built ${event.buildingId.replace(/_/g, ' ')}.`;
    case 'CITY_LEVELED_UP':
      return `City reached Level ${event.level}.`;
    case 'DOCTRINE_CHOSEN':
      return `Chose ${event.doctrineId.replace(/_/g, ' ')} Doctrine.`;
    case 'RUN_COMPLETE':
      return 'Run complete — victory!';
    case 'ACTION_REJECTED':
      return null;
  }
}
