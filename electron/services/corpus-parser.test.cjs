const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBook, classifyKnowledge, normalizeLine } = require('./corpus-parser.cjs');

test('macOS 分解式 Unicode 文件名会归一化为稳定标题', () => {
  assert.equal(normalizeLine('周易\u0301'), '周易́'.normalize('NFC'));
  assert.equal(normalizeLine('Cafe\u0301'), 'Café');
});

test('TXT 解析保留章节、行号和技术元数据', () => {
  const text = [
    '卷一 用神章',
    '凡占事业，以官鬼为用神。世爻旺相，宜求名；若逢旬空，则须看日辰填实。'.repeat(8),
    '',
    '卷二 占验',
    '某占问功名，余曰官鬼得日辰生扶，后果于次月得任。'.repeat(5),
  ].join('\n');
  const result = parseBook(Buffer.from(text), { extension: '.txt', title: '测试古籍' });

  assert.equal(result.encoding, 'utf-8');
  assert.equal(result.chapterCount, 2);
  assert.ok(result.chunks.length >= 2);
  assert.ok(result.chunks.every((chunk) => chunk.startLine > 0 && chunk.endLine >= chunk.startLine));
  assert.ok(result.chunks.some((chunk) => chunk.knowledgeKind === 'rule'));
  assert.ok(result.chunks.some((chunk) => chunk.knowledgeKind === 'case'));
});

test('Markdown 标题和标记被转换为可检索正文', () => {
  const text = '# 总论\n\n**用神**为断卦之纲，世爻与应爻须分主客。'.repeat(8);
  const result = parseBook(Buffer.from(text), { extension: '.md', title: 'Markdown 易书' });
  assert.equal(result.chunks[0].title, '总论');
  assert.match(result.chunks[0].text, /用神/);
  assert.doesNotMatch(result.chunks[0].text, /\*\*/);
});

test('解析不限制古籍主题', () => {
  const text = '山川草木与星辰节候，各随岁时变化而有其理。'.repeat(8);
  const result = parseBook(Buffer.from(text), { extension: '.txt', title: '山川志' });
  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].knowledgeKind, 'doctrine');
});

test('拒绝不支持格式与过短正文', () => {
  assert.throws(
    () => parseBook(Buffer.from('足够长'.repeat(20)), { extension: '.pdf', title: '错误格式' }),
    (error) => error.code === 'CORPUS_FORMAT_UNSUPPORTED',
  );
  assert.throws(
    () => parseBook(Buffer.from('太短'), { extension: '.txt', title: '短文' }),
    (error) => error.code === 'CORPUS_TEXT_TOO_SHORT',
  );
});

test('知识类型分类与内置构建规则一致', () => {
  assert.equal(classifyKnowledge('凡占财运，以妻财为用神。'), 'rule');
  assert.equal(classifyKnowledge('一人占功名，后果于次月。'), 'case');
  assert.equal(classifyKnowledge('阴阳消长，理无二致。'), 'doctrine');
});

test('连续短章节会合并且不丢失正文', () => {
  const body = Buffer.from('# 甲章\n甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳\n# 乙章\n午未申酉戌亥天地玄黄宇宙洪荒日月盈昃寒来暑往秋收冬藏');
  const parsed = parseBook(body, { extension: '.md', title: '短章书' });
  const text = parsed.chunks.map((chunk) => chunk.text).join('');
  assert.match(text, /甲乙丙丁/);
  assert.match(text, /午未申酉/);
});
