const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = Object.freeze({ sessions: [], settings: {} });

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.state = this.#load();
  }

  #load() {
    if (!fs.existsSync(this.filePath)) return structuredClone(DEFAULT_STATE);
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
      };
    } catch (error) {
      const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
      fs.copyFileSync(this.filePath, corruptPath);
      return structuredClone(DEFAULT_STATE);
    }
  }

  #write() {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  listSessions() {
    return structuredClone(this.state.sessions)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  getSession(id) {
    const session = this.state.sessions.find((item) => item.id === id);
    return session ? structuredClone(session) : null;
  }

  saveSession(session) {
    if (!session || typeof session.id !== 'string' || typeof session.question !== 'string') {
      throw new TypeError('会话数据无效');
    }
    const index = this.state.sessions.findIndex((item) => item.id === session.id);
    const safeSession = structuredClone(session);
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

  saveSettings(settings) {
    this.state.settings = { ...this.state.settings, ...structuredClone(settings) };
    this.#write();
    return this.getPublicSettings();
  }

  getRawSettings() {
    return {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.7-plus',
      embeddingModel: 'text-embedding-v4',
      rerankModel: 'qwen3-rerank',
      rerankUrl: '',
      ...structuredClone(this.state.settings),
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
    return { baseUrl, model, embeddingModel, rerankModel, rerankUrl, hasApiKey: Boolean(encryptedApiKey) };
  }
}

module.exports = { JsonStore };
