import { buildPlate, type DivinationPlate, type Toss } from './divination';
import type { AnalysisReport } from './types';

export type SessionCategory = 'career' | 'wealth' | 'relationship' | 'health' | 'study' | 'lost_item' | 'travel' | 'other';
export type SessionStatus = 'casting' | 'complete';

export interface TossRecord extends Toss {
  id: string;
  lineIndex: number;
  visualSeed: string;
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
  content: string;
  evidenceIds?: string[];
  createdAt: string;
}

export interface DivinationSession {
  id: string;
  question: string;
  category: SessionCategory;
  castAt: string;
  updatedAt: string;
  status: SessionStatus;
  tosses: TossRecord[];
  currentToss?: PreparedToss;
  plate?: DivinationPlate;
  analysis?: AnalysisReport;
  messages: ChatMessage[];
}

export function isValidQuestion(question: string): boolean {
  const length = question.trim().length;
  return length > 0 && length <= 500;
}

export function createSession(
  question: string,
  category: SessionCategory,
  castAt = new Date(),
): DivinationSession {
  const iso = castAt.toISOString();
  return {
    id: crypto.randomUUID(),
    question: question.trim(),
    category,
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
  if (session.status === 'complete' || session.tosses.length >= 6 || session.currentToss) return session;
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
  if (session.status === 'complete' || !session.currentToss) return session;
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
