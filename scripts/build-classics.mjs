import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'src', 'data', 'zhouyi-classics.json');
const apiUrl = 'https://zh.wikisource.org/w/api.php';
const sourceIndexRevision = 7907208;

const hexagrams = [
  ['乾为天', '乾'], ['坤为地', '坤'], ['水雷屯', '屯'], ['山水蒙', '蒙'],
  ['水天需', '需'], ['天水讼', '訟'], ['地水师', '師'], ['水地比', '比'],
  ['风天小畜', '小畜'], ['天泽履', '履'], ['地天泰', '泰'], ['天地否', '否'],
  ['天火同人', '同人'], ['火天大有', '大有'], ['地山谦', '謙'], ['雷地豫', '豫'],
  ['泽雷随', '隨'], ['山风蛊', '蠱'], ['地泽临', '臨'], ['风地观', '觀'],
  ['火雷噬嗑', '噬嗑'], ['山火贲', '賁'], ['山地剥', '剝'], ['地雷复', '復'],
  ['天雷无妄', '无妄'], ['山天大畜', '大畜'], ['山雷颐', '頤'], ['泽风大过', '大過'],
  ['坎为水', '坎'], ['离为火', '離'], ['泽山咸', '咸'], ['雷风恒', '恒'],
  ['天山遁', '遯'], ['雷天大壮', '大壯'], ['火地晋', '晉'], ['地火明夷', '明夷'],
  ['风火家人', '家人'], ['火泽睽', '睽'], ['水山蹇', '蹇'], ['雷水解', '解'],
  ['山泽损', '損'], ['风雷益', '益'], ['泽天夬', '夬'], ['天风姤', '姤'],
  ['泽地萃', '萃'], ['地风升', '升'], ['泽水困', '困'], ['水风井', '井'],
  ['泽火革', '革'], ['火风鼎', '鼎'], ['震为雷', '震'], ['艮为山', '艮'],
  ['风山渐', '漸'], ['雷泽归妹', '歸妹'], ['雷火丰', '豐'], ['火山旅', '旅'],
  ['巽为风', '巽'], ['兑为泽', '兌'], ['风水涣', '渙'], ['水泽节', '節'],
  ['风泽中孚', '中孚'], ['雷山小过', '小過'], ['水火既济', '既濟'], ['火水未济', '未濟'],
];

function cleanWikitext(value) {
  let result = value;
  for (let pass = 0; pass < 4; pass += 1) {
    result = result.replace(/-\{(?:[^|{}]+\|)?([^{}]+)\}-/g, '$1');
  }
  return result
    .replace(/\{\{\*\|([^{}]+)\}\}/g, '（$1）')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/^[*#:;]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(wikitext, appName, sourceName) {
  const lines = wikitext.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes('易經：'));
  const end = lines.findIndex((line, index) => index > start && /彖曰/.test(line));
  if (start < 0 || end < 0) throw new Error(`${appName} 缺少易经正文边界`);

  const body = lines.slice(start + 1, end).filter((line) => /^\*\*|^\*#/.test(line));
  const judgmentLine = cleanWikitext(body.find((line) => line.startsWith('**')) || '');
  if (!judgmentLine) throw new Error(`${appName} 缺少卦辞`);

  const parsedLines = body.filter((line) => line.startsWith('*#')).map((line) => {
    const text = cleanWikitext(line);
    const match = text.match(/^(初[九六]|[九六][二三四五]|上[九六]|用[九六])[：，、]?\s*(.+)$/);
    if (!match) throw new Error(`${appName} 爻辞缺少标签：${text}`);
    return { label: match[1], text: match[2] };
  });
  const special = parsedLines.find((line) => line.label === '用九' || line.label === '用六') || null;
  const regularLines = parsedLines.filter((line) => line !== special);
  const expectedPositions = ['初', '二', '三', '四', '五', '上'];
  if (regularLines.length !== 6) throw new Error(`${appName} 应有六条爻辞，实际 ${regularLines.length}`);
  regularLines.forEach((line, index) => {
    const position = expectedPositions[index];
    const valid = index === 0
      ? line.label.startsWith('初')
      : index === 5
        ? line.label.startsWith('上')
        : line.label.endsWith(position);
    if (!valid || !/^[初上九六二三四五]+$/.test(line.label)) {
      throw new Error(`${appName} 第 ${index + 1} 爻标签异常：${line.label}`);
    }
  });
  if ((appName === '乾为天') !== (special?.label === '用九')) throw new Error('乾卦用九缺失或错配');
  if ((appName === '坤为地') !== (special?.label === '用六')) throw new Error('坤卦用六缺失或错配');

  return {
    judgment: judgmentLine,
    lines: regularLines.map((line, index) => ({ position: index + 1, ...line })),
    ...(special ? { special } : {}),
  };
}

async function existingRevisions() {
  try {
    const existing = JSON.parse(await fs.readFile(outputPath, 'utf8'));
    return {
      retrievedAt: existing.source.retrievedAt,
      revisions: new Map(existing.hexagrams.map((item) => [item.appName, item.sourceRevision])),
    };
  } catch {
    return { retrievedAt: new Date().toISOString().slice(0, 10), revisions: new Map() };
  }
}

async function fetchPage(appName, sourceName, pinnedRevision) {
  const params = new URLSearchParams({
    action: 'parse',
    prop: 'wikitext|revid',
    format: 'json',
    formatversion: '2',
    ...(pinnedRevision ? { oldid: String(pinnedRevision) } : { page: `周易/${sourceName}` }),
  });
  const response = await fetch(`${apiUrl}?${params}`, {
    headers: { 'User-Agent': 'WenYao/0.5.2 classics-builder (https://github.com/ROTl24/wenyao)' },
  });
  if (!response.ok) throw new Error(`${appName} 下载失败：HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error || !payload.parse?.wikitext) {
    throw new Error(`${appName} 下载失败：${payload.error?.info || '无正文'}`);
  }
  if (payload.parse.title !== `周易/${sourceName}`) {
    throw new Error(`${appName} 页面错配：${payload.parse.title}`);
  }
  return {
    number: hexagrams.findIndex(([name]) => name === appName) + 1,
    appName,
    sourceName,
    sourcePage: `周易/${sourceName}`,
    sourceRevision: payload.parse.revid,
    ...parsePage(payload.parse.wikitext, appName, sourceName),
  };
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return output;
}

const existing = await existingRevisions();
const entries = await mapConcurrent(hexagrams, 6, async ([appName, sourceName]) => (
  fetchPage(appName, sourceName, existing.revisions.get(appName))
));
const uniqueNames = new Set(entries.map((entry) => entry.appName));
const lineCount = entries.reduce((sum, entry) => sum + entry.lines.length, 0);
if (entries.length !== 64 || uniqueNames.size !== 64 || lineCount !== 384) {
  throw new Error(`经文完整性失败：${entries.length} 卦、${uniqueNames.size} 个名称、${lineCount} 爻`);
}

const result = {
  source: {
    title: '《周易》',
    provider: '维基文库',
    indexPage: 'https://zh.wikisource.org/wiki/周易',
    indexRevision: sourceIndexRevision,
    retrievedAt: existing.retrievedAt,
    sourceStatus: '原典页面标注为公有领域',
    transcriptionLicense: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  hexagrams: entries,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, outputPath)}: ${entries.length} hexagrams, ${lineCount} lines.`);
