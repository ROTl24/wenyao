import { Check, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktop } from '../lib/desktop';
import {
  FEEDBACK_REASONS,
  technicalSnapshot,
  type FeedbackReason,
  type FeedbackRecord,
  type FeedbackState,
} from '../lib/feedback';
import type { AnalysisEvidenceSnapshot, AnalysisReport } from '../lib/types';

interface Props {
  sessionId: string;
  targetType: FeedbackRecord['targetType'];
  targetId: string;
  report: AnalysisReport;
  snapshot: AnalysisEvidenceSnapshot;
  question: string;
  answer: string;
}

export function FeedbackControl({ sessionId, targetType, targetId, report, snapshot, question, answer }: Props) {
  const [state, setState] = useState<FeedbackState | null>(null);
  const [editing, setEditing] = useState(false);
  const [sentiment, setSentiment] = useState<FeedbackRecord['sentiment']>('helpful');
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [note, setNote] = useState('');
  const [contentOptIn, setContentOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [error, setError] = useState('');
  const record = state?.records.find((item) => item.targetType === targetType && item.targetId === targetId);

  useEffect(() => {
    void desktop.feedback.getState().then((next) => setState(next)).catch((cause) => setError(cause instanceof Error ? cause.message : '反馈读取失败'));
  }, [targetId, targetType]);

  const start = (nextSentiment: FeedbackRecord['sentiment']) => {
    setSentiment(nextSentiment);
    setReasons(record?.reasons || []);
    setNote(record?.note || '');
    setContentOptIn(record?.contentOptIn || false);
    setEditing(nextSentiment === 'problematic');
    if (nextSentiment === 'helpful') void save(nextSentiment, [], record?.note || '', record?.contentOptIn || false);
  };

  const save = async (
    nextSentiment = sentiment,
    nextReasons = reasons,
    nextNote = note,
    nextContentOptIn = contentOptIn,
  ) => {
    setSaving(true);
    setError('');
    try {
      await desktop.feedback.submit({
        feedbackId: record?.feedbackId,
        sessionId,
        targetType,
        targetId,
        sentiment: nextSentiment,
        reasons: nextReasons,
        note: nextNote,
        technical: technicalSnapshot(report, snapshot),
        contentOptIn: nextContentOptIn,
        ...(nextContentOptIn ? { content: { question, answer } } : {}),
      });
      const next = await desktop.feedback.getState();
      setState(next);
      setEditing(false);
      if (next.consent.technicalUpload === null) setAskConsent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '反馈保存失败');
    } finally {
      setSaving(false);
    }
  };

  const decideConsent = async (enabled: boolean) => {
    setSaving(true);
    setError('');
    try {
      setState(await desktop.feedback.setConsent(enabled));
      setAskConsent(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '授权设置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleReason = (reason: FeedbackReason) => {
    setReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]);
  };

  return (
    <div className="feedback-control" data-target-id={targetId}>
      <div className="feedback-question">
        <span>{record ? <><Check size={14} />反馈已保存</> : '这次解读对你有帮助吗？'}</span>
        <button className={record?.sentiment === 'helpful' ? 'is-active' : ''} type="button" onClick={() => start('helpful')} disabled={saving}><ThumbsUp size={15} />有帮助</button>
        <button className={record?.sentiment === 'problematic' ? 'is-active' : ''} type="button" onClick={() => start('problematic')} disabled={saving}><ThumbsDown size={15} />有问题</button>
        {record && !editing ? <button className="feedback-edit" type="button" onClick={() => start(record.sentiment)}>修改</button> : null}
      </div>
      {editing ? (
        <div className="feedback-editor">
          <div className="feedback-reasons" aria-label="问题原因">
            {FEEDBACK_REASONS.map((reason) => <label key={reason}><input type="checkbox" checked={reasons.includes(reason)} onChange={() => toggleReason(reason)} />{reason}</label>)}
          </div>
          <label>补充说明（选填）<textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></label>
          <label className="feedback-content-opt-in"><input type="checkbox" checked={contentOptIn} onChange={(event) => setContentOptIn(event.target.checked)} />本次额外上传问题和回答原文</label>
          {contentOptIn ? <details className="feedback-preview"><summary>预览将上传的原文</summary><strong>问题</strong><p>{question}</p><strong>回答</strong><p>{answer}</p></details> : null}
          <div className="feedback-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? '保存中…' : '保存反馈'}</button><button type="button" onClick={() => setEditing(false)}>取消</button></div>
        </div>
      ) : null}
      {error ? <small className="feedback-error" role="alert">{error}</small> : null}
      {askConsent ? (
        <div className="feedback-consent" role="dialog" aria-label="反馈上传授权">
          <strong>是否允许上传本次反馈和脱敏技术信息？</strong>
          <p>上传内容包括你的评价、原因、补充说明，以及模型标识、检索模式、候选排名、证据 ID 和版本；默认不包含问题、回答、古籍正文、导入书名、密钥、接口地址或连接名称。</p>
          <button type="button" onClick={() => void decideConsent(true)} disabled={saving}>允许并发送</button>
          <button type="button" onClick={() => void decideConsent(false)} disabled={saving}>仅保存在本机</button>
        </div>
      ) : null}
    </div>
  );
}
