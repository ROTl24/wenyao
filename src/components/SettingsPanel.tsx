import { Database, KeyRound, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktop } from '../lib/desktop';

interface Props { onClose(): void }

export function SettingsPanel({ onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [status, setStatus] = useState('');
  const [corpus, setCorpus] = useState({ count: 0, bookCount: 0, originalCount: 0, summaryCount: 0, ready: false });
  useEffect(() => { void Promise.all([desktop.settings.get(), desktop.corpus.status()]).then(([settings, corpusStatus]) => { setBaseUrl(settings.baseUrl); setModel(settings.model); setHasApiKey(settings.hasApiKey); setCorpus(corpusStatus); }); }, []);
  const save = async () => {
    setStatus('保存中…');
    try { const result = await desktop.settings.save({ baseUrl, model, apiKey: apiKey || undefined }); setHasApiKey(result.hasApiKey); setApiKey(''); setStatus('设置已保存。'); }
    catch (error) { setStatus(error instanceof Error ? error.message : '保存失败。'); }
  };
  const test = async () => { setStatus('正在测试连接…'); const result = await desktop.settings.test(); setStatus(result.ok ? result.message || '连接成功。' : `${result.error?.message} ${result.error?.nextAction}`); };
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel settings-panel" aria-modal="true" role="dialog">
        <header><div><h2>AI 与知识库</h2><p>密钥由 Windows DPAPI 加密保存</p></div><button type="button" aria-label="关闭 AI 设置" onClick={onClose}><X /></button></header>
        <section className="settings-section"><div className="settings-heading"><KeyRound /><div><strong>云端模型</strong><span>兼容 OpenAI Chat Completions 接口</span></div></div><label>API 地址<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label><label>模型名称<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 gpt-5-mini 或供应商模型名" /></label><label>API 密钥<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasApiKey ? '密钥已安全保存；留空表示不修改' : '输入后由 Windows 加密'} /></label><div className="settings-actions"><button type="button" onClick={save}>保存设置</button><button type="button" onClick={test}>测试连接</button></div>{status && <p className="settings-status">{status}</p>}</section>
        <section className="settings-section"><div className="settings-heading"><Database /><div><strong>本地古籍证据包</strong><span>整本古籍不会上传给云端 AI</span></div></div><div className="corpus-stats"><span><b>{corpus.bookCount}</b>本古籍</span><span><b>{corpus.originalCount}</b>条原文</span><span><b>{corpus.summaryCount}</b>条摘要</span></div>{corpus.originalCount === 0 ? <p className="corpus-warning">当前为演示摘要。导入校订后的古籍，才会显示可追溯的正式原文证据。</p> : <p className="corpus-ready">证据包已就绪：分析只会向云端发送当前命中的少量原文，不会上传整本古籍。</p>}</section>
        <div className="security-note"><ShieldCheck /><p><strong>隐私边界</strong>只有当前问题、只读排盘和命中的少量证据会发送给云端；历史记录默认留在本机。</p></div>
      </aside>
    </div>
  );
}
