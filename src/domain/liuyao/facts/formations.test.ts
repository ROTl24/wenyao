import { describe, expect, it } from 'vitest';
import type { DerivedFact, PlateV2 } from '../model.js';
import { GOLDEN_HEXAGRAMS, GOLDEN_TRIGRAM_BITS } from '../__fixtures__/golden-hexagrams.js';
import { buildPlateV2 } from '../plate.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import {
  correspondingFanFu,
  deriveFormationsFromTrustedFacts,
  hexagramSideFormation,
} from './formations.js';

const BUILD_INPUT = {
  plateId: 'plate-effects-formations',
  sessionId: 'session-effects-formations',
  castAt: '2026-07-11T04:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

function staticTosses(hexagram: typeof GOLDEN_HEXAGRAMS[number]): PlateV2['rawTosses'] {
  return [
    ...GOLDEN_TRIGRAM_BITS[hexagram.lowerTrigram],
    ...GOLDEN_TRIGRAM_BITS[hexagram.upperTrigram],
  ].map((yang) => yang ? 7 : 8) as unknown as PlateV2['rawTosses'];
}

function plate(tossValues: PlateV2['rawTosses']): PlateV2 {
  return structuredClone(buildPlateV2({ ...BUILD_INPUT, tossValues }));
}

interface FormationDependencies {
  readonly calendarFacts?: readonly DerivedFact[];
  readonly movingFacts?: readonly DerivedFact[];
  readonly growthFacts?: readonly DerivedFact[];
}

function deriveFormations(
  plateValue: PlateV2,
  dependencies: FormationDependencies = {},
) {
  return deriveFormationsFromTrustedFacts(
    plateValue,
    DEFAULT_RULE_CONTEXT,
    dependencies.calendarFacts ?? [],
    dependencies.movingFacts ?? [],
    dependencies.growthFacts ?? [],
  );
}

function calendarBlocker(
  relation: 'is-void' | 'is-day-break',
  lineId: string,
): DerivedFact {
  return {
    id: `fixture:calendar:pillar:day:${relation}:line:${lineId}:base`,
    relation,
    source: { type: 'pillar', id: 'day' },
    target: { type: 'line', id: lineId, side: 'base' },
    scope: 'calendar',
    authority: 'structural',
    ruleId: `fixture-${relation}`,
    profileId: 'yehe_effects_v1',
    certainty: 'computed',
    conditions: [],
    values: {},
    sourceRefs: [],
  };
}

function growthTombFact(
  pillar: 'year' | 'month' | 'day' | 'hour',
  lineId: string,
): DerivedFact {
  return {
    id: `fixture:calendar:pillar:${pillar}:is-growth-stage:line:${lineId}:base`,
    relation: 'is-growth-stage',
    source: { type: 'pillar', id: pillar },
    target: { type: 'line', id: lineId, side: 'base' },
    scope: 'calendar',
    authority: 'structural',
    ruleId: 'fixture-growth-stage',
    profileId: 'growth_shensha_core_v1',
    certainty: 'computed',
    conditions: [],
    values: { stage: '墓' },
    sourceRefs: [],
  };
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
  }, 30_000);

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
    const staticComplete = plate([7, 8, 8, 7, 8, 8]);
    expect(deriveFormations(staticComplete)
      .some(({ relation }) => relation === 'forms-three-harmony')).toBe(false);

    const active = plate([9, 8, 8, 7, 8, 8]);
    const formed = deriveFormations(active);
    expect(formed).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'forms-three-harmony',
      values: expect.objectContaining({ trineId: 'water', memberMode: 'base-three-with-active-member' }),
    })]));

    const blocked = deriveFormations(active, {
      calendarFacts: [calendarBlocker('is-void', 'line:1')],
    });
    expect(blocked).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'has-three-harmony-candidate',
      values: expect.objectContaining({ trineId: 'water' }),
    })]));
    expect(blocked.some(({ relation, values }) => (
      relation === 'forms-three-harmony' && values.trineId === 'water'
    ))).toBe(false);

    const dayBreak = plate([8, 6, 8, 8, 8, 8]);
    const dayBreakBlocked = deriveFormations(dayBreak, {
      calendarFacts: [calendarBlocker('is-day-break', 'line:2')],
    });
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

    const dayTomb = plate([9, 8, 8, 7, 8, 8]);
    const dayTombBlocked = deriveFormations(dayTomb, {
      growthFacts: [growthTombFact('day', 'line:3')],
    });
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
    const repeated = plate([7, 8, 8, 6, 7, 8]);

    const water = deriveFormations(repeated)
      .find(({ relation, values }) => (
        relation === 'forms-three-harmony'
        && values.trineId === 'water'
        && values.memberMode === 'base-three-with-active-member'
      ));
    expect(water).toMatchObject({
      values: {
        memberEntityIds: [
          'line:line:1:base',
          'line:line:3:base',
          'line:line:4:base',
        ],
        alternativeMemberEntityIds: [
          'line:line:3:base|line:line:4:base|line:line:6:base',
        ],
        candidateCombinationCount: 2,
      },
    });
  });

  it('emits one half-trine fact for a real inner endpoint completion', () => {
    const innerCompletion = plate([9, 7, 6, 6, 6, 6]);
    const matches = deriveFormations(innerCompletion)
      .filter(({ values }) => (
        values.trineId === 'metal'
        && values.memberMode === 'inner-1-3-two-base-one-own-changed'
      ));
    expect(matches).toHaveLength(1);
    expect(matches[0].values).toMatchObject({
      memberEntityIds: [
        'line:line:1:base',
        'line:line:3:base',
        'line:line:3:changed',
      ],
      alternativeMemberEntityIds: [],
      candidateCombinationCount: 1,
    });
  });

  it('allows only the configured inner 1/3 and outer 4/6 two-base-one-own-changed completions', () => {
    const allowed = plate([9, 7, 6, 6, 6, 6]);
    expect(deriveFormations(allowed))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'forms-three-harmony',
        values: expect.objectContaining({
          trineId: 'metal',
          memberMode: 'inner-1-3-two-base-one-own-changed',
          half: 'inner',
        }),
      })]));

    const forbidden = plate([9, 9, 8, 8, 7, 8]);
    expect(deriveFormations(forbidden)
      .some(({ values }) => String(values.memberMode).includes('two-base-one-own-changed')))
      .toBe(false);

    const outerAllowed = plate([6, 6, 6, 9, 7, 6]);
    expect(deriveFormations(outerAllowed))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'forms-three-harmony',
        values: expect.objectContaining({
          trineId: 'wood',
          memberMode: 'outer-4-6-two-base-one-own-changed',
          half: 'outer',
        }),
      })]));
  });

  it('ignores year, month and hour growth-stage tomb while retaining the day-only tomb blocker', () => {
    const fixture = plate([9, 8, 8, 7, 8, 8]);
    const facts = deriveFormations(fixture, {
      growthFacts: [
        growthTombFact('year', 'line:1'),
        growthTombFact('month', 'line:3'),
        growthTombFact('hour', 'line:5'),
      ],
    });
    expect(facts).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'forms-three-harmony',
      values: expect.objectContaining({ trineId: 'water', blockerFactIds: [] }),
    })]));
  });

  it('allows every reviewed trine only with activation and rejects the same four complete static sets', () => {
    const cases: readonly {
      id: 'water' | 'wood' | 'fire' | 'metal';
      active: PlateV2['rawTosses'];
      staticComplete: PlateV2['rawTosses'];
    }[] = [
      { id: 'water', active: [9, 8, 8, 7, 8, 8], staticComplete: [7, 8, 8, 7, 8, 8] },
      { id: 'wood', active: [6, 8, 8, 8, 8, 8], staticComplete: [8, 8, 8, 8, 8, 8] },
      { id: 'fire', active: [7, 6, 8, 7, 8, 8], staticComplete: [7, 8, 8, 7, 8, 8] },
      { id: 'metal', active: [8, 6, 8, 8, 8, 8], staticComplete: [8, 8, 8, 8, 8, 8] },
    ];

    for (const item of cases) {
      const active = plate(item.active);
      expect(deriveFormations(active), item.id)
        .toEqual(expect.arrayContaining([expect.objectContaining({
          relation: 'forms-three-harmony',
          values: expect.objectContaining({ trineId: item.id }),
        })]));

      const staticComplete = plate(item.staticComplete);
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
