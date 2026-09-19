import { CARD_DEFINITIONS, UNIT_DEFINITIONS } from '../engine/index.js';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../engine/run/index.js';
import type { RunEvent } from '../engine/run/index.js';

function relicName(relicId: string): string {
  return RELIC_DEFINITIONS[relicId]?.name ?? STARTING_RELIC_DEFINITIONS[relicId]?.name ?? relicId;
}

function cardName(cardId: string): string {
  return CARD_DEFINITIONS[cardId]?.name ?? cardId;
}

function unitName(unitId: string): string {
  return UNIT_DEFINITIONS[unitId as keyof typeof UNIT_DEFINITIONS]?.name ?? unitId;
}

/** Plain-text history line for a RunEvent, or null to omit it (noise). */
export function describeRunEvent(event: RunEvent): string | null {
  switch (event.type) {
    case 'RUN_STARTED':
    case 'STARTING_RELIC_CHOSEN':
      return null; // already visible in the sidebar's Relics list — noise in the history feed
    case 'MOVED':
      return `Moved onward (−${event.foodCost} Food).`;
    case 'STARVING':
      return `Starving — lost ${event.unitsLost} unit(s).`;
    case 'RESOURCE_FOUND':
      return `Found a cache: +${event.gold} Gold, +${event.food} Food.`;
    case 'ARRIVED_AT_NODE':
      return null; // redundant with MOVED/RESOURCE_FOUND/etc.
    case 'BATTLE_WON':
      return 'Battle won!';
    case 'BATTLE_LOST':
      return 'Battle lost.';
    case 'RELIC_CLAIMED':
      return `Claimed relic: ${relicName(event.relicId)}.`;
    case 'CARD_REWARD_CLAIMED':
      return `Added card to deck: ${cardName(event.cardId)}.`;
    case 'CARD_UPGRADED':
      return `Upgraded ${cardName(event.fromCardId)} → ${cardName(event.toCardId)}.`;
    case 'REWARD_SKIPPED':
      return 'Skipped the reward.';
    case 'CARD_REMOVED':
      return `Removed ${cardName(event.cardId)} from the deck${event.goldPaid > 0 ? ` for ${event.goldPaid}g` : ''}.`;
    case 'UNITS_REVIVED':
      return `Revived ${event.count} fallen unit(s) after the battle.`;
    case 'DAILY_INCOME':
      return `Gold Mine income: +${event.gold} Gold.`;
    case 'MAGE_TOWER_UPGRADED':
      return `Mage Tower upgraded to tier ${event.tier}.`;
    case 'EVENT_RESOLVED':
      if (event.outcome === 'search_relic') return `Search: found a relic!`;
      if (event.outcome === 'search_trap') return `Search: it was a trap!`;
      if (event.outcome === 'search_nothing_left') return `Search: nothing left to find.`;
      return `Event choice: ${event.optionId}.`;
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
    default:
      return null;
  }
}
