import { MAX_ARMY_STACKS } from './army.js';
import { CARD_DEFINITIONS } from './data/cards.js';
import { resolveCard } from './cardUpgrades.js';
import { UNIT_DEFINITIONS } from './data/units.js';
import { inactiveCardReason, isCardActive } from './combat.js';
import { cannotAct } from './damage.js';
import { computeValidTargets } from './targeting.js';
import type { CardDefinition, CardEffect, CombatState } from './types.js';

/** AO-D040 — the cards' play conditions, derived from card data (source unit, targeting shape, tag-scoped effects). */

function taggedEffectTag(effect: CardEffect): string | null {
  return effect.kind === 'ATTACK_ALL_WITH_TAG' || effect.kind === 'DAMAGE_BUFF_ALL_WITH_TAG' || effect.kind === 'SET_FLAGS_ALL_WITH_TAG' ? effect.tag : null;
}

function playerUnitNamesWithTag(tag: string): string[] {
  return Object.values(UNIT_DEFINITIONS)
    .filter((u) => u.side === 'player' && u.tags.includes(tag))
    .map((u) => u.name);
}

function requirementParts(card: CardDefinition): string[] {
  const parts: string[] = [];
  if (card.source.type === 'unit') parts.push(`a living ${UNIT_DEFINITIONS[card.source.unitId].name}`);
  for (const effect of card.effects) {
    const tag = taggedEffectTag(effect);
    if (tag) {
      const names = playerUnitNamesWithTag(tag);
      const part = `a living ${names.join(' or ')}`;
      if (names.length > 0 && !parts.includes(part)) parts.push(part);
    }
  }
  if (card.targeting === 'ally-stack+enemy-stack') parts.push('an enemy in reach');
  if (card.targeting === 'ally-stack+position') parts.push('a free position');
  return parts;
}

/** Short player-facing condition text ("Needs a living Knight and an enemy in reach"), or null when the card is unconditional. */
export function cardRequirement(cardId: string): string | null {
  const card = CARD_DEFINITIONS[cardId];
  if (!card) return null;
  const parts = requirementParts(card);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1]!;
  return `Needs ${parts.length === 1 ? last : `${parts.slice(0, -1).join(', ')} and ${last}`}`;
}

export interface CardPlayability {
  playable: boolean;
  /** Set exactly when `playable` is false. */
  reason: string | null;
}

const no = (reason: string): CardPlayability => ({ playable: false, reason });

/**
 * Whether `cardId` can be played from the current battle state by SOME acting stack, mirroring the
 * rejections `applyPlayerAction` would issue (inactive source unit, Mana, no reachable target,
 * no possible move). Which exact stack/target the player then picks is still validated per action.
 */
export function cardPlayability(cardId: string, state: CombatState, upgraded = false): CardPlayability {
  const card = resolveCard(cardId, upgraded);
  if (!card) return no('Unknown card.');
  if (state.phase !== 'player' || state.result !== 'ongoing') return no('Not your turn.');
  if (!isCardActive(state, cardId)) return no(inactiveCardReason(card));
  if (state.hero.mana < card.manaCost) return no('Not enough Mana.');

  const living = state.playerArmy.filter((s) => s.count > 0);
  const livingEnemies = state.enemyArmy.filter((s) => s.count > 0);
  if (card.cast === 'hero' && livingEnemies.length === 0) return no('No enemy to target.');
  switch (card.targeting) {
    case 'ally-stack+enemy-stack':
      if (!living.some((s) => !cannotAct(s) && computeValidTargets(s, state.enemyArmy, UNIT_DEFINITIONS[s.unitId], state.playerArmy).length > 0)) {
        return no('No stack has an enemy in reach.');
      }
      break;
    case 'enemy-stack':
      if (livingEnemies.length === 0) return no('No enemy to target.');
      break;
    case 'ally-stack+position': {
      if (!living.some((s) => !s.flags.cannotMove)) return no('No stack can move this turn.');
      const taken = new Set(living.map((s) => s.position));
      if (taken.size >= MAX_ARMY_STACKS) return no('No free position.');
      break;
    }
    case 'ally-stack':
    case 'ally-stack+ally-stack':
      if (living.length === 0) return no('No friendly stack.');
      break;
    case 'none':
      break;
  }
  return { playable: true, reason: null };
}
