const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  migrateLegacySettings,
  normalizeAIState,
  publicAIState,
} = require('./ai-config.cjs');
const {
  normalizeStoredSession,
  validateSessionForSave,
} = require('./session-validation.cjs');

const DEFAULT_STATE = Object.freeze({ sessions: [], settings: {}, feedback: { consent: { technicalUpload: null }, records: [] } });
const TRANSIENT_REPLACE_ERRORS = new Set(['EACCES', 'EBUSY', 'ENOTEMPTY', 'EPERM']);
const REPLACE_RETRY_DELAYS_MS = [10, 25, 50, 100, 200];
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));

function replaceFileAtomically(source, target) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(source, target);
      return;
    } catch (error) {
      const delay = REPLACE_RETRY_DELAYS_MS[attempt];
      if (!TRANSIENT_REPLACE_ERRORS.has(error?.code) || delay === undefined) throw error;
      Atomics.wait(sleepBuffer, 0, 0, delay);
    }
  }
}

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const loaded = this.#load();
    const migration = migrateLegacySettings(loaded.settings);
    this.state = { ...loaded, settings: migration.settings };
    if (migration.migrated) {
      const backupPath = `${this.filePath}.pre-ai-v2-${Date.now()}.bak`;
      if (fs.existsSync(this.filePath)) fs.copyFileSync(this.filePath, backupPath);
      try { this.#write(); }
      catch (error) {
        this.state = loaded;
        throw error;
      }
    }
  }

  #load() {
    if (!fs.existsSync(this.filePath)) return structuredClone(DEFAULT_STATE);
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
        feedback: parsed.feedback && typeof parsed.feedback === 'object'
          ? parsed.feedback
          : structuredClone(DEFAULT_STATE.feedback),
      };
    } catch (error) {
      const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
      fs.copyFileSync(this.filePath, corruptPath);
      return structuredClone(DEFAULT_STATE);
    }
  }

  #write() {
    const tmp = `${this.filePath}.${process.pid}-${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), { encoding: 'utf8', mode: 0o600 });
      replaceFileAtomically(tmp, this.filePath);
    } catch (error) {
      try { fs.unlinkSync(tmp); } catch (cleanupError) { if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError; }
      throw error;
    }
  }

  listSessions() {
    return structuredClone(this.state.sessions)
      .map((session) => normalizeStoredSession(session))
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  getSession(id) {
    const session = this.state.sessions.find((item) => item.id === id);
    return session ? normalizeStoredSession(session) : null;
  }

  saveSession(session) {
    const index = this.state.sessions.findIndex((item) => item.id === session?.id);
    const existing = index >= 0 ? this.state.sessions[index] : null;
    const safeSession = validateSessionForSave(session, existing);
    if (index >= 0) this.state.sessions[index] = safeSession;
    else this.state.sessions.push(safeSession);
    this.#write();
    return structuredClone(safeSession);
  }

  deleteSession(id) {
    this.state.sessions = this.state.sessions.filter((item) => item.id !== id);
    this.#write();
    return true;
  }

  getRawAIState() {
    return normalizeAIState(this.state.settings.ai);
  }

  getPublicAIState() {
    return publicAIState(this.state.settings.ai);
  }

  saveAIState(aiState) {
    this.state.settings = {
      ...this.state.settings,
      ai: normalizeAIState(aiState),
    };
    this.#write();
    return this.getPublicAIState();
  }

  updateAIState(updater) {
    const current = this.getRawAIState();
    const next = updater(structuredClone(current));
    return this.saveAIState(next === undefined ? current : next);
  }

  appendAIUsage(entry) {
    return this.updateAIState((state) => {
      state.usage = [...state.usage, structuredClone(entry)].slice(-1000);
      return state;
    });
  }

  getFeedbackState() {
    const feedback = this.state.feedback && typeof this.state.feedback === 'object'
      ? this.state.feedback
      : structuredClone(DEFAULT_STATE.feedback);
    return structuredClone({
      consent: feedback.consent && typeof feedback.consent === 'object'
        ? feedback.consent
        : { technicalUpload: null },
      records: Array.isArray(feedback.records) ? feedback.records : [],
    });
  }

  saveFeedbackState(feedback) {
    this.state.feedback = structuredClone(feedback);
    this.#write();
    return this.getFeedbackState();
  }
}

module.exports = { JsonStore };
