import { History, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { HomeScreen } from './components/HomeScreen';
import { ResultScreen } from './components/ResultScreen';
import { RitualScreen } from './components/RitualScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { legacyPlateFromCase } from './lib/casePresentation';
import { desktop } from './lib/desktop';
import { randomToss } from './lib/divination';
import { createElectronReadingClient, type ReadingCaseEnvelope } from './lib/readingClient';
import type { EvidenceEntry, RetrievalDiagnostics } from './lib/retrieval';
import {
  advanceCurrentToss,
  createSession,
  isValidQuestion,
  prepareToss,
  type AdvanceCurrentTossTransaction,
  type ChatMessage,
  type DivinationSession,
  type SessionCategory,
} from './lib/session';
import type { AnalysisReport } from './lib/types';

type Screen = 'home' | 'casting' | 'building-case' | 'result' | 'review-error';

interface ConfirmCommitCommand {
  id: string;
  session: DivinationSession;
  owner: SessionOwner;
}

interface SessionOwner {
  sessionId: string;
  epoch: number;
}

interface AppFlowState {
  screen: Screen;
  session: DivinationSession | null;
  pendingConfirmCommit: ConfirmCommitCommand | null;
  caseBuildOperationId: string | null;
  analysisOperationId: string | null;
  followUpOperationId: string | null;
  epoch: number;
}

type AppFlowAction =
  | { type: 'OPEN_SESSION'; screen: Screen; session: DivinationSession | null }
  | {
    type: 'ADVANCE_TOSS';
    commandId: string;
    expectedTossId: string;
    transaction: AdvanceCurrentTossTransaction;
  }
  | { type: 'CONSUME_CONFIRM_COMMIT'; id: string }
  | { type: 'BEGIN_CASE_BUILD'; owner: SessionOwner; operationId: string }
  | {
    type: 'APPLY_CASE_BUILD';
    owner: SessionOwner;
    operationId: string;
    session: DivinationSession;
  }
  | { type: 'END_CASE_BUILD'; owner: SessionOwner; operationId: string }
  | { type: 'BEGIN_ANALYSIS'; owner: SessionOwner; operationId: string }
  | {
    type: 'APPLY_ANALYSIS';
    owner: SessionOwner;
    operationId: string;
    analysis: AnalysisReport;
  }
  | { type: 'END_ANALYSIS'; owner: SessionOwner; operationId: string }
  | {
    type: 'BEGIN_FOLLOW_UP';
    owner: SessionOwner;
    operationId: string;
  }
  | {
    type: 'RESOLVE_FOLLOW_UP';
    owner: SessionOwner;
    operationId: string;
    messages: ChatMessage[];
  }
  | { type: 'END_FOLLOW_UP'; owner: SessionOwner; operationId: string };

const initialAppFlowState: AppFlowState = {
  screen: 'home',
  session: null,
  pendingConfirmCommit: null,
  caseBuildOperationId: null,
  analysisOperationId: null,
  followUpOperationId: null,
  epoch: 0,
};

function latestTimestamp(current: string, candidate: string): string {
  return current > candidate ? current : candidate;
}

function ownerMatches(state: AppFlowState, owner: SessionOwner): boolean {
  return state.epoch === owner.epoch && state.session?.id === owner.sessionId;
}

function sessionProgress(session: DivinationSession): number {
  return (session.caseSnapshot ? 10_000 : 0)
    + Number(session.authoritativeRevision || 0) * 1_000
    + session.tosses.length * 100
    + (session.status === 'complete' ? 50 : 0)
    + (session.analysis ? 10 : 0)
    + session.messages.length;
}

export function mergeSavedSession(
  history: DivinationSession[],
  saved: DivinationSession,
): DivinationSession[] {
  const existing = history.find((item) => item.id === saved.id);
  if (existing?.caseSnapshot && !saved.caseSnapshot) return history;
  if (
    existing
    && !(saved.caseSnapshot && !existing.caseSnapshot)
    && (
      existing.updatedAt > saved.updatedAt
      || (
        existing.updatedAt === saved.updatedAt
        && sessionProgress(existing) > sessionProgress(saved)
      )
    )
  ) return history;
  return [saved, ...history.filter((item) => item.id !== saved.id)];
}

export function appFlowReducer(state: AppFlowState, action: AppFlowAction): AppFlowState {
  switch (action.type) {
    case 'OPEN_SESSION':
      return {
        ...state,
        screen: action.screen,
        session: action.session,
        caseBuildOperationId: null,
        analysisOperationId: null,
        followUpOperationId: null,
        epoch: state.epoch + 1,
      };
    case 'ADVANCE_TOSS': {
      if (state.screen !== 'casting' || !state.session) return state;
      const next = advanceCurrentToss(
        state.session,
        action.expectedTossId,
        action.transaction,
      );
      if (next === state.session) return state;
      return {
        ...state,
        screen: next.status === 'complete' ? 'building-case' : 'casting',
        session: next,
        pendingConfirmCommit: {
          id: action.commandId,
          session: next,
          owner: { sessionId: state.session.id, epoch: state.epoch },
        },
      };
    }
    case 'CONSUME_CONFIRM_COMMIT':
      return state.pendingConfirmCommit?.id === action.id
        ? { ...state, pendingConfirmCommit: null }
        : state;
    case 'BEGIN_CASE_BUILD':
      return ownerMatches(state, action.owner) && state.session?.status === 'complete'
        ? { ...state, screen: 'building-case', caseBuildOperationId: action.operationId }
        : state;
    case 'APPLY_CASE_BUILD':
      return ownerMatches(state, action.owner)
        && state.caseBuildOperationId === action.operationId
        ? {
          ...state,
          screen: 'result',
          session: action.session,
          caseBuildOperationId: null,
        }
        : state;
    case 'END_CASE_BUILD':
      return ownerMatches(state, action.owner)
        && state.caseBuildOperationId === action.operationId
        ? { ...state, caseBuildOperationId: null }
        : state;
    case 'BEGIN_ANALYSIS':
      return ownerMatches(state, action.owner)
        ? { ...state, analysisOperationId: action.operationId }
        : state;
    case 'APPLY_ANALYSIS': {
      if (
        !ownerMatches(state, action.owner)
        || state.analysisOperationId !== action.operationId
        || !state.session
      ) return state;
      const next = {
        ...state.session,
        analysis: action.analysis,
        updatedAt: latestTimestamp(state.session.updatedAt, action.analysis.generatedAt),
      };
      return { ...state, analysisOperationId: null, session: next };
    }
    case 'END_ANALYSIS':
      return ownerMatches(state, action.owner)
        && state.analysisOperationId === action.operationId
        ? { ...state, analysisOperationId: null }
        : state;
    case 'BEGIN_FOLLOW_UP': {
      if (!ownerMatches(state, action.owner) || !state.session) return state;
      return { ...state, followUpOperationId: action.operationId };
    }
    case 'RESOLVE_FOLLOW_UP': {
      if (
        !ownerMatches(state, action.owner)
        || state.followUpOperationId !== action.operationId
        || !state.session
      ) return state;
      const known = new Set(state.session.messages.map((message) => message.id));
      const appended = action.messages.filter((message) => !known.has(message.id));
      const messages = [...state.session.messages, ...appended];
      const newest = appended.reduce(
        (timestamp, message) => latestTimestamp(timestamp, message.createdAt),
        state.session.updatedAt,
      );
      const next = {
        ...state.session,
        messages,
        updatedAt: newest,
      };
      return { ...state, followUpOperationId: null, session: next };
    }
    case 'END_FOLLOW_UP':
      return ownerMatches(state, action.owner)
        && state.followUpOperationId === action.operationId
        ? { ...state, followUpOperationId: null }
        : state;
  }
}

const readingClient = createElectronReadingClient(desktop.reading);

const SESSION_CATEGORIES = new Set<SessionCategory>([
  'career', 'wealth', 'relationship', 'health', 'study', 'lost_item', 'travel', 'other',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedReviewSession(value: unknown, fallbackKey: string): DivinationSession {
  if (!isRecord(value) || value.migrationState !== 'needs-review') return value as DivinationSession;
  const id = typeof value.id === 'string' && value.id.trim()
    ? value.id
    : `needs-review:${fallbackKey}`;
  const castAt = typeof value.castAt === 'string' && Number.isFinite(Date.parse(value.castAt))
    ? new Date(value.castAt).toISOString()
    : '1970-01-01T00:00:00.000Z';
  const updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
    ? new Date(value.updatedAt).toISOString()
    : castAt;
  return {
    ...value,
    id,
    question: typeof value.question === 'string' && value.question.trim()
      ? value.question
      : '旧记录（字段不完整）',
    category: typeof value.category === 'string' && SESSION_CATEGORIES.has(value.category as SessionCategory)
      ? value.category as SessionCategory
      : 'other',
    castAt,
    updatedAt,
    status: 'complete',
    tosses: Array.isArray(value.tosses) ? value.tosses : [],
    messages: Array.isArray(value.messages) ? value.messages : [],
    migrationState: 'needs-review',
  } as DivinationSession;
}

function presentAuthoritativeSession(
  input: DivinationSession,
  fallbackKey = 'record',
): DivinationSession {
  const session = normalizedReviewSession(input, fallbackKey);
  if (session.migrationState === 'needs-review' || !session.caseSnapshot) {
    const { plate: _legacyPlate, ...safe } = session;
    return safe;
  }
  return {
    ...session,
    plate: legacyPlateFromCase(session.caseSnapshot),
    ruleContext: session.caseSnapshot.ruleContext,
  };
}

function sessionWithCase(
  session: DivinationSession,
  envelope: ReadingCaseEnvelope,
): DivinationSession {
  if (envelope.caseSnapshot.sessionId !== session.id) {
    throw new Error('ReadingClient 返回了其他会话的 Case');
  }
  const sameCase = session.caseSnapshot?.factSetHash === envelope.caseSnapshot.factSetHash;
  const next: DivinationSession = {
    ...session,
    caseSnapshot: envelope.caseSnapshot,
    ruleContext: envelope.caseSnapshot.ruleContext,
    migrationVersion: 2,
    migrationState: 'clean',
    caseRuntimeTrust: envelope.runtimeTrust,
    plate: legacyPlateFromCase(envelope.caseSnapshot),
    updatedAt: latestTimestamp(session.updatedAt, envelope.caseSnapshot.builtAt),
  };
  if (!sameCase) delete next.analysis;
  return next;
}

function prepareNext(session: DivinationSession): DivinationSession {
  if (session.status === 'complete' || session.currentToss) return session;
  return prepareToss(session, randomToss(), crypto.randomUUID());
}

export function App() {
  const [flow, dispatchFlow] = useReducer(appFlowReducer, initialAppFlowState);
  const { screen, session } = flow;
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<SessionCategory | null>(null);
  const [history, setHistory] = useState<DivinationSession[]>([]);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const [retrievalDiagnostics, setRetrievalDiagnostics] = useState<RetrievalDiagnostics | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [caseBuildError, setCaseBuildError] = useState('');
  const analyzing = flow.analysisOperationId !== null;
  const chatting = flow.followUpOperationId !== null;
  const handledConfirmCommands = useRef(new Set<string>());
  const deletedSessionIds = useRef(new Set<string>());
  const failedCaseCommandRef = useRef<ConfirmCommitCommand | null>(null);
  const epochRef = useRef(0);
  const activeOwnerRef = useRef<SessionOwner | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const isOwnerCurrent = (owner: SessionOwner): boolean => (
    activeOwnerRef.current?.sessionId === owner.sessionId
    && activeOwnerRef.current.epoch === owner.epoch
  );

  const resetAsyncUi = () => {
    setEvidence([]);
    setRetrievalDiagnostics(null);
    setAnalysisError('');
    setCaseBuildError('');
    failedCaseCommandRef.current = null;
  };

  const openFlow = (
    next: DivinationSession | null,
    nextScreen: Screen,
  ): SessionOwner | null => {
    const epoch = epochRef.current + 1;
    epochRef.current = epoch;
    const owner = next
      ? { sessionId: next.id, epoch }
      : null;
    activeOwnerRef.current = owner;
    dispatchFlow({ type: 'OPEN_SESSION', screen: nextScreen, session: next });
    resetAsyncUi();
    return owner;
  };

  useEffect(() => {
    void desktop.sessions.list().then((sessions) => {
      const loaded = sessions
        .filter((saved) => !deletedSessionIds.current.has(saved.id))
        .map((saved, index) => presentAuthoritativeSession(saved, String(index)));
      setHistory((current) => loaded.reduceRight(mergeSavedSession, current));
    });
  }, []);

  const saveSession = async (next: DivinationSession): Promise<void> => {
    const saved = presentAuthoritativeSession(await desktop.sessions.save(next));
    if (deletedSessionIds.current.has(saved.id)) {
      await desktop.sessions.delete(saved.id);
      return;
    }
    setHistory((current) => mergeSavedSession(current, saved));
  };

  const queueSaveSession = (next: DivinationSession): Promise<void> => {
    const queued = saveQueueRef.current.then(() => saveSession(next));
    saveQueueRef.current = queued.catch(() => undefined);
    return queued;
  };

  const queueBackgroundSave = (next: DivinationSession) => {
    void queueSaveSession(next).catch((error) => {
      console.error('Failed to persist session', error);
    });
  };

  const runAnalysis = async (target: DivinationSession, owner: SessionOwner) => {
    if (!target.caseSnapshot || !isOwnerCurrent(owner)) return;
    const operationId = crypto.randomUUID();
    dispatchFlow({ type: 'BEGIN_ANALYSIS', owner, operationId });
    setAnalysisError('');
    try {
      const expectedFactSetHash = target.caseSnapshot.factSetHash;
      const result = await readingClient.analyze({
        sessionId: target.id,
        expectedFactSetHash,
      });
      if (result.caseSnapshot.factSetHash !== expectedFactSetHash) return;
      if (!deletedSessionIds.current.has(target.id)) {
        setHistory((current) => {
          const existing = current.find((entry) => entry.id === target.id) ?? target;
          if (existing.caseSnapshot?.factSetHash !== expectedFactSetHash) return current;
          return mergeSavedSession(current, {
            ...existing,
            analysis: result.report,
            updatedAt: latestTimestamp(existing.updatedAt, result.report.generatedAt),
          });
        });
      }
      if (!isOwnerCurrent(owner)) return;
      setEvidence(result.evidence);
      setRetrievalDiagnostics(result.retrievalDiagnostics);
      dispatchFlow({
        type: 'APPLY_ANALYSIS',
        owner,
        operationId,
        analysis: result.report,
      });
    } catch (error) {
      if (isOwnerCurrent(owner)) {
        setAnalysisError(error instanceof Error ? error.message : '检索或分析服务暂时不可用。');
        dispatchFlow({ type: 'END_ANALYSIS', owner, operationId });
      }
    }
  };

  const attemptCaseBuild = async (command: ConfirmCommitCommand) => {
    const operationId = crypto.randomUUID();
    if (isOwnerCurrent(command.owner)) {
      failedCaseCommandRef.current = command;
      setCaseBuildError('');
      dispatchFlow({ type: 'BEGIN_CASE_BUILD', owner: command.owner, operationId });
    }
    try {
      await queueSaveSession(command.session);
      if (deletedSessionIds.current.has(command.session.id)) return;
      const envelope = await readingClient.buildCase({ sessionId: command.session.id });
      if (deletedSessionIds.current.has(command.session.id)) return;
      const next = sessionWithCase(command.session, envelope);
      setHistory((current) => mergeSavedSession(current, next));
      if (!isOwnerCurrent(command.owner)) return;
      failedCaseCommandRef.current = null;
      dispatchFlow({
        type: 'APPLY_CASE_BUILD',
        owner: command.owner,
        operationId,
        session: next,
      });
      void runAnalysis(next, command.owner);
    } catch (error) {
      if (isOwnerCurrent(command.owner)) {
        setCaseBuildError(error instanceof Error ? error.message : '权威卦例建立失败');
        dispatchFlow({ type: 'END_CASE_BUILD', owner: command.owner, operationId });
      } else {
        console.error('Failed to persist completed session', error);
      }
    }
  };

  const start = () => {
    if (!category || !isValidQuestion(question)) return;
    const next = prepareNext(createSession(question, category));
    const owner = openFlow(next, 'casting');
    if (owner) queueBackgroundSave(next);
  };

  const confirm = (expectedTossId: string) => {
    const nextToss = randomToss();
    const nextVisualSeed = crypto.randomUUID();
    const nextTossId = crypto.randomUUID();
    const plateId = crypto.randomUUID();
    const commandId = crypto.randomUUID();
    const transitionAt = new Date().toISOString();
    dispatchFlow({
      type: 'ADVANCE_TOSS',
      commandId,
      expectedTossId,
      transaction: {
        at: transitionAt,
        plateId,
        next: {
          toss: nextToss,
          visualSeed: nextVisualSeed,
          id: nextTossId,
        },
      },
    });
  };

  useEffect(() => {
    const command = flow.pendingConfirmCommit;
    if (!command || handledConfirmCommands.current.has(command.id)) return;
    handledConfirmCommands.current.add(command.id);
    dispatchFlow({ type: 'CONSUME_CONFIRM_COMMIT', id: command.id });
    if (command.session.status === 'complete') void attemptCaseBuild(command);
    else queueBackgroundSave(command.session);
  }, [flow.pendingConfirmCommit]);

  const openSession = async (saved: DivinationSession) => {
    const latest = saved.migrationState === 'needs-review'
      ? null
      : await desktop.sessions.get(saved.id);
    if (deletedSessionIds.current.has(saved.id)) return;
    let next = presentAuthoritativeSession(latest ?? saved, saved.id);
    if (saved.status === 'casting') next = prepareNext(next);
    const needsReview = next.status === 'complete' && next.migrationState === 'needs-review';
    const needsCaseRecovery = next.status === 'complete' && !needsReview && !next.caseSnapshot;
    const nextScreen: Screen = next.status === 'casting'
      ? 'casting'
      : needsReview
        ? 'review-error'
        : needsCaseRecovery
          ? 'building-case'
          : 'result';
    const owner = openFlow(next, nextScreen);
    if (!owner) return;
    setQuestion(next.question);
    setCategory(next.category);
    setHistoryOpen(false);
    if (nextScreen === 'result') void runAnalysis(next, owner);
    if (nextScreen === 'building-case') {
      void attemptCaseBuild({ id: crypto.randomUUID(), session: next, owner });
    }
    if (nextScreen === 'casting') queueBackgroundSave(next);
  };

  const deleteSession = async (id: string) => {
    try {
      await desktop.sessions.delete(id);
    } catch (error) {
      console.error('Failed to delete session', error);
      return;
    }
    deletedSessionIds.current.add(id);
    setHistory((current) => current.filter((item) => item.id !== id));
    if (activeOwnerRef.current?.sessionId === id) openFlow(null, 'home');
  };

  const followUp = async (followQuestion: string) => {
    if (!session?.caseSnapshot) return;
    const owner = activeOwnerRef.current;
    if (!owner || owner.sessionId !== session.id) return;
    const operationId = crypto.randomUUID();
    dispatchFlow({
      type: 'BEGIN_FOLLOW_UP',
      owner,
      operationId,
    });
    try {
      const expectedFactSetHash = session.caseSnapshot.factSetHash;
      const result = await readingClient.followUp({
        sessionId: session.id,
        question: followQuestion,
        expectedFactSetHash,
      });
      if (result.caseSnapshot.factSetHash !== expectedFactSetHash) return;
      if (!deletedSessionIds.current.has(session.id)) {
        setHistory((current) => {
          const existing = current.find((entry) => entry.id === session.id) ?? session;
          if (existing.caseSnapshot?.factSetHash !== expectedFactSetHash) return current;
          const known = new Set(existing.messages.map((message) => message.id));
          const messages = [
            ...existing.messages,
            ...result.messages.filter((message) => !known.has(message.id)),
          ];
          const updatedAt = result.messages.reduce(
            (timestamp, message) => latestTimestamp(timestamp, message.createdAt),
            existing.updatedAt,
          );
          return mergeSavedSession(current, { ...existing, messages, updatedAt });
        });
      }
      if (!isOwnerCurrent(owner)) return;
      dispatchFlow({
        type: 'RESOLVE_FOLLOW_UP',
        owner,
        operationId,
        messages: result.messages,
      });
    } catch {
      if (isOwnerCurrent(owner)) {
        dispatchFlow({ type: 'END_FOLLOW_UP', owner, operationId });
      }
    }
  };

  const returnHome = () => {
    openFlow(null, 'home');
    setQuestion('');
    setCategory(null);
  };

  const appTitle = useMemo(() => (
    screen === 'home'
      ? '问爻'
      : screen === 'casting'
        ? '六爻起卦'
        : screen === 'building-case'
          ? '建立卦例'
          : screen === 'review-error'
            ? '历史复核'
            : '排盘与解读'
  ), [screen]);
  return (
    <div className="app-shell">
      <header className="app-chrome">
        <div className="chrome-brand"><span>爻</span><strong>{appTitle}</strong></div>
        <nav>
          <button type="button" aria-label="历史记录" onClick={() => setHistoryOpen(true)}><History size={17} /><span>历史</span></button>
          <button type="button" aria-label="AI 设置" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /><span>设置</span></button>
        </nav>
      </header>
      {screen === 'home' && <HomeScreen question={question} category={category} onQuestionChange={setQuestion} onCategoryChange={setCategory} onStart={start} />}
      {screen === 'casting' && session?.currentToss && <RitualScreen session={session} onConfirm={confirm} />}
      {screen === 'building-case' && (
        <main className="result-screen">
          <section className="analysis-loading" aria-live="polite">
            <span className="ink-loader" />
            <h1>正在建立权威卦例</h1>
            <p>主进程正在依据已保存的六次投币重建排盘与事实。</p>
            {caseBuildError && <p role="alert">{caseBuildError}</p>}
            {caseBuildError && failedCaseCommandRef.current && (
              <button
                type="button"
                onClick={() => { const command = failedCaseCommandRef.current; if (command) void attemptCaseBuild(command); }}
              >
                重试建立卦例
              </button>
            )}
          </section>
        </main>
      )}
      {screen === 'review-error' && (
        <main className="result-screen">
          <section className="analysis-loading" role="alert">
            <h1>此历史记录需要人工复核</h1>
            <p>旧数据没有可验证的权威 Case，已停止回退到旧排盘结果。</p>
            <button type="button" onClick={returnHome}>返回首页</button>
          </section>
        </main>
      )}
      {screen === 'result' && session?.caseSnapshot && session.plate && (
        <>
          {session.caseRuntimeTrust === 'browser-preview' && (
            <p className="runtime-trust-note" role="status">浏览器预览结果，未经过桌面主进程验证。</p>
          )}
          <ResultScreen session={session} evidence={evidence} retrievalDiagnostics={retrievalDiagnostics} analyzing={analyzing} analysisError={analysisError} chatting={chatting} onAnalyze={() => { const owner = activeOwnerRef.current; if (owner) void runAnalysis(session, owner); }} onFollowUp={followUp} onBack={returnHome} />
        </>
      )}
      {historyOpen && <HistoryPanel sessions={history} onClose={() => setHistoryOpen(false)} onOpen={(saved) => void openSession(saved)} onDelete={(id) => void deleteSession(id)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
