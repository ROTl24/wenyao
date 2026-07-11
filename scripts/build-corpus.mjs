import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'resources', 'corpus.json');
const MANIFEST_OUTPUT = path.join(ROOT, 'resources', 'corpus-manifest.json');

const BOOKS = [
  { match: /易隐/, id: 'YIYIN', title: '易隐' },
  { match: /卜筮正宗/, id: 'BUSHI-ZHENGZONG', title: '卜筮正宗' },
  { match: /易\s*冒/, id: 'YIMAO', title: '易冒' },
  { match: /火珠林/, id: 'HUOZHULIN', title: '火珠林', contentStart: /^1[．.、]易中明义/ },
  { match: /增\s*删\s*卜\s*易/, id: 'ZENGSHAN-BUYI', title: '增删卜易' },
];

const TAGS = [
  '八卦', '六十四卦', '纳甲', '五行', '天干', '地支', '六亲', '六神',
  '世爻', '应爻', '世应', '用神', '原神', '元神', '忌神', '仇神',
  '父母', '兄弟', '子孙', '妻财', '官鬼', '青龙', '朱雀', '勾陈', '腾蛇', '螣蛇', '白虎', '玄武',
  '月建', '月破', '日辰', '旬空', '空亡', '旺衰', '生克', '冲合', '六合', '六冲', '三合',
  '动爻', '变爻', '静爻', '伏神', '飞神', '进神', '退神', '回头生', '回头克',
  '化墓', '化绝', '墓库', '绝处逢生', '反吟', '伏吟', '独发', '独静',
  '身命', '功名', '事业', '官禄', '仕宦', '求名', '求财', '买卖', '婚姻', '胎产', '疾病', '考试', '科举', '科甲',
  '行人', '出行', '失物', '逃亡', '官司', '诉讼', '家宅', '坟墓', '天气', '农桑',
];

const HEADING_PATTERN = /^(?:卷[一二三四五六七八九十百〇零\d]*|第[一二三四五六七八九十百〇零\d]+[卷章节篇]|[一二三四五六七八九十百〇零\d]+[、.．])|(?:.*(?:章|节|篇|论|说|诀|法|赋|歌|断|占|例|图|序|目录|总断|要旨|启蒙|补遗|附录))$/;
const DROP_PATTERN = /(?:https?:\/\/|www\.|z-library|1lib|z-lib|下载提供|TXT小说|论坛)/i;

function decode(bytes) {
  try {
    return { encoding: 'utf-8', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { encoding: 'gb18030', text: new TextDecoder('gb18030', { fatal: true }).decode(bytes) };
  }
}

function normalizeLine(value) {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/([。；])\?\s*/g, '$1')
    .replace(/\?/g, '？')
    .replace(/[ \t　]+/g, ' ')
    .trim();
}

function isHeading(line) {
  if (!line || line.length > 42) return false;
  if (/[。！？；：，,]/.test(line)) return false;
  return HEADING_PATTERN.test(line) || (line.length <= 12 && /[卷章篇论说诀法赋歌断占例序目]$/.test(line));
}

function normalizeHeading(line) {
  const compact = line.replace(/^\s+|\s+$/g, '').slice(0, 42);
  return compact === '宜禄占' ? '官禄占' : compact;
}

function splitLongParagraph(text, maxLength = 720) {
  if (text.length <= maxLength) return [text];
  const sentences = text.split(/(?<=[。！？；])/u).filter(Boolean);
  const result = [];
  let current = '';
  for (const sentence of sentences.length ? sentences : [text]) {
    if (sentence.length > maxLength) {
      if (current) result.push(current);
      for (let offset = 0; offset < sentence.length; offset += maxLength) result.push(sentence.slice(offset, offset + maxLength));
      current = '';
    } else if (current.length + sentence.length > maxLength) {
      result.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) result.push(current);
  if (result.length > 1 && result.at(-1).length < 80) {
    result[result.length - 2] += result.at(-1);
    result.pop();
  }
  return result;
}

function tagsFor(text) {
  const found = TAGS.filter((tag) => text.includes(tag));
  if (text.includes('元神') && !found.includes('原神')) found.push('原神');
  if (text.includes('螣蛇') && !found.includes('腾蛇')) found.push('腾蛇');
  return found.slice(0, 18);
}

function chunkBook(book, decoded) {
  const rawLines = decoded.text.replace(/\r\n?/g, '\n').split('\n');
  const lines = rawLines.map((raw, index) => ({ number: index + 1, text: normalizeLine(raw) }));
  const entries = [];
  let heading = '正文';
  let paragraph = [];
  let contentStarted = !book.contentStart;

  const flush = () => {
    if (!paragraph.length) return;
    const startLine = paragraph[0].number;
    const endLine = paragraph.at(-1).number;
    const merged = paragraph.map((line) => line.text).join('');
    paragraph = [];
    if (merged.length < 36) return;
    for (const [partIndex, text] of splitLongParagraph(merged).entries()) {
      if (text.length < 36) continue;
      const tags = tagsFor(`${heading}${text}`);
      entries.push({
        id: `${book.id}-${String(entries.length + 1).padStart(4, '0')}`,
        title: partIndex ? `${heading}（续${partIndex + 1}）` : heading,
        source: book.title,
        location: `${heading} · 原文第 ${startLine}-${endLine} 行`,
        text,
        tags,
        sourceType: 'original',
      });
    }
  };

  for (const line of lines) {
    if (!contentStarted) {
      if (!book.contentStart.test(line.text)) continue;
      contentStarted = true;
    }
    if (!line.text || DROP_PATTERN.test(line.text)) {
      flush();
      continue;
    }
    if (isHeading(line.text)) {
      flush();
      heading = normalizeHeading(line.text);
      continue;
    }
    paragraph.push(line);
    const length = paragraph.reduce((sum, item) => sum + item.text.length, 0);
    if (length >= 560) flush();
  }
  flush();
  return { entries, rawLineCount: rawLines.length, acceptedLineCount: lines.filter((line) => line.text && !DROP_PATTERN.test(line.text)).length };
}

async function main() {
  const sourcePaths = process.argv.slice(2);
  if (!sourcePaths.length) throw new Error('请传入一个或多个古籍 TXT 文件路径。');

  const allEntries = [];
  const sources = [];
  const seenBooks = new Set();
  for (const sourcePath of sourcePaths) {
    const filename = path.basename(sourcePath);
    const book = BOOKS.find((candidate) => candidate.match.test(filename));
    if (!book) throw new Error(`无法识别古籍：${filename}`);
    if (seenBooks.has(book.id)) throw new Error(`古籍重复：${book.title}`);
    seenBooks.add(book.id);

    const bytes = await readFile(sourcePath);
    const decoded = decode(bytes);
    const replacementCount = (decoded.text.match(/�/g) || []).length;
    if (replacementCount) throw new Error(`${book.title} 解码后含 ${replacementCount} 个替换字符，请检查编码。`);
    const { entries, rawLineCount, acceptedLineCount } = chunkBook(book, decoded);
    if (!entries.length) throw new Error(`${book.title} 没有生成有效原文条目。`);
    allEntries.push(...entries);
    sources.push({
      id: book.id,
      title: book.title,
      filename,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      encoding: decoded.encoding,
      bytes: bytes.length,
      rawLineCount,
      acceptedLineCount,
      entryCount: entries.length,
    });
  }

  if (new Set(allEntries.map((entry) => entry.id)).size !== allEntries.length) throw new Error('证据 ID 出现重复。');
  if (allEntries.some((entry) => DROP_PATTERN.test(entry.text) || entry.text.includes('�'))) throw new Error('证据包仍含下载站文本或乱码。');

  const manifest = {
    schemaVersion: 1,
    corpusVersion: '2026.07.11-user-books-1',
    sourceType: 'user-provided-plain-text',
    bookCount: sources.length,
    entryCount: allEntries.length,
    sources,
  };
  await writeFile(OUTPUT, `${JSON.stringify(allEntries, null, 2)}\n`, 'utf8');
  await writeFile(MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${sources.length} 本古籍，${allEntries.length} 条原文证据，已写入 ${path.relative(ROOT, OUTPUT)}\n`);
}

await main();
