import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'corpus.json'), 'utf8'));
const topicTerms = ['用神', '世爻', '应爻', '官鬼', '妻财', '子孙', '父母', '兄弟', '日辰', '月建', '旬空', '六冲', '六合', '三合', '墓绝', '旺衰', '动爻', '变爻', '进神', '退神', '反吟', '伏吟', '事业', '功名', '求财', '婚姻', '疾病', '学业', '行人', '失物'];

function classify(text) {
  if (/(占验|验曰|后果|果于|果然|某日|某占|一人占|余曰)/.test(text)) return 'case';
  if (/(凡占|占.*?以.*?为用|宜[^。；]{0,20}|忌[^。；]{0,20}|不可|须看|当看|法曰)/.test(text)) return 'rule';
  return 'doctrine';
}

const units = corpus.map((entry) => {
  const combined = `${entry.title}\n${entry.text}\n${(entry.tags || []).join(' ')}`;
  return {
    id: entry.id,
    kind: classify(combined),
    topics: [...new Set(topicTerms.filter((term) => combined.includes(term)))],
    source: entry.source,
    location: entry.location,
  };
});

const output = path.join(root, 'resources', 'knowledge-index.json');
fs.writeFileSync(output, `${JSON.stringify({ version: 1, units }, null, 2)}\n`);
const counts = Object.groupBy(units, (unit) => unit.kind);
console.log(`知识单元：${units.length}，规则 ${counts.rule?.length || 0}，案例 ${counts.case?.length || 0}，义理 ${counts.doctrine?.length || 0}`);
