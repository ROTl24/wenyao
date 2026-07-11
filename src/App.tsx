import { History, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { HomeScreen } from './components/HomeScreen';
import { ResultScreen } from './components/ResultScreen';
import { RitualScreen } from './components/RitualScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { desktop } from './lib/desktop';
import { randomToss, upgradePlate } from './lib/divination';
import { createBrowserLocalReport } from './lib/localAnalysis';
import type { EvidenceEntry, RetrievalDiagnostics } from './lib/retrieval';
import {
  advanceCurrentToss,
  createSession,
  isValidQuestion,
  prepareToss,
  withAnalysis,
  withMessage,
  type AdvanceCurrentTossTransaction,
  type DivinationSession,
  type SessionCategory,
} from './lib/session';

type Screen = 'home' | 'casting' | 'result';

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
  epoch: number;
}

type AppFlowAction =
  | { type: 'OPEN_SESSION'; screen: Screen; session: DivinationSession | null }
  | { type: 'APPLY_OWNED_SESSION'; owner: SessionOwner; session: DivinationSession }
  | {
    type: 'ADVANCE_TOSS';
    expectedTossId: string;
    transaction: AdvanceCurrentTossTransaction;
  }
  | { type: 'CONSUME_CONFIRM_COMMIT'; id: string };

const initialAppFlowState: AppFlowState = {
  screen: 'home',
  session: null,
  pendingConfirmCommit: null,
  epoch: 0,
};

function ownerMatches(state: AppFlowState, owner: SessionOwner): boolean {
  return state.epoch === owner.epoch && state.session?.id === owner.sessionId;
}

function sessionProgress(session: DivinationSession): number {
  return session.tosses.length * 100
    + (session.status === 'complete' ? 50 : 0)
    + (session.analysis ? 10 : 0)
    + session.messages.length;
}

export function mergeSavedSession(
  history: DivinationSession[],
  saved: DivinationSession,
): DivinationSession[] {
  const existing = history.find((item) => item.id === saved.id);
  if (
    existing
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
        epoch: state.epoch + 1,
      };
    case 'APPLY_OWNED_SESSION':
      return ownerMatches(state, action.owner)
        ? { ...state, session: action.session }
        : state;
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
        screen: next.status === 'complete' ? 'result' : 'casting',
        session: next,
        pendingConfirmCommit: {
          id: action.expectedTossId,
          session: next,
          owner: { sessionId: state.session.id, epoch: state.epoch },
        },
      };
    }
    case 'CONSUME_CONFIRM_COMMIT':
      return state.pendingConfirmCommit?.id === action.id
        ? { ...state, pendingConfirmCommit: null }
        : state;
  }
}

const categoryTerms: Record<SessionCategory, string[]> = {
  career: ['事业', '功名', '官禄', '仕宦', '求名', '官鬼', '世爻', '父母'],
  wealth: ['财运', '求财', '买卖', '妻财', '子孙', '兄弟'],
  relationship: ['感情', '婚姻', '世爻', '应爻', '官鬼', '妻财'],
  health: ['健康', '疾病', '世爻', '官鬼', '子孙'],
  study: ['学业', '考试', '科举', '科甲', '求名', '父母', '官鬼', '世爻'],
  lost_item: ['寻物', '失物', '用神', '方位', '冲合'],
  travel: ['出行', '行人', '世爻', '应爻', '动爻'],
  other: ['世爻', '应爻', '日辰', '月建'],
};

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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [chatting, setChatting] = useState(false);
  const handledConfirmCommands = useRef(new Set<string>());
  const deletedSessionIds = useRef(new Set<string>());
  const epochRef = useRef(0);
  const activeOwnerRef = useRef<SessionOwner | null>(null);

  const isOwnerCurrent = (owner: SessionOwner): boolean => (
    activeOwnerRef.current?.sessionId === owner.sessionId
    && activeOwnerRef.current.epoch === owner.epoch
  );

  const resetAsyncUi = () => {
    setEvidence([]);
    setRetrievalDiagnostics(null);
    setAnalyzing(false);
    setAnalysisError('');
    setChatting(false);
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
        .map((saved) => saved.plate ? { ...saved, plate: upgradePlate(saved.plate) } : saved);
      setHistory((current) => loaded.reduceRight(mergeSavedSession, current));
    });
  }, []);

  const saveSession = async (next: DivinationSession) => {
    try {
      const saved = await desktop.sessions.save(next);
      if (deletedSessionIds.current.has(saved.id)) {
        await desktop.sessions.delete(saved.id);
        return;
      }
      setHistory((current) => mergeSavedSession(current, saved));
    } catch (error) {
      console.error('Failed to persist session', error);
    }
  };

  const persistOwned = async (next: DivinationSession, owner: SessionOwner) => {
    dispatchFlow({ type: 'APPLY_OWNED_SESSION', owner, session: next });
    await saveSession(next);
  };

  const evidenceFor = async (target: DivinationSession) => {
    if (!target.plate) return { evidence: [], diagnostics: null };
    const terms = [
      ...categoryTerms[target.category],
      target.plate.baseHexagram.shortName,
      target.plate.changedHexagram.shortName,
      ...target.plate.lines.filter((line) => line.moving || line.role).flatMap((line) => [line.relation, line.role || '']),
    ].filter(Boolean);
    const result = await desktop.retrieval.search({ query: target.question, domainTerms: terms, limit: 8 });
    return { evidence: result.evidence, diagnostics: result.diagnostics };
  };

  const runAnalysis = async (target: DivinationSession, owner: SessionOwner) => {
    if (!target.plate || !isOwnerCurrent(owner)) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const found = await evidenceFor(target);
      if (!isOwnerCurrent(owner)) return;
      setEvidence(found.evidence);
      setRetrievalDiagnostics(found.diagnostics);
      const result = await desktop.ai.analyze({ question: target.question, category: target.category, plate: target.plate, evidence: found.evidence, retrievalDiagnostics: found.diagnostics || undefined });
      if (!isOwnerCurrent(owner)) return;
      if (result.ok && result.report) {
        await persistOwned(withAnalysis(target, result.report), owner);
      } else if (desktop.platform === 'browser') {
        await persistOwned(withAnalysis(target, createBrowserLocalReport(target, found.evidence)), owner);
      } else {
        setAnalysisError(`${result.error?.message || 'AI 分析失败'} ${result.error?.nextAction || ''}`.trim());
      }
    } catch (error) {
      if (isOwnerCurrent(owner)) {
        setAnalysisError(error instanceof Error ? error.message : '检索或分析服务暂时不可用。');
      }
    } finally {
      if (isOwnerCurrent(owner)) setAnalyzing(false);
    }
  };

  const start = () => {
    if (!category || !isValidQuestion(question)) return;
    const next = prepareNext(createSession(question, category));
    const owner = openFlow(next, 'casting');
    if (owner) void saveSession(next);
  };

  const confirm = (expectedTossId: string) => {
    const nextToss = randomToss();
    const nextVisualSeed = crypto.randomUUID();
    const nextTossId = crypto.randomUUID();
    const plateId = crypto.randomUUID();
    const transitionAt = new Date().toISOString();
    dispatchFlow({
      type: 'ADVANCE_TOSS',
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
    void (async () => {
      await saveSession(command.session);
      if (command.session.status === 'complete' && isOwnerCurrent(command.owner)) {
        await runAnalysis(command.session, command.owner);
      }
    })();
  }, [flow.pendingConfirmCommit]);

  const openSession = async (saved: DivinationSession) => {
    let next = saved.plate ? { ...saved, plate: upgradePlate(saved.plate) } : saved;
    if (saved.status === 'casting') next = prepareNext(next);
    const owner = openFlow(next, next.status === 'complete' ? 'result' : 'casting');
    if (!owner) return;
    setQuestion(next.question);
    setCategory(next.category);
    setHistoryOpen(false);
    if (next.status === 'complete') {
      const found = await evidenceFor(next);
      if (!isOwnerCurrent(owner)) return;
      setEvidence(found.evidence);
      setRetrievalDiagnostics(found.diagnostics);
      if (!next.analysis) void runAnalysis(next, owner);
    } else {
      void saveSession(next);
    }
  };

  const deleteSession = async (id: string) => {
    deletedSessionIds.current.add(id);
    setHistory((current) => current.filter((item) => item.id !== id));
    if (activeOwnerRef.current?.sessionId === id) openFlow(null, 'home');
    await desktop.sessions.delete(id);
  };

  const followUp = async (followQuestion: string) => {
    if (!session || !session.plate) return;
    const owner = activeOwnerRef.current;
    if (!owner || owner.sessionId !== session.id) return;
    setChatting(true);
    let next = withMessage(session, { id: crypto.randomUUID(), role: 'user', content: followQuestion, createdAt: new Date().toISOString() });
    await persistOwned(next, owner);
    if (!isOwnerCurrent(owner)) return;
    const result = await desktop.ai.followUp({ question: followQuestion, session: next, evidence });
    if (!isOwnerCurrent(owner)) return;
    const answer = result.ok && result.answer ? result.answer : {
      content: desktop.platform === 'browser' ? '浏览器预览不会发送 AI 请求；桌面应用会沿用本次排盘和古籍证据继续回答。' : `${result.error?.message || '追问失败'} ${result.error?.nextAction || ''}`,
      evidenceIds: [],
    };
    next = withMessage(next, { id: crypto.randomUUID(), role: 'assistant', content: answer.content, evidenceIds: answer.evidenceIds, createdAt: new Date().toISOString() });
    await persistOwned(next, owner);
    if (isOwnerCurrent(owner)) setChatting(false);
  };

  const appTitle = useMemo(() => screen === 'home' ? '问爻' : screen === 'casting' ? '六爻起卦' : '排盘与解读', [screen]);
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
      {screen === 'result' && session?.plate && <ResultScreen session={session} evidence={evidence} retrievalDiagnostics={retrievalDiagnostics} analyzing={analyzing} analysisError={analysisError} chatting={chatting} onAnalyze={() => { const owner = activeOwnerRef.current; if (owner) void runAnalysis(session, owner); }} onFollowUp={followUp} onBack={() => { openFlow(null, 'home'); setQuestion(''); setCategory(null); }} />}
      {historyOpen && <HistoryPanel sessions={history} onClose={() => setHistoryOpen(false)} onOpen={(saved) => void openSession(saved)} onDelete={(id) => void deleteSession(id)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
