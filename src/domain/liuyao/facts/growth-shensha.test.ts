import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as domain from '../index.js';
import type {
  Branch,
  Element,
  PlateV2,
  SixSpirit,
  Stem,
  TwelveStage,
} from '../model.js';
import { buildPlateV2 } from '../plate.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import type {
  GrowthShenShaRuleBundleManifest,
  RuleContext,
  RuleReviewRecord,
} from '../rules/model.js';
import { RULE_SOURCE_EVIDENCE_CAPSULES } from '../rules/wenwang-najia-v2.js';
import {
  GROWTH_SHENSHA_CORE_V1_ARTIFACT,
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD,
  GROWTH_SHENSHA_CORE_V1_MANIFEST,
  GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES,
} from './growth-shensha-core-v1.js';
import {
  deriveGrowthShenShaFacts,
  shenShaBranches,
  sixSpiritsForDayStem,
  twelveStage,
} from './growth-shensha.js';
import {
  GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
  GROWTH_SHENSHA_REVIEW_REPORT_PATHS,
  assertProjectEnabledGrowthShenShaBundle,
  assertProjectEnabledGrowthShenShaContext,
} from './growth-shensha-registry.js';

const ELEMENTS = ['木', '火', '土', '金', '水'] as const satisfies readonly Element[];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const satisfies readonly Branch[];
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const satisfies readonly Stem[];

const GROWTH_ORACLE = {
  木: ['沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生'],
  火: ['胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝'],
  土: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
  金: ['死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病'],
  水: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
} as const satisfies Readonly<Record<Element, readonly TwelveStage[]>>;

const SIX_SPIRIT_ORACLE = {
  甲: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
  乙: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
  丙: ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'],
  丁: ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'],
  戊: ['勾陈', '螣蛇', '白虎', '玄武', '青龙', '朱雀'],
  己: ['螣蛇', '白虎', '玄武', '青龙', '朱雀', '勾陈'],
  庚: ['白虎', '玄武', '青龙', '朱雀', '勾陈', '螣蛇'],
  辛: ['白虎', '玄武', '青龙', '朱雀', '勾陈', '螣蛇'],
  壬: ['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'],
  癸: ['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'],
} as const satisfies Readonly<Record<Stem, readonly SixSpirit[]>>;

const TIANYI_ORACLE = {
  甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  戊: ['丑', '未'], 己: ['子', '申'], 庚: ['午', '寅'], 辛: ['午', '寅'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
} as const satisfies Readonly<Record<Stem, readonly Branch[]>>;

const LUSHEN_ORACLE = {
  甲: ['寅'], 乙: ['卯'], 丙: ['巳'], 丁: ['午'], 戊: ['巳'],
  己: ['午'], 庚: ['申'], 辛: ['酉'], 壬: ['亥'], 癸: ['子'],
} as const satisfies Readonly<Record<Stem, readonly Branch[]>>;

const YIMA_ORACLE = {
  子: ['寅'], 丑: ['亥'], 寅: ['申'], 卯: ['巳'], 辰: ['寅'], 巳: ['亥'],
  午: ['申'], 未: ['巳'], 申: ['寅'], 酉: ['亥'], 戌: ['申'], 亥: ['巳'],
} as const satisfies Readonly<Record<Branch, readonly Branch[]>>;

const TIANXI_ORACLE = {
  子: ['未'], 丑: ['未'], 寅: ['戌'], 卯: ['戌'], 辰: ['戌'], 巳: ['丑'],
  午: ['丑'], 未: ['丑'], 申: ['辰'], 酉: ['辰'], 戌: ['辰'], 亥: ['未'],
} as const satisfies Readonly<Record<Branch, readonly Branch[]>>;

const TIANYI_COMMON_VARIANT_ORACLE = {
  甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  戊: ['丑', '未'], 己: ['子', '申'], 庚: ['丑', '未'], 辛: ['午', '寅'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
} as const satisfies Readonly<Record<Stem, readonly Branch[]>>;

const TIANXI_MONTHLY_VARIANT_ORACLE = {
  子: ['申'], 丑: ['酉'], 寅: ['戌'], 卯: ['亥'], 辰: ['子'], 巳: ['丑'],
  午: ['寅'], 未: ['卯'], 申: ['辰'], 酉: ['巳'], 戌: ['午'], 亥: ['未'],
} as const satisfies Readonly<Record<Branch, readonly Branch[]>>;

const TIANXI_YEAR_VARIANT_ORACLE = {
  子: ['酉'], 丑: ['申'], 寅: ['未'], 卯: ['午'], 辰: ['巳'], 巳: ['辰'],
  午: ['卯'], 未: ['寅'], 申: ['丑'], 酉: ['子'], 戌: ['亥'], 亥: ['戌'],
} as const satisfies Readonly<Record<Branch, readonly Branch[]>>;

const FIXED_PLATE = buildPlateV2({
  plateId: 'plate-growth-shensha-fixed',
  sessionId: 'session-growth-shensha-fixed',
  castAt: '2026-07-11T04:00:00.000Z',
  tossValues: [9, 8, 7, 6, 7, 8],
  ruleContext: DEFAULT_RULE_CONTEXT,
});

const REVIEW_SOURCE_REFS = GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id);

function productionBundleFacts(
  plate: PlateV2,
  ruleContext: RuleContext = DEFAULT_RULE_CONTEXT,
) {
  return deriveGrowthShenShaFacts({ plate, ruleContext });
}

function productionGrowthFacts(plate: PlateV2) {
  return productionBundleFacts(plate).filter(({ relation }) => relation === 'is-growth-stage');
}

function productionSixSpiritFacts(plate: PlateV2) {
  return productionBundleFacts(plate).filter(({ relation }) => relation === 'is-six-beast');
}

function productionShenShaFacts(plate: PlateV2) {
  return productionBundleFacts(plate).filter(({ relation }) => relation === 'is-shen-sha');
}

function matchedGrowthReview(
  reviewerId: string,
  independentRunId: string,
  reportPath: string,
  overrides: Partial<RuleReviewRecord> = {},
): RuleReviewRecord {
  return {
    reviewerId,
    reviewerKind: 'automated-agent',
    independentRunId,
    reviewedAt: '2026-07-12T10:00:00+08:00',
    artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs: REVIEW_SOURCE_REFS,
    reportPath,
    checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
    ...overrides,
  };
}

function enabledGrowthManifest(
  overrides: Partial<GrowthShenShaRuleBundleManifest> = {},
): GrowthShenShaRuleBundleManifest {
  return {
    bundleId: 'growth_shensha_core_v1',
    version: '1.0.0',
    artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    verificationLevel: 'independent-automated',
    runtimeStatus: 'project-enabled',
    reviews: [
      matchedGrowthReview('reviewer-a', 'growth-run-a', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0]),
      matchedGrowthReview('reviewer-b', 'growth-run-b', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1]),
    ],
    sourceRefs: REVIEW_SOURCE_REFS,
    ...overrides,
  };
}

const BRANCH_ELEMENT: Readonly<Record<Branch, Element>> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

function withFacetBranch(
  facet: PlateV2['lines'][number]['base'],
  branch: Branch,
): PlateV2['lines'][number]['base'] {
  return {
    ...facet,
    branch,
    branchElement: BRANCH_ELEMENT[branch],
    ganZhi: `${facet.stem}${branch}`,
  };
}

function shenShaFixture(): PlateV2 {
  const plate = structuredClone(FIXED_PLATE);
  const baseBranches = ['丑', '未', '寅', '戌', '子', '辰'] as const;
  plate.calendar.pillars.day = {
    ...plate.calendar.pillars.day,
    ganZhi: '甲子',
    stem: { value: '甲', element: '木' },
    branch: { value: '子', element: '水' },
  };
  plate.calendar.pillars.month = {
    ...plate.calendar.pillars.month,
    ganZhi: `${plate.calendar.pillars.month.stem.value}辰`,
    branch: { value: '辰', element: '土' },
  };
  plate.lines = plate.lines.map((line, index) => ({
    ...line,
    base: withFacetBranch(line.base, baseBranches[index]),
  })) as unknown as PlateV2['lines'];
  return plate;
}

describe('growth_shensha_core_v1 十二长生独立 oracle', () => {
  it('逐格匹配硬编码 5×12 矩阵且每行恰好覆盖十二阶段', () => {
    for (const element of ELEMENTS) {
      const actual = BRANCHES.map((branch) => (
        twelveStage(element, branch, DEFAULT_RULE_CONTEXT.growthProfile)
      ));
      expect(actual, element).toEqual(GROWTH_ORACLE[element]);
      expect(new Set(actual), `${element} 阶段去重`).toHaveLength(12);
    }
  });

  it('土从水逐格一致，并把所有土长生事实标为 disputed', () => {
    for (const branch of BRANCHES) {
      expect(twelveStage('土', branch, DEFAULT_RULE_CONTEXT.growthProfile))
        .toBe(twelveStage('水', branch, DEFAULT_RULE_CONTEXT.growthProfile));
    }
    const earthPlate = structuredClone(FIXED_PLATE);
    earthPlate.lines = earthPlate.lines.map((line) => ({
      ...line,
      base: withFacetBranch(line.base, '辰'),
      changed: withFacetBranch(line.changed, '辰'),
    })) as unknown as PlateV2['lines'];
    const facts = productionGrowthFacts(earthPlate);
    expect(facts).toHaveLength(48 + earthPlate.movingLines.length);
    expect(facts.every(({ certainty }) => certainty === 'disputed')).toBe(true);
  });

  it('固定输出 48 条本变四柱事实及每个动爻一条 transition', () => {
    const facts = productionGrowthFacts(FIXED_PLATE);
    const fixed = facts.filter(({ scope }) => scope === 'calendar');
    const transitions = facts.filter(({ scope }) => scope === 'transition');

    expect(fixed).toHaveLength(48);
    expect(transitions).toHaveLength(FIXED_PLATE.movingLines.length);
    expect(fixed.filter(({ target }) => target?.type === 'line' && target.side === 'base'))
      .toHaveLength(24);
    expect(fixed.filter(({ target }) => target?.type === 'line' && target.side === 'changed'))
      .toHaveLength(24);
    expect(facts.every(({ authority }) => authority === 'profile-dependent')).toBe(true);
    expect(facts.every(({ values }) => (
      values.interpretationWeight === 'primary'
      || values.interpretationWeight === 'display-only'
    ))).toBe(true);
  });

  it('墓与绝分别恰好覆盖五个五行落点，供 Task 5 复用唯一函数', () => {
    const tombs = ELEMENTS.map((element) => (
      BRANCHES.filter((branch) => twelveStage(element, branch) === '墓')
    ));
    const absolutes = ELEMENTS.map((element) => (
      BRANCHES.filter((branch) => twelveStage(element, branch) === '绝')
    ));

    expect(tombs).toHaveLength(5);
    expect(tombs.every((branches) => branches.length === 1)).toBe(true);
    expect(absolutes).toHaveLength(5);
    expect(absolutes.every((branches) => branches.length === 1)).toBe(true);
  });

  it.each([
    [null, '子'],
    ['风', '子'],
    ['木', null],
    ['木', '甲'],
  ])('非法公开输入统一抛十二长生领域错误：%#/%#', (element, branch) => {
    expect(() => twelveStage(element as never, branch as never)).toThrow('十二长生输入无效');
  });

  it('非法十二长生 profile 不泄漏 TypeError', () => {
    expect(() => twelveStage('木', '亥', null as never)).toThrow('十二长生 profile 不匹配');
  });
});

describe('growth_shensha_core_v1 六神独立 oracle', () => {
  it('逐格匹配硬编码 10 日干×6 爻矩阵', () => {
    for (const stem of STEMS) {
      expect(sixSpiritsForDayStem(stem, DEFAULT_RULE_CONTEXT.sixSpiritProfile), stem)
        .toEqual(SIX_SPIRIT_ORACLE[stem]);
    }
  });

  it('返回冻结的初爻到上爻数组，调用方不能污染后续计算', () => {
    const spirits = sixSpiritsForDayStem('甲');
    expect(Object.isFrozen(spirits)).toBe(true);
    expect(() => (spirits as SixSpirit[]).push('青龙')).toThrow();
    expect(sixSpiritsForDayStem('甲')).toEqual(SIX_SPIRIT_ORACLE.甲);
  });

  it('只给本卦六爻各输出一条辅助六神事实', () => {
    const facts = productionSixSpiritFacts(FIXED_PLATE);
    expect(facts).toHaveLength(6);
    expect(facts.every(({ relation }) => relation === 'is-six-beast')).toBe(true);
    expect(facts.every(({ source }) => source.type === 'pillar' && source.id === 'day')).toBe(true);
    expect(facts.every(({ target }) => target?.type === 'line' && target.side === 'base')).toBe(true);
    expect(facts.every(({ scope, authority, certainty }) => (
      scope === 'auxiliary' && authority === 'secondary' && certainty === 'computed'
    ))).toBe(true);
  });

  it.each([null, '子', 'dragon'])('非法日干统一抛六神领域错误：%#', (stem) => {
    expect(() => sixSpiritsForDayStem(stem as never)).toThrow('六神输入无效');
  });

  it('非法六神 profile 不泄漏 TypeError', () => {
    expect(() => sixSpiritsForDayStem('甲', {} as never)).toThrow('六神 profile 不匹配');
  });
});

describe('growth_shensha_core_v1 四项神煞独立 oracle', () => {
  it('逐格匹配天乙 10 干各 2 支，并固定庚辛为午寅', () => {
    for (const stem of STEMS) {
      expect(shenShaBranches({ id: 'tianyi', dayStem: stem }, DEFAULT_RULE_CONTEXT.shenShaProfile), stem)
        .toEqual(TIANYI_ORACLE[stem]);
    }
    expect(shenShaBranches({ id: 'tianyi', dayStem: '庚' })).toEqual(['午', '寅']);
  });

  it('逐格匹配禄神 10 干各 1 支', () => {
    for (const stem of STEMS) {
      expect(shenShaBranches({ id: 'lushen', dayStem: stem }), stem)
        .toEqual(LUSHEN_ORACLE[stem]);
    }
  });

  it('逐格匹配驿马 12 日支', () => {
    for (const branch of BRANCHES) {
      expect(shenShaBranches({ id: 'yima', dayBranch: branch }), branch)
        .toEqual(YIMA_ORACLE[branch]);
    }
  });

  it('逐格匹配天喜 12 节令月支，并保持辰月戌、巳月丑', () => {
    for (const branch of BRANCHES) {
      expect(shenShaBranches({ id: 'tianxi', monthBranch: branch }), branch)
        .toEqual(TIANXI_ORACLE[branch]);
    }
    expect(shenShaBranches({ id: 'tianxi', monthBranch: '辰' })).toEqual(['戌']);
    expect(shenShaBranches({ id: 'tianxi', monthBranch: '巳' })).toEqual(['丑']);
  });

  it('只运行配置的四项、只命中本卦明爻且固定 secondary/conditional', () => {
    const plate = shenShaFixture();
    const facts = productionShenShaFacts(plate);

    expect(new Set(facts.map(({ values }) => values.shenShaId)))
      .toEqual(new Set(['tianyi', 'lushen', 'yima', 'tianxi']));
    expect(facts.every(({ relation }) => relation === 'is-shen-sha')).toBe(true);
    expect(facts.every(({ target }) => target?.type === 'line' && target.side === 'base')).toBe(true);
    expect(facts.every(({ scope, authority, certainty }) => (
      scope === 'auxiliary' && authority === 'secondary' && certainty === 'conditional'
    ))).toBe(true);
    expect(facts.some(({ target }) => target?.type === 'hidden-spirit')).toBe(false);
    expect(facts.some(({ relation }) => relation === 'is-month-break')).toBe(false);
  });

  it('四项神煞统一绑定 label、sourceKind 与 rule 元数据', () => {
    const facts = productionShenShaFacts(shenShaFixture());
    const descriptorOracle = {
      tianyi: {
        label: '天乙贵人',
        sourceKind: 'day',
        ruleId: 'tianyi-by-day-stem-zengshan/v1',
        profileId: 'zengshan-taiyi-day-stem-v1',
      },
      lushen: {
        label: '禄神',
        sourceKind: 'day',
        ruleId: 'lushen-by-day-stem-zengshan/v1',
        profileId: 'zengshan-day-stem-lushen-v1',
      },
      yima: {
        label: '驿马',
        sourceKind: 'day',
        ruleId: 'yima-by-day-branch-three-harmony/v1',
        profileId: 'zengshan-day-branch-three-harmony-v1',
      },
      tianxi: {
        label: '天喜',
        sourceKind: 'month',
        ruleId: 'tianxi-by-seasonal-month-branch/v1',
        profileId: 'zengshan-seasonal-month-branch-v1',
      },
    } as const;

    for (const [id, expected] of Object.entries(descriptorOracle)) {
      const matching = facts.filter(({ values }) => values.shenShaId === id);
      expect(matching.length, id).toBeGreaterThan(0);
      expect(matching.every(({ source, ruleId, profileId, values }) => (
        source.type === 'pillar'
        && source.id === expected.sourceKind
        && ruleId === expected.ruleId
        && profileId === expected.profileId
        && values.label === expected.label
        && values.sourceKind === expected.sourceKind
      )), id).toBe(true);
    }
  });

  it.each([
    null,
    {},
    { id: 'unknown' },
    { id: 'tianyi' },
    { id: 'tianyi', dayStem: '子' },
    { id: 'yima', dayBranch: '甲' },
    { id: 'tianxi', monthBranch: null },
  ])('非法神煞公开输入统一抛领域错误：%#', (input) => {
    expect(() => shenShaBranches(input as never)).toThrow('神煞输入无效');
  });

  it.each([
    { id: 'tianyi', dayStem: '甲', dayBranch: '子' },
    { id: 'lushen', dayStem: '甲', monthBranch: '寅' },
    { id: 'yima', dayBranch: '子', dayStem: '甲' },
    { id: 'tianxi', monthBranch: '寅', dayBranch: '子' },
  ])('拒绝混入非本项 descriptor 输入键：%#', (input) => {
    expect(() => shenShaBranches(input as never)).toThrow('神煞输入无效');
  });

  it.each([
    { id: 'tianyi', dayStem: '甲', foo: true },
    { id: 'lushen', dayStem: '甲', note: '额外' },
    { id: 'yima', dayBranch: '子', value: 1 },
    { id: 'tianxi', monthBranch: '寅', extra: null },
  ])('每项输入只允许 id 与 descriptor 必需键：%#', (input) => {
    expect(() => shenShaBranches(input as never)).toThrow('神煞输入无效');
  });

  it('非法神煞 profile 不泄漏 TypeError', () => {
    expect(() => shenShaBranches({ id: 'tianyi', dayStem: '甲' }, null as never))
      .toThrow('神煞 profile 不匹配');
  });
});

describe('growth_shensha_core_v1 artifact、纯度与生产门禁', () => {
  it('冻结 canonical artifact，并可独立复算 artifactHash', () => {
    expect(createHash('sha256').update(GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD, 'utf8').digest('hex'))
      .toBe(GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH);
    expect(GROWTH_SHENSHA_CORE_V1_ARTIFACT.bundleId).toBe('growth_shensha_core_v1');
    expect(GROWTH_SHENSHA_CORE_V1_ARTIFACT.growth.matrix).toEqual(GROWTH_ORACLE);
    expect(Object.isFrozen(GROWTH_SHENSHA_CORE_V1_ARTIFACT)).toBe(true);
    expect(Object.isFrozen(GROWTH_SHENSHA_CORE_V1_ARTIFACT.growth.matrix.木)).toBe(true);
  });

  it('将三个固定 oldid 与本地 corpus 条目文本哈希和全书 SHA-256 一并绑定', () => {
    expect(GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.slice(0, 3).map(({ ref }) => ref.url)).toEqual([
      expect.stringContaining('oldid=2100461'),
      expect.stringContaining('oldid=2101727'),
      expect.stringContaining('oldid=2572918'),
    ]);
    expect(GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES).toHaveLength(5);
    for (const { ref, payload } of GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES) {
      expect(createHash('sha256').update(payload, 'utf8').digest('hex')).toBe(ref.contentHash);
    }

    const corpus = JSON.parse(readFileSync('resources/corpus.json', 'utf8')) as Array<{
      id: string;
      text: string;
    }>;
    const manifest = JSON.parse(readFileSync('resources/corpus-manifest.json', 'utf8')) as {
      corpusVersion: string;
      sources: Array<{ id: string; sha256: string }>;
    };
    const local = GROWTH_SHENSHA_CORE_V1_ARTIFACT.localCorpus;
    expect(local.corpusVersion).toBe(manifest.corpusVersion);
    expect(local.books.map(({ sourceId }) => sourceId)).toEqual([
      'ZENGSHAN-BUYI', 'YIMAO', 'YIYIN',
    ]);
    for (const book of local.books) {
      expect(book.bookSha256)
        .toBe(manifest.sources.find(({ id }) => id === book.sourceId)?.sha256);
      for (const entry of book.entries) {
        const corpusEntry = corpus.find(({ id }) => id === entry.id);
        expect(corpusEntry, entry.id).toBeDefined();
        expect(createHash('sha256').update(corpusEntry!.text, 'utf8').digest('hex'))
          .toBe(entry.textSha256);
      }
    }
  });

  it('硬编码核对六神异体和所有禁用 variant，并要求逐项来源可追溯', () => {
    const artifact = GROWTH_SHENSHA_CORE_V1_ARTIFACT;
    expect(artifact.sixSpirit.aliases).toMatchObject({
      青龙: '青龙', 靑龍: '青龙', 螣蛇: '螣蛇', 滕蛇: '螣蛇', 腾蛇: '螣蛇', 玄武: '玄武', 元武: '玄武',
    });
    expect(artifact.sixSpirit.aliasSourceRefs.length).toBeGreaterThan(0);
    expect(artifact.growth.variants.earthStartsAtShen.sourceRefs.length).toBeGreaterThan(0);
    expect(artifact.growth.variants.earthStartsAtYin.sourceRefs.length).toBeGreaterThan(0);
    expect(artifact.growth.variants.tenStemDirectionalModel.sourceRefs.length).toBeGreaterThan(0);

    const tianyiVariant = artifact.shenSha.tianyi.variants[0];
    expect(tianyiVariant).toMatchObject({
      id: 'common-jia-wu-geng-cattle-sheep-v1',
      enabled: false,
      branchesByDayStem: TIANYI_COMMON_VARIANT_ORACLE,
    });
    expect(tianyiVariant.sourceRefs.length).toBeGreaterThan(0);

    const [monthly, yearly] = artifact.shenSha.tianxi.variants;
    expect(monthly).toMatchObject({
      id: 'monthly-progression-tianxi-v1',
      enabled: false,
      branchesByMonthBranch: TIANXI_MONTHLY_VARIANT_ORACLE,
    });
    expect(yearly).toMatchObject({
      id: 'xingming-year-branch-tianxi-v1',
      enabled: false,
      branchesByYearBranch: TIANXI_YEAR_VARIANT_ORACLE,
    });
    expect(monthly.sourceRefs.length).toBeGreaterThan(0);
    expect(yearly.sourceRefs.length).toBeGreaterThan(0);

    const sourceIds = new Set(GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id));
    const variantRefs = [
      ...artifact.sixSpirit.aliasSourceRefs,
      ...artifact.growth.variants.earthStartsAtShen.sourceRefs,
      ...artifact.growth.variants.earthStartsAtYin.sourceRefs,
      ...artifact.growth.variants.tenStemDirectionalModel.sourceRefs,
      ...tianyiVariant.sourceRefs,
      ...monthly.sourceRefs,
      ...yearly.sourceRefs,
    ];
    expect(variantRefs.every((sourceRef) => sourceIds.has(sourceRef))).toBe(true);
  });

  it('三个 profile 必须指向同一个 bundle hash', () => {
    const expected = {
      id: 'growth_shensha_core_v1',
      version: '1.0.0',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    };
    expect(DEFAULT_RULE_CONTEXT.growthProfile.bundle).toEqual(expected);
    expect(DEFAULT_RULE_CONTEXT.sixSpiritProfile.bundle).toEqual(expected);
    expect(DEFAULT_RULE_CONTEXT.shenShaProfile.bundle).toEqual(expected);
  });

  it('绑定两份独立自动审阅并打开 bundle/context/生产事实门', () => {
    expect(GROWTH_SHENSHA_CORE_V1_MANIFEST).toEqual({
      bundleId: 'growth_shensha_core_v1',
      version: '1.0.0',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
      verificationLevel: 'independent-automated',
      runtimeStatus: 'project-enabled',
      reviews: [
        {
          reviewerId: 'codex-wikisource-growth-shensha-a',
          reviewerKind: 'automated-agent',
          independentRunId: 'growth-shensha-a-20260712-104749-9091214',
          reviewedAt: '2026-07-12T10:47:49.9091214+08:00',
          artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
          outcome: 'matched',
          inputSourceRefs: REVIEW_SOURCE_REFS,
          reportPath: GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0],
          checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
        },
        {
          reviewerId: 'codex-corpus-growth-shensha-b',
          reviewerKind: 'automated-agent',
          independentRunId: 'growth-shensha-core-v1-b-2c89ce7f-8a84-4960-a5e0-71353952a59a',
          reviewedAt: '2026-07-12T10:50:40.9970624+08:00',
          artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
          outcome: 'matched',
          inputSourceRefs: REVIEW_SOURCE_REFS,
          reportPath: GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1],
          checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
        },
      ],
      sourceRefs: REVIEW_SOURCE_REFS,
    });
    expect(GROWTH_SHENSHA_CORE_V1_MANIFEST.verificationLevel).not.toBe('human-reviewed');
    expect(Object.isFrozen(GROWTH_SHENSHA_CORE_V1_MANIFEST)).toBe(true);
    expect(GROWTH_SHENSHA_CORE_V1_MANIFEST.reviews.every(Object.isFrozen)).toBe(true);
    expect(() => assertProjectEnabledGrowthShenShaBundle()).not.toThrow();
    expect(() => assertProjectEnabledGrowthShenShaContext(DEFAULT_RULE_CONTEXT)).not.toThrow();
    expect(() => productionBundleFacts(FIXED_PLATE)).not.toThrow();
    expect(domain).not.toHaveProperty('deriveGrowthShenShaFactsForReviewFixture');
    expect(domain).not.toHaveProperty('deriveGrowthFactsForReviewFixture');
    expect(domain).not.toHaveProperty('assertGrowthShenShaReviewFixtureContext');
  });

  it('把 manifest 每项审阅字段、来源和 claims 绑定到固定报告', () => {
    for (const review of GROWTH_SHENSHA_CORE_V1_MANIFEST.reviews) {
      expect(existsSync(review.reportPath), review.reportPath).toBe(true);
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
    }
    const reports = GROWTH_SHENSHA_CORE_V1_MANIFEST.reviews
      .map(({ reportPath }) => readFileSync(reportPath, 'utf8'))
      .join('\n');
    for (const { ref } of GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES) {
      expect(reports).toContain(ref.id);
      expect(reports).toContain(ref.contentHash);
    }
  });

  it('生产计算经 deep clone 与爻数组换序后 ID 和顺序完全稳定且无重复', () => {
    const first = productionBundleFacts(
      structuredClone(FIXED_PLATE),
      structuredClone(DEFAULT_RULE_CONTEXT),
    );
    const reordered = structuredClone(FIXED_PLATE);
    reordered.lines = [...reordered.lines].reverse() as unknown as PlateV2['lines'];
    const second = productionBundleFacts(
      reordered,
      structuredClone(DEFAULT_RULE_CONTEXT),
    );

    expect(second).toEqual(first);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.every(Object.isFrozen)).toBe(true);
  });

  it('生产上下文门拒绝伪造任一 bundle profile 或其来源', () => {
    const growthSourceId = GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES[0].ref.id;
    const cases: RuleContext[] = [
      {
        ...DEFAULT_RULE_CONTEXT,
        growthProfile: {
          ...DEFAULT_RULE_CONTEXT.growthProfile,
          bundle: { ...DEFAULT_RULE_CONTEXT.growthProfile.bundle, artifactHash: 'f'.repeat(64) },
        },
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        sixSpiritProfile: {
          ...DEFAULT_RULE_CONTEXT.sixSpiritProfile,
          source: 'forged' as never,
        },
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        shenShaProfile: {
          ...DEFAULT_RULE_CONTEXT.shenShaProfile,
          enabled: ['tianyi'] as never,
        },
      },
      {
        ...DEFAULT_RULE_CONTEXT,
        sources: DEFAULT_RULE_CONTEXT.sources.filter(({ id }) => id !== growthSourceId),
      },
    ];
    for (const context of cases) {
      expect(() => productionBundleFacts(FIXED_PLATE, context))
        .toThrow('长生神煞规则上下文未通过项目运行门');
    }
  });

  it('只接受字段、来源、claims 与固定报告路径全部精确的启用 manifest', () => {
    expect(() => assertProjectEnabledGrowthShenShaBundle(enabledGrowthManifest())).not.toThrow();
  });

  it.each([
    ['single review', () => enabledGrowthManifest({ reviews: [
      matchedGrowthReview('a', 'a', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0]),
    ] })],
    ['duplicate reviewer', () => enabledGrowthManifest({ reviews: [
      matchedGrowthReview('same', 'a', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0]),
      matchedGrowthReview('same', 'b', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1]),
    ] })],
    ['duplicate run', () => enabledGrowthManifest({ reviews: [
      matchedGrowthReview('a', 'same', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0]),
      matchedGrowthReview('b', 'same', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1]),
    ] })],
    ['disputed outcome', () => enabledGrowthManifest({ reviews: [
      matchedGrowthReview('a', 'a', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0]),
      matchedGrowthReview('b', 'b', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1], { outcome: 'disputed' }),
    ] })],
    ['wrong hash', () => enabledGrowthManifest({ artifactHash: 'f'.repeat(64) })],
    ['fixture-only', () => enabledGrowthManifest({ runtimeStatus: 'fixture-only' })],
    ['unverified', () => enabledGrowthManifest({ verificationLevel: 'unverified' })],
    ['missing source', () => enabledGrowthManifest({ sourceRefs: REVIEW_SOURCE_REFS.slice(1) })],
    ['missing claim', () => enabledGrowthManifest({ reviews: [
      matchedGrowthReview('a', 'a', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0], {
        checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS.slice(1),
      }),
      matchedGrowthReview('b', 'b', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1]),
    ] })],
    ['wrong report', () => enabledGrowthManifest({ reviews: [
      matchedGrowthReview('a', 'a', 'docs/domain/reviews/forged.md'),
      matchedGrowthReview('b', 'b', GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1]),
    ] })],
  ])('拒绝伪装启用的 manifest：%s', (_label, makeManifest) => {
    expect(() => assertProjectEnabledGrowthShenShaBundle(makeManifest()))
      .toThrow('长生神煞规则包未通过项目运行门');
  });

  it('Plate gate 只消费结构与历法，忽略其他 bundle profile 并允许结构来源子集', () => {
    const unrelatedProfiles = {
      ...DEFAULT_RULE_CONTEXT,
      relationProfile: { ...DEFAULT_RULE_CONTEXT.relationProfile, id: 'forged-relation' },
      growthProfile: { ...DEFAULT_RULE_CONTEXT.growthProfile, id: 'forged-growth' },
      sixSpiritProfile: { ...DEFAULT_RULE_CONTEXT.sixSpiritProfile, id: 'forged-six-spirit' },
      shenShaProfile: { ...DEFAULT_RULE_CONTEXT.shenShaProfile, id: 'forged-shensha' },
      useGodProfile: { ...DEFAULT_RULE_CONTEXT.useGodProfile, id: 'forged-use-god' },
      sources: RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
    } as unknown as RuleContext;

    expect(() => buildPlateV2({
      plateId: 'plate-structure-only-gate',
      sessionId: 'session-structure-only-gate',
      castAt: '2026-07-11T04:00:00.000Z',
      tossValues: [7, 7, 7, 7, 7, 7],
      ruleContext: unrelatedProfiles,
    })).not.toThrow();
  });
});
