import { Database, KeyRound, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktop } from '../lib/desktop';

interface Props { onClose(): void }

export function SettingsPanel({ onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState('https://dashscope.aliyuncs.com/compatible-mode/v1');
  const [model, setModel] = useState('qwen3.7-plus');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-v4');
  const [rerankModel, setRerankModel] = useState('qwen3-rerank');
  const [rerankUrl, setRerankUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [status, setStatus] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [corpus, setCorpus] = useState({ count: 0, bookCount: 0, originalCount: 0, summaryCount: 0, ruleCount: 0, caseCount: 0, doctrineCount: 0, vectorReady: false, vectorModel: '', ready: false });
  useEffect(() => { void Promise.all([desktop.settings.get(), desktop.corpus.status()]).then(([settings, corpusStatus]) => { setBaseUrl(settings.baseUrl); setModel(settings.model); setEmbeddingModel(settings.embeddingModel); setRerankModel(settings.rerankModel); setRerankUrl(settings.rerankUrl); setHasApiKey(settings.hasApiKey); setCorpus(corpusStatus); }); }, []);
  const save = async () => {
    setStatus('保存中…');
    try { const result = await desktop.settings.save({ baseUrl, model, embeddingModel, rerankModel, rerankUrl, apiKey: apiKey || undefined }); setHasApiKey(result.hasApiKey); setApiKey(''); setCorpus(await desktop.corpus.status()); setStatus('阿里模型设置已保存。'); }
    catch (error) { setStatus(error instanceof Error ? error.message : '保存失败。'); }
  };
  const test = async () => { setStatus('正在测试连接…'); const result = await desktop.settings.test(); setStatus(result.ok ? result.message || '连接成功。' : `${result.error?.message} ${result.error?.nextAction}`); };
  const rebuildVectors = async () => {
    setIndexing(true);
    setStatus(`正在向阿里生成 ${corpus.count} 条本地向量，窗口可继续保留打开…`);
    try {
      const result = await desktop.corpus.rebuildVectors();
      if (!result.ok) { setStatus(`${result.error?.message} ${result.error?.nextAction}`); return; }
      const latest = await desktop.corpus.status();
      setCorpus(latest);
      setStatus(`向量索引已完成：${result.result?.count} 条，${result.result?.dimensions} 维。`);
    } finally { setIndexing(false); }
  };
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel settings-panel" aria-modal="true" role="dialog">
        <header><div><h2>AI 与知识库</h2><p>密钥由 Windows DPAPI 加密保存</p></div><button type="button" aria-label="关闭 AI 设置" onClick={onClose}><X /></button></header>
        <section className="settings-section"><div className="settings-heading"><KeyRound /><div><strong>阿里云百炼模型栈</strong><span>解卦、向量、重排分别配置，密钥共用</span></div></div><label>兼容 API 地址<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label><label>解卦模型<input value={model} onChange={(event) => setModel(event.target.value)} /></label><div className="settings-grid"><label>向量模型<input value={embeddingModel} onChange={(event) => setEmbeddingModel(event.target.value)} /></label><label>重排模型<input value={rerankModel} onChange={(event) => setRerankModel(event.target.value)} /></label></div><label>qwen3-rerank 业务空间 API 地址（可暂留空）<input value={rerankUrl} onChange={(event) => setRerankUrl(event.target.value)} placeholder="https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-api/v1/reranks" /></label><label>API 密钥<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasApiKey ? '密钥已安全保存；留空表示不修改' : '输入后由 Windows 加密'} /></label><div className="settings-actions"><button type="button" onClick={save}>保存设置</button><button type="button" onClick={test}>测试连接</button></div>{status && <p className="settings-status">{status}</p>}</section>
        <section className="settings-section"><div className="settings-heading"><Database /><div><strong>本地结构化古籍库</strong><span>{corpus.vectorReady ? `${corpus.vectorModel} 向量索引已就绪` : '尚未构建语义向量索引'}</span></div></div><div className="corpus-stats corpus-stats--knowledge"><span><b>{corpus.bookCount}</b>本古籍</span><span><b>{corpus.ruleCount}</b>条规则</span><span><b>{corpus.caseCount}</b>条占例</span><span><b>{corpus.doctrineCount}</b>条义理</span></div>{corpus.vectorReady ? <p className="corpus-ready">混合检索可用：关键词召回 + 本地向量召回；配置业务空间重排地址后再使用 qwen3-rerank 精排。</p> : <p className="corpus-warning">首次构建会把古籍片段分批发送给阿里向量模型并把结果保存在本机。之后日常解卦只发送问题和少量候选证据。</p>}<button className="index-button" type="button" onClick={() => void rebuildVectors()} disabled={!hasApiKey || indexing}>{indexing ? '正在构建向量索引…' : '构建 / 更新向量索引'}</button></section>
        <div className="security-note"><ShieldCheck /><p><strong>隐私边界</strong>密钥由 Windows DPAPI 加密；历史和向量索引留在本机。日常解卦只发送当前问题、只读排盘和命中的少量证据。</p></div>
      </aside>
    </div>
  );
}
