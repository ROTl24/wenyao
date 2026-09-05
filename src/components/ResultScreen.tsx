import { GenerationDraftView } from './GenerationDraftView';
import { ReadingPosition } from './ReadingPosition';
import { taskIsRunning, type GenerationTask } from '../lib/useGenerationTasks';
import { ArrowLeft, ArrowRight, RefreshCw, Send, Sparkles } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ActionEffect, ActiveActionFact, HexagramDynamics, PlateLine, ShenSha, TransformationReturnFact } from '../lib/divination';
import { isAIUsable } from '../lib/aiStatus';
import type { EvidenceEntry, RetrievalDiagnostics } from '../lib/retrieval';
import type { DivinationSession } from '../lib/session';
import type { AIAnalysisProgress, AIConfigStatus } from '../types/desktop';
import { CASTING_METHOD_LABELS } from '../lib/session';
import { formatShanghaiDateTime } from '../lib/shanghaiTime';
import { returnEffectLabels } from '../lib/relationLabels';
import { HexagramLines } from './HexagramLines';
import { CastingBasisSummary } from './CastingBasisSummary';
import { MarkdownContent } from './MarkdownContent';
import { DivinationGlossary } from './DivinationGlossary';
import { desktop } from '../lib/desktop';
import './ResultScreen.css';
import { StemBranchText } from './StemBranchText';
import { FeedbackControl } from './FeedbackControl';
import { PlateCopyControl } from './PlateCopyControl';
import { navigateToResult, reportOutline } from '../lib/reportOutline';

export type EvidenceState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface Props {
  session: DivinationSession;
  evidence: EvidenceEntry[];
  retrievalDiagnostics: RetrievalDiagnostics | null;
  evidenceState?: EvidenceState;
  aiStatus: AIConfigStatus;
  aiAvailable: boolean;
  sessionSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  sessionSaveError: string;
  generationTask?: GenerationTask;
  onStopGeneration?(): void;
  onRetryGenerationSave?(): void;
  analyzing: boolean;
  analysisProgress?: (AIAnalysisProgress & { startedAt: number }) | null;
  analysisError: string;
  analysisSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  analysisSaveError: string;
  chatting: boolean;
  chatError: string;
  onRetrySessionSave(): void;
  onAnalyze(): void;
  onRetryAnalysisSave(): void;
  onFollowUp(question: string): void;
  onBack(): void;
}

const ANALYSIS_STAGE_LABELS: Record<AIAnalysisProgress['stage'], string> = {
  retrieving: '正在检索古籍证据…',
  connecting: '古籍证据已就绪，正在连接解读模型…',
  connected: '模型已连接，正在等待首段输出…',
  reasoning: '模型正在推理，请继续等待…',
  writing: '模型正在生成完整解读…',
};

function elapsedLabel(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} 分 ${seconds} 秒`;
}

export function ResultScreen({ generationTask, onStopGeneration, onRetryGenerationSave, session, evidence, retrievalDiagnostics, evidenceState, aiStatus, aiAvailable, sessionSaveStatus, sessionSaveError, analyzing, analysisProgress, analysisError, analysisSaveStatus, analysisSaveError, chatting, chatError, onRetrySessionSave, onAnalyze, onRetryAnalysisSave, onFollowUp, onBack }: Props) {
  const [followUp, setFollowUp] = useState('');
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!analyzing) {
      setAnalysisElapsedSeconds(0);
      return undefined;
    }
    const startedAt = analysisProgress?.startedAt ?? Date.now();
    const updateElapsed = () => setAnalysisElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [analyzing, analysisProgress?.startedAt]);
  const plate = session.plate!;
  const evidenceSourceCount = useMemo(() => new Set(evidence.map((item) => item.source)).size, [evidence]);
  const fuShenByLine = useMemo(() => new Map(plate.fuShen.map((item) => [item.lineIndex, item])), [plate.fuShen]);
  const baseBits = plate.lines.map((line) => line.baseYang).reverse();
  const changedBits = plate.lines.map((line) => line.changedYang).reverse();
  const hasMovingLines = plate.movingLines.length > 0;
  const dynamicsLabel = hexagramDynamicsLabel(plate.relationFacts.hexagramDynamics);
  const markdownAnalysis = session.analysis?.mode === 'cloud'
    && typeof session.analysis.markdown === 'string'
    && session.analysis.markdown.trim()
    ? session.analysis
    : null;
  const legacyAnalysis = Boolean(session.analysis && !markdownAnalysis);
  const outline = useMemo(() => reportOutline(markdownAnalysis?.markdown || ''), [markdownAnalysis?.markdown]);
  const evidencePhase = evidenceState ?? (retrievalDiagnostics ? evidence.length ? 'ready' : 'empty' : 'idle');
  const emptyEvidenceText = evidencePhase === 'loading' ? '正在检索古籍依据…'
    : evidencePhase === 'error' ? '古籍检索未完成，请查看解读区的错误说明。'
      : evidencePhase === 'empty' ? '本次检索没有找到可用古籍证据。'
        : '尚未检索古籍依据；开始解读后会在这里展示来源。';
  const sessionReady = sessionSaveStatus !== 'saving' && sessionSaveStatus !== 'error';
  const aiReady = aiAvailable && isAIUsable(aiStatus);
  const aiPreparing = aiAvailable && !aiReady && (aiStatus.status === 'testing' || aiStatus.status === 'building' || aiStatus.status === 'paused');
  const aiProgress = aiStatus.draft?.indexTask?.progress ?? 0;
  const analysisRetrieval = markdownAnalysis?.evidenceSnapshot?.retrieval;
  const pipelineRetrievalLabel = analysisRetrieval
    ? analysisRetrieval.rerankUsed
      ? analysisRetrieval.vectorUsed ? '混合召回 + 模型重排' : 'BM25 + 模型重排'
      : analysisRetrieval.vectorUsed ? '混合召回 + 融合排序' : 'BM25 检索'
    : markdownAnalysis?.pipeline?.retrievalMode === 'hybrid-reranked'
      ? '混合召回 + 模型重排'
      : markdownAnalysis?.pipeline?.retrievalMode === 'hybrid-fused' ? '混合召回 + 融合排序' : 'BM25 检索';
  const retrievalStatusLabel = retrievalDiagnostics
    ? retrievalDiagnostics.rerankUsed
      ? retrievalDiagnostics.vectorUsed ? 'BM25 + 向量 + RRF + 重排' : 'BM25 + 重排（向量降级）'
      : retrievalDiagnostics.vectorUsed
        ? aiStatus.activeCapabilities?.rerank ? 'BM25 + 向量 + RRF（重排暂不可用）' : 'BM25 + 向量 + RRF'
        : aiStatus.activeCapabilities?.embedding ? 'BM25（向量暂不可用）' : 'BM25 关键词检索'
    : '';
  const submit = () => {
    if (!aiAvailable || !followUp.trim() || chatting || analyzing || generationTask?.status === 'save-error' || !sessionReady || !aiReady) return;
    onFollowUp(followUp.trim());
    setFollowUp('');
  };

  return (
    <ReadingPosition sessionId={session.id} requestId={generationTask?.requestId}><main className="result-screen">
      <div className="result-codex">
        <header
          aria-label="成卦卷首"
          className="result-hero"
          data-state={hasMovingLines ? 'moving' : 'static'}
        >
          <div className="result-hero-nav">
            <button className="text-button" type="button" onClick={onBack}>
              <ArrowLeft aria-hidden="true" size={17} />
              返回问事
            </button>
            <div className="result-hero-meta">
              <time dateTime={session.castAt}>{formatShanghaiDateTime(new Date(session.castAt))}</time>
              <span>{session.castingMethod === 'time'
                ? '梅花时间成卦 · 文王纳甲解读 · 时间起卦'
                : `文王纳甲 · 字二背三 · ${CASTING_METHOD_LABELS[session.castingMethod]}`}</span>
            </div>
          </div>

          <div className="result-hero-body">
            <div className="result-question">
              <h1 id="result-question">{session.question}</h1>
            </div>
            <div className={hasMovingLines ? 'result-hexagram-stage' : 'result-hexagram-stage result-hexagram-stage--static'}>
              <div
                aria-label={`本卦 · ${plate.baseHexagram.name}`}
                className="result-hexagram result-hexagram--base"
              >
                <div className="result-hexagram-copy">
                  <span>本卦 · {plate.baseHexagram.palace}宫{plate.baseHexagram.generation}</span>
                  <strong>{plate.baseHexagram.name}</strong>
                </div>
                <HexagramLines lines={baseBits} moving={plate.movingLines} />
              </div>
              {hasMovingLines ? (
                <>
                  <span className="result-hero-transition" aria-hidden="true">
                    <ArrowRight size={24} strokeWidth={1.5} />
                  </span>
                  <div
                    aria-label={`变卦 · ${plate.changedHexagram.name}`}
                    className="result-hexagram result-hexagram--changed"
                  >
                    <div className="result-hexagram-copy">
                      <span>变卦 · {plate.changedHexagram.palace}宫{plate.changedHexagram.generation}</span>
                      <strong>{plate.changedHexagram.name}</strong>
                    </div>
                    <HexagramLines lines={changedBits} />
                  </div>
                </>
              ) : (
                <span className="result-still-seal" aria-label="静卦，无动爻">
                  <strong>静卦</strong>
                  <small>无动爻</small>
                </span>
              )}
            </div>
          </div>
          <CastingBasisSummary basis={session.castingBasis} />
        </header>

        <nav className="result-navigation" aria-label="结果导航">
          {[
            ['analysis-heading', markdownAnalysis ? '结论与解读' : '解读'],
            ['plate-heading', '排盘'],
            ['evidence-heading', '古籍依据'],
            ...(aiAvailable || session.messages.length ? [['follow-up-heading', '追问']] : []),
          ].map(([id, label]) => <a key={id} href={`#${id}`} onClick={(event) => { event.preventDefault(); navigateToResult(id); }}>{label}</a>)}
        </nav>

        <div className="result-workspace">
          <section
            aria-labelledby="analysis-heading"
            className="analysis-column result-leaf"
            data-folio="卷二"
          >
            <div className="analysis-heading">
              <h2 className="section-title" id="analysis-heading"><i aria-hidden="true" />{aiAvailable || markdownAnalysis || legacyAnalysis ? 'AI 解读' : '本地模式'}</h2>
              {aiAvailable && markdownAnalysis ? (
                <button className="analysis-reanalyze" type="button" onClick={onAnalyze} disabled={analyzing || chatting || generationTask?.status === 'save-error' || !sessionReady}>
                  <RefreshCw className={analyzing ? 'is-spinning' : undefined} size={15} aria-hidden="true" />
                  {analyzing ? '解析中' : aiReady ? '重新解析' : '连接 AI 服务'}
                </button>
              ) : null}
            </div>
            {sessionSaveStatus === 'saving' || sessionSaveStatus === 'error' ? (
              <div className={`analysis-save-status analysis-save-status--${sessionSaveStatus}`} role={sessionSaveStatus === 'error' ? 'alert' : 'status'}>
                {sessionSaveStatus === 'saving' ? <><span className="small-loader" aria-hidden="true" /><span>正在保存本次排盘…</span></> : null}
                {sessionSaveStatus === 'error' ? <><div><strong>本次排盘尚未保存</strong><p>{sessionSaveError || '写入历史记录失败。'}</p></div><button type="button" onClick={onRetrySessionSave}><RefreshCw size={15} />重试保存</button></> : null}
              </div>
            ) : null}
            {session.analysis && analysisSaveStatus !== 'idle' ? (
              <div className={`analysis-save-status analysis-save-status--${analysisSaveStatus}`} role={analysisSaveStatus === 'error' ? 'alert' : 'status'}>
                {analysisSaveStatus === 'saving' ? <><span className="small-loader" aria-hidden="true" /><span>正在自动保存…</span></> : null}
                {analysisSaveStatus === 'saved' ? <><span aria-hidden="true">✓</span><span>已自动保存</span></> : null}
                {analysisSaveStatus === 'error' ? <><div><strong>解读已生成，但自动保存失败</strong><p>{analysisSaveError || '写入历史记录失败。'}</p></div><button type="button" onClick={onRetryAnalysisSave}><RefreshCw size={15} />重试保存</button></> : null}
              </div>
            ) : null}
            {aiAvailable && analyzing ? <div className={`analysis-loading${generationTask?.content ? ' analysis-loading--streaming' : ''}`} role="status"><span className="ink-loader" /><strong>{ANALYSIS_STAGE_LABELS[analysisProgress?.stage ?? 'connecting']}</strong><p><span aria-hidden="true">已等待 {elapsedLabel(analysisElapsedSeconds)}。</span> 请求仍在进行，不会自动重试；完成后会自动保存。</p><small>排盘事实已经锁定，AI 只能依据当前卦象与证据解释。</small></div> : null}
            {(generationTask?.kind === 'analysis' || session.generationDraft?.kind === 'analysis') ? <GenerationDraftView task={generationTask?.kind === 'analysis' ? generationTask : undefined} draft={session.generationDraft?.kind === 'analysis' && !taskIsRunning(generationTask) ? session.generationDraft : undefined} onStop={onStopGeneration} onRetrySave={onRetryGenerationSave} /> : null}
            {aiAvailable && !analyzing && analysisError ? <div className="analysis-error" role="alert"><strong>AI 分析暂时失败</strong><p>{analysisError}</p><button type="button" onClick={onAnalyze} disabled={!sessionReady || chatting || analyzing || generationTask?.status === 'save-error'}><RefreshCw size={16} />重新分析</button></div> : null}
            {legacyAnalysis && (!aiAvailable || (!analyzing && !analysisError)) ? (
              <div className="analysis-error"><strong>这份历史解读不是当前 Markdown 格式</strong><p>{aiAvailable ? '旧版结构化结果不再解析，请重新分析生成 Markdown 解读。' : '旧版结构化结果无法在网页版展示。'}</p>{aiAvailable ? <button type="button" onClick={onAnalyze} disabled={!sessionReady || chatting || analyzing || generationTask?.status === 'save-error'}><RefreshCw size={16} />重新分析</button> : null}</div>
            ) : null}
            {!aiAvailable && !markdownAnalysis && !legacyAnalysis ? <div className="analysis-error"><strong>网页版提供本地排盘</strong><p>起卦、排盘、历史记录和内置古籍均可在当前设备使用；此版本不提供 AI 解读。</p></div> : null}
            {aiAvailable && !analyzing && !markdownAnalysis && !legacyAnalysis && !analysisError ? (
              <div className="analysis-error"><strong>{!sessionReady ? '排盘保存完成后才能开始解读' : aiReady ? '这条历史记录没有已保存的 AI 解读' : aiPreparing ? 'AI 服务正在准备中' : '需要先连接 AI 服务'}</strong><p>{!sessionReady ? '请等待自动保存完成，或先重试保存本次排盘。' : aiReady ? '打开历史记录不会自动发起新的 AI 请求，如需解读请手动开始。' : aiPreparing ? `向量索引当前完成 ${aiProgress.toFixed(1)}%，新方案完成后即可生成解读。` : '连接向导先配置必填的主模型；向量和重排模型均可跳过。'}</p><button type="button" onClick={onAnalyze} disabled={!sessionReady || aiPreparing || chatting || generationTask?.status === 'save-error'}><Sparkles size={16} />{aiReady ? '开始解读' : aiPreparing ? '准备中' : '连接 AI 服务'}</button></div>
            ) : null}
            {markdownAnalysis && (!aiAvailable || !analyzing) ? (
              <article className="analysis-report">
                <div className="analysis-mode"><Sparkles size={15} />古籍与排盘解读</div>
                {outline.summary ? <section className="report-summary" aria-label="结论速览">
                  <h3>先看结论与条件</h3>
                  <p className="summary-source">以下保留原报告的综合结论、应期与最终结论；其他前提和限制请结合完整解读核对。</p>
                  <MarkdownContent markdown={outline.summary} allowExternalLinks={desktop.runtime.kind === 'electron'} />
                </section> : null}
                {outline.sections.length ? <details className="report-outline">
                  <summary>解读目录 · {outline.sections.length} 节</summary>
                  <nav aria-label="解读章节">{outline.sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={(event) => { event.preventDefault(); navigateToResult(section.id); }}>{section.title}</a>)}</nav>
                </details> : null}
                {markdownAnalysis.pipeline ? (
                  <div className="pipeline-trace">
                    <span>排盘事实锁定</span>
                    <span>Markdown 解析</span>
                    <span>{pipelineRetrievalLabel}</span>
                  </div>
                ) : null}
                <MarkdownContent className="analysis-body" markdown={markdownAnalysis.markdown} reportHeadings allowExternalLinks={desktop.runtime.kind === 'electron'} />
                {markdownAnalysis.analysisId && markdownAnalysis.evidenceSnapshot ? <FeedbackControl sessionId={session.id} targetType="analysis" targetId={markdownAnalysis.analysisId} report={markdownAnalysis} snapshot={markdownAnalysis.evidenceSnapshot} question={session.question} answer={markdownAnalysis.markdown} /> : null}
                {evidence.length === 0 ? <p className="uncertainty">{evidencePhase === 'empty' ? '本次检索未命中古籍依据，请结合排盘事实阅读解读。' : '当前没有可展示的古籍依据快照，无法从此页核对原引用。'}</p> : null}
              </article>
            ) : null}
          </section>

          <section
            aria-labelledby="plate-heading"
            className="plate-column result-leaf"
            data-folio="卷一"
          >
            <div className="plate-heading">
              <h2 className="section-title" id="plate-heading"><i aria-hidden="true" />排盘</h2>
              <PlateCopyControl session={session} />
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
            </div>
            <DivinationGlossary />
            <div className="plate-facts" id="plate-facts" tabIndex={-1}>
              <div className="shen-sha-line">
                <strong>日辰神煞</strong>
                <div>
                  {plate.shenSha.map((item) => (
                    <span aria-label={`${item.name}神煞`} key={item.name}>
                      <b>{item.name}</b><StemBranchText value={item.branches.join('、')} />
                      <small>{shenShaHitSummary(item)}</small>
                    </span>
                  ))}
                </div>
              </div>
              <span className="palace-meta">
                {hasMovingLines
                  ? `${plate.baseHexagram.palace}宫·${plate.baseHexagram.generation} → ${plate.changedHexagram.palace}宫·${plate.changedHexagram.generation}`
                  : `${plate.baseHexagram.palace}宫·${plate.baseHexagram.generation} · 静卦`}
                {dynamicsLabel ? <small className="hexagram-dynamics">{dynamicsLabel}</small> : null}
              </span>
            </div>
            {plate.fuShen.length > 0 ? <p className="fu-shen-note">主卦缺失六亲，按本宫首卦补出伏神；伏神显示在同爻位飞神之下。</p> : null}
            <div aria-label="六爻排盘总览" className={hasMovingLines ? 'plate-table plate-table--changed' : 'plate-table'} role="group">
              {hasMovingLines ? (
                <div className="plate-row plate-row--header" aria-hidden="true">
                  <span>爻位</span><span>六神</span>
                  <strong className="plate-side-title plate-side-title--base">本卦 · {plate.baseHexagram.name}</strong>
                  <span className="moving-arrow">→</span>
                  <strong className="plate-side-title plate-side-title--changed">变卦 · {plate.changedHexagram.name}</strong>
                </div>
              ) : null}
              {[...plate.lines].reverse().map((line) => {
                const fuShen = fuShenByLine.get(line.index);
                const baseShenSha = plate.shenSha.filter((item) => item.baseLineIndexes.includes(line.index)).map((item) => item.name);
                const changedShenSha = plate.shenSha.filter((item) => item.changedLineIndexes.includes(line.index)).map((item) => item.name);
                const activeActions = plate.relationFacts.activeActions.filter((action) => action.sourceLineIndex === line.index);
                const transformationReturn = plate.relationFacts.transformationReturns.find((fact) => fact.lineIndex === line.index);
                return (
                  <Fragment key={line.index}>
                    <div
                      aria-label={`${LINE_POSITIONS[line.index - 1]}爻排盘`}
                      className={line.moving ? 'plate-row plate-row--moving' : 'plate-row'}
                      role="group"
                    >
                      <span className="line-index">{LINE_POSITIONS[line.index - 1]}爻</span>
                      <span className="beast">{line.beast}</span>
                      <span className="relation">{line.relation} <StemBranchText value={line.ganZhi} />{line.element}<small aria-label={`${LINE_POSITIONS[line.index - 1]}爻六爻状态`}>{lineFacts(line, baseShenSha, activeActions)}</small></span>
                      <span className="mini-line">{line.baseYang ? <i className="solid" /> : <><i /><i /></>}</span>
                      <span className="line-kind">{line.label}</span>
                      <span className="line-role">{line.role || ''}</span>
                      {hasMovingLines ? <>
                        <span className="moving-arrow" aria-label={line.moving ? '动爻变换' : undefined}>{line.moving ? '→' : ''}</span>
                        <span className="changed-relation">{line.changedRelation} <StemBranchText value={line.changedGanZhi} />{line.changedElement}<small aria-label={`${LINE_POSITIONS[line.index - 1]}爻变爻状态`}>{changedLineFacts(line, changedShenSha, transformationReturn)}</small></span>
                        <span className="mini-line changed-mini-line">{line.changedYang ? <i className="solid" /> : <><i /><i /></>}</span>
                        <span className="line-role changed-role">{line.changedRole || ''}</span>
                      </> : null}
                    </div>
                    {fuShen ? (
                      <div className="fu-shen-row" data-testid={`fu-shen-${fuShen.lineIndex}`}>
                        <span className="fu-shen-label">伏神</span>
                        <span className="fu-shen-main"><strong>{fuShen.relation}</strong> <StemBranchText value={fuShen.ganZhi} />{fuShen.element}</span>
                        <span className="fu-shen-fly">飞神：{fuShen.flyRelation} <StemBranchText value={fuShen.flyGanZhi} />{fuShen.flyElement}</span>
                        <span className="fu-shen-status">{fuShen.status}</span>
                        <small className="fu-shen-factors">{[...fuShen.activationFactors, ...fuShen.blockingFactors, ...fuShen.cautionFactors].join(' · ')}</small>
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </section>

          <section className="evidence-rail" aria-labelledby="evidence-heading">
              <div className="evidence-heading">
                <h2 className="section-title" id="evidence-heading"><i aria-hidden="true" />古籍依据</h2>
                <small>{evidence.length ? `命中 ${evidence.length} 条依据，涉及 ${evidenceSourceCount} 个古籍来源` : evidencePhase === 'empty' ? '本次检索没有命中' : evidencePhase === 'error' ? '检索未完成' : evidencePhase === 'loading' ? '检索进行中' : '尚未检索'}</small>
              </div>
              {retrievalDiagnostics ? <div className={`retrieval-status retrieval-status--${retrievalDiagnostics.mode}`}><strong>{retrievalStatusLabel}</strong><span>BM25 候选 {retrievalDiagnostics.lexicalCandidates} · 向量候选 {retrievalDiagnostics.vectorCandidates} · 最终 {retrievalDiagnostics.selectedCandidates ?? evidence.length}</span>{retrievalDiagnostics.warnings.map((warning) => <small key={warning}>{warning}</small>)}{aiAvailable && retrievalDiagnostics.warnings.length ? <button type="button" onClick={onAnalyze} disabled={analyzing || chatting || generationTask?.status === 'save-error' || !sessionReady}><RefreshCw size={14} />重新检索并解读</button> : null}</div> : null}
              <div className="evidence-list">
                {evidence.length ? evidence.map((item, index) => (
                  <article
                    aria-labelledby={`evidence-title-${item.id}`}
                    className="evidence-entry"
                    id={`evidence-${item.id}`}
                    key={item.id}
                    tabIndex={-1}
                  >
                    <span className="evidence-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className="evidence-entry-copy">
                      <div className="evidence-entry-heading">
                        <h3 id={`evidence-title-${item.id}`}>{item.title}</h3>
                        <span className="evidence-source-mark" aria-label={item.sourceType === 'original' ? '古籍原文' : '古籍摘录'}>{item.sourceType === 'original' ? '原' : '摘'}</span>
                      </div>
                      <span className="evidence-meta"><i className={`evidence-origin-label evidence-origin-label--${item.origin === 'user' ? 'user' : 'builtin'}`}>{item.origin === 'user' ? '用户导入' : '内置'}</i>{item.source}{item.edition ? `（${item.edition}）` : ''} · {item.location} · {item.knowledgeKind === 'rule' ? '规则' : item.knowledgeKind === 'case' ? '占例' : '义理'}</span>
                      <p className="evidence-text">{item.text}</p>
                    </div>
                  </article>
                )) : <p className="empty-evidence" role="status">{emptyEvidenceText}</p>}
              </div>
          </section>

          <div className="result-spine" aria-hidden="true" />
        </div>

        {aiAvailable || session.messages.length > 0 ? <section className="chat-dock result-leaf" aria-labelledby="follow-up-heading" data-folio="卷末">
          <div className="chat-dock-header">
            <h2 id="follow-up-heading">{aiAvailable ? '继续追问' : '历史追问'}</h2>
            <p>{aiAvailable ? '围绕当前卦象，继续确认时间、条件或原因。' : '保留在当前设备中的过往问答记录。'}</p>
          </div>
          {session.messages.length > 0 ? (
            <div className="chat-history" aria-live="polite">
              {session.messages.map((message, messageIndex) => {
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
                      {message.role === 'user' ? <p>{message.content}</p> : null}
                      {isMarkdownAnswer ? <MarkdownContent className="chat-markdown" markdown={message.content} allowExternalLinks={desktop.runtime.kind === 'electron'} /> : null}
                      {isMarkdownAnswer && message.evidenceSnapshot && markdownAnalysis ? <FeedbackControl sessionId={session.id} targetType="follow-up" targetId={message.id} report={{ ...markdownAnalysis, provider: message.provider || markdownAnalysis.provider }} snapshot={message.evidenceSnapshot} question={session.messages[messageIndex - 1]?.role === 'user' ? session.messages[messageIndex - 1].content : session.question} answer={message.content} /> : null}
                      {isSystemNotice ? <p>{message.content}</p> : null}
                      {isLegacyAnswer ? <p className="chat-contract-warning">这条历史追问不是当前 Markdown 格式，已停止展示。</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
          {(generationTask?.kind === 'followUp' || session.generationDraft?.kind === 'followUp') ? <GenerationDraftView task={generationTask?.kind === 'followUp' ? generationTask : undefined} draft={session.generationDraft?.kind === 'followUp' && !taskIsRunning(generationTask) ? session.generationDraft : undefined} onStop={onStopGeneration} onRetrySave={onRetryGenerationSave} /> : null}
          {session.generationDraft?.kind === 'followUp' && !taskIsRunning(generationTask) ? <button type="button" disabled={!aiReady || generationTask?.status === 'save-error'} onClick={() => onFollowUp(session.generationDraft!.question)}>重新发送这次追问</button> : null}
          {aiAvailable && chatError ? (
            <div className="analysis-save-status analysis-save-status--error" role="alert">
              <div><strong>追问未完成</strong><p>{chatError}</p></div>
            </div>
          ) : null}
          {aiAvailable ? <div className="chat-composer">
            <label className="chat-composer-label" htmlFor="follow-up">你的追问</label>
            <div className="chat-input">
              <input id="follow-up" aria-describedby="follow-up-hint" value={followUp} disabled={!sessionReady || !aiReady} onChange={(event) => setFollowUp(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) submit(); }} placeholder={aiReady ? '基于本次卦象，继续问一个相关问题…' : '连接并准备好 AI 服务后可以继续追问'} />
              <button type="button" onClick={submit} disabled={!followUp.trim() || chatting || analyzing || generationTask?.status === 'save-error' || !sessionReady || !aiReady}>{chatting ? <span className="small-loader" /> : <Send size={17} />}<span>继续追问</span></button>
            </div>
            <p id="follow-up-hint">{aiReady ? '按 Enter 发送，回答会继续沿用本次排盘。' : 'AI 解读主模型就绪后即可发送。'}</p>
          </div> : null}
        </section> : null}
      </div>
    </main></ReadingPosition>
  );
}

const LINE_POSITIONS = ['初', '二', '三', '四', '五', '上'] as const;

function lineFacts(line: PlateLine, shenSha: string[], activeActions: ActiveActionFact[]) {
  const dayClashLabel = dayClashLabelFor(line);
  const calendarFacts = [[line.void, '空'], [line.monthBreak, '月破'], [Boolean(dayClashLabel), dayClashLabel], [line.monthCombine, '月合'], [line.dayCombine, '日合']]
    .filter(([active]) => active)
    .map(([, label]) => label as string);
  return [`月令·${line.twelveStages.month}`, `日辰·${line.twelveStages.day}`, ...calendarFacts, ...activeActionLabels(activeActions), ...shenSha].join(' · ');
}

function changedLineFacts(line: PlateLine, shenSha: string[], transformationReturn?: TransformationReturnFact) {
  const calendarFacts = [[line.changedVoid, '空'], [line.changedMonthBreak, '月破'], [line.changedDayClash, '日冲'], [line.changedMonthCombine, '月合'], [line.changedDayCombine, '日合']]
    .filter(([active]) => active)
    .map(([, label]) => label as string);
  const transformation = line.moving && line.twelveStages.transformation ? [`化${line.twelveStages.transformation}`] : [];
  return [...transformation, ...returnActionLabels(transformationReturn), ...calendarFacts, ...shenSha].join(' · ');
}

function dayClashLabelFor(line: PlateLine): string {
  if (!line.dayClash) return '';
  if (line.dayClashAssessment.kind === 'hidden-movement') return '暗动';
  if (line.dayClashAssessment.kind === 'day-break') return '日破';
  return '日冲';
}

function activeActionLabels(actions: ActiveActionFact[]): string[] {
  return actions.map((action) => {
    const target = action.targetKind === 'hidden-spirit'
      ? `${LINE_POSITIONS[action.targetLineIndex - 1]}爻伏神`
      : `${LINE_POSITIONS[action.targetLineIndex - 1]}爻`;
    const source = action.sourceActivity === 'hidden-moving' ? '暗动' : '动';
    return `${source}${effectsLabel(action.effects)}${target}`;
  });
}

function returnActionLabels(fact?: TransformationReturnFact): string[] {
  if (!fact) return [];
  return returnEffectLabels(fact.returnEffects);
}

function effectsLabel(effects: ActionEffect[]): string {
  return effects.join('、');
}

function hexagramDynamicsLabel(dynamics: HexagramDynamics): string {
  const facts: string[] = [];
  const transitionLabels: Record<HexagramDynamics['transition'], string> = {
    'clash-to-harmony': '六冲变六合',
    'harmony-to-clash': '六合变六冲',
    'clash-to-clash': '六冲变六冲',
    'harmony-to-harmony': '六合变六合',
    none: dynamics.baseSixRelation === 'six-clash'
      ? '本卦六冲'
      : dynamics.baseSixRelation === 'six-harmony'
        ? '本卦六合'
        : '',
  };
  if (transitionLabels[dynamics.transition]) facts.push(transitionLabels[dynamics.transition]);
  if (dynamics.inner.guaFanYin) facts.push('内卦反吟');
  if (dynamics.inner.yaoFanYin) facts.push('内爻反吟');
  if (dynamics.inner.fuYin) facts.push('内卦伏吟');
  if (dynamics.outer.guaFanYin) facts.push('外卦反吟');
  if (dynamics.outer.yaoFanYin) facts.push('外爻反吟');
  if (dynamics.outer.fuYin) facts.push('外卦伏吟');
  return facts.join(' · ');
}

function shenShaHitSummary(item: ShenSha): string {
  const hits = [
    item.baseLineIndexes.length > 0 ? `本卦${lineIndexesLabel(item.baseLineIndexes)}` : '',
    item.changedLineIndexes.length > 0 ? `变${lineIndexesLabel(item.changedLineIndexes)}` : '',
  ].filter(Boolean);
  return `${item.basis} · ${hits.length > 0 ? hits.join(' · ') : '未入卦'}`;
}

function lineIndexesLabel(indexes: number[]): string {
  return `${indexes.map((index) => LINE_POSITIONS[index - 1]).join('、')}爻`;
}
