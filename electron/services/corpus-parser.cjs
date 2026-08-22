const crypto = require('node:crypto');

const MIN_CHUNK_LENGTH = 36;
const TARGET_CHUNK_LENGTH = 560;
const MAX_CHUNK_LENGTH = 720;

const DOMAIN_TAGS = [
  '八卦', '六十四卦', '纳甲', '五行', '天干', '地支', '六亲', '六神',
  '世爻', '应爻', '世应', '用神', '原神', '元神', '忌神', '仇神',
  '父母', '兄弟', '子孙', '妻财', '官鬼', '青龙', '朱雀', '勾陈', '腾蛇', '螣蛇', '白虎', '玄武',
  '月建', '月破', '日辰', '旬空', '空亡', '旺衰', '生克', '冲合', '六合', '六冲', '三合',
  '动爻', '变爻', '静爻', '伏神', '飞神', '进神', '退神', '回头生', '回头克',
  '化墓', '化绝', '墓库', '绝处逢生', '反吟', '伏吟', '独发', '独静',
  '身命', '功名', '事业', '官禄', '仕宦', '求名', '求财', '买卖', '婚姻', '胎产', '疾病', '考试', '科举',
  '行人', '出行', '失物', '逃亡', '官司', '诉讼', '家宅', '坟墓', '天气', '农桑',
];

const GENERIC_HEADING_PATTERN = /^(?:卷[一二三四五六七八九十百〇零\d]*|第[一二三四五六七八九十百〇零\d]+[卷章节篇]|[一二三四五六七八九十百〇零\d]+[、.．])|(?:.*(?:章|节|篇|论|说|诀|法|赋|歌|断|占|例|图|序|目录|总断|要旨|启蒙|补遗|附录))$/;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function decodeBook(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try {
    return { encoding: 'utf-8', text: new TextDecoder('utf-8', { fatal: true }).decode(buffer) };
  } catch {
    try {
      return { encoding: 'gb18030', text: new TextDecoder('gb18030', { fatal: true }).decode(buffer) };
    } catch {
      const error = new Error('文件既不是有效的 UTF-8，也不是有效的 GB18030 文本。');
      error.code = 'CORPUS_ENCODING_INVALID';
      throw error;
    }
  }
}

function normalizeLine(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t　]+/g, ' ')
    .trim();
}

function markdownPlainText(value) {
  return normalizeLine(value)
    .replace(/^\s{0,3}(?:>|[-+*]|\d+[.)])\s+/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/(?:\*\*|__|~~|\*|_)/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function isGenericHeading(line) {
  if (!line || line.length > 42 || /[。！？；：，,]/.test(line)) return false;
  return GENERIC_HEADING_PATTERN.test(line)
    || (line.length <= 12 && /[卷章篇论说诀法赋歌断占例序目]$/.test(line));
}

function splitLongText(text, maxLength = MAX_CHUNK_LENGTH) {
  if (text.length <= maxLength) return [text];
  const sentences = text.split(/(?<=[。！？；])/u).filter(Boolean);
  const output = [];
  let current = '';
  for (const sentence of sentences.length ? sentences : [text]) {
    if (sentence.length > maxLength) {
      if (current) output.push(current);
      for (let offset = 0; offset < sentence.length; offset += maxLength) {
        output.push(sentence.slice(offset, offset + maxLength));
      }
      current = '';
    } else if (current && current.length + sentence.length > maxLength) {
      output.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) output.push(current);
  if (output.length > 1 && output.at(-1).length < MIN_CHUNK_LENGTH) {
    output[output.length - 2] += output.at(-1);
    output.pop();
  }
  return output;
}

function tagsFor(text) {
  const tags = DOMAIN_TAGS.filter((tag) => text.includes(tag));
  if (text.includes('元神') && !tags.includes('原神')) tags.push('原神');
  if (text.includes('螣蛇') && !tags.includes('腾蛇')) tags.push('腾蛇');
  return tags.slice(0, 18);
}

function classifyKnowledge(text) {
  if (/(占验|验曰|后果|果于|果然|某日|某占|一人占|余曰)/.test(text)) return 'case';
  if (/(凡占|占.*?以.*?为用|宜[^。；]{0,20}|忌[^。；]{0,20}|不可|须看|当看|法曰)/.test(text)) return 'rule';
  return 'doctrine';
}

function paragraphsFromText(text, extension) {
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const markdown = extension === '.md';
  const paragraphs = [];
  let heading = '正文';
  let pending = [];

  const flush = () => {
    if (!pending.length) return;
    const merged = pending.map((line) => line.text).join('');
    paragraphs.push({
      heading,
      text: merged,
      startLine: pending[0].number,
      endLine: pending.at(-1).number,
    });
    pending = [];
  };

  rawLines.forEach((raw, index) => {
    const markdownHeading = markdown ? raw.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/) : null;
    const normalized = markdown
      ? markdownPlainText(markdownHeading ? markdownHeading[1] : raw)
      : normalizeLine(raw);
    if (markdownHeading || isGenericHeading(normalized)) {
      flush();
      if (normalized) heading = normalized.slice(0, 80);
      return;
    }
    if (!normalized) {
      flush();
      return;
    }
    pending.push({ number: index + 1, text: normalized });
    const length = pending.reduce((sum, line) => sum + line.text.length, 0);
    if (length >= TARGET_CHUNK_LENGTH) flush();
  });
  flush();
  return { rawLines, paragraphs };
}

function chunksFromParagraphs(paragraphs, bookTitle) {
  const chunks = [];
  let carry = null;

  const emit = (item) => {
    for (const [partIndex, text] of splitLongText(item.text).entries()) {
      if (text.length < MIN_CHUNK_LENGTH) {
        carry = carry
          ? { ...carry, text: `${carry.text}${text}`, endLine: item.endLine }
          : { ...item, text };
        continue;
      }
      const title = partIndex ? `${item.heading}（续${partIndex + 1}）` : item.heading;
      const combined = `${bookTitle}\n${title}\n${text}`;
      chunks.push({
        title,
        text,
        tags: tagsFor(combined),
        knowledgeKind: classifyKnowledge(combined),
        startLine: item.startLine,
        endLine: item.endLine,
      });
    }
  };

  for (const paragraph of paragraphs) {
    if (carry) {
      const sameHeading = carry.heading === paragraph.heading;
      const combinedLength = carry.text.length + paragraph.text.length;
      if (sameHeading && combinedLength <= MAX_CHUNK_LENGTH) {
        emit({ ...carry, text: `${carry.text}${paragraph.text}`, endLine: paragraph.endLine });
        carry = null;
        continue;
      }
      if (carry.text.length < MIN_CHUNK_LENGTH && !chunks.length) {
        emit({ ...carry, text: `${carry.text}${paragraph.text}`, endLine: paragraph.endLine });
        carry = null;
        continue;
      }
      if (carry.text.length >= MIN_CHUNK_LENGTH) emit(carry);
      else if (chunks.length) {
        const last = chunks.at(-1);
        last.text += carry.text;
        last.endLine = carry.endLine;
      }
      carry = null;
    }
    emit(paragraph);
  }
  if (carry) {
    if (carry.text.length >= MIN_CHUNK_LENGTH) emit(carry);
    else if (chunks.length) {
      const last = chunks.at(-1);
      last.text += carry.text;
      last.endLine = carry.endLine;
    }
  }
  return chunks;
}

function parseBook(bytes, { extension, title }) {
  if (!['.txt', '.md'].includes(extension)) {
    const error = new Error('仅支持 TXT 和 Markdown 文件。');
    error.code = 'CORPUS_FORMAT_UNSUPPORTED';
    throw error;
  }
  const normalizedTitle = normalizeLine(title).slice(0, 120);
  if (!normalizedTitle) {
    const error = new Error('书名不能为空。');
    error.code = 'CORPUS_TITLE_REQUIRED';
    throw error;
  }
  const decoded = decodeBook(bytes);
  if (decoded.text.includes('�')) {
    const error = new Error('文件包含无法识别的替换字符。');
    error.code = 'CORPUS_ENCODING_INVALID';
    throw error;
  }
  const { rawLines, paragraphs } = paragraphsFromText(decoded.text, extension);
  const chunks = chunksFromParagraphs(paragraphs, normalizedTitle);
  if (!chunks.length) {
    const error = new Error(`正文过短，至少需要 ${MIN_CHUNK_LENGTH} 个有效字符。`);
    error.code = 'CORPUS_TEXT_TOO_SHORT';
    throw error;
  }
  const headings = new Set(chunks.map((chunk) => chunk.title.replace(/（续\d+）$/, '')));
  const charCount = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  return {
    encoding: decoded.encoding,
    contentHash: sha256(bytes),
    charCount,
    rawLineCount: rawLines.length,
    chapterCount: headings.size,
    chunks,
    samples: {
      first: chunks[0].text.slice(0, 240),
      last: chunks.at(-1).text.slice(-240),
    },
  };
}

module.exports = {
  MAX_CHUNK_LENGTH,
  MIN_CHUNK_LENGTH,
  classifyKnowledge,
  decodeBook,
  normalizeLine,
  parseBook,
  sha256,
};
