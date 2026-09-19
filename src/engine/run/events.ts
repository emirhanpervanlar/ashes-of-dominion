import { CARD_DEFINITIONS } from '../data/cards.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { nextInt } from '../rng.js';
import type { RelicRarity, UnitId } from '../types.js';
import { CARD_REMOVAL } from './cardRemoval.js';
import type { RelicSource } from './relicSources.js';
import type { PendingEventChoice, RunState } from './types.js';

/**
 * AO-D050 events. Every number is a PLACEHOLDER awaiting qa-playtest; all of them live in
 * EVENT_TUNING. Gold and Food amounts are base (chapter 1) values and scale by CHAPTER_SCALE;
 * unit counts, days, Threat, chances and percentages do not.
 */
export const CHAPTER_SCALE: readonly number[] = [1, 1.5, 2];

export const EVENT_TUNING = {
  /** Events drawn in a row that stay out of the pool when it resets after being exhausted. */
  recentExclusion: 3,
  /** Gold given instead when a relic roll finds nothing left to grant. */
  relicFallbackGold: 30,
  abandoned_camp: { searchChance: 25, trapGold: 15, restRevivePercent: 30, burnGold: 15 },
  bandit_toll: { payGold: 20, refuseUpkeepDays: 2, refuseRelicChance: 10 },
  wayside_shrine: { prayMaxMana: 1, desecrateGold: 40, desecrateThreat: 1 },
  plague_cart: { burnGold: 15, lootGold: 30, lootFood: 20, lootLossPercent: 25, sellGold: 45 },
  hunters_lodge: { tradeGold: 20, tradeFood: 30, joinFood: 40, joinDays: 1, aloneChance: 50, aloneFood: 30, aloneLoss: 1 },
  deserter_knight: { recruitGold: 40, knights: 2, dispatchGold: 25, dispatchThreat: 1 },
  forgotten_library: { sellGold: 35 },
  cursed_well: { drinkUnits: 2, drinkThreat: 1, drawFood: 15, sealGold: 10, sealThreat: 1 },
  crossroads_gallows: { cutGold: 25, cutThreat: 1, buryRelicChance: 15, buryGold: 15 },
  wandering_smith: { sharpenGold: 60, tradeGold: 30, watchGold: 10 },
  fogbound_ford: { waitDays: 1, blindLoss: 1, tollGold: 25 },
  hedge_witch: { brewGold: 30, brewRevivePercent: 30, bargainRareChance: 20, bargainMinDeck: 6 },
  ambushed_merchants: { rescueChance: 30, rescueGold: 60, takeGold: 40, takeThreat: 1 },
  mercenary_camp: { hireGold: 35, hireUnits: 3, offers: 2, barterGold: 25, barterFood: 25 },
  ruined_watchtower: { revealSteps: 5, cellarChance: 20, campFood: 10 },
  blood_altar: { offerRareChance: 70, offerThreat: 2, offerMinDeck: 8, offerGold: 60, offerMaxMana: 1, smashChance: 25, smashThreat: 1 },
} as const;

const T = EVENT_TUNING;

export type EventEffect =
  | { kind: 'GOLD_DELTA'; amount: number }
  | { kind: 'FOOD_DELTA'; amount: number }
  | { kind: 'THREAT_DELTA'; amount: number }
  /** The Food the army eats in `days` days is paid at once (no clock change, AO-D051 spirit); a shortfall starves the army. */
  | { kind: 'UPKEEP_DAYS'; days: number }
  | { kind: 'MAX_MANA_DELTA'; amount: number }
  | { kind: 'UNIT_GAIN'; unitId: UnitId | 'chosen'; count: number }
  | { kind: 'UNIT_GAIN_ALL_STACKS'; count: number }
  | { kind: 'UNIT_LOSS'; target: 'random_stack' | 'largest_stack'; count?: number; percent?: number }
  | { kind: 'REVIVE_LAST_CASUALTIES'; percent: number }
  /** The three card effects need a card picked by the player (PendingEventChoice). */
  | { kind: 'UPGRADE_CARD' }
  | { kind: 'REMOVE_CARD' }
  | { kind: 'GIVE_CARD' }
  | { kind: 'GAIN_CARD' }
  | { kind: 'RELIC'; source: RelicSource | Record<RelicRarity, number> }
  | { kind: 'REVEAL_MAP'; steps: number };

export interface EventRequirement {
  gold?: number;
  unit?: UnitId;
  minDeckSize?: number;
  minChapter?: number;
}

/** AO-D056: a chance at the good outcome; failure is either more effects or an ambush battle. */
export interface EventGamble {
  successChance: number;
  success: EventEffect[];
  failure: EventEffect[] | 'ambush';
  successOutcome?: string;
  failureOutcome?: string;
  successText: string;
  failureText: string;
}

export interface EventOption {
  id: string;
  label: string;
  description: string;
  requires?: EventRequirement;
  /** Applied in order, always; the gamble (if any) is rolled after them. */
  effects: EventEffect[];
  gamble?: EventGamble;
  /** Shown after the option resolves; a gamble appends its own success/failure text. */
  result: string;
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  weight: number;
  minChapter: number;
  options: (scale: (amount: number) => number) => EventOption[];
}

export const chapterScale = (chapter: number): number => CHAPTER_SCALE[chapter - 1] ?? CHAPTER_SCALE[CHAPTER_SCALE.length - 1]!;

const gold = (amount: number): EventEffect => ({ kind: 'GOLD_DELTA', amount });
const food = (amount: number): EventEffect => ({ kind: 'FOOD_DELTA', amount });
const threat = (amount: number): EventEffect => ({ kind: 'THREAT_DELTA', amount });
const relic = (source: RelicSource | Record<RelicRarity, number>): EventEffect => ({ kind: 'RELIC', source });
const rare: Record<RelicRarity, number> = { common: 0, rare: 1, epic: 0 };

const EVENT_LIST: EventDefinition[] = [
  {
    id: 'abandoned_camp',
    title: 'Abandoned Camp',
    description: 'A cold campsite, recently deserted. Something might still be worth finding.',
    weight: 8,
    minChapter: 1,
    options: (a) => [
      {
        id: 'search',
        label: 'Search',
        description: 'Chance for a random relic; risk of a trap.',
        effects: [],
        gamble: {
          successChance: T.abandoned_camp.searchChance / 100,
          success: [relic('event')],
          failure: [gold(-T.abandoned_camp.trapGold)],
          successOutcome: 'search_relic',
          failureOutcome: 'search_trap',
          successText: 'You turn up a relic among the ashes.',
          failureText: `A trap! You lose ${a(T.abandoned_camp.trapGold)} Gold.`,
        },
        result: 'You search the camp.',
      },
      {
        id: 'rest',
        label: 'Rest',
        description: `Revive ${T.abandoned_camp.restRevivePercent}% of the units lost in your last battle.`,
        effects: [{ kind: 'REVIVE_LAST_CASUALTIES', percent: T.abandoned_camp.restRevivePercent }],
        result: 'A quiet night; some of the fallen are back on their feet.',
      },
      {
        id: 'burn',
        label: 'Burn it down',
        description: `Salvage what you can: +${a(T.abandoned_camp.burnGold)} Gold.`,
        effects: [gold(T.abandoned_camp.burnGold)],
        result: `You salvage ${a(T.abandoned_camp.burnGold)} Gold from the wreckage.`,
      },
    ],
  },
  {
    id: 'bandit_toll',
    title: 'Bandit Toll',
    description: 'A band of highwaymen demands payment for safe passage.',
    weight: 8,
    minChapter: 1,
    options: (a) => [
      {
        id: 'pay',
        label: 'Pay the toll',
        description: `Lose ${a(T.bandit_toll.payGold)} Gold.`,
        effects: [gold(-T.bandit_toll.payGold)],
        result: `You pay ${a(T.bandit_toll.payGold)} Gold and pass.`,
      },
      {
        id: 'refuse',
        label: 'Refuse and push through',
        description: `The detour costs ${T.bandit_toll.refuseUpkeepDays} days of food. Small chance to loot a relic from the fleeing bandits.`,
        effects: [{ kind: 'UPKEEP_DAYS', days: T.bandit_toll.refuseUpkeepDays }],
        gamble: {
          successChance: T.bandit_toll.refuseRelicChance / 100,
          success: [relic('event')],
          failure: [],
          successOutcome: 'refuse_relic',
          failureOutcome: 'refuse',
          successText: 'The bandits flee and leave a relic behind.',
          failureText: '',
        },
        result: 'The long way round eats into your supplies.',
      },
    ],
  },
  {
    id: 'wayside_shrine',
    title: 'Wayside Shrine',
    description: 'A moss-covered shrine stands by the road, its offering bowl full of old coins.',
    weight: 8,
    minChapter: 1,
    options: (a) => [
      {
        id: 'pray',
        label: 'Pray',
        description: `+${T.wayside_shrine.prayMaxMana} max Mana for the rest of the run.`,
        effects: [{ kind: 'MAX_MANA_DELTA', amount: T.wayside_shrine.prayMaxMana }],
        result: 'Your mind clears; you can hold more power.',
      },
      {
        id: 'desecrate',
        label: 'Desecrate',
        description: `+${a(T.wayside_shrine.desecrateGold)} Gold, Threat +${T.wayside_shrine.desecrateThreat}.`,
        effects: [gold(T.wayside_shrine.desecrateGold), threat(T.wayside_shrine.desecrateThreat)],
        result: `You loot ${a(T.wayside_shrine.desecrateGold)} Gold. The land will remember.`,
      },
      { id: 'leave', label: 'Leave', description: 'Nothing happens.', effects: [], result: 'You walk on.' },
    ],
  },
  {
    id: 'plague_cart',
    title: 'Plague Cart',
    description: 'An abandoned cart, its cargo covered in stained cloth. The air around it stinks of sickness.',
    weight: 8,
    minChapter: 1,
    options: (a) => [
      {
        id: 'burn',
        label: 'Burn it',
        description: `Costs ${a(T.plague_cart.burnGold)} Gold for pitch and torches.`,
        effects: [gold(-T.plague_cart.burnGold)],
        result: 'The cart burns and the danger with it.',
      },
      {
        id: 'loot',
        label: 'Loot it',
        description: `+${a(T.plague_cart.lootGold)} Gold, +${a(T.plague_cart.lootFood)} Food, but the sickness takes ${T.plague_cart.lootLossPercent}% of a random stack.`,
        effects: [gold(T.plague_cart.lootGold), food(T.plague_cart.lootFood), { kind: 'UNIT_LOSS', target: 'random_stack', percent: T.plague_cart.lootLossPercent }],
        result: 'The goods are yours, and so is the plague.',
      },
      {
        id: 'sell_remedies',
        label: 'Sell remedies',
        description: `Needs a Priest. +${a(T.plague_cart.sellGold)} Gold.`,
        requires: { unit: 'priest' },
        effects: [gold(T.plague_cart.sellGold)],
        result: `Your priests treat the sick for ${a(T.plague_cart.sellGold)} Gold.`,
      },
    ],
  },
  {
    id: 'hunters_lodge',
    title: "Hunters' Lodge",
    description: 'Smoke rises from a lodge full of smoked meat and bored hunters.',
    weight: 8,
    minChapter: 1,
    options: (a) => [
      {
        id: 'trade',
        label: 'Trade',
        description: `Pay ${a(T.hunters_lodge.tradeGold)} Gold for ${a(T.hunters_lodge.tradeFood)} Food.`,
        requires: { gold: a(T.hunters_lodge.tradeGold) },
        effects: [gold(-T.hunters_lodge.tradeGold), food(T.hunters_lodge.tradeFood)],
        result: 'You stock up on smoked meat.',
      },
      {
        id: 'join_hunt',
        label: 'Join the hunt',
        description: `Needs an Archer. +${a(T.hunters_lodge.joinFood)} Food, costs ${T.hunters_lodge.joinDays} day of food.`,
        requires: { unit: 'archer' },
        effects: [food(T.hunters_lodge.joinFood), { kind: 'UPKEEP_DAYS', days: T.hunters_lodge.joinDays }],
        result: 'A day of hunting fills the wagons.',
      },
      {
        id: 'hunt_alone',
        label: 'Hunt alone',
        description: `${T.hunters_lodge.aloneChance}%: +${a(T.hunters_lodge.aloneFood)} Food. Otherwise you lose ${T.hunters_lodge.aloneLoss} unit of a random stack.`,
        effects: [],
        gamble: {
          successChance: T.hunters_lodge.aloneChance / 100,
          success: [food(T.hunters_lodge.aloneFood)],
          failure: [{ kind: 'UNIT_LOSS', target: 'random_stack', count: T.hunters_lodge.aloneLoss }],
          successText: `Your party brings home ${a(T.hunters_lodge.aloneFood)} Food.`,
          failureText: 'The hunt goes wrong and someone does not come back.',
        },
        result: 'You send out a party on their own.',
      },
    ],
  },
  {
    id: 'deserter_knight',
    title: 'Deserter Knight',
    description: 'A knight in dented armor sits by the road. He has left his lord and his oath.',
    weight: 7,
    minChapter: 1,
    options: (a) => [
      {
        id: 'recruit',
        label: 'Recruit',
        description: `Pay ${a(T.deserter_knight.recruitGold)} Gold: ${T.deserter_knight.knights} Knights join you.`,
        requires: { gold: a(T.deserter_knight.recruitGold) },
        effects: [gold(-T.deserter_knight.recruitGold), { kind: 'UNIT_GAIN', unitId: 'knight', count: T.deserter_knight.knights }],
        result: 'The deserter takes your coin and a new oath.',
      },
      {
        id: 'dispatch',
        label: 'Dispatch him',
        description: `+${a(T.deserter_knight.dispatchGold)} Gold (his bounty), Threat -${T.deserter_knight.dispatchThreat}.`,
        effects: [gold(T.deserter_knight.dispatchGold), threat(-T.deserter_knight.dispatchThreat)],
        result: 'You collect the bounty. Order feels a little safer.',
      },
      { id: 'leave', label: 'Ignore', description: 'Nothing happens.', effects: [], result: 'You ride past.' },
    ],
  },
  {
    id: 'forgotten_library',
    title: 'Forgotten Library',
    description: 'A collapsed tower hides a reading room, shelves still standing in the dust.',
    weight: 7,
    minChapter: 1,
    options: (a) => [
      {
        id: 'study',
        label: 'Study',
        description: 'Upgrade a card of your choice.',
        effects: [{ kind: 'UPGRADE_CARD' }],
        result: 'Hours pass over the books; a technique sharpens.',
      },
      {
        id: 'burn_page',
        label: 'Burn a page',
        description: `Remove a card from your deck for free (the deck never goes below ${CARD_REMOVAL.minDeckSize}).`,
        effects: [{ kind: 'REMOVE_CARD' }],
        result: 'You burn the page and the habit with it.',
      },
      {
        id: 'sell_tomes',
        label: 'Sell tomes',
        description: `+${a(T.forgotten_library.sellGold)} Gold.`,
        effects: [gold(T.forgotten_library.sellGold)],
        result: `The tomes fetch ${a(T.forgotten_library.sellGold)} Gold.`,
      },
    ],
  },
  {
    id: 'cursed_well',
    title: 'Cursed Well',
    description: 'A black well hums with a low voice. The water smells of iron and old promises.',
    weight: 6,
    minChapter: 1,
    options: (a) => [
      {
        id: 'drink',
        label: 'Drink',
        description: `+${T.cursed_well.drinkUnits} units to every stack, Threat +${T.cursed_well.drinkThreat}.`,
        effects: [{ kind: 'UNIT_GAIN_ALL_STACKS', count: T.cursed_well.drinkUnits }, threat(T.cursed_well.drinkThreat)],
        result: 'The ranks swell. Something below is pleased.',
      },
      {
        id: 'draw_water',
        label: 'Draw water',
        description: `+${a(T.cursed_well.drawFood)} Food.`,
        effects: [food(T.cursed_well.drawFood)],
        result: `The well house still holds ${a(T.cursed_well.drawFood)} Food of stores.`,
      },
      {
        id: 'seal',
        label: 'Seal it',
        description: `Costs ${a(T.cursed_well.sealGold)} Gold, Threat -${T.cursed_well.sealThreat}.`,
        effects: [gold(-T.cursed_well.sealGold), threat(-T.cursed_well.sealThreat)],
        result: 'The well is sealed. The voice fades.',
      },
    ],
  },
  {
    id: 'crossroads_gallows',
    title: 'Crossroads Gallows',
    description: 'Bodies hang at the crossroads, weathered and forgotten.',
    weight: 6,
    minChapter: 1,
    options: (a) => [
      {
        id: 'cut_down',
        label: 'Cut down the dead',
        description: `+${a(T.crossroads_gallows.cutGold)} Gold, Threat +${T.crossroads_gallows.cutThreat}.`,
        effects: [gold(T.crossroads_gallows.cutGold), threat(T.crossroads_gallows.cutThreat)],
        result: `You take ${a(T.crossroads_gallows.cutGold)} Gold from their pockets.`,
      },
      {
        id: 'bury',
        label: 'Bury them',
        description: `Needs a Priest. ${T.crossroads_gallows.buryRelicChance}% for a rare relic, otherwise +${a(T.crossroads_gallows.buryGold)} Gold.`,
        requires: { unit: 'priest' },
        effects: [],
        gamble: {
          successChance: T.crossroads_gallows.buryRelicChance / 100,
          success: [relic(rare)],
          failure: [gold(T.crossroads_gallows.buryGold)],
          successText: 'A grateful spirit leaves a relic on the grave.',
          failureText: `Villagers thank you with ${a(T.crossroads_gallows.buryGold)} Gold.`,
        },
        result: 'Your priests give the dead a proper burial.',
      },
      { id: 'leave', label: 'Move on', description: 'Nothing happens.', effects: [], result: 'You do not look back.' },
    ],
  },
  {
    id: 'wandering_smith',
    title: 'Wandering Smith',
    description: 'A traveling smith has set up a forge by the road and eyes your weapons.',
    weight: 6,
    minChapter: 1,
    options: (a) => [
      {
        id: 'sharpen',
        label: 'Sharpen',
        description: `Pay ${a(T.wandering_smith.sharpenGold)} Gold to upgrade a card of your choice.`,
        requires: { gold: a(T.wandering_smith.sharpenGold) },
        effects: [gold(-T.wandering_smith.sharpenGold), { kind: 'UPGRADE_CARD' }],
        result: 'The smith works the steel until it sings.',
      },
      {
        id: 'trade',
        label: 'Trade',
        description: `Give a card, get +${a(T.wandering_smith.tradeGold)} Gold.`,
        effects: [{ kind: 'GIVE_CARD' }, gold(T.wandering_smith.tradeGold)],
        result: `The smith pays ${a(T.wandering_smith.tradeGold)} Gold for it.`,
      },
      {
        id: 'watch',
        label: 'Watch',
        description: `+${a(T.wandering_smith.watchGold)} Gold for tending the bellows.`,
        effects: [gold(T.wandering_smith.watchGold)],
        result: `You tend the bellows and earn ${a(T.wandering_smith.watchGold)} Gold.`,
      },
    ],
  },
  {
    id: 'fogbound_ford',
    title: 'Fog-bound Ford',
    description: 'A thick fog hides the river crossing. A boatman waits, hand out.',
    weight: 7,
    minChapter: 1,
    options: (a) => [
      {
        id: 'wait',
        label: 'Wait out the fog',
        description: `Costs ${T.fogbound_ford.waitDays} day of food.`,
        effects: [{ kind: 'UPKEEP_DAYS', days: T.fogbound_ford.waitDays }],
        result: 'By morning the fog has lifted.',
      },
      {
        id: 'ford_blind',
        label: 'Ford blind',
        description: `You lose ${T.fogbound_ford.blindLoss} unit of your largest stack.`,
        effects: [{ kind: 'UNIT_LOSS', target: 'largest_stack', count: T.fogbound_ford.blindLoss }],
        result: 'The current takes someone in the fog.',
      },
      {
        id: 'toll_boat',
        label: 'Take the toll boat',
        description: `Costs ${a(T.fogbound_ford.tollGold)} Gold.`,
        effects: [gold(-T.fogbound_ford.tollGold)],
        result: `The boatman ferries you across for ${a(T.fogbound_ford.tollGold)} Gold.`,
      },
    ],
  },
  {
    id: 'hedge_witch',
    title: 'Hedge Witch',
    description: 'A witch sits before a hut of bones and herbs, stirring a pot that smells of pine and blood.',
    weight: 5,
    minChapter: 1,
    options: (a) => [
      {
        id: 'buy_brew',
        label: 'Buy a brew',
        description: `Pay ${a(T.hedge_witch.brewGold)} Gold: revive ${T.hedge_witch.brewRevivePercent}% of the units lost in your last battle.`,
        requires: { gold: a(T.hedge_witch.brewGold) },
        effects: [gold(-T.hedge_witch.brewGold), { kind: 'REVIVE_LAST_CASUALTIES', percent: T.hedge_witch.brewRevivePercent }],
        result: 'The brew burns going down, and the fallen stand.',
      },
      {
        id: 'bargain',
        label: 'Bargain',
        description: `Give a card for a random relic (${100 - T.hedge_witch.bargainRareChance}% common, ${T.hedge_witch.bargainRareChance}% rare). Needs at least ${T.hedge_witch.bargainMinDeck} cards.`,
        requires: { minDeckSize: T.hedge_witch.bargainMinDeck },
        effects: [{ kind: 'GIVE_CARD' }, relic({ common: 100 - T.hedge_witch.bargainRareChance, rare: T.hedge_witch.bargainRareChance, epic: 0 })],
        result: 'The witch takes the card and hands you something in return.',
      },
      { id: 'leave', label: 'Refuse', description: 'Nothing happens.', effects: [], result: 'You leave the witch to her pot.' },
    ],
  },
  {
    id: 'ambushed_merchants',
    title: 'Ambushed Merchants',
    description: 'A merchant caravan is under attack by raiders. Their guards are down.',
    weight: 6,
    minChapter: 1,
    options: (a) => [
      {
        id: 'rescue',
        label: 'Rescue them',
        description: `${T.ambushed_merchants.rescueChance}%: +${a(T.ambushed_merchants.rescueGold)} Gold and a card. Otherwise the raiders turn on you (a battle).`,
        effects: [],
        gamble: {
          successChance: T.ambushed_merchants.rescueChance / 100,
          success: [gold(T.ambushed_merchants.rescueGold), { kind: 'GAIN_CARD' }],
          failure: 'ambush',
          successText: `The merchants reward you with ${a(T.ambushed_merchants.rescueGold)} Gold and a card.`,
          failureText: 'The raiders turn on you!',
        },
        result: 'You charge in.',
      },
      {
        id: 'take_goods',
        label: 'Take the goods',
        description: `+${a(T.ambushed_merchants.takeGold)} Gold, Threat +${T.ambushed_merchants.takeThreat}.`,
        effects: [gold(T.ambushed_merchants.takeGold), threat(T.ambushed_merchants.takeThreat)],
        result: `You pick over the wreckage for ${a(T.ambushed_merchants.takeGold)} Gold.`,
      },
      { id: 'leave', label: 'Pass', description: 'Nothing happens.', effects: [], result: 'You keep walking.' },
    ],
  },
  {
    id: 'mercenary_camp',
    title: 'Mercenary Camp',
    description: 'A sellsword captain offers fighters to anyone with coin.',
    weight: 6,
    minChapter: 1,
    options: (a) => [
      {
        id: 'hire',
        label: 'Hire',
        description: `Pay ${a(T.mercenary_camp.hireGold)} Gold for ${T.mercenary_camp.hireUnits} units of a type you choose from ${T.mercenary_camp.offers} offers.`,
        requires: { gold: a(T.mercenary_camp.hireGold) },
        effects: [gold(-T.mercenary_camp.hireGold), { kind: 'UNIT_GAIN', unitId: 'chosen', count: T.mercenary_camp.hireUnits }],
        result: 'The captain shakes on it.',
      },
      {
        id: 'barter',
        label: 'Barter',
        description: `Pay ${a(T.mercenary_camp.barterGold)} Gold for ${a(T.mercenary_camp.barterFood)} Food.`,
        requires: { gold: a(T.mercenary_camp.barterGold) },
        effects: [gold(-T.mercenary_camp.barterGold), food(T.mercenary_camp.barterFood)],
        result: 'You trade coin for rations.',
      },
      { id: 'leave', label: 'Leave', description: 'Nothing happens.', effects: [], result: 'You decline and move on.' },
    ],
  },
  {
    id: 'ruined_watchtower',
    title: 'Ruined Watchtower',
    description: 'A half-fallen watchtower overlooks the land ahead.',
    weight: 4,
    minChapter: 2,
    options: (a) => [
      {
        id: 'climb',
        label: 'Climb',
        description: `Reveal the next ${T.ruined_watchtower.revealSteps} map nodes.`,
        effects: [{ kind: 'REVEAL_MAP', steps: T.ruined_watchtower.revealSteps }],
        result: 'From the top you see the road ahead.',
      },
      {
        id: 'loot_cellar',
        label: 'Loot the cellar',
        description: `${T.ruined_watchtower.cellarChance}% for a rare relic. Otherwise something in the dark attacks (a battle).`,
        effects: [],
        gamble: {
          successChance: T.ruined_watchtower.cellarChance / 100,
          success: [relic(rare)],
          failure: 'ambush',
          successText: 'Under the rubble lies a relic.',
          failureText: 'Something wakes in the dark!',
        },
        result: 'You pry open the cellar door.',
      },
      {
        id: 'camp',
        label: 'Camp',
        description: `+${a(T.ruined_watchtower.campFood)} Food.`,
        effects: [food(T.ruined_watchtower.campFood)],
        result: `The watchers' old stores yield ${a(T.ruined_watchtower.campFood)} Food.`,
      },
    ],
  },
  {
    id: 'blood_altar',
    title: 'Blood Altar',
    description: 'A stone altar, dark with old blood, waits for those who dare make a bargain.',
    weight: 3,
    minChapter: 2,
    options: (a) => [
      {
        id: 'offer_card',
        label: 'Offer a card',
        description: `Give a card for a relic (${T.blood_altar.offerRareChance}% rare, ${100 - T.blood_altar.offerRareChance}% epic), Threat +${T.blood_altar.offerThreat}. Needs at least ${T.blood_altar.offerMinDeck} cards.`,
        requires: { minDeckSize: T.blood_altar.offerMinDeck },
        effects: [{ kind: 'GIVE_CARD' }, relic({ common: 0, rare: T.blood_altar.offerRareChance, epic: 100 - T.blood_altar.offerRareChance }), threat(T.blood_altar.offerThreat)],
        result: 'The altar drinks the offering and answers.',
      },
      {
        id: 'offer_gold',
        label: 'Offer gold',
        description: `Pay ${a(T.blood_altar.offerGold)} Gold for +${T.blood_altar.offerMaxMana} max Mana.`,
        requires: { gold: a(T.blood_altar.offerGold) },
        effects: [gold(-T.blood_altar.offerGold), { kind: 'MAX_MANA_DELTA', amount: T.blood_altar.offerMaxMana }],
        result: 'Power floods your veins.',
      },
      {
        id: 'smash',
        label: 'Smash it',
        description: `Threat +${T.blood_altar.smashThreat}. ${T.blood_altar.smashChance}% for a rare relic in the rubble. Otherwise its guardians attack (a battle).`,
        effects: [threat(T.blood_altar.smashThreat)],
        gamble: {
          successChance: T.blood_altar.smashChance / 100,
          success: [relic(rare)],
          failure: 'ambush',
          successText: 'A relic rolls out of the broken stone.',
          failureText: 'The altar guardians rise!',
        },
        result: 'You bring your weapons down on the altar.',
      },
    ],
  },
];

export const EVENT_DEFINITIONS: Record<string, EventDefinition> = Object.fromEntries(EVENT_LIST.map((e) => [e.id, e]));
export const EVENT_IDS = EVENT_LIST.map((e) => e.id);

/** An event's options with every Gold/Food amount scaled to the chapter. */
export function resolveEventOptions(eventId: string, chapter: number): EventOption[] {
  const scale = chapterScale(chapter);
  return EVENT_DEFINITIONS[eventId]!.options((amount) => Math.round(amount * scale));
}

/** Every Gold/Food amount inside an option's effects is base-valued; this returns the chapter-scaled copy the engine applies. */
export function scaleEffects(effects: EventEffect[], chapter: number): EventEffect[] {
  const scale = chapterScale(chapter);
  return effects.map((e) => (e.kind === 'GOLD_DELTA' || e.kind === 'FOOD_DELTA' ? { ...e, amount: Math.round(e.amount * scale) } : e));
}

export function upgradableCardIds(run: Pick<RunState, 'masterDeck'>): string[] {
  return run.masterDeck.filter((c) => CARD_DEFINITIONS[c.cardId]?.upgrade && !c.upgraded).map((c) => c.instanceId);
}

function effectsOf(option: EventOption): EventEffect[] {
  return [...option.effects, ...(option.gamble ? option.gamble.success.concat(Array.isArray(option.gamble.failure) ? option.gamble.failure : []) : [])];
}

/** The card-pick action an option needs before it resolves, if any. */
export function optionCardAction(option: EventOption): 'upgrade' | 'remove' | 'give' | null {
  for (const e of option.effects) {
    if (e.kind === 'UPGRADE_CARD') return 'upgrade';
    if (e.kind === 'REMOVE_CARD') return 'remove';
    if (e.kind === 'GIVE_CARD') return 'give';
  }
  return null;
}

export function optionNeedsUnitChoice(option: EventOption): boolean {
  return option.effects.some((e) => e.kind === 'UNIT_GAIN' && e.unitId === 'chosen');
}

export interface OptionAvailability {
  available: boolean;
  reason: string | null;
}

/** Enforced by the reducer and shown by the UI (greyed option + reason). */
export function optionAvailability(run: RunState, option: EventOption): OptionAvailability {
  const no = (reason: string): OptionAvailability => ({ available: false, reason });
  const req = option.requires;
  if (req?.minChapter !== undefined && run.chapter < req.minChapter) return no(`Available from chapter ${req.minChapter}.`);
  if (req?.unit && !run.army.some((s) => s.unitId === req.unit && s.count > 0)) return no(`Requires ${UNIT_DEFINITIONS[req.unit].name} in your army.`);
  if (req?.gold !== undefined && run.gold < req.gold) return no(`Not enough Gold (need ${req.gold}).`);
  if (req?.minDeckSize !== undefined && run.masterDeck.length < req.minDeckSize) return no(`Needs at least ${req.minDeckSize} cards in your deck.`);
  const action = optionCardAction(option);
  if (action === 'upgrade' && upgradableCardIds(run).length === 0) return no('No card in your deck can be upgraded.');
  if ((action === 'remove' || action === 'give') && run.masterDeck.length <= CARD_REMOVAL.minDeckSize) return no(`Deck cannot go below ${CARD_REMOVAL.minDeckSize} cards.`);
  if (effectsOf(option).some((e) => e.kind === 'REVIVE_LAST_CASUALTIES') && run.lastCasualties.length === 0) return no('No fallen units to revive.');
  return { available: true, reason: null };
}

export interface EventOptionView {
  id: string;
  label: string;
  description: string;
  available: boolean;
  reason: string | null;
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  options: EventOptionView[];
  /** A card or unit pick the player must complete (or cancel) before the option resolves. */
  choice: PendingEventChoice | null;
  /** The option is applied but a unit gain with no room (run.pendingUnitChoice) must be settled first. */
  awaitingUnitChoice: boolean;
}

/** Everything the event screen renders for the run's pending event; null when no event is pending. */
export function eventView(run: RunState): EventView | null {
  const pending = run.pendingEvent;
  if (!pending) return null;
  const def = EVENT_DEFINITIONS[pending.eventId];
  if (!def) return null;
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    options: resolveEventOptions(def.id, run.chapter).map((o) => ({ id: o.id, label: o.label, description: o.description, ...optionAvailability(run, o) })),
    choice: pending.choice,
    awaitingUnitChoice: pending.resolved !== null,
  };
}

function isPlayable(run: RunState, def: EventDefinition): boolean {
  return run.chapter >= def.minChapter && resolveEventOptions(def.id, run.chapter).some((o) => optionAvailability(run, o).available);
}

/**
 * AO-D050: weighted draw without repeats. Events gated by chapter or with no playable option are
 * skipped; when every eligible event has been seen the history shrinks to the last few draws.
 * Consumes one run-RNG draw and records the pick in run.seenEventIds.
 */
export function pickEventId(run: RunState): string {
  const eligible = EVENT_LIST.filter((e) => isPlayable(run, e));
  let pool = eligible.filter((e) => !run.seenEventIds.includes(e.id));
  if (pool.length === 0) {
    run.seenEventIds = run.seenEventIds.slice(-EVENT_TUNING.recentExclusion);
    pool = eligible.filter((e) => !run.seenEventIds.includes(e.id));
  }
  if (pool.length === 0) pool = eligible;
  let roll = nextInt(run.rng, pool.reduce((sum, e) => sum + e.weight, 0));
  const picked = pool.find((e) => (roll -= e.weight) < 0)!;
  run.seenEventIds.push(picked.id);
  return picked.id;
}
