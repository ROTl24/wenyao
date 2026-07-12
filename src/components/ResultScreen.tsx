import { ArrowLeft, BookMarked, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AnalysisClaimV2, AnalysisSectionV2 } from '../domain/liuyao/analysis-report';
import type { UseGodClarificationPatch } from '../domain/liuyao';
import type { DivinationSession } from '../lib/session';
import { FactExplorer } from './result/FactExplorer';
import { HexagramComparison } from './result/HexagramComparison';
import { PillarGrid } from './result/PillarGrid';
import { selectResultCase } from './result/selectors';
import { UseGodPanel } from './result/UseGodPanel';

interface Props {
  session: DivinationSession;
  analyzing: boolean;
  analysisError: string;
  chatting: boolean;
  onAnalyze(): void;
  onFollowUp(question: string): void;
  onSelectIntent(patch: UseGodClarificationPatch): void;
  onBack(): void;
}

const SECTION_LABELS: Readonly<Record<AnalysisSectionV2, string>> = {
  summary: '卦象总览',
  'use-god': '用神取用',
  calendar: '日月时令',
  moving: '动爻与变卦',
  synthesis: '综合判断',
  guidance: '行动建议',
};

const SECTION_ORDER = Object.keys(SECTION_LABELS) as AnalysisSectionV2[];

export function ResultScreen({ session, analyzing, analysisError, chatting, onAnalyze, onFollowUp, onSelectIntent, onBack }: Props) {
  const [followUp, setFollowUp] = useState('');
  const caseSnapshot = session.caseSnapshot!;
  const view = useMemo(() => selectResultCase(caseSnapshot), [caseSnapshot]);
  const bundle = session.analysisBundle;
  const evidence = bundle?.canonicalEvidence ?? [];
  const diagnostics = bundle?.retrievalDiagnostics;
  const submit = () => {
    if (!followUp.trim() || chatting) return;
    onFollowUp(followUp.trim());
    setFollowUp('');
  };
  return (
    <main className="result-screen">
      <header className="result-header">
        <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={17} />返回问事</button>
        <div><span>{caseSnapshot.plate.calendar.localDateTime} · {caseSnapshot.plate.calendar.timezone}</span><strong>{caseSnapshot.question}</strong></div>
        <span className="rule-version">{caseSnapshot.plate.rulePackRef.id} · v{caseSnapshot.plate.rulePackRef.version}</span>
      </header>
      <section className="case-meta">
        <div><span>占问</span><strong>{caseSnapshot.question}</strong></div>
        <div><span>事项</span><strong>{caseSnapshot.useGod.intent?.label ?? '待澄清'}</strong></div>
        <div><span>规则口径</span><strong>{caseSnapshot.ruleContext.relationProfile.id} · {caseSnapshot.ruleContext.effectsProfile.id}</strong></div>
        <div><span>FactSet</span><code>{caseSnapshot.factSetHash.slice(0, 12)}</code></div>
      </section>
      <PillarGrid calendar={caseSnapshot.plate.calendar} />
      <UseGodPanel caseSnapshot={caseSnapshot} onSelectIntent={onSelectIntent} />
      <HexagramComparison
        base={caseSnapshot.plate.baseHexagram}
        changed={caseSnapshot.plate.changedHexagram}
        baseLines={view.baseLines}
        changedLines={view.changedLines}
      />
      <div className="result-workspace">
        <FactExplorer factsByAuthority={view.factsByAuthority} />
        <section className="analysis-column">
          <div className="section-title"><i />AI 解读</div>
          {analyzing && <div className="analysis-loading"><span className="ink-loader" /><strong>正在检索古籍并校验排盘…</strong><p>排盘事实已经锁定，分析只能引用当前卦例与 canonical 证据。</p></div>}
          {!analyzing && analysisError && <div className="analysis-error"><strong>AI 分析暂时失败</strong><p>{analysisError}</p><button type="button" onClick={onAnalyze}><RefreshCw size={16} />重新分析</button></div>}
          {!analyzing && bundle && (
            <article className="analysis-report">
              <div className="analysis-mode">
                <Sparkles size={15} />
                {bundle.analysisOrigin === 'cloud' ? '云端生成' : '本地生成'} · {session.caseRuntimeTrust === 'browser-preview' ? '浏览器预览' : '桌面权威运行时'}
              </div>
              <p className="runtime-trust-note" role="status">
                当前 Case 引用/词元已校验；{session.caseRuntimeTrust === 'browser-preview' ? '浏览器预览不等同于桌面权威运行时复核。' : '结果由桌面主进程原子持久化。'}
              </p>
              {SECTION_ORDER.map((section) => (
                <ClaimSection key={section} section={section} claims={bundle.report.claims.filter((claim) => claim.section === section)} />
              ))}
              {bundle.report.uncertainties.map((item) => <p className="uncertainty" key={item}>{item}</p>)}
            </article>
          )}
          {!analyzing && !bundle && session.analysis && <LegacyReport analysis={session.analysis as unknown} />}
        </section>
      </div>
      <section className="evidence-rail">
        <div className="section-title"><i />古籍依据</div>
        {diagnostics && (
          <div className={`retrieval-status retrieval-status--${diagnostics.mode}`}>
            <strong>{diagnostics.mode === 'hybrid-reranked' ? '混合召回 + 重排' : diagnostics.mode === 'hybrid-fused' ? '混合召回' : 'canonical 关键词召回'}</strong>
            <span>候选 {diagnostics.lexicalCandidates} · 规则命中 {diagnostics.matchedRuleIds.length}</span>
            {diagnostics.warnings.map((warning) => <small key={warning}>{warning}</small>)}
          </div>
        )}
        <div className="evidence-list">
          {evidence.length ? evidence.map((item) => (
            <article id={`evidence-${item.id}`} className="evidence-entry" key={item.id}>
              <div className="evidence-thumbnail"><BookMarked size={26} /><span>{item.sourceType === 'original' ? '原' : '摘'}</span></div>
              <div><strong>{item.title}</strong><span>{item.source} · {item.location} · {item.knowledgeKind === 'rule' ? '规则' : item.knowledgeKind === 'case' ? '占例' : '义理'}</span><p>{item.text}</p></div>
            </article>
          )) : <p className="empty-evidence">当前 bundle 没有 canonical 证据，不展示推测性古籍引用。</p>}
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

function ClaimSection({ section, claims }: { section: AnalysisSectionV2; claims: readonly AnalysisClaimV2[] }) {
  return (
    <section className="report-section">
      <h3>{SECTION_LABELS[section]}</h3>
      {claims.map((claim) => (
        <div className="claim" key={claim.id}>
          <p>{claim.text}</p><span>置信度 {claim.confidence}</span>
          <details><summary>引用详情</summary>
            <ReferenceList label="事实" ids={claim.factIds} />
            <ReferenceList label="规则" ids={claim.ruleIds} />
            <ReferenceList label="证据" ids={claim.evidenceIds} evidenceLinks />
          </details>
        </div>
      ))}
    </section>
  );
}

function ReferenceList({ label, ids, evidenceLinks = false }: { label: string; ids: readonly string[]; evidenceLinks?: boolean }) {
  return <div className="claim-references"><strong>{label}</strong>{ids.length ? ids.map((id) => evidenceLinks ? <a key={id} href={`#evidence-${id}`}>{id}</a> : <span key={id}>{id}</span>) : <span>无</span>}</div>;
}

function LegacyReport({ analysis }: { analysis: unknown }) {
  const value = analysis && typeof analysis === 'object' ? analysis as Record<string, unknown> : {};
  const fields = ['summary', 'focus', 'relations', 'moving', 'synthesis']
    .map((key) => typeof value[key] === 'string' ? value[key] as string : '')
    .filter(Boolean);
  return (
    <article className="analysis-report analysis-report--legacy">
      <div className="analysis-mode">旧版历史解读·未验证</div>
      <p className="uncertainty">该内容没有 V2 Case 引用与词元校验，只作为历史记录展示。</p>
      {fields.map((body, index) => <section className="report-section" key={`${index}-${body}`}><p>{body}</p></section>)}
    </article>
  );
}
