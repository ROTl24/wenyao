import { describe, expect, it } from 'vitest';
import { createTossFromValue } from './divination';
import { confirmCurrentToss, createSession, prepareToss, type DivinationSession } from './session';
import { parseSessionArchive, serializeSessionArchive } from './sessionArchive';

function fixture(): DivinationSession {
  let session = createSession('项目能否按期完成？', 'career', new Date('2026-08-01T00:00:00.000Z'));
  for (const value of [6, 7, 8, 9, 7, 8] as const) session = confirmCurrentToss(prepareToss(session, createTossFromValue(value), `seed-${value}`));
  const snapshot = {
    capturedAt: session.castAt, appVersion: '0.5.6', corpusVersion: 'fixture', category: 'career',
    evidence: [{ id: 'e-1', title: '测试资料', source: '虚构样例', location: '第一章', text: '这是本地测试资料。', tags: ['测试'], sourceType: 'original' as const }],
    retrieval: { mode: 'lexical-fallback' as const, lexicalCandidates: 1, vectorCandidates: 0, fusedCandidates: 1, vectorUsed: false, rerankUsed: false, warnings: [] },
  };
  return { ...session, analysis: { mode: 'cloud', analysisId: 'report-1', markdown: '## 九、综合判断\n\n如果前提成立，才可能推进。[依据](#evidence-e-1)', generatedAt: session.castAt, evidenceSnapshot: snapshot },
    messages: [{ id: 'm-1', role: 'assistant', content: '需要先确认前提。', createdAt: session.castAt, evidenceSnapshot: snapshot }],
    review: { status: 'happened', observedAt: '2026-08-31', note: '部分完成，条件有变化。', tags: ['复盘'], updatedAt: session.updatedAt },
  };
}

describe('占簿备份', () => {
  it('round trips complete reports, evidence, dialogue, review and casting facts, excluding unknown settings', () => {
    const original = fixture();
    const dirty = structuredClone(original) as any;
    dirty.apiKey = 'secret-session'; dirty.settings = { token: 'secret-settings' };
    dirty.analysis.evidenceSnapshot.evidence[0].apiKey = 'secret-evidence';
    dirty.plate.apiKey = 'secret-plate';
    const archive = serializeSessionArchive([dirty]);
    expect(archive).not.toContain('secret-');
    expect(parseSessionArchive(archive).sessions).toEqual([original]);
  });
  it('round trips unfinished digital casting without completing it', () => {
    const pending = prepareToss(createSession('未完成的起卦记录', 'other'), createTossFromValue(6), 'seed');
    expect(parseSessionArchive(serializeSessionArchive([pending])).sessions).toEqual([pending]);
  });
  it('rejects the entire archive for invalid final records, mismatched plates, duplicate IDs and unknown versions', () => {
    const original = fixture();
    const envelope = JSON.parse(serializeSessionArchive([original]));
    envelope.sessions.push({ ...original, id: 'bad', lines: [] });
    expect(() => parseSessionArchive(JSON.stringify(envelope))).toThrow(/第 2 条/);
    envelope.sessions = [original, original];
    expect(() => parseSessionArchive(JSON.stringify(envelope))).toThrow(/重复/);
    envelope.sessions = [structuredClone(original)];
    envelope.sessions[0].plate.baseHexagram.name = '篡改卦象';
    expect(() => parseSessionArchive(JSON.stringify(envelope))).toThrow(/不一致/);
    envelope.version = 99;
    expect(() => parseSessionArchive(JSON.stringify(envelope))).toThrow(/版本/);
  });
  it('keeps a stopped draft separate from the last complete report and rejects a forged completion state', () => {
    const session = fixture();
    session.generationDraft = { requestId: 'request-stopped', kind: 'analysis', status: 'stopped', evidenceSnapshot: session.analysis!.evidenceSnapshot, content: '新正文尚未完整', question: session.question, updatedAt: session.updatedAt };
    const restored = parseSessionArchive(serializeSessionArchive([session])).sessions[0];
    expect(restored.generationDraft).toEqual(session.generationDraft);
    expect(restored.analysis?.markdown).toBe(session.analysis!.markdown);
    const forged = JSON.parse(serializeSessionArchive([session]));
    forged.sessions[0].generationDraft.status = 'complete';
    expect(() => parseSessionArchive(JSON.stringify(forged))).toThrow(/草稿无效/);
  });

});
