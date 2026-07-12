import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOLDEN_HEXAGRAMS, GOLDEN_TRIGRAM_BITS, type GoldenHexagram } from './__fixtures__/golden-hexagrams.js';
import { GOLDEN_CHANGED_RELATION_CASES, GOLDEN_NAJIA } from './__fixtures__/golden-najia.js';
import { GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES } from './facts/growth-shensha-core-v1.js';
import { EFFECTS_SOURCE_EVIDENCE_CAPSULES } from './facts/effects-core-v1.js';
import { RELATION_SOURCE_EVIDENCE_CAPSULES } from './facts/relation-core-v1.js';
import type { PlateV2, SixRelation } from './model.js';
import { assertPlateV2RuntimeShape } from './plate-runtime.js';
import { buildPlateV2 } from './plate.js';
import {
  BASE_RULE_CONTEXT,
  DEFAULT_RULE_CONTEXT,
  REGISTERED_RULE_SOURCES,
} from './rules/default-context.js';
import type { RuleContext, RulePackManifest, RuleReviewRecord } from './rules/model.js';
import { assertProjectEnabledRulePack } from './rules/registry.js';
import { canonicalStringify } from './rules/tables.js';
import {
  RULE_SOURCE_EVIDENCE_CAPSULES,
  WENWANG_NAJIA_V2_ARTIFACT,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  WENWANG_NAJIA_V2_CANONICAL_PAYLOAD,
  WENWANG_NAJIA_V2_MANIFEST,
} from './rules/wenwang-najia-v2.js';

const FIXED_BUILD_INPUT = {
  plateId: 'plate-fixed',
  sessionId: 'session-fixed',
  castAt: '2026-07-11T04:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

const REVIEW_INPUT_SOURCE_REFS = RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id);
const REVIEW_CHECKED_CLAIMS = [
  'hexagrams:64',
  'najia-lines:384',
  'review-assertions:25',
  'qian-to-gou-full-changed-reinstall',
  'qian-to-kun-dual-relations',
  'hidden-spirit-candidates:56',
] as const;
const REVIEW_REPORT_PATHS = [
  'docs/domain/reviews/wenwang-najia-v2-review-a.md',
  'docs/domain/reviews/wenwang-najia-v2-review-b.md',
] as const;
const GOLDEN_NAJIA_BY_KEY: ReadonlyMap<string, (typeof GOLDEN_NAJIA)[number]> = new Map(
  GOLDEN_NAJIA.map((entry) => [entry.key, entry]),
);
const GOLDEN_HEXAGRAM_BY_KEY: ReadonlyMap<string, (typeof GOLDEN_HEXAGRAMS)[number]> = new Map(
  GOLDEN_HEXAGRAMS.map((entry) => [entry.key, entry]),
);

type TossTuple = PlateV2['rawTosses'];

function staticTossesForHexagram(hexagram: GoldenHexagram): TossTuple {
  const bits = [
    ...GOLDEN_TRIGRAM_BITS[hexagram.lowerTrigram],
    ...GOLDEN_TRIGRAM_BITS[hexagram.upperTrigram],
  ];
  return bits.map((yang) => (yang ? 7 : 8)) as unknown as TossTuple;
}

function buildFixturePlate(tossValues: TossTuple): PlateV2 {
  return buildPlateV2({ ...FIXED_BUILD_INPUT, tossValues });
}

function buildStaticHexagram(name: string): PlateV2 {
  const golden = GOLDEN_HEXAGRAMS.find((hexagram) => hexagram.name === name);
  if (!golden) throw new Error(`黄金表缺少卦名：${name}`);
  return buildFixturePlate(staticTossesForHexagram(golden));
}

function matchedReview(
  reviewerId: string,
  independentRunId: string,
  overrides: Partial<RuleReviewRecord> & {
    inputSourceRefs?: readonly string[];
    reportPath?: string;
    checkedClaims?: readonly string[];
  } = {},
): RuleReviewRecord {
  return {
    reviewerId,
    reviewerKind: 'automated-agent',
    independentRunId,
    reviewedAt: '2026-07-12T08:00:00+08:00',
    artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs: REVIEW_INPUT_SOURCE_REFS,
    reportPath: independentRunId.endsWith('a') ? REVIEW_REPORT_PATHS[0] : REVIEW_REPORT_PATHS[1],
    checkedClaims: REVIEW_CHECKED_CLAIMS,
    ...overrides,
  } as RuleReviewRecord;
}

function enabledManifest(overrides: Partial<RulePackManifest> = {}): RulePackManifest {
  return {
    rulePackId: 'wenwang_najia_v2',
    version: '2.0.0',
    artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    verificationLevel: 'independent-automated',
    runtimeStatus: 'project-enabled',
    reviews: [matchedReview('reviewer-a', 'run-a'), matchedReview('reviewer-b', 'run-b')],
    sourceRefs: WENWANG_NAJIA_V2_MANIFEST.sourceRefs,
    ...overrides,
  };
}

describe('wenwang_najia_v2 reviewed artifact', () => {
  it('has one stable canonical payload and a precomputed SHA-256', () => {
    const independentlyComputed = createHash('sha256')
      .update(WENWANG_NAJIA_V2_CANONICAL_PAYLOAD, 'utf8')
      .digest('hex');

    expect(canonicalStringify(WENWANG_NAJIA_V2_ARTIFACT)).toBe(WENWANG_NAJIA_V2_CANONICAL_PAYLOAD);
    expect(WENWANG_NAJIA_V2_ARTIFACT_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(independentlyComputed).toBe(WENWANG_NAJIA_V2_ARTIFACT_HASH);
  });

  it('deep-freezes the final tables and two real automated review records', () => {
    expect(Object.isFrozen(WENWANG_NAJIA_V2_ARTIFACT)).toBe(true);
    expect(Object.isFrozen(WENWANG_NAJIA_V2_ARTIFACT.hexagrams)).toBe(true);
    expect(Object.isFrozen(WENWANG_NAJIA_V2_ARTIFACT.hexagrams[0])).toBe(true);
    expect(Object.isFrozen(WENWANG_NAJIA_V2_ARTIFACT.trigrams[0].inner.branches)).toBe(true);
    expect(Object.isFrozen(WENWANG_NAJIA_V2_MANIFEST)).toBe(true);
    expect(Object.isFrozen(WENWANG_NAJIA_V2_MANIFEST.reviews)).toBe(true);
    expect(WENWANG_NAJIA_V2_MANIFEST).toEqual({
      rulePackId: 'wenwang_najia_v2',
      version: '2.0.0',
      artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
      verificationLevel: 'independent-automated',
      runtimeStatus: 'project-enabled',
      reviews: [
        {
          reviewerId: 'codex-ctext-audit-a',
          reviewerKind: 'automated-agent',
          independentRunId: 'wenwang-final-a-20260712',
          reviewedAt: '2026-07-12T08:00:00+08:00',
          artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
          outcome: 'matched',
          inputSourceRefs: REVIEW_INPUT_SOURCE_REFS,
          reportPath: 'docs/domain/reviews/wenwang-najia-v2-review-a.md',
          checkedClaims: REVIEW_CHECKED_CLAIMS,
        },
        {
          reviewerId: 'codex-wikisource-audit-b',
          reviewerKind: 'automated-agent',
          independentRunId: 'wenwang-final-b-20260712',
          reviewedAt: '2026-07-12T07:57:25.9273596+08:00',
          artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
          outcome: 'matched',
          inputSourceRefs: REVIEW_INPUT_SOURCE_REFS,
          reportPath: 'docs/domain/reviews/wenwang-najia-v2-review-b.md',
          checkedClaims: REVIEW_CHECKED_CLAIMS,
        },
      ],
      sourceRefs: RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
    });
    expect(WENWANG_NAJIA_V2_MANIFEST.reviews.every(Object.isFrozen)).toBe(true);
    expect(WENWANG_NAJIA_V2_MANIFEST.reviews.every((review) => (
      Object.isFrozen(review.inputSourceRefs) && Object.isFrozen(review.checkedClaims)
    ))).toBe(true);
  });

  it('keeps each automated review report committed and bound to its manifest record', () => {
    for (const review of WENWANG_NAJIA_V2_MANIFEST.reviews) {
      expect(existsSync(review.reportPath), `缺少审阅报告 ${review.reportPath}`).toBe(true);
      const report = readFileSync(review.reportPath, 'utf8');
      expect(report).toContain(review.reviewerId);
      expect(report).toContain(review.independentRunId);
      expect(report).toContain(review.artifactHash);
      expect(report).toContain('13,192');
      expect(report).toContain('automated-agent');
      for (const sourceId of review.inputSourceRefs) {
        const source = RULE_SOURCE_EVIDENCE_CAPSULES.find(({ ref }) => ref.id === sourceId)?.ref;
        expect(source).toBeDefined();
        expect(report).toContain(sourceId);
        expect(report).toContain(source?.url);
      }
      for (const checkedClaim of review.checkedClaims) expect(report).toContain(checkedClaim);
    }

    const reportA = readFileSync('docs/domain/reviews/wenwang-najia-v2-review-a.md', 'utf8');
    const reportB = readFileSync('docs/domain/reviews/wenwang-najia-v2-review-b.md', 'utf8');
    expect(reportA).toContain('CText live HTTP 403');
    expect(reportA).toContain('未读取 `.superpowers/sdd/domain-source-second-review.md`');
    expect(reportB).toContain('禁止读取 A');
  });

  it('hashes the exact local evidence capsules named by sourceRefs', () => {
    expect(RULE_SOURCE_EVIDENCE_CAPSULES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id)).size)
      .toBe(RULE_SOURCE_EVIDENCE_CAPSULES.length);

    for (const { ref, payload } of RULE_SOURCE_EVIDENCE_CAPSULES) {
      expect(createHash('sha256').update(payload, 'utf8').digest('hex')).toBe(ref.contentHash);
      expect(WENWANG_NAJIA_V2_MANIFEST.sourceRefs).toContain(ref.id);
    }
    expect(WENWANG_NAJIA_V2_MANIFEST.sourceRefs).toHaveLength(RULE_SOURCE_EVIDENCE_CAPSULES.length);
  });

  it('matches the explicit 64-hexagram golden table', () => {
    expect(WENWANG_NAJIA_V2_ARTIFACT.hexagrams).toEqual(GOLDEN_HEXAGRAMS);
    expect(WENWANG_NAJIA_V2_ARTIFACT.hexagrams).toHaveLength(64);
    expect(new Set(WENWANG_NAJIA_V2_ARTIFACT.hexagrams.map(({ key }) => key)).size).toBe(64);
  });
});

describe('assertProjectEnabledRulePack', () => {
  it('accepts the real manifest with two independent automated matches', () => {
    expect(() => assertProjectEnabledRulePack(WENWANG_NAJIA_V2_MANIFEST)).not.toThrow();
  });

  it('accepts two independent automated matches for the exact compiled artifact only', () => {
    const manifest = enabledManifest();
    expect(() => assertProjectEnabledRulePack(manifest)).not.toThrow();
    expect(manifest.verificationLevel).toBe('independent-automated');
  });

  it.each([
    ['single review', () => enabledManifest({ reviews: [matchedReview('reviewer-a', 'run-a')] })],
    ['duplicate reviewerId', () => enabledManifest({ reviews: [matchedReview('same', 'run-a'), matchedReview('same', 'run-b')] })],
    ['duplicate runId', () => enabledManifest({ reviews: [matchedReview('reviewer-a', 'same'), matchedReview('reviewer-b', 'same')] })],
    ['different artifactHash', () => enabledManifest({ reviews: [matchedReview('reviewer-a', 'run-a'), matchedReview('reviewer-b', 'run-b', { artifactHash: 'f'.repeat(64) })] })],
    ['disputed outcome', () => enabledManifest({ reviews: [matchedReview('reviewer-a', 'run-a'), matchedReview('reviewer-b', 'run-b', { outcome: 'disputed' })] })],
    ['unverified level', () => enabledManifest({ verificationLevel: 'unverified' })],
    ['fixture-only status', () => enabledManifest({ runtimeStatus: 'fixture-only' })],
    ['manifest hash differs from compiled artifact', () => enabledManifest({ artifactHash: 'e'.repeat(64) })],
    ['forged verificationLevel', () => enabledManifest({ verificationLevel: 'forged' as RulePackManifest['verificationLevel'] })],
    ['invalid reviewedAt', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { reviewedAt: 'not-a-date' }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['trim-equivalent reviewerId', () => enabledManifest({ reviews: [
      matchedReview('same', 'run-a'),
      matchedReview(' same', 'run-b'),
    ] })],
    ['trim-equivalent runId', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'same'),
      matchedReview('reviewer-b', ' same'),
    ] })],
    ['forged reviewerKind', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a'),
      matchedReview('reviewer-b', 'run-b'),
      matchedReview('reviewer-c', 'run-c', { reviewerKind: 'bot' as RuleReviewRecord['reviewerKind'] }),
    ] })],
    ['empty inputSourceRefs', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { inputSourceRefs: [] }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['duplicate inputSourceRefs', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { inputSourceRefs: [REVIEW_INPUT_SOURCE_REFS[0], REVIEW_INPUT_SOURCE_REFS[0]] }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['incomplete inputSourceRefs', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { inputSourceRefs: REVIEW_INPUT_SOURCE_REFS.slice(1) }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['unknown inputSourceRef', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { inputSourceRefs: ['UNKNOWN-SOURCE'] }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['empty reportPath', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { reportPath: '   ' }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['duplicate reportPath', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { reportPath: 'docs/domain/reviews/same.md' }),
      matchedReview('reviewer-b', 'run-b', { reportPath: 'docs/domain/reviews/same.md' }),
    ] })],
    ['empty checkedClaims', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { checkedClaims: [] }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['incomplete checkedClaims', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { checkedClaims: REVIEW_CHECKED_CLAIMS.slice(1) }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
    ['wrong fixed report path', () => enabledManifest({ reviews: [
      matchedReview('reviewer-a', 'run-a', { reportPath: 'docs/domain/reviews/synthetic-a.md' }),
      matchedReview('reviewer-b', 'run-b'),
    ] })],
  ])('rejects %s', (_label, makeManifest) => {
    expect(() => assertProjectEnabledRulePack(makeManifest())).toThrow('结构规则包未通过项目运行门');
  });

  it.each([
    null,
    {},
    { ...enabledManifest(), sourceRefs: [null] },
    { ...enabledManifest(), reviews: Object.assign(new Array(2), {
      0: matchedReview('reviewer-a', 'run-a'),
    }) },
  ])('rejects malformed JS manifests with the structural gate error: %#', (manifest) => {
    expect(() => assertProjectEnabledRulePack(manifest))
      .toThrow('结构规则包未通过项目运行门');
  });
});

describe('buildPlateV2', () => {
  it.each([
    ['toss yin-yang changed without rebuilding the hexagram', (plate: any) => {
      plate.rawTosses[0] = 8;
      plate.lines[0].tossValue = 8;
    }],
    ['registered but wrong Najia stem', (plate: any) => {
      const facet = plate.lines[0].base;
      facet.stem = facet.stem === '甲' ? '乙' : '甲';
      facet.stemElement = facet.stem === '甲' ? '木' : '木';
      facet.ganZhi = `${facet.stem}${facet.branch}`;
    }],
    ['rule-pack version', (plate: any) => { plate.rulePackRef.version = 'bogus'; }],
    ['rule-pack artifact hash', (plate: any) => {
      plate.rulePackRef.artifactHash = '0'.repeat(64);
    }],
    ['calendar pillar copied from another cast instant', (plate: any) => {
      const otherDate = buildPlateV2({
        ...FIXED_BUILD_INPUT,
        castAt: '2026-07-12T04:00:00.000Z',
        tossValues: plate.rawTosses,
      });
      plate.calendar.pillars.day = structuredClone(otherDate.calendar.pillars.day);
    }],
    ['line tuple order', (plate: any) => {
      [plate.lines[0], plate.lines[1]] = [plate.lines[1], plate.lines[0]];
    }],
  ])('runtime gate rejects forged %s binding', (_label, forge) => {
    const plate = structuredClone(buildFixturePlate([7, 7, 7, 7, 7, 7])) as any;
    forge(plate);
    expect(() => assertPlateV2RuntimeShape(plate)).toThrow('PlateV2 运行时结构无效');
  });

  it.each([
    ['base relation to base palace', (plate: any) => { plate.lines[0].base.relationToBasePalace = '父母'; }],
    ['base relation to own palace', (plate: any) => { plate.lines[0].base.relationToOwnPalace = '父母'; }],
    ['changed relation to base palace', (plate: any) => { plate.lines[0].changed.relationToBasePalace = '兄弟'; }],
    ['changed relation to own palace', (plate: any) => { plate.lines[0].changed.relationToOwnPalace = '父母'; }],
  ])('runtime gate rejects forged %s', (_label, forge) => {
    const plate = structuredClone(buildFixturePlate([9, 9, 9, 9, 9, 9])) as any;
    forge(plate);

    expect(() => assertPlateV2RuntimeShape(plate)).toThrow('PlateV2 运行时结构无效');
  });

  it.each([
    ['unregistered stem with matching undefined element', (plate: any) => {
      const facet = plate.lines[0].changed;
      facet.stem = '非法干';
      delete facet.stemElement;
      facet.ganZhi = `${facet.stem}${facet.branch}`;
    }],
    ['unregistered branch with internally coherent forged relations', (plate: any) => {
      const facet = plate.lines[0].changed;
      facet.branch = '非法支';
      delete facet.branchElement;
      facet.ganZhi = `${facet.stem}${facet.branch}`;
      facet.relationToBasePalace = '妻财';
      facet.relationToOwnPalace = '妻财';
    }],
  ])('runtime gate rejects %s', (_label, forge) => {
    const plate = structuredClone(buildFixturePlate([7, 7, 7, 7, 7, 7])) as any;
    forge(plate);

    expect(() => assertPlateV2RuntimeShape(plate)).toThrow('PlateV2 运行时结构无效');
  });

  it.each([
    ['missing base 世', (plate: any) => { plate.lines[5].base.role = null; }],
    ['duplicate base 世', (plate: any) => { plate.lines[4].base.role = '世'; }],
    ['misplaced base 应', (plate: any) => {
      plate.lines[2].base.role = null;
      plate.lines[1].base.role = '应';
    }],
    ['missing changed 世', (plate: any) => { plate.lines[0].changed.role = null; }],
    ['duplicate changed 应', (plate: any) => { plate.lines[4].changed.role = '应'; }],
    ['misplaced changed 世', (plate: any) => {
      plate.lines[0].changed.role = null;
      plate.lines[1].changed.role = '世';
    }],
  ])('runtime gate rejects %s role metadata', (_label, forge) => {
    const plate = structuredClone(buildFixturePlate([9, 7, 7, 7, 7, 7])) as any;
    forge(plate);

    expect(() => assertPlateV2RuntimeShape(plate)).toThrow('PlateV2 运行时结构无效');
  });

  it.each([
    ['sparse candidate array', (plate: any) => {
      plate.lines[2].hiddenSpiritCandidates = Object.assign(new Array(1), {});
    }],
    ['non-plain candidate', (plate: any) => {
      plate.lines[2].hiddenSpiritCandidates[0] = Object.assign(
        Object.create({ forged: true }),
        plate.lines[2].hiddenSpiritCandidates[0],
      );
    }],
    ['forged id', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].id = 'hidden:forged'; }],
    ['forged hostLineId', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].hostLineId = 'line:4'; }],
    ['forged sourceLine', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].sourceLine = 4; }],
    ['forged relation', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].relation = '官鬼'; }],
    ['forged stem', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].stem = '甲'; }],
    ['forged branch', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].branch = '子'; }],
    ['forged ganZhi', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].ganZhi = '甲子'; }],
    ['forged element', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].element = '木'; }],
    ['forged sourceHexagram', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].sourceHexagram = '乾为天'; }],
    ['forged status', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].status = 'active'; }],
    ['forged extra field', (plate: any) => { plate.lines[2].hiddenSpiritCandidates[0].forged = true; }],
    ['candidate moved to another host', (plate: any) => {
      plate.lines[3].hiddenSpiritCandidates = plate.lines[2].hiddenSpiritCandidates;
      plate.lines[2].hiddenSpiritCandidates = [];
    }],
    ['missing reviewed candidate', (plate: any) => { plate.lines[2].hiddenSpiritCandidates = []; }],
    ['globally duplicated candidate id', (plate: any) => {
      plate.lines[2].hiddenSpiritCandidates.push(structuredClone(plate.lines[2].hiddenSpiritCandidates[0]));
    }],
  ])('runtime gate rejects hidden-spirit %s', (_label, forge) => {
    const plate = structuredClone(buildStaticHexagram('风泽中孚')) as any;
    forge(plate);

    expect(() => assertPlateV2RuntimeShape(plate)).toThrow('PlateV2 运行时结构无效');
  });

  it.each([0, null])('rejects a non-object JS input: %s', (input) => {
    expect(() => buildPlateV2(input as unknown as Parameters<typeof buildPlateV2>[0]))
      .toThrow('buildPlateV2 input 必须是对象');
  });

  it.each([
    ['plateId', ''], ['plateId', '   '], ['plateId', ' leading'], ['plateId', 'trailing '], ['plateId', 0], ['plateId', null],
    ['sessionId', ''], ['sessionId', '   '], ['sessionId', ' leading'], ['sessionId', 'trailing '], ['sessionId', 0], ['sessionId', null],
  ])('rejects invalid %s value %j', (field, value) => {
    const input = { ...FIXED_BUILD_INPUT, tossValues: [9, 7, 7, 7, 7, 7], [field]: value };
    expect(() => buildPlateV2(input as unknown as Parameters<typeof buildPlateV2>[0]))
      .toThrow(`${field} 必须是无首尾空白的非空字符串`);
  });

  it.each([
    ['missing context', undefined],
    ['non-array sources', { ...DEFAULT_RULE_CONTEXT, sources: null }],
    ['null source entry', { ...DEFAULT_RULE_CONTEXT, sources: [null] }],
    ['sparse sources', { ...DEFAULT_RULE_CONTEXT, sources: new Array(1) }],
  ])('rejects malformed runtime context: %s', (_label, ruleContext) => {
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: [9, 7, 7, 7, 7, 7],
      ruleContext: ruleContext as unknown as RuleContext,
    })).toThrow('结构规则上下文未通过项目运行门');
  });

  it('rejects BASE_RULE_CONTEXT because it remains fixture-only with no sources', () => {
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: [9, 7, 7, 7, 7, 7],
      ruleContext: BASE_RULE_CONTEXT,
    })).toThrow('结构规则上下文未通过项目运行门');
  });

  it('validates only the structural source subset while accepting the registered source union', () => {
    expect(DEFAULT_RULE_CONTEXT.sources).toEqual(REGISTERED_RULE_SOURCES);
    expect(new Set(DEFAULT_RULE_CONTEXT.sources.map(({ id }) => id)).size)
      .toBe(DEFAULT_RULE_CONTEXT.sources.length);
    expect(DEFAULT_RULE_CONTEXT.sources).toEqual(expect.arrayContaining([
      ...RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
    ]));

    const structuralOnlyContext = {
      ...DEFAULT_RULE_CONTEXT,
      sources: RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
    } as RuleContext;
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: [9, 7, 7, 7, 7, 7],
      ruleContext: structuralOnlyContext,
    })).not.toThrow();
  });

  it('rejects forged or unknown extras even when all structural sources remain present', () => {
    const relationSourceId = RELATION_SOURCE_EVIDENCE_CAPSULES[0].ref.id;
    const forgedRelationSource = {
      ...DEFAULT_RULE_CONTEXT,
      sources: DEFAULT_RULE_CONTEXT.sources.map((source) => (
        source.id === relationSourceId ? { ...source, title: 'forged title' } : source
      )),
    } as RuleContext;
    const unknownExtra = {
      ...DEFAULT_RULE_CONTEXT,
      sources: [...DEFAULT_RULE_CONTEXT.sources, {
        id: 'UNKNOWN-SOURCE',
        title: 'unknown',
        url: 'https://example.invalid',
        locator: 'unknown',
        contentHash: 'f'.repeat(64),
      }],
    } as RuleContext;

    for (const ruleContext of [forgedRelationSource, unknownExtra]) {
      expect(() => buildPlateV2({
        ...FIXED_BUILD_INPUT,
        tossValues: [9, 7, 7, 7, 7, 7],
        ruleContext,
      })).toThrow('结构规则上下文未通过项目运行门');
    }
  });

  it.each([
    ['missing source', (sources: typeof DEFAULT_RULE_CONTEXT.sources) => sources.slice(1)],
    ['forged URL', (sources: typeof DEFAULT_RULE_CONTEXT.sources) => sources.map((source, index) => (
      index === 0 ? { ...source, url: 'https://example.invalid/forged' } : source
    ))],
    ['forged locator', (sources: typeof DEFAULT_RULE_CONTEXT.sources) => sources.map((source, index) => (
      index === 0 ? { ...source, locator: 'forged locator' } : source
    ))],
    ['forged contentHash', (sources: typeof DEFAULT_RULE_CONTEXT.sources) => sources.map((source, index) => (
      index === 0 ? { ...source, contentHash: 'f'.repeat(64) } : source
    ))],
    ['duplicate source', (sources: typeof DEFAULT_RULE_CONTEXT.sources) => [...sources.slice(0, -1), sources[0]]],
  ])('rejects a context with %s', (_label, forgeSources) => {
    const forgedContext = {
      ...DEFAULT_RULE_CONTEXT,
      sources: forgeSources(DEFAULT_RULE_CONTEXT.sources),
    };
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: [9, 7, 7, 7, 7, 7],
      ruleContext: forgedContext,
    })).toThrow('结构规则上下文未通过项目运行门');
  });

  it.each([
    ['forged schemaVersion', (context: RuleContext) => ({ ...context, schemaVersion: '9.9.9' })],
    ['forged calendar profile id', (context: RuleContext) => ({
      ...context,
      calendarProfile: { ...context.calendarProfile, id: 'forged-calendar' },
    })],
    ['forged calendar day boundary', (context: RuleContext) => ({
      ...context,
      calendarProfile: { ...context.calendarProfile, dayBoundary: 'midnight' },
    })],
  ])('rejects %s at runtime', (_label, forgeContext) => {
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: [9, 7, 7, 7, 7, 7],
      ruleContext: forgeContext(DEFAULT_RULE_CONTEXT) as unknown as RuleContext,
    })).toThrow('结构规则上下文未通过项目运行门');
  });

  it.each([
    ['relation', (context: RuleContext) => ({
      ...context,
      relationProfile: { ...context.relationProfile, changedRelationReference: 'changed-palace' },
    })],
    ['effects', (context: RuleContext) => ({
      ...context,
      effectsProfile: { ...context.effectsProfile, dayClashPolicy: 'forged' },
    })],
    ['growth', (context: RuleContext) => ({
      ...context,
      growthProfile: { ...context.growthProfile, earthFollows: 'fire' },
    })],
    ['six-spirit', (context: RuleContext) => ({
      ...context,
      sixSpiritProfile: { ...context.sixSpiritProfile, source: 'forged' },
    })],
    ['shen-sha', (context: RuleContext) => ({
      ...context,
      shenShaProfile: { ...context.shenShaProfile, enabled: ['tianyi'] },
    })],
    ['use-god', (context: RuleContext) => ({
      ...context,
      useGodProfile: { ...context.useGodProfile, ambiguousIntent: 'guess' },
    })],
  ])('does not consume the %s profile', (_label, forgeContext) => {
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: [9, 7, 7, 7, 7, 7],
      ruleContext: forgeContext(DEFAULT_RULE_CONTEXT) as unknown as RuleContext,
    })).not.toThrow();
  });

  it('builds complete base and changed sides and re-installs static changed lines', () => {
    const plate = buildFixturePlate([9, 7, 7, 7, 7, 7]);

    expect(plate.baseHexagram.name).toBe('乾为天');
    expect(plate.changedHexagram.name).toBe('天风姤');
    expect(plate.lines).toHaveLength(6);
    expect(plate.lines.every((line) => line.base && line.changed)).toBe(true);
    expect(plate.lines[0]).toMatchObject({
      id: 'line:1',
      moving: true,
      base: { ganZhi: '甲子', relationToBasePalace: '子孙' },
      changed: { ganZhi: '辛丑', relationToBasePalace: '父母' },
      transition: { fromLineId: 'line:1:base', toLineId: 'line:1:changed' },
    });
    expect(plate.lines[1]).toMatchObject({
      moving: false,
      base: { ganZhi: '甲寅' },
      changed: { ganZhi: '辛亥' },
      transition: null,
    });
    expect(plate.lines[2]).toMatchObject({
      moving: false,
      base: { ganZhi: '甲辰' },
      changed: { ganZhi: '辛酉' },
      transition: null,
    });
    expect(plate.lines.every(({ hiddenSpiritCandidates }) => hiddenSpiritCandidates.length === 0)).toBe(true);
  });

  it('uses each side own shi/ying positions instead of copying base roles', () => {
    const plate = buildFixturePlate([9, 7, 7, 7, 7, 7]);

    expect(plate.baseHexagram).toMatchObject({ shiLine: 6, yingLine: 3 });
    expect(plate.changedHexagram).toMatchObject({ shiLine: 1, yingLine: 4 });
    expect(plate.lines.map(({ base }) => base.role)).toEqual([null, null, '应', null, null, '世']);
    expect(plate.lines.map(({ changed }) => changed.role)).toEqual(['世', null, null, '应', null, null]);
  });

  it('contains rulePackRef and no facts or context-hash placeholders', () => {
    const plate = buildFixturePlate([9, 7, 7, 7, 7, 7]);
    const serialized = JSON.stringify(plate);

    expect(plate.rulePackRef).toEqual({
      id: 'wenwang_najia_v2',
      version: '2.0.0',
      artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    });
    for (const forbidden of [
      'growthByPillar', 'beast', 'growthIntoChanged', 'harmonyForm',
      'ruleContextHash', 'hiddenSpirits',
    ]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`);
    }
    expect(serialized).toContain('hiddenSpiritCandidates');
  });

  it('maps all 64 explicit upper/lower combinations, palaces and shi/ying positions', () => {
    for (const golden of GOLDEN_HEXAGRAMS) {
      const side = buildFixturePlate(staticTossesForHexagram(golden)).baseHexagram;
      expect(side).toMatchObject(golden);
    }
  });

  it('matches the explicit 64 by 6 Najia golden matrix', () => {
    expect(GOLDEN_NAJIA).toHaveLength(64);
    expect(new Set(GOLDEN_NAJIA.map(({ key }) => key)).size).toBe(64);

    for (const golden of GOLDEN_HEXAGRAMS) {
      const expected = GOLDEN_NAJIA.find(({ key }) => key === golden.key);
      expect(expected, `纳甲黄金表缺少 ${golden.key}`).toBeDefined();
      const plate = buildFixturePlate(staticTossesForHexagram(golden));
      expect(plate.lines.map(({ base }) => base.ganZhi)).toEqual(expected?.lines);
    }
  });

  it.each(GOLDEN_CHANGED_RELATION_CASES)('$label separates the two changed relations', (golden) => {
    const line = buildFixturePlate(golden.tossValues).lines[golden.line - 1];
    expect(line.moving).toBe(true);
    expect(line.changed).toMatchObject({
      ganZhi: golden.changedGanZhi,
      relationToBasePalace: golden.relationToBasePalace,
      relationToOwnPalace: golden.relationToOwnPalace,
    });
  });

  it('keeps every 乾六爻动→坤 changed relation pair distinct by reference palace', () => {
    const plate = buildFixturePlate([9, 9, 9, 9, 9, 9]);
    expect(plate.changedHexagram.name).toBe('坤为地');
    expect(plate.lines.map(({ changed }) => [
      changed.ganZhi,
      changed.relationToBasePalace,
      changed.relationToOwnPalace,
    ])).toEqual([
      ['乙未', '父母', '兄弟'],
      ['乙巳', '官鬼', '父母'],
      ['乙卯', '妻财', '官鬼'],
      ['癸丑', '父母', '兄弟'],
      ['癸亥', '子孙', '妻财'],
      ['癸酉', '兄弟', '子孙'],
    ]);
  });

  it('covers every toss state uniquely and flips only moving lines', () => {
    const values = [6, 7, 8, 9] as const;
    const baseChangedPairs = new Set<string>();

    for (let encoded = 0; encoded < 4096; encoded += 1) {
      let rest = encoded;
      const tossValues = Array.from({ length: 6 }, () => {
        const value = values[rest % 4];
        rest = Math.floor(rest / 4);
        return value;
      }) as unknown as TossTuple;
      const first = buildFixturePlate(tossValues);
      const second = buildFixturePlate(tossValues);

      expect(first).toEqual(second);
      expect(() => assertPlateV2RuntimeShape(first)).not.toThrow();
      expect(first.lines).toHaveLength(6);
      baseChangedPairs.add(`${first.baseHexagram.key}>${first.changedHexagram.key}`);
      const changedNajia = GOLDEN_NAJIA_BY_KEY.get(first.changedHexagram.key);
      const changedHexagram = GOLDEN_HEXAGRAM_BY_KEY.get(first.changedHexagram.key);
      expect(changedNajia, `纳甲黄金表缺少变卦 ${first.changedHexagram.key}`).toBeDefined();
      expect(changedHexagram, `卦象黄金表缺少变卦 ${first.changedHexagram.key}`).toBeDefined();
      expect(first.lines.map(({ changed }) => changed.ganZhi)).toEqual(changedNajia?.lines);
      expect(first.lines.map(({ position, changed }) => changed.role)).toEqual(
        [1, 2, 3, 4, 5, 6].map((position) => (
          position === changedHexagram?.shiLine ? '世'
            : position === changedHexagram?.yingLine ? '应'
              : null
        )),
      );
      first.lines.forEach((line) => {
        expect(line.base.yang !== line.changed.yang).toBe(line.moving);
        expect(line.transition === null).toBe(!line.moving);
      });
    }

    expect(baseChangedPairs.size).toBe(4096);
  }, 30_000);

  it.each([
    {
      palace: '乾', name: '天风姤', candidates: [
        { hostLine: 2, hostGanZhi: '辛亥', sourceLine: 2, relation: '妻财', sourceGanZhi: '甲寅', sourceHexagram: '乾为天' },
      ],
    },
    {
      palace: '坎', name: '水雷屯', candidates: [
        { hostLine: 3, hostGanZhi: '庚辰', sourceLine: 3, relation: '妻财', sourceGanZhi: '戊午', sourceHexagram: '坎为水' },
      ],
    },
    {
      palace: '艮', name: '风泽中孚', candidates: [
        { hostLine: 3, hostGanZhi: '丁丑', sourceLine: 3, relation: '子孙', sourceGanZhi: '丙申', sourceHexagram: '艮为山' },
        { hostLine: 5, hostGanZhi: '辛巳', sourceLine: 5, relation: '妻财', sourceGanZhi: '丙子', sourceHexagram: '艮为山' },
      ],
    },
    {
      palace: '震', name: '雷风恒', candidates: [
        { hostLine: 2, hostGanZhi: '辛亥', sourceLine: 2, relation: '兄弟', sourceGanZhi: '庚寅', sourceHexagram: '震为雷' },
      ],
    },
    {
      palace: '巽', name: '风天小畜', candidates: [
        { hostLine: 3, hostGanZhi: '甲辰', sourceLine: 3, relation: '官鬼', sourceGanZhi: '辛酉', sourceHexagram: '巽为风' },
      ],
    },
    {
      palace: '离', name: '火山旅', candidates: [
        { hostLine: 1, hostGanZhi: '丙辰', sourceLine: 1, relation: '父母', sourceGanZhi: '己卯', sourceHexagram: '离为火' },
        { hostLine: 3, hostGanZhi: '丙申', sourceLine: 3, relation: '官鬼', sourceGanZhi: '己亥', sourceHexagram: '离为火' },
      ],
    },
    {
      palace: '坤', name: '地雷复', candidates: [
        { hostLine: 2, hostGanZhi: '庚寅', sourceLine: 2, relation: '父母', sourceGanZhi: '乙巳', sourceHexagram: '坤为地' },
      ],
    },
    {
      palace: '兑', name: '地山谦', candidates: [
        { hostLine: 2, hostGanZhi: '丙午', sourceLine: 2, relation: '妻财', sourceGanZhi: '丁卯', sourceHexagram: '兑为泽' },
      ],
    },
  ])('places $palace palace potential hidden spirits on same-position hosts', ({ name, candidates }) => {
    const plate = buildStaticHexagram(name);
    const actual = plate.lines.flatMap((line) => line.hiddenSpiritCandidates.map((candidate) => ({
      hostLine: line.position,
      hostGanZhi: line.base.ganZhi,
      sourceLine: candidate.sourceLine,
      relation: candidate.relation,
      sourceGanZhi: candidate.ganZhi,
      sourceHexagram: candidate.sourceHexagram,
      status: candidate.status,
    })));

    expect(actual).toEqual(candidates.map((candidate) => ({ ...candidate, status: 'potential' })));
  });

  it('produces the reviewed 56-candidate relation and palace distributions', () => {
    const byRelation = Object.fromEntries(
      (['父母', '兄弟', '妻财', '子孙', '官鬼'] as const).map((relation) => [relation, 0]),
    ) as Record<SixRelation, number>;
    const byPalace = Object.fromEntries(
      (['乾', '坎', '艮', '震', '巽', '离', '坤', '兑'] as const).map((palace) => [palace, 0]),
    ) as Record<string, number>;

    for (const golden of GOLDEN_HEXAGRAMS) {
      const candidates = buildFixturePlate(staticTossesForHexagram(golden)).lines
        .flatMap(({ hiddenSpiritCandidates }) => hiddenSpiritCandidates);
      byPalace[golden.palace] += candidates.length;
      candidates.forEach(({ relation }) => { byRelation[relation] += 1; });
    }

    expect(byRelation).toEqual({ 父母: 10, 兄弟: 6, 妻财: 16, 子孙: 16, 官鬼: 8 });
    expect(byPalace).toEqual({ 乾: 8, 坎: 4, 艮: 10, 震: 10, 巽: 6, 离: 8, 坤: 4, 兑: 6 });
    expect(Object.values(byRelation).reduce((sum, count) => sum + count, 0)).toBe(56);
  });

  it.each([
    [[], '六爻必须正好包含六个投币值'],
    [[7, 7, 7, 7, 7, 5], '投币值只能是 6、7、8、9'],
  ])('rejects malformed toss input %#', (tossValues, message) => {
    expect(() => buildPlateV2({
      ...FIXED_BUILD_INPUT,
      tossValues: tossValues as unknown as TossTuple,
    })).toThrow(message);
  });
});
