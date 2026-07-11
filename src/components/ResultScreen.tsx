import { ArrowLeft, BookMarked, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PlateLine } from '../lib/divination';
import type { EvidenceEntry, RetrievalDiagnostics } from '../lib/retrieval';
import type { DivinationSession } from '../lib/session';
import { HexagramLines } from './HexagramLines';

interface Props {
  session: DivinationSession;
  evidence: EvidenceEntry[];
  retrievalDiagnostics: RetrievalDiagnostics | null;
  analyzing: boolean;
  analysisError: string;
  chatting: boolean;
  onAnalyze(): void;
  onFollowUp(question: string): void;
  onBack(): void;
}

export function ResultScreen({ session, evidence, retrievalDiagnostics, analyzing, analysisError, chatting, onAnalyze, onFollowUp, onBack }: Props) {
  const [followUp, setFollowUp] = useState('');
  const plate = session.plate!;
  const evidenceById = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);
  const baseBits = plate.lines.map((line) => line.baseYang).reverse();
  const changedBits = plate.lines.map((line) => line.changedYang).reverse();
  const submit = () => {
    if (!followUp.trim() || chatting) return;
    onFollowUp(followUp.trim());
    setFollowUp('');
  };
  return (
    <main className="result-screen">
      <header className="result-header">
        <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={17} />返回问事</button>
        <div><span>{new Date(session.castAt).toLocaleString('zh-CN')}</span><strong>{session.question}</strong></div>
        <span className="rule-version">文王纳甲 · 字二背三</span>
      </header>
      <div className="result-workspace">
        <section className="plate-column">
          <div className="section-title"><i />排盘</div>
          <div className="hexagram-pair">
            <div><span>本卦</span><strong>{plate.baseHexagram.name}</strong><HexagramLines lines={baseBits} moving={plate.movingLines} /></div>
            <div className="change-arrow">→</div>
            <div><span>变卦</span><strong>{plate.changedHexagram.name}</strong><HexagramLines lines={changedBits} /></div>
          </div>
          <div className="calendar-line">
            <span>{plate.monthGanZhi}月</span><span>{plate.dayGanZhi}日</span><span>旬空 {plate.voidBranches.join('、')}</span><span>{plate.baseHexagram.palace}宫 · {plate.baseHexagram.generation}</span>
          </div>
          <div className="plate-table">
            {[...plate.lines].reverse().map((line) => (
              <div className={line.moving ? 'plate-row plate-row--moving' : 'plate-row'} key={line.index}>
                <span className="line-index">{['初', '二', '三', '四', '五', '上'][line.index - 1]}爻</span>
                <span className="beast">{line.beast}</span>
                <span className="relation">{line.relation} {line.ganZhi}{line.element}<small>{lineFacts(line)}</small></span>
                <span className="mini-line">{line.baseYang ? <i className="solid" /> : <><i /><i /></>}</span>
                <span className="line-kind">{line.label}</span>
                <span className="line-role">{line.role || ''}</span>
                {line.moving && <><span className="moving-arrow">→</span><span className="changed-relation">{line.changedRelation} {line.changedGanZhi}{line.changedElement}<small>{changedLineFacts(line)}</small></span></>}
              </div>
            ))}
          </div>
        </section>
        <section className="analysis-column">
          <div className="section-title"><i />AI 解读</div>
          {analyzing && <div className="analysis-loading"><span className="ink-loader" /><strong>正在检索古籍并校验排盘…</strong><p>排盘事实已经锁定，AI 只能依据当前卦象与证据解释。</p></div>}
          {!analyzing && analysisError && <div className="analysis-error"><strong>AI 分析暂时失败</strong><p>{analysisError}</p><button type="button" onClick={onAnalyze}><RefreshCw size={16} />重新分析</button></div>}
          {!analyzing && session.analysis && (
            <article className="analysis-report">
              <div className="analysis-mode"><Sparkles size={15} />{session.analysis.mode === 'cloud' ? '云端 AI · 已校验' : '本地基础推演'}</div>
              {session.analysis.pipeline && <div className="pipeline-trace"><span>排盘事实锁定</span><span>证据引用校验</span><span>{session.analysis.pipeline.retrievalMode === 'hybrid-reranked' ? '混合召回 + 模型重排' : session.analysis.pipeline.retrievalMode === 'hybrid-fused' ? '混合召回 + 融合排序' : '关键词降级检索'}</span></div>}
              <ReportSection title="卦象总断" body={session.analysis.summary} />
              <ReportSection title="用神取用" body={session.analysis.focus} />
              <ReportSection title="日月生克" body={session.analysis.relations} />
              <ReportSection title="动爻与变卦" body={session.analysis.moving} />
              {session.analysis.claims.length > 0 && (
                <section className="report-section"><h3>古籍规则</h3>{session.analysis.claims.map((claim, index) => (
                  <div className="claim" key={`${claim.text}-${index}`}><p>{claim.text}</p><div>{claim.evidenceIds.map((id) => <a href={`#evidence-${id}`} key={id}>{evidenceById.get(id)?.source || id}</a>)}<span>可信度 {claim.confidence}</span></div></div>
                ))}</section>
              )}
              <ReportSection title="综合判断" body={session.analysis.synthesis} />
              <section className="report-section report-guidance"><h3>行动建议</h3><ol>{session.analysis.guidance.map((item) => <li key={item}>{item}</li>)}</ol></section>
              {session.analysis.uncertainties.map((item) => <p className="uncertainty" key={item}>{item}</p>)}
            </article>
          )}
        </section>
      </div>
      <section className="evidence-rail">
        <div className="section-title"><i />古籍依据</div>
        {retrievalDiagnostics && <div className={`retrieval-status retrieval-status--${retrievalDiagnostics.mode}`}><strong>{retrievalDiagnostics.mode === 'hybrid-reranked' ? '向量 + 关键词 + qwen3-rerank' : retrievalDiagnostics.mode === 'hybrid-fused' ? '向量 + 关键词融合' : '关键词检索（降级）'}</strong><span>关键词候选 {retrievalDiagnostics.lexicalCandidates} · 向量候选 {retrievalDiagnostics.vectorCandidates}</span>{retrievalDiagnostics.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>}
        <div className="evidence-list">
          {evidence.length ? evidence.map((item) => (
            <article id={`evidence-${item.id}`} className="evidence-entry" key={item.id}>
              <div className="evidence-thumbnail"><BookMarked size={26} /><span>{item.sourceType === 'original' ? '原' : '摘'}</span></div>
              <div><strong>{item.title}</strong><span>{item.source} · {item.location} · {item.knowledgeKind === 'rule' ? '规则' : item.knowledgeKind === 'case' ? '占例' : '义理'}</span><p>{item.text}</p></div>
            </article>
          )) : <p className="empty-evidence">当前知识库没有找到足够证据，因此不会编造古籍引用。</p>}
        </div>
      </section>
      <section className="chat-dock">
        <div className="chat-history">
          {session.messages.map((message) => <div className={`chat-message chat-message--${message.role}`} key={message.id}><span>{message.role === 'user' ? '你' : '问爻'}</span><p>{message.content}</p></div>)}
        </div>
        <label htmlFor="follow-up">继续追问</label>
        <div className="chat-input"><input id="follow-up" value={followUp} onChange={(event) => setFollowUp(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} placeholder="基于本次卦象，继续问一个相关问题…" /><button type="button" onClick={submit} disabled={!followUp.trim() || chatting}>{chatting ? <span className="small-loader" /> : <Send size={17} />}<span>继续追问</span></button></div>
      </section>
    </main>
  );
}

function ReportSection({ title, body }: { title: string; body: string }) {
  return <section className="report-section"><h3>{title}</h3><p>{body}</p></section>;
}

function lineFacts(line: PlateLine) {
  return [[line.void, '空'], [line.monthBreak, '月破'], [line.dayClash, '日冲'], [line.monthCombine, '月合'], [line.dayCombine, '日合']].filter(([active]) => active).map(([, label]) => label).join(' · ');
}

function changedLineFacts(line: PlateLine) {
  return [[line.changedVoid, '空'], [line.changedMonthBreak, '月破'], [line.changedDayClash, '日冲'], [line.changedMonthCombine, '月合'], [line.changedDayCombine, '日合']].filter(([active]) => active).map(([, label]) => label).join(' · ');
}
