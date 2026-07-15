import { Solar } from 'lunar-javascript';

export type CoinFace = 'text' | 'reverse';
export type LineValue = 6 | 7 | 8 | 9;
export type Element = '木' | '火' | '土' | '金' | '水';
export type SixRelation = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';
export type LineRole = '世' | '应' | null;
export type FuShenElementEffect = '比和' | '飞生伏' | '飞克伏' | '伏生飞' | '伏克飞';
export type FuShenStatus = '受扶倾向' | '冲飞待出' | '受制倾向' | '待结合旺衰';
export type PillarLabel = '年柱' | '月柱' | '日柱' | '时柱';
export type TwelveStage = '长生' | '沐浴' | '冠带' | '临官' | '帝旺' | '衰' | '病' | '死' | '墓' | '绝' | '胎' | '养';
export type ShenShaName = '驿马' | '桃花' | '日禄' | '天乙贵人';
export type ShenShaBasis = '日干' | '日支';
export type ElementRelation = '同类' | '生' | '克' | '被生' | '被克';
export type SeasonalStrength = '旺' | '相' | '休' | '囚' | '死';
export type DayClashKind = 'none' | 'hidden-movement' | 'day-break' | 'ordinary-clash';

export interface DayClashAssessment {
  kind: DayClashKind;
  seasonalStrength: SeasonalStrength;
  dayToLineElementRelation: ElementRelation;
}

export type SourceActivity = 'static' | 'explicit-moving' | 'hidden-moving';
export type BranchRelation = '六合' | '六冲' | 'none';
export type ActionEffect = '生' | '克' | '比和' | '合' | '冲';
export type HexagramSixRelation = 'six-harmony' | 'six-clash' | 'none';
export type HexagramTransition = 'clash-to-harmony' | 'harmony-to-clash' | 'clash-to-clash' | 'harmony-to-harmony' | 'none';

export interface BaseRelationFact {
  id: string;
  leftLineIndex: number;
  rightLineIndex: number;
  leftActivity: SourceActivity;
  rightActivity: SourceActivity;
  elementRelation: ElementRelation;
  branchRelation: BranchRelation;
}

export interface ActiveActionFact {
  id: string;
  sourceLineIndex: number;
  sourceActivity: Exclude<SourceActivity, 'static'>;
  targetKind: 'line' | 'hidden-spirit';
  targetLineIndex: number;
  targetGanZhi: string;
  elementRelation: ElementRelation;
  branchRelation: BranchRelation;
  effects: ActionEffect[];
}

export interface FuShenActiveAction {
  id: string;
  sourceLineIndex: number;
  sourceActivity: Exclude<SourceActivity, 'static'>;
  target: 'hidden-spirit' | 'flying-spirit';
  elementRelation: ElementRelation;
  branchRelation: BranchRelation;
  effects: ActionEffect[];
}

export interface TransformationReturnFact {
  id: string;
  lineIndex: number;
  fromGanZhi: string;
  toGanZhi: string;
  elementRelation: ElementRelation;
  branchRelation: BranchRelation;
  effects: ActionEffect[];
}

export interface TrigramRefrainFacts {
  guaFanYin: boolean;
  yaoFanYin: boolean;
  fuYin: boolean;
}

export interface HexagramDynamics {
  baseSixRelation: HexagramSixRelation;
  changedSixRelation: HexagramSixRelation;
  transition: HexagramTransition;
  inner: TrigramRefrainFacts;
  outer: TrigramRefrainFacts;
}

export interface LiuYaoRelationFacts {
  baseRelations: BaseRelationFact[];
  activeActions: ActiveActionFact[];
  transformationReturns: TransformationReturnFact[];
  hexagramDynamics: HexagramDynamics;
}

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

export interface CalendarPillar {
  label: PillarLabel;
  ganZhi: string;
  voidBranches: [string, string];
}

export interface LineTwelveStages {
  month: TwelveStage;
  day: TwelveStage;
  transformation: TwelveStage | null;
}

export interface ShenSha {
  name: ShenShaName;
  basis: ShenShaBasis;
  branches: string[];
  baseLineIndexes: number[];
  changedLineIndexes: number[];
}

export interface FuShen {
  lineIndex: number;
  sourcePalace: TrigramKey;
  sourceHexagram: string;
  relation: SixRelation;
  stem: string;
  branch: string;
  ganZhi: string;
  element: Element;
  seasonalStrength: SeasonalStrength;
  dayToHiddenElementRelation: ElementRelation;
  flyGanZhi: string;
  flyRelation: SixRelation;
  flyElement: Element;
  flyEffect: FuShenElementEffect;
  void: boolean;
  monthBreak: boolean;
  dayClash: boolean;
  monthCombine: boolean;
  dayCombine: boolean;
  flyVoid: boolean;
  flyMonthBreak: boolean;
  flyDayClash: boolean;
  flyMonthCombine: boolean;
  flyDayCombine: boolean;
  activeSourceActions: FuShenActiveAction[];
  activationFactors: string[];
  blockingFactors: string[];
  cautionFactors: string[];
  status: FuShenStatus;
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
  dayClashAssessment: DayClashAssessment;
  monthCombine: boolean;
  dayCombine: boolean;
  changedVoid: boolean;
  changedMonthBreak: boolean;
  changedDayClash: boolean;
  changedMonthCombine: boolean;
  changedDayCombine: boolean;
  role: LineRole;
  changedRole: LineRole;
  beast: string;
  twelveStages: LineTwelveStages;
}

export interface DivinationPlate {
  id: string;
  castAt: string;
  yearGanZhi: string;
  dayGanZhi: string;
  monthGanZhi: string;
  timeGanZhi: string;
  monthBranch: string;
  voidBranches: [string, string];
  pillars: CalendarPillar[];
  shenSha: ShenSha[];
  baseHexagram: Hexagram;
  changedHexagram: Hexagram;
  movingLines: number[];
  lines: PlateLine[];
  fuShen: FuShen[];
  relationFacts: LiuYaoRelationFacts;
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
const FAN_YIN_TRIGRAM: Record<TrigramKey, TrigramKey> = {
  乾: '巽', 巽: '乾', 坎: '离', 离: '坎', 震: '兑', 兑: '震', 坤: '艮', 艮: '坤',
};

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

const STEM_ELEMENTS: Record<string, Element> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const BRANCH_ELEMENTS: Record<string, Element> = {
  子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土',
};

export function elementOfStemBranch(symbol: string): Element | undefined {
  return STEM_ELEMENTS[symbol] ?? BRANCH_ELEMENTS[symbol];
}

const OPPOSITE_BRANCH: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const COMBINE_BRANCH: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };

const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const BEASTS = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武'];
const BEAST_START: Record<string, number> = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
const TWELVE_STAGES: TwelveStage[] = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const TWELVE_STAGE_START_BRANCH: Record<Element, string> = { 木: '亥', 火: '寅', 土: '申', 金: '巳', 水: '申' };
const TRAVEL_HORSE: Record<string, string> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
const PEACH_BLOSSOM: Record<string, string> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
const DAY_LU: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const NOBLE_PEOPLE: Record<string, string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['酉', '亥'], 丁: ['酉', '亥'],
  辛: ['寅', '午'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
};

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

function trigramLines(key: TrigramKey): [boolean, boolean, boolean] {
  const entry = Object.entries(TRIGRAM_BY_BITS).find(([, trigramKey]) => trigramKey === key);
  if (!entry) throw new Error(`无法映射三爻：${key}`);
  const code = Number(entry[0]);
  return [Boolean(code & 1), Boolean(code & 2), Boolean(code & 4)];
}

function getPalaceHexagram(palace: TrigramKey): Hexagram {
  const lines = trigramLines(palace);
  return getHexagram([...lines, ...lines]);
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

function elementRelation(from: Element, to: Element): ElementRelation {
  if (from === to) return '同类';
  if (GENERATES[from] === to) return '生';
  if (CONTROLS[from] === to) return '克';
  if (GENERATES[to] === from) return '被生';
  return '被克';
}

function seasonalStrength(lineElement: Element, monthElement: Element): SeasonalStrength {
  if (lineElement === monthElement) return '旺';
  if (GENERATES[monthElement] === lineElement) return '相';
  if (GENERATES[lineElement] === monthElement) return '休';
  if (CONTROLS[lineElement] === monthElement) return '囚';
  return '死';
}

function assessDayClash(
  lineElement: Element,
  monthBranch: string,
  dayGanZhi: string,
  moving: boolean,
  dayClash: boolean,
  monthBreak: boolean,
): DayClashAssessment {
  const strength = seasonalStrength(lineElement, BRANCH_ELEMENTS[monthBranch]);
  const dayRelation = elementRelation(BRANCH_ELEMENTS[dayGanZhi[1]], lineElement);
  if (!dayClash) return { kind: 'none', seasonalStrength: strength, dayToLineElementRelation: dayRelation };
  if (moving) {
    return { kind: 'ordinary-clash', seasonalStrength: strength, dayToLineElementRelation: dayRelation };
  }
  const seasonallyStrong = strength === '旺' || strength === '相';
  const daySupported = dayRelation === '生' || dayRelation === '同类';
  if (monthBreak && daySupported) {
    return { kind: 'ordinary-clash', seasonalStrength: strength, dayToLineElementRelation: dayRelation };
  }
  // 暗动既可由月令旺相成立，也可由日辰把休囚静爻扶起；月破时保留冲事实，不直接判暗动。
  return {
    kind: seasonallyStrong || daySupported ? 'hidden-movement' : 'day-break',
    seasonalStrength: strength,
    dayToLineElementRelation: dayRelation,
  };
}

function sourceActivity(line: PlateLine): SourceActivity {
  if (line.moving) return 'explicit-moving';
  return line.dayClashAssessment.kind === 'hidden-movement' ? 'hidden-moving' : 'static';
}

function branchRelation(left: string, right: string): BranchRelation {
  if (COMBINE_BRANCH[left] === right) return '六合';
  if (OPPOSITE_BRANCH[left] === right) return '六冲';
  return 'none';
}

function activeEffects(elementFact: ElementRelation, branchFact: BranchRelation): ActionEffect[] {
  const effects: ActionEffect[] = [];
  if (elementFact === '生') effects.push('生');
  if (elementFact === '克') effects.push('克');
  if (elementFact === '同类') effects.push('比和');
  if (branchFact === '六合') effects.push('合');
  if (branchFact === '六冲') effects.push('冲');
  return effects;
}

function sixRelationFor(branches: readonly string[]): HexagramSixRelation {
  const correspondingPairs = [[0, 3], [1, 4], [2, 5]] as const;
  if (correspondingPairs.every(([left, right]) => branchRelation(branches[left], branches[right]) === '六合')) {
    return 'six-harmony';
  }
  if (correspondingPairs.every(([left, right]) => branchRelation(branches[left], branches[right]) === '六冲')) {
    return 'six-clash';
  }
  return 'none';
}

function hexagramTransition(base: HexagramSixRelation, changed: HexagramSixRelation, hasMovingLines: boolean): HexagramTransition {
  if (!hasMovingLines) return 'none';
  if (base === 'six-clash' && changed === 'six-harmony') return 'clash-to-harmony';
  if (base === 'six-harmony' && changed === 'six-clash') return 'harmony-to-clash';
  if (base === 'six-clash' && changed === 'six-clash') return 'clash-to-clash';
  if (base === 'six-harmony' && changed === 'six-harmony') return 'harmony-to-harmony';
  return 'none';
}

function trigramRefrainFacts(
  baseTrigram: TrigramKey,
  changedTrigram: TrigramKey,
  lines: readonly PlateLine[],
): TrigramRefrainFacts {
  // 伏吟/反吟是动变关系；静卦本、之卦相同不能据此自动标成伏吟。
  const changed = lines.some((line) => line.moving);
  return {
    guaFanYin: changed && FAN_YIN_TRIGRAM[baseTrigram] === changedTrigram,
    yaoFanYin: changed && lines.every((line) => branchRelation(line.branch, line.changedBranch) === '六冲'),
    fuYin: changed && lines.every((line) => line.branch === line.changedBranch),
  };
}

function buildRelationFacts(
  baseHexagram: Hexagram,
  changedHexagram: Hexagram,
  lines: readonly PlateLine[],
  fuShen: readonly FuShen[],
): LiuYaoRelationFacts {
  const baseRelations: BaseRelationFact[] = [];
  for (let leftIndex = 0; leftIndex < lines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex += 1) {
      const left = lines[leftIndex];
      const right = lines[rightIndex];
      baseRelations.push({
        id: `base:${left.index}:${right.index}`,
        leftLineIndex: left.index,
        rightLineIndex: right.index,
        leftActivity: sourceActivity(left),
        rightActivity: sourceActivity(right),
        elementRelation: elementRelation(left.element, right.element),
        branchRelation: branchRelation(left.branch, right.branch),
      });
    }
  }

  const activeActions: ActiveActionFact[] = [];
  for (const source of lines.filter((line) => sourceActivity(line) !== 'static')) {
    const activity = sourceActivity(source) as Exclude<SourceActivity, 'static'>;
    for (const target of lines.filter((line) => line.index !== source.index)) {
      const elementFact = elementRelation(source.element, target.element);
      const branchFact = branchRelation(source.branch, target.branch);
      const effects = activeEffects(elementFact, branchFact);
      if (effects.length === 0) continue;
      activeActions.push({
        id: `active:${source.index}>${target.index}`,
        sourceLineIndex: source.index,
        sourceActivity: activity,
        targetKind: 'line',
        targetLineIndex: target.index,
        targetGanZhi: target.ganZhi,
        elementRelation: elementFact,
        branchRelation: branchFact,
        effects,
      });
    }
    for (const hidden of fuShen) {
      const hiddenAction = hidden.activeSourceActions.find((action) => (
        action.sourceLineIndex === source.index && action.target === 'hidden-spirit'
      ));
      if (!hiddenAction) continue;
      activeActions.push({
        id: hiddenAction.id,
        sourceLineIndex: source.index,
        sourceActivity: activity,
        targetKind: 'hidden-spirit',
        targetLineIndex: hidden.lineIndex,
        targetGanZhi: hidden.ganZhi,
        elementRelation: hiddenAction.elementRelation,
        branchRelation: hiddenAction.branchRelation,
        effects: hiddenAction.effects,
      });
    }
  }

  // 变爻只回头作用于自己的本位动爻，不建立跨爻作用边。
  const transformationReturns = lines.filter((line) => line.moving).map((line): TransformationReturnFact => {
    const elementFact = elementRelation(line.changedElement, line.element);
    const branchFact = branchRelation(line.changedBranch, line.branch);
    return {
      id: `return:${line.index}`,
      lineIndex: line.index,
      fromGanZhi: line.changedGanZhi,
      toGanZhi: line.ganZhi,
      elementRelation: elementFact,
      branchRelation: branchFact,
      effects: activeEffects(elementFact, branchFact),
    };
  });

  const baseSixRelation = sixRelationFor(lines.map((line) => line.branch));
  const changedSixRelation = sixRelationFor(lines.map((line) => line.changedBranch));
  const hasMovingLines = lines.some((line) => line.moving);
  return {
    baseRelations,
    activeActions,
    transformationReturns,
    hexagramDynamics: {
      baseSixRelation,
      changedSixRelation,
      transition: hexagramTransition(baseSixRelation, changedSixRelation, hasMovingLines),
      inner: trigramRefrainFacts(baseHexagram.lower.key, changedHexagram.lower.key, lines.slice(0, 3)),
      outer: trigramRefrainFacts(baseHexagram.upper.key, changedHexagram.upper.key, lines.slice(3, 6)),
    },
  };
}

function fuShenEffect(flyElement: Element, hiddenElement: Element): FuShenElementEffect {
  switch (elementRelation(flyElement, hiddenElement)) {
    case '同类': return '比和';
    case '生': return '飞生伏';
    case '克': return '飞克伏';
    case '被生': return '伏生飞';
    case '被克': return '伏克飞';
  }
}

function calendarElementFactors(source: Element | undefined, target: Element, label: string) {
  if (!source) return { support: [] as string[], blocking: [] as string[] };
  const relation = elementRelation(source, target);
  if (relation === '生') return { support: [`${label}生扶伏神`], blocking: [] };
  if (relation === '同类') return { support: [`${label}与伏神比和`], blocking: [] };
  if (relation === '克') return { support: [], blocking: [`${label}克伏神`] };
  return { support: [], blocking: [] };
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
  const calendar = calendarFields(new Date(plate.castAt));
  const dayBranch = calendar.dayGanZhi[1];
  const lines = plate.lines.map((line, zeroIndex) => {
    const index = zeroIndex + 1;
    const nakJia = nakJiaFields(plate.baseHexagram, plate.changedHexagram, zeroIndex);
    return {
      ...line,
      ...nakJia,
      ...lineCalendarFields(
        nakJia.branch,
        nakJia.changedBranch,
        calendar.monthBranch,
        calendar.dayGanZhi,
        calendar.voidBranches,
        nakJia.element,
        line.moving,
      ),
      role: roleAt(plate.baseHexagram, index),
      changedRole: roleAt(plate.changedHexagram, index),
      twelveStages: lineTwelveStages(nakJia.element, nakJia.changedBranch, calendar.monthBranch, dayBranch, line.moving),
    };
  });
  const fuShen = buildFuShen(plate.baseHexagram, lines, calendar);
  return {
    ...plate,
    ...calendar,
    lines,
    shenSha: commonShenSha(calendar.dayGanZhi, lines),
    fuShen,
    relationFacts: buildRelationFacts(plate.baseHexagram, plate.changedHexagram, lines, fuShen),
  };
}

function roleAt(hexagram: Hexagram, lineIndex: number): LineRole {
  if (lineIndex === hexagram.shiLine) return '世';
  if (lineIndex === hexagram.yingLine) return '应';
  return null;
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

function lineCalendarFields(
  branch: string,
  changedBranch: string,
  monthBranch: string,
  dayGanZhi: string,
  emptyBranches: readonly string[],
  element: Element,
  moving: boolean,
) {
  const base = branchCalendarEffects(branch, monthBranch, dayGanZhi, emptyBranches);
  const changed = branchCalendarEffects(changedBranch, monthBranch, dayGanZhi, emptyBranches);
  return {
    ...base,
    dayClashAssessment: assessDayClash(element, monthBranch, dayGanZhi, moving, base.dayClash, base.monthBreak),
    changedVoid: changed.void,
    changedMonthBreak: changed.monthBreak,
    changedDayClash: changed.dayClash,
    changedMonthCombine: changed.monthCombine,
    changedDayCombine: changed.dayCombine,
  };
}

function buildFuShen(
  baseHexagram: Hexagram,
  lines: readonly PlateLine[],
  calendar: { monthBranch: string; dayGanZhi: string; voidBranches: readonly string[] },
): FuShen[] {
  const palaceHexagram = getPalaceHexagram(baseHexagram.palace);
  const visibleRelations = new Set(lines.map((line) => line.relation));
  const monthElement = BRANCH_ELEMENTS[calendar.monthBranch];
  const dayElement = BRANCH_ELEMENTS[calendar.dayGanZhi[1]];

  return Array.from({ length: 6 }, (_, zeroIndex) => {
    const hiddenFields = nakJiaFields(palaceHexagram, palaceHexagram, zeroIndex);
    const flyLine = lines[zeroIndex];
    if (visibleRelations.has(hiddenFields.relation) || !flyLine) return null;

    const hiddenCalendar = branchCalendarEffects(hiddenFields.branch, calendar.monthBranch, calendar.dayGanZhi, calendar.voidBranches);
    const flyEffect = fuShenEffect(flyLine.element, hiddenFields.element);
    const monthFactors = calendarElementFactors(monthElement, hiddenFields.element, '月建');
    const dayFactors = calendarElementFactors(dayElement, hiddenFields.element, '日辰');
    const activeSourceActions = lines.flatMap((source): FuShenActiveAction[] => {
      const activity = sourceActivity(source);
      if (activity === 'static') return [];
      const targets = [
        { id: `active:${source.index}>hidden:${zeroIndex + 1}`, target: 'hidden-spirit' as const, element: hiddenFields.element, branch: hiddenFields.branch },
        ...(source.index === flyLine.index
          ? []
          : [{ id: `active:${source.index}>flying:${zeroIndex + 1}`, target: 'flying-spirit' as const, element: flyLine.element, branch: flyLine.branch }]),
      ];
      return targets.flatMap((target): FuShenActiveAction[] => {
        const elementFact = elementRelation(source.element, target.element);
        const branchFact = branchRelation(source.branch, target.branch);
        const effects = activeEffects(elementFact, branchFact);
        if (effects.length === 0) return [];
        return [{
          id: target.id,
          sourceLineIndex: source.index,
          sourceActivity: activity,
          target: target.target,
          elementRelation: elementFact,
          branchRelation: branchFact,
          effects,
        }];
      });
    });
    const actionSourceLabel = (action: FuShenActiveAction) => (
      `${action.sourceActivity === 'hidden-moving' ? '暗动爻' : '动爻'}${action.sourceLineIndex}`
    );
    const supportingHiddenActions = activeSourceActions.filter((action) => (
      action.target === 'hidden-spirit' && action.effects.some((effect) => effect === '生' || effect === '比和')
    ));
    const blockingHiddenActions = activeSourceActions.filter((action) => (
      action.target === 'hidden-spirit' && action.effects.includes('克')
    ));
    const releasingFlyingActions = activeSourceActions.filter((action) => (
      action.target === 'flying-spirit' && action.effects.some((effect) => effect === '克' || effect === '冲')
    ));
    const activationFactors = [
      ...monthFactors.support,
      ...dayFactors.support,
      ...(flyEffect === '飞生伏' || flyEffect === '比和' ? [`${flyEffect}`] : []),
      ...supportingHiddenActions.map((action) => `${actionSourceLabel(action)}${action.effects.includes('生') ? '生扶' : '比和扶持'}伏神`),
      ...(flyLine.void ? ['飞神旬空'] : []),
      ...(flyLine.monthBreak ? ['飞神月破'] : []),
      ...(flyLine.dayClash ? ['日辰冲飞神'] : []),
      ...releasingFlyingActions.map((action) => `${actionSourceLabel(action)}${action.effects.filter((effect) => effect === '克' || effect === '冲').join('、')}飞神`),
    ];
    const blockingFactors = [
      ...(flyEffect === '飞克伏' ? ['飞神克伏神'] : []),
      ...monthFactors.blocking,
      ...dayFactors.blocking,
      ...blockingHiddenActions.map((action) => `${actionSourceLabel(action)}克伏神`),
    ];
    const cautionFactors = [
      ...(hiddenCalendar.void ? ['伏神旬空'] : []),
      ...(hiddenCalendar.monthBreak ? ['伏神月破'] : []),
      ...(hiddenCalendar.dayClash ? ['日辰冲伏神'] : []),
      ...(sourceActivity(flyLine) === 'explicit-moving' ? ['飞神发动，需结合变爻'] : []),
      ...(sourceActivity(flyLine) === 'hidden-moving' ? ['飞神暗动，需结合飞伏作用'] : []),
      '旺相休囚、墓绝需结合完整月令规则',
    ];
    const flyingSpiritReleased = flyLine.void || flyLine.monthBreak || flyLine.dayClash || releasingFlyingActions.length > 0;
    const status: FuShenStatus = flyingSpiritReleased
      ? '冲飞待出'
      : blockingFactors.length > 0
        ? '受制倾向'
        : activationFactors.length > 0
          ? '受扶倾向'
          : '待结合旺衰';

    return {
      lineIndex: zeroIndex + 1,
      sourcePalace: baseHexagram.palace,
      sourceHexagram: palaceHexagram.name,
      relation: hiddenFields.relation,
      stem: hiddenFields.stem,
      branch: hiddenFields.branch,
      ganZhi: hiddenFields.ganZhi,
      element: hiddenFields.element,
      seasonalStrength: seasonalStrength(hiddenFields.element, monthElement),
      dayToHiddenElementRelation: elementRelation(dayElement, hiddenFields.element),
      flyGanZhi: flyLine.ganZhi,
      flyRelation: flyLine.relation,
      flyElement: flyLine.element,
      flyEffect,
      ...hiddenCalendar,
      flyVoid: flyLine.void,
      flyMonthBreak: flyLine.monthBreak,
      flyDayClash: flyLine.dayClash,
      flyMonthCombine: flyLine.monthCombine,
      flyDayCombine: flyLine.dayCombine,
      activeSourceActions,
      activationFactors,
      blockingFactors,
      cautionFactors,
      status,
    } satisfies FuShen;
  }).filter((item): item is FuShen => item !== null);
}

function voidBranches(dayGanZhi: string): [string, string] {
  const stemIndex = STEMS.indexOf(dayGanZhi[0]);
  const branchIndex = BRANCHES.indexOf(dayGanZhi[1]);
  const jiaStartBranch = (branchIndex - stemIndex + 12) % 12;
  const voidStart = (jiaStartBranch + 10) % 12;
  return [BRANCHES[voidStart], BRANCHES[(voidStart + 1) % 12]];
}

export function twelveStageFor(element: Element, branch: string): TwelveStage {
  const branchIndex = BRANCHES.indexOf(branch);
  if (branchIndex < 0) throw new Error(`无法计算十二长生：未知地支“${branch}”`);
  const startIndex = BRANCHES.indexOf(TWELVE_STAGE_START_BRANCH[element]);
  return TWELVE_STAGES[(branchIndex - startIndex + BRANCHES.length) % BRANCHES.length];
}

function lineTwelveStages(
  element: Element,
  changedBranch: string,
  monthBranch: string,
  dayBranch: string,
  moving: boolean,
): LineTwelveStages {
  return {
    month: twelveStageFor(element, monthBranch),
    day: twelveStageFor(element, dayBranch),
    transformation: moving ? twelveStageFor(element, changedBranch) : null,
  };
}

function commonShenSha(dayGanZhi: string, lines: PlateLine[]): ShenSha[] {
  const dayStem = dayGanZhi[0];
  const dayBranch = dayGanZhi[1];
  const definitions: Array<Pick<ShenSha, 'name' | 'basis' | 'branches'>> = [
    { name: '驿马', basis: '日支', branches: [TRAVEL_HORSE[dayBranch]] },
    { name: '桃花', basis: '日支', branches: [PEACH_BLOSSOM[dayBranch]] },
    { name: '日禄', basis: '日干', branches: [DAY_LU[dayStem]] },
    { name: '天乙贵人', basis: '日干', branches: [...NOBLE_PEOPLE[dayStem]] },
  ];
  return definitions.map((item) => ({
    ...item,
    baseLineIndexes: lines.filter((line) => item.branches.includes(line.branch)).map((line) => line.index),
    changedLineIndexes: lines
      .filter((line) => line.moving && item.branches.includes(line.changedBranch))
      .map((line) => line.index),
  }));
}

function calendarFields(castAt: Date) {
  const lunar = Solar.fromDate(castAt).getLunar();
  const yearGanZhi = lunar.getYearInGanZhiExact();
  const monthGanZhi = lunar.getMonthInGanZhiExact();
  const dayGanZhi = lunar.getDayInGanZhiExact();
  const timeGanZhi = lunar.getTimeInGanZhi();
  const pillars: CalendarPillar[] = [
    { label: '年柱', ganZhi: yearGanZhi, voidBranches: voidBranches(yearGanZhi) },
    { label: '月柱', ganZhi: monthGanZhi, voidBranches: voidBranches(monthGanZhi) },
    { label: '日柱', ganZhi: dayGanZhi, voidBranches: voidBranches(dayGanZhi) },
    { label: '时柱', ganZhi: timeGanZhi, voidBranches: voidBranches(timeGanZhi) },
  ];
  return {
    yearGanZhi,
    monthGanZhi,
    dayGanZhi,
    timeGanZhi,
    monthBranch: lunar.getMonthZhiExact(),
    voidBranches: pillars[2].voidBranches,
    pillars,
  };
}

export function buildPlate(values: readonly LineValue[], castAt: Date): DivinationPlate {
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
  const calendar = calendarFields(castAt);
  const { dayGanZhi, monthBranch, voidBranches: emptyBranches } = calendar;
  const dayBranch = dayGanZhi[1];
  const beastStart = BEAST_START[lunar.getDayGanExact()] ?? 0;
  const lines: PlateLine[] = tosses.map((toss, zeroIndex) => {
    const index = zeroIndex + 1;
    const nakJia = nakJiaFields(baseHexagram, changedHexagram, zeroIndex);
    return {
      ...toss,
      index,
      ...nakJia,
      ...lineCalendarFields(
        nakJia.branch,
        nakJia.changedBranch,
        monthBranch,
        dayGanZhi,
        emptyBranches,
        nakJia.element,
        toss.moving,
      ),
      role: roleAt(baseHexagram, index),
      changedRole: roleAt(changedHexagram, index),
      beast: BEASTS[(beastStart + zeroIndex) % 6],
      twelveStages: lineTwelveStages(nakJia.element, nakJia.changedBranch, monthBranch, dayBranch, toss.moving),
    };
  });
  const fuShen = buildFuShen(baseHexagram, lines, calendar);
  const shenSha = commonShenSha(dayGanZhi, lines);

  return {
    id: crypto.randomUUID(),
    castAt: castAt.toISOString(),
    ...calendar,
    baseHexagram,
    changedHexagram,
    movingLines: lines.filter((line) => line.moving).map((line) => line.index),
    lines,
    shenSha,
    fuShen,
    relationFacts: buildRelationFacts(baseHexagram, changedHexagram, lines, fuShen),
  };
}

export const coinConvention = {
  id: 'qianlong_text2_reverse3_v1',
  description: '乾隆通宝汉字面计 2，背面计 3；6/9 为动爻',
};
