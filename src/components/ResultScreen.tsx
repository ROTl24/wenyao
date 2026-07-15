import { ArrowLeft, BookMarked, ChevronDown, RefreshCw, Send, Sparkles } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import type { PlateLine } from '../lib/divination';
import type { EvidenceEntry, RetrievalDiagnostics } from '../lib/retrieval';
import type { DivinationSession } from '../lib/session';
import { HexagramLines } from './HexagramLines';
import { MarkdownContent } from './MarkdownContent';
import { StemBranchText } from './StemBranchText';

interface Props {
  session: DivinationSession;
  evidence: EvidenceEntry[];
  retrievalDiagnostics: RetrievalDiagnostics | null;
  analyzing: boolean;
  analysisError: string;
  analysisSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  analysisSaveError: string;
  chatting: boolean;
  onAnalyze(): void;
  onRetryAnalysisSave(): void;
  onFollowUp(question: string): void;
  onBack(): void;
}

export function ResultScreen({ session, evidence, retrievalDiagnostics, analyzing, analysisError, analysisSaveStatus, analysisSaveError, chatting, onAnalyze, onRetryAnalysisSave, onFollowUp, onBack }: Props) {
  const [followUp, setFollowUp] = useState('');
  const plate = session.plate!;
  const evidenceSourceCount = useMemo(() => new Set(evidence.map((item) => item.source)).size, [evidence]);
  const fuShenByLine = useMemo(() => new Map(plate.fuShen.map((item) => [item.lineIndex, item])), [plate.fuShen]);
  const baseBits = plate.lines.map((line) => line.baseYang).reverse();
  const changedBits = plate.lines.map((line) => line.changedYang).reverse();
  const hasMovingLines = plate.movingLines.length > 0;
  const markdownAnalysis = session.analysis && typeof session.analysis.markdown === 'string' && session.analysis.markdown.trim()
    ? session.analysis
    : null;
  const legacyAnalysis = Boolean(session.analysis && !markdownAnalysis);
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
            <div><span>本卦 · {plate.baseHexagram.palace}宫{plate.baseHexagram.generation}</span><strong>{plate.baseHexagram.name}</strong><HexagramLines lines={baseBits} moving={plate.movingLines} /></div>
            <div className="change-arrow">→</div>
            <div><span>变卦 · {plate.changedHexagram.palace}宫{plate.changedHexagram.generation}</span><strong>{plate.changedHexagram.name}</strong><HexagramLines lines={changedBits} /></div>
          </div>
          <div className="calendar-board" aria-label="四柱历法">
            <div className="calendar-grid calendar-grid--header">
              <span>历法</span>
              {plate.pillars.map((pillar) => <span key={pillar.label}>{pillar.label}</span>)}
            </div>
            <div className="calendar-grid calendar-grid--ganzhi">
              <span>干支</span>
              {plate.pillars.map((pillar) => <strong aria-label={`${pillar.label}干支`} key={pillar.label}><StemBranchText value={pillar.ganZhi} /></strong>)}
            </div>
            <div className="calendar-grid">
              <span>旬空</span>
              {plate.pillars.map((pillar) => <span aria-label={`${pillar.label}旬空`} key={pillar.label}><StemBranchText value={pillar.voidBranches.join('、')} /></span>)}
            </div>
            <div className="calendar-grid">
              <span>十二长生</span>
              {plate.pillars.map((pillar) => <span aria-label={`${pillar.label}十二长生`} key={pillar.label}>{pillar.twelveStage}</span>)}
            </div>
          </div>
          <div className="plate-facts" id="plate-facts">
            <div className="shen-sha-line"><strong>神煞</strong><div>{plate.shenSha.map((item) => <span key={item.name}><b>{item.name}</b><StemBranchText value={item.branches.join('、')} /></span>)}</div></div>
            <span className="palace-meta">{plate.baseHexagram.palace}宫·{plate.baseHexagram.generation} → {plate.changedHexagram.palace}宫·{plate.changedHexagram.generation}</span>
          </div>
          {plate.fuShen.length > 0 && <p className="fu-shen-note">主卦缺失六亲，按本宫首卦补出伏神；伏神显示在同爻位飞神之下。</p>}
          <div className={hasMovingLines ? 'plate-table plate-table--changed' : 'plate-table'}>
            {hasMovingLines && (
              <div className="plate-row plate-row--header" aria-hidden="true">
                <span>爻位</span><span>六神</span>
                <strong className="plate-side-title plate-side-title--base">本卦 · {plate.baseHexagram.name}</strong>
                <span className="moving-arrow">→</span>
                <strong className="plate-side-title plate-side-title--changed">变卦 · {plate.changedHexagram.name}</strong>
              </div>
            )}
            {[...plate.lines].reverse().map((line) => {
              const fuShen = fuShenByLine.get(line.index);
              return (
                <Fragment key={line.index}>
                  <div className={line.moving ? 'plate-row plate-row--moving' : 'plate-row'}>
                    <span className="line-index">{['初', '二', '三', '四', '五', '上'][line.index - 1]}爻</span>
                    <span className="beast">{line.beast}</span>
                    <span className="relation">{line.relation} <StemBranchText value={line.ganZhi} />{line.element}<small>{lineFacts(line)}</small></span>
                    <span className="mini-line">{line.baseYang ? <i className="solid" /> : <><i /><i /></>}</span>
                    <span className="line-kind">{line.label}</span>
                    <span className="line-role">{line.role || ''}</span>
                    {hasMovingLines && <>
                      <span className="moving-arrow" aria-label={line.moving ? '动爻变换' : undefined}>{line.moving ? '→' : ''}</span>
                      <span className="changed-relation">{line.changedRelation} <StemBranchText value={line.changedGanZhi} />{line.changedElement}<small>{changedLineFacts(line)}</small></span>
                      <span className="mini-line changed-mini-line">{line.changedYang ? <i className="solid" /> : <><i /><i /></>}</span>
                      <span className="line-role changed-role">{line.changedRole || ''}</span>
                    </>}
                  </div>
                  {fuShen && (
                    <div className="fu-shen-row" data-testid={`fu-shen-${fuShen.lineIndex}`}>
                      <span className="fu-shen-label">伏神</span>
                      <span className="fu-shen-main"><strong>{fuShen.relation}</strong> <StemBranchText value={fuShen.ganZhi} />{fuShen.element}</span>
                      <span className="fu-shen-fly">飞神：{fuShen.flyRelation} <StemBranchText value={fuShen.flyGanZhi} />{fuShen.flyElement}</span>
                      <span className="fu-shen-status">{fuShen.status}</span>
                      <small className="fu-shen-factors">{[...fuShen.activationFactors, ...fuShen.blockingFactors, ...fuShen.cautionFactors].join(' · ')}</small>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
          <section className="evidence-rail" aria-labelledby="evidence-heading">
            <header className="evidence-heading">
              <div className="section-title" id="evidence-heading"><i />古籍依据</div>
              <small>{evidence.length ? `命中 ${evidence.length} 条依据，涉及 ${evidenceSourceCount} 个古籍来源` : '当前知识库未找到足够证据'}</small>
            </header>
            {retrievalDiagnostics && <div className={`retrieval-status retrieval-status--${retrievalDiagnostics.mode}`}><strong>{retrievalDiagnostics.mode === 'hybrid-reranked' ? '向量 + 关键词 + 专用重排' : retrievalDiagnostics.mode === 'hybrid-fused' ? '向量 + 关键词融合' : '关键词检索（降级）'}</strong><span>关键词候选 {retrievalDiagnostics.lexicalCandidates} · 向量候选 {retrievalDiagnostics.vectorCandidates}</span>{retrievalDiagnostics.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>}
            <div className="evidence-list">
              {evidence.length ? evidence.map((item) => (
                <details id={`evidence-${item.id}`} className="evidence-entry" key={item.id}>
                  <summary className="evidence-entry-summary">
                    <span className="evidence-thumbnail"><BookMarked size={26} /><span>{item.sourceType === 'original' ? '原' : '摘'}</span></span>
                    <span className="evidence-entry-copy">
                      <strong>{item.title}</strong>
                      <span className="evidence-meta">{item.source} · {item.location} · {item.knowledgeKind === 'rule' ? '规则' : item.knowledgeKind === 'case' ? '占例' : '义理'}</span>
                      <span className="evidence-excerpt">{item.text}</span>
                      <span className="evidence-entry-action">
                        <span className="evidence-entry-label evidence-entry-label--closed">展开原文</span>
                        <span className="evidence-entry-label evidence-entry-label--open">收起原文</span>
                        <ChevronDown className="evidence-entry-chevron" size={15} aria-hidden="true" />
                      </span>
                    </span>
                  </summary>
                  <div className="evidence-full-text"><p>{item.text}</p></div>
                </details>
              )) : <p className="empty-evidence">当前知识库没有找到足够证据，因此不会编造古籍引用。</p>}
            </div>
          </section>
        </section>
        <section className="analysis-column">
          <div className="analysis-heading">
            <div className="section-title"><i />AI 解读</div>
            {markdownAnalysis && (
              <button className="analysis-reanalyze" type="button" onClick={onAnalyze} disabled={analyzing}>
                <RefreshCw className={analyzing ? 'is-spinning' : undefined} size={15} aria-hidden="true" />
                {analyzing ? '解析中' : '重新解析'}
              </button>
            )}
          </div>
          {session.analysis && analysisSaveStatus !== 'idle' && (
            <div className={`analysis-save-status analysis-save-status--${analysisSaveStatus}`} role={analysisSaveStatus === 'error' ? 'alert' : 'status'}>
              {analysisSaveStatus === 'saving' && <><span className="small-loader" aria-hidden="true" /><span>正在自动保存…</span></>}
              {analysisSaveStatus === 'saved' && <><span aria-hidden="true">✓</span><span>已自动保存</span></>}
              {analysisSaveStatus === 'error' && <><div><strong>解读已生成，但自动保存失败</strong><p>{analysisSaveError || '写入历史记录失败。'}</p></div><button type="button" onClick={onRetryAnalysisSave}><RefreshCw size={15} />重试保存</button></>}
            </div>
          )}
          {analyzing && <div className="analysis-loading"><span className="ink-loader" /><strong>正在检索古籍并校验排盘…</strong><p>排盘事实已经锁定，AI 只能依据当前卦象与证据解释。</p></div>}
          {!analyzing && analysisError && <div className="analysis-error"><strong>AI 分析暂时失败</strong><p>{analysisError}</p><button type="button" onClick={onAnalyze}><RefreshCw size={16} />重新分析</button></div>}
          {!analyzing && legacyAnalysis && !analysisError && (
            <div className="analysis-error"><strong>这份历史解读不是当前 Markdown 格式</strong><p>旧版结构化结果不再解析，请重新分析生成 Markdown 解读。</p><button type="button" onClick={onAnalyze}><RefreshCw size={16} />重新分析</button></div>
          )}
          {!analyzing && !markdownAnalysis && !legacyAnalysis && !analysisError && (
            <div className="analysis-error"><strong>这条历史记录没有已保存的 AI 解读</strong><p>打开历史记录不会自动发起新的 AI 请求，如需解读请手动开始。</p><button type="button" onClick={onAnalyze}><Sparkles size={16} />开始解读</button></div>
          )}
          {!analyzing && markdownAnalysis && (
            <article className="analysis-report">
              <div className="analysis-mode"><Sparkles size={15} />{markdownAnalysis.mode === 'cloud' ? '云端 AI · Markdown 解读' : '本地基础推演'}</div>
              {markdownAnalysis.pipeline && <div className="pipeline-trace"><span>排盘事实锁定</span><span>Markdown 解析</span><span>{markdownAnalysis.pipeline.retrievalMode === 'hybrid-reranked' ? '混合召回 + 模型重排' : markdownAnalysis.pipeline.retrievalMode === 'hybrid-fused' ? '混合召回 + 融合排序' : '关键词检索'}</span></div>}
              <MarkdownContent markdown={markdownAnalysis.markdown} />
              {evidence.length === 0 && <p className="uncertainty">当前未检索到可用古籍证据；以上依据全部来自程序锁定的排盘事实。</p>}
            </article>
          )}
        </section>
      </div>
      <section className="chat-dock" aria-labelledby="follow-up-heading">
        <header className="chat-dock-header">
          <h2 id="follow-up-heading">继续追问</h2>
          <p>围绕当前卦象，继续确认时间、条件或原因。</p>
        </header>
        {session.messages.length > 0 && (
          <div className="chat-history" aria-live="polite">
            {session.messages.map((message) => {
              const isMarkdownAnswer = message.role === 'assistant' && message.kind === 'markdown-answer';
              const isSystemNotice = message.role === 'assistant' && message.kind === 'system-notice';
              const isLegacyAnswer = message.role === 'assistant' && !isMarkdownAnswer && !isSystemNotice;
              return (
                <article
                  aria-label={message.role === 'user' ? '你的追问' : '问爻回复'}
                  className={`chat-message chat-message--${message.role}`}
                  key={message.id}
                >
                  <span className="chat-message-role">{message.role === 'user' ? '你' : '问爻'}</span>
                  <div className="chat-message-copy">
                    {message.role === 'user' && <p>{message.content}</p>}
                    {isMarkdownAnswer && <MarkdownContent className="chat-markdown" markdown={message.content} />}
                    {isSystemNotice && <p>{message.content}</p>}
                    {isLegacyAnswer && <p className="chat-contract-warning">这条历史追问不是当前 Markdown 格式，已停止展示。</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="chat-composer">
          <label className="chat-composer-label" htmlFor="follow-up">你的追问</label>
          <div className="chat-input">
            <input id="follow-up" aria-describedby="follow-up-hint" value={followUp} onChange={(event) => setFollowUp(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} placeholder="基于本次卦象，继续问一个相关问题…" />
            <button type="button" onClick={submit} disabled={!followUp.trim() || chatting}>{chatting ? <span className="small-loader" /> : <Send size={17} />}<span>继续追问</span></button>
          </div>
          <p id="follow-up-hint">按 Enter 发送，回答会继续沿用本次排盘。</p>
        </div>
      </section>
    </main>
  );
}

function lineFacts(line: PlateLine) {
  return [[line.void, '空'], [line.monthBreak, '月破'], [line.dayClash, '日冲'], [line.monthCombine, '月合'], [line.dayCombine, '日合']].filter(([active]) => active).map(([, label]) => label).join(' · ');
}

function changedLineFacts(line: PlateLine) {
  return [[line.changedVoid, '空'], [line.changedMonthBreak, '月破'], [line.changedDayClash, '日冲'], [line.changedMonthCombine, '月合'], [line.changedDayCombine, '日合']].filter(([active]) => active).map(([, label]) => label).join(' · ');
}
