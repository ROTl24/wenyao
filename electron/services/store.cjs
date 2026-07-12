const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const DEFAULT_STATE = Object.freeze({ migrationVersion: 2, sessions: [], settings: {} });
const RUNTIME_TRUST = new Set(['authoritative', 'browser-preview']);
const TOSS_VALUES = new Set([6, 7, 8, 9]);

function ownedClone(value) {
  return structuredClone(value);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactIso(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}

function interactionFingerprint(session) {
  const payload = {
    id: session.id,
    question: session.question ?? null,
    category: session.category ?? null,
    castAt: session.castAt ?? null,
    status: session.status ?? null,
    tosses: session.tosses ?? [],
    currentToss: session.currentToss ?? null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalValue(payload))).digest('hex');
}

function rendererCreateSnapshot(input) {
  if (!isRecord(input) || !nonEmptyString(input.id) || typeof input.question !== 'string') {
    throw new TypeError('会话数据无效');
  }
  const session = {
    id: input.id,
    question: input.question,
    ...(typeof input.category === 'string' ? { category: input.category } : {}),
    ...(typeof input.castAt === 'string' ? { castAt: input.castAt } : {}),
    status: 'casting',
    tosses: Array.isArray(input.tosses) ? ownedClone(input.tosses) : [],
    ...(isRecord(input.currentToss) ? { currentToss: ownedClone(input.currentToss) } : {}),
    messages: [],
    interactionRevision: 1,
  };
  if (!validTossSequence(session.tosses)) throw new TypeError('投币历史冲突');
  if (!validCurrentToss(session.currentToss, session.tosses.length)) {
    throw new TypeError('当前投币状态冲突');
  }
  if (session.tosses.length === 6) {
    session.status = 'complete';
    delete session.currentToss;
  }
  return session;
}

function tossPrefixMatches(existing, incoming) {
  return existing.every((toss, index) => isDeepStrictEqual(toss, incoming[index]));
}

function expectedTossFields(value) {
  return {
    label: value === 6 ? '老阴' : value === 7 ? '少阳' : value === 8 ? '少阴' : '老阳',
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 7 || value === 6,
  };
}

function validTossFields(toss, lineIndex, { confirmed }) {
  if (
    !isRecord(toss)
    || !nonEmptyString(toss.id)
    || !nonEmptyString(toss.visualSeed)
    || toss.lineIndex !== lineIndex
    || !TOSS_VALUES.has(toss.value)
    || !Array.isArray(toss.faces)
    || toss.faces.length !== 3
    || toss.faces.some((face) => face !== 'text' && face !== 'reverse')
    || (confirmed ? !exactIso(toss.confirmedAt) : Object.hasOwn(toss, 'confirmedAt'))
  ) return false;

  const faceValue = toss.faces.reduce((sum, face) => sum + (face === 'text' ? 2 : 3), 0);
  const expected = expectedTossFields(toss.value);
  return faceValue === toss.value
    && toss.label === expected.label
    && toss.moving === expected.moving
    && toss.baseYang === expected.baseYang
    && toss.changedYang === expected.changedYang;
}

function validTossSequence(tosses) {
  return tosses.length <= 6 && tosses.every((toss, index) => (
    validTossFields(toss, index + 1, { confirmed: true })
    && !tosses.slice(0, index).some((candidate) => candidate.id === toss.id)
  ));
}

function validCurrentToss(toss, confirmedCount) {
  if (confirmedCount >= 6) return toss === undefined;
  return toss === undefined || validTossFields(toss, confirmedCount + 1, { confirmed: false });
}

function compareRendererProgress(existing, input) {
  const currentTosses = Array.isArray(existing.tosses) ? existing.tosses : [];
  const incomingTosses = Array.isArray(input.tosses) ? ownedClone(input.tosses) : currentTosses;
  if (!validTossSequence(incomingTosses)) throw new TypeError('投币历史冲突');
  if (incomingTosses.length < currentTosses.length) {
    if (!tossPrefixMatches(incomingTosses, currentTosses)) throw new TypeError('投币历史冲突');
    return { stale: true };
  }
  if (!tossPrefixMatches(currentTosses, incomingTosses)) throw new TypeError('投币历史冲突');

  const progressed = incomingTosses.length > currentTosses.length;
  const status = incomingTosses.length === 6 ? 'complete' : 'casting';
  const incomingCurrent = isRecord(input.currentToss) ? ownedClone(input.currentToss) : undefined;
  if (!validCurrentToss(incomingCurrent, incomingTosses.length)) {
    throw new TypeError('当前投币状态冲突');
  }
  let currentToss = existing.currentToss;

  if (status === 'complete') {
    currentToss = undefined;
  } else if (progressed) {
    currentToss = incomingCurrent;
  } else if (incomingCurrent && existing.currentToss) {
    if (!isDeepStrictEqual(incomingCurrent, existing.currentToss)) {
      throw new TypeError('当前投币状态冲突');
    }
  } else if (incomingCurrent && !existing.currentToss) {
    currentToss = incomingCurrent;
  }

  const changed = progressed
    || status !== existing.status
    || !isDeepStrictEqual(currentToss, existing.currentToss);
  return { stale: false, changed, tosses: incomingTosses, currentToss, status };
}

class JsonStore {
  constructor(filePath, { fileSystem = fs, now = () => new Date() } = {}) {
    this.filePath = filePath;
    this.fileSystem = fileSystem;
    this.now = now;
    this.deletedSessionIds = new Set();
    this.fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
    this.state = this.#load();
  }

  #load() {
    if (!this.fileSystem.existsSync(this.filePath)) return ownedClone(DEFAULT_STATE);
    let parsed;
    try {
      parsed = JSON.parse(this.fileSystem.readFileSync(this.filePath, 'utf8'));
    } catch (cause) {
      throw new Error('数据文件损坏，已阻止启动以避免覆盖原始记录。', { cause });
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.sessions) || !isRecord(parsed.settings)) {
      throw new Error('数据文件损坏，已阻止启动以避免覆盖原始记录。');
    }
    return {
      ...ownedClone(parsed),
      migrationVersion: parsed.migrationVersion === 2 ? 2 : undefined,
      sessions: ownedClone(parsed.sessions),
      settings: ownedClone(parsed.settings),
    };
  }

  #commit(nextState) {
    const tmp = `${this.filePath}.tmp`;
    try {
      this.fileSystem.writeFileSync(tmp, JSON.stringify(nextState, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      this.fileSystem.renameSync(tmp, this.filePath);
    } catch (error) {
      try {
        if (this.fileSystem.existsSync(tmp)) this.fileSystem.unlinkSync(tmp);
      } catch {}
      throw error;
    }
    this.state = nextState;
  }

  #nextTimestamp(existing) {
    const value = this.now();
    const now = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(now.getTime())) throw new TypeError('Store 时钟无效');
    let timestamp = now.getTime();
    const previous = Date.parse(existing?.updatedAt || '');
    if (Number.isFinite(previous) && timestamp <= previous) timestamp = previous + 1;
    return new Date(timestamp).toISOString();
  }

  #sessionIndex(id) {
    return this.state.sessions.findIndex((item) => item.id === id);
  }

  #requireSession(id) {
    if (this.deletedSessionIds.has(id)) throw new Error('会话已删除');
    const index = this.#sessionIndex(id);
    if (index < 0) throw new Error('会话不存在');
    return { index, session: this.state.sessions[index] };
  }

  #replaceSession(index, session) {
    const sessions = [...this.state.sessions];
    sessions[index] = ownedClone(session);
    this.#commit({ ...this.state, migrationVersion: 2, sessions });
    return ownedClone(session);
  }

  #assertCaseHash(session, expectedFactSetHash) {
    if (
      !nonEmptyString(expectedFactSetHash)
      || session.caseSnapshot?.factSetHash !== expectedFactSetHash
    ) throw new Error('权威 Case 已变化');
  }

  listSessions() {
    return ownedClone(this.state.sessions)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  getSession(id) {
    if (this.deletedSessionIds.has(id)) return null;
    const session = this.state.sessions.find((item) => item.id === id);
    return session ? ownedClone(session) : null;
  }

  getInteractionFingerprint(id) {
    const { session } = this.#requireSession(id);
    return interactionFingerprint(session);
  }

  saveRendererSession(input) {
    if (!isRecord(input) || !nonEmptyString(input.id) || typeof input.question !== 'string') {
      throw new TypeError('会话数据无效');
    }
    if (this.deletedSessionIds.has(input.id)) throw new Error('会话已删除');
    const index = this.#sessionIndex(input.id);
    if (index < 0) {
      const created = rendererCreateSnapshot(input);
      created.updatedAt = this.#nextTimestamp();
      this.#commit({
        ...this.state,
        migrationVersion: 2,
        sessions: [...this.state.sessions, ownedClone(created)],
      });
      return ownedClone(created);
    }

    const existing = this.state.sessions[index];
    const progress = compareRendererProgress(existing, input);
    if (progress.stale || !progress.changed) return ownedClone(existing);
    const next = {
      ...existing,
      status: progress.status,
      tosses: progress.tosses,
      ...(progress.currentToss ? { currentToss: progress.currentToss } : {}),
      interactionRevision: Number(existing.interactionRevision || 0) + 1,
      updatedAt: this.#nextTimestamp(existing),
    };
    if (!progress.currentToss) delete next.currentToss;
    return this.#replaceSession(index, next);
  }

  saveAuthoritativeCase(sessionId, caseSnapshot, options = {}) {
    const { index, session } = this.#requireSession(sessionId);
    if (
      !isRecord(caseSnapshot)
      || caseSnapshot.sessionId !== sessionId
      || !isRecord(caseSnapshot.plate)
      || caseSnapshot.plate.sessionId !== sessionId
      || caseSnapshot.question !== session.question
      || (typeof session.category === 'string' && caseSnapshot.category !== session.category)
      || (typeof session.castAt === 'string' && caseSnapshot.plate.castAt !== session.castAt)
    ) throw new TypeError('权威 Case 会话身份不一致');
    if (caseSnapshot.plate.id !== `plate:${sessionId}:v2`) {
      throw new TypeError('权威 Case 的 plate ID 无效');
    }
    if (
      !nonEmptyString(options.expectedInteractionFingerprint)
      || options.expectedInteractionFingerprint !== interactionFingerprint(session)
    ) throw new Error('会话交互状态已变化');
    if (!RUNTIME_TRUST.has(options.runtimeTrust)) throw new TypeError('Case 运行时信任标识无效');
    if (
      Object.hasOwn(options, 'expectedFactSetHash')
      && session.caseSnapshot?.factSetHash !== options.expectedFactSetHash
    ) throw new Error('权威 Case 已变化');

    const changedCase = session.caseSnapshot?.factSetHash !== caseSnapshot.factSetHash;
    const { plate: _legacyPlate, ...withoutLegacyPlate } = session;
    const next = {
      ...withoutLegacyPlate,
      caseSnapshot: ownedClone(caseSnapshot),
      ruleContext: ownedClone(caseSnapshot.ruleContext),
      migrationVersion: 2,
      migrationState: 'clean',
      caseRuntimeTrust: options.runtimeTrust,
      authoritativeRevision: Number(session.authoritativeRevision || 0) + 1,
      updatedAt: this.#nextTimestamp(session),
    };
    if (changedCase) delete next.analysis;
    return this.#replaceSession(index, next);
  }

  saveAuthoritativeAnalysis(sessionId, analysis, { expectedFactSetHash } = {}) {
    const { index, session } = this.#requireSession(sessionId);
    this.#assertCaseHash(session, expectedFactSetHash);
    if (!isRecord(analysis)) throw new TypeError('权威分析无效');
    const next = {
      ...session,
      analysis: ownedClone(analysis),
      authoritativeRevision: Number(session.authoritativeRevision || 0) + 1,
      updatedAt: this.#nextTimestamp(session),
    };
    return this.#replaceSession(index, next);
  }

  appendAuthoritativeMessage(sessionId, message, { expectedFactSetHash } = {}) {
    const { index, session } = this.#requireSession(sessionId);
    this.#assertCaseHash(session, expectedFactSetHash);
    if (
      !isRecord(message)
      || !nonEmptyString(message.id)
      || !['user', 'assistant'].includes(message.role)
      || typeof message.content !== 'string'
      || !nonEmptyString(message.createdAt)
    ) throw new TypeError('权威消息无效');
    const messages = Array.isArray(session.messages) ? session.messages : [];
    if (messages.some((entry) => entry.id === message.id)) return ownedClone(session);
    const next = {
      ...session,
      messages: [...messages, ownedClone(message)],
      authoritativeRevision: Number(session.authoritativeRevision || 0) + 1,
      updatedAt: this.#nextTimestamp(session),
    };
    return this.#replaceSession(index, next);
  }

  deleteSession(id) {
    const sessions = this.state.sessions.filter((item) => item.id !== id);
    this.#commit({ ...this.state, migrationVersion: 2, sessions });
    this.deletedSessionIds.add(id);
    return true;
  }

  saveSettings(settings) {
    if (!isRecord(settings)) throw new TypeError('设置数据无效');
    const nextState = {
      ...this.state,
      migrationVersion: 2,
      settings: { ...this.state.settings, ...ownedClone(settings) },
    };
    this.#commit(nextState);
    return this.getPublicSettings();
  }

  getRawSettings() {
    return {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.7-plus',
      embeddingModel: 'text-embedding-v4',
      rerankModel: 'qwen3-rerank',
      rerankUrl: '',
      ...ownedClone(this.state.settings),
    };
  }

  getPublicSettings() {
    const {
      baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model = 'qwen3.7-plus',
      embeddingModel = 'text-embedding-v4',
      rerankModel = 'qwen3-rerank',
      rerankUrl = '',
      encryptedApiKey = '',
    } = this.state.settings;
    return {
      baseUrl,
      model,
      embeddingModel,
      rerankModel,
      rerankUrl,
      hasApiKey: Boolean(encryptedApiKey),
    };
  }
}

module.exports = { JsonStore, interactionFingerprint };
