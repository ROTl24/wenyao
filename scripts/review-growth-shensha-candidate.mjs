import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_RULE_CONTEXT,
  GROWTH_SHENSHA_CORE_V1_ARTIFACT,
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD,
  GROWTH_SHENSHA_CORE_V1_MANIFEST,
  GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES,
  buildPlateV2,
  deriveGrowthShenShaFacts,
  shenShaBranches,
  sixSpiritsForDayStem,
  twelveStage,
} from '../electron/generated/domain/index.js';

const sha256 = (payload) => createHash('sha256').update(payload, 'utf8').digest('hex');
const elements = ['木', '火', '土', '金', '水'];
const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

const growthOracle = {
  木: ['沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生'],
  火: ['胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝'],
  土: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
  金: ['死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病'],
  水: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
};

const sixSpiritOracle = {
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
};

const tianyiOracle = {
  甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  戊: ['丑', '未'], 己: ['子', '申'], 庚: ['午', '寅'], 辛: ['午', '寅'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
};
const lushenOracle = {
  甲: ['寅'], 乙: ['卯'], 丙: ['巳'], 丁: ['午'], 戊: ['巳'],
  己: ['午'], 庚: ['申'], 辛: ['酉'], 壬: ['亥'], 癸: ['子'],
};
const yimaOracle = {
  子: ['寅'], 丑: ['亥'], 寅: ['申'], 卯: ['巳'], 辰: ['寅'], 巳: ['亥'],
  午: ['申'], 未: ['巳'], 申: ['寅'], 酉: ['亥'], 戌: ['申'], 亥: ['巳'],
};
const tianxiOracle = {
  子: ['未'], 丑: ['未'], 寅: ['戌'], 卯: ['戌'], 辰: ['戌'], 巳: ['丑'],
  午: ['丑'], 未: ['丑'], 申: ['辰'], 酉: ['辰'], 戌: ['辰'], 亥: ['未'],
};
const tianyiCommonVariantOracle = {
  甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  戊: ['丑', '未'], 己: ['子', '申'], 庚: ['丑', '未'], 辛: ['午', '寅'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
};
const tianxiMonthlyVariantOracle = {
  子: ['申'], 丑: ['酉'], 寅: ['戌'], 卯: ['亥'], 辰: ['子'], 巳: ['丑'],
  午: ['寅'], 未: ['卯'], 申: ['辰'], 酉: ['巳'], 戌: ['午'], 亥: ['未'],
};
const tianxiYearVariantOracle = {
  子: ['酉'], 丑: ['申'], 寅: ['未'], 卯: ['午'], 辰: ['巳'], 巳: ['辰'],
  午: ['卯'], 未: ['寅'], 申: ['丑'], 酉: ['子'], 戌: ['亥'], 亥: ['戌'],
};

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const computedGrowth = Object.fromEntries(elements.map((element) => [
  element,
  branches.map((branch) => twelveStage(element, branch)),
]));
const computedSixSpirits = Object.fromEntries(stems.map((stem) => [
  stem,
  sixSpiritsForDayStem(stem),
]));
const computedTianyi = Object.fromEntries(stems.map((dayStem) => [
  dayStem,
  shenShaBranches({ id: 'tianyi', dayStem }),
]));
const computedLushen = Object.fromEntries(stems.map((dayStem) => [
  dayStem,
  shenShaBranches({ id: 'lushen', dayStem }),
]));
const computedYima = Object.fromEntries(branches.map((dayBranch) => [
  dayBranch,
  shenShaBranches({ id: 'yima', dayBranch }),
]));
const computedTianxi = Object.fromEntries(branches.map((monthBranch) => [
  monthBranch,
  shenShaBranches({ id: 'tianxi', monthBranch }),
]));
const [tianyiCommonVariant] = GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.tianyi.variants;
const [tianxiMonthlyVariant, tianxiYearVariant] = (
  GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.tianxi.variants
);

const sourceEvidence = GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref, payload }) => ({
  sourceId: ref.id,
  url: ref.url,
  declaredHash: ref.contentHash,
  computedHash: sha256(payload),
  matched: ref.contentHash === sha256(payload),
}));

const corpus = JSON.parse(readFileSync(new URL('../resources/corpus.json', import.meta.url), 'utf8'));
const corpusManifest = JSON.parse(
  readFileSync(new URL('../resources/corpus-manifest.json', import.meta.url), 'utf8'),
);
const localCorpus = GROWTH_SHENSHA_CORE_V1_ARTIFACT.localCorpus;
const localBookEvidence = localCorpus.books.map((book) => ({
  sourceId: book.sourceId,
  declaredHash: book.bookSha256,
  manifestHash: corpusManifest.sources.find(({ id }) => id === book.sourceId)?.sha256 ?? null,
  matched: book.bookSha256
    === corpusManifest.sources.find(({ id }) => id === book.sourceId)?.sha256,
}));
const localEntryEvidence = localCorpus.books.flatMap((book) => book.entries.map((binding) => {
  const entry = corpus.find(({ id }) => id === binding.id);
  const computedHash = entry ? sha256(entry.text) : null;
  return {
    sourceId: book.sourceId,
    ...binding,
    computedHash,
    matched: computedHash === binding.textSha256,
  };
}));

const plate = buildPlateV2({
  plateId: 'production-review-growth-shensha',
  sessionId: 'production-review-growth-shensha',
  castAt: '2026-07-11T04:00:00.000Z',
  tossValues: [9, 8, 7, 6, 7, 8],
  ruleContext: DEFAULT_RULE_CONTEXT,
});
let productionFacts = [];
let productionGateOpen = true;
let productionGateMessage = null;
try {
  productionFacts = deriveGrowthShenShaFacts({ plate, ruleContext: DEFAULT_RULE_CONTEXT });
} catch (error) {
  productionGateMessage = error instanceof Error ? error.message : String(error);
  productionGateOpen = false;
}
const growthFacts = productionFacts.filter(({ relation }) => relation === 'is-growth-stage');
const sixSpiritFacts = productionFacts.filter(({ relation }) => relation === 'is-six-beast');
const shenShaFacts = productionFacts.filter(({ relation }) => relation === 'is-shen-sha');

const result = {
  phase: 'PROJECT_ENABLED',
  artifact: {
    declaredHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    computedHash: sha256(GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD),
    matched: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH
      === sha256(GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD),
    canonicalBytes: Buffer.byteLength(GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD, 'utf8'),
  },
  manifest: {
    verificationLevel: GROWTH_SHENSHA_CORE_V1_MANIFEST.verificationLevel,
    runtimeStatus: GROWTH_SHENSHA_CORE_V1_MANIFEST.runtimeStatus,
    reviewCount: GROWTH_SHENSHA_CORE_V1_MANIFEST.reviews.length,
    productionGateOpen,
    productionGateMessage,
  },
  independentOracles: {
    growthFiveByTwelve: same(computedGrowth, growthOracle),
    sixSpiritTenBySix: same(computedSixSpirits, sixSpiritOracle),
    tianyiTenStems: same(computedTianyi, tianyiOracle),
    lushenTenStems: same(computedLushen, lushenOracle),
    yimaTwelveBranches: same(computedYima, yimaOracle),
    tianxiTwelveBranches: same(computedTianxi, tianxiOracle),
    sixSpiritAliases: same(
      Object.fromEntries(['青龙', '靑龍', '螣蛇', '滕蛇', '腾蛇', '玄武', '元武'].map((alias) => [
        alias,
        GROWTH_SHENSHA_CORE_V1_ARTIFACT.sixSpirit.aliases[alias],
      ])),
      { 青龙: '青龙', 靑龍: '青龙', 螣蛇: '螣蛇', 滕蛇: '螣蛇', 腾蛇: '螣蛇', 玄武: '玄武', 元武: '玄武' },
    ),
    tianyiDisabledVariant: tianyiCommonVariant.enabled === false
      && tianyiCommonVariant.sourceRefs.length > 0
      && same(tianyiCommonVariant.branchesByDayStem, tianyiCommonVariantOracle),
    tianxiMonthlyDisabledVariant: tianxiMonthlyVariant.enabled === false
      && tianxiMonthlyVariant.sourceRefs.length > 0
      && same(tianxiMonthlyVariant.branchesByMonthBranch, tianxiMonthlyVariantOracle),
    tianxiYearDisabledVariant: tianxiYearVariant.enabled === false
      && tianxiYearVariant.sourceRefs.length > 0
      && same(tianxiYearVariant.branchesByYearBranch, tianxiYearVariantOracle),
  },
  factContract: {
    movingLineCount: plate.movingLines.length,
    growthCount: growthFacts.length,
    fixedGrowthCount: growthFacts.filter(({ scope }) => scope === 'calendar').length,
    transitionGrowthCount: growthFacts.filter(({ scope }) => scope === 'transition').length,
    sixSpiritCount: sixSpiritFacts.length,
    shenShaCount: shenShaFacts.length,
    shenShaIds: shenShaFacts.map(({ values }) => values.shenShaId),
    shenShaFixedFixtureMatched: same(
      shenShaFacts.map(({ values }) => values.shenShaId),
      ['tianyi', 'yima', 'tianxi'],
    ),
    uniqueFactIds: new Set(productionFacts.map(({ id }) => id)).size === productionFacts.length,
    shenShaBaseVisibleOnly: shenShaFacts.every(({ target }) => (
      target?.type === 'line' && target.side === 'base'
    )),
    growthMetadataMatched: growthFacts.every(({ authority, certainty }) => (
      authority === 'profile-dependent' && (certainty === 'computed' || certainty === 'disputed')
    )),
    sixSpiritMetadataMatched: sixSpiritFacts.every(({ scope, authority, certainty }) => (
      scope === 'auxiliary' && authority === 'secondary' && certainty === 'computed'
    )),
    shenShaMetadataMatched: shenShaFacts.length > 0 && shenShaFacts.every(({
      scope,
      authority,
      certainty,
    }) => scope === 'auxiliary' && authority === 'secondary' && certainty === 'conditional'),
  },
  sourceEvidence,
  localCorpus: {
    corpusVersionMatched: localCorpus.corpusVersion === corpusManifest.corpusVersion,
    books: localBookEvidence,
    entries: localEntryEvidence,
  },
};

console.log(JSON.stringify(result, null, 2));

const matched = result.artifact.matched
  && result.artifact.canonicalBytes === 7050
  && result.manifest.verificationLevel === 'independent-automated'
  && result.manifest.runtimeStatus === 'project-enabled'
  && result.manifest.reviewCount === 2
  && result.manifest.productionGateOpen
  && Object.values(result.independentOracles).every(Boolean)
  && result.factContract.fixedGrowthCount === 48
  && result.factContract.transitionGrowthCount === result.factContract.movingLineCount
  && result.factContract.sixSpiritCount === 6
  && result.factContract.shenShaFixedFixtureMatched
  && result.factContract.uniqueFactIds
  && result.factContract.shenShaBaseVisibleOnly
  && result.factContract.growthMetadataMatched
  && result.factContract.sixSpiritMetadataMatched
  && result.factContract.shenShaMetadataMatched
  && sourceEvidence.every(({ matched: sourceMatched }) => sourceMatched)
  && result.localCorpus.corpusVersionMatched
  && localBookEvidence.every(({ matched: bookMatched }) => bookMatched)
  && localEntryEvidence.every(({ matched: entryMatched }) => entryMatched);

if (!matched) process.exitCode = 1;
