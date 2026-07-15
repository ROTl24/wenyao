import { Database, KeyRound, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import alibabaConfig from '../../config/alibaba.json';
import deepseekConfig from '../../config/deepseek.json';
import { desktop } from '../lib/desktop';

interface Props { onClose(): void }

export function SettingsPanel({ onClose }: Props) {
  const [alibabaBaseUrl, setAlibabaBaseUrl] = useState(alibabaConfig.baseUrl);
  const [alibabaModel, setAlibabaModel] = useState(alibabaConfig.model);
  const [embeddingModel, setEmbeddingModel] = useState(alibabaConfig.embeddingModel);
  const [embeddingDimensions, setEmbeddingDimensions] = useState(alibabaConfig.embeddingDimensions);
  const [rerankModel, setRerankModel] = useState(alibabaConfig.rerankModel);
  const [rerankUrl, setRerankUrl] = useState(alibabaConfig.rerankUrl);
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState(deepseekConfig.baseUrl);
  const [deepseekModel, setDeepseekModel] = useState(deepseekConfig.model);
  const [alibabaApiKey, setAlibabaApiKey] = useState('');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [hasAlibabaApiKey, setHasAlibabaApiKey] = useState(false);
  const [hasDeepSeekApiKey, setHasDeepSeekApiKey] = useState(false);
  const [status, setStatus] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [corpus, setCorpus] = useState({ count: 0, bookCount: 0, originalCount: 0, summaryCount: 0, ruleCount: 0, caseCount: 0, doctrineCount: 0, vectorReady: false, vectorModel: '', ready: false });

  useEffect(() => {
    void Promise.all([desktop.settings.get(), desktop.corpus.status()]).then(([settings, corpusStatus]) => {
      setAlibabaBaseUrl(settings.alibabaBaseUrl);
      setAlibabaModel(settings.alibabaModel);
      setEmbeddingModel(settings.embeddingModel);
      setEmbeddingDimensions(settings.embeddingDimensions);
      setRerankModel(settings.rerankModel);
      setRerankUrl(settings.rerankUrl);
      setDeepseekBaseUrl(settings.deepseekBaseUrl);
      setDeepseekModel(settings.deepseekModel);
      setHasAlibabaApiKey(settings.hasAlibabaApiKey);
      setHasDeepSeekApiKey(settings.hasDeepSeekApiKey);
      setCorpus(corpusStatus);
    });
  }, []);

  const save = async () => {
    setStatus('保存中…');
    try {
      const result = await desktop.settings.save({
        alibabaBaseUrl,
        alibabaModel,
        embeddingModel,
        embeddingDimensions,
        rerankModel,
        rerankUrl,
        deepseekBaseUrl,
        deepseekModel,
        alibabaApiKey: alibabaApiKey || undefined,
        deepseekApiKey: deepseekApiKey || undefined,
      });
      setHasAlibabaApiKey(result.hasAlibabaApiKey);
      setHasDeepSeekApiKey(result.hasDeepSeekApiKey);
      setAlibabaApiKey('');
      setDeepseekApiKey('');
      setCorpus(await desktop.corpus.status());
      setStatus('阿里云检索与 DeepSeek 解读设置已保存。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '保存失败。'); }
  };

  const test = async () => {
    setStatus('正在测试阿里云与 DeepSeek 连接…');
    const result = await desktop.settings.test();
    setStatus(result.ok ? result.message || '连接成功。' : `${result.error?.message} ${result.error?.nextAction}`);
  };

  const rebuildVectors = async () => {
    setIndexing(true);
    setStatus(`正在向阿里云 text-embedding-v4 生成 ${corpus.count} 条本地向量，窗口可继续保留打开…`);
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
        <header><div><h2>AI 与知识库</h2><p>两套密钥均由 Windows DPAPI 加密保存</p></div><button type="button" aria-label="关闭 AI 设置" onClick={onClose}><X /></button></header>

        <section className="settings-section">
          <div className="settings-heading"><KeyRound /><div><strong>阿里云百炼 · 千问检索栈</strong><span>原千问配置负责聊天连通性、向量召回与可选重排</span></div></div>
          <label>官方兼容 API 地址<input value={alibabaBaseUrl} onChange={(event) => setAlibabaBaseUrl(event.target.value)} /></label>
          <label>千问模型<input value={alibabaModel} onChange={(event) => setAlibabaModel(event.target.value)} /></label>
          <div className="settings-grid">
            <label>向量模型<input value={embeddingModel} onChange={(event) => setEmbeddingModel(event.target.value)} /></label>
            <label>向量维度<input value={embeddingDimensions} readOnly /></label>
          </div>
          <div className="settings-grid">
            <label>重排模型<input value={rerankModel} onChange={(event) => setRerankModel(event.target.value)} /></label>
            <label>重排业务空间地址（可选）<input value={rerankUrl} onChange={(event) => setRerankUrl(event.target.value)} placeholder="没有 Workspace ID 可留空" /></label>
          </div>
          <label>阿里云 API 密钥<input type="password" value={alibabaApiKey} onChange={(event) => setAlibabaApiKey(event.target.value)} placeholder={hasAlibabaApiKey ? '密钥已安全保存；留空表示不修改' : '输入后由 Windows 加密'} /></label>
        </section>

        <section className="settings-section">
          <div className="settings-heading"><KeyRound /><div><strong>DeepSeek · AI 解读</strong><span>只有正式解读与追问走 DeepSeek 官方接口</span></div></div>
          <label>官方 API 地址<input value={deepseekBaseUrl} onChange={(event) => setDeepseekBaseUrl(event.target.value)} /></label>
          <label>解读模型<input value={deepseekModel} onChange={(event) => setDeepseekModel(event.target.value)} /></label>
          <label>DeepSeek API 密钥<input type="password" value={deepseekApiKey} onChange={(event) => setDeepseekApiKey(event.target.value)} placeholder={hasDeepSeekApiKey ? '密钥已安全保存；留空表示不修改' : '输入后由 Windows 加密'} /></label>
          <div className="settings-actions"><button type="button" onClick={save}>保存设置</button><button type="button" onClick={test}>测试两套连接</button></div>
          {status && <p className="settings-status">{status}</p>}
        </section>

        <section className="settings-section">
          <div className="settings-heading"><Database /><div><strong>本地结构化古籍库</strong><span>{corpus.vectorReady ? `${corpus.vectorModel} 向量索引已就绪` : '尚未构建语义向量索引'}</span></div></div>
          <div className="corpus-stats corpus-stats--knowledge"><span><b>{corpus.bookCount}</b>本古籍</span><span><b>{corpus.ruleCount}</b>条规则</span><span><b>{corpus.caseCount}</b>条占例</span><span><b>{corpus.doctrineCount}</b>条义理</span></div>
          {corpus.vectorReady ? <p className="corpus-ready">混合检索可用：关键词召回 + 本地向量召回 + 阿里云可选重排。</p> : <p className="corpus-warning">首次构建会把古籍片段分批发送给阿里云向量模型并把结果保存在本机。之后日常解卦只发送问题和少量候选证据。</p>}
          <button className="index-button" type="button" onClick={() => void rebuildVectors()} disabled={!hasAlibabaApiKey || indexing}>{indexing ? '正在构建向量索引…' : '构建 / 更新向量索引'}</button>
        </section>

        <div className="security-note"><ShieldCheck /><p><strong>隐私边界</strong>两套密钥分别由 Windows DPAPI 加密；历史和向量索引留在本机。日常解卦只把当前问题、只读排盘和命中的少量证据发送给 DeepSeek。</p></div>
      </aside>
    </div>
  );
}
