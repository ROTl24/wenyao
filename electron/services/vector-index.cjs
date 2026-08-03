const fs = require('node:fs');
const path = require('node:path');

function normalized(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

class LocalVectorIndex {
  constructor(basePath) {
    this.metaPath = `${basePath}.json`;
    this.dataPath = `${basePath}.f32`;
    this.ids = [];
    this.dimensions = 0;
    this.vectors = null;
    this.meta = null;
  }

  write({ model, corpusHash, fingerprint = '', providerId = '', baseUrl = '', ids, vectors }) {
    if (!ids.length || ids.length !== vectors.length) throw new Error('向量索引条目不完整');
    const dimensions = vectors[0].length;
    if (!dimensions || vectors.some((vector) => vector.length !== dimensions)) throw new Error('向量维度不一致');
    const data = new Float32Array(ids.length * dimensions);
    vectors.forEach((vector, row) => data.set(normalized(vector), row * dimensions));
    fs.mkdirSync(path.dirname(this.metaPath), { recursive: true });
    const dataTmp = `${this.dataPath}.tmp`;
    const metaTmp = `${this.metaPath}.tmp`;
    fs.writeFileSync(dataTmp, Buffer.from(data.buffer));
    fs.writeFileSync(metaTmp, JSON.stringify({
      version: fingerprint ? 2 : 1,
      fingerprint,
      providerId,
      baseUrl,
      model,
      corpusHash,
      ids,
      dimensions,
      completedAt: new Date().toISOString(),
    }, null, 2));
    fs.renameSync(dataTmp, this.dataPath);
    fs.renameSync(metaTmp, this.metaPath);
    this.load({ model, corpusHash, fingerprint });
  }

  load({ model, corpusHash, fingerprint = '' }) {
    try {
      const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf8'));
      if (![1, 2].includes(meta.version) || meta.model !== model || meta.corpusHash !== corpusHash || !Array.isArray(meta.ids)) return false;
      if (fingerprint && (meta.version !== 2 || meta.fingerprint !== fingerprint)) return false;
      const buffer = fs.readFileSync(this.dataPath);
      const expectedBytes = meta.ids.length * meta.dimensions * Float32Array.BYTES_PER_ELEMENT;
      if (buffer.byteLength !== expectedBytes) return false;
      const copy = Uint8Array.from(buffer).buffer;
      this.meta = meta;
      this.ids = meta.ids;
      this.dimensions = meta.dimensions;
      this.vectors = new Float32Array(copy);
      return true;
    } catch {
      return false;
    }
  }

  search(queryVector, limit = 40) {
    if (!this.vectors || queryVector.length !== this.dimensions) return [];
    const query = normalized(queryVector);
    const scores = this.ids.map((id, row) => {
      let score = 0;
      const offset = row * this.dimensions;
      for (let index = 0; index < this.dimensions; index += 1) score += query[index] * this.vectors[offset + index];
      return { id, score };
    });
    return scores.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)).slice(0, limit);
  }
}

function atomicWriteJson(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2));
  fs.renameSync(temporaryPath, filePath);
}

class ResumableVectorBuilder {
  constructor(basePath, { fingerprint, providerId, baseUrl, model, corpusHash, dimensions, ids }) {
    if (!fingerprint || !model || !corpusHash || !dimensions || !Array.isArray(ids) || ids.length === 0) {
      throw new Error('可续建向量索引参数不完整');
    }
    this.basePath = basePath;
    this.dataPath = `${basePath}.partial.f32`;
    this.metaPath = `${basePath}.partial.json`;
    this.finalDataPath = `${basePath}.f32`;
    this.finalMetaPath = `${basePath}.json`;
    this.identity = { version: 2, fingerprint, providerId, baseUrl, model, corpusHash, dimensions, ids };
    this.completed = 0;
    fs.mkdirSync(path.dirname(basePath), { recursive: true });
    this.#loadCheckpoint();
  }

  #loadCheckpoint() {
    let valid = false;
    try {
      const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf8'));
      const sameIdentity = meta.version === 2
        && meta.fingerprint === this.identity.fingerprint
        && meta.model === this.identity.model
        && meta.corpusHash === this.identity.corpusHash
        && meta.dimensions === this.identity.dimensions
        && Array.isArray(meta.ids)
        && meta.ids.length === this.identity.ids.length
        && meta.ids.every((id, index) => id === this.identity.ids[index]);
      if (!sameIdentity) throw new Error('向量索引断点与当前配置不一致');
      const completed = Math.min(this.identity.ids.length, Math.max(0, Number(meta.completed) || 0));
      const expectedBytes = completed * this.identity.dimensions * Float32Array.BYTES_PER_ELEMENT;
      if (!fs.existsSync(this.dataPath)) throw new Error('向量索引断点数据不存在');
      const actualBytes = fs.statSync(this.dataPath).size;
      if (actualBytes < expectedBytes) throw new Error('向量索引断点数据不完整');
      if (actualBytes > expectedBytes) fs.truncateSync(this.dataPath, expectedBytes);
      this.completed = completed;
      valid = true;
    } catch {
      valid = false;
    }
    if (!valid) this.reset();
  }

  reset() {
    for (const target of [this.dataPath, this.metaPath]) {
      try { fs.unlinkSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    this.completed = 0;
  }

  append(vectors) {
    if (!Array.isArray(vectors) || vectors.length === 0) throw new Error('向量批次不能为空');
    if (this.completed + vectors.length > this.identity.ids.length) throw new Error('向量批次超出索引条目总数');
    if (vectors.some((vector) => !Array.isArray(vector) || vector.length !== this.identity.dimensions)) {
      throw new Error('向量批次维度不一致');
    }
    const data = new Float32Array(vectors.length * this.identity.dimensions);
    vectors.forEach((vector, row) => data.set(normalized(vector), row * this.identity.dimensions));
    fs.appendFileSync(this.dataPath, Buffer.from(data.buffer));
    this.completed += vectors.length;
    atomicWriteJson(this.metaPath, {
      ...this.identity,
      completed: this.completed,
      updatedAt: new Date().toISOString(),
    });
    return this.completed;
  }

  finalize() {
    if (this.completed !== this.identity.ids.length) throw new Error('向量索引尚未构建完整');
    const expectedBytes = this.completed * this.identity.dimensions * Float32Array.BYTES_PER_ELEMENT;
    if (!fs.existsSync(this.dataPath) || fs.statSync(this.dataPath).size !== expectedBytes) {
      throw new Error('向量索引临时文件不完整');
    }
    const nextDataPath = `${this.finalDataPath}.next`;
    const nextMetaPath = `${this.finalMetaPath}.next`;
    fs.copyFileSync(this.dataPath, nextDataPath);
    fs.writeFileSync(nextMetaPath, JSON.stringify({
      ...this.identity,
      completedAt: new Date().toISOString(),
    }, null, 2));
    for (const target of [this.finalDataPath, this.finalMetaPath]) {
      try { fs.unlinkSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    fs.renameSync(nextDataPath, this.finalDataPath);
    fs.renameSync(nextMetaPath, this.finalMetaPath);
    try { fs.unlinkSync(this.dataPath); } catch {}
    try { fs.unlinkSync(this.metaPath); } catch {}
    const index = new LocalVectorIndex(this.basePath);
    if (!index.load(this.identity)) throw new Error('完成后的向量索引校验失败');
    return index;
  }

  status() {
    return {
      completed: this.completed,
      total: this.identity.ids.length,
      progress: Math.round((this.completed / this.identity.ids.length) * 1000) / 10,
    };
  }
}

module.exports = { LocalVectorIndex, ResumableVectorBuilder };
