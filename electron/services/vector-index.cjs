const fs = require('node:fs');

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

  write({ model, corpusHash, ids, vectors }) {
    if (!ids.length || ids.length !== vectors.length) throw new Error('向量索引条目不完整');
    const dimensions = vectors[0].length;
    if (!dimensions || vectors.some((vector) => vector.length !== dimensions)) throw new Error('向量维度不一致');
    const data = new Float32Array(ids.length * dimensions);
    vectors.forEach((vector, row) => data.set(normalized(vector), row * dimensions));
    fs.mkdirSync(require('node:path').dirname(this.metaPath), { recursive: true });
    const dataTmp = `${this.dataPath}.tmp`;
    const metaTmp = `${this.metaPath}.tmp`;
    fs.writeFileSync(dataTmp, Buffer.from(data.buffer));
    fs.writeFileSync(metaTmp, JSON.stringify({ version: 1, model, corpusHash, ids, dimensions }, null, 2));
    fs.renameSync(dataTmp, this.dataPath);
    fs.renameSync(metaTmp, this.metaPath);
    this.load({ model, corpusHash });
  }

  load({ model, corpusHash }) {
    try {
      const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf8'));
      if (meta.version !== 1 || meta.model !== model || meta.corpusHash !== corpusHash || !Array.isArray(meta.ids)) return false;
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

module.exports = { LocalVectorIndex };
