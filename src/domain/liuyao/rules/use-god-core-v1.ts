import type {
  FactRelation,
  QuestionCategory,
  QuestionIntentId,
  SixRelation,
  UseGodTargetSelector,
} from '../model.js';
import { LIUYAO_EFFECTS_V1_ARTIFACT_HASH } from '../facts/effects-core-v1.js';
import { GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH } from '../facts/growth-shensha-core-v1.js';
import { RELATION_CORE_V1_ARTIFACT_HASH } from '../facts/relation-core-v1.js';
import type {
  RuleAuthority,
  RuleSourceRef,
  UseGodRuleBundleManifest,
} from './model.js';
import { canonicalStringify, deepFreeze } from './tables.js';
import {
  USE_GOD_REVIEW_CHECKED_CLAIMS,
  USE_GOD_REVIEW_REPORT_PATHS,
} from './use-god-manifest-expectations.js';
import { WENWANG_NAJIA_V2_ARTIFACT_HASH } from './wenwang-najia-v2.js';

export interface UseGodSourceEvidenceCapsule {
  readonly ref: RuleSourceRef;
  readonly payload: string;
}

export interface UseGodIntentRule {
  readonly intentId: QuestionIntentId;
  readonly label: string;
  readonly category: QuestionCategory;
  readonly selector: UseGodTargetSelector | 'subject-relation' | 'explicit-target';
  readonly relatedRelations: readonly SixRelation[];
  readonly ruleId: string;
  readonly authority: RuleAuthority;
  readonly certainty: 'computed' | 'conditional';
  readonly sourceRefs: readonly string[];
  readonly version: '1.0.0';
}

interface UseGodRule {
  readonly ruleId: string;
  readonly relation?: FactRelation;
  readonly profileId: 'explicit_intent_first_v1' | 'yehe-last-resort-disputed-v1';
  readonly authority: RuleAuthority;
  readonly certainty: 'computed' | 'conditional' | 'disputed';
  readonly sourceRefs: readonly string[];
  readonly version: '1.0.0';
}

const CORPUS_VERSION = '2026.07.11-user-books-1';
const ZENGSHAN_BOOK_HASH = '5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae';
const BUSHI_BOOK_HASH = 'e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b';

const ROLE_PRIMER_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/3&oldid=2100295';
const USE_GOD_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/8&oldid=2100700';
const YUAN_JI_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/9&oldid=2100299';
const YUAN_JI_STRENGTH_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/10&oldid=2100301';
const GENERATES_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315';
const CONTROLS_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316';
const LATE_VOLUMES_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93&oldid=2572918';

const SOURCE_CONTENT_HASHES: Readonly<Record<string, string>> = {
  'WS-ZENGSHAN-ROLE-PRIMER-2100295': 'c5a7d586a9e11415096e9414855572b947920bf070bd123512dba25f56b9c784',
  'WS-ZENGSHAN-USE-GOD-2100700': '8e6fcecd2287199231996f6df3c87f5ec818d800a43d1da6632040bc2d7af12e',
  'WS-ZENGSHAN-YUAN-JI-2100299': '291732fe0eeebe2180fc1bc8b8117c24f2690ec463271ba048311ef56175f9c6',
  'WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301': 'fa64600d91112c25a8568877a0dab70e82f806d89777f9b5b806268b7dacd28c',
  'WS-ZENGSHAN-ELEMENT-GENERATES-2100315': 'cf17b667044cb3f8106dd3c6426966ba515cb6c9fc778d4a55137fe8c3fc11a7',
  'WS-ZENGSHAN-ELEMENT-CONTROLS-2100316': '7282583ca59be6ffb681ccf8a69cdef2bbc905b07e907fa0951dc0170445e689',
  'WS-ZENGSHAN-LATE-VOLUMES-2572918': '5420c497903a34c82cb722a7a9ca9a19d6ba8b9a37192b5b56e70a3446a0c2eb',
  'CORPUS-ZENGSHAN-USE-GOD': '4a0c3e9a6a607a3977e6151c3906a92210db20555525b81a0af44c9d0c6d1aa2',
  'CORPUS-BUSHI-USE-GOD': 'c4514ff716f424e702429788590aa99d1bd9055361caf73c52f086261e0e5796',
};

const sourceCapsule = (
  ref: Omit<RuleSourceRef, 'contentHash'>,
  lines: readonly string[],
): UseGodSourceEvidenceCapsule => ({
  ref: {
    ...ref,
    contentHash: SOURCE_CONTENT_HASHES[ref.id]
      ?? (() => { throw new Error(`用神来源 hash 缺失：${ref.id}`); })(),
  },
  payload: lines.join('\n'),
});

export const USE_GOD_SOURCE_EVIDENCE_CAPSULES = deepFreeze([
  sourceCapsule({
    id: 'WS-ZENGSHAN-ROLE-PRIMER-2100295',
    title: '《增删卜易·八宫图第三》世应入门',
    url: ROLE_PRIMER_URL,
    locator: '八宫图第三：装排世应六亲；初学自占先看世爻',
  }, [
    'sourceId=WS-ZENGSHAN-ROLE-PRIMER-2100295',
    `fixedUrl=${ROLE_PRIMER_URL}`,
    'locator=八宫图第三',
    'normalizedClaim=八宫全图用于装排世应五行六亲；初学自占四宗大事先看世爻；该页不单独推出应爻代表所有他人',
  ]),
  sourceCapsule({
    id: 'WS-ZENGSHAN-USE-GOD-2100700',
    title: '《增删卜易·用神章第八》',
    url: USE_GOD_URL,
    locator: '用神章第八：五类六亲所主对象与事项',
  }, [
    'sourceId=WS-ZENGSHAN-USE-GOD-2100700',
    `fixedUrl=${USE_GOD_URL}`,
    'locator=用神章第八',
    'normalizedClaim=父母主父母师长庇护物文书契约舟车衣服；官鬼主功名官府丈夫与拘束；兄弟主同辈且占财为劫；妻财主妻妾役使者与财物；子孙主晚辈医药六畜且占功名忌',
  ]),
  sourceCapsule({
    id: 'WS-ZENGSHAN-YUAN-JI-2100299',
    title: '《增删卜易·用神元神忌神仇神章第九》',
    url: YUAN_JI_URL,
    locator: '第九章定义元神、忌神与仇神',
  }, [
    'sourceId=WS-ZENGSHAN-YUAN-JI-2100299',
    `fixedUrl=${YUAN_JI_URL}`,
    'locator=用神元神忌神仇神章第九',
    'normalizedClaim=元神生用神；忌神克用神；仇神克元神而生忌神',
  ]),
  sourceCapsule({
    id: 'WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301',
    title: '《增删卜易·元神忌神衰旺章第十》',
    url: YUAN_JI_STRENGTH_URL,
    locator: '第十章：元神忌神需结合日月、动变、空破墓绝',
  }, [
    'sourceId=WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301',
    `fixedUrl=${YUAN_JI_STRENGTH_URL}`,
    'locator=元神忌神衰旺章第十',
    'normalizedClaim=元神与忌神须结合旺衰日月动变化空破墓绝判断有力无力；本规则包只定义身份，不复制强弱评分',
  ]),
  sourceCapsule({
    id: 'WS-ZENGSHAN-ELEMENT-GENERATES-2100315',
    title: '《增删卜易·五行相生章第十一》',
    url: GENERATES_URL,
    locator: '五行相生章第十一',
  }, [
    'sourceId=WS-ZENGSHAN-ELEMENT-GENERATES-2100315',
    `fixedUrl=${GENERATES_URL}`,
    'locator=五行相生章第十一',
    'normalizedClaim=木生火火生土土生金金生水水生木',
  ]),
  sourceCapsule({
    id: 'WS-ZENGSHAN-ELEMENT-CONTROLS-2100316',
    title: '《增删卜易·五行相克章第十二》',
    url: CONTROLS_URL,
    locator: '五行相克章第十二',
  }, [
    'sourceId=WS-ZENGSHAN-ELEMENT-CONTROLS-2100316',
    `fixedUrl=${CONTROLS_URL}`,
    'locator=五行相克章第十二',
    'normalizedClaim=木克土土克水水克火火克金金克木',
  ]),
  sourceCapsule({
    id: 'WS-ZENGSHAN-LATE-VOLUMES-2572918',
    title: '《增删卜易》飞伏、两现、出行与行人固定整书',
    url: LATE_VOLUMES_URL,
    locator: '飞伏神章、两现章、出行章、行人章及代占疾病相关段落',
  }, [
    'sourceId=WS-ZENGSHAN-LATE-VOLUMES-2572918',
    `fixedUrl=${LATE_VOLUMES_URL}`,
    'locator=飞伏神章两现章出行章行人章及代占疾病相关段落',
    'normalizedClaim=明卦无目标六亲时古法寻宫首伏神并审飞伏生克，但书内亦有不用伏神而再占；两现择法与反例并存；自占出行取世，疏远他人与行人须按关系或应爻处理',
  ]),
  sourceCapsule({
    id: 'CORPUS-ZENGSHAN-USE-GOD',
    title: '本地语料《增删卜易》取用、飞伏与两现条目',
    url: `urn:wenyao:corpus:ZENGSHAN-BUYI@${CORPUS_VERSION}`,
    locator: 'ZENGSHAN-BUYI-0038/0042/0043/0044/0045/0048/0075/0076/0078/0093/0205/0206/0213',
  }, [
    'sourceId=CORPUS-ZENGSHAN-USE-GOD',
    `fixedUrl=urn:wenyao:corpus:ZENGSHAN-BUYI@${CORPUS_VERSION}`,
    'locator=ZENGSHAN-BUYI-0038/0042/0043/0044/0045/0048/0075/0076/0078/0093/0205/0206/0213',
    'normalizedClaim=真实化爻与用元忌仇；伏神采用和再占不用伏神并存；两现择法和反例并存；自占出行取世，行人代占按关系取用',
    `localCorpusVersion=${CORPUS_VERSION}`,
    `localBookSha256=${ZENGSHAN_BOOK_HASH}`,
    'localEntries=ZENGSHAN-BUYI-0038:41a962af1b034dda388fd1ade0be5c84dd0a27f954908148f491553b532e0011,ZENGSHAN-BUYI-0042:1a46b59527744d077400421532aa59f1a6f45ff40ff1ef462e0144936a657553,ZENGSHAN-BUYI-0043:5e1c8798d06a56623c8e21b43374ffcb916521dd1a2a369d99aa3324ade761cf,ZENGSHAN-BUYI-0044:c8ef5163f83bb5f059d4bd93d386cd792d55845fc85f12d365a31c5aab4c0a74,ZENGSHAN-BUYI-0045:c81c7789c417d6be662713024ee9b5ea6c49d7e51ea8aa08da1fe46cea49b5fe,ZENGSHAN-BUYI-0048:8093a8de4643f9d7baa0c6a29797686c88dbc96e29ef0b0cc87d2a174d6cf61b,ZENGSHAN-BUYI-0075:c90b582ec7af72b9172c96335251c39c5173493bbe3f44aff144347e1323011b,ZENGSHAN-BUYI-0076:4201d8585d93850b3d86ce23b27ac739c469755461c85d909681c023c8df8762,ZENGSHAN-BUYI-0078:cb9b6c96810f58c0739ffc29616d3ec6327acf27be0cc2392a91185ebe431ca9,ZENGSHAN-BUYI-0093:cb32fe438c235a917be335f0ca9274cc8681173c6171e49b3ac567d86930adc9,ZENGSHAN-BUYI-0205:fbc10a4bcbfe5a4e64c3ad9605206110e384b28b17671e138ccf7d00f8d40edd,ZENGSHAN-BUYI-0206:cc61fbfb365d795a46f4d7232327db3c3070eb8e6263fa1c077922b3323264db,ZENGSHAN-BUYI-0213:eeb240ea67d497b9a62776f7dc638d3cb91d3ba92dd60b4c5d6006a710e02232',
  ]),
  sourceCapsule({
    id: 'CORPUS-BUSHI-USE-GOD',
    title: '本地语料《卜筮正宗》取用、飞伏与元忌条目',
    url: `urn:wenyao:corpus:BUSHI-ZHENGZONG@${CORPUS_VERSION}`,
    locator: 'BUSHI-ZHENGZONG-0040/0080/0081/0082/0083/0084/0085/0086/0088/0145/0224/0262/0263/0264',
  }, [
    'sourceId=CORPUS-BUSHI-USE-GOD',
    `fixedUrl=urn:wenyao:corpus:BUSHI-ZHENGZONG@${CORPUS_VERSION}`,
    'locator=BUSHI-ZHENGZONG-0040/0080/0081/0082/0083/0084/0085/0086/0088/0145/0224/0262/0263/0264',
    'normalizedClaim=飞伏生克四向；有真实化爻时不查伏神；六亲类别世应自他元忌仇与伏神得失；考试兼看父母官鬼；多现择法仅作为争议规则',
    `localCorpusVersion=${CORPUS_VERSION}`,
    `localBookSha256=${BUSHI_BOOK_HASH}`,
    'localEntries=BUSHI-ZHENGZONG-0040:3c0ecd72c7b82bfcf99ffbf29d776dc83806189cdeab021026ef0f1f90cf0c92,BUSHI-ZHENGZONG-0080:b5601e5bdf674f83cd911b48b04fe39ac09e7fe2301d450fc1a6702386efd386,BUSHI-ZHENGZONG-0081:dc903dcec7b1d463ef6ad9b13e9ff659d2694dd2903cca5f489c361ac4844f0c,BUSHI-ZHENGZONG-0082:652dcf12807a86bb1b0db2708523f1a724a396faf31a91366f09439698880a46,BUSHI-ZHENGZONG-0083:6924891d8f4ff06a61c463ea734abcb579d0464806e114359f97cd224c2c5e8a,BUSHI-ZHENGZONG-0084:10de0aa364f4d8761a46102993bb6b025a88d2f159c95b86e5ee03d2fad300c1,BUSHI-ZHENGZONG-0085:4c28bb2afd744cd4e46966d14034c9cebc7ae6f4e36409c055150435e4b63944,BUSHI-ZHENGZONG-0086:f142039f10e8674cf64136b6e076d1721e7539c2125bd0600fd7bcbc3bf8de22,BUSHI-ZHENGZONG-0088:52115fb278fab1ee7f27d6f5909e953fba99d1dc5ff2833c7856a514c17e7355,BUSHI-ZHENGZONG-0145:a7f628e3a5983de68544ccd82e4d113a4928432e26c96011cff09bcc35e56236,BUSHI-ZHENGZONG-0224:5163d085c1bd914f76db13e6331627566a9e19ac9e093cc659425187cd5d2ca1,BUSHI-ZHENGZONG-0262:4ba57ff50d795fb7930b8a779e3efadb8bfdbc356e65727fc2ccebc7d645a364,BUSHI-ZHENGZONG-0263:a6643bbcef2fc1dc70768392ebeae55dcd890ef277d037d51300c08e282d22e9,BUSHI-ZHENGZONG-0264:d03925de1e0c3b740f9c8358388a88322e904c6d441bbe8900a0e8004b9309fe',
  ]),
] as const satisfies readonly UseGodSourceEvidenceCapsule[]);

const SOURCE = {
  rolePrimer: 'WS-ZENGSHAN-ROLE-PRIMER-2100295',
  useGod: 'WS-ZENGSHAN-USE-GOD-2100700',
  yuanJi: 'WS-ZENGSHAN-YUAN-JI-2100299',
  yuanJiStrength: 'WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301',
  generates: 'WS-ZENGSHAN-ELEMENT-GENERATES-2100315',
  controls: 'WS-ZENGSHAN-ELEMENT-CONTROLS-2100316',
  lateVolumes: 'WS-ZENGSHAN-LATE-VOLUMES-2572918',
  localZengshan: 'CORPUS-ZENGSHAN-USE-GOD',
  localBushi: 'CORPUS-BUSHI-USE-GOD',
} as const;

const intent = (
  intentId: QuestionIntentId,
  label: string,
  category: QuestionCategory,
  selector: UseGodIntentRule['selector'],
  relatedRelations: readonly SixRelation[],
  ruleId: string,
  sourceRefs: readonly string[],
): UseGodIntentRule => ({
  intentId,
  label,
  category,
  selector,
  relatedRelations,
  ruleId,
  authority: 'profile-dependent',
  certainty: 'computed',
  sourceRefs,
  version: '1.0.0',
});

const INTENT_RULES = [
  intent('career.rank-or-office', '职位、功名或任职', 'career', { kind: 'six-relation', relation: '官鬼' }, ['父母'], 'use-god:intent:career-rank-or-office/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('career.contract-or-approval', '合同、批文或审批', 'career', { kind: 'six-relation', relation: '父母' }, ['官鬼'], 'use-god:intent:career-contract-or-approval/v1', [SOURCE.useGod, SOURCE.localZengshan]),
  intent('career.project-profit', '项目收益或经营财利', 'career', { kind: 'six-relation', relation: '妻财' }, ['子孙', '兄弟'], 'use-god:intent:career-project-profit/v1', [SOURCE.useGod, SOURCE.localZengshan]),
  intent('study.learning-or-documents', '学习过程、课程或文书', 'study', { kind: 'six-relation', relation: '父母' }, [], 'use-god:intent:study-learning-or-documents/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('study.exam-rank-or-admission', '考试名次、录取或功名', 'study', { kind: 'six-relation', relation: '官鬼' }, ['父母'], 'use-god:intent:study-exam-rank-or-admission/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('wealth.money-or-valuables', '收入、钱财或资产', 'wealth', { kind: 'six-relation', relation: '妻财' }, ['子孙', '兄弟'], 'use-god:intent:wealth-money-or-valuables/v1', [SOURCE.useGod, SOURCE.localZengshan]),
  intent('relationship.female-partner', '女性配偶或伴侣角色', 'relationship', { kind: 'six-relation', relation: '妻财' }, [], 'use-god:intent:relationship-female-partner/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('relationship.male-partner', '男性配偶或伴侣角色', 'relationship', { kind: 'six-relation', relation: '官鬼' }, [], 'use-god:intent:relationship-male-partner/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('relationship.relationship-dynamic', '双方关系互动', 'relationship', { kind: 'shi-ying-pair' }, [], 'use-god:intent:relationship-shi-ying-pair/v1', [SOURCE.rolePrimer, SOURCE.lateVolumes, SOURCE.localBushi]),
  intent('health.self', '本人健康', 'health', { kind: 'role', role: '世' }, ['官鬼', '子孙'], 'use-god:intent:health-self/v1', [SOURCE.rolePrimer, SOURCE.lateVolumes, SOURCE.localZengshan]),
  intent('health.other-person', '他人健康', 'health', 'subject-relation', ['官鬼', '子孙'], 'use-god:intent:health-other-person/v1', [SOURCE.useGod, SOURCE.lateVolumes, SOURCE.localZengshan]),
  intent('lost-item.money-or-valuables', '钱财或贵重物品', 'lost_item', { kind: 'six-relation', relation: '妻财' }, [], 'use-god:intent:lost-money-or-valuables/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('lost-item.documents-or-vehicle', '文书、衣物或车辆', 'lost_item', { kind: 'six-relation', relation: '父母' }, [], 'use-god:intent:lost-documents-or-vehicle/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('lost-item.animal', '动物或宠物', 'lost_item', { kind: 'six-relation', relation: '子孙' }, [], 'use-god:intent:lost-animal/v1', [SOURCE.useGod, SOURCE.localBushi]),
  intent('travel.self', '本人出行', 'travel', { kind: 'role', role: '世' }, [], 'use-god:intent:travel-self/v1', [SOURCE.rolePrimer, SOURCE.lateVolumes, SOURCE.localZengshan]),
  intent('travel.other-person', '他人行踪或出行', 'travel', 'subject-relation', [], 'use-god:intent:travel-other-person/v1', [SOURCE.lateVolumes, SOURCE.localZengshan, SOURCE.localBushi]),
  intent('other.explicit', '明确指定对象', 'other', 'explicit-target', [], 'use-god:intent:other-explicit/v1', [SOURCE.useGod, SOURCE.lateVolumes]),
] as const satisfies readonly UseGodIntentRule[];

const rule = (
  ruleId: string,
  authority: RuleAuthority,
  certainty: UseGodRule['certainty'],
  sourceRefs: readonly string[],
  relation?: FactRelation,
  profileId: UseGodRule['profileId'] = 'explicit_intent_first_v1',
): UseGodRule => ({
  ruleId,
  ...(relation ? { relation } : {}),
  profileId,
  authority,
  certainty,
  sourceRefs,
  version: '1.0.0',
});

export const USE_GOD_CORE_V1_ARTIFACT = deepFreeze({
  artifactSchema: 'liuyao-use-god-core/v1',
  bundleId: 'use_god_core_v1',
  version: '1.0.0',
  profileId: 'explicit_intent_first_v1',
  dependsOn: {
    wenwangArtifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    relationArtifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
    growthShenShaArtifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    effectsArtifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  },
  localCorpus: {
    corpusVersion: CORPUS_VERSION,
    books: [
      {
        sourceId: 'ZENGSHAN-BUYI',
        bookSha256: ZENGSHAN_BOOK_HASH,
        entries: [
          ['ZENGSHAN-BUYI-0038', '41a962af1b034dda388fd1ade0be5c84dd0a27f954908148f491553b532e0011'],
          ['ZENGSHAN-BUYI-0042', '1a46b59527744d077400421532aa59f1a6f45ff40ff1ef462e0144936a657553'],
          ['ZENGSHAN-BUYI-0043', '5e1c8798d06a56623c8e21b43374ffcb916521dd1a2a369d99aa3324ade761cf'],
          ['ZENGSHAN-BUYI-0044', 'c8ef5163f83bb5f059d4bd93d386cd792d55845fc85f12d365a31c5aab4c0a74'],
          ['ZENGSHAN-BUYI-0045', 'c81c7789c417d6be662713024ee9b5ea6c49d7e51ea8aa08da1fe46cea49b5fe'],
          ['ZENGSHAN-BUYI-0048', '8093a8de4643f9d7baa0c6a29797686c88dbc96e29ef0b0cc87d2a174d6cf61b'],
          ['ZENGSHAN-BUYI-0075', 'c90b582ec7af72b9172c96335251c39c5173493bbe3f44aff144347e1323011b'],
          ['ZENGSHAN-BUYI-0076', '4201d8585d93850b3d86ce23b27ac739c469755461c85d909681c023c8df8762'],
          ['ZENGSHAN-BUYI-0078', 'cb9b6c96810f58c0739ffc29616d3ec6327acf27be0cc2392a91185ebe431ca9'],
          ['ZENGSHAN-BUYI-0093', 'cb32fe438c235a917be335f0ca9274cc8681173c6171e49b3ac567d86930adc9'],
          ['ZENGSHAN-BUYI-0205', 'fbc10a4bcbfe5a4e64c3ad9605206110e384b28b17671e138ccf7d00f8d40edd'],
          ['ZENGSHAN-BUYI-0206', 'cc61fbfb365d795a46f4d7232327db3c3070eb8e6263fa1c077922b3323264db'],
          ['ZENGSHAN-BUYI-0213', 'eeb240ea67d497b9a62776f7dc638d3cb91d3ba92dd60b4c5d6006a710e02232'],
        ],
      },
      {
        sourceId: 'BUSHI-ZHENGZONG',
        bookSha256: BUSHI_BOOK_HASH,
        entries: [
          ['BUSHI-ZHENGZONG-0040', '3c0ecd72c7b82bfcf99ffbf29d776dc83806189cdeab021026ef0f1f90cf0c92'],
          ['BUSHI-ZHENGZONG-0080', 'b5601e5bdf674f83cd911b48b04fe39ac09e7fe2301d450fc1a6702386efd386'],
          ['BUSHI-ZHENGZONG-0081', 'dc903dcec7b1d463ef6ad9b13e9ff659d2694dd2903cca5f489c361ac4844f0c'],
          ['BUSHI-ZHENGZONG-0082', '652dcf12807a86bb1b0db2708523f1a724a396faf31a91366f09439698880a46'],
          ['BUSHI-ZHENGZONG-0083', '6924891d8f4ff06a61c463ea734abcb579d0464806e114359f97cd224c2c5e8a'],
          ['BUSHI-ZHENGZONG-0084', '10de0aa364f4d8761a46102993bb6b025a88d2f159c95b86e5ee03d2fad300c1'],
          ['BUSHI-ZHENGZONG-0085', '4c28bb2afd744cd4e46966d14034c9cebc7ae6f4e36409c055150435e4b63944'],
          ['BUSHI-ZHENGZONG-0086', 'f142039f10e8674cf64136b6e076d1721e7539c2125bd0600fd7bcbc3bf8de22'],
          ['BUSHI-ZHENGZONG-0088', '52115fb278fab1ee7f27d6f5909e953fba99d1dc5ff2833c7856a514c17e7355'],
          ['BUSHI-ZHENGZONG-0145', 'a7f628e3a5983de68544ccd82e4d113a4928432e26c96011cff09bcc35e56236'],
          ['BUSHI-ZHENGZONG-0224', '5163d085c1bd914f76db13e6331627566a9e19ac9e093cc659425187cd5d2ca1'],
          ['BUSHI-ZHENGZONG-0262', '4ba57ff50d795fb7930b8a779e3efadb8bfdbc356e65727fc2ccebc7d645a364'],
          ['BUSHI-ZHENGZONG-0263', 'a6643bbcef2fc1dc70768392ebeae55dcd890ef277d037d51300c08e282d22e9'],
          ['BUSHI-ZHENGZONG-0264', 'd03925de1e0c3b740f9c8358388a88322e904c6d441bbe8900a0e8004b9309fe'],
        ],
      },
    ],
  },
  intentRules: INTENT_RULES,
  categoryIntents: {
    career: ['career.rank-or-office', 'career.contract-or-approval', 'career.project-profit'],
    wealth: ['wealth.money-or-valuables'],
    relationship: ['relationship.female-partner', 'relationship.male-partner', 'relationship.relationship-dynamic'],
    health: ['health.self', 'health.other-person'],
    study: ['study.learning-or-documents', 'study.exam-rank-or-admission'],
    lost_item: ['lost-item.money-or-valuables', 'lost-item.documents-or-vehicle', 'lost-item.animal'],
    travel: ['travel.self', 'travel.other-person'],
    other: ['other.explicit'],
  } as const satisfies Readonly<Record<QuestionCategory, readonly QuestionIntentId[]>>,
  selection: {
    order: ['intent', 'target-selector', 'concrete-entity'] as const,
    candidateTiers: [
      { id: 'base-visible', tier: 0, eligible: 'all-base-visible-lines' },
      { id: 'true-changed', tier: 1, eligible: 'moving-lines-changed-side-only' },
      { id: 'palace-head-hidden', tier: 2, eligible: 'potential-hidden-candidates-only' },
    ] as const,
    stopAfterFirstNonEmptyTier: true,
    multipleCandidates: 'retain-all-without-auto-choice',
    candidateScoreField: 'forbidden',
    roleSelectors: 'base-side-only',
    distantOtherSelector: { kind: 'role', role: '应' } as const,
    pairMode: 'shi-ying-pair-without-primary',
    hiddenPolicy: {
      id: 'yehe-last-resort-disputed-v1',
      requiresEmptyTiers: ['base-visible', 'true-changed'] as const,
      certainty: 'disputed',
      conditions: ['visible-and-true-changed-tiers-empty', 'hidden-use-disputed'] as const,
    },
  },
  flyingHidden: {
    direction: 'flying-base-line-versus-hosted-hidden-spirit',
    relations: [
      'flying-generates-hidden',
      'flying-controls-hidden',
      'hidden-generates-flying',
      'hidden-controls-flying',
      'same-element',
    ] as const,
  },
  spirits: {
    source: 'element-generates-use-god',
    avoid: 'element-controls-use-god',
    enemy: 'element-generates-avoid-and-controls-source',
    eligibleEntities: ['base-line', 'true-changed', 'month', 'day', 'selected-hidden'] as const,
    excludedEntities: ['year', 'hour', 'unselected-hidden', 'static-changed'] as const,
    requires: 'resolved-single-primary',
    inheritHiddenDispute: true,
  },
  variants: [
    {
      id: 'month-day-replace-use-before-hidden-v1',
      enabled: false,
      reason: '古法分支未纳入默认具体实体模型',
      sourceRefs: [SOURCE.lateVolumes, SOURCE.localZengshan],
    },
    {
      id: 'recast-instead-of-hidden-v1',
      enabled: false,
      reason: '原书与采用伏神并存，默认仅以 disputed 候选显式保留分歧',
      sourceRefs: [SOURCE.lateVolumes, SOURCE.localZengshan],
    },
    {
      id: 'multiple-candidate-strength-auto-choice-v1',
      enabled: false,
      reason: '两现择法与反例并存，默认不自动唯一化',
      sourceRefs: [SOURCE.yuanJi, SOURCE.lateVolumes, SOURCE.localZengshan, SOURCE.localBushi],
    },
  ],
  rules: [
    rule('use-god:clarify-intent/v1', 'profile-dependent', 'computed', [SOURCE.useGod, SOURCE.localBushi]),
    rule('use-god:subject-relation/v1', 'profile-dependent', 'computed', [SOURCE.useGod, SOURCE.lateVolumes, SOURCE.localZengshan]),
    rule('use-god:explicit-target/v1', 'profile-dependent', 'computed', [SOURCE.useGod, SOURCE.lateVolumes]),
    rule('use-god:candidate-tiers/v1', 'profile-dependent', 'computed', [SOURCE.useGod, SOURCE.lateVolumes, SOURCE.localZengshan, SOURCE.localBushi]),
    rule('use-god:base-role/v1', 'profile-dependent', 'computed', [SOURCE.rolePrimer, SOURCE.lateVolumes, SOURCE.localBushi]),
    rule('use-god:shi-ying-pair/v1', 'profile-dependent', 'computed', [SOURCE.rolePrimer, SOURCE.lateVolumes, SOURCE.localBushi]),
    rule('use-god:hidden-last-resort/v1', 'profile-dependent', 'disputed', [SOURCE.lateVolumes, SOURCE.localZengshan, SOURCE.localBushi], undefined, 'yehe-last-resort-disputed-v1'),
    rule('use-god:base-holds-shi/v1', 'structural', 'computed', [SOURCE.rolePrimer, SOURCE.lateVolumes], 'holds-shi'),
    rule('use-god:base-holds-ying/v1', 'structural', 'computed', [SOURCE.rolePrimer, SOURCE.lateVolumes], 'holds-ying'),
    rule('use-god:flying-hidden:flying-generates-hidden/v1', 'structural', 'computed', [SOURCE.lateVolumes, SOURCE.localBushi, SOURCE.generates], 'flying-generates-hidden'),
    rule('use-god:flying-hidden:flying-controls-hidden/v1', 'structural', 'computed', [SOURCE.lateVolumes, SOURCE.localBushi, SOURCE.controls], 'flying-controls-hidden'),
    rule('use-god:flying-hidden:hidden-generates-flying/v1', 'structural', 'computed', [SOURCE.lateVolumes, SOURCE.localBushi, SOURCE.generates], 'hidden-generates-flying'),
    rule('use-god:flying-hidden:hidden-controls-flying/v1', 'structural', 'computed', [SOURCE.lateVolumes, SOURCE.localBushi, SOURCE.controls], 'hidden-controls-flying'),
    rule('use-god:flying-hidden:same-element/v1', 'structural', 'computed', [SOURCE.generates, SOURCE.controls], 'same-element'),
    rule('use-god:source-spirit-by-element/v1', 'profile-dependent', 'computed', [SOURCE.yuanJi, SOURCE.generates, SOURCE.localZengshan], 'is-source-spirit'),
    rule('use-god:avoid-spirit-by-element/v1', 'profile-dependent', 'computed', [SOURCE.yuanJi, SOURCE.controls, SOURCE.localZengshan], 'is-avoid-spirit'),
    rule('use-god:enemy-spirit-by-element/v1', 'profile-dependent', 'computed', [SOURCE.yuanJi, SOURCE.generates, SOURCE.controls, SOURCE.localZengshan], 'is-enemy-spirit'),
  ],
} as const);

export const USE_GOD_CORE_V1_CANONICAL_PAYLOAD = canonicalStringify(USE_GOD_CORE_V1_ARTIFACT);

export const USE_GOD_CORE_V1_ARTIFACT_HASH = '22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa';

export const USE_GOD_CORE_V1_MANIFEST = deepFreeze({
  bundleId: 'use_god_core_v1',
  version: '1.0.0',
  artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
  verificationLevel: 'independent-automated',
  runtimeStatus: 'project-enabled',
  reviews: [
    {
      reviewerId: 'codex-use-god-source-reviewer-a-7d3f8c2a',
      reviewerKind: 'automated-agent',
      independentRunId: 'use-god-a-db5a5320-6b33-4906-93d2-4bc7e867090e',
      reviewedAt: '2026-07-12T13:37:55.6866138+08:00',
      artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: USE_GOD_REVIEW_REPORT_PATHS[0],
      checkedClaims: USE_GOD_REVIEW_CHECKED_CLAIMS,
    },
    {
      reviewerId: 'codex-corpus-matrix-use-god-b-bb24d3c9',
      reviewerKind: 'automated-agent',
      independentRunId: 'use-god-core-v1-b-bb24d3c9-0d28-497a-b54d-8b518689957e',
      reviewedAt: '2026-07-12T13:45:28.8202434+08:00',
      artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: USE_GOD_REVIEW_REPORT_PATHS[1],
      checkedClaims: USE_GOD_REVIEW_CHECKED_CLAIMS,
    },
  ],
  sourceRefs: USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
} as const satisfies UseGodRuleBundleManifest);

export function useGodIntentRule(intentId: QuestionIntentId): UseGodIntentRule {
  const found = USE_GOD_CORE_V1_ARTIFACT.intentRules.find(
    (candidate) => candidate.intentId === intentId,
  );
  if (!found) throw new Error(`用神问意规则缺失：${intentId}`);
  return found;
}

export function useGodRule(ruleId: string): UseGodRule {
  const found = USE_GOD_CORE_V1_ARTIFACT.rules.find(
    (candidate) => candidate.ruleId === ruleId,
  );
  if (!found) throw new Error(`用神规则缺失：${ruleId}`);
  return found;
}
