import { History, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { HomeScreen } from './components/HomeScreen';
import { ResultScreen } from './components/ResultScreen';
import { RitualScreen } from './components/RitualScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { desktop } from './lib/desktop';
import { randomToss } from './lib/divination';
import { createBrowserLocalReport } from './lib/localAnalysis';
import { searchEvidence, type EvidenceEntry } from './lib/retrieval';
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
  const [corpus, setCorpus] = useState<EvidenceEntry[]>([]);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    void Promise.all([desktop.sessions.list(), desktop.corpus.list()]).then(([sessions, entries]) => {
      setHistory(sessions);
      setCorpus(entries);
    });
  }, []);

  const persist = async (next: DivinationSession) => {
    setSession(next);
    try {
      const saved = await desktop.sessions.save(next);
      setHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    } catch (error) {
      console.error('Failed to persist session', error);
    }
  };

  const evidenceFor = (target: DivinationSession) => {
    if (!target.plate) return [];
    const terms = [
      ...categoryTerms[target.category],
      target.plate.baseHexagram.shortName,
      target.plate.changedHexagram.shortName,
      ...target.plate.lines.filter((line) => line.moving || line.role).flatMap((line) => [line.relation, line.role || '']),
    ].filter(Boolean);
    return searchEvidence(corpus, target.question, terms, 8);
  };

  const runAnalysis = async (target: DivinationSession) => {
    if (!target.plate) return;
    setAnalyzing(true);
    setAnalysisError('');
    const found = evidenceFor(target);
    setEvidence(found);
    const result = await desktop.ai.analyze({ question: target.question, category: target.category, plate: target.plate, evidence: found });
    if (result.ok && result.report) {
      await persist(withAnalysis(target, result.report));
    } else if (desktop.platform === 'browser') {
      await persist(withAnalysis(target, createBrowserLocalReport(target, found)));
    } else {
      setAnalysisError(`${result.error?.message || 'AI 分析失败'} ${result.error?.nextAction || ''}`.trim());
    }
    setAnalyzing(false);
  };

  const start = () => {
    if (!category || question.trim().length < 10) return;
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

  const openSession = (saved: DivinationSession) => {
    let next = saved;
    if (saved.status === 'casting') next = prepareNext(saved);
    setSession(next);
    setQuestion(next.question);
    setCategory(next.category);
    setHistoryOpen(false);
    if (next.status === 'complete') {
      const found = evidenceFor(next);
      setEvidence(found);
      setScreen('result');
      if (!next.analysis) void runAnalysis(next);
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
      evidenceIds: [],
    };
    next = withMessage(next, { id: crypto.randomUUID(), role: 'assistant', content: answer.content, evidenceIds: answer.evidenceIds, createdAt: new Date().toISOString() });
    await persist(next);
    setChatting(false);
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
      {screen === 'result' && session?.plate && <ResultScreen session={session} evidence={evidence} analyzing={analyzing} analysisError={analysisError} chatting={chatting} onAnalyze={() => void runAnalysis(session)} onFollowUp={followUp} onBack={() => { setSession(null); setQuestion(''); setCategory(null); setScreen('home'); }} />}
      {historyOpen && <HistoryPanel sessions={history} onClose={() => setHistoryOpen(false)} onOpen={openSession} onDelete={(id) => void deleteSession(id)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
