import { buildPlate, type DivinationPlate, type Toss } from './divination';
import type { DivinationCaseV2 } from '../domain/liuyao/model';
import type { RuleContext } from '../domain/liuyao/rules/model';
import type {
  AnalysisReport,
  ValidatedAnalysisBundleV2,
  ValidatedFollowUpBundleV2,
} from './types';

export type SessionCategory = 'career' | 'wealth' | 'relationship' | 'health' | 'study' | 'lost_item' | 'travel' | 'other';
export type SessionStatus = 'casting' | 'complete';

const SESSION_CATEGORIES = new Set<SessionCategory>([
  'career',
  'wealth',
  'relationship',
  'health',
  'study',
  'lost_item',
  'travel',
  'other',
]);

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

export interface AdvanceCurrentTossTransaction {
  at: string;
  plateId: string;
  next?: {
    toss: Toss;
    visualSeed: string;
    id: string;
  };
}

export interface LegacyChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidenceIds?: string[];
  createdAt: string;
  schemaVersion?: never;
  caseHash?: never;
  followUpBundle?: never;
}

export interface UserChatMessageV2 {
  readonly schemaVersion: '2.0.0';
  readonly id: string;
  readonly role: 'user';
  readonly content: string;
  readonly caseHash: string;
  readonly createdAt: string;
}

export interface AssistantChatMessageV2 {
  readonly schemaVersion: '2.0.0';
  readonly id: string;
  readonly role: 'assistant';
  readonly content: string;
  readonly caseHash: string;
  readonly followUpBundle: ValidatedFollowUpBundleV2;
  readonly createdAt: string;
}

export type ChatMessage = LegacyChatMessage | UserChatMessageV2 | AssistantChatMessageV2;

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
  caseSnapshot?: DivinationCaseV2;
  ruleContext?: RuleContext;
  migrationVersion?: 2;
  migrationState?: 'clean' | 'needs-review';
  caseRuntimeTrust?: 'authoritative' | 'browser-preview';
  interactionRevision?: number;
  authoritativeRevision?: number;
  /** Legacy quarantine only; never treat this field as a validated cache. */
  analysis?: AnalysisReport;
  analysisBundle?: ValidatedAnalysisBundleV2;
  messages: ChatMessage[];
}

function exactIso(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export function normalizeSessionIdentity(value: unknown): Pick<DivinationSession, 'id' | 'question' | 'category' | 'castAt'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('会话数据无效');
  const candidate = value as Record<string, unknown>;
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
  if (
    typeof candidate.id !== 'string'
    || !candidate.id.trim()
    || candidate.id !== candidate.id.trim()
    || !question
    || question.length > 500
    || typeof candidate.category !== 'string'
    || !SESSION_CATEGORIES.has(candidate.category as SessionCategory)
    || !exactIso(candidate.castAt)
  ) throw new TypeError('会话数据无效');
  return {
    id: candidate.id,
    question,
    category: candidate.category as SessionCategory,
    castAt: candidate.castAt,
  };
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
  identity: { id?: string; at?: string } = {},
): DivinationSession {
  if (session.status === 'complete' || session.tosses.length >= 6 || session.currentToss) return session;
  return {
    ...session,
    currentToss: {
      ...toss,
      id: identity.id ?? crypto.randomUUID(),
      lineIndex: session.tosses.length + 1,
      visualSeed,
    },
    updatedAt: identity.at ?? new Date().toISOString(),
  };
}

export function confirmCurrentToss(
  session: DivinationSession,
  confirmedAt = new Date().toISOString(),
  plateId?: string,
): DivinationSession {
  if (session.status === 'complete' || !session.currentToss) return session;
  const confirmed: TossRecord = {
    ...session.currentToss,
    confirmedAt,
  };
  const tosses = [...session.tosses, confirmed];
  const complete = tosses.length === 6;
  return {
    ...session,
    tosses,
    currentToss: undefined,
    status: complete ? 'complete' : 'casting',
    plate: complete
      ? buildPlate(tosses.map((item) => item.value), new Date(session.castAt), plateId)
      : undefined,
    updatedAt: confirmedAt,
  };
}

export function advanceCurrentToss(
  session: DivinationSession,
  expectedTossId: string,
  transaction: AdvanceCurrentTossTransaction,
): DivinationSession {
  if (session.currentToss?.id !== expectedTossId) return session;

  const confirmed = confirmCurrentToss(session, transaction.at, transaction.plateId);
  if (confirmed.status === 'complete' || !transaction.next) return confirmed;

  return prepareToss(
    confirmed,
    transaction.next.toss,
    transaction.next.visualSeed,
    { id: transaction.next.id, at: transaction.at },
  );
}

export function withAnalysis(session: DivinationSession, analysis: AnalysisReport): DivinationSession {
  return { ...session, analysis, updatedAt: new Date().toISOString() };
}

export function withMessage(session: DivinationSession, message: ChatMessage): DivinationSession {
  return { ...session, messages: [...session.messages, message], updatedAt: new Date().toISOString() };
}
