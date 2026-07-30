import { History, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { HomeScreen } from './components/HomeScreen';
import { PhysicalCastingScreen } from './components/PhysicalCastingScreen';
import { PhysicalReviewScreen } from './components/PhysicalReviewScreen';
import { ResultScreen } from './components/ResultScreen';
import { RitualScreen } from './components/RitualScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { desktop } from './lib/desktop';
import { randomToss, upgradePlate } from './lib/divination';
import { createBrowserLocalReport } from './lib/localAnalysis';
import { isValidQuestion } from './lib/question';
import type { EvidenceEntry, RetrievalDiagnostics } from './lib/retrieval';
import {
  appendPhysicalCastLine,
  createPhysicalCastDraft,
  finalizePhysicalCast,
  replacePhysicalCastLine,
  updatePhysicalCastTime,
  type PhysicalCastDraft,
} from './lib/physicalCasting';
import {
  formatShanghaiDateTimeInput,
  parseShanghaiDateTimeInput,
  shanghaiDateTimeError,
} from './lib/shanghaiTime';
import {
  confirmCurrentToss,
  createSession,
  normalizeSession,
  prepareToss,
  withAnalysis,
  withMessage,
  type CastingMethod,
  type DivinationSession,
  type SessionCategory,
} from './lib/session';
import type { LineValue } from './lib/divination';

type Screen = 'home' | 'casting' | 'physical-casting' | 'physical-review' | 'result';
type AnalysisSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SessionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

function mergeCompleteSessionState(
  current: DivinationSession | undefined,
  incoming: DivinationSession,
): DivinationSession {
  if (!current || current.id !== incoming.id || current.status !== 'complete' || incoming.status !== 'complete') {
    return incoming;
  }

  const messages = [...current.messages];
  const messageIndexes = new Map(messages.map((message, index) => [message.id, index]));
  for (const message of incoming.messages) {
    const existingIndex = messageIndexes.get(message.id);
    if (existingIndex === undefined) {
      messageIndexes.set(message.id, messages.length);
      messages.push(message);
    } else {
      messages[existingIndex] = message;
    }
  }

  return {
    ...incoming,
    analysis: incoming.analysis ?? current.analysis,
    messages,
    updatedAt: incoming.updatedAt >= current.updatedAt ? incoming.updatedAt : current.updatedAt,
  };
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<SessionCategory | null>(null);
  const [castingMethod, setCastingMethod] = useState<CastingMethod | null>(null);
  const [physicalTimeInput, setPhysicalTimeInput] = useState(() => formatShanghaiDateTimeInput());
  const [physicalDraft, setPhysicalDraft] = useState<PhysicalCastDraft | null>(null);
  const [pendingPhysicalSession, setPendingPhysicalSession] = useState<DivinationSession | null>(null);
  const [physicalFinalizing, setPhysicalFinalizing] = useState(false);
  const [physicalFinalizeError, setPhysicalFinalizeError] = useState('');
  const [session, setSession] = useState<DivinationSession | null>(null);
  const [sessionSaveStatus, setSessionSaveStatus] = useState<SessionSaveStatus>('idle');
  const [sessionSaveError, setSessionSaveError] = useState('');
  const [history, setHistory] = useState<DivinationSession[]>([]);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const [retrievalDiagnostics, setRetrievalDiagnostics] = useState<RetrievalDiagnostics | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisSaveStatus, setAnalysisSaveStatus] = useState<AnalysisSaveStatus>('idle');
  const [analysisSaveError, setAnalysisSaveError] = useState('');
  const [chatting, setChatting] = useState(false);
  const [chatError, setChatError] = useState('');
  const activeSessionIdRef = useRef<string | null>(null);
  const activeSessionRef = useRef<DivinationSession | null>(null);
  const latestSessionsRef = useRef(new Map<string, DivinationSession>());
  const deletedSessionIdsRef = useRef(new Set<string>());
  const sessionSaveQueuesRef = useRef(new Map<string, Promise<void>>());
  const analysisEpochsRef = useRef(new Map<string, symbol>());
  const analysisRunRef = useRef<{ sessionId: string; token: symbol } | null>(null);
  const physicalTimeError = useMemo(
    () => shanghaiDateTimeError(physicalTimeInput),
    [physicalTimeInput],
  );

  useEffect(() => {
    void desktop.sessions.list().then((sessions) => {
      const normalized = sessions.map((stored) => {
        const saved = normalizeSession(stored);
        return saved.plate ? { ...saved, plate: upgradePlate(saved.plate) } : saved;
      });
      setHistory((current) => {
        const merged = new Map(normalized.map((saved) => [saved.id, saved]));
        for (const saved of current) {
          const loaded = merged.get(saved.id);
          if (!loaded || loaded.updatedAt < saved.updatedAt) merged.set(saved.id, saved);
        }
        const ordered = [...merged.values()].sort((left, right) => (
          right.updatedAt.localeCompare(left.updatedAt)
        ));
        for (const saved of ordered) latestSessionsRef.current.set(saved.id, saved);
        return ordered;
      });
    });
  }, []);

  const isActiveSession = (id: string) => (
    activeSessionIdRef.current === id && !deletedSessionIdsRef.current.has(id)
  );

  const activateSession = (next: DivinationSession | null) => {
    const nextId = next?.id ?? null;
    if (activeSessionIdRef.current !== nextId) {
      analysisRunRef.current = null;
      setAnalyzing(false);
      setChatting(false);
      setChatError('');
      setEvidence([]);
      setRetrievalDiagnostics(null);
      setAnalysisError('');
      setAnalysisSaveStatus('idle');
      setAnalysisSaveError('');
    }
    activeSessionIdRef.current = nextId;
    activeSessionRef.current = next;
    if (next) latestSessionsRef.current.set(next.id, next);
    setSession(next);
  };

  const commitSession = async (next: DivinationSession): Promise<DivinationSession | null> => {
    if (deletedSessionIdsRef.current.has(next.id)) return null;

    const previous = sessionSaveQueuesRef.current.get(next.id) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        if (deletedSessionIdsRef.current.has(next.id)) return null;
        const candidate = mergeCompleteSessionState(
          latestSessionsRef.current.get(next.id),
          next,
        );
        const saved = await desktop.sessions.save(candidate);
        if (deletedSessionIdsRef.current.has(saved.id)) return null;

        const visibleSaved = mergeCompleteSessionState(
          latestSessionsRef.current.get(saved.id),
          saved,
        );
        latestSessionsRef.current.set(saved.id, visibleSaved);
        setHistory((current) => [visibleSaved, ...current.filter((item) => item.id !== saved.id)]);
        const active = activeSessionRef.current;
        if (
          active?.id === visibleSaved.id
          && active.updatedAt <= visibleSaved.updatedAt
        ) {
          activeSessionRef.current = visibleSaved;
          setSession(visibleSaved);
        }
        return visibleSaved;
      });
    const queueTail = operation.then(() => undefined, () => undefined);
    sessionSaveQueuesRef.current.set(next.id, queueTail);

    try {
      return await operation;
    } finally {
      if (sessionSaveQueuesRef.current.get(next.id) === queueTail) {
        sessionSaveQueuesRef.current.delete(next.id);
      }
    }
  };

  const persist = async (next: DivinationSession) => {
    if (deletedSessionIdsRef.current.has(next.id)) return;
    activateSession(next);
    try { await commitSession(next); }
    catch (error) { console.error('Failed to persist session', error); }
  };

  const persistAnalysis = async (
    next: DivinationSession,
    runToken: symbol,
  ) => {
    if (
      deletedSessionIdsRef.current.has(next.id)
      || analysisEpochsRef.current.get(next.id) !== runToken
    ) return;
    const ownsAnalysisUi = () => (
      isActiveSession(next.id)
      && analysisRunRef.current?.sessionId === next.id
      && analysisRunRef.current.token === runToken
    );
    const mergedNext = mergeCompleteSessionState(
      latestSessionsRef.current.get(next.id),
      next,
    );
    latestSessionsRef.current.set(next.id, mergedNext);
    if (isActiveSession(mergedNext.id)) {
      activeSessionRef.current = mergedNext;
      setSession(mergedNext);
    }
    if (ownsAnalysisUi()) {
      setAnalysisSaveStatus('saving');
      setAnalysisSaveError('');
    }
    try {
      const saved = await commitSession(mergedNext);
      if (saved && ownsAnalysisUi()) setAnalysisSaveStatus('saved');
    } catch (error) {
      console.error('Failed to persist analysis', error);
      if (ownsAnalysisUi()) {
        setAnalysisSaveStatus('error');
        setAnalysisSaveError(error instanceof Error ? error.message : '写入历史记录失败。');
      }
    }
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

  const runAnalysis = async (target: DivinationSession) => {
    if (!target.plate || deletedSessionIdsRef.current.has(target.id)) return;
    const runToken = Symbol(target.id);
    analysisEpochsRef.current.set(target.id, runToken);
    const ownsAnalysisUi = () => (
      isActiveSession(target.id)
      && analysisRunRef.current?.sessionId === target.id
      && analysisRunRef.current.token === runToken
    );
    if (isActiveSession(target.id)) {
      analysisRunRef.current = { sessionId: target.id, token: runToken };
      setAnalyzing(true);
      setAnalysisError('');
      setAnalysisSaveStatus('idle');
      setAnalysisSaveError('');
      setEvidence([]);
      setRetrievalDiagnostics(null);
    }
    try {
      const found = await evidenceFor(target);
      if (ownsAnalysisUi()) {
        setEvidence(found.evidence);
        setRetrievalDiagnostics(found.diagnostics);
      }
      const result = await desktop.ai.analyze({ question: target.question, category: target.category, plate: target.plate, evidence: found.evidence, retrievalDiagnostics: found.diagnostics || undefined });
      if (result.ok && result.report) {
        await persistAnalysis(withAnalysis(target, result.report), runToken);
      } else if (desktop.platform === 'browser') {
        await persistAnalysis(
          withAnalysis(target, createBrowserLocalReport(target, found.evidence)),
          runToken,
        );
      } else if (ownsAnalysisUi()) {
        setAnalysisError(`${result.error?.message || 'AI 分析失败'} ${result.error?.nextAction || ''}`.trim());
      }
    } catch (error) {
      if (ownsAnalysisUi()) {
        setAnalysisError(error instanceof Error ? error.message : '检索或分析服务暂时不可用。');
      }
    } finally {
      if (ownsAnalysisUi()) setAnalyzing(false);
    }
  };

  const start = () => {
    if (!category || !castingMethod || !isValidQuestion(question)) return;
    setSessionSaveStatus('idle');
    setSessionSaveError('');
    setAnalysisSaveStatus('idle');
    setAnalysisSaveError('');
    setPhysicalFinalizeError('');
    setPendingPhysicalSession(null);
    if (castingMethod === 'physical') {
      try {
        const castAt = parseShanghaiDateTimeInput(physicalTimeInput);
        setPhysicalDraft(createPhysicalCastDraft(question, category, castAt));
        activateSession(null);
        setScreen('physical-casting');
      } catch {
        return;
      }
      return;
    }
    const next = prepareNext(createSession(question, category, new Date(), 'digital'));
    void persist(next);
    setScreen('casting');
  };

  const changeCastingMethod = (method: CastingMethod) => {
    if (method === 'physical' && castingMethod !== 'physical') {
      setPhysicalTimeInput(formatShanghaiDateTimeInput());
    }
    setCastingMethod(method);
    setPhysicalFinalizeError('');
  };

  const changePhysicalTime = (value: string) => {
    if (physicalFinalizing) return;
    setPhysicalTimeInput(value);
    setPendingPhysicalSession(null);
    setPhysicalFinalizeError('');
  };

  const confirm = () => {
    if (!session) return;
    let next = confirmCurrentToss(session);
    if (next.status === 'casting') next = prepareNext(next);
    activateSession(next);
    if (next.status === 'complete') {
      setSessionSaveStatus('saving');
      setSessionSaveError('');
      setScreen('result');
      void commitSession(next)
        .then((saved) => {
          if (!saved) return;
          if (isActiveSession(saved.id)) setSessionSaveStatus('saved');
          return runAnalysis(saved);
        })
        .catch((error) => {
          console.error('Failed to persist completed session', error);
          if (isActiveSession(next.id)) {
            setSessionSaveStatus('error');
            setSessionSaveError(error instanceof Error ? error.message : '本次排盘写入历史失败。');
          }
        });
    } else {
      void persist(next);
    }
  };

  const confirmPhysicalLine = (value: LineValue) => {
    if (!physicalDraft) return;
    const next = appendPhysicalCastLine(physicalDraft, value);
    setPhysicalDraft(next);
    if (next.lines.length === 6) setScreen('physical-review');
  };

  const changePhysicalLine = (zeroIndex: number, value: LineValue) => {
    if (!physicalDraft || physicalFinalizing) return;
    setPhysicalDraft(replacePhysicalCastLine(physicalDraft, zeroIndex, value));
    setPendingPhysicalSession(null);
    setPhysicalFinalizeError('');
  };

  const discardPhysicalDraft = () => {
    if (physicalFinalizing) return;
    if (physicalDraft?.lines.length && !window.confirm('线下起卦尚未保存，确定放弃全部已录入的钱象吗？')) {
      return;
    }
    returnHome();
  };

  const finalizePhysical = async () => {
    if (!physicalDraft || physicalTimeError || physicalFinalizing) return;
    setPhysicalFinalizing(true);
    setPhysicalFinalizeError('');
    try {
      const castAt = parseShanghaiDateTimeInput(physicalTimeInput);
      const completedDraft = updatePhysicalCastTime(physicalDraft, castAt);
      const completeSession = pendingPhysicalSession ?? finalizePhysicalCast(completedDraft);
      setPendingPhysicalSession(completeSession);
      const saved = await commitSession(completeSession);
      if (!saved) return;
      setPhysicalDraft(null);
      setPendingPhysicalSession(null);
      activateSession(saved);
      setSessionSaveStatus('saved');
      setSessionSaveError('');
      setScreen('result');
      void runAnalysis(saved);
    } catch (error) {
      setPhysicalFinalizeError(error instanceof Error ? error.message : '线下起卦保存失败，请重试。');
    } finally {
      setPhysicalFinalizing(false);
    }
  };

  const openSession = async (saved: DivinationSession) => {
    if (physicalFinalizing || deletedSessionIdsRef.current.has(saved.id)) return;
    if (physicalDraft?.lines.length && !window.confirm('线下起卦尚未保存，确定放弃并打开这条历史记录吗？')) {
      return;
    }
    const normalized = normalizeSession(saved);
    let next = normalized.plate ? { ...normalized, plate: upgradePlate(normalized.plate) } : normalized;
    if (next.status === 'casting' && next.castingMethod !== 'digital') {
      console.error('Refused to resume an incomplete physical casting session');
      return;
    }
    if (next.status === 'casting') next = prepareNext(next);
    setPhysicalDraft(null);
    setPendingPhysicalSession(null);
    setPhysicalFinalizeError('');
    activateSession(next);
    setQuestion(next.question);
    setCategory(next.category);
    setCastingMethod(next.castingMethod);
    setPhysicalTimeInput(formatShanghaiDateTimeInput(new Date(next.castAt)));
    setHistoryOpen(false);
    setSessionSaveStatus('saved');
    setSessionSaveError('');
    setAnalysisSaveStatus(next.analysis ? 'saved' : 'idle');
    setAnalysisSaveError('');
    if (next.status === 'complete') {
      setScreen('result');
      try {
        const found = await evidenceFor(next);
        if (!isActiveSession(next.id)) return;
        setEvidence(found.evidence);
        setRetrievalDiagnostics(found.diagnostics);
      } catch (error) {
        if (isActiveSession(next.id)) {
          console.error('Failed to load evidence for session', error);
          setEvidence([]);
          setRetrievalDiagnostics(null);
        }
      }
    } else {
      setScreen('casting');
      void persist(next);
    }
  };

  const deleteSession = async (id: string) => {
    deletedSessionIdsRef.current.add(id);
    try {
      await sessionSaveQueuesRef.current.get(id);
      await desktop.sessions.delete(id);
      analysisEpochsRef.current.delete(id);
      latestSessionsRef.current.delete(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      if (activeSessionIdRef.current === id) returnHome();
    } catch (error) {
      deletedSessionIdsRef.current.delete(id);
      console.error('Failed to delete session', error);
      window.alert(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请稍后重试。');
    }
  };

  const followUp = async (followQuestion: string) => {
    if (!session || !session.plate) return;
    const targetId = session.id;
    setChatting(true);
    setChatError('');
    try {
      let next = withMessage(session, { id: crypto.randomUUID(), role: 'user', content: followQuestion, createdAt: new Date().toISOString() });
      activateSession(next);
      const savedWithQuestion = await commitSession(next);
      if (!savedWithQuestion || deletedSessionIdsRef.current.has(targetId)) return;
      next = savedWithQuestion;
      const result = await desktop.ai.followUp({ question: followQuestion, session: next, evidence });
      const answer = result.ok && result.answer ? result.answer : {
        content: desktop.platform === 'browser' ? '浏览器预览不会发送 AI 请求；桌面应用会沿用本次排盘和古籍证据继续回答。' : `${result.error?.message || '追问失败'} ${result.error?.nextAction || ''}`,
      };
      next = mergeCompleteSessionState(
        latestSessionsRef.current.get(targetId),
        withMessage(next, { id: crypto.randomUUID(), role: 'assistant', kind: result.ok && result.answer ? 'markdown-answer' : 'system-notice', content: answer.content, createdAt: new Date().toISOString() }),
      );
      latestSessionsRef.current.set(targetId, next);
      if (isActiveSession(targetId)) {
        activeSessionRef.current = next;
        setSession(next);
      }
      await commitSession(next);
    } catch (error) {
      if (activeSessionIdRef.current === targetId) {
        setChatError(error instanceof Error ? error.message : '追问保存或发送失败，请重试。');
      }
    } finally {
      if (activeSessionIdRef.current === targetId) setChatting(false);
    }
  };

  const retryAnalysisSave = async () => {
    if (!session?.analysis) return;
    const runToken = analysisEpochsRef.current.get(session.id) ?? Symbol(session.id);
    analysisEpochsRef.current.set(session.id, runToken);
    await persistAnalysis(session, runToken);
  };

  const retrySessionSave = async () => {
    if (!session || session.status !== 'complete' || sessionSaveStatus === 'saving') return;
    const target = session;
    setSessionSaveStatus('saving');
    setSessionSaveError('');
    try {
      const saved = await commitSession(target);
      if (!saved) return;
      if (isActiveSession(saved.id)) setSessionSaveStatus('saved');
      void runAnalysis(saved);
    } catch (error) {
      if (isActiveSession(target.id)) {
        setSessionSaveStatus('error');
        setSessionSaveError(error instanceof Error ? error.message : '本次排盘写入历史失败。');
      }
    }
  };

  const returnHome = () => {
    activateSession(null);
    setQuestion('');
    setCategory(null);
    setCastingMethod(null);
    setPhysicalDraft(null);
    setPendingPhysicalSession(null);
    setPhysicalFinalizing(false);
    setPhysicalTimeInput(formatShanghaiDateTimeInput());
    setPhysicalFinalizeError('');
    setSessionSaveStatus('idle');
    setSessionSaveError('');
    setAnalysisSaveStatus('idle');
    setAnalysisSaveError('');
    setAnalysisError('');
    setChatError('');
    setScreen('home');
  };

  const appTitle = useMemo(() => {
    if (screen === 'home') return '问爻';
    if (screen === 'casting') return '六爻起卦';
    if (screen === 'physical-casting') return '线下起卦';
    if (screen === 'physical-review') return '六爻终审';
    return '排盘与解读';
  }, [screen]);
  return (
    <div className="app-shell">
      <header className="app-chrome">
        <div className="chrome-brand"><span>爻</span><strong>{appTitle}</strong></div>
        <nav>
          <button type="button" aria-label="历史记录" disabled={physicalFinalizing} onClick={() => setHistoryOpen(true)}><History size={17} /><span>历史</span></button>
          <button type="button" aria-label="AI 设置" disabled={physicalFinalizing} onClick={() => setSettingsOpen(true)}><Settings2 size={17} /><span>设置</span></button>
        </nav>
      </header>
      {screen === 'home' && (
        <HomeScreen
          question={question}
          category={category}
          castingMethod={castingMethod}
          physicalTimeInput={physicalTimeInput}
          physicalTimeError={physicalTimeError}
          onQuestionChange={setQuestion}
          onCategoryChange={setCategory}
          onCastingMethodChange={changeCastingMethod}
          onPhysicalTimeChange={changePhysicalTime}
          onStart={start}
        />
      )}
      {screen === 'casting' && session?.currentToss && <RitualScreen session={session} onConfirm={confirm} />}
      {screen === 'physical-casting' && physicalDraft && (
        <PhysicalCastingScreen
          draft={physicalDraft}
          onConfirm={confirmPhysicalLine}
          onCancel={discardPhysicalDraft}
        />
      )}
      {screen === 'physical-review' && physicalDraft && (
        <PhysicalReviewScreen
          draft={physicalDraft}
          timeInput={physicalTimeInput}
          timeError={physicalTimeError}
          finalizing={physicalFinalizing}
          finalizeError={physicalFinalizeError}
          onTimeChange={changePhysicalTime}
          onChangeLine={changePhysicalLine}
          onConfirm={() => void finalizePhysical()}
          onCancel={discardPhysicalDraft}
        />
      )}
      {screen === 'result' && session?.plate && <ResultScreen session={session} evidence={evidence} retrievalDiagnostics={retrievalDiagnostics} sessionSaveStatus={sessionSaveStatus} sessionSaveError={sessionSaveError} analyzing={analyzing} analysisError={analysisError} analysisSaveStatus={analysisSaveStatus} analysisSaveError={analysisSaveError} chatting={chatting} chatError={chatError} onRetrySessionSave={() => void retrySessionSave()} onAnalyze={() => void runAnalysis(session)} onRetryAnalysisSave={() => void retryAnalysisSave()} onFollowUp={followUp} onBack={returnHome} />}
      {historyOpen && <HistoryPanel sessions={history} onClose={() => setHistoryOpen(false)} onOpen={(saved) => void openSession(saved)} onDelete={(id) => void deleteSession(id)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
