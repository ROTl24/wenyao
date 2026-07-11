import { Solar } from 'lunar-javascript';

export type CoinFace = 'text' | 'reverse';
export type LineValue = 6 | 7 | 8 | 9;
export type Element = '木' | '火' | '土' | '金' | '水';
export type SixRelation = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';
export type LineRole = '世' | '应' | null;

export interface Toss {
  faces: [CoinFace, CoinFace, CoinFace];
  value: LineValue;
  label: '老阴' | '少阳' | '少阴' | '老阳';
  moving: boolean;
  baseYang: boolean;
  changedYang: boolean;
}

export type TrigramKey = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

export interface Trigram {
  key: TrigramKey;
  nature: string;
  element: Element;
  symbol: string;
}

export interface Hexagram {
  name: string;
  shortName: string;
  upper: Trigram;
  lower: Trigram;
  palace: TrigramKey;
  palaceElement: Element;
  generation: string;
  shiLine: number;
  yingLine: number;
}

export interface PlateLine extends Toss {
  index: number;
  stem: string;
  branch: string;
  ganZhi: string;
  element: Element;
  relation: SixRelation;
  changedStem: string;
  changedBranch: string;
  changedGanZhi: string;
  changedElement: Element;
  changedRelation: SixRelation;
  void: boolean;
  monthBreak: boolean;
  dayClash: boolean;
  monthCombine: boolean;
  dayCombine: boolean;
  changedVoid: boolean;
  changedMonthBreak: boolean;
  changedDayClash: boolean;
  changedMonthCombine: boolean;
  changedDayCombine: boolean;
  role: LineRole;
  beast: string;
}

export interface DivinationPlate {
  id: string;
  castAt: string;
  dayGanZhi: string;
  monthGanZhi: string;
  monthBranch: string;
  voidBranches: [string, string];
  baseHexagram: Hexagram;
  changedHexagram: Hexagram;
  movingLines: number[];
  lines: PlateLine[];
}

const TRIGRAMS: Record<TrigramKey, Trigram> = {
  乾: { key: '乾', nature: '天', element: '金', symbol: '☰' },
  兑: { key: '兑', nature: '泽', element: '金', symbol: '☱' },
  离: { key: '离', nature: '火', element: '火', symbol: '☲' },
  震: { key: '震', nature: '雷', element: '木', symbol: '☳' },
  巽: { key: '巽', nature: '风', element: '木', symbol: '☴' },
  坎: { key: '坎', nature: '水', element: '水', symbol: '☵' },
  艮: { key: '艮', nature: '山', element: '土', symbol: '☶' },
  坤: { key: '坤', nature: '地', element: '土', symbol: '☷' },
};

const TRIGRAM_BY_BITS: Record<number, TrigramKey> = {
  0: '坤', 1: '震', 2: '坎', 3: '兑', 4: '艮', 5: '离', 6: '巽', 7: '乾',
};

const HEXAGRAM_NAMES: Record<string, string> = {
  '乾-乾': '乾为天', '乾-兑': '天泽履', '乾-离': '天火同人', '乾-震': '天雷无妄', '乾-巽': '天风姤', '乾-坎': '天水讼', '乾-艮': '天山遁', '乾-坤': '天地否',
  '兑-乾': '泽天夬', '兑-兑': '兑为泽', '兑-离': '泽火革', '兑-震': '泽雷随', '兑-巽': '泽风大过', '兑-坎': '泽水困', '兑-艮': '泽山咸', '兑-坤': '泽地萃',
  '离-乾': '火天大有', '离-兑': '火泽睽', '离-离': '离为火', '离-震': '火雷噬嗑', '离-巽': '火风鼎', '离-坎': '火水未济', '离-艮': '火山旅', '离-坤': '火地晋',
  '震-乾': '雷天大壮', '震-兑': '雷泽归妹', '震-离': '雷火丰', '震-震': '震为雷', '震-巽': '雷风恒', '震-坎': '雷水解', '震-艮': '雷山小过', '震-坤': '雷地豫',
  '巽-乾': '风天小畜', '巽-兑': '风泽中孚', '巽-离': '风火家人', '巽-震': '风雷益', '巽-巽': '巽为风', '巽-坎': '风水涣', '巽-艮': '风山渐', '巽-坤': '风地观',
  '坎-乾': '水天需', '坎-兑': '水泽节', '坎-离': '水火既济', '坎-震': '水雷屯', '坎-巽': '水风井', '坎-坎': '坎为水', '坎-艮': '水山蹇', '坎-坤': '水地比',
  '艮-乾': '山天大畜', '艮-兑': '山泽损', '艮-离': '山火贲', '艮-震': '山雷颐', '艮-巽': '山风蛊', '艮-坎': '山水蒙', '艮-艮': '艮为山', '艮-坤': '山地剥',
  '坤-乾': '地天泰', '坤-兑': '地泽临', '坤-离': '地火明夷', '坤-震': '地雷复', '坤-巽': '地风升', '坤-坎': '地水师', '坤-艮': '地山谦', '坤-坤': '坤为地',
};

const PALACE_SEQUENCES: Record<TrigramKey, string[]> = {
  乾: ['乾', '姤', '遁', '否', '观', '剥', '晋', '大有'],
  坎: ['坎', '节', '屯', '既济', '革', '丰', '明夷', '师'],
  艮: ['艮', '贲', '大畜', '损', '睽', '履', '中孚', '渐'],
  震: ['震', '豫', '解', '恒', '升', '井', '大过', '随'],
  巽: ['巽', '小畜', '家人', '益', '无妄', '噬嗑', '颐', '蛊'],
  离: ['离', '旅', '鼎', '未济', '蒙', '涣', '讼', '同人'],
  坤: ['坤', '复', '临', '泰', '大壮', '夬', '需', '比'],
  兑: ['兑', '困', '萃', '咸', '蹇', '谦', '小过', '归妹'],
};

const GENERATIONS = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'];
const SHI_YING: Array<[number, number]> = [[6, 3], [1, 4], [2, 5], [3, 6], [4, 1], [5, 2], [4, 1], [3, 6]];

const INNER_BRANCHES: Record<TrigramKey, [string, string, string]> = {
  乾: ['子', '寅', '辰'], 兑: ['巳', '卯', '丑'], 离: ['卯', '丑', '亥'], 震: ['子', '寅', '辰'],
  巽: ['丑', '亥', '酉'], 坎: ['寅', '辰', '午'], 艮: ['辰', '午', '申'], 坤: ['未', '巳', '卯'],
};

const OUTER_BRANCHES: Record<TrigramKey, [string, string, string]> = {
  乾: ['午', '申', '戌'], 兑: ['亥', '酉', '未'], 离: ['酉', '未', '巳'], 震: ['午', '申', '戌'],
  巽: ['未', '巳', '卯'], 坎: ['申', '戌', '子'], 艮: ['戌', '子', '寅'], 坤: ['丑', '亥', '酉'],
};

const INNER_STEM: Record<TrigramKey, string> = { 乾: '甲', 坤: '乙', 震: '庚', 巽: '辛', 坎: '戊', 离: '己', 艮: '丙', 兑: '丁' };
const OUTER_STEM: Record<TrigramKey, string> = { 乾: '壬', 坤: '癸', 震: '庚', 巽: '辛', 坎: '戊', 离: '己', 艮: '丙', 兑: '丁' };

const BRANCH_ELEMENTS: Record<string, Element> = {
  子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土',
};
const OPPOSITE_BRANCH: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const COMBINE_BRANCH: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };

const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const BEASTS = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武'];
const BEAST_START: Record<string, number> = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');

function shortHexagramName(fullName: string): string {
  if (fullName.includes('为')) return fullName[0];
  return fullName.slice(2);
}

function trigramFromLines(lines: readonly boolean[]): Trigram {
  const code = Number(lines[0]) | (Number(lines[1]) << 1) | (Number(lines[2]) << 2);
  return TRIGRAMS[TRIGRAM_BY_BITS[code]];
}

function getPalace(shortName: string): { palace: TrigramKey; generationIndex: number } {
  for (const [palace, sequence] of Object.entries(PALACE_SEQUENCES) as Array<[TrigramKey, string[]]>) {
    const generationIndex = sequence.indexOf(shortName);
    if (generationIndex >= 0) return { palace, generationIndex };
  }
  throw new Error(`未找到卦宫：${shortName}`);
}

export function getHexagram(lines: readonly boolean[]): Hexagram {
  if (lines.length !== 6) throw new Error('六爻必须正好包含六条爻线');
  const lower = trigramFromLines(lines.slice(0, 3));
  const upper = trigramFromLines(lines.slice(3, 6));
  const name = HEXAGRAM_NAMES[`${upper.key}-${lower.key}`];
  if (!name) throw new Error('无法映射六十四卦');
  const shortName = shortHexagramName(name);
  const { palace, generationIndex } = getPalace(shortName);
  const [shiLine, yingLine] = SHI_YING[generationIndex];
  return {
    name,
    shortName,
    upper,
    lower,
    palace,
    palaceElement: TRIGRAMS[palace].element,
    generation: GENERATIONS[generationIndex],
    shiLine,
    yingLine,
  };
}

export function createToss(faces: readonly CoinFace[]): Toss {
  if (faces.length !== 3) throw new Error('每一爻必须使用三枚铜钱');
  const normalized = [...faces] as [CoinFace, CoinFace, CoinFace];
  let total = 0;
  for (const face of normalized) total += face === 'text' ? 2 : 3;
  const value = total as LineValue;
  const map: Record<LineValue, Omit<Toss, 'faces' | 'value'>> = {
    6: { label: '老阴', moving: true, baseYang: false, changedYang: true },
    7: { label: '少阳', moving: false, baseYang: true, changedYang: true },
    8: { label: '少阴', moving: false, baseYang: false, changedYang: false },
    9: { label: '老阳', moving: true, baseYang: true, changedYang: false },
  };
  return { faces: normalized, value, ...map[value] };
}

export function randomToss(): Toss {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return createToss(Array.from(bytes, (byte) => (byte & 1 ? 'reverse' : 'text')) as CoinFace[]);
}

function relationOf(lineElement: Element, palaceElement: Element): SixRelation {
  if (lineElement === palaceElement) return '兄弟';
  if (GENERATES[lineElement] === palaceElement) return '父母';
  if (GENERATES[palaceElement] === lineElement) return '子孙';
  if (CONTROLS[lineElement] === palaceElement) return '官鬼';
  return '妻财';
}

function nakJiaFields(baseHexagram: Hexagram, changedHexagram: Hexagram, zeroIndex: number) {
  const inner = zeroIndex < 3;
  const trigramIndex = zeroIndex % 3;
  const baseTrigram = inner ? baseHexagram.lower.key : baseHexagram.upper.key;
  const changedTrigram = inner ? changedHexagram.lower.key : changedHexagram.upper.key;
  const stem = inner ? INNER_STEM[baseTrigram] : OUTER_STEM[baseTrigram];
  const changedStem = inner ? INNER_STEM[changedTrigram] : OUTER_STEM[changedTrigram];
  const branch = (inner ? INNER_BRANCHES[baseTrigram] : OUTER_BRANCHES[baseTrigram])[trigramIndex];
  const changedBranch = (inner ? INNER_BRANCHES[changedTrigram] : OUTER_BRANCHES[changedTrigram])[trigramIndex];
  const element = BRANCH_ELEMENTS[branch];
  const changedElement = BRANCH_ELEMENTS[changedBranch];
  return {
    stem, branch, ganZhi: `${stem}${branch}`, element, relation: relationOf(element, baseHexagram.palaceElement),
    changedStem, changedBranch, changedGanZhi: `${changedStem}${changedBranch}`, changedElement,
    changedRelation: relationOf(changedElement, baseHexagram.palaceElement),
  };
}

export function upgradePlate(plate: DivinationPlate): DivinationPlate {
  return {
    ...plate,
    lines: plate.lines.map((line, zeroIndex) => {
      const nakJia = nakJiaFields(plate.baseHexagram, plate.changedHexagram, zeroIndex);
      return { ...line, ...nakJia, ...lineCalendarFields(nakJia.branch, nakJia.changedBranch, plate.monthBranch, plate.dayGanZhi, plate.voidBranches) };
    }),
  };
}

export function branchCalendarEffects(branch: string, monthBranch: string, dayGanZhi: string, emptyBranches: readonly string[]) {
  const dayBranch = dayGanZhi[1];
  return {
    void: emptyBranches.includes(branch),
    monthBreak: OPPOSITE_BRANCH[branch] === monthBranch,
    dayClash: OPPOSITE_BRANCH[branch] === dayBranch,
    monthCombine: COMBINE_BRANCH[branch] === monthBranch,
    dayCombine: COMBINE_BRANCH[branch] === dayBranch,
  };
}

function lineCalendarFields(branch: string, changedBranch: string, monthBranch: string, dayGanZhi: string, emptyBranches: readonly string[]) {
  const base = branchCalendarEffects(branch, monthBranch, dayGanZhi, emptyBranches);
  const changed = branchCalendarEffects(changedBranch, monthBranch, dayGanZhi, emptyBranches);
  return {
    ...base,
    changedVoid: changed.void,
    changedMonthBreak: changed.monthBreak,
    changedDayClash: changed.dayClash,
    changedMonthCombine: changed.monthCombine,
    changedDayCombine: changed.dayCombine,
  };
}

function voidBranches(dayGanZhi: string): [string, string] {
  const stemIndex = STEMS.indexOf(dayGanZhi[0]);
  const branchIndex = BRANCHES.indexOf(dayGanZhi[1]);
  const jiaStartBranch = (branchIndex - stemIndex + 12) % 12;
  const voidStart = (jiaStartBranch + 10) % 12;
  return [BRANCHES[voidStart], BRANCHES[(voidStart + 1) % 12]];
}

export function buildPlate(
  values: readonly LineValue[],
  castAt: Date,
  plateId: string = crypto.randomUUID(),
): DivinationPlate {
  if (values.length !== 6) throw new Error('排盘需要六次已确认爻值');
  const tosses = values.map((value) => {
    const faces: Record<LineValue, CoinFace[]> = {
      6: ['text', 'text', 'text'],
      7: ['text', 'text', 'reverse'],
      8: ['text', 'reverse', 'reverse'],
      9: ['reverse', 'reverse', 'reverse'],
    };
    return createToss(faces[value]);
  });
  const baseBits = tosses.map((toss) => toss.baseYang);
  const changedBits = tosses.map((toss) => toss.changedYang);
  const baseHexagram = getHexagram(baseBits);
  const changedHexagram = getHexagram(changedBits);
  const lunar = Solar.fromDate(castAt).getLunar();
  const dayGanZhi = lunar.getDayInGanZhiExact();
  const monthGanZhi = lunar.getMonthInGanZhiExact();
  const monthBranch = lunar.getMonthZhiExact();
  const emptyBranches = voidBranches(dayGanZhi);
  const beastStart = BEAST_START[lunar.getDayGanExact()] ?? 0;
  const lines: PlateLine[] = tosses.map((toss, zeroIndex) => {
    const index = zeroIndex + 1;
    const role: LineRole = index === baseHexagram.shiLine ? '世' : index === baseHexagram.yingLine ? '应' : null;
    const nakJia = nakJiaFields(baseHexagram, changedHexagram, zeroIndex);
    return {
      ...toss,
      index,
      ...nakJia,
      ...lineCalendarFields(nakJia.branch, nakJia.changedBranch, monthBranch, dayGanZhi, emptyBranches),
      role,
      beast: BEASTS[(beastStart + zeroIndex) % 6],
    };
  });

  return {
    id: plateId,
    castAt: castAt.toISOString(),
    dayGanZhi,
    monthGanZhi,
    monthBranch,
    voidBranches: emptyBranches,
    baseHexagram,
    changedHexagram,
    movingLines: lines.filter((line) => line.moving).map((line) => line.index),
    lines,
  };
}

export const coinConvention = {
  id: 'qianlong_text2_reverse3_v1',
  description: '乾隆通宝汉字面计 2，背面计 3；6/9 为动爻',
};
