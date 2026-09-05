import { buildPlate, createToss, upgradePlate, type DivinationPlate, type LineValue, type Toss } from './divination';
import {
  CASTING_METHOD_LABELS,
  defaultCastingBasis,
  lineRecordFromToss,
  normalizeCastingMethod,
  type CastingBasis,
  type CastingMethod,
  type CompletedCasting,
  type LineRecord,
  type PreparedCoinLine,
} from './casting';
import type { AnalysisEvidenceSnapshot, AnalysisReport } from './types';

export {
  CASTING_METHOD_LABELS,
  normalizeCastingMethod,
  type CastingBasis,
  type CastingMethod,
  type LineRecord,
  type PreparedCoinLine,
} from './casting';

export type SessionCategory = 'career' | 'wealth' | 'relationship' | 'health' | 'study' | 'lost_item' | 'travel' | 'other';
export type SessionStatus = 'casting' | 'complete';

export interface SessionReview {
  status: 'pending' | 'happened' | 'unclear';
  observedAt: string;
  note: string;
  tags: string[];
  updatedAt: string;
}

export interface GenerationDraft {
  requestId: string;
  kind: 'analysis' | 'followUp';
  evidenceSnapshot?: AnalysisEvidenceSnapshot;
  status: 'stopped' | 'failed';
  content: string;
  question: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  kind?: 'markdown-answer' | 'system-notice';
  content: string;
  createdAt: string;
  evidenceSnapshot?: AnalysisEvidenceSnapshot;
  provider?: AnalysisReport['provider'];
}

export interface DivinationSession {
  schemaVersion: 2;
  id: string;
  question: string;
  category: SessionCategory;
  castingMethod: CastingMethod;
  castingBasis: CastingBasis;
  castAt: string;
  updatedAt: string;
  status: SessionStatus;
  lines: LineRecord[];
  currentLine?: PreparedCoinLine;
  plate?: DivinationPlate;
  analysis?: AnalysisReport;
  messages: ChatMessage[];
  review?: SessionReview;
  generationDraft?: GenerationDraft | null;
}

const LINE_VALUES = new Set<LineValue>([6, 7, 8, 9]);

function canonicalPlate(session: DivinationSession): DivinationPlate | undefined {
  if (session.plate) return upgradePlate(session.plate);
  const castAt = new Date(session.castAt);
  const replayable = session.status === 'complete'
    && session.lines.length === 6
    && Number.isFinite(castAt.getTime())
    && session.lines.every((line, index) => (
      line.lineIndex === index + 1 && LINE_VALUES.has(line.value)
    ));
  return replayable
    ? buildPlate(session.lines.map((line) => line.value), castAt)
    : undefined;
}

function withCanonicalPlate(session: DivinationSession): DivinationSession {
  const plate = canonicalPlate(session);
  return plate ? { ...session, plate } : session;
}

function legacyLine(toss: Record<string, unknown>, index: number): LineRecord {
  const faces = Array.isArray(toss.faces) ? toss.faces : [];
  const value = Number(toss.value);
  const normalizedToss = createToss(faces as Toss['faces']);
  if (normalizedToss.value !== value) throw new TypeError('投币历史冲突');
  return {
    id: String(toss.id || ''),
    lineIndex: Number(toss.lineIndex || index + 1),
    value: normalizedToss.value,
    recordedAt: String(toss.confirmedAt || ''),
    coin: {
      faces: [...normalizedToss.faces],
      ...(typeof toss.visualSeed === 'string' ? { visualSeed: toss.visualSeed } : {}),
    },
  };
}

export function normalizeSession(session: DivinationSession | Record<string, unknown>): DivinationSession {
  const source = structuredClone(session) as Record<string, unknown>;
  const hasCastingMethod = Object.prototype.hasOwnProperty.call(source, 'castingMethod');
  const castingMethod = hasCastingMethod ? normalizeCastingMethod(source.castingMethod) : 'digital';
  if (source.schemaVersion === 2 && Array.isArray(source.lines)) {
    return withCanonicalPlate({
      ...(source as unknown as DivinationSession),
      castingMethod,
      castingBasis: source.castingBasis as CastingBasis ?? defaultCastingBasis(castingMethod),
    });
  }

  const legacyTosses = Array.isArray(source.tosses) ? source.tosses : [];
  const lines = legacyTosses.map((toss, index) => legacyLine(toss as Record<string, unknown>, index));
  const currentToss = source.currentToss as Record<string, unknown> | undefined;
  const currentLine = currentToss ? {
    ...createToss(currentToss.faces as Toss['faces']),
    id: String(currentToss.id || ''),
    lineIndex: Number(currentToss.lineIndex),
    visualSeed: String(currentToss.visualSeed || ''),
  } : undefined;
  const {
    tosses: _tosses,
    currentToss: _currentToss,
    ...canonical
  } = source;
  return withCanonicalPlate({
    ...(canonical as unknown as Omit<DivinationSession, 'schemaVersion' | 'castingMethod' | 'castingBasis' | 'lines'>),
    schemaVersion: 2,
    castingMethod,
    castingBasis: defaultCastingBasis(castingMethod),
    lines,
    ...(currentLine ? { currentLine } : {}),
  });
}

export function createSession(
  question: string,
  category: SessionCategory,
  castAt = new Date(),
  castingMethod: CastingMethod = 'digital',
  castingBasis?: CastingBasis,
): DivinationSession {
  const iso = castAt.toISOString();
  const basis = castingBasis ?? defaultCastingBasis(castingMethod);
  if (basis.kind !== castingMethod) throw new TypeError('起卦方式与推导依据不一致');
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    question: question.trim(),
    category,
    castingMethod,
    castingBasis: basis,
    castAt: iso,
    updatedAt: iso,
    status: 'casting',
    lines: [],
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
    || session.lines.length >= 6
    || session.currentLine
  ) return session;
  return {
    ...session,
    currentLine: {
      ...toss,
      id: crypto.randomUUID(),
      lineIndex: session.lines.length + 1,
      visualSeed,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function confirmCurrentToss(session: DivinationSession): DivinationSession {
  if (session.castingMethod !== 'digital' || session.status === 'complete' || !session.currentLine) return session;
  const confirmed = lineRecordFromToss(
    session.currentLine,
    session.currentLine.lineIndex,
    new Date().toISOString(),
    session.currentLine.visualSeed,
  );
  const lines = [...session.lines, { ...confirmed, id: session.currentLine.id }];
  const complete = lines.length === 6;
  return {
    ...session,
    lines,
    currentLine: undefined,
    status: complete ? 'complete' : 'casting',
    plate: complete ? buildPlate(lines.map((item) => item.value), new Date(session.castAt)) : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function createCompletedSession(
  question: string,
  category: SessionCategory,
  castAt: Date,
  casting: CompletedCasting,
  completedAt = new Date(),
): DivinationSession {
  if (casting.lines.length !== 6) throw new Error('必须生成完整六爻后才能排盘');
  const session = createSession(question, category, castAt, casting.method, casting.basis);
  return {
    ...session,
    castingBasis: casting.basis,
    lines: structuredClone(casting.lines),
    status: 'complete',
    plate: buildPlate(casting.lines.map((line) => line.value), castAt),
    updatedAt: completedAt.toISOString(),
  };
}

export function withAnalysis(session: DivinationSession, analysis: AnalysisReport): DivinationSession {
  return { ...session, analysis, updatedAt: new Date().toISOString() };
}

export function withMessage(session: DivinationSession, message: ChatMessage): DivinationSession {
  return { ...session, messages: [...session.messages, message], updatedAt: new Date().toISOString() };
}
