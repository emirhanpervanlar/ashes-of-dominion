import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import { applyPlayerAction } from '../../combat.js';
import { UNIT_DEFINITIONS } from '../../data/units.js';
import { generateEnemyIntents } from '../../intents.js';
import { createVerticalSliceScenario } from '../../scenario.js';
import { isFrontPosition } from '../../targeting.js';
import type { ArmyStack, CombatState } from '../../types.js';
import { sturdy } from '../../__tests__/helpers.js';
import { generateBattleEncounter, generateBossEncounter } from '../encounters.js';

const isMelee = (s: ArmyStack): boolean => {
  const def = UNIT_DEFINITIONS[s.unitId];
  return !def.rangedAllAccess && def.basicAction !== 'heal' && !def.tags.includes('support');
};
const back = (army: ArmyStack[]) => army.filter((s) => !isFrontPosition(s.position));
const dead = (s: ArmyStack): ArmyStack => ({ ...s, count: 0, currentHp: 0 });

const encounters: [string, ArmyStack[]][] = [];
for (const chapter of [1, 2, 3]) {
  for (const layer of [1, 5, 10, 15, 20, 30]) {
    for (const threat of [0, 3]) {
      encounters.push([`battle ch${chapter} L${layer} t${threat}`, generateBattleEncounter(layer, false, chapter, threat)]);
      encounters.push([`fort ch${chapter} L${layer} t${threat}`, generateBattleEncounter(layer, true, chapter, threat)]);
    }
  }
  encounters.push([`boss ch${chapter}`, generateBossEncounter(chapter)]);
}

describe('AO-D089 enemy formations: melee in front, ranged and support in back', () => {
  it('the Goblin Archer is an enemy-only ranged unit that can hit any stack', () => {
    const def = UNIT_DEFINITIONS.goblin_archer;
    expect(def.side).toBe('enemy');
    expect(def.basicAction).toBe('ranged_attack');
    expect(def.rangedAllAccess).toBe(true);
    expect(def.tags).toContain('ranged');
  });

  it.each(encounters)('%s: no melee stack stands in the back row', (_name, army) => {
    expect(back(army).filter(isMelee)).toEqual([]);
  });

  it.each(encounters.filter(([name]) => !name.includes('L1 ') && !name.includes('L5 ')))('%s: a full formation has Goblin Archers in the back row', (_name, army) => {
    if (army.length < 5) return;
    expect(back(army).some((s) => s.unitId === 'goblin_archer')).toBe(true);
  });

  it('the boss keeps its whole back row ranged or support', () => {
    const bossBack = back(generateBossEncounter(1));
    expect(bossBack.length).toBe(3);
    expect(bossBack.some((s) => s.unitId === 'goblin_archer')).toBe(true);
  });
});

describe('AO-D089 Goblin Archer behaviour', () => {
  const { state } = createVerticalSliceScenario(1);

  it('shoots from the back row while its own front row is still standing', () => {
    const setup: CombatState = {
      ...sturdy(state),
      enemyArmy: [createStack('orc', 'enemy', 1, 5), createStack('goblin_archer', 'enemy', 5, 4)],
    };
    const attackers = generateEnemyIntents(setup).filter((i) => i.kind === 'attack').map((i) => i.stackId);
    expect(attackers).toContain('enemy_goblin_archer_5');
    const result = applyPlayerAction({ ...setup, enemyIntents: generateEnemyIntents(setup) }, { type: 'END_TURN' });
    expect(result.enemySteps!.some((s) => s.actorStackId === 'enemy_goblin_archer_5')).toBe(true);
  });

  it('a back-row melee Goblin still waits behind a living front row and attacks once it dies', () => {
    const enemy = [createStack('orc', 'enemy', 1, 5), createStack('goblin', 'enemy', 5, 5)];
    const blocked: CombatState = { ...sturdy(state), enemyArmy: enemy };
    expect(generateEnemyIntents(blocked).some((i) => i.stackId === 'enemy_goblin_5')).toBe(false);
    const open: CombatState = { ...blocked, enemyArmy: enemy.map((s) => (s.position === 1 ? dead(s) : s)) };
    expect(generateEnemyIntents(open).some((i) => i.stackId === 'enemy_goblin_5')).toBe(true);
  });
});
