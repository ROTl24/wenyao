import {
  createTossFromValue,
  randomToss,
  type CoinFace,
  type LineValue,
  type Toss,
} from './divination';
import type { TraditionalCalendarContext } from './traditionalCalendar';

export type CastingMethod = 'digital' | 'physical' | 'random' | 'time';

export const CASTING_METHOD_LABELS: Record<CastingMethod, string> = {
  digital: '在线起卦',
  physical: '线下起卦',
  random: '随机起卦',
  time: '时间起卦',
};

export const CASTING_METHOD_DESCRIPTIONS: Record<CastingMethod, string> = {
  digital: '应用内完成六轮 3D 模拟投掷',
  physical: '摇实体铜钱后逐爻录入钱象',
  random: '安全随机一次生成完整六爻',
  time: '依梅花年月日时法推演成卦',
};

export interface CoinLineEvidence {
  faces: [CoinFace, CoinFace, CoinFace];
  visualSeed?: string;
}

export interface LineRecord {
  id: string;
  lineIndex: number;
  value: LineValue;
  recordedAt: string;
  coin?: CoinLineEvidence;
}

export interface PreparedCoinLine extends Toss {
  id: string;
  lineIndex: number;
  visualSeed: string;
}

export interface DigitalCastingBasis {
  kind: 'digital';
  algorithm: 'three_coin_secure_v1';
}

export interface PhysicalCastingBasis {
  kind: 'physical';
  algorithm: 'three_coin_manual_v1';
}

export interface RandomCastingBasis {
  kind: 'random';
  algorithm: 'three_coin_secure_batch_v1';
}

export interface TimeCastingBasis {
  kind: 'time';
  algorithm: 'time_meihua_lunar_v1';
  castAt: string;
  calendar: TraditionalCalendarContext;
  upperTrigramNumber: number;
  lowerTrigramNumber: number;
  movingLine: number;
}

export type CastingBasis =
  | DigitalCastingBasis
  | PhysicalCastingBasis
  | RandomCastingBasis
  | TimeCastingBasis;

interface CompletedCastingBase {
  lines: LineRecord[];
}

export interface PhysicalCompletedCasting extends CompletedCastingBase {
  method: 'physical';
  basis: PhysicalCastingBasis;
}

export interface RandomCompletedCasting extends CompletedCastingBase {
  method: 'random';
  basis: RandomCastingBasis;
}

export interface TimeCompletedCasting extends CompletedCastingBase {
  method: 'time';
  basis: TimeCastingBasis;
}

export type CompletedCasting =
  | PhysicalCompletedCasting
  | RandomCompletedCasting
  | TimeCompletedCasting;

export function normalizeCastingMethod(value: unknown): CastingMethod {
  if (value === 'digital' || value === 'physical' || value === 'random' || value === 'time') {
    return value;
  }
  throw new TypeError('起卦方式无效');
}

export function defaultCastingBasis(method: 'digital'): DigitalCastingBasis;
export function defaultCastingBasis(method: 'physical'): PhysicalCastingBasis;
export function defaultCastingBasis(method: 'random'): RandomCastingBasis;
export function defaultCastingBasis(method: CastingMethod): CastingBasis;
export function defaultCastingBasis(method: CastingMethod): CastingBasis {
  if (method === 'digital') return { kind: 'digital', algorithm: 'three_coin_secure_v1' };
  if (method === 'physical') return { kind: 'physical', algorithm: 'three_coin_manual_v1' };
  if (method === 'random') return { kind: 'random', algorithm: 'three_coin_secure_batch_v1' };
  throw new TypeError('时间起卦必须保存完整推导依据');
}

export function lineRecordFromToss(
  toss: Toss,
  lineIndex: number,
  recordedAt: string,
  visualSeed?: string,
): LineRecord {
  return {
    id: crypto.randomUUID(),
    lineIndex,
    value: toss.value,
    recordedAt,
    coin: {
      faces: [...toss.faces],
      ...(visualSeed ? { visualSeed } : {}),
    },
  };
}

export function tossForLine(line: Pick<LineRecord, 'value'>): Toss {
  return createTossFromValue(line.value);
}

export function generateRandomCasting(
  castAt = new Date(),
  tossSource: () => Toss = randomToss,
): RandomCompletedCasting {
  if (!Number.isFinite(castAt.getTime())) throw new TypeError('起卦时间无效');
  const recordedAt = castAt.toISOString();
  const lines = Array.from({ length: 6 }, (_, index) => (
    lineRecordFromToss(tossSource(), index + 1, recordedAt)
  ));
  return {
    method: 'random',
    basis: defaultCastingBasis('random'),
    lines,
  };
}
