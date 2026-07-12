import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as domain from '../index.js';
import type { Branch, PlateV2 } from '../model.js';
import { buildPlateV2 } from '../plate.js';
import { assertPlateV2RuntimeShape } from '../plate-runtime.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import type {
  RelationRuleBundleManifest,
  RuleContext,
  RuleReviewRecord,
} from '../rules/model.js';
import { WENWANG_NAJIA_V2_ARTIFACT_HASH } from '../rules/wenwang-najia-v2.js';
import { BRANCHES, branchRelationMatches } from './branch-relations.js';
import { ELEMENTS, elementRelation } from './element-relations.js';
import { deriveGrowthShenShaFacts } from './growth-shensha.js';
import {
  RELATION_CORE_V1_ARTIFACT,
  RELATION_CORE_V1_ARTIFACT_HASH,
  RELATION_CORE_V1_CANONICAL_PAYLOAD,
  RELATION_CORE_V1_MANIFEST,
  RELATION_SOURCE_EVIDENCE_CAPSULES,
} from './relation-core-v1.js';
import {
  assertProjectEnabledRelationBundle,
  assertProjectEnabledRelationContext,
} from './relation-registry.js';
import { createFactId, stableFacts } from './model.js';
import {
  deriveFacts,
  enumerateFactComparisons,
} from './derive.js';

type TossTuple = PlateV2['rawTosses'];

const FIXED_BUILD_INPUT = {
  plateId: 'plate-relation-fixed',
  sessionId: 'session-relation-fixed',
  castAt: '2026-07-11T04:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

function buildFixturePlate(tossValues: TossTuple): PlateV2 {
  return buildPlateV2({ ...FIXED_BUILD_INPUT, tossValues });
}

function productionFacts(plate: PlateV2) {
  return deriveFacts({
    plate,
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
}

const RELATION_REVIEW_SOURCE_REFS = RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id);
const RELATION_REVIEW_CLAIMS = [
  'artifact-hash-and-dependency',
  'element-five-by-five-matrix',
  'six-combines-and-six-clashes',
  'six-harms-profile',
  'break-profiles-and-default-intersection',
  'directional-punishments',
  'source-evidence-capsules',
] as const;
const RELATION_REVIEW_REPORT_PATHS = [
  'docs/domain/reviews/relation-core-v1-review-a.md',
  'docs/domain/reviews/relation-core-v1-review-b.md',
] as const;

function matchedRelationReview(
  reviewerId: string,
  independentRunId: string,
  overrides: Partial<RuleReviewRecord> = {},
): RuleReviewRecord {
  return {
    reviewerId,
    reviewerKind: 'automated-agent',
    independentRunId,
    reviewedAt: '2026-07-12T09:00:00+08:00',
    artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs: RELATION_REVIEW_SOURCE_REFS,
    reportPath: independentRunId.endsWith('a')
      ? RELATION_REVIEW_REPORT_PATHS[0]
      : RELATION_REVIEW_REPORT_PATHS[1],
    checkedClaims: RELATION_REVIEW_CLAIMS,
    ...overrides,
  };
}

function enabledRelationManifest(
  overrides: Partial<RelationRuleBundleManifest> = {},
): RelationRuleBundleManifest {
  return {
    bundleId: 'relation_core_v1',
    version: '1.0.0',
    artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
    verificationLevel: 'independent-automated',
    runtimeStatus: 'project-enabled',
    reviews: [
      matchedRelationReview('reviewer-a', 'relation-run-a'),
      matchedRelationReview('reviewer-b', 'relation-run-b'),
    ],
    sourceRefs: RELATION_REVIEW_SOURCE_REFS,
    ...overrides,
  };
}

describe('relation_core_v1 element matrix', () => {
  it('matches an independent hard-coded directional 5x5 oracle', () => {
    const oracle = [
      ['same-element', 'generates', 'controls', null, null],
      [null, 'same-element', 'generates', 'controls', null],
      [null, null, 'same-element', 'generates', 'controls'],
      ['controls', null, null, 'same-element', 'generates'],
      ['generates', 'controls', null, null, 'same-element'],
    ] as const;

    expect(ELEMENTS).toEqual(['木', '火', '土', '金', '水']);
    for (const [sourceIndex, source] of ELEMENTS.entries()) {
      for (const [targetIndex, target] of ELEMENTS.entries()) {
        expect(elementRelation(source, target), `${source}→${target}`)
          .toBe(oracle[sourceIndex][targetIndex]);
      }
    }
  });
});

describe('stable fact identity', () => {
  const makeFact = (id: string) => ({
    id,
    relation: 'generates' as const,
    source: { type: 'pillar' as const, id: 'day' as const },
    target: { type: 'line' as const, id: 'line:1', side: 'base' as const },
    scope: 'calendar' as const,
    authority: 'structural' as const,
    ruleId: 'element-generates/v1',
    profileId: 'relation_core_v1',
    certainty: 'computed' as const,
    conditions: [],
    values: { sourceElement: '木', targetElement: '火' },
    sourceRefs: ['WS-ZENGSHAN-11'],
  });

  it('normalizes deterministic parts and sorts by code unit', () => {
    expect(createFactId([' Calendar ', 'Line  1', 'GENERATES'])).toBe('fact:calendar:line-1:generates');
    const facts = stableFacts([makeFact('fact:z'), makeFact('fact:a'), makeFact('fact:m')]);
    expect(facts.map(({ id }) => id)).toEqual(['fact:a', 'fact:m', 'fact:z']);
    expect(Object.isFrozen(facts)).toBe(true);
    expect(facts.every(Object.isFrozen)).toBe(true);
    expect(facts.every(({ values, sourceRefs }) => Object.isFrozen(values) && Object.isFrozen(sourceRefs)))
      .toBe(true);
  });

  it('rejects duplicate fact ids instead of silently overwriting', () => {
    expect(() => stableFacts([makeFact('fact:duplicate'), makeFact('fact:duplicate')]))
      .toThrow('派生事实 ID 冲突');
  });
});

describe('relation_core_v1 reviewed artifact', () => {
  it('is separately canonicalized and pinned to the reviewed Wenwang dependency', () => {
    const computedHash = createHash('sha256')
      .update(RELATION_CORE_V1_CANONICAL_PAYLOAD, 'utf8')
      .digest('hex');

    expect(WENWANG_NAJIA_V2_ARTIFACT_HASH)
      .toBe('241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa');
    expect(RELATION_CORE_V1_ARTIFACT.dependsOnWenwangArtifactHash)
      .toBe(WENWANG_NAJIA_V2_ARTIFACT_HASH);
    expect(RELATION_CORE_V1_ARTIFACT_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(computedHash).toBe(RELATION_CORE_V1_ARTIFACT_HASH);
    expect(Object.isFrozen(RELATION_CORE_V1_ARTIFACT)).toBe(true);
    expect(Object.isFrozen(RELATION_CORE_V1_ARTIFACT.branchRules)).toBe(true);
  });

  it('binds the exact two independent automated review records and opens production', () => {
    expect(RELATION_CORE_V1_MANIFEST).toEqual({
      bundleId: 'relation_core_v1',
      version: '1.0.0',
      artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
      verificationLevel: 'independent-automated',
      runtimeStatus: 'project-enabled',
      reviews: [
        {
          reviewerId: 'codex-wikisource-relation-a',
          reviewerKind: 'automated-agent',
          independentRunId: 'relation-core-a-rerun-20260712-093342-3136109',
          reviewedAt: '2026-07-12T09:33:42.3136109+08:00',
          artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
          outcome: 'matched',
          inputSourceRefs: RELATION_REVIEW_SOURCE_REFS,
          reportPath: RELATION_REVIEW_REPORT_PATHS[0],
          checkedClaims: RELATION_REVIEW_CLAIMS,
        },
        {
          reviewerId: 'codex-corpus-relation-b',
          reviewerKind: 'automated-agent',
          independentRunId: 'relation-core-v1-b-0656a5f5-e8e3-47e0-9df5-02d0fd919f8a',
          reviewedAt: '2026-07-12T09:34:19.2997047+08:00',
          artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
          outcome: 'matched',
          inputSourceRefs: RELATION_REVIEW_SOURCE_REFS,
          reportPath: RELATION_REVIEW_REPORT_PATHS[1],
          checkedClaims: RELATION_REVIEW_CLAIMS,
        },
      ],
      sourceRefs: RELATION_REVIEW_SOURCE_REFS,
    });
    expect(RELATION_CORE_V1_MANIFEST.verificationLevel).not.toBe('human-reviewed');
    expect(Object.isFrozen(RELATION_CORE_V1_MANIFEST)).toBe(true);
    expect(RELATION_CORE_V1_MANIFEST.reviews.every(Object.isFrozen)).toBe(true);
    expect(() => assertProjectEnabledRelationBundle(RELATION_CORE_V1_MANIFEST)).not.toThrow();
    expect(() => assertProjectEnabledRelationContext(DEFAULT_RULE_CONTEXT)).not.toThrow();
    expect(domain).not.toHaveProperty('deriveCandidateFacts');
    expect(domain).not.toHaveProperty('assertRelationCandidateContext');
  });

  it('binds every manifest review field to its committed report', () => {
    for (const review of RELATION_CORE_V1_MANIFEST.reviews) {
      expect(existsSync(review.reportPath), `缺少审阅报告 ${review.reportPath}`).toBe(true);
      const report = readFileSync(review.reportPath, 'utf8');
      for (const field of [
        review.reviewerId,
        review.reviewerKind,
        review.independentRunId,
        review.reviewedAt,
        review.artifactHash,
        review.outcome,
        review.reportPath,
        ...review.inputSourceRefs,
        ...review.checkedClaims,
      ]) expect(report).toContain(field);
      for (const sourceRef of review.inputSourceRefs) {
        const source = RELATION_SOURCE_EVIDENCE_CAPSULES.find(({ ref }) => ref.id === sourceRef)?.ref;
        expect(source).toBeDefined();
        expect(report).toContain(source?.url);
        expect(report).toContain(source?.contentHash);
      }
    }
  });

  it('hashes the exact local evidence capsules named by the final manifest', () => {
    expect(new Set(RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id)).size)
      .toBe(RELATION_SOURCE_EVIDENCE_CAPSULES.length);
    for (const { ref, payload } of RELATION_SOURCE_EVIDENCE_CAPSULES) {
      expect(createHash('sha256').update(payload, 'utf8').digest('hex')).toBe(ref.contentHash);
      expect(RELATION_CORE_V1_MANIFEST.sourceRefs).toContain(ref.id);
    }
  });

  it('accepts the exact production context but rejects forged bundle and source evidence', () => {
    expect(() => assertProjectEnabledRelationContext(DEFAULT_RULE_CONTEXT)).not.toThrow();

    const relationSourceId = RELATION_SOURCE_EVIDENCE_CAPSULES[0].ref.id;
    const cases: RuleContext[] = [
      {
        ...DEFAULT_RULE_CONTEXT,
        relationProfile: {
          ...DEFAULT_RULE_CONTEXT.relationProfile,
          bundle: {
            ...DEFAULT_RULE_CONTEXT.relationProfile.bundle,
            artifactHash: 'f'.repeat(64),
          },
        },
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        sources: DEFAULT_RULE_CONTEXT.sources.filter(({ id }) => id !== relationSourceId),
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        sources: DEFAULT_RULE_CONTEXT.sources.map((source) => (
          source.id === relationSourceId ? { ...source, locator: 'forged locator' } : source
        )),
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        sources: [...DEFAULT_RULE_CONTEXT.sources, DEFAULT_RULE_CONTEXT.sources[0]],
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        sources: [...DEFAULT_RULE_CONTEXT.sources, {
          id: 'UNKNOWN-SOURCE',
          title: 'unknown',
          url: 'https://example.invalid',
          locator: 'unknown',
          contentHash: 'a'.repeat(64),
        }],
      },
    ];
    for (const context of cases) {
      expect(() => assertProjectEnabledRelationContext(context))
        .toThrow('关系规则上下文未通过项目运行门');
    }
  });

  it.each([
    null,
    {},
    { ...DEFAULT_RULE_CONTEXT, sources: [null] },
    { ...DEFAULT_RULE_CONTEXT, sources: Object.assign(new Array(1), { length: 1 }) },
  ])('rejects malformed JS context without leaking TypeError: %#', (context) => {
    expect(() => assertProjectEnabledRelationContext(context))
      .toThrow('关系规则上下文未通过项目运行门');
  });

  it('accepts a synthetic manifest only when every required review binding is exact', () => {
    const enabledManifest = enabledRelationManifest();
    expect(() => assertProjectEnabledRelationBundle(enabledManifest)).not.toThrow();
  });

  it.each([
    ['single review', () => enabledRelationManifest({ reviews: [matchedRelationReview('a', 'a')] })],
    ['duplicate reviewer', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('same', 'a'), matchedRelationReview('same', 'b'),
    ] })],
    ['duplicate run', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'same'), matchedRelationReview('b', 'same'),
    ] })],
    ['duplicate report', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { reportPath: 'docs/domain/reviews/same.md' }),
      matchedRelationReview('b', 'b', { reportPath: 'docs/domain/reviews/same.md' }),
    ] })],
    ['different hash', () => enabledRelationManifest({ artifactHash: 'f'.repeat(64) })],
    ['disputed', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a'), matchedRelationReview('b', 'b', { outcome: 'disputed' }),
    ] })],
    ['fixture-only', () => enabledRelationManifest({ runtimeStatus: 'fixture-only' })],
    ['unverified', () => enabledRelationManifest({ verificationLevel: 'unverified' })],
    ['invalid reviewedAt', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { reviewedAt: 'not-a-date' }), matchedRelationReview('b', 'b'),
    ] })],
    ['empty inputs', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { inputSourceRefs: [] }), matchedRelationReview('b', 'b'),
    ] })],
    ['incomplete inputs', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { inputSourceRefs: RELATION_REVIEW_SOURCE_REFS.slice(1) }),
      matchedRelationReview('b', 'b'),
    ] })],
    ['empty claims', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { checkedClaims: [] }), matchedRelationReview('b', 'b'),
    ] })],
    ['incomplete claims', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { checkedClaims: RELATION_REVIEW_CLAIMS.slice(1) }),
      matchedRelationReview('b', 'b'),
    ] })],
    ['wrong fixed report', () => enabledRelationManifest({ reviews: [
      matchedRelationReview('a', 'a', { reportPath: 'docs/domain/reviews/synthetic-a.md' }),
      matchedRelationReview('b', 'b'),
    ] })],
    ['duplicate sources', () => enabledRelationManifest({
      sourceRefs: [...RELATION_REVIEW_SOURCE_REFS, RELATION_REVIEW_SOURCE_REFS[0]],
    })],
  ])('rejects an enabled-looking relation manifest with %s', (_label, makeManifest) => {
    expect(() => assertProjectEnabledRelationBundle(makeManifest()))
      .toThrow('关系规则包未通过项目运行门');
  });

  it.each([
    null,
    {},
    { ...enabledRelationManifest(), sourceRefs: [null] },
    { ...enabledRelationManifest(), reviews: Object.assign(new Array(2), {
      0: matchedRelationReview('reviewer-a', 'relation-run-a'),
    }) },
  ])('rejects malformed JS manifests with one domain error: %#', (manifest) => {
    expect(() => assertProjectEnabledRelationBundle(manifest))
      .toThrow('关系规则包未通过项目运行门');
  });
});

describe('relation_core_v1 branch matrix', () => {
  const match = (source: Branch, target: Branch) => (
    branchRelationMatches(source, target, DEFAULT_RULE_CONTEXT.relationProfile)
  );

  it('keeps six combines and six clashes symmetric and structural', () => {
    for (const relation of ['combines', 'clashes'] as const) {
      const matches = BRANCHES.flatMap((source) => BRANCHES.map((target) => (
        match(source, target).find((candidate) => candidate.relation === relation)
      ))).filter(Boolean);

      expect(matches).toHaveLength(12);
      expect(matches.every((candidate) => (
        candidate?.authority === 'structural'
        && candidate.certainty === 'computed'
        && candidate.direction === 'symmetric'
      ))).toBe(true);
    }
  });

  it('keeps six harms symmetric but profile-dependent', () => {
    const matches = BRANCHES.flatMap((source) => BRANCHES.map((target) => (
      match(source, target).find((candidate) => candidate.relation === 'harms')
    ))).filter(Boolean);

    expect(matches).toHaveLength(12);
    expect(matches.every((candidate) => (
      candidate?.authority === 'profile-dependent'
      && candidate.certainty === 'computed'
      && candidate.direction === 'symmetric'
      && candidate.profileId === 'liuren-six-harms-v1'
    ))).toBe(true);
  });

  it('uses only the four cross-source common breaks by default', () => {
    const expected = new Set(['子酉', '酉子', '丑辰', '辰丑', '卯午', '午卯', '未戌', '戌未']);
    const actual = new Set<string>();

    for (const source of BRANCHES) {
      for (const target of BRANCHES) {
        const candidate = match(source, target).find(({ relation }) => relation === 'breaks');
        if (candidate) {
          actual.add(`${source}${target}`);
          expect(candidate).toMatchObject({
            authority: 'profile-dependent',
            certainty: 'disputed',
            profileId: 'cross-source-common-four-breaks-v1',
            direction: 'symmetric',
          });
        }
      }
    }

    expect(actual).toEqual(expected);
    expect(match('寅', '亥').map(({ relation }) => relation)).toEqual(['combines']);
  });

  it('exposes the full Liuren six-break profile without overwriting combines', () => {
    const profile = {
      ...DEFAULT_RULE_CONTEXT.relationProfile,
      id: 'liuren-six-breaks-review-profile',
      breakPolicy: 'liuren-six-breaks-v1',
    } as const;

    expect(branchRelationMatches('寅', '亥', profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'combines', authority: 'structural' }),
      expect.objectContaining({
        relation: 'breaks',
        profileId: 'liuren-six-breaks-v1',
        certainty: 'disputed',
      }),
    ]));
    expect(branchRelationMatches('巳', '申', profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'combines' }),
      expect.objectContaining({ relation: 'breaks' }),
      expect.objectContaining({ relation: 'punishes', direction: 'forward' }),
    ]));
  });

  it('keeps the Wuxing Jingji four-break profile independently attributable', () => {
    const profile = {
      ...DEFAULT_RULE_CONTEXT.relationProfile,
      id: 'wuxingjingji-four-breaks-review-profile',
      breakPolicy: 'wuxingjingji-four-breaks-v1',
    } as const;

    expect(branchRelationMatches('子', '酉', profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        relation: 'breaks',
        ruleId: 'branch-four-breaks-wuxingjingji/v1',
        profileId: 'wuxingjingji-four-breaks-v1',
        sourceRefs: ['WS-WUXING-JINGJI'],
      }),
    ]));
    expect(branchRelationMatches('寅', '亥', profile).map(({ relation }) => relation))
      .toEqual(['combines']);
  });

  it('keeps directional punishments, mutual Zi-Mao and four self-punishments exact', () => {
    const directed = new Set<string>();
    for (const source of BRANCHES) {
      for (const target of BRANCHES) {
        const candidate = match(source, target).find(({ relation }) => relation === 'punishes');
        if (candidate?.direction === 'forward') directed.add(`${source}>${target}`);
      }
    }

    expect(directed).toEqual(new Set([
      '寅>巳', '巳>申', '丑>戌', '戌>未',
      '子>卯', '卯>子', '辰>辰', '午>午', '酉>酉', '亥>亥',
    ]));
    expect(match('申', '寅').some(({ relation }) => relation === 'punishes')).toBe(false);
    expect(match('未', '丑').some(({ relation }) => relation === 'punishes')).toBe(false);
    expect(match('寅', '巳')).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'harms' }),
      expect.objectContaining({ relation: 'punishes', direction: 'forward', certainty: 'disputed' }),
    ]));
    expect(match('辰', '辰')).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'punishes', direction: 'forward', certainty: 'disputed' }),
    ]));
  });
});

describe('relation fact comparison coverage', () => {
  it.each([
    [0, 0, 24],
    [1, 5, 30],
    [2, 9, 35],
    [3, 12, 39],
    [4, 14, 42],
    [5, 15, 44],
    [6, 15, 45],
  ])('covers the exact pair formula for %i moving lines', (movingCount, basePairs, total) => {
    const tosses = Array.from({ length: 6 }, (_, index) => (
      index < movingCount ? 9 : 7
    )) as unknown as TossTuple;
    const plate = buildFixturePlate(tosses);
    const comparisons = enumerateFactComparisons(plate);

    expect(comparisons.filter(({ scope }) => scope === 'calendar')).toHaveLength(24);
    expect(comparisons.filter(({ scope }) => scope === 'base')).toHaveLength(basePairs);
    expect(comparisons.filter(({ scope }) => scope === 'transition')).toHaveLength(movingCount);
    expect(comparisons).toHaveLength(total);
    expect(new Set(comparisons.map(({ id }) => id)).size).toBe(total);
  });

  it('never emits static-static, pillar-changed or non-own transition comparisons', () => {
    const plate = buildFixturePlate([9, 7, 8, 6, 7, 8]);
    const comparisons = enumerateFactComparisons(plate);

    for (const comparison of comparisons) {
      if (comparison.scope === 'calendar') {
        expect(comparison.source.ref.type).toBe('pillar');
        expect(comparison.target.ref).toMatchObject({ type: 'line', side: 'base' });
      } else if (comparison.scope === 'base') {
        expect(comparison.source.ref).toMatchObject({ type: 'line', side: 'base' });
        expect(comparison.target.ref).toMatchObject({ type: 'line', side: 'base' });
        const positions = [comparison.source.linePosition, comparison.target.linePosition];
        expect(positions.some((position) => plate.movingLines.includes(position!))).toBe(true);
      } else {
        expect(comparison.source.ref).toMatchObject({ type: 'line', side: 'changed' });
        expect(comparison.target.ref).toMatchObject({ type: 'line', side: 'base' });
        expect(comparison.source.linePosition).toBe(comparison.target.linePosition);
      }
    }
  });
});

describe('production relation fact derivation', () => {
  it('derives facts through the reviewed default production context', () => {
    const plate = buildFixturePlate([9, 7, 7, 7, 7, 7]);
    const facts = deriveFacts({ plate, ruleContext: DEFAULT_RULE_CONTEXT });
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every(({ ruleId, sourceRefs }) => ruleId && sourceRefs.length > 0)).toBe(true);
  });

  it('一次返回 Task4 关系与完整 Task6 长生、六神、神煞事实', () => {
    const plate = buildFixturePlate([9, 7, 8, 6, 7, 8]);
    const facts = productionFacts(plate);
    const growthShenSha = deriveGrowthShenShaFacts({
      plate,
      ruleContext: DEFAULT_RULE_CONTEXT,
    });
    const task6Facts = facts.filter(({ relation }) => (
      relation === 'is-growth-stage'
      || relation === 'is-six-beast'
      || relation === 'is-shen-sha'
    ));

    expect(task6Facts).toEqual(growthShenSha);
    expect(task6Facts.filter(({ relation, scope }) => (
      relation === 'is-growth-stage' && scope === 'calendar'
    ))).toHaveLength(48);
    expect(task6Facts.filter(({ relation, scope }) => (
      relation === 'is-growth-stage' && scope === 'transition'
    ))).toHaveLength(plate.movingLines.length);
    expect(task6Facts.filter(({ relation }) => relation === 'is-six-beast')).toHaveLength(6);
    expect(facts.some(({ relation }) => (
      relation === 'generates' || relation === 'controls' || relation === 'same-element'
    ))).toBe(true);
    expect(new Set(facts.map(({ id }) => id)).size).toBe(facts.length);
  });

  it('rejects malformed PlateV2 shapes before the production manifest gate runs', () => {
    const valid = buildFixturePlate([9, 7, 7, 7, 7, 7]);
    const malformed = (mutate: (plate: any) => void): unknown => {
      const plate = structuredClone(valid) as any;
      mutate(plate);
      return plate;
    };
    const sparseLines = malformed((plate) => {
      plate.lines = Object.assign(new Array(6), { 0: plate.lines[0] });
    });
    const cases = [
      null,
      { ...valid, lines: [] },
      sparseLines,
      malformed((plate) => { plate.lines[1].position = 1; }),
      malformed((plate) => { plate.lines[1].id = 'line:1'; }),
      malformed((plate) => { plate.lines[0].base.branch = '非法支'; }),
      malformed((plate) => { plate.lines[0].base.branchElement = '非法五行'; }),
      malformed((plate) => { plate.movingLines = []; }),
      malformed((plate) => { plate.lines[0].transition = null; }),
      malformed((plate) => { delete plate.calendar.pillars.hour; }),
    ];

    expect(() => assertPlateV2RuntimeShape(valid)).not.toThrow();
    for (const plate of cases) {
      expect(() => assertPlateV2RuntimeShape(plate)).toThrow('PlateV2 运行时结构无效');
      expect(() => deriveFacts({ plate, ruleContext: DEFAULT_RULE_CONTEXT } as never))
        .toThrow('PlateV2 运行时结构无效');
    }
  });

  it('creates one directional element fact for every comparison and preserves all branch overlaps', () => {
    const plate = buildFixturePlate([9, 9, 7, 7, 7, 7]);
    const comparisons = enumerateFactComparisons(plate);
    const facts = productionFacts(plate);
    const elementFacts = facts.filter(({ relation }) => (
      relation === 'generates' || relation === 'controls' || relation === 'same-element'
    ));

    expect(elementFacts).toHaveLength(comparisons.length);
    for (const fact of elementFacts) {
      expect(fact).toMatchObject({
        authority: 'structural',
        certainty: 'computed',
        profileId: 'relation_core_v1',
      });
    }

    const overlapPlate = structuredClone(plate);
    overlapPlate.calendar.pillars.year.branch = { value: '寅', element: '木' };
    overlapPlate.calendar.pillars.year.ganZhi = `${overlapPlate.calendar.pillars.year.stem.value}寅`;
    overlapPlate.lines[0].base.branch = '巳';
    overlapPlate.lines[0].base.branchElement = '火';
    overlapPlate.lines[0].base.ganZhi = `${overlapPlate.lines[0].base.stem}巳`;
    const overlapRelations = productionFacts(overlapPlate)
      .filter(({ values }) => (
        values.comparisonId === 'calendar|pillar:year|line:line:1:base'
      ))
      .map(({ relation }) => relation);
    expect(overlapRelations).toEqual(expect.arrayContaining(['generates', 'harms', 'punishes']));
    expect(new Set(overlapRelations).size).toBe(overlapRelations.length);
  });

  it('orients element facts against hard-coded source and target expectations', () => {
    const base = buildFixturePlate([9, 7, 7, 7, 7, 7]);
    const waterControlsFire = structuredClone(base);
    waterControlsFire.calendar.pillars.year.branch = { value: '子', element: '水' };
    waterControlsFire.calendar.pillars.year.ganZhi = `${waterControlsFire.calendar.pillars.year.stem.value}子`;
    waterControlsFire.lines[0].base.branch = '午';
    waterControlsFire.lines[0].base.branchElement = '火';
    waterControlsFire.lines[0].base.ganZhi = `${waterControlsFire.lines[0].base.stem}午`;
    const forward = productionFacts(waterControlsFire).find(({ relation, values }) => (
      relation === 'controls'
      && values.comparisonId === 'calendar|pillar:year|line:line:1:base'
    ));
    expect(forward).toMatchObject({
      source: { type: 'pillar', id: 'year' },
      target: { type: 'line', id: 'line:1', side: 'base' },
      values: { sourceElement: '水', targetElement: '火' },
    });

    const woodControlsEarth = structuredClone(base);
    woodControlsEarth.calendar.pillars.year.branch = { value: '丑', element: '土' };
    woodControlsEarth.calendar.pillars.year.ganZhi = `${woodControlsEarth.calendar.pillars.year.stem.value}丑`;
    woodControlsEarth.lines[0].base.branch = '寅';
    woodControlsEarth.lines[0].base.branchElement = '木';
    woodControlsEarth.lines[0].base.ganZhi = `${woodControlsEarth.lines[0].base.stem}寅`;
    const reverse = productionFacts(woodControlsEarth).find(({ relation, values }) => (
      relation === 'controls'
      && values.comparisonId === 'calendar|pillar:year|line:line:1:base'
    ));
    expect(reverse).toMatchObject({
      source: { type: 'line', id: 'line:1', side: 'base' },
      target: { type: 'pillar', id: 'year' },
      values: { sourceElement: '木', targetElement: '土' },
    });
  });

  it('rejects a plate built from any structural artifact other than the declared dependency', () => {
    const plate = buildFixturePlate([9, 7, 7, 7, 7, 7]);
    const forged = {
      ...plate,
      rulePackRef: { ...plate.rulePackRef, artifactHash: 'f'.repeat(64) },
    } as PlateV2;

    expect(() => productionFacts(forged)).toThrow('关系事实排盘依赖不匹配');
  });

  it('uses pillar branches rather than stems and fixes transitions as changed to base', () => {
    const plate = buildFixturePlate([9, 7, 7, 7, 7, 7]);
    expect(plate.calendar.pillars.month).toMatchObject({
      stem: { value: '乙', element: '木' },
      branch: { value: '未', element: '土' },
    });
    const facts = productionFacts(plate);
    const monthToFirstLine = facts.find(({ relation, values }) => (
      relation === 'controls'
      && values.comparisonId === 'calendar|pillar:month|line:line:1:base'
    ));
    expect(monthToFirstLine).toMatchObject({
      source: { type: 'pillar', id: 'month' },
      target: { type: 'line', id: 'line:1', side: 'base' },
      values: { sourceElement: '土', targetElement: '水' },
    });

    const transitionFacts = facts.filter(({ scope, relation }) => (
      scope === 'transition' && relation !== 'is-growth-stage'
    ));
    expect(transitionFacts.length).toBeGreaterThan(0);
    expect(transitionFacts.every(({ source, target }) => (
      source.type === 'line' && source.side === 'changed'
      && target?.type === 'line' && target.side === 'base'
      && source.id === target.id
    ))).toBe(true);
    const transitionGrowth = facts.filter(({ scope, relation }) => (
      scope === 'transition' && relation === 'is-growth-stage'
    ));
    expect(transitionGrowth).toHaveLength(plate.movingLines.length);
    expect(transitionGrowth.every(({ source, target }) => (
      source.type === 'line' && source.side === 'base'
      && target?.type === 'line' && target.side === 'changed'
      && source.id === target.id
    ))).toBe(true);
  });

  it('is stable across deep clone and runtime traversal order', () => {
    const plate = buildFixturePlate([9, 7, 8, 6, 7, 8]);
    const reordered = structuredClone(plate);
    reordered.lines = [...reordered.lines].reverse() as unknown as PlateV2['lines'];
    const { year, month, day, hour } = reordered.calendar.pillars;
    reordered.calendar.pillars = { hour, day, month, year } as typeof reordered.calendar.pillars;

    const first = productionFacts(plate);
    const second = productionFacts(reordered);
    expect(second).toEqual(first);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(first.map(({ id }) => id)).toEqual([...first.map(({ id }) => id)].sort());
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/[吉凶]/);
    expect(first.every(({ ruleId, profileId, sourceRefs }) => (
      ruleId.length > 0 && profileId.length > 0 && sourceRefs.length > 0
    ))).toBe(true);
  });
});
