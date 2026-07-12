const crypto = require('node:crypto');
const fs = require('node:fs');

const domainPromise = import('../generated/domain/index.js');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function migrationBackupPath(filePath) {
  return `${filePath}.backup-v1`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('迁移时钟无效');
  return date.toISOString();
}

function parseRawState(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (cause) {
    throw new Error('数据文件损坏，已阻止启动以避免覆盖原始记录。', { cause });
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.sessions) || !isRecord(parsed.settings)) {
    throw new Error('数据文件损坏，已阻止启动以避免覆盖原始记录。');
  }
  return parsed;
}

function atomicReplace(filePath, bytes, fileSystem) {
  const tmp = `${filePath}.migration-v2.tmp`;
  try {
    fileSystem.writeFileSync(tmp, bytes, { mode: 0o600 });
    fileSystem.renameSync(tmp, filePath);
  } catch (error) {
    try {
      if (fileSystem.existsSync(tmp)) fileSystem.unlinkSync(tmp);
    } catch {}
    throw error;
  }
}

function ensureExactBackup(filePath, original, fileSystem) {
  const backupPath = migrationBackupPath(filePath);
  if (fileSystem.existsSync(backupPath)) {
    const existing = fileSystem.readFileSync(backupPath);
    if (!Buffer.from(existing).equals(original)) {
      throw new Error('迁移备份与当前原文件字节不一致，已停止覆盖。');
    }
    return backupPath;
  }

  const tmp = `${backupPath}.tmp`;
  try {
    if (fileSystem.existsSync(tmp)) fileSystem.unlinkSync(tmp);
    fileSystem.writeFileSync(tmp, original, { flag: 'wx', mode: 0o600 });
    const staged = fileSystem.readFileSync(tmp);
    if (!Buffer.from(staged).equals(original)) throw new Error('迁移备份写入校验失败。');
    fileSystem.renameSync(tmp, backupPath);
    const persisted = fileSystem.readFileSync(backupPath);
    if (!Buffer.from(persisted).equals(original)) throw new Error('迁移备份回读校验失败。');
    return backupPath;
  } catch (error) {
    try {
      if (fileSystem.existsSync(tmp)) fileSystem.unlinkSync(tmp);
    } catch {}
    throw error;
  }
}

async function migrateDataFile(filePath, {
  domain: injectedDomain,
  now = () => new Date(),
  fileSystem = fs,
  hashPort = { sha256 },
} = {}) {
  if (!fileSystem.existsSync(filePath)) return { migrated: false, state: null };
  const original = fileSystem.readFileSync(filePath);
  const parsed = parseRawState(original);
  if (parsed.migrationVersion === 2) {
    return { migrated: false, state: structuredClone(parsed) };
  }

  const domain = injectedDomain || await domainPromise;
  if (
    !domain
    || typeof domain.migrateLegacySession !== 'function'
    || !isRecord(domain.DEFAULT_RULE_CONTEXT)
  ) throw new TypeError('迁移领域模块无效');
  const builtAt = exactIso(now());
  const sessions = parsed.sessions.map((legacy) => {
    const sessionId = isRecord(legacy) && typeof legacy.id === 'string'
      ? legacy.id
      : 'invalid-session';
    const result = domain.migrateLegacySession(legacy, {
      plateId: `plate:${sessionId}:v2`,
      builtAt,
      ruleContext: domain.DEFAULT_RULE_CONTEXT,
      explicitIntentId: null,
    }, hashPort);
    if (result.state === 'migrated' || result.state === 'unchanged') {
      const migrated = structuredClone(result.session);
      return migrated.caseSnapshot
        ? { ...migrated, caseRuntimeTrust: 'authoritative' }
        : migrated;
    }
    const originalSession = isRecord(result.original)
      ? structuredClone(result.original)
      : (isRecord(legacy) ? structuredClone(legacy) : { legacyValue: structuredClone(legacy) });
    return { ...originalSession, migrationState: 'needs-review' };
  });
  const nextState = {
    ...structuredClone(parsed),
    migrationVersion: 2,
    sessions,
  };
  const nextBytes = Buffer.from(`${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  const validated = parseRawState(nextBytes);
  if (validated.migrationVersion !== 2) throw new Error('迁移结果验证失败');

  const backupPath = ensureExactBackup(filePath, original, fileSystem);
  atomicReplace(filePath, nextBytes, fileSystem);
  return { migrated: true, backupPath, state: structuredClone(validated) };
}

module.exports = { migrateDataFile, migrationBackupPath, sha256 };
