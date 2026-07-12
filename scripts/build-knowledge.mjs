import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const {
  buildCanonicalEvidence,
  collectReviewedRuleEvidence: collectReviewedRuleEvidenceBase,
  normalizeCorpus,
  normalizeManifest,
  reviewedRuleEvidenceFromDomain,
  sha256,
} = require('../electron/services/evidence-catalog.cjs');

const root = path.resolve(import.meta.dirname, '..');
const topicTerms = [
  '用神', '世爻', '应爻', '官鬼', '妻财', '子孙', '父母', '兄弟', '日辰', '月建', '旬空',
  '六冲', '六合', '三合', '墓绝', '旺衰', '动爻', '变爻', '进神', '退神', '反吟', '伏吟',
  '事业', '功名', '求财', '婚姻', '疾病', '学业', '行人', '失物',
];

function classify(text) {
  if (/(占验|验曰|后果|果于|果然|某日|某占|一人占|余曰)/.test(text)) return 'case';
  if (/(凡占|占.*?以.*?为用|宜[^。；]{0,20}|忌[^。；]{0,20}|不可|须看|当看|法曰)/.test(text)) return 'rule';
  return 'doctrine';
}

export function collectReviewedRuleEvidence(input) {
  return collectReviewedRuleEvidenceBase(input);
}

export function buildKnowledgeIndex({ corpus: rawCorpus, corpusManifest: rawManifest, reviewed }) {
  const corpusManifest = normalizeManifest(rawManifest);
  const corpus = normalizeCorpus(rawCorpus, corpusManifest);
  if (!reviewed || !Array.isArray(reviewed.knownRuleIds) || !Array.isArray(reviewed.mappings)) {
    throw new TypeError('reviewed rule-evidence 映射缺失');
  }
  const knownRuleIds = new Set(reviewed.knownRuleIds);
  const corpusById = new Map(corpus.map((entry) => [entry.id, entry]));
  const supportsById = new Map(corpus.map((entry) => [entry.id, new Set()]));
  const pairKeys = new Set();

  for (const mapping of reviewed.mappings) {
    if (!mapping || typeof mapping !== 'object') throw new TypeError('reviewed rule-evidence 映射损坏');
    if (!knownRuleIds.has(mapping.ruleId)) throw new TypeError(`reviewed 映射包含未知规则：${mapping.ruleId}`);
    const entry = corpusById.get(mapping.evidenceId);
    if (!entry) throw new TypeError(`reviewed 映射包含未知语料：${mapping.evidenceId}`);
    if (sha256(entry.text) !== mapping.textSha256) {
      throw new Error(`reviewed 映射陈旧或正文哈希不一致：${mapping.evidenceId}`);
    }
    const pairKey = `${mapping.ruleId}\u0000${mapping.evidenceId}`;
    if (pairKeys.has(pairKey)) throw new TypeError(`reviewed 映射重复：${mapping.ruleId} -> ${mapping.evidenceId}`);
    pairKeys.add(pairKey);
    supportsById.get(mapping.evidenceId).add(mapping.ruleId);
  }

  const units = [...corpus].sort((left, right) => left.id.localeCompare(right.id)).map((entry) => {
    const combined = `${entry.title}\n${entry.text}\n${entry.tags.join(' ')}`;
    return {
      id: entry.id,
      kind: classify(combined),
      topics: [...new Set(topicTerms.filter((term) => combined.includes(term)))],
      source: entry.source,
      location: entry.location,
      supportsRuleIds: [...supportsById.get(entry.id)].sort((left, right) => left.localeCompare(right)),
    };
  });
  const canonical = buildCanonicalEvidence({ corpus, corpusManifest, units });
  return {
    version: 2,
    corpusVersion: corpusManifest.corpusVersion,
    corpusHash: canonical.hash,
    units,
  };
}

export function serializeKnowledgeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

async function buildFromProject() {
  const corpus = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'corpus.json'), 'utf8'));
  const corpusManifest = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'corpus-manifest.json'), 'utf8'));
  const domainPath = path.join(root, 'electron', 'generated', 'domain', 'index.js');
  let domain;
  try {
    domain = await import(`${pathToFileURL(domainPath).href}?knowledge=${Date.now()}`);
  } catch (error) {
    throw new Error(`compiled domain artifact 缺失或损坏，请先运行 build:domain：${error.message}`);
  }
  const reviewed = reviewedRuleEvidenceFromDomain(domain);
  return {
    index: buildKnowledgeIndex({ corpus, corpusManifest, reviewed }),
    reviewed,
  };
}

async function main() {
  const unexpected = process.argv.slice(2).filter((argument) => argument !== '--check');
  if (unexpected.length) throw new TypeError(`未知参数：${unexpected.join(' ')}`);
  const check = process.argv.includes('--check');
  const { index, reviewed } = await buildFromProject();
  const serialized = serializeKnowledgeIndex(index);
  const output = path.join(root, 'resources', 'knowledge-index.json');
  if (check) {
    let current;
    try {
      current = fs.readFileSync(output, 'utf8');
    } catch (error) {
      throw new Error(`knowledge-index.json 缺失：${error.message}`);
    }
    if (current !== serialized) throw new Error('knowledge-index.json 陈旧，请运行 npm run build:knowledge');
  } else {
    const temporary = `${output}.tmp`;
    fs.writeFileSync(temporary, serialized, 'utf8');
    fs.renameSync(temporary, output);
  }
  const supportedUnits = index.units.filter((unit) => unit.supportsRuleIds.length).length;
  const supportedRules = new Set(index.units.flatMap((unit) => unit.supportsRuleIds)).size;
  const counts = Object.groupBy(index.units, (unit) => unit.kind);
  console.log([
    `知识单元 ${index.units.length}`,
    `规则类 ${counts.rule?.length || 0}`,
    `案例类 ${counts.case?.length || 0}`,
    `义理类 ${counts.doctrine?.length || 0}`,
    `显式证据 ${supportedUnits}`,
    `覆盖规则 ${supportedRules}/${reviewed.knownRuleIds.length}`,
    `corpus ${index.corpusHash}`,
    check ? '校验通过' : '已写入',
  ].join('，'));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
