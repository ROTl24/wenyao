import { History, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { HomeScreen } from './components/HomeScreen';
import { ResultScreen } from './components/ResultScreen';
import { RitualScreen } from './components/RitualScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { desktop } from './lib/desktop';
import { randomToss, upgradePlate } from './lib/divination';
import { createBrowserLocalReport } from './lib/localAnalysis';
import { isValidQuestion } from './lib/question';
import type { EvidenceEntry, RetrievalDiagnostics } from './lib/retrieval';
import {
  confirmCurrentToss,
  createSession,
  prepareToss,
  withAnalysis,
  withMessage,
  type DivinationSession,
  type SessionCategory,
} from './lib/session';

type Screen = 'home' | 'casting' | 'result';
type AnalysisSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  const [screen, setScreen] = useState<Screen>('home');
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<SessionCategory | null>(null);
  const [session, setSession] = useState<DivinationSession | null>(null);
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

  useEffect(() => {
    void desktop.sessions.list().then((sessions) => {
      setHistory(sessions.map((saved) => saved.plate ? { ...saved, plate: upgradePlate(saved.plate) } : saved));
    });
  }, []);

  const commitSession = async (next: DivinationSession) => {
    const saved = await desktop.sessions.save(next);
    setSession(saved);
    setHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    return saved;
  };

  const persist = async (next: DivinationSession) => {
    setSession(next);
    try { await commitSession(next); }
    catch (error) { console.error('Failed to persist session', error); }
  };

  const persistAnalysis = async (next: DivinationSession) => {
    setSession(next);
    setAnalysisSaveStatus('saving');
    setAnalysisSaveError('');
    try {
      await commitSession(next);
      setAnalysisSaveStatus('saved');
    } catch (error) {
      console.error('Failed to persist analysis', error);
      setAnalysisSaveStatus('error');
      setAnalysisSaveError(error instanceof Error ? error.message : '写入历史记录失败。');
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
    if (!target.plate) return;
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysisSaveStatus('idle');
    setAnalysisSaveError('');
    try {
      const found = await evidenceFor(target);
      setEvidence(found.evidence);
      setRetrievalDiagnostics(found.diagnostics);
      const result = await desktop.ai.analyze({ question: target.question, category: target.category, plate: target.plate, evidence: found.evidence, retrievalDiagnostics: found.diagnostics || undefined });
      if (result.ok && result.report) {
        await persistAnalysis(withAnalysis(target, result.report));
      } else if (desktop.platform === 'browser') {
        await persistAnalysis(withAnalysis(target, createBrowserLocalReport(target, found.evidence)));
      } else {
        setAnalysisError(`${result.error?.message || 'AI 分析失败'} ${result.error?.nextAction || ''}`.trim());
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : '检索或分析服务暂时不可用。');
    } finally { setAnalyzing(false); }
  };

  const start = () => {
    if (!category || !isValidQuestion(question)) return;
    setAnalysisSaveStatus('idle');
    setAnalysisSaveError('');
    const next = prepareNext(createSession(question, category));
    void persist(next);
    setScreen('casting');
  };

  const confirm = () => {
    if (!session) return;
    let next = confirmCurrentToss(session);
    if (next.status === 'casting') next = prepareNext(next);
    void persist(next);
    if (next.status === 'complete') {
      setScreen('result');
      void runAnalysis(next);
    }
  };

  const openSession = async (saved: DivinationSession) => {
    let next = saved.plate ? { ...saved, plate: upgradePlate(saved.plate) } : saved;
    if (saved.status === 'casting') next = prepareNext(next);
    setSession(next);
    setQuestion(next.question);
    setCategory(next.category);
    setHistoryOpen(false);
    setAnalysisSaveStatus(next.analysis ? 'saved' : 'idle');
    setAnalysisSaveError('');
    if (next.status === 'complete') {
      const found = await evidenceFor(next);
      setEvidence(found.evidence);
      setRetrievalDiagnostics(found.diagnostics);
      setScreen('result');
    } else {
      setScreen('casting');
      void persist(next);
    }
  };

  const deleteSession = async (id: string) => {
    await desktop.sessions.delete(id);
    setHistory((current) => current.filter((item) => item.id !== id));
    if (session?.id === id) { setSession(null); setScreen('home'); }
  };

  const followUp = async (followQuestion: string) => {
    if (!session || !session.plate) return;
    setChatting(true);
    let next = withMessage(session, { id: crypto.randomUUID(), role: 'user', content: followQuestion, createdAt: new Date().toISOString() });
    await persist(next);
    const result = await desktop.ai.followUp({ question: followQuestion, session: next, evidence });
    const answer = result.ok && result.answer ? result.answer : {
      content: desktop.platform === 'browser' ? '浏览器预览不会发送 AI 请求；桌面应用会沿用本次排盘和古籍证据继续回答。' : `${result.error?.message || '追问失败'} ${result.error?.nextAction || ''}`,
    };
    next = withMessage(next, { id: crypto.randomUUID(), role: 'assistant', kind: result.ok && result.answer ? 'markdown-answer' : 'system-notice', content: answer.content, createdAt: new Date().toISOString() });
    await persist(next);
    setChatting(false);
  };

  const retryAnalysisSave = async () => {
    if (!session?.analysis) return;
    await persistAnalysis(session);
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
      {screen === 'result' && session?.plate && <ResultScreen session={session} evidence={evidence} retrievalDiagnostics={retrievalDiagnostics} analyzing={analyzing} analysisError={analysisError} analysisSaveStatus={analysisSaveStatus} analysisSaveError={analysisSaveError} chatting={chatting} onAnalyze={() => void runAnalysis(session)} onRetryAnalysisSave={() => void retryAnalysisSave()} onFollowUp={followUp} onBack={() => { setSession(null); setQuestion(''); setCategory(null); setAnalysisSaveStatus('idle'); setAnalysisSaveError(''); setScreen('home'); }} />}
      {historyOpen && <HistoryPanel sessions={history} onClose={() => setHistoryOpen(false)} onOpen={(saved) => void openSession(saved)} onDelete={(id) => void deleteSession(id)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
