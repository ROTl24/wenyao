import { buildPlate, type DivinationPlate, type Toss } from './divination';
import type { AnalysisReport } from './types';

export type SessionCategory = 'career' | 'wealth' | 'relationship' | 'health' | 'study' | 'lost_item' | 'travel' | 'other';
export type SessionStatus = 'casting' | 'complete';
export type CastingMethod = 'digital' | 'physical';

export const CASTING_METHOD_LABELS: Record<CastingMethod, string> = {
  digital: '在线起卦',
  physical: '线下起卦',
};

export function normalizeCastingMethod(value: unknown): CastingMethod {
  if (value === 'digital' || value === 'physical') return value;
  throw new TypeError('起卦方式无效');
}

export interface TossRecord extends Toss {
  id: string;
  lineIndex: number;
  visualSeed?: string;
  confirmedAt: string;
}

export interface PreparedToss extends Toss {
  id: string;
  lineIndex: number;
  visualSeed: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  kind?: 'markdown-answer' | 'system-notice';
  content: string;
  createdAt: string;
}

export interface DivinationSession {
  id: string;
  question: string;
  category: SessionCategory;
  castingMethod: CastingMethod;
  castAt: string;
  updatedAt: string;
  status: SessionStatus;
  tosses: TossRecord[];
  currentToss?: PreparedToss;
  plate?: DivinationPlate;
  analysis?: AnalysisReport;
  messages: ChatMessage[];
}

export function normalizeSession(session: DivinationSession): DivinationSession {
  const hasCastingMethod = Object.prototype.hasOwnProperty.call(session, 'castingMethod');
  return {
    ...session,
    castingMethod: hasCastingMethod ? normalizeCastingMethod(session.castingMethod) : 'digital',
  };
}

export function createSession(
  question: string,
  category: SessionCategory,
  castAt = new Date(),
  castingMethod: CastingMethod = 'digital',
): DivinationSession {
  const iso = castAt.toISOString();
  return {
    id: crypto.randomUUID(),
    question: question.trim(),
    category,
    castingMethod,
    castAt: iso,
    updatedAt: iso,
    status: 'casting',
    tosses: [],
    messages: [],
  };
}

export function prepareToss(
  session: DivinationSession,
  toss: Toss,
  visualSeed: string,
): DivinationSession {
  if (
    session.castingMethod !== 'digital'
    || session.status === 'complete'
    || session.tosses.length >= 6
    || session.currentToss
  ) return session;
  return {
    ...session,
    currentToss: {
      ...toss,
      id: crypto.randomUUID(),
      lineIndex: session.tosses.length + 1,
      visualSeed,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function confirmCurrentToss(session: DivinationSession): DivinationSession {
  if (session.castingMethod !== 'digital' || session.status === 'complete' || !session.currentToss) return session;
  const confirmed: TossRecord = {
    ...session.currentToss,
    confirmedAt: new Date().toISOString(),
  };
  const tosses = [...session.tosses, confirmed];
  const complete = tosses.length === 6;
  return {
    ...session,
    tosses,
    currentToss: undefined,
    status: complete ? 'complete' : 'casting',
    plate: complete ? buildPlate(tosses.map((item) => item.value), new Date(session.castAt)) : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function withAnalysis(session: DivinationSession, analysis: AnalysisReport): DivinationSession {
  return { ...session, analysis, updatedAt: new Date().toISOString() };
}

export function withMessage(session: DivinationSession, message: ChatMessage): DivinationSession {
  return { ...session, messages: [...session.messages, message], updatedAt: new Date().toISOString() };
}
