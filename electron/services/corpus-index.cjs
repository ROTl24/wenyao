const fs = require('node:fs');
const path = require('node:path');
const { LocalVectorIndex, ResumableVectorBuilder } = require('./vector-index.cjs');

function safePathPart(value) {
  const normalized = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 160);
  if (!normalized) throw new Error('向量分片标识无效');
  return normalized;
}

function indexIdentity({ fingerprint, providerId, baseUrl, model, dimensions }) {
  if (!fingerprint || !model || !dimensions) throw new Error('向量模型身份不完整');
  return { fingerprint, providerId: providerId || '', baseUrl: baseUrl || '', model, dimensions };
}

class CorpusIndexCoordinator {
  constructor({ indexRoot }) {
    this.indexRoot = path.resolve(indexRoot);
    fs.mkdirSync(this.indexRoot, { recursive: true });
  }

  shardBase(identity, shard) {
    return path.join(
      this.indexRoot,
      safePathPart(identity.fingerprint),
      'shards',
      safePathPart(shard.id),
      'vectors',
    );
  }

  loadShard(identityInput, shard) {
    const identity = indexIdentity(identityInput);
    const index = new LocalVectorIndex(this.shardBase(identity, shard));
    return index.load({ model: identity.model, corpusHash: shard.contentHash, fingerprint: identity.fingerprint }) ? index : null;
  }

  hasShard(identity, shard) {
    return Boolean(this.loadShard(identity, shard));
  }

  readyShards(identity, shards) {
    return shards.filter((shard) => this.hasShard(identity, shard));
  }

  async buildShards({ identity: identityInput, shards, embed, control, onProgress = () => {} }) {
    const identity = indexIdentity(identityInput);
    const requested = shards.filter((shard) => Array.isArray(shard.entries) && shard.entries.length > 0);
    const total = requested.reduce((sum, shard) => sum + shard.entries.length, 0);
    let completedBefore = 0;
    for (const shard of requested) {
      const existing = this.loadShard(identity, shard);
      if (existing) {
        completedBefore += shard.entries.length;
        onProgress({ shardId: shard.id, shardCompleted: shard.entries.length, shardTotal: shard.entries.length, shardProgress: 100, completed: completedBefore, total, progress: total ? completedBefore / total * 100 : 100 });
        continue;
      }
      const builder = new ResumableVectorBuilder(this.shardBase(identity, shard), {
        ...identity,
        corpusHash: shard.contentHash,
        ids: shard.entries.map((entry) => entry.id),
      });
      const batchSize = Math.min(32, Math.max(1, Number(identityInput.batchSize) || 10));
      onProgress({
        shardId: shard.id,
        shardCompleted: builder.completed,
        shardTotal: shard.entries.length,
        shardProgress: builder.status().progress,
        completed: completedBefore + builder.completed,
        total,
        progress: total ? (completedBefore + builder.completed) / total * 100 : 0,
      });
      while (builder.completed < shard.entries.length) {
        if (control.cancelled) {
          return { ok: false, paused: true, completed: completedBefore + builder.completed, total, shardId: shard.id };
        }
        while (control.paused && !control.cancelled) {
          onProgress({ shardId: shard.id, paused: true, shardCompleted: builder.completed, shardTotal: shard.entries.length, shardProgress: builder.status().progress, completed: completedBefore + builder.completed, total, progress: total ? (completedBefore + builder.completed) / total * 100 : 0 });
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (control.cancelled) continue;
        const batch = shard.entries.slice(builder.completed, builder.completed + batchSize)
          .map((entry) => `${entry.source || shard.title}\n${entry.title}\n${entry.text}`);
        const vectors = await embed(batch);
        builder.append(vectors);
        onProgress({
          shardId: shard.id,
          shardCompleted: builder.completed,
          shardTotal: shard.entries.length,
          shardProgress: builder.status().progress,
          completed: completedBefore + builder.completed,
          total,
          progress: total ? (completedBefore + builder.completed) / total * 100 : 100,
        });
      }
      builder.finalize();
      completedBefore += shard.entries.length;
    }
    return { ok: true, completed: total, total, progress: 100 };
  }

  search(identity, shards, queryVector, limit = 40) {
    const candidates = [];
    for (const shard of shards) {
      const index = this.loadShard(identity, shard);
      if (!index) continue;
      candidates.push(...index.search(queryVector, limit, shard.enabledEntryIds));
    }
    return candidates
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, limit);
  }

  migrateLegacyBuiltIn({ identity: identityInput, shard, legacyBases }) {
    const identity = indexIdentity(identityInput);
    if (this.hasShard(identity, shard)) return true;
    const expectedIds = shard.entries.map((entry) => entry.id);
    for (const basePath of legacyBases) {
      const legacy = new LocalVectorIndex(basePath);
      let loaded = false;
      try {
        const meta = JSON.parse(fs.readFileSync(`${basePath}.json`, 'utf8'));
        loaded = legacy.load({ model: identity.model, corpusHash: meta.corpusHash, fingerprint: meta.fingerprint || '' });
      } catch {}
      if (!loaded || legacy.dimensions !== identity.dimensions) continue;
      if (legacy.ids.length !== expectedIds.length || legacy.ids.some((id, index) => id !== expectedIds[index])) continue;
      const targetBase = this.shardBase(identity, shard);
      fs.mkdirSync(path.dirname(targetBase), { recursive: true });
      const nextData = `${targetBase}.f32.next`;
      const nextMeta = `${targetBase}.json.next`;
      fs.copyFileSync(legacy.dataPath, nextData);
      fs.writeFileSync(nextMeta, JSON.stringify({
        version: 2,
        fingerprint: identity.fingerprint,
        providerId: identity.providerId,
        baseUrl: identity.baseUrl,
        model: identity.model,
        corpusHash: shard.contentHash,
        ids: expectedIds,
        dimensions: identity.dimensions,
        completedAt: new Date().toISOString(),
        migratedFromLegacy: true,
      }, null, 2));
      for (const target of [`${targetBase}.f32`, `${targetBase}.json`]) {
        try { fs.unlinkSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      fs.renameSync(nextData, `${targetBase}.f32`);
      fs.renameSync(nextMeta, `${targetBase}.json`);
      return this.hasShard(identity, shard);
    }
    return false;
  }

  purgeBook(bookId) {
    const safeBookId = safePathPart(bookId);
    for (const fingerprintEntry of fs.readdirSync(this.indexRoot, { withFileTypes: true })) {
      if (!fingerprintEntry.isDirectory()) continue;
      const target = path.join(this.indexRoot, fingerprintEntry.name, 'shards', safeBookId);
      const relative = path.relative(this.indexRoot, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('向量分片路径越界');
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
}

module.exports = { CorpusIndexCoordinator, indexIdentity };
