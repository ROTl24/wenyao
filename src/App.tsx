import { GenerationTasks } from './components/GenerationTasks';
import { taskIsRunning, useGenerationTasks, type GenerationTask } from './lib/useGenerationTasks';
import { BookOpen, CalendarDays, History, MessageSquareHeart, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import packageInfo from '../package.json';
import corpusManifest from '../resources/corpus-manifest.json';
import { CalendarScreen } from './components/CalendarScreen';
import { CorpusLibraryPanel } from './components/CorpusLibraryPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { HomeScreen } from './components/HomeScreen';
import { PhysicalCastingScreen } from './components/PhysicalCastingScreen';
import { PhysicalReviewScreen } from './components/PhysicalReviewScreen';
import { ResultScreen, type EvidenceState } from './components/ResultScreen';
import { RitualScreen } from './components/RitualScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { FeedbackPanel } from './components/FeedbackPanel';
import { AISetupWizard } from './components/AISetupWizard';
import { UpdatePrompt, type PromptUpdateState } from './components/UpdatePrompt';
import { desktop } from './lib/desktop';
import { currentAlmanacSelection, type AlmanacSelection } from './lib/almanac';
import { isAIUsable } from './lib/aiStatus';
import { randomToss } from './lib/divination';
import { generateRandomCasting } from './lib/casting';
import { isValidQuestion } from './lib/question';
import {
  isClarificationQuestion,
  reselectEvidenceWithDiagnostics,
  type EvidenceEntry,
  type RetrievalDiagnostics,
} from './lib/retrieval';
import type { AnalysisEvidenceSnapshot } from './lib/types';
import type { SessionImportRequest } from './lib/sessionArchive';
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
  createCompletedSession,
  createSession,
  normalizeSession,
  prepareToss,
  withAnalysis,
  withMessage,
  type CastingMethod,
  type DivinationSession,
  type SessionCategory,
} from './lib/session';
import { deriveTimeCasting } from './lib/timeCasting';
import type { LineValue } from './lib/divination';
import type { AIConfigStatus, AIProviderCatalog, UpdateState } from './types/desktop';

type Screen = 'home' | 'casting' | 'physical-casting' | 'physical-review' | 'result';
type AnalysisSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SessionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const emptyAICatalog: AIProviderCatalog = { version: 1, defaultPresetId: '', presets: [], customProtocols: { generation: ['openai-chat'], embedding: ['openai-embeddings'], rerank: ['cohere-rerank', 'alibaba-rerank'] }, capabilityExamples: { generation: [], embedding: [], rerank: [] } };
const emptyAIStatus: AIConfigStatus = {
  status: 'unconfigured',
  message: '尚未连接 AI 服务',
  activeCapabilities: null,
  activeFingerprint: '',
  corpusCount: 0,
  consentAcceptedAt: '',
  connections: [],
  activePipeline: null,
  draft: null,
  usage: [],
};

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

function retrievalTerms(target: DivinationSession): string[] {
  if (!target.plate) return categoryTerms[target.category];
  return [
    ...categoryTerms[target.category],
    target.plate.baseHexagram.shortName,
    target.plate.changedHexagram.shortName,
    ...target.plate.lines.filter((line) => line.moving || line.role).flatMap((line) => [line.relation, line.role || '']),
  ].filter(Boolean);
}

function evidenceSnapshot(
  category: SessionCategory,
  evidence: EvidenceEntry[],
  retrieval: RetrievalDiagnostics,
): AnalysisEvidenceSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    appVersion: packageInfo.version,
    corpusVersion: retrieval.corpusVersion || corpusManifest.corpusVersion,
    category,
    evidence: structuredClone(evidence),
    retrieval: structuredClone(retrieval),
  };
}

function prepareNext(session: DivinationSession): DivinationSession {
  if (session.status === 'complete' || session.currentLine) return session;
  return prepareToss(session, randomToss(), crypto.randomUUID());
}

function mergeCompleteSessionState(
  current: DivinationSession | undefined,
  incoming: DivinationSession,
): DivinationSession {
  if (!current || current.id !== incoming.id) {
    return incoming;
  }
  const review = current.review && (!incoming.review || current.review.updatedAt > incoming.review.updatedAt) ? current.review : incoming.review;
  const updatedAt = incoming.updatedAt >= current.updatedAt ? incoming.updatedAt : current.updatedAt;
  if (current.status !== 'complete' || incoming.status !== 'complete') return { ...incoming, review, updatedAt };

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
    analysis: current.analysis && (!incoming.analysis || current.analysis.generatedAt > incoming.analysis.generatedAt) ? current.analysis : incoming.analysis,
    generationDraft: current.updatedAt > incoming.updatedAt ? current.generationDraft : incoming.generationDraft,
    review,
    messages,
    updatedAt,
  };
}

export function App() {
  const generation = useGenerationTasks();
  const [screen, setScreen] = useState<Screen>('home');
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<SessionCategory | null>(null);
  const [castingMethod, setCastingMethod] = useState<CastingMethod | null>(null);
  const [castingTimeInput, setCastingTimeInput] = useState(() => formatShanghaiDateTimeInput());
  const [physicalDraft, setPhysicalDraft] = useState<PhysicalCastDraft | null>(null);
  const [pendingPhysicalSession, setPendingPhysicalSession] = useState<DivinationSession | null>(null);
  const [physicalFinalizing, setPhysicalFinalizing] = useState(false);
  const [physicalFinalizeError, setPhysicalFinalizeError] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [pendingStartSession, setPendingStartSession] = useState<DivinationSession | null>(null);
  const [session, setSession] = useState<DivinationSession | null>(null);
  const [sessionSaveStatus, setSessionSaveStatus] = useState<SessionSaveStatus>('idle');
  const [sessionSaveError, setSessionSaveError] = useState('');
  const [history, setHistory] = useState<DivinationSession[]>([]);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const [evidenceState, setEvidenceState] = useState<EvidenceState>('idle');
  const [retrievalDiagnostics, setRetrievalDiagnostics] = useState<RetrievalDiagnostics | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarSelection, setCalendarSelection] = useState<AlmanacSelection>(() => currentAlmanacSelection());
  const [aiCatalog, setAICatalog] = useState<AIProviderCatalog>(emptyAICatalog);
  const [aiStatus, setAIStatus] = useState<AIConfigStatus>(emptyAIStatus);
  const [aiSetupOpen, setAISetupOpen] = useState(false);
  const [aiSetupIntent, setAISetupIntent] = useState<'settings' | 'analysis'>('settings');
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'unsupported',
    currentVersion: '',
  });
  const [updatePromptOpen, setUpdatePromptOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisSaveStatus, setAnalysisSaveStatus] = useState<AnalysisSaveStatus>('idle');
  const [analysisSaveError, setAnalysisSaveError] = useState('');
  const [chatError, setChatError] = useState('');
  const activeSessionIdRef = useRef<string | null>(null);
  const activeSessionRef = useRef<DivinationSession | null>(null);
  const latestSessionsRef = useRef(new Map<string, DivinationSession>());
  const deletedSessionIdsRef = useRef(new Set<string>());
  const sessionSaveQueuesRef = useRef(new Map<string, Promise<void>>());
  const analysisEpochsRef = useRef(new Map<string, symbol>());
  const pendingAnalysisIdsRef = useRef(new Set<string>());
  const pendingFollowUpIdsRef = useRef(new Set<string>());
  const aiStatusRef = useRef<AIConfigStatus>(emptyAIStatus);
  const dismissedUpdateVersionRef = useRef('');
  const updateAIStatus = (next: AIConfigStatus) => {
    aiStatusRef.current = next;
    setAIStatus(next);
  };
  const castingTimeError = useMemo(
    () => shanghaiDateTimeError(castingTimeInput),
    [castingTimeInput],
  );

  useEffect(() => {
    void desktop.sessions.list().then((sessions) => {
      const normalized = sessions.map(normalizeSession);
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

  useEffect(() => desktop.application.onOpenSettings(() => {
    setHistoryOpen(false);
    setLibraryOpen(false);
    setFeedbackOpen(false);
    setCalendarOpen(false);
    setSettingsOpen(true);
  }), []);

  useEffect(() => {
    let active = true;
    const acceptUpdateState = (next: UpdateState) => {
      if (!active) return;
      setUpdateState(next);
      if (next.status === 'available' && next.availableVersion !== dismissedUpdateVersionRef.current) {
        setUpdatePromptOpen(true);
      }
      if (next.status === 'downloaded') setUpdatePromptOpen(true);
    };
    const unsubscribe = desktop.updates.onState(acceptUpdateState);
    void desktop.updates.getState().then(acceptUpdateState);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const acceptAIStatus = (next: AIConfigStatus) => {
      if (!active) return;
      updateAIStatus(next);
    };
    const unsubscribe = desktop.aiConfig.onStatus(acceptAIStatus);
    void Promise.all([desktop.aiConfig.getCatalog(), desktop.aiConfig.getStatus()]).then(([catalog, status]) => {
      if (!active) return;
      setAICatalog(catalog);
      acceptAIStatus(status);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const checkForUpdate = async () => {
    const next = await desktop.updates.check();
    setUpdateState(next);
    if (next.status === 'available') setUpdatePromptOpen(true);
  };

  const downloadUpdate = async () => {
    setUpdatePromptOpen(true);
    const next = await desktop.updates.download();
    setUpdateState(next);
  };

  const installUpdate = () => {
    void desktop.updates.install();
  };

  const dismissUpdatePrompt = () => {
    if (updateState.status === 'available') {
      dismissedUpdateVersionRef.current = updateState.availableVersion;
    }
    setUpdatePromptOpen(false);
  };

  const openUpdatePrompt = () => {
    setSettingsOpen(false);
    setUpdatePromptOpen(true);
  };

  const isActiveSession = (id: string) => (
    activeSessionIdRef.current === id && !deletedSessionIdsRef.current.has(id)
  );

  const activateSession = (next: DivinationSession | null) => {
    const nextId = next?.id ?? null;
    if (activeSessionIdRef.current !== nextId) {
      setChatError('');
      setEvidence([]);
      setEvidenceState('idle');
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
      && analysisEpochsRef.current.get(next.id) === runToken
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
      return Boolean(saved);
    } catch (error) {
      console.error('Failed to persist analysis', error);
      if (ownsAnalysisUi()) {
        setAnalysisSaveStatus('error');
        setAnalysisSaveError(error instanceof Error ? error.message : '写入历史记录失败。');
      }
      return false;
    }
  };

  const evidenceFor = async (target: DivinationSession) => {
    if (!target.plate) return { evidence: [], diagnostics: null };
    const result = await desktop.retrieval.search({ query: target.question, domainTerms: retrievalTerms(target) });
    return { evidence: result.evidence, diagnostics: result.diagnostics };
  };

  const generationStopped = (task: GenerationTask) => generation.ref.current.get(task.sessionId)?.status === 'stopping';

  const saveUnfinishedGeneration = async (task: GenerationTask, error: string) => {
    if (deletedSessionIdsRef.current.has(task.sessionId)) return;
    const currentTask = generation.ref.current.get(task.sessionId);
    const current = latestSessionsRef.current.get(task.sessionId);
    if (!currentTask || currentTask.requestId !== task.requestId || !current) return;
    const status = currentTask.status === 'stopping' ? 'stopped' : 'failed';
    const updatedAt = new Date().toISOString();
    const next: DivinationSession = { ...current, updatedAt, generationDraft: { requestId: task.requestId, kind: task.kind, status, content: currentTask.content, question: task.question, updatedAt, ...(currentTask.evidence && currentTask.diagnostics ? { evidenceSnapshot: evidenceSnapshot(current.category, currentTask.evidence, currentTask.diagnostics) } : {}) } };
    latestSessionsRef.current.set(current.id, next);
    if (isActiveSession(current.id)) { activeSessionRef.current = next; setSession(next); }
    try {
      await commitSession(next);
      generation.update(task.requestId, { status, error, content: '' });
    } catch {
      generation.update(task.requestId, { status: 'save-error', error: '未完成草稿还没有写入占簿，请重试保存。' });
    }
  };

  const stopGeneration = async (sessionId: string) => {
    const task = generation.ref.current.get(sessionId);
    if (!task || task.status !== 'running') return;
    generation.update(task.requestId, { status: 'stopping' });
    try { await desktop.ai.cancel(task.requestId); }
    catch { generation.update(task.requestId, { error: '停止请求尚未确认，正在等待当前连接结束。' }); }
  };

  const retryGenerationSave = async (sessionId: string) => {
    const task = generation.ref.current.get(sessionId);
    const current = latestSessionsRef.current.get(sessionId);
    if (!task || !current || task.status !== 'save-error') return;
    try {
      await commitSession(current);
      generation.update(task.requestId, { status: current.generationDraft?.requestId === task.requestId ? current.generationDraft.status : 'complete', error: '', content: '' });
      if (isActiveSession(sessionId)) { setAnalysisSaveStatus(current.analysis ? 'saved' : 'idle'); setAnalysisSaveError(''); }
    } catch { generation.update(task.requestId, { error: '仍未写入占簿，请检查本机可用空间后重试保存。' }); }
  };

  const runAnalysis = async (target: DivinationSession, explicit = false, forceReady = false) => {
    if (!target.plate || deletedSessionIdsRef.current.has(target.id) || taskIsRunning(generation.ref.current.get(target.id)) || generation.ref.current.get(target.id)?.status === 'save-error') return;
    if (!forceReady && !isAIUsable(aiStatusRef.current)) {
      if (explicit) { setAISetupIntent('analysis'); setAISetupOpen(true); }
      return;
    }
    const runToken = Symbol(target.id);
    const task = generation.begin(target.id, target.question, 'analysis');
    pendingAnalysisIdsRef.current.add(target.id);
    analysisEpochsRef.current.set(target.id, runToken);
    const ownsAnalysisUi = () => isActiveSession(target.id) && analysisEpochsRef.current.get(target.id) === runToken;
    if (ownsAnalysisUi()) {
      setEvidenceState('loading'); setAnalysisError(''); setAnalysisSaveStatus('idle'); setAnalysisSaveError(''); setEvidence([]); setRetrievalDiagnostics(null);
    }
    let retrievalCompleted = false;
    try {
      const found = await evidenceFor(target);
      retrievalCompleted = true;
      if (deletedSessionIdsRef.current.has(target.id)) return;
      if (generationStopped(task)) { await saveUnfinishedGeneration(task, '已停止接收，本次解读未完成。'); return; }
      generation.update(task.requestId, { stage: 'connecting', evidence: found.evidence, diagnostics: found.diagnostics });
      if (ownsAnalysisUi()) {
        setEvidence(found.evidence); setEvidenceState(found.evidence.length ? 'ready' : 'empty'); setRetrievalDiagnostics(found.diagnostics);
      }
      const result = await desktop.ai.analyze({ requestId: task.requestId, question: target.question, category: target.category, castingMethod: target.castingMethod, castingBasis: target.castingBasis, plate: target.plate, evidence: found.evidence, retrievalDiagnostics: found.diagnostics || undefined }, (progress) => generation.progress(task.requestId, progress));
      if (deletedSessionIdsRef.current.has(target.id)) return;
      if (generationStopped(task)) { await saveUnfinishedGeneration(task, '已停止接收，本次解读未完成。'); return; }
      if (result.ok && result.report) {
        generation.update(task.requestId, { status: 'saving' });
        const report = { ...result.report, analysisId: crypto.randomUUID(), evidenceSnapshot: evidenceSnapshot(target.category, found.evidence, found.diagnostics!) };
        const saved = await persistAnalysis({ ...withAnalysis(latestSessionsRef.current.get(target.id) || target, report), generationDraft: null }, runToken);
        generation.update(task.requestId, { status: saved ? 'complete' : 'save-error', content: '', error: saved ? '' : '完整解读已收到，尚未写入占簿。' });
      } else {
        await saveUnfinishedGeneration(task, `${result.error?.message || 'AI 分析失败'} ${result.error?.nextAction || ''}`.trim());
      }
    } catch (error) {
      if (ownsAnalysisUi() && !retrievalCompleted) setEvidenceState('error');
      await saveUnfinishedGeneration(task, error instanceof Error ? error.message : '检索或分析服务暂时不可用。');
    } finally {
      pendingAnalysisIdsRef.current.delete(target.id);
    }
  };

  const start = async () => {
    if (!category || !castingMethod || !isValidQuestion(question) || starting) return;
    setSessionSaveStatus('idle');
    setSessionSaveError('');
    setAnalysisSaveStatus('idle');
    setAnalysisSaveError('');
    setPhysicalFinalizeError('');
    setPendingPhysicalSession(null);
    setStartError('');
    if (castingMethod === 'physical') {
      try {
        const castAt = parseShanghaiDateTimeInput(castingTimeInput);
        setPhysicalDraft(createPhysicalCastDraft(question, category, castAt));
        setPendingStartSession(null);
        activateSession(null);
        setScreen('physical-casting');
      } catch {
        return;
      }
      return;
    }

    let next = pendingStartSession;
    try {
      if (!next) {
        if (castingMethod === 'digital') {
          next = prepareNext(createSession(question, category, new Date(), 'digital'));
        } else if (castingMethod === 'random') {
          const castAt = new Date();
          next = createCompletedSession(
            question,
            category,
            castAt,
            generateRandomCasting(castAt),
          );
        } else {
          const castAt = new Date(parseShanghaiDateTimeInput(castingTimeInput));
          next = createCompletedSession(
            question,
            category,
            castAt,
            deriveTimeCasting(castAt),
          );
        }
        setPendingStartSession(next);
      }

      setStarting(true);
      setSessionSaveStatus('saving');
      activateSession(next);
      const saved = await commitSession(next);
      if (!saved) return;
      setPendingStartSession(null);
      setSessionSaveStatus('saved');
      setScreen(saved.status === 'complete' ? 'result' : 'casting');
      if (saved.status === 'complete') void runAnalysis(saved);
    } catch (error) {
      setSessionSaveStatus('error');
      setStartError(error instanceof Error ? error.message : '起卦保存失败，请重试。');
      activateSession(null);
    } finally {
      setStarting(false);
    }
  };

  const changeCastingMethod = (method: CastingMethod) => {
    if ((method === 'physical' || method === 'time') && castingMethod !== method) {
      setCastingTimeInput(formatShanghaiDateTimeInput());
    }
    setCastingMethod(method);
    setPendingStartSession(null);
    setStartError('');
    setPhysicalFinalizeError('');
  };

  const changeCastingTime = (value: string) => {
    if (physicalFinalizing) return;
    setCastingTimeInput(value);
    setPendingStartSession(null);
    setStartError('');
    setPendingPhysicalSession(null);
    setPhysicalFinalizeError('');
  };

  const confirm = () => {
    if (!session) return;
    let next = confirmCurrentToss(session);
    if (next.status === 'casting') next = prepareNext(next);
    activateSession(next);
    if (next.status === 'complete') {
      setScreen('result');
      setSessionSaveStatus('saving');
      setSessionSaveError('');
      void commitSession(next)
        .then((saved) => {
          if (!saved) return;
          if (isActiveSession(saved.id)) {
            setSessionSaveStatus('saved');
            setScreen('result');
          }
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
    if (!physicalDraft || castingTimeError || physicalFinalizing) return;
    setPhysicalFinalizing(true);
    setPhysicalFinalizeError('');
    try {
      const castAt = parseShanghaiDateTimeInput(castingTimeInput);
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
    let next = normalizeSession(latestSessionsRef.current.get(saved.id) || saved);
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
    setCastingTimeInput(formatShanghaiDateTimeInput(new Date(next.castAt)));
    setHistoryOpen(false);
    setSessionSaveStatus('saved');
    setSessionSaveError('');
    const task = generation.ref.current.get(next.id);
    setAnalysisSaveStatus(task?.kind === 'analysis' && task.status === 'save-error' ? 'error' : next.analysis ? 'saved' : 'idle');
    setAnalysisSaveError(task?.status === 'save-error' ? task.error : '');
    if (next.status === 'complete') {
      setScreen('result');
      const snapshot = next.analysis?.evidenceSnapshot;
      setEvidence(snapshot?.evidence || []);
      setEvidenceState(snapshot ? snapshot.evidence.length ? 'ready' : 'empty' : 'idle');
      setRetrievalDiagnostics(snapshot?.retrieval || null);
    } else {
      setScreen('casting');
      void persist(next);
    }
  };

  const importSessions = async (payload: SessionImportRequest) => {
    if (generation.tasks.some((task) => task.status === 'save-error') || pendingAnalysisIdsRef.current.size || pendingFollowUpIdsRef.current.size || sessionSaveQueuesRef.current.size || starting || physicalFinalizing) {
      throw new Error('请等待当前生成或保存完成后再导入备份。');
    }
    if (analysisSaveStatus === 'error' || sessionSaveStatus === 'error' || pendingPhysicalSession || pendingStartSession) {
      throw new Error('当前记录尚未保存，请先重试保存，再导入备份。');
    }
    const restored = (await desktop.sessions.import(payload)).map(normalizeSession);
    latestSessionsRef.current = new Map(restored.map((item) => [item.id, item]));
    restored.forEach((item) => deletedSessionIdsRef.current.delete(item.id));
    setHistory(restored);
    const active = restored.find((item) => item.id === activeSessionIdRef.current);
    if (active) {
      activeSessionRef.current = active;
      setSession(active);
      const snapshot = active.analysis?.evidenceSnapshot;
      setEvidence(snapshot?.evidence || []);
      setRetrievalDiagnostics(snapshot?.retrieval || null);
      setEvidenceState(snapshot ? snapshot.evidence.length ? 'ready' : 'empty' : 'idle');
      setAnalysisSaveStatus(active.analysis ? 'saved' : 'idle');
      setAnalysisSaveError('');
      setAnalysisError('');
      setScreen(active.status === 'complete' ? 'result' : active.castingMethod === 'physical' ? active.lines.length === 6 ? 'physical-review' : 'physical-casting' : 'casting');
    }
  };

  const deleteSession = async (id: string) => {
    void stopGeneration(id);
    deletedSessionIdsRef.current.add(id);
    try {
      await sessionSaveQueuesRef.current.get(id);
      await desktop.sessions.delete(id);
      analysisEpochsRef.current.delete(id);
      latestSessionsRef.current.delete(id);
      generation.dismiss(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      if (activeSessionIdRef.current === id) returnHome();
    } catch (error) {
      deletedSessionIdsRef.current.delete(id);
      console.error('Failed to delete session', error);
      window.alert(error instanceof Error ? `删除失败：${error.message}` : '删除失败，请稍后重试。');
    }
  };

  const saveReview = async (id: string, review: import('./lib/session').SessionReview) => {
    const current = latestSessionsRef.current.get(id);
    if (!current || deletedSessionIdsRef.current.has(id)) throw new Error('这条占簿记录已被删除，请关闭后重新打开占簿。');
    await commitSession({ ...current, review, updatedAt: review.updatedAt });
  };

  const followUp = async (followQuestion: string) => {
    if (!session || !session.plate || taskIsRunning(generation.ref.current.get(session.id)) || generation.ref.current.get(session.id)?.status === 'save-error') return;
    if (!isAIUsable(aiStatus)) {
      setAISetupIntent('analysis');
      setAISetupOpen(true);
      setChatError('请先完成 AI 解读主模型配置。');
      return;
    }
    const targetId = session.id;
    const task = generation.begin(targetId, followQuestion, 'followUp');
    let answerReceived = false;
    pendingFollowUpIdsRef.current.add(targetId);
    setChatError('');
    try {
      let next = withMessage(session, { id: crypto.randomUUID(), role: 'user', content: followQuestion, createdAt: new Date().toISOString() });
      activateSession(next);
      const savedWithQuestion = await commitSession(next);
      if (!savedWithQuestion || deletedSessionIdsRef.current.has(targetId)) return;
      next = savedWithQuestion;
      const terms = retrievalTerms(next);
      let followEvidence: EvidenceEntry[];
      let followDiagnostics: RetrievalDiagnostics;
      const priorSnapshot = [...next.messages].reverse().find((message) => message.role === 'assistant' && message.evidenceSnapshot)?.evidenceSnapshot
        || next.analysis?.evidenceSnapshot;
      if (isClarificationQuestion(followQuestion) && priorSnapshot?.evidence.length) {
        const locallyReselected = reselectEvidenceWithDiagnostics(priorSnapshot.evidence, followQuestion, terms);
        followEvidence = locallyReselected.evidence.length ? locallyReselected.evidence : priorSnapshot.evidence;
        followDiagnostics = locallyReselected.evidence.length
          ? { ...locallyReselected.diagnostics, corpusVersion: priorSnapshot.corpusVersion }
          : {
              ...locallyReselected.diagnostics,
              selectedCandidates: priorSnapshot.evidence.length,
              serializedCharacters: priorSnapshot.evidence.reduce((sum, item) => sum + item.text.length, 0),
              stages: [...(locallyReselected.diagnostics.stages || []), '未命中追问词，沿用既有证据'],
              rankings: {
                ...(locallyReselected.diagnostics.rankings || { bm25: [], vector: [], fusion: [], rerank: [], final: [] }),
                final: priorSnapshot.evidence.map((item, index) => ({ id: item.id, rank: index + 1, score: 0 })),
              },
              corpusVersion: priorSnapshot.corpusVersion,
            };
      } else {
        const found = await desktop.retrieval.search({ query: followQuestion, domainTerms: terms });
        followEvidence = found.evidence;
        followDiagnostics = found.diagnostics;
      }
      if (generationStopped(task)) { await saveUnfinishedGeneration(task, '已停止接收，本次追问未完成。'); return; }
      if (deletedSessionIdsRef.current.has(targetId)) return;
      generation.update(task.requestId, { stage: 'connecting', evidence: followEvidence, diagnostics: followDiagnostics });
      const result = await desktop.ai.followUp({ requestId: task.requestId, question: followQuestion, session: next, evidence: followEvidence }, (progress) => generation.progress(task.requestId, progress));
      if (deletedSessionIdsRef.current.has(targetId)) return;
      if (generationStopped(task)) { await saveUnfinishedGeneration(task, '已停止接收，本次追问未完成。'); return; }
      if (!result.ok || !result.answer) { await saveUnfinishedGeneration(task, `${result.error?.message || '追问失败'} ${result.error?.nextAction || ''}`.trim()); return; }
      answerReceived = true;
      generation.update(task.requestId, { status: 'saving' });
      const answer = result.answer;
      next = mergeCompleteSessionState(
        latestSessionsRef.current.get(targetId),
        withMessage(next, {
          id: crypto.randomUUID(),
          role: 'assistant',
          kind: result.ok && result.answer ? 'markdown-answer' : 'system-notice',
          content: answer.content,
          createdAt: new Date().toISOString(),
          ...(result.ok && result.answer ? { evidenceSnapshot: evidenceSnapshot(next.category, followEvidence, followDiagnostics) } : {}),
          ...(result.ok && result.answer?.provider ? { provider: result.answer.provider } : {}),
        }),
      );
      next = { ...next, generationDraft: null };
      latestSessionsRef.current.set(targetId, next);
      if (isActiveSession(targetId)) { activeSessionRef.current = next; setSession(next); }
      await commitSession(next);
      generation.update(task.requestId, { status: 'complete', content: '', error: '' });
    } catch (error) {
      if (answerReceived) generation.update(task.requestId, { status: 'save-error', error: '完整追问已收到，尚未写入占簿。' });
      else await saveUnfinishedGeneration(task, error instanceof Error ? error.message : '追问保存或发送失败。');
    } finally {
      pendingFollowUpIdsRef.current.delete(targetId);
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
    setPendingStartSession(null);
    setStarting(false);
    setStartError('');
    setPhysicalDraft(null);
    setPendingPhysicalSession(null);
    setPhysicalFinalizing(false);
    setCastingTimeInput(formatShanghaiDateTimeInput());
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
    if (calendarOpen) return '问爻 · 日历';
    if (screen === 'home') return '问爻';
    if (screen === 'casting') return '六爻起卦';
    if (screen === 'physical-casting') return '线下起卦';
    if (screen === 'physical-review') return '六爻终审';
    return '排盘与解读';
  }, [calendarOpen, screen]);

  const openCalendar = () => {
    setHistoryOpen(false);
    setLibraryOpen(false);
    setFeedbackOpen(false);
    setSettingsOpen(false);
    setCalendarOpen(true);
  };

  const visibleTask = generation.tasks.find((task) => task.sessionId === session?.id);
  const visibleRunning = taskIsRunning(visibleTask);
  const visibleSnapshot = session?.analysis?.evidenceSnapshot ?? session?.generationDraft?.evidenceSnapshot;
  const visibleEvidence = visibleTask?.kind === 'analysis' && visibleRunning ? visibleTask.evidence ?? [] : visibleSnapshot?.evidence ?? evidence;
  const visibleDiagnostics = visibleTask?.kind === 'analysis' && visibleRunning ? visibleTask.diagnostics ?? null : visibleSnapshot?.retrieval ?? retrievalDiagnostics;
  return (
    <div className="app-shell">
      <header className="app-chrome">
        <div className="chrome-brand"><span>爻</span><strong>{appTitle}</strong></div>
        <nav>
          <button type="button" aria-label="日历" aria-current={calendarOpen ? 'page' : undefined} disabled={physicalFinalizing} onClick={openCalendar}><CalendarDays size={17} /><span>日历</span></button>
          <button type="button" aria-label="古籍书库" aria-current={libraryOpen ? 'page' : undefined} disabled={physicalFinalizing} onClick={() => { setCalendarOpen(false); setHistoryOpen(false); setFeedbackOpen(false); setSettingsOpen(false); setLibraryOpen(true); }}><BookOpen size={17} /><span>古籍</span></button>
          <button type="button" aria-label="历史记录" aria-current={historyOpen ? 'page' : undefined} disabled={physicalFinalizing} onClick={() => { setCalendarOpen(false); setLibraryOpen(false); setFeedbackOpen(false); setSettingsOpen(false); setHistoryOpen(true); }}><History size={17} /><span>历史</span></button>
          <button type="button" aria-label="反馈管理" aria-current={feedbackOpen ? 'page' : undefined} disabled={physicalFinalizing} onClick={() => { setCalendarOpen(false); setLibraryOpen(false); setHistoryOpen(false); setSettingsOpen(false); setFeedbackOpen(true); }}><MessageSquareHeart size={17} /><span>反馈</span></button>
          <button type="button" aria-label="应用设置" aria-current={settingsOpen ? 'page' : undefined} disabled={physicalFinalizing} onClick={() => { setCalendarOpen(false); setLibraryOpen(false); setHistoryOpen(false); setFeedbackOpen(false); setSettingsOpen(true); }}><Settings2 size={17} /><span>设置</span></button>
        </nav>
      </header>
      {calendarOpen ? (
        <CalendarScreen
          selection={calendarSelection}
          onSelectionChange={setCalendarSelection}
          onClose={() => setCalendarOpen(false)}
        />
      ) : (
        <>
          {screen === 'home' && (
            <HomeScreen
              question={question}
              category={category}
              castingMethod={castingMethod}
              castingTimeInput={castingTimeInput}
              castingTimeError={castingTimeError}
              starting={starting}
              startError={startError}
              onQuestionChange={(value) => {
                setQuestion(value);
                setPendingStartSession(null);
                setStartError('');
              }}
              onCategoryChange={(value) => {
                setCategory(value);
                setPendingStartSession(null);
                setStartError('');
              }}
              onCastingMethodChange={changeCastingMethod}
              onCastingTimeChange={changeCastingTime}
              onStart={() => void start()}
            />
          )}
          {screen === 'casting' && session?.currentLine && <RitualScreen session={session} onConfirm={confirm} />}
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
              timeInput={castingTimeInput}
              timeError={castingTimeError}
              finalizing={physicalFinalizing}
              finalizeError={physicalFinalizeError}
              onTimeChange={changeCastingTime}
              onChangeLine={changePhysicalLine}
              onConfirm={() => void finalizePhysical()}
              onCancel={discardPhysicalDraft}
            />
          )}
          {screen === 'result' && session?.plate && <ResultScreen session={session} evidence={visibleEvidence} evidenceState={visibleRunning && visibleTask?.stage === 'retrieving' ? 'loading' : visibleDiagnostics ? visibleEvidence.length ? 'ready' : 'empty' : evidenceState} retrievalDiagnostics={visibleDiagnostics} aiStatus={aiStatus} aiAvailable={desktop.runtime.capabilities.ai} sessionSaveStatus={sessionSaveStatus} sessionSaveError={sessionSaveError} analyzing={visibleRunning && visibleTask?.kind === 'analysis'} analysisProgress={visibleTask ? { stage: visibleTask.stage, startedAt: visibleTask.startedAt } : null} generationTask={visibleTask} onStopGeneration={() => void stopGeneration(session.id)} onRetryGenerationSave={() => void retryGenerationSave(session.id)} analysisError={analysisError} analysisSaveStatus={analysisSaveStatus} analysisSaveError={analysisSaveError} chatting={visibleRunning && visibleTask?.kind === 'followUp'} chatError={chatError} onRetrySessionSave={() => void retrySessionSave()} onAnalyze={() => void runAnalysis(session, true)} onRetryAnalysisSave={() => visibleTask?.status === 'save-error' ? void retryGenerationSave(session.id) : void retryAnalysisSave()} onFollowUp={followUp} onBack={returnHome} />}
        </>
      )}
      <GenerationTasks tasks={generation.tasks} onOpen={(id) => { const saved = latestSessionsRef.current.get(id); if (saved) void openSession(saved); }} onStop={(id) => void stopGeneration(id)} onDismiss={(id) => generation.dismiss(id)} />
      {historyOpen && <HistoryPanel onSaveReview={saveReview} onImport={importSessions} sessions={history} onClose={() => setHistoryOpen(false)} onOpen={(saved) => void openSession(saved)} onDelete={(id) => void deleteSession(id)} />}
      {feedbackOpen && <FeedbackPanel onClose={() => setFeedbackOpen(false)} />}
      {libraryOpen && <CorpusLibraryPanel aiStatus={aiStatus} onClose={() => setLibraryOpen(false)} />}
      {settingsOpen && (
        <SettingsPanel
          updateState={updateState}
          aiStatus={aiStatus}
          aiCatalog={aiCatalog}
          onConfigureAI={() => { setAISetupIntent('settings'); setAISetupOpen(true); }}
          onCheckUpdate={() => void checkForUpdate()}
          onOpenUpdate={openUpdatePrompt}
          onOpenCorpus={() => { setSettingsOpen(false); setLibraryOpen(true); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {aiSetupOpen && aiCatalog.presets.length ? (
        <AISetupWizard
          catalog={aiCatalog}
          status={aiStatus}
          onStatus={updateAIStatus}
          onClose={() => setAISetupOpen(false)}
          onReady={() => {
            setAISetupOpen(false);
            if (aiSetupIntent === 'analysis' && activeSessionRef.current?.status === 'complete') {
              void runAnalysis(activeSessionRef.current, true, true);
            }
          }}
        />
      ) : null}
      {updatePromptOpen && ['available', 'downloading', 'downloaded', 'error'].includes(updateState.status) && (
        <UpdatePrompt
          state={updateState as PromptUpdateState}
          onDownload={() => void downloadUpdate()}
          onInstall={installUpdate}
          onDismiss={dismissUpdatePrompt}
        />
      )}
    </div>
  );
}
