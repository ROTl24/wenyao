import { describe, expect, it } from 'vitest';
import type { Branch, Element, PlateV2 } from '../model.js';
import { GOLDEN_HEXAGRAMS, GOLDEN_TRIGRAM_BITS } from '../__fixtures__/golden-hexagrams.js';
import { buildPlateV2 } from '../plate.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import { deriveEffectsFacts } from './derive.js';
import {
  correspondingFanFu,
  hexagramSideFormation,
} from './formations.js';

const BUILD_INPUT = {
  plateId: 'plate-effects-formations',
  sessionId: 'session-effects-formations',
  castAt: '2026-07-11T04:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

const BRANCH_ELEMENT: Readonly<Record<Branch, Element>> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

function setFacetBranch(
  plate: PlateV2,
  position: number,
  side: 'base' | 'changed',
  branch: Branch,
): void {
  const facet = plate.lines[position - 1][side];
  facet.branch = branch;
  facet.branchElement = BRANCH_ELEMENT[branch];
  facet.ganZhi = `${facet.stem}${branch}`;
}

function setPillarBranch(
  plate: PlateV2,
  kind: 'year' | 'month' | 'day' | 'hour',
  branch: Branch,
): void {
  const pillar = plate.calendar.pillars[kind];
  pillar.branch = { value: branch, element: BRANCH_ELEMENT[branch] };
  pillar.ganZhi = `${pillar.stem.value}${branch}` as typeof pillar.ganZhi;
}

function staticTosses(hexagram: typeof GOLDEN_HEXAGRAMS[number]): PlateV2['rawTosses'] {
  return [
    ...GOLDEN_TRIGRAM_BITS[hexagram.lowerTrigram],
    ...GOLDEN_TRIGRAM_BITS[hexagram.upperTrigram],
  ].map((yang) => yang ? 7 : 8) as unknown as PlateV2['rawTosses'];
}

function plate(tossValues: PlateV2['rawTosses']): PlateV2 {
  return structuredClone(buildPlateV2({ ...BUILD_INPUT, tossValues }));
}

function deriveFormations(plateValue: PlateV2) {
  return deriveEffectsFacts({ plate: plateValue, ruleContext: DEFAULT_RULE_CONTEXT })
    .filter(({ scope }) => scope === 'formation');
}

function makeThreeHarmonyFixture(
  tossValues: PlateV2['rawTosses'],
): PlateV2 {
  const result = plate(tossValues);
  setPillarBranch(result, 'month', '巳');
  setPillarBranch(result, 'day', '酉');
  result.calendar.pillars.day.voidBranches = ['寅', '卯'];
  for (let position = 1; position <= 6; position += 1) {
    setFacetBranch(result, position, 'base', '午');
    setFacetBranch(result, position, 'changed', '午');
  }
  return result;
}

describe('liuyao_effects_v1 production formation facts', () => {
  it('recognizes reviewed side-level six-clash and six-harmony examples', () => {
    const qian = buildPlateV2({ ...BUILD_INPUT, tossValues: [7, 7, 7, 7, 7, 7] });
    const tai = buildPlateV2({ ...BUILD_INPUT, tossValues: [7, 7, 7, 8, 8, 8] });
    expect(hexagramSideFormation(qian, 'base')).toBe('six-clash');
    expect(hexagramSideFormation(tai, 'base')).toBe('six-harmony');
  });

  it('matches the exact hard-coded 8 harmony and 10 clash hexagram sets', () => {
    const harmony: string[] = [];
    const clash: string[] = [];
    for (const hexagram of GOLDEN_HEXAGRAMS) {
      const fixture = buildPlateV2({ ...BUILD_INPUT, tossValues: staticTosses(hexagram) });
      const formation = hexagramSideFormation(fixture, 'base');
      if (formation === 'six-harmony') harmony.push(hexagram.shortName);
      if (formation === 'six-clash') clash.push(hexagram.shortName);
    }
    expect(new Set(harmony)).toEqual(new Set(['复', '泰', '豫', '节', '困', '贲', '旅', '否']));
    expect(new Set(clash)).toEqual(new Set(['坤', '震', '大壮', '坎', '兑', '艮', '离', '巽', '无妄', '乾']));
    expect(harmony.some((name) => clash.includes(name))).toBe(false);
  });

  it('detects fixed corresponding-branch fan/fu examples without duplicating static changed sides', () => {
    const innerFan = buildPlateV2({ ...BUILD_INPUT, tossValues: [8, 6, 6, 8, 7, 8] });
    const outerFan = buildPlateV2({ ...BUILD_INPUT, tossValues: [7, 7, 8, 8, 6, 6] });
    const outerFu = buildPlateV2({ ...BUILD_INPUT, tossValues: [8, 7, 7, 7, 9, 9] });
    expect(deriveFormations(innerFan))
      .toEqual(expect.arrayContaining([expect.objectContaining({ relation: 'is-fan-yin', values: expect.objectContaining({ half: 'inner' }) })]));
    expect(deriveFormations(outerFan))
      .toEqual(expect.arrayContaining([expect.objectContaining({ relation: 'is-fan-yin', values: expect.objectContaining({ half: 'outer' }) })]));
    expect(deriveFormations(outerFu))
      .toEqual(expect.arrayContaining([expect.objectContaining({ relation: 'is-fu-yin', values: expect.objectContaining({ half: 'outer' }) })]));
  });

  it('locks all 4096 base/changed side and corresponding fan/fu counts', () => {
    const counts = {
      baseHarmony: 0,
      baseClash: 0,
      changedHarmony: 0,
      changedClash: 0,
      innerFan: 0,
      outerFan: 0,
      anyFan: 0,
      bothFan: 0,
      innerFu: 0,
      outerFu: 0,
      anyFu: 0,
      bothFu: 0,
    };
    for (let state = 0; state < 4096; state += 1) {
      let cursor = state;
      const tossValues = Array.from({ length: 6 }, () => {
        const toss = [6, 7, 8, 9][cursor % 4];
        cursor = Math.floor(cursor / 4);
        return toss;
      }) as unknown as PlateV2['rawTosses'];
      const fixture = buildPlateV2({ ...BUILD_INPUT, tossValues });
      const base = hexagramSideFormation(fixture, 'base');
      if (base === 'six-harmony') counts.baseHarmony += 1;
      if (base === 'six-clash') counts.baseClash += 1;
      if (fixture.movingLines.length > 0) {
        const changed = hexagramSideFormation(fixture, 'changed');
        if (changed === 'six-harmony') counts.changedHarmony += 1;
        if (changed === 'six-clash') counts.changedClash += 1;
      }
      const snapshot = correspondingFanFu(fixture);
      if (snapshot.innerFan) counts.innerFan += 1;
      if (snapshot.outerFan) counts.outerFan += 1;
      if (snapshot.innerFan || snapshot.outerFan) counts.anyFan += 1;
      if (snapshot.innerFan && snapshot.outerFan) counts.bothFan += 1;
      if (snapshot.innerFu) counts.innerFu += 1;
      if (snapshot.outerFu) counts.outerFu += 1;
      if (snapshot.innerFu || snapshot.outerFu) counts.anyFu += 1;
      if (snapshot.innerFu && snapshot.outerFu) counts.bothFu += 1;
    }
    expect(counts).toEqual({
      baseHarmony: 512,
      baseClash: 640,
      changedHarmony: 504,
      changedClash: 630,
      innerFan: 128,
      outerFan: 128,
      anyFan: 252,
      bothFan: 4,
      innerFu: 128,
      outerFu: 128,
      anyFu: 252,
      bothFu: 4,
    });
  });

  it('does not call an unchanged half fu-yin and emits no duplicate changed side for a static hexagram', () => {
    const staticQian = buildPlateV2({ ...BUILD_INPUT, tossValues: [7, 7, 7, 7, 7, 7] });
    expect(correspondingFanFu(staticQian)).toEqual({
      innerFan: false,
      outerFan: false,
      innerFu: false,
      outerFu: false,
    });
    const facts = deriveFormations(staticQian);
    expect(facts.filter(({ relation }) => relation === 'is-six-clash')).toHaveLength(1);
    expect(facts.some(({ source }) => source.type === 'hexagram' && source.id === 'changed')).toBe(false);
  });

  it('requires activation for a complete base trine and downgrades blocked members to candidate', () => {
    const staticComplete = makeThreeHarmonyFixture([7, 8, 7, 8, 7, 8]);
    setFacetBranch(staticComplete, 1, 'base', '申');
    setFacetBranch(staticComplete, 1, 'changed', '申');
    setFacetBranch(staticComplete, 2, 'base', '子');
    setFacetBranch(staticComplete, 2, 'changed', '子');
    setFacetBranch(staticComplete, 3, 'base', '辰');
    setFacetBranch(staticComplete, 3, 'changed', '辰');
    expect(deriveFormations(staticComplete)
      .some(({ relation }) => relation === 'forms-three-harmony')).toBe(false);

    const active = makeThreeHarmonyFixture([9, 8, 7, 8, 7, 8]);
    setFacetBranch(active, 1, 'base', '申');
    setFacetBranch(active, 1, 'changed', '申');
    setFacetBranch(active, 2, 'base', '子');
    setFacetBranch(active, 2, 'changed', '子');
    setFacetBranch(active, 3, 'base', '辰');
    setFacetBranch(active, 3, 'changed', '辰');
    const formed = deriveFormations(active);
    expect(formed).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'forms-three-harmony',
      values: expect.objectContaining({ trineId: 'water', memberMode: 'base-three-with-active-member' }),
    })]));

    active.calendar.pillars.day.voidBranches = ['申', '酉'];
    const blocked = deriveFormations(active);
    expect(blocked).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'has-three-harmony-candidate',
      values: expect.objectContaining({ trineId: 'water' }),
    })]));
    expect(blocked.some(({ relation, values }) => (
      relation === 'forms-three-harmony' && values.trineId === 'water'
    ))).toBe(false);

    const dayBreak = makeThreeHarmonyFixture([9, 8, 7, 8, 7, 8]);
    setPillarBranch(dayBreak, 'month', '午');
    setPillarBranch(dayBreak, 'day', '卯');
    setFacetBranch(dayBreak, 1, 'base', '巳');
    setFacetBranch(dayBreak, 1, 'changed', '巳');
    setFacetBranch(dayBreak, 2, 'base', '酉');
    setFacetBranch(dayBreak, 2, 'changed', '酉');
    setFacetBranch(dayBreak, 3, 'base', '丑');
    setFacetBranch(dayBreak, 3, 'changed', '丑');
    const dayBreakBlocked = deriveFormations(dayBreak);
    expect(dayBreakBlocked).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'has-three-harmony-candidate',
      values: expect.objectContaining({
        trineId: 'metal',
        blockerFactIds: expect.arrayContaining([
          expect.stringContaining(':is-day-break:'),
        ]),
      }),
    })]));
    expect(dayBreakBlocked.some(({ relation, values }) => (
      relation === 'forms-three-harmony' && values.trineId === 'metal'
    ))).toBe(false);

    const dayTomb = makeThreeHarmonyFixture([9, 8, 7, 8, 7, 8]);
    setPillarBranch(dayTomb, 'month', '申');
    setPillarBranch(dayTomb, 'day', '辰');
    setFacetBranch(dayTomb, 1, 'base', '申');
    setFacetBranch(dayTomb, 1, 'changed', '申');
    setFacetBranch(dayTomb, 2, 'base', '子');
    setFacetBranch(dayTomb, 2, 'changed', '子');
    setFacetBranch(dayTomb, 3, 'base', '辰');
    setFacetBranch(dayTomb, 3, 'changed', '辰');
    const dayTombBlocked = deriveFormations(dayTomb);
    expect(dayTombBlocked).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'has-three-harmony-candidate',
      values: expect.objectContaining({
        trineId: 'water',
        blockerFactIds: expect.arrayContaining([
          expect.stringContaining(':calendar:pillar:day:is-growth-stage:'),
        ]),
      }),
    })]));
    expect(dayTombBlocked.some(({ relation, values }) => (
      relation === 'forms-three-harmony' && values.trineId === 'water'
    ))).toBe(false);
  });

  it('enumerates repeated branches, selects the stable minimum activated set and records alternatives', () => {
    const repeated = makeThreeHarmonyFixture([7, 8, 7, 9, 9, 8]);
    setFacetBranch(repeated, 1, 'base', '申');
    setFacetBranch(repeated, 1, 'changed', '申');
    setFacetBranch(repeated, 2, 'base', '子');
    setFacetBranch(repeated, 2, 'changed', '子');
    setFacetBranch(repeated, 3, 'base', '辰');
    setFacetBranch(repeated, 3, 'changed', '辰');
    setFacetBranch(repeated, 4, 'base', '申');
    setFacetBranch(repeated, 4, 'changed', '申');
    setFacetBranch(repeated, 5, 'base', '申');
    setFacetBranch(repeated, 5, 'changed', '申');

    const water = deriveFormations(repeated)
      .find(({ relation, values }) => (
        relation === 'forms-three-harmony'
        && values.trineId === 'water'
        && values.memberMode === 'base-three-with-active-member'
      ));
    expect(water).toMatchObject({
      values: {
        memberEntityIds: [
          'line:line:2:base',
          'line:line:3:base',
          'line:line:4:base',
        ],
        alternativeMemberEntityIds: [
          'line:line:2:base|line:line:3:base|line:line:5:base',
        ],
        candidateCombinationCount: 2,
      },
    });
  });

  it('emits one half-trine fact when both endpoint changed facets complete it and records the other set', () => {
    const bothEnds = makeThreeHarmonyFixture([9, 8, 9, 8, 7, 8]);
    setFacetBranch(bothEnds, 1, 'base', '申');
    setFacetBranch(bothEnds, 1, 'changed', '辰');
    setFacetBranch(bothEnds, 3, 'base', '子');
    setFacetBranch(bothEnds, 3, 'changed', '辰');
    const matches = deriveFormations(bothEnds)
      .filter(({ values }) => (
        values.trineId === 'water'
        && values.memberMode === 'inner-1-3-two-base-one-own-changed'
      ));
    expect(matches).toHaveLength(1);
    expect(matches[0].values).toMatchObject({
      memberEntityIds: [
        'line:line:1:base',
        'line:line:1:changed',
        'line:line:3:base',
      ],
      alternativeMemberEntityIds: [
        'line:line:1:base|line:line:3:base|line:line:3:changed',
      ],
      candidateCombinationCount: 2,
    });
  });

  it('allows only the configured inner 1/3 and outer 4/6 two-base-one-own-changed completions', () => {
    const allowed = makeThreeHarmonyFixture([9, 8, 9, 8, 7, 8]);
    setFacetBranch(allowed, 1, 'base', '申');
    setFacetBranch(allowed, 1, 'changed', '辰');
    setFacetBranch(allowed, 3, 'base', '子');
    setFacetBranch(allowed, 3, 'changed', '丑');
    expect(deriveFormations(allowed))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'forms-three-harmony',
        values: expect.objectContaining({
          trineId: 'water',
          memberMode: 'inner-1-3-two-base-one-own-changed',
          half: 'inner',
        }),
      })]));

    const forbidden = makeThreeHarmonyFixture([9, 9, 8, 8, 7, 8]);
    setFacetBranch(forbidden, 1, 'base', '申');
    setFacetBranch(forbidden, 1, 'changed', '丑');
    setFacetBranch(forbidden, 2, 'base', '子');
    setFacetBranch(forbidden, 2, 'changed', '辰');
    expect(deriveFormations(forbidden)
      .some(({ values }) => values.trineId === 'water')).toBe(false);

    const outerAllowed = makeThreeHarmonyFixture([7, 8, 7, 9, 8, 9]);
    setFacetBranch(outerAllowed, 4, 'base', '申');
    setFacetBranch(outerAllowed, 4, 'changed', '辰');
    setFacetBranch(outerAllowed, 6, 'base', '子');
    setFacetBranch(outerAllowed, 6, 'changed', '丑');
    expect(deriveFormations(outerAllowed))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'forms-three-harmony',
        values: expect.objectContaining({
          trineId: 'water',
          memberMode: 'outer-4-6-two-base-one-own-changed',
          half: 'outer',
        }),
      })]));
  });

  it('ignores year, month and hour growth-stage tomb while retaining the day-only tomb blocker', () => {
    const plate = makeThreeHarmonyFixture([9, 8, 7, 8, 7, 8]);
    setPillarBranch(plate, 'year', '丑');
    setPillarBranch(plate, 'month', '丑');
    setPillarBranch(plate, 'day', '酉');
    setPillarBranch(plate, 'hour', '辰');
    setFacetBranch(plate, 1, 'base', '申');
    setFacetBranch(plate, 1, 'changed', '申');
    setFacetBranch(plate, 2, 'base', '子');
    setFacetBranch(plate, 2, 'changed', '子');
    setFacetBranch(plate, 3, 'base', '辰');
    setFacetBranch(plate, 3, 'changed', '辰');
    const facts = deriveFormations(plate);
    expect(facts).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'forms-three-harmony',
      values: expect.objectContaining({ trineId: 'water', blockerFactIds: [] }),
    })]));
  });

  it('allows every reviewed trine only with activation and rejects the same four complete static sets', () => {
    const cases = [
      { id: 'water', branches: ['申', '子', '辰'], neutralDay: '酉', voids: ['寅', '卯'] },
      { id: 'wood', branches: ['亥', '卯', '未'], neutralDay: '子', voids: ['寅', '巳'] },
      { id: 'fire', branches: ['寅', '午', '戌'], neutralDay: '卯', voids: ['子', '丑'] },
      { id: 'metal', branches: ['巳', '酉', '丑'], neutralDay: '午', voids: ['寅', '卯'] },
    ] as const;

    for (const item of cases) {
      const active = makeThreeHarmonyFixture([9, 8, 7, 8, 7, 8]);
      setPillarBranch(active, 'month', item.branches[0]);
      setPillarBranch(active, 'day', item.neutralDay);
      active.calendar.pillars.day.voidBranches = [...item.voids];
      item.branches.forEach((branch, index) => {
        setFacetBranch(active, index + 1, 'base', branch);
        setFacetBranch(active, index + 1, 'changed', branch);
      });
      expect(deriveFormations(active), item.id)
        .toEqual(expect.arrayContaining([expect.objectContaining({
          relation: 'forms-three-harmony',
          values: expect.objectContaining({ trineId: item.id }),
        })]));

      const staticComplete = makeThreeHarmonyFixture([7, 8, 7, 8, 7, 8]);
      setPillarBranch(staticComplete, 'month', item.branches[0]);
      setPillarBranch(staticComplete, 'day', item.neutralDay);
      staticComplete.calendar.pillars.day.voidBranches = [...item.voids];
      item.branches.forEach((branch, index) => {
        setFacetBranch(staticComplete, index + 1, 'base', branch);
        setFacetBranch(staticComplete, index + 1, 'changed', branch);
      });
      expect(deriveFormations(staticComplete)
        .some(({ values }) => values.trineId === item.id), item.id).toBe(false);
    }
  });

  it('returns sorted unique deeply frozen attributed formation facts', () => {
    const fixture = buildPlateV2({ ...BUILD_INPUT, tossValues: [8, 6, 6, 8, 7, 8] });
    const facts = deriveFormations(fixture);
    expect(facts.map(({ id }) => id)).toEqual([...facts.map(({ id }) => id)].sort());
    expect(new Set(facts.map(({ id }) => id)).size).toBe(facts.length);
    expect(facts.every((fact) => (
      Object.isFrozen(fact)
      && fact.scope === 'formation'
      && fact.ruleId.length > 0
      && fact.profileId === 'yehe_effects_v1'
      && fact.sourceRefs.length > 0
    ))).toBe(true);
  });
});
